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
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Empresa } from '@/lib/gas-pdf/types'

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

/**
 * Habla con el GAS y devuelve su JSON, o tira un error que se entiende solo.
 *
 * Las tres formas de fallar que se veían todas igual —tiempo agotado, HTTP no-200, y respuesta que
 * no es JSON (el GAS devuelve HTML cuando hay problema de permisos o redirección)— ahora dicen cuál
 * fue. El cuerpo se lee como texto primero justamente para poder mostrar el HTML recortado en vez
 * de un `Unexpected token < in JSON`, que no le sirve a nadie.
 */
async function pedirAlGas(url: string, payload: unknown, etiqueta: string): Promise<any> {
  let r: Response
  try {
    r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TOPE_GAS_MS),
    })
  } catch (e) {
    const err = e as Error
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(
        `El GAS no respondió en ${TOPE_GAS_MS / 1000}s (${etiqueta}). ` +
        `Suele ser el OCR: probá con menos archivos por tanda.`
      )
    }
    throw new Error(`No se pudo contactar al GAS (${etiqueta}): ${err.message}`)
  }

  const txt = await r.text()
  if (!r.ok) {
    throw new Error(`El GAS respondió HTTP ${r.status} (${etiqueta}): ${txt.slice(0, 200)}`)
  }
  try {
    return JSON.parse(txt)
  } catch {
    throw new Error(
      `El GAS no devolvió JSON (${etiqueta}). Suele ser permisos o una redirección del despliegue. ` +
      `Empieza con: ${txt.slice(0, 160)}`
    )
  }
}

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
function computarSubcarpetas(empresa: Empresa, anio: number, mes: number): string[] {
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

interface MatchItem { factura_id: string; drive_url: string; archivo: string; file_id: string }

export async function POST(request: Request) {
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
    const periodo = `${anio}-${String(mes).padStart(2, '0')}`
    const subcarpetas = computarSubcarpetas(empresa, anio, mes)

    // Cierre: deja el log + manda el mail con el resumen acumulado por el cliente.
    if (body.finalizar) {
      const g = (await pedirAlGas(url, {
        _token: token, accion: 'auditar', empresa, periodo, carpeta_drive_id: carpeta,
        subcarpetas, finalizar: true, resumen: body.resumen,
      }, 'cierre')) as { status?: string }
      return NextResponse.json({ ok: g.status === 'ok', finalizado: true })
    }

    // Facturas del período contable
    const { data: facturas, error } = await supabaseAdmin
      .schema(schema)
      .from('comprobantes_arca')
      .select('id, cuit, punto_venta, numero_desde, denominacion_emisor, fc, pdf_drive_url, imp_total')
      .eq('año_contable', anio)
      .eq('mes_contable', mes)
    if (error) {
      return NextResponse.json({ ok: false, error: `Error cargando facturas: ${error.message}` }, { status: 500 })
    }

    const payload = (facturas || []).map((f) => ({
      factura_id: f.id, cuit: f.cuit, punto_venta: f.punto_venta,
      numero_desde: f.numero_desde, denominacion: f.denominacion_emisor, fc: f.fc,
      imp_total: f.imp_total, // para el chequeo de monto en el matcher (evita falsos positivos)
    }))

    // Una tanda
    const cuantos = body.max_files || 10
    const audit = (await pedirAlGas(url, {
      _token: token, accion: 'auditar', empresa, periodo,
      carpeta_drive_id: carpeta, subcarpetas, facturas: payload,
      skip_file_ids: body.skip_file_ids || [], max_files: cuantos,
    }, `tanda de ${cuantos} archivo(s)`)) as {
      status?: string; existe?: boolean; observaciones?: string
      matched?: MatchItem[]; huerfanos?: { archivo: string; url: string; file_id: string; chars?: number; ocr_error?: string }[]
      procesados?: number; restantes?: number; completo?: boolean
    }

    if (audit.existe === false) {
      return NextResponse.json({ ok: true, empresa, periodo, existe: false, observaciones: audit.observaciones, completo: true, total_facturas: payload.length, matched: [], huerfanos: [], sin_pdf: [] })
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
        await supabaseAdmin.schema(schema).from('comprobantes_arca')
          .update({ pdf_drive_url: m.drive_url, pdf_estado: 'descargado' })
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
