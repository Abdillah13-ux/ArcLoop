import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#2563EB" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 10,
    padding: 24
  },
  message: {
    color: "#475569",
    fontSize: 15
  }
});
