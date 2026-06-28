/**
 * POST /api/gas/renombrar-pdf
 * Renombra un archivo de Drive (huérfano mal nombrado) vía el GAS (acción 'renombrar').
 * No mueve ni toca carpetas: solo cambia el nombre del archivo por su id.
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    }

    const { file_url, nombre } = (await request.json()) as { file_url?: string; nombre?: string }
    if (!file_url || !nombre || !nombre.trim()) {
      return NextResponse.json({ ok: false, error: 'Faltan file_url / nombre' }, { status: 400 })
    }

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _token: token, accion: 'renombrar', file_url, nombre: nombre.trim() }),
    })
    const gas = (await r.json()) as { status?: string; nombre?: string; drive_url?: string; observaciones?: string }
    if (gas.status !== 'ok') {
      return NextResponse.json({ ok: false, error: gas.observaciones || 'El GAS no pudo renombrar' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, nombre: gas.nombre, drive_url: gas.drive_url })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error renombrando' }, { status: 502 })
  }
}
