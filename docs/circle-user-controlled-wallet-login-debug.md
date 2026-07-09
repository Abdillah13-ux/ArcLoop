# Circle User-Controlled Wallet Google Login Debug

Date: 2026-07-07

## Scope

This audit checks ArcLoop's Circle User-Controlled Wallet Google login path against Circle's official docs and the installed local SDK source.

The current blocker is:

- Google account chooser opens.
- After account selection, the browser returns to `http://localhost:5173/login`.
- The return URL has no OAuth fragment.
- Because `window.location.hash` is empty, `@circle-fin/w3s-pw-web-sdk@1.1.11` cannot produce a Circle `userToken`, `encryptionKey`, or `refreshToken`.

No transaction path is treated as complete until login returns those session values.

## Official Circle Sources Consulted

- `https://developers.circle.com/llms.txt`
- `https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md`
- `https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/references/create-wallet-social-login.md`
- `https://developers.circle.com/wallets/user-controlled`
- `https://developers.circle.com/wallets/user-controlled/authentication-methods`
- `https://developers.circle.com/wallets/user-controlled/build-a-wallet-app`
- `https://developers.circle.com/api-reference/wallets/user-controlled-wallets/create-device-token-social-login`
- `https://developers.circle.com/api-reference/wallets/user-controlled-wallets/create-user-wallet`
- `https://developers.circle.com/wallets/user-controlled/transfer-tokens`
- `https://github.com/circlefin/w3s-pw-web-sdk`

## ArcLoop Implementation Summary

Login page:

- Creates a `W3SSdk` instance with `appSettings.appId`.
- Calls `sdk.getDeviceId()`.
- Sends the device ID to the backend.
- Backend calls Circle's social-login device token flow and returns `deviceToken` plus `deviceEncryptionKey`.
- Calls `sdk.updateConfigs(...)` with:
  - `appSettings.appId`
  - `loginConfigs.deviceToken`
  - `loginConfigs.deviceEncryptionKey`
  - `loginConfigs.google.clientId`
  - `loginConfigs.google.redirectUri`
  - `loginConfigs.google.selectAccountPrompt`
- Enables the Google login button only after the SDK and device token are ready.
- Calls `sdk.performLogin(SocialLoginProvider.GOOGLE)`.
- Stores successful Circle login session values in React memory only.

Backend:

- Keeps the Circle API key server-side.
- Exposes a safe `/wallets/circle/config` endpoint for app ID, Google client ID, redirect URI, and readiness booleans.
- Exposes `/wallets/circle/social-device-token` to exchange a browser device ID for a Circle social-login device token.
- Uses the session `userToken` only after login for wallet lookup and challenge creation.

## SDK Source Findings

Local `@circle-fin/w3s-pw-web-sdk@1.1.11` confirms:

- `performLogin(GOOGLE)` calls `performGoogleLogin()`.
- `performGoogleLogin()` generates a direct Google OAuth URL.
- The generated Google URL uses `response_type=id_token token`.
- The SDK stores the social provider, state, and nonce in local storage.
- `updateConfigs(...)` calls `execSocialLoginStatusCheck()`.
- `execSocialLoginStatusCheck()` only handles a social-login callback when `window.location.hash` is syntactically valid.
- For Google, the SDK validates stored state and nonce, extracts the ID token, and then verifies it with Circle.

Therefore, if the browser returns to `/login` without a fragment, the SDK has no callback material to process.

## Observed Safe OAuth Parameters

The generated outbound Google OAuth parameters are safe and expected:

- `oauthEndpointHostname`: `accounts.google.com`
- `redirect_uri`: `http://localhost:5173/login`
- `response_type`: `id_token token`
- `scope`: `openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email`
- `prompt`: `select_account`
- `statePresent`: `true`
- `noncePresent`: `true`
- `client_id`: present and masked in diagnostics

These match the SDK source and the expected Google implicit/OIDC style response for this Circle SDK version.

## Comparison Against Circle Docs

### 1. SDK initialization

Docs require the frontend Web SDK with app ID and login configuration. ArcLoop does this.

The Vite app includes `vite-plugin-node-polyfills`, which Circle's skill calls out as required for the Web SDK.

### 2. Social login flow

Docs describe:

1. Web SDK gets a device ID.
2. Backend creates a social-login device token.
3. Frontend starts Google login through the SDK.
4. Circle validates the OAuth result and invokes the SDK callback with session values.

ArcLoop follows this sequence.

### 3. Device token creation

Circle's API reference models `idempotencyKey` as required for the raw social-login token API. The installed Node SDK's public `createDeviceTokenForSocialLogin` wrapper accepts `deviceId` as its documented input example.

ArcLoop currently uses the SDK wrapper shape, not the raw API shape. This is worth monitoring, but it is not a confirmed cause of the missing Google URL fragment because the current app reaches Google and has a device token before launching login.

### 4. Callback and session handling

ArcLoop removed earlier app-side URL hash clearing before `sdk.updateConfigs(...)`, so the app no longer clears a valid callback fragment before the SDK can process it.

ArcLoop stores successful session values in React state. Circle's skill recommends cookies for social login persistence across redirects and production hardening. In this current failure, the session values never exist because the hash never returns, so storage choice is not the cause of the missing fragment.

### 5. Callback URL or domain beyond Google redirect URI

The consulted docs require:

- Google OAuth credentials with an authorized redirect URI.
- Circle Console social login configuration with the Google client ID.
- Circle App ID from the User-Controlled Wallets configurator.

No separate Circle-hosted callback URL requirement was found in the consulted docs for this Web SDK direct-Google social-login path.

### 6. Circle Console localhost/callback whitelist

The Circle skill says social login requires OAuth client ID configuration in Circle Console under User Controlled Wallets -> Configurator -> Authentication Methods -> Social Logins.

The docs reviewed did not expose a separate localhost callback whitelist field beyond the Google client ID and app ID configuration. If Circle Console has environment-specific app/domain restrictions not shown in the public docs, that remains an external-console verification item.

### 7. SDK version constraints

The installed Web SDK is `@circle-fin/w3s-pw-web-sdk@1.1.11`, which is the latest GitHub release listed in the public repo page at the time of audit. Public issue search did not reveal a known "Google returns without hash" issue.

The SDK's social-login behavior is direct Google OAuth, not a Circle-hosted auth redirect wrapper.

### 8. Different SDK method or config shape

No official doc or local type surface points to a different Web SDK method for Google social login.

ArcLoop's config shape matches the local `LoginConfigs` type:

- `loginConfigs.google.clientId`
- `loginConfigs.google.redirectUri`
- `loginConfigs.google.selectAccountPrompt`
- `loginConfigs.deviceToken`
- `loginConfigs.deviceEncryptionKey`

### 9. Circle-hosted auth vs direct Google OAuth

For this Web SDK version and social-login method, the SDK itself builds and navigates to Google's OAuth endpoint directly. The frontend should continue using `performLogin(SocialLoginProvider.GOOGLE)` rather than inventing a separate Circle-hosted auth flow.

### 10. Transactions

Do not proceed to transaction execution until login returns usable Circle session values. ArcLoop's post-login transaction pages remain out of scope for this blocker.

## Diagnosis

No confirmed ArcLoop code mismatch was found that explains Google returning to `/login` without a URL fragment.

The most likely remaining causes are external to the ArcLoop frontend code:

1. Google OAuth client configuration is not actually the exact web client used by the outbound `client_id`.
2. Google authorized redirect URI or JavaScript origin is saved in a different OAuth client than the one configured in Circle Console / ArcLoop.
3. Circle Console social-login configuration is using a different Google client ID than ArcLoop's runtime config.
4. Circle Console app/configurator environment does not match the API key/app ID being used by the backend.
5. A Google OAuth policy, consent screen, or client-type issue is causing Google to redirect without the implicit-flow fragment even though the outbound URL requests it.

Blocker classification: unknown external OAuth provider or Circle Console configuration, with Google/Circle client-ID mismatch the leading hypothesis.

## Next Verification Steps

1. Compare the masked outbound `client_id` from the debug panel with the exact Google OAuth Web Client ID configured in Circle Console and ArcLoop runtime config. Do not paste the full value in logs or chat.
2. In Google Console, verify that the matching OAuth client type is "Web application".
3. In the same Google OAuth client, verify:
   - Authorized JavaScript origins includes exactly `http://localhost:5173`.
   - Authorized redirect URIs includes exactly `http://localhost:5173/login`.
4. In Circle Console, verify the same Google client ID is saved under User-Controlled Wallets social login settings for the same app ID returned by ArcLoop runtime config.
5. In Circle Console, verify the app/configurator belongs to the same project/environment as the API key used by the backend.
6. Retry login in a clean browser profile or incognito window after clearing the SDK's local storage keys for social login provider/state/nonce.
7. If Google still returns without a fragment, capture a HAR/network trace with token values redacted and send the Circle request ID / Google OAuth client metadata to Circle support.

