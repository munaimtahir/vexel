import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { getOpdStatusMock } from "../../src/api/client";
import { StatCard } from "../../src/components/StatCard";
import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

export default function OpdDashboardScreen() {
  const data = useMemo(() => getOpdStatusMock(), []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OPD Dashboard</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Coming soon</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Today Appointments" value={data.todayAppointments} />
        <StatCard label="Queue" value={data.queue} />
        <StatCard label="Revenue" value={data.revenue} />
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
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  badgeText: {
    color: colors.accent,
    fontWeight: "600",
  },
  grid: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
});
