/**
 * Endpoint Next.js: dispara búsqueda de PDF de UNA factura via GAS Web App.
 *
 * Flujo:
 *   1. Recibe { factura_id, empresa, lote_id? }
 *   2. Carga la FC y su proveedor desde BD
 *   3. Valida que el proveedor esté con gas_habilitado=TRUE
 *   4. Arma el request al GAS y lo dispara
 *   5. Procesa la respuesta:
 *      - UPDATE comprobantes_arca con pdf_drive_url, pdf_estado, fc, pdf_ultimo_intento, pdf_observaciones
 *      - INSERT en arca_pdf_busqueda_log
 *   6. Devuelve resultado al cliente
 *
 * Env vars requeridas:
 *   - GAS_BUSCAR_PDF_URL    (URL del Web App GAS)
 *   - GAS_AUTH_TOKEN        (token compartido)
 *   - GAS_FOLDER_ID_MSA     (carpeta Drive raíz MSA)
 *   - GAS_FOLDER_ID_PAM     (carpeta Drive raíz PAM)
 *   - GAS_FOLDER_ID_MA      (carpeta Drive raíz MA)
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  ApiBuscarPdfInput,
  ApiBuscarPdfOutput,
  Empresa,
  GasBuscarRequest,
  GasBuscarResponse,
  SchemaEmpresa,
} from '@/lib/gas-pdf/types'
import { gasStatusToFc } from '@/lib/gas-pdf/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // GAS tarda 5-15s típicamente, margen para reintento

function carpetaDriveDefault(empresa: Empresa): string | undefined {
  switch (empresa) {
    case 'MSA': return process.env.GAS_FOLDER_ID_MSA
    case 'PAM': return process.env.GAS_FOLDER_ID_PAM
    case 'MA': return process.env.GAS_FOLDER_ID_MA
  }
}

// Ruta de subcarpetas (bajo la carpeta de la empresa) donde el GAS archiva la FC.
// MSA: campaña agrícola AAAA-AAAA (corte 1/7–30/6). PAM/MA: año calendario AAAA.
// Dentro: subcarpeta del mes "aa-mm". Estas FC son de COMPRAS → van en el mes directo.
// (Para ventas, a futuro, se agregaría 'ventas' como último nivel.)
function computarSubcarpetas(empresa: Empresa, fechaEmision: string): string[] {
  const f = new Date(`${fechaEmision}T12:00:00`) // mediodía evita corrimiento por timezone
  const anio = f.getFullYear()
  const mes = f.getMonth() + 1 // 1-12
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

function empresaToSchema(e: Empresa): SchemaEmpresa {
  return e.toLowerCase() as SchemaEmpresa
}

export async function POST(request: Request) {
  const supabase = supabaseAdmin

  try {
    const body = (await request.json()) as ApiBuscarPdfInput
    const { factura_id, empresa, lote_id } = body

    // ── Validaciones ──
    if (!factura_id) {
      return NextResponse.json({ ok: false, factura_id: '', error: 'factura_id requerido' }, { status: 400 })
    }
    if (!empresa || !['MSA', 'PAM', 'MA'].includes(empresa)) {
      return NextResponse.json({ ok: false, factura_id, error: 'empresa debe ser MSA / PAM / MA' }, { status: 400 })
    }

    const url = process.env.GAS_BUSCAR_PDF_URL
    const token = process.env.GAS_AUTH_TOKEN
    if (!url || !token) {
      return NextResponse.json({
        ok: false, factura_id,
        error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados en el servidor'
      }, { status: 500 })
    }

    const schema = empresaToSchema(empresa)
    const tStart = Date.now()

    // ── Cargar FC desde BD ──
    const { data: factura, error: errFc } = await supabase
      .schema(schema)
      .from('comprobantes_arca')
      .select('id, cuit, denominacion_emisor, fecha_emision, tipo_comprobante, tipo_comprobante_desc, punto_venta, numero_desde, imp_total, fc, pdf_drive_url')
      .eq('id', factura_id)
      .single()

    if (errFc || !factura) {
      return NextResponse.json({
        ok: false, factura_id,
        error: `Factura no encontrada en ${schema}.comprobantes_arca: ${errFc?.message ?? 'no existe'}`
      }, { status: 404 })
    }

    // No re-buscar si ya tiene PDF o estado terminal
    if (factura.fc === 'OK' || factura.fc === 'Portal') {
      return NextResponse.json({
        ok: false, factura_id,
        error: `FC en estado '${factura.fc}', no se busca automáticamente`
      }, { status: 409 })
    }
    if (factura.pdf_drive_url) {
      return NextResponse.json({
        ok: false, factura_id,
        error: 'FC ya tiene PDF descargado. Usar "forzar re-búsqueda" si querés reemplazar.'
      }, { status: 409 })
    }

    // ── Cargar proveedor ──
    const { data: proveedor, error: errProv } = await supabase
      .from('proveedores')
      .select('id, cuit, razon_social, email_facturacion, patron_asunto, dias_busqueda, carpeta_drive_id, gas_habilitado, fc_modo')
      .eq('cuit', factura.cuit)
      .maybeSingle()

    if (errProv) {
      return NextResponse.json({ ok: false, factura_id, error: `Error cargando proveedor: ${errProv.message}` }, { status: 500 })
    }
    if (!proveedor) {
      // No existe — log + estado Buscar (proveedor pendiente de creación)
      await logBusqueda(supabase, {
        factura_id, schema, lote_id,
        resultado: 'error',
        observaciones: `Proveedor con CUIT ${factura.cuit} no existe en BD`,
        tiempo_ms: Date.now() - tStart,
        cuit_emisor: factura.cuit,
        numero_comprobante: `${factura.punto_venta}-${factura.numero_desde}`,
        monto_factura: factura.imp_total,
      })
      return NextResponse.json({
        ok: false, factura_id,
        error: `Proveedor con CUIT ${factura.cuit} no existe. Hay que crearlo y configurarlo.`
      }, { status: 412 })
    }
    if (proveedor.fc_modo === 'portal') {
      // Marcar FC como Portal y no buscar
      await supabase.schema(schema).from('comprobantes_arca')
        .update({ fc: 'Portal', pdf_estado: null, pdf_observaciones: 'Proveedor marcado fc_modo=portal' })
        .eq('id', factura_id)
      return NextResponse.json({
        ok: true, factura_id,
        fc_nuevo: 'Portal',
        observaciones: 'Proveedor marcado como Portal — no se busca automáticamente'
      } as ApiBuscarPdfOutput)
    }
    // Recolectores (catch-all): Jose/Andrés que reenvían FC. Se buscan AUNQUE el proveedor no esté
    // configurado — por eso se consultan acá, antes del gate. La app los pasa al GAS (no hardcode).
    const { data: recolectoresData } = await supabase
      .from('proveedores').select('email_facturacion, patron_asunto').contains('tags', ['recolector'])
    const recolectores = (recolectoresData || [])
      .filter((r) => r.email_facturacion && r.email_facturacion !== proveedor.email_facturacion && r.patron_asunto)
      .map((r) => ({ email: r.email_facturacion as string, asunto: r.patron_asunto as string }))
    const puedeProveedor = !!(proveedor.gas_habilitado && proveedor.email_facturacion)

    if (!puedeProveedor && recolectores.length === 0) {
      // Ni el proveedor está configurado, ni hay recolectores → no hay dónde buscar
      await supabase.schema(schema).from('comprobantes_arca')
        .update({
          fc: 'Buscar',
          pdf_estado: 'pendiente',
          pdf_observaciones: 'Proveedor sin gas_habilitado/email y no hay recolectores',
          pdf_ultimo_intento: new Date().toISOString(),
        })
        .eq('id', factura_id)
      await logBusqueda(supabase, {
        factura_id, schema, lote_id,
        resultado: 'pendiente',
        observaciones: 'Sin fuente de búsqueda (proveedor sin config y sin recolectores)',
        tiempo_ms: Date.now() - tStart,
        cuit_emisor: factura.cuit,
        numero_comprobante: `${factura.punto_venta}-${factura.numero_desde}`,
        monto_factura: factura.imp_total,
      })
      return NextResponse.json({
        ok: true, factura_id,
        fc_nuevo: 'Buscar',
        observaciones: 'Proveedor sin configurar — FC queda en Buscar'
      } as ApiBuscarPdfOutput)
    }

    // ── Disparar GAS ──
    const carpetaId = proveedor.carpeta_drive_id || carpetaDriveDefault(empresa)
    if (!carpetaId) {
      return NextResponse.json({
        ok: false, factura_id,
        error: `Sin carpeta Drive: ni el proveedor tiene carpeta_drive_id ni el env GAS_FOLDER_ID_${empresa}`
      }, { status: 500 })
    }

    const gasRequest: GasBuscarRequest = {
      _token: token,
      factura_id,
      cuit_emisor: factura.cuit,
      punto_venta: factura.punto_venta,
      numero_desde: factura.numero_desde,
      tipo_comprobante_desc: factura.tipo_comprobante_desc || 'Factura A',
      fecha_emision: factura.fecha_emision,
      imp_total: Number(factura.imp_total),
      denominacion_emisor: factura.denominacion_emisor || proveedor.razon_social || '',
      email_proveedor: puedeProveedor ? proveedor.email_facturacion : '',  // si no, igual corre el catch-all por recolectores
      patron_asunto: proveedor.patron_asunto || '',
      dias_busqueda: proveedor.dias_busqueda || 30,   // default 30 días (configurable por proveedor; UI batch → pendiente)
      carpeta_drive_id: carpetaId,
      subcarpetas: computarSubcarpetas(empresa, factura.fecha_emision),
      recolectores,                                  // catch-all: cada reenviador con su propio asunto (Jose/Andrés)
    }

    let gasResp: GasBuscarResponse
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasRequest),
      })
      gasResp = (await r.json()) as GasBuscarResponse
    } catch (err) {
      const errorMsg = (err as Error).message || 'Error de red llamando a GAS'
      await logBusqueda(supabase, {
        factura_id, schema, lote_id,
        resultado: 'error',
        observaciones: errorMsg,
        tiempo_ms: Date.now() - tStart,
        cuit_emisor: factura.cuit,
        numero_comprobante: `${factura.punto_venta}-${factura.numero_desde}`,
        monto_factura: factura.imp_total,
      })
      return NextResponse.json({ ok: false, factura_id, error: errorMsg }, { status: 502 })
    }

    // ── Procesar respuesta GAS ──
    const { fc: fcNuevo, pdf_estado } = gasStatusToFc(gasResp.status)
    const ahora = new Date().toISOString()

    // Propuesta 2 (aviso mínimo): proveedor sin mail propio y no se encontró → avisar que solo se
    // buscó por reenvíos y que puede cargar el mail en "Config PDFs" para búsqueda directa.
    const avisoSinMail = (!puedeProveedor && gasResp.status === 'no_encontrada')
      ? ' ⚠️ Proveedor sin mail propio: solo se buscó por reenvíos. Cargá su mail en "Config PDFs" para búsqueda directa.'
      : ''
    const observacionesFinal = ((gasResp.observaciones ?? '') + avisoSinMail) || null

    await supabase.schema(schema).from('comprobantes_arca').update({
      fc: fcNuevo,
      // El link se guarda en la factura SOLO si está confirmada (match exacto 'ok'). Para 'revisar'
      // (incierto) no se registra: el candidato queda en el log + mail + carpeta _Revisar hasta confirmar.
      pdf_drive_url: gasResp.status === 'ok' ? (gasResp.drive_url ?? null) : null,
      pdf_estado,
      pdf_ultimo_intento: ahora,
      pdf_observaciones: observacionesFinal,
    }).eq('id', factura_id)

    // Update también pdf_ultimo_intento en proveedores
    await supabase.from('proveedores')
      .update({ pdf_ultimo_intento: ahora })
      .eq('id', proveedor.id)

    await logBusqueda(supabase, {
      factura_id, schema, lote_id,
      resultado: gasResp.status === 'ok' ? 'descargado' : gasResp.status === 'revisar' ? 'revisar' : gasResp.status === 'no_encontrada' ? 'no_encontrado' : 'error',
      drive_url: gasResp.drive_url,
      observaciones: observacionesFinal ?? undefined,
      tiempo_ms: gasResp.tiempo_ms ?? Date.now() - tStart,
      cuit_emisor: factura.cuit,
      numero_comprobante: `${factura.punto_venta}-${factura.numero_desde}`,
      monto_factura: Number(factura.imp_total),
      monto_pdf: gasResp.monto_pdf ?? null,
    })

    const out: ApiBuscarPdfOutput = {
      ok: true,
      factura_id,
      resultado_gas: gasResp.status,
      fc_nuevo: fcNuevo,
      drive_url: gasResp.drive_url,
      observaciones: observacionesFinal ?? undefined,
      // Para el mail resumen del lote:
      asunto: gasResp.asunto,
      remitente: gasResp.remitente,
      cuerpo: gasResp.cuerpo,
      proveedor: factura.denominacion_emisor || proveedor.razon_social || '',
      factura_label: `${factura.tipo_comprobante_desc || 'FC'} ${factura.punto_venta}-${factura.numero_desde}`,
    }
    return NextResponse.json(out)

  } catch (err) {
    return NextResponse.json({
      ok: false,
      factura_id: '',
      error: (err as Error).message || 'Error desconocido'
    }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────
async function logBusqueda(supabase: any, datos: {
  factura_id: string
  schema: string
  lote_id?: string
  resultado: string
  drive_url?: string | null
  observaciones?: string | null
  tiempo_ms?: number
  cuit_emisor?: string
  numero_comprobante?: string
  monto_factura?: number
  monto_pdf?: number | null
}) {
  await supabase.from('arca_pdf_busqueda_log').insert({
    factura_id: datos.factura_id,
    factura_schema: datos.schema,
    lote_id: datos.lote_id ?? null,
    resultado: datos.resultado,
    drive_url: datos.drive_url ?? null,
    observaciones: datos.observaciones ?? null,
    tiempo_ejecucion_ms: datos.tiempo_ms ?? null,
    cuit_emisor: datos.cuit_emisor ?? null,
    numero_comprobante: datos.numero_comprobante ?? null,
    monto_factura: datos.monto_factura ?? null,
    monto_pdf: datos.monto_pdf ?? null,
  })
}
