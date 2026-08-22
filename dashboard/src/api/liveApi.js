// Thin fetch layer for the FastAPI backend.
//
// Requests go to a relative /api path so Vite's dev proxy (see vite.config.js)
// forwards them to the backend on :8000. Override with VITE_API_BASE_URL when
// the backend lives somewhere else.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const REQUEST_TIMEOUT_MS = 10000;

/**
 * Fetch every client the backend has actually processed email for.
 * Resolves to an array (empty if nothing processed yet).
 * Throws on network/HTTP failure so callers can surface a connection state.
 */
export async function fetchProcessedClients() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/api/clients`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload.clients) ? payload.clients : [];
  } finally {
    clearTimeout(timeout);
  }
}
