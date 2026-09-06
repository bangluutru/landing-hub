import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { dataStore, adminAuth } from './firestore.js';
import {
  Project,
  LandingPage,
  FormDefinition,
  Lead,
  Order,
  CustomSubmission,
  TrackingEvent,
  UserRole
} from './types.js';

export const app = express();
const PORT = process.env.PORT || 3001;

// Basic in-memory rate limiting map: ip -> timestamps[]
const rateLimitWindowMs = 60 * 1000;
const maxRequestsPerMinute = 120;
const requestCounts = new Map<string, number[]>();

function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = (requestCounts.get(ip) || []).filter(t => now - t < rateLimitWindowMs);

  if (timestamps.length >= maxRequestsPerMinute) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.'
      }
    });
  }

  timestamps.push(now);
  requestCounts.set(ip, timestamps);
  next();
}

// Sanitization helpers
function sanitizeString(str: any): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeObject(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

// CORS setup: Never keep wildcard '*' in production
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, server-to-server)
      if (!origin) return callback(null, true);

      // Localhost is always allowed for local development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow through CORS middleware; specific project/LP origin match is validated in handlers
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Idempotency-Key']
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter);

// -------------------------------------------------------------
// Origin Validation Helper
// -------------------------------------------------------------
function validateRequestOrigin(
  req: Request,
  project: Project,
  landingPage: LandingPage
): { valid: boolean; error?: string } {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // Direct server-to-server or test requests without origin header are allowed
    return { valid: true };
  }

  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    hostname = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  }

  // Allow localhost in non-production or test environments
  if (
    process.env.NODE_ENV !== 'production' &&
    (hostname === 'localhost' || hostname === '127.0.0.1')
  ) {
    return { valid: true };
  }

  // Extract landing page domain
  let lpDomain = '';
  try {
    lpDomain = new URL(landingPage.url).hostname.toLowerCase();
  } catch {
    lpDomain = landingPage.url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
  }

  const allowed = (project.allowedDomains || []).map(d =>
    d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase()
  );

  const isLpDomainMatch = lpDomain && (hostname === lpDomain || hostname.endsWith('.' + lpDomain));
  const isAllowedDomainMatch = allowed.some(
    d => hostname === d || hostname.endsWith('.' + d) || (process.env.NODE_ENV !== 'production' && (d.includes('localhost') && hostname === 'localhost'))
  );

  if (isLpDomainMatch || isAllowedDomainMatch) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Origin '${origin}' is not authorized for project '${project.id}' / landing page '${landingPage.id}'.`
  };
}

// -------------------------------------------------------------
// Strict Hierarchy Validation Helper
// -------------------------------------------------------------
interface HierarchyResult {
  valid: boolean;
  status?: number;
  code?: string;
  error?: string;
  project?: Project;
  landingPage?: LandingPage;
  form?: FormDefinition;
}

async function validateHierarchy(
  projectId: string,
  landingPageId: string,
  formId?: string,
  expectedFormType?: 'lead' | 'order' | 'custom'
): Promise<HierarchyResult> {
  // 1. Project exists
  const project = await dataStore.getProject(projectId);
  if (!project) {
    return {
      valid: false,
      status: 400,
      code: 'PROJECT_NOT_FOUND',
      error: `Project '${projectId}' does not exist.`
    };
  }

  // 2. Project active
  if (project.status !== 'active') {
    return {
      valid: false,
      status: 400,
      code: 'PROJECT_INACTIVE',
      error: `Project '${projectId}' is currently inactive.`
    };
  }

  // 3. Landing Page exists
  const landingPage = await dataStore.getLandingPage(landingPageId);
  if (!landingPage) {
    return {
      valid: false,
      status: 400,
      code: 'LP_NOT_FOUND',
      error: `Landing Page '${landingPageId}' does not exist.`
    };
  }

  // 4. Landing Page active
  if (landingPage.status !== 'active') {
    return {
      valid: false,
      status: 400,
      code: 'LP_INACTIVE',
      error: `Landing Page '${landingPageId}' is currently inactive.`
    };
  }

  // 5. Landing Page belongs to Project
  if (landingPage.projectId !== project.id) {
    return {
      valid: false,
      status: 400,
      code: 'INVALID_LP_HIERARCHY',
      error: `Landing Page '${landingPageId}' belongs to project '${landingPage.projectId}', not '${project.id}'.`
    };
  }

  // 6. Form validation (if formId is provided)
  let form: FormDefinition | undefined;
  if (formId) {
    const foundForm = await dataStore.getForm(formId);
    if (!foundForm) {
      return {
        valid: false,
        status: 400,
        code: 'FORM_NOT_FOUND',
        error: `Form '${formId}' does not exist.`
      };
    }

    if (foundForm.status !== 'active') {
      return {
        valid: false,
        status: 400,
        code: 'FORM_INACTIVE',
        error: `Form '${formId}' is currently inactive.`
      };
    }

    if (foundForm.projectId !== project.id) {
      return {
        valid: false,
        status: 400,
        code: 'INVALID_FORM_HIERARCHY',
        error: `Form '${formId}' belongs to project '${foundForm.projectId}', not '${project.id}'.`
      };
    }

    if (foundForm.landingPageId !== landingPage.id) {
      return {
        valid: false,
        status: 400,
        code: 'INVALID_FORM_HIERARCHY',
        error: `Form '${formId}' is registered under landing page '${foundForm.landingPageId}', not '${landingPage.id}'.`
      };
    }

    if (expectedFormType && foundForm.type !== expectedFormType) {
      return {
        valid: false,
        status: 400,
        code: 'INVALID_FORM_TYPE',
        error: `Form '${formId}' has type '${foundForm.type}', expected '${expectedFormType}' for this endpoint.`
      };
    }

    form = foundForm;
  }

  return { valid: true, project, landingPage, form };
}

// -------------------------------------------------------------
// Admin Authentication & Authorization Middleware
// -------------------------------------------------------------
export interface AuthenticatedAdminRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: UserRole;
    projectIds?: string[];
  };
}

async function requireAdminAuth(req: AuthenticatedAdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization Bearer token is required for Admin API.'
      }
    });
  }

  const token = authHeader.substring(7).trim();

  // Support demo and test tokens strictly when NOT production AND explicitly enabled via ALLOW_TEST_TOKENS=true
  if (token.startsWith('demo-') || token.startsWith('test-')) {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowTestTokens = process.env.ALLOW_TEST_TOKENS === 'true';

    if (!isProduction && allowTestTokens) {
      const parts = token.split('-');
      const role = (parts[1] as UserRole) || 'super_admin';
      const scope = parts[2] ? parts[2].split(',') : ['abano'];
      req.user = {
        uid: `usr-${parts[1]}`,
        email: `${role}@landinghub.aiwf`,
        role,
        projectIds: role === 'project_admin' ? scope : undefined
      };
      return next();
    }

    // Fail closed: reject test/demo tokens in production or when ALLOW_TEST_TOKENS is not true
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: isProduction
          ? 'Test and demo tokens are strictly prohibited in production environment.'
          : 'Test tokens are disabled. Set ALLOW_TEST_TOKENS=true in non-production environment to enable.'
      }
    });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await dataStore.getUser(decoded.uid);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: (decoded.role || userDoc?.role || 'viewer') as UserRole,
      projectIds: decoded.projectIds || userDoc?.projectIds
    };
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired Firebase ID token.'
      }
    });
  }
}

function enforceRoleAndScope(req: AuthenticatedAdminRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
    });
  }

  // 1. Viewer Role: Read-only check
  if (user.role === 'viewer') {
    if (req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: 'Viewer role has read-only access. Mutation operations are prohibited.'
        }
      });
    }
  }

  // 2. Project Admin Role: Enforce project scope
  if (user.role === 'project_admin') {
    const userProjects = user.projectIds || [];

    // Cannot create or delete projects
    if (req.path === '/api/projects' && req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_ROLE',
          message: 'Only super_admin can create or manage project definitions.'
        }
      });
    }

    // Check query-level projectId
    const requestedProject = (req.query.projectId as string) || (req.body && req.body.projectId);
    if (requestedProject && requestedProject !== 'all') {
      if (!userProjects.includes(requestedProject)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_PROJECT_SCOPE',
            message: `You do not have administrative access to project '${requestedProject}'.`
          }
        });
      }
    }
  }

  next();
}

// -------------------------------------------------------------
// 1. Ingestion API: POST /api/track (Public)
// -------------------------------------------------------------
app.post('/api/track', async (req: Request, res: Response) => {
  try {
    const {
      eventName,
      projectId,
      landingPageId,
      formId,
      sessionId,
      visitorId,
      metadata,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrer,
      pageUrl,
      firstTouch,
      lastTouch
    } = req.body;

    if (!eventName || !projectId || !landingPageId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'eventName, projectId, and landingPageId are required.'
        }
      });
    }

    // Hierarchy check
    const check = await validateHierarchy(projectId, landingPageId, formId);
    if (!check.valid) {
      return res.status(check.status || 400).json({
        success: false,
        error: { code: check.code || 'INVALID_HIERARCHY', message: check.error }
      });
    }

    // Origin check
    const originCheck = validateRequestOrigin(req, check.project!, check.landingPage!);
    if (!originCheck.valid) {
      return res.status(403).json({
        success: false,
        error: { code: 'ORIGIN_NOT_ALLOWED', message: originCheck.error }
      });
    }

    const eventId = 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const eventRecord: TrackingEvent = {
      id: eventId,
      eventName: sanitizeString(eventName) as any,
      projectId: check.project!.id,
      landingPageId: check.landingPage!.id,
      formId: formId ? sanitizeString(formId) : undefined,
      sessionId: sessionId ? sanitizeString(sessionId) : undefined,
      visitorId: visitorId ? sanitizeString(visitorId) : undefined,
      metadata: sanitizeObject(metadata || {}),
      utmSource: utmSource ? sanitizeString(utmSource) : undefined,
      utmMedium: utmMedium ? sanitizeString(utmMedium) : undefined,
      utmCampaign: utmCampaign ? sanitizeString(utmCampaign) : undefined,
      utmContent: utmContent ? sanitizeString(utmContent) : undefined,
      utmTerm: utmTerm ? sanitizeString(utmTerm) : undefined,
      referrer: referrer ? sanitizeString(referrer) : undefined,
      pageUrl: pageUrl ? sanitizeString(pageUrl) : undefined,
      firstTouch: firstTouch ? sanitizeObject(firstTouch) : undefined,
      lastTouch: lastTouch ? sanitizeObject(lastTouch) : undefined,
      timestamp: new Date().toISOString()
    };

    await dataStore.createEvent(eventRecord);

    return res.status(200).json({
      success: true,
      id: eventId,
      message: `Event '${eventName}' tracked successfully.`
    });
  } catch (error: any) {
    console.error('[Ingestion] Error tracking event:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error recording event' }
    });
  }
});

// -------------------------------------------------------------
// 2. Ingestion API: POST /api/lead (Public)
// -------------------------------------------------------------
app.post('/api/lead', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      landingPageId,
      formId,
      submissionId,
      idempotencyKey,
      name,
      phone,
      email,
      data,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrer,
      pageUrl,
      visitorId,
      sessionId,
      firstTouch,
      lastTouch
    } = req.body;

    if (!projectId || !landingPageId || !formId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'projectId, landingPageId, and formId are required.'
        }
      });
    }

    // Strict Hierarchy Check: Must exist, active, match relationships, and form.type === 'lead'
    const check = await validateHierarchy(projectId, landingPageId, formId, 'lead');
    if (!check.valid) {
      return res.status(check.status || 400).json({
        success: false,
        error: { code: check.code || 'INVALID_HIERARCHY', message: check.error }
      });
    }

    // Origin Check
    const originCheck = validateRequestOrigin(req, check.project!, check.landingPage!);
    if (!originCheck.valid) {
      return res.status(403).json({
        success: false,
        error: { code: 'ORIGIN_NOT_ALLOWED', message: originCheck.error }
      });
    }

    // Atomic Idempotent Lead Creation
    const idempKey = (idempotencyKey || submissionId || req.headers['x-idempotency-key'] || '') as string;
    const sanitizedData = sanitizeObject(data || {});

    const { isReplay, lead } = await dataStore.atomicCreateLead(
      check.project!.id,
      idempKey || undefined,
      () => {
        const leadId = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
        return {
          id: leadId,
          submissionId: idempKey || leadId,
          idempotencyKey: idempKey || undefined,
          projectId: check.project!.id,
          landingPageId: check.landingPage!.id,
          formId: check.form!.id,
          name: name ? sanitizeString(name) : (sanitizedData.name || sanitizedData.fullName || undefined),
          phone: phone ? sanitizeString(phone) : (sanitizedData.phone || sanitizedData.phoneNumber || undefined),
          email: email ? sanitizeString(email) : (sanitizedData.email || undefined),
          data: sanitizedData,
          utmSource: utmSource ? sanitizeString(utmSource) : undefined,
          utmMedium: utmMedium ? sanitizeString(utmMedium) : undefined,
          utmCampaign: utmCampaign ? sanitizeString(utmCampaign) : undefined,
          utmContent: utmContent ? sanitizeString(utmContent) : undefined,
          utmTerm: utmTerm ? sanitizeString(utmTerm) : undefined,
          referrer: referrer ? sanitizeString(referrer) : undefined,
          pageUrl: pageUrl ? sanitizeString(pageUrl) : undefined,
          visitorId: visitorId ? sanitizeString(visitorId) : undefined,
          sessionId: sessionId ? sanitizeString(sessionId) : undefined,
          firstTouch: firstTouch ? sanitizeObject(firstTouch) : undefined,
          lastTouch: lastTouch ? sanitizeObject(lastTouch) : undefined,
          createdAt: new Date().toISOString()
        };
      }
    );

    if (isReplay) {
      return res.status(200).json({
        success: true,
        id: lead.id,
        message: 'Lead already captured (idempotent replay).',
        data: { leadId: lead.id, idempotentReplay: true }
      });
    }

    // Auto-track 'form_submit' event for conversion funnel ONLY on new creation (not replay)
    await dataStore.createEvent({
      id: 'evt-' + Date.now().toString(36) + '-sub',
      eventName: 'form_submit',
      projectId: lead.projectId,
      landingPageId: lead.landingPageId,
      formId: lead.formId,
      visitorId: lead.visitorId,
      sessionId: lead.sessionId,
      metadata: { leadId: lead.id },
      utmSource: lead.utmSource,
      utmCampaign: lead.utmCampaign,
      timestamp: lead.createdAt
    });

    return res.status(201).json({
      success: true,
      id: lead.id,
      message: 'Lead captured successfully.'
    });
  } catch (error: any) {
    console.error('[Ingestion] Error recording lead:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error recording lead' }
    });
  }
});

// -------------------------------------------------------------
// 3. Ingestion API: POST /api/order (Public)
// -------------------------------------------------------------
app.post('/api/order', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      landingPageId,
      formId,
      submissionId,
      idempotencyKey,
      customer,
      items,
      subtotal,
      total,
      currency,
      paymentMethod,
      data,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrer,
      visitorId,
      sessionId,
      firstTouch,
      lastTouch
    } = req.body;

    if (!projectId || !landingPageId || !formId || !customer || !items) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'projectId, landingPageId, formId, customer, and items are required.'
        }
      });
    }

    // Strict Hierarchy Check: Must exist, active, match relationships, and form.type === 'order'
    const check = await validateHierarchy(projectId, landingPageId, formId, 'order');
    if (!check.valid) {
      return res.status(check.status || 400).json({
        success: false,
        error: { code: check.code || 'INVALID_HIERARCHY', message: check.error }
      });
    }

    // Origin Check
    const originCheck = validateRequestOrigin(req, check.project!, check.landingPage!);
    if (!originCheck.valid) {
      return res.status(403).json({
        success: false,
        error: { code: 'ORIGIN_NOT_ALLOWED', message: originCheck.error }
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_ITEMS', message: 'Order must contain at least 1 item.' }
      });
    }

    // Order Integrity Calculation:
    // Do NOT blindly trust browser price/total. Calculate serverCalculatedSubtotal.
    let serverCalculatedSubtotal = 0;
    const sanitizedItems = items.map((it: any) => {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const prc = Math.max(0, parseFloat(it.price) || 0);
      serverCalculatedSubtotal += qty * prc;
      return {
        id: it.id ? sanitizeString(it.id) : undefined,
        name: sanitizeString(it.name || 'Sản phẩm'),
        quantity: qty,
        price: prc,
        variant: it.variant ? sanitizeString(it.variant) : undefined
      };
    });

    const clientReportedSubtotal = subtotal != null ? parseFloat(subtotal) : serverCalculatedSubtotal;
    const clientReportedTotal = total != null ? parseFloat(total) : serverCalculatedSubtotal;

    const idempKey = (idempotencyKey || submissionId || req.headers['x-idempotency-key'] || '') as string;

    const { isReplay, order } = await dataStore.atomicCreateOrder(
      check.project!.id,
      idempKey || undefined,
      () => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randCode = Math.floor(1000 + Math.random() * 9000);
        const orderIdCode = `ORD-${dateStr}-${randCode}`;
        const internalId = 'ord-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

        return {
          id: internalId,
          orderId: orderIdCode,
          submissionId: idempKey || internalId,
          idempotencyKey: idempKey || undefined,
          projectId: check.project!.id,
          landingPageId: check.landingPage!.id,
          formId: check.form!.id,
          customer: {
            name: sanitizeString(customer.name || 'Khách hàng'),
            phone: sanitizeString(customer.phone || ''),
            email: customer.email ? sanitizeString(customer.email) : undefined,
            address: customer.address ? sanitizeString(customer.address) : undefined,
            note: customer.note ? sanitizeString(customer.note) : undefined
          },
          items: sanitizedItems,
          // Order integrity fields
          clientReportedSubtotal,
          clientReportedTotal,
          serverCalculatedSubtotal,
          serverCalculatedTotal: serverCalculatedSubtotal,
          verifiedRevenue: false, // V1 without product catalog does not mark revenue as verified
          subtotal: clientReportedSubtotal,
          total: clientReportedTotal,
          currency: currency ? sanitizeString(currency).toUpperCase() : 'VND',
          paymentMethod: paymentMethod ? sanitizeString(paymentMethod) : 'cod',
          paymentStatus: 'unpaid',
          orderStatus: 'new',
          data: sanitizeObject(data || {}),
          utmSource: utmSource ? sanitizeString(utmSource) : undefined,
          utmMedium: utmMedium ? sanitizeString(utmMedium) : undefined,
          utmCampaign: utmCampaign ? sanitizeString(utmCampaign) : undefined,
          utmContent: utmContent ? sanitizeString(utmContent) : undefined,
          utmTerm: utmTerm ? sanitizeString(utmTerm) : undefined,
          referrer: referrer ? sanitizeString(referrer) : undefined,
          visitorId: visitorId ? sanitizeString(visitorId) : undefined,
          sessionId: sessionId ? sanitizeString(sessionId) : undefined,
          firstTouch: firstTouch ? sanitizeObject(firstTouch) : undefined,
          lastTouch: lastTouch ? sanitizeObject(lastTouch) : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    );

    if (isReplay) {
      return res.status(200).json({
        success: true,
        id: order.orderId,
        message: 'Order already created (idempotent replay).',
        data: {
          orderId: order.orderId,
          total: order.total,
          currency: order.currency,
          idempotentReplay: true
        }
      });
    }

    // Track order_created event (DO NOT auto-create purchase event!) ONLY on new order
    await dataStore.createEvent({
      id: 'evt-' + Date.now().toString(36) + '-ord',
      eventName: 'order_created',
      projectId: order.projectId,
      landingPageId: order.landingPageId,
      formId: order.formId,
      visitorId: visitorId ? sanitizeString(visitorId) : undefined,
      sessionId: sessionId ? sanitizeString(sessionId) : undefined,
      metadata: { orderId: order.orderId, total: order.clientReportedTotal },
      utmSource: order.utmSource,
      utmCampaign: order.utmCampaign,
      timestamp: order.createdAt
    });

    return res.status(201).json({
      success: true,
      id: order.orderId,
      message: 'Order created successfully.',
      data: {
        orderId: order.orderId,
        total: order.clientReportedTotal,
        currency: order.currency,
        verifiedRevenue: false
      }
    });
  } catch (error: any) {
    console.error('[Ingestion] Error processing order:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error processing order' }
    });
  }
});

// -------------------------------------------------------------
// 4. Ingestion API: POST /api/custom-form (Public)
// -------------------------------------------------------------
app.post('/api/custom-form', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      landingPageId,
      formId,
      submissionId,
      idempotencyKey,
      data,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      referrer,
      visitorId,
      sessionId,
      firstTouch,
      lastTouch
    } = req.body;

    if (!projectId || !landingPageId || !formId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_REQUIRED_FIELDS', message: 'projectId, landingPageId, and formId are required.' }
      });
    }

    const check = await validateHierarchy(projectId, landingPageId, formId, 'custom');
    if (!check.valid) {
      return res.status(check.status || 400).json({
        success: false,
        error: { code: check.code || 'INVALID_HIERARCHY', message: check.error }
      });
    }

    const originCheck = validateRequestOrigin(req, check.project!, check.landingPage!);
    if (!originCheck.valid) {
      return res.status(403).json({
        success: false,
        error: { code: 'ORIGIN_NOT_ALLOWED', message: originCheck.error }
      });
    }

    const idempKey = (idempotencyKey || submissionId || req.headers['x-idempotency-key'] || '') as string;

    const { isReplay, submission } = await dataStore.atomicCreateCustomSubmission(
      check.project!.id,
      idempKey || undefined,
      () => {
        const subId = 'csub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
        return {
          id: subId,
          submissionId: idempKey || subId,
          idempotencyKey: idempKey || undefined,
          projectId: check.project!.id,
          landingPageId: check.landingPage!.id,
          formId: check.form!.id,
          data: sanitizeObject(data || {}),
          utmSource: utmSource ? sanitizeString(utmSource) : undefined,
          utmMedium: utmMedium ? sanitizeString(utmMedium) : undefined,
          utmCampaign: utmCampaign ? sanitizeString(utmCampaign) : undefined,
          utmContent: utmContent ? sanitizeString(utmContent) : undefined,
          utmTerm: utmTerm ? sanitizeString(utmTerm) : undefined,
          referrer: referrer ? sanitizeString(referrer) : undefined,
          visitorId: visitorId ? sanitizeString(visitorId) : undefined,
          sessionId: sessionId ? sanitizeString(sessionId) : undefined,
          firstTouch: firstTouch ? sanitizeObject(firstTouch) : undefined,
          lastTouch: lastTouch ? sanitizeObject(lastTouch) : undefined,
          createdAt: new Date().toISOString()
        };
      }
    );

    if (isReplay) {
      return res.status(200).json({
        success: true,
        id: submission.id,
        message: 'Custom submission already recorded (idempotent replay).',
        data: { submissionId: submission.id, idempotentReplay: true }
      });
    }

    return res.status(201).json({
      success: true,
      id: submission.id,
      message: 'Custom form submission recorded.'
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message }
    });
  }
});

// -------------------------------------------------------------
// Health Check (Public)
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'landing-hub-ingestion-api',
    persistence: 'Cloud Firestore',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// Admin APIs (Require Bearer Token + Role + Project Scope)
// -------------------------------------------------------------
app.use('/api', requireAdminAuth, enforceRoleAndScope);

app.get('/api/projects', async (req: AuthenticatedAdminRequest, res: Response) => {
  const projects = await dataStore.getProjects();
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: projects.filter(p => allowed.includes(p.id)) });
  }
  res.json({ success: true, data: projects });
});

app.post('/api/projects', async (req: AuthenticatedAdminRequest, res: Response) => {
  const { name, code, description, allowedDomains } = req.body;
  if (!name || !code) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Name and code are required.' }
    });
  }

  const id = code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newProj: Project = {
    id,
    name: sanitizeString(name),
    code: sanitizeString(code).toUpperCase(),
    status: 'active',
    description: description ? sanitizeString(description) : '',
    allowedDomains: Array.isArray(allowedDomains) ? allowedDomains.map(sanitizeString) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dataStore.createProject(newProj);
  res.status(201).json({ success: true, data: newProj });
});

app.get('/api/landing-pages', async (req: AuthenticatedAdminRequest, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const lps = await dataStore.getLandingPages(projectId);
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: lps.filter(l => allowed.includes(l.projectId)) });
  }
  res.json({ success: true, data: lps });
});

app.post('/api/landing-pages', async (req: AuthenticatedAdminRequest, res: Response) => {
  const { projectId, name, url, description } = req.body;
  if (!projectId || !name || !url) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'projectId, name, and url are required.' }
    });
  }

  const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
  const newLp: LandingPage = {
    id,
    projectId: sanitizeString(projectId),
    name: sanitizeString(name),
    url: sanitizeString(url),
    status: 'active',
    description: description ? sanitizeString(description) : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dataStore.createLandingPage(newLp);
  res.status(201).json({ success: true, data: newLp });
});

app.get('/api/forms', async (req: AuthenticatedAdminRequest, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const landingPageId = req.query.landingPageId as string | undefined;
  const forms = await dataStore.getForms(projectId, landingPageId);
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: forms.filter(f => allowed.includes(f.projectId)) });
  }
  res.json({ success: true, data: forms });
});

app.post('/api/forms', async (req: AuthenticatedAdminRequest, res: Response) => {
  const { projectId, landingPageId, name, type, fields } = req.body;
  if (!projectId || !landingPageId || !name || !type) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'projectId, landingPageId, name, type are required.' }
    });
  }

  const id = `form-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newForm: FormDefinition = {
    id,
    projectId: sanitizeString(projectId),
    landingPageId: sanitizeString(landingPageId),
    name: sanitizeString(name),
    type: sanitizeString(type) as any,
    status: 'active',
    version: 1,
    fields: Array.isArray(fields) ? sanitizeObject(fields) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dataStore.createForm(newForm);
  res.status(201).json({ success: true, data: newForm });
});

app.get('/api/leads', async (req: AuthenticatedAdminRequest, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const leads = await dataStore.getLeads(projectId);
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: leads.filter(l => allowed.includes(l.projectId)) });
  }
  res.json({ success: true, data: leads });
});

app.get('/api/orders', async (req: AuthenticatedAdminRequest, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const orders = await dataStore.getOrders(projectId);
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: orders.filter(o => allowed.includes(o.projectId)) });
  }
  res.json({ success: true, data: orders });
});

app.patch('/api/orders/:id/status', async (req: AuthenticatedAdminRequest, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
  const { orderStatus, paymentStatus } = req.body;

  const existing = await dataStore.getOrder(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } });
  }

  // Check project scope for project_admin
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    if (!allowed.includes(existing.projectId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN_PROJECT_SCOPE', message: 'Not authorized for this order project.' }
      });
    }
  }

  const updated = await dataStore.updateOrderStatus(id, orderStatus, paymentStatus);
  res.json({ success: true, data: updated });
});

app.get('/api/events', async (req: AuthenticatedAdminRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const projectId = req.query.projectId as string | undefined;
  const evts = await dataStore.getEvents(limit, projectId);
  if (req.user?.role === 'project_admin') {
    const allowed = req.user.projectIds || [];
    return res.json({ success: true, data: evts.filter(e => allowed.includes(e.projectId)) });
  }
  res.json({ success: true, data: evts });
});

app.post('/api/seed/reset', async (req: AuthenticatedAdminRequest, res: Response) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'INSUFFICIENT_ROLE', message: 'Only super_admin can trigger database seed reset.' }
    });
  }

  await dataStore.resetSeed();
  res.json({ success: true, message: 'Database reset to initial sample seed in Cloud Firestore.' });
});

// -------------------------------------------------------------
// Firebase Cloud Function HTTPS Export
// -------------------------------------------------------------
export const api = onRequest({ cors: false }, app);

// Standalone Server runner for local dev
if (process.env.NODE_ENV !== 'test' && !process.env.FUNCTION_NAME && !process.env.K_SERVICE) {
  app.listen(PORT, () => {
    console.log(`[Landing Hub Ingestion API] Server listening on http://localhost:${PORT}`);
  });
}
