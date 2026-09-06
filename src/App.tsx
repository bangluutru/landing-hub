import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { LandingPages } from './pages/LandingPages';
import { LandingPageDetail } from './pages/LandingPageDetail';
import { Leads } from './pages/Leads';
import { Orders } from './pages/Orders';
import { Forms } from './pages/Forms';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';

export const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedLpId, setSelectedLpId] = useState<string | null>(null);

  const handleSelectLp = (id: string) => {
    setSelectedLpId(id);
    setCurrentTab('lp-detail');
  };

  const handleBackFromDetail = () => {
    setSelectedLpId(null);
    setCurrentTab('landing-pages');
  };

  return (
    <Layout currentTab={currentTab} setCurrentTab={setCurrentTab}>
      {currentTab === 'dashboard' && <Dashboard onSelectLp={handleSelectLp} />}
      {currentTab === 'projects' && <Projects />}
      {currentTab === 'landing-pages' && <LandingPages onSelectLp={handleSelectLp} />}
      {currentTab === 'lp-detail' && selectedLpId && (
        <LandingPageDetail lpId={selectedLpId} onBack={handleBackFromDetail} />
      )}
      {currentTab === 'leads' && <Leads />}
      {currentTab === 'orders' && <Orders />}
      {currentTab === 'forms' && <Forms />}
      {currentTab === 'analytics' && <Analytics />}
      {currentTab === 'settings' && <Settings />}
    </Layout>
  );
};

export function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AppContent />
      </ProjectProvider>
    </AuthProvider>
  );
}

export default App;
