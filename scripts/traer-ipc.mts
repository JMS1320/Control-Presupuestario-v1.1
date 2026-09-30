/**
 * 📈 **Trae el IPC del INDEC y lo guarda en `indices_ipc`** (A-FEAT-1215).
 *
 * ```
 * npx tsx scripts/traer-ipc.mts              # desde 2024-01, sin escribir
 * npx tsx scripts/traer-ipc.mts 2024-01      # desde ese mes, sin escribir
 * npx tsx scripts/traer-ipc.mts 2024-01 --guardar
 * ```
 *
 * 🛑 **Por default NO escribe**: imprime lo que traería y el resultado del control. Escribir es
 * `--guardar`, y aun así hace **upsert por (año, mes)** — nunca borra ni pisa otra cosa (§ 🛑 Datos).
 *
 * 🧮 **Y no guarda si el control no cierra.** El nivel del índice y la variación publicada son dos
 * caminos al mismo hecho; si discrepan, se leyó mal uno de los dos y **no se escribe nada**.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import {
  urlIpc, leerIpc, controlarIpc, acumuladaDelAnio, SERIE_IPC_NACIONAL,
} from "../lib/indices/ipc-indec"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => {
      const i = l.indexOf("=")
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]
    }),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  process.exit(1)
}
const sb = createClient(url, key)

const desde = process.argv[2] && /^\d{4}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : "2024-01"
const guardar = process.argv.includes("--guardar")
const pct = (n: number | null) => (n == null ? "—" : `${n.toFixed(2).replace(".", ",")} %`)

console.log(`\n📈 IPC del INDEC — serie ${SERIE_IPC_NACIONAL}, desde ${desde}\n`)

const res = await fetch(urlIpc(desde))
if (!res.ok) { console.error(`❌ La API respondió ${res.status}`); process.exit(1) }
const json = await res.json() as { data?: unknown }
const meses = leerIpc(json.data)

if (meses.length === 0) {
  // 🛑 Una serie vacía NO es "no hubo inflación": es que no se leyó. Se dice y se corta.
  console.error("❌ No se pudo leer ningún mes. Revisá la serie o el rango antes de seguir.")
  process.exit(1)
}

console.log(`  ${meses.length} mes(es) leídos: ${meses[0].anio}-${String(meses[0].mes).padStart(2, "0")}`
  + ` → ${meses[meses.length - 1].anio}-${String(meses[meses.length - 1].mes).padStart(2, "0")}\n`)

for (const m of meses.slice(-6)) {
  console.log(`  ${m.anio}-${String(m.mes).padStart(2, "0")}   mensual ${pct(m.variacionMensual).padStart(9)}`
    + `   interanual ${pct(m.variacionInteranual).padStart(10)}`
    + `   acumulada ${pct(acumuladaDelAnio(meses, m.anio, m.mes)).padStart(10)}`
    + `   (índice ${m.nivel.toLocaleString("es-AR")})`)
}

// ── 🧮 El control de los dos caminos ───────────────────────────────────────────────────────
const descuadres = controlarIpc(meses)
console.log("\n── 🧮 CONTROL: el nivel del índice contra la variación publicada ──")
if (descuadres.length === 0) {
  console.log(`   ✓ Cierra en los ${meses.length - 1} meses comparables.`)
} else {
  console.log(`   ⚠️ NO cierra en ${descuadres.length} mes(es):`)
  for (const d of descuadres) {
    console.log(`      ${d.anio}-${String(d.mes).padStart(2, "0")}: publicada ${pct(d.publicada)}`
      + ` · calculada ${pct(d.calculada)} · diferencia ${d.diferencia.toFixed(4)}`)
  }
}

if (!guardar) {
  console.log(`\n📋 No se escribió nada. Para guardar: npx tsx scripts/traer-ipc.mts ${desde} --guardar\n`)
  process.exit(0)
}
if (descuadres.length > 0) {
  console.error("\n🛑 No se guarda: el control no cierra. Primero hay que entender por qué.\n")
  process.exit(1)
}

/**
 * 🛑 **LO CARGADO A MANO NO SE PISA** (§ 🛑 Datos de `CLAUDE.md`).
 *
 * `indices_ipc` **no estaba vacía** como decía la documentación: tiene las **proyecciones del
 * usuario** (`fuente = 'manual'`, cargadas el 30/07/2026) — 2,00 % hasta jul-26, 1,50 % hasta dic-26
 * y 1,00 % hasta jun-27. Son los escalones con los que proyecta el presupuesto.
 *
 * Un `upsert` a secas le habría pisado **julio 2026** (su 2,00 %) con el dato del INDEC (2,11 %), que
 * es **modificar un dato suyo sin preguntar**. Entonces:
 *
 * - lo que **no existe** se inserta;
 * - lo que ya cargó **este mismo script** se actualiza;
 * - lo **manual** se deja **intacto** y se lista, para que decida él.
 *
 * 📌 `--pisar-manuales` existe para cuando lo autorice, y **nunca es el default**.
 */
const pisarManuales = process.argv.includes("--pisar-manuales")
const { data: yaCargado } = await sb.from("indices_ipc").select("anio, mes, valor_ipc, fuente")
const existentes = new Map(
  (yaCargado ?? []).map(f => [`${f.anio}-${f.mes}`, f as { valor_ipc: number; fuente: string | null }]))

const manualesQueDifieren = meses.filter(m => {
  const hay = existentes.get(`${m.anio}-${m.mes}`)
  return !!hay && (hay.fuente ?? "").toLowerCase() === "manual"
    && Math.abs(Number(hay.valor_ipc) - m.variacionMensual) > 0.001
})

if (manualesQueDifieren.length > 0 && !pisarManuales) {
  console.log("\n🛑 HAY MESES CARGADOS A MANO QUE NO COINCIDEN — no se tocan:")
  for (const m of manualesQueDifieren) {
    const hay = existentes.get(`${m.anio}-${m.mes}`)!
    console.log(`   ${m.anio}-${String(m.mes).padStart(2, "0")}   tuyo ${pct(Number(hay.valor_ipc))}`
      + `   ·   INDEC ${pct(m.variacionMensual)}`)
  }
  console.log("   Son tus proyecciones. Si querés reemplazarlas por el dato real:")
  console.log("   npx tsx scripts/traer-ipc.mts <desde> --guardar --pisar-manuales\n")
}

const aEscribir = meses.filter(m => {
  const hay = existentes.get(`${m.anio}-${m.mes}`)
  if (!hay) return true                                            // nuevo: entra
  if ((hay.fuente ?? "").toLowerCase() !== "manual") return true    // lo cargó este script: se refresca
  return pisarManuales                                             // manual: sólo si lo autorizó
})

const filas = aEscribir.map(m => ({
  anio: m.anio,
  mes: m.mes,
  // 🔑 En PORCENTAJE, que es lo que guarda y muestra el ABM («Valor IPC (%)»).
  valor_ipc: m.variacionMensual,
  variacion_mensual: m.variacionMensual,
  variacion_interanual: m.variacionInteranual,
  variacion_acumulada: acumuladaDelAnio(meses, m.anio, m.mes),
  /**
   * 🔑 `indec_api` **no es un valor inventado**: la tabla tiene un `check` que sólo acepta
   * `manual`, `indec_api` e `indec_scraping`. O sea que **quien la diseñó ya había previsto esto**
   * — y es lo que deja distinguir sus proyecciones del dato real sin adivinar.
   */
  fuente: "indec_api",
  // El nivel del índice no tiene columna propia: queda acá, que es de donde salen las variaciones.
  observaciones: `Serie ${SERIE_IPC_NACIONAL} · índice nivel general base dic-2016: ${m.nivel.toLocaleString("es-AR")}`,
}))

if (filas.length === 0) {
  console.log("\n📋 No hay nada para escribir: lo que trae el INDEC ya está, o es tuyo.\n")
  process.exit(0)
}
const { error } = await sb.from("indices_ipc").upsert(filas, { onConflict: "anio,mes" })
if (error) { console.error("❌ No se pudo guardar: " + error.message); process.exit(1) }
console.log(`\n✅ ${filas.length} mes(es) guardados en indices_ipc.`)
if (manualesQueDifieren.length > 0 && !pisarManuales) {
  console.log(`   (${manualesQueDifieren.length} mes(es) tuyos quedaron intactos.)`)
}
console.log("")
