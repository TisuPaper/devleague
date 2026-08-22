import React, { useCallback, useEffect, useState } from 'react';
import {
  Lock,
  Unlock,
  Wallet,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { usePhantomWallet, shortenAddress } from '../hooks/usePhantomWallet';
import {
  deposit,
  release,
  fetchEscrow,
  isProgramDeployed,
  describeSolanaError,
  explorerTx,
  ESCROW_LAMPORTS,
} from '../solana/escrowClient';
import { payViaX402 } from '../api/liveApi';
import './ReportSettlement.css';

const SOL_FEE = ESCROW_LAMPORTS / 1_000_000_000;
const USDC_FEE = '0.10';

// The analysis provider. Receives the escrowed SOL on release, and is also the
// treasury Agent B is paid into — the same operator, two different rails.
const PROVIDER = 'ABDpbo9dwKuKZVpQwcfcGCCzgLh6QYmDcnPDS6Qao6Bx';
const FALLBACK_PROVIDER = 'FjFVMZJb6Em3cqxTm4NL9oP84t4t6E79LTeoAk4L6j5W';

/**
 * The three-step settlement for one report.
 *
 *   1 Lock    you escrow the fee on-chain, so the provider knows it is good
 *   2 Pay     the analysis agent buys the premium data it needs, over x402
 *   3 Release the report is delivered, so the escrow pays out to the provider
 *
 * Release is deliberately gated on step 2: releasing before the report exists
 * would hand over the fee for nothing, which is the whole thing an escrow is
 * supposed to prevent. The on-chain program cannot see the report — it is
 * permissionless and would release whenever asked — so this gate is a UI
 * guard, not a security control. See solana/README.md.
 */
const ReportSettlement = () => {
  const { status, publicKey, connect, signTransaction } = usePhantomWallet();
  const connected = status === 'connected' && publicKey;

  const [escrowFor, setEscrowFor] = useState(null);
  const [deployed, setDeployed] = useState(null);
  const [paid, setPaid] = useState(null);
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState({});
  const [signatures, setSignatures] = useState({});

  const escrow = escrowFor?.key === publicKey ? escrowFor.data : null;
  const provider = publicKey === PROVIDER ? FALLBACK_PROVIDER : PROVIDER;

  const refresh = useCallback(async () => {
    if (!connected) return;
    try {
      const data = await fetchEscrow(publicKey);
      setEscrowFor({ key: publicKey, data });
    } catch (err) {
      setErrors((e) => ({ ...e, lock: describeSolanaError(err) }));
    }
  }, [connected, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    isProgramDeployed().then((r) => {
      if (!cancelled) setDeployed(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (step, fn) => {
    setBusy(step);
    setErrors((e) => ({ ...e, [step]: null }));
    try {
      await fn();
    } catch (err) {
      setErrors((e) => ({ ...e, [step]: describeSolanaError(err) }));
    } finally {
      setBusy(null);
    }
  };

  const onLock = () =>
    run('lock', async () => {
      const { signature } = await deposit({
        maker: publicKey,
        recipient: provider,
        signTransaction,
      });
      setSignatures((s) => ({ ...s, lock: signature }));
      await refresh();
    });

  const onPay = () =>
    run('pay', async () => {
      const payload = await payViaX402('August 2026 statement');
      if (!payload?.ok) throw new Error(payload?.error ?? 'Payment refused.');
      setPaid(payload);
    });

  const onRelease = () =>
    run('release', async () => {
      const { signature } = await release({
        cranker: publicKey,
        maker: escrow.maker,
        recipient: escrow.recipient,
        signTransaction,
      });
      setSignatures((s) => ({ ...s, release: signature }));
      setPaid(null);
      await refresh();
    });

  const locked = Boolean(escrow);
  const isPaid = Boolean(paid);
  const blocked = deployed === false;

  if (!connected) {
    return (
      <section className="settle">
        <header className="settle-head">
          <h2>Report settlement</h2>
          <p>Connect your wallet to escrow and pay for this report.</p>
        </header>
        <button type="button" className="settle-connect" onClick={connect}>
          <Wallet size={14} /> Connect Wallet
        </button>
      </section>
    );
  }

  const steps = [
    {
      key: 'lock',
      n: 1,
      title: 'Lock the fee',
      body: `${SOL_FEE} SOL held on-chain, payable only to ${shortenAddress(provider)}. You cannot redirect it once locked.`,
      done: locked,
      doneLabel: `${SOL_FEE} SOL escrowed`,
      action: 'Lock 0.1 SOL',
      busyLabel: 'Confirm in Phantom…',
      onClick: onLock,
      disabled: locked || blocked,
      hint: blocked ? 'Escrow program is not deployed.' : null,
    },
    {
      key: 'pay',
      n: 2,
      title: 'Buy the report',
      body: `The analysis agent pays ${USDC_FEE} USDC over x402 for the premium data behind your report.`,
      done: isPaid,
      doneLabel: paid ? `Settled in ${paid.elapsedMs} ms` : 'Settled',
      action: `Pay ${USDC_FEE} USDC`,
      busyLabel: 'Paying…',
      onClick: onPay,
      disabled: !locked || isPaid,
      hint: !locked ? 'Lock the fee first.' : null,
    },
    {
      key: 'release',
      n: 3,
      title: 'Release to provider',
      body: `Report delivered — pay the escrowed ${SOL_FEE} SOL out to the provider and close the escrow.`,
      done: false,
      action: 'Release',
      busyLabel: 'Confirm in Phantom…',
      onClick: onRelease,
      disabled: !locked || !isPaid,
      hint: !locked
        ? 'Nothing escrowed yet.'
        : !isPaid
        ? 'Only after the report is paid for.'
        : null,
    },
  ];

  return (
    <section className="settle">
      <header className="settle-head">
        <div>
          <h2>Report settlement</h2>
          <p>August 2026 statement analysis · devnet</p>
        </div>
        <span className={`settle-badge ${locked ? 'live' : ''}`}>
          {locked ? 'In escrow' : 'Not started'}
        </span>
      </header>

      {blocked && (
        <div className="settle-warn" role="status">
          <AlertTriangle size={13} />
          <span>The escrow program is not deployed to devnet, so locking is disabled.</span>
        </div>
      )}

      <ol className="settle-steps">
        {steps.map((s) => (
          <li key={s.key} className={`settle-step ${s.done ? 'done' : ''} ${s.disabled && !s.done ? 'waiting' : ''}`}>
            <span className="settle-n">{s.done ? <CheckCircle2 size={14} /> : s.n}</span>

            <div className="settle-copy">
              <span className="settle-title">{s.title}</span>
              <p>{s.body}</p>

              {errors[s.key] && (
                <p className="settle-error" role="alert">
                  <XCircle size={12} /> {errors[s.key]}
                </p>
              )}

              {s.done && s.doneLabel && (
                <p className="settle-ok">
                  <CheckCircle2 size={12} /> {s.doneLabel}
                </p>
              )}

              {signatures[s.key] && (
                <a
                  className="settle-link"
                  href={explorerTx(signatures[s.key])}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View transaction <ExternalLink size={10} />
                </a>
              )}

              {s.key === 'pay' && paid?.payment?.explorer && (
                <a
                  className="settle-link"
                  href={paid.payment.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View settlement <ExternalLink size={10} />
                </a>
              )}
            </div>

            <div className="settle-act">
              <button
                type="button"
                className={`settle-btn ${s.n === 1 ? 'primary' : ''}`}
                onClick={s.onClick}
                disabled={s.disabled || busy !== null}
              >
                {busy === s.key ? (
                  <><Loader2 size={13} className="settle-spin" /> {s.busyLabel}</>
                ) : (
                  <>
                    {s.key === 'lock' && <Lock size={13} />}
                    {s.key === 'release' && <Unlock size={13} />}
                    {s.action}
                  </>
                )}
              </button>
              {s.hint && <span className="settle-hint">{s.hint}</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default ReportSettlement;
