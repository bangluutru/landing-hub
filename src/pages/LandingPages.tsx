import React, { useState } from 'react';
import { Plus, ExternalLink, Search } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../lib/api';
import { formatVnd } from '../lib/utils';

interface LandingPagesProps {
  onSelectLp: (lpId: string) => void;
}

export const LandingPages: React.FC<LandingPagesProps> = ({ onSelectLp }) => {
  const {
    projects,
    filteredLandingPages,
    leads,
    orders,
    events,
    refreshData,
    selectedProjectId,
    setSelectedProjectId
  } = useProjects();
  const { canEdit } = useAuth();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayedLps = filteredLandingPages.filter(lp => {
    if (!search) return true;
    const q = search.toLowerCase();
    return lp.name.toLowerCase().includes(q) || lp.url.toLowerCase().includes(q);
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = projectId || selectedProjectId || (projects[0]?.id ?? '');
    if (!name || !url || !targetProject) return;

    try {
      setIsSubmitting(true);
      await api.createLandingPage({
        projectId: targetProject,
        name,
        url,
        description
      });
      setName('');
      setUrl('');
      setDescription('');
      setIsModalOpen(false);
      await refreshData();
    } catch (e) {
      alert('Lỗi tạo Landing Page: ' + e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Danh Sách Landing Pages</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý và giám sát hiệu quả chuyển đổi của từng trang đích
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setProjectId(selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || ''));
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Thêm Landing Page
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc URL landing page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="text-slate-500 font-medium">Lọc Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="all">Tất cả Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LP Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Tên Landing Page</th>
                <th className="py-3.5 px-4">Project</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4 text-right">Visitors</th>
                <th className="py-3.5 px-4 text-right">Leads</th>
                <th className="py-3.5 px-4 text-right">Orders</th>
                <th className="py-3.5 px-4 text-right">Conversion</th>
                <th className="py-3.5 px-6 text-right">Doanh Thu</th>
                <th className="py-3.5 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không tìm thấy landing page nào.
                  </td>
                </tr>
              ) : (
                displayedLps.map((lp) => {
                  const proj = projects.find(p => p.id === lp.projectId);
                  const lpEvents = events.filter(e => e.landingPageId === lp.id);
                  const lpVisitors = Math.max(
                    new Set(lpEvents.filter(e => e.visitorId && e.eventName === 'page_view').map(e => e.visitorId)).size,
                    lpEvents.filter(e => e.eventName === 'page_view').length
                  );
                  const lpLeads = leads.filter(l => l.landingPageId === lp.id).length;
                  const lpOrders = orders.filter(o => o.landingPageId === lp.id && o.orderStatus !== 'cancelled');
                  const lpRevenue = lpOrders.reduce((sum, o) => sum + (o.total || 0), 0);
                  const cvr = lpVisitors > 0 ? ((lpOrders.length + lpLeads) / lpVisitors) * 100 : 0;

                  return (
                    <tr key={lp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">{lp.name}</div>
                        <a
                          href={lp.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-400 hover:text-indigo-600 flex items-center gap-1 mt-0.5"
                        >
                          <span className="truncate max-w-xs">{lp.url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {proj?.name || lp.projectId}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={lp.status} type="lp" />
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-slate-700">
                        {lpVisitors}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-blue-600">
                        {lpLeads}
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-emerald-600">
                        {lpOrders.length}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-indigo-600">
                        {cvr.toFixed(1)}%
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-slate-900">
                        {formatVnd(lpRevenue)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => onSelectLp(lp.id)}
                          className="px-3 py-1 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-md transition shadow-2xs"
                        >
                          Xem chi tiết
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

      {/* Modal Add LP */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm Landing Page Mới"
        subtitle="Khai báo landing page để nhận API key và tích hợp AIWF LP SDK"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Thuộc Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Landing Page *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Chiến dịch Tết 2026 - Flash Sale Collagen"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">URL Landing Page *</label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://abano.vn/botanical-serum"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú / Mục tiêu</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu doanh số, kênh quảng cáo chính..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu Landing Page'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
