use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Epoch duration is 0")] //6011
    ZeroEpochDuration,
    #[msg("An arithmetic operation unexpectedly overflowed")] //6015
    GenericOverflow,
    #[msg("You need to be an LLC member to perform this action")] //6029
    NotLlcMember,
    #[msg("Can't recover account with staking positions. Unstake your tokens first.")] // 6035
    RecoverWithStake,
    #[msg("Other")] //6036
    Other,
}
