# ArcLoop API

Hono backend for ArcLoop Phase 3.

Responsibilities:
- pool metadata
- invite codes
- contract event indexing
- proof page data
- Arc Testnet integration support

The API is a metadata and indexing layer only. It does not custody funds; Arc Testnet contract state remains the source of truth.

## Local Setup

From the repository root:

```bash
pnpm install
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate
pnpm dev:api
```

Do not commit `.env`. Use `.env.example` for public/local defaults only.

## Deployed Contract

- Chain ID: `5042002`
- RotatingSavingsPool: `0x82AbF5102Cb744542A5EAd9786b05dEDC445FE8B`
- USDC: `0x3600000000000000000000000000000000000000`
- Explorer: `https://testnet.arcscan.app`

## Routes

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

`POST /pools` stores off-chain metadata only after `getPool(onchainPoolId)` succeeds on-chain.

`POST /indexer/run-once` scans contract logs once and applies idempotent database updates. If `INDEXER_ADMIN_TOKEN` is configured, send `Authorization: Bearer <token>`.
