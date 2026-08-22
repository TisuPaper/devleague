//! Minimal two-instruction SOL escrow.
//!
//! `deposit` locks a fixed 0.1 SOL and records who it is destined for.
//! `release` pays that recorded recipient and closes the escrow.
//!
//! `release` is deliberately **permissionless** — any signer may crank it.
//! That is safe here only because the destination is fixed at deposit time and
//! re-checked on release, so a stranger cranking it can complete the escrow but
//! never redirect it. Do not "simplify" this by paying `cranker` instead of
//! `recipient`; that would let anyone drain the vault.
//!
//! Devnet demo code: unaudited, and with no cancel/timeout path. Once deposited,
//! funds sit until someone calls `release`.

use anchor_lang::prelude::*;

declare_id!("4XLxUFx1rApJJkjtfjaQn99cwe3WSkDkCmUsqq2L911J");

/// Fixed escrow amount: 0.1 SOL. Hardcoded rather than caller-supplied so
/// there is no amount for a caller to get wrong or grief with.
pub const ESCROW_AMOUNT: u64 = 100_000_000;

pub const ESCROW_SEED: &[u8] = b"escrow";

#[program]
pub mod escrow {
    use super::*;

    /// Lock 0.1 SOL from `maker`, payable later to `recipient`.
    pub fn deposit(ctx: Context<Deposit>, recipient: Pubkey) -> Result<()> {
        require_keys_neq!(recipient, Pubkey::default(), EscrowError::InvalidRecipient);

        let escrow = &mut ctx.accounts.escrow;
        escrow.maker = ctx.accounts.maker.key();
        escrow.recipient = recipient;
        escrow.amount = ESCROW_AMOUNT;
        escrow.bump = ctx.bumps.escrow;

        // Maker is System-owned, so a plain System transfer is the right move
        // here. The destination being program-owned is fine — crediting
        // lamports to any account is always permitted.
        // Anchor 1.x takes the program *id* here, not its AccountInfo — a
        // breaking change from the 0.3x API most examples still use.
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.maker.to_account_info(),
                    to: escrow.to_account_info(),
                },
            ),
            ESCROW_AMOUNT,
        )?;

        emit!(Deposited {
            escrow: escrow.key(),
            maker: escrow.maker,
            recipient: escrow.recipient,
            amount: ESCROW_AMOUNT,
        });

        Ok(())
    }

    /// Pay the recorded recipient and close the escrow. Callable by anyone.
    pub fn release(ctx: Context<Release>) -> Result<()> {
        let escrow_ai = ctx.accounts.escrow.to_account_info();
        let recipient_ai = ctx.accounts.recipient.to_account_info();
        let amount = ctx.accounts.escrow.amount;

        // The escrow PDA is program-owned, so lamports move by direct
        // arithmetic — a System transfer CPI cannot sign for it. Both sides are
        // checked; a silent wrap here would mint or burn lamports.
        let escrow_balance = escrow_ai.lamports();
        require!(
            escrow_balance >= amount,
            EscrowError::InsufficientEscrowBalance
        );

        **escrow_ai.try_borrow_mut_lamports()? = escrow_balance
            .checked_sub(amount)
            .ok_or(EscrowError::MathOverflow)?;
        **recipient_ai.try_borrow_mut_lamports()? = recipient_ai
            .lamports()
            .checked_add(amount)
            .ok_or(EscrowError::MathOverflow)?;

        emit!(Released {
            escrow: ctx.accounts.escrow.key(),
            maker: ctx.accounts.escrow.maker,
            recipient: ctx.accounts.escrow.recipient,
            amount,
            cranker: ctx.accounts.cranker.key(),
        });

        // `close = maker` then refunds the rent and zeroes the account, which is
        // also what makes release non-replayable: a second call finds no account
        // to deserialize.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    /// One live escrow per maker. A second `deposit` before `release` fails on
    /// `init` rather than silently overwriting the first recipient.
    #[account(
        init,
        payer = maker,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, maker.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// Permissionless crank. Signs only to pay the transaction fee — this
    /// account is never a destination for escrowed funds.
    pub cranker: Signer<'info>,

    /// CHECK: not read or written as data; constrained to equal the recipient
    /// recorded at deposit time via `has_one` below.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    /// CHECK: rent-refund destination, constrained by `has_one` and by the PDA
    /// seeds below.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, maker.key().as_ref()],
        bump = escrow.bump,
        has_one = maker @ EscrowError::MakerMismatch,
        has_one = recipient @ EscrowError::RecipientMismatch,
        close = maker
    )]
    pub escrow: Account<'info, Escrow>,
}

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub maker: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[event]
pub struct Deposited {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Released {
    pub escrow: Pubkey,
    pub maker: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub cranker: Pubkey,
}

#[error_code]
pub enum EscrowError {
    #[msg("Recipient must not be the default pubkey")]
    InvalidRecipient,
    #[msg("Escrow does not hold the expected amount")]
    InsufficientEscrowBalance,
    #[msg("Lamport arithmetic overflowed")]
    MathOverflow,
    #[msg("Supplied maker does not match the escrow")]
    MakerMismatch,
    #[msg("Supplied recipient does not match the escrow")]
    RecipientMismatch,
}
