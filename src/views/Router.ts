// (moved inside Router class below)
import type { Puzzle } from '../types/puzzle';

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
  }

  push<T extends RouteName>(route: T, payload?: RoutePayloads[T]): void {
    this.stack.push({
      name: route,
      payload: (payload ?? this.defaultPayload(route)) as RoutePayloads[T]
    } as AnyRouteEntry);
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

    this.renderCurrent();
  }

  pop(): void {
    if (this.stack.length <= 1) {
      return;
    }
    this.stack.pop();
    this.renderCurrent();
  }

  popToRoot(): void {
    if (this.stack.length === 0) return;
    while (this.stack.length > 1) {
      this.stack.pop();
    }

    this.renderCurrent();
  }

  private renderCurrent(): void {
    const current = this.stack[this.stack.length - 1];
    if (!current) return;

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
}
