import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { useEffect, useRef, useState } from "react";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { createCircleSocialDeviceToken, getCircleLoginConfig } from "../lib/api-client";
import { resolveCircleLoginRedirectUri } from "../lib/circle-redirect-uri";

type LoginCompleteCallback = NonNullable<ConstructorParameters<typeof W3SSdk>[1]>;

type DebuggableW3SSdk = {
  generateOauthUrlWithParams?: (...args: unknown[]) => { url?: string } | undefined;
};

type OAuthDebugParams = {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  prompt: string;
  statePresent: boolean;
  noncePresent: boolean;
  oauthEndpointHostname: string;
};

type CallbackDebugInfo = {
  hashPresent: boolean;
  hashLength: number;
  hashKeys: string[];
  hasStoredProvider: boolean;
  storedProviderLength: number;
  hasStoredState: boolean;
  storedStateLength: number;
  hasStoredNonce: boolean;
  storedNonceLength: number;
};

type MinimalLoginResult = {
  hasUserToken: boolean;
  hasEncryptionKey: boolean;
  hasRefreshToken: boolean;
  email: string | null;
  name: string | null;
};

function maskClientId(clientId: string) {
  if (clientId.length <= 12) {
    return `${clientId.slice(0, 3)}...${clientId.slice(-3)}`;
  }

  return `${clientId.slice(0, 8)}...${clientId.slice(-8)}`;
}

function readOutboundOAuthParams(url: string): OAuthDebugParams | null {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    const clientId = params.get("client_id") ?? "";

    return {
      client_id: clientId ? maskClientId(clientId) : "missing",
      redirect_uri: params.get("redirect_uri") ?? "missing",
      response_type: params.get("response_type") ?? "missing",
      scope: params.get("scope") ?? "missing",
      prompt: params.get("prompt") ?? "missing",
      statePresent: Boolean(params.get("state")),
      noncePresent: Boolean(params.get("nonce")),
      oauthEndpointHostname: parsed.hostname
    };
  } catch {
    return null;
  }
}

function readCallbackDebugInfo(): CallbackDebugInfo {
  const rawHash = window.location.hash;
  const hashKeys = rawHash ? [...new URLSearchParams(rawHash.slice(1)).keys()] : [];
  const storedProvider = window.localStorage.getItem("socialLoginProvider") ?? "";
  const storedState = window.localStorage.getItem("state") ?? "";
  const storedNonce = window.localStorage.getItem("nonce") ?? "";

  return {
    hashPresent: rawHash.length > 0,
    hashLength: rawHash.length,
    hashKeys,
    hasStoredProvider: storedProvider.length > 0,
    storedProviderLength: storedProvider.length,
    hasStoredState: storedState.length > 0,
    storedStateLength: storedState.length,
    hasStoredNonce: storedNonce.length > 0,
    storedNonceLength: storedNonce.length
  };
}

function formatCallbackDebug(info: CallbackDebugInfo) {
  return [
    `hash present: ${info.hashPresent ? "yes" : "no"}`,
    `hash length: ${info.hashLength}`,
    `hash keys: ${info.hashKeys.length ? info.hashKeys.join(", ") : "none"}`,
    `stored provider: ${info.hasStoredProvider ? "yes" : "no"} (${info.storedProviderLength})`,
    `stored state: ${info.hasStoredState ? "yes" : "no"} (${info.storedStateLength})`,
    `stored nonce: ${info.hasStoredNonce ? "yes" : "no"} (${info.storedNonceLength})`
  ].join(" | ");
}

function formatOutboundDebug(params: OAuthDebugParams) {
  return [
    `client_id: ${params.client_id}`,
    `redirect_uri: ${params.redirect_uri}`,
    `response_type: ${params.response_type}`,
    `scope: ${params.scope}`,
    `prompt: ${params.prompt}`,
    `state present: ${params.statePresent ? "yes" : "no"}`,
    `nonce present: ${params.noncePresent ? "yes" : "no"}`,
    `oauth endpoint hostname: ${params.oauthEndpointHostname}`
  ].join(" | ");
}

export function CircleLoginMinimalPage() {
  const sdkRef = useRef<W3SSdk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState("Preparing minimal Circle login...");
  const [minimalRedirectUri, setMinimalRedirectUri] = useState(() =>
    resolveCircleLoginRedirectUri(null)
  );
  const [callbackDebug, setCallbackDebug] = useState(() => formatCallbackDebug(readCallbackDebugInfo()));
  const [outboundDebug, setOutboundDebug] = useState<string | null>(null);
  const [loginResult, setLoginResult] = useState<MinimalLoginResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    const onLoginComplete: LoginCompleteCallback = (sdkError, result) => {
      if (!isMounted) {
        return;
      }

      setCallbackDebug(formatCallbackDebug(readCallbackDebugInfo()));

      if (sdkError) {
        setError(sdkError.message || "Circle Google login failed.");
        return;
      }

      const oauthInfo = result && "oAuthInfo" in result ? result.oAuthInfo : undefined;

      setLoginResult({
        hasUserToken: Boolean(result?.userToken),
        hasEncryptionKey: Boolean(result?.encryptionKey),
        hasRefreshToken: Boolean(result?.refreshToken),
        email: oauthInfo?.socialUserInfo?.email ?? null,
        name: oauthInfo?.socialUserInfo?.name ?? null
      });
      setStatus("Circle SDK login callback completed.");
    };

    async function prepareSdk() {
      setIsLoading(true);
      setError(null);
      setCallbackDebug(formatCallbackDebug(readCallbackDebugInfo()));

      try {
        const config = await getCircleLoginConfig();

        if (!config.configured || !config.appId || !config.googleClientId) {
          setError(
            `Circle Google login is not configured. Missing: ${config.requiredEnvVars.join(", ")}.`
          );
          return;
        }

        const sdk = new W3SSdk(
          {
            appSettings: {
              appId: config.appId
            }
          },
          onLoginComplete
        );

        const debugSdk = sdk as unknown as DebuggableW3SSdk;
        const originalGenerateOauthUrlWithParams = debugSdk.generateOauthUrlWithParams?.bind(sdk);

        if (originalGenerateOauthUrlWithParams) {
          debugSdk.generateOauthUrlWithParams = (...args: unknown[]) => {
            const oauth = originalGenerateOauthUrlWithParams(...args);
            if (typeof oauth?.url === "string") {
              const outboundParams = readOutboundOAuthParams(oauth.url);
              if (outboundParams) {
                setOutboundDebug(formatOutboundDebug(outboundParams));
                console.info("[Circle minimal OAuth debug] outbound Google params", outboundParams);
              }
            }

            return oauth;
          };
        }

        const deviceId = await sdk.getDeviceId();
        const device = await createCircleSocialDeviceToken(deviceId);
        const nextMinimalRedirectUri = resolveCircleLoginRedirectUri(config.googleRedirectUri);
        setMinimalRedirectUri(nextMinimalRedirectUri);

        if (!device.deviceToken || !device.deviceEncryptionKey) {
          setError("Circle did not return a social login device token for this browser session.");
          return;
        }

        sdk.updateConfigs(
          {
            appSettings: {
              appId: config.appId
            },
            loginConfigs: {
              google: {
                clientId: config.googleClientId,
                redirectUri: nextMinimalRedirectUri,
                selectAccountPrompt: true
              },
              deviceToken: device.deviceToken,
              deviceEncryptionKey: device.deviceEncryptionKey
            }
          },
          onLoginComplete
        );

        if (isMounted) {
          sdkRef.current = sdk;
          setIsReady(true);
          setStatus("Minimal Circle login is ready.");
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to prepare Circle login.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    prepareSdk();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleGoogleLogin() {
    setError(null);
    setLoginResult(null);
    setCallbackDebug(formatCallbackDebug(readCallbackDebugInfo()));

    if (!sdkRef.current) {
      setError("Circle login SDK is not ready yet.");
      return;
    }

    try {
      await sdkRef.current.performLogin(SocialLoginProvider.GOOGLE);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Circle Google login could not start.");
    }
  }

  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Minimal Circle Login</h1>
        <p>Standalone Google social-login repro using only the Circle Web SDK callback flow.</p>
      </div>

      {isLoading ? <LoadingState message="Preparing minimal Circle login..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="notice">
        <strong>Status</strong>
        <span>{status}</span>
      </div>

      <div className="notice">
        <strong>Redirect URI</strong>
        <span>{minimalRedirectUri}</span>
      </div>

      <div className="notice">
        <strong>Callback debug</strong>
        <span>{callbackDebug}</span>
      </div>

      {outboundDebug ? (
        <div className="notice">
          <strong>Outbound OAuth debug</strong>
          <span>{outboundDebug}</span>
        </div>
      ) : null}

      {loginResult ? (
        <Card>
          <div className="detail-row">
            <span>Has user token</span>
            <strong>{loginResult.hasUserToken ? "true" : "false"}</strong>
          </div>
          <div className="detail-row">
            <span>Has encryption key</span>
            <strong>{loginResult.hasEncryptionKey ? "true" : "false"}</strong>
          </div>
          <div className="detail-row">
            <span>Has refresh token</span>
            <strong>{loginResult.hasRefreshToken ? "true" : "false"}</strong>
          </div>
          <div className="detail-row">
            <span>Email</span>
            <strong>{loginResult.email ?? "Not returned"}</strong>
          </div>
          <div className="detail-row">
            <span>Name</span>
            <strong>{loginResult.name ?? "Not returned"}</strong>
          </div>
        </Card>
      ) : null}

      <Card>
        <button className="button primary" disabled={!isReady} onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </Card>
    </div>
  );
}
