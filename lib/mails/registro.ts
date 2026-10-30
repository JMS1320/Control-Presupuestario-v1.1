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

export type TipoMail =
  | "factura" | "banco" | "impuestos" | "contador" | "productivo" | "legal" | "interno"
  | "servicios" | "seguros" | "notificacion" | "propaganda" | "otro"
export type AccionMail = "guardar" | "avisar" | "archivar"
export type GrupoMail = "mirar" | "sin_regla" | "guardado" | "archivado" | "enviado"

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

/** Pura: valida una regla nueva antes de guardarla. Devuelve el motivo, o null si está bien. */
export function problemaDeRegla(r: { remitente_patron: string; tipo: string; accion: string }): string | null {
  const p = r.remitente_patron.trim().toLowerCase()
  if (!p) return "Falta de quién viene (un mail como x@y.com, o un dominio como @y.com)."
  if (p.startsWith("@") ? !/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(p) : !/^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(p)) {
    return "«De quién viene» tiene que ser un mail (x@y.com) o un dominio (@y.com)."
  }
  if (!NOMBRE_TIPO_MAIL[r.tipo]) return "Elegí un tipo."
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
