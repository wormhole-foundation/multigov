// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IWormhole} from "wormhole-sdk/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {
  ParsedPerChainQueryResponse,
  ParsedQueryResponse,
  InvalidContractAddress,
  SolanaAccountQueryResponse,
  InvalidChainId
} from "wormhole-sdk/QueryResponse.sol";
import {toWormholeFormat} from "wormhole-sdk/Utils.sol";
import {HubGovernor} from "src/HubGovernor.sol";
import {HubSolanaSpokeVoteDecoder} from "src/HubSolanaSpokeVoteDecoder.sol";
import {HubVotePool} from "src/HubVotePool.sol";
import {HubProposalExtender} from "src/HubProposalExtender.sol";
import {ISpokeVoteDecoder} from "src/interfaces/ISpokeVoteDecoder.sol";
import {SpokeCountingFractional} from "src/lib/SpokeCountingFractional.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {HubVotePoolHarness} from "test/harnesses/HubVotePoolHarness.sol";
import {HubGovernorHarness} from "test/harnesses/HubGovernorHarness.sol";
// import {WormholeSolanaQueryTest} from "test/helpers/WormholeSolanaQueryTest.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";
import {TimelockControllerFake} from "test/fakes/TimelockControllerFake.sol";
import {ProposalTest} from "test/helpers/ProposalTest.sol";

// TODO do we need to implement WormholeSolanaQueryTest?
contract HubSolanaSpokeVoteDecoderTest is WormholeEthQueryTest, AddressUtils {
  HubGovernorHarness public hubGovernor;
  HubSolanaSpokeVoteDecoder public hubSolanaSpokeVoteDecoder;
  HubVotePoolHarness public hubVotePool;
  ERC20VotesFake public token;
  TimelockControllerFake public timelock;
  HubProposalExtender public extender;

  uint48 public constant INITIAL_VOTING_DELAY = 1 days;
  uint32 public constant INITIAL_VOTING_PERIOD = 1 days;
  uint208 public constant INITIAL_QUORUM = 100e18;
  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;
  uint48 public constant VOTE_WEIGHT_WINDOW = 1 days;
  uint16 public constant HUB_CHAIN_ID = 2; // Mainnet
  uint16 public constant SPOKE_CHAIN_ID = 1; // Solana
  uint48 public constant VOTE_TIME_EXTENSION = 1 days;
  uint48 public constant MINIMUM_VOTE_EXTENSION = 1 hours;
  bytes32 public constant EXPECTED_PROGRAM_ID =
    bytes32(hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded");
  uint8 public constant SOLANA_TOKEN_DECIMALS = 6;
  address PROPOSER = makeAddr("proposer");

  function setUp() public {
    _setupWormhole();

    address initialOwner = makeAddr("Initial Owner");
    timelock = new TimelockControllerFake(initialOwner);
    address hubVotePoolOwner = address(timelock);
    token = new ERC20VotesFake();

    extender = new HubProposalExtender(initialOwner, VOTE_TIME_EXTENSION, initialOwner, MINIMUM_VOTE_EXTENSION);

    HubGovernor.ConstructorParams memory params = HubGovernor.ConstructorParams({
      name: "Test Gov",
      token: token,
      timelock: timelock,
      initialVotingDelay: INITIAL_VOTING_DELAY,
      initialVotingPeriod: INITIAL_VOTING_PERIOD,
      initialProposalThreshold: PROPOSAL_THRESHOLD,
      initialQuorum: INITIAL_QUORUM,
      hubVotePoolOwner: hubVotePoolOwner,
      wormholeCore: address(wormhole),
      governorProposalExtender: address(extender),
      initialVoteWeightWindow: VOTE_WEIGHT_WINDOW
    });

    hubGovernor = new HubGovernorHarness(params);
    hubVotePool = new HubVotePoolHarness(address(wormhole), address(hubGovernor), hubVotePoolOwner);
    hubSolanaSpokeVoteDecoder =
      new HubSolanaSpokeVoteDecoder(address(wormhole), address(hubVotePool), EXPECTED_PROGRAM_ID, SOLANA_TOKEN_DECIMALS);

    vm.prank(address(timelock));
    hubVotePool.registerSpoke(SPOKE_CHAIN_ID, EXPECTED_PROGRAM_ID); // Mock Solana program

    token.mint(PROPOSER, PROPOSAL_THRESHOLD * 2);
    vm.prank(PROPOSER);
    token.delegate(PROPOSER);
    vm.warp(vm.getBlockTimestamp() + 1);
    // address
  }

  function _createEmptyProposal() internal returns (uint256 proposalId) {
    address[] memory targets = new address[](1);
    uint256[] memory values = new uint256[](1);
    bytes[] memory calldatas = new bytes[](1);
    string memory description = "Test Proposal";

    vm.warp(vm.getBlockTimestamp() + 7 days);
    vm.prank(PROPOSER);
    proposalId = hubGovernor.propose(targets, values, calldatas, description);

    return proposalId;
  }

  function _buildPdaEntries(uint256 _proposalId)
    internal
    view
    returns (bytes[] memory _pdaEntries, bytes memory _seeds, uint8 _numSeeds)
  {
    bytes[] memory seeds = new bytes[](2);
    seeds[0] = "proposal";
    seeds[1] = abi.encodePacked(bytes32(uint256(_proposalId)));
    (_seeds, _numSeeds) = QueryTest.buildSolanaPdaSeedBytes(seeds);
    bytes memory _solanaPdaEntry = QueryTest.buildSolanaPdaEntry(
      bytes32(hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded"), _numSeeds, _seeds
    );

    _pdaEntries = new bytes[](1);
    _pdaEntries[0] = _solanaPdaEntry;
  }

  function _buildSolanaVoteQueryResponse(uint256 _proposalId, uint16 _queryChainId, bytes memory _voteData)
    internal
    view
    returns (bytes memory)
  {
    return _buildSolanaVoteQueryResponse(EXPECTED_PROGRAM_ID, _proposalId, _queryChainId, _voteData);
  }

  function _buildSolanaVoteQueryResponse(
    bytes32 _programId,
    uint256 _proposalId,
    uint16 _queryChainId,
    bytes memory _voteData
  ) internal view returns (bytes memory) {
    (bytes[] memory _pdaEntries, bytes memory _seeds, uint8 _numSeeds) = _buildPdaEntries(_proposalId);
    bytes memory solanaQuery = QueryTest.buildSolanaPdaRequestBytes(
      bytes("finalized"),
      0, // min_context_slot
      0, // data_slice_offset
      0, // data_slice_length
      _pdaEntries
    );

    bytes memory perChainRequest =
      QueryTest.buildPerChainRequestBytes(_queryChainId, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), solanaQuery);

    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      perChainRequest
    );

    bytes32 _programIdReset = _programId;
    bytes memory _newVoteData = _voteData;
    bytes memory solanaPdaResult = abi.encodePacked(
      _programIdReset, // program id
        // hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // account
      uint8(254), // bump
      uint64(1000), // lamports (8 bytes)
      uint64(0), // rent_epoch (8 bytes)
      bool(false), // executable (1 byte)
      _programIdReset, // owner
      uint32(_newVoteData.length),
      _newVoteData // data
    );

    bytes memory resp = QueryTest.buildSolanaPdaResponseBytes(
      uint64(vm.getBlockNumber()), // slot_number
      uint64(vm.getBlockTimestamp()) * 1000, // block_time microseconds
      blockhash(vm.getBlockNumber()), // block_hash
      1, // num_results
      solanaPdaResult
    );

    uint16 queryChain = _queryChainId;

    bytes memory fullResponse = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(queryChain, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), resp)
    );

    console.log("Solana Query Length:", solanaQuery.length);
    console.log("Per Chain Request Length:", perChainRequest.length);
    console.log("Query Request Bytes Length:", queryRequestBytes.length);
    console.log("Solana Account Result Length:", solanaPdaResult.length);
    console.log("Response Length:", resp.length);
    console.log("Full Response Length:", fullResponse.length);

    return fullResponse;
  }

  function _getSignatures(bytes memory _resp) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(_resp, address(hubVotePool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }
}

contract Constructor is HubSolanaSpokeVoteDecoderTest {
  function testFuzz_CorrectlySetConstructorArgs(address _core, bytes32 _expectedProgramId, uint8 _solanaTokenDecimals)
    public
  {
    vm.assume(_core != address(0));
    HubSolanaSpokeVoteDecoder voteDecoder =
      new HubSolanaSpokeVoteDecoder(_core, address(hubVotePool), _expectedProgramId, _solanaTokenDecimals);
    assertEq(address(voteDecoder.wormhole()), _core);
    assertEq(address(voteDecoder.HUB_VOTE_POOL()), address(hubVotePool));
    assertEq(voteDecoder.EXPECTED_PROGRAM_ID(), _expectedProgramId);
    assertEq(voteDecoder.HUB_TOKEN_DECIMALS(), IERC20Metadata(address(hubGovernor.token())).decimals());
    assertEq(voteDecoder.SOLANA_TOKEN_DECIMALS(), _solanaTokenDecimals);
  }
}
// 1. InvalidDataSlice
// 2. Too many results
// 3. invalid proposal seed first
// 4. invalid seed second
// 5. Data incorrect length
// 6. Invalid account owner
// 7. Invalid contract address

contract Decode is HubSolanaSpokeVoteDecoderTest, ProposalTest {
  function _scale(uint256 _amount) internal view returns (uint256) {
    return _amount
      * (10 ** (hubSolanaSpokeVoteDecoder.HUB_TOKEN_DECIMALS() - hubSolanaSpokeVoteDecoder.SOLANA_TOKEN_DECIMALS()));
  }

  function testFuzz_CorrectlyParseChainResponseNice() public {
    _setGovernor(hubGovernor);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    uint256 proposalId = _createEmptyProposal();
    bytes memory voteData = abi.encodePacked(uint256(proposalId), uint64(100), uint64(200), uint64(50));

    bytes memory voteQueryResponseRaw = _buildSolanaVoteQueryResponse(proposalId, SPOKE_CHAIN_ID, voteData);

    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));

    ISpokeVoteDecoder.QueryVote memory queryVote =
      hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));

    assertEq(queryVote.proposalId, proposalId, "Proposal ID mismatch");
    assertEq(queryVote.spokeProposalId, keccak256(abi.encode(SPOKE_CHAIN_ID, proposalId)), "Spoke proposal ID mismatch");
    assertEq(queryVote.proposalVote.abstainVotes, _scale(50), "Abstain votes mismatch");
    assertEq(queryVote.proposalVote.againstVotes, _scale(100), "Against votes mismatch");
    assertEq(queryVote.proposalVote.forVotes, _scale(200), "For votes mismatch");
    assertEq(queryVote.chainId, SPOKE_CHAIN_ID, "Chain ID mismatch");
  }

  function testFuzz_RevertIf_InvalidDataSlice(uint64 _requestDataSliceOffset, uint64 _requestDataSliceLength) public {
    vm.assume(_requestDataSliceOffset != 0 && _requestDataSliceLength != 0);
    uint256 _proposalId = _createEmptyProposal();
    bytes memory voteData = abi.encodePacked(uint256(_proposalId), uint64(100), uint64(200), uint64(50));
    (bytes[] memory _pdaEntries, bytes memory _seeds, uint8 _numSeeds) = _buildPdaEntries(_proposalId);
    bytes memory solanaQuery = QueryTest.buildSolanaPdaRequestBytes(
      bytes("finalized"),
      _requestDataSliceOffset, // min_context_slot
      _requestDataSliceLength, // data_slice_offset
      0, // data_slice_length
      _pdaEntries
    );

    bytes memory perChainRequest =
      QueryTest.buildPerChainRequestBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), solanaQuery);

    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      perChainRequest
    );

    bytes memory solanaPdaResult = abi.encodePacked(
      hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // program id
        // hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // account
      uint8(254), // bump
      uint64(1000), // lamports (8 bytes)
      uint64(0), // rent_epoch (8 bytes)
      bool(false), // executable (1 byte)
      hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // owner
      uint32(voteData.length),
      voteData // data
    );

    bytes memory resp = QueryTest.buildSolanaPdaResponseBytes(
      uint64(vm.getBlockNumber()), // slot_number
      uint64(vm.getBlockTimestamp()) * 1000, // block_time microseconds
      blockhash(vm.getBlockNumber()), // block_hash
      1, // num_results
      solanaPdaResult
    );

    bytes memory fullResponse = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), resp)
    );

    IWormhole.Signature[] memory signatures = _getSignatures(fullResponse);
    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(fullResponse, signatures);

    vm.expectRevert(abi.encodeWithSelector(HubSolanaSpokeVoteDecoder.InvalidDataSlice.selector));
    hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  }

  function testFuzz_RevertIf_SpokeIsNotRegistered(uint16 _queryChainId) public {
    vm.assume(_queryChainId != SPOKE_CHAIN_ID);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    uint256 proposalId = _createEmptyProposal();

    bytes memory voteData = abi.encodePacked(uint256(proposalId), uint64(100), uint64(200), uint64(50));
    bytes memory voteQueryResponseRaw = _buildSolanaVoteQueryResponse(proposalId, _queryChainId, voteData);

    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));

    assertEq(hubVotePool.getSpoke(_queryChainId, vm.getBlockTimestamp()), bytes32(0), "Spoke should not be registered");

    vm.expectRevert(InvalidChainId.selector);
    hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  }

  function testFuzz_RevertIf_QueryBlockIsNotFinalized(uint256 _proposalId, bytes32 _slot, bytes12 _commitment) public {
    vm.assume(_commitment != bytes12("finalized"));

    bytes memory voteData = abi.encodePacked(uint256(_proposalId), uint64(100), uint64(200), uint64(50));
    (bytes[] memory _pdaEntries, bytes memory _seeds, uint8 _numSeeds) = _buildPdaEntries(_proposalId);
    bytes memory solanaQuery = QueryTest.buildSolanaPdaRequestBytes(
      abi.encodePacked(_commitment),
      0, // min_context_slot
      0, // data_slice_offset
      0, // data_slice_length
      _pdaEntries
    );

    bytes memory perChainRequest =
      QueryTest.buildPerChainRequestBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), solanaQuery);

    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      perChainRequest
    );

    bytes memory solanaPdaResult = abi.encodePacked(
      hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // program id
        // hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // account
      uint8(254), // bump
      uint64(1000), // lamports (8 bytes)
      uint64(0), // rent_epoch (8 bytes)
      bool(false), // executable (1 byte)
      hex"42d381e13c2e2771f21a539e8cece69bbcf00759884d0a108cd808bf8d8feded", // owner
      uint32(voteData.length),
      voteData // data
    );

    bytes memory resp = QueryTest.buildSolanaPdaResponseBytes(
      uint64(vm.getBlockNumber()), // slot_number
      uint64(vm.getBlockTimestamp()) * 1000, // block_time microseconds
      blockhash(vm.getBlockNumber()), // block_hash
      1, // num_results
      solanaPdaResult
    );

    bytes memory fullResponse = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_PDA(), resp)
    );

    IWormhole.Signature[] memory signatures = _getSignatures(fullResponse);
    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(fullResponse, signatures);

    vm.expectRevert(abi.encodeWithSelector(HubSolanaSpokeVoteDecoder.InvalidQueryCommitment.selector));
    hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  }

  function testFuzz_RevertIf_InvalidProgramId(uint256 _proposalId, bytes32 _invalidProgramId) public {
    vm.assume(_invalidProgramId != EXPECTED_PROGRAM_ID);

    vm.warp(vm.getBlockTimestamp() + 7 days);
    uint256 proposalId = _createEmptyProposal();

    bytes memory voteData = abi.encodePacked(uint256(_proposalId), uint64(100), uint64(200), uint64(50));
    bytes memory voteQueryResponseRaw =
      _buildSolanaVoteQueryResponse(_invalidProgramId, _proposalId, SPOKE_CHAIN_ID, voteData);

    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));

    vm.expectRevert(abi.encodeWithSelector(HubSolanaSpokeVoteDecoder.InvalidProgramId.selector, EXPECTED_PROGRAM_ID));
    hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  }
}

contract SupportsInterface is HubSolanaSpokeVoteDecoderTest {
  function test_Erc165InterfaceIsSupported() public view {
    bool isValid = hubSolanaSpokeVoteDecoder.supportsInterface(type(IERC165).interfaceId);
    assertTrue(isValid);
  }

  function test_CrossChainVoteInterfaceSupported() public view {
    bool isValid = hubSolanaSpokeVoteDecoder.supportsInterface(type(ISpokeVoteDecoder).interfaceId);
    assertTrue(isValid);
  }

  function test_InterfaceIsNotSupported() public view {
    bool isValid = hubSolanaSpokeVoteDecoder.supportsInterface(type(IWormhole).interfaceId);
    assertFalse(isValid);
  }
}
