/**
 * 💵 Script 188 — MA: los $ 5.000 de Provinvest del 16/03/26 como COBRO A CUENTA del contrato (JMS 03/11: «los 5K son un pago a
 * cuenta en ese contrato sí. Sería bueno dejarlo identificado así después lo vinculo si hace falta»).
 *
 *     npx tsx scripts/188-ma-cobro-a-cuenta-provinvest.mts              ← SIMULA
 *     npx tsx scripts/188-ma-cobro-a-cuenta-provinvest.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * Mismo circuito que la app usa para un cobro a cuenta («Venta 4 Vacas»): fila en `anticipos_proveedores` (tipo cobro, pendiente de
 * vincular, empresa MA) y el crédito del banco atado con `anticipo_id`, conciliado, detalle «ANTICIPO COBRO: …». Se vincula a la
 * factura desde el detalle de cobro cuando JMS quiera.
 * Deshacer: `188-…-deshacer.mts`.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const ESCRIBIR = process.argv.includes("--escribir")
const HECHO = "scripts/188-hecho.json"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { data: ms } = await sb.schema("ma").from("ma_galicia").select("*").eq("fecha", "2026-03-16").eq("creditos", 5000)
const m = ms?.[0]
if (ms?.length !== 1 || m.estado === "conciliado" || m.anticipo_id) { console.log(`🛑 FRENA: ${ms?.length ?? 0} créditos de $ 5.000 el 16/03, o ya está atado`); process.exit(1) }
const desc = "Provinvest — pago a cuenta del contrato de arrendamiento (aceptación de contrato, como el de PAM de ago-25)"
console.log(`${m.fecha} +$ 5.000 → cobro a cuenta de Provinvest (MA), pendiente de vincular · «${desc}»`)
if (!ESCRIBIR) { console.log("(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync(HECHO)) { console.log("🛑 ya corrido"); process.exit(1) }
const { data: a, error } = await sb.from("anticipos_proveedores").insert({ tipo: "cobro", empresa: "MA", cuit_proveedor: "33710346939", nombre_proveedor: "PROVINVEST S.A.",
  monto: 5000, monto_restante: 5000, fecha_pago: m.fecha, descripcion: desc, estado: "pendiente_vincular", estado_pago: "pagado", metodo_pago: "transferencia", visible_contable: false })
  .select("id").single()
if (error) throw error
writeFileSync(HECHO, JSON.stringify({ anticipo: a.id, mov: { id: m.id, estado: m.estado, detalle: m.detalle, anticipo_id: m.anticipo_id, nota_operador: m.nota_operador, motivo_revision: m.motivo_revision } }, null, 2))
const { error: e2 } = await sb.schema("ma").from("ma_galicia").update({ anticipo_id: a.id, estado: "conciliado", motivo_revision: null, detalle: `ANTICIPO COBRO: ${desc}`,
  nota_operador: [String(m.nota_operador || "").trim(), "[script 188] JMS 03/11: pago a cuenta del contrato de Provinvest, pendiente de vincular a su factura"].filter(Boolean).join(" · ") }).eq("id", m.id)
if (e2) throw e2
console.log(`✅ Cobro a cuenta creado (${a.id}) y el crédito atado.`)
