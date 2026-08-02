// Capa compartida (UI-agnóstica): registrar el pago con ECHEQ en `{schema}.cheques`.
// Extraído de guardarCheques (vista-facturas-arca) para dar paridad al Cash Flow sin duplicar.
// El cheque guarda el monto NETO a pagar (imp_total − retención SICORE − descuento) porque es lo que
// realmente se libra. Dedup: 1 cheque por factura_id / anticipo_id. SICORE es SOLO MSA.
// Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

export interface EcheqDatos {
  banco: string
  numero: string
  fechaEmision: string
  fechaCobro: string
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
  const { error } = await supabase.schema(schema).from('cheques').insert([{
    numero:              datos.numero || null,
    banco:               datos.banco,
    monto:               montoNeto,
    moneda:              'ARS',
    fecha_emision:       datos.fechaEmision,
    fecha_cobro:         datos.fechaCobro,
    beneficiario_nombre: beneficiario,
    beneficiario_cuit:   factura.cuit ?? factura.cuit_proveedor ?? null,
    factura_id:          factura.id,
    anticipo_id:         null,
    sicore:              sicore?.quincena ?? null,
    monto_sicore:        sicore?.monto ?? null,
    tipo_sicore:         sicore?.tipo ?? null,
    descuento_aplicado:  descuentoAplicado && descuentoAplicado > 0 ? descuentoAplicado : null,
    concepto:            `Pago ${beneficiario ?? ''}`.trim(),
  }])
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

  const { error } = await supabase.schema(schema).from('cheques').insert([{
    numero:              datos.numero || null,
    banco:               datos.banco,
    monto:               montoNeto,
    moneda:              'ARS',
    fecha_emision:       datos.fechaEmision,
    fecha_cobro:         datos.fechaCobro,
    beneficiario_nombre: anticipo.nombre_proveedor ?? null,
    beneficiario_cuit:   anticipo.cuit_proveedor ?? null,
    factura_id:          null,
    anticipo_id:         anticipo.id,
    sicore:              sicore?.quincena ?? null,
    monto_sicore:        sicore?.monto ?? null,
    tipo_sicore:         sicore?.tipo ?? null,
    concepto:            `Anticipo ${anticipo.nombre_proveedor ?? ''}`.trim(),
  }])
  if (error) { console.error('Error guardarChequeAnticipo:', error); return false }
  return true
}
