import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProcessedClients } from '../api/liveApi';

const DEFAULT_POLL_MS = 5000;

/**
 * Poll the backend for clients it has actually processed.
 *
 * Polling rather than SSE/WebSocket on purpose: it is stateless, survives the
 * backend restarting or the ngrok tunnel dropping without any reconnect logic,
 * and a few seconds of latency is irrelevant for a pipeline whose upstream
 * (Gmail push -> Pub/Sub -> download -> AI analysis) already takes longer than
 * that. Swap in SSE later if sub-second updates ever matter.
 *
 * Returns { clients, status, error, lastUpdated, refresh } where status is
 * 'loading' | 'ready' | 'error'. A failed poll keeps the last good data and
 * only flips status to 'error', so a transient blip doesn't blank the UI.
 */
export function useProcessedClients(pollMs = DEFAULT_POLL_MS) {
  const [clients, setClients] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Avoids setting state after unmount, and lets us skip overlapping polls.
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const next = await fetchProcessedClients();
      if (!mountedRef.current) return;
      setClients(next);
      setStatus('ready');
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not reach backend');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();

    const interval = setInterval(load, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load, pollMs]);

  return { clients, status, error, lastUpdated, refresh: load };
}
