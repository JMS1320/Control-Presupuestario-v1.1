/**
 * POST /api/gas/auditar-periodo  (A-FEAT-AUDIT — resumible por tandas)
 * Procesa UNA tanda (≤ max_files archivos OCR) del relevamiento de un período y commitea sus links.
 * El cliente (modal) loopea pasando `skip_file_ids` (archivos ya procesados) hasta `completo:true`,
 * y al final manda `finalizar:true` con el resumen acumulado → el GAS deja el log + manda el mail.
 *
 * Cada tanda es ≤60s. Resumible: los links se guardan por tanda; re-correr saltea lo ya hecho.
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_{MSA,PAM,MA}.
 */
import { NextResponse } from 'next/server'
import { clienteUsuario } from "@/lib/supabase-usuario"
import type { Empresa } from '@/lib/gas-pdf/types'
import { subcarpetasDelMes } from '@/lib/facturas/vincular-archivo'
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { fcAlVincularDesdeCarpeta, textoLeido, type DecisionCarpeta } from '@/lib/gas-pdf/lote'
import { pedirAlGas as pedirAlGasCon } from '@/lib/gas-pdf/gas-http'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Tope propio para la llamada al GAS, POR DEBAJO de `maxDuration`.
 *
 * Sin esto la ruta espera al GAS indefinidamente y, si se pasa de los 60s, **la plataforma la mata
 * desde afuera**: el `catch` de abajo nunca corre y el navegador recibe un error pelado, sin motivo.
 * Cortando a los 45s la ruta alcanza a devolver un error *explicado*, que es la diferencia entre
 * "falló" y "falló porque el OCR de N archivos no entró en el tiempo disponible".
 */
const TOPE_GAS_MS = 45_000
const pedirAlGas = (url: string, payload: unknown, etiqueta: string) => pedirAlGasCon(url, payload, etiqueta, TOPE_GAS_MS)

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

interface MatchItem { factura_id: string; drive_url: string; archivo: string; file_id: string; tambien?: string[] }
interface DudosoItem extends MatchItem { motivos?: string[]; leido?: { tipo?: string | null; monto?: number | null; fechas?: string[] } }

/**
 * 🔗 Aplica lo que decidió el buscador de PDFs sobre la carpeta (A-FEAT-1287, 2026-10-20). Va en un
 * paso aparte —y no tanda por tanda— porque recién al terminar de leer la carpeta se sabe si una
 * factura tiene UN archivo o DOS: vincular el primero que aparece es justo lo que no hay que hacer.
 * Escribe la factura (sólo si sigue sin 📎) y deja el rastro en el log de búsquedas, con un renglón
 * por candidato para que el ✓ de VER pueda ofrecerlos.
 */
async function aplicarDecisiones(supabase: any, schema: string, decisiones0: DecisionCarpeta[], loteId: string | null, sinHallazgo0: string[] = []) {
  const ids = [...decisiones0.map(d => d.factura_id), ...sinHallazgo0]
  const vacio = { vinculadas: 0, aRevisar: 0, idsVinculadas: [] as string[], idsARevisar: [] as string[], descartados: [] as string[] }
  if (ids.length === 0) return vacio
  const { data: actuales, error } = await supabase.schema(schema).from('comprobantes_arca')
    .select('id, fc, cuit, punto_venta, numero_desde, imp_total, pdf_drive_url').in('id', ids)
  if (error) throw new Error(`Error cargando las facturas a vincular: ${error.message}`)
  const porId = new Map<string, any>((actuales || []).map((f: any) => [f.id, f]))

  // «No es ésta» (A-FEAT-1287): un archivo que el usuario descartó para ESA factura no se vuelve a
  // vincular ni a ofrecer. Si era lo único que había, para esa factura la carpeta «no lo tiene».
  const { data: descLog } = await supabase.from('arca_pdf_busqueda_log')
    .select('factura_id, drive_url').eq('resultado', 'descartado').in('factura_id', ids)
  const descartados = new Set<string>((descLog || []).map((l: any) => `${l.factura_id}|${l.drive_url}`))
  const sinHallazgo = [...sinHallazgo0]
  const decisiones: DecisionCarpeta[] = []
  for (const d0 of decisiones0) {
    const vale = (url?: string | null) => !!url && !descartados.has(`${d0.factura_id}|${url}`)
    if (d0.accion === 'vincular') {
      if (vale(d0.drive_url)) decisiones.push(d0); else sinHallazgo.push(d0.factura_id)
      continue
    }
    // A revisar: quedan los candidatos no descartados (nunca se sube a «vincular» sola: decide el usuario)
    const candidatos = d0.candidatos.filter(c => vale(c.drive_url))
    if (candidatos.length > 0) decisiones.push({ ...d0, candidatos }); else sinHallazgo.push(d0.factura_id)
  }

  const ahora = new Date().toISOString()
  let vinculadas = 0, aRevisar = 0
  const idsVinculadas: string[] = [], idsARevisar: string[] = []
  // Búsqueda en carpeta sin hallazgo: sólo el renglón del log (la factura queda como estaba)
  const filasSin = sinHallazgo.map(id => porId.get(id)).filter((f: any) => f && !f.pdf_drive_url).map((f: any) => ({
    factura_id: f.id, factura_schema: schema, lote_id: loteId, resultado: 'no_encontrado',
    cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`, monto_factura: f.imp_total,
    observaciones: '[carpeta] No está en la carpeta del mes ni en la del siguiente',
  }))
  if (filasSin.length) await supabase.from('arca_pdf_busqueda_log').insert(filasSin)
  for (const d of decisiones) {
    const f = porId.get(d.factura_id)
    if (!f || f.pdf_drive_url) continue   // ya tiene 📎: no se pisa
    const base = {
      factura_id: d.factura_id, factura_schema: schema, lote_id: loteId,
      cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`, monto_factura: f.imp_total,
    }
    if (d.accion === 'vincular' && d.drive_url) {
      const { error: e } = await supabase.schema(schema).from('comprobantes_arca').update({
        fc: fcAlVincularDesdeCarpeta(f.fc), pdf_drive_url: d.drive_url, pdf_estado: 'descargado',
        pdf_observaciones: `${d.motivo} (${d.archivo || 'archivo'})`, pdf_ultimo_intento: ahora,
      }).eq('id', d.factura_id).is('pdf_drive_url', null)
      if (e) throw new Error(`Error vinculando ${base.numero_comprobante}: ${e.message}`)
      await supabase.from('arca_pdf_busqueda_log').insert({ ...base, resultado: 'descargado', drive_url: d.drive_url, observaciones: `[carpeta] ${d.motivo} — ${d.archivo || ''}` })
      vinculadas++
      idsVinculadas.push(d.factura_id)
    } else {
      const { error: e } = await supabase.schema(schema).from('comprobantes_arca').update({
        fc: 'VER', pdf_estado: 'revisar', pdf_observaciones: d.motivo, pdf_ultimo_intento: ahora,
      }).eq('id', d.factura_id).is('pdf_drive_url', null)
      if (e) throw new Error(`Error marcando a revisar ${base.numero_comprobante}: ${e.message}`)
      if (d.candidatos.length) {
        await supabase.from('arca_pdf_busqueda_log').insert(d.candidatos.map(c => ({
          ...base, resultado: 'revisar', drive_url: c.drive_url, monto_pdf: c.leido?.monto ?? null,
          observaciones: `[carpeta] ${c.motivo} — ${c.archivo}${c.leido ? ` · ${textoLeido(c.leido)}` : ''}`,
        })))
      }
      aRevisar++
      idsARevisar.push(d.factura_id)
    }
  }
  return { vinculadas, aRevisar, idsVinculadas, idsARevisar, descartados: [...descartados] }
}

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

    const body = (await request.json()) as {
      empresa: Empresa; anio: number; mes: number
      skip_file_ids?: string[]; max_files?: number
      finalizar?: boolean; resumen?: unknown
      factura_ids?: string[]
      /** Buscador de PDFs: lo decidido al terminar de leer la carpeta (ver aplicarDecisiones) */
      aplicar?: DecisionCarpeta[]; lote_id?: string
      /** Las que se leyeron enteras y no aparecieron: sólo dejan su renglón en el log */
      sin_hallazgo?: string[]
      /** Buscador (GAS ≥ 0.19.0): primero LISTAR los archivos de la carpeta sin leerlos, ya sin los vinculados… */
      listar?: boolean
      /** …y después leer EXACTAMENTE estos (de a pocos; uno que se traba no frena a los demás) */
      file_ids?: string[]
    }
    const { empresa, anio, mes } = body
    if (!empresa || !anio || !mes) {
      return NextResponse.json({ ok: false, error: 'Faltan empresa / anio / mes' }, { status: 400 })
    }
    const carpeta = carpetaDe(empresa)
    if (!carpeta) {
      return NextResponse.json({ ok: false, error: `Sin GAS_FOLDER_ID_${empresa}` }, { status: 500 })
    }
    const schema = schemaDe(empresa)
    if (Array.isArray(body.aplicar)) {
      const r = await aplicarDecisiones(supabase, schema, body.aplicar, body.lote_id || null, Array.isArray(body.sin_hallazgo) ? body.sin_hallazgo : [])
      return NextResponse.json({ ok: true, aplicado: true, ...r })
    }
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`
    const subcarpetas = subcarpetasDelMes(empresa, anio, mes)

    // Cierre: deja el log + manda el mail con el resumen acumulado por el cliente.
    if (body.finalizar) {
      const g = (await pedirAlGas(url, {
        _token: token, accion: 'auditar', empresa, periodo, carpeta_drive_id: carpeta,
        subcarpetas, finalizar: true, resumen: body.resumen,
      }, 'cierre')) as { status?: string }
      return NextResponse.json({ ok: g.status === 'ok', finalizado: true })
    }

    /**
     * Qué facturas se buscan en la carpeta:
     * - **sin `factura_ids`** (Subdiarios): las imputadas a ESTE período, como siempre.
     * - **con `factura_ids`** (el buscador de PDFs, A-FEAT-1287): esas facturas, estén imputadas o no
     *   y sea éste su mes o el siguiente — el buscador mira la carpeta ANTES de salir al mail. En
     *   este modo se saltean además los archivos que ya están vinculados a CUALQUIER factura de la
     *   empresa: no pueden ser de éstas, y leerlos es lo único caro (el OCR).
     */
    const porIds = Array.isArray(body.factura_ids) && body.factura_ids.length > 0
    const columnas = 'id, cuit, punto_venta, numero_desde, denominacion_emisor, fc, pdf_drive_url, imp_total, tipo_comprobante_desc, fecha_emision'
    const { data: facturas, error } = porIds
      ? await supabase.schema(schema).from('comprobantes_arca').select(columnas).in('id', body.factura_ids!)
      : await supabase.schema(schema).from('comprobantes_arca').select(columnas)
          .eq('año_contable', anio)
          .eq('mes_contable', mes)
    if (error) {
      return NextResponse.json({ ok: false, error: `Error cargando facturas: ${error.message}` }, { status: 500 })
    }
    const skipExtra: string[] = []
    if (porIds) {
      const { data: vinculadas, error: errV } = await supabase.schema(schema).from('comprobantes_arca')
        .select('pdf_drive_url').not('pdf_drive_url', 'is', null).limit(10000)
      if (errV) {
        return NextResponse.json({ ok: false, error: `Error cargando los archivos ya vinculados: ${errV.message}` }, { status: 500 })
      }
      for (const v of vinculadas || []) {
        const m = String(v.pdf_drive_url || '').match(/[-\w]{25,}/)
        if (m) skipExtra.push(m[0])
      }
    }

    const payload = (facturas || []).map((f) => ({
      factura_id: f.id, cuit: f.cuit, punto_venta: f.punto_venta,
      numero_desde: f.numero_desde, denominacion: f.denominacion_emisor, fc: f.fc,
      imp_total: f.imp_total, // para el chequeo de monto en el matcher (evita falsos positivos)
      // GAS ≥ 0.18.0: tipo (FC/NC/ND) y fecha también tienen que coincidir (A-FEAT-1287)
      tipo: f.tipo_comprobante_desc, fecha_emision: f.fecha_emision,
    }))

    // Listar (sin OCR): qué archivos hay en la carpeta que no estén ya vinculados a ninguna factura
    if (porIds && body.listar) {
      const l = (await pedirAlGas(url, { _token: token, accion: 'listar', carpeta_drive_id: carpeta, subcarpetas }, 'listar la carpeta')) as {
        status?: string; existe?: boolean; observaciones?: string; archivos?: Array<{ file_id: string; archivo: string; url: string }>
      }
      if (l.status !== 'ok') return NextResponse.json({ ok: false, error: l.observaciones || 'El GAS no pudo listar la carpeta' }, { status: 502 })
      if (l.existe === false) return NextResponse.json({ ok: true, empresa, periodo, existe: false, archivos: [], ya_vinculados: 0 })
      const vinc = new Set(skipExtra)
      const archivos = (l.archivos || []).filter(a => !vinc.has(a.file_id))
      return NextResponse.json({ ok: true, empresa, periodo, existe: true, archivos, ya_vinculados: (l.archivos || []).length - archivos.length })
    }

    // Una tanda
    const cuantos = body.file_ids?.length || body.max_files || 10
    const audit = (await pedirAlGas(url, {
      _token: token, accion: 'auditar', empresa, periodo,
      carpeta_drive_id: carpeta, subcarpetas, facturas: payload,
      skip_file_ids: [...(body.skip_file_ids || []), ...skipExtra], max_files: cuantos,
      ...(Array.isArray(body.file_ids) ? { solo_file_ids: body.file_ids } : {}),
    }, `tanda de ${cuantos} archivo(s)`)) as {
      status?: string; existe?: boolean; observaciones?: string
      matched?: MatchItem[]; dudosos?: DudosoItem[]; huerfanos?: { archivo: string; url: string; file_id: string; chars?: number; ocr_error?: string }[]
      procesados?: number; restantes?: number; completo?: boolean
    }

    if (audit.existe === false) {
      return NextResponse.json({ ok: true, empresa, periodo, existe: false, observaciones: audit.observaciones, completo: true, total_facturas: payload.length, matched: [], huerfanos: [], sin_pdf: [] })
    }

    // Buscador de PDFs: NO se escribe tanda por tanda. Se devuelve lo hallado y el cliente decide al
    // terminar la carpeta (dos archivos para una factura → no se vincula ninguno) y llama a `aplicar`.
    if (porIds) {
      return NextResponse.json({
        ok: true, empresa, periodo, existe: true,
        total_facturas: payload.length,
        matched: audit.matched || [], dudosos: audit.dudosos || [], huerfanos: audit.huerfanos || [],
        procesados: audit.procesados || 0, restantes: audit.restantes || 0, completo: !!audit.completo,
      })
    }

    // Agregar link a las matched que no lo tenían (confirmadas por contenido).
    // Si DOS archivos matchean la misma factura (ej. 2 NC parecidas, o 1 factura ya cubierta por otro
    // archivo), el segundo queda SUELTO → lo mandamos a huérfanos para que se pueda asignar a mano a
    // la factura que realmente le corresponde (la que sigue sin PDF).
    let linksAgregados = 0
    const yaCubiertas = new Set((facturas || []).filter((f) => f.pdf_drive_url).map((f) => f.id))
    const matchedSueltos: { archivo: string; url: string; file_id: string }[] = []
    for (const m of audit.matched || []) {
      if (!yaCubiertas.has(m.factura_id)) {
        // Desde 2026-10-20 el estado FC acompaña al 📎 (antes quedaba en «Buscar» con el archivo puesto)
        const fcActual = (facturas || []).find((f) => f.id === m.factura_id)?.fc
        await supabase.schema(schema).from('comprobantes_arca')
          .update({ pdf_drive_url: m.drive_url, pdf_estado: 'descargado', fc: fcAlVincularDesdeCarpeta(fcActual) })
          .eq('id', m.factura_id)
        yaCubiertas.add(m.factura_id)
        linksAgregados++
      } else {
        matchedSueltos.push({ archivo: m.archivo, url: m.drive_url, file_id: m.file_id })
      }
    }

    // Pendientes después de esta tanda (sin link y sin match): el cliente usa el de la última tanda
    const sin_pdf = (facturas || [])
      .filter((f) => !yaCubiertas.has(f.id))
      .map((f) => ({ factura_id: f.id, denominacion: f.denominacion_emisor, numero: `${f.punto_venta}-${f.numero_desde}`, fc: f.fc }))

    // Un archivo que YA está vinculado a una factura NO es huérfano, aunque el OCR no lo haya podido
    // leer en esta corrida (típico de fotos). Lo excluimos comparando su file_id con los de los links.
    // A los huérfanos reales les sumamos los "matchedSueltos" (matchearon una factura ya cubierta).
    const fileIdDe = (u?: string | null) => { const m = String(u || '').match(/[-\w]{25,}/); return m ? m[0] : null }
    const linkedFileIds = new Set((facturas || []).map((f) => fileIdDe(f.pdf_drive_url)).filter(Boolean) as string[])
    const huerfanosReales = [...(audit.huerfanos || []), ...matchedSueltos]
      .filter((h) => !linkedFileIds.has(h.file_id))

    return NextResponse.json({
      ok: true, empresa, periodo, existe: true,
      total_facturas: payload.length,
      matched: audit.matched || [],
      huerfanos: huerfanosReales,
      sin_pdf,
      procesados: audit.procesados || 0,
      restantes: audit.restantes || 0,
      completo: !!audit.completo,
      links_agregados: linksAgregados,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error en auditoría' }, { status: 502 })
  }
}
