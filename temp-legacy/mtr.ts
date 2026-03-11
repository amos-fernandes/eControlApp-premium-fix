/**
 * Módulo Auxiliar de MTR
 * 
 * Este módulo fornece funções auxiliares simplificadas para operações de MTR.
 * Re-exporto funções de mtrService.ts para consumo mais fácil.
 * 
 * @module services/mtr
 */

import {
  buildDefaultPayload as buildDefaultPayloadService,
  emitirMTR as emitirMTRService,
  downloadMTRById as downloadMTRByIdService,
  EmitMTRPayload,
  EmitMTROptions,
  DownloadMTRResult,
  WasteItem,
  CetesbTokenRequest,
  generateMTR as generateMTRLegacy,
} from "./mtrService";

// Re-exporto tipos por conveniência
export type {
  EmitMTRPayload,
  EmitMTROptions,
  DownloadMTRResult,
  WasteItem,
  CetesbTokenRequest,
};

/**
 * Construo uma carga útil MTR padrão com substituições opcionais
 * 
 * @param overrides - Payload parcial para sobrescrever padrões
 * @returns EmitMTRPayload completo
 * 
 * @example
 * ```typescript
 * const payload = buildDefaultPayload({
 *   company_id: "123",
 *   service_order_id: "456"
 * });
 * // payload.emission_state === "SP" (padrão mantido)
 * // payload.waste_items.length >= 1
 * ```
 */
export function buildDefaultPayload(
  overrides: Partial<EmitMTRPayload> = {}
): EmitMTRPayload {
  return buildDefaultPayloadService(overrides);
}

/**
 * Emito um MTR com callbacks para integração com UI
 * 
 * @param options - Opções de emissão incluindo callbacks
 * 
 * @example
 * ```typescript
 * await emitirMTR({
 *   companyId: "123",
 *   serviceOrderId: "456",
 *   trackingCode: "TRACK-001",
 *   onStart: () => setLoading(true),
 *   onSuccess: (result) => {
 *     setLoading(false);
 *     console.log("MTR ID:", result.mtr_id);
 *   },
 *   onError: (err) => {
 *     setLoading(false);
 *     console.error("Error:", err.message);
 *   },
 * });
 * ```
 */
export async function emitirMTR(options: EmitMTROptions): Promise<void> {
  return emitirMTRService(options);
}

/**
 * Faço download de um PDF de MTR por ID
 * 
 * @param mtrId - O ID do MTR
 * @param autoShare - Se devo abrir diálogo de compartilhamento (padrão: true)
 * @returns Resultado do download com localUri e filename
 * 
 * @example
 * ```typescript
 * const result = await downloadMTRById("42", true);
 * console.log("Baixado para:", result.localUri);
 * ```
 */
export async function downloadMTRById(
  mtrId: string | number,
  autoShare: boolean = true
): Promise<DownloadMTRResult> {
  return downloadMTRByIdService(mtrId, autoShare);
}

/**
 * @deprecated Use emitirMTR ou funções de mtrService no lugar.
 * 
 * Função legada para geração de MTR usando FormData/multipart.
 * Mantida para compatibilidade com versões anteriores.
 */
export const generateMTR = generateMTRLegacy;

export default {
  buildDefaultPayload,
  emitirMTR,
  downloadMTRById,
  generateMTR,
};
