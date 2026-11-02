/**
 * 🧮 **RESUMEN POR CATEGORÍA Y POR MES, CON Nro QUE LLEVA AL DETALLE** — A-FEAT-1513, regla general de JMS (01/11, libro C):
 * *«el cuadro de resumen debe ser por mes. Por categ y por mes siempre. Y que cada línea del resumen tenga un Nro que referencia
 * a la tabla de abajo, para filtrar por número y ver cómo se componen. Esto como línea general.»*
 *
 * Arriba: una fila por categoría (con su Nro) y una columna por mes del ejercicio, más el total — cada celda es FÓRMULA sobre el
 * detalle (SUMAR.SI.CONJUNTO por Nro, mes y, si hay, moneda). Abajo: el detalle, con su Nro y su mes en las dos primeras columnas.
 * Filtrar el detalle por un Nro muestra exactamente lo que suma esa línea.
 *
 * Pura. Un solo armado para todas las hojas que lo usan (impuestos y gastos bancarios, intereses, inversiones, grupos de
 * templates, LIB), para que la regla no tenga cuatro versiones.
 */
import { filtrarEn } from "./formato-excel"

export interface ItemDetalle {
  /** La categoría: define la línea del resumen. */
  categoria: string
  /** `AAAA-MM`. Fuera del ejercicio no suma en ningún mes (se ve en el detalle igual). */
  mes: string
  /** Lo que suma (con signo: neto). */
  importe: number
  /** Para separar pesos y dólares; sin moneda = una sola tabla. */
  moneda?: "ARS" | "USD"
  /** El resto de las columnas del detalle, tal cual se muestran. */
  columnas: unknown[]
}

export interface OpcionesResumen {
  titulo: string
  notas?: string[]
  /** Los meses del ejercicio en orden (`AAAA-MM`) y cómo se rotulan (`jul-25`). */
  meses: { clave: string; rotulo: string }[]
  /** Encabezados de `columnas` del detalle (sin Nro, Mes ni Importe, que se agregan). */
  encabezadoDetalle: string[]
  /** Cómo se llama la columna del importe en el detalle. */
  rotuloImporte?: string
  /** Si es `true`, arma un bloque en pesos y otro en dólares (por `moneda`). */
  porMoneda?: boolean
  /**
   * 📗 A-FEAT-1515: el detalle con **Débito y Crédito en columnas separadas** (regla de los Excel de control, KNOWLEDGE
   * § «Los Excel de trabajo con el usuario»: nunca netos). El resumen sigue siendo el neto: SUMAR.SI(débito) − SUMAR.SI(crédito).
   */
  debeHaber?: boolean
  /**
   * 🏢 A-FEAT-1521: un bloque propio ENTRE el resumen y el detalle (el reparto de Libertad), de alto fijo. `armar` recibe dónde
   * quedaron el total del resumen y las columnas del detalle, para escribir fórmulas sobre ellos.
   */
  bloqueExtra?: { alto: number; armar: (u: UbicacionBloque) => unknown[][] }
}

/** Lo que necesita un bloque extra para apuntarle al resumen y al detalle con fórmulas. Filas en base 1. */
export interface UbicacionBloque {
  /** La primera fila del bloque. */
  fila: number
  /** La fila del TOTAL del resumen (una sola tabla). */
  filaTotal: number
  /** La letra de la columna del mes `j` (0 = el primero) y la del TOTAL, en el resumen y en el bloque. */
  colMes: (j: number) => string
  colTotal: string
  /** El rango absoluto de una columna del detalle (`$J$20:$J$80`). */
  rng: (col: string) => string
  colDebito: string
  colCredito: string | null
  /** La letra de una columna propia del detalle (`encabezadoDetalle[i]`). */
  colDetalle: (i: number) => string
}

/** Dónde quedó cada cosa en la hoja, para que otro bloque (un control) pueda apuntarle con fórmulas. Filas en base 1. */
export interface UbicacionResumen {
  /** La celda del TOTAL general del resumen (sólo cuando hay una sola tabla, sin `porMoneda`). */
  celdaTotal: string | null
  /** Primera y última fila del detalle. */
  det1: number
  detN: number
  /** Columnas del detalle: la del importe neto, o la de débito y la de crédito si `debeHaber`. */
  colImporte: string | null
  colDebito: string | null
  colCredito: string | null
  /** La letra de una columna propia del detalle (`encabezadoDetalle[i]`). */
  colDetalle: (i: number) => string
}

const MONEDA = '#,##0.00;(#,##0.00);"-"'
const r2 = (n: number) => Math.round(n * 100) / 100
const col = (i: number) => { let s = "", n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }

/** Arma la hoja: resumen (categoría × mes, con Nro) y debajo el detalle con su Nro. */
export function hojaResumenPorMes(items: ItemDetalle[], o: OpcionesResumen): unknown[][] {
  return armarResumenPorMes(items, o).filas
}

/** Lo mismo que `hojaResumenPorMes`, y además dice dónde quedó cada cosa (para los controles al pie). */
export function armarResumenPorMes(items: ItemDetalle[], o: OpcionesResumen): { filas: unknown[][]; ubicacion: UbicacionResumen } {
  const cats = [...new Set(items.map(i => i.categoria || "(sin categoría)"))].sort((a, b) => a.localeCompare(b))
  const nro = new Map(cats.map((c, i) => [c, i + 1]))
  const monedas: ("ARS" | "USD" | undefined)[] = o.porMoneda
    ? (["ARS", "USD"] as const).filter(m => items.some(i => i.moneda === m))
    : [undefined]
  if (!monedas.length) monedas.push(undefined)

  // Filas del resumen: por moneda, encabezado + una por categoría con movimientos en esa moneda + total + blanco.
  const filasPorMoneda = monedas.map(m => cats.filter(c => items.some(i => (i.categoria || "(sin categoría)") === c && (m === undefined || i.moneda === m))))
  const altoResumen = monedas.reduce((t, _m, k) => t + 1 + 1 + filasPorMoneda[k].length + 1 + 1, 0)
  const cabecera = 1 + (o.notas?.length ?? 0) + 1
  // +2: el renglón amarillo «Nro a ver» y un blanco (A-FEAT-1515, JMS 02/11), antes del título del detalle.
  const altoExtra = o.bloqueExtra?.alto ?? 0
  const filaEncDetalle = cabecera + altoResumen + altoExtra + 2 + 1 + 1
  const det1 = filaEncDetalle + 1, detN = filaEncDetalle + items.length + 1
  // Columnas del detalle: A Nro · B Mes · C… las propias · después Moneda (si hay) · Importe
  const nCols = o.encabezadoDetalle.length
  const colMoneda = o.porMoneda ? col(2 + nCols) : null
  const colImporte = col(2 + nCols + (o.porMoneda ? 1 : 0))
  // Con débito y crédito: débito en la columna del importe, crédito en la siguiente.
  const colCredito = o.debeHaber ? col(2 + nCols + (o.porMoneda ? 1 : 0) + 1) : null
  const rng = (c: string) => `$${c}$${det1}:$${c}$${detN}`
  /** El neto de un criterio: SUMAR.SI del importe, o del débito menos el del crédito. */
  const suma = (crit: string) => colCredito
    ? `SUMIFS(${rng(colImporte)},${crit})-SUMIFS(${rng(colCredito)},${crit})`
    : `SUMIFS(${rng(colImporte)},${crit})`
  let celdaTotal: string | null = null

  const h: unknown[][] = [[o.titulo], ...(o.notas ?? []).map(n => [n]), []]
  monedas.forEach((m, k) => {
    h.push([m === "USD" ? "EN DÓLARES (US$) — no se suman a los pesos" : m === "ARS" ? "EN PESOS" : "RESUMEN POR CATEGORÍA Y POR MES"])
    h.push(["Nro", "Categoría", ...o.meses.map(x => x.rotulo), "TOTAL"])
    const r1 = h.length + 1
    for (const c of filasPorMoneda[k]) {
      const n = h.length + 1, num = nro.get(c)!
      const fila: unknown[] = [num, c]
      o.meses.forEach((mes, j) => {
        const v = r2(items.filter(i => (i.categoria || "(sin categoría)") === c && i.mes === mes.clave && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
        const crit = `${rng("A")},$A${n},${rng("B")},"${mes.clave}"${m && colMoneda ? `,${rng(colMoneda)},"${m}"` : ""}`
        fila.push({ t: "n", f: suma(crit), v, z: MONEDA })
        void j
      })
      const tot = r2(items.filter(i => (i.categoria || "(sin categoría)") === c && o.meses.some(x => x.clave === i.mes) && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
      fila.push({ t: "n", f: `SUM(${col(2)}${n}:${col(1 + o.meses.length)}${n})`, v: tot, z: MONEDA })
      h.push(fila)
    }
    const rN = h.length
    const totales: unknown[] = ["", "TOTAL"]
    for (let j = 0; j <= o.meses.length; j++) {
      const c = col(2 + j)
      const v = j < o.meses.length
        ? r2(items.filter(i => i.mes === o.meses[j].clave && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
        : r2(items.filter(i => o.meses.some(x => x.clave === i.mes) && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
      totales.push({ t: "n", f: rN >= r1 ? `SUM(${c}${r1}:${c}${rN})` : "0", v, z: MONEDA })
    }
    h.push(totales)
    if (monedas.length === 1 && m === undefined) celdaTotal = `${col(2 + o.meses.length)}${h.length}`
    h.push([])
  })
  if (o.bloqueExtra) {
    const filaTotal = h.length - 1 // el TOTAL del resumen (antes del blanco)
    const b = o.bloqueExtra.armar({
      fila: h.length + 1, filaTotal, colMes: (j: number) => col(2 + j), colTotal: col(2 + o.meses.length),
      rng, colDebito: colImporte, colCredito, colDetalle: (i: number) => col(2 + i),
    })
    for (let k = 0; k < o.bloqueExtra.alto; k++) h.push(b[k] ?? [])
  }
  /**
   * 🟨 A-FEAT-1515 (JMS 02/11, opción 1): «idealmente en el amarillo ponés el Nro que querés filtrar». Excel no filtra sin macro,
   * así que la celda amarilla dice qué categoría es, cuántos renglones tiene y cuánto suma ese Nro (fórmulas sobre el detalle);
   * los renglones se ven con el filtro de la columna Nro, que ya viene puesto.
   */
  {
    const r = h.length + 1
    const amarillo = { patternType: "solid", fgColor: { rgb: "FFFFFF00" } }
    const nro0 = cats.length ? 1 : ""
    const crit = `${rng("A")},$B$${r}`
    const sumaNro = colCredito ? `SUMIFS(${rng(colImporte)},${crit})-SUMIFS(${rng(colCredito)},${crit})` : `SUMIFS(${rng(colImporte)},${crit})`
    const de1 = items.filter(i => nro.get(i.categoria || "(sin categoría)") === 1)
    h.push([
      { t: "s", v: "Nro a ver ▶", s: { font: { bold: true }, fill: amarillo } },
      { t: "n", v: nro0, s: { font: { bold: true, sz: 12 }, fill: amarillo, alignment: { horizontal: "center" } } },
      { t: "s", f: `IFERROR(INDEX($B$1:$B$${filaEncDetalle - 3},MATCH($B$${r},$A$1:$A$${filaEncDetalle - 3},0)),"(no hay ese Nro)")`, v: cats[0] ?? "", s: { fill: amarillo } },
      { t: "n", f: `COUNTIF(${rng("A")},$B$${r})`, v: de1.length, s: { fill: amarillo } },
      { t: "s", v: "renglones · suma", s: { fill: amarillo } },
      { t: "n", f: sumaNro, v: r2(de1.reduce((t, i) => t + i.importe, 0)), z: MONEDA, s: { font: { bold: true }, fill: amarillo } },
      { t: "s", v: "← para ver los renglones, filtrá la columna Nro (con un clic)", s: { font: { italic: true } } },
    ])
    h.push([])
  }
  h.push(["DETALLE — filtrá por «Nro» para ver qué forma cada línea del resumen"])
  h.push(["Nro", "Mes", ...o.encabezadoDetalle, ...(o.porMoneda ? ["Moneda"] : []),
    ...(o.debeHaber ? ["Débito", "Crédito"] : [o.rotuloImporte ?? "Importe"])])
  const orden = [...items].sort((a, b) => (nro.get(a.categoria || "(sin categoría)")! - nro.get(b.categoria || "(sin categoría)")!) || a.mes.localeCompare(b.mes))
  for (const i of orden) {
    const imp = r2(i.importe)
    h.push([nro.get(i.categoria || "(sin categoría)"), i.mes, ...i.columnas, ...(o.porMoneda ? [i.moneda ?? ""] : []),
      ...(o.debeHaber ? [imp > 0 ? imp : "", imp < 0 ? -imp : ""] : [imp])])
  }
  if (!items.length) h.push(["", "", "(no hay movimientos en el ejercicio)"])
  else {
    /**
     * 🧮 A-FEAT-1515 (JMS 01/11: *«subtotales acá siempre, para trabajo»*): pegado al detalle, lo que suma LO FILTRADO
     * (SUBTOTALES ignora las filas ocultas por el filtro). Queda dentro del rango del resumen pero no suma ahí: no tiene Nro.
     * Y el filtro va sobre el detalle (encabezado → último renglón), no sobre el resumen de arriba.
     */
    const ultima = filaEncDetalle + items.length
    const sub = (c: string, v: number) => ({ t: "n", f: `SUBTOTAL(9,${c}${det1}:${c}${ultima})`, v: r2(v), z: MONEDA })
    const fila: unknown[] = Array.from({ length: 2 + nCols + (o.porMoneda ? 1 : 0) }, () => "")
    fila[1 + nCols] = o.porMoneda ? "Subtotal de lo filtrado (filtrá una moneda: no mezcla)" : "Subtotal de lo filtrado"
    const deb = items.reduce((t, i) => t + Math.max(r2(i.importe), 0), 0), cre = items.reduce((t, i) => t + Math.max(-r2(i.importe), 0), 0)
    if (colCredito) fila.push(sub(colImporte, deb), sub(colCredito, cre), { t: "n", f: `${colImporte}${ultima + 1}-${colCredito}${ultima + 1}`, v: r2(deb - cre), z: MONEDA }, "← neto")
    else fila.push(sub(colImporte, deb - cre))
    h.push(fila)
    filtrarEn(h, `A${filaEncDetalle}:${colCredito ?? colImporte}${ultima}`)
  }
  return {
    filas: h,
    ubicacion: {
      celdaTotal, det1, detN: Math.max(det1, detN - 1),
      colImporte: o.debeHaber ? null : colImporte,
      colDebito: o.debeHaber ? colImporte : null,
      colCredito,
      colDetalle: (i: number) => col(2 + i),
    },
  }
}
