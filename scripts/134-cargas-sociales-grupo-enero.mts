/**
 * 134 · Cargas Sociales MSA: el pago del 6/1/2026 es un GRUPO. OK de JMS 29/10/2026 («enero debería haber sido un
 * grupo y agarrar todas las cuotas»). El banco dice «Cargas Sociales SUSS Octubre Noviembre y Diciembre».
 *  · Cuota 10/11 (período oct): 1.747.803,90 — lo que se intentó debitar el 10/11.
 *  · Cuota 9/12  (período nov): sin importe propio, va dentro de la de enero (no hay desglose nov/dic).
 *  · Cuota 6/1   (período dic): 4.342.432,11 = el resto (nov + dic).
 * El débito del 10/11 y su anulación del mismo día quedan juntos en la cuota repetida, en $0: neto 0.
 * Mismo formato que los grupos existentes: `msa.grupos_pago` + `grupo_pago_id` en las cuotas, y el movimiento
 * guarda el id del GRUPO en `template_cuota_id` (ARQUITECTURA-BD § 6.2).
 * Deshacer: scripts/134-cargas-sociales-grupo-enero-deshacer.sql
 *
 *   npx tsx scripts/134-cargas-sociales-grupo-enero.mts .env.local
 */
import fs from "node:fs"
const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const { createClient } = await import("@supabase/supabase-js")
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const msa = sb.schema("msa")

const GRUPO = "c5a0c131-0000-4000-8000-000000000131"
const C_OCT = "e9786d0b-f3b7-4351-adad-8d4f357b78ba", C_NOV = "187ae62b-9e3d-45c8-a6b1-b49a78069696"
const C_DIC = "8a86d0f4-ae19-48c5-b797-64a7ed80f45a", C_REBOTE = "fa189d24-6f78-4a3f-beac-ebfe2bf77c5b"
const M_DEBITO = "e23b41c8-e9d2-49fc-98cb-e683f23f31a0", M_ANULA = "5f64221c-0fe0-43a5-a1de-fb26863e9b45"
const M_ENERO = "1564fd39-f07b-4da3-a337-9953dd4d632f"

const ok = (r: { error: any }) => { if (r.error) throw new Error(r.error.message) }
// 1 · La foto: si algo cambió, no se toca nada.
const movs = (await sb.from("msa_galicia").select("id,template_cuota_id").in("id", [M_DEBITO, M_ANULA, M_ENERO])).data ?? []
const tc = Object.fromEntries(movs.map((m: any) => [m.id, m.template_cuota_id]))
const cuotas = (await sb.from("cuotas_egresos_sin_factura").select("id,monto,grupo_pago_id").in("id", [C_OCT, C_NOV, C_DIC, C_REBOTE])).data ?? []
const monto = Object.fromEntries(cuotas.map((c: any) => [c.id, Number(c.monto)]))
if (tc[M_DEBITO] !== C_OCT || tc[M_ANULA] !== C_REBOTE || tc[M_ENERO] !== C_DIC || cuotas.some((c: any) => c.grupo_pago_id)
    || Math.abs(monto[C_DIC] - 6090236.01) > 0.005 || Math.abs(monto[C_REBOTE] - 1747803.90) > 0.005)
  throw new Error("134: no está como en la foto — no se aplica nada")

// 2 · Aplicar.
ok(await msa.from("grupos_pago").insert({ id: GRUPO, cuit: "33693450239", proveedor: "ARCA", monto_total: 6090236.01, estado: "conciliado",
  observaciones: "Cargas Sociales SUSS oct + nov + dic 2025, pagadas juntas el 6/1/2026 (script 134)" }))
const cuota = (id: string, cambio: Record<string, unknown>) => sb.from("cuotas_egresos_sin_factura").update(cambio).eq("id", id)
ok(await cuota(C_OCT, { grupo_pago_id: GRUPO, estado: "conciliado", detalle: "Período octubre: el débito del 10/11 rebotó; se pagó en el grupo del 6/1/2026" }))
ok(await cuota(C_NOV, { grupo_pago_id: GRUPO, estado: "conciliado", detalle: "Período noviembre: pagado en el grupo del 6/1/2026; su importe está dentro de la cuota de enero (sin desglose)" }))
ok(await cuota(C_DIC, { grupo_pago_id: GRUPO, estado: "conciliado", monto: 4342432.11, detalle: "Período diciembre + noviembre (sin desglose), en el grupo del 6/1/2026" }))
ok(await cuota(C_REBOTE, { monto: 0, estado: "conciliado", detalle: "Débito del 10/11 anulado el mismo día (rebotó): débito y anulación se compensan, neto 0" }))
ok(await sb.from("msa_galicia").update({ template_cuota_id: C_REBOTE }).eq("id", M_DEBITO))
ok(await sb.from("msa_galicia").update({ template_cuota_id: GRUPO }).eq("id", M_ENERO))

// 3 · Control: las cuotas del grupo suman lo pagado.
const g = (await sb.from("cuotas_egresos_sin_factura").select("monto").eq("grupo_pago_id", GRUPO)).data ?? []
const suma = g.reduce((s: number, c: any) => s + Number(c.monto), 0)
console.log(`134: grupo con ${g.length} cuotas (esperado 3) · suman ${suma.toFixed(2)} (esperado 6090236.01)`)
