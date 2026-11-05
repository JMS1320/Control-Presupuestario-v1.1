/**
 * 📒 **EL LIBRO F — BALANCE EN LÍNEA** (A-FEAT-1509, JMS 01/11).
 *
 * *«Teniendo siempre los datos de apertura y la app calculando el resto se tiene el balance en línea.»* Las filas son los
 * renglones del balance del contador (`APERTURA_MSA_2025`) con su apertura, que es un dato fijo. El CIERRE lo pone la app
 * **sólo en los renglones de la tanda «1 CLAUDE»** y en los «0 - YA HECHO» que ya tienen su papel; el resto queda en
 * blanco a propósito (JMS: *«todas las filas que te puse que iban por diario o templates, dejalo en blanco; poné el dato de
 * arranque, que es el del contador»*).
 *
 * Signo, el del contador: activo positivo; pasivo, patrimonio y ganancias negativos.
 *
 * Pura: recibe lo que ya armó la pantalla (cadenas de saldos, papeles 03/04, hacienda…) y lo que leyó aparte.
 * 🛑 Lo que no se trajo se dice «no se trajo», nunca «no existe» (A-BUG-1508).
 */
import type { RenglonApertura } from "./apertura-contador"
import type { CadenaDeSaldos } from "./saldos-al-inicio"
import type { DeudaTarjeta } from "./balance-propio"
import type { FondoComun } from "./papeles-bancarios"
import type { ValuacionHacienda } from "./hacienda-stock"
import type { TresSaldos } from "./tres-saldos-hacienda"
import { CATEGORIAS_PLANILLA } from "./tres-saldos-hacienda"

const r2 = (n: number) => Math.round(n * 100) / 100
const MONEDA = '#,##0.00;(#,##0.00);"-"'

/** Lo que la pantalla junta para el libro F. Todo opcional: lo que falta se dice en su renglón. */
export interface EntradaBalanceEnLinea {
  apertura: RenglonApertura[]
  fechaCierre: string
  /** Las cadenas de saldos del papel 07 (bancos y cajas en pesos). `null` = no se armaron los papeles bancarios. */
  cadenas: CadenaDeSaldos[] | null
  /** La cuenta corriente en dólares: saldo en US$ antes del primer movimiento, neto y saldo al cierre; TC de cierre. */
  dolares?: { cuenta: string; usdInicio: number | null; netoUsd: number; usdCierre: number | null; desde: string | null; hasta: string | null; tcCierre: number | null; fuenteTc: string } | null
  /** Caja en dólares: sus movimientos (si los hay). */
  cajaUsd?: { movimientos: number; netoUsd: number } | null
  fci?: {
    cuotasInicio: number | null; valorInicio: number | null; notaInicio: string
    cuotasCierre: number | null; valorCierre: number | null; notaCierre: string
    /** Del extracto del banco (lo que entró y salió de la cuenta por el fondo). */
    banco: FondoComun | null
  } | null
  /** Papel 04.1: los cheques emitidos antes del cierre y debitados después. */
  cheques?: { total: number; cantidad: number } | null
  /** Papel 04.2: anticipos a proveedores con saldo al cierre. */
  anticipos?: { total: number; cantidad: number } | null
  /** Papel 04: comprobantes a pagar + cuentas corrientes con saldo a pagar. */
  proveedores?: { facturas: number; cuentasCorrientes: number } | null
  /** Papel 05: la provisión de facturas del ejercicio. */
  provision?: { total: number; cantidad: number } | null
  tarjeta?: DeudaTarjeta | null
  /** El template de cargas sociales que vence el mes siguiente al cierre (período del mes de cierre). */
  suss?: { concepto: string; vencimiento: string | null; monto: number; estado: string } | null
  soja?: { tnInicio: number | null; nota: string } | null
  hacienda?: { valuacion: ValuacionHacienda; inicio: TresSaldos | null; cierre: TresSaldos | null } | null
}

export interface FilaBalanceEnLinea {
  renglon: RenglonApertura
  /** El cierre que da la app, con el signo del contador. `null` = en blanco. */
  cierre: number | null
  /** Por qué está así: «calculado», «en blanco (lo hace JMS)», «no se trajo…». */
  estado: string
  /** La solapa de detalle, si tiene. */
  detalle?: string
}

const DET_CAJA = "F · Caja y bancos"
const DET_FCI = "F · FCI"
const DET_DEUDAS = "F · Deudas y créditos"
const DET_SOJA = "F · Soja"
const DET_HACIENDA = "F · Vacas de cría"

/** La cadena de una cuenta del papel 07 por su nombre. */
const cadena = (e: EntradaBalanceEnLinea, nombre: string) => e.cadenas?.find(c => c.cuenta === nombre) ?? null
const CAJAS = ["CAJA GENERAL", "CAJA AMS", "CAJA SIGOT"]
const BANCO_DE: Record<string, string> = { "1.1.1/02/01": "BANCO SANTANDER", "1.1.1/02/02": "BANCO PROVINCIA", "1.1.1/02/07": "BANCO GALICIA (cta cte)" }

/** Pura: el cierre de cada renglón y su estado. */
export function filasBalanceEnLinea(e: EntradaBalanceEnLinea): FilaBalanceEnLinea[] {
  return e.apertura.map((r): FilaBalanceEnLinea => {
    const tanda = r.tanda.toUpperCase()
    const enBlanco = (por: string): FilaBalanceEnLinea => ({ renglon: r, cierre: null, estado: por })
    if (!tanda.startsWith("1") && !tanda.startsWith("0")) {
      return enBlanco(/diario|template/i.test(r.obs) ? "en blanco: Libro Diario / templates (lo arma JMS)" : r.origen === "Contador" ? "en blanco: lo da el contador" : "en blanco")
    }
    switch (r.cuenta) {
      case "1.1.1/01/01": {   // Caja
        if (!e.cadenas) return { ...enBlanco("no se trajo: faltan los papeles bancarios"), detalle: DET_CAJA }
        const neto = CAJAS.reduce((t, n) => t + (cadena(e, n)?.netoCargado ?? 0), 0)
        return { renglon: r, cierre: r2(r.hist + neto), estado: "calculado: apertura + movimientos de las cajas en la app", detalle: DET_CAJA }
      }
      case "1.1.1/01/03": {   // Caja dólares
        const n = e.cajaUsd?.movimientos ?? 0
        return n ? { renglon: r, cierre: null, estado: `la caja en dólares tiene ${n} movimiento(s): falta valuarlos`, detalle: DET_CAJA }
          : { renglon: r, cierre: r.hist, estado: "sin movimientos cargados en la app: queda la apertura", detalle: DET_CAJA }
      }
      case "1.1.1/02/01": case "1.1.1/02/02": case "1.1.1/02/07": {
        const c = cadena(e, BANCO_DE[r.cuenta])
        if (!e.cadenas) return { ...enBlanco("no se trajo: faltan los papeles bancarios"), detalle: DET_CAJA }
        if (!c || c.saldoAlCierre == null) return { renglon: r, cierre: null, estado: "sin movimientos del ejercicio cargados en la app", detalle: DET_CAJA }
        return { renglon: r, cierre: r2(c.saldoAlCierre), estado: "saldo del extracto al cierre", detalle: DET_CAJA }
      }
      case "1.1.1/02/09": {   // Galicia USD
        const d = e.dolares
        if (!d) return { ...enBlanco("no se trajo: la cuenta en dólares"), detalle: DET_CAJA }
        if (d.usdCierre == null || d.tcCierre == null) return { renglon: r, cierre: null, estado: d.tcCierre == null ? "falta el dólar al cierre" : "sin saldo al cierre", detalle: DET_CAJA }
        return { renglon: r, cierre: r2(d.usdCierre * d.tcCierre), estado: `US$ ${fmt(d.usdCierre)} × ${fmt(d.tcCierre)} (${d.fuenteTc})`, detalle: DET_CAJA }
      }
      case "1.1.1/02/03": {   // Cheques pendientes de débito
        if (!e.cheques) return enBlanco("no se trajo: papel 04.1")
        return { renglon: r, cierre: r2(-e.cheques.total), estado: `papel 04.1: ${e.cheques.cantidad} cheque(s) emitidos y no debitados al cierre`, detalle: DET_DEUDAS }
      }
      case "1.1.1/02/06": {   // FCI
        const f = e.fci
        if (!f || f.cuotasCierre == null || f.valorCierre == null) return { ...enBlanco("falta la tenencia al cierre (cuotapartes y valor)"), detalle: DET_FCI }
        return { renglon: r, cierre: r2(f.cuotasCierre * f.valorCierre), estado: `${fmt(f.cuotasCierre)} cuotapartes × ${f.valorCierre} (${f.notaCierre})`, detalle: DET_FCI }
      }
      case "1.1.4/02/02": {   // Anticipos a proveedores
        if (!e.anticipos) return enBlanco("no se trajo: papel 04.2")
        return { renglon: r, cierre: r2(e.anticipos.total), estado: `papel 04.2: ${e.anticipos.cantidad} anticipo(s) sin facturar al cierre`, detalle: DET_DEUDAS }
      }
      case "1.1.4/03/06":     // Impuesto al cheque: JMS «completá sólo el inicio»
        return enBlanco("sólo la apertura (JMS: «completá sólo el inicio»)")
      case "1.1.5/02/00":     // Soja: sólo el inicio, en cantidad
        return { ...enBlanco("sólo el inicio, en cantidad (en la hoja de detalle)"), detalle: DET_SOJA }
      case "1.2.2/05/01": {   // Vacas de cría
        const h = e.hacienda
        if (!h) return { ...enBlanco("no se trajo: falta «⚡ Armar todo» (stock y precios)"), detalle: DET_HACIENDA }
        // 💰 A-FEAT-1541: el valor del balance es el NETO del descuento de comercialización (10 % sobre el total).
        const neto = h.valuacion.neto ?? h.valuacion.valuado
        if (h.valuacion.huecos.length) return { renglon: r, cierre: r2(neto), estado: `valuado parcial: ${h.valuacion.cabezasSinValuar} cabeza(s) sin precio`, detalle: DET_HACIENDA }
        return { renglon: r, cierre: r2(neto), estado: `${h.valuacion.cabezas} cabezas a los precios de cierre, menos 10 % de comercialización`, detalle: DET_HACIENDA }
      }
      case "2.1.1/01/01": {   // Proveedores
        if (!e.proveedores) return enBlanco("no se trajo: papel 04")
        return { renglon: r, cierre: r2(-(e.proveedores.facturas + e.proveedores.cuentasCorrientes)), estado: "papel 04: facturas a pagar + cuentas corrientes con saldo a pagar", detalle: DET_DEUDAS }
      }
      case "2.1.1/01/04": {   // Provisión
        if (!e.provision) return enBlanco("no se trajo: papel 05")
        return { renglon: r, cierre: r2(-e.provision.total), estado: `papel 05: ${e.provision.cantidad} comprobante(s) a provisionar`, detalle: DET_DEUDAS }
      }
      case "2.1.1/01/10": {   // Tarjeta
        if (!e.tarjeta) return enBlanco("no se trajo: la tarjeta")
        return { renglon: r, cierre: r2(-e.tarjeta.deuda), estado: e.tarjeta.falta ? `parcial — ${e.tarjeta.falta}` : "deuda de la tarjeta al cierre", detalle: DET_DEUDAS }
      }
      case "2.1.2/02/01": {   // SUSS
        if (!e.suss) return { ...enBlanco("no se encontró el template de cargas sociales que vence después del cierre"), detalle: DET_DEUDAS }
        return { renglon: r, cierre: r2(-e.suss.monto), estado: `template «${e.suss.concepto}» que vence el ${dmy(e.suss.vencimiento)}`, detalle: DET_DEUDAS }
      }
      default:
        return enBlanco(tanda.startsWith("0") ? "ya hecho en su papel" : "en blanco")
    }
  })
}

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "—")
const num = (v: number | null | undefined) => (v == null ? "" : v)
const f = (formula: string, v: number) => ({ t: "n", f: formula, v: r2(v), z: MONEDA })

/** La hoja principal: un renglón del contador por fila, con su apertura y el cierre que da la app. */
export function hojaBalanceEnLinea(filas: FilaBalanceEnLinea[], fechaCierre: string): unknown[][] {
  const h: unknown[][] = [
    [`BALANCE EN LÍNEA — MSA · apertura (balance del contador al 30/06/2025) y cierre según la app al ${dmy(fechaCierre)}`],
    ["La apertura es un dato fijo. El cierre lo pone la app sólo donde tiene el dato (tanda «1 CLAUDE» y los ya hechos); el resto queda en blanco a propósito."],
    ["Signo del contador: activo positivo; pasivo, patrimonio y ganancias negativos."],
    [],
    ["Capítulo", "Cuenta", "Denominación", "Apertura (contador)", "Cierre (la app)", "Variación", "Tanda", "De dónde sale (JMS)", "Cómo quedó el cierre", "Detalle en", "Nota de JMS"],
  ]
  let capActual = "", desde = 0
  const cerrar = () => {
    if (!capActual) return
    const hasta = h.length
    const ap = filas.filter(x => x.renglon.capitulo === capActual).reduce((t, x) => t + x.renglon.hist, 0)
    h.push(["", "", `Total ${capActual} (apertura)`, f(`SUM(D${desde}:D${hasta})`, ap)])
    h.push([])
  }
  for (const x of filas) {
    if (x.renglon.capitulo !== capActual) { cerrar(); capActual = x.renglon.capitulo; desde = h.length + 1 }
    const n = h.length + 1
    h.push([x.renglon.capitulo, x.renglon.cuenta, x.renglon.denominacion, x.renglon.hist, num(x.cierre),
      x.cierre == null ? "" : f(`E${n}-D${n}`, x.cierre - x.renglon.hist),
      x.renglon.tanda, x.renglon.obs, x.estado, x.detalle ?? "", x.renglon.obsTanda])
  }
  cerrar()
  return h
}

/** Detalle: caja y bancos, con el control apertura + movimientos − cierre = 0. */
export function hojaCajaYBancos(e: EntradaBalanceEnLinea): unknown[][] {
  const h: unknown[][] = [["CAJA Y BANCOS — apertura del contador, movimientos cargados en la app y cierre"],
    ["Control = apertura + movimientos del ejercicio − saldo de la app al cierre: tiene que dar 0. Si no da, la apertura del contador y lo cargado en la app no coinciden."],
    []]
  if (!e.cadenas) { h.push(["⚠️ No se trajeron los papeles bancarios: armá el libro antes de bajar el set."]); return h }
  const ap = (c: string) => e.apertura.find(r => r.cuenta === c)?.hist ?? 0
  h.push(["Cuenta", "Apertura (contador)", "Primer movimiento", "Último movimiento", "Movimientos del ejercicio (neto)", "Cierre calculado", "Saldo de la app al cierre", "Control", "Nota"])
  // Caja: la apertura del contador es UNA; las cajas de la app se suman debajo.
  const cajaAp = ap("1.1.1/01/01")
  const d0 = h.length + 2
  h.push(["Caja (contador)", cajaAp, "", "", "", "", "", "", "la apertura del contador es una sola caja"])
  for (const n of CAJAS) {
    const c = cadena(e, n)
    h.push([`   ${n}`, "", c?.desde ? dmy(c.desde) : "", c?.hasta ? dmy(c.hasta) : "", c ? r2(c.netoCargado) : "", "", c?.saldoAlCierre ?? "",
      "", c?.desde ? `la app la arranca en ${fmt(c.saldoAntesDeLoCargado ?? 0)} (antes de su primer movimiento)` : "sin movimientos cargados en la app"])
  }
  const d1 = h.length
  const netoCajas = CAJAS.reduce((t, n) => t + (cadena(e, n)?.netoCargado ?? 0), 0)
  h.push(["Caja — cierre", "", "", "", f(`SUM(E${d0}:E${d1})`, netoCajas), f(`B${d0 - 1}+E${h.length + 1}`, cajaAp + netoCajas), "", "",
    "apertura del contador + lo que movieron las cajas en la app (no hay saldo único de la app para comparar)"])
  const cu = e.cajaUsd
  h.push(["Caja dólares", ap("1.1.1/01/03"), "", "", "", ap("1.1.1/01/03"), "", "", cu?.movimientos ? `${cu.movimientos} movimiento(s) en US$ por valuar` : "sin movimientos cargados en la app: queda la apertura"])
  for (const [cuenta, nombre] of Object.entries(BANCO_DE)) {
    const c = cadena(e, nombre), n = h.length + 1, a = ap(cuenta)
    if (!c || c.saldoAlCierre == null) { h.push([nombre, a, "", "", "", "", "", "", "sin movimientos del ejercicio cargados en la app"]); continue }
    h.push([nombre, a, dmy(c.desde), dmy(c.hasta), r2(c.netoCargado), f(`B${n}+E${n}`, a + c.netoCargado), r2(c.saldoAlCierre),
      f(`F${n}-G${n}`, a + c.netoCargado - c.saldoAlCierre), Math.abs(a + c.netoCargado - c.saldoAlCierre) < 0.01 ? "✓ cierra" : "⚠️ no cierra: revisar la apertura o lo cargado"])
  }
  const d = e.dolares
  h.push([])
  h.push(["CUENTA EN DÓLARES (US$)", "Apertura US$", "Primer movimiento", "Último movimiento", "Movimientos US$ (neto)", "Cierre calculado US$", "Saldo de la app al cierre US$", "Control US$", "En pesos"])
  if (!d) h.push(["⚠️ No se trajo la cuenta en dólares."])
  else {
    const n = h.length + 1
    h.push([d.cuenta, num(d.usdInicio), dmy(d.desde), dmy(d.hasta), r2(d.netoUsd), d.usdInicio == null ? "" : f(`B${n}+E${n}`, d.usdInicio + d.netoUsd), num(d.usdCierre),
      d.usdInicio == null || d.usdCierre == null ? "" : f(`F${n}-G${n}`, d.usdInicio + d.netoUsd - d.usdCierre),
      d.usdCierre != null && d.tcCierre != null ? `${fmt(d.usdCierre)} × ${fmt(d.tcCierre)} = ${fmt(r2(d.usdCierre * d.tcCierre))} (${d.fuenteTc}); apertura del contador $ ${fmt(ap("1.1.1/02/09"))}` : "falta el dólar al cierre"])
  }
  return h
}

/** Detalle: el FCI, con cuotapartes, precio y valorizado en las dos puntas. */
export function hojaFci(e: EntradaBalanceEnLinea): unknown[][] {
  const h: unknown[][] = [["FONDO COMÚN DE INVERSIÓN — FIMA Premium A (Galicia)"],
    ["Inicio y cierre: cuotapartes × valor de la cuotaparte (resúmenes del fondo). Movimientos: lo que entró y salió de la cuenta Galicia por el fondo."],
    ["Resultado = cierre − (inicio + suscripciones − rescates): es lo que rindió el fondo."], []]
  const x = e.fci
  if (!x) { h.push(["⚠️ No se trajo el FCI."]); return h }
  const apertura = e.apertura.find(r => r.cuenta === "1.1.1/02/06")?.hist ?? 0
  h.push(["", "Cuotapartes", "Valor de la cuotaparte", "Valorizado", "Fuente"])
  const n1 = h.length + 1
  h.push(["Inicio (30/06/2025)", num(x.cuotasInicio), num(x.valorInicio), x.cuotasInicio != null && x.valorInicio != null ? f(`B${n1}*C${n1}`, x.cuotasInicio * x.valorInicio) : "", x.notaInicio])
  h.push(["   apertura del contador", "", "", apertura, "el valorizado del inicio tiene que dar esto"])
  const b = x.banco
  const n3 = h.length + 1
  h.push(["Suscripciones del ejercicio (banco)", "", "", b ? b.suscripciones : "", b ? `${b.movimientos} movimiento(s) del extracto Galicia` : "no se trajeron los movimientos del banco"])
  h.push(["Rescates del ejercicio (banco)", "", "", b ? b.rescates : "", ""])
  const n5 = h.length + 1
  h.push([`Cierre (${dmy(e.fechaCierre)})`, num(x.cuotasCierre), num(x.valorCierre), x.cuotasCierre != null && x.valorCierre != null ? f(`B${n5}*C${n5}`, x.cuotasCierre * x.valorCierre) : "", x.notaCierre])
  if (b && x.cuotasCierre != null && x.valorCierre != null) {
    const cierre = x.cuotasCierre * x.valorCierre
    h.push(["Resultado del fondo (deducido)", "", "", f(`D${n5}-(D${n1 + 1}+D${n3}-D${n3 + 1})`, cierre - (apertura + b.suscripciones - b.rescates)),
      "⚠️ el 04/08/2025 el banco tiene $ 45.431.590,72 como «Rescate Fima» que no está en los resúmenes del fondo (es la venta de US$ 34.000): si queda adentro, el resultado lo incluye. Pregunta 10 de la página de preguntas."])
  }
  return h
}

/** Detalle: los renglones que salen de los papeles 04 y de la tarjeta y el SUSS. */
export function hojaDeudasYCreditos(e: EntradaBalanceEnLinea): unknown[][] {
  const h: unknown[][] = [["DEUDAS Y CRÉDITOS AL CIERRE — de dónde sale cada renglón"], [], ["Renglón del contador", "Importe al cierre", "De dónde sale", "Detalle"]]
  const fila = (r: string, v: number | null | undefined, de: string, det: string) => h.push([r, v == null ? "" : r2(v), de, det])
  fila("Cheques pend. de débito", e.cheques ? e.cheques.total : null, "papel 04.1 Cheques dados", e.cheques ? `${e.cheques.cantidad} cheque(s)` : "no se trajo")
  fila("Anticipos a Proveedores", e.anticipos ? e.anticipos.total : null, "papel 04.2 Anticipos", e.anticipos ? `${e.anticipos.cantidad} anticipo(s) sin facturar al 30/06` : "no se trajo")
  fila("Proveedores en Cta.Cte.", e.proveedores ? e.proveedores.facturas + e.proveedores.cuentasCorrientes : null, "papel 04 Cuentas a pagar",
    e.proveedores ? `facturas ${fmt(e.proveedores.facturas)} + cuentas corrientes ${fmt(e.proveedores.cuentasCorrientes)}` : "no se trajo")
  fila("Provision para gastos", e.provision ? e.provision.total : null, "papel 05 Provisión", e.provision ? `${e.provision.cantidad} comprobante(s)` : "no se trajo")
  fila("TARJETA VISA BUSSINES GALICIA", e.tarjeta ? e.tarjeta.deuda : null, "resúmenes de la tarjeta Visa MSA", e.tarjeta ? [e.tarjeta.detalle, e.tarjeta.falta].filter(Boolean).join(" · ") : "no se trajo")
  fila("SUSS a pagar", e.suss ? e.suss.monto : null, "template de cargas sociales que vence el mes siguiente al cierre",
    e.suss ? `«${e.suss.concepto}» vence ${dmy(e.suss.vencimiento)} · estado ${e.suss.estado}` : "no se encontró")
  return h
}

/** Detalle: la soja, sólo el inicio en cantidad (JMS). */
export function hojaSoja(e: EntradaBalanceEnLinea): unknown[][] {
  const ap = e.apertura.find(r => r.cuenta === "1.1.5/02/00")?.hist ?? 0
  return [["SOJA — stock al inicio (JMS: «completá sólo el inicio como stock de cantidad»)"], [],
    ["", "Toneladas", "Apertura del contador ($)", "Nota"],
    ["Inicio (30/06/2025)", e.soja?.tnInicio ?? "", ap, e.soja?.nota ?? "no se trajo el stock de granos"]]
}

/** Detalle: vacas de cría por categoría — inicio cantidad (y peso); cierre cantidad, peso y precio de cierre. */
export function hojaVacasDeCria(e: EntradaBalanceEnLinea): unknown[][] {
  const h: unknown[][] = [["VACAS DE CRÍA — hacienda por categoría"],
    ["Inicio: cabezas de tu planilla de campo al 30/06/2025 (el peso por categoría al inicio lo completás vos). Cierre: cabezas de la app al cierre, peso de las pesadas y precio de cierre."], []]
  const x = e.hacienda
  if (!x) { h.push(["⚠️ No se trajo la hacienda: «⚡ Armar todo» antes de bajar el set."]); return h }
  h.push(["Categoría", "Inicio: cabezas", "Inicio: kg promedio", "Cierre: cabezas", "Cierre: kg promedio", "Cierre: $ por cabeza", "Cierre: valor", "De dónde sale el precio"])
  const d = h.length + 1
  for (const c of CATEGORIAS_PLANILLA) {
    const fs = x.valuacion.filas.filter(v => c.app.includes(v.categoria))
    const cab = fs.reduce((t, v) => t + v.cabezas, 0)
    const conPeso = fs.filter(v => v.pesoKg != null)
    const cabKg = conPeso.reduce((t, v) => t + v.cabezas, 0)
    const valor = fs.reduce((t, v) => t + (v.valorTotal ?? 0), 0)
    const ini = x.inicio?.filas.find(v => v.clave === c.clave)
    const n = h.length + 1
    h.push([c.nombre, ini?.campo ?? "", "", cab, cabKg ? Math.round(conPeso.reduce((t, v) => t + (v.pesoKg ?? 0) * v.cabezas, 0) / cabKg) : "",
      cab ? r2(valor / cab) : "", fs.some(v => v.valorTotal != null) ? f(`D${n}*F${n}`, valor) : "",
      [...new Set(fs.map(v => v.origenPrecio))].join(" / ") || (cab ? "" : "sin cabezas al cierre")])
  }
  const hasta = h.length
  h.push(["TOTAL", f(`SUM(B${d}:B${hasta})`, x.inicio?.total.campo ?? 0), "", f(`SUM(D${d}:D${hasta})`, x.valuacion.cabezas), "", "",
    f(`SUM(G${d}:G${hasta})`, x.valuacion.valuado), x.valuacion.huecos.length ? `⚠️ ${x.valuacion.cabezasSinValuar} cabeza(s) sin precio` : ""])
  return h
}
