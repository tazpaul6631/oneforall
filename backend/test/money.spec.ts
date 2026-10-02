import { MoneyError, calcTotals, lineRefundVnd, settlePayments } from '../src/core/order/money';

const line = (unitPriceVnd: number, qty = 1) => ({ unitPriceVnd, qty });

describe('calcTotals', () => {
  it('không thuế, không giảm giá', () => {
    expect(calcTotals([line(29000, 2), line(35000)], { taxRatePercent: 0, taxMode: 'inclusive' })).toEqual({
      subtotalVnd: 93000, discountVnd: 0, taxVnd: 0, totalVnd: 93000,
    });
  });

  it('giảm giá % được làm tròn về đồng', () => {
    // 99.999 * 10% = 9999,9 → 10.000
    expect(calcTotals([line(99999)], { discount: { type: 'percent', value: 10 }, taxRatePercent: 0, taxMode: 'inclusive' }))
      .toMatchObject({ discountVnd: 10000, totalVnd: 89999 });
  });

  it('giảm giá số tiền không vượt quá tạm tính', () => {
    expect(calcTotals([line(50000)], { discount: { type: 'amount', value: 80000 }, taxRatePercent: 0, taxMode: 'inclusive' }))
      .toMatchObject({ discountVnd: 50000, totalVnd: 0 });
  });

  it('thuế chưa gồm trong giá (exclusive): cộng thêm sau giảm giá', () => {
    expect(calcTotals([line(100000)], { taxRatePercent: 8, taxMode: 'exclusive' }))
      .toMatchObject({ taxVnd: 8000, totalVnd: 108000 });
    expect(calcTotals([line(100000)], { discount: { type: 'percent', value: 10 }, taxRatePercent: 10, taxMode: 'exclusive' }))
      .toMatchObject({ discountVnd: 10000, taxVnd: 9000, totalVnd: 99000 });
  });

  it('thuế đã gồm trong giá (inclusive): tách thuế ra, tổng không đổi', () => {
    expect(calcTotals([line(108000)], { taxRatePercent: 8, taxMode: 'inclusive' }))
      .toMatchObject({ taxVnd: 8000, totalVnd: 108000 });
    // 50.000 * 8 / 108 = 3703,7 → 3.704
    expect(calcTotals([line(50000)], { taxRatePercent: 8, taxMode: 'inclusive' }))
      .toMatchObject({ taxVnd: 3704, totalVnd: 50000 });
  });

  it('từ chối số không hợp lệ', () => {
    expect(() => calcTotals([line(10.5)], { taxRatePercent: 0, taxMode: 'inclusive' })).toThrow(MoneyError);
    expect(() => calcTotals([line(1000, -1)], { taxRatePercent: 0, taxMode: 'inclusive' })).toThrow(MoneyError);
    expect(() => calcTotals([line(1000)], { discount: { type: 'percent', value: 101 }, taxRatePercent: 0, taxMode: 'inclusive' })).toThrow(MoneyError);
  });
});

describe('lineRefundVnd', () => {
  const order = { subtotalVnd: 70000, discountVnd: 7000, taxRatePercent: 8, taxMode: 'exclusive' as const };
  const line = { lineTotalVnd: 70000, qty: 2 };
  it('hoàn cả dòng sau giảm giá và thuế cộng thêm', () => {
    expect(lineRefundVnd(order, line, 2)).toBe(68040);
  });
  it('hoàn một phần thì chia đều', () => {
    expect(lineRefundVnd(order, line, 1)).toBe(34020);
  });
  it('thuế đã gồm trong giá thì không cộng thêm', () => {
    expect(lineRefundVnd(
      { subtotalVnd: 108000, discountVnd: 0, taxRatePercent: 8, taxMode: 'inclusive' },
      { lineTotalVnd: 108000, qty: 1 },
      1,
    )).toBe(108000);
  });
});

describe('settlePayments', () => {
  it('thu đủ bằng tiền mặt, trả lại tiền thừa', () => {
    expect(settlePayments(93000, [{ method: 'cash', amountVnd: 100000 }])).toEqual({ changeVnd: 7000 });
    expect(settlePayments(93000, [{ method: 'cash', amountVnd: 93000 }])).toEqual({ changeVnd: 0 });
  });
  it('chia nhiều phương thức', () => {
    expect(settlePayments(100000, [{ method: 'transfer', amountVnd: 60000 }, { method: 'cash', amountVnd: 50000 }])).toEqual({ changeVnd: 10000 });
  });
  it('thiếu tiền bị từ chối', () => {
    expect(() => settlePayments(100000, [{ method: 'cash', amountVnd: 99999 }])).toThrow('chưa đủ');
  });
  it('chuyển khoản không được vượt số cần thu', () => {
    expect(() => settlePayments(100000, [{ method: 'transfer', amountVnd: 120000 }])).toThrow('Chuyển khoản');
  });
  it('đơn 0 đồng không cần thu tiền', () => {
    expect(settlePayments(0, [])).toEqual({ changeVnd: 0 });
  });
});
