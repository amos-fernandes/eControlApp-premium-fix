import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { insertCredentials, insertUser } from "@/databases/database";

export interface Credentials {
  accessToken: string;
  client: string;
  uid: string;
  email?: string;
}

interface AuthContextValue {
  credentials: Credentials | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, baseUrl: string) => Promise<void>;
  loginWithCredentials: (creds: Credentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshCredentials: () => Promise<boolean>;
  baseUrl: string;
  setBaseUrl: (url: string) => Promise<void>;
  testConnection: (baseUrl: string) => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CREDENTIALS_KEY = "econtrole_credentials";
const BASE_URL_KEY = "econtrole_base_url";
const DEFAULT_BASE_URL = "https://testeaplicativo.econtrole.com";

// Devise Token Auth endpoint variations to try
const AUTH_PATHS = [
  "/api/auth/sign_in",         // Padrão eControle Pro (Recomendado v1.8.1)
  "/auth/sign_in",             // Fallback se a URL já tiver /api
  "/api/v1/auth/sign_in",      // REST standard com versão
  "/v1/auth/sign_in",
  "/users/sign_in",
  "/api/v1/users/sign_in",
];

async function performLogin(
  baseUrl: string,
  email: string,
  password: string
): Promise<{ accessToken: string; client: string; uid: string }> {
  let cleanBase = baseUrl.replace(/\/$/, "");
  let lastError: Error | null = null;

  for (const path of AUTH_PATHS) {
    const url = `${cleanBase}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // 404 means this path doesn't exist — try the next one
      if (response.status === 404) continue;

      // Parse body for error messages
      const body = await response.json().catch(() => ({}));

      if (response.status === 401 || response.status === 422) {
        throw new Error(
          body?.errors?.[0] ||
            body?.error ||
            body?.message ||
            "Credenciais inválidas. Verifique e-mail e senha."
        );
      }

      if (!response.ok) {
        throw new Error(
          body?.errors?.[0] ||
            body?.error ||
            body?.message ||
            `Erro do servidor: ${response.status}`
        );
      }

      // Try headers first (Devise Token Auth standard)
      const accessTokenHeader =
        response.headers.get("access-token") ||
        response.headers.get("Access-Token") ||
        response.headers.get("Authorization")?.replace("Bearer ", "") ||
        "";
      const clientHeader =
        response.headers.get("client") || response.headers.get("Client") || "";
      const uidHeader =
        response.headers.get("uid") || response.headers.get("Uid") || "";

      if (accessTokenHeader) {
        return {
          accessToken: accessTokenHeader,
          client: clientHeader,
          uid: uidHeader || email,
        };
      }

      // Fall back to body token (some API variants)
      const bodyToken =
        body?.access_token ||
        body?.token ||
        body?.auth_token ||
        body?.data?.access_token ||
        body?.data?.token ||
        "";

      if (bodyToken) {
        return {
          accessToken: bodyToken,
          client: body?.client || clientHeader || "",
          uid: body?.uid || uidHeader || email,
        };
      }

      // Logged in but no token found
      throw new Error(
        "Login bem-sucedido mas token não encontrado na resposta. Contate o suporte."
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new Error("Timeout ao conectar. Verifique a URL do servidor.");
        continue;
      }
      if (
        err instanceof TypeError &&
        (err.message.includes("Network request failed") ||
          err.message.includes("Failed to fetch"))
      ) {
        lastError = new Error(
          `Sem conexão com o servidor.\n\nVerifique:\n• A URL está correta?\n• Você tem internet?\n• O servidor está online?`
        );
        continue;
      }
      // Explicit auth errors — don't try other paths
      throw err;
    }
  }

  throw lastError || new Error(`Não foi possível conectar em ${cleanBase}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use ref to always access latest baseUrlState in callbacks without re-creating them
  const baseUrlRef = useRef(DEFAULT_BASE_URL);
  baseUrlRef.current = baseUrl;

  // Forward ref para refreshCredentials (será definido depois)
  const refreshCredentialsRef = useRef<() => Promise<boolean>>(
    async () => false
  );

  // ⏰ Refresh automático periódico (a cada 45 minutos)
  const scheduleAutoRefresh = useCallback(() => {
    // Limpa timer anterior se existir
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Agenda próximo refresh (45 minutos = 2700000ms)
    refreshTimerRef.current = setTimeout(async () => {
      console.log("[AuthContext] ⏰ Auto-refresh triggered (45min interval)");
      const success = await refreshCredentialsRef.current();
      if (success) {
        console.log("[AuthContext] ✅ Auto-refresh successful, scheduling next...");
        scheduleAutoRefresh(); // Agenda próximo
      } else {
        console.warn("[AuthContext] ❌ Auto-refresh failed - user may need to relogin");
      }
    }, 45 * 60 * 1000); // 45 minutos

    console.log("[AuthContext] ⏰ Auto-refresh scheduled for 45 minutes from now");
  }, []);

  // Limpa timer no unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        console.log("[AuthContext] 🧹 Auto-refresh timer cleared");
      }
    };
  }, []);

  // 🔥 Valida credenciais silenciosamente (GET /auth/validate_token)
  const validateTokenCredentials = useCallback(async (creds: Credentials, url: string): Promise<boolean> => {
    if (!creds || !url) return false;

    try {
      console.log("[AuthContext] 🔍 Validating token with server...");
      const validateUrl = `${url}/api/auth/validate_token`;
      const headers = {
        "Content-Type": "application/json",
        "access-token": creds.accessToken,
        client: creds.client,
        uid: creds.uid,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(validateUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) return false;
      if (!response.ok) return false;

      const newAccessToken = response.headers.get("access-token") || creds.accessToken;
      const newClient = response.headers.get("client") || creds.client;
      const newUid = response.headers.get("uid") || creds.uid;

      if (newAccessToken !== creds.accessToken || newClient !== creds.client) {
        creds.accessToken = newAccessToken;
        creds.client = newClient;
        creds.uid = newUid;
      }

      return true;
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("Network")) {
        return true; // Assume válido se offline
      }
      return false;
    }
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const [storedCreds, storedUrl] = await Promise.all([
          AsyncStorage.getItem(CREDENTIALS_KEY),
          AsyncStorage.getItem(BASE_URL_KEY),
        ]);

        let loadedCreds: Credentials | null = null;
        let loadedUrl: string = DEFAULT_BASE_URL;

        if (storedCreds) {
          try {
            const parsed = JSON.parse(storedCreds);
            if (parsed.accessToken && parsed.client && parsed.uid) {
              loadedCreds = parsed;
            }
          } catch (e) {}
        }

        if (!loadedCreds) {
          try {
            const { getCredentials } = require("@/databases/database");
            const sqliteCreds = getCredentials();
            if (sqliteCreds && sqliteCreds.accessToken) {
              loadedCreds = {
                accessToken: sqliteCreds.accessToken,
                client: sqliteCreds.client || '',
                uid: sqliteCreds.uid || '',
              };
            }
          } catch (e) {}
        }

        if (storedUrl) {
          // v1.8.1: NUNCA adicionar /api automaticamente
          loadedUrl = storedUrl.replace(/\/$/, "");
        }

        setBaseUrlState(loadedUrl);
        baseUrlRef.current = loadedUrl;

        if (loadedCreds) {
          const isValid = await validateTokenCredentials(loadedCreds, loadedUrl);
          if (!isValid) {
            await AsyncStorage.multiRemove([CREDENTIALS_KEY]);
            try {
              const db = require("@/databases/database").getDB();
              db.runSync('DELETE FROM credentials');
            } catch (e) {}
          } else {
            setCredentials(loadedCreds);
          }
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, [validateTokenCredentials]);

  const setBaseUrl = useCallback(async (url: string) => {
    // v1.8.1: NUNCA adicionar /api automaticamente
    let clean = url.replace(/\/$/, "");
    setBaseUrlState(clean);
    baseUrlRef.current = clean;
    await AsyncStorage.setItem(BASE_URL_KEY, clean);
    console.log("[AuthContext] Base URL updated to:", clean);
  }, []);

  const loginWithCredentials = useCallback(async (creds: Credentials) => {
    setCredentials(creds);
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    try {
      insertCredentials({
        _id: 'main',
        accessToken: creds.accessToken,
        uid: creds.uid,
        client: creds.client,
      });
      if (creds.email) {
        insertUser({
          _id: creds.uid || 'main',
          email: creds.email,
          name: creds.email.split('@')[0],
        });
      }
    } catch (e) {}
  }, []);

  const login = useCallback(
    async (email: string, password: string, apiBaseUrl: string) => {
      const { accessToken, client, uid } = await performLogin(
        apiBaseUrl,
        email,
        password
      );
      const creds: Credentials = { accessToken, client, uid, email };
      let cleanUrl = apiBaseUrl.replace(/\/$/, "");
      
      await Promise.all([
        AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds)),
        AsyncStorage.setItem(BASE_URL_KEY, cleanUrl),
      ]);
      setCredentials(creds);
      setBaseUrlState(cleanUrl);
      baseUrlRef.current = cleanUrl;
      
      try {
        insertCredentials({
          _id: 'main',
          accessToken,
          uid: uid || email,
          client,
        });
        insertUser({
          _id: uid || email,
          email,
          name: email.split('@')[0],
        });
      } catch (e) {}
    },
    []
  );

  const logout = useCallback(async () => {
    setCredentials(null);
    await AsyncStorage.multiRemove([CREDENTIALS_KEY]);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    try {
      const db = require("@/databases/database").getDB();
      db.runSync('DELETE FROM credentials');
      db.runSync('DELETE FROM users');
    } catch (e) {}
  }, []);

  const refreshCredentials = useCallback(async (): Promise<boolean> => {
    if (!credentials || !baseUrl) return false;

    try {
      const url = `${baseUrl}/api/auth/validate_token`;
      const headers = {
        "Content-Type": "application/json",
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 401) return false;
      if (!response.ok) return false;

      const newAccessToken = response.headers.get("access-token") || credentials.accessToken;
      const newClient = response.headers.get("client") || credentials.client;
      const newUid = response.headers.get("uid") || credentials.uid;

      const updatedCreds: Credentials = {
        accessToken: newAccessToken,
        client: newClient,
        uid: newUid,
        email: credentials.email,
      };

      setCredentials(updatedCreds);
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updatedCreds));

      insertCredentials({
        _id: 'main',
        accessToken: newAccessToken,
        uid: newUid,
        client: newClient,
      });

      return true;
    } catch (error: any) {
      return false;
    }
  }, [credentials, baseUrl]);

  useEffect(() => {
    refreshCredentialsRef.current = refreshCredentials;
  }, [refreshCredentials]);

  const testConnection = useCallback(
    async (testUrl: string): Promise<{ ok: boolean; message: string }> => {
      const cleanBase = testUrl.replace(/\/$/, "");
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`${cleanBase}/api/auth/sign_in`, {
          method: "GET", // Just to check if it's alive
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.status === 405 || response.status === 200 || response.status === 401 || response.status === 404) {
          return { ok: true, message: "Servidor acessível ✓" };
        }
        return { ok: false, message: `Servidor respondeu: ${response.status}` };
      } catch (err) {
        return { ok: false, message: "Não foi possível conectar" };
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      credentials,
      isLoading,
      isAuthenticated: !!credentials,
      login,
      loginWithCredentials,
      logout,
      refreshCredentials,
      baseUrl,
      setBaseUrl,
      testConnection,
    }),
    [
      credentials,
      isLoading,
      login,
      loginWithCredentials,
      logout,
      refreshCredentials,
      baseUrl,
      setBaseUrl,
      testConnection,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
