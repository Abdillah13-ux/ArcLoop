import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>ArcLoop</Text>
      <Text style={styles.subtitle}>
        Mobile-first rotating USDC savings pools on Arc
      </Text>
      <Text style={styles.phase}>Repository bootstrap phase</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC"
  },
  title: {
    color: "#0F172A",
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 12
  },
  subtitle: {
    color: "#334155",
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 20
  },
  phase: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase"
  }
});
