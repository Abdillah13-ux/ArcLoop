# ArcLoop Deployment

ArcLoop is prepared for a production MVP deployment on Vercel without a VPS. Docker is local-only; production uses a managed PostgreSQL database such as Neon, Supabase, or Vercel Marketplace Postgres.

## Recommended Vercel Architecture

Use one Vercel project from the repository root:

- `apps/web` builds the Vite React frontend.
- Root `api/[...route].ts` exposes the Hono API as Vercel serverless functions under same-domain `/api/*`.
- The frontend defaults to `/api` in production, so no production `VITE_API_BASE_URL` is needed for the one-project setup.

This keeps browser requests same-origin, avoids production CORS work, and uses one environment-variable set for the MVP.

Use separate Vercel projects only if the API needs independent scaling, auth policy, or a different domain. In that case set `VITE_API_BASE_URL` on the web project to the API origin and add the production web origin to API CORS before launch.

## Vercel Project Settings

- Root Directory: repository root
- Framework Preset: Vite
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm --filter @arcloop/web build`
- Output Directory: `apps/web/dist`

The checked-in `vercel.json` records these settings and preserves client-side routing while leaving `/api/*` for serverless API routes.

## Production Environment Variables

Set these on the single Vercel project for Production and Preview as appropriate:

```bash
DATABASE_URL=
CIRCLE_API_KEY=
CIRCLE_APP_ID=
CIRCLE_GOOGLE_CLIENT_ID=
CIRCLE_GOOGLE_REDIRECT_URI=
ARC_TESTNET_RPC_URL=
ARCLOOP_CONTRACT_ADDRESS=0x82AbF5102Cb744542A5EAd9786b05dEDC445FE8B
USDC_TOKEN_ADDRESS=
ARC_TESTNET_CHAIN_ID=5042002
ARC_TESTNET_EXPLORER_URL=https://testnet.arcscan.app
```

Optional production hardening:

```bash
INDEXER_ADMIN_TOKEN=
```

Do not set local-only dev executor variables in Vercel.

## Production Database Migration

After creating the managed Postgres database and setting `DATABASE_URL` locally for the target database, run:

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
```

Use the provider's pooled connection string if that is the recommended connection string for serverless clients. Do not run Docker or reset commands against production.

## Google And Circle Redirect Checklist

- Choose the final Vercel production URL or custom domain before configuring OAuth.
- Set `CIRCLE_GOOGLE_REDIRECT_URI` in Vercel to the exact production callback URL expected by the Circle web SDK flow.
- Add the same redirect URI in Google OAuth client settings.
- Add the production domain to the Google OAuth authorized JavaScript origins if required by the client.
- Confirm the Circle app uses the same `CIRCLE_APP_ID` and `CIRCLE_GOOGLE_CLIENT_ID` as the Vercel environment.
- Repeat the same setup for Vercel Preview URLs only if preview login testing is required.

## Post-Deploy Verification

After deployment and migration:

```bash
curl https://<production-domain>/api/health
curl https://<production-domain>/api/contracts/rotating-savings-pool
curl https://<production-domain>/api/pools
```

Then open the production site and verify:

- The homepage loads.
- The pool list calls same-domain `/api/pools`.
- The contract page reports Arc Testnet chain ID `5042002`.
- Circle Google login redirects back to the configured production URI.
- No Docker services are required for production.
