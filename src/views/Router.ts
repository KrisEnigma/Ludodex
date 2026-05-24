// (moved inside Router class below)
import type { Puzzle } from '../types/puzzle';
import { track } from '../services/AnalyticsService';
import { trackRoute } from '../services/SentryService';
import { fireInterstitialIfPending } from '../services/AdService';
import { pathForRoute, parseCurrentUrl } from '../services/DeepLinking';

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
  game: { puzzle: Puzzle; dayNumber: number; isTodaysDaily: boolean; isTutorial?: boolean };
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

type AnyRouteEntry = {
  [K in RouteName]: { name: K; payload: RoutePayloads[K] }
}[RouteName];

export class Router {
  private mount(element: HTMLElement): void {
    element.classList.add('view-entering');
    this.shell.replaceChildren(element);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.classList.remove('view-entering');
      });
    });
  }

  private readonly shell: HTMLDivElement;
  private stack: AnyRouteEntry[] = [];

  constructor(app: HTMLDivElement) {
    this.shell = document.createElement('div');
    this.shell.className = 'app-shell';
    app.replaceChildren(this.shell);

    // Listen for browser back/forward. With replaceState-based URL sync,
    // popstate only fires when the user actually presses the browser's
    // back/forward buttons (not on our own URL updates). We re-parse the
    // URL and pop-or-replace internal state to match. See onPopState.
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.onPopState);
    }
  }

  push<T extends RouteName>(route: T, payload?: RoutePayloads[T]): void {
    this.stack.push({
      name: route,
      payload: (payload ?? this.defaultPayload(route)) as RoutePayloads[T]
    } as AnyRouteEntry);
    trackRoute(route, 'push');
    this.trackViewIfRelevant(route);
    this.syncUrlFromTop();
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
    this.syncUrlFromTop();
    this.renderCurrent();
  }

  pop(): void {
    if (this.stack.length <= 1) {
      return;
    }
    const leaving = this.stack[this.stack.length - 1];
    this.stack.pop();
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

    this.syncUrlFromTop();
    this.renderCurrent();
  }

  popToRoot(): void {
    if (this.stack.length === 0) return;
    const leaving = this.stack[this.stack.length - 1];
    while (this.stack.length > 1) {
      this.stack.pop();
    }

    if (leaving?.name === 'win') {
      void fireInterstitialIfPending();
    }

    this.syncUrlFromTop();
    this.renderCurrent();
  }

  /**
   * Update the URL bar to reflect the top of the stack. Uses replaceState so
   * we don't accumulate browser history entries for every internal nav —
   * "back" from a deep-link entry naturally leaves the app, which is the
   * desired behavior for a shared puzzle link. Pure URL update, no DOM work.
   *
   * No-op on Capacitor native (URL bar isn't visible) and when running in
   * a non-browser context. We still call it on native — it's cheap, and
   * the WebView underneath does honor pushState/replaceState which keeps
   * any future hybrid features working.
   */
  private syncUrlFromTop(): void {
    if (typeof window === 'undefined' || typeof history === 'undefined') return;
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    const path = pathForRoute(top.name, top.payload);
    if (path === null) return;
    if (window.location.pathname === path) return;
    try {
      history.replaceState({}, '', path);
    } catch {
      // SecurityError can fire on file:// or sandboxed contexts; ignore.
    }
  }

  /**
   * Handle the browser's back/forward buttons.
   *
   * Strategy: parse the new URL and reconcile. If it's a puzzle URL and we
   * can render it, route to that puzzle. If it's the root, pop to menu.
   * If we can't make sense of it (rare — the URL must have come from us
   * originally), leave the stack alone.
   *
   * NOTE: This is "soft" history support. Because we use replaceState (not
   * pushState) for internal nav, the only popstate events we see come from
   * the user actually pressing back/forward on a URL that existed before
   * our app loaded — typically deep-link entry → user back → leaves the
   * app to the referring page. The handler here is a safety net for cases
   * where the URL was changed externally (rare).
   */
  private onPopState = (): void => {
    const parsed = parseCurrentUrl();
    if (parsed.kind === 'puzzle') {
      this.replace('game', {
        puzzle: parsed.puzzle,
        dayNumber: parsed.dayNumber,
        isTodaysDaily: parsed.isTodaysDaily
      });
      return;
    }
    // Menu or archive-locked: just go to menu.
    if (this.stack.length > 0 && this.stack[this.stack.length - 1].name !== 'menu') {
      this.replace('menu');
    }
  };

  private renderCurrent(): void {
    const current = this.stack[this.stack.length - 1];
    if (!current) return;

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
        });
        this.mount(view.element);
        return;
      }
      case 'achievements': {
        const view = new AchievementsView(() => this.pop());
        this.mount(view.element);
        return;
      }
      case 'game': {
        const view = new GameView(current.payload, {
          onWin: (payload) => this.replace('win', payload),
          onMenu: () => this.pop()
        });
        this.mount(view.element);
        return;
      }
      case 'win': {
        const view = new WinView(current.payload, this, () => {
          this.pop();
        });
        this.mount(view.element);
        return;
      }
      case 'settings': {
        const view = new SettingsView(
          () => this.pop(),
          () => this.replace('settings')
        );
        this.mount(view.element);
        return;
      }
      case 'archive': {
        const view = new ArchiveView(
          () => this.pop(),
          (puzzle, dayNumber) => {
            this.replace('game', { puzzle, dayNumber, isTodaysDaily: false });
          }
        );
        this.mount(view.element);
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
        this.mount(view.element);
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
