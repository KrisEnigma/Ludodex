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
 */

type OverlayEntry = { el: HTMLElement; close: () => void };

const entries: OverlayEntry[] = [];

function prune(): void {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!entries[i].el.isConnected) entries.splice(i, 1);
  }
}

/** Register an overlay. Call right after appending `el` to the document. */
export function trackOverlay(el: HTMLElement, close: () => void): void {
  prune();
  entries.push({ el, close });
}

/** Close the top-most open overlay. Returns true if one was closed. */
export function closeTopOverlay(): boolean {
  prune();
  const top = entries.pop();
  if (!top) return false;
  top.close();
  return true;
}

/** Close every open overlay, top-most first. */
export function closeAllOverlays(): void {
  while (closeTopOverlay()) {
    // keep closing
  }
}

let escapeInstalled = false;

/**
 * Escape closes the top-most overlay (web/desktop parity with Android Back).
 * Install once at startup. Overlays don't need their own Escape handlers.
 */
export function installEscapeToClose(): void {
  if (escapeInstalled || typeof document === 'undefined') return;
  escapeInstalled = true;
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (closeTopOverlay()) event.preventDefault();
  });
}
