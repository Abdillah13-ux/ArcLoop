import { useEffect, useState } from "react";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { AddressText, ExplorerLink, InfoRow } from "../components/UiKit";
import { getContractInfo } from "../lib/api-client";
import type { ContractInfo } from "../types/api";

export function ContractsPage() {
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getContractInfo()
      .then((info) => {
        if (isMounted) {
          setContractInfo(info);
        }
      })
      .catch((caughtError: unknown) => {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load contract info.");
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
    <div className="page narrow-page">
      <div className="page-heading">
        <h1>Contract reference</h1>
        <p>
          Verified Arc Testnet deployment details for the rotating savings pool contract
          used by the production MVP demo.
        </p>
      </div>

      {isLoading ? <LoadingState message="Loading contract info..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {contractInfo ? (
        <div className="detail-stack">
          <Card className="accent-card">
            <div className="card-heading">
              <h2>Deployment</h2>
              <span className="status-pill status-active">Verified testnet</span>
            </div>
            <p>
              Create, join, approve, and contribute transactions are sent through Circle
              and confirmed against this Arc Testnet deployment.
            </p>
            <InfoRow label="Chain ID" value={String(contractInfo.chainId)} />
            <InfoRow
              action={<ExplorerLink href={`${contractInfo.explorerUrl.replace(/\/$/, "")}/address/${contractInfo.address}`} label="Arcscan" />}
              label="Contract"
              value={<AddressText value={contractInfo.address} />}
            />
            <InfoRow
              action={<ExplorerLink href={`${contractInfo.explorerUrl.replace(/\/$/, "")}/address/${contractInfo.usdcTokenAddress}`} label="Arcscan" />}
              label="USDC token"
              value={<AddressText value={contractInfo.usdcTokenAddress} />}
            />
            <InfoRow label="Explorer" value={contractInfo.explorerUrl} />
          </Card>

          <section className="section-grid">
            <Card className="compact">
              <h2>Create pool</h2>
              <p>Defines fixed USDC amount, max members, and payout rounds on-chain.</p>
            </Card>
            <Card className="compact">
              <h2>Join and approve</h2>
              <p>Members join the order and approve USDC before contributing.</p>
            </Card>
            <Card className="compact">
              <h2>Contribute</h2>
              <p>Confirmed contributions advance each round until the pool completes.</p>
            </Card>
          </section>
        </div>
      ) : null}
    </div>
  );
}
