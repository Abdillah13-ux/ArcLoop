import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import type { ChallengeCompleteCallback, SignTransactionResult } from "@circle-fin/w3s-pw-web-sdk/dist/src/types";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import {
  AddressText,
  AdvancedDetails,
  ExplorerLink,
  formatStateLabel,
  formatUsdcAmount,
  InfoRow,
  Modal,
  ProgressBar,
  StatusBadge,
  TxStatusPanel
} from "../components/UiKit";
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

const poolStatePollIntervalMs = 2_500;
const poolStatePollTimeoutMs = 75_000;

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionStartDetail, setTransactionStartDetail] = useState<PoolDetail | null>(null);

  const loadPool = useCallback(async (silent = false) => {
    if (!id) {
      setError("Pool id is missing.");
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
    }
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

  async function waitForPoolState(action: PoolAction, before: PoolDetail, userToken: string) {
    const startedAt = Date.now();
    let pollAttempt = 0;

    console.info("[Circle transaction debug] pool state polling started", {
      action,
      baselineMembersJoined: before.chainState.members.length,
      baselineContributionProgress: before.chainState.contributionProgress,
      baselineRound: before.pool.currentRound,
      baselineStatus: before.pool.status
    });

    while (Date.now() - startedAt < poolStatePollTimeoutMs) {
      pollAttempt += 1;
      await new Promise((resolve) => window.setTimeout(resolve, poolStatePollIntervalMs));
      let latest: PoolDetail;
      try {
        latest = await getPoolById(id!, userToken);
      } catch {
        continue;
      }

      setDetail(latest);

      console.info("[Circle transaction debug] pool state poll", {
        action,
        pollAttempt,
        baselineMembersJoined: before.chainState.members.length,
        baselineContributionProgress: before.chainState.contributionProgress,
        baselineRound: before.pool.currentRound,
        baselineStatus: before.pool.status,
        latestMembersJoined: latest.chainState.members.length,
        latestContributionProgress: latest.chainState.contributionProgress,
        latestRound: latest.pool.currentRound,
        latestStatus: latest.pool.status,
        joined: latest.chainState.viewer.hasCurrentUserJoined,
        allowance: latest.chainState.viewer.allowanceSufficient,
        contributed: latest.chainState.viewer.hasCurrentUserContributed
      });

      const stateChanged = hasExpectedPoolStateChanged(action, before, latest);

      if (stateChanged) {
        return latest;
      }
    }

    return null;
  }

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
    setShowSuccessModal(false);
    setTransactionStartDetail(detail);

    try {
      const beforeTransaction = detail;
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
          action,
          callbackStatus: challengeResult?.status ?? null,
          callbackError: Boolean(sdkError)
        });

        if (sdkError) {
          setFlowStatus("TRANSACTION_FAILED");
          setError(sdkError.message || "Circle pool transaction challenge failed.");
          setIsWorking(false);
          return;
        }

        if (challengeResult?.status !== "COMPLETE") {
          setFlowStatus("TRANSACTION_FAILED");
          setError(`Circle challenge ${formatStateLabel(challengeResult?.status ?? "UNKNOWN")}.`);
          setIsWorking(false);
          return;
        }

        setFlowStatus("CHALLENGE_COMPLETE");
        const sdkTransactionHash = transactionResult?.data?.txHash ?? null;
        setTransactionHash(sdkTransactionHash);
        setTransactionMessage("Wallet confirmation complete. Waiting for Arc Testnet confirmation...");

        try {
          const finalized = await finalizePoolActionTransaction(
            id,
            {
              challengeId,
              action
            },
            session.userToken
          );

          setTransactionHash(finalized.transaction.transactionHash ?? sdkTransactionHash);
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

          if (beforeTransaction && finalized.transaction.status !== "TRANSACTION_FAILED") {
            setFlowStatus("TRANSACTION_SUBMITTED");
            setTransactionMessage("Wallet confirmation complete. Waiting for Arc Testnet confirmation...");
            const updatedDetail = await waitForPoolState(action, beforeTransaction, session.userToken);

            if (updatedDetail) {
              setFlowStatus("TRANSACTION_CONFIRMED");
              setTransactionMessage(getConfirmedMessage(action));
              setShowSuccessModal(true);
            } else {
              setFlowStatus("TRANSACTION_TIMEOUT");
              setTransactionMessage("Transaction may still be confirming. You can refresh status.");
            }
          } else {
            await loadPool(true);
          }
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

  async function refreshTransactionStatus() {
    if (!id || !session) {
      await loadPool(true);
      return;
    }

    try {
      const latest = await getPoolById(id, session.userToken);
      setDetail(latest);
      if (activeAction && transactionStartDetail && hasExpectedPoolStateChanged(activeAction, transactionStartDetail, latest)) {
        setFlowStatus("TRANSACTION_CONFIRMED");
        setTransactionMessage(getConfirmedMessage(activeAction));
        setShowSuccessModal(true);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to refresh pool status.");
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
      {error ? <ErrorState title="Pool status needs attention" message={error} /> : null}

      {pool && detail && chainState ? (
        <>
          <div className="page-heading">
            <h1>{pool.title}</h1>
            <StatusBadge status={pool.status} />
            <p>{pool.description ?? "ArcLoop pool mirrored from Arc Testnet."}</p>
          </div>
          <div className="detail-stack">
            <Card className="accent-card">
              <div className="card-heading">
                <h2>Pool terms</h2>
                <StatusBadge status={pool.status} />
              </div>
              <div className="stat-grid">
                <div className="stat-card">
                  <span>Contribution</span>
                  <strong>{formatUsdcAmount(pool.contributionAmount)}</strong>
                </div>
                <div className="stat-card">
                  <span>Members</span>
                  <strong>{chainState.members.length} / {pool.maxMembers}</strong>
                </div>
                <div className="stat-card">
                  <span>Round</span>
                  <strong>{pool.currentRound}</strong>
                </div>
              </div>
              <ProgressBar label="Members joined" max={pool.maxMembers} value={chainState.members.length} />
              <ProgressBar
                label="Round contributions"
                max={pool.maxMembers}
                value={chainState.contributionProgress}
              />
              <InfoRow label="Current round" value={String(pool.currentRound)} />
              <InfoRow
                label="Current recipient"
                value={chainState.currentRecipient ? <AddressText value={chainState.currentRecipient} /> : "Not active"}
              />
              <InfoRow label="Invite code" value={pool.inviteCode} />
              <InfoRow label="On-chain pool ID" value={String(pool.onchainPoolId)} />
            </Card>

            <Card>
              <div className="card-heading">
                <h2>Required action</h2>
                <StatusBadge status={chainState.nextRequiredAction} />
              </div>
              {chainState.contractGaps.length > 0 ? (
                <div className="state-box warning-state">
                  <h2>Contract lifecycle gap</h2>
                  {chainState.contractGaps.map((gap) => (
                    <p key={gap}>{gap}</p>
                  ))}
                </div>
              ) : null}
              <p>{getActionGuidance(chainState.nextRequiredAction, pool.status)}</p>
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
              <InfoRow label="Next required action" value={chainState.nextRequiredAction} />
              <InfoRow
                label="Joined"
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
              {transactionMessage ? <p>{transactionMessage}</p> : null}
              {explorerLink ? (
                <a className="button secondary full-width" href={explorerLink} rel="noreferrer" target="_blank">
                  View transaction
                </a>
              ) : null}
              <AdvancedDetails>
                <InfoRow label="Flow status" value={formatStateLabel(flowStatus)} />
                <InfoRow label="Action" value={activeAction ? formatStateLabel(activeAction) : "None"} />
                <InfoRow
                  action={explorerLink ? <ExplorerLink href={explorerLink} label="Arcscan" /> : null}
                  label="Transaction hash"
                  value={transactionHash ? <AddressText value={transactionHash} /> : "Not available"}
                />
              </AdvancedDetails>
            </Card>

            <Card>
              <h2>Members</h2>
              {detail.members.length === 0 ? (
                <p>
                  {chainState.members.length > 0
                    ? "Member count is synced on-chain. Detailed member list is not available yet."
                    : "No members have joined yet."}
                </p>
              ) : null}
              {detail.members.map((member) => (
                <InfoRow
                  key={member.id}
                  label={`Member ${member.memberIndex + 1}`}
                  value={<AddressText value={member.memberAddress} />}
                />
              ))}
            </Card>

            <Card>
              <h2>Current round</h2>
              <InfoRow
                label="Recipient"
                value={
                  chainState.currentRecipient ?? currentRound?.recipientAddress ? (
                    <AddressText value={chainState.currentRecipient ?? currentRound?.recipientAddress ?? ""} />
                  ) : (
                    "Not active"
                  )
                }
              />
              <InfoRow
                label="Contributions"
                value={`${chainState.contributionProgress} / ${pool.maxMembers}`}
              />
              <InfoRow label="Payout amount" value={currentRound ? formatUsdcAmount(currentRound.payoutAmount) : "Not started"} />
              <InfoRow
                label="Last payout hash"
                value={latestPayoutRound?.payoutTxHash ? <AddressText value={latestPayoutRound.payoutTxHash} /> : "Not available"}
              />
            </Card>

            <Card>
              <h2>Contributions</h2>
              {detail.contributions.length === 0 ? <p>No contributions recorded yet.</p> : null}
              {detail.contributions.map((contribution) => (
                <InfoRow
                  key={contribution.id}
                  label={`Round ${contribution.roundIndex}`}
                  value={`${formatUsdcAmount(contribution.amount)} from ${shortAddress(contribution.memberAddress)}`}
                />
              ))}
            </Card>

            <Card>
              <h2>Verification</h2>
              <InfoRow label="Creator" value={<AddressText value={pool.creatorAddress} />} />
              <InfoRow label="Token" value={<AddressText value={pool.tokenAddress} />} />
              <InfoRow label="Contract" value={<AddressText value={pool.contractAddress} />} />
              <InfoRow label="Chain ID" value={String(pool.chainId)} />
            </Card>
          </div>
          {flowStatus !== "READY" ? (
            <TxStatusPanel
              status={flowStatus}
              title={
                flowStatus === "CHALLENGE_COMPLETE"
                  ? "Wallet confirmation complete"
                  : flowStatus === "TRANSACTION_SUBMITTED"
                    ? "Waiting for Arc Testnet confirmation..."
                    : `${activeAction ? formatStateLabel(activeAction) : "Pool"} transaction`
              }
              actions={
                <>
                  <button className="button secondary" type="button" onClick={() => void refreshTransactionStatus()}>
                    Refresh status
                  </button>
                  {explorerLink ? (
                    <a className="button secondary" href={explorerLink} rel="noreferrer" target="_blank">
                      View transaction
                    </a>
                  ) : null}
                </>
              }
            >
              <p>
                {flowStatus === "CHALLENGE_COMPLETE" || flowStatus === "TRANSACTION_SUBMITTED"
                  ? "Wallet confirmation complete. Waiting for Arc Testnet confirmation..."
                  : transactionMessage ?? "Circle may need a moment to expose the transaction hash after wallet approval."}
              </p>
            </TxStatusPanel>
          ) : null}
          {showSuccessModal && flowStatus === "TRANSACTION_CONFIRMED" ? (
            <Modal
              actions={
                <>
                  {explorerLink ? (
                    <a className="button secondary" href={explorerLink} rel="noreferrer" target="_blank">
                      View transaction
                    </a>
                  ) : null}
                  <button className="button primary" type="button" onClick={() => setShowSuccessModal(false)}>
                    Continue
                  </button>
                  <Link className="button ghost" to="/pools">
                    Back to pools
                  </Link>
                </>
              }
              title={getConfirmedTitle(activeAction)}
              status="TRANSACTION_CONFIRMED"
            >
              <p>{getConfirmedMessage(activeAction)}</p>
            </Modal>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function hasExpectedPoolStateChanged(action: PoolAction, before: PoolDetail, latest: PoolDetail) {
  const latestViewer = latest.chainState.viewer;

  if (action === "join") {
    return latestViewer.hasCurrentUserJoined === true ||
      latest.chainState.members.length > before.chainState.members.length ||
      latest.chainState.members.length >= before.pool.maxMembers;
  }

  if (action === "approve") {
    return latestViewer.allowanceSufficient === true;
  }

  return latestViewer.hasCurrentUserContributed === true ||
    latest.chainState.contributionProgress > before.chainState.contributionProgress ||
    latest.pool.status !== before.pool.status ||
    latest.pool.currentRound !== before.pool.currentRound;
}

function getConfirmedTitle(action: PoolAction | null) {
  if (action === "join") return "Join confirmed";
  if (action === "approve") return "USDC approval confirmed";
  if (action === "contribute") return "Contribution confirmed";
  return "Pool updated";
}

function getConfirmedMessage(action: PoolAction | null) {
  if (action === "join") return "You are now a member of this pool.";
  if (action === "approve") return "Your USDC allowance is ready for the next contribution.";
  if (action === "contribute") return "Your contribution is reflected in the current round.";
  return "The latest pool state has been refreshed.";
}

function formatNullableBoolean(value: boolean | null) {
  if (value === null) {
    return "Unknown";
  }

  return value ? "Yes" : "No";
}

function getActionGuidance(action: string, status: string) {
  if (status === "completed") {
    return "This pool is completed. Review the contribution and payout history below.";
  }

  if (action.toLowerCase().includes("approve")) {
    return "Approve USDC first so the pool contract can collect your contribution.";
  }

  if (action.toLowerCase().includes("contribute")) {
    return "Your allowance is ready. Submit this round's contribution through Circle.";
  }

  if (action.toLowerCase().includes("join")) {
    return "Join the pool to enter the rotating payout order.";
  }

  return "No wallet action is needed from you right now. Refresh safely if the chain state just changed.";
}
