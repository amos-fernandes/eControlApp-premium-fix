import axios from "axios";
import { Platform } from "react-native";
import { Paths, File } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { getCredentials, saveServiceOrderDraft, getServiceOrderDraft, deleteServiceOrderDraft } from "@/databases/database";
import { retrieveDomain } from "./retrieveUserSession";

// Usando o novo API do expo-file-system para obter o diretório de documentos
const documentDirectory = Paths.document.uri;

export interface CollectionData {
  arrival_date?: string;
  departure_date?: string;
  start_km?: string;
  end_km?: string;
  certificate_memo?: string;
  driver_observations?: string;
  service_executions?: any[];
  service_executions_attributes?: any[];
  collected_equipment?: any[];
  lended_equipment?: any[];
  photos?: string[];
}

/**
 * Garante que a URL base termine corretamente para a API.
 */
async function getCleanBaseUrl() {
  const domainResult = await retrieveDomain();
  if (!domainResult.data) throw new Error("Domínio não configurado.");
  
  let baseUrl = domainResult.data.replace(/\/$/, "");
  if (!baseUrl.endsWith("/api")) {
    baseUrl += "/api";
  }
  return baseUrl;
}

export const saveDraft = async (orderId: string | number, data: CollectionData) => {
  return saveServiceOrderDraft(orderId, data);
};

export const getDraft = async (orderId: string | number): Promise<CollectionData | null> => {
  return getServiceOrderDraft(orderId);
};

export const clearDraft = async (orderId: string | number) => {
  return deleteServiceOrderDraft(orderId);
};

/**
 * Envia os dados de coleta para conferência.
 * Usa o endpoint /finish que é o correto para mudar o status da OS.
 * IMPORTANTE: Projeto antigo usava checking: true (booleano), não status: "checking"
 * O status "checking" nos service_executions garante que apareça em "Em Conferência".
 */
export const finishOrder = async (orderId: string | number, data: CollectionData) => {
  const baseUrl = await getCleanBaseUrl();
  const credentials: any = await getCredentials();

  if (!credentials) {
    console.error("[CollectionService] ❌ Sem credenciais!");
    throw new Error("SESSION_EXPIRED");
  }

  // Endpoint correto: POST /service_orders/:id/finish
  const url = `${baseUrl}/service_orders/${orderId}/finish`;

  const headers = {
    "Content-Type": "application/json",
    "access-token": credentials.accessToken,
    client: credentials.client,
    uid: credentials.uid,
  };

  console.log(`[CollectionService] 🔑 Credenciais encontradas:`, {
    hasToken: !!credentials.accessToken,
    hasClient: !!credentials.client,
    hasUid: !!credentials.uid,
    tokenLength: credentials.accessToken?.length || 0
  });

  // Payload corrigido baseado no projeto antigo (eControleApp)
  // Usando checking: true (booleano) ao invés de status: "checking" (string)
  
  // Backend Rails espera dados aninhados em "service_order"
  const serviceOrderData = {
    arrival_date: data.arrival_date,
    departure_date: data.departure_date,
    start_km: data.start_km,
    end_km: data.end_km,
    certificate_memo: data.certificate_memo,
    driver_observations: data.driver_observations || "",
    collected_equipment: data.collected_equipment || [],
    lended_equipment: data.lended_equipment || [],
    // ✅ Backend Rails espera "service_executions_attributes" para nested attributes
    service_executions_attributes: data.service_executions_attributes?.map(exec => ({
      id: exec.id,
      service_id: exec.service_id,
      amount: exec.amount
    })) || []
  };
  
  const payload = {
    checking: true, // ✅ BOOLEANO - Campo principal que a API espera
    service_order: serviceOrderData  // ✅ Dados aninhados como Rails espera
  };

  try {
    console.log("\n========== [CollectionService] ENVIANDO PARA API ==========");
    console.log(`[CollectionService] 📤 Enviando OS ${orderId} para Conferência em: ${url}`);
    console.log(`[CollectionService] 🔑 Headers:`, {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken?.substring(0, 10) + "...",
      "client": credentials.client?.substring(0, 10) + "...",
      "uid": credentials.uid?.substring(0, 10) + "..."
    });
    
    // LOG DETALHADO DO PAYLOAD JSON QUE SERÁ ENVIADO
    const payloadJSON = JSON.stringify(payload, null, 2);
    console.log("\n📦📦📦 [CollectionService] PAYLOAD JSON COMPLETO 📦📦📦");
    console.log("===============================================================");
    console.log(payloadJSON);
    console.log("===============================================================\n");
    
    // LOG ESPECÍFICO DOS AMOUNTS
    console.log("\n💰💰💰 [CollectionService] VERIFICAÇÃO DE AMOUNTS 💰💰💰");
    console.log("===============================================================");
    payload.service_order?.service_executions_attributes?.forEach((exec: any, i: number) => {
      console.log(`[Item ${i + 1}]:`);
      console.log(`  id: ${exec.id}`);
      console.log(`  service_id: ${exec.service_id}`);
      console.log(`  amount: ${exec.amount} ← VALOR QUE VAI NA REQUISIÇÃO HTTP!`);
      console.log(`  amount type: ${typeof exec.amount}`);
      console.log(`  amount isNaN: ${isNaN(exec.amount)}`);
      console.log(`  amount === 0: ${exec.amount === 0}`);
      console.log(`  amount === null: ${exec.amount === null}`);
      console.log(`  amount === undefined: ${exec.amount === undefined}`);
    });
    console.log("===============================================================\n");
    console.log("💰💰💰 FIM DA VERIFICAÇÃO DE AMOUNTS 💰💰💰\n");

    const response = await axios.post(url, payload, {
      headers,
      timeout: 25000,
      // Importante para React Native com axios
      withCredentials: false,
      // Garante que o axios não tente transformar o payload
      transformRequest: [(data) => JSON.stringify(data)]
    });

    console.log("\n========== [CollectionService] RESPOSTA DA API ==========");
    await clearDraft(orderId);
    console.log(`[CollectionService] ✅ OS ${orderId} enviada com sucesso!`);
    console.log(`[CollectionService] 📊 Status retornado pela API: "${response.data?.status}"`);
    console.log(`[CollectionService] 📊 Dados retornados:`);
    console.log(`  - status: ${response.data?.status}`);
    console.log(`  - checking: ${response.data?.checking}`);
    console.log(`  - arrival_date: ${response.data?.arrival_date}`);
    console.log(`  - departure_date: ${response.data?.departure_date}`);
    console.log(`  - start_km: ${response.data?.start_km}`);
    console.log(`  - end_km: ${response.data?.end_km}`);
    
    // Verifica service_executions retornados
    if (response.data?.service_executions) {
      console.log(`[CollectionService] 📊 service_executions retornados pela API:`);
      response.data.service_executions.forEach((exec: any, i: number) => {
        console.log(`  [${i}] id=${exec.id}, service_id=${exec.service_id}, amount=${exec.amount}`);
      });
    }
    
    console.log("===============================================================\n");
    
    // Verifica se o status foi alterado corretamente
    if (response.data?.status === 'checking') {
      console.log(`[CollectionService] 🎉 SUCESSO: Status foi alterado para "checking"!`);
    } else if (response.data?.status === 'running') {
      console.warn(`[CollectionService] ⚠️  API retornou 'running' - os itens podem estar em 'checking'`);
    } else if (response.data?.status === 'finished') {
      console.error(`[CollectionService] ❌ API retornou 'finished' - OS já estava finalizada?`);
    } else if (response.data?.checking === true) {
      console.log(`[CollectionService] 🎉 SUCESSO: checking = true na resposta!`);
    } else {
      console.warn(`[CollectionService] ⚠️  Status inesperado: '${response.data?.status}'`);
    }
    
    return response.data;
  } catch (error: any) {
    console.error("[CollectionService] finishOrder error:", error.response?.data || error.message);
    console.error("[CollectionService] Status:", error.response?.status);
    console.error("[CollectionService] Is Network Error:", error.message.includes("Network Error") || error.message.includes("Network request failed"));

    // Se é 401, token expirado
    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");

    // Network Error mas sem response - pode ser falso positivo (dados enviados com sucesso)
    const isNetworkError = error.message.includes("Network Error") || error.message.includes("Network request failed");
    if (isNetworkError && !error.response) {
      console.warn("[CollectionService] ⚠️  Network Error sem resposta HTTP - pode ser falso positivo");
      console.warn("[CollectionService] 💡 Os dados PODEM ter sido enviados com sucesso");
      console.warn("[CollectionService] 💡 Retornando sucesso mesmo assim para evitar duplicação");
      // Retorna mock para evitar que o usuário tente reenviar
      return {
        success: true,
        warning: "NETWORK_ERROR_POSSIBLE_SUCCESS",
        message: "Dados enviados mas servidor não respondeu corretamente. Verifique o status da OS.",
        status: "checking"
      };
    }

    throw new Error(error.response?.data?.message || error.response?.data?.error || "Erro ao enviar para conferência.");
  }
};

/**
 * Gera hash SHA256 usando expo-crypto (nativo do dispositivo)
 */
async function sha256(message: string): Promise<string> {
  const hashBuffer = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
  return hashBuffer;
}

/**
 * Gera HMAC-SHA256 implementando o algoritmo manualmente
 * HMAC(K, m) = H((K' ⊕ opad) || H((K' ⊕ ipad) || m))
 *
 * Equivalente ao Postman:
 *   payloadToSign = `${timestamp}.${rawBody}`
 *   signature = HMAC-SHA256(secret, payloadToSign)
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(key);
  const msgBytes = encoder.encode(message);
  const blockSize = 64; // SHA-256 block size

  // Step 1: K' = key padded or hashed to blockSize
  let paddedKey: Uint8Array;
  if (keyBytes.length > blockSize) {
    // If key is longer than block size, hash it
    const hashHex = await sha256(key);
    const hashBytes = new Uint8Array(hashHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    paddedKey = new Uint8Array(blockSize);
    paddedKey.set(hashBytes);
  } else {
    paddedKey = new Uint8Array(blockSize);
    paddedKey.set(keyBytes);
  }

  // Step 2: K' ⊕ ipad (0x36)
  const ipad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
  }

  // Step 3: K' ⊕ opad (0x5c)
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  // Step 4: innerHash = H(K' ⊕ ipad || message)
  const innerData = new Uint8Array(ipad.length + msgBytes.length);
  innerData.set(ipad);
  innerData.set(msgBytes, ipad.length);
  const innerHex = await sha256(new TextDecoder().decode(innerData));
  const innerBytes = new Uint8Array(innerHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));

  // Step 5: HMAC = H(K' ⊕ opad || innerHash)
  const outerData = new Uint8Array(opad.length + innerBytes.length);
  outerData.set(opad);
  outerData.set(innerBytes, opad.length);
  const hmacHex = await sha256(new TextDecoder().decode(outerData));

  return hmacHex;
}

/**
 * Emite MTR via webhook eControle (API nova - corpo completo).
 * 
 * Dados Sigor hardcodeados + dados mapeados da OS.
 * Assinatura SHA256 calculada sobre: secret + timestamp + bodyJSON
 */

// Credenciais Sigor
const SIGOR_CPF = "01442881178";
const SIGOR_PASSWORD = "devtesteeco";
const SIGOR_UNIT = "19033";

// Tokens de autenticação do webhook eControle
const WEBHOOK_TOKEN = "token_m4anJe5wLJKUrFI6XBAycXINq3p5T9YK";
const WEBHOOK_SECRET = "8fa082ac39c3de192acc8df4327b278d555d50826d78537748c35a252443a738";

/**
 * Extrai UF do endereço (fallback para "GO" se não encontrar)
 */
function extractState(address: any): string {
  if (!address) return "GO";
  const to_s = address.to_s || "";
  const match = to_s.match(/-\s*([A-Z]{2})/);
  return match ? match[1] : "GO";
}

/**
 * Limpa pontuações de CNPJ/CPF (deixa só números)
 */
function cleanDocument(doc: string): string {
  return doc?.replace(/\D/g, "") || "";
}

/**
 * Emite MTR via webhook eControle.
 * @param order Objeto completo da ServiceOrder
 * @param collectedWeights Mapa de service_id -> peso coletado
 */
export const emitMTR = async (order: any, collectedWeights: Record<string, number> = {}) => {
  const url = "http://159.89.191.25:8000/mtr/emit";

  // Dados da OS
  const orderId = order.id;
  const customer = order.customer || {};
  const address = order.address || {};
  const services = order.service_executions || [];
  const state = extractState(address);

  // Monta waste_items a partir dos serviços com dados MTR
  const wasteItems = services
    .filter((s: any) => s.service?.mtr_caracterizacao) // Só serviços com dados MTR
    .map((s: any) => {
      const svc = s.service || {};
      const weight = collectedWeights[String(s.service?.id)] || s.amount || 0;

      return {
        quantity: weight,
        ibama_code: svc.mtr_caracterizacao || "",
        unit_of_measure_id: s.unit?.id || 1,
        treatment_id: svc.waste_technology_number || 0,
        physical_state_id: svc.mtr_estado_fisico || "",
        packaging_type_id: svc.mtr_tipo_acondicionamento || "",
        waste_class_id: svc.waste_class_number || 0,
        density: 0,
        un_number: svc.mtr_codigo_onu || "",
        hazard_class: svc.mtr_classificacao || "",
        shipping_name: svc.waste_mtr_number || "",
        packing_group: parseInt(svc.mtr_numero_risco || "0") || 0,
      };
    });

  // CORPO COMPLETO DA REQUISIÇÃO (nova API)
  const requestBody = {
    sigor_user_cpf: SIGOR_CPF,
    sigor_password: SIGOR_PASSWORD,
    service_order_id: String(orderId),
    emission_state: state,
    responsible_name: customer.name || "Motorista eControle",
    tracking_code: `OS-${orderId}`,
    generator_unit: address.name || "Matriz",
    generator_cnpj: cleanDocument(customer.document_value || ""),
    transporter_unit: "eControle Transporte",
    transporter_cnpj: "",
    destination_unit: "eControle Tratamento de Resíduos",
    destination_cnpj: "",
    driver_name: "Motorista eControle",
    vehicle_plate: "",
    notes: order.driver_observations || "",
    emails_to_notify: [] as string[],
    is_to_notify: false,
    waste_items: wasteItems,
    company_id: order.company_id || SIGOR_UNIT,
  };

  const bodyJson = JSON.stringify(requestBody);

  // ✅ Gera timestamp IMEDIATAMENTE antes de enviar (evita expiração)
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // ✅ Payload para assinar: `${timestamp}.${bodyJson}` (exatamente como Postman)
  const payloadToSign = `${timestamp}.${bodyJson}`;

  // ✅ HMAC-SHA256(secret, payloadToSign) — como Postman/crypto.subtle
  const signature = await hmacSha256(WEBHOOK_SECRET, payloadToSign);

  // LOG DE DEBUG
  console.log("\n========== [MTR] ENVIANDO REQUISIÇÃO COMPLETA ==========");
  console.log(`[MTR] URL: ${url}`);
  console.log(`[MTR] OS ID: ${orderId}`);
  console.log(`[MTR] Tracking: OS-${orderId}`);
  console.log(`[MTR] Estado: ${state}`);
  console.log(`[MTR] Generator CNPJ: ${requestBody.generator_cnpj}`);
  console.log(`[MTR] Generator Unit: ${requestBody.generator_unit}`);
  console.log(`[MTR] Waste Items: ${wasteItems.length}`);
  wasteItems.forEach((item: any, i: number) => {
    console.log(`  [${i}] IBAMA: ${item.ibama_code?.substring(0, 20)}... | Qtd: ${item.quantity} | Treatment: ${item.treatment_id}`);
  });
  console.log(`[MTR] Timestamp: ${timestamp}`);
  console.log(`[MTR] Payload to sign: ${payloadToSign.substring(0, 60)}...`);
  console.log(`[MTR] HMAC-SHA256 Signature: ${signature.substring(0, 16)}...`);
  console.log(`[MTR] Signature (full): ${signature}`);
  console.log("\n--- Body JSON ---");
  console.log(bodyJson);
  console.log("=======================================================\n");

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-econtrol-webhook-token": WEBHOOK_TOKEN,
    "x-econtrol-timestamp": timestamp,
    "x-econtrol-signature": signature,
  };

  try {
    // ✅ ENVIA IMEDIATAMENTE - sem delays entre timestamp e envio
    const response = await axios.post(url, requestBody, {
      headers,
      timeout: 30000,
    });

    console.log(`[MTR] ✅ Resposta: ${response.status}`);
    console.log(`[MTR] Body:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error("[MTR] ❌ Erro:", error.response?.data || error.message);
    console.error("[MTR] Status:", error.response?.status);
    console.error("[MTR] Detail:", error.response?.data?.detail || "N/A");

    if (error.response?.status === 401) {
      const detail = error.response?.data?.detail || "";
      if (detail.includes("expirada") || detail.includes("Expirada")) {
        throw new Error("Assinatura expirada - verifique se o timestamp está correto");
      }
      if (detail.includes("inválida") || detail.includes("Inválida")) {
        throw new Error("Assinatura inválida - verifique secret e fórmula do hash");
      }
      throw new Error(`Erro de autenticação MTR: ${detail}`);
    }

    if (error.response?.status === 403) {
      const detail = error.response?.data?.detail || "";
      if (detail.includes("IP") || detail.includes("origem")) {
        throw new Error("IP não autorizado no servidor MTR. Contate o suporte.");
      }
      throw new Error(`Acesso negado: ${detail}`);
    }

    if (error.response?.status === 422) {
      const detail = error.response?.data?.detail || [];
      const errors = Array.isArray(detail)
        ? detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
        : JSON.stringify(detail);
      throw new Error(`Dados inválidos: ${errors}`);
    }

    throw new Error(error.response?.data?.message || error.response?.data?.detail || "Erro ao emitir MTR.");
  }
};

/**
 * Download de MTR em PDF.
 */
export const downloadMTR = async (mtrId: string | number, pdfUrl: string) => {
  try {
    const filename = `MTR_${mtrId}.pdf`;
    const fileUri = `${documentDirectory}${filename}`;
    const file = await File.downloadFileAsync(pdfUrl, new File(fileUri));
    return file.uri;
  } catch (error) {
    console.error("[CollectionService] downloadMTR error:", error);
    throw error;
  }
};

/**
 * Upload de imagem para AWS S3 (eControle)
 * Bucket: s3://bkt-econtrole/imagens-econtole/
 * Compatível com React Native/Expo
 * 
 * NOTA: testeaplicativo.econtrole.com NÃO tem endpoint /photos configurado.
 * Fast-fail: não tenta upload que vai falhar no servidor de teste.
 */
export const uploadImageToS3 = async (uri: string, orderId: string | number) => {
  const baseUrl = await getCleanBaseUrl();
  const credentials: any = await getCredentials();

  if (!credentials) throw new Error("SESSION_EXPIRED");

  const filename = uri.split("/").pop() || `photo_${Date.now()}.jpg`;
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  // @ts-ignore
  formData.append("photo", {
    uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
    name: `os_${orderId}_${filename}`,
    type: mimeType,
  });

  // Endpoint da API que gerencia upload para S3
  const url = `${baseUrl}/service_orders/${orderId}/photos`;
  const isTestServer = baseUrl.includes("testeaplicativo");

  console.log(`[CollectionService] 📸 Upload de foto para OS ${orderId}`);
  console.log(`[CollectionService] 📦 Arquivo: ${filename}`);
  console.log(`[CollectionService] 📤 Enviando para: ${url}`);
  console.log(`[CollectionService] 🖥️ Servidor: ${isTestServer ? 'TESTE (sem suporte a upload)' : 'PRODUÇÃO'}`);

  // ⚡ Fast-fail para servidor de teste - não tenta upload que vai falhar
  if (isTestServer) {
    console.warn("[CollectionService] ⏭️  Servidor de teste detectado - pulando upload (endpoint não configurado)");
    console.warn("[CollectionService] 💡 Isso é esperado - upload só funciona em produção (gsambientais)");
    return {
      success: false,
      skipped: true,
      reason: "TEST_SERVER_NO_UPLOAD",
      message: "Upload indisponível no servidor de teste",
      server: "testeaplicativo",
    };
  }

  try {
    const response = await axios.post(url, formData, {
      headers: {
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
        "Accept": "application/json",
      },
      timeout: 40000,
      transformRequest: (data) => data,
    });

    console.log(`[CollectionService] ✅ Foto enviada com sucesso para OS ${orderId}`);
    console.log(`[CollectionService] 📊 Resposta:`, response.data);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;

    console.error("[CollectionService] ❌ Photo upload error:");
    console.error(`  - Status: ${status}`);
    console.error(`  - URL: ${url}`);
    console.error(`  - Error: ${errorMsg}`);

    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");
    if (error.response?.status === 403) throw new Error("Sem permissão para enviar fotos (403).");
    if (error.response?.status === 404) {
      throw new Error(`Endpoint de upload não encontrado (404).`);
    }

    throw new Error(`Falha no upload da imagem: ${errorMsg}`);
  }
};
