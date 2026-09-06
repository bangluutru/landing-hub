import React, { useState } from 'react';
import { Shield, Check, Copy, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { currentUser, role, switchDemoRole } = useAuth();

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const cdnCode = `<!-- 1. Nhúng Landing Hub SDK vào Landing Page của bạn -->
<script src="${window.location.origin}/sdk/lphub.js"></script>`;

  const initCode = `// 2. Khởi tạo SDK trong file JS của landing page
LPHub.init({
  projectId: 'abano',               // ID của project
  landingPageId: 'abano-serum-promo',// ID của landing page
  apiUrl: '${window.location.origin}' // URL của Landing Hub API
});`;

  const trackCode = `// 3. Theo dõi sự kiện tùy chỉnh (CTA Click, Scroll, Video Play...)
LPHub.track('cta_click', {
  buttonId: 'btn-buy-now',
  package: 'combo_2_bottles'
});`;

  const leadCode = `// 4. Gửi Lead form đăng ký tư vấn
LPHub.submitLead({
  formId: 'abano-lead-form-01',
  name: 'Nguyễn Thị Mai',
  phone: '0912345678',
  email: 'mai@gmail.com',
  data: {
    skinType: 'Da nhạy cảm',
    note: 'Cần tư vấn trước 17h'
  }
});`;

  const orderCode = `// 5. Gửi đơn đặt hàng (Order Submission)
LPHub.submitOrder({
  formId: 'abano-order-form-01',
  customer: {
    name: 'Trần Văn Minh',
    phone: '0987654321',
    address: '123 Nguyễn Huệ, Q1, TP.HCM'
  },
  items: [
    { name: 'Serum Phục Hồi Botanical 50ml', quantity: 2, price: 590000 }
  ],
  total: 1180000,
  currency: 'VND',
  paymentMethod: 'cod' // cod | bank_transfer
});`;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Cài Đặt & Hướng Dẫn Tích Hợp</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tài liệu chuẩn hóa Landing Hub SDK và thông số kỹ thuật cho developer tích hợp
        </p>
      </div>

      {/* User Session & Role Overview */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Tài Khoản Quản Trị Hiện Tại</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Email</span>
            <span className="font-bold text-slate-900">{currentUser?.email}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Vai trò (Role)</span>
            <span className="font-bold uppercase text-indigo-600 font-mono">{role.replace('_', ' ')}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-400 block text-[10px]">Quyền truy cập</span>
            <span className="font-semibold text-slate-800">
              {role === 'super_admin' ? 'Tất cả projects (Super Admin)' :
               role === 'project_admin' ? 'ABANO Wellness' : 'Read-only (Chỉ xem)'}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Chuyển đổi vai trò để kiểm thử phân quyền:</span>
          <div className="flex gap-2">
            <button
              onClick={() => switchDemoRole('super_admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                role === 'super_admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Super Admin
            </button>
            <button
              onClick={() => switchDemoRole('project_admin', ['abano'])}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                role === 'project_admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Project Admin (ABANO)
            </button>
            <button
              onClick={() => switchDemoRole('viewer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                role === 'viewer' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Viewer (Read-only)
            </button>
          </div>
        </div>
      </div>

      {/* Integration Guide Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Hướng Dẫn Tích Hợp Landing Hub SDK</h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Landing Hub SDK là thư viện JavaScript thuần (Vanilla JS), độc lập framework và siêu nhẹ (&lt; 5KB).
          Tương thích với mọi landing page dựng bằng <strong>Figma to HTML</strong>, <strong>Google Stitch</strong>, <strong>Webflow</strong>, <strong>React</strong>, <strong>Vue</strong> hoặc code tay.
        </p>

        {/* Step 1: Script Tag */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Bước 1: Chèn Script vào thẻ &lt;head&gt; hoặc &lt;body&gt;</span>
            <button
              onClick={() => copyText(cdnCode, 'step1')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
            >
              {copiedSnippet === 'step1' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'step1' ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-emerald-400 text-xs font-mono rounded-lg overflow-x-auto">
            {cdnCode}
          </pre>
        </div>

        {/* Step 2: Init */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Bước 2: Khởi tạo SDK (LPHub.init)</span>
            <button
              onClick={() => copyText(initCode, 'step2')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
            >
              {copiedSnippet === 'step2' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'step2' ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg overflow-x-auto">
            {initCode}
          </pre>
        </div>

        {/* Step 3: Event Tracking */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Bước 3: Ghi nhận sự kiện (LPHub.track)</span>
            <button
              onClick={() => copyText(trackCode, 'step3')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
            >
              {copiedSnippet === 'step3' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'step3' ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg overflow-x-auto">
            {trackCode}
          </pre>
        </div>

        {/* Step 4: Submit Lead */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Bước 4: Nộp Lead Tư Vấn (LPHub.submitLead)</span>
            <button
              onClick={() => copyText(leadCode, 'step4')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
            >
              {copiedSnippet === 'step4' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'step4' ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg overflow-x-auto">
            {leadCode}
          </pre>
        </div>

        {/* Step 5: Submit Order */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Bước 5: Tạo đơn mua hàng (LPHub.submitOrder)</span>
            <button
              onClick={() => copyText(orderCode, 'step5')}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
            >
              {copiedSnippet === 'step5' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === 'step5' ? 'Đã copy' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg overflow-x-auto">
            {orderCode}
          </pre>
        </div>
      </div>
    </div>
  );
};
