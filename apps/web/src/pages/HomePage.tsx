import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { getContractInfo, getHealth } from "../lib/api-client";
import type { ContractInfo, HealthInfo } from "../types/api";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function HomePage() {
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getContractInfo(), getHealth()])
      .then(([contract, apiHealth]) => {
        if (!isMounted) {
          return;
        }

        setContractInfo(contract);
        setHealth(apiHealth);
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to reach the API.");
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
      <section className="hero">
        <div className="hero-copy">
          <h1>Transparent USDC rotating savings pools on Arc.</h1>
          <p>
            ArcLoop helps groups coordinate fixed contributions, a fixed payout order,
            transparent settlement, and verifiable payout proof through an Arc smart contract.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/pools">
              View pools
            </Link>
            <Link className="button secondary" to="/contracts">
              Read contract info
            </Link>
            <Link className="button ghost" to="/mobile">
              Mobile plan
            </Link>
          </div>
        </div>
        <Card className="hero-panel">
          <div className="panel-topline">
            <span>API</span>
            <strong>{health?.status ?? "checking"}</strong>
          </div>
          {isLoading ? <LoadingState message="Checking API and contract..." /> : null}
          {error ? <ErrorState message={error} /> : null}
          {contractInfo ? (
            <div className="metric-stack">
              <InfoRow label="Contract" value={shortenAddress(contractInfo.address)} />
              <InfoRow label="Chain ID" value={String(contractInfo.chainId)} />
              <InfoRow label="USDC" value={shortenAddress(contractInfo.usdcTokenAddress)} />
            </div>
          ) : null}
        </Card>
      </section>

      <section className="section-grid">
        <Card>
          <h2>Fixed contribution</h2>
          <p>Every pool mirrors a single contribution amount from contract state.</p>
        </Card>
        <Card>
          <h2>Fixed payout order</h2>
          <p>Members follow the contract-defined order for each round.</p>
        </Card>
        <Card>
          <h2>Verifiable proof</h2>
          <p>Events are indexed for a clear public record of contributions and payouts.</p>
        </Card>
      </section>
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
