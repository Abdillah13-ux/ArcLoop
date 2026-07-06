# ArcLoop Mobile

Expo React Native mobile app for ArcLoop.

Phase 4A is a read-only API integration shell. It loads ArcLoop API status, contract information, pool metadata, pool details, and invite previews.

No Circle Wallets, Google login, transaction sending, paymaster flow, or on-chain mobile actions are implemented in Phase 4A.

## Local API

Start the API from the repository root with the local Postgres port:

```bash
DATABASE_URL=postgresql://arcloop:arcloop_dev_password@127.0.0.1:15432/arcloop pnpm dev:api
```

The API should listen on `http://localhost:8787`.

## Mobile Env

Set the Expo public API URL for local development:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

Android emulator networking may need this value instead:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8787
```

## Run

```bash
pnpm dev:mobile
```

## Phase 4A Screens

- Home API and contract status
- Contract reference
- Pool list
- Pool detail
- Invite preview
