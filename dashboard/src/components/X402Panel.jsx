import React, { useState } from 'react';
import { Bot, ArrowRight, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { payViaX402 } from '../api/liveApi';
import { shortenAddress } from '../hooks/usePhantomWallet';
import './X402Panel.css';

const AGENT_B_TREASURY = 'ABDpbo9dwKuKZVpQwcfcGCCzgLh6QYmDcnPDS6Qao6Bx';
const DEFAULT_SUBJECT = 'techcorp.com.sg';

const STEP_LABELS = {
  request: 'Request sent',
  '402': '402 Payment Required',
  signed: 'Payment signed',
  settled: 'Settled on-chain',
  aborted: 'Aborted',
  failed: 'Failed',
};

const X402Panel = () => {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onPay = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await payViaX402(subject));
    } catch (err) {
      // Only transport failures land here — a refused payment comes back as
      // a normal body with ok:false.
      setError(err?.message ?? 'Could not reach Agent A.');
    } finally {
      setBusy(false);
    }
  };

  const payment = result?.payment;

  return (
    <section className="x402-panel">
      <header className="x402-head">
        <h2>Agent-to-Agent Payment</h2>
        <span className="x402-sub">x402 · devnet USDC</span>
      </header>

      <div className="x402-flow">
        <div className="x402-agent">
          <Bot size={16} />
          <div>
            <strong>Agent A</strong>
            <span>buyer</span>
          </div>
        </div>
        <div className="x402-arrow">
          <span className="x402-amount">0.1 USDC</span>
          <ArrowRight size={16} />
        </div>
        <div className="x402-agent">
          <Bot size={16} />
          <div>
            <strong>Agent B</strong>
            <span>{shortenAddress(AGENT_B_TREASURY)}</span>
          </div>
        </div>
      </div>

      <label className="x402-field">
        <span>Report subject</span>
        <input
          type="text"
          value={subject}
          spellCheck={false}
          disabled={busy}
          onChange={(e) => setSubject(e.target.value)}
        />
      </label>

      <button type="button" className="x402-btn" onClick={onPay} disabled={busy || !subject}>
        {busy ? 'Paying…' : 'Buy report for 0.1 USDC'}
      </button>

      {error && <p className="x402-error" role="alert">{error}</p>}

      {result && (
        <div className="x402-result">
          <ol className="x402-steps">
            {(result.steps ?? []).map((s, i) => {
              const bad = s.step === 'aborted' || s.step === 'failed';
              return (
                <li key={`${s.step}-${i}`} className={bad ? 'bad' : 'good'}>
                  {bad ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                  <span className="x402-step-label">{STEP_LABELS[s.step] ?? s.step}</span>
                  <span className="x402-step-detail">{s.detail}</span>
                </li>
              );
            })}
          </ol>

          {result.ok === false && (
            <p className="x402-error" role="alert">
              {result.error}
            </p>
          )}

          {payment?.signature && (
            <div className="x402-settled">
              <div className="x402-settled-row">
                <span>Signature</span>
                <a href={payment.explorer} target="_blank" rel="noopener noreferrer">
                  {shortenAddress(payment.signature, 8, 8)} <ExternalLink size={11} />
                </a>
              </div>
              <div className="x402-settled-row">
                <span>Payer</span>
                <code>{shortenAddress(payment.payer ?? result.payer, 6, 6)}</code>
              </div>
              {result.elapsedMs != null && (
                <div className="x402-settled-row">
                  <span>Round trip</span>
                  <code>{result.elapsedMs} ms</code>
                </div>
              )}
            </div>
          )}

          {result.report && (
            <pre className="x402-report">{JSON.stringify(result.report, null, 2)}</pre>
          )}
        </div>
      )}
    </section>
  );
};

export default X402Panel;
