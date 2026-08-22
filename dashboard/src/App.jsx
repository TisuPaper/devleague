import React, { useMemo, useState } from 'react';
import TopNav from './components/TopNav';
import DashboardPage from './components/DashboardPage';
import ClientDetail from './components/ClientDetail';
import { useProcessedClients } from './hooks/useProcessedClients';
import { mergeLiveClients } from './data/liveClient';
import { mockClients } from './data/mockData';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('clients');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [clientSubTab, setClientSubTab] = useState('overview');

  // Real clients the backend has processed email for, polled continuously.
  const { clients: liveClients, status: liveStatus, error: liveError } =
    useProcessedClients();

  const clients = useMemo(
    () => mergeLiveClients(mockClients, liveClients),
    [liveClients]
  );

  // Resolve the selection from the current list rather than holding a snapshot,
  // so an open workspace refreshes itself as new analysis arrives.
  const selectedClient = selectedDomain
    ? clients.find(c => c.domain === selectedDomain) ?? null
    : null;

  const handleSelectClient = (client) => {
    setSelectedDomain(client.domain);
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
          <DashboardPage
            clients={clients}
            liveStatus={liveStatus}
            liveError={liveError}
            onSelectClient={handleSelectClient}
          />
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
