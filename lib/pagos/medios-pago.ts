// Capa compartida (UI-agnóstica): reúne los MEDIOS de pago de una o varias facturas.
// Un pago puede repartirse en varios medios: anticipo, echeq y/o transferencia. La retención SICORE
// NO es un medio (se retiene, va a AFIP) → se muestra aparte.
//
// 🔑 **La identidad que tiene que cerrar** (§ 🧮 de CLAUDE.md):
//     suma(medios) + retención + descuento = imp_total de la(s) factura(s)
// Quien consume esta función la verifica ANTES de mandarle nada al proveedor.
// SICORE es SOLO MSA. Ver MANUAL-USO § Pagos.

import { supabase } from "@/lib/supabase"

export interface MedioPago {
  tipo: 'anticipo' | 'echeq' | 'transferencia'
  monto: number
  fecha?: string | null
  detalle?: string   // banco/nro (echeq), o descripción (transferencia)
}

// Las fechas que ve el proveedor van en es-AR: el `fecha_cobro` crudo sale `2026-09-20`, que en un
// mail a un tercero se lee como un dato de sistema y no como una fecha.
const fechaAR = (f?: string | null) => {
  if (!f) return ''
  const d = new Date(String(f) + 'T12:00:00')
  return isNaN(d.getTime()) ? String(f)
    : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

const rotuloEcheq = (c: Record<string, unknown>) => {
  const nro = c.numero ? ` ${c.numero as string}` : ''
  const cobro = c.fecha_cobro ? ` (cobro ${fechaAR(c.fecha_cobro as string)})` : ''
  return `ECHEQ ${(c.banco as string) || ''}${nro}${cobro}`.replace(/\s+/g, ' ').trim()
}

/**
 * Medios de pago de ANTICIPOS sueltos — cuando el mail va sólo por el anticipo y no hay factura.
 *
 * 🐞 **A-BUG-102** — ese mail no tenía desglose de ninguna clase: caía en un `Total transferido`
 * fijo, así que un anticipo librado en **echeq** se le anunciaba al proveedor como transferencia.
 */
export async function obtenerMediosPagoAnticipo(schema: string, anticipoIds: string[]): Promise<MedioPago[]> {
  if (anticipoIds.length === 0) return []
  const { data: ants } = await supabase.from('anticipos_proveedores')
    .select('id, monto, fecha_pago, metodo_pago, estado_pago').in('id', anticipoIds)
  const { data: chs } = await supabase.schema(schema).from('cheques')
    .select('monto, banco, numero, fecha_emision, fecha_cobro, anticipo_id').in('anticipo_id', anticipoIds)
  const porAnticipo = new Map<string, Record<string, unknown>>()
  for (const c of (chs ?? [])) porAnticipo.set(c.anticipo_id as string, c as Record<string, unknown>)

  return (ants ?? []).map(a => {
    const chq = porAnticipo.get(a.id as string)
    if (chq) return { tipo: 'echeq' as const, monto: (chq.monto as number) || (a.monto as number) || 0,
      fecha: (chq.fecha_emision as string) || null, detalle: rotuloEcheq(chq) }
    if (a.metodo_pago === 'echeq' || a.estado_pago === 'echeq') {
      return { tipo: 'echeq' as const, monto: (a.monto as number) || 0,
        fecha: (a.fecha_pago as string) || null, detalle: 'ECHEQ' }
    }
    return { tipo: 'transferencia' as const, monto: (a.monto as number) || 0,
      fecha: (a.fecha_pago as string) || null, detalle: 'Transferencia' }
  })
}

// Reúne los medios de pago vinculados a las facturas dadas (por factura_id / template_cuota_id).
export async function obtenerMediosPagoFactura(schema: string, facturaIds: string[]): Promise<MedioPago[]> {
  if (facturaIds.length === 0) return []
  const medios: MedioPago[] = []
  // Lo ya cubierto POR FACTURA con cheques o extracto, para no contarlo dos veces contra `monto_a_abonar`.
  const cubierto = new Map<string, number>()
  const sumar = (id: string | null | undefined, n: number) => {
    if (!id) return
    cubierto.set(id, (cubierto.get(id) ?? 0) + n)
  }

  // ── 1. Anticipos vinculados a la(s) factura(s) ────────────────────────────────────────────────
  //
  // 🐞 **A-BUG-102** — el rótulo estaba fijo en `'Transferencia'` para TODO anticipo, con el
  // argumento de que *"anticipo es término interno"*. Pero un anticipo se puede pagar con echeq, y
  // entonces el mail le anunciaba al proveedor una transferencia que nunca iba a llegar — y encima
  // le prometía el aviso de acreditación del banco. **El rótulo sale de cómo se pagó, no de un
  // texto fijo.** Caso IGLESIAS 04/09: $2.454.000 librados en echeq, anunciados como transferencia.
  const { data: ants } = await supabase.from('anticipos_proveedores')
    .select('id, monto, fecha_pago, metodo_pago, estado_pago').in('factura_id', facturaIds)

  // Los cheques de un anticipo se guardan con `anticipo_id` y **`factura_id` en NULL** (ver
  // `guardarChequeAnticipo`), así que la búsqueda por `factura_id` de más abajo NO los encuentra.
  // El camino es factura ← anticipo → cheque, de dos saltos, y acá se daba uno solo: el echeq
  // existía en la base y el desglose no lo veía nunca.
  const idsAnt = (ants ?? []).map(a => a.id as string).filter(Boolean)
  const chqDeAnticipo = new Map<string, Record<string, unknown>>()
  if (idsAnt.length) {
    const { data } = await supabase.schema(schema).from('cheques')
      .select('monto, banco, numero, fecha_emision, fecha_cobro, anticipo_id').in('anticipo_id', idsAnt)
    for (const c of (data ?? [])) chqDeAnticipo.set(c.anticipo_id as string, c as Record<string, unknown>)
  }

  for (const a of (ants ?? [])) {
    const chq = chqDeAnticipo.get(a.id as string)
    if (chq) {
      medios.push({ tipo: 'echeq', monto: (chq.monto as number) || (a.monto as number) || 0,
        fecha: (chq.fecha_emision as string) || null, detalle: rotuloEcheq(chq) })
    } else if (a.metodo_pago === 'echeq' || a.estado_pago === 'echeq') {
      // Marcado como echeq pero SIN cheque cargado: se dice que es un echeq y no se inventan banco
      // ni fechas. Quien consume esta función avisa que faltan datos.
      medios.push({ tipo: 'echeq', monto: (a.monto as number) || 0,
        fecha: (a.fecha_pago as string) || null, detalle: 'ECHEQ' })
    } else {
      medios.push({ tipo: 'anticipo', monto: (a.monto as number) || 0,
        fecha: (a.fecha_pago as string) || null, detalle: 'Transferencia' })
    }
  }

  // ── 2. Cheques librados contra la factura directamente (`guardarChequeFactura`) ───────────────
  const { data: chs } = await supabase.schema(schema).from('cheques')
    .select('monto, banco, numero, fecha_emision, fecha_cobro, factura_id').in('factura_id', facturaIds)
  for (const c of (chs ?? [])) {
    const monto = (c.monto as number) || 0
    sumar(c.factura_id as string, monto)
    medios.push({ tipo: 'echeq', monto, fecha: (c.fecha_emision as string) || null,
      detalle: rotuloEcheq(c as Record<string, unknown>) })
  }

  // ── 3. Transferencia del extracto (msa_galicia) vinculada por template_cuota_id ───────────────
  const { data: exts } = await supabase.from('msa_galicia')
    .select('debitos, fecha, detalle, template_cuota_id').in('template_cuota_id', facturaIds)
  for (const e of (exts ?? [])) {
    const monto = (e.debitos as number) || 0
    if (monto <= 0) continue
    sumar(e.template_cuota_id as string, monto)
    medios.push({ tipo: 'transferencia', monto, fecha: (e.fecha as string) || null,
      detalle: (e.detalle as string) || 'Transferencia' })
  }

  // ── 4. El resto que paga la propia factura ────────────────────────────────────────────────────
  //
  // 🐞 **A-BUG-102** — este medio faltaba por completo. `monto_a_abonar` es lo que queda a pagar
  // después de los anticipos y de la retención, y **es un medio real**: en el caso IGLESIAS eran
  // $1.042.599,60 correctamente cargados, con su SICORE ya descontado, que el desglose no mostraba.
  // Por eso la suma no llegaba al importe de la factura y **el mail no podía decir por qué faltaba**.
  //
  // Se descuenta lo ya cubierto por cheques y extracto DE ESA MISMA FACTURA: `guardarChequeFactura`
  // libra justamente por `monto_a_abonar`, así que sumar los dos lo contaría dos veces.
  const { data: fcs } = await supabase.schema(schema).from('comprobantes_arca')
    .select('id, monto_a_abonar, fecha_pago').in('id', facturaIds)
  for (const f of (fcs ?? [])) {
    const resto = ((f.monto_a_abonar as number) || 0) - (cubierto.get(f.id as string) ?? 0)
    if (resto > 0.01) {
      medios.push({ tipo: 'transferencia', monto: resto,
        fecha: (f.fecha_pago as string) || null, detalle: 'Transferencia' })
    }
  }

  return medios
}
