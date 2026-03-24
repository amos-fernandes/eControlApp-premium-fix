import { getDB, getCredentials, insertServiceOrder, insertServiceOrderNoTransaction, getServiceOrders, getServiceOrder as getDBServiceOrder } from "@/databases/database";
import { retrieveDomain } from "./retrieveUserSession";
import type { ServiceOrder, ServiceExecution } from "./api";
import type { Credentials } from "@/context/AuthContext";

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
 * Busca ordens de serviço da API com cache SQLite
 * - Primeiro tenta buscar do cache local
 * - Se tiver dados em cache, retorna imediatamente
 * - Se não tiver ou cache estiver vazio, busca da API e salva no cache
 */
export const getServicesOrders = async ({ filters }: FilterServiceOrderState): Promise<ServiceOrder[]> => {
  console.log("getServicesOrders: Starting with filters:", filters);

  try {
    // Obtém credenciais e URL do banco/secure store
    const credentials = await getCredentials();
    const domainResult = await retrieveDomain();

    if (!credentials || !credentials.accessToken) {
      console.warn("getServicesOrders: No credentials found");
      throw new Error("NO_CREDENTIALS");
    }

    if (!domainResult.data || domainResult.status !== 200) {
      console.warn("getServicesOrders: No domain found");
      throw new Error("NO_DOMAIN");
    }

    const baseUrl = domainResult.data;

    // Constrói URL com query params
    const url = new URL(`${baseUrl}/service_orders`);
    if (filters.status) url.searchParams.set("status", filters.status);
    if (filters.so_type) url.searchParams.set("so_type", filters.so_type);
    if (filters.start_date) url.searchParams.set("start_date", filters.start_date);
    if (filters.end_date) url.searchParams.set("end_date", filters.end_date);
    if (filters.voyage && filters.voyage !== "all") {
      url.searchParams.set("voyage", filters.voyage);
    }

    console.log("getServicesOrders: Fetching from:", url.toString());

    // Headers de autenticação
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    };

    // Timeout de 20 segundos
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 401) {
      console.error("getServicesOrders: SESSION_EXPIRED - Token inválido ou expirado");
      throw new Error("SESSION_EXPIRED");
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`getServicesOrders: API error ${response.status}:`, errorText.slice(0, 200));
      throw new Error(`Erro ao buscar OS: ${response.status} - ${errorText.slice(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Resposta não JSON da API");
    }

    const data = await response.json();
    console.log("getServicesOrders: API response received");

    // Handle various API response shapes
    let orders: ServiceOrder[] = [];
    if (Array.isArray(data?.items)) {
      orders = data.items.filter((item: any) => item && typeof item === "object");
    } else if (Array.isArray(data?.data)) {
      orders = data.data.filter((item: any) => item && typeof item === "object");
    } else if (Array.isArray(data)) {
      orders = data.filter((item: any) => item && typeof item === "object");
    } else if (Array.isArray(data?.service_orders)) {
      orders = data.service_orders.filter((item: any) => item && typeof item === "object");
    }

    // --- FILTRAGEM CUSTOMIZADA ---
    // Se o filtro de status estiver vazio (Todos), filtramos para mostrar apenas 'atuando'
    // e excluímos explicitamente canceladas e finalizadas.
    if (!filters.status) {
      console.log("getServicesOrders: Filtering for 'acting' orders (excluding finished/canceled)");
      orders = orders.filter((o) => {
        const status = (o.status || "").toLowerCase();
        // Não mostramos finalizadas ou canceladas no modo 'Todos'
        if (status === "finished" || status === "concluída" || status === "concluida" ||
            status === "canceled" || status === "cancelada") {
          return false;
        }
        // Mostramos apenas as que estão atuando ou pendentes
        return true;
      });
    }
    // ----------------------------

    // --- FILTRO POR ATOR (USUÁRIO) ---
    // motoristaapp@econtrole.com: NÃO vê OS finalizadas, canceladas ou agendadas
    // suporte@econtrole.com: Vê TODAS as OS
    const userEmail = credentials.uid?.toLowerCase() || "";
    const isMotorista = userEmail.includes("motoristaapp");
    
    if (isMotorista && !filters.status) {
      console.log("getServicesOrders: Filtro por ATOR (motoristaapp) - excluindo finished/canceled/scheduled");
      orders = orders.filter((o) => {
        const status = (o.status || "").toLowerCase();
        // Motorista só vê running e checking
        if (status === "finished" || status === "concluída" || status === "concluida" ||
            status === "canceled" || status === "cancelada" ||
            status === "scheduled" || status === "agendada") {
          return false;
        }
        return true;
      });
      console.log(`getServicesOrders: ${orders.length} orders after actor filter (motoristaapp)`);
    } else if (userEmail.includes("suporte")) {
      console.log("getServicesOrders: Filtro por ATOR (suporte) - mostrando TODAS as OS");
    }
    // ---------------------------------

    console.log(`getServicesOrders: Received ${orders.length} orders after filtering`);
    
    // Log dos status recebidos para debug
    const statusCount: Record<string, number> = {};
    orders.forEach((o: any) => {
      const s = o.status || 'unknown';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    console.log("getServicesOrders: Status distribution:", statusCount);

    // Salva no cache SQLite
    if (orders.length > 0) {
      console.log("getServicesOrders: Caching orders to SQLite...");
      const db = getDB();
      db.withTransactionSync(() => {
        orders.forEach((order) => {
          try {
            insertServiceOrderNoTransaction(order, db);
          } catch (err) {
            console.error("getServicesOrders: Error caching order", order.id, err);
          }
        });
      });
      console.log("getServicesOrders: Orders cached successfully");
    }

    return orders;
  } catch (error: any) {
    // Não loga como erro se não tiver credenciais ou domain - isso é esperado
    if (error.message === "NO_CREDENTIALS" || error.message === "NO_DOMAIN") {
      console.log("getServicesOrders: No credentials or domain - user not authenticated");
    } else if (error.message === "SESSION_EXPIRED") {
      console.error("getServicesOrders: SESSION_EXPIRED - Token inválido ou expirado");
      // Não faz fallback para cache quando SESSION_EXPIRED
      // Isso força o componente a detectar o erro e tentar refresh
    } else {
      console.error("getServicesOrders: Error:", error.message);
    }

    // Se falhar a API, tenta retornar do cache (exceto SESSION_EXPIRED)
    if (error.message !== "NO_CREDENTIALS" && error.message !== "NO_DOMAIN" && error.message !== "SESSION_EXPIRED") {
      console.log("getServicesOrders: Falling back to SQLite cache...");
      try {
        const cachedOrders = getServiceOrdersFromCache();
        if (cachedOrders.length > 0) {
          console.log(`getServicesOrders: Returning ${cachedOrders.length} cached orders`);
          return cachedOrders;
        }
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
      address: { to_s: row.address_text },
      driver_observations: row.driver_observations,
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
      address: { to_s: row.address_text },
      driver_observations: row.driver_observations,
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
      address: { to_s: row.address_text },
      driver_observations: row.driver_observations,
      created_at: row.created_at,
      voyage: row.voyage_info ? JSON.parse(row.voyage_info) : null,
      service_executions: getServiceExecutionsFromCache(row.id),
    };
  } catch (error) {
    console.error("getServiceOrderFromCacheById: Error:", error);
    return null;
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
    if (typeof voyage === "string") return voyage;
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
