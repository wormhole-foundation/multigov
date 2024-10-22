use crate::state::{
    ProgramError,
    Pubkey,
};
use core::convert::TryInto;

/// Define maximum allowed values to prevent excessive memory allocation
const MAX_INSTRUCTIONS: usize = 10;
const MAX_ACCOUNTS: usize = 20;
const MAX_DATA_LENGTH: usize = 1024;

/// Data structures to hold the parsed data
#[derive(Clone, Debug)]
pub struct AccountMeta {
    pub pubkey:      Pubkey,
    pub is_signer:   bool,
    pub is_writable: bool,
}

#[derive(Debug)]
pub struct InstructionData {
    pub program_id: Pubkey,
    pub accounts:   Vec<AccountMeta>,
    pub data:       Vec<u8>,
}

pub struct Message {
    pub message_id:        [u8; 32],
    pub wormhole_chain_id: u16,
    pub instructions:      Vec<InstructionData>,
}

/// Parses an Ethereum ABI-encoded message
pub fn parse_abi_encoded_message(data: &[u8]) -> Result<Message, ProgramError> {
    let mut offset = 0;

    // Ensure data length is sufficient
    if data.len() < 96 {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Read messageId (uint256)
    let message_id_bytes = &data[offset..offset + 32];
    let message_id = message_id_bytes.try_into().unwrap();
    offset += 32;

    // Read wormholeChainId (uint256)
    let wormhole_chain_id_bytes = &data[offset..offset + 32];
    let wormhole_chain_id = u16::from_be_bytes(
        wormhole_chain_id_bytes[30..32]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    offset += 32;

    // Read instructions length (uint256)
    let instructions_length_bytes = &data[offset..offset + 32];
    let instructions_length = u64::from_be_bytes(
        instructions_length_bytes[24..32]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ) as usize;
    offset += 32;

    if instructions_length > MAX_INSTRUCTIONS {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Parse instructions
    let mut instructions = Vec::with_capacity(instructions_length);
    for _ in 0..instructions_length {
        // Parse instruction
        let instruction = parse_instruction(data, &mut offset)?;
        instructions.push(instruction);
    }

    Ok(Message {
        message_id,
        wormhole_chain_id,
        instructions,
    })
}

/// Parses a single instruction
fn parse_instruction(data: &[u8], offset: &mut usize) -> Result<InstructionData, ProgramError> {
    // Ensure there's enough data for program_id
    if *offset + 32 > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Read programId (bytes32)
    let program_id_bytes = &data[*offset..*offset + 32];
    let program_id = Pubkey::new_from_array(
        program_id_bytes
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    *offset += 32;

    // Read accounts length (uint256)
    if *offset + 32 > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    let accounts_length_bytes = &data[*offset..*offset + 32];
    let accounts_length = u64::from_be_bytes(
        accounts_length_bytes[24..32]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ) as usize;
    *offset += 32;

    if accounts_length > MAX_ACCOUNTS {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Parse accounts
    let mut accounts = Vec::with_capacity(accounts_length);
    for _ in 0..accounts_length {
        // Ensure enough data for pubkey, isSigner, isWritable
        if *offset + 96 > data.len() {
            return Err(ProgramError::InvalidInstructionData);
        }

        // Read pubkey (bytes32)
        let pubkey_bytes = &data[*offset..*offset + 32];
        let pubkey = Pubkey::new_from_array(
            pubkey_bytes
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        *offset += 32;

        // Read isSigner (bool)
        let is_signer_word = &data[*offset..*offset + 32];
        let is_signer = is_signer_word[31] != 0;
        *offset += 32;

        // Read isWritable (bool)
        let is_writable_word = &data[*offset..*offset + 32];
        let is_writable = is_writable_word[31] != 0;
        *offset += 32;

        accounts.push(AccountMeta {
            pubkey,
            is_signer,
            is_writable,
        });
    }

    // Read data length (uint256)
    if *offset + 32 > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    let data_length_bytes = &data[*offset..*offset + 32];
    let data_length = u64::from_be_bytes(
        data_length_bytes[24..32]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ) as usize;
    *offset += 32;

    if data_length > MAX_DATA_LENGTH {
        return Err(ProgramError::InvalidInstructionData);
    }

    // Read data
    if *offset + data_length > data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    let data_bytes = &data[*offset..*offset + data_length];
    let instruction_data = data_bytes.to_vec();
    *offset += data_length;

    Ok(InstructionData {
        program_id,
        accounts,
        data: instruction_data,
    })
}

/// Deserializes the message
pub fn deserialize_message(data: &[u8]) -> Result<Message, ProgramError> {
    parse_abi_encoded_message(data)
}
