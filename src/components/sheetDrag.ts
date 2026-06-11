/**
 * addDragToDismiss — attaches drag-to-dismiss behavior to a bottom sheet's
 * handle element.
 *
 * How it works:
 *  - pointerdown on the handle captures the pointer and starts tracking.
 *  - CSS transitions are suspended during the drag so the sheet follows
 *    the finger with zero latency.
 *  - On release: if the drag distance exceeds `threshold` px, the sheet
 *    animates off-screen (restoring the CSS transition) and calls
 *    `onDismissed` after 280 ms. Otherwise it snaps back.
 *
 * Callers supply an `onDismissed` callback that performs the final DOM
 * cleanup (backdrop.remove(), resolve(), etc.) — the animation itself is
 * handled here.
 */
export function addDragToDismiss(
  handle: HTMLElement,
  sheet: HTMLElement,
  backdrop: HTMLElement,
  onDismissed: () => void,
  threshold = 80
): void {
  let startY = 0;
  let dragging = false;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    // Kill transitions during drag so the sheet tracks the finger instantly.
    sheet.style.transition = 'none';
    backdrop.style.transition = 'none';
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - dy / 300));
  });

  handle.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = Math.max(0, e.clientY - startY);
    // Restore transitions before the final animation.
    sheet.style.transition = '';
    backdrop.style.transition = '';
    if (dy > threshold) {
      // Animate off-screen from current dragged position, then clean up.
      sheet.style.transform = 'translateY(100%)';
      backdrop.style.opacity = '0';
      window.setTimeout(onDismissed, 280);
    } else {
      // Snap back.
      sheet.style.transform = '';
      backdrop.style.opacity = '';
    }
  });

  handle.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    backdrop.style.transition = '';
    sheet.style.transform = '';
    backdrop.style.opacity = '';
  });
}
