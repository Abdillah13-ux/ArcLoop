# ArcLoop DB

Drizzle package for ArcLoop.

It contains the PostgreSQL schema and lazy database client used by the API metadata and indexer layer. Funds remain in the smart contract; database rows mirror public on-chain state plus off-chain metadata such as titles and invite codes.

## Local Postgres

From the repository root:

```bash
docker compose up -d postgres
```

Local defaults:

- Database: `arcloop`
- User: `arcloop`
- Host port: `5432`

Do not commit `.env`.

## Drizzle

```bash
pnpm db:generate
pnpm db:migrate
```

Schema entrypoint: `packages/db/src/schema/index.ts`.

Migrations output: `packages/db/src/migrations`.
