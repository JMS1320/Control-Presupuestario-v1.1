/**
 * 🔀 RETIROS Y APORTES POR EFECTO — Excel aparte (A-FEAT-1579). JMS 11/11: «no entiendo este cuadro de retiros y aportes, ¿desde qué lado se mira?
 * ¿o es todo mezclado?… habíamos hablado de filtrarlos por una columna llamada Efecto… agregar esa columna al 1er y 2do cuadro (Excel aparte) y
 * además su propio cuadro como 3er cuadro».
 *
 * SÓLO LEE la solapa «H · Retiros y aportes» del último H para auditar y arma 3 cuadros que se leen desde un solo lado — QUIÉN PAGÓ → QUIÉN
 * RECIBE → POR QUÉ (efecto):
 *   1 · Por mes: cada línea del resumen del H con Quién pagó, Quién recibe y Efecto; semestres, total y meses en FÓRMULA sobre el detalle.
 *   2 · Detalle: cada movimiento con su Efecto, ordenado responsable → agrupadora → template → fecha.
 *   3 · Por efecto: por tipo (retiro, distribución, aporte, Libertad…) → quién pagó → quién recibe, con subtotales; al pie el control.
 * Versionado: no pisa nada.   npx tsx scripts/retiros-por-efecto.mts
 */
import XLSX from "xlsx-js-style"
import { readdirSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"

const CARPETA = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const hArchivo = readdirSync(CARPETA).filter(f => /^H para auditar MSA 25-26 \(2026-11-07\) v\d+\.xlsx$/.test(f)).sort((a, b) => Number(a.match(/v(\d+)/)![1]) - Number(b.match(/v(\d+)/)![1])).pop()!
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(join(CARPETA, hArchivo)).Sheets["H · Retiros y aportes"], { header: 1, raw: true, defval: "" }) as unknown[][]
const txt = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim()
const r2 = (n: number) => Math.round(n * 100) / 100
const MON = "#,##0.00"
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: "FF1F4E3D" } } } })
const N = (v: string) => ({ t: "s", v, s: { alignment: { wrapText: true, vertical: "top" } } })
const NEG = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "FF1F4E3D" } } } })
const AZ = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } } } })
const F = (f: string, v: number, s?: object) => ({ t: "n", f, v: r2(v), z: MON, ...(s ? { s } : {}) })
const BOLD = { font: { bold: true } }
const ORDEN = ["MSA", "MA", "PAM", "COTITULARES", "JMS", "AMS"]
const ord = (x: string) => { const i = ORDEN.indexOf(x.toUpperCase()); return i < 0 ? 9 : i }

// ── 1 · El resumen del H (Nro · categoría «PARA X · efecto») y los meses
const iRes = rows.findIndex(r => txt(r[3]) === "Nro" && txt(r[4]) === "Categoría")
const H = rows[iRes].map(txt), meses = H.slice(5).filter(h => /^[a-z]{3}-\d{2}$/.test(h))
interface Linea { nro: number; categoria: string; recibe: string; efecto: string; paga: string; tipo: string }
const tipoDe = (e: string) => /^retiro/i.test(e) ? "Retiro" : /^distribuci/i.test(e) ? "Distribución" : /^aporte/i.test(e) ? "Aporte" : /Libertad/i.test(e) ? "Libertad (reparto)" : /FLIA|familia/i.test(e) ? "Familia (FLIA)" : "Otro"
const pagaDe = (e: string) => (e.match(/pagado por (\S+)/i) ?? e.match(/salió de (\S+)/i) ?? e.match(/^distribución (\S+) →/i) ?? e.match(/^aporte de (\S+) a/i))?.[1] ?? ""
const lineas: Linea[] = []
for (const r of rows.slice(iRes + 1)) {
  if (typeof r[3] !== "number") break
  const cat = txt(r[4]), m = cat.match(/^PARA (\S+) · (.*)$/), efecto = m ? m[2] : cat
  lineas.push({ nro: r[3], categoria: cat, recibe: m ? m[1] : "", efecto, paga: pagaDe(efecto), tipo: tipoDe(efecto) })
}
const totalH = Number(rows.slice(iRes + 1).find(r => /^TOTAL/.test(txt(r[4])))?.[2]) || 0

// ── 2 · El detalle del H (cada movimiento con su Nro)
const iDet = rows.findIndex(r => txt(r[0]) === "Nro" && txt(r[1]) === "Mes")
const D = rows[iDet].map(txt), c = (n: string) => D.indexOf(n)
interface Mov { nro: number; mes: string; fecha: unknown; concepto: string; proveedor: string; comprobante: string; detalle: string; agrup: string; resp: string; quien: string; codigo: string; marca: string;
  deb: number; cred: number; desc: string; benef: string; factura: string; interno: string }
const movs: Mov[] = []
for (const r of rows.slice(iDet + 1)) {
  if (typeof r[0] !== "number") break
  const g = (n: string) => r[c(n)]
  movs.push({ nro: r[0], mes: txt(g("Mes")), fecha: g("Fecha"), concepto: txt(g("Concepto")), proveedor: txt(g("Proveedor")), comprobante: txt(g("Comprobante")), detalle: txt(g("Detalle")),
    agrup: txt(g("Agrupadora")), resp: txt(g("Responsable")), quien: txt(g("Quién pagó")), codigo: txt(g("Código contable")), marca: txt(g("Marca")), deb: Number(g("Débito")) || 0, cred: Number(g("Crédito")) || 0,
    desc: txt(g("Descripción del banco")), benef: txt(g("Beneficiario / CUIT")), factura: txt(g("Factura vinculada")), interno: txt(g("Interno")) })
}
const lineaDe = new Map(lineas.map(l => [l.nro, l]))
// quién pagó de cada línea: el del efecto; si el efecto no lo dice (Libertad), el titular de la cuenta de sus movimientos
for (const l of lineas) if (!l.paga) { const qs = [...new Set(movs.filter(m => m.nro === l.nro).map(m => m.quien.split(" · ")[0]).filter(Boolean))]; l.paga = qs.length === 1 ? qs[0] : qs.length ? "varios" : "" }
movs.sort((a, b) => ord(a.resp) - ord(b.resp) || a.resp.localeCompare(b.resp) || a.agrup.localeCompare(b.agrup) || a.concepto.localeCompare(b.concepto) || String(a.fecha).localeCompare(String(b.fecha)))
const mesIso = (lbl: string) => { const [m, y] = lbl.split("-"); return `20${y}-${String(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"].indexOf(m) + 1).padStart(2, "0")}` }
const SEM1 = meses.filter(m => Number(mesIso(m).slice(5)) >= 7), SEM2 = meses.filter(m => Number(mesIso(m).slice(5)) <= 6)

// ── Hoja 2 · Detalle (va primero porque las otras le hacen fórmula)
const DET = "2 Detalle"
const ENC2 = ["Nro", "Quién pagó", "Quién recibe", "Efecto", "Tipo", "Responsable", "Agrupadora", "Template", "Fecha", "Mes", "Neto", "Débito", "Crédito", "Proveedor", "Comprobante", "Detalle", "Código contable", "Interno",
  "Marca", "Quién pagó (cuenta)", "Descripción del banco", "Beneficiario / CUIT", "Factura vinculada"]
const h2: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T("2 · DETALLE — cada movimiento con su EFECTO (responsable → agrupadora → template → fecha)")],
  [N(`Filtrá por «Efecto», «Quién pagó» o «Quién recibe». «Nro» es la línea del cuadro 1. Neto = débito − crédito. Copiado de «${hArchivo}», solapa «H · Retiros y aportes».`)], [], ENC2.map(C)]
const d0 = h2.length + 1
for (const m of movs) { const l = lineaDe.get(m.nro)
  h2.push([m.nro, l?.paga ?? "", l?.recibe ?? "", l?.efecto ?? "", l?.tipo ?? "", m.resp, m.agrup, m.concepto, typeof m.fecha === "number" ? { t: "n", v: m.fecha, z: "dd/mm/yyyy" } : m.fecha, m.mes,
    { t: "n", f: `L${h2.length + 1}-M${h2.length + 1}`, v: r2(m.deb - m.cred), z: MON }, m.deb ? { t: "n", v: m.deb, z: MON } : "", m.cred ? { t: "n", v: m.cred, z: MON } : "",
    m.proveedor, m.comprobante, m.detalle, m.codigo, m.interno, m.marca, m.quien, m.desc, m.benef, m.factura]) }
const d1 = h2.length
h2.push([], ["", "", "", "TOTAL DEL DETALLE", "", "", "", "", "", "", F(`SUM(K${d0}:K${d1})`, movs.reduce((t, m) => t + m.deb - m.cred, 0), BOLD)])
const rg = (col: string) => `'${DET}'!$${col}$${d0}:$${col}$${d1}`
const totalDet = r2(movs.reduce((t, m) => t + m.deb - m.cred, 0))

// ── Hoja 1 · Por mes (cada línea del resumen del H, desde quién pagó)
const meta = (f: (m: Mov) => boolean) => r2(movs.filter(f).reduce((t, m) => t + m.deb - m.cred, 0))
const colMes = (i: number) => XLSX.utils.encode_col(7 + i)
const ENC1 = ["Nro", "Quién pagó", "Quién recibe", "Efecto", "1er sem", "2do sem", "Total", ...meses]
const h1: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T("1 · POR MES — cada línea, mirada desde QUIÉN PAGÓ → QUIÉN RECIBE → POR QUÉ")],
  [N("Es el mismo resumen del H («PARA … »), con el efecto separado en tres columnas y ordenado por quién pone la plata. Cada número es una fórmula sobre «2 Detalle» (filtrá ahí por «Nro»).")], [], ENC1.map(C)]
const l0 = h1.length + 1
const lineasOrd = [...lineas].sort((a, b) => ord(a.paga) - ord(b.paga) || a.paga.localeCompare(b.paga) || ord(a.recibe) - ord(b.recibe) || a.recibe.localeCompare(b.recibe) || a.efecto.localeCompare(b.efecto))
for (const l of lineasOrd) { const i = h1.length + 1
  h1.push([l.nro, l.paga, l.recibe, l.efecto, F(SEM1.length ? `SUM(${colMes(0)}${i}:${colMes(SEM1.length - 1)}${i})` : "0", meta(m => m.nro === l.nro && SEM1.map(mesIso).includes(m.mes))),
    F(SEM2.length ? `SUM(${colMes(SEM1.length)}${i}:${colMes(meses.length - 1)}${i})` : "0", meta(m => m.nro === l.nro && SEM2.map(mesIso).includes(m.mes))), F(`E${i}+F${i}`, meta(m => m.nro === l.nro)),
    ...meses.map(mm => F(`SUMIFS(${rg("K")},${rg("A")},A${i},${rg("J")},"${mesIso(mm)}")`, meta(m => m.nro === l.nro && m.mes === mesIso(mm))))]) }
const l1 = h1.length
h1.push(["", "", "", "TOTAL", ...["E", "F", "G", ...meses.map((_, i) => colMes(i))].map(col => F(`SUM(${col}${l0}:${col}${l1})`, 0, BOLD))])
const tot1 = h1.length
h1.push(["", "", "", "¿Igual al TOTAL del H y al detalle?", "", "", { t: "s", f: `IF(AND(ABS(G${tot1}-${r2(totalH)})<0.01,ABS(G${tot1}-'${DET}'!K${d1 + 2})<0.01),"✓ = el H y el detalle","⚠️ no da")`, v: "" }])

// ── Hoja 3 · Por efecto (tipo → quién pagó → quién recibe)
const h3: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T("3 · POR EFECTO — tipo de efecto → quién pagó → quién recibe")],
  [N("Un renglón verde por tipo (retiro, distribución, aporte, Libertad…) con su subtotal; abajo, quién pagó y quién recibe. Cada número es una fórmula sobre «2 Detalle».")], [], ["Tipo", "Quién pagó", "Quién recibe", "Líneas", "1er sem", "2do sem", "Total", ...meses].map(C)]
const filasTipo: number[] = []
for (const tipo of [...new Set(lineas.map(l => l.tipo))].sort()) {
  const iT = h3.length + 1; h3.push([]); filasTipo.push(iT)
  const pares = [...new Set(lineas.filter(l => l.tipo === tipo).map(l => `${l.paga}|${l.recibe}`))].sort((a, b) => ord(a.split("|")[0]) - ord(b.split("|")[0]) || a.localeCompare(b))
  const ini = h3.length + 1
  for (const k of pares) { const [p, rcb] = k.split("|"), i = h3.length + 1, en = (m: Mov) => { const l = lineaDe.get(m.nro); return l?.tipo === tipo && l.paga === p && l.recibe === rcb }
    const cond = `${rg("E")},"${tipo}",${rg("B")},"${p}",${rg("C")},"${rcb}"`
    h3.push(["", p, rcb, { t: "n", v: lineas.filter(l => l.tipo === tipo && l.paga === p && l.recibe === rcb).length, z: "0" },
      F(`SUM(${XLSX.utils.encode_col(7)}${i}:${XLSX.utils.encode_col(6 + SEM1.length)}${i})`, meta(m => en(m) && SEM1.map(mesIso).includes(m.mes))),
      F(`SUM(${XLSX.utils.encode_col(7 + SEM1.length)}${i}:${XLSX.utils.encode_col(6 + meses.length)}${i})`, meta(m => en(m) && SEM2.map(mesIso).includes(m.mes))), F(`E${i}+F${i}`, meta(en)),
      ...meses.map(mm => F(`SUMIFS(${rg("K")},${cond},${rg("J")},"${mesIso(mm)}")`, meta(m => en(m) && m.mes === mesIso(mm))))]) }
  const fin = h3.length
  h3[iT - 1] = [NEG(tipo), NEG(""), NEG(""), { t: "n", f: `SUM(D${ini}:D${fin})`, v: lineas.filter(l => l.tipo === tipo).length, z: "0", s: BOLD },
    ...["E", "F", "G", ...meses.map((_, i) => XLSX.utils.encode_col(7 + i))].map(col => F(`SUM(${col}${ini}:${col}${fin})`, 0, BOLD))]
}
h3.push([], ["TOTAL", "", "", "", ...["E", "F", "G", ...meses.map((_, i) => XLSX.utils.encode_col(7 + i))].map(col => F(filasTipo.map(r => `${col}${r}`).join("+"), 0, BOLD))])
const tot3 = h3.length
h3.push(["¿Igual al cuadro 1?", "", "", "", "", "", { t: "s", f: `IF(ABS(G${tot3}-'1 Por mes'!G${tot1})<0.01,"✓ = el cuadro 1","⚠️ no da")`, v: "" }])

// ── Resumen
const r: unknown[][] = [[T("RETIROS Y APORTES POR EFECTO — MSA 25/26")],
  [N("Se mira desde un solo lado: QUIÉN PAGÓ (de dónde sale la plata) → QUIÉN RECIBE → POR QUÉ (el efecto: retiro, distribución, aporte, Libertad). Los tres cuadros salen del mismo detalle y cierran entre sí y con el H. Las «otras puntas» (la entrada de una transferencia que ya suma por su salida) y el control contra el banco siguen en el H, solapa «H · Retiros y aportes».")], [],
  ["Cuadro", "Ir a", "Qué tiene"].map(C),
  ["1", { t: "s", v: "➜ 1 Por mes", l: { Target: "#'1 Por mes'!A1" } }, N("Cada línea del resumen del H con Quién pagó · Quién recibe · Efecto, por mes y semestre.")],
  ["2", { t: "s", v: "➜ 2 Detalle", l: { Target: "#'2 Detalle'!A1" } }, N(`Los ${movs.length} movimientos con su Efecto, para filtrar.`)],
  ["3", { t: "s", v: "➜ 3 Por efecto", l: { Target: "#'3 Por efecto'!A1" } }, N("Por tipo de efecto → quién pagó → quién recibe, con subtotales.")], [],
  ["Total del H («H · Retiros y aportes»)", "", { t: "n", v: r2(totalH), z: MON }], ["Total del detalle", "", F(`'${DET}'!K${d1 + 2}`, totalDet)], ["Total del cuadro 1", "", F(`'1 Por mes'!G${tot1}`, totalDet)], ["Total del cuadro 3", "", F(`'3 Por efecto'!G${tot3}`, totalDet)],
  ["¿Cierran los cuatro?", "", { t: "s", f: `IF(AND(ABS(C10-C9)<0.01,ABS(C11-C9)<0.01,ABS(C12-C9)<0.01),"✓ cierran","⚠️ no cierran")`, v: "" }]]
const wb = XLSX.utils.book_new()
const U = new Map<string, string[]>([["Resumen", ["A1:C1", "A2:C2"]], [DET, ["A2:J2", "A3:J3"]], ["1 Por mes", ["A2:J2", "A3:J3"]], ["3 Por efecto", ["A2:J2", "A3:J3"]]])
const hojas: Array<[string, unknown[][], number[]]> = [["Resumen", r, [34, 18, 80]], ["1 Por mes", h1, [6, 12, 14, 48, 16, 16, 16, ...meses.map(() => 14)]], [DET, h2, [6, 12, 12, 44, 16, 10, 22, 26, 11, 9, 14, 14, 14, 24, 14, 36, 14, 12, 18, 22, 30, 26, 16]],
  ["3 Por efecto", h3, [22, 14, 14, 8, 16, 16, 16, ...meses.map(() => 14)]]]
for (const [n, f, a] of hojas) { agregarHoja(wb as any, n, f, a.map(ancho => ({ ancho })) as any); const ws = wb.Sheets[n]; ws["!merges"] = (U.get(n) ?? []).map(x => XLSX.utils.decode_range(x)) }
wb.Sheets[DET]["!autofilter"] = { ref: `A${d0 - 1}:${XLSX.utils.encode_col(ENC2.length - 1)}${d1}` }
const base = "Retiros y aportes por efecto - H para auditar (2026-11-11)"
const nv = (f: string) => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 0)
const destino = join(CARPETA, `${base} v${Math.max(0, ...readdirSync(CARPETA).filter(f => f.startsWith(base)).map(nv)) + 1}.xlsx`)
if (existsSync(destino)) throw new Error("ya existe " + destino)
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb as any))))
console.log("📄", destino, `· líneas ${lineas.length} · movimientos ${movs.length} · total H ${totalH} · detalle ${totalDet}`)
