use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(Default, Debug, BorshSchema, InitSpace)]
pub struct SpokeMessageExecutor {
    pub bump: u8,
    // The hub dispatcher address
    pub hub_dispatcher: Pubkey,
    // The hub chain id
    pub hub_chain_id: u16,
    // The spoke chain id
    pub spoke_chain_id: u16,
    // Wormhole contract handling messages
    pub wormhole_core: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct MessageReceived {
    pub bump: u8,
}

impl SpokeMessageExecutor {
    pub const LEN: usize =
        SpokeMessageExecutor::DISCRIMINATOR.len() + SpokeMessageExecutor::INIT_SPACE;
}

impl MessageReceived {
    pub const LEN: usize = MessageReceived::DISCRIMINATOR.len() + MessageReceived::INIT_SPACE;
}

#[cfg(test)]
pub mod tests {
    use super::{MessageReceived, SpokeMessageExecutor};

    #[test]
    fn check_spoke_message_executor_size() {
        assert!(SpokeMessageExecutor::LEN == 8 + 1 + 32 + 2 + 2 + 32); // 77
    }

    #[test]
    fn check_message_received_size() {
        assert!(MessageReceived::LEN == 8 + 1); // 9
    }
}
