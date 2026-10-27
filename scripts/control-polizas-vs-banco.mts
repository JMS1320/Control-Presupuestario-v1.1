import fs from "fs"
import { createClient } from "@supabase/supabase-js"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora } from "../lib/polizas/control-debitos"
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const p = await sb.from("polizas_seguro").select("poliza,seccion,producto,vigencia_desde,vigencia_hasta,polizas_endosos(endoso,fecha_emision,total,es_nota_credito,comprobante_arca_id,consolidado,polizas_cuotas(vencimiento,importe))")
const m = await sb.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2").or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
const f1 = await sb.from("msa_galicia").select("fecha").order("fecha").limit(1); const f2 = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
if (p.error || m.error) throw p.error ?? m.error
const movs = (m.data ?? []).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: +x.debitos || 0, creditos: +x.creditos || 0, estado: x.estado }))
const ventana = { desde: f1.data![0].fecha, hasta: f2.data![0].fecha }
const pol = p.data as any[]
const endosos = pol.flatMap(p => p.polizas_endosos.map((e: any) => ({ poliza: p.poliza, endoso: e.endoso, cuotas: e.polizas_cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: +c.importe })), consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null })))
const r = controlarDebitos(cuotasEsperadas(endosos), movs, ventana)
console.log("ventana", ventana, "movs", movs.length, "polizas", pol.length, "endosos", endosos.length)
const out: any = { porPoliza: {}, sinPoliza: r.movimientos.filter(x => x.resultado !== "cuota"), sinVincular: [] }
for (const p of pol) for (const e of p.polizas_endosos) if (!e.comprobante_arca_id) out.sinVincular.push({ poliza: p.poliza, seccion: p.seccion, endoso: e.endoso, fecha: e.fecha_emision, total: e.total, nc: e.es_nota_credito })
for (const c of r.cuotas) {
  const k = c.poliza; const o = out.porPoliza[k] ??= { seccion: pol.find(x => x.poliza === k)?.seccion, cuotas: [], ultimoDebito: null, saldoPendienteAlUltimoDebito: 0 }
  o.cuotas.push({ venc: c.vencimiento, importe: c.importe, esperado: c.esperadoEnBanco, res: c.resultado, debitado: c.debitado, saldoAseg: c.saldo })
}
for (const [k, o] of Object.entries<any>(out.porPoliza)) {
  const deb = r.movimientos.filter(x => x.poliza === k && x.debitos > 0).map(x => x.fecha).sort()
  o.ultimoDebito = deb.at(-1) ?? null
  const hasta = o.ultimoDebito ?? ventana.desde
  // saldo = lo esperado vencido hasta el último débito que no fue debitado
  o.saldoPendienteAlUltimoDebito = Math.round(o.cuotas.filter((c: any) => c.venc <= hasta && !["ok", "compensada", "nc", "anterior-al-extracto"].includes(c.res)).reduce((s: number, c: any) => s + (c.esperado - (c.debitado ?? 0)), 0) * 100) / 100
  o.problemas = o.cuotas.filter((c: any) => !["ok", "compensada", "nc", "a-vencer", "anterior-al-extracto"].includes(c.res))
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1))
for (const [k, o] of Object.entries<any>(out.porPoliza)) console.log(k, o.seccion, "| ultimo debito", o.ultimoDebito, "| saldo", o.saldoPendienteAlUltimoDebito, "| problemas", o.problemas.map((c: any) => `${c.venc} ${c.res} esp ${c.esperado} deb ${c.debitado}`).join(" ; "))
console.log("MOVIMIENTOS SIN POLIZA:"); for (const x of out.sinPoliza) console.log(" ", x.fecha, x.debitos, x.creditos, x.estado, x.resultado)
console.log("ENDOSOS SIN VINCULAR A COMPROBANTE:"); for (const x of out.sinVincular) console.log(" ", x.poliza, x.seccion, "end", x.endoso, x.fecha, x.total, x.nc ? "NC" : "")
