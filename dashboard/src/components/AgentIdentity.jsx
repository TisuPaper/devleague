import React from 'react';
import { Shield, Zap, ExternalLink } from 'lucide-react';
import './AgentIdentity.css';

const AgentIdentity = () => {
  return (
    <div className="agent-identity-card glass-panel">
      <h3 className="card-title">AGENT ACCOUNT</h3>
      
      <div className="identity-header">
        <div className="identity-info">
          <h2>FinAI Shield Bot #013</h2>
          <span className="agent-id">0.0.7994597</span>
        </div>
        <div className="identity-badges">
          <Shield size={18} className="success-icon" />
          <Zap size={18} className="success-icon" />
        </div>
      </div>

      <div className="balances">
        <div className="balance-item">
          <span className="currency-icon usdc">$</span>
          <span className="balance-amount">100</span>
          <span className="currency-name">USDC</span>
        </div>
        <div className="balance-item">
          <span className="currency-icon hbar">H</span>
          <span className="balance-amount">10.00</span>
          <span className="currency-name">HBAR</span>
        </div>
      </div>

      <div className="agent-details">
        <div className="detail-row">
          <span className="detail-label">Domain:</span>
          <span className="detail-value text-accent">finance,compliance</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Services:</span>
          <span className="detail-value text-accent">audit,redaction</span>
        </div>
      </div>

      <a href="#" className="view-details-link">
        <ExternalLink size={14} /> Click to view full details
      </a>
    </div>
  );
};

export default AgentIdentity;
