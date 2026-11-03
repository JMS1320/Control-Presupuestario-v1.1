/**
 * 💵 Script 193 — CC dólares MSA: aplicar sus 6 reglas (script 172) a los cargos abiertos (JMS 03/11: «el resto lo podés conciliar
 * vos, son sólo reglas y conciliar»). Sólo la cuenta (no hay template: los importes son en dólares y el TC se carga aparte).
 * NO toca: el saldo de inicio ni la transferencia a Galicia Securities (se charla aparte).
 *
 *     npx tsx scripts/193-cc-usd-msa-reglas.mts              ← SIMULA
 *     npx tsx scripts/193-cc-usd-msa-reglas.mts --escribir   ← escribe (OK de JMS en esta terminal)
 * Deshacer: `193-…-deshacer.mts` (vuelve cada movimiento a la foto).
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
const ESCRIBIR = process.argv.includes("--escribir"), FOTO = "scripts/193-foto-antes.json", HUELLA = "[script 193] JMS 03/11"
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")&&!l.trim().startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,"")]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const reglas = ((await sb.from("reglas_conciliacion").select("*").eq("cuenta_bancaria_id", "msa_cc_usd").eq("activo", true)).data ?? []).sort((a: any, b: any) => a.orden - b.orden)
const movs = (await sb.schema("msa").from("cc_usd").select("*").eq("estado", "pendiente")).data ?? []
const pega = (r: any, d: string) => { const t = String(r.texto_buscar).toLowerCase(), x = d.toLowerCase().split(" · ")[0].trim()
  return r.tipo_match === "exacto" ? x === t : r.tipo_match === "inicia_con" ? x.startsWith(t) : d.toLowerCase().includes(t) }
const acc: { m: any; r: any }[] = [], quedan: any[] = []
for (const m of movs) { const r = reglas.find((r: any) => pega(r, String(m.descripcion))); if (r) acc.push({ m, r }); else quedan.push(m) }
const porRegla = new Map<string, number>(); for (const a of acc) porRegla.set(a.r.categ, (porRegla.get(a.r.categ) ?? 0) + 1)
console.log(`Cargos con regla: ${acc.length}`); for (const [c, k] of porRegla) console.log(`   ${c}: ${k}`)
console.log(`Quedan sin regla (no se tocan): ${quedan.length}`); for (const m of quedan) console.log(`   ${m.fecha} ${m.descripcion} ${m.debitos || "+" + m.creditos}`)
if (!ESCRIBIR) { console.log("(simulación)"); process.exit(0) }
if (existsSync(FOTO)) { console.log("🛑 ya corrido"); process.exit(1) }
writeFileSync(FOTO, JSON.stringify(acc.map(a => a.m), null, 2))
for (const { m, r } of acc) { const { error } = await sb.schema("msa").from("cc_usd").update({ estado: "conciliado", categ: r.categ, detalle: m.detalle || r.categ,
  nota_operador: [String(m.nota_operador || "").trim(), `${HUELLA}: regla «${r.texto_buscar}» → ${r.categ}`].filter(Boolean).join(" · ") }).eq("id", m.id); if (error) throw error }
console.log(`✅ ${acc.length} conciliados`)
