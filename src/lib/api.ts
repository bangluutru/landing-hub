import { Project, LandingPage, FormDefinition, Lead, Order, TrackingEvent } from '../types';

const API_BASE = '/api';

let currentAuthToken = 'demo-super_admin-all';

export const setApiAuthToken = (token: string) => {
  currentAuthToken = token;
};

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra
  };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

export const api = {
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getLandingPages(projectId?: string): Promise<LandingPage[]> {
    const url = projectId && projectId !== 'all'
      ? `${API_BASE}/landing-pages?projectId=${encodeURIComponent(projectId)}`
      : `${API_BASE}/landing-pages`;
    const res = await fetch(url, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async createLandingPage(data: Partial<LandingPage>): Promise<LandingPage> {
    const res = await fetch(`${API_BASE}/landing-pages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getForms(projectId?: string, landingPageId?: string): Promise<FormDefinition[]> {
    const params = new URLSearchParams();
    if (projectId && projectId !== 'all') params.append('projectId', projectId);
    if (landingPageId && landingPageId !== 'all') params.append('landingPageId', landingPageId);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/forms${qs}`, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async createForm(data: Partial<FormDefinition>): Promise<FormDefinition> {
    const res = await fetch(`${API_BASE}/forms`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getLeads(projectId?: string): Promise<Lead[]> {
    const url = projectId && projectId !== 'all'
      ? `${API_BASE}/leads?projectId=${encodeURIComponent(projectId)}`
      : `${API_BASE}/leads`;
    const res = await fetch(url, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getOrders(projectId?: string): Promise<Order[]> {
    const url = projectId && projectId !== 'all'
      ? `${API_BASE}/orders?projectId=${encodeURIComponent(projectId)}`
      : `${API_BASE}/orders`;
    const res = await fetch(url, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async updateOrderStatus(orderId: string, orderStatus?: string, paymentStatus?: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ orderStatus, paymentStatus })
    });
    const json = await res.json();
    return json.data;
  },

  async getEvents(limit = 100, projectId?: string): Promise<TrackingEvent[]> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (projectId && projectId !== 'all') params.append('projectId', projectId);

    const res = await fetch(`${API_BASE}/events?${params.toString()}`, {
      headers: authHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async resetSeed(): Promise<void> {
    await fetch(`${API_BASE}/seed/reset`, {
      method: 'POST',
      headers: authHeaders()
    });
  }
};
