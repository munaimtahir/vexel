import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getLimsStatusMock } from "../../src/api/client";
import { StatCard } from "../../src/components/StatCard";
import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

export default function LimsStatusScreen() {
  const data = useMemo(() => getLimsStatusMock(), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LIMS Status</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Module Enabled: Yes</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Pending Results" value={data.pendingResults} />
        <StatCard label="Pending Verification" value={data.pendingVerification} />
        <StatCard label="Failed Documents" value={data.failedDocuments} />
        <StatCard label="Published Today" value={data.publishedToday} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.round,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  badgeText: {
    color: colors.successText,
    fontWeight: "600",
  },
  grid: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
