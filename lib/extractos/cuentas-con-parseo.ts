/**
 * 🧩 **LAS CUENTAS CON PARSEO — una sola lista** (A-FEAT-1485).
 *
 * Hasta el 01/11/2026 estaba escrita a mano en cuatro lugares (el re-parseo, la pantalla de reglas, el botón del
 * Extracto y la alerta de Principal), siempre `pam_galicia` y `ma_galicia`. Sumar Santander en tres y olvidarse del
 * cuarto es el modo de falla de siempre («se arregló un camino de los dos»): por eso vive acá y todos la importan.
 *
 * `id` = el de CUENTAS_BANCARIAS y el de `config_parseo_extracto.cuenta_bancaria_id`; `schema` + `tabla` = dónde viven
 * los movimientos (no siempre coincide con el id: Santander es `msa.santander`).
 */
import type { Empresa } from "@/lib/empresas"

export interface CuentaConParseo { id: string; nombre: string; empresa: Empresa; schema: string; tabla: string }

export const CUENTAS_CON_PARSEO: CuentaConParseo[] = [
  { id: "pam_galicia", nombre: "PAM Galicia CA", empresa: "PAM", schema: "public", tabla: "pam_galicia" },
  { id: "ma_galicia", nombre: "MA Galicia CA", empresa: "MA", schema: "ma", tabla: "ma_galicia" },
  // A-FEAT-1485: la cuenta corriente de Santander de MSA (se carga del resumen PDF; el texto crudo en líneas lo arma
  // `bloqueSantander`).
  { id: "msa_santander", nombre: "MSA Santander", empresa: "MSA", schema: "msa", tabla: "santander" },
]

export const IDS_CON_PARSEO = CUENTAS_CON_PARSEO.map(c => c.id)
export const cuentaConParseo = (id: string) => CUENTAS_CON_PARSEO.find(c => c.id === id)

/**
 * 🧩 **El texto del resumen de Santander → el bloque de líneas que entiende el parseo** (el mismo formato que la caja
 * de ahorro: una línea por dato).
 *
 * El resumen PDF trae el «Movimiento» en uno o varios renglones y el comprobante aparte; la carga los guardó como
 * `renglón · renglón · Comp. N`. Y el CUIT viene PEGADO al nombre en el mismo renglón
 * (`Martinez sobrado agro s r l 30617786016 01 3068170`). El parseo busca el CUIT como línea propia, así que acá se
 * separa: lo de antes (el nombre), el CUIT, lo de después. `Comp. N` queda como `N` en la última línea, que es donde
 * la regla «Nº de operación» lo busca.
 *
 *     Pagos ctas propias interbanking in        ← el tipo
 *     Martinez sobrado agro s r l               ← el nombre (regla «Antes del CUIT»)
 *     30617786016                               ← el CUIT (regla «Busca el CUIT»)
 *     01 3068170                                ← lo que venía después
 *     3068170                                   ← el comprobante (regla «Nº de operación»)
 */
export function bloqueSantander(descripcion: string | null | undefined): string {
  const partes = String(descripcion ?? "").split(/\s+·\s+/).map(s => s.trim()).filter(Boolean)
  const lineas: string[] = []
  for (const p of partes) {
    const comp = p.match(/^Comp\.\s*(\S+)$/i)
    if (comp) { lineas.push(comp[1]); continue }
    const m = p.match(/^(.*?)\s*\b(\d{11})\b\s*(.*)$/)
    if (m && lineas.length > 0) {
      if (m[1]) lineas.push(m[1].trim())
      lineas.push(m[2])
      if (m[3]) lineas.push(m[3].trim())
    } else lineas.push(p)
  }
  return lineas.join("\n")
}
