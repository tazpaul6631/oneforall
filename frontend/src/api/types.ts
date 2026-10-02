export interface Category { id: string; name: string }
export interface Variant { id: string; name: string; priceVnd: number; sku: string | null }
export interface Product { id: string; name: string; sku: string | null; priceVnd: number; categoryId: string | null; active: boolean; variants: Variant[] }
export interface Customer { id: string; name: string; phone: string | null; email: string | null; note: string | null }

export type OrderStatus = 'open' | 'paid' | 'void';
export interface OrderLine { id: string; name: string; unitPriceVnd: number; qty: number; refundedQty: number; lineTotalVnd: number }
export interface PaymentRow { id: string; method: 'cash' | 'transfer'; amountVnd: number }
export interface RefundRow { id: string; amountVnd: number; reason: string | null; createdAt: string; lines: { id: string; orderLineId: string; qty: number; amountVnd: number }[] }
export interface Order {
  id: string; seq: number; status: OrderStatus;
  subtotalVnd: number; discountVnd: number; taxVnd: number; totalVnd: number; changeVnd: number; refundedVnd: number;
  taxRatePercent: number; taxMode: 'inclusive' | 'exclusive';
  note: string | null; customerName?: string | null; createdAt: string; paidAt: string | null;
}
export interface OrderDetail extends Order {
  lines: OrderLine[];
  payments: PaymentRow[];
  refunds: RefundRow[];
  customer: { id: string; name: string; phone: string | null } | null;
}
export interface Preview { subtotalVnd: number; discountVnd: number; taxVnd: number; totalVnd: number; lines: { name: string; unitPriceVnd: number; qty: number; lineTotalVnd: number }[] }
export interface SalesSummary { todayRevenueVnd: number; todayPaidCount: number; openCount: number; paidCount: number }
