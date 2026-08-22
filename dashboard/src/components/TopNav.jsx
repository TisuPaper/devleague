import React from 'react';
import ConnectWalletButton from './ConnectWalletButton';
import './TopNav.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'payments', label: 'Payments' },
];

const TopNav = ({ activeTab, setActiveTab }) => {
  return (
    <nav className="top-nav" role="navigation" aria-label="Main navigation">
      <div className="top-nav-brand">
        <div className="exia-logo">E</div>
        <span className="exia-title">Exia</span>
      </div>

      <div className="top-nav-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`top-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="top-nav-actions">
        <ConnectWalletButton />
      </div>
    </nav>
  );
};

export default TopNav;
