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
  tituloTexto: "FF1F4E4A", tituloFondo: "FFDCEEEB",
  seccionTexto: "FF1F4E4A", seccionFondo: "FFEEF6F4",
  encabezadoFondo: "FFEEF1F0", linea: "FFB9C4C0",
  subtotalFondo: "FFF4F7F6", totalFondo: "FFE3EEEC",
  notaTexto: "FF66706F",
  malFondo: "FFFBE4E4", malTexto: "FFA12B2B",
  bienTexto: "FF2E7A3C", dudaFondo: "FFFDF1DA", dudaTexto: "FF8A5A00",
}
const MAL = /^(no coincide|no cuadra|no cierra|no se puede|falta|🛑)/i
const BIEN = /^(coincide|cuadra|completo|ok\b|✓|control ok)/i
const DUDA = /^(parcial|⚠️|lo carga el usuario|sin dato)/i
/** Un renglón de total: «TOTAL…», «Total X», «Subtotal», «= total», «Total general». */
const ES_TOTAL = /^(=\s*)?(sub\s?total|total)\b/i
/** El total GRANDE (del ejercicio, general, de la deuda): un tono más fuerte que el subtotal de un grupo. */
const ES_TOTAL_GRANDE = (t: string) => /^(=\s*)?TOTAL\b/.test(t) || /\b(ejercicio|general|todos)\b/i.test(t)

type Estilo = Record<string, unknown>
const unir = (c: XLSX.CellObject, s: Estilo) => {
  const prev = ((c as { s?: Estilo }).s ?? {}) as Estilo
  ;(c as { s?: Estilo }).s = { ...prev, ...s, font: { ...(prev.font as object ?? {}), ...(s.font as object ?? {}) } }
}
const tieneFondo = (c: XLSX.CellObject) => !!((c as { s?: Estilo }).s?.fill)

/** Lo que la presentación averiguó de la hoja y `xlsx-js-style` no sabe escribir solo (ver `aplicarVistas`). */
export interface Vista { congelarFilas?: number; sinCuadricula?: boolean; colorSolapa?: string }

/**
 * 🎨 Presenta una hoja ya armada y devuelve su **vista** (cuántas filas inmovilizar).
 *
 * JMS 29/10/2026: *«la parte estética de los papeles… colores (tenues), negrita, subtotales, totales…
 * ancho de columnas»*. Lo que agrega a lo de A-FEAT-1338:
 * - **Sección** (una sola celda de texto que arranca en MAYÚSCULAS, no es la primera fila) → banda verde agua
 *   muy suave a lo ancho, letra oscura en negrita.
 * - **Nota** (una sola celda de texto que no es sección) → gris e itálica: se lee como aclaración, no como dato.
 * - **Total** en CUALQUIER columna antes del primer importe (el 04 lo pone en G, el 08 en B) y la banda va a lo
 *   ancho de la tabla. Dos tonos: subtotal de un grupo y total grande.
 * - **Encabezado**: además, centrado y queda anotado para inmovilizarlo.
 */
export function presentarHoja(ws: XLSX.WorkSheet): Vista {
  const vista: Vista = {}
  if (!ws["!ref"]) return vista
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
  /** El ancho de la tabla que arranca en la fila `f`: hasta la última columna con algo en ella o la de abajo. */
  const ultimaCol = (f: number) => {
    let u = r.s.c
    for (const g of [f, f + 1]) {
      for (let c = r.e.c; c > u; c--) {
        const x = celda(g, c)
        if (x && x.v !== "" && x.v != null) { u = c; break }
      }
    }
    return u
  }
  /** Banda a lo ancho: estiliza también las celdas vacías del renglón (las crea si no existen). */
  const banda = (f: number, s: Estilo, hasta = ultimaCol(f)) => {
    for (let c = r.s.c; c <= hasta; c++) {
      const dir = XLSX.utils.encode_cell({ r: f, c })
      if (!ws[dir]) ws[dir] = { t: "s", v: "" } as XLSX.CellObject
      unir(ws[dir] as XLSX.CellObject, s)
    }
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

    // 2 · Una sola celda de texto: título (fila 1), sección (MAYÚSCULAS) o nota.
    if (fila.length === 1 && textos.length === 1 && primerTexto) {
      const t = primerTexto.trim()
      // Sección = lo que va antes de « — », «:» o «(» está todo en mayúsculas («EGRESOS — gasto…»,
      // «IMPAGAS AL CIERRE: 24 cuotas»). «MSA computa el 100%…» no: es una nota.
      // Un renglón que arranca con espacios es un ítem de una lista (los de Sueldos, Cadena): nota.
      const cabeza = t.split(/\s[—–-]\s|:|\(/)[0] ?? ""
      const letras = cabeza.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "")
      const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length
      const esSeccion = !/^\s/.test(primerTexto) && !/^\d/.test(t) && letras.length >= 2 && mayus / letras.length >= 0.8
      if (f === r.s.r && t.length > 3) {
        unir(fila[0], {
          font: { bold: true, sz: 13, color: { rgb: COLOR.tituloTexto } },
          fill: { patternType: "solid", fgColor: { rgb: COLOR.tituloFondo } },
        })
      } else if (t.length > 3 && esSeccion && !ES_TOTAL.test(t) && !MAL.test(t) && !BIEN.test(t) && !DUDA.test(t)) {
        banda(f, {
          font: { bold: true, color: { rgb: COLOR.seccionTexto } },
          fill: { patternType: "solid", fgColor: { rgb: COLOR.seccionFondo } },
          border: { bottom: { style: "thin", color: { rgb: COLOR.linea } } },
        }, Math.max(ultimaCol(f + 1), ultimaCol(f + 2)))
        continue
      } else if (!MAL.test(t) && !BIEN.test(t) && !DUDA.test(t) && !ES_TOTAL.test(t)) {
        unir(fila[0], { font: { italic: true, color: { rgb: COLOR.notaTexto } } })
        continue
      }
      if (f === r.s.r) continue
    }

    // 3 · Encabezado: todo texto, arriba nada (o un título/nota), y abajo una tabla — con números en los
    //     3 renglones siguientes (salteando una sección) o, si es una tabla de texto como el Índice, otra fila
    //     igual de ancha. El primero de la hoja se inmoviliza.
    const arriba = f > r.s.r ? llenas(f - 1).length : 0
    const siguientes = [1, 2, 3].map(k => (f + k <= r.e.r ? llenas(f + k) : []))
    const conNumeros = siguientes.some(g => g.some(x => x.t === "n"))
    const tablaDeTexto = fila.length >= 3 && siguientes[0].length >= 3
    if (fila.length >= 2 && textos.length === fila.length && arriba <= 1 && (conNumeros || tablaDeTexto)
      && !ES_TOTAL.test(primerTexto.trim())) {
      for (let c = r.s.c; c <= ultimaCol(f); c++) {
        const dir = XLSX.utils.encode_cell({ r: f, c })
        if (!ws[dir]) ws[dir] = { t: "s", v: "" } as XLSX.CellObject
        unir(ws[dir] as XLSX.CellObject, {
          font: { bold: true },
          fill: { patternType: "solid", fgColor: { rgb: COLOR.encabezadoFondo } },
          border: { bottom: { style: "thin", color: { rgb: COLOR.linea } } },
          alignment: { wrapText: true, vertical: "center", horizontal: "center" },
        })
      }
      if (vista.congelarFilas === undefined && f - r.s.r < 15) {
        vista.congelarFilas = f - r.s.r + 1
        // 🔎 JMS 29/10 (A-FEAT-1422 notas 3-4): «todas las planillas largas de datos deben venir con los filtros y
        // todo preparado para auditar fácil». Filtro desde el encabezado hasta el primer renglón vacío.
        // Cruza un renglón vacío si abajo sigue la misma tabla (los meses de «por cuenta» van separados así), pero
        // frena en el TOTAL del pie: el total no se filtra.
        const esPie = (g: number) => { const t = llenas(g).find(x => x.t === "s"); return !!t && /^(=\s*)?total\b/i.test(String(t.v).trim()) && !String(llenas(g)[0]?.v ?? "").match(/^\d{4}$/) }
        let fin = f
        while (fin + 1 <= r.e.r) {
          if (llenas(fin + 1).length > 0) { fin++; continue }
          if (fin + 2 <= r.e.r && llenas(fin + 2).length >= 3 && !esPie(fin + 2)) { fin += 2; continue }
          break
        }
        if (fin - f >= 10) {
          ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: f, c: r.s.c }, e: { r: fin, c: ultimaCol(f) } }) }
        }
      }
      continue
    }

    // 4 · Total: la etiqueta puede estar en cualquier columna antes del primer importe.
    const etiquetas: string[] = []
    for (const x of fila) { if (x.t !== "s") break; etiquetas.push(String(x.v).trim()) }
    const etiqueta = etiquetas.find(t => ES_TOTAL.test(t))
    if (etiqueta && fila.some(x => x.t === "n") && !fila.some(tieneFondo)) {
      const grande = ES_TOTAL_GRANDE(etiqueta)
      banda(f, {
        font: { bold: true },
        fill: { patternType: "solid", fgColor: { rgb: grande ? COLOR.totalFondo : COLOR.subtotalFondo } },
        border: grande
          ? { top: { style: "thin", color: { rgb: COLOR.linea } }, bottom: { style: "double", color: { rgb: COLOR.linea } } }
          : { top: { style: "thin", color: { rgb: COLOR.linea } } },
      })
    }

    // 5 · Avisos, celda por celda.
    for (const x of textos) {
      const t = String(x.v).trim()
      if (MAL.test(t)) unir(x, { font: { bold: true, color: { rgb: COLOR.malTexto } }, fill: { patternType: "solid", fgColor: { rgb: COLOR.malFondo } } })
      else if (BIEN.test(t)) unir(x, { font: { color: { rgb: COLOR.bienTexto } } })
      else if (DUDA.test(t)) unir(x, { font: { color: { rgb: COLOR.dudaTexto } }, fill: { patternType: "solid", fgColor: { rgb: COLOR.dudaFondo } } })
    }
  }
  return vista
}

/**
 * 📏 Anchos automáticos para las hojas que no traen columnas (Control, 08, 08.1, 09, Saldos ej. anterior).
 * Mide lo que hay en cada columna **sin contar los títulos y notas de una sola celda**, que desbordan a la derecha
 * a propósito; los importes llevan lugar para el formato Contabilidad.
 */
export function anchosAutomaticos(ws: XLSX.WorkSheet): void {
  if (!ws["!ref"]) return
  const r = XLSX.utils.decode_range(ws["!ref"])
  const ancho: number[] = []
  for (let f = r.s.r; f <= r.e.r; f++) {
    const fila: [number, XLSX.CellObject][] = []
    for (let c = r.s.c; c <= r.e.c; c++) {
      const x = ws[XLSX.utils.encode_cell({ r: f, c })] as XLSX.CellObject | undefined
      if (x && x.v !== "" && x.v != null) fila.push([c, x])
    }
    if (fila.length < 2) continue
    for (const [c, x] of fila) {
      const largo = x.t === "n" ? (Math.abs(Number(x.v)) >= 1e6 ? 18 : 15) : String(x.v).length + 2
      ancho[c] = Math.max(ancho[c] ?? 0, largo)
    }
  }
  ws["!cols"] = Array.from({ length: r.e.c + 1 }, (_, c) => ({ wch: Math.min(60, Math.max(10, ancho[c] ?? 10)) }))
}

/**
 * 🗂️ Color tenue de la solapa según el grupo de papeles, para ubicarse en un archivo de 30 solapas.
 * Índice y controles en gris; el libro (compras, ventas, provisión) en azul; cuentas a pagar/cobrar en verde;
 * personas (sueldos, cuentas corrientes) en lila; templates en ámbar; campo y hacienda en tierra; bancos en celeste.
 */
export function colorDeSolapa(nombre: string): string {
  const n = nombre.toLowerCase()
  if (/^(00|control$|resumen)/.test(n)) return "FFB8C2C0"
  if (/^0[34]/.test(n)) return "FF9FCDB0"
  if (/^(13|14)\b/.test(n)) return "FFC3B5DC"
  if (/^(07|08|09)/.test(n)) return "FF9CC6DE"
  if (/^(02|1 |3 |precios|stock)/.test(n)) return "FFD6C29C"
  if (/template|cuotas|saldos ej/.test(n)) return "FFF0D08A"
  return "FFA9BEDF"
}

/**
 * 🪟 Lo que `xlsx-js-style` (SheetJS 0.18 libre) no escribe: encabezado inmovilizado (`!freeze` lo ignora),
 * cuadrícula apagada y color de solapa. Se agregan al XML de cada solapa después de escribir el archivo.
 */
export async function aplicarVistas(datos: Uint8Array | ArrayBuffer, vistas: Vista[]): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(datos)
  const hojas = Object.keys(zip.files).filter(r => /^xl\/worksheets\/sheet\d+\.xml$/.test(r))
  for (const ruta of hojas) {
    const i = Number(ruta.match(/sheet(\d+)\.xml$/)![1]) - 1
    const v = vistas[i] ?? {}
    const f = zip.file(ruta)
    if (!f) continue
    /**
     * 🔤 JMS 29/10 (A-FEAT-1422 nota 6-7): «no se llega a leer el título». Las franjas de color se hacen con
     * celdas en "" — y Excel NO deja que un texto largo desborde sobre una celda que tiene un texto, aunque sea
     * vacío. Se escriben como celdas SIN valor (conservan el color, dejan desbordar).
     */
    let xml = (await f.async("string")).replace(/<c r="([A-Z]+\d+)"( s="\d+")? t="str"><v><\/v><\/c>/g, '<c r="$1"$2/>')
    if (v.congelarFilas || v.sinCuadricula) {
      const atrib = v.sinCuadricula ? ' showGridLines="0"' : ""
      const pane = v.congelarFilas
        ? `<pane ySplit="${v.congelarFilas}" topLeftCell="A${v.congelarFilas + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${v.congelarFilas + 1}" sqref="A${v.congelarFilas + 1}"/>`
        : ""
      xml = xml.replace(/<sheetView ([^>]*?)\/>/, (_m, a: string) => `<sheetView ${a}${atrib}>${pane}</sheetView>`)
    }
    if (v.colorSolapa) {
      const tab = `<tabColor rgb="${v.colorSolapa}"/>`
      if (/<sheetPr[^>]*\/>/.test(xml)) xml = xml.replace(/<sheetPr([^>]*)\/>/, `<sheetPr$1>${tab}</sheetPr>`)
      else if (/<sheetPr[^>]*>/.test(xml)) xml = xml.replace(/<sheetPr([^>]*)>/, `<sheetPr$1>${tab}`)
      else xml = xml.replace(/(<worksheet[^>]*>)/, `$1<sheetPr>${tab}</sheetPr>`)
    }
    zip.file(ruta, xml)
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })
}
