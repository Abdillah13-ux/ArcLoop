import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeCompleteCallback } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { AddressText, AdvancedDetails, InfoRow, Modal, StatusBadge } from "../components/UiKit";
import {
  createMyWallet,
  createPinSetupChallenge,
  getCircleLoginConfig,
  getMyWallet
} from "../lib/api-client";
import { useCircleAuth } from "../lib/circle-auth";
import type { WalletChallengeInfo, WalletInfo } from "../types/api";

export function DashboardPage() {
  const { clearSession, session } = useCircleAuth();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [walletChallenge, setWalletChallenge] = useState<WalletChallengeInfo | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [pinSetupRequired, setPinSetupRequired] = useState(false);
  const [pinSetupStatus, setPinSetupStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!session) {
      return () => {
        isMounted = false;
      };
    }

    getMyWallet(session.userToken)
      .then((info) => {
        if (isMounted) {
          setWalletInfo(info);
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load wallet.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  const activeSession = session;

  async function executeCircleChallenge(challengeId: string) {
    const config = await getCircleLoginConfig();
    if (!config.appId) {
      throw new Error("Circle App ID is not configured.");
    }

    const sdk = new W3SSdk({
      appSettings: {
        appId: config.appId
      }
    });

    sdk.setAuthentication({
      userToken: activeSession.userToken,
      encryptionKey: activeSession.encryptionKey
    });

    return new Promise<string>((resolve, reject) => {
      const onComplete: ChallengeCompleteCallback = (sdkError, result) => {
        if (sdkError) {
          reject(new Error(sdkError.message || "Circle wallet challenge failed."));
          return;
        }

        resolve(result?.status ?? "UNKNOWN");
      };

      sdk.execute(challengeId, onComplete);
    });
  }

  async function refreshWallet() {
    const nextWallet = await getMyWallet(activeSession.userToken);
    setWalletInfo(nextWallet);
    return nextWallet;
  }

  async function handleCreateWallet() {
    setIsSubmitting(true);
    setError(null);
    setChallengeStatus(null);
    setPinSetupStatus(null);

    try {
      const response = await createMyWallet(activeSession.userToken);
      setWalletChallenge(response);
      setPinSetupRequired(false);

      if (!response.wallet.challengeId) {
        setWalletInfo({
          wallet: response.wallet.wallet,
          circle: response.circle
        });
        return;
      }

      const status = await executeCircleChallenge(response.wallet.challengeId);
      setChallengeStatus(status);
      await refreshWallet();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to create wallet.";
      if (message.toLowerCase().includes("pin")) {
        setPinSetupRequired(true);
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetupPin() {
    setIsSubmitting(true);
    setError(null);
    setPinSetupStatus("Starting PIN setup...");

    try {
      const response = await createPinSetupChallenge(activeSession.userToken);

      if (!response.pin.challengeId) {
        setPinSetupStatus("Circle did not return a PIN setup challenge.");
        return;
      }

      const status = await executeCircleChallenge(response.pin.challengeId);
      setPinSetupStatus(status);
      setPinSetupRequired(false);
      await refreshWallet();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to set up Circle PIN.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <h1>Dashboard</h1>
        <p>Manage your Circle wallet readiness and jump back into the ArcLoop pool flow.</p>
      </div>

      {isLoading ? <LoadingState message="Checking wallet state..." /> : null}
      {error ? <ErrorState title="Wallet action needs attention" message={error} /> : null}

      {walletInfo ? (
        <div className="dashboard-grid">
          <Card className="accent-card">
            <div className="card-heading">
              <h2>Wallet status</h2>
              <StatusBadge status={walletInfo.wallet.status} />
            </div>
            <p>
              {walletInfo.wallet.address
                ? "Your Circle wallet is ready for ArcLoop pool transactions."
                : "Complete the Circle wallet setup before creating or joining pools."}
            </p>
            <InfoRow label="Signed in as" value={activeSession.email ?? activeSession.userId ?? "Circle user"} />
            <InfoRow
              label="Wallet address"
              value={walletInfo.wallet.address ? <AddressText value={walletInfo.wallet.address} /> : "Not created"}
            />
            <InfoRow label="Circle config" value={walletInfo.circle.configured ? "Configured" : "Not configured"} />
            <div className="button-row">
              <button className="button secondary" disabled={isSubmitting} onClick={handleCreateWallet}>
                Create or complete wallet
              </button>
              {pinSetupRequired ? (
                <button className="button secondary" disabled={isSubmitting} onClick={handleSetupPin}>
                  Set up PIN
                </button>
              ) : null}
              <button className="button ghost" onClick={clearSession}>
                Sign out
              </button>
            </div>
            <AdvancedDetails summary="Wallet technical details">
              <InfoRow label="Wallet ID" value={walletInfo.wallet.walletId ?? "Not created"} />
              <InfoRow label="Wallet state" value={formatState(walletInfo.wallet.status)} />
            </AdvancedDetails>
          </Card>

          <Card>
            <h2>Quick actions</h2>
            <p>Use these once your wallet is ready. Each pool action opens a Circle approval challenge.</p>
            <Link className="button primary full-width" to="/pools/new">
              Create pool
            </Link>
            <Link className="button secondary full-width" to="/pools">
              View pools
            </Link>
            <Link className="button secondary full-width" to="/contracts">
              Contract details
            </Link>
          </Card>
        </div>
      ) : null}

      {walletChallenge?.wallet.challengeId || challengeStatus ? (
        <Modal title="Wallet challenge" status={challengeStatus ?? "WAITING_FOR_USER_APPROVAL"}>
          <p>{challengeStatus ?? "Waiting for Circle approval in the secure wallet prompt."}</p>
        </Modal>
      ) : null}
      {pinSetupRequired || pinSetupStatus ? (
        <Modal title="PIN setup" status={pinSetupStatus ?? "PENDING"}>
          <p>
            {pinSetupStatus ??
              "A Circle PIN is required before wallet creation. Set up the PIN, then create the wallet again."}
          </p>
        </Modal>
      ) : null}
    </div>
  );
}

function formatState(state: string) {
  return state
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
