import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { dbStorage } from './storage.js';

const app = express();
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

// Sanitization helper
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

// Middleware setup
app.use(cors({
  origin: '*', // Allow landing pages from any domain while checking domain whitelist in handlers if desired
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter);

// Verification helper
function validateProjectAndLP(projectId: string, landingPageId: string): { valid: boolean; error?: string } {
  const db = dbStorage.getDb();
  const project = db.projects.find(p => p.id === projectId || p.code?.toLowerCase() === projectId.toLowerCase());
  if (!project) {
    return { valid: false, error: `Project '${projectId}' does not exist.` };
  }
  if (project.status === 'inactive') {
    return { valid: false, error: `Project '${projectId}' is currently inactive.` };
  }

  const lp = db.landingPages.find(l => (l.id === landingPageId || l.url?.includes(landingPageId)) && l.projectId === project.id);
  if (!lp) {
    // If not found, check if LP exists anywhere or auto-register if desired, but user requires checking project & LP
    const anyLp = db.landingPages.find(l => l.id === landingPageId);
    if (!anyLp) {
      return { valid: false, error: `Landing Page '${landingPageId}' is not registered under project '${projectId}'.` };
    }
  }

  return { valid: true };
}

// -------------------------------------------------------------
// 1. Ingestion API: POST /api/track
// -------------------------------------------------------------
app.post('/api/track', (req: Request, res: Response) => {
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
      pageUrl
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

    const check = validateProjectAndLP(projectId, landingPageId);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROJECT_OR_LP', message: check.error || 'Invalid project or landing page.' }
      });
    }

    const eventId = 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const eventRecord = {
      id: eventId,
      eventName: sanitizeString(eventName),
      projectId: sanitizeString(projectId),
      landingPageId: sanitizeString(landingPageId),
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
      timestamp: new Date().toISOString()
    };

    dbStorage.insertEvent(eventRecord);

    return res.status(200).json({
      success: true,
      id: eventId,
      message: `Event '${eventName}' tracked successfully.`
    });
  } catch (error: any) {
    console.error('Error tracking event:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error recording event' }
    });
  }
});

// -------------------------------------------------------------
// 2. Ingestion API: POST /api/lead
// -------------------------------------------------------------
app.post('/api/lead', (req: Request, res: Response) => {
  try {
    const {
      projectId,
      landingPageId,
      formId,
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
      sessionId
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

    const check = validateProjectAndLP(projectId, landingPageId);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROJECT_OR_LP', message: check.error || 'Invalid project or landing page.' }
      });
    }

    // Validate form existence
    const db = dbStorage.getDb();
    const form = db.forms.find(f => f.id === formId);
    if (form && form.status === 'inactive') {
      return res.status(400).json({
        success: false,
        error: { code: 'FORM_INACTIVE', message: `Form '${formId}' is currently inactive.` }
      });
    }

    const leadId = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
    const sanitizedData = sanitizeObject(data || {});

    const leadRecord = {
      id: leadId,
      projectId: sanitizeString(projectId),
      landingPageId: sanitizeString(landingPageId),
      formId: sanitizeString(formId),
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
      createdAt: new Date().toISOString()
    };

    dbStorage.insertLead(leadRecord);

    // Also auto-track a 'form_submit' event for the conversion funnel
    dbStorage.insertEvent({
      id: 'evt-' + Date.now().toString(36) + '-sub',
      eventName: 'form_submit',
      projectId: leadRecord.projectId,
      landingPageId: leadRecord.landingPageId,
      formId: leadRecord.formId,
      visitorId: leadRecord.visitorId,
      sessionId: leadRecord.sessionId,
      metadata: { leadId },
      utmSource: leadRecord.utmSource,
      utmCampaign: leadRecord.utmCampaign,
      timestamp: leadRecord.createdAt
    });

    return res.status(201).json({
      success: true,
      id: leadId,
      message: 'Lead captured successfully.'
    });
  } catch (error: any) {
    console.error('Error recording lead:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error recording lead' }
    });
  }
});

// -------------------------------------------------------------
// 3. Ingestion API: POST /api/order
// -------------------------------------------------------------
app.post('/api/order', (req: Request, res: Response) => {
  try {
    const {
      projectId,
      landingPageId,
      formId,
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
      sessionId
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

    const check = validateProjectAndLP(projectId, landingPageId);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROJECT_OR_LP', message: check.error || 'Invalid project or landing page.' }
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_ITEMS', message: 'Order must contain at least 1 item.' }
      });
    }

    // Generate human-friendly order code e.g. ORD-20260906-8921
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const orderIdCode = `ORD-${dateStr}-${randCode}`;
    const internalId = 'ord-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);

    // Calculate subtotal & total verification
    let calculatedTotal = 0;
    const sanitizedItems = items.map((it: any) => {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const prc = Math.max(0, parseFloat(it.price) || 0);
      calculatedTotal += qty * prc;
      return {
        id: it.id ? sanitizeString(it.id) : undefined,
        name: sanitizeString(it.name || 'Sản phẩm'),
        quantity: qty,
        price: prc,
        variant: it.variant ? sanitizeString(it.variant) : undefined
      };
    });

    const finalTotal = typeof total === 'number' && total > 0 ? total : calculatedTotal;

    const orderRecord = {
      id: internalId,
      orderId: orderIdCode,
      projectId: sanitizeString(projectId),
      landingPageId: sanitizeString(landingPageId),
      formId: sanitizeString(formId),
      customer: {
        name: sanitizeString(customer.name || 'Khách hàng'),
        phone: sanitizeString(customer.phone || ''),
        email: customer.email ? sanitizeString(customer.email) : undefined,
        address: customer.address ? sanitizeString(customer.address) : undefined,
        note: customer.note ? sanitizeString(customer.note) : undefined
      },
      items: sanitizedItems,
      subtotal: subtotal != null ? parseFloat(subtotal) : calculatedTotal,
      total: finalTotal,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbStorage.insertOrder(orderRecord);

    // Track order_created and purchase events in the funnel
    dbStorage.insertEvent({
      id: 'evt-' + Date.now().toString(36) + '-ord',
      eventName: 'order_created',
      projectId: orderRecord.projectId,
      landingPageId: orderRecord.landingPageId,
      formId: orderRecord.formId,
      visitorId: visitorId ? sanitizeString(visitorId) : undefined,
      sessionId: sessionId ? sanitizeString(sessionId) : undefined,
      metadata: { orderId: orderIdCode, total: finalTotal },
      utmSource: orderRecord.utmSource,
      utmCampaign: orderRecord.utmCampaign,
      timestamp: orderRecord.createdAt
    });

    return res.status(201).json({
      success: true,
      id: orderIdCode,
      message: 'Order created successfully.',
      data: {
        orderId: orderIdCode,
        total: finalTotal,
        currency: orderRecord.currency
      }
    });
  } catch (error: any) {
    console.error('Error processing order:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: error.message || 'Error processing order' }
    });
  }
});

// -------------------------------------------------------------
// 4. Ingestion API: POST /api/custom-form
// -------------------------------------------------------------
app.post('/api/custom-form', (req: Request, res: Response) => {
  try {
    const { projectId, landingPageId, formId, data, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, referrer } = req.body;

    if (!projectId || !landingPageId || !formId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_REQUIRED_FIELDS', message: 'projectId, landingPageId, and formId are required.' }
      });
    }

    const check = validateProjectAndLP(projectId, landingPageId);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROJECT_OR_LP', message: check.error || 'Invalid project or landing page.' }
      });
    }

    const submissionId = 'csub-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const submission = {
      id: submissionId,
      projectId: sanitizeString(projectId),
      landingPageId: sanitizeString(landingPageId),
      formId: sanitizeString(formId),
      data: sanitizeObject(data || {}),
      utmSource: utmSource ? sanitizeString(utmSource) : undefined,
      utmMedium: utmMedium ? sanitizeString(utmMedium) : undefined,
      utmCampaign: utmCampaign ? sanitizeString(utmCampaign) : undefined,
      utmContent: utmContent ? sanitizeString(utmContent) : undefined,
      utmTerm: utmTerm ? sanitizeString(utmTerm) : undefined,
      referrer: referrer ? sanitizeString(referrer) : undefined,
      createdAt: new Date().toISOString()
    };

    dbStorage.insertCustomSubmission(submission);

    return res.status(201).json({
      success: true,
      id: submissionId,
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
// 5. Admin Queries & Management APIs
// -------------------------------------------------------------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'landing-hub-ingestion-api', timestamp: new Date().toISOString() });
});

app.get('/api/projects', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbStorage.getDb().projects });
});

app.post('/api/projects', (req: Request, res: Response) => {
  const { name, code, description, allowedDomains } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'Name and code are required.' } });
  }
  const id = code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const newProj = {
    id,
    name: sanitizeString(name),
    code: sanitizeString(code).toUpperCase(),
    status: 'active',
    description: description ? sanitizeString(description) : '',
    allowedDomains: Array.isArray(allowedDomains) ? allowedDomains.map(sanitizeString) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dbStorage.insertProject(newProj);
  res.status(201).json({ success: true, data: newProj });
});

app.get('/api/landing-pages', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbStorage.getDb().landingPages });
});

app.post('/api/landing-pages', (req: Request, res: Response) => {
  const { projectId, name, url, description } = req.body;
  if (!projectId || !name || !url) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'projectId, name, and url are required.' } });
  }
  const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
  const newLp = {
    id,
    projectId: sanitizeString(projectId),
    name: sanitizeString(name),
    url: sanitizeString(url),
    status: 'active',
    description: description ? sanitizeString(description) : '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dbStorage.insertLandingPage(newLp);
  res.status(201).json({ success: true, data: newLp });
});

app.get('/api/forms', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbStorage.getDb().forms });
});

app.post('/api/forms', (req: Request, res: Response) => {
  const { projectId, landingPageId, name, type, fields } = req.body;
  if (!projectId || !landingPageId || !name || !type) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'projectId, landingPageId, name, type are required.' } });
  }
  const id = `form-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const newForm = {
    id,
    projectId: sanitizeString(projectId),
    landingPageId: sanitizeString(landingPageId),
    name: sanitizeString(name),
    type: sanitizeString(type),
    status: 'active',
    version: 1,
    fields: Array.isArray(fields) ? sanitizeObject(fields) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  dbStorage.insertForm(newForm);
  res.status(201).json({ success: true, data: newForm });
});

app.get('/api/leads', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbStorage.getDb().leads });
});

app.get('/api/orders', (_req: Request, res: Response) => {
  res.json({ success: true, data: dbStorage.getDb().orders });
});

app.patch('/api/orders/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { orderStatus, paymentStatus } = req.body;
  const updated = dbStorage.updateOrderStatus(id, orderStatus, paymentStatus);
  if (!updated) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
  }
  res.json({ success: true, data: updated });
});

app.get('/api/events', (_req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const evts = dbStorage.getDb().events.slice(0, limit);
  res.json({ success: true, data: evts });
});

app.post('/api/seed/reset', (_req: Request, res: Response) => {
  const data = dbStorage.resetSeed();
  res.json({ success: true, message: 'Database reset to initial sample seed.', data });
});

app.listen(PORT, () => {
  console.log(`[Landing Hub Ingestion API] Server listening on http://localhost:${PORT}`);
});
