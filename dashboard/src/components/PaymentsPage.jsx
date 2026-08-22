import React, { useCallback, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import ReportSettlement from './ReportSettlement';
import './PaymentsPage.css';

const AUTO_ANALYSE_KEY = 'exia.autoAnalyse';

/** Whether new statements are analysed automatically as they arrive. */
const AutoAnalyse = () => {
  const [enabled, setEnabled] = useState(() => {
    // Wrapped: storage throws outright in some privacy modes.
    try {
      return localStorage.getItem(AUTO_ANALYSE_KEY) !== 'off';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_ANALYSE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Preference simply will not persist. Not worth surfacing.
    }
  }, [enabled]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return (
    <section className="pay-card">
      <header className="pay-head">
        <span className="pay-icon"><Zap size={15} /></span>
        <div>
          <h2>Auto-analyse</h2>
          <p className="pay-sub">New statements arriving by email</p>
        </div>
      </header>

      <div className="auto-row">
        <div className="auto-copy">
          <span className="auto-state">{enabled ? 'On' : 'Off'}</span>
          <p>
            {enabled
              ? 'Statements are analysed the moment they arrive, and a fee is raised per report.'
              : 'Statements are stored but not analysed. You choose what to run, and owe nothing until you do.'}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Auto-analyse incoming statements"
          className={`auto-switch ${enabled ? 'on' : ''}`}
          onClick={toggle}
        >
          <span className="auto-knob" />
        </button>
      </div>

      <p className="pay-note">
        {enabled
          ? 'Turn this off if you would rather approve each analysis before it runs.'
          : 'While off, nothing is sent to the analysis model.'}
      </p>
    </section>
  );
};

const PaymentsPage = () => (
  <div className="payments-page">
    <div className="payments-intro">
      <h1>Payments</h1>
      <p>
        Escrow the fee, buy the report, then release. The escrow only pays out once
        the report has actually been paid for.
      </p>
    </div>

    <div className="payments-stack">
      <ReportSettlement />
      <AutoAnalyse />
    </div>
  </div>
);

export default PaymentsPage;
