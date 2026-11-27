/**
 * POST /api/facturas/vincular-stock — la factura de insumos con su ENTRADA AL STOCK, renglón por renglón (A-FEAT-1663 stock paso 1).
 *
 * `{ empresa, comprobante_id, accion, ... }`:
 *   · `ver`        → las propuestas por renglón + los vínculos que ya tiene (no escribe nada);
 *   · `auto`       → vincula SOLA los renglones inequívocos (las seis condiciones de `lib/productivo/vinculo-renglon.ts`),
 *                    marcándolos «✨ vinculada sola — revisá», y devuelve lo mismo que `ver`;
 *   · `vincular`   → `{ n, movimiento_id }`: este renglón con esa entrada (gesto de JMS);
 *   · `registrar`  → `{ n, insumo_stock_id }`: carga la entrada con los datos de la factura y la vincula;
 *   · `insumo`     → `{ n, insumo_stock_id }`: qué insumo del stock es este renglón (lo aprende para la próxima);
 *   · `revisado`   → `{ vinculo_id }`: JMS miró el vínculo solo y está bien;
 *   · `deshacer`   → `{ vinculo_id }`: lo deja como estaba (la entrada vuelve a sus kilos y precio, o se borra si la cargó la factura),
 *                    y si era automático, ese renglón no se vuelve a vincular solo.
 *
 * Al vincular, LA FACTURA MANDA (JMS 26/11): la entrada toma sus kilos y su precio (neto, en la unidad del stock), el stock se mueve
 * por la diferencia, y la huella (lo que tenía la entrada) queda en `entrega_factura.antes` y en la nota. Con la sesión del usuario (RLS).
 */
import { NextResponse } from "next/server"
import { clienteUsuario } from "@/lib/supabase-usuario"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { proponerPorRenglon, notaDelVinculo, deltaStock, normalizarDescripcion, VENTANA_ANTES, VENTANA_DESPUES,
  type EntradaLibre, type PropuestaRenglon, type RenglonFactura } from "@/lib/productivo/vinculo-renglon"

export const runtime = "nodejs"

const schemaDe = (e: string) => (e === "PAM" ? "pam" : e === "MA" ? "ma" : "msa")
const sumar = (f: string, d: number) => { const x = new Date(f + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10) }
const r2 = (n: number) => Math.round(n * 100) / 100

async function cargar(sb: any, empresa: string, id: string) {
  const { data: f } = await sb.schema(schemaDe(empresa)).from("comprobantes_arca")
    .select("id, fecha_emision, cuit, denominacion_emisor, moneda, tipo_cambio, punto_venta, numero_desde").eq("id", id).maybeSingle()
  if (!f) return null
  const prod = sb.schema("productivo")
  const [{ data: lect }, { data: rens }, { data: insumos }, { data: movs }, { data: vincs }, { data: aprendRaw }] = await Promise.all([
    sb.from("factura_lecturas").select("estado, tipo_cambio, moneda").eq("empresa", empresa).eq("comprobante_id", id).maybeSingle(),
    sb.from("factura_renglones").select("id, n, descripcion, cantidad, unidad, neto, insumo_stock_id, no_vincular_solo").eq("empresa", empresa).eq("comprobante_id", id).order("n"),
    prod.from("stock_insumos").select("id, producto, unidad_medida"),
    prod.from("movimientos_insumos").select("id, fecha, insumo_stock_id, cantidad, costo_unitario, proveedor, cuit")
      .eq("tipo", "compra").gte("fecha", sumar(f.fecha_emision, -VENTANA_ANTES)).lte("fecha", sumar(f.fecha_emision, VENTANA_DESPUES)),
    prod.from("entrega_factura").select("id, movimiento_id, factura_id, cantidad, precio_unitario, notas, renglon_n, automatico, antes, revisado_at, revisado_por, movimiento:movimientos_insumos(fecha, cantidad, insumo_stock_id, stock_insumos(producto, unidad_medida))"),
    sb.from("factura_renglones").select("comprobante_id, descripcion, insumo_stock_id").eq("empresa", empresa).not("insumo_stock_id", "is", null),
  ])
  const conFactura = new Set((vincs || []).map((v: any) => v.movimiento_id))
  const entradas: EntradaLibre[] = (movs || []).filter((m: any) => !conFactura.has(m.id)).map((m: any) => ({
    id: m.id, fecha: m.fecha, insumoStockId: m.insumo_stock_id, cantidad: Number(m.cantidad) || 0,
    costoUnitario: m.costo_unitario == null ? null : Number(m.costo_unitario), proveedor: m.proveedor, cuit: m.cuit,
  }))
  const idsAp = [...new Set((aprendRaw || []).map((a: any) => a.comprobante_id))]
  const { data: cuits } = idsAp.length ? await sb.schema(schemaDe(empresa)).from("comprobantes_arca").select("id, cuit").in("id", idsAp) : { data: [] }
  const cuitDe = new Map((cuits || []).map((c: any) => [c.id, String(c.cuit || "")]))
  const aprendidos = (aprendRaw || []).filter((a: any) => a.comprobante_id !== id)
    .map((a: any) => ({ cuit: cuitDe.get(a.comprobante_id) || "", descripcion: normalizarDescripcion(a.descripcion), insumoStockId: a.insumo_stock_id }))
  const vinculos = (vincs || []).filter((v: any) => v.factura_id === id)
  const renglones: RenglonFactura[] = (rens || []).map((r: any) => ({
    n: r.n, descripcion: r.descripcion, cantidad: r.cantidad == null ? null : Number(r.cantidad), unidad: r.unidad,
    neto: r.neto == null ? null : Number(r.neto), insumoStockId: r.insumo_stock_id, noVincularSolo: !!r.no_vincular_solo,
  }))
  const moneda = lect?.moneda || (!f.moneda || f.moneda === "PES" ? "ARS" : f.moneda)
  const tipoCambio = Number(lect?.tipo_cambio) || Number(f.tipo_cambio) || null
  // Los renglones que ya tienen su vínculo (por número, o uno viejo sin número del mismo insumo) no se proponen otra vez.
  const vinculado = (r: RenglonFactura) => vinculos.some((v: any) => v.renglon_n === r.n ||
    (v.renglon_n == null && r.insumoStockId && v.movimiento?.insumo_stock_id === r.insumoStockId))
  const pendientes = renglones.filter(r => !vinculado(r))
  const propuestas = proponerPorRenglon({
    factura: { fecha: f.fecha_emision, cuit: f.cuit, proveedor: f.denominacion_emisor || "", moneda, tipoCambio, estadoLectura: lect?.estado ?? null },
    renglones: pendientes, entradas, aprendidos,
    insumos: (insumos || []).map((i: any) => ({ id: i.id, producto: i.producto, unidad: i.unidad_medida })),
  })
  const numero = `${String(f.punto_venta ?? "").padStart(4, "0")}-${String(f.numero_desde ?? "").padStart(8, "0")}`
  return { f, numero, moneda, tipoCambio, renglones, propuestas, vinculos, entradas, insumos: insumos || [] }
}
type Ctx = NonNullable<Awaited<ReturnType<typeof cargar>>>

async function moverStock(prod: any, insumoId: string, delta: number, precio: number | null) {
  const { data: st } = await prod.from("stock_insumos").select("cantidad, costo_unitario").eq("id", insumoId).single()
  const upd: any = { cantidad: r2((Number(st?.cantidad) || 0) + delta) }
  // Default del dato real: el insumo sin costo toma el de esta factura; uno ya cargado no se pisa.
  if (precio != null && !(Number(st?.costo_unitario) > 0)) upd.costo_unitario = precio
  const { error } = await prod.from("stock_insumos").update(upd).eq("id", insumoId)
  if (error) throw new Error("stock: " + error.message)
}

async function aplicar(sb: any, empresa: string, ctx: Ctx, p: PropuestaRenglon, entradaId: string | null, insumoId: string, automatico: boolean) {
  const prod = sb.schema("productivo")
  const r = ctx.renglones.find(x => x.n === p.n)!
  const usd = ctx.moneda !== "ARS"
  const tc = usd ? (Number(ctx.tipoCambio) || 0) : 1
  const ins = ctx.insumos.find((i: any) => i.id === insumoId)
  if (entradaId) {
    const { data: m, error: eM } = await prod.from("movimientos_insumos")
      .select("id, cantidad, costo_unitario, monto_total, cuit, moneda, costo_unitario_moneda, tipo_cambio, insumo_stock_id").eq("id", entradaId).single()
    if (eM || !m) throw new Error("No encontré la entrada al stock.")
    if (ctx.vinculos.some((v: any) => v.movimiento_id === entradaId)) throw new Error("Esa entrada ya está vinculada a esta factura.")
    const { data: otra } = await prod.from("entrega_factura").select("id").eq("movimiento_id", entradaId).limit(1)
    if ((otra || []).length) throw new Error("Esa entrada ya tiene otra factura.")
    const cantidad = p.cantidadStock ?? (Number(m.cantidad) || 0)
    const precio = p.precioStock ?? (cantidad > 0 && r.neto != null && tc > 0 ? (r.neto * tc) / cantidad : null)
    if (!(cantidad > 0)) throw new Error("La cantidad no puede ser cero.")
    const antes = { cantidad: Number(m.cantidad), costo_unitario: m.costo_unitario == null ? null : Number(m.costo_unitario), monto_total: m.monto_total,
      cuit: m.cuit, moneda: m.moneda, costo_unitario_moneda: m.costo_unitario_moneda, tipo_cambio: m.tipo_cambio }
    const upd: any = { cantidad, costo_unitario: precio, monto_total: precio == null ? m.monto_total : r2(cantidad * precio),
      moneda: usd ? "USD" : "ARS", costo_unitario_moneda: usd && precio != null ? precio / tc : null, tipo_cambio: usd ? tc : null }
    if (!m.cuit && ctx.f.cuit) upd.cuit = ctx.f.cuit
    const { error: eU } = await prod.from("movimientos_insumos").update(upd).eq("id", entradaId)
    if (eU) throw new Error("entrada: " + eU.message)
    const nota = notaDelVinculo({ cantidadStock: cantidad, precioStock: precio }, { cantidad: antes.cantidad, costoUnitario: antes.costo_unitario }, ins?.unidad_medida ?? null, automatico, ctx.numero)
    const { error: eV } = await prod.from("entrega_factura").insert({ movimiento_id: entradaId, factura_id: ctx.f.id, empresa, origen: "arca",
      cantidad, precio_unitario: precio, notas: nota, renglon_n: p.n, automatico, antes })
    if (eV) { await prod.from("movimientos_insumos").update(antes).eq("id", entradaId); throw new Error("vínculo: " + eV.message) }
    await moverStock(prod, m.insumo_stock_id, deltaStock(antes.cantidad, cantidad), precio)
  } else {
    const cantidad = p.cantidadStock
    if (!(Number(cantidad) > 0)) throw new Error(`No sé convertir «${r.unidad ?? "?"}» a la unidad del stock: cargá la entrada a mano.`)
    const precio = p.precioStock
    const { data: nuevo, error: eI } = await prod.from("movimientos_insumos").insert({
      fecha: ctx.f.fecha_emision, insumo_stock_id: insumoId, tipo: "compra", cantidad, costo_unitario: precio,
      monto_total: precio == null ? null : r2(cantidad! * precio), proveedor: ctx.f.denominacion_emisor, cuit: ctx.f.cuit, empresa,
      moneda: usd ? "USD" : "ARS", costo_unitario_moneda: usd && precio != null ? precio / tc : null, tipo_cambio: usd ? tc : null,
      observaciones: `Entrada cargada desde la factura ${ctx.numero} (renglón ${p.n}: ${r.descripcion})`,
    }).select("id").single()
    if (eI || !nuevo) throw new Error("entrada: " + (eI?.message || "no se creó"))
    const nota = notaDelVinculo({ cantidadStock: cantidad, precioStock: precio }, null, ins?.unidad_medida ?? null, automatico, ctx.numero)
    const { error: eV } = await prod.from("entrega_factura").insert({ movimiento_id: nuevo.id, factura_id: ctx.f.id, empresa, origen: "arca",
      cantidad, precio_unitario: precio, notas: nota, renglon_n: p.n, automatico, antes: { creado: true } })
    if (eV) { await prod.from("movimientos_insumos").delete().eq("id", nuevo.id); throw new Error("vínculo: " + eV.message) }
    await moverStock(prod, insumoId, cantidad!, precio)
  }
  // Lo aprende: este artículo de este proveedor es este insumo (la próxima factura se vincula sola).
  await sb.from("factura_renglones").update({ insumo_stock_id: insumoId, updated_at: new Date().toISOString() })
    .eq("empresa", empresa).eq("comprobante_id", ctx.f.id).eq("n", p.n)
}

async function deshacer(sb: any, empresa: string, vinculoId: string) {
  const prod = sb.schema("productivo")
  const { data: v } = await prod.from("entrega_factura").select("id, movimiento_id, factura_id, cantidad, renglon_n, automatico, antes").eq("id", vinculoId).single()
  if (!v) throw new Error("No encontré el vínculo.")
  if (!v.antes) throw new Error("Este vínculo es anterior a la huella: se deshace desde el modal de vincular compras (⋯ de la factura).")
  const { data: m } = await prod.from("movimientos_insumos").select("id, cantidad, insumo_stock_id").eq("id", v.movimiento_id).single()
  if (!m) throw new Error("No encontré la entrada.")
  if (v.antes.creado) {
    const { error } = await prod.from("movimientos_insumos").delete().eq("id", m.id)   // el vínculo se va con ella (cascade)
    if (error) throw new Error(error.message)
    await moverStock(prod, m.insumo_stock_id, -Number(m.cantidad), null)
  } else {
    const { error: eD } = await prod.from("entrega_factura").delete().eq("id", v.id)
    if (eD) throw new Error(eD.message)
    const { error: eU } = await prod.from("movimientos_insumos").update(v.antes).eq("id", m.id)
    if (eU) throw new Error(eU.message)
    await moverStock(prod, m.insumo_stock_id, deltaStock(Number(m.cantidad), Number(v.antes.cantidad)), null)
  }
  if (v.automatico && v.renglon_n != null)
    await sb.from("factura_renglones").update({ no_vincular_solo: true }).eq("empresa", empresa).eq("comprobante_id", v.factura_id).eq("n", v.renglon_n)
}

const respuesta = (ctx: Ctx, extra: Record<string, unknown> = {}) => NextResponse.json({
  ok: true, ...extra,
  propuestas: ctx.propuestas,
  vinculos: ctx.vinculos,
  entradas: ctx.entradas,
  insumos: ctx.insumos,
})

export async function POST(request: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  const sb: any = await clienteUsuario()
  const quien = sesion.user.email || null
  let b: any = {}
  try { b = await request.json() } catch { /* vacío */ }
  const empresa = ["MSA", "PAM", "MA"].includes(String(b.empresa)) ? String(b.empresa) : "MSA"
  const id = String(b.comprobante_id || "")
  const accion = String(b.accion || "ver")
  if (!id) return NextResponse.json({ ok: false, error: "Falta la factura." }, { status: 400 })
  try {
    let ctx = await cargar(sb, empresa, id)
    if (!ctx) return NextResponse.json({ ok: false, error: "No encontré la factura." }, { status: 404 })
    if (accion === "ver") return respuesta(ctx)
    if (accion === "auto") {
      const autos = ctx.propuestas.filter(p => p.estado === "auto")
      for (const p of autos) await aplicar(sb, empresa, ctx, p, p.entrada!.id, p.insumoStockId!, true)
      if (autos.length) ctx = (await cargar(sb, empresa, id))!
      return respuesta(ctx, { vinculadasSolas: autos.length })
    }
    if (accion === "vincular" || accion === "registrar") {
      const n = Number(b.n)
      const insumoId = String(b.insumo_stock_id || "") || ctx.propuestas.find(p => p.n === n)?.insumoStockId || ""
      if (!insumoId) return NextResponse.json({ ok: false, error: "Elegí qué insumo del stock es." }, { status: 400 })
      // Si eligió otro insumo, se recalcula la propuesta con ése (unidad y precio).
      if (insumoId !== ctx.propuestas.find(p => p.n === n)?.insumoStockId) {
        await sb.from("factura_renglones").update({ insumo_stock_id: insumoId }).eq("empresa", empresa).eq("comprobante_id", id).eq("n", n)
        ctx = (await cargar(sb, empresa, id))!
      }
      const p = ctx.propuestas.find(x => x.n === n)
      if (!p) return NextResponse.json({ ok: false, error: "Ese renglón ya está vinculado." }, { status: 409 })
      await aplicar(sb, empresa, ctx, p, accion === "vincular" ? String(b.movimiento_id || "") || null : null, insumoId, false)
      return respuesta((await cargar(sb, empresa, id))!)
    }
    if (accion === "insumo") {
      const { error } = await sb.from("factura_renglones").update({ insumo_stock_id: b.insumo_stock_id || null, updated_at: new Date().toISOString() })
        .eq("empresa", empresa).eq("comprobante_id", id).eq("n", Number(b.n))
      if (error) throw new Error(error.message)
      return respuesta((await cargar(sb, empresa, id))!)
    }
    if (accion === "revisado") {
      const { error } = await sb.schema("productivo").from("entrega_factura").update({ revisado_at: new Date().toISOString(), revisado_por: quien }).eq("id", String(b.vinculo_id))
      if (error) throw new Error(error.message)
      return respuesta((await cargar(sb, empresa, id))!)
    }
    if (accion === "deshacer") {
      await deshacer(sb, empresa, String(b.vinculo_id))
      return respuesta((await cargar(sb, empresa, id))!)
    }
    return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
