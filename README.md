# Landing Hub — AIWF Centralized Landing Page & Conversion Platform

Landing Hub là hệ thống trung tâm quản trị và tiếp nhận dữ liệu (Ingestion API & Admin Platform) cho toàn bộ landing page hiện tại và tương lai của các dự án thuộc AI Workforce (ABANO, Genki Fami, Balancera, Huma Medical, v.v.), bất kể landing page được thiết kế bằng Figma, Google Stitch, Antigravity hay code thuần.

---

## 1. Nguyên Tắc Kiến Trúc & Luồng Dữ Liệu

```
Landing Pages (Figma / Stitch / HTML / React)
     ↓
AIWF LP SDK (@aiwf/lp-sdk / lphub.js)
     ↓ (HTTP REST POST)
Landing Hub Ingestion API (Express / Firebase Cloud Functions)
     ↓ (Firebase Admin SDK / Firestore Server)
Cloud Firestore (projects, landingPages, forms, leads, orders, events)
     ↓
Landing Hub Admin UI (React + TypeScript + Tailwind CSS / Cloudflare Pages)
```

> **Nguyên tắc cốt lõi (Zero-Direct-Firestore-Write)**:
> Landing page bên ngoài **tuyệt đối không được ghi trực tiếp vào Firestore**. Toàn bộ lượt tương tác, lead đăng ký, đơn đặt hàng và event conversion bắt buộc phải gửi qua tầng **Ingestion API** của Landing Hub để thực hiện validate schema, sanitize dữ liệu, phòng chống spam/rate limit và gắn server timestamp trước khi lưu trữ.

---

## 2. Multi-Project Structure

Hệ thống được thiết kế hỗ trợ đa doanh nghiệp / dự án ngay từ đầu:
- **ABANO Wellness** (`code: ABANO`) — Mỹ phẩm & Dược mỹ phẩm hữu cơ.
- **Genki Fami** (`code: GENKI`) — Thực phẩm bảo vệ sức khoẻ tiêu chuẩn Nhật Bản.
- **Balancera** (`code: BALANCERA`) — Dinh dưỡng & Thể hình.
- **Huma Medical** (`code: HUMA`) — Thiết bị y tế gia đình.

Mỗi Landing Page luôn gắn liền với `projectId` và `landingPageId`.
Mỗi Form có `formId` và `formType` (`lead` | `order` | `custom`).

---

## 3. Ingestion API Endpoints

Server API lắng nghe tại port `3001` (hoặc deploy dưới dạng Firebase Cloud Functions / Cloudflare Worker container):

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/track` | Ghi nhận sự kiện chuyển đổi (`page_view`, `cta_click`, `form_start`, `form_submit`, `order_created`, `purchase`, v.v.) |
| `POST` | `/api/lead` | Tiếp nhận Lead đăng ký tư vấn (họ tên, SĐT, email, dữ liệu khảo sát `data`) |
| `POST` | `/api/order` | Tiếp nhận Đơn đặt hàng (khách hàng, danh sách sản phẩm, tổng tiền, COD/Chuyển khoản) |
| `POST` | `/api/custom-form` | Tiếp nhận Form tùy biến linh hoạt |
| `GET` | `/api/health` | Kiểm tra trạng thái hoạt động của dịch vụ |
| `GET` | `/api/leads` | Danh sách leads đã thu thập |
| `GET` | `/api/orders` | Danh sách đơn hàng |
| `PATCH` | `/api/orders/:id/status` | Cập nhật trạng thái đơn và trạng thái thanh toán |
| `POST` | `/api/seed/reset` | Khôi phục bộ dữ liệu mẫu chuẩn (ABANO, Genki Fami) |

### Chuẩn phản hồi (Standard Response)
- Thành công:
```json
{
  "success": true,
  "id": "ORD-20260906-8714",
  "message": "Order created successfully."
}
```
- Lỗi:
```json
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_FIELDS",
    "message": "projectId, landingPageId, and formId are required."
  }
}
```

---

## 4. AIWF LP SDK

SDK độc lập, siêu nhẹ (< 5KB), không phụ thuộc framework, tự động trích xuất:
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `referrer`
- `visitorId` ẩn danh (lưu vĩnh viễn trong `localStorage`)
- `sessionId` (lưu theo phiên duyệt web trong `sessionStorage`)

### Cách nhúng vào Landing Page:
```html
<!-- 1. Nhúng thư viện -->
<script src="https://hub.yourdomain.com/sdk/lphub.js"></script>

<script>
  // 2. Khởi tạo SDK
  LPHub.init({
    projectId: 'abano',
    landingPageId: 'abano-serum-promo',
    apiUrl: 'https://hub.yourdomain.com'
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

  // 5. Gửi Đơn đặt hàng
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

## 5. Phân Quyền & Quản Trị

Hệ thống hỗ trợ 3 nhóm vai trò:
1. **Super Admin**: Quản trị toàn hệ thống, xem và thao tác trên mọi project.
2. **Project Admin**: Chỉ có quyền xem và thao tác trên project được phân quyền (ví dụ quản lý riêng ABANO).
3. **Viewer**: Chế độ chỉ xem (Read-only), không chỉnh sửa schema hoặc đổi trạng thái đơn hàng.

*Admin UI tích hợp sẵn thanh chuyển đổi vai trò (Role Switcher) ở góc trái dưới cùng để kiểm thử nhanh chóng.*

---

## 6. Chạy Thử & Kiểm Thử Tại Local

### Bước 1: Khởi động hệ thống
```bash
# Terminal 1: Chạy Ingestion API Server (port 3001)
npm run server

# Terminal 2: Chạy Frontend Admin (port 5173)
npm run dev

# Hoặc chạy cả 2 cùng lúc:
npm run dev:all
```

### Bước 2: Trải nghiệm Demo Landing Page thực tế
Mở trình duyệt truy cập:
👉 `http://localhost:5173/demo/index.html?utm_source=facebook&utm_campaign=spring_promo`

- Bấm nút "Mua ngay" hoặc "Nhận tư vấn" → theo dõi live log sự kiện `cta_click`.
- Điền form Tư Vấn → gửi `submitLead` → lead được lưu ngay lập tức vào database.
- Điền form Đặt Hàng → gửi `submitOrder` → đơn hàng được tạo với mã chuẩn `ORD-YYYYMMDD-XXXX`.
- Mở Admin Dashboard tại `http://localhost:5173/` để thấy lead, order và biểu đồ Funnel Analytics cập nhật trực tiếp!

---

## 7. Hướng Dẫn Deploy Production

### Frontend Admin (Cloudflare Pages):
```bash
# Build production bundle
npm run build

# Deploy qua Cloudflare Pages CLI
npx wrangler pages deploy dist --project-name=landing-hub
```
Cấu hình biến môi trường trên Cloudflare Pages dashboard:
- `VITE_FIREBASE_API_KEY`: API Key Firebase của dự án.
- `VITE_FIREBASE_PROJECT_ID`: ID dự án Firebase.

### Backend Ingestion API (Firebase Functions):
```bash
# Deploy Firebase Cloud Functions & Firestore Rules
firebase deploy --only functions,firestore:rules
```
Cấu hình rule trong `firestore.rules` đảm bảo bảo mật tuyệt đối, chặn landing page client ghi trực tiếp.
