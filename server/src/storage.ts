import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');

export interface ServerDatabase {
  projects: any[];
  landingPages: any[];
  forms: any[];
  leads: any[];
  orders: any[];
  customSubmissions: any[];
  events: any[];
  users: any[];
}

// Initial rich seed data with ABANO and Genki Fami
const INITIAL_SEED_DATA: ServerDatabase = {
  projects: [
    {
      id: 'abano',
      name: 'ABANO Wellness',
      code: 'ABANO',
      status: 'active',
      allowedDomains: ['abano.vn', 'localhost:5173', 'localhost:3000'],
      description: 'Mỹ phẩm & Chăm sóc da hữu cơ cao cấp',
      createdAt: '2026-08-01T08:00:00Z',
      updatedAt: '2026-09-01T08:00:00Z'
    },
    {
      id: 'genki-fami',
      name: 'Genki Fami',
      code: 'GENKI',
      status: 'active',
      allowedDomains: ['genkifami.vn', 'localhost:5173'],
      description: 'Thực phẩm bảo vệ sức khoẻ tiêu chuẩn Nhật Bản',
      createdAt: '2026-08-10T09:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z'
    },
    {
      id: 'balancera',
      name: 'Balancera',
      code: 'BALANCERA',
      status: 'active',
      allowedDomains: ['balancera.com'],
      description: 'Dinh dưỡng cân bằng & Fitness',
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z'
    },
    {
      id: 'huma-medical',
      name: 'Huma Medical',
      code: 'HUMA',
      status: 'active',
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
      status: 'active',
      description: 'Landing page chiến dịch mùa thu, ưu đãi tặng kèm toner',
      createdAt: '2026-08-05T09:00:00Z',
      updatedAt: '2026-09-01T10:00:00Z'
    },
    {
      id: 'abano-freesample',
      projectId: 'abano',
      name: 'Đăng Ký Nhận Mẫu Thử Miễn Phí',
      url: 'https://abano.vn/free-sample',
      status: 'active',
      description: 'Landing page phễu thu thập lead nhận kit 3 ngày',
      createdAt: '2026-08-12T09:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z'
    },
    {
      id: 'genki-marine-collagen',
      projectId: 'genki-fami',
      name: 'Marine Collagen Peptide 5000mg',
      url: 'https://genkifami.vn/collagen-peptide',
      status: 'active',
      description: 'Landing page bán hàng trực tiếp hộp 30 gói',
      createdAt: '2026-08-15T09:00:00Z',
      updatedAt: '2026-09-03T10:00:00Z'
    },
    {
      id: 'genki-health-check',
      projectId: 'genki-fami',
      name: 'Trắc Nghiệm Sức Khỏe Tuổi 40+',
      url: 'https://genkifami.vn/health-quiz',
      status: 'active',
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
      type: 'lead',
      status: 'active',
      version: 1,
      fields: [
        { key: 'name', label: 'Họ và tên', type: 'text', required: true },
        { key: 'phone', label: 'Số điện thoại', type: 'phone', required: true },
        { key: 'email', label: 'Email', type: 'email', required: false },
        { key: 'skinType', label: 'Loại da hiện tại', type: 'select', required: true, options: ['Da dầu', 'Da khô', 'Da nhạy cảm', 'Hỗn hợp'] }
      ],
      createdAt: '2026-08-12T10:00:00Z',
      updatedAt: '2026-08-12T10:00:00Z'
    },
    {
      id: 'abano-order-form-01',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      name: 'Form Đặt Mua Serum Flash Sale',
      type: 'order',
      status: 'active',
      version: 2,
      fields: [
        { key: 'name', label: 'Người nhận hàng', type: 'text', required: true },
        { key: 'phone', label: 'Số điện thoại nhận hàng', type: 'phone', required: true },
        { key: 'address', label: 'Địa chỉ giao hàng', type: 'text', required: true },
        { key: 'note', label: 'Ghi chú giao hàng', type: 'textarea', required: false }
      ],
      createdAt: '2026-08-05T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z'
    },
    {
      id: 'genki-order-form-01',
      projectId: 'genki-fami',
      landingPageId: 'genki-marine-collagen',
      name: 'Form Đặt Mua Collagen Nhật Bản',
      type: 'order',
      status: 'active',
      version: 1,
      fields: [
        { key: 'name', label: 'Họ tên', type: 'text', required: true },
        { key: 'phone', label: 'Điện thoại', type: 'phone', required: true },
        { key: 'address', label: 'Địa chỉ nhận hàng', type: 'text', required: true }
      ],
      createdAt: '2026-08-15T10:00:00Z',
      updatedAt: '2026-08-15T10:00:00Z'
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
      subtotal: 1180000,
      total: 1180000,
      currency: 'VND',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'confirmed',
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
      subtotal: 2550000,
      total: 2550000,
      currency: 'VND',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      orderStatus: 'processing',
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
      eventName: 'page_view',
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
      eventName: 'cta_click',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      metadata: { buttonId: 'buy_now_hero' },
      timestamp: '2026-09-05T16:21:15Z'
    },
    {
      id: 'evt-003',
      eventName: 'form_start',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      timestamp: '2026-09-05T16:22:00Z'
    },
    {
      id: 'evt-004',
      eventName: 'form_submit',
      projectId: 'abano',
      landingPageId: 'abano-serum-promo',
      formId: 'abano-order-form-01',
      visitorId: 'v_test1',
      sessionId: 's_test1',
      timestamp: '2026-09-05T16:29:55Z'
    },
    {
      id: 'evt-005',
      eventName: 'order_created',
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
      role: 'super_admin',
      createdAt: '2026-08-01T00:00:00Z'
    },
    {
      uid: 'user-abano',
      email: 'abano.admin@landinghub.aiwf',
      displayName: 'ABANO Manager',
      role: 'project_admin',
      projectIds: ['abano'],
      createdAt: '2026-08-01T00:00:00Z'
    },
    {
      uid: 'user-viewer',
      email: 'viewer@landinghub.aiwf',
      displayName: 'Guest Viewer',
      role: 'viewer',
      createdAt: '2026-08-01T00:00:00Z'
    }
  ]
};

class StorageEngine {
  private data: ServerDatabase;

  constructor() {
    this.data = this.load();
  }

  private load(): ServerDatabase {
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[StorageEngine] Failed to read db.json, using memory default', e);
    }
    this.save(INITIAL_SEED_DATA);
    return INITIAL_SEED_DATA;
  }

  public save(data?: ServerDatabase) {
    if (data) this.data = data;
    try {
      const dir = path.dirname(DB_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[StorageEngine] Error saving to db.json', e);
    }
  }

  public getDb(): ServerDatabase {
    return this.data;
  }

  public resetSeed() {
    this.data = JSON.parse(JSON.stringify(INITIAL_SEED_DATA));
    this.save();
    return this.data;
  }

  // Insert methods with validation
  public insertEvent(event: any) {
    this.data.events.unshift(event);
    // Keep max 5000 events in memory
    if (this.data.events.length > 5000) {
      this.data.events = this.data.events.slice(0, 5000);
    }
    this.save();
    return event;
  }

  public insertLead(lead: any) {
    this.data.leads.unshift(lead);
    this.save();
    return lead;
  }

  public insertOrder(order: any) {
    this.data.orders.unshift(order);
    this.save();
    return order;
  }

  public insertCustomSubmission(submission: any) {
    this.data.customSubmissions.unshift(submission);
    this.save();
    return submission;
  }

  public updateOrderStatus(id: string, orderStatus?: string, paymentStatus?: string) {
    const order = this.data.orders.find(o => o.id === id || o.orderId === id);
    if (!order) return null;
    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    this.save();
    return order;
  }

  public insertProject(project: any) {
    this.data.projects.push(project);
    this.save();
    return project;
  }

  public insertLandingPage(lp: any) {
    this.data.landingPages.push(lp);
    this.save();
    return lp;
  }

  public insertForm(form: any) {
    this.data.forms.push(form);
    this.save();
    return form;
  }
}

export const dbStorage = new StorageEngine();
