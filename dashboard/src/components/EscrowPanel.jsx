import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePhantomWallet, shortenAddress } from '../hooks/usePhantomWallet';
import {
  deposit,
  release,
  fetchEscrow,
  deriveEscrowPda,
  describeSolanaError,
  isProgramDeployed,
  explorerTx,
  explorerAddress,
  ESCROW_LAMPORTS,
  PROGRAM_ID,
} from '../solana/escrowClient';
import './EscrowPanel.css';

// The two demo wallets. Whichever one is connected, default to paying the
// other — escrowing to yourself works but makes for a confusing demo.
const DEMO_WALLETS = [
  'ABDpbo9dwKuKZVpQwcfcGCCzgLh6QYmDcnPDS6Qao6Bx',
  'FjFVMZJb6Em3cqxTm4NL9oP84t4t6E79LTeoAk4L6j5W',
];

const SOL = ESCROW_LAMPORTS / 1_000_000_000;

function defaultRecipientFor(maker) {
  return DEMO_WALLETS.find((w) => w !== maker) ?? DEMO_WALLETS[0];
}

const EscrowPanel = () => {
  const { status, publicKey, connect, signTransaction } = usePhantomWallet();
  // Null until the user edits it, so the default can follow the connected
  // wallet instead of being frozen at mount time.
  const [recipientOverride, setRecipientOverride] = useState(null);
  // Stored with the wallet it was fetched for, so a disconnect or an account
  // switch in Phantom derives back to null instead of leaving another wallet's
  // escrow on screen.
  const [escrowFor, setEscrowFor] = useState(null);
  const [deployed, setDeployed] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [lastSignature, setLastSignature] = useState(null);

  const connected = status === 'connected' && publicKey;
  const escrow = escrowFor?.key === publicKey ? escrowFor.data : null;
  const recipient = recipientOverride ?? defaultRecipientFor(publicKey);

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await fetchEscrow(publicKey);
      setEscrowFor({ key: publicKey, data });
      setError(null);
    } catch (err) {
      setError(describeSolanaError(err));
    }
  }, [connected, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Checked once on mount so an undeployed program is a clear banner, not a
  // simulation failure the user only sees after approving a Phantom prompt.
  useEffect(() => {
    let cancelled = false;
    isProgramDeployed().then((result) => {
      if (!cancelled) setDeployed(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      const { signature } = await fn();
      setLastSignature(signature);
      await refresh();
    } catch (err) {
      setError(describeSolanaError(err));
    } finally {
      setBusy(null);
    }
  };

  const onDeposit = () =>
    run('deposit', () => deposit({ maker: publicKey, recipient, signTransaction }));

  // The escrow's own recorded recipient is used, never the input field — the
  // program rejects a substituted one anyway, but sending the right account
  // avoids a guaranteed-failed transaction.
  const onRelease = () =>
    run('release', () =>
      release({
        cranker: publicKey,
        maker: escrow.maker,
        recipient: escrow.recipient,
        signTransaction,
      })
    );

  if (!connected) {
    return (
      <section className="escrow-panel">
        <header className="escrow-head">
          <h2>SOL Escrow</h2>
          <span className="escrow-sub">devnet</span>
        </header>
        <p className="escrow-empty">
          Connect your Phantom wallet to deposit and release.
        </p>
        <button type="button" className="escrow-btn primary" onClick={connect}>
          Connect Wallet
        </button>
      </section>
    );
  }

  return (
    <section className="escrow-panel">
      <header className="escrow-head">
        <h2>SOL Escrow</h2>
        <span className="escrow-sub">devnet</span>
        <button
          type="button"
          className="escrow-icon-btn"
          onClick={refresh}
          title="Refresh escrow state"
          aria-label="Refresh escrow state"
        >
          <RefreshCw size={14} />
        </button>
      </header>

      <dl className="escrow-meta">
        <div>
          <dt>Program</dt>
          <dd>
            <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">
              {shortenAddress(PROGRAM_ID.toBase58(), 6, 6)} <ExternalLink size={11} />
            </a>
          </dd>
        </div>
        <div>
          <dt>Maker (you)</dt>
          <dd>{shortenAddress(publicKey, 6, 6)}</dd>
        </div>
        <div>
          <dt>Escrow PDA</dt>
          <dd>{shortenAddress(deriveEscrowPda(publicKey).toBase58(), 6, 6)}</dd>
        </div>
      </dl>

      {escrow ? (
        <div className="escrow-state live">
          <div className="escrow-state-row">
            <span className="escrow-badge">Locked</span>
            <strong>{escrow.amountLamports / 1_000_000_000} SOL</strong>
          </div>
          <p className="escrow-state-detail">
            Payable to <code>{shortenAddress(escrow.recipient, 6, 6)}</code>. Anyone may
            release it, but only to that address.
          </p>
        </div>
      ) : (
        <div className="escrow-state">
          <span className="escrow-badge idle">Empty</span>
          <p className="escrow-state-detail">No live escrow for this wallet.</p>
        </div>
      )}

      {deployed === false && (
        <div className="escrow-notice" role="status">
          <AlertTriangle size={14} />
          <div>
            <strong>Program not deployed</strong>
            <p>
              Nothing is live at <code>{shortenAddress(PROGRAM_ID.toBase58(), 6, 6)}</code> on
              devnet yet. Deposit stays disabled until it is — otherwise the transaction
              fails after you have already approved it in Phantom.
            </p>
          </div>
        </div>
      )}

      <label className="escrow-field">
        <span>Recipient</span>
        <input
          type="text"
          value={recipient}
          spellCheck={false}
          disabled={Boolean(escrow) || busy !== null}
          onChange={(e) => setRecipientOverride(e.target.value.trim())}
        />
      </label>

      <div className="escrow-actions">
        <button
          type="button"
          className="escrow-btn primary"
          onClick={onDeposit}
          disabled={Boolean(escrow) || busy !== null || !recipient || deployed === false}
        >
          <Lock size={14} />
          {busy === 'deposit' ? 'Confirm in Phantom…' : `Deposit ${SOL} SOL`}
        </button>

        <button
          type="button"
          className="escrow-btn"
          onClick={onRelease}
          disabled={!escrow || busy !== null || deployed === false}
        >
          <Unlock size={14} />
          {busy === 'release' ? 'Confirm in Phantom…' : 'Release'}
        </button>
      </div>

      {error && <p className="escrow-error" role="alert">{error}</p>}

      {lastSignature && (
        <a
          className="escrow-link"
          href={explorerTx(lastSignature)}
          target="_blank"
          rel="noopener noreferrer"
        >
          View last transaction <ExternalLink size={12} />
        </a>
      )}
    </section>
  );
};

export default EscrowPanel;
