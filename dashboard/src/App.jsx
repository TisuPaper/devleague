import React, { lazy, Suspense, useMemo, useState } from 'react';
import TopNav from './components/TopNav';
import OverviewPage from './components/OverviewPage';
import { useProcessedClients } from './hooks/useProcessedClients';
import { LIVE_CLIENT_DOMAIN } from './data/liveClient';
import './index.css';

// Split out: this page pulls in @solana/web3.js, which is most of the bundle.
// Nobody pays for it until they open the Payments tab.
const PaymentsPage = lazy(() => import('./components/PaymentsPage'));

const TAB_IDS = ['overview', 'payments'];

function App() {
  // Tab lives in the URL hash so a view can be linked or bookmarked, and a
  // reload keeps you where you were.
  const [activeTab, setActiveTab] = useState(() => {
    const fromHash = window.location.hash.replace('#', '');
    return TAB_IDS.includes(fromHash) ? fromHash : 'overview';
  });

  const selectTab = (tab) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  // Same backend feed as before (Gmail push -> analyse -> /api/clients); the
  // dashboard now reads it as the account owner's own statements rather than
  // as a roster of clients.
  const { clients: liveClients, status: liveStatus } = useProcessedClients();

  // Whatever the backend has actually processed. Prefer the configured live
  // domain, else the most recently active record, else nothing.
  const liveClient = useMemo(() => {
    if (!liveClients?.length) return null;
    return (
      liveClients.find((c) => c.domain === LIVE_CLIENT_DOMAIN) ?? liveClients[0]
    );
  }, [liveClients]);

  return (
    <div className="app-shell">
      <TopNav activeTab={activeTab} setActiveTab={selectTab} />
      <div className="page-area">
        {activeTab === 'overview' && (
          <OverviewPage liveClient={liveClient} liveStatus={liveStatus} />
        )}
        {activeTab === 'payments' && (
          <Suspense fallback={<div className="page-loading">Loading…</div>}>
            <PaymentsPage />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;
