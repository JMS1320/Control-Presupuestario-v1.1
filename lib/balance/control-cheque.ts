/**
 * 🧮 **EL IMPUESTO AL CHEQUE POR TRES CAMINOS — el control de A-FEAT-1388.**
 *
 * Usuario 27/10, en las solapas 08 y 08.1: *«¿toma de todos lados? ¿control?»*. El mismo impuesto llega
 * al Excel por tres vías independientes, y en 25/26 daban tres números distintos:
 *
 * | Camino | De dónde sale | 25/26 (antes) |
 * |---|---|---|
 * | **08.1** | el extracto: cada movimiento «Ley 25413», neto de devoluciones | $5.554.453,81 |
 * | **08** | el extracto agrupado por la cuenta del plan | $5.569.326,15 (sólo débitos) |
 * | **Templates** | las cuotas del template «Débitos / Créditos» | $5.584.198,49 (las devoluciones sumaban) |
 *
 * 🔑 La diferencia entre cada par era la misma: **$14.872,34**, las 3 devoluciones del banco (31/07,
 * 01/09 y 10/11). Con el papel 08 neto y las cuotas del lado que corresponde, los tres tienen que dar
 * lo mismo — y si no dan, la tabla lo muestra (§ 🧮 *el mismo número por dos caminos*: es un control
 * gratis, porque las fuentes son independientes).
 *
 * Pura: recibe lo ya armado, no lee la base.
 */
import { normalizarCuenta, type GastosBancarios } from "./papeles-bancarios"
import type { TemplatesDelEjercicio } from "./templates-libro"
import { esCategImpuestoCheque } from "./impuesto-cheque"

export interface CaminoCheque {
  camino: string
  /** `null` = ese camino no está en este Excel (no se armó): se dice, no se pone cero. */
  importe: number | null
  /** Contra el 08.1, que es el del extracto. `null` si no hay importe. */
  diferencia: number | null
}

export interface ControlCheque {
  caminos: CaminoCheque[]
  /** Todos los caminos que hay dan lo mismo (tolerancia de un centavo). */
  cuadra: boolean
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** El neto del impuesto en el papel 08: la fila de la cuenta «Débitos / Créditos Ley 25413». */
export function chequeEnPapel08(g: GastosBancarios | null | undefined): number | null {
  if (!g) return null
  const filas = g.filas.filter(f => normalizarCuenta(f.concepto).startsWith("debitos creditos"))
  if (filas.length === 0) return null
  return r2(filas.reduce((s, f) => s + f.totalDebitos - f.totalCreditos, 0))
}

/**
 * El neto del impuesto en los templates **del responsable del balance** — el extracto es el de su
 * cuenta, así que las cuotas de otra empresa no son comparables.
 */
export function chequeEnTemplates(t: TemplatesDelEjercicio | null | undefined, responsable: string): number | null {
  if (!t) return null
  const filas = t.porMes.filter(f => f.responsable === responsable && esCategImpuestoCheque(f.categ))
  if (filas.length === 0) return null
  return r2(filas.reduce((s, f) => s + f.totalNeto, 0))
}

export function controlarCheque(extracto: number, papel08: number | null, templates: number | null, responsable: string): ControlCheque {
  const dif = (x: number | null) => (x == null ? null : r2(x - extracto))
  const caminos: CaminoCheque[] = [
    { camino: "08.1 · el extracto, neto de devoluciones", importe: r2(extracto), diferencia: 0 },
    { camino: "08 · por cuenta del plan, neto", importe: papel08, diferencia: dif(papel08) },
    { camino: `Templates · cuotas de ${responsable} en «Débitos / Créditos»`, importe: templates, diferencia: dif(templates) },
  ]
  return {
    caminos,
    cuadra: caminos.every(c => c.diferencia == null || Math.abs(c.diferencia) < 0.01),
  }
}
