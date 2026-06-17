/**
 * GET /api/gas/historial-pdf
 *
 * Query params:
 *   - lote_id: filtra por lote específico
 *   - factura_id: filtra por factura específica
 *   - limit: max registros (default 50)
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const loteId = url.searchParams.get('lote_id')
    const facturaId = url.searchParams.get('factura_id')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500)

    let q = supabaseAdmin.from('arca_pdf_busqueda_log')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(limit)

    if (loteId) q = q.eq('lote_id', loteId)
    if (facturaId) q = q.eq('factura_id', facturaId)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, logs: data || [] })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
