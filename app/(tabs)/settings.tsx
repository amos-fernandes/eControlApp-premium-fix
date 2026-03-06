import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useTheme } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        {icon}
        <Text
          style={[
            styles.rowLabel,
            { color: danger ? "#EF4444" : theme.text },
          ]}
        >
          {label}
        </Text>
      </View>
      {value ? (
        <Text style={[styles.rowValue, { color: theme.textMuted }]}>{value}</Text>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={16} color={theme.textMuted} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { credentials, baseUrl, setBaseUrl, logout } = useAuth();
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState(baseUrl);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleSaveUrl = async () => {
    if (urlInput.trim()) {
      await setBaseUrl(urlInput.trim());
      setEditingUrl(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding + 12,
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.text }]}>Configurações</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.profileCard}
        >
          <View style={styles.avatarContainer}>
            <MaterialCommunityIcons name="account" size={36} color="#fff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileEmail}>
              {credentials?.email || credentials?.uid || "Usuário"}
            </Text>
            <Text style={styles.profileRole}>eControle App</Text>
          </View>
        </LinearGradient>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>CONTA</Text>

          <SettingRow
            icon={<Feather name="user" size={18} color={theme.textSecondary} />}
            label="Usuário"
            value={credentials?.uid || "—"}
          />
          <SettingRow
            icon={<Feather name="key" size={18} color={theme.textSecondary} />}
            label="Token de acesso"
            value={credentials?.accessToken ? "••••••••" : "Não configurado"}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SERVIDOR</Text>

          {editingUrl ? (
            <View style={styles.urlEditor}>
              <TextInput
                style={[
                  styles.urlInput,
                  {
                    backgroundColor: isDark ? theme.surfaceSecondary : "#F8FAF9",
                    color: theme.text,
                    borderColor: Colors.primary,
                  },
                ]}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://app.econtrole.com"
                placeholderTextColor={theme.textMuted}
              />
              <View style={styles.urlActions}>
                <Pressable
                  style={[styles.urlBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setUrlInput(baseUrl);
                    setEditingUrl(false);
                  }}
                >
                  <Text style={[styles.urlBtnText, { color: theme.textSecondary }]}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.urlBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                  onPress={handleSaveUrl}
                >
                  <Text style={[styles.urlBtnText, { color: "#fff" }]}>Salvar</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <SettingRow
              icon={<Feather name="server" size={18} color={theme.textSecondary} />}
              label="URL do servidor"
              value={baseUrl || "—"}
              onPress={() => {
                setUrlInput(baseUrl);
                setEditingUrl(true);
              }}
            />
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>SOBRE</Text>
          <SettingRow
            icon={<Feather name="info" size={18} color={theme.textSecondary} />}
            label="Versão"
            value="1.0.0"
          />
          <SettingRow
            icon={<MaterialCommunityIcons name="recycle" size={18} color={theme.textSecondary} />}
            label="eControle App"
            value="Gestão de OS"
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            icon={<Feather name="log-out" size={18} color="#EF4444" />}
            label="Sair da conta"
            onPress={handleLogout}
            danger
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  content: { padding: 16, gap: 16 },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: { flex: 1 },
  profileEmail: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  profileRole: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  section: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    maxWidth: 160,
    textAlign: "right",
  },
  urlEditor: {
    padding: 14,
    gap: 10,
  },
  urlInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  urlActions: {
    flexDirection: "row",
    gap: 10,
  },
  urlBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  urlBtnText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
