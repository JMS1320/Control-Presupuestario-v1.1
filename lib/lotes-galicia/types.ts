/**
 * Tipos compartidos para el módulo Lotes Galicia.
 *
 * Generación de Excel formato banco Galicia con lotes de transferencias.
 * Soporta items: FC ARCA, cuotas de templates, anticipos, grupos de pago, sueldos.
 *
 * Reglas:
 * - Item suelto (FC/cuota/anticipo) = 1 fila por item (NO se consolida por proveedor)
 * - Grupo de pago = 1 fila con el TOTAL (debe ser 1 solo CUIT)
 * - Sueldos = Excel APARTE
 * - Máximo 50 items por archivo (límite del banco)
 */

import type { Empresa } from '@/lib/gas-pdf/types'
export type { Empresa } // re-export para que preview/generar lo importen desde acá

export type TipoItem = 'fc' | 'cuota_template' | 'anticipo' | 'grupo' | 'sueldo'
export type TipoLote = 'pagos' | 'sueldos'

/** Item que el cliente manda al endpoint preview/generar */
export interface ItemSeleccionado {
  tipo: TipoItem
  id: string          // id del item (factura_id, cuota_id, anticipo_id, grupo_pago_id, sueldo_id)
  schema?: string     // 'msa' | 'pam' | 'ma' (solo para fc / grupos / anticipos vinculados)
}

/** Item normalizado tras carga desde BD (interno) */
export interface ItemNormalizado {
  tipo: TipoItem
  id: string
  schema?: string
  // datos del proveedor
  proveedor_id: string | null
  cuit: string
  razon_social: string
  email_pagos: string | null
  cbu: string | null
  alias_cbu: string | null
  ultimo_uso_bancario: string | null
  // datos del pago
  monto: number          // monto a transferir (en ARS)
  descripcion: string    // descripción larga (se abrevia a 12 chars para el Excel)
  motivo_sugerido: string  // motivo Galicia sugerido
  // metadata
  moneda: string         // si es != ARS / PES → se excluye
  warning?: string       // razón por la que se marca con warning
  bloqueante?: string    // razón por la que NO se puede exportar
}

/** Input al endpoint /api/lotes/preview */
export interface PreviewLoteInput {
  empresa: Empresa
  items: ItemSeleccionado[]
}

/** Item agrupado para mostrar en el modal de validación */
export interface ItemPreview {
  tipo: TipoItem
  id: string
  schema?: string
  proveedor_id: string | null
  cuit: string
  razon_social: string
  email_pagos: string | null
  cbu: string | null
  alias_cbu: string | null
  ultimo_uso_bancario: string | null    // ISO string
  ultimo_uso_dias: number | null         // calculado: días desde último uso
  ultimo_uso_warning: boolean            // true si > 120 días (4 meses)
  monto: number
  descripcion: string
  motivo_sugerido: string
  moneda: string
  mensaje: string | null   // mensaje fijo del proveedor (proveedores.mensaje_transferencia) → col "Mensaje del email"
  warnings: string[]      // ej: ["Sin CBU", "Sin email", "Último uso hace 5 meses"]
  bloqueante: string | null  // si !== null, no puede exportar (ej: grupo con 2 CUITs)
  excluido_del_excel: boolean  // calculado: si no tiene CBU/Alias → quedará fuera
}

/** Output del endpoint /api/lotes/preview */
export interface PreviewLoteOutput {
  ok: boolean
  error?: string
  pagos: {
    items: ItemPreview[]
    cantidad_validos: number
    cantidad_excluidos: number   // sin CBU/Alias
    monto_total_valido: number
    monto_total_excluido: number
  }
  sueldos: {
    items: ItemPreview[]
    cantidad_validos: number
    cantidad_excluidos: number
    monto_total_valido: number
    monto_total_excluido: number
  }
  bloqueantes: string[]    // si hay algo bloqueante, no se puede exportar
  // proveedores únicos para el bucle "completar mail/CBU"
  proveedores_sin_email: { proveedor_id: string; cuit: string; razon_social: string }[]
  proveedores_sin_cbu: { proveedor_id: string; cuit: string; razon_social: string }[]
}

/** Input al endpoint /api/lotes/generar */
export interface GenerarLoteInput {
  empresa: Empresa
  fecha_pago: string  // YYYY-MM-DD
  items: ItemSeleccionado[]
  user_role?: string
  mensajes?: Record<string, string>   // itemId → mensaje override (lo que tipeó el usuario para la col "Mensaje")
  fijarMensaje?: string[]             // itemIds cuyo mensaje hay que guardar como fijo en el proveedor
}

/** Output del endpoint /api/lotes/generar */
export interface GenerarLoteOutput {
  ok: boolean
  error?: string
  archivos_pagos: Array<{
    nombre: string
    base64: string       // base64 del .xlsx
    cantidad_filas: number
    monto_total: number
  }>
  archivos_sueldos: Array<{
    nombre: string
    base64: string
    cantidad_filas: number
    monto_total: number
  }>
  lote_id: string  // id del registro insertado en lotes_transferencias
  excluidos: Array<{
    tipo: TipoItem
    id: string
    proveedor: string
    motivo: string  // "Sin CBU/Alias" / "Moneda USD" / "Grupo con múltiples CUITs"
  }>
}

/** Motivos válidos para Galicia (lista cerrada del banco) */
export const MOTIVOS_PROVEEDORES = [
  'Varios', 'Alquiler', 'Cuota', 'Expensas', 'Factura',
  'Honorarios', 'Préstamo', 'Seguro',
  'Inmobiliarias habitualista', 'Inmobiliarias no habitualista',
  'Bienes registrables habitualistas', 'Bienes registrables no habitualistas',
  'Aportes de capital', 'Reintegros de obras sociales y prepagas',
  'Siniestros de seguros',
] as const

export const MOTIVOS_HABERES = [
  'Acreditamiento de haberes', 'Horas extras', 'Reintegro de viáticos',
  'Sueldo anual complementario', 'Subsidio vacacional',
  'Gastos de representación', 'Honorarios profesionales',
  'Asignación a personal contratado', 'Asignac. becas/pasant.',
  'Premio por productividad y calidad', 'Reembolso de gastos',
  'Indemnización', 'Subsidio investigación',
] as const

export type MotivoGalicia = (typeof MOTIVOS_PROVEEDORES)[number] | (typeof MOTIVOS_HABERES)[number]
