// Browser client for the escrow program.
//
// Builds the two instructions by hand from the Anchor IDL rather than pulling
// in @coral-xyz/anchor. The program is built with Anchor 1.1.2, but the
// TypeScript client tops out at 0.32.1 — there is no 1.x on npm. Rather than
// bet on that mismatch, we read the discriminators and account order straight
// out of the IDL, which is a stable contract either way. It also keeps a large
// dependency out of the bundle.

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
// Imported explicitly rather than assumed as a global: Vite does not polyfill
// Node builtins, so a bare `Buffer` reference throws in the browser. web3.js
// ships its own browser build that does the same thing internally.
import { Buffer } from 'buffer';
import idl from './escrow-idl.json';

export const DEVNET_RPC =
  import.meta.env.VITE_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export const PROGRAM_ID = new PublicKey(idl.address);

/** 0.1 SOL, matching the ESCROW_AMOUNT constant compiled into the program. */
export const ESCROW_LAMPORTS = 100_000_000;

const ESCROW_SEED = new TextEncoder().encode('escrow');

const DISCRIMINATORS = Object.fromEntries(
  idl.instructions.map((ix) => [ix.name, Uint8Array.from(ix.discriminator)])
);

/** Human-readable messages for the program's custom error codes. */
const ERROR_MESSAGES = Object.fromEntries(
  (idl.errors ?? []).map((e) => [e.code, e.msg ?? e.name])
);

export function getConnection() {
  return new Connection(DEVNET_RPC, 'confirmed');
}

/** The escrow PDA for a given maker — same derivation as the program. */
export function deriveEscrowPda(maker) {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, new PublicKey(maker).toBuffer()],
    PROGRAM_ID
  )[0];
}

/**
 * Map an on-chain failure onto the program's own error text where possible.
 * Anchor custom errors surface as `custom program error: 0x1770` style codes;
 * showing "Supplied recipient does not match the escrow" is far more use to an
 * operator than a hex code.
 */
export function describeSolanaError(err) {
  const raw = err?.message ?? String(err);

  const hex = raw.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (hex) {
    const code = parseInt(hex[1], 16);
    if (ERROR_MESSAGES[code]) return `${ERROR_MESSAGES[code]} (code ${code})`;
  }

  const logged = Object.entries(ERROR_MESSAGES).find(([, msg]) => raw.includes(msg));
  if (logged) return logged[1];

  // The single most likely failure before the program ships. The raw text
  // ("Attempt to load a program that does not exist") reads like a client bug
  // when it actually just means the deploy has not happened.
  if (/program that does not exist|ProgramAccountNotFound/i.test(raw)) {
    return `The escrow program is not deployed to devnet yet (${PROGRAM_ID.toBase58()}).`;
  }

  if (/User rejected|rejected the request/i.test(raw)) return 'Rejected in Phantom.';
  if (/insufficient lamports|Insufficient Funds|insufficient funds/i.test(raw)) {
    return 'Not enough SOL in this wallet for the deposit plus fees.';
  }
  if (/blockhash not found|block height exceeded/i.test(raw)) {
    return 'Transaction expired before confirming. Try again.';
  }

  return raw;
}

/**
 * Is the program actually live on this cluster?
 *
 * Checked before enabling Deposit so an undeployed program surfaces as a clear
 * banner rather than a simulation failure after the user has already approved
 * a Phantom prompt.
 */
export async function isProgramDeployed() {
  try {
    const account = await getConnection().getAccountInfo(PROGRAM_ID, 'confirmed');
    return Boolean(account?.executable);
  } catch {
    // Treat an RPC failure as "unknown" rather than "missing" — blocking the
    // UI on a transient network blip would be worse than letting it try.
    return null;
  }
}

function buildDepositIx({ maker, recipient, escrowPda }) {
  const disc = DISCRIMINATORS.deposit;
  // deposit(recipient: Pubkey) — 8-byte discriminator + 32-byte pubkey.
  const data = new Uint8Array(disc.length + 32);
  data.set(disc, 0);
  data.set(new PublicKey(recipient).toBytes(), disc.length);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    // Order must match the IDL's account list exactly.
    keys: [
      { pubkey: new PublicKey(maker), isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function buildReleaseIx({ cranker, maker, recipient, escrowPda }) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: new PublicKey(cranker), isSigner: true, isWritable: false },
      { pubkey: new PublicKey(recipient), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(maker), isSigner: false, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISCRIMINATORS.release),
  });
}

async function signSendConfirm(connection, transaction, feePayer, signTransaction) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = new PublicKey(feePayer);
  transaction.recentBlockhash = blockhash;

  const signed = await signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    // Let the RPC preflight catch a doomed transaction before it costs a slot.
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const result = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    'confirmed'
  );
  if (result.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
  }

  return signature;
}

/** Lock 0.1 SOL from `maker`, payable to `recipient`. Signed in Phantom. */
export async function deposit({ maker, recipient, signTransaction }) {
  const connection = getConnection();
  const escrowPda = deriveEscrowPda(maker);

  const tx = new Transaction().add(buildDepositIx({ maker, recipient, escrowPda }));
  const signature = await signSendConfirm(connection, tx, maker, signTransaction);

  return { signature, escrowPda: escrowPda.toBase58() };
}

/** Release a live escrow to its recorded recipient. Anyone may call this. */
export async function release({ cranker, maker, recipient, signTransaction }) {
  const connection = getConnection();
  const escrowPda = deriveEscrowPda(maker);

  const tx = new Transaction().add(
    buildReleaseIx({ cranker, maker, recipient, escrowPda })
  );
  const signature = await signSendConfirm(connection, tx, cranker, signTransaction);

  return { signature, escrowPda: escrowPda.toBase58() };
}

/**
 * Read the current escrow for a maker, or null if none is live.
 *
 * Decoded by hand against the IDL layout: 8-byte account discriminator, then
 * maker(32) recipient(32) amount(u64 LE) bump(1).
 */
export async function fetchEscrow(maker) {
  const connection = getConnection();
  const escrowPda = deriveEscrowPda(maker);
  const account = await connection.getAccountInfo(escrowPda, 'confirmed');
  if (!account) return null;

  const data = account.data;
  let offset = 8;
  const makerKey = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const recipientKey = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const amount = new DataView(
    data.buffer,
    data.byteOffset + offset,
    8
  ).getBigUint64(0, true);

  return {
    address: escrowPda.toBase58(),
    maker: makerKey.toBase58(),
    recipient: recipientKey.toBase58(),
    amountLamports: Number(amount),
    lamports: account.lamports,
  };
}

export function explorerTx(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAddress(address) {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
