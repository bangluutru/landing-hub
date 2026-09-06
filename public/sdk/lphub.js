/**
 * AIWF LP SDK — Browser Standalone Distribution v1.1.0 (Hardened)
 * Decoupled event, attribution, and submission bridge for modern landing pages.
 */
(function (global) {
  'use strict';

  function LPHubClient() {
    this.config = null;
    this.visitorId = '';
    this.sessionId = '';
    this.firstTouch = null;
    this.lastTouch = null;
    this.activeSubmissions = {};
    this.initStorage();
  }

  LPHubClient.prototype.initStorage = function () {
    if (typeof window === 'undefined') return;

    // 1. Visitor ID (Persistent in localStorage)
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

    // 2. Session ID (Per-session in sessionStorage)
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

    // 3. Attribution Persistence (firstTouch and lastTouch)
    this.syncAttribution();
  };

  LPHubClient.prototype.syncAttribution = function () {
    if (typeof window === 'undefined') return;

    try {
      var params = new URLSearchParams(window.location.search);
      var utmSource = params.get('utm_source') || undefined;
      var utmMedium = params.get('utm_medium') || undefined;
      var utmCampaign = params.get('utm_campaign') || undefined;
      var utmContent = params.get('utm_content') || undefined;
      var utmTerm = params.get('utm_term') || undefined;
      var referrer = document.referrer || undefined;

      var hasUtm = Boolean(utmSource || utmMedium || utmCampaign || utmContent || utmTerm);

      var storedFt = localStorage.getItem('_lphub_ft');
      if (storedFt) {
        try { this.firstTouch = JSON.parse(storedFt); } catch (e) {}
      }

      var storedLt = localStorage.getItem('_lphub_lt');
      if (storedLt) {
        try { this.lastTouch = JSON.parse(storedLt); } catch (e) {}
      }

      if (!this.firstTouch) {
        this.firstTouch = {
          utmSource: utmSource,
          utmMedium: utmMedium,
          utmCampaign: utmCampaign,
          utmContent: utmContent,
          utmTerm: utmTerm,
          referrer: referrer,
          landingUrl: window.location.href,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('_lphub_ft', JSON.stringify(this.firstTouch));
      }

      if (hasUtm) {
        this.lastTouch = {
          utmSource: utmSource,
          utmMedium: utmMedium,
          utmCampaign: utmCampaign,
          utmContent: utmContent,
          utmTerm: utmTerm,
          referrer: referrer,
          landingUrl: window.location.href,
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('_lphub_lt', JSON.stringify(this.lastTouch));
      }
    } catch (e) {}
  };

  LPHubClient.prototype.init = function (config) {
    if (!config || !config.projectId || !config.landingPageId) {
      console.error('[LPHub SDK] Missing required init params: projectId and landingPageId');
      return;
    }

    var resolvedApiUrl = config.apiUrl;
    if (!resolvedApiUrl) {
      resolvedApiUrl = (typeof window !== 'undefined' && window.__LPHUB_API_URL__) || (typeof window !== 'undefined' ? window.location.origin : '');
    }

    this.config = {
      projectId: config.projectId,
      landingPageId: config.landingPageId,
      apiUrl: resolvedApiUrl.replace(/\/+$/, ''),
      debug: Boolean(config.debug),
      autoPageView: config.autoPageView !== false
    };

    if (this.config.debug) {
      console.log('[LPHub SDK] Initialized:', this.config);
    }

    if (this.config.autoPageView) {
      this.track('page_view', { title: typeof document !== 'undefined' ? document.title : '' });
    }
  };

  LPHubClient.prototype._generateIdempotencyKey = function (prefix) {
    return (prefix || 'ik') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  };

  LPHubClient.prototype.getUtmAndContext = function () {
    if (typeof window === 'undefined') return {};
    var params = new URLSearchParams(window.location.search);

    var activeUtmSource = params.get('utm_source') || (this.lastTouch && this.lastTouch.utmSource) || (this.firstTouch && this.firstTouch.utmSource);
    var activeUtmMedium = params.get('utm_medium') || (this.lastTouch && this.lastTouch.utmMedium) || (this.firstTouch && this.firstTouch.utmMedium);
    var activeUtmCampaign = params.get('utm_campaign') || (this.lastTouch && this.lastTouch.utmCampaign) || (this.firstTouch && this.firstTouch.utmCampaign);
    var activeUtmContent = params.get('utm_content') || (this.lastTouch && this.lastTouch.utmContent) || (this.firstTouch && this.firstTouch.utmContent);
    var activeUtmTerm = params.get('utm_term') || (this.lastTouch && this.lastTouch.utmTerm) || (this.firstTouch && this.firstTouch.utmTerm);
    var activeReferrer = document.referrer || (this.lastTouch && this.lastTouch.referrer) || (this.firstTouch && this.firstTouch.referrer);

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

  /**
   * Internal submission execution engine:
   * 1. Reuses stable idempotencyKey/submissionId for the active logical submission of formId.
   * 2. If a submission is currently in-flight, returns the existing promise to prevent double-submit.
   * 3. On failure (network error or backend error), preserves the key so retry reuses it.
   * 4. On success, deletes the active session so the next submission gets a fresh key.
   */
  LPHubClient.prototype._executeSubmission = function (formId, typePrefix, explicitKey, requestExecutor) {
    var self = this;
    var formKey = formId || 'default_form';

    // 1. In-flight double-submit prevention
    var existingSession = self.activeSubmissions[formKey];
    if (existingSession && existingSession.inFlightPromise && !explicitKey) {
      if (self.config && self.config.debug) {
        console.warn('[LPHub SDK] In-flight submission detected for form \'' + formKey + '\'. Joining existing request.');
      }
      return existingSession.inFlightPromise;
    }

    // 2. Resolve or create stable key for this logical submission
    var isExplicit = Boolean(explicitKey);
    var idempKey = explicitKey;
    if (!idempKey) {
      if (!existingSession) {
        idempKey = self._generateIdempotencyKey(typePrefix);
        self.activeSubmissions[formKey] = { submissionId: idempKey };
      } else {
        idempKey = existingSession.submissionId;
      }
    }

    // 3. Execute request and track in-flight status
    var submissionPromise = requestExecutor(idempKey).then(function (response) {
      if (response && response.success && !isExplicit) {
        delete self.activeSubmissions[formKey];
      }
      var current = self.activeSubmissions[formKey];
      if (current) {
        current.inFlightPromise = undefined;
      }
      return response;
    }).catch(function (err) {
      var current = self.activeSubmissions[formKey];
      if (current) {
        current.inFlightPromise = undefined;
      }
      throw err;
    });

    if (!isExplicit && self.activeSubmissions[formKey]) {
      self.activeSubmissions[formKey].inFlightPromise = submissionPromise;
    }

    return submissionPromise;
  };

  /**
   * Explicit Submission Session factory for manual lifecycle management.
   */
  LPHubClient.prototype.createSubmission = function (formId) {
    var self = this;
    var sessionKey = self._generateIdempotencyKey('sub');
    return {
      submissionId: sessionKey,
      idempotencyKey: sessionKey,
      submitLead: function (payload) {
        return self.submitLead(Object.assign({}, payload, {
          formId: (payload && payload.formId) || formId,
          submissionId: sessionKey,
          idempotencyKey: sessionKey
        }));
      },
      submitOrder: function (payload) {
        return self.submitOrder(Object.assign({}, payload, {
          formId: (payload && payload.formId) || formId,
          submissionId: sessionKey,
          idempotencyKey: sessionKey
        }));
      },
      submitCustomForm: function (payload) {
        return self.submitCustomForm(Object.assign({}, payload, {
          formId: (payload && payload.formId) || formId,
          submissionId: sessionKey,
          idempotencyKey: sessionKey
        }));
      },
      reset: function () {
        self.resetSubmission(formId);
      }
    };
  };

  /**
   * Reset active submission session for a given formId.
   */
  LPHubClient.prototype.resetSubmission = function (formId) {
    delete this.activeSubmissions[formId || 'default_form'];
  };

  LPHubClient.prototype.submitLead = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var self = this;
    var ctx = this.getUtmAndContext();
    var data = payload.data || {};
    var name = payload.name || data.name || data.fullname || data.fullName;
    var phone = payload.phone || data.phone || data.phoneNumber;
    var email = payload.email || data.email;
    var explicitKey = payload.idempotencyKey || payload.submissionId;

    return this._executeSubmission(payload.formId, 'lead', explicitKey, function (key) {
      var body = Object.assign({}, ctx, {
        projectId: self.config.projectId,
        landingPageId: self.config.landingPageId,
        formId: payload.formId,
        submissionId: key,
        idempotencyKey: key,
        name: name,
        phone: phone,
        email: email,
        data: data
      });
      return self._post('/api/lead', body);
    });
  };

  LPHubClient.prototype.submitOrder = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var self = this;
    var ctx = this.getUtmAndContext();
    var explicitKey = payload.idempotencyKey || payload.submissionId;

    return this._executeSubmission(payload.formId, 'ord', explicitKey, function (key) {
      var body = Object.assign({}, ctx, {
        projectId: self.config.projectId,
        landingPageId: self.config.landingPageId,
        formId: payload.formId,
        submissionId: key,
        idempotencyKey: key,
        customer: payload.customer,
        items: payload.items || [],
        subtotal: payload.subtotal != null ? payload.subtotal : payload.total,
        total: payload.total,
        currency: payload.currency || 'VND',
        paymentMethod: payload.paymentMethod || 'cod',
        data: payload.data || {}
      });
      return self._post('/api/order', body);
    });
  };

  LPHubClient.prototype.submitCustomForm = function (payload) {
    if (!this.config) {
      return Promise.resolve({ success: false, error: { code: 'NOT_INITIALIZED', message: 'SDK not initialized' } });
    }
    var self = this;
    var ctx = this.getUtmAndContext();
    var explicitKey = payload.idempotencyKey || payload.submissionId;

    return this._executeSubmission(payload.formId, 'csub', explicitKey, function (key) {
      var body = Object.assign({}, ctx, {
        projectId: self.config.projectId,
        landingPageId: self.config.landingPageId,
        formId: payload.formId,
        submissionId: key,
        idempotencyKey: key,
        data: payload.data || {}
      });
      return self._post('/api/custom-form', body);
    });
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
