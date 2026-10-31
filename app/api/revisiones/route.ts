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
import { supabaseAdmin, faltaConfiguracionAdmin } from '@/lib/supabase-admin'
import { createClientServer } from '@/lib/supabase-server'
import { etiquetaPersona } from '@/lib/auth/identidad'
import { estadoAlCerrar } from '@/lib/revisiones/para-vos'

export const runtime = 'nodejs'

/** GET /api/revisiones → las abiertas, más recientes primero. `?todas=1` trae también las cerradas. */
export async function GET(request: Request) {
  // Sin la clave de servidor no hay plan B: `anon` no tiene permisos sobre `revisiones`. Se dice
  // QUÉ falta en vez de devolver una lista vacía que se lee como «no hay nada para revisar».
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, revisiones: [], error: falta }, { status: 500 })

  try {
    const { searchParams } = new URL(request.url)
    const todas = searchParams.get('todas') === '1'

    /**
     * 🔔 `?mias=1` — la campanita (A-FEAT-1364): sólo las marcas CON destinatario que son para mí o
     * que mandé yo. Quién soy sale de la SESIÓN, nunca del pedido: así nadie pide las de otro.
     */
    if (searchParams.get('mias') === '1') {
      const { data: s } = await (await createClientServer()).auth.getUser()
      if (!s.user) return NextResponse.json({ ok: false, revisiones: [], error: 'Sin sesión' }, { status: 401 })
      const yo = { mail: s.user.email ?? null, etiqueta: etiquetaPersona(s.user) }
      const { data, error } = await supabaseAdmin
        .from('revisiones')
        .select('id, schema_ref, tabla_ref, registro_id, descripcion_ref, motivo, pantalla, subpantalla, estado, creado_por, asignado_a, seguimiento, created_at, es_tarea, tarea_hasta, origen, senales, confirma, cierre_auto, resolucion')
        // A-FEAT-1449: también las que esperan que alguien confirme el cierre
        .in('estado', ['abierta', 'por_confirmar'])
        .not('asignado_a', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const n = (x: string | null | undefined) => (x ?? '').trim().toLowerCase()
      const mias = (data ?? []).filter((r) =>
        (n(r.asignado_a) === n(yo.mail) && !!n(yo.mail)) || (!!n(r.confirma) && n(r.confirma) === n(yo.mail))
        || (!!n(r.creado_por) && (n(r.creado_por) === n(yo.mail) || n(r.creado_por) === n(yo.etiqueta))))
      return NextResponse.json({ ok: true, revisiones: mias, yo })
    }

    let q = supabaseAdmin
      .from('revisiones')
      .select('id, schema_ref, tabla_ref, registro_id, descripcion_ref, motivo, tipo, pantalla, estado, creado_por, asignado_a, seguimiento, resolucion, resuelto_por, resuelto_at, created_at, confirma')
      .order('created_at', { ascending: false })
      .limit(200)
    // A-FEAT-1449: las que esperan confirmación siguen abiertas para todos los fines (no están resueltas)
    if (!todas) q = q.in('estado', ['abierta', 'por_confirmar'])

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
      /** A-FEAT-1449: quien confirma acepta el cierre, o lo devuelve con un mensaje */
      confirmar?: boolean; devolver?: boolean
    }
    if (!body.id) {
      return NextResponse.json({ ok: false, error: 'Falta el id de la marca' }, { status: 400 })
    }

    /**
     * QUIÉN escribe sale de la SESIÓN, no del cuerpo del pedido (A-BUG-1327). Antes lo mandaba la
     * pantalla, sacado de la URL, y desde el login real llegaba vacío. Lo del cuerpo queda sólo
     * como respaldo si no hubiera sesión legible.
     */
    let quien: string | null = null
    let miMail: string | null = null
    try {
      const { data } = await (await createClientServer()).auth.getUser()
      quien = etiquetaPersona(data.user)
      miMail = data.user?.email ?? null
    } catch { /* sin sesión legible: se usa lo que vino */ }

    /**
     * ✔ / ↩ A-FEAT-1449 — confirmar o devolver un cierre. Sólo lo hace quien figura en `confirma` (sale de la sesión).
     * Devolver vuelve la tarea a 'abierta' y deja el motivo en el hilo.
     */
    if (body.confirmar || body.devolver) {
      const { data: t, error: eT } = await supabaseAdmin.from('revisiones').select('estado, confirma, seguimiento, tipo, schema_ref, tabla_ref, registro_id').eq('id', body.id).single()
      if (eT) throw eT
      const n = (x: string | null | undefined) => (x ?? '').trim().toLowerCase()
      if (!n(t?.confirma) || n(t?.confirma) !== n(miMail)) {
        return NextResponse.json({ ok: false, error: 'Esta tarea la confirma otra persona.' }, { status: 403 })
      }
      if (t?.estado !== 'por_confirmar') return NextResponse.json({ ok: false, error: 'La tarea no está esperando confirmación.' }, { status: 400 })
      if (body.confirmar) {
        /**
         * 🚫 A-FEAT-1451: si lo que se confirma es «esta factura no se consigue», la factura queda marcada y sale de
         * faltantes. Primero la factura y después la tarea: si la factura falla, la tarea sigue esperando (no queda
         * «confirmada» algo que no se hizo).
         */
        if (t?.tipo === 'sin_pdf' && t?.tabla_ref === 'comprobantes_arca' && ['msa', 'pam', 'ma'].includes(String(t?.schema_ref)) && t?.registro_id) {
          const { error: eF } = await supabaseAdmin.schema(String(t.schema_ref)).from('comprobantes_arca')
            .update({ fc: 'No se consigue' }).eq('id', t.registro_id).is('pdf_drive_url', null)
          if (eF) throw eF
        }
        const { error } = await supabaseAdmin.from('revisiones')
          .update({ estado: 'resuelta', resuelto_por: quien, resuelto_at: new Date().toISOString() }).eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      const texto = (body.seguimiento ?? '').trim()
      if (!texto) return NextResponse.json({ ok: false, error: 'Escribí por qué la devolvés' }, { status: 400 })
      const previo = Array.isArray(t?.seguimiento) ? t.seguimiento : []
      const { error } = await supabaseAdmin.from('revisiones').update({
        estado: 'abierta', resolucion: null,
        seguimiento: [...previo, { fecha: new Date().toISOString(), texto: `↩ Devuelta: ${texto}`, autor: quien }],
      }).eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
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
        .update({ seguimiento: [...previo, { fecha: new Date().toISOString(), texto, autor: quien ?? body.autor ?? null }] })
        .eq('id', body.id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }
    // A-FEAT-1449: si la tarea pide que OTRO confirme el cierre, «Listo» la deja 'por_confirmar'
    const { data: actualT } = await supabaseAdmin.from('revisiones').select('confirma').eq('id', body.id).single()
    const estado = body.estado === 'descartada' ? 'descartada' : estadoAlCerrar(actualT ?? {}, miMail)
    const resolucion = (body.resolucion || '').trim()
    if (!resolucion) {
      return NextResponse.json(
        { ok: false, error: 'Escribí qué se hizo antes de cerrarla — sin eso, "resuelta" no dice nada.' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin
      .from('revisiones')
      .update(estado === 'por_confirmar'
        ? { estado, resolucion }   // todavía no está resuelta: espera la confirmación
        : {
          estado,
          resolucion,
          resuelto_por: quien ?? body.resuelto_por ?? null,
          resuelto_at: new Date().toISOString(),
        })
      .eq('id', body.id)
    if (error) throw error

    return NextResponse.json({ ok: true, estado })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
