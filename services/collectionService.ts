import axios from "axios";
import * as FileSystem from "expo-file-system";
import { getCredentials, saveServiceOrderDraft, getServiceOrderDraft, deleteServiceOrderDraft } from "@/databases/database";
import { retrieveDomain } from "./retrieveUserSession";

// Caso o documentDirectory não esteja acessível diretamente no objeto FileSystem em tempo de compilação
const documentDirectory = FileSystem.documentDirectory as string;

export interface CollectionData {
  arrival_date?: string;
  departure_date?: string;
  start_km?: string;
  end_km?: string;
  certificate_memo?: string;
  driver_observations?: string;
  service_executions?: any[];
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
 * O status "running" na OS e "checking" nos itens garante que ela apareça em "Em Conferência" no painel.
 */
export const finishOrder = async (orderId: string | number, data: CollectionData) => {
  const baseUrl = await getCleanBaseUrl();
  const credentials: any = await getCredentials();

  if (!credentials) {
    throw new Error("SESSION_EXPIRED");
  }

  // Mudamos para o endpoint PUT da OS, não o /finish
  const url = `${baseUrl}/service_orders/${orderId}`;

  const headers = {
    "Content-Type": "application/json",
    "access-token": credentials.accessToken,
    client: credentials.client,
    uid: credentials.uid,
  };

  // Envelopamos os dados em 'service_order' e injetamos o status 'running' (Em Conferência)
  const payload = {
    service_order: {
      ...data,
      status: "running", // Status global: Em Conferência
    }
  };

  try {
    console.log(`[CollectionService] Enviando OS ${orderId} para Conferência em: ${url}`);
    const response = await axios.put(url, payload, { headers, timeout: 25000 });
    await clearDraft(orderId);
    return response.data;
  } catch (error: any) {
    console.error("[CollectionService] finishOrder error:", error.response?.data || error.message);
    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");
    throw new Error(error.response?.data?.message || "Erro ao enviar para conferência.");
  }
};

export const emitMTR = async (orderId: string | number, trackingCode: string) => {
  // Webhook eControle para emissão de MTR
  const url = "http://159.89.191.25:8000/mtr/emit/econtrol";
  try {
    const response = await axios.post(url, {
      service_order_id: orderId,
      tracking_code: trackingCode,
    }, { timeout: 30000 });
    return response.data;
  } catch (error: any) {
    console.error("[CollectionService] emitMTR error:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao emitir MTR.");
  }
};

/**
 * Download de MTR em PDF.
 */
export const downloadMTR = async (mtrId: string | number, pdfUrl: string) => {
  try {
    const filename = `MTR_${mtrId}.pdf`;
    // Usamos a constante desestruturada
    const fileUri = `${documentDirectory}${filename}`;
    const downloadRes = await FileSystem.downloadAsync(pdfUrl, fileUri);
    
    if (downloadRes.status !== 200) {
      throw new Error(`Erro no download: Status ${downloadRes.status}`);
    }
    return downloadRes.uri;
  } catch (error) {
    console.error("[CollectionService] downloadMTR error:", error);
    throw error;
  }
};

/**
 * Upload de imagem diretamente para a API do eControle.
 */
export const uploadImageToS3 = async (uri: string, orderId: string | number) => {
  try {
    const baseUrl = await getCleanBaseUrl();
    const credentials: any = await getCredentials();
    
    if (!credentials) throw new Error("SESSION_EXPIRED");

    const filename = uri.split("/").pop() || `${orderId}_${Date.now()}.jpg`;
    const formData = new FormData();
    
    // @ts-ignore
    formData.append("photo", {
      uri,
      name: filename,
      type: "image/jpeg",
    });
    
    console.log(`[CollectionService] Enviando foto para OS ${orderId}...`);
    const response = await axios.post(`${baseUrl}/service_orders/${orderId}/photos`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "access-token": credentials.accessToken,
        client: credentials.client,
        uid: credentials.uid,
      },
      timeout: 30000
    });

    return response.data;
  } catch (error: any) {
    console.error("[CollectionService] Photo upload error:", error.response?.data || error.message);
    if (error.response?.status === 401) throw new Error("SESSION_EXPIRED");
    throw new Error("Erro ao fazer upload da foto.");
  }
};
