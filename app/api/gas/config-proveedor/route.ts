/**
 * GET  /api/gas/config-proveedor?cuit=... — devuelve proveedor + estadísticas FC
 * GET  /api/gas/config-proveedor — devuelve lista de todos los proveedores con sus FCs
 * PATCH /api/gas/config-proveedor — actualiza campos GAS de un proveedor
 *
 * Campos editables vía PATCH:
 *   fc_modo, email_facturacion, patron_asunto, dias_busqueda,
 *   carpeta_drive_id, gas_habilitado
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const CAMPOS_PERMITIDOS = [
  'fc_modo', 'email_facturacion', 'patron_asunto',
  'dias_busqueda', 'carpeta_drive_id', 'gas_habilitado',
]

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const cuit = url.searchParams.get('cuit')

    // Si se pasa cuit, devuelve solo ese proveedor con estadísticas
    if (cuit) {
      const { data: prov, error: errProv } = await supabaseAdmin
        .from('proveedores')
        .select('id, cuit, razon_social, nombre_fantasia, email_facturacion, fc_modo, patron_asunto, dias_busqueda, carpeta_drive_id, gas_habilitado, pdf_ultimo_intento, activo')
        .eq('cuit', cuit)
        .maybeSingle()

      if (errProv) return NextResponse.json({ ok: false, error: errProv.message }, { status: 500 })

      // Estadísticas FC de este proveedor (en los 3 schemas)
      const stats = await statsPorCuit(cuit)

      return NextResponse.json({ ok: true, proveedor: prov, stats })
    }

    // Sin cuit: devuelve lista de proveedores con cantidad de facturas
    // Estrategia: agregar SOLO proveedores que tengan facturas en alguno de los schemas
    const cuitsConFC = await cuitsActivos()
    if (cuitsConFC.size === 0) return NextResponse.json({ ok: true, proveedores: [] })

    const { data: provs, error } = await supabaseAdmin
      .from('proveedores')
      .select('id, cuit, razon_social, email_facturacion, fc_modo, patron_asunto, dias_busqueda, gas_habilitado, pdf_ultimo_intento')
      .in('cuit', Array.from(cuitsConFC))
      .order('razon_social')

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    // Agregar contadores por estado fc
    const proveedoresConStats = await Promise.all((provs || []).map(async (p) => {
      const stats = await statsPorCuit(p.cuit)
      return { ...p, stats }
    }))

    return NextResponse.json({ ok: true, proveedores: proveedoresConStats })

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { proveedor_id, cuit, ...campos } = body

    // Filtrar campos permitidos
    const updateData: Record<string, any> = {}
    for (const k of CAMPOS_PERMITIDOS) {
      if (campos[k] !== undefined) updateData[k] = campos[k]
    }
    updateData.updated_at = new Date().toISOString()

    let q = supabaseAdmin.from('proveedores').update(updateData)
    if (proveedor_id) q = q.eq('id', proveedor_id)
    else if (cuit) q = q.eq('cuit', cuit)
    else return NextResponse.json({ ok: false, error: 'Falta proveedor_id o cuit' }, { status: 400 })

    const { error, data } = await q.select().single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, proveedor: data })

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// ─────────── helpers ───────────

async function cuitsActivos(): Promise<Set<string>> {
  const cuits = new Set<string>()
  for (const schema of ['msa', 'pam', 'ma'] as const) {
    const { data } = await supabaseAdmin.schema(schema).from('comprobantes_arca').select('cuit')
    ;(data || []).forEach((r: any) => r.cuit && cuits.add(r.cuit))
  }
  return cuits
}

async function statsPorCuit(cuit: string): Promise<{ total: number; por_estado: Record<string, number> }> {
  const stats = { total: 0, por_estado: {} as Record<string, number> }
  for (const schema of ['msa', 'pam', 'ma'] as const) {
    const { data } = await supabaseAdmin.schema(schema).from('comprobantes_arca').select('fc').eq('cuit', cuit)
    ;(data || []).forEach((r: any) => {
      stats.total++
      const k = r.fc || '(null)'
      stats.por_estado[k] = (stats.por_estado[k] || 0) + 1
    })
  }
  return stats
}
