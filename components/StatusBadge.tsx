import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/constants/theme";

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  "Em conferência": { bg: "#FEF3C7", text: "#92400E", label: "Em Conferência" },
  "Iniciada": { bg: "#DBEAFE", text: "#1E40AF", label: "Iniciada" },
  "Concluída": { bg: "#DCFCE7", text: "#166534", label: "Concluída" },
  "Cancelada": { bg: "#FEE2E2", text: "#991B1B", label: "Cancelada" },
  "Pendente": { bg: "#F1F5F9", text: "#475569", label: "Pendente" },
};

const STATUS_CONFIG_DARK: Record<string, { bg: string; text: string }> = {
  "Em conferência": { bg: "#451A03", text: "#FDE68A" },
  "Iniciada": { bg: "#172554", text: "#93C5FD" },
  "Concluída": { bg: "#052E16", text: "#86EFAC" },
  "Cancelada": { bg: "#450A0A", text: "#FCA5A5" },
  "Pendente": { bg: "#1E293B", text: "#94A3B8" },
};

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const { isDark } = useTheme();

  const config = STATUS_CONFIG[status] || STATUS_CONFIG["Pendente"];
  const darkConfig = STATUS_CONFIG_DARK[status] || STATUS_CONFIG_DARK["Pendente"];

  const bg = isDark ? darkConfig.bg : config.bg;
  const textColor = isDark ? darkConfig.text : config.text;
  const label = config.label;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.text, { color: textColor }, small && styles.smallText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  smallText: {
    fontSize: 10,
  },
});
