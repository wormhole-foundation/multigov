// SPDX-License-Identifier: Apache 2
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IWormhole} from "wormhole/interfaces/IWormhole.sol";
import {QueryTest} from "wormhole-sdk/testing/helpers/QueryTest.sol";
import {EmptyWormholeAddress} from "wormhole/query/QueryResponse.sol";

import {HubProposalPool} from "src/HubProposalPool.sol";
import {WormholeEthQueryTest} from "test/helpers/WormholeEthQueryTest.sol";
import {AddressUtils} from "test/helpers/AddressUtils.sol";
import {ProposalBuilder} from "test/helpers/ProposalBuilder.sol";
import {GovernorMock} from "test/mocks/GovernorMock.sol";
import {ERC20VotesFake} from "test/fakes/ERC20VotesFake.sol";

contract HubProposalPoolTest is WormholeEthQueryTest, AddressUtils {
  HubProposalPool public hubProposalPool;
  GovernorMock public hubGovernor;
  ERC20VotesFake public token;

  uint256 public constant PROPOSAL_THRESHOLD = 1000e18;

  function setUp() public {
    _setupWormhole();
    hubGovernor = new GovernorMock();
    hubGovernor.setProposalThreshold(PROPOSAL_THRESHOLD);
    hubProposalPool = new HubProposalPool(address(wormhole), address(hubGovernor));
    token = new ERC20VotesFake();
    hubGovernor.setToken(address(token));
  }

  function _mockQueryResponse(uint256[] memory voteWeights, uint16[] memory chainIds, address governance)
    internal
    view
    returns (bytes memory)
  {
    require(voteWeights.length == chainIds.length, "Mismatched input lengths");
    require(chainIds.length <= type(uint8).max, "Too many chains");

    bytes memory queryRequestBytes = "";
    bytes memory perChainResponses = "";

    for (uint256 i = 0; i < chainIds.length; i++) {
      bytes memory ethCall = QueryTest.buildEthCallRequestBytes(
        bytes("0x1296c33"),
        1,
        QueryTest.buildEthCallDataBytes(
          governance, abi.encodeWithSignature("getVotes(address,uint256)", address(this), block.number)
        )
      );

      queryRequestBytes = abi.encodePacked(
        queryRequestBytes, QueryTest.buildPerChainRequestBytes(chainIds[i], hubProposalPool.QT_ETH_CALL(), ethCall)
      );

      bytes memory ethCallResp = QueryTest.buildEthCallResponseBytes(
        uint64(block.number),
        blockhash(block.number),
        uint64(block.timestamp),
        1,
        QueryTest.buildEthCallResultBytes(abi.encode(voteWeights[i]))
      );

      perChainResponses = abi.encodePacked(
        perChainResponses, QueryTest.buildPerChainResponseBytes(chainIds[i], hubProposalPool.QT_ETH_CALL(), ethCallResp)
      );
    }

    bytes memory response = QueryTest.buildQueryResponseBytes(
      VERSION,
      OFF_CHAIN_SENDER,
      OFF_CHAIN_SIGNATURE,
      QueryTest.buildOffChainQueryRequestBytes(VERSION, 0, uint8(chainIds.length), queryRequestBytes),
      uint8(chainIds.length),
      perChainResponses
    );

    return response;
  }

  function _getSignatures(bytes memory response) internal view returns (IWormhole.Signature[] memory) {
    (uint8 sigV, bytes32 sigR, bytes32 sigS) = getSignature(response, address(hubProposalPool));
    IWormhole.Signature[] memory signatures = new IWormhole.Signature[](1);
    signatures[0] = IWormhole.Signature({r: sigR, s: sigS, v: sigV, guardianIndex: 0});
    return signatures;
  }

  function _createProposal(bytes memory callData) internal returns (ProposalBuilder) {
    ProposalBuilder builder = new ProposalBuilder();
    builder.push(address(hubGovernor), 0, callData);
    return builder;
  }

  function _createArbitraryProposal() internal returns (ProposalBuilder) {
    return _createProposal(abi.encodeWithSignature("setQuorum(uint208)", 100));
  }

  function _mintAndDelegate(address user, uint256 _amount) public returns (address) {
    token.mint(user, _amount);
    vm.prank(user);
    token.delegate(user);
    vm.warp(vm.getBlockTimestamp() + 1);
    return user;
  }
}

contract Constructor is Test {
  function testFuzz_CorrectlySetConstructorArgs(address _core, address _hubGovernor) public {
    vm.assume(_core != address(0));
    vm.assume(_hubGovernor != address(0));

    HubProposalPool hubProposalPool = new HubProposalPool(_core, _hubGovernor);
    assertEq(address(hubProposalPool.WORMHOLE_CORE()), _core);
    assertEq(address(hubProposalPool.HUB_GOVERNOR()), _hubGovernor);
  }

  function testFuzz_RevertIf_CoreIsZeroAddress(address _hubGovernor) public {
    vm.expectRevert(EmptyWormholeAddress.selector);
    new HubProposalPool(address(0), _hubGovernor);
  }

  function testFuzz_RevertIf_HubGovernorIsZeroAddress(address _core) public {
    vm.assume(_core != address(0));
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
    new HubProposalPool(_core, address(0));
  }
}

contract CheckAndProposeIfEligible is HubProposalPoolTest {
  function testFuzz_CorrectlyCheckAndProposeIfEligible(
    uint256[] calldata _voteWeights,
    uint16[] calldata _chainIds,
    uint256 _hubVoteWeight,
    string memory _description,
    address _caller
  ) public {
    vm.assume(_caller != address(0));
    vm.assume(_voteWeights.length == _chainIds.length);
    vm.assume(_voteWeights.length > 0 && _voteWeights.length <= 5); // Limit to 5 chains for practical testing
    _hubVoteWeight = bound(_hubVoteWeight, 0, PROPOSAL_THRESHOLD); // Ensure hub vote weight is within reasonable range

    uint256 totalVoteWeight = 0;
    for (uint256 i = 0; i < _voteWeights.length; i++) {
      totalVoteWeight += _voteWeights[i];
      vm.assume(_chainIds[i] != 0); // Ensure no chain ID is 0
    }

    // Set hub governor whitelisted proposer
    vm.prank(address(hubGovernor));
    hubGovernor.setWhitelistedProposer(_caller);

    // mint and delagate
    _mintAndDelegate(_caller, _hubVoteWeight);

    vm.warp(vm.getBlockTimestamp() + 1);

    totalVoteWeight += _hubVoteWeight;

    vm.assume(totalVoteWeight >= PROPOSAL_THRESHOLD);

    bytes memory queryResponse = _mockQueryResponse(_voteWeights, _chainIds, address(hubGovernor));
    IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

    ProposalBuilder builder = _createArbitraryProposal();

    vm.startPrank(_caller);
    uint256 proposalId = hubProposalPool.checkAndProposeIfEligible(
      builder.targets(), builder.values(), builder.calldatas(), _description, queryResponse, signatures
    );
    vm.stopPrank();

    assertTrue(proposalId > 0, "Proposal should be created");
  }

  // function testFuzz_RevertIf_InsufficientVoteWeight(uint256[] memory voteWeights, uint16[] memory chainIds) public {
  //   vm.assume(voteWeights.length == chainIds.length);
  //   vm.assume(voteWeights.length > 0 && voteWeights.length <= 5);

  //   uint256 totalVoteWeight = 0;
  //   for (uint256 i = 0; i < voteWeights.length; i++) {
  //     totalVoteWeight += voteWeights[i];
  //     vm.assume(chainIds[i] != 0);
  //   }

  //   vm.assume(totalVoteWeight < PROPOSAL_THRESHOLD);

  //   bytes memory queryResponse = _mockQueryResponse(voteWeights, chainIds, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.InsufficientVoteWeight.selector);
  //   hubProposalPool.checkAndProposeIfEligible(
  //     builder.targets(), builder.values(), builder.calldatas(), description, queryResponse, signatures
  //   );
  // }

  // function testFuzz_RevertIf_InvalidProposalLength() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createProposal(hex"");
  //   builder.push(address(0x456), 2 ether, hex""); // Adding extra data to mismatch length
  //   address[] memory targets = builder.targets();
  //   uint256[] memory values = new uint256[](1); // Mismatched length
  //   bytes[] memory calldatas = builder.calldatas();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.InvalidProposalLength.selector);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_RevertIf_EmptyProposal() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   address[] memory targets = new address[](0);
  //   uint256[] memory values = new uint256[](0);
  //   bytes[] memory calldatas = new bytes[](0);
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(HubProposalPool.EmptyProposal.selector);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_RevertIf_NotCalledByOwner(address _caller) public {
  //   vm.assume(_caller != address(0));
  //   vm.assume(_caller != address(hubProposalPool.owner()));

  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   address[] memory targets = builder.targets();
  //   uint256[] memory values = builder.values();
  //   bytes[] memory calldatas = builder.calldatas();
  //   string memory description = "Test Proposal";

  //   vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _caller));
  //   vm.prank(_caller);
  //   hubProposalPool.checkAndProposeIfEligible(targets, values, calldatas, description, queryResponse, signatures);
  // }

  // function testFuzz_EmitsProposalCreatedEvent() public {
  //   bytes memory queryResponse = _mockQueryResponse(PROPOSAL_THRESHOLD, MAINNET_CHAIN_ID, address(hubGovernor));
  //   IWormhole.Signature[] memory signatures = _getSignatures(queryResponse);

  //   ProposalBuilder builder = _createArbitraryProposal();
  //   string memory description = "Test Proposal";

  //   vm.expectEmit();
  //   emit HubProposalPool.ProposalCreated(1); // Assuming first proposal ID is 1

  //   hubProposalPool.checkAndProposeIfEligible(
  //     builder.targets(), builder.values(), builder.calldatas(), description, queryResponse, signatures
  //   );
  // }
}
