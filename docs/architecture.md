# ArcLoop Architecture

ArcLoop is structured as a pnpm monorepo.

## Apps

- apps/mobile: Expo React Native mobile app
- apps/api: Hono backend API

## Packages

- packages/shared: shared constants, schemas, and types
- packages/db: Drizzle ORM schema and database helpers
- packages/web3: Arc Testnet, USDC, contract ABI, and viem helpers

## Contracts

- contracts: Foundry project for RotatingSavingsPool.sol

## High-Level Flow

1. User logs in with Google through Circle User-Controlled Wallets.
2. User creates or joins a rotating savings pool.
3. Members contribute USDC on Arc Testnet.
4. RotatingSavingsPool.sol tracks round contributions.
5. Contract releases pooled USDC to the predefined recipient for each round.
6. Backend indexes events and exposes metadata/proof APIs.
7. Mobile app displays pool state, contribution status, and payout proof.
