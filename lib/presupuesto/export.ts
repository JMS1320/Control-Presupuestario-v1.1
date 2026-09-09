// Export del presupuesto para presentar a los socios (P-38).
//
// No es un volcado de la grilla: es un documento que alguien lee sin tener la app al lado. Por eso
// hay dos niveles y no uno solo — el usuario lo pidió así: *"reportes sintéticos con el desglose
// de a capas, para AMS y los menos interesados en los detalles"*.
//
//   RESUMEN   una hoja: ingresos, egresos por sección, inversiones y saldo. Es lo que se mira.
//   DETALLE   una hoja por bloque, con las filas que forman cada subtotal. Es lo que se consulta
//             cuando alguien pregunta "¿y esto de dónde sale?".
//
// El PDF sólo lleva el resumen: un PDF de 40 páginas no lo abre nadie. El detalle vive en el Excel,
// que es donde de verdad se audita.

// 🎨 `xlsx-js-style` en vez de `xlsx`: MISMA API, pero soporta estilos de celda. El `xlsx`
// libre de SheetJS no escribe negrita ni fondos, y un export sin jerarquía visual se lee como un
// volcado. Es un reemplazo directo — no hubo que reescribir nada, sólo agregar `s` a las celdas.
// ⚠️ Import por DEFAULT, no por namespace: el paquete es CommonJS y sólo expone `default`, así que
// `import * as XLSX` deja `XLSX.utils` en undefined fuera de webpack. Con webpack andaba de casualidad.
import XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface MesExport { anio: number; mes: number; label: string }

/** Una fila cualquiera del presupuesto: un concepto y lo que vale cada mes. */
export interface FilaExport {
  concepto: string
  montos: Record<string, number>
  /** Para poder sangrar los hijos bajo su subtotal. */
  nivel?: number
  /**
   * 🔑 **Con qué regla se está llenando esta fila**, en castellano.
   *
   * Pedido del usuario (2026-09-09): *«quiero que me pongas como primera columna la regla usada
   * actualmente para llenarla; o sea, el presupuesto pasa a decir línea por línea cómo se está
   * llenando»*.
   *
   * No hubo que inventar nada: el dato **ya existía** —`FilaTemplate.metodo` para los templates,
   * `ConfigCuenta.modo` para las cuentas— y se calculaba para el tooltip. Lo único que faltaba era
   * que llegara hasta acá. Un número presupuestado sin su regla al lado **no se puede discutir**:
   * se acepta o se desconfía, que son las dos peores maneras de mirarlo.
   */
  regla?: string
  /** `alta` · `media` · `baja` — cuánto se puede confiar en la proyección de esta fila. */
  confianza?: string
}

/**
 * Un modo de llenado del catálogo, con **cuántas filas lo están usando hoy**.
 *
 * El cero es el dato interesante: *«tal vez haya alguno nunca usado y me interesaría saberlo»*.
 * Un modo que existe y nadie usa es una de dos cosas —una herramienta que no se conoce o una que
 * no sirve— y las dos merecen enterarse.
 */
export interface ModoCatalogo {
  familia: string
  clave: string
  etiqueta: string
  cuando: string
  usos: number
}

export interface BloqueExport {
  titulo: string
  filas: FilaExport[]
  /** Si es `false`, el bloque se muestra pero NO entra en el total de egresos (inversiones). */
  sumaAlTotal?: boolean
}

export interface DatosExport {
  empresa: string
  campana: string | null
  meses: MesExport[]
  ingresos: BloqueExport[]
  egresos: BloqueExport[]
  inversiones: BloqueExport | null
  saldoInicial: number
  /** De dónde salió el saldo, para que el lector sepa qué está mirando. */
  origenSaldo: string
  /** Avisos del control de cobertura. Van en el documento: esconderlos sería maquillar. */
  advertencias: string[]
  /** El catálogo completo de modos, con sus usos. Va en su propia hoja. */
  catalogo?: ModoCatalogo[]
}

const clave = (m: MesExport) => `${m.anio}-${String(m.mes).padStart(2, '0')}`
const redondear = (n: number) => Math.round(n)

// ── 🎨 Formato ───────────────────────────────────────────────────────────────────────────────
//
// Pedido del usuario (2026-09-09): *«que tenga formato, tipo presentación clara de primer impacto
// visual. Tonos con cierta transparencia y claros, negrita, que se vea toda la columna pero sin ser
// anchas de más, números como en la app»*.
//
// 🔑 **La jerarquía visual no es decoración: es lo que hace legible una grilla de 24 columnas.**
// Sin ella, un subtotal y una fila cualquiera se leen igual, y hay que ir contando renglones.
// Los tonos son claros a propósito — un Excel con colores fuertes se vuelve ilegible al imprimir,
// y esto se imprime.

/** Formato de número **igual al de la app**: miles con punto, sin decimales, negativo en rojo. */
const FMT_PESOS = '#,##0;[Red]-#,##0'
const FMT_ENTERO = '#,##0'

const BORDE_SUAVE = { style: 'thin' as const, color: { rgb: 'FFE2E5E9' } }
const bordes = { top: BORDE_SUAVE, bottom: BORDE_SUAVE, left: BORDE_SUAVE, right: BORDE_SUAVE }

const ESTILO = {
  /** Título del documento. */
  titulo: { font: { bold: true, sz: 14, color: { rgb: 'FF1F2937' } } },
  subtitulo: { font: { sz: 9, color: { rgb: 'FF6B7280' } } },
  /** Encabezado de columnas: oscuro y fijo arriba. */
  cabecera: {
    font: { bold: true, sz: 10, color: { rgb: 'FFFFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FF374151' } },
    alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    border: bordes,
  },
  /** Título de bloque: la banda que separa una sección de otra. */
  bloque: {
    font: { bold: true, sz: 11, color: { rgb: 'FF1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFEEF2F7' } },
    border: bordes,
  },
  /** Fila normal. */
  texto: { font: { sz: 10 }, alignment: { vertical: 'center' as const }, border: bordes },
  numero: { font: { sz: 10 }, numFmt: FMT_PESOS, alignment: { horizontal: 'right' as const }, border: bordes },
  /** La regla: gris y en cursiva — acompaña, no compite con el número. */
  regla: {
    font: { sz: 9, italic: true, color: { rgb: 'FF6B7280' } },
    alignment: { vertical: 'center' as const, wrapText: true }, border: bordes,
  },
  /** Subtotal de bloque. */
  subtexto: {
    font: { bold: true, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF6F8FA' } }, border: bordes,
  },
  subnumero: {
    font: { bold: true, sz: 10 }, numFmt: FMT_PESOS,
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF6F8FA' } },
    alignment: { horizontal: 'right' as const }, border: bordes,
  },
  /** Los totales que se leen primero. */
  fuertetexto: {
    font: { bold: true, sz: 10.5, color: { rgb: 'FF111827' } },
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE4EAF1' } }, border: bordes,
  },
  fuertenumero: {
    font: { bold: true, sz: 10.5, color: { rgb: 'FF111827' } }, numFmt: FMT_PESOS,
    fill: { patternType: 'solid', fgColor: { rgb: 'FFE4EAF1' } },
    alignment: { horizontal: 'right' as const }, border: bordes,
  },
  aviso: { font: { sz: 9, color: { rgb: 'FF9A3412' } }, alignment: { wrapText: true } },
}

/**
 * Ancho de columna que muestra el contenido **sin pasarse**.
 *
 * *«Que se vea toda la columna pero sin ser anchas de más»*: se mide el contenido real y se acota
 * entre un mínimo legible y un máximo. Una columna de 80 caracteres obliga a scrollear igual, así
 * que no gana nada.
 */
function anchoDe(valores: unknown[], min: number, max: number): { wch: number } {
  let n = min
  for (const v of valores) {
    if (v == null) continue
    const largo = typeof v === 'number' ? Math.round(v).toLocaleString('es-AR').length : String(v).length
    if (largo > n) n = largo
  }
  return { wch: Math.min(max, n + 2) }
}

/** Aplica un estilo a una celda ya escrita. Si la celda no existe, no hace nada. */
function estilar(hoja: XLSX.WorkSheet, fila: number, col: number, estilo: object) {
  const ref = XLSX.utils.encode_cell({ r: fila, c: col })
  const celda = (hoja as Record<string, unknown>)[ref] as { s?: object; z?: string } | undefined
  if (celda) celda.s = estilo
}

/** Suma de un bloque por mes. */
function totalBloque(b: BloqueExport, meses: MesExport[]): Record<string, number> {
  const t: Record<string, number> = {}
  for (const m of meses) {
    const k = clave(m)
    t[k] = b.filas.reduce((s, f) => s + (f.montos[k] || 0), 0)
  }
  return t
}

function sumar(a: Record<string, number>, b: Record<string, number>, meses: MesExport[]) {
  const out: Record<string, number> = {}
  for (const m of meses) {
    const k = clave(m)
    out[k] = (a[k] || 0) + (b[k] || 0)
  }
  return out
}

/**
 * El resumen: lo que de verdad se presenta.
 *
 * Devuelve filas listas para pintar, sin lógica de presentación adentro, así el Excel y el PDF
 * muestran EXACTAMENTE lo mismo. Que los dos documentos digan cosas distintas es la peor manera
 * de perder la confianza de quien los lee.
 */
export function armarResumen(d: DatosExport): { etiqueta: string; valores: number[]; fuerte?: boolean }[] {
  const out: { etiqueta: string; valores: number[]; fuerte?: boolean }[] = []
  const vals = (t: Record<string, number>) => d.meses.map(m => redondear(t[clave(m)] || 0))

  let totalIng: Record<string, number> = {}
  for (const b of d.ingresos) {
    const t = totalBloque(b, d.meses)
    out.push({ etiqueta: b.titulo, valores: vals(t) })
    totalIng = sumar(totalIng, t, d.meses)
  }
  if (d.ingresos.length > 0) out.push({ etiqueta: 'TOTAL INGRESOS', valores: vals(totalIng), fuerte: true })

  let totalEgr: Record<string, number> = {}
  for (const b of d.egresos) {
    const t = totalBloque(b, d.meses)
    out.push({ etiqueta: b.titulo, valores: vals(t) })
    if (b.sumaAlTotal !== false) totalEgr = sumar(totalEgr, t, d.meses)
  }
  out.push({ etiqueta: 'TOTAL EGRESOS', valores: vals(totalEgr), fuerte: true })

  if (d.inversiones) {
    const t = totalBloque(d.inversiones, d.meses)
    out.push({ etiqueta: 'INVERSIONES (fuera del total)', valores: vals(t) })
  }

  // Resultado y saldo acumulado. El saldo es el que contesta "¿alcanza la plata?", así que va
  // aunque no haya ingresos cargados: un saldo que baja es información igual.
  const resultado: Record<string, number> = {}
  for (const m of d.meses) {
    const k = clave(m)
    resultado[k] = (totalIng[k] || 0) - (totalEgr[k] || 0)
      - (d.inversiones ? totalBloque(d.inversiones, d.meses)[k] || 0 : 0)
  }
  out.push({ etiqueta: 'RESULTADO DEL MES', valores: vals(resultado), fuerte: true })

  let acum = d.saldoInicial
  const saldo: number[] = []
  for (const m of d.meses) {
    acum += resultado[clave(m)] || 0
    saldo.push(redondear(acum))
  }
  out.push({ etiqueta: 'SALDO ACUMULADO', valores: saldo, fuerte: true })

  return out
}

/**
 * 📋 **La grilla tal cual se ve**, aplanada en una sola lista.
 *
 * Es otra cosa que `armarResumen`, y por eso convive con él en vez de reemplazarlo:
 *
 * | | El informe (`armarResumen`) | La tabla (esto) |
 * |---|---|---|
 * | Para | los socios, la reunión | el usuario, trabajar |
 * | Muestra | subtotales, y el detalle aparte | **todas las filas, en el orden de la pantalla** |
 * | Responde | *¿cómo venimos?* | *¿de dónde sale este número?* |
 *
 * Pedido del usuario (2026-09-09): *«un export del presupuesto, sólo del presupuesto, o sea la
 * tabla»*. El informe existente parte el detalle en una hoja por bloque; acá va todo junto y con
 * la sangría, que es lo que hace que se lea igual que la grilla.
 *
 * 🔑 Los subtotales y el saldo se calculan **con las mismas funciones que el informe**. Si cada
 * documento hiciera su propia cuenta, en tres meses dirían cosas distintas — y ahí no se sabe cuál
 * creer.
 */
export function armarTabla(d: DatosExport): { celdas: (string | number)[]; fuerte?: boolean; titulo?: boolean }[] {
  const out: { celdas: (string | number)[]; fuerte?: boolean; titulo?: boolean }[] = []
  /** La regla va PRIMERO: es lo que hace que la fila se pueda discutir y no sólo leer. */
  const fila = (regla: string, etiqueta: string, t: Record<string, number>) => {
    const vals = d.meses.map(m => redondear(t[clave(m)] || 0))
    return [regla, etiqueta, ...vals, vals.reduce((a, b) => a + b, 0)]
  }

  const bloque = (b: BloqueExport) => {
    if (b.filas.length === 0) return
    out.push({ celdas: ["", b.titulo, ...d.meses.map(() => ""), ""], titulo: true })
    for (const f of b.filas) {
      // La sangría es la jerarquía: sin ella, un hijo y su padre se leen como dos filas iguales.
      const regla = (f.regla ?? "").trim() || "—"
      out.push({
        celdas: fila(f.confianza && f.confianza !== "alta" ? `${regla}  (confianza ${f.confianza})` : regla,
          "   ".repeat(f.nivel ?? 0) + f.concepto, f.montos),
      })
    }
    // Un subtotal no tiene regla propia: es la suma de las de arriba. Ponerle una sería inventarla.
    out.push({ celdas: fila("suma de las filas de arriba", `Subtotal ${b.titulo}`, totalBloque(b, d.meses)), fuerte: true })
  }

  let totalIng: Record<string, number> = {}
  for (const b of d.ingresos) { bloque(b); totalIng = sumar(totalIng, totalBloque(b, d.meses), d.meses) }
  if (d.ingresos.length > 0) out.push({ celdas: fila("suma de los bloques de ingreso", "TOTAL INGRESOS", totalIng), fuerte: true })

  let totalEgr: Record<string, number> = {}
  for (const b of d.egresos) {
    bloque(b)
    if (b.sumaAlTotal !== false) totalEgr = sumar(totalEgr, totalBloque(b, d.meses), d.meses)
  }
  out.push({ celdas: fila("suma de los bloques de egreso", "TOTAL EGRESOS", totalEgr), fuerte: true })

  // Las inversiones se muestran pero NO entran al total: la plata sale, pero no es gasto del
  // período. Fundirlas con los egresos infla el resultado y esconde justamente eso.
  const tInv = d.inversiones ? totalBloque(d.inversiones, d.meses) : {}
  if (d.inversiones) {
    bloque(d.inversiones)
    out.push({ celdas: fila("no suma al total: sale plata pero no es gasto del período", "INVERSIONES (fuera del total)", tInv), fuerte: true })
  }

  const resultado: Record<string, number> = {}
  for (const m of d.meses) {
    const k = clave(m)
    resultado[k] = (totalIng[k] || 0) - (totalEgr[k] || 0) - (tInv[k] || 0)
  }
  out.push({ celdas: fila("ingresos − egresos − inversiones", "RESULTADO DEL MES", resultado), fuerte: true })

  let acum = d.saldoInicial
  const saldo: number[] = []
  for (const m of d.meses) { acum += resultado[clave(m)] || 0; saldo.push(redondear(acum)) }
  // El saldo acumulado no se suma en la columna TOTAL: sumar saldos de meses distintos no significa
  // nada. Va el último, que es el que contesta «¿con cuánto termino?».
  out.push({ celdas: ["saldo de arranque + resultado, mes a mes", "SALDO ACUMULADO", ...saldo, saldo[saldo.length - 1] ?? 0], fuerte: true })

  return out
}

/** La hoja de LA TABLA: la grilla completa, con la regla de cada fila adelante. */
function hojaTabla(d: DatosExport) {
  const cuerpo = armarTabla(d)
  const CAB = 4 // fila (0-based) del encabezado de columnas
  const filas: (string | number)[][] = [
    [`PRESUPUESTO ${d.empresa}${d.campana ? ` — campaña ${d.campana}` : ''} · la tabla completa`],
    [`Saldo de arranque: ${d.saldoInicial.toLocaleString('es-AR')} (${d.origenSaldo})`],
    [`Generado el ${new Date().toLocaleDateString('es-AR')}`],
    [],
    ['Cómo se llena', 'Concepto', ...d.meses.map(m => m.label), 'TOTAL'],
    ...cuerpo.map(f => f.celdas),
  ]
  const desdeAvisos = filas.length + 1
  if (d.advertencias.length > 0) filas.push([], ['ADVERTENCIAS'], ...d.advertencias.map(a => [a]))

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  const nCols = 2 + d.meses.length + 1

  // Anchos medidos sobre el contenido real, acotados.
  hoja['!cols'] = [
    anchoDe(cuerpo.map(f => f.celdas[0]), 22, 40),
    anchoDe(cuerpo.map(f => f.celdas[1]), 20, 38),
    ...d.meses.map((_, i) => anchoDe(cuerpo.map(f => f.celdas[2 + i]), 11, 15)),
    anchoDe(cuerpo.map(f => f.celdas[nCols - 1]), 13, 17),
  ]
  // ⚠️ SheetJS NO escribe paneles fijos en el .xlsx — se probó y no llegan al archivo. Se deja
  // dicho acá en vez de poner una línea que no hace nada y que el próximo dé por funcionando.

  estilar(hoja, 0, 0, ESTILO.titulo)
  estilar(hoja, 1, 0, ESTILO.subtitulo)
  estilar(hoja, 2, 0, ESTILO.subtitulo)
  for (let c = 0; c < nCols; c++) estilar(hoja, CAB, c, ESTILO.cabecera)

  /**
   * 🔽 **La agrupación, ya hecha desde el export.**
   *
   * Pedido del usuario: *«si hay algo colapsable, el export debería poder usar la función agrupar
   * de Excel — pero que el export ya lo haya hecho, entonces uno puede colapsar si quiere»*.
   *
   * Las filas de detalle van en **nivel 1**; los títulos de bloque y los subtotales quedan en 0.
   * Excel dibuja solo los `+`/`−` al margen. Se dejan **desplegadas** al abrir: colapsar es una
   * decisión de quien lee, y abrir un archivo con todo cerrado esconde justamente lo que se vino
   * a mirar.
   */
  const filasExcel: { hpx?: number; level?: number }[] = []
  for (let i = 0; i < CAB + 1; i++) filasExcel.push({})
  cuerpo.forEach((f, i) => {
    const r = CAB + 1 + i
    const esDetalle = !f.titulo && !f.fuerte
    filasExcel.push(esDetalle ? { level: 1 } : {})
    const est = f.titulo ? ESTILO.bloque : f.fuerte ? ESTILO.fuertetexto : ESTILO.texto
    const estN = f.titulo ? ESTILO.bloque : f.fuerte ? ESTILO.fuertenumero : ESTILO.numero
    // La primera columna (la regla) va gris y en cursiva cuando es una fila de detalle.
    estilar(hoja, r, 0, f.titulo ? ESTILO.bloque : f.fuerte ? ESTILO.fuertetexto : ESTILO.regla)
    estilar(hoja, r, 1, est)
    for (let c = 2; c < nCols; c++) estilar(hoja, r, c, estN)
    // El subtotal de un bloque lleva un tono más suave que los totales generales: los dos son
    // negrita, pero no pesan lo mismo y el ojo tiene que poder distinguirlos de un vistazo.
    if (f.fuerte && String(f.celdas[1] ?? '').startsWith('Subtotal')) {
      estilar(hoja, r, 0, ESTILO.subtexto)
      estilar(hoja, r, 1, ESTILO.subtexto)
      for (let c = 2; c < nCols; c++) estilar(hoja, r, c, ESTILO.subnumero)
    }
  })
  hoja['!rows'] = filasExcel

  for (let i = 0; i < d.advertencias.length; i++) estilar(hoja, desdeAvisos + i, 0, ESTILO.aviso)
  return hoja
}

/**
 * La hoja del CATÁLOGO: todos los modos que existen, usados o no.
 *
 * 🔑 **El cero es el dato que se busca.** Pedido del usuario: *«tal vez haya alguno nunca usado por
 * el presupuesto y me interesaría saberlo»*. Un modo sin usos es una herramienta que no se conoce
 * o una que no sirve — y las dos cosas conviene saberlas.
 */
function hojaCatalogo(d: DatosExport) {
  const cat = d.catalogo ?? []
  const sinUso = cat.filter(c => c.usos === 0)
  const filas: (string | number)[][] = [
    ['MODOS DE LLENADO — todos los que existen, se usen o no'],
    [`${cat.length} modos · ${cat.length - sinUso.length} en uso · ${sinUso.length} sin usar`],
    [],
    ['Familia', 'Modo', 'Cómo llena', 'Cuándo conviene', 'Filas que lo usan'],
    ...cat.map(c => [c.familia, c.clave, c.etiqueta, c.cuando, c.usos]),
  ]
  if (sinUso.length > 0) {
    filas.push([], [`NUNCA USADOS — ${sinUso.length}`],
      ...sinUso.map(c => [`${c.familia} · ${c.etiqueta}`, '', c.cuando, '', 0]))
  }
  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 38 }, { wch: 62 }, { wch: 17 }]
  return hoja
}

/** Excel: resumen + una hoja por bloque. */
export function exportarExcel(d: DatosExport, nombreArchivo: string) {
  const wb = XLSX.utils.book_new()
  const cabecera = ['Concepto', ...d.meses.map(m => m.label), 'TOTAL']

  // ── Hoja 1: RESUMEN ──
  const resumen = armarResumen(d)
  const filasRes: (string | number)[][] = [
    [`PRESUPUESTO ${d.empresa}${d.campana ? ` — campaña ${d.campana}` : ''}`],
    [`Saldo de arranque: ${d.saldoInicial.toLocaleString('es-AR')} (${d.origenSaldo})`],
    [`Generado el ${new Date().toLocaleDateString('es-AR')}`],
    [],
    cabecera,
    ...resumen.map(r => [r.etiqueta, ...r.valores, r.valores.reduce((a, b) => a + b, 0)]),
  ]
  if (d.advertencias.length > 0) {
    filasRes.push([], ['ADVERTENCIAS'], ...d.advertencias.map(a => [a]))
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasRes), 'Resumen')

  // ── Hoja 2: LA TABLA, tal cual se ve en pantalla, con la regla de cada fila ──
  // Va acá y no en un botón aparte: es el mismo documento visto con otro nivel de detalle, y
  // partirlo en dos archivos obliga a acordarse de bajar los dos.
  XLSX.utils.book_append_sheet(wb, hojaTabla(d), 'La tabla')

  // ── Hoja 3: el catálogo de modos, con los que nadie usa ──
  if ((d.catalogo ?? []).length > 0) {
    XLSX.utils.book_append_sheet(wb, hojaCatalogo(d), 'Modos de llenado')
  }

  // ── Una hoja por bloque, con el detalle ──
  const bloques = [...d.ingresos, ...d.egresos, ...(d.inversiones ? [d.inversiones] : [])]
  for (const b of bloques) {
    if (b.filas.length === 0) continue
    const t = totalBloque(b, d.meses)
    const filas: (string | number)[][] = [
      [b.titulo],
      [],
      cabecera,
      ...b.filas.map(f => {
        const vals = d.meses.map(m => redondear(f.montos[clave(m)] || 0))
        return [('  '.repeat(f.nivel ?? 0)) + f.concepto, ...vals, vals.reduce((a, c) => a + c, 0)]
      }),
      [],
      ['TOTAL', ...d.meses.map(m => redondear(t[clave(m)] || 0)),
        d.meses.reduce((a, m) => a + redondear(t[clave(m)] || 0), 0)],
    ]
    // Excel corta los nombres de hoja en 31 caracteres y no admite algunos símbolos.
    const nombre = b.titulo.replace(/[\\/*?:[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre)
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  descargar(new Blob([out], { type: 'application/octet-stream' }), `${nombreArchivo}.xlsx`)
}

/**
 * PDF: resumen **y detalle**, apaisado.
 *
 * El PDF es el documento de la reunión — es lo que se imprime y se muestra, y va junto con el
 * Excel, que es el que usan los socios para controlar. Por eso lleva el detalle completo: si en
 * la reunión alguien pregunta de dónde sale un número, la respuesta tiene que estar ahí y no en
 * otro archivo.
 *
 * El orden resuelve las dos audiencias sin partir el documento: **el resumen es la primera
 * página**, así el que no quiere el detalle no pasa de ahí; el que sí, sigue leyendo.
 *
 * `soloResumen` existe para el caso en que alcance con la síntesis.
 */
export function exportarPDF(d: DatosExport, nombreArchivo: string, soloResumen = false) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()

  const encabezado = (titulo: string, subtitulo?: string) => {
    doc.setFontSize(15)
    doc.setTextColor(31, 41, 55)
    doc.text(titulo, 40, 40)
    doc.setFontSize(9)
    doc.setTextColor(110)
    if (subtitulo) doc.text(subtitulo, 40, 56)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')}`, ancho - 40, 56, { align: 'right' })
  }

  const subtitulo = [
    d.campana ? `Campaña ${d.campana}` : '',
    `${d.meses[0]?.label ?? ''} – ${d.meses[d.meses.length - 1]?.label ?? ''}`,
    `Saldo de arranque ${d.saldoInicial.toLocaleString('es-AR')} (${d.origenSaldo})`,
  ].filter(Boolean).join('  ·  ')

  // ── Página 1: el resumen ──
  encabezado(`Presupuesto ${d.empresa}`, subtitulo)
  const resumen = armarResumen(d)
  autoTable(doc, {
    startY: 74,
    head: [['Concepto', ...d.meses.map(m => m.label)]],
    body: resumen.map(r => [r.etiqueta, ...r.valores.map(v => v.toLocaleString('es-AR'))]),
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [55, 65, 81], fontSize: 7 },
    columnStyles: { 0: { cellWidth: 120, halign: 'left' } },
    bodyStyles: { halign: 'right' },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const fila = resumen[data.row.index]
      if (fila?.fuerte) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [243, 244, 246]
      }
      if (data.column.index === 0) data.cell.styles.halign = 'left'
    },
  })

  // Las advertencias van EN el documento. Esconderlas sería maquillar el número que se presenta.
  if (d.advertencias.length > 0) {
    const y = (doc as any).lastAutoTable?.finalY ?? 300
    doc.setFontSize(8)
    doc.setTextColor(180, 83, 9)
    doc.text('Advertencias', 40, y + 22)
    doc.setTextColor(120)
    d.advertencias.slice(0, 8).forEach((a, i) => {
      doc.text(`· ${a}`, 40, y + 34 + i * 11, { maxWidth: ancho - 80 })
    })
  }

  // ── El detalle: una página por bloque ──
  if (!soloResumen) {
    const bloques = [...d.ingresos, ...d.egresos, ...(d.inversiones ? [d.inversiones] : [])]
      .filter(b => b.filas.length > 0)

    for (const b of bloques) {
      doc.addPage()
      encabezado(b.titulo, `Presupuesto ${d.empresa}${d.campana ? ` · campaña ${d.campana}` : ''}`)

      const t = totalBloque(b, d.meses)
      const cuerpo = b.filas.map(f => [
        ('    '.repeat(f.nivel ?? 0)) + f.concepto,
        ...d.meses.map(m => redondear(f.montos[clave(m)] || 0).toLocaleString('es-AR')),
      ])
      cuerpo.push([
        'TOTAL',
        ...d.meses.map(m => redondear(t[clave(m)] || 0).toLocaleString('es-AR')),
      ])

      autoTable(doc, {
        startY: 74,
        head: [['Concepto', ...d.meses.map(m => m.label)]],
        body: cuerpo,
        styles: { fontSize: 6.5, cellPadding: 2.5 },
        headStyles: { fillColor: [55, 65, 81], fontSize: 6.5 },
        columnStyles: { 0: { cellWidth: 140, halign: 'left' } },
        bodyStyles: { halign: 'right' },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          if (data.row.index === cuerpo.length - 1) {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [243, 244, 246]
          }
          if (data.column.index === 0) data.cell.styles.halign = 'left'
        },
      })
    }
  }

  // Numeración: en un documento que se imprime y circula, saber cuántas páginas son evita que se
  // presente uno incompleto sin que nadie lo note.
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`${i} / ${total}`, ancho - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }

  doc.save(`${nombreArchivo}.pdf`)
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
