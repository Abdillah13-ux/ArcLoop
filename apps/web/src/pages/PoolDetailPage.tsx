import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import { getPoolById } from "../lib/api-client";
import type { Pool } from "../types/api";

export function PoolDetailPage() {
  const { id } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!id) {
      setError("Pool id is missing.");
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    getPoolById(id)
      .then((item) => {
        if (isMounted) {
          setPool(item);
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load pool.");
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
  }, [id]);

  return (
    <div className="page narrow-page">
      {isLoading ? <LoadingState message="Loading pool..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {pool ? (
        <>
          <div className="page-heading">
            <h1>{pool.title}</h1>
            <StatusPill status={pool.status} />
            <p>{pool.description ?? "Read-only ArcLoop pool metadata."}</p>
          </div>
          <Card>
            <InfoRow label="Contribution amount" value={pool.contributionAmount} />
            <InfoRow label="Max members" value={String(pool.maxMembers)} />
            <InfoRow label="Current round" value={String(pool.currentRound)} />
            <InfoRow label="Invite code" value={pool.inviteCode} />
            <InfoRow label="On-chain pool ID" value={String(pool.onchainPoolId)} />
          </Card>
          <Card>
            <InfoRow label="Creator" value={pool.creatorAddress} />
            <InfoRow label="Token" value={pool.tokenAddress} />
            <InfoRow label="Contract" value={pool.contractAddress} />
            <InfoRow label="Chain ID" value={String(pool.chainId)} />
          </Card>
          <button className="button disabled" disabled>
            Wallet actions coming later.
          </button>
        </>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
