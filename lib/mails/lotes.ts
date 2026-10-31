/**
 * 📦 ARCHIVAR POR LOTES desde Mails — A-FEAT-1442 etapa 2 (JMS 31/10: «también desde la vista de mails, para trabajar
 * de a lotes ahí»).
 *
 * Los mails «para guardar» que traen documentos se agrupan por su REGLA; cada regla sabe a qué carpeta van
 * (`mails_reglas.archivo_destino` → `archivo_destinos`, scripts 148/149). Un grupo sin carpeta muestra el 📁❗ rojo y
 * su «Archivar» queda pendiente hasta que se elige. El GAS (`archivar_mail`) guarda los adjuntos en la carpeta → la del
 * año, sin pisar ni duplicar. Lo archivado queda en el registro del mail (`vinculos` con el link a cada archivo).
 *
 * Fuera de este circuito: las FACTURAS (las toma el buscador de facturas, con su regla de CUIT + número) y las boletas
 * de ARBA (vienen por link, no adjuntas: Cash Flow → Boletas ARBA).
 */
import type { MailRegistrado, ReglaMail } from "@/lib/mails/registro"
import { contraparteDeMail, tipoDeMail } from "@/lib/mails/registro"

export type ReglaConDestino = ReglaMail & { archivo_destino?: string | null }
export interface VinculoMail { schema: string; tabla: string; id: string; que?: string }

/** Los adjuntos que se archivan: PDF e imágenes (no las de la firma, que el GAS ya saltea). */
export const esDocumento = (a: { nombre: string; tipo?: string }) => /pdf|image\/(jpeg|png)/i.test(a.tipo ?? "") || /\.(pdf|jpe?g|png)$/i.test(a.nombre)

/** Pura: ¿ya se archivó este mail? (un vínculo a un archivo del Drive). */
export function yaArchivado(m: Pick<MailRegistrado, "vinculos">): boolean {
  return (m.vinculos ?? []).some(v => v.schema === "drive")
}

/** Pura: los mails que entran al lote: recibidos, «guardar», con documentos, que no son facturas y no se archivaron. */
export function mailsParaArchivar(mails: MailRegistrado[]): MailRegistrado[] {
  return mails.filter(m => m.sentido === "recibido" && m.accion === "guardar" && tipoDeMail(m) !== "factura"
    && (m.adjuntos ?? []).some(esDocumento) && !yaArchivado(m))
}

export interface GrupoLote { clave: string; regla: ReglaConDestino | null; titulo: string; mails: MailRegistrado[] }

/** Pura: agrupa por regla (los sin regla, por remitente: hay que darles tipo primero). Los más numerosos arriba. */
export function agruparPorRegla(mails: MailRegistrado[], reglas: ReglaConDestino[]): GrupoLote[] {
  const porId = new Map(reglas.map(r => [r.id, r]))
  const g = new Map<string, GrupoLote>()
  for (const m of mails) {
    const regla = m.regla_id ? porId.get(m.regla_id) ?? null : null
    const clave = regla ? `r:${regla.id}` : `s:${contraparteDeMail(m)}`
    if (!g.has(clave)) {
      const titulo = regla ? `${regla.remitente_patron}${regla.asunto_patron ? ` · asunto «${regla.asunto_patron}»` : ""}` : `${contraparteDeMail(m)} (sin regla)`
      g.set(clave, { clave, regla, titulo, mails: [] })
    }
    g.get(clave)!.mails.push(m)
  }
  return [...g.values()].sort((a, b) => (b.regla ? 1 : 0) - (a.regla ? 1 : 0) || b.mails.length - a.mails.length || a.titulo.localeCompare(b.titulo))
}

/** El año del mail en hora argentina: va a la carpeta de ese año (no la de hoy: un mail de diciembre va a su año). */
export function anioDeMail(fechaIso: string): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric" }).format(new Date(fechaIso)))
}

export interface ResultadoArchivo { ok: boolean; error?: string; guardados?: { nombre: string; id: string; url: string }[]; ya_estaban?: { nombre: string; id: string; url: string }[]; salteados?: string[]; carpeta?: { nombre: string } }

/** Pura: los vínculos del mail después de archivar (se suman, sin repetir el mismo archivo). */
export function vinculosConArchivos(previos: VinculoMail[] | null, r: ResultadoArchivo): VinculoMail[] {
  const out = [...(previos ?? [])]
  for (const f of [...(r.guardados ?? []), ...(r.ya_estaban ?? [])]) {
    if (!out.some(v => v.schema === "drive" && v.id === f.id)) out.push({ schema: "drive", tabla: "archivo", id: f.id, que: `${f.nombre} | ${f.url}` })
  }
  return out
}

/**
 * Pura: el CONTROL del lote — cada adjunto del mail tiene que terminar en exactamente un lado: guardado, ya estaba, o
 * salteado (no era documento). Si no suma, algo se perdió y se dice.
 */
export function controlArchivado(adjuntos: number, r: ResultadoArchivo): { cierra: boolean; texto: string } {
  const g = r.guardados?.length ?? 0, y = r.ya_estaban?.length ?? 0, s = r.salteados?.length ?? 0
  return { cierra: g + y + s === adjuntos, texto: `${g} guardado${g === 1 ? "" : "s"} + ${y} ya estaba${y === 1 ? "" : "n"} + ${s} salteado${s === 1 ? "" : "s"} = ${g + y + s} de ${adjuntos}` }
}

/** Pura: el link al primer archivo guardado de un mail (para el 📎 y «Qué se hizo»). */
export function linkDeArchivo(vinculos: VinculoMail[] | null): string | null {
  const v = (vinculos ?? []).find(x => x.schema === "drive")
  return v?.que?.split(" | ")[1] ?? null
}

/** Pura: los mails ARCHIVADOS que todavía no pasaron su monto a una cuota (ni se marcaron «no va») — etapa 3. */
export function mailsParaCuota(mails: MailRegistrado[]): MailRegistrado[] {
  return mails.filter(m => tipoDeMail(m) !== "factura" && (m.vinculos ?? []).some(v => v.schema === "drive")
    && !(m.vinculos ?? []).some(v => v.tabla === "cuotas_egresos_sin_factura" || v.schema === "ninguna"))
}

// ─────────────────────────────────────────────────────────────────────────────
// Separar por ASUNTO un mismo remitente — A-FEAT-1447 (nota 🌙 JMS 31/10: «algunas tendrán una lógica y otras otra de
// acuerdo al asunto… mensuales o anuales, que irían a distintas carpetas»)
// ─────────────────────────────────────────────────────────────────────────────

const sinTildesL = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre"
const VACIAS = new Set(["desde", "hasta", "para", "adelante", "sobre", "envio", "adjunto", "adjunta", "pedido", "maria", "mercedes", "areco"])

/** Pura: el TEMA de un asunto — sin RE:/Fwd:, fechas, meses, años ni números («Re: SICORE - desde Marzo 2026» → «sicore desde en adelante»). */
export function temaDeAsunto(asunto: string | null): string {
  return sinTildesL(String(asunto ?? "").replace(/^\s*((re|rv|fw|fwd|tr)\s*:\s*)+/i, ""))
    .replace(/\b\d{1,4}[/-]\d{1,4}([/-]\d{1,4})?\b/g, " ")
    .replace(new RegExp(`\b(${MESES})\b`, "g"), " ")
    .replace(/\b\d+\b/g, " ").replace(/[^a-z0-9ñ]+/g, " ").replace(/\s+/g, " ").trim()
}

/** Pura: la palabra que define el tema, para el «asunto contiene» de la regla (la primera de 4+ letras que dice algo). */
export function claveDeTema(asunto: string | null): string {
  const palabras = temaDeAsunto(asunto).split(" ").filter(p => p.length >= 4 && !VACIAS.has(p))
  return palabras[0] ?? temaDeAsunto(asunto).split(" ")[0] ?? ""
}

/** Pura: los mails de un grupo, por tema (la palabra clave del asunto). Los más numerosos primero. */
export function agruparPorTema(mails: MailRegistrado[]): { clave: string; mails: MailRegistrado[] }[] {
  const g = new Map<string, MailRegistrado[]>()
  for (const m of mails) { const k = claveDeTema(m.asunto) || "(sin asunto)"; if (!g.has(k)) g.set(k, []); g.get(k)!.push(m) }
  return [...g.entries()].map(([clave, ms]) => ({ clave, mails: ms })).sort((a, b) => b.mails.length - a.mails.length || a.clave.localeCompare(b.clave))
}

/** Pura: el estado de la casilla del título: todos, ninguno o algunos (para el «–»). */
export function estadoSeleccion(ids: string[], marcados: Set<string>): "todos" | "ninguno" | "algunos" {
  const n = ids.filter(id => marcados.has(id)).length
  return n === 0 ? "ninguno" : n === ids.length ? "todos" : "algunos"
}
