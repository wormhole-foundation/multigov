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
  SolanaAccountQueryResponse
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
  bytes32 public constant EXPECTED_PROGRAM_ID = bytes32(uint256(0x1));
  uint8 public constant SOLANA_TOKEN_DECIMALS = 6;

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
    hubVotePool.registerSpoke(SPOKE_CHAIN_ID, addressToBytes32(address(0x1234))); // Mock Solana program
      // address
  }

  function _buildSolanaVoteQueryResponse(bytes32 _programId, uint16 _chainId, bytes memory _voteData)
    internal
    view
    returns (bytes memory)
  {
    bytes memory solanaQuery = QueryTest.buildSolanaAccountRequestBytes(
      bytes("finalized"),
      0, // min_context_slot
      0, // data_slice_offset
      0, // data_slice_length
      1, // num_accounts
      abi.encode(_programId) // account
    );

    bytes memory perChainRequest =
      QueryTest.buildPerChainRequestBytes(_chainId, hubSolanaSpokeVoteDecoder.QT_SOL_ACCOUNT(), solanaQuery);

    bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
      VERSION, // version
      0, // nonce
      1, // num per chain requests
      perChainRequest
    );

    bytes memory solanaAccountResult = QueryTest.buildEthCallResultBytes(
      abi.encode(
        uint64(1000), // lamports (8 bytes)
        uint64(0), // rent_epoch (8 bytes)
        bool(true), // executable (1 byte)
        _programId, // owner (32 bytes)
        uint32(_voteData.length), // data length (4 bytes)
        _voteData // account data
      )
    );

    bytes memory resp = QueryTest.buildSolanaAccountResponseBytes(
      uint64(vm.getBlockNumber()), // slot_number
      uint64(vm.getBlockTimestamp()) * 1000, // block_time microseconds
      blockhash(vm.getBlockNumber()), // block_hash
      1, // num_results
      solanaAccountResult
    );

    bytes memory fullResponse = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      queryRequestBytes,
      1, // num per chain responses
      QueryTest.buildPerChainResponseBytes(_chainId, hubSolanaSpokeVoteDecoder.QT_SOL_ACCOUNT(), resp)
    );

    console.log("Solana Query Length:", solanaQuery.length);
    console.log("Per Chain Request Length:", perChainRequest.length);
    console.log("Query Request Bytes Length:", queryRequestBytes.length);
    console.log("Solana Account Result Length:", solanaAccountResult.length);
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

contract Decode is HubSolanaSpokeVoteDecoderTest, ProposalTest {
  function _scale(uint256 _amount) internal view returns (uint256) {
    return _amount
      * (10 ** (hubSolanaSpokeVoteDecoder.HUB_TOKEN_DECIMALS() - hubSolanaSpokeVoteDecoder.SOLANA_TOKEN_DECIMALS()));
  }

  function testFuzz_CorrectlyParseChainResponseNice(uint256 _proposalId) public {
    _setGovernor(hubGovernor);

    bytes memory voteData = abi.encode(_proposalId, uint64(100), uint64(200), uint64(50));

    bytes memory voteQueryResponseRaw = _buildSolanaVoteQueryResponse(EXPECTED_PROGRAM_ID, SPOKE_CHAIN_ID, voteData);

    ParsedQueryResponse memory parsedResp =
      hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw, _getSignatures(voteQueryResponseRaw));

    ISpokeVoteDecoder.QueryVote memory queryVote =
      hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));

    assertEq(queryVote.proposalId, _proposalId, "Proposal ID mismatch");
    assertEq(
      queryVote.spokeProposalId, keccak256(abi.encode(SPOKE_CHAIN_ID, _proposalId)), "Spoke proposal ID mismatch"
    );
    assertEq(queryVote.proposalVote.abstainVotes, _scale(50), "Abstain votes mismatch");
    assertEq(queryVote.proposalVote.againstVotes, _scale(100), "Against votes mismatch");
    assertEq(queryVote.proposalVote.forVotes, _scale(200), "For votes mismatch");
    assertEq(queryVote.chainId, SPOKE_CHAIN_ID, "Chain ID mismatch");
  }

  // function testFuzz_RevertIf_SpokeIsNotRegistered(uint256 _proposalId, uint16 _queryChainId) public {
  //   vm.assume(_queryChainId != HUB_CHAIN_ID && _queryChainId != SPOKE_CHAIN_ID);

  //   bytes memory voteQueryResponseRaw =
  //     _buildSolanaVoteQueryResponse(EXPECTED_PROGRAM_ID, _queryChainId, VoteData(_proposalId, 100, 200, 50));

  //   ParsedQueryResponse memory parsedResp =
  //     hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw,
  // _getSignatures(voteQueryResponseRaw));

  //   assertEq(hubVotePool.getSpoke(_queryChainId, vm.getBlockTimestamp()), bytes32(0), "Spoke should not be
  // registered");

  //   vm.expectRevert(InvalidContractAddress.selector);
  //   hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  // }

  // function testFuzz_RevertIf_QueryBlockIsNotFinalized(uint256 _proposalId, bytes32 _slot, bytes memory _commitment)
  //   public
  // {
  //   vm.assume(keccak256(abi.encodePacked(_commitment)) != keccak256("finalized"));

  //   bytes memory solanaQuery = QueryTest.buildSolanaAccountRequestBytes(
  //     _commitment,
  //     0, // min_context_slot
  //     0, // data_slice_offset
  //     0, // data_slice_length
  //     1, // num_accounts
  //     abi.encodePacked(EXPECTED_PROGRAM_ID)
  //   );

  //   bytes memory queryRequestBytes = QueryTest.buildOffChainQueryRequestBytes(
  //     VERSION,
  //     0,
  //     1,
  //     QueryTest.buildPerChainRequestBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_ACCOUNT(), solanaQuery)
  //   );

  //   bytes memory accountData = abi.encodePacked(uint64(100), uint64(200), uint64(50));

  //   bytes memory solanaResp = QueryTest.buildSolanaAccountResponseBytes(
  //     0,
  //     uint64(block.timestamp),
  //     blockhash(block.number),
  //     1,
  //     QueryTest.buildEthCallResultBytes(
  //       abi.encodePacked(
  //         EXPECTED_PROGRAM_ID, // owner
  //         uint8(1), // executable
  //         uint64(1000), // lamports
  //         uint32(accountData.length), // data length
  //         accountData,
  //         EXPECTED_PROGRAM_ID // program_id
  //       )
  //     )
  //   );

  //   bytes memory _resp = QueryTest.buildQueryResponseBytes(
  //     VERSION,
  //     OFF_CHAIN_SENDER,
  //     OFF_CHAIN_SIGNATURE,
  //     queryRequestBytes,
  //     1,
  //     QueryTest.buildPerChainResponseBytes(SPOKE_CHAIN_ID, hubSolanaSpokeVoteDecoder.QT_SOL_ACCOUNT(), solanaResp)
  //   );

  //   IWormhole.Signature[] memory signatures = _getSignatures(_resp);
  //   ParsedQueryResponse memory parsedResp = hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(_resp, signatures);

  //   vm.expectRevert(abi.encodeWithSelector(HubSolanaSpokeVoteDecoder.InvalidQueryCommitment.selector));
  //   hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  // }

  // function testFuzz_RevertIf_InvalidProgramId(uint256 _proposalId, bytes32 _invalidProgramId) public {
  //   vm.assume(_invalidProgramId != EXPECTED_PROGRAM_ID);

  //   bytes memory voteQueryResponseRaw =
  //     _buildSolanaVoteQueryResponse(_invalidProgramId, SPOKE_CHAIN_ID, VoteData(_proposalId, 100, 200, 50));

  //   ParsedQueryResponse memory parsedResp =
  //     hubSolanaSpokeVoteDecoder.parseAndVerifyQueryResponse(voteQueryResponseRaw,
  // _getSignatures(voteQueryResponseRaw));

  //   vm.expectRevert(abi.encodeWithSelector(HubSolanaSpokeVoteDecoder.InvalidProgramId.selector,
  // EXPECTED_PROGRAM_ID));
  //   hubSolanaSpokeVoteDecoder.decode(parsedResp.responses[0], IGovernor(address(hubGovernor)));
  // }
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
