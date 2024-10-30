use anchor_lang::prelude::*;
use ethabi::{
    decode,
    ParamType,
};
use std::io::{
    Error as IoError,
    ErrorKind,
    Read,
    Write,
};
use std::result::Result as StdResult;

#[derive(Clone)]
pub struct SolanaAccountMeta {
    pub pubkey:      [u8; 32],
    pub is_signer:   bool,
    pub is_writable: bool,
}

#[derive(Clone)]
pub struct SolanaInstruction {
    pub program_id: [u8; 32],
    pub accounts:   Vec<SolanaAccountMeta>,
    pub data:       Vec<u8>,
}

#[derive(Clone)]
pub struct Message {
    pub message_id:        u64,
    pub wormhole_chain_id: u16,
    pub instructions:      Vec<SolanaInstruction>,
}

impl AnchorDeserialize for Message {
    fn deserialize(buf: &mut &[u8]) -> std::result::Result<Message, std::io::Error> {
        msg!("parse_abi_encoded_message...");
        parse_abi_encoded_message(&buf)
    }

    fn deserialize_reader<R: Read>(reader: &mut R) -> std::io::Result<Self> {
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf)?;
        let mut slice = buf.as_slice();
        Self::deserialize(&mut slice)
    }
}

impl AnchorSerialize for Message {
    fn serialize<W: Write>(&self, _writer: &mut W) -> std::result::Result<(), std::io::Error> {
        Ok(())
    }
}

pub fn parse_abi_encoded_message(data: &[u8]) -> StdResult<Message, IoError> {
    msg!("Starting parse_abi_encoded_message...");
    msg!("Data length: {}", data.len());
    msg!("Data hex: {}", hex::encode(data));


    let params = vec![ParamType::Tuple(vec![
        ParamType::Uint(256), // messageId
        ParamType::Uint(256), // wormholeChainId
        ParamType::Uint(256), // instruction.lenght
        ParamType::Array(Box::new(ParamType::Tuple(vec![
            ParamType::FixedBytes(32), // programId
            ParamType::Array(Box::new(ParamType::Tuple(vec![
                ParamType::FixedBytes(32), // pubkey
                ParamType::Bool,           // isSigner
                ParamType::Bool,           // isWritable
            ]))),
            ParamType::Bytes, // data
        ]))),
    ])];

    msg!("Params: {:?}", params);

    let tokens = decode(&params, data).map_err(|e| {
        IoError::new(
            ErrorKind::InvalidData,
            format!("Failed to decode ABI data: {}", e),
        )
    })?;
    msg!("Decoded tokens: {:?}", tokens);

    let message_tuple = tokens
        .get(0)
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing message tuple"))?
        .clone()
        .into_tuple()
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to convert to tuple"))?;

    // Extract message_id
    let message_id = message_tuple
        .get(0)
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing message_id"))?
        .clone()
        .into_uint()
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse message_id"))?
        .as_u64();

    // Extract wormhole_chain_id
    let wormhole_chain_id = message_tuple
        .get(1)
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing wormhole_chain_id"))?
        .clone()
        .into_uint()
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse wormhole_chain_id"))?
        .as_u64() as u16;


    // Extract instructions array
    let instructions_array = message_tuple
        .get(3)
        .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing instructions array"))?
        .clone()
        .into_array()
        .ok_or_else(|| {
            IoError::new(ErrorKind::InvalidData, "Failed to parse instructions array")
        })?;

    println!("instructions_array.len(): {}", instructions_array.len());

    let mut instructions = Vec::new();

    for instr_token in instructions_array {
        let instr_tuple = instr_token.into_tuple().ok_or_else(|| {
            IoError::new(ErrorKind::InvalidData, "Failed to parse instruction tuple")
        })?;

        // Extract program_id
        let program_id = instr_tuple
            .get(0)
            .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing program_id"))?
            .clone()
            .into_fixed_bytes()
            .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse program_id"))?
            .try_into()
            .map_err(|_| IoError::new(ErrorKind::InvalidData, "Invalid program_id length"))?;

        // Extract accounts array
        let accounts_array = instr_tuple
            .get(1)
            .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing accounts array"))?
            .clone()
            .into_array()
            .ok_or_else(|| {
                IoError::new(ErrorKind::InvalidData, "Failed to parse accounts array")
            })?;

        let mut accounts = Vec::new();

        for account_token in accounts_array {
            let account_tuple = account_token.into_tuple().ok_or_else(|| {
                IoError::new(ErrorKind::InvalidData, "Failed to parse account tuple")
            })?;

            // Extract pubkey
            let pubkey = account_tuple
                .get(0)
                .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing pubkey"))?
                .clone()
                .into_fixed_bytes()
                .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse pubkey"))?
                .try_into()
                .map_err(|_| IoError::new(ErrorKind::InvalidData, "Invalid pubkey length"))?;

            // Extract is_signer
            let is_signer = account_tuple
                .get(1)
                .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing is_signer"))?
                .clone()
                .into_bool()
                .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse is_signer"))?;

            // Extract is_writable
            let is_writable = account_tuple
                .get(2)
                .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing is_writable"))?
                .clone()
                .into_bool()
                .ok_or_else(|| {
                    IoError::new(ErrorKind::InvalidData, "Failed to parse is_writable")
                })?;

            accounts.push(SolanaAccountMeta {
                pubkey,
                is_signer,
                is_writable,
            });
        }

        // Extract instruction data
        let data = instr_tuple
            .get(2)
            .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Missing data"))?
            .clone()
            .into_bytes()
            .ok_or_else(|| IoError::new(ErrorKind::InvalidData, "Failed to parse data"))?;

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


#[cfg(test)]
mod tests {
    use super::*;
    use ethabi::{
        encode,
        Token,
    };
    use hex::decode as hex_decode;

    #[test]
    fn test_parse_abi_encoded_message() {
        // Prepare test data
        // Construct the message as it would be encoded in Solidity

        // Example data for testing
        let message_id: u64 = 1;
        let wormhole_chain_id: u16 = 1; // Assuming Solana chain ID is 1

        // Create account metas
        let account_meta = SolanaAccountMeta {
            pubkey:      [0x11; 32], // Example public key
            is_signer:   true,
            is_writable: true,
        };

        // Create instruction
        let instruction = SolanaInstruction {
            program_id: [0x22; 32], // Example program ID
            accounts:   vec![account_meta.clone()],
            data:       vec![0x01, 0x02, 0x03], // Example instruction data
        };

        // **Encode accounts properly**
        let accounts_tokens: Vec<Token> = instruction
            .accounts
            .iter()
            .map(|account| {
                Token::Tuple(vec![
                    Token::FixedBytes(account.pubkey.to_vec()),
                    Token::Bool(account.is_signer),
                    Token::Bool(account.is_writable),
                ])
            })
            .collect();

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
            Token::Uint((1u64).into()),
            Token::Array(vec![instruction_token]),
        ]);

        // Encode the tokens into bytes
        let encoded_message = encode(&[message_token]);

        // Attempt to parse the ABI-encoded message
        let parsed_message =
            parse_abi_encoded_message(&encoded_message).expect("Failed to parse message");

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

    // #[test]
    // fn test_parse_real_abi_encoded_message() {
    //     // Hex string provided from Solidity contract
    //     let hex_data = "020000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000221fd064255d33746ad7522a9c1cdb7c2fce29383ba4600dde36ca7539c1fd07800000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001c6347e298d586376049f0ee221e15d6b1a4d4a56c47e8e52451237be4d1e185b00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000c02000000e8030000000000000000000000000000000000000000000000000000";
    // 
    //     // Decode the hex string into bytes
    //     let encoded_message = hex_decode(hex_data).expect("Failed to decode hex string");
    // 
    //     // Attempt to parse the ABI-encoded message
    //     let parsed_message =
    //         parse_abi_encoded_message(&encoded_message[3..]).expect("Failed to parse message");
    // 
    //     // Assertions to verify that parsing was successful
    //     assert_eq!(parsed_message.message_id, 1);
    //     assert_eq!(parsed_message.wormhole_chain_id, 1);
    //     assert_eq!(parsed_message.instructions.len(), 1);
    // }
}
