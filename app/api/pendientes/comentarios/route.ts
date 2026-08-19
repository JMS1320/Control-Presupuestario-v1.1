/**
 * Comentarios del usuario sobre un pendiente (P-46 · segunda mitad).
 *
 *   GET  /api/pendientes/comentarios?rol=admin        → todos, para pintarlos en el panel
 *   POST /api/pendientes/comentarios                  → { pendiente_id, texto, estado_usuario?, pantalla? }
 *
 * 🔒 El `.md` es de Claude, esta tabla es del usuario. La app **no puede escribir el `.md`**
 * (Vercel tiene filesystem de sólo lectura), así que el comentario vive en BD y el `pendiente_id`
 * los une. Ver `PENDIENTES.md` § P-46.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const ESTADOS = ['terminado', 'chequeado', 'revisar', 'descartar'] as const

export async function GET(request: Request) {
  const rol = new URL(request.url).searchParams.get('rol')
  if (rol !== 'admin') return NextResponse.json({ error: 'Sólo admin' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('pendientes_comentarios')
    .select('id, pendiente_id, texto, estado_usuario, autor, created_at, leido_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comentarios: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const b = await request.json()
    const pendiente_id = String(b.pendiente_id ?? '').trim()
    const texto = String(b.texto ?? '').trim()

    if (!pendiente_id) return NextResponse.json({ error: 'Falta pendiente_id' }, { status: 400 })
    if (!texto) return NextResponse.json({ error: 'El comentario está vacío' }, { status: 400 })
    if (b.estado_usuario && !ESTADOS.includes(b.estado_usuario)) {
      return NextResponse.json({ error: `estado_usuario debe ser uno de: ${ESTADOS.join(', ')}` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('pendientes_comentarios')
      .insert({
        pendiente_id,
        texto,
        estado_usuario: b.estado_usuario ?? null,
        pantalla: b.pantalla ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, comentario: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
