/**
 * 🧭 **EL RECORRIDO DEL BALANCE — la cola de temas a resolver** (A-FEAT-1430, JMS 30/10).
 *
 * *«Como un viaje de trabajo con el balance que va mostrando los temas, poder abrir detalles, que alcance para
 * evaluar y decidir… teniendo esa UI bien aceitada podré viajar a través de los pendientes fluidamente y
 * responderlos.»*
 *
 * Parte pura: arma la cola con dos fuentes que ya existen —
 * 1. los datos de «00 Cobertura» que NO salen (error, a decidir, falta inicio, falta información, pendiente de
 *    desarrollo), con su propuesta y sus links;
 * 2. las preguntas de «Pendientes a revisar» (`public.balance_pendientes`), que es también donde se guardan las
 *    respuestas: un tema de cobertura respondido es un pendiente cuyo texto empieza con su clave `[cob:…]`.
 * Así no hay una tabla nueva ni una segunda lista: lo que se responde acá sale en la solapa «Pendientes a revisar».
 */
import type { CoberturaPapeles, EstadoCobertura, ItemCobertura, LinkDato } from "./cobertura-papeles"
import type { PendienteBalance } from "./pendientes-balance"
import type { Comparacion } from "@/lib/cuaderno/papel-de-trabajo"

export type GrupoTema = "error" | "decision" | "falta inicio" | "sin informacion" | "pendiente desarrollo" | "pregunta" | "conciliacion" | "deuda"

export const GRUPOS: { id: GrupoTema; icono: string; titulo: string }[] = [
  { id: "error", icono: "⛔", titulo: "Errores" },
  { id: "decision", icono: "❓", titulo: "A decidir" },
  { id: "pregunta", icono: "💬", titulo: "Preguntas" },
  // 🏦 A-FEAT-1430 paso 4: la conciliación, movimiento por movimiento y deuda por deuda.
  { id: "conciliacion", icono: "🏦", titulo: "Conciliar movimientos" },
  { id: "deuda", icono: "🧾", titulo: "Deudas sin pago" },
  { id: "falta inicio", icono: "⏳", titulo: "Falta el saldo de inicio" },
  { id: "sin informacion", icono: "📭", titulo: "Falta información" },
  { id: "pendiente desarrollo", icono: "🛠️", titulo: "Pendiente de desarrollo" },
]

export interface Tema {
  /** Estable entre recargas: `cob:<papel y dato>` o `pend:<id>`. */
  clave: string
  grupo: GrupoTema
  titulo: string
  /** De qué papel viene (o «Pendientes a revisar»). */
  papel: string
  valor2425?: string
  /** Qué pasa hoy. */
  que: string
  propuesta?: string
  links: LinkDato[]
  solapa?: string
  idPendiente?: string
  /** El pendiente donde vive (o va a vivir) la respuesta. */
  pendiente?: PendienteBalance
  /** `true` = ya tiene respuesta (resuelto). */
  respondido: boolean
  /** 📓 La tabla A contra B para el papel de trabajo, si el tema se explica con números. */
  comparacion?: Comparacion
  /** Una etiqueta corta del tipo (en la conciliación: «Pareja exacta», «Con diferencia»…), para filtrar y ver de un vistazo. */
  etiqueta?: string
  /** Importe del tema (la conciliación lo muestra en la lista). */
  importe?: number
}

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

/** La clave de un dato de cobertura: no cambia mientras no cambie el catálogo. */
export const claveCobertura = (i: Pick<ItemCobertura, "papel" | "dato">) => `cob:${slug(`${i.papel} ${i.dato}`)}`

/** El texto con que se guarda la respuesta de un tema de cobertura en «Pendientes a revisar». */
export const textoPendienteDe = (t: Pick<Tema, "clave" | "titulo" | "que">) => `[${t.clave}] ${t.titulo} — ${t.que}`.slice(0, 900)

const ORDEN: GrupoTema[] = GRUPOS.map(g => g.id)
/** La clave de un tema dentro del texto de su respuesta: `[cob:…]`, `[conc:…]` o `[deu:…]`. */
const CLAVE_EN_TEXTO = /^\[((?:cob|conc|deu):[^\]]+)\]/
const GRUPO_DE: Partial<Record<EstadoCobertura, GrupoTema>> = {
  "error": "error", "decision": "decision", "falta inicio": "falta inicio",
  "sin informacion": "sin informacion", "pendiente desarrollo": "pendiente desarrollo",
}

/**
 * La cola: primero lo que más importa (errores, decisiones, preguntas), y dentro de cada grupo en el orden del
 * catálogo. Un dato de cobertura que ya sale no entra; uno que no sale entra aunque esté respondido (queda tildado).
 */
export function armarTemas(cobertura: CoberturaPapeles | null, pendientes: PendienteBalance[], otros: Tema[] = []): Tema[] {
  const porClave = new Map<string, PendienteBalance>()
  for (const p of pendientes) {
    const m = CLAVE_EN_TEXTO.exec(p.texto)
    if (m) porClave.set(m[1], p)
  }
  const temas: Tema[] = []
  for (const i of cobertura?.items ?? []) {
    const grupo = GRUPO_DE[i.estado]
    if (!grupo) continue
    const clave = claveCobertura(i)
    const p = porClave.get(clave)
    temas.push({
      clave, grupo, titulo: i.dato, papel: i.papel, valor2425: i.valor2425, que: i.detalle,
      propuesta: i.propuesta, links: i.links ?? [], solapa: i.solapa, idPendiente: i.pendiente, comparacion: i.comparacion,
      pendiente: p, respondido: p?.estado === "resuelto",
    })
  }
  // 🏦 Los temas que arma otra fuente (la conciliación): se les engancha su respuesta por la clave.
  for (const t of otros) { const p = porClave.get(t.clave); temas.push({ ...t, pendiente: p, respondido: p?.estado === "resuelto" }) }
  for (const p of pendientes) {
    if (CLAVE_EN_TEXTO.test(p.texto)) continue
    temas.push({
      clave: `pend:${p.id}`, grupo: "pregunta", titulo: p.texto.replace(/^❓\s*/, "").slice(0, 140), papel: "Pendientes a revisar",
      que: p.texto, links: [], pendiente: p, respondido: p.estado === "resuelto",
    })
  }
  return temas.sort((a, b) => ORDEN.indexOf(a.grupo) - ORDEN.indexOf(b.grupo))
}

/** Cuántos hay y cuántos están respondidos, por grupo y en total. */
export function progreso(temas: Tema[]) {
  const porGrupo = Object.fromEntries(ORDEN.map(g => [g, { total: 0, respondidos: 0 }])) as Record<GrupoTema, { total: number; respondidos: number }>
  for (const t of temas) { porGrupo[t.grupo].total++; if (t.respondido) porGrupo[t.grupo].respondidos++ }
  return { total: temas.length, respondidos: temas.filter(t => t.respondido).length, porGrupo }
}
