/**
 * 🌾 La LECTURA de los arrendamientos de MA para su pantalla (A-FEAT-1634). Servidor (`service_role`): la usa
 * `app/api/mi-pantalla/route.ts`, que pone el guard antes. El cálculo vive en `lib/ma/mi-pantalla.ts`.
 *
 * ⚠️ Por ahora lee los comprobantes del schema `ma` (lo cobrado: `ma.ma_galicia` + `ma.retenciones_recibidas`): sirve
 * para MA y nada más. Un cobro que entró por otra cuenta (otra empresa, un echeq) no se ve como cobrado.
 */
import { supabaseAdmin } from "@/lib/supabase-admin"
import type { ComprobanteArrendamiento, EntradaArrendamientos } from "@/lib/ma/mi-pantalla"

async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

/** Los contratos de arrendamiento de MA con sus cuotas, ventas, precios, TC y comprobantes (con lo cobrado). Sólo lectura. */
export async function leerArrendamientos(empresa = "MA"): Promise<EntradaArrendamientos> {
  const { data: contratos, error: eK } = await supabaseAdmin.from("contratos_arrendamiento")
    .select("id, campania, cliente_nombre, cliente_cuit, has, qq_ha_total, grano").eq("empresa", empresa).eq("activo", true)
  if (eK) throw new Error(eK.message)
  const ids = (contratos ?? []).map(k => k.id)
  const [cuotasR, preciosR, tcsR, compR] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("cuotas_arrendamiento").select("id, contrato_id, numero_cuota, qq_ha_cuota, fecha_cobro_estimada, posicion_anio, posicion_mes, precio_usd_override, precio_pesos_override").in("contrato_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("precios_granos").select("grano, anio, mes, precio_usd"),
    supabaseAdmin.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
    supabaseAdmin.schema("ma").from("comprobantes_venta").select("id, fecha_liquidacion, tipo_comprobante, nro_comprobante, cuit_cliente, imp_total"),
  ])
  for (const r of [cuotasR, preciosR, tcsR, compR]) if (r.error) throw new Error(r.error.message)
  const cuotas = (cuotasR.data ?? []) as EntradaArrendamientos["cuotas"]
  const cuotaIds = cuotas.map(q => q.id)
  const { data: ventas, error: eV } = cuotaIds.length
    ? await supabaseAdmin.from("ventas_arrendamiento").select("id, cuota_id, tons, modo, precio_usd, tc, precio_pesos, fecha_cobro").in("cuota_id", cuotaIds)
    : { data: [], error: null }
  if (eV) throw new Error(eV.message)

  // El vínculo venta → factura (cuando existe) dice a qué contrato va cada comprobante.
  const ventaIds = (ventas ?? []).map(v => v.id)
  const { data: vinculos, error: eF } = ventaIds.length
    ? await supabaseAdmin.from("ventas_facturas").select("venta_id, comprobante_id, vinculado").in("venta_id", ventaIds)
    : { data: [], error: null }
  if (eF) throw new Error(eF.message)
  const contratoDeCuota = new Map(cuotas.map(q => [q.id, q.contrato_id]))
  const contratoDeVenta = new Map((ventas ?? []).map(v => [v.id, contratoDeCuota.get(v.cuota_id) ?? null]))
  const contratoDeComprobante = new Map<string, string | null>()
  for (const x of vinculos ?? []) if (x.vinculado !== false) contratoDeComprobante.set(x.comprobante_id, contratoDeVenta.get(x.venta_id) ?? null)

  // Lo cobrado de cada comprobante: los créditos del banco de MA vinculados a él + las retenciones que le hicieron.
  const compIds = (compR.data ?? []).map(c => c.id)
  const [banco, retenciones] = compIds.length
    ? await Promise.all([
        todas<{ comprobante_venta_id: string; creditos: number | null }>((d, h) => supabaseAdmin.schema("ma").from("ma_galicia").select("comprobante_venta_id, creditos").in("comprobante_venta_id", compIds).range(d, h)),
        todas<{ comprobante_venta_id: string; monto: number | null }>((d, h) => supabaseAdmin.schema("ma").from("retenciones_recibidas").select("comprobante_venta_id, monto").in("comprobante_venta_id", compIds).range(d, h)),
      ])
    : [[], []]
  const sumaPor = (filas: Array<{ comprobante_venta_id: string } & Record<string, unknown>>, campo: string) => {
    const m = new Map<string, number>()
    for (const f of filas) m.set(f.comprobante_venta_id, (m.get(f.comprobante_venta_id) ?? 0) + Number(f[campo] ?? 0))
    return m
  }
  const cobradoBanco = sumaPor(banco, "creditos"), retenido = sumaPor(retenciones, "monto")
  const comprobantes: ComprobanteArrendamiento[] = (compR.data ?? []).filter(c => c.fecha_liquidacion).map(c => ({
    id: c.id, fecha: String(c.fecha_liquidacion).slice(0, 10), tipo: Number(c.tipo_comprobante), numero: c.nro_comprobante,
    cliente_cuit: c.cuit_cliente, total: Number(c.imp_total ?? 0),
    cobradoBanco: cobradoBanco.get(c.id) ?? 0, retenciones: retenido.get(c.id) ?? 0, contratoId: contratoDeComprobante.get(c.id) ?? null,
  }))
  return {
    contratos: (contratos ?? []) as EntradaArrendamientos["contratos"],
    cuotas,
    ventas: (ventas ?? []) as EntradaArrendamientos["ventas"],
    precios: (preciosR.data ?? []).map(p => ({ ...p, precio_usd: Number(p.precio_usd) })) as EntradaArrendamientos["precios"],
    tcs: (tcsR.data ?? []) as EntradaArrendamientos["tcs"],
    comprobantes,
  }
}

