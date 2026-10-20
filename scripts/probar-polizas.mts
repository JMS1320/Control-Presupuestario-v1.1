/**
 * `npm run probar:polizas` — el lector de pólizas contra los PDFs reales (A-FEAT-1309).
 *
 * Lee los PDFs de `- Comunicacion JMS Claude - Archivos/polizas` y muestra lo leído con sus
 * controles. **No toca la base**: sólo lee archivos. Si la carpeta no está (no va al repo), avisa y
 * sale sin fallar: es un diagnóstico, no una compuerta.
 *
 * El criterio no es «no explotó» sino **cuántas cerraron**: un lector que devuelve vacío en silencio
 * es el modo de falla que ya se vio con el romaneo.
 */
import fs from "node:fs"
import path from "node:path"

const B = process.cwd().split("\\").join("/")
const DIR = process.argv[2] ?? `${B}/- Comunicacion JMS Claude - Archivos/polizas`
if (!fs.existsSync(DIR)) {
  console.log(`No está la carpeta de pólizas:\n  ${DIR}\nEste diagnóstico necesita los PDFs reales. Salteado.`)
  process.exit(0)
}
const { textoEnRenglones } = await import(`file:///${B}/lib/polizas/renglones-pdf.ts`)
const { parsearPoliza } = await import(`file:///${B}/lib/polizas/parsear-poliza.ts`)
const ctl = await import(`file:///${B}/lib/polizas/controlar-poliza.ts`).catch(() => null)

const $ = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
let fallas = 0
const salida: unknown[] = []
for (const f of fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)).sort()) {
  const texto = await textoEnRenglones(new Uint8Array(fs.readFileSync(path.join(DIR, f))))
  if (process.env.VOLCAR) fs.writeFileSync(path.join(process.env.VOLCAR, f.replace(/\.pdf$/i, ".txt")), texto)
  const p = parsearPoliza(texto)
  console.log(`\n═══ ${f}`)
  console.log(`  ${p.seccion} · póliza ${p.poliza} · endoso ${p.endoso} · anterior ${p.polizaAnterior ?? "—"} · emisión ${p.fechaEmision}`)
  console.log(`  vigencia ${p.vigenciaDesde} → ${p.vigenciaHasta} · período ${p.periodoDesde} → ${p.periodoHasta} · total ${$(p.total)}${p.esNotaCredito ? " (NOTA DE CRÉDITO)" : ""}`)
  console.log(`  partes: ${Object.entries(p.partes).filter(([, v]) => v).map(([k]) => k).join(", ")}`)
  if (p.conceptos.length) console.log(`  factura: ${p.conceptos.map(c => `${c.concepto} ${$(c.importe)}`).join(" · ")}`)
  if (p.frente) console.log(`  frente: prima ${$(p.frente.prima)} · IVA ${$(p.frente.iva)} · sellado ${$(p.frente.sellado)} · otros ${$(p.frente.otrosImpuestos)} · premio ${$(p.frente.premioEndoso)} · total ${$(p.frente.total)} · TEA ${p.frente.tea}% · cargo fin. ${$(p.frente.cargoFinanciero)}`)
  console.log(`  cuotas del endoso: ${p.cuotasEndoso.map(c => `${c.nro}/${c.de} ${c.vencimiento} ${$(c.importe)}`).join(" · ")}`)
  if (p.consolidado) console.log(`  consolidado (últ. endoso ${p.consolidado.ultimoEndoso}): ${p.consolidado.cuotas.map(c => `${c.nro}/${c.de} ${$(c.importe)}${c.saldo ? " debe " + $(c.saldo) : " ✓"}`).join(" · ")}`)
  for (const v of p.vehiculos) console.log(`  🚗 cert ${v.certificado} · ${v.descripcion ?? v.tipo ?? "?"} ${v.anio ?? ""} · ${v.patente ?? "sin patente"} · prima ${$(v.prima)}`)
  for (const x of p.personas) console.log(`  👤 ${x.movimiento} · ${x.documento} ${x.nombre}${x.sumaAsegurada ? " · " + $(x.sumaAsegurada) : ""}`)
  for (const a of p.avisos) console.log(`  ⚠️ ${a}`)
  if (ctl) {
    const c = ctl.controlarPoliza(p)
    for (const k of c.integridad) { console.log(`  ${k.ok ? "✓" : "🛑"} ${k.que}: ${k.detalle}`); if (!k.ok) fallas++ }
    const rep = ctl.repartoDeLaPoliza(p)
    if (rep) console.log(`  🤝 reparto (${rep.base}): ${rep.partes.map((x: any) => `${x.responsable} ${(x.proporcion * 100).toFixed(1)}%`).join(" · ")}`)
    // JSON=archivo.json → vuelca todo lo leído (para la auditoría en Excel).
    if (process.env.JSON) salida.push({
      archivo: f, lectura: p, integridad: c.integridad,
      repartoInterno: rep, repartoContable: ctl.repartoDeLaPoliza(p, undefined, "contable"),
      responsables: [...p.vehiculos.map((v: any) => ({ bien: v.descripcion ?? v.tipo, clave: v.patente, prima: v.prima, ...ctl.responsableDe({ patente: v.patente }) })),
        ...p.personas.map((x: any) => ({ bien: x.nombre, clave: x.documento, movimiento: x.movimiento, ...ctl.responsableDe({ documento: x.documento }) }))],
    })
  }
}
if (process.env.JSON && ctl) {
  // El reparto de cada cuota sumando sus endosos, por póliza (lo usa la auditoría para proponer contable/interno).
  const porPoliza = new Map<string, any[]>()
  for (const x of salida as any[]) if (x.lectura.poliza) porPoliza.set(x.lectura.poliza, [...(porPoliza.get(x.lectura.poliza) ?? []), x.lectura])
  const cuotas: Record<string, Record<string, { interno: unknown; contable: unknown }>> = {}
  for (const [pol, endosos] of porPoliza) {
    const i = ctl.repartoDeLasCuotas(endosos, undefined, "interno"), c = ctl.repartoDeLasCuotas(endosos, undefined, "contable")
    cuotas[pol] = Object.fromEntries([...i.keys()].map(v => [v, { interno: i.get(v), contable: c.get(v) }]))
  }
  fs.writeFileSync(process.env.JSON, JSON.stringify({ pdfs: salida, cuotas }, null, 1))
}
console.log(fallas ? `\n🛑 ${fallas} control(es) de integridad no cierran` : "\n✓ todos los controles de integridad cierran")
process.exit(fallas ? 1 : 0)
