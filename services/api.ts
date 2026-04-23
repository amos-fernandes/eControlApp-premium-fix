import type { Credentials } from "@/context/AuthContext";

export type { Credentials };

export interface ServiceOrder {
  id: number | string;
  status: string;
  type?: string;
  so_type?: string;
  client_name?: string;
  cliente_nome?: string;
  address?: string | { name?: string | null; latitude?: number | null; longitude?: number | null; zone?: string; logistic_profile?: string; to_s?: string };
  endereco?: string;
  route_name?: string;
  collection_route?: string;
  voyage?: { name?: string; id?: string | number } | string | null;
  voyage_name?: string;
  voyage_id?: string | number | null;
  services?: Service[];
  equipments?: Equipment[];
  photos?: string[];
  created_at?: string;
  updated_at?: string;
  company_id?: string | number;
  mtr_id?: string | number | null;
  notes?: string;
  collector?: string;
  scheduled_date?: string;
  service_date?: string;
  city?: string;
  state?: string;
  zip?: string;
  service_executions?: ServiceExecution[];
  collected_equipment?: Equipment[];
  lended_equipment?: Equipment[];
  driver_observations?: string;
  departure_date?: string;
  arrival_date?: string;
  start_km?: string;
  end_km?: string;
  certificate_memo?: string;
  customer?: { name?: string; document_value?: string; phone?: string };
  identifier?: string;
  user_auth?: { id: number; name?: string };
  contacts?: Array<{
    id: number;
    name: string;
    phone: string;
    validation_code: string;
  }>;
  validation_code?: string;
  route?: { id: number; name: string };
}

export interface Service {
  id: number | string;
  name: string;
  description?: string;
  quantity?: number;
  unit?: string;
}

export interface ServiceExecution {
  id: number | string;
  service?: Service;
  service_item_weights?: ServiceItemWeight[];
  amount?: number;
  unit?: { name?: string; abbreviation?: string };  // Para compatibilidade com update.tsx
}

export interface ServiceItemWeight {
  id?: number | string;
  weight?: number;
  unit?: string;
}

export interface Equipment {
  id: number | string;
  name: string;
  serial?: string;
  type?: string;
}

export interface ApiConfig {
  baseUrl: string;
  credentials: Credentials;
}

function buildHeaders(credentials: Credentials): Record<string, string> {
  // Matches exactly what the Pro app sends (no token-type, no Accept)
  return {
    "Content-Type": "application/json",
    "access-token": credentials.accessToken,
    client: credentials.client,
    uid: credentials.uid,
  };
}

// Known API path variations for service orders
const SERVICE_ORDER_PATHS = [
  "/service_orders",            // eControle Pro standard (URL base já tem /api)
  "/v1/service_orders",         // REST standard com versão
  "/service_orders.json",       // Formato JSON direto
  "/api/service_orders",        // Fallback para URLs base sem /api
  "/api/v1/service_orders",     // Fallback para URLs base sem /api
];

/**
 * @deprecated Use getServicesOrders do services/servicesOrders.ts para cache SQLite
 * Mantido apenas para compatibilidade com código legado
 */
export async function fetchServiceOrders(
  config: ApiConfig,
  params?: Record<string, string>
): Promise<ServiceOrder[]> {
  let cleanBase = config.baseUrl.replace(/\/$/, "");
  // Garante que a URL base sempre tenha /api
  if (!cleanBase.endsWith("/api")) {
    console.warn(`URL base sem /api detectada: ${config.baseUrl}, adicionando /api`);
    cleanBase = cleanBase + "/api";
  }
  console.log("Usando URL base final:", cleanBase);

  if (!config.credentials?.accessToken) {
    throw new Error("Sem credenciais. Faça login novamente.");
  }

  let lastError: Error | null = null;

  for (const path of SERVICE_ORDER_PATHS) {
    const url = new URL(`${cleanBase}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url.toString(), {
        headers: buildHeaders(config.credentials),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 404) {
        lastError = new Error(`Rota não encontrada: ${path}`);
        continue;
      }

      if (response.status === 401) {
        throw new Error("SESSION_EXPIRED");
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body?.message || body?.error || `Erro ao carregar ordens: ${response.status}`
        );
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Se não for JSON, tente ler como texto para debug e continue para a próxima rota
        const html = await response.text().catch(() => "");
        console.warn(`Resposta não JSON para ${path}:`, html.slice(0, 200));
        continue;
      }

      const data = await response.json();
      console.log("API Response data type:", typeof data);
      console.log("API Response data keys:", data ? Object.keys(data) : "null");
      console.log("API Response data sample:", JSON.stringify(data?.data?.slice(0, 2), null, 2));

      // Handle various API response shapes (prioridade para o formato do eControl Pro)
      if (Array.isArray(data?.items)) {
        const filteredData = data.items.filter((item: any) => item && typeof item === "object");
        console.log(`Returning ${filteredData.length} filtered items from data.items`);
        return filteredData;
      }
      if (Array.isArray(data?.data)) {
        const filteredData = data.data.filter((item: any) => item && typeof item === "object");
        console.log(`Returning ${filteredData.length} filtered items from data.data`);
        return filteredData;
      }
      if (Array.isArray(data)) {
        const filteredData = data.filter((item: any) => item && typeof item === "object");
        console.log(`Returning ${filteredData.length} filtered items from data`);
        return filteredData;
      }
      if (Array.isArray(data?.service_orders)) {
        const filteredData = data.service_orders.filter((item: any) => item && typeof item === "object");
        console.log(`Returning ${filteredData.length} filtered items from data.service_orders`);
        return filteredData;
      }
      if (Array.isArray(data?.results)) {
        const filteredData = data.results.filter((item: any) => item && typeof item === "object");
        console.log(`Returning ${filteredData.length} filtered items from data.results`);
        return filteredData;
      }

      // If data is an object with numeric keys (some APIs return that)
      if (data && typeof data === "object") {
        const values = Object.values(data);
        if (values.length > 0 && typeof values[0] === "object") {
          return values as ServiceOrder[];
        }
      }

      return [];
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Timeout ao carregar ordens. Verifique sua conexão.");
      }
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        throw err;
      }
      if (err instanceof Error && err.message.includes("404")) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error(`Não foi possível carregar as ordens de ${cleanBase}`);
}

/**
 * @deprecated Use getServiceOrder do services/servicesOrders.ts para cache SQLite
 * Mantido apenas para compatibilidade com código legado
 */
export async function fetchServiceOrder(
  config: ApiConfig,
  identifier: string
): Promise<ServiceOrder> {
  const cleanBase = config.baseUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Busca por identifier via query param (padrão eControle Pro)
    // Ex: /api/service_orders?identifier=OS-12345
    const url = new URL(`${cleanBase}/api/service_orders`);
    url.searchParams.set("identifier", identifier);

    const response = await fetch(url.toString(), {
      headers: buildHeaders(config.credentials),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 404) {
      throw new Error(`OS não encontrada: ${identifier}`);
    }

    if (response.status === 401) throw new Error("SESSION_EXPIRED");
    if (!response.ok) {
      throw new Error(`Erro ao carregar OS: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Resposta não JSON ao carregar OS");
    }

    const data = await response.json();
    
    // Handle various API response shapes
    let result: ServiceOrder | null = null;
    if (Array.isArray(data?.items) && data.items.length > 0) {
      result = data.items[0];
    } else if (Array.isArray(data?.data) && data.data.length > 0) {
      result = data.data[0];
    } else if (Array.isArray(data) && data.length > 0) {
      result = data[0];
    } else if (data?.data) {
      result = data.data;
    } else {
      result = data;
    }

    if (!result) {
      throw new Error(`OS não encontrada: ${identifier}`);
    }

    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout ao carregar OS. Verifique sua conexão.");
    }
    throw err;
  }
}

export async function updateServiceOrder(
  config: ApiConfig,
  id: string | number,
  updates: Partial<ServiceOrder>
): Promise<ServiceOrder> {
  const cleanBase = config.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${cleanBase}/api/service_orders/${id}`, {
    method: "PUT",
    headers: buildHeaders(config.credentials),
    body: JSON.stringify({ service_order: updates }),
  });

  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`Erro ao atualizar OS: ${response.status}`);

  const data = await response.json();
  return data?.data || data;
}

export async function finishServiceOrder(
  config: ApiConfig,
  id: string | number,
  data: Record<string, unknown>
): Promise<ServiceOrder> {
  const cleanBase = config.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${cleanBase}/api/service_orders/${id}/finish`, {
    method: "POST",
    headers: buildHeaders(config.credentials),
    body: JSON.stringify(data),
  });

  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || `Erro ao finalizar OS: ${response.status}`);
  }

  const result = await response.json();
  return result?.data || result;
}

export async function uploadPhoto(
  config: ApiConfig,
  orderId: string | number,
  uri: string
): Promise<void> {
  const cleanBase = config.baseUrl.replace(/\/$/, "");
  const formData = new FormData();
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  formData.append("photo", { uri, name: filename, type: mimeType } as unknown as Blob);

  const headers = buildHeaders(config.credentials);
  delete (headers as Record<string, string>)["Content-Type"];

  const response = await fetch(
    `${cleanBase}/api/service_orders/${orderId}/photos`,
    { method: "POST", headers, body: formData }
  );

  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`Erro ao enviar foto: ${response.status}`);
}

export interface MtrResult {
  mtr_id?: string | number;
  numero_mtr?: string;
  status?: string;
  pdf_url?: string;
}

export async function emitMTR(
  orderId: string | number,
  trackingCode: string
): Promise<MtrResult> {
  const WEBHOOK_BASE = "http://159.89.191.25:8000";
  const token = "econtrol";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(




      `${WEBHOOK_BASE}/mtr/emit/${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_order_id: orderId,
          tracking_code: trackingCode,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Erro ao emitir MTR: ${response.status} ${text}`);
    }
    return response.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timeout ao emitir MTR. Tente novamente.");
    }
    throw err;
  }
}

export function getVoyageName(order: ServiceOrder | null | undefined): string | null {
  if (!order) return null;
  if (order.voyage) {
    if (typeof order.voyage === "object") {
      return order.voyage.name || String(order.voyage.id || "") || null;
    }
    if (typeof order.voyage === "string") return order.voyage;
  }
  return order.voyage_name || null;
}

export function hasVoyage(order: ServiceOrder | null | undefined): boolean {
  if (!order) return false;
  return !!(order.voyage || order.voyage_name || order.voyage_id);
}

export function getRouteName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Sem Rota";
  
  // Verifica múltiplos campos possíveis para o nome da rota
  const routeName = 
    order.route_name || 
    order.collection_route || 
    (order.route as any)?.name ||
    (order.address as any)?.route_name ||
    (order.customer as any)?.route_name;
  
  return routeName || "Sem Rota";
}

export function getAddressName(order: ServiceOrder | null | undefined): string {
  if (!order) return "";
  const address = order.address || order.endereco;
  if (!address) return "";
  if (typeof address === "string") return address;
  // address é um objeto - usa to_s (endereço formatado) ou name
  return address.to_s || address.name || "";
}

export function getClientName(order: ServiceOrder | null | undefined): string {
  if (!order) return "Cliente não informado";
  // Prioridade: customer.name (API atual) > client_name > cliente_nome
  return order.customer?.name || order.client_name || order.cliente_nome || "Cliente não informado";
}
