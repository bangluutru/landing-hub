import React, { useState } from 'react';
import { Download, Search, Eye, Phone, Mail } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { Drawer } from '../components/common/Drawer';
import { formatDate, exportToCsv } from '../lib/utils';
import { Lead } from '../types';

export const Leads: React.FC = () => {
  const { projects, landingPages, forms, filteredLeads, selectedProjectId, setSelectedProjectId } = useProjects();

  const [search, setSearch] = useState('');
  const [filterLp, setFilterLp] = useState('all');
  const [filterForm, setFilterForm] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const displayedLeads = filteredLeads.filter(l => {
    if (filterLp !== 'all' && l.landingPageId !== filterLp) return false;
    if (filterForm !== 'all' && l.formId !== filterForm) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const nameMatch = l.name?.toLowerCase().includes(q);
    const phoneMatch = l.phone?.includes(q);
    const emailMatch = l.email?.toLowerCase().includes(q);
    return Boolean(nameMatch || phoneMatch || emailMatch);
  });

  const handleExport = () => {
    const rows = displayedLeads.map(l => ({
      ID: l.id,
      'Thời gian': formatDate(l.createdAt),
      'Project': l.projectId,
      'Landing Page': l.landingPageId,
      'Form ID': l.formId,
      'Họ và tên': l.name || '',
      'Số điện thoại': l.phone || '',
      'Email': l.email || '',
      'UTM Source': l.utmSource || '',
      'UTM Medium': l.utmMedium || '',
      'UTM Campaign': l.utmCampaign || '',
      'Referrer': l.referrer || '',
      'Dữ liệu tùy biến': JSON.stringify(l.data || {})
    }));
    exportToCsv('landing-hub-leads', rows);
  };

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quản Lý Leads</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dữ liệu khách hàng tiềm năng thu thập từ các landing pages
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
        >
          <Download className="w-4 h-4 text-indigo-600" />
          Xuất Danh Sách CSV
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, điện thoại, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setFilterLp('all');
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="all">Tất cả Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filterLp}
            onChange={(e) => setFilterLp(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="all">Tất cả Landing Pages</option>
            {landingPages.map(lp => (
              <option key={lp.id} value={lp.id}>{lp.name}</option>
            ))}
          </select>

          <select
            value={filterForm}
            onChange={(e) => setFilterForm(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="all">Tất cả Forms</option>
            {forms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Khách hàng</th>
                <th className="py-3.5 px-4">Liên hệ</th>
                <th className="py-3.5 px-4">Project / LP</th>
                <th className="py-3.5 px-4">Nguồn / Chiến dịch</th>
                <th className="py-3.5 px-4">Thời gian</th>
                <th className="py-3.5 px-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Không có lead nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                displayedLeads.map((lead) => {
                  const proj = projects.find(p => p.id === lead.projectId);
                  const lp = landingPages.find(l => l.id === lead.landingPageId);

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {lead.name || <span className="text-slate-400 font-normal italic">Chưa rõ tên</span>}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-indigo-600">{lead.phone || '-'}</div>
                        <div className="text-[11px] text-slate-500">{lead.email || ''}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{proj?.name || lead.projectId}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">{lp?.name || lead.landingPageId}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {lead.utmSource || 'direct'}
                          </span>
                          {lead.utmCampaign && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {lead.utmCampaign}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                        {formatDate(lead.createdAt)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Xem chi tiết lead"
                        >
                          <Eye className="w-4 h-4" />
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

      {/* Lead Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        title="Chi Tiết Lead Khách Hàng"
        subtitle={selectedLead ? `Mã Lead: ${selectedLead.id}` : ''}
      >
        {selectedLead && (
          <div className="space-y-6 text-xs">
            {/* Contact Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div className="text-sm font-bold text-slate-900">{selectedLead.name || 'Khách hàng'}</div>
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold">{selectedLead.phone || 'Chưa cung cấp'}</span>
              </div>
              {selectedLead.email && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{selectedLead.email}</span>
                </div>
              )}
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                Thời gian tạo: {formatDate(selectedLead.createdAt)}
              </div>
            </div>

            {/* Custom Form Data */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                Dữ Liệu Khảo Sát / Tùy Biến (data)
              </h4>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1.5">
                {Object.keys(selectedLead.data || {}).length === 0 ? (
                  <span className="text-slate-400 italic">Không có trường mở rộng</span>
                ) : (
                  Object.entries(selectedLead.data).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-slate-200/60 pb-1">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-bold text-slate-800">{String(v)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attribution & Tracking */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                Nguồn Truy Cập & Attribution
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Project ID</span>
                  <span className="font-bold text-slate-800">{selectedLead.projectId}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Landing Page</span>
                  <span className="font-bold text-slate-800 truncate block">{selectedLead.landingPageId}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">UTM Source</span>
                  <span className="font-bold text-slate-800">{selectedLead.utmSource || '-'}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">UTM Campaign</span>
                  <span className="font-bold text-slate-800">{selectedLead.utmCampaign || '-'}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px]">Referrer</span>
                  <span className="text-slate-700 truncate block">{selectedLead.referrer || 'Direct'}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[10px]">Visitor ID</span>
                  <span className="font-mono text-[10px] text-slate-500">{selectedLead.visitorId || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
