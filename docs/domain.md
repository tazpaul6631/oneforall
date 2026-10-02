# Quy ước miền nghiệp vụ

- Tiền: số nguyên VND (đơn vị đồng), không dùng float.
- Id: UUID. Thời gian: lưu UTC.
- Mọi bảng nghiệp vụ có cột `tenantId` và chỉ truy cập qua `TenantRepository`.
- Không xóa cứng dữ liệu tài chính: dùng void/refund và audit log.
- `core` không import `verticals`; `platform` không import `core`. Có test tự kiểm tra (`test/architecture.spec.ts`).
- Feature key đặt tên `<vertical>.<tính_năng>`, ví dụ `fnb.table_map`.
- Route frontend của vertical nằm ở `frontend/src/verticals/<vertical>/routes.ts`, chỉ tải khi tenant có feature cùng tiền tố.

## Giai đoạn 2: bán hàng

- Giá và tên sản phẩm luôn lấy từ DB khi tạo đơn; client chỉ gửi productId, variantId, qty. OrderLine chụp lại tên và giá tại lúc bán.
- Tính tiền nằm trong `core/order/money.ts` (hàm thuần, toàn số nguyên). Thứ tự: tạm tính → giảm giá → thuế → tổng. Làm tròn `Math.round` về đồng.
- Thuế cấu hình theo tenant (`taxRatePercent`, `taxMode`: inclusive/exclusive) và được chụp vào từng đơn.
- Trạng thái đơn: `open → paid` hoặc `open → void`. Đơn đã `paid` không hủy/xóa; hoàn tiền làm ở giai đoạn sau.
- Thanh toán dùng `idempotencyKey`: gửi lại cùng key trả kết quả cũ, không thu thêm; key khác trên đơn đã thu → 409. Chuyển trạng thái bằng UPDATE có điều kiện `status='open'`.
- Core phát sự kiện `order.created`, `order.paid`, `order.voided` (`{ tenantId, orderId }`) để vertical lắng nghe.
