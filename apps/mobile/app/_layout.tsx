import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#F8FAFC"
        },
        headerTintColor: "#0F172A",
        headerTitleStyle: {
          fontWeight: "700"
        }
      }}
    >
      <Stack.Screen name="index" options={{ title: "ArcLoop" }} />
      <Stack.Screen name="contracts" options={{ title: "Contract" }} />
      <Stack.Screen name="pools/index" options={{ title: "Pools" }} />
      <Stack.Screen name="pools/[id]" options={{ title: "Pool Detail" }} />
      <Stack.Screen name="invites/[inviteCode]" options={{ title: "Invite" }} />
    </Stack>
  );
}
