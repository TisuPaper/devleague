import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from 'lucide-react';
import RemindersWidget from './RemindersWidget';
import SpendingBreakdown from './SpendingBreakdown';
import AnalysisPanel from './AnalysisPanel';
import { buildPersonalView, profile, money, percentChange } from '../data/personalData';
import './OverviewPage.css';

/**
 * A headline figure with its month-on-month move.
 *
 * Deliberately a stat tile, not a chart: one number with one comparison does
 * not need a plot, and a sparkline here would add ink without adding meaning.
 * `goodWhenDown` flips the sense for spending, where a fall is the good news.
 */
const StatTile = ({
  label,
  value,
  prev,
  current,
  goodWhenDown = false,
  emphasis = false,
  // A rate moves in percentage points, not in percent-of-a-percent.
  asPoints = false,
}) => {
  const delta = asPoints ? current - prev : percentChange(current, prev);
  const negligible = delta === null || Math.abs(delta) < (asPoints ? 0.0005 : 0.005);
  const rising = delta !== null && delta > 0;
  const isGood = goodWhenDown ? !rising : rising;

  return (
    <div className={`stat ${emphasis ? 'emphasis' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {negligible ? (
        <span className="stat-delta flat">no change on July</span>
      ) : (
        <span className={`stat-delta ${isGood ? 'good' : 'bad'}`}>
          {rising ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta * 100).toFixed(1)}
          {asPoints ? 'pp' : '%'} on July
        </span>
      )}
    </div>
  );
};

const OverviewPage = ({ liveClient, liveStatus }) => {
  const view = useMemo(() => buildPersonalView(liveClient), [liveClient]);
  const { summary } = view;

  return (
    <div className="overview">
      <header className="overview-head">
        <div>
          <h1>Hello, {profile.name}</h1>
          <p className="overview-sub">
            {[profile.statementPeriod, profile.accountLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`overview-conn ${liveStatus === 'error' ? 'down' : 'up'}`}>
          {liveStatus === 'error' ? <WifiOff size={12} /> : <Wifi size={12} />}
          {liveStatus === 'error' ? 'Inbox offline' : 'Inbox connected'}
        </span>
      </header>

      <div className="overview-stats">
        <StatTile
          label="Money in"
          value={money(summary.moneyIn, { decimals: 0 })}
          current={summary.moneyIn}
          prev={summary.prevMoneyIn}
        />
        <StatTile
          label="Money out"
          value={money(summary.moneyOut, { decimals: 0 })}
          current={summary.moneyOut}
          prev={summary.prevMoneyOut}
          goodWhenDown
        />
        <StatTile
          label="Net saved"
          value={money(summary.netSaved, { decimals: 0 })}
          current={summary.netSaved}
          prev={summary.prevNetSaved}
          emphasis
        />
        <StatTile
          label="Savings rate"
          value={`${(summary.savingsRate * 100).toFixed(1)}%`}
          current={summary.savingsRate}
          prev={summary.prevSavingsRate}
          asPoints
        />
      </div>

      <RemindersWidget reminders={view.reminders} />

      <div className="overview-grid">
        <SpendingBreakdown categories={view.categories} total={summary.moneyOut} />
        <AnalysisPanel view={view} />
      </div>
    </div>
  );
};

export default OverviewPage;
