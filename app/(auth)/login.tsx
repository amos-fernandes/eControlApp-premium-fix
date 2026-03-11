import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_BASE_URL = "https://gsambientais.econtrole.com/api";
const DEFAULT_EMAIL = "motoristaapp@econtrole.com";
const DEFAULT_PASSWORD = "ecomotoapp";
const CREDENTIALS_KEY = "econtrole_credentials";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login, testConnection } = useAuth();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setError("");
    setConnectionStatus(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password, baseUrl.trim() || DEFAULT_BASE_URL);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao autenticar.";
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    const result = await testConnection(baseUrl.trim() || DEFAULT_BASE_URL);
    setConnectionStatus(result);
    setIsTesting(false);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClearData = async () => {
    Alert.alert(
      "Limpar Dados Salvos",
      "Isso vai remover todas as credenciais salvas (AsyncStorage e SQLite) e reiniciar o app. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar",
          style: "destructive",
          onPress: async () => {
            try {
              // Limpa AsyncStorage
              await AsyncStorage.multiRemove([CREDENTIALS_KEY]);
              
              // Limpa SQLite
              const { getDB } = require("@/databases/database");
              const db = getDB();
              db.runSync('DELETE FROM credentials');
              db.runSync('DELETE FROM users');
              
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso", "Dados limpos! O app será recarregado.", [
                {
                  text: "OK",
                  onPress: () => {
                    router.replace("/");
                  }
                }
              ]);
            } catch (e) {
              console.error("Error clearing data:", e);
              Alert.alert("Erro", "Não foi possível limpar os dados.");
            }
          }
        }
      ]
    );
  };

  return (
    <LinearGradient
      colors={[Colors.primaryDark, "#142B1E", "#1B5E35"]}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="recycle" size={40} color="#4CAF50" />
            </View>
            <Text style={styles.appName}>eControle</Text>
            <Text style={styles.appSubtitle}>Gestão de Ordens de Serviço</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>Acesse sua conta</Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>E-mail</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="mail"
                  size={16}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="seu@email.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Senha</Text>
              <View style={styles.inputWrapper}>
                <Feather
                  name="lock"
                  size={16}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  onPress={() => setShowPassword((p) => !p)}
                  style={styles.eyeBtn}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={16}
                    color="#94A3B8"
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.advancedToggle}
              onPress={() => {
                setShowAdvanced((s) => !s);
                setConnectionStatus(null);
              }}
            >
              <Feather
                name={showAdvanced ? "chevron-up" : "chevron-down"}
                size={14}
                color="#94A3B8"
              />
              <Text style={styles.advancedText}>Configurações avançadas</Text>
            </Pressable>

            {showAdvanced ? (
              <View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>URL do servidor</Text>
                  <View style={styles.inputWrapper}>
                    <Feather
                      name="server"
                      size={16}
                      color="#94A3B8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder={DEFAULT_BASE_URL}
                      placeholderTextColor="#94A3B8"
                      value={baseUrl}
                      onChangeText={(t) => {
                        setBaseUrl(t);
                        setConnectionStatus(null);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.testBtn,
                    isTesting && styles.btnDisabled,
                  ]}
                  onPress={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Feather name="wifi" size={14} color={Colors.primary} />
                  )}
                  <Text style={styles.testBtnText}>
                    {isTesting ? "Testando..." : "Testar conexão"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.testBtn,
                    { borderColor: "#EF4444" }
                  ]}
                  onPress={handleClearData}
                >
                  <Feather name="trash-2" size={14} color="#EF4444" />
                  <Text style={[styles.testBtnText, { color: "#EF4444" }]}>
                    Limpar dados salvos
                  </Text>
                </Pressable>

                {connectionStatus ? (
                  <View
                    style={[
                      styles.connectionBadge,
                      {
                        backgroundColor: connectionStatus.ok
                          ? "#DCFCE7"
                          : "#FEE2E2",
                      },
                    ]}
                  >
                    <Feather
                      name={connectionStatus.ok ? "check-circle" : "x-circle"}
                      size={14}
                      color={connectionStatus.ok ? "#16A34A" : "#DC2626"}
                    />
                    <Text
                      style={[
                        styles.connectionText,
                        {
                          color: connectionStatus.ok ? "#15803D" : "#991B1B",
                        },
                      ]}
                    >
                      {connectionStatus.message}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.urlHints}>
                  <Text style={styles.urlHintTitle}>URLs comuns:</Text>
                  {[
                    "https://testeaplicativo.econtrole.com/login",
                    "https://app.econtrole.com",
                    "https://api.econtrole.com",
                    "https://econtrole.com.br",
                  ].map((url) => (
                    <Pressable
                      key={url}
                      onPress={() => {
                        setBaseUrl(url);
                        setConnectionStatus(null);
                      }}
                    >
                      <Text style={styles.urlHintItem}>{url}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              style={[styles.loginBtn, isLoading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>Entrar</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.qrBtn}
              onPress={() => router.push("/qrscanner")}
            >
              <Feather name="camera" size={16} color={Colors.primary} />
              <Text style={styles.qrBtnText}>Entrar com QR Code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  appName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F1F17",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: "#991B1B",
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A6357",
    marginBottom: 6,
    fontFamily: "Inter_600SemiBold",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAF9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE8E0",
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: "#0F1F17",
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: { padding: 4 },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  advancedText: {
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: "Inter_400Regular",
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  testBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  connectionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  urlHints: { marginBottom: 16 },
  urlHintTitle: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  urlHintItem: {
    fontSize: 12,
    color: Colors.primary,
    fontFamily: "Inter_400Regular",
    paddingVertical: 4,
    textDecorationLine: "underline",
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE8E0",
  },
  qrBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
