import { useEffect, useState } from "react";

import { Card } from "../components/Card";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
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
        <p>Read-only Arc Testnet deployment details used by the ArcLoop API.</p>
      </div>

      {isLoading ? <LoadingState message="Loading contract info..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {contractInfo ? (
        <Card>
          <InfoRow label="Chain ID" value={String(contractInfo.chainId)} />
          <InfoRow label="Contract address" value={contractInfo.address} />
          <InfoRow label="USDC token address" value={contractInfo.usdcTokenAddress} />
          <InfoRow label="Explorer URL" value={contractInfo.explorerUrl} />
        </Card>
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
