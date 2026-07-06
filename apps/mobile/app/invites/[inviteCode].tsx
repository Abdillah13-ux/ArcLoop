import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { ErrorState } from "../../src/components/ErrorState";
import { LoadingState } from "../../src/components/LoadingState";
import { Screen } from "../../src/components/Screen";
import { StatusPill } from "../../src/components/StatusPill";
import { getInvite } from "../../src/lib/api-client";
import type { Pool } from "../../src/types/api";

export default function InviteScreen() {
  const { inviteCode } = useLocalSearchParams<{ inviteCode: string }>();
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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Invite</Text>
        <Text style={styles.subtitle}>Read-only invite preview. Joining comes later.</Text>
      </View>

      {isLoading ? <LoadingState message="Looking up invite..." /> : null}
      {error ? <ErrorState title="Invite lookup failed" message={error} /> : null}

      {pool ? (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.poolTitle}>{pool.title}</Text>
            <StatusPill status={pool.status} />
          </View>
          <InfoRow label="Invite Code" value={pool.inviteCode} />
          <InfoRow label="Contribution" value={pool.contributionAmount} />
          <InfoRow label="Members" value={String(pool.maxMembers)} />
          <InfoRow label="Current Round" value={String(pool.currentRound)} />
          <Pressable style={styles.button} onPress={() => router.push(`/pools/${pool.id}`)}>
            <Text style={styles.buttonText}>View Pool</Text>
          </Pressable>
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
    fontSize: 20,
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
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 8,
    marginTop: 4,
    padding: 13
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700"
  }
});
