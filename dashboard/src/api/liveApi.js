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

// Settlement waits on the facilitator and on devnet confirmation, so it needs a
// far longer budget than a normal read.
const X402_TIMEOUT_MS = 60000;

/**
 * Ask Agent A to buy Agent B's premium report over x402.
 *
 * Resolves to the agent's own JSON on both outcomes — a refused or failed
 * payment comes back with `ok: false` and the handshake `steps` intact, which
 * is what the UI needs to show where it stopped. Only transport failures throw.
 */
export async function payViaX402(subject) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), X402_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}/x402/pay`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ subject }),
    });

    // 402 is a normal protocol outcome here, not a transport error.
    const payload = await response.json().catch(() => null);
    if (payload) return payload;

    throw new Error(`Agent A returned ${response.status} with no JSON body`);
  } finally {
    clearTimeout(timeout);
  }
}
