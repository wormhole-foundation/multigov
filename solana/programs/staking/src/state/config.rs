use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub mint: Pubkey,
    pub admin: Pubkey,
    pub recovery: Pubkey,
    pub seed: u64,
    pub vested: u64,
    pub finalized: bool,
    pub bump: u8
}

impl Space for Config {
    const INIT_SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 1;
}