use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Number of checkpoint limit reached")] //6000
    TooManyCheckpoints,
    #[msg("Epoch duration is 0")] //6001
    ZeroEpochDuration,
    #[msg("An arithmetic operation unexpectedly overflowed")] //6002
    GenericOverflow,
    #[msg("Error deserializing checkpoint")] //6003
    CheckpointSerDe,
    #[msg("Checkpoint out of bounds")] //6004
    CheckpointOutOfBounds,
    #[msg("You need to be an LLC member to perform this action")] //6005
    NotLlcMember,
    #[msg("Can't recover account with staking positions. Unstake your tokens first.")] // 6006
    RecoverWithStake,
    #[msg("Other")] //6007
    Other,
}
