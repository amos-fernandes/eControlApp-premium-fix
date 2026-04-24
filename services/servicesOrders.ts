import { getDB, getCredentials, insertServiceOrder, insertServiceOrderNoTransaction, getServiceOrders, getServiceOrder as getDBServiceOrder, insertCredentials } from "@/databases/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { retrieveDomain } from "./retrieveUserSession";
import type { ServiceOrder, ServiceExecution } from "./api";
import type { Credentials } from "@/context/AuthContext";
import { refreshAuthToken, getCurrentCredentials, clearTokenCache } from "@/lib/token-sync";
import { calculateDailyMetrics, calculateMonthlyMetrics } from "./logisticsMetrics";

const CREDENTIALS_KEY = "econtrole_credentials";

export interface ApiConfig {
  baseUrl: string;
  credentials: Credentials;
}

export interface FilterServiceOrderState {
  filters: {
    status: string;
    so_type: string;
    start_date?: string;
    end_date?: string;
    voyage: string;
  };
}

/**
 * Atualiza os tokens no cache/storage a partir dos headers de resposta da API
 * Crucial para o funcionamento do Devise Token Auth (token rotation)
 */
async function updateTokensFromResponse(response: Response, currentUid: string) {
  const accessToken = response.headers.get("access-token");
  const client = response.headers.get("client");
  const uid = response.headers.get("uid") || currentUid;

  if (accessToken && client && uid) {
    console.log("[TokenSync] 🔄 Atualizando tokens da resposta (rotation)...");
    
    try {
      const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
      const creds = stored ? JSON.parse(stored) : {};
      
      const updatedCreds = { 
        ...creds,
        accessToken, 
        client, 
        uid 
      };
      
      // Salva em AsyncStorage
      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(updatedCreds));
      
      // Salva em SQLite
      insertCredentials({
        _id: 'main',
        accessToken,
        uid,
        client,
        userId: creds.userId,
        driver_employee_id: creds.driver_employee_id
      });
    } catch (e) {
      console.error("[TokenSync] Erro ao rotacionar tokens:", e);
    }
  }
}

/**
 * Busca ordens de serviço da API com cache SQLite
 * - Primeiro tenta buscar do cache local
 * - Se tiver dados em cache, retorna imediatamente
 * - Se não tiver ou cache estiver vazio, busca da API e salva no cache
 * - Faz refresh automático do token se receber 401
 * - ✅ PAGINAÇÃO AUTOMÁTICA: Detecta e busca todas as páginas
 */
export const getServicesOrders = async ({ filters }: FilterServiceOrderState): Promise<ServiceOrder[]> => {
  console.log("getServicesOrders: Starting with filters:", JSON.stringify(filters));

  try {
    // Obtém credenciais e URL do banco/secure store
    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !credentials.accessToken) {
      console.warn("getServicesOrders: No credentials found");
      throw new Error("NO_CREDENTIALS");
    }

    // Log para debug de token enviado
    const tokenPreview = credentials.accessToken ? `${credentials.accessToken.substring(0, 12)}...` : "VAZIO";
    console.log(`[getServicesOrders] 🚀 Enviando Requisição: Token: ${tokenPreview} | UID: ${credentials.uid} | Client: ${credentials.client}`);

    if (!domainResult.data || domainResult.status !== 200) {
      console.warn("getServicesOrders: No domain found");
      throw new Error("NO_DOMAIN");
    }

    const baseUrl = domainResult.data;

    // Headers de autenticação
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    };

    console.log(`[OS-DEBUG] 📡 Preparando chamada para a API:`);
    console.log(`[OS-DEBUG] BaseURL: ${baseUrl}`);
    console.log(`[OS-DEBUG] Headers Enviados:`, JSON.stringify({
      ...headers,
      "access-token": credentials.accessToken ? `${credentials.accessToken.substring(0, 10)}...` : "NULO"
    }, null, 2));

    // 📄 PAGINAÇÃO AUTOMÁTICA: Busca todas as páginas
    let allOrders: ServiceOrder[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const MAX_PAGES = 100; // Limite de segurança (evita loop infinito)
    let pagesFetched = 0;

    console.log("📄 [PAGINAÇÃO] Iniciando paginação automática...");

    while (hasMorePages && pagesFetched < MAX_PAGES) {
      const url = new URL(baseUrl.replace(/\/$/, "") + "/service_orders");

      // Parâmetros conforme análise: status acting é o filtro do motorista
      url.searchParams.set("status", filters.status || "acting");
      url.searchParams.set("so_type", filters.so_type || "all");
      url.searchParams.set("voyage", (filters.voyage && filters.voyage !== "all") ? filters.voyage : "all");

      if (filters.start_date) url.searchParams.set("start_date", filters.start_date);
      if (filters.end_date) url.searchParams.set("end_date", filters.end_date);
      
      // ✅ Parâmetros de paginação
      url.searchParams.set("page", String(currentPage));
      url.searchParams.set("per_page", "100");

      console.log(`📄 [PAGINAÇÃO] Buscando página ${currentPage}... URL: ${url.toString()}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // ✅ Atualiza tokens se o servidor enviou novos (rotation)
        await updateTokensFromResponse(response, credentials.uid);

        // 🔍 LOG DE RESPOSTA POR PÁGINA
        const respHeaders: Record<string, string> = {};
        response.headers.forEach((v, k) => respHeaders[k] = v);
        
        console.log(`[OS-DEBUG] 📥 Resposta Página ${currentPage}:`);
        console.log(`[OS-DEBUG] Status: ${response.status}`);
        console.log(`[OS-DEBUG] Headers de Resposta:`, JSON.stringify(respHeaders, null, 2));

        if (response.status === 401) {
          console.error("getServicesOrders: SESSION_EXPIRED (Token Inválido)");
          throw new Error("SESSION_EXPIRED");
        }

        if (!response.ok) {
          console.error(`getServicesOrders: API error ${response.status}`);
          throw new Error(`Erro ao buscar OS: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("❌ [API ERROR] Resposta não JSON");
          throw new Error("Resposta não JSON da API");
        }

        // ✅ Única chamada para json() por página
        const data = await response.json();
        
        // Extrai ordens da resposta (suporta vários formatos)
        let pageOrders: ServiceOrder[] = [];
        const rawItems = data?.items || data?.data || data?.service_orders || (Array.isArray(data) ? data : []);
        
        if (Array.isArray(rawItems)) {
          pageOrders = rawItems.filter((item: any) => item && typeof item === "object");
        }

        console.log(`📄 [PAGINAÇÃO] Página ${currentPage}: ${pageOrders.length} ordens recebidas`);
        allOrders = allOrders.concat(pageOrders);

        // ✅ Detectar se há mais páginas
        const xTotalPages = response.headers.get("X-Total-Pages");
        const xNextPage = response.headers.get("X-Next-Page");
        
        if (xNextPage) {
          hasMorePages = true;
        } else if (xTotalPages) {
          hasMorePages = currentPage < parseInt(xTotalPages, 10);
        } else {
          hasMorePages = pageOrders.length >= 100;
        }
        
        currentPage++;
        pagesFetched++;
      } catch (fetchError: any) {
        clearTimeout(timeout);
        console.error(`📄 [PAGINAÇÃO] Erro na requisição da página ${currentPage}:`, fetchError.message);
        throw fetchError;
      }
    }

    if (pagesFetched > 1) {
      console.log(`📄 [PAGINAÇÃO] ✅ Buscadas ${pagesFetched} páginas, total ${allOrders.length} ordens recebidas.`);
    } else {
      console.log(`📄 [PAGINAÇÃO] ✅ Uma única página recebida com ${allOrders.length} ordens.`);
    }

    const totalFromApi = allOrders.length;

    // 💾 SALVAR NO CACHE SQLITE (Salva tudo antes de filtrar, para ter histórico)
    if (totalFromApi > 0) {
      console.log(`[Cache] Atualizando ${totalFromApi} ordens no SQLite...`);
      const db = getDB();
      db.withTransactionSync(() => {
        allOrders.forEach((order) => {
          try {
            insertServiceOrderNoTransaction(order, db);
          } catch (err) {
            console.error("getServicesOrders: Error caching order", order.id, err);
          }
        });
      });
    }

    // 🔥 FILTRO POR ATOR (USUÁRIO)
    let orders = allOrders;
    if (credentials.uid !== 'suporte@econtrole.com' && credentials.email !== 'suporte@econtrole.com') {
      const loggedDriverId = credentials.driver_employee_id;
      const loggedUserId = credentials.userId;
      
      console.log(`[FILTER-DEBUG] 🕵️ Iniciando filtragem: LoggedDriverId=${loggedDriverId} | LoggedUserId=${loggedUserId}`);

      if (loggedDriverId) {
        orders = allOrders.filter(order => String(order.driver_employee_id) === String(loggedDriverId));
        console.log(`[FILTER-DEBUG] ✅ Filtro por driver_employee_id: restaram ${orders.length} de ${totalFromApi} ordens.`);
      } else if (loggedUserId) {
        orders = allOrders.filter(order => {
          const orderActorId = order.user_auth?.id || (order as any).user_auth_id;
          return String(orderActorId) === String(loggedUserId);
        });
        console.log(`[FILTER-DEBUG] ⚠️ driver_employee_id ausente, filtro por UserId: restaram ${orders.length} de ${totalFromApi} ordens.`);
      }
    }

    // 📊 CALCULAR MÉTRICAS DE LOGÍSTICA (Apenas sobre as ordens do motorista)
    if (orders.length > 0) {
      try {
        const targetId = credentials.driver_employee_id || credentials.userId || 0;
        const today = new Date().toISOString().split('T')[0];

        console.log(`[Logistics] Calculando performance para motorista ${targetId}...`);
        await calculateDailyMetrics(
          String(targetId),
          credentials.email || 'Motorista',
          today,
          orders
        );

        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const year = new Date().getFullYear();
        await calculateMonthlyMetrics(month, year);
      } catch (logErr) {
        console.error("[Logistics] Erro ao atualizar KPIs:", logErr);
      }
    }

    if (orders.length === 0 && totalFromApi > 0) {
      console.warn(`[FILTER-DEBUG] ❌ ATENÇÃO: O servidor mandou ${totalFromApi} ordens, mas NENHUMA bate com seu ID.`);
    }

    return orders;
  } catch (error: any) {
    // Tratamento de erros
    if (error.message === "SESSION_EXPIRED") {
      console.error("getServicesOrders: SESSION_EXPIRED - Token inválido ou expirado");
    } else {
      console.error("getServicesOrders: Error:", error.message);
    }

    // Se falhar a API, tenta retornar do cache (exceto SESSION_EXPIRED que deve deslogar/refresh)
    if (error.message !== "SESSION_EXPIRED" && error.message !== "NO_CREDENTIALS") {
      try {
        console.log("getServicesOrders: Falling back to SQLite cache...");
        const cachedOrders = getServiceOrdersFromCache();
        
        // Aplica filtro de ator no cache também se tivermos credenciais
        const credentials = await getCredentials();
        if (credentials && credentials.uid !== 'suporte@econtrole.com' && credentials.email !== 'suporte@econtrole.com') {
          const loggedDriverId = credentials.driver_employee_id;
          if (loggedDriverId) {
            return cachedOrders.filter(order => order.driver_employee_id === loggedDriverId);
          }
        }
        return cachedOrders;
      } catch (cacheError) {
        console.error("getServicesOrders: Cache fallback failed:", cacheError);
      }
    }
    
    throw error;
  }
};

/**
 * Busca uma ordem de serviço específica por identifier
 * - Primeiro tenta buscar do cache local
 * - Se não encontrar, busca da API
 */
export const getServiceOrder = async (identifier: string): Promise<ServiceOrder> => {
  console.log("getServiceOrder: Starting for identifier:", identifier);

  try {
    // Tenta buscar do cache SQLite primeiro
    const cachedOrder = getServiceOrderFromCacheByIdentifier(identifier);
    if (cachedOrder) {
      console.log("getServiceOrder: Found in cache:", cachedOrder.identifier);
      return cachedOrder;
    }

    console.log("getServiceOrder: Not in cache, fetching from API...");

    // Busca da API
    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !credentials.accessToken) {
      throw new Error("NO_CREDENTIALS");
    }

    if (!domainResult.data || domainResult.status !== 200) {
      throw new Error("NO_DOMAIN");
    }

    const baseUrl = domainResult.data;

    // Busca por identifier via query param
    const url = new URL(`${baseUrl}/service_orders`);
    url.searchParams.set("identifier", identifier);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 404) {
      throw new Error(`OS não encontrada: ${identifier}`);
    }

    if (response.status === 401) {
      throw new Error("SESSION_EXPIRED");
    }

    if (!response.ok) {
      throw new Error(`Erro ao carregar OS: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Resposta não JSON ao carregar OS");
    }

    const data = await response.json();

    // Handle various API response shapes
    let order: ServiceOrder | null = null;
    if (Array.isArray(data?.items) && data.items.length > 0) {
      order = data.items[0];
    } else if (Array.isArray(data?.data) && data.data.length > 0) {
      order = data.data[0];
    } else if (Array.isArray(data) && data.length > 0) {
      order = data[0];
    } else if (data?.data) {
      order = data.data;
    } else {
      order = data;
    }

    if (!order) {
      throw new Error(`OS não encontrada: ${identifier}`);
    }

    // Salva no cache SQLite
    console.log("getServiceOrder: Caching order to SQLite...");
    insertServiceOrder(order);

    return order;
  } catch (error: any) {
    console.error("getServiceOrder: Error:", error.message);
    throw error;
  }
};

/**
 * Funções auxiliares para cache SQLite
 */

export const getServiceOrdersFromCache = (): ServiceOrder[] => {
  try {
    const db = getDB();
    const rows = db.getAllSync("SELECT * FROM service_orders ORDER BY created_at DESC") as any[];

    return rows.map((row) => ({
      id: row.id,
      identifier: row.identifier,
      status: row.status,
      service_date: row.service_date,
      customer: { name: row.customer_name },
      address: { 
        to_s: row.address_text,
        latitude: row.latitude,
        longitude: row.longitude
      },
      driver_observations: row.driver_observations,
      driver_employee_id: row.driver_employee_id,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    }));
  } catch (error) {
    console.error("getServiceOrdersFromCache: Error:", error);
    return [];
  }
};

export const getServiceOrderFromCacheByIdentifier = (identifier: string): ServiceOrder | null => {
  try {
    const db = getDB();
    const row = db.getFirstSync("SELECT * FROM service_orders WHERE identifier = ?", [identifier]) as any;

    if (!row) return null;

    return {
      id: row.id,
      identifier: row.identifier,
      status: row.status,
      service_date: row.service_date,
      customer: { name: row.customer_name },
      address: { 
        to_s: row.address_text,
        latitude: row.latitude,
        longitude: row.longitude
      },
      driver_observations: row.driver_observations,
      driver_employee_id: row.driver_employee_id,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    };
  } catch (error) {
    console.error("getServiceOrderFromCacheByIdentifier: Error:", error);
    return null;
  }
};

export const getServiceOrderFromCacheById = (id: number): ServiceOrder | null => {
  try {
    const db = getDB();
    const row = db.getFirstSync("SELECT * FROM service_orders WHERE id = ?", [id]) as any;

    if (!row) return null;

    return {
      id: row.id,
      identifier: row.identifier,
      status: row.status,
      service_date: row.service_date,
      customer: { name: row.customer_name },
      address: { 
        to_s: row.address_text,
        latitude: row.latitude,
        longitude: row.longitude
      },
      driver_observations: row.driver_observations,
      driver_employee_id: row.driver_employee_id,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    };
  } catch (error) {
    console.error("getServiceOrderFromCacheById: Error:", error);
    return null;
  }
};

/**
 * Sincroniza localizações capturadas do dispositivo com o backend.
 */
export const syncDeviceLocations = async (): Promise<void> => {
  try {
    const { getUnsyncedLocations, markLocationsAsSynced, clearSyncedLocations } = require("@/databases/database");
    const locations = getUnsyncedLocations(50); // Lote de 50
    
    if (locations.length === 0) return;

    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !domainResult.data) return;

    const baseUrl = domainResult.data.replace(/\/$/, "");
    
    // Endpoint de tracking do eControle Pro
    const url = `${baseUrl}/api/device_locations/sync`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
      },
      body: JSON.stringify({ locations }),
    });

    if (response.ok) {
      const ids = locations.map((l: any) => l.id);
      markLocationsAsSynced(ids);
      console.log(`[Sync] ${locations.length} localizações sincronizadas.`);
      
      // Se sincronizou com sucesso, tenta o próximo lote
      if (locations.length === 50) {
        await syncDeviceLocations();
      } else {
        clearSyncedLocations();
      }
    }
  } catch (error) {
    console.error("[Sync] Erro ao sincronizar localizações:", error);
  }
};

const getServiceExecutionsFromCache = (serviceOrderId: number): ServiceExecution[] => {
  try {
    const db = getDB();
    const rows = db.getAllSync("SELECT * FROM service_executions WHERE service_order_id = ?", [serviceOrderId]) as any[];

    return rows.map((row) => ({
      id: row.id,
      service: {
        id: row.id,
        name: row.service_name,
      },
      amount: row.amount,
      unit: { name: row.unit_name },
      service_item_weights: row.item_weights ? JSON.parse(row.item_weights) : null,
    }));
  } catch (error) {
    console.error("getServiceExecutionsFromCache: Error:", error);
    return [];
  }
};

/**
 * Limpa o cache de ordens de serviço
 */
export const clearServiceOrdersCache = (): void => {
  const db = getDB();
  db.execSync("DELETE FROM service_orders; DELETE FROM service_executions;");
};

/**
 * Verifica se o cache está vazio
 */
export const isCacheEmpty = (): boolean => {
  const db = getDB();
  const result = db.getFirstSync("SELECT COUNT(*) as count FROM service_orders") as { count: number };
  return result.count === 0;
};

/**
 * Extrai nome do cliente
 */
export function getClientName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Cliente não informado";
  return order.customer?.name || (order as any).client_name || (order as any).cliente_nome || "Cliente não informado";
}

/**
 * Extrai endereço formatado
 */
export function getAddressName(order: ServiceOrder | null | undefined): string {
  if (!order) return "";
  const address = order.address || (order as any).endereco;
  if (!address) return "";
  if (typeof address === "string") return address;
  return (address as any).to_s || (address as any).name || "";
}

/**
 * Extrai nome da rota
 */
export function getRouteName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Sem Rota";
  
  // Verifica múltiplos campos possíveis para o nome da rota
  const routeName = 
    (order as any).route_name || 
    (order as any).collection_route || 
    (order as any).route?.name ||
    (order as any).address?.route_name ||
    (order as any).customer?.route_name;
  
  return routeName || "Sem Rota";
}

/**
 * Extrai nome da viagem
 */
export function getVoyageName(order: ServiceOrder | null | undefined): string | null {
  if (!order) return null;
  const voyage = order.voyage;
  if (voyage) {
    if (typeof voyage === "object") {
      return (voyage as any).name || String((voyage as any).id || "") || null;
    }
    if (typeof voyage === "string") voyage;
  }
  return (order as any).voyage_name || null;
}

/**
 * Verifica se tem viagem
 */
export function hasVoyage(order: ServiceOrder | null | undefined): boolean {
  if (!order) return false;
  return !!(order.voyage || (order as any).voyage_name || (order as any).voyage_id);
}

/**
 * Upload de foto para ordem de serviço
 */
export async function uploadPhoto(
  config: ApiConfig,
  orderId: string | number,
  uri: string
): Promise<void> {
  const domainResult = await retrieveDomain();
  if (!domainResult.data || domainResult.status !== 200) {
    throw new Error("NO_DOMAIN");
  }

  const cleanBase = domainResult.data.replace(/\/$/, "");
  const formData = new FormData();
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  // @ts-ignore - FormData no React Native
  formData.append("photo", { uri, name: filename, type: mimeType });

  const headers: Record<string, string> = {
    "access-token": config.credentials.accessToken,
    client: config.credentials.client,
    uid: config.credentials.uid,
  };

  const response = await fetch(
    `${cleanBase}/api/service_orders/${orderId}/photos`,
    { method: "POST", headers, body: formData }
  );

  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`Erro ao enviar foto: ${response.status}`);
}
