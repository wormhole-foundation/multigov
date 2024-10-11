use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

use crate::error::ProposalWormholeMessageError;

/// Save window by default
#[constant]
pub const DEFAULT_SAVE_WINDOW: u64 = 24 * 60 * 60;

pub struct ProposalDataFromEthResponse {
    pub contract_address: [u8; 20],
    pub proposal_id: [u8; 32],
    pub vote_start: u64,
}

pub struct ProposalQueryRequestData {
    pub signature: [u8; 4],
    pub proposal_id: [u8; 32],
}

#[account]
#[derive(Default, Debug, BorshSchema)]
pub struct SpokeMetadataCollector {
    pub bump: u8,
    // The hub chain id
    pub hub_chain_id: u16,
    // Wormhole Hub Proposal Metadata Contract (Ethereum address)
    pub hub_proposal_metadata: [u8; 20],
    // Wormhole contract handling messages
    pub wormhole_core: Pubkey,
    pub safe_window: u64,
}

impl SpokeMetadataCollector {
    pub const LEN: usize = 8 + 2 + 2 + 20 + 32 + 8; // 72 bytes

    pub fn initialize(
        &mut self,
        bump: u8,
        hub_chain_id: u16,
        hub_proposal_metadata: [u8; 20],
        wormhole_core: Pubkey,
    ) -> Result<()> {
        self.bump = bump;
        self.hub_chain_id = hub_chain_id;
        self.hub_proposal_metadata = hub_proposal_metadata;
        self.wormhole_core = wormhole_core;
        self.safe_window = DEFAULT_SAVE_WINDOW;

        Ok(())
    }

    pub fn parse_eth_response_proposal_data(
        &mut self,
        data: &[u8],
    ) -> Result<ProposalDataFromEthResponse> {
        require!(
            data.len() == 60, // 20 + 32 + 8
            ProposalWormholeMessageError::InvalidDataLength
        );

        // Parse contract_address (20 bytes)
        let contract_address: [u8; 20] = data[0..20]
            .try_into()
            .map_err(|_| ProposalWormholeMessageError::ErrorOfContractAddressParsing)?;

        // Parse proposal_id (32 bytes)
        let proposal_id: [u8; 32] = data[20..52]
            .try_into()
            .map_err(|_| ProposalWormholeMessageError::ErrorOfProposalIdParsing)?;

        // Parse vote_start (8 bytes)
        let vote_start = u64::from_le_bytes(
            data[52..60]
                .try_into()
                .map_err(|_| ProposalWormholeMessageError::ErrorOfVoteStartParsing)?,
        );

        Ok(ProposalDataFromEthResponse {
            contract_address,
            proposal_id,
            vote_start,
        })
    }

    pub fn parse_proposal_query_request_data(
        &mut self,
        calldata: &[u8],
    ) -> Result<ProposalQueryRequestData> {
        require!(
            calldata.len() == 36, // 4 + 32
            ProposalWormholeMessageError::InvalidDataLength
        );

        // Parse signature (4 bytes)
        let signature: [u8; 4] = calldata[0..4]
            .try_into()
            .map_err(|_| ProposalWormholeMessageError::ErrorOfSignatureParsing)?;

        // Parse proposal_id (32 bytes)
        let proposal_id: [u8; 32] = calldata[4..36]
            .try_into()
            .map_err(|_| ProposalWormholeMessageError::ErrorOfProposalIdParsing)?;

        Ok(ProposalQueryRequestData {
            signature,
            proposal_id,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::SpokeMetadataCollector;
    use anchor_lang::Discriminator;

    #[test]
    fn check_spoke_metadata_collector_size() {
        assert!(
            std::mem::size_of::<SpokeMetadataCollector>()
                + SpokeMetadataCollector::discriminator().len()
                == SpokeMetadataCollector::LEN
        );
    }
}
