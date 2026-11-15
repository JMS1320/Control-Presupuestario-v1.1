/**
 * 🧱 Los movimientos para la CAPA INTERNA, leídos de la base (A-FEAT-1288). SÓLO LEE.
 *
 * Todas las cuentas de la app (`TABLAS_CON_VINCULO_ARCA`), del ejercicio, en pesos, con su marca contable e interna: la de la
 * columna y, si está vacía, la de la nota del histórico («tu planilla: … Contable Y · Interno Z»). A los «Desglosar» que pagan
 * un seguro les agrega el reparto de la póliza por bien. Mismo criterio que el papel de research
 * (`scripts/excel-cuenta-interna-research.mts`), para que la app y el papel den lo mismo.
 */
import { TABLAS_CON_VINCULO_ARCA } from "@/lib/conciliacion/tablas-con-vinculo-arca"
import { marcaDeLaNota, normalizarCodigo, partesDeLaPoliza, type BienRep, type EndosoRep, type MovCapa, type PolizaRep } from "./capa-interna"

const r2 = (x: number) => Math.round(x * 100) / 100

/** El pago del resumen de una tarjeta, visto desde la cuenta del banco (no desde la tabla de la tarjeta). */
export function esPagoDeTarjeta(tabla: string, categ: string, texto: string): boolean {
  return !/tarjeta|visa/i.test(tabla) && (/^tarjetas?\b/i.test(categ) || /pago (de )?(la )?(tarjeta|visa)|visa (business|empresa)/i.test(texto))
}

export interface MovimientosDeLaCapa {
  movs: MovCapa[]
  /** Las cuentas que no se pudieron leer (o la lectura de pólizas): se dicen en el reporte. */
  tablasQueFallaron: string[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function leerMovimientosDeLaCapa(cliente: any, desde: string, hasta: string): Promise<MovimientosDeLaCapa> {
  const de = (schema: string, tabla: string) => (schema === "public" ? cliente.from(tabla) : cliente.schema(schema).from(tabla))
  const todo = async (q: (d: number, h: number) => any): Promise<any[]> => {
    const out: any[] = []
    for (let d = 0; ; d += 1000) {
      const { data, error } = await q(d, d + 999)
      if (error) throw new Error(error.message)
      out.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return out
  }
  const movs: (MovCapa & { cuotaId?: string })[] = [], tablasQueFallaron: string[] = []
  for (const t of TABLAS_CON_VINCULO_ARCA) {
    if (t.enDolares) continue   // la capa es en pesos (los dólares van aparte: § pesos y dólares nunca mezclados)
    const nombre = t.cuenta ?? `${t.schema}.${t.tabla}`
    let filas: any[]
    try { filas = await todo((d, h) => de(t.schema, t.tabla).select("*").gte("fecha", desde).lte("fecha", hasta).order("id").range(d, h)) }
    catch { tablasQueFallaron.push(nombre); continue }
    for (const m of filas) {
      if (!("contable" in m) && !("interno" in m)) continue
      const nota = String(m.nota_operador ?? "")
      const contable = String(m.contable ?? "").trim() || marcaDeLaNota(nota, "Contable")
      const interno = String(m.interno ?? "").trim() || marcaDeLaNota(nota, "Interno")
      if (!contable && !interno) continue
      const categ = String(m.categ ?? ""), desc = String(m.descripcion ?? "").slice(0, 70), detalle = String(m.detalle ?? "").trim().slice(0, 120)
      movs.push({ id: String(m.id), fecha: String(m.fecha).slice(0, 10), cuenta: nombre, titular: t.titular as MovCapa["titular"],
        deb: r2(Number(m.debitos) || 0), cred: r2(Number(m.creditos) || 0), contable, interno, detalle, desc, categ,
        esPagoTarjeta: esPagoDeTarjeta(t.tabla, categ, `${m.descripcion ?? ""} ${m.detalle ?? ""}`),
        cuotaId: m.template_cuota_id ? String(m.template_cuota_id) : undefined })
    }
  }
  // 🛡️ El reparto de los seguros: sólo para los «Desglosar» atados a una cuota (su template puede ser el de una póliza).
  const aRepartir = movs.filter(m => /^DESGLOS/.test(normalizarCodigo(m.interno)) && m.cuotaId)
  if (aRepartir.length) {
    try {
      const ids = [...new Set(aRepartir.map(m => m.cuotaId!))]
      const cuotaEgreso = new Map<string, string>()
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await cliente.from("cuotas_egresos_sin_factura").select("id, egreso_id").in("id", ids.slice(i, i + 200))
        if (error) throw new Error(error.message)
        for (const c of data ?? []) cuotaEgreso.set(String(c.id), String(c.egreso_id))
      }
      const polizas: PolizaRep[] = await todo((d, h) => cliente.from("polizas_seguro").select("id, poliza, template_id").order("id").range(d, h))
      const endosos: EndosoRep[] = await todo((d, h) => cliente.from("polizas_endosos").select("id, poliza_id, endoso, periodo_desde, es_nota_credito").order("id").range(d, h))
      const bienes: BienRep[] = await todo((d, h) => cliente.from("polizas_bienes").select("endoso_id, clave, descripcion, prima").order("id").range(d, h))
      const resp = new Map((await todo((d, h) => cliente.from("polizas_responsables").select("clave, responsable_interno").order("clave").range(d, h))).map((r: any) => [r.clave, r.responsable_interno]))
      for (const m of aRepartir) m.partesPoliza = partesDeLaPoliza(cuotaEgreso.get(m.cuotaId!), m.fecha, polizas, endosos, bienes, c => resp.get(c)) ?? undefined
    } catch { tablasQueFallaron.push("pólizas (los seguros a desglosar quedan sin resolver)") }
  }
  movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cuenta.localeCompare(b.cuenta))
  return { movs: movs.map(({ cuotaId: _c, ...m }) => m), tablasQueFallaron }
}
