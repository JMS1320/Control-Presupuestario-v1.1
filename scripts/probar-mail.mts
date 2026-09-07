/**
 * `npm run probar:mail` — la cuenta del mail de Detalle de pago. **No toca nada.**
 *
 * ## Por qué éste importa más que los otros
 * 🔴 **Lo que se calcula acá SALE DE LA EMPRESA.** Es lo que un proveedor lee y con lo que concilia
 * su cuenta corriente: un error no queda adentro. Y acá hubo **tres bugs en un día**
 * (`A-BUG-102/104/105`), todos descubiertos porque el usuario preguntó, no porque algo avisara.
 *
 * Los casos usan **el caso IGLESIAS real** del 04/09: una FC de $3.554.000 pagada con un echeq de
 * $2.454.000, una transferencia de $1.042.599,60 y una retención de $57.400,40.
 */
const B = process.cwd().split("\\").join("/")
const L = `file:///${B}/lib/pagos/cuenta-detalle-pago.ts`
const { calcularCuenta, armarDesglose, textoDesvio, textoCierre } = await import(L)

type Medio = { tipo: string; monto: number; detalle?: string }

const r: { ok: boolean; caso: string; detalle: string }[] = []
const chequear = (caso: string, ok: boolean, detalle: string) => r.push({ ok, caso, detalle })

// ── El caso real: IGLESIAS, 04/09 ─────────────────────────────────────────────────────────────
const FC = { comprobante: "FC 816 - IGLESIAS NORBERTO HUGO · Mano de obra 1.1MM", imp_total: 3554000, monto_sicore: 57400.4, monto_a_abonar: 1042599.6, origen: "ARCA" }
const ANTICIPO = { comprobante: "ANTICIPO: Iglesias insumos echeq. (parcial - pend. conciliar)", imp_total: 2454000, monto_a_abonar: 2454000, origen: "ANTICIPO" }
const ECHEQ: Medio = { tipo: "echeq", monto: 2454000, detalle: "ECHEQ Banco Galicia 31841751 (cobro 20/09/2026)" }
const TRANSF: Medio = { tipo: "transferencia", monto: 1042599.6, detalle: "Transferencia" }

const cFC = calcularCuenta([FC], [ECHEQ, TRANSF], "arca")
chequear("La cuenta cierra: echeq + transferencia + retención = la factura",
  !cFC.desviado && Math.abs(cFC.dif) < 1, `dif ${cFC.dif.toFixed(2)} · cancelado ${cFC.totalCancelado}`)

chequear("La RETENCIÓN suma al total cancelado (se muestra en negativo, pero cancela deuda)",
  Math.abs(cFC.totalCancelado - 3554000) < 1, `${cFC.totalCancelado}`)

// 🐞 A-BUG-105
const cAmbos = calcularCuenta([FC, ANTICIPO], [ECHEQ, TRANSF], "arca")
chequear("🔴 Un anticipo aplicado NO suma al bruto (antes decía $6.008.000)",
  cAmbos.bruto === 3554000, `${cAmbos.bruto.toLocaleString("es-AR")}`)

chequear("Y por eso la cuenta con los dos juntos también cierra",
  !cAmbos.desviado, `dif ${cAmbos.dif.toFixed(2)}`)

chequear("Si el mail va SÓLO por el anticipo, el anticipo ES el bruto",
  calcularCuenta([ANTICIPO], [ECHEQ], "template").bruto === 2454000, "2.454.000")

// 🐞 A-BUG-104 — avisa, no bloquea
const cFalta = calcularCuenta([FC], [ECHEQ], "arca")
chequear("🔴 Si falta un medio, lo detecta (no encola en silencio)",
  cFalta.desviado && Math.abs(cFalta.dif - 1042599.6) < 1, `falta ${cFalta.dif.toFixed(2)}`)

const aviso = textoDesvio(cFalta, [ECHEQ], "IGLESIAS")
chequear("El aviso dice el número Y qué puede significar",
  /1\.042\.599,60/.test(aviso) && /pago parcial/.test(aviso) && /echeq sin cargar/.test(aviso),
  aviso.split("\n")[0])

const DE_MAS: Medio[] = [ECHEQ, TRANSF, { tipo: "transferencia", monto: 100000, detalle: "Transferencia" }]
const cDeMas = calcularCuenta([FC], DE_MAS, "arca")
chequear("Pagar de MÁS también se detecta, y se nombra distinto",
  cDeMas.desviado && cDeMas.dif < 0 && /de más/.test(textoDesvio(cDeMas, DE_MAS, "X")), `${cDeMas.dif.toFixed(2)}`)

chequear("Un centavo de redondeo NO dispara el aviso (tolerancia $1)",
  !calcularCuenta([FC], [ECHEQ, { tipo: "transferencia", monto: 1042599.1 }], "arca").desviado, "tolera")

// ── El desglose que ve el proveedor ───────────────────────────────────────────────────────────
const d = armarDesglose(cFC, [ECHEQ, TRANSF])
chequear("Nombra el echeq con banco, número y fecha de cobro",
  d.includes("ECHEQ Banco Galicia 31841751 (cobro 20/09/2026): $2.454.000,00"), "sí")

chequear("Cierra en «Total cancelado»", d.includes("Total cancelado: $3.554.000,00"), "sí")

chequear("La retención se MUESTRA en negativo", d.includes("Retención Ganancias: -$57.400,40"), "sí")

const dFalta = armarDesglose(cFalta, [ECHEQ])
chequear("Si queda saldo, el proveedor lo lee en el mail (no al conciliar)",
  dFalta.includes("Saldo pendiente: $1.042.599,60"), "sí")

chequear("Si se pagó de más, dice «Pagado a cuenta»",
  armarDesglose(cDeMas, DE_MAS).includes("Pagado a cuenta: $100.000,00"), "sí")

// Sin medios cargados NO se afirma cómo se pagó: se dice el total y nada más.
const cSinMedios = calcularCuenta([FC], [], "arca")
chequear("Sin medios no se inventa un desglose, y tampoco se marca desvío",
  !cSinMedios.desviado && armarDesglose(cSinMedios, []).includes("Total transferido: $1.042.599,60")
  && !armarDesglose(cSinMedios, []).includes("Total cancelado"), "total transferido")

// ── El cierre del mail ────────────────────────────────────────────────────────────────────────
chequear("🔴 A quien se le libró SÓLO un echeq no se le promete el aviso de Galicia",
  !textoCierre([ECHEQ]).includes("go@bancogalicia"), textoCierre([ECHEQ]).trim().slice(0, 50))

chequear("Y se le dice lo que sí corresponde", textoCierre([ECHEQ]).includes("echeq queda a disposición"), "sí")

chequear("Con transferencia, el aviso del banco sí corresponde",
  textoCierre([ECHEQ, TRANSF]).includes("go@bancogalicia"), "sí")

chequear("Un anticipo por transferencia también lleva el aviso",
  textoCierre([{ tipo: "anticipo", monto: 1 }]).includes("go@bancogalicia"), "sí")

// ── El rótulo ─────────────────────────────────────────────────────────────────────────────────
chequear("Un mail sin facturas no dice «Importe facturas»",
  calcularCuenta([ANTICIPO], [], "template").rotuloBruto === "Importe", "Importe")

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  console.log(`      ${x.detalle}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
process.exit(mal ? 1 : 0)
