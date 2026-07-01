/**
 * POST /api/lotes/preview
 *
 * Recibe array de items seleccionados, los carga desde BD, los une con sus proveedores
 * y devuelve resumen con flags de validación para mostrar en el modal.
 *
 * NO modifica BD. Solo lee. La lógica vive en lib/lotes-galicia/preview-core (compartida con /generar).
 */

import { NextResponse } from 'next/server'
import type { PreviewLoteInput } from '@/lib/lotes-galicia/types'
import { computarPreview } from '@/lib/lotes-galicia/preview-core'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewLoteInput
    const { empresa, items } = body

    if (!empresa || !['MSA', 'PAM', 'MA'].includes(empresa)) {
      return NextResponse.json({ ok: false, error: 'empresa requerida (MSA/PAM/MA)' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'items vacío' }, { status: 400 })
    }

    const output = await computarPreview(empresa, items)
    return NextResponse.json(output)
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}
