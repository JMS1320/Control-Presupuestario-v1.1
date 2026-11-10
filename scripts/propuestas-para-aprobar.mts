/**
 * ✅ PROPUESTAS PARA APROBAR (JMS 10/11: «de las cosas que vos más seguro estás me lo dejás en un Excel aparte, como unas fotos sólo de las
 * tablas de problemas, lo mejor explicadas; yo lo trato de ver ahí directo»). Una solapa por propuesta: qué pasa, qué se haría, los renglones
 * exactos y una columna «¿Va?» para aprobar en bloque. SÓLO LEE.  npx tsx scripts/propuestas-para-aprobar.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { cargarProblemasDeModalidad } from "../lib/templates/modalidad"
import { fechasReales } from "../lib/excel/fechas-reales"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const dmy = (f: string | null | undefined) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const T = (v: string) => ({ t: "s", v, s: { font: { bold: true, sz: 13, color: { rgb: "FF1F4E3D" } } } })
const N = (v: string) => ({ t: "s", v, s: { alignment: { wrapText: true, vertical: "top" } } })
const MON = "#,##0.00"
const IMP = (v: number) => ({ t: "n", v: Math.round(v * 100) / 100, z: MON })
const VA = () => ({ t: "s", v: "", s: { fill: { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } } } })
const wb = XLSX.utils.book_new()
/** Todas las filas (supabase corta en 1.000 por consulta). */
async function todas(q: () => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q().range(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) return out } }
// Uniones y altos se ponen directo en la hoja (los marcadores de formato-excel viven en otra copia del módulo al correr con tsx).
const UN = new WeakMap<unknown[][], string[]>(), AL = new WeakMap<unknown[][], Record<number, number>>()
const unirCeldas = (f: unknown[][], rs: string[]) => UN.set(f, [...(UN.get(f) ?? []), ...rs])
const altoDeFila = (f: unknown[][], r: number, h: number) => AL.set(f, { ...(AL.get(f) ?? {}), [r]: h })
function agregar(nombre: string, f: unknown[][], anchos: number[], filtro?: string) {
  agregarHoja(wb as any, nombre, f, anchos.map(ancho => ({ ancho })) as any)
  const ws = wb.Sheets[nombre.slice(0, 31)]
  ws["!merges"] = (UN.get(f) ?? []).map(u => XLSX.utils.decode_range(u))
  const rs: any[] = (ws["!rows"] ??= []); for (const [r, h] of Object.entries(AL.get(f) ?? {})) rs[Number(r) - 1] = { ...(rs[Number(r) - 1] ?? {}), hpt: h }
  if (filtro) ws["!autofilter"] = { ref: filtro }
}
/** Alto (en puntos) para que un texto entre entero en un ancho de `ancho` caracteres: Excel no autoajusta celdas unidas. */
const altoTexto = (txt: string, ancho: number) => Math.max(20, Math.ceil(txt.length / Math.max(20, ancho * 0.95) + 0.3) * 15 + 6)
const resumen: Array<{ id: string; solapa: string; que: string; cuantos: number; importe: number; hacer: string }> = []
function hoja(id: string, solapa: string, titulo: string, que: string, hacer: string, porque: string, enc: string[], filas: unknown[][], importe: number, anchos: number[]) {
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(`${id} · ${titulo}`)], [], [C("Qué pasa"), N(que)], [C("Qué se haría"), N(hacer)], [C("Por qué"), N(porque)],
    [C("¿Va todo?"), VA(), N("← escribí «sí», «no» o «sí salvo…». Si querés decidir renglón por renglón, usá la columna «¿Va?» de abajo.")], [], [...enc.map(C), C("¿Va?"), C("Comentario")]]
  for (const f of filas) h.push([...f, VA(), ""])
  // 📐 JMS 10/11: «está raro de formatos, no lo puedo leer». Las explicaciones iban en UNA celda angosta (la columna B de la tabla) y
  // Excel estiraba el renglón para abajo. Ahora ocupan todo el ancho de la tabla (celdas unidas) con el alto calculado.
  const ultima = XLSX.utils.encode_col(enc.length + 1)
  const anchoTexto = anchos.slice(1).reduce((t, a) => t + a, 0)
  unirCeldas(h, ["A2:" + ultima + "2", ...[4, 5, 6].map(r => `B${r}:${ultima}${r}`), `C7:${ultima}7`])
  for (const [r, txt] of [[4, que], [5, hacer], [6, porque]] as const) altoDeFila(h, r, altoTexto(txt, anchoTexto))
  agregar(solapa, h, anchos, `A9:${ultima}${h.length}`)
  resumen.push({ id, solapa, que: titulo, cuantos: filas.length, importe, hacer })
}

// ── P1 · «DIST MA» en lo que pagó PAM de gastos de MA
const tpm = await todas(() => sb.schema("pam").from("tarjeta_visa").select("id, fecha, descripcion, debitos, creditos, debitos_usd, contable, interno, detalle, comprobantes_pagados, template_cuota_id").not("template_cuota_id", "is", null).order("id"))
const gpm = await todas(() => sb.from("pam_galicia").select("id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id").not("template_cuota_id", "is", null).order("id"))
const movsPAM = [...(tpm ?? []).map((m: any) => ({ ...m, cuenta: "VISA PAM" })), ...(gpm ?? []).map((m: any) => ({ ...m, cuenta: "Galicia PAM CA" }))].filter((m: any) => !String(m.contable ?? "").trim())
const ids = [...new Set(movsPAM.map((m: any) => m.template_cuota_id))]
const cuotasMA: any[] = []
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.from("cuotas_egresos_sin_factura").select("id, monto, fecha_estimada, detalle, descripcion, egreso:egresos_sin_factura!inner(nombre_referencia, responsable)").in("id", ids.slice(i, i + 200))
  cuotasMA.push(...(data ?? []).filter((c: any) => String(c.egreso?.responsable ?? "").toUpperCase().startsWith("MA")))
}
const cuotaDe = new Map(cuotasMA.map(c => [c.id, c]))
const p1 = movsPAM.filter((m: any) => cuotaDe.has(m.template_cuota_id) && m.fecha >= "2025-07-01" && m.fecha <= "2026-07-31").sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
hoja("P1", "P1 DIST MA", "Lo que pagó PAM de gastos de MA: falta el código «DIST MA»",
  `${p1.length} pagos de la VISA PAM y del Galicia PAM CA que pagaron templates de MA (Consumos MA, suscripciones, Gastos Médicos) no tienen código. En «Inconsistencias» salen como «⚠️ el código contable no es el esperado».`,
  "Ponerles contable «DIST MA» a esos movimientos (no se toca ninguna cuota ni importe). Es tu regla: «si PAM paga algo de MA, entonces DIST MA».",
  "Aparecieron al pasar Consumos, Médicos y suscripciones 2025 a MA (scripts 239–240): lo que antes era «PAM pagó lo suyo» ahora es «PAM pagó lo de MA».",
  // JMS 10/11: «no estoy viendo el detalle, el proveedor, el comprobante». Va todo lo que hay del movimiento y de la cuota.
  ["Fecha", "Cuenta", "Template (de MA)", "Descripción del banco", "Importe de la cuota", "US$ (si fue en dólares)", "Cómo se pasó a pesos", "Detalle", "Proveedor / CUIT", "Comprobante pagado", "Código hoy", "Interno hoy"],
  p1.map((m: any) => { const c = cuotaDe.get(m.template_cuota_id); return [dmy(m.fecha), m.cuenta, c.egreso.nombre_referencia, m.descripcion, IMP(Number(c.monto)),
    Number(m.debitos_usd) ? { t: "n", v: Number(m.debitos_usd), z: MON } : "", String(c.descripcion ?? "").replace(/\s*\[script[^\]]*\]/g, ""), m.detalle || c.detalle || "",
    [m.leyendas_adicionales_1, m.leyendas_adicionales_2].filter(Boolean).join(" · "), m.comprobantes_pagados ?? "", m.contable || "(vacío)", m.interno || "(vacío)"] }),
  p1.reduce((t: number, m: any) => t + Number(cuotaDe.get(m.template_cuota_id).monto), 0), [12, 14, 18, 36, 14, 12, 40, 26, 30, 30, 11, 11, 10, 30])

// ── P2 · Cuotas en $ 0 marcadas «conciliado» sin pago → desactivadas
const anio = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4))
const { problemas } = await cargarProblemasDeModalidad(sb, anio)
const ceros = problemas.filter(p => p.tipo === "conciliada_en_cero")
const filasP2 = ceros.flatMap(p => p.cuotas.map(c => [p.template, p.anio ?? "", dmy(c.fecha), IMP(c.monto), c.estado]))
hoja("P2", "P2 Ceros a desactivar", "Cuotas en $ 0 marcadas «conciliado» sin ningún pago → pasarlas a «desactivado»",
  `${filasP2.length} cuotas en $ 0 de ${ceros.length} templates (IIBB, SICORE, anticipos, retiros semestrales…) dicen «conciliado» pero no tienen ningún movimiento: fueron meses sin nada que pagar.`,
  "Pasarlas a «desactivado». No cambia ningún número (son $ 0); salen del aviso de Principal y de «Inconsistencias».",
  "Tu regla: «si hay algo conciliado pero sin ningún tipo de pago vinculado, tiene que ir a inconsistencias». Desactivadas dicen lo que son: no había nada que pagar.",
  ["Template", "Año", "Fecha", "Importe", "Estado hoy"], filasP2, 0, [34, 8, 12, 12, 12, 10, 30])

// ── P3 · Otros Gastos sin cuenta → cuenta propuesta
const og = await todas(() => sb.from("cuotas_egresos_sin_factura").select("id, fecha_estimada, monto, categ, detalle, descripcion, egreso:egresos_sin_factura!inner(nombre_referencia, responsable, categ)")
  .gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-06-30").neq("estado", "desactivado").order("id"))
const sinCuenta = (og ?? []).filter((c: any) => /^Otros Gastos/.test(c.egreso.nombre_referencia) && !c.categ && !c.egreso.categ)
const propuesta = (c: any) => /pdf|google|dropbox|zoom/i.test(`${c.detalle} ${c.descripcion}`) ? "INFORMATICA" : /medialuna|reuni/i.test(`${c.detalle} ${c.descripcion}`) ? "GASTOS DE REPRESENTACION" : "(a definir)"
hoja("P3", "P3 Sin cuenta", "Cuotas de «Otros Gastos» sin cuenta → la cuenta propuesta",
  `${sinCuenta.length} cuotas de «Otros Gastos» sin cuenta: el balance no sabe dónde ubicarlas (van a «sin clasificar»).`,
  "Cargarles la cuenta de la columna «Cuenta propuesta». Siguen dentro de «Otros Gastos»: la cuenta es la de la cuota.",
  "Son servicios de PDF y Google One (en dólares, ya pasados a pesos): las demás del mismo tipo están en «INFORMATICA».",
  ["Template", "Fecha", "Importe", "Detalle", "Cuenta propuesta"],
  sinCuenta.map((c: any) => [c.egreso.nombre_referencia, dmy(c.fecha_estimada), IMP(Number(c.monto)), (c.detalle || c.descripcion || "").slice(0, 120), propuesta(c)]),
  sinCuenta.reduce((t: number, c: any) => t + Number(c.monto), 0), [18, 12, 14, 70, 26, 10, 30])

// ── P4 · FLIA como template
const { data: flia } = await sb.schema("ma").from("ma_galicia").select("id, fecha, descripcion, debitos, creditos, contable, detalle, leyendas_adicionales_1").ilike("contable", "FLIA%").order("fecha")
hoja("P4", "P4 FLIA", "Transferencias entre familiares: template «FLIA» en vez de código",
  "4 movimientos de MA CA con código «FLIA» están vinculados al template «Consumos MA», así que suman como consumos. Son transferencias entre familiares: José María → MA ($ 2.001.000) y MA → Andrés ($ 325.000).",
  "Crear el template «FLIA» (de MA, movimientos de la familia) y pasar esas 4 cuotas ahí; el código contable queda vacío. Salen de «Consumos MA» y quedan registradas en FLIA.",
  "Tu indicación: «los CUIT de los hijos no deberían ser consumos, deberían ser FLIA pero en un template, no en un contable».",
  ["Fecha", "Movimiento", "Entró", "Salió", "Detalle", "Contraparte"],
  (flia ?? []).map((m: any) => [dmy(m.fecha), m.descripcion, Number(m.creditos) ? IMP(Number(m.creditos)) : "", Number(m.debitos) ? IMP(Number(m.debitos)) : "", m.detalle ?? "", m.leyendas_adicionales_1 ?? ""]),
  (flia ?? []).reduce((t: number, m: any) => t + Number(m.debitos) - Number(m.creditos), 0), [12, 28, 14, 14, 40, 34, 10, 30])

// ── P5 · Vulcano: reintegro de gastos médicos
hoja("P5", "P5 Vulcano", "Reintegro de gastos médicos a Fabián Vulcano: gasto de MSA, no de MA",
  "La transferencia del Galicia MSA del 06/04/26 ($ 84.000) a Marcela Sandra Amestoy dice «Reintegro Vulcano Gastos Médicos». Hoy está en «Otros Gastos» con la cuenta «Gastos varios ganadería» y el código «CTA MA» (como si fuera de MA).",
  "Sacarle «CTA MA» (MA no tiene nada que ver) y registrarlo como pago a Fabián Vulcano en Sueldos (está como empleado, sin pagos). ⚠️ Sueldos hoy sólo tiene los tipos «anticipo» y «sueldo»: o se agrega el tipo «reintegro», o va como «sueldo» con la descripción «Reintegro gastos médicos». Elegí en «Comentario».",
  "Tu indicación: «es un gasto de MSA que iría como un reintegro a Vulcano… se puede crear el pago en sueldos… MA nada que ver acá».",
  ["Fecha", "Cuenta", "Importe", "Detalle del banco", "Hoy", "Quedaría"],
  [["06/04/2026", "Galicia MSA CC", IMP(84000), "Reintegro Vulcano Gastos Medicos (a Marcela Sandra Amestoy)", "Otros Gastos · CTA MA", "Sueldos · Fabián Vulcano · reintegro gastos médicos · sin código"]],
  84000, [12, 16, 12, 44, 22, 40, 10, 30])

// ── Abiertos (DR7, DR8, DR10): con TODO el contexto (JMS 10/11: «siempre tenés que poner todo el contexto disponible»), copiados del último
// H para auditar («Datos a revisar»: proveedor, comprobante, detalle, código, descripción del banco, beneficiario, link a su solapa)
const carpeta = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const { readdirSync } = await import("node:fs")
const ultimaH = readdirSync(carpeta).filter(f => /^H para auditar MSA 25-26 \(2026-11-07\) v\d+\.xlsx$/.test(f)).sort((a, b) => Number(a.match(/v(\d+)/)![1]) - Number(b.match(/v(\d+)/)![1])).pop()!
const dr = XLSX.utils.sheet_to_json(XLSX.readFile(join(carpeta, ultimaH)).Sheets["Datos a revisar"], { header: 1, raw: true }) as unknown[][]
const encDR = ["Fecha", "Cuenta / quién pagó", "Importe", "Concepto", "Proveedor", "Comprobante", "Detalle", "Código", "Descripción del banco", "Beneficiario / CUIT", "Está en (solapa del H)"]
const abiertos: Array<[string, string, string, string]> = [
  ["DR7", "A1 DR7 Deuda", "Cuotas SIN PAGAR al cierre (30/06/26): ¿van como DEUDA?", "Las cuotas del ejercicio que al 30/06/26 seguían pendientes. Si se iban a pagar, son deuda al cierre (van al papel de cuentas a pagar); si no se iban a pagar, se desactivan. Incluye Gol, Tiguan y Toyota 2026 (en $ 0: esperan la reliquidación de la Municipalidad SP)."],
  ["DR8", "A2 DR8 Extracto MA", "El extracto del Galicia MA empieza el 07/10/2025: ¿cargamos jul–sep 2025?", "Sin esos tres meses, movimientos de PAM a MA de ese período no tienen su otra punta. Ej.: la transferencia de PAM a MA del 06/08/25 por $ 4.000.000 (abajo)."],
  ["DR10", "A3 DR10 Leguizamon Aduriz", "Transferencias de MA con «CTA MSA» sin factura que coincida (Leguizamón y Aduriz)", "MA pagó desde su cuenta y el movimiento dice «CTA MSA» (gasto de MSA pagado por MA = aporte de MA), pero no hay una factura de MSA que coincida. ¿Son gastos de MSA? ¿de qué?"],
]
for (const [id, solapa, titulo, que] of abiertos) {
  const filas = dr.filter(x => x && x[0] === id).map(x => [x[1], x[2], IMP(Number(x[3]) || 0), x[4], x[5], x[6], x[7], x[8], x[9], x[10], (x[11] as { v?: string })?.v ?? x[11] ?? ""])
  hoja(id, solapa, titulo, que, "Decidís vos: escribí en «Comentario» qué es cada uno (o en «¿Va todo?» si es lo mismo para todos).", `Copiado de «${ultimaH}», solapa «Datos a revisar».`,
    encDR, filas, filas.reduce((t, f) => t + Number((f[2] as { v: number }).v || 0), 0), [11, 22, 14, 24, 22, 14, 36, 14, 30, 34, 26, 10, 30])
}

// ── Resumen: ÍNDICE arriba (JMS 10/11: «si vos me dejás el índice, yo voy a cada punto… de solapa en solapa»). Son 8 decisiones, una
// por solapa; la columna «Tu respuesta» trae lo que escribiste en «¿Va todo?» de cada solapa, así se ve qué falta contestar.
const r: unknown[][] = [[T("PROPUESTAS PARA APROBAR — H para auditar MSA 25/26")],
  [N(`Son ${resumen.length} decisiones, una por solapa. Hacé click en «Ir a», leé la caja de arriba (qué pasa, qué se haría, por qué) y escribí «sí», «no» o «sí salvo…» en la celda amarilla «¿Va todo?». Los renglones de abajo de cada solapa son el detalle para mirar: no hace falta contestarlos uno por uno. Nada está hecho todavía: cada una se aplica después con un script con foto previa y deshacer.`)], [],
  ["Nº", "Ir a", "Qué hay que decidir", "Renglones", "Importe", "Qué se haría", "Tu respuesta"].map(C)]
for (const p of resumen) r.push([p.id, { t: "s", v: `➜ ${p.solapa}`, l: { Target: `#'${p.solapa}'!B7` }, s: { font: { color: { rgb: "FF0563C1" }, underline: true } } }, N(p.que),
  { t: "n", v: p.cuantos, z: "0" }, IMP(p.importe), N(p.hacer), { t: "s", f: `IF('${p.solapa}'!B7="","(sin contestar)",'${p.solapa}'!B7)`, v: "(sin contestar)" }])
const finIndice = r.length
r.push([], [C("Te falta traer (para cerrar dos temas)")],
  ["📄", N("El PDF del resumen de la VISA PAM de MAYO 2026 («VISA PAM - 26-05»): para pasar a pesos la última compra en dólares (Spotify, US$ 2,40, resumen del 30/04/26). Dejalo en Extractos / Galicia Eminent PAM / TJ VISA PAM.")],
  ["🚗", N("La RELIQUIDACIÓN de automotores con la Municipalidad de San Pedro: importes de Gol, Tiguan y Toyota 2026 (y Gol y Tiguan jul–dic 2025). Con eso se cargan las cuotas pendientes (hoy en $ 0) y se pagan.")])
r.push([], [C("Ya resuelto en la charla (no hace falta aprobar)")],
  ["DR5", N("Pasajes de JMS con «CTA JMS»: quedan así — es un pago a JMS que genera saldo a facturar (él lo factura como reintegro).")])
const anchosR = [7, 26, 44, 11, 16, 60, 22]
const totalR = anchosR.reduce((t, a) => t + a, 0)
const uR = ["A1:G1", "A2:G2"]; altoDeFila(r, 2, altoTexto(String((r[1][0] as { v: string }).v), totalR))
r.forEach((fila, i) => {
  if (i < finIndice) return
  if (fila.length === 1) uR.push(`A${i + 1}:G${i + 1}`)
  if (fila.length === 2) { uR.push(`B${i + 1}:G${i + 1}`); altoDeFila(r, i + 1, altoTexto(String((fila[1] as { v: string }).v), totalR - 7)) }
})
unirCeldas(r, uR)
agregar("Resumen", r, anchosR)
wb.SheetNames = ["Resumen", ...wb.SheetNames.filter(n => n !== "Resumen")]
// JMS 10/11: «no los pises… si cambia, le hacés una versión nueva». La primera (sin número) es la v1.
const base = "Propuestas para aprobar - H para auditar (2026-11-10)"
const vs0 = readdirSync(carpeta).filter(f => f.startsWith(base) && f.endsWith(".xlsx")).map(f => Number(f.match(/ v(\d+)\.xlsx$/)?.[1] ?? 1))
const destino = join(carpeta, `${base} v${Math.max(0, ...vs0) + 1}.xlsx`)
if (existsSync(destino)) throw new Error("ya existe " + destino)
fechasReales(wb as any)
const vs = vistasDe(wb as any); const orden = wb.SheetNames; const vistas = [vs[vs.length - 1], ...vs.slice(0, -1)]
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistas)))
console.log("📄", destino); for (const p of resumen) console.log(` ${p.id} · ${p.cuantos} renglones · ${p.importe.toFixed(2)}`); void orden
