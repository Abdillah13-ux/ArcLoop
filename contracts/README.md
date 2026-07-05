# ArcLoop Contracts

Foundry contracts for ArcLoop, a mobile-first rotating USDC savings pool on Arc.

## Contract Purpose

`RotatingSavingsPool.sol` coordinates fixed-token rotating savings pools. Members join in deterministic order, contribute the same amount each round, and the pooled payout is released to the member at the current round index.

The contract does not hardcode USDC or any production token address. Each pool stores the ERC-20 token address supplied at creation time. Frontend and backend allowlists can be added in later phases.

## MVP Lifecycle

1. A creator creates a pool with a token, fixed contribution amount, and member limit.
2. Members explicitly join while the pool is `Created`.
3. The creator starts the pool after exactly `maxMembers` have joined.
4. Every member contributes once per active round.
5. Anyone can release the funded round payout to the current recipient.
6. The recipient order follows join order.
7. The pool is `Completed` after every member has received one payout.

Created pools can be cancelled before start. There is no refund path in the MVP because contributions are only accepted after start.

## Test

```bash
forge build
forge test
```

If `forge` is not on your `PATH`, use the local Foundry binary path for your machine.

## Manual Deploy Later

`script/DeployRotatingSavingsPool.s.sol` is a placeholder for a later manual deploy phase. It reads `PRIVATE_KEY` from `contracts/.env` through Foundry cheatcodes and deploys only `RotatingSavingsPool`.

Do not commit `contracts/.env`. Keep RPC URLs, explorer API keys, private keys, and deployed addresses out of source control.

## Arc Testnet Deployment

RotatingSavingsPool has been deployed and verified on Arc Testnet.

- Chain ID: `5042002`
- Contract address: `0xdb0177f58DC2dceB621CD47336C77d3498999a67`
- Deployment transaction: `0x5625d1c965048ea0df91509ad20f70cdb5d41d0f1f7f29eed4321eb0a3a75f99`
- Explorer: `https://testnet.arcscan.app/address/0xdb0177f58DC2dceB621CD47336C77d3498999a67`

The deployer private key, RPC settings, and explorer API key are stored only in local `contracts/.env` and must not be committed.
