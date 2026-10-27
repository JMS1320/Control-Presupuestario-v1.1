/**
 * 🧾 **Script 120 — A-DAT-95 § A: las 8 que pasaron de diciembre 2025 a octubre 2026 vuelven a ser NORMALES para la app.**
 *
 * JMS 27/10: *«las 8 de octubre deben ser normales para la app … hacelo a mano aunque sea»*. Al moverlas a 10/2026
 * arrastraron el estado de diciembre («DDJJ OK»): la app creía octubre presentado y marcaba sus 5 propias como «+5
 * imputadas después de enviarlo». Octubre no se envió ni se presentó: las 8 van «Imputado», como el resto del mes, y
 * entran en la DDJJ de octubre. Sólo cambia `ddjj_iva` (no es dato fiscal: el registro de rectificaciones no lo anota).
 *
 * Frena si alguna no está en 10/2026 con «DDJJ OK».   Deshacer: `--deshacer` (vuelve a «DDJJ OK» sólo estas 8).
 *
 *   npx tsx scripts/120-octubre-8-a-imputado.mts             # muestra lo que haría
 *   npx tsx scripts/120-octubre-8-a-imputado.mts --aplicar
 *   npx tsx scripts/120-octubre-8-a-imputado.mts --deshacer
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

/** Las 8 de A-DAT-95 § A (4 de la app + las 4 del script 118), hoy en 10/2026. */
const IDS = [
  "9fb5a0fb-5946-4d5f-ac54-aaf5305323d7", "eb68da78-8343-4205-ae64-5e79f3d8f206", // Coopser 188411 · 188912
  "b45af73a-79ba-4dd9-8810-2267e2bd420a", "62cd1649-843c-4a38-aa9f-7e246842d1ce", // Río Tala 1684 · 1685
  "6c68f0fa-97e3-4745-b6d4-3cd8f1782cce", "5cac1b59-4841-4e8b-bf78-bbef619c5efb", // Pan American 17645 · 32309
  "0a2de05d-4d30-4d77-ac13-ddbdecf18bb1", "0d677e36-ea57-49f3-8cc6-c08a98c93f17", // Parador 36430 · NC Federación
]
const deshacer = process.argv.includes("--deshacer")
const aplicar = process.argv.includes("--aplicar") || deshacer
const desde = deshacer ? "Imputado" : "DDJJ OK", hacia = deshacer ? "DDJJ OK" : "Imputado"

const { data, error } = await sb.schema("msa").from("comprobantes_arca")
  .select("id, denominacion_emisor, numero_desde, imp_total, año_contable, mes_contable, ddjj_iva").in("id", IDS)
if (error) throw new Error(error.message)
for (const f of data ?? []) console.log(`   ${f["año_contable"]}-${f.mes_contable} · ${f.ddjj_iva} · ${f.denominacion_emisor.slice(0, 40)} ${f.numero_desde} · ${f.imp_total}`)
const malas = (data ?? []).filter(f => f["año_contable"] !== 2026 || f.mes_contable !== 10 || f.ddjj_iva !== desde)
if ((data ?? []).length !== 8 || malas.length) throw new Error(`Se esperaban 8 en 10/2026 con «${desde}»: no se cambia nada`)
if (!aplicar) { console.log(`   (sin --aplicar: no se cambió nada; pasarían de «${desde}» a «${hacia}»)`); process.exit(0) }
const { data: hechas, error: e } = await sb.schema("msa").from("comprobantes_arca").update({ ddjj_iva: hacia })
  .in("id", IDS).eq("ddjj_iva", desde).select("id")
if (e) throw new Error(e.message)
console.log(`✅ ${hechas!.length} de 8 pasaron de «${desde}» a «${hacia}»`)
