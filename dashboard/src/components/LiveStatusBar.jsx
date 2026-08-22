import React from 'react';
import { LIVE_CLIENT_DOMAIN } from '../data/liveClient';
import './LiveStatusBar.css';

/**
 * Thin connection indicator for the backend pipeline.
 *
 * Makes it obvious during a demo whether the dashboard is actually talking to
 * the backend -- otherwise an empty live client is indistinguishable from a
 * backend that is simply down.
 */
const LiveStatusBar = ({ status, error }) => {
  if (!status) return null;

  const config = {
    loading: { cls: 'lsb-loading', dot: 'lsb-dot-idle', text: 'Connecting to processing backend…' },
    ready:   { cls: 'lsb-ready',   dot: 'lsb-dot-live', text: `Live — watching email for ${LIVE_CLIENT_DOMAIN}` },
    error:   { cls: 'lsb-error',   dot: 'lsb-dot-down', text: 'Processing backend unreachable' },
  }[status];

  if (!config) return null;

  return (
    <div className={`live-status-bar ${config.cls}`} role="status">
      <span className={`lsb-dot ${config.dot}`} aria-hidden="true" />
      <span className="lsb-text">{config.text}</span>
      {status === 'error' && (
        <span className="lsb-hint">
          {error ? `${error} — ` : ''}start it with{' '}
          <code>uvicorn app.main:app --reload --port 8000</code>
        </span>
      )}
    </div>
  );
};

export default LiveStatusBar;
