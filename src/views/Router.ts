import { MenuView } from './MenuView';
import { GameView } from './GameView';
import { WinView } from './WinView';
import type { WinPayload } from './types';

export class Router {
  private readonly app: HTMLDivElement;
  private readonly shell: HTMLDivElement;

  constructor(app: HTMLDivElement) {
    this.app = app;
    this.shell = document.createElement('div');
    this.shell.className = 'app-shell';
    this.app.replaceChildren(this.shell);
  }

  goToMenu(): void {
    this.shell.replaceChildren(new MenuView(() => this.goToGame()).element);
  }

  goToGame(): void {
    this.shell.replaceChildren(
      new GameView((payload) => this.goToWin(payload), () => this.goToMenu()).element
    );
  }

  goToWin(payload: WinPayload): void {
    this.shell.replaceChildren(new WinView(payload, () => this.goToMenu()).element);
  }
}
