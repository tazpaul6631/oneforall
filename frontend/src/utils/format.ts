const nf = new Intl.NumberFormat('vi-VN');
export const vnd = (n: number) => `${nf.format(n)} ₫`;
export const orderCode = (seq: number) => `#${String(seq).padStart(4, '0')}`;
export const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN') : '');
/** Khóa chống thanh toán trùng; randomUUID chỉ có trên HTTPS/localhost nên có phương án dự phòng. */
export const newKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const statusLabel = { open: 'Chưa thanh toán', paid: 'Đã thanh toán', void: 'Đã hủy' } as const;
export const statusSeverity = { open: 'warn', paid: 'success', void: 'secondary' } as const;
