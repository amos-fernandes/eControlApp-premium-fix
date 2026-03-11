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
const DEFAULT_BASE_URL = "https://gsambientais.econtrole.com/api";

// Devise Token Auth endpoint variations to try
const AUTH_PATHS = [
  "/auth/sign_in",             // eControle Pro standard (URL base já tem /api)
  "/v1/auth/sign_in",          // REST standard com versão
  "/api/auth/sign_in",         // Fallback para URLs base sem /api
  "/api/v1/auth/sign_in",      // Fallback para URLs base sem /api
  "/users/sign_in",
  "/api/v1/users/sign_in",
];

async function performLogin(
  baseUrl: string,
  email: string,
  password: string
): Promise<{ accessToken: string; client: string; uid: string }> {
  let cleanBase = baseUrl.replace(/\/$/, "");
  // Garante que a URL base sempre termine com /api (padrão eControle Pro)
  if (!cleanBase.endsWith("/api")) {
    cleanBase = cleanBase + "/api";
  }
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

  // Use ref to always access latest baseUrlState in callbacks without re-creating them
  const baseUrlRef = useRef(DEFAULT_BASE_URL);
  baseUrlRef.current = baseUrl;

  useEffect(() => {
    const loadSession = async () => {
      try {
        const [storedCreds, storedUrl] = await Promise.all([
          AsyncStorage.getItem(CREDENTIALS_KEY),
          AsyncStorage.getItem(BASE_URL_KEY),
        ]);
        console.log("[AuthContext] Loaded storedCreds:", storedCreds ? "EXISTS" : "NULL");
        console.log("[AuthContext] Loaded storedUrl:", storedUrl);
        
        // Tenta primeiro AsyncStorage
        if (storedCreds) {
          try {
            const parsed = JSON.parse(storedCreds);
            console.log("[AuthContext] Parsed credentials:", {
              hasToken: !!parsed.accessToken,
              hasClient: !!parsed.client,
              hasUid: !!parsed.uid,
              tokenLength: parsed.accessToken?.length
            });
            
            // Valida se tem TODOS os campos necessários
            if (parsed.accessToken && parsed.accessToken.length > 10 && 
                parsed.client && parsed.uid) {
              console.log("[AuthContext] Valid credentials found in AsyncStorage");
              setCredentials(parsed);
            } else {
              console.log("[AuthContext] Incomplete credentials in AsyncStorage - trying SQLite");
            }
          } catch (e) {
            console.log("[AuthContext] Corrupted credentials in AsyncStorage - trying SQLite", e);
          }
        }
        
        // Fallback: Tenta buscar do SQLite
        if (!credentials) {
          try {
            const { getCredentials } = require("@/databases/database");
            const sqliteCreds = getCredentials();
            console.log("[AuthContext] SQLite credentials:", sqliteCreds);
            
            if (sqliteCreds && sqliteCreds.accessToken) {
              const credsFromSQLite: Credentials = {
                accessToken: sqliteCreds.accessToken,
                client: sqliteCreds.client || '',
                uid: sqliteCreds.uid || '',
                email: undefined,
              };
              console.log("[AuthContext] Valid credentials found in SQLite");
              setCredentials(credsFromSQLite);
            }
          } catch (e) {
            console.log("[AuthContext] No credentials in SQLite:", e);
          }
        }
        
        if (storedUrl) {
          let cleanUrl = storedUrl.replace(/\/$/, "");
          if (!cleanUrl.endsWith("/api")) {
            cleanUrl = cleanUrl + "/api";
          }
          setBaseUrlState(cleanUrl);
          baseUrlRef.current = cleanUrl;
          await AsyncStorage.setItem(BASE_URL_KEY, cleanUrl); // Atualiza o storage
        }
      } catch (error) {
        console.error("Failed to load session:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const setBaseUrl = useCallback(async (url: string) => {
    let clean = url.replace(/\/$/, "");
    // Garante que a URL base sempre termine com /api (padrão eControle Pro)
    if (!clean.endsWith("/api")) {
      clean = clean + "/api";
    }
    setBaseUrlState(clean);
    baseUrlRef.current = clean;
    await AsyncStorage.setItem(BASE_URL_KEY, clean);
  }, []);

  const loginWithCredentials = useCallback(async (creds: Credentials) => {
    setCredentials(creds);
    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    // Salva também no SQLite para persistência
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
      console.log("[AuthContext] Credentials saved to SQLite");
    } catch (e) {
      console.error("[AuthContext] Failed to save credentials to SQLite:", e);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string, apiBaseUrl: string) => {
      const { accessToken, client, uid } = await performLogin(
        apiBaseUrl,
        email,
        password
      );
      const creds: Credentials = { accessToken, client, uid, email };
      // Save credentials and base URL atomically
      await Promise.all([
        AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds)),
        AsyncStorage.setItem(BASE_URL_KEY, apiBaseUrl.replace(/\/$/, "")),
      ]);
      setCredentials(creds);
      setBaseUrlState(apiBaseUrl.replace(/\/$/, ""));
      baseUrlRef.current = apiBaseUrl.replace(/\/$/, "");
      
      // Salva também no SQLite para persistência
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
        console.log("[AuthContext] Login successful - credentials saved to SQLite");
      } catch (e) {
        console.error("[AuthContext] Failed to save credentials to SQLite:", e);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setCredentials(null);
    await AsyncStorage.multiRemove([CREDENTIALS_KEY]);
    // Limpa também do SQLite
    try {
      const db = require("@/databases/database").getDB();
      db.runSync('DELETE FROM credentials');
      db.runSync('DELETE FROM users');
      console.log("[AuthContext] Credentials cleared from SQLite");
    } catch (e) {
      console.error("[AuthContext] Failed to clear credentials from SQLite:", e);
    }
    // Keep baseUrl so user doesn't have to re-enter server URL
  }, []);

  const refreshCredentials = useCallback(async (): Promise<boolean> => {
    if (!credentials || !baseUrl) {
      console.log("[AuthContext] Cannot refresh - no credentials or baseUrl");
      return false;
    }

    try {
      console.log("[AuthContext] Refreshing credentials...");
      
      // Devise Token Auth: GET /auth/validate_token renova os headers
      const url = `${baseUrl}/auth/validate_token`;
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

      if (response.status === 401) {
        console.log("[AuthContext] Refresh failed - token expired");
        return false;
      }

      if (!response.ok) {
        console.log("[AuthContext] Refresh failed - status", response.status);
        return false;
      }

      // Pega novos headers da resposta
      const newAccessToken = response.headers.get("access-token") || credentials.accessToken;
      const newClient = response.headers.get("client") || credentials.client;
      const newUid = response.headers.get("uid") || credentials.uid;

      // Atualiza credenciais se vieram novos headers
      const updatedCreds: Credentials = {
        accessToken: newAccessToken,
        client: newClient,
        uid: newUid,
        email: credentials.email,
      };

      setCredentials(updatedCreds);
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updatedCreds));
      
      // Atualiza no SQLite
      insertCredentials({
        _id: 'main',
        accessToken: newAccessToken,
        uid: newUid,
        client: newClient,
      });

      console.log("[AuthContext] Credentials refreshed successfully");
      return true;
    } catch (error) {
      console.error("[AuthContext] Refresh error:", error);
      return false;
    }
  }, [credentials, baseUrl]);

  const testConnection = useCallback(
    async (testUrl: string): Promise<{ ok: boolean; message: string }> => {
      const cleanBase = testUrl.replace(/\/$/, "");
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        // Try the health endpoint, or fall back to the auth endpoint (404 = server is alive)
        const response = await fetch(`${cleanBase}/api/v1/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok || response.status === 404 || response.status === 401) {
          return { ok: true, message: "Servidor acessível ✓" };
        }
        return {
          ok: false,
          message: `Servidor respondeu com erro ${response.status}`,
        };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, message: "Timeout — servidor não respondeu" };
        }
        return { ok: false, message: `Não foi possível conectar em ${cleanBase}` };
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
