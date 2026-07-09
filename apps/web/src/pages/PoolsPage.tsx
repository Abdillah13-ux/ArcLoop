import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { CopyButton, formatUsdcAmount, InfoRow, StatusBadge } from "../components/UiKit";
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
        <p>Browse active Arc Testnet rotating savings pools and open the one you want to join.</p>
        <Link className="button primary heading-action" to="/pools/new">
          Create pool
        </Link>
      </div>

      {isLoading ? <LoadingState message="Loading pools..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!isLoading && !error && pools.length === 0 ? (
        <EmptyState
          title="No pools yet"
          message="Create the first ArcLoop pool to start a transparent USDC savings round."
        />
      ) : null}

      <div className="pool-grid">
        {pools.map((pool) => (
          <div className="pool-card-link" key={pool.id}>
            <Card>
              <div className="card-heading">
                <h2>{pool.title}</h2>
                <StatusBadge status={pool.status} />
              </div>
              <p>{pool.description ?? "Fixed contribution pool mirrored from Arc Testnet."}</p>
              <InfoRow label="Contribution" value={formatUsdcAmount(pool.contributionAmount)} />
              <InfoRow label="Capacity" value={`${pool.maxMembers} members`} />
              <InfoRow label="Current round" value={String(pool.currentRound)} />
              <InfoRow
                action={<CopyButton value={pool.inviteCode} />}
                label="Invite"
                value={pool.inviteCode}
              />
              <Link className="button secondary full-width" to={`/pools/${pool.id}`}>
                Open pool
              </Link>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
