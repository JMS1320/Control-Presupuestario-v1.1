/**
 * POST /api/gas/descartar-pdf — 🗑️ A-FEAT-1619 (JMS 11/11: «poder borrar el archivo con un por qué. Sólo para JMS»).
 * Saca un PDF sin factura de la carpeta del mes MOVIÉNDOLO a «_descartados» vía el GAS (acción 'descartar_archivo',
 * v0.26.0). Nunca borra: borrar en el Drive está prohibido por regla. Sólo admin.
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN.
 */
import { NextResponse } from 'next/server'
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  if (sesion.rol !== 'admin') return NextResponse.json({ ok: false, error: 'Sólo el admin puede sacar archivos de la carpeta' }, { status: 403 })

  try {
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
    const { file_url, motivo } = (await request.json()) as { file_url?: string; motivo?: string }
    if (!file_url || !motivo?.trim()) return NextResponse.json({ ok: false, error: 'Faltan el archivo o el motivo' }, { status: 400 })
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _token: token, accion: 'descartar_archivo', file_url, motivo: motivo.trim(), por: sesion.user.email ?? '' }),
    })
    const gas = (await r.json()) as { status?: string; drive_url?: string; observaciones?: string; ya_estaba?: boolean }
    if (gas.status !== 'ok') {
      const viejo = /accion|acción/i.test(gas.observaciones || '') ? ' (¿falta publicar el GAS 0.26.0?)' : ''
      return NextResponse.json({ ok: false, error: (gas.observaciones || 'El GAS no pudo mover el archivo') + viejo }, { status: 502 })
    }
    return NextResponse.json({ ok: true, drive_url: gas.drive_url, ya_estaba: !!gas.ya_estaba })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error moviendo el archivo' }, { status: 502 })
  }
}
