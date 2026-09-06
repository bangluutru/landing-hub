import React from 'react';
import { Globe2, Users, ShoppingCart, TrendingUp, DollarSign, ExternalLink } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { StatCard } from '../components/common/StatCard';
import { formatVnd } from '../lib/utils';

interface DashboardProps {
  onSelectLp: (lpId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectLp }) => {
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

  // Metrics computation
  const totalLPs = filteredLandingPages.length;

  // Unique visitors calculation
  const visitorIds = new Set(
    filteredEvents
      .filter(e => e.visitorId && e.eventName === 'page_view')
      .map(e => e.visitorId)
  );
  const totalVisitors = Math.max(visitorIds.size, filteredEvents.filter(e => e.eventName === 'page_view').length);

  const totalLeads = filteredLeads.length;
  const totalOrders = filteredOrders.length;
  
  // Total Revenue from valid orders
  const totalRevenue = filteredOrders
    .filter(o => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // Conversion rate: (Orders / Visitors) * 100 (or Leads + Orders / Visitors)
  const conversionRate = totalVisitors > 0 ? ((totalOrders + totalLeads) / totalVisitors) * 100 : 0;

  // Calculate per-LP Leaderboard
  const lpLeaderboard = filteredLandingPages.map(lp => {
    const lpEvents = filteredEvents.filter(e => e.landingPageId === lp.id);
    const lpVisitorsCount = Math.max(
      new Set(lpEvents.filter(e => e.visitorId && e.eventName === 'page_view').map(e => e.visitorId)).size,
      lpEvents.filter(e => e.eventName === 'page_view').length
    );
    const lpLeadsCount = filteredLeads.filter(l => l.landingPageId === lp.id).length;
    const lpOrders = filteredOrders.filter(o => o.landingPageId === lp.id && o.orderStatus !== 'cancelled');
    const lpOrdersCount = lpOrders.length;
    const lpRevenue = lpOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lpCvr = lpVisitorsCount > 0 ? ((lpOrdersCount + lpLeadsCount) / lpVisitorsCount) * 100 : 0;

    return {
      ...lp,
      visitors: lpVisitorsCount,
      leads: lpLeadsCount,
      orders: lpOrdersCount,
      revenue: lpRevenue,
      cvr: lpCvr
    };
  }).sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setSelectedLpId('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Landing Page
            </label>
            <select
              value={selectedLpId}
              onChange={(e) => setSelectedLpId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Tất cả Landing Pages</option>
              {filteredLandingPages.map(lp => (
                <option key={lp.id} value={lp.id}>{lp.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>Dữ liệu thời gian thực được đồng bộ qua Ingestion API</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Landing Pages"
          value={totalLPs}
          subtext="Trang đang kích hoạt"
          icon={<Globe2 className="w-4 h-4 text-indigo-600" />}
        />
        <StatCard
          title="Visitors"
          value={totalVisitors}
          subtext="Khách truy cập (page_view)"
          icon={<Users className="w-4 h-4 text-blue-600" />}
        />
        <StatCard
          title="Leads"
          value={totalLeads}
          subtext="Lead đăng ký tư vấn"
          icon={<Users className="w-4 h-4 text-amber-600" />}
        />
        <StatCard
          title="Orders"
          value={totalOrders}
          subtext="Đơn đặt hàng"
          icon={<ShoppingCart className="w-4 h-4 text-emerald-600" />}
        />
        <StatCard
          title="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          subtext="(Leads + Orders) / Visitors"
          icon={<TrendingUp className="w-4 h-4 text-purple-600" />}
        />
        <StatCard
          title="Doanh Thu"
          value={formatVnd(totalRevenue)}
          subtext="Tổng giá trị đơn"
          icon={<DollarSign className="w-4 h-4 text-emerald-700" />}
        />
      </div>

      {/* Landing Page Performance Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Bảng Xếp Hạng Hiệu Quả Landing Page</h2>
            <p className="text-xs text-slate-500 mt-0.5">Xếp hạng theo doanh thu & tỷ lệ chuyển đổi thực tế</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {lpLeaderboard.length} Landing Pages
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-6">Landing Page</th>
                <th className="py-3 px-4">Project</th>
                <th className="py-3 px-4 text-right">Visitors</th>
                <th className="py-3 px-4 text-right">Leads</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">Conversion</th>
                <th className="py-3 px-6 text-right">Doanh Thu</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lpLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Chưa có dữ liệu landing page cho bộ lọc này.
                  </td>
                </tr>
              ) : (
                lpLeaderboard.map((lp) => {
                  const proj = projects.find(p => p.id === lp.projectId);
                  return (
                    <tr key={lp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        <div className="font-semibold">{lp.name}</div>
                        <a
                          href={lp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 mt-0.5"
                        >
                          <span className="truncate max-w-xs">{lp.url}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {proj?.code || lp.projectId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {lp.visitors}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-blue-600">
                        {lp.leads}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                        {lp.orders}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-indigo-600">
                        {lp.cvr.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-slate-900">
                        {formatVnd(lp.revenue)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onSelectLp(lp.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-md transition"
                        >
                          Chi tiết
                        </button>
                      </td>
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
