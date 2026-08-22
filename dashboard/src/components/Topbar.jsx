import React from 'react';
import { ShieldCheck, AlertTriangle, Bell, User } from 'lucide-react';
import './Topbar.css';

const Topbar = () => {
  return (
    <header className="topbar glass-header">
      <div className="topbar-left">
        <h1 className="page-title">Financial Overview</h1>
        <div className="health-score">
          <span className="score-label">Health Score</span>
          <div className="score-value success">87/100</div>
        </div>
      </div>

      <div className="topbar-right">
        {/* PDPA Compliance Widget */}
        <div className="privacy-widget glass-panel">
          <div className="privacy-icon">
            <ShieldCheck size={20} className="success-icon" />
          </div>
          <div className="privacy-stats">
            <span className="privacy-title">PDPA Active</span>
            <span className="privacy-desc">18 PII entities redacted</span>
          </div>
        </div>

        <div className="action-icons">
          <button className="icon-btn">
            <AlertTriangle size={20} />
            <span className="notification-dot"></span>
          </button>
          <button className="icon-btn">
            <Bell size={20} />
          </button>
          <div className="user-profile">
            <div className="avatar">
              <User size={20} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
