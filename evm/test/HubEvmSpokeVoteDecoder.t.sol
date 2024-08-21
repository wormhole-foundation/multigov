// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {
  ParsedPerChainQueryResponse, ParsedQueryResponse, InvalidContractAddress
} from "wormhole-sdk/QueryResponse.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubEvmSpokeVoteDecoder} from "src/HubEvmSpokeVoteDecoder.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {SpokeVoteAggregator} from "src/SpokeVoteAggregator.sol";
import {HubProposalMetadata} from "src/HubProposalMetadata.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {SpokeMetadataCollectorHarness} from "test/harnesses/SpokeMetadataCollectorHarness.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

contract HubEvmSpokeVoteDecoderTest is WormholeEthQueryTest, AddressUtils {
  HubGovernorHarness public hubGovernor;
  HubEvmSpokeVoteDecoder public hubCrossChainEvmVote;
  HubVotePoolHarness public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubProposalExtender public extender;
  SpokeVoteAggregator public spokeVoteAggregator;
  HubProposalMetadata public hubProposalMetadata;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WEIGHT_WINDOW = 1 days;
  uint16 public constant HUB_CHAIN_ID = 1;
  uint16 public constant SPOKE_CHAIN_ID = 2;
  uint48 public constant VOTE_TIME_EXTENSION = 1 days;
  uint48 public constant MINIMUM_VOTE_EXTENSION = 1 hours;

  function setUp() public {
    _setupWormhole();

    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    token = new ERC20VotesFake();

    hubVotePool = new HubVotePoolHarness(address(wormhole), initialOwner, address(timelock));

    extender = new HubProposalExtender(initialOwner, VOTE_TIME_EXTENSION, initialOwner, MINIMUM_VOTE_EXTENSION);

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Test Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: INITIAL_VOTING_DELAY,
      initialVotingPeriod: INITIAL_VOTING_PERIOD,
      initialProposalThreshold: PROPOSAL_THRESHOLD,
      initialQuorum: INITIAL_QUORUM,
      hubVotePoolOwner: address(timelock),
      wormholeCore: address(wormhole),
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: VOTE_WEIGHT_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);
    hubCrossChainEvmVote = new HubEvmSpokeVoteDecoder(address(wormhole), address(hubVotePool));
    hubProposalMetadata = new HubProposalMetadata(address(hubGovernor));
    spokeMetadataCollector =
      new SpokeMetadataCollectorHarness(address(wormhole), HUB_CHAIN_ID, address(hubProposalMetadata));
    spokeVoteAggregator =
      new SpokeVoteAggregator(address(spokeMetadataCollector), address(token), initialOwner, VOTE_WEIGHT_WINDOW);

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(SPOKE_CHAIN_ID, addressToBytes32(address(spokeVoteAggregator)));
  }

  function _buildAddProposalQuery(uint256 _proposalId, uint16 _responseChainId, address _hubProposalMetadata)
    internal
    view
    returns (bytes memory)
  {
    (uint256 returnedProposalId, uint256 voteStart) = _getActualProposalMetadata(_proposalId, _hubProposalMetadata);

    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // random blockId: a hash of the block number
      "finalized", // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        _hubProposalMetadata, abi.encodeWithSignature("getProposalMetadata(uint256)", _proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(_responseChainId, spokeMetadataCollector.QT_ETH_CALL_WITH_FINALITY(), ethCall)
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(vm.getBlockNumber()), // block number
      blockhash(vm.getBlockNumber()), // block hash
      uint64(vm.getBlockTimestamp()), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(abi.encode(returnedProposalId, voteStart)) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(
        _responseChainId, spokeMetadataCollector.QT_ETH_CALL_WITH_FINALITY(), ethCallResp
      )
    );
    return _resp;
  }

  function _getActualProposalMetadata(uint256 _proposalId, address _hubProposalMetadata)
    internal
    view
    returns (uint256 returnedProposalId, uint256 voteStart)
  {
    (returnedProposalId, voteStart) = HubProposalMetadata(_hubProposalMetadata).getProposalMetadata(_proposalId);
    assertEq(returnedProposalId, _proposalId, "Proposal ID mismatch");
  }

  function _createEmptyProposal(address proposer) internal returns (uint256 proposalId) {
    address[] memory targets = new address[](1);
    uint256[] memory values = new uint256[](1);
    bytes[] memory calldatas = new bytes[](1);
    string memory description = "Test Proposal";

    hubGovernor.exposed_setWhitelistedProposer(proposer);
    vm.prank(proposer);
    proposalId = hubGovernor.propose(targets, values, calldatas, description);

    bytes memory queryResponseRaw =
      _buildAddProposalQuery(proposalId, uint16(HUB_CHAIN_ID), address(hubProposalMetadata));

    IWormhole.Signature[] memory signatures = _getSignatures(queryResponseRaw);

    spokeMetadataCollector.addProposal(queryResponseRaw, signatures);

    return proposalId;
  }

  function _buildVoteQueryResponse(uint256 _proposalId, uint16 _chainId) internal view returns (bytes memory) {
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes("0x1296c33"), // blockId
      "finalized", // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        address(spokeVoteAggregator), abi.encodeWithSignature("proposalVotes(uint256)", _proposalId)
      )
    );
    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(_chainId, hubCrossChainEvmVote.QT_ETH_CALL_WITH_FINALITY(), ethCall)
    );

    (uint256 returnedProposalId, uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) =
      spokeVoteAggregator.proposalVotes(_proposalId);

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(vm.getBlockNumber()),
      blockhash(vm.getBlockNumber()),
      uint64(vm.getBlockTimestamp()),
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          returnedProposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(againstVotes),
            forVotes: uint128(forVotes),
            abstainVotes: uint128(abstainVotes)
          })
        )
      )
    );
    return QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_chainId, hubCrossChainEvmVote.QT_ETH_CALL_WITH_FINALITY(), ethCallResp)
    );
  }

  function _getSignatures(bytes memory _resp) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }

  function _mintAndDelegate(address user, uint256 amount) public returns (address) {
    token.mint(user, amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
    return user;
  }
}

contract Constructor is HubEvmSpokeVoteDecoderTest {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubVotePool) public {
    vm.assume(_core != address(0));
    HubEvmSpokeVoteDecoder vote = new HubEvmSpokeVoteDecoder(_core, _hubVotePool);
    assertEq(address(vote.wormhole()), _core);
    assertEq(address(vote.HUB_VOTE_POOL()), _hubVotePool);
  }
}

contract Decode is HubEvmSpokeVoteDecoderTest, ProposalTest {
  function testFuzz_CorrectlyParseChainResponse(address _proposer) public {
    vm.assume(_proposer != address(0));
    _setGovernor(hubGovernor);

    address[3] memory voters = [address(0x1), address(0x2), address(0x3)];
    for (uint8 i = 0; i < 3; i++) {
      _mintAndDelegate(voters[i], 1000e18);
    }

    uint256 proposalId = _createEmptyProposal(_proposer);

    _jumpToActiveProposal(proposalId);

    uint8[3] memory voteTypes = [0, 1, 2]; // Against, For, Abstain
    for (uint8 i = 0; i < 3; i++) {
      vm.prank(voters[i]);
      spokeVoteAggregator.castVote(proposalId, voteTypes[i]);
    }

    bytes memory voteQueryResponseRaw = _buildVoteQueryResponse(proposalId, SPOKE_CHAIN_ID);
    ParsedQueryResponse memory parsedResp =
      hubCrossChainEvmVote.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));
    ISpokeVoteDecoder.QueryVote memory queryVote = hubCrossChainEvmVote.decode(parsedResp.responses[0]);

    (uint256 returnedProposalId, uint256 expectedAgainstVotes, uint256 expectedForVotes, uint256 expectedAbstainVotes) =
      spokeVoteAggregator.proposalVotes(queryVote.proposalId);

    assertEq(queryVote.proposalId, returnedProposalId, "Proposal ID mismatch");
    assertEq(
      queryVote.spokeProposalId, keccak256(abi.encode(SPOKE_CHAIN_ID, returnedProposalId)), "Spoke proposal ID mismatch"
    );
    assertEq(queryVote.proposalVote.abstainVotes, expectedAbstainVotes, "Abstain votes mismatch");
    assertEq(queryVote.proposalVote.againstVotes, expectedAgainstVotes, "Against votes mismatch");
    assertEq(queryVote.proposalVote.forVotes, expectedForVotes, "For votes mismatch");
    assertEq(queryVote.chainId, SPOKE_CHAIN_ID, "Chain ID mismatch");
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(address proposer, uint16 _queryChainId) public {
    vm.assume(proposer != address(0));
    vm.assume(_queryChainId != HUB_CHAIN_ID && _queryChainId != SPOKE_CHAIN_ID);

    uint256 proposalId = _createEmptyProposal(proposer);

    bytes memory voteQueryResponseRaw = _buildVoteQueryResponse(proposalId, _queryChainId);

    ParsedQueryResponse memory parsedResp =
      hubCrossChainEvmVote.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));

    assertEq(hubVotePool.spokeRegistry(_queryChainId), bytes32(0), "Spoke should not be registered");

    vm.expectRevert(InvalidContractAddress.selector);
    hubCrossChainEvmVote.decode(parsedResp.responses[0]);
  }

  function testFuzz_RevertIf_QueryBlockIsNotFinalized(
    uint256 _proposalId,
    uint64 _abstainVotes,
    string memory blockId,
    bytes memory finality
  ) public {
    vm.assume(keccak256(finality) != keccak256("finalized"));
    vm.prank(address(timelock));
    hubVotePool.registerSpoke(MAINNET_CHAIN_ID, toWormholeFormat(GOVERNANCE_CONTRACT));
    bytes memory ethCall = QueryTest.buildEthCallWithFinalityRequestBytes(
      bytes(blockId), // random blockId: a hash of the block number
      finality, // finality
      1, // numCallData
      QueryTest.buildEthCallDataBytes(
        GOVERNANCE_CONTRACT, abi.encodeWithSignature("proposalVotes(uint256)", _proposalId)
      )
    );

    bytes memory _queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      QueryTest.buildPerChainRequestBytes(
        uint16(MAINNET_CHAIN_ID), // chainId: (Ethereum mainnet)
        hubVotePool.QT_ETH_CALL_WITH_FINALITY(),
        ethCall
      )
    );

    bytes memory ethCallResp = QueryTest.buildEthCallWithFinalityResponseBytes(
      uint64(block.number), // block number
      blockhash(block.number), // block hash
      uint64(block.timestamp), // block time US
      1, // numResults
      QueryTest.buildEthCallResultBytes(
        abi.encode(
          _proposalId,
          SpokeCountingFractional.ProposalVote({
            againstVotes: uint128(_abstainVotes),
            forVotes: uint128(_abstainVotes),
            abstainVotes: uint128(_abstainVotes)
          })
        )
      ) // results
    );

    // version and nonce are arbitrary
    bytes memory _resp = QueryTest.buildQueryResponseBytes(
      VERSION, // version
      OFF_CHAIN_SENDER, // sender chain id
      OFF_CHAIN_SIGNATURE, // signature
      _queryRequestBytes, // query request
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(
        uint16(MAINNET_CHAIN_ID), hubVotePool.QT_ETH_CALL_WITH_FINALITY(), ethCallResp
      )
    );

    IWormhole.Signature[] memory signatures = _getSignatures(_resp);
    ParsedQueryResponse memory parsedResp = hubCrossChainEvmVote.parseAndVerifyQueryResponse(_resp, signatures);
    vm.expectRevert(abi.encodeWithSelector(ISpokeVoteDecoder.InvalidQueryBlock.selector, bytes(blockId)));
    hubCrossChainEvmVote.decode(parsedResp.responses[0]);
  }
}

contract SupportsInterface is HubEvmSpokeVoteDecoderTest {
  function test_Erc165InterfaceIsSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IERC165).interfaceId);
    assertTrue(isValid);
  }

  function test_CrossChainVoteInterfaceSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(ISpokeVoteDecoder).interfaceId);
    assertTrue(isValid);
  }

  function test_InterfaceIsNotSupported() public view {
    bool isValid = hubCrossChainEvmVote.supportsInterface(type(IWormhole).interfaceId);
    assertFalse(isValid);
  }
}
