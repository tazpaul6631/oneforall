import { reactive } from 'vue';

export const confirmState = reactive({
  open: false,
  title: 'Xác nhận',
  message: '',
  acceptLabel: 'Xóa',
  danger: true,
});

let pending: ((ok: boolean) => void) | null = null;

export function askConfirm(
  message: string,
  options?: { title?: string; acceptLabel?: string; danger?: boolean },
) {
  if (pending) {
    pending(false);
    pending = null;
  }
  confirmState.title = options?.title ?? 'Xác nhận';
  confirmState.message = message;
  confirmState.acceptLabel = options?.acceptLabel ?? 'Xóa';
  confirmState.danger = options?.danger ?? true;
  confirmState.open = true;
  return new Promise<boolean>((resolve) => {
    pending = resolve;
  });
}

export function finishConfirm(ok: boolean) {
  const resolve = pending;
  pending = null;
  confirmState.open = false;
  resolve?.(ok);
}
