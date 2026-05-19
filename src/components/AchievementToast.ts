const TOAST_DURATION_MS = 3000;
const TOAST_ENTRY_STAGGER_MS = 250;
const MAX_VISIBLE = 5;

export type ToastItem = {
  id: string;
  name: string;
  description: string;
};

let container: HTMLElement | null = null;
const queue: ToastItem[] = [];
let visibleCount = 0;

function ensureContainer(): HTMLElement {
  if (container && container.isConnected) return container;
  container = document.createElement('div');
  container.className = 'achievement-toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.append(container);
  return container;
}

export function showAchievementToasts(items: ToastItem[]): void {
  queue.push(...items);
  drain();
}

function drain(): void {
  if (queue.length === 0) return;
  if (visibleCount >= MAX_VISIBLE) return;

  const item = queue.shift();
  if (!item) return;

  visibleCount += 1;
  mount(item);

  if (queue.length > 0 && visibleCount < MAX_VISIBLE) {
    window.setTimeout(drain, TOAST_ENTRY_STAGGER_MS);
  }
}

function mount(item: ToastItem): void {
  const root = ensureContainer();

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.setAttribute('role', 'status');

  const icon = document.createElement('div');
  icon.className = 'achievement-toast-icon';
  icon.textContent = '🏆';

  const text = document.createElement('div');
  text.className = 'achievement-toast-text';

  const name = document.createElement('div');
  name.className = 'achievement-toast-name';
  name.textContent = item.name;

  const desc = document.createElement('div');
  desc.className = 'achievement-toast-description';
  desc.textContent = item.description;

  text.append(name, desc);
  toast.append(icon, text);
  root.append(toast);

  window.setTimeout(() => {
    toast.dataset.leaving = 'true';
    toast.addEventListener(
      'animationend',
      () => {
        toast.remove();
        visibleCount = Math.max(0, visibleCount - 1);
        if (queue.length > 0) drain();
      },
      { once: true }
    );
  }, TOAST_DURATION_MS);
}
