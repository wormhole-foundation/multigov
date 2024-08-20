use crate::Pubkey;
use anchor_lang::account;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

#[account]
#[derive(BorshSchema)]
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
    // An account that will execute the cross chain proposal
    pub airlock: Pubkey,
}

#[account]
pub struct MessageReceived {
    // Execution status of the message
    pub executed: bool,
}

impl SpokeMessageExecutor {
    pub const LEN: usize = 8 + 8 + 32 + 2 + 2 + 32 + 32; // 116
}

impl MessageReceived {
    pub const LEN: usize = 8 + 1; // 9
}

#[cfg(test)]
pub mod tests {
    use super::SpokeMessageExecutor;
    use super::MessageReceived;
    use anchor_lang::Discriminator;

    #[test]
    fn check_spoke_message_executor_size() {
        assert!(
            std::mem::size_of::<SpokeMessageExecutor>()
                + SpokeMessageExecutor::discriminator().len()
                == SpokeMessageExecutor::LEN
        );
    }

    #[test]
    fn check_message_received_size() {
        assert!(
            std::mem::size_of::<MessageReceived>()
                + MessageReceived::discriminator().len()
                == MessageReceived::LEN
        );
    }
}
