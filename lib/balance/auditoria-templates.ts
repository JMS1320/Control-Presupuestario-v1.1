/**
 * 🔍 **EL LIBRO H PARA AUDITAR — quién pagó cada cuota y qué efecto tiene** (A-FEAT-1579, JMS 07/11).
 *
 * JMS: *«lo que tengo que hacer es auditar… ver que cada cosa tenga sus pagos… quién lo pagó y si es retiro o aporte es secundario a
 * se pagó»* · *«es la tabla que ya tenemos en el reporte templates integral, sería agregarle más columnas»*. Acordado: una base, dos
 * salidas (el H del contador no cambia); la cuota pagada va por su fecha de pago y la impaga queda a la vista, resaltada.
 *
 * Por cuota: **Quién pagó** (la empresa de la cuenta del movimiento) · **Código contable** del movimiento · **Efecto** en palabras
 * («retiro de MA pagado por MSA») · **Marca** de auditoría. De quién es el gasto: el dueño del bien a esa fecha si es un bien que cambió
 * de dueño (`duenoDelBien`), si no el responsable del template. Pura.
 */
import { ESTADOS_TEMPLATE_IMPAGOS, type CuotaTemplate } from "./templates-libro"
import type { ProblemaModalidad } from "@/lib/templates/modalidad"
import { duenoDelBien, codigoEsperado, type Empresa } from "./dueno-de-bienes"
import { cuotaSinPago } from "./grupos-templates"
import { armarResumenPorMes } from "./resumen-por-mes"
import { filtrarEn, congelarEn } from "./formato-excel"

export interface AuditoriaDeCuota {
  quienPago: string
  codigo: string
  efecto: string
  marca: string
  /** 🔍 el contexto del banco para auditar sin ir a la app (JMS 09/11, revisión punto C) */
  descripcion: string
  beneficiario: string
  factura: string
  interno: string
}

const EMPRESAS = new Set(["MSA", "PAM", "MA"])
const primero = (r: string) => (r || "").split("/")[0].trim().toUpperCase()

/** De quién es el gasto de la cuota: el dueño del bien a esa fecha, o el responsable del template. */
export function duenoDelGasto(c: CuotaTemplate): string {
  return duenoDelBien({ nombre: c.concepto, responsable: c.responsable }, c.fecha ?? "") ?? primero(c.responsable)
}

/** El efecto en palabras de que `pagador` pague un gasto de `dueno`. Vacío = lo pagó el dueño (no hay efecto). */
export function efectoEntre(pagador: string, dueno: string): string {
  if (!pagador || !dueno || pagador === dueno) return ""
  if (pagador === "MSA") return `retiro de ${dueno} pagado por MSA`
  if (dueno === "MSA") return `aporte de ${pagador} a MSA (pagó un gasto de MSA)`
  if (pagador === "PAM" && dueno === "MA") return "distribución PAM → MA (pagó un gasto de MA)"
  return `${pagador} pagó por ${dueno}`
}

/** 🎨 JMS 09/11 (formato que dio en «H · MA · Imp Rurales»): la Marca centrada; el template de la tabla de control, a la derecha. */
export const CENTRADO = (v: string) => ({ t: "s", v, s: { alignment: { horizontal: "center" } } })
/**
 * 🎨 JMS 09/11 («a esto le hace falta un poco de estética»): el formato de las tablas chicas del pie (Por efecto, Por establecimiento,
 * Control por template) — título en banda, encabezado con fondo y línea, total en negrita con línea arriba.
 */
const MONEDA_AR = "#,##0.00;(#,##0.00);\"-\""
export const TITULO_TABLA = (v: string) => ({ t: "s", v, s: { font: { bold: true, color: { rgb: "FF1F4E3D" } }, fill: { patternType: "solid", fgColor: { rgb: "FFE3EFEC" } } } })
export const BANDA_VACIA = () => ({ t: "s", v: "", s: { fill: { patternType: "solid", fgColor: { rgb: "FFE3EFEC" } } } })
export const ENCABEZADO_TABLA = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } }, border: { bottom: { style: "thin", color: { rgb: "FFB9C4C0" } } } } })
export const IMPORTE = (f: string, v: number) => ({ t: "n", f, v, z: MONEDA_AR })
const ESTILO_TOT = { font: { bold: true }, fill: { patternType: "solid", fgColor: { rgb: "FFE6EEF6" } }, border: { top: { style: "thin", color: { rgb: "FFB9C4C0" } } } }
export const TOTAL_TEXTO = (v: string) => ({ t: "s", v, s: ESTILO_TOT })
export const TOTAL_IMPORTE = (f: string, v: number) => ({ t: "n", f, v, z: MONEDA_AR, s: ESTILO_TOT })
const A_LA_DERECHA = (v: string) => ({ t: "s", v, s: { alignment: { horizontal: "right" } } })

/** Un texto como criterio literal de CONTAR.SI (sin comodines: `*`, `?` y `~` se escapan). */
const literal = (s: string) => s.replace(/[~*?]/g, m => `~${m}`).replace(/"/g, '""')

/**
 * 🔍 A-FEAT-1579 (JMS 07/11: «la fila de control hacela»): al pie de la solapa, UN RENGLÓN POR TEMPLATE con cuántas cuotas tiene y
 * cómo está cada una, con fórmulas CONTAR.SI.CONJUNTO sobre las columnas Concepto y Marca del detalle (el valor ya calculado va al
 * lado, por si Excel no recalcula). «Completo» = todas pagadas con banco o en $ 0. `filaInicial` = la fila (base 1) donde va el
 * primer renglón que se devuelve.
 */
export function controlPorTemplate(cuotas: CuotaTemplate[], colConcepto: string, colMarca: string, det1: number, detN: number,
  sumaDe: (concepto: string) => string, filaInicial: number): unknown[][] {
  const rc = `$${colConcepto}$${det1}:$${colConcepto}$${detN}`, rm = `$${colMarca}$${det1}:$${colMarca}$${detN}`
  const porTpl = new Map<string, CuotaTemplate[]>()
  for (const c of cuotas) porTpl.set(c.concepto, [...(porTpl.get(c.concepto) ?? []), c])
  const MARCAS: Array<[string, (m: string) => boolean]> = [["✓*", m => m.startsWith("✓")], ["🔴*", m => m.startsWith("🔴")],
    ["🟡*", m => m.startsWith("🟡")], ["⚪*", m => m.startsWith("⚪")], ["*código esperado*", m => m.includes("código esperado")]]
  const f: unknown[][] = [[], ["", TITULO_TABLA("CONTROL POR TEMPLATE — cada template con sus cuotas: ¿se pagaron todas?"), ...Array.from({ length: 8 }, BANDA_VACIA)],
    ["", "Template", "Cuotas", "✓ pagadas", "🔴 sin pagar", "🟡 a revisar", "⚪ en $ 0", "⚠️ código", "Total", "¿Completo?"].map(x => x ? ENCABEZADO_TABLA(x) : x)]
  for (const [t, cs] of [...porTpl].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    const marcas = cs.map(c => auditarCuota(c).marca)
    const crit = `${rc},"${literal(t)}"`
    const n = (p: (m: string) => boolean) => marcas.filter(p).length
    const fila = filaInicial + f.length  // la fila (base 1) que va a ocupar este renglón en la hoja
    const completos = n(MARCAS[0][1]) + n(MARCAS[3][1])
    f.push(["", A_LA_DERECHA(t), { t: "n", f: `COUNTIFS(${crit})`, v: cs.length, z: "0" },
      ...MARCAS.map(([k, p]) => ({ t: "n", f: `COUNTIFS(${crit},${rm},"${k}")`, v: n(p), z: "0" })),
      { t: "n", f: sumaDe(t), v: Math.round(cs.reduce((s, c) => s + c.monto, 0) * 100) / 100 },
      { t: "s", f: `IF(C${fila}=D${fila}+G${fila},"✓ completo","revisar")`, v: completos === cs.length ? "✓ completo" : "revisar" }])
  }
  return f
}

/** La otra parte que nombra un código «CTA / DIST + quién» («DIST PAM» → PAM). Vacío si el código no es de ese tipo. */
export const otraParteDelCodigo = (codigo: string): string => (codigo.trim().match(/^(?:CTA|CUENTA|DIST|RET)\s+(.+)$/i)?.[1] ?? "").trim().toUpperCase()

/**
 * El efecto que dice el código contable del movimiento, mirado desde la cuenta del movimiento (`titular`).
 * ⚠️ cambió 09/11 (JMS: «es un solo movimiento con 2 puntas… debe quedar claro y no debe duplicar»): el código nombra a LA OTRA PARTE, y el
 * sentido lo da el movimiento. Una SALIDA de PAM con «DIST MA» = «distribución PAM → MA · salió de PAM»; la ENTRADA en MA de esa misma
 * transferencia, con «DIST PAM», = «distribución PAM → MA · entró a MA» (antes decía «distribución de MA a PAM», al revés).
 */
/**
 * 🔁 La frase de una TRANSFERENCIA entre dos partes — la MISMA en las dos puntas (JMS 09/11, revisión punto B.2: el mismo movimiento no
 * puede tener dos rótulos). Después se le agrega «· salió de X» o «· entró a Y».
 */
function fraseTransferencia(dist: boolean, origen: string, destino: string): string {
  if (dist) return `distribución ${origen} → ${destino}`
  if (destino === "MSA") return `aporte de ${origen} a MSA`
  if (origen === "MSA") return `retiro de ${destino} (MSA → ${destino})`
  return `${origen} → ${destino} (cuenta corriente)`
}

export function efectoDelCodigo(titular: string, codigo: string, entrada = false, transferencia = false): string {
  const m = codigo.trim().match(/^(CTA|CUENTA|DIST|RET)\s+(.+)$/i)
  if (!m) return (/^FLIA\b/i.test(codigo) ? "gasto de la familia (FLIA)" : `código ${codigo}`) + (entrada ? ` · entró a ${titular}` : "")
  const quien = m[2].trim().toUpperCase(), dist = /^DIST$/i.test(m[1])
  // la ENTRADA siempre es la otra punta de algo que salió de `quien`
  if (entrada) return `${fraseTransferencia(dist, quien, titular)} · entró a ${titular}`
  // una TRANSFERENCIA a la otra parte (su CUIT en el banco) y toda distribución: la frase de las dos puntas
  if (transferencia || dist) return `${fraseTransferencia(dist, titular, quien)} · salió de ${titular}`
  // un PAGO A UN TERCERO por cuenta de otro: un gasto de ese otro
  if (quien === "MSA") return `aporte de ${titular} a MSA (pagó un gasto de MSA)`
  return titular === "MSA" ? `retiro de ${quien} pagado por MSA` : `${titular} pagó por cuenta de ${quien}`
}

/** Los CUIT de las empresas: una salida al CUIT de la otra parte es una TRANSFERENCIA, no un pago a un tercero. */
const CUIT_DE: Record<string, string> = { MSA: "30617786016", PAM: "20044390222", MA: "27066824611" }
/** ¿El movimiento es una transferencia a `quien`? Su CUIT exacto entre las leyendas del banco, o «ctas / cuentas propias». */
export function esTransferenciaA(quien: string, beneficiario: string | undefined, descripcion: string | undefined): boolean {
  const cuit = CUIT_DE[quien]
  const tokens = String(beneficiario ?? "").split(/[·|]/).map(x => x.replace(/\D/g, ""))
  return (!!cuit && tokens.includes(cuit)) || /ctas propias|cuentas propias|entre cuentas/i.test(String(descripcion ?? ""))
}

export function auditarCuota(c: CuotaTemplate): AuditoriaDeCuota {
  const sinPago = cuotaSinPago(c)
  const b = c.banco
  const pagadores = (b?.titular ?? "").split(" + ").map(s => s.trim().toUpperCase()).filter(Boolean)
  /** Un crédito en la cuenta del movimiento: la plata ENTRÓ (es la otra punta de una salida, o un reintegro). */
  const entrada = c.monto < 0
  const quienPago = sinPago ? "" : pagadores.length ? (entrada ? "entró a " : "") + pagadores.join(" + ") + (b?.cuenta ? ` · ${b.cuenta}` : "") : ""
  const codigo = (b?.contable ?? "").trim()
  const dueno = duenoDelGasto(c)
  let efecto = "", aviso = ""
  if (!sinPago && pagadores.length === 1) {
    efecto = efectoEntre(pagadores[0], dueno)
    // una TRANSFERENCIA a la otra parte se rotula como transferencia aunque el template sea de otro (la frase de las dos puntas)
    const transferencia = !entrada && !!codigo && esTransferenciaA(otraParteDelCodigo(codigo), b?.beneficiario, b?.descripcion)
    // 👥 JMS 10/11: un GRUPO que no es empresa (la Quinta Rosello —los 5 hermanos—, los Cotitulares) se nombra con su código, y el código MANDA
    // sobre el dueño del template: «los gastos que se hagan de una cuenta o de MA, de MSA o de PAM deben marcarse que es a la cuenta Quinta»
    const grupo = /^(QUINTA|COTITULARES)\b/.test(otraParteDelCodigo(codigo))
    if (transferencia && !/^LIB\b/i.test(codigo)) efecto = efectoDelCodigo(pagadores[0], codigo, false, true)
    else if (grupo && !entrada) efecto = efectoDelCodigo(pagadores[0], codigo, false, false)
    else if (/^LIB\b/i.test(codigo)) efecto = "Libertad (LIB): reparto propio"
    // una ENTRADA con código: lo dice el código, mirado desde quien recibió (sin aviso: el código esperado es el de quien paga)
    // …salvo que entre a quien PAGÓ el gasto de otro, con el código de ese otro: es un REINTEGRO de ese gasto (la VISA de PAM devuelve
    // parte del Seguro Chalet de MA): va en la misma línea que el gasto, restando — no es una distribución al revés
    else if (entrada && codigo && pagadores[0] !== dueno && otraParteDelCodigo(codigo) === dueno) efecto = efectoEntre(pagadores[0], dueno)
    else if (entrada && codigo) efecto = efectoDelCodigo(pagadores[0], codigo, true)
    else if (entrada) efecto = efecto ? `${efecto} · entró a ${pagadores[0]}` : ""
    // lo pagó el dueño y el movimiento tiene código: es un retiro o una distribución en sí (el template «Retiro MA mensual»):
    // el efecto lo dice el código, y no hay nada que avisar
    else if (!efecto && codigo) efecto = efectoDelCodigo(pagadores[0], codigo, false, esTransferenciaA(otraParteDelCodigo(codigo), b?.beneficiario, b?.descripcion))
    else if (EMPRESAS.has(pagadores[0]) && EMPRESAS.has(dueno)) {
      const esperado = codigoEsperado(pagadores[0] as Empresa, dueno as Empresa) ?? ""
      if (esperado.toUpperCase() !== codigo.toUpperCase()) aviso = ` · ⚠️ código esperado: ${esperado || "(vacío)"}`
    }
  } else if (pagadores.length > 1) efecto = "pagada desde varias cuentas: ver una por una"
  // 🎨 JMS 09/11 (punto 5): la columna Efecto NUNCA queda vacía — «pagó el dueño (MA)» es lo normal; lo que no se pagó se dice
  // (y va a «Inconsistencias»)
  if (!efecto) efecto = sinPago ? "sin pago" : b && !b.cuenta ? "sin movimiento en el banco" : pagadores.length ? `pagó el dueño (${dueno})` : ""

  let marca: string
  // 🔁 JMS 09/11: una cuota PENDIENTE va a la deuda aunque esté en $ 0 («si están pendientes, aunque estén en cero, tienen que ir a
  // la deuda y así uno vería la inconsistencia y lo arreglaría»): $ 0 + pendiente = falta el importe, no «no había nada que pagar»
  const pendiente = ESTADOS_TEMPLATE_IMPAGOS.includes((c.estado || "").toLowerCase())
  // 🔍 JMS 09/11 (vthebestpdf): una cuota en $ 0 que SÍ tiene su movimiento, y el banco movió plata (o en dólares), no es «no se pagó nada»:
  // el gasto no está sumando en pesos → 🟡 con el motivo del banco
  const ceroConBanco = Math.abs(c.monto) < 0.005 && !pendiente && !!b?.cuenta && !!b?.motivo
  if (sinPago && ceroConBanco) marca = `🟡 en $ 0 pero ${b!.motivo}`
  else if (sinPago) marca = Math.abs(c.monto) >= 0.005 ? "🔴 SIN PAGAR" : pendiente ? "🔴 SIN PAGAR (en $ 0: falta el importe)" : "⚪ en $ 0 (no se pagó nada)"
  else if (b && !b.cuenta) marca = "🟡 marcada pagada, sin movimiento en el banco"
  else if (b?.motivo) marca = `🟡 ${b.motivo}`
  else marca = b ? "✓" : ""
  return { quienPago, codigo, efecto, marca: marca + aviso, descripcion: b?.descripcion ?? "", beneficiario: b?.beneficiario ?? "", factura: b?.factura ?? "", interno: b?.interno ?? "" }
}

/** ¿El efecto es un retiro / aporte / distribución entre partes? («pagó el dueño», «sin pago» y «sin movimiento» no lo son.) */
export const esEfectoEntrePartes = (efecto: string) => !!efecto && !/^(pagó el dueño|sin pago|sin movimiento)/.test(efecto)

/** Quién RECIBE en un efecto: el destino de la flecha, la empresa del aporte o del retiro, Libertad o FLIA. */
export function receptorDe(efecto: string): string {
  if (/^Libertad/.test(efecto)) return "Libertad"
  if (/FLIA/.test(efecto)) return "FLIA"
  let m = efecto.match(/→ ([A-ZÁÉÍÓÚÑ]+)/); if (m) return m[1]
  if (/^aporte de \S+ a MSA/.test(efecto)) return "MSA"
  m = efecto.match(/^retiro de (\S+)/); if (m) return m[1]
  m = efecto.match(/pagó por (?:cuenta de )?(\S+)/); if (m) return m[1]
  return "otros"
}

/**
 * 🔍 A-FEAT-1579 (JMS 07/11: «después hacemos el reporte de retiros y aportes y de alguna manera tendrían que coincidir»): los RETIROS
 * Y APORTES armados desde la columna Efecto de las cuotas — por efecto × mes, con su Nro y el detalle abajo. Y el CONTROL por dos
 * caminos contra el banco: por cuenta que pagó y código contable, lo que suman las cuotas vs. lo que suman los movimientos del extracto
 * con ese código atados a una cuota; al lado, lo del extracto con código SIN template (retiros directos), que junto con lo de templates
 * es lo que muestran las cuentas de los socios (14.1). ⚠️ avisa si no da: un pago agrupado o una cuota en otro ejercicio lo explican.
 */
export function hojaRetirosYAportes(cuotas: CuotaTemplate[], extracto: { movimientos: Array<{ titular: string; cuenta: string; fecha: string;
  descripcion: string; debitos: number; creditos: number; templateCuotaId: string | null; contable: string; enDolares: boolean }> } | undefined,
  etiqueta: string, meses: { clave: string; rotulo: string }[]): unknown[][] {
  const r2 = (n: number) => Math.round(n * 100) / 100
  const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
  const conEfecto = cuotas.map(c => ({ c, a: auditarCuota(c) })).filter(x => esEfectoEntrePartes(x.a.efecto) && !cuotaSinPago(x.c))

  /**
   * 🔁 UN MOVIMIENTO, DOS PUNTAS (JMS 09/11: «es un solo movimiento con 2 puntas… no debe duplicar ningún movimiento»). Una ENTRADA con
   * código (MA recibe «DIST PAM») se busca como SALIDA en la cuenta de la otra parte (PAM paga «DIST MA»): mismo importe y hasta 5 días.
   * Si aparece, la entrada es la OTRA PUNTA: se lista aparte y no suma. Si no aparece (la otra cuenta no está en el sistema), suma.
   */
  const dias = (a: string, b: string) => Math.abs((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86_400_000)
  const salidas = (extracto?.movimientos ?? []).filter(m => !m.enDolares && m.contable && m.debitos - m.creditos > 0)
  const usadas = new Set<number>()
  const puntaDe = new Map<CuotaTemplate, (typeof salidas)[number]>()
  for (const { c, a } of conEfecto) {
    if (c.monto >= 0 || !a.codigo) continue
    const receptor = String(c.banco?.titular ?? "").toUpperCase(), origen = otraParteDelCodigo(a.codigo)
    if (!origen || !receptor || receptor.includes("+") || !c.fecha) continue
    const i = salidas.findIndex((m, k) => !usadas.has(k) && m.titular.toUpperCase() === origen && otraParteDelCodigo(m.contable) === receptor
      && Math.abs(r2(m.debitos - m.creditos) + c.monto) < 1 && dias(m.fecha, c.fecha!) <= 5)
    if (i >= 0) { usadas.add(i); puntaDe.set(c, salidas[i]) }
  }
  const suman = conEfecto.filter(x => !puntaDe.has(x.c))

  // 🎨 JMS 09/11 (revisión D.4.b): el resumen agrupado por QUIÉN RECIBE — cada línea empieza «PARA MA ·», «PARA PAM ·»… y abajo su total
  const categoria = (efecto: string) => `PARA ${receptorDe(efecto)} · ${efecto}`
  const LINKS = ["📍 Ir a «TOTAL POR QUIÉN RECIBE» (tocá acá)", "📍 Ir a «OTRAS PUNTAS — no suman» (tocá acá)", "📍 Ir a «CONTROL contra el banco» (tocá acá)"]
  const { filas: h } = armarResumenPorMes(suman.map(({ c, a }) => ({
    categoria: categoria(a.efecto), mes: (c.fecha ?? "").slice(0, 7), importe: c.monto, orden: `${c.fecha ?? ""}|${categoria(a.efecto)}`,  // JMS 09/11: el detalle va por FECHA (07/25 → 06/26), aunque se filtre por agrupadora
    // 🔍 JMS 09/11: el contexto completo también acá — Proveedor, Comprobante y Detalle (como en las solapas de agrupadora)
    columnas: [dmy(c.fecha), c.concepto, c.proveedor ?? "", c.banco?.comprobante ?? "", c.detalle ?? "", c.agrupadoraTemplate || "(sin agrupadora)", primero(c.responsable), a.quienPago, a.codigo, CENTRADO(a.marca),
      a.descripcion, a.beneficiario, a.factura, a.interno],
  })), {
    titulo: `RETIROS Y APORTES — desde la columna Efecto de las cuotas — ejercicio ${etiqueta}`,
    notas: ["Cada cuota pagada por una empresa que no es la dueña del gasto (o que es un retiro en sí), agrupada por QUIÉN RECIBE. Libertad (LIB) va aparte, con su reparto.",
      "Una transferencia entre empresas tiene DOS PUNTAS (sale de una cuenta y entra a otra): acá suma UNA sola, la salida, y las dos puntas se rotulan con la MISMA frase («· salió de» / «· entró a»).",
      ...LINKS],
    meses, encabezadoDetalle: ["Fecha", "Concepto", "Proveedor", "Comprobante", "Detalle", "Agrupadora", "Responsable", "Quién pagó", "Código contable", "Marca", "Descripción del banco", "Beneficiario / CUIT", "Factura vinculada", "Interno"],
    debeHaber: true, semestres: true, importeEn: 10,
  })
  const ponerLink = (k: number, fila: number) => { const i = h.findIndex(r => r && r[0] === LINKS[k]); if (i >= 0 && fila > 0) h[i][0] = { t: "s", v: LINKS[k], l: { Target: `#'H · Retiros y aportes'!A${fila}` } } }

  // ── el TOTAL general: se aclara que mezcla todo (la lectura es por quién recibe)
  const iEnc = h.findIndex(r => r && r[3] === "Nro" && r[4] === "Categoría"), iTot = h.findIndex((r, i) => i > iEnc && r && r[4] === "TOTAL")
  if (iTot > 0) h[iTot][4] = "TOTAL (todo junto, mezcla quién recibe: leer «Total por quién recibe»)"
  // 🎨 el Nro, ENTERO (JMS 09/11: salía «1,00» porque comparte columna con importes): en el resumen (col. D) y en el detalle (col. A)
  const iDet = h.findIndex(r => r && r[0] === "Nro" && r[1] === "Mes")
  h.forEach((r, i) => {
    if (!r) return
    if (i > iEnc && (iTot < 0 || i < iTot) && typeof r[3] === "number") r[3] = { t: "n", v: r[3], z: "0" }
    if (iDet >= 0 && i > iDet && typeof r[0] === "number") r[0] = { t: "n", v: r[0], z: "0" }
  })

  // ── el TOTAL POR QUIÉN RECIBE, con fórmulas sobre el resumen de arriba
  const receptores = [...new Set(suman.map(x => receptorDe(x.a.efecto)))].sort((x, y) => x.localeCompare(y, "es"))
  h.push([], ["TOTAL POR QUIÉN RECIBE — la suma de las líneas «PARA …» del resumen de arriba"])
  const filaTotalPorQuien = h.length
  h.push(["Recibe", "", "Total del ejercicio", "Líneas del resumen"].map(x => x ? CENTRADO(x) : x))
  for (const r of receptores) {
    const v = r2(suman.filter(x => receptorDe(x.a.efecto) === r).reduce((t, x) => t + x.c.monto, 0))
    const lineas = [...new Set(suman.filter(x => receptorDe(x.a.efecto) === r).map(x => x.a.efecto))].length
    h.push([r, "", iEnc >= 0 && iTot > 0 ? { t: "n", f: `SUMIF($E${iEnc + 2}:$E${iTot},"PARA ${r} ·*",$C${iEnc + 2}:$C${iTot})`, v } : v, { t: "n", v: lineas, z: "0" }])
  }

  // ── las otras puntas: entradas que ya están contadas por su salida
  const otras = conEfecto.filter(x => puntaDe.has(x.c)).sort((x, y) => (x.c.fecha ?? "").localeCompare(y.c.fecha ?? ""))
  const entradasSinSalida = suman.filter(x => x.c.monto < 0 && x.a.codigo && otraParteDelCodigo(x.a.codigo) && / · entró a /.test(x.a.efecto)).length
  h.push([], ["OTRAS PUNTAS — NO SUMAN: cada una es la entrada de una transferencia que ya suma arriba por su salida"])
  const filaOtras = h.length
  h.push([`✓ ${otras.length} entrada(s) encontraron su salida en la otra cuenta · ${entradasSinSalida} entrada(s) con código sin salida en el sistema (esas sí suman arriba)`])
  // 🧮 JMS 09/11 (C2/C3): los controles con FÓRMULAS — cada número apunta a lo que suma. Para eso, dónde quedó cada cosa en la hoja.
  const txt = (x: unknown) => String(x && typeof x === "object" ? (x as { v?: unknown }).v ?? "" : x ?? "")
  const col = (i: number) => { let s = ""; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s }
  const encDet = iDet >= 0 ? h[iDet].map(txt) : []
  const cNro = col(0), cQuien = col(encDet.indexOf("Quién pagó")), cCod = col(encDet.indexOf("Código contable")), cDeb = col(encDet.indexOf("Débito")), cCre = col(encDet.indexOf("Crédito"))
  let finDet = iDet
  while (finDet + 1 < h.length && h[finDet + 1] && /^\d+$/.test(txt(h[finDet + 1][0]))) finDet++
  const det = (c: string) => `$${c}$${iDet + 2}:$${c}$${finDet + 1}`                    // un rango del detalle (filas 1-based)
  const hayDet = iDet >= 0 && finDet > iDet && ["Quién pagó", "Código contable", "Débito", "Crédito"].every(x => encDet.includes(x))
  const nroDe = new Map<string, string>()                                                 // categoría del resumen → su Nro
  for (let i = iEnc + 1; i < (iTot > 0 ? iTot : h.length); i++) if (h[i]) nroDe.set(txt(h[i][4]), txt(h[i][3]))
  let otrasDesde = 0, otrasHasta = -1, filaTotOtras = 0
  if (otras.length) {
    h.push(["Fecha", "Concepto", "Entró a", "Código", "Importe", "Es la otra punta de (salida)", "Código de la salida", ""].map(x => x ? CENTRADO(x) : x))
    otrasDesde = h.length + 1
    for (const { c, a } of otras) {
      const s = puntaDe.get(c)!
      h.push([dmy(c.fecha), c.concepto, a.quienPago.replace(/^entró a /, ""), a.codigo, r2(-c.monto),
        `${dmy(s.fecha)} · ${s.cuenta} · ${r2(s.debitos - s.creditos).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`, s.contable, CENTRADO("✓")])
    }
    otrasHasta = h.length
    filaTotOtras = h.length + 1
    h.push(["", "TOTAL de las otras puntas (no suma)", "", "", { t: "n", f: `SUM(E${otrasDesde}:E${otrasHasta})`, v: r2(otras.reduce((t, x) => t - x.c.monto, 0)) }])
  }

  // ── el control contra el banco: por cuenta (empresa) y código — las DOS puntas, cada una en su cuenta (como la 14.1)
  const clave = (titular: string, codigo: string) => `${titular.toUpperCase()}|${codigo.toUpperCase()}`
  const desdeCuotas = new Map<string, number>()
  for (const { a, c } of conEfecto) if (a.codigo && c.banco?.titular && !c.banco.titular.includes(" + ")) {
    const k = clave(c.banco.titular, a.codigo); desdeCuotas.set(k, r2((desdeCuotas.get(k) ?? 0) + c.monto))
  }
  const conTpl = new Map<string, number>(), sinTpl = new Map<string, number>()
  // 💳 A-BUG-1584: una compra en US$ con tarjeta tiene $ 0 en pesos en el extracto; su valor en pesos es el de la cuota (US$ × el TC que usó
  // la tarjeta, script 241). Sin esto el control de esa cuenta no da por exactamente lo pasado a pesos.
  const montoCuota = new Map(cuotas.map(c => [c.id, c.monto]))
  for (const m of extracto?.movimientos ?? []) {
    if (!m.contable || m.enDolares) continue
    const pesos = r2(m.debitos - m.creditos)
    const v = Math.abs(pesos) < 0.005 && m.templateCuotaId && montoCuota.has(m.templateCuotaId) ? r2(montoCuota.get(m.templateCuotaId)!) : pesos
    const k = clave(m.titular, m.contable), dest = m.templateCuotaId ? conTpl : sinTpl
    dest.set(k, r2((dest.get(k) ?? 0) + v))
  }
  const claves = [...new Set([...desdeCuotas.keys(), ...conTpl.keys(), ...sinTpl.keys()])]
    .filter(k => /\|(CTA|CUENTA|DIST|RET|LIB)\b/.test(k)).sort()
  h.push([], ["CONTROL — el mismo número por dos caminos: las cuotas (columna Efecto) contra el banco (código del movimiento)"])
  ponerLink(0, filaTotalPorQuien); ponerLink(1, filaOtras); ponerLink(2, h.length)
  if (!extracto) { h.push(["⚠️ No se leyó el extracto del ejercicio: el control no se hizo."]); return h }
  h.push(["Cuenta de (empresa)", "Código", "Desde las cuotas", "Banco, atado a una cuota", "Diferencia", "", "Banco SIN template (retiros directos)", "Total del banco con ese código"])
  /**
   * «Desde las cuotas» con FÓRMULA sobre el detalle de arriba: lo que pagó (o le entró a) esa empresa con ese código, menos las otras puntas
   * que entraron a esa empresa con ese código (están en su tabla, no en el detalle). Se arma el mismo número acá para verificar que la
   * fórmula es la buena; si no da (un pago desde dos cuentas, «MSA + PAM»), queda el número fijo.
   */
  const simulado = (tit: string, cod: string) => r2(
    suman.filter(x => (x.a.quienPago.toUpperCase().startsWith(`${tit} ·`) || x.a.quienPago.toUpperCase().startsWith(`ENTRÓ A ${tit} ·`)) && x.a.codigo.toUpperCase() === cod).reduce((t, x) => t + x.c.monto, 0)
    - otras.filter(x => x.a.quienPago.replace(/^entró a /, "").toUpperCase().startsWith(`${tit} ·`) && x.a.codigo.toUpperCase() === cod).reduce((t, x) => t - x.c.monto, 0))
  const formulaCuotas = (tit: string, cod: string) => {
    const q = (crit: string) => `SUMIFS(${det(cDeb)},${det(cQuien)},"${crit}",${det(cCod)},"${cod}")-SUMIFS(${det(cCre)},${det(cQuien)},"${crit}",${det(cCod)},"${cod}")`
    const o = otras.length ? `-SUMIFS($E$${otrasDesde}:$E$${otrasHasta},$C$${otrasDesde}:$C$${otrasHasta},"${tit} ·*",$D$${otrasDesde}:$D$${otrasHasta},"${cod}")` : ""
    return `${q(`${tit} ·*`)}+${q(`entró a ${tit} ·*`)}${o}`
  }
  const filaCtrl1 = h.length + 1
  let conFormula = 0
  for (const k of claves) {
    const [tit, cod] = k.split("|"), n = h.length + 1
    const cu = desdeCuotas.get(k) ?? 0, ba = conTpl.get(k) ?? 0, si = sinTpl.get(k) ?? 0
    const ok = hayDet && Math.abs(simulado(tit, cod) - cu) < 0.01
    if (ok) conFormula++
    h.push([tit, cod, ok ? { t: "n", f: formulaCuotas(tit, cod), v: cu } : cu, ba, { t: "n", f: `C${n}-D${n}`, v: r2(cu - ba) },
      { t: "s", f: `IF(ABS(E${n})<1,"✓","⚠️ no da")`, v: Math.abs(cu - ba) < 1 ? "✓" : "⚠️ no da" }, si, { t: "n", f: `D${n}+G${n}`, v: r2(ba + si) }])
  }
  const filaCtrlN = h.length
  h.push([], [`«Desde las cuotas» es una fórmula sobre el detalle de arriba y las otras puntas (${conFormula} de ${claves.length} renglones); «Banco» y «Banco SIN template» son los movimientos del extracto. «Total del banco con ese código» es lo que ven las cuentas de los socios (14.1): lo de templates + lo directo.`])

  // 🧮 JMS 09/11 (A2): «¿hay algo que no cuadra?» — el TOTAL de arriba y el «Total del banco» NO miden lo mismo, y la diferencia se explica
  // al peso: el control resta las entradas (las otras puntas) y suma lo directo; el resumen suma lo que no tiene código de cuenta corriente.
  // Con FÓRMULAS (C2): cada paso apunta a lo que suma, y el cierre se compara contra el TOTAL de arriba.
  const F = (f: string, v: number) => ({ t: "n", f, v, z: MONEDA_AR }), F_TOT = (f: string, v: number) => ({ t: "n", f, v, z: MONEDA_AR, s: ESTILO_TOT })
  const enClaves = new Set(claves)
  const totalArriba = r2(suman.reduce((t, x) => t + x.c.monto, 0))
  const ctrlCuotas = r2(claves.reduce((t, k) => t + (desdeCuotas.get(k) ?? 0), 0))
  const totOtras = r2(otras.reduce((t, x) => t - x.c.monto, 0))
  const fuera = new Map<string, { efecto: string; codigo: string; v: number }>()
  for (const { c, a } of suman) {
    const tit = c.banco?.titular ?? ""
    if (a.codigo && tit && !tit.includes(" + ") && enClaves.has(clave(tit, a.codigo))) continue
    const k = `${a.efecto}|${a.codigo}`, ant = fuera.get(k)
    fuera.set(k, { efecto: a.efecto, codigo: a.codigo, v: r2((ant?.v ?? 0) + c.monto) })
  }
  const totFuera = r2([...fuera.values()].reduce((t, x) => t + x.v, 0))
  const bancoAtado = r2(claves.reduce((t, k) => t + (conTpl.get(k) ?? 0), 0)), directos = r2(claves.reduce((t, k) => t + (sinTpl.get(k) ?? 0), 0))
  const resto = r2(totalArriba - ctrlCuotas - totOtras - totFuera)
  h.push([], [TITULO_TABLA("DE UN TOTAL AL OTRO — el TOTAL de arriba y el «Total del banco» miden cosas distintas; así se pasa de uno al otro")])
  h.push([ENCABEZADO_TABLA("Paso"), ENCABEZADO_TABLA(""), ENCABEZADO_TABLA("Importe"), ENCABEZADO_TABLA("¿Cierra?")])
  const pasoDesde = h.length + 1
  h.push(["Control: «Desde las cuotas» (suma de la columna)", "", F(`SUM(C${filaCtrl1}:C${filaCtrlN})`, ctrlCuotas)])
  h.push(["+ las OTRAS PUNTAS: el control las resta (entraron a otra cuenta); arriba no suman", "", filaTotOtras ? F(`E${filaTotOtras}`, totOtras) : F("0", 0)])
  for (const x of [...fuera.values()].sort((p, q) => Math.abs(q.v) - Math.abs(p.v))) {
    const nro = nroDe.get(categoria(x.efecto)) ?? ""
    const crit = x.codigo ? `"${x.codigo}"` : `"="`
    const f = hayDet && nro ? `SUMIFS(${det(cDeb)},${det(cNro)},${nro},${det(cCod)},${crit})-SUMIFS(${det(cCre)},${det(cNro)},${nro},${det(cCod)},${crit})` : ""
    h.push([`+ arriba sin renglón en el control: ${x.efecto} ${x.codigo ? `(código «${x.codigo}»)` : "(sin código)"} — Nro ${nro} del resumen`, "", f ? F(f, x.v) : { t: "n", v: x.v, z: MONEDA_AR }])
  }
  const pasoHasta = h.length
  const filaTotArriba = iTot >= 0 ? iTot + 1 : 0
  const nCierre = h.length + 1
  h.push([TOTAL_TEXTO("= suma de los pasos  ·  contra el TOTAL de arriba (Retiros y aportes)"), TOTAL_TEXTO(""), F_TOT(`SUM(C${pasoDesde}:C${pasoHasta})`, r2(ctrlCuotas + totOtras + totFuera)),
    filaTotArriba ? { t: "s", f: `IF(ABS(C${nCierre}-C${filaTotArriba})<0.01,"✓ cierra al peso con el TOTAL de arriba","⚠️ no cierra: "&TEXT(C${nCierre}-C${filaTotArriba},"#,##0.00"))`,
      v: Math.abs(resto) < 0.01 ? "✓ cierra al peso con el TOTAL de arriba" : "⚠️ no cierra" } : ""])
  h.push([])
  const nB = h.length + 1
  h.push(["Control: «Banco, atado a una cuota» (= «Desde las cuotas», renglón por renglón ✓)", "", F(`SUM(D${filaCtrl1}:D${filaCtrlN})`, bancoAtado)])
  h.push(["+ «Banco SIN template» (retiros directos: van a la cuenta del socio, 14.1, y no a este resumen de cuotas)", "", F(`SUM(G${filaCtrl1}:G${filaCtrlN})`, directos)])
  const nBT = h.length + 1
  h.push([TOTAL_TEXTO("= «Total del banco con ese código»"), TOTAL_TEXTO(""), F_TOT(`C${nB}+C${nB + 1}`, r2(bancoAtado + directos)),
    { t: "s", f: `IF(ABS(C${nBT}-SUM(H${filaCtrl1}:H${filaCtrlN}))<0.01,"✓ = la columna «Total del banco»","⚠️ no da")`, v: "✓ = la columna «Total del banco»" }])
  return h
}

/** La base de una cuota «Anual» / «Cuota» (el vehículo o la partida) y su año: «Imp Automotores Gol 2012 Anual» → «Imp Automotores Gol 2012». */
export function baseYModalidad(concepto: string): { base: string; modalidad: "anual" | "cuota" | null } {
  const m = /\banual\b/i.test(concepto) ? "anual" : /\bcuota\b/i.test(concepto) ? "cuota" : null
  return { base: concepto.replace(/\b(anual|cuota)\b/gi, "").replace(/\s+/g, " ").trim().toLowerCase(), modalidad: m }
}
/** Las cuotas PAGADAS (con plata) de un vehículo / partida que el mismo año tiene pagos en anual Y en cuotas. */
export function cuotasPagadasEnAnualYCuotas(cuotas: CuotaTemplate[]): Set<CuotaTemplate> {
  const porBase = new Map<string, CuotaTemplate[]>()
  for (const c of cuotas) {
    const { base, modalidad } = baseYModalidad(c.concepto)
    if (!modalidad || cuotaSinPago(c) || Math.abs(c.monto) < 0.005) continue
    const k = `${base}|${c.anioTemplate ?? (c.fecha ?? "").slice(0, 4)}`  // el año del template (plan), no el de la fecha de pago
    porBase.set(k, [...(porBase.get(k) ?? []), c])
  }
  const out = new Set<CuotaTemplate>()
  for (const cs of porBase.values()) {
    const mods = new Set(cs.map(c => baseYModalidad(c.concepto).modalidad))
    if (mods.has("anual") && mods.has("cuota")) cs.forEach(c => out.add(c))
  }
  return out
}

/**
 * 🧾 INCONSISTENCIAS (JMS 09/11: «las inconsistencias deben ir en una pestaña… si hubiera problema, que quede marcado en la pestaña de
 * inconsistencias» · «5.2 [lo no pagado] es una inconsistencia»). Todo lo que hay que mirar de todas las solapas, en un solo lugar, con link
 * a la solapa de la cuota. Lo en $ 0 va aparte, al final (suele ser normal: SICORE sin retenciones, retiros semestrales).
 */
export function hojaInconsistencias(cuotas: CuotaTemplate[], etiqueta: string, solapaDe: (c: CuotaTemplate) => string, estructura?: ProblemaModalidad[]): unknown[][] {
  const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
  // 🔁 JMS 09/11: un vehículo / partida va por ANUAL o por CUOTAS, no las dos. Si el mismo año tiene plata pagada en las dos modalidades,
  // es una inconsistencia (se pagó dos veces lo mismo, o una de las dos está mal cargada)
  const doble = cuotasPagadasEnAnualYCuotas(cuotas)
  const TIPOS: Array<[string, (a: AuditoriaDeCuota, c: CuotaTemplate) => boolean]> = [
    ["🔴 Pagado en ANUAL y en CUOTAS (mismo vehículo o partida y año)", (_a, c) => doble.has(c)],
    // JMS 09/11 (B4): lo impago al cierre se trata como DEUDA → va a los datos a revisar
    ["🔴 Sin pagar al cierre → ¿DEUDA? (datos a revisar)", a => a.marca.startsWith("🔴")],
    ["🟡 Marcada pagada, sin movimiento en el banco", a => a.marca.startsWith("🟡 marcada pagada")],
    ["🟡 El banco movió otro importe que la cuota", a => a.marca.startsWith("🟡") && /banco movió|pago agrupado/.test(a.marca)],
    ["🟡 En $ 0 pero el banco movió plata (el gasto no suma en pesos)", a => a.marca.startsWith("🟡 en $ 0 pero")],
    ["🟡 Pagada desde una cuenta en dólares (no se compara)", a => a.marca.startsWith("🟡") && /dólares/.test(a.marca)],
    ["🟡 Otro aviso del banco", a => a.marca.startsWith("🟡")],
    ["⚠️ El código contable no es el esperado", a => a.marca.includes("código esperado")],
    // 🔍 JMS 09/11: «se debe llegar siempre desde Inconsistencias» — una cuota SIN CUENTA (Otros Gastos sin su sub-cuenta) no se ubica en el
    // balance (va a «sin clasificar»)
    ["🟡 Cuota SIN CUENTA (el balance no sabe dónde ubicarla)", (_a, c) => !c.categ],
    ["⚪ En $ 0 (no se pagó nada) — suele ser normal", a => a.marca.startsWith("⚪")],
  ]
  const filas: Array<{ tipo: number; c: CuotaTemplate; a: AuditoriaDeCuota }> = []
  for (const c of cuotas) {
    const a = auditarCuota(c)
    const i = TIPOS.findIndex(([, p]) => p(a, c))
    if (i >= 0) filas.push({ tipo: i, c, a })
  }
  filas.sort((x, y) => x.tipo - y.tipo || primero(x.c.responsable).localeCompare(primero(y.c.responsable)) || (x.c.fecha ?? "").localeCompare(y.c.fecha ?? ""))
  const h: unknown[][] = [[`INCONSISTENCIAS — lo que hay que mirar de todas las solapas — ejercicio ${etiqueta}`],
    ["Cada renglón lleva a su solapa (columna «Ir a»). Lo en $ 0 va al final: suele ser normal, pero se lista para que se vea."], [],
    ["Tipo", "Cuotas", "Importe"].map(CENTRADO)]
  for (const [i, [t]] of TIPOS.entries()) {
    const fs = filas.filter(f => f.tipo === i)
    if (fs.length) h.push([t, { t: "n", v: fs.length, z: "0" }, Math.round(fs.reduce((s, f) => s + f.c.monto, 0) * 100) / 100])
  }
  // 🔁 JMS 09/11 (A-FEAT-1582): el control de ESTRUCTURA de los templates — el mismo que salta en Principal (lib/templates/modalidad.ts):
  // anual o cuotas (una sola modalidad activa, con cuotas; la inactiva sin cuotas vivas) y los pagos (desactivada con pago, conciliada
  // sin pago). Mira TODA la base, no sólo las cuotas de este libro: un error de estructura es de la app, no del ejercicio.
  if (estructura) {
    h.push([], [`ESTRUCTURA DE LOS TEMPLATES — anual o cuotas y pagos (el mismo control que Principal) · ${estructura.length ? `${estructura.length} a corregir` : "✓ sin errores"}`])
    if (estructura.length) {
      // 🔗 JMS 09/11 (A1): cada renglón lleva a la solapa donde está el template (por una de sus cuotas, o por el nombre); si el
      // template no tiene cuotas en este libro, se dice
      const porId = new Map(cuotas.map(c => [c.id, c]))
      const solapaDel = (p: ProblemaModalidad) => {
        const c = p.cuotas.map(x => porId.get(x.id)).find(Boolean) ?? cuotas.find(x => x.concepto === p.template)
        return c ? solapaDe(c) : ""
      }
      h.push(["Qué pasa", "Template", "Año", "Cuotas", "Importe", "Qué hacer", "Fechas", "Ir a"].map(CENTRADO))
      for (const p of estructura) {
        const sol = solapaDel(p)
        h.push([`${p.tipo === "conciliada_en_cero" ? "⚪" : "🔴"} ${p.titulo}`, p.template, p.anio ?? "", { t: "n", v: p.cuotas.length, z: "0" },
          Math.round(p.cuotas.reduce((x, c) => x + c.monto, 0) * 100) / 100, p.accion, p.cuotas.map(c => dmy(c.fecha)).join(" · "),
          sol ? { t: "s", v: sol, l: { Target: `#'${sol.replace(/'/g, "''")}'!A1`, Tooltip: `Ir a «${sol}»` } } : "(no está en este libro: fuera del ejercicio)"])
      }
    }
  }
  h.push([], ["Tipo", "Responsable", "Agrupadora", "Concepto", "Fecha", "Importe", "Estado", "Quién pagó", "Código", "Marca", "Descripción del banco", "Ir a"].map(CENTRADO))
  for (const { tipo, c, a } of filas) {
    const solapa = solapaDe(c)
    h.push([TIPOS[tipo][0], primero(c.responsable), c.agrupadoraTemplate || "(sin agrupadora)", c.concepto, dmy(c.fecha), c.monto, c.estado,
      a.quienPago, a.codigo, CENTRADO(a.marca), a.descripcion,
      solapa ? { t: "s", v: solapa, l: { Target: `#'${solapa.replace(/'/g, "''")}'!A1`, Tooltip: `Ir a «${solapa}»` } } : ""])
  }
  // 🔗 JMS 09/11: cada tipo del resumen lleva a su primer renglón del detalle
  const iDet = h.findIndex(r => r[0] && typeof r[0] === "object" && (r[0] as { v?: unknown }).v === "Tipo" && h.indexOf(r) > 4)
  // 🧮 JMS 09/11 (C3): el resumen por tipo con FÓRMULAS sobre el detalle de abajo (Tipo en A, Importe en F)
  const nombresTipo = new Set(TIPOS.map(([t]) => t))
  const rangoA = `$A$${iDet + 2}:$A$${h.length}`, rangoF = `$F$${iDet + 2}:$F$${h.length}`
  for (let k = 4; k < h.length && k < iDet; k++) {
    const t = h[k][0]
    if (typeof t !== "string") continue
    if (nombresTipo.has(t) && iDet >= 0) {
      const crit = t.replace(/~/g, "~~").replace(/\*/g, "~*").replace(/\?/g, "~?").replace(/"/g, '""')
      h[k][1] = { t: "n", f: `COUNTIF(${rangoA},"${crit}")`, v: (h[k][1] as { v: number }).v, z: "0" }
      h[k][2] = { t: "n", f: `SUMIF(${rangoA},"${crit}",${rangoF})`, v: h[k][2] as number }
    }
    const d = h.findIndex((r, n) => n > iDet && r[0] === t)
    if (d >= 0) h[k][0] = { t: "s", v: `${t} ➜`, l: { Target: `#'Inconsistencias'!A${d + 1}`, Tooltip: "Ir al primer renglón de este tipo" } }
  }
  // 🔎 JMS 09/11: «el filtro debe estar en la de abajo» — el filtro y la fila fija van en el encabezado del DETALLE, no del resumen
  if (iDet >= 0) { filtrarEn(h, `A${iDet + 1}:L${Math.max(h.length, iDet + 2)}`); congelarEn(h, iDet + 1) }
  return h
}
