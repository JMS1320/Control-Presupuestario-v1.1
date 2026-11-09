/**
 * 📸 FOTO DE NÚMEROS del «H para auditar» (A-FEAT-1579) — para la trazabilidad entre versiones. SÓLO LEE Excel ya generados.
 * Por cada archivo: el total de cada solapa de agrupadora, las marcas, las líneas de «Retiros y aportes» (resumen), el bloque «Otras
 * puntas» y el control contra el banco por cuenta y código. Y compara los archivos entre sí (el primero es la base).
 *
 *     npx tsx scripts/foto-h-para-auditar.mts <base.xlsx> <otro.xlsx> [...] [--json salida.json]
 */
import XLSX from "xlsx-js-style"
import { writeFileSync } from "node:fs"
import { basename } from "node:path"

type Foto = { archivo: string; solapas: Record<string, { total: number; cuotas: number; marcas: Record<string, number> }>; retiros: Record<string, number>;
  otrasPuntas: { n: number; total: number }; control: Record<string, { cuotas: number; banco: number; directo: number; totalBanco: number }> }

const args = process.argv.slice(2), iJ = args.indexOf("--json"), salida = iJ >= 0 ? args[iJ + 1] : null
const archivos = args.filter((a, i) => iJ < 0 || (i !== iJ && i !== iJ + 1))
const r2 = (n: number) => Math.round(n * 100) / 100

function foto(p: string): Foto {
  const wb = XLSX.readFile(p)
  const f: Foto = { archivo: basename(p), solapas: {}, retiros: {}, otrasPuntas: { n: 0, total: 0 }, control: {} }
  for (const n of wb.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })
    const hi = rows.findIndex(r => r && r[0] === "Nro" && r.includes("Marca"))
    if (hi < 0 || n === "H · Retiros y aportes") continue
    const H = rows[hi], iD = H.indexOf("Débito"), iC = H.indexOf("Crédito"), iM = H.indexOf("Marca")
    const s = { total: 0, cuotas: 0, marcas: {} as Record<string, number> }
    for (const r of rows.slice(hi + 1)) {
      if (!r || typeof r[0] !== "number") break
      s.cuotas++; s.total = r2(s.total + (Number(r[iD]) || 0) - (Number(r[iC]) || 0))
      const m = String(r[iM] ?? "").trim().slice(0, 2).trim() || "(vacío)"
      s.marcas[m] = (s.marcas[m] ?? 0) + 1
    }
    f.solapas[n] = s
  }
  const ws = wb.Sheets["H · Retiros y aportes"]
  if (ws) {
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    for (const r of rows) {
      if (/^DETALLE/.test(String(r?.[0] ?? ""))) break
      const tot = !!r && typeof r[4] === "string" && r[4].startsWith("TOTAL")
      if (tot) { f.retiros["TOTAL"] = r2(Number(r[2]) || 0); continue }
      if (r && typeof r[4] === "string" && typeof r[3] === "number") f.retiros[r[4].replace(/^PARA [^ ]+ · /, "")] = r2(Number(r[2]) || 0)
    }
    const op = rows.find(r => r && r[1] === "TOTAL de las otras puntas (no suma)")
    const ok = rows.find(r => r && String(r[0] ?? "").startsWith("✓ ") && /entrada/.test(String(r[0])))
    if (op) f.otrasPuntas = { n: Number(String(ok?.[0] ?? "").match(/✓ (\d+)/)?.[1] ?? 0), total: r2(Number(op[4]) || 0) }
    const ic = rows.findIndex(r => r && /^(Pagó|Cuenta de) \(empresa\)/.test(String(r[0])))
    for (const r of rows.slice(ic + 1)) {
      if (!r || !r.length || typeof r[0] !== "string" || r[0].startsWith("«")) break
      f.control[`${r[0]} | ${r[1]}`] = { cuotas: r2(+r[2] || 0), banco: r2(+r[3] || 0), directo: r2(+r[6] || 0), totalBanco: r2(+r[7] || 0) }
    }
  }
  return f
}

const fotos = archivos.map(foto)
const base = fotos[0]
for (const f of fotos) {
  const sol = Object.values(f.solapas)
  console.log(`\n══ ${f.archivo}`)
  console.log(`   solapas de agrupadora ${sol.length} · cuotas ${sol.reduce((t, s) => t + s.cuotas, 0)} · total ${r2(sol.reduce((t, s) => t + s.total, 0)).toLocaleString("es-AR")}`)
  console.log(`   Retiros y aportes: TOTAL ${(f.retiros["TOTAL"] ?? 0).toLocaleString("es-AR")} · ${Object.keys(f.retiros).length - 1} líneas · otras puntas ${f.otrasPuntas.n} por ${f.otrasPuntas.total.toLocaleString("es-AR")}`)
  console.log(`   control contra el banco: ${Object.keys(f.control).length} renglones · total del banco ${r2(Object.values(f.control).reduce((t, c) => t + c.totalBanco, 0)).toLocaleString("es-AR")}`)
  if (f === base) continue
  const difSol = Object.keys({ ...base.solapas, ...f.solapas }).filter(k => base.solapas[k]?.total !== f.solapas[k]?.total || base.solapas[k]?.cuotas !== f.solapas[k]?.cuotas)
  const difCtl = Object.keys({ ...base.control, ...f.control }).filter(k => JSON.stringify(base.control[k]) !== JSON.stringify(f.control[k]))
  console.log(`   vs ${base.archivo}: solapas con total o cuotas distintos ${difSol.length}${difSol.length ? " → " + difSol.join(", ") : ""} · renglones del control distintos ${difCtl.length}`)
}
if (salida) { writeFileSync(salida, JSON.stringify({ tomada: new Date().toISOString(), fotos }, null, 1)); console.log(`\n📄 ${salida}`) }
