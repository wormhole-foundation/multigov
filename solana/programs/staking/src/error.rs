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
    #[msg("Can't recover account with a non-zero staking balance. Unstake your tokens first.")] // 6006
    RecoverWithStake,
    #[msg("Checkpoint not found")] //6007
    CheckpointNotFound,
    #[msg("Invalid timestamp")] //6008
    InvalidTimestamp,
    #[msg("Invalid LLC agreement")] // 6009
    InvalidLlcAgreement,
    #[msg("No Weight")] // 6010
    NoWeight,
    #[msg("All weight cast")] // 6011
    AllWeightCast,
    #[msg("Vote would exceed weight")] // 6012
    VoteWouldExceedWeight,
    #[msg("Owner needs to own destination account")] //6013
    WithdrawToUnauthorizedAccount,
    #[msg("Insufficient balance to cover the withdrawal")] //6014
    InsufficientWithdrawableBalance,
    #[msg("Proposal already exists")] //6015
    ProposalAlreadyExists,
    #[msg("Other")] //6016
    Other,
}
