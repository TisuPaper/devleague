# Solana: escrow + x402 agent payments (devnet)

Two independent pieces:

| | what it is | signs with |
|---|---|---|
| `escrow/` | Anchor program: lock 0.1 SOL, release it | **your Phantom wallet**, in the browser |
| `x402/` | Two Node agents paying each other 0.1 devnet USDC over x402 | a local throwaway keypair (Agent A only) |

Everything here is **devnet demo code**. Unaudited, no mainnet path.

---

## Addresses

| role | address | holds a key here? |
|---|---|---|
| Escrow program | `4XLxUFx1rApJJkjtfjaQn99cwe3WSkDkCmUsqq2L911J` | — |
| Deployer | `J2t6HDwkeoJ18KfRNQCdsHfLjKkBQ8U8HouQwTkASAEH` | `.keys/deployer.json` |
| Agent A (payer) | `5DLAfRiYcQyLVUwesmmJVpxf61oPd9ksrPxCtJoTaoPs` | `.keys/agent-a.json` |
| Agent B treasury | `ABDpbo9dwKuKZVpQwcfcGCCzgLh6QYmDcnPDS6Qao6Bx` | no — receive only |
| Escrow maker | your Phantom wallet | no — Phantom signs |

`.keys/` is gitignored and mode 600. **Nothing was ever exported from Phantom** — the two
keypairs above were generated locally and are throwaways. Never point `AGENT_A_KEYPAIR`
at a key that also holds mainnet funds: devnet and mainnet share one address space, so a
"devnet wallet" in Phantom is the same keypair on mainnet.

---

## Toolchain

Installed already; reinstall with:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/solana-foundation/anchor --tag v1.1.2 avm --force
avm install 1.1.2 && avm use 1.1.2
```

Versions in use: **anchor-cli 1.1.2**, **solana-cli 3.1.10 (Agave)**, rustc 1.98.0.

> The official one-liner at `solana-install.solana.workers.dev` also installs nvm, Node
> 24.10, yarn and surfpool. Those steps were skipped deliberately so the repo's existing
> Node 24.13 was not re-pointed.

### Anchor 1.x gotcha
`CpiContext::new` takes a **`Pubkey`**, not an `AccountInfo`. Nearly every tutorial online
predates this and will not compile:

```rust
// Anchor 1.x
CpiContext::new(ctx.accounts.system_program.key(), Transfer { from, to })
```

Also: the default test template is **litesvm Rust tests**, not TypeScript/mocha.

---

## Escrow

### Test — free, no validator, no SOL
```bash
cd solana/escrow && cargo test
```
Six litesvm tests: the happy path plus every way this could lose money — permissionless
crank still pays the recorded recipient, a substituted recipient is rejected, release is
not replayable, a second deposit cannot overwrite a live escrow, and the zero address is
rejected as a recipient.

### Build and deploy
```bash
cd solana/escrow
anchor build
solana program deploy target/deploy/escrow.so \
  --program-id target/deploy/escrow-keypair.json \
  --keypair ../.keys/deployer.json --url devnet
```

**Deployed 2026-08-22. Actual cost: 1.11 SOL** for the 158,872-byte binary.

> An earlier estimate here said 2.21 SOL, doubling the size for the deploy buffer. That
> was wrong: the 2× buffer is transient during upload and is reclaimed, so the standing
> cost is 1× the program size. Budget ~1.5 SOL, not 3.
>
> It is *rent locked in the ProgramData account*, not burned — `solana program close`
> returns it to the authority. Only tx fees are truly spent.

The public faucet is frequently rate-limited; send from Phantom if `solana airdrop` fails.
```bash
solana balance J2t6HDwkeoJ18KfRNQCdsHfLjKkBQ8U8HouQwTkASAEH --url devnet
solana program show 4XLxUFx1rApJJkjtfjaQn99cwe3WSkDkCmUsqq2L911J --url devnet \
  --keypair .keys/deployer.json
```

### Devnet smoke test
Full deposit → release cycle against the deployed program, signed by the local deployer
keypair — no browser needed. Use it to tell a program problem from a UI problem.
```bash
cd solana && npm run escrow:smoke            # pays FjFVMZ… by default
npm run escrow:smoke -- <recipient-address>
```
Asserts the PDA holds 0.1 SOL after deposit, is closed after release, and that the
recipient is up exactly 100,000,000 lamports.

### Recovery
| symptom | fix |
|---|---|
| Deploy failed part-way, SOL missing | `solana program close --buffers --keypair ../.keys/deployer.json --url devnet` |
| Need to change the program | `anchor build` then redeploy to the **same** program id — rent is paid once |
| Retire the program, reclaim rent | `solana program close <PROGRAM_ID> --bypass-warning --keypair ../.keys/deployer.json --url devnet` |

### Using it
Dashboard → **Payments** tab → SOL Escrow. Connect Phantom, click Deposit, sign. `release`
is permissionless — anyone may call it — but it can only ever pay the recipient recorded at
deposit time, so a stranger cranking it merely completes the escrow.

There is **no cancel or timeout**. Once deposited, funds sit until someone calls `release`.

---

## x402 agent payments

### Run
`solana/` is a single npm workspace — one `node_modules` covers both agents and the
escrow scripts.
```bash
cd solana && npm install
cp x402/agent-a/.env.example x402/agent-a/.env   # set AGENT_A_KEYPAIR to an absolute path
cp x402/agent-b/.env.example x402/agent-b/.env
npm run agent-b    # port 8402, seller — holds no key
npm run agent-a    # port 8401, buyer  — holds the only signing key
```

Vite proxies `/x402` → `127.0.0.1:8401`, so the dashboard button works in dev with no CORS.

### Protocol facts (verified against `x402-solana@3.0.0`, not the docs)
| | |
|---|---|
| Network | `solana-devnet` → CAIP-2 `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Asset | devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 dp |
| Price | `100000` atomic = 0.1 USDC |
| Facilitator | `https://facilitator.payai.network` (free tier, no API key) |
| Header | `PAYMENT-SIGNATURE` |

x402 on Solana is **SPL-only** — there is no native-SOL scheme. That is why the agent
payment is USDC while the escrow is SOL.

The facilitator co-signs as **fee payer**, so Agent A's payment is gasless.

### Funding Agent A
Needs devnet USDC at `5DLAfRiYcQyLVUwesmmJVpxf61oPd9ksrPxCtJoTaoPs`, from
`faucet.circle.com`. Until then `/pay` fails with *"User does not have an Associated Token
Account"* — that is the expected pre-funding error, not a bug.

### Controls
- **`beforePayment` hook** — Agent A refuses unless `payTo` equals `EXPECTED_PAY_TO`.
  Runs *before* the transaction is built or signed, so a redirected quote never gets a
  signature. Verified: pointing it at the wrong treasury aborts with
  `Payment aborted by beforePayment hook: unexpected payTo: …`.
- **`MAX_PAYMENT_ATOMIC`** — hard per-payment ceiling, enforced by the library before the
  hook runs. A misbehaving Agent B cannot quote an unbounded price.
- **Verify then settle** — Agent B checks amount, mint, network and `payTo` against
  requirements *it* generated. The client header is never trusted.
- **Replay guard** — settled signatures are tracked; a duplicate returns 409. In-memory,
  so two instances would each honour a replay. Move to a shared store for anything real.
- Agent A is a separate process from the FastAPI backend on purpose: that process already
  holds Gmail OAuth, a GCP service-account key and Gemini credentials, and a spending key
  does not belong in the same blast radius.

### Two upstream bugs worked around in `agent-b/server.js`

Both are in `x402-solana@3.0.0`. Both fail **silently** — no error, no log, just a
handshake that never completes. Delete these workarounds only after confirming upstream
has fixed them.

**1. Client falls back to protocol v1 unless a `PAYMENT-REQUIRED` response header exists.**
The client picks its version from the presence of that *header*, not from `x402Version`
in the body:
```js
const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
protocolVersion = paymentRequiredHeader ? 2 : 1;
```
`create402Response` only returns a body, so the client assumed v1 and sent `X-PAYMENT`,
while `extractPayment` reads only `PAYMENT-SIGNATURE`. The server never saw a payment and
re-quoted 402 forever. Fix: set the header to base64 of the same body.

**2. `getFeePayer` returns the mainnet fee payer on devnet.**
It matches the facilitator's `/supported` list by substring:
```js
kind.network.includes("devnet") === network.includes("devnet")
```
By that point the network is CAIP-2, and the devnet id `solana:EtWTRABZ…` contains no
`"devnet"` substring — so `false === false` matches the mainnet entry first. A
devnet-configured server advertised mainnet fee payer `CjNFTjv…`, which holds 0 devnet
SOL, and every payment died at `transaction_simulation_failed`. Confirmed: both
`solana` and `solana-devnet` configs return the mainnet payer.

| network | correct fee payer | devnet SOL |
|---|---|---|
| `solana` (mainnet) | `CjNFTjvBhbJJd2B5ePPMHRLx1ELZpa8dwQgGL727eKww` | 0 |
| `solana-devnet` | `2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4` | 4.86 |

Fix: resolve the fee payer by exact CAIP-2 match against `/supported`, cached 5 min, and
overwrite `requirements.extra.feePayer` before quoting *and* before verify/settle.

### Verified working
```
2026-08-22  0.1 USDC  agent-a 5DLAf…aoPs -> treasury ABDpbo…o6Bx
tx 3jRk2CW78T9YH3EQ8dYzFmqpBNkyfx7XMDVgsd7gkjEUDVXMyBcz3xMRrYcjrHq5NkNT7KwbcDKBqRHuJGWozQoz
finalized, 5.1 s round trip
```

### Known dependency risk
`npm audit` reports 9 issues, all transitive from the Solana JS stack and all
`fix: unavailable`. Two root causes:
- **`bigint-buffer` (HIGH)** — buffer overflow in `toBigIntLE()`, via `@solana/spl-token`.
- **`uuid` (MODERATE)** — missing bounds check, via `jayson` → `@solana/web3.js`.

No upgrade path: `x402-solana` peer-depends on `@solana/web3.js` v1, and v1 pulls both.
Resolving this means waiting for x402-solana to move to `@solana/kit` (web3.js v2).
Acceptable on devnet with non-hostile inputs; **re-evaluate before anything production**.

---

## Ports

| port | process |
|---|---|
| 5173 | Vite dev server (dashboard) |
| 8000 | FastAPI backend |
| 8401 | Agent A — x402 payer |
| 8402 | Agent B — x402 resource server |
