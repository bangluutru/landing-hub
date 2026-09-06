import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Globe2,
  Users,
  ShoppingCart,
  FileSpreadsheet,
  LineChart,
  Settings,
  ExternalLink,
  Shield,
  Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, role, switchDemoRole } = useAuth();
  const { projects, selectedProjectId, setSelectedProjectId } = useProjects();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'landing-pages', label: 'Landing Pages', icon: Globe2 },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'forms', label: 'Forms', icon: FileSpreadsheet },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 border-r border-slate-800 shrink-0">
      {/* Brand */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center font-black text-base shadow-sm">
            LH
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              Landing Hub
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                V1
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">AIWF Central Ingest</p>
          </div>
        </div>
      </div>

      {/* Global Project Scope Filter */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Layers className="w-3 h-3 text-indigo-400" />
          Phạm vi Project
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="w-full text-xs bg-slate-800/90 text-slate-200 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">Tất cả Projects ({projects.length})</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-800">
          <div className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Verification & Demo
          </div>
          <a
            href="/demo/index.html"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 hover:bg-emerald-900/40 transition"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Demo LP
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* User & Role Switcher */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 truncate">
            <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-white truncate text-[11px]">
              {currentUser?.displayName || 'User'}
            </span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-indigo-300">
            {role.replace('_', ' ')}
          </span>
        </div>

        {/* Demo role quick switcher */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px]">
          <span className="text-slate-500 font-medium">Đổi vai trò:</span>
          <div className="flex gap-1">
            <button
              onClick={() => switchDemoRole('super_admin')}
              title="Super Admin - Toàn quyền"
              className={`px-1.5 py-0.5 rounded ${role === 'super_admin' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              Super
            </button>
            <button
              onClick={() => switchDemoRole('project_admin', ['abano'])}
              title="Project Admin - Chỉ xem ABANO"
              className={`px-1.5 py-0.5 rounded ${role === 'project_admin' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              ABANO
            </button>
            <button
              onClick={() => switchDemoRole('viewer')}
              title="Viewer - Chỉ xem (Read-only)"
              className={`px-1.5 py-0.5 rounded ${role === 'viewer' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            >
              Viewer
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
