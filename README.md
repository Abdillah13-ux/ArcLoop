# ArcLoop

ArcLoop is a mobile-first rotating USDC savings pool on Arc.

Members contribute a fixed USDC amount each round, and the smart contract releases the pooled payout to members in a predefined order.

## Positioning

ArcLoop is not a generic e-wallet, remittance app, lottery, gambling product, yield product, or AI-agent payment app.

It is a transparent rotating savings pool using USDC and Arc smart contracts.

## Stack

- Expo React Native + TypeScript
- Node.js + Hono
- PostgreSQL + Drizzle ORM
- viem
- Foundry
- Circle User-Controlled Wallets + Google login
- Arc Testnet
- pnpm workspace

## Status

Phase 1 repository bootstrap. The monorepo is installable and has minimal runnable/typecheckable placeholders for the API, mobile app, shared types, database package, web3 package, and Foundry workspace.

Smart contract implementation, Circle User-Controlled Wallets, Google login, Arc Testnet transactions, pool screens, indexing, and database schema work are future phases.

## Install

```bash
pnpm install
```

## Run The API

```bash
pnpm dev:api
```

The API listens on `API_PORT` from the environment, with a fallback of `8787`.

Available bootstrap routes:

- `GET /health`
- `GET /version`
- `GET /chains/arc-testnet`

## Run The Mobile App

```bash
pnpm dev:mobile
```

This starts Expo for the minimal ArcLoop home screen.

## Verification

```bash
pnpm typecheck
pnpm build
```

Foundry commands are wired at the root for later contract work:

```bash
pnpm contracts:build
pnpm contracts:test
```
