# ArcLoop Development Phases

Phase 0 — Product Definition & Grant Positioning
Define product scope, user roles, pool lifecycle, risk boundaries, and grant narrative.

Phase 1 — Repository Bootstrap
Create pnpm monorepo structure for mobile app, API, shared packages, web3 package, database package, contracts, and docs.

Phase 2 — Smart Contract Development
Implement RotatingSavingsPool.sol using Foundry: create pool, join pool, start pool, contribute USDC, release payout, and cancel pool before start.

Phase 3 — Database & Backend API
Implement Hono API, PostgreSQL schema, Drizzle ORM, metadata APIs, invite codes, event indexer, and proof data.

Phase 4 — Circle Wallet Integration
Integrate Circle User-Controlled Wallets with Google login for mobile onboarding.

Phase 5 — Mobile App MVP
Build Expo React Native screens for login, home, create pool, join pool, pool detail, contribution, and payout proof.

Phase 6 — USDC & Arc Testnet Integration
Configure Arc Testnet, USDC token, contract address, viem clients, allowance helpers, contribution helpers, payout helpers, and explorer links.

Phase 7 — Optional Admin/Demo Web
Optional lightweight web dashboard or public proof page.

Phase 8 — QA, Security, and Edge Cases
Test smart contract, API, indexer, mobile flow, transaction states, and demo data.

Phase 9 — Demo Video & Grant Assets
Prepare demo video, GitHub repo, contract address, explorer link, docs, and submission assets.

Phase 10 — Post-MVP Enhancements
Optional notifications, paymaster integration, member reputation, flexible payout order, admin analytics, and AI assistant.
