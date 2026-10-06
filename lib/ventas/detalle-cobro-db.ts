/**
 * 💰 Lectura y escritura del DETALLE DEL COBRO — A-FEAT-1228. La cuenta vive en `detalle-cobro.ts`;
 * acá sólo se junta lo que está en la base y se escribe el vínculo de un pago a cuenta.
 *
 * ⚠️ Sólo MSA: `msa_galicia.comprobante_venta_id` y `retenciones_recibidas` existen sólo ahí
 * (ver A-FEAT-1219/1220 para PAM y MA).
 */

import { armarDetalleCobro, type FuentesCobro } from './detalle-cobro'
import { TIPOS_LIQ_HACIENDA } from './cobro-esperado'
import { textoQueSeCobro, detalleConQueSeCobro, type QueSeCobro } from './que-se-cobro'

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

const TIPO_CBTE: Record<number, string> = { 1: 'FC A', 6: 'FC B', 11: 'FC C', 2: 'ND A', 3: 'NC A', 180: 'liquidación' }

/** Las fuentes del detalle de cada comprobante. `comps` necesita el CUIT del cliente (para las compensaciones). */
export async function cargarFuentesCobro(
  supabase: Cliente, comps: { id: string; cuit_cliente: string | null }[],
): Promise<Map<string, FuentesCobro>> {
  const salida = new Map<string, FuentesCobro>()
  const ids = comps.map(c => c.id)
  comps.forEach(c => salida.set(c.id, { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }))
  if (!ids.length) return salida

  const [{ data: movs }, { data: ants }, { data: rets }] = await Promise.all([
    supabase.from('msa_galicia').select('id, fecha, creditos, anticipo_id, comprobante_venta_id').in('comprobante_venta_id', ids),
    supabase.from('anticipos_proveedores')
      .select('id, fecha_pago, monto, metodo_pago, estado_pago, descripcion, comprobante_venta_id')
      .eq('tipo', 'cobro').in('comprobante_venta_id', ids),
    supabase.schema('msa').from('retenciones_recibidas')
      .select('id, tipo, monto, fecha, nro_certificado, comprobante_venta_id').in('comprobante_venta_id', ids),
  ])
  for (const m of (movs || []) as any[]) salida.get(m.comprobante_venta_id)?.movimientos.push(m)
  for (const a of (ants || []) as any[]) salida.get(a.comprobante_venta_id)?.anticipos.push(a)
  for (const r of (rets || []) as any[]) salida.get(r.comprobante_venta_id)?.retenciones.push(r)

  // Compensaciones: lo que esos pagos a cuenta aplicaron a comprobantes DEL MISMO CLIENTE.
  const antIds = ((ants || []) as any[]).map(a => a.id)
  if (antIds.length) {
    const { data: apps } = await supabase.from('anticipos_facturas')
      .select('id, anticipo_id, factura_arca_id, monto_aplicado, fecha_aplicacion').in('anticipo_id', antIds)
    const facIds = [...new Set(((apps || []) as any[]).map(a => a.factura_arca_id).filter(Boolean))]
    const { data: facs } = facIds.length
      ? await supabase.schema('msa').from('comprobantes_arca')
          .select('id, cuit, tipo_comprobante, numero_desde, fecha_emision').in('id', facIds)
      : { data: [] }
    const facPorId = new Map(((facs || []) as any[]).map(f => [f.id, f]))
    const compDeAnticipo = new Map(((ants || []) as any[]).map(a => [a.id, a.comprobante_venta_id]))
    // Un pago a cuenta que ES una compensación (A-FEAT-1231) ya es su propia línea: su aplicación a
    // la factura del cliente no se cuenta otra vez.
    const esCompensacion = new Set(((ants || []) as any[]).filter(a => a.metodo_pago === 'compensacion').map(a => a.id))
    const cuitDeComp = new Map(comps.map(c => [c.id, String(c.cuit_cliente || '').replace(/\D/g, '')]))
    for (const ap of (apps || []) as any[]) {
      const compId = compDeAnticipo.get(ap.anticipo_id)
      const fac: any = facPorId.get(ap.factura_arca_id)
      if (!compId || !fac || esCompensacion.has(ap.anticipo_id)) continue
      // Sólo si la factura es del mismo cliente: eso es una compensación. Aplicada a otro, no es de esta venta.
      if (String(fac.cuit || '').replace(/\D/g, '') !== cuitDeComp.get(compId)) continue
      salida.get(compId)?.compensaciones.push({
        id: ap.id, anticipo_id: ap.anticipo_id, monto_aplicado: ap.monto_aplicado,
        fecha: fac.fecha_emision || (ap.fecha_aplicacion ? String(ap.fecha_aplicacion).slice(0, 10) : null),
        comprobante: `${TIPO_CBTE[Number(fac.tipo_comprobante)] || 'comprobante'} ${fac.numero_desde ?? ''}`.trim(),
      })
    }
  }
  return salida
}

/** Los pagos a cuenta del cliente que todavía no están vinculados a ningún comprobante de venta. */
export async function pagosACuentaSinVincular(supabase: Cliente, cuit: string) {
  const { data, error } = await supabase.from('anticipos_proveedores')
    .select('id, fecha_pago, monto, metodo_pago, estado_pago, descripcion, cuit_proveedor, nro_cuenta')
    .eq('tipo', 'cobro').eq('cuit_proveedor', cuit).is('comprobante_venta_id', null)
    .order('fecha_pago', { ascending: true })
  if (error) throw error
  return (data || []) as { id: string; fecha_pago: string | null; monto: number; metodo_pago: string | null; estado_pago: string | null; descripcion: string | null; cuit_proveedor: string; nro_cuenta: string | null }[]
}

const TABLAS_BANCARIAS: { tabla: string; schema?: string }[] = [
  { tabla: 'msa_galicia' }, { tabla: 'pam_galicia' }, { tabla: 'pam_galicia_cc' }, { tabla: 'ma_galicia', schema: 'ma' },
]

/**
 * 🔗 **Vincula un pago a cuenta (anticipo de cobro) a un comprobante de venta** — EL camino, usado
 * por el asistente de vinculación (Cash Flow, Principal) y por el detalle del cobro (Cobros).
 * Antes vivía sólo adentro del asistente (`useVinculacionAnticipo`); se sacó acá para que los dos
 * lugares escriban lo mismo (§ ♻️ de CLAUDE.md).
 *
 * 1. El comprobante: `cobrado` (o `conciliado` si el movimiento ya lo estaba) **sólo si queda
 *    saldado**; si no tiene cuenta contable y el anticipo sí, la hereda.
 * 2. El anticipo: `comprobante_venta_id` + `vinculado` / `parcial`.
 * 3. El movimiento del banco que lo trajo (si se encuentra): queda atado al comprobante. Un echeq
 *    endosado no tiene movimiento — no se busca.
 */
export async function vincularPagoACuenta(
  supabase: Cliente,
  anticipo: { id: string; monto: number; fecha_pago: string | null; cuit_proveedor: string; nro_cuenta?: string | null; estado_pago?: string | null; sinMovimiento?: boolean },
  comp: { id: string; nro_cuenta?: string | null },
  opciones: { saldada: boolean; movimientoConciliado?: boolean },
): Promise<{ extractoActualizado: boolean }> {
  const updateComp: Record<string, any> = {}
  if (opciones.saldada) updateComp.estado = opciones.movimientoConciliado ? 'conciliado' : 'cobrado'
  if (!comp.nro_cuenta && anticipo.nro_cuenta) updateComp.nro_cuenta = anticipo.nro_cuenta
  if (Object.keys(updateComp).length) {
    const { error } = await supabase.schema('msa').from('comprobantes_venta').update(updateComp).eq('id', comp.id)
    if (error) throw error
  }

  const { error: errAnt, count } = await supabase.from('anticipos_proveedores')
    .update({ comprobante_venta_id: comp.id, estado: opciones.saldada ? 'vinculado' : 'parcial' }, { count: 'exact' })
    .eq('id', anticipo.id)
  if (errAnt) throw errAnt
  if (count === 0) throw new Error('No se encontró el pago a cuenta: el vínculo NO se guardó')

  // Un cheque de tercero en cartera o endosado, o una compensación, no pasaron por el banco: no hay
  // movimiento que buscar (y buscarlo podría atar uno ajeno del mismo importe).
  if (anticipo.estado_pago === 'endosado' || anticipo.estado_pago === 'en_cartera' || anticipo.sinMovimiento) return { extractoActualizado: false }

  for (const { tabla, schema } of TABLAS_BANCARIAS) {
    const client = schema ? supabase.schema(schema) : supabase
    let { data: movs } = await client.from(tabla).select('id, creditos, estado').eq('anticipo_id', anticipo.id).limit(1)
    if (!movs || movs.length === 0) {
      const { data: porCuit } = await client.from(tabla)
        .select('id, creditos, estado, leyendas_adicionales_2')
        .eq('fecha', anticipo.fecha_pago).eq('leyendas_adicionales_2', anticipo.cuit_proveedor).limit(10)
      const match = ((porCuit || []) as any[]).find(m =>
        Math.abs((parseFloat(m.creditos) || 0) - anticipo.monto) < Math.max(1, anticipo.monto * 0.03))
      if (match) movs = [match]
    }
    if (movs && movs.length > 0) {
      // `comprobante_venta_id` existe sólo en `msa_galicia` (A-FEAT-24): en las otras se ata sólo el anticipo.
      const upd: Record<string, any> = { anticipo_id: anticipo.id, estado: 'conciliado', motivo_revision: null }
      if (tabla === 'msa_galicia') {
        upd.comprobante_venta_id = comp.id
        // Deja de ser «ANTICIPO COBRO»: toma la imputación de su comprobante (si la tiene).
        const { data: c } = await supabase.schema('msa').from('comprobantes_venta')
          .select('cuenta_contable, nro_cuenta, centro_costo').eq('id', comp.id).maybeSingle()
        const imp = c ? await imputacionParaElBanco(supabase, c as any) : null
        if (imp) Object.assign(upd, imp)
        const { data: m } = await client.from(tabla).select('detalle').eq('id', (movs[0] as any).id).maybeSingle()
        upd.detalle = detalleSinAnticipo((m as any)?.detalle)
      }
      await client.from(tabla).update(upd).eq('id', (movs[0] as any).id)
      return { extractoActualizado: true }
    }
  }
  return { extractoActualizado: false }
}

/**
 * 🏷️ **La imputación de la venta viaja a sus movimientos del banco** — pedido del usuario 2026-10-02:
 * *«que cuando le ponga la cuenta contable la propague a extracto… no puede quedar como anticipo
 * cuando ya tiene su registro definitivo»*. Los 4 cobros de enero de Genta quedaron conciliados con
 * `categ = 'ANTICIPO COBRO'` y sin cuenta, aunque la liquidación tenía la suya.
 *
 * Es el espejo de compras: ahí la conciliación copia la cuenta de la factura al movimiento, y editar
 * la cuenta de la factura la propaga (`vista-facturas-arca`). En ventas no estaba ninguna de las dos.
 *
 * Devuelve lo que hay que escribir en el movimiento (`categ`, `nro_cuenta`, `centro_de_costo`), o
 * `null` si la venta todavía no tiene cuenta — en ese caso no se pisa nada.
 */
export async function imputacionParaElBanco(
  supabase: Cliente, comp: { cuenta_contable?: string | null; nro_cuenta?: string | null; centro_costo?: string | null },
): Promise<Record<string, string> | null> {
  const categ = (comp.cuenta_contable || '').trim()
  if (!categ) return null
  let nro = comp.nro_cuenta || null
  if (!nro) {
    // Igual que compras: sin número en el comprobante, se busca por la cuenta en el plan.
    const { data } = await supabase.from('cuentas_contables').select('nro_cuenta').eq('categ', categ).maybeSingle()
    nro = (data as any)?.nro_cuenta || null
  }
  const salida: Record<string, string> = { categ }
  if (nro) salida.nro_cuenta = nro
  if (comp.centro_costo) salida.centro_de_costo = comp.centro_costo
  return salida
}

/**
 * Propaga la imputación de un comprobante de venta a TODOS sus movimientos del banco
 * (`msa_galicia.comprobante_venta_id` — la única tabla con ese vínculo). Se llama al guardar la
 * cuenta del comprobante, desde cualquiera de sus pantallas. Devuelve cuántos movimientos tocó.
 */
export async function propagarImputacionDeVenta(
  supabase: Cliente, compId: string,
  comp: { cuenta_contable?: string | null; nro_cuenta?: string | null; centro_costo?: string | null },
): Promise<number> {
  const imp = await imputacionParaElBanco(supabase, comp)
  if (!imp) return 0
  const { error, count } = await supabase.from('msa_galicia').update(imp, { count: 'exact' }).eq('comprobante_venta_id', compId)
  if (error) throw error
  // Y la entrada de un echeq de ese cliente en el extracto de echeqs (A-FEAT-1230).
  const { error: eE } = await supabase.schema('msa').from('echeqs_terceros').update(imp).eq('comprobante_venta_id', compId)
  if (eE) throw eE
  // Y los que todavía dicen «ANTICIPO COBRO: …» en el detalle dejan de decirlo.
  const { data: conPrefijo } = await supabase.from('msa_galicia').select('id, detalle')
    .eq('comprobante_venta_id', compId).ilike('detalle', 'ANTICIPO COBRO:%')
  for (const m of (conPrefijo || []) as any[]) {
    await supabase.from('msa_galicia').update({ detalle: detalleSinAnticipo(m.detalle) }).eq('id', m.id)
  }
  return count || 0
}

/** «ANTICIPO COBRO: Adelanto» → «Adelanto». El movimiento deja de ser un anticipo cuando tiene su comprobante. */
export function detalleSinAnticipo(detalle: string | null | undefined): string | null {
  const d = String(detalle || '').replace(/^\s*ANTICIPO COBRO:\s*/i, '').trim()
  return d || null
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// 🔁 COMPENSAR una venta con una factura del MISMO cliente — A-FEAT-1231 (2026-10-03)
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Las facturas que el cliente nos hizo (compras a su nombre) que todavía tienen algo por pagar,
 * con ese saldo en PESOS (en dólares, con el TC del pago o el de la factura).
 */
export async function facturasDelClienteParaCompensar(supabase: Cliente, cuit: string) {
  const { data, error } = await supabase.schema('msa').from('comprobantes_arca')
    .select('id, fecha_emision, tipo_comprobante, numero_desde, imp_total, monto_a_abonar, moneda, tipo_cambio, tc_pago, estado, cuenta_contable')
    .eq('cuit', cuit).not('estado', 'in', '("conciliado","anterior")')
    .order('fecha_emision', { ascending: false })
  if (error) throw error
  return ((data || []) as any[]).map(f => {
    const tc = (f.moneda && f.moneda !== 'PES' && f.moneda !== 'ARS') ? (Number(f.tc_pago) || Number(f.tipo_cambio) || 1) : 1
    const pendiente = Math.round((Number(f.monto_a_abonar ?? f.imp_total) || 0) * tc * 100) / 100
    return { ...f, pendientePesos: pendiente }
  }).filter(f => f.pendientePesos > 0.01)
}

/**
 * 🔁 **Compensa**: el cliente nos facturó algo (intereses por adelantar, un servicio) y lo
 * descontó de lo que nos pagó. Funciona como la cancelación de una nota de crédito contra una
 * factura (pantalla de Pagos): la factura del cliente queda **conciliada con saldo 0**, y la venta
 * cuenta ese importe como **cobrado por compensación**.
 *
 * Se registra como un pago a cuenta de cobro (`metodo_pago = 'compensacion'`, sin movimiento del
 * banco) aplicado a esa factura — así se reusa el vínculo con la venta y el detalle del cobro, y
 * no hace falta tabla nueva. Pedido del usuario 2026-10-03: *«debería comportarse como una nota de
 * crédito que se cancela con una factura cuando las emparejo… nunca la asigné, así que no sabría
 * cómo hacerlo en el futuro»*.
 */
export async function compensarConFactura(
  supabase: Cliente,
  venta: { id: string; nro_comprobante: string | null; cuit_cliente: string; denominacion_cliente: string | null; saldoPesos: number },
  fac: { id: string; tipo_comprobante: number; numero_desde: number | string | null; pendientePesos: number; detalle?: string | null },
  fecha: string,
): Promise<void> {
  const monto = fac.pendientePesos
  const tipo = Number(fac.tipo_comprobante) === 3 ? 'NC' : Number(fac.tipo_comprobante) === 2 ? 'ND' : Number(fac.tipo_comprobante) === 180 ? 'liquidación' : 'FC'
  const { data: ant, error } = await supabase.from('anticipos_proveedores').insert({
    tipo: 'cobro', cuit_proveedor: venta.cuit_cliente, nombre_proveedor: venta.denominacion_cliente,
    monto, monto_restante: 0, fecha_pago: fecha, metodo_pago: 'compensacion', estado_pago: 'pagado',
    estado: 'pendiente_vincular', empresa: 'MSA',
    descripcion: `Compensación con su ${tipo} ${fac.numero_desde ?? ''}`.trim(),
  }).select('id, monto, fecha_pago, cuit_proveedor, nro_cuenta, estado_pago').single()
  if (error) throw error
  const { error: eA } = await supabase.from('anticipos_facturas').insert({
    anticipo_id: (ant as any).id, factura_arca_id: fac.id, monto_aplicado: monto, fecha_aplicacion: new Date().toISOString(),
  })
  if (eA) throw eA
  // La factura del cliente, cancelada como una NC emparejada: conciliada y sin saldo.
  const { data: f0 } = await supabase.schema('msa').from('comprobantes_arca').select('detalle').eq('id', fac.id).maybeSingle()
  const nota = `Compensada con la venta ${venta.nro_comprobante ?? ''}`.trim()
  const { error: eF } = await supabase.schema('msa').from('comprobantes_arca')
    .update({ estado: 'conciliado', monto_a_abonar: 0, detalle: [String((f0 as any)?.detalle || '').trim(), nota].filter(Boolean).join(' | ') })
    .eq('id', fac.id)
  if (eF) throw eF
  await vincularPagoACuenta(supabase, { ...(ant as any), monto, sinMovimiento: true }, { id: venta.id },
    { saldada: venta.saldoPesos - monto < 1, movimientoConciliado: false })
}

/**
 * ✅ **A-BUG-1247 — la venta se cierra cuando su DETALLE cierra, venga por donde venga el último peso.**
 *
 * El estado de la venta sólo cambiaba en dos caminos (asignar el cobro a mano desde el Extracto y
 * vincular un pago a cuenta). Los demás —completar el saldo con una **retención** desde Cobros,
 * confirmar con **«OK a mano»** un cobro que el motor mandó a auditar— dejaban la venta en «a cobrar»
 * con saldo cero, y **el Cash Flow la seguía esperando**. Casos del 2026-10-05: Sanpa FC 10-21
 * ($40.306.014 esperados que entraron el 11/08) y FC 10-20 (conciliada con «OK a mano»).
 *
 * Mismo saldo que Cobros: total − retenciones impresas (hacienda) − Σ detalle. Si cierra:
 *   · `conciliado` si todos los créditos del banco atados a la venta están conciliados;
 *   · `cobrado` si no (falta conciliar el banco — es otro paso).
 * Una liquidación con cuotas no se toca: su estado lo deciden las cuotas. Devuelve el estado nuevo
 * (o `null` si no cambió).
 */
export async function cerrarVentaSiSaldada(supabase: Cliente, compId: string): Promise<'cobrado' | 'conciliado' | null> {
  const { data: v } = await supabase.schema('msa').from('comprobantes_venta')
    .select('id, cuit_cliente, estado, plazos, imp_total, tipo_comprobante, ret_iva, ret_iibb').eq('id', compId).maybeSingle()
  if (!v || (Array.isArray(v.plazos) && v.plazos.length) || !['a cobrar', 'cobrado'].includes(v.estado)) return null
  const fuentes = (await cargarFuentesCobro(supabase as any, [{ id: v.id, cuit_cliente: v.cuit_cliente }])).get(v.id)
    || { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }
  const impresas = TIPOS_LIQ_HACIENDA.has(Number(v.tipo_comprobante)) ? (Number(v.ret_iibb) || 0) + (Number(v.ret_iva) || 0) : 0
  const d = armarDetalleCobro(fuentes as FuentesCobro, (Number(v.imp_total) || 0) - impresas)
  if (!d.cierra) return null
  const { data: movs } = await supabase.from('msa_galicia').select('estado').eq('comprobante_venta_id', v.id)
  const todosConciliados = ((movs || []) as any[]).length > 0 && ((movs || []) as any[]).every(m => m.estado === 'conciliado')
  const nuevo = todosConciliados ? 'conciliado' : 'cobrado'
  if (nuevo === v.estado) return null
  const { error } = await supabase.schema('msa').from('comprobantes_venta').update({ estado: nuevo }).eq('id', v.id)
  if (error) throw error
  return nuevo
}

/**
 * 📝 A-FEAT-1257 — qué se cobró en un comprobante de venta: la(s) cuota(s) del contrato de
 * arrendamiento o las cabezas de hacienda, más lo que falta cobrar. Sale del vínculo factura ↔ venta
 * (`public.ventas_facturas`). `null` si la factura no está vinculada a ninguna venta.
 */
export async function queSeCobroDe(supabase: Cliente, compId: string, hastaFecha?: string | null): Promise<QueSeCobro | null> {
  const { data: vfs } = await supabase.from('ventas_facturas').select('venta_tipo, venta_id').eq('comprobante_id', compId)
  const vincs = (vfs || []) as { venta_tipo: string; venta_id: string }[]
  if (!vincs.length) return null
  const cuotas: QueSeCobro['cuotas'] = []
  const cabezas: QueSeCobro['cabezas'] = []
  const idsArr = vincs.filter(v => v.venta_tipo === 'arrendamiento').map(v => v.venta_id)
  if (idsArr.length) {
    const { data: vas } = await supabase.from('ventas_arrendamiento').select('cuota_id').in('id', idsArr)
    const idsCuota = ((vas || []) as any[]).map(v => v.cuota_id).filter(Boolean)
    if (idsCuota.length) {
      const { data: cus } = await supabase.from('cuotas_arrendamiento').select('id, numero_cuota, contrato_id').in('id', idsCuota)
      for (const c of (cus || []) as any[]) {
        const { count } = await supabase.from('cuotas_arrendamiento').select('id', { count: 'exact', head: true })
          .eq('contrato_id', c.contrato_id).is('cuota_padre_id', null)
        if (!cuotas.some(x => x.numero === c.numero_cuota)) cuotas.push({ numero: Number(c.numero_cuota), de: Number(count) || 0 })
      }
    }
  }
  const idsGan = vincs.filter(v => v.venta_tipo === 'ganaderia').map(v => v.venta_id)
  if (idsGan.length) {
    const { data: svs } = await supabase.schema('productivo').from('stock_ventas')
      .select('cantidad, categorias_hacienda(nombre)').in('id', idsGan)
    for (const s of (svs || []) as any[]) cabezas.push({ cantidad: Number(s.cantidad) || 0, categoria: s.categorias_hacienda?.nombre || '' })
  }
  cuotas.sort((a, b) => a.numero - b.numero)
  // Lo que falta: el mismo saldo que Cobros.
  const { data: v } = await supabase.schema('msa').from('comprobantes_venta')
    .select('id, cuit_cliente, imp_total, tipo_comprobante, ret_iva, ret_iibb, plazos').eq('id', compId).maybeSingle()
  let falta = 0
  // Una liquidación en CUOTAS: cada cobro es su cuota (ya lo dice «comprobante pagado»), no un «parcial».
  if (v && !(Array.isArray((v as any).plazos) && (v as any).plazos.length)) {
    const fuentes = (await cargarFuentesCobro(supabase as any, [{ id: v.id, cuit_cliente: v.cuit_cliente }])).get(v.id)
      || { movimientos: [], anticipos: [], compensaciones: [], retenciones: [] }
    const impresas = TIPOS_LIQ_HACIENDA.has(Number(v.tipo_comprobante)) ? (Number(v.ret_iibb) || 0) + (Number(v.ret_iva) || 0) : 0
    const d = armarDetalleCobro(fuentes as FuentesCobro, (Number(v.imp_total) || 0) - impresas)
    // A la fecha del cobro, no a hoy: un adelanto de febrero ERA parcial aunque hoy la venta esté saldada.
    const cobrado = hastaFecha
      ? d.lineas.filter(l => l.fecha && l.fecha <= hastaFecha).reduce((s, l) => s + l.monto, 0)
      : d.total
    falta = d.esperado - cobrado
    // Menos de $1 es redondeo del emisor (Genta cerró con $0,02): cuenta como cobrado.
    if (falta < 1) falta = 0
  }
  return { cuotas, cabezas, falta }
}

/** Escribe en el detalle del movimiento qué se cobró (sin pisar lo que haya escrito el usuario). Devuelve el texto o null. */
export async function anotarQueSeCobro(supabase: Cliente, movId: string, compId: string): Promise<string | null> {
  const { data: m } = await supabase.from('msa_galicia').select('detalle, fecha').eq('id', movId).maybeSingle()
  const q = await queSeCobroDe(supabase, compId, (m as any)?.fecha ?? null)
  const texto = q ? textoQueSeCobro(q) : null
  if (!texto) return null
  const nuevo = detalleConQueSeCobro((m as any)?.detalle, texto)
  if (nuevo !== ((m as any)?.detalle || null)) {
    const { error } = await supabase.from('msa_galicia').update({ detalle: nuevo }).eq('id', movId)
    if (error) throw error
  }
  return texto
}
