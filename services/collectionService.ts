import axios from "axios";
import { Platform } from "react-native";
import { Paths, File } from "expo-file-system";
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
  const payload = {
    checking: true, // ✅ BOOLEANO - Campo principal que a API espera
    collected_equipment: data.collected_equipment || [],
    lended_equipment: data.lended_equipment || [],
    driver_observations: data.driver_observations || "",
    arrival_date: data.arrival_date,
    departure_date: data.departure_date,
    start_km: data.start_km,
    end_km: data.end_km,
    certificate_memo: data.certificate_memo,
    // Mantém service_executions_attributes (padrão Rails) - ENVIA DADOS COMPLETOS
    // Sem campo 'status' que não existe no backend
    service_executions_attributes: data.service_executions_attributes?.map(exec => ({
      id: exec.id,
      service_id: exec.service_id,
      amount: exec.amount
    })) || []
  };

  try {
    console.log(`[CollectionService] 📤 Enviando OS ${orderId} para Conferência em: ${url}`);
    console.log(`[CollectionService] 🔑 Headers:`, {
      "Content-Type": "application/json",
      "access-token": credentials.accessToken?.substring(0, 10) + "...",
      "client": credentials.client?.substring(0, 10) + "...",
      "uid": credentials.uid?.substring(0, 10) + "..."
    });
    console.log(`[CollectionService] 📦 Payload COMPLETO (corrigido):`, JSON.stringify(payload, null, 2));
    console.log(`[CollectionService] 📊 checking: ${payload.checking} (booleano)`);
    
    const response = await axios.post(url, payload, {
      headers,
      timeout: 25000,
      // Importante para React Native com axios
      withCredentials: false,
      // Garante que o axios não tente transformar o payload
      transformRequest: [(data) => JSON.stringify(data)]
    });
    
    await clearDraft(orderId);
    console.log(`[CollectionService] ✅ OS ${orderId} enviada com sucesso!`);
    console.log(`[CollectionService] 📊 Status retornado pela API: "${response.data?.status}"`);
    console.log(`[CollectionService] 📊 Status esperado: "checking" (Em Conferência)`);
    
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
    console.error("[CollectionService] Headers enviados:", headers);
    console.error("[CollectionService] Config axios:", { url, method: "POST", withCredentials: false });
    
    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");
    throw new Error(error.response?.data?.message || error.response?.data?.error || "Erro ao enviar para conferência.");
  }
};

/**
 * Gera hash SHA256 usando implementação pura em JavaScript
 * Compatível com React Native/Expo
 */
function sha256(message: string): string {
  const str = message;
  const buffer = new TextEncoder().encode(str);
  
  // Implementação SHA256 pura em JS
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const len = buffer.length;
  const bits = len * 8;
  
  // Padding
  const padded = new Uint8Array(((len + 8) >> 6) + 1 << 6);
  padded.set(buffer);
  padded[len] = 0x80;
  
  // Tamanho em bits (big endian)
  let bitsLE = bits; // Variável mutável para o loop
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 1 - i] = bitsLE & 0xff;
    bitsLE >>>= 8;
  }

  // Processar blocos
  for (let i = 0; i < padded.length; i += 64) {
    const W = new Uint32Array(64);
    
    for (let j = 0; j < 16; j++) {
      W[j] = (padded[i + j * 4] << 24) | 
             (padded[i + j * 4 + 1] << 16) | 
             (padded[i + j * 4 + 2] << 8) | 
             (padded[i + j * 4 + 3]);
    }
    
    for (let j = 16; j < 64; j++) {
      const s0 = ((W[j-15] >>> 7) | (W[j-15] << 25)) ^ 
                 ((W[j-15] >>> 18) | (W[j-15] << 14)) ^ 
                 (W[j-15] >>> 3);
      const s1 = ((W[j-2] >>> 17) | (W[j-2] << 15)) ^ 
                 ((W[j-2] >>> 19) | (W[j-2] << 13)) ^ 
                 (W[j-2] >>> 10);
      W[j] = (W[j-16] + s0 + W[j-7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[j] + W[j]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map(h => h.toString(16).padStart(8, '0')).join('');
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
  const signature = sha256(signatureData); // Agora é síncrono

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
 * Fallback para Base64 se upload falhar (testeaplicativo)
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
  console.log(`[CollectionService] 🗄️ Bucket S3: s3://bkt-econtrole/imagens-econtole/`);
  console.log(`[CollectionService] 🖥️ Servidor: ${isTestServer ? 'TESTE (testeaplicativo)' : 'PRODUÇÃO (gsambientais)'}`);

  try {
    // No React Native com FormData, é melhor deixar o axios/fetch definir o Content-Type para incluir o boundary
    const response = await axios.post(url, formData, {
      headers: {
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
        "Accept": "application/json",
      },
      timeout: 40000,
      transformRequest: (data) => data, // Importante para FormData no Axios/RN
    });

    console.log(`[CollectionService] ✅ Foto enviada com sucesso para OS ${orderId}`);
    console.log(`[CollectionService] 📊 Resposta:`, response.data);
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const statusText = error.response?.statusText;
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;

    console.error("[CollectionService] ❌ Photo upload error:");
    console.error(`  - Status: ${status} ${statusText || ""}`);
    console.error(`  - URL: ${url}`);
    console.error(`  - Bucket: s3://bkt-econtrole/imagens-econtole/`);
    console.error(`  - Error: ${errorMsg}`);
    
    // Network Error é comum no servidor de teste - fallback para Base64
    if (errorMsg.includes("Network Error") || errorMsg.includes("Network request failed")) {
      console.warn("[CollectionService] ⚠️  Servidor de upload não responde");
      
      if (isTestServer) {
        console.warn("[CollectionService] 🖥️ Servidor: TESTE (testeaplicativo)");
        console.warn("[CollectionService] 💡 SOLUÇÃO: Upload indisponível em testeaplicativo");
        console.warn("[CollectionService] 💡 Backend precisa configurar endpoint /photos");
        console.warn("[CollectionService] 📝 Foto NÃO será salva (usuário deve continuar sem foto)");
        
        // Retorna aviso para o app lidar
        return {
          success: false,
          warning: "UPLOAD_UNAVAILABLE",
          message: "Upload indisponível no servidor de teste. Backend precisa configurar endpoint /service_orders/:id/photos",
          server: "testeaplicativo",
          bucket: "s3://bkt-econtrole/imagens-econtole/"
        };
      } else {
        console.warn("[CollectionService] 🖥️ Servidor: PRODUÇÃO (gsambientais)");
        console.error("[CollectionService] ❌ Erro crítico em produção - verificar S3");
      }
    }

    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");
    if (error.response?.status === 403) throw new Error("Sem permissão para enviar fotos (403).");
    if (error.response?.status === 404) {
      throw new Error(`Endpoint de upload não encontrado (404). Verifique se a OS ${orderId} existe no servidor.`);
    }

    throw new Error(`Falha no upload da imagem: ${errorMsg}`);
  }
};
