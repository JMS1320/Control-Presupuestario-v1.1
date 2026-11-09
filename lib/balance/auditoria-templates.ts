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
import type { CuotaTemplate } from "./templates-libro"
import { duenoDelBien, codigoEsperado, type Empresa } from "./dueno-de-bienes"
import { cuotaSinPago } from "./grupos-templates"
import { armarResumenPorMes } from "./resumen-por-mes"

export interface AuditoriaDeCuota {
  quienPago: string
  codigo: string
  efecto: string
  marca: string
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
  if (dueno === "MSA") return `aporte de ${pagador} (pagó un gasto de MSA)`
  if (pagador === "PAM" && dueno === "MA") return "distribución PAM → MA (pagó un gasto de MA)"
  return `${pagador} pagó por ${dueno}`
}

/** 🎨 JMS 09/11 (formato que dio en «H · MA · Imp Rurales»): la Marca centrada; el template de la tabla de control, a la derecha. */
export const CENTRADO = (v: string) => ({ t: "s", v, s: { alignment: { horizontal: "center" } } })
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
  const f: unknown[][] = [[], ["", "CONTROL POR TEMPLATE — cada template con sus cuotas: ¿se pagaron todas?"],
    ["", "Template", "Cuotas", "✓ pagadas", "🔴 sin pagar", "🟡 a revisar", "⚪ en $ 0", "⚠️ código", "Total", "¿Completo?"].map(x => x ? CENTRADO(x) : x)]
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
export function efectoDelCodigo(titular: string, codigo: string, entrada = false): string {
  const m = codigo.trim().match(/^(CTA|CUENTA|DIST|RET)\s+(.+)$/i)
  if (!m) return (/^FLIA\b/i.test(codigo) ? "gasto de la familia (FLIA)" : `código ${codigo}`) + (entrada ? ` · entró a ${titular}` : "")
  const quien = m[2].trim().toUpperCase()
  if (/^DIST$/i.test(m[1])) return entrada ? `distribución ${quien} → ${titular} · entró a ${titular}` : `distribución ${titular} → ${quien} · salió de ${titular}`
  if (entrada) return `${quien} → ${titular} (cuenta corriente) · entró a ${titular}`
  return titular === "MSA" ? `retiro de ${quien} pagado por MSA` : `${titular} pagó por cuenta de ${quien}`
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
    if (/^LIB\b/i.test(codigo)) efecto = "Libertad (LIB): reparto propio"
    // una ENTRADA con código: lo dice el código, mirado desde quien recibió (sin aviso: el código esperado es el de quien paga)
    // …salvo que entre a quien PAGÓ el gasto de otro, con el código de ese otro: es un REINTEGRO de ese gasto (la VISA de PAM devuelve
    // parte del Seguro Chalet de MA): va en la misma línea que el gasto, restando — no es una distribución al revés
    else if (entrada && codigo && pagadores[0] !== dueno && otraParteDelCodigo(codigo) === dueno) efecto = efectoEntre(pagadores[0], dueno)
    else if (entrada && codigo) efecto = efectoDelCodigo(pagadores[0], codigo, true)
    else if (entrada) efecto = efecto ? `${efecto} · entró a ${pagadores[0]}` : ""
    // lo pagó el dueño y el movimiento tiene código: es un retiro o una distribución en sí (el template «Retiro MA mensual»):
    // el efecto lo dice el código, y no hay nada que avisar
    else if (!efecto && codigo) efecto = efectoDelCodigo(pagadores[0], codigo)
    else if (EMPRESAS.has(pagadores[0]) && EMPRESAS.has(dueno)) {
      const esperado = codigoEsperado(pagadores[0] as Empresa, dueno as Empresa) ?? ""
      if (esperado.toUpperCase() !== codigo.toUpperCase()) aviso = ` · ⚠️ código esperado: ${esperado || "(vacío)"}`
    }
  } else if (pagadores.length > 1) efecto = "pagada desde varias cuentas: ver una por una"

  let marca: string
  if (sinPago) marca = Math.abs(c.monto) < 0.005 ? "⚪ en $ 0 (no se pagó nada)" : "🔴 SIN PAGAR"
  else if (b && !b.cuenta) marca = "🟡 marcada pagada, sin movimiento en el banco"
  else if (b?.motivo) marca = `🟡 ${b.motivo}`
  else marca = b ? "✓" : ""
  return { quienPago, codigo, efecto, marca: marca + aviso }
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
  const conEfecto = cuotas.map(c => ({ c, a: auditarCuota(c) })).filter(x => x.a.efecto && !cuotaSinPago(x.c))

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

  const { filas: h } = armarResumenPorMes(suman.map(({ c, a }) => ({
    categoria: a.efecto, mes: (c.fecha ?? "").slice(0, 7), importe: c.monto, orden: `${a.efecto}|${c.fecha ?? ""}`,
    columnas: [dmy(c.fecha), c.concepto, c.agrupadoraTemplate || "(sin agrupadora)", primero(c.responsable), a.quienPago, a.codigo, CENTRADO(a.marca)],
  })), {
    titulo: `RETIROS Y APORTES — desde la columna Efecto de las cuotas — ejercicio ${etiqueta}`,
    notas: ["Cada cuota pagada por una empresa que no es la dueña del gasto (o que es un retiro en sí). Libertad (LIB) va aparte, con su reparto.",
      "Una transferencia entre empresas tiene DOS PUNTAS (sale de una cuenta y entra a otra): acá suma UNA sola, la salida. La entrada va abajo, en «Otras puntas»."],
    meses, encabezadoDetalle: ["Fecha", "Concepto", "Agrupadora", "Responsable", "Quién pagó", "Código contable", "Marca"], debeHaber: true, semestres: true,
  })

  // ── las otras puntas: entradas que ya están contadas por su salida
  const otras = conEfecto.filter(x => puntaDe.has(x.c)).sort((x, y) => (x.c.fecha ?? "").localeCompare(y.c.fecha ?? ""))
  const entradasSinSalida = suman.filter(x => x.c.monto < 0 && x.a.codigo && otraParteDelCodigo(x.a.codigo) && / · entró a /.test(x.a.efecto)).length
  h.push([], ["OTRAS PUNTAS — NO SUMAN: cada una es la entrada de una transferencia que ya suma arriba por su salida"])
  h.push([`✓ ${otras.length} entrada(s) encontraron su salida en la otra cuenta · ${entradasSinSalida} entrada(s) con código sin salida en el sistema (esas sí suman arriba)`])
  if (otras.length) {
    h.push(["Fecha", "Concepto", "Entró a", "Código", "Importe", "Es la otra punta de (salida)", "Código de la salida", ""].map(x => x ? CENTRADO(x) : x))
    for (const { c, a } of otras) {
      const s = puntaDe.get(c)!
      h.push([dmy(c.fecha), c.concepto, a.quienPago.replace(/^entró a /, ""), a.codigo, r2(-c.monto),
        `${dmy(s.fecha)} · ${s.cuenta} · ${r2(s.debitos - s.creditos).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`, s.contable, CENTRADO("✓")])
    }
    h.push(["", "TOTAL de las otras puntas (no suma)", "", "", r2(otras.reduce((t, x) => t - x.c.monto, 0))])
  }

  // ── el control contra el banco: por cuenta (empresa) y código — las DOS puntas, cada una en su cuenta (como la 14.1)
  const clave = (titular: string, codigo: string) => `${titular.toUpperCase()}|${codigo.toUpperCase()}`
  const desdeCuotas = new Map<string, number>()
  for (const { a, c } of conEfecto) if (a.codigo && c.banco?.titular && !c.banco.titular.includes(" + ")) {
    const k = clave(c.banco.titular, a.codigo); desdeCuotas.set(k, r2((desdeCuotas.get(k) ?? 0) + c.monto))
  }
  const conTpl = new Map<string, number>(), sinTpl = new Map<string, number>()
  for (const m of extracto?.movimientos ?? []) {
    if (!m.contable || m.enDolares) continue
    const k = clave(m.titular, m.contable), v = r2(m.debitos - m.creditos), dest = m.templateCuotaId ? conTpl : sinTpl
    dest.set(k, r2((dest.get(k) ?? 0) + v))
  }
  const claves = [...new Set([...desdeCuotas.keys(), ...conTpl.keys(), ...sinTpl.keys()])]
    .filter(k => /\|(CTA|CUENTA|DIST|RET|LIB)\b/.test(k)).sort()
  h.push([], ["CONTROL — el mismo número por dos caminos: las cuotas (columna Efecto) contra el banco (código del movimiento)"])
  if (!extracto) { h.push(["⚠️ No se leyó el extracto del ejercicio: el control no se hizo."]); return h }
  h.push(["Cuenta de (empresa)", "Código", "Desde las cuotas", "Banco, atado a una cuota", "Diferencia", "", "Banco SIN template (retiros directos)", "Total del banco con ese código"])
  for (const k of claves) {
    const [tit, cod] = k.split("|"), n = h.length + 1
    const cu = desdeCuotas.get(k) ?? 0, ba = conTpl.get(k) ?? 0, si = sinTpl.get(k) ?? 0
    h.push([tit, cod, cu, ba, { t: "n", f: `C${n}-D${n}`, v: r2(cu - ba) },
      { t: "s", f: `IF(ABS(E${n})<1,"✓","⚠️ no da")`, v: Math.abs(cu - ba) < 1 ? "✓" : "⚠️ no da" }, si, { t: "n", f: `D${n}+G${n}`, v: r2(ba + si) }])
  }
  h.push([], ["«Total del banco con ese código» es lo que ven las cuentas de los socios (14.1) para esa cuenta: lo de templates + lo directo."])
  return h
}
