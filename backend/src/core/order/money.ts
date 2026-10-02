/** Tính tiền thuần túy: không đụng DB, toàn bộ là số nguyên VND. */
export type TaxMode = 'inclusive' | 'exclusive';
export interface Discount { type: 'percent' | 'amount'; value: number }
export interface Totals { subtotalVnd: number; discountVnd: number; taxVnd: number; totalVnd: number }
export interface PaymentInput { method: 'cash' | 'transfer'; amountVnd: number }

export class MoneyError extends Error {}

function assertInt(n: number, label: string) {
  if (!Number.isInteger(n) || n < 0) throw new MoneyError(`${label} phải là số nguyên không âm`);
}

export function calcTotals(
  lines: { unitPriceVnd: number; qty: number }[],
  opts: { discount?: Discount | null; taxRatePercent: number; taxMode: TaxMode },
): Totals {
  let subtotalVnd = 0;
  for (const l of lines) {
    assertInt(l.unitPriceVnd, 'Đơn giá');
    assertInt(l.qty, 'Số lượng');
    subtotalVnd += l.unitPriceVnd * l.qty;
  }

  let discountVnd = 0;
  const d = opts.discount;
  if (d) {
    assertInt(d.value, 'Giá trị giảm giá');
    if (d.type === 'percent') {
      if (d.value > 100) throw new MoneyError('Giảm giá theo % không được quá 100');
      discountVnd = Math.round((subtotalVnd * d.value) / 100);
    } else {
      discountVnd = Math.min(d.value, subtotalVnd);
    }
  }

  const rate = opts.taxRatePercent;
  assertInt(rate, 'Thuế suất');
  const net = subtotalVnd - discountVnd;
  if (opts.taxMode === 'exclusive') {
    const taxVnd = Math.round((net * rate) / 100);
    return { subtotalVnd, discountVnd, taxVnd, totalVnd: net + taxVnd };
  }
  // giá đã gồm thuế: tách thuế ra khỏi tổng
  return { subtotalVnd, discountVnd, taxVnd: Math.round((net * rate) / (100 + rate)), totalVnd: net };
}

/**
 * Tiền đã thu của một phần dòng hàng: lấy phần tạm tính, chia giảm giá của đơn, rồi cộng thuế nếu thuế tính thêm.
 * Dùng khi hoàn tiền / đổi trả để không hoàn quá số khách đã trả.
 */
export function lineRefundVnd(
  order: { subtotalVnd: number; discountVnd: number; taxRatePercent: number; taxMode: TaxMode },
  line: { lineTotalVnd: number; qty: number },
  qty: number,
): number {
  assertInt(qty, 'Số lượng hoàn');
  assertInt(line.lineTotalVnd, 'Thành tiền dòng');
  assertInt(line.qty, 'Số lượng dòng');
  if (qty < 1) throw new MoneyError('Số lượng hoàn phải lớn hơn 0');
  if (qty > line.qty) throw new MoneyError('Số lượng hoàn vượt quá số đã bán');
  if (order.subtotalVnd === 0 || line.qty === 0) return 0;
  const gross = Math.round((line.lineTotalVnd * qty) / line.qty);
  const netBase = order.subtotalVnd - order.discountVnd;
  const afterDiscount = Math.round((gross * netBase) / order.subtotalVnd);
  if (order.taxMode === 'exclusive') return afterDiscount + Math.round((afterDiscount * order.taxRatePercent) / 100);
  return afterDiscount;
}

/** Kiểm tra tiền khách đưa và tính tiền thừa. Chỉ tiền mặt mới được thu dư (để trả lại). */
export function settlePayments(totalVnd: number, payments: PaymentInput[]): { changeVnd: number } {
  let sum = 0;
  let nonCash = 0;
  for (const p of payments) {
    assertInt(p.amountVnd, 'Số tiền thu');
    sum += p.amountVnd;
    if (p.method !== 'cash') nonCash += p.amountVnd;
  }
  if (sum < totalVnd) throw new MoneyError('Số tiền thu chưa đủ');
  if (nonCash > totalVnd) throw new MoneyError('Chuyển khoản không được vượt quá số tiền cần thu');
  return { changeVnd: sum - totalVnd };
}
