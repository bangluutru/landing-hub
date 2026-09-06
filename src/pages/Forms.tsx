import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { Drawer } from '../components/common/Drawer';
import { FormDefinition, FormField, FormType } from '../types';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';

export const Forms: React.FC = () => {
  const { projects, landingPages, forms, leads, orders, refreshData, selectedProjectId } = useProjects();
  const { canEdit } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FormDefinition | null>(null);

  // Form creation state
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [landingPageId, setLandingPageId] = useState('');
  const [type, setType] = useState<FormType>('lead');
  const [fields, setFields] = useState<FormField[]>([
    { key: 'name', label: 'Họ và tên', type: 'text', required: true },
    { key: 'phone', label: 'Số điện thoại', type: 'phone', required: true }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayedForms = forms.filter(f => {
    if (selectedProjectId !== 'all' && f.projectId !== selectedProjectId) return false;
    return true;
  });

  const addField = () => {
    setFields([
      ...fields,
      { key: `field_${Date.now().toString(36)}`, label: 'Trường mới', type: 'text', required: false }
    ]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<FormField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...patch };
    setFields(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProj = projectId || selectedProjectId || projects[0]?.id;
    const targetLp = landingPageId || landingPages.find(lp => lp.projectId === targetProj)?.id;
    if (!name || !targetProj || !targetLp) return;

    try {
      setIsSubmitting(true);
      await api.createForm({
        projectId: targetProj,
        landingPageId: targetLp,
        name,
        type,
        fields
      });
      setName('');
      setIsModalOpen(false);
      await refreshData();
    } catch (e) {
      alert('Lỗi tạo form: ' + e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Cấu Hình Forms & Schema</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý định nghĩa schema dữ liệu, phiên bản và các lượt submission từ landing pages
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              const defaultProj = selectedProjectId !== 'all' ? selectedProjectId : (projects[0]?.id || '');
              setProjectId(defaultProj);
              const defaultLp = landingPages.find(l => l.projectId === defaultProj)?.id || '';
              setLandingPageId(defaultLp);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Tạo Form Definition
          </button>
        )}
      </div>

      {/* Forms Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Tên Form</th>
                <th className="py-3.5 px-4">Form ID</th>
                <th className="py-3.5 px-4">Loại Form</th>
                <th className="py-3.5 px-4">Project / LP</th>
                <th className="py-3.5 px-4 text-center">Version</th>
                <th className="py-3.5 px-4 text-center">Fields</th>
                <th className="py-3.5 px-4 text-right">Submissions</th>
                <th className="py-3.5 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedForms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Chưa có form nào cho project này.
                  </td>
                </tr>
              ) : (
                displayedForms.map((f) => {
                  const proj = projects.find(p => p.id === f.projectId);
                  const lp = landingPages.find(l => l.id === f.landingPageId);
                  const submissionCount = f.type === 'order'
                    ? orders.filter(o => o.formId === f.id).length
                    : leads.filter(l => l.formId === f.id).length;

                  return (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {f.name}
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                        {f.id}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          f.type === 'order' ? 'bg-emerald-50 text-emerald-700' :
                          f.type === 'lead' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                        }`}>
                          {f.type}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{proj?.name || f.projectId}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{lp?.name || f.landingPageId}</div>
                      </td>
                      <td className="py-4 px-4 text-center font-mono font-bold text-slate-700">
                        v{f.version}
                      </td>
                      <td className="py-4 px-4 text-center text-slate-600 font-semibold">
                        {f.fields?.length || 0} trường
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-indigo-600">
                        {submissionCount}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setSelectedForm(f)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-md transition"
                        >
                          Xem Schema
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

      {/* Modal Create Form Definition */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tạo Form Definition Mới"
        subtitle="Landing Hub chỉ quản lý schema + validation, Landing page chịu trách nhiệm render UI"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Project *</label>
              <select
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const firstLp = landingPages.find(l => l.projectId === e.target.value)?.id || '';
                  setLandingPageId(firstLp);
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Landing Page *</label>
              <select
                value={landingPageId}
                onChange={(e) => setLandingPageId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {landingPages
                  .filter(lp => !projectId || lp.projectId === projectId)
                  .map(lp => (
                    <option key={lp.id} value={lp.id}>{lp.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tên Form *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Form Đăng Ký Tư Vấn Collagen"
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại Form (Type) *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FormType)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                <option value="lead">Lead Form</option>
                <option value="order">Order Form</option>
                <option value="custom">Custom Form</option>
              </select>
            </div>
          </div>

          {/* Dynamic Fields Builder */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Cấu hình trường dữ liệu (Fields)</span>
              <button
                type="button"
                onClick={addField}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm trường
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {fields.map((fld, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    value={fld.key}
                    onChange={(e) => updateField(idx, { key: e.target.value })}
                    placeholder="field_key (vd: phone)"
                    className="flex-1 text-xs px-2 py-1 rounded border border-slate-300 font-mono"
                  />
                  <input
                    type="text"
                    value={fld.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    placeholder="Nhãn hiển thị (vd: Số điện thoại)"
                    className="flex-1 text-xs px-2 py-1 rounded border border-slate-300"
                  />
                  <select
                    value={fld.type}
                    onChange={(e) => updateField(idx, { type: e.target.value as any })}
                    className="text-xs px-2 py-1 rounded border border-slate-300 bg-white"
                  >
                    <option value="text">Text</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="number">Number</option>
                    <option value="select">Select</option>
                    <option value="textarea">Textarea</option>
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 shrink-0">
                    <input
                      type="checkbox"
                      checked={fld.required}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                    />
                    Bắt buộc
                  </label>
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
              {isSubmitting ? 'Đang lưu...' : 'Lưu Form Schema'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Drawer View Schema */}
      <Drawer
        isOpen={Boolean(selectedForm)}
        onClose={() => setSelectedForm(null)}
        title="Chi Tiết Schema Form"
        subtitle={selectedForm ? `Form ID: ${selectedForm.id} (v${selectedForm.version})` : ''}
      >
        {selectedForm && (
          <div className="space-y-6 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-sm">{selectedForm.name}</div>
              <div className="text-slate-600">Loại form: <span className="font-bold uppercase text-indigo-600">{selectedForm.type}</span></div>
              <div className="text-slate-600">Gắn với LP: <span className="font-mono">{selectedForm.landingPageId}</span></div>
              <div className="text-slate-400 text-[11px]">Tạo lúc: {formatDate(selectedForm.createdAt)}</div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                Danh Sách Trường Dữ Liệu ({selectedForm.fields.length})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {selectedForm.fields.map((fld, idx) => (
                  <div key={idx} className="p-3 bg-white flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{fld.label}</div>
                      <div className="font-mono text-[10px] text-slate-400">key: {fld.key} • type: {fld.type}</div>
                    </div>
                    <div>
                      {fld.required ? (
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                          Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                          Optional
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
