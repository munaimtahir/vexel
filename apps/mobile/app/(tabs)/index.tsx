import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../../src/theme/colors";
import { radius, spacing } from "../../src/theme/spacing";

type TileProps = {
  title: string;
  subtitle: string;
  iconName: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
};

function ModuleTile({ title, subtitle, iconName, onPress }: TileProps) {
  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <View style={styles.tileIconWrap}>
        <MaterialCommunityIcons color={colors.accent} name={iconName} size={28} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vexel Health</Text>
      <Text style={styles.subtitle}>Select a module</Text>

      <View style={styles.tiles}>
        <ModuleTile
          iconName="flask-outline"
          onPress={() => router.push("/lims/status")}
          subtitle="Lab operations snapshot"
          title="LIMS"
        />
        <ModuleTile
          iconName="stethoscope"
          onPress={() => router.push("/opd/dashboard")}
          subtitle="Clinic queue and appointments"
          title="OPD"
        />
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
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  tiles: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 140,
  },
  tileIconWrap: {
    height: 44,
    width: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    marginTop: spacing.md,
    fontWeight: "700",
  },
  tileSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
});
