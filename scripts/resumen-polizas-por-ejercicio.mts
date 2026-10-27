/**
 * 🧾 Seguros por ejercicio — cuotas emitidas vs. pagos y reintegros del banco (sólo lectura).
 * Pedido JMS 2026-10-27: «detalle de cuotas por tanto, pagos por tanto, reintegros por tanto», por ejercicio
 * (incluido el presente), con los movimientos del banco aunque no estén conciliados. Base de A-FEAT-1383.
 */
import fs from "fs"
import { createClient } from "@supabase/supabase-js"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora } from "../lib/polizas/control-debitos"
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const p = await sb.from("polizas_seguro").select("poliza,seccion,polizas_endosos(endoso,consolidado,polizas_cuotas(vencimiento,importe))")
const m = await sb.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2").or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
const f2 = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
if (p.error || m.error) throw p.error ?? m.error
const movs = (m.data ?? []).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: +x.debitos || 0, creditos: +x.creditos || 0, estado: x.estado }))
const pol = p.data as any[]
const endosos = pol.flatMap(p => p.polizas_endosos.map((e: any) => ({ poliza: p.poliza, endoso: e.endoso, cuotas: e.polizas_cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: +c.importe })), consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null })))
const hoy = f2.data![0].fecha
const r = controlarDebitos(cuotasEsperadas(endosos), movs, { desde: "2025-07-01", hasta: hoy })
const ej = (f: string) => { const [y, mo] = f.split("-").map(Number); const a = mo >= 7 ? y : y - 1; return `${String(a % 100).padStart(2, "0")}/${String((a + 1) % 100).padStart(2, "0")}` }
const r2 = (n: number) => Math.round(n * 100) / 100
const T: any = {}
const t = (e: string) => T[e] ??= { cuotasEmitidas: 0, ncEmitidas: 0, vencidasAlCorte: 0, aVencer: 0, pagos: 0, pagosDePolizasCargadas: 0, pagosSinPoliza: 0, reintegros: 0, nCuotas: 0, nPagos: 0, nReint: 0, porPoliza: {} as any }
for (const c of r.cuotas) {
  const o = t(ej(c.vencimiento)); const pp = o.porPoliza[c.poliza] ??= { cuotas: 0, nc: 0, pagado: 0 }
  if (c.importe < 0) { o.ncEmitidas += c.importe; pp.nc += c.importe } else { o.cuotasEmitidas += c.importe; o.nCuotas++; pp.cuotas += c.importe; if (c.vencimiento <= hoy) o.vencidasAlCorte += c.importe; else o.aVencer += c.importe }
}
for (const x of r.movimientos) {
  const o = t(ej(x.fecha))
  if (x.debitos > 0) { o.pagos += x.debitos; o.nPagos++; if (x.poliza) { o.pagosDePolizasCargadas += x.debitos; (o.porPoliza[x.poliza] ??= { cuotas: 0, nc: 0, pagado: 0 }).pagado += x.debitos } else o.pagosSinPoliza += x.debitos }
  if (x.creditos > 0) { o.reintegros += x.creditos; o.nReint++ }
}
for (const o of Object.values<any>(T)) { for (const k of Object.keys(o)) if (typeof o[k] === "number") o[k] = r2(o[k]); for (const pp of Object.values<any>(o.porPoliza)) for (const k of Object.keys(pp)) pp[k] = r2(pp[k]) }
console.log("corte banco:", hoy); console.log(JSON.stringify(T, null, 1))
