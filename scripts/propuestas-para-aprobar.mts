/**
 * ✅ PROPUESTAS PARA APROBAR (JMS 10/11: «de las cosas que vos más seguro estás me lo dejás en un Excel aparte, como unas fotos sólo de las
 * tablas de problemas, lo mejor explicadas; yo lo trato de ver ahí directo»). Una solapa por propuesta: qué pasa, qué se haría, los renglones
 * exactos y una columna «¿Va?» para aprobar en bloque. SÓLO LEE.  npx tsx scripts/propuestas-para-aprobar.mts
 */
import { createClient } from "@supabase/supabase-js"
import XLSX from "xlsx-js-style"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"
import { cargarProblemasDeModalidad } from "../lib/templates/modalidad"

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
const resumen: Array<{ id: string; solapa: string; que: string; cuantos: number; importe: number; hacer: string }> = []
function hoja(id: string, solapa: string, titulo: string, que: string, hacer: string, porque: string, enc: string[], filas: unknown[][], importe: number, anchos: number[]) {
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(`${id} · ${titulo}`)], [], [C("Qué pasa"), N(que)], [C("Qué se haría"), N(hacer)], [C("Por qué"), N(porque)],
    [C("¿Va todo?"), VA(), N("← escribí «sí», «no» o «sí salvo…». Si querés decidir renglón por renglón, usá la columna «¿Va?» de abajo.")], [], [...enc.map(C), C("¿Va?"), C("Comentario")]]
  for (const f of filas) h.push([...f, VA(), ""])
  agregarHoja(wb as any, solapa, h, anchos.map(ancho => ({ ancho })) as any)
  resumen.push({ id, solapa, que: titulo, cuantos: filas.length, importe, hacer })
}

// ── P1 · «DIST MA» en lo que pagó PAM de gastos de MA
const tpm = await todas(() => sb.schema("pam").from("tarjeta_visa").select("id, fecha, descripcion, debitos, creditos, debitos_usd, contable, template_cuota_id").not("template_cuota_id", "is", null).order("id"))
const gpm = await todas(() => sb.from("pam_galicia").select("id, fecha, descripcion, debitos, creditos, contable, template_cuota_id").not("template_cuota_id", "is", null).order("id"))
const movsPAM = [...(tpm ?? []).map((m: any) => ({ ...m, cuenta: "VISA PAM" })), ...(gpm ?? []).map((m: any) => ({ ...m, cuenta: "Galicia PAM CA" }))].filter((m: any) => !String(m.contable ?? "").trim())
const ids = [...new Set(movsPAM.map((m: any) => m.template_cuota_id))]
const cuotasMA: any[] = []
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await sb.from("cuotas_egresos_sin_factura").select("id, monto, fecha_estimada, egreso:egresos_sin_factura!inner(nombre_referencia, responsable)").in("id", ids.slice(i, i + 200))
  cuotasMA.push(...(data ?? []).filter((c: any) => String(c.egreso?.responsable ?? "").toUpperCase().startsWith("MA")))
}
const cuotaDe = new Map(cuotasMA.map(c => [c.id, c]))
const p1 = movsPAM.filter((m: any) => cuotaDe.has(m.template_cuota_id) && m.fecha >= "2025-07-01" && m.fecha <= "2026-07-31").sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
hoja("P1", "P1 DIST MA", "Lo que pagó PAM de gastos de MA: falta el código «DIST MA»",
  `${p1.length} pagos de la VISA PAM y del Galicia PAM CA que pagaron templates de MA (Consumos MA, suscripciones, Gastos Médicos) no tienen código. En «Inconsistencias» salen como «⚠️ el código contable no es el esperado».`,
  "Ponerles contable «DIST MA» a esos movimientos (no se toca ninguna cuota ni importe). Es tu regla: «si PAM paga algo de MA, entonces DIST MA».",
  "Aparecieron al pasar Consumos, Médicos y suscripciones 2025 a MA (scripts 239–240): lo que antes era «PAM pagó lo suyo» ahora es «PAM pagó lo de MA».",
  ["Fecha", "Cuenta", "Template (de MA)", "Descripción del banco", "Importe de la cuota", "Código hoy"],
  p1.map((m: any) => [dmy(m.fecha), m.cuenta, cuotaDe.get(m.template_cuota_id).egreso.nombre_referencia, m.descripcion, IMP(Number(cuotaDe.get(m.template_cuota_id).monto)), "(vacío)"]),
  p1.reduce((t: number, m: any) => t + Number(cuotaDe.get(m.template_cuota_id).monto), 0), [12, 16, 24, 46, 16, 12, 10, 30])

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

// ── Resumen
const r: unknown[][] = [[T("PROPUESTAS PARA APROBAR — H para auditar MSA 25/26")],
  [N("Cada propuesta tiene su solapa con los renglones exactos. Escribí «sí» / «no» en «¿Va todo?» (o renglón por renglón). Nada está hecho todavía: cada una se aplica con un script con foto previa y deshacer.")], [],
  ["Nº", "Propuesta", "Renglones", "Importe", "Qué se haría", "Ir a"].map(C)]
for (const p of resumen) r.push([p.id, N(p.que), { t: "n", v: p.cuantos, z: "0" }, IMP(p.importe), N(p.hacer), { t: "s", v: `➜ ${p.solapa}`, l: { Target: `#'${p.solapa}'!A1` } }])
r.push([], [C("Ya resuelto en la charla (no hace falta aprobar)")],
  ["DR5", N("Pasajes de JMS con «CTA JMS»: quedan así — es un pago a JMS que genera saldo a facturar (él lo factura como reintegro).")])
agregarHoja(wb as any, "Resumen", r, [6, 50, 11, 16, 70, 22].map(ancho => ({ ancho })) as any)
wb.SheetNames = ["Resumen", ...wb.SheetNames.filter(n => n !== "Resumen")]
const destino = join("- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude", "Propuestas para aprobar - H para auditar (2026-11-10).xlsx")
const vs = vistasDe(wb as any); const orden = wb.SheetNames; const vistas = [vs[vs.length - 1], ...vs.slice(0, -1)]
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistas)))
console.log("📄", destino); for (const p of resumen) console.log(` ${p.id} · ${p.cuantos} renglones · ${p.importe.toFixed(2)}`); void orden
