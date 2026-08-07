/**
 * GET /api/proveedores/ficha           → lista liviana para el buscador
 * GET /api/proveedores/ficha?cuit=...  → ficha completa de un proveedor
 *
 * La ficha junta lo que hoy está desparramado: los datos del maestro
 * (`public.proveedores`, las 29 columnas), sus facturas y sus pagos.
 *
 * ⚠️ De dónde salen los PAGOS. `comprobantes_arca.fecha_pago` y
 * `cuotas_egresos_sin_factura.fecha_pago` están casi vacíos (12 de 384 facturas,
 * 8 de 935 cuotas al 2026-08-07): el pago real queda registrado cuando el
 * movimiento del extracto se concilia. Por eso los pagos se leen del extracto
 * (`msa_galicia`, `pam_galicia`, `pam_galicia_cc`) siguiendo los tres vínculos
 * que el motor de conciliación escribe — `comprobante_arca_id`,
 * `template_cuota_id`, `anticipo_id` — más un repaso por `proveedor_nombre`
 * para los movimientos que quedaron con el proveedor cargado pero sin vincular
 * a un comprobante.
 *
 * Lo que la ficha NO ve, y por eso se avisa en pantalla: pagos por caja, cheque
 * o tarjeta (no están en estos extractos) y los cobros de una venta (el extracto
 * no tiene columna que vincule un movimiento a `comprobantes_venta`).
 *
 * La ESCRITURA no vive acá: va por PATCH /api/gas/config-proveedor, que ya era
 * la vía de escritura del maestro. Una sola, para que no haya dos verdades.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const EMPRESAS = ['msa', 'pam', 'ma'] as const
const EXTRACTOS = ['msa_galicia', 'pam_galicia', 'pam_galicia_cc'] as const

/** Tope por lista: la ficha es para mirar, no para auditar el histórico entero. */
const TOPE = 40

export interface FacturaFicha {
  id: string
  empresa: string
  tipo: 'compra' | 'venta'
  fecha: string | null
  numero: string
  descripcion: string | null
  total: number
  estado: string | null
  cuenta_contable: string | null
  /** Sólo compras: el estado del PDF (Buscar / Portal / NO / Sí) */
  fc?: string | null
  /** Sólo ventas: cuándo se espera cobrarla */
  fecha_cobro_estimada?: string | null
}

export interface PagoFicha {
  id: string
  origen: string
  fecha: string | null
  descripcion: string | null
  detalle: string | null
  monto: number
  /** Cómo se supo que este movimiento es de este proveedor */
  via: 'factura' | 'template' | 'anticipo' | 'nombre'
  comprobantes_pagados: string | null
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const cuitParam = url.searchParams.get('cuit')

    // ── Sin cuit: la lista del buscador ─────────────────────────────────────
    if (!cuitParam) {
      const { data, error } = await supabaseAdmin
        .from('proveedores')
        .select('id, cuit, razon_social, nombre_fantasia, es_cliente, es_proveedor, activo')
        .order('razon_social')
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, proveedores: data || [] })
    }

    const cuit = cuitParam.replace(/\D/g, '')
    if (!cuit) return NextResponse.json({ ok: false, error: 'CUIT vacío' }, { status: 400 })

    // ── El maestro ──────────────────────────────────────────────────────────
    const { data: proveedor, error: errProv } = await supabaseAdmin
      .from('proveedores').select('*').eq('cuit', cuit).maybeSingle()
    if (errProv) return NextResponse.json({ ok: false, error: errProv.message }, { status: 500 })
    if (!proveedor) {
      return NextResponse.json({ ok: false, error: `No hay proveedor con CUIT ${cuit}` }, { status: 404 })
    }

    // ── Facturas de compra (los 3 schemas) ──────────────────────────────────
    const facturas: FacturaFicha[] = []
    const idsFacturas: string[] = []

    for (const empresa of EMPRESAS) {
      const { data } = await supabaseAdmin.schema(empresa).from('comprobantes_arca')
        .select('id, fecha_emision, tipo_comprobante_desc, punto_venta, numero_desde, imp_total, estado, cuenta_contable, fc, detalle')
        .eq('cuit', cuit)
        .order('fecha_emision', { ascending: false })
      for (const r of (data || []) as any[]) {
        idsFacturas.push(r.id)
        facturas.push({
          id: r.id,
          empresa: empresa.toUpperCase(),
          tipo: 'compra',
          fecha: r.fecha_emision,
          numero: numeroComprobante(r.punto_venta, r.numero_desde),
          descripcion: r.tipo_comprobante_desc || r.detalle || null,
          total: Number(r.imp_total) || 0,
          estado: r.estado,
          cuenta_contable: r.cuenta_contable,
          fc: r.fc,
        })
      }
    }

    // ── Facturas de venta (sólo MSA tiene el módulo de ventas) ──────────────
    const { data: ventas } = await supabaseAdmin.schema('msa').from('comprobantes_venta')
      .select('id, fecha_liquidacion, nro_comprobante, punto_venta, numero_desde, imp_total, estado, cuenta_contable, fecha_cobro_estimada, grano, tipo_operacion')
      .eq('cuit_cliente', cuit)
      .order('fecha_liquidacion', { ascending: false })
    for (const r of (ventas || []) as any[]) {
      facturas.push({
        id: r.id,
        empresa: 'MSA',
        tipo: 'venta',
        fecha: r.fecha_liquidacion,
        numero: r.nro_comprobante || numeroComprobante(r.punto_venta, r.numero_desde),
        descripcion: [r.tipo_operacion, r.grano].filter(Boolean).join(' · ') || null,
        total: Number(r.imp_total) || 0,
        estado: r.estado,
        cuenta_contable: r.cuenta_contable,
        fecha_cobro_estimada: r.fecha_cobro_estimada,
      })
    }

    facturas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

    // ── Cuotas de templates de este proveedor (cobra sin factura) ───────────
    const { data: egresos } = await supabaseAdmin
      .from('egresos_sin_factura').select('id').eq('cuit_quien_cobra', cuit)
    const idsEgresos = ((egresos || []) as any[]).map(e => e.id)

    let idsCuotas: string[] = []
    if (idsEgresos.length > 0) {
      const { data: cuotas } = await supabaseAdmin
        .from('cuotas_egresos_sin_factura').select('id').in('egreso_id', idsEgresos)
      idsCuotas = ((cuotas || []) as any[]).map(c => c.id)
    }

    // ── Anticipos: son un pago en sí mismos, no hace falta el extracto ──────
    const { data: anticipos } = await supabaseAdmin
      .from('anticipos_proveedores')
      .select('id, fecha_pago, monto, monto_restante, descripcion, estado, estado_pago, metodo_pago')
      .eq('cuit_proveedor', cuit)
      .order('fecha_pago', { ascending: false })
    const idsAnticipos = ((anticipos || []) as any[]).map(a => a.id)

    // ── Los pagos, desde el extracto ────────────────────────────────────────
    const pagos: PagoFicha[] = []
    const yaVisto = new Set<string>()

    const vinculos: Array<[string, string[], PagoFicha['via']]> = [
      ['comprobante_arca_id', idsFacturas, 'factura'],
      ['template_cuota_id', idsCuotas, 'template'],
      ['anticipo_id', idsAnticipos, 'anticipo'],
    ]

    const COLS = 'id, fecha, descripcion, debitos, creditos, detalle, comprobantes_pagados, proveedor_nombre'

    for (const tabla of EXTRACTOS) {
      for (const [columna, ids, via] of vinculos) {
        if (ids.length === 0) continue
        const { data } = await supabaseAdmin.from(tabla).select(COLS).in(columna, ids)
        agregar(data, tabla, via)
      }
      // Repaso por nombre: movimientos con el proveedor cargado pero sin vínculo.
      // Van al final para que el vínculo real gane cuando el movimiento ya entró.
      if (proveedor.razon_social) {
        const { data } = await supabaseAdmin.from(tabla).select(COLS)
          .eq('proveedor_nombre', proveedor.razon_social)
        agregar(data, tabla, 'nombre')
      }
    }

    function agregar(data: any, tabla: string, via: PagoFicha['via']) {
      for (const r of ((data || []) as any[])) {
        const clave = `${tabla}|${r.id}`
        if (yaVisto.has(clave)) continue
        yaVisto.add(clave)
        pagos.push({
          id: r.id,
          origen: tabla.replace(/_/g, ' ').toUpperCase(),
          fecha: r.fecha,
          descripcion: r.descripcion,
          detalle: r.detalle,
          // El débito es lo que salió; si vino por crédito, es una devolución/cobro
          monto: (Number(r.debitos) || 0) - (Number(r.creditos) || 0),
          via,
          comprobantes_pagados: r.comprobantes_pagados,
        })
      }
    }

    pagos.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

    // ── Resumen ─────────────────────────────────────────────────────────────
    const compras = facturas.filter(f => f.tipo === 'compra')
    const ventasF = facturas.filter(f => f.tipo === 'venta')
    const resumen = {
      compras: { cantidad: compras.length, total: compras.reduce((s, f) => s + f.total, 0) },
      ventas: { cantidad: ventasF.length, total: ventasF.reduce((s, f) => s + f.total, 0) },
      pagos: { cantidad: pagos.length, total: pagos.reduce((s, p) => s + p.monto, 0) },
      anticipos: {
        cantidad: (anticipos || []).length,
        pendiente: ((anticipos || []) as any[]).reduce((s, a) => s + (Number(a.monto_restante) || 0), 0),
      },
      ultimaFactura: facturas[0]?.fecha ?? null,
      ultimoPago: pagos[0]?.fecha ?? null,
    }

    return NextResponse.json({
      ok: true,
      proveedor,
      facturas: facturas.slice(0, TOPE),
      facturasTotales: facturas.length,
      pagos: pagos.slice(0, TOPE),
      pagosTotales: pagos.length,
      anticipos: anticipos || [],
      resumen,
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

function numeroComprobante(puntoVenta: number | null, numeroDesde: number | null): string {
  if (puntoVenta == null && numeroDesde == null) return '—'
  const pv = String(puntoVenta ?? 0).padStart(5, '0')
  const nro = String(numeroDesde ?? 0).padStart(8, '0')
  return `${pv}-${nro}`
}
