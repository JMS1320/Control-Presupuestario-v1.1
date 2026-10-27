/**
 * 113 · Conciliar los 11 débitos de las pólizas ANTERIORES de Federación contra sus templates (A-FEAT-1385).
 * OK de JMS 2026-10-27 («dale, conciliá los 11 débitos»). Mismo criterio que el script 108 con los demás débitos:
 * el movimiento queda atado a su template y a su cuota (template_id + template_cuota_id) y la cuota pasa a
 * «conciliado». Los 8 «historico» conservan su estado (como en el 108); los 3 «auditar» de 2026 pasan a
 * «conciliado» con cuenta «Seguros Estructura», como el resto de los débitos de Federación de 2026.
 * El DETALLE del usuario no se toca. Deshacer: scripts/113-polizas-anteriores-conciliar-deshacer.sql
 *
 *   npx tsx scripts/113-polizas-anteriores-conciliar.mts .env.local
 */
import fs from "node:fs"
const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const { createClient } = await import("@supabase/supabase-js")
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const FLOTA = "f995e08d-1f18-4ebc-b077-3b8a1cbbe79b"   // Seguro Flota — póliza 32436252
const AP = "258a2f69-febb-442e-98e5-177d48242896"      // Seguro Accidentes Personales — póliza 9536537
// [movimiento, template, cuota, importe, estado esperado hoy]
const PARES: [string, string, string, number, string][] = [
  ["05bddaf8-c6b3-4747-bdfa-b0c321c01dd3", FLOTA, "9dcba8d1-1b12-4014-8627-50609b7a0d41", 591670.04, "historico"], // 02/07/25 ↔ vence 01/07/25
  ["5beb2cf1-50f8-4cf2-8f87-292fc01aab85", AP, "e6106024-27ef-419e-a839-f83e55604521", 12902.00, "historico"],     // 15/07/25 ↔ 13/07
  ["a86e4cd8-be13-449d-a7a0-985fb1b6f341", AP, "0a925454-3dae-4ef2-84ae-ebb8df6e7b38", 12902.00, "historico"],     // 18/08/25 ↔ 13/08
  ["c81b1780-9f9d-48f5-89d0-db2bfb99ae63", AP, "4699b04b-fe56-4848-beec-6859e5c31dde", 12902.00, "historico"],     // 15/09/25 ↔ 13/09
  ["50f9f2a3-f509-4990-87de-9eca2a76ee86", AP, "94dcfc31-56b8-42f8-8c06-4574bb23d175", 12902.00, "historico"],     // 15/10/25 ↔ 13/10
  ["42e831be-20bc-4dd5-895a-9dd5574b9c18", AP, "3244e4c8-b099-4f1d-878d-03cbc58e0e2b", 12902.00, "historico"],     // 17/11/25 ↔ 13/11
  ["b0dc44e6-fd0a-4bfa-a8c9-c9950fd24060", AP, "5a27e248-5791-45ee-9030-ef604015663f", 12902.00, "historico"],     // 15/12/25 ↔ 13/12
  ["5ea328ae-e63f-411b-bc70-7673e83a422a", AP, "32aa1534-8401-45cd-b935-4c2ee6cf2611", 12902.00, "historico"],     // 15/01/26 ↔ 13/01
  ["07c4d88e-dea2-42e4-87cf-76b399f14dab", AP, "33918839-67fd-4eaf-bf0e-27089e184053", 12902.00, "auditar"],       // 18/02/26 ↔ 13/02
  ["d460aa0d-213b-4bbe-a556-bb9fd2e612ca", AP, "4c72910a-c70e-4f7d-b03b-b15ac5b9e51d", 12902.00, "auditar"],       // 16/03/26 ↔ 13/03
  ["4212b2bd-343d-4827-a74a-90164e991cd5", AP, "ea54085c-3d17-437b-92c5-7fd7f2a9f40f", 12902.94, "auditar"],       // 15/04/26 ↔ 13/04
]

// 1 · Verificar que todo esté como se fotografió (si algo cambió, no se toca nada).
for (const [mov, , cuota, importe, estado] of PARES) {
  const m = (await sb.from("msa_galicia").select("debitos,estado,template_id,template_cuota_id").eq("id", mov).single()).data as any
  const c = (await sb.from("cuotas_egresos_sin_factura").select("monto,estado").eq("id", cuota).single()).data as any
  if (!m || !c || Math.abs(Number(m.debitos) - importe) > 0.005 || m.estado !== estado || m.template_id || m.template_cuota_id
      || Math.abs(Number(c.monto) - importe) > 0.005 || c.estado !== "pendiente")
    throw new Error(`113: ${mov} o su cuota no están como en la foto — no se aplica nada`)
}
// 2 · Aplicar.
for (const [mov, tpl, cuota, , estado] of PARES) {
  const cambio: Record<string, unknown> = { template_id: tpl, template_cuota_id: cuota }
  if (estado === "auditar") { cambio.estado = "conciliado"; cambio.categ = "Seguros Estructura" }
  const r1 = await sb.from("msa_galicia").update(cambio).eq("id", mov)
  if (r1.error) throw new Error(r1.error.message)
  const r2 = await sb.from("cuotas_egresos_sin_factura").update({ estado: "conciliado" }).eq("id", cuota)
  if (r2.error) throw new Error(r2.error.message)
}
// 3 · Control.
const { count } = await sb.from("msa_galicia").select("id", { count: "exact", head: true }).in("template_id", [FLOTA, AP])
const { count: cc } = await sb.from("cuotas_egresos_sin_factura").select("id", { count: "exact", head: true }).in("egreso_id", [FLOTA, AP]).eq("estado", "conciliado")
console.log(`113: movimientos atados ${count} (esperado 11) · cuotas conciliadas ${cc} (esperado 11)`)
