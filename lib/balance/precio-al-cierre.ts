/**
 * 📅 EL PRECIO AL CIERRE = el del día de cierre, o el ÚLTIMO PUBLICADO antes — A-FEAT-1422 nota 16 (JMS 29/10).
 *
 * *«Hay que modificar la valuación de la hacienda también, que sea al 30/6 y no como promedio del mes. Sería al 30/6
 * o último precio publicado»*; y para los granos, *«la pizarra Rosario de cada grano»*. Hasta acá la hacienda se
 * valuaba con el **promedio del mes de cierre** y los granos con un precio a mano.
 *
 * Y nota 14: *«poner los links a las cotizaciones para revisión del contador»* → cada fuente lleva su URL.
 */
import { urlPizarra } from "@/lib/cotizaciones/parsers"

/** Un día antes, en calendario (`AAAA-MM-DD`). */
const diaAntes = (f: string) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }

/**
 * Busca hacia atrás desde la fecha de cierre el primer día que la fuente publicó algo con precio.
 * `maxDias` acota la búsqueda (un mercado puede no operar una semana entera): si no encuentra, devuelve vacío y la
 * categoría queda como hueco — nunca un precio de hace meses metido en silencio.
 */
export async function ultimoPublicado<T>(
  fechaCierre: string,
  pedirDia: (dia: string) => Promise<T[]>,
  tieneDatos: (filas: T[]) => boolean,
  maxDias = 21,
): Promise<{ filas: T[]; fecha: string | null }> {
  for (const dia of diasHaciaAtras(fechaCierre, maxDias)) {
    const filas = await pedirDia(dia)
    if (tieneDatos(filas)) return { filas, fecha: dia }
  }
  return { filas: [], fecha: null }
}

/** Los días que se prueban, del cierre hacia atrás (el cierre incluido). Pura. */
export function diasHaciaAtras(fechaCierre: string, maxDias: number): string[] {
  const out: string[] = []
  let dia = fechaCierre
  for (let i = 0; i < maxDias; i++) { out.push(dia); dia = diaAntes(dia) }
  return out
}

/** Una fuente de precio con la fecha que se usó y el link para que el contador la revise. */
export interface FuentePrecio { nombre: string; fecha: string | null; url: string }

/** Las páginas públicas de cada fuente (las que puede abrir el contador). */
export const URL_FUENTES = {
  canuelas: "https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/haciinfo000502",
  terneras: "https://www.entresurcosycorralesya.com/terneras.html",
  terneros: "https://www.entresurcosycorralesya.com/terneros.html",
  vientres: "https://www.entresurcosycorralesya.com/vientres.html",
  toros: "https://www.entresurcosycorralesya.com/toros.html",
} as const

/** El link directo a la pizarra de Rosario de un grano en un día. */
export const urlPizarraDelDia = (grano: "soja" | "maiz" | "trigo" | "girasol" | "sorgo", dia: string) => urlPizarra(grano, dia, dia)

const ddmm = (f: string | null) => f ? f.split("-").reverse().join("/") : "sin dato"

/** El texto que va en el papel: «último publicado al 30/06/2026 — Cañuelas 30/06/2026 · …». */
export function leyendaPrecios(fechaCierre: string, fuentes: FuentePrecio[]): string {
  return `último publicado al ${ddmm(fechaCierre)} — ` + fuentes.map(f => `${f.nombre} ${ddmm(f.fecha)}`).join(" · ")
}

/** La pizarra de Rosario de un grano a la fecha de cierre (o la última anterior), de la serie guardada. */
export async function pizarraAlCierre(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, grano: "soja" | "maiz", fechaCierre: string,
): Promise<{ valor: number; fecha: string; url: string } | null> {
  const { data } = await supabase.from("cotizaciones").select("valor, fecha")
    .eq("serie", `${grano}_pizarra_rosario`).lte("fecha", fechaCierre).order("fecha", { ascending: false }).limit(1).maybeSingle()
  if (!data?.valor) return null
  const fecha = String(data.fecha).slice(0, 10)
  return { valor: Number(data.valor), fecha, url: urlPizarraDelDia(grano, fecha) }
}
