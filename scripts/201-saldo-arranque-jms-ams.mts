/**
 * 💵 **Script 201 — saldo de arranque de JMS y AMS en el papel 14 (cuentas corrientes) = el ANTICIPO A PROVEEDORES del contador.**
 *
 * JMS 04/11, con el balance del contador al 30/06/25 (anticipo a proveedores $ 31.728.000,07 = Magdalena Martínez 6.228.000,07 +
 * AMS 10.500.000 + JMS 15.000.000): *«con esto tenemos el saldo de arranque de JMS y AMS, sólo cargar esos datos»* · *«las facturas
 * se pagaron y a su vez quedó ese anticipo… a cuenta de próximas facturas, por eso va a anticipos»*.
 * ⚠️ Cambia la decisión del 01/11 (script 173: «debería ser cero, la factura del 30/6/25 se dejó como pagada»): la factura sí se
 * pagó, y ADEMÁS quedó el anticipo. Convención del papel 14: negativo = nos deben (le adelantamos plata a cuenta de sus facturas).
 * Magdalena Martínez NO se carga (JMS: «sólo JMS y AMS por ahora»).
 *
 *   npx tsx scripts/201-saldo-arranque-jms-ams.mts            # muestra
 *   npx tsx scripts/201-saldo-arranque-jms-ams.mts --aplicar
 *   npx tsx scripts/201-saldo-arranque-jms-ams.mts --deshacer  # vuelve al valor anterior (0), desde el historial
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const NUEVO: Record<string, number> = { JMS: -15000000, AMS: -10500000 }
const MARCA = "[script 201]"
const aplicar = process.argv.includes("--aplicar"), deshacer = process.argv.includes("--deshacer")
const ar = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const ahora = new Date().toISOString()

const { data, error } = await sb.from("balance_datos_usuario").select("*").eq("empresa", "MSA").eq("anio_cierre", 2026).eq("papel", "cc.saldo-inicio").in("clave", Object.keys(NUEVO))
if (error) throw new Error(error.message)
for (const r of data ?? []) console.log(`${r.clave}: hoy ${r.valor} (${r.actualizado_por?.slice(0, 60)})`)
if ((data ?? []).length !== 2) throw new Error("No están las 2 filas (JMS y AMS): no se toca nada.")

for (const r of data ?? []) {
  const hist = (r.historial ?? []) as Array<{ at: string; por: string; texto: string; valor: number }>
  if (deshacer) {
    if (!String(r.actualizado_por ?? "").includes(MARCA)) throw new Error(`${r.clave} no lo cargó el script 201: no se toca.`)
    const previo = [...hist].reverse().find(h => String(h.por).includes("antes del script 201"))
    if (!previo) throw new Error(`${r.clave}: no está el valor previo en el historial.`)
    const { error: e } = await sb.from("balance_datos_usuario").update({ texto: previo.texto, valor: previo.valor, actualizado_por: `${MARCA} deshecho`, updated_at: ahora,
      historial: [...hist, { at: ahora, por: `${MARCA} deshecho`, texto: previo.texto, valor: previo.valor }] }).eq("id", r.id)
    if (e) throw new Error(e.message)
    console.log(`${r.clave} → ${previo.valor}`)
    continue
  }
  if (String(r.actualizado_por ?? "").includes(MARCA)) throw new Error(`${r.clave} ya lo cargó el script 201.`)
  const v = NUEVO[r.clave]
  console.log(`${r.clave}: ${r.valor} → ${v}`)
  if (!aplicar) continue
  const { error: e } = await sb.from("balance_datos_usuario").update({
    texto: ar(v), valor: v, updated_at: ahora,
    actualizado_por: `${MARCA} JMS 04/11: anticipo a proveedores del balance del contador al 30/06/25 — «las facturas se pagaron y a su vez quedó ese anticipo, a cuenta de próximas facturas» (nos debe facturas) — lo cargó Claude`,
    historial: [...hist, { at: ahora, por: `valor antes del script 201 (decisión del 01/11, script 173)`, texto: r.texto, valor: Number(r.valor) }],
  }).eq("id", r.id)
  if (e) throw new Error(e.message)
}
if (!aplicar && !deshacer) console.log("(simulación — para cargar: --aplicar)")
