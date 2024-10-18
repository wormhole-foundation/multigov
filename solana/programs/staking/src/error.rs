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
    #[msg("Can't recover account with a non-zero staking balance. Unstake your tokens first.")]
    // 6005
    RecoverWithStake,
    #[msg("Checkpoint not found")] //6006
    CheckpointNotFound,
    #[msg("Invalid timestamp")] //6007
    InvalidTimestamp,
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
    #[msg("Invalid current delegate")]
    InvalidCurrentDelegate,
    #[msg("Other")]
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
    #[msg("Invalid stake account delegate")]
    InvalidStakeAccountCheckpoints,
    #[msg("Error parsing stake_account_metadata and stake_account_checkpoints")]
    ErrorOfStakeAccountParsing,
    #[msg("Invalid vesting config PDA")]
    InvalidVestingConfigPDA,
    #[msg("Invalid vesting balance PDA")]
    InvalidVestingBalancePDA,
    #[msg("Invalid vesting mint")]
    InvalidVestingMint,
    #[msg("Invalid stake account owner")]
    InvalidStakeAccountOwner,
    #[msg("Invalid vesting admin")]
    InvalidVestingAdmin,
    #[msg("Vested token balance does not match the balance in the vault")]
    VestedBalanceMismatch,
}

#[error_code]
pub enum QueriesSolanaVerifyError {
    #[msg("Failed to parse response")]
    FailedToParseResponse,
    #[msg("Write authority mismatch")]
    WriteAuthorityMismatch,
    #[msg("Guardian set expired")]
    GuardianSetExpired,
    #[msg("Invalid message hash")]
    InvalidMessageHash,
    #[msg("No quorum")]
    NoQuorum,
    #[msg("Invalid guardian index non increasing")]
    InvalidGuardianIndexNonIncreasing,
    #[msg("Invalid guardian index out of range")]
    InvalidGuardianIndexOutOfRange,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Invalid guardian key recovery")]
    InvalidGuardianKeyRecovery,
}

#[error_code]
pub enum ProposalWormholeMessageError {
    #[msg("Too many query responses")]
    TooManyQueryResponses,
    #[msg("Sender chain mismatch")]
    SenderChainMismatch,
    #[msg("Too many eth call results")]
    TooManyEthCallResults,
    #[msg("Invalid data length")]
    InvalidDataLength,
    #[msg("Error of contract_address parsing")]
    ErrorOfContractAddressParsing,
    #[msg("Error of proposal_id parsing")]
    ErrorOfProposalIdParsing,
    #[msg("Error of vote_start parsing")]
    ErrorOfVoteStartParsing,
    #[msg("Invalid hub proposal metadata contract")]
    InvalidHubProposalMetadataContract,
    #[msg("Invalid proposal_id")]
    InvalidProposalId,
    #[msg("Non-finalized block")]
    NonFinalizedBlock,
    #[msg("Invalid ChainSpecificQuery")]
    InvalidChainSpecificQuery,
    #[msg("Invalid ChainSpecificResponse")]
    InvalidChainSpecificResponse,
}
