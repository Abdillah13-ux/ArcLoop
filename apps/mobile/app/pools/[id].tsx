import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { Screen } from "../../src/components/Screen";
import { StatusPill } from "../../src/components/StatusPill";
import { getPoolById } from "../../src/lib/api-client";
import type { Pool } from "../../src/types/api";

export default function PoolDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
    <Screen>
      {isLoading ? <LoadingState message="Loading pool..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {pool ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{pool.title}</Text>
            <StatusPill status={pool.status} />
            <Text style={styles.description}>
              {pool.description ?? "Read-only ArcLoop pool metadata."}
            </Text>
          </View>

          <Card>
            <InfoRow label="Contribution Amount" value={pool.contributionAmount} />
            <InfoRow label="Max Members" value={String(pool.maxMembers)} />
            <InfoRow label="Current Round" value={String(pool.currentRound)} />
            <InfoRow label="Invite Code" value={pool.inviteCode} />
            <InfoRow label="On-chain Pool ID" value={String(pool.onchainPoolId)} />
          </Card>

          <Card>
            <InfoRow label="Creator" value={pool.creatorAddress} />
            <InfoRow label="Token" value={pool.tokenAddress} />
            <InfoRow label="Contract" value={pool.contractAddress} />
            <InfoRow label="Chain ID" value={String(pool.chainId)} />
          </Card>

          <Pressable disabled style={styles.disabledButton}>
            <Text style={styles.disabledButtonText}>Wallet actions coming later</Text>
          </Pressable>
        </>
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
    gap: 9
  },
  title: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "800"
  },
  description: {
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
  },
  disabledButton: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    padding: 14
  },
  disabledButtonText: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "700"
  }
});
