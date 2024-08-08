use anchor_lang::prelude::*;

#[account]
pub struct Vesting {
    pub vester_ta: Pubkey,
    pub config: Pubkey,
    pub amount: u64,
    pub maturation: i64,
    pub bump: u8
}

impl Space for Vesting {
    const INIT_SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}