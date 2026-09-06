// Set environment variables before any server modules are imported
process.env.NODE_ENV = 'test';
process.env.USE_FIRESTORE_MEMORY_STUB = 'true';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../server/src/index.js';
import { dataStore } from '../server/src/firestore.js';

let server: Server;
let baseUrl: string;

before(async () => {
  // Ensure seed data is populated
  await dataStore.resetSeed();

  // Start ephemeral server on port 0
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('AIWF Landing Hub Integration & Ingestion API', () => {
  // -------------------------------------------------------------
  // Test 1: Valid Lead Submission
  // -------------------------------------------------------------
  test('1. Valid Lead: captures lead, returns 201, and auto-records form_submit event', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        landingPageId: 'abano-freesample',
        formId: 'abano-lead-form-01',
        name: 'Nguyễn Văn Test',
        phone: '0901234567',
        email: 'test@abano.vn',
        data: { skinType: 'Da dầu' },
        utmSource: 'facebook',
        utmCampaign: 'test_campaign'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.id, /^lead-/);

    // Verify stored lead
    const leads = await dataStore.getLeads('abano');
    const storedLead = leads.find((l) => l.id === body.id);
    assert.ok(storedLead, 'Lead should exist in dataStore');
    assert.equal(storedLead?.name, 'Nguyễn Văn Test');
    assert.equal(storedLead?.formId, 'abano-lead-form-01');

    // Verify auto-tracked form_submit event
    const events = await dataStore.getEvents(10, 'abano');
    const submitEvt = events.find(
      (e) => e.eventName === 'form_submit' && e.metadata?.leadId === body.id
    );
    assert.ok(submitEvt, 'form_submit event should be recorded automatically');
  });

  // -------------------------------------------------------------
  // Test 2: Valid Order Submission & Integrity
  // -------------------------------------------------------------
  test('2. Valid Order: creates order with integrity fields and does NOT auto-record purchase', async () => {
    const res = await fetch(`${baseUrl}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        landingPageId: 'abano-serum-promo',
        formId: 'abano-order-form-01',
        customer: {
          name: 'Trần Văn Mua',
          phone: '0987654321',
          address: '720 Điện Biên Phủ, TP.HCM'
        },
        items: [
          { name: 'Serum Phục Hồi Botanical 50ml', quantity: 2, price: 590000 }
        ],
        subtotal: 1180000,
        total: 1180000,
        currency: 'VND',
        paymentMethod: 'cod'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.id, /^ORD-\d{8}-\d{4}$/);
    assert.equal(body.data.verifiedRevenue, false, 'verifiedRevenue must be false in V1');

    // Verify order in datastore
    const order = await dataStore.getOrder(body.id);
    assert.ok(order, 'Order should be saved in datastore');
    assert.equal(order?.clientReportedSubtotal, 1180000);
    assert.equal(order?.clientReportedTotal, 1180000);
    assert.equal(order?.serverCalculatedSubtotal, 1180000);
    assert.equal(order?.verifiedRevenue, false);

    // Verify events: order_created recorded, but purchase NOT recorded
    const events = await dataStore.getEvents(10, 'abano');
    const orderEvt = events.find(
      (e) => e.eventName === 'order_created' && e.metadata?.orderId === body.id
    );
    assert.ok(orderEvt, 'order_created event must be recorded');

    const purchaseEvt = events.find(
      (e) => e.eventName === 'purchase' && e.metadata?.orderId === body.id
    );
    assert.equal(purchaseEvt, undefined, 'purchase event must NEVER be auto-created on order creation');
  });

  // -------------------------------------------------------------
  // Test 3: Valid Custom Form
  // -------------------------------------------------------------
  test('3. Valid Custom Form: captures custom submission and returns 201', async () => {
    const res = await fetch(`${baseUrl}/api/custom-form`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'genki-fami',
        landingPageId: 'genki-health-check',
        formId: 'genki-custom-form-01',
        data: { quizScore: 90, selectedTags: ['collagen', 'vitamin'] }
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.id, /^csub-/);
  });

  // -------------------------------------------------------------
  // Test 4: Unknown Project
  // -------------------------------------------------------------
  test('4. Unknown Project: returns 400 PROJECT_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'non-existent-proj',
        landingPageId: 'abano-freesample',
        formId: 'abano-lead-form-01',
        name: 'Ghost'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'PROJECT_NOT_FOUND');
  });

  // -------------------------------------------------------------
  // Test 5: Wrong LandingPage / Project Relationship
  // -------------------------------------------------------------
  test('5. Wrong LP / Project: returns 400 INVALID_LP_HIERARCHY when LP belongs to another project', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        // genki-marine-collagen belongs to genki-fami, not abano!
        landingPageId: 'genki-marine-collagen',
        formId: 'abano-lead-form-01',
        name: 'Mismatch'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'INVALID_LP_HIERARCHY');
  });

  // -------------------------------------------------------------
  // Test 6: Unknown Form
  // -------------------------------------------------------------
  test('6. Unknown Form: returns 400 FORM_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        landingPageId: 'abano-freesample',
        formId: 'non-existent-form-xyz',
        name: 'Ghost Form'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'FORM_NOT_FOUND');
  });

  // -------------------------------------------------------------
  // Test 7: Wrong Form Type
  // -------------------------------------------------------------
  test('7. Wrong Form Type: returns 400 INVALID_FORM_TYPE when lead endpoint is called with order form', async () => {
    const res = await fetch(`${baseUrl}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        landingPageId: 'abano-serum-promo',
        formId: 'abano-order-form-01', // form.type is 'order', expected 'lead'
        name: 'Wrong Type Form'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'INVALID_FORM_TYPE');
  });

  // -------------------------------------------------------------
  // Test 8: Inactive Form
  // -------------------------------------------------------------
  test('8. Inactive Form: returns 400 FORM_INACTIVE when form status is inactive', async () => {
    const res = await fetch(`${baseUrl}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'abano',
        landingPageId: 'abano-serum-promo',
        formId: 'inactive-order-form', // status is inactive
        customer: { name: 'Test Inactive', phone: '0900000000' },
        items: [{ name: 'Item', quantity: 1, price: 100000 }],
        total: 100000
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'FORM_INACTIVE');
  });

  // -------------------------------------------------------------
  // Test 9: Wrong Origin
  // -------------------------------------------------------------
  test('9. Wrong Origin: returns 403 ORIGIN_NOT_ALLOWED when untrusted origin is sent in production mode', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const res = await fetch(`${baseUrl}/api/lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://malicious-phishing-site.com'
        },
        body: JSON.stringify({
          projectId: 'abano',
          landingPageId: 'abano-freesample',
          formId: 'abano-lead-form-01',
          name: 'Attacker'
        })
      });

      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, 'ORIGIN_NOT_ALLOWED');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  // -------------------------------------------------------------
  // Test 10: Duplicate Order Submission (Idempotency)
  // -------------------------------------------------------------
  test('10. Idempotency: duplicate order submission with same idempotencyKey returns existing order without creating duplicate', async () => {
    const idempKey = 'idemp_order_test_' + Date.now();

    const payload = {
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      idempotencyKey: idempKey,
      customer: {
        name: 'Lê Double Click',
        phone: '0911223344',
        address: '456 Hai Bà Trưng'
      },
      items: [{ name: 'Serum', quantity: 1, price: 590000 }],
      total: 590000
    };

    // First submission
    const res1 = await fetch(`${baseUrl}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    const createdOrderId = body1.id;

    // Immediate second submission with identical idempotencyKey (e.g. double-click)
    const res2 = await fetch(`${baseUrl}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200, 'Replay should return 200 OK');
    const body2 = await res2.json();
    assert.equal(body2.success, true);
    assert.equal(body2.id, createdOrderId, 'Must return the original orderId');
    assert.equal(body2.data?.idempotentReplay, true);

    // Verify only ONE order was inserted in dataStore
    const orders = await dataStore.getOrders('abano');
    const matchingOrders = orders.filter((o) => o.idempotencyKey === idempKey);
    assert.equal(matchingOrders.length, 1, 'Only one order record should exist');
  });

  // -------------------------------------------------------------
  // Test 11: Unauthorized Admin API
  // -------------------------------------------------------------
  test('11. Unauthorized Admin API: returns 401 UNAUTHORIZED when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'GET'
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'UNAUTHORIZED');
  });

  // -------------------------------------------------------------
  // Test 12: Project Admin Accessing Another Project
  // -------------------------------------------------------------
  test('12. Project Admin Scope: returns 403 FORBIDDEN_PROJECT_SCOPE when project_admin accesses out-of-scope project', async () => {
    // User is project_admin for 'abano', attempting to query 'genki-fami'
    const res = await fetch(`${baseUrl}/api/orders?projectId=genki-fami`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer demo-project_admin-abano'
      }
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'FORBIDDEN_PROJECT_SCOPE');
  });

  // -------------------------------------------------------------
  // Test 13: Viewer Role Restricted from Mutation
  // -------------------------------------------------------------
  test('13. Viewer Role: allows GET but blocks POST with 403 INSUFFICIENT_ROLE', async () => {
    // GET allowed
    const getRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer demo-viewer-all'
      }
    });
    assert.equal(getRes.status, 200);

    // POST blocked
    const postRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-viewer-all'
      },
      body: JSON.stringify({ name: 'Hacked Project', code: 'HACK' })
    });
    assert.equal(postRes.status, 403);
    const body = await postRes.json();
    assert.equal(body.error?.code, 'INSUFFICIENT_ROLE');
  });

  // -------------------------------------------------------------
  // Test 14: Health Check Endpoint
  // -------------------------------------------------------------
  test('14. Health Check: returns status ok and Cloud Firestore persistence', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.persistence, 'Cloud Firestore');
  });
});
