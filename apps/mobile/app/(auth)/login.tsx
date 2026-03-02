import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../src/theme/colors";
import { spacing, radius } from "../../src/theme/spacing";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vexel Mobile</Text>
      <Text style={styles.subtitle}>Continue with demo mode for v0.</Text>
      <Pressable onPress={() => router.replace("/")} style={styles.button}>
        <Text style={styles.buttonText}>Continue in Demo Mode</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});
