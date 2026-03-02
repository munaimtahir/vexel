import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";

type StatCardProps = {
  label: string;
  value: number | string;
};

export function StatCard({ label, value }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 96,
    justifyContent: "space-between",
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "700",
  },
});
