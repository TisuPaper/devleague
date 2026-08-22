import React, { useState } from 'react';

const SECTION_META = {
  executive_summary:    { title: '1. Executive Summary',             icon: '📋' },
  revenue_analysis:     { title: '2. Revenue Analysis',              icon: '📈' },
  balance_sheet_review: { title: '3. Balance Sheet Review',          icon: '⚖️' },
  cash_flow_analysis:   { title: '4. Cash Flow Analysis',            icon: '💰' },
  payroll_analysis:     { title: '5. Payroll & Cost Analysis',       icon: '👥' },
  receivables_analysis: { title: '6. Accounts Receivable Analysis',  icon: '🧾' },
  recommendations:      { title: '7. Recommendations & Next Steps',  icon: '🎯' },
};

const DOC_STATUS_CONFIG = {
  complete: { label: 'Processed',        dotClass: 'dot-green' },
  missing:  { label: 'Not received',     dotClass: 'dot-orange' },
  mismatch: { label: 'Unreadable',       dotClass: 'dot-orange' },
};

const ACTIVITY_DOT = {
  success: 'dot-green',
  issue: 'dot-orange',
  info: 'dot-faint',
};

const REDACTION_LABELS = {
  SSN: 'SSN',
  CREDIT_CARD: 'Card numbers',
  PHONE: 'Phone numbers',
  EMAIL: 'Emails',
  BANK_ACCOUNT: 'Account numbers',
};

const RedactionSummary = ({ counts }) => {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) {
    return <span className="caption text-slate">No PII patterns matched</span>;
  }
  return (
    <div className="live-redaction-tags">
      {entries.map(([key, count]) => (
        <span key={key} className="live-redaction-tag caption">
          {REDACTION_LABELS[key] || key}: {count}
        </span>
      ))}
    </div>
  );
};

const LiveClientPanel = ({ client }) => {
  const [expanded, setExpanded] = useState('executive_summary');
  const [openEmail, setOpenEmail] = useState(null);

  const docsComplete = client.documents.filter(d => d.status === 'complete').length;
  const docsTotal = client.documents.length;
  const readySections = client.report.readySections || [];
  const lockedSections = client.report.lockedSections || [];
  const sections = client.report.sections || {};

  return (
    <div className="live-panel">
      {/* Header */}
      <div className="live-panel-header card-base">
        <div className="live-panel-header-top">
          <div>
            <h2 className="heading-2">{client.companyName}</h2>
            <p className="body-sm-medium text-slate">
              {client.domain} · {client.industry}
            </p>
          </div>
          {client.contactEmail && (
            <a href={`mailto:${client.contactEmail}`} className="btn-secondary">
              {client.contactEmail}
            </a>
          )}
        </div>

        <div className="live-stats-row">
          <div className="live-stat">
            <span className="live-stat-value">{docsComplete}/{docsTotal}</span>
            <span className="eyebrow">Required Docs</span>
          </div>
          <div className="live-stat">
            <span className="live-stat-value">{client.documentsReceived}</span>
            <span className="eyebrow">Files Received</span>
          </div>
          <div className="live-stat">
            <span className={`live-stat-value ${client.issues.length ? 'live-stat-warn' : 'live-stat-ok'}`}>
              {client.issues.length}
            </span>
            <span className="eyebrow">Issues</span>
          </div>
          <div className="live-stat">
            <span className="live-stat-value">{client.lastActivityLabel}</span>
            <span className="eyebrow">Last Activity</span>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="live-card card-base">
        <div className="live-card-header">
          <h3 className="heading-3">Required Documents</h3>
          <span className="body-sm text-slate">
            {docsComplete} of {docsTotal} received and processed
          </span>
        </div>
        <table className="live-table">
          <thead>
            <tr>
              <th className="eyebrow">Document</th>
              <th className="eyebrow">File</th>
              <th className="eyebrow">Type</th>
              <th className="eyebrow">Received</th>
              <th className="eyebrow">PII Redacted</th>
              <th className="eyebrow">Status</th>
            </tr>
          </thead>
          <tbody>
            {client.documents.map(doc => {
              const cfg = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.missing;
              return (
                <tr key={doc.id} className={doc.status !== 'complete' ? 'live-row-issue' : ''}>
                  <td className="body-sm-medium">{doc.name}</td>
                  <td className="body-sm live-filename">{doc.filename || '—'}</td>
                  <td className="body-sm">{doc.type || '—'}</td>
                  <td className="caption">{doc.submitted || '—'}</td>
                  <td>
                    {doc.status === 'complete'
                      ? <RedactionSummary counts={doc.redactionCounts} />
                      : <span className="caption text-slate">—</span>}
                  </td>
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

      {/* Issues */}
      {client.issues.length > 0 && (
        <div className="live-card card-base">
          <div className="live-card-header">
            <h3 className="heading-3">Issues & Follow-up</h3>
            <span className="body-sm text-slate">
              {client.issues.length} item{client.issues.length !== 1 ? 's' : ''} need attention
            </span>
          </div>
          <div className="live-issues">
            {client.issues.map(issue => (
              <div key={issue.id} className="live-issue">
                <span className={`live-issue-tag caption-bold ${issue.type === 'missing' ? 'tag-missing' : 'tag-mismatch'}`}>
                  {issue.type === 'missing' ? '📄 Missing Document' : '⚠️ Unreadable File'}
                </span>
                <p className="body-sm-medium live-issue-problem">{issue.problem}</p>
                <p className="body-sm live-issue-detail">{issue.detail}</p>
                <button
                  className="btn-utility"
                  onClick={() => setOpenEmail(openEmail === issue.id ? null : issue.id)}
                >
                  {openEmail === issue.id ? 'Hide draft email' : 'View draft email'}
                </button>
                {openEmail === issue.id && (
                  <div className="live-email-draft">
                    <div className="live-email-subject">
                      <span className="eyebrow">Subject</span>
                      <p className="body-sm-medium">{issue.emailSubject}</p>
                    </div>
                    <pre className="live-email-body">{issue.emailBody}</pre>
                    <p className="caption text-slate live-email-note">
                      Draft only — this backend does not send email (Gmail access is
                      read-only). Copy it into your mail client to send.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Report */}
      <div className="live-card card-base">
        <div className="live-card-header">
          <h3 className="heading-3">AI Analysis</h3>
          <span className="body-sm text-slate">
            {readySections.length} section{readySections.length !== 1 ? 's' : ''} generated
            {lockedSections.length > 0 && ` · ${lockedSections.length} awaiting documents`}
          </span>
        </div>

        {readySections.length === 0 ? (
          <p className="body-md live-no-analysis">
            No analysis available yet. Either no readable document has been received,
            or the Gemini API call did not succeed — check the backend logs.
          </p>
        ) : (
          <div className="live-sections">
            {readySections.map(key => {
              const meta = SECTION_META[key] || { title: key, icon: '·' };
              const isOpen = expanded === key;
              return (
                <div key={key} className="live-section">
                  <button
                    className="live-section-header"
                    onClick={() => setExpanded(isOpen ? null : key)}
                    aria-expanded={isOpen}
                  >
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="live-section-title">{meta.title}</span>
                    <span className={`live-chevron ${isOpen ? 'open' : ''}`}>▾</span>
                  </button>
                  {isOpen && (
                    <pre className="live-section-body">{sections[key]}</pre>
                  )}
                </div>
              );
            })}

            {lockedSections.map(key => {
              const meta = SECTION_META[key] || { title: key, icon: '·' };
              return (
                <div key={key} className="live-section live-section-locked">
                  <div className="live-section-header live-section-header-locked">
                    <span aria-hidden="true">{meta.icon}</span>
                    <span className="live-section-title">{meta.title}</span>
                    <span className="live-lock caption">🔒 Awaiting docs</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Processing log */}
      <div className="live-card card-base">
        <div className="live-card-header">
          <h3 className="heading-3">Processing Log</h3>
        </div>
        <ul className="live-timeline">
          {client.activity.map(item => (
            <li key={item.id} className="live-timeline-item">
              <span className={`status-dot ${ACTIVITY_DOT[item.type] || 'dot-faint'}`} />
              <div>
                <p className="body-sm live-timeline-note">{item.note}</p>
                <span className="caption text-slate">{item.timestamp}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LiveClientPanel;
