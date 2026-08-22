import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import './AIInsights.css';

const AIInsights = () => {
  return (
    <div className="ai-insights glass-panel">
      <div className="insights-header">
        <Sparkles size={18} className="ai-icon" />
        <h3>AI Executive Summary</h3>
      </div>
      
      <div className="insights-content">
        <p className="summary-text">
          The Q3 Financial Statement indicates strong top-line growth of <strong>15%</strong> driven by the enterprise sector. However, net profit margin has contracted slightly due to an anomalous <strong>22% spike in operating expenses</strong> in August.
        </p>
        
        <div className="recommendations">
          <h4>Recommended Actions</h4>
          <ul>
            <li>
              <ArrowRight size={14} className="list-icon" />
              <span>Investigate the August marketing campaign ROI to justify the $450k overspend.</span>
            </li>
            <li>
              <ArrowRight size={14} className="list-icon" />
              <span>Review cloud infrastructure scaling limits to prevent future unpredicted cost surges.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
