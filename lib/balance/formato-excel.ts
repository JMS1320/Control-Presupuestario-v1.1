/**
 * 📐 EL FORMATO DEL EXCEL QUE VA AL CONTADOR — A-FEAT-1184.
 *
 * Pedido del usuario 2026-09-29, en la solapa «Pasos a seguir» que devolvió:
 * *«formato del número: 1000 · Contabilidad»* y *«formato de tablas… intentemos que sea lo más
 * amigable para el contador»*.
 *
 * ## Por qué un módulo y no un `z` suelto en cada celda
 *
 * Porque el formato **tiene que ser el mismo en las 13 solapas**. Un papel donde los importes se
 * ven distinto en cada hoja obliga a leer dos veces el mismo número para creerle, y el destinatario
 * es alguien que va a recorrer todo el archivo.
 *
 * ## 🧮 Y la parte que pidió expresamente: FÓRMULAS, no resultados
 *
 * *«si son fórmulas deben quedar las fórmulas en el excel y no los datos»* (nota en `02 Hacienda`).
 *
 * 🔑 **No es estética: es poder auditar y poder probar.** Con la fórmula puesta, él cambia un
 * precio en la celda y **el papel se recalcula solo**; con el número pegado, tiene que rehacer la
 * cuenta a mano y el Excel deja de ser una herramienta para pasar a ser una foto.
 */
import * as XLSX from "xlsx"

/**
 * Formato **Contabilidad** de Excel: alinea el signo, separa miles, muestra un guión en el cero y
 * pone los **negativos entre paréntesis**.
 * Es el que espera un contador — un `#,##0.00` pelado desalinea la columna en cuanto hay negativos.
 * ⚠️ cambió 2026-10-24: antes el negativo llevaba signo menos. Usuario: *«lo negativo deberá ir
 * entre paréntesis»*. Los separadores los pone Excel según el idioma del equipo (es-AR: punto de
 * miles y coma decimal).
 */
export const MONEDA = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)'
/** Cantidades enteras: cabezas, comprobantes, productos. Negativos entre paréntesis. */
export const ENTERO = "#,##0_);(#,##0)"
/** Toneladas: tres decimales, porque el cuadre de granos se juega en los kilos. */
export const TONELADAS = "#,##0.000_);(#,##0.000)"
/** Coeficientes (0,90 · 1,5). Se muestran como número, no como porcentaje: él los escribe así. */
export const COEFICIENTE = "0.00"
export const FECHA = "dd/mm/yyyy"

/** Qué formato y qué ancho lleva cada columna de una hoja. */
export interface Columna {
  /** Ancho en caracteres. */
  ancho: number
  /** Formato de número. Sin esto, la columna queda como la deja Excel. */
  z?: string
}

/**
 * Aplica anchos y formatos a una hoja ya armada.
 *
 * 📌 **Se aplica al final y sobre la hoja entera**, no celda por celda al construirla: las filas de
 * título y los subtotales intercalados harían que la mitad de las celdas se olvidara el formato, y
 * ése es justo el defecto que hace que un papel se vea desprolijo.
 *
 * ⚠️ **Sólo toca las celdas numéricas.** Una celda de texto en una columna de importes —un
 * `"FALTA EL PRECIO"`, que los hay a propósito— **se deja tal cual**: forzarle un formato de número
 * la mostraría vacía, y ese aviso es el que no puede perderse.
 */
export function formatearHoja(ws: XLSX.WorkSheet, columnas: Columna[]): void {
  ws["!cols"] = columnas.map(c => ({ wch: c.ancho }))
  if (!ws["!ref"]) return

  const r = XLSX.utils.decode_range(ws["!ref"])
  for (let fila = r.s.r; fila <= r.e.r; fila++) {
    for (let col = r.s.c; col <= Math.min(r.e.c, columnas.length - 1); col++) {
      const z = columnas[col]?.z
      if (!z) continue
      const dir = XLSX.utils.encode_cell({ r: fila, c: col })
      const celda = ws[dir] as XLSX.CellObject | undefined
      if (celda && celda.t === "n") celda.z = z
    }
  }
}

/**
 * Una celda con **fórmula**, para que el Excel se pueda recalcular.
 *
 * El `v` es el valor que ya calculamos: Excel lo muestra hasta que el usuario abre el archivo y
 * recalcula. Sin él, la celda se ve vacía hasta que alguien toca algo — que parece un error.
 */
export const conFormula = (formula: string, valor: number, z = MONEDA): XLSX.CellObject =>
  ({ t: "n", f: formula, v: valor, z })

/** Congela la primera fila (o las que se pidan) para que el encabezado no se pierda al scrollear. */
export function congelarEncabezado(ws: XLSX.WorkSheet, filas = 1): void {
  ws["!freeze"] = { xSplit: "0", ySplit: String(filas), topLeftCell: `A${filas + 1}`, activePane: "bottomLeft", state: "frozen" }
}

/**
 * 🎨 PRESENTACIÓN — formato de número en TODAS las celdas y jerarquía visual (A-FEAT-1338, 2026-10-24).
 *
 * Usuario: *«el export no usa el separador de miles y siempre es nuestro sistema de formato… lo
 * negativo deberá ir entre paréntesis… dale un poco de formato, colores translúcidos, negrita, para
 * presentación»*. La hoja **Control** se armaba sin columnas y sus importes salían pelados
 * (`17718450,8`).
 *
 * Se aplica al final sobre la hoja ya armada, mirando el contenido de cada fila — no hay que tocar
 * las 30 funciones que arman las hojas:
 * - **Número sin formato** → Contabilidad (o entero si es una cantidad chica sin decimales). Lo que
 *   ya trae formato de su columna se respeta.
 * - **Título** (una sola celda de texto en la fila) → negrita sobre verde agua suave.
 * - **Encabezado** (todas las celdas de texto y la fila de abajo trae algún número) → negrita sobre
 *   gris suave, con línea abajo.
 * - **Total** (la fila empieza con «TOTAL») → negrita con línea arriba.
 * - **Avisos** («NO COINCIDE», «NO CUADRA», «falta»…) en rojo; «coincide», «cuadra», «completo» en
 *   verde; «parcial» en ámbar.
 * Hace falta escribir con `xlsx-js-style` (el `xlsx` libre no guarda estilos).
 */
const COLOR = {
  tituloFondo: "FFDCEEEB", tituloTexto: "FF1F4E4A",
  encabezadoFondo: "FFEEF1F0", linea: "FFB9C4C0",
  totalFondo: "FFF5F7F6",
  malFondo: "FFFBE4E4", malTexto: "FFA12B2B",
  bienTexto: "FF2E7A3C", dudaFondo: "FFFDF1DA", dudaTexto: "FF8A5A00",
}
const MAL = /^(no coincide|no cuadra|no cierra|no se puede|falta|🛑)/i
const BIEN = /^(coincide|cuadra|completo|ok\b|✓|control ok)/i
const DUDA = /^(parcial|⚠️|lo carga el usuario|sin dato)/i

type Estilo = Record<string, unknown>
const unir = (c: XLSX.CellObject, s: Estilo) => {
  const prev = ((c as { s?: Estilo }).s ?? {}) as Estilo
  ;(c as { s?: Estilo }).s = { ...prev, ...s, font: { ...(prev.font as object ?? {}), ...(s.font as object ?? {}) } }
}

export function presentarHoja(ws: XLSX.WorkSheet): void {
  if (!ws["!ref"]) return
  const r = XLSX.utils.decode_range(ws["!ref"])
  const celda = (f: number, c: number) => ws[XLSX.utils.encode_cell({ r: f, c })] as XLSX.CellObject | undefined
  const llenas = (f: number) => {
    const out: XLSX.CellObject[] = []
    for (let c = r.s.c; c <= r.e.c; c++) {
      const x = celda(f, c)
      if (x && x.v !== "" && x.v != null) out.push(x)
    }
    return out
  }

  for (let f = r.s.r; f <= r.e.r; f++) {
    const fila = llenas(f)
    if (fila.length === 0) continue

    // 1 · Número: todo número lleva formato; el de su columna manda.
    for (const x of fila) {
      if (x.t !== "n") continue
      if (!x.z) {
        const v = Number(x.v)
        x.z = Number.isInteger(v) && v !== 0 && Math.abs(v) < 100000 ? ENTERO : MONEDA
      }
      unir(x, { numFmt: x.z })
    }

    const textos = fila.filter(x => x.t === "s")
    const primera = celda(f, r.s.c)
    const primerTexto = primera && primera.t === "s" ? String(primera.v) : ""

    // 2 · Título: una sola celda de texto.
    if (fila.length === 1 && textos.length === 1 && primerTexto && primerTexto.length > 3
      && (f === r.s.r || primerTexto === primerTexto.toUpperCase())) {
      unir(fila[0], {
        font: { bold: true, sz: 12, color: { rgb: COLOR.tituloTexto } },
        fill: { patternType: "solid", fgColor: { rgb: COLOR.tituloFondo } },
      })
      continue
    }

    // 3 · Encabezado: todo texto, y abajo vienen números.
    const abajo = f < r.e.r ? llenas(f + 1) : []
    if (fila.length >= 2 && textos.length === fila.length && abajo.some(x => x.t === "n")) {
      for (let c = r.s.c; c <= r.e.c; c++) {
        const x = celda(f, c)
        if (!x) continue
        unir(x, {
          font: { bold: true },
          fill: { patternType: "solid", fgColor: { rgb: COLOR.encabezadoFondo } },
          border: { bottom: { style: "thin", color: { rgb: COLOR.linea } } },
          alignment: { wrapText: true, vertical: "center" },
        })
      }
      continue
    }

    // 4 · Total.
    if (/^total\b/i.test(primerTexto.trim())) {
      for (const x of fila) {
        unir(x, {
          font: { bold: true },
          fill: { patternType: "solid", fgColor: { rgb: COLOR.totalFondo } },
          border: { top: { style: "thin", color: { rgb: COLOR.linea } } },
        })
      }
    }

    // 5 · Avisos, celda por celda.
    for (const x of textos) {
      const t = String(x.v).trim()
      if (MAL.test(t)) unir(x, { font: { bold: true, color: { rgb: COLOR.malTexto } }, fill: { patternType: "solid", fgColor: { rgb: COLOR.malFondo } } })
      else if (BIEN.test(t)) unir(x, { font: { color: { rgb: COLOR.bienTexto } } })
      else if (DUDA.test(t)) unir(x, { font: { color: { rgb: COLOR.dudaTexto } }, fill: { patternType: "solid", fgColor: { rgb: COLOR.dudaFondo } } })
    }
  }
}
