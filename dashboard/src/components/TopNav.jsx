import React from 'react';
import './TopNav.css';

const TopNav = ({ activeTab, setActiveTab, selectedClient }) => {
  return (
    <nav className="top-nav" role="navigation" aria-label="Main navigation">
      <div className="top-nav-tabs">
        <button
          id="tab-clients"
          className={`top-nav-tab ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
          aria-current={activeTab === 'clients' ? 'page' : undefined}
        >
          Clients
        </button>

        <button
          id="tab-workspace"
          className={`top-nav-tab ${activeTab === 'workspace' ? 'active' : ''} ${!selectedClient ? 'disabled' : ''}`}
          onClick={() => selectedClient && setActiveTab('workspace')}
          aria-current={activeTab === 'workspace' ? 'page' : undefined}
          aria-disabled={!selectedClient}
          title={!selectedClient ? 'Select a client first' : undefined}
        >
          {selectedClient
            ? <><span className="workspace-tab-label">Workspace</span><span className="workspace-tab-domain">{selectedClient.domain}</span></>
            : 'Workspace'
          }
        </button>
      </div>
    </nav>
  );
};

export default TopNav;
