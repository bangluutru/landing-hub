/**
 * AIWF LP SDK — AI Workforce Landing Page SDK
 * Lightweight, zero-dependency client library for landing pages
 * Version 1.0.0
 */

export interface LPHubConfig {
  projectId: string;
  landingPageId: string;
  apiUrl: string;
  debug?: boolean;
  autoPageView?: boolean;
}

export interface LeadSubmissionPayload {
  formId: string;
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

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    if (typeof window === 'undefined') return;

    // Visitor ID (Persistent in localStorage)
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

    // Session ID (Per-session in sessionStorage)
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
  }

  public init(config: LPHubConfig) {
    this.config = {
      debug: false,
      autoPageView: true,
      ...config,
      apiUrl: config.apiUrl.replace(/\/+$/, '') // strip trailing slash
    };

    if (this.config.debug) {
      console.log('[LPHub SDK] Initialized with config:', this.config);
    }

    if (this.config.autoPageView) {
      this.track('page_view', { title: document.title });
    }
  }

  private getUtmAndContext() {
    if (typeof window === 'undefined') return {};

    const urlParams = new URLSearchParams(window.location.search);
    return {
      utmSource: urlParams.get('utm_source') || undefined,
      utmMedium: urlParams.get('utm_medium') || undefined,
      utmCampaign: urlParams.get('utm_campaign') || undefined,
      utmContent: urlParams.get('utm_content') || undefined,
      utmTerm: urlParams.get('utm_term') || undefined,
      referrer: document.referrer || undefined,
      pageUrl: window.location.href,
      visitorId: this.visitorId,
      sessionId: this.sessionId,
    };
  }

  private ensureConfigured(): LPHubConfig {
    if (!this.config) {
      throw new Error('[LPHub SDK] Client not initialized. Call LPHub.init({ projectId, landingPageId, apiUrl }) first.');
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
      metadata: metadata || {},
    };

    return this.postJson('/api/track', payload);
  }

  public async submitLead(payload: LeadSubmissionPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    // Extract name/phone/email from top level or data payload
    const data = payload.data || {};
    const name = payload.name || data.name || data.fullname || data.fullName;
    const phone = payload.phone || data.phone || data.phoneNumber;
    const email = payload.email || data.email;

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      name,
      phone,
      email,
      data,
      ...context,
    };

    return this.postJson('/api/lead', requestBody);
  }

  public async submitOrder(payload: OrderSubmissionPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      customer: payload.customer,
      items: payload.items,
      subtotal: payload.subtotal ?? payload.total,
      total: payload.total,
      currency: payload.currency || 'VND',
      paymentMethod: payload.paymentMethod || 'cod',
      data: payload.data || {},
      ...context,
    };

    return this.postJson('/api/order', requestBody);
  }

  public async submitCustomForm(payload: CustomFormPayload): Promise<ApiResponse> {
    const config = this.ensureConfigured();
    const context = this.getUtmAndContext();

    const requestBody = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      formId: payload.formId,
      data: payload.data,
      ...context,
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
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
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
          message: err.message || 'Failed to reach Landing Hub API',
        },
      };
    }
  }

  public getVisitorId(): string {
    return this.visitorId;
  }

  public getSessionId(): string {
    return this.sessionId;
  }
}

export const LPHub = new LPHubClient();

// Expose to window for pure vanilla script tags
if (typeof window !== 'undefined') {
  (window as any).LPHub = LPHub;
}
