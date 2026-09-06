export type ProjectStatus = 'active' | 'inactive';

export interface Project {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  allowedDomains?: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type LandingPageStatus = 'active' | 'archived' | 'draft';

export interface LandingPage {
  id: string;
  projectId: string;
  name: string;
  url: string;
  status: LandingPageStatus;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type FormType = 'lead' | 'order' | 'custom';

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

export interface FormDefinition {
  id: string;
  projectId: string;
  landingPageId: string;
  name: string;
  type: FormType;
  fields: FormField[];
  status: 'active' | 'inactive';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  projectId: string;
  landingPageId: string;
  formId: string;
  name?: string;
  phone?: string;
  email?: string;
  data: Record<string, any>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  pageUrl?: string;
  visitorId?: string;
  sessionId?: string;
  createdAt: string;
}

export type OrderStatus = 'new' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  note?: string;
}

export interface Order {
  id: string;
  orderId: string; // readable e.g. ORD-20260906-8921
  projectId: string;
  landingPageId: string;
  formId: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomSubmission {
  id: string;
  projectId: string;
  landingPageId: string;
  formId: string;
  data: Record<string, any>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  createdAt: string;
}

export type EventName = 
  | 'page_view'
  | 'cta_click'
  | 'form_view'
  | 'form_start'
  | 'form_submit'
  | 'order_created'
  | 'purchase'
  | 'scroll_25'
  | 'scroll_50'
  | 'scroll_75'
  | 'scroll_100'
  | 'video_play'
  | 'checkout_start'
  | 'variant_select';

export interface TrackingEvent {
  id: string;
  eventName: EventName;
  projectId: string;
  landingPageId: string;
  formId?: string;
  sessionId?: string;
  visitorId?: string;
  metadata?: Record<string, any>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  pageUrl?: string;
  timestamp: string;
}

export type UserRole = 'super_admin' | 'project_admin' | 'viewer';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  projectIds?: string[];
  createdAt: string;
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
