# AIWF Landing Hub Integration Contract (Draft Specification)

> **Contract Status**: `Draft 0.9 — Not Frozen`  
> **Target Release**: AIWF Landing Hub Integration Contract v1.0  
> **Technical Reference**: [Landing Hub API Reference (Draft 0.9)](API-REFERENCE.md)  
>
> **Notice**: This document specifies the canonical schemas, hierarchy invariants, atomic idempotency protocols, and API contracts implemented in Landing Hub. This specification is currently in **Draft 0.9 (Pre-freeze) status and has NOT yet been frozen into Contract v1.0**.

---

## 1. Core Architectural Invariants

1. **Zero-Direct-Firestore-Write**:
   Public landing pages and external clients **must never** write directly to Cloud Firestore. All mutations and events flow through the Landing Hub Ingestion API (via Firebase Cloud Functions / Firebase Admin SDK).
2. **Strict Hierarchy Enforcement**:
   Every submission requires an unbroken chain of ownership:
   $$\text{Active Project} \rightarrow \text{Active Landing Page} \rightarrow \text{Active Form (matching endpoint type)}$$
   Any mismatch or inactive state results in a `400 Bad Request` with a typed error code.
3. **Origin Whitelisting**:
   Public endpoints validate the `Origin` or `Referer` against registered project domains (`project.allowedDomains`) or the landing page URL (`landingPage.url`). Untrusted origins receive a `403 Forbidden`. Localhost is permitted in non-production environments.
4. **Atomic Backend Idempotency & Deduplication**:
   Submissions support an `idempotencyKey` / `submissionId`. The backend enforces concurrency-safe atomicity via Cloud Firestore transactions and deterministic reservation documents (`idempotency/res_<sha256>`), composite-keyed by `projectId + entityType + idempotencyKey`. Concurrent submissions with identical keys result in exactly one created entity. Duplicate submissions or retries return the existing record (`200 OK` with `idempotentReplay: true`) without creating duplicate entities or duplicate conversion events (`order_created`, `form_submit`).
5. **Order Integrity (Unverified Revenue)**:
   Client-reported prices and totals are marked as unverified (`verifiedRevenue: false`). The server records both `clientReportedSubtotal` / `clientReportedTotal` and computes `serverCalculatedSubtotal`. Server catalog verification is deferred to future catalog services.
6. **Separation of Conversion Semantics**:
   The `order_created` event is recorded upon order creation, but is **never** automatically treated as a `purchase`. The `purchase` event is reserved for verified payment or explicit confirmation.

---

## 2. API Endpoints Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/track` | Public | Track engagement & conversion funnel events |
| `POST` | `/api/lead` | Public | Capture consultation / demo / sample lead requests |
| `POST` | `/api/order` | Public | Capture e-commerce / COD / preorder submissions |
| `POST` | `/api/custom-form` | Public | Capture arbitrary dynamic form submissions |
| `GET` | `/api/health` | Public | Service health & persistence provider status |
| `GET` | `/api/projects` | Admin | List projects (scoped to role/projectIds) |
| `POST` | `/api/projects` | Admin | Create project (Super Admin only) |
| `GET` | `/api/landing-pages` | Admin | List landing pages (filterable by `projectId`) |
| `POST` | `/api/landing-pages` | Admin | Register new landing page definition |
| `GET` | `/api/forms` | Admin | List form definitions (filterable by `projectId`, `landingPageId`) |
| `POST` | `/api/forms` | Admin | Register new form schema |
| `GET` | `/api/leads` | Admin | List captured leads |
| `GET` | `/api/orders` | Admin | List submitted orders |
| `PATCH`| `/api/orders/:id/status`| Admin | Update order or payment status |
| `GET` | `/api/events` | Admin | Query tracking event log |
| `POST` | `/api/seed/reset` | Admin | Re-populate initial seed data (Super Admin only) |

---

## 3. Public Ingestion API Specifications

### 3.1. Standard Response Formats

#### Success (200 / 201)
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

#### Idempotent Replay (200)
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

#### Error (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_FORM_TYPE",
    "message": "Form 'abano-order-form-01' has type 'order', expected 'lead' for this endpoint."
  }
}
```

### 3.2. Error Code Dictionary

| Error Code | HTTP Status | Description |
|---|---|---|
| `MISSING_REQUIRED_FIELDS` | 400 | Required fields (e.g. `projectId`, `landingPageId`, `formId`) are missing |
| `PROJECT_NOT_FOUND` | 400 | The specified `projectId` does not exist in the database |
| `PROJECT_INACTIVE` | 400 | The project has `status: 'inactive'` |
| `LP_NOT_FOUND` | 400 | The specified `landingPageId` does not exist |
| `LP_INACTIVE` | 400 | The landing page has `status: 'inactive'` |
| `INVALID_LP_HIERARCHY` | 400 | The landing page belongs to a different project |
| `FORM_NOT_FOUND` | 400 | The specified `formId` does not exist |
| `FORM_INACTIVE` | 400 | The form has `status: 'inactive'` |
| `INVALID_FORM_HIERARCHY` | 400 | The form belongs to a different project or different landing page |
| `INVALID_FORM_TYPE` | 400 | The form type does not match the endpoint (`lead` vs `order` vs `custom`) |
| `ORIGIN_NOT_ALLOWED` | 403 | The request `Origin` or `Referer` does not match the allowed project domains |
| `UNAUTHORIZED` | 401 | Missing or invalid Admin `Authorization: Bearer <token>` |
| `INSUFFICIENT_ROLE` | 403 | Role lacks mutation permissions (e.g. Viewer trying to mutate, or Project Admin creating project) |
| `FORBIDDEN_PROJECT_SCOPE` | 403 | Project Admin attempting to access or modify resources from an unauthorized project |
| `RATE_LIMIT_EXCEEDED` | 429 | Request rate exceeds 120 requests/minute |

---

## 4. Endpoints Payload Details

### 4.1. `POST /api/lead`
- **Purpose**: Collects lead generation entries (consultation, contact, sample kits).
- **Form Type Required**: `form.type === 'lead'`.
- **Auto-event**: Dispatches a `form_submit` event linked to the generated `leadId`.

```json
{
  "projectId": "abano",
  "landingPageId": "abano-freesample",
  "formId": "abano-lead-form-01",
  "idempotencyKey": "ik_lead_12345",
  "name": "Nguyễn Thị Mai",
  "phone": "0912345678",
  "email": "mai@gmail.com",
  "data": {
    "skinType": "Da nhạy cảm",
    "notes": "Muốn tư vấn dùng ban đêm"
  },
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "autumn_promo",
  "firstTouch": {
    "utmSource": "facebook",
    "utmCampaign": "autumn_promo",
    "referrer": "https://facebook.com",
    "timestamp": "2026-09-06T10:00:00Z"
  },
  "lastTouch": {
    "utmSource": "facebook",
    "utmCampaign": "autumn_promo",
    "timestamp": "2026-09-06T10:00:00Z"
  }
}
```

### 4.2. `POST /api/order`
- **Purpose**: Collects purchase and checkout orders.
- **Form Type Required**: `form.type === 'order'`.
- **Auto-event**: Dispatches an `order_created` event (NOT `purchase`).

```json
{
  "projectId": "abano",
  "landingPageId": "abano-serum-promo",
  "formId": "abano-order-form-01",
  "idempotencyKey": "ik_ord_98765",
  "customer": {
    "name": "Trần Văn Minh",
    "phone": "0987654321",
    "email": "minh@gmail.com",
    "address": "123 Lê Lợi, Q1, TP.HCM",
    "note": "Giao giờ hành chính"
  },
  "items": [
    {
      "name": "Serum Phục Hồi Botanical 50ml",
      "quantity": 2,
      "price": 590000,
      "variant": "Combo 2 chai tặng Toner"
    }
  ],
  "subtotal": 1180000,
  "total": 1180000,
  "currency": "VND",
  "paymentMethod": "cod"
}
```

### 4.3. `POST /api/custom-form`
- **Purpose**: Collects structured dynamic form surveys, quizzes, or feedback.
- **Form Type Required**: `form.type === 'custom'`.

```json
{
  "projectId": "genki-fami",
  "landingPageId": "genki-health-check",
  "formId": "genki-custom-form-01",
  "idempotencyKey": "ik_csub_55443",
  "data": {
    "quizScore": 85,
    "answers": ["A", "C", "B"]
  }
}
```

### 4.4. `POST /api/track`
- **Purpose**: Captures behavior and conversion events.
- **Accepted V1 Events**:
  - `page_view`
  - `cta_click`
  - `form_view`
  - `form_start`
  - `form_submit`
  - `order_created`
  - `purchase`

```json
{
  "eventName": "cta_click",
  "projectId": "abano",
  "landingPageId": "abano-serum-promo",
  "formId": "abano-order-form-01",
  "metadata": {
    "buttonId": "buy_now_hero",
    "scrollDepth": "45%"
  }
}
```

---

## 5. Client SDK Integration (`lphub.js`)

### 5.1. Script Embedding
```html
<script src="https://hub.yourdomain.com/sdk/lphub.js"></script>
<script>
  // Initializes SDK with automatic fallback to current domain if apiUrl is omitted
  LPHub.init({
    projectId: 'abano',
    landingPageId: 'abano-serum-promo'
  });
</script>
```

### 5.2. Attribution Lifecycle
1. On visitor arrival, SDK inspects `window.location.search` and `document.referrer`.
2. Stores `firstTouch` in `localStorage['_lphub_ft']` (immutable after initial creation).
3. Stores `lastTouch` in `localStorage['_lphub_lt']` (updated whenever new UTM campaigns arrive).
4. For all subsequent navigations or form submissions where URL parameters might be lost, SDK falls back to stored attribution context, ensuring zero attribution loss.

### 5.3. Submission Identity & Double-Submit Protection

The SDK enforces the principle: **One logical form submission = one stable `submissionId` / `idempotencyKey`**.

1. **Submission Key Persistence & Lifecycle**:
   - The key is generated when a form submission starts (`ik_lead_*`, `ik_ord_*`, `ik_csub_*`) and bound to the active `formId`.
   - On in-flight double-clicks: If `submitOrder`, `submitLead`, or `submitCustomForm` is triggered while an earlier submission is still pending, the SDK detects the in-flight promise and directly joins it, preventing duplicate network requests.
   - On failure (network error or server 4xx/5xx): The active submission key is preserved in the SDK session. Subsequent user retries reuse the exact same key, allowing the backend atomic reservation engine to safely recognize and deduplicate previously committed requests.
   - On success (`res.success === true`): The active submission session is cleared. Any subsequent submission on that form generates a fresh key, creating a brand new entity.

2. **Explicit Submission Session API (`createSubmission`)**:
   - For custom or multi-step checkout flows needing explicit lifecycle control:
   ```javascript
   const session = LPHub.createSubmission('abano-order-form-01');
   // All calls through this session instance share session.submissionId
   await session.submitOrder({ ... });
   ```

3. **Recommended Frontend UX Integration**:
   ```
   [User Clicks Submit] -> Disable Button -> Await SDK Promise -> Success (Show Thank You) OR Error (Re-enable Button for Retry)
   ```
   *Note: While frontend button disabling provides good UX, backend atomic Firestore reservations guarantee idempotency independently of the client UI state.*

---

## 6. Admin Authentication & Role Scope

Admin endpoints require an HTTP `Authorization` header:
```http
Authorization: Bearer <Firebase_ID_Token>
```

### Production Security & Fail-Closed Guardrails
1. **Production Mode (`NODE_ENV=production`)**:
   - **Only** valid Firebase Authentication ID tokens verified via Firebase Admin SDK (`adminAuth.verifyIdToken`) are accepted.
   - Any token starting with `demo-*` or `test-*` is strictly rejected with `401 Unauthorized` (`UNAUTHORIZED`).
2. **Non-Production Environments (Local / Testing)**:
   - `demo-*` and `test-*` tokens are permitted **only** when `ALLOW_TEST_TOKENS=true` is explicitly configured in the environment AND `NODE_ENV !== 'production'`.
   - If `ALLOW_TEST_TOKENS` is omitted or false, the system **fails closed**, returning `401 Unauthorized`.

### Role Matrix

| Capability | `super_admin` | `project_admin` | `viewer` |
|---|:---:|:---:|:---:|
| Read all projects | Yes | No (Only assigned `projectIds`) | Yes (Read-only) |
| Create projects | Yes | No | No |
| Create Landing Pages / Forms | Yes | Yes (Scoped) | No |
| Update Order / Payment Status | Yes | Yes (Scoped) | No |
| Trigger Seed Reset | Yes | No | No |

---

## 7. Next Steps for Contract v1 Finalization
- [ ] Incorporate centralized Product Catalog lookup service for server revenue verification.
- [ ] Connect webhook dispatchers for downstream CRM/ERP integration.
- [ ] Validate multi-domain wildcard certificates across customer landing page subdomains.
