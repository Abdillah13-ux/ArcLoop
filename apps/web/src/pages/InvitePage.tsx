import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusPill } from "../components/StatusPill";
import { getInvite } from "../lib/api-client";
import type { Pool } from "../types/api";

export function InvitePage() {
  const { inviteCode } = useParams();
  const [pool, setPool] = useState<Pool | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (!inviteCode) {
      setError("Invite code is missing.");
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    getInvite(inviteCode)
      .then((item) => {
        if (isMounted) {
          setPool(item);
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Invite not found.");
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
  }, [inviteCode]);

  return (
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Invite preview</h1>
        <p>Read-only pool summary for this invite code.</p>
      </div>

      {isLoading ? <LoadingState message="Looking up invite..." /> : null}
      {error ? <ErrorState title="Invite lookup failed" message={error} /> : null}

      {pool ? (
        <Card>
          <div className="card-heading">
            <h2>{pool.title}</h2>
            <StatusPill status={pool.status} />
          </div>
          <InfoRow label="Invite code" value={pool.inviteCode} />
          <InfoRow label="Contribution" value={pool.contributionAmount} />
          <InfoRow label="Max members" value={String(pool.maxMembers)} />
          <InfoRow label="Current round" value={String(pool.currentRound)} />
          <Link className="button primary full-width" to={`/pools/${pool.id}`}>
            View pool details
          </Link>
        </Card>
      ) : null}
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
