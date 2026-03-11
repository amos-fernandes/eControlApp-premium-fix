import axios, { AxiosError } from "axios";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import api from "./connection";
import { retrieveDomain } from "./retrieveUserSession";
import { getCredentials } from "../databases/database";

// ============================================================================
// Constantes
// ============================================================================
const CETESB_TOKEN_URL = "https://mtrr-hom.cetesb.sp.gov.br/apiws/rest/gettoken";
const ECONTROL_BASE_URL = "http://159.89.191.25:8000";
const ECONTROL_EMIT_URL = `${ECONTROL_BASE_URL}/mtr/webhook/econtrol/emit`;
const ECONTROL_DOWNLOAD_URL = `${ECONTROL_BASE_URL}/mtr/webhook`;

// ============================================================================
// Tipos & Interfaces
// ============================================================================

/**
 * Credenciais para requisição de token CETESB
 */
export interface CetesbTokenRequest {
  cpfCnpj: string;
  senha: string;
  unidade: string;
}

/**
 *  MTR emissão
 */
export interface WasteItem {
  quantity: number;
  ibama_code: string;
  unit_of_measure_id: number;
  treatment_id: number;
  physical_state_id: number;
  packaging_type_id: number;
  waste_class_id: number;
  density: number;
  un_number: string;
  hazard_class: string;
  shipping_name: string;
  packing_group: number;
}

/**
 * Payload para MTR emissão via webhook
 */
export interface EmitMTRPayload {
  emission_state?: string;
  responsible_name?: string;
  emails_to_notify?: string[];
  is_to_notify?: boolean;
  generator_unit?: string;
  generator_cnpj?: string;
  transporter_unit?: string;
  transporter_cnpj?: string;
  destination_unit?: string;
  destination_cnpj?: string;
  driver_name?: string;
  vehicle_plate?: string;
  notes?: string;
  waste_items?: WasteItem[];
  company_id?: string;
  service_order_id?: string;
  tracking_code?: string;
  [key: string]: any; // permito propriedades adicionais para flexibilidade
}

/**
 * Resultado do MTR emissão
 */
export interface EmitMTRResult {
  mtr_id: string | number;
  status?: string;
  message?: string;
  [key: string]: any;
}

/**
 * Resultado do MTR download
 */
export interface DownloadMTRResult {
  localUri: string;
  filename: string;
}

/**
 * Função auxiliar para emitir MTR
 */
export interface EmitMTROptions {
  companyId: string;
  serviceOrderId: string;
  trackingCode: string;
  wasteItems?: WasteItem[];
  cetesbCredentials?: CetesbTokenRequest;
  onStart?: () => void;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Funções
// ============================================================================

/**
 * Obtenho um token de acesso do CETESB SIGOR
 * 
 * @param credentials - Credenciais CETESB (cpfCnpj, senha, unidade)
 * @returns O token de acesso string
 * @throws Error se o token não for obtido ou se a requisição falhar
 */
export async function getTokenCetesb(credentials: CetesbTokenRequest): Promise<string> {
  try {
    const response = await axios.post(
      CETESB_TOKEN_URL,
      {
        cpfCnpj: credentials.cpfCnpj,
        senha: credentials.senha,
        unidade: credentials.unidade,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000, // 15 segundos de timeout
      }
    );

    // Verifico o token em vários campos de nomes possíveis (access_token, token, accessToken)
    const data = response.data;
    const token = data?.access_token || data?.token || data?.accessToken;

    if (!token) {
      throw new Error(`Token not found in response. Fields: ${JSON.stringify(Object.keys(data))}`);
    }

    return token;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    const responseBody = axiosError.response?.data 
      ? JSON.stringify(axiosError.response.data) 
      : "No response body";
    
    throw new Error(
      `getTokenCetesb → ${error.message || "Unknown error"}. Response: ${responseBody}`
    );
  }
}

/**
 * Emito um MTR via webhook eControle
 * 
 * @param payload - Payload de emissão MTR
 * @param accessToken - Token de acesso CETESB (usado como parâmetro de caminho)
 * @returns O resultado da emissão contendo mtr_id
 * @throws Error se a emissão falhar 
 */
export async function emitMTRWebhook(
  payload: EmitMTRPayload,
  accessToken: string
): Promise<EmitMTRResult> {
  try {
    // Insiro o token como parâmetro de caminho na URL.
    const url = `${ECONTROL_EMIT_URL}/${accessToken}`;

    const response = await axios.post<EmitMTRResult>(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 segundos timeout
    });

    return response.data;
  } catch (error: any) {
    const axiosError = error as AxiosError;
    const responseBody = axiosError.response?.data 
      ? JSON.stringify(axiosError.response.data) 
      : "No response body";
    
    throw new Error(
      `emitMTRWebhook → ${error.message || "Unknown error"}. Response: ${responseBody}`
    );
  }
}

/**
 * Faço download do arquivo PDF do MTR
 * 
 * @param mtrId - O ID do MTR para download
 * @param filename - Nome de arquivo personalizado opcional (padrão: mtr-{mtrId}.pdf)
 * @param autoShare - Se devo abrir a caixa de diálogo de compartilhamento automaticamente (padrão: verdadeiro)
 * @returns Objeto com localUri e filename
 * @throws Error se o download falhar 
 */
export async function downloadMTR(
  mtrId: string | number,
  filename?: string,
  autoShare: boolean = true
): Promise<DownloadMTRResult> {
  try {
    const downloadFilename = filename || `mtr-${mtrId}.pdf`;
    const downloadUrl = `${ECONTROL_DOWNLOAD_URL}/${mtrId}/download`;
    const localUri = `${FileSystem.documentDirectory}${downloadFilename}`;

    // Uso FileSystem.downloadAsync para download mobile
    const downloadResult = await FileSystem.downloadAsync(
      downloadUrl,
      localUri
    );

    // se autoShare estiver ativo e compartilhamento disponível, abro diálogo de compartilhamento
    if (autoShare && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: "application/pdf",
        dialogTitle: `Compartilhar MTR ${mtrId}`,
      });
    }

    return {
      localUri: downloadResult.uri,
      filename: downloadFilename,
    };
  } catch (error: any) {
    throw new Error(`downloadMTR → ${error.message || "Unknown error"}`);
  }
}

/**
 * Orquestro o fluxo completo de emissão:
 * 1. Obtenho token CETESB
 * 2. Emito MTR via webhook
 * 3. Opcionalmente faço download do PDF
 * 
 * @param payload - Payload de emissão MTR
 * @param cetesbCredentials - Credenciais CETESB para obtenção do token
 * @param autoDownload - Se devo fazer o download automaticamente após a emissão. (padrão: false)
 * @returns Objeto com resultado de emissão e resultado de download opcional
 */
export async function emitMTRCompleto(
  payload: EmitMTRPayload,
  cetesbCredentials: CetesbTokenRequest,
  autoDownload: boolean = false
): Promise<{
  emission: EmitMTRResult;
  download?: DownloadMTRResult;
}> {
  // Passo 1: Obtenho token CETESB
  const accessToken = await getTokenCetesb(cetesbCredentials);

  // Passo 2: Emito MTR via webhook
  const emission = await emitMTRWebhook(payload, accessToken);

  // Passo 3: Opcionalmente faço download do PDF
  let download: DownloadMTRResult | undefined;
  if (autoDownload && emission.mtr_id) {
    download = await downloadMTR(emission.mtr_id);
  }

  return {
    emission,
    download,
  };
}

/**
 * Construo uma carga útil MTR padrão com substituições opcionais.
 * 
 * @param overrides - Payload parcial para sobrescrever padrões
 * @returns EmitMTRPayload completo
 */
export function buildDefaultPayload(overrides: Partial<EmitMTRPayload> = {}): EmitMTRPayload {
  const defaultPayload: EmitMTRPayload = {
    emission_state: "SP",
    responsible_name: "Ana Ligia Colangelo Mantovani",
    emails_to_notify: ["andersonfilho09@gmail.com"],
    is_to_notify: true,
    generator_unit: "19033",
    generator_cnpj: "52.405.146/0001-10",
    transporter_unit: "18701",
    transporter_cnpj: "59.030.121/0001-29",
    destination_unit: "18878",
    destination_cnpj: "43.255.173/0001-63",
    driver_name: "motorista",
    vehicle_plate: "ABC1234",
    notes: "Coleta via Econtrole",
    waste_items: [
      {
        quantity: 45,
        ibama_code: "010101",
        unit_of_measure_id: 3,
        treatment_id: 4,
        physical_state_id: 4,
        packaging_type_id: 26,
        waste_class_id: 42,
        density: 1.0,
        un_number: "5255",
        hazard_class: "568",
        shipping_name: "nome embarque",
        packing_group: 1,
      },
    ],
  };

  return {
    ...defaultPayload,
    ...overrides,
  };
}

/**
 * Função auxiliar para emitir MTR com callbacks para integração com a interface do usuário.
 * 
 * @param options - Opções de emissão, incluindo retornos de chamada.
 */
export async function emitirMTR(options: EmitMTROptions): Promise<void> {
  const {
    companyId,
    serviceOrderId,
    trackingCode,
    wasteItems,
    cetesbCredentials,
    onStart,
    onSuccess,
    onError,
  } = options;

  // Chamo callback onStart
  onStart?.();

  try {
    // Construo payload com overrides
    const payload = buildDefaultPayload({
      company_id: companyId,
      service_order_id: serviceOrderId,
      tracking_code: trackingCode,
      waste_items: wasteItems,
    });

    // Pego credenciais do ambiente ou uso as fornecidas
    const credentials: CetesbTokenRequest = cetesbCredentials || {
      cpfCnpj: process.env.CETESB_CPF ?? "",
      senha: process.env.CETESB_SENHA ?? "",
      unidade: process.env.CETESB_UNIDADE ?? "",
    };

    // Executo o fluxo completo de emissão
    const result = await emitMTRCompleto(payload, credentials, false);

    // Chamo callback onSuccess ou mostro alert
    if (onSuccess) {
      onSuccess(result.emission);
    } else {
      Alert.alert(
        "✅ MTR Emitido",
        `ID: ${result.emission.mtr_id}`,
        [{ text: "OK" }]
      );
    }
  } catch (error: any) {
    // Chamo callback onError ou mostro alert
    if (onError) {
      onError(error);
    } else {
      Alert.alert("❌ Erro", error.message || "Erro ao emitir MTR");
    }
  }
}

/**
 * Baixo um arquivo MTR por ID - um wrapper para facilitar downloads independentes.
 * 
 * @param mtrId - O ID do MTR
 * @param autoShare - Se devo abrir diálogo de compartilhamento (padrão: true)
 * @returns Resultado do download com localUri e filename
 */
export async function downloadMTRById(
  mtrId: string | number,
  autoShare: boolean = true
): Promise<DownloadMTRResult> {
  return downloadMTR(mtrId, undefined, autoShare);
}

/**
 * @deprecated Use emitMTRWebhook ou emitMTRCompleto no lugar.
 * Esta função usa a API legada com FormData e multipart/form-data.
 * 
 * Gero um MTR usando o endpoint de API legado
 */
export async function generateMTR(
  orderId: number,
  photoUri: string | null,
  metadata: any = {}
): Promise<any> {
  const URL = await retrieveDomain();
  const credentials: any = getCredentials();

  if (!credentials || !credentials.accessToken) {
    throw new Error("NO_CREDENTIALS");
  }

  const formData = new FormData();
  formData.append("mtr[order_id]", String(orderId));
  Object.keys(metadata || {}).forEach((k) => formData.append(k, metadata[k]));

  if (photoUri) {
    const filename = photoUri.split("/").pop() || `photo-${Date.now()}.jpg`;
    const file: any = {
      uri: photoUri,
      name: filename,
      type: "image/jpeg",
    };
    formData.append("mtr[photo]", file as any);
  }

  return api.post(`${URL?.data}/service_orders/${orderId}/mtr`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      "access-token": credentials.accessToken,
      client: credentials.client,
      uid: credentials.uid,
    },
  });
}

export default {
  getTokenCetesb,
  emitMTRWebhook,
  downloadMTR,
  emitMTRCompleto,
  buildDefaultPayload,
  emitirMTR,
  downloadMTRById,
  generateMTR,
};
