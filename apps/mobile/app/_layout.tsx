import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";

import { colors } from "../src/theme/colors";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: "Login" }} />
        <Stack.Screen name="lims/status" options={{ title: "LIMS" }} />
        <Stack.Screen name="opd/dashboard" options={{ title: "OPD" }} />
      </Stack>
    </>
  );
}
