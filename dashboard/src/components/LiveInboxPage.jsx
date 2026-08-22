import React, { useState } from 'react';
import LiveClientPanel from './LiveClientPanel';
import { useProcessedClients } from '../hooks/useProcessedClients';
import './LiveInbox.css';

const STATUS_CONFIG = {
  review:    { label: 'Needs Review', dotClass: 'dot-orange' },
  ready:     { label: 'Report Ready', dotClass: 'dot-sky' },
  active:    { label: 'Processing',   dotClass: 'dot-purple' },
  pending:   { label: 'Pending Docs', dotClass: 'dot-faint' },
  completed: { label: 'Completed',    dotClass: 'dot-green' },
};

const ConnectionBadge = ({ status, error, lastUpdated }) => {
  if (status === 'error') {
    return (
      <span className="live-conn live-conn-error" title={error || 'Backend unreachable'}>
        <span className="live-conn-dot" /> Backend unreachable
      </span>
    );
  }
  if (status === 'loading') {
    return (
      <span className="live-conn live-conn-loading">
        <span className="live-conn-dot" /> Connecting…
      </span>
    );
  }
  return (
    <span className="live-conn live-conn-ok">
      <span className="live-conn-dot" />
      Live{lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString()}` : ''}
    </span>
  );
};

const LiveInboxPage = () => {
  const { clients, status, error, lastUpdated, refresh } = useProcessedClients();
  const [selectedDomain, setSelectedDomain] = useState(null);

  const selected =
    clients.find(c => c.domain === selectedDomain) ?? clients[0] ?? null;

  return (
    <div className="live-inbox-page">
      <div className="live-inbox-header">
        <div>
          <h1 className="heading-2">Live Email Processing</h1>
          <p className="body-sm live-inbox-sub">
            Clients below are built entirely from email your backend has actually
            received, extracted, PII-redacted and analysed. Nothing here is sample data.
          </p>
        </div>
        <div className="live-inbox-header-actions">
          <ConnectionBadge status={status} error={error} lastUpdated={lastUpdated} />
          <button className="btn-utility" onClick={refresh}>Refresh</button>
        </div>
      </div>

      {status === 'error' && (
        <div className="live-banner live-banner-error">
          Could not reach the backend{error ? `: ${error}` : ''}. Make sure it is running
          on port 8000 (<code>uvicorn app.main:app --reload --port 8000</code>).
        </div>
      )}

      {status !== 'loading' && clients.length === 0 && (
        <div className="live-empty card-base">
          <div className="live-empty-icon" aria-hidden="true">📥</div>
          <h3 className="heading-3">No processed email yet</h3>
          <p className="body-md">
            Send an email with a PDF, XLSX, XLS or CSV attachment to the watched
            inbox. Once the backend downloads and analyses it, the client will
            appear here automatically.
          </p>
        </div>
      )}

      {clients.length > 0 && (
        <div className="live-inbox-layout">
          <aside className="live-client-list" aria-label="Processed clients">
            <div className="live-client-list-header eyebrow">
              Processed Clients ({clients.length})
            </div>
            {clients.map(client => {
              const cfg = STATUS_CONFIG[client.status] || STATUS_CONFIG.pending;
              const isActive = selected && selected.domain === client.domain;
              const docsComplete = client.documents.filter(d => d.status === 'complete').length;
              return (
                <button
                  key={client.domain}
                  className={`live-client-item ${isActive ? 'live-client-item-active' : ''}`}
                  onClick={() => setSelectedDomain(client.domain)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="live-client-item-top">
                    <span className="body-sm-medium">{client.companyName}</span>
                    <span className={`status-dot ${cfg.dotClass}`} />
                  </div>
                  <span className="caption live-client-domain">{client.domain}</span>
                  <div className="live-client-item-meta">
                    <span className="caption">{docsComplete}/{client.documents.length} docs</span>
                    <span className="caption live-client-time">{client.lastActivityLabel}</span>
                  </div>
                  {client.isGenericDomain && (
                    <span className="live-generic-tag caption">personal email domain</span>
                  )}
                </button>
              );
            })}
          </aside>

          <section className="live-client-detail" aria-label="Client processing detail">
            {selected && <LiveClientPanel client={selected} />}
          </section>
        </div>
      )}
    </div>
  );
};

export default LiveInboxPage;
