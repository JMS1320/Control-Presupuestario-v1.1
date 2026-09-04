/**
 * 🚩 Marcas «para revisar» — leer y resolver, DEL LADO DEL SERVIDOR.
 *
 * Mismo criterio que `/api/notas` (A-SEC-04): `anon` puede **insertar** una marca (para que dejarla
 * sea instantáneo desde cualquier pantalla) pero **no puede leerlas ni modificarlas**. La lista y el
 * cierre pasan por acá, donde la `SERVICE_ROLE_KEY` nunca sale del servidor.
 *
 * ⚠️ Esto NO reemplaza a A-SEC-03 (usuarios de verdad): mientras todos entren como `anon`, este
 * endpoint tampoco sabe *quién* pregunta. Lo que sí evita es que la puerta abierta dé a la tabla.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/** GET /api/revisiones → las abiertas, más recientes primero. `?todas=1` trae también las cerradas. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const todas = searchParams.get('todas') === '1'

    let q = supabaseAdmin
      .from('revisiones')
      .select('id, schema_ref, tabla_ref, registro_id, descripcion_ref, motivo, tipo, pantalla, estado, creado_por, asignado_a, seguimiento, resolucion, resuelto_por, resuelto_at, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (!todas) q = q.eq('estado', 'abierta')

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true, revisiones: data ?? [] })
  } catch (e) {
    // Que falle la lista no puede romper la pantalla principal.
    return NextResponse.json({ ok: false, revisiones: [], error: (e as Error).message }, { status: 500 })
  }
}

/**
 * PATCH /api/revisiones → cerrar una marca.
 *
 * `resolucion` es **obligatoria**: sin ella, "resuelta" termina reemplazando a "corregida", que no
 * es lo mismo. Es la § «todo desarrollo termina con su control» aplicada al cierre.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string; estado?: string; resolucion?: string; resuelto_por?: string
      seguimiento?: string; autor?: string
    }
    if (!body.id) {
      return NextResponse.json({ ok: false, error: 'Falta el id de la marca' }, { status: 400 })
    }

    /**
     * Agregar al seguimiento — la marca crece mientras se entiende el problema.
     *
     * Se **agrega**, nunca se pisa: `motivo` queda como la sospecha inicial, que a veces resulta
     * equivocada, y saber que uno se equivocó al mirar también sirve. Se lee y se reescribe el
     * array completo porque son unas pocas entradas por marca; una marca con 500 seguimientos es
     * un problema distinto y peor.
     */
    if (typeof body.seguimiento === 'string') {
      const texto = body.seguimiento.trim()
      if (!texto) {
        return NextResponse.json({ ok: false, error: 'Escribí algo antes de agregarlo' }, { status: 400 })
      }
      const { data: actual, error: eLeer } = await supabaseAdmin
        .from('revisiones').select('seguimiento').eq('id', body.id).single()
      if (eLeer) throw eLeer

      const previo = Array.isArray(actual?.seguimiento) ? actual.seguimiento : []
      const { error } = await supabaseAdmin
        .from('revisiones')
        .update({ seguimiento: [...previo, { fecha: new Date().toISOString(), texto, autor: body.autor || null }] })
        .eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    const estado = body.estado === 'descartada' ? 'descartada' : 'resuelta'
    const resolucion = (body.resolucion || '').trim()
    if (!resolucion) {
      return NextResponse.json(
        { ok: false, error: 'Escribí qué se hizo antes de cerrarla — sin eso, "resuelta" no dice nada.' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin
      .from('revisiones')
      .update({
        estado,
        resolucion,
        resuelto_por: body.resuelto_por || null,
        resuelto_at: new Date().toISOString(),
      })
      .eq('id', body.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
