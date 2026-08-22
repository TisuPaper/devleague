import React, { useMemo } from 'react';
import ClientTable from './ClientTable';
import RecentActivity from './RecentActivity';
import LiveStatusBar from './LiveStatusBar';
import { mockClients, globalRecentActivity } from '../data/mockData';
import './DashboardPage.css';

const DashboardPage = ({ clients, liveStatus, liveError, onSelectClient }) => {
  // Falls back to the demo records when no list is supplied, so this component
  // still works standalone.
  const source = clients ?? mockClients;

  const sortedClients = useMemo(
    () => [...source].sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp),
    [source]
  );

  // Activity from real processed email, newest first, shown above the demo feed.
  const liveActivity = useMemo(() => {
    return source
      .filter(c => c.isLive)
      .flatMap(c =>
        (c.activity || []).map(item => ({
          id: `${c.domain}-${item.id}`,
          domain: c.domain,
          action: item.note,
          time: item.timestamp,
          type: item.type,
        }))
      );
  }, [source]);

  return (
    <div className="dashboard-page">
      <LiveStatusBar status={liveStatus} error={liveError} />
      <div className="dashboard-layout">
        <section className="dashboard-main" aria-label="Client list">
          <ClientTable
            clients={sortedClients}
            onSelectClient={onSelectClient}
          />
        </section>
        <aside className="dashboard-sidebar" aria-label="Recent activity">
          <RecentActivity activities={[...liveActivity, ...globalRecentActivity]} />
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
