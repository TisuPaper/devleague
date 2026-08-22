import React from 'react';
import './IssueCard.css';

const TYPE_CONFIG = {
  missing:  { label: 'Missing Document',  className: 'issue-type-missing',  icon: '📄' },
  mismatch: { label: 'Format Mismatch',   className: 'issue-type-mismatch', icon: '⚠️' },
};

const IssueCard = ({ issue, onPreviewEmail, onEmailSent }) => {
  const cfg = TYPE_CONFIG[issue.type] || TYPE_CONFIG.missing;

  return (
    <div className={`issue-card ${issue.emailSent ? 'issue-card-sent' : ''}`}>
      <div className="issue-card-header">
        <span className={`issue-type-tag caption-bold ${cfg.className}`}>
          {cfg.icon} {cfg.label}
        </span>
        {issue.emailSent && (
          <span className="issue-sent-indicator caption" title={`Follow-up sent ${issue.sentAt}`}>
            ✓ Email sent {issue.sentAt}
          </span>
        )}
      </div>

      <div className="issue-card-body">
        <p className="issue-problem body-sm-medium">{issue.problem}</p>
        <p className="issue-detail body-sm">{issue.detail}</p>
      </div>

      <div className="issue-card-actions">
        <button
          id={`btn-preview-email-${issue.id}`}
          className="btn-utility"
          onClick={onPreviewEmail}
          aria-label={`Preview follow-up email for ${issue.problem}`}
        >
          Preview Email
        </button>
        {!issue.emailSent ? (
          <button
            id={`btn-send-followup-${issue.id}`}
            className="btn-primary"
            style={{ fontSize: '14px', padding: '6px 14px' }}
            onClick={onEmailSent}
            aria-label={`Send follow-up email for ${issue.problem}`}
          >
            Send Follow-up →
          </button>
        ) : (
          <button
            id={`btn-resend-followup-${issue.id}`}
            className="btn-utility"
            onClick={onEmailSent}
          >
            Resend
          </button>
        )}
      </div>
    </div>
  );
};

export default IssueCard;

