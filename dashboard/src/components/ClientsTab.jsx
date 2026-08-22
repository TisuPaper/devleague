import React from 'react';
import { ArrowUpRight, MoreHorizontal, Activity } from 'lucide-react';
import './ClientsTab.css';

const ClientsTab = () => {
  const clients = [
    { domain: '@acme.com', name: 'Acme Corporation', contact: 'John Doe', value: '$45.2M', status: 'Active' },
    { domain: '@techcorp.com', name: 'TechCorp Inc.', contact: 'Jane Smith', value: '$28.5M', status: 'Active' },
    { domain: '@globaltech.io', name: 'GlobalTech Solutions', contact: 'Mike Ross', value: '$19.8M', status: 'Processing' },
    { domain: '@innovate.net', name: 'Innovate LLC', contact: 'Sarah Lee', value: '$12.1M', status: 'Active' },
  ];

  return (
    <div className="clients-tab">
      <div className="tab-header mb-6">
        <h1>Clients Base</h1>
        <button className="btn-primary">Add Client</button>
      </div>

      <div className="clients-grid">
        <div className="clients-list card-base">
          <div className="flex justify-between items-center mb-4">
            <h4>Corporate Clients</h4>
            <div className="segmented-tabs">
              <span className="tab active">All</span>
              <span className="tab">Active</span>
              <span className="tab">Pending</span>
            </div>
          </div>
          
          <table className="clients-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th>Company Name</th>
                <th>Contact</th>
                <th>Value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={i}>
                  <td className="domain-cell">{c.domain}</td>
                  <td className="name-cell">{c.name}</td>
                  <td>{c.contact}</td>
                  <td>{c.value}</td>
                  <td>
                    <span className={`status-dot ${c.status.toLowerCase()}`}></span>
                    {c.status}
                  </td>
                  <td><button className="btn-ghost"><MoreHorizontal size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="activity-feed card-pastel-lavender">
          <div className="flex justify-between items-center mb-6">
            <h4>Recent Activity Feed</h4>
            <Activity size={18} className="text-slate" />
          </div>

          <div className="timeline">
            <div className="timeline-item">
              <div className="timeline-icon bg-white text-primary"><ArrowUpRight size={14} /></div>
              <div className="timeline-content">
                <p className="body-sm-medium text-ink">Ingesting docs from @acme.com</p>
                <span className="caption-bold text-primary">Ongoing</span>
              </div>
              <span className="timeline-time">10:32 AM</span>
            </div>
            
            <div className="timeline-item">
              <div className="timeline-icon bg-white text-success"><ArrowUpRight size={14} /></div>
              <div className="timeline-content">
                <p className="body-sm-medium text-ink">PII Redaction complete for @techcorp.com</p>
                <span className="caption-bold text-success">Success</span>
              </div>
              <span className="timeline-time">10:15 AM</span>
            </div>
            
            <div className="timeline-item">
              <div className="timeline-icon bg-white text-warning"><ArrowUpRight size={14} /></div>
              <div className="timeline-content">
                <p className="body-sm-medium text-ink">Data Extraction initiated for @globaltech.io</p>
                <span className="caption-bold text-warning">Pending</span>
              </div>
              <span className="timeline-time">09:48 AM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientsTab;
