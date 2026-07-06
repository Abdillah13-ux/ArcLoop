import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { Screen } from "../../src/components/Screen";
import { StatusPill } from "../../src/components/StatusPill";
import { getPools } from "../../src/lib/api-client";
import type { Pool } from "../../src/types/api";

export default function PoolsScreen() {
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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Pools</Text>
        <Text style={styles.subtitle}>Read-only pool metadata mirrored from the ArcLoop API.</Text>
      </View>

      {isLoading ? <LoadingState message="Loading pools..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && pools.length === 0 ? (
        <EmptyState title="No pools yet" message="When indexed or created metadata exists, pools will appear here." />
      ) : null}

      {pools.map((pool) => (
        <Pressable key={pool.id} onPress={() => router.push(`/pools/${pool.id}`)}>
          <Card>
            <View style={styles.cardHeader}>
              <Text style={styles.poolTitle}>{pool.title}</Text>
              <StatusPill status={pool.status} />
            </View>
            <InfoRow label="Contribution" value={pool.contributionAmount} />
            <InfoRow label="Members" value={String(pool.maxMembers)} />
            <InfoRow label="Current Round" value={String(pool.currentRound)} />
            <InfoRow label="Invite" value={pool.inviteCode} />
          </Card>
        </Pressable>
      ))}
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
    fontSize: 28,
    fontWeight: "800"
  },
  subtitle: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 23
  },
  cardHeader: {
    gap: 8
  },
  poolTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800"
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
  }
});
