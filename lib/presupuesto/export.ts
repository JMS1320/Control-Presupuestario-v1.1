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

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface MesExport { anio: number; mes: number; label: string }

/** Una fila cualquiera del presupuesto: un concepto y lo que vale cada mes. */
export interface FilaExport {
  concepto: string
  montos: Record<string, number>
  /** Para poder sangrar los hijos bajo su subtotal. */
  nivel?: number
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
}

const clave = (m: MesExport) => `${m.anio}-${String(m.mes).padStart(2, '0')}`
const redondear = (n: number) => Math.round(n)

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
