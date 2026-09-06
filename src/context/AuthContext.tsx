import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser, UserRole } from '../types';
import { setApiAuthToken } from '../lib/api';

interface AuthContextType {
  currentUser: AdminUser | null;
  role: UserRole;
  isSuperAdmin: boolean;
  canEdit: boolean;
  accessibleProjects: string[] | 'all';
  hasAccessToProject: (projectId: string) => boolean;
  switchDemoRole: (role: UserRole, projectIds?: string[]) => void;
  login: (email: string, role?: UserRole) => void;
  logout: () => void;
}

const DEFAULT_SUPER_ADMIN: AdminUser = {
  uid: 'usr-admin-1',
  email: 'admin@landinghub.aiwf',
  displayName: 'Nguyễn Quản Trị (Super Admin)',
  role: 'super_admin',
  createdAt: '2026-08-01T00:00:00Z'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(DEFAULT_SUPER_ADMIN);

  useEffect(() => {
    if (currentUser) {
      const scope = (currentUser.projectIds || []).join(',') || 'all';
      setApiAuthToken(`demo-${currentUser.role}-${scope}`);
    } else {
      setApiAuthToken('');
    }
  }, [currentUser]);

  const role = currentUser?.role || 'viewer';
  const isSuperAdmin = role === 'super_admin';
  const canEdit = role === 'super_admin' || role === 'project_admin';
  const accessibleProjects = isSuperAdmin ? 'all' : (currentUser?.projectIds || []);

  const hasAccessToProject = (projectId: string): boolean => {
    if (isSuperAdmin) return true;
    if (!currentUser?.projectIds) return false;
    return currentUser.projectIds.includes(projectId);
  };

  const switchDemoRole = (newRole: UserRole, projectIds: string[] = ['abano']) => {
    if (newRole === 'super_admin') {
      setCurrentUser(DEFAULT_SUPER_ADMIN);
    } else if (newRole === 'project_admin') {
      setCurrentUser({
        uid: 'usr-abano-2',
        email: 'manager.abano@landinghub.aiwf',
        displayName: 'Trần Hương (ABANO Admin)',
        role: 'project_admin',
        projectIds,
        createdAt: '2026-08-10T00:00:00Z'
      });
    } else {
      setCurrentUser({
        uid: 'usr-viewer-3',
        email: 'viewer@landinghub.aiwf',
        displayName: 'Khách Quan Sát (Viewer)',
        role: 'viewer',
        createdAt: '2026-08-15T00:00:00Z'
      });
    }
  };

  const login = (email: string, assignedRole: UserRole = 'super_admin') => {
    setCurrentUser({
      uid: 'usr-' + Date.now(),
      email,
      displayName: email.split('@')[0],
      role: assignedRole,
      projectIds: assignedRole === 'project_admin' ? ['abano'] : undefined,
      createdAt: new Date().toISOString()
    });
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role,
        isSuperAdmin,
        canEdit,
        accessibleProjects,
        hasAccessToProject,
        switchDemoRole,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
