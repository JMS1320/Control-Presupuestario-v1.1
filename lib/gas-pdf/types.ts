/**
 * Tipos compartidos para la integración GAS — búsqueda de PDFs de facturas.
 * Espejo del request/response del Web App GAS (gas-buscar-pdf/Main.gs).
 */

export type Empresa = 'MSA' | 'PAM' | 'MA'
export type SchemaEmpresa = 'msa' | 'pam' | 'ma'

/** Estado del campo `fc` de la factura — valores válidos */
export type FcEstado =
  | 'Buscar'    // pendiente — sistema dispara búsqueda
  | 'NO'        // manual: sé que no la tengo
  | 'Portal'    // manual: proveedor solo manda por portal
  | 'APP'       // auto: GAS encontró y archivó
  | 'OK'        // manual: chequeado por el usuario
  | 'VER'       // auto: GAS encontró algo dudoso
  | 'NO Mail'   // auto: GAS buscó pero no encontró
  // Compat con valores viejos
  | 'Sí'
  | 'No'
  | null

/** Estado técnico del campo `pdf_estado` (espejo interno de fc para queries) */
export type PdfEstado =
  | 'pendiente'
  | 'descargado'
  | 'revisar'
  | 'no_encontrado'
  | 'error'

/** Status devuelto por el GAS Web App */
export type GasStatus = 'ok' | 'revisar' | 'no_encontrada' | 'error'

/** Body que el backend envía al GAS Web App */
export interface GasBuscarRequest {
  _token: string                     // GAS_AUTH_TOKEN
  factura_id: string
  cuit_emisor: string
  punto_venta: number
  numero_desde: number
  tipo_comprobante_desc: string      // "Factura A" / "Nota Credito A" / etc
  fecha_emision: string              // YYYY-MM-DD
  imp_total: number
  denominacion_emisor: string
  email_proveedor: string
  patron_asunto: string              // ej. "Factura" — puede ser ''
  dias_busqueda: number              // ventana en días (default 7)
  carpeta_drive_id: string           // ID Drive folder (de la empresa) donde archivar
  subcarpetas?: string[]             // ruta de subcarpetas a crear/usar bajo la anterior, ej. ["2025-2026","26-06"]
  mails_recolectores?: string[]      // catch-all: mails que reenvían FC (Jose/Andrés). Se buscan además del proveedor
  asunto_recolector?: string         // asunto mínimo para procesar un reenvío, ej. "Documento de Jose"
}

/** Respuesta del GAS Web App */
export interface GasBuscarResponse {
  status: GasStatus
  drive_url?: string
  confianza?: 'alta' | 'media' | 'baja'
  observaciones?: string
  monto_pdf?: number | null
  tiempo_ms?: number
}

/** Input al endpoint /api/gas/buscar-pdf desde el cliente Next.js */
export interface ApiBuscarPdfInput {
  factura_id: string
  empresa: Empresa
  lote_id?: string  // opcional — agrupa búsquedas del mismo lote
}

/** Output del endpoint */
export interface ApiBuscarPdfOutput {
  ok: boolean
  factura_id: string
  resultado_gas?: GasStatus
  fc_nuevo?: FcEstado
  drive_url?: string
  observaciones?: string
  error?: string
}

/** Mapeo de status GAS → nuevo valor de fc y pdf_estado */
export function gasStatusToFc(s: GasStatus): { fc: FcEstado; pdf_estado: PdfEstado } {
  switch (s) {
    case 'ok':
      return { fc: 'APP', pdf_estado: 'descargado' }
    case 'revisar':
      return { fc: 'VER', pdf_estado: 'revisar' }
    case 'no_encontrada':
      return { fc: 'NO Mail', pdf_estado: 'no_encontrado' }
    case 'error':
      return { fc: 'Buscar', pdf_estado: 'error' }
  }
}
