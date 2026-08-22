// Agent B — x402 resource server (the seller).
//
// Sells one premium resource for 0.1 devnet USDC over the x402 protocol:
// an unpaid GET returns 402 with payment requirements, a GET carrying a valid
// PAYMENT-SIGNATURE header is verified and settled through the facilitator and
// then returns the content.
//
// Holds no private key at all — it only ever names a treasury address to be
// paid into. That is why this process, unlike Agent A, is safe to expose.

import express from 'express';
import { X402PaymentHandler } from 'x402-solana/server';
import { getDefaultTokenAsset } from 'x402-solana';

const PORT = Number(process.env.PORT ?? 8402);
const NETWORK = process.env.NETWORK ?? 'solana-devnet';
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? 'https://facilitator.payai.network';
const TREASURY = process.env.TREASURY_ADDRESS;
const PRICE_ATOMIC = process.env.PRICE_ATOMIC ?? '100000'; // 0.1 USDC @ 6dp
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? `http://127.0.0.1:${PORT}`;

if (!TREASURY) {
  console.error('TREASURY_ADDRESS is required — see .env.example');
  process.exit(1);
}

const handler = new X402PaymentHandler({
  network: NETWORK,
  treasuryAddress: TREASURY,
  facilitatorUrl: FACILITATOR_URL,
});

// USDC on the configured network. Taken from the library rather than hardcoded
// so the mint can never drift out of step with the network setting.
const ASSET = getDefaultTokenAsset(NETWORK);

const ROUTE_CONFIG = {
  amount: PRICE_ATOMIC,
  asset: ASSET,
  description: 'Premium counterparty risk report',
  mimeType: 'application/json',
  maxTimeoutSeconds: 120,
};

// --- Upstream workaround: x402-solana@3.0.0 picks the wrong fee payer -------
//
// FacilitatorClient.getFeePayer matches the facilitator's /supported list with:
//
//   kind.network.includes("devnet") === network.includes("devnet")
//
// but by then `network` has been normalised to CAIP-2, and the devnet CAIP-2
// id ("solana:EtWTRABZ…") contains no "devnet" substring. So the comparison is
// false === false against the mainnet entry, which matches first and wins.
// Result: a devnet-configured server advertises the MAINNET fee payer
// (CjNFTjv…), which holds no devnet SOL, and every payment dies at simulation
// with `transaction_simulation_failed`.
//
// Resolve it ourselves by exact CAIP-2 match instead of substring guessing.
// Remove once upstream fixes getFeePayer.
const FEE_PAYER_TTL_MS = 5 * 60 * 1000;
let feePayerCache = { value: null, at: 0 };

async function resolveFeePayer() {
  const now = Date.now();
  if (feePayerCache.value && now - feePayerCache.at < FEE_PAYER_TTL_MS) {
    return feePayerCache.value;
  }

  const caip2 = handler.getNetwork();
  const response = await fetch(`${FACILITATOR_URL}/supported`);
  if (!response.ok) throw new Error(`facilitator /supported returned ${response.status}`);

  const { kinds = [] } = await response.json();
  const match = kinds.find(
    (k) => k.scheme === 'exact' && k.network === caip2 && k.x402Version === 2
  );

  if (!match?.extra?.feePayer) {
    throw new Error(`facilitator declares no exact/v2 fee payer for ${caip2}`);
  }

  feePayerCache = { value: match.extra.feePayer, at: now };
  return feePayerCache.value;
}

// Settled payments, keyed by facilitator tx signature. Belt-and-braces against
// a replayed PAYMENT-SIGNATURE: the chain already rejects a double-spend, but
// this stops us re-serving paid content off a duplicate header without a second
// settlement. In-memory on purpose — a demo, not a ledger. A real deployment
// needs this in a shared store, or two instances would each honour the replay.
const settled = new Set();

const app = express();
app.use(express.json({ limit: '32kb' }));

// The thing being sold. Deliberately boring, deterministic content — the point
// of the demo is the payment handshake, not the payload.
function riskReport(subject) {
  return {
    subject,
    generatedAt: new Date().toISOString(),
    creditScore: 782,
    tier: 'A-',
    exposureLimitUsd: 2_500_000,
    flags: ['no adverse media', 'filings current'],
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, agent: 'B', network: NETWORK, treasury: TREASURY });
});

app.get('/premium/risk-report', async (req, res) => {
  const subject = typeof req.query.subject === 'string' ? req.query.subject : 'techcorp.com.sg';
  const resourceUrl = `${PUBLIC_BASE}/premium/risk-report`;

  let requirements;
  try {
    requirements = await handler.createPaymentRequirements(ROUTE_CONFIG, resourceUrl);
    // Must be corrected before the requirements are quoted AND before they are
    // passed to verify/settle — the client builds the transaction from these,
    // and the facilitator checks the transaction against them.
    requirements.extra.feePayer = await resolveFeePayer();
  } catch (err) {
    console.error('[agent-b] could not build payment requirements:', err?.message);
    return res.status(503).json({ error: 'payment_requirements_unavailable' });
  }

  const paymentHeader = handler.extractPayment(req.headers);

  // No payment yet — quote the price. This is the actual HTTP 402.
  if (!paymentHeader) {
    const { status, body } = handler.create402Response(requirements, resourceUrl);

    // The client picks its protocol version off the presence of this header,
    // NOT off `x402Version` in the body. Omit it and the client silently falls
    // back to v1, sends `X-PAYMENT`, and this server — which only reads
    // `PAYMENT-SIGNATURE` — never sees a payment, so the handshake loops on 402
    // forever with nothing logged as an error. The library exports no encoder;
    // decode is JSON.parse(base64), so encode is the exact inverse.
    res.setHeader(
      'PAYMENT-REQUIRED',
      Buffer.from(JSON.stringify(body), 'utf8').toString('base64')
    );

    console.log(`[agent-b] 402 quoted ${PRICE_ATOMIC} atomic to ${req.ip}`);
    return res.status(status).json(body);
  }

  // Verify BEFORE settling. verifyPayment checks the signed transaction against
  // the requirements this server generated — amount, mint, network and payTo —
  // so a client cannot talk us into accepting a cheaper or misdirected payment.
  let verification;
  try {
    verification = await handler.verifyPayment(paymentHeader, requirements);
  } catch (err) {
    console.error('[agent-b] verify threw:', err?.message);
    return res.status(502).json({ error: 'facilitator_unreachable', stage: 'verify' });
  }

  if (!verification.isValid) {
    console.warn(`[agent-b] payment rejected: ${verification.invalidReason}`);
    return res.status(402).json({
      error: 'payment_invalid',
      reason: verification.invalidReason,
    });
  }

  let settlement;
  try {
    settlement = await handler.settlePayment(paymentHeader, requirements);
  } catch (err) {
    console.error('[agent-b] settle threw:', err?.message);
    return res.status(502).json({ error: 'facilitator_unreachable', stage: 'settle' });
  }

  if (!settlement.success) {
    console.warn(`[agent-b] settlement failed: ${settlement.errorReason}`);
    return res.status(402).json({
      error: 'settlement_failed',
      reason: settlement.errorReason,
    });
  }

  if (settled.has(settlement.transaction)) {
    console.warn(`[agent-b] replay blocked for ${settlement.transaction}`);
    return res.status(409).json({ error: 'payment_already_used' });
  }
  settled.add(settlement.transaction);

  // Log the signature and payer only — both are public on-chain facts.
  console.log(`[agent-b] settled ${settlement.transaction} from ${settlement.payer}`);

  res.json({
    report: riskReport(subject),
    payment: {
      signature: settlement.transaction,
      payer: settlement.payer,
      network: settlement.network,
      amountAtomic: settlement.amount ?? PRICE_ATOMIC,
      explorer: `https://explorer.solana.com/tx/${settlement.transaction}?cluster=devnet`,
    },
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[agent-b] listening on http://127.0.0.1:${PORT}`);
  console.log(`[agent-b] network=${NETWORK} treasury=${TREASURY}`);
  console.log(`[agent-b] price=${PRICE_ATOMIC} atomic of ${ASSET.address} (${ASSET.decimals}dp)`);
});
