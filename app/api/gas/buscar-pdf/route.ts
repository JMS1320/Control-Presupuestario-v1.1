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
    if (!proveedor.gas_habilitado || !proveedor.email_facturacion) {
      // Sin config para GAS
      await supabase.schema(schema).from('comprobantes_arca')
        .update({
          fc: 'Buscar',
          pdf_estado: 'pendiente',
          pdf_observaciones: 'Proveedor sin gas_habilitado o sin email_facturacion',
          pdf_ultimo_intento: new Date().toISOString(),
        })
        .eq('id', factura_id)
      await logBusqueda(supabase, {
        factura_id, schema, lote_id,
        resultado: 'pendiente',
        observaciones: 'Proveedor sin config GAS (gas_habilitado=false o sin email)',
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
      email_proveedor: proveedor.email_facturacion,
      patron_asunto: proveedor.patron_asunto || '',
      dias_busqueda: proveedor.dias_busqueda || 7,
      carpeta_drive_id: carpetaId,
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

    await supabase.schema(schema).from('comprobantes_arca').update({
      fc: fcNuevo,
      pdf_drive_url: gasResp.drive_url ?? null,
      pdf_estado,
      pdf_ultimo_intento: ahora,
      pdf_observaciones: gasResp.observaciones ?? null,
    }).eq('id', factura_id)

    // Update también pdf_ultimo_intento en proveedores
    await supabase.from('proveedores')
      .update({ pdf_ultimo_intento: ahora })
      .eq('id', proveedor.id)

    await logBusqueda(supabase, {
      factura_id, schema, lote_id,
      resultado: gasResp.status === 'ok' ? 'descargado' : gasResp.status === 'revisar' ? 'revisar' : gasResp.status === 'no_encontrada' ? 'no_encontrado' : 'error',
      drive_url: gasResp.drive_url,
      observaciones: gasResp.observaciones,
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
      observaciones: gasResp.observaciones,
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
