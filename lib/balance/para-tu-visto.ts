/**
 * ✔ **PARA TU VISTO — lo que resolvió Claude sigue en el recorrido hasta que JMS lo confirma** (A-FEAT-1487, JMS 01/11:
 * *«no desapareció de mi lista principal; de la misma manera no debería desaparecer de la lista de balance, porque es
 * algo que está terminado, pero no por mí, sino por vos. Entonces requiere mi visto. Y el día de mañana, si tengo que
 * presentar y hay cosas que no están vistas por mí pero están vistas por vos, de alguna manera están vistas por
 * alguien»*).
 *
 * El problema: el recorrido arma los temas con lo que está ABIERTO (el movimiento sin conciliar, la cuota pendiente).
 * Cuando Claude lo resuelve, el tema desaparece y el link de la tarea «por confirmar» llevaba a «ya no está, se
 * resolvió», sin nada para auditar.
 *
 * Ahora: toda tarea anclada a un tema del recorrido que espera confirmación (`revisiones.estado = 'por_confirmar'`)
 * mantiene su tema, en el grupo «Para tu visto», con lo que se hizo y los links de cómo quedó: el movimiento, la tira
 * de la contraparte y lo que quedó vinculado (el sueldo, la factura, la cuota del template y su par). Si el tema
 * todavía se arma solo (sigue abierto), se lo pasa a ese grupo; si ya no, se lo rearma desde la base.
 */
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import { linkFacturas } from "@/lib/egresos/link-facturas"
import { linkTemplates } from "@/lib/impuestos/planilla"
import { linkSueldosDe } from "@/lib/sueldos/link"
import type { LinkDato } from "./cobertura-papeles"
import type { Tema } from "./recorrido"
import type { PendienteBalance } from "./pendientes-balance"
import { linksSerieMovimientos, linksSerieNombre, parDeTemplate, SIN_EXTRAS, type ExtrasTemas } from "./series-tema"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Lo que importa de una tarea por confirmar. */
export interface TareaPorConfirmar { id: string; clave: string; descripcion: string; resolucion: string; resueltoPor: string; motivo: string
  /** ⚠️ 01/11: una tarea DEVUELTA (abierta, en manos de Claude) también mantiene su tema — si no, al devolver desaparecía. */
  devuelta?: boolean }

const etiquetaVisto = (t: TareaPorConfirmar) => t.devuelta ? "Devuelto a Claude — en curso" : `Hecho por ${t.resueltoPor || "Claude"} — falta tu visto`
const queVisto = (t: TareaPorConfirmar) => t.devuelta ? "↩ En manos de Claude (lo devolviste o se lo pediste): la conversación sigue abajo." : `✔ Lo que se hizo: ${t.resolucion || "(sin resumen)"}`

/**
 * Pura: pasa al grupo «Para tu visto» los temas que tienen una tarea por confirmar, y agrega los rearmados para las que
 * ya no tienen tema. Un tema rearmado sólo entra si no hay otro con la misma clave.
 */
export function aplicarParaTuVisto(temas: Tema[], tareas: TareaPorConfirmar[], rearmados: Tema[], pendientes: PendienteBalance[] = []): Tema[] {
  // ⚠️ 01/11: el tema rearmado tiene que llevar SU respuesta (la fila de «Pendientes a revisar» con su clave). Sin esto,
  // cada mensaje escrito en un tema rearmado creaba una fila nueva y la conversación quedaba partida (pasó con Manuel).
  const respuestaDe = (clave: string) => [...pendientes].filter(p => p.texto.startsWith(`[${clave}]`)).sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()
  const porClave = new Map(tareas.map(t => [t.clave, t]))
  const out = temas.map(t => {
    const tarea = porClave.get(t.clave)
    // una tarea abierta de Claude sobre un tema que todavía sale solo: el tema queda en su grupo (no es «para tu visto»)
    return tarea && !tarea.devuelta ? { ...t, grupo: "visto" as const, etiqueta: etiquetaVisto(tarea), que: `${queVisto(tarea)}\n\n${t.que}`, respondido: false } : t
  })
  const hay = new Set(out.map(t => t.clave))
  for (const r of rearmados) if (!hay.has(r.clave)) { out.push({ ...r, pendiente: respuestaDe(r.clave) }); hay.add(r.clave) }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

/** El tema rearmado de un movimiento (`conc:<cuenta>:<id>`): cómo quedó y con qué quedó vinculado. */
async function temaDeMovimiento(sb: Cliente, t: TareaPorConfirmar, cuentaId: string, movId: string, extras: ExtrasTemas): Promise<Tema | null> {
  const c = CUENTAS_CONCILIABLES.find(x => x.cuentaId === cuentaId)
  if (!c) return null
  const { data: m } = await (c.schema === "public" ? sb.from(c.tabla) : sb.schema(c.schema).from(c.tabla)).select("*").eq("id", movId).maybeSingle()
  if (!m) return null
  const importe = Number(m.debitos) > 0 ? Number(m.debitos) : Number(m.creditos) || 0
  const signo = Number(m.debitos) > 0 ? "−" : "+"
  const quien = m.leyendas_adicionales_1 || m.descripcion
  const cuit = String(m.leyendas_adicionales_2 ?? "").replace(/\D/g, "")
  const links: LinkDato[] = [{ texto: `El movimiento como quedó (${c.nombre}, ${dmy(m.fecha)})`, href: linkExtracto({ cuenta: c.cuentaId, movs: [m.id], ...rangoQueContiene([m.fecha]) }) }]
  links.push(...(cuit.length === 11 ? linksSerieMovimientos(extras, cuit, quien) : linksSerieNombre(extras, c.cuentaId, quien)))
  const vinculos: string[] = []
  if (m.sueldo_pago_id) {
    const { data: p } = await sb.schema("sueldos").from("pagos").select("empleado_id, fecha, monto, tipo, empleado:empleados(nombre), periodo:periodos(mes, anio)").eq("id", m.sueldo_pago_id).maybeSingle()
    if (p) {
      vinculos.push(`sueldo de ${p.empleado?.nombre ?? "?"} (${p.tipo ?? "pago"} ${p.periodo ? `${p.periodo.mes}/${p.periodo.anio}` : dmy(p.fecha)}, ${plata(Number(p.monto) || 0)})`)
      links.push({ texto: `📜 Los sueldos de ${p.empleado?.nombre ?? "el empleado"} (toda la tira)`, href: linkSueldosDe(String(p.empleado_id)) })
    }
  }
  if (m.comprobante_arca_id) { vinculos.push("una factura"); links.push({ texto: `La factura vinculada (Facturas ${c.empresa})`, href: linkFacturas([String(m.comprobante_arca_id)], c.empresa) }) }
  if (m.template_cuota_id) {
    const { data: q } = await sb.from("cuotas_egresos_sin_factura").select("egreso_id, estado, fecha_estimada, monto").eq("id", m.template_cuota_id).maybeSingle()
    if (q?.egreso_id) {
      vinculos.push(`la cuota de un template (${q.estado}, ${plata(Math.abs(Number(q.monto) || 0))})`)
      links.push({ texto: "El template de la cuota vinculada (sus cuotas)", href: linkTemplates([String(q.egreso_id)]) })
      const par = parDeTemplate(extras, String(q.egreso_id)); if (par) links.push(par.link)
    }
  }
  return {
    clave: t.clave, grupo: "visto", etiqueta: etiquetaVisto(t), importe, cuenta: { id: c.cuentaId, nombre: c.nombre },
    titulo: `${dmy(m.fecha)} · ${signo}${plata(importe)} · ${quien}`.slice(0, 160), papel: `Conciliación ${c.nombre} · resuelto, falta tu visto`,
    que: `${queVisto(t)}\n\nCómo quedó: ${c.nombre} · ${dmy(m.fecha)} · ${signo}${plata(importe)} · «${m.descripcion ?? ""}» · estado «${m.estado ?? "?"}»${m.categ ? ` · CATEG ${m.categ}` : ""}${m.detalle ? ` · detalle: ${m.detalle}` : ""}${vinculos.length ? `\nVinculado a: ${vinculos.join(" · ")}` : ""}`,
    propuesta: "Mirá los links: si está bien, «✔ Confirmar» (sale del recorrido y se cierra en Principal); si no, «↩ Devolver» con el motivo.",
    links, respondido: false,
  }
}

/** El tema rearmado de una cuota de template (`deu:cuota:<id>`). */
async function temaDeCuota(sb: Cliente, t: TareaPorConfirmar, cuotaId: string, extras: ExtrasTemas): Promise<Tema | null> {
  const { data: q } = await sb.from("cuotas_egresos_sin_factura").select("id, egreso_id, estado, fecha_estimada, monto, egreso:egresos_sin_factura(nombre_referencia)").eq("id", cuotaId).maybeSingle()
  if (!q) return null
  const links: LinkDato[] = [{ texto: `El template «${q.egreso?.nombre_referencia ?? "?"}» (sus cuotas)`, href: linkTemplates([String(q.egreso_id)]) }]
  const par = parDeTemplate(extras, String(q.egreso_id))
  if (par) links.push(par.link)
  const importe = Math.abs(Number(q.monto) || 0)
  return {
    clave: t.clave, grupo: "visto", etiqueta: etiquetaVisto(t), importe,
    titulo: `Cuota de ${q.egreso?.nombre_referencia ?? "?"} · ${dmy(q.fecha_estimada)} · ${plata(importe)}`.slice(0, 160), papel: "Cuota de template · resuelto, falta tu visto",
    que: `${queVisto(t)}\n\nCómo quedó: la cuota del ${dmy(q.fecha_estimada)} por ${plata(importe)} está «${q.estado}».${par ? `\n${par.texto}` : ""}`,
    propuesta: "Mirá los links: si está bien, «✔ Confirmar»; si no, «↩ Devolver» con el motivo.", links, respondido: false,
  }
}

/** El tema genérico: lo que se sabe por la tarea (cuando la clave no es de un movimiento ni de una cuota). */
const temaGenerico = (t: TareaPorConfirmar): Tema => ({
  clave: t.clave, grupo: "visto", etiqueta: etiquetaVisto(t), titulo: t.descripcion.replace(/^Balance \S+ \S+ · /, "").slice(0, 160),
  papel: "Resuelto, falta tu visto", que: `${queVisto(t)}\n\nEl pedido: ${t.motivo}`, propuesta: "Si está bien, «✔ Confirmar»; si no, «↩ Devolver» con el motivo.",
  links: [], respondido: false,
})

/**
 * Lee las tareas por confirmar ancladas a este recorrido (por la API de siempre, que respeta los permisos) y rearma
 * sus temas. Nunca tira: lo que no pudo rearmar queda como tema genérico, y el error va a `error`.
 */
export async function leerParaTuVisto(sb: Cliente, empresa: string, anioCierre: number, extras: ExtrasTemas = SIN_EXTRAS): Promise<{ tareas: TareaPorConfirmar[]; rearmados: Tema[]; error: string | null }> {
  try {
    const j = await (await fetch("/api/revisiones")).json()
    const prefijo = `${empresa}:${anioCierre}:`
    const tareas: TareaPorConfirmar[] = ((j.revisiones ?? []) as Record<string, unknown>[])
      // por confirmar (falta tu visto) y DEVUELTAS a Claude con algo ya hecho (abiertas con resolución): las dos siguen
      .filter(v => v.tabla_ref === "recorrido_balance" && String(v.registro_id ?? "").startsWith(prefijo)
        && (v.estado === "por_confirmar" || (v.estado === "abierta" && v.asignado_a === "claude")))
      .map(v => ({ id: String(v.id), clave: String(v.registro_id).slice(prefijo.length), descripcion: String(v.descripcion_ref ?? ""),
        resolucion: String(v.resolucion ?? ""), resueltoPor: String(v.resuelto_por ?? ""), motivo: String(v.motivo ?? ""), devuelta: v.estado === "abierta" }))
    const rearmados: Tema[] = []
    for (const t of tareas) {
      let tema: Tema | null = null
      try {
        const conc = t.clave.match(/^conc:([^:]+):(.+)$/), cuota = t.clave.match(/^deu:cuota:(.+)$/)
        if (conc) tema = await temaDeMovimiento(sb, t, conc[1], conc[2], extras)
        else if (cuota) tema = await temaDeCuota(sb, t, cuota[1], extras)
      } catch { tema = null }
      rearmados.push(tema ?? temaGenerico(t))
    }
    return { tareas, rearmados, error: null }
  } catch (e) { return { tareas: [], rearmados: [], error: (e as Error).message } }
}
