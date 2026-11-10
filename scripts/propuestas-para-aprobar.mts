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
import { leerMovimientosDeCuotas } from "../lib/balance/movimientos-de-cuotas"
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

// 🔍 LA FICHA (regla CLAUDE.md 10/11, «FICHA COMPLETA»): cada renglón trae todo lo que puede servir para decidir, como un detective.
const FICHA = ["Fecha", "Quién pagó (cuenta)", "Importe", "US$ (si fue en dólares)", "A quién (proveedor · CUIT)", "Detalle", "Template", "Responsable del template",
  "Cuenta contable", "Comprobante que dice que pagó", "Código contable hoy", "Interno hoy", "Descripción del banco", "Cómo se pasó a pesos / nota"]
const ANCHOS_FICHA = [11, 16, 14, 10, 34, 26, 22, 12, 24, 30, 13, 12, 36, 40]
const limpio = (x: unknown) => String(x ?? "").replace(/\s*\[script[^\]]*\]/g, "").replace(/\s+/g, " ").trim()
const SEL_CUOTA = "id, monto, fecha_estimada, estado, categ, detalle, descripcion, grupo_pago_id, egreso:egresos_sin_factura!inner(nombre_referencia, responsable, categ, nombre_quien_cobra, cuit_quien_cobra)"
async function cuotasPorId(ids: string[]): Promise<Map<string, any>> {
  const out = new Map<string, any>()
  for (let i = 0; i < ids.length; i += 200) { const { data, error } = await sb.from("cuotas_egresos_sin_factura").select(SEL_CUOTA).in("id", ids.slice(i, i + 200)); if (error) throw new Error(error.message); for (const c of data ?? []) out.set(c.id, c) }
  return out
}
const aQuien = (m: any, c?: any) => limpio([m.leyendas_adicionales_1, m.leyendas_adicionales_2].filter(Boolean).join(" · ") || m.proveedor_nombre || m.beneficiario
  || [c?.egreso?.nombre_quien_cobra, c?.egreso?.cuit_quien_cobra].filter(Boolean).join(" · ") || "")
/** Un renglón de ficha a partir de un movimiento (puede faltar) y su cuota. */
function ficha(m: any | null, cuenta: string, c: any, importe?: number) {
  const usd = Number(m?.debitos_usd ?? m?.usd ?? 0)
  return [dmy(m?.fecha ?? c?.fecha_estimada), m ? cuenta : "(sin pago)", IMP(importe ?? Number(c?.monto ?? m?.debitos ?? 0)),
    usd ? { t: "n", v: usd, z: MON } : "", aQuien(m ?? {}, c), limpio(m?.detalle || c?.detalle),
    c?.egreso?.nombre_referencia ?? "", c?.egreso?.responsable ?? "", c?.categ || c?.egreso?.categ || "(sin cuenta)", limpio(m?.comprobantes_pagados || m?.comprobante),
    m ? (m.contable || "(vacío)") : "", m ? (m.interno || "(vacío)") : "", limpio(m?.descripcion), limpio(c?.descripcion)]
}

// ── P1 · «DIST MA» en lo que pagó PAM de gastos de MA
const SEL_MOV = "id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, nota_operador, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id"
const tpm = await todas(() => sb.schema("pam").from("tarjeta_visa").select(SEL_MOV + ", debitos_usd, proveedor_nombre, comprobante").not("template_cuota_id", "is", null).order("id"))
const gpm = await todas(() => sb.from("pam_galicia").select(SEL_MOV).not("template_cuota_id", "is", null).order("id"))
const aplicado246 = (m: any) => String(m.nota_operador ?? "").includes("[script 246]")
const movsPAM = [...tpm.map((m: any) => ({ ...m, cuenta: "VISA PAM" })), ...gpm.map((m: any) => ({ ...m, cuenta: "Galicia PAM CA" }))].filter((m: any) => !String(m.contable ?? "").trim() || aplicado246(m))
const cuotaDe = await cuotasPorId([...new Set(movsPAM.map((m: any) => m.template_cuota_id))] as string[])
const esMA = (c: any) => String(c?.egreso?.responsable ?? "").toUpperCase().startsWith("MA")
const p1 = movsPAM.filter((m: any) => esMA(cuotaDe.get(m.template_cuota_id)) && m.fecha >= "2025-07-01" && m.fecha <= "2026-07-31").sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const hechos1 = p1.filter(aplicado246).length
hoja("P1", "P1 DIST MA", "Lo que pagó PAM de gastos de MA: falta el código «DIST MA»",
  `${p1.length} pagos de la VISA PAM (jul–dic 2025) y del Galicia PAM CA (Farmacity, 18/06/26) que pagaron templates de MA (Consumos MA, suscripciones, Gastos Médicos). El interno ya decía «DIST MA»; faltaba el código contable. Ene–abr 2026 ya lo tenían.`,
  `${hechos1 === p1.length ? "✅ YA APLICADO (script 246, con tu OK del 10/11): " : ""}contable «DIST MA» en esos movimientos (no se toca ninguna cuota ni importe). Es tu regla: «si PAM paga algo de MA, entonces DIST MA».`,
  "Aparecieron al pasar Consumos, Médicos y suscripciones 2025 a MA (scripts 239–240). Las compras en dólares (Apple, Skool) ya estaban pasadas a pesos con el TC de cada resumen (scripts 241–242).",
  [...FICHA, "Estado"], p1.map((m: any) => [...ficha(m, m.cuenta, cuotaDe.get(m.template_cuota_id)), aplicado246(m) ? "✅ aplicado (script 246)" : "pendiente"]),
  p1.reduce((t: number, m: any) => t + Number(cuotaDe.get(m.template_cuota_id).monto), 0), [...ANCHOS_FICHA, 22, 10, 30])

// ── P2 · Cuotas en $ 0 marcadas «conciliado» sin pago → desactivadas
const anio = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4))
const { problemas } = await cargarProblemasDeModalidad(sb, anio)
const ceros = problemas.filter(p => p.tipo === "conciliada_en_cero")
const c2 = await cuotasPorId(ceros.flatMap(p => p.cuotas.map(c => c.id)))
const filasP2 = ceros.flatMap(p => p.cuotas.map(c => ({ orden: `${p.template} ${c.fecha ?? ""}`, fila: [...ficha(null, "", c2.get(c.id), c.monto), p.anio ?? "", c.estado, "ninguno"] })))
  .sort((a, b) => a.orden.localeCompare(b.orden)).map(x => x.fila)
hoja("P2", "P2 Ceros a desactivar", "Cuotas en $ 0 marcadas «conciliado» sin ningún pago → pasarlas a «desactivado»",
  `${filasP2.length} cuotas en $ 0 de ${ceros.length} templates (IIBB, SICORE, anticipos, retiros semestrales…) dicen «conciliado» pero no tienen ningún movimiento: fueron meses sin nada que pagar.`,
  "Pasarlas a «desactivado». No cambia ningún número (son $ 0); salen del aviso de Principal y de «Inconsistencias».",
  "Tu regla: «si hay algo conciliado pero sin ningún tipo de pago vinculado, tiene que ir a inconsistencias». Desactivadas dicen lo que son: no había nada que pagar.",
  [...FICHA, "Año del template", "Estado hoy", "Pagos vinculados"], filasP2, 0, [...ANCHOS_FICHA, 10, 12, 12, 10, 30])

// ── P3 · Otros Gastos sin cuenta → cuenta propuesta
const og = await todas(() => sb.from("cuotas_egresos_sin_factura").select(SEL_CUOTA).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-06-30").neq("estado", "desactivado").order("id"))
const sinCuenta = og.filter((c: any) => /^Otros Gastos/.test(c.egreso.nombre_referencia) && !c.categ && !c.egreso.categ).sort((a: any, b: any) => a.fecha_estimada.localeCompare(b.fecha_estimada))
const { movimientos: movs3 } = await leerMovimientosDeCuotas(sb, sinCuenta.map((c: any) => ({ id: c.id, grupoPagoId: c.grupo_pago_id })) as any)
const movDe3 = (c: any) => movs3.find(m => m.vinculo === c.id || m.vinculo === c.grupo_pago_id) ?? null
const propuesta = (c: any) => /pdf|google|dropbox|zoom/i.test(`${c.detalle} ${c.descripcion}`) ? "INFORMATICA" : /medialuna|reuni/i.test(`${c.detalle} ${c.descripcion}`) ? "GASTOS DE REPRESENTACION" : "(a definir)"
hoja("P3", "P3 Sin cuenta", "Cuotas de «Otros Gastos» sin cuenta → la cuenta propuesta",
  `${sinCuenta.length} cuotas de «Otros Gastos» sin cuenta: el balance no sabe dónde ubicarlas (van a «sin clasificar»).`,
  "Cargarles la cuenta de la columna «Cuenta propuesta». Siguen dentro de «Otros Gastos»: la cuenta es la de la cuota.",
  "Son servicios de PDF (vthebestpdf) y Google One (en dólares, ya pasados a pesos): las demás del mismo tipo están en «INFORMATICA».",
  [...FICHA, "Cuenta propuesta"], sinCuenta.map((c: any) => { const m = movDe3(c); return [...ficha(m, m?.cuenta ?? "", c), propuesta(c)] }),
  sinCuenta.reduce((t: number, c: any) => t + Number(c.monto), 0), [...ANCHOS_FICHA, 22, 10, 30])

// ── P4 · FLIA como template
const flia = await todas(() => sb.schema("ma").from("ma_galicia").select("id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id").ilike("contable", "FLIA%").order("id"))
flia.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const c4 = await cuotasPorId(flia.map((m: any) => m.template_cuota_id).filter(Boolean))
hoja("P4", "P4 FLIA", "Transferencias entre familiares: template «FLIA» en vez de código",
  "4 movimientos de MA CA con código «FLIA» están vinculados al template «Consumos MA», así que suman como consumos. Son transferencias entre familiares: José María → MA ($ 2.001.000) y MA → Andrés ($ 325.000).",
  "Crear el template «FLIA» (de MA, movimientos de la familia) y pasar esas 4 cuotas ahí; el código contable queda vacío. Salen de «Consumos MA» y quedan registradas en FLIA.",
  "Tu indicación: «los CUIT de los hijos no deberían ser consumos, deberían ser FLIA pero en un template, no en un contable».",
  [...FICHA, "Entró / salió"], flia.map((m: any) => [...ficha(m, "Galicia MA CA", c4.get(m.template_cuota_id), Number(m.debitos) || Number(m.creditos)), Number(m.creditos) ? "entró a MA" : "salió de MA"]),
  flia.reduce((t: number, m: any) => t + Number(m.debitos) - Number(m.creditos), 0), [...ANCHOS_FICHA, 12, 10, 30])

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
  const filas = dr.filter(x => x && x[0] === id).map(x => [typeof x[1] === "number" ? { t: "n", v: x[1], z: "dd/mm/yyyy" } : x[1], x[2], IMP(Number(x[3]) || 0), x[4], x[5], x[6], x[7], x[8], x[9], x[10], (x[11] as { v?: string })?.v ?? x[11] ?? ""])
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
