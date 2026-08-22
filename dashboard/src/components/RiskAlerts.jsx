import React from 'react';
import { AlertOctagon, TrendingDown, HelpCircle } from 'lucide-react';
import './RiskAlerts.css';

const AlertItem = ({ title, desc, severity, confidence }) => {
  return (
    <div className={`alert-item severity-${severity}`}>
      <div className="alert-icon-wrapper">
        <AlertOctagon size={18} />
      </div>
      <div className="alert-content">
        <div className="alert-header">
          <h4>{title}</h4>
          <span className={`badge badge-${severity}`}>{severity} Risk</span>
        </div>
        <p>{desc}</p>
        <div className="alert-meta">
          <span className="confidence-score">
            <span className="dot"></span> AI Confidence: {confidence}%
          </span>
          <button className="explain-btn">
            <HelpCircle size={14} /> Explain
          </button>
        </div>
      </div>
    </div>
  );
};

const RiskAlerts = () => {
  return (
    <div className="risk-alerts glass-panel">
      <div className="alerts-header">
        <h3>Risk & Anomaly Detection</h3>
        <span className="badge badge-danger">2 Issues Found</span>
      </div>
      
      <div className="alerts-list">
        <AlertItem 
          title="Unpredicted OpEx Spike" 
          desc="Operating expenses for August deviated by +22% from the 6-month moving average."
          severity="danger"
          confidence="98"
        />
        <AlertItem 
          title="Profit Margin Contraction" 
          desc="Net profit margin decreased by 2% despite a 15% increase in top-line revenue."
          severity="warning"
          confidence="85"
        />
      </div>
    </div>
  );
};

export default RiskAlerts;
