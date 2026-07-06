import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "../src/components/Card";
import { ErrorState } from "../src/components/ErrorState";
import { LoadingState } from "../src/components/LoadingState";
import { Screen } from "../src/components/Screen";
import { getContractInfo } from "../src/lib/api-client";
import type { ContractInfo } from "../src/types/api";

export default function ContractsScreen() {
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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>RotatingSavingsPool</Text>
        <Text style={styles.subtitle}>Read-only contract reference for ArcLoop on Arc Testnet.</Text>
      </View>

      {isLoading ? <LoadingState message="Loading contract info..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {contractInfo ? (
        <Card>
          <InfoRow label="Chain ID" value={String(contractInfo.chainId)} />
          <InfoRow label="Contract" value={contractInfo.address} />
          <InfoRow label="USDC Token" value={contractInfo.usdcTokenAddress} />
          <InfoRow label="Explorer" value={contractInfo.explorerUrl} />
        </Card>
      ) : null}
    </Screen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8
  },
  title: {
    color: "#0F172A",
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 23
  },
  row: {
    gap: 4
  },
  label: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  value: {
    color: "#0F172A",
    fontSize: 15,
    lineHeight: 22
  }
});
