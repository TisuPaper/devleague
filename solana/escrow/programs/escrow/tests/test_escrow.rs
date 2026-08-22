//! litesvm tests for the escrow program.
//!
//! Covers the happy path plus the three ways this program could lose money if
//! the constraints were wrong: releasing twice, releasing to an attacker's
//! address, and stacking a second deposit over a live escrow.

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const ESCROW_AMOUNT: u64 = 100_000_000;

fn setup() -> (LiteSVM, Pubkey) {
    let program_id = escrow::id();
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/escrow.so"
    ));
    svm.add_program(program_id, bytes).unwrap();
    (svm, program_id)
}

fn escrow_pda(maker: &Pubkey, program_id: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"escrow", maker.as_ref()], program_id).0
}

fn send(
    svm: &mut LiteSVM,
    ix: Instruction,
    payer: &Keypair,
) -> Result<(), litesvm::types::FailedTransactionMetadata> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx).map(|_| ())
}

fn deposit_ix(program_id: &Pubkey, maker: &Pubkey, recipient: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        *program_id,
        &escrow::instruction::Deposit {
            recipient: *recipient,
        }
        .data(),
        escrow::accounts::Deposit {
            maker: *maker,
            escrow: escrow_pda(maker, program_id),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn release_ix(
    program_id: &Pubkey,
    cranker: &Pubkey,
    maker: &Pubkey,
    recipient: &Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        *program_id,
        &escrow::instruction::Release {}.data(),
        escrow::accounts::Release {
            cranker: *cranker,
            recipient: *recipient,
            maker: *maker,
            escrow: escrow_pda(maker, program_id),
        }
        .to_account_metas(None),
    )
}

#[test]
fn deposit_then_release_pays_the_recorded_recipient() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    let recipient = Pubkey::new_unique();
    svm.airdrop(&maker.pubkey(), 2_000_000_000).unwrap();

    let pda = escrow_pda(&maker.pubkey(), &program_id);

    send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &recipient), &maker)
        .expect("deposit should succeed");

    // State recorded correctly, and the PDA actually holds the SOL.
    let acct = svm.get_account(&pda).unwrap();
    let state = escrow::Escrow::try_deserialize(&mut &acct.data[..]).unwrap();
    assert_eq!(state.maker, maker.pubkey());
    assert_eq!(state.recipient, recipient);
    assert_eq!(state.amount, ESCROW_AMOUNT);
    assert!(acct.lamports >= ESCROW_AMOUNT);

    let maker_before = svm.get_account(&maker.pubkey()).unwrap().lamports;

    send(
        &mut svm,
        release_ix(&program_id, &maker.pubkey(), &maker.pubkey(), &recipient),
        &maker,
    )
    .expect("release should succeed");

    // Recipient got exactly the escrowed amount.
    assert_eq!(
        svm.get_account(&recipient).map(|a| a.lamports).unwrap_or(0),
        ESCROW_AMOUNT
    );
    // Escrow closed; rent refunded to maker (net of the tx fee).
    assert!(svm.get_account(&pda).map(|a| a.lamports).unwrap_or(0) == 0);
    assert!(svm.get_account(&maker.pubkey()).unwrap().lamports > maker_before - 100_000);
}

#[test]
fn release_is_permissionless_but_still_pays_the_recipient() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    let stranger = Keypair::new();
    let recipient = Pubkey::new_unique();
    svm.airdrop(&maker.pubkey(), 2_000_000_000).unwrap();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();

    send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &recipient), &maker).unwrap();

    // A completely unrelated signer cranks it — this must work...
    send(
        &mut svm,
        release_ix(&program_id, &stranger.pubkey(), &maker.pubkey(), &recipient),
        &stranger,
    )
    .expect("anyone may crank release");

    // ...and the funds must still go to the recorded recipient, not the cranker.
    assert_eq!(
        svm.get_account(&recipient).map(|a| a.lamports).unwrap_or(0),
        ESCROW_AMOUNT
    );
}

#[test]
fn release_cannot_be_redirected_to_an_attacker() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    let attacker = Keypair::new();
    let recipient = Pubkey::new_unique();
    svm.airdrop(&maker.pubkey(), 2_000_000_000).unwrap();
    svm.airdrop(&attacker.pubkey(), 1_000_000_000).unwrap();

    send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &recipient), &maker).unwrap();

    // Attacker cranks release but substitutes their own address as recipient.
    let res = send(
        &mut svm,
        release_ix(&program_id, &attacker.pubkey(), &maker.pubkey(), &attacker.pubkey()),
        &attacker,
    );
    assert!(res.is_err(), "has_one must reject a substituted recipient");

    // Escrow untouched, attacker gained nothing.
    let pda = escrow_pda(&maker.pubkey(), &program_id);
    assert!(svm.get_account(&pda).unwrap().lamports >= ESCROW_AMOUNT);
}

#[test]
fn release_is_not_replayable() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    let recipient = Pubkey::new_unique();
    svm.airdrop(&maker.pubkey(), 2_000_000_000).unwrap();

    send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &recipient), &maker).unwrap();
    send(
        &mut svm,
        release_ix(&program_id, &maker.pubkey(), &maker.pubkey(), &recipient),
        &maker,
    )
    .unwrap();

    let res = send(
        &mut svm,
        release_ix(&program_id, &maker.pubkey(), &maker.pubkey(), &recipient),
        &maker,
    );
    assert!(res.is_err(), "second release must fail — account is closed");
    assert_eq!(
        svm.get_account(&recipient).map(|a| a.lamports).unwrap_or(0),
        ESCROW_AMOUNT,
        "recipient must not be paid twice"
    );
}

#[test]
fn second_deposit_over_a_live_escrow_is_rejected() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    let recipient = Pubkey::new_unique();
    let other = Pubkey::new_unique();
    svm.airdrop(&maker.pubkey(), 3_000_000_000).unwrap();

    send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &recipient), &maker).unwrap();

    // Would silently overwrite the recipient if `init` were `init_if_needed`.
    let res = send(&mut svm, deposit_ix(&program_id, &maker.pubkey(), &other), &maker);
    assert!(res.is_err(), "one live escrow per maker");

    let pda = escrow_pda(&maker.pubkey(), &program_id);
    let acct = svm.get_account(&pda).unwrap();
    let state = escrow::Escrow::try_deserialize(&mut &acct.data[..]).unwrap();
    assert_eq!(state.recipient, recipient, "original recipient must survive");
}

#[test]
fn deposit_rejects_the_default_pubkey_as_recipient() {
    let (mut svm, program_id) = setup();
    let maker = Keypair::new();
    svm.airdrop(&maker.pubkey(), 2_000_000_000).unwrap();

    let res = send(
        &mut svm,
        deposit_ix(&program_id, &maker.pubkey(), &Pubkey::default()),
        &maker,
    );
    assert!(res.is_err(), "burning funds to the zero address must be rejected");
}
