/**
 * 📎 El PDF de cada comprobante de VENTA (A-FEAT-1578). JMS 07/11: *«precisaría poder enviar todos los comprobantes de venta…
 * descargarlas. seleccionar todas o alguna»* · *«las tengo archivadas en ventas dentro de la carpeta de su mes como compras»*.
 *
 * Los PDFs viven en el Drive en `<campaña>/<aa-mm>/- Ventas` y se llaman «MM-DD - Cliente - qué.pdf» (ej. «10-28 - 2 Toros Sanchez
 * Daniel.pdf»). El nombre NO trae el número de comprobante: el cruce va por FECHA (el MM-DD del nombre contra la fecha de la venta) y
 * CLIENTE (alguna palabra del cliente en el nombre). La app PROPONE; el usuario confirma. Si hay más de un archivo posible, no elige:
 * los muestra.
 *
 * Lógica pura (sin red ni base): la usan la pantalla y los casos de `npm run probar`.
 */
import { subcarpetasDelMes } from "@/lib/facturas/vincular-archivo"

export type EmpresaVenta = "MSA" | "PAM" | "MA"
export type ArchivoDeVentas = { file_id: string; archivo: string; url: string; carpeta?: string }
export type VentaParaPdf = {
  id: string
  fecha_liquidacion: string | null
  denominacion_cliente: string | null
  año_contable?: number | null
  mes_contable?: number | null
  pdf_drive_url?: string | null
}
export type Propuesta = { ventaId: string; archivo: ArchivoDeVentas | null; candidatos: ArchivoDeVentas[]; motivo: string }

/** El nombre de la subcarpeta de ventas dentro del mes. */
export const CARPETA_VENTAS = "- Ventas"

/** Las carpetas donde puede estar el PDF de una venta: el mes del subdiario (o el de la fecha) y el siguiente. */
export function carpetasDeLaVenta(empresa: EmpresaVenta, v: VentaParaPdf): string[][] {
  const f = String(v.fecha_liquidacion ?? "")
  const anio = Number(v.año_contable) || Number(f.slice(0, 4)), mes = Number(v.mes_contable) || Number(f.slice(5, 7))
  if (!anio || !mes) return []
  const meses = [{ anio, mes }]
  // la fecha de la venta y el mes del subdiario pueden no coincidir: se mira también el mes de la fecha
  const fa = Number(f.slice(0, 4)), fm = Number(f.slice(5, 7))
  if (fa && fm && (fa !== anio || fm !== mes)) meses.push({ anio: fa, mes: fm })
  meses.push(mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 })
  return meses.map(m => [...subcarpetasDelMes(empresa, m.anio, m.mes), CARPETA_VENTAS])
}

/** El día que dice el nombre del archivo («10-28 - …» → 28/10), con el año de la carpeta. `null` si el nombre no empieza con MM-DD. */
export function fechaDelNombre(archivo: string, anioCarpeta: number, mesCarpeta: number): string | null {
  const m = String(archivo).match(/^\s*(\d{1,2})[-_.](\d{1,2})\b/)
  if (!m) return null
  const mm = Number(m[1]), dd = Number(m[2])
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  // un archivo de diciembre en la carpeta de enero es del año anterior (y al revés)
  const anio = mm === 12 && mesCarpeta === 1 ? anioCarpeta - 1 : mm === 1 && mesCarpeta === 12 ? anioCarpeta + 1 : anioCarpeta
  return `${anio}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
}

const RELLENO = new Set(["sa", "s", "a", "srl", "sas", "y", "cia", "compania", "sociedad", "anonima", "de", "del", "la", "el", "los", "las", "soc", "coop", "ltda", "limitada", "e", "hijos"])
/** Las palabras que identifican a un cliente: sin tildes, sin «S.A.», «y Cía», etc. */
export function palabrasDe(s: string | null | undefined): string[] {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ").split(" ").filter(w => w.length >= 3 && !RELLENO.has(w))
}

const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000)

/** El año y mes de la carpeta de un archivo («2025-2026/25-10/- Ventas» → 2025, 10). */
export function mesDeCarpeta(carpeta: string | undefined): { anio: number; mes: number } | null {
  const m = String(carpeta ?? "").match(/(?:^|\/)(\d{2})-(\d{2})(?:\/|$)/)
  return m ? { anio: 2000 + Number(m[1]), mes: Number(m[2]) } : null
}

/**
 * Qué archivo va con cada venta. Un archivo es candidato si (1) alguna palabra del cliente está en el nombre y (2) la fecha del nombre
 * está a 5 días o menos de la fecha de la venta (si el nombre no trae fecha, sólo vale el cliente, y queda como duda). Con UN solo
 * candidato se propone; con varios, se listan y elige el usuario. Un archivo ya vinculado a otra venta no se vuelve a proponer.
 */
export function proponerPdfs(ventas: VentaParaPdf[], archivos: ArchivoDeVentas[]): Propuesta[] {
  const usados = new Set(ventas.map(v => v.pdf_drive_url).filter(Boolean).map(u => idDeDrive(u!)))
  const libres = archivos.filter(a => !usados.has(a.file_id))
  return ventas.filter(v => !v.pdf_drive_url).map(v => {
    const pal = palabrasDe(v.denominacion_cliente)
    const cands = libres.filter(a => {
      const nombre = palabrasDe(a.archivo.replace(/\.[a-z0-9]+$/i, ""))
      if (!pal.some(p => nombre.includes(p))) return false
      const mc = mesDeCarpeta(a.carpeta)
      const fn = mc ? fechaDelNombre(a.archivo, mc.anio, mc.mes) : null
      return !fn || !v.fecha_liquidacion || dias(fn, v.fecha_liquidacion) <= 5
    })
    if (cands.length === 1) return { ventaId: v.id, archivo: cands[0], candidatos: cands, motivo: "cliente y fecha coinciden" }
    if (cands.length > 1) return { ventaId: v.id, archivo: null, candidatos: cands, motivo: `${cands.length} archivos posibles: elegí uno` }
    return { ventaId: v.id, archivo: null, candidatos: [], motivo: "no hay un archivo con ese cliente y esa fecha en la carpeta «- Ventas»" }
  })
}

/** El id de Drive de un link (o el mismo id). */
export function idDeDrive(u: string): string {
  const m = String(u).match(/[-\w]{25,}/)
  return m ? m[0] : String(u)
}

/** El nombre de cada PDF dentro del zip: «AAAA-MM-DD - Cliente - Tipo PV-Nro.pdf», sin caracteres que Windows no acepta. */
export function nombreEnZip(v: { fecha_liquidacion: string | null; denominacion_cliente: string | null; tipo_comprobante?: number | null; punto_venta?: number | null; numero_desde?: number | null }, original: string): string {
  const ext = (original.match(/\.[a-z0-9]+$/i)?.[0] ?? ".pdf").toLowerCase()
  const nro = v.numero_desde != null ? ` - ${v.tipo_comprobante ?? ""} ${String(v.punto_venta ?? 0).padStart(4, "0")}-${String(v.numero_desde).padStart(8, "0")}` : ""
  const base = `${v.fecha_liquidacion ?? "sin fecha"} - ${v.denominacion_cliente ?? "sin cliente"}${nro}`
  return base.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() + ext
}
