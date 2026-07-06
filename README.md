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
- Arc Testnet
- pnpm workspace

## Status

Phase 3 database and backend API work is in progress.

The `RotatingSavingsPool` contract is deployed and verified on Arc Testnet:

- Chain ID: `5042002`
- Contract: `0xdb0177f58DC2dceB621CD47336C77d3498999a67`
- USDC token: `0x3600000000000000000000000000000000000000`
- Explorer: `https://testnet.arcscan.app`

The backend is a metadata and indexing layer only. It is not custody; funds remain in the smart contract and on-chain state is the source of truth.

## Install

```bash
pnpm install
```

Copy `.env.example` to a local `.env` only for local development. Do not commit `.env` or any file containing private keys, API keys, JWTs, or production secrets.

## Run Postgres

```bash
docker compose up -d postgres
```

The local database defaults to `postgresql://arcloop:arcloop_dev_password@127.0.0.1:15432/arcloop`.

## Database

```bash
pnpm db:generate
pnpm db:migrate
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
- `GET /contracts/rotating-savings-pool`
- `POST /pools`
- `GET /pools`
- `GET /pools/:id`
- `GET /invites/:inviteCode`
- `GET /chains/:chainId/contracts/:contractAddress/pools/:onchainPoolId`
- `POST /indexer/run-once`

Run the one-shot indexer manually:

```bash
curl -X POST http://localhost:8787/indexer/run-once \
  -H "content-type: application/json" \
  -d '{}'
```

If `INDEXER_ADMIN_TOKEN` is set, include `Authorization: Bearer <token>`.

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
