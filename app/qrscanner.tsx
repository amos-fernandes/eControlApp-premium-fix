import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import type { Credentials } from "@/context/AuthContext";

// Base64 decode for React Native
function atobPolyfill(str: string): string {
  try {
    // React Native has atob globally
    if (typeof atob === "function") {
      return atob(str);
    }
    // Fallback using Buffer (Node.js)
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "base64").toString("utf-8");
    }
    // Fallback using built-in React Native global
    return global.atob(str);
  } catch (e) {
    throw new Error("Base64 decode failed");
  }
}

const DEFAULT_BASE_URL = "https://gsambientais.econtrole.com/api";

// ─── What the QR code can contain ─────────────────────────────────────────────
type QRResult =
  | { type: "credentials"; email: string; password: string; baseUrl?: string }
  | { type: "token"; creds: Credentials; baseUrl?: string }
  | { type: "subdomain"; subdomain: string }
  | { type: "unknown" };

// ─── Universal QR parser ───────────────────────────────────────────────────────
function parseQR(raw: string): QRResult {
  const data = raw.trim();
  console.log("[QRScanner] Raw data:", data);

  // ── 0. Base64 detection (common in QR codes) ─────────────────────────────────
  // Try to decode if it looks like Base64
  if (/^[A-Za-z0-9+/]+=*$/.test(data) && data.length > 4) {
    try {
      const decoded = atobPolyfill(data);
      console.log("[QRScanner] Base64 detected, decoded:", decoded);
      
      // Check if decoded contains credentials info
      if (decoded.includes("@") && (decoded.includes(":") || decoded.includes(";"))) {
        // Format: email:password or email;password
        const parts = decoded.split(/[:;]/);
        if (parts.length >= 2 && parts[0].includes("@")) {
          console.log("[QRScanner] Base64 credentials detected");
          return {
            type: "credentials",
            email: parts[0].trim(),
            password: parts.slice(1).join("").trim(),
          };
        }
      }
      
      // If decoded is just a subdomain (like "gsambientais")
      if (decoded.length > 3 && !decoded.includes(" ") && !decoded.includes("@")) {
        console.log("[QRScanner] Base64 subdomain detected:", decoded);
        // Return as subdomain that will be used to build URL
        return {
          type: "subdomain",
          subdomain: decoded,
        };
      }
      
      // Try parsing decoded as JSON
      return parseQR(decoded);
    } catch (e) {
      console.log("[QRScanner] Base64 decode failed:", e);
    }
  }

  // ── 1. JSON object ──────────────────────────────────────────────────────────
  try {
    const p = JSON.parse(data);
    console.log("[QRScanner] Parsed JSON:", p);
    if (p && typeof p === "object") {
      // credentials style: {login, senha} / {email, password} / {usuario, senha}
      const email =
        p.login || p.email || p.usuario || p.user_email || p.username || "";
      const password =
        p.senha || p.password || p.pass || p.secret || p.pwd || "";
      if (email && password) {
        console.log("[QRScanner] Detected credentials format");
        return {
          type: "credentials",
          email: String(email).trim(),
          password: String(password).trim(),
          baseUrl: p.base_url || p.baseUrl || p.server || p.url || undefined,
        };
      }
      // token style: {access_token, token, ...}
      const token =
        p.access_token || p.accessToken || p.token || p.auth_token || p.authToken || "";
      const client = p.client || p.client_id || "";
      const uid = p.uid || p.email || p.login || p.usuario || "";
      if (token) {
        console.log("[QRScanner] Detected token format");
        return {
          type: "token",
          creds: { accessToken: String(token), client: String(client), uid: String(uid), email: String(uid) },
          baseUrl: p.base_url || p.baseUrl || p.server || undefined,
        };
      }
    }
  } catch (e) {
    console.log("[QRScanner] Not JSON:", e);
    // not JSON
  }

  // ── 2. Plain text "login: X\nsenha: Y" (or "email: X\npassword: Y") ─────────
  // Also handles "login:X senha:Y" on one line, with comma, with semicolon, etc.
  const normalized = data.replace(/\r/g, "\n");

  const emailMatch = normalized.match(
    /(?:login|e-?mail|usuario|user(?:name)?)\s*[:=]\s*([^\n,;]+)/i
  );
  const passwordMatch = normalized.match(
    /(?:senha|password|pass|pwd|secret)\s*[:=]\s*([^\n,;]+)/i
  );
  if (emailMatch && passwordMatch) {
    console.log("[QRScanner] Detected plain text credentials");
    return {
      type: "credentials",
      email: emailMatch[1].trim(),
      password: passwordMatch[1].trim(),
    };
  }

  // ── 3. URL with query params ─────────────────────────────────────────────────
  try {
    const url = new URL(data);
    const p = url.searchParams;
    const email = p.get("login") || p.get("email") || p.get("usuario") || "";
    const password = p.get("senha") || p.get("password") || p.get("pass") || "";
    if (email && password) {
      console.log("[QRScanner] Detected URL credentials");
      return { type: "credentials", email, password, baseUrl: url.origin };
    }
    const token = p.get("access_token") || p.get("token") || p.get("auth_token") || "";
    const uid = p.get("uid") || p.get("email") || "";
    const client = p.get("client") || "";
    if (token) {
      console.log("[QRScanner] Detected URL token");
      return {
        type: "token",
        creds: { accessToken: token, client, uid, email: uid },
        baseUrl: url.origin,
      };
    }
  } catch {
    // not a URL
  }

  // ── 4. Semicolon or comma separated: email;password ──────────────────────────
  const separators = [";", "|"];
  for (const sep of separators) {
    if (data.includes(sep)) {
      const parts = data.split(sep).map((s) => s.trim());
      if (parts.length >= 2 && parts[0].includes("@")) {
        console.log("[QRScanner] Detected separator format");
        return { type: "credentials", email: parts[0], password: parts[1] };
      }
    }
  }

  // ── 5. Raw token (long string, no spaces) ────────────────────────────────────
  if (data.length > 30 && !data.includes(" ") && !data.includes("\n")) {
    console.log("[QRScanner] Detected raw token");
    return {
      type: "token",
      creds: { accessToken: data, client: "", uid: "", email: "" },
    };
  }

  // ── 6. Subdomain only (short text without special chars) ─────────────────────
  if (data.length > 3 && data.length < 50 && /^[a-zA-Z0-9_-]+$/.test(data)) {
    console.log("[QRScanner] Detected subdomain format");
    return {
      type: "subdomain",
      subdomain: data,
    };
  }

  console.log("[QRScanner] Unknown format");
  return { type: "unknown" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function QRScannerScreen() {
  const insets = useSafeAreaInsets();
  const { login, loginWithCredentials, setBaseUrl, baseUrl } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rawData, setRawData] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const cooldown = useRef(false);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Feather name="camera-off" size={48} color="#94A3B8" />
        <Text style={styles.permissionTitle}>Câmera necessária</Text>
        <Text style={styles.permissionText}>
          Precisamos da câmera para escanear o QR Code de autenticação.
        </Text>
        <Pressable style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Permitir câmera</Text>
        </Pressable>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar ao login</Text>
        </Pressable>
      </View>
    );
  }

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanned || cooldown.current) return;
    cooldown.current = true;
    setScanned(true);
    setError("");
    setRawData(data);

    console.log("[QRScanner] Scan started, data length:", data.length);
    const result = parseQR(data);
    console.log("[QRScanner] Parse result:", result);

    if (result.type === "credentials") {
      // QR contains email + password → do a real API login
      console.log("[QRScanner] Authenticating with credentials...");
      setIsLogging(true);
      setStatus(`Autenticando como ${result.email}...`);
      try {
         const serverUrl = result.baseUrl || baseUrl || DEFAULT_BASE_URL;
        console.log("[QRScanner] Using server URL:", serverUrl);
        if (result.baseUrl) {
          let cleanUrl = result.baseUrl.replace(/\/$/, "");
          if (!cleanUrl.endsWith("/api")) {
            cleanUrl = cleanUrl + "/api";
          }
          await setBaseUrl(cleanUrl);
        }
        await login(result.email, result.password, serverUrl);
        console.log("[QRScanner] Login successful!");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch (err: unknown) {
        console.error("[QRScanner] Login error:", err);
        const msg = err instanceof Error ? err.message : "Erro ao autenticar.";
        setError(msg);
        setIsLogging(false);
        setStatus("");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          cooldown.current = false;
          setScanned(false);
        }, 3000);
      }
    } else if (result.type === "token") {
      // QR contains a direct auth token
      console.log("[QRScanner] Authenticating with token...");
      console.log("[QRScanner] Token:", result.creds.accessToken.substring(0, 20) + "...");
      setIsLogging(true);
      setStatus("Autenticando com token...");
      try {
        if (result.baseUrl) {
          await setBaseUrl(result.baseUrl);
        }
        console.log("[QRScanner] Using credentials:", result.creds);
        await loginWithCredentials(result.creds);
        console.log("[QRScanner] Token auth successful!");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } catch (err: unknown) {
        console.error("[QRScanner] Token auth error:", err);
        const msg = err instanceof Error ? err.message : "Erro ao autenticar.";
        setError(msg);
        setIsLogging(false);
        setStatus("");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          cooldown.current = false;
          setScanned(false);
        }, 3000);
      }
    } else if (result.type === "subdomain") {
      // QR contains only subdomain - set URL and show login screen
      console.log("[QRScanner] Subdomain detected:", result.subdomain);
      setIsLogging(true);
      setStatus(`Configurando servidor: ${result.subdomain}...`);
      try {
        // Build URL from subdomain
        const subdomain = result.subdomain.toLowerCase().trim();
        let serverUrl = `https://${subdomain}.econtrole.com`;
        console.log("[QRScanner] Building URL:", serverUrl);
        
        let cleanUrl = serverUrl.replace(/\/$/, "");
        if (!cleanUrl.endsWith("/api")) {
          cleanUrl = cleanUrl + "/api";
        }
        
        await setBaseUrl(cleanUrl);
        console.log("[QRScanner] URL set to:", cleanUrl);
        
        // Show success and go to login screen to enter credentials
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStatus(`Servidor configurado! Faça login.`);
        
        setTimeout(() => {
          setIsLogging(false);
          setStatus("");
          // Go to login screen instead of main app
          router.replace("/(auth)/login");
        }, 1500);
      } catch (err: unknown) {
        console.error("[QRScanner] Subdomain config error:", err);
        const msg = err instanceof Error ? err.message : "Erro ao configurar servidor.";
        setError(msg);
        setIsLogging(false);
        setStatus("");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          cooldown.current = false;
          setScanned(false);
        }, 3000);
      }
    } else {
      // Unknown format — show raw data
      console.log("[QRScanner] Unknown format");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError("Formato não reconhecido. Toque para ver os dados brutos.");
      setShowRaw(true);
      setTimeout(() => {
        cooldown.current = false;
        setScanned(false);
      }, 3000);
    }
  };

  const reset = () => {
    setScanned(false);
    setError("");
    setRawData(null);
    setStatus("");
    setIsLogging(false);
    cooldown.current = false;
  };

  return (
    <View style={styles.container}>
      {Platform.OS !== "web" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webPlaceholder]}>
          <Feather name="camera" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.webText}>Scanner disponível apenas no dispositivo móvel</Text>
          <Text style={styles.webSubText}>
            Abra o app no celular via Expo Go para usar a câmera
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Escanear QR Code</Text>
        <Text style={styles.subtitle}>Aponte para o QR Code do eControle</Text>
      </View>

      {/* Scan frame */}
      <View style={styles.scanArea}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>

      {/* Status / loading overlay */}
      {isLogging ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.loadingText}>{status}</Text>
          </View>
        </View>
      ) : null}

      {/* Error banner */}
      {error && !isLogging ? (
        <Pressable style={styles.errorBanner} onPress={() => setShowRaw(true)}>
          <Feather name="alert-circle" size={16} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
        </Pressable>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {!isLogging ? (
          <>
            <Pressable style={styles.retryBtn} onPress={reset}>
              <Feather name="refresh-cw" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
            <Pressable style={styles.manualBtn} onPress={() => router.back()}>
              <Text style={styles.manualBtnText}>Login com e-mail</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Raw data modal */}
      <Modal
        visible={showRaw}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRaw(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dados do QR Code</Text>
              <Pressable onPress={() => setShowRaw(false)}>
                <Feather name="x" size={22} color="#475569" />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              O QR Code foi lido mas o formato não foi reconhecido. Estes são os dados brutos:
            </Text>
            <ScrollView style={styles.rawScroll}>
              <Text selectable style={styles.rawText}>
                {rawData || "Sem dados"}
              </Text>
            </ScrollView>
            <Text style={styles.modalHint}>
              Envie estes dados para o suporte para identificar o formato correto.
            </Text>
            <Pressable
              style={styles.modalClose}
              onPress={() => {
                setShowRaw(false);
                reset();
              }}
            >
              <Text style={styles.modalCloseText}>Tentar escanear novamente</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
    backgroundColor: "#0D2E1C",
  },
  webPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D2E1C",
    gap: 12,
    padding: 32,
  },
  webText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
  webSubText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  permissionText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  permBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  permBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  backBtn: { paddingVertical: 10 },
  backBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginTop: 48,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  scanArea: {
    position: "absolute",
    width: 240,
    height: 240,
    top: "50%",
    left: "50%",
    marginTop: -120,
    marginLeft: -120,
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: Colors.accent,
    borderWidth: 3,
  },
  topLeft: {
    top: 0, left: 0,
    borderRightWidth: 0, borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0, right: 0,
    borderLeftWidth: 0, borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderRightWidth: 0, borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderLeftWidth: 0, borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    minWidth: 200,
  },
  loadingText: {
    fontSize: 14,
    color: "#334155",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorBanner: {
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    backgroundColor: "#DC2626",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  errorText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    padding: 20,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  manualBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  manualBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F1F17",
    fontFamily: "Inter_700Bold",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 12,
  },
  rawScroll: {
    backgroundColor: "#F8FAF9",
    borderRadius: 12,
    padding: 14,
    maxHeight: 180,
    marginBottom: 12,
  },
  rawText: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
    color: "#334155",
    lineHeight: 18,
  },
  modalHint: {
    fontSize: 12,
    color: "#94A3B8",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 16,
  },
  modalClose: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  modalCloseText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
