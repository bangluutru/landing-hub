import React from 'react';
import { RotateCw, Database, Calendar } from 'lucide-react';
import { useProjects } from '../../context/ProjectContext';

interface HeaderProps {
  currentTab: string;
}

export const Header: React.FC<HeaderProps> = ({ currentTab }) => {
  const { dateRange, setDateRange, refreshData, resetToSeed, isLoading } = useProjects();

  const titleMap: Record<string, string> = {
    dashboard: 'Tổng Quan & Phễu Chuyển Đổi',
    projects: 'Quản Lý Projects',
    'landing-pages': 'Danh Sách Landing Pages',
    leads: 'Danh Sách Leads',
    orders: 'Đơn Hàng & Doanh Thu',
    forms: 'Cấu Hình Form & Schema',
    analytics: 'Phân Tích Chuyển Đổi Funnel',
    settings: 'Cài Đặt & Hướng Dẫn Tích Hợp'
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-slate-900 capitalize">
          {titleMap[currentTab] || currentTab}
        </h1>
        <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Ingestion API Live
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Date range filter */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          <button
            onClick={() => setDateRange('7d')}
            className={`px-2 py-1 rounded font-semibold transition ${dateRange === '7d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            7 ngày
          </button>
          <button
            onClick={() => setDateRange('30d')}
            className={`px-2 py-1 rounded font-semibold transition ${dateRange === '30d' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            30 ngày
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-2 py-1 rounded font-semibold transition ${dateRange === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Tất cả
          </button>
        </div>

        {/* Reset seed button */}
        <button
          onClick={resetToSeed}
          disabled={isLoading}
          title="Khôi phục dữ liệu mẫu chuẩn (ABANO, Genki Fami)"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-xs transition"
        >
          <Database className="w-3.5 h-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Nạp lại Demo Data</span>
        </button>

        {/* Refresh button */}
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          title="Làm mới dữ liệu"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>
    </header>
  );
};
