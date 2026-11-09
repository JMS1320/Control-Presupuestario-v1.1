/**
 * 📗 EL EXCEL DE LOS PAPELES DE TRABAJO — A-FEAT-1184.
 *
 * Arma el archivo que se le manda al contador. **Una solapa por papel**, como el usuario los venía
 * mandando a mano, para que del otro lado no haya que aprender nada nuevo.
 *
 * ## 🧮 La primera solapa es el CONTROL, y eso es a propósito
 *
 * No es un anexo al final: es **lo primero que se abre**. Si el libro no se puede entregar, hay que
 * enterarse antes de mirar ningún número, no después de mandarlo (§ 🧮 de `CLAUDE.md`: *el control
 * se ve, y es proporcional*).
 *
 * ## ⚠️ Y el archivo SALE IGUAL aunque el control no cierre
 *
 * Instrucción explícita del usuario (2026-09-28): *«sería bueno que el export se termine y dé la
 * info. que estará mal hasta que yo después no corrija algunos datos como ya vimos»*. Entonces el
 * export **nunca se niega a generar**: lo que hace es **decir en la cara** qué está mal y por qué
 * ese número no se puede entregar todavía. Frenar la generación le sacaría la herramienta justo
 * cuando la necesita para encontrar el problema.
 */
// 🎨 `xlsx-js-style` (misma API) para que el Excel guarde negrita y colores — ver `presentarHoja`.
// Import por DEFAULT: el paquete es CommonJS (ver lib/presupuesto/export.ts).
import { hojaOperacionesEnDolares } from "./operaciones-en-dolares"
import XLSX from "xlsx-js-style"
import { hojaRetirosYAportes, hojaInconsistencias } from "./auditoria-templates"
import type { SaldoParaBalance } from "@/lib/dolares/posicion-cierre"
import type { TenenciaFci } from "./balance-en-linea-lectura"
import { celdaRespaldo, respaldoDeSaldo, respaldoDeFci, respaldoDeComprobante, hojaDeRespaldos, renglonesDeRespaldo, linksALasCopias, type DocumentoRespaldo } from "./respaldos"
import { lecturaIncompleta, type Lectura } from "@/lib/supabase-paginado"
import { ETIQUETA_CONCEPTO, type ImpuestoCheque } from "./impuesto-cheque"
import { controlarCheque, chequeEnPapel08, chequeEnTemplates, type ControlCheque } from "./control-cheque"
import type { LibroDiario, AsientoLibroDiario } from "./libro-diario"
import { armarEjercicio, nombreSubdiario, primerDiaDelEjercicio, type Ejercicio } from "./ejercicio"
import { explicarFila } from "./facturas-fijas"
import { armarLibroPorCuenta, TIPOS_SIN_CREDITO_VENTAS, SIN_IMPUTAR, type LibroPorCuenta } from "./libro-por-cuenta"
import type { Descuadre } from "@/lib/subdiarios/cuadratura"
import type { CuentasAlCierre, FilaCuenta } from "./cuentas-al-cierre"
import type { CadenaDeSaldos } from "./saldos-al-inicio"
import type { SueldosDelEjercicio, FilaSueldo, SueldosImpagosAlCierre } from "./sueldos-balance"
import { leyendaSaldo } from "@/lib/proveedores/cuenta-corriente"
import { separarSocios, CUENTA_FACTURAS, type PapelDeCuentasCorrientes, type CuentaCorrienteDelBalance } from "./cuentas-corrientes"
import type {
  ChequesDados, ChequeAlCierre, AnticiposAlCierre, AnticipoAlCierre,
} from "./valores-al-cierre"
import type { CuadreHacienda } from "./cuadre-hacienda"
import { agregarSaldosHacienda, agregarSaldosProductivos, hojaStockInicio, conLink, type SaldosParaExcel } from "./saldos-excel"
import type { RenglonStockInicio, Pastura } from "./stock-inicio"
import type { FuentePrecio } from "./precio-al-cierre"
import type { CuentasSinCuentaCorriente } from "./fuera-por-cuenta-corriente"
import { armarIndice, type IndiceDelBalance, type EstadoParte, type DatosDelIndice } from "./indice-papeles"
import { hojaDePendientes, type PendienteBalance } from "./pendientes-balance"
import { armarStocksUnificados, hojaDeStocks } from "./stocks-unificado"
import { solapasPapelesH, type DatosPapelesH } from "./papeles-impuestos-h"
import { DETALLES, hojaDetalleHacienda, hojaStockHacienda, hojaStockValorizado, hojaPreciosTomados, hojaCalculoKilos, hojaAumentoRodeo, type MovimientoPapel } from "./stock-hacienda-papel"
import type { PesoCategoria } from "./pesos-hacienda"
import { APERTURA_MSA_2025 } from "./apertura-contador"
type TablasPreciosPapel = { mag: PrecioMag[]; hembra: PrecioMercado[]; macho: PrecioMercado[]; vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
import type { HojaConEstilo } from "@/lib/impuestos/papel-formato-jms"
import { hojaLibertad } from "./libertad"
import { armarGruposTemplates, cuotaSinPago, armarHojaGrupo, gruposDelResponsable, hojaExtractoSinCategoria, hojaGrupo, hojaIndiceGrupos, hojaLib, nombreSolapaGrupo, SIN_GRUPO, type GrupoTemplates, type MovimientoLib } from "./grupos-templates"
import { sinCategoriaNiVinculo, type MovimientoExtractoH } from "./movimientos-de-cuotas"
import { filasBalanceEnLinea, hojaBalanceEnLinea, hojaCajaYBancos, hojaFci, hojaDeudasYCreditos, hojaSoja, hojaVacasDeCria, type EntradaBalanceEnLinea } from "./balance-en-linea"
import { LIBROS, repartirEnLibros, templatesDeResponsable, responsablePrincipal, hojaListadoTemplates, hojaDeDetalle, type GrupoDetalle, type MovimientoDelDetalle } from "./libros-del-balance"
import { hojaDelRecorrido, sincronizarPendientes, type RecorridoParaExcel } from "./recorrido-excel"
import { hojaDeSaldosAnteriores, type SaldosAnteriores } from "./ajustes-balance"
import {
  TOTALIZADORAS_BANCARIAS,
  type GastosBancarios, type FilaConceptoPorMes, type RetirosYAportes, type FondoComun,
} from "./papeles-bancarios"
import { ORDEN_TIPOS, NOMBRE_TIPO, SIN_AGRUPADORA, partirEnImpuestosYOtros, armarTemplatesDelEjercicio, type TemplatesDelEjercicio, type CuotaTemplate, type TipoTemplate } from "./templates-libro"
import type { ValuacionHacienda, PrecioMag, PrecioMercado, PrecioCabeza } from "./hacienda-stock"
import { resumenControlCuotas, conProblema, type ControlCuotasTemplates } from "./control-cuotas-templates"
import { PAPELES_SIN_ORIGEN, type StockInsumos } from "./stock-insumos"
import type { CuadreGranos, ValuacionGranos, Sementeras } from "./granos-sementeras"
import {
  formatearHoja, presentarHoja, anchosAutomaticos, colorDeSolapa, aplicarVistas, filtroDe, filtrarEn,
  conFormula, MONEDA, ENTERO, TONELADAS, COEFICIENTE, type Columna, type Vista, UNIONES, ALTOS, esSinCongelar, congeladoDe, nivelesDelResumen, columnasCongeladasDe } from "./formato-excel"
import { ESPERA_ANTES_DE_LIBERAR_MS } from "@/lib/descargar-archivo"
import type { ControlesInicio, ControlProvisionAnterior } from "./control-inicio"
import { textoEstado, type InicioYCierre } from "./inicio-y-cierre"
import { armarCobertura, ICONO, TEXTO_ESTADO, type CoberturaPapeles, type EstadoCobertura } from "./cobertura-papeles"
import { fechasReales } from "@/lib/excel/fechas-reales"

const money = (n: number) => Math.round(n * 100) / 100
/** 📗 A-FEAT-1539: AAAA-MM-DD → DD/MM/AAAA. */
const dmy = (f: string | null | undefined) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const r2 = money

/**
 * 🛑 Un renglón con ERROR (las partes del comprobante no suman su propio total): fondo rojo suave y letra roja.
 * Usuario 27/10: *«que quede marcado el error en subplanilla y detalle… dejalo a la vista con la marca de los
 * renglones que dan error»*. No se corrige ningún dato: se marca, para que se vea dónde está.
 */
export const ESTILO_ERROR = {
  font: { color: { rgb: "FFA12B2B" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFFBE4E4" } },
}
const fmtAr = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** El texto de la marca: cuánto suman las partes y cuánto falta (o sobra) para el total. */
export const marcaDescuadre = (d: Descuadre) =>
  `NO CUADRA: las partes suman ${fmtAr(d.suma_partes)} y el total es ${fmtAr(d.imp_total)} — ${d.diferencia > 0 ? "faltan" : "sobran"} ${fmtAr(Math.abs(d.diferencia))}`

/**
 * Cabecera + filas de un listado de asientos. Misma forma para compras, ventas y provisiones.
 * @param descuadres  los del Control (el MISMO criterio, `verificarCuadratura`): si vienen, se agrega la columna
 *                    «Control de partes» y los renglones con error van en rojo con su marca.
 */
export function hojaDeAsientos(asientos: AsientoLibroDiario[], descuadres?: Descuadre[]): unknown[][] {
  const malos = new Map((descuadres ?? []).filter(d => d.id).map(d => [d.id!, d]))
  const conCantidades = asientos.some(a => a.cantidades && (a.cantidades.producto || a.cantidades.toneladas || a.cantidades.cabezas || a.cantidades.kilos))
  const filas: unknown[][] = [[
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    // 🧾 A-BUG-1534 (JMS 03/11): con la MISMA regla del Libro Diario consensuado — la factura C (tipo 11) va entera a
    // «Monotributo» (no gravado y exento en 0) y «Dif. de algo más» = total − partes. Sin esto, $ 43 M de facturas C quedaban
    // en «No gravado» y $ 26 M en ninguna columna, y el total no cerraba contra sus partes.
    "Neto Gravado", "No Gravado", "Exentas", "Monotributo", "Otros Tributos", "IVA", "Total", "Dif. de algo más",
    "Cuenta contable", "Nro cuenta", "Centro de costo", "Origen del dato",
    // 💵 A-BUG-1316: los importes van en pesos; la moneda y la cotización quedan a la vista al final
    // (al final y no al lado del Total, para no correr las columnas que suman otras solapas).
    "Moneda", "Tipo de cambio", "Total en moneda original",
    // 🌾 U2: qué se vendió y cuánto — sólo si alguna fila lo trae (ventas).
    ...(conCantidades ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : []),
    ...(descuadres ? ["Control de partes"] : []),
  ]]
  // 📅 JMS 03/11: «lo que exporté de la app no está ordenado por fecha, por lo menos ventas… como ordena ARCA, el cálculo debe ser
  // por fecha; nosotros lo ponemos también por fecha y debería quedar igual». Subdiario → fecha → tipo → punto de venta → número.
  const orden = [...asientos].sort((x, y) => (x.subdiario || "").localeCompare(y.subdiario || "") || (x.fecha || "").localeCompare(y.fecha || "")
    || (x.tipo ?? 0) - (y.tipo ?? 0) || (x.punto_venta ?? 0) - (y.punto_venta ?? 0) || (x.numero ?? 0) - (y.numero ?? 0))
  for (const a of orden) {
    const enOtraMoneda = !!a.moneda && a.moneda !== "PES"
    const es11 = a.tipo === 11
    const noGrav = es11 ? 0 : a.no_gravado, exento = es11 ? 0 : a.exento, mono = es11 ? a.total : 0
    const difPartes = Math.round((a.total - (a.neto_gravado + noGrav + exento + mono + a.otros_tributos + a.iva)) * 100) / 100
    const fila: unknown[] = [
      a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
      a.cuit, a.denominacion,
      money(a.neto_gravado), money(noGrav), money(exento), money(mono),
      money(a.otros_tributos), money(a.iva), money(a.total), money(difPartes),
      a.cuenta_contable, a.nro_cuenta, a.centro_costo,
      a.fuente === "historico" ? "sistema anterior" : a.fuente === "arca" ? "ARCA" : "ventas",
      enOtraMoneda ? (a.moneda === "DOL" ? "USD" : a.moneda) : "$",
      enOtraMoneda ? a.tipo_cambio ?? "" : "",
      enOtraMoneda ? money(a.total_moneda_original ?? 0) : "",
    ]
    if (conCantidades) {
      const q = a.cantidades
      fila.push(q?.producto ?? "", q?.toneladas ?? "", q?.cabezas ?? "", q?.kilos ?? "")
    }
    const d = malos.get(a.id)
    if (descuadres) fila.push(d ? marcaDescuadre(d) : "")
    filas.push(d ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  return filas
}

/**
 * ➕ JMS 29/10 (A-FEAT-1422 notas 1-2): «agregar totales para controles» en Compras y Ventas. Un renglón
 * TOTAL al pie, separado por uno vacío (así el filtro no lo agarra), con **SUBTOTAL(9, …)**: suma sólo lo que
 * queda a la vista cuando se filtra — filtrás un proveedor o un mes y el total es el de ese filtro.
 */
export function conTotalAlPie(filas: unknown[][]): unknown[][] {
  if (filas.length < 2) return filas
  const titulos = (filas[0] as unknown[]).map(String)
  const SUMAN = ["Neto Gravado", "No Gravado", "Exentas", "Monotributo", "Otros Tributos", "IVA", "Total", "Dif. de algo más", "Toneladas", "Cabezas", "Kilos"]
  const n = filas.length          // la última fila de datos, en la numeración de Excel (encabezado = 1)
  const total: unknown[] = titulos.map(() => "")
  total[0] = "TOTAL"
  titulos.forEach((t, c) => {
    if (!SUMAN.includes(t)) return
    const col = XLSX.utils.encode_col(c)
    const suma = filas.slice(1).reduce((s: number, f) => {
      const v = (f as unknown[])[c]
      const x = v && typeof v === "object" && "v" in (v as object) ? (v as { v: unknown }).v : v
      return s + (typeof x === "number" ? x : 0)
    }, 0)
    total[c] = conFormula(`SUBTOTAL(9,${col}2:${col}${n})`, money(suma), t === "Toneladas" || t === "Kilos" || t === "Cabezas" ? "#,##0.00" : MONEDA)
  })
  return [...filas, [], total]
}

/**
 * 🧾 Papel 05 — PROVISIÓN DE FACTURAS (A-FEAT-1331). Arriba la de ESTE ejercicio (la que suma a su
 * gasto), con cómo entró cada una: por la regla (fecha del ejercicio, subdiario posterior) o puesta a
 * mano con su motivo. Abajo la del ejercicio ANTERIOR, **sólo informativa** — no se resta: *«el
 * contador lo maneja»* (usuario 2026-10-23).
 */
/**
 * ➕ La fila TOTAL de una tabla de comprobantes (`hojaDeAsientos`): «TOTAL» en G y la suma de H a O (neto gravado … dif. de
 * algo más), con fórmula. JMS 06/11: en la 05 «falta totales»; en la 03.1 «el total no está sumando» (sumaba sólo la M).
 * `filas` = las filas de detalle tal como quedaron (sin el encabezado); `desde`/`hasta` = sus filas de Excel.
 */
export function filaTotalComprobantes(filas: unknown[][], desde: number, hasta: number): unknown[] {
  const fila: unknown[] = ["", "", "", "", "", "", "TOTAL"]
  for (let c = 7; c <= 14; c++) {
    const letra = String.fromCharCode(65 + c)
    const v = filas.reduce((t, r) => { const x = r[c] as unknown; const n = typeof x === "number" ? x : Number((x as { v?: unknown })?.v); return t + (Number.isFinite(n) ? n : 0) }, 0)
    fila.push(conFormula(`SUM(${letra}${desde}:${letra}${hasta})`, money(v)))
  }
  return fila
}

function hojaDeProvision(este: AsientoLibroDiario[], anterior: AsientoLibroDiario[], etiqueta: string, etiquetaAnterior: string, control?: ControlProvisionAnterior): unknown[][] {
  const conMotivo = (lista: AsientoLibroDiario[]) => {
    const t = hojaDeAsientos(lista)
    t[0] = [...t[0], "Cómo entró a provisión", "Motivo", "Respaldo"]
    lista.forEach((a, i) => {
      t[i + 1] = [...t[i + 1],
        a.provision_motivo ? "puesta a mano" : `fecha del ejercicio, subdiario ${a.subdiario || "—"}`,
        a.provision_motivo ?? "",
        celdaRespaldo(respaldoDeComprobante(a))]   // 📎 A-FEAT-1571: la factura que lo prueba
    })
    return t
  }
  const total = (l: AsientoLibroDiario[]) => money(l.reduce((s, a) => s + a.total, 0))
  const f: unknown[][] = []
  /** La tabla con su TOTAL abajo (JMS 06/11: «falta totales»). */
  const tablaConTotal = (lista: AsientoLibroDiario[]) => {
    const t = conMotivo(lista)
    f.push(t[0])
    const desde = f.length + 1
    t.slice(1).forEach(r => f.push(r))
    if (lista.length) f.push(filaTotalComprobantes(t.slice(1), desde, f.length))
  }
  f.push([`PROVISIÓN DE FACTURAS — ejercicio ${etiqueta} (suman al gasto de este ejercicio)`])
  f.push([`${este.length} comprobante(s) · total ${total(este).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`])
  tablaConTotal(este)
  f.push([])
  f.push([`PROVISIÓN DEL EJERCICIO ANTERIOR — ${etiquetaAnterior} (sólo informativa: NO se resta)`])
  f.push([`${anterior.length} comprobante(s) · total ${total(anterior).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`])
  tablaConTotal(anterior)
  // 🔁 A-FEAT-1427: lo que el balance anterior dejó provisionado contra lo que la app reconoce.
  if (control) {
    f.push([])
    f.push([`CONTROL CONTRA EL BALANCE ANTERIOR — provisión al cierre de ${etiquetaAnterior}`])
    f.push(["Según el balance anterior", control.declarado != null ? money(control.declarado) : "sin dato", control.fuenteDeclarado])
    f.push(["Reconocido por la app (la lista de arriba)", money(control.reconocido)])
    if (control.estado === "cierra") f.push(["Diferencia", money(control.diferencia ?? 0), "✓ cierra"])
    else if (control.estado === "sin foto") f.push(conEstilo(["⚠️ No se puede controlar: " + control.fuenteDeclarado], ESTILO_ERROR))
    else {
      f.push(conEstilo(["Diferencia", money(control.diferencia ?? 0),
        "⚠️ NO CIERRA: lo provisionado el año pasado no está reconocido. Si esos comprobantes están en las compras de este ejercicio, su gasto se cuenta dos veces."], ESTILO_ERROR))
      if (control.candidatos.length) {
        f.push(["Comprobantes de ESTE ejercicio que explican la diferencia (¿son los provisionados?):"])
        f.push(["Fecha", "Comprobante", "Proveedor", "Total", "Subdiario"])
        for (const a of control.candidatos) f.push([a.fecha ?? "", `${a.tipo ?? ""}-${a.punto_venta ?? ""}-${a.numero ?? ""}`, a.denominacion, money(a.total), a.subdiario])
        f.push(["Qué hacer: si son los provisionados, marcarlos como provisión del ejercicio anterior (y avisar al contador que salen del gasto de este)."])
      } else f.push(["No se encontró un comprobante (ni dos) de este ejercicio que explique la diferencia."])
    }
  }
  return f
}
/**
 * 🧮 ¿LLEGÓ TODO DE LA BASE? (A-FEAT-1343) — por cada consulta, cuántas filas dijo la base y cuántas
 * se usaron. Es integridad: si no coinciden, el papel se armó con datos de menos (§ 🚦: frena).
 */
export function bloqueDeLecturas(lecturas: Lectura[] | undefined): unknown[][] {
  if (!lecturas || lecturas.length === 0) return []
  const mal = lecturas.filter(lecturaIncompleta)
  const f: unknown[][] = []
  f.push([mal.length === 0
    ? `¿LLEGÓ TODO DE LA BASE? — sí: ${lecturas.length} consultas, todas completas`
    : `¿LLEGÓ TODO DE LA BASE? — NO: ${mal.length} consulta(s) llegaron incompletas`])
  f.push(["Consulta", "En la base", "Llegaron", ""])
  for (const l of lecturas) {
    f.push([l.nombre, l.esperadas ?? "sin dato", l.llegaron,
      l.esperadas == null ? "sin dato" : lecturaIncompleta(l) ? "NO CUADRA" : "cuadra"])
  }
  f.push([])
  return f
}


/**
 * 🗂️ La cobertura con los MISMOS datos del Excel (los argumentos de `armarWorkbook`). La usan el Excel y el recorrido
 * del balance (A-FEAT-1430): una sola cuenta, para que lo que se recorre y lo que se baja no puedan diferir.
 */
export function coberturaDeArgs(...a: Parameters<typeof armarWorkbook>): CoberturaPapeles {
  const [libro, , templates, hacienda, insumos, campo, cuentas, bancarios, , , , saldosAnteriores, , , , controlesInicio] = a
  return armarCobertura({
    libro, fechaInicio: primerDiaDelEjercicio(libro.ejercicio), templates,
    hacienda: hacienda ? { valuacion: hacienda.valuacion, cuadre: hacienda.cuadre, stockInicio: hacienda.stockInicio } : null,
    insumos, campo: campo ? { granos: campo.granos, sementeras: campo.sementeras } : null,
    cuentas, bancarios, saldosAnteriores, controlesInicio, hechos: controlesInicio?.hechos,
  })
}

/**
 * 🗂️ A-FEAT-1427: cada dato de los papeles del año pasado y qué hace hoy el export con él. Los que necesitan algo van
 * arriba, agrupados por qué les falta; lo que sale, abajo.
 */
function hojaDeCobertura(c: CoberturaPapeles, etiqueta: string): unknown[][] {
  const ORDEN: EstadoCobertura[] = ["error", "falta inicio", "sin informacion", "pendiente desarrollo", "decision", "sale", "no corresponde"]
  const f: unknown[][] = []
  f.push([`COBERTURA — ¿el export ${etiqueta} responde cada dato de los papeles del año pasado?`])
  f.push([ORDEN.filter(e => c.cuenta[e]).map(e => `${ICONO[e]} ${TEXTO_ESTADO[e]}: ${c.cuenta[e]}`).join(" · ")])
  f.push(["El estado se recalcula cada vez con los datos de la app: cuando se cargue lo que falta o se desarrolle la pieza, cambia solo."])
  f.push([])
  f.push(["Estado", "Papel del año pasado", "Dato", "Valor 24/25", "Qué pasa hoy", "Dónde sale", "Pendiente"])
  for (const e of ORDEN) {
    for (const i of c.items.filter(x => x.estado === e)) {
      const fila = [`${ICONO[e]} ${TEXTO_ESTADO[e]}`, i.papel, i.dato, i.valor2425, i.detalle, i.solapa, i.pendiente ?? ""]
      f.push(e === "error" ? conEstilo(fila, ESTILO_ERROR) : fila)
    }
  }
  return f
}

/** 📋 A-FEAT-1427: cada renglón del balance, inicio (foto del balance anterior) contra cierre (la app). */
function hojaInicioYCierre(ic: InicioYCierre, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`INICIO Y CIERRE DE CADA RENGLÓN — ejercicio ${etiqueta}`])
  f.push([ic.hayFotoInicio
    ? "Inicio = foto del Balance propio al cierre anterior (contador = lo presentado · JMS = tu registro). Cierre = lo que calcula la app desde los papeles."
    : "⚠️ No hay foto del balance anterior: ningún saldo de inicio se puede mostrar."])
  f.push([`Con los dos: ${ic.cuenta["los dos"]} · falta el cierre: ${ic.cuenta["falta el cierre"]} · falta el inicio: ${ic.cuenta["falta el inicio"]} · sin datos: ${ic.cuenta["sin datos"]}`])
  f.push([])
  f.push(["Rubro", "Renglón", "Inicio (contador)", "Inicio (JMS)", "Cierre (app)", "Estado", "De dónde sale el cierre"])
  let rubro = ""
  for (const x of ic.filas) {
    const fila = [x.rubro === rubro ? "" : x.rubro, x.etiqueta,
      x.inicioContador == null ? "" : money(x.inicioContador), x.inicioJms == null ? "" : money(x.inicioJms),
      x.cierre == null ? "" : money(x.cierre), textoEstado(x), x.detalleCierre]
    rubro = x.rubro
    f.push(x.estado === "falta el cierre" ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  if (ic.faltan.length) {
    f.push([])
    f.push(["⚠️ LO QUE EL CÁLCULO DE CIERRE NO PUDO SABER"])
    ic.faltan.forEach(x => f.push(["", x]))
  }
  return f
}

/** La solapa que se abre primero: qué se puede entregar y qué no. */
function hojaDeControl(libro: LibroDiario, lecturas?: Lectura[]): unknown[][] {
  const { controles: c, ejercicio: ej } = libro
  const f: unknown[][] = []

  f.push([`PAPELES DE TRABAJO — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Los 12 subdiarios: ${nombreSubdiario(ej.subdiarios[0])} a ${nombreSubdiario(ej.subdiarios[11])}`])
  f.push([])
  f.push(["El período NO se corta por la fecha de las facturas, sino por el subdiario en el que entraron."])
  f.push([])
  f.push(...bloqueDeLecturas(lecturas))

  f.push([c.sePuedeEntregar ? "CONTROL OK — se puede entregar" : "NO SE PUEDE ENTREGAR TODAVÍA"])
  if (!c.sePuedeEntregar) {
    f.push(["Motivo(s):"])
    c.motivos.forEach(m => f.push(["", m]))
    f.push([])
    f.push(["El archivo se genera igual, para que se pueda ver dónde está el problema."])
  }
  f.push([])

  f.push(["TOTALES POR MASA", "Comprobantes", "Total"])
  f.push(["Compras del ejercicio", c.compras.cantidad, money(c.compras.totalGeneral)])
  f.push(["Ventas del ejercicio", c.ventas.cantidad, money(c.ventas.totalGeneral)])
  f.push([])
  f.push(["Este es el número que tiene que coincidir con el del contador. La conformación (cómo"])
  f.push(["reagrupa cada cuenta) puede diferir legítimamente y no se controla."])
  f.push([])

  f.push(["APERTURA DE COMPRAS", "Importe"])
  f.push(["Neto gravado", money(c.compras.netoGravado)])
  f.push(["Exento / No gravado", money(c.compras.exentoNoGravado)])
  f.push(["IVA", money(c.compras.iva)])
  f.push(["Otros tributos", money(c.compras.otrosTributos)])
  f.push(["Sin crédito fiscal (Fac B y C)", money(c.compras.sinCredito)])
  f.push(["Diferencia contra el total", money(c.compras.diferencia),
    c.compras.ok ? (c.compras.soloRedondeo ? "cuadra, con residuo de redondeo" : "cuadra") : "NO CUADRA"])
  f.push([])

  // 🧾 Segundo camino: cada subdiario de compras contra lo presentado a ARCA (A-DAT-61).
  if (c.contraPresentado) {
    const mal = c.contraPresentado.filter(x => !x.ok).length
    f.push([mal === 0
      ? "COMPRAS vs. LO PRESENTADO A ARCA — los 12 subdiarios coinciden"
      : `COMPRAS vs. LO PRESENTADO A ARCA — ${mal} subdiario(s) NO coinciden`])
    f.push(["Subdiario", "App: comprobantes", "App: total", "Presentado: comprobantes", "Presentado: total", "Diferencia", ""])
    for (const x of c.contraPresentado) {
      f.push([x.subdiario, x.app.comprobantes, money(x.app.total),
        x.presentado?.comprobantes ?? "sin dato", x.presentado ? money(x.presentado.total) : "sin dato",
        money(x.diferenciaTotal), x.ok ? "coincide" : "NO COINCIDE"])
    }
    f.push([])
  } else {
    f.push(["COMPRAS vs. LO PRESENTADO A ARCA — no hay dato de lo presentado para esta empresa: no se controló."])
    f.push([])
  }
  // 🔢 Proveedores fijos (A-FEAT-1332): aviso, no frena.
  if (c.facturasFijas && c.facturasFijas.length > 0) {
    const mal = c.facturasFijas.filter(x => !x.ok).length
    f.push([mal === 0
      ? `PROVEEDORES FIJOS — están todas las facturas (${c.facturasFijas[0].mesesContados} meses contados)`
      : `PROVEEDORES FIJOS — ${mal} no tienen la cantidad esperada (aviso, no frena; ${c.facturasFijas[0].mesesContados} meses contados)`])
    f.push(["Proveedor", "CUIT", "Por mes", "Esperadas", "Hay", "Carga", "Detalle"])
    for (const x of c.facturasFijas) {
      f.push([x.nombre, x.cuit, x.facturasPorMes, x.esperado, x.hay, x.aMano ? "a mano" : "ARCA",
        x.ok ? "coincide" : explicarFila(x)])
    }
    f.push([])
  }
  if (libro.historicoSuperado.length > 0) {
    f.push([`Sistema anterior: ${libro.historicoSuperado.length} comprobante(s) con subdiario posterior a noviembre 2025 NO se cuentan`
      + " — para esos meses manda la app. Siguen guardados en el histórico."])
    f.push([])
  }

  if (c.subdiariosDuplicados.length > 0) {
    const nombreFuente = (x: string) =>
      x === "historico" ? "sistema anterior" : x === "arca" ? "ARCA" : x

    f.push(["SUBDIARIOS CARGADOS EN MÁS DE UNA FUENTE — sumarlos contaría doble"])
    f.push(["Subdiario", "Fuente", "Comprobantes", "Total", "Diferencia"])
    for (const d of c.subdiariosDuplicados) {
      d.porFuente.forEach((p, i) => f.push([
        i === 0 ? d.subdiario : "", nombreFuente(p.fuente),
        p.comprobantes, money(p.total), i === 0 ? money(d.diferencia) : "",
      ]))

      // 🔑 Lo que de verdad deja DECIDIR: si una fuente contiene a la otra, la elección es obvia.
      f.push(["", `${d.enComun} comprobante(s) están en las dos: son el mismo cargado dos veces.`])
      if (d.soloEn.length === 0) {
        f.push(["", "Ninguna fuente tiene nada que la otra no tenga: son idénticas, quedate con una."])
      } else if (d.soloEn.length === 1) {
        const u = d.soloEn[0]
        f.push(["", `Sólo «${nombreFuente(u.fuente)}» tiene ${u.asientos.length} comprobante(s) que la otra no.`])
        f.push(["", `Entonces «${nombreFuente(u.fuente)}» CONTIENE a la otra: quedate con ésa y descartá la otra.`])
      } else {
        f.push(["", "Cada fuente tiene comprobantes que la otra no: hay que fusionarlas, no elegir una."])
      }
      for (const u of d.soloEn) {
        f.push(["", `Sólo en ${nombreFuente(u.fuente)}:`, "Fecha", "Proveedor", "Tipo", "Importe"])
        u.asientos.forEach(a => f.push(["", "", a.fecha ?? "", a.denominacion, a.tipo ?? "sin código", money(a.total)]))
      }
      f.push([])
    }
  }

  if (c.choques.length > 0) {
    f.push(["COMPROBANTES QUE APARECEN MÁS DE UNA VEZ"])
    f.push(["Subdiario", "Tipo|PtoVta|Número|CUIT", "Denominación", "Total", "Fuentes"])
    c.choques.forEach(ch => f.push([ch.subdiario, ch.clave, ch.denominacion, money(ch.total), ch.fuentes.join(" + ")]))
    f.push([])
  }

  if (c.vacios.length > 0) {
    f.push(["SUBDIARIOS SIN NINGÚN COMPROBANTE — avisa, no frena"])
    f.push(["Puede ser un mes sin movimiento, o un mes que falta cargar. Un mes faltante NO se nota"])
    f.push(["mirando el total: por eso se listan."])
    c.vacios.forEach(s => f.push(["", nombreSubdiario(s)]))
    f.push([])
  }

  if (c.compras.descuadres.length > 0 || c.ventas.descuadres.length > 0) {
    f.push(["COMPROBANTES CUYAS PARTES NO SUMAN SU PROPIO TOTAL"])
    // 🛑 A-FEAT-1388: no se corrigen acá — se marcan donde están, para encontrarlos.
    f.push(["Están en ROJO, con la marca, en las solapas Compras / Ventas y en el renglón de su cuenta y mes de Compras / Ventas por cuenta."])
    f.push(["Fecha", "Nombre", "Comprobante", "Total", "Suma de las partes", "Diferencia"])
    ;[...c.compras.descuadres, ...c.ventas.descuadres].forEach(d => f.push([
      d.fecha, d.nombre, d.comprobante, money(d.imp_total), money(d.suma_partes), money(d.diferencia),
    ]))
    f.push([])
  }

  f.push(["QUÉ HAY EN CADA SOLAPA"])
  f.push(["", "Compras", `${libro.compras.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "Ventas", `${libro.ventas.length} comprobante(s) de los 12 subdiarios`])
  f.push(["", "05 Provisión", `${libro.provisiones.length} — son del ejercicio por fecha pero entraron después`])
  f.push(["", "Sin subdiario", `${libro.sinSubdiario.length} en total, de los cuales ${c.sinSubdiarioQueAfectan.length} tienen fecha del ejercicio o anterior`])
  if (libro.sinSubdiario.length > 0 && c.sinSubdiarioQueAfectan.length === 0) {
    f.push(["", "", "Los sin subdiario son todos POSTERIORES al cierre: son del mes en curso y no tocan este balance."])
  }
  f.push([])
  f.push(["NO ESTÁ EN ESTE ARCHIVO, y va aparte como siempre: gastos bancarios e impuestos,"])
  f.push(["inmobiliario / red vial / automotor, retiros y aportes. Son los templates, que no"])
  f.push(["entran por subdiario."])

  return f
}

/**
 * Agrega una hoja, y **con su formato**: anchos y formato de número por columna.
 *
 * 📌 El formato es parte del entregable, no un adorno — se lo pidió el usuario pensando en quién
 * lo va a leer: *«que sea lo más amigable para el contador»*. Sin `columnas` la hoja entra sin
 * formato, que es lo correcto para las hojas de texto (Control).
 */
/**
 * 📑 El nivel de esquema de cada fila de una hoja (0 = sin agrupar, 1 = detalle de un grupo), para que se pueda
 * plegar como el «Subtotal» de Excel. La hoja que lo necesita lo anota acá, sin cambiar su firma.
 */
const NIVELES = new WeakMap<unknown[][], number[]>()
/** Las hojas cuyo esquema viene CERRADO (las filas de nivel 1 ocultas, como las deja Excel al apretar el [−]). */
const CERRADAS = new WeakSet<unknown[][]>()

/** Un renglón de SUBTOTAL: negrita, fondo suave y línea arriba — se distingue de las cuentas. */
export const ESTILO_SUBTOTAL = {
  font: { bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "FFE6EEF6" } },
  border: { top: { style: "thin", color: { rgb: "FFB9C4C0" } } },
}
/** El total del ejercicio: lo mismo, un tono más fuerte. */
export const ESTILO_TOTAL = { ...ESTILO_SUBTOTAL, fill: { patternType: "solid", fgColor: { rgb: "FFCFDDEB" } } }

/** Le pone estilo a cada celda de un renglón (respetando las fórmulas). */
export const conEstilo = (fila: unknown[], s: Record<string, unknown>): unknown[] => fila.map(v => {
  if (v && typeof v === "object" && "t" in (v as object)) return { ...(v as XLSX.CellObject), s }
  if (typeof v === "number") return { t: "n", v, s }
  return { t: "s", v: v == null ? "" : String(v), s }
})

/** 🪟 La vista de cada solapa (encabezado inmovilizado, color), en el orden en que se agregaron. */
const VISTAS = new WeakMap<XLSX.WorkBook, Vista[]>()
/** Las vistas de un libro armado con `agregarHoja`, para `aplicarVistas` al escribirlo. */
export const vistasDe = (wb: XLSX.WorkBook): Vista[] => VISTAS.get(wb) ?? []

const hoja = (wb: XLSX.WorkBook, nombre: string, filas: unknown[][], columnas?: Columna[]) => {
  const ws = XLSX.utils.aoa_to_sheet(filas)
  if (columnas) formatearHoja(ws, columnas)
  else anchosAutomaticos(ws)
  const vista = { ...presentarHoja(ws), colorSolapa: colorDeSolapa(nombre) }
  if (esSinCongelar(filas)) vista.congelarFilas = undefined
  const fijo = congeladoDe(filas)
  if (fijo) vista.congelarFilas = fijo
  const cols = columnasCongeladasDe(filas)
  if (cols) vista.congelarColumnas = cols
  // 🔎 Si quien armó la hoja dijo dónde va el filtro, manda sobre el que adivina `presentarHoja`.
  const filtro = filtroDe(filas)
  if (filtro) ws["!autofilter"] = { ref: filtro }
  VISTAS.set(wb, [...vistasDe(wb), vista])
  const uniones = UNIONES.get(filas)
  if (uniones?.length) ws["!merges"] = uniones.map(u => XLSX.utils.decode_range(u))
  const niveles = NIVELES.get(filas) ?? nivelesDelResumen(filas)
  if (niveles) ws["!rows"] = niveles.map(l => (l ? { level: l, ...(CERRADAS.has(filas) ? { hidden: true } : {}) } : {}))
  const altos = ALTOS.get(filas)
  if (altos) { const rs: XLSX.RowInfo[] = (ws["!rows"] ??= []); for (const [r, h] of Object.entries(altos)) rs[Number(r) - 1] = { ...(rs[Number(r) - 1] ?? {}), hpt: h } }
  // 31 caracteres es el máximo que acepta Excel para el nombre de una solapa.
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}
/** La misma forma de agregar una hoja (formato, presentación y plegado), para el libro diario aparte. */
export const agregarHoja = hoja

/**
 * 🎨 Una hoja que trae SU propio estilo (celdas con `s`, uniones y anchos), y por eso no pasa por `presentarHoja`: el papel de
 * impuestos con la estética de la planilla de JMS (A-FEAT-1516). Sí lleva su vista (encabezado inmovilizado, color de solapa).
 */
export function agregarHojaConEstilo(wb: XLSX.WorkBook, nombre: string, h: HojaConEstilo): void {
  const ws = XLSX.utils.aoa_to_sheet(h.filas)
  if (h.uniones.length) ws["!merges"] = h.uniones
  ws["!cols"] = h.anchos.map(wch => ({ wch }))
  VISTAS.set(wb, [...vistasDe(wb), { congelarFilas: h.congelarFilas, colorSolapa: colorDeSolapa(nombre) }])
  XLSX.utils.book_append_sheet(wb, ws, nombre.slice(0, 31))
}
/** Anota qué filas se pliegan (1 = detalle de un grupo) en una hoja que se va a agregar con `agregarHoja`. */
export const plegar = (filas: unknown[][], niveles: number[], cerrado = false) => { NIVELES.set(filas, niveles); if (cerrado) CERRADAS.add(filas) }

/**
 * Las columnas de un listado de asientos (Compras, Ventas, Provisión, Sin subdiario).
 * Una sola definición para las cuatro: si se vieran distinto, el lector tendría que reaprender
 * la tabla en cada solapa.
 */
/** Templates, fila por cuota. */
const COLS_TEMPLATES_POR_MES = (meses: number): Columna[] => [
  { ancho: 14 },                                   // Responsable
  { ancho: 30 },                                   // Agrupadora (A-FEAT-1388)
  { ancho: 34 },                                   // Categoría
  ...Array.from({ length: meses }, () => ({ ancho: 15, z: MONEDA })),
  { ancho: 17, z: MONEDA },                        // TOTAL
  { ancho: 11, z: ENTERO },                        // Meses con movimiento
  { ancho: 10, z: ENTERO },                        // Nro (A-FEAT-1513)
]

const COLS_TEMPLATES: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Concepto
  { ancho: 30 },                    // Proveedor
  { ancho: 26 },                    // Categoría
  { ancho: 24 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 14 },                    // Responsable
  { ancho: 12 },                    // Estado
  { ancho: 16, z: MONEDA },         // Débito
  { ancho: 16, z: MONEDA },         // Crédito
  { ancho: 10, z: ENTERO },         // Nro de «Por mes» (A-FEAT-1513)
]

/** Hacienda: cabezas enteras, coeficientes con dos decimales, importes en Contabilidad. */
const COLS_HACIENDA: Columna[] = [
  { ancho: 26 },                    // Categoría
  { ancho: 9, z: ENTERO },          // Cabezas
  { ancho: 46 },                    // Criterio
  { ancho: 15, z: MONEDA },         // Precio de referencia
  { ancho: 44 },                    // Origen del precio
  { ancho: 8, z: COEFICIENTE },     // Factor
  { ancho: 9, z: ENTERO },          // Kg/cab
  { ancho: 17, z: MONEDA },         // $ por cabeza
  { ancho: 18, z: MONEDA },         // Valor total
  { ancho: 60 },                    // De dónde salen los kilos
]

/** Los precios de referencia de los dos mercados. */
const COLS_PRECIOS: Columna[] = [
  { ancho: 26 }, { ancho: 16 }, { ancho: 12 },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
  { ancho: 14, z: MONEDA }, { ancho: 14, z: MONEDA },
]

/** Stock de insumos. */
const COLS_INSUMOS: Columna[] = [
  { ancho: 22 },                    // Categoría
  { ancho: 46 },                    // Producto
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Valor total
  { ancho: 34 },                    // Observaciones
]

/** Granos: dos columnas, y las toneladas con tres decimales porque el cuadre se juega ahí. */
const COLS_GRANOS: Columna[] = [
  { ancho: 40 }, { ancho: 18, z: TONELADAS }, { ancho: 54 },
]

/** Sementeras. */
const COLS_SEMENTERAS: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 34 },                    // Lote
  { ancho: 8, z: "#,##0.00" },      // Ha
  { ancho: 30 },                    // Insumo
  { ancho: 12, z: "#,##0.00" },     // Cantidad
  { ancho: 9 },                     // Unidad
  { ancho: 15, z: MONEDA },         // Precio unitario
  { ancho: 16, z: MONEDA },         // Costo
]

/**
 * 📗 La solapa **«Por cuenta contable»** — el formato de su «Excel - Compras».
 *
 * Columnas A..N **en su orden exacto**, porque es lo que él y el contador ya saben leer; lo que
 * agregamos va **a la derecha del todo** (Q y R), para no correr el bloque familiar de importes.
 *
 * 🧮 **Todo lo que es una cuenta va como FÓRMULA**, no como número pegado (pedido explícito): la
 * columna Diferencia, los «Total general» de cada mes, el total del ejercicio y el Control final.
 * Así él cambia un importe y el papel se recalcula solo.
 *
 * ## Las dos mitades del control, que son distintas (§ 🚦)
 *
 * - **Diferencia** (columna K) es **integridad**: `Total − (neto + no gravado + exento + otros
 *   tributos + IVA)`. Si no da cero, el papel se contradice solo. Frena.
 * - **DDJJ IVA** (M a P) es **discrepancia** contra un papel de afuera: él pega el neto gravado de
 *   la declaración y la app le resta el del libro. Avisa, no frena — y las celdas van **vacías**
 *   porque ese número sale de la DDJJ, que la app no tiene.
 */
export function hojaPorCuenta(
  libro: LibroPorCuenta, titulo: string,
  /**
   * 🛑 Los comprobantes cuyas partes no suman su total (los del Control): el renglón de su cuenta y mes va en rojo,
   * con la marca, y el subtotal del mes avisa. Sin esto la hoja sale como antes.
   */
  marcas?: { asientos: AsientoLibroDiario[]; descuadres: Descuadre[] },
  /**
   * 🌾 VENTAS: qué se vendió y cuánto, por cuenta y mes — producto, toneladas, cabezas, kilos (usuario 27/10, ronda 3:
   * *«poner grano, categoría, cantidad»*). Van a la derecha de «Control de partes»; salen de `marcas.asientos`.
   */
  conCantidades = false,
): unknown[][] {
  const f: unknown[][] = []
  /** Por renglón (año-mes|cuenta): cuántos comprobantes no cuadran y cuánto suman sus diferencias. */
  const conError = new Map<string, { n: number; dif: number }>()
  if (marcas) {
    const malos = new Map(marcas.descuadres.filter(d => d.id).map(d => [d.id!, d]))
    for (const a of marcas.asientos) {
      const d = malos.get(a.id)
      if (!d) continue
      const [anio, mes] = a.subdiario.split("-").map(Number)
      const k = `${anio}-${mes}|${a.cuenta_contable?.trim() || SIN_IMPUTAR}`
      const acc = conError.get(k) ?? { n: 0, dif: 0 }
      acc.n += 1; acc.dif = money(acc.dif + d.diferencia)
      conError.set(k, acc)
    }
  }
  const conCant = conCantidades && !!marcas
  const cant = new Map<string, { productos: Set<string>; t: number; c: number; k: number }>()
  if (conCant) {
    for (const a of marcas!.asientos) {
      const q = a.cantidades
      if (!q) continue
      const [anio, mes] = a.subdiario.split("-").map(Number)
      const k = `${anio}-${mes}|${a.cuenta_contable?.trim() || SIN_IMPUTAR}`
      const acc = cant.get(k) ?? { productos: new Set<string>(), t: 0, c: 0, k: 0 }
      if (q.producto) acc.productos.add(q.producto)
      acc.t += q.toneladas ?? 0; acc.c += q.cabezas ?? 0; acc.k += q.kilos ?? 0
      cant.set(k, acc)
    }
  }
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const marcaFila = (e: { n: number; dif: number }) =>
    `NO CUADRA: ${e.n} comprobante(s) cuyas partes no suman su total (${e.dif > 0 ? "faltan" : "sobran"} ${fmtAr(Math.abs(e.dif))}) — están en rojo en el detalle`

  f.push([titulo])
  f.push(['Otros tributos va AL GASTO: adentro hay impuestos que no son percepciones (nota del usuario).'])
  f.push(['Las percepciones se toman de ARCA y se restan aparte.'])
  f.push([])
  f.push(["", "", "", "", "", "", "", "", "", "", "", "", "DDJJ IVA — lo llena el usuario"])
  f.push([
    "Año", "Mes", "Cuenta Contable",
    "Suma de Neto Gravado", "Suma de No Gravado", "Suma de Exento",
    "Otros Tributos", "Suma de IVA", "Suma de Total",
    "Sin crédito fiscal (Fac B y C)", "Diferencia Entre Total y suma de columnas", "",
    "Neto Gravado DDJJ", "Diferencia", "Exento + No gravado + Monotributo", "Diferencia",
    "Nro cuenta", "Comprobantes",
    ...(marcas ? ["Control de partes"] : []),
    ...(conCant ? ["Producto", "Toneladas", "Cabezas", "Kilos"] : []),
  ])

  /** Las filas (1-based, como las ve Excel) de cada «Total general» de mes, para el Control final. */
  const filasTotalMes: number[] = []
  /** Las filas de detalle (0-based), para agruparlas: cada mes se pliega a su subtotal. */
  const detalle = new Set<number>()
  const primeraDetalle = f.length + 1

  for (const m of libro.meses) {
    for (const fila of m.filas) {
      const n = f.length + 1
      detalle.add(f.length)
      const e = conError.get(`${fila.anio}-${fila.mes}|${fila.cuenta}`)
      const renglon: unknown[] = [
        fila.anio, fila.mes, fila.cuenta,
        money(fila.netoGravado), money(fila.noGravado), money(fila.exento),
        money(fila.otrosTributos), money(fila.iva), money(fila.total),
        money(fila.sinCredito),
        conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, fila.diferencia), "",
        "", "", "", "",
        fila.nroCuenta, fila.comprobantes,
      ]
      if (marcas) renglon.push(e ? marcaFila(e) : "")
      if (conCant) {
        const q = cant.get(`${fila.anio}-${fila.mes}|${fila.cuenta}`)
        renglon.push(q ? [...q.productos].join(" · ") : "", q?.t ? r3(q.t) : "", q?.c || "", q?.k || "")
      }
      f.push(e ? conEstilo(renglon, ESTILO_ERROR) : renglon)
    }
    // El subtotal del mes también avisa si adentro hay algo que no cuadra.
    const errMes = [...conError.entries()].filter(([k]) => k.startsWith(`${m.anio}-${m.mes}|`))
      .reduce((acc, [, v]) => ({ n: acc.n + v.n, dif: money(acc.dif + v.dif) }), { n: 0, dif: 0 })

    /**
     * 📑 El SUBTOTAL del mes (usuario 27/10: *«poner con un formato tipo subtotal, pero poner las sumatorias»*):
     * negrita y fondo, y la suma con `SUBTOTAL(9, …)` — la del «Subtotal» de Excel: **respeta los filtros**
     * (suma sólo lo visible) y el total del ejercicio no la cuenta dos veces. El mes se pliega a este renglón.
     */
    const desde = f.length + 1 - m.filas.length
    const hasta = f.length
    const n = f.length + 1
    filasTotalMes.push(n)
    f.push(conEstilo([
      m.anio, m.mes, `Total ${String(m.mes).padStart(2, "0")}/${m.anio}`,
      ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
        conFormula(`SUBTOTAL(9,${col}${desde}:${col}${hasta})`, [
          m.total.netoGravado, m.total.noGravado, m.total.exento,
          m.total.otrosTributos, m.total.iva, m.total.total, m.total.sinCredito,
        ][i]),
      ),
      conFormula(`I${n}-(D${n}+E${n}+F${n}+G${n}+H${n}+J${n})`, m.total.diferencia), "",
      // 🔑 M y O van VACÍAS a propósito: las llena él con la DDJJ. N y P se calculan solas — es la
      //    mejora sobre su planilla, donde la resta también la hacía a mano.
      "", { t: "n", f: `IF(M${n}="","",M${n}-D${n})`, z: MONEDA },
      "", { t: "n", f: `IF(O${n}="","",O${n}-(E${n}+F${n}))`, z: MONEDA },
      "", m.total.comprobantes,
      ...(marcas ? [errMes.n ? marcaFila(errMes) : ""] : []),
      ...(conCant ? ["",
        ...(["U", "V", "W"] as const).map((col, i) => {
          const del = [...cant.entries()].filter(([k]) => k.startsWith(`${m.anio}-${m.mes}|`)).map(([, v]) => [v.t, v.c, v.k][i])
          return conFormula(`SUBTOTAL(9,${col}${desde}:${col}${hasta})`, r3(del.reduce((s, x) => s + x, 0)), i === 0 ? TONELADAS : ENTERO)
        })] : []),
    ], ESTILO_SUBTOTAL))
    f.push([])
  }
  const ultimaDetalle = f.length

  // El total del ejercicio y el Control, que es el camino inverso: si la suma de los totales
  // mensuales no da el total del ejercicio, la apertura perdió algo por el camino.
  // 📑 SUBTOTAL(9) sobre todo el bloque: suma el detalle y salta los subtotales de mes (no los cuenta dos veces).
  const nTotal = f.length + 1
  f.push(conEstilo([
    "", "", "TOTAL DEL EJERCICIO",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map((col, i) =>
      conFormula(`SUBTOTAL(9,${col}${primeraDetalle}:${col}${ultimaDetalle})`, [
        libro.totalGeneral.netoGravado, libro.totalGeneral.noGravado, libro.totalGeneral.exento,
        libro.totalGeneral.otrosTributos, libro.totalGeneral.iva, libro.totalGeneral.total,
        libro.totalGeneral.sinCredito,
      ][i]),
    ),
    conFormula(`I${nTotal}-(D${nTotal}+E${nTotal}+F${nTotal}+G${nTotal}+H${nTotal}+J${nTotal})`, libro.totalGeneral.diferencia),
    "", "", "", "", "", "", libro.totalGeneral.comprobantes,
    ...(conCant ? ["", "",
      ...(["U", "V", "W"] as const).map((col, i) =>
        conFormula(`SUBTOTAL(9,${col}${primeraDetalle}:${col}${ultimaDetalle})`,
          r3([...cant.values()].reduce((s, v) => s + [v.t, v.c, v.k][i], 0)), i === 0 ? TONELADAS : ENTERO))] : []),
  ], ESTILO_TOTAL))

  const nCtrl = f.length + 1
  f.push([
    "", "", "Control (tiene que dar 0)",
    ...(["D", "E", "F", "G", "H", "I", "J"] as const).map(col =>
      conFormula(`${col}${nTotal}-(${filasTotalMes.map(r => `${col}${r}`).join("+") || "0"})`, 0),
    ),
  ])
  f.push([])

  // Lo que falta imputar, dicho en una línea y con su peso. § 🧮: el control se ve.
  if (libro.sinImputar.comprobantes > 0) {
    f.push([`FALTA IMPUTAR: ${libro.sinImputar.comprobantes} comprobante(s) por ${money(libro.sinImputar.total)} — ${libro.sinImputar.porcentaje}% del total`])
    f.push([`Aparece en: ${[...new Set(libro.sinImputar.meses)].join(" · ")}`])
    f.push(["Se imputa en Egresos → Facturas → Asignación Cuentas. Hasta entonces sale como NO IMPUTADO."])
  } else {
    f.push(["TODO IMPUTADO — no hay comprobantes sin cuenta contable."])
  }

  // 📑 Cada mes se pliega a su subtotal (los botones + / − de Excel, a la izquierda).
  NIVELES.set(f, f.map((_, i) => (detalle.has(i) ? 1 : 0)))
  return f
}

/**
 * 📅 La solapa **Resumen 12 meses** — usuario 27/10: *«una planilla simplemente con los 12 meses, total compras,
 * total ventas»*, y *«ayuda a controles también»*.
 *
 * Un renglón por subdiario del ejercicio (los 12, aunque alguno esté vacío: un mes sin nada se ve como 0, no
 * desaparece), con compras y ventas. Y al lado, el **control**: las compras de cada mes contra lo presentado a ARCA
 * (el mismo dato del Control), con la diferencia; y abajo, que la suma de los 12 dé el total del ejercicio.
 */
export function hojaResumenMensual(libro: LibroDiario): unknown[][] {
  const f: unknown[][] = []
  f.push([`RESUMEN DE LOS 12 MESES — ejercicio ${libro.ejercicio.etiqueta}`])
  f.push(["Por subdiario (el mes en que entró cada comprobante), como el resto del libro diario."])
  f.push([])
  f.push(["Subdiario", "Compras: comprobantes", "Compras: total", "Ventas: comprobantes", "Ventas: total",
    "ARCA: comprobantes", "ARCA: total presentado", "Diferencia compras − ARCA", "Control"])
  const clave = (s: { anio: number; mes: number }) => `${s.anio}-${String(s.mes).padStart(2, "0")}`
  const porSub = (xs: AsientoLibroDiario[], k: string) => xs.filter(a => a.subdiario === k)
  const presentado = new Map((libro.controles.contraPresentado ?? []).map(p => [p.subdiario, p]))
  const n0 = f.length + 1
  const suma = { cc: 0, tc: 0, cv: 0, tv: 0 }
  for (const s of libro.ejercicio.subdiarios) {
    const k = clave(s)
    const c = porSub(libro.compras, k), v = porSub(libro.ventas, k)
    const tc = money(c.reduce((t, a) => t + (Number(a.total) || 0), 0))
    const tv = money(v.reduce((t, a) => t + (Number(a.total) || 0), 0))
    suma.cc += c.length; suma.tc += tc; suma.cv += v.length; suma.tv += tv
    const p = presentado.get(k)
    const n = f.length + 1
    const fila: unknown[] = [
      nombreSubdiario(s), c.length, tc, v.length, tv,
      p?.presentado ? p.presentado.comprobantes : "sin dato",
      p?.presentado ? money(p.presentado.total) : "sin dato",
      p?.presentado ? conFormula(`C${n}-G${n}`, money(tc - p.presentado.total)) : "",
      !p?.presentado ? "sin dato de ARCA" : p.ok ? "coincide" : "NO COINCIDE",
    ]
    // 🛑 El mes que no coincide con ARCA, en rojo (como diciembre): se ve sin leer la columna Control.
    f.push(p?.presentado && !p.ok ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  const nU = f.length
  const nT = f.length + 1
  f.push(["TOTAL", ...(["B", "C", "D", "E"] as const).map((col, i) => conFormula(`SUM(${col}${n0}:${col}${nU})`,
    [suma.cc, money(suma.tc), suma.cv, money(suma.tv)][i], i % 2 === 0 ? ENTERO : MONEDA))])
  // 🧮 El camino inverso: la suma de los 12 renglones tiene que ser el total del ejercicio de la solapa Control.
  //    Si un comprobante tiene un subdiario fuera de los 12, no está en ningún renglón y esto no da 0.
  f.push([])
  f.push(["CONTROL", "", "Compras", "", "Ventas"])
  f.push(["Total del ejercicio (solapa Control)", "", money(libro.controles.compras.totalGeneral), "", money(libro.controles.ventas.totalGeneral)])
  const dC = money(suma.tc - libro.controles.compras.totalGeneral)
  const dV = money(suma.tv - libro.controles.ventas.totalGeneral)
  const nD = f.length + 1
  f.push(["Suma de los 12 meses − total (tiene que dar 0)", "", conFormula(`C${nT}-C${nD - 1}`, dC), "", conFormula(`E${nT}-E${nD - 1}`, dV),
    "", "", "", Math.abs(dC) < 0.01 && Math.abs(dV) < 0.01 ? "cuadra" : "NO CUADRA"])
  return f
}

const COLS_RESUMEN_MENSUAL: Columna[] = [
  { ancho: 16 },                     // Subdiario
  { ancho: 12, z: ENTERO },          // Compras: comprobantes
  { ancho: 18, z: MONEDA },          // Compras: total
  { ancho: 12, z: ENTERO },          // Ventas: comprobantes
  { ancho: 18, z: MONEDA },          // Ventas: total
  { ancho: 12, z: ENTERO },          // ARCA: comprobantes
  { ancho: 20, z: MONEDA },          // ARCA: total presentado
  { ancho: 18, z: MONEDA },          // Diferencia compras − ARCA
  { ancho: 18 },                     // Control
]

export const COLS_POR_CUENTA: Columna[] = [
  { ancho: 7, z: ENTERO },          // A Año
  { ancho: 5, z: ENTERO },          // B Mes
  { ancho: 34 },                    // C Cuenta Contable
  { ancho: 17, z: MONEDA },         // D Neto Gravado
  { ancho: 15, z: MONEDA },         // E No Gravado
  { ancho: 15, z: MONEDA },         // F Exento
  { ancho: 15, z: MONEDA },         // G Otros Tributos
  { ancho: 15, z: MONEDA },         // H IVA
  { ancho: 17, z: MONEDA },         // I Total
  { ancho: 20, z: MONEDA },         // J Sin crédito fiscal (Fac B y C)
  { ancho: 19, z: MONEDA },         // K Diferencia
  { ancho: 3 },                     // L separador
  { ancho: 17, z: MONEDA },         // M DDJJ Neto Gravado
  { ancho: 14, z: MONEDA },         // N Diferencia
  { ancho: 22, z: MONEDA },         // O DDJJ Exento + No grav + Mono
  { ancho: 14, z: MONEDA },         // P Diferencia
  { ancho: 12 },                    // Q Nro cuenta
  { ancho: 13, z: ENTERO },         // R Comprobantes
  { ancho: 70 },                    // S Control de partes (A-FEAT-1388)
]
/** Ventas por cuenta: lo mismo + producto, toneladas, cabezas y kilos (T a W). */
export const COLS_POR_CUENTA_VENTAS: Columna[] = [
  ...COLS_POR_CUENTA,
  { ancho: 22 },                    // T Producto
  { ancho: 13, z: TONELADAS },      // U Toneladas
  { ancho: 10, z: ENTERO },         // V Cabezas
  { ancho: 12, z: ENTERO },         // W Kilos
]

/**
 * 💳 Las solapas **03 - Cuentas a cobrar** y **04 - Cuentas a pagar**.
 *
 * Mismo formato de fila que el libro de IVA —el que usan sus papeles originales— más la columna
 * **Motivo**, que dice **por qué** cada comprobante está en el papel. Es lo que lo hace auditable:
 * *«no se pagó nunca»* y *«se pagó DESPUÉS del cierre»* son cosas distintas y el contador puede
 * querer mirarlas distinto.
 *
 * 🧮 **Y abajo van los tres bloques de lo que NO se pudo determinar**, con sus totales. No son un
 * apéndice: son la parte que dice hasta dónde llega lo que el papel afirma.
 */
export function hojaDeCuentas(
  c: CuentasAlCierre, titulo: string, fechaCierre: string,
  /** 💳 Sólo en «a pagar»: las cuotas de templates impagas al cierre (A-BUG-1289). */
  templatesImpagos?: { cuotas: CuotaTemplate[]; total: number },
  /**
   * 🔁 A-FEAT-1506 (JMS 01/11 en el Excel: *«esta primer tabla debe tener al final las cuentas corrientes que da a pagar; la
   * de cuentas a cobrar, la cuenta corriente donde somos acreedores; se pone la razón social y el saldo»*).
   */
  cuentasCorrientes?: { lado: "pagar" | "cobrar"; cc: PapelDeCuentasCorrientes },
  /**
   * 📒 A-FEAT-1537 (JMS 04/11: *«cuentas a pagar se manda sin todo eso, sino confunde; pero solapa aparte todo, así queda
   * documentado»*): `soloDeuda` deja acá sólo lo que suma — los bloques que explican lo que NO es deuda van a
   * `hojaRespaldoDeCuentas` — y suma los sueldos devengados y no pagados al cierre.
   */
  extra?: { soloDeuda?: boolean; sueldos?: SueldosImpagosAlCierre },
): unknown[][] {
  const f: unknown[][] = []
  f.push([titulo])
  f.push([`Al ${fechaCierre}`])
  f.push(["Entra lo que NO estaba pagado al cierre. Manda la fecha de pago, no el estado de hoy:"])
  f.push(["una factura que hoy figura paga pero se pagó despues del cierre, al cierre era deuda."])
  f.push([])
  f.push([
    "Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Estado hoy", "Fecha de pago", "Motivo", "Dónde verlo",
  ])

  c.filas.forEach(x => f.push(filaDeCuenta(x)))
  const desde = 7
  const hasta = 6 + c.filas.length
  if (c.filas.length > 0) {
    f.push(["", "", "", "", "", "", "TOTAL",
      ...(["H", "I", "J", "K", "L", "M"] as const).map((col, i) =>
        conFormula(`SUM(${col}${desde}:${col}${hasta})`, [0, 0, 0, 0, 0, c.total][i])),
    ])
  } else {
    f.push(["", "", "", "", "", "", "TOTAL", "", "", "", "", "", 0])
  }
  /** Los subtotales que componen el total al cierre (fila de Excel, importe, qué es). */
  const partes: Array<{ fila: number; importe: number; que: string }> = [{ fila: f.length, importe: c.total, que: "comprobantes" }]
  /**
   * 💳 **Las cuotas de templates impagas: deuda igual que las facturas** (usuario 2026-10-18). Van en
   * su propio bloque —no tienen tipo, punto de venta ni CUIT— y el TOTAL DEUDA suma los dos con fórmula.
   */
  if (!extra?.soloDeuda && templatesImpagos && templatesImpagos.cuotas.length > 0) {
    f.push([])
    f.push(["CUOTAS DE TEMPLATES IMPAGAS AL CIERRE — son deuda igual que las facturas"])
    const d = f.length + 1
    for (const q of templatesImpagos.cuotas) {
      f.push(["Template", q.fecha ?? "", "", "", "", "", `${q.concepto}${q.proveedor ? " — " + q.proveedor : ""}`,
        "", "", "", "", "", money(q.monto), q.categ, q.estado, "", "no se pagó (cuota de template)"])
    }
    const h = f.length
    const nTotTpl = f.length + 1
    f.push(["", "", "", "", "", "", "TOTAL TEMPLATES", "", "", "", "", "",
      conFormula(`SUM(M${d}:M${h})`, templatesImpagos.total)])
    partes.push({ fila: nTotTpl, importe: templatesImpagos.total, que: "templates" })
  }
  // 👷 A-FEAT-1537: los sueldos devengados y no pagados al cierre (lo que se pagó después), sin los socios.
  const su = extra?.sueldos
  if (su && su.filas.length > 0) {
    f.push([])
    f.push(["SUELDOS DEVENGADOS Y NO PAGADOS AL CIERRE — se pagaron después (manda la fecha de cada pago; sin José, Andrés ni MA, que van por su cuenta)"])
    const d = f.length + 1
    for (const x of su.filas) {
      f.push(["Sueldo", x.periodo, "", "", "", "", x.empleado, "", "", "", "", "", money(x.pagadoDespues), "SUELDOS", "pagado después",
        x.fechaPago ?? "", `bruto ${fmtAr(x.bruto)} − pagado al cierre ${fmtAr(x.pagadoAlCierre)}`, "Sueldos → pagos del período"])
    }
    const nTot = f.length + 1
    f.push(["", "", "", "", "", "", "TOTAL SUELDOS", "", "", "", "", "", conFormula(`SUM(M${d}:M${nTot - 1})`, su.total)])
    partes.push({ fila: nTot, importe: su.total, que: "sueldos" })
  }
  // 🔁 A-FEAT-1506: las cuentas corrientes (papel 14) con saldo de este lado, con su razón social y su saldo al cierre.
  if (cuentasCorrientes) {
    const delLado = cuentasCorrientes.cc.cuentas.filter(x => cuentasCorrientes.lado === "pagar" ? x.saldoAlCierre > 0.005 : x.saldoAlCierre < -0.005)
    if (delLado.length) {
      f.push([])
      f.push([cuentasCorrientes.lado === "pagar" ? "CUENTAS CORRIENTES CON SALDO A PAGAR (papel 14) — se suman a la deuda" : "CUENTAS CORRIENTES DONDE SOMOS ACREEDORES (papel 14) — se suman a lo a cobrar"])
      const d = f.length + 1
      for (const x of delLado) {
        f.push(["Cta cte", "", "", "", "", x.contraparte.cuit, x.contraparte.nombre, "", "", "", "", "",
          money(Math.abs(x.saldoAlCierre)), "", "", "", x.inicioSinDato ? "saldo de inicio sin dato (0)" : "", "papel 14 Cuentas corrientes"])
      }
      const h = f.length
      const nCC = f.length + 1
      const totCC = Math.round(delLado.reduce((t, x) => t + Math.abs(x.saldoAlCierre), 0) * 100) / 100
      f.push(["", "", "", "", "", "", "TOTAL CUENTAS CORRIENTES", "", "", "", "", "", conFormula(`SUM(M${d}:M${h})`, totCC)])
      partes.push({ fila: nCC, importe: totCC, que: "cuentas corrientes" })
    }
  }
  // El total al cierre, con fórmula, cuando hay más de una parte.
  if (partes.length > 1) {
    const ques = partes.map(x => x.que)
    const etiqueta = ques.length === 2 && ques[1] === "templates" ? "TOTAL DEUDA AL CIERRE (facturas + templates)"
      : `TOTAL AL CIERRE (${ques.join(" + ")})`
    f.push(["", "", "", "", "", "", etiqueta, "", "", "", "", "",
      conFormula(partes.map(x => `M${x.fila}`).join("+"), Math.round(partes.reduce((t, x) => t + x.importe, 0) * 100) / 100)])
  }
  if (extra?.soloDeuda) {
    f.push([])
    f.push(["Lo que NO es deuda (pagadas sin rastro, sistema anterior, conciliadas sin fecha, seguros, cuentas con socios, cuotas de templates, sueldos —van en su export aparte— y anticipos sin vincular) está en la solapa «04.3 Respaldo cuentas a pagar»."])
    f.push([`Se miraron ${c.mirados} comprobantes del ejercicio.`])
    return f
  }
  bloquesInformativos(f, c)

  f.push([])
  f.push([`Se miraron ${c.mirados} comprobantes del ejercicio.`])
  return f
}

/** Los bloques de lo que no se pudo afirmar como deuda. Cada uno dice por qué y cuánto pesa. */
function bloquesInformativos(f: unknown[][], c: CuentasAlCierre): void {
  const bloque = (t: string[], filas: FilaCuenta[], total: number) => {
    if (filas.length === 0) return
    f.push([])
    t.forEach(l => f.push([l]))
    f.push([`${filas.length} comprobante(s) — total ${money(total)}`])
    filas.forEach(x => f.push(filaDeCuenta(x)))
  }

  // ✍️ A-FEAT-1506: lo que el balance da por pagado al cierre sin poder rastrear el pago. NO cambia la factura ni el Cash Flow.
  bloque([
    "DADAS POR PAGADAS AL CIERRE — ajuste del balance, NO son deuda (la factura y el Cash Flow no cambian)",
    "Vistas y chequeadas: se pagaron, pero no se puede rastrear el pago. Cada una dice el motivo del ajuste.",
  ], c.dadasPorPagadas ?? [], c.totalDadasPorPagadas ?? 0)

  bloque([
    "DEL SISTEMA ANTERIOR — SE DAN POR PAGADOS (decisión del usuario, 29/09/2026)",
    "El histórico migró los comprobantes pero NO su estado de pago ni su fecha.",
    "No se cuentan como deuda al cierre. Se listan para que se vea en qué se apoya el papel.",
  ], c.sinEstadoDePago, c.totalSinEstado)

  bloque([
    "CONCILIADOS PERO SIN NINGUNA FECHA — no se puede ubicar el pago en el tiempo",
    "Dicen estar pagados, pero no tienen fecha de pago ni movimiento bancario enganchado.",
  ], c.sinDatoDePago, c.totalSinDato)

  bloque([
    `ESTADO NO RECONOCIDO — ${c.estadosSinClasificar.join(", ")}`,
    "No se descartan: hay que decidir de qué lado van.",
  ], c.estadoDesconocido, c.totalDesconocido)

  bloque([
    "SEGUROS EN CUOTAS CON LA PÓLIZA PAGA AL CIERRE — no son deuda",
    "Las cuotas de su póliza se pagaron (o las compensó una NC) antes del cierre. A-FEAT-1385.",
  ], c.canceladasPorCuotas, c.totalCanceladasPorCuotas)

  bloque([
    "SEGUROS EN CUOTAS SIN VÍNCULO CON LA PÓLIZA — ya están ENTEROS en el TOTAL de arriba",
    "No se pudieron atar a una póliza con template: no se sabe qué cuotas se pagaron.",
  ], c.sinVinculoPoliza, c.totalSinVinculoPoliza)

  // 🛡️ JMS 29/10: una cuota que dejó de debitarse no es deuda — falta la NC. Fuera del total, marcada.
  bloque([
    "SEGUROS: CUOTAS VENCIDAS QUE NUNCA SE DEBITARON — falta la NC a recibir, NO son deuda",
    "La póliza dejó de cobrarse (¿baja?): por ahora la conclusión es que falta su nota de crédito. Ver papel 14 (Federación).",
  ], c.faltaNc ?? [], c.totalFaltaNc ?? 0)

  // 🔁 JMS 29/10: quien tiene cuenta corriente en el 14 no va comprobante por comprobante acá.
  const enCC = (c as Partial<CuentasSinCuentaCorriente>).enCuentaCorriente
  if (enCC?.length) {
    const porCuenta = [...new Set(enCC.map(x => x.cuentaCorriente))].join(", ")
    bloque([
      `VAN POR SU CUENTA CORRIENTE (papel 14) — NO están en el TOTAL de arriba: ${porCuenta}`,
      "Regla del usuario (29/10/2026): si el balance muestra el saldo en cuenta corriente, no se muestran aparte sus comprobantes.",
    ], enCC, (c as CuentasSinCuentaCorriente).totalEnCuentaCorriente)
  }
}

/**
 * 📒 **04.3 Respaldo cuentas a pagar** (A-FEAT-1537). Todo lo que se miró y NO es deuda, con su motivo — fuera del papel
 * que va al contador para no confundir, pero en el mismo Excel para que quede documentado.
 */
export function hojaRespaldoDeCuentas(c: CuentasAlCierre, titulo: string, fechaCierre: string,
  templatesImpagos?: { cuotas: CuotaTemplate[]; total: number },
  sueldos?: SueldosImpagosAlCierre,
  socios?: CuentaCorrienteDelBalance[],
  /** ✍️ A-FEAT-1537: los anticipos que el usuario decidió en 0 al cierre, para que queden documentados. */
  anticipos?: AnticiposAlCierre,
): unknown[][] {
  const f: unknown[][] = []
  f.push([titulo])
  f.push([`Al ${fechaCierre} — lo que se miró y NO suma a la deuda de «04 Cuentas a pagar». Cada bloque dice por qué.`])
  f.push([])
  f.push(["Subdiario", "Fecha", "Tipo", "Pto Vta", "Número", "CUIT", "Denominación",
    "Neto Gravado", "No Gravado", "Exentas", "Otros Tributos", "IVA", "Total",
    "Cuenta contable", "Estado hoy", "Fecha de pago", "Motivo", "Dónde verlo"])
  if (templatesImpagos && templatesImpagos.cuotas.length > 0) {
    f.push([])
    f.push(["CUOTAS DE TEMPLATES SIN PAGO AL CIERRE — A CONFIRMAR, no suman (JMS 04/11: «lo importante es que se tomen los 12 pagos de cada cosa» → solapa «Control cuotas templates»)"])
    f.push([`${templatesImpagos.cuotas.length} cuota(s) — total ${money(templatesImpagos.total)}`])
    for (const q of templatesImpagos.cuotas) {
      f.push(["Template", q.fecha ?? "", "", "", "", "", `${q.concepto}${q.proveedor ? " — " + q.proveedor : ""}`,
        "", "", "", "", "", money(q.monto), q.categ, q.estado, "", "cuota sin pago al cierre: ¿deuda, duplicada o de otra empresa?"])
    }
  }
  if (sueldos && sueldos.filas.length > 0) {
    f.push([])
    f.push(["SUELDOS DEVENGADOS Y PAGADOS DESPUÉS DEL CIERRE — van en el export de sueldos, NO suman acá (JMS 04/11: «sueldos vamos a hacer un export aparte, sacalo de a pagar»)"])
    f.push([`${sueldos.filas.length} período(s) — ${money(sueldos.total)}`])
    for (const x of sueldos.filas) {
      f.push(["Sueldo", x.periodo, "", "", "", "", x.empleado, "", "", "", "", "", money(x.pagadoDespues), "SUELDOS", "pagado después",
        x.fechaPago ?? "", `bruto ${fmtAr(x.bruto)} − pagado al cierre ${fmtAr(x.pagadoAlCierre)}`, "Sueldos → pagos del período"])
    }
  }
  if (sueldos && sueldos.aConfirmar.length > 0) {
    f.push([])
    f.push(["SUELDOS SIN PAGO CARGADO — A CONFIRMAR, no suman (o no se pagaron, o se pagaron por fuera del módulo de Sueldos)"])
    f.push([`${sueldos.aConfirmar.length} período(s) — total ${money(sueldos.totalAConfirmar)}`])
    for (const x of sueldos.aConfirmar) {
      f.push(["Sueldo", x.periodo, "", "", "", "", x.empleado, "", "", "", "", "", money(x.sinPagar), "SUELDOS", "sin pago",
        "", `bruto ${fmtAr(x.bruto)} − pagado ${fmtAr(x.pagadoAlCierre + x.pagadoDespues)}`, "Sueldos → pagos del período"])
    }
  }
  if (socios && socios.length > 0) {
    f.push([])
    f.push(["CUENTAS CORRIENTES CON LOS SOCIOS — no suman acá (JMS 04/11: «las cuentas de socios las veremos después») → solapa «14.1 Cuentas con socios»"])
    for (const x of socios) {
      f.push(["Cta cte", "", "", "", "", x.contraparte.cuit, x.contraparte.nombre, "", "", "", "", "", money(x.saldoAlCierre), "", "",
        "", x.saldoAlCierre > 0 ? "le debemos" : x.saldoAlCierre < 0 ? "nos debe" : "en cero", "14.1 Cuentas con socios"])
    }
  }
  if (sueldos && sueldos.pagadosPorFuera.length > 0) {
    f.push([])
    f.push(["SUELDOS PAGADOS EN EFECTIVO POR FUERA DE SUELDOS — NO son deuda (JMS 04/11: «a Elvio y Vulcano no le pongas nada adeudado»)"])
    f.push([`${sueldos.pagadosPorFuera.length} período(s) — ${money(sueldos.totalPagadosPorFuera)} sin el pago cargado en el módulo de Sueldos`])
    for (const x of sueldos.pagadosPorFuera) {
      f.push(["Sueldo", x.periodo, "", "", "", "", x.empleado, "", "", "", "", "", money(x.sinPagar), "SUELDOS", "pagado por caja",
        "", "pagado en efectivo desde Caja Sigot; el pago no está cargado en Sueldos", "Caja Sigot"])
    }
  }
  const ant = anticipos?.enCeroPorDecision
  if (ant) {
    for (const [titulo, filas, total] of [
      ["ANTICIPOS A PROVEEDORES QUE FIGURAN CON SALDO — al cierre van en 0 (JMS 04/11)", ant.aProveedores, ant.totalAProveedores],
      ["ANTICIPOS DE CLIENTES QUE FIGURAN CON SALDO — al cierre van en 0 (JMS 04/11)", ant.deClientes, ant.totalDeClientes],
    ] as const) {
      if (filas.length === 0) continue
      f.push([])
      f.push([titulo])
      f.push([`${filas.length} anticipo(s) — ${money(total)} · registros del principio sin vincular a su factura o a su venta; los datos no se tocaron`])
      for (const x of filas) {
        const a = x.anticipo
        f.push(["Anticipo", a.fecha_pago ? String(a.fecha_pago).slice(0, 10) : "", a.tipo ?? "", "", "", a.cuit_proveedor ?? "", a.nombre_proveedor ?? "",
          "", "", "", "", "", money(x.saldoAlCierre), "", [a.estado, a.estado_pago].filter(Boolean).join(" / "), "",
          `monto ${fmtAr(Number(a.monto ?? 0))} − aplicado al cierre ${fmtAr(x.aplicadoAlCierre)}`, "Egresos → Anticipos"])
      }
    }
  }
  bloquesInformativos(f, c)
  f.push([])
  f.push([`Se miraron ${c.mirados} comprobantes del ejercicio.`])
  return f
}

function filaDeCuenta(x: FilaCuenta): unknown[] {
  const a = x.asiento
  return [
    a.subdiario, a.fecha ?? "", a.tipo ?? "", a.punto_venta ?? "", a.numero ?? "",
    a.cuit, a.denominacion,
    money(a.neto_gravado), money(a.no_gravado), money(a.exento),
    // 🛡️ A-FEAT-1385: en un seguro en cuotas, «Total» es el saldo al cierre; la cuenta va en el motivo.
    money(a.otros_tributos), money(a.iva), money(x.importe ?? a.total),
    a.cuenta_contable, x.estado, x.fechaPago ?? "", x.detalle ? `${x.motivo} — ${x.detalle}` : x.motivo,
    // 🔎 A-FEAT-1506: el canal donde se ve el pago; si no hay pago, dónde está la factura.
    x.dondeSeVe ?? (x.fechaPago ? "" : "sin pago: la factura en Egresos → Facturas / Cash Flow"),
  ]
}

const COLS_CUENTAS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 26 },                    // Cuenta contable
  { ancho: 13 },                    // Estado hoy
  { ancho: 13 },                    // Fecha de pago
  { ancho: 34 },                    // Motivo
  { ancho: 30 },                    // Dónde verlo (A-FEAT-1506)
]

/**
 * 💳 La solapa **04.1 Cheques dados** — los emitidos antes del cierre que todavía no debitaron.
 *
 * Mismas columnas que su hoja `4.1 Cheques dados` del balance anterior, más el **Motivo**.
 *
 * 🧨 **La columna «Estado hoy» está a propósito y NO se usa para decidir.** El estado no se
 * mantiene: al 30/09/2026 los 10 cheques de MSA decían `vigente`, incluidos los que debitaron en
 * abril. Manda la **fecha de débito**. Se muestra igual para que se vea el desfasaje.
 */
function hojaDeChequesDados(ch: ChequesDados, etiqueta: string, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`CHEQUES DADOS Y DIFERIDOS NO DEBITADOS — ejercicio ${etiqueta}`])
  f.push([`Al ${fechaCierre}`])
  f.push(["Emitidos antes del cierre y debitados despues: al cierre la plata todavia estaba en la cuenta."])
  f.push(["Manda la FECHA DE DEBITO, no el estado: el estado no se actualiza cuando el cheque debita."])
  f.push([])
  f.push([
    "Fecha emisión", "Fecha de débito", "N° Cheque", "Estado hoy", "Beneficiario", "CUIT",
    "Banco", "Concepto", "Importe", "Motivo",
  ])

  const fila = (x: ChequeAlCierre) => {
    const c = x.cheque
    return [
      c.fecha_emision ? String(c.fecha_emision).slice(0, 10) : "",
      c.fecha_cobro ? String(c.fecha_cobro).slice(0, 10) : "",
      c.numero ?? "", c.estado ?? "", c.beneficiario_nombre ?? "", c.beneficiario_cuit ?? "",
      c.banco ?? "", c.concepto ?? "", money(c.monto ?? 0), x.motivo,
    ]
  }

  ch.filas.forEach(x => f.push(fila(x)))
  const desde = 7
  const hasta = 6 + ch.filas.length
  f.push(["", "", "", "", "", "", "", "TOTAL",
    ch.filas.length > 0 ? conFormula(`SUM(I${desde}:I${hasta})`, ch.total) : 0])
  f.push([])

  if (ch.sinFechaDeDebito.length > 0) {
    f.push([])
    f.push(["EMITIDOS ANTES DEL CIERRE Y SIN FECHA DE DÉBITO — no se puede afirmar si debitaron"])
    f.push([`${ch.sinFechaDeDebito.length} cheque(s) — total ${money(ch.totalSinFecha)}`])
    ch.sinFechaDeDebito.forEach(x => f.push(fila(x)))
  }

  f.push([])
  f.push([`Se miraron ${ch.mirados} cheque(s): ${ch.debitadosAntes} ya habían debitado al cierre, `
    + `${ch.posteriores} son posteriores al cierre.`])
  if (ch.filas.length === 0 && ch.sinFechaDeDebito.length === 0) {
    // 🔑 Un cero calculado dice algo; una solapa vacía no. Se escribe el cero y de dónde sale.
    f.push(["NO HUBO cheques dados pendientes de débito al cierre. No es que falte el dato: "
      + "los cheques emitidos antes del cierre debitaron todos antes del cierre."])
  }
  ch.avisos.forEach(a => f.push([`⚠️ ${a}`]))
  return f
}

const COLS_CHEQUES: Columna[] = [
  { ancho: 13 },                    // Fecha emisión
  { ancho: 14 },                    // Fecha de débito
  { ancho: 12 },                    // N° Cheque
  { ancho: 11 },                    // Estado hoy
  { ancho: 46 },                    // Beneficiario
  { ancho: 13 },                    // CUIT
  { ancho: 15 },                    // Banco
  { ancho: 34 },                    // Concepto
  { ancho: 16, z: MONEDA },         // Importe
  { ancho: 40 },                    // Motivo
]

/**
 * 💰 La solapa **04.2 Anticipos** — los que tenían saldo al cierre.
 *
 * 🔑 **Dos bloques, y no se pueden sumar**: los `pago` son plata adelantada a un proveedor
 * (**activo**), los `cobro` son plata que adelantó un cliente (**pasivo**). Salen del mismo cálculo
 * y de la misma tabla, así que van en la misma solapa, pero con su total cada uno.
 *
 * 🧮 Al final, el **control del camino inverso**: recalcular el saldo a hoy tiene que dar la columna
 * `monto_restante` del sistema. Si no da, el saldo al cierre tampoco es confiable.
 */
function hojaDeAnticipos(an: AnticiposAlCierre, etiqueta: string, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`ANTICIPOS CON SALDO AL CIERRE — ejercicio ${etiqueta}`])
  f.push([`Al ${fechaCierre}`])
  f.push(["El saldo se RECALCULA a la fecha de cierre. La columna del sistema es la foto de hoy:"])
  f.push(["un anticipo hoy consumido pudo tener saldo al cierre, y ese saldo es el que va al balance."])
  f.push(["Saldo = monto - aplicado a facturas hasta el cierre - retencion de SICORE - descuento."])
  // ✍️ A-FEAT-1537: decisión del usuario — al cierre no hay anticipos; la lista que había va al respaldo.
  if (an.enCeroPorDecision) {
    f.push([])
    f.push([`ANTICIPOS AL CIERRE: 0 — ${an.enCeroPorDecision.motivo}.`])
  }

  const cabecera = [
    "Fecha", "Razón Social", "CUIT", "Empresa", "Tipo", "Monto original",
    "Aplicado al cierre", "SICORE", "Descuento", "SALDO AL CIERRE",
    "Aplicado después", "Estado hoy",
  ]
  const fila = (x: AnticipoAlCierre) => {
    const a = x.anticipo
    return [
      a.fecha_pago ? String(a.fecha_pago).slice(0, 10) : "",
      a.nombre_proveedor ?? "", a.cuit_proveedor ?? "",
      a.empresa ?? "(sin empresa)", a.tipo ?? "(sin tipo)",
      money(a.monto ?? 0), money(x.aplicadoAlCierre),
      money(a.monto_sicore ?? 0), money(a.descuento_aplicado ?? 0),
      money(x.saldoAlCierre), money(x.aplicadoDespues),
      [a.estado, a.estado_pago].filter(Boolean).join(" / "),
    ]
  }

  /** Un bloque con su cabecera, sus filas y su TOTAL con fórmula sobre la columna del saldo. */
  const bloque = (titulo: string[], filas: AnticipoAlCierre[], total: number) => {
    f.push([])
    titulo.forEach(t => f.push([t]))
    f.push(cabecera)
    const desde = f.length + 1
    filas.forEach(x => f.push(fila(x)))
    const hasta = f.length
    f.push(["", "", "", "", "", "", "", "", "TOTAL",
      filas.length > 0 ? conFormula(`SUM(J${desde}:J${hasta})`, total) : 0])
  }

  bloque([
    "ANTICIPO A PROVEEDORES — es un ACTIVO: plata adelantada que todavía no se consumió",
  ], an.aProveedores, an.totalAProveedores)

  bloque([
    "ANTICIPOS DE CLIENTES (cobros a cuenta) — es un PASIVO: plata que ya se cobró y no se facturó",
    "Vienen de la misma tabla que los de arriba (columna Tipo = cobro). NO se suman con ellos.",
  ], an.deClientes, an.totalDeClientes)

  if (an.sinTipo.length > 0) {
    bloque([
      `SIN TIPO — no dicen si son a proveedor o de cliente (${an.tiposSinClasificar.join(", ")})`,
      "No se suman a ninguno de los dos bloques: hay que decidir de qué lado van.",
    ], an.sinTipo, an.totalSinTipo)
  }

  // 🧮 El control, al final y con nombre propio.
  f.push([])
  f.push([])
  f.push(["CONTROL — el camino inverso: recalcular el saldo a HOY tiene que dar el del sistema"])
  if (an.descuadres.length === 0) {
    f.push([`✓ Cierra en los ${an.mirados} anticipos mirados.`])
  } else {
    f.push([`⚠️ NO cierra en ${an.descuadres.length} de ${an.mirados}:`])
    f.push(["Razón Social", "Monto", "Saldo del sistema", "Saldo recalculado", "Diferencia"])
    an.descuadres.forEach(d => f.push([d.nombre, money(d.monto), money(d.guardado),
      money(d.recalculado), money(d.diferencia)]))
  }

  f.push([])
  an.avisos.forEach(a => f.push([`⚠️ ${a}`]))
  if (an.deOtraEmpresa > 0) {
    f.push([`${an.deOtraEmpresa} anticipo(s) quedaron afuera por ser de otra empresa.`])
  }
  return f
}

const COLS_ANTICIPOS: Columna[] = [
  { ancho: 11 },                    // Fecha
  { ancho: 46 },                    // Razón Social
  { ancho: 13 },                    // CUIT
  { ancho: 13 },                    // Empresa
  { ancho: 10 },                    // Tipo
  { ancho: 17, z: MONEDA },         // Monto original
  { ancho: 17, z: MONEDA },         // Aplicado al cierre
  { ancho: 13, z: MONEDA },         // SICORE
  { ancho: 12, z: MONEDA },         // Descuento
  { ancho: 18, z: MONEDA },         // SALDO AL CIERRE
  { ancho: 16, z: MONEDA },         // Aplicado después
  { ancho: 22 },                    // Estado hoy
]

/**
 * 🧮 **La solapa 07.1 — LA CADENA DE SALDOS, de dónde arranca el ejercicio hasta dónde termina.**
 *
 * Es el camino inverso del papel 07 (§ 🧮 de `CLAUDE.md`): el saldo al cierre **no se afirma, se
 * reconstruye** desde el saldo al inicio, y se compara con el que trae el extracto.
 *
 * 🔑 **Y el tramo que la app no tiene cargado no se carga: se deduce** del primer movimiento que sí
 * está (`saldo + débito − crédito`). Por eso el ejercicio 25/26 se puede cerrar **sin cargar los
 * extractos de julio-25 a enero-26**, que es lo que el usuario decidió no hacer.
 *
 * 📌 **Va en solapa propia y no pegada a los saldos** por una razón práctica: `07 Bancos` ya mezcla
 * la tabla de saldos con la de cuotapartes del FCI, y sus columnas quieren formatos distintos
 * (importes contra cuotapartes con 4 decimales). Una tercera tabla ahí adentro haría que ninguna de
 * las tres se vea bien.
 */
function hojaDeCadenaDeSaldos(cadenas: CadenaDeSaldos[], fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`LA CADENA DEL EJERCICIO — el saldo al cierre reconstruido desde el saldo al inicio`])
  f.push([`Al ${fechaCierre}`])
  f.push([])
  f.push(["Cuenta", "Saldo al inicio", "Neto NO cargado", "Saldo al arrancar lo cargado",
    "Neto de lo cargado", "Saldo al cierre calculado", "Saldo del extracto", "Diferencia",
    "Desde", "Hasta", "Movim."])
  for (const c of cadenas) {
    const n = f.length + 1
    f.push([
      c.cuenta,
      c.saldoInicio ?? "NO SE CONOCE",
      c.netoNoCargado ?? "",
      c.saldoAntesDeLoCargado ?? "",
      money(c.netoCargado),
      c.cierreCalculado ?? "",
      c.saldoAlCierre ?? "",
      c.cierreCalculado != null && c.saldoAlCierre != null
        ? conFormula(`F${n}-G${n}`, c.diferencia ?? 0)
        : "no se puede controlar",
      c.desde ?? "", c.hasta ?? "", c.movimientos,
    ])
  }
  f.push([])

  const conControl = cadenas.filter(c => c.diferencia != null)
  const noCierran = conControl.filter(c => Math.abs(c.diferencia ?? 0) > 0.01)
  if (conControl.length === 0) {
    f.push(["No se pudo controlar ninguna cuenta: no hay movimientos con saldo en el ejercicio."])
  } else if (noCierran.length === 0) {
    f.push([`CONTROL OK — en ${conControl.length} cuenta(s) los movimientos explican el saldo al cierre, al centavo.`])
  } else {
    f.push([`ATENCION — en ${noCierran.length} cuenta(s) los movimientos NO explican el saldo al cierre:`])
    /**
     * 🔍 **Y se dice CUAL de las dos causas es**, porque mandan a lugares distintos: un salto solo es
     * un movimiento que falta (ahí está la plata); muchos saltos que se compensan es el orden mal, y
     * no falta un peso. Ver `saltos` en `saldos-al-inicio.ts`.
     */
    for (const c of noCierran) {
      const causa = c.saltos <= 1
        ? "parece faltar (o sobrar) UN movimiento: la plata esta ahi"
        : `el ORDEN de los movimientos no sigue a los saldos (${c.saltos} saltos que suman `
          + `${money(c.sumaDeSaltos)}): NO falta plata, lo que no sirve es el orden`
      f.push([`   ${c.cuenta}: diferencia ${money(c.diferencia ?? 0)} — ${causa}`])
    }
  }

  f.push([])
  f.push(["Como se lee: el ejercicio arranca en el Saldo al inicio; el Neto NO cargado son los meses"])
  f.push(["que el extracto de la app no tiene y se DEDUCEN del primer movimiento cargado (no hay que"])
  f.push(["cargarlos); despues se suma el neto de lo que si esta, y eso tiene que dar el saldo del extracto."])
  f.push([])
  for (const c of cadenas) {
    if (c.fuenteInicio) f.push([`Saldo al inicio de ${c.cuenta} — de donde sale: ${c.fuenteInicio}`])
  }
  const sinInicio = cadenas.filter(c => c.saldoInicio == null)
  if (sinInicio.length > 0) {
    f.push([`Sin saldo al inicio declarado: ${sinInicio.map(c => c.cuenta).join(", ")}.`])
    f.push(["Esas cuentas estan vacias en el sistema, asi que el saldo al inicio no sale de ningun lado."])
  }
  return f
}

const COLS_CADENA: Columna[] = [
  { ancho: 30 },                    // Cuenta
  { ancho: 18, z: MONEDA },         // Saldo al inicio
  { ancho: 18, z: MONEDA },         // Neto NO cargado
  { ancho: 22, z: MONEDA },         // Saldo al arrancar lo cargado
  { ancho: 18, z: MONEDA },         // Neto de lo cargado
  { ancho: 22, z: MONEDA },         // Saldo al cierre calculado
  { ancho: 18, z: MONEDA },         // Saldo del extracto
  { ancho: 16, z: MONEDA },         // Diferencia
  { ancho: 11 },                    // Desde
  { ancho: 11 },                    // Hasta
  { ancho: 9, z: ENTERO },          // Movim.
]

/**
 * 👷 La solapa **13 Sueldos** — el total de A y el total de B (A-FEAT-1216).
 *
 * Pedido del usuario: *«el export contable debe exportar sueldos! Debe dar el total de A y el total
 * de B»*. Van **abiertos por empleado y por mes**, porque es como está el dato y es lo que deja
 * revisar un número que no cierra.
 *
 * ⚠️ **Y con TODAS las columnas, no sólo A y B**: el bruto de un sueldo **no es A + B** — lleva los
 * francos y los extras —, así que un papel con dos columnas no cerraría contra lo que se pagó.
 *
 * 🧮 Cada fila trae **el bruto recompuesto desde sus partes** contra **el guardado**, y su diferencia.
 * Es el camino inverso: si no dan lo mismo, el papel lo dice antes de que lo vea el contador.
 */
function hojaDeSueldos(s: SueldosDelEjercicio, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`SUELDOS — ejercicio ${etiqueta}`])
  f.push(["El bruto NO es A + B: lleva ademas los francos (o el jornal) y los extras."])
  f.push(["La cuota alimentaria esta ADENTRO de A y se muestra aparte: no se suma al bruto."])
  f.push([])
  f.push([
    "Período", "Empresa", "Empleado", "Tipo", "Categoría A", "Categoría B",
    "de la cual, cuota alim.", "Francos", "Valor franco", "Por francos", "Por jornal",
    "Extras", "BRUTO", "Bruto recalculado", "Diferencia", "Pagado", "Saldo",
  ])

  const fila = (x: FilaSueldo) => [
    x.periodo, x.empresa, x.empleado, x.tipo,
    money(x.montoA), money(x.montoB), money(x.cuotaAlimentaria),
    x.francos, money(x.valorFranco), money(x.porFrancos), money(x.porJornal),
    money(x.extras), money(x.brutoGuardado), money(x.brutoCalculado), money(x.diferencia),
    money(x.pagado), money(x.saldo),
  ]

  const desde = f.length + 1
  s.filas.forEach(x => f.push(fila(x)))
  const hasta = f.length

  // 🔑 Los totales que él pidió, con fórmula para que sigan al filtro.
  f.push([
    "TOTAL", "", "", "",
    ...(["E", "F", "G"] as const).map((col, i) =>
      conFormula(`SUM(${col}${desde}:${col}${hasta})`,
        [s.total.montoA, s.total.montoB, s.total.cuotaAlimentaria][i])),
    "", "",
    conFormula(`SUM(J${desde}:J${hasta})`, s.total.porFrancos),
    conFormula(`SUM(K${desde}:K${hasta})`, s.total.porJornal),
    conFormula(`SUM(L${desde}:L${hasta})`, s.total.extras),
    conFormula(`SUM(M${desde}:M${hasta})`, s.total.bruto),
    "", "",
    conFormula(`SUM(P${desde}:P${hasta})`, s.total.pagado),
    conFormula(`SUM(Q${desde}:Q${hasta})`, s.total.saldo),
  ])

  f.push([])
  f.push([])
  f.push(["POR MES — como evolucionaron A y B a lo largo del ejercicio"])
  f.push(["Mes", "Categoría A", "Categoría B", "Bruto"])
  s.porMes.forEach(m => f.push([m.periodo, money(m.montoA), money(m.montoB), money(m.bruto)]))

  f.push([])
  // 🧮 El control, al final y proporcional.
  if (s.descuadres.length === 0) {
    f.push([`CONTROL OK — el bruto recompuesto da el guardado en las ${s.filas.length} filas.`])
  } else {
    f.push([`ATENCION — en ${s.descuadres.length} fila(s) el bruto recompuesto NO da el guardado:`])
    s.descuadres.forEach(d =>
      f.push([`   ${d.periodo} ${d.empleado}: guardado ${money(d.brutoGuardado)} · recalculado `
        + `${money(d.brutoCalculado)} · diferencia ${money(d.diferencia)}`]))
    f.push(["Alguna de las dos esta mal. No se puede entregar el numero sin mirarlo."])
  }
  if (s.mesesVacios.length > 0) {
    f.push([`ATENCION — ${s.mesesVacios.length} mes(es) del ejercicio sin ningun sueldo cargado: `
      + s.mesesVacios.join(", ")])
  }
  // 👷 JMS 05/11: «sueldos a pagar va aparte — puede ir en el detalle que ya se exporta de sueldos» (no en 04 ni en el libro F).
  const ia = s.impagosAlCierre
  if (ia && (ia.filas.length || ia.pagadosPorFuera.length)) {
    f.push([])
    f.push([])
    f.push(["SUELDOS A PAGAR AL CIERRE — devengados en el ejercicio y pagados después (manda la fecha de cada pago; sin José, Andrés ni MA)"])
    f.push(["Período", "Empleado", "Bruto", "Pagado al cierre", "Pagado después", "Fecha del pago"])
    const d0 = f.length + 1
    ia.filas.forEach(x => f.push([x.periodo, x.empleado, money(x.bruto), money(x.pagadoAlCierre), money(x.pagadoDespues), x.fechaPago ?? ""]))
    const d1 = f.length
    if (ia.filas.length) f.push(["TOTAL A PAGAR AL CIERRE", "", "", "", conFormula(`SUM(E${d0}:E${d1})`, money(ia.total))])
    if (ia.pagadosPorFuera.length) {
      f.push([])
      f.push([`Pagados en efectivo desde Caja Sigot, sin el pago cargado en Sueldos (NO son deuda): ${ia.pagadosPorFuera.map(x => `${x.periodo} ${x.empleado}`).join(" · ")} — ${money(ia.totalPagadosPorFuera)}`])
    }
    if (ia.aConfirmar.length) f.push([`A confirmar (sin pago cargado): ${ia.aConfirmar.map(x => `${x.periodo} ${x.empleado} ${money(x.sinPagar)}`).join(" · ")}`])
  }
  return f
}

const COLS_SUELDOS: Columna[] = [
  { ancho: 10 },                    // Período
  { ancho: 9 },                     // Empresa
  { ancho: 24 },                    // Empleado
  { ancho: 13 },                    // Tipo
  { ancho: 16, z: MONEDA },         // Categoría A
  { ancho: 16, z: MONEDA },         // Categoría B
  { ancho: 18, z: MONEDA },         // cuota alimentaria
  { ancho: 9, z: COEFICIENTE },     // Francos
  { ancho: 14, z: MONEDA },         // Valor franco
  { ancho: 15, z: MONEDA },         // Por francos
  { ancho: 15, z: MONEDA },         // Por jornal
  { ancho: 14, z: MONEDA },         // Extras
  { ancho: 17, z: MONEDA },         // BRUTO
  { ancho: 17, z: MONEDA },         // Bruto recalculado
  { ancho: 13, z: MONEDA },         // Diferencia
  { ancho: 16, z: MONEDA },         // Pagado
  { ancho: 16, z: MONEDA },         // Saldo
]

/**
 * 🧾 La solapa **14 Cuentas corrientes** — el saldo al cierre con cada contraparte (A-FEAT-1218).
 *
 * Pedido del usuario: *«él le factura a la SRL y cobra mensual (…) **es una cuenta corriente, se
 * debería reflejar el saldo a cierre de balance**»*. Y su definición, que es la que gobierna el
 * signo: *«si AMS factura 100 y cobré 120, debe 20; si cobré 90, tiene a cobrar 10»*.
 *
 * 📋 **Primero el resumen** —una fila por contraparte con su saldo— y **después el detalle** de cada
 * una, asiento por asiento con el saldo acumulado. El resumen es lo que va al balance; el detalle es
 * lo que deja revisar un número que no cierra.
 *
 * 🛑 **Y al final, lo que NO se trató todavía**, por pedido expreso suyo: *«no es lo mismo todo lo
 * relacionado a RET, RET 3, AP; debemos ir tratando cada cosa a la vez»*. No se reparte ni se
 * esconde — se muestra con su total, que es cuánta plata falta encuadrar.
 */
export function hojaDeCuentasCorrientes(cc: PapelDeCuentasCorrientes, fechaCierre: string,
  /** 👥 A-FEAT-1537: «CUENTAS CORRIENTES — clientes y proveedores» o «… con los socios». */
  titulo = "CUENTAS CORRIENTES", nota?: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`${titulo} — saldo al ${fechaCierre}`])
  if (nota) f.push([nota])
  f.push(["Saldo positivo = le debemos. Negativo = tenemos a cobrar."])
  // ✍️ A-FEAT-1388 — usuario 27/10: «poner saldo de inicio cero y que dé lo que dé, pero luego podremos modificar».
  f.push(["Saldo de INICIO: el cargado en la pantalla del balance; si no hay, 0 marcado «sin dato». El SALDO AL CIERRE es formula: se puede cambiar el inicio aca."])
  f.push([])
  f.push(["Contraparte", "CUIT", "Saldo al INICIO", "Facturado", "Vendido (compensa)",
    "Pagado/cobrado", "Movimiento del ejercicio", "SALDO AL CIERRE", "Cómo se lee"])

  const desde = f.length + 1
  for (const c of cc.cuentas) {
    const n = f.length + 1
    f.push([
      c.contraparte.nombre,
      c.contraparte.cuit,
      money(c.saldoInicio),
      money(c.resumen.totalComprado),
      money(c.resumen.totalVendido),
      money(c.resumen.totalPagado),
      money(c.resumen.saldo),
      // ✍️ A-FEAT-1537: si el usuario decidió el saldo al cierre, el ajuste va en la fórmula y su motivo en «Cómo se lee».
      conFormula(c.ajusteCierre ? `C${n}+G${n}+(${money(c.ajusteCierre.importe)})` : `C${n}+G${n}`, money(c.saldoAlCierre)),
      // 🎚️ El 0 de un inicio sin cargar es un default, no un dato: se dice (y sale en ámbar).
      c.inicioSinDato
        ? `sin dato de inicio (0 por default) · ${leyendaSaldo(c.saldoAlCierre)}`
        // 🤖 A-FEAT-1386: el inicio que puso Claude y espera el OK de JMS se dice en el Excel
        : c.inicioTentativo ? `${c.inicioTentativo} · ${leyendaSaldo(c.saldoAlCierre)}` : leyendaSaldo(c.saldoAlCierre),
    ].map((v, i, a) => i === a.length - 1
      ? `${v}${extraCC(c)}${c.ajusteCierre ? ` · AJUSTE AL CIERRE ${fmtAr(c.ajusteCierre.importe)}: ${c.ajusteCierre.motivo}` : ""}` : v))
  }
  const hasta = f.length
  f.push(["TOTAL", "", ...(["C", "D", "E", "F", "G", "H"] as const).map((col, i) =>
    conFormula(`SUM(${col}${desde}:${col}${hasta})`, money([
      cc.cuentas.reduce((s, c) => s + c.saldoInicio, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalComprado, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalVendido, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.totalPagado, 0),
      cc.cuentas.reduce((s, c) => s + c.resumen.saldo, 0),
      cc.cuentas.reduce((s, c) => s + c.saldoAlCierre, 0),
    ][i])))])

  // ── 🛑 Lo que falta encuadrar ────────────────────────────────────────────────────────
  if (cc.sinTratar.length > 0) {
    f.push([])
    f.push([])
    f.push(["TODAVIA SIN TRATAR — marcas del extracto que no son ninguna de estas cuentas"])
    f.push(["Se muestran enteras y NO se reparten: cada una se trata por separado."])
    f.push(["Marca en la columna Contable", "Movimientos", "Total"])
    cc.sinTratar.forEach(x => f.push([x.etiqueta, x.movimientos, money(x.total)]))
    f.push(["TOTAL SIN TRATAR", "", money(cc.totalSinTratar)])
  }

  // ── 💳 «Desglosar» abierto con los consumos de la tarjeta (A-FEAT-1388) ─────────────────
  const dt = cc.desgloseTarjeta
  if (dt && dt.pagos.length > 0) {
    f.push([])
    f.push([])
    f.push(["DESGLOSAR — los pagos de la tarjeta Visa Business de MSA, abiertos con los consumos de su resumen"])
    f.push(["Cada consumo va con SU marca de la tarjeta. Lo marcado para otra persona sigue sin tratar bajo esa marca; lo sin marca es gasto de MSA."])
    f.push(["Destino", "Póliza", "Consumos", "Importe", "Qué es"])
    const n0 = f.length + 1
    dt.porDestino.forEach(d => f.push([d.destino, d.poliza ? "SÍ — póliza" : "", d.consumos, money(d.importe), d.ejemplos.join(" · ")]))
    const nT = f.length + 1
    // 🧮 Dos caminos: la suma de los destinos (consumo por consumo) contra los débitos del banco.
    const abierto = money(dt.porDestino.reduce((s, d) => s + d.importe, 0))
    f.push(["TOTAL ABIERTO", "", "", conFormula(`SUM(D${n0}:D${nT - 1})`, abierto)])
    if (dt.sinAbrir !== 0) f.push(["⚠️ Sin resumen que lo abra (queda como Desglosar)", "", "", money(dt.sinAbrir)])
    f.push(["Pagos del banco marcados Desglosar", "", "", money(dt.total)])
    const dif = money(dt.total - abierto - dt.sinAbrir)
    f.push(["CONTROL: pagos del banco − (lo abierto + lo sin abrir) (tiene que dar 0)", "", "", money(dif), Math.abs(dif) < 0.01 ? "cuadra" : "NO CUADRA"])
    f.push([])
    f.push(["Pago del banco", "Débitos", "Importe del pago", "Consumos del resumen", "Diferencia", "Control"])
    dt.pagos.forEach(p => f.push([p.fecha, p.debitos, money(p.importe), money(p.importe - p.diferencia), money(p.diferencia),
      p.cierra ? "cuadra" : p.partes.length === 0 ? "NO CUADRA: no hay resumen que venza ese día" : "NO CUADRA: los consumos no dan el pago"]))
  }
  if (cc.historicoSinAtribuir > 0) {
    f.push([])
    f.push([`${cc.historicoSinAtribuir} comprobante(s) del sistema anterior no se pudieron atribuir `
      + "a ninguna de estas cuentas (el historico no guarda CUIT, se une por nombre)."])
  }

  // ── 🛡️ Las aseguradoras: saldo de DOCUMENTACIÓN al cierre (A-FEAT-1385) ─────────────────
  for (const a of cc.aseguradoras ?? []) {
    f.push([])
    f.push([])
    f.push([`ASEGURADORA — ${a.nombre} — saldo de documentación al ${a.fechaCierre}`])
    f.push(["Sale de las pólizas (cuotas y notas de crédito de sus PDF) contra los débitos y reintegros del banco, estén o no conciliados."])
    f.push(["Saldo positivo = nos debitaron o acreditaron algo que ningún comprobante cierra (FALTAN COMPROBANTES). Negativo = la aseguradora nos debe."])
    const nSaldo = f.length + 1
    f.push(["SALDO AL CIERRE", "", money(a.saldo), a.saldo === 0 ? "✓ papeles y plata coinciden" : "⚠️ FALTAN COMPROBANTES: reclamar lo de abajo"])
    if (a.aReclamar.length) {
      f.push(["A reclamar", "Póliza", "Importe", "Qué es", "Desde"])
      // Agrupado: «Notas de crédito pendientes» (falta el papel) aparte de «Saldo a favor pendiente» (falta la plata).
      const cats = [...new Set(a.aReclamar.map(x => x.categoria))]
      for (const cat of cats) {
        const del = a.aReclamar.filter(x => x.categoria === cat)
        del.forEach(x => {
          f.push([cat, x.poliza ?? "", money(x.importe), x.que, x.desde ? `viene de ${x.desde}` : ""])
          // Desde el monto de la póliza, para poder controlarlo: facturado − NC = neto; pagado; diferencia.
          if (x.explicacion) f.push(["", "", "", `Facturado ${money(x.explicacion.facturado)} − NC ${money(-x.explicacion.notasCredito)} = neto ${money(x.explicacion.neto)} · pagado ${money(x.explicacion.pagado)}`])
        })
        if (del.length > 1) f.push([`Subtotal ${cat}`, "", money(Math.round(del.reduce((t, x) => t + x.importe, 0) * 100) / 100)])
      }
    }
    if (!a.cierra) f.push(["🛑 CONTROL: la suma de «a reclamar» no da el saldo de la cuenta corriente. Avisar."])
    f.push([])
    f.push([`DETALLE — cuenta corriente con ${a.nombre}`])
    f.push(["Fecha", "Póliza", "Concepto", "Cargo", "Crédito", "Saldo"])
    a.lineas.forEach(l => f.push([l.fecha, l.poliza ?? "", l.concepto, l.cargo ? money(l.cargo) : "", l.credito ? money(l.credito) : "", money(l.saldo)]))
    /**
     * 🧮 A-FEAT-1388 — usuario 27/10: *«¿esto no debería dar mismo resultado de lo de arriba?»*. Da lo
     * mismo, pero el papel no lo mostraba: el saldo final del detalle tiene que ser el SALDO AL CIERRE.
     */
    if (a.lineas.length > 0) {
      const nUltima = f.length
      const final = a.lineas[a.lineas.length - 1].saldo
      const dif = money(final - a.saldo)
      f.push(["CONTROL: saldo final del detalle − SALDO AL CIERRE de arriba (tiene que dar 0)", "", "", "", "",
        conFormula(`F${nUltima}-C${nSaldo}`, dif), Math.abs(dif) < 0.01 ? "cuadra" : "NO CUADRA"])
    }

    // 🚗 A-FEAT-1422 nota 9 (JMS 29/10): el desglose de la FLOTA, tabla aparte.
    const rf = a.repartoFlota
    if (rf && rf.filas.length) {
      f.push([])
      f.push([`DESGLOSE DE LA FLOTA — cada débito del ejercicio repartido por vehículo (prima de cada uno)`])
      f.push(["Lo que no es de MSA lo pagó MSA por otro: va a su cuenta corriente / Distribuciones. El responsable de cada vehículo se edita en Egresos → Seguros."])
      f.push(["Fecha débito", "Póliza", "Vencimiento", "Debitado", ...rf.responsables, "Control"])
      const n0 = f.length + 1
      rf.filas.forEach((x, i) => {
        const fila = n0 + i
        const ultimaParte = XLSX.utils.encode_col(3 + rf.responsables.length)
        f.push([x.fecha, x.poliza, x.vencimiento, money(x.debitado), ...rf.responsables.map(r => money(x.partes[r] ?? 0)),
          conFormula(`D${fila}-SUM(E${fila}:${ultimaParte}${fila})`, 0)])
      })
      const nf = n0 + rf.filas.length - 1
      f.push(["TOTAL", "", "", conFormula(`SUM(D${n0}:D${nf})`, rf.total),
        ...rf.responsables.map((r, i) => { const col = XLSX.utils.encode_col(4 + i); return conFormula(`SUM(${col}${n0}:${col}${nf})`, rf.totales[r] ?? 0) })])
      if (rf.sinReparto) f.push([`⚠️ ${money(rf.sinReparto)} de débitos sin vehículos leídos en su póliza: van enteros a MSA.`])
    }
  }

  // ── El detalle de cada cuenta ────────────────────────────────────────────────────────
  for (const c of cc.cuentas) {
    if (c.resumen.asientos.length === 0) continue
    /**
     * 👥 A-FEAT-1577 (JMS 07/11): el detalle de un SOCIO es UNA sola tabla, con un subtítulo y un subtotal por cuenta (facturas y sueldo ·
     * MSA Galicia —por agrupadora o template— · MSA VISA · las cuentas del socio), y DEBE / HABER en vez de un importe con signo:
     * *«ayuda a ver de qué lado está para entender»*. El saldo arranca en el de inicio y termina en el de cierre (control abajo).
     */
    if (c.contraparte.socio) {
      f.push([])
      f.push([])
      f.push([`DETALLE — ${c.contraparte.nombre} (una sola tabla: cada cuenta con su subtítulo y su subtotal)`])
      f.push(["DEBE = MSA le pagó o él retiró (baja lo que MSA le debe) · HABER = MSA le debe más (su factura, su sueldo, lo que él pagó por MSA)."])
      f.push(["Cuenta", "Fecha", "Qué es", "Debe", "Haber", "Saldo acumulado", "Agrupadora / template", "Concepto", "Otra punta"])
      const ORDEN = [CUENTA_FACTURAS, "MSA Galicia cta cte", "MSA VISA"]
      const cuentaDe = (x: { cuenta?: string }) => x.cuenta ?? "MSA Galicia cta cte"
      const rango = (b: string) => { const i = ORDEN.indexOf(b); return i < 0 ? 99 : i }
      const bloques = [...new Set(c.resumen.asientos.map(cuentaDe))].sort((a, b) => rango(a) - rango(b) || a.localeCompare(b, "es"))
      let saldo = c.saldoInicio, totDebe = 0, totHaber = 0
      f.push(["Saldo al inicio", "", "", "", "", money(saldo)])
      for (const b of bloques) {
        const del = c.resumen.asientos.filter(x => cuentaDe(x) === b)
          .sort((x, y) => (b === "MSA Galicia cta cte" ? String(x.grupo ?? "").localeCompare(String(y.grupo ?? ""), "es") : 0) || x.fecha.localeCompare(y.fecha))
        f.push([`▸ ${b}`])
        let debe = 0, haber = 0
        for (const x of del) {
          const d = x.importe < 0 ? -x.importe : 0, h = x.importe > 0 ? x.importe : 0
          debe += d; haber += h; saldo += x.importe
          f.push([b, x.fecha,
            x.tipo === "compra" ? "nos factura / sueldo" : x.tipo === "venta" ? "le facturamos" : x.importe > 0 ? "pagó por MSA / aportó" : "MSA le pagó / retiró",
            d ? money(d) : "", h ? money(h) : "", money(saldo), x.grupo ?? "",
            x.sinReferencia ? `${x.concepto}  ← sin referencia` : x.concepto, x.otraPunta ?? ""])
        }
        totDebe += debe; totHaber += haber
        f.push([`Subtotal ${b}`, "", "", money(debe), money(haber)])
      }
      const esperado = money(c.saldoInicio + c.resumen.saldo)
      f.push(["SALDO AL CIERRE (del detalle)", "", "", money(totDebe), money(totHaber), money(saldo),
        Math.abs(money(saldo) - esperado) < 0.01 ? "✓ cuadra con el resumen de arriba" : `🛑 NO CUADRA con el resumen (${fmtAr(esperado)})`])
      if (c.resumen.pagosSinReferencia > 0) f.push([`${c.resumen.pagosSinReferencia} pago(s) no dicen contra que comprobante fueron.`])
      const faltan = c.resumen.asientos.filter(x => String(x.otraPunta ?? "").startsWith("🔴")).length
      if (faltan) f.push([`⚠️ ALERTA: ${faltan} transferencia(s) a ${c.contraparte.nombre} sin su otra punta en la cuenta del socio (columna «Otra punta»).`])
      continue
    }
    f.push([])
    f.push([])
    f.push([`DETALLE — ${c.contraparte.nombre}`])
    f.push(["Fecha", "Qué es", "Concepto", "Importe", "Saldo acumulado"])
    for (const x of c.resumen.asientos) {
      f.push([
        x.fecha,
        x.tipo === "compra" ? "nos factura" : x.tipo === "venta" ? "le facturamos" : "pago",
        // 🔴 Un pago que no dice contra qué fue es el que genera saldo sin que nadie lo note.
        x.sinReferencia ? `${x.concepto}  ← sin referencia` : x.concepto,
        money(x.importe),
        money(x.saldo),
      ])
    }
    if (c.resumen.pagosSinReferencia > 0) {
      f.push([`${c.resumen.pagosSinReferencia} pago(s) no dicen contra que comprobante fueron.`])
    }
    // 🔁 A-FEAT-1499: lo que entra por CUIT sin marca todavía suma, pero se dice (falta encuadrarlo en el recorrido).
    if (c.sinMarcar?.movimientos) {
      f.push([`⚠️ ${c.sinMarcar.movimientos} movimiento(s) del banco con su CUIT, sin marcar ni conciliar (${"$ " + fmtAr(c.sinMarcar.total)}): ya suman al saldo; se encuadran en el recorrido («Va por su cuenta corriente»).`])
    }
  }
  return f
}

const COLS_CUENTAS_CORRIENTES: Columna[] = [
  { ancho: 34 },                    // Contraparte / Fecha
  { ancho: 14 },                    // CUIT / Qué es
  { ancho: 18, z: MONEDA },         // Saldo al inicio / Concepto
  { ancho: 18, z: MONEDA },         // Facturado / Importe
  { ancho: 18, z: MONEDA },         // Vendido / Saldo acumulado
  { ancho: 18, z: MONEDA },         // Pagado
  { ancho: 20, z: MONEDA },         // Movimiento del ejercicio
  { ancho: 20, z: MONEDA },         // SALDO AL CIERRE
  { ancho: 26 },                    // Cómo se lee
]

/**
 * 🧾 La solapa **03.1 Provisión de cobros** — el espejo del papel 05, del lado de las ventas.
 *
 * *«Facturas o liquidaciones (siempre de venta) de cosas que sucedieron antes del cierre y se
 * emitieron después»* — la definición es suya, de la hoja `PROVISION COBROS`.
 *
 * 📌 Es exactamente la misma regla que la provisión de facturas: **fecha ≤ cierre, subdiario
 * posterior**. Por eso no hay que marcar nada a mano: la marca ya está, es el subdiario.
 *
 * 🚫 Y abajo va el bloque de **cheques en cartera diciendo que no hay registro**. Omitirlo se leería
 * como *«no había»*, que no es lo mismo que *«no lo sabemos»*.
 */
/**
 * 📒 «Asientos Contables» (A-FEAT-1318): las facturas no informadas en ARCA que no entraron en ningún
 * subdiario, para que el contador las registre con asientos. Del ejercicio por su fecha de emisión.
 */
export function hojaDeAsientosContables(asientos: AsientoLibroDiario[], etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`ASIENTOS CONTABLES — ejercicio ${etiqueta}`])
  f.push(["Facturas NO informadas en ARCA que no van al subdiario de IVA: se registran con asientos contables."])
  f.push(["No están en ningún subdiario (ni en el Libro IVA): pertenecen al ejercicio por su fecha de emisión."])
  f.push([])
  hojaDeAsientos(asientos).forEach(r => f.push(r))
  if (asientos.length > 0) {
    // La fila 5 es la cabecera, así que el detalle arranca en la 6. Columnas H..M = Neto … Total.
    const desde = 6
    const hasta = 5 + asientos.length
    const suma = (k: keyof AsientoLibroDiario) => money(asientos.reduce((s, a) => s + (Number(a[k]) || 0), 0))
    f.push(["", "", "", "", "", "", "TOTAL",
      conFormula(`SUM(H${desde}:H${hasta})`, suma("neto_gravado")),
      conFormula(`SUM(I${desde}:I${hasta})`, suma("no_gravado")),
      conFormula(`SUM(J${desde}:J${hasta})`, suma("exento")),
      conFormula(`SUM(K${desde}:K${hasta})`, suma("otros_tributos")),
      conFormula(`SUM(L${desde}:L${hasta})`, suma("iva")),
      conFormula(`SUM(M${desde}:M${hasta})`, suma("total"))])
  } else {
    f.push([])
    f.push(["NO HAY facturas en «Asientos Contables» en este ejercicio."])
  }
  return f
}

export function hojaDeProvisionCobros(ventas: AsientoLibroDiario[], etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`PROVISIÓN DE COBROS — ejercicio ${etiqueta}`])
  f.push(["Ventas de cosas que pasaron ANTES del cierre y se facturaron DESPUES:"])
  f.push(["fecha del comprobante anterior al cierre, pero entro en un subdiario posterior."])
  f.push([])
  const tabla = hojaDeAsientos(ventas)
  // 📎 A-FEAT-1571: la factura que respalda cada venta provisionada
  if (ventas.length) { tabla[0] = [...tabla[0], "Respaldo"]; ventas.forEach((a, i) => { tabla[i + 1] = [...tabla[i + 1], celdaRespaldo(respaldoDeComprobante(a))] }) }
  tabla.forEach(r => f.push(r))
  if (ventas.length > 0) {
    // ⚠️ cambió 06/11 (JMS: «el total no está sumando»): sumaba sólo la M, que desde que se agregaron columnas es el IVA.
    //    Ahora suma todas las columnas de importes, igual que la 05.
    f.push(filaTotalComprobantes(tabla.slice(1), f.length - ventas.length + 1, f.length))
    // ✍️ JMS 05/11 (03.1): «motivo de provisión venta: una línea para cada una provisionada según mi input de por qué se
    //    provisiona» — «sin amarillo, pero que se destaque».
    const conMotivo = ventas.filter(a => a.provision_motivo)
    if (conMotivo.length) {
      f.push([])
      const destacada = (t: string) => ({ t: "s", v: t, s: { font: { bold: true, color: { rgb: "1F4E4A" } },
        fill: { patternType: "solid", fgColor: { rgb: "DDEBF7" } } } })
      for (const a of conMotivo) {
        const fila: unknown[] = [destacada(`* Motivo de provisión — ${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""} del ${a.fecha ? a.fecha.split("-").reverse().join("/") : ""}: ${a.provision_motivo}`)]
        for (let i = 1; i < 7; i++) fila.push(destacada(""))
        f.push(fila)
      }
    }
  }
  if (ventas.length === 0) {
    f.push([])
    f.push(["NO HAY ventas a provisionar: ninguna con fecha anterior al cierre entró en un "
      + "subdiario posterior. El año pasado tampoco hubo."])
  }

  f.push([])
  f.push([])
  f.push(["CHEQUES EN CARTERA — NO SE PUEDE CALCULAR: el sistema no registra valores recibidos"])
  f.push(["La tabla de cheques guarda solo los que EMITIMOS (el beneficiario es el proveedor)."])
  f.push(["No hay tabla de cheques de clientes, asi que este bloque no sale del sistema: hay que"])
  f.push(["cargarlo a mano si hubiera. En el balance anterior no habia ninguno. Ver A-DAT-74."])
  f.push([])
  f.push(["ANTICIPOS DE CLIENTES (cobros a cuenta) — están en la solapa «04.2 Anticipos»"])
  f.push(["Salen de la misma tabla que los anticipos a proveedores, por eso van juntos alli."])
  return f
}

/**
 * 🗂️ La solapa **00 Índice** — la primera que se abre.
 *
 * Es el checklist de los papeles con lo que hay y lo que falta de cada uno, **calculado del dato**
 * (ver `indice-papeles.ts`). Arriba, separados, los que **impiden entregar**: § 🧮 de `CLAUDE.md`,
 * *el control se ve y es proporcional*.
 */
function hojaDeIndice(indice: IndiceDelBalance, libro: LibroDiario, empresa: string): unknown[][] {
  const f: unknown[][] = []
  const ej = libro.ejercicio

  f.push([`PAPELES DE TRABAJO DEL BALANCE — ${empresa} — EJERCICIO ${ej.etiqueta}`])
  f.push([`Cierre: ${ej.fechaCierre}`])
  f.push([`Generado: ${new Date().toISOString().slice(0, 10)}`])
  f.push([])
  f.push(["Los 9 papeles son los que se le mandaron al contador el balance anterior."])
  f.push(["El estado de cada uno NO esta escrito a mano: sale de mirar el dato de este mismo archivo."])
  f.push([])

  const c = indice.cuenta
  f.push(["RESUMEN", `${c.completo} completos`, `${c.parcial} parciales`,
    `${c.falta} sin armar`, `${c["lo carga el usuario"]} los carga el usuario`])
  f.push([])

  if (indice.bloqueos.length > 0) {
    f.push([`NO SE PUEDE ENTREGAR TODAVIA — ${indice.bloqueos.length} bloqueo(s)`])
    indice.bloqueos.forEach(b => f.push(["", `${b.numero} ${b.papel}`, b.queFalta]))
    f.push([])
    f.push(["El archivo se genera igual: es la forma de ver donde esta el problema."])
    f.push([])
  } else {
    f.push(["Sin bloqueos: los papeles que estan armados se pueden entregar."])
    f.push([])
  }

  f.push(["#", "Papel", "Estado", "Que hay hoy", "Que falta", "Solapa"])
  for (const p of indice.partes) {
    f.push([p.numero, p.papel, etiquetaEstado(p.estado), p.queTiene, p.queFalta, p.solapa])
  }
  return f
}

/** El estado en palabras. Sin emojis: el contador lo abre en Excel y los emojis no siempre salen. */
const etiquetaEstado = (e: EstadoParte): string => ({
  completo: "COMPLETO",
  parcial: "PARCIAL",
  falta: "SIN ARMAR",
  "lo carga el usuario": "LO CARGA EL USUARIO",
}[e])

/** La solapa de pendientes: número, texto largo, fechas y la resolución. */
/** 🔁 A-FEAT-1499: en «Cómo se lee», lo que la cuenta incluye por ir por CUIT (retenciones y sin marcar). */
function extraCC(c: PapelDeCuentasCorrientes["cuentas"][number]): string {
  const partes: string[] = []
  if (c.retenciones) partes.push(`incluye retenciones sufridas ${"$ " + fmtAr(c.retenciones)} como cobrado`)
  if (c.sinMarcar?.movimientos) partes.push(`${c.sinMarcar.movimientos} mov. sin marcar`)
  return partes.length ? ` · ${partes.join(" · ")}` : ""
}

const COLS_PENDIENTES: Columna[] = [
  { ancho: 4 }, { ancho: 80 }, { ancho: 11 }, { ancho: 10 }, { ancho: 50 }, { ancho: 11 }, { ancho: 30 },  // ✔ Visto (A-FEAT-1487)
  { ancho: 26 }, { ancho: 90 },  // 🔁 A-FEAT-1500: Tarea · Conversación
]

/** 📦 A-FEAT-1501 — la solapa «00 Stocks inicio y cierre». */
const COLS_STOCKS: Columna[] = [
  { ancho: 12 }, { ancho: 40 }, { ancho: 14 },
  { ancho: 12, z: "#,##0.00" }, { ancho: 14, z: MONEDA }, { ancho: 16, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 16, z: MONEDA },
  { ancho: 12, z: "#,##0.00" }, { ancho: 14, z: MONEDA }, { ancho: 16, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 16, z: MONEDA },
  { ancho: 22 }, { ancho: 60 }, { ancho: 50 },
]

/** 🔁 A-FEAT-1500 — la solapa «00 Recorrido». */
const COLS_RECORRIDO: Columna[] = [
  { ancho: 4 }, { ancho: 20 }, { ancho: 28 }, { ancho: 60 }, { ancho: 70 }, { ancho: 50 }, { ancho: 16 }, { ancho: 26 }, { ancho: 90 },
]

const COLS_INDICE: Columna[] = [
  { ancho: 7 },                     // #
  { ancho: 46 },                    // Papel
  { ancho: 21 },                    // Estado
  { ancho: 60 },                    // Que hay hoy
  { ancho: 70 },                    // Que falta
  { ancho: 42 },                    // Solapa
]

/**
 * 🏦 La solapa **07 Bancos** — saldos al cierre y fondos comunes.
 *
 * ⚠️ Dos cosas van **vacías a propósito** y el papel lo dice: el **saldo al inicio** del ejercicio
 * (no está en el sistema) y el **saldo del fondo** en las dos puntas (el extracto ve la plata que
 * entra y sale de la cuenta, no cuánto quedó invertido). Sin esos números el resultado financiero
 * **no se puede calcular**, y mostrar un cero ahí parecería un resultado.
 */
export function hojaDeBancos(
  saldos: Array<SaldoParaBalance>,
  fci: { fondos: FondoComun[]; total: FondoComun },
  fechaCierre: string,
  /** 🏦 La cadena inicio → cierre de cada cuenta (A-FEAT-1206). Vacío = no se pudo armar. */
  cadenas: CadenaDeSaldos[] = [],
  /** 💹 JMS 06/11: la tenencia del FCI (cuotapartes y valor, inicio y cierre) de los resúmenes PDF, ya cargada en la app. */
  tenencia: TenenciaFci | null = null,
  /** 📎 Los extractos y resúmenes vinculados (A-FEAT-1571): el saldo abre su documento. */
  documentos: DocumentoRespaldo[] = [],
): unknown[][] {
  const f: unknown[][] = []
  // 🔢 JMS 06/11: «dos decimales y entre paréntesis el negativo» (la columna B lleva 4 decimales por las cuotapartes de abajo).
  const PLATA = "#,##0.00;(#,##0.00)"
  const plata = (v: number | null | undefined) => (v == null ? "" : { t: "n", v, z: PLATA })
  f.push([`SALDOS BANCARIOS Y DE CAJA AL ${fechaCierre}`])
  f.push([])
  const enPesos = saldos.filter(s => s.moneda !== "USD"), enDolares = saldos.filter(s => s.moneda === "USD")
  f.push(["Cuenta", "Saldo al cierre $", "Fecha del ultimo movimiento", "Saldo al INICIO del ejercicio $", "Respaldo del saldo al cierre"])
  const desde = f.length + 1
  for (const s of enPesos) {
    const c = cadenas.find(x => x.cuenta === s.nombre)
    f.push([
      s.nombre, s.saldo == null ? "sin saldo en el periodo" : plata(s.saldo), s.fecha ?? "",
      /**
       * 🎚️ El saldo al inicio viene puesto **si está declarado**, y la celda sigue siendo suya
       * (§ 🎚️ *default del dato real, siempre editable*). Donde no se conoce, se dice — antes iba
       * vacío en todas y no se distinguía «no lo sabemos» de «es cero».
       */
      plata(c?.saldoInicio ?? null),
      // 📎 A-FEAT-1571 (JMS 06/11: «los saldos son los extractos donde figuran»)
      celdaRespaldo(respaldoDeSaldo(s.nombre, fechaCierre, s.nroResumen, s.saldo == null, documentos)),
    ])
  }
  const hasta = f.length
  f.push(["TOTAL EN PESOS",
    { ...conFormula(`SUM(B${desde}:B${hasta})`, money(enPesos.reduce((t, s) => t + (s.saldo ?? 0), 0))), z: PLATA },
    "",
    { ...conFormula(`SUM(D${desde}:D${hasta})`, money(cadenas.reduce((t, c) => t + (c.saldoInicio ?? 0), 0))), z: PLATA }])
  /**
   * 💵 JMS 06/11 (nota en la 07): «la caja en U$S expresada en U$S. Dos totales distintos, en U$S y en pesos. Y si querés,
   * como detalle queda la expresión en pesos de los dólares» — las cuentas en dólares, en dólares, con su total aparte;
   * a la derecha, el TC de cierre y el equivalente en pesos (detalle, no suma con los pesos).
   */
  if (enDolares.length) {
    f.push([])
    f.push(["Cuenta en dólares", "Saldo al cierre U$S", "Fecha del ultimo movimiento", "Saldo al INICIO del ejercicio U$S", "TC al cierre", "En pesos (detalle)", "Respaldo del saldo al cierre"])
    const d0 = f.length + 1
    for (const s of enDolares) {
      const r = f.length + 1
      f.push([s.cuenta ?? s.nombre, s.usd == null ? "sin movimientos cargados" : plata(s.usd), s.usd == null ? "" : (s.fecha ?? ""), plata(s.usdInicio ?? null),
        s.tc == null ? "" : { t: "n", v: s.tc, z: "#,##0.00" },
        s.usd == null || s.tc == null ? "" : { t: "n", f: `B${r}*E${r}`, v: Math.round(s.usd * s.tc * 100) / 100, z: PLATA },
        celdaRespaldo(respaldoDeSaldo(s.cuenta ?? s.nombre, fechaCierre, s.nroResumen, s.usd == null, documentos))])
    }
    const d1 = f.length
    const conUsd = enDolares.filter(s => s.usd != null)
    f.push(["TOTAL EN DÓLARES", { ...conFormula(`SUM(B${d0}:B${d1})`, money(conUsd.reduce((t, s) => t + (s.usd ?? 0), 0))), z: PLATA }, "",
      { ...conFormula(`SUM(D${d0}:D${d1})`, money(enDolares.reduce((t, s) => t + (s.usdInicio ?? 0), 0))), z: PLATA }, "",
      { ...conFormula(`SUM(F${d0}:F${d1})`, money(conUsd.reduce((t, s) => t + (s.usd != null && s.tc != null ? Math.round(s.usd * s.tc * 100) / 100 : 0), 0))), z: PLATA }])
    const fte = enDolares.find(s => s.fuenteTc)?.fuenteTc
    if (fte) f.push([`TC al cierre: ${fte}. Los pesos de la derecha son sólo el detalle: no se suman al total en pesos.`])
  }
  f.push([])
  f.push(["El saldo al cierre es el del ULTIMO movimiento del ejercicio, tomado por fecha Y por orden"])
  f.push(["dentro del dia: el 30/06 hay 10 movimientos y entre el primero y el ultimo hay $2,58 M."])
  f.push([])
  f.push([])


  /**
   * 💹 **Los fondos comunes son CUOTAPARTES, no un saldo.**
   *
   * Corrección del usuario 2026-09-29: *«FCI son cuotapartes, con lo cual el saldo de inicio es
   * cuotas × precio y el final también»*.
   *
   * 🔑 **No es un detalle de presentación: cambia de dónde sale el resultado.** Un fondo no rinde
   * porque el saldo suba, rinde porque **el precio de la cuotaparte** sube; y las cuotapartes sólo
   * cambian cuando se suscribe o se rescata. Pedir un «saldo» obliga al usuario a hacer la
   * multiplicación afuera —y a rehacerla cada vez que corrige un precio—, que es justo lo que la
   * § 🎚️ de `CLAUDE.md` manda evitar.
   *
   * Entonces la solapa pide **cuatro números** —cuotapartes y precio, al inicio y al cierre— y
   * calcula los dos saldos **y** el resultado con fórmulas.
   */
  f.push(["FONDOS COMUNES DE INVERSION — son CUOTAPARTES: el saldo es cuotas x precio"])
  f.push([])
  if (tenencia && (tenencia.cuotasInicio != null || tenencia.cuotasCierre != null)) {
    f.push([`Cuotapartes y precio: al inicio — ${tenencia.notaInicio}; al cierre — ${tenencia.notaCierre}.`])
    f.push(["Los saldos y el resultado se calculan solos (si cambiás un número, se recalcula)."])
  } else {
    f.push(["Complete las cuatro columnas en amarillo (cuotapartes y precio, al inicio y al cierre)."])
    f.push(["Los saldos y el resultado se calculan solos."])
  }
  f.push([])
  f.push(["Donde",
    "Cuotapartes al inicio", "Precio al inicio", "Saldo al inicio",
    "Suscripciones", "Rescates",
    "Cuotapartes al cierre", "Precio al cierre", "Saldo al cierre",
    "Resultado financiero", "Movimientos", "Respaldo (resumen del cierre)"])

  const filaPrimerFondo = f.length + 1
  // 💹 JMS 06/11: «¿podés tomar los saldos de FCI y la cantidad de cuotapartes con su valor de los PDF?» — ya estaban cargados
  //    (scripts 170 y 174, de los resúmenes FIMA). Van al primer fondo (MSA tiene uno solo); las celdas siguen siendo editables.
  const num = (v: number | null | undefined) => (v == null ? "" : v)
  fci.fondos.forEach((x, i) => {
    const n = f.length + 1
    const t = i === 0 ? tenencia : null
    f.push([
      x.donde,
      num(t?.cuotasInicio), num(t?.valorInicio),              // B, C — de la app (o a mano)
      { t: "n", f: `IF(OR(B${n}="",C${n}=""),"",B${n}*C${n})`, z: MONEDA },
      money(x.suscripciones), money(x.rescates),
      num(t?.cuotasCierre), num(t?.valorCierre),              // G, H — de la app (o a mano)
      { t: "n", f: `IF(OR(G${n}="",H${n}=""),"",G${n}*H${n})`, z: MONEDA },
      /**
       * 🧮 El resultado por el camino inverso: lo que el fondo rindió es lo que el saldo final tiene
       * y que la plata movida no explica. Con las cuotapartes puestas, sale solo.
       */
      { t: "n", f: `IF(OR(D${n}="",I${n}=""),"faltan cuotapartes y precio",I${n}-(D${n}+E${n}-F${n}))`, z: MONEDA },
      x.movimientos,
      t ? celdaRespaldo(respaldoDeFci(t.notaCierre, "cierre", fechaCierre, documentos)) : "",
    ])
  })
  const ultimoFondo = f.length
  const nT = f.length + 1
  f.push(["TOTAL",
    "", "", conFormula(`SUM(D${filaPrimerFondo}:D${ultimoFondo})`, 0),
    conFormula(`SUM(E${filaPrimerFondo}:E${ultimoFondo})`, money(fci.total.suscripciones)),
    conFormula(`SUM(F${filaPrimerFondo}:F${ultimoFondo})`, money(fci.total.rescates)),
    "", "", conFormula(`SUM(I${filaPrimerFondo}:I${ultimoFondo})`, 0),
    conFormula(`SUM(J${filaPrimerFondo}:J${ultimoFondo})`, 0),
    fci.total.movimientos])
  void nT
  f.push([])
  f.push(["Suscribir es plata que SALE de la cuenta; rescatar es plata que ENTRA."])
  f.push(["Las cuotapartes SOLO cambian al suscribir o rescatar; lo que se mueve entre medio es el PRECIO."])
  f.push(["Control: saldo al cierre - (saldo al inicio + suscripciones - rescates) = resultado financiero."])
  f.push(["Y el control cruzado: si las cuotapartes al cierre no son las del inicio mas lo neto suscripto,"])
  f.push(["falta o sobra una operacion del fondo."])
  return f
}

const COLS_BANCOS: Columna[] = [
  { ancho: 34 },                          // A · Cuenta / Donde
  { ancho: 16, z: "#,##0.0000" },         // B · Cuotapartes al inicio (llevan decimales)
  { ancho: 15, z: "#,##0.0000" },         // C · Precio al inicio
  { ancho: 18, z: MONEDA },               // D · Saldo al inicio
  { ancho: 18, z: MONEDA },               // E · Suscripciones
  { ancho: 18, z: MONEDA },               // F · Rescates
  { ancho: 16, z: "#,##0.0000" },         // G · Cuotapartes al cierre
  { ancho: 15, z: "#,##0.0000" },         // H · Precio al cierre
  { ancho: 18, z: MONEDA },               // I · Saldo al cierre
  { ancho: 22, z: MONEDA },               // J · Resultado financiero
  { ancho: 13, z: ENTERO },               // K · Movimientos
  { ancho: 70 },                          // L · Respaldo del FCI (A-FEAT-1571)
]

/**
 * 🏦 La solapa **08 Gastos bancarios** — un concepto por fila, los 12 meses en columnas.
 *
 * Es el formato de su `- detalle completo gastos bancarios e impuestos extractos. por mes`. Los
 * conceptos salen del **plan de cuentas** (`IMPUESTOS BANCARIOS` y `GASTOS BANCARIOS`), no de una
 * lista escrita acá.
 */
export function hojaDeGastosBancarios(g: GastosBancarios, etiqueta: string,
  /** 💵 A-FEAT-1503: los gastos de las cuentas en DÓLARES, en dólares (JMS 01/11: «serán gastos bancarios en dólares»). */
  enDolares: { cuenta: string; gastos: GastosBancarios }[] = []): unknown[][] {
  const f: unknown[][] = []
  f.push([`GASTOS BANCARIOS E IMPUESTOS DEL EXTRACTO — ejercicio ${etiqueta}`])
  f.push(["Los conceptos salen del plan de cuentas: totalizadoras IMPUESTOS BANCARIOS y GASTOS BANCARIOS."])
  // ⚠️ cambió 2026-10-27 (A-FEAT-1388): mostraba sólo lo debitado y las devoluciones quedaban afuera.
  f.push(["Cada mes es el NETO: lo que debito el banco menos lo que devolvio. La columna Devoluciones dice cuanto se resto."])

  const conDatos = g.meses.filter((_, i) => g.total.debitos[i] !== 0 || g.total.creditos[i] !== 0)
  if (conDatos.length < g.meses.length) {
    f.push([])
    f.push([`ATENCION: solo ${conDatos.length} de los ${g.meses.length} meses del ejercicio tienen movimientos.`])
    f.push([`Sin datos: ${g.meses.filter(m => !conDatos.includes(m)).join(", ")}`])
    f.push(["El total de abajo NO es el del ejercicio completo."])
  }
  f.push([])
  const tabla = (g: GastosBancarios) => {
  f.push(["Totalizadora", "Concepto", ...g.meses, "TOTAL (neto)", "Devoluciones", "Movimientos"])

  const fila = (x: FilaConceptoPorMes, esTotal = false) => {
    const n = f.length + 1
    const ultima = String.fromCharCode(66 + g.meses.length)   // la del ultimo mes (C es el primero)
    f.push([
      esTotal ? "" : x.totalizadora, x.concepto,
      ...x.debitos.map((v, i) => money(v - x.creditos[i])),
      conFormula(`SUM(C${n}:${ultima}${n})`, money(x.totalDebitos - x.totalCreditos)),
      x.totalCreditos ? money(x.totalCreditos) : "",
      x.movimientos,
    ])
  }

  for (const t of TOTALIZADORAS_BANCARIAS) {
    const dela = g.filas.filter(x => x.totalizadora === t)
    if (dela.length === 0) continue
    dela.forEach(x => fila(x))
    const s = g.subtotales.find(s => s.totalizadora === t)
    if (s) fila(s, true)
    f.push([])
  }
  fila(g.total, true)
  }
  tabla(g)

  if (g.sinClasificar.length > 0) {
    f.push([])
    f.push([])
    f.push(["PARECEN BANCARIOS Y NO ESTAN EN EL PLAN DE CUENTAS"])
    f.push(["No entran al papel porque no se sabe en que totalizadora van. Hay que darles cuenta contable."])
    f.push(["Categoria del extracto", "Debitos", "Creditos", "Movimientos"])
    g.sinClasificar.forEach(s => f.push([s.categ, money(s.debitos), money(s.creditos), s.movimientos]))
  }
  // 💵 A-FEAT-1503: cada cuenta en dólares, aparte y EN DÓLARES: no se suma a lo de arriba (son otra moneda).
  for (const d of enDolares) {
    if (!d.gastos.filas.length && !d.gastos.sinClasificar.length) continue
    f.push([])
    f.push([])
    f.push([`EN DÓLARES (US$) — ${d.cuenta} — importes en dólares, NO se suman a los de arriba`])
    tabla(d.gastos)
    if (d.gastos.sinClasificar.length) {
      f.push(["Parecen bancarios y no están en el plan de cuentas (US$):"])
      d.gastos.sinClasificar.forEach(s => f.push([s.categ, money(s.debitos), money(s.creditos), s.movimientos]))
    }
  }
  return f
}

/**
 * 🔄 La solapa **09 Retiros y aportes**.
 *
 * Un retiro va **negativo** y un aporte **positivo**, como en su planilla, así que el neto se lee de
 * una sola pasada.
 */
/**
 * 🧾 **Papel 08.1 — impuesto a los débitos y créditos (Ley 25.413), total y desglosado.**
 * Pedido del usuario 2026-10-03: *«debe ser un cuadro importante, total y desglosado»*. Lo
 * computable como pago a cuenta de Ganancias se calcula con FÓRMULA sobre los porcentajes de la
 * solapa, así si el contador usa otro porcentaje lo cambia en una celda.
 */
function hojaDeImpuestoCheque(c: ImpuestoCheque, etiqueta: string, control?: ControlCheque): unknown[][] {
  const f: unknown[][] = []
  f.push([`IMPUESTO A LOS DEBITOS Y CREDITOS BANCARIOS (Ley 25.413) — ejercicio ${etiqueta}`])
  f.push(["Sale del extracto: cada debito del impuesto es un movimiento propio del banco."])
  f.push([])
  f.push(["Mes", ETIQUETA_CONCEPTO.creditos, ETIQUETA_CONCEPTO.debitos, ETIQUETA_CONCEPTO.efectivo, "TOTAL", "Movimientos"])
  const primera = f.length + 1
  for (const m of c.porMes) {
    const n = f.length + 1
    f.push([m.mes, money(m.creditos), money(m.debitos), money(m.efectivo),
      conFormula(`SUM(B${n}:D${n})`, money(m.total)),
      c.mesesSinExtracto.includes(m.mes) ? "SIN EXTRACTO" : m.movimientos])
  }
  const ultima = f.length
  const nT = f.length + 1
  f.push(["TOTAL",
    conFormula(`SUM(B${primera}:B${ultima})`, money(c.total.creditos)),
    conFormula(`SUM(C${primera}:C${ultima})`, money(c.total.debitos)),
    conFormula(`SUM(D${primera}:D${ultima})`, money(c.total.efectivo)),
    conFormula(`SUM(E${primera}:E${ultima})`, money(c.total.total)),
    c.total.movimientos])
  f.push([])
  f.push(["COMPUTABLE COMO PAGO A CUENTA DE GANANCIAS (credito impositivo al cierre)"])
  const nPg = f.length + 1
  f.push(["% sobre alicuota general (creditos + debitos)", c.pctGeneral])
  const nPe = f.length + 1
  f.push(["% sobre alicuota doble (extraccion en efectivo)", c.pctEfectivo])
  f.push(["Computable", conFormula(`(B${nT}+C${nT})*B${nPg}+D${nT}*B${nPe}`, money(c.computable))])
  f.push(["No computable (va a gasto)", conFormula(`E${nT}-((B${nT}+C${nT})*B${nPg}+D${nT}*B${nPe})`, money(c.total.total - c.computable))])
  f.push([])
  f.push(["MSA computa el 100% por su categoria de empresa; el resto, 33% / 20% (Decreto 409/2018). Se cambia en la celda."])
  if (c.mesesSinExtracto.length > 0) {
    f.push([`ATENCION: ${c.mesesSinExtracto.length} mes(es) sin extracto en la app (${c.mesesSinExtracto.join(", ")}): el impuesto de esos meses NO esta en este total.`])
  }
  // 🧮 A-FEAT-1388 — el mismo impuesto llega por tres caminos independientes: tienen que dar igual.
  if (control) {
    f.push([])
    f.push(["CONTROL — EL MISMO IMPUESTO POR TRES CAMINOS (tienen que dar igual)"])
    f.push(["Camino", "Importe", "Diferencia con este papel"])
    const n0 = f.length + 1
    control.caminos.forEach((x, i) => f.push([
      x.camino,
      x.importe ?? "sin dato: ese papel no esta en este Excel",
      i === 0 || x.importe == null ? "" : conFormula(`B${n0 + i}-B${n0}`, x.diferencia ?? 0),
    ]))
    f.push([control.cuadra
      ? "cuadra: los caminos que hay dan lo mismo"
      : "NO CUADRA: alguno de los caminos tiene un movimiento que los otros no — mirar la diferencia"])
  }
  return f
}

export function hojaDeRetiros(r: RetirosYAportes, etiqueta: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`RETIROS Y APORTES DE LOS SOCIOS — ejercicio ${etiqueta}`])
  f.push(["Un retiro va en NEGATIVO (sale de la empresa) y un aporte en POSITIVO."])
  f.push(["No son gasto del resultado: son movimientos patrimoniales."])
  f.push([])
  f.push(["Concepto", ...r.meses, "TOTAL", "Movimientos", "Nro"])

  const ultima = String.fromCharCode(65 + r.meses.length)
  const fila = (x: typeof r.neto) => {
    const n = f.length + 1
    f.push([x.etiqueta, ...x.porMes.map(v => money(v)),
      conFormula(`SUM(B${n}:${ultima}${n})`, money(x.total)), x.movimientos, x.nro ?? ""])
  }

  r.filas.filter(x => x.clase === "retiro").forEach(fila)
  r.filas.filter(x => x.clase === "aporte").forEach(fila)
  f.push([])
  fila(r.neto)

  /**
   * 👥 A-FEAT-1573 (JMS 06/11, nota en la 09: «esto sería cta cte de socios y precisaría la lista abajo. Con filtros y algo
   * práctico con el suficiente detalle para auditar»): cada movimiento, con el Nro de su renglón de arriba (filtrar por Nro
   * muestra cómo se compone) y el total, que tiene que dar el neto de arriba.
   */
  if (r.detalle?.length) {
    f.push([])
    f.push(["DETALLE — movimiento por movimiento (cuenta corriente de los socios). Filtrá por Nro, socio o cuenta: el Nro es el del renglón de arriba."])
    const enc = f.length + 1
    f.push(["Nro", "Fecha", "Cuenta", "Socio", "Concepto", "Categoría del extracto", "Descripción", "Importe"])
    for (const d of r.detalle) f.push([d.nro, d.fecha, d.cuenta, d.socio, d.concepto, d.categ, d.descripcion, money(d.importe)])
    const fin = f.length
    filtrarEn(f, `A${enc}:H${fin}`)
    const nT = f.length + 1
    f.push(["TOTAL", "", "", "", "", "", "", conFormula(`SUBTOTAL(9,H${enc + 1}:H${fin})`, money(r.detalle.reduce((t, d) => t + d.importe, 0)))])
    f.push(["Control: el TOTAL sin filtro tiene que dar el neto «Aportes − Retiros» de arriba.", "", "", "", "", "", "",
      conFormula(`ROUND(H${nT}-${String.fromCharCode(65 + r.meses.length + 1)}${f.findIndex(x => x[0] === r.neto.etiqueta) + 1},2)`, 0)])
  }

  if (r.sinReconocer.length > 0) {
    f.push([])
    f.push([])
    f.push(["PARECEN RETIRO O APORTE Y NO SE RECONOCIERON"])
    f.push(["Los conceptos de retiro no estan en el plan de cuentas, asi que el papel usa una lista."])
    f.push(["Categoria del extracto", "Importe", "Movimientos"])
    r.sinReconocer.forEach(s => f.push([s.categ, money(s.importe), s.movimientos]))
  }
  return f
}

const COLS_ASIENTOS: Columna[] = [
  { ancho: 10 },                    // Subdiario
  { ancho: 11 },                    // Fecha
  { ancho: 6, z: ENTERO },          // Tipo
  { ancho: 8, z: ENTERO },          // Pto Vta
  { ancho: 11, z: ENTERO },         // Número
  { ancho: 13 },                    // CUIT
  { ancho: 42 },                    // Denominación
  { ancho: 15, z: MONEDA },         // Neto Gravado
  { ancho: 14, z: MONEDA },         // No Gravado
  { ancho: 13, z: MONEDA },         // Exentas
  { ancho: 14, z: MONEDA },         // Monotributo (A-BUG-1534)
  { ancho: 14, z: MONEDA },         // Otros Tributos
  { ancho: 13, z: MONEDA },         // IVA
  { ancho: 16, z: MONEDA },         // Total
  { ancho: 13, z: MONEDA },         // Dif. de algo más (A-BUG-1534)
  { ancho: 26 },                    // Cuenta contable
  { ancho: 12 },                    // Nro cuenta
  { ancho: 18 },                    // Centro de costo
  { ancho: 17 },                    // Origen del dato
  { ancho: 8 },                     // Moneda
  { ancho: 10, z: COEFICIENTE },    // Tipo de cambio
  { ancho: 16, z: MONEDA },         // Total en moneda original
  { ancho: 70 },                    // Control de partes (A-FEAT-1388)
]

/** Ventas: lo mismo que los asientos, más qué se vendió y cuánto (U2), antes del Control de partes. */
const COLS_VENTAS: Columna[] = [
  ...COLS_ASIENTOS.slice(0, 22),
  { ancho: 16 },                    // Producto
  { ancho: 12, z: TONELADAS },      // Toneladas
  { ancho: 10, z: ENTERO },         // Cabezas
  { ancho: 12, z: ENTERO },         // Kilos
  { ancho: 70 },                    // Control de partes
]

/**
 * Las cuotas de templates, en el mismo formato de fila que el libro diario — pedido del usuario:
 * *«replicar formato de libro diario con los templates»*.
 */
/**
 * 🧮 A-FEAT-1513 — el Nro de cada fila de «Por mes», en el orden en que se muestra (tipo → responsable → agrupadora). Lo usan
 * «Por mes» y «Cuotas»: filtrando las cuotas por ese Nro se ve qué forma la fila.
 */
export function numerarFilasPorMes(t: TemplatesDelEjercicio): Map<string, number> {
  const m = new Map<string, number>()
  for (const tp of ORDEN_TIPOS) {
    const delTipo = t.porMes.filter(x => x.tipo === tp)
    for (const r of [...new Set(delTipo.map(x => x.responsable))]) {
      const dela = delTipo.filter(x => x.responsable === r)
      for (const a of [...new Set(dela.map(x => x.agrupadora ?? SIN_AGRUPADORA))]) {
        for (const x of dela.filter(y => (y.agrupadora ?? SIN_AGRUPADORA) === a)) if (x.clave && !m.has(x.clave)) m.set(x.clave, m.size + 1)
      }
    }
  }
  return m
}

export function hojaDeTemplates(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = [[
    "Fecha", "Concepto", "Proveedor", "Categoría", "Cuenta contable", "Nro cuenta",
    "Centro de costo", "Responsable", "Estado", "Débito", "Crédito", "Nro (fila de «Por mes»)",
  ]]
  const nroFila = numerarFilasPorMes(t)
  // Ordenado por tipo, responsable (la empresa del balance primero) y fecha: el orden lo pone
  // `armarTemplatesDelEjercicio`, el mismo de «Templates por mes» (usuario 2026-10-24: «las 2 deben
  // estar ordenadas por responsable»; 2026-10-27: «si es MSA primero MSA, luego MA, luego PAM»).
  const ordenadas = t.detalle
  /** Una cuota en el formato del libro diario: lo que salió en Débito, lo que entró en Crédito. */
  const filaCuota = (c: CuotaTemplate) => [
    c.fecha ?? "", c.concepto, c.proveedor, c.categ, c.cuenta_contable, c.nro_cuenta,
    c.centro_costo, c.responsable, c.estado,
    c.monto >= 0 ? money(c.monto) : "", c.monto < 0 ? money(-c.monto) : "",
    c.filaPorMes ? nroFila.get(c.filaPorMes) ?? "" : "",
  ]
  // 🗂️ A-FEAT-1342: un bloque por tipo, con su subtotal.
  let tipoActual: string | null = null
  const cerrarTipo = () => {
    if (tipoActual == null) return
    const g = (t.porTipo ?? []).find(x => x.tipo === tipoActual)
    f.push([`Total ${NOMBRE_TIPO[tipoActual as TipoTemplate].split(" — ")[0]}`, "", "", "", "", "", "", "", "",
      money(g?.totalDebitos ?? 0), money(g?.totalCreditos ?? 0)])
    // 💳 A-FEAT-1388 — *«¿muestran lo pagado o lo pendiente también?»*: las dos cosas, y se dice cuánto.
    const pendiente = g?.totalPendiente ?? 0
    f.push(["  de lo cual PAGADO", "", "", "", "", "", "", "", "", money((g?.totalNeto ?? 0) - pendiente)])
    f.push(["  de lo cual PENDIENTE al cierre", "", "", "", "", "", "", "", "", money(pendiente)])
    // 🔎 Con un punto en vez de una fila vacía, el filtro de Excel toma la tabla entera (usuario 27/10:
    //    «puse puntos entre los subtotales para que anden los filtros»).
    f.push(["."])
  }
  for (const c of ordenadas) {
    const tp = c.tipo ?? "sin clasificar"
    if (tp !== tipoActual) { cerrarTipo(); tipoActual = tp; f.push([NOMBRE_TIPO[tp]]) }
    f.push(filaCuota(c))
  }
  cerrarTipo()
  f.push(["TOTAL (todos los tipos)", "", "", "", "", "", "", "", "", money(t.totalDebitos), money(t.totalCreditos)])
  f.push(["Los saldos «PAGADO» y «PENDIENTE» van como DEBITO menos CREDITO. El estado de cada cuota esta en la columna Estado."])
  // 💳 A-BUG-1289: las impagas están en el total (vencieron en el ejercicio) y además son deuda.
  if (t.impagasAlCierre.length > 0) {
    f.push(["."])
    f.push([`IMPAGAS AL CIERRE: ${t.impagasAlCierre.length} cuota(s) por ${money(t.totalImpagas)}. Estan en el total`])
    f.push(["de arriba (son gasto del ejercicio) y ademas figuran como deuda en «04 Cuentas a pagar»."])
  }
  // 🛡️ A-FEAT-1388: los seguros con póliza ya son gasto por su factura. Se listan, no se suman.
  if ((t.enFacturas ?? []).length > 0) {
    f.push(["."])
    f.push([`NO INCLUIDAS — ${t.enFacturas.length} cuota(s) de SEGUROS CON POLIZA por ${money(t.totalEnFacturas)}`])
    f.push(["Ya estan en las facturas de la aseguradora (Compras) y en su cuenta corriente (papel 14):"])
    f.push(["la cuota del template sirve para conciliar el debito del banco. Sumarla aca la contaria dos veces."])
    for (const c of t.enFacturas) f.push(filaCuota(c))
  }
  // 🛑 A-BUG-1289: las desactivadas NO son gasto, pero se listan — nada se descarta en silencio.
  if (t.noIncluidas.length > 0) {
    f.push(["."])
    f.push([`NO INCLUIDAS — ${t.noIncluidas.length} cuota(s) DESACTIVADAS por ${money(t.totalNoIncluidas)}`])
    f.push(["No son gasto: se eligio la otra forma de pago (ej. en cuotas en vez de anual) y su importe"])
    f.push(["suele ser una estimacion. No estan en el total de arriba."])
    for (const c of t.noIncluidas) f.push(filaCuota(c))
  }
  return f
}

/**
 * El resumen `concepto × los 12 meses` — **la forma exacta de su planilla** *«detalle completo
 * gastos bancarios e impuestos por mes»*: filas de concepto, columnas jul→jun con «Suma de
 * Débitos / Suma de Créditos», y el total del ejercicio al final.
 */
/**
 * 🧾 La solapa **Templates por mes** — un mes por columna, **saldado**, y subtotal por responsable.
 *
 * Dos pedidos del usuario del 2026-09-29, revisando el export:
 * > *«templates sin desglosar por responsable»*
 * > *«template x mes siguen con 2 columnas deb y cred en vez de saldado»*
 *
 * Los dos apuntan a lo mismo: la tabla anterior tenía **24 columnas de importes** —débito y crédito
 * por cada mes— y no decía **quién** pagó. Para saber cuánto costó un concepto había que **restar a
 * ojo**, y para saber de qué empresa era, no había forma.
 *
 * Ahora: **un mes, una columna, con el saldo** (débito − crédito), y las filas agrupadas por
 * responsable con su subtotal. Los débitos y créditos abiertos siguen estando en la solapa
 * **Templates**, que es la del detalle.
 */
export function hojaTemplatesPorMes(t: TemplatesDelEjercicio): unknown[][] {
  const f: unknown[][] = []
  f.push(["TEMPLATES POR MES — lo que no entra por subdiario y se informa aparte"])
  f.push(["Cada mes es UNA columna, con el SALDO del mes: debito menos credito."])
  f.push(["Un importe negativo es plata que ENTRO: un ingreso, un rescate o una devolucion del banco."])
  f.push(["Incluye lo PAGADO y lo PENDIENTE al cierre: abajo, en el CONTROL, cuanto es cada uno."])
  f.push(["Las cuotas se cortan por FECHA DE PAGO (o estimada si no hay), no por subdiario:"])
  f.push(["un template no tiene factura de ARCA, asi que no tiene subdiario."])
  if ((t.enFacturas ?? []).length > 0) {
    f.push([`No estan los SEGUROS CON POLIZA (${t.enFacturas.length} cuotas, ${money(t.totalEnFacturas)}): ya son gasto por la factura`])
    f.push(["de la aseguradora y estan en su cuenta corriente (papel 14). Su detalle, al final de la solapa de detalle (Impuestos u Otros)."])
  }
  f.push(["."])

  /**
   * 🗂️ A-FEAT-1388: la columna **Agrupadora** (la totalizadora del plan de cuentas) para poder filtrar
   * por ella — usuario 27/10: *«mejorar orden, agrupadoras»*. Por eso los meses arrancan en la D.
   */
  f.push(["Responsable", "Agrupadora", "Categoría", ...t.columnas, "TOTAL", "Meses con movimiento", "Nro (filtrá «Cuotas» por este)"])
  const nroFila = numerarFilasPorMes(t)

  /** La letra de la columna del mes `j` (0 = el primero, en la D). */
  const colMes = (j: number) => String.fromCharCode(68 + j)
  /** La última columna de meses, para las fórmulas de total por fila. */
  const ultima = colMes(t.columnas.length - 1)
  const colTotal = colMes(t.columnas.length)
  const sumaFilas = (filas: number[], j: number) => filas.map(r => `${colMes(j)}${r}`).join("+") || "0"

  const filaDe = (x: { clave?: string; responsable: string; agrupadora: string; categ: string; neto: number[]; totalNeto: number }) => {
    const n = f.length + 1
    f.push([
      x.responsable, x.agrupadora, x.categ,
      ...x.neto.map(v => money(v)),
      conFormula(`SUM(D${n}:${ultima}${n})`, money(x.totalNeto)),
      x.neto.filter(v => v !== 0).length,
      x.clave ? nroFila.get(x.clave) ?? "" : "",
    ])
    return n
  }
  /** Un renglón de subtotal que suma OTROS renglones (no un rango: adentro hay subtotales). */
  const filaSuma = (etiqueta: [string, string], filas: number[], neto: number[], totalNeto: number) => {
    const n = f.length + 1
    f.push([
      etiqueta[0], etiqueta[1], "",
      ...t.columnas.map((_, j) => conFormula(sumaFilas(filas, j), money(neto[j]))),
      conFormula(`SUM(D${n}:${ultima}${n})`, money(totalNeto)),
      "",
    ])
    return n
  }
  const sumarNeto = (xs: { neto: number[] }[]) => t.columnas.map((_, j) => xs.reduce((s, x) => s + x.neto[j], 0))
  const sumarTotal = (xs: { totalNeto: number }[]) => xs.reduce((s, x) => s + x.totalNeto, 0)

  /**
   * 🗂️ A-FEAT-1342 + A-FEAT-1388: primero el TIPO (egresos, ingresos, distribuciones, financiero…),
   * adentro cada RESPONSABLE (la empresa del balance primero) y, adentro, cada AGRUPADORA del plan con
   * su subtotal (sólo si tiene más de una cuenta). El total de cada responsable suma sus agrupadoras;
   * el del tipo, sus responsables; el del ejercicio, los tipos. El orden ya viene de `armarTemplatesDelEjercicio`.
   */
  const filasTotalTipo: number[] = []
  for (const tp of ORDEN_TIPOS) {
    const delTipo = t.porMes.filter(x => x.tipo === tp)
    if (delTipo.length === 0) continue
    f.push([NOMBRE_TIPO[tp]])
    const filasResponsable: number[] = []
    for (const r of [...new Set(delTipo.map(x => x.responsable))]) {
      const dela = delTipo.filter(x => x.responsable === r)
      const filasDelResponsable: number[] = []
      for (const a of [...new Set(dela.map(x => x.agrupadora ?? SIN_AGRUPADORA))]) {
        const delGrupo = dela.filter(x => (x.agrupadora ?? SIN_AGRUPADORA) === a)
        const filas = delGrupo.map(x => filaDe({ ...x, agrupadora: x.agrupadora ?? SIN_AGRUPADORA }))
        filasDelResponsable.push(filas.length === 1
          ? filas[0]
          : filaSuma([`Subtotal ${a}`, ""], filas, sumarNeto(delGrupo), sumarTotal(delGrupo)))
      }
      filasResponsable.push(filaSuma([`Total ${r}`, ""], filasDelResponsable, sumarNeto(dela), sumarTotal(dela)))
    }
    filasTotalTipo.push(filaSuma([`TOTAL ${NOMBRE_TIPO[tp].split(" — ")[0]}`, ""], filasResponsable,
      sumarNeto(delTipo), sumarTotal(delTipo)))
    f.push(["."])
  }

  const nTot = filaSuma(["TOTAL DEL EJERCICIO (todos los tipos)", ""], filasTotalTipo,
    sumarNeto(t.porMes), t.totalDebitos - t.totalCreditos)

  /**
   * 🧮 El control: el saldo total tiene que ser **débitos − créditos** de la solapa del detalle. Es el
   * camino inverso — si el saldado perdió una cuota por el camino, esto no da.
   */
  f.push([])
  f.push(["CONTROL", "Total debitos (solapa de detalle: Impuestos u Otros)", money(t.totalDebitos)])
  f.push(["", "Total creditos", money(t.totalCreditos)])
  f.push(["", "= Saldo", money(t.totalDebitos - t.totalCreditos)])
  const nC = f.length + 1
  f.push(["", "Suma de esta solapa", conFormula(`${colTotal}${nTot}`, money(t.totalDebitos - t.totalCreditos))])
  f.push(["", "Diferencia (tiene que dar 0)",
    conFormula(`C${nC - 1}-C${nC}`, 0)])
  // 🧮 Y por tipo: la suma de los grupos tiene que dar el total (ninguna cuota afuera ni dos veces).
  const sumaTipos = Math.round((t.porTipo ?? []).reduce((x, g) => x + g.totalNeto, 0) * 100) / 100
  const difTipos = Math.round((t.totalDebitos - t.totalCreditos - sumaTipos) * 100) / 100
  f.push(["", "Suma de los tipos", money(sumaTipos)])
  f.push(["", "Diferencia por tipo (tiene que dar 0)", money(difTipos), difTipos === 0 ? "cuadra" : "NO CUADRA"])

  // 💳 A-FEAT-1388 — *«¿muestran lo pagado o lo pendiente también?»*: las dos cosas, por tipo.
  f.push([])
  f.push(["PAGADO Y PENDIENTE", "Tipo", "Saldo del ejercicio", "Pagado", "Pendiente al cierre"])
  for (const g of t.porTipo ?? []) {
    f.push(["", NOMBRE_TIPO[g.tipo].split(" — ")[0], money(g.totalNeto), money(g.totalNeto - g.totalPendiente), money(g.totalPendiente)])
  }

  if (t.sinCategoria.length > 0 || t.sinFecha.length > 0) {
    f.push([])
    f.push(["LO QUE NO SE PUDO UBICAR"])
    if (t.sinCategoria.length > 0) {
      f.push(["", `${t.sinCategoria.length} cuota(s) SIN CATEGORÍA contable: no se pueden ubicar en el balance.`])
    }
    if (t.sinFecha.length > 0) {
      f.push(["", `${t.sinFecha.length} cuota(s) SIN FECHA (ni de pago ni estimada): no se pueden asignar a un período.`])
    }
  }
  plegarNotasPorMes(f) // 📑 las notas de arriba, plegadas (JMS 02/11)
  return f
}

/**
 * `02 - HACIENDA` — existencia al cierre y su valuación, con el criterio de cada categoría a la
 * vista y **los huecos listados**, no escondidos en un total.
 */
/** 🐄 Lo que necesita el papel de hacienda (A-FEAT-1541). */
export type DatosPapelHacienda = {
  valuacion: ValuacionHacienda
  movimientosPapel: MovimientoPapel[]
  valuacionInicio?: ValuacionHacienda | null
  tablasInicio?: TablasPreciosPapel | null
  tablasCierre?: TablasPreciosPapel | null
  tcCierre?: number | null
  saldosGuardados?: Record<string, string | undefined>
  pesos?: PesoCategoria[]
}

/**
 * 🐄 Las solapas 02 a 02.9 del papel de hacienda. Función aparte para que el script `excel-papel-hacienda.mts` arme
 * EXACTAMENTE el mismo papel con el dato real, sin pasar por el navegador (JMS 05/11: «dame el Excel sin que yo lo descargue»).
 */
export function agregarPapelHacienda(wb: XLSX.WorkBook, hacienda: DatosPapelHacienda, empresa: string, ejercicio: Ejercicio) {
  /**
   * 🐄 A-FEAT-1541 (JMS 05/11, «5 sí»): el papel de hacienda como el prototipo aprobado — el cuadro de stock (NZ · SENASA · DDJJ al
   * inicio y al cierre, con los movimientos del ejercicio), el valorizado con el formato de su papel 2.2 (cierre e inicio, con
   * la trazabilidad a la derecha), las tablas de precios tomados y una solapa por tipo de movimiento para auditar.
   */
  const primerDia = primerDiaDelEjercicio(ejercicio), fc = ejercicio.fechaCierre
  const detalles = DETALLES.map(dd => ({ dd, ...hojaDetalleHacienda(hacienda.movimientosPapel, dd.tipo, dd.hoja.replace(/^02\.\d /, "").toUpperCase(), primerDia, fc) }))
  hoja(wb, "02 Stock hacienda", hojaStockHacienda(hacienda.movimientosPapel, primerDia, fc, hacienda.saldosGuardados ?? {},
    Object.fromEntries(detalles.map(x => [x.dd.tipo, { d0: x.d0, d1: x.d1 }]))), COLS_STOCK_HACIENDA)
  const ddjj = empresa === "MSA" ? APERTURA_MSA_2025.find(r => r.cuenta === "1.2.2/05/01") : undefined
  const valorizado = {
    cierre: hacienda.valuacion, inicio: hacienda.valuacionInicio ?? null, fechaCierre: fc,
    fechaInicio: new Date(Date.parse(`${primerDia}T12:00:00Z`) - 86400000).toISOString().slice(0, 10), tcCierre: hacienda.tcCierre ?? null,
    ddjjInicio: ddjj ? { cuenta: ddjj.cuenta, denominacion: ddjj.denominacion, valor: ddjj.hist } : null,
    tablasCierre: hacienda.tablasCierre ?? null, tablasInicio: hacienda.tablasInicio ?? null,
  }
  hoja(wb, "02.1 Stock valorizado", hojaStockValorizado(valorizado), COLS_STOCK_VALORIZADO)
  hoja(wb, "02.2 Precios tomados", hojaPreciosTomados([
    { titulo: `CIERRE ${fc.split("-").reverse().join("/")}`, tablas: hacienda.tablasCierre, valuacion: hacienda.valuacion },
    { titulo: "INICIO (el día anterior al ejercicio)", tablas: hacienda.tablasInicio, valuacion: hacienda.valuacionInicio },
  ]), COLS_PRECIOS_TOMADOS)
  for (const x of detalles) hoja(wb, x.dd.hoja, x.filas, COLS_DETALLE_HACIENDA)
  if (hacienda.pesos) hoja(wb, "02.9 Calculo de los kilos", hojaCalculoKilos(hacienda.pesos, fc), COLS_CALCULO_KILOS)
  // 📈 JMS 05/11: cuánto aumentó el rodeo de cría y el de recría, dólares contra dólares.
  hoja(wb, "02.10 Aumento del rodeo U$S", hojaAumentoRodeo(valorizado), COLS_AUMENTO_RODEO)
}

// 📐 JMS 05/11 (lo enviado al contador): «Nacimientos» (E) más angosta.
const COLS_STOCK_HACIENDA: Columna[] = [{ ancho: 34 }, ...Array.from({ length: 14 }, (_, i) => ({ ancho: i === 3 ? 7.3 : 12, z: ENTERO }))]
// 📐 Anchos de JMS (Papeles v11.04, 05/11).
const COLS_STOCK_VALORIZADO: Columna[] = [{ ancho: 34 }, { ancho: 6.5, z: ENTERO }, { ancho: 17.5 }, { ancho: 14, z: MONEDA }, { ancho: 12.2, z: MONEDA },
  { ancho: 17, z: MONEDA }, { ancho: 16.2, z: MONEDA }, { ancho: 13, z: MONEDA }, { ancho: 14, z: MONEDA }, { ancho: 10.7 },
  { ancho: 15, z: MONEDA }, { ancho: 22 }, { ancho: 24 }, { ancho: 17 }, { ancho: 22 }, { ancho: 40 }, { ancho: 7 }, { ancho: 70 }, { ancho: 60 }]
const COLS_AUMENTO_RODEO: Columna[] = [{ ancho: 34 }, { ancho: 10 }, { ancho: 12.2, z: ENTERO }, { ancho: 12.2, z: ENTERO }, { ancho: 12.2 }, { ancho: 12.2 },
  { ancho: 12, z: ENTERO }, { ancho: 12, z: ENTERO }, { ancho: 11, z: ENTERO }, { ancho: 12, z: MONEDA }, { ancho: 12, z: MONEDA }, { ancho: 14, z: MONEDA },
  { ancho: 12.2, z: MONEDA }, { ancho: 12.2, z: MONEDA }, { ancho: 13, z: MONEDA }, { ancho: 12.2, z: MONEDA }, { ancho: 12.2, z: MONEDA }, { ancho: 12.2, z: MONEDA },
  { ancho: 9, z: MONEDA }, { ancho: 12.2, z: MONEDA }]
const COLS_PRECIOS_TOMADOS: Columna[] = [{ ancho: 34 }, { ancho: 12 }, { ancho: 12 }, { ancho: 14, z: MONEDA }, { ancho: 12.2, z: MONEDA }, { ancho: 22 }, { ancho: 9 }, { ancho: 22 }, { ancho: 8 }]
const COLS_CALCULO_KILOS: Columna[] = [{ ancho: 22 }, { ancho: 14 }, { ancho: 9 }, { ancho: 16 }, { ancho: 9 }, { ancho: 11 }, { ancho: 12.2 }, { ancho: 13 }, { ancho: 40 }, { ancho: 13 }, { ancho: 12 }]
const COLS_DETALLE_HACIENDA: Columna[] = [{ ancho: 12 }, { ancho: 24 }, { ancho: 32 }, { ancho: 10, z: ENTERO }, { ancho: 40 }, { ancho: 70 }]

function hojaDeHacienda(
  h: ValuacionHacienda, fechaCierre: string, mesPrecios: string, cuadre?: CuadreHacienda,
  saldos?: SaldosParaExcel["hacienda"], fechaInicio?: string, fuentes?: FuentePrecio[],
): unknown[][] {
  const f: unknown[][] = []
  f.push([`02 - HACIENDA — existencia al ${fechaCierre}`])
  // 📅 A-FEAT-1422 (16): ya no es el promedio del mes; es el último publicado al cierre, fuente por fuente.
  f.push([`Precios de referencia: ${mesPrecios}`])
  // 🔗 (14): el link de cada fuente, para que el contador la revise.
  for (const x of fuentes ?? []) f.push([conLink(`${x.nombre} — ${x.fecha ? x.fecha.split("-").reverse().join("/") : "sin dato al cierre"}`, x.url), x.url])
  f.push([])

  /**
   * 🧮 **El cuadre va ARRIBA de la valuación**, no al final.
   *
   * Pedido del usuario 2026-09-29: *«hacienda precisa el cheq de consistencia de inicio más menos mov
   * = stock final»*. Y va primero porque **si la existencia no cuadra, valuarla no tiene sentido**:
   * se estaría poniendo precio a un rodeo equivocado.
   */
  if (cuadre) {
    // ⚠️ cambió 29/10 (A-FEAT-1422 nota 12: «no se ve el texto»): los rótulos van en la columna A (la ancha), no en la B.
    f.push(["CUADRE DE LA EXISTENCIA — de donde salen las cabezas que se valuan"])
    f.push([])
    f.push(["Existencia al INICIO del ejercicio", cuadre.existenciaInicio, "cabezas"])
    cuadre.porTipo.forEach(t => f.push([`  ${t.tipo}`, t.cabezas, `cabezas · ${t.movimientos} movimiento(s)`]))
    const nMov = f.length + 1
    const desdeMov = nMov - cuadre.porTipo.length
    f.push(["Movimientos del ejercicio",
      cuadre.porTipo.length > 0
        ? conFormula(`SUM(B${desdeMov}:B${nMov - 1})`, cuadre.movimientosDelEjercicio, ENTERO)
        : 0,
      "cabezas"])
    const nCalc = f.length + 1
    f.push(["= Existencia al CIERRE (calculada)",
      conFormula(`B${nCalc - cuadre.porTipo.length - 2}+B${nCalc - 1}`, cuadre.existenciaCierreCalculada, ENTERO),
      "cabezas"])
    f.push(["Existencia que se valua abajo", cuadre.existenciaCierreDeclarada, "cabezas"])
    const nDif = f.length + 1
    f.push(["Diferencia", conFormula(`B${nDif - 2}-B${nDif - 1}`, cuadre.diferencia, ENTERO),
      cuadre.diferencia === 0 ? "CIERRA" : "NO CIERRA"])
    if (cuadre.avisos.length > 0) {
      f.push([])
      f.push(["ATENCION"])
      cuadre.avisos.forEach(a => f.push([a]))
    }
    f.push([])
    f.push([])
  }
  // 🐄 A-FEAT-1386: los saldos Sistema · SENASA · Campo · Balance, al inicio y al cierre (JMS 29/10).
  if (saldos) agregarSaldosHacienda(f, saldos, fechaInicio ?? "", fechaCierre)

  f.push(["Categoría", "Cabezas", "Criterio de valuación", "Precio de referencia", "Origen del precio",
    "Factor", "Kg/cab", "$ por cabeza", "Valor total", "De dónde salen los kilos"])

  /**
   * 🧮 **Fórmulas, no resultados** — pedido textual del usuario en este mismo papel:
   * *«si son fórmulas deben quedar las fórmulas en el excel y no los datos»*.
   *
   * `$ por cabeza` = precio × factor × kg (o precio × factor cuando ya viene por cabeza)
   * `Valor total`  = cabezas × $ por cabeza
   *
   * 🔑 Así él cambia un precio en la columna D y **el papel se recalcula solo**. Con el número
   * pegado tendría que rehacer la cuenta a mano, y el Excel dejaría de ser una herramienta para
   * pasar a ser una foto.
   *
   * ⚠️ Las filas **sin precio siguen diciendo «FALTA EL PRECIO» en texto**: una fórmula sobre una
   * celda vacía daría **0**, y un cero se lee como *«vale cero»*, que es justo lo contrario de lo
   * que pasa.
   */
  for (const x of h.filas) {
    const fila = f.length + 1  // 1-based, la fila donde va a caer ésta
    f.push([
      x.categoria, x.cabezas, x.criterio,
      x.precioReferencia ?? "", x.origenPrecio,
      x.factor, x.pesoKg ?? "",
      x.valorPorCabeza == null
        ? "FALTA EL PRECIO"
        : conFormula(
            x.pesoKg ? `D${fila}*F${fila}*G${fila}` : `D${fila}*F${fila}`,
            x.valorPorCabeza,
          ),
      x.valorTotal == null
        ? "FALTA EL PRECIO"
        : conFormula(`B${fila}*H${fila}`, x.valorTotal),
      // El origen del peso va al lado: un kilo estimado y uno medido no valen lo mismo, y el
      // papel tiene que poder decir cuál es cuál sin preguntarle a nadie.
      x.origenPeso,
    ])
  }
  f.push([])
  f.push(["TOTAL", h.cabezas, "", "", "", "", "", "", money(h.valuado)])
  f.push([])
  if (h.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["", `${h.huecos.length} categoría(s) y ${h.cabezasSinValuar} cabezas sin precio.`])
    f.push(["", "No se valúan en cero a propósito: un supuesto silencioso daría un total completo y mal."])
    h.huecos.forEach(x => f.push(["", x.categoria, x.cabezas, x.criterio]))
    f.push([])
  }
  if (h.sinCriterio.length > 0) {
    f.push(["⚠️ CATEGORÍAS CON EXISTENCIA Y SIN CRITERIO DEFINIDO"])
    h.sinCriterio.forEach(c => f.push(["", c]))
  }
  return f
}

/** Los precios que se usaron, para que la valuación se pueda auditar y no haya que creerle. */
function hojaDePrecios(
  mag: PrecioMag[],
  mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] },
  porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] },
  mesPrecios: string,
): unknown[][] {
  const f: unknown[][] = []
  f.push([`PRECIOS DE REFERENCIA — ${mesPrecios}`])
  f.push(["Se toma el mes entero, no un día, para que sea representativo."])
  f.push([])
  f.push(["MERCADO AGROGANADERO DE CAÑUELAS — categorías comerciales"])
  f.push(["Familia", "Calidad", "Corte", "Mínimo", "Máximo", "Promedio", "Mediana"])
  mag.forEach(m => f.push([m.familia, m.calidad, m.corte ?? "", m.minimo, m.maximo, m.promedio, m.mediana]))
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — POR CABEZA (vientres y toros)"])
  f.push(["Un vientre o un toro NO se valúan por kilo: valen lo que valen."])
  f.push(["Categoría", "Cabezas operadas", "Promedio", "Máximo", "Mínimo"])
  for (const [tipo, filas] of Object.entries(porCabeza)) {
    filas.forEach(m => f.push([`${tipo} · ${m.categoria}`, m.cantidad, m.promedio, m.maximo, m.minimo]))
  }
  f.push([])
  f.push(["ENTRESURCOS Y CORRALES — por rango de kilos"])
  f.push(["Categoría", "Desde kg", "Hasta kg", "Prom. $/kg", "Máx. $/kg", "Mín. $/kg"])
  for (const [sexo, filas] of Object.entries(mercado)) {
    filas.forEach(m => f.push([`${sexo} · ${m.categoria}`, m.pesoLo, m.pesoHi ?? "sin tope", m.promKilo, m.kiloMax, m.kiloMin]))
  }
  return f
}

/** Los stocks de insumos, un bloque por papel, con los huecos contados. */
function hojaDeInsumos(st: StockInsumos, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`STOCK DE INSUMOS al ${fechaCierre}`])
  // 📅 A-FEAT-1427: de dónde sale la existencia, y su control (hoy = suma de movimientos).
  if (st.alCierre) {
    f.push([`Existencia al ${st.alCierre.fecha}: suma de compras, usos y ajustes hasta esa fecha` +
      (st.alCierre.posteriores > 0 ? ` (se descontaron ${st.alCierre.posteriores} movimiento(s) posteriores).` : ".")])
    if (st.alCierre.descuadres.length === 0) f.push(["CONTROL ✓ cada producto: existencia de hoy = suma de sus movimientos"])
    else {
      f.push(conEstilo([`⚠️ CONTROL: ${st.alCierre.descuadres.length} producto(s) con existencia de hoy distinta de la suma de sus movimientos — al cierre se toma la de los movimientos`], ESTILO_ERROR))
      f.push(["", "Producto", "Hoy", "Suma de movimientos", "Unidad"])
      st.alCierre.descuadres.forEach(d => f.push(["", d.producto, d.hoy, d.sumaMovimientos, d.unidad]))
    }
  } else {
    f.push(conEstilo(["⚠️ La existencia es la de HOY, no la del cierre: no se pudieron leer los movimientos."], ESTILO_ERROR))
  }
  f.push([])
  for (const g of st.grupos) {
    f.push([g.papel])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad", "Precio unitario", "Valor total", "Observaciones"])
    for (const x of g.filas) {
      f.push([
        x.categoria, x.producto, x.cantidad, x.unidad,
        x.costoUnitario ?? "FALTA EL PRECIO",
        x.valorTotal ?? "FALTA EL PRECIO",
        x.observaciones,
      ])
    }
    f.push(["", `Subtotal ${g.papel}`, "", "", "", money(g.valuado),
      g.huecos > 0 ? `⚠️ ${g.huecos} producto(s) sin precio, NO incluidos` : ""])
    f.push([])
  }
  f.push(["TOTAL VALUADO", money(st.valuado)])
  f.push(["Productos con existencia", st.productos])
  f.push(["Productos SIN PRECIO", st.huecos.length])
  f.push([])
  if (st.huecos.length > 0) {
    f.push(["🕳️ LO QUE FALTA VALUAR — el total de arriba NO lo incluye"])
    f.push(["Categoría", "Producto", "Cantidad", "Unidad"])
    st.huecos.forEach(x => f.push([x.categoria, x.producto, x.cantidad, x.unidad]))
    f.push([])
  }
  f.push(["🕳️ LO QUE TODAVÍA LE FALTA A CADA PAPEL"])
  PAPELES_SIN_ORIGEN.forEach(p => f.push(["", p.papel, p.falta]))
  return f
}

/** `1 - GRANOS`: el cuadre de kilos y la valuación, con la diferencia a la vista. */
function hojaDeGranos(c: CuadreGranos, v: ValuacionGranos, fechaCierre: string, origen?: { texto: string; url: string | null } | null): unknown[][] {
  const f: unknown[][] = []
  f.push([`1 - GRANOS al ${fechaCierre}`])
  f.push([])
  f.push(["CUADRE DE KILOS (toneladas)"])
  f.push(["Stock al inicio del ejercicio", c.stockInicioTn ?? "FALTA", c.notaInicio ?? ""])
  f.push(["+ Cosecha del ejercicio", c.cosechaTn ?? "FALTA"])
  f.push(["− Ventas del ejercicio", c.ventasTn, "← de los comprobantes de venta, SIN los arrendamientos cobrados en soja (detalle abajo)"])
  f.push(["= Saldo", c.saldoTn ?? "no se puede calcular"])
  f.push(["− Existencia declarada al cierre", c.stockEmpresaTn ?? "FALTA"])
  f.push(["= DIFERENCIA", c.diferenciaTn ?? "no se puede calcular",
    c.diferenciaTn == null ? "" : c.cierra ? "cierra dentro de la tolerancia" : "NO CIERRA — hay que explicarla"])
  f.push([])
  if (c.faltan.length > 0) {
    f.push(["Para poder cuadrar falta cargar:"])
    c.faltan.forEach(x => f.push(["", x]))
    f.push([])
  }
  // 📋 A-FEAT-1574 (JMS 06/11): de dónde sale cada número del cuadre — y su respaldo
  if (c.ventas) {
    f.push(["VENTAS DE GRANO QUE CUENTAN (salió grano)"])
    f.push(["Fecha", "Cliente", "Grano", "Toneladas", "Cuenta", "Comprobante"])
    c.ventas.cuentan.forEach(x => f.push([x.fecha, x.quien, x.grano ?? "", x.toneladas, x.cuenta ?? "", x.comprobante]))
    f.push(["TOTAL", "", "", c.ventas.tn])
    f.push([])
    if (c.ventas.noCuentan.length) {
      f.push(["NO CUENTAN EN EL CUADRE — arrendamientos cobrados en soja (la renta se fija en toneladas, pero no sale grano)"])
      f.push(["Fecha", "Cliente", "Grano", "Toneladas", "Cuenta", "Comprobante"])
      c.ventas.noCuentan.forEach(x => f.push([x.fecha, x.quien, x.grano ?? "", x.toneladas, x.cuenta ?? "", x.comprobante]))
      f.push([])
    }
  }
  if (c.certificaciones) {
    f.push(["COSECHA — certificaciones electrónicas de granos del ejercicio (el depósito en acopio; son el respaldo de la cosecha)"])
    f.push(["Fecha", "Depositario", "Comprobante", "Certificación (PDF)"])
    if (!c.certificaciones.length) f.push(["(no hay certificaciones cargadas en el ejercicio)"])
    c.certificaciones.forEach(x => f.push([x.fecha, x.depositario, x.comprobante, x.url ? conLink("ver la certificación", x.url) : "sin PDF vinculado"]))
    f.push([])
  }
  f.push(["VALUACIÓN"])
  f.push(["Toneladas", v.toneladas])
  f.push(["Precio por tonelada", v.precioPorTn ?? "FALTA EL PRECIO"])
  // 📅 A-FEAT-1422 (16): de dónde sale el precio (la pizarra de Rosario al cierre, o el escrito a mano), con su link.
  if (origen) f.push(["Origen del precio", origen.url ? conLink(origen.texto, origen.url) : origen.texto, origen.url ?? ""])
  f.push(["Monto bruto", v.montoBruto ?? ""])
  f.push(["% calidad", v.pctCalidad])
  f.push(["Monto neto", v.montoNeto ?? ""])
  f.push(["% CZ (comisión + flete + otros)", v.pctCz])
  f.push(["NETO FINAL", v.netoFinal ?? "FALTA EL PRECIO"])
  return f
}

/** `3 - SEMENTERAS`: lo sembrado y no cosechado, con lo que no entró y por qué. */
function hojaDeSementeras(s: Sementeras, fechaCierre: string): unknown[][] {
  const f: unknown[][] = []
  f.push([`3 - SEMENTERAS al ${fechaCierre}`])
  f.push(["Sólo cuenta las órdenes EJECUTADAS hasta el cierre: una planificada todavía no costó nada."])
  f.push([])
  f.push([`${s.ordenesEjecutadas} orden(es) ejecutada(s) · ${s.hectareas} ha`])
  f.push([])
  f.push(["Fecha", "Lote", "Ha", "Insumo", "Cantidad", "Unidad", "Precio unitario", "Costo"])
  s.lineas.forEach(l => f.push([
    l.fecha ?? "", l.lote, l.hectareas, l.insumo, l.cantidad ?? "", l.unidad,
    l.precioUnitario ?? "FALTA EL PRECIO", l.costo ?? "FALTA EL PRECIO",
  ]))
  f.push([])
  f.push(["COSTO", money(s.costo)])
  f.push([])
  f.push(["⚠️ EL COSTO ESTÁ INCOMPLETO — falta:"])
  s.faltan.forEach(x => f.push(["", x]))
  f.push([])
  if (s.ordenesNoContadas.length > 0) {
    f.push(["ÓRDENES QUE NO SE CONTARON, Y POR QUÉ"])
    f.push(["Fecha", "Lote", "Estado", "Motivo"])
    s.ordenesNoContadas.forEach(o => f.push([o.fecha ?? "", o.lote, o.estado, o.motivo]))
  }
  return f
}

/** Arma el workbook. Separado de la descarga para poder probarlo sin navegador. */
/**
 * 🔢 **Control cuotas templates** — ¿cada template tiene las cuotas esperadas en la campaña? Mismo
 * resultado que la pantalla (`lib/balance/control-cuotas-templates.ts`): preview importante primero,
 * lo que falta o sobra en rojo. Es un aviso: no cambia ningún número del libro.
 */
export function hojaControlCuotas(c: ControlCuotasTemplates): unknown[][] {
  const f: unknown[][] = []
  const mal = c.filas.filter(conProblema)
  f.push([`CONTROL DE CUOTAS DE TEMPLATES — ${c.empresa}, ${c.campania}`])
  f.push(["¿Cada template controlado tiene las cuotas que tiene que tener? Lista y cantidades: decisión de JMS del 28/10/2026."])
  f.push(["Anual o en cuotas: vale cualquiera de las dos, no las dos el mismo año. IIBB: un pago el mes siguiente a cada subdiario con ventas. SICORE: un pago por presentación."])
  f.push(["Un template compartido («PAM/MA/Duhau») se controla en la primera empresa nombrada. ★ = preview importante. Es un AVISO: no frena el libro."])
  f.push([mal.length === 0
    ? `Resultado: están todas (${c.filas.length} templates controlados).`
    : `Resultado: ${mal.length} de ${c.filas.length} no tienen las cuotas esperadas — ${resumenControlCuotas(c.filas).map(r => `${r.cantidad} ${r.estado}`).join(" · ")}`])
  f.push([])
  f.push(["Preview", "Estado", "Agrupadora", "Template", "Regla", "Esperado", "Encontrado", "Detalle", "Nota"])
  for (const x of c.filas) {
    const fila = [x.preview ? "★" : "", x.estado, x.agrupadora, x.nombre, x.regla,
      x.esperado ?? "", x.encontrado, x.detalle, x.nota ?? ""]
    f.push(x.estado === "falta" || x.estado === "mixto" ? conEstilo(fila, ESTILO_ERROR) : fila)
  }
  return f
}
const COLS_CONTROL_CUOTAS: Columna[] = [
  { ancho: 8 }, { ancho: 13 }, { ancho: 26 }, { ancho: 36 }, { ancho: 40 },
  { ancho: 10, z: ENTERO }, { ancho: 11, z: ENTERO }, { ancho: 80 }, { ancho: 50 },
]

export function armarWorkbook(
  libro: LibroDiario,
  /** Para el encabezado del índice. */
  empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
    /** El cuadre de la existencia. Va arriba de la valuación — ver `hojaDeHacienda`. */
    cuadre?: CuadreHacienda
    /** 🐄🌾 A-FEAT-1386: las tablas de saldos Sistema · SENASA · Campo · Balance. */
    saldos?: SaldosParaExcel
    /** 📦 A-FEAT-1420: el stock declarado al inicio por producto y las pasturas. */
    stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }
    /** 📅 A-FEAT-1422: de dónde salió cada precio (fecha y link para el contador). */
    fuentesPrecios?: FuentePrecio[]
    /** 🐄 A-FEAT-1541: el papel nuevo — movimientos, valorizado del inicio, tablas de precios, TC y saldos escritos. */
    movimientosPapel?: MovimientoPapel[]
    valuacionInicio?: ValuacionHacienda | null
    tablasInicio?: TablasPreciosPapel | null
    tablasCierre?: TablasPreciosPapel | null
    tcCierre?: number | null
    saldosGuardados?: Record<string, string | undefined>
    /** ⚖️ A-FEAT-1541: los kilos por categoría con el detalle animal por animal. */
    pesos?: PesoCategoria[]
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras; origenPrecioGranos?: { texto: string; url: string | null } | null },
  /**
   * Papeles 03 y 04. `pagar`/`cobrar` van sólo si la pantalla pudo averiguar **cuándo** se pagó cada
   * comprobante; `cheques` y `anticipos` son los bloques 04.1, 04.2 y 03.1 (A-FEAT-1195).
   */
  cuentas?: {
    pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre
    cheques?: ChequesDados; anticipos?: AnticiposAlCierre
  },
  /** Papeles 07, 08 y 09. Salen del extracto ya parseado y categorizado. */
  bancarios?: DatosDelIndice["bancarios"] & {
    fci?: { fondos: FondoComun[]; total: FondoComun }
    /** 💹 La tenencia del FCI cargada en la app (cuotapartes y valor, inicio y cierre) — JMS 06/11. */
    fciTenencia?: TenenciaFci | null
    /** 📎 Los extractos y resúmenes vinculados a cada cuenta y mes (A-FEAT-1571, scripts 211/212). */
    documentosRespaldo?: DocumentoRespaldo[]
    /** 🔗 id del original → link de su copia en «- Respaldo» (la carpeta que ve el contador). JMS 06/11. */
    copiasRespaldo?: Record<string, string>
    /** 🧾 El impuesto al cheque, total y desglosado (A-FEAT-1190). */
    impuestoCheque?: ImpuestoCheque
  },
  /** 👷 El papel de sueldos: el total de A y el total de B (A-FEAT-1216). */
  sueldos?: SueldosDelEjercicio,
  /** 🧾 Las cuentas corrientes con su saldo al cierre (A-FEAT-1218). */
  cuentasCorrientes?: PapelDeCuentasCorrientes,
  /** 📌 Los pendientes a revisar que anotó el usuario en la pantalla (A-FEAT-1258). */
  pendientes?: PendienteBalance[],
  /** ✍️ Los saldos del ejercicio anterior: gasto de este ejercicio (A-FEAT-1207). */
  saldosAnteriores?: SaldosAnteriores,
  /** 📒 Las facturas de «Asientos Contables» del ejercicio (A-FEAT-1318). */
  asientosContables?: AsientoLibroDiario[],
  /** 🧮 A-FEAT-1343: cuántas filas dijo la base y cuántas llegaron. */
  lecturas?: Lectura[],
  /** 🔢 ¿Cada template tiene sus cuotas en la campaña? (JMS 28/10/2026). */
  controlCuotas?: ControlCuotasTemplates,
  /** 🔁 A-FEAT-1427: el inicio según el balance anterior contra lo que reconoce la app. */
  controlesInicio?: ControlesInicio,
  /** 🔁 A-FEAT-1500: los temas del recorrido y sus tareas, para que el Excel diga lo mismo que la pantalla. */
  recorrido?: RecorridoParaExcel | null,
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  /**
   * 🗂️ **El ÍNDICE va PRIMERO**, antes del Control: es lo que contesta *«¿qué hay y qué falta?»*,
   * que es la pregunta con la que se abre el archivo. El Control viene atrás porque contesta la
   * siguiente — *«¿los números cierran?»*.
   */
  const indice = armarIndice({
    libro, templates, cuentas, sueldos, cuentasCorrientes,
    hacienda: hacienda?.valuacion ?? null,
    insumos: insumos ?? null,
    campo: campo ? { granos: campo.granos, sementeras: campo.sementeras } : null,
    bancarios: bancarios ?? null,
    lecturas,
  })
  // 🗂️ A-FEAT-1427: PRIMERO, ¿el export responde cada dato que se presentó el año pasado? (y si no, por qué)
  const cobertura = coberturaDeArgs(libro, empresa, templates, hacienda, insumos, campo, cuentas, bancarios, sueldos,
    cuentasCorrientes, pendientes, saldosAnteriores, asientosContables, lecturas, controlCuotas, controlesInicio)
  hoja(wb, "00 Cobertura", hojaDeCobertura(cobertura, libro.ejercicio.etiqueta))
  hoja(wb, "00 Indice", hojaDeIndice(indice, libro, empresa), COLS_INDICE)
  // 📋 A-FEAT-1427: cada renglón del balance con su saldo del año pasado y el de este año.
  if (controlesInicio?.inicioYCierre) hoja(wb, "00 Inicio y cierre", hojaInicioYCierre(controlesInicio.inicioYCierre, libro.ejercicio.etiqueta))
  // 📦 A-FEAT-1501: todos los stocks en una sola tabla — inicio y cierre, cantidad y precio, contable y económico.
  {
    const dia = new Date(Date.parse(`${primerDiaDelEjercicio(libro.ejercicio)}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
    const datosStocks = {
      fechaInicio: dia, fechaCierre: libro.ejercicio.fechaCierre,
      insumos: insumos ?? null,
      stockInicio: hacienda?.stockInicio ?? null,
      hacienda: hacienda ? { valuacion: hacienda.valuacion, saldos: hacienda.saldos?.hacienda ? { inicio: hacienda.saldos.hacienda.inicio, cierre: hacienda.saldos.hacienda.cierre } : undefined } : null,
      granos: campo ? { cuadre: campo.granos, valuacion: campo.valuacionGranos } : null,
      sementeras: campo?.sementeras ?? null,
    }
    hoja(wb, "00 Stocks inicio y cierre", hojaDeStocks(armarStocksUnificados(datosStocks), datosStocks), COLS_STOCKS)
  }
  // 📌 A-FEAT-1258 — los pendientes a revisar van pegados al índice: también contestan «¿qué falta?».
  if (pendientes && pendientes.length) {
    hoja(wb, "00 Pendientes a revisar", hojaDePendientes(sincronizarPendientes(pendientes, recorrido),
      `${empresa} — pendientes a revisar del ejercicio ${libro.ejercicio.etiqueta}`), COLS_PENDIENTES)
  }
  // 🔁 A-FEAT-1500: la cola entera del recorrido (movimientos, deudas, echeqs, ARCA…), igual que en pantalla.
  if (recorrido !== undefined) {
    hoja(wb, "00 Recorrido", hojaDelRecorrido(recorrido,
      `${empresa} — temas del recorrido del balance, ejercicio ${libro.ejercicio.etiqueta}`), COLS_RECORRIDO)
  }
  hoja(wb, "Control", hojaDeControl(libro, lecturas))
  // 📅 Los 12 meses en una línea cada uno, pegado al Control: es otro control (contra lo presentado a ARCA).
  hoja(wb, "Resumen 12 meses", hojaResumenMensual(libro), COLS_RESUMEN_MENSUAL)
  // 🛑 A-FEAT-1388: los comprobantes cuyas partes no suman su total, en rojo y con la marca (los mismos del Control).
  hoja(wb, "Compras", conTotalAlPie(hojaDeAsientos(libro.compras, libro.controles.compras.descuadres)), COLS_ASIENTOS)
  hoja(wb, "Ventas", conTotalAlPie(hojaDeAsientos(libro.ventas, libro.controles.ventas.descuadres)), COLS_VENTAS)
  // 📗 La apertura por cuenta contable — el formato que el usuario ya usaba (A-FEAT-1187).
  //    Van pegadas a su listado: primero el detalle, después el resumen que se le manda al contador.
  hoja(wb, "Compras por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.compras),
    `LIBRO DIARIO MENSUAL (Compras) — ejercicio ${libro.ejercicio.etiqueta}`,
    { asientos: libro.compras, descuadres: libro.controles.compras.descuadres }), COLS_POR_CUENTA)
  hoja(wb, "Ventas por cuenta", hojaPorCuenta(armarLibroPorCuenta(libro.ventas, TIPOS_SIN_CREDITO_VENTAS),
    `LIBRO DIARIO MENSUAL (Ventas) — ejercicio ${libro.ejercicio.etiqueta}`,
    { asientos: libro.ventas, descuadres: libro.controles.ventas.descuadres }, true), COLS_POR_CUENTA_VENTAS)
  /**
   * 🧾 **El papel 05 es la provisión de FACTURAS (compras); la de COBROS (ventas) es del papel 03.**
   *
   * Hasta el 2026-09-30 las dos iban juntas en `05 Provision`, porque `armarLibroDiario` las devuelve
   * en una sola lista. **Son dos papeles distintos de su balance** —`05 - PROVISION FC` y el bloque
   * `PROVISION COBROS` del 03—, y sumar una venta a provisionar dentro de la provisión de compras
   * infla el gasto del ejercicio con un ingreso.
   */
  const provisionCompras = libro.provisiones.filter(a => a.fuente !== "venta")
  const provisionVentas = libro.provisiones.filter(a => a.fuente === "venta")
  hoja(wb, "05 Provision", hojaDeProvision(provisionCompras, libro.provisionesEjercicioAnterior,
    libro.ejercicio.etiqueta, armarEjercicio(libro.ejercicio.anioCierre - 1, libro.ejercicio.mesCierre).etiqueta,
    controlesInicio?.provision),
    [...COLS_ASIENTOS, { ancho: 30 }, { ancho: 50 }, { ancho: 80 }])
  // 🧾 JMS 04/11: «provisión de cobros pasalo junto con provisión de gasto» → pegada al 05 (libro D).
  // ⚠️ Va SIEMPRE, incluso sin una sola fila: es donde se dice que los cheques en cartera no salen
  //    del sistema. Si la solapa faltara, el contador leería «no había» (§ 🧮).
  hoja(wb, "03.1 Provision cobros",
    hojaDeProvisionCobros(provisionVentas, libro.ejercicio.etiqueta), [...COLS_ASIENTOS, { ancho: 80 }])
  // 💳 Cuentas a pagar y a cobrar al cierre — papeles 03 y 04 (A-FEAT-1187), con sus bloques de
  //    cheques, anticipos y provisión de cobros (A-FEAT-1195).
  /**
   * 👥 A-FEAT-1537 (JMS 04/11): el papel 14 y los totales de 03/04 sólo con clientes y proveedores; los socios, aparte
   * (solapa 14.1) hasta que se vean sus cuentas.
   */
  const cc = cuentasCorrientes ? separarSocios(cuentasCorrientes) : null
  if (cuentas?.pagar) {
    hoja(wb, "04 Cuentas a pagar",
      hojaDeCuentas(cuentas.pagar, `CUENTAS A PAGAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre,
        templates ? { cuotas: templates.impagasAlCierre, total: templates.totalImpagas } : undefined,
        cc ? { lado: "pagar", cc: cc.terceros } : undefined,
        // 👷 JMS 04/11: «sueldos vamos a hacer un export aparte, sacalo de a pagar» → no suman acá; se ven en el 04.3.
        { soloDeuda: true }),
      COLS_CUENTAS)
  }
  if (cuentas?.cheques) {
    hoja(wb, "04.1 Cheques dados",
      hojaDeChequesDados(cuentas.cheques, libro.ejercicio.etiqueta, libro.ejercicio.fechaCierre),
      COLS_CHEQUES)
  }
  if (cuentas?.anticipos) {
    hoja(wb, "04.2 Anticipos",
      hojaDeAnticipos(cuentas.anticipos, libro.ejercicio.etiqueta, libro.ejercicio.fechaCierre),
      COLS_ANTICIPOS)
  }
  // 📒 A-FEAT-1537: el respaldo de 04, pegado a sus bloques (después de cheques y anticipos).
  if (cuentas?.pagar) {
    hoja(wb, "04.3 Respaldo cuentas a pagar",
      hojaRespaldoDeCuentas(cuentas.pagar, `RESPALDO DE CUENTAS A PAGAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre,
        templates ? { cuotas: templates.impagasAlCierre, total: templates.totalImpagas } : undefined,
        sueldos?.impagosAlCierre, cc?.socios, cuentas.anticipos),
      COLS_CUENTAS)
  }
  if (cuentas?.cobrar) {
    hoja(wb, "03 Cuentas a cobrar",
      hojaDeCuentas(cuentas.cobrar, `CUENTAS A COBRAR — ejercicio ${libro.ejercicio.etiqueta}`,
        libro.ejercicio.fechaCierre, undefined, cc ? { lado: "cobrar", cc: cc.terceros } : undefined), COLS_CUENTAS)
  }
  // ⚠️ Se incluye SIEMPRE, aunque esté vacía: una solapa vacía dice «no hay», y que falte dice
  // «no se miró». No es lo mismo (§ 🧮: nada se descarta en silencio).
  hoja(wb, "Sin subdiario", hojaDeAsientos(libro.sinSubdiario), COLS_ASIENTOS)
  // 📒 A-FEAT-1318 — también SIEMPRE cuando la pantalla la pudo leer: vacía dice «no hay».
  if (asientosContables) {
    hoja(wb, "Asientos Contables", hojaDeAsientosContables(asientosContables, libro.ejercicio.etiqueta), COLS_ASIENTOS)
  }
  // 👷 Los sueldos van pegados a los templates: son las dos partes que NO salen de comprobantes.
  if (sueldos) {
    hoja(wb, "13 Sueldos", hojaDeSueldos(sueldos, libro.ejercicio.etiqueta), COLS_SUELDOS)
  }
  // 🧾 Las cuentas corrientes, pegadas a los sueldos: las dos son saldos con personas.
  if (cc) {
    // 👥 A-FEAT-1537: 14 = clientes y proveedores; las marcas sin tratar y «Desglosar» son de los socios → 14.1.
    hoja(wb, "14 Cuentas corrientes",
      hojaDeCuentasCorrientes({ ...cc.terceros, sinTratar: [], totalSinTratar: 0, desgloseTarjeta: undefined },
        libro.ejercicio.fechaCierre, "CUENTAS CORRIENTES — clientes y proveedores",
        "Las cuentas con los socios (José, Andrés, MA, Sucesión) están en la solapa «14.1 Cuentas con socios» y no suman a 03 ni a 04."),
      COLS_CUENTAS_CORRIENTES)
    if (cc.socios.length > 0 || cc.terceros.sinTratar.length > 0) {
      hoja(wb, "14.1 Cuentas con socios",
        hojaDeCuentasCorrientes({ ...cc.terceros, cuentas: cc.socios, aseguradoras: undefined, historicoSinAtribuir: 0 },
          libro.ejercicio.fechaCierre, "CUENTAS CORRIENTES CON LOS SOCIOS — se ven después (JMS 04/11)",
          "No suman a las cuentas a pagar ni a cobrar. Abajo, las marcas del extracto todavía sin tratar y los pagos de la tarjeta a desglosar."),
        COLS_CUENTAS_CORRIENTES)
    }
  }
  if (templates) {
    // 🧾 JMS 29/10 (A-FEAT-1422 nota 10): en dos solapas, «Impuestos» y «Otros», cada una con su «por mes».
    const partes = partirEnImpuestosYOtros(templates)
    if (partes) {
      for (const [nombre, t] of [["Impuestos", partes.impuestos], ["Otros", partes.otros]] as const) {
        hoja(wb, nombre, hojaDeTemplates(t), COLS_TEMPLATES)
        hoja(wb, `${nombre} por mes`, hojaTemplatesPorMes(t), COLS_TEMPLATES_POR_MES(t.columnas.length))
      }
    } else {
      hoja(wb, "Templates", hojaDeTemplates(templates), COLS_TEMPLATES)
      hoja(wb, "Templates por mes", hojaTemplatesPorMes(templates),
        COLS_TEMPLATES_POR_MES(templates.columnas.length))
    }
  }
  // 🔢 Pegado a los templates: es su control de cantidad (el de las facturas fijas va en «Control»).
  if (controlCuotas) hoja(wb, "Control cuotas templates", hojaControlCuotas(controlCuotas), COLS_CONTROL_CUOTAS)
  // ✍️ A-FEAT-1207 — va pegada a los templates: es gasto del ejercicio que no viene de una cuota.
  if (saldosAnteriores && (saldosAnteriores.vigentes.length > 0 || saldosAnteriores.anulados.length > 0)) {
    const filas = hojaDeSaldosAnteriores(saldosAnteriores, libro.ejercicio.etiqueta)
    if (templates) {
      /**
       * ⚠️ cambió 2026-10-27 (A-FEAT-1388): sumaba TODOS los tipos — FCI, plazo fijo, retiros — y lo
       * llamaba gasto. El gasto son sólo los EGRESOS.
       */
      const gastoTemplates = (templates.porTipo ?? []).find(g => g.tipo === "egreso")?.totalNeto ?? 0
      filas.push([])
      filas.push(["GASTO DE TEMPLATES DEL EJERCICIO", "cuotas de EGRESOS (solapa Templates, neto)", money(gastoTemplates)])
      filas.push(["", "+ saldos del ejercicio anterior", saldosAnteriores.total])
      filas.push(["", "= total", money(gastoTemplates + saldosAnteriores.total)])
    }
    hoja(wb, "Saldos ej. anterior", filas)
  }
  if (hacienda?.movimientosPapel) {
    agregarPapelHacienda(wb, hacienda as DatosPapelHacienda, empresa, libro.ejercicio)
  } else if (hacienda) {
    hoja(wb, "02 Hacienda",
      hojaDeHacienda(hacienda.valuacion, libro.ejercicio.fechaCierre, hacienda.mesPrecios, hacienda.cuadre,
        hacienda.saldos?.hacienda, hacienda.saldos?.productivos?.fechaInicio, hacienda.fuentesPrecios),
      COLS_HACIENDA)
    hoja(wb, "Precios", hojaDePrecios(hacienda.mag, hacienda.mercado, hacienda.porCabeza, hacienda.mesPrecios), COLS_PRECIOS)
  }
  if (insumos) {
    const filasIns = hojaDeInsumos(insumos, libro.ejercicio.fechaCierre)
    // 🌾 A-FEAT-1386: Sistema · Campo · Balance de insumos, gas oil y sementeras (JMS 29/10), al pie del stock.
    if (hacienda?.saldos?.productivos) { filasIns.push([]); agregarSaldosProductivos(filasIns, hacienda.saldos.productivos) }
    hoja(wb, "Stock insumos", filasIns, COLS_INSUMOS)
  }
  // 📦 A-FEAT-1420: el stock DECLARADO al inicio, producto por producto, y las pasturas.
  if (hacienda?.stockInicio && (hacienda.stockInicio.renglones.length || hacienda.stockInicio.pasturas.length)) {
    hoja(wb, "Stock al inicio", hojaStockInicio(hacienda.stockInicio.renglones, hacienda.stockInicio.pasturas, hacienda.stockInicio.fecha))
  }
  // 🏦 Los papeles bancarios (07, 08, 09). Van al final: son anexos del resultado, no el resultado.
  if (bancarios) {
    if (bancarios.fci) {
      hoja(wb, "07 Bancos",
        hojaDeBancos(bancarios.saldos, bancarios.fci, libro.ejercicio.fechaCierre,
          bancarios.cadenas ?? [], bancarios.fciTenencia ?? null, bancarios.documentosRespaldo ?? []), COLS_BANCOS)
      // 🧮 El control del papel 07, en su propia solapa: ver `hojaDeCadenaDeSaldos`.
      if ((bancarios.cadenas ?? []).length > 0) {
        hoja(wb, "07.1 Cadena de saldos",
          hojaDeCadenaDeSaldos(bancarios.cadenas ?? [], libro.ejercicio.fechaCierre), COLS_CADENA)
      }
    }
    // 📎 A-FEAT-1571 (JMS 06/11): el documento que respalda cada número del 07 y de las provisiones, en una sola solapa.
    hoja(wb, "00 Respaldos", hojaDeRespaldos(renglonesDeRespaldo({
      fechaCierre: libro.ejercicio.fechaCierre, fechaInicio: `${Number(libro.ejercicio.fechaCierre.slice(0, 4)) - 1}${libro.ejercicio.fechaCierre.slice(4)}`,   // la tenencia al inicio = la del cierre anterior
      saldos: bancarios.saldos, fci: bancarios.fciTenencia ?? null,
      provision: libro.provisiones.filter(a => a.fuente !== "venta"), provisionAnterior: libro.provisionesEjercicioAnterior,
      provisionCobros: libro.provisiones.filter(a => a.fuente === "venta"),
      documentos: bancarios.documentosRespaldo ?? [],
    })), [{ ancho: 30 }, { ancho: 45 }, { ancho: 18 }, { ancho: 16 }, { ancho: 60 }, { ancho: 60 }, { ancho: 60 }])
    // 💵 A-FEAT-1530: cada movimiento en dólares con su TC y sus pesos, y las compraventas con el TC que resulta
    if ((bancarios.cuentasEnDolares ?? []).some(c => c.movs.length)) {
      hoja(wb, "07.2 Operaciones en dólares",
        hojaOperacionesEnDolares(bancarios.cuentasEnDolares ?? [], bancarios.compraVentaPesos ?? [], libro.ejercicio.etiqueta, empresa, mesesDelLibro(libro)))
    }
    hoja(wb, "08 Gastos bancarios",
      hojaDeGastosBancarios(bancarios.gastos, libro.ejercicio.etiqueta, bancarios.gastosEnDolares ?? []))
    if (bancarios.impuestoCheque) {
      hoja(wb, "08.1 Impuesto al cheque",
        hojaDeImpuestoCheque(bancarios.impuestoCheque, libro.ejercicio.etiqueta,
          controlarCheque(bancarios.impuestoCheque.total.total, chequeEnPapel08(bancarios.gastos),
            chequeEnTemplates(templates, empresa), empresa)))
    }
    hoja(wb, "09 Retiros y aportes",
      hojaDeRetiros(bancarios.retiros, libro.ejercicio.etiqueta))
  }
  if (campo) {
    hoja(wb, "1 Granos", hojaDeGranos(campo.granos, campo.valuacionGranos, libro.ejercicio.fechaCierre, campo.origenPrecioGranos), COLS_GRANOS)
    hoja(wb, "3 Sementeras", hojaDeSementeras(campo.sementeras, libro.ejercicio.fechaCierre), COLS_SEMENTERAS)
  }
  // 🔗 JMS 06/11: los links apuntan a la copia en «- Respaldo» (la que se comparte con el contador) cuando existe
  if (bancarios?.copiasRespaldo) linksALasCopias(wb as unknown as { Sheets: Record<string, Record<string, unknown>> }, bancarios.copiasRespaldo)
  return wb
}

export function nombreArchivo(libro: LibroDiario, empresa: string): string {
  const hoy = new Date().toISOString().slice(0, 10)
  const estado = libro.controles.sePuedeEntregar ? "" : "_REVISAR"
  return `Papeles_balance_${empresa}_${libro.ejercicio.etiqueta.replace("/", "-")}_${hoy}${estado}.xlsx`
}

/**
 * 📚 A-FEAT-1505 — las hojas del LIBRO C: por responsable (MSA, después MA, después PAM) el listado de templates, sus
 * cuotas (fecha de pago o, si no, la estimada) y el por mes agrupado por agrupadora; y, después del set de la empresa del
 * balance, el detalle de impuestos y gastos bancarios, intereses e inversiones (JMS 01/11, solapa «C - Ver nuevas…»).
 */
export function agregarLibroC(wb: XLSX.WorkBook, empresa: string, etiqueta: string, templates?: TemplatesDelEjercicio | null,
  detalle?: MovimientoDelDetalle[] | null, meses: { clave: string; rotulo: string }[] = []): void {
  const orden = [empresa, ...["MSA", "MA", "PAM"].filter(r => r !== empresa)]
  const corto = (r: string) => r.slice(0, 4)
  orden.forEach((resp, i) => {
    const t = templates ? templatesDeResponsable(templates, resp) : null
    if (t) {
      hoja(wb, `C · ${corto(resp)} · Templates`, hojaListadoTemplates(t, resp, etiqueta), COLS_LISTADO_TEMPLATES)
      hoja(wb, `C · ${corto(resp)} · Cuotas`, hojaDeTemplates(t), COLS_TEMPLATES)
      hoja(wb, `C · ${corto(resp)} · Por mes`, hojaTemplatesPorMes(t), COLS_TEMPLATES_POR_MES(t.columnas.length))
    }
    if (i === 0) {
      for (const g of ["Impuestos bancarios", "Gastos bancarios", "Intereses", "Inversiones"] as GrupoDetalle[]) {
        hoja(wb, `C · ${g}`, detalle ? hojaDeDetalle(g, detalle, etiqueta, empresa, meses) : [[`${g.toUpperCase()}`], ["⚠️ No se armaron los papeles bancarios: falta el detalle."]], COLS_RESUMEN_MES)
      }
    }
  })
}

const COLS_LISTADO_TEMPLATES: Columna[] = [
  { ancho: 34 }, { ancho: 30 }, { ancho: 16 }, { ancho: 26 }, { ancho: 26 }, { ancho: 24 }, { ancho: 14 },
  { ancho: 9, z: ENTERO }, { ancho: 9, z: ENTERO }, { ancho: 10, z: ENTERO }, { ancho: 18, z: MONEDA },
]
const COLS_DETALLE_BANCARIO: Columna[] = [
  { ancho: 26 }, { ancho: 8 }, { ancho: 11 }, { ancho: 44 }, { ancho: 22 }, { ancho: 28 }, { ancho: 16, z: MONEDA }, { ancho: 16, z: MONEDA },
]

/**
 * 📚 A-FEAT-1505 — baja el SET: los libros A a E en un .zip (JMS: «así tengo siempre todo el set parejo»). Se arma el libro
 * completo una sola vez (más el C) y se reparte: los cinco salen del mismo cálculo que el Excel de siempre.
 */
export async function descargarSetDelBalance(a: Parameters<typeof armarWorkbook>, entradaF?: EntradaBalanceEnLinea | null, lib?: MovimientoLib[] | null, papeles?: DatosPapelesH | null): Promise<void> {
  const [libro, empresa, templates, , , , , bancarios] = a
  const wb = armarWorkbook(...a)
  const meses = mesesDelLibro(libro)
  agregarLibroC(wb, empresa, libro.ejercicio.etiqueta, templates ?? null, bancarios?.detalleBancario ?? null, meses)
  if (entradaF) agregarLibroF(wb, entradaF)
  if (templates) agregarLibroG(wb, templates.detalle, libro.ejercicio.etiqueta, lib ?? null, meses)
  if (templates) agregarLibroH(wb, templates, libro.ejercicio.etiqueta, meses, papeles)
  const { default: JSZip } = await import("jszip")
  const zip = new JSZip()
  const base = nombreArchivo(libro, empresa).replace(/\.xlsx$/, "")
  for (const l of repartirEnLibros(wb, vistasDe(wb))) {
    fechasReales(l.wb) // 📅 fechas como fecha: el filtro agrupa por año y mes (lib/excel/fechas-reales.ts)
    const datos = await aplicarVistas(XLSX.write(l.wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, l.vistas)
    zip.file(`${base} - ${LIBROS[l.letra]}.xlsx`, datos)
  }
  // 🔍 A-FEAT-1579: el H PARA AUDITAR, aparte (no va al contador): misma base, con quién pagó, código, efecto y marca por cuota.
  if (templates) {
    const wbA = XLSX.utils.book_new()
    agregarLibroH(wbA, templates, libro.ejercicio.etiqueta, meses, papeles, { auditoria: true })
    fechasReales(wbA)
    zip.file(`${base} - H para auditar (no va al contador).xlsx`, await aplicarVistas(XLSX.write(wbA, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wbA)))
  }
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const el = document.createElement("a")
  el.href = url
  el.download = `${base} - set A-I.zip`
  document.body.appendChild(el)
  el.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(el) }, ESPERA_ANTES_DE_LIBERAR_MS)
}

/** 📚 A-FEAT-1512 — el LIBRO G: los grupos de templates (propuesta) y lo marcado LIB, con el formato de «impuestos bancarios». */
/** 🧮 A-FEAT-1513: los 12 meses del ejercicio como `AAAA-MM` y su rótulo (`jul-25`). */
export function mesesDelLibro(libro: LibroDiario): { clave: string; rotulo: string }[] {
  const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  return libro.ejercicio.subdiarios.map(x => ({ clave: `${x.anio}-${String(x.mes).padStart(2, "0")}`, rotulo: `${MES[x.mes - 1]}-${String(x.anio).slice(-2)}` }))
}
/**
 * 🎨 Los anchos que JMS le dio a «H · MA · Imp Rurales» en el H para auditar (09/11: «el formato que le di… es para usar en todas las
 * de ese tipo»): A Nro · B Mes · C Fecha · D Concepto · E Banco · F Comprobante · G Proveedor · H Detalle · I Estado · J-K Débito/Crédito ·
 * L Quién pagó · M Código · N Efecto · O Marca. Arriba, las mismas columnas son los 12 meses y el total (con formato de pesos).
 */
/** 🎨 «Retiros y aportes» (JMS 09/11, revisión D.4.d): arriba semestres · Nro · categoría · 12 meses; abajo Nro · Mes · Fecha · Concepto · Agrupadora ·
 * Responsable · Quién pagó · Código · Marca · Débito · Crédito · Descripción · Beneficiario · Factura · Interno. */
const COLS_INCONSISTENCIAS: Columna[] = [44, 12, 30, 34, 12, 16, 12, 28, 12, 30, 34, 26].map((ancho, i) => (i === 5 || i === 2 ? { ancho, z: MONEDA } : { ancho }))
const COLS_RETIROS: Columna[] = [14, 14, 14, 30, 50, 13, 30, 13, 16, 14, 14, 30, 36, 44, 13, 13, 15].map(ancho => ({ ancho, z: MONEDA }))
const COLS_H_AUDITAR: Columna[] = [8.17, 11.88, 15.45, 30.31, 16.74, 10.17, 23.31, 15.74, 13.03, 13.03, 13.03, 20.45, 10.31, 28.46, 13.17, 30, 36, 44, 12]  // = sus anchos de Excel − 0,83 (lo que suma Excel)
  .map((ancho, i) => (i >= 2 ? { ancho, z: MONEDA } : { ancho }))
const COLS_RESUMEN_MES: Columna[] = [{ ancho: 22 }, { ancho: 32 }, ...Array.from({ length: 12 }, () => ({ ancho: 13, z: MONEDA })), { ancho: 15, z: MONEDA }]

export function agregarLibroG(wb: XLSX.WorkBook, cuotas: CuotaTemplate[], etiqueta: string, lib: MovimientoLib[] | null, meses: { clave: string; rotulo: string }[] = []): void {
  const gs = armarGruposTemplates(cuotas)
  hoja(wb, "G · Indice de grupos", hojaIndiceGrupos(gs, cuotas, etiqueta, lib), [{ ancho: 14 }, { ancho: 44 }, { ancho: 32 }, { ancho: 10, z: ENTERO }, { ancho: 18, z: MONEDA }])
  for (const g of gs) hoja(wb, nombreSolapaGrupo(g), hojaGrupo(g, etiqueta, meses), COLS_RESUMEN_MES)
  if (lib) hoja(wb, "G · LIB (paralelo)", hojaLib(lib, etiqueta, meses), COLS_RESUMEN_MES)
}

/**
 * 📗 A-FEAT-1514 — el LIBRO H, templates integral (JMS 01/11: «el export de templates debe ser uno integral… reporte total»).
 * Por responsable, MSA → MA → PAM: Templates, Cuotas y Por mes (tal cual las del libro C) y después una solapa por agrupadora
 * del template, todas, con el grupo sin agrupadora al final. No reemplaza a C ni a G.
 */
export function agregarLibroH(wb: XLSX.WorkBook, templates: TemplatesDelEjercicio, etiqueta: string, meses: { clave: string; rotulo: string }[] = [],
  /** 🏛️ A-FEAT-1516: las cuotas de impuestos y sus auxiliares, para el papel de inmobiliario / Red Vial / automotores. */
  papeles?: DatosPapelesH | null,
  /**
   * 🔍 A-FEAT-1579 (JMS 07/11): el H PARA AUDITAR — la misma base, con los retiros adentro (no van al libro I), cada cuota con
   * Quién pagó · Código contable · Efecto · Marca, y sin el pulido para el contador. El H del contador no cambia.
   */
  opcion: { auditoria?: boolean } = {}): void {
  const aud = !!opcion.auditoria
  for (const resp of ["MSA", "MA", "PAM"]) {
    const tTodo = templatesDeResponsable(templates, resp)
    if (!tTodo) continue
    /**
     * 👥 JMS 05/11: *«yo quiero entregar parte, pero nada de retiros»* → las DISTRIBUCIONES (retiros y aportes de socios) salen
     * del libro H al libro I (socios), con su «Por mes» y sus solapas de agrupadora. El H queda con egresos y financiero.
     */
    const idsDist = new Set(aud ? [] : tTodo.detalle.filter(c => c.tipo === "distribucion").map(c => c.id))
    const rearmar = (quedan: (c: CuotaTemplate) => boolean) => tTodo.entrada
      ? armarTemplatesDelEjercicio(tTodo.entrada.cuotas.filter(quedan), tTodo.entrada.ej, tTodo.entrada.opciones) : tTodo
    const t = idsDist.size ? rearmar(c => !idsDist.has(c.id)) : tTodo
    const tDist = idsDist.size ? rearmar(c => idsDist.has(c.id)) : null
    if (tDist && tDist.detalle.length) {
      const porMesI = `I · ${resp} · Retiros por mes`
      for (const g of gruposDelResponsable(tDist.detalle, resp)) {
        hoja(wb, nombreSolapaGrupo(g, "I"), armarHojaGrupo(g, etiqueta, meses, { hojaPorMes: porMesI, extracto: tDist.entrada?.opciones.extracto }).filas, COLS_RESUMEN_MES)
      }
      hoja(wb, porMesI, hojaTemplatesPorMes(tDist), COLS_TEMPLATES_POR_MES(tDist.columnas.length))
    }
    const hojaPorMes = `H · ${resp} · Por mes`
    const usados = new Set([...wb.SheetNames, `H · ${resp} · Templates`, `H · ${resp} · Cuotas`, hojaPorMes])
    const tablasSinLeer = t.entrada?.opciones.bancoSinLeer
    // Las solapas de agrupadora se arman antes, para que «Por mes» pueda apuntar a sus totales (control del todo a las partes).
    const grupos = gruposDelResponsable(t.detalle, resp).map(g => {
      let nombre = nombreSolapaGrupo(g, "H"), n = 2
      while (usados.has(nombre)) nombre = `${nombreSolapaGrupo(g, "H").slice(0, 28)} ${n++}`
      usados.add(nombre)
      return { g, nombre, ...armarHojaGrupo(g, etiqueta, meses, { hojaPorMes, tablasSinLeer, extracto: t.entrada?.opciones.extracto, auditoria: aud }) }
    })
    hoja(wb, `H · ${resp} · Templates`, hojaListadoTemplates(t, resp, etiqueta), COLS_LISTADO_TEMPLATES)
    hoja(wb, `H · ${resp} · Cuotas`, hojaDeTemplates(t), COLS_TEMPLATES)
    // 🔎 A-FEAT-1518 (02/11): lo del extracto de este responsable sin categoría ni vínculo — no lo ve ningún control de abajo.
    const extracto = t.entrada?.opciones.extracto
    const sinCateg = extracto ? sinCategoriaNiVinculo(extracto.movimientos, resp) : []
    const hojaSinCateg = `H · ${resp} · Extracto sin categ`
    const porMes = hojaTemplatesPorMes(t)
    const filasPorMes = [...porMes, ...controlSolapasH(t, grupos, porMes.length), ...lineaSinCategoria(sinCateg, hojaSinCateg, !!extracto),
      ...lineaACuentaSocio(templates, resp)]
    plegarNotasPorMes(filasPorMes)
    hoja(wb, hojaPorMes, filasPorMes, COLS_TEMPLATES_POR_MES(t.columnas.length))
    for (const x of grupos) hoja(wb, x.nombre, x.filas, aud ? COLS_H_AUDITAR : COLS_RESUMEN_MES)
    if (sinCateg.length) hoja(wb, hojaSinCateg, hojaExtractoSinCategoria(sinCateg, resp, etiqueta, meses), COLS_RESUMEN_MES)
    // 🏛️ A-FEAT-1516: el papel de cada impuesto por partida (2 años calendario) con su control contra las solapas de arriba.
    // 🚗 A-FEAT-1539 (JMS 04/11: «esto hay que armarlo mejor, no me convence ni éste ni el otro de automotores»): un renglón por
    // vehículo con lo pagado y cuándo; reemplaza al papel de automotores (el de la planilla de impuestos).
    const autos = hojaAutomotores(t.detalle, resp, etiqueta)
    if (autos) hoja(wb, `H · ${resp} · Automotores`, autos, COLS_AUTOMOTORES)
    if (papeles) {
      for (const x of solapasPapelesH(papeles, resp, meses.map(m => m.clave), t.detalle)) {
        if (autos && / Papel Automotores$/.test(x.nombre)) continue
        agregarHojaConEstilo(wb, x.nombre, x.hoja)
      }
    } else {
      hoja(wb, `H · ${resp} · Papel impuestos`, [["INMOBILIARIO, RED VIAL Y AUTOMOTORES"], ["⚠️ No se pudieron leer las cuotas de impuestos: el papel no salió. Bajalo desde Egresos → Templates → Planilla de impuestos."]], [{ ancho: 90 }])
    }
  }
  // 🏢 A-FEAT-1521: Libertad cruza responsables (PAM hasta dic-25, MA desde ene-26, siempre con MSA): una sola solapa al final.
  // 👥 JMS 04/11: Libertad va al libro I (próximo excel), con las cuentas de los socios.
  hoja(wb, "Gastos Libertad", hojaLibertad(templates.detalle, etiqueta, meses, templates.entrada?.opciones.extracto), COLS_RESUMEN_MES)
  // 🔍 A-FEAT-1579: en el de auditar, los retiros y aportes desde la columna Efecto, con su control contra el banco (también lo que va
  // «por la cuenta de un socio», como Gastos Reintegro JMS: no es gasto, pero es un movimiento con el socio)
  // 🧾 JMS 09/11: las INCONSISTENCIAS de todas las solapas, en una sola, con link a la solapa de cada cuota
  if (aud) {
    const solapaDe = (c: CuotaTemplate) => { const r = responsablePrincipal(c.responsable); const n = nombreSolapaGrupo({ responsable: r, agrupadora: (c.agrupadoraTemplate ?? "").trim() || SIN_GRUPO }, "H"); return wb.SheetNames.includes(n) ? n : "" }
    hoja(wb, "Inconsistencias", hojaInconsistencias([...templates.detalle, ...(templates.aCuentaSocio ?? [])], etiqueta, solapaDe), COLS_INCONSISTENCIAS)
  }
  if (aud) hoja(wb, "H · Retiros y aportes", hojaRetirosYAportes([...templates.detalle, ...(templates.aCuentaSocio ?? [])], templates.entrada?.opciones.extracto, etiqueta, meses), COLS_RETIROS)
  // 📗 A-FEAT-1539: el libro para mandar — sin la palabra «template» (no es contable) y sin subtítulos. El de auditar no se pule.
  if (!aud) pulirLibroH(wb)
  else agregarIndiceH(wb)
}

/**
 * 🗂️ Pone primero estas solapas (en este orden) y deja las demás como estaban. La VISTA de cada solapa (filas fijas, color) va por
 * posición, así que se reordena junto con los nombres.
 */
export function reordenarSolapas(wb: XLSX.WorkBook, primeras: string[]): void {
  const vs = vistasDe(wb)
  const viejo = [...wb.SheetNames]
  const nuevo = [...primeras.filter(n => viejo.includes(n)), ...viejo.filter(n => !primeras.includes(n))]
  wb.SheetNames = nuevo
  if (vs.length === viejo.length) VISTAS.set(wb, nuevo.map(n => vs[viejo.indexOf(n)]))
}

/**
 * 🧭 **EL ÍNDICE del H para auditar** (A-FEAT-1579, JMS 09/11: *«¿se le puede armar un menú al Excel? para dirigirme a las solapas
 * desde el menú, desplegable, así me figuran los 3 responsables y le abro las subpestañas»*). Primera solapa: MSA, MA, PAM y General,
 * cada uno plegado con su [+]; cada solapa es un link. Y en cada solapa el título (A1) lleva de vuelta al índice.
 */
export function agregarIndiceH(wb: XLSX.WorkBook): void {
  const NOMBRE = "Índice"
  const PREFIJO = /^H · (MSA|MA|PAM) · /
  const grupos = new Map<string, string[]>()
  for (const n of wb.SheetNames) { const g = n.match(PREFIJO)?.[1] ?? "General"; grupos.set(g, [...(grupos.get(g) ?? []), n]) }
  /**
   * 🎨 JMS 09/11 (revisión D.1 y D.2): al lado de cada solapa su TOTAL y cuántas 🔴 / 🟡 / ⚠️ tiene (a dónde ir primero), la leyenda de las
   * marcas arriba, y las agrupadoras PRIMERO; Templates, Cuotas, Por mes, el extracto sin categoría y los papeles, abajo («datos de base»).
   */
  const BASE = /· (Templates|Cuotas|Por mes|Extracto sin categ|Automotores|Papel .*)$/
  const resumenDe = (n: string) => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) as unknown[][]
    const hi = rows.findIndex(r => Array.isArray(r) && r[0] === "Nro" && r.includes("Marca") && r.includes("Débito"))
    if (hi < 0) return null
    const H = rows[hi], iD = H.indexOf("Débito"), iC = H.indexOf("Crédito"), iM = H.indexOf("Marca")
    let total = 0, rojo = 0, amarillo = 0, codigo = 0
    for (const r of rows.slice(hi + 1)) {
      if (!Array.isArray(r) || typeof r[0] !== "number") break
      total += (Number(r[iD]) || 0) - (Number(r[iC]) || 0)
      const m = String(r[iM] ?? "")
      if (m.startsWith("🔴")) rojo++
      if (m.startsWith("🟡")) amarillo++
      if (m.includes("código esperado")) codigo++
    }
    return { total: Math.round(total * 100) / 100, rojo, amarillo, codigo }
  }
  const link = (n: string) => ({ t: "s", v: n.replace(PREFIJO, ""), l: { Target: `#'${n.replace(/'/g, "''")}'!A1`, Tooltip: `Ir a «${n}»` } })
  const cuenta = (x: number) => (x ? { t: "n", v: x, z: "0" } : "")
  const filas: unknown[][] = [["ÍNDICE — el [+] de la izquierda abre cada responsable; tocá una solapa para ir. En cada solapa, el título («⬅ Índice») trae de vuelta acá."],
    ["Marcas: ✓ pagada y respaldada por el banco · 🔴 sin pagar · 🟡 a revisar (pagada sin movimiento, o el banco movió otro importe) · ⚪ en $ 0 · ⚠️ el código contable no es el esperado"],
    [], ["", "Solapa", "Total (débito − crédito)", "🔴 sin pagar", "🟡 a revisar", "⚠️ código"]]
  const niveles = [0, 0, 0, 0]
  for (const g of ["MSA", "MA", "PAM", "General"]) {
    const ns = grupos.get(g)
    if (!ns?.length) continue
    const agrup = ns.filter(n => !BASE.test(n)), base = ns.filter(n => BASE.test(n))
    filas.push([`${g === "General" ? "GENERAL (retiros y aportes, Libertad)" : g} — ${ns.length} solapa${ns.length === 1 ? "" : "s"}`]); niveles.push(0)
    for (const n of agrup) {
      const r = resumenDe(n)
      filas.push(["", link(n), r ? { t: "n", v: r.total, z: MONEDA } : "", cuenta(r?.rojo ?? 0), cuenta(r?.amarillo ?? 0), cuenta(r?.codigo ?? 0)]); niveles.push(1)
    }
    if (base.length) {
      filas.push(["", "— datos de base y papeles —"]); niveles.push(1)
      for (const n of base) { filas.push(["", link(n)]); niveles.push(1) }
    }
  }
  plegar(filas, niveles, true)
  hoja(wb, NOMBRE, filas, [{ ancho: 40 }, { ancho: 44 }, { ancho: 22, z: MONEDA }, { ancho: 13 }, { ancho: 13 }, { ancho: 12 }])
  // la vista del índice: el [+] arriba de cada grupo y sin filas fijas
  const vs = vistasDe(wb)
  if (vs.length) VISTAS.set(wb, [...vs.slice(0, -1), { ...vs[vs.length - 1], resumenArriba: true, congelarFilas: undefined }])
  // 🗂️ JMS 09/11 (lo ordenó así en el v9): Índice → Retiros y aportes → Gastos Libertad → el set de MSA, MA y PAM
  reordenarSolapas(wb, [NOMBRE, "H · Retiros y aportes", "Gastos Libertad", "Inconsistencias"])
  for (const n of wb.SheetNames) {
    if (n === NOMBRE) continue
    const c = wb.Sheets[n]?.A1 as (XLSX.CellObject & { l?: unknown }) | undefined
    // JMS 09/11: «que lo tenga siempre a mano… son tantas solapas». La fila 1 queda fija arriba en todas: el link se ve si se nota.
    if (c) { c.l = { Target: `#'${NOMBRE}'!A1`, Tooltip: "Volver al índice" }; if (c.t === "s") { c.v = `⬅ Índice  ·  ${c.v}`; delete (c as { w?: string }).w } }
  }
}

/** ✍️ A-FEAT-1539: lo que va por la cuenta de un socio, al pie de «Por mes» (no es gasto, pero se ve). */
function lineaACuentaSocio(t: TemplatesDelEjercicio, resp: string): unknown[][] {
  const del = (t.aCuentaSocio ?? []).filter(c => responsablePrincipal(c.responsable) === resp)
  if (!del.length) return []
  return [[], ["VAN POR LA CUENTA DE UN SOCIO — no son gasto: suman en su cuenta corriente (libro B, solapa 14.1)"],
    ...del.map(c => ["", c.socio, c.categ, `${dmy(c.fecha)} · ${c.detalle || c.concepto}`, money(c.monto)])]
}

/**
 * 🚗 **Automotores, un renglón por vehículo** (A-FEAT-1539). Por el criterio contable todo es de la empresa del libro. Cada
 * vehículo con su impuesto, lo pagado en el ejercicio (cuándo, cuánto y por qué banco) y lo que no se pagó, marcado.
 */
export function hojaAutomotores(cuotas: CuotaTemplate[], resp: string, etiqueta: string): unknown[][] | null {
  const del = cuotas.filter(c => responsablePrincipal(c.responsable) === resp && /automotor/i.test(`${c.agrupadoraTemplate ?? ""} ${c.categ} ${c.concepto}`))
  if (!del.length) return null
  const vehiculo = (c: CuotaTemplate) => c.concepto.replace(/imp(uesto)?\.?\s*automotor(es)?/i, "").replace(/\b(cuota|anual)\b.*$/i, "").trim() || c.concepto
  const porVehiculo = new Map<string, CuotaTemplate[]>()
  for (const c of del) porVehiculo.set(vehiculo(c), [...(porVehiculo.get(vehiculo(c)) ?? []), c])
  const f: unknown[][] = [[`AUTOMOTORES — ${resp} — ejercicio ${etiqueta}`], []]
  f.push(["Vehículo", "Impuesto (organismo)", "Modalidad", "Pagado en el ejercicio", "Pagos (fecha · importe · banco)", "Sin pago en el ejercicio", "Estado"])
  const d = f.length + 1
  let total = 0
  for (const [v, cs] of [...porVehiculo].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    const pagas = cs.filter(c => !cuotaSinPago(c)).sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""))
    const sinPago = cs.filter(c => cuotaSinPago(c))
    const pagado = r2(pagas.reduce((s, c) => s + c.monto, 0))
    total = r2(total + pagado)
    const modal = [...new Set(pagas.map(c => (/anual/i.test(c.concepto) ? "anual" : "cuotas")))].join(" + ") || "—"
    f.push([v, [...new Set(cs.map(c => c.proveedor).filter(Boolean))].join(" / "), modal, money(pagado),
      pagas.map(c => `${dmy(c.fecha)} · ${fmtAr(c.monto)} · ${c.banco?.cuenta || "sin movimiento"}`).join("  |  "),
      sinPago.length ? `${sinPago.length} cuota(s): ${sinPago.map(c => `${dmy(c.fecha)} ${c.estado}${Math.abs(c.monto) < 0.005 ? " en $ 0" : " " + fmtAr(c.monto)}`).join(", ")}` : "",
      pagas.length ? (sinPago.length ? "pagado en parte" : "pagado") : "SIN PAGO EN EL EJERCICIO"])
  }
  const h = f.length
  f.push(["TOTAL", "", "", conFormula(`SUM(D${d}:D${h})`, total)])
  return f
}

const COLS_AUTOMOTORES: Columna[] = [{ ancho: 18 }, { ancho: 24 }, { ancho: 12 }, { ancho: 18, z: MONEDA }, { ancho: 80 }, { ancho: 50 }, { ancho: 26 }]

/** Lo que reemplaza a la palabra «template» en el libro H, en el orden en que se aplica (respeta mayúsculas). */
const SIN_TEMPLATE: Array<[RegExp, string]> = [
  [/TEMPLATES/g, "EGRESOS"], [/Templates/g, "Egresos"], [/templates/g, "egresos"],
  [/TEMPLATE/g, "CONCEPTO"], [/Template/g, "Concepto"], [/template/g, "concepto"],
]
const sinTemplate = (s: string) => SIN_TEMPLATE.reduce((x, [re, por]) => x.replace(re, por), s)

/**
 * 📗 A-FEAT-1539 — el libro H listo para mandar (JMS 04/11):
 * - *«no diga templates (tampoco en las solapas), no es una palabra contable»*: se cambia en los nombres de solapa, en el texto y
 *   en las fórmulas (los criterios de SUMAR.SI y las referencias a solapas cambian igual, así siguen cerrando);
 * - *«borrar subtítulos en todo el libro»*: los renglones de texto suelto entre el título y el primer renglón vacío se borran y la
 *   fila se oculta (borrar la fila correría las fórmulas que ya apuntan a sus filas).
 */
export function pulirLibroH(wb: XLSX.WorkBook): void {
  const esH = (n: string) => n.startsWith("H · ") || n === "Gastos Libertad"
  const renombre = new Map(wb.SheetNames.filter(esH).map(n => [n, sinTemplate(n)]))
  for (const [viejo, nuevo] of renombre) {
    if (viejo === nuevo) continue
    wb.Sheets[nuevo] = wb.Sheets[viejo]; delete wb.Sheets[viejo]
    wb.SheetNames[wb.SheetNames.indexOf(viejo)] = nuevo
  }
  for (const n of wb.SheetNames.filter(esH)) {
    const ws = wb.Sheets[n]
    for (const k of Object.keys(ws)) {
      if (k.startsWith("!")) continue
      const c = ws[k] as XLSX.CellObject & { f?: string }
      if (typeof c.f === "string") c.f = sinTemplate(c.f)
      if (typeof c.v === "string") { c.v = sinTemplate(c.v); if ((c as { w?: string }).w) (c as { w?: string }).w = c.v as string }
    }
    // Subtítulos: renglones 2.. con UNA sola celda de texto, hasta el primer renglón vacío, si el 1 es un título.
    const a1 = ws["A1"] as XLSX.CellObject | undefined
    if (!a1 || typeof a1.v !== "string" || ws["B1"]) continue
    const celdasDe = (r: number) => Object.keys(ws).filter(k => !k.startsWith("!") && XLSX.utils.decode_cell(k).r === r)
    const filas: XLSX.RowInfo[] = (ws["!rows"] ??= [])
    for (let r = 1; r < 30; r++) {
      const cs = celdasDe(r)
      if (cs.length !== 1 || cs[0] !== XLSX.utils.encode_cell({ r, c: 0 }) || typeof (ws[cs[0]] as XLSX.CellObject).v !== "string") break
      delete ws[cs[0]]
      filas[r] = { ...(filas[r] ?? {}), hidden: true }
    }
  }
}

/**
 * 📗 A-FEAT-1515 — al pie de «Por mes» del libro H: **del todo a las partes**. El total de esta solapa (sus renglones de
 * categoría, columna TOTAL) menos el total de cada solapa de agrupadora tiene que dar 0: una cuota perdida o contada dos
 * veces salta acá. Los valores van en la columna D (la P y la C de estos renglones quedan vacías: no entran en el SUMAR.SI).
 */
/** La línea del control de «Por mes» que apunta a la solapa de lo sin categoría (o dice que no se leyó el extracto). */
function lineaSinCategoria(ms: MovimientoExtractoH[], hojaSinCateg: string, leido: boolean): unknown[][] {
  if (!leido) return [[], ["", "⚠️ No se leyó el extracto: no se sabe qué movimientos quedaron sin categoría."]]
  if (!ms.length) return [[], ["", "✓ Ningún movimiento del extracto sin categoría ni vínculo."]]
  const neto = Math.round(ms.reduce((t, m) => t + (m.enDolares ? 0 : m.debitos - m.creditos), 0) * 100) / 100
  return [[], ["", `⚠️ Extracto SIN categoría ni vínculo: ${ms.length} movimiento(s), neto en pesos`, "", neto, `— no entran en ningún control de este libro: ver «${hojaSinCateg}»`]]
}

/**
 * 📑 Las notas de arriba de «Por mes» vienen PLEGADAS (JMS 02/11: «agrupo estas porque me ocupan mucho lugar de tabla»):
 * del renglón 2 hasta el anterior al encabezado «Responsable». Se despliegan con el [+] de Excel.
 */
export function plegarNotasPorMes(filas: unknown[][]): void {
  const enc = filas.findIndex(r => Array.isArray(r) && r[0] === "Responsable")
  if (enc <= 1) return
  plegar(filas, filas.map((_, i) => (i >= 1 && i < enc ? 1 : 0)), true)
}

function controlSolapasH(t: TemplatesDelEjercicio, grupos: { g: GrupoTemplates; nombre: string; celdaTotal: string | null }[], filasAntes: number): unknown[][] {
  const total = Math.round((t.totalDebitos - t.totalCreditos) * 100) / 100
  const colTotal = String.fromCharCode(68 + t.columnas.length)
  const f: unknown[][] = [[], ["CONTROL DEL LIBRO H — esta solapa contra las solapas de agrupadora (del todo a las partes)"]]
  const rTotal = filasAntes + f.length + 1
  f.push(["", "Total de esta solapa (renglones de categoría)", "", { t: "n", f: `SUMIFS(${colTotal}:${colTotal},C:C,"<>")`, v: total }])
  for (const x of grupos) {
    f.push(["", `  − ${x.g.agrupadora}  («${x.nombre}»)`, "", x.celdaTotal
      ? { t: "n", f: `'${x.nombre.replace(/'/g, "''")}'!${x.celdaTotal}`, v: x.g.total }
      : x.g.total])
  }
  const rUlt = filasAntes + f.length
  const dif = Math.round((total - grupos.reduce((a, x) => a + x.g.total, 0)) * 100) / 100
  const fDif = rUlt > rTotal ? `D${rTotal}-SUM(D${rTotal + 1}:D${rUlt})` : `D${rTotal}`
  f.push(["", "= Diferencia (tiene que dar 0)", "", { t: "n", f: fDif, v: dif },
    { t: "s", f: `IF(ABS(D${rUlt + 1})<0.005,"✓ cierra","🛑 NO CIERRA: una cuota quedó afuera o contada dos veces")`, v: Math.abs(dif) < 0.005 ? "✓ cierra" : "🛑 NO CIERRA: una cuota quedó afuera o contada dos veces" }])
  return f
}

/** 📒 A-FEAT-1509 — las hojas del LIBRO F: el balance en línea y una de detalle por renglón de la tanda de Claude. */
export function agregarLibroF(wb: XLSX.WorkBook, e: EntradaBalanceEnLinea): void {
  hoja(wb, "F · Balance en linea", hojaBalanceEnLinea(filasBalanceEnLinea(e), e.fechaCierre), COLS_BEL)
  hoja(wb, "F · Caja y bancos", hojaCajaYBancos(e), COLS_DET_F)
  hoja(wb, "F · FCI", hojaFci(e), COLS_DET_F)
  hoja(wb, "F · Deudas y creditos", hojaDeudasYCreditos(e), COLS_DET_F)
  hoja(wb, "F · Soja", hojaSoja(e), COLS_DET_F)
  hoja(wb, "F · Vacas de cria", hojaVacasDeCria(e), COLS_DET_F)
}
const COLS_BEL: Columna[] = [
  { ancho: 16 }, { ancho: 13 }, { ancho: 44 }, { ancho: 18, z: MONEDA }, { ancho: 18, z: MONEDA }, { ancho: 16, z: MONEDA },
  { ancho: 12 }, { ancho: 34 }, { ancho: 52 }, { ancho: 22 }, { ancho: 60 },
]
const COLS_DET_F: Columna[] = [
  { ancho: 34 }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 17, z: MONEDA }, { ancho: 18, z: MONEDA },
  { ancho: 18, z: MONEDA }, { ancho: 18, z: MONEDA }, { ancho: 16, z: MONEDA }, { ancho: 70 },
]

/** Descarga el archivo en el navegador. */
export async function descargarLibroDiario(
  libro: LibroDiario, empresa: string,
  templates?: TemplatesDelEjercicio,
  hacienda?: {
    valuacion: ValuacionHacienda; mag: PrecioMag[]
    mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
    porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
    mesPrecios: string
    /** El cuadre de la existencia. Va arriba de la valuación — ver `hojaDeHacienda`. */
    cuadre?: CuadreHacienda
    /** 🐄🌾 A-FEAT-1386: las tablas de saldos Sistema · SENASA · Campo · Balance. */
    saldos?: SaldosParaExcel
    /** 📦 A-FEAT-1420: el stock declarado al inicio por producto y las pasturas. */
    stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }
    /** 📅 A-FEAT-1422: de dónde salió cada precio (fecha y link para el contador). */
    fuentesPrecios?: FuentePrecio[]
    /** 🐄 A-FEAT-1541: el papel nuevo — movimientos, valorizado del inicio, tablas de precios, TC y saldos escritos. */
    movimientosPapel?: MovimientoPapel[]
    valuacionInicio?: ValuacionHacienda | null
    tablasInicio?: TablasPreciosPapel | null
    tablasCierre?: TablasPreciosPapel | null
    tcCierre?: number | null
    saldosGuardados?: Record<string, string | undefined>
    /** ⚖️ A-FEAT-1541: los kilos por categoría con el detalle animal por animal. */
    pesos?: PesoCategoria[]
  },
  insumos?: StockInsumos,
  campo?: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras; origenPrecioGranos?: { texto: string; url: string | null } | null },
  cuentas?: Parameters<typeof armarWorkbook>[6],
  bancarios?: Parameters<typeof armarWorkbook>[7],
  sueldos?: Parameters<typeof armarWorkbook>[8],
  cuentasCorrientes?: Parameters<typeof armarWorkbook>[9],
  pendientes?: PendienteBalance[],
  saldosAnteriores?: SaldosAnteriores,
  asientosContables?: AsientoLibroDiario[],
  lecturas?: Lectura[],
  controlCuotas?: ControlCuotasTemplates,
  controlesInicio?: ControlesInicio,
  recorrido?: RecorridoParaExcel | null,
) {
  const wb = armarWorkbook(libro, empresa, templates, hacienda, insumos, campo, cuentas,
    bancarios, sueldos, cuentasCorrientes, pendientes, saldosAnteriores, asientosContables, lecturas, controlCuotas, controlesInicio, recorrido)
  fechasReales(wb) // 📅 fechas como fecha: el filtro agrupa por año y mes (lib/excel/fechas-reales.ts)
  const out = await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb))
  const url = URL.createObjectURL(
    new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  )
  const a = document.createElement("a")
  a.href = url
  a.download = nombreArchivo(libro, empresa)
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, ESPERA_ANTES_DE_LIBERAR_MS)
}
