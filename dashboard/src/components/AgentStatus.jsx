import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import './AgentStatus.css';

const AgentStatus = () => {
  const statusItems = [
    { id: 1, label: 'Loaded FinAI Base Model', done: true },
    { id: 2, label: 'Decrypted API keys from Vault', done: true },
    { id: 3, label: 'Synced knowledge base (42 entries)', done: true },
    { id: 4, label: 'Registered on compliance topic', done: true },
    { id: 5, label: 'Monitoring incoming queue', done: false }
  ];

  return (
    <div className="agent-status-card glass-panel">
      <h3 className="card-title">AGENT STATUS</h3>
      <ul className="status-list">
        {statusItems.map(item => (
          <li key={item.id} className={`status-item ${item.done ? 'completed' : 'pending'}`}>
            <span className="status-icon">
              {item.done ? <Check size={16} /> : <Loader2 size={16} className="spin" />}
            </span>
            <span className="status-label">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AgentStatus;
