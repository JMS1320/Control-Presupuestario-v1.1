/**
 * POST /api/gas/auditar-periodo  (A-FEAT-AUDIT — resumible por tandas)
 * Procesa UNA tanda (≤ max_files archivos OCR) del relevamiento de un período y commitea sus links.
 * El cliente (modal) loopea pasando `skip_file_ids` (archivos ya procesados) hasta `completo:true`,
 * y al final manda `finalizar:true` con el resumen acumulado → el GAS deja el log + manda el mail.
 *
 * Cada tanda es ≤60s. Resumible: los links se guardan por tanda; re-correr saltea lo ya hecho.
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_{MSA,PAM,MA}.
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
function computarSubcarpetas(empresa: Empresa, anio: number, mes: number): string[] {
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

interface MatchItem { factura_id: string; drive_url: string; archivo: string; file_id: string }

export async function POST(request: Request) {
  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }

    const body = (await request.json()) as {
      empresa: Empresa; anio: number; mes: number
      skip_file_ids?: string[]; max_files?: number
      finalizar?: boolean; resumen?: unknown
    }
    const { empresa, anio, mes } = body
    if (!empresa || !anio || !mes) {
      return NextResponse.json({ ok: false, error: 'Faltan empresa / anio / mes' }, { status: 400 })
    }
    const carpeta = carpetaDe(empresa)
    if (!carpeta) {
      return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    }
    const schema = schemaDe(empresa)
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`
    const subcarpetas = computarSubcarpetas(empresa, anio, mes)

    // Cierre: deja el log + manda el mail con el resumen acumulado por el cliente.
    if (body.finalizar) {
      const r = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _token: token, accion: 'auditar', empresa, periodo, carpeta_drive_id: carpeta, subcarpetas, finalizar: true, resumen: body.resumen }),
      })
      const g = (await r.json()) as { status?: string }
      return NextResponse.json({ ok: g.status === 'ok', finalizado: true })
    }

    // Facturas del período contable
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

    // Una tanda
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _token: token, accion: 'auditar', empresa, periodo,
        carpeta_drive_id: carpeta, subcarpetas, facturas: payload,
        skip_file_ids: body.skip_file_ids || [], max_files: body.max_files || 10,
      }),
    })
    const audit = (await r.json()) as {
      status?: string; existe?: boolean; observaciones?: string
      matched?: MatchItem[]; huerfanos?: { archivo: string; url: string; file_id: string; chars?: number; ocr_error?: string }[]
      procesados?: number; restantes?: number; completo?: boolean
    }

    if (audit.existe === false) {
      return NextResponse.json({ ok: true, empresa, periodo, existe: false, observaciones: audit.observaciones, completo: true, total_facturas: payload.length, matched: [], huerfanos: [], sin_pdf: [] })
    }

    // Agregar link a las matched que no lo tenían (confirmadas por contenido)
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

    // Pendientes después de esta tanda (sin link y sin match): el cliente usa el de la última tanda
    const yaLinkeadas = new Set((facturas || []).filter((f) => f.pdf_drive_url).map((f) => f.id))
    for (const m of audit.matched || []) yaLinkeadas.add(m.factura_id)
    const sin_pdf = (facturas || [])
      .filter((f) => !yaLinkeadas.has(f.id))
      .map((f) => ({ factura_id: f.id, denominacion: f.denominacion_emisor, numero: `${f.punto_venta}-${f.numero_desde}`, fc: f.fc }))

    // Un archivo que YA está vinculado a una factura NO es huérfano, aunque el OCR no lo haya podido
    // leer en esta corrida (típico de fotos). Lo excluimos comparando su file_id con los de los links.
    const fileIdDe = (u?: string | null) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? m[0] : null }
    const linkedFileIds = new Set((facturas || []).map((f) => fileIdDe(f.pdf_drive_url)).filter(Boolean) as string[])
    const huerfanosReales = (audit.huerfanos || []).filter((h) => !linkedFileIds.has(h.file_id))

    return NextResponse.json({
      ok: true, empresa, periodo, existe: true,
      total_facturas: payload.length,
      matched: audit.matched || [],
      huerfanos: huerfanosReales,
      sin_pdf,
      procesados: audit.procesados || 0,
      restantes: audit.restantes || 0,
      completo: !!audit.completo,
      links_agregados: linksAgregados,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error en auditoría' }, { status: 502 })
  }
}
