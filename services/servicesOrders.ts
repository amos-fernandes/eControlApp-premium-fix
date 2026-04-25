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
 */
export const getServicesOrders = async ({ filters }: FilterServiceOrderState): Promise<ServiceOrder[]> => {
  console.log("getServicesOrders: Starting with filters:", JSON.stringify(filters));

  try {
    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !credentials.accessToken) {
      console.warn("getServicesOrders: No credentials found");
      throw new Error("NO_CREDENTIALS");
    }

    const tokenPreview = credentials.accessToken ? `${credentials.accessToken.substring(0, 12)}...` : "VAZIO";
    console.log(`[DATA-FLOW] 🔑 Iniciando Requisição: Token: ${tokenPreview} | UID: ${credentials.uid} | Client: ${credentials.client}`);

    if (!domainResult.data || domainResult.status !== 200) {
      console.warn("getServicesOrders: No domain found");
      throw new Error("NO_DOMAIN");
    }

    const baseUrl = domainResult.data;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    };

    let allOrders: ServiceOrder[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const MAX_PAGES = 100;
    let pagesFetched = 0;

    console.log("📄 [PAGINAÇÃO] Iniciando paginação automática...");

    while (hasMorePages && pagesFetched < MAX_PAGES) {
      const url = new URL(baseUrl.replace(/\/$/, "") + "/service_orders");
      url.searchParams.set("status", filters.status || "all");
      url.searchParams.set("so_type", filters.so_type || "all");
      url.searchParams.set("voyage", (filters.voyage && filters.voyage !== "all") ? filters.voyage : "all");
      if (filters.start_date) url.searchParams.set("start_date", filters.start_date);
      if (filters.end_date) url.searchParams.set("end_date", filters.end_date);
      url.searchParams.set("page", String(currentPage));
      url.searchParams.set("per_page", "100");

      console.log(`[DATA-FLOW] 🌐 Chamando API: ${url.toString()}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        console.log(`[DATA-FLOW] 📡 Resposta HTTP: ${response.status} ${response.statusText}`);
        
        await updateTokensFromResponse(response, credentials.uid);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "Sem corpo de erro");
          console.error(`[DATA-FLOW] ❌ Erro na API: ${response.status}`, errorBody);
          throw new Error(`Erro API: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[DATA-FLOW] 📦 JSON recebido. Chaves:`, Object.keys(data));
        
        let pageOrders: ServiceOrder[] = [];
        const rawItems = data?.items || data?.data || data?.service_orders || (Array.isArray(data) ? data : []);
        
        if (Array.isArray(rawItems)) {
          pageOrders = rawItems.filter((item: any) => item && typeof item === "object");
        }

        // 🕵️ RAIO-X DETALHADO DA PRIMEIRA ORDEM
        if (currentPage === 1 && pageOrders.length > 0) {
          const first = pageOrders[0];
          console.log(`[DATA-FLOW] 🛡️ ESTRUTURA DA PRIMEIRA OS:`, JSON.stringify({
            id: first.id,
            identifier: first.identifier,
            driver_employee_id: first.driver_employee_id,
            user_auth: first.user_auth,
            status: first.status
          }, null, 2));
        }

        console.log(`📄 [PAGINAÇÃO] Página ${currentPage}: ${pageOrders.length} ordens válidas.`);
        allOrders = allOrders.concat(pageOrders);

        const xNextPage = response.headers.get("X-Next-Page");
        const xTotalPages = response.headers.get("X-Total-Pages");
        
        if (xNextPage) hasMorePages = true;
        else if (xTotalPages) hasMorePages = currentPage < parseInt(xTotalPages, 10);
        else hasMorePages = pageOrders.length >= 100;
        
        currentPage++;
        pagesFetched++;
      } catch (fetchError: any) {
        clearTimeout(timeout);
        console.error(`[DATA-FLOW] 🚨 FALHA na página ${currentPage}:`, fetchError.message);
        throw fetchError;
      }
    }

    const totalFromApi = allOrders.length;
    console.log(`[DATA-FLOW] ✅ Total final recebido: ${totalFromApi} ordens.`);

    // 💾 SALVAR NO CACHE SQLITE
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

    // 🔥 FILTRO POR ATOR (USUÁRIO) - REFINADO E INCLUSIVO
    let orders = allOrders;
    if (credentials.uid !== 'suporte@econtrole.com' && credentials.email !== 'suporte@econtrole.com') {
      const loggedDriverId = credentials.driver_employee_id;
      const loggedUserId = credentials.userId;
      
      console.log(`[FILTER-DEBUG] 🕵️ Iniciando filtragem inclusiva: LoggedDriverId=${loggedDriverId} | LoggedUserId=${loggedUserId}`);

      orders = allOrders.filter(order => {
        // Tenta encontrar o ID do motorista em vários campos possíveis
        const orderDriverId = order.driver_employee_id || (order as any).employee_id || (order as any).motorista_id;
        // Tenta encontrar o ID do usuário (auth)
        const orderUserId = order.user_auth?.id || (order as any).user_auth_id || (order as any).user_id;
        
        const matchDriver = loggedDriverId && String(orderDriverId) === String(loggedDriverId);
        const matchUser = loggedUserId && String(orderUserId) === String(loggedUserId);
        
        const isMatch = !!(matchDriver || matchUser);

        if (!isMatch && allOrders.indexOf(order) < 5) {
          console.log(`[FILTER-DEBUG] ❌ OS ${order.identifier || order.id} descartada. IDs da OS: Driver=${orderDriverId}, User=${orderUserId}`);
        }

        // Se bater qualquer um dos IDs, mantemos. 
        // Se a OS não tiver IDs nenhuns, mantemos (confiamos no filtro do servidor)
        return isMatch || (!orderDriverId && !orderUserId);
      });
      
      console.log(`[FILTER-DEBUG] ✅ Filtro finalizado: restaram ${orders.length} de ${totalFromApi} ordens.`);
    }

    // Se o filtro local limpou tudo mas o servidor mandou dados, vamos mostrar o que o servidor mandou
    // para evitar tela vazia por erro de mapeamento de IDs
    if (orders.length === 0 && totalFromApi > 0) {
      console.warn(`[FILTER-DEBUG] ⚠️ Filtro local resultou em ZERO, mas o servidor mandou ${totalFromApi}. Ignorando filtro local para garantir carga.`);
      orders = allOrders;
    }

    // 📊 CALCULAR MÉTRICAS DE LOGÍSTICA
    if (orders.length > 0) {
      try {
        const targetId = credentials.driver_employee_id || credentials.userId || 0;
        const today = new Date().toISOString().split('T')[0];
        await calculateDailyMetrics(String(targetId), credentials.email || 'Motorista', today, orders);
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const year = new Date().getFullYear();
        await calculateMonthlyMetrics(month, year);
        console.log("[Logistics] KPIs atualizados.");
      } catch (logErr) {
        console.error("[Logistics] Erro nos KPIs:", logErr);
      }
    }

    if (orders.length === 0 && totalFromApi > 0) {
      console.warn(`[FILTER-DEBUG] ❌ Nenhuma ordem bate com seu ID.`);
    }

    return orders;
  } catch (error: any) {
    if (error.message === "SESSION_EXPIRED") {
      console.error("getServicesOrders: SESSION_EXPIRED");
    } else {
      console.error("getServicesOrders: Error:", error.message);
    }

    if (error.message !== "SESSION_EXPIRED" && error.message !== "NO_CREDENTIALS") {
      try {
        console.log("getServicesOrders: Falling back to SQLite cache...");
        const cachedOrders = getServiceOrdersFromCache();
        const credentials = await getCredentials();
        if (credentials && credentials.uid !== 'suporte@econtrole.com' && credentials.email !== 'suporte@econtrole.com') {
          const loggedDriverId = credentials.driver_employee_id;
          if (loggedDriverId) {
            return cachedOrders.filter(order => String(order.driver_employee_id) === String(loggedDriverId));
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
 */
export const getServiceOrder = async (identifier: string): Promise<ServiceOrder> => {
  try {
    const cachedOrder = getServiceOrderFromCacheByIdentifier(identifier);
    if (cachedOrder) return cachedOrder;

    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !credentials.accessToken || !domainResult.data) {
      throw new Error("MISSING_AUTH");
    }

    const url = new URL(`${domainResult.data}/service_orders`);
    url.searchParams.set("identifier", identifier);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
      },
    });

    if (response.status === 401) throw new Error("SESSION_EXPIRED");
    if (!response.ok) throw new Error(`Erro API: ${response.status}`);

    const data = await response.json();
    const order = data?.items?.[0] || data?.data?.[0] || data?.[0] || data?.data || data;

    if (!order) throw new Error("OS_NOT_FOUND");

    insertServiceOrder(order);
    return order;
  } catch (error: any) {
    console.error("getServiceOrder: Error:", error.message);
    throw error;
  }
};

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
      address: { to_s: row.address_text, latitude: row.latitude, longitude: row.longitude },
      driver_observations: row.driver_observations,
      driver_employee_id: row.driver_employee_id,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    };
  } catch (error) {
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
      address: { to_s: row.address_text, latitude: row.latitude, longitude: row.longitude },
      driver_observations: row.driver_observations,
      driver_employee_id: row.driver_employee_id,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    };
  } catch (error) {
    return null;
  }
};

export const syncDeviceLocations = async (): Promise<void> => {
  try {
    const { getUnsyncedLocations, markLocationsAsSynced, clearSyncedLocations } = require("@/databases/database");
    const locations = getUnsyncedLocations(50);
    if (locations.length === 0) return;
    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();
    if (!credentials || !domainResult.data) return;
    const url = `${domainResult.data.replace(/\/$/, "")}/api/device_locations/sync`;
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
      markLocationsAsSynced(locations.map((l: any) => l.id));
      if (locations.length === 50) await syncDeviceLocations();
      else clearSyncedLocations();
    }
  } catch (error) {}
};

const getServiceExecutionsFromCache = (serviceOrderId: number): ServiceExecution[] => {
  try {
    const db = getDB();
    const rows = db.getAllSync("SELECT * FROM service_executions WHERE service_order_id = ?", [serviceOrderId]) as any[];
    return rows.map((row) => ({
      id: row.id,
      service: { id: row.id, name: row.service_name },
      amount: row.amount,
      unit: { name: row.unit_name },
      service_item_weights: row.item_weights ? JSON.parse(row.item_weights) : null,
    }));
  } catch (error) {
    return [];
  }
};

export const clearServiceOrdersCache = (): void => {
  const db = getDB();
  db.execSync("DELETE FROM service_orders; DELETE FROM service_executions;");
};

export const isCacheEmpty = (): boolean => {
  const db = getDB();
  const result = db.getFirstSync("SELECT COUNT(*) as count FROM service_orders") as { count: number };
  return result.count === 0;
};

export function getClientName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Cliente não informado";
  return order.customer?.name || (order as any).client_name || (order as any).cliente_nome || "Cliente não informado";
}

export function getAddressName(order: ServiceOrder | null | undefined): string {
  if (!order) return "";
  const address = order.address || (order as any).endereco;
  if (!address) return "";
  if (typeof address === "string") return address;
  return (address as any).to_s || (address as any).name || "";
}

export function getRouteName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Sem Rota";
  return (order as any).route_name || (order as any).collection_route || (order as any).route?.name || (order as any).address?.route_name || (order as any).customer?.route_name || "Sem Rota";
}

export function getVoyageName(order: ServiceOrder | null | undefined): string | null {
  if (!order) return null;
  const voyage = order.voyage;
  if (voyage) {
    if (typeof voyage === "object") return (voyage as any).name || String((voyage as any).id || "") || null;
    if (typeof voyage === "string") return voyage;
  }
  return (order as any).voyage_name || null;
}

export function hasVoyage(order: ServiceOrder | null | undefined): boolean {
  if (!order) return false;
  return !!(order.voyage || (order as any).voyage_name || (order as any).voyage_id);
}

export async function uploadPhoto(config: ApiConfig, orderId: string | number, uri: string): Promise<void> {
  const domainResult = await retrieveDomain();
  if (!domainResult.data) throw new Error("NO_DOMAIN");
  const formData = new FormData();
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  // @ts-ignore
  formData.append("photo", { uri, name: filename, type: mimeType });
  const headers = { "access-token": config.credentials.accessToken, client: config.credentials.client, uid: config.credentials.uid };
  const response = await fetch(`${domainResult.data.replace(/\/$/, "")}/api/service_orders/${orderId}/photos`, { method: "POST", headers, body: formData });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`Erro foto: ${response.status}`);
}
