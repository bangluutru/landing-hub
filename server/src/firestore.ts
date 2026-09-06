import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import crypto from 'crypto';
import {
  Project,
  LandingPage,
  FormDefinition,
  Lead,
  Order,
  CustomSubmission,
  TrackingEvent,
  AdminUser
} from './types.js';

// Initialize Firebase Admin
let adminApp: App;
if (getApps().length === 0) {
  try {
    adminApp = initializeApp({
      projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'landing-hub-4ac12'
    });
  } catch (e) {
    adminApp = initializeApp();
  }
} else {
  adminApp = getApps()[0];
}

export const adminAuth: Auth = getAuth(adminApp);
export const firestoreDb: Firestore = getFirestore(adminApp);

/**
 * Deterministic Idempotency Key Generator:
 * Scoped by projectId + entityType + idempotencyKey.
 * Uses SHA-256 hex digest to avoid invalid Firestore ID characters and prevent exposing sensitive data.
 */
export function getReservationId(projectId: string, entityType: 'lead' | 'order' | 'custom', idempotencyKey: string): string {
  const raw = `${projectId.trim().toLowerCase()}:${entityType}:${idempotencyKey.trim()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return `res_${hash}`;
}

// Standard Seed Data (Written directly to Firestore, not filesystem)
export const INITIAL_SEED_DATA = {
  projects: [
    {
      id: 'abano',
      name: 'ABANO Wellness',
      code: 'ABANO',
      status: 'active' as const,
      allowedDomains: ['abano.vn', 'localhost:5173', 'localhost:3000'],
      description: 'Mỹ phẩm & Chăm sóc da hữu cơ cao cấp',
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z'
    },
    {
      id: 'genki-fami',
      name: 'Genki Fami',
      code: 'GENKI',
      status: 'active' as const,
      allowedDomains: ['genkifami.vn', 'localhost:5173'],
      description: 'Thực phẩm bảo vệ sức khoẻ tiêu chuẩn Nhật Bản',
      createdAt: '2026-08-10T09:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z'
    },
    {
      id: 'balancera',
      name: 'Balancera',
      code: 'BALANCERA',
      status: 'active' as const,
      allowedDomains: ['balancera.com'],
      description: 'Dinh dưỡng cân bằng & Fitness',
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z'
    },
    {
      id: 'huma-medical',
      name: 'Huma Medical',
      code: 'HUMA',
      status: 'active' as const,
      allowedDomains: ['humamedical.vn'],
      description: 'Thiết bị y tế gia đình thế hệ mới',
      createdAt: '2026-08-20T09:00:00Z',
      updatedAt: '2026-09-04T10:00:00Z'
    }
  ],
  landingPages: [
    {
      id: 'abano-serum-promo',
      projectId: 'abano',
      name: 'Serum Phục Hồi Botanical - Flash Sale',
      url: 'https://abano.vn/botanical-serum-sale',
      status: 'active' as const,
      description: 'Landing page chiến dịch mùa thu, ưu đãi tặng kèm toner',
      createdAt: '2026-08-05T09:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z'
    },
    {
      id: 'abano-freesample',
      projectId: 'abano',
      name: 'Đăng Ký Nhận Mẫu Thử Miễn Phí',
      url: 'https://abano.vn/free-sample',
      status: 'active' as const,
      description: 'Landing page phễu thu thập lead nhận kit 3 ngày',
      createdAt: '2026-08-12T09:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z'
    },
    {
      id: 'genki-marine-collagen',
      projectId: 'genki-fami',
      name: 'Marine Collagen Peptide 5000mg',
      url: 'https://genkifami.vn/collagen-peptide',
      status: 'active' as const,
      description: 'Landing page bán hàng trực tiếp hộp 30 gói',
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z'
    },
    {
      id: 'genki-health-check',
      projectId: 'genki-fami',
      name: 'Trắc Nghiệm Sức Khỏe Tuổi 40+',
      url: 'https://genkifami.vn/health-quiz',
      status: 'active' as const,
      description: 'Custom Quiz Funnel tư vấn vi chất',
      createdAt: '2026-08-22T09:00:00Z',
      updatedAt: '2026-09-04T10:00:00Z'
    }
  ],
  forms: [
    {
      id: 'abano-lead-form-01',
      projectId: 'abano',
      landingPageId: 'abano-freesample',
      name: 'Form Đăng Ký Mẫu Thử',
      type: 'lead' as const,
      status: 'active' as const,
      version: 1,
      fields: [
        { key: 'name', label: 'Họ và tên', type: 'text' as const, required: true },
        { key: 'phone', label: 'Số điện thoại', type: 'phone' as const, required: true },
        { key: 'email', label: 'Email', type: 'email' as const, required: false },
        { key: 'skinType', label: 'Loại da hiện tại', type: 'select' as const, required: true, options: ['Da dầu', 'Da khô', 'Da nhạy cảm', 'Hỗn hợp'] }
      ],
      createdAt: '2026-08-12T10:00:00Z',
      updatedAt: '2026-08-12T10:00:00Z'
    },
    {
      id: 'abano-order-form-01',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      name: 'Form Đặt Mua Serum Flash Sale',
      type: 'order' as const,
      status: 'active' as const,
      version: 2,
      fields: [
        { key: 'name', label: 'Người nhận hàng', type: 'text' as const, required: true },
        { key: 'phone', label: 'Số điện thoại nhận hàng', type: 'phone' as const, required: true },
        { key: 'address', label: 'Địa chỉ giao hàng', type: 'text' as const, required: true },
        { key: 'note', label: 'Ghi chú giao hàng', type: 'textarea' as const, required: false }
      ],
      createdAt: '2026-08-05T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z'
    },
    {
      id: 'genki-order-form-01',
      projectId: 'genki-fami',
      landingPageId: 'genki-marine-collagen',
      name: 'Form Đặt Mua Collagen Nhật Bản',
      type: 'order' as const,
      status: 'active' as const,
      version: 1,
      fields: [
        { key: 'name', label: 'Họ tên', type: 'text' as const, required: true },
        { key: 'phone', label: 'Điện thoại', type: 'phone' as const, required: true },
        { key: 'address', label: 'Địa chỉ nhận hàng', type: 'text' as const, required: true }
      ],
      createdAt: '2026-08-15T10:00:00Z',
      updatedAt: '2026-08-15T10:00:00Z'
    },
    {
      id: 'genki-lead-form-01',
      projectId: 'genki-fami',
      landingPageId: 'genki-health-check',
      name: 'Form Khảo Sát Sức Khỏe',
      type: 'lead' as const,
      status: 'active' as const,
      version: 1,
      fields: [
        { key: 'name', label: 'Họ và tên', type: 'text' as const, required: true },
        { key: 'phone', label: 'Số điện thoại', type: 'phone' as const, required: true }
      ],
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z'
    },
    {
      id: 'genki-custom-form-01',
      projectId: 'genki-fami',
      landingPageId: 'genki-health-check',
      name: 'Form Khảo Sát Tuỳ Biến',
      type: 'custom' as const,
      status: 'active' as const,
      version: 1,
      fields: [],
      createdAt: '2026-08-22T10:00:00Z',
      updatedAt: '2026-08-22T10:00:00Z'
    },
    {
      id: 'inactive-order-form',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      name: 'Form Đã Tạm Khóa',
      type: 'order' as const,
      status: 'inactive' as const,
      version: 1,
      fields: [],
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-01T10:00:00Z'
    }
  ],
  leads: [
    {
      id: 'lead-001',
      projectId: 'abano',
      landingPageId: 'abano-freesample',
      formId: 'abano-lead-form-01',
      name: 'Nguyễn Thị Thu Hà',
      phone: '0912345678',
      email: 'thuha.nguyen@gmail.com',
      data: { skinType: 'Da nhạy cảm', ageGroup: '25-34' },
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'sample_september_v1',
      utmContent: 'video_unboxing_kol',
      referrer: 'https://facebook.com',
      createdAt: '2026-09-05T14:22:10Z'
    },
    {
      id: 'lead-002',
      projectId: 'abano',
      landingPageId: 'abano-freesample',
      formId: 'abano-lead-form-01',
      name: 'Trần Mai Linh',
      phone: '0987654321',
      email: 'mailinh.tran@outlook.com',
      data: { skinType: 'Da khô', ageGroup: '35-44' },
      utmSource: 'tiktok',
      utmMedium: 'influencer',
      utmCampaign: 'skincare_routine_autumn',
      referrer: 'https://tiktok.com',
      createdAt: '2026-09-06T08:15:30Z'
    },
    {
      id: 'lead-003',
      projectId: 'genki-fami',
      landingPageId: 'genki-health-check',
      formId: 'genki-lead-form-01',
      name: 'Phạm Quốc Bảo',
      phone: '0903456789',
      email: 'baopq@corp.vn',
      data: { quizScore: 82, recommendation: 'Marine Collagen + B-Complex' },
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'search_collagen_nhat',
      referrer: 'https://google.com',
      createdAt: '2026-09-06T11:45:00Z'
    }
  ],
  orders: [
    {
      id: 'ord-001',
      orderId: 'ORD-20260905-AB01',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      customer: {
        name: 'Hoàng Minh Châu',
        phone: '0933112233',
        email: 'chauhm@yahoo.com',
        address: 'Tòa nhà Landmark 81, 720A Điện Biên Phủ, Q. Bình Thạnh, TP.HCM',
        note: 'Giao giờ hành chính, gọi trước khi đến'
      },
      items: [
        { id: 'abano-serum-50ml', name: 'Serum Phục Hồi Botanical 50ml', quantity: 2, price: 590000, variant: 'Combo 2 chai tặng Toner' }
      ],
      clientReportedSubtotal: 1180000,
      clientReportedTotal: 1180000,
      serverCalculatedSubtotal: 1180000,
      serverCalculatedTotal: 1180000,
      verifiedRevenue: false,
      subtotal: 1180000,
      total: 1180000,
      currency: 'VND',
      paymentMethod: 'cod',
      paymentStatus: 'pending' as const,
      orderStatus: 'confirmed' as const,
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: 'serum_flashsale_hcm',
      referrer: 'https://m.facebook.com',
      createdAt: '2026-09-05T16:30:00Z',
      updatedAt: '2026-09-05T17:00:00Z'
    },
    {
      id: 'ord-002',
      orderId: 'ORD-20260906-GK02',
      projectId: 'genki-fami',
      landingPageId: 'genki-marine-collagen',
      formId: 'genki-order-form-01',
      customer: {
        name: 'Đặng Thanh Thảo',
        phone: '0977889900',
        email: 'thao.dang@fpt.com.vn',
        address: 'Số 18 Hoàng Diệu, Phường Quán Thánh, Ba Đình, Hà Nội'
      },
      items: [
        { id: 'gk-col-box', name: 'Marine Collagen Peptide 5000mg (Hộp 30 gói)', quantity: 3, price: 850000 }
      ],
      clientReportedSubtotal: 2550000,
      clientReportedTotal: 2550000,
      serverCalculatedSubtotal: 2550000,
      serverCalculatedTotal: 2550000,
      verifiedRevenue: false,
      subtotal: 2550000,
      total: 2550000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid' as const,
      orderStatus: 'processing' as const,
      utmSource: 'google',
      utmMedium: 'organic',
      referrer: 'https://google.com.vn',
      createdAt: '2026-09-06T09:12:00Z',
      updatedAt: '2026-09-06T10:00:00Z'
    }
  ],
  customSubmissions: [],
  events: [
    {
      id: 'evt-001',
      eventName: 'page_view' as const,
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      pageUrl: 'https://abano.vn/botanical-serum-sale',
      utmSource: 'facebook',
      utmCampaign: 'serum_flashsale_hcm',
      timestamp: '2026-09-05T16:20:00Z'
    },
    {
      id: 'evt-002',
      eventName: 'cta_click' as const,
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      metadata: { buttonId: 'buy_now_hero' },
      timestamp: '2026-09-05T16:21:15Z'
    },
    {
      id: 'evt-003',
      eventName: 'form_start' as const,
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      timestamp: '2026-09-05T16:22:00Z'
    },
    {
      id: 'evt-004',
      eventName: 'form_submit' as const,
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      timestamp: '2026-09-05T16:29:55Z'
    },
    {
      id: 'evt-005',
      eventName: 'order_created' as const,
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      metadata: { orderId: 'ORD-20260905-AB01', total: 1180000 },
      timestamp: '2026-09-05T16:30:00Z'
    }
  ],
  users: [
    {
      uid: 'user-admin',
      email: 'admin@landinghub.aiwf',
      displayName: 'Super Admin',
      role: 'super_admin' as const,
      createdAt: '2026-08-01T00:00:00Z'
    },
    {
      uid: 'user-abano',
      email: 'abano.admin@landinghub.aiwf',
      displayName: 'ABANO Manager',
      role: 'project_admin' as const,
      projectIds: ['abano'],
      createdAt: '2026-08-01T00:00:00Z'
    },
    {
      uid: 'user-viewer',
      email: 'viewer@landinghub.aiwf',
      displayName: 'Guest Viewer',
      role: 'viewer' as const,
      createdAt: '2026-08-01T00:00:00Z'
    }
  ]
};

export interface DataStore {
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(project: Project): Promise<Project>;
  getLandingPages(projectId?: string): Promise<LandingPage[]>;
  getLandingPage(id: string): Promise<LandingPage | null>;
  createLandingPage(lp: LandingPage): Promise<LandingPage>;
  getForms(projectId?: string, landingPageId?: string): Promise<FormDefinition[]>;
  getForm(id: string): Promise<FormDefinition | null>;
  createForm(form: FormDefinition): Promise<FormDefinition>;
  getLeads(projectId?: string): Promise<Lead[]>;
  createLead(lead: Lead): Promise<Lead>;
  findLeadByIdempotency(key: string, projectId: string): Promise<Lead | null>;
  getOrders(projectId?: string): Promise<Order[]>;
  getOrder(idOrCode: string): Promise<Order | null>;
  createOrder(order: Order): Promise<Order>;
  findOrderByIdempotency(key: string, projectId: string): Promise<Order | null>;
  updateOrderStatus(idOrCode: string, orderStatus?: string, paymentStatus?: string): Promise<Order | null>;
  createCustomSubmission(sub: CustomSubmission): Promise<CustomSubmission>;
  findCustomSubmissionByIdempotency(key: string, projectId: string): Promise<CustomSubmission | null>;
  getEvents(limit?: number, projectId?: string): Promise<TrackingEvent[]>;
  createEvent(event: TrackingEvent): Promise<TrackingEvent>;
  getUser(uid: string): Promise<AdminUser | null>;
  resetSeed(): Promise<void>;

  // Atomic Idempotency Reservation APIs
  atomicCreateOrder(
    projectId: string,
    idempotencyKey: string | undefined,
    orderFactory: () => Order
  ): Promise<{ isReplay: boolean; order: Order }>;

  atomicCreateLead(
    projectId: string,
    idempotencyKey: string | undefined,
    leadFactory: () => Lead
  ): Promise<{ isReplay: boolean; lead: Lead }>;

  atomicCreateCustomSubmission(
    projectId: string,
    idempotencyKey: string | undefined,
    submissionFactory: () => CustomSubmission
  ): Promise<{ isReplay: boolean; submission: CustomSubmission }>;
}

/**
 * Cloud Firestore Implementation
 * Uses Cloud Firestore collections via Firebase Admin SDK with transactional idempotency reservations.
 */
class FirestoreDataStore implements DataStore {
  private db = firestoreDb;

  async getProjects(): Promise<Project[]> {
    const snap = await this.db.collection('projects').get();
    return snap.docs.map(d => d.data() as Project);
  }

  async getProject(id: string): Promise<Project | null> {
    const doc = await this.db.collection('projects').doc(id).get();
    if (doc.exists) return doc.data() as Project;

    const querySnap = await this.db.collection('projects').where('code', '==', id.toUpperCase()).limit(1).get();
    if (!querySnap.empty) return querySnap.docs[0].data() as Project;

    return null;
  }

  async createProject(project: Project): Promise<Project> {
    await this.db.collection('projects').doc(project.id).set(project);
    return project;
  }

  async getLandingPages(projectId?: string): Promise<LandingPage[]> {
    let query: FirebaseFirestore.Query = this.db.collection('landingPages');
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    const snap = await query.get();
    return snap.docs.map(d => d.data() as LandingPage);
  }

  async getLandingPage(id: string): Promise<LandingPage | null> {
    const doc = await this.db.collection('landingPages').doc(id).get();
    if (doc.exists) return doc.data() as LandingPage;
    return null;
  }

  async createLandingPage(lp: LandingPage): Promise<LandingPage> {
    await this.db.collection('landingPages').doc(lp.id).set(lp);
    return lp;
  }

  async getForms(projectId?: string, landingPageId?: string): Promise<FormDefinition[]> {
    let query: FirebaseFirestore.Query = this.db.collection('forms');
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    if (landingPageId) {
      query = query.where('landingPageId', '==', landingPageId);
    }
    const snap = await query.get();
    return snap.docs.map(d => d.data() as FormDefinition);
  }

  async getForm(id: string): Promise<FormDefinition | null> {
    const doc = await this.db.collection('forms').doc(id).get();
    if (doc.exists) return doc.data() as FormDefinition;
    return null;
  }

  async createForm(form: FormDefinition): Promise<FormDefinition> {
    await this.db.collection('forms').doc(form.id).set(form);
    return form;
  }

  async getLeads(projectId?: string): Promise<Lead[]> {
    let query: FirebaseFirestore.Query = this.db.collection('leads');
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => d.data() as Lead);
  }

  async createLead(lead: Lead): Promise<Lead> {
    await this.db.collection('leads').doc(lead.id).set(lead);
    return lead;
  }

  async findLeadByIdempotency(key: string, projectId: string): Promise<Lead | null> {
    const snap = await this.db
      .collection('leads')
      .where('projectId', '==', projectId)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data() as Lead;

    const snapSub = await this.db
      .collection('leads')
      .where('projectId', '==', projectId)
      .where('submissionId', '==', key)
      .limit(1)
      .get();
    if (!snapSub.empty) return snapSub.docs[0].data() as Lead;

    return null;
  }

  async getOrders(projectId?: string): Promise<Order[]> {
    let query: FirebaseFirestore.Query = this.db.collection('orders');
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    const snap = await query.orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => d.data() as Order);
  }

  async getOrder(idOrCode: string): Promise<Order | null> {
    const doc = await this.db.collection('orders').doc(idOrCode).get();
    if (doc.exists) return doc.data() as Order;

    const snap = await this.db.collection('orders').where('orderId', '==', idOrCode).limit(1).get();
    if (!snap.empty) return snap.docs[0].data() as Order;

    return null;
  }

  async createOrder(order: Order): Promise<Order> {
    await this.db.collection('orders').doc(order.id).set(order);
    return order;
  }

  async findOrderByIdempotency(key: string, projectId: string): Promise<Order | null> {
    const snap = await this.db
      .collection('orders')
      .where('projectId', '==', projectId)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data() as Order;

    const snapSub = await this.db
      .collection('orders')
      .where('projectId', '==', projectId)
      .where('submissionId', '==', key)
      .limit(1)
      .get();
    if (!snapSub.empty) return snapSub.docs[0].data() as Order;

    return null;
  }

  async updateOrderStatus(idOrCode: string, orderStatus?: string, paymentStatus?: string): Promise<Order | null> {
    const existing = await this.getOrder(idOrCode);
    if (!existing) return null;

    const updates: Partial<Order> = { updatedAt: new Date().toISOString() };
    if (orderStatus) updates.orderStatus = orderStatus as any;
    if (paymentStatus) updates.paymentStatus = paymentStatus as any;

    await this.db.collection('orders').doc(existing.id).update(updates);
    return { ...existing, ...updates };
  }

  async createCustomSubmission(sub: CustomSubmission): Promise<CustomSubmission> {
    await this.db.collection('customSubmissions').doc(sub.id).set(sub);
    return sub;
  }

  async findCustomSubmissionByIdempotency(key: string, projectId: string): Promise<CustomSubmission | null> {
    const snap = await this.db
      .collection('customSubmissions')
      .where('projectId', '==', projectId)
      .where('idempotencyKey', '==', key)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data() as CustomSubmission;
    return null;
  }

  async getEvents(limit = 100, projectId?: string): Promise<TrackingEvent[]> {
    let query: FirebaseFirestore.Query = this.db.collection('events');
    if (projectId) {
      query = query.where('projectId', '==', projectId);
    }
    const snap = await query.orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map(d => d.data() as TrackingEvent);
  }

  async createEvent(event: TrackingEvent): Promise<TrackingEvent> {
    await this.db.collection('events').doc(event.id).set(event);
    return event;
  }

  async getUser(uid: string): Promise<AdminUser | null> {
    const doc = await this.db.collection('users').doc(uid).get();
    if (doc.exists) return doc.data() as AdminUser;
    return null;
  }

  async atomicCreateOrder(
    projectId: string,
    idempotencyKey: string | undefined,
    orderFactory: () => Order
  ): Promise<{ isReplay: boolean; order: Order }> {
    if (!idempotencyKey) {
      const order = orderFactory();
      await this.createOrder(order);
      return { isReplay: false, order };
    }

    const resId = getReservationId(projectId, 'order', idempotencyKey);
    const resRef = this.db.collection('idempotency').doc(resId);

    return await this.db.runTransaction(async (transaction) => {
      const resDoc = await transaction.get(resRef);
      if (resDoc.exists) {
        const data = resDoc.data();
        if (data?.status === 'completed' && data?.entityId) {
          const existingDoc = await transaction.get(this.db.collection('orders').doc(data.entityId));
          if (existingDoc.exists) {
            return { isReplay: true, order: existingDoc.data() as Order };
          }
        }
      }

      const newOrder = orderFactory();
      transaction.set(this.db.collection('orders').doc(newOrder.id), newOrder);
      transaction.set(resRef, {
        id: resId,
        projectId,
        entityType: 'order',
        idempotencyKey,
        entityId: newOrder.id,
        humanId: newOrder.orderId,
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      return { isReplay: false, order: newOrder };
    });
  }

  async atomicCreateLead(
    projectId: string,
    idempotencyKey: string | undefined,
    leadFactory: () => Lead
  ): Promise<{ isReplay: boolean; lead: Lead }> {
    if (!idempotencyKey) {
      const lead = leadFactory();
      await this.createLead(lead);
      return { isReplay: false, lead };
    }

    const resId = getReservationId(projectId, 'lead', idempotencyKey);
    const resRef = this.db.collection('idempotency').doc(resId);

    return await this.db.runTransaction(async (transaction) => {
      const resDoc = await transaction.get(resRef);
      if (resDoc.exists) {
        const data = resDoc.data();
        if (data?.status === 'completed' && data?.entityId) {
          const existingDoc = await transaction.get(this.db.collection('leads').doc(data.entityId));
          if (existingDoc.exists) {
            return { isReplay: true, lead: existingDoc.data() as Lead };
          }
        }
      }

      const newLead = leadFactory();
      transaction.set(this.db.collection('leads').doc(newLead.id), newLead);
      transaction.set(resRef, {
        id: resId,
        projectId,
        entityType: 'lead',
        idempotencyKey,
        entityId: newLead.id,
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      return { isReplay: false, lead: newLead };
    });
  }

  async atomicCreateCustomSubmission(
    projectId: string,
    idempotencyKey: string | undefined,
    submissionFactory: () => CustomSubmission
  ): Promise<{ isReplay: boolean; submission: CustomSubmission }> {
    if (!idempotencyKey) {
      const sub = submissionFactory();
      await this.createCustomSubmission(sub);
      return { isReplay: false, submission: sub };
    }

    const resId = getReservationId(projectId, 'custom', idempotencyKey);
    const resRef = this.db.collection('idempotency').doc(resId);

    return await this.db.runTransaction(async (transaction) => {
      const resDoc = await transaction.get(resRef);
      if (resDoc.exists) {
        const data = resDoc.data();
        if (data?.status === 'completed' && data?.entityId) {
          const existingDoc = await transaction.get(this.db.collection('customSubmissions').doc(data.entityId));
          if (existingDoc.exists) {
            return { isReplay: true, submission: existingDoc.data() as CustomSubmission };
          }
        }
      }

      const newSub = submissionFactory();
      transaction.set(this.db.collection('customSubmissions').doc(newSub.id), newSub);
      transaction.set(resRef, {
        id: resId,
        projectId,
        entityType: 'custom',
        idempotencyKey,
        entityId: newSub.id,
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      return { isReplay: false, submission: newSub };
    });
  }

  async resetSeed(): Promise<void> {
    const batch = this.db.batch();

    for (const p of INITIAL_SEED_DATA.projects) {
      batch.set(this.db.collection('projects').doc(p.id), p);
    }
    for (const lp of INITIAL_SEED_DATA.landingPages) {
      batch.set(this.db.collection('landingPages').doc(lp.id), lp);
    }
    for (const f of INITIAL_SEED_DATA.forms) {
      batch.set(this.db.collection('forms').doc(f.id), f);
    }
    for (const l of INITIAL_SEED_DATA.leads) {
      batch.set(this.db.collection('leads').doc(l.id), l);
    }
    for (const o of INITIAL_SEED_DATA.orders) {
      batch.set(this.db.collection('orders').doc(o.id), o);
    }
    for (const e of INITIAL_SEED_DATA.events) {
      batch.set(this.db.collection('events').doc(e.id), e);
    }
    for (const u of INITIAL_SEED_DATA.users) {
      batch.set(this.db.collection('users').doc(u.uid), u);
    }

    await batch.commit();
  }
}

/**
 * In-Memory DataStore implementation
 * Used for hermetic offline testing with concurrent reservation locks.
 * Does NOT touch filesystem.
 */
class MemoryDataStore implements DataStore {
  private projects: Project[] = [];
  private landingPages: LandingPage[] = [];
  private forms: FormDefinition[] = [];
  private leads: Lead[] = [];
  private orders: Order[] = [];
  private customSubmissions: CustomSubmission[] = [];
  private events: TrackingEvent[] = [];
  private users: AdminUser[] = [];

  // Idempotency registry and concurrency mutexes for testing race conditions
  private idempotencyRegistry = new Map<string, { entityId: string; record: any }>();
  private inFlightLocks = new Map<string, Promise<any>>();

  constructor() {
    this.resetSeedSync();
  }

  private resetSeedSync() {
    this.projects = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.projects));
    this.landingPages = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.landingPages));
    this.forms = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.forms));
    this.leads = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.leads));
    this.orders = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.orders));
    this.customSubmissions = [];
    this.events = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.events));
    this.users = JSON.parse(JSON.stringify(INITIAL_SEED_DATA.users));
    this.idempotencyRegistry.clear();
    this.inFlightLocks.clear();
  }

  async getProjects(): Promise<Project[]> {
    return [...this.projects];
  }

  async getProject(id: string): Promise<Project | null> {
    return this.projects.find(p => p.id === id || p.code.toLowerCase() === id.toLowerCase()) || null;
  }

  async createProject(project: Project): Promise<Project> {
    this.projects.push(project);
    return project;
  }

  async getLandingPages(projectId?: string): Promise<LandingPage[]> {
    if (projectId) return this.landingPages.filter(l => l.projectId === projectId);
    return [...this.landingPages];
  }

  async getLandingPage(id: string): Promise<LandingPage | null> {
    return this.landingPages.find(l => l.id === id) || null;
  }

  async createLandingPage(lp: LandingPage): Promise<LandingPage> {
    this.landingPages.push(lp);
    return lp;
  }

  async getForms(projectId?: string, landingPageId?: string): Promise<FormDefinition[]> {
    return this.forms.filter(f => {
      if (projectId && f.projectId !== projectId) return false;
      if (landingPageId && f.landingPageId !== landingPageId) return false;
      return true;
    });
  }

  async getForm(id: string): Promise<FormDefinition | null> {
    return this.forms.find(f => f.id === id) || null;
  }

  async createForm(form: FormDefinition): Promise<FormDefinition> {
    this.forms.push(form);
    return form;
  }

  async getLeads(projectId?: string): Promise<Lead[]> {
    if (projectId) return this.leads.filter(l => l.projectId === projectId);
    return [...this.leads];
  }

  async createLead(lead: Lead): Promise<Lead> {
    this.leads.unshift(lead);
    return lead;
  }

  async findLeadByIdempotency(key: string, projectId: string): Promise<Lead | null> {
    return (
      this.leads.find(
        l => l.projectId === projectId && (l.idempotencyKey === key || l.submissionId === key)
      ) || null
    );
  }

  async getOrders(projectId?: string): Promise<Order[]> {
    if (projectId) return this.orders.filter(o => o.projectId === projectId);
    return [...this.orders];
  }

  async getOrder(idOrCode: string): Promise<Order | null> {
    return this.orders.find(o => o.id === idOrCode || o.orderId === idOrCode) || null;
  }

  async createOrder(order: Order): Promise<Order> {
    this.orders.unshift(order);
    return order;
  }

  async findOrderByIdempotency(key: string, projectId: string): Promise<Order | null> {
    return (
      this.orders.find(
        o => o.projectId === projectId && (o.idempotencyKey === key || o.submissionId === key)
      ) || null
    );
  }

  async updateOrderStatus(idOrCode: string, orderStatus?: string, paymentStatus?: string): Promise<Order | null> {
    const order = this.orders.find(o => o.id === idOrCode || o.orderId === idOrCode);
    if (!order) return null;
    if (orderStatus) order.orderStatus = orderStatus as any;
    if (paymentStatus) order.paymentStatus = paymentStatus as any;
    order.updatedAt = new Date().toISOString();
    return order;
  }

  async createCustomSubmission(sub: CustomSubmission): Promise<CustomSubmission> {
    this.customSubmissions.unshift(sub);
    return sub;
  }

  async findCustomSubmissionByIdempotency(key: string, projectId: string): Promise<CustomSubmission | null> {
    return (
      this.customSubmissions.find(
        s => s.projectId === projectId && (s.idempotencyKey === key || s.submissionId === key)
      ) || null
    );
  }

  async getEvents(limit = 100, projectId?: string): Promise<TrackingEvent[]> {
    let evts = this.events;
    if (projectId) evts = evts.filter(e => e.projectId === projectId);
    return evts.slice(0, limit);
  }

  async createEvent(event: TrackingEvent): Promise<TrackingEvent> {
    this.events.unshift(event);
    if (this.events.length > 5000) {
      this.events = this.events.slice(0, 5000);
    }
    return event;
  }

  async getUser(uid: string): Promise<AdminUser | null> {
    return this.users.find(u => u.uid === uid) || null;
  }

  async atomicCreateOrder(
    projectId: string,
    idempotencyKey: string | undefined,
    orderFactory: () => Order
  ): Promise<{ isReplay: boolean; order: Order }> {
    if (!idempotencyKey) {
      const order = orderFactory();
      this.orders.unshift(order);
      return { isReplay: false, order };
    }

    const resId = getReservationId(projectId, 'order', idempotencyKey);

    // Mutual exclusion lock for concurrent calls
    while (this.inFlightLocks.has(resId)) {
      await this.inFlightLocks.get(resId);
    }

    // Check if already reserved and created
    if (this.idempotencyRegistry.has(resId)) {
      const existing = this.idempotencyRegistry.get(resId)!;
      return { isReplay: true, order: existing.record as Order };
    }

    // Acquire lock
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inFlightLocks.set(resId, lockPromise);

    try {
      const order = orderFactory();
      this.orders.unshift(order);
      this.idempotencyRegistry.set(resId, { entityId: order.id, record: order });
      return { isReplay: false, order };
    } finally {
      this.inFlightLocks.delete(resId);
      resolveLock();
    }
  }

  async atomicCreateLead(
    projectId: string,
    idempotencyKey: string | undefined,
    leadFactory: () => Lead
  ): Promise<{ isReplay: boolean; lead: Lead }> {
    if (!idempotencyKey) {
      const lead = leadFactory();
      this.leads.unshift(lead);
      return { isReplay: false, lead };
    }

    const resId = getReservationId(projectId, 'lead', idempotencyKey);

    while (this.inFlightLocks.has(resId)) {
      await this.inFlightLocks.get(resId);
    }

    if (this.idempotencyRegistry.has(resId)) {
      const existing = this.idempotencyRegistry.get(resId)!;
      return { isReplay: true, lead: existing.record as Lead };
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inFlightLocks.set(resId, lockPromise);

    try {
      const lead = leadFactory();
      this.leads.unshift(lead);
      this.idempotencyRegistry.set(resId, { entityId: lead.id, record: lead });
      return { isReplay: false, lead };
    } finally {
      this.inFlightLocks.delete(resId);
      resolveLock();
    }
  }

  async atomicCreateCustomSubmission(
    projectId: string,
    idempotencyKey: string | undefined,
    submissionFactory: () => CustomSubmission
  ): Promise<{ isReplay: boolean; submission: CustomSubmission }> {
    if (!idempotencyKey) {
      const sub = submissionFactory();
      this.customSubmissions.unshift(sub);
      return { isReplay: false, submission: sub };
    }

    const resId = getReservationId(projectId, 'custom', idempotencyKey);

    while (this.inFlightLocks.has(resId)) {
      await this.inFlightLocks.get(resId);
    }

    if (this.idempotencyRegistry.has(resId)) {
      const existing = this.idempotencyRegistry.get(resId)!;
      return { isReplay: true, submission: existing.record as CustomSubmission };
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.inFlightLocks.set(resId, lockPromise);

    try {
      const sub = submissionFactory();
      this.customSubmissions.unshift(sub);
      this.idempotencyRegistry.set(resId, { entityId: sub.id, record: sub });
      return { isReplay: false, submission: sub };
    } finally {
      this.inFlightLocks.delete(resId);
      resolveLock();
    }
  }

  async resetSeed(): Promise<void> {
    this.resetSeedSync();
  }
}

// Select datastore implementation:
const useMemoryStub =
  process.env.USE_FIRESTORE_MEMORY_STUB === 'true' ||
  (process.env.NODE_ENV === 'test' && !process.env.FIRESTORE_EMULATOR_HOST && !process.env.USE_LIVE_FIRESTORE);

export const dataStore: DataStore = useMemoryStub ? new MemoryDataStore() : new FirestoreDataStore();
