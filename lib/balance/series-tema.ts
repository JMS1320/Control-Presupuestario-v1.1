/**
 * 📜 **LAS TIRAS DE CADA TEMA** — A-FEAT-1484 punto 1 (JMS 01/11: *«veo el movimiento, veo la serie de movimientos, si
 * hay otro elemento veo su serie. Eso es general para toda la experiencia de balance»*) y A-FEAT-1479 (*«son vinculados
 * las cuotas con anual; lógico que en esos casos hay que mostrar todo: tal activo, tal desactivado, tales cuotas
 * conciliadas»*).
 *
 * Dos cosas que los temas de conciliación y de deudas no traían:
 * 1. **la serie de movimientos de la contraparte en el banco**: todos los movimientos del mismo CUIT en esa cuenta
 *    (conciliados o no), del ejercicio con margen, para ver de un vistazo si le falta un pago o si éste ya está;
 * 2. **el par de un template vinculado** (anual ↔ cuotas, `grupo_impuesto_id`): los dos templates con su estado y sus
 *    cuotas del ejercicio.
 * Se leen una vez al calcular la conciliación del recorrido; los temas sólo arman links con eso.
 */
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import { linkTemplates } from "@/lib/impuestos/planilla"
import type { LinkDato } from "./cobertura-papeles"

const cuitDe = (x: unknown) => String(x ?? "").replace(/\D/g, "")
const MAX_IDS = 120

/** Los movimientos de una contraparte en una cuenta. */
export interface SerieCuenta { cuentaId: string; nombreCuenta: string; ids: string[]; fechas: string[]; conciliados: number }
/** Un template de un par vinculado, con sus cuotas del ejercicio por estado. */
export interface TemplatePar { id: string; nombre: string; activo: boolean; anual: boolean; cuotas: Record<string, number> }

export interface ExtrasTemas {
  /** CUIT → sus movimientos en cada cuenta de la empresa. */
  series: Map<string, SerieCuenta[]>
  /** 🏪 Sin CUIT (cajas, tarjetas, gastos del banco): `cuenta|clave del nombre` → sus movimientos en esa cuenta. */
  seriesNombre?: Map<string, SerieCuenta>
  /** id de template → los templates de su grupo (él incluido). */
  pares: Map<string, TemplatePar[]>
}
export const SIN_EXTRAS: ExtrasTemas = { series: new Map(), pares: new Map(), seriesNombre: new Map() }

/**
 * 🏪 **La clave del NOMBRE** para las cuentas que no traen CUIT (A-FEAT-1484, JMS 01/11: «seguí con la tira en cajas y
 * tarjetas»): mayúsculas, sin acentos, sin las palabras con números (terminal, comprobante, sucursal) y las DOS primeras
 * palabras que quedan. Así «AUTOPISTAS DEL S 8030…» y «AUTOPISTA DEL OE 8030…» no, pero «AUTOPISTAS DEL S» y «AUTOPISTAS
 * DEL OESTE» sí caen juntas; «FARMACITY 62» y «FARMACITY 105» también; y en la caja, «Pago Elvio jornales» y «Pago Elvio
 * viatico» son la tira de Elvio. Vacía = no se arma tira (mejor ninguna que una que junte cualquier cosa).
 */
export function claveNombre(texto: string | null | undefined): string {
  const palabras = String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[()\[\],.;:'"]/g, " ").split(/\s+/).filter(w => w && !/\d/.test(w))
  return palabras.length ? palabras.slice(0, 2).join(" ") : ""
}

/** 🏪 El link a la tira por NOMBRE dentro de UNA cuenta (cuando el movimiento no trae CUIT). */
export function linksSerieNombre(extras: ExtrasTemas, cuentaId: string, texto: string | null | undefined): LinkDato[] {
  const k = claveNombre(texto)
  const s = k ? extras.seriesNombre?.get(`${cuentaId}|${k}`) : undefined
  if (!s || (s.ids.length < 2 && s.conciliados === 0)) return []
  const ult = s.ids.length > MAX_IDS ? s.ids.slice(-MAX_IDS) : s.ids
  const fechas = s.ids.length > MAX_IDS ? s.fechas.slice(-MAX_IDS) : s.fechas
  const r = rangoQueContiene(fechas, 1)
  return [{ texto: `📜 Todos los movimientos «${k}» en ${s.nombreCuenta} (${s.ids.length}: ${s.conciliados} conciliados${s.ids.length > MAX_IDS ? `; se abren los últimos ${MAX_IDS}` : ""})`,
    href: linkExtracto({ cuenta: s.cuentaId, movs: ult, desde: r.desde, hasta: r.hasta }) }]
}

/** El link a la tira de movimientos de un CUIT (uno por cuenta). `excepto` = la cuenta+movimiento que ya tiene su propio link. */
export function linksSerieMovimientos(extras: ExtrasTemas, cuit: string | undefined, nombre: string): LinkDato[] {
  const c = cuitDe(cuit)
  if (c.length !== 11) return []
  return (extras.series.get(c) ?? []).filter(s => s.ids.length > 1 || s.conciliados > 0).map(s => {
    const ult = s.ids.length > MAX_IDS ? s.ids.slice(-MAX_IDS) : s.ids
    const fechas = s.ids.length > MAX_IDS ? s.fechas.slice(-MAX_IDS) : s.fechas
    const r = rangoQueContiene(fechas, 1)
    return {
      texto: `📜 Todos los movimientos de ${nombre} en ${s.nombreCuenta} (${s.ids.length}: ${s.conciliados} conciliados${s.ids.length > MAX_IDS ? `; se abren los últimos ${MAX_IDS}` : ""})`,
      href: linkExtracto({ cuenta: s.cuentaId, movs: ult, desde: r.desde, hasta: r.hasta }),
    }
  })
}

const resumenCuotas = (c: Record<string, number>) => Object.entries(c).filter(([, n]) => n > 0).map(([e, n]) => `${n} ${e}`).join(", ") || "sin cuotas en el ejercicio"

/** El par vinculado de un template (anual ↔ cuotas): un link a los dos y el texto de cómo está cada uno. */
export function parDeTemplate(extras: ExtrasTemas, egresoId: string | null | undefined): { link: LinkDato; texto: string } | null {
  if (!egresoId) return null
  const par = extras.pares.get(egresoId)
  if (!par || par.length < 2) return null
  const texto = "Template vinculado (anual ↔ cuotas): " + par.map(t => `«${t.nombre}» ${t.anual ? "(anual)" : "(cuotas)"} ${t.activo ? "ACTIVO" : "desactivado"} — ${resumenCuotas(t.cuotas)}`).join(" · ") + "."
  return { texto, link: { texto: `🔗 El par anual/cuotas: ${par.map(t => `«${t.nombre}» ${t.activo ? "activo" : "desactivado"}`).join(" y ")} (sus cuotas)`, href: linkTemplates(par.map(t => t.id)) } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/** Lee las series de movimientos (por CUIT) y los pares de templates vinculados. Nunca tira: lo que no pudo leer va a `avisos`. */
export async function leerExtrasTemas(sb: Cliente, empresa: string, desde: string, hasta: string): Promise<{ extras: ExtrasTemas; avisos: string[] }> {
  const avisos: string[] = []
  const series = new Map<string, SerieCuenta[]>()
  const seriesNombre = new Map<string, SerieCuenta>()
  const d = new Date(Date.parse(desde) - 183 * 86400000).toISOString().slice(0, 10)
  const h = new Date(Date.parse(hasta) + 92 * 86400000).toISOString().slice(0, 10)
  for (const c of CUENTAS_CONCILIABLES.filter(x => x.empresa === empresa)) {
    try {
      const filas: { id: string; fecha: string; estado: string | null; descripcion?: string | null; leyendas_adicionales_1?: string | null; leyendas_adicionales_2?: string | null; tipo_fila?: string | null }[] = []
      const esTarjeta = /tarjeta/.test(c.tabla)
      const cols = ["id", "fecha", "estado", "descripcion", ...(c.leyendas ? ["leyendas_adicionales_1", "leyendas_adicionales_2"] : []), ...(esTarjeta ? ["tipo_fila"] : [])].join(",")
      for (let i = 0; ; i += 1000) {
        const base = c.schema === "public" ? sb.from(c.tabla) : sb.schema(c.schema).from(c.tabla)
        const { data, error } = await base.select(cols).gte("fecha", d).lte("fecha", h).order("fecha").order("id").range(i, i + 999)
        if (error) throw new Error(error.message)
        filas.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      const porCuit = new Map<string, SerieCuenta>()
      for (const f of filas) {
        if (esTarjeta && f.tipo_fila && f.tipo_fila !== "movimiento") continue
        const k = cuitDe(f.leyendas_adicionales_2)
        if (k.length !== 11) {
          // 🏪 sin CUIT: la tira por nombre dentro de esta cuenta
          const kn = claveNombre(f.leyendas_adicionales_1 || f.descripcion)
          if (!kn) continue
          const sn = seriesNombre.get(`${c.cuentaId}|${kn}`) ?? { cuentaId: c.cuentaId, nombreCuenta: c.nombre, ids: [], fechas: [], conciliados: 0 }
          sn.ids.push(String(f.id)); sn.fechas.push(String(f.fecha).slice(0, 10))
          if (String(f.estado ?? "").toLowerCase() === "conciliado") sn.conciliados++
          seriesNombre.set(`${c.cuentaId}|${kn}`, sn)
          continue
        }
        const s = porCuit.get(k) ?? { cuentaId: c.cuentaId, nombreCuenta: c.nombre, ids: [], fechas: [], conciliados: 0 }
        s.ids.push(String(f.id)); s.fechas.push(String(f.fecha).slice(0, 10))
        if (String(f.estado ?? "").toLowerCase() === "conciliado") s.conciliados++
        porCuit.set(k, s)
      }
      for (const [k, s] of porCuit) series.set(k, [...(series.get(k) ?? []), s])
    } catch (e) { avisos.push(`tira de movimientos de ${c.nombre}: ${(e as Error).message}`) }
  }
  const pares = new Map<string, TemplatePar[]>()
  try {
    const { data: egs, error } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,activo,pago_anual,grupo_impuesto_id").not("grupo_impuesto_id", "is", null)
    if (error) throw new Error(error.message)
    const lista = (egs ?? []) as { id: string; nombre_referencia: string | null; activo: boolean | null; pago_anual: boolean | null; grupo_impuesto_id: string }[]
    const cuotas = new Map<string, Record<string, number>>()
    const ids = lista.map(e => e.id)
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e2 } = await sb.from("cuotas_egresos_sin_factura").select("egreso_id,estado,fecha_estimada").in("egreso_id", ids.slice(i, i + 200)).gte("fecha_estimada", desde).lte("fecha_estimada", hasta)
      if (e2) throw new Error(e2.message)
      for (const q of data ?? []) { const m = cuotas.get(q.egreso_id) ?? {}; const est = String(q.estado ?? "?"); m[est] = (m[est] ?? 0) + 1; cuotas.set(q.egreso_id, m) }
    }
    const porGrupo = new Map<string, TemplatePar[]>()
    for (const e of lista) porGrupo.set(e.grupo_impuesto_id, [...(porGrupo.get(e.grupo_impuesto_id) ?? []), {
      id: String(e.id), nombre: e.nombre_referencia ?? "?", activo: !!e.activo, anual: !!e.pago_anual, cuotas: cuotas.get(e.id) ?? {} }])
    for (const g of porGrupo.values()) if (g.length > 1) for (const t of g) pares.set(t.id, g)
  } catch (e) { avisos.push(`templates vinculados (anual/cuotas): ${(e as Error).message}`) }
  return { extras: { series, pares, seriesNombre }, avisos }
}
