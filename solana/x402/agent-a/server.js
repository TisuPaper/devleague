// Agent A — x402 paying agent (the buyer).
//
// Exposes POST /pay. The dashboard button calls it; Agent A then fetches Agent
// B's paid resource, receives a 402, signs a 0.1 devnet USDC transfer, retries
// with the PAYMENT-SIGNATURE header, and returns the purchased content plus the
// settled transaction signature.
//
// This is the ONLY process in the repo holding a wallet signing key. It is kept
// out of the FastAPI backend on purpose: that process already carries Gmail
// OAuth, a GCP service-account key and Gemini credentials, and a spending key
// does not belong in the same blast radius.

import { readFileSync } from 'node:fs';
import express from 'express';
import { Keypair } from '@solana/web3.js';
import { createX402Client } from 'x402-solana';

const PORT = Number(process.env.PORT ?? 8401);
const NETWORK = process.env.NETWORK ?? 'solana-devnet';
const AGENT_B_URL = process.env.AGENT_B_URL ?? 'http://127.0.0.1:8402';
const KEYPAIR_PATH = process.env.AGENT_A_KEYPAIR;

// Hard ceiling on a single payment, in atomic USDC units. Enforced by the
// library BEFORE the 402's quoted price is acted on, so a compromised or buggy
// Agent B cannot quote an unbounded price and have us sign it.
const MAX_PAYMENT_ATOMIC = BigInt(process.env.MAX_PAYMENT_ATOMIC ?? '200000'); // 0.2 USDC

// The only address we are willing to pay. Checked in the beforePayment hook.
const EXPECTED_PAY_TO = process.env.EXPECTED_PAY_TO;

if (!KEYPAIR_PATH) {
  console.error('AGENT_A_KEYPAIR is required — see .env.example');
  process.exit(1);
}
if (!EXPECTED_PAY_TO) {
  console.error('EXPECTED_PAY_TO is required — refusing to pay an unconstrained address');
  process.exit(1);
}

function loadKeypair(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

const keypair = loadKeypair(KEYPAIR_PATH);

// x402-solana's WalletAdapter is framework-agnostic: publicKey plus a
// signTransaction. That lets a plain server-side Keypair stand in for a browser
// wallet, with no wallet-adapter dependency.
const wallet = {
  publicKey: keypair.publicKey,
  signTransaction: async (tx) => {
    tx.sign([keypair]);
    return tx;
  },
};

/**
 * Payment policy, run after the 402 is parsed but before anything is signed.
 *
 * This is the control that stops a redirected-payment attack: if Agent B (or
 * anything impersonating it) quotes a payTo that is not our expected treasury,
 * we abort and signTransaction is never called. Returning `{abort:true}` here
 * is strictly safer than validating after signing.
 */
const beforePayment = (requirements, context) => {
  const payTo = requirements.payTo;

  if (payTo !== EXPECTED_PAY_TO) {
    console.warn(`[agent-a] ABORT — payTo ${payTo} is not the expected treasury`);
    return { abort: true, reason: `unexpected payTo: ${payTo}` };
  }

  if (BigInt(requirements.amount) > MAX_PAYMENT_ATOMIC) {
    console.warn(`[agent-a] ABORT — quoted ${requirements.amount} exceeds cap`);
    return { abort: true, reason: `quote ${requirements.amount} over cap ${MAX_PAYMENT_ATOMIC}` };
  }

  console.log(
    `[agent-a] policy ok — paying ${requirements.amount} atomic to ${payTo} ` +
    `(x402 v${context.protocolVersion})`
  );
  return { abort: false };
};

const client = createX402Client({
  wallet,
  network: NETWORK,
  amount: MAX_PAYMENT_ATOMIC,
  beforePayment,
  verbose: process.env.VERBOSE === '1',
});

const app = express();
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, agent: 'A', network: NETWORK, payer: keypair.publicKey.toBase58() });
});

app.post('/pay', async (req, res) => {
  const subject = typeof req.body?.subject === 'string' ? req.body.subject : 'techcorp.com.sg';
  const target = `${AGENT_B_URL}/premium/risk-report?subject=${encodeURIComponent(subject)}`;

  const steps = [];
  const started = Date.now();

  try {
    steps.push({ step: 'request', detail: `GET ${target}` });

    // client.fetch handles the whole handshake: initial GET, 402 parse, policy
    // hook, sign, retry with PAYMENT-SIGNATURE.
    const response = await client.fetch(target, { method: 'GET' });

    if (!response.ok) {
      const body = await response.text();
      steps.push({ step: 'failed', detail: `HTTP ${response.status}` });
      return res.status(502).json({ ok: false, steps, status: response.status, body });
    }

    const payload = await response.json();
    steps.push({ step: '402', detail: 'payment required, quote received' });
    steps.push({ step: 'signed', detail: `paid by ${keypair.publicKey.toBase58()}` });
    steps.push({ step: 'settled', detail: payload.payment?.signature ?? 'unknown' });

    res.json({
      ok: true,
      elapsedMs: Date.now() - started,
      steps,
      payer: keypair.publicKey.toBase58(),
      ...payload,
    });
  } catch (err) {
    // A policy abort lands here too — that is the intended outcome, not a bug.
    console.error('[agent-a] payment failed:', err?.message);
    steps.push({ step: 'aborted', detail: err?.message ?? 'unknown error' });
    res.status(402).json({ ok: false, steps, error: err?.message ?? 'payment_failed' });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[agent-a] listening on http://127.0.0.1:${PORT}`);
  console.log(`[agent-a] payer=${keypair.publicKey.toBase58()} network=${NETWORK}`);
  console.log(`[agent-a] will only pay ${EXPECTED_PAY_TO}, max ${MAX_PAYMENT_ATOMIC} atomic`);
});
