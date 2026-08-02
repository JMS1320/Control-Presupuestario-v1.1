import {
  proyectarTemplate, avisoFaltaGenerar, metodoHeredado, ETIQUETA_METODO, noEsGasto,
  tipoEfectivo, origenTipo, resolverTipo,
  type TemplateInfo, type CuotaMes,
} from "../lib/presupuesto/templates"

let fallos = 0
const chk = (t: string, real: unknown, esp: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esp)
  if (!ok) fallos++
  console.log(`${ok ? "OK  " : "FALLA"} ${t}: ${JSON.stringify(real)} (esperado ${JSON.stringify(esp)})`)
}

const ipc = [
  { anio: 2026, mes: 7, valor: 2.0 },
  { anio: 2026, mes: 12, valor: 1.5 },
  { anio: 2027, mes: 6, valor: 1.0 },
]
const meses = Array.from({ length: 18 }, (_, i) => {
  const d = new Date(2026, 6 + i, 1)   // jul-26 → dic-27
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
})
const q = (mes: string, monto: number): CuotaMes => ({ egreso_id: "T", mes, monto })
const tpl = (o: Partial<TemplateInfo>): TemplateInfo => ({
  id: "T", nombre: "X", agrupador: null, tipo_contable: null, cuotas: null,
  tipo_recurrencia: null, periodicidad: null, aplica_generacion: null, ...o,
})

// ══ EL BUG QUE MOTIVÓ ESTO ══════════════════════════════════════════════════
// Imp. Ganancias: 1 cuota al año declarada, 1 mes de historia, $5.000.123.
// La densidad daba 1,00 → "mensual" → 12 pagos al año.
console.log("\n--- el bug: 1 cuota/año con 1 mes de historia ---")
const ganancias = tpl({ nombre: "Imp .Ganancias MSA", cuotas: 1, aplica_generacion: true })
const rG = proyectarTemplate(ganancias, [q("2026-05", 5000123)], meses, { ipc })
const pagosG = rG.celdas.filter(c => c.monto > 0)
console.log(`     método: ${ETIQUETA_METODO[rG.metodo.metodo]} — ${rG.metodo.motivo}`)
for (const c of pagosG) console.log(`     ${c.mes}  ${Math.round(c.monto).toLocaleString("es-AR")}`)
chk("hereda 'declaradas' de cuotas=1", rG.metodo.metodo, "declaradas")
chk("proyecta 1 pago, no 12", pagosG.length, 1)   // jul-26 a dic-27 contiene un solo mayo
chk("y cae en mayo", pagosG.every(c => c.mes.endsWith("-05")), true)
const viejo = 5000123 * 12
console.log(`     antes: 12 pagos/año = $${viejo.toLocaleString("es-AR")} · ahora: 1 = $5.000.123`)

// ══ cuotas = 12 → mensual, aunque la historia tenga pocos meses ═════════════
console.log("\n--- cuotas=12 con historia parcial (Cargas Sociales) ---")
const cargas = tpl({ nombre: "Cargas Sociales", cuotas: 12, aplica_generacion: true })
const histC = Array.from({ length: 6 }, (_, i) => q(`2026-0${i + 1}`, 500000 + i * 20000))
const rC = proyectarTemplate(cargas, histC, meses, { ipc })
console.log(`     método: ${ETIQUETA_METODO[rC.metodo.metodo]} — ${rC.metodo.motivo}`)
chk("hereda 'mensual'", rC.metodo.metodo, "mensual")
chk("proyecta los 18 meses", rC.celdas.filter(c => c.monto > 0).length, 18)
chk("marca falta generar", rC.celdas[0]!.faltaGenerar, true)

// ══ cuotas = 4 → inmobiliario, respeta sus meses ════════════════════════════
console.log("\n--- cuotas=4 (Inmobiliario) ---")
const inmob = tpl({ nombre: "Inmobiliario Cuota Rojas", cuotas: 4 })
const rI = proyectarTemplate(inmob, [
  q("2026-02", 100000), q("2026-04", 100000), q("2026-06", 100000), q("2026-08", 110000),
], meses, { ipc })
chk("hereda 'declaradas'", rI.metodo.metodo, "declaradas")
chk("2027 proyecta 4 pagos", rI.celdas.filter(c => c.mes.startsWith("2027") && c.monto > 0).length, 4)
chk("nunca en marzo", rI.celdas.filter(c => c.mes.endsWith("-03") && c.monto > 0).length, 0)

// ══ cuotas = 0 → sin periodicidad fija → promedio ═══════════════════════════
console.log("\n--- cuotas=0 (comisiones bancarias) ---")
const comi = tpl({ nombre: "Comision Transferencias", cuotas: 0 })
const rCo = proyectarTemplate(comi, [
  q("2026-02", 30000), q("2026-03", 45000), q("2026-05", 25000), q("2026-06", 40000),
], meses, { ipc })
console.log(`     método: ${ETIQUETA_METODO[rCo.metodo.metodo]} — ${rCo.metodo.motivo}`)
chk("hereda 'promedio'", rCo.metodo.metodo, "promedio")
chk("reparte en todos los meses", rCo.celdas.filter(c => c.monto > 0).length, 18)
// 140.000 en 5 meses de span (feb..jun) = 28.000/mes
chk("promedio sobre el SPAN, no sobre los meses con cuota",
  Math.round(rCo.celdas[0]!.monto / 1.02), 28000)
console.log(`     $140.000 en 5 meses de tramo = $28.000/mes (no $35.000, que sería dividir por 4)`)

// ══ tipo_recurrencia = abierto → promedio ═══════════════════════════════════
const abierto = tpl({ nombre: "Otros Gastos", cuotas: 3, tipo_recurrencia: "abierto" })
chk("'abierto' gana sobre cuotas", metodoHeredado(abierto, true).metodo, "promedio")

// ══ Sin historia → no proyectar ═════════════════════════════════════════════
chk("sin historia no inventa", metodoHeredado(tpl({ cuotas: 4 }), false).metodo, "no_proyectar")

// ══ JERARQUÍA: la elección del usuario gana sobre lo heredado ═══════════════
console.log("\n--- jerarquía ---")
const rMan = proyectarTemplate(ganancias, [q("2026-05", 5000123)], meses,
  { ipc, config: { metodo: "mensual" } })
chk("el método a mano pisa lo heredado", rMan.metodo.metodo, "mensual")
chk("y queda marcado como manual", rMan.metodo.manual, true)
console.log(`     ${rMan.metodo.motivo}`)

// La cuota cargada pisa TODO, incluso el método manual
const rCuota = proyectarTemplate(ganancias, [q("2026-05", 5000123), q("2026-09", 777)], meses,
  { ipc, config: { metodo: "manual", monto_manual: 999 } })
chk("la cuota cargada manda sobre el método manual",
  rCuota.celdas.find(c => c.mes === "2026-09")!.monto, 777)
chk("y donde no hay cuota, el monto a mano",
  rCuota.celdas.find(c => c.mes === "2026-10")!.monto, 999)

// ══ Aviso cuando declara más cuotas de las que hay ══════════════════════════
console.log("\n--- avisos ---")
const anticipo = tpl({ nombre: "Anticipo Ganancias MSA", cuotas: 10, aplica_generacion: true })
const rA = proyectarTemplate(anticipo, [q("2026-03", 1000000), q("2026-06", 1000000)], meses, { ipc })
chk("avisa que faltan cuotas", rA.avisoCuotas != null, true)
console.log(`     ${rA.avisoCuotas}`)

const aviso = avisoFaltaGenerar({
  g: { info: ganancias, celdas: rG.celdas },
  c: { info: cargas, celdas: rC.celdas },
  i: { info: inmob, celdas: rI.celdas },
})
chk("el aviso junta sólo los de carga manual", aviso.nombres.sort(), ["Cargas Sociales", "Imp .Ganancias MSA"])


// ══ Movimientos internos: NO son gasto ══════════════════════════════════════
console.log("\n--- lo que no es gasto no se presupuesta ---")
const fci = tpl({ nombre: "FIMA Premium Galicia Pesos", agrupador: "Inversiones",
  tipo_contable: "financiero", cuotas: null, tipo_recurrencia: "abierto" })
const rF = proyectarTemplate(fci, [
  q("2026-02", 7500000), q("2026-03", 8000000), q("2026-04", 7000000),
  q("2026-05", 7600000), q("2026-06", 7500000),
], meses, { ipc })
console.log(`     FCI: ${rF.metodo.motivo}`)
chk("FCI no se proyecta", rF.metodo.metodo, "no_proyectar")
chk("y no aporta un peso", rF.celdas.reduce((s, c) => s + c.monto, 0), 0)
console.log(`     antes: promedio ~$7,5 M x 18 meses = ~$135 M de egreso inventado`)

chk("Caja (movimiento interno) tampoco, aunque declare 12 cuotas",
  metodoHeredado(tpl({ tipo_contable: "financiero", cuotas: 12 }), true).metodo, "no_proyectar")
chk("Interbancarias tampoco",
  metodoHeredado(tpl({ tipo_contable: "financiero", cuotas: 2 }), true).metodo, "no_proyectar")
chk("Creditos Bancarios tampoco",
  metodoHeredado(tpl({ tipo_contable: "financiero", cuotas: null }), true).metodo, "no_proyectar")
chk("pero un gasto de verdad si", metodoHeredado(tpl({ tipo_contable: "egreso", cuotas: 12 }), true).metodo, "mensual")

// El usuario lo puede pisar: "o en tal caso hacerlo yo a mano"
const rFman = proyectarTemplate(fci, [q("2026-02", 7500000)], meses,
  { ipc, config: { metodo: "manual", monto_manual: 1000000 } })
chk("el usuario lo puede presupuestar a mano si quiere", rFman.celdas[0]!.monto, 1000000)

// ══ Gastos bancarios: se llenan durante, se presupuestan por historico ══════
console.log("\n--- comisiones bancarias (se llenan durante, nunca antes) ---")
const comBanco = tpl({ nombre: "Comision Cuenta Bancaria", tipo_contable: "egreso", cuotas: 0 })
const rB = proyectarTemplate(comBanco, [
  q("2026-02", 30000), q("2026-03", 32000), q("2026-04", 31000), q("2026-05", 35000),
], meses, { ipc })
console.log(`     ${rB.metodo.motivo} -> ${ETIQUETA_METODO[rB.metodo.metodo]}`)
chk("se presupuestan por promedio historico", rB.metodo.metodo, "promedio")
chk("y en todos los meses", rB.celdas.filter(c => c.monto > 0).length, 18)


// ══ C-20: el criterio es el TIPO CONTABLE, no el nombre de la agrupadora ════
console.log("\n--- naturaleza contable ---")
chk("financiero no se presupuesta", noEsGasto("financiero") != null, true)
chk("ingreso tampoco", noEsGasto("ingreso") != null, true)
chk("egreso si", noEsGasto("egreso"), null)
chk("distribucion SI (los retiros salen de la caja)", noEsGasto("distribucion"), null)
chk("sin clasificar se asume gasto", noEsGasto(null), null)

// Tarjeta: el usuario confirmo que no se presupueste (el resumen duplica los gastos
// que ya entran por su cuenta contable).
const tarjeta = tpl({ nombre: "Tarjeta Visa Business MSA", tipo_contable: "financiero", cuotas: 12 })
chk("tarjeta no se proyecta", metodoHeredado(tarjeta, true).metodo, "no_proyectar")

// Y el criterio ya NO depende de como se llame la agrupadora
chk("una agrupadora renombrada no cambia nada",
  metodoHeredado(tpl({ agrupador: "Inversiones RENOMBRADA", tipo_contable: "financiero", cuotas: 12 }), true).metodo,
  "no_proyectar")
chk("ni al reves: agrupadora 'Inversiones' con tipo egreso SI se presupuesta",
  metodoHeredado(tpl({ agrupador: "Inversiones", tipo_contable: "egreso", cuotas: 12 }), true).metodo,
  "mensual")


// ══ El tipo lo declara el TEMPLATE; el plan es fallback (2026-07-31) ════════
// Los 176 templates tienen `tipo` cargado. Antes se llegaba por `categ` al plan de cuentas,
// y 70 de 123 activos tienen una categoria que no esta en el plan -> caian al signo del monto.
console.log("\n--- de donde sale el tipo ---")

chk("el tipo del template gana sobre el del plan",
  tipoEfectivo(tpl({ tipo: "distribucion", tipo_contable: "egreso" })), "distribucion")
chk("y el origen queda dicho",
  origenTipo(tpl({ tipo: "distribucion", tipo_contable: "egreso" })), "template")
chk("si el template no declara, hereda del plan",
  tipoEfectivo(tpl({ tipo: null, tipo_contable: "financiero" })), "financiero")
chk("y se marca que vino del plan",
  origenTipo(tpl({ tipo: null, tipo_contable: "financiero" })), "plan")
chk("sin ninguno de los dos, sin clasificar",
  tipoEfectivo(tpl({ tipo: null, tipo_contable: null })), null)

// El caso que motivo la columna: Retiro MA mensual, $45,9 M.
// Su categ no esta en el plan -> el dashboard lo mandaba a egresos operativos por el signo.
const retiroMA = tpl({ nombre: "Retiro MA mensual", agrupador: "Retiros / Distribucion Socios",
  tipo: "distribucion", tipo_contable: null, cuotas: 12 })
chk("Retiro MA mensual ya no depende del plan", tipoEfectivo(retiroMA), "distribucion")
chk("y SI se presupuesta (sale de la caja)", metodoHeredado(retiroMA, true).metodo, "mensual")

// resolverTipo: la cascada completa, con el signo como ultimo recurso
chk("resolverTipo - manda el template", resolverTipo("distribucion", "egreso", -100).tipo, "distribucion")
chk("resolverTipo - despues el plan", resolverTipo(null, "financiero", -100).tipo, "financiero")
chk("resolverTipo - un debito sin nada es egreso", resolverTipo(null, null, -100).tipo, "egreso")
chk("resolverTipo - un credito sin nada es ingreso", resolverTipo(null, null, 100).tipo, "ingreso")
chk("resolverTipo - y avisa que adivino", resolverTipo(null, null, -100).origen, "signo")
// Sin monto (caso template): el default seguro es gasto, nunca ingreso.
chk("resolverTipo - sin monto, el default es egreso", resolverTipo(null, null).tipo, "egreso")

console.log(fallos === 0 ? "\nTODO OK" : `\n${fallos} FALLAS`)
process.exit(fallos ? 1 : 0)
