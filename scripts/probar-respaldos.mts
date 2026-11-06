// Sólo lectura: arma los renglones de «00 Respaldos» con los datos reales de MSA (07 y la provisión de compras de este ejercicio).
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { saldosEnDolaresParaBalance } from "../lib/dolares/posicion-cierre"
import { leerFci } from "../lib/balance/balance-en-linea-lectura"
import { desdeArca } from "../lib/balance/libro-diario"
import { renglonesDeRespaldo } from "../lib/balance/respaldos"
import { CUENTAS_DEL_EXTRACTO } from "../lib/balance/papeles-bancarios"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const fc = "2026-06-30"
const saldos: any[] = []
for (const t of CUENTAS_DEL_EXTRACTO.MSA) {
  const q = t.schema === "public" ? sb.from(t.tabla) : sb.schema(t.schema).from(t.tabla)
  const { data } = await q.select("fecha, saldo, nro_resumen, orden").gte("fecha", "2025-07-01").lte("fecha", fc).order("fecha", { ascending: false }).order("orden", { ascending: false }).limit(1)
  const u = data?.[0]; saldos.push({ nombre: t.nombre, saldo: u ? Number(u.saldo) : null, fecha: u?.fecha ?? null, nroResumen: u?.nro_resumen ?? null })
}
saldos.push(...(await saldosEnDolaresParaBalance(sb, "MSA", fc)).saldos)
const fci = await leerFci(sb, "MSA", 2026)
const pares = [[9,55857],[2,4690],[12,36430],[13,1684],[13,1685],[23,188411],[5366,17645],[23,188912],[5306,32309],[1,34160783]]
const prov: any[] = []
for (const [pv, n] of pares) { const { data } = await sb.schema("msa").from("comprobantes_arca").select("*").eq("punto_venta", pv).eq("numero_desde", n).limit(1); if (data?.[0]) prov.push(desdeArca(data[0])) }
const documentos = (await sb.from("documentos_respaldo").select("cuenta, periodo, tipo, url, nombre_archivo, ruta_drive").eq("empresa", "MSA")).data ?? []
const r = renglonesDeRespaldo({ fechaCierre: fc, fechaInicio: "2025-06-30", saldos, fci, provision: prov, documentos })
for (const x of r) console.log(x.respaldo.estado.padEnd(13), "|", x.papel, "|", x.renglon.slice(0, 50), "|", x.importe, "|", x.respaldo.documento.slice(0, 80), x.respaldo.url ? "→ link" : "|", x.respaldo.nota ?? "")
