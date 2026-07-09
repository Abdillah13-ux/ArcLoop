import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeCompleteCallback, SignTransactionResult } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import {
  createPoolApproveTransaction,
  createPoolContributeTransaction,
  createPoolJoinTransaction,
  finalizePoolActionTransaction,
  getCircleLoginConfig,
  getPoolById
} from "../lib/api-client";
import { useCircleAuth } from "../lib/circle-auth";
import type { PoolAction, PoolActionTransactionResult, PoolDetail } from "../types/api";

type FlowStatus =
  | "READY"
  | "CHALLENGE_CREATED"
  | "WAITING_FOR_USER_APPROVAL"
  | "CHALLENGE_COMPLETE"
  | "TRANSACTION_SUBMITTED"
  | "TRANSACTION_CONFIRMED"
  | "TRANSACTION_FAILED"
  | "TRANSACTION_TIMEOUT";

export function PoolDetailPage() {
  const { id } = useParams();
  const { session } = useCircleAuth();
  const [detail, setDetail] = useState<PoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [flowStatus, setFlowStatus] = useState<FlowStatus>("READY");
  const [activeAction, setActiveAction] = useState<PoolAction | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [transactionMessage, setTransactionMessage] = useState<string | null>(null);

  const loadPool = useCallback(async () => {
    if (!id) {
      setError("Pool id is missing.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const item = await getPoolById(id, session?.userToken);
      setDetail(item);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load pool.");
    } finally {
      setIsLoading(false);
    }
  }, [id, session?.userToken]);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  async function executePoolAction(action: PoolAction) {
    if (!id || !session) {
      setError("Sign in with Circle before submitting a pool transaction.");
      return;
    }

    setError(null);
    setIsWorking(true);
    setActiveAction(action);
    setFlowStatus("READY");
    setTransactionHash(null);
    setTransactionMessage(null);

    try {
      let challenge: PoolActionTransactionResult;

      if (action === "approve") {
        challenge = await createPoolApproveTransaction(id, session.userToken);
      } else if (action === "join") {
        challenge = await createPoolJoinTransaction(id, session.userToken);
      } else {
        challenge = await createPoolContributeTransaction(id, session.userToken);
      }

      if (!challenge.transaction.challengeId) {
        setTransactionMessage(challenge.transaction.message);
        setFlowStatus(challenge.transaction.status === "TRANSACTION_FAILED" ? "TRANSACTION_FAILED" : "READY");
        setIsWorking(false);
        return;
      }

      const challengeId = challenge.transaction.challengeId;
      setTransactionMessage(challenge.transaction.message);
      setFlowStatus("CHALLENGE_CREATED");

      const config = await getCircleLoginConfig();
      if (!config.appId) {
        setError("Circle App ID is not configured.");
        setFlowStatus("TRANSACTION_FAILED");
        setIsWorking(false);
        return;
      }

      const sdk = new W3SSdk({
        appSettings: {
          appId: config.appId
        },
        authentication: {
          userToken: session.userToken,
          encryptionKey: session.encryptionKey
        }
      });

      setFlowStatus("WAITING_FOR_USER_APPROVAL");
      const onComplete: ChallengeCompleteCallback = async (sdkError, challengeResult) => {
        const transactionResult = challengeResult as SignTransactionResult | undefined;
        console.info("[Circle transaction debug] pool action SDK callback", {
          challengeIdLength: challengeId.length,
          callbackFired: true,
          callbackStatus: challengeResult?.status ?? null,
          hasTransactionId: false,
          transactionIdLength: null,
          hasTxHash: Boolean(transactionResult?.data?.txHash),
          txHashLength: transactionResult?.data?.txHash?.length ?? null,
          circleErrorCode: sdkError?.code ?? null,
          circleErrorMessage: sdkError?.message ?? null
        });

        if (sdkError) {
          setFlowStatus("TRANSACTION_FAILED");
          setError(sdkError.message || "Circle pool transaction challenge failed.");
          setIsWorking(false);
          return;
        }

        if (challengeResult?.status !== "COMPLETE") {
          setFlowStatus("TRANSACTION_FAILED");
          setError(`Circle challenge ${formatState(challengeResult?.status ?? "UNKNOWN")}.`);
          setIsWorking(false);
          return;
        }

        setFlowStatus("CHALLENGE_COMPLETE");

        try {
          const finalized = await finalizePoolActionTransaction(
            id,
            {
              challengeId,
              action
            },
            session.userToken
          );

          setTransactionHash(finalized.transaction.transactionHash);
          setTransactionMessage(finalized.transaction.message);

          if (finalized.transaction.status === "TRANSACTION_CONFIRMED") {
            setFlowStatus("TRANSACTION_CONFIRMED");
          } else if (finalized.transaction.status === "TRANSACTION_FAILED") {
            setFlowStatus("TRANSACTION_FAILED");
          } else if (finalized.transaction.transactionHash) {
            setFlowStatus("TRANSACTION_SUBMITTED");
          } else {
            setFlowStatus("TRANSACTION_TIMEOUT");
          }

          await loadPool();
        } catch (caughtError) {
          setFlowStatus("TRANSACTION_FAILED");
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to finalize pool transaction."
          );
        } finally {
          setIsWorking(false);
        }
      };

      sdk.execute(challengeId, onComplete);
    } catch (caughtError) {
      setFlowStatus("TRANSACTION_FAILED");
      setError(caughtError instanceof Error ? caughtError.message : "Unable to prepare pool transaction.");
      setIsWorking(false);
    }
  }

  const pool = detail?.pool ?? null;
  const chainState = detail?.chainState ?? null;
  const currentRound = detail?.rounds.find((round) => round.roundIndex === pool?.currentRound) ?? null;
  const latestPayoutRound = detail?.rounds
    .filter((round) => round.payoutTxHash)
    .sort((left, right) => right.roundIndex - left.roundIndex)[0] ?? null;
  const viewer = chainState?.viewer ?? null;
  const canJoin =
    pool?.status === "created" &&
    chainState?.poolFull === false &&
    viewer?.walletExists === true &&
    viewer.hasCurrentUserJoined === false;
  const canApprove =
    pool?.status === "active" &&
    viewer?.walletExists === true &&
    viewer.hasCurrentUserJoined === true &&
    viewer.hasCurrentUserContributed === false &&
    viewer.balanceSufficient !== false &&
    viewer.allowanceSufficient === false;
  const canContribute =
    pool?.status === "active" &&
    viewer?.walletExists === true &&
    viewer.hasCurrentUserJoined === true &&
    viewer.hasCurrentUserContributed === false &&
    viewer.balanceSufficient !== false &&
    viewer.allowanceSufficient === true;
  const explorerLink =
    transactionHash && pool ? `https://testnet.arcscan.app/tx/${transactionHash}` : null;

  return (
    <div className="page narrow-page">
      {isLoading ? <LoadingState message="Loading pool..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {pool && detail && chainState ? (
        <>
          <div className="page-heading">
            <h1>{pool.title}</h1>
            <StatusPill status={pool.status} />
            <p>{pool.description ?? "ArcLoop pool mirrored from Arc Testnet."}</p>
          </div>
          <div className="detail-stack">
            <Card>
              <div className="card-heading">
                <h2>Pool terms</h2>
                <StatusPill status={pool.status} />
              </div>
              <InfoRow label="Contribution amount" value={pool.contributionAmount} />
              <InfoRow label="Members joined" value={`${chainState.members.length} / ${pool.maxMembers}`} />
              <InfoRow label="Current round" value={String(pool.currentRound)} />
              <InfoRow label="Current recipient" value={chainState.currentRecipient ?? "Not active"} />
              <InfoRow
                label="Contribution progress"
                value={`${chainState.contributionProgress} / ${pool.maxMembers}`}
              />
              <InfoRow label="Invite code" value={pool.inviteCode} />
              <InfoRow label="On-chain pool ID" value={String(pool.onchainPoolId)} />
            </Card>

            <Card>
              <h2>Participation</h2>
              {chainState.contractGaps.length > 0 ? (
                <div className="state-box warning-state">
                  <h2>Contract lifecycle gap</h2>
                  {chainState.contractGaps.map((gap) => (
                    <p key={gap}>{gap}</p>
                  ))}
                </div>
              ) : null}
              {session ? (
                <>
                  {canJoin ? (
                    <button
                      className="button primary full-width"
                      disabled={isWorking}
                      type="button"
                      onClick={() => void executePoolAction("join")}
                    >
                      {isWorking && activeAction === "join" ? "Joining..." : "Join Pool"}
                    </button>
                  ) : null}
                  {!viewer?.walletExists ? (
                    <Link className="button primary full-width" to="/dashboard">
                      Create or complete wallet
                    </Link>
                  ) : null}
                  {canApprove ? (
                    <>
                      <button
                        className="button secondary full-width"
                        disabled={isWorking}
                        type="button"
                        onClick={() => void executePoolAction("approve")}
                      >
                        {isWorking && activeAction === "approve" ? "Approving..." : "Approve USDC"}
                      </button>
                    </>
                  ) : null}
                  {canContribute ? (
                    <>
                      <button
                        className="button primary full-width"
                        disabled={isWorking}
                        type="button"
                        onClick={() => void executePoolAction("contribute")}
                      >
                        {isWorking && activeAction === "contribute" ? "Contributing..." : "Contribute"}
                      </button>
                    </>
                  ) : null}
                  {!canJoin && !canApprove && !canContribute && viewer?.walletExists ? (
                    <button className="button disabled" disabled>
                      {chainState.nextRequiredAction}
                    </button>
                  ) : null}
                </>
              ) : (
                <Link className="button primary full-width" to="/login">
                  Sign in with Circle
                </Link>
              )}
              <InfoRow label="Flow status" value={formatState(flowStatus)} />
              <InfoRow label="Action" value={activeAction ? formatState(activeAction) : "None"} />
              <InfoRow label="Next required action" value={chainState.nextRequiredAction} />
              <InfoRow
                label="Current wallet joined"
                value={formatNullableBoolean(viewer?.hasCurrentUserJoined ?? null)}
              />
              <InfoRow
                label="Contributed this round"
                value={formatNullableBoolean(viewer?.hasCurrentUserContributed ?? null)}
              />
              <InfoRow
                label="USDC allowance"
                value={formatNullableBoolean(viewer?.allowanceSufficient ?? null)}
              />
              <InfoRow label="Transaction hash" value={transactionHash ?? "Not available"} />
              {transactionMessage ? <p>{transactionMessage}</p> : null}
              {explorerLink ? (
                <a className="button secondary full-width" href={explorerLink} rel="noreferrer" target="_blank">
                  View transaction
                </a>
              ) : null}
            </Card>

            <Card>
              <h2>Members</h2>
              {detail.members.length === 0 ? <p>No members have joined yet.</p> : null}
              {detail.members.map((member) => (
                <InfoRow
                  key={member.id}
                  label={`Member ${member.memberIndex + 1}`}
                  value={member.memberAddress}
                />
              ))}
            </Card>

            <Card>
              <h2>Current round</h2>
              <InfoRow label="Recipient" value={chainState.currentRecipient ?? currentRound?.recipientAddress ?? "Not active"} />
              <InfoRow
                label="Contributions"
                value={`${chainState.contributionProgress} / ${pool.maxMembers}`}
              />
              <InfoRow label="Payout amount" value={currentRound?.payoutAmount ?? "Not started"} />
              <InfoRow label="Last payout hash" value={latestPayoutRound?.payoutTxHash ?? "Not available"} />
            </Card>

            <Card>
              <h2>Contributions</h2>
              {detail.contributions.length === 0 ? <p>No contributions recorded yet.</p> : null}
              {detail.contributions.map((contribution) => (
                <InfoRow
                  key={contribution.id}
                  label={`Round ${contribution.roundIndex}`}
                  value={`${contribution.amount} from ${shortAddress(contribution.memberAddress)}`}
                />
              ))}
            </Card>

            <Card>
              <h2>Verification</h2>
              <InfoRow label="Creator" value={pool.creatorAddress} />
              <InfoRow label="Token" value={pool.tokenAddress} />
              <InfoRow label="Contract" value={pool.contractAddress} />
              <InfoRow label="Chain ID" value={String(pool.chainId)} />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatState(state: string) {
  return state
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Yes" : "No";
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
