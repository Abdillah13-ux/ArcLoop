// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RotatingSavingsPool} from "../src/RotatingSavingsPool.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

contract RotatingSavingsPoolTest is Test {
    RotatingSavingsPool internal savingsPool;
    MockUSDC internal token;

    address internal creator = address(0xA11CE);
    address internal memberOne = address(0xB0B);
    address internal memberTwo = address(0xCA11);
    address internal memberThree = address(0xD00D);
    address internal outsider = address(0xE0E);

    uint256 internal constant CONTRIBUTION_AMOUNT = 100e6;

    function setUp() public {
        savingsPool = new RotatingSavingsPool();
        token = new MockUSDC();

        token.mint(memberOne, 1_000e6);
        token.mint(memberTwo, 1_000e6);
        token.mint(memberThree, 1_000e6);
    }

    function testCreatePoolStoresCorrectData() public {
        uint256 poolId = _createPool(3);

        (
            address storedCreator,
            address storedToken,
            uint256 contributionAmount,
            uint256 maxMembers,
            uint256 currentRound,
            RotatingSavingsPool.PoolStatus status,
            uint256 memberCount
        ) = savingsPool.getPool(poolId);

        assertEq(storedCreator, creator);
        assertEq(storedToken, address(token));
        assertEq(contributionAmount, CONTRIBUTION_AMOUNT);
        assertEq(maxMembers, 3);
        assertEq(currentRound, 0);
        assertEq(uint256(status), uint256(RotatingSavingsPool.PoolStatus.Created));
        assertEq(memberCount, 0);
        assertEq(savingsPool.getPoolCount(), 1);
    }

    function testCreatePoolRejectsZeroToken() public {
        vm.prank(creator);
        vm.expectRevert(RotatingSavingsPool.InvalidToken.selector);
        savingsPool.createPool(address(0), CONTRIBUTION_AMOUNT, 3);
    }

    function testCreatePoolRejectsZeroContributionAmount() public {
        vm.prank(creator);
        vm.expectRevert(RotatingSavingsPool.InvalidContributionAmount.selector);
        savingsPool.createPool(address(token), 0, 3);
    }

    function testCreatePoolRejectsMaxMembersLessThanTwo() public {
        vm.prank(creator);
        vm.expectRevert(RotatingSavingsPool.InvalidMaxMembers.selector);
        savingsPool.createPool(address(token), CONTRIBUTION_AMOUNT, 1);
    }

    function testJoinPoolAddsMember() public {
        uint256 poolId = _createPool(3);

        vm.prank(memberOne);
        savingsPool.joinPool(poolId);

        address[] memory members = savingsPool.getMembers(poolId);
        assertEq(members.length, 1);
        assertEq(members[0], memberOne);
        assertTrue(savingsPool.isMember(poolId, memberOne));
    }

    function testJoinPoolRejectsDuplicateMember() public {
        uint256 poolId = _createPool(3);
        _join(poolId, memberOne);

        vm.prank(memberOne);
        vm.expectRevert(RotatingSavingsPool.AlreadyMember.selector);
        savingsPool.joinPool(poolId);
    }

    function testJoinPoolRejectsFullPool() public {
        uint256 poolId = _createPool(2);
        _join(poolId, memberOne);
        _join(poolId, memberTwo);

        vm.prank(memberThree);
        vm.expectRevert(RotatingSavingsPool.PoolFull.selector);
        savingsPool.joinPool(poolId);
    }

    function testStartPoolOnlyCreator() public {
        uint256 poolId = _createStartedPool(3);

        vm.prank(outsider);
        vm.expectRevert(RotatingSavingsPool.NotCreator.selector);
        savingsPool.startPool(poolId);
    }

    function testStartPoolRequiresFullMembers() public {
        uint256 poolId = _createPool(3);
        _join(poolId, memberOne);
        _join(poolId, memberTwo);

        vm.prank(creator);
        vm.expectRevert(RotatingSavingsPool.NotEnoughMembers.selector);
        savingsPool.startPool(poolId);
    }

    function testContributeTransfersTokenFromMember() public {
        uint256 poolId = _createStartedPool(3);
        _approve(poolId, memberOne);

        uint256 memberBalanceBefore = token.balanceOf(memberOne);
        vm.prank(memberOne);
        savingsPool.contribute(poolId);

        assertEq(token.balanceOf(memberOne), memberBalanceBefore - CONTRIBUTION_AMOUNT);
        assertEq(token.balanceOf(address(savingsPool)), CONTRIBUTION_AMOUNT);
        assertTrue(savingsPool.hasContributed(poolId, 0, memberOne));
        assertEq(savingsPool.roundContributionCount(poolId, 0), 1);
    }

    function testContributeRejectsNonMember() public {
        uint256 poolId = _createStartedPool(3);

        vm.prank(outsider);
        vm.expectRevert(RotatingSavingsPool.NotMember.selector);
        savingsPool.contribute(poolId);
    }

    function testContributeRejectsDuplicateContributionInSameRound() public {
        uint256 poolId = _createStartedPool(3);
        _contribute(poolId, memberOne);

        vm.prank(memberOne);
        vm.expectRevert(RotatingSavingsPool.AlreadyContributed.selector);
        savingsPool.contribute(poolId);
    }

    function testReleasePayoutRejectsBeforeAllMembersContributed() public {
        uint256 poolId = _createStartedPool(3);
        _contribute(poolId, memberOne);
        _contribute(poolId, memberTwo);

        vm.expectRevert(RotatingSavingsPool.RoundNotFullyFunded.selector);
        savingsPool.releasePayout(poolId);
    }

    function testReleasePayoutPaysCorrectRecipient() public {
        uint256 poolId = _createStartedPool(3);
        _fundRound(poolId);

        uint256 balanceBefore = token.balanceOf(memberOne);
        savingsPool.releasePayout(poolId);

        assertEq(token.balanceOf(memberOne), balanceBefore + (CONTRIBUTION_AMOUNT * 3));
        assertTrue(savingsPool.roundPaidOut(poolId, 0));
    }

    function testReleasePayoutAdvancesRound() public {
        uint256 poolId = _createStartedPool(3);
        _fundRound(poolId);

        savingsPool.releasePayout(poolId);

        (,,,, uint256 currentRound,,) = savingsPool.getPool(poolId);
        assertEq(currentRound, 1);
        assertEq(savingsPool.getCurrentRecipient(poolId), memberTwo);
    }

    function testFinalReleaseMarksPoolCompleted() public {
        uint256 poolId = _createStartedPool(3);

        _fundRound(poolId);
        savingsPool.releasePayout(poolId);

        _fundRound(poolId);
        savingsPool.releasePayout(poolId);

        _fundRound(poolId);
        savingsPool.releasePayout(poolId);

        (,,,, uint256 currentRound, RotatingSavingsPool.PoolStatus status,) = savingsPool.getPool(poolId);
        assertEq(currentRound, 3);
        assertEq(uint256(status), uint256(RotatingSavingsPool.PoolStatus.Completed));
    }

    function testCancelPoolOnlyBeforeStart() public {
        uint256 poolId = _createPool(3);

        vm.prank(creator);
        savingsPool.cancelPool(poolId);

        (,,,,, RotatingSavingsPool.PoolStatus status,) = savingsPool.getPool(poolId);
        assertEq(uint256(status), uint256(RotatingSavingsPool.PoolStatus.Cancelled));
    }

    function testCancelledPoolCannotBeJoined() public {
        uint256 poolId = _createPool(3);

        vm.prank(creator);
        savingsPool.cancelPool(poolId);

        vm.prank(memberOne);
        vm.expectRevert(RotatingSavingsPool.PoolNotCreated.selector);
        savingsPool.joinPool(poolId);
    }

    function testCannotCancelAfterStart() public {
        uint256 poolId = _createStartedPool(3);

        vm.prank(creator);
        vm.expectRevert(RotatingSavingsPool.PoolNotCreated.selector);
        savingsPool.cancelPool(poolId);
    }

    function _createPool(uint256 maxMembers) internal returns (uint256 poolId) {
        vm.prank(creator);
        poolId = savingsPool.createPool(address(token), CONTRIBUTION_AMOUNT, maxMembers);
    }

    function _createStartedPool(uint256 maxMembers) internal returns (uint256 poolId) {
        poolId = _createPool(maxMembers);
        _join(poolId, memberOne);
        _join(poolId, memberTwo);
        if (maxMembers > 2) {
            _join(poolId, memberThree);
        }

        vm.prank(creator);
        savingsPool.startPool(poolId);
    }

    function _join(uint256 poolId, address member) internal {
        vm.prank(member);
        savingsPool.joinPool(poolId);
    }

    function _approve(uint256, address member) internal {
        vm.prank(member);
        token.approve(address(savingsPool), CONTRIBUTION_AMOUNT);
    }

    function _contribute(uint256 poolId, address member) internal {
        _approve(poolId, member);
        vm.prank(member);
        savingsPool.contribute(poolId);
    }

    function _fundRound(uint256 poolId) internal {
        _contribute(poolId, memberOne);
        _contribute(poolId, memberTwo);
        _contribute(poolId, memberThree);
    }
}
