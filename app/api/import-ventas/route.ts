/**
 * POST /api/import-ventas
 *
 * Importa FACTURAS DE VENTA (ARCA "Mis Comprobantes Emitidos" o Excel del mismo formato)
 * a msa.comprobantes_venta. Espejo del importador de compras (import-facturas-arca) pero:
 *   - El otro (cliente) sale de las columnas RECEPTOR (no Emisor).
 *   - Nace con estado='a cobrar' + fecha_cobro_estimada (para el Cash Flow).
 *   - Al insertar, vincula retenciones_recibidas pendientes por CUIT del cliente.
 *
 * DEBUG: loguea headers detectados, columna de cliente usada, cada fila mapeada, inserts y errores.
 *
 * FormData: file (xlsx/xls/csv), fecha_cobro (YYYY-MM-DD, opcional), preview ('true' para no insertar).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers (mismos que import-facturas-arca; se copian para no tocar el importador de compras) ──
function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return v
  if (typeof v !== 'string' || v.trim() === '') return 0
  let t = v.trim()
  const neg = t.startsWith('(') && t.endsWith(')')
  if (neg) t = t.slice(1, -1)
  t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t) || 0
  return neg ? -n : n
}

function fecha(v: string | number | null | undefined): string | null {
  if (!v) return null
  if (typeof v === 'number') {
    try {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400 * 1000)
      if (isNaN(d.getTime())) return null
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    } catch { return null }
  }
  if (typeof v !== 'string' || v.trim() === '') return null
  const s = v.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

const codNC = [3, 8, 13, 53, 203, 208, 213]
const esNotaCredito = (t: number) => codNC.includes(t)

// Primer header no vacío de una lista de candidatos (tolera variaciones de nombre)
function pick(fila: any, ...cands: string[]): any {
  for (const c of cands) {
    if (c in fila && fila[c] !== '' && fila[c] !== null && fila[c] !== undefined) return fila[c]
  }
  return ''
}

function mapearFilaVenta(fila: any, nombreArchivo: string, fechaCobro: string | null) {
  const fechaEmision = fecha(pick(fila, 'Fecha', 'Fecha de Emisión'))
  const tipo = parseInt(pick(fila, 'Tipo', 'Tipo de Comprobante')) || 0
  // Cliente = RECEPTOR (ventas). Fallback a Emisor por si el export trae otra estructura.
  const cuitCliente = String(pick(fila, 'Nro. Doc. Receptor', 'Nro. Doc. Emisor', 'CUIT') || '').replace(/\D/g, '')
  const denomCliente = String(pick(fila, 'Denominación Receptor', 'Denominacion Receptor', 'Denominación Emisor') || '')

  const punto = parseInt(pick(fila, 'Punto de Venta')) || null
  const desde = parseInt(pick(fila, 'Número Desde', 'Numero Desde')) || null
  const impTotalRaw = num(pick(fila, 'Imp. Total', 'Imp Total'))
  const ivaRaw = num(pick(fila, 'Total IVA', 'IVA'))
  const netoRaw = num(pick(fila, 'Neto Gravado Total', 'Imp. Neto Gravado'))
  const signo = esNotaCredito(tipo) ? -1 : 1

  const anio = fechaEmision ? parseInt(fechaEmision.slice(0, 4)) : null
  const mes = fechaEmision ? parseInt(fechaEmision.slice(5, 7)) : null

  return {
    fecha_liquidacion: fechaEmision,
    tipo_comprobante: tipo,
    punto_venta: punto,
    numero_desde: desde,
    nro_comprobante: punto && desde ? `${String(punto).padStart(5, '0')}-${String(desde).padStart(8, '0')}` : null,
    cuit_cliente: cuitCliente,
    denominacion_cliente: denomCliente,
    moneda: String(pick(fila, 'Moneda') || 'PES'),
    tc: num(pick(fila, 'Tipo Cambio')) || 1,
    imp_neto_gravado: netoRaw * signo,
    imp_neto_no_gravado: num(pick(fila, 'Neto No Gravado', 'Imp. Neto No Gravado')) * signo,
    imp_op_exentas: num(pick(fila, 'Op. Exentas', 'Imp. Op. Exentas')) * signo,
    iva: ivaRaw * signo,
    imp_total: impTotalRaw * signo,
    año_contable: anio,
    mes_contable: mes,
    estado: 'a cobrar',
    fecha_cobro_estimada: fechaCobro,
    datos_adicionales: `Importado de ${nombreArchivo}`,
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const fechaCobro = (formData.get('fecha_cobro') as string) || null
    const modoPreview = formData.get('preview') === 'true'

    if (!file) return NextResponse.json({ ok: false, error: 'No se envió ningún archivo' }, { status: 400 })

    console.log(`🧾 [import-ventas] archivo=${file.name} fecha_cobro=${fechaCobro} preview=${modoPreview}`)

    // ── Parsear archivo (Excel: ignora fila 1 de info; CSV: separador ;) ──
    const esExcel = /\.(xlsx|xls)$/i.test(file.name)
    const esCsv = /\.csv$/i.test(file.name)
    let filas: any[] = []

    if (esExcel) {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, range: 1 }) as any[][]
      if (raw.length < 2) return NextResponse.json({ ok: false, error: 'Excel sin datos (mín. headers + 1 fila)' }, { status: 400 })
      const headers = raw[0].map((h: any) => h?.toString().trim() || '')
      console.log(`🧾 [import-ventas] headers:`, headers)
      filas = raw.slice(1).map(row => {
        const o: any = {}
        headers.forEach((h: string, i: number) => { o[h] = row[i] ?? '' })
        return o
      })
    } else if (esCsv) {
      const parsed = Papa.parse(await file.text(), { header: true, delimiter: ';', skipEmptyLines: true })
      if (parsed.errors.length) {
        console.error('🧾 [import-ventas] errores CSV:', parsed.errors)
        return NextResponse.json({ ok: false, error: 'Error al parsear CSV' }, { status: 400 })
      }
      filas = parsed.data as any[]
      console.log(`🧾 [import-ventas] headers CSV:`, Object.keys(filas[0] || {}))
    } else {
      return NextResponse.json({ ok: false, error: 'Formato no soportado (.xlsx/.xls/.csv)' }, { status: 400 })
    }

    console.log(`🧾 [import-ventas] filas de datos: ${filas.length}`)
    if (filas[0]) console.log(`🧾 [import-ventas] SAMPLE fila[0]:`, filas[0])

    // ── Mapear ──
    const mapeadas = filas
      .filter(f => Object.values(f).some(v => v !== '' && v !== null && v !== undefined))
      .map(f => mapearFilaVenta(f, file.name, fechaCobro))

    // DEBUG: avisar filas sin datos clave
    mapeadas.forEach((m, i) => {
      if (!m.fecha_liquidacion || !m.cuit_cliente || !m.imp_total) {
        console.warn(`🧾 [import-ventas] ⚠️ fila ${i}: falta fecha/cuit/total →`, { fecha: m.fecha_liquidacion, cuit: m.cuit_cliente, total: m.imp_total })
      }
    })

    // ── Dedup contra lo existente (tipo+punto+numero+cuit) ──
    const { data: existentes, error: errExist } = await supabase
      .schema('msa').from('comprobantes_venta')
      .select('tipo_comprobante, punto_venta, numero_desde, cuit_cliente')
    if (errExist) {
      console.error('🧾 [import-ventas] error leyendo existentes:', errExist)
      return NextResponse.json({ ok: false, error: `No se pudo leer comprobantes_venta: ${errExist.message}` }, { status: 500 })
    }
    const claveExist = new Set((existentes || []).map(e => `${e.tipo_comprobante}|${e.punto_venta}|${e.numero_desde}|${e.cuit_cliente}`))
    const nuevas = mapeadas.filter(m => !claveExist.has(`${m.tipo_comprobante}|${m.punto_venta}|${m.numero_desde}|${m.cuit_cliente}`))
    const duplicadas = mapeadas.length - nuevas.length
    console.log(`🧾 [import-ventas] nuevas=${nuevas.length} duplicadas=${duplicadas}`)

    if (modoPreview) {
      return NextResponse.json({ ok: true, preview: true, total: mapeadas.length, nuevas: nuevas.length, duplicadas, muestra: nuevas.slice(0, 5) })
    }

    if (nuevas.length === 0) {
      return NextResponse.json({ ok: true, insertadas: 0, duplicadas, mensaje: 'No hay comprobantes nuevos para importar' })
    }

    // ── Insertar ──
    const { data: inserted, error: errIns } = await supabase
      .schema('msa').from('comprobantes_venta')
      .insert(nuevas).select('id, cuit_cliente, imp_total')
    if (errIns) {
      console.error('🧾 [import-ventas] error insertando:', errIns)
      return NextResponse.json({ ok: false, error: `Error al insertar: ${errIns.message}`, debug: nuevas[0] }, { status: 500 })
    }
    console.log(`🧾 [import-ventas] insertadas: ${inserted?.length}`)

    // ── Vincular retenciones pendientes por CUIT (cargadas antes de importar la factura) ──
    let retVinculadas = 0
    for (const comp of inserted || []) {
      const { data: rets, error: errRet } = await supabase
        .schema('msa').from('retenciones_recibidas')
        .update({ comprobante_venta_id: comp.id, updated_at: new Date().toISOString() })
        .is('comprobante_venta_id', null)
        .eq('cuit_cliente', comp.cuit_cliente)
        .select('id')
      if (errRet) { console.warn('🧾 [import-ventas] error vinculando retenciones:', errRet); continue }
      retVinculadas += rets?.length || 0
    }
    console.log(`🧾 [import-ventas] retenciones vinculadas por CUIT: ${retVinculadas}`)

    return NextResponse.json({
      ok: true,
      insertadas: inserted?.length || 0,
      duplicadas,
      retenciones_vinculadas: retVinculadas,
    })
  } catch (err) {
    console.error('🧾 [import-ventas] ERROR:', err)
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}
