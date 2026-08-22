import React, { useMemo } from 'react';
import ClientTable from './ClientTable';
import RecentActivity from './RecentActivity';
import { mockClients, globalRecentActivity } from '../data/mockData';
import './DashboardPage.css';

const DashboardPage = ({ onSelectClient }) => {
  const sortedClients = useMemo(
    () => [...mockClients].sort((a, b) => b.lastActivityTimestamp - a.lastActivityTimestamp),
    []
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <section className="dashboard-main" aria-label="Client list">
          <ClientTable
            clients={sortedClients}
            onSelectClient={onSelectClient}
          />
        </section>
        <aside className="dashboard-sidebar" aria-label="Recent activity">
          <RecentActivity activities={globalRecentActivity} />
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
