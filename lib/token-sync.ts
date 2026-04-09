/**
 * TokenSync - Gerenciamento centralizado de refresh de token
 * Evita race conditions e garante que apenas um refresh ocorra por vez
 * 
 * FIX v2: Remove MIN_REFRESH_INTERVAL que causava loop infinito
 */

import { getCredentials, insertCredentials } from "@/databases/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CREDENTIALS_KEY = "econtrole_credentials";

interface RefreshState {
  isRefreshing: boolean;
  lastRefreshSuccess: number;
  consecutiveFailures: number;
  pendingResolves: Array<(success: boolean) => void>;
}

const state: RefreshState = {
  isRefreshing: false,
  lastRefreshSuccess: 0,
  consecutiveFailures: 0,
  pendingResolves: [],
};

// Cache de credenciais em memória
let cachedCredentials: {
  accessToken: string;
  client: string;
  uid: string;
  email?: string;
} | null = null;

// Máximo de falhas consecutivas antes de desistir
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Obtém credenciais atuais (cache ou storage)
 */
export async function getCurrentCredentials(): Promise<typeof cachedCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  try {
    // Tenta AsyncStorage primeiro
    const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.accessToken && parsed.client && parsed.uid) {
        cachedCredentials = parsed;
        return cachedCredentials;
      }
    }

    // Fallback SQLite
    const sqliteCreds = getCredentials();
    if (sqliteCreds?.accessToken) {
      cachedCredentials = {
        accessToken: sqliteCreds.accessToken,
        client: sqliteCreds.client || '',
        uid: sqliteCreds.uid || '',
      };
      return cachedCredentials;
    }
  } catch (error) {
    console.error("[TokenSync] Error getting credentials:", error);
  }

  return null;
}

/**
 * Atualiza cache de credenciais
 */
function updateCredentialsCache(creds: typeof cachedCredentials) {
  cachedCredentials = creds;
}

/**
 * Realiza refresh do token (single-flight - apenas um refresh por vez)
 * FIX: Sempre tenta refresh quando chamado, sem intervalo mínimo
 */
export async function refreshAuthToken(baseUrl: string): Promise<boolean> {
  // Se já está refreshando, espera o resultado
  if (state.isRefreshing) {
    console.log("[TokenSync] Refresh already in progress, waiting...");
    return new Promise((resolve) => {
      state.pendingResolves.push(resolve);
    });
  }

  // Verifica se excedeu falhas consecutivas
  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.error(`[TokenSync] ❌ Max consecutive failures (${MAX_CONSECUTIVE_FAILURES}) reached`);
    return false;
  }

  state.isRefreshing = true;
  console.log(`[TokenSync] 🔄 Starting token refresh... (failures: ${state.consecutiveFailures})`);

  try {
    const credentials = await getCurrentCredentials();
    if (!credentials) {
      console.error("[TokenSync] ❌ No credentials to refresh");
      throw new Error("NO_CREDENTIALS");
    }

    const validateUrl = `${baseUrl}/auth/validate_token`;
    const headers = {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    };

    console.log("[TokenSync] URL:", validateUrl);
    console.log("[TokenSync] Token (partial):", credentials.accessToken.substring(0, 10) + "...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(validateUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    console.log("[TokenSync] Response status:", response.status);

    if (response.status === 401) {
      console.error("[TokenSync] ❌ Token expired (401) - server rejected");
      state.consecutiveFailures++;
      throw new Error("TOKEN_EXPIRED");
    }

    if (!response.ok) {
      console.error("[TokenSync] ❌ Refresh failed:", response.status);
      state.consecutiveFailures++;
      throw new Error(`REFRESH_FAILED: ${response.status}`);
    }

    // Pega novos headers da resposta
    const newAccessToken = response.headers.get("access-token") || credentials.accessToken;
    const newClient = response.headers.get("client") || credentials.client;
    const newUid = response.headers.get("uid") || credentials.uid;

    const updatedCreds = {
      accessToken: newAccessToken,
      client: newClient,
      uid: newUid,
      email: credentials.email,
    };

    // Atualiza cache em memória
    updateCredentialsCache(updatedCreds);

    // Salva em AsyncStorage
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updatedCreds));

    // Salva em SQLite
    insertCredentials({
      _id: 'main',
      accessToken: newAccessToken,
      uid: newUid,
      client: newClient,
    });

    // SUCESSO - reseta contadores
    state.lastRefreshSuccess = Date.now();
    state.consecutiveFailures = 0;
    
    console.log("[TokenSync] ✅ Token refreshed successfully");
    console.log("[TokenSync] New token (partial):", newAccessToken.substring(0, 10) + "...");

    // Resolve todas as promises pendentes
    state.pendingResolves.forEach(resolve => resolve(true));
    state.pendingResolves = [];

    return true;
  } catch (error: any) {
    console.error("[TokenSync] ❌ Refresh error:", error.message);

    // Resolve todas as promises pendentes com false
    state.pendingResolves.forEach(resolve => resolve(false));
    state.pendingResolves = [];

    return false;
  } finally {
    state.isRefreshing = false;
  }
}

/**
 * Força limpeza do cache (ex: no logout)
 */
export function clearTokenCache() {
  cachedCredentials = null;
  state.isRefreshing = false;
  state.lastRefreshSuccess = 0;
  state.consecutiveFailures = 0;
  state.pendingResolves = [];
  console.log("[TokenSync] 🧹 Token cache cleared");
}

/**
 * Obtém o timestamp do último refresh com sucesso
 */
export function getLastRefreshTime(): number {
  return state.lastRefreshSuccess;
}

/**
 * Obtém número de falhas consecutivas (para debug)
 */
export function getConsecutiveFailures(): number {
  return state.consecutiveFailures;
}
