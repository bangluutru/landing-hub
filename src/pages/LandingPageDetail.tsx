import React, { useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Code2,
  Copy,
  Check,
  Users,
  ShoppingCart,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { StatCard } from '../components/common/StatCard';
import { formatVnd, formatDate } from '../lib/utils';

interface LandingPageDetailProps {
  lpId: string;
  onBack: () => void;
}

export const LandingPageDetail: React.FC<LandingPageDetailProps> = ({ lpId, onBack }) => {
  const { landingPages, projects, forms, leads, orders, events } = useProjects();
  const [activeTab, setActiveTab] = useState<'overview' | 'forms' | 'events' | 'leads' | 'orders' | 'analytics'>('overview');
  const [copied, setCopied] = useState(false);

  const lp = landingPages.find(l => l.id === lpId);
  const project = projects.find(p => p.id === lp?.projectId);

  if (!lp) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-sm text-slate-500">Không tìm thấy Landing Page.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg">
          Quay lại danh sách
        </button>
      </div>
    );
  }

  // Filtered data for this LP
  const lpForms = forms.filter(f => f.landingPageId === lp.id);
  const lpEvents = events.filter(e => e.landingPageId === lp.id);
  const lpLeads = leads.filter(l => l.landingPageId === lp.id);
  const lpOrders = orders.filter(o => o.landingPageId === lp.id);

  const visitors = Math.max(
    new Set(lpEvents.filter(e => e.visitorId && e.eventName === 'page_view').map(e => e.visitorId)).size,
    lpEvents.filter(e => e.eventName === 'page_view').length
  );
  const validOrders = lpOrders.filter(o => o.orderStatus !== 'cancelled');
  const revenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const cvr = visitors > 0 ? ((lpOrders.length + lpLeads.length) / visitors) * 100 : 0;

  // Funnel steps for analytics
  const pageViews = lpEvents.filter(e => e.eventName === 'page_view').length;
  const ctaClicks = lpEvents.filter(e => e.eventName === 'cta_click').length;
  const formStarts = lpEvents.filter(e => e.eventName === 'form_start').length;
  const formSubmits = lpEvents.filter(e => e.eventName === 'form_submit').length + lpLeads.length;
  const orderCount = lpOrders.length;

  const sdkSnippet = `<!-- 1. Nhúng AIWF LP SDK vào Landing Page -->
<script src="${window.location.origin}/sdk/lphub.js"></script>
<script>
  // 2. Khởi tạo SDK
  LPHub.init({
    projectId: '${lp.projectId}',
    landingPageId: '${lp.id}',
    apiUrl: '${window.location.origin}'
  });

  // 3. Theo dõi CTA Click
  document.getElementById('my-buy-button').addEventListener('click', function() {
    LPHub.track('cta_click', { buttonId: 'my-buy-button' });
  });
</script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(sdkSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header & Back */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách Landing Pages
        </button>

        <a
          href={lp.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <span>Mở URL thực tế</span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </a>
      </div>

      {/* Main Title Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                {project?.code || lp.projectId}
              </span>
              <StatusBadge status={lp.status} type="lp" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">{lp.name}</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="font-mono text-slate-400">ID: {lp.id}</span>
              <span>•</span>
              <span className="truncate max-w-md">{lp.url}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Doanh thu</div>
              <div className="text-lg font-bold text-emerald-600">{formatVnd(revenue)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Conversion Rate</div>
              <div className="text-lg font-bold text-indigo-600">{cvr.toFixed(1)}%</div>
            </div>
          </div>
        </div>

        {/* Subtabs Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'overview', label: 'Tổng quan & SDK' },
            { id: 'forms', label: `Forms (${lpForms.length})` },
            { id: 'leads', label: `Leads (${lpLeads.length})` },
            { id: 'orders', label: `Orders (${lpOrders.length})` },
            { id: 'events', label: `Events (${lpEvents.length})` },
            { id: 'analytics', label: 'Funnel Analytics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Visitors" value={visitors} subtext="Khách truy cập" icon={<Users className="w-4 h-4 text-blue-600" />} />
            <StatCard title="Leads" value={lpLeads.length} subtext="Form đăng ký" icon={<FileSpreadsheet className="w-4 h-4 text-amber-600" />} />
            <StatCard title="Orders" value={lpOrders.length} subtext="Đơn mua hàng" icon={<ShoppingCart className="w-4 h-4 text-emerald-600" />} />
            <StatCard title="Doanh thu" value={formatVnd(revenue)} subtext="Tổng thu" icon={<DollarSign className="w-4 h-4 text-emerald-700" />} />
          </div>

          {/* SDK Integration Box */}
          <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Mã Tích Hợp AIWF LP SDK Cho Landing Page Này
                </h3>
              </div>
              <button
                onClick={copySnippet}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Đã sao chép' : 'Copy code'}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 text-emerald-400 text-xs font-mono overflow-x-auto border border-slate-800">
              {sdkSnippet}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 2: Forms */}
      {activeTab === 'forms' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Forms Được Khai Báo Cho Landing Page Này</h3>
          {lpForms.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Chưa có form nào được gắn với Landing Page này.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lpForms.map(f => (
                <div key={f.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-900">{f.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700">
                      {f.type}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mb-3">ID: {f.id} (v{f.version})</div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Cấu trúc Fields:</div>
                    <div className="flex flex-wrap gap-1">
                      {f.fields.map(fld => (
                        <span key={fld.key} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] text-slate-700">
                          {fld.label} {fld.required && <strong className="text-rose-500">*</strong>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Leads */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Chiến dịch / Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lpLeads.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Chưa có lead nào từ trang này.</td></tr>
              ) : (
                lpLeads.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500">{formatDate(l.createdAt)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{l.name || '-'}</td>
                    <td className="py-3 px-4 font-semibold text-indigo-600">{l.phone || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{l.email || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                        {l.utmSource || 'direct'} / {l.utmCampaign || 'organic'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Orders */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Mã Đơn</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-4 text-right">Tổng tiền</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lpOrders.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Chưa có đơn hàng nào từ trang này.</td></tr>
              ) : (
                lpOrders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.orderId}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{formatDate(o.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{o.customer?.name}</div>
                      <div className="text-[11px] text-slate-500">{o.customer?.phone}</div>
                    </td>
                    <td className="py-3 px-4">
                      {o.items?.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {formatVnd(o.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={o.orderStatus} type="order" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Events */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Event Interaction Stream</h3>
            <span className="text-xs text-slate-500">{lpEvents.length} events ghi nhận</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Name</th>
                <th className="py-3 px-4">Visitor / Session ID</th>
                <th className="py-3 px-4">Metadata</th>
                <th className="py-3 px-4">UTM Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lpEvents.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Chưa có event nào được ghi nhận.</td></tr>
              ) : (
                lpEvents.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-500">{formatDate(e.timestamp)}</td>
                    <td className="py-2.5 px-4 font-bold text-indigo-600">
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                        {e.eventName}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                      {e.visitorId || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 text-[11px] max-w-xs truncate">
                      {JSON.stringify(e.metadata || {})}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-[11px]">
                      {e.utmSource || 'direct'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 6: Analytics Funnel */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-900">Phễu Chuyển Đổi Chi Tiết (Conversion Funnel)</h3>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { step: '1. Page View', count: pageViews, color: 'bg-blue-500' },
              { step: '2. CTA Click', count: ctaClicks, color: 'bg-indigo-500' },
              { step: '3. Form Start', count: formStarts, color: 'bg-purple-500' },
              { step: '4. Form Submit', count: formSubmits, color: 'bg-amber-500' },
              { step: '5. Order Created', count: orderCount, color: 'bg-emerald-600' }
            ].map((st, idx) => {
              const prev = idx === 0 ? pageViews : [pageViews, ctaClicks, formStarts, formSubmits][idx - 1];
              const pct = prev > 0 ? ((st.count / prev) * 100).toFixed(1) : '0';
              return (
                <div key={st.step} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-slate-600 mb-1">{st.step}</div>
                    <div className="text-2xl font-black text-slate-900">{st.count}</div>
                  </div>
                  <div className="mt-4 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 flex justify-between items-center">
                    <span>{idx === 0 ? 'Tổng view' : 'Chuyển đổi:'}</span>
                    <span className="font-bold text-slate-700">{idx === 0 ? '100%' : `${pct}%`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
