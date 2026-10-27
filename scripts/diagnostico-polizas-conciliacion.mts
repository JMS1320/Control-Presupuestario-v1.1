/**
 * 🔎 Pólizas ↔ conciliación — DIAGNÓSTICO, sólo lectura (etapa 1 de A-FEAT-1385).
 *
 * Para cada movimiento de la aseguradora en el banco (por leyenda, conciliado o no), desde el inicio del extracto:
 *   · de qué póliza y vencimiento es, según el control de Seguros (lo emitido, compensado con las NC);
 *   · contra qué está conciliado HOY (cuota de template, factura o nada) y en qué estado;
 *   · qué habría que hacer: nada (ya está bien), reconciliar contra la cuota de SU póliza, o avisar.
 * Y por póliza: las cuotas que el banco espera (las que habría que generar en su template).
 *
 * Uso: npx tsx scripts/diagnostico-polizas-conciliacion.mts [salida.json]
 */
import fs from "fs"
import { createClient } from "@supabase/supabase-js"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora } from "../lib/polizas/control-debitos"
import { polizaAnteriorDe, ejercicioDe } from "../lib/polizas/resumen-ejercicio"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const p = await sb.from("polizas_seguro").select("id,poliza,seccion,poliza_anterior,vigencia_desde,vigencia_hasta,polizas_endosos(endoso,consolidado,comprobante_arca_id,pdf_drive_url,polizas_cuotas(vencimiento,importe))")
const m = await sb.from("msa_galicia").select("id,fecha,debitos,creditos,estado,template_id,template_cuota_id,comprobante_arca_id,leyendas_adicionales_1,leyendas_adicionales_2")
  .or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*").order("fecha")
const f1 = await sb.from("msa_galicia").select("fecha").order("fecha").limit(1)
const f2 = await sb.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1)
if (p.error || m.error) throw p.error ?? m.error
const pol = p.data as any[]
const crudos = (m.data ?? []).filter(esDeLaAseguradora)
const movs = crudos.map(x => ({ id: x.id, fecha: x.fecha, debitos: +x.debitos || 0, creditos: +x.creditos || 0, estado: x.estado }))
const ventana = { desde: f1.data![0].fecha, hasta: f2.data![0].fecha }
const endosos = pol.flatMap(p => p.polizas_endosos.map((e: any) => ({ poliza: p.poliza, endoso: e.endoso, cuotas: e.polizas_cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: +c.importe })), consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null })))
const ctl = controlarDebitos(cuotasEsperadas(endosos), movs, ventana)

// Las cuotas de template a las que apuntan hoy los movimientos.
const idsCuota = [...new Set(crudos.map(x => x.template_cuota_id).filter(Boolean))]
const cuotasT = idsCuota.length ? (await sb.from("cuotas_egresos_sin_factura").select("id,egreso_id,fecha_estimada,monto,estado").in("id", idsCuota)).data ?? [] : []
const idsT = [...new Set([...cuotasT.map(c => c.egreso_id), ...crudos.map(x => x.template_id).filter(Boolean)])]
const templates = idsT.length ? (await sb.from("egresos_sin_factura").select("id,nombre_referencia,año,responsable").in("id", idsT)).data ?? [] : []
const nombreT = (id: string | null) => { const t = templates.find(t => t.id === id); return t ? `${t.nombre_referencia} ${t.año ?? ""}`.trim() : null }

const filas = crudos.map(x => {
  const c = ctl.movimientos.find(y => y.id === x.id)!
  const anterior = c.resultado === "sin-poliza" ? polizaAnteriorDe(x.fecha, pol) : null
  const cuotaT = cuotasT.find(q => q.id === x.template_cuota_id)
  const hoy = x.comprobante_arca_id ? "factura" : x.template_cuota_id ? (cuotaT ? `cuota de «${nombreT(cuotaT.egreso_id)}»` : "grupo de pago") : x.template_id ? `template «${nombreT(x.template_id)}» sin cuota` : "nada"
  const debe = anterior ? `póliza anterior ${anterior} (balance anterior)`
    : c.resultado === "cuota" ? `cuota ${c.vencimiento} de la póliza ${c.poliza}`
    : c.resultado === "reintegro-sin-nc" ? "reintegro sin NC — aviso"
    : "débito sin póliza — aviso"
  return { fecha: x.fecha, ejercicio: ejercicioDe(x.fecha), debito: +x.debitos || 0, credito: +x.creditos || 0, estado: x.estado, hoy, debe, poliza: c.poliza, vencimiento: c.vencimiento }
})

console.log(`Movimientos de la aseguradora: ${filas.length} (extracto ${ventana.desde} → ${ventana.hasta})\n`)
for (const f of filas) console.log(`${f.fecha} ${(f.debito ? fmt(f.debito) : "+" + fmt(f.credito)).padStart(14)} ${String(f.estado).padEnd(11)} HOY: ${f.hoy.padEnd(48)} DEBE: ${f.debe}`)
const resumen: Record<string, number> = {}
for (const f of filas) { const k = `${f.estado} → ${f.debe.startsWith("cuota") ? "cuota de su póliza" : f.debe}`; resumen[k] = (resumen[k] ?? 0) + 1 }
console.log("\nResumen:", resumen)

// Lo que el banco espera de cada póliza = las cuotas que tendría que tener su template.
console.log("\nCuotas que espera el banco, por póliza:")
for (const pp of pol) {
  const cs = ctl.cuotas.filter(c => c.poliza === pp.poliza && c.importe > 0 && c.resultado !== "anterior-al-extracto")
  if (!cs.length) continue
  console.log(`  ${pp.poliza} ${pp.seccion}: ` + cs.map(c => `${c.vencimiento} ${c.resultado === "compensada" ? "0 (NC)" : fmt(c.esperadoEnBanco)}`).join(" · "))
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ filas, resumen }, null, 1))
