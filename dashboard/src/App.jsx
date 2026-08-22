import React, { useState } from 'react';
import TopNav from './components/TopNav';
import DashboardPage from './components/DashboardPage';
import ClientDetail from './components/ClientDetail';
import LiveInboxPage from './components/LiveInboxPage';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSubTab, setClientSubTab] = useState('overview');

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSubTab('overview');
    setActiveTab('workspace');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="app-shell">
      <TopNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        selectedClient={selectedClient}
      />
      <div className="page-area">
        {activeTab === 'clients' ? (
          <DashboardPage onSelectClient={handleSelectClient} />
        ) : activeTab === 'live' ? (
          <LiveInboxPage />
        ) : (
          <ClientDetail
            client={selectedClient}
            activeSubTab={clientSubTab}
            setActiveSubTab={setClientSubTab}
            onSelectDifferent={() => setActiveTab('clients')}
          />
        )}
      </div>
    </div>
  );
}

export default App;
