use crate::error::ProposalWormholeMessageError;
use anchor_lang::prelude::borsh::BorshSchema;
use anchor_lang::prelude::*;

pub struct ProposalDataFromEthResponse {
    pub proposal_id: [u8; 32],
    pub vote_start: u64,
}

pub struct ProposalQueryRequestData {
    pub signature: [u8; 4],
    pub proposal_id: [u8; 32],
}

#[account]
#[derive(Default, Debug, BorshSchema, InitSpace)]
pub struct SpokeMetadataCollector {
    pub bump: u8,
    // The hub chain id
    pub hub_chain_id: u16,
    // Wormhole Hub Proposal Metadata Contract (Ethereum address)
    pub hub_proposal_metadata: [u8; 20],
    // Wormhole contract handling messages
    pub wormhole_core: Pubkey,
    // Updates to hub_proposal_metadata are governance controlled
    pub updates_controlled_by_governance: bool,
}

impl SpokeMetadataCollector {
    pub const LEN: usize =
        SpokeMetadataCollector::DISCRIMINATOR.len() + SpokeMetadataCollector::INIT_SPACE;

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
        self.updates_controlled_by_governance = true;

        Ok(())
    }

    pub fn update_hub_proposal_metadata(
        &mut self,
        new_hub_proposal_metadata: [u8; 20],
    ) -> Result<()> {
        self.hub_proposal_metadata = new_hub_proposal_metadata;

        Ok(())
    }

    pub fn parse_eth_response_proposal_data(
        &mut self,
        data: &[u8],
    ) -> Result<ProposalDataFromEthResponse> {
        require!(
            data.len() == 64, // 32 + 32
            ProposalWormholeMessageError::InvalidDataLength
        );

        // Parse proposal_id (32 bytes)
        let proposal_id: [u8; 32] = data[0..32]
            .try_into()
            .map_err(|_| ProposalWormholeMessageError::ErrorOfProposalIdParsing)?;

        // Validate that bytes [32..56] are zeroed
        if data[32..56].iter().any(|&byte| byte != 0) {
            return err!(ProposalWormholeMessageError::ErrorOfVoteStartParsing);
        }

        // Parse vote_start (32 bytes)
        // Convert u256 to u64 since vote_start is a timestamp and does not actually exceed u64
        let vote_start = u64::from_be_bytes(
            data[56..64] // the last 8 bytes where the low bytes of uint256 are located
                .try_into()
                .map_err(|_| ProposalWormholeMessageError::ErrorOfVoteStartParsing)?,
        );

        Ok(ProposalDataFromEthResponse {
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

    #[test]
    fn check_spoke_metadata_collector_size() {
        assert!(SpokeMetadataCollector::LEN == 8 + 1 + 2 + 20 + 32 + 1); // 64
    }
}
