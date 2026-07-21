// Capa compartida (UI-agnóstica): reúne los MEDIOS de pago de una o varias facturas.
// Un pago puede repartirse en varios medios: anticipo (transferencia), echeq (cheque) y/o transferencia
// directa del extracto. La retención SICORE NO es un medio (se retiene, va a AFIP) → se muestra aparte.
// Suma de medios (netos) + SICORE = imp_total de la(s) factura(s). SICORE es SOLO MSA. Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

export interface MedioPago {
  tipo: 'anticipo' | 'echeq' | 'transferencia'
  monto: number
  fecha?: string | null
  detalle?: string   // banco/nro (echeq), o descripción (transferencia)
}

// Reúne los medios de pago vinculados a las facturas dadas (por factura_id / template_cuota_id).
export async function obtenerMediosPagoFactura(schema: string, facturaIds: string[]): Promise<MedioPago[]> {
  if (facturaIds.length === 0) return []
  const medios: MedioPago[] = []

  // 1. Anticipos (transferencia) vinculados
  const { data: ants } = await supabase.from('anticipos_proveedores')
    .select('monto, fecha_pago').in('factura_id', facturaIds)
  for (const a of (ants ?? [])) {
    medios.push({ tipo: 'anticipo', monto: (a.monto as number) || 0, fecha: (a.fecha_pago as string) || null, detalle: 'Anticipo (transferencia)' })
  }

  // 2. Cheques (echeq)
  const { data: chs } = await supabase.schema(schema).from('cheques')
    .select('monto, banco, numero, fecha_emision, fecha_cobro').in('factura_id', facturaIds)
  for (const c of (chs ?? [])) {
    const nro = (c.numero as string) ? ` ${c.numero}` : ''
    medios.push({ tipo: 'echeq', monto: (c.monto as number) || 0, fecha: (c.fecha_emision as string) || null,
      detalle: `ECHEQ ${(c.banco as string) || ''}${nro}${c.fecha_cobro ? ` (cobro ${(c.fecha_cobro as string)})` : ''}`.trim() })
  }

  // 3. Transferencia directa del extracto (msa_galicia) vinculada por template_cuota_id
  const { data: exts } = await supabase.from('msa_galicia')
    .select('debitos, fecha, detalle').in('template_cuota_id', facturaIds)
  for (const e of (exts ?? [])) {
    const monto = (e.debitos as number) || 0
    if (monto > 0) medios.push({ tipo: 'transferencia', monto, fecha: (e.fecha as string) || null, detalle: (e.detalle as string) || 'Transferencia' })
  }

  return medios
}
