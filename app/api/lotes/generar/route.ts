/**
 * POST /api/lotes/generar
 *
 * Genera el Excel formato banco Galicia para subir.
 * Reglas:
 *   - FC sueltas: 1 fila por item (NO se consolida por proveedor)
 *   - Grupos: 1 fila con el total (debe ser 1 solo CUIT)
 *   - Sueldos: archivo APARTE
 *   - Máximo 50 items por archivo → si excede, parte en N
 *
 * Devuelve los archivos en base64 (cliente los descarga con showSaveFilePicker).
 *
 * NO modifica el estado de los items. SÍ:
 *   - INSERT en lotes_transferencias
 *   - UPDATE proveedores.ultimo_uso_bancario = NOW() en los afectados
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import * as XLSX from 'xlsx'
import type {
  GenerarLoteInput, GenerarLoteOutput, ItemPreview,
} from '@/lib/lotes-galicia/types'
import {
  validarCBU, validarAlias, obtenerDestinatarioValido,
  formatearImporteGalicia, motivoSugerido, abreviarDescripcion,
  nombreArchivoLote, empresaToSchema,
} from '@/lib/lotes-galicia/helpers'

export const runtime = 'nodejs'

const MAX_FILAS_POR_ARCHIVO = 50

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerarLoteInput
    const { empresa, fecha_pago, items, user_role, mensajes, fijarMensaje } = body

    if (!empresa || !['MSA', 'PAM', 'MA'].includes(empresa)) {
      return NextResponse.json({ ok: false, error: 'empresa requerida' }, { status: 400 })
    }
    if (!fecha_pago || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_pago)) {
      return NextResponse.json({ ok: false, error: 'fecha_pago YYYY-MM-DD requerida' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'items vacío' }, { status: 400 })
    }

    // ── 1. Llamar al preview internamente para obtener los ItemPreview validados ──
    // Reutilizamos la lógica via fetch a /api/lotes/preview
    const previewUrl = new URL('/api/lotes/preview', request.url)
    const previewResp = await fetch(previewUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresa, items }),
    })
    const previewData = await previewResp.json()
    if (!previewData.ok) {
      return NextResponse.json({ ok: false, error: previewData.error || 'preview falló' }, { status: 500 })
    }
    if (previewData.bloqueantes?.length > 0) {
      return NextResponse.json({
        ok: false,
        error: 'Hay items bloqueantes:\n' + previewData.bloqueantes.join('\n')
      }, { status: 400 })
    }

    // ── 2. Filtrar items válidos (con destinatario) y armar excluidos ──
    const itemsPagos: ItemPreview[] = previewData.pagos.items
    const itemsSueldos: ItemPreview[] = previewData.sueldos.items
    const excluidos: GenerarLoteOutput['excluidos'] = []

    const pagosValidos = itemsPagos.filter(p => {
      if (p.excluido_del_excel) {
        excluidos.push({ tipo: p.tipo, id: p.id, proveedor: p.razon_social, motivo: 'Sin CBU/Alias válido' })
        return false
      }
      return true
    })
    const sueldosValidos = itemsSueldos.filter(p => {
      if (p.excluido_del_excel) {
        excluidos.push({ tipo: p.tipo, id: p.id, proveedor: p.razon_social, motivo: 'Sin CBU/Alias válido' })
        return false
      }
      return true
    })

    // ── 2b. Aplicar override de mensaje (lo que tipeó el usuario gana sobre el fijo del proveedor) ──
    for (const it of [...pagosValidos, ...sueldosValidos]) {
      if (mensajes && Object.prototype.hasOwnProperty.call(mensajes, it.id)) {
        it.mensaje = mensajes[it.id]  // puede ser '' para limpiar
      }
    }

    // ── 2c. Guardar como fijo los mensajes marcados (PATCH proveedores.mensaje_transferencia) ──
    if (fijarMensaje && fijarMensaje.length > 0) {
      const porProveedor = new Map<string, string>()  // proveedor_id → mensaje (último gana)
      for (const it of [...pagosValidos, ...sueldosValidos]) {
        if (fijarMensaje.includes(it.id) && it.proveedor_id) {
          porProveedor.set(it.proveedor_id, mensajes?.[it.id] ?? it.mensaje ?? '')
        }
      }
      for (const [provId, msg] of porProveedor) {
        await supabaseAdmin.from('proveedores')
          .update({ mensaje_transferencia: msg || null })
          .eq('id', provId)
      }
    }

    // ── 3. Generar Excel(s) ──
    const archivosPagos = generarArchivos(pagosValidos, { empresa, fechaPago: fecha_pago, tipo: 'pagos' })
    const archivosSueldos = generarArchivos(sueldosValidos, { empresa, fechaPago: fecha_pago, tipo: 'sueldos' })

    // ── 4. UPDATE proveedores.ultimo_uso_bancario ──
    const provIds = [...new Set([...pagosValidos, ...sueldosValidos].map(p => p.proveedor_id).filter(Boolean) as string[])]
    if (provIds.length > 0) {
      await supabaseAdmin.from('proveedores')
        .update({ ultimo_uso_bancario: new Date().toISOString() })
        .in('id', provIds)
    }

    // ── 5. INSERT lotes_transferencias (1 por tipo si ambos tienen items) ──
    const inserts: any[] = []
    const montoTotalPagos = pagosValidos.reduce((s, p) => s + p.monto, 0)
    const montoTotalSueldos = sueldosValidos.reduce((s, p) => s + p.monto, 0)
    const cantExcluidosPagos = itemsPagos.filter(p => p.excluido_del_excel).length
    const cantExcluidosSueldos = itemsSueldos.filter(p => p.excluido_del_excel).length

    if (pagosValidos.length > 0) {
      inserts.push({
        fecha_pago,
        tipo: 'pagos',
        empresa,
        monto_total: montoTotalPagos,
        cantidad_items: pagosValidos.length,
        cantidad_excluidos: cantExcluidosPagos,
        cantidad_archivos: archivosPagos.length,
        user_role: user_role ?? null,
        nombre_archivo: archivosPagos.map(a => a.nombre).join(' | '),
      })
    }
    if (sueldosValidos.length > 0) {
      inserts.push({
        fecha_pago,
        tipo: 'sueldos',
        empresa,
        monto_total: montoTotalSueldos,
        cantidad_items: sueldosValidos.length,
        cantidad_excluidos: cantExcluidosSueldos,
        cantidad_archivos: archivosSueldos.length,
        user_role: user_role ?? null,
        nombre_archivo: archivosSueldos.map(a => a.nombre).join(' | '),
      })
    }

    let loteId = ''
    if (inserts.length > 0) {
      const { data: ins } = await supabaseAdmin.from('lotes_transferencias')
        .insert(inserts).select('id')
      loteId = ins?.[0]?.id || ''
    }

    const out: GenerarLoteOutput = {
      ok: true,
      archivos_pagos: archivosPagos,
      archivos_sueldos: archivosSueldos,
      lote_id: loteId,
      excluidos,
    }
    return NextResponse.json(out)

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────
// Generación del Excel formato Galicia
// ─────────────────────────────────────────────────────────────────

function generarArchivos(items: ItemPreview[], opts: { empresa: string; fechaPago: string; tipo: 'pagos' | 'sueldos' }) {
  if (items.length === 0) return []

  // Partir en chunks de MAX_FILAS_POR_ARCHIVO
  const chunks: ItemPreview[][] = []
  for (let i = 0; i < items.length; i += MAX_FILAS_POR_ARCHIVO) {
    chunks.push(items.slice(i, i + MAX_FILAS_POR_ARCHIVO))
  }

  return chunks.map((chunk, idx) => {
    const nombre = nombreArchivoLote({
      empresa: opts.empresa,
      fechaPago: opts.fechaPago,
      tipo: opts.tipo,
      parteN: idx + 1,
      parteTotal: chunks.length,
    })
    const buffer = generarExcelBuffer(chunk)
    return {
      nombre,
      base64: buffer.toString('base64'),
      cantidad_filas: chunk.length,
      monto_total: chunk.reduce((s, c) => s + c.monto, 0),
    }
  })
}

/**
 * Genera el buffer .xlsx con las hojas:
 *   - Formulario: 1 fila header + N filas datos
 *
 * Columnas:
 *   1. CBU/CVU/Alias/Nro cuenta (obligatorio)
 *   2. Importe (numérico, formato "150,000.00")
 *   3. Motivo (lista cerrada)
 *   4. Descripción (opcional, max 12 chars)
 *   5. Email destinatario (opcional)
 *   6. Mensaje del email (opcional)
 */
function generarExcelBuffer(items: ItemPreview[]): Buffer {
  const filas: any[][] = [
    ['CBU/CVU/Alias/Nro cuenta            ', 'Importe', 'Motivo', 'Descripción\r\n(opcional)', 'Email destinatario\r\n(opcional)', 'Mensaje del email\r\n(opcional)']
  ]

  for (const it of items) {
    const dest = obtenerDestinatarioValido({ cbu: it.cbu, alias_cbu: it.alias_cbu })
    if (!dest) continue // no debería pasar (filtrado antes), pero defensivo

    const importeStr = formatearImporteGalicia(it.monto)
    const motivo = it.motivo_sugerido || motivoSugerido(it.tipo)
    const descripcion = abreviarDescripcion(it.tipo, it.descripcion)
    // Si el proveedor no tiene mail cargado, el comprobante igual se envía a una casilla de control.
    const email = it.email_pagos || 'sanmanuel.sp@gmail.com'

    filas.push([
      dest.valor,
      importeStr,
      motivo,
      descripcion,
      email,
      it.mensaje || '', // mensaje del email (fijo del proveedor u override del usuario)
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(filas)
  // Anchos sugeridos
  ws['!cols'] = [
    { wch: 35 }, // CBU/Alias
    { wch: 14 }, // Importe
    { wch: 22 }, // Motivo
    { wch: 16 }, // Descripción
    { wch: 28 }, // Email
    { wch: 30 }, // Mensaje
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Formulario')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
