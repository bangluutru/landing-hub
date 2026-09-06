/**
 * AIWF LP SDK — AI Workforce Landing Page SDK
 * Lightweight, zero-dependency client library for landing pages
 * Version 1.1.0 — Production Hardened
 */

export interface LPHubConfig {
  projectId: string;
  landingPageId: string;
  apiUrl?: string;
  debug?: boolean;
  autoPageView?: boolean;
}

export interface AttributionTouch {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingUrl?: string;
  timestamp?: string;
}

export interface LeadSubmissionPayload {
  formId: string;
  submissionId?: string;
  idempotencyKey?: string;
  name?: string;
  phone?: string;
  email?: string;
  data?: Record<string, any>;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
}

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
}

export interface OrderSubmissionPayload {
  formId: string;
  submissionId?: string;
  idempotencyKey?: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal?: number;
  total: number;
  currency?: string;
  paymentMethod?: string;
  data?: Record<string, any>;
}

export interface CustomFormPayload {
  formId: string;
  submissionId?: string;
  idempotencyKey?: string;
  data: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  id?: string;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

class LPHubClient {
  private config: LPHubConfig | null = null;
  private visitorId: string = '';
  private sessionId: string = '';
  private firstTouch: AttributionTouch | null = null;
  private lastTouch: AttributionTouch | null = null;

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    if (typeof window === 'undefined') return;

    // 1. Visitor ID (Persistent in localStorage)
    try {
      let vid = localStorage.getItem('_lphub_vid');
      if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem('_lphub_vid', vid);
      }
      this.visitorId = vid;
    } catch {
      this.visitorId = 'v_anon_' + Math.random().toString(36).substring(2, 9);
    }

    // 2. Session ID (Per-session in sessionStorage)
    try {
      let sid = sessionStorage.getItem('_lphub_sid');
      if (!sid) {
        sid = 's_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        sessionStorage.setItem('_lphub_sid', sid);
      }
      this.sessionId = sid;
    } catch {
      this.sessionId = 's_anon_' + Math.random().toString(36).substring(2, 9);
    }

    // 3. Attribution Persistence (firstTouch and lastTouch)
    this.syncAttribution();
  }

  private syncAttribution() {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source') || undefined;
      const utmMedium = urlParams.get('utm_medium') || undefined;
      const utmCampaign = urlParams.get('utm_campaign') || undefined;
      const utmContent = urlParams.get('utm_content') || undefined;
      const utmTerm = urlParams.get('utm_term') || undefined;
      const referrer = document.referrer || undefined;

      const hasUtm = Boolean(utmSource || utmMedium || utmCampaign || utmContent || utmTerm);

      // Load existing touches
      const storedFt = localStorage.getItem('_lphub_ft');
      if (storedFt) {
        try {
          this.firstTouch = JSON.parse(storedFt);
        } catch {}
      }

      const storedLt = localStorage.getItem('_lphub_lt');
      if (storedLt) {
        try {
          this.lastTouch = JSON.parse(storedLt);
        } catch {}
      }

      // Record first touch if not present
      if (!this.firstTouch) {
        this.firstTouch = {
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          referrer,
          landingUrl: window.location.href,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('_lphub_ft', JSON.stringify(this.firstTouch));
      }

      // Record last touch if current URL has new campaign UTMs
      if (hasUtm) {
        this.lastTouch = {
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          referrer,
          landingUrl: window.location.href,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('_lphub_lt', JSON.stringify(this.lastTouch));
      }
    } catch (e) {
      // Ignore localStorage exceptions in restrictive browser modes
    }
  }

  public init(config: LPHubConfig) {
    // Default API endpoint mechanism: if apiUrl is omitted, resolve from window global or current origin
    let resolvedApiUrl = config.apiUrl;
    if (!resolvedApiUrl) {
      if (typeof window !== 'undefined') {
        resolvedApiUrl = (window as any).__LPHUB_API_URL__ || window.location.origin;
      } else {
        resolvedApiUrl = '';
      }
    }

    this.config = {
      debug: false,
      autoPageView: true,
      ...config,
      apiUrl: resolvedApiUrl.replace(/\/+$/, '')
    };

    if (this.config.debug) {
      console.log('[LPHub SDK] Initialized with config:', this.config);
    }

    if (this.config.autoPageView) {
      this.track('page_view', { title: typeof document !== 'undefined' ? document.title : '' });
    }
  }

  private generateIdempotencyKey(prefix = 'ik'): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private getUtmAndContext() {
    if (typeof window === 'undefined') return {};

    const urlParams = new URLSearchParams(window.location.search);
    const activeUtmSource = urlParams.get('utm_source') || this.lastTouch?.utmSource || this.firstTouch?.utmSource;
    const activeUtmMedium = urlParams.get('utm_medium') || this.lastTouch?.utmMedium || this.firstTouch?.utmMedium;
    const activeUtmCampaign = urlParams.get('utm_campaign') || this.lastTouch?.utmCampaign || this.firstTouch?.utmCampaign;
    const activeUtmContent = urlParams.get('utm_content') || this.lastTouch?.utmContent || this.firstTouch?.utmContent;
    const activeUtmTerm = urlParams.get('utm_term') || this.lastTouch?.utmTerm || this.firstTouch?.utmTerm;
    const activeReferrer = document.referrer || this.lastTouch?.referrer || this.firstTouch?.referrer;

    return {
      utmSource: activeUtmSource || undefined,
      utmMedium: activeUtmMedium || undefined,
      utmCampaign: activeUtmCampaign || undefined,
      utmContent: activeUtmContent || undefined,
      utmTerm: activeUtmTerm || undefined,
      referrer: activeReferrer || undefined,
      pageUrl: window.location.href,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      firstTouch: this.firstTouch || undefined,
      lastTouch: this.lastTouch || undefined
    };
  }

  private ensureConfigured(): LPHubConfig {
    if (!this.config) {
      throw new Error('[LPHub SDK] Client not initialized. Call LPHub.init({ projectId, landingPageId }) first.');
    }
    return this.config;
  }

  public async track(eventName: string, metadata?: Record<string, any>): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const payload = {
      eventName,
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      sessionId: context.sessionId,
      visitorId: context.visitorId,
      utmSource: context.utmSource,
      utmMedium: context.utmMedium,
      utmCampaign: context.utmCampaign,
      utmContent: context.utmContent,
      utmTerm: context.utmTerm,
      referrer: context.referrer,
      pageUrl: context.pageUrl,
      firstTouch: context.firstTouch,
      lastTouch: context.lastTouch,
      metadata: metadata || {}
    };

    return this.postJson('/api/track', payload);
  }

  public async submitLead(payload: LeadSubmissionPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const data = payload.data || {};
    const name = payload.name || data.name || data.fullname || data.fullName;
    const phone = payload.phone || data.phone || data.phoneNumber;
    const email = payload.email || data.email;
    const idempKey = payload.idempotencyKey || payload.submissionId || this.generateIdempotencyKey('lead');

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      submissionId: idempKey,
      idempotencyKey: idempKey,
      name,
      phone,
      email,
      data,
      ...context
    };

    return this.postJson('/api/lead', requestBody);
  }

  public async submitOrder(payload: OrderSubmissionPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const idempKey = payload.idempotencyKey || payload.submissionId || this.generateIdempotencyKey('ord');

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      submissionId: idempKey,
      idempotencyKey: idempKey,
      customer: payload.customer,
      items: payload.items,
      subtotal: payload.subtotal ?? payload.total,
      total: payload.total,
      currency: payload.currency || 'VND',
      paymentMethod: payload.paymentMethod || 'cod',
      data: payload.data || {},
      ...context
    };

    return this.postJson('/api/order', requestBody);
  }

  public async submitCustomForm(payload: CustomFormPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const idempKey = payload.idempotencyKey || payload.submissionId || this.generateIdempotencyKey('csub');

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      submissionId: idempKey,
      idempotencyKey: idempKey,
      data: payload.data,
      ...context
    };

    return this.postJson('/api/custom-form', requestBody);
  }

  private async postJson(endpoint: string, data: any): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const url = `${config.apiUrl}${endpoint}`;

    try {
      if (config.debug) {
        console.log(`[LPHub SDK] Sending to ${url}:`, data);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const json = await response.json();
      if (config.debug) {
        console.log(`[LPHub SDK] Response from ${url}:`, json);
      }
      return json;
    } catch (err: any) {
      console.error(`[LPHub SDK] Network error on ${endpoint}:`, err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Failed to reach Landing Hub API'
        }
      };
    }
  }

  public getVisitorId(): string {
    return this.visitorId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getAttribution() {
    return {
      firstTouch: this.firstTouch,
      lastTouch: this.lastTouch
    };
  }
}

export const LPHub = new LPHubClient();

// Expose to window for pure vanilla script tags
if (typeof window !== 'undefined') {
  (window as any).LPHub = LPHub;
}
