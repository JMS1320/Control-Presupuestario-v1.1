/**
 * 130 · Conciliar 7 débitos de Federación Patronal contra la cuota de SU póliza (A-FEAT-1416).
 * OK de JMS 2026-10-29 («concilia los 7 por ahora»). Salen de `scripts/diagnostico-polizas-conciliacion.mts`.
 *
 * Mismo criterio que los scripts 108 y 113: el movimiento queda atado a su template y a su cuota
 * (template_id + template_cuota_id), pasa a «conciliado» con cuenta «Seguros Estructura», y la cuota pasa a
 * «conciliado». El DETALLE del usuario no se toca.
 * - 6 «pendiente» (categ «INVALIDA:»): AP 10183421 may→sep-26 y AP PAM 10413411 may-26.
 * - 1 «auditar»: Vida 698548 sep-26, hoy atado a la FACTURA (comprobante_arca_id). Se ata a su cuota, como el
 *   débito de la 670821 de sep-25, y se suelta la factura (el estado de la factura NO se toca).
 * Deshacer: scripts/130-federacion-conciliar-7-deshacer.sql
 *
 *   npx tsx scripts/130-federacion-conciliar-7.mts .env.local
 */
import fs from "node:fs"
const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const { createClient } = await import("@supabase/supabase-js")
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const AP_MSA = "a70805ab-dd68-4a23-a5ae-a2101fd015ac"   // Seguro Accidentes Personales — póliza 10183421 (MSA)
const AP_PAM = "4711fee7-dc84-4bfb-9f0a-fbf1c5544670"   // Seguro Accidentes Personales — póliza 10413411 (PAM)
const VIDA = "4dbef0d2-9d19-4f9d-a208-7793412cbbf5"     // Seguro Vida Colectivo — póliza 698548
const FACTURA_VIDA = "12e9a096-cb64-47a7-a9bf-49a8a30f25e1"
// [movimiento, template, cuota, importe, estado esperado hoy]
const PARES: [string, string, string, number, string][] = [
  ["cf12f160-f03d-4847-a08b-11a48a28a443", AP_MSA, "be00908e-a6d9-4016-9d7b-fdbed6a7b581", 48996.00, "pendiente"], // 06/05/26 ↔ 06/05
  ["870e7113-ad05-49bc-baab-3b2529f1a13b", AP_PAM, "7ee41faa-4c09-412b-bf74-f06b83253baf", 16982.00, "pendiente"], // 15/05/26 ↔ 13/05
  ["09c0758e-ccac-4ded-bbaf-4c7626eae21d", AP_MSA, "3a705643-4856-4379-8646-ce395e4f506a", 32634.00, "pendiente"], // 08/06/26 ↔ 06/06
  ["b90b4f2f-21b0-46cb-823a-0cebd7026a70", AP_MSA, "7f1707b9-3681-441f-9469-abf4ac2e5d6d", 32634.00, "pendiente"], // 06/07/26 ↔ 06/07
  ["f09ab775-dd62-4b25-ac23-47ce91c8173e", AP_MSA, "fb44f160-c5c1-42c0-ac24-0f2de3ad28ce", 32634.00, "pendiente"], // 06/08/26 ↔ 06/08
  ["a3b8af66-115b-430a-8ae0-879c3a39435c", AP_MSA, "67015248-4959-4085-b234-876e9dfa62bd", 32634.00, "pendiente"], // 07/09/26 ↔ 06/09
  ["d73e929c-ad71-46cd-a91a-aba2d9615013", VIDA, "55429027-2bf5-4f08-b869-8f0c58cfd899", 287650.23, "auditar"],   // 10/09/26 ↔ 10/09
]

// 1 · Verificar que todo esté como se fotografió (si algo cambió, no se toca nada).
for (const [mov, , cuota, importe, estado] of PARES) {
  const m = (await sb.from("msa_galicia").select("debitos,estado,template_id,template_cuota_id,comprobante_arca_id").eq("id", mov).single()).data as any
  const c = (await sb.from("cuotas_egresos_sin_factura").select("monto,estado").eq("id", cuota).single()).data as any
  const facturaOk = estado === "auditar" ? m?.comprobante_arca_id === FACTURA_VIDA : !m?.comprobante_arca_id
  if (!m || !c || Math.abs(Number(m.debitos) - importe) > 0.005 || m.estado !== estado || m.template_id || m.template_cuota_id || !facturaOk
      || Math.abs(Number(c.monto) - importe) > 0.005 || c.estado !== "pendiente")
    throw new Error(`130: ${mov} o su cuota no están como en la foto — no se aplica nada`)
}
// 2 · Aplicar.
for (const [mov, tpl, cuota, , estado] of PARES) {
  const cambio: Record<string, unknown> = { template_id: tpl, template_cuota_id: cuota, estado: "conciliado", categ: "Seguros Estructura" }
  if (estado === "auditar") cambio.comprobante_arca_id = null
  const r1 = await sb.from("msa_galicia").update(cambio).eq("id", mov)
  if (r1.error) throw new Error(r1.error.message)
  const r2 = await sb.from("cuotas_egresos_sin_factura").update({ estado: "conciliado" }).eq("id", cuota)
  if (r2.error) throw new Error(r2.error.message)
}
// 3 · Control.
const movs = PARES.map(p => p[0]), cuotas = PARES.map(p => p[2])
const { count } = await sb.from("msa_galicia").select("id", { count: "exact", head: true }).in("id", movs).eq("estado", "conciliado").not("template_cuota_id", "is", null)
const { count: cc } = await sb.from("cuotas_egresos_sin_factura").select("id", { count: "exact", head: true }).in("id", cuotas).eq("estado", "conciliado")
console.log(`130: movimientos conciliados ${count} (esperado 7) · cuotas conciliadas ${cc} (esperado 7)`)
