import React, { useState } from 'react';
import { Users, DollarSign, TrendingUp, Compass, Target } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { StatCard } from '../components/common/StatCard';
import { formatVnd } from '../lib/utils';

export const Analytics: React.FC = () => {
  const {
    projects,
    filteredLandingPages,
    filteredLeads,
    filteredOrders,
    filteredEvents,
    selectedProjectId,
    setSelectedProjectId,
    selectedLpId,
    setSelectedLpId
  } = useProjects();

  const [utmSourceFilter, setUtmSourceFilter] = useState<string>('all');

  // Filter events based on active filters
  const events = filteredEvents.filter(e => {
    if (utmSourceFilter !== 'all' && e.utmSource !== utmSourceFilter) return false;
    return true;
  });

  const leads = filteredLeads.filter(l => {
    if (utmSourceFilter !== 'all' && l.utmSource !== utmSourceFilter) return false;
    return true;
  });

  const orders = filteredOrders.filter(o => {
    if (utmSourceFilter !== 'all' && o.utmSource !== utmSourceFilter) return false;
    return true;
  });

  // Funnel steps calculation
  const pageViews = events.filter(e => e.eventName === 'page_view').length;
  const ctaClicks = events.filter(e => e.eventName === 'cta_click').length;
  const formStarts = events.filter(e => e.eventName === 'form_start').length;
  const formSubmits = events.filter(e => e.eventName === 'form_submit').length + leads.length;
  const ordersCreated = orders.length;

  const validOrders = orders.filter(o => o.orderStatus !== 'cancelled');
  const revenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const conversionRate = pageViews > 0 ? ((ordersCreated + leads.length) / pageViews) * 100 : 0;

  // UTM Sources Aggregation
  const utmMap: Record<string, { visitors: number; leads: number; orders: number; revenue: number }> = {};

  events.forEach(e => {
    const src = e.utmSource || 'direct';
    if (!utmMap[src]) utmMap[src] = { visitors: 0, leads: 0, orders: 0, revenue: 0 };
    if (e.eventName === 'page_view') utmMap[src].visitors++;
  });

  leads.forEach(l => {
    const src = l.utmSource || 'direct';
    if (!utmMap[src]) utmMap[src] = { visitors: 0, leads: 0, orders: 0, revenue: 0 };
    utmMap[src].leads++;
  });

  orders.forEach(o => {
    const src = o.utmSource || 'direct';
    if (!utmMap[src]) utmMap[src] = { visitors: 0, leads: 0, orders: 0, revenue: 0 };
    utmMap[src].orders++;
    if (o.orderStatus !== 'cancelled') {
      utmMap[src].revenue += o.total || 0;
    }
  });

  const utmSourcesList = Object.keys(utmMap);

  const funnelStages = [
    { title: 'Page View', count: pageViews, desc: 'Lượt mở trang đích' },
    { title: 'CTA Click', count: ctaClicks, desc: 'Bấm nút mua / đăng ký' },
    { title: 'Form Start', count: formStarts, desc: 'Bắt đầu điền thông tin' },
    { title: 'Form Submit', count: formSubmits, desc: 'Gửi lead hoặc đơn' },
    { title: 'Order Created', count: ordersCreated, desc: 'Đơn hàng thành công' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedLpId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">Tất cả Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Landing Page</label>
            <select
              value={selectedLpId}
              onChange={(e) => setSelectedLpId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">Tất cả Landing Pages</option>
              {filteredLandingPages.map(lp => (
                <option key={lp.id} value={lp.id}>{lp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Kênh UTM Source</label>
            <select
              value={utmSourceFilter}
              onChange={(e) => setUtmSourceFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
            >
              <option value="all">Tất cả kênh (All)</option>
              {utmSourcesList.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Chỉ số chuyển đổi được đo đạc từ sự kiện thực
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Page Views" value={pageViews} subtext="Lượt xem trang" icon={<Users className="w-4 h-4 text-blue-600" />} />
        <StatCard title="CTA Clicks" value={ctaClicks} subtext="Lượt click kêu gọi" icon={<Compass className="w-4 h-4 text-indigo-600" />} />
        <StatCard title="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} subtext="(Leads + Orders) / Views" icon={<TrendingUp className="w-4 h-4 text-purple-600" />} />
        <StatCard title="Doanh Thu" value={formatVnd(revenue)} subtext="Tổng giá trị đơn" icon={<DollarSign className="w-4 h-4 text-emerald-600" />} />
      </div>

      {/* Conversion Funnel Visualization */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Phễu Chuyển Đổi (Full Funnel)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tỷ lệ rơi rụng qua từng bước: Xem trang → Bấm CTA → Mở form → Nộp form → Tạo đơn hàng
          </p>
        </div>

        <div className="space-y-3">
          {funnelStages.map((stage, idx) => {
            const maxVal = Math.max(pageViews, 1);
            const widthPct = Math.max((stage.count / maxVal) * 100, stage.count > 0 ? 6 : 2);
            const prevCount = idx === 0 ? stage.count : funnelStages[idx - 1].count;
            const stepConversion = prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : '0.0';

            return (
              <div key={stage.title} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{stage.title}</span>
                    <span className="text-slate-400 text-[11px]">({stage.desc})</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-slate-900 text-sm">{stage.count}</span>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {idx === 0 ? '100%' : `${stepConversion}% tiếp tục`}
                    </span>
                  </div>
                </div>

                {/* Funnel Progress Bar */}
                <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* UTM Performance Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Hiệu Quả Theo Nguồn Lưu Lượng (UTM Source)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{utmSourcesList.length} nguồn</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Nguồn (utm_source)</th>
                <th className="py-3.5 px-4 text-right">Page Views</th>
                <th className="py-3.5 px-4 text-right">Leads</th>
                <th className="py-3.5 px-4 text-right">Orders</th>
                <th className="py-3.5 px-4 text-right">Conversion</th>
                <th className="py-3.5 px-6 text-right">Doanh Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {utmSourcesList.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Chưa có dữ liệu UTM.</td></tr>
              ) : (
                utmSourcesList.map(src => {
                  const m = utmMap[src];
                  const cvr = m.visitors > 0 ? ((m.orders + m.leads) / m.visitors) * 100 : 0;
                  return (
                    <tr key={src} className="hover:bg-slate-50">
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                          {src}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">{m.visitors}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-blue-600">{m.leads}</td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">{m.orders}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-indigo-600">{cvr.toFixed(1)}%</td>
                      <td className="py-3.5 px-6 text-right font-bold text-slate-900">{formatVnd(m.revenue)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
