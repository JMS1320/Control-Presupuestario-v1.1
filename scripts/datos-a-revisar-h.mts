/**
 * 📋 La solapa «Datos a revisar» del H para auditar (JMS 09/11: «sí, hacé la solapa datos a revisar»). Cada punto pendiente de la
 * revisión de datos con sus movimientos y TODO su contexto (proveedor, comprobante, detalle, descripción del banco, beneficiario), un link a
 * la solapa donde está y una columna vacía para la respuesta. SÓLO LEE. La usa scripts/excel-h-para-auditar.mts con --revisar.
 */
import type { CuotaTemplate } from "../lib/balance/templates-libro"
import { auditarCuota, CENTRADO, baseYModalidad } from "../lib/balance/auditoria-templates"

export const SOLAPA_DATOS = "Datos a revisar"
const dmy = (f: string | null | undefined) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "")
const ley = (m: any) => [m.leyendas_adicionales_1, m.leyendas_adicionales_2, m.leyendas_adicionales_3, m.leyendas_adicionales_4].map((x: unknown) => String(x ?? "").trim()).filter(Boolean).join(" · ")

type Fila = { fecha: string; cuenta: string; importe: number; concepto: string; proveedor: string; comprobante: string; detalle: string; codigo: string; descripcion: string; beneficiario: string; ir: string }

/** Dónde está una cuota en el libro: la PRIMERA fila de una solapa cuyo detalle cumple la condición (0 = no está). */
export type FilaDe = (solapa: string, cumple: (fila: Record<string, string>) => boolean) => number

export async function armarDatosARevisar(sb: any, cuotas: CuotaTemplate[], solapaDe: (c: CuotaTemplate) => string, filaDe?: FilaDe): Promise<unknown[][]> {
  const desdeCuota = (c: CuotaTemplate): Fila => {
    const a = auditarCuota(c)
    return { fecha: dmy(c.fecha), cuenta: a.quienPago || "(sin pago)", importe: c.monto, concepto: c.concepto, proveedor: c.proveedor ?? "", comprobante: c.banco?.comprobante ?? "",
      detalle: c.detalle ?? "", codigo: a.codigo, descripcion: a.descripcion, beneficiario: a.beneficiario, ir: solapaDe(c) }
  }
  const conA = cuotas.map(c => ({ c, a: auditarCuota(c) }))
  const del = (p: (x: { c: CuotaTemplate; a: ReturnType<typeof auditarCuota> }) => boolean) => conA.filter(p).sort((x, y) => (x.c.fecha ?? "").localeCompare(y.c.fecha ?? "")).map(x => desdeCuota(x.c))
  const banco = async (schema: string, tabla: string, cuenta: string, filtro: (q: any) => any): Promise<Fila[]> => {
    const q = schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla)
    const { data } = await filtro(q.select("*"))
    return (data ?? []).map((m: any) => ({ fecha: dmy(m.fecha), cuenta, importe: Number(m.debitos || 0) - Number(m.creditos || 0), concepto: m.categ ?? "", proveedor: "", comprobante: String(m.numero_de_comprobante ?? ""),
      detalle: String(m.detalle ?? ""), codigo: String(m.contable ?? ""), descripcion: String(m.descripcion ?? ""), beneficiario: ley(m), ir: "" }))
  }

  // Wilson Barreto: la caja Sigot y los anticipos de Sueldos
  const { data: sigot } = await sb.schema("msa").from("caja_sigot").select("*").ilike("descripcion", "%barreto%")
  const { data: emp } = await sb.from("sueldos_empleados").select("id").ilike("nombre", "%barreto%")
  const { data: ant } = emp?.length ? await sb.from("sueldos_pagos").select("*").in("empleado_id", emp.map((e: any) => e.id)).eq("monto", 200000).gte("fecha", "2026-02-01").lte("fecha", "2026-03-31") : { data: [] }
  const wilson: Fila[] = [
    ...(sigot ?? []).filter((m: any) => Math.abs(Number(m.debitos || 0) - 200000) < 1).map((m: any) => ({ fecha: dmy(m.fecha), cuenta: "Caja Sigot (MSA)", importe: Number(m.debitos || 0), concepto: "",
      proveedor: "", comprobante: "", detalle: String(m.detalle ?? ""), codigo: String(m.contable ?? ""), descripcion: String(m.descripcion ?? ""), beneficiario: m.sueldo_pago_id ? "atado a Sueldos" : "NO está atado a Sueldos", ir: "" })),
    ...(ant ?? []).map((p: any) => ({ fecha: dmy(p.fecha), cuenta: `Sueldos · ${p.medio_pago ?? ""}`, importe: Number(p.monto), concepto: `anticipo (${p.estado})`, proveedor: "Wilson Barreto",
      comprobante: "", detalle: String(p.descripcion ?? ""), codigo: "", descripcion: "", beneficiario: "", ir: "" })),
  ]

  const PUNTOS: Array<{ id: string; titulo: string; decidir: string; filas: Fila[] }> = [
    { id: "DR1", titulo: "«MA pagó por PAM» — templates 2025 de PAM pagados por MA (Consumos MA, Gastos Médicos, suscripciones)",
      decidir: "¿Son gastos de MA (el template 2025 pasa a MA y no hay nada entre empresas) o de PAM (llevan «CTA PAM»)? Ver también el anexo Consumos MA.",
      filas: del(x => x.a.efecto === "MA pagó por PAM") },
    { id: "DR2", titulo: "Código contable «X» (no es un código válido)", decidir: "¿Lo cambiamos al esperado («CTA PAM»)?",
      filas: del(x => x.a.codigo.toUpperCase() === "X") },
    { id: "DR3", titulo: "$ 200.000 de MA CA del 19/02/26 con «CTA MSA» (sale como aporte de MA a MSA)", decidir: "Según vos fue un retiro de MA para ella: ¿le sacamos «CTA MSA»?",
      filas: del(x => /^aporte de MA a MSA/.test(x.a.efecto)) },
    { id: "DR4", titulo: "Extracción de MSA con «CTA COTITULARES»", decidir: "¿Fue efectivo para la cuenta de cotitulares?",
      filas: del(x => /COTITULARES/i.test(x.a.codigo)) },
    { id: "DR5", titulo: "Gastos de MSA cargados a un socio: Pasajes con «CTA JMS» y Otros Gastos (Amestoy) con «CTA MA»", decidir: "¿Son personales de JMS / de MA?",
      filas: del(x => /^retiro de JMS pagado por MSA/.test(x.a.efecto) && /pasaje/i.test(x.c.concepto) || /^retiro de MA pagado por MSA/.test(x.a.efecto) && /otros gastos/i.test(x.c.concepto)) },
    { id: "DR6", titulo: "Código «FLIA» (familia): no es una empresa ni un socio", decidir: "¿Qué es FLIA y a qué cuenta corriente va?",
      filas: del(x => /^FLIA/i.test(x.a.codigo)) },
    { id: "DR7", titulo: "Cuotas SIN PAGAR al cierre → ¿DEUDA al 30/06?", decidir: "¿Cuáles van como deuda al cierre y cuáles se desactivan (no se iban a pagar)?",
      filas: del(x => x.a.marca.startsWith("🔴")) },
    { id: "DR8", titulo: "El extracto de Galicia MA empieza el 07/10/2025: jul–sep 2025 no están cargados", decidir: "¿Cargamos esos tres meses? La transferencia de PAM a MA del 06/08/25 no tiene su otra punta.",
      filas: await banco("public", "pam_galicia", "Galicia PAM CA", q => q.eq("fecha", "2025-08-06").eq("debitos", 4000000)) },
    { id: "DR9", titulo: "Wilson Barreto: el adelanto de $ 200.000 figura el 21/02 en la caja Sigot y el 16/03 en sus anticipos de Sueldos", decidir: "¿Es el mismo pago con dos fechas? Si sí, se ata el de la caja al anticipo (y la fecha buena es la de la caja).",
      filas: wilson },
    { id: "DR10", titulo: "Transferencias de MA a terceros con «CTA MSA» SIN factura que coincida (Leguizamón y Aduriz)", decidir: "¿Son gastos de MSA pagados por MA (aporte de MA)?",
      filas: await banco("ma", "ma_galicia", "Galicia MA CA", q => q.ilike("contable", "CTA MSA%").in("fecha", ["2025-12-04", "2026-04-09"]).gt("debitos", 0).is("template_cuota_id", null)) },
    { id: "DR11", titulo: "ANUAL y CUOTA vivos el mismo año (vehículo o partida): tiene que ser uno u otro",
      decidir: "¿Cuál modalidad corresponde? La otra se desactiva (hoy son cuotas en $ 0 de un template de cuotas ya inactivo).",
      filas: (() => { const g = new Map<string, CuotaTemplate[]>(); for (const c of cuotas) { const b = baseYModalidad(c.concepto); if (!b.modalidad) continue; const k = `${b.base}|${c.anioTemplate ?? (c.fecha ?? "").slice(0, 4)}`; g.set(k, [...(g.get(k) ?? []), c]) }
        return [...g.values()].filter(cs => new Set(cs.map(c => baseYModalidad(c.concepto).modalidad)).size === 2).flat().sort((x, y) => x.concepto.localeCompare(y.concepto) || (x.fecha ?? "").localeCompare(y.fecha ?? "")).map(desdeCuota) })() },
  ]

  const h: unknown[][] = [["DATOS A REVISAR — cada punto con sus movimientos y todo su contexto · escribí tu respuesta en la última columna"],
    ["Los números de punto (DR1…) son los que usamos para hablar. Nada de esto se cambió todavía: se corrige con tu OK, con un script con foto previa y deshacer."], [],
    ["Punto", "Qué hay que decidir", "Movimientos", "Importe"].map(x => CENTRADO(x))]
  for (const p of PUNTOS) h.push([p.id, p.decidir, { t: "n", v: p.filas.length, z: "0" }, Math.round(p.filas.reduce((s, f) => s + f.importe, 0) * 100) / 100])
  for (const p of PUNTOS) {
    h.push([], [`${p.id} · ${p.titulo}`], ["", `❓ ${p.decidir}`])
    // 🔗 JMS 09/11 (DR1, «hagámoslo más artesanal: un link para cada uno, que me lleve y me explique»): qué estás viendo, punto por punto
    if (p.id === "DR1") h.push(...guiaDR1(cuotas, solapaDe, filaDe))
    h.push(["Punto", "Fecha", "Cuenta / quién pagó", "Importe", "Concepto", "Proveedor", "Comprobante", "Detalle", "Código", "Descripción del banco", "Beneficiario / CUIT", "Ir a", "Tu respuesta"].map(x => CENTRADO(x)))
    if (!p.filas.length) h.push(["", `${p.id}: sin movimientos en el sistema`])
    for (const f of p.filas) h.push([p.id, f.fecha, f.cuenta, f.importe, f.concepto, f.proveedor, f.comprobante, f.detalle, f.codigo, f.descripcion, f.beneficiario,
      f.ir ? { t: "s", v: f.ir, l: { Target: `#'${f.ir.replace(/'/g, "''")}'!A1`, Tooltip: `Ir a «${f.ir}»` } } : "", ""])
  }
  // 🧮 JMS 09/11 (C3): «Movimientos» e «Importe» del resumen con FÓRMULAS sobre los bloques de abajo (Punto en A, Importe en D)
  const ini = h.findIndex(r => typeof r[0] === "string" && /^DR\d+ · /.test(r[0] as string)) + 1
  if (ini > 0) for (const p of PUNTOS) {
    const k = h.findIndex(r => r[0] === p.id && r[1] === p.decidir)
    if (k < 0) continue
    h[k][2] = { t: "n", f: `COUNTIF($A$${ini}:$A$${h.length},"${p.id}")`, v: p.filas.length, z: "0" }
    h[k][3] = { t: "n", f: `SUMIF($A$${ini}:$A$${h.length},"${p.id}",$D$${ini}:$D$${h.length})`, v: Math.round(p.filas.reduce((s, f) => s + f.importe, 0) * 100) / 100 }
  }
  // 🔗 JMS 09/11: «siempre un link desde los índices de cosas a definir»: cada DR del resumen lleva a su bloque
  for (const p of PUNTOS) {
    const k = h.findIndex(r => r[0] === p.id && r[1] === p.decidir)
    const b = h.findIndex(r => typeof r[0] === "string" && (r[0] as string).startsWith(`${p.id} · `))
    if (k >= 0 && b >= 0) h[k][0] = { t: "s", v: `${p.id} ➜`, l: { Target: `#'${SOLAPA_DATOS}'!A${b + 1}`, Tooltip: `Ir a ${p.id}` } }
  }
  return h
}

/**
 * 🔗 DR1 punto por punto (JMS 09/11: «un link para cada uno, que me lleve y me explique»). La tabla DESGLOSA el DR1: cada renglón es
 * una parte de los movimientos de DR1 («MA pagó por PAM»), con su link a la primera cuota y la explicación; el TOTAL tiene que dar lo
 * mismo que DR1 (control). Al final, aparte y SIN sumar, los de 2026 a nombre de MA, como comparación.
 */
function guiaDR1(cuotas: CuotaTemplate[], solapaDe: (c: CuotaTemplate) => string, filaDe?: FilaDe): unknown[][] {
  const fmt = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const resp = (c: CuotaTemplate) => String(c.responsable ?? "").split("/")[0].trim().toUpperCase()
  const enDR1 = (c: CuotaTemplate) => auditarCuota(c).efecto === "MA pagó por PAM"
  const link = (c: CuotaTemplate | undefined, cumple: (f: Record<string, string>) => boolean) => {
    if (!c) return "(no está en este libro)"
    const sol = solapaDe(c), fila = sol && filaDe ? filaDe(sol, cumple) : 0
    return sol ? { t: "s", v: `➜ ${sol}${fila ? ` (fila ${fila})` : ""}`, l: { Target: `#'${sol.replace(/'/g, "''")}'!A${fila || 1}`, Tooltip: "Ir a la primera cuota" } } : "(sin solapa)"
  }
  const total = (cs: CuotaTemplate[]) => Math.round(cs.reduce((t, c) => t + c.monto, 0) * 100) / 100
  const porCuenta = (cs: CuotaTemplate[]) => {
    const m = new Map<string, { n: number; v: number }>()
    for (const c of cs) { const k = c.banco?.cuenta || "sin movimiento"; const x = m.get(k) ?? { n: 0, v: 0 }; m.set(k, { n: x.n + 1, v: x.v + c.monto }) }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v).map(([k, x]) => `${k} ${x.n} cuotas ${fmt(x.v)}`).join(" · ")
  }
  const del = (concepto: string, anio: number | "sin") => cuotas.filter(c => c.concepto === concepto && resp(c) === "PAM" && (anio === "sin" ? !c.anioTemplate : c.anioTemplate === anio))
  const consumos25 = del("Consumos MA", 2025), medicos25 = del("Gastos Medicos", 2025), medicosSin = del("Gastos Medicos", "sin")
  const dr1 = cuotas.filter(enDR1)
  const yaVistas = new Set([...consumos25, ...medicos25, ...medicosSin])
  const otras = dr1.filter(c => !yaVistas.has(c))
  const nombresOtras = [...new Set(otras.map(c => c.concepto))].join(", ")
  const consumos26 = cuotas.filter(c => c.concepto === "Consumos MA" && resp(c) === "MA" && c.anioTemplate === 2026)
  const medicos26 = cuotas.filter(c => c.concepto === "Gastos Medicos" && resp(c) === "MA" && c.anioTemplate === 2026)
  const oct25 = consumos26.filter(c => (c.fecha ?? "") < "2026-01-01")
  const pagoPAM = (cs: CuotaTemplate[]) => cs.filter(c => !enDR1(c) && /PAM/i.test(c.banco?.cuenta ?? ""))

  const h: unknown[][] = [["", "", CENTRADO("¿Qué estás viendo? — DR1 desglosado (tocá «Ir a» en cada renglón)"), CENTRADO("Importe en DR1"),
    CENTRADO("Qué pasa y qué se propone"), "", "", "", "", "", "", CENTRADO("Ir a"), CENTRADO("Tu respuesta")]]
  const parte = (id: string, titulo: string, enDr: CuotaTemplate[], texto: string, ir: unknown) => {
    h.push([id, "", `${titulo} — ${enDr.length} cuotas en DR1`, { t: "n", v: total(enDr), z: "#,##0.00" }, texto, "", "", "", "", "", "", ir, ""])
  }
  const desde = h.length + 1
  parte("DR1.A1", "Consumos MA · año 2025 · a nombre de PAM", consumos25.filter(enDR1),
    `El template dice que el dueño es PAM → para la app es GASTO DE PAM, pero son consumos de MA. DR1 = lo que pagó MA: ${porCuenta(consumos25.filter(enDR1))}. Fuera de DR1: lo que pagó PAM en el ejercicio (${fmt(total(pagoPAM(consumos25)))}) y ene–jun 2025 (ejercicio anterior, 80 cuotas $ 3.399.589,35 por VISA PAM). PROPUESTA (script 239): el template pasa a MA → sale de DR1 y de Retiros; lo que pagó PAM queda como «distribución PAM → MA».`,
    link(consumos25[0], f => f["Concepto"] === "Consumos MA"))
  parte("DR1.A2", "Gastos Médicos · año 2025 · a nombre de PAM", medicos25.filter(enDR1),
    `Igual que A1: dueño PAM en el template, gasto de MA, pagado por MA: ${porCuenta(medicos25.filter(enDR1))}. (Ene–jun 2025, ejercicio anterior: 13 cuotas $ 237.934,00 por VISA PAM.) PROPUESTA (script 239): el template pasa a MA.`,
    link(medicos25[0], f => f["Concepto"] === "Gastos Medicos"))
  if (otras.length) parte("DR1.A3", `Suscripciones de MA a nombre de PAM (${nombresOtras})`, otras,
    `Templates de PAM con suscripciones de MA, pagados con la VISA MA: ${porCuenta(otras)}. Mismo caso que A1: PROPUESTA pasar esos templates a MA (se suman al script 239 si estás de acuerdo).`,
    link(otras[0], f => f["Concepto"] === otras[0].concepto))
  const hasta = h.length
  const vDR1 = total(dr1)
  h.push(["", "", "TOTAL de los renglones = DR1", { t: "n", f: `SUM(D${desde}:D${hasta})`, v: total([...consumos25.filter(enDR1), ...medicos25.filter(enDR1), ...otras]), z: "#,##0.00" },
    { t: "s", f: `IF(ABS(D${hasta + 1}-${vDR1})<0.01,"✓ da lo mismo que DR1 (${vDR1.toLocaleString("es-AR", { minimumFractionDigits: 2 })})","⚠️ no da DR1")`,
      v: Math.abs(total([...consumos25.filter(enDR1), ...medicos25.filter(enDR1), ...otras]) - vDR1) < 0.01 ? `✓ da lo mismo que DR1 (${vDR1.toLocaleString("es-AR", { minimumFractionDigits: 2 })})` : "⚠️ no da DR1" }])
  // aparte, NO suman: contexto para decidir
  h.push(["", "", CENTRADO("Aparte — NO suman a DR1, son para comparar"), CENTRADO("Importe en el ejercicio"), "", "", "", "", "", "", "", "", ""])
  h.push(["DR1.B1", "", `Gastos Médicos · SIN AÑO · a nombre de PAM — ${medicosSin.length} cuota`, { t: "n", v: total(medicosSin), z: "#,##0.00" },
    `No está en DR1 porque lo pagó PAM (${porCuenta(medicosSin)}), pero es del mismo problema: template sin año, de PAM y en OTRA agrupadora («${medicosSin[0]?.agrupadoraTemplate ?? "?"}»). PROPUESTA: año 2026, responsable MA y agrupadora «Gastos Personales MA» → queda como «distribución PAM → MA».`,
    "", "", "", "", "", "", link(medicosSin[0], f => f["Concepto"] === "Gastos Medicos" && /PAM/i.test(f["Banco / cuenta"] ?? "")), ""])
  h.push(["DR1.B2", "", `Los de 2026, ya a nombre de MA (Consumos ${consumos26.length} + Médicos ${medicos26.length} cuotas)`, { t: "n", v: total([...consumos26, ...medicos26]), z: "#,##0.00" },
    `Así tienen que quedar los de 2025: dueño MA, pagado por MA → «pagó el dueño (MA)», sin marca.`,
    "", "", "", "", "", "", link(consumos26[0], f => f["Concepto"] === "Consumos MA" && (f["Mes"] ?? "") >= "2026-01"), ""])
  h.push(["DR1.B3", "", `Consumos MA 2026 con cuotas de oct–dic 2025 — ${oct25.length} cuotas (están DENTRO de B2)`, { t: "n", v: total(oct25), z: "#,##0.00" },
    `El template 2026 arrancó en oct-25: oct–dic 2025 está repartido entre el de 2025 (PAM, A1) y el de 2026 (MA). No es doble conteo (cada pago está vinculado a una sola cuota). Con la propuesta de A1 los dos quedan de MA y deja de importar.`,
    "", "", "", "", "", "", link(oct25[0], f => f["Concepto"] === "Consumos MA" && (f["Mes"] ?? "") < "2026-01"), ""])
  return h
}

export const ANCHOS_DATOS = [8, 14, 30, 16, 30, 24, 16, 30, 13, 32, 40, 26, 30]
