import { Project, LandingPage, FormDefinition, Lead, Order, TrackingEvent } from '../types';

const API_BASE = '/api';

export const api = {
  async getProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/projects`);
    const json = await res.json();
    return json.data || [];
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getLandingPages(): Promise<LandingPage[]> {
    const res = await fetch(`${API_BASE}/landing-pages`);
    const json = await res.json();
    return json.data || [];
  },

  async createLandingPage(data: Partial<LandingPage>): Promise<LandingPage> {
    const res = await fetch(`${API_BASE}/landing-pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getForms(): Promise<FormDefinition[]> {
    const res = await fetch(`${API_BASE}/forms`);
    const json = await res.json();
    return json.data || [];
  },

  async createForm(data: Partial<FormDefinition>): Promise<FormDefinition> {
    const res = await fetch(`${API_BASE}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json.data;
  },

  async getLeads(): Promise<Lead[]> {
    const res = await fetch(`${API_BASE}/leads`);
    const json = await res.json();
    return json.data || [];
  },

  async getOrders(): Promise<Order[]> {
    const res = await fetch(`${API_BASE}/orders`);
    const json = await res.json();
    return json.data || [];
  },

  async updateOrderStatus(orderId: string, orderStatus?: string, paymentStatus?: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderStatus, paymentStatus })
    });
    const json = await res.json();
    return json.data;
  },

  async getEvents(limit = 100): Promise<TrackingEvent[]> {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    const json = await res.json();
    return json.data || [];
  },

  async resetSeed(): Promise<void> {
    await fetch(`${API_BASE}/seed/reset`, { method: 'POST' });
  }
};
