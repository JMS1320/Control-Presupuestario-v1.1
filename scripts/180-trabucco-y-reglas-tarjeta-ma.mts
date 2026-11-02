/**
 * 🔁 Script 180 — A-FEAT-1526 (JMS 02/11: «sí, movela al 13/07 y arrancá con las reglas»).
 *
 *     npx tsx scripts/180-trabucco-y-reglas-tarjeta-ma.mts              ← SIMULA
 *     npx tsx scripts/180-trabucco-y-reglas-tarjeta-ma.mts --escribir   ← escribe (OK de JMS en esta terminal)
 *
 * 1 · TRABUCCO: la factura de MA del 18/07/26 ($ 56.000) pasa del pago del 07/09 (lo había atado el motor, a auditar) al del
 *     13/07, el más cercano en fecha (regla de JMS: «factura atada a dos movimientos → gana el más cercano»). El 07/09 queda
 *     pendiente («proveedor que factura, falta la factura»).
 * 2 · REGLAS de la tarjeta VISA MA (`tarjeta_visa_ma`) para el accionar (1): que el motor lleve solo lo nuevo a los 4
 *     templates del script 179. Como el motor busca FACTURA antes que regla, si la factura está cargada gana la factura.
 *     Mismo formato que las 97 reglas que ya tiene la tarjeta (descripción · contiene · llena el template).
 *
 * Deshacer: `180-…-deshacer.mts` borra sólo las reglas creadas (ids en `scripts/180-hecho.json`) y vuelve Trabucco a la foto.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { conciliarOrigenDelMovimiento } from "../lib/conciliacion/confirmar-origen"

const ESCRIBIR = process.argv.includes("--escribir")
const HUELLA = "[script 180] JMS 02/11"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const ma = sb.schema("ma")
const frenos: string[] = []

// ── 1 · Trabucco ─────────────────────────────────────────────────────────────────────────────────────────
const FC = "5c65b9f4-f368-4de1-a79c-e620c2b2c073", DE = "057eb24e-3987-44ab-a006-2c994cdc4162", A = "31b2f448-4eb5-47a7-b555-3dd5c417cd03"
const { data: movs } = await ma.from("ma_galicia").select("*").in("id", [DE, A])
const de = movs?.find((m: any) => m.id === DE), a = movs?.find((m: any) => m.id === A)
const { data: fc } = await ma.from("comprobantes_arca").select("*").eq("id", FC).single()
if (!de || de.comprobante_arca_id !== FC) frenos.push("el pago del 07/09 ya no tiene la factura de Trabucco")
if (!a || a.comprobante_arca_id || a.estado !== "pendiente" || Number(a.debitos) !== 56000) frenos.push("el pago del 13/07 no está pendiente y libre por $ 56.000")
console.log(`1 · Trabucco: factura ${fc?.fecha_emision} $ ${fc?.imp_total} (cuenta ${fc?.cuenta_contable}) — del ${de?.fecha} (${de?.estado}) al ${a?.fecha} (${a?.estado})`)

// ── 2 · Reglas ───────────────────────────────────────────────────────────────────────────────────────────
const REGLAS: [string, string, string][] = [
  ["DISCO", "Supermercados MA", "Disco"], ["DIS.COM", "Supermercados MA", "Disco online"], ["CENCOSUD", "Supermercados MA", "Cencosud"],
  ["DIA TIENDA", "Supermercados MA", "Dia"], ["JUMBO", "Supermercados MA", "Jumbo"],
  ["EST DE SERVICIO CERRITO", "Combustibles MA", "Est. de servicio Cerrito"], ["AXION", "Combustibles MA", "Axion"], ["PARADOR SAN PEDRO", "Combustibles MA", "Parador San Pedro"],
  ["VTV", "Mantenimiento autos MA", "VTV"],
  ["SODIMAC", "Pintura, materiales y herramientas MA", "Sodimac"], ["EASY", "Pintura, materiales y herramientas MA", "Easy"],
  ["CENTRO PINTURERIAS", "Pintura, materiales y herramientas MA", "Centro Pinturerías"], ["PRESTIGIO", "Pintura, materiales y herramientas MA", "Prestigio"],
]
const { data: tpls } = await sb.from("egresos_sin_factura").select("id,nombre_referencia,categ,responsable").in("nombre_referencia", [...new Set(REGLAS.map(r => r[1]))]).eq("responsable", "MA")
const { data: existentes } = await sb.from("reglas_conciliacion").select("texto_buscar,orden").eq("cuenta_bancaria_id", "tarjeta_visa_ma")
const ordenMax = Math.max(0, ...(existentes ?? []).map((r: any) => r.orden ?? 0))
const filas = REGLAS.map(([texto, tplN, nombre], i) => {
  const t = (tpls ?? []).find((x: any) => x.nombre_referencia === tplN)
  if (!t) frenos.push(`no está el template «${tplN}»`)
  if ((existentes ?? []).some((r: any) => String(r.texto_buscar).toUpperCase() === texto)) frenos.push(`ya hay una regla «${texto}» en la tarjeta MA`)
  return { orden: ordenMax + 1 + i, tipo: "otras", columna_busqueda: "descripcion", texto_buscar: texto, tipo_match: "contiene", categ: t?.categ,
    detalle: `${tplN} — ${nombre}`, activo: true, llena_template: true, cuenta_bancaria_id: "tarjeta_visa_ma", template_id: t?.id }
})
console.log(`2 · Reglas nuevas en la tarjeta VISA MA (orden ${ordenMax + 1}…${ordenMax + filas.length}):`)
for (const f of filas) console.log(`   «${f.texto_buscar}» → ${f.detalle.split(" — ")[0]} (${f.categ})`)
// Qué tomarían hoy (control): cuántos movimientos de la tarjeta matchean cada texto
const { data: tj } = await ma.from("tarjeta_visa").select("descripcion,estado").neq("estado", "total")
for (const f of filas) {
  const xs = (tj ?? []).filter((m: any) => String(m.descripcion).toLowerCase().includes(f.texto_buscar.toLowerCase()))
  const otros = xs.filter((m: any) => !new RegExp(f.texto_buscar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(m.descripcion))
  console.log(`   control «${f.texto_buscar}»: ${xs.length} movimientos de la tarjeta lo contienen${otros.length ? ` (⚠️ ${otros.length} raros)` : ""}`)
}
if (frenos.length) { console.log("\n🛑 FRENA:\n - " + frenos.join("\n - ")); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: no se escribió nada)"); process.exit(0) }
if (existsSync("scripts/180-hecho.json")) { console.log("🛑 ya corrido"); process.exit(1) }

// ── Escritura ────────────────────────────────────────────────────────────────────────────────────────────
const hecho: any = { foto: { ma_galicia: movs, factura: fc }, reglas: [] }
const guardar = () => writeFileSync("scripts/180-hecho.json", JSON.stringify(hecho, null, 2))
guardar()
{ const { error } = await ma.from("ma_galicia").update({ comprobante_arca_id: null, estado: "pendiente", categ: null, nro_cuenta: null, motivo_revision: null,
  nota_operador: [String(de.nota_operador || "").trim(), `${HUELLA}: la factura de Trabucco del 18/07 pasó al pago del 13/07 (el más cercano)`].filter(Boolean).join(" · ") }).eq("id", DE); if (error) throw error }
{ const { error } = await ma.from("ma_galicia").update({ comprobante_arca_id: FC, estado: "conciliado", categ: fc.cuenta_contable, nro_cuenta: fc.nro_cuenta, motivo_revision: null,
  nota_operador: [String(a.nota_operador || "").trim(), `${HUELLA}: contra la factura de Trabucco del 18/07`].filter(Boolean).join(" · ") }).eq("id", A); if (error) throw error }
const o = await conciliarOrigenDelMovimiento(sb as any, { ...a, comprobante_arca_id: FC })
for (const f of filas) {
  const { data, error } = await sb.from("reglas_conciliacion").insert(f).select("id").single()
  if (error) throw error; hecho.reglas.push(data.id); guardar()
}
console.log(`\n✅ Trabucco movido${o.avisos.length ? ` (⚠️ ${o.avisos.join(" · ")})` : ""} · ${hecho.reglas.length} reglas creadas. Ids en scripts/180-hecho.json`)
