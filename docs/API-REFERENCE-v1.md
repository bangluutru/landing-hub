# Landing Hub API Reference

> **API Reference Version**: 1.0  
> **Status**: Frozen  
> **Companion Document**: [Landing Hub Integration Contract v1.0](INTEGRATION-CONTRACT-v1.md)

This document provides the exhaustive technical reference for all public ingestion endpoints, administrative APIs, data schemas, security guardrails, and error responses implemented in Landing Hub.

---

## 1. Network & Security Architecture

### 1.1. Base URL
- **Local Development**: `http://localhost:3001`
- **Production (Firebase Cloud Functions)**: `https://<region>-<project-id>.cloudfunctions.net/api`
- **Production Custom Domain**: `https://hub.yourdomain.com/api`

### 1.2. Public Ingestion Security (CORS & Origin Whitelisting)
All ingestion requests (`/api/track`, `/api/lead`, `/api/order`, `/api/custom-form`) enforce origin validation:
- The request `Origin` or `Referer` header is matched against:
  1. The registered `landingPage.url` hostname.
  2. The registered domain list `project.allowedDomains`.
  3. `localhost` / `127.0.0.1` (permitted only in non-production environments).
- If the origin does not match, the request is rejected immediately:
  ```json
  HTTP/1.1 403 Forbidden
  {
    "success": false,
    "error": {
      "code": "ORIGIN_NOT_ALLOWED",
      "message": "Origin 'https://unauthorized-domain.com' is not authorized for project 'abano' / landing page 'abano-serum-promo'."
    }
  }
  ```

### 1.3. Rate Limiting
- Public endpoints enforce a limit of **120 requests per minute** per client IP.
- Exceeding the threshold returns `429 Too Many Requests` with code `RATE_LIMIT_EXCEEDED`.

### 1.4. Admin Authentication & Role-Based Access Control (RBAC)
Admin endpoints (`/api/projects`, `/api/landing-pages`, `/api/forms`, `/api/leads`, `/api/orders`, `/api/events`, `/api/seed/reset`) require:
```http
Authorization: Bearer <Firebase_ID_Token>
```

#### Production Fail-Closed Policy:
- In production (`NODE_ENV=production`), ONLY genuine Firebase ID tokens verified via the Firebase Admin SDK (`adminAuth.verifyIdToken`) are accepted.
- Any token starting with `demo-*` or `test-*` is strictly rejected with `401 Unauthorized` (`UNAUTHORIZED`).
- In non-production environments (local/test), test tokens (e.g. `Bearer test-super_admin`) are permitted **only** if the explicit environment flag `ALLOW_TEST_TOKENS=true` is set. Missing or false flags cause the server to fail closed with HTTP 401.

#### Role Scoping Matrix:
| Role | Read Scope | Write Scope | Restrictions |
|---|---|---|---|
| `super_admin` | All projects & entities | All projects & entities | Unrestricted administrative access. |
| `project_admin` | Only assigned `projectIds` | Only assigned `projectIds` | Cannot create projects; cannot access or mutate resources outside assigned projects. |
| `viewer` | Read-only | None | Mutation operations (`POST`, `PATCH`, `PUT`, `DELETE`) return HTTP 403 `INSUFFICIENT_ROLE`. |

---

## 2. Public Ingestion API

---

### 2.1. `POST /api/track`
Tracks visitor behavioral and funnel conversion events. Injects multi-touch attribution context automatically.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Content-Type` | string | Yes | `application/json` |
| `Origin` / `Referer` | string | Yes | Must match registered project or landing page domain |

#### Request Payload
```json
{
  "eventName": "cta_click",
  "projectId": "abano",
  "landingPageId": "abano-serum-promo",
  "formId": "abano-order-form-01",
  "sessionId": "s_k9s8d7f6g5h4",
  "visitorId": "v_1a2b3c4d5e6f",
  "metadata": {
    "buttonId": "btn_buy_hero",
    "section": "hero_banner"
  },
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "summer_sale_2026",
  "utmContent": "video_ad_1",
  "utmTerm": "skincare_serum",
  "referrer": "https://m.facebook.com/",
  "pageUrl": "https://promo.abano.vn/serum?utm_source=facebook&utm_campaign=summer_sale_2026",
  "firstTouch": {
    "utmSource": "facebook",
    "utmCampaign": "summer_sale_2026",
    "timestamp": "2026-09-01T08:30:00Z"
  },
  "lastTouch": {
    "utmSource": "facebook",
    "utmCampaign": "summer_sale_2026",
    "timestamp": "2026-09-06T10:15:00Z"
  }
}
```

#### Field Specifications
| Field | Type | Required | Description |
|---|---|---|---|
| `eventName` | string | Yes | Event name (e.g. `page_view`, `cta_click`, `form_view`, `form_start`) |
| `projectId` | string | Yes | Registered project identifier |
| `landingPageId` | string | Yes | Registered landing page identifier |
| `formId` | string | No | Associated form identifier if tracking form engagement |
| `visitorId` | string | No | Anonymous persistent visitor ID |
| `sessionId` | string | No | Browser session ID |
| `metadata` | object | No | Key-value object for custom parameters |
| `utm*` | string | No | Campaign attribution tags |
| `referrer` | string | No | HTTP Referrer string |
| `pageUrl` | string | No | Current browser URL |
| `firstTouch` | object | No | First touch attribution object |
| `lastTouch` | object | No | Last touch attribution object |

#### Responses
- **200 OK**:
  ```json
  {
    "success": true,
    "id": "evt-m9x8k7j6-a1b2c",
    "message": "Event 'cta_click' tracked successfully."
  }
  ```
- **400 Bad Request**: Invalid project or landing page hierarchy.
- **403 Forbidden**: Origin not authorized.

---

### 2.2. `POST /api/lead`
Captures consultation requests, sample registrations, and lead forms. Automatically logs a `form_submit` event on initial submission.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Content-Type` | string | Yes | `application/json` |
| `X-Idempotency-Key` | string | No | Optional HTTP header alternative to payload key |

#### Request Payload
```json
{
  "projectId": "abano",
  "landingPageId": "abano-freesample",
  "formId": "abano-lead-form-01",
  "idempotencyKey": "ik_lead_m9x8k7_1a2b3c",
  "submissionId": "ik_lead_m9x8k7_1a2b3c",
  "name": "Nguyễn Thị Mai",
  "phone": "0912345678",
  "email": "mai@gmail.com",
  "data": {
    "skinType": "Da nhạy cảm",
    "preferredTime": "14:00 - 17:00"
  },
  "utmSource": "google",
  "utmMedium": "search",
  "utmCampaign": "brand_search"
}
```

#### Field Specifications
| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | Yes | Registered project identifier |
| `landingPageId` | string | Yes | Registered landing page identifier |
| `formId` | string | Yes | Registered form identifier (MUST have `type: 'lead'`) |
| `idempotencyKey` | string | Yes (SDK) | Stable idempotency key for this logical submission |
| `name` | string | No | Lead full name |
| `phone` | string | No | Lead phone number |
| `email` | string | No | Lead email address |
| `data` | object | No | Arbitrary custom form fields |

#### Responses
- **201 Created** (Initial Submission):
  ```json
  {
    "success": true,
    "id": "lead-m9x8k7j6-3d4e5",
    "message": "Lead captured successfully."
  }
  ```
- **200 OK** (Idempotent Replay):
  ```json
  {
    "success": true,
    "id": "lead-m9x8k7j6-3d4e5",
    "message": "Lead already captured (idempotent replay).",
    "data": {
      "leadId": "lead-m9x8k7j6-3d4e5",
      "idempotentReplay": true
    }
  }
  ```
  *Note: Idempotent replay does NOT emit a duplicate `form_submit` event.*

---

### 2.3. `POST /api/order`
Captures direct purchase orders, pre-orders, and COD submissions. Automatically logs an `order_created` event on initial submission.

#### Request Headers
| Header | Type | Required | Description |
|---|---|---|---|
| `Content-Type` | string | Yes | `application/json` |
| `X-Idempotency-Key` | string | No | Optional HTTP header alternative to payload key |

#### Request Payload
```json
{
  "projectId": "abano",
  "landingPageId": "abano-serum-promo",
  "formId": "abano-order-form-01",
  "idempotencyKey": "ik_ord_m9x8k7_4e5f6g",
  "submissionId": "ik_ord_m9x8k7_4e5f6g",
  "customer": {
    "name": "Trần Văn Minh",
    "phone": "0987654321",
    "email": "minh@gmail.com",
    "address": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
    "note": "Giao giờ hành chính"
  },
  "items": [
    {
      "id": "prod-serum-50",
      "name": "Serum Phục Hồi Botanical 50ml",
      "quantity": 2,
      "price": 590000,
      "variant": "50ml"
    }
  ],
  "subtotal": 1180000,
  "total": 1180000,
  "currency": "VND",
  "paymentMethod": "cod",
  "data": {
    "promoCode": "WELCOME10"
  }
}
```

#### Field Specifications
| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | Yes | Registered project identifier |
| `landingPageId` | string | Yes | Registered landing page identifier |
| `formId` | string | Yes | Registered form identifier (MUST have `type: 'order'`) |
| `idempotencyKey` | string | Yes (SDK) | Stable idempotency key for this logical submission |
| `customer` | object | Yes | Customer contact and delivery object |
| `customer.name` | string | Yes | Recipient full name |
| `customer.phone`| string | Yes | Recipient contact phone number |
| `customer.address`| string | No | Delivery address (required for physical goods) |
| `items` | array | Yes | Non-empty array of purchased line items |
| `items[].name` | string | Yes | Item title |
| `items[].quantity`| number | Yes | Quantity (integer $\ge 1$) |
| `items[].price` | number | Yes | Unit price |
| `total` | number | Yes | Client-reported total amount |
| `currency` | string | No | Currency code (default: `VND`) |
| `paymentMethod` | string | No | Payment type (default: `cod`) |

#### Order Integrity Processing:
The server computes:
$$\text{serverCalculatedSubtotal} = \sum (\text{item.quantity} \times \text{item.price})$$
The stored record contains:
- `clientReportedSubtotal`, `clientReportedTotal`
- `serverCalculatedSubtotal`, `serverCalculatedTotal`
- `verifiedRevenue: false` (flagged unverified until reconciled with catalog)

#### Responses
- **201 Created** (Initial Submission):
  ```json
  {
    "success": true,
    "id": "ORD-20260906-8921",
    "message": "Order created successfully.",
    "data": {
      "orderId": "ORD-20260906-8921",
      "total": 1180000,
      "currency": "VND",
      "verifiedRevenue": false
    }
  }
  ```
- **200 OK** (Idempotent Replay):
  ```json
  {
    "success": true,
    "id": "ORD-20260906-8921",
    "message": "Order already created (idempotent replay).",
    "data": {
      "orderId": "ORD-20260906-8921",
      "total": 1180000,
      "currency": "VND",
      "idempotentReplay": true
    }
  }
  ```
  *Note: Idempotent replay does NOT emit a duplicate `order_created` event.*

---

### 2.4. `POST /api/custom-form`
Captures flexible key-value data from quizzes, surveys, and multi-step calculators.

#### Request Payload
```json
{
  "projectId": "genki-fami",
  "landingPageId": "genki-health-check",
  "formId": "genki-custom-form-01",
  "idempotencyKey": "ik_csub_m9x8k7_7g8h9i",
  "submissionId": "ik_csub_m9x8k7_7g8h9i",
  "data": {
    "quizScore": 85,
    "healthGoals": ["joint_care", "longevity"],
    "recommendedPlan": "marine_collagen_pro"
  }
}
```

#### Responses
- **201 Created**:
  ```json
  {
    "success": true,
    "id": "csub-m9x8k7j6-9a0b1",
    "message": "Custom form submission recorded."
  }
  ```
- **200 OK** (Idempotent Replay):
  ```json
  {
    "success": true,
    "id": "csub-m9x8k7j6-9a0b1",
    "message": "Custom submission already recorded (idempotent replay).",
    "data": {
      "submissionId": "csub-m9x8k7j6-9a0b1",
      "idempotentReplay": true
    }
  }
  ```

---

### 2.5. `GET /api/health`
Public health probe returning service health and active persistence engine.

#### Response (200 OK)
```json
{
  "status": "ok",
  "service": "landing-hub-ingestion-api",
  "persistence": "Cloud Firestore",
  "timestamp": "2026-09-06T11:25:30.000Z"
}
```

---

## 3. Backend Atomic Idempotency Mechanics

To eliminate race conditions when duplicate requests arrive concurrently, the backend implements atomic reservation transactions:

1. **Reservation Document Key**:
   $$\text{Reservation ID} = \text{"res\_"} + \text{SHA-256}(\text{projectId.toLowerCase()} : \text{entityType} : \text{idempotencyKey})$$
2. **Transaction Isolation**:
   Within a Cloud Firestore transaction (`db.runTransaction`):
   - **Step 1 (Read)**: Reads `idempotency/{resId}`. If it exists with `status: 'completed'`, reads the existing entity from `orders`, `leads`, or `customSubmissions` and immediately returns `{ isReplay: true, entity }`.
   - **Step 2 (Write)**: If the reservation does not exist, the transaction atomically writes the new entity record and creates the reservation document.
3. **Funnel Protection**:
   Funnel events (`order_created`, `form_submit`) are dispatched **only** when `isReplay === false`.

---

## 4. Administrative API

All admin endpoints require `Authorization: Bearer <Firebase_ID_Token>`.

### 4.1. Projects Management
- `GET /api/projects`: List projects. Project Admins only see assigned `projectIds`.
- `POST /api/projects`: Register a new project (Super Admin only).
  ```json
  // Request
  { "name": "Balancera Pro", "code": "BALANCERA", "allowedDomains": ["balancera.vn"] }
  ```

### 4.2. Landing Pages Management
- `GET /api/landing-pages?projectId=<id>`: List landing pages filtered by project.
- `POST /api/landing-pages`: Register new landing page.
  ```json
  // Request
  {
    "projectId": "abano",
    "title": "Serum Flash Sale",
    "url": "https://promo.abano.vn/serum",
    "description": "Black Friday Serum promotion"
  }
  ```

### 4.3. Form Definitions Management
- `GET /api/forms?projectId=<id>&landingPageId=<id>`: List form definitions.
- `POST /api/forms`: Register form schema.
  ```json
  // Request
  {
    "projectId": "abano",
    "landingPageId": "abano-serum-promo",
    "name": "Order Form",
    "type": "order",
    "fields": [
      { "key": "name", "label": "Họ và tên", "type": "text", "required": true },
      { "key": "phone", "label": "Số điện thoại", "type": "phone", "required": true }
    ]
  }
  ```

### 4.4. Lead & Order Data
- `GET /api/leads?projectId=<id>`: Query captured leads.
- `GET /api/orders?projectId=<id>`: Query captured orders.
- `PATCH /api/orders/:id/status`: Update order or payment status.
  ```json
  // Request
  { "orderStatus": "confirmed", "paymentStatus": "paid" }
  ```

### 4.5. Event Log & Seed Reset
- `GET /api/events?projectId=<id>&limit=100`: Query behavioral events.
- `POST /api/seed/reset`: Re-initialize standard demo seed data in Firestore (Super Admin only).

---

## 5. Error Code Dictionary

| Error Code | HTTP Status | Root Cause |
|---|:---:|---|
| `MISSING_REQUIRED_FIELDS` | 400 | Mandatory fields (`projectId`, `landingPageId`, `formId`, etc.) omitted |
| `PROJECT_NOT_FOUND` | 400 | `projectId` does not exist in the database |
| `PROJECT_INACTIVE` | 400 | Target project has `status: 'inactive'` |
| `LP_NOT_FOUND` | 400 | `landingPageId` does not exist |
| `LP_INACTIVE` | 400 | Target landing page has `status: 'inactive'` |
| `INVALID_LP_HIERARCHY` | 400 | Landing page belongs to another project |
| `FORM_NOT_FOUND` | 400 | `formId` does not exist |
| `FORM_INACTIVE` | 400 | Target form schema has `status: 'inactive'` |
| `INVALID_FORM_HIERARCHY`| 400 | Form schema belongs to a different project or landing page |
| `INVALID_FORM_TYPE` | 400 | Form type mismatch (`lead` vs `order` vs `custom`) |
| `EMPTY_ITEMS` | 400 | Order submission `items` array is empty |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired authorization token, or test token used in production |
| `ORIGIN_NOT_ALLOWED` | 403 | Request Origin / Referer not in project allowed domains list |
| `INSUFFICIENT_ROLE` | 403 | Role lacks permissions (e.g. Viewer attempting mutation) |
| `FORBIDDEN_PROJECT_SCOPE`| 403 | Project Admin attempting out-of-scope query or mutation |
| `RATE_LIMIT_EXCEEDED` | 429 | Client IP exceeded 120 requests/minute |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server exception |
