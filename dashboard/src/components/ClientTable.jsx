import React, { useState, useMemo } from 'react';
import './ClientTable.css';

const STATUS_CONFIG = {
  review:    { label: 'Needs Review', dotClass: 'dot-orange' },
  ready:     { label: 'Report Ready', dotClass: 'dot-sky' },
  pending:   { label: 'Pending Docs', dotClass: 'dot-faint' },
  completed: { label: 'Completed',    dotClass: 'dot-green' },
  active:    { label: 'Active',       dotClass: 'dot-purple' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all',       label: 'Any Status' },
  { value: 'review',    label: 'Needs Review' },
  { value: 'ready',     label: 'Report Ready' },
  { value: 'pending',   label: 'Pending Docs' },
  { value: 'completed', label: 'Completed' },
];

const DocProgress = ({ documents }) => {
  const complete = documents.filter(d => d.status === 'complete').length;
  const total = documents.length;
  return (
    <div className="doc-progress">
      <span className={complete === total ? 'doc-count-complete caption-bold' : 'doc-count caption'}>
        {complete}/{total}
      </span>
      <div className="doc-bar">
        <div
          className={`doc-bar-fill ${complete === total ? 'full' : ''}`}
          style={{ width: `${(complete / total) * 100}%` }}
        />
      </div>
    </div>
  );
};

const ClientTable = ({ clients, onSelectClient }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clients.filter(c => {
      const matchesSearch =
        !q ||
        c.domain.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  return (
    <div className="client-table-card card-base">
      {/* Header */}
      <div className="client-table-header">
        <div className="client-table-title-row">
          <h2 className="heading-3">Clients</h2>
          <button id="btn-add-client" className="btn-utility">New Client</button>
        </div>

        {/* Filters */}
        <div className="client-table-filters">
          <div className="search-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              id="client-search"
              type="text"
              className="text-input search-input"
              placeholder="Search domain or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search clients"
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
            )}
          </div>

          <select
            id="status-filter"
            className="text-input status-filter-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            {STATUS_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="client-table" role="table">
          <thead>
            <tr>
              <th className="eyebrow">Company</th>
              <th className="eyebrow">Industry</th>
              <th className="eyebrow">Status</th>
              <th className="eyebrow">Documents</th>
              <th className="eyebrow">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state body-md">
                  No clients match your search.
                </td>
              </tr>
            ) : (
              filtered.map(client => {
                const statusCfg = STATUS_CONFIG[client.status] || STATUS_CONFIG.pending;
                return (
                  <tr
                    key={client.id}
                    className="client-row"
                    onClick={() => onSelectClient(client)}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onSelectClient(client)}
                    role="button"
                    aria-label={`View ${client.companyName}`}
                  >
                    <td>
                      <div className="company-cell">
                        <span className="body-sm-medium">{client.companyName}</span>
                        <span className="caption">{client.domain}</span>
                      </div>
                    </td>
                    <td><span className="industry-tag body-sm">{client.industry}</span></td>
                    <td>
                      <div className="status-label">
                        <span className={`status-dot ${statusCfg.dotClass}`} />
                        <span className="body-sm">{statusCfg.label}</span>
                      </div>
                    </td>

                    <td><DocProgress documents={client.documents} /></td>
                    <td>
                      <div className="activity-cell">
                        <span className="activity-time">{client.lastActivityLabel}</span>
                        <span className="activity-note">{client.lastActivityNote}</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        Showing {filtered.length} of {clients.length} clients · Sorted by most recent activity
      </div>
    </div>
  );
};

export default ClientTable;
