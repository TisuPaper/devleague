// Devnet smoke test: a full deposit -> release cycle against the deployed
// program, signed by the local deployer keypair.
//
// Proves the on-chain program works end to end without needing a browser or a
// Phantom prompt, so a failure in the dashboard can be isolated to the UI
// rather than the program.
//
//   node scripts/smoke-devnet.mjs [recipient]

import { readFileSync } from 'node:fs';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

const RPC = 'https://api.devnet.solana.com';
const IDL = JSON.parse(new URL('../target/idl/escrow.json', import.meta.url).pathname
  ? readFileSync(new URL('../target/idl/escrow.json', import.meta.url), 'utf8')
  : '{}');

const PROGRAM_ID = new PublicKey(IDL.address);
const ESCROW_SEED = new TextEncoder().encode('escrow');
const AMOUNT = 100_000_000;

const DISC = Object.fromEntries(
  IDL.instructions.map((ix) => [ix.name, Uint8Array.from(ix.discriminator)])
);

const maker = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(new URL('../../.keys/deployer.json', import.meta.url), 'utf8')))
);

const recipient = new PublicKey(
  process.argv[2] ?? 'FjFVMZJb6Em3cqxTm4NL9oP84t4t6E79LTeoAk4L6j5W'
);

const connection = new Connection(RPC, 'confirmed');
const [escrowPda] = PublicKey.findProgramAddressSync(
  [ESCROW_SEED, maker.publicKey.toBuffer()],
  PROGRAM_ID
);

const sol = (lamports) => (lamports / 1e9).toFixed(9);
const link = (sig) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

async function send(label, ix) {
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = maker.publicKey;
  tx.sign(maker);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    preflightCommitment: 'confirmed',
  });
  const res = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  if (res.value.err) throw new Error(`${label} failed: ${JSON.stringify(res.value.err)}`);
  console.log(`  ${label} ok  ${sig}`);
  console.log(`    ${link(sig)}`);
  return sig;
}

function depositIx() {
  const data = new Uint8Array(8 + 32);
  data.set(DISC.deposit, 0);
  data.set(recipient.toBytes(), 8);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: maker.publicKey, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function releaseIx() {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: maker.publicKey, isSigner: true, isWritable: false },
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: maker.publicKey, isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISC.release),
  });
}

console.log(`program   ${PROGRAM_ID.toBase58()}`);
console.log(`maker     ${maker.publicKey.toBase58()}`);
console.log(`recipient ${recipient.toBase58()}`);
console.log(`escrowPda ${escrowPda.toBase58()}\n`);

const before = await connection.getBalance(recipient, 'confirmed');
console.log(`recipient before  ${sol(before)} SOL\n`);

console.log('deposit 0.1 SOL');
await send('deposit', depositIx());

const escrowAcct = await connection.getAccountInfo(escrowPda, 'confirmed');
if (!escrowAcct) throw new Error('escrow PDA missing after deposit');
console.log(`  escrow PDA holds ${sol(escrowAcct.lamports)} SOL`);
if (escrowAcct.lamports < AMOUNT) throw new Error('escrow underfunded');

console.log('\nrelease');
await send('release', releaseIx());

const closed = await connection.getAccountInfo(escrowPda, 'confirmed');
const after = await connection.getBalance(recipient, 'confirmed');
const delta = after - before;

console.log(`\n  escrow PDA closed  ${closed === null}`);
console.log(`  recipient after    ${sol(after)} SOL`);
console.log(`  delta              ${sol(delta)} SOL`);

if (closed !== null) throw new Error('escrow PDA was not closed');
if (delta !== AMOUNT) throw new Error(`expected +${AMOUNT} lamports, got ${delta}`);

console.log('\nPASS — deposit and release both settled on devnet.');
