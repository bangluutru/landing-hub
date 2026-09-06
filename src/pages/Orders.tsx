import React, { useState } from 'react';
import { Download, Search, Eye, ShoppingBag, Truck, CheckCircle2 } from 'lucide-react';
import { useProjects } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';
import { Drawer } from '../components/common/Drawer';
import { StatusBadge } from '../components/common/StatusBadge';
import { api } from '../lib/api';
import { formatVnd, formatDate, exportToCsv } from '../lib/utils';
import { Order, OrderStatus, PaymentStatus } from '../types';

export const Orders: React.FC = () => {
  const { projects, landingPages, filteredOrders, selectedProjectId, setSelectedProjectId, refreshData } = useProjects();
  const { canEdit } = useAuth();

  const [search, setSearch] = useState('');
  const [filterLp, setFilterLp] = useState('all');
  const [filterOrderStatus, setFilterOrderStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const displayedOrders = filteredOrders.filter(o => {
    if (filterLp !== 'all' && o.landingPageId !== filterLp) return false;
    if (filterOrderStatus !== 'all' && o.orderStatus !== filterOrderStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const idMatch = o.orderId.toLowerCase().includes(q);
    const nameMatch = o.customer?.name?.toLowerCase().includes(q);
    const phoneMatch = o.customer?.phone?.includes(q);
    return Boolean(idMatch || nameMatch || phoneMatch);
  });

  const handleStatusChange = async (newOrderStatus?: OrderStatus, newPaymentStatus?: PaymentStatus) => {
    if (!selectedOrder || !canEdit) return;
    try {
      setIsUpdating(true);
      const updated = await api.updateOrderStatus(
        selectedOrder.id,
        newOrderStatus || selectedOrder.orderStatus,
        newPaymentStatus || selectedOrder.paymentStatus
      );
      setSelectedOrder(updated);
      await refreshData();
    } catch (e) {
      alert('Lỗi cập nhật trạng thái đơn: ' + e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExport = () => {
    const rows = displayedOrders.map(o => ({
      'Mã đơn': o.orderId,
      'Thời gian': formatDate(o.createdAt),
      'Project': o.projectId,
      'Landing Page': o.landingPageId,
      'Tên khách hàng': o.customer?.name || '',
      'Số điện thoại': o.customer?.phone || '',
      'Địa chỉ': o.customer?.address || '',
      'Sản phẩm': o.items?.map(it => `${it.name} (x${it.quantity})`).join('; ') || '',
      'Tổng tiền (VND)': o.total,
      'Hình thức thanh toán': o.paymentMethod,
      'Trạng thái đơn hàng': o.orderStatus,
      'Trạng thái thanh toán': o.paymentStatus,
      'UTM Source': o.utmSource || '',
      'UTM Campaign': o.utmCampaign || '',
      'Referrer': o.referrer || ''
    }));
    exportToCsv('landing-hub-orders', rows);
  };

  return (
    <div className="space-y-6">
      {/* Action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Quản Lý Đơn Hàng</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Xử lý và theo dõi toàn bộ đơn đặt hàng từ các landing pages
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

      {/* Filter bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo mã ORD, họ tên, điện thoại..."
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
            value={filterOrderStatus}
            onChange={(e) => setFilterOrderStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="all">Mọi trạng thái đơn</option>
            <option value="new">Đơn mới</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="processing">Đang xử lý</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-6">Mã Đơn</th>
                <th className="py-3.5 px-4">Khách hàng</th>
                <th className="py-3.5 px-4">Sản phẩm</th>
                <th className="py-3.5 px-4 text-right">Tổng tiền</th>
                <th className="py-3.5 px-4 text-center">Trạng thái đơn</th>
                <th className="py-3.5 px-4 text-center">Thanh toán</th>
                <th className="py-3.5 px-4">Project / Nguồn</th>
                <th className="py-3.5 px-4">Thời gian</th>
                <th className="py-3.5 px-4 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Không có đơn hàng nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                displayedOrders.map((ord) => {
                  const proj = projects.find(p => p.id === ord.projectId);
                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {ord.orderId}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-900">{ord.customer?.name}</div>
                        <div className="text-[11px] text-slate-500">{ord.customer?.phone}</div>
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate">
                        {ord.items?.map(it => `${it.name} (x${it.quantity})`).join(', ')}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-emerald-600">
                        {formatVnd(ord.total)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <StatusBadge status={ord.orderStatus} type="order" />
                      </td>
                      <td className="py-4 px-4 text-center">
                        <StatusBadge status={ord.paymentStatus} type="payment" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-700">{proj?.name || ord.projectId}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {ord.utmSource || 'direct'} / {ord.utmCampaign || 'organic'}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-slate-500 text-[11px]">
                        {formatDate(ord.createdAt)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Xem chi tiết & đổi trạng thái"
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

      {/* Order Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title="Chi Tiết Đơn Hàng"
        subtitle={selectedOrder ? `Mã: ${selectedOrder.orderId}` : ''}
      >
        {selectedOrder && (
          <div className="space-y-6 text-xs">
            {/* Status Modifiers */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                Cập Nhật Trạng Thái
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Trạng thái đơn hàng</label>
                  <select
                    disabled={!canEdit || isUpdating}
                    value={selectedOrder.orderStatus}
                    onChange={(e) => handleStatusChange(e.target.value as OrderStatus, undefined)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                  >
                    <option value="new">Đơn mới</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="processing">Đang xử lý</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Trạng thái thanh toán</label>
                  <select
                    disabled={!canEdit || isUpdating}
                    value={selectedOrder.paymentStatus}
                    onChange={(e) => handleStatusChange(undefined, e.target.value as PaymentStatus)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800"
                  >
                    <option value="unpaid">Chưa thanh toán</option>
                    <option value="pending">Chờ xác nhận</option>
                    <option value="paid">Đã thanh toán</option>
                    <option value="failed">Thất bại</option>
                    <option value="refunded">Đã hoàn tiền</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer & Delivery */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" />
                Thông Tin Giao Hàng
              </h4>
              <div className="font-bold text-slate-900 text-sm">{selectedOrder.customer?.name}</div>
              <div className="text-slate-700 font-medium">Điện thoại: {selectedOrder.customer?.phone}</div>
              <div className="text-slate-600">Địa chỉ: {selectedOrder.customer?.address || 'Chưa cung cấp'}</div>
              {selectedOrder.customer?.note && (
                <div className="text-slate-500 italic text-[11px] bg-amber-50/50 p-2 rounded border border-amber-100">
                  Ghi chú: {selectedOrder.customer?.note}
                </div>
              )}
            </div>

            {/* Items Receipt */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                Danh Sách Sản Phẩm
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {selectedOrder.items?.map((it, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{it.name}</div>
                      {it.variant && <div className="text-[10px] text-slate-500 font-medium">{it.variant}</div>}
                      <div className="text-[11px] text-slate-500">
                        {it.quantity} × {formatVnd(it.price)}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900">
                      {formatVnd(it.quantity * it.price)}
                    </div>
                  </div>
                ))}
                <div className="p-3 bg-white flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">Tổng thanh toán:</span>
                  <span className="font-extrabold text-base text-emerald-600">
                    {formatVnd(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Attribution */}
            <div>
              <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                Nguồn Gốc Landing Page & UTM
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Project</span>
                  <span className="font-bold text-slate-800">{selectedOrder.projectId}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Landing Page</span>
                  <span className="font-bold text-slate-800 truncate block">{selectedOrder.landingPageId}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">Phương thức TT</span>
                  <span className="font-bold uppercase text-slate-800">{selectedOrder.paymentMethod}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[10px]">UTM Campaign</span>
                  <span className="font-bold text-slate-800">{selectedOrder.utmCampaign || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
