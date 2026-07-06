import { StyleSheet, Text, View } from "react-native";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    gap: 8
  },
  title: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700"
  },
  message: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 22
  }
});
