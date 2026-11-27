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
import { notaDelVinculo, deltaStock, type PropuestaRenglon } from "@/lib/productivo/vinculo-renglon"
import { cargarVinculoStock, type CtxVinculoStock } from "@/lib/productivo/vinculo-renglon-db"

export const runtime = "nodejs"

const r2 = (n: number) => Math.round(n * 100) / 100
const cargar = cargarVinculoStock
type Ctx = CtxVinculoStock

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
