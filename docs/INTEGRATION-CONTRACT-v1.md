# Landing Hub Integration Contract

> **Contract Identity**: Landing Hub Integration Contract  
> **Version**: 1.0  
> **Status**: Frozen  
> **Compatibility Boundary**: All integrations, landing pages, AI coding agents, Design-to-Landing tools, and App Auditors targeting Landing Hub v1 MUST strictly comply with this specification. Any backward-incompatible modification to public interfaces MUST be released under a new major version (e.g. v2.0).

---

## Normative Terminology

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in this document are to be interpreted as follows:
- **MUST / MUST NOT**: Absolute requirements or prohibitions. Violations cause integration failure or rejection by the platform.
- **SHOULD / SHOULD NOT**: Default mandatory behavior unless an explicit, documented technical justification exists.
- **MAY**: Optional behaviors available for specialized use cases.

---

## 1. Core Identifiers

Every landing page connected to Landing Hub MUST use the following canonical identifiers:

1. **Hierarchy Identifiers**:
   - `projectId` (string, required): The unique alphanumeric identifier of the project / business unit (e.g. `abano`, `genki-fami`).
   - `landingPageId` (string, required): The unique identifier of the registered landing page belonging to the project (e.g. `abano-serum-promo`).
   - `formId` (string, required): The unique identifier of the registered form schema belonging to the landing page (e.g. `abano-order-form-01`).
2. **Submission Identity**:
   - `submissionId` / `idempotencyKey` (string, required): A stable identifier representing a single logical user form submission.
3. **Tracking Context**:
   - `visitorId` (string): Persistent anonymous browser identifier (managed by SDK in `localStorage`).
   - `sessionId` (string): Per-session browsing identifier (managed by SDK in `sessionStorage`).

Landing pages MUST NOT alter, override, or repurpose the semantics of these identifiers.

---

## 2. Mandatory Architecture Rules

All landing pages integrating with Landing Hub MUST comply with the following 10 invariants:

1. **Zero Direct Database Writes**:
   Landing pages MUST NOT connect to or write directly into Cloud Firestore or any internal database. All interactions MUST flow through the Landing Hub Ingestion API or the official SDK.
2. **Mandatory Ingestion Gateway**:
   All user interactions, leads, orders, custom forms, and conversion events MUST be transmitted through Landing Hub Ingestion endpoints.
3. **Strict Hierarchy Verification**:
   The entity relationship chain `projectId` $\rightarrow$ `landingPageId` $\rightarrow$ `formId` MUST exist, MUST be active (`status: 'active'`), and MUST belong to the respective parent. Invalid hierarchies are rejected with HTTP 400.
4. **Endpoint-to-FormType Alignment**:
   Submissions MUST target the endpoint corresponding to the registered `form.type`:
   - `/api/lead` MUST be used exclusively for `form.type === 'lead'`.
   - `/api/order` MUST be used exclusively for `form.type === 'order'`.
   - `/api/custom-form` MUST be used exclusively for `form.type === 'custom'`.
5. **Origin & Domain Validation**:
   Public ingestion requests MUST originate from a domain whitelisted in `project.allowedDomains` or matching the registered `landingPage.url`. Untrusted origins receive HTTP 403 `ORIGIN_NOT_ALLOWED`.
6. **Stable Submission Identity**:
   One logical form submission MUST map to exactly one stable `submissionId` / `idempotencyKey`. The key MUST be generated at the start of a submission and reused across all retries of that same submission.
7. **Authoritative Backend Idempotency**:
   Backend idempotency is authoritative. Replay submissions sharing the same composite key (`projectId + entityType + idempotencyKey`) MUST return the existing entity (`200 OK` with `idempotentReplay: true`) and MUST NOT create duplicate records or duplicate funnel events.
8. **Conversion Semantics Separation**:
   Landing pages MUST NOT treat `order_created` as a `purchase`. The `purchase` event is an independent lifecycle state reserved for verified payment or business confirmation.
9. **Unverified Client Revenue**:
   Client-reported pricing and order totals MUST NOT be treated as verified revenue. The server flags all incoming orders with `verifiedRevenue: false` until reconciled with an authoritative catalog.
10. **Zero Custom Storage Bypass**:
    Landing pages MUST NOT bypass Landing Hub by creating custom third-party databases, Google Sheets bridges, or separate Firestore collections to store form data.

---

## 3. Standard SDK Contract

The official browser integration library (`lphub.js`) provides the standard interface:

```typescript
// 1. Initialize SDK
LPHub.init(config: LPHubConfig): void;

// 2. Track standard or custom event
LPHub.track(eventName: string, metadata?: Record<string, any>): Promise<ApiResponse>;

// 3. Submit Lead Form
LPHub.submitLead(payload: LeadSubmissionPayload): Promise<ApiResponse>;

// 4. Submit Order Form
LPHub.submitOrder(payload: OrderSubmissionPayload): Promise<ApiResponse>;

// 5. Submit Custom Form
LPHub.submitCustomForm(payload: CustomFormPayload): Promise<ApiResponse>;

// 6. Create Explicit Submission Session
LPHub.createSubmission(formId: string): SubmissionSession;
```

### SDK Responsibilities
- Resolves and caches `visitorId`, `sessionId`, `firstTouch`, and `lastTouch`.
- Injects full attribution context into every track and form submission automatically.
- Performs in-flight double-submit deduplication per `formId`.
- Preserves submission key on failures for idempotent retries.
- Clears submission session on successful response (`success: true`).

---

## 4. Standard Form Types

Landing Hub freezes exactly three form types for v1:

| Form Type | Target API Endpoint | Target SDK Method | Primary Use Cases |
|---|---|---|---|
| `lead` | `POST /api/lead` | `LPHub.submitLead()` | Sample registrations, consultations, contact requests, callbacks. |
| `order` | `POST /api/order` | `LPHub.submitOrder()` | Direct sales, e-commerce checkout, COD purchases, pre-orders. |
| `custom` | `POST /api/custom-form` | `LPHub.submitCustomForm()` | Interactive quizzes, skin diagnosis, health assessments, surveys. |

Landing page creators MUST map every form into one of these three types. New ingestion patterns MUST be implemented as platform extensions to Landing Hub rather than custom landing page endpoints.

---

## 5. Standard Event Vocabulary

Landing Hub defines the canonical conversion funnel vocabulary:

| Event Name | Trigger Context | Automated Semantics |
|---|---|---|
| `page_view` | Landing page loaded | Tracked automatically on `LPHub.init()` (unless `autoPageView: false`). |
| `cta_click` | User clicks primary action button | Triggered explicitly on buttons, anchor links, or banners. |
| `form_view` | Form scrolls into visible viewport | Optional engagement signal for form impression rate. |
| `form_start` | User interacts with first form input | Indicates start of form completion intent. |
| `form_submit` | Lead form submitted | Automatically recorded by server upon successful `POST /api/lead`. |
| `order_created` | Order placed | Automatically recorded by server upon successful `POST /api/order`. |
| `purchase` | Payment confirmed | Reserved for post-order payment verification (server-side / webhook). |

### Event Rules:
- `order_created` **MUST NOT** be treated as `purchase`.
- Landing pages **MAY** dispatch custom event names (e.g. `video_play`, `quiz_step_completed`) via `LPHub.track()`, but custom events **MUST NOT** substitute or rename standard funnel events.

---

## 6. Attribution Contract

Landing pages MUST preserve the multi-touch attribution context captured by the SDK:

1. **First Touch (`firstTouch`)**:
   Stored in `localStorage['_lphub_ft']`. Captures the initial campaign parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `referrer`, `landingUrl`, `timestamp`) when the visitor first lands. Immutable once written.
2. **Last Touch (`lastTouch`)**:
   Stored in `localStorage['_lphub_lt']`. Updated whenever a visitor arrives with new UTM campaign query parameters.
3. **Session Context**:
   Retained across internal anchor navigation, tab switches, and form validation reloads.

Landing pages MUST NOT clear, overwrite, or sanitize these storage keys.

---

## 7. Submission & Idempotency Contract

The submission lifecycle enforces: **One logical submission = one stable submission identity.**

1. **Submission Key Persistence**:
   - The SDK automatically generates and binds a unique key (`ik_lead_*`, `ik_ord_*`, `ik_csub_*`) to the `formId` when submission begins.
   - **In-flight Deduplication**: If the user rapidly clicks the submit button multiple times before the server responds, the SDK joins the active in-flight Promise and DOES NOT emit duplicate network requests.
   - **Retry Key Reuse**: If the request fails (network drop or HTTP 4xx/5xx), the SDK preserves the key. When the user clicks "Retry", the exact same key is resent.
   - **Session Reset On Success**: Once the server returns `success: true`, the SDK clears the session so subsequent submissions receive a fresh key.
2. **Frontend UX Recommendation**:
   ```
   [User Clicks Submit] -> Disable Submit Button -> Await SDK Promise -> Success (Show Thank You) OR Error (Re-enable Button for Retry)
   ```
   *Frontend button disabling is an essential UX pattern, but backend atomic idempotency guarantees data integrity independently of client UI state.*

---

## 8. Landing Page Registration Lifecycle

Every landing page integrated with Landing Hub MUST follow this operational lifecycle:

```
Step 1: Identify Project (`projectId`)
   ↓
Step 2: Register Landing Page (`landingPageId`, `url`, `projectId`)
   ↓
Step 3: Register Form Definitions (`formId`, `type`, `fields`, `landingPageId`)
   ↓
Step 4: Initialize Landing Hub SDK (`LPHub.init`)
   ↓
Step 5: Bind Form Submissions (`submitLead` / `submitOrder` / `submitCustomForm`)
   ↓
Step 6: Bind Funnel Events (`cta_click`, `form_start`)
   ↓
Step 7: Test End-to-End Submission & Idempotent Replay
   ↓
Step 8: Deploy Landing Page to Whitelisted Production Domain
```

Design-to-Landing tools, AI coding agents, and integrators MUST adhere to this lifecycle.

---

## 9. Definition of Done for a Landing Page

A landing page MUST NOT be considered integrated or production-ready until all 12 criteria are verified:

- [ ] 1. `projectId` exists and is active in Landing Hub.
- [ ] 2. `landingPageId` is registered and belongs to the `projectId`.
- [ ] 3. Production domain / URL matches `project.allowedDomains` or `landingPage.url`.
- [ ] 4. All forms are registered in Landing Hub with matching `formId`.
- [ ] 5. Form types match endpoints (`lead` $\rightarrow$ `submitLead`, `order` $\rightarrow$ `submitOrder`, `custom` $\rightarrow$ `submitCustomForm`).
- [ ] 6. SDK initializes successfully without console errors.
- [ ] 7. Standard events (`page_view`, `cta_click`) fire correctly with valid tracking payload.
- [ ] 8. Attribution context (`utm_*`, `referrer`, `firstTouch`, `lastTouch`) is captured.
- [ ] 9. Double-click on submit button results in exactly one backend record (in-flight deduplication verified).
- [ ] 10. Replay with identical key returns HTTP 200 `idempotentReplay: true` and does NOT create duplicate conversion events.
- [ ] 11. Zero direct Firestore/database SDK connections exist in the landing page bundle.
- [ ] 12. Production build contains no test/demo authentication bypass tokens.

---

## 10. Legacy Landing Page Migration Protocol

Existing landing pages can be connected to Landing Hub without redesign:

1. **Inspect**: Audit existing form fields and user action buttons.
2. **Register**: Register project, landing page URL, and form schemas in Landing Hub Admin.
3. **Embed SDK**: Add `<script src="https://hub.yourdomain.com/sdk/lphub.js"></script>` to `<head>`.
4. **Replace Handler**: In existing `submit` event listeners, replace custom API calls / Google Sheets scripts with `LPHub.submitLead()`, `LPHub.submitOrder()`, or `LPHub.submitCustomForm()`.
5. **Attach Tracking**: Add `LPHub.track('cta_click', { buttonId: '...' })` to primary conversion buttons.
6. **Verify & Switch**: Verify submissions appear in Landing Hub Admin, then decommission legacy endpoints.

---

## 11. Compatibility & Versioning Rules

The following interfaces are **frozen and stable** in Landing Hub Integration Contract v1.0:
- Core hierarchy identifiers (`projectId`, `landingPageId`, `formId`).
- Public SDK methods and signature semantics.
- Public ingestion endpoints (`/api/track`, `/api/lead`, `/api/order`, `/api/custom-form`).
- Standard form types (`lead`, `order`, `custom`).
- Standard event vocabulary and semantics (`order_created` $\neq$ `purchase`).
- Response envelope (`success`, `id`, `data`, `error`).

### Backward Compatibility Guarantees:
Minor revisions (v1.x) MAY introduce optional fields or non-breaking capabilities.  
The platform MUST NOT:
- Rename existing fields or change field types.
- Change endpoint URL paths or required parameters.
- Alter error codes or HTTP status semantics.
- Render previously valid submission payloads invalid.

Any breaking modification to these guarantees requires a new contract version (e.g. v2.0).
