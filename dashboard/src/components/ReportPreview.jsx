import React, { useState } from 'react';
import './ReportPreview.css';

const SECTION_META = {
  executive_summary:    { title: '1. Executive Summary',              icon: '📋' },
  revenue_analysis:     { title: '2. Revenue Analysis',              icon: '📈' },
  balance_sheet_review: { title: '3. Balance Sheet Review',          icon: '⚖️' },
  cash_flow_analysis:   { title: '4. Cash Flow Analysis',            icon: '💰' },
  payroll_analysis:     { title: '5. Payroll & Cost Analysis',       icon: '👥' },
  receivables_analysis: { title: '6. Accounts Receivable Analysis',  icon: '🧾' },
  recommendations:      { title: '7. Recommendations & Next Steps',  icon: '🎯' },
};

const SECTION_CONTENT = {
  executive_summary: `Based on the financial documents provided, the company demonstrated stable revenue growth for Q3 2026. Total revenue increased by 12.4% compared to Q2 2026, driven primarily by strong performance in the enterprise segment. Gross margin remains healthy at 58.2%.

Key highlights:
  • Revenue growth of 12.4% QoQ, exceeding the target of 8%
  • Operating expenses increased by 7.1%, within acceptable range
  • Net profit margin stands at 18.3%, up from 15.9% in Q2
  • Cash position remains strong with adequate liquidity ratios`,

  revenue_analysis: `Revenue Breakdown (Q3 2026):

  Enterprise Segment:    SGD 2,840,000   (+18.2% QoQ)
  SME Segment:          SGD 1,160,000   (+5.4% QoQ)
  Government Contracts: SGD   500,000   (+2.1% QoQ)
  ─────────────────────────────────────────────────
  Total Revenue:        SGD 4,500,000   (+12.4% QoQ)

Analysis: The enterprise segment remains the primary growth driver, benefiting from two new long-term contracts signed in August 2026. The SME segment shows steady organic growth. Government contracts remained relatively stable.

⚠️ Anomaly Detected: An unusually high credit note of SGD 84,000 was issued in September to client Nexgen Solutions. Staff should verify this with the sales team before finalising the report.`,

  balance_sheet_review: `Assets Summary (as at 30 Sep 2026):

  Current Assets:
    Cash & Equivalents:     SGD   980,000
    Accounts Receivable:    SGD 1,240,000
    Prepaid Expenses:       SGD   120,000
    Total Current Assets:   SGD 2,340,000

  Non-Current Assets:
    Property & Equipment:   SGD 1,800,000
    Intangible Assets:      SGD   350,000
    Total Non-Current:      SGD 2,150,000

  TOTAL ASSETS:             SGD 4,490,000

  Current Ratio: 1.87 (Healthy — above 1.5 benchmark)
  Debt-to-Equity Ratio: 0.42 (Low leverage)`,

  cash_flow_analysis: `[Analysis pending — Cash Flow Statement not yet received]`,
  payroll_analysis:   `[Analysis pending — Payroll Summary format issue, awaiting corrected file]`,
  receivables_analysis: `[Analysis pending — Accounts Receivable Aging report not yet received]`,

  recommendations: `Based on available data, preliminary recommendations include:

  1. Revenue: Continue investing in enterprise segment expansion — the 18% QoQ growth indicates strong product-market fit.
  2. Cost Management: Monitor the 7.1% OpEx increase closely — ensure it does not exceed 10% in Q4.
  3. Receivables: Implement a 45-day payment follow-up policy given the high AR balance.
  4. Liquidity: Current ratio of 1.87 is healthy; maintain cash reserves above SGD 800,000.

  ⚠️ Note: Full recommendations cannot be finalised until all documents are received and processed.`,
};

const ReportPreview = ({ report, reportSent, onApprove }) => {
  const [expandedSection, setExpandedSection] = useState('executive_summary');
  const allSections = [...report.readySections, ...report.lockedSections];

  const statusBanner = reportSent
    ? { text: '✓ Report sent to client', className: 'banner-sent' }
    : report.status === 'complete'
    ? { text: 'Report complete — ready for staff approval', className: 'banner-ready' }
    : { text: `Partial report — ${report.lockedSections.length} section(s) awaiting documents`, className: 'banner-partial' };

  return (
    <div className="report-preview">
      {/* Status banner */}
      <div className={`report-banner ${statusBanner.className}`}>
        {statusBanner.text}
      </div>

      {/* Section list */}
      <div className="report-sections">
        {allSections.map(sectionKey => {
          const meta = SECTION_META[sectionKey] || { title: sectionKey, icon: '·' };
          const isLocked = report.lockedSections.includes(sectionKey);
          const isExpanded = expandedSection === sectionKey && !isLocked;

          return (
            <div
              key={sectionKey}
              className={`report-section ${isLocked ? 'report-section-locked' : ''}`}
            >
              <button
                id={`btn-section-${sectionKey}`}
                className="report-section-header"
                onClick={() => !isLocked && setExpandedSection(
                  expandedSection === sectionKey ? null : sectionKey
                )}
                disabled={isLocked}
                aria-expanded={isExpanded}
              >
                <span className="section-icon" aria-hidden="true">{meta.icon}</span>
                <span className="section-title">{meta.title}</span>
                {isLocked
                  ? <span className="section-lock" aria-label="Locked — awaiting documents">🔒 Awaiting docs</span>
                  : <span className={`section-chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                }
              </button>

              {isExpanded && (
                <div className="report-section-body">
                  <pre className="report-section-content">
                    {SECTION_CONTENT[sectionKey] || 'Content not available.'}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action footer */}
      {!reportSent && (
        <div className="report-actions">
          <button
            id="btn-request-revisions"
            className="btn-secondary"
          >
            Request Revisions
          </button>
          <button
            id="btn-approve-send"
            className="btn-primary"
            onClick={onApprove}
            disabled={report.status !== 'complete'}
            title={report.status !== 'complete' ? 'Complete all sections before approving' : undefined}
          >
            Approve & Send to Client ↗
          </button>
        </div>
      )}

      {reportSent && (
        <div className="report-sent-footer">
          ✓ This report has been approved and sent to the client.
        </div>
      )}
    </div>
  );
};

export default ReportPreview;
