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
import { filtrarEn, congelarEn, agruparResumen } from "./formato-excel"

export interface ItemDetalle {
  /** La categoría: define la línea del resumen. */
  categoria: string
  /** 📗 A-FEAT-1539: clave de orden del detalle (banco → fecha). Si los ítems la traen, el detalle va en ese orden. */
  orden?: string
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
  /**
   * 📅 JMS 03/11 (en el Excel de la cuenta MSA–MA): *«cuando hay tabla por mes, siempre los 2 semestres… va para Libertad y para todo
   * lo que sea retiros»*. Tres columnas A LA IZQUIERDA del resumen — **1er sem** (los primeros 6 meses), **2do sem** (los otros 6) y
   * **total** — con fórmulas; el Nro y la categoría se corren a D y E. El detalle de abajo no se mueve. También al bloque extra.
   */
  semestres?: boolean
  /**
   * 📍 JMS 06/11 (Excel de marcas contable/interno): *«preciso los montos débito y crédito entre empresa de la cuenta y descripción del
   * banco»*. Índice dentro de `encabezadoDetalle` ANTES del cual van Moneda e Importe (o Débito y Crédito). Sin esto, al final, como siempre.
   */
  importeEn?: number
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
  const altoExtra = o.bloqueExtra?.alto ?? 0
  const filaEncDetalle = cabecera + altoResumen + altoExtra + 1 + 1
  const det1 = filaEncDetalle + 1, detN = filaEncDetalle + items.length + 1
  // Columnas del detalle: A Nro · B Mes · C… las propias · después Moneda (si hay) · Importe
  const nCols = o.encabezadoDetalle.length
  // 📍 dónde van Moneda e Importe dentro del detalle (por default, al final); `kImp` = cuántas columnas ocupan
  const pos = Math.max(0, Math.min(o.importeEn ?? nCols, nCols))
  const kImp = (o.porMoneda ? 1 : 0) + (o.debeHaber ? 2 : 1)
  const colDet = (i: number) => col(2 + i + (i >= pos ? kImp : 0))
  const colMoneda = o.porMoneda ? col(2 + pos) : null
  const colImporte = col(2 + pos + (o.porMoneda ? 1 : 0))
  // Con débito y crédito: débito en la columna del importe, crédito en la siguiente.
  const colCredito = o.debeHaber ? col(2 + pos + (o.porMoneda ? 1 : 0) + 1) : null
  const rng = (c: string) => `$${c}$${det1}:$${c}$${detN}`
  /** El neto de un criterio: SUMAR.SI del importe, o del débito menos el del crédito. */
  const suma = (crit: string) => colCredito
    ? `SUMIFS(${rng(colImporte)},${crit})-SUMIFS(${rng(colCredito)},${crit})`
    : `SUMIFS(${rng(colImporte)},${crit})`
  let celdaTotal: string | null = null
  // 📅 Con semestres, el resumen se corre S columnas a la derecha (A, B, C = 1er sem, 2do sem, total)
  const S = o.semestres ? 3 : 0
  const nM = o.meses.length, mitad = Math.ceil(nM / 2)
  const cM = (j: number) => col(2 + S + j)
  /** Las 3 celdas de semestre de la fila `n`, sobre sus columnas de mes; `v` = los valores de los meses. */
  const semCeldas = (n: number, v: number[]): unknown[] => !S ? [] : [
    { t: "n", f: `SUM(${cM(0)}${n}:${cM(mitad - 1)}${n})`, v: r2(v.slice(0, mitad).reduce((a, b) => a + b, 0)), z: MONEDA },
    { t: "n", f: `SUM(${cM(mitad)}${n}:${cM(nM - 1)}${n})`, v: r2(v.slice(mitad).reduce((a, b) => a + b, 0)), z: MONEDA },
    { t: "n", f: `${col(0)}${n}+${col(1)}${n}`, v: r2(v.reduce((a, b) => a + b, 0)), z: MONEDA },
  ]
  const vacias = (): unknown[] => Array.from({ length: S }, () => "")

  const h: unknown[][] = [[o.titulo], ...(o.notas ?? []).map(n => [n]), []]
  monedas.forEach((m, k) => {
    h.push([...vacias(), m === "USD" ? "EN DÓLARES (US$) — no se suman a los pesos" : m === "ARS" ? "EN PESOS" : "RESUMEN POR CATEGORÍA Y POR MES"])
    h.push([...(S ? ["1er sem", "2do sem", "total"] : []), "Nro", "Categoría", ...o.meses.map(x => x.rotulo), "TOTAL"])
    const r1 = h.length + 1
    for (const c of filasPorMoneda[k]) {
      const n = h.length + 1, num = nro.get(c)!
      const vals: number[] = []
      const fila: unknown[] = [num, c]
      o.meses.forEach((mes, j) => {
        const v = r2(items.filter(i => (i.categoria || "(sin categoría)") === c && i.mes === mes.clave && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
        const crit = `${rng("A")},$${col(S)}${n},${rng("B")},"${mes.clave}"${m && colMoneda ? `,${rng(colMoneda)},"${m}"` : ""}`
        fila.push({ t: "n", f: suma(crit), v, z: MONEDA })
        vals.push(v)
        void j
      })
      const tot = r2(items.filter(i => (i.categoria || "(sin categoría)") === c && o.meses.some(x => x.clave === i.mes) && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
      fila.push({ t: "n", f: `SUM(${cM(0)}${n}:${cM(nM - 1)}${n})`, v: tot, z: MONEDA })
      h.push([...semCeldas(n, vals), ...fila])
    }
    const rN = h.length
    const totales: unknown[] = ["", "TOTAL"]
    const valsT: number[] = []
    for (let j = 0; j <= nM; j++) {
      const c = cM(j)
      const v = j < nM
        ? r2(items.filter(i => i.mes === o.meses[j].clave && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
        : r2(items.filter(i => o.meses.some(x => x.clave === i.mes) && (m === undefined || i.moneda === m)).reduce((t, i) => t + i.importe, 0))
      if (j < nM) valsT.push(v)
      totales.push({ t: "n", f: rN >= r1 ? `SUM(${c}${r1}:${c}${rN})` : "0", v, z: MONEDA })
    }
    h.push([...semCeldas(h.length + 1, valsT), ...totales])
    if (monedas.length === 1 && m === undefined) celdaTotal = `${cM(nM)}${h.length}`
    h.push([])
  })
  if (o.bloqueExtra) {
    const filaTotal = h.length - 1 // el TOTAL del resumen (antes del blanco)
    const fila0 = h.length + 1
    const b = o.bloqueExtra.armar({
      fila: fila0, filaTotal, colMes: (j: number) => cM(j), colTotal: cM(nM),
      rng, colDebito: colImporte, colCredito, colDetalle: colDet,
    })
    for (let k = 0; k < o.bloqueExtra.alto; k++) {
      const r = (b[k] ?? []) as unknown[]
      if (!S) { h.push(r); continue }
      // Una fila de meses del bloque (12 números en C…): lleva sus semestres; un acumulado o un título, no
      const meses = r.slice(2, 2 + nM)
      const esNum = (x: unknown) => typeof x === "number" || (!!x && typeof x === "object" && (x as { t?: string }).t === "n")
      const conMeses = meses.length === nM && meses.every(esNum) && !/acumulado/i.test(String(r[1] ?? ""))
      const vals = meses.map(x => (typeof x === "number" ? x : Number((x as { v?: number })?.v ?? 0)))
      h.push([...(conMeses ? semCeldas(fila0 + k, vals) : vacias()), ...r])
    }
  }
  // 🟨 ⚠️ cambió 02/11: el renglón amarillo «Nro a ver» se sacó (JMS: «pensé que era algo súper sencillo, no te líes con esto»).
  // Excel no filtra desde una celda sin macro; para ver un Nro está el filtro de la columna Nro, que ya viene puesto.
  h.push(["DETALLE — filtrá por «Nro» para ver qué forma cada línea del resumen"])
  const encImp = [...(o.porMoneda ? ["Moneda"] : []), ...(o.debeHaber ? ["Débito", "Crédito"] : [o.rotuloImporte ?? "Importe"])]
  h.push(["Nro", "Mes", ...o.encabezadoDetalle.slice(0, pos), ...encImp, ...o.encabezadoDetalle.slice(pos)])
  const conOrden = items.some(i => i.orden !== undefined)
  const orden = [...items].sort((a, b) => conOrden
    ? (a.orden ?? "").localeCompare(b.orden ?? "")
    : (nro.get(a.categoria || "(sin categoría)")! - nro.get(b.categoria || "(sin categoría)")!) || a.mes.localeCompare(b.mes))
  for (const i of orden) {
    const imp = r2(i.importe)
    const celdasImp = [...(o.porMoneda ? [i.moneda ?? ""] : []), ...(o.debeHaber ? [imp > 0 ? imp : "", imp < 0 ? -imp : ""] : [imp])]
    h.push([nro.get(i.categoria || "(sin categoría)"), i.mes, ...i.columnas.slice(0, pos), ...celdasImp, ...i.columnas.slice(pos)])
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
    const fila: unknown[] = Array.from({ length: 2 + pos + (o.porMoneda ? 1 : 0) }, () => "")
    fila[1 + pos] = o.porMoneda ? "Subtotal de lo filtrado (filtrá una moneda: no mezcla)" : "Subtotal de lo filtrado"
    const deb = items.reduce((t, i) => t + Math.max(r2(i.importe), 0), 0), cre = items.reduce((t, i) => t + Math.max(-r2(i.importe), 0), 0)
    if (colCredito) fila.push(sub(colImporte, deb), sub(colCredito, cre), { t: "n", f: `${colImporte}${ultima + 1}-${colCredito}${ultima + 1}`, v: r2(deb - cre), z: MONEDA }, "← neto")
    else fila.push(sub(colImporte, deb - cre))
    h.push(fila)
    filtrarEn(h, `A${filaEncDetalle}:${col(2 + nCols + kImp - 1)}${ultima}`)
    // 🧊 JMS 09/11: fijo hasta el encabezado del DETALLE (el resumen de arriba entra de un pantallazo; el detalle es lo largo). SIEMPRE.
    // ⚠️ cambió 09/11: había un tope de 30 filas y en «Retiros y aportes» (encabezado en la 32) no se fijaba — JMS: «recordá que ya vimos
    // esto». Si el resumen es alto, se pliega con el [−] (agruparResumen) y la parte fija se achica.
    congelarEn(h, filaEncDetalle)
    // 📑 JMS 09/11: el resumen (de su título a la fila en blanco antes de «DETALLE») se pliega con el [−]
    agruparResumen(h, 3, filaEncDetalle - 2)
  }
  return {
    filas: h,
    ubicacion: {
      celdaTotal, det1, detN: Math.max(det1, detN - 1),
      colImporte: o.debeHaber ? null : colImporte,
      colDebito: o.debeHaber ? colImporte : null,
      colCredito,
      colDetalle: colDet,
    },
  }
}
