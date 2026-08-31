/**
 * GET   /api/gas/config-proveedor?cuit=... — devuelve proveedor + estadísticas FC
 * GET   /api/gas/config-proveedor — devuelve lista de todos los proveedores con sus FCs
 * PATCH /api/gas/config-proveedor — actualiza un proveedor
 * POST  /api/gas/config-proveedor — **da de alta** un proveedor (find-or-create)
 *
 * El nombre quedó de cuando sólo servía a la búsqueda de PDFs, pero esta ruta es
 * hoy la única vía de escritura del maestro `proveedores` (ver CAMPOS_PERMITIDOS).
 * La ficha de proveedor lee por GET /api/proveedores/ficha y escribe por acá.
 *
 * El POST se agregó el 2026-08-31 (A-BUG-93): hasta entonces **no existía ninguna
 * forma de dar de alta un proveedor a mano** — el único INSERT del repo era el
 * importador de ARCA, así que un proveedor sólo nacía si llegaba una factura suya.
 * Se agregó ACÁ y no en una ruta nueva justamente por lo que dice el comentario de
 * abajo: una sola vía de escritura, para que no haya dos verdades.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { altaContraparte } from '@/lib/proveedores/alta'

export const runtime = 'nodejs'

// Ésta es la ÚNICA vía de escritura del maestro `proveedores`: la usan Config PDFs,
// el bucle de Lotes Galicia y la ficha de proveedor. Si hay que poder editar un campo
// nuevo desde algún lado, se agrega acá y no se abre un segundo camino.
const CAMPOS_PERMITIDOS = [
  'fc_modo', 'email_facturacion', 'patron_asunto',
  'dias_busqueda', 'carpeta_drive_id', 'gas_habilitado',
  // Para módulo lotes Galicia
  'email_pagos', 'cbu', 'alias_cbu',
  // Identidad y contacto — editables desde la ficha de proveedor
  'razon_social', 'nombre_fantasia', 'telefono', 'contacto_nombre',
  'notas', 'tags', 'empresa_principal', 'activo',
  'es_proveedor', 'es_cliente',
  // Resto de los datos bancarios (CBU y alias ya estaban arriba)
  'banco', 'tipo_cuenta', 'moneda_cuenta', 'mensaje_transferencia',
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

/**
 * Alta de un proveedor. La lógica vive en `lib/proveedores/alta.ts` para que la compartan
 * todas las vías (ficha, anticipos, y las que falten: ventas y venta de hacienda).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const resultado = await altaContraparte(supabaseAdmin, {
      cuit: body.cuit,
      razon_social: body.razon_social,
      como: body.como === 'cliente' ? 'cliente' : 'proveedor',
    })
    if (!resultado.ok) {
      return NextResponse.json({ ok: false, error: resultado.error }, { status: 400 })
    }
    return NextResponse.json(resultado)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
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
