// Set environment variables before any server modules are imported
process.env.NODE_ENV = 'test';
process.env.ALLOW_TEST_TOKENS = 'true';
process.env.USE_FIRESTORE_MEMORY_STUB = 'true';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { app } from '../server/src/index.js';
import { dataStore, adminAuth } from '../server/src/firestore.js';
import { LPHub } from '../sdk/src/index.js';

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

  // -------------------------------------------------------------
  // Test 15: Auth Hardening: Test Token Permitted in Test Env
  // -------------------------------------------------------------
  test('15. Auth Hardening: test token is accepted when NODE_ENV=test and ALLOW_TEST_TOKENS=true', async () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_TEST_TOKENS;
    try {
      process.env.NODE_ENV = 'test';
      process.env.ALLOW_TEST_TOKENS = 'true';

      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-super_admin' }
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.ALLOW_TEST_TOKENS = origAllow;
    }
  });

  // -------------------------------------------------------------
  // Test 16: Auth Hardening: Test/Demo Token Rejected in Production
  // -------------------------------------------------------------
  test('16. Auth Hardening: demo-* and test-* tokens are strictly rejected with 401 in production mode', async () => {
    const origEnv = process.env.NODE_ENV;
    const origAllow = process.env.ALLOW_TEST_TOKENS;
    try {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_TEST_TOKENS = 'true'; // even if flag is maliciously/accidentally set in prod!

      const resDemo = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer demo-super_admin' }
      });
      assert.equal(resDemo.status, 401);
      const bodyDemo = await resDemo.json();
      assert.equal(bodyDemo.success, false);
      assert.equal(bodyDemo.error?.code, 'UNAUTHORIZED');
      assert.match(bodyDemo.error?.message, /production/i);

      const resTest = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-super_admin' }
      });
      assert.equal(resTest.status, 401);
      const bodyTest = await resTest.json();
      assert.equal(bodyTest.error?.code, 'UNAUTHORIZED');
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.ALLOW_TEST_TOKENS = origAllow;
    }
  });

  // -------------------------------------------------------------
  // Test 17: Auth Hardening: Fail-Closed When ALLOW_TEST_TOKENS Missing
  // -------------------------------------------------------------
  test('17. Auth Hardening: test tokens fail closed (401) when ALLOW_TEST_TOKENS is missing or false', async () => {
    const origAllow = process.env.ALLOW_TEST_TOKENS;
    try {
      delete process.env.ALLOW_TEST_TOKENS;

      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer test-super_admin' }
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, 'UNAUTHORIZED');
    } finally {
      process.env.ALLOW_TEST_TOKENS = origAllow;
    }
  });

  // -------------------------------------------------------------
  // Test 18: Auth Hardening: Valid Firebase ID Token Accepted
  // -------------------------------------------------------------
  test('18. Auth Hardening: valid Firebase ID token passes authentication and invalid token is rejected', async () => {
    const origVerify = adminAuth.verifyIdToken;
    try {
      (adminAuth as any).verifyIdToken = async (token: string) => {
        if (token === 'firebase-valid-jwt-token') {
          return {
            uid: 'usr-firebase-real',
            email: 'firebase_admin@landinghub.aiwf',
            role: 'super_admin'
          };
        }
        throw new Error('Firebase ID token has expired or is invalid.');
      };

      // 1. Valid Firebase Token -> 200 OK
      const validRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer firebase-valid-jwt-token' }
      });
      assert.equal(validRes.status, 200);
      const validBody = await validRes.json();
      assert.equal(validBody.success, true);

      // 2. Invalid Firebase Token -> 401 UNAUTHORIZED
      const invalidRes = await fetch(`${baseUrl}/api/projects`, {
        method: 'GET',
        headers: { Authorization: 'Bearer firebase-expired-token' }
      });
      assert.equal(invalidRes.status, 401);
      const invalidBody = await invalidRes.json();
      assert.equal(invalidBody.error?.code, 'UNAUTHORIZED');
    } finally {
      adminAuth.verifyIdToken = origVerify;
    }
  });

  // -------------------------------------------------------------
  // Test 19: Atomic Concurrency (Race Condition Test)
  // -------------------------------------------------------------
  test('19. Atomic Idempotency: concurrent requests with identical idempotencyKey create only 1 order and 1 event', async () => {
    const raceKey = 'race_key_concurrent_' + Date.now();
    const payload = {
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      idempotencyKey: raceKey,
      customer: {
        name: 'Concurrent Runner',
        phone: '0977665544',
        address: '88 Hàm Nghi, Q1'
      },
      items: [{ name: 'Botanical Serum', quantity: 2, price: 590000 }],
      total: 1180000
    };

    // Fire 2 concurrent HTTP requests simultaneously (simulating real network race)
    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      fetch(`${baseUrl}/api/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    ]);

    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

    // One must be 201 (created), the other must be 200 (idempotent replay)
    const statusCodes = [resA.status, resB.status].sort();
    assert.deepEqual(statusCodes, [200, 201], 'One request must create (201) and the other must be a replay (200)');

    // Both must return the same order id
    assert.equal(bodyA.id, bodyB.id, 'Both responses must return identical order identifier');

    // Exactly one must have idempotentReplay flag
    const replayFlagCount = (bodyA.data?.idempotentReplay ? 1 : 0) + (bodyB.data?.idempotentReplay ? 1 : 0);
    assert.equal(replayFlagCount, 1, 'Exactly one response must have idempotentReplay: true');

    // Verify datastore contains exactly ONE order record for this idempotencyKey
    const orders = await dataStore.getOrders('abano');
    const matchedOrders = orders.filter(o => o.idempotencyKey === raceKey);
    assert.equal(matchedOrders.length, 1, 'Only one order record must exist in datastore');

    // Verify only ONE order_created conversion event was recorded
    const events = await dataStore.getEvents(50, 'abano');
    const createdEvts = events.filter(e => e.eventName === 'order_created' && e.metadata?.orderId === bodyA.id);
    assert.equal(createdEvts.length, 1, 'Only one order_created event must be recorded, preventing duplicate tracking');
  });

  // -------------------------------------------------------------
  // Test 20: SDK Double-Submit Protection (In-Flight Deduplication)
  // -------------------------------------------------------------
  test('20. SDK Double-Submit: concurrent submitOrder calls join the same in-flight submission', async () => {
    LPHub.init({
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      apiUrl: baseUrl,
      autoPageView: false
    });

    const orderPayload = {
      formId: 'abano-order-form-01',
      customer: {
        name: 'Nguyễn Double Click',
        phone: '0988776655',
        address: '100 Nguyễn Thị Minh Khai'
      },
      items: [{ name: 'Kem Dưỡng', quantity: 1, price: 350000 }],
      total: 350000
    };

    // User double-clicks submit: 2 calls launched concurrently without waiting
    const [sdkA, sdkB] = await Promise.all([
      LPHub.submitOrder(orderPayload),
      LPHub.submitOrder(orderPayload)
    ]);

    assert.equal(sdkA.success, true);
    assert.equal(sdkB.success, true);
    assert.equal(sdkA.id, sdkB.id, 'Both SDK calls must return the identical order id');

    // Verify only one order created in backend
    const orders = await dataStore.getOrders('abano');
    const matching = orders.filter(o => o.orderId === sdkA.id);
    assert.equal(matching.length, 1, 'Only one order must be recorded in dataStore');
  });

  // -------------------------------------------------------------
  // Test 21: SDK Retry Reuses Key on Temporary Failure
  // -------------------------------------------------------------
  test('21. SDK Retry: submission key is preserved on error so user retry is truly idempotent', async () => {
    LPHub.init({
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      apiUrl: baseUrl,
      autoPageView: false
    });
    LPHub.resetSubmission('abano-order-form-01');

    // Attempt with empty items (causes 400 EMPTY_ITEMS from server)
    const faultyPayload = {
      formId: 'abano-order-form-01',
      customer: { name: 'Retry User', phone: '0901112233', address: '123 Test St' },
      items: [], // empty items triggers validation error
      total: 0
    };

    const firstRes = await LPHub.submitOrder(faultyPayload as any);
    assert.equal(firstRes.success, false);

    // User corrects the items and clicks submit again (retry)
    const correctedPayload = {
      formId: 'abano-order-form-01',
      customer: { name: 'Retry User', phone: '0901112233', address: '123 Test St' },
      items: [{ name: 'Serum', quantity: 1, price: 590000 }],
      total: 590000
    };

    const retryRes = await LPHub.submitOrder(correctedPayload);
    assert.equal(retryRes.success, true);
    assert.match(retryRes.id!, /^ORD-\d{8}-\d{4}$/);
  });

  // -------------------------------------------------------------
  // Test 22: Subsequent Submission After Success Creates New Record
  // -------------------------------------------------------------
  test('22. SDK New Submission: subsequent submission after a successful order gets a fresh key and creates a new order', async () => {
    LPHub.init({
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      apiUrl: baseUrl,
      autoPageView: false
    });
    LPHub.resetSubmission('abano-order-form-01');

    // First successful order
    const order1 = await LPHub.submitOrder({
      formId: 'abano-order-form-01',
      customer: { name: 'First Person', phone: '0901000001', address: 'Address 1' },
      items: [{ name: 'Serum', quantity: 1, price: 590000 }],
      total: 590000
    });
    assert.equal(order1.success, true);

    // Second separate order on the same form (e.g. buyer orders again for a friend)
    const order2 = await LPHub.submitOrder({
      formId: 'abano-order-form-01',
      customer: { name: 'Second Person', phone: '0901000002', address: 'Address 2' },
      items: [{ name: 'Serum', quantity: 2, price: 590000 }],
      total: 1180000
    });
    assert.equal(order2.success, true);

    assert.notEqual(order1.id, order2.id, 'Subsequent order must create a new record with distinct order ID');
  });

  // -------------------------------------------------------------
  // Test 23: Explicit Submission Session API (createSubmission)
  // -------------------------------------------------------------
  test('23. SDK Explicit Session: createSubmission binds a stable submissionId for replay and explicit lifecycle', async () => {
    LPHub.init({
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      apiUrl: baseUrl,
      autoPageView: false
    });

    const session = LPHub.createSubmission('abano-order-form-01');
    assert.ok(session.submissionId);
    assert.equal(session.submissionId, session.idempotencyKey);

    const payload = {
      customer: { name: 'Session Customer', phone: '0919999999', address: '101 Pasteur' },
      items: [{ name: 'Serum Special', quantity: 1, price: 590000 }],
      total: 590000
    };

    // First submit via session
    const res1 = await session.submitOrder(payload);
    assert.equal(res1.success, true);

    // Explicit replay with the same session
    const res2 = await session.submitOrder(payload);
    assert.equal(res2.success, true);
    assert.equal(res1.id, res2.id, 'Explicit session must return the same created order on replay');
  });
});
