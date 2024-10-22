// solana/programs/staking/src/utils/execute_message.rs
use ethabi::{decode, encode, ParamType, Token};
use crate::state::ProgramError;

#[derive(Clone)]
pub struct SolanaAccountMeta {
    pub pubkey: [u8; 32],
    pub is_signer: bool,
    pub is_writable: bool,
}

pub struct SolanaInstruction {
    pub program_id: [u8; 32],
    pub accounts: Vec<SolanaAccountMeta>,
    pub data: Vec<u8>,
}

pub struct Message {
    pub message_id: u64,
    pub wormhole_chain_id: u16,
    pub instructions: Vec<SolanaInstruction>,
}

pub fn parse_abi_encoded_message(data: &[u8]) -> Result<Message, ProgramError> {
    let params = vec![ParamType::Tuple(vec![
        ParamType::Uint(256), // messageId
        ParamType::Uint(256), // wormholeChainId
        ParamType::Array(Box::new(ParamType::Tuple(vec![
            ParamType::FixedBytes(32), // programId (as bytes32)
            ParamType::Array(Box::new(ParamType::Tuple(vec![
                ParamType::FixedBytes(32), // pubkey (as bytes32)
                ParamType::Bool,           // isSigner
                ParamType::Bool,           // isWritable
            ]))),
            ParamType::Bytes, // data
        ]))),
    ])];

    let tokens = decode(&params, data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let message_tuple = tokens
        .get(0)
        .ok_or(ProgramError::InvalidInstructionData)?
        .clone()
        .into_tuple()
        .ok_or(ProgramError::InvalidInstructionData)?;

    // **Extract message_id from message_tuple**
    let message_id_token = message_tuple
        .get(0)
        .ok_or(ProgramError::InvalidInstructionData)?;
    let message_id = message_id_token
        .clone()
        .into_uint()
        .ok_or(ProgramError::InvalidInstructionData)?
        .as_u64();

    // **Extract wormhole_chain_id from message_tuple**
    let wormhole_chain_id_token = message_tuple
        .get(1)
        .ok_or(ProgramError::InvalidInstructionData)?;
    let wormhole_chain_id = wormhole_chain_id_token
        .clone()
        .into_uint()
        .ok_or(ProgramError::InvalidInstructionData)?
        .as_u64() as u16;

    // **Extract instructions array from message_tuple**
    let instructions_token = message_tuple
        .get(2)
        .ok_or(ProgramError::InvalidInstructionData)?;
    let instructions_array = instructions_token
        .clone()
        .into_array()
        .ok_or(ProgramError::InvalidInstructionData)?;

    let mut instructions = Vec::new();

    for instr_token in instructions_array {
        let instr_tuple = instr_token
            .into_tuple()
            .ok_or(ProgramError::InvalidInstructionData)?;

        // Extract program_id
        let program_id_token = instr_tuple
            .get(0)
            .ok_or(ProgramError::InvalidInstructionData)?;
        let program_id = program_id_token
            .clone()
            .into_fixed_bytes()
            .ok_or(ProgramError::InvalidInstructionData)?
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?;

        // Extract accounts array
        let accounts_token = instr_tuple
            .get(1)
            .ok_or(ProgramError::InvalidInstructionData)?;
        let accounts_array = accounts_token
            .clone()
            .into_array()
            .ok_or(ProgramError::InvalidInstructionData)?;

        let mut accounts = Vec::new();

        for account_token in accounts_array {
            let account_tuple = account_token
                .into_tuple()
                .ok_or(ProgramError::InvalidInstructionData)?;

            // Extract pubkey
            let pubkey_token = account_tuple
                .get(0)
                .ok_or(ProgramError::InvalidInstructionData)?;
            let pubkey = pubkey_token
                .clone()
                .into_fixed_bytes()
                .ok_or(ProgramError::InvalidInstructionData)?
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?;

            // Extract is_signer
            let is_signer_token = account_tuple
                .get(1)
                .ok_or(ProgramError::InvalidInstructionData)?;
            let is_signer = is_signer_token
                .clone()
                .into_bool()
                .ok_or(ProgramError::InvalidInstructionData)?;

            // Extract is_writable
            let is_writable_token = account_tuple
                .get(2)
                .ok_or(ProgramError::InvalidInstructionData)?;
            let is_writable = is_writable_token
                .clone()
                .into_bool()
                .ok_or(ProgramError::InvalidInstructionData)?;

            accounts.push(SolanaAccountMeta {
                pubkey,
                is_signer,
                is_writable,
            });
        }

        // Extract instruction data
        let data_token = instr_tuple
            .get(2)
            .ok_or(ProgramError::InvalidInstructionData)?;
        let data = data_token
            .clone()
            .into_bytes()
            .ok_or(ProgramError::InvalidInstructionData)?;

        instructions.push(SolanaInstruction {
            program_id,
            accounts,
            data,
        });
    }

    Ok(Message {
        message_id,
        wormhole_chain_id,
        instructions,
    })
}

#[test]
fn test_parse_abi_encoded_message() {
    // Prepare test data
    // Construct the message as it would be encoded in Solidity

    // Example data for testing
    let message_id: u64 = 1;
    let wormhole_chain_id: u16 = 1; // Assuming Solana chain ID is 1

    // Create account metas
    let account_meta = SolanaAccountMeta {
        pubkey: [0x11; 32], // Example public key
        is_signer: true,
        is_writable: true,
    };

    // Create instruction
    let instruction = SolanaInstruction {
        program_id: [0x22; 32], // Example program ID
        accounts: vec![account_meta.clone()],
        data: vec![0x01, 0x02, 0x03], // Example instruction data
    };

    // **Encode accounts properly**
    let accounts_tokens: Vec<Token> = instruction.accounts.iter().map(|account| {
        Token::Tuple(vec![
            Token::FixedBytes(account.pubkey.to_vec()),
            Token::Bool(account.is_signer),
            Token::Bool(account.is_writable),
        ])
    }).collect();

    // **Encode the instruction using ethabi tokens**
    let instruction_token = Token::Tuple(vec![
        Token::FixedBytes(instruction.program_id.to_vec()),
        Token::Array(accounts_tokens),
        Token::Bytes(instruction.data.clone()),
    ]);

    // **Encode the message using ethabi tokens**
    let message_token = Token::Tuple(vec![
        Token::Uint(message_id.into()),
        Token::Uint((wormhole_chain_id as u64).into()),
        Token::Array(vec![instruction_token]),
    ]);

    // Encode the tokens into bytes
    let encoded_message = encode(&[message_token]);

    // Attempt to parse the ABI-encoded message
    let parsed_message = parse_abi_encoded_message(&encoded_message).expect("Failed to parse message");

    // Assertions to verify that parsing was successful
    assert_eq!(parsed_message.message_id, message_id);
    assert_eq!(parsed_message.wormhole_chain_id, wormhole_chain_id);
    assert_eq!(parsed_message.instructions.len(), 1);

    let parsed_instruction = &parsed_message.instructions[0];
    assert_eq!(parsed_instruction.program_id, instruction.program_id);
    assert_eq!(parsed_instruction.accounts.len(), 1);
    assert_eq!(parsed_instruction.data, instruction.data);

    let parsed_account_meta = &parsed_instruction.accounts[0];
    assert_eq!(parsed_account_meta.pubkey, account_meta.pubkey);
    assert_eq!(parsed_account_meta.is_signer, account_meta.is_signer);
    assert_eq!(parsed_account_meta.is_writable, account_meta.is_writable);
}

#[cfg(test)]
mod tests {
    use super::*;
    use hex::decode as hex_decode;

    #[test]
    fn test_parse_real_abi_encoded_message() {
        // Hex string provided from Solidity contract
        let hex_data = "\
        0000000000000000000000000000000000000000000000000000000000000000\
        0000000000000000000000000000000000000000000000000000000000000001\
        0000000000000000000000000000000000000000000000000000000000000080\
        0000000000000000000000000000000000000000000000000000000000000001\
        0000000000000000000000000000000000000000000000000000000000000020\
        42D381E13C2E2771F21A539E8CECE69BBCF00759884D0A108CD808BF8D8FEDED\
        0000000000000000000000000000000000000000000000000000000000000060\
        00000000000000000000000000000000000000000000000000000000000000E0\
        0000000000000000000000000000000000000000000000000000000000000001\
        C453CA036BBB742729F35727845114FB5C842EEA45A255CE794FDCB5EA7658F3\
        0000000000000000000000000000000000000000000000000000000000000000\
        0000000000000000000000000000000000000000000000000000000000000001\
        0000000000000000000000000000000000000000000000000000000000000020\
        00000000000000000000000000000000000000000000000000000000000003E8";

        // Remove whitespace and newlines
        let hex_data = hex_data.replace("\n", "").replace(" ", "");

        // Decode the hex string into bytes
        let encoded_message = hex_decode(hex_data).expect("Failed to decode hex string");

        // Attempt to parse the ABI-encoded message
        let parsed_message = parse_abi_encoded_message(&encoded_message)
            .expect("Failed to parse message");

        // Assertions to verify that parsing was successful
        assert_eq!(parsed_message.message_id, 0);
        assert_eq!(parsed_message.wormhole_chain_id, 1);
        assert_eq!(parsed_message.instructions.len(), 1);

        // Now check the instruction
        let instruction = &parsed_message.instructions[0];
        let expected_program_id = hex_decode("42D381E13C2E2771F21A539E8CECE69BBCF00759884D0A108CD808BF8D8FEDED")
            .expect("Failed to decode program_id");
        assert_eq!(instruction.program_id, expected_program_id.as_slice());

        // Check accounts
        assert_eq!(instruction.accounts.len(), 1);
        let account = &instruction.accounts[0];
        let expected_pubkey = hex_decode("C453CA036BBB742729F35727845114FB5C842EEA45A255CE794FDCB5EA7658F3")
            .expect("Failed to decode pubkey");
        assert_eq!(account.pubkey, expected_pubkey.as_slice());
        assert_eq!(account.is_signer, false);  // According to the data
        assert_eq!(account.is_writable, true); // According to the data

        // Check data
        let expected_data = hex_decode("00000000000000000000000000000000000000000000000000000000000003E8")
            .expect("Failed to decode data");
        assert_eq!(instruction.data, expected_data);
    }
}