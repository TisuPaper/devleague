import React from 'react';
import './DocumentViewer.css';
import { Maximize2, Download, Search } from 'lucide-react';

const DocumentViewer = () => {
  return (
    <div className="document-viewer glass-panel">
      <div className="viewer-header">
        <div className="viewer-title">
          <h3>Source Document</h3>
          <span className="badge badge-success">Redacted</span>
        </div>
        <div className="viewer-actions">
          <button className="icon-btn"><Search size={16} /></button>
          <button className="icon-btn"><Download size={16} /></button>
          <button className="icon-btn"><Maximize2 size={16} /></button>
        </div>
      </div>
      
      <div className="viewer-content">
        {/* Mock Document Content with Redacted PII */}
        <div className="mock-document">
          <div className="doc-header">
            <h2>Q3 Financial Statement</h2>
            <p>Prepared for: <span className="redacted" title="[Client Name Redacted]">████████</span></p>
            <p>Date: September 30, 2026</p>
          </div>
          
          <div className="doc-body">
            <p>
              This report summarizes the financial performance for the third quarter. Total revenue grew by 15% 
              compared to Q2, driven primarily by the enterprise sector. 
            </p>
            <p className="highlighted-section">
              However, operational costs spiked abnormally by <span className="highlight-text">22%</span> in August, 
              primarily attributed to the marketing department's new campaign and cloud infrastructure scaling.
            </p>
            <p>
              Account Manager <span className="redacted" title="[Name Redacted]">█████ ███</span> oversaw the 
              major client acquisition (ID: <span className="redacted" title="[ID Redacted]">██-████</span>), 
              which contributed $1.2M to the top line.
            </p>
            
            <table className="doc-table">
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
                  <td>$4,500,000</td>
                  <td className="text-success">+15%</td>
                </tr>
                <tr>
                  <td>OpEx</td>
                  <td>$2,800,000</td>
                  <td className="text-danger">+22%</td>
                </tr>
                <tr>
                  <td>Net Profit</td>
                  <td>$1,200,000</td>
                  <td className="text-warning">-2%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
