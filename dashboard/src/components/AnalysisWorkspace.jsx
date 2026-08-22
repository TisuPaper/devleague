import React, { useState } from 'react';
import IssueCard from './IssueCard';
import ReportPreview from './ReportPreview';
import EmailPreviewModal from './EmailPreviewModal';
import './AnalysisWorkspace.css';

const AnalysisWorkspace = ({ client, activeSubTab }) => {
  const [issues, setIssues] = useState(client.issues);
  const [modalIssue, setModalIssue] = useState(null);
  const [reportSent, setReportSent] = useState(client.report.status === 'sent');

  const docsComplete = client.documents.filter(d => d.status === 'complete').length;
  const docsTotal = client.documents.length;
  const openIssues = issues.filter(i => !i.emailSent).length;

  const handleEmailSent = (issueId) => {
    setIssues(prev => prev.map(i =>
      i.id === issueId ? { ...i, emailSent: true, sentAt: 'Just now' } : i
    ));
    setModalIssue(null);
  };

  const handleApproveReport = () => {
    if (window.confirm('Approve and send this report to the client?')) {
      setReportSent(true);
    }
  };

  const reportStatus = reportSent
    ? 'sent'
    : client.report.status;

  /* ----- Stat cards ----- */
  const getReportStatusLabel = () => {
    if (reportSent) return 'Sent to Client';
    if (reportStatus === 'complete') return 'Ready to Approve';
    if (reportStatus === 'partial') return 'Partial';
    return 'Awaiting Docs';
  };

  return (
    <div className="analysis-workspace">
      {/* Summary stats */}
      <div className="ws-stats-row">
        <div className={`ws-stat-card ${issues.length > 0 ? 'ws-stat-warn' : 'ws-stat-ok'}`}>
          <span className="ws-stat-value">{issues.length}</span>
          <span className="ws-stat-label">Issues Found</span>
        </div>
        <div className="ws-stat-card">
          <span className="ws-stat-value">{docsComplete}/{docsTotal}</span>
          <span className="ws-stat-label">Documents Ready</span>
          <div className="ws-progress-bar">
            <div
              className={`ws-progress-fill ${docsComplete === docsTotal ? 'full' : ''}`}
              style={{ transform: `scaleX(${docsComplete / docsTotal})` }}
            />
          </div>
        </div>
        <div className={`ws-stat-card ${reportSent ? 'ws-stat-ok' : ''}`}>
          <span className="ws-stat-value">{getReportStatusLabel()}</span>
          <span className="ws-stat-label">Report Status</span>
        </div>
        {openIssues > 0 && (
          <div className="ws-stat-card ws-stat-action">
            <span className="ws-stat-value">{openIssues}</span>
            <span className="ws-stat-label">Pending Follow-ups</span>
          </div>
        )}
      </div>

      {/* If no documents submitted yet */}
      {docsComplete === 0 && (
        <div className="ws-empty-state card-base">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <h3>Awaiting Document Submission</h3>
          <p>This client has not submitted any documents yet. Please wait for the client to upload the required financial documents before processing can begin.</p>
        </div>
      )}

      {/* Main workspace: issues or report */}
      {docsComplete > 0 && (
        <div className="ws-main ws-main-full">
          {/* Issues panel */}
          {activeSubTab === 'issues' && (
            <div className="ws-issues-panel">
              <div className="ws-panel-header">
                <h3 className="ws-panel-title">Issues & Follow-up</h3>
                <span className="ws-panel-sub">{openIssues} follow-up{openIssues !== 1 ? 's' : ''} pending</span>
              </div>
              
              {issues.length > 0 ? (
                <div className="ws-issues-list">
                  {issues.map(issue => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onPreviewEmail={() => setModalIssue(issue)}
                      onEmailSent={() => handleEmailSent(issue.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="ws-empty-state">
                  <p>No issues found. All documents are processed cleanly.</p>
                </div>
              )}
            </div>
          )}

          {/* Report panel */}
          {activeSubTab === 'report' && (
            <div className="ws-report-panel">
              <div className="ws-panel-header">
                <h3 className="ws-panel-title">AI-Generated Report</h3>
                <span className="ws-panel-sub">{client.report.title}</span>
              </div>
              <ReportPreview
                report={client.report}
                reportSent={reportSent}
                onApprove={handleApproveReport}
              />
            </div>
          )}
        </div>
      )}

      {/* Email modal */}
      {modalIssue && (
        <EmailPreviewModal
          issue={modalIssue}
          onClose={() => setModalIssue(null)}
          onSend={() => handleEmailSent(modalIssue.id)}
        />
      )}
    </div>
  );
};

export default AnalysisWorkspace;
