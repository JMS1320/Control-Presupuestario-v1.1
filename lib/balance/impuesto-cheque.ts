/**
 * 🧾 **IMPUESTO A LOS DÉBITOS Y CRÉDITOS BANCARIOS (Ley 25.413) — total y desglosado.**
 * A-FEAT-1190 · 2026-10-03.
 *
 * Pedido del usuario: *«debe ser un cuadro importante, total y desglosado»*. Sale del extracto: cada
 * débito del impuesto es un movimiento propio (`Imp. Cre. Ley 25413`, `Imp. Deb. Ley 25413 Gral.`,
 * `Impuesto Deb.ley 25413 Extrac. Efect.`), y la conciliación ya los manda a su template
 * «Debitos / Creditos».
 *
 * ## Por qué importa en el balance
 * Una parte del impuesto pagado es **pago a cuenta de Ganancias**: es un **crédito impositivo** al
 * cierre. Por defecto (Decreto 409/2018): **33 %** de lo pagado a la alícuota general (créditos y
 * débitos) y **20 %** de lo pagado a la alícuota doble (extracción en efectivo). Los porcentajes son
 * **editables**: una PyME puede computar más, y eso lo sabe el usuario, no el sistema.
 *
 * ⚠️ **MSA computa el 100 %** (usuario, 2026-10-03: *«nosotros nos tomamos el 100 % del impuesto al
 * cheque por nuestra categoría de empresa»*). Va en `PCT_COMPUTABLE_POR_EMPRESA`.
 *
 * Lógica pura, probada en `lib/pruebas/casos.ts`.
 */

export interface MovimientoParaCheque {
  fecha: string | null
  descripcion?: string | null
  categ?: string | null
  debitos?: number | string | null
  creditos?: number | string | null
}

export type ConceptoCheque = "creditos" | "debitos" | "efectivo"

export const ETIQUETA_CONCEPTO: Record<ConceptoCheque, string> = {
  creditos: "Sobre créditos (acreditaciones)",
  debitos: "Sobre débitos (general)",
  efectivo: "Extracción en efectivo (alícuota doble)",
}

/** Lo computable por empresa: general (créditos y débitos) y efectivo. Default: Decreto 409/2018. */
export const PCT_COMPUTABLE_POR_EMPRESA: Record<string, { general: number; efectivo: number }> = {
  MSA: { general: 1, efectivo: 1 },
}
export const pctComputable = (empresa: string) => PCT_COMPUTABLE_POR_EMPRESA[empresa] ?? { general: 0.33, efectivo: 0.2 }

export interface MesCheque { mes: string; creditos: number; debitos: number; efectivo: number; total: number; movimientos: number }

export interface ImpuestoCheque {
  porMes: MesCheque[]
  total: MesCheque
  /** Lo computable como pago a cuenta de Ganancias, con los porcentajes usados. */
  computable: number
  pctGeneral: number
  pctEfectivo: number
  /** Meses del ejercicio en los que la cuenta NO tiene ningún movimiento: el extracto no está. */
  mesesSinExtracto: string[]
}

const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n: number) => Math.round(n * 100) / 100

/** ¿Es un movimiento del impuesto al cheque? Por la descripción del banco o por su categoría. */
export function esImpuestoCheque(m: MovimientoParaCheque): boolean {
  const d = String(m.descripcion ?? "")
  return /25\.?413/.test(d) || /^d[eé]bitos\s*\/\s*cr[eé]ditos$/i.test(String(m.categ ?? "").trim())
}

export function conceptoCheque(m: MovimientoParaCheque): ConceptoCheque {
  const d = String(m.descripcion ?? "").toLowerCase()
  if (/extrac|efect/.test(d)) return "efectivo"
  if (/\bcre\b|cr[eé]d/.test(d)) return "creditos"
  return "debitos"
}

/**
 * Arma el cuadro: por mes y por concepto. Un crédito del banco sobre estos conceptos (reintegro)
 * resta. `todos` son TODOS los movimientos de la cuenta en el ejercicio, para saber qué meses no
 * tienen extracto (un mes sin impuesto no es lo mismo que un mes sin datos).
 */
export function armarImpuestoCheque(
  todos: MovimientoParaCheque[], meses: string[], pctGeneral = 0.33, pctEfectivo = 0.2,
): ImpuestoCheque {
  const vacio = (mes: string): MesCheque => ({ mes, creditos: 0, debitos: 0, efectivo: 0, total: 0, movimientos: 0 })
  const porMes = new Map(meses.map(m => [m, vacio(m)]))
  const conDatos = new Set<string>()
  for (const m of todos) {
    const mes = String(m.fecha ?? "").slice(0, 7)
    const fila = porMes.get(mes)
    if (!fila) continue
    conDatos.add(mes)
    if (!esImpuestoCheque(m)) continue
    const imp = num(m.debitos) - num(m.creditos)
    const c = conceptoCheque(m)
    fila[c] = r2(fila[c] + imp)
    fila.total = r2(fila.total + imp)
    fila.movimientos += 1
  }
  const lista = meses.map(m => porMes.get(m)!)
  const total = lista.reduce((a, f) => ({
    mes: "TOTAL", creditos: r2(a.creditos + f.creditos), debitos: r2(a.debitos + f.debitos),
    efectivo: r2(a.efectivo + f.efectivo), total: r2(a.total + f.total), movimientos: a.movimientos + f.movimientos,
  }), vacio("TOTAL"))
  return {
    porMes: lista, total,
    computable: r2((total.creditos + total.debitos) * pctGeneral + total.efectivo * pctEfectivo),
    pctGeneral, pctEfectivo,
    mesesSinExtracto: meses.filter(m => !conDatos.has(m)),
  }
}
