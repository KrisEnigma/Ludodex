export type ConfirmModalOptions = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as a destructive action and focuses the cancel button. */
  destructive?: boolean;
};

export function showConfirmModal(options: ConfirmModalOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const titleEl = document.createElement('h3');
    titleEl.className = 'modal-title';
    titleEl.textContent = options.title;

    const bodyEl = document.createElement('p');
    bodyEl.className = 'modal-body';
    bodyEl.textContent = options.body;

    const buttonRow = document.createElement('div');
    buttonRow.className = 'modal-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'modal-button modal-button-cancel';
    cancelBtn.textContent = options.cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = options.destructive
      ? 'modal-button modal-button-confirm modal-button-destructive'
      : 'modal-button modal-button-confirm';
    confirmBtn.textContent = options.confirmLabel;

    let settled = false;
    const settle = (value: boolean): void => {
      if (settled) return;
      settled = true;
      backdrop.removeEventListener('click', onBackdropClick);
      document.removeEventListener('keydown', onKeyDown);
      backdrop.remove();
      resolve(value);
    };

    const onCancel = (): void => settle(false);
    const onConfirm = (): void => settle(true);
    const onBackdropClick = (event: MouseEvent): void => {
      if (event.target === backdrop) onCancel();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
      else if (event.key === 'Enter') onConfirm();
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    backdrop.addEventListener('click', onBackdropClick);
    document.addEventListener('keydown', onKeyDown);

    buttonRow.append(cancelBtn, confirmBtn);
    modal.append(titleEl, bodyEl, buttonRow);
    backdrop.append(modal);
    document.body.append(backdrop);

    if (options.destructive) cancelBtn.focus();
    else confirmBtn.focus();
  });
}