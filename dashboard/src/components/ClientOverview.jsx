import React from 'react';
import './ClientOverview.css';

const DOC_STATUS_CONFIG = {
  complete: { label: 'Complete',         className: 'doc-status-complete' },
  missing:  { label: 'Missing',          className: 'doc-status-missing' },
  mismatch: { label: 'Format Mismatch',  className: 'doc-status-mismatch' },
};

const ACTIVITY_TYPE_CONFIG = {
  success: 'act-dot-success',
  issue:   'act-dot-issue',
  info:    'act-dot-info',
};

const ClientOverview = ({ client }) => {
  return (
    <div className="client-overview">
      {/* Documents */}
      <div className="overview-card card-base">
        <div className="overview-card-header">
          <h3 className="overview-card-title">Documents Submitted</h3>
          <span className="overview-card-sub">
            {client.documents.filter(d => d.status === 'complete').length} of {client.documents.length} required documents received
          </span>
        </div>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Document Name</th>
              <th>Type</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {client.documents.map(doc => {
              const cfg = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.missing;
              return (
                <tr key={doc.id} className={`doc-row ${doc.status !== 'complete' ? 'doc-row-issue' : ''}`}>
                  <td className="doc-name">{doc.name}</td>
                  <td className="doc-type">{doc.type || '—'}</td>
                  <td className="doc-submitted">{doc.submitted || '—'}</td>
                  <td>
                    <span className={`doc-status-badge ${cfg.className}`}>{cfg.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Activity Timeline */}
      <div className="overview-card card-base">
        <div className="overview-card-header">
          <h3 className="overview-card-title">Client Activity</h3>
        </div>
        <ul className="activity-timeline">
          {client.activity.map(item => (
            <li key={item.id} className="timeline-item">
              <div className={`timeline-dot ${ACTIVITY_TYPE_CONFIG[item.type] || 'act-dot-info'}`} />
              <div className="timeline-body">
                <p className="timeline-note">{item.note}</p>
                <span className="timeline-time">{item.timestamp}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ClientOverview;
