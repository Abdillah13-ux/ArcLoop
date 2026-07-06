import { StyleSheet, Text, View } from "react-native";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "Something went wrong", message }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    gap: 8
  },
  title: {
    color: "#991B1B",
    fontSize: 17,
    fontWeight: "700"
  },
  message: {
    color: "#7F1D1D",
    fontSize: 15,
    lineHeight: 22
  }
});
