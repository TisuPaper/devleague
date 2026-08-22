import React from 'react';
import ClientOverview from './ClientOverview';
import AnalysisWorkspace from './AnalysisWorkspace';
import './ClientDetail.css';

const STATUS_CONFIG = {
  review:    { label: 'Needs Review', dotClass: 'dot-orange' },
  ready:     { label: 'Report Ready', dotClass: 'dot-sky' },
  pending:   { label: 'Pending Docs', dotClass: 'dot-faint' },
  completed: { label: 'Completed',    dotClass: 'dot-green' },
  active:    { label: 'Active',       dotClass: 'dot-purple' },
};

const SUB_TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'analysis',  label: 'Analysis Workspace' },
];

const ClientDetail = ({ client, activeSubTab, setActiveSubTab, onSelectDifferent }) => {
  // Empty state — workspace tab before any client is selected
  if (!client) {
    return (
      <div className="workspace-empty-state">
        <div className="workspace-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </div>
        <h3 className="heading-3">No client selected</h3>
        <p className="body-md">Go to the Clients tab, select a client from the list, and their full workspace will appear here.</p>
        <button
          id="btn-go-to-clients"
          className="btn-secondary"
          onClick={onSelectDifferent}
        >
          ← Go to Clients
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[client.status] || STATUS_CONFIG.pending;
  const docsComplete = client.documents.filter(d => d.status === 'complete').length;
  const docsTotal = client.documents.length;
  const issueCount = client.issues.length;

  return (
    <div className="client-detail">
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <button
          id="btn-back-clients"
          className="breadcrumb-link"
          onClick={onSelectDifferent}
          aria-label="Back to Clients"
        >
          Clients
        </button>
        <span className="breadcrumb-sep" aria-hidden="true">/</span>
        <span className="breadcrumb-current">{client.domain}</span>
      </nav>

      {/* Client Header */}
      <div className="client-header card-base">
        <div className="client-header-top">
          <div className="client-header-info">
            <div className="client-name-row">
              <h1 className="heading-2">{client.companyName}</h1>
              <div className="status-label">
                <span className={`status-dot ${statusCfg.dotClass}`} />
                <span className="body-sm">{statusCfg.label}</span>
              </div>
            </div>
            <p className="body-sm-medium text-slate">{client.domain} · {client.industry}</p>
          </div>
          <a
            id="btn-email-client"
            href={`mailto:${client.contactEmail}`}
            className="btn-secondary client-email-btn"
          >
            {client.contactEmail}
          </a>
        </div>

        {/* Stats Row */}
        <div className="client-stats-row">
          <div className="client-stat">
            <span className="stat-value">{docsComplete}/{docsTotal}</span>
            <span className="stat-label eyebrow">Documents</span>
          </div>
          <div className="stat-divider" />
          <div className="client-stat">
            <span className="stat-value">{client.lastActivityLabel}</span>
            <span className="stat-label eyebrow">Last Activity</span>
          </div>
          <div className="stat-divider" />
          <div className="client-stat">
            <span className={`stat-value ${issueCount > 0 ? 'stat-issue' : 'stat-ok'}`}>
              {issueCount}
            </span>
            <span className="stat-label eyebrow">Issues Found</span>
          </div>
          <div className="stat-divider" />
          <div className="client-stat">
            <span className="stat-value">
              {client.report.status === 'sent' ? 'Sent' : client.report.status === 'complete' ? 'Ready' : 'In Progress'}
            </span>
            <span className="stat-label eyebrow">Report Status</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="sub-tab-bar" role="tablist" aria-label="Client sections">
        {SUB_TABS.map(tab => (
          <button
            key={tab.id}
            id={`subtab-${tab.id}`}
            role="tab"
            aria-selected={activeSubTab === tab.id}
            className={`sub-tab ${activeSubTab === tab.id ? 'sub-tab-active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'analysis' && issueCount > 0 && (
              <span className="sub-tab-badge">{issueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div role="tabpanel">
        {activeSubTab === 'overview'
          ? <ClientOverview client={client} />
          : <AnalysisWorkspace client={client} />
        }
      </div>
    </div>
  );
};

export default ClientDetail;


