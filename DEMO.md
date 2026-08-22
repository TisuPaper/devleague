# Demo runbook

Four processes. Only the first is required to show the dashboard; the two agents
are needed for the payment step.

| port | what | required for |
|---|---|---|
| 8000 | FastAPI backend — Gmail → analyse → `/api/clients` | the live "Statements" tab |
| 5173 | Vite dev server (the dashboard) | everything |
| 8402 | Agent B — x402 resource server (holds no key) | step 2 of settlement |
| 8401 | Agent A — x402 paying agent (holds the signing key) | step 2 of settlement |

---

## Start from cold

Four terminals, in this order.

```bash
# 1 — backend
cd backend
source venv/bin/activate          # or: python3 -m venv venv && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2 — x402 seller
cd solana && npm run agent-b

# 3 — x402 buyer
cd solana && npm run agent-a

# 4 — dashboard
cd dashboard && npm run dev
```

Open **http://localhost:5173**.

### Check everything is alive
```bash
curl -s localhost:8000/api/clients | head -c 120   # backend
curl -s localhost:8402/health                      # agent B
curl -s localhost:8401/health                      # agent A
curl -s -o /dev/null -w '%{http_code}\n' localhost:8402/premium/risk-report   # expect 402
```

---

## The demo, in order

### 1. Overview tab — the dashboard itself
- **Stat tiles** — money in/out, net saved, savings rate, each with the move on July.
- **What you should do now** — top 3 actions, urgent first. Tick one to cross it off.
  "Show 3 more" reveals the rest.
- **Where it went** — spend by category. The icon top-right flips it to a table.
- **Inbox analysis** — tabbed by category. The **Statements** tab (green dot) is the
  only one fed by the real backend; Tax / Investments / Insurance / Loans are demo data.

### 2. Send an email to show it update
Send a statement to the connected inbox. Within a few seconds (the dashboard polls
every 5 s) you should see:
- the **Statements** tab count rise, "Updated just now",
- a new reminder appear at the top with a blue **NEW** badge.

Nothing needs restarting — it is a poll, not a socket.

### 3. Payments tab — the three-step settlement
Connect Phantom first (button top-right), on **devnet**.

1. **Lock the fee** — escrows 0.1 SOL to the provider. Phantom prompts you to sign.
2. **Buy the report** — Agent A pays Agent B 0.1 USDC over x402. No prompt: this is
   agent-to-agent, signed server-side.
3. **Release** — pays the escrowed SOL out and closes the escrow. Phantom prompts.

Steps 2 and 3 stay disabled until the one before completes. Release specifically
cannot run before the report has been paid for — that is the point of the escrow.

Each completed step shows an Explorer link. Have Phantom open on the receiving
wallet to watch the balances move.

---

## Before you present

- **Devnet, not mainnet** — switch Phantom to devnet or the escrow steps will fail.
- **Agent A needs devnet USDC.** Check: it should hold ≥ 0.1.
  ```bash
  cd solana && node -e "
  const {Connection,PublicKey}=require('@solana/web3.js');
  new Connection('https://api.devnet.solana.com').getParsedTokenAccountsByOwner(
    new PublicKey('5DLAfRiYcQyLVUwesmmJVpxf61oPd9ksrPxCtJoTaoPs'),
    {mint:new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')}
  ).then(r=>console.log(r.value[0]?.account.data.parsed.info.tokenAmount.uiAmountString ?? 'NONE','USDC'));"
  ```
  Top up by sending USDC from Phantom to that address.
- **Your wallet needs a little devnet SOL** for the lock — 0.1 plus fees.
- **One live escrow per wallet.** If a previous demo left one open, Release it first
  or Lock will fail. The panel shows the current state on load.

---

## If something breaks

| symptom | cause | fix |
|---|---|---|
| Statements tab empty | backend down, or no email processed | `curl localhost:8000/api/clients` |
| "Escrow program is not deployed" | wrong cluster, or program closed | Phantom → devnet; `solana program show 4XLxUFx1rApJJkjtfjaQn99cwe3WSkDkCmUsqq2L911J --url devnet` |
| Pay button: "Could not reach the payment agent" | Agent A down | restart `npm run agent-a` |
| Pay fails: no Associated Token Account | Agent A has no USDC | send it USDC from Phantom |
| Pay loops on 402 forever | Agent B restarted without the workarounds | see the two upstream bugs in `solana/README.md` |
| Lock fails: "Rejected in Phantom" | you dismissed the prompt | click Lock again |

Prove the chain works independently of the browser:
```bash
cd solana && npm run escrow:smoke      # full deposit → release on devnet
```

---

## What is real and what is demo data

Worth being straight about if anyone asks.

**Real** — the escrow program on devnet, both settlement transactions, the x402
handshake and USDC transfer, and everything on the Statements tab (documents,
counts, summaries, key figures, and the reminders derived from them).

**Demo data** — the spending categories and figures, the stat tiles, the standing
reminders, and the Tax / Investments / Insurance / Loans tabs.

The backend classifies attachments as *corporate* statements because that is what
its Gemini prompt asks for. The dashboard renames those labels for display
(`dashboard/src/data/personalData.js`). Making it genuinely personal means changing
the backend taxonomy and the extraction prompt, not that map.
