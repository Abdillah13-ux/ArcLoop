import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import { getPools } from "../lib/api-client";
import type { Pool } from "../types/api";

export function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getPools()
      .then((items) => {
        if (isMounted) {
          setPools(items);
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load pools.");
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
  }, []);

  return (
    <div className="page">
      <div className="page-heading">
        <h1>Pools</h1>
        <p>Read-only pool metadata mirrored from Arc Testnet contract events and API records.</p>
      </div>

      {isLoading ? <LoadingState message="Loading pools..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && pools.length === 0 ? (
        <EmptyState
          title="No pools indexed yet"
          message="Once the API has pool metadata or indexed events, pools will appear here."
        />
      ) : null}

      <div className="pool-grid">
        {pools.map((pool) => (
          <Link className="pool-card-link" to={`/pools/${pool.id}`} key={pool.id}>
            <Card>
              <div className="card-heading">
                <h2>{pool.title}</h2>
                <StatusPill status={pool.status} />
              </div>
              <InfoRow label="Contribution" value={pool.contributionAmount} />
              <InfoRow label="Max members" value={String(pool.maxMembers)} />
              <InfoRow label="Current round" value={String(pool.currentRound)} />
              <InfoRow label="Invite" value={pool.inviteCode} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
