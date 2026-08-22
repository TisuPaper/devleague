import React from 'react';
import { ExternalLink } from 'lucide-react';
import './KnowledgeBase.css';

const KnowledgeBase = () => {
  return (
    <div className="knowledge-base-card glass-panel">
      <div className="kb-header">
        <h3 className="card-title">KNOWLEDGE LAYER</h3>
        <a href="#" className="kb-link"><ExternalLink size={14} /></a>
      </div>

      <div className="kb-visual">
        {/* Placeholder for the globe visual - CSS art or simplified svg */}
        <div className="globe-placeholder">
          <div className="globe-circle">
            <div className="globe-dots"></div>
          </div>
        </div>
      </div>

      <div className="kb-stats">
        <div className="stat-column">
          <span className="stat-label">Total</span>
          <span className="stat-value">42</span>
        </div>
        <div className="stat-column">
          <span className="stat-label">Approved</span>
          <span className="stat-value">38</span>
        </div>
        <div className="stat-column">
          <span className="stat-label">Pending</span>
          <span className="stat-value">4</span>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
