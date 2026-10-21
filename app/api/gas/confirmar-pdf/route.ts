/**
 * POST /api/gas/confirmar-pdf  (Confirmar VER)
 * El usuario confirma que el PDF candidato (en _Revisar) ES esa factura. Le pide al GAS que lo
 * mueva a la carpeta del mes + lo renombre, y marca la factura como **Confirmada** + guarda el link.
 * El candidato sale del log (arca_pdf_busqueda_log). Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_*.
 *
 * A-FEAT-1287 (2026-10-20):
 * - **Confirmada**, no «Sí»: «Sí» es de Ulises (la tiene), y la aprobación del usuario no puede
 *   confundirse con la suya.
 * - Con varios candidatos, el usuario elige: llega `drive_url` y se confirma ESE. Sin `drive_url`, el
 *   último del log (como antes).
 * - Un candidato que ya estaba en la CARPETA del mes (log con «[carpeta]») no se mueve ni se
 *   renombra: es el archivo que subió alguien, se vincula tal cual.
 */
import { NextResponse } from 'next/server'
import { clienteUsuario } from "@/lib/supabase-usuario"
import type { Empresa } from '@/lib/gas-pdf/types'
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { periodoDeArchivo, subcarpetasDelMes } from '@/lib/facturas/vincular-archivo'

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

// Archivo por PERÍODO CONTABLE (no emisión); si no está imputada, emisión como provisional.
// La regla vive en `lib/facturas/vincular-archivo.ts`: el Cash Flow busca en la misma carpeta.
const periodoArchivo = (factura: any) => periodoDeArchivo(factura)

export async function POST(request: Request) {
  // Cliente de la SESIÓN, no service_role: así la RLS también gobierna esta ruta (A-SEC-01).
  const supabase = await clienteUsuario()

  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }

    const { factura_id, empresa, drive_url: elegido } = (await request.json()) as { factura_id: string; empresa: Empresa; drive_url?: string }
    if (!factura_id || !empresa) {
      return NextResponse.json({ ok: false, error: 'Faltan factura_id / empresa' }, { status: 400 })
    }
    const carpeta = carpetaDe(empresa)
    if (!carpeta) {
      return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    }
    const schema = schemaDe(empresa)

    // Factura (datos para renombrar + carpeta)
    const { data: f, error: errF } = await supabase
      .schema(schema)
      .from('comprobantes_arca')
      .select('*')  // '*' evita el ParserError de supabase-js con la columna `año_contable` (ñ); trae año_contable/mes_contable para el período de archivo
      .eq('id', factura_id)
      .maybeSingle()
    if (errF || !f) {
      return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    // Candidato en el log (último con drive_url). gmail_message_id permite etiquetar el mail al confirmar.
    let q = supabase
      .from('arca_pdf_busqueda_log')
      .select('drive_url, gmail_message_id, observaciones')
      .eq('factura_id', factura_id)
      .not('drive_url', 'is', null)
      .neq('resultado', 'descartado')   // el renglón de «No es ésta» también lleva el link
    if (elegido) q = q.eq('drive_url', elegido)
    const { data: log } = await q
      .order('fecha_hora', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!log?.drive_url) {
      return NextResponse.json({ ok: false, error: 'No hay un PDF candidato en el log para confirmar' }, { status: 412 })
    }

    // Ya estaba en la carpeta: se vincula tal cual, sin pasar por el GAS.
    if (String(log.observaciones || '').startsWith('[carpeta]')) {
      const { error: errU } = await supabase.schema(schema).from('comprobantes_arca')
        .update({
          fc: 'Confirmada', pdf_drive_url: log.drive_url, pdf_estado: 'descargado',
          pdf_observaciones: 'Confirmada por el usuario — archivo que ya estaba en la carpeta',
        })
        .eq('id', factura_id)
      if (errU) return NextResponse.json({ ok: false, error: errU.message }, { status: 500 })
      return NextResponse.json({ ok: true, drive_url: log.drive_url, mail_etiquetado: false, de_carpeta: true })
    }

    // GAS: mover de _Revisar a la carpeta del mes + renombrar + (si hay message id) etiquetar el mail
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        _token: token, accion: 'confirmar', file_url: log.drive_url,
        gmail_message_id: log.gmail_message_id ?? undefined,
        carpeta_drive_id: carpeta, subcarpetas: (() => { const { anio, mes } = periodoArchivo(f); return subcarpetasDelMes(empresa, anio, mes) })(),
        cuit_emisor: f.cuit, punto_venta: f.punto_venta, numero_desde: f.numero_desde,
        tipo_comprobante_desc: f.tipo_comprobante_desc || 'Factura A',
        fecha_emision: f.fecha_emision, denominacion_emisor: f.denominacion_emisor || '',
      }),
    })
    const gas = (await r.json()) as { status?: string; drive_url?: string; observaciones?: string; mail_etiquetado?: boolean }
    if (gas.status !== 'ok') {
      return NextResponse.json({ ok: false, error: gas.observaciones || 'El GAS no pudo mover el archivo' }, { status: 502 })
    }

    // Confirmada → FC = Confirmada + link (ahora sí, porque está confirmada)
    await supabase.schema(schema).from('comprobantes_arca')
      .update({
        fc: 'Confirmada',
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
