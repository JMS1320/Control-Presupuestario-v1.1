/**
 * Endpoint que descarga comprobantes desde ARCA y devuelve el CSV adaptado.
 *
 * ⚠️ IMPORTANTE — Principios de seguridad:
 *   - Este endpoint SOLO LEE de ARCA. NO inserta nada en BD.
 *   - El CSV adaptado se devuelve al frontend.
 *   - El frontend pasa el CSV al wizard del importer existente
 *     (/api/import-facturas-arca) que tiene anti-duplicados testeados.
 *   - Credenciales SOLO en variables de entorno del servidor (nunca expuestas).
 *
 * Body esperado:
 *   { empresa: 'MSA'|'MA', password: string,
 *     fechaDesde: 'YYYY-MM-DD', fechaHasta: 'YYYY-MM-DD',
 *     tipo?: 'recibidos'|'emitidos', userRole?: 'admin'|'contable' }
 *
 * La password la ingresa el usuario en el modal. No se guarda en ningún lado:
 * llega al endpoint, se usa una vez para loguear, y se descarta al final.
 *
 * Response (200):
 *   { csvText, cantidad, rango, logId }
 *
 * Response (4xx/5xx):
 *   { error: string }
 */

import { NextResponse } from 'next/server'
import { descargarComprobantesArca, type Empresa, type Tipo } from '@/lib/arca'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Runtime nodejs (NO edge) — tough-cookie y axios necesitan APIs de Node
export const runtime = 'nodejs'
export const maxDuration = 60   // segundos — el flujo completo tarda ~10-20s

export async function POST(request: Request) {
  let logId: string | undefined
  const supabase = supabaseAdmin

  try {
    const body = await request.json()
    const { empresa, password, fechaDesde, fechaHasta, tipo, userRole } = body as {
      empresa?: string
      password?: string
      fechaDesde?: string
      fechaHasta?: string
      tipo?: string
      userRole?: string
    }

    // ── Validaciones ────────────────────────────────────────────
    if (!empresa || !['MSA', 'MA'].includes(empresa)) {
      return NextResponse.json({ error: 'empresa debe ser MSA o MA' }, { status: 400 })
    }
    if (!password || password.trim().length === 0) {
      return NextResponse.json({ error: 'Ingresá tu clave fiscal de ARCA' }, { status: 400 })
    }
    if (!fechaDesde || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDesde)) {
      return NextResponse.json({ error: 'fechaDesde debe estar en formato YYYY-MM-DD' }, { status: 400 })
    }
    if (!fechaHasta || !/^\d{4}-\d{2}-\d{2}$/.test(fechaHasta)) {
      return NextResponse.json({ error: 'fechaHasta debe estar en formato YYYY-MM-DD' }, { status: 400 })
    }
    if (fechaDesde > fechaHasta) {
      return NextResponse.json({ error: 'fechaDesde debe ser anterior o igual a fechaHasta' }, { status: 400 })
    }
    if (tipo && !['recibidos', 'emitidos'].includes(tipo)) {
      return NextResponse.json({ error: 'tipo debe ser recibidos o emitidos' }, { status: 400 })
    }
    // Solo admin puede descargar
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Solo el rol admin puede ejecutar descarga de ARCA' }, { status: 403 })
    }

    // ── Insertar log en estado pendiente (para tracking) ────────
    const { data: logRow } = await supabase
      .from('arca_descargas_log')
      .insert({
        user_role: userRole,
        empresa,
        tipo: tipo || 'recibidos',
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        status: 'ok',   // optimista — actualizamos a 'error' si falla
      })
      .select('id')
      .single()
    logId = logRow?.id

    // ── Ejecutar descarga ───────────────────────────────────────
    const result = await descargarComprobantesArca({
      empresa: empresa as Empresa,
      password: password.trim(),
      fechaDesde,
      fechaHasta,
      tipo: (tipo as Tipo) || 'recibidos',
      // DEBUG: guardar HTML del selector para diagnosticar MA
      onDebugHtml: async (html: string) => {
        if (logId) {
          await supabase
            .from('arca_descargas_log')
            .update({ html_debug: html })
            .eq('id', logId)
        }
      },
    })

    // Actualizar log con cantidad descargada
    if (logId) {
      await supabase
        .from('arca_descargas_log')
        .update({ comprobantes_descargados: result.cantidad })
        .eq('id', logId)
    }

    return NextResponse.json({
      csvText: result.csvText,
      cantidad: result.cantidad,
      rango: result.rango,
      logId,
    })

  } catch (err) {
    const errorMsg = (err as Error).message || 'Error desconocido'
    console.error('Error en /api/arca/descargar-comprobantes:', errorMsg)

    // Actualizar log a 'error' si ya se creó
    if (logId) {
      await supabase
        .from('arca_descargas_log')
        .update({ status: 'error', error_mensaje: errorMsg })
        .eq('id', logId)
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
