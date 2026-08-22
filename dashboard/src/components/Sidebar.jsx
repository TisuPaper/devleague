import React from 'react';
import { Users, FileText, Settings, Search, CheckCircle2, Clock } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-mark">Z</div>
          <h2>Zenith AI</h2>
        </div>
        <div className="search-container">
          <Search size={16} className="text-stone" />
          <input type="text" placeholder="Search clients..." className="sidebar-search" />
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">MAIN</span>
          <ul>
            <li 
              className={activeTab === 'clients' ? 'active' : ''} 
              onClick={() => setActiveTab('clients')}
            >
              <Users size={18} /> <span>Clients Base</span>
            </li>
            <li 
              className={activeTab === 'analysis' ? 'active' : ''} 
              onClick={() => setActiveTab('analysis')}
            >
              <FileText size={18} /> <span>Analysis Workspace</span>
            </li>
            <li>
              <Settings size={18} /> <span>Settings</span>
            </li>
          </ul>
        </div>

        <div className="nav-section">
          <span className="nav-section-title">RECENT ACTIVITY</span>
          <div className="mini-activity">
            <div className="activity-row">
              <CheckCircle2 size={14} className="text-success" color="var(--semantic-success)" />
              <span className="text-truncate">Report sent to @acme.com</span>
            </div>
            <div className="activity-row">
              <Clock size={14} className="text-warning" color="var(--semantic-warning)" />
              <span className="text-truncate">Ingesting @techcorp.com</span>
            </div>
          </div>
        </div>
      </nav>
      
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar">SC</div>
          <div className="user-info">
            <span className="user-name">Sarah Chen</span>
            <span className="user-role">Financial Analyst</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
