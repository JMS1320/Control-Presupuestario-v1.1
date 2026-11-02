/**
 * 📅 **LAS FECHAS DE LOS EXCEL SON FECHAS, NO TEXTO** — regla para TODOS los exports (JMS 01/11, con dos capturas del filtro).
 *
 * Una fecha escrita como texto («01/04/2026») se ve igual, pero el filtro de Excel la lista como una palabra más, ordenada
 * alfabéticamente (01/04/2026, 01/06/2026, 01/07/2025…). Con una fecha de verdad, el filtro agrupa por **año → mes → día**,
 * que es lo que se usa para auditar un período. JMS: *«yo quisiera que pase esto… parámetro para todos los exports»*.
 *
 * Se aplica justo antes de escribir el archivo, sobre el libro entero: toda celda de TEXTO que sea exactamente `dd/mm/aaaa` o
 * `aaaa-mm-dd` (y una fecha válida) pasa a número de serie con formato `dd/mm/yyyy` — se ve como fecha argentina y el estilo de
 * la celda se conserva (la solapa «Cuotas» de templates escribía `2025-07-01`).
 * No toca fórmulas, ni textos que sólo contengan una fecha («vence el 10/07/2025»), ni `2025-07` (claves de mes).
 *
 * 🛑 **NO se usa en los archivos que se suben al BANCO** (la plantilla de emisión de echeqs y el lote de pagos de Galicia):
 * su formato lo fija el banco y una celda cambiada puede hacer que lo rechace.
 */

const FECHA_TEXTO = /^(\d{2})\/(\d{2})\/(\d{4})$/
const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
/** Día 0 de Excel (sistema 1900, con su 29/02/1900 inexistente ya descontado): 30/12/1899. */
const BASE_EXCEL = Date.UTC(1899, 11, 30)

/** `dd/mm/aaaa` o `aaaa-mm-dd` → número de serie de Excel, o `null` si no es una fecha válida (31/02 no lo es). */
export function serieDeFecha(texto: string): number | null {
  const t0 = texto.trim()
  const m = FECHA_TEXTO.exec(t0), iso = m ? null : FECHA_ISO.exec(t0)
  if (!m && !iso) return null
  const [d, mes, a] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [Number(iso![3]), Number(iso![2]), Number(iso![1])]
  const t = Date.UTC(a, mes - 1, d)
  const f = new Date(t)
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null
  return Math.round((t - BASE_EXCEL) / 86_400_000)
}

interface Celda { t?: string; v?: unknown; f?: string; z?: string | number; w?: string; s?: unknown }
interface Libro { SheetNames: string[]; Sheets: Record<string, Record<string, unknown>> }

/** Convierte, en todas las hojas del libro, las fechas escritas como texto en fechas de verdad. Devuelve cuántas cambió. */
export function fechasReales(wb: Libro): number {
  let n = 0
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre]
    if (!ws) continue
    for (const dir of Object.keys(ws)) {
      if (dir[0] === "!") continue
      const c = ws[dir] as Celda
      if (!c || c.t !== "s" || c.f || typeof c.v !== "string") continue
      const serie = serieDeFecha(c.v)
      if (serie === null) continue
      c.t = "n"; c.v = serie; c.z = "dd/mm/yyyy"; delete c.w
      // xlsx-js-style toma el formato del estilo si lo tiene: se lo pone también ahí.
      if (c.s && typeof c.s === "object") (c.s as Record<string, unknown>).numFmt = "dd/mm/yyyy"
      n++
    }
  }
  return n
}
