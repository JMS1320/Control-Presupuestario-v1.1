/**
 * 🧾 El selector de la provisión puesta a mano (A-FEAT-1564, JMS 05/11: «poder recorrer subdiarios para elegir FC, o todas
 * ordenadas por fecha y listo; buscadores, etc.»). Pura, para probarla sin pantalla.
 *
 * El buscador es el MISMO de Mails (A-FEAT-1548): sin acentos, todas las palabras, "frase exacta", -excluir, y un número se
 * encuentra con o sin puntos (61126 ↔ 61.126,50) — así el importe se busca como se lee.
 */
import { leerBusqueda, coincideBusquedaMail, normalizarBusqueda } from "@/lib/mails/registro"

export interface ComprobanteElegible {
  id: string
  /** `AAAA-MM-DD`. */
  fecha: string
  /** Proveedor (compras) o cliente (ventas). */
  nombre: string
  /** «pto-número» o el número de comprobante de la venta. */
  numero: string
  /** En pesos. */
  total: number
  /** `AAAA-MM` del subdiario, o `null` si todavía no está en ninguno. */
  subdiario: string | null
  cuenta: string | null
}

const dmy = (iso: string) => iso.split("-").reverse().join("/")

/**
 * Ordena por fecha y filtra por subdiario (`"sin"` = los que no están en ninguno) y por la búsqueda (nombre, número,
 * fecha, importe y cuenta).
 */
export function filtrarComprobantes(lista: ComprobanteElegible[], busqueda: string, subdiario: string | null): ComprobanteElegible[] {
  const b = leerBusqueda(busqueda)
  return [...lista]
    .filter(c => !subdiario || (subdiario === "sin" ? c.subdiario == null : c.subdiario === subdiario))
    .filter(c => (!b.incluye.length && !b.excluye.length) || coincideBusquedaMail(normalizarBusqueda([
      c.nombre, c.numero, dmy(c.fecha), c.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), c.cuenta ?? "",
    ].join(" \n ")), b))
    .sort((a, b2) => a.fecha.localeCompare(b2.fecha) || a.nombre.localeCompare(b2.nombre))
}
