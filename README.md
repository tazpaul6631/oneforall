# OneStore

Một codebase, nhiều mô hình kinh doanh: quán cà phê, nhà hàng, cửa hàng bán lẻ và rạp chiếu phim.
NestJS + SQLite (backend) và Vue 3 + Vite + PrimeVue (frontend).

Mỗi cửa hàng là một tenant. Hai quán dùng chung app không thấy hàng, đơn, khách hay kho của nhau.
Gói quyết định menu: cà phê có công thức, nhà hàng có bàn và bếp, shop có mã vạch và đổi trả, rạp có suất chiếu và sơ đồ ghế.

## Chạy thử

```bash
# Terminal 1: backend (cổng 3000)
cd backend
npm install
copy .env.example .env
npm run seed
npm run start:dev

# Terminal 2: frontend (cổng 5173)
cd frontend
npm install
npm run dev
```

Trên macOS hoặc Linux, đổi `copy` thành `cp`. Mở http://localhost:5173.

Tài khoản mẫu sau `npm run seed`, mật khẩu chung `Demo@12345`:

- `cafe@demo.vn` — quán cà phê
- `nhahang@demo.vn` — nhà hàng
- `shop@demo.vn` — cửa hàng bán lẻ
- `rap@demo.vn` — rạp chiếu phim

Cửa hàng đăng ký mới ở trạng thái chờ và chưa đăng nhập được. Tài khoản vận hành trong `backend/.env` (`OPERATOR_EMAIL`, `OPERATOR_PASSWORD`, mặc định `ops@local.test` / `Operator@12345`) vào `/ops` để kích hoạt, gia hạn, khóa hoặc đặt lại mật khẩu chủ quán. Seed đánh dấu bốn quán mẫu là đang dùng.

Không chạy `npm run seed` trên máy khách hàng.

## App Android và API local

Trên trình duyệt, để trống `VITE_API_URL` trong `frontend/.env`. Vite chuyển `/api` sang `http://localhost:3000`.

APK không dùng được `localhost`, vì đó là chính điện thoại. Sao chép `frontend/.env.example` thành `frontend/.env` rồi điền:

- Cài bằng Android Studio qua cáp USB: `VITE_API_URL=http://127.0.0.1:3000`. Lúc bấm Run, Gradle chạy `adb reverse` để cổng 3000 trên máy tính hiện ra ở tablet.
- Máy ảo Android trên cùng máy tính: `VITE_API_URL=http://10.0.2.2:3000`
- Điện thoại thật, cùng Wi-Fi: `VITE_API_URL=http://<IP máy tính>:3000` (IPv4 trong `ipconfig`)

Giá trị này gắn lúc build. Sửa xong chạy lại trong `frontend`:

```bash
npm run apk
```

File cài: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Lệnh này cần JDK 21; script tự chọn bản trong `C:\Program Files\Java` nếu Java trên PATH là bản cũ hơn.

Backend local phải đang chạy `npm run start:dev`, `NODE_ENV=development`, và `CORS_ORIGIN` để trống. Windows cần mở cổng 3000 trên firewall thì điện thoại mới vào được.

App Android mở bằng `https://localhost`, nên được phép gọi HTTP tới backend local. Vite chỉ đọc `frontend/.env` lúc build, không đọc `.env.example`.

## Migration

Schema chỉ đổi qua migration. Sau khi sửa entity:

```bash
cd backend
npm run migration:generate src/migrations/TenThayDoi
```

Rồi thêm class vừa sinh vào mảng trong `src/migrations/index.ts`. API tự chạy migration khi khởi động.

## Kiểm tra

```bash
cd backend
npm test
cd frontend
npm run build
```

`npm test` gồm tính tiền, đơn hàng, cô lập tenant, nhà hàng, bán lẻ, rạp, cho thuê và kiến trúc. `npm run build` ở frontend là typecheck rồi build.

## Lên máy khách

Một VPS, Nginx phục vụ web và chuyển `/api` sang một tiến trình Node, file SQLite nằm trên đĩa. Cấu hình nằm trong `deploy/`: `nginx.conf`, `onestore.service`, `bootstrap-vps.sh`. Backup hằng đêm dùng `npm run backup` trong backend.

## Kiến trúc

```
platform  <-  core  <-  verticals
```

Mũi tên là chiều được phép import.

- `platform`: tenant, trạng thái gói, feature, manifest, bootstrap API.
- `core`: đăng nhập, nhân viên, sản phẩm, đơn hàng, thanh toán, hoàn tiền, khách hàng, tồn kho, audit.
- `verticals/fnb`, `verticals/retail`, `verticals/cinema`: mỗi mô hình tự khai báo bằng `*.manifest.ts`.

Thêm một vertical: tạo `backend/src/verticals/<tên>` (manifest + module) và `frontend/src/verticals/<tên>/routes.ts`, rồi import module vào `app.module.ts`. Frontend chỉ nạp route khi tenant có feature của vertical đó.