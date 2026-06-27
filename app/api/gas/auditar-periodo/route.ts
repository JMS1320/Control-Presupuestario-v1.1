/**
 * POST /api/gas/auditar-periodo  (A-FEAT-AUDIT — parte 2)
 * Audita el registro digital de un período contable: trae las facturas del período, le pide al GAS
 * que releve la carpeta (OCR + match por CUIT+número), y agrega el link a las que matchearon sin link.
 * Devuelve el informe (matched / huérfanos / sin-PDF) para la UI.
 *
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_{MSA,PAM,MA}.
 * Nota: el GAS OCR-ea cada archivo (1-3s c/u). Períodos chicos (≤~25 comprobantes) entran en 60s.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Empresa } from '@/lib/gas-pdf/types'

export const runtime = 'nodejs'
export const maxDuration = 60

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
// Subcarpetas (campaña/aa-mm) calculadas desde el PERÍODO CONTABLE (no la emisión).
function computarSubcarpetas(empresa: Empresa, anio: number, mes: number): string[] {
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

interface MatchItem { factura_id: string; drive_url: string; archivo: string }

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
    if (!carpeta) {
      return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    }

    const schema = schemaDe(empresa)
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`

    // Facturas del período contable (año_contable + mes_contable, con ñ)
    const { data: facturas, error } = await supabaseAdmin
      .schema(schema)
      .from('comprobantes_arca')
      .select('id, cuit, punto_venta, numero_desde, denominacion_emisor, fc, pdf_drive_url')
      .eq('año_contable', anio)
      .eq('mes_contable', mes)
    if (error) {
      return NextResponse.json({ ok: false, error: `Error cargando facturas: ${error.message}` }, { status: 500 })
    }

    const payload = (facturas || []).map((f) => ({
      factura_id: f.id, cuit: f.cuit, punto_venta: f.punto_venta,
      numero_desde: f.numero_desde, denominacion: f.denominacion_emisor, fc: f.fc,
    }))

    // Disparar el relevamiento en el GAS
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _token: token, accion: 'auditar', empresa, periodo,
        carpeta_drive_id: carpeta, subcarpetas: computarSubcarpetas(empresa, anio, mes), facturas: payload,
      }),
    })
    const audit = (await r.json()) as {
      status?: string; existe?: boolean; observaciones?: string
      matched?: MatchItem[]; huerfanos?: { archivo: string; url: string }[]
      sin_pdf?: { factura_id: string; denominacion?: string; numero?: string; fc?: string }[]
    }

    // Agregar link a las que matchearon por contenido y NO tenían (confirmadas por CUIT+número)
    let linksAgregados = 0
    for (const m of audit.matched || []) {
      const fact = (facturas || []).find((f) => f.id === m.factura_id)
      if (fact && !fact.pdf_drive_url) {
        await supabaseAdmin.schema(schema).from('comprobantes_arca')
          .update({ pdf_drive_url: m.drive_url, pdf_estado: 'descargado' })
          .eq('id', m.factura_id)
        linksAgregados++
      }
    }

    return NextResponse.json({
      ok: true, empresa, periodo,
      existe: audit.existe ?? true,
      observaciones: audit.observaciones,
      total_facturas: payload.length,
      matched: audit.matched || [],
      huerfanos: audit.huerfanos || [],
      sin_pdf: audit.sin_pdf || [],
      links_agregados: linksAgregados,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error en auditoría' }, { status: 502 })
  }
}
