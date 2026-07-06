# ArcLoop Web

Phase 4B web MVP for the ArcLoop project submission.

This app is the public demo frontend for the current milestone. It consumes the ArcLoop API and stays read-only: no Circle Wallets, Google login, transaction signing, or private credentials are used here.

## Run The API

From the repository root:

```bash
DATABASE_URL=postgresql://arcloop:arcloop_dev_password@127.0.0.1:15432/arcloop pnpm dev:api
```

The API should be available at `http://localhost:8787`.

## Run The Web App

From the repository root:

```bash
VITE_API_BASE_URL=http://localhost:8787 pnpm dev:web
```

The Vite app runs on `http://localhost:5173`.

## Scope

- Home submission page
- Read-only contract reference
- Read-only pool list and detail pages
- Read-only invite preview
- Native mobile app planning page

The native mobile app is planned after funding. Future mobile work can add wallet flows, contribution actions, and notifications after that milestone.
