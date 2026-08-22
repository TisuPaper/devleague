import { useCallback, useEffect, useRef, useState } from 'react';

// Phantom can inject a little after first paint, so a single check on mount
// can report "not installed" for a wallet that shows up 200ms later. Poll a
// handful of times and then give up rather than leaving a timer running.
const DETECT_INTERVAL_MS = 250;
const DETECT_ATTEMPTS = 12;

// Phantom (EIP-1193 style) uses 4001 for "user rejected the request". That is
// a normal outcome, not a failure worth surfacing as an error banner.
const USER_REJECTED = 4001;

/**
 * Resolve the injected Phantom provider, or null.
 *
 * Phantom's own namespace is window.phantom.solana. window.solana is the
 * legacy alias that other extensions also squat on, so isPhantom is checked
 * on whichever we find — we never hand a connect() call to an unidentified
 * object that happens to be sitting on window.
 */
function getProvider() {
  if (typeof window === 'undefined') return null;
  const provider = window.phantom?.solana ?? window.solana;
  return provider?.isPhantom ? provider : null;
}

/**
 * Connect the dashboard to a user's Phantom wallet.
 *
 * Talks to the injected provider directly instead of pulling in
 * @solana/wallet-adapter — one wallet, one origin, no extra dependency to
 * audit or keep patched.
 *
 * IMPORTANT: this is wallet *association*, not authentication. A public key
 * read from the browser proves nothing to a server — anything privileged must
 * verify a signed nonce (sign-in-with-Solana) server-side before trusting the
 * address. Nothing here should ever be treated as an authorization decision.
 *
 * Returns { status, publicKey, error, connect, disconnect } where status is
 * 'detecting' | 'unsupported' | 'disconnected' | 'connecting' | 'connected'.
 */
export function usePhantomWallet() {
  const [provider, setProvider] = useState(() => getProvider());
  const [status, setStatus] = useState(() => (getProvider() ? 'disconnected' : 'detecting'));
  const [publicKey, setPublicKey] = useState(null);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Wait for a late injection before declaring Phantom absent.
  useEffect(() => {
    if (provider) return undefined;

    let attempts = 0;
    const timer = setInterval(() => {
      const found = getProvider();
      attempts += 1;

      if (found) {
        clearInterval(timer);
        if (!mountedRef.current) return;
        setProvider(found);
        setStatus('disconnected');
      } else if (attempts >= DETECT_ATTEMPTS) {
        clearInterval(timer);
        if (!mountedRef.current) return;
        setStatus('unsupported');
      }
    }, DETECT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [provider]);

  // Keep the displayed key in step with the extension. Without accountChanged
  // the UI happily shows a stale address after the user switches wallets in
  // Phantom, which is exactly the kind of wrong-identity display that causes
  // someone to act on the wrong account.
  useEffect(() => {
    if (!provider) return undefined;

    const handleConnect = (key) => {
      if (!mountedRef.current) return;
      setPublicKey(key?.toString() ?? null);
      setStatus('connected');
      setError(null);
    };

    const handleDisconnect = () => {
      if (!mountedRef.current) return;
      setPublicKey(null);
      setStatus('disconnected');
    };

    const handleAccountChanged = (key) => {
      if (!mountedRef.current) return;
      if (key) {
        setPublicKey(key.toString());
        setStatus('connected');
        return;
      }
      // Phantom emits accountChanged with no key when the user disconnects
      // this origin from inside the extension. Drop the session immediately.
      setPublicKey(null);
      setStatus('disconnected');
    };

    provider.on('connect', handleConnect);
    provider.on('disconnect', handleDisconnect);
    provider.on('accountChanged', handleAccountChanged);

    return () => {
      provider.off?.('connect', handleConnect);
      provider.off?.('disconnect', handleDisconnect);
      provider.off?.('accountChanged', handleAccountChanged);
    };
  }, [provider]);

  // Silent reconnect for an origin the user already approved. onlyIfTrusted
  // means Phantom resolves without prompting, or rejects — it can never
  // create a new approval behind the user's back.
  useEffect(() => {
    if (!provider) return;

    provider
      .connect({ onlyIfTrusted: true })
      .then(({ publicKey: key }) => {
        if (!mountedRef.current) return;
        setPublicKey(key.toString());
        setStatus('connected');
      })
      .catch(() => {
        // Not previously trusted. Expected; stay disconnected.
      });
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      window.open('https://phantom.com/download', '_blank', 'noopener,noreferrer');
      return;
    }

    setError(null);
    setStatus('connecting');

    try {
      const { publicKey: key } = await provider.connect();
      if (!mountedRef.current) return;
      setPublicKey(key.toString());
      setStatus('connected');
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      if (err?.code !== USER_REJECTED) {
        setError(err?.message ?? 'Could not connect to Phantom.');
      }
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.disconnect();
    } catch {
      // Ignore — the local session is cleared either way.
    }

    if (!mountedRef.current) return;
    setPublicKey(null);
    setStatus('disconnected');
    setError(null);
  }, [provider]);

  // Signing is deliberately a thin pass-through to the extension. The private
  // key never leaves Phantom; the page only ever hands over an unsigned
  // transaction and gets a signed one back, with Phantom prompting the user.
  const signTransaction = useCallback(
    async (transaction) => {
      if (!provider) throw new Error('Phantom is not connected.');
      return provider.signTransaction(transaction);
    },
    [provider]
  );

  const signAllTransactions = useCallback(
    async (transactions) => {
      if (!provider) throw new Error('Phantom is not connected.');
      // Older provider builds may not implement the batch call; fall back to
      // sequential prompts rather than failing outright.
      if (typeof provider.signAllTransactions === 'function') {
        return provider.signAllTransactions(transactions);
      }
      const signed = [];
      for (const tx of transactions) {
        signed.push(await provider.signTransaction(tx));
      }
      return signed;
    },
    [provider]
  );

  return {
    status,
    publicKey,
    error,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
  };
}

/** Shorten a base58 address for display: 7xKX…gAsU. */
export function shortenAddress(address, lead = 4, tail = 4) {
  if (!address || address.length <= lead + tail + 1) return address ?? '';
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
