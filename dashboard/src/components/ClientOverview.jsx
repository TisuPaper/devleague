import React from 'react';
import './ClientOverview.css';

const DOC_STATUS_CONFIG = {
  complete: { label: 'Complete',         dotClass: 'dot-green' },
  missing:  { label: 'Missing',          dotClass: 'dot-orange' },
  mismatch: { label: 'Format Mismatch',  dotClass: 'dot-orange' },
};

const ACTIVITY_TYPE_CONFIG = {
  success: 'dot-green',
  issue:   'dot-orange',
  info:    'dot-faint',
};

const ClientOverview = ({ client }) => {
  return (
    <div className="client-overview">
      {/* Documents */}
      <div className="overview-card card-base">
        <div className="overview-card-header">
          <h3 className="heading-3">Documents Submitted</h3>
          <span className="body-sm-medium text-slate">
            {client.documents.filter(d => d.status === 'complete').length} of {client.documents.length} required documents received
          </span>
        </div>

        <table className="doc-table">
          <thead>
            <tr>
              <th className="eyebrow">Document Name</th>
              <th className="eyebrow">Type</th>
              <th className="eyebrow">Submitted</th>
              <th className="eyebrow">Status</th>
            </tr>
          </thead>
          <tbody>
            {client.documents.map(doc => {
              const cfg = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.missing;
              return (
                <tr key={doc.id} className={`doc-row ${doc.status !== 'complete' ? 'doc-row-issue' : ''}`}>
                  <td className="doc-name body-sm-medium">{doc.name}</td>
                  <td className="doc-type body-sm">{doc.type || '—'}</td>
                  <td className="doc-submitted caption">{doc.submitted || '—'}</td>
                  <td>
                    <div className="status-label">
                      <span className={`status-dot ${cfg.dotClass}`} />
                      <span className="body-sm">{cfg.label}</span>
                    </div>
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
          <h3 className="heading-3">Client Activity</h3>
        </div>
        <ul className="activity-timeline">
          {client.activity.map(item => (
            <li key={item.id} className="timeline-item">
              <div className={`timeline-dot ${ACTIVITY_TYPE_CONFIG[item.type] || 'dot-faint'}`} />
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
