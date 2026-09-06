import React from 'react';
import { OrderStatus, PaymentStatus, LandingPageStatus } from '../../types';

interface StatusBadgeProps {
  status: OrderStatus | PaymentStatus | LandingPageStatus | string;
  type?: 'order' | 'payment' | 'lp';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'order' }) => {
  let bg = 'bg-slate-100 text-slate-700 border-slate-200';
  let label = status;

  if (type === 'order') {
    switch (status) {
      case 'new':
        bg = 'bg-blue-50 text-blue-700 border-blue-200';
        label = 'Đơn mới';
        break;
      case 'confirmed':
        bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        label = 'Đã xác nhận';
        break;
      case 'processing':
        bg = 'bg-amber-50 text-amber-700 border-amber-200';
        label = 'Đang xử lý';
        break;
      case 'completed':
        bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        label = 'Hoàn thành';
        break;
      case 'cancelled':
        bg = 'bg-rose-50 text-rose-700 border-rose-200';
        label = 'Đã hủy';
        break;
    }
  } else if (type === 'payment') {
    switch (status) {
      case 'unpaid':
        bg = 'bg-slate-100 text-slate-600 border-slate-200';
        label = 'Chưa thanh toán';
        break;
      case 'pending':
        bg = 'bg-amber-50 text-amber-700 border-amber-200';
        label = 'Chờ xác nhận';
        break;
      case 'paid':
        bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        label = 'Đã thanh toán';
        break;
      case 'failed':
        bg = 'bg-rose-50 text-rose-700 border-rose-200';
        label = 'Thất bại';
        break;
      case 'refunded':
        bg = 'bg-purple-50 text-purple-700 border-purple-200';
        label = 'Đã hoàn tiền';
        break;
    }
  } else if (type === 'lp') {
    switch (status) {
      case 'active':
        bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        label = 'Đang chạy';
        break;
      case 'draft':
        bg = 'bg-amber-50 text-amber-700 border-amber-200';
        label = 'Bản nháp';
        break;
      case 'archived':
        bg = 'bg-slate-100 text-slate-600 border-slate-200';
        label = 'Lưu trữ';
        break;
    }
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${bg}`}>
      {label}
    </span>
  );
};
