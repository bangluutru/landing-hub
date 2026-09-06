import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, LandingPage, FormDefinition, Lead, Order, TrackingEvent } from '../types';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  landingPages: LandingPage[];
  forms: FormDefinition[];
  leads: Lead[];
  orders: Order[];
  events: TrackingEvent[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  selectedLpId: string;
  setSelectedLpId: (id: string) => void;
  dateRange: '7d' | '30d' | '90d' | 'all';
  setDateRange: (range: '7d' | '30d' | '90d' | 'all') => void;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  resetToSeed: () => Promise<void>;
  // Filtered helpers
  filteredLandingPages: LandingPage[];
  filteredLeads: Lead[];
  filteredOrders: Order[];
  filteredEvents: TrackingEvent[];
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasAccessToProject, isSuperAdmin } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedLpId, setSelectedLpId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [projs, lps, frms, lds, ords, evts] = await Promise.all([
        api.getProjects(),
        api.getLandingPages(),
        api.getForms(),
        api.getLeads(),
        api.getOrders(),
        api.getEvents(200)
      ]);
      setProjects(projs);
      setLandingPages(lps);
      setForms(frms);
      setLeads(lds);
      setOrders(ords);
      setEvents(evts);
    } catch (e) {
      console.error('Failed to load project data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const resetToSeed = async () => {
    setIsLoading(true);
    await api.resetSeed();
    await refreshData();
  };

  // Enforce access control and active project selection
  const allowedProjects = projects.filter(p => isSuperAdmin || hasAccessToProject(p.id));

  const filteredLandingPages = landingPages.filter(lp => {
    if (!isSuperAdmin && !hasAccessToProject(lp.projectId)) return false;
    if (selectedProjectId !== 'all' && lp.projectId !== selectedProjectId) return false;
    return true;
  });

  const filteredLeads = leads.filter(l => {
    if (!isSuperAdmin && !hasAccessToProject(l.projectId)) return false;
    if (selectedProjectId !== 'all' && l.projectId !== selectedProjectId) return false;
    if (selectedLpId !== 'all' && l.landingPageId !== selectedLpId) return false;
    return true;
  });

  const filteredOrders = orders.filter(o => {
    if (!isSuperAdmin && !hasAccessToProject(o.projectId)) return false;
    if (selectedProjectId !== 'all' && o.projectId !== selectedProjectId) return false;
    if (selectedLpId !== 'all' && o.landingPageId !== selectedLpId) return false;
    return true;
  });

  const filteredEvents = events.filter(e => {
    if (!isSuperAdmin && !hasAccessToProject(e.projectId)) return false;
    if (selectedProjectId !== 'all' && e.projectId !== selectedProjectId) return false;
    if (selectedLpId !== 'all' && e.landingPageId !== selectedLpId) return false;
    return true;
  });

  return (
    <ProjectContext.Provider
      value={{
        projects: allowedProjects,
        landingPages,
        forms,
        leads,
        orders,
        events,
        selectedProjectId,
        setSelectedProjectId,
        selectedLpId,
        setSelectedLpId,
        dateRange,
        setDateRange,
        isLoading,
        refreshData,
        resetToSeed,
        filteredLandingPages,
        filteredLeads,
        filteredOrders,
        filteredEvents
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
};
