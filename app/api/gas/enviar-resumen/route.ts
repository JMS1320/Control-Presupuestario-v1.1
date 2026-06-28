/**
 * POST /api/gas/enviar-resumen
 * Recibe los resultados de un lote de búsqueda de FC y los manda al GAS (acción 'resumen')
 * para que el GAS envíe UN mail resumen a sanmanuel (descargadas + a revisar, con cuerpos).
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN.
 */
import { NextResponse } from 'next/server'
import type { ResumenItem } from '@/lib/gas-pdf/types'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }

    const body = (await request.json()) as { resultados?: ResumenItem[]; destinatario?: string; totales?: unknown; debug?: unknown }
    const resultados = Array.isArray(body.resultados) ? body.resultados : []
    if (resultados.length === 0 && !body.totales && !body.debug) {
      return NextResponse.json({ ok: true, enviado: false, observaciones: 'Sin items, totales ni debug, no se envía resumen.' })
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // destinatario omitido → el GAS lo manda al usuario activo (sanmanuel.sp, que es quien corre el GAS)
      body: JSON.stringify({ _token: token, accion: 'resumen', resultados, totales: body.totales, debug: body.debug, destinatario: body.destinatario }),
    })
    const data = (await r.json()) as { status?: string; observaciones?: string }
    return NextResponse.json({ ok: data.status === 'ok', enviado: data.status === 'ok', observaciones: data.observaciones })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error enviando resumen' }, { status: 502 })
  }
}
