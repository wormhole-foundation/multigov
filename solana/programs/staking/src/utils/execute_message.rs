use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;
use arrayref::array_ref;
use crate::context::{ExecuteMessage, AIRLOCK_SEED};

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize)]
pub struct SolanaAccountMeta {
    pub pubkey: [u8; 32],
    pub is_signer: bool,
    pub is_writable: bool,
}

#[derive(Debug, )]
pub struct SolanaInstruction {
    pub program_id: [u8; 32],
    pub accounts: Vec<SolanaAccountMeta>,
    pub data: Vec<u8>,
}

#[derive(Debug)]
pub struct Message {
    pub message_id: u64,
    pub wormhole_chain_id: u16,
    pub instructions: Vec<SolanaInstruction>,
}

pub fn deserialize_message(encoded_message: &[u8]) -> Result<Message> {
    let mut offset = 0;

    // Start deserializing the message
    // Read message_id (uint256)
    let message_id = read_u64(encoded_message, &mut offset)?;

    // Read wormhole_chain_id (uint16)
    let wormhole_chain_id = read_u16(encoded_message, &mut offset)?;

    // Read instructions_length (uint256)
    let instructions_length = read_usize(encoded_message, &mut offset)?;

    // Read instructions array
    let mut instructions = Vec::new();
    for _ in 0..instructions_length {
        // Parse each SolanaInstruction
        let instruction = parse_instruction(encoded_message, &mut offset)?;
        instructions.push(instruction);
    }

    Ok(Message {
        message_id,
        wormhole_chain_id,
        instructions,
    })
}

fn parse_instruction(encoded_message: &[u8], offset: &mut usize) -> Result<SolanaInstruction> {
    // Read program_id (bytes32)
    if *offset + 32 > encoded_message.len() {
        return Err(error!(ErrorCode::InvalidMessageFormat));
    }
    let program_id = *array_ref![encoded_message, *offset, 32];
    *offset += 32;

    // Read accounts_length (uint256)
    let accounts_length = read_usize(encoded_message, offset)?;

    // Parse accounts
    let mut accounts = Vec::new();
    for _ in 0..accounts_length {
        let account = parse_account(encoded_message, offset)?;
        accounts.push(account);
    }

    // Read data_length (uint256)
    let data_length = read_usize(encoded_message, offset)?;
    if *offset + data_length > encoded_message.len() {
        return Err(error!(ErrorCode::InvalidMessageFormat));
    }
    let data = encoded_message[*offset..*offset + data_length].to_vec();
    *offset += data_length;

    Ok(SolanaInstruction {
        program_id,
        accounts,
        data,
    })
}

fn parse_account(encoded_message: &[u8], offset: &mut usize) -> Result<SolanaAccountMeta> {
    // Read pubkey (bytes32)
    if *offset + 32 > encoded_message.len() {
        return Err(error!(ErrorCode::InvalidMessageFormat));
    }
    let pubkey = *array_ref![encoded_message, *offset, 32];
    *offset += 32;

    // Read is_signer (bool)
    let is_signer = read_bool(encoded_message, offset)?;

    // Read is_writable (bool)
    let is_writable = read_bool(encoded_message, offset)?;

    Ok(SolanaAccountMeta {
        pubkey,
        is_signer,
        is_writable,
    })
}

// Helper functions for reading data from the byte array

/// Reads a 32-byte big-endian unsigned integer from the byte array at the current offset.
/// Advances the offset by 32 bytes.
fn read_u256_be(bytes: &[u8], offset: &mut usize) -> Result<[u8; 32]> {
    if *offset + 32 > bytes.len() {
        return Err(error!(ErrorCode::InvalidMessageFormat));
    }
    let data = *array_ref![bytes, *offset, 32];
    *offset += 32;
    Ok(data)
}

/// Reads a u64 value from the last 8 bytes of a 32-byte big-endian unsigned integer.
fn read_u64(bytes: &[u8], offset: &mut usize) -> Result<u64> {
    let data = read_u256_be(bytes, offset)?;
    Ok(u64::from_be_bytes(*array_ref![data, 24, 8]))
}

/// Reads a u16 value from the last 2 bytes of a 32-byte big-endian unsigned integer.
fn read_u16(bytes: &[u8], offset: &mut usize) -> Result<u16> {
    let data = read_u256_be(bytes, offset)?;
    Ok(u16::from_be_bytes(*array_ref![data, 30, 2]))
}

/// Reads a usize value (from a u64 in the last 8 bytes of a 32-byte big-endian unsigned integer).
fn read_usize(bytes: &[u8], offset: &mut usize) -> Result<usize> {
    let data = read_u256_be(bytes, offset)?;
    Ok(u64::from_be_bytes(*array_ref![data, 24, 8]) as usize)
}

/// Reads a boolean value from the last byte of a 32-byte big-endian unsigned integer.
fn read_bool(bytes: &[u8], offset: &mut usize) -> Result<bool> {
    let data = read_u256_be(bytes, offset)?;
    match data[31] {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(error!(ErrorCode::InvalidMessageFormat)),
    }
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid message format.")]
    InvalidMessageFormat,
    #[msg("Message has already been executed.")]
    MessageAlreadyExecuted,
    #[msg("Missing account required for instruction.")]
    MissingAccount,
    // ... other error codes
}

pub fn to_account_info_slice<'info>(accounts: &[&'info AccountInfo<'info>]) -> &'info [AccountInfo<'info>] {
    // SAFETY: This is safe because &[&AccountInfo<'info>] and &[AccountInfo<'info>] have the same memory layout
    unsafe { std::mem::transmute(accounts) }
}

// Helper function outside the #[program] module
pub fn process_instruction<'info>(
    payer: AccountInfo<'info>,
    airlock: AccountInfo<'info>,
    mut remaining_accounts: Vec<AccountInfo<'info>>,
    instruction: &SolanaInstruction,
    airlock_bump: u8,
) -> Result<()> {
    let accounts = instruction
        .accounts
        .iter()
        .map(|meta| {
            let pubkey = Pubkey::new_from_array(meta.pubkey);
            if meta.is_writable {
                if meta.is_signer {
                    AccountMeta::new(pubkey, true)
                } else {
                    AccountMeta::new(pubkey, false)
                }
            } else {
                if meta.is_signer {
                    AccountMeta::new_readonly(pubkey, true)
                } else {
                    AccountMeta::new_readonly(pubkey, false)
                }
            }
        })
        .collect::<Vec<_>>();

    let ix = Instruction {
        program_id: Pubkey::new_from_array(instruction.program_id),
        accounts,
        data: instruction.data.clone(),
    };

    let mut all_account_infos = vec![payer, airlock];
    all_account_infos.append(&mut remaining_accounts);

    let signer_seeds: &[&[&[u8]]] = &[&[AIRLOCK_SEED.as_bytes(), &[airlock_bump]]];

    invoke_signed(&ix, &all_account_infos, signer_seeds)?;

    Ok(())
}





