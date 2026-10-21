/**
 * POST /api/gas/descartar-candidato  («No es ésta» — A-FEAT-1287, usuario 2026-10-20)
 *
 * El usuario abrió un candidato de una factura en VER y NO es. Queda la HUELLA en el log de búsquedas
 * (renglón `descartado`: qué archivo, de qué mail, quién, cuándo, el motivo y el importe que había
 * leído la app al lado del de la factura), y ese archivo no se vuelve a ofrecer para esa factura.
 *
 * Si no queda ningún candidato, la factura sale de VER a **NO Mail**: se buscó, lo que apareció no
 * era, y se puede volver a buscar. El archivo NO se borra ni se mueve (nada destructivo en Drive).
 */
import { NextResponse } from 'next/server'
import { clienteUsuario } from "@/lib/supabase-usuario"
import type { Empresa } from '@/lib/gas-pdf/types'
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { candidatosDelLog } from '@/lib/gas-pdf/lote'

export const runtime = 'nodejs'

function schemaDe(e: Empresa): string {
  return e === 'PAM' ? 'pam' : e === 'MA' ? 'ma' : 'msa'
}

export async function POST(request: Request) {
  // Cliente de la SESIÓN, no service_role: así la RLS también gobierna esta ruta (A-SEC-01).
  const supabase = await clienteUsuario()

  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const { factura_id, empresa, drive_url, motivo } = (await request.json()) as { factura_id: string; empresa: Empresa; drive_url: string; motivo?: string }
    if (!factura_id || !empresa || !drive_url) {
      return NextResponse.json({ ok: false, error: 'Faltan factura_id / empresa / drive_url' }, { status: 400 })
    }
    const schema = schemaDe(empresa)

    const { data: f, error: errF } = await supabase.schema(schema).from('comprobantes_arca')
      .select('id, fc, cuit, punto_venta, numero_desde, imp_total, pdf_drive_url').eq('id', factura_id).maybeSingle()
    if (errF || !f) return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 })

    const { data: logs, error: errL } = await supabase.from('arca_pdf_busqueda_log')
      .select('resultado, drive_url, lote_id, observaciones, fecha_hora, gmail_message_id, monto_pdf')
      .eq('factura_id', factura_id).order('fecha_hora', { ascending: false }).limit(200)
    if (errL) return NextResponse.json({ ok: false, error: errL.message }, { status: 500 })

    const candidato = (logs || []).find((l: any) => l.drive_url === drive_url && l.resultado === 'revisar')
    if (!candidato) return NextResponse.json({ ok: false, error: 'Ese archivo no figura como candidato de esta factura' }, { status: 412 })

    const quien = sesion.user.email || 'usuario'
    const texto = `No es ésta — descartado por ${quien}${motivo?.trim() ? `: ${motivo.trim()}` : ''}`
    const fila = {
      factura_id, factura_schema: schema, lote_id: candidato.lote_id ?? null,
      resultado: 'descartado', drive_url, gmail_message_id: candidato.gmail_message_id ?? null,
      observaciones: `${texto} · lo que había leído la app: ${String(candidato.observaciones || '').replace(/^\[carpeta\]\s*/, '')}`,
      cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`,
      monto_factura: f.imp_total, monto_pdf: candidato.monto_pdf ?? null,
    }
    const { error: errI } = await supabase.from('arca_pdf_busqueda_log').insert(fila)
    if (errI) return NextResponse.json({ ok: false, error: `No se pudo registrar el descarte: ${errI.message}` }, { status: 500 })

    // ¿Queda algún candidato? (el renglón nuevo va primero, como si viniera del log)
    const quedan = candidatosDelLog([{ ...fila, fecha_hora: new Date().toISOString() }, ...(logs || [])])
    let fc_nuevo: string | undefined
    if (quedan.length === 0 && f.fc === 'VER' && !f.pdf_drive_url) {
      const { error: errU } = await supabase.schema(schema).from('comprobantes_arca').update({
        fc: 'NO Mail', pdf_estado: 'no_encontrado', pdf_observaciones: texto,
      }).eq('id', factura_id).eq('fc', 'VER').is('pdf_drive_url', null)
      if (errU) return NextResponse.json({ ok: false, error: `Se registró el descarte, pero la factura sigue en VER: ${errU.message}` }, { status: 500 })
      fc_nuevo = 'NO Mail'
    }
    return NextResponse.json({ ok: true, quedan: quedan.length, fc_nuevo })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
