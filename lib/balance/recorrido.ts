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

export type GrupoTema = "error" | "decision" | "falta inicio" | "sin informacion" | "pendiente desarrollo" | "pregunta" | "arca" | "documento" | "conciliacion" | "deuda" | "cheque"

/**
 * 🧱 **Dos niveles de grupos** (JMS 31/10: *«subdiarios cargados tal cual ARCA, todos los canales de pagos y cobros
 * conciliados, saldo del balance anterior: eso es la base; si no está completa no sería bueno trabajar demasiado,
 * porque después cambia lo que compone el resto»*).
 * - **nivel 1 · la base**: va primero en la cola y arriba en los chips; si tiene abiertos, el recorrido recomienda
 *   terminarla antes.
 * - **nivel 2 · el resto**, en el orden en que conviene mirarlo: errores, decisiones, preguntas, deudas, documentos…
 * Los tipos de cada grupo (el «nivel 3») aparecen sólo al elegir un grupo.
 */
export const GRUPOS: { id: GrupoTema; icono: string; titulo: string; nivel: 1 | 2 }[] = [
  // 🧾 A-FEAT-1439: la app contra lo PRESENTADO a ARCA (libro IVA de cada mes, guardado en `ddjj_presentadas`).
  { id: "arca", icono: "🧾", titulo: "Subdiarios contra lo presentado a ARCA", nivel: 1 },
  // 🏦 A-FEAT-1430 paso 4: la conciliación, movimiento por movimiento.
  { id: "conciliacion", icono: "🏦", titulo: "Conciliar movimientos", nivel: 1 },
  { id: "cheque", icono: "✍️", titulo: "Echeqs sin marcar cobrados", nivel: 1 },
  { id: "falta inicio", icono: "⏳", titulo: "Falta el saldo de inicio", nivel: 1 },
  { id: "error", icono: "⛔", titulo: "Errores", nivel: 2 },
  { id: "decision", icono: "❓", titulo: "A decidir", nivel: 2 },
  { id: "pregunta", icono: "💬", titulo: "Preguntas", nivel: 2 },
  { id: "deuda", icono: "🧾", titulo: "Deudas sin pago", nivel: 2 },
  // 📥 A-FEAT-1439: los datos que «salen» con lo que tiene la app pero sin el documento que los respalda — el pedido.
  { id: "documento", icono: "📥", titulo: "Documentos que faltan", nivel: 2 },
  { id: "sin informacion", icono: "📭", titulo: "Falta información", nivel: 2 },
  { id: "pendiente desarrollo", icono: "🛠️", titulo: "Pendiente de desarrollo", nivel: 2 },
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
  /**
   * 📄 **La FUENTE — lo objetivo** (A-FEAT-1439, JMS 31/10: *«siempre con la posibilidad de ver lo objetivo, no sólo tu
   * propuesta»*): de dónde sale el dato contra el que se compara la app — lo presentado a ARCA, el extracto del banco,
   * el papel del contador. Si un tema no la trae, `fuenteDe` la deduce cuando puede; si no puede, el recorrido lo dice.
   */
  fuente?: FuenteTema
  /** 📄 Si no hay fuente cargada: el documento que la debería respaldar («el resumen del banco al 30/06»). */
  fuenteEsperada?: string
  /** Una etiqueta corta del tipo (en la conciliación: «Pareja exacta», «Con diferencia»…), para filtrar y ver de un vistazo. */
  etiqueta?: string
  /** 🏦 La cuenta del movimiento (conciliación), para el resumen por cuenta. */
  cuenta?: { id: string; nombre: string }
  /** 🏦 Débito o crédito (conciliación). */
  lado?: "D" | "C"
  /** 🏦 Fecha del movimiento (conciliación), ISO. */
  fecha?: string
  /** Importe del tema (la conciliación lo muestra en la lista). */
  importe?: number
  /**
   * ⚡ Una acción de un clic, cuando el caso es claro y la propone el sistema (p. ej. marcar un echeq «cobrado» con la
   * fecha de su débito). La ejecuta el usuario con el botón; el recorrido nunca escribe solo.
   */
  accion?: AccionTema
}

/** 📄 Lo objetivo de un tema: qué documento es, qué dice, y dónde verlo (si se puede abrir). */
export interface FuenteTema {
  /** Qué documento es: «Libro IVA presentado a ARCA», «Extracto del banco», «Papeles 24/25 del contador». */
  origen: string
  /** Lo que dice, en una o dos líneas (período, secuencia, código de presentación, el valor). */
  detalle: string
  links?: LinkDato[]
}

export type AccionTema = { tipo: "cheque-cobrado"; texto: string; chequeId: string; fecha: string; numero?: string | null }

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

/** La clave de un dato de cobertura: no cambia mientras no cambie el catálogo. */
export const claveCobertura = (i: Pick<ItemCobertura, "papel" | "dato">) => `cob:${slug(`${i.papel} ${i.dato}`)}`

/** El texto con que se guarda la respuesta de un tema de cobertura en «Pendientes a revisar». */
export const textoPendienteDe = (t: Pick<Tema, "clave" | "titulo" | "que">) => `[${t.clave}] ${t.titulo} — ${t.que}`.slice(0, 900)

const ORDEN: GrupoTema[] = GRUPOS.map(g => g.id)
/** La clave de un tema dentro del texto de su respuesta: `[cob:…]`, `[conc:…]`, `[deu:…]`, `[chq:…]` o `[arca:…]`. */
const CLAVE_EN_TEXTO = /^\[((?:cob|conc|deu|chq|arca|doc):[^\]]+)\]/
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
    // 📥 Sale con lo que tiene la app, pero sin su documento: se pide (JMS 31/10: «eso que falta me será pedido en el recorrido, ¿verdad?»).
    if (i.estado === "sale" && i.fuenteEsperada && !i.fuente) {
      const clave = `doc:${slug(`${i.papel} ${i.dato}`)}`
      const p = porClave.get(clave)
      temas.push({
        clave, grupo: "documento", titulo: `${i.dato}: falta ${i.fuenteEsperada}`, papel: i.papel, valor2425: i.valor2425,
        que: `Sale con lo que tiene la app (${i.detalle}), pero no está el documento que lo respalda: ${i.fuenteEsperada}.`,
        propuesta: "Dejá el documento en la carpeta de comunicación (o cargalo en la app): pasa a ser la fuente de este dato. Si no existe o no hace falta, «👍 Está bien así» con el motivo.",
        links: i.links ?? [], solapa: i.solapa, fuenteEsperada: i.fuenteEsperada, pendiente: p, respondido: p?.estado === "resuelto",
      })
      continue
    }
    const grupo = GRUPO_DE[i.estado]
    if (!grupo) continue
    const clave = claveCobertura(i)
    const p = porClave.get(clave)
    temas.push({
      clave, grupo, titulo: i.dato, papel: i.papel, valor2425: i.valor2425, que: i.detalle,
      propuesta: i.propuesta, links: i.links ?? [], solapa: i.solapa, idPendiente: i.pendiente, comparacion: i.comparacion, fuente: i.fuente, fuenteEsperada: i.fuenteEsperada,
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

/** 🏦 Un link al extracto es la FUENTE de un tema: el banco no lo escribe la app. */
const esLinkDeBanco = (l: LinkDato) => /[?&]seccion=extracto(&|$)/.test(l.href)

/**
 * 📄 La fuente de un tema (A-FEAT-1439): la que trae, o la que se deduce de lo que ya tiene — el extracto del banco
 * entre sus links. `null` = no tiene: el recorrido lo muestra como «sin fuente», para que se vea que ahí se lee sólo
 * lo que dice la app.
 * ⚠️ cambió 31/10: también contaba el valor de los papeles 24/25 como fuente, y NO lo es — es lo del año pasado, no lo
 * objetivo del número de este año. Con eso, los 45 datos de la cobertura figuraban «con fuente» sin tenerla y el
 * control de arriba mentía. El valor 24/25 sigue a la vista («El año pasado»), como referencia.
 */
export function fuenteDe(t: Pick<Tema, "fuente" | "links" | "valor2425">): FuenteTema | null {
  if (t.fuente) return t.fuente
  const banco = t.links.filter(esLinkDeBanco)
  if (banco.length) return { origen: "Extracto del banco", detalle: "El movimiento tal cual lo informó el banco.", links: banco }
  return null
}

/** 🗂️ Los links «En la app»: todos menos los que ya se usaron como fuente. */
export function linksDeLaApp(t: Pick<Tema, "fuente" | "links" | "valor2425">): LinkDato[] {
  const f = fuenteDe(t)
  const usados = new Set((f?.links ?? []).map(l => l.href))
  return t.links.filter(l => !usados.has(l.href))
}

/** 🧮 El control de los tres bloques: cuántos temas abiertos no tienen fuente, o no tienen dónde verlo en la app. */
export function sinTresVistas(temas: Tema[]): { sinFuente: number; sinLink: number } {
  const abiertos = temas.filter(t => !t.respondido)
  return {
    sinFuente: abiertos.filter(t => !fuenteDe(t)).length,
    sinLink: abiertos.filter(t => !linksDeLaApp(t).length).length,
  }
}

/**
 * 🏦 **Lo pendiente de conciliar, por cuenta** (JMS 31/10: *«¿dónde figura rápidamente a la vista lo pendiente de
 * conciliar, e ir a verlo y trabajarlo para terminarlo?»*). Para el balance no interesan 419 movimientos sueltos sino
 * cuánto falta en cada cuenta: cuántos, cuánta plata salió y entró, y un link a la cuenta en ese rango de fechas.
 */
export interface ConciliacionPorCuenta { cuentaId: string; nombre: string; abiertos: number; debitos: number; creditos: number; desde: string | null; hasta: string | null }
export function conciliacionPorCuenta(temas: Tema[]): ConciliacionPorCuenta[] {
  const m = new Map<string, ConciliacionPorCuenta & { fechas: string[] }>()
  for (const t of temas) {
    if (t.grupo !== "conciliacion" || t.respondido || !t.cuenta) continue
    const c = m.get(t.cuenta.id) ?? { cuentaId: t.cuenta.id, nombre: t.cuenta.nombre, abiertos: 0, debitos: 0, creditos: 0, desde: null, hasta: null, fechas: [] }
    c.abiertos++
    if (t.lado === "D") c.debitos += t.importe ?? 0; else c.creditos += t.importe ?? 0
    if (t.fecha) c.fechas.push(t.fecha)
    m.set(t.cuenta.id, c)
  }
  return [...m.values()].map(({ fechas, ...c }) => {
    const f = [...fechas].sort()
    return { ...c, desde: f[0] ?? null, hasta: f[f.length - 1] ?? null }
  }).sort((a, b) => b.abiertos - a.abiertos)
}
