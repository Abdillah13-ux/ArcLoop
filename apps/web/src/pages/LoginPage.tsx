import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import { SocialLoginProvider } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { AdvancedDetails } from "../components/UiKit";
import { createCircleSocialDeviceToken, getCircleLoginConfig } from "../lib/api-client";
import { useCircleAuth } from "../lib/circle-auth";
import { resolveCircleLoginRedirectUri } from "../lib/circle-redirect-uri";

type LoginCompleteCallback = NonNullable<ConstructorParameters<typeof W3SSdk>[1]>;

type CircleSdkError = {
  code?: number;
  message?: string;
  status?: number;
};

type SdkCallbackDebugInfo = {
  sdkCallbackFired: boolean;
  sdkErrorCode: number | null;
  sdkErrorMessage: string | null;
  hasUserToken: boolean;
  hasEncryptionKey: boolean;
  hasRefreshToken: boolean;
  verifyTokenTimeout: boolean;
};

function safeCircleError(error: CircleSdkError) {
  const message = error.message?.trim() || "Circle Google login failed.";
  const details = [
    typeof error.code === "number" ? `code ${error.code}` : null,
    typeof error.status === "number" ? `status ${error.status}` : null
  ].filter(Boolean);

  return details.length > 0 ? `${message} (${details.join(", ")}).` : message;
}

function readSdkCallbackDebugInfo(
  sdkError: CircleSdkError | undefined,
  result: {
    userToken?: string;
    encryptionKey?: string;
    refreshToken?: string;
  } | undefined,
  verifyTokenTimeout: boolean
): SdkCallbackDebugInfo {
  return {
    sdkCallbackFired: true,
    sdkErrorCode: typeof sdkError?.code === "number" ? sdkError.code : null,
    sdkErrorMessage: sdkError?.message ?? null,
    hasUserToken: Boolean(result?.userToken),
    hasEncryptionKey: Boolean(result?.encryptionKey),
    hasRefreshToken: Boolean(result?.refreshToken),
    verifyTokenTimeout
  };
}

function createInitialSdkCallbackDebugInfo(): SdkCallbackDebugInfo {
  return {
    sdkCallbackFired: false,
    sdkErrorCode: null,
    sdkErrorMessage: null,
    hasUserToken: false,
    hasEncryptionKey: false,
    hasRefreshToken: false,
    verifyTokenTimeout: false
  };
}

function formatSdkCallbackDebug(info: SdkCallbackDebugInfo) {
  return [
    `SDK callback fired: ${info.sdkCallbackFired ? "true" : "false"}`,
    `sdkError code: ${info.sdkErrorCode ?? "none"}`,
    `sdkError message: ${info.sdkErrorMessage ?? "none"}`,
    `has user token: ${info.hasUserToken ? "true" : "false"}`,
    `has encryption key: ${info.hasEncryptionKey ? "true" : "false"}`,
    `has refresh token: ${info.hasRefreshToken ? "true" : "false"}`,
    `verify-token timeout: ${info.verifyTokenTimeout ? "true" : "false"}`
  ].join(" | ");
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useCircleAuth();
  const sdkRef = useRef<W3SSdk | null>(null);
  const verifyTokenTimeoutRef = useRef<number | null>(null);
  const sdkCallbackFiredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Preparing Circle login...");
  const [loginRedirectUri, setLoginRedirectUri] = useState(() =>
    resolveCircleLoginRedirectUri(null)
  );
  const [sdkCallbackDebug, setSdkCallbackDebug] = useState(() =>
    formatSdkCallbackDebug(createInitialSdkCallbackDebugInfo())
  );

  useEffect(() => {
    let isMounted = true;
    sdkCallbackFiredRef.current = false;

    const onLoginComplete: LoginCompleteCallback = (sdkError, result) => {
      if (!isMounted) {
        return;
      }

      sdkCallbackFiredRef.current = true;

      if (verifyTokenTimeoutRef.current) {
        window.clearTimeout(verifyTokenTimeoutRef.current);
        verifyTokenTimeoutRef.current = null;
      }

      const nextSdkCallbackDebug = readSdkCallbackDebugInfo(sdkError, result, false);
      setSdkCallbackDebug(formatSdkCallbackDebug(nextSdkCallbackDebug));
      console.info("[Circle OAuth debug] SDK callback completion", nextSdkCallbackDebug);

      if (sdkError) {
        setError(safeCircleError(sdkError));
        return;
      }

      if (!result?.userToken || !result.encryptionKey || !result.refreshToken) {
        setError("Circle login did not return a usable user session.");
        return;
      }

      const oauthInfo = "oAuthInfo" in result ? result.oAuthInfo : undefined;

      setSession({
        mode: "circle",
        userToken: result.userToken,
        encryptionKey: result.encryptionKey,
        refreshToken: result.refreshToken,
        userId: oauthInfo?.socialUserUUID ?? null,
        email: oauthInfo?.socialUserInfo?.email ?? null,
        name: oauthInfo?.socialUserInfo?.name ?? null
      });
      setStatus("Circle login complete.");
      navigate("/dashboard");
    };

    async function prepareSdk() {
      setIsLoading(true);
      setError(null);
      setSdkCallbackDebug(formatSdkCallbackDebug(createInitialSdkCallbackDebugInfo()));
      const oauthHash = window.location.hash;
      const callbackUrlWithoutHash = window.location.href.split("#")[0];

      try {
        const config = await getCircleLoginConfig();

        if (!config.configured || !config.appId || !config.googleClientId) {
          setError(
            `Circle Google login is not configured. Missing: ${config.requiredEnvVars.join(", ")}.`
          );
          return;
        }

        if (oauthHash) {
          history.replaceState(null, "", callbackUrlWithoutHash);
        }

        const nextLoginRedirectUri = resolveCircleLoginRedirectUri(config.googleRedirectUri);
        setLoginRedirectUri(nextLoginRedirectUri);

        const sdk = new W3SSdk();

        const deviceId = await sdk.getDeviceId();
        const device = await createCircleSocialDeviceToken(deviceId);

        if (!device.deviceToken || !device.deviceEncryptionKey) {
          if (oauthHash && !window.location.hash) {
            history.replaceState(null, "", `${callbackUrlWithoutHash}${oauthHash}`);
          }

          setError("Circle did not return a social login device token for this browser session.");
          return;
        }

        if (oauthHash && !window.location.hash) {
          history.replaceState(null, "", `${callbackUrlWithoutHash}${oauthHash}`);
        }

        const hasVerifyTokenHash = window.location.hash.length > 0;

        sdk.updateConfigs(
          {
            appSettings: {
              appId: config.appId
            },
            loginConfigs: {
              google: {
                clientId: config.googleClientId,
                redirectUri: nextLoginRedirectUri,
                selectAccountPrompt: true
              },
              deviceToken: device.deviceToken,
              deviceEncryptionKey: device.deviceEncryptionKey
            }
          },
          onLoginComplete
        );

        if (hasVerifyTokenHash) {
          verifyTokenTimeoutRef.current = window.setTimeout(() => {
            if (!isMounted || sdkCallbackFiredRef.current) {
              return;
            }

            const nextSdkCallbackDebug = {
              ...createInitialSdkCallbackDebugInfo(),
              verifyTokenTimeout: true
            };
            setSdkCallbackDebug(formatSdkCallbackDebug(nextSdkCallbackDebug));
            console.info("[Circle OAuth debug] verify-token timeout", nextSdkCallbackDebug);
          }, 1000 * 11);
        }

        window.setTimeout(() => {
          if (!isMounted || sdkCallbackFiredRef.current || !hasVerifyTokenHash) {
            return;
          }

          console.info("[Circle OAuth debug] verify-token callback pending", {
            sdkCallbackFired: false,
            verifyTokenTimeout: false
          });
        }, 250);

        if (isMounted) {
          sdkRef.current = sdk;
          setIsReady(true);
          setStatus("Circle login is ready.");
        }
      } catch (caughtError) {
        if (isMounted) {
          if (oauthHash && !window.location.hash) {
            history.replaceState(null, "", `${callbackUrlWithoutHash}${oauthHash}`);
          }

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
      sdkCallbackFiredRef.current = false;

      if (verifyTokenTimeoutRef.current) {
        window.clearTimeout(verifyTokenTimeoutRef.current);
        verifyTokenTimeoutRef.current = null;
      }
    };
  }, [navigate, setSession]);

  async function handleGoogleLogin() {
    setError(null);
    setSdkCallbackDebug(formatSdkCallbackDebug(createInitialSdkCallbackDebugInfo()));

    if (!sdkRef.current) {
      setError("Circle login SDK is not ready yet.");
      return;
    }

    try {
      await sdkRef.current.performLogin(SocialLoginProvider.GOOGLE);
    } catch (caughtError) {
      if (
        caughtError &&
        typeof caughtError === "object" &&
        ("message" in caughtError || "code" in caughtError || "status" in caughtError)
      ) {
        setError(safeCircleError(caughtError as CircleSdkError));
        return;
      }

      setError("Circle Google login could not start.");
    }
  }

  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>USDC rotating savings pools on Arc.</h1>
        <p>
          Sign in with Google through Circle User-Controlled Wallets to create, join,
          approve, and contribute to transparent testnet pools.
        </p>
      </div>

      {isLoading ? <LoadingState message="Preparing Circle login..." /> : null}
      {error ? <ErrorState title="Circle login needs attention" message={error} /> : null}

      <Card className="accent-card">
        <div className="card-heading">
          <h2>Continue with Circle</h2>
          <span className="status-pill">{status}</span>
        </div>
        <p>
          Circle keeps wallet credentials user-controlled while ArcLoop coordinates the
          on-chain pool actions. No browser wallet extension is required for this demo flow.
        </p>
        <button className="button primary full-width" disabled={!isReady} onClick={handleGoogleLogin}>
          Continue with Google
        </button>
        <div className="proof-rail">
          <div className="proof-step">
            <span>01</span>
            <div>
              <strong>Google sign-in</strong>
              <small>Authenticate through Circle without exposing raw wallet credentials.</small>
            </div>
          </div>
          <div className="proof-step">
            <span>02</span>
            <div>
              <strong>User-controlled wallet</strong>
              <small>Approve create, join, USDC approval, and contribution challenges.</small>
            </div>
          </div>
          <div className="proof-step">
            <span>03</span>
            <div>
              <strong>Arc Testnet proof</strong>
              <small>Track confirmed transactions and pool state from the dashboard.</small>
            </div>
          </div>
        </div>
        <AdvancedDetails>
          <div className="notice">
            <strong>Redirect URI</strong>
            <span>{loginRedirectUri}</span>
          </div>
          <div className="notice">
            <strong>SDK callback diagnostics</strong>
            <span>{sdkCallbackDebug}</span>
          </div>
        </AdvancedDetails>
      </Card>
    </div>
  );
}
