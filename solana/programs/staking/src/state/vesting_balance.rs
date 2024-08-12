use anchor_lang::prelude::*;

#[account]
pub struct VestingBalance {
    pub vester_ta: Pubkey,
    pub total_vesting_balance: u64,
    pub bump: u8
}

impl Space for VestingBalance {
    const INIT_SPACE: usize = 8 + 32 + 8 + 1;
}