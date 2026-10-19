// Capa compartida (UI-agnóstica): registrar el pago con ECHEQ en `{schema}.cheques`.
// Extraído de guardarCheques (vista-facturas-arca) para dar paridad al Cash Flow sin duplicar.
// El cheque guarda el monto NETO a pagar (imp_total − retención SICORE − descuento) porque es lo que
// realmente se libra. Dedup: los cheques de una factura_id / anticipo_id se registran UNA vez
// (si ya hay alguno, no se insertan más). SICORE es SOLO MSA. Ver MANUAL-USO § Pagos.
//
// 📝 A-FEAT-1282 (2026-10-14) — un pago puede ir en VARIOS echeqs (`plan`): se inserta una fila por
// echeq, cada una con su fecha de cobro y su parte del neto, de la retención y del descuento
// (`lib/pagos/echeqs-multiples.ts`). Sin plan, un solo echeq como siempre.

import { supabase } from "@/lib/supabase"
import { calcularEcheqs, type PlanEcheqs } from "@/lib/pagos/echeqs-multiples"

export interface EcheqDatos {
  banco: string
  numero: string
  fechaEmision: string
  /** Con varios echeqs, la del ÚLTIMO (la que se estampa en la factura/anticipo). */
  fechaCobro: string
  /** Varios echeqs: cantidad, modo de reparto y la fecha de cobro de cada uno. */
  plan?: PlanEcheqs | null
}

/** Las filas de `cheques` de un pago: una por echeq del plan (o una sola, sin plan). */
function filasDeCheques(datos: EcheqDatos, montoNeto: number, sicore: SicoreCheque | null | undefined, descuento: number, base: Record<string, any>) {
  const plan: PlanEcheqs = datos.plan && datos.plan.echeqs.length
    ? datos.plan
    : { modo: 'iguales', echeqs: [{ fechaCobro: datos.fechaCobro, numero: datos.numero }] }
  const echeqs = calcularEcheqs(plan, montoNeto, sicore?.monto ?? 0, descuento)
  return echeqs.map((e, i) => ({
    ...base,
    numero:             e.numero || (plan.echeqs.length === 1 ? datos.numero || null : null),
    banco:              datos.banco,
    monto:              e.monto,
    moneda:             'ARS',
    fecha_emision:      datos.fechaEmision,
    fecha_cobro:        e.fechaCobro,
    sicore:             sicore?.quincena ?? null,
    monto_sicore:       sicore?.monto != null ? e.retencion : null,
    tipo_sicore:        sicore?.tipo ?? null,
    descuento_aplicado: e.descuento > 0 ? e.descuento : null,
    concepto:           echeqs.length > 1 ? `${base.concepto} (${i + 1}/${echeqs.length})` : base.concepto,
  }))
}

// Datos SICORE del cheque (para las columnas del registro). null si no hubo retención.
export interface SicoreCheque {
  quincena: string | null
  monto: number | null
  tipo: string | null
}

// Guarda el cheque de una FACTURA. `montoNeto` = importe real a librar en ARS (ya neto de retención/descuento).
// Dedup por factura_id (si ya existe, no inserta). Devuelve true si insertó.
export async function guardarChequeFactura(
  schema: string,
  factura: { id: string; denominacion_emisor?: string | null; nombre_proveedor?: string | null; cuit?: string | null; cuit_proveedor?: string | null },
  datos: EcheqDatos,
  montoNeto: number,
  sicore?: SicoreCheque | null,
  descuentoAplicado?: number,
): Promise<boolean> {
  const { data: existente } = await supabase.schema(schema).from('cheques')
    .select('id').eq('factura_id', factura.id).limit(1)
  if (existente && existente.length > 0) return false

  const beneficiario = factura.denominacion_emisor ?? factura.nombre_proveedor ?? null
  const { error } = await supabase.schema(schema).from('cheques').insert(filasDeCheques(datos, montoNeto, sicore, descuentoAplicado ?? 0, {
    beneficiario_nombre: beneficiario,
    beneficiario_cuit:   factura.cuit ?? factura.cuit_proveedor ?? null,
    factura_id:          factura.id,
    anticipo_id:         null,
    concepto:            `Pago ${beneficiario ?? ''}`.trim(),
  }))
  if (error) { console.error('Error guardarChequeFactura:', error); return false }
  return true
}

// Guarda el cheque de un ANTICIPO. `montoNeto` = importe real a librar en ARS (ya neto de retención).
// Dedup por anticipo_id. Devuelve true si insertó.
export async function guardarChequeAnticipo(
  schema: string,
  anticipo: { id: string; nombre_proveedor?: string | null; cuit_proveedor?: string | null },
  datos: EcheqDatos,
  montoNeto: number,
  sicore?: SicoreCheque | null,
): Promise<boolean> {
  const { data: existente } = await supabase.schema(schema).from('cheques')
    .select('id').eq('anticipo_id', anticipo.id).limit(1)
  if (existente && existente.length > 0) return false

  const { error } = await supabase.schema(schema).from('cheques').insert(filasDeCheques(datos, montoNeto, sicore, 0, {
    beneficiario_nombre: anticipo.nombre_proveedor ?? null,
    beneficiario_cuit:   anticipo.cuit_proveedor ?? null,
    factura_id:          null,
    anticipo_id:         anticipo.id,
    concepto:            `Anticipo ${anticipo.nombre_proveedor ?? ''}`.trim(),
  }))
  if (error) { console.error('Error guardarChequeAnticipo:', error); return false }
  return true
}
