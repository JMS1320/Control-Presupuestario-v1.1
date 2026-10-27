/**
 * 🧾 Seguros por ejercicio y por póliza — lo mismo que muestra Egresos → Seguros arriba (A-FEAT-1383), en consola.
 * Sólo lectura. Uso: npx tsx scripts/resumen-polizas-por-ejercicio.mts
 */
import fs from "fs"
import { createClient } from "@supabase/supabase-js"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora } from "../lib/polizas/control-debitos"
import { resumenPorEjercicio, ejercicioDe, TEXTO_MOTIVO, cuentaCorriente } from "../lib/polizas/resumen-ejercicio"
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const p = await sb.from("polizas_seguro").select("poliza,seccion,poliza_anterior,vigencia_desde,polizas_endosos(endoso,consolidado,polizas_cuotas(vencimiento,importe))")
const m = await sb.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2").or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
const f1 = await sb.from("msa_galicia").select("fecha").order("fecha").limit(1)
const f2 = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
if (p.error || m.error) throw p.error ?? m.error
const movs = (m.data ?? []).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: +x.debitos || 0, creditos: +x.creditos || 0, estado: x.estado }))
const pol = p.data as any[]
const endosos = pol.flatMap(p => p.polizas_endosos.map((e: any) => ({ poliza: p.poliza, endoso: e.endoso, cuotas: e.polizas_cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: +c.importe })), consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null })))
const ventana = { desde: f1.data![0].fecha, hasta: f2.data![0].fecha }
const ctl = controlarDebitos(cuotasEsperadas(endosos), movs, ventana)
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const emitidas = cuotasEsperadas(endosos)
for (const r of resumenPorEjercicio(ctl.cuotas, ctl.movimientos, pol, ventana.hasta, ejercicioDe(ventana.desde), emitidas)) {
  console.log(`\n== Ejercicio ${r.ejercicio} (vencido al ${ventana.hasta}) — a reclamar: ${r.aReclamar.length}`)
  for (const x of r.renglones) console.log(`  ${(x.poliza ?? "REINTEGROS").padEnd(10)} ${(x.seccion ?? "").padEnd(22)} cuotas ${fmt(x.cuotas).padStart(14)} NC ${fmt(x.notasCredito).padStart(12)} esperado ${fmt(x.esperadoVencido).padStart(14)} pagado ${fmt(x.pagado).padStart(14)} dif ${fmt(x.diferencia).padStart(12)} ${x.motivo ? TEXTO_MOTIVO[x.motivo] : ""}`)
  console.log(`  TOTAL cuotas ${fmt(r.total.cuotas)} NC ${fmt(r.total.notasCredito)} esperado ${fmt(r.total.esperadoVencido)} pagado ${fmt(r.total.pagado)} dif ${fmt(r.total.diferencia)} · a vencer ${fmt(r.total.aVencer)}`)
  console.log(`  anteriores: ${r.anteriores.cantidad} por ${fmt(r.anteriores.total)} (${r.anteriores.polizas.join(", ")}) · sin póliza: ${r.sinPoliza.cantidad} por ${fmt(r.sinPoliza.total)}`)
}

const cc = cuentaCorriente(emitidas, ctl.cuotas, ctl.movimientos, pol, ventana.desde, ventana.hasta)
console.log("\nCuenta corriente al " + ventana.hasta + ": saldo " + fmt(cc.saldo), Object.fromEntries([...cc.porPoliza].map(([k, v]) => [k, fmt(v)])))
