use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Number of checkpoint limit reached")] //6000
    TooManyCheckpoints,
    #[msg("An arithmetic operation unexpectedly overflowed")] //6001
    GenericOverflow,
    #[msg("Error deserializing checkpoint")] //6002
    CheckpointSerDe,
    #[msg("Checkpoint out of bounds")] //6003
    CheckpointOutOfBounds,
    #[msg("You need to be an LLC member to perform this action")] //6004
    NotLlcMember,
    #[msg("Can't recover account with a non-zero staking balance. Unstake your tokens first.")]
    // 6005
    RecoverWithStake,
    #[msg("Checkpoint not found")] //6006
    CheckpointNotFound,
    #[msg("Invalid timestamp")] //6007
    InvalidTimestamp,
    #[msg("Invalid LLC agreement")] // 6008
    InvalidLlcAgreement,
    #[msg("No Weight")] // 6009
    NoWeight,
    #[msg("All weight cast")] // 6010
    AllWeightCast,
    #[msg("Vote would exceed weight")] // 6011
    VoteWouldExceedWeight,
    #[msg("Owner needs to own destination account")] //6012
    WithdrawToUnauthorizedAccount,
    #[msg("Insufficient balance to cover the withdrawal")] //6013
    InsufficientWithdrawableBalance,
    #[msg("Proposal already exists")] //6014
    ProposalAlreadyExists,
    #[msg("Invalid message executor")] //6015
    InvalidMessageExecutor,
    #[msg("Invalid spoke airlock")] //6016
    InvalidSpokeAirlock,
    #[msg("Other")] //6015
    Other,
}

#[error_code]
pub enum VestingError {
    #[msg("Not fully vested yet")]
    NotFullyVested,
    #[msg("Vault is not in surplus")]
    NotInSurplus,
    #[msg("Vesting finalized")]
    VestingFinalized,
    #[msg("Vesting unfinalized")]
    VestingUnfinalized,
    #[msg("Integer overflow")]
    Overflow,
    #[msg("Integer underflow")]
    Underflow,
}
