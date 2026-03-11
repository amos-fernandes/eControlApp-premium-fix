import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

export default function IndexScreen() {
  const { isAuthenticated, isLoading, credentials } = useAuth();

  useEffect(() => {
    console.log("[IndexScreen] isLoading:", isLoading, "isAuthenticated:", isAuthenticated, "hasCredentials:", !!credentials);
    if (isLoading) return;
    if (isAuthenticated) {
      console.log("[IndexScreen] Redirecting to tabs");
      router.replace("/(tabs)");
    } else {
      console.log("[IndexScreen] Redirecting to login");
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, isLoading, credentials]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={{ color: '#fff', marginTop: 20 }}>Carregando...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primaryDark,
  },
});
