/**
 * Pendientes propuestos por el usuario desde la app (P-46 · tercera parte).
 *
 *   GET  /api/pendientes/propuestos?rol=admin   → los propuestos (los incorporados/descartados no)
 *   POST /api/pendientes/propuestos             → { titulo, descripcion?, prioridad_sugerida?, pantalla_sugerida? }
 *
 * 🔒 Es una **bandeja de entrada**, no una fuente. La app no puede escribir `PENDIENTES.md`
 * (Vercel tiene filesystem de sólo lectura), y aunque pudiera no debería: un pendiente necesita
 * ID, sección, dossier y marca de pantalla. Claude lo incorpora y marca `estado='incorporado'`
 * con el `pendiente_id_asignado`, que deja el rastro de en qué se convirtió.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { PANTALLAS } from '@/lib/pendientes/parse'

export const runtime = 'nodejs'

const PRIORIDADES = ['urgente', 'secundario', 'test'] as const

export async function GET(request: Request) {
  const rol = new URL(request.url).searchParams.get('rol')
  if (rol !== 'admin') return NextResponse.json({ error: 'Sólo admin' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('pendientes_propuestos')
    .select('id, titulo, descripcion, prioridad_sugerida, pantalla_sugerida, estado, pendiente_id_asignado, created_at')
    .eq('estado', 'propuesto')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ propuestos: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    const titulo = String(b.titulo ?? '').trim()
    if (!titulo) return NextResponse.json({ error: 'Falta el título' }, { status: 400 })

    if (b.prioridad_sugerida && !PRIORIDADES.includes(b.prioridad_sugerida)) {
      return NextResponse.json({ error: `prioridad debe ser: ${PRIORIDADES.join(', ')}` }, { status: 400 })
    }
    // La pantalla se valida contra la MISMA lista que usa el parser: si acá entrara una inventada,
    // al incorporarlo al .md el control la rechazaría y el pendiente quedaría sin ubicar.
    if (b.pantalla_sugerida && !(PANTALLAS as readonly string[]).includes(b.pantalla_sugerida)) {
      return NextResponse.json({ error: `pantalla debe ser una de: ${PANTALLAS.join(', ')}` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('pendientes_propuestos')
      .insert({
        titulo,
        descripcion: b.descripcion?.trim() || null,
        prioridad_sugerida: b.prioridad_sugerida ?? null,
        pantalla_sugerida: b.pantalla_sugerida ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, propuesto: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
