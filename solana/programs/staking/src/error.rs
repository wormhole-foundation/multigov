use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ErrorCode {
    #[msg("Number of checkpoint limit reached")]
    TooManyCheckpoints,
    #[msg("An arithmetic operation unexpectedly overflowed")]
    GenericOverflow,
    #[msg("Error deserializing checkpoint")]
    CheckpointSerDe,
    #[msg("Checkpoint out of bounds")]
    CheckpointOutOfBounds,
    #[msg("Can't recover account with a non-zero staking balance. Unstake your tokens first.")]
    RecoverWithStake,
    #[msg("Checkpoint not found")]
    CheckpointNotFound,
    #[msg("Invalid timestamp")]
    InvalidTimestamp,
    #[msg("No Weight")]
    NoWeight,
    #[msg("All weight cast")]
    AllWeightCast,
    #[msg("Vote would exceed weight")]
    VoteWouldExceedWeight,
    #[msg("Owner needs to own destination account")]
    WithdrawToUnauthorizedAccount,
    #[msg("Insufficient balance to cover the withdrawal")]
    InsufficientWithdrawableBalance,
    #[msg("Proposal already exists")]
    ProposalAlreadyExists,
    #[msg("Invalid message executor")]
    InvalidMessageExecutor,
    #[msg("Invalid spoke airlock")]
    InvalidSpokeAirlock,
    #[msg("Invalid current delegate")]
    InvalidCurrentDelegate,
    #[msg("Invalid stake account metadata")]
    InvalidStakeAccountMetadata,
    #[msg("Invalid stake account checkpoints provided")]
    InvalidStakeAccountCheckpoints,
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
    #[msg("Invalid vesting mint")]
    InvalidVestingMint,
    #[msg("Invalid stake account owner")]
    InvalidStakeAccountOwner,
    #[msg("Invalid vesting admin")]
    InvalidVestingAdmin,
    #[msg("Vested token balance does not match the balance in the vault")]
    VestedBalanceMismatch,
    #[msg("Invalid stake account metadata PDA")]
    InvalidStakeAccountMetadataPDA,
    #[msg("Invalid stake account checkpoints PDA")]
    InvalidStakeAccountCheckpointsPDA,
    #[msg("Transfer vest to myself")]
    TransferVestToMyself,
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
    #[msg("Error of signature parsing")]
    ErrorOfSignatureParsing,
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
    #[msg("Invalid function signature")]
    InvalidFunctionSignature,
    #[msg("Proposal not initialized since start is zero")]
    ProposalNotInitialized,
}
