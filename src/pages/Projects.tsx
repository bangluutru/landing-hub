import React, { useState } from 'react';
import { Plus, Globe } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { api } from '../lib/api';

export const Projects: React.FC = () => {
  const { projects, landingPages, leads, orders, refreshData } = useProjects();
  const { canEdit } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    try {
      setIsSubmitting(true);
      const domains = allowedDomains
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);

      await api.createProject({
        name,
        code: code.toUpperCase(),
        description,
        allowedDomains: domains
      });

      setName('');
      setCode('');
      setDescription('');
      setAllowedDomains('');
      setIsModalOpen(false);
      await refreshData();
    } catch (err) {
      alert('Lỗi tạo project: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quản Lý Multi-Project</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản trị danh mục business & project (ABANO, Genki Fami, Balancera, Huma Medical...)
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Thêm Project Mới
          </button>
        )}
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(proj => {
          const projLPs = landingPages.filter(lp => lp.projectId === proj.id);
          const projLeads = leads.filter(l => l.projectId === proj.id).length;
          const projOrders = orders.filter(o => o.projectId === proj.id).length;

          return (
            <div
              key={proj.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                      {proj.code.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{proj.name}</h3>
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">{proj.code}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    proj.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {proj.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </div>

                <p className="mt-3 text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                  {proj.description || 'Chưa có mô tả chi tiết.'}
                </p>

                {/* Whitelist Domains */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400" />
                    Allowed Domains
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {proj.allowedDomains && proj.allowedDomains.length > 0 ? (
                      proj.allowedDomains.map(d => (
                        <span key={d} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                          {d}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">Mở cho mọi domain (*)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="mt-5 pt-3 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">LPs</div>
                  <div className="font-bold text-slate-800">{projLPs.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Leads</div>
                  <div className="font-bold text-blue-600">{projLeads}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Orders</div>
                  <div className="font-bold text-emerald-600">{projOrders}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add Project */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm Project Mới"
        subtitle="Khởi tạo workspace riêng biệt cho business của bạn"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Project *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Huma Medical"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mã Code (viết tắt) *</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: HUMA"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mô tả ngắn</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngành hàng, sản phẩm chủ lực..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Allowed Domains (CORS Whitelist)</label>
            <input
              type="text"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              placeholder="humamedical.vn, landing.humamedical.vn (cách nhau dấu phẩy)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Để trống nếu cho phép nhận dữ liệu từ mọi domain.</p>
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
              {isSubmitting ? 'Đang tạo...' : 'Tạo Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
