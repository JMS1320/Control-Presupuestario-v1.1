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
function agregar(nombre: string, f: unknown[][], anchos: number[], filtro?: string, agrupar?: [number, number]) {
  agregarHoja(wb as any, nombre, f, anchos.map(ancho => ({ ancho })) as any)
  const ws = wb.Sheets[nombre.slice(0, 31)]
  ws["!merges"] = (UN.get(f) ?? []).map(u => XLSX.utils.decode_range(u))
  const rs: any[] = (ws["!rows"] ??= []); for (const [r, h] of Object.entries(AL.get(f) ?? {})) rs[Number(r) - 1] = { ...(rs[Number(r) - 1] ?? {}), hpt: h }
  // 📐 JMS 10/11 («en general listo para agrupar arriba… que se vea mejor la tabla larga de abajo»): la caja de explicación se pliega con el [-]
  if (agrupar) for (let r = agrupar[0]; r <= agrupar[1]; r++) rs[r - 1] = { ...(rs[r - 1] ?? {}), level: 1 }
  if (filtro) ws["!autofilter"] = { ref: filtro }
}
const VERDE = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1E6B3A" } }, fill: { patternType: "solid", fgColor: { rgb: "FFE2F0D9" } } } })
const SUBT = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFDDEBF7" } } } })
/** Alto (en puntos) para que un texto entre entero en un ancho de `ancho` caracteres: Excel no autoajusta celdas unidas. */
const altoTexto = (txt: string, ancho: number) => Math.max(20, Math.ceil(txt.length / Math.max(20, ancho * 0.95) + 0.3) * 15 + 6)
const resumen: Array<{ id: string; solapa: string; que: string; cuantos: number; importe: number; hacer: string }> = []
interface OpcionesHoja { resuelto?: string; tituloVa?: string; notaVa?: string; sinIndice?: boolean; filasSubtitulo?: Set<number> }
function hoja(id: string, solapa: string, titulo: string, que: string, hacer: string, porque: string, enc: string[], filas: unknown[][], importe: number, anchos: number[], o: OpcionesHoja = {}) {
  const h: unknown[][] = [[{ t: "s", v: "⬅ Resumen", l: { Target: "#'Resumen'!A1" } }], [T(`${id} · ${titulo}`)], [], [C("Qué pasa"), N(que)], [C("Qué se haría"), N(hacer)], [C("Por qué"), N(porque)],
    [C(o.resuelto ? "Estado" : "¿Va todo?"), o.resuelto ? VERDE(o.resuelto) : VA(), N(o.resuelto ? "Ya está aplicado: los renglones de abajo quedan como registro de lo que se hizo." : (o.notaVa ?? "← escribí «sí», «no» o «sí salvo…». Si querés decidir renglón por renglón, usá la columna «¿Va?» de abajo."))],
    [], [...enc.map(C), C(o.tituloVa ?? "¿Va?"), C("Comentario")]]
  filas.forEach((f, i) => h.push(o.filasSubtitulo?.has(i) ? [SUBT(String(f[0])), ...f.slice(1).map(() => ""), VA(), ""] : [...f, o.resuelto ? "" : VA(), ""]))
  // 📐 JMS 10/11: «está raro de formatos, no lo puedo leer». Las explicaciones iban en UNA celda angosta (la columna B de la tabla) y
  // Excel estiraba el renglón para abajo. Ahora ocupan todo el ancho de la tabla (celdas unidas) con el alto calculado.
  const ultima = XLSX.utils.encode_col(enc.length + 1)
  const anchoTexto = anchos.slice(1).reduce((t, a) => t + a, 0)
  unirCeldas(h, ["A2:" + ultima + "2", ...[4, 5, 6].map(r => `B${r}:${ultima}${r}`), `C7:${ultima}7`])
  for (const [r, txt] of [[4, que], [5, hacer], [6, porque]] as const) altoDeFila(h, r, altoTexto(txt, anchoTexto))
  agregar(solapa, h, anchos, `A9:${ultima}${h.length}`, [3, 8])
  if (!o.sinIndice) resumen.push({ id, solapa, que: titulo, cuantos: filas.length - (o.filasSubtitulo?.size ?? 0), importe, hacer: o.resuelto ? `${o.resuelto} — ${hacer}` : hacer })
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
  `Contable «DIST MA» en esos movimientos (no se toca ninguna cuota ni importe). Es tu regla: «si PAM paga algo de MA, entonces DIST MA».`,
  "Aparecieron al pasar Consumos, Médicos y suscripciones 2025 a MA (scripts 239–240). Las compras en dólares (Apple, Skool) ya estaban pasadas a pesos con el TC de cada resumen (scripts 241–242).",
  [...FICHA, "Estado"], p1.map((m: any) => [...ficha(m, m.cuenta, cuotaDe.get(m.template_cuota_id)), aplicado246(m) ? "✅ aplicado (script 246)" : "pendiente"]),
  p1.reduce((t: number, m: any) => t + Number(cuotaDe.get(m.template_cuota_id).monto), 0), [...ANCHOS_FICHA, 22, 10, 30],
  { resuelto: hechos1 === p1.length ? "✅ RESUELTO (script 246, 10/11)" : undefined })

// ── P2 · Cuotas en $ 0 «conciliado» sin pago. JMS 10/11: «no es algo que puedo decirte para todos lo mismo» → una respuesta POR TEMPLATE
// (solapa P2), y el detalle cuota por cuota aparte (P2 detalle). La respuesta nueva para «correctamente no hubo nada que pagar» es el
// estado «Nada a pagar» (JMS 10/11; a construir: A-FEAT-1587).
const anio = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 4))
const { problemas } = await cargarProblemasDeModalidad(sb, anio)
const ceros = problemas.filter(p => p.tipo === "conciliada_en_cero").sort((a, b) => a.template.localeCompare(b.template))
const c2 = await cuotasPorId(ceros.flatMap(p => p.cuotas.map(c => c.id)))
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const mesCorto = (f: string | null) => (f ? `${MESES[Number(f.slice(5, 7)) - 1]}-${f.slice(2, 4)}` : "")
/** Mi lectura de cada template (a confirmar por JMS), con lo que se sabe. */
function lectura(nombre: string, conImporte: number): [string, string] {
  if (/Anticipo Ganancias MSA/.test(nombre)) return ["Nada a pagar", "Lo confirmaste: MSA no tuvo anticipos (todos cubiertos)."]
  if (/Anticipo Ganancias \/ Bs Pers PAM/.test(nombre)) return ["Revisar", "Agosto SÍ se pagó: $ 86.000,71 el 14/08/25 desde Galicia PAM a «IMPAFIP» («Anticipos PAM 1/5 - para 2025»), sin vincular. Octubre y diciembre: no encontré pago en las cuentas de PAM → A-DAT-100."]
  if (/SICORE/.test(nombre)) return ["Nada a pagar", "Probable: quincenas sin retenciones que depositar (las quincenas con importe sí se pagaron)."]
  if (/IIBB/.test(nombre)) return ["Nada a pagar", conImporte ? "Probable: meses con saldo a favor (los meses con importe sí se pagaron)." : "Probable: en todo el ejercicio no hubo importe a pagar (saldo a favor)."]
  if (/^Retiro/.test(nombre)) return ["Nada a pagar", conImporte ? "Probable: ese mes no hubo retiro (los otros sí)." : "Probable: en todo el ejercicio no hubo retiro."]
  if (/UATRE/.test(nombre)) return ["Revisar", "Los otros meses se pagaron: ¿estos meses no hubo nada que pagar, o falta vincular el pago?"]
  if (/^Caja/.test(nombre)) return ["Revisar", "7 meses del tramo jul-25 → ene-26 en $ 0 y el resto con importe: puede ser que el movimiento a caja esté en otra cuota."]
  return ["Revisar", "Los otros meses se pagaron: puede faltar vincular el pago de este mes (o no hubo que pagar)."]
}
const filasT: unknown[][] = []
for (const p of ceros) {
  const cuotasDelEj = await todas(() => sb.from("cuotas_egresos_sin_factura").select("id, monto, fecha_estimada").eq("egreso_id", p.templateId).gte("fecha_estimada", "2025-07-01").lte("fecha_estimada", "2026-06-30").order("id"))
  const conPlata = cuotasDelEj.filter((c: any) => Number(c.monto) > 0)
  const una = c2.get(p.cuotas[0].id)
  const [propuesta, porQue] = lectura(p.template, conPlata.length)
  filasT.push([p.template, una?.egreso?.responsable ?? "", p.anio ?? "", una?.categ || una?.egreso?.categ || "(sin cuenta)",
    [una?.egreso?.nombre_quien_cobra, una?.egreso?.cuit_quien_cobra].filter(Boolean).join(" · "),
    [...p.cuotas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map(c => mesCorto(c.fecha)).join(", "), { t: "n", v: p.cuotas.length, z: "0" },
    { t: "n", v: conPlata.length, z: "0" }, IMP(conPlata.reduce((t: number, c: any) => t + Number(c.monto), 0)), propuesta, porQue])
}
hoja("P2", "P2 Ceros por template", "Cuotas en $ 0 «conciliado» sin ningún pago: ¿qué pasó en cada template?",
  `${ceros.reduce((t, p) => t + p.cuotas.length, 0)} cuotas en $ 0 de ${ceros.length} templates dicen «conciliado» pero no tienen ningún pago. No es lo mismo para todos (tu respuesta de la v2): hay meses donde correctamente no hubo nada que pagar, y otros donde se pagó y falta vincular (ej.: el anticipo de PAM de agosto).`,
  "Por cada template, una de tres: «Nada a pagar» (correctamente en $ 0: la cuota pasa a ese estado nuevo, que el control acepta) · «Se pagó, falta vincular» (busco el pago y lo vinculo) · «Revisar» (queda como pendiente). Abajo, mi lectura de cada uno.",
  "Tu regla: «si hay algo conciliado pero sin ningún tipo de pago vinculado, tiene que ir a inconsistencias». «Desactivado» no sirve (tu respuesta): significa la modalidad que no se usa. El estado «Nada a pagar» es el que pediste (A-FEAT-1587, a construir).",
  ["Template", "Responsable", "Año", "Cuenta contable", "A quién (CUIT)", "Meses en $ 0", "Cuotas en $ 0", "Cuotas con importe en el ejercicio", "$ con importe en el ejercicio", "Mi propuesta", "Por qué"],
  filasT, 0, [32, 12, 8, 22, 16, 44, 9, 11, 16, 16, 60, 26, 30],
  { tituloVa: "Tu respuesta (Nada a pagar / Se pagó, falta vincular / Revisar)", notaVa: "← si estás de acuerdo con «Mi propuesta» en todos, escribí «sí». Si no, contestá template por template en la columna «Tu respuesta» de abajo. El detalle de cada cuota está en «P2 detalle»." })
const filasP2 = ceros.flatMap(p => p.cuotas.map(c => ({ orden: `${p.template} ${c.fecha ?? ""}`, fila: [...ficha(null, "", c2.get(c.id), c.monto), p.anio ?? "", c.estado, "ninguno"] })))
  .sort((a, b) => a.orden.localeCompare(b.orden)).map(x => x.fila)
hoja("P2", "P2 detalle", "El detalle de cada cuota en $ 0 (para mirar; se contesta en «P2 Ceros por template»)",
  `Las ${filasP2.length} cuotas, ordenadas por template y fecha, con su ficha completa.`, "Lo que contestes por template en la solapa «P2 Ceros por template».", "Si un mes de un template es distinto de los otros, anotalo en «Comentario».",
  [...FICHA, "Año del template", "Estado hoy", "Pagos vinculados"], filasP2, 0, [...ANCHOS_FICHA, 10, 12, 12, 10, 30],
  { sinIndice: true, notaVa: "← no hace falta contestar acá: se contesta por template en «P2 Ceros por template»." })

// ── P3 · Otros Gastos sin subcuenta → INFORMATICA (✅ script 249: las 9 cuotas, por id)
const ids249 = (JSON.parse(readFileSync("scripts/249-foto-antes.json", "utf8")) as Array<{ id: string }>).map(x => x.id)
const c3 = [...(await cuotasPorId(ids249)).values()].sort((a: any, b: any) => a.fecha_estimada.localeCompare(b.fecha_estimada))
const { movimientos: movs3 } = await leerMovimientosDeCuotas(sb, c3.map((c: any) => ({ id: c.id, grupoPagoId: c.grupo_pago_id })) as any)
const movDe3 = (c: any) => movs3.find(m => m.vinculo === c.id || m.vinculo === c.grupo_pago_id) ?? null
hoja("P3", "P3 Sin cuenta", "Cuotas de «Otros Gastos» sin subcuenta → INFORMATICA",
  `${c3.length} cuotas de «Otros Gastos» (vthebestpdf y Google One) no tenían subcuenta: su MOVIMIENTO ya decía INFORMATICA (lo habías puesto vos), pero a la cuota no le había llegado, y el balance lee la cuota («sin clasificar»). No hay otros casos así en ninguna cuenta.`,
  "Subcuenta INFORMATICA en la cuota. Sin código contable ni interno: son Otros Gastos de MSA (tu respuesta: «no implica ni contable ni interno, solamente le faltaba la subcuenta»).",
  "Tu respuesta del 10/11.",
  [...FICHA, "Subcuenta antes"], c3.map((c: any) => { const m = movDe3(c); return [...ficha(m, m?.cuenta ?? "", c), "(vacía)"] }),
  c3.reduce((t: number, c: any) => t + Number(c.monto), 0), [...ANCHOS_FICHA, 14, 10, 30], { resuelto: "✅ RESUELTO (script 249, 10/11)" })

// ── P4 · FLIA (✅ script 247: los 4 movimientos, por id)
const ids247 = (JSON.parse(readFileSync("scripts/247-foto-antes.json", "utf8")).movimientos as Array<{ id: string }>).map(x => x.id)
const { data: flia } = await sb.schema("ma").from("ma_galicia").select("id, fecha, descripcion, debitos, creditos, contable, interno, detalle, comprobantes_pagados, leyendas_adicionales_1, leyendas_adicionales_2, template_cuota_id").in("id", ids247)
flia.sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))
const c4 = await cuotasPorId(flia.map((m: any) => m.template_cuota_id).filter(Boolean))
hoja("P4", "P4 FLIA", "Transferencias entre familiares: template «FLIA» en vez de código",
  "4 movimientos de MA CA tenían código «FLIA» y estaban en el template «Consumos MA» (sumaban como consumos). Son transferencias entre familiares: José María → MA ($ 2.001.000) y MA → Andrés ($ 325.000).",
  "Template «FLIA» de MA (entra y sale), las 4 cuotas pasaron ahí y los movimientos quedaron sin código contable ni interno. La categoría «FLIA» se creó en el plan sin rubro (no va a ningún lugar en particular). Tu regla de auditar toda transferencia de MA con alguien de la familia quedó como A-FEAT-1586.",
  "Tu respuesta: «FLIA no va a ninguna cuenta corriente… es la categoría del egreso o ingreso y no implica contable ni interno salvo que se diga lo contrario».",
  [...FICHA, "Entró / salió"], flia.map((m: any) => [...ficha(m, "Galicia MA CA", c4.get(m.template_cuota_id), Number(m.debitos) || Number(m.creditos)), Number(m.creditos) ? "entró a MA" : "salió de MA"]),
  flia.reduce((t: number, m: any) => t + Number(m.debitos) - Number(m.creditos), 0), [...ANCHOS_FICHA, 12, 10, 30], { resuelto: "✅ RESUELTO (script 247, 10/11)" })

// ── P5 · Vulcano (✅ script 250)
hoja("P5", "P5 Vulcano", "Reintegro de gastos médicos a Fabián Vulcano: gasto de MSA, no de MA",
  "La transferencia del Galicia MSA del 06/04/26 ($ 84.000 a Marcela Sandra Amestoy, CUIT 27177378858, «Reintegro Vulcano Gastos Medicos») estaba en «Otros Gastos» con «CTA MA», y además vinculada POR ERROR al pago de sueldo de Alondra Olivo («Pago Saldo Mar 2026», $ 84.000), que ya tiene su transferencia propia del 08/04/26.",
  "En Sueldos, Vulcano abril 2026: «Varios» $ 84.000 a cobrar (reintegro gastos médicos) y el pago del 06/04 vinculado a la transferencia (netea: el saldo del mes sigue en $ 1.760.000). La transferencia salió de Otros Gastos (cuota desactivada, «pasó a Sueldos») y quedó sin «CTA MA». Alondra quedó sólo con su transferencia del 08/04.",
  "Tu indicación: «a Vulcano hay que ponerle un concepto de esto del tema médico de 84… de ahí se le vincula la transferencia y ahí se netea». Vulcano y Elvio cobran siempre en efectivo de la caja (no cargada): por eso no tienen otros pagos.",
  ["Fecha", "Cuenta", "Importe", "A quién (CUIT)", "Detalle del banco", "Antes", "Ahora"],
  [[dmy("2026-04-06"), "Galicia MSA CC", IMP(84000), "Marcela Sandra Amestoy · 27177378858", "Trf Inmed Proveed — Reintegro Vulcano Gastos Medicos", "Otros Gastos · GASTOS VARIOS GANADERIA · CTA MA · vinculada al pago de Alondra Olivo", "Sueldos · Fabián Vulcano · abril 2026 · Varios (reintegro gastos médicos) · sin código"]],
  84000, [12, 16, 12, 30, 40, 44, 44, 10, 30], { resuelto: "✅ RESUELTO (script 250, 10/11)" })

// ── Abiertos (DR7, DR8, DR10): con TODO el contexto, copiados del último H para auditar («Datos a revisar»)
const carpeta = "- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude"
const { readdirSync } = await import("node:fs")
const ultimaH = readdirSync(carpeta).filter(f => /^H para auditar MSA 25-26 \(2026-11-07\) v\d+\.xlsx$/.test(f)).sort((a, b) => Number(a.match(/v(\d+)/)![1]) - Number(b.match(/v(\d+)/)![1])).pop()!
const dr = XLSX.utils.sheet_to_json(XLSX.readFile(join(carpeta, ultimaH)).Sheets["Datos a revisar"], { header: 1, raw: true }) as unknown[][]
const encDR = ["Fecha", "Cuenta / quién pagó", "Importe", "Concepto", "Proveedor", "Comprobante", "Detalle", "Código", "Descripción del banco", "Beneficiario / CUIT", "Está en (solapa del H)"]
const filaDR = (x: unknown[]) => [typeof x[1] === "number" ? { t: "n", v: x[1], z: "dd/mm/yyyy" } : x[1], x[2], IMP(Number(x[3]) || 0), x[4], x[5], x[6], x[7], x[8], x[9], x[10], (x[11] as { v?: string })?.v ?? x[11] ?? ""]
const ANCHOS_DR = [11, 22, 14, 24, 22, 14, 36, 14, 30, 34, 26, 12, 30]
const sumaDR = (fs: unknown[][]) => fs.reduce((t, f) => t + Number((f[2] as { v?: number })?.v || 0), 0)

// A1 · DR7 partido en grupos (JMS 10/11: «después nos va a quedar una sola con 8 renglones que vamos a resolver rápido»)
const GRUPOS_A1: Array<[RegExp, string]> = [
  [/Automotores/, "A1.1 · Automotores Gol, Tiguan y Toyota (en $ 0) — YA DECIDIDO: esperan la reliquidación de la Municipalidad SP (A-FEAT-1581). No hace falta contestar."],
  [/^ACA/, "A1.2 · ACA (Automóvil Club), cuotas mensuales de $ 28.600 — ¿se pagaron (por otra cuenta o tarjeta) o son deuda al 30/06/26?"],
  [/Tarjeta VISA PAM/, "A1.3 · Tarjeta VISA PAM y VISA PAM USS — ¿son resúmenes ya pagados que falta vincular, o deuda al cierre?"],
  [/Internet NZ/, "A1.4 · Internet NZ (Orbith), $ 75.508,01 — ¿deuda o se pagaron?"],
  [/Aportes Domesticas/, "A1.5 · Aportes de domésticas (en $ 0) — ¿«Nada a pagar»?"],
  [/ABL Cochera/, "A1.6 · ABL de la cochera Libertad — el detalle dice «pagó JMS desde su CA el 30/01»: NO es deuda, falta cargar ese pago (¿como pago de JMS, CTA JMS?)."],
  [/Red Vial/, "A1.7 · Red Vial de la quinta Roselló (cuotas 1 y 2, jun-26) — ¿deuda al cierre?"],
]
const dr7 = dr.filter(x => x && x[0] === "DR7")
const filasA1: unknown[][] = [], subt = new Set<number>()
for (const [re, tit] of GRUPOS_A1) { const g = dr7.filter(x => re.test(String(x[4] ?? ""))); if (!g.length) continue; subt.add(filasA1.length); filasA1.push([tit, ...encDR.slice(1).map(() => "")]); for (const x of g) filasA1.push(filaDR(x)) }
const sueltos = dr7.filter(x => !GRUPOS_A1.some(([re]) => re.test(String(x[4] ?? ""))))
if (sueltos.length) { subt.add(filasA1.length); filasA1.push(["A1.8 · Otros", ...encDR.slice(1).map(() => "")]); for (const x of sueltos) filasA1.push(filaDR(x)) }
hoja("DR7", "A1 DR7 Deuda", "Cuotas SIN PAGAR al cierre (30/06/26): ¿van como DEUDA?",
  "Las cuotas del ejercicio que al 30/06/26 seguían pendientes, partidas en grupos (cada grupo es una sola respuesta). Si se iban a pagar, son deuda al cierre (van al papel de cuentas a pagar); si no, «Nada a pagar»; si se pagaron, falta vincular el pago.",
  "Contestás en la celda amarilla de cada renglón azul (el título del grupo). Los renglones de abajo de cada título son su detalle.", `Copiado de «${ultimaH}», solapa «Datos a revisar».`,
  encDR, filasA1, sumaDR(filasA1.filter((_, i) => !subt.has(i))), ANCHOS_DR,
  { filasSubtitulo: subt, tituloVa: "Tu respuesta (por grupo)", notaVa: "← no hace falta: contestá en la celda amarilla de cada grupo (renglones azules de abajo)." })

const filas8 = dr.filter(x => x && x[0] === "DR8").map(filaDR)
hoja("DR8", "A2 DR8 Extracto MA", "La transferencia de PAM a MA del 06/08/25 ($ 4.000.000) sin su otra punta",
  "Salió del Galicia PAM al BBVA FRANCÉS de MA (CBU 0170023740000003618361, CUIT 27066824611, «Retiro MAM Frances»), no al Galicia MA: por eso no tenía otra punta. Es la única transferencia de PAM a MA de jul → oct-25.",
  "Se le anotó la otra punta: «entra al BBVA Francés de MA, cuenta sin extracto en el sistema, no se usa más». No se crea la cuenta (tu respuesta: «es una cuenta que no se va a usar nunca más… sería el único movimiento»).",
  "Tu respuesta del 10/11.", encDR, filas8, sumaDR(filas8), ANCHOS_DR, { resuelto: "✅ RESUELTO (script 248, 10/11)" })

const filas10 = dr.filter(x => x && x[0] === "DR10").map(filaDR)
hoja("DR10", "A3 DR10 Leguizamon Aduriz", "Transferencias de MA con «CTA MSA» sin factura que coincida (Leguizamón y Aduriz)",
  "Leguizamón (María Elizabet, CUIT 27124882511) le facturó SÓLO a MSA: Fac A 0004-00000563 del 06/02/26 por $ 150.390 (a MA nunca). Aduriz (Pedro Aduriz Berro, CUIT 20263173326) le facturó SÓLO a MSA: Fac C 0002-00000591 del 24/09/26 por $ 75.000 (ya del ejercicio siguiente). Los pagos de MA ($ 57.400 el 09/04/26 y $ 60.000 el 04/12/25) no coinciden con esas facturas.",
  "Quedan como están: «CTA MSA» = MA pagó algo de MSA (aporte de MA a MSA), sin factura que coincida. No se cambió nada.",
  "Tu decisión del 03/11 (script 185) y tu confirmación del 10/11.", encDR, filas10, sumaDR(filas10), ANCHOS_DR, { resuelto: "✅ RESUELTO (sin cambios: quedan CTA MSA)" })

// ── Resumen: ÍNDICE arriba (JMS 10/11: «si vos me dejás el índice, yo voy a cada punto… de solapa en solapa»). Son 8 decisiones, una
// por solapa; la columna «Tu respuesta» trae lo que escribiste en «¿Va todo?» de cada solapa, así se ve qué falta contestar.
const r: unknown[][] = [[T("PROPUESTAS PARA APROBAR — H para auditar MSA 25/26")],
  [N(`Son ${resumen.length} decisiones, una por solapa. Hacé click en «Ir a», leé la caja de arriba (qué pasa, qué se haría, por qué) y escribí «sí», «no» o «sí salvo…» en la celda amarilla «¿Va todo?». Los renglones de abajo de cada solapa son el detalle para mirar. Lo que ya está aplicado dice «✅ RESUELTO (script N)»: cada uno se hizo con un script con foto previa y deshacer. En cada solapa, el [–] de la izquierda pliega la caja de arriba.`)], [],
  ["Nº", "Ir a", "Qué hay que decidir", "Renglones", "Importe", "Qué se haría", "Tu respuesta"].map(C)]
for (const p of resumen) r.push([p.id, { t: "s", v: `➜ ${p.solapa}`, l: { Target: `#'${p.solapa}'!B7` }, s: { font: { color: { rgb: "FF0563C1" }, underline: true } } }, N(p.que),
  { t: "n", v: p.cuantos, z: "0" }, IMP(p.importe), N(p.hacer), { t: "s", f: `IF('${p.solapa}'!B7="","(sin contestar)",'${p.solapa}'!B7)`, v: "(sin contestar)" }])
const finIndice = r.length
r.push([], [C("Te falta traer (para cerrar dos temas)")],
  ["📄", N("El PDF del resumen de la VISA PAM de MAYO 2026 («VISA PAM - 26-05»): para pasar a pesos la última compra en dólares (Spotify, US$ 2,40, resumen del 30/04/26). Dejalo en Extractos / Galicia Eminent PAM / TJ VISA PAM.")],
  ["🚗", N("La RELIQUIDACIÓN de automotores con la Municipalidad de San Pedro: importes de Gol, Tiguan y Toyota 2026 (y Gol y Tiguan jul–dic 2025). Con eso se cargan las cuotas pendientes (hoy en $ 0) y se pagan.")])
r.push([], [C("Quedaron como pendiente (no se resuelven acá)")],
  ["A-DAT-100", N("Anticipos de Ganancias / Bs Pers de PAM 2025: agosto se pagó ($ 86.000,71 el 14/08/25, sin vincular); octubre y diciembre no se encontraron.")],
  ["A-FEAT-1587", N("Construir el estado «Nada a pagar» (el nombre lo elegiste el 10/11) para las cuotas que correctamente quedaron en $ 0.")],
  ["A-FEAT-1586", N("Auditar toda transferencia de MA con alguien de la familia: ¿contra factura o FLIA?")])
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
