/**
 * Registry of open overlays (modals, bottom sheets) so the Router can:
 *   - close the top-most overlay on Back (Android hardware back, and later
 *     browser Back) before navigating, and
 *   - close any leftovers when the view changes, so nothing floats over
 *     the next screen.
 *
 * Overlays register their root element + a close function when they open.
 * They do NOT need to unregister: every close path (✕, backdrop tap, drag,
 * action buttons) ends by removing the root element, and entries whose
 * element is no longer in the DOM are pruned automatically.
 *
 * `close` functions must be safe to call more than once (all current ones
 * are: they guard with a flag or are naturally idempotent).
 *
 * Keyboard/focus (installOverlayKeyboard + trackOverlay):
 *   - opening moves focus into the overlay (unless it focused something itself)
 *   - Tab / Shift+Tab cycle inside the top-most overlay (focus trap)
 *   - Escape closes the top-most overlay
 *   - when the overlay leaves the DOM (any close path), focus returns to the
 *     element that had it before opening — if that element still exists and
 *     focus hasn't deliberately moved elsewhere.
 */

type OverlayEntry = { el: HTMLElement; close: () => void; returnFocus: HTMLElement | null };

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('hidden'));
}

const entries: OverlayEntry[] = [];
// Closed via the stack (Back/Escape) but possibly still animating out; kept
// so focus can be restored once the element is actually removed.
const closing: OverlayEntry[] = [];

function prune(): void {
  for (const list of [entries, closing]) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].el.isConnected) {
        const [gone] = list.splice(i, 1);
        restoreFocus(gone);
      }
    }
  }
}

function restoreFocus(entry: OverlayEntry): void {
  const target = entry.returnFocus;
  if (!target || !target.isConnected) return; // e.g. the screen changed
  const active = document.activeElement;
  // Only reclaim focus that was lost with the overlay (body / detached).
  if (active && active !== document.body && active.isConnected && !entry.el.contains(active)) return;
  target.focus({ preventScroll: true });
}

let removalObserver: MutationObserver | null = null;

function ensureRemovalObserver(): void {
  if (removalObserver || typeof MutationObserver === 'undefined') return;
  // Every overlay is appended directly to <body>; watch for their removal so
  // focus returns no matter which close path removed them.
  removalObserver = new MutationObserver(() => {
    if (entries.some((e) => !e.el.isConnected) || closing.some((e) => !e.el.isConnected)) prune();
  });
  removalObserver.observe(document.body, { childList: true });
}

/** Register an overlay. Call right after appending `el` to the document. */
export function trackOverlay(el: HTMLElement, close: () => void): void {
  prune();
  ensureRemovalObserver();
  const active = document.activeElement;
  const returnFocus = active instanceof HTMLElement && active !== document.body && !el.contains(active) ? active : null;
  entries.push({ el, close, returnFocus });
  // Move focus inside unless the overlay already focused something (Modal does,
  // right after registering — that later focus() simply wins).
  if (!el.contains(document.activeElement)) {
    focusables(el)[0]?.focus({ preventScroll: true });
  }
}

/** Close the top-most open overlay. Returns true if one was closed. */
export function closeTopOverlay(): boolean {
  prune();
  const top = entries.pop();
  if (!top) return false;
  closing.push(top);
  top.close();
  prune(); // overlays that remove themselves synchronously restore focus now
  return true;
}

/** True while any sheet/dialog is open (game keys stay out of its way). */
export function hasOpenOverlay(): boolean {
  prune();
  return entries.length > 0;
}

/** Close every open overlay, top-most first. */
export function closeAllOverlays(): void {
  while (closeTopOverlay()) {
    // keep closing
  }
}

let keyboardInstalled = false;

/**
 * Overlay keyboard handling, installed once at startup:
 *   Escape → close the top-most overlay (parity with Android Back);
 *   Tab / Shift+Tab → stay inside the top-most overlay.
 * Overlays don't need their own key handlers.
 */
export function installOverlayKeyboard(): void {
  if (keyboardInstalled || typeof document === 'undefined') return;
  keyboardInstalled = true;
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      if (closeTopOverlay()) event.preventDefault();
      return;
    }
    if (event.key !== 'Tab') return;
    prune();
    const top = entries[entries.length - 1];
    if (!top) return;
    const items = focusables(top.el);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && top.el.contains(active);
    if (event.shiftKey && (active === first || !inside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !inside)) {
      event.preventDefault();
      first.focus();
    }
  });
}
