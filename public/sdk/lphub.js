/**
 * AIWF LP SDK — Browser Standalone Distribution v1.0.0
 * Decoupled event and submission bridge for modern landing pages.
 */
(function (global) {
  'use strict';

  function LPHubClient() {
    this.config = null;
    this.visitorId = '';
    this.sessionId = '';
    this.initStorage();
  }

  LPHubClient.prototype.initStorage = function () {
    if (typeof window === 'undefined') return;
    try {
      var vid = localStorage.getItem('_lphub_vid');
      if (!vid) {
        vid = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        localStorage.setItem('_lphub_vid', vid);
      }
      this.visitorId = vid;
    } catch (e) {
      this.visitorId = 'v_anon_' + Math.random().toString(36).substring(2, 9);
    }

    try {
      var sid = sessionStorage.getItem('_lphub_sid');
      if (!sid) {
        sid = 's_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
        sessionStorage.setItem('_lphub_sid', sid);
      }
      this.sessionId = sid;
    } catch (e) {
      this.sessionId = 's_anon_' + Math.random().toString(36).substring(2, 9);
    }
  };

  LPHubClient.prototype.init = function (config) {
    if (!config || !config.projectId || !config.landingPageId || !config.apiUrl) {
      console.error('[LPHub SDK] Missing required init params: projectId, landingPageId, apiUrl');
      return;
    }
    this.config = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
      debug: Boolean(config.debug),
      autoPageView: config.autoPageView !== false
    };

    if (this.config.debug) {
      console.log('[LPHub SDK] Initialized:', this.config);
    }

    if (this.config.autoPageView) {
      this.track('page_view', { title: document.title });
    }
  };

  LPHubClient.prototype.getUtmAndContext = function () {
    if (typeof window === 'undefined') return {};
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      referrer: document.referrer || undefined,
      pageUrl: window.location.href,
      visitorId: this.visitorId,
      sessionId: this.sessionId
    };
  };

  LPHubClient.prototype.track = function (eventName, metadata) {
    if (!this.config) {
      console.warn('[LPHub SDK] LPHub.init() must be called before tracking.');
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var ctx = this.getUtmAndContext();
    var payload = Object.assign({}, ctx, {
      eventName: eventName,
      projectId: this.config.projectId,
      landingPageId: this.config.landingPageId,
      metadata: metadata || {}
    });
    return this._post('/api/track', payload);
  };

  LPHubClient.prototype.submitLead = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var ctx = this.getUtmAndContext();
    var data = payload.data || {};
    var name = payload.name || data.name || data.fullname || data.fullName;
    var phone = payload.phone || data.phone || data.phoneNumber;
    var email = payload.email || data.email;

    var body = Object.assign({}, ctx, {
      projectId: this.config.projectId,
      landingPageId: this.config.landingPageId,
      formId: payload.formId,
      name: name,
      phone: phone,
      email: email,
      data: data
    });
    return this._post('/api/lead', body);
  };

  LPHubClient.prototype.submitOrder = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var ctx = this.getUtmAndContext();
    var body = Object.assign({}, ctx, {
      projectId: this.config.projectId,
      landingPageId: this.config.landingPageId,
      formId: payload.formId,
      customer: payload.customer,
      items: payload.items || [],
      subtotal: payload.subtotal != null ? payload.subtotal : payload.total,
      total: payload.total,
      currency: payload.currency || 'VND',
      paymentMethod: payload.paymentMethod || 'cod',
      data: payload.data || {}
    });
    return this._post('/api/order', body);
  };

  LPHubClient.prototype.submitCustomForm = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var ctx = this.getUtmAndContext();
    var body = Object.assign({}, ctx, {
      projectId: this.config.projectId,
      landingPageId: this.config.landingPageId,
      formId: payload.formId,
      data: payload.data || {}
    });
    return this._post('/api/custom-form', body);
  };

  LPHubClient.prototype._post = function (endpoint, body) {
    var url = this.config.apiUrl + endpoint;
    var debug = this.config.debug;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (debug) console.log('[LPHub SDK] Success response from ' + endpoint + ':', json);
        return json;
      })
      .catch(function (err) {
        console.error('[LPHub SDK] Request failed for ' + endpoint + ':', err);
        return {
          success: false,
          error: { code: 'NETWORK_ERROR', message: err.message || 'Network request failed' }
        };
      });
  };

  var instance = new LPHubClient();
  global.LPHub = instance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = instance;
  }
})(typeof window !== 'undefined' ? window : this);
