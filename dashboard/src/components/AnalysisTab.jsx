import React, { useState } from 'react';
import { AlertTriangle, Send, Sparkles, PieChart, FileText, Settings2 } from 'lucide-react';
import './AnalysisTab.css';

const AnalysisTab = () => {
  // Toggle between 'issue' and 'review' for demonstration purposes
  const [viewState, setViewState] = useState('issue');

  if (viewState === 'issue') {
    return (
      <div className="analysis-tab">
        <div className="tab-header mb-6">
          <div className="flex items-center gap-4">
            <h1>@acmecorp.com</h1>
            <button className="btn-ghost" onClick={() => setViewState('review')}>Switch to Review State</button>
          </div>
        </div>

        <div className="analysis-grid issue-state">
          <div className="card-base error-panel">
            <div className="error-header">
              <AlertTriangle size={24} color="var(--semantic-error)" />
              <h3>Missing Documents Detected: Q3 Balance Sheet</h3>
            </div>
            
            <div className="error-details">
              <div className="detail-row">
                <span className="text-slate">Client Name</span>
                <span className="text-ink font-medium">Acme Corporation</span>
              </div>
              <div className="detail-row">
                <span className="text-slate">Issue Type</span>
                <span className="text-ink font-medium">Missing File</span>
              </div>
              <div className="detail-row">
                <span className="text-slate">Description</span>
                <p className="text-ink">The required Q3 2026 Balance Sheet is missing. The quarterly financial AI review cannot be completed until this document is uploaded.</p>
              </div>
            </div>
            
            <button className="btn-secondary mt-6">View Upload Timeline</button>
          </div>

          <div className="card-base email-panel">
            <div className="flex justify-between items-center mb-6">
              <h3>Follow-up Email Draft</h3>
              <Sparkles size={16} className="text-primary" />
            </div>

            <div className="email-form">
              <div className="form-group">
                <label>To</label>
                <input type="text" className="text-input" defaultValue="Liam Chen (l.chen@acmecorp.com)" />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input type="text" className="text-input" defaultValue="Action Required: Missing Q3 Balance Sheet" />
              </div>
              <div className="form-group mt-4">
                <textarea className="rich-text-editor email-body" defaultValue={`Dear Liam,\n\nWe have received your Q3 2026 Financial submissions. During our automated review, we found that the Q3 Balance Sheet is missing.\n\nPlease provide this required document (in PDF or Excel) at your earliest convenience to complete the review.\n\nBest regards,\nSarah Chen, Financial Analyst\nExia`} />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button className="btn-primary flex items-center gap-2">
                <Send size={16} /> Send Follow-up Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-tab">
      <div className="tab-header mb-6">
        <div className="flex items-center gap-4">
          <h1>@techcorp.com</h1>
          <button className="btn-ghost" onClick={() => setViewState('issue')}>Switch to Issue State</button>
        </div>
      </div>

      <div className="analysis-grid review-state">
        <div className="card-base report-editor">
          <div className="flex justify-between items-center mb-4 border-bottom pb-2">
            <h3>Final Financial Report</h3>
            <div className="editor-tools">
              <span className="text-slate body-sm">Auto-saved 2 mins ago</span>
            </div>
          </div>
          
          <div className="rich-text-editor border-none">
            <h2>Q3 2026 Performance Review</h2>
            <p className="mt-4">This report summarizes the financial performance for TechCorp Inc. Total revenue grew by 15% compared to Q2, driven primarily by the enterprise sector.</p>
            
            <h4 className="mt-6 mb-2">Key Drivers</h4>
            <p>Operational costs spiked abnormally by 22% in August, primarily attributed to the marketing department's new campaign and cloud infrastructure scaling.</p>
            
            <table className="clients-table mt-6">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Revenue</td>
                  <td>$4.5M</td>
                  <td className="text-success">+15%</td>
                </tr>
                <tr>
                  <td>OpEx</td>
                  <td>$2.8M</td>
                  <td className="text-error">+22%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="ai-panels-container">
          <div className="card-pastel-lavender">
            <div className="flex justify-between items-center mb-4">
              <h4>AI Generated Summary</h4>
              <Sparkles size={16} className="text-brand-purple" />
            </div>
            <ul className="insights-list">
              <li>Revenue up 15% YoY</li>
              <li>OpEx variance exceeds threshold (+22%)</li>
              <li>Net Profit Margin contracted by 2%</li>
            </ul>
          </div>

          <div className="card-pastel-mint">
            <div className="flex justify-between items-center mb-4">
              <h4>Explainability Metrics</h4>
              <PieChart size={16} className="text-brand-green" />
            </div>
            <div className="metrics-row mb-2">
              <span className="text-slate body-sm">Model Confidence</span>
              <span className="caption-bold text-brand-green">94%</span>
            </div>
            <div className="metrics-row">
              <span className="text-slate body-sm">Data Reliance</span>
              <span className="caption-bold text-ink">Q3_Income.xlsx</span>
            </div>
          </div>

          <div className="card-base">
            <div className="flex justify-between items-center mb-4">
              <h4>Quick Modifications</h4>
              <Settings2 size={16} className="text-slate" />
            </div>
            <div className="form-group">
              <input type="text" className="text-input mb-2" placeholder="Add an executive note..." />
              <button className="btn-secondary" style={{width: '100%'}}>Apply Modification</button>
            </div>
          </div>

          <button className="btn-primary flex items-center justify-center gap-2" style={{padding: '16px', fontSize: '16px'}}>
            <Send size={18} /> Send Final Report to Client
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisTab;
