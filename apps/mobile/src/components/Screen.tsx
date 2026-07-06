import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ children, scroll = true }: ScreenProps) {
  if (!scroll) {
    return <View style={styles.container}>{children}</View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14
  }
});
