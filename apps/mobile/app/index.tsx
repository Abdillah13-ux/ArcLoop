import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../src/components/Card";
import { ErrorState } from "../src/components/ErrorState";
import { LoadingState } from "../src/components/LoadingState";
import { Screen } from "../src/components/Screen";
import { getContractInfo, getHealth } from "../src/lib/api-client";
import type { ContractInfo, HealthInfo } from "../src/types/api";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomeScreen() {
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
          setError(caughtError instanceof Error ? caughtError.message : "Unable to load API status.");
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
      <View style={styles.hero}>
        <Text style={styles.title}>ArcLoop</Text>
        <Text style={styles.subtitle}>Transparent USDC rotating savings pools on Arc.</Text>
        <Text style={styles.note}>Read-only mobile shell. Wallet actions come later.</Text>
      </View>

      {isLoading ? <LoadingState message="Checking the ArcLoop API..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {contractInfo ? (
        <Card>
          <Text style={styles.cardTitle}>Arc Testnet Contract</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Contract</Text>
            <Text style={styles.value}>{shortenAddress(contractInfo.address)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Chain ID</Text>
            <Text style={styles.value}>{contractInfo.chainId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>API</Text>
            <Text style={styles.value}>{health?.status ?? "unknown"}</Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/pools")}>
          <Text style={styles.primaryButtonText}>View Pools</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/contracts")}>
          <Text style={styles.secondaryButtonText}>Contract Info</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 10,
    paddingTop: 18,
    paddingBottom: 8
  },
  title: {
    color: "#0F172A",
    fontSize: 38,
    fontWeight: "800"
  },
  subtitle: {
    color: "#334155",
    fontSize: 18,
    lineHeight: 26
  },
  note: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "700"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  label: {
    color: "#64748B",
    fontSize: 14
  },
  value: {
    color: "#0F172A",
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right"
  },
  actions: {
    gap: 10,
    marginTop: 4
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 8,
    padding: 14
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  secondaryButtonText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700"
  }
});
