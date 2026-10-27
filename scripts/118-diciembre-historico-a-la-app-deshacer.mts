/**
 * ↩️ **Deshacer del script 118** — borra SÓLO las filas de `msa.comprobantes_arca` que creó el 118 (las que llevan su
 * marca en `archivo_origen`), y sólo si son exactamente 4 (§ 🛑 Datos: el deshacer no puede borrar lo que no creó).
 *
 *   npx tsx scripts/118-diciembre-historico-a-la-app-deshacer.mts           # muestra lo que borraría
 *   npx tsx scripts/118-diciembre-historico-a-la-app-deshacer.mts --aplicar # borra
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const MARCA = "[script 118] histórico dic-25 a la app (A-DAT-95)"

const { data, error } = await sb.schema("msa").from("comprobantes_arca")
  .select("id, fecha_emision, tipo_comprobante, punto_venta, numero_desde, denominacion_emisor, imp_total, año_contable, mes_contable")
  .eq("archivo_origen", MARCA)
if (error) throw new Error(error.message)
for (const f of data ?? []) console.log(`   ${f.fecha_emision} · ${f.tipo_comprobante} ${f.punto_venta}-${f.numero_desde} · ${f.denominacion_emisor} · ${f.imp_total} · ${f["año_contable"]}-${f.mes_contable}`)
if ((data ?? []).length !== 4) throw new Error(`Se esperaban 4 filas con la marca y hay ${(data ?? []).length}: no se borra nada`)
if (!process.argv.includes("--aplicar")) { console.log("   (sin --aplicar: no se borró nada)"); process.exit(0) }
const { error: eD } = await sb.schema("msa").from("comprobantes_arca").delete().in("id", data!.map(f => f.id))
if (eD) throw new Error(eD.message)
console.log("✅ borradas las 4 filas del script 118")
