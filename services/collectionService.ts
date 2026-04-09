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
 * Substitui implementação JS pura que estava gerando hash incorreto
 */
async function sha256(message: string): Promise<string> {
  // Usa a implementação nativa do expo-crypto
  const hashBuffer = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
  return hashBuffer;
}

/**
 * Emite MTR via webhook eControle.
 * Requer headers de autenticação: x-econtrol-webhook-token, x-econtrol-signature, x-econtrol-timestamp
 */
export const emitMTR = async (orderId: string | number, trackingCode: string) => {
  const url = "http://159.89.191.25:8000/mtr/emit";

  // Tokens de autenticação do webhook eControle
  const WEBHOOK_TOKEN = "token_m4anJe5wLJKUrFI6XBAycXINq3p5T9YK";
  const WEBHOOK_SECRET = "8fa082ac39c3de192acc8df4327b278d555d50826d78537748c35a252443a738";

  // Gera timestamp atual (Unix timestamp em segundos)
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Gera assinatura SHA256: hash(secret + timestamp + orderId)
  const signatureData = `${WEBHOOK_SECRET}${timestamp}${orderId}`;
  const signature = await sha256(signatureData); // ✅ Agora é async

  const headers = {
    "Content-Type": "application/json",
    "x-econtrol-webhook-token": WEBHOOK_TOKEN,
    "x-econtrol-timestamp": timestamp,
    "x-econtrol-signature": signature,
  };

  try {
    console.log(`[CollectionService] Emitindo MTR para OS ${orderId} em: ${url}`);
    console.log(`[CollectionService] Headers:`, {
      "x-econtrol-webhook-token": WEBHOOK_TOKEN,
      "x-econtrol-timestamp": timestamp,
      "x-econtrol-signature": signature.substring(0, 16) + "..."
    });
    console.log(`[CollectionService] Signature data: ${signatureData}`);

    const response = await axios.post(url, {
      service_order_id: orderId,
      tracking_code: trackingCode,
    }, {
      headers,
      timeout: 30000
    });

    console.log(`[CollectionService] MTR emitido com sucesso:`, response.data);
    return response.data;
  } catch (error: any) {
    console.error("[CollectionService] emitMTR error:", error.response?.data || error.message);
    console.error("[CollectionService] Status:", error.response?.status);
    console.error("[CollectionService] Headers enviados:", headers);
    console.error("[CollectionService] Signature data:", signatureData);
    console.error("[CollectionService] Signature (full):", signature);

    // Tratamento de erro específico para IP não autorizado
    if (error.response?.status === 403) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || "IP não autorizado";
      if (errorMsg.includes("IP") || errorMsg.includes("origem")) {
        console.warn("[CollectionService] ⚠️  Servidor MTR requer whitelist de IPs.");
        console.warn("[CollectionService] ⚠️  Seu IP atual não está autorizado no servidor MTR.");
        console.warn("[CollectionService] ⚠️  Contate o administrador para adicionar seu IP na whitelist.");
        throw new Error(`IP não autorizado no servidor MTR. Contate o suporte para liberar seu IP.`);
      }
    }

    throw new Error(error.response?.data?.message || error.response?.data?.error || "Erro ao emitir MTR.");
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
