/**
 * 🔁 **LAS CONTRAPARTES QUE OPERAN EN CUENTA CORRIENTE** (A-FEAT-140, JMS 03/11).
 *
 * > *«Si imputamos contra cuenta corriente, ¿no deberían dejar de figurar pendientes las compras y las ventas y empezar a
 * > ver saldo en cta cte? ¿Y las cosas se concilien contra cuenta corriente?»* → *«dale, desarrollá A-FEAT-140 empezando
 * > por AFA»*.
 *
 * Con la marca `proveedores.opera_cuenta_corriente` (scripts/197), las facturas de compra y las ventas de esa contraparte
 * **no se listan una por una como pendientes** de pago o de cobro: se cancelan por la cuenta corriente (AFA paga la soja
 * descontando sus facturas). Lo que se ve es **el saldo** de la cuenta, y el banco se concilia contra «CTA <contraparte>».
 *
 * 🔑 Es la decisión del 30/09 (A-FEAT-1207): AFA es **«cancelado por cuenta corriente»** — no es un atraso sino un canal
 * de pago — y para ella sacar del Cash Flow tiene certeza. Por eso la marca es **explícita y por contraparte**, nunca un
 * efecto de otra cosa.
 *
 * ⚠️ Una sola fuente: todas las pantallas leen la marca por acá. Si la columna todavía no existe (antes de correr el
 * script 197), devuelve vacío y la app sigue como antes — nunca rompe una pantalla.
 */

type Cliente = { from: (t: string) => any }

/** El CUIT sólo con los dígitos, para comparar «30-52571862-6» con «30525718626». */
export const soloDigitos = (c: unknown) => String(c ?? "").replace(/\D/g, "")

/** Los CUIT (sólo dígitos) de las contrapartes con la marca. Vacío si no hay ninguna o si la columna aún no existe. */
export async function cuitsEnCuentaCorriente(sb: Cliente): Promise<Set<string>> {
  try {
    const { data, error } = await sb.from("proveedores").select("cuit").eq("opera_cuenta_corriente", true)
    if (error || !data) return new Set()
    return new Set((data as { cuit: string | null }[]).map(p => soloDigitos(p.cuit)).filter(Boolean))
  } catch {
    return new Set()
  }
}

/** ¿Esta contraparte opera en cuenta corriente? */
export const operaEnCuentaCorriente = (cuit: unknown, enCC: Set<string>) => enCC.size > 0 && enCC.has(soloDigitos(cuit))

/**
 * Separa una lista en lo que sigue figurando como pendiente y lo que se cancela por cuenta corriente.
 * No descarta nada en silencio: lo que sale vuelve aparte, para que la pantalla diga cuánto y de quién (§ 🧮).
 */
export function separarPorCuentaCorriente<T>(items: T[], cuitDe: (x: T) => unknown, enCC: Set<string>): { pendientes: T[]; enCuentaCorriente: T[] } {
  if (!enCC.size) return { pendientes: items, enCuentaCorriente: [] }
  const pendientes: T[] = [], enCuentaCorriente: T[] = []
  for (const x of items) (operaEnCuentaCorriente(cuitDe(x), enCC) ? enCuentaCorriente : pendientes).push(x)
  return { pendientes, enCuentaCorriente }
}

/** La clave de la etiqueta «CTA <clave>»: la primera palabra del nombre conocido o de la razón social (AFA, ACREN…). */
export const claveDeContraparte = (nombreFantasia: string | null | undefined, razonSocial: string | null | undefined) => {
  const base = String(nombreFantasia || "").trim() || String(razonSocial || "").trim()
  return base.split(/\s+/)[0]?.toUpperCase() || "CONTRAPARTE"
}

/** Las contrapartes con la marca, por CUIT (sólo dígitos): su nombre y la etiqueta «CTA <clave>» que lleva el banco. */
export async function contrapartesEnCuentaCorriente(sb: Cliente): Promise<Map<string, { nombre: string; etiqueta: string }>> {
  const m = new Map<string, { nombre: string; etiqueta: string }>()
  try {
    const { data, error } = await sb.from("proveedores").select("cuit, razon_social, nombre_fantasia").eq("opera_cuenta_corriente", true)
    if (error || !data) return m
    for (const p of data as { cuit: string; razon_social: string | null; nombre_fantasia: string | null }[])
      m.set(soloDigitos(p.cuit), { nombre: p.razon_social ?? p.cuit, etiqueta: `CTA ${claveDeContraparte(p.nombre_fantasia, p.razon_social)}` })
  } catch { /* sin la columna: ninguna */ }
  return m
}
