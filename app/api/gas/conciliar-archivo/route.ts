/**
 * POST /api/gas/conciliar-archivo  — "Auditar saldos" (rápido, SIN OCR)
 * Lista los archivos de la carpeta del período (acción GAS 'listar') y los concilia contra los
 * links que ya tienen las facturas, sin OCR-ear nada:
 *   - huérfanos = archivos en la carpeta que NINGUNA factura referencia (pdf_drive_url).
 *   - faltantes = facturas no-Portal sin PDF.
 * Es el "balance" instantáneo, para no correr la supervisión OCR sobre todo.
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_{MSA,PAM,MA}.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Empresa } from '@/lib/gas-pdf/types'

export const runtime = 'nodejs'

function schemaDe(e: Empresa): string {
  return e === 'PAM' ? 'pam' : e === 'MA' ? 'ma' : 'msa'
}
function carpetaDe(e: Empresa): string | undefined {
  switch (e) {
    case 'MSA': return process.env.GAS_FOLDER_ID_MSA
    case 'PAM': return process.env.GAS_FOLDER_ID_PAM
    case 'MA': return process.env.GAS_FOLDER_ID_MA
  }
}
function computarSubcarpetas(empresa: Empresa, anio: number, mes: number): string[] {
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}
const fileIdDe = (u?: string | null) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? m[0] : null }

export async function POST(request: Request) {
  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }
    const { empresa, anio, mes } = (await request.json()) as { empresa: Empresa; anio: number; mes: number }
    if (!empresa || !anio || !mes) {
      return NextResponse.json({ ok: false, error: 'Faltan empresa / anio / mes' }, { status: 400 })
    }
    const carpeta = carpetaDe(empresa)
    if (!carpeta) return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    const schema = schemaDe(empresa)
    const subcarpetas = computarSubcarpetas(empresa, anio, mes)

    // 1) Listar archivos de la carpeta (sin OCR)
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _token: token, accion: 'listar', carpeta_drive_id: carpeta, subcarpetas }),
    })
    const gas = (await r.json()) as { status?: string; existe?: boolean; archivos?: { file_id: string; archivo: string; url: string }[]; observaciones?: string }
    if (gas.status !== 'ok') {
      return NextResponse.json({ ok: false, error: gas.observaciones || 'El GAS no pudo listar la carpeta' }, { status: 502 })
    }
    if (gas.existe === false) {
      return NextResponse.json({ ok: true, existe: false, huerfanos: [], total_archivos: 0, faltantes: 0 })
    }
    const archivos = gas.archivos || []

    // 2) Facturas del período contable
    const { data: facturas, error } = await supabaseAdmin
      .schema(schema)
      .from('comprobantes_arca')
      .select('*')
      .eq('año_contable', anio)
      .eq('mes_contable', mes)
    if (error) return NextResponse.json({ ok: false, error: `Error cargando facturas: ${error.message}` }, { status: 500 })

    // 3) Conciliar (sin OCR): huérfanos = archivos no referenciados por ningún link de factura
    const linkedFileIds = new Set((facturas || []).map((f) => fileIdDe(f.pdf_drive_url)).filter(Boolean) as string[])
    const huerfanos = archivos
      .filter((a) => !linkedFileIds.has(a.file_id))
      .map((a) => ({ archivo: a.archivo, url: a.url, file_id: a.file_id }))

    const faltantes = (facturas || []).filter((f) => !f.pdf_drive_url && f.fc !== 'Portal').length
    const conLink = (facturas || []).filter((f) => f.pdf_drive_url).length

    // Detalle técnico: cada archivo de la carpeta, su file_id y a qué factura está vinculado (o no).
    // Sirve para diagnosticar por qué un archivo aparece o no como huérfano.
    const linkedMap = new Map<string, string>()
    for (const f of facturas || []) {
      const id = fileIdDe(f.pdf_drive_url)
      if (id) linkedMap.set(id, `${f.punto_venta}-${f.numero_desde} ${f.denominacion_emisor || ''}`.trim())
    }
    const detalle = archivos.map((a) => ({
      archivo: a.archivo,
      file_id: a.file_id,
      factura: linkedMap.get(a.file_id) || null,
    }))

    return NextResponse.json({
      ok: true, existe: true,
      total_archivos: archivos.length,
      con_link: conLink,
      faltantes,
      huerfanos,
      detalle,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error conciliando' }, { status: 502 })
  }
}
