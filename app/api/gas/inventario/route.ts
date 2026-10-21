/**
 * POST /api/gas/inventario — el INVENTARIO de los reenvíos (A-FEAT-1287, acordado 2026-10-20).
 *
 * Los reenvíos de Jose y Andrés —y cualquier mail con «factura / FC / fac» en el asunto— se leen
 * UNA vez y lo que dice cada adjunto queda en `arca_pdf_inventario`. Las facturas se cruzan contra
 * eso sin volver a leer. Cada acción es chica para entrar en el minuto; el que encadena es
 * `lib/gas-pdf/barrido.ts`.
 *
 *   estado         fuentes con lo ya leído (bloques de días) + cuántos adjuntos hay y cuántos ilegibles
 *   listar         qué adjuntos hay en un tramo de días de una fuente, sin los que ya están en el inventario
 *   leer           lee esos adjuntos (OCR) y los guarda en el inventario
 *   tramo          registra que un tramo de días de una fuente se leyó entero
 *   cruzar         facturas contra el inventario (regla de 5 datos en el GAS) → vincula o deja a revisar
 *   no_encontradas las que no aparecieron después de leer todo: historial y, si se pide, NO Mail
 */
import { NextResponse } from 'next/server'
import { clienteUsuario } from '@/lib/supabase-usuario'
import { exigirSesion, respuestaSinAcceso } from '@/lib/auth/guard-sesion'
import type { Empresa } from '@/lib/gas-pdf/types'
import { pedirAlGas } from '@/lib/gas-pdf/gas-http'
import { FUENTE_ASUNTO, decidirDesdeInventario, nombreReenviador, bloquesLeidos, type EvaluacionInventario, type FuenteMails } from '@/lib/gas-pdf/barrido'
import { FC_QUE_NO_SE_BUSCAN, fcAlVincularDesdeCarpeta } from '@/lib/gas-pdf/lote'
import { periodoDeArchivo, subcarpetasDelMes } from '@/lib/facturas/vincular-archivo'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Tope para cada llamada al GAS, debajo de maxDuration */
const TOPE_GAS_MS = 45_000
/** Cruzar: después de este tiempo no se empieza a guardar otro archivo; lo que falta vuelve como «sin terminar» */
const PRESUPUESTO_CRUCE_MS = 38_000
/** Menos que esto, el adjunto no se pudo leer (foto borrosa, escaneo vacío) */
const MIN_CHARS_LEGIBLE = 40
/** Lo que se deja en el historial de búsquedas para lo que viene de un reenvío */
const PREFIJO_REENVIO = '[reenvío]'

const schemaDe = (e: Empresa) => (e === 'PAM' ? 'pam' : e === 'MA' ? 'ma' : 'msa')
function carpetaDe(e: Empresa): string | undefined {
  return e === 'PAM' ? process.env.GAS_FOLDER_ID_PAM : e === 'MA' ? process.env.GAS_FOLDER_ID_MA : process.env.GAS_FOLDER_ID_MSA
}
const fechaCorta = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')

async function fuentes(supabase: any): Promise<FuenteMails[]> {
  const { data } = await supabase.from('proveedores').select('email_facturacion, patron_asunto').contains('tags', ['recolector'])
  const rec = (data || [])
    .filter((r: any) => r.email_facturacion && r.patron_asunto)
    .map((r: any) => ({ clave: r.email_facturacion, email: r.email_facturacion, asunto: r.patron_asunto, nombre: `Reenvíos de ${nombreReenviador(r.email_facturacion)}` }))
  return [...rec, FUENTE_ASUNTO]
}

export async function POST(request: Request) {
  const supabase = await clienteUsuario()
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  const quien = sesion.user.email || null

  try {
    const body = await request.json() as Record<string, any>
    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })

    // ── estado ──
    if (body.accion === 'estado') {
      const fs = await fuentes(supabase)
      const { data: tramos, error } = await supabase.from('arca_pdf_barrido_tramo').select('recolector, desde, hasta')
      if (error) return NextResponse.json({ ok: false, error: `No se pudo leer el inventario (¿se corrió el script 90?): ${error.message}` }, { status: 500 })
      const { count: adjuntos } = await supabase.from('arca_pdf_inventario').select('id', { count: 'exact', head: true }).in('estado', ['leido', 'ilegible', 'copia'])
      const { count: ilegibles } = await supabase.from('arca_pdf_inventario').select('id', { count: 'exact', head: true }).eq('estado', 'ilegible')
      const { data: ilegiblesLista } = await supabase.from('arca_pdf_inventario')
        .select('gmail_message_id, nombre_archivo, fecha_mail, recolector, chars').eq('estado', 'ilegible')
        .order('fecha_mail', { ascending: false }).limit(30)
      return NextResponse.json({
        ok: true,
        reenviadores: fs.map(f => ({ ...f, bloques: bloquesLeidos((tramos || []).filter((t: any) => t.recolector === f.clave)) })),
        adjuntos: adjuntos ?? 0, ilegibles: ilegibles ?? 0, ilegiblesLista: ilegiblesLista || [],
      })
    }

    // ── listar ──
    if (body.accion === 'listar') {
      const f = (await fuentes(supabase)).find(x => x.clave === body.fuente)
      if (!f || !body.desde || !body.hasta) return NextResponse.json({ ok: false, error: 'Falta la fuente o el tramo' }, { status: 400 })
      const g = await pedirAlGas(url, { _token: token, accion: 'inventario_listar', recolector: { email: f.email, asunto: f.asunto }, desde: body.desde, hasta: body.hasta, presupuesto_ms: 35_000 }, 'listar mails', TOPE_GAS_MS)
      if (g.status !== 'ok') return NextResponse.json({ ok: false, error: g.observaciones || 'El GAS no pudo listar' }, { status: 502 })
      if (g.incompleto) return NextResponse.json({ ok: true, incompleto: true })
      const mensajes = (g.mensajes || []) as Array<{ message_id: string; fecha: string; remitente: string; asunto: string; adjuntos: Array<{ idx: number; nombre: string; tamano: number; hash: string }> }>
      const ids = mensajes.map(m => m.message_id)
      // Lo ya leído (o ya reconocido como copia) no se vuelve a leer. Los 'error' sí: se reintentan.
      const conocidos = new Set<string>()
      for (let i = 0; i < ids.length; i += 100) {
        const { data } = await supabase.from('arca_pdf_inventario').select('gmail_message_id, adjunto_idx')
          .in('gmail_message_id', ids.slice(i, i + 100)).in('estado', ['leido', 'ilegible', 'copia'])
        for (const r of data || []) conocidos.add(`${r.gmail_message_id}|${r.adjunto_idx}`)
      }
      const nuevos = mensajes.flatMap(m => m.adjuntos.map(a => ({ m, a }))).filter(x => !conocidos.has(`${x.m.message_id}|${x.a.idx}`))
      // El mismo PDF reenviado otra vez (mismo hash) no se lee: queda como copia del ya leído
      const hashes = [...new Set(nuevos.map(x => x.a.hash).filter(Boolean))]
      const hashLeido = new Set<string>()
      for (let i = 0; i < hashes.length; i += 100) {
        const { data } = await supabase.from('arca_pdf_inventario').select('hash').in('hash', hashes.slice(i, i + 100)).in('estado', ['leido', 'ilegible'])
        for (const r of data || []) hashLeido.add(r.hash)
      }
      const copias = nuevos.filter(x => x.a.hash && hashLeido.has(x.a.hash))
      if (copias.length > 0) {
        const { error } = await supabase.from('arca_pdf_inventario').upsert(copias.map(x => ({
          gmail_message_id: x.m.message_id, adjunto_idx: x.a.idx, hash: x.a.hash, nombre_archivo: x.a.nombre, tamano: x.a.tamano,
          remitente: x.m.remitente, asunto: x.m.asunto, fecha_mail: x.m.fecha, recolector: f.clave, estado: 'copia',
          observaciones: 'El mismo archivo ya estaba leído (otro mail)', leido_por: quien,
        })), { onConflict: 'gmail_message_id,adjunto_idx' })
        if (error) return NextResponse.json({ ok: false, error: `No se pudo guardar en el inventario: ${error.message}` }, { status: 500 })
      }
      const aLeer = nuevos.filter(x => !(x.a.hash && hashLeido.has(x.a.hash))).map(x => ({ message_id: x.m.message_id, idx: x.a.idx }))
      return NextResponse.json({ ok: true, a_leer: aLeer, mensajes: mensajes.length, adjuntos: mensajes.reduce((s, m) => s + m.adjuntos.length, 0), copias: copias.length })
    }

    // ── leer ──
    if (body.accion === 'leer') {
      const items = Array.isArray(body.items) ? body.items.slice(0, 8) : []
      if (!body.fuente || items.length === 0) return NextResponse.json({ ok: false, error: 'Falta la fuente o los adjuntos' }, { status: 400 })
      const g = await pedirAlGas(url, { _token: token, accion: 'inventario_leer', items, presupuesto_ms: 38_000 }, 'leer adjuntos', TOPE_GAS_MS)
      if (g.status !== 'ok') return NextResponse.json({ ok: false, error: g.observaciones || 'El GAS no pudo leer' }, { status: 502 })
      const filas = (g.leidos || []).map((r: any) => {
        const texto: string | null = r.error ? null : String(r.texto || '')
        const estado = r.error ? 'error' : (texto!.length < MIN_CHARS_LEGIBLE ? 'ilegible' : 'leido')
        return {
          gmail_message_id: r.message_id, adjunto_idx: r.idx, hash: r.hash || null, nombre_archivo: r.nombre || null, tamano: r.tamano ?? null,
          remitente: r.remitente || null, asunto: r.asunto || null, fecha_mail: r.fecha || null, recolector: body.fuente,
          estado, chars: texto?.length ?? null, texto, texto_digitos: texto ? texto.replace(/\D/g, '') : null,
          observaciones: r.error ? `No se pudo leer: ${r.error}` : estado === 'ilegible' ? `Se leyeron sólo ${texto!.length} caracteres` : null,
          leido_at: new Date().toISOString(), leido_por: quien,
        }
      })
      let inventarioIds: string[] = []
      if (filas.length > 0) {
        const { data, error } = await supabase.from('arca_pdf_inventario').upsert(filas, { onConflict: 'gmail_message_id,adjunto_idx' }).select('id, estado')
        if (error) return NextResponse.json({ ok: false, error: `No se pudo guardar en el inventario: ${error.message}` }, { status: 500 })
        inventarioIds = (data || []).filter((r: any) => r.estado === 'leido').map((r: any) => r.id)
      }
      return NextResponse.json({
        ok: true, inventario_ids: inventarioIds, pendientes: g.pendientes || [],
        errores: filas.filter((f: any) => f.estado === 'error').length, ilegibles: filas.filter((f: any) => f.estado === 'ilegible').length,
      })
    }

    // ── tramo ──
    if (body.accion === 'tramo') {
      if (!body.fuente || !body.desde || !body.hasta) return NextResponse.json({ ok: false, error: 'Falta la fuente o el tramo' }, { status: 400 })
      const { error } = await supabase.from('arca_pdf_barrido_tramo').insert({
        recolector: body.fuente, desde: body.desde, hasta: body.hasta, mails: body.mails ?? null, adjuntos: body.adjuntos ?? null, hecho_por: quien,
      })
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    // ── cruzar ──
    if (body.accion === 'cruzar') {
      const t0 = Date.now()
      const empresa = body.empresa as Empresa
      if (!['MSA', 'PAM', 'MA'].includes(empresa)) return NextResponse.json({ ok: false, error: 'empresa inválida' }, { status: 400 })
      const schema = schemaDe(empresa)
      const ids: string[] = Array.isArray(body.factura_ids) ? body.factura_ids.slice(0, 50) : []
      const soloIds: string[] | null = Array.isArray(body.inventario_ids) ? body.inventario_ids : null
      if (ids.length === 0 || (soloIds && soloIds.length === 0)) return NextResponse.json({ ok: true, resueltas: [], sin_terminar: [] })
      const { data: facturas0, error: errF } = await supabase.schema(schema).from('comprobantes_arca').select('*').in('id', ids)
      if (errF) return NextResponse.json({ ok: false, error: errF.message }, { status: 500 })
      // Sólo las que siguen sin 📎 y en un estado que se busca
      const facturas = (facturas0 || []).filter((f: any) => !f.pdf_drive_url && !FC_QUE_NO_SE_BUSCAN.has(f.fc ?? '') && f.fc !== 'Confirmada' && f.fc !== 'APP')
      if (facturas.length === 0) return NextResponse.json({ ok: true, resueltas: [], sin_terminar: [] })
      const porId = new Map<string, any>(facturas.map((f: any) => [f.id, f]))

      // Prefiltro barato: sólo los textos que tienen el CUIT del emisor (la regla igual lo exige)
      const cuits = [...new Set(facturas.map((f: any) => String(f.cuit || '').replace(/\D/g, '')).filter((c: string) => c.length === 11))]
      const textos = new Map<string, any>()
      for (const cuit of cuits) {
        let q = supabase.from('arca_pdf_inventario').select('id, hash, gmail_message_id, adjunto_idx, texto, fecha_mail, recolector, nombre_archivo, remitente')
          .eq('estado', 'leido').like('texto_digitos', `%${cuit}%`).limit(200)
        if (soloIds) q = q.in('id', soloIds)
        const { data, error } = await q
        if (error) return NextResponse.json({ ok: false, error: `No se pudo leer el inventario: ${error.message}` }, { status: 500 })
        for (const r of data || []) textos.set(r.id, r)
      }
      if (textos.size === 0) return NextResponse.json({ ok: true, resueltas: [], sin_terminar: [] })

      const ev = await pedirAlGas(url, {
        _token: token, accion: 'evaluar',
        textos: [...textos.values()].map(t => ({ id: t.id, texto: t.texto })),
        facturas: facturas.map((f: any) => ({
          factura_id: f.id, cuit: f.cuit, punto_venta: f.punto_venta, numero_desde: f.numero_desde,
          imp_total: Number(f.imp_total), tipo: f.tipo_comprobante_desc || '', fecha_emision: f.fecha_emision,
        })),
      }, 'evaluar', TOPE_GAS_MS)
      if (ev.status !== 'ok') return NextResponse.json({ ok: false, error: ev.observaciones || 'El GAS no pudo evaluar' }, { status: 502 })
      const evaluaciones: EvaluacionInventario[] = (ev.evaluaciones || []).map((e: any) => {
        const t = textos.get(e.id)
        return { inventario_id: e.id, hash: t?.hash, gmail_message_id: t?.gmail_message_id, factura_id: e.factura_id, nivel: e.nivel, motivos: e.motivos || [], monto: e.monto ?? null }
      })
      if (evaluaciones.length === 0) return NextResponse.json({ ok: true, resueltas: [], sin_terminar: [] })

      // «No es ésta»: lo descartado por el usuario (por mail) no se vuelve a ofrecer
      const { data: descLog } = await supabase.from('arca_pdf_busqueda_log').select('factura_id, gmail_message_id')
        .eq('resultado', 'descartado').in('factura_id', facturas.map((f: any) => f.id))
      const descartados = new Map<string, Set<string>>()
      for (const l of descLog || []) {
        if (!l.gmail_message_id) continue
        if (!descartados.has(l.factura_id)) descartados.set(l.factura_id, new Set())
        descartados.get(l.factura_id)!.add(l.gmail_message_id)
      }
      const decisiones = decidirDesdeInventario(evaluaciones, descartados)

      const { data: provs } = await supabase.from('proveedores').select('cuit, carpeta_drive_id').in('cuit', [...new Set(facturas.map((f: any) => f.cuit))])
      const carpetaProv = new Map<string, string | null>((provs || []).map((p: any) => [p.cuit, p.carpeta_drive_id]))
      const ahora = new Date().toISOString()
      const resueltas: any[] = []
      const sinTerminar: string[] = []
      for (const d of decisiones) {
        if (Date.now() - t0 > PRESUPUESTO_CRUCE_MS) { sinTerminar.push(d.factura_id); continue }
        const f = porId.get(d.factura_id)
        if (!f) continue
        const carpeta = carpetaProv.get(f.cuit) || carpetaDe(empresa)
        if (!carpeta) return NextResponse.json({ ok: false, error: `Sin carpeta de Drive para ${empresa}` }, { status: 500 })
        const { anio, mes } = periodoDeArchivo(f)
        const datosNombre = {
          carpeta_drive_id: carpeta, subcarpetas: subcarpetasDelMes(empresa, anio, mes),
          cuit_emisor: f.cuit, punto_venta: f.punto_venta, numero_desde: f.numero_desde,
          tipo_comprobante_desc: f.tipo_comprobante_desc || 'Factura A', fecha_emision: f.fecha_emision,
          denominacion_emisor: f.denominacion_emisor || '',
        }
        const base = {
          factura_id: f.id, factura_schema: schema, lote_id: body.lote_id || null,
          cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`, monto_factura: f.imp_total,
        }
        const deDonde = (c: EvaluacionInventario) => {
          const t = textos.get(c.inventario_id)
          return `${t?.nombre_archivo || 'adjunto'} · mail del ${fechaCorta(t?.fecha_mail)} de ${t?.remitente || t?.recolector || '?'}`
        }
        const guardar = async (c: EvaluacionInventario, revisar: boolean) => {
          const t = textos.get(c.inventario_id)
          const g = await pedirAlGas(url, { _token: token, accion: 'guardar_adjunto', message_id: t.gmail_message_id, idx: t.adjunto_idx, revisar, ...datosNombre }, 'guardar adjunto', TOPE_GAS_MS)
          if (g.status !== 'ok' || !g.drive_url) throw new Error(g.observaciones || 'El GAS no pudo guardar el archivo')
          return g.drive_url as string
        }
        try {
          if (d.accion === 'vincular') {
            const c = d.candidatos[0]
            const driveUrl = await guardar(c, false)
            const { error } = await supabase.schema(schema).from('comprobantes_arca').update({
              fc: fcAlVincularDesdeCarpeta(f.fc), pdf_drive_url: driveUrl, pdf_estado: 'descargado',
              pdf_observaciones: `${d.motivo} (${deDonde(c)})`, pdf_ultimo_intento: ahora,
            }).eq('id', f.id).is('pdf_drive_url', null)
            if (error) throw new Error(error.message)
            await supabase.from('arca_pdf_busqueda_log').insert({ ...base, resultado: 'descargado', drive_url: driveUrl, gmail_message_id: c.gmail_message_id, monto_pdf: c.monto ?? null, observaciones: `${PREFIJO_REENVIO} ${d.motivo} — ${deDonde(c)}` })
            resueltas.push({ factura_id: f.id, accion: 'vincular', links: [{ url: driveUrl, rotulo: 'PDF' }], detalle: deDonde(c) })
          } else {
            const links: Array<{ url: string; rotulo: string }> = []
            for (const c of d.candidatos) {
              const driveUrl = await guardar(c, true)
              links.push({ url: driveUrl, rotulo: d.candidatos.length > 1 ? `candidato ${links.length + 1}` : 'candidato' })
              await supabase.from('arca_pdf_busqueda_log').insert({ ...base, resultado: 'revisar', drive_url: driveUrl, gmail_message_id: c.gmail_message_id, monto_pdf: c.monto ?? null,
                observaciones: `${PREFIJO_REENVIO} ${c.nivel === 'exacto' ? 'coinciden los cinco datos' : c.motivos.join(' · ')} — ${deDonde(c)}` })
            }
            const { error } = await supabase.schema(schema).from('comprobantes_arca').update({
              fc: 'VER', pdf_estado: 'revisar', pdf_observaciones: d.motivo, pdf_ultimo_intento: ahora,
            }).eq('id', f.id).is('pdf_drive_url', null)
            if (error) throw new Error(error.message)
            resueltas.push({ factura_id: f.id, accion: 'revisar', links, detalle: d.motivo })
          }
        } catch (e) {
          // Un archivo que no se pudo guardar no frena a los demás: esa factura queda como estaba
          await supabase.from('arca_pdf_busqueda_log').insert({ ...base, resultado: 'error', observaciones: `${PREFIJO_REENVIO} Se encontró en el inventario pero no se pudo guardar: ${(e as Error).message}` })
        }
      }
      return NextResponse.json({ ok: true, resueltas, sin_terminar: sinTerminar })
    }

    // ── no_encontradas ──
    if (body.accion === 'no_encontradas') {
      const empresa = body.empresa as Empresa
      if (!['MSA', 'PAM', 'MA'].includes(empresa)) return NextResponse.json({ ok: false, error: 'empresa inválida' }, { status: 400 })
      const schema = schemaDe(empresa)
      const ids: string[] = Array.isArray(body.factura_ids) ? body.factura_ids.slice(0, 50) : []
      if (ids.length === 0) return NextResponse.json({ ok: true, aplicadas: [] })
      const { data: fs, error } = await supabase.schema(schema).from('comprobantes_arca').select('id, fc, cuit, punto_venta, numero_desde, imp_total, pdf_drive_url').in('id', ids)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      // Mismo criterio que el «no encontrada» de la búsqueda por factura: no se toca lo que cambió mientras tanto
      const siguen = (fs || []).filter((f: any) => !f.pdf_drive_url && !['OK', 'Portal', 'No', 'Confirmada', 'APP', 'VER'].includes(f.fc))
      if (siguen.length > 0) {
        await supabase.from('arca_pdf_busqueda_log').insert(siguen.map((f: any) => ({
          factura_id: f.id, factura_schema: schema, lote_id: body.lote_id || null, resultado: 'no_encontrado',
          cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`, monto_factura: f.imp_total,
          observaciones: `${PREFIJO_REENVIO} ${body.detalle || 'No está en los reenvíos ni en los mails con factura en el asunto'}`,
        })))
      }
      const aplicadas: string[] = []
      if (body.aplicar && siguen.length > 0) {
        const { error: e2 } = await supabase.schema(schema).from('comprobantes_arca')
          .update({ fc: 'NO Mail', pdf_estado: 'no_encontrado' }).in('id', siguen.map((f: any) => f.id)).is('pdf_drive_url', null)
        if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 })
        aplicadas.push(...siguen.map((f: any) => f.id))
      }
      return NextResponse.json({ ok: true, aplicadas })
    }

    return NextResponse.json({ ok: false, error: `Acción desconocida: ${body.accion}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}
