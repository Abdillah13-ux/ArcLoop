import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeCompleteCallback, SignTransactionResult } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import {
  AddressText,
  ExplorerLink,
  formatStateLabel,
  InfoRow,
  Modal,
  TxStatusPanel
} from "../components/UiKit";
import { ApiRequestError, createPoolTransaction, finalizePoolTransaction, getCircleLoginConfig } from "../lib/api-client";
import { readCircleAuthSession, useCircleAuth } from "../lib/circle-auth";
import type { AuthSession } from "../lib/circle-auth";
import type { CreatePoolTransactionResult, FinalizePoolTransactionResult } from "../types/api";

type PoolTransactionFlowStatus =
  | "CHALLENGE_CREATED"
  | "WAITING_FOR_USER_APPROVAL"
  | "CHALLENGE_COMPLETE"
  | "TRANSACTION_SUBMITTED"
  | "TRANSACTION_CONFIRMED"
  | "TRANSACTION_FAILED"
  | "TRANSACTION_TIMEOUT";

const poolFinalizationTimeoutMs = 75_000;
const sessionExpiredTitle = "Session expired";
const sessionExpiredMessage = "Your wallet session needs to be refreshed before creating an on-chain pool.";
const safeErrorKeys = ["message", "code", "error", "errorCode", "reason", "status", "name"] as const;

type SafeErrorInfo = {
  codes: string[];
  messages: string[];
  names: string[];
  statuses: number[];
  text: string;
};

class PoolFinalizationTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for Circle transaction status.");
    this.name = "PoolFinalizationTimeoutError";
  }
}

function getObjectKeys(value: unknown) {
  return value && typeof value === "object" ? Object.keys(value).sort() : [];
}

function getSdkTransactionHash(challengeResult: unknown) {
  const transactionResult = challengeResult as SignTransactionResult | undefined;
  return transactionResult?.data?.txHash ?? null;
}

function readLatestCircleSession(fallbackSession: AuthSession) {
  return readCircleAuthSession() ?? fallbackSession;
}

function getSessionDebugInfo(session: AuthSession) {
  return {
    hasUserToken: Boolean(session.userToken),
    hasEncryptionKey: Boolean(session.encryptionKey),
    userTokenLength: session.userToken.length,
    encryptionKeyLength: session.encryptionKey.length,
    sessionUpdatedAt: session.sessionUpdatedAt ?? null
  };
}

function readSafeErrorInfo(error: unknown, depth = 0, seen = new Set<unknown>()): SafeErrorInfo {
  const info: SafeErrorInfo = {
    codes: [],
    messages: [],
    names: [],
    statuses: [],
    text: ""
  };

  if (error === null || error === undefined || depth > 3 || seen.has(error)) {
    return info;
  }

  if (typeof error === "string" || typeof error === "number" || typeof error === "boolean") {
    info.text = String(error);
    info.messages.push(info.text);
    return info;
  }

  if (error instanceof Error) {
    info.text = String(error);
    info.messages.push(error.message);
    info.names.push(error.name);
  } else {
    info.text = String(error);
  }

  if (typeof error !== "object") {
    return info;
  }

  seen.add(error);
  const record = error as Record<string, unknown>;

  for (const key of safeErrorKeys) {
    const value = record[key];

    if (typeof value === "string" || typeof value === "number") {
      const stringValue = String(value);
      if (key === "status" && typeof value === "number") {
        info.statuses.push(value);
      } else if (key === "code" || key === "errorCode") {
        info.codes.push(stringValue);
      } else if (key === "name") {
        info.names.push(stringValue);
      } else {
        info.messages.push(stringValue);
      }
    }
  }

  if (error instanceof ApiRequestError) {
    info.statuses.push(error.status);
  }

  for (const nestedKey of ["cause", "error", "networkError", "graphQLErrors", "errors"]) {
    const nestedValue = record[nestedKey];
    const nestedValues = Array.isArray(nestedValue) ? nestedValue : [nestedValue];

    for (const value of nestedValues) {
      const nested = readSafeErrorInfo(value, depth + 1, seen);
      info.codes.push(...nested.codes);
      info.messages.push(...nested.messages);
      info.names.push(...nested.names);
      info.statuses.push(...nested.statuses);
      if (nested.text) {
        info.text = `${info.text} ${nested.text}`.trim();
      }
    }
  }

  return info;
}

function isSessionExpiredError(error: unknown) {
  const safeError = readSafeErrorInfo(error);
  const haystack = [
    safeError.text,
    ...safeError.messages,
    ...safeError.codes,
    ...safeError.names
  ].join(" ").toLowerCase();

  return (
    safeError.statuses.includes(401) ||
    safeError.statuses.includes(403) ||
    haystack.includes("invalid credentials") ||
    haystack.includes("app10error") ||
    haystack.includes("unauthorized") ||
    haystack.includes("session expired") ||
    haystack.includes("invalid user token") ||
    haystack.includes("user token")
  );
}

async function withPoolFinalizationTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new PoolFinalizationTimeoutError());
    }, poolFinalizationTimeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function CreatePoolPage() {
  const navigate = useNavigate();
  const { clearSession, session, setSession } = useCircleAuth();
  const [title, setTitle] = useState("ArcLoop Genesis Pool");
  const [description, setDescription] = useState(
    "A transparent USDC rotating savings pool on Arc Testnet for the demo flow."
  );
  const [contributionAmount, setContributionAmount] = useState("5");
  const [maxMembers, setMaxMembers] = useState(2);
  const [result, setResult] = useState<CreatePoolTransactionResult | null>(null);
  const [finalizedResult, setFinalizedResult] = useState<FinalizePoolTransactionResult | null>(null);
  const [flowStatus, setFlowStatus] = useState<PoolTransactionFlowStatus | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [executedTxHash, setExecutedTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  const activeSession = session;

  function clearTransientState() {
    setError(null);
    setIsSessionExpired(false);
    setResult(null);
    setFinalizedResult(null);
    setFlowStatus(null);
    setChallengeStatus(null);
    setExecutedTxHash(null);
    setIsFinalizing(false);
  }

  function handleSessionRefresh() {
    clearSession();
    clearTransientState();
    navigate("/login");
  }

  function showSessionExpiredState() {
    setIsSessionExpired(true);
    setError(sessionExpiredMessage);
    setResult(null);
    setFinalizedResult(null);
    setFlowStatus(null);
    setChallengeStatus(null);
    setExecutedTxHash(null);
    setIsFinalizing(false);
  }

  function showPreSubmissionFailure(message: string) {
    setError(message);
    setResult(null);
    setFinalizedResult(null);
    setFlowStatus(null);
    setChallengeStatus(null);
    setExecutedTxHash(null);
    setIsFinalizing(false);
  }

  function loadUpdatedSessionAfterCredentialError(usedSession: AuthSession) {
    const latestSession = readCircleAuthSession();

    if (
      latestSession &&
      (latestSession.userToken !== usedSession.userToken ||
        latestSession.encryptionKey !== usedSession.encryptionKey)
    ) {
      setSession(latestSession);
      setFlowStatus("TRANSACTION_FAILED");
      setError("Your refreshed Circle session was loaded. Try creating the pool again.");
      setResult(null);
      setFinalizedResult(null);
      setChallengeStatus(null);
      setExecutedTxHash(null);
      setIsFinalizing(false);
      console.info("[Circle transaction debug] createPool session reloaded", getSessionDebugInfo(latestSession));
      return true;
    }

    return false;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    clearTransientState();

    try {
      const trimmedTitle = title.trim();
      const trimmedContributionAmount = contributionAmount.trim();

      if (!trimmedTitle) {
        throw new Error("Add a pool title.");
      }

      if (!/^\d+(\.\d{1,6})?$/.test(trimmedContributionAmount) || Number(trimmedContributionAmount) <= 0) {
        throw new Error("Enter a positive USDC amount.");
      }

      if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 100) {
        throw new Error("Choose 2 to 100 members.");
      }

      const input = {
        title: trimmedTitle,
        description: description.trim() || undefined,
        contributionAmount: trimmedContributionAmount,
        maxMembers
      };
      const transactionSession = readLatestCircleSession(activeSession);

      console.info("[Circle transaction debug] createPool session", getSessionDebugInfo(transactionSession));

      const response = await createPoolTransaction({
        ...input
      }, transactionSession.userToken);
      setResult(response);

      if (!response.transaction.challengeId) {
        return;
      }
      const challengeId = response.transaction.challengeId;

      setFlowStatus("CHALLENGE_CREATED");
      const config = await getCircleLoginConfig();
      if (!config.appId) {
        setError("Circle App ID is not configured.");
        return;
      }

      const sdk = new W3SSdk({
        appSettings: {
          appId: config.appId
        }
      });
      sdk.setAuthentication({
        userToken: transactionSession.userToken,
        encryptionKey: transactionSession.encryptionKey
      });

      setFlowStatus("WAITING_FOR_USER_APPROVAL");
      const onComplete: ChallengeCompleteCallback = async (sdkError, challengeResult) => {
        const sdkTransactionHash = getSdkTransactionHash(challengeResult);
        console.info("[Circle transaction debug] createPool SDK callback", {
          challengeIdLength: challengeId.length,
          callbackFired: true,
          callbackStatus: challengeResult?.status ?? null,
          callbackType: challengeResult?.type ?? null,
          resultKeys: getObjectKeys(challengeResult),
          dataKeys: getObjectKeys((challengeResult as SignTransactionResult | undefined)?.data),
          hasTxHash: Boolean(sdkTransactionHash),
          txHashLength: sdkTransactionHash?.length ?? null,
          circleErrorCode: sdkError?.code ?? null,
          circleErrorMessagePresent: Boolean(sdkError?.message)
        });

        if (sdkError) {
          if (isSessionExpiredError(sdkError)) {
            if (loadUpdatedSessionAfterCredentialError(transactionSession)) {
              return;
            }

            showSessionExpiredState();
            return;
          }

          setFlowStatus("TRANSACTION_FAILED");
          setError(sdkError.message || "Circle transaction challenge failed.");
          return;
        }

        if (!challengeResult?.status && getObjectKeys(challengeResult).length === 0) {
          showSessionExpiredState();
          return;
        }

        setChallengeStatus(challengeResult?.status ?? "UNKNOWN");
        setExecutedTxHash(sdkTransactionHash);

        if (challengeResult?.status !== "COMPLETE") {
          setFlowStatus("TRANSACTION_FAILED");
          setError(`Circle transaction challenge ${formatStateLabel(challengeResult?.status ?? "UNKNOWN")}.`);
          return;
        }

        setFlowStatus("CHALLENGE_COMPLETE");
        setIsFinalizing(true);

        try {
          const finalized = await withPoolFinalizationTimeout(
            finalizePoolTransaction(
              {
                challengeId,
                title: input.title,
                description: input.description
              },
              transactionSession.userToken
            )
          );
          setFinalizedResult(finalized);

          if (finalized.transaction.status === "TRANSACTION_CONFIRMED") {
            setFlowStatus("TRANSACTION_CONFIRMED");
          } else if (finalized.transaction.status === "TRANSACTION_FAILED") {
            setFlowStatus("TRANSACTION_FAILED");
          } else if (finalized.transaction.transactionHash) {
            setFlowStatus("TRANSACTION_SUBMITTED");
          } else {
            setFlowStatus("TRANSACTION_TIMEOUT");
          }
        } catch (caughtError) {
          if (isSessionExpiredError(caughtError)) {
            if (loadUpdatedSessionAfterCredentialError(transactionSession)) {
              return;
            }

            showSessionExpiredState();
            return;
          }

          setFlowStatus(
            caughtError instanceof PoolFinalizationTimeoutError
              ? "TRANSACTION_TIMEOUT"
              : "TRANSACTION_FAILED"
          );
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to finalize pool transaction."
          );
        } finally {
          setIsFinalizing(false);
        }
      };

      sdk.execute(response.transaction.challengeId, onComplete);
    } catch (caughtError) {
      if (isSessionExpiredError(caughtError)) {
        const latestSession = readCircleAuthSession();

        if (
          latestSession &&
          (latestSession.userToken !== activeSession.userToken ||
            latestSession.encryptionKey !== activeSession.encryptionKey)
        ) {
          setSession(latestSession);
          showPreSubmissionFailure("Your refreshed Circle session was loaded. Try creating the pool again.");
          console.info("[Circle transaction debug] createPool session reloaded", getSessionDebugInfo(latestSession));
          return;
        }

        showSessionExpiredState();
      } else {
        showPreSubmissionFailure(
          caughtError instanceof Error ? caughtError.message : "Unable to create pool transaction."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const transactionHash =
    finalizedResult?.transaction.transactionHash ?? executedTxHash ?? result?.transaction.transactionHash;
  const transactionId =
    finalizedResult?.transaction.transactionId ?? result?.transaction.transactionId ?? "Not submitted";
  const displayStatus =
    flowStatus ??
    finalizedResult?.transaction.status ??
    challengeStatus ??
    result?.transaction.status;
  const transactionMessage =
    finalizedResult?.transaction.message ??
    (displayStatus === "CHALLENGE_COMPLETE"
      ? "Wallet confirmation complete. Waiting for Arc Testnet confirmation..."
      : isFinalizing
      ? "Wallet approval is complete. ArcLoop is waiting for Circle to expose the submitted transaction."
      : result?.transaction.message);
  const explorerLink =
    transactionHash && result
      ? `${result.request.explorerUrl.replace(/\/$/, "")}/tx/${transactionHash}`
      : null;
  const hasStartedTransaction = Boolean(
    !isSessionExpired && ((result && result.transaction.challengeId) || finalizedResult || transactionHash)
  );

  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Create pool</h1>
        <p>
          Set the pool terms, preview the contribution model, then approve one on-chain
          contract transaction through your Circle wallet.
        </p>
      </div>

      <div className="split-grid create-pool-grid">
        <Card>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Pool title</span>
              <input
                maxLength={120}
                required
                value={title}
                onChange={(event) => {
                  clearTransientState();
                  setTitle(event.target.value);
                }}
              />
              <small>Use a short name people can recognize in the pool list.</small>
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                maxLength={1000}
                rows={6}
                value={description}
                onChange={(event) => {
                  clearTransientState();
                  setDescription(event.target.value);
                }}
              />
              <small>Explain the group, contribution rhythm, or demo purpose.</small>
            </label>
            <div className="form-grid">
              <label className="field">
                <span>Contribution amount</span>
                <input
                  inputMode="decimal"
                  placeholder="5"
                  required
                  value={contributionAmount}
                  onChange={(event) => {
                    clearTransientState();
                    setContributionAmount(event.target.value);
                  }}
                />
                <small>USDC per member, per round.</small>
              </label>
              <label className="field">
                <span>Max members</span>
                <input
                  min={2}
                  max={100}
                  required
                  type="number"
                  value={maxMembers}
                  onChange={(event) => {
                    clearTransientState();
                    setMaxMembers(Number(event.target.value));
                  }}
                />
                <small>The payout cycle completes after this many members.</small>
              </label>
            </div>
            <button className="button primary" disabled={isSubmitting || isFinalizing} type="submit">
              {isSubmitting
                ? "Preparing transaction..."
                : isFinalizing
                  ? "Finalizing transaction..."
                  : "Create on-chain pool"}
            </button>
          </form>
        </Card>

        <Card className="preview-card accent-card">
          <h2>Pool preview</h2>
          <p>Creating a pool writes these terms to the deployed ArcLoop smart contract.</p>
          <InfoRow label="Title" value={title || "ArcLoop Genesis Pool"} />
          <InfoRow label="Contribution" value={`${contributionAmount || "5"} USDC`} />
          <InfoRow label="Members" value={`${maxMembers} total`} />
          <InfoRow label="Rounds" value={`${maxMembers} payout rounds`} />
          <div className="notice">
            <strong>What happens next</strong>
            <span>Circle opens a wallet approval prompt, then ArcLoop waits for the transaction hash.</span>
          </div>
        </Card>
      </div>

      {isSessionExpired ? (
        <Modal
          actions={
            <>
              <button className="button primary" type="button" onClick={handleSessionRefresh}>
                Sign in again
              </button>
              <Link className="button secondary" to="/dashboard">
                Back to dashboard
              </Link>
            </>
          }
          status="SESSION_EXPIRED"
          title={sessionExpiredTitle}
        >
          <p>{sessionExpiredMessage}</p>
        </Modal>
      ) : error ? (
        <ErrorState title="Create pool could not continue" message={error} />
      ) : null}

      {hasStartedTransaction && result ? (
        <TxStatusPanel status={displayStatus ?? null} title="Create pool transaction">
          <p>{transactionMessage}</p>
          <InfoRow label="Contract" value={<AddressText value={result.request.contractAddress} />} />
          <InfoRow label="USDC" value={<AddressText value={result.request.usdcTokenAddress} />} />
          <InfoRow label="Transaction ID" value={transactionId} />
          <InfoRow
            action={
              explorerLink && transactionHash ? <ExplorerLink href={explorerLink} label="Arcscan" /> : null
            }
            label="Transaction hash"
            value={transactionHash ? <AddressText value={transactionHash} /> : "Not available yet"}
          />
          {finalizedResult?.poolMetadata ? (
            <InfoRow
              label="Pool"
              value={`${finalizedResult.poolMetadata.pool.title} (#${finalizedResult.poolMetadata.pool.onchainPoolId})`}
            />
          ) : null}
          <div className="button-row">
            {explorerLink ? (
              <a className="button secondary" href={explorerLink} rel="noreferrer" target="_blank">
                View transaction
              </a>
            ) : null}
            <Link className="button secondary" to="/pools">
              Back to pools
            </Link>
            <Link className="button ghost" to="/dashboard">
              Dashboard
            </Link>
          </div>
        </TxStatusPanel>
      ) : null}

      {displayStatus === "TRANSACTION_CONFIRMED" ? (
        <Modal title="Pool created" status="TRANSACTION_CONFIRMED">
          <p>Your pool transaction is confirmed and the pool is ready in your pools list.</p>
        </Modal>
      ) : null}
    </div>
  );
}
