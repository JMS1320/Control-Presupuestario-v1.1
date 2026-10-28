/**
 * 🌾 **Las hectáreas de una orden agrícola: total escrito + un lote POR DIFERENCIA** — A-FEAT-1397.
 *
 * Nota 🌙 de JMS 2026-10-28: *«acá debe mostrar el total de has e incluso poder anotarlo y llenar por
 * diferencia un lote que no se sabe cuánto tiene. En este caso yo pongo fumigar Alberdones, que es
 * múltiples lotes contra el río: esto nunca será un lote»*.
 *
 * - Sin total escrito: el total es la suma de los lotes (como siempre).
 * - Con total escrito y UN lote sin hectáreas: ese lote lleva `total − suma de los demás`.
 * - Con total escrito y todos los lotes con hectáreas: tienen que sumar el total.
 *
 * 🛑 Si los números de la orden se contradicen (los lotes suman distinto del total, o la diferencia
 * da 0 o negativa) es **integridad**, no discrepancia: la orden no se guarda (CLAUDE.md § 🚦).
 */
import { parseNumeroAR } from "@/lib/format/numero"

const r2 = (n: number) => Math.round(n * 100) / 100
const vacio = (s: string) => String(s ?? "").trim() === ""

export interface ResultadoHa<K> {
  total: number
  /** las hectáreas que lleva cada fila (la de por diferencia, calculada) */
  haDe: Map<K, number>
  porDiferencia: K | null
  error: string | null
}

export function resolverHaOrden<K>(filas: { key: K; hectareas: string }[], totalEscrito: string): ResultadoHa<K> {
  const haDe = new Map<K, number>()
  const vacias = filas.filter(f => vacio(f.hectareas))
  let suma = 0
  for (const f of filas) if (!vacio(f.hectareas)) { const h = parseNumeroAR(f.hectareas); haDe.set(f.key, h); suma += h }
  suma = r2(suma)
  for (const f of vacias) haDe.set(f.key, 0)

  if (vacio(totalEscrito)) return { total: suma, haDe, porDiferencia: null, error: null }

  const total = r2(parseNumeroAR(totalEscrito))
  if (!(total > 0)) return { total: suma, haDe, porDiferencia: null, error: "El total de hectáreas tiene que ser mayor a 0" }

  if (vacias.length === 0) {
    const error = Math.abs(total - suma) > 0.005
      ? `Los lotes suman ${fmt(suma)} ha y el total dice ${fmt(total)} ha. Corregí uno, o dejá vacío el que va por diferencia.`
      : null
    return { total, haDe, porDiferencia: null, error }
  }
  if (vacias.length > 1) {
    return { total, haDe, porDiferencia: null, error: `Hay ${vacias.length} lotes sin hectáreas: sólo uno puede ir por diferencia.` }
  }
  const dif = r2(total - suma)
  if (!(dif > 0)) {
    return { total, haDe, porDiferencia: vacias[0].key, error: `Los demás lotes ya suman ${fmt(suma)} ha: no queda diferencia para el lote sin hectáreas (total ${fmt(total)} ha).` }
  }
  haDe.set(vacias[0].key, dif)
  return { total, haDe, porDiferencia: vacias[0].key, error: null }
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 })
