/**
 * 📬 El REGISTRO DE MAILS en la app — A-FEAT-1425 (JMS 30/10).
 *
 * Lee `public.mails_registro` (lo escribe el GAS `gas-buscar-pdf/RegistroMails.gs`) y `public.mails_reglas`.
 * Todo lo de este archivo es puro: lo prueban los casos de `lib/pruebas/casos.ts`.
 *
 * ⚠️ El link a Gmail y los grupos («para mirar / sin regla / guardado / archivado») existen también en el GAS, que
 * corre en Google y no puede importar este archivo. Si se cambia la regla de un lado, cambiarla del otro: los dos
 * tienen su prueba (`npm run probar` y `npm run probar:registro-mails`).
 */

/** La clave de un tipo de `public.mails_tipos` (script 147: los tipos son editables desde la app — A-FEAT-1440). */
export type TipoMail = string
export type AccionMail = "guardar" | "avisar" | "archivar"
export type GrupoMail = "mirar" | "sin_regla" | "guardado" | "archivado" | "enviado"

/** Un tipo del maestro `public.mails_tipos`. */
export interface TipoMailFila { id: string; nombre: string; orden: number }

/** Los 12 tipos con los que arrancó el maestro (script 147). La app usa los de la base; éstos sólo mientras carga. */
export const TIPOS_MAIL: { id: TipoMail; nombre: string }[] = [
  { id: "impuestos", nombre: "Impuestos" }, { id: "contador", nombre: "Contadores" }, { id: "legal", nombre: "Legal / sucesión" },
  { id: "productivo", nombre: "Productivo" }, { id: "factura", nombre: "Facturas" }, { id: "banco", nombre: "Bancos" },
  { id: "seguros", nombre: "Seguros" }, { id: "servicios", nombre: "Servicios e inmuebles" }, { id: "interno", nombre: "Interno" },
  { id: "otro", nombre: "Otros" }, { id: "notificacion", nombre: "Notificaciones" }, { id: "propaganda", nombre: "Propaganda" },
]
export const NOMBRE_TIPO_MAIL: Record<string, string> = Object.fromEntries(TIPOS_MAIL.map(t => [t.id, t.nombre]))

export const NOMBRE_GRUPO_MAIL: Record<GrupoMail, string> = {
  mirar: "Para mirar", sin_regla: "Sin regla", guardado: "Guardados", archivado: "Archivados", enviado: "Enviados",
}

export interface MailRegistrado {
  id: string
  casilla: string
  mensaje_id: string
  sentido: "recibido" | "enviado"
  fecha: string
  remitente: string | null
  remitente_nombre: string | null
  destinatarios: string | null
  asunto: string | null
  extracto: string | null
  adjuntos: { nombre: string; tipo?: string; bytes?: number }[] | null
  tipo: string | null
  tipo_manual: string | null
  accion: AccionMail | null
  estado: string
  procesado_por: string | null
  vinculos: { schema: string; tabla: string; id: string; que?: string }[] | null
  seguimiento?: SeguimientoMail | null
  seguimiento_nota?: string | null
  seguimiento_fecha?: string | null
  seguimiento_at?: string | null
}

export type SeguimientoMail = "pendiente" | "terminado"
export interface CamposSeguimiento {
  seguimiento?: SeguimientoMail | null
  seguimiento_nota?: string | null
  seguimiento_fecha?: string | null   // 'AAAA-MM-DD'
  seguimiento_at?: string | null
}

export interface ReglaMail {
  id: string
  orden: number
  activa: boolean
  remitente_patron: string
  asunto_patron: string | null
  tipo: TipoMail
  accion: AccionMail
  nota: string | null
}

/** Link directo al mensaje en Gmail (abre si la sesión de esa casilla está abierta). Igual que `linkGmail_` del GAS. */
export function linkGmail(casilla: string, mensajeId: string): string {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(casilla)}#all/${mensajeId}`
}

/** § Default del dato real: el tipo puesto a mano manda; vacío = el de la regla. */
export const tipoDeMail = (m: Pick<MailRegistrado, "tipo" | "tipo_manual">): string | null => m.tipo_manual || m.tipo

/** En qué grupo cae un mail. Mismo criterio que el reporte del GAS. */
export function grupoDeMail(m: Pick<MailRegistrado, "sentido" | "accion" | "tipo" | "tipo_manual">): GrupoMail {
  if (m.sentido === "enviado") return "enviado"
  if (m.accion === "avisar") return "mirar"
  if (!tipoDeMail(m)) return "sin_regla"
  if (m.accion === "archivar") return "archivado"
  return "guardado"
}

export interface FiltroMails {
  grupos: Set<GrupoMail>   // vacío = todos
  tipos: Set<string>       // vacío = todos
  texto: string            // en asunto, remitente, nombre o destinatarios
}

/** Pura: aplica el filtro. */
export function filtrarMails(mails: MailRegistrado[], f: FiltroMails): MailRegistrado[] {
  const q = f.texto.trim().toLowerCase()
  return mails.filter(m => {
    if (f.grupos.size && !f.grupos.has(grupoDeMail(m))) return false
    if (f.tipos.size && !f.tipos.has(tipoDeMail(m) ?? "sin_tipo")) return false
    if (q) {
      const en = [m.asunto, m.remitente, m.remitente_nombre, m.destinatarios].filter(Boolean).join(" ").toLowerCase()
      if (!en.includes(q)) return false
    }
    return true
  })
}

/**
 * Pura: cuántos hay en cada grupo y el CONTROL: cada mail cae en exactamente un grupo, así que los grupos tienen que
 * sumar el total. Si no, la pantalla lo dice (§ 🧮: el control se ve).
 */
export function contarMails(mails: MailRegistrado[]): { porGrupo: Record<GrupoMail, number>; total: number; cierra: boolean } {
  const porGrupo: Record<GrupoMail, number> = { mirar: 0, sin_regla: 0, guardado: 0, archivado: 0, enviado: 0 }
  for (const m of mails) porGrupo[grupoDeMail(m)]++
  const suma = Object.values(porGrupo).reduce((a, b) => a + b, 0)
  return { porGrupo, total: mails.length, cierra: suma === mails.length }
}

/** Pura: cuántos por tipo (para el número de cada chip, contado sobre lo filtrado por lo demás). */
export function contarPorTipo(mails: MailRegistrado[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const m of mails) { const t = tipoDeMail(m) ?? "sin_tipo"; r[t] = (r[t] ?? 0) + 1 }
  return r
}

/** Pura: valida una regla nueva antes de guardarla. Devuelve el motivo, o null si está bien. `tipos` = las claves del maestro. */
export function problemaDeRegla(r: { remitente_patron: string; tipo: string; accion: string }, tipos: string[] = TIPOS_MAIL.map(t => t.id)): string | null {
  const p = r.remitente_patron.trim().toLowerCase()
  if (!p) return "Falta de quién viene (un mail como x@y.com, o un dominio como @y.com)."
  if (p.startsWith("@") ? !/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(p) : !/^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(p)) {
    return "«De quién viene» tiene que ser un mail (x@y.com) o un dominio (@y.com)."
  }
  if (!tipos.includes(r.tipo)) return "Elegí un tipo."
  if (!["guardar", "avisar", "archivar"].includes(r.accion)) return "Elegí qué se hace."
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué hizo el sistema con cada mail — desde lo que YA guardan los procesadores (A-FEAT-1425, § pieza 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Un renglón del historial del buscador de facturas (`arca_pdf_busqueda_log`) que trae el mail de origen. */
export interface BusquedaConMail { gmail_message_id: string; resultado: string; numero_comprobante: string | null; factura_schema: string | null; drive_url: string | null }
/** Un adjunto leído del inventario de reenvíos (`arca_pdf_inventario`). */
export interface InventarioConMail { gmail_message_id: string; estado: string; nombre_archivo: string | null }

const RESULTADO_BUSQUEDA: Record<string, string> = {
  descargado: "factura archivada", revisar: "factura a revisar", descartado: "candidato descartado",
  no_encontrado: "no encontrada", error: "error al buscar", pendiente: "pendiente",
}

/**
 * Pura: lo que el sistema hizo con un mail, armado con lo que ya guardaron los procesadores. Lo registrado en el
 * propio mail (`procesado_por`) va primero; después el buscador de facturas (por factura); después el inventario de
 * reenvíos. Devuelve null si nadie lo procesó. `ok` = terminó bien (archivada / leído).
 */
export function procesadoDeMail(
  m: Pick<MailRegistrado, "mensaje_id" | "procesado_por">,
  busquedas: BusquedaConMail[], inventario: InventarioConMail[],
): { texto: string; ok: boolean; link: string | null } | null {
  if (m.procesado_por) return { texto: m.procesado_por, ok: true, link: null }
  const bs = busquedas.filter(b => b.gmail_message_id === m.mensaje_id)
  if (bs.length) {
    // Si alguna búsqueda archivó, eso manda; si no, el último estado que se vea
    const archivada = bs.find(b => b.resultado === "descargado")
    const b = archivada ?? bs[bs.length - 1]
    const fc = b.numero_comprobante ? ` ${b.factura_schema ? b.factura_schema.toUpperCase() + " " : ""}${b.numero_comprobante}` : ""
    return { texto: `${RESULTADO_BUSQUEDA[b.resultado] ?? b.resultado}${fc}${bs.length > 1 ? ` (+${bs.length - 1})` : ""}`, ok: !!archivada, link: b.drive_url }
  }
  const inv = inventario.filter(i => i.gmail_message_id === m.mensaje_id)
  if (inv.length) {
    const ilegibles = inv.filter(i => i.estado === "ilegible").length
    return { texto: `reenvío leído: ${inv.length} adjunto${inv.length > 1 ? "s" : ""}${ilegibles ? `, ${ilegibles} ilegible${ilegibles > 1 ? "s" : ""}` : ""}`, ok: ilegibles === 0, link: null }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Reaplicar las reglas a lo ya registrado — la MISMA regla que `clasificarMail_` del GAS
// ─────────────────────────────────────────────────────────────────────────────

const sinTildes = (s: string | null | undefined) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

/** Igual que `reglaCoincide_` del GAS: mail exacto o `@dominio` (con subdominios) + opcional «asunto contiene». */
export function reglaCoincide(regla: Pick<ReglaMail, "remitente_patron" | "asunto_patron" | "activa">, remitente: string | null, asunto: string | null): boolean {
  if (regla.activa === false) return false
  const p = regla.remitente_patron.trim().toLowerCase()
  const r = String(remitente ?? "").trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1")
  if (!p || !r) return false
  let ok: boolean
  if (p.startsWith("@")) {
    const dom = p.slice(1), domR = r.slice(r.indexOf("@") + 1)
    ok = domR === dom || domR.endsWith("." + dom)
  } else ok = r === p
  if (!ok) return false
  return regla.asunto_patron ? sinTildes(asunto).includes(sinTildes(regla.asunto_patron)) : true
}

/** Igual que `clasificarMail_` del GAS (sin el caso del propio reporte, que se registra ya clasificado). */
export function clasificarConReglas(reglas: ReglaMail[], remitente: string | null, asunto: string | null): { regla_id: string | null; tipo: TipoMail | null; accion: AccionMail | null } {
  const ord = [...reglas].sort((a, b) => (a.orden - b.orden) || ((b.asunto_patron ? 1 : 0) - (a.asunto_patron ? 1 : 0)))
  const r = ord.find(x => reglaCoincide(x, remitente, asunto))
  return r ? { regla_id: r.id, tipo: r.tipo, accion: r.accion } : { regla_id: null, tipo: null, accion: null }
}

/**
 * Pura: qué cambiaría si se reaplican las reglas a lo ya registrado. NO toca los corregidos a mano (`tipo_manual`)
 * ni el propio reporte. Para un enviado se mira el primer destinatario, como en el GAS.
 */
export function cambiosAlReaplicar(
  mails: (Pick<MailRegistrado, "id" | "sentido" | "remitente" | "destinatarios" | "asunto" | "tipo" | "accion" | "tipo_manual"> & { regla_id?: string | null })[],
  reglas: ReglaMail[],
): { id: string; regla_id: string | null; tipo: TipoMail | null; accion: AccionMail | null; antes: string }[] {
  const out: { id: string; regla_id: string | null; tipo: TipoMail | null; accion: AccionMail | null; antes: string }[] = []
  for (const m of mails) {
    if (m.tipo_manual) continue
    if (String(m.asunto ?? "").startsWith("[Registro de mails]")) continue
    const quien = m.sentido === "enviado" ? String(m.destinatarios ?? "").split(",")[0] : m.remitente
    const c = clasificarConReglas(reglas, quien, m.asunto)
    if (c.tipo !== m.tipo || c.accion !== m.accion) out.push({ id: m.id, ...c, antes: `${m.tipo ?? "sin tipo"}/${m.accion ?? "-"}` })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos editables y reasignar con ALCANCE — A-FEAT-1440 (CLAUDE.md § 🧩: se crea y se reasigna ahí mismo)
// ─────────────────────────────────────────────────────────────────────────────

/** Pura: nombre de cada tipo por su clave, desde el maestro. */
export function nombresDeTipos(tipos: TipoMailFila[]): Record<string, string> {
  return Object.fromEntries(tipos.map(t => [t.id, t.nombre]))
}

/** Pura: la clave de un tipo nuevo a partir de su nombre ('Cuenta corriente' → 'cuenta_corriente'), sin chocar con las que hay. */
export function claveDeTipoMail(nombre: string, existentes: string[]): string {
  const base = sinTildes(nombre).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "tipo"
  let k = base, n = 2
  while (existentes.includes(k)) k = `${base}_${n++}`
  return k
}

/** Pura: por qué no se puede crear un tipo con ese nombre (vacío o repetido), o null. */
export function problemaDeTipoNuevo(nombre: string, tipos: TipoMailFila[]): string | null {
  const n = nombre.trim()
  if (!n) return "Escribí el nombre del tipo."
  if (tipos.some(t => sinTildes(t.nombre) === sinTildes(n))) return `Ya existe el tipo «${n}».`
  return null
}

/** Con quién es el mail: el remitente si llegó, el primer destinatario si salió. Es lo que mira una regla. */
export function contraparteDeMail(m: Pick<MailRegistrado, "sentido" | "remitente" | "destinatarios">): string {
  const x = m.sentido === "enviado" ? String(m.destinatarios ?? "").split(",")[0] : String(m.remitente ?? "")
  return x.trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1")
}

/** El asunto sin «RE:», «Fwd:», «RV:» adelante: lo que tiene sentido usar como «asunto contiene». */
export function asuntoBase(asunto: string | null): string {
  return String(asunto ?? "").replace(/^\s*((re|rv|fw|fwd|tr)\s*:\s*)+/i, "").trim()
}

export type AlcanceTipo = "este" | "remitente" | "remitente_asunto"

/**
 * Pura: la regla que hace falta para reasignar «todos los de este remitente» (o «…con este asunto»). Si ya hay una
 * regla con el mismo remitente y asunto, se actualiza ésa (no se duplica). Orden 5: gana a las generales de antes.
 */
export function reglaParaAlcance(
  reglas: ReglaMail[],
  m: Pick<MailRegistrado, "sentido" | "remitente" | "destinatarios" | "accion">,
  alcance: Exclude<AlcanceTipo, "este">, tipo: string, asuntoContiene?: string,
): { existente: ReglaMail | null; regla: { remitente_patron: string; asunto_patron: string | null; tipo: string; accion: AccionMail; orden: number } } {
  const remitente_patron = contraparteDeMail(m)
  const asunto_patron = alcance === "remitente_asunto" ? (asuntoContiene ?? "").trim() || null : null
  const existente = reglas.find(r => r.remitente_patron.trim().toLowerCase() === remitente_patron &&
    sinTildes(r.asunto_patron ?? "") === sinTildes(asunto_patron ?? "")) ?? null
  const accion = (existente?.accion ?? m.accion ?? "guardar") as AccionMail
  return { existente, regla: { remitente_patron, asunto_patron, tipo, accion, orden: existente ? Math.min(existente.orden, 5) : 5 } }
}

/**
 * Pura: a qué mails ya registrados alcanza una regla, hacia atrás. Nunca los corregidos a mano (salvo el que se está
 * reasignando, `incluir`), nunca el propio reporte. El control: después de aplicar, con TODAS las reglas, cada uno
 * tiene que quedar con ese tipo — los que no (otra regla anterior gana) se devuelven aparte para mostrarlos.
 */
export function mailsQueAlcanza(
  mails: (Pick<MailRegistrado, "id" | "sentido" | "remitente" | "destinatarios" | "asunto" | "tipo_manual">)[],
  regla: Pick<ReglaMail, "remitente_patron" | "asunto_patron">, reglasDespues: ReglaMail[], tipo: string, incluir?: string,
): { alcanza: string[]; ganaOtra: string[] } {
  const alcanza: string[] = [], ganaOtra: string[] = []
  for (const m of mails) {
    if (m.tipo_manual && m.id !== incluir) continue
    if (String(m.asunto ?? "").startsWith("[Registro de mails]")) continue
    const quien = contraparteDeMail(m)
    if (!reglaCoincide({ ...regla, activa: true }, quien, m.asunto)) continue
    if (clasificarConReglas(reglasDespues, quien, m.asunto).tipo === tipo) alcanza.push(m.id)
    else ganaOtra.push(m.id)
  }
  return { alcanza, ganaOtra }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seguimiento: pendiente / terminado — A-FEAT-1437
// ─────────────────────────────────────────────────────────────────────────────

export type EstadoSeguimiento = "vencido" | "pendiente" | "terminado" | "sin_marcar"
export const NOMBRE_SEGUIMIENTO: Record<EstadoSeguimiento, string> = {
  vencido: "Vencidos", pendiente: "Pendientes", terminado: "Terminados", sin_marcar: "Sin marcar",
}

/** Pura: el estado de seguimiento de un mail. Pendiente con fecha ANTERIOR a hoy = vencido (hoy = 'AAAA-MM-DD', hora argentina). */
export function estadoSeguimiento(m: CamposSeguimiento, hoy: string): EstadoSeguimiento {
  if (m.seguimiento === "terminado") return "terminado"
  if (m.seguimiento === "pendiente") return m.seguimiento_fecha && m.seguimiento_fecha < hoy ? "vencido" : "pendiente"
  return "sin_marcar"
}

/** Pura: los pendientes primero (los vencidos y los de fecha más cercana arriba), después el resto por fecha del mail. */
export function ordenarPendientesArriba<T extends CamposSeguimiento & { fecha: string }>(mails: T[], hoy: string): T[] {
  const peso = (m: T) => { const e = estadoSeguimiento(m, hoy); return e === "vencido" ? 0 : e === "pendiente" ? 1 : 2 }
  return [...mails].sort((a, b) => {
    const d = peso(a) - peso(b)
    if (d) return d
    if (peso(a) < 2) return (a.seguimiento_fecha ?? "9999") < (b.seguimiento_fecha ?? "9999") ? -1 : (a.seguimiento_fecha ?? "9999") > (b.seguimiento_fecha ?? "9999") ? 1 : (a.fecha < b.fecha ? 1 : -1)
    return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0
  })
}

/** Pura: suma los mails de un período con TODOS los pendientes (aunque sean de antes), sin repetir. */
export function juntarConPendientes<T extends { id: string }>(periodo: T[], pendientes: T[]): T[] {
  const ids = new Set(periodo.map(m => m.id))
  return [...periodo, ...pendientes.filter(p => !ids.has(p.id))]
}

/** Pura: por qué no se puede guardar un seguimiento, o null. La nota y la fecha son optativas (marcar pendiente es un clic). */
export function problemaDeSeguimiento(s: { fecha: string }): string | null {
  if (s.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) return "La fecha no es válida."
  return null
}

/** Pura: la CLASE de lo que se hizo con un mail, para filtrar ('factura archivada MSA 3-1520 (+1)' → 'factura archivada'). */
export function claseDeProcesado(texto: string): string {
  return texto.replace(/\s*\(\+\d+\)$/, "").replace(/\s+(MSA|PAM|MA)\b.*$/, "").replace(/[:\s]+\d.*$/, "").trim()
}
