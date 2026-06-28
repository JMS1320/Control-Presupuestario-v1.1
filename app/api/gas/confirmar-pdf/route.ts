/**
 * POST /api/gas/confirmar-pdf  (Confirmar VER)
 * El usuario confirma que el PDF candidato (en _Revisar) ES esa factura. Le pide al GAS que lo
 * mueva a la carpeta del mes + lo renombre, y marca la factura como Sí + guarda el link.
 * El candidato sale del log (arca_pdf_busqueda_log). Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_*.
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
function computarSubcarpetas(empresa: Empresa, fechaEmision: string): string[] {
  const f = new Date(`${fechaEmision}T12:00:00`)
  const anio = f.getFullYear()
  const mes = f.getMonth() + 1
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

export async function POST(request: Request) {
  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }

    const { factura_id, empresa } = (await request.json()) as { factura_id: string; empresa: Empresa }
    if (!factura_id || !empresa) {
      return NextResponse.json({ ok: false, error: 'Faltan factura_id / empresa' }, { status: 400 })
    }
    const carpeta = carpetaDe(empresa)
    if (!carpeta) {
      return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    }
    const schema = schemaDe(empresa)

    // Factura (datos para renombrar + carpeta)
    const { data: f, error: errF } = await supabaseAdmin
      .schema(schema)
      .from('comprobantes_arca')
      .select('cuit, punto_venta, numero_desde, tipo_comprobante_desc, fecha_emision, denominacion_emisor')
      .eq('id', factura_id)
      .maybeSingle()
    if (errF || !f) {
      return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    // Candidato en el log (último con drive_url). gmail_message_id permite etiquetar el mail al confirmar.
    const { data: log } = await supabaseAdmin
      .from('arca_pdf_busqueda_log')
      .select('drive_url, gmail_message_id')
      .eq('factura_id', factura_id)
      .not('drive_url', 'is', null)
      .order('fecha_hora', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!log?.drive_url) {
      return NextResponse.json({ ok: false, error: 'No hay un PDF candidato en el log para confirmar' }, { status: 412 })
    }

    // GAS: mover de _Revisar a la carpeta del mes + renombrar + (si hay message id) etiquetar el mail
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _token: token, accion: 'confirmar', file_url: log.drive_url,
        gmail_message_id: log.gmail_message_id ?? undefined,
        carpeta_drive_id: carpeta, subcarpetas: computarSubcarpetas(empresa, f.fecha_emision),
        cuit_emisor: f.cuit, punto_venta: f.punto_venta, numero_desde: f.numero_desde,
        tipo_comprobante_desc: f.tipo_comprobante_desc || 'Factura A',
        fecha_emision: f.fecha_emision, denominacion_emisor: f.denominacion_emisor || '',
      }),
    })
    const gas = (await r.json()) as { status?: string; drive_url?: string; observaciones?: string; mail_etiquetado?: boolean }
    if (gas.status !== 'ok') {
      return NextResponse.json({ ok: false, error: gas.observaciones || 'El GAS no pudo mover el archivo' }, { status: 502 })
    }

    // Confirmada → FC = Sí + link (ahora sí, porque está confirmada)
    await supabaseAdmin.schema(schema).from('comprobantes_arca')
      .update({
        fc: 'Sí',
        pdf_drive_url: gas.drive_url,
        pdf_estado: 'descargado',
        pdf_observaciones: 'Confirmada manualmente — movida de _Revisar a la carpeta del mes',
      })
      .eq('id', factura_id)

    return NextResponse.json({ ok: true, drive_url: gas.drive_url, mail_etiquetado: !!gas.mail_etiquetado })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error confirmando' }, { status: 502 })
  }
}
