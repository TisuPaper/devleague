import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Table2, BarChart3 } from 'lucide-react';
import { money, percentChange } from '../data/personalData';
import './SpendingBreakdown.css';

// One measure (ringgit) across categories, so this is a magnitude chart: a
// single hue for every bar. Categories are axis labels, not identities — giving
// each its own colour would imply a distinction that is not in the data.

const SpendingBreakdown = ({ categories, total }) => {
  const [asTable, setAsTable] = useState(false);

  // Magnitude reads top-down.
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const max = sorted[0]?.amount ?? 1;

  return (
    <section className="spend">
      <header className="spend-head">
        <div>
          <h2>Where it went</h2>
          <p className="spend-sub">{money(total)} across {sorted.length} categories</p>
        </div>
        <button
          type="button"
          className="spend-toggle"
          onClick={() => setAsTable((v) => !v)}
          title={asTable ? 'Show chart' : 'Show as table'}
          aria-label={asTable ? 'Show chart' : 'Show as table'}
        >
          {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
        </button>
      </header>

      {asTable ? (
        <table className="spend-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
              <th scope="col">Share</th>
              <th scope="col">vs July</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const change = percentChange(c.amount, c.prev);
              return (
                <tr key={c.id}>
                  <th scope="row">{c.name}</th>
                  <td>{money(c.amount)}</td>
                  <td>{((c.amount / total) * 100).toFixed(1)}%</td>
                  <td>
                    {change === null
                      ? '—'
                      : `${change > 0 ? '+' : ''}${(change * 100).toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <ul className="spend-bars">
          {sorted.map((c) => {
            const share = c.amount / total;
            const change = percentChange(c.amount, c.prev);
            // Notable movement only — a delta on every row is noise.
            const notable = change !== null && Math.abs(change) >= 0.1;

            return (
              <li key={c.id} className="spend-row" title={`${c.name} — ${c.detail}`}>
                <div className="spend-label">
                  <span className="spend-name">{c.name}</span>
                  {notable && (
                    <span className={`spend-delta ${change > 0 ? 'up' : 'down'}`}>
                      {change > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {Math.abs(change * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                <div className="spend-track">
                  <div
                    className="spend-fill"
                    style={{ width: `${Math.max((c.amount / max) * 100, 1.5)}%` }}
                  />
                </div>

                <div className="spend-values">
                  <span className="spend-amount">{money(c.amount, { decimals: 0 })}</span>
                  <span className="spend-share">{(share * 100).toFixed(1)}%</span>
                </div>

                <p className="spend-detail">{c.detail}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default SpendingBreakdown;
