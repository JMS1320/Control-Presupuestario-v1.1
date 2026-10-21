/**
 * POST /api/gas/pedir-factura — pedirle al proveedor las facturas que faltan (A-FEAT-1313, 2026-10-21).
 *
 *   accion 'previsualizar' → los mails tal cual van a salir, uno por proveedor, y las facturas de
 *                            proveedores sin mail (no se pueden pedir desde acá)
 *   accion 'borrador' | 'enviar' → UN mail (las facturas de un proveedor): el GAS lo deja en borrador
 *                            o lo envía, con la firma de la casilla. Queda en el historial de cada factura.
 *
 * El texto sale de `armarPedidoProveedor` en las dos acciones: lo que se previsualiza es lo que se manda.
 */
import { NextResponse } from 'next/server'
import { clienteUsuario } from '@/lib/supabase-usuario'
import { exigirSesion, respuestaSinAcceso } from '@/lib/auth/guard-sesion'
import type { Empresa } from '@/lib/gas-pdf/types'
import { pedirAlGas } from '@/lib/gas-pdf/gas-http'
import { armarPedidoProveedor } from '@/lib/gas-pdf/pedido'
import { rotuloFactura } from '@/lib/gas-pdf/lote'

export const runtime = 'nodejs'
export const maxDuration = 60

const schemaDe = (e: Empresa) => (e === 'PAM' ? 'pam' : e === 'MA' ? 'ma' : 'msa')

export async function POST(request: Request) {
  const supabase = await clienteUsuario()
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const body = await request.json() as { accion: string; empresa: Empresa; factura_ids: string[] }
    const empresa = body.empresa
    if (!['MSA', 'PAM', 'MA'].includes(empresa)) return NextResponse.json({ ok: false, error: 'empresa inválida' }, { status: 400 })
    const ids = Array.isArray(body.factura_ids) ? body.factura_ids.slice(0, 300) : []
    if (ids.length === 0) return NextResponse.json({ ok: false, error: 'No hay facturas' }, { status: 400 })
    const schema = schemaDe(empresa)

    const facturas: any[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase.schema(schema).from('comprobantes_arca').select('*').in('id', ids.slice(i, i + 100))
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      facturas.push(...(data || []))
    }
    const cuits = [...new Set(facturas.map(f => f.cuit).filter(Boolean))]
    const { data: provs } = await supabase.from('proveedores').select('cuit, razon_social, email_facturacion').in('cuit', cuits)
    const provDe = new Map<string, any>((provs || []).map((p: any) => [p.cuit, p]))

    // Cuándo se pidió cada una por última vez (para avisar «ya pedida hace N días»)
    const pedida = new Map<string, string>()
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('arca_pdf_busqueda_log').select('factura_id, fecha_hora')
        .eq('resultado', 'pedido').in('factura_id', ids.slice(i, i + 100))
      for (const l of data || []) if (!pedida.has(l.factura_id) || l.fecha_hora > pedida.get(l.factura_id)!) pedida.set(l.factura_id, l.fecha_hora)
    }

    // Agrupa por proveedor: un mail por proveedor
    const grupos = new Map<string, any[]>()
    for (const f of facturas) {
      if (!grupos.has(f.cuit)) grupos.set(f.cuit, [])
      grupos.get(f.cuit)!.push(f)
    }
    const mails: any[] = []
    const sinMail: any[] = []
    for (const [cuit, fs] of grupos) {
      const p = provDe.get(cuit)
      const proveedor = fs[0].denominacion_emisor || p?.razon_social || cuit
      const filas = fs.map(f => ({ id: f.id, rotulo: rotuloFactura(f, f.id), pedida: pedida.get(f.id) || null }))
      const para = String(p?.email_facturacion || '').trim()
      if (!para) { sinMail.push({ cuit, proveedor, facturas: filas }); continue }
      const m = armarPedidoProveedor(empresa, fs.map(f => ({ fecha_emision: f.fecha_emision, comprobante: rotuloFactura(f, f.id), imp_total: f.imp_total })))
      mails.push({ cuit, proveedor, para, ...m, facturas: filas })
    }

    if (body.accion === 'previsualizar') {
      return NextResponse.json({ ok: true, mails, sin_mail: sinMail })
    }

    if (body.accion === 'borrador' || body.accion === 'enviar') {
      if (mails.length !== 1 || sinMail.length > 0) {
        return NextResponse.json({ ok: false, error: 'Se manda de a un proveedor por vez, y tiene que tener mail' }, { status: 400 })
      }
      const url = process.env.GAS_BUSCAR_PDF_URL
      const token = process.env.GAS_AUTH_TOKEN
      if (!url || !token) return NextResponse.json({ ok: false, error: 'GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados' }, { status: 500 })
      const m = mails[0]
      const g = await pedirAlGas(url, { _token: token, accion: 'pedir_factura', modo: body.accion, para: m.para, asunto: m.asunto, texto: m.texto, html: m.html }, 'pedir factura', 45_000)
      if (g.status !== 'ok') return NextResponse.json({ ok: false, error: g.observaciones || 'El GAS no pudo armar el mail (¿está subida la versión 0.19.0?)' }, { status: 502 })
      // Queda en el historial de cada factura: «pedida al proveedor hace N días»
      const obs = `[pedido] ${body.accion === 'enviar' ? 'Pedida al proveedor por mail' : 'Borrador del pedido al proveedor (en Gmail, sin enviar)'} a ${m.para} por ${sesion.user.email || 'usuario'}${g.con_firma ? '' : ' — sin firma'}`
      const { error } = await supabase.from('arca_pdf_busqueda_log').insert(facturas.map(f => ({
        factura_id: f.id, factura_schema: schema, resultado: 'pedido', observaciones: obs,
        cuit_emisor: f.cuit, numero_comprobante: `${f.punto_venta}-${f.numero_desde}`, monto_factura: f.imp_total,
      })))
      return NextResponse.json({ ok: true, modo: body.accion, con_firma: !!g.con_firma, aviso: g.aviso || '', error_registro: error?.message })
    }

    return NextResponse.json({ ok: false, error: `Acción desconocida: ${body.accion}` }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}
