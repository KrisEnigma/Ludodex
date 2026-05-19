export class MenuView {
  readonly element: HTMLDivElement;

  constructor(onPlay: () => void) {
    this.element = document.createElement('div');
    this.element.className = 'view menu-view';

    const subtitle = document.createElement('p');
    subtitle.className = 'view-subtitle';
    subtitle.textContent = 'Main Menu';

    const title = document.createElement('h1');
    title.className = 'view-title';
    title.textContent = 'GlitchSalad';

    const playButton = document.createElement('button');
    playButton.type = 'button';
    playButton.className = 'action-button';
    playButton.textContent = 'Play Daily Puzzle';
    playButton.addEventListener('click', onPlay);

    this.element.append(subtitle, title, playButton);
  }
}
