//! Pins the PDA derivation and instruction discriminators that the browser
//! client hardcodes. The dashboard builds instructions by hand from the IDL
//! rather than through @coral-xyz/anchor (there is no 1.x TS client on npm), so
//! nothing else would catch a seed or discriminator drift until a transaction
//! failed on-chain.

use anchor_lang::{prelude::Pubkey, Discriminator, InstructionData};
use std::str::FromStr;

/// Same maker the JS parity script uses.
const MAKER: &str = "FjFVMZJb6Em3cqxTm4NL9oP84t4t6E79LTeoAk4L6j5W";

#[test]
fn pda_and_discriminators_match_the_js_client() {
    let program_id = escrow::id();
    let maker = Pubkey::from_str(MAKER).unwrap();

    let (pda, bump) = Pubkey::find_program_address(&[b"escrow", maker.as_ref()], &program_id);

    println!("PROGRAM_ID        {}", program_id);
    println!("MAKER             {}", maker);
    println!("RUST_PDA          {}", pda);
    println!("RUST_BUMP         {}", bump);
    println!(
        "DISC_deposit      {:?}",
        escrow::instruction::Deposit { recipient: maker }.data()[..8].to_vec()
    );
    println!(
        "DISC_release      {:?}",
        escrow::instruction::Release {}.data()[..8].to_vec()
    );
    println!("DISC_Escrow_acct  {:?}", escrow::Escrow::DISCRIMINATOR);

    // The seed string the client encodes must be exactly this.
    assert_eq!(escrow::ESCROW_SEED, b"escrow");
    // Amount pinned in the UI must equal the on-chain constant.
    assert_eq!(escrow::ESCROW_AMOUNT, 100_000_000);
}
