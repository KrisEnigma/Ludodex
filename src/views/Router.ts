// (moved inside Router class below)
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { Puzzle } from '../types/puzzle';
import { track } from '../services/AnalyticsService';
import { trackRoute } from '../services/SentryService';
import { fireInterstitialIfPending } from '../services/AdService';
import { pathForRoute } from '../services/DeepLinking';
import { showConfirmModal } from '../components/Modal';
import { closeAllOverlays, closeTopOverlay, installOverlayKeyboard } from '../components/overlayStack';
import { t } from '../i18n';

import { ArchiveView } from './ArchiveView';
import { GameView } from './GameView';
import { HowToPlayView } from './HowToPlayView';
import { MenuView } from './MenuView';
import { SettingsView } from './SettingsView';
import { WinView } from './WinView';
import { AchievementsView } from './AchievementsView';
import type { WinPayload } from './types';

export type RouteName = 'menu' | 'game' | 'win' | 'settings' | 'archive' | 'how-to-play' | 'achievements';

export type RoutePayloads = {
  menu: undefined;
  game: { puzzle: Puzzle; dayNumber: number; isTodaysDaily: boolean; isTutorial?: boolean; isPreview?: boolean; previewToken?: string };
  win: WinPayload;
  settings: undefined;
  archive: undefined;
  'how-to-play': { fromOnboarding: boolean };
  achievements: undefined;
};

type RouteEntry<T extends RouteName = RouteName> = {
  name: T;
  payload: RoutePayloads[T];
};

/**
 * Anything the Router can mount. `onShown` runs once the view is visible;
 * `dispose` runs when it is replaced.
 */
type MountableView = { element: HTMLElement; onShown?: () => void; dispose?: () => void };

type AnyRouteEntry = {
  [K in RouteName]: { name: K; payload: RoutePayloads[K] }
}[RouteName];

export class Router {
  private mount(view: MountableView): void {
    // Tear down the outgoing view (timers, window/document listeners) before
    // replacing it. Views without dispose() self-clean via isConnected checks.
    // Nothing opened on the previous screen may float over the next one.
    closeAllOverlays();
    this.currentView?.dispose?.();
    this.currentView = view;

    const element = view.element;
    element.classList.add('view-entering');
    this.shell.replaceChildren(element);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.classList.remove('view-entering');
        // The view is now visible (fade-in starting). Skip if it was already
        // replaced before these frames ran, so a disposed view never starts
        // work. rAF doesn't run while the page is hidden, so a view mounted
        // in the background is "shown" when the page becomes visible.
        if (this.currentView === view && element.isConnected) view.onShown?.();
      });
    });
  }

  private readonly shell: HTMLDivElement;
  private currentView: MountableView | null = null;
  private stack: AnyRouteEntry[] = [];
  // Custom back action for the current view. Set in renderCurrent(); cleared
  // before each render so routes that don't override it fall through to the
  // default pop / minimizeApp behaviour.
  private currentBackAction: (() => void) | null = null;

  constructor(app: HTMLDivElement) {
    this.shell = document.createElement('div');
    this.shell.className = 'app-shell';
    app.replaceChildren(this.shell);

    // Escape closes the top sheet/dialog; Tab stays inside it (all overlays).
    installOverlayKeyboard();

    // Listen for browser back/forward. With replaceState-based URL sync,
    // popstate only fires when the user actually presses the browser's
    // back/forward buttons (not on our own URL updates). We re-parse the
    // URL and pop-or-replace internal state to match. See onPopState.
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState);
    }

    // Android hardware back button / gesture. On native the system fires this
    // event; we route it through currentBackAction so views like GameView can
    // intercept it for their own confirmation flow. At the stack root we
    // minimise (don't exit — matches Android UX convention).
    if (Capacitor.isNativePlatform()) {
      void CapacitorApp.addListener('backButton', this.onHardwareBack);
    }

    // DEV-only: the Dev overlay's "◀ Back" button dispatches this event so the
    // exact hardware-back path can be exercised in a desktop browser.
    // Compiled out of production.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.addEventListener('ludodex:dev-hardware-back', this.onHardwareBack);
    }
  }

  push<T extends RouteName>(route: T, payload?: RoutePayloads[T]): void {
    this.stack.push({
      name: route,
      payload: (payload ?? this.defaultPayload(route)) as RoutePayloads[T]
    } as AnyRouteEntry);
    trackRoute(route, 'push');
    this.trackViewIfRelevant(route);
    // The root entry reuses the landing history entry, so leaving the site
    // from the menu is a single Back. Every screen above it gets its own.
    this.writeHistory(this.stack.length > 1 ? 'push' : 'replace');
    this.renderCurrent();
  }

  replace<T extends RouteName>(route: T, payload?: RoutePayloads[T]): void {
    const next: RouteEntry<T> = {
      name: route,
      payload: (payload ?? this.defaultPayload(route)) as RoutePayloads[T]
    };

    if (this.stack.length === 0) {
      this.stack.push(next as AnyRouteEntry);
    } else {
      this.stack[this.stack.length - 1] = next as AnyRouteEntry;
    }

    trackRoute(route, 'replace');
    this.trackViewIfRelevant(route);
    this.writeHistory('replace');
    this.renderCurrent();
  }

  /** In-app back (← Menu, Done…). Also steps browser history back on web. */
  pop(): void {
    this.popTo(this.stack.length - 2, true);
  }

  popToRoot(): void {
    this.popTo(0, true);
  }

  /**
   * Pop the stack down to `depth` (0 = root) and render.
   * `syncHistory`: true for app-initiated pops (we step browser history back
   * to match); false when the browser already moved (popstate).
   */
  private popTo(depth: number, syncHistory: boolean): void {
    const target = Math.max(0, depth);
    if (this.stack.length - 1 <= target) return;
    const steps = this.stack.length - 1 - target;
    const leaving = this.stack[this.stack.length - 1];
    this.stack.length = target + 1;
    const current = this.stack[this.stack.length - 1];
    if (current) trackRoute(current.name, 'pop');

    // Critical timing rule: fire pending interstitial when navigating AWAY
    // from WinView. The WinView celebration stays completely clean; the ad
    // fires on the transition out (Done or Back button). This is a fire-and-
    // forget — we do not await the ad before mounting the next view, so there
    // is no perceived delay on the nav action itself.
    if (leaving?.name === 'win') {
      void fireInterstitialIfPending();
    }

    if (syncHistory) {
      const historyDepth = this.readHistoryDepth(history.state);
      if (this.useHistory && historyDepth !== null && historyDepth - steps >= 0) {
        // Our own history step: the resulting popstate must be ignored.
        this.pendingSelfPops += 1;
        history.go(-steps);
      } else {
        this.writeHistory('replace');
      }
    }
    this.renderCurrent();
  }

  // ── Browser history (web only) ─────────────────────────────────────────────
  //
  // Web: every screen above the root has its own history entry, tagged with
  // its stack depth, so browser Back mirrors the in-app back behaviour
  // (overlay first → screen back action → pop) and only leaves the site from
  // the root. Native: Android Back arrives via the Capacitor `backButton`
  // event instead, so history is only used to keep the URL in sync
  // (replaceState), as before.

  private readonly useHistory = !Capacitor.isNativePlatform();
  // Number of popstate events caused by our own history.go() calls.
  private pendingSelfPops = 0;

  private urlForTop(): string {
    const top = this.stack[this.stack.length - 1];
    const path = top ? pathForRoute(top.name, top.payload) : null;
    // Overlay routes (settings, archive…) have no path of their own: keep the
    // current one. Keep the query string (dev `?day=N` override).
    return (path ?? window.location.pathname) + window.location.search;
  }

  private readHistoryDepth(state: unknown): number | null {
    const s = state as { ludodex?: boolean; depth?: unknown } | null;
    return s?.ludodex === true && typeof s.depth === 'number' ? s.depth : null;
  }

  private writeHistory(mode: 'push' | 'replace'): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    if (this.stack.length === 0) return;
    const state = { ludodex: true, depth: this.stack.length - 1 };
    try {
      if (mode === 'push' && this.useHistory) {
        history.pushState(state, '', this.urlForTop());
      } else {
        history.replaceState(state, '', this.urlForTop());
      }
    } catch {
      // SecurityError can fire on file:// or sandboxed contexts; ignore.
    }
  }

  private onHardwareBack = (): void => {
    // An open sheet/modal takes Back first (closing the hint store, the
    // Leave dialog, the quit dialog…) before any screen navigation.
    if (closeTopOverlay()) return;
    if (this.currentBackAction) {
      this.currentBackAction();
      return;
    }
    if (this.stack.length <= 1) {
      // At the menu root — ask before closing.
      void showConfirmModal({
        title: t('dialog.quit_title'),
        body: t('dialog.quit_body'),
        confirmLabel: t('dialog.quit_confirm'),
        cancelLabel: t('common.cancel'),
        destructive: true
      }).then((confirmed) => {
        if (confirmed) void CapacitorApp.exitApp();
      });
      return;
    }
    this.pop();
  };

  /**
   * Browser Back / Forward (web). By the time this fires the browser has
   * already moved; we reconcile the stack to the entry's depth, or — if Back
   * should not navigate (an overlay was open, or the screen intercepts Back,
   * e.g. GameView's Leave confirm) — restore the entry we just left.
   */
  private onPopState = (event: PopStateEvent): void => {
    if (this.pendingSelfPops > 0) {
      this.pendingSelfPops -= 1;
      return;
    }
    if (!this.useHistory) return;

    const currentDepth = this.stack.length - 1;
    // Untagged entry (pre-app / legacy): treat as one step back.
    const targetDepth = this.readHistoryDepth(event.state) ?? currentDepth - 1;

    if (targetDepth > currentDepth) {
      // Forward into a screen we already closed — its payload is gone, so it
      // can't be rebuilt. Undo the move.
      this.pendingSelfPops += 1;
      history.go(currentDepth - targetDepth);
      return;
    }
    if (targetDepth === currentDepth) return;

    const restoreEntry = (): void => {
      try {
        history.pushState({ ludodex: true, depth: currentDepth }, '', this.urlForTop());
      } catch {
        // ignore
      }
    };

    if (closeTopOverlay()) {
      restoreEntry();
      return;
    }
    if (this.currentBackAction) {
      // e.g. GameView: shows the Leave confirm. If the player confirms, the
      // view calls pop(), which steps back over the restored entry.
      restoreEntry();
      this.currentBackAction();
      return;
    }
    this.popTo(targetDepth, false);
  };

  private renderCurrent(): void {
    const current = this.stack[this.stack.length - 1];
    if (!current) return;

    // Clear any view-specific back-button override before building the new view.
    this.currentBackAction = null;

    // When replacing a win route with a new route (Play Again → new game),
    // fire the pending interstitial on the transition.
    const prev = this.stack[this.stack.length - 2];
    const isReplacingWin = prev?.name === 'win' && current.name !== 'win';
    if (isReplacingWin) {
      void fireInterstitialIfPending();
    }

    switch (current.name) {
      case 'menu': {
        const view = new MenuView({
          onPlay: (payload) => this.push('game', payload),
          onOpenSettings: () => this.push('settings'),
          onOpenArchive: () => this.push('archive'),
          onOpenHowToPlay: () => this.push('how-to-play', { fromOnboarding: false }),
          onOpenAchievements: () => this.push('achievements'),
          onDayChanged: () => this.replace('menu'),
        });
        this.mount(view);
        return;
      }
      case 'achievements': {
        const view = new AchievementsView(() => this.pop());
        this.mount(view);
        return;
      }
      case 'game': {
        const view = new GameView(current.payload, {
          onWin: (payload) => this.replace('win', payload),
          onMenu: () => this.pop()
        });
        // GameView's exit flow shows a confirmation dialog when there's progress,
        // so route the hardware back button through it rather than popping directly.
        this.currentBackAction = () => void view.exit();
        this.mount(view);
        return;
      }
      case 'win': {
        const view = new WinView(current.payload, this, () => {
          this.pop();
        });
        this.mount(view);
        return;
      }
      case 'settings': {
        const view = new SettingsView(
          () => this.pop(),
          () => this.replace('settings'),
          // A newly chosen skin lands on the menu, where the wordmark sweep
          // shows it off straight away.
          () => this.popToRoot()
        );
        this.mount(view);
        return;
      }
      case 'archive': {
        const view = new ArchiveView(
          () => this.pop(),
          (puzzle, dayNumber) => {
            this.replace('game', { puzzle, dayNumber, isTodaysDaily: false });
          }
        );
        this.mount(view);
        return;
      }
      case 'how-to-play': {
        const payload = current.payload ?? { fromOnboarding: false };
        const view = new HowToPlayView(payload, () => {
          if (payload.fromOnboarding) {
            this.replace('menu');
          } else {
            this.pop();
          }
        });
        this.mount(view);
        return;
      }
      default:
        return;
    }
  }

  private defaultPayload<T extends RouteName>(route: T): RoutePayloads[T] {
    if (route === 'menu') return undefined as RoutePayloads[T];
    if (route === 'settings') return undefined as RoutePayloads[T];
    if (route === 'archive') return undefined as RoutePayloads[T];
    if (route === 'how-to-play') return { fromOnboarding: false } as RoutePayloads[T];
    if (route === 'achievements') return undefined as RoutePayloads[T];
    throw new Error(`Route ${route} requires a payload`);
  }

  private trackViewIfRelevant(routeName: RouteName): void {
    const relevant: RouteName[] = ['settings', 'archive', 'achievements', 'how-to-play'];
    if (relevant.includes(routeName)) {
      track('view_opened', { view_name: routeName });
    }
  }
}
