import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";

export default function NotFoundScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <Feather name="alert-triangle" size={48} color={theme.textMuted} />
      <Text style={[styles.title, { color: theme.text }]}>Página não encontrada</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Esta rota não existe.
      </Text>
      <Pressable
        style={[styles.btn, { backgroundColor: Colors.primary }]}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text style={styles.btnText}>Ir para o início</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
