# Landing Hub — Centralized Landing Page & Conversion Platform

Landing Hub là hệ thống trung tâm quản trị và tiếp nhận dữ liệu (Ingestion API & Admin Platform) cho toàn bộ landing page hiện tại và tương lai của các dự án (ABANO, Genki Fami, Balancera, Huma Medical, v.v.), bất kể landing page được thiết kế bằng Figma, Google Stitch, Antigravity hay code thuần.

---

## 1. Nguyên Tắc Kiến Trúc & Luồng Dữ Liệu

```
Landing Pages (Figma / Stitch / HTML / React)
     ↓
Landing Hub SDK (lphub.js)
     ↓ (HTTP REST POST with Origin & Idempotency Key)
Landing Hub Ingestion API (Express / Firebase Cloud Functions)
     ↓ (Firebase Admin SDK / Cloud Firestore)
Cloud Firestore (projects, landingPages, forms, leads, orders, customSubmissions, events, users)
     ↓
Landing Hub Admin UI (React + TypeScript + Tailwind CSS / Cloudflare Pages)
```

> **Nguyên tắc cốt lõi (Zero-Direct-Firestore-Write)**:
> Landing page bên ngoài **tuyệt đối không được ghi trực tiếp vào Firestore**. Toàn bộ tương tác, lead đăng ký, đơn đặt hàng và event conversion bắt buộc phải gửi qua tầng **Ingestion API** của Landing Hub để thực hiện validate hierarchy, origin whitelisting, sanitize dữ liệu, phòng chống spam/rate limit, bảo đảm idempotency và ghi trực tiếp vào Cloud Firestore qua Firebase Admin SDK.

---

## 2. Multi-Project Structure & Strict Hierarchy

Hệ thống hỗ trợ đa doanh nghiệp / dự án:
- **ABANO Wellness** (`code: ABANO`) — Mỹ phẩm & Dược mỹ phẩm hữu cơ.
- **Genki Fami** (`code: GENKI`) — Thực phẩm bảo vệ sức khoẻ tiêu chuẩn Nhật Bản.
- **Balancera** (`code: BALANCERA`) — Dinh dưỡng & Thể hình.
- **Huma Medical** (`code: HUMA`) — Thiết bị y tế gia đình.

### Chuỗi kiểm tra Hierarchy nghiêm ngặt:
Mọi ingestion request được xác thực tuần tự 7 bước trước khi xử lý:
$$\text{Project tồn tại \& active} \rightarrow \text{Landing Page tồn tại \& active} \rightarrow \text{LP thuộc Project} \rightarrow \text{Form tồn tại \& active} \rightarrow \text{Form thuộc Project} \rightarrow \text{Form thuộc LP} \rightarrow \text{Form type khớp endpoint}$$

- `/api/lead` $\rightarrow$ `form.type === 'lead'`
- `/api/order` $\rightarrow$ `form.type === 'order'`
- `/api/custom-form` $\rightarrow$ `form.type === 'custom'`

Nếu có bất kỳ sai lệch nào, server trả về `400 Bad Request` với mã lỗi tường minh (`PROJECT_NOT_FOUND`, `INVALID_LP_HIERARCHY`, `INVALID_FORM_TYPE`, v.v.).

---

## 3. Production Hardening Features

1. **Native Cloud Firestore Persistence**:
   - Toàn bộ dữ liệu lưu trữ tại Cloud Firestore: `projects`, `landingPages`, `forms`, `leads`, `orders`, `customSubmissions`, `events`, `users`.
   - Loại bỏ hoàn toàn local JSON storage khỏi production path.
   - Hàm seed ghi trực tiếp vào Firestore collections qua Admin SDK.

2. **Firebase Cloud Functions Ready**:
   - Thư mục `server/` chứa cấu hình độc lập (`package.json`, `tsconfig.json`) với entry point `lib/index.js`.
   - Export HTTPS function `api` sẵn sàng cho `firebase deploy --only functions,firestore:rules`.
   - Hỗ trợ chạy local độc lập thông qua `npm run server` (tsx).

3. **Origin Validation & CORS**:
   - Chặn CORS `origin: '*'` trong production.
   - Public Ingestion API kiểm tra `Origin` / `Referer` khớp với `project.allowedDomains` hoặc domain của `landingPage.url`.
   - Cho phép localhost trong môi trường development và automated test.

4. **Idempotency & Deduplication**:
   - SDK tự động tạo `idempotencyKey` (`submissionId`).
   - Double-click, network retry hoặc client retry với cùng key sẽ trả về bản ghi hiện có (`200 OK` với `idempotentReplay: true`), không tạo duplicate lead/order/event.

5. **Order Integrity (Unverified Revenue)**:
   - Lưu trữ rõ ràng `clientReportedSubtotal`, `clientReportedTotal` và `serverCalculatedSubtotal` (tính từ item quantity * price).
   - Đánh dấu `verifiedRevenue: false` cho đến khi server có module đối soát với Catalog trung tâm.

6. **Attribution Persistence**:
   - SDK lưu `firstTouch` và `lastTouch` vào `localStorage`.
   - Giữ nguyên thông tin chiến dịch (`utm_source`, `utm_campaign`, `referrer`) kể cả khi khách chuyển trang nội bộ làm mất query params.

7. **Standard Event Semantics**:
   - Chuẩn event V1: `page_view`, `cta_click`, `form_view`, `form_start`, `form_submit`, `order_created`, `purchase`.
   - `order_created` không tự động coi là `purchase`. Event `purchase` là sự kiện độc lập.

8. **Admin API Authentication & Role Scoping**:
   - Mọi Admin API yêu cầu `Authorization: Bearer <token>`.
   - Phân quyền 3 roles:
     - `super_admin`: toàn quyền quản trị.
     - `project_admin`: chỉ thao tác trên các `projectIds` được cấp phép.
     - `viewer`: chế độ chỉ đọc (`GET`).

---

## 4. Ingestion & Admin API Endpoints

Server API lắng nghe tại port `3001` (hoặc deploy dưới dạng Firebase Cloud Functions):

| Phương thức | Endpoint | Phân quyền | Mô tả |
|---|---|---|---|
| `POST` | `/api/track` | Public | Ghi nhận sự kiện chuyển đổi |
| `POST` | `/api/lead` | Public | Tiếp nhận Lead đăng ký tư vấn |
| `POST` | `/api/order` | Public | Tiếp nhận Đơn đặt hàng (Idempotent) |
| `POST` | `/api/custom-form` | Public | Tiếp nhận Form tùy biến linh hoạt |
| `GET` | `/api/health` | Public | Trạng thái hệ thống & Firestore provider |
| `GET` | `/api/projects` | Admin | Danh sách dự án |
| `POST` | `/api/projects` | Super Admin | Tạo mới dự án |
| `GET` | `/api/landing-pages` | Admin | Danh sách Landing Pages (hỗ trợ lọc `projectId`) |
| `POST` | `/api/landing-pages` | Admin | Đăng ký Landing Page mới |
| `GET` | `/api/forms` | Admin | Danh sách Form schemas |
| `POST` | `/api/forms` | Admin | Đăng ký Form schema |
| `GET` | `/api/leads` | Admin | Danh sách leads đã thu thập |
| `GET` | `/api/orders` | Admin | Danh sách đơn hàng |
| `PATCH`| `/api/orders/:id/status`| Admin | Cập nhật trạng thái đơn & thanh toán |
| `GET` | `/api/events` | Admin | Log sự kiện hành vi |
| `POST` | `/api/seed/reset` | Super Admin | Khôi phục bộ dữ liệu mẫu chuẩn |

---

## 5. Landing Hub SDK

Lightweight, zero-dependency browser SDK, tự động quản lý:
- `firstTouch` & `lastTouch` attribution (`utm_*`, `referrer`)
- `visitorId` ẩn danh (lưu trong `localStorage['_lphub_vid']`)
- `sessionId` (lưu trong `sessionStorage['_lphub_sid']`)
- `idempotencyKey` / `submissionId` ổn định theo logical submission
- In-flight promise deduplication chống double-click
- Giữ nguyên key khi retry lỗi
- Default fallback `apiUrl` về domain hiện tại nếu bị bỏ trống

### Cách nhúng vào Landing Page:
```html
<!-- 1. Nhúng thư viện -->
<script src="https://hub.yourdomain.com/sdk/lphub.js"></script>

<script>
  // 2. Khởi tạo SDK (apiUrl là tùy chọn, mặc định lấy origin hiện tại)
  LPHub.init({
    projectId: 'abano',
    landingPageId: 'abano-serum-promo'
  });

  // 3. Theo dõi CTA Click
  document.getElementById('btn-buy').addEventListener('click', function() {
    LPHub.track('cta_click', { buttonId: 'btn-buy' });
  });

  // 4. Gửi Lead tư vấn
  LPHub.submitLead({
    formId: 'abano-lead-form-01',
    name: 'Nguyễn Thị Mai',
    phone: '0912345678',
    email: 'mai@gmail.com',
    data: { skinType: 'Da nhạy cảm' }
  });

  // 5. Gửi Đơn đặt hàng (Atomic Idempotent)
  LPHub.submitOrder({
    formId: 'abano-order-form-01',
    customer: {
      name: 'Trần Văn Minh',
      phone: '0987654321',
      address: '123 Lê Lợi, Q1, TP.HCM'
    },
    items: [
      { name: 'Serum Phục Hồi Botanical 50ml', quantity: 2, price: 590000 }
    ],
    total: 1180000,
    currency: 'VND',
    paymentMethod: 'cod'
  });
</script>
```

---

## 6. Chạy Thử & Kiểm Thử

### Khởi động hệ thống tại local:
```bash
# Terminal 1: Chạy Ingestion API Server (port 3001)
npm run server

# Terminal 2: Chạy Frontend Admin (port 5173)
npm run dev

# Hoặc chạy cả 2 cùng lúc:
npm run dev:all
```

### Chạy bộ Automated Tests (23 test cases):
```bash
npm test
```
Kiểm chứng tự động toàn bộ 23 kịch bản:
- `valid lead`, `valid order`, `valid custom form`
- `unknown project`, `wrong landingPage/project relationship`
- `unknown form`, `wrong form type`, `inactive form`
- `wrong origin`
- `duplicate order submission (idempotency)`
- `unauthorized admin API`, `project_admin accessing another project`
- `viewer role restriction`
- `health check`
- `auth hardening: test token in test env`, `rejection in production mode`, `fail-closed when flag missing`, `valid Firebase ID token verification`
- `atomic idempotency concurrency (Promise.all race condition)`
- `SDK double-submit in-flight deduplication`, `retry key reuse on failure`, `session reset on success`, `explicit createSubmission session`

---

## 7. Landing Hub Integration Contract
 
Tài liệu đặc tả hợp đồng tích hợp chuẩn cho landing page:
 
- **Đặc tả hợp đồng**: [docs/INTEGRATION-CONTRACT-DRAFT.md](docs/INTEGRATION-CONTRACT-DRAFT.md) (`Draft 0.9 — Not Frozen`)
- **Tài liệu API chi tiết**: [docs/API-REFERENCE.md](docs/API-REFERENCE.md) (`Draft 0.9 Technical Reference`)

---

## 8. Deploy Production

### Backend Ingestion API & Security Rules:
```bash
# Build Cloud Functions bundle
npm --prefix server run build

# Deploy Cloud Functions & Firestore Rules
firebase deploy --only functions,firestore:rules
```

### Frontend Admin (Cloudflare Pages):
```bash
npm run build
npx wrangler pages deploy dist --project-name=landing-hub
```
