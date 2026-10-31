/**
 * 📨↩️ EL IDA Y VUELTA CON EL CONTADOR — A-AUTO-09 (pasos 1 y 2).
 *
 * Pedido de JMS (2026-10-27): *«encolamos el mail para el contador con el envío de subdiario con cierto formato, le
 * adjuntamos los archivos mensuales; él responde a ese mail con la presentación de IVA; lo recogemos y hubiera saltado
 * el error»*. Y: *«el mail es bnoltfuentes@gmail.com y el asunto del mail para envío deberá ser Subdiario Mes Año»*.
 *
 *   IDA    · «📨 Enviado al contador» (Subdiarios) → se encola en `mails_pago` (tipo `subdiario`) con el PDF y el Excel del
 *            mes → el GAS deja el BORRADOR en Gmail, como los detalles de pago, y JMS lo manda.
 *   VUELTA · el contador contesta ese mail con la DDJJ (PDF) y el zip del libro IVA de ARCA → el GAS lo levanta y lo
 *            manda a `/api/contador/ddjj` → `procesarLibroPresentado`: guarda (`ddjj_presentadas`), compara contra el
 *            subdiario y, si coincide, pasa el mes a «DDJJ OK» solo; si no, deja un aviso a JMS y a Ulises.
 *   Lo mismo pasa si el zip se sube a mano en Subdiarios («📥 Lo que devolvió el contador»).
 */
import { leerZipLibroIva, compararSubdiarioConLibro, type ResultadoContraPresentado } from "./libro-presentado"
import { TIPOS_SIN_CREDITO_COMPRAS } from "./cuadratura"
import { filasDelSubdiario } from "@/lib/facturas/historico-como-factura"

/** El contador de MSA. Si cambia, se cambia acá (y en el GAS de la vuelta, que busca sus respuestas). */
export const CONTADOR = { nombre: "Blas", email: "bnoltfuentes@gmail.com" }

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

/** «Subdiario Enero 2026» — el asunto pedido por JMS. Es también lo que el GAS busca en la respuesta. */
export function asuntoSubdiario(mes: number, anio: number): string {
  return `Subdiario ${MESES[mes - 1]} ${anio}`
}

/** El período de un asunto «Subdiario Mes Año» (también con «Re:»/«RE:» adelante). null si no es uno nuestro. */
export function periodoDelAsunto(asunto: string): { mes: number; anio: number } | null {
  const m = String(asunto ?? "").match(/subdiario\s+([a-záéíóú]+)\s+(\d{4})/i)
  if (!m) return null
  const mes = MESES.findIndex(x => x.toLowerCase() === m[1].toLowerCase()) + 1
  return mes ? { mes, anio: Number(m[2]) } : null
}

export function cuerpoSubdiario(empresa: string, mes: number, anio: number, comprobantes: number): string {
  return [
    `Hola ${CONTADOR.nombre},`,
    "",
    `Te mando el subdiario de IVA Compras de ${empresa} de ${MESES[mes - 1].toLowerCase()} ${anio} (${comprobantes} comprobantes): va el PDF y el Excel.`,
    "",
    "Cuando lo presentes, por favor respondé ESTE mismo mail adjuntando:",
    "  1. la DDJJ de IVA en PDF, y",
    "  2. el zip del libro IVA que exporta ARCA al presentar (libro_iva_periodo_AAAAMM_original.zip).",
    "",
    "Con eso la app controla sola que lo presentado coincida con el subdiario.",
    "",
    "Gracias,",
  ].join("\n")
}

/**
 * Una «carpeta» en memoria: los generadores del subdiario guardan en una carpeta elegida (File System Access API);
 * dándoles ésta, en vez de bajar el archivo lo dejan acá para adjuntarlo al mail. Mismo PDF y mismo Excel que el botón.
 */
export function carpetaEnMemoria() {
  const archivos = new Map<string, Uint8Array>()
  const dir = {
    name: "mail al contador",
    async getFileHandle(nombre: string, opts?: { create?: boolean }) {
      if (!opts?.create && !archivos.has(nombre)) throw new DOMException("no existe", "NotFoundError")
      return {
        async createWritable() {
          return {
            async write(d: ArrayBuffer | Uint8Array) { archivos.set(nombre, d instanceof Uint8Array ? d : new Uint8Array(d)) },
            async close() { /* nada */ },
          }
        },
      }
    },
  }
  return { dir, archivos }
}

export function aBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  txt: "text/plain",
}

// ── La vuelta ───────────────────────────────────────────────────────────────────────────────────

export interface ResultadoDdjj {
  periodo: string // AAAAMM
  secuencia: number
  coincide: boolean
  comparacion: ResultadoContraPresentado
  /** Cuántos comprobantes pasaron a «DDJJ OK» (sólo si coincide). */
  marcadosDdjjOk: number
  /** A quiénes se les dejó el aviso (si no coincide). */
  avisados: string[]
  /** Ya estaba guardada esa misma presentación: no se duplicó. */
  yaEstaba: boolean
}

/**
 * Procesa el zip del libro IVA que devuelve el contador. `db` = cliente con permiso (servicio).
 * Guarda una fila por empresa + período + secuencia (la misma presentación dos veces no duplica; una rectificativa
 * es otra secuencia y no pisa la original).
 */
export async function procesarLibroPresentado(db: any, p: {
  empresa: string; schema: string; datos: ArrayBuffer | Uint8Array; archivo: string; origen: "subida" | "mail"; cargadoPor: string | null
}): Promise<ResultadoDdjj> {
  const { fila, comparacion, previa, anio, mes, periodo } = await armarYGuardarDdjj(db, p)
  const res: ResultadoDdjj = { periodo, secuencia: fila.secuencia, coincide: comparacion.ok, comparacion, marcadosDdjjOk: 0, avisados: [], yaEstaba: !!previa }
  if (comparacion.ok) {
    // Lo mismo que «Confirmar DDJJ»: lo Imputado y Enviado del mes pasa a «DDJJ OK».
    const u = await db.schema(p.schema).from("comprobantes_arca").update({ ddjj_iva: "DDJJ OK" })
      .eq("año_contable", anio).eq("mes_contable", mes).in("ddjj_iva", ["Imputado", "Enviado"]).select("id")
    if (!u.error) res.marcadosDdjjOk = (u.data ?? []).length
    return res
  }
  // No coincide: aviso a JMS (admin) y a Ulises (contable), por la campanita (una marca con destinatario). Si la
  // misma presentación ya estaba guardada y avisada, no se repite el aviso.
  if (previa && previa.coincide === false) return res
  return avisarQueNoCoincide(db, p.schema, res, anio, mes, fila.secuencia, comparacion)
}

/**
 * 🗃️ Lee el zip, lo compara contra el subdiario de compras de la app y GUARDA la fila en `ddjj_presentadas` (sin
 * efectos sobre nada más). La usan la pantalla y la vuelta del mail (vía `procesarLibroPresentado`) y la carga en lote
 * del script 146 — un solo camino, así la fila queda igual venga de donde venga.
 *
 * 🧾 Desde A-FEAT-1439 guarda también las VENTAS del libro (`ventas`, `totales_ventas`, script 145): el recorrido del
 * balance las muestra como la fuente objetiva. Si la base todavía no tiene esas columnas, guarda como antes.
 */
export async function armarYGuardarDdjj(db: any, p: {
  empresa: string; schema: string; datos: ArrayBuffer | Uint8Array; archivo: string; origen: "subida" | "mail"; cargadoPor: string | null
}) {
  const z = await leerZipLibroIva(p.datos)
  if (!z.totales?.periodo) throw new Error("El zip no trae libro_iva.xml con el período: no parece el libro IVA que exporta ARCA.")
  const periodo = z.totales.periodo
  const anio = Number(periodo.slice(0, 4)), mes = Number(periodo.slice(4))

  // El subdiario de la app de ese mes (o el histórico si la app no lo tiene: la misma regla que Subdiarios).
  const app = await db.schema(p.schema).from("comprobantes_arca").select("*").eq("año_contable", anio).eq("mes_contable", mes)
  if (app.error) throw new Error(app.error.message)
  let filas = app.data ?? []
  if (!filas.length) {
    const h = await db.schema(p.schema).from("comprobantes_historico").select("*").eq("anio_contable", anio).eq("mes_contable", mes)
    if (h.error) throw new Error(h.error.message)
    filas = filasDelSubdiario([], h.data ?? [])
  }
  const comparacion = compararSubdiarioConLibro(filas, z.compras, TIPOS_SIN_CREDITO_COMPRAS)

  const previa = await db.from("ddjj_presentadas").select("id,coincide").eq("empresa", p.empresa).eq("impuesto", "IVA")
    .eq("periodo", periodo).eq("secuencia", z.totales.secuencia || 1).maybeSingle()
  const fila = {
    empresa: p.empresa, impuesto: "IVA", periodo, secuencia: z.totales.secuencia || 1,
    codigo_presentacion: z.totales.codigo, origen: p.origen, archivo: p.archivo,
    totales: z.totales, comprobantes: z.compras, resultado: comparacion, coincide: comparacion.ok,
    cargado_por: p.cargadoPor, updated_at: new Date().toISOString(),
  }
  let g = await db.from("ddjj_presentadas").upsert({ ...fila, ventas: z.ventas, totales_ventas: z.totalesVentas }, { onConflict: "empresa,impuesto,periodo,secuencia" })
  // Antes del script 145 no existen las columnas de ventas: se guarda lo de siempre (y el recorrido avisa que faltan).
  if (g.error && /ventas/.test(g.error.message)) g = await db.from("ddjj_presentadas").upsert(fila, { onConflict: "empresa,impuesto,periodo,secuencia" })
  if (g.error) throw new Error("No se pudo guardar la DDJJ: " + g.error.message)
  return { fila, comparacion, previa: (previa.data ?? null) as { id: string; coincide: boolean | null } | null, anio, mes, periodo, ventas: z.ventas.length }
}

/** El aviso a JMS y a Ulises cuando lo presentado no coincide con el subdiario (por la campanita). */
async function avisarQueNoCoincide(db: any, schema: string, res: ResultadoDdjj, anio: number, mes: number, secuencia: number, comparacion: ResultadoContraPresentado): Promise<ResultadoDdjj> {
  const destinatarios = await destinatariosDelAviso(db)
  const motivo = `Lo presentado a ARCA (${String(mes).padStart(2, "0")}/${anio}, secuencia ${secuencia}) NO coincide con el subdiario: `
    + `${comparacion.soloApp.length} en la app y no presentadas, ${comparacion.soloPresentado.length} presentadas y no en la app, `
    + `${comparacion.importeDistinto.length} con otro importe · diferencia total ${comparacion.totales.diferencia.total} · crédito fiscal ${comparacion.totales.diferencia.creditoFiscal}. `
    + `Ver Subdiarios → ${String(mes).padStart(2, "0")}/${anio} → «Lo que devolvió el contador».`
  for (const email of destinatarios) {
    const r = await db.from("revisiones").insert({
      schema_ref: schema, tabla_ref: "subdiario", registro_id: `presentado-${anio}-${String(mes).padStart(2, "0")}`,
      descripcion_ref: `Subdiario ${String(mes).padStart(2, "0")}/${anio} contra lo presentado a ARCA`,
      motivo, pantalla: "egresos", estado: "abierta", creado_por: "app (control de la DDJJ)", asignado_a: email,
    })
    if (!r.error) res.avisados.push(email)
  }
  return res
}

/** Los mails de quienes reciben el aviso: los usuarios con rol admin o contable (JMS y Ulises). */
async function destinatariosDelAviso(db: any): Promise<string[]> {
  try {
    const { data } = await db.auth.admin.listUsers({ perPage: 200 })
    return (data?.users ?? [])
      .filter((u: any) => ["admin", "contable"].includes(u.app_metadata?.role) && u.email)
      .map((u: any) => u.email as string)
  } catch {
    return []
  }
}
