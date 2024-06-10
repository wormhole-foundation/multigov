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
    #[msg("Other")] //6036
    Other,
}
