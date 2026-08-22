import React from 'react';
import './RecentActivity.css';

const TYPE_CONFIG = {
  success: { dot: 'dot-success', icon: '✓' },
  issue:   { dot: 'dot-issue',   icon: '!' },
  info:    { dot: 'dot-info',    icon: '·' },
};

const RecentActivity = ({ activities }) => {
  return (
    <div className="activity-card card-base">
      <div className="activity-card-header">
        <h2 className="heading-3">Recent Activity</h2>
      </div>
      <ul className="activity-list" aria-label="Recent activity feed">
        {activities.map(item => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.info;
          return (
            <li key={item.id} className="activity-item">
              <div className={`activity-dot ${cfg.dot}`} aria-hidden="true" />
              <div className="activity-body">
                <span className="activity-domain">{item.domain}</span>
                <p className="activity-action">{item.action}</p>
                <span className="activity-timestamp">{item.time}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RecentActivity;
