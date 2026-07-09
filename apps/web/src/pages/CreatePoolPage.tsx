import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeCompleteCallback, SignTransactionResult } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { createPoolTransaction, finalizePoolTransaction, getCircleLoginConfig } from "../lib/api-client";
import { useCircleAuth } from "../lib/circle-auth";
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
  const { session } = useCircleAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [maxMembers, setMaxMembers] = useState(2);
  const [result, setResult] = useState<CreatePoolTransactionResult | null>(null);
  const [finalizedResult, setFinalizedResult] = useState<FinalizePoolTransactionResult | null>(null);
  const [flowStatus, setFlowStatus] = useState<PoolTransactionFlowStatus | null>(null);
  const [challengeStatus, setChallengeStatus] = useState<string | null>(null);
  const [executedTxHash, setExecutedTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  const activeSession = session;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setFinalizedResult(null);
    setFlowStatus(null);
    setChallengeStatus(null);
    setExecutedTxHash(null);

    try {
      const input = {
        title,
        description: description.trim() || undefined,
        contributionAmount,
        maxMembers
      };

      const response = await createPoolTransaction({
        ...input
      }, activeSession.userToken);
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
        },
        authentication: {
          userToken: activeSession.userToken,
          encryptionKey: activeSession.encryptionKey
        }
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
          setFlowStatus("TRANSACTION_FAILED");
          setError(sdkError.message || "Circle transaction challenge failed.");
          return;
        }

        setChallengeStatus(challengeResult?.status ?? "UNKNOWN");
        setExecutedTxHash(sdkTransactionHash);

        if (challengeResult?.status !== "COMPLETE") {
          setFlowStatus("TRANSACTION_FAILED");
          setError(`Circle transaction challenge ${formatState(challengeResult?.status ?? "UNKNOWN")}.`);
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
              activeSession.userToken
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
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to create pool transaction."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const transactionHash =
    finalizedResult?.transaction.transactionHash ?? executedTxHash ?? result?.transaction.transactionHash;
  const transactionId =
    finalizedResult?.transaction.transactionId ?? result?.transaction.transactionId ?? "Not submitted";
  const transactionMessage =
    finalizedResult?.transaction.message ??
    (isFinalizing ? "Challenge complete. Waiting for Circle transaction submission." : result?.transaction.message);
  const displayStatus =
    flowStatus ??
    finalizedResult?.transaction.status ??
    challengeStatus ??
    result?.transaction.status;
  const explorerLink =
    transactionHash && result
      ? `${result.request.explorerUrl.replace(/\/$/, "")}/tx/${transactionHash}`
      : null;

  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Create pool</h1>
        <p>Submit a fixed-contribution USDC pool creation transaction through the Circle wallet flow.</p>
      </div>

      <Card>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>Title</span>
            <input
              maxLength={120}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              maxLength={1000}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Contribution amount</span>
              <input
                inputMode="decimal"
                placeholder="25.00"
                required
                value={contributionAmount}
                onChange={(event) => setContributionAmount(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Max members</span>
              <input
                min={2}
                max={100}
                required
                type="number"
                value={maxMembers}
                onChange={(event) => setMaxMembers(Number(event.target.value))}
              />
            </label>
          </div>
          <button className="button primary" disabled={isSubmitting || isFinalizing} type="submit">
            {isSubmitting
              ? "Preparing transaction..."
              : isFinalizing
                ? "Finalizing transaction..."
                : "Create transaction"}
          </button>
        </form>
      </Card>

      {error ? <ErrorState message={error} /> : null}

      {result ? (
        <Card className="result-card">
          <div className="card-heading">
            <h2>Transaction status</h2>
            <span className="status-pill">
              {displayStatus ? formatState(displayStatus) : "Unknown"}
            </span>
          </div>
          <p>{transactionMessage}</p>
          <InfoRow label="Contract" value={result.request.contractAddress} />
          <InfoRow label="USDC" value={result.request.usdcTokenAddress} />
          <InfoRow label="Transaction ID" value={transactionId} />
          <InfoRow label="Transaction hash" value={transactionHash ?? "Not available"} />
          {finalizedResult?.poolMetadata ? (
            <InfoRow
              label="Pool"
              value={`${finalizedResult.poolMetadata.pool.title} (#${finalizedResult.poolMetadata.pool.onchainPoolId})`}
            />
          ) : null}
          {explorerLink ? (
            <a className="button secondary" href={explorerLink} rel="noreferrer" target="_blank">
              View transaction
            </a>
          ) : null}
          <Link className="button ghost" to="/dashboard">
            Back to dashboard
          </Link>
        </Card>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
