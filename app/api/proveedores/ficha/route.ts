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
 * (`msa_galicia`, `pam_galicia`, `pam_galicia_cc` y, desde 27/10, `ma.ma_galicia`) siguiendo los vínculos
 * que el motor de conciliación escribe — `comprobante_arca_id`,
 * `template_cuota_id`, `anticipo_id` — más un repaso por `proveedor_nombre`
 * para los movimientos que quedaron con el proveedor cargado pero sin vincular
 * a un comprobante.
 *
 * Lo que la ficha NO ve, y por eso se avisa en pantalla: pagos por caja, cheque
 * o tarjeta (no están en estos extractos).
 * ⚠️ Cambió 2026-10-27 (A-FEAT-167): acá decía que tampoco veía «los cobros de una
 * venta (el extracto no tiene columna que vincule un movimiento a
 * `comprobantes_venta`)». La columna existe (`msa_galicia.comprobante_venta_id`):
 * ahora los cobros atados a sus ventas entran, y también las retenciones (las
 * impresas en una liquidación de hacienda y los certificados).
 *
 * 🧾 La CUENTA CORRIENTE se arma acá, con TODO (`cuentaCorriente`), y no en la
 * pantalla con las listas recortadas a 40: con un cliente de mucho movimiento el
 * saldo daba mal. Y lleva su control (`controlCobros`): el saldo de las ventas por
 * cuenta corriente tiene que dar lo mismo que comprobante por comprobante
 * (JMS 27/10: «pueden ser las dos juntas, deben dar lo mismo»).
 *
 * La ESCRITURA no vive acá: va por PATCH /api/gas/config-proveedor, que ya era
 * la vía de escritura del maestro. Una sola, para que no haya dos verdades.
 */

import { NextResponse } from 'next/server'
import { clienteUsuario } from "@/lib/supabase-usuario"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { armarCuentaCorriente } from "@/lib/proveedores/cuenta-corriente"
import { cargarFuentesCobro } from "@/lib/ventas/detalle-cobro-db"
import { controlDosCaminos } from "@/lib/ventas/grupo-cobro"
import { TIPOS_LIQ_HACIENDA } from "@/lib/ventas/cobro-esperado"

export const runtime = 'nodejs'

const EMPRESAS = ['msa', 'pam', 'ma'] as const
/**
 * Los extractos que se leen. ⚠️ Cambió 27/10 (A-FEAT-167): faltaba **`ma.ma_galicia`** (vive en el schema
 * `ma`, no en `public`), así que los pagos y cobros de MA no aparecían en ninguna ficha.
 */
const EXTRACTOS: { tabla: string; schema?: string }[] = [
  { tabla: 'msa_galicia' }, { tabla: 'pam_galicia' }, { tabla: 'pam_galicia_cc' }, { tabla: 'ma_galicia', schema: 'ma' },
]

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
  via: 'factura' | 'template' | 'anticipo' | 'nombre' | 'venta' | 'retencion'
  comprobantes_pagados: string | null
}

export async function GET(request: Request) {
  // Cliente de la SESIÓN, no service_role: así la RLS también gobierna esta ruta (A-SEC-01).
  const supabase = await clienteUsuario()

  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const url = new URL(request.url)
    const cuitParam = url.searchParams.get('cuit')

    // ── Sin cuit: la lista del buscador ─────────────────────────────────────
    if (!cuitParam) {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, cuit, razon_social, nombre_fantasia, es_cliente, es_proveedor, activo')
        .order('razon_social')
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, proveedores: data || [] })
    }

    const cuit = cuitParam.replace(/\D/g, '')
    if (!cuit) return NextResponse.json({ ok: false, error: 'CUIT vacío' }, { status: 400 })

    // ── El maestro ──────────────────────────────────────────────────────────
    const { data: proveedor, error: errProv } = await supabase
      .from('proveedores').select('*').eq('cuit', cuit).maybeSingle()
    if (errProv) return NextResponse.json({ ok: false, error: errProv.message }, { status: 500 })
    if (!proveedor) {
      return NextResponse.json({ ok: false, error: `No hay proveedor con CUIT ${cuit}` }, { status: 404 })
    }

    // ── Facturas de compra (los 3 schemas) ──────────────────────────────────
    const facturas: FacturaFicha[] = []
    const idsFacturas: string[] = []

    for (const empresa of EMPRESAS) {
      const { data } = await supabase.schema(empresa).from('comprobantes_arca')
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

    // ── Facturas de venta, de las 3 empresas ────────────────────────────────
    // ⚠️ Cambió 27/10 (A-FEAT-167): decía «sólo MSA tiene el módulo de ventas»; PAM y MA lo tienen desde
    // el 14/10 (A-FEAT-24) y sus ventas no entraban en la ficha ni en la cuenta corriente.
    const ventasTodas: any[] = []
    for (const empresa of EMPRESAS) {
      const { data, error } = await supabase.schema(empresa).from('comprobantes_venta')
        .select('id, fecha_liquidacion, nro_comprobante, punto_venta, numero_desde, imp_total, estado, cuenta_contable, fecha_cobro_estimada, grano, tipo_operacion, tipo_comprobante, ret_iva, ret_iibb, grupo_cobro_id, cuit_cliente')
        .eq('cuit_cliente', cuit)
        .order('fecha_liquidacion', { ascending: false })
      // Una venta que no se pudo leer haría que la cuenta corriente diga «al día» sin serlo.
      if (error) throw error
      for (const r of (data || []) as any[]) ventasTodas.push({ ...r, __schema: empresa })
    }
    for (const r of ventasTodas) {
      facturas.push({
        id: r.id,
        empresa: String(r.__schema).toUpperCase(),
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
    const { data: egresos } = await supabase
      .from('egresos_sin_factura').select('id').eq('cuit_quien_cobra', cuit)
    const idsEgresos = ((egresos || []) as any[]).map(e => e.id)

    let idsCuotas: string[] = []
    if (idsEgresos.length > 0) {
      const { data: cuotas } = await supabase
        .from('cuotas_egresos_sin_factura').select('id').in('egreso_id', idsEgresos)
      idsCuotas = ((cuotas || []) as any[]).map(c => c.id)
    }

    // ── Anticipos: son un pago en sí mismos, no hace falta el extracto ──────
    const { data: anticipos } = await supabase
      .from('anticipos_proveedores')
      .select('id, fecha_pago, monto, monto_restante, descripcion, estado, estado_pago, metodo_pago')
      .eq('cuit_proveedor', cuit)
      .order('fecha_pago', { ascending: false })
    const idsAnticipos = ((anticipos || []) as any[]).map(a => a.id)

    // ── Los pagos, desde el extracto ────────────────────────────────────────
    const pagos: PagoFicha[] = []
    const yaVisto = new Set<string>()

    const idsVentas = ventasTodas.map(v => v.id)
    const vinculos: Array<[string, string[], PagoFicha['via']]> = [
      ['comprobante_arca_id', idsFacturas, 'factura'],
      ['template_cuota_id', idsCuotas, 'template'],
      ['anticipo_id', idsAnticipos, 'anticipo'],
      // 🧾 A-FEAT-167 — los cobros atados a sus ventas (también los de un cobro agrupado).
      ['comprobante_venta_id', idsVentas, 'venta'],
    ]

    const COLS = 'id, fecha, descripcion, debitos, creditos, detalle, comprobantes_pagados, proveedor_nombre'

    for (const { tabla, schema: sch } of EXTRACTOS) {
      const desde = () => (sch ? supabase.schema(sch) : supabase).from(tabla)
      for (const [columna, ids, via] of vinculos) {
        if (ids.length === 0) continue
        const { data } = await desde().select(COLS).in(columna, ids)
        agregar(data, tabla, via)
      }
      // Repaso por nombre: movimientos con el proveedor cargado pero sin vínculo.
      // Van al final para que el vínculo real gane cuando el movimiento ya entró.
      if (proveedor.razon_social) {
        const { data } = await desde().select(COLS)
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

    // ── Las retenciones de las ventas: bajan lo que el cliente debe, igual que un cobro ──
    // Las impresas en una liquidación de hacienda (la misma cuenta que la pantalla de Cobros) y los
    // certificados cargados aparte. Van con signo de cobro (monto negativo = entró a favor nuestro).
    const nroVenta = new Map(ventasTodas.map(v => [v.id, v.nro_comprobante || numeroComprobante(v.punto_venta, v.numero_desde)]))
    const impresas = (v: any) => (TIPOS_LIQ_HACIENDA.has(Number(v.tipo_comprobante)) ? (Number(v.ret_iibb) || 0) + (Number(v.ret_iva) || 0) : 0)
    for (const v of ventasTodas) {
      const imp = impresas(v)
      if (imp > 0) pagos.push({
        id: `ret-impresa-${v.id}`, origen: 'RETENCIÓN', fecha: v.fecha_liquidacion,
        descripcion: 'Retención impresa en la liquidación', detalle: null, monto: -imp, via: 'retencion',
        comprobantes_pagados: nroVenta.get(v.id) || null,
      })
    }
    for (const empresa of EMPRESAS) {
      const ids = ventasTodas.filter(v => v.__schema === empresa).map(v => v.id)
      if (!ids.length) continue
      const { data: certs, error: eCerts } = await supabase.schema(empresa).from('retenciones_recibidas')
        .select('id, tipo, monto, fecha, nro_certificado, comprobante_venta_id').in('comprobante_venta_id', ids)
      if (eCerts) throw eCerts
      for (const r of (certs || []) as any[]) pagos.push({
        id: `ret-${r.id}`, origen: 'RETENCIÓN', fecha: r.fecha,
        descripcion: `Retención ${String(r.tipo || '').toUpperCase()}${r.nro_certificado ? ` · cert. ${r.nro_certificado}` : ''}`,
        detalle: null, monto: -(Number(r.monto) || 0), via: 'retencion',
        comprobantes_pagados: nroVenta.get(r.comprobante_venta_id) || null,
      })
    }

    pagos.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))

    // ── La cuenta corriente, con TODO (la pantalla recibe las listas recortadas) ──
    const cuentaCorriente = armarCuentaCorriente(facturas as any, pagos as any)

    // ── 🔁 El control: el saldo de las ventas por dos caminos (A-FEAT-167) ──────
    // Camino 1, cuenta corriente: lo vendido − lo que entró del cliente − sus retenciones. «Lo que
    // entró» es todo crédito suyo menos los reintegros de una compra (los atados a una factura de
    // compra o a un template, que no son cobros de una venta).
    // Camino 2, comprobante por comprobante: el saldo del detalle del cobro de cada venta (o de su
    // grupo), la misma cuenta que la pantalla de Cobros.
    let controlCobros: (ReturnType<typeof controlDosCaminos> & { ventas: number }) | null = null
    if (ventasTodas.length) {
      // Las fuentes de cada venta, leídas en SU empresa (sus extractos y sus certificados).
      const fuentes = new Map()
      for (const empresa of EMPRESAS) {
        const deEsta = ventasTodas.filter(v => v.__schema === empresa)
        if (!deEsta.length) continue
        const m = await cargarFuentesCobro(supabase as any, deEsta.map(v => ({ id: v.id, cuit_cliente: v.cuit_cliente })), empresa)
        m.forEach((f, id) => fuentes.set(id, f))
      }
      const cobros = pagos.filter(p => p.monto < 0 && (p.via === 'venta' || p.via === 'anticipo' || p.via === 'nombre'))
        .reduce((s, p) => s - p.monto, 0)
      const retenciones = pagos.filter(p => p.via === 'retencion').reduce((s, p) => s - p.monto, 0)
      controlCobros = {
        ...controlDosCaminos(
          ventasTodas.map(v => ({ id: v.id, esperado: (Number(v.imp_total) || 0) - impresas(v), grupo_cobro_id: v.grupo_cobro_id })),
          fuentes,
          { ventas: ventasTodas.reduce((s, v) => s + (Number(v.imp_total) || 0), 0), cobros, retenciones },
        ),
        ventas: ventasTodas.length,
      }
    }

    // ── Resumen ─────────────────────────────────────────────────────────────
    const compras = facturas.filter(f => f.tipo === 'compra')
    const ventasF = facturas.filter(f => f.tipo === 'venta')
    const resumen = {
      compras: { cantidad: compras.length, total: compras.reduce((s, f) => s + f.total, 0) },
      ventas: { cantidad: ventasF.length, total: ventasF.reduce((s, f) => s + f.total, 0) },
      // Los movimientos del banco: las retenciones van a la cuenta corriente, no son un movimiento.
      pagos: { cantidad: pagos.filter(p => p.via !== 'retencion').length, total: pagos.filter(p => p.via !== 'retencion').reduce((s, p) => s + p.monto, 0) },
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
      cuentaCorriente,
      controlCobros,
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
