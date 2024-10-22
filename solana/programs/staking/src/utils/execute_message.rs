use crate::state::{
    msg,
    ProgramError,
    Pubkey,
};
use std::convert::TryInto;
use std::fmt;

/// Error codes for the parser
#[derive(Debug)]
pub enum ParserError {
    InvalidInstructionData,
    UnexpectedEndOfData,
}

impl From<ParserError> for ProgramError {
    fn from(_e: ParserError) -> Self {
        ProgramError::InvalidInstructionData
    }
}

/// Data structures to hold the parsed data
#[derive(Clone, Debug)]
pub struct AccountMeta {
    pub pubkey:      Pubkey,
    pub is_signer:   bool,
    pub is_writable: bool,
}

impl fmt::Display for AccountMeta {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "Pubkey:  {}, is_signer: {}, is_writable: {}",
            self.pubkey, self.is_signer, self.is_writable
        )
    }
}

#[derive(Debug)]
pub struct InstructionData {
    pub program_id: Pubkey,
    pub accounts:   Vec<AccountMeta>,
    pub data:       Vec<u8>,
}

impl fmt::Display for InstructionData {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "Program ID:  {}, Accounts: {:?}, Data: {:?}",
            self.program_id.to_string(),
            self.accounts,
            self.data
        )
    }
}


pub struct Message {
    pub message_id:        [u8; 32],
    pub wormhole_chain_id: u16,
    pub instructions:      Vec<InstructionData>,
}

impl fmt::Display for Message {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(
            f,
            "Message ID: {:?}, Wormhole Chain ID: {}, Instructions: {:?}",
            self.message_id, self.wormhole_chain_id, self.instructions
        )
    }
}

/// Parses an Ethereum ABI-encoded message
pub fn parse_abi_encoded_message(data: &[u8]) -> Result<Message, ProgramError> {
    let mut offset = 0;

    // Read messageId (uint256)
    let message_id_bytes = &data[offset..offset + 32];
    let message_id = message_id_bytes.try_into().unwrap();
    offset += 32;

    // Read wormholeChainId (uint256)
    let wormhole_chain_id_bytes = &data[offset..offset + 32];
    let wormhole_chain_id = u16::from_be_bytes(wormhole_chain_id_bytes[30..32].try_into().unwrap());
    offset += 32;

    // Read instructions offset (uint256)
    let instructions_offset_bytes = &data[offset..offset + 32];
    let instructions_offset =
        u64::from_be_bytes(instructions_offset_bytes[24..32].try_into().unwrap()) as usize;
    offset += 32;

    // The instructions_offset is absolute if it's a top-level parameter
    // Adjust the offset to point to the instructions data
    let instructions = parse_instructions(data, instructions_offset)?;

    Ok(Message {
        message_id,
        wormhole_chain_id,
        instructions,
    })
}


/// Parses the instructions array
fn parse_instructions(data: &[u8], offset: usize) -> Result<Vec<InstructionData>, ProgramError> {
    let mut offset = offset;

    // Read instructions array length
    let instructions_length_bytes = &data[offset..offset + 32];
    let instructions_length =
        u64::from_be_bytes(instructions_length_bytes[24..32].try_into().unwrap()) as usize;
    offset += 32;

    let mut instructions = Vec::with_capacity(instructions_length);

    for _ in 0..instructions_length {
        // Read instruction offset (uint256)
        let instruction_offset_bytes = &data[offset..offset + 32];
        let instruction_offset =
            u64::from_be_bytes(instruction_offset_bytes[24..32].try_into().unwrap()) as usize;
        offset += 32;

        // Parse individual instruction
        let instruction = parse_instruction(data, instruction_offset)?;
        instructions.push(instruction);
    }

    Ok(instructions)
}

/// Parses a single instruction
fn parse_instruction(data: &[u8], offset: usize) -> Result<InstructionData, ProgramError> {
    let mut offset = offset;

    // Read programId (bytes32)
    let program_id_bytes = &data[offset..offset + 32];
    let program_id = Pubkey::new_from_array(program_id_bytes.try_into().unwrap());
    offset += 32;

    // Read accounts array offset (uint256)
    let accounts_offset_bytes = &data[offset..offset + 32];
    let accounts_offset =
        u64::from_be_bytes(accounts_offset_bytes[24..32].try_into().unwrap()) as usize;
    offset += 32;

    // Read data offset (uint256)
    let data_offset_bytes = &data[offset..offset + 32];
    let data_offset = u64::from_be_bytes(data_offset_bytes[24..32].try_into().unwrap()) as usize;
    offset += 32;

    // Parse accounts
    let accounts = parse_accounts(data, accounts_offset)?;

    // Parse instruction data
    let instruction_data = parse_instruction_data(data, data_offset)?;

    Ok(InstructionData {
        program_id,
        accounts,
        data: instruction_data,
    })
}


/// Parses the accounts array
fn parse_accounts(data: &[u8], accounts_offset: usize) -> Result<Vec<AccountMeta>, ProgramError> {
    if accounts_offset == 0 {
        // No accounts to parse
        return Ok(vec![]);
    }

    let mut offset = accounts_offset;

    msg!("Parsing accounts at offset: {}", offset);

    // Read accounts array length
    let accounts_length_word = &data[offset..offset + 32];
    let accounts_length =
        u64::from_be_bytes(accounts_length_word[24..32].try_into().unwrap()) as usize;
    msg!("Accounts length: {}", accounts_length);
    offset += 32;

    if accounts_length == 0 {
        return Ok(vec![]);
    }

    let mut accounts = Vec::with_capacity(accounts_length);

    for _ in 0..accounts_length {
        // Read pubkey (bytes32)
        let pubkey_bytes = &data[offset..offset + 32];
        let pubkey = Pubkey::new_from_array(pubkey_bytes.try_into().unwrap());
        offset += 32;

        // Read isSigner (bool)
        let is_signer_word = &data[offset..offset + 32];
        let is_signer = is_signer_word[31] != 0;
        offset += 32;

        // Read isWritable (bool)
        let is_writable_word = &data[offset..offset + 32];
        let is_writable = is_writable_word[31] != 0;
        offset += 32;

        accounts.push(AccountMeta {
            pubkey,
            is_signer,
            is_writable,
        });
    }

    Ok(accounts)
}


/// Parses the instruction data
fn parse_instruction_data(data: &[u8], data_offset: usize) -> Result<Vec<u8>, ProgramError> {
    if data_offset == 0 {
        // No instruction data
        return Ok(vec![]);
    }

    let mut offset = data_offset;

    msg!("Parsing instruction data at offset: {}", offset);

    // Read data length
    let data_length_word = &data[offset..offset + 32];
    let data_length = u64::from_be_bytes(data_length_word[24..32].try_into().unwrap()) as usize;
    msg!("Instruction data length: {}", data_length);
    offset += 32;

    if data_length == 0 {
        return Ok(vec![]);
    }

    // Read data
    let data_end = offset + data_length;
    if data_end > data.len() {
        return Err(ParserError::UnexpectedEndOfData.into());
    }
    let instruction_data = data[offset..data_end].to_vec();

    Ok(instruction_data)
}


/// Deserializes the message
pub fn deserialize_message(data: &[u8]) -> Result<Message, ProgramError> {
    parse_abi_encoded_message(data)
}
