import React from 'react';
import './ActivityLog.css';

const ActivityLog = () => {
  const logs = [
    { id: '#22', user: 'system', action: 'bot: risk-analysis-v2', time: '12m ago' },
    { id: '#21', user: 'system', action: 'bot: data-ingestion-cron', time: '52m ago' },
    { id: '#20', user: 'admin', action: 'bot: rules-update', time: '1h ago' },
    { id: '#19', user: 'system', action: 'bot: compliance-check', time: '3h ago' },
    { id: '#18', user: 'system', action: 'bot: daily-summary', time: '5h ago' },
  ];

  return (
    <div className="activity-log-card glass-panel">
      <div className="log-header">
        <h3 className="card-title">PLATFORM ACTIVITY <span className="log-topic">(Master Topic: 0.0.7993400)</span></h3>
        <span className="badge badge-success log-count">22 Logs</span>
      </div>

      <div className="log-list">
        {logs.map(log => (
          <div key={log.id} className="log-item">
            <span className="log-id">{log.id}</span>
            <span className="log-user">{log.user}</span>
            <span className="log-action">{log.action}</span>
            <span className="log-time">{log.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityLog;
