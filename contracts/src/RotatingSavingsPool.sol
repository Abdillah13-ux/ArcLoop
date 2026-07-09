// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract RotatingSavingsPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PoolStatus {
        Created,
        Active,
        Completed,
        Cancelled
    }

    struct Pool {
        address creator;
        address token;
        uint256 contributionAmount;
        uint256 maxMembers;
        uint256 currentRound;
        PoolStatus status;
        address[] members;
    }

    error InvalidToken();
    error InvalidContributionAmount();
    error InvalidMaxMembers();
    error PoolNotFound();
    error PoolNotCreated();
    error PoolNotActive();
    error PoolFull();
    error AlreadyMember();
    error NotMember();
    error NotCreator();
    error NotEnoughMembers();
    error AlreadyContributed();
    error RoundNotFullyFunded();
    error PayoutAlreadyReleased();
    error PoolAlreadyFinished();

    uint256 public nextPoolId;

    mapping(uint256 => Pool) private pools;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasContributed;
    mapping(uint256 => mapping(uint256 => uint256)) public roundContributionCount;
    mapping(uint256 => mapping(uint256 => bool)) public roundPaidOut;

    event PoolCreated(
        uint256 indexed poolId,
        address indexed creator,
        address indexed token,
        uint256 contributionAmount,
        uint256 maxMembers
    );
    event MemberJoined(uint256 indexed poolId, address indexed member, uint256 memberIndex);
    event PoolStarted(uint256 indexed poolId);
    event ContributionMade(uint256 indexed poolId, uint256 indexed round, address indexed member, uint256 amount);
    event PayoutReleased(uint256 indexed poolId, uint256 indexed round, address indexed recipient, uint256 amount);
    event PoolCompleted(uint256 indexed poolId);
    event PoolCancelled(uint256 indexed poolId);

    function createPool(address token, uint256 contributionAmount, uint256 maxMembers)
        external
        returns (uint256 poolId)
    {
        if (token == address(0)) revert InvalidToken();
        if (contributionAmount == 0) revert InvalidContributionAmount();
        if (maxMembers < 2) revert InvalidMaxMembers();

        poolId = nextPoolId;
        nextPoolId++;

        Pool storage pool = pools[poolId];
        pool.creator = msg.sender;
        pool.token = token;
        pool.contributionAmount = contributionAmount;
        pool.maxMembers = maxMembers;
        pool.status = PoolStatus.Created;

        emit PoolCreated(poolId, msg.sender, token, contributionAmount, maxMembers);
    }

    function joinPool(uint256 poolId) external {
        Pool storage pool = _getExistingPool(poolId);
        if (pool.status != PoolStatus.Created) revert PoolNotCreated();
        if (pool.members.length == pool.maxMembers) revert PoolFull();
        if (isMember[poolId][msg.sender]) revert AlreadyMember();

        isMember[poolId][msg.sender] = true;
        pool.members.push(msg.sender);

        emit MemberJoined(poolId, msg.sender, pool.members.length - 1);

        if (pool.members.length == pool.maxMembers) {
            pool.status = PoolStatus.Active;
            pool.currentRound = 0;

            emit PoolStarted(poolId);
        }
    }

    function startPool(uint256 poolId) external {
        Pool storage pool = _getExistingPool(poolId);
        if (msg.sender != pool.creator) revert NotCreator();
        if (pool.status != PoolStatus.Created) revert PoolNotCreated();
        if (pool.members.length != pool.maxMembers) revert NotEnoughMembers();

        pool.status = PoolStatus.Active;
        pool.currentRound = 0;

        emit PoolStarted(poolId);
    }

    function contribute(uint256 poolId) external nonReentrant {
        Pool storage pool = _getExistingPool(poolId);
        if (pool.status != PoolStatus.Active) revert PoolNotActive();
        if (pool.currentRound >= pool.maxMembers) revert PoolAlreadyFinished();
        if (!isMember[poolId][msg.sender]) revert NotMember();
        if (hasContributed[poolId][pool.currentRound][msg.sender]) revert AlreadyContributed();

        uint256 round = pool.currentRound;
        uint256 amount = pool.contributionAmount;

        hasContributed[poolId][round][msg.sender] = true;
        roundContributionCount[poolId][round]++;

        IERC20(pool.token).safeTransferFrom(msg.sender, address(this), amount);

        emit ContributionMade(poolId, round, msg.sender, amount);

        if (roundContributionCount[poolId][round] == pool.maxMembers) {
            _releasePayout(poolId, pool);
        }
    }

    function releasePayout(uint256 poolId) external nonReentrant {
        Pool storage pool = _getExistingPool(poolId);
        _releasePayout(poolId, pool);
    }

    function cancelPool(uint256 poolId) external {
        Pool storage pool = _getExistingPool(poolId);
        if (msg.sender != pool.creator) revert NotCreator();
        if (pool.status != PoolStatus.Created) revert PoolNotCreated();

        pool.status = PoolStatus.Cancelled;

        emit PoolCancelled(poolId);
    }

    function getPool(uint256 poolId)
        external
        view
        returns (
            address creator,
            address token,
            uint256 contributionAmount,
            uint256 maxMembers,
            uint256 currentRound,
            PoolStatus status,
            uint256 memberCount
        )
    {
        Pool storage pool = _getExistingPool(poolId);
        return (
            pool.creator,
            pool.token,
            pool.contributionAmount,
            pool.maxMembers,
            pool.currentRound,
            pool.status,
            pool.members.length
        );
    }

    function getMembers(uint256 poolId) external view returns (address[] memory) {
        Pool storage pool = _getExistingPool(poolId);
        return pool.members;
    }

    function getCurrentRecipient(uint256 poolId) external view returns (address) {
        Pool storage pool = _getExistingPool(poolId);
        if (pool.status != PoolStatus.Active) revert PoolNotActive();
        if (pool.currentRound >= pool.maxMembers) revert PoolAlreadyFinished();
        return pool.members[pool.currentRound];
    }

    function getRoundPayoutAmount(uint256 poolId) external view returns (uint256) {
        Pool storage pool = _getExistingPool(poolId);
        return pool.contributionAmount * pool.maxMembers;
    }

    function getPoolCount() external view returns (uint256) {
        return nextPoolId;
    }

    function _releasePayout(uint256 poolId, Pool storage pool) private {
        if (pool.status != PoolStatus.Active) revert PoolNotActive();
        if (pool.currentRound >= pool.maxMembers) revert PoolAlreadyFinished();

        uint256 round = pool.currentRound;
        if (roundContributionCount[poolId][round] != pool.maxMembers) revert RoundNotFullyFunded();
        if (roundPaidOut[poolId][round]) revert PayoutAlreadyReleased();

        address recipient = pool.members[round];
        uint256 amount = pool.contributionAmount * pool.maxMembers;

        roundPaidOut[poolId][round] = true;
        IERC20(pool.token).safeTransfer(recipient, amount);

        emit PayoutReleased(poolId, round, recipient, amount);

        pool.currentRound++;
        if (pool.currentRound == pool.maxMembers) {
            pool.status = PoolStatus.Completed;
            emit PoolCompleted(poolId);
        }
    }

    function _getExistingPool(uint256 poolId) private view returns (Pool storage pool) {
        if (poolId >= nextPoolId) revert PoolNotFound();
        return pools[poolId];
    }
}
