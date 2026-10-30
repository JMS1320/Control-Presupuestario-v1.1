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
