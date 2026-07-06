import { StyleSheet, Text, View } from "react-native";

type StatusPillProps = {
  status: string;
};

const colorByStatus: Record<string, { backgroundColor: string; color: string }> = {
  created: { backgroundColor: "#E0F2FE", color: "#075985" },
  active: { backgroundColor: "#DCFCE7", color: "#166534" },
  completed: { backgroundColor: "#F1F5F9", color: "#334155" },
  cancelled: { backgroundColor: "#FEE2E2", color: "#991B1B" }
};

export function StatusPill({ status }: StatusPillProps) {
  const colors = colorByStatus[status.toLowerCase()] ?? {
    backgroundColor: "#E2E8F0",
    color: "#334155"
  };

  return (
    <View style={[styles.pill, { backgroundColor: colors.backgroundColor }]}>
      <Text style={[styles.text, { color: colors.color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  }
});
