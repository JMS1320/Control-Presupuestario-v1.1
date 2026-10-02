/**
 * 🧪 Casos de prueba — NIVEL 1: lógica pura, **cero escritura**. A-FEAT-105.
 *
 * ## La regla que no se negocia
 * 🔴 **Nada de acá toca la base.** No hay entorno de prueba: local, preview y producción comparten
 * el mismo Supabase, y un test que escribe escribe en los datos del usuario. Ya pasó —un test
 * inventó $5.443.200 sobre un movimiento real **y reportó OK**—. Un test que no escribe **no puede
 * dejar basura**, y eso es más fuerte que cualquier limpieza posterior.
 *
 * Cómo probar el camino de escritura está sin resolver → `A-DEC-18` (base descartable, no Liquibase).
 *
 * ## Por qué esto alcanza para lo que duele
 * Los **cuatro** bugs del 2026-09-06 fueron de lógica pura y **ninguno necesitaba escribir una fila**:
 * el factor por tipo (6.501 kg), las 9 cabezas en vez de 10, el denominador mezclado y el match por
 * dientes. Los cuatro están acá abajo como caso.
 *
 * ## Y por qué corre en el navegador y no en Node
 * El parser del romaneo se verificó en Node —9 líneas, $18.750.900, perfecto— y en el navegador del
 * usuario devolvió **cero**. Un test que corre donde el usuario no está prueba otra cosa.
 *
 * ## ⚠️ Lo que estos casos NO cubren, y por qué
 * `A-BUG-115` —guardó 9 cabezas en vez de 10— vivía en **`parsearRomaneo`**, no en las funciones de
 * acá: `cabezasDeMedias` siempre estuvo bien. Probar el parser necesita el PDF, así que ese camino
 * queda para el nivel 2 (subir el archivo desde la pantalla).
 *
 * 📌 **Se dice explícitamente porque un caso que pasa igual antes y después del arreglo no prueba
 * nada** — y encima aparenta cobertura, que es peor que no tenerla. Ya pasó en este proyecto: un
 * control que se verificaba sobre una cadena vacía daba OK siempre.
 *
 * ## Los datos son CONSTANTES de este archivo
 * Los pesos y kilos de abajo son los reales de la carga del 03/09, **escritos acá**. No se leen de
 * la base: así el caso no cambia de resultado porque alguien editó un registro, que es como un test
 * empieza a mentir.
 */

import {
  adjudicarPorPeso, cabezasDeMedias, rindePorGrupo, factorDeCarga,
  type CabezaNuestra, type CabezaRomaneo,
} from "@/lib/ganaderia/adjudicar-romaneo"
import { simularSecuencia, retencionDelGrupo, calcularRetencion } from "@/lib/sicore/minimo"
import { quincenasDelMes, mismoPeriodoDelMinimo } from "@/lib/sicore/quincena"
import { deduplicarFilasSicore } from "@/lib/sicore/dedup"
import { parsePendientes, esDelProceso } from "@/lib/pendientes/parse"
import { calcularCuenta, etiquetaComprobante } from "@/lib/pagos/cuenta-detalle-pago"
import { agruparPagosPorEmpleado } from "@/lib/sueldos/agrupar-pagos"
import { hayQuePreguntarFechaPago } from "@/lib/pagos/preguntar-fecha-pago"
import { etiquetaMonto } from "@/lib/conciliacion/etiqueta-monto"
import { armarCuentaCorriente, leyendaSaldo } from "@/lib/proveedores/cuenta-corriente"
import {
  identificadorDeCuota, detalleCompleto, esElIdentificadorGenerado,
} from "@/lib/templates/identificador-cuota"
import {
  planificarEdicion, evaluarAvisos, diasEntre, coincide,
  type CuotaExistente, type MovimientoBancario as MovBancario,
} from "@/lib/templates/editar-campana"
import { planificarContrapartes } from "@/lib/contrapartes/registrar"
import { montoCorto, repartoDelGrupo } from "@/lib/pagos/reparto-grupo"
import { corregir, agruparCorrecciones } from "@/lib/conciliacion/correcciones"
import { matchPorImporteExacto } from "@/lib/conciliacion/match-por-importe"
import { pareceDetalleAutogenerado } from "@/lib/conciliacion/columnas-extracto"
import {
  detectarProveedoresConNC, esNotaCredito, abreviaturaComprobante,
  type ComprobanteParaNC,
} from "@/lib/pagos/notas-credito"
import {
  armarLibroPorCuenta, SIN_IMPUTAR, TIPOS_SIN_CREDITO_VENTAS,
} from "@/lib/balance/libro-por-cuenta"
import { armarCuentasAlCierre, type ComprobanteConPago } from "@/lib/balance/cuentas-al-cierre"
import {
  armarChequesDados, armarAnticiposAlCierre,
  type ChequeCrudo, type AnticipoCrudo, type AplicacionDeAnticipo,
} from "@/lib/balance/valores-al-cierre"
import {
  armarCadenaDeSaldos, saldoAlInicioDe, ultimoMovimiento, primerMovimiento,
} from "@/lib/balance/saldos-al-inicio"
import { hoyArgentina, mesArgentina, diaArgentino, ahoraISO } from "@/lib/fechas"
import {
  decidirPropagacion, esCategProvisoria, avisoDePropagacion,
} from "@/lib/conciliacion/propagar-cuenta"
import {
  repartirTotalEnAB, valorFrancoDeTotal, componerA, abrirA, aplicarCuotaManteniendoA,
} from "@/lib/sueldos/reparto-ab"
import {
  saldosDelPeriodo, controlarReparto, montoParaSaldo, estadoPorDefectoDe,
  type RenglonPago,
} from "@/lib/sueldos/pago-repartido"
import { hojaDePagos, nombreArchivoPagos } from "@/lib/sueldos/export-pagos"
import {
  leerIpc, controlarIpc, acumuladaDelAnio, urlIpc, mesAnteriorISO,
} from "@/lib/indices/ipc-indec"
import {
  armarSueldosDelEjercicio, brutoDesdePartes, type PeriodoDeSueldo,
} from "@/lib/balance/sueldos-balance"
import {
  armarCuentasCorrientes, normalizar, CONTRAPARTES_DEL_BALANCE,
} from "@/lib/balance/cuentas-corrientes"
import { cuadrarHacienda, type MovimientoDeHacienda } from "@/lib/balance/cuadre-hacienda"
import {
  leerBnaDivisas, leerPizarraBcr, numeroConComa, numeroConPunto, fechaArgentina,
  promedioDelMes, urlPizarra, leerHistoricoDolar, leerCotizacionesBcra,
  cruzarDolarConBcra,
} from "@/lib/cotizaciones/parsers"
import { primerDiaDelEjercicio } from "@/lib/balance/ejercicio"
import {
  normalizarCuenta, buscarCuenta, mesesDelEjercicio, armarGastosBancarios,
  armarFondosComunes, armarRetirosYAportes,
} from "@/lib/balance/papeles-bancarios"
import {
  mismoCertificado, agruparEnCertificados, certificadosConVariosPagos, clavePago,
} from "@/lib/sicore/clave-certificado"
import { estadoArchivoDigital } from "@/lib/facturas/archivo-digital"
import { armarEjercicio, claveSubdiario, esDelEjercicio, esProvision, subdiariosVacios } from "@/lib/balance/ejercicio"
import { armarTemplatesDelEjercicio } from "@/lib/balance/templates-libro"
import { valuarHacienda } from "@/lib/balance/hacienda-stock"
import { pesosAlCierre, pesoParaValuar } from "@/lib/balance/pesos-hacienda"
import { armarStockInsumos, PAPELES_SIN_ORIGEN, type LineaInsumo } from "@/lib/balance/stock-insumos"
import {
  cuadrarGranos, valuarGranos, armarSementeras, type OrdenAgricola,
} from "@/lib/balance/granos-sementeras"
import {
  armarLibroDiario, detectarChoques, detectarSubdiariosDuplicados, tipoDesdeTexto,
  type AsientoLibroDiario,
} from "@/lib/balance/libro-diario"
import { mesCompleto, mesActual, mesAnterior } from "@/lib/format/rango-fechas"
import { cobroEsperado, diferenciaContraElBanco } from "@/lib/ventas/cobro-esperado"
import { toggleChip, esSoloEste } from "@/lib/ui/chips"
import { kgNetosDeVenta, promedioKg, categoriaDeVenta, calcularLiqHacienda, retencionSugerida,
  compararConVenta, controlContraPapel, controlPlazos, plazosDesdeVenta, precargaDesdeVenta, cuotasPorCobrar, huellaLiquidacion,
  kgQueSeCobran, ventaParaComparar, marcarCuota, armarVentaHistorica, repartirEnCuotas, controlCuotas, conciliarCuota } from "@/lib/ventas/hacienda"
import { parseNumeroAR } from "@/lib/format/numero"
import { armarDetalleCobro, imputacionesDeCobro } from "@/lib/ventas/detalle-cobro"
import { filasRetenciones } from "@/lib/ventas/retenciones-export"
import { detalleSinAnticipo } from "@/lib/ventas/detalle-cobro-db"
import { estadoCheque, chequePendienteDeEndoso, candidatosEndoso } from "@/lib/ventas/cheques-terceros"
import { filasExtractoEcheqs } from "@/lib/ventas/extracto-echeqs"
import { filtroDeSentidoYMonto, pasaSentido } from "@/lib/movimientos/sentido"
import {
  copiarEsquemaCuotas, anioInicioCampania, correrAnios, validarCuotas, planificarCuotas, filaDesdeGuardada,
  partirCuota, DECIMALES_QQ, camposDeVenta, tonsMaximasEdicion, campaniaSiguiente,
  type CuotaGuardada, type FilaCuota,
} from "@/lib/arrendamientos/cuotas"
import {
  queProbarVos, tituloCorto, textoRespuesta, RESPUESTAS_TEST,
} from "@/lib/pendientes/resumen-test"
import { partirPorRol } from "@/lib/contrapartes/orden-por-rol"
import {
  armarCandidatos, dondeSeCargaElCuit,
  type VentaEsperando, type FacturaVenta, type Vinculo,
} from "@/lib/ventas/candidatos-factura"
import { heredarDelOrigen, proveedorDelTemplate, cuitsDiscrepan } from "@/lib/conciliacion/datos-del-origen"
import { parsearMovimiento, proponerMapeo, splitMovimiento, auditarSubtipo, resolverFilaExistente, contenidoDeCampo, grupoParaGuardar, grupoSugeridoParaTipo, GRUPOS_GALICIA, claveDedupMovimiento } from "@/lib/extractos/parseo-movimiento"
import {
  lineasDelDetalle, controlarDetalle, sinElProveedor,
} from "@/lib/pagos/lineas-detalle-pago"
import {
  auditar, origenDe, destinoDelDetalle, vinculoDobleEsLegitimo, comprobanteIdentifica,
  type MovimientoAuditable as MovAuditable, type EntidadOrigen,
} from "@/lib/conciliacion/auditoria"

export interface Resultado {
  caso: string
  grupo: string
  ok: boolean
  esperado: string
  obtenido: string
  /** Qué bug cubre, para saber qué se rompió si vuelve a fallar. */
  cubre?: string
}

// ── Los datos reales de la carga del 03/09 (constantes, no salen de la BD) ────────────────────
const VACAS: CabezaNuestra[] = [766, 562, 540, 522, 502, 478, 270]
  .map((p, i) => ({ id: `v${i}`, caravana: `V${i}`, razon: null, peso_kg: p }))
const TOROS: CabezaNuestra[] = [1035, 870, 756]
  .map((p, i) => ({ id: `t${i}`, caravana: `T${i}`, razon: null, peso_kg: p }))
const NETO_CAMION = 6500

/** Las medias reses tal como las lee el PDF: **2 por garrón**, con dos incompletas a propósito. */
const MEDIAS = [
  ["507", "VA", "D", 1, 125], ["507", "VA", "D", 1, 123],
  ["508", "VA", "D", 0, 129], ["508", "VA", "D", 0, 132],
  ["509", "VA", "B", 2, 117],                                  // ← al PDF le falta la otra media
  ["510", "VA", "C", 0, 114], ["510", "VA", "C", 0, 115],
  ["511", "VA", "C", 0, 127], ["511", "VA", "C", 0, 130],
  ["512", "VA", "C", 2, 185],                                  // ← idem
  ["513", "VA", "E", 0, 73], ["513", "VA", "E", 0, 73],
  ["514", "TO", "B", 0, 277], ["514", "TO", "B", 0, 268],
  ["515", "TO", "A", 0, 314], ["515", "TO", "A", 0, 310],
  ["516", "TO", "B", 1, 219], ["516", "TO", "B", 1, 218],
].map(([garron, tipo, clase, dientes, peso]) => ({
  garron: garron as string, tipo: tipo as string, clase: clase as string,
  dientes: dientes as number, contenido: "MCV/MCV", peso_kg: peso as number,
  precio_kg: null as number | null, orden: 0,
}))

/** Los mismos garrones **con las dos medias corregidas a mano**, que es como debe quedar. */
const CABEZAS_OK: CabezaRomaneo[] = cabezasDeMedias(MEDIAS).map(c =>
  c.garron === "509" ? { ...c, kg_gancho: 234, medias: 2 }
    : c.garron === "512" ? { ...c, kg_gancho: 373, medias: 2 }
      : c)

const n = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const cerca = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol
/** Plata: siempre con 2 decimales, es-AR. */
const n2 = (v: number) => v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (v: number) => Math.round(v * 100) / 100

export function correrCasos(): Resultado[] {
  const r: Resultado[] = []
  const chequear = (grupo: string, caso: string, esperado: string, obtenido: string, ok: boolean, cubre?: string) =>
    r.push({ grupo, caso, esperado, obtenido, ok, cubre })

  // ══ El factor de la balanza ═══════════════════════════════════════════════════════════════
  const todas = [...VACAS, ...TOROS]
  const f = factorDeCarga(todas, NETO_CAMION)
  chequear("Balanza", "El factor sale de TODA la carga, no de cada tipo",
    "×1,0316", `×${f.toFixed(4)}`, cerca(f, 6500 / 6301, 0.0001), "A-BUG-114")

  const sumaAjustada = todas.reduce((s, c) => s + c.peso_kg * f, 0)
  chequear("Balanza", "Ajustado, el total da el neto del camión UNA vez",
    `${n(NETO_CAMION)} kg`, `${n(Math.round(sumaAjustada))} kg`,
    cerca(sumaAjustada, NETO_CAMION, 1), "A-BUG-114")

  // El caso que rompía: escalar por tipo daba el camión entero en CADA grupo.
  const fSoloToros = factorDeCarga(TOROS, NETO_CAMION)
  const torosMal = TOROS.reduce((s, c) => s + c.peso_kg * fSoloToros, 0)
  chequear("Balanza", "Escalar sólo un tipo da el camión entero (por eso NO se hace)",
    `${n(NETO_CAMION)} kg — y por eso el factor es global`, `${n(Math.round(torosMal))} kg`,
    cerca(torosMal, NETO_CAMION, 1), "A-BUG-114")

  // ══ Las cabezas ═══════════════════════════════════════════════════════════════════════════
  const cabezas = cabezasDeMedias(MEDIAS)
  chequear("Cabezas", "18 medias reses son 10 cabezas, no 18",
    "10 cabezas", `${cabezas.length} cabezas`, cabezas.length === 10)

  const incompletos = cabezas.filter(c => c.medias !== 2).map(c => c.garron)
  chequear("Cabezas", "Detecta los garrones con una sola media res",
    "509, 512", incompletos.join(", ") || "(ninguno)",
    incompletos.length === 2 && incompletos.includes("509") && incompletos.includes("512"), "A-BUG-116")

  // ══ La adjudicación por peso ══════════════════════════════════════════════════════════════
  const vacasRom = CABEZAS_OK.filter(c => c.tipo === "VA")
  const { pares } = adjudicarPorPeso(VACAS, vacasRom, f)
  const apareo = pares.filter(p => p.nuestra && p.romaneo)
    .map(p => `${p.nuestra!.peso_kg}→${p.romaneo!.kg_gancho}`).join(" ")
  chequear("Adjudicación", "Al más pesado nuestro, la res más pesada",
    "766→373 562→261 540→257 522→248 502→234 478→229 270→146", apareo,
    apareo === "766→373 562→261 540→257 522→248 502→234 478→229 270→146", "A-FEAT-97")

  const rindes = pares.filter(p => p.rinde != null).map(p => p.rinde!)
  chequear("Adjudicación", "El rinde VARÍA entre animales (si no, el cálculo es circular)",
    "distintos entre sí", `${Math.min(...rindes).toFixed(2)} % a ${Math.max(...rindes).toFixed(2)} %`,
    Math.max(...rindes) - Math.min(...rindes) > 1, "A-FEAT-96")

  // ══ El rinde por grupo de precio ══════════════════════════════════════════════════════════
  // Precio por (tipo, clase, dientes) tal como lo liquidó el frigorífico.
  const PRECIO: Record<string, number> = {
    "VA|D|1": 5800, "VA|D|0": 5500, "VA|B|2": 6600, "VA|C|0": 5800,
    "VA|C|2": 6600, "VA|E|0": 4800, "TO|B|0": 5200, "TO|A|0": 5200, "TO|B|1": 5200,
  }
  const conPrecio = CABEZAS_OK.map(c => ({ ...c, precio_kg: PRECIO[`${c.tipo}|${c.clase}|${c.dientes}`] ?? null }))
  const todosLosPares = [
    ...adjudicarPorPeso(VACAS, conPrecio.filter(c => c.tipo === "VA"), f).pares,
    ...adjudicarPorPeso(TOROS, conPrecio.filter(c => c.tipo === "TO"), f).pares,
  ]
  const grupos = rindePorGrupo(todosLosPares)

  chequear("Grupos", "Un grupo por precio dentro de cada tipo",
    "5 grupos", `${grupos.length} grupos`, grupos.length === 5, "A-FEAT-96")

  const vivoTotal = grupos.reduce((s, g) => s + g.kg_vivo, 0)
  chequear("Grupos", "La suma de los grupos es el camión — la carga NO entra dos veces",
    `${n(NETO_CAMION)} kg`, `${n(Math.round(vivoTotal))} kg`,
    cerca(vivoTotal, NETO_CAMION, 2), "A-BUG-114")

  const ganchoTotal = grupos.reduce((s, g) => s + g.kg_gancho, 0)
  chequear("Grupos", "Los kilos de carne suman el gancho del romaneo",
    "3.354 kg", `${n(ganchoTotal)} kg`, cerca(ganchoTotal, 3354, 1))

  const importe = grupos.reduce((s, g) => s + g.importe, 0)
  chequear("Grupos", "El importe total es el que liquidó el frigorífico",
    "$18.750.900", `$${n(importe)}`, cerca(importe, 18750900, 1))

  const toros = grupos.find(g => g.tipo === "TO")
  chequear("Grupos", "Los toros rinden mucho más que las vacas",
    "≈58,5 %", toros?.rinde != null ? `${toros.rinde.toFixed(2)} %` : "—",
    toros?.rinde != null && cerca(toros.rinde, 58.5, 0.6), "A-FEAT-96")

  const rindesGrupo = grupos.map(g => g.rinde ?? 0)
  chequear("Grupos", "El rinde por grupo VARÍA (con el vivo del papel daría 53,58 % en todos)",
    "distintos entre sí", `${Math.min(...rindesGrupo).toFixed(2)} % a ${Math.max(...rindesGrupo).toFixed(2)} %`,
    Math.max(...rindesGrupo) - Math.min(...rindesGrupo) > 5, "A-FEAT-96")

  const sinVivo = grupos.filter(g => !g.kg_vivo).length
  chequear("Grupos", "Ningún grupo se queda sin kilaje vivo",
    "0 grupos", `${sinVivo} grupos`, sinVivo === 0, "A-BUG-116")

  // ══ El desbaste por hora ══════════════════════════════════════════════════════════════════
  const horas = (new Date("2026-09-04T09:00:00-03:00").getTime()
    - new Date("2026-09-03T12:00:00-03:00").getTime()) / 3600000
  chequear("Desbaste", "De las 12:00 al mediodía a las 09:00 del día siguiente",
    "21 horas", `${horas} horas`, horas === 21, "A-FEAT-100")

  const pctCamion = ((NETO_CAMION - 6260) / NETO_CAMION) * 100
  chequear("Desbaste", "Contra el camión da un desbaste normal (0,15–0,20 %/h)",
    "≈0,176 %/h", `${(pctCamion / horas).toFixed(3)} %/h`,
    cerca(pctCamion / horas, 0.176, 0.005), "A-FEAT-100")

  // ══ SICORE: el mínimo se consume UNA vez por proveedor, no una por factura ════════════════
  // Los tres netos son los reales de ALCORTA EDMUNDO del 10/09/2026 (FC 6337, 6328 y 6347),
  // escritos acá como constantes: si mañana alguien edita esas filas, el caso no cambia.
  const ALCORTA = [148202.62, 95916.33, 74140.48]
  const MIN_BIENES = 224000      // tipos_sicore_config → Bienes
  const ALIC_BIENES = 0.02

  const pasos = simularSecuencia(ALCORTA, MIN_BIENES, ALIC_BIENES)
  const totalRetenido = r2(pasos.reduce((s, p) => s + p.retencion, 0))

  // 🔴 EL CASO DEL BUG: ninguna de las tres llega sola al mínimo, y sumadas sí.
  chequear("SICORE", "Tres facturas bajo el mínimo que SUMADAS lo superan sí retienen",
    "$1.885,19", `$${n2(totalRetenido)}`, cerca(totalRetenido, 1885.19, 0.01), "A-BUG-137")

  chequear("SICORE", "Ninguna de las tres llega sola al mínimo de Bienes",
    "las 3 por debajo de $224.000", `máx $${n2(Math.max(...ALCORTA))}`,
    Math.max(...ALCORTA) < MIN_BIENES, "A-BUG-137")

  // El control del camino inverso (§ CLAUDE.md): de atrás para adelante tiene que dar lo mismo.
  const deUnaVez = retencionDelGrupo(ALCORTA, MIN_BIENES, ALIC_BIENES)
  chequear("SICORE", "Factura por factura da lo mismo que (total − mínimo) × alícuota",
    `$${n2(deUnaVez)}`, `$${n2(totalRetenido)}`, cerca(totalRetenido, deUnaVez, 0.01), "A-BUG-137")

  // El mínimo es UNO por proveedor y régimen: si se aplicara por factura, se consumiría 3 veces.
  const minimoConsumido = r2(pasos.reduce((s, p) => s + p.minimoAplicado, 0))
  chequear("SICORE", "El mínimo se consume una sola vez entre las tres",
    `$${n2(MIN_BIENES)}`, `$${n2(minimoConsumido)}`, cerca(minimoConsumido, MIN_BIENES, 0.01), "A-BUG-137")

  // La primera no retiene pero NO es el final: si el circuito se corta ahí, se retienen $0.
  chequear("SICORE", "La primera no retiene, y las dos siguientes sí",
    "no · sí · sí", pasos.map(p => p.retiene ? "sí" : "no").join(" · "),
    !pasos[0].retiene && pasos[1].retiene && pasos[2].retiene, "A-BUG-137")

  // El orden no puede cambiar el total: era un objetivo declarado del acumulado.
  const alReves = r2(simularSecuencia([...ALCORTA].reverse(), MIN_BIENES, ALIC_BIENES)
    .reduce((s, p) => s + p.retencion, 0))
  chequear("SICORE", "Al revés da lo mismo — el orden no cambia lo que se retiene",
    `$${n2(totalRetenido)}`, `$${n2(alReves)}`, cerca(alReves, totalRetenido, 0.01), "A-BUG-137")

  // Y que siga siendo cierto lo de siempre: una sola factura bajo el mínimo NO retiene.
  const solaChica = simularSecuencia([95916.33], MIN_BIENES, ALIC_BIENES)
  chequear("SICORE", "Una sola factura bajo el mínimo sigue sin retener",
    "$0,00", `$${n2(solaChica[0].retencion)}`, solaChica[0].retencion === 0, "A-BUG-137")

  // El descuento pronto pago baja el neto pagado → consume MENOS mínimo → la siguiente retiene menos.
  // Con un descuento de $8.202,62 neto sobre la primera, consume 140.000 en vez de 148.202,62.
  const conDescuento = calcularRetencion({
    neto: 95916.33, minimoRegimen: MIN_BIENES, netoPrevio: 140000, yaRetuvo: false, alicuota: ALIC_BIENES,
  })
  chequear("SICORE", "El descuento de la primera baja lo consumido, y la 2ª retiene MENOS",
    "$238,33", `$${n2(conDescuento.retencion)}`,
    cerca(conDescuento.retencion, (95916.33 - (MIN_BIENES - 140000)) * ALIC_BIENES, 0.01), "A-BUG-139")

  chequear("SICORE", "…y sin descontarlo retendría de más",
    "menos que $402,38", `$${n2(conDescuento.retencion)}`,
    conDescuento.retencion < 402.38, "A-BUG-139")

  // Servicios tiene otro mínimo: la MISMA factura que no retiene por bienes, retiene por servicios.
  const porServicios = simularSecuencia([95916.33], 67170, 0.02)
  chequear("SICORE", "La misma factura por Servicios sí retiene (otro mínimo)",
    "$574,93", `$${n2(porServicios[0].retencion)}`,
    cerca(porServicios[0].retencion, (95916.33 - 67170) * 0.02, 0.01), "A-BUG-137")

  // ══ A-BUG-193: el período del mínimo es el MES, no la quincena ════════════════════════════
  //
  // La RG 830 fija el mínimo **por mes calendario y por sujeto retenido**. El sistema lo reiniciaba
  // cada quincena, así que un proveedor con pagos en las dos quincenas del mismo mes recibía el
  // mínimo DOS veces y se le retenía de menos.
  //
  // Los números son los REALES de MASSAGLIA ALDO ENRIQUE, julio 2026 (Servicios, 2 %): FC 2-481 el
  // 03/07 y un anticipo el 30/07, los dos con neto $1.708.680,00 y los dos con mínimo aplicado.
  const MIN_SERV = 67170
  const ALIC_SERV = 0.02
  const MASSA_NETO = 1708680.00

  chequear("SICORE", "Las dos quincenas de un mes son el MISMO período del mínimo",
    "sí", mismoPeriodoDelMinimo("2026-07-30", "26-07 - 1ra") ? "sí" : "no",
    mismoPeriodoDelMinimo("2026-07-30", "26-07 - 1ra"), "A-BUG-193")

  chequear("SICORE", "El mes siguiente NO comparte el mínimo",
    "no", mismoPeriodoDelMinimo("2026-08-03", "26-07 - 2da") ? "sí" : "no",
    !mismoPeriodoDelMinimo("2026-08-03", "26-07 - 2da"), "A-BUG-193")

  chequear("SICORE", "Del período salen sus dos quincenas, sea cual sea la de entrada",
    "26-07 - 1ra · 26-07 - 2da", quincenasDelMes("26-07 - 2da").join(" · "),
    quincenasDelMes("26-07 - 2da").join(" · ") === "26-07 - 1ra · 26-07 - 2da", "A-BUG-193")

  // 🔴 EL CASO DEL BUG, con los números de MASSAGLIA: el 2º pago del mes no lleva mínimo.
  const massaPrimero = calcularRetencion({
    neto: MASSA_NETO, minimoRegimen: MIN_SERV, netoPrevio: 0, yaRetuvo: false, alicuota: ALIC_SERV,
  })
  const massaSegundo = calcularRetencion({
    neto: MASSA_NETO, minimoRegimen: MIN_SERV, netoPrevio: 0, yaRetuvo: true, alicuota: ALIC_SERV,
  })
  chequear("SICORE", "El 1er pago del mes consume el mínimo entero",
    `$${n2(MIN_SERV)}`, `$${n2(massaPrimero.minimoAplicado)}`,
    cerca(massaPrimero.minimoAplicado, MIN_SERV, 0.01), "A-BUG-193")

  chequear("SICORE", "El 2º pago del MISMO mes ya no recibe mínimo",
    "$0,00", `$${n2(massaSegundo.minimoAplicado)}`,
    massaSegundo.minimoAplicado === 0, "A-BUG-193")

  // Lo que se retenía de menos: 2 % del mínimo regalado por segunda vez.
  const deMenos = r2(massaSegundo.retencion - massaPrimero.retencion)
  chequear("SICORE", "Dar el mínimo dos veces cuesta exactamente alícuota × mínimo",
    `$${n2(MIN_SERV * ALIC_SERV)}`, `$${n2(deMenos)}`,
    cerca(deMenos, MIN_SERV * ALIC_SERV, 0.01), "A-BUG-193")

  chequear("SICORE", "Massaglia julio: el mes cierra en $67.003,80, no en $65.660,40",
    "$67.003,80", `$${n2(r2(massaPrimero.retencion + massaSegundo.retencion))}`,
    cerca(massaPrimero.retencion + massaSegundo.retencion, 67003.80, 0.01), "A-BUG-193")

  // ══ PARSEO: dos reglas al mismo destino dejan la columna VACÍA ════════════════════════════
  //
  // Pedido del usuario 2026-09-24. Antes ganaba la última en silencio y quedaba un dato creíble
  // en la columna equivocada — el peor desenlace, porque nadie lo revisa.
  const CRUDO_CHOQUE = ["TRANSFERENCIA A TERCEROS", "JUAN PEREZ", "30712345678", "VARIOS"].join(String.fromCharCode(10))
  const REGLAS_CHOQUE = {
    "TRANSFERENCIA A TERCEROS": [
      { campo_destino: "leyendas_adicionales_1", tipo_regla: "linea", numero_linea: 2, grupo_de_conceptos: "G", firma_forma: null },
      { campo_destino: "leyendas_adicionales_1", tipo_regla: "linea", numero_linea: 4, grupo_de_conceptos: "G", firma_forma: null },
    ],
  } as never

  const choque = parsearMovimiento(CRUDO_CHOQUE, REGLAS_CHOQUE)
  chequear("Parseo", "Con reglas en conflicto el movimiento NO se parsea y queda señalado",
    "Reglas en conflicto", choque["grupo_de_conceptos"] ?? "(nada)",
    choque["grupo_de_conceptos"] === "Reglas en conflicto"
      && choque["leyendas_adicionales_1"] === undefined, "A-FEAT-1174")

  const SIN_CHOQUE = {
    "TRANSFERENCIA A TERCEROS": [
      { campo_destino: "leyendas_adicionales_1", tipo_regla: "linea", numero_linea: 2, grupo_de_conceptos: "G", firma_forma: null },
      { campo_destino: "leyendas_adicionales_3", tipo_regla: "linea", numero_linea: 4, grupo_de_conceptos: "G", firma_forma: null },
    ],
  } as never
  const ok = parsearMovimiento(CRUDO_CHOQUE, SIN_CHOQUE)
  chequear("Parseo", "Sin choque, cada regla escribe lo suyo",
    "JUAN PEREZ · VARIOS", `${ok["leyendas_adicionales_1"]} · ${ok["leyendas_adicionales_3"]}`,
    ok["leyendas_adicionales_1"] === "JUAN PEREZ" && ok["leyendas_adicionales_3"] === "VARIOS", "A-FEAT-1174")

  // ── El reconocedor: los 6 detectores nuevos, con los textos reales de MA ──────────────────
  const reconoce = (texto: string) => {
    const p = proponerMapeo(["PAGO DE SERVICIOS", texto])
    return p[1]
  }
  for (const [texto, esperado, campo] of [
    ["Terminal: 0500", "identificador", "numero_de_terminal"],
    ["Sucursal: 0360", "nombre", "leyendas_adicionales_1"],
    ["LINK", "banco", "leyendas_adicionales_4"],
    ["007001005392", "concepto", "leyendas_adicionales_3"],
    ["Enero 2026", "concepto", "leyendas_adicionales_3"],
    // Las cuatro entidades destino que el reconocedor no conocía — A-FEAT-1175.
    // Confirmadas por el usuario mirando los 12 movimientos reales de MA:
    // FNCS = BBVA Argentina · RIOP = Santander Río · las otras dos son billeteras.
    ["FNCS", "banco", "leyendas_adicionales_4"],
    ["RIOP", "banco", "leyendas_adicionales_4"],
    ["PERSONAL PAY", "banco", "leyendas_adicionales_4"],
    ["MERCADO LIBRE SRL", "banco", "leyendas_adicionales_4"],
  ] as const) {
    const r = reconoce(texto)
    chequear("Parseo", `«${texto}» se reconoce como ${esperado}`,
      `${esperado} → ${campo}`, `${r.contenido || "(nada)"} → ${r.campo || "(sin columna)"}`,
      r.contenido === esperado && r.campo === campo, "A-FEAT-1174")
  }

  /**
   * 🧮 **La auditoría de un subtipo — A-FEAT-1177.**
   *
   * El caso es REAL y es el que costó caro: las reglas viejas de `TRANSFERENCIA A TERCEROS`
   * mandan la línea 3 al número de comprobante, y en el subtipo de 6 líneas la línea 3 es **el
   * CBU**. El control tiene que verlo. Con el código anterior a A-FEAT-1177 no lo veía nadie:
   * la función no existía y el número salía de un script que se corrió una vez.
   */
  {
    const seisLineas = [
      "TRANSFERENCIA A TERCEROS", "NO  27300503905", "0140363103650054482399",
      "LINK", "4517XXXXXXXXXX11", "VARIOS",
    ]
    // Las 4 reglas que MA tiene cargadas hoy para este tipo, tal cual están en la BD
    const reglasViejas = [
      { campo_destino: "descripcion",            tipo_regla: "linea", numero_linea: 1, grupo_de_conceptos: "Transferencias" },
      { campo_destino: "leyendas_adicionales_2", tipo_regla: "cuit",  numero_linea: null, grupo_de_conceptos: "Transferencias" },
      { campo_destino: "numero_de_comprobante",  tipo_regla: "linea", numero_linea: 3, grupo_de_conceptos: "Transferencias" },
      { campo_destino: "numero_de_terminal",     tipo_regla: "linea", numero_linea: 5, grupo_de_conceptos: "Transferencias" },
    ]
    const a = auditarSubtipo(seisLineas, reglasViejas as never)

    const cbu = a.hallazgos.find(h => h.linea === 3)
    chequear("Parseo", "El CBU que cae en el nº de comprobante se detecta",
      "hallazgo en L3 → numero_de_comprobante", cbu ? `hallazgo en L3 → ${cbu.cayoEn}` : "no lo vio",
      cbu?.cayoEn === "numero_de_comprobante", "A-FEAT-1177")

    const banco = a.hallazgos.find(h => h.linea === 4)
    chequear("Parseo", "El banco que no se guarda en ningún lado se detecta",
      "hallazgo en L4 sin columna", banco ? `hallazgo en L4, cayó en ${banco.cayoEn ?? "ninguna"}` : "no lo vio",
      !!banco && banco.cayoEn === null, "A-FEAT-1177")

    // El CUIT SÍ está bien: el modo `cuit` lo guarda sin el prefijo «NO ». Comparar contra la
    // línea cruda lo reportaba como error — 3 falsos positivos en la primera medición.
    chequear("Parseo", "El CUIT con prefijo «NO » NO se reporta como error",
      "sin hallazgo en L2", a.hallazgos.some(h => h.linea === 2) ? "lo reportó mal" : "sin hallazgo en L2",
      !a.hallazgos.some(h => h.linea === 2), "A-FEAT-1177")

    /**
     * 🔴 **El choque: dos líneas guardadas en la misma columna.** Es el caso real del débito de
     * AySA — la línea 3 (`CONSUMO`) y la 4 (`004105544412`) quedaron las dos en Concepto, así que
     * **al parsear una se pierde**. Es lo único que la app puede afirmar que está roto, porque no
     * hay explicación de negocio posible (§ `CLAUDE.md` 🚦 integridad).
     */
    const aysa = ["DEB. AUTOM. DE SERV.", "AGUA Y SANE-AYSA", "CONSUMO", "004105544412", "0000055193"]
    const conChoque = auditarSubtipo(aysa, [
      { campo_destino: "descripcion",            tipo_regla: "linea", numero_linea: 1, grupo_de_conceptos: "D", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_1", tipo_regla: "linea", numero_linea: 2, grupo_de_conceptos: "D", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_3", tipo_regla: "linea", numero_linea: 3, grupo_de_conceptos: "D", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_3", tipo_regla: "linea", numero_linea: 4, grupo_de_conceptos: "D", firma_forma: "x" },
      { campo_destino: "numero_de_comprobante",  tipo_regla: "linea", numero_linea: 5, grupo_de_conceptos: "D", firma_forma: "x" },
    ] as never)
    chequear("Parseo", "Dos líneas en la misma columna se detectan como choque",
      "1 choque en leyendas_adicionales_3",
      `${conChoque.choques.length} choque(s)` + (conChoque.choques[0] ? ` en ${conChoque.choques[0].campo}` : ""),
      conChoque.choques.length === 1 && conChoque.choques[0].campo === "leyendas_adicionales_3", "A-BUG-1208")

    chequear("Parseo", "Y dice CUÁLES son las dos líneas que chocan",
      "L3 y L4", (conChoque.choques[0]?.lineas ?? []).map(n => `L${n}`).join(" y "),
      JSON.stringify(conChoque.choques[0]?.lineas) === "[3,4]", "A-BUG-1208")

    chequear("Parseo", "Lo que el usuario decidió NO figura como discrepancia",
      "sin discrepancia en L5",
      conChoque.hallazgos.some(h => h.linea === 5) ? "la marca como error" : "sin discrepancia en L5",
      !conChoque.hallazgos.some(h => h.linea === 5), "A-BUG-1207")

    chequear("Parseo", "Las reglas que cuentan renglones sin subtipo se cuentan",
      "3", String(a.reglasQueCuentanSinSubtipo), a.reglasQueCuentanSinSubtipo === 3, "A-BUG-1200")

    // Con las reglas bien puestas, el mismo subtipo no tiene que dar ningún hallazgo
    const reglasBien = [
      { campo_destino: "descripcion",            tipo_regla: "linea", numero_linea: 1, grupo_de_conceptos: "T", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_2", tipo_regla: "cuit",  numero_linea: null, grupo_de_conceptos: "T", firma_forma: "x" },
      { campo_destino: "tipo_de_movimiento",     tipo_regla: "cbu",   numero_linea: null, grupo_de_conceptos: "T", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_4", tipo_regla: "linea", numero_linea: 4, grupo_de_conceptos: "T", firma_forma: "x" },
      { campo_destino: "numero_de_terminal",     tipo_regla: "linea", numero_linea: 5, grupo_de_conceptos: "T", firma_forma: "x" },
      { campo_destino: "leyendas_adicionales_3", tipo_regla: "linea", numero_linea: 6, grupo_de_conceptos: "T", firma_forma: "x" },
    ]
    const b = auditarSubtipo(seisLineas, reglasBien as never)
    chequear("Parseo", "Con las reglas bien puestas el subtipo no da hallazgos",
      "0 hallazgos · 0 reglas sueltas",
      `${b.hallazgos.length} hallazgos · ${b.reglasQueCuentanSinSubtipo} reglas sueltas`,
      b.hallazgos.length === 0 && b.reglasQueCuentanSinSubtipo === 0, "A-FEAT-1177")
  }

  /**
   * 🎛️ **Abrir el editor no puede contradecirse a sí mismo — A-BUG-1202.**
   *
   * El caso es el que vio el usuario: la regla vieja manda la línea del CBU a
   * `numero_de_comprobante`. Al abrir el editor, el desplegable decía «CBU destino» y abajo, en
   * la MISMA fila, «va a numero_de_comprobante». La columna tiene que salir de la convención.
   */
  {
    const lineaCbu = proponerMapeo([
      "TRANSFERENCIA A TERCEROS", "NO  27300503905", "0140363103650054482399",
      "LINK", "4517XXXXXXXXXX11", "VARIOS",
    ])[2]
    const r = resolverFilaExistente(lineaCbu, { campo_destino: "numero_de_comprobante", tipo_regla: "linea" })

    chequear("Parseo", "Al abrir el editor manda lo GUARDADO, no lo que propone la app",
      "numero_de_comprobante", r.campo, r.campo === "numero_de_comprobante", "A-BUG-1207")

    chequear("Parseo", "Y la app queda como sugerencia, al lado",
      "sugiere tipo_de_movimiento", r.sugerencia ? `sugiere ${r.sugerencia.campo}` : "no sugiere nada",
      r.sugerencia?.campo === "tipo_de_movimiento", "A-BUG-1207")

    // Una regla que ya coincide con la app no genera sugerencia
    const ok = resolverFilaExistente(lineaCbu, { campo_destino: "tipo_de_movimiento", tipo_regla: "cbu" })
    chequear("Parseo", "Si lo guardado y la app coinciden, no hay nada que sugerir",
      "sin sugerencia", ok.sugerencia ? "sugiere algo" : "sin sugerencia", !ok.sugerencia, "A-BUG-1207")

    /**
     * 🛑 El caso que costó tres vueltas: la app está SEGURA de que `0000055193` es un concepto, y
     * el usuario decidió que es el código de autorización. **Gana él.**
     */
    const propNum = proponerMapeo(["DEB. AUTOM. DE SERV.", "AGUA Y SANE-AYSA", "CONSUMO", "004105544412", "0000055193"])[4]
    chequear("Parseo", "La app está segura de que 0000055193 es un concepto",
      "concepto / seguro", `${propNum.contenido} / ${propNum.seguro ? "seguro" : "no seguro"}`,
      propNum.contenido === "concepto" && propNum.seguro, "A-BUG-1207")

    const suyo = resolverFilaExistente(propNum, { campo_destino: "numero_de_comprobante", tipo_regla: "linea" })
    chequear("Parseo", "Aun estando SEGURA, la app no pisa lo que decidió el usuario",
      "numero_de_comprobante", suyo.campo, suyo.campo === "numero_de_comprobante", "A-BUG-1207")

    chequear("Parseo", "Y se muestra con el nombre que él eligió",
      "autorizacion", suyo.contenido, suyo.contenido === "autorizacion", "A-BUG-1207")

    /**
     * 🛑 **El grupo de conceptos nunca se guarda vacío — A-BUG-1209.** La columna es `NOT NULL` y
     * mandarle `null` rompe el guardado. Le pasó al usuario configurando un tipo de PAM que
     * todavía no tenía grupo.
     */
    for (const vacio of ["", "   ", null, undefined]) {
      chequear("Parseo", `El grupo de conceptos vacío (${JSON.stringify(vacio)}) se guarda como «Otros»`,
        "Otros", grupoParaGuardar(vacio), grupoParaGuardar(vacio) === "Otros", "A-BUG-1209")
    }
    chequear("Parseo", "Y un grupo escrito se respeta tal cual, sin espacios de más",
      "Transferencias", grupoParaGuardar("  Transferencias  "),
      grupoParaGuardar("  Transferencias  ") === "Transferencias", "A-BUG-1209")

    /**
     * 🏦 **El grupo sale del vocabulario del Galicia, no de uno propio — A-DEC-31.**
     *
     * Los casos usan tipos que el banco **ya clasifica en MSA**, así que si alguien cambia el mapa
     * a ojo, esto falla. `COMPRA DEBITO` va a Extracciones y no a Pagos **porque así lo pone el
     * banco**, aunque suene al revés.
     */
    for (const [tipo, esperado] of [
      ["COMPRA DEBITO", "000905 - Extracciones"],
      ["DEB. AUTOM. DE SERV.", "000083 - Pagos"],
      ["TRANSFERENCIAS CASH PROVEEDORES", "000907 - Transferencias"],
      ["SERVICIO PAGO A PROVEEDORES", "000909 - Pago Proveedores"],
      ["SUSCRIPCION FIMA", "000916 - Inversiones"],
      ["COM. CAJA DE SEGURIDAD", "000808 - Comisiones"],
      ["IVA", "000901 - Impuestos"],
      ["INTERES CAPITALIZADO", "000814 - Intereses"],
      ["REINTEGRO PROMOCION GALICIA", "000903 - Créditos Varios"],
    ] as const) {
      chequear("Parseo", `«${tipo}» va al grupo que usa el banco`,
        esperado, grupoSugeridoParaTipo(tipo), grupoSugeridoParaTipo(tipo) === esperado, "A-DEC-31")
    }

    chequear("Parseo", "Un tipo que nadie conoce NO se adivina: queda vacío para que lo elija el usuario",
      "(vacío)", grupoSugeridoParaTipo("VENTA DE PATOS") || "(vacío)",
      grupoSugeridoParaTipo("VENTA DE PATOS") === "", "A-DEC-31")

    chequear("Parseo", "Todo lo que sugiere está en la lista cerrada del banco",
      "todos", "todos",
      ["COMPRA DEBITO", "IVA", "CHEQUE 48 HS", "COMISION POR TRANSFERENCIA", "EXTRACCION CAJERO"]
        .every(t => GRUPOS_GALICIA.includes(grupoSugeridoParaTipo(t) as never)), "A-DEC-31")

    /**
     * 🔁 **El importador reconoce un duplicado por el TEXTO CRUDO — A-BUG-1210.**
     *
     * El caso real: los 96 movimientos de MA se re-parsearon el 2026-09-25, así que su
     * `descripcion` cambió. Con la clave vieja, el próximo Excel que repitiera el último día
     * habría duplicado esas filas. Con la nueva, la clave no se mueve.
     */
    {
      // Como lo manda el Excel del banco (CRLF) y como suele quedar en la base (LF)
      const delBanco = ["COMPRA DEBITO", " RES LIBERTAD", " 4517XXXXXXXXXX11", " A732"].join("\r\n")
      const mismoOtroFormato = ["COMPRA DEBITO", " RES LIBERTAD", " 4517XXXXXXXXXX11", " A732"].join("\n")

      chequear("Parseo", "El mismo movimiento da la misma clave aunque cambien los saltos de línea",
        "iguales",
        claveDedupMovimiento(delBanco, 5000, 0) === claveDedupMovimiento(mismoOtroFormato, 5000, 0) ? "iguales" : "distintas",
        claveDedupMovimiento(delBanco, 5000, 0) === claveDedupMovimiento(mismoOtroFormato, 5000, 0),
        "A-BUG-1210")

      chequear("Parseo", "Dos movimientos distintos del mismo día NO comparten clave",
        "distintas",
        claveDedupMovimiento(delBanco, 5000, 0) === claveDedupMovimiento(delBanco, 7000, 0) ? "iguales" : "distintas",
        claveDedupMovimiento(delBanco, 5000, 0) !== claveDedupMovimiento(delBanco, 7000, 0),
        "A-BUG-1210")

      // Lo que rompía antes: la descripción cambia con las reglas, el texto crudo no
      chequear("Parseo", "La clave NO depende de cómo esté parseado el movimiento",
        "contiene el texto del banco",
        claveDedupMovimiento(delBanco, 5000, 0).includes("RES LIBERTAD") ? "contiene el texto del banco" : "no lo contiene",
        claveDedupMovimiento(delBanco, 5000, 0).includes("RES LIBERTAD"), "A-BUG-1210")
    }

    chequear("Parseo", "La columna del CBU se lee de vuelta como CBU",
      "cbu", contenidoDeCampo("tipo_de_movimiento"), contenidoDeCampo("tipo_de_movimiento") === "cbu", "A-BUG-1202")
  }

  // La tarjeta ya tiene columna: era el hueco de A-FEAT-16.
  const tar = reconoce("4517XXXXXXXXXX11")
  chequear("Parseo", "La tarjeta va al instrumento, ya no queda sin columna",
    "numero_de_terminal", tar.campo || "(sin columna)", tar.campo === "numero_de_terminal", "A-FEAT-16")


  // ── A-BUG-146 — filas repetidas antes del TXT que va a ARCA ─────────────────────────────────
  //
  // Los números son los REALES del pago de ALCORTA del 10/09: la FC 6337 quedó duplicada y el
  // renglón del certificado declaraba $534.631,16 de pago en vez de $364.272,27.
  const F6337 = { id: "a", factura_id: "f-6337", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 170358.89, retencion: 0, pago: 170358.89, neto_gravado_pagado: 140792.49 }
  const F6328 = { id: "b", factura_id: "f-6328", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 110255.81, retencion: 158.26, pago: 110097.55, neto_gravado_pagado: 91120.51 }
  const F6347 = { id: "c", factura_id: "f-6347", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 85224.50, retencion: 1408.67, pago: 83815.83, neto_gravado_pagado: 70433.46 }
  const DUP6337 = { ...F6337, id: "a2" }   // la del doble click: otro id, todo lo demás igual

  const conDup = deduplicarFilasSicore([F6337, DUP6337, F6328, F6347])
  const sumaPago = (fs: typeof conDup.vigentes) => r2(fs.reduce((s, f) => s + (f.pago as number), 0))

  chequear("SICORE", "La fila duplicada por el doble click queda FUERA del TXT",
    "1 descartada de 4", `${conDup.descartados.length} descartada(s) de 4`,
    conDup.descartados.length === 1 && conDup.vigentes.length === 3, "A-BUG-146")

  chequear("SICORE", "…y el pago declarado a ARCA vuelve al correcto",
    "$364.272,27", `$${n2(sumaPago(conDup.vigentes))}`,
    cerca(sumaPago(conDup.vigentes), 364272.27, 0.01), "A-BUG-146")

  chequear("SICORE", "Sin deduplicar declararía de más — el caso falla con el código viejo",
    "$534.631,16", `$${n2(r2([F6337, DUP6337, F6328, F6347].reduce((s, f) => s + f.pago, 0)))}`,
    cerca(r2([F6337, DUP6337, F6328, F6347].reduce((s, f) => s + f.pago, 0)), 534631.16, 0.01), "A-BUG-146")

  // 🔴 El adversario, y es el que hace que el arreglo sea seguro: DOS PAGOS PARCIALES legítimos de
  // la misma factura en la misma quincena **no se pueden colapsar**. Se distinguen por el importe.
  const parcial1 = { ...F6328, id: "p1", total_pagado: 50000, pago: 49900, retencion: 100 }
  const parcial2 = { ...F6328, id: "p2", total_pagado: 60255.81, pago: 60197.55, retencion: 58.26 }
  const conParciales = deduplicarFilasSicore([parcial1, parcial2])
  chequear("SICORE", "🔴 Dos pagos PARCIALES de la misma factura NO se colapsan",
    "las 2 quedan", `quedan ${conParciales.vigentes.length}`,
    conParciales.vigentes.length === 2 && conParciales.descartados.length === 0, "A-BUG-146")

  // Y una fila sin factura ni anticipo cae en su propio id: ante la duda, se conserva.
  const sueltas = deduplicarFilasSicore([
    { id: "x", quincena: "26-09 - 1ra", tipo_sicore: "Bienes", total_pagado: 100, retencion: 2, pago: 98 },
    { id: "y", quincena: "26-09 - 1ra", tipo_sicore: "Bienes", total_pagado: 100, retencion: 2, pago: 98 },
  ])
  chequear("SICORE", "Filas sin factura ni anticipo no se descartan entre sí",
    "las 2 quedan", `quedan ${sueltas.vigentes.length}`,
    sueltas.vigentes.length === 2, "A-BUG-146")

  // ── A-FEAT-129 — el test viaja con el proceso: la marca `@pantalla/proceso` ─────────────────
  //
  // Lo que se prueba acá es **qué ve el modal**, que es lo único que decide si la feature sirve:
  // de más, se vuelve ruido y se deja de mirar; de menos, no avisa de nada.
  const MD = [
    '| ID | Estado | Prio | Ítem |',
    '|----|--------|------|------|',
    '| A-TEST-500 | 🔴 | Test | Probar la retención acumulada `@cashflow/sicore` |',
    '| A-TEST-501 | 🟢 | Test | Probar el lote de Galicia `@cashflow/lote` |',
    '| A-TEST-502 | ✅ | Test | Ya probado, no tiene que aparecer `@cashflow/sicore` |',
    '| A-TEST-503 | 🔴 | Test | Sin marca de proceso, sólo de pantalla `@cashflow` |',
    '| A-BUG-500 | 🔴 | Bug | Un bug del mismo proceso, que NO es un test `@cashflow/sicore` |',
  ].join('\n')
  const parsed = parsePendientes(MD)
  const abiertoP = (p: { estado: string }) => !['✅', '⚰️', '⏸️'].some(e => (p.estado || '').includes(e))
  const delModal = parsed.pendientes.filter(p =>
    esDelProceso(p, 'cashflow/sicore') && /^A-TEST-/i.test(p.id) && abiertoP(p))

  chequear("Tests del proceso", "El modal de SICORE muestra SÓLO el test abierto de su proceso",
    "A-TEST-500", delModal.map(p => p.id).join(', ') || '(ninguno)',
    delModal.length === 1 && delModal[0].id === 'A-TEST-500', "A-FEAT-129")

  // 🔴 Los cuatro adversarios, uno por cada forma de colarse.
  chequear("Tests del proceso", "🔴 Un test de OTRO proceso de la misma pantalla no entra",
    "A-TEST-501 afuera", delModal.some(p => p.id === 'A-TEST-501') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-501'), "A-FEAT-129")

  chequear("Tests del proceso", "🔴 Un test YA PROBADO no vuelve a aparecer",
    "A-TEST-502 afuera", delModal.some(p => p.id === 'A-TEST-502') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-502'), "A-FEAT-129")

  // El más importante: sin marca de proceso NO entra. Si heredara el «sin marca = en todas las
  // pantallas» de `pantallasDe`, el modal arrancaría con cientos de ítems y nadie lo miraría.
  chequear("Tests del proceso", "🔴 Sin marca de PROCESO no entra (aunque tenga la de pantalla)",
    "A-TEST-503 afuera", delModal.some(p => p.id === 'A-TEST-503') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-503'), "A-FEAT-129")

  chequear("Tests del proceso", "🔴 Un BUG del mismo proceso no entra: el cartel es de tests",
    "A-BUG-500 afuera", delModal.some(p => p.id === 'A-BUG-500') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-BUG-500'), "A-FEAT-129")

  // 🐞 Y el que reproduce el bug que cometí escribiendo esto: filtrar por la columna `tipo` daba
  // CERO con los cinco bien marcados, porque en varias tablas del índice esa celda no se mapea.
  const porColumnaTipo = parsed.pendientes.filter(p =>
    esDelProceso(p, 'cashflow/sicore') && p.tipo === 'Test' && abiertoP(p))
  chequear("Tests del proceso", "Filtrar por la columna `tipo` NO sirve — por eso se usa el ID",
    "0 por columna vs 1 por ID", `${porColumnaTipo.length} vs ${delModal.length}`,
    porColumnaTipo.length !== delModal.length || porColumnaTipo.length === 0, "A-FEAT-129")

  // Dos marcas en la misma fila: cada sub tiene que quedar pegado a SU pantalla.
  const dos = parsePendientes([
    '| ID | Estado | Prio | Ítem |', '|----|--------|------|------|',
    '| A-TEST-504 | 🔴 | Test | Dos procesos `@cashflow/sicore` `@egresos/subdiarios` |',
  ].join('\n')).pendientes[0]
  chequear("Tests del proceso", "Con dos marcas, cada proceso queda pegado a SU pantalla",
    "cashflow/sicore + egresos/subdiarios", dos?.procesos.join(' + ') || '(ninguno)',
    !!dos && dos.procesos.includes('cashflow/sicore') && dos.procesos.includes('egresos/subdiarios'),
    "A-FEAT-129")

  // ── A-BUG-145 / A-BUG-149 — el Detalle de Pago que sale de la empresa ───────────────────────
  //
  // 🔴 Lo que se calcula acá **lo lee el proveedor** y concilia su cuenta corriente contra esto.
  // Números reales del pago de ALCORTA del 10/09.
  const ALCORTA_PAGO = [
    { comprobante: "FC 6337", imp_total: 179325.15, monto_sicore: null, descuento_aplicado: 8966.26, monto_a_abonar: 170358.89, origen: "ARCA" },
    { comprobante: "FC 6328", imp_total: 116058.75, monto_sicore: 158.26, descuento_aplicado: 5802.94, monto_a_abonar: 110097.55, origen: "ARCA" },
    { comprobante: "FC 6347", imp_total: 89710.00, monto_sicore: 1408.67, descuento_aplicado: 4485.50, monto_a_abonar: 83815.83, origen: "ARCA" },
  ]

  // A-BUG-145: las 3 facturas se pagaron con UNA transferencia (mismo grupo de pago).
  const unaTransferencia = [{ tipo: "transferencia" as const, monto: 364272.27, detalle: "Transferencia (3 facturas)" }]
  const cAlcorta = calcularCuenta(ALCORTA_PAGO, unaTransferencia, "arca")

  chequear("Detalle de pago", "🔴 Un pago con UNA transferencia se anuncia como UN renglón",
    "1 medio", `${unaTransferencia.length} medio(s)`, unaTransferencia.length === 1, "A-BUG-145")

  chequear("Detalle de pago", "…y la cuenta cierra igual: $385.093,90",
    "$385.093,90", `$${n2(cAlcorta.totalCancelado)}`,
    cerca(cAlcorta.totalCancelado, 385093.90, 0.01) && cerca(cAlcorta.bruto, 385093.90, 0.01), "A-BUG-145")

  // 🔑 El que explica por qué ningún control lo agarraba: con TRES renglones la cuenta **también**
  // cerraba. El total estaba bien y el desglose mentía — por eso hizo falta mirarlo, no sumarlo.
  const tresTransferencias = ALCORTA_PAGO.map(i => ({ tipo: "transferencia" as const, monto: i.monto_a_abonar }))
  const cTres = calcularCuenta(ALCORTA_PAGO, tresTransferencias, "arca")
  chequear("Detalle de pago", "Con 3 renglones la cuenta CERRABA igual — por eso el bug sobrevivió",
    "cierra, y está mal igual", `dif $${n2(cTres.dif)} con ${tresTransferencias.length} renglones`,
    Math.abs(cTres.dif) <= 1 && tresTransferencias.length === 3, "A-BUG-145")

  // A-BUG-149: un ANTICIPO no es una factura. Es el caso IGLESIAS que dio nombre a A-BUG-105.
  const conAnticipo = [
    { comprobante: "FC 816", imp_total: 3554000, monto_sicore: 57400.40, descuento_aplicado: null, monto_a_abonar: 1042599.60, origen: "ARCA" },
    { comprobante: "Anticipo", imp_total: 2454000, monto_sicore: null, descuento_aplicado: null, monto_a_abonar: 2454000, origen: "ANTICIPO" },
  ]
  const cAnt = calcularCuenta(conAnticipo, [
    { tipo: "echeq" as const, monto: 2454000 }, { tipo: "transferencia" as const, monto: 1042599.60 },
  ], "arca")
  chequear("Detalle de pago", "🔴 Un ANTICIPO no suma al «Importe facturas»",
    "$3.554.000,00", `$${n2(cAnt.bruto)}`, cerca(cAnt.bruto, 3554000, 0.01), "A-BUG-149")

  // Y el que falla con el código viejo: así sumaba el PDF antes (a mano, sin mirar `origen`).
  const brutoViejo = conAnticipo.reduce((s, i) => s + i.imp_total, 0)
  chequear("Detalle de pago", "Sumando a mano daba $6.008.000 — el PDF hacía exactamente eso",
    "$6.008.000,00 (mal)", `$${n2(brutoViejo)}`,
    cerca(brutoViejo, 6008000, 0.01) && !cerca(brutoViejo, cAnt.bruto, 1), "A-BUG-149")

  // 🔴 El invariante que pidió el usuario: ver y encolar tienen que dar lo MISMO. Las dos cuentas
  // salen de la misma función, así que con los mismos items y medios no pueden diferir.
  const cVer = calcularCuenta(conAnticipo, [{ tipo: "echeq" as const, monto: 2454000 }, { tipo: "transferencia" as const, monto: 1042599.60 }], "arca")
  chequear("Detalle de pago", "🔴 VER el PDF y ENCOLARLO al mail dan el mismo número",
    `$${n2(cAnt.totalCancelado)}`, `$${n2(cVer.totalCancelado)}`,
    cerca(cAnt.totalCancelado, cVer.totalCancelado, 0.01) && cerca(cAnt.bruto, cVer.bruto, 0.01), "A-BUG-149")

  // ── A-BUG-151 — la etiqueta del comprobante que LEE EL PROVEEDOR ────────────────────────────
  const NOTA = "Insumos Veterinarios Varios + Reproductiva"
  const grupo3 = [
    `FC 6337 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
    `FC 6328 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
    `FC 6347 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
  ].join(" | ")
  const et3 = etiquetaComprobante({ comprobante: grupo3 })

  chequear("Detalle de pago", "🔴 Un grupo nombra LAS TRES facturas, no sólo la primera",
    "6337, 6328 y 6347", et3,
    et3.includes("6337") && et3.includes("6328") && et3.includes("6347"), "A-BUG-151")

  chequear("Detalle de pago", "…y ninguna nota interna sale de la empresa",
    "sin la nota", et3.includes(NOTA) ? "SE FILTRÓ la nota" : "sin la nota",
    !et3.includes(NOTA), "A-BUG-151")

  // 🔴 La otra mitad, y es la que se escapa si el arreglo se hace a medias: cuando la PRIMERA no
  // tiene nota, el corte viejo caía más adelante y filtraba la nota de otra.
  const primeraSinNota = [
    "FC 6337 - ALCORTA EDMUNDO ERNESTO",
    `FC 6328 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
  ].join(" | ")
  const etMixta = etiquetaComprobante({ comprobante: primeraSinNota })
  chequear("Detalle de pago", "🔴 Con la primera SIN nota, tampoco se filtra la nota de la otra",
    "sin la nota, con las 2 facturas", etMixta,
    !etMixta.includes(NOTA) && etMixta.includes("6337") && etMixta.includes("6328"), "A-BUG-151")

  // Y lo que ya andaba tiene que seguir andando: una factura sola, con su nota.
  const sola = etiquetaComprobante({ comprobante: `FC 6337 - ALCORTA EDMUNDO ERNESTO · ${NOTA}` })
  chequear("Detalle de pago", "Una factura sola sigue saliendo igual que antes",
    "FC 6337 - ALCORTA EDMUNDO ERNESTO", sola,
    sola === "FC 6337 - ALCORTA EDMUNDO ERNESTO", "A-BUG-151")

  chequear("Detalle de pago", "Un ANTICIPO se sigue anunciando como «Anticipo»",
    "Anticipo", etiquetaComprobante({ comprobante: "lo que sea", origen: "ANTICIPO" }),
    etiquetaComprobante({ comprobante: "x", origen: "ANTICIPO" }) === "Anticipo", "A-BUG-105")

  // ── A-FEAT-77 — los pagos de sueldos agrupados por empleado ─────────────────────────────────
  const PAGOS_SUELDO = [
    { id: "p1", empleado_id: "e-sigot", monto: 450000.50, empleado: { nombre: "Ruben Sigot" } },
    { id: "p2", empleado_id: "e-wilson", monto: 380000, empleado: { nombre: "Wilson Barreto" } },
    { id: "p3", empleado_id: "e-sigot", monto: 120000.25, empleado: { nombre: "Ruben Sigot" } },
    { id: "p4", empleado_id: "e-alondra", monto: 290000, empleado: { nombre: "Alondra Olivo" } },
    { id: "p5", empleado_id: "e-sigot", monto: 80000.25, empleado: { nombre: "Ruben Sigot" } },
  ]
  const gruposSueldo = agruparPagosPorEmpleado(PAGOS_SUELDO)

  chequear("Sueldos", "Los pagos se agrupan por empleado, ordenados por nombre",
    "Alondra Olivo, Ruben Sigot, Wilson Barreto", gruposSueldo.map(g => g.nombre).join(", "),
    gruposSueldo.map(g => g.nombre).join(", ") === "Alondra Olivo, Ruben Sigot, Wilson Barreto", "A-FEAT-77")

  const sigot = gruposSueldo.find(g => g.empleadoId === "e-sigot")!
  chequear("Sueldos", "🔴 El total del grupo SUMA sus pagos — es lo único que se ve cerrado",
    "$650.001,00 en 3 pagos", `$${n2(sigot.total)} en ${sigot.cantidad} pagos`,
    cerca(sigot.total, 650001, 0.01) && sigot.cantidad === 3, "A-FEAT-77")

  chequear("Sueldos", "…y ningún pago se pierde en el agrupado",
    `${PAGOS_SUELDO.length} pagos`, `${gruposSueldo.reduce((s, g) => s + g.pagos.length, 0)} pagos`,
    gruposSueldo.reduce((s, g) => s + g.pagos.length, 0) === PAGOS_SUELDO.length, "A-FEAT-77")

  // 🔴 El adversario: dos empleados con el MISMO nombre no se pueden juntar. Agrupar por texto
  //    daría un total inflado, que en una pantalla de plata no se lee como error sino como dato.
  const homonimos = agruparPagosPorEmpleado([
    { id: "h1", empleado_id: "e-uno", monto: 100000, empleado: { nombre: "Juan Perez" } },
    { id: "h2", empleado_id: "e-dos", monto: 250000, empleado: { nombre: "Juan Perez" } },
  ])
  chequear("Sueldos", "🔴 Dos empleados con el MISMO nombre no se juntan (se agrupa por id)",
    "2 grupos", `${homonimos.length} grupo(s)`, homonimos.length === 2, "A-FEAT-77")

  // Y un pago sin nombre cargado no rompe la lista ni se muestra vacío.
  const sinNombre = agruparPagosPorEmpleado([{ id: "x", empleado_id: "e-x", monto: 1000 }])
  chequear("Sueldos", "Un pago sin nombre de empleado se muestra igual, no desaparece",
    "(sin nombre)", sinNombre[0]?.nombre ?? "(no salió)",
    sinNombre.length === 1 && sinNombre[0].nombre === "(sin nombre)", "A-FEAT-77")

  // ── P-45 — cuándo NO hay que preguntar por la fecha de pago ─────────────────────────────────
  const HOY = "2026-09-11"
  const preguntar = (filas: Array<{ fecha_pago?: string | null }>) => hayQuePreguntarFechaPago(filas, HOY)

  chequear("Fecha de pago", "Si TODAS ya tienen la fecha de hoy, no se pregunta",
    "no pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: HOY }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: HOY }]) === false, "P-45")

  // 🔴 Los cuatro adversarios. Todos tienen que caer del lado de PREGUNTAR: no preguntar de menos
  //    escribe una fecha equivocada, y de ella sale la quincena de SICORE.
  chequear("Fecha de pago", "🔴 Si UNA tiene otra fecha, se pregunta por el lote entero",
    "pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: "2026-09-04" }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: "2026-09-04" }]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Si UNA no tiene fecha, se pregunta",
    "pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: null }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: null }]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Con la lista VACÍA se pregunta (no se asume nada)",
    "pregunta", preguntar([]) ? "pregunta" : "no pregunta", preguntar([]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Sin fecha propuesta se pregunta",
    "pregunta", hayQuePreguntarFechaPago([{ fecha_pago: HOY }], "") ? "pregunta" : "no pregunta",
    hayQuePreguntarFechaPago([{ fecha_pago: HOY }], "") === true, "P-45")

  // ── B-BUG-CLIENTE-NO-SE-CREA / A-FEAT-41 — el upsert de contrapartes ────────────────────────
  const FICHAS = [
    { cuit: "20103619115", es_cliente: false, es_proveedor: true },   // ALCORTA: proveedor, no cliente
    { cuit: "30714279315", es_cliente: true, es_proveedor: true },    // MERCURE: ya es las dos cosas
  ]
  const planCli = planificarContrapartes([
    { cuit: "20-10361911-5", razon_social: "ALCORTA EDMUNDO ERNESTO" },  // existe, falta el flag
    { cuit: "30714279315", razon_social: "LA MERCURE S.R.L." },          // existe y ya tiene el flag
    { cuit: "30-99999999-7", razon_social: "SANPA S.A." },               // no existe → crear
    { cuit: "", razon_social: "sin cuit" },                              // se descarta, pero se cuenta
  ], FICHAS, "cliente")

  chequear("Contrapartes", "🔴 El que NO existe se CREA (no se hace sólo UPDATE)",
    "1 a crear: 30999999997", `${planCli.aCrear.length} a crear: ${planCli.aCrear.map(c => c.cuit).join(",")}`,
    planCli.aCrear.length === 1 && planCli.aCrear[0].cuit === "30999999997", "B-BUG-CLIENTE-NO-SE-CREA")

  // 🔴 EL adversario de este arreglo, y viene del ESQUEMA: `es_proveedor` tiene DEFAULT true.
  //    Crear un cliente puro sin decir nada lo deja marcado como proveedor, contra la regla.
  chequear("Contrapartes", "🔴 Un cliente nuevo nace con es_proveedor = FALSE (el default es true)",
    "es_cliente=true · es_proveedor=false",
    `es_cliente=${planCli.aCrear[0]?.es_cliente} · es_proveedor=${planCli.aCrear[0]?.es_proveedor}`,
    planCli.aCrear[0]?.es_cliente === true && planCli.aCrear[0]?.es_proveedor === false,
    "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "Al que existe SIN el flag se le marca, no se lo duplica",
    "marcar 20103619115", planCli.aMarcar.join(",") || "(ninguno)",
    planCli.aMarcar.length === 1 && planCli.aMarcar[0] === "20103619115", "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "Al que ya tiene el flag no se lo toca",
    "MERCURE afuera", planCli.aMarcar.includes("30714279315") ? "se tocó" : "afuera",
    !planCli.aMarcar.includes("30714279315"), "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "El CUIT se normaliza: con guiones y sin guiones son el MISMO",
    "1 a crear (no 2)", `${planCli.aCrear.length} a crear`,
    planCli.aCrear.length === 1, "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "⚠️ Lo que viene sin CUIT se descarta pero SE CUENTA",
    "1 sin cuit", `${planCli.sinCuit} sin cuit`, planCli.sinCuit === 1, "B-BUG-CLIENTE-NO-SE-CREA")

  // Y el espejo: por el lado de compras, un proveedor nuevo NO nace marcado como cliente.
  const planProv = planificarContrapartes([{ cuit: "30-55555555-5", razon_social: "NUEVO SRL" }], [], "proveedor")
  chequear("Contrapartes", "Un proveedor nuevo nace con es_cliente = false",
    "es_proveedor=true · es_cliente=false",
    `es_proveedor=${planProv.aCrear[0]?.es_proveedor} · es_cliente=${planProv.aCrear[0]?.es_cliente}`,
    planProv.aCrear[0]?.es_proveedor === true && planProv.aCrear[0]?.es_cliente === false,
    "B-BUG-CLIENTE-NO-SE-CREA")

  // Sin razón social, `razon_social` es NOT NULL: se usa el CUIT antes que romper el import.
  const planSinNombre = planificarContrapartes([{ cuit: "30111111117" }], [], "cliente")
  chequear("Contrapartes", "Sin razón social se usa el CUIT — no se rompe el import",
    "30111111117", planSinNombre.aCrear[0]?.razon_social ?? "(vacío)",
    planSinNombre.aCrear[0]?.razon_social === "30111111117", "B-BUG-CLIENTE-NO-SE-CREA")

  // ══ Editar una campaña de templates (A-FEAT-131) ══════════════════════════════════════════
  //
  // 🔒 El invariante: **los links conciliados perduran hagas lo que hagas.** Los datos de abajo son
  // los REALES de `Red Vial Cuota Lote Puerto` al 2026-09-12, escritos acá como constantes — es el
  // template que destapó el hueco (hay que llevarlo de 4 cuotas a 6 y no hay pantalla que lo haga).
  //
  // ⚠️ Un caso tiene que fallar con el código viejo. Acá el «código viejo» es *borrar y recrear*,
  // que es lo que ya rompió 9 vínculos (A-BUG-156): los dos primeros casos fallarían con esa
  // implementación, porque el `id` cambiaría.
  const C1 = "0d15c8d6-ebf1-4f21-bec9-855f945b4940"   // 16/03, $54.770,60 — CONCILIADA
  const C2 = "5dfe31fa-c0c9-43fe-9489-f681e236421a"   // 16/06, $30.215,00 — pagada, sin vínculo
  const C3 = "87c6991f-7c39-4764-930f-378e73f7612b"   // 05/09, $54.770,60 — pendiente
  const C4 = "425ebf6b-fd74-46e8-b78b-08cddb1b8587"   // 05/12, $54.770,60 — pendiente

  const CUOTAS_LOTE_PUERTO: CuotaExistente[] = [
    { id: C1, numero_cuota: 1, fecha_estimada: "2026-03-16", monto: 54770.60, estado: "conciliado" },
    { id: C2, numero_cuota: 2, fecha_estimada: "2026-06-16", monto: 30215.00, estado: "pagado" },
    { id: C3, numero_cuota: 3, fecha_estimada: "2026-09-05", monto: 54770.60, estado: "pendiente" },
    { id: C4, numero_cuota: 4, fecha_estimada: "2026-12-05", monto: 54770.60, estado: "pendiente" },
  ]
  const igual = (c: CuotaExistente) => ({ id: c.id, fecha_estimada: c.fecha_estimada!, monto: c.monto })

  // El movimiento REAL que está enganchado a la cuota 1, y el REAL de $30.215 que sigue pendiente.
  const mov = (o: Partial<MovBancario> & { id: string; fecha: string; debitos: number }): MovBancario => ({
    tabla: "msa_galicia", creditos: 0, descripcion: "Trf Inmed Proveed",
    estado: "pendiente", template_cuota_id: null, ...o,
  })
  const MOV_VINCULADO = mov({ id: "f5e86271", fecha: "2026-03-16", debitos: 54770.6, estado: "conciliado", template_cuota_id: C1 })
  const MOV_SUELTO_30215 = mov({ id: "58693d0f", fecha: "2026-06-16", debitos: 30215 })
  const MOV_DE_OTRA_CUOTA = mov({ id: "b9244cdc", fecha: "2026-06-16", debitos: 468762.23, estado: "conciliado", template_cuota_id: "456bd8bb" })

  // ── 1 · Editar NO recrea: la cuota conserva su id ────────────────────────────────────────
  const planMonto = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    { id: C1, fecha_estimada: "2026-03-16", monto: 60000 },
    ...CUOTAS_LOTE_PUERTO.slice(1).map(igual),
  ])
  const accionesCrear = planMonto.acciones.filter(a => a.tipo === "crear")
  chequear("Editar campaña", "🔒 Cambiar el monto EDITA la cuota — no la recrea",
    "1 modificar · 0 crear", `${planMonto.acciones.filter(a => a.tipo === "modificar").length} modificar · ${accionesCrear.length} crear`,
    planMonto.acciones.length === 1 && planMonto.acciones[0].tipo === "modificar"
    && planMonto.acciones[0].id === C1, "A-FEAT-131")

  chequear("Editar campaña", "🔒 Y las otras tres cuotas no se tocan",
    "0 acciones sobre C2/C3/C4", `${planMonto.acciones.filter(a => a.tipo !== "crear" && a.id !== C1).length} acciones`,
    planMonto.acciones.every(a => a.tipo === "crear" || a.id === C1), "A-FEAT-131")

  // ── 2 · Quitar una cuota la DESACTIVA: el id (y el link) sobrevive ───────────────────────
  const planQuitar = planificarEdicion(CUOTAS_LOTE_PUERTO, CUOTAS_LOTE_PUERTO.slice(1).map(igual))
  const desact = planQuitar.acciones.find(a => a.tipo === "desactivar")
  chequear("Editar campaña", "🔒 Sacar una cuota de la lista la DESACTIVA, nunca la borra",
    `desactivar ${C1.slice(0, 8)}`, desact ? `${desact.tipo} ${desact.id.slice(0, 8)}` : "(ninguna acción)",
    desact?.tipo === "desactivar" && desact.id === C1, "A-FEAT-131")

  // ── 3 · El caso que lo originó: 4 cuotas → 6, sin tocar las 4 ────────────────────────────
  const planSeis = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.map(igual),
    { id: null, fecha_estimada: "2027-03-05", monto: 54770.60 },
    { id: null, fecha_estimada: "2027-06-05", monto: 54770.60 },
  ])
  chequear("Editar campaña", "Agregar 2 cuotas a un plan de 4: sólo 2 altas, cero modificaciones",
    "2 crear · 0 modificar · 0 desactivar",
    `${planSeis.acciones.filter(a => a.tipo === "crear").length} crear · `
    + `${planSeis.acciones.filter(a => a.tipo === "modificar").length} modificar · `
    + `${planSeis.acciones.filter(a => a.tipo === "desactivar").length} desactivar`,
    planSeis.acciones.length === 2 && planSeis.acciones.every(a => a.tipo === "crear"), "A-FEAT-131")

  chequear("Editar campaña", "Los 4 ids originales siguen en la renumeración (ninguno se perdió)",
    "4 ids", `${Object.keys(planSeis.renumerar).length} ids`,
    [C1, C2, C3, C4].every(id => planSeis.renumerar[id] > 0), "A-FEAT-131")

  // Insertar una cuota ANTES de todas renumera, pero no cambia ni un id.
  const planIntercalar = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    { id: null, fecha_estimada: "2026-01-10", monto: 1000 },
    ...CUOTAS_LOTE_PUERTO.map(igual),
  ])
  chequear("Editar campaña", "Intercalar una cuota anterior corre los NÚMEROS, no los ids",
    "la que era 1 pasa a 2", `pasa a ${planIntercalar.renumerar[C1]}`,
    planIntercalar.renumerar[C1] === 2 && planIntercalar.acciones.every(a => a.tipo === "crear"), "A-FEAT-131")

  // ── 4 · El check al momento: el vínculo que se queda sin cerrar ──────────────────────────
  const avisosMonto = evaluarAvisos(planMonto, [MOV_VINCULADO], [MOV_VINCULADO])
  chequear("Editar campaña", "🔴 Cambiar el monto de una cuota CONCILIADA avisa en rojo",
    "VINCULO_SE_ROMPE", avisosMonto.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosMonto.some(a => a.codigo === "VINCULO_SE_ROMPE" && a.nivel === "rojo"), "A-FEAT-131")

  // La tolerancia es la del motor: 5 días pasa, 6 no. Si estos dos dieran igual, el aviso estaría
  // usando un criterio propio y avisaría de matches que el motor nunca haría.
  const conFecha = (f: string) => evaluarAvisos(
    planificarEdicion(CUOTAS_LOTE_PUERTO, [{ id: C1, fecha_estimada: f, monto: 54770.60 }, ...CUOTAS_LOTE_PUERTO.slice(1).map(igual)]),
    [MOV_VINCULADO], [])
  chequear("Editar campaña", "Correr la fecha 5 días NO avisa (es la tolerancia del motor)",
    "sin aviso rojo", `${conFecha("2026-03-21").filter(a => a.nivel === "rojo").length} rojos`,
    conFecha("2026-03-21").every(a => a.nivel !== "rojo"), "A-FEAT-131")
  chequear("Editar campaña", "…y correrla 6 días SÍ avisa",
    "1 aviso rojo", `${conFecha("2026-03-22").filter(a => a.nivel === "rojo").length} rojos`,
    conFecha("2026-03-22").some(a => a.nivel === "rojo"), "A-FEAT-131")

  // ── 5 · El que pidió el usuario: «coincide proveedor, fecha, monto contra salida bancaria» ─
  const planHaciaOtro = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.slice(0, 2).map(igual),
    { id: C3, fecha_estimada: "2026-06-16", monto: 468762.23 },
    igual(CUOTAS_LOTE_PUERTO[3]),
  ])
  const avisosOtro = evaluarAvisos(planHaciaOtro, [MOV_VINCULADO], [MOV_DE_OTRA_CUOTA, MOV_SUELTO_30215])
  chequear("Editar campaña", "🟠 Si el valor nuevo coincide con un movimiento que YA es de otra cuota, avisa",
    "COINCIDE_CON_OTRO", avisosOtro.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosOtro.some(a => a.codigo === "COINCIDE_CON_OTRO"), "A-FEAT-131")

  // Y el otro lado: si el valor nuevo cae sobre una salida SIN conciliar, se informa en azul.
  // 📌 Es el caso real del 16/06: $30.215 sigue pendiente en el banco y la cuota 2 ya dice ese monto.
  const planHaciaSuelto = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.slice(0, 2).map(igual),
    { id: C3, fecha_estimada: "2026-06-16", monto: 30215 },
    igual(CUOTAS_LOTE_PUERTO[3]),
  ])
  const avisosSuelto = evaluarAvisos(planHaciaSuelto, [], [MOV_SUELTO_30215])
  chequear("Editar campaña", "🔵 Si cae sobre una salida SIN conciliar, lo dice (no lo calla)",
    "SE_ACERCA", avisosSuelto.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosSuelto.some(a => a.codigo === "SE_ACERCA" && a.nivel === "azul"), "A-FEAT-131")

  // ── 6 · Desactivar algo vinculado se anuncia ─────────────────────────────────────────────
  const avisosQuitar = evaluarAvisos(planQuitar, [MOV_VINCULADO], [])
  chequear("Editar campaña", "Quitar una cuota conciliada lo dice antes de guardar",
    "DESACTIVA_VINCULADA", avisosQuitar.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosQuitar.some(a => a.codigo === "DESACTIVA_VINCULADA"), "A-FEAT-131")

  // ── 7 · La trampa del huso horario ───────────────────────────────────────────────────────
  // Si `diasEntre` mezclara medianoche local con medianoche UTC, dos fechas iguales darían 1 día en
  // Argentina (UTC-3) y un match exacto se reportaría como «fecha no exacta».
  chequear("Editar campaña", "Dos fechas iguales distan 0 días (no 1 por el huso horario)",
    "0 días", `${diasEntre("2026-06-16", "2026-06-16")} días`,
    diasEntre("2026-06-16", "2026-06-16") === 0, "A-FEAT-131")

  // Un monto en cero nunca puede «coincidir»: hay 20 cuotas de Red Vial en $0 (A-BUG-135) y todas
  // matchearían entre sí, llenando la pantalla de avisos que no significan nada.
  chequear("Editar campaña", "⚠️ Una cuota en $0 no coincide con nada (hay 20 así en la base)",
    "no coincide", coincide(mov({ id: "x", fecha: "2026-06-16", debitos: 0 }), "2026-06-16", 0) ? "coincide" : "no coincide",
    !coincide(mov({ id: "x", fecha: "2026-06-16", debitos: 0 }), "2026-06-16", 0), "A-FEAT-131")


  // ══ El identificador de una cuota se GENERA (A-FEAT-137) ══════════════════════════════════
  //
  // 🪪 *«Detalle es detalle y descripción es lo que es un identificador»* (usuario, 2026-09-12).
  // Los datos son reales: `UATRE MSA` es uno de los 20 templates que llevan la empresa en el
  // nombre, y el texto libre salió de una cuota de la base.
  const TPL_UATRE = { nombre_referencia: "UATRE MSA", responsable: "MSA" }
  const TPL_REDVIAL = { nombre_referencia: "Red Vial Cuota Lote Puerto", responsable: "MSA" }
  const CUOTA_SEP = { fecha_estimada: "2026-09-05" }

  chequear("Identificador cuota", "⚠️ El responsable NO se repite si el nombre ya lo tiene",
    "UATRE MSA - Septiembre 2026", identificadorDeCuota(CUOTA_SEP, TPL_UATRE),
    identificadorDeCuota(CUOTA_SEP, TPL_UATRE) === "UATRE MSA - Septiembre 2026", "A-FEAT-137")

  chequear("Identificador cuota", "…y SÍ se agrega cuando no lo tiene",
    "Red Vial Cuota Lote Puerto MSA - Septiembre 2026", identificadorDeCuota(CUOTA_SEP, TPL_REDVIAL),
    identificadorDeCuota(CUOTA_SEP, TPL_REDVIAL) === "Red Vial Cuota Lote Puerto MSA - Septiembre 2026",
    "A-FEAT-137")

  // 🔴 Sin nombre no se devuelve media etiqueta: eso se lee como un dato roto, no como uno ausente.
  chequear("Identificador cuota", "Sin nombre de template devuelve vacío, no ' - Septiembre 2026'",
    "(vacío)", identificadorDeCuota(CUOTA_SEP, { nombre_referencia: null }) || "(vacío)",
    identificadorDeCuota(CUOTA_SEP, { nombre_referencia: null }) === "", "A-FEAT-137")

  chequear("Identificador cuota", "Sin fecha queda sólo el nombre (no inventa período)",
    "UATRE MSA", identificadorDeCuota({ fecha_estimada: null }, TPL_UATRE),
    identificadorDeCuota({ fecha_estimada: null }, TPL_UATRE) === "UATRE MSA", "A-FEAT-137")

  // ── La composición: identificador · detalle ──────────────────────────────────────────────
  const LIBRE = "1.740 Kg Maiz Castillo a 193.000 la ton"
  chequear("Identificador cuota", "Con detalle se COMPONE, no se pisa",
    `UATRE MSA - Septiembre 2026 · ${LIBRE}`, detalleCompleto(CUOTA_SEP, TPL_UATRE, LIBRE),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, LIBRE) === `UATRE MSA - Septiembre 2026 · ${LIBRE}`,
    "A-FEAT-137")

  // 🔑 El caso que contesta la duda del usuario: «¿hay que llenar detalle con descripción?».
  //    No: sin detalle se muestra el identificador solo. Copiarlo no agregaría NADA visible,
  //    y en cambio borraría la distinción entre lo escrito y lo generado.
  chequear("Identificador cuota", "🔑 Sin detalle se ve el identificador solo (por eso NO se copia)",
    "UATRE MSA - Septiembre 2026", detalleCompleto(CUOTA_SEP, TPL_UATRE, null),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, null) === "UATRE MSA - Septiembre 2026", "A-FEAT-137")

  // Durante la migración hay filas cuyo detalle YA empieza con el identificador. No se duplica.
  const YA_COPIADO = "UATRE MSA - Septiembre 2026 · algo"
  chequear("Identificador cuota", "⚠️ Si el detalle ya empieza con el identificador, no lo repite",
    YA_COPIADO, detalleCompleto(CUOTA_SEP, TPL_UATRE, YA_COPIADO),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, YA_COPIADO) === YA_COPIADO, "A-FEAT-137")

  // ── El reparto de las 543 filas viejas (A-DAT-37) ────────────────────────────────────────
  chequear("Identificador cuota", "La etiqueta generada se reconoce (se puede vaciar)",
    "es identificador", esElIdentificadorGenerado("UATRE MSA - Septiembre 2026", CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado("UATRE MSA - Septiembre 2026", CUOTA_SEP, TPL_UATRE) === true, "A-DAT-37")

  chequear("Identificador cuota", "🔴 El texto libre NO se confunde con identificador (no se borra)",
    "es del usuario", esElIdentificadorGenerado(LIBRE, CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado(LIBRE, CUOTA_SEP, TPL_UATRE) === false, "A-DAT-37")

  // ⚠️ El sesgo: ante la duda, «es del usuario». Una etiqueta de OTRO período no es la de esta
  //    cuota, así que no se toca — equivocarse hacia acá deja texto redundante; hacia el otro lado
  //    borra algo que escribió una persona.
  chequear("Identificador cuota", "⚠️ Una etiqueta de otro período NO se da por generada",
    "es del usuario", esElIdentificadorGenerado("UATRE MSA - Marzo 2025", CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado("UATRE MSA - Marzo 2025", CUOTA_SEP, TPL_UATRE) === false, "A-DAT-37")


  // ══ La etiqueta del monto en la propuesta de conciliación (A-BUG-169) ═════════════════════
  //
  // 🏷️ *«Es raro que me dé tantas cosas erróneas»* (usuario, 2026-09-13). El caso real: conciliando
  // un pago de I.C.T. NET de **$35.497,81**, la app ofrecía `BAILO ANDRES` por **$35.500,00** con el
  // cartel **«Monto exacto»**. Difería $2,19.
  //
  // 🔴 **Este caso falla con el código viejo**: la condición era `matchMontoCercano || diffAbs <= 2`,
  // y `matchMontoCercano` es ±5% — o sea que decía «exacto» hasta con $1.700 de diferencia.
  chequear("Etiqueta monto", "🔴 $35.497,81 contra $35.500,00 NO es exacto — dice cuánto se aparta",
    "≈ $2,19", etiquetaMonto(35497.81, 35500).texto,
    etiquetaMonto(35497.81, 35500).texto === "≈ $2,19", "A-BUG-169")

  chequear("Etiqueta monto", "Exacto es diferencia CERO",
    "Monto exacto", etiquetaMonto(35497.81, 35497.81).texto,
    etiquetaMonto(35497.81, 35497.81).exacto === true, "A-BUG-169")

  // Con importes grandes el peso no dice nada y el porcentaje sí: $40.000 sobre 2 M es 2%.
  chequear("Etiqueta monto", "Diferencias grandes se muestran en PORCENTAJE",
    "≈ 2%", etiquetaMonto(2000000, 2040000).texto,
    etiquetaMonto(2000000, 2040000).texto === "≈ 2%", "A-BUG-169")

  // Y al revés: con importes chicos el porcentaje engaña ($18 sobre $600 «suena» a 3%).
  chequear("Etiqueta monto", "…y las chicas en PESOS",
    "≈ $18,00", etiquetaMonto(600, 618).texto,
    etiquetaMonto(600, 618).texto === "≈ $18,00", "A-BUG-169")

  // ⚠️ Un centavo NO es exacto. Es el borde que más tienta redondear, y el que más caro sale:
  //    si un centavo pasa por exacto, la diferencia se pierde y reaparece en un arqueo.
  chequear("Etiqueta monto", "⚠️ Un centavo de diferencia NO es exacto",
    "≈ $0,01", etiquetaMonto(1000, 1000.01).texto,
    etiquetaMonto(1000, 1000.01).exacto === false, "A-BUG-169")


  // ══ La cuenta corriente de una contraparte (A-FEAT-141) ══════════════════════════════════
  //
  // 🧾 Los datos son los REALES de I.C.T. NET de febrero a abril de 2026, que es el tramo donde
  // pasa todo: un pago que no corresponde a ninguna factura, y su descuento un mes después.
  const FC_ICT = [
    { id: "f1", fecha: "2026-02-01", numero: "FC - 10558", total: 22094.30, tipo: "compra" as const },
    { id: "f2", fecha: "2026-03-01", numero: "FC - 10661", total: 22800.01, tipo: "compra" as const },
    { id: "f3", fecha: "2026-04-01", numero: "FC - 10762", total: 28602.99, tipo: "compra" as const },
  ]
  const PG_ICT = [
    { id: "p1", fecha: "2026-02-11", monto: 22094.30, comprobantes_pagados: "FC - 10558" },
    { id: "p2", fecha: "2026-03-10", monto: 22800.01, comprobantes_pagados: "FC - 10661" },
    // 🔴 El pago sin referencia: cubre comprobantes que el proveedor reclamaba y no están cargados.
    { id: "p3", fecha: "2026-03-13", monto: 35497.81, detalle: "Pago ICT Net Octubre y abril que ya estaban pagos" },
    { id: "p4", fecha: "2026-04-10", monto: 8990.21, comprobantes_pagados: "FC - 10762" },
  ]
  const cc = armarCuentaCorriente(FC_ICT, PG_ICT)

  // 🔑 El número que hoy no se puede ver en ninguna pantalla y hay que reconstruir a mano.
  chequear("Cuenta corriente", "🔑 El saldo a favor de ICT NET sale solo",
    "-15.885,03", cc.saldo.toFixed(2),
    cc.saldo === -15885.03, "A-FEAT-141")

  chequear("Cuenta corriente", "…y se lee sin interpretar el signo",
    "Saldo a favor $15.885,03", leyendaSaldo(cc.saldo),
    leyendaSaldo(cc.saldo) === "Saldo a favor $15.885,03", "A-FEAT-141")

  chequear("Cuenta corriente", "Los totales cierran contra el detalle",
    "comprado 73.497,30 · pagado 89.382,33",
    `comprado ${cc.totalComprado.toFixed(2)} · pagado ${cc.totalPagado.toFixed(2)}`,
    cc.totalComprado === 73497.30 && cc.totalPagado === 89382.33, "A-FEAT-141")

  // 🔴 La señal a mirar: el pago que no dice contra qué fue es el que genera el saldo sin avisar.
  chequear("Cuenta corriente", "🔴 Marca el pago que no dice contra qué comprobante fue",
    "1 sin referencia", `${cc.pagosSinReferencia} sin referencia`,
    cc.pagosSinReferencia === 1, "A-FEAT-141")

  // A igual fecha, primero la factura y después el pago: si no, el saldo intermedio muestra un
  // negativo que nunca existió y la columna se vuelve imposible de leer.
  const mismoDia = armarCuentaCorriente(
    [{ id: "f", fecha: "2026-05-01", numero: "FC - 1", total: 1000, tipo: "compra" }],
    [{ id: "p", fecha: "2026-05-01", monto: 1000, comprobantes_pagados: "FC - 1" }])
  chequear("Cuenta corriente", "A igual fecha, primero la factura y después el pago",
    "compra, pago", mismoDia.asientos.map(a => a.tipo).join(", "),
    mismoDia.asientos[0].tipo === "compra" && mismoDia.asientos[1].saldo === 0, "A-FEAT-141")

  // 🤝 El caso proveedor-CLIENTE (AFA): una factura de venta COMPENSA. Con dos saldos separados
  //    esa compensación no se ve; con uno solo, sí — y es el canal de pago de A-FEAT-140.
  const afa = armarCuentaCorriente(
    [{ id: "c", fecha: "2026-05-01", numero: "FC compra", total: 100000, tipo: "compra" },
     { id: "v", fecha: "2026-05-02", numero: "FC venta",  total: 40000,  tipo: "venta" }], [])
  chequear("Cuenta corriente", "🤝 Una factura de VENTA compensa lo que le debo (caso AFA)",
    "Le debo $60.000,00", leyendaSaldo(afa.saldo),
    afa.saldo === 60000, "A-FEAT-141")

  // ⚠️ Sin fecha no se descarta: si se escondiera, el saldo dejaría de cerrar contra el detalle.
  const sinFecha = armarCuentaCorriente(
    [{ id: "x", fecha: null, numero: "FC sin fecha", total: 500, tipo: "compra" }], [])
  chequear("Cuenta corriente", "⚠️ Un comprobante sin fecha entra igual (no se descarta plata)",
    "1 asiento · saldo 500", `${sinFecha.asientos.length} asiento · saldo ${sinFecha.saldo}`,
    sinFecha.asientos.length === 1 && sinFecha.saldo === 500, "A-FEAT-141")


  // ══ 🧪 EL AUDIT DE CONSISTENCIA (A-FEAT-145) ══════════════════════════════════════════════════
  // Los datos de abajo son los CASOS REALES que se midieron el 2026-09-13 al escribir la
  // expectativa (§ 30.9.7), reducidos a una fila cada uno. Los números esperados salen de ahí.

  const movAudBase = {
    cuenta: "MSA Galicia", fecha: "2026-04-06", descripcion: "Trf Inmed Proveed",
    debitos: 84000, creditos: 0, estado: "conciliado",
    categ: "GASTOS VARIOS GANADERIA", nro_cuenta: null, proveedor_nombre: "Alguien",
    comprobantes_pagados: "FC - 1", detalle: null,
    comprobante_arca_id: null, template_cuota_id: null, sueldo_pago_id: null, anticipo_id: null,
  }
  const movAud = (id: string, over: Partial<MovAuditable>): MovAuditable =>
    ({ ...movAudBase, id, ...over } as MovAuditable)

  const PLAN = new Set(["GASTOS VARIOS GANADERIA"])

  // 🔑 LA EXCEPCIÓN QUE SE DESCUBRIÓ AL MEDIR: 7 de los 8 casos con dos vínculos eran
  //    ARCA + anticipo, que es el cierre normal del circuito. Sin esto el control da 7 falsos
  //    positivos — y la primera versión de § 30.9.6 lo daba.
  chequear("Audit", "🔑 ARCA + anticipo NO es error: es el cierre normal de un anticipo",
    "legítimo", vinculoDobleEsLegitimo(["ARCA", "anticipo"]) ? "legítimo" : "reportado como error",
    vinculoDobleEsLegitimo(["ARCA", "anticipo"]) === true, "A-FEAT-145")

  chequear("Audit", "Template + sueldo a la vez SÍ es error (el caso real del 06/04)",
    "error", vinculoDobleEsLegitimo(["template", "sueldo"]) ? "legítimo" : "error",
    vinculoDobleEsLegitimo(["template", "sueldo"]) === false, "A-DAT-44")

  // Un pago que canceló una factura usando un anticipo ES de ARCA para el estándar: lleva
  // número de cuenta, y el anticipo ya dejó de ser un destino.
  chequear("Audit", "Con ARCA + anticipo, el origen que manda es ARCA",
    "ARCA", origenDe(movAud("x", { comprobante_arca_id: "a", anticipo_id: "b" })),
    origenDe(movAud("x", { comprobante_arca_id: "a", anticipo_id: "b" })) === "ARCA", "A-FEAT-145")

  // ── Los TRES destinos del detalle repetido ────────────────────────────────────────────────
  // Tratarlos igual destruye dato: es la razón por la que el audit propone y no aplica.
  const ruido = movAud("d1", { proveedor_nombre: "GOROSITO OLGA MARIA", detalle: "GOROSITO OLGA MARIA" })
  chequear("Audit", "Detalle = proveedor y nada más → se VACÍA",
    "vaciar", String(destinoDelDetalle(ruido)), destinoDelDetalle(ruido) === "vaciar", "A-DAT-46")

  const conAporte = movAud("d2", {
    proveedor_nombre: "AGRICOLA HERMANOS CATTANEO",
    comprobantes_pagados: "FC - 236",
    detalle: "Factura 1-236 - AGRICOLA HERMANOS CATTANEO | Anticipo $712.560,9 (28/2/2026)",
  })
  chequear("Audit", "Repite pero el anticipo SÍ aporta → se RECORTA, no se vacía",
    "recortar", String(destinoDelDetalle(conAporte)),
    destinoDelDetalle(conAporte) === "recortar", "A-DAT-46")

  // 🔴 El caso que un vaciado masivo destruiría: el comprobante está VACÍO y el detalle guarda
  //    las 6 facturas de Alcorta. Es el único lugar donde ese dato existe.
  const enLaColumnaEquivocada = movAud("d3", {
    proveedor_nombre: "ALCORTA EDMUNDO ERNESTO",
    comprobantes_pagados: null,
    detalle: "Factura 1-5943 - ALCORTA EDMUNDO ERNESTO · Factura 1-5930 - ALCORTA EDMUNDO ERNESTO",
  })
  chequear("Audit", "🔴 El comprobante está vacío y el detalle lo guarda → se MUEVE, no se borra",
    "mover", String(destinoDelDetalle(enLaColumnaEquivocada)),
    destinoDelDetalle(enLaColumnaEquivocada) === "mover", "A-DAT-46")

  const detallePropio = movAud("d4", { proveedor_nombre: "Ruben Sigot", detalle: "Santander | Galicia" })
  chequear("Audit", "Un detalle que NO repite nada no se toca",
    "sin hallazgo", String(destinoDelDetalle(detallePropio)),
    destinoDelDetalle(detallePropio) === null, "A-DAT-46")

  // ── El alcance: a un PENDIENTE no se le exige nada ────────────────────────────────────────
  // Es la decisión que evita 822 falsos positivos sobre 1.498 filas.
  const soloPendientes = auditar({
    movimientos: [movAud("p1", { estado: "pendiente", proveedor_nombre: null, comprobantes_pagados: null, categ: "INVENTADA" })],
    categsDelPlan: PLAN,
  })
  chequear("Audit", "🔑 A un movimiento PENDIENTE no se le exige el estándar",
    "0 hallazgos · 0 auditados", `${soloPendientes.grupos.length} hallazgos · ${soloPendientes.auditados} auditados`,
    soloPendientes.grupos.length === 0 && soloPendientes.auditados === 0 && soloPendientes.universo === 1,
    "A-FEAT-145")

  // ── La imputación, que es donde estaban las dos falsas alarmas ────────────────────────────
  const arcaSinNro = movAud("i1", { comprobante_arca_id: "f1" })
  const tplConNro = movAud("i2", { template_cuota_id: "c1", nro_cuenta: "1.1.1" })
  const tplSinNro = movAud("i3", { template_cuota_id: "c2" })
  const impu = auditar({ movimientos: [arcaSinNro, tplConNro, tplSinNro], categsDelPlan: PLAN })
  const gImp = impu.grupos.find(g => g.control === "imputacion")
  chequear("Audit", "🚩 Sólo ARCA lleva número de cuenta: el template SIN número está BIEN",
    "2 casos (ARCA sin, template con)", `${gImp?.total ?? 0} casos`,
    gImp?.total === 2, "A-DAT-45")

  // ── Agrupar por CAUSA: 152 movimientos son 18 altas, no 152 arreglos ──────────────────────
  const mismaCateg = ["c1", "c2", "c3"].map(id => movAud(id, { categ: "Sueldos", sueldo_pago_id: "s" }))
  const agrup = auditar({ movimientos: mismaCateg, categsDelPlan: PLAN })
  const gCateg = agrup.grupos.find(g => g.control === "categ-fuera-plan")
  chequear("Audit", "📌 3 movimientos con la MISMA categoría faltante = 1 sola causa",
    "3 movimientos · 1 causa", `${gCateg?.total} movimientos · ${gCateg?.causas.length} causa`,
    gCateg?.total === 3 && gCateg?.causas.length === 1, "A-FEAT-145")

  // ── Lo que no se pudo verificar se DICE, no se descarta en silencio ───────────────────────
  const sinCuotas = auditar({ movimientos: [movAud("z", { template_cuota_id: "c" })], categsDelPlan: PLAN })
  // Se pregunta por EL aviso que interesa, no por cuántos hay: contar el total hace que el caso
  // se rompa cada vez que se agrega un control, sin que nada esté mal.
  chequear("Audit", "⚠️ Sin las cuotas cargadas, la cuadratura se informa como NO verificada",
    "avisa", sinCuotas.noVerificado.some(n => n.includes("Cuadratura")) ? "avisa" : "no avisa",
    sinCuotas.noVerificado.some(n => n.includes("Cuadratura")), "A-FEAT-145")

  const cuadra = auditar({
    movimientos: [movAud("q", { template_cuota_id: "c", debitos: 1042045.82 })],
    categsDelPlan: PLAN,
    cuadratura: [{ movimientoId: "q", importeBanco: 1042045.82, importeOrigen: 60178.94 }],
  })
  chequear("Audit", "🧮 El pago agrupado contra UNA cuota: el banco no cuadra con el origen",
    "1 hallazgo de cuadratura", `${cuadra.grupos.find(g => g.control === "cuadratura")?.total ?? 0} hallazgo de cuadratura`,
    cuadra.grupos.find(g => g.control === "cuadratura")?.total === 1, "A-FEAT-142")

  // ── El hueco que está en el ORIGEN, no en el movimiento ───────────────────────────────────
  const tplSinProv = auditar({
    movimientos: [movAud("o", { template_cuota_id: "c", proveedor_nombre: null })],
    categsDelPlan: PLAN,
  })
  const gProv = tplSinProv.grupos.find(g => g.control === "sin-proveedor")
  chequear("Audit", "🔑 Un template sin proveedor se arregla en el TEMPLATE, no en el movimiento",
    "marcado en el origen", gProv?.enElOrigen === 1 ? "marcado en el origen" : "mandado a corregir el extracto",
    gProv?.enElOrigen === 1, "A-DAT-41")

  // ── El más grave: el estado dice conciliado y no hay obligación del otro lado ──────────────
  const huerfano = auditar({
    movimientos: [movAud("h", { proveedor_nombre: null, comprobantes_pagados: null })],
    categsDelPlan: PLAN,
  })
  chequear("Audit", "🔴 Conciliado sin ningún vínculo: el estado miente",
    "1 sin vínculo", `${huerfano.grupos.find(g => g.control === "sin-vinculo")?.total ?? 0} sin vínculo`,
    huerfano.grupos.find(g => g.control === "sin-vinculo")?.total === 1, "A-DAT-43")

  // Un comprobante sin número ni período no identifica CUÁL obligación — es el caso
  // "Haberes" a secas que el usuario marcó con una nota desde la app.
  chequear("Audit", "«Haberes» a secas no identifica cuál obligación; «Haberes May 2026» sí",
    "no · sí",
    `${comprobanteIdentifica("Haberes") ? "sí" : "no"} · ${comprobanteIdentifica("Haberes May 2026") ? "sí" : "no"}`,
    !comprobanteIdentifica("Haberes") && comprobanteIdentifica("Haberes May 2026"), "A-BUG-171")

  // ── 🕳️ LOS CONTROLES DEL ORIGEN (A-BUG-172) ───────────────────────────────────────────────
  // El audit nacio caminando el extracto y midio 8 donde habia 141: las facturas cuyo movimiento
  // todavia no esta conciliado no las delata ninguna linea del banco.
  const origenes: EntidadOrigen[] = [
    { tipo: "template", id: "t1", nombre: "Debitos / Creditos", nombre_quien_cobra: null,
      proveedor: "Banco Galicia", movimientosQueDependen: 46 },
    { tipo: "template", id: "t2", nombre: "Otros Gastos", nombre_quien_cobra: null,
      proveedor: null, movimientosQueDependen: 2 },
    { tipo: "factura", id: "f1", nombre: "GROSCAN — 43-10707",
      cuenta_contable: "COMBUSTIBLES Y LUBRICANTES", nro_cuenta: null },
    { tipo: "factura", id: "f2", nombre: "GOROSITO — 3-4230", cuenta_contable: null, nro_cuenta: null },
    { tipo: "factura", id: "f3", nombre: "OK — 1-1", cuenta_contable: "LUZ", nro_cuenta: "422118" },
  ]
  const conOrigen = auditar({ movimientos: [], categsDelPlan: PLAN, origenes })

  // 🔑 El template que tiene el dato en `proveedor` y no en `nombre_quien_cobra` NO es un hueco:
  //    el dato esta, solo que en la otra columna. Son los 125 movimientos de Banco Galicia.
  chequear("Audit", "🔑 Un template con el proveedor cargado (aunque sea en la otra columna) no es hueco",
    "1 template sin quien cobra",
    `${conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")?.total ?? 0} template sin quien cobra`,
    conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")?.total === 1,
    "A-BUG-172")

  chequear("Audit", "🕳️ La factura con el NOMBRE de la cuenta y sin numero se cuenta aparte",
    "1 · 1",
    `${conOrigen.grupos.find(g => g.control === "origen-factura-sin-numero")?.total ?? 0} · ${conOrigen.grupos.find(g => g.control === "origen-factura-sin-cuenta")?.total ?? 0}`,
    conOrigen.grupos.find(g => g.control === "origen-factura-sin-numero")?.total === 1
      && conOrigen.grupos.find(g => g.control === "origen-factura-sin-cuenta")?.total === 1,
    "A-DAT-48")

  // El trabajo se ordena por impacto: 46 movimientos dependen de UNA fila de template.
  const hOrigen = conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")
  chequear("Audit", "El hallazgo del origen dice cuantos movimientos dependen de esa fila",
    "2", String(hOrigen?.causas[0]?.ejemplos[0]?.dependen ?? 0),
    hOrigen?.causas[0]?.ejemplos[0]?.dependen === 2, "A-BUG-172")

  // ⚠️ Y si no se cargan los origenes NO se dan por buenos: se informa que no se verificaron.
  const sinOrigenes = auditar({ movimientos: [], categsDelPlan: PLAN })
  chequear("Audit", "⚠️ Sin las filas de origen, los controles del origen se informan NO verificados",
    "avisa", sinOrigenes.noVerificado.some(n => n.includes("ORIGEN")) ? "avisa" : "los da por buenos",
    sinOrigenes.noVerificado.some(n => n.includes("ORIGEN")), "A-BUG-172")

  // 🧨 Los hallazgos del ORIGEN no son movimientos: contarlos como tales daba «-18 de 676 cumplen».
  const mixto = auditar({
    movimientos: [movAud("lim", { template_cuota_id: "c", comprobantes_pagados: "FC - 9" })],
    categsDelPlan: PLAN,
    origenes: [{ tipo: "factura", id: "fx", nombre: "X", cuenta_contable: null, nro_cuenta: null }],
  })
  chequear("Audit", "🧨 Un hallazgo del ORIGEN no descuenta movimientos limpios",
    "1 limpio de 1", `${mixto.limpios} limpio de ${mixto.auditados}`,
    mixto.limpios === 1 && mixto.auditados === 1, "A-BUG-172")

  // ══ 📄 EL CUADRO 1 DEL DETALLE DE PAGO (A-BUG-173) ═══════════════════════════════════════════
  // Los datos son el pago REAL a Alcorta del 10/09/2026, que esta frenado por este bug.
  const ALCORTA_DP = "ALCORTA EDMUNDO ERNESTO"
  const itemsAlcorta = [
    { comprobante: "FC 6347 - ALCORTA EDMUNDO ERNESTO | FC 6328 - ALCORTA EDMUNDO ERNESTO | FC 6337 - ALCORTA EDMUNDO ERNESTO",
      fecha: "10/09/2026", imp_total: 385093.90, descuento_aplicado: 19254.70,
      facturas: [
        { comprobante: "FC 6347 - ALCORTA EDMUNDO ERNESTO", imp_total: 179325.15, descuento_aplicado: 19254.70 },
        { comprobante: "FC 6328 - ALCORTA EDMUNDO ERNESTO", imp_total: 102884.37 },
        { comprobante: "FC 6337 - ALCORTA EDMUNDO ERNESTO", imp_total: 102884.38 },
      ] },
    { comprobante: "FC 2752 - ALCORTA EDMUNDO ERNESTO", fecha: "15/09/2026", imp_total: 1690975.00 },
  ]
  const lineasAlc = lineasDelDetalle(itemsAlcorta, ALCORTA_DP)

  chequear("Detalle de pago", "📄 El grupo de 3 facturas se abre en 3 lineas (antes era 1 sola)",
    "4 lineas", `${lineasAlc.length} lineas`, lineasAlc.length === 4, "A-BUG-173")

  chequear("Detalle de pago", "🏷️ No repite el proveedor: ya esta en el encabezado",
    "FC 6347", lineasAlc[0].comprobante, lineasAlc[0].comprobante === "FC 6347", "A-BUG-173")

  // El descuento SI viaja por factura: es lineal y es condicion comercial de ese comprobante.
  chequear("Detalle de pago", "⚖️ El descuento queda en SU factura, no repartido",
    "19254.7 en la 6347 · 0 en la 6328",
    `${lineasAlc[0].descuento} en la 6347 · ${lineasAlc[1].descuento} en la 6328`,
    lineasAlc[0].descuento === 19254.70 && lineasAlc[1].descuento === 0, "A-BUG-173")

  // 🛑 INTEGRIDAD: las lineas suman el total que el propio comprobante imprime.
  const okAlc = controlarDetalle(lineasAlc,
    { bruto: 2076068.90, descuento: 19254.70, pagado: 2027297.27, retencion: 29516.93 })
  chequear("Detalle de pago", "🧮 El pago real de Alcorta cierra: 4 lineas = $2.076.068,90",
    "sin errores, se emite", `${okAlc.errores.length} errores, ${okAlc.puedeEmitirse ? "se emite" : "NO se emite"}`,
    okAlc.errores.length === 0 && okAlc.puedeEmitirse === true, "A-BUG-173")

  // 🛑 Si al desagregar se pierde plata, el documento se contradice: FRENA.
  const rotas = lineasDelDetalle([{ ...itemsAlcorta[0], facturas: itemsAlcorta[0].facturas!.slice(0, 2) }], ALCORTA_DP)
  const mal = controlarDetalle(rotas, { bruto: 385093.90, descuento: 19254.70, pagado: 0, retencion: 0 })
  chequear("Detalle de pago", "🛑 INTEGRIDAD: si las lineas no suman su propio total, NO se emite",
    "NO se emite", mal.puedeEmitirse ? "se emite igual" : "NO se emite",
    mal.puedeEmitirse === false && mal.errores.length > 0, "A-BUG-173")

  // ⚠️ Pero un pago PARCIAL no es un bug: el usuario puede pagar de menos. Avisa y deja seguir.
  //    «me debe advertir si no da el control, pero es posible que yo tenga que pagar mas o menos»
  const parcial = controlarDetalle(lineasAlc,
    { bruto: 2076068.90, descuento: 19254.70, pagado: 1000000, retencion: 0 })
  chequear("Detalle de pago", "⚠️ Un pago PARCIAL avisa pero NO frena (lo decide el usuario)",
    "avisa y se emite",
    `${parcial.avisos.length > 0 ? "avisa" : "no avisa"} y ${parcial.puedeEmitirse ? "se emite" : "NO se emite"}`,
    parcial.avisos.length === 1 && parcial.puedeEmitirse === true, "A-BUG-173")

  chequear("Detalle de pago", "⚠️ Pagar de MAS tambien avisa sin frenar",
    "avisa y se emite",
    (() => { const r = controlarDetalle(lineasAlc, { bruto: 2076068.90, descuento: 19254.70, pagado: 3000000, retencion: 0 })
             return `${r.avisos.length > 0 ? "avisa" : "no avisa"} y ${r.puedeEmitirse ? "se emite" : "NO se emite"}` })(),
    controlarDetalle(lineasAlc, { bruto: 2076068.90, descuento: 19254.70, pagado: 3000000, retencion: 0 }).puedeEmitirse === true,
    "A-BUG-173")

  // Si sacar el proveedor dejaria el renglon vacio, se devuelve entero: perderlo es peor que repetir.
  chequear("Detalle de pago", "Si al sacar el proveedor no queda nada, se deja la etiqueta entera",
    ALCORTA_DP, sinElProveedor(ALCORTA_DP, ALCORTA_DP), sinElProveedor(ALCORTA_DP, ALCORTA_DP) === ALCORTA_DP, "A-BUG-173")

  // Una factura suelta (sin grupo) sigue funcionando igual: los otros llamadores no se tocan.
  chequear("Detalle de pago", "Una factura suelta sin grupo sigue dando 1 linea",
    "1 · FC 2752", `${lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP).length} · ${lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP)[0].comprobante}`,
    lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP)[0].comprobante === "FC 2752", "A-BUG-173")

  // 🐞 Las del grupo se leen crudas de la base (ISO) y la suelta llega formateada: misma columna,
  //    dos formatos. Lo vio el usuario en el PDF de Alcorta.
  const fechasMixtas = lineasDelDetalle([
    { comprobante: "FC 6337", imp_total: 100, facturas: [{ comprobante: "FC 6337", fecha: "2026-08-28", imp_total: 100 }] },
    { comprobante: "FC 2752", fecha: "15/09/2026", imp_total: 200 },
  ], ALCORTA_DP)
  chequear("Detalle de pago", "🐞 Las fechas salen todas en dd/mm/aaaa, vengan de donde vengan",
    "28/08/2026 · 15/09/2026", `${fechasMixtas[0].fecha} · ${fechasMixtas[1].fecha}`,
    fechasMixtas[0].fecha === "28/08/2026" && fechasMixtas[1].fecha === "15/09/2026", "A-BUG-173")

  // ══ 🧲 LO QUE EL MOVIMIENTO HEREDA DEL ORIGEN (A-BUG-175) ════════════════════════════════════
  // Caso real del lote 19-30/06: un impuesto al debito NO trae CUIT en el extracto, asi que el
  // proveedor quedaba vacio aunque el template dijera Banco Galicia.
  const tplBanco = { nombre_referencia: "Debitos / Creditos", responsable: "MSA",
                     nombre_quien_cobra: null, proveedor: "Banco Galicia", centro_costo: null }

  const h1 = heredarDelOrigen({}, tplBanco, "Debitos / Creditos MSA - Junio 2026", null)
  chequear("Herencia del origen", "🧲 El impuesto al debito hereda el proveedor DEL TEMPLATE",
    "Banco Galicia", String(h1.proveedor_nombre), h1.proveedor_nombre === "Banco Galicia", "A-BUG-175")
  chequear("Herencia del origen", "🧾 Y el comprobante con su periodo",
    "Debitos / Creditos MSA - Junio 2026", String(h1.comprobantes_pagados),
    h1.comprobantes_pagados === "Debitos / Creditos MSA - Junio 2026", "A-BUG-175")

  // 🔑 La precedencia que fijo el usuario: el ORIGEN le gana al banco.
  const h2 = heredarDelOrigen({}, tplBanco, null, "OTRO QUE INFORMA EL BANCO")
  chequear("Herencia del origen", "🔑 Si el template tiene proveedor, ese entra — no el del banco",
    "Banco Galicia", String(h2.proveedor_nombre),
    h2.proveedor_nombre === "Banco Galicia" && h2.proveedorVieneDelBanco === false, "A-BUG-175")

  // Recien si el origen no tiene nada, se usa el del banco -- y queda marcado para poder preguntar.
  const h3 = heredarDelOrigen({}, { nombre_referencia: "X", responsable: "MSA" }, null, "PROVEEDOR DEL BANCO")
  chequear("Herencia del origen", "🏦 Sin dato en el origen se usa el del banco, y se MARCA",
    "PROVEEDOR DEL BANCO · marcado", `${h3.proveedor_nombre} · ${h3.proveedorVieneDelBanco ? "marcado" : "sin marcar"}`,
    h3.proveedor_nombre === "PROVEEDOR DEL BANCO" && h3.proveedorVieneDelBanco === true, "A-BUG-175")

  // ⚠️ Lo que el usuario escribio a mano NUNCA se pisa.
  const h4 = heredarDelOrigen({ proveedor_nombre: "LO QUE PUSE YO", comprobantes_pagados: "MI COMPROBANTE" },
    tplBanco, "Debitos / Creditos MSA - Junio 2026", "DEL BANCO")
  chequear("Herencia del origen", "⚠️ Lo escrito a mano nunca se pisa",
    "LO QUE PUSE YO · MI COMPROBANTE", `${h4.proveedor_nombre} · ${h4.comprobantes_pagados}`,
    h4.proveedor_nombre === "LO QUE PUSE YO" && h4.comprobantes_pagados === "MI COMPROBANTE", "A-BUG-175")

  // 📛 nombre_quien_cobra y proveedor son LO MISMO; gana la completa (proveedor esta truncado a 30).
  chequear("Herencia del origen", "📛 Gana `nombre_quien_cobra`: `proveedor` viene truncado a 30",
    "Consorcio De Propietarios Posadas",
    String(proveedorDelTemplate({ nombre_quien_cobra: "Consorcio De Propietarios Posadas",
                                  proveedor: "Consorcio De Propietarios Posa" })),
    proveedorDelTemplate({ nombre_quien_cobra: "Consorcio De Propietarios Posadas",
                           proveedor: "Consorcio De Propietarios Posa" }) === "Consorcio De Propietarios Posadas",
    "A-BUG-175")

  // 🏷️ El centro de costo tambien baja del template (A-FEAT-153).
  const h5 = heredarDelOrigen({}, { ...tplBanco, centro_costo: "Estructura" }, null, null)
  chequear("Herencia del origen", "🏷️ El centro de costo tambien se hereda del template",
    "Estructura", String(h5.centro_de_costo), h5.centro_de_costo === "Estructura", "A-FEAT-153")

  // 🪪 A-FEAT-154 — el CUIT del banco contra el del origen.
  chequear("Herencia del origen", "🪪 CUITs distintos → se marca para auditar",
    "discrepa", cuitsDiscrepan("20334997651", "30617786016") ? "discrepa" : "no opina",
    cuitsDiscrepan("20334997651", "30617786016") === true, "A-FEAT-154")

  // 🔑 La mitad que lo hace usable: un impuesto al debito no trae CUIT, y no debe ir a auditar.
  chequear("Herencia del origen", "🔑 Campo en blanco NO opina (si no, medio lote va a auditar)",
    "no opina · no opina",
    `${cuitsDiscrepan("", "30617786016") ? "discrepa" : "no opina"} · ${cuitsDiscrepan("20334997651", null) ? "discrepa" : "no opina"}`,
    cuitsDiscrepan("", "30617786016") === false && cuitsDiscrepan("20334997651", null) === false, "A-FEAT-154")

  chequear("Herencia del origen", "El mismo CUIT con guiones no discrepa",
    "no opina", cuitsDiscrepan("30-61778601-6", "30617786016") ? "discrepa" : "no opina",
    cuitsDiscrepan("30-61778601-6", "30617786016") === false, "A-FEAT-154")

  // ══ 👥 EL REPARTO DE UN PAGO A VARIOS BENEFICIARIOS (A-FEAT-155) ═════════════════════════════
  // El caso real: el banco agrupo $2.699.370 de haberes en un solo movimiento.
  chequear("Reparto de grupo", "Escala corta: redondeo a 100K, M y K",
    "1,6M · 1,1M · 600K · 100K · <100K",
    [1612477, 1086893, 588333, 125000, 40000].map(montoCorto).join(" · "),
    [1612477, 1086893, 588333, 125000, 40000].map(montoCorto).join(" · ") === "1,6M · 1,1M · 600K · 100K · <100K",
    "A-FEAT-155")

  chequear("Reparto de grupo", "Sin decimal cuando el millon es redondo",
    "2M", montoCorto(2000000), montoCorto(2000000) === "2M", "A-FEAT-155")

  // 🔑 Sigot aparece DOS veces en el pago real: se suma por nombre, no se lista dos veces.
  const repartoReal = repartoDelGrupo([
    { nombre: "Ruben Sigot", monto: 1487477 },
    { nombre: "Wilson Barreto", monto: 1086893 },
    { nombre: "Ruben Sigot", monto: 125000 },
  ])
  chequear("Reparto de grupo", "🔑 El mismo beneficiario se SUMA, no se lista dos veces",
    "Ruben Sigot 1,6M + Wilson Barreto 1,1M", repartoReal,
    repartoReal === "Ruben Sigot 1,6M + Wilson Barreto 1,1M", "A-FEAT-155")

  // Con uno solo no se repite el importe: ya es el del movimiento.
  chequear("Reparto de grupo", "Con un solo beneficiario va el nombre sin importe",
    "Ruben Sigot", repartoDelGrupo([{ nombre: "Ruben Sigot", monto: 1487477 }]),
    repartoDelGrupo([{ nombre: "Ruben Sigot", monto: 1487477 }]) === "Ruben Sigot", "A-FEAT-155")

  // ══ 🛠️ EL AUDIT QUE PROPONE LA CORRECCION (A-FEAT-159) ═══════════════════════════════════════
  const hallC = (over: any) => ({
    control: "sin-proveedor", movimientoId: "m1", cuenta: "MSA Galicia", fecha: "2026-06-30",
    descripcion: "Imp. Deb.", importe: 894, origen: "template" as const,
    problema: "", causa: "", ...over,
  })

  // ✅ Corregible: el dato existe en el origen, solo hay que copiarlo.
  const c1 = corregir(hallC({ causa: "El dato sale del template" }), { proveedorDelOrigen: "Banco Galicia" })
  chequear("Audit corrige", "✅ Copia el proveedor que ya dice el origen",
    "Banco Galicia", String(c1?.parche.proveedor_nombre), c1?.parche.proveedor_nombre === "Banco Galicia", "A-FEAT-159")

  // 🛑 Si el origen tampoco lo tiene, NO se ofrece: no hay nada que copiar.
  const c2 = corregir(hallC({ causa: "El dato sale del template" }), {})
  chequear("Audit corrige", "🛑 Si el origen tampoco lo tiene, no se ofrece corregir",
    "sin propuesta", c2 === null ? "sin propuesta" : "propone igual", c2 === null, "A-FEAT-159")

  // 👥 Con varios beneficiarios manda el reparto, no un nombre suelto.
  const c3 = corregir(hallC({ causa: "x" }),
    { proveedorDelOrigen: "Wilson Barreto", repartoDeBeneficiarios: "Ruben Sigot 1,6M + Wilson Barreto 1,1M" })
  chequear("Audit corrige", "👥 Con varios beneficiarios gana el reparto",
    "Ruben Sigot 1,6M + Wilson Barreto 1,1M", String(c3?.parche.proveedor_nombre),
    c3?.parche.proveedor_nombre === "Ruben Sigot 1,6M + Wilson Barreto 1,1M", "A-FEAT-159")

  // 🛑 LA MITAD QUE IMPORTA: de los 3 destinos del detalle, solo el ruidoC puro se corrige solo.
  const ruidoC   = corregir(hallC({ control: "detalle-repite", causa: "Puro ruidoC: se vacía" }), {})
  const recorteC = corregir(hallC({ control: "detalle-repite", causa: "Repite y además aporta algo: se recorta" }), {})
  const moverC   = corregir(hallC({ control: "detalle-repite", causa: "🔴 Guarda lo que falta en el comprobante: se MUEVE, no se borra" }), {})
  chequear("Audit corrige", "🛑 Del detalle solo se vacía el RUIDO PURO; recortar y moverC no se ofrecen",
    "vacía · no · no",
    `${ruidoC ? "vacía" : "no"} · ${recorteC ? "sí" : "no"} · ${moverC ? "sí" : "no"}`,
    ruidoC?.parche.detalle === null && recorteC === null && moverC === null, "A-FEAT-159")

  // La imputación: solo el caso simétrico. El de ARCA sin número es A-DAT-48 y no se toca acá.
  const impuOk = corregir(hallC({ control: "imputacion", causa: "template con número de cuenta" }), {})
  const impuNo = corregir(hallC({ control: "imputacion", causa: "ARCA sin número de cuenta" }), {})
  chequear("Audit corrige", "Vacía el nro de cuenta de un template; el de ARCA sin número no se toca",
    "vacía · no", `${impuOk ? "vacía" : "no"} · ${impuNo ? "sí" : "no"}`,
    impuOk?.parche.nro_cuenta === null && impuNo === null, "A-FEAT-159")

  // 🕳️ Un hallazgo del ORIGEN no se corrige desde el extracto.
  chequear("Audit corrige", "🕳️ Los hallazgos del ORIGEN no se corrigen desde acá",
    "sin propuesta",
    corregir(hallC({ entidad: "template" }), { proveedorDelOrigen: "X" }) === null ? "sin propuesta" : "propone",
    corregir(hallC({ entidad: "template" }), { proveedorDelOrigen: "X" }) === null, "A-FEAT-159")

  // 📌 Se agrupa por CAUSA, que es la unidad con la que el usuario aprueba.
  const gruposC = agruparCorrecciones([
    hallC({ movimientoId: "a", causa: "El dato sale del template" }),
    hallC({ movimientoId: "b", causa: "El dato sale del template" }),
    hallC({ movimientoId: "c", control: "detalle-repite", causa: "Puro ruidoC: se vacía" }),
  ], new Map([
    ["a", { proveedorDelOrigen: "Banco Galicia" }],
    ["b", {}],   // sin dato en el origen → cuenta como manual
    ["c", {}],
  ]))
  chequear("Audit corrige", "📌 Agrupa por causa y separa corregibles de manuales",
    "2 causas · 1 corregible + 1 manual en la primera",
    `${gruposC.length} causas · ${gruposC[0].corregibles} corregible + ${gruposC[0].manuales} manual en la primera`,
    gruposC.length === 2 && gruposC.some(g => g.corregibles === 1 && g.manuales === 1), "A-FEAT-159")

  // ══ 🎯 MATCH POR IMPORTE EXACTO FUERA DE TOLERANCIA (A-FEAT-158) ═════════════════════════════
  // El caso real: movimiento del 29/06 por $1.465.100 y la factura de CACERES por el mismo importe
  // con fecha_estimada 11/07 -- 12 dias, y la tolerancia del motor es 5.
  const movCaceres = { debitos: 1465100, creditos: 0, fecha: "2026-06-29" }
  const poolCaceres = [{ id: "fc-caceres", debitos: 1465100, fecha_estimada: "2026-07-11" }]

  const mC = matchPorImporteExacto(movCaceres, poolCaceres)
  chequear("Match por importe", "🎯 El caso Caceres: importe exacto a 12 dias, se propone",
    "fc-caceres a 12 dias", `${mC?.candidato.id} a ${mC?.dias} dias`,
    mC?.candidato.id === "fc-caceres" && mC?.dias === 12, "A-FEAT-158")

  // 🛑 Con DOS del mismo importe no se elige: adivinar hace dano en silencio.
  const mDos = matchPorImporteExacto(movCaceres, [
    { id: "a", debitos: 1465100, fecha_estimada: "2026-07-11" },
    { id: "b", debitos: 1465100, fecha_estimada: "2026-07-20" },
  ])
  chequear("Match por importe", "🛑 Con DOS candidatos del mismo importe no se propone ninguno",
    "sin propuesta", mDos === null ? "sin propuesta" : "elige uno", mDos === null, "A-FEAT-158")

  // Lo que cae dentro de la tolerancia normal ya lo probo el motor: no se repite.
  chequear("Match por importe", "Lo que esta dentro de los 5 dias no se vuelve a proponer",
    "sin propuesta",
    matchPorImporteExacto(movCaceres, [{ id: "x", debitos: 1465100, fecha_estimada: "2026-07-01" }]) === null
      ? "sin propuesta" : "propone",
    matchPorImporteExacto(movCaceres, [{ id: "x", debitos: 1465100, fecha_estimada: "2026-07-01" }]) === null,
    "A-FEAT-158")

  // Mas alla de 45 dias un importe igual es probablemente coincidencia.
  chequear("Match por importe", "Mas alla de 45 dias no se propone",
    "sin propuesta",
    matchPorImporteExacto(movCaceres, [{ id: "y", debitos: 1465100, fecha_estimada: "2026-09-30" }]) === null
      ? "sin propuesta" : "propone",
    matchPorImporteExacto(movCaceres, [{ id: "y", debitos: 1465100, fecha_estimada: "2026-09-30" }]) === null,
    "A-FEAT-158")

  // Un candidato SIN fecha entra igual: es justo el que nadie encuentra buscando.
  const mSinFecha = matchPorImporteExacto(movCaceres, [{ id: "z", debitos: 1465100, fecha_estimada: null }])
  chequear("Match por importe", "Un candidato sin fecha estimada entra igual",
    "z", String(mSinFecha?.candidato.id), mSinFecha?.candidato.id === "z", "A-FEAT-158")

  // Un importe distinto no entra aunque la fecha sea perfecta.
  chequear("Match por importe", "Importe distinto no entra, por mas que la fecha coincida",
    "sin propuesta",
    matchPorImporteExacto(movCaceres, [{ id: "w", debitos: 1465101, fecha_estimada: "2026-07-11" }]) === null
      ? "sin propuesta" : "propone",
    matchPorImporteExacto(movCaceres, [{ id: "w", debitos: 1465101, fecha_estimada: "2026-07-11" }]) === null,
    "A-FEAT-158")

  // 👥 El caso REAL del usuario: el pago de haberes agrupado quedo con UN solo nombre.
  //    Tiene proveedor, asi que pasa el control de "sin proveedor" -- por eso hace falta este.
  const conUnNombre = auditar({
    movimientos: [movAud("g1", {
      sueldo_pago_id: "sp1", proveedor_nombre: "Wilson Barreto",
      comprobantes_pagados: "Haberes Jun 2026 — a cuenta", categ: "GASTOS VARIOS GANADERIA",
    })],
    categsDelPlan: PLAN,
    repartoEsperado: new Map([["g1", "Ruben Sigot 1,6M + Wilson Barreto 1,1M"]]),
  })
  chequear("Audit", "👥 Un pago agrupado con UN solo nombre se detecta (tiene proveedor igual)",
    "1 hallazgo",
    `${conUnNombre.grupos.find(g => g.control === "proveedor-incompleto")?.total ?? 0} hallazgo`,
    conUnNombre.grupos.find(g => g.control === "proveedor-incompleto")?.total === 1, "A-FEAT-159")

  // Y si ya nombra a todos, no molesta.
  const yaCompleto = auditar({
    movimientos: [movAud("g2", {
      sueldo_pago_id: "sp2", proveedor_nombre: "Ruben Sigot 1,6M + Wilson Barreto 1,1M",
      comprobantes_pagados: "Haberes Jun 2026 — a cuenta", categ: "GASTOS VARIOS GANADERIA",
    })],
    categsDelPlan: PLAN,
    repartoEsperado: new Map([["g2", "Ruben Sigot 1,6M + Wilson Barreto 1,1M"]]),
  })
  chequear("Audit", "Si ya nombra a todos, el control no molesta",
    "0 hallazgos",
    `${yaCompleto.grupos.find(g => g.control === "proveedor-incompleto")?.total ?? 0} hallazgos`,
    (yaCompleto.grupos.find(g => g.control === "proveedor-incompleto")?.total ?? 0) === 0, "A-FEAT-159")

  // ══ 🎭 EL DETALLE QUE PARECE DEL USUARIO PERO LO GENERO UN PROCESO (A-DAT-54) ════════════════
  // 480 de 530 facturas tienen guardado "FC <nro> - <EMISOR>" en su propio campo detalle.
  chequear("Detalle autogenerado", "🎭 Reconoce el patron FC <nro> - <EMISOR>",
    "autogenerado", pareceDetalleAutogenerado("FC 482 - MASSAGLIA ALDO ENRIQUE", "MASSAGLIA ALDO ENRIQUE") ? "autogenerado" : "propio",
    pareceDetalleAutogenerado("FC 482 - MASSAGLIA ALDO ENRIQUE", "MASSAGLIA ALDO ENRIQUE") === true, "A-DAT-54")

  chequear("Detalle autogenerado", "🎭 Tambien con abreviaturas raras (T82)",
    "autogenerado", pareceDetalleAutogenerado("T82 12800 - ESPADA FARALDO MARGARITA MERCEDES", "ESPADA FARALDO MARGARITA MERCEDES") ? "autogenerado" : "propio",
    pareceDetalleAutogenerado("T82 12800 - ESPADA FARALDO MARGARITA MERCEDES", "ESPADA FARALDO MARGARITA MERCEDES") === true, "A-DAT-54")

  // 🛑 LO QUE IMPORTA: si hay texto PROPIO no se toca. Borrar lo que alguien escribio es peor.
  chequear("Detalle autogenerado", "🛑 Un detalle con texto propio NO se marca",
    "propio · propio",
    `${pareceDetalleAutogenerado("Insumos veterinarios de la recria", "MASSAGLIA ALDO ENRIQUE") ? "auto" : "propio"} · ${pareceDetalleAutogenerado("FC 482 - MASSAGLIA ALDO ENRIQUE | Anticipo aplicado", "MASSAGLIA ALDO ENRIQUE") ? "auto" : "propio"}`,
    pareceDetalleAutogenerado("Insumos veterinarios de la recria", "MASSAGLIA ALDO ENRIQUE") === false
      && pareceDetalleAutogenerado("FC 482 - MASSAGLIA ALDO ENRIQUE | Anticipo aplicado", "MASSAGLIA ALDO ENRIQUE") === false,
    "A-DAT-54")

  chequear("Detalle autogenerado", "Sin emisor o sin detalle no opina",
    "no opina",
    pareceDetalleAutogenerado("FC 482 - X", "") || pareceDetalleAutogenerado("", "X") ? "opina" : "no opina",
    pareceDetalleAutogenerado("FC 482 - X", "") === false && pareceDetalleAutogenerado("", "X") === false, "A-DAT-54")

  // ══ 🌾 CUOTAS DE UN CONTRATO DE ARRENDAMIENTO (A-BUG-101) ═══════════════════════════════════
  // Datos: las 3 cuotas reales de MSA Nazarenas 26/27 (Provinvest, 15 qq/ha), escritas acá.
  {
    const NAZ: CuotaGuardada[] = [
      { id: "q1", numero_cuota: 1, qq_ha_cuota: 6, fecha_cobro_estimada: "2026-11-20", posicion_anio: 2026, posicion_mes: 11 },
      { id: "q2", numero_cuota: 2, qq_ha_cuota: 1.5, fecha_cobro_estimada: "2026-11-20", posicion_anio: 2027, posicion_mes: 5 },
      { id: "q3", numero_cuota: 3, qq_ha_cuota: 7.5, fecha_cobro_estimada: "2027-04-20", posicion_anio: 2027, posicion_mes: 5 },
    ]
    const pam = copiarEsquemaCuotas(NAZ, "26/27", "25/26")
    const txt = (fs: FilaCuota[]) => fs.map(f => `${f.qq_ha_cuota}@${f.fecha_cobro}·${f.posicion_mes}/${f.posicion_anio}`).join(" ")

    chequear("Cuotas arrendamiento", "🔑 Copiar Nazarenas 26/27 a PAM 25/26 corre fechas y posición un año atrás",
      "6@2025-11-20·11/2025 1.5@2025-11-20·5/2026 7.5@2026-04-20·5/2026", txt(pam),
      txt(pam) === "6@2025-11-20·11/2025 1.5@2025-11-20·5/2026 7.5@2026-04-20·5/2026", "A-BUG-101")

    // La copia toma lo que dice el CONTRATO, no a dónde movió la cuota el presupuesto.
    const movida: CuotaGuardada[] = [{ ...NAZ[0], fecha_cobro_estimada: "2027-01-15", posicion_mes: 1, posicion_anio: 2027,
      fecha_cobro_original: "2026-11-20", posicion_orig_anio: 2026, posicion_orig_mes: 11 }]
    chequear("Cuotas arrendamiento", "Copiar una cuota movida usa la fecha del contrato, no la movida",
      "6@2026-11-20·11/2026", txt(copiarEsquemaCuotas(movida, "26/27", "26/27")),
      txt(copiarEsquemaCuotas(movida, "26/27", "26/27")) === "6@2026-11-20·11/2026", "A-BUG-101")

    chequear("Cuotas arrendamiento", "Campaña en los formatos que se usan",
      "2025 2025 2025 null", [anioInicioCampania("25/26"), anioInicioCampania("2025/26"),
        anioInicioCampania("2025/2026"), anioInicioCampania("campaña")].join(" "),
      anioInicioCampania("25/26") === 2025 && anioInicioCampania("2025/26") === 2025
        && anioInicioCampania("2025/2026") === 2025 && anioInicioCampania("campaña") === null, "A-BUG-101")

    chequear("Cuotas arrendamiento", "Un 29/02 corrido a un año no bisiesto cae el 28/02",
      "2027-02-28", correrAnios("2028-02-29", -1), correrAnios("2028-02-29", -1) === "2027-02-28", "A-BUG-101")

    // Control: el esquema de 15 qq en un contrato de 15 cierra; en MA Lima (15,5) avisa y no frena.
    const ok15 = validarCuotas(pam, 211.16, 15, {}, [])
    chequear("Cuotas arrendamiento", "✓ PAM: 15 qq/ha en cuotas contra 15 del contrato → ni aviso ni freno",
      "0 frenos · 0 avisos", `${ok15.frenos.length} frenos · ${ok15.avisos.length} avisos`,
      ok15.frenos.length === 0 && ok15.avisos.length === 0, "A-BUG-101")

    const ma = validarCuotas(pam, 85.36, 15.5, {}, [])
    chequear("Cuotas arrendamiento", "MA: suma 15 contra 15,5 del contrato → AVISA y deja guardar",
      "0 frenos · 1 aviso con -0,5", `${ma.frenos.length} frenos · ${ma.avisos.length} aviso · ${ma.avisos[0] ?? ""}`,
      ma.frenos.length === 0 && ma.avisos.length === 1 && ma.avisos[0].includes("-0,5"), "A-BUG-101")

    // 🛑 Borrar una cuota borra sus ventas EN CASCADA en la BD: por eso esto frena.
    const filasNaz = NAZ.map(filaDesdeGuardada)
    const sinQ1 = validarCuotas(filasNaz.slice(1), 144.93, 15, { q1: 50 }, ["q1", "q2", "q3"])
    chequear("Cuotas arrendamiento", "🛑 Borrar una cuota con venta fijada FRENA",
      "1 freno", `${sinQ1.frenos.length} freno(s): ${sinQ1.frenos.join(" | ")}`,
      sinQ1.frenos.length === 1 && sinQ1.frenos[0].includes("borrar"), "A-BUG-101")

    // 144,93 ha × 3 qq / 10 = 43,48 tn, con 50 tn ya vendidas
    const bajo = validarCuotas([{ ...filasNaz[0], qq_ha_cuota: 3 }, ...filasNaz.slice(1)], 144.93, 15, { q1: 50 }, ["q1", "q2", "q3"])
    chequear("Cuotas arrendamiento", "🛑 Bajar una cuota por debajo de lo ya vendido FRENA",
      "1 freno", `${bajo.frenos.length} freno(s)`, bajo.frenos.length === 1 && bajo.frenos[0].includes("vendidas"), "A-BUG-101")

    // Plan de escritura: borrar la 1 renumera las otras; una nueva nace con la original = estimada.
    const plan = planificarCuotas(NAZ, [...filasNaz.slice(1),
      { qq_ha_cuota: 6, fecha_cobro: "2027-07-10", posicion_anio: 2027, posicion_mes: 7 }])
    const planTxt = `borrar ${plan.borrar.join(",")} · renumerar ${plan.actualizar.map(u => `${u.id}→${u.cambios.numero_cuota}`).join(",")}`
      + ` · nueva #${plan.insertar[0]?.numero_cuota} orig ${plan.insertar[0]?.fecha_cobro_original}`
    chequear("Cuotas arrendamiento", "Borrar la cuota 1 renumera 2→1 y 3→2; la nueva es la #3",
      "borrar q1 · renumerar q2→1,q3→2 · nueva #3 orig 2027-07-10", planTxt,
      planTxt === "borrar q1 · renumerar q2→1,q3→2 · nueva #3 orig 2027-07-10", "A-BUG-101")

    // Si el presupuesto había movido la cuota, cambiar el contrato no pisa el movimiento.
    const planMov = planificarCuotas(movida, [{ ...filaDesdeGuardada(movida[0]), fecha_cobro: "2026-12-01", posicion_mes: 12 }])
    const c = planMov.actualizar[0]?.cambios ?? {}
    chequear("Cuotas arrendamiento", "🔑 Editar una cuota MOVIDA cambia lo del contrato y respeta a dónde se movió",
      "original 2026-12-01 · estimada sin tocar", `original ${c.fecha_cobro_original} · estimada ${c.fecha_cobro_estimada ?? "sin tocar"}`,
      c.fecha_cobro_original === "2026-12-01" && c.fecha_cobro_estimada === undefined, "A-BUG-101")

    const planQuieta = planificarCuotas(NAZ.slice(0, 1), [{ ...filasNaz[0], fecha_cobro: "2026-12-01", posicion_mes: 12 }])
    const cq = planQuieta.actualizar[0]?.cambios ?? {}
    chequear("Cuotas arrendamiento", "Editar una cuota NO movida mueve también la estimada",
      "estimada 2026-12-01 · posición 12", `estimada ${cq.fecha_cobro_estimada} · posición ${cq.posicion_mes}`,
      cq.fecha_cobro_estimada === "2026-12-01" && cq.posicion_mes === 12, "A-BUG-101")

    chequear("Cuotas arrendamiento", "Sin cambios no se escribe nada",
      "0 · 0 · 0", (p => `${p.insertar.length} · ${p.actualizar.length} · ${p.borrar.length}`)(planificarCuotas(NAZ, filasNaz)),
      (p => p.insertar.length + p.actualizar.length + p.borrar.length === 0)(planificarCuotas(NAZ, filasNaz)), "A-BUG-101")

    // ── Partir al fijar parcial: mandan las TONELADAS (A-BUG-183) ──
    // El caso real: Rojas 26/27 cuota #4 = 242 ha × 8,8 qq/ha = 212,96 tn; el usuario fijó 100 tn.
    // Con el reparto viejo (qq/ha a 2 decimales) quedó 99,946 + 113,014.
    const tn = (has: number, qq: number) => Math.round((has * qq) / 10 * 1000) / 1000
    const rojas = partirCuota(242, 8.8, 100)
    const txtRojas = `${tn(242, rojas.qqOriginal)} + ${tn(242, rojas.qqSaldo)}`
    chequear("Cuotas arrendamiento", "🔑 Rojas #4: fijar 100 de 212,96 tn deja 100 + 112,96 exactos",
      "100 + 112.96", txtRojas, txtRojas === "100 + 112.96", "A-BUG-183")

    // El caso tiene que FALLAR con el reparto viejo: qq/ha a 2 decimales, como guardaba la columna.
    const viejo = { o: Math.round((8.8 - (112.96 * 10) / 242) * 100) / 100, s: Math.round(((112.96 * 10) / 242) * 100) / 100 }
    chequear("Cuotas arrendamiento", "El reparto viejo (qq/ha a 2 decimales) da el error que vio el usuario",
      "99.946 + 113.014", `${tn(242, viejo.o)} + ${tn(242, viejo.s)}`,
      tn(242, viejo.o) === 99.946 && tn(242, viejo.s) === 113.014, "A-BUG-183")

    chequear("Cuotas arrendamiento", "Los qq/ha de las dos partes suman los de la cuota",
      "8.8", String(Number((rojas.qqOriginal + rojas.qqSaldo).toFixed(DECIMALES_QQ))),
      Math.abs(rojas.qqOriginal + rojas.qqSaldo - 8.8) < 1e-5, "A-BUG-183")

    // Con una venta previa: la original se queda con lo vendido antes + lo de ahora.
    const conPrevia = partirCuota(242, 8.8, 50 + 60)
    chequear("Cuotas arrendamiento", "Con 50 tn ya vendidas, fijar 60 más deja 110 + 102,96",
      "110 + 102.96", `${tn(242, conPrevia.qqOriginal)} + ${tn(242, conPrevia.qqSaldo)}`,
      tn(242, conPrevia.qqOriginal) === 110 && tn(242, conPrevia.qqSaldo) === 102.96, "A-BUG-183")

    // MA Lima: 85,36 ha × 7,75 = 66,154 tn. A 2 decimales se proponía 66,15 → parcial por 0,004 (A-BUG-184).
    const lima = tn(85.36, 7.75)
    chequear("Cuotas arrendamiento", "Lima #1 tiene 66,154 tn: a 2 decimales se pierden 0,004",
      "66.154 (2 dec: 66.15)", `${lima} (2 dec: ${Math.round(lima * 100) / 100})`,
      lima === 66.154 && Math.round(lima * 100) / 100 === 66.15, "A-BUG-184")
  }

  // ══ 📋 DUPLICAR UN CONTRATO A LA CAMPAÑA SIGUIENTE (A-FEAT-166) ══════════════════════════════
  {
    const casos: Array<[string, string]> = [["26/27", "27/28"], ["25/26", "26/27"], ["2025/26", "2026/27"], ["2025/2026", "2026/2027"], ["99/00", "00/01"], ["campaña", "campaña"]]
    const obt = casos.map(([a]) => campaniaSiguiente(a)).join(" ")
    chequear("Duplicar contrato", "La campaña siguiente en los formatos que se usan (y el cambio de siglo)",
      casos.map(c => c[1]).join(" "), obt, obt === casos.map(c => c[1]).join(" "), "A-FEAT-166")

    // PAM Nazarenas 25/26 duplicado a 26/27: mismas cuotas, un año después (las cargó el usuario el 21/09).
    const PAM2526: CuotaGuardada[] = [
      { id: "a", numero_cuota: 1, qq_ha_cuota: 6, fecha_cobro_estimada: "2025-11-20", posicion_anio: 2025, posicion_mes: 11 },
      { id: "b", numero_cuota: 2, qq_ha_cuota: 1.5, fecha_cobro_estimada: "2025-11-20", posicion_anio: 2026, posicion_mes: 5 },
      { id: "c", numero_cuota: 3, qq_ha_cuota: 7.5, fecha_cobro_estimada: "2026-04-20", posicion_anio: 2026, posicion_mes: 5 },
    ]
    const dup = copiarEsquemaCuotas(PAM2526, "25/26", campaniaSiguiente("25/26"))
    const txtDup = dup.map(f => `${f.fecha_cobro}·${f.posicion_mes}/${f.posicion_anio}`).join(" ")
    chequear("Duplicar contrato", "🔑 Duplicar PAM Nazarenas 25/26 deja las 3 cuotas un año después, sin ids",
      "2026-11-20·11/2026 2026-11-20·5/2027 2027-04-20·5/2027 · sin ids", `${txtDup} · ${dup.some(f => f.id) ? "CON ids" : "sin ids"}`,
      txtDup === "2026-11-20·11/2026 2026-11-20·5/2027 2027-04-20·5/2027" && !dup.some(f => f.id), "A-FEAT-166")
  }

  // ══ 👥 EL BUSCADOR DE CLIENTE: PRIMERO LOS CLIENTES (A-FEAT-165) ════════════════════════════
  {
    const lista = [
      { razon_social: "ALCORTA", es_cliente: false, es_proveedor: true },
      { razon_social: "PROVINVEST S.A.", es_cliente: true, es_proveedor: false },
      { razon_social: "MERCURE", es_cliente: true, es_proveedor: true },
      { razon_social: "GENOIL", es_cliente: null, es_proveedor: true },
    ]
    const { conRol, otros } = partirPorRol(lista, "cliente")
    const txt = `${conRol.map(p => p.razon_social).join(",")} | ${otros.map(p => p.razon_social).join(",")}`
    chequear("Buscador de cliente", "Primero los clientes, abajo el resto del maestro, cada parte en su orden",
      "PROVINVEST S.A.,MERCURE | ALCORTA,GENOIL", txt, txt === "PROVINVEST S.A.,MERCURE | ALCORTA,GENOIL", "A-FEAT-165")
    chequear("Buscador de cliente", "No se pierde nadie: los que no son clientes se pueden elegir igual",
      "4", String(conRol.length + otros.length), conRol.length + otros.length === lista.length, "A-FEAT-165")
  }

  // ══ ✏️ EDITAR UNA VENTA DE ARRENDAMIENTO (A-BUG-100) ════════════════════════════════════════
  // Caso real: Rojas 26/27 cuota #3, 48,4 tn matba a USD 365 × TC 1.500 = $26.499.000, «cerrada».
  {
    const cerrada = camposDeVenta({ tons: 48.4, modo: "matba", precio: 365, tc: 1500, fechaFijacion: "2026-08-01" })
    chequear("Editar venta", "La venta de Rojas #3 con TC da $26.499.000",
      "26499000", String(Math.round(cerrada.monto_pesos ?? 0)), Math.round(cerrada.monto_pesos ?? 0) === 26499000, "A-BUG-100")

    // 🔑 Lo que pidió el usuario: sacar el TC la vuelve a «falta TC», sin monto en pesos.
    const sinTc = camposDeVenta({ tons: 48.4, modo: "matba", precio: 365, tc: null, fechaFijacion: "2026-08-01",
      tcAnterior: 1500, fechaTcAnterior: "2026-08-05" })
    // Misma regla que `estadoVenta` de calculo.ts (que no se puede importar acá): matba sin TC = falta TC
    const est = sinTc.modo === "matba" && sinTc.precio_usd && sinTc.tc == null ? "sin_tc" : "otro"
    chequear("Editar venta", "🔑 Borrar el TC de una venta cerrada la deja en «falta TC»",
      "sin_tc · tc null · fecha TC null · monto null",
      `${est} · tc ${sinTc.tc} · fecha TC ${sinTc.fecha_fijacion_tc} · monto ${sinTc.monto_pesos}`,
      est === "sin_tc" && sinTc.tc === null && sinTc.fecha_fijacion_tc === null && sinTc.monto_pesos === null, "A-BUG-100")

    const mismoTc = camposDeVenta({ tons: 50, modo: "matba", precio: 365, tc: 1500, fechaFijacion: "2026-09-22",
      tcAnterior: 1500, fechaTcAnterior: "2026-08-05" })
    chequear("Editar venta", "Si el TC no cambia, se conserva la fecha en que se fijó",
      "2026-08-05", String(mismoTc.fecha_fijacion_tc), mismoTc.fecha_fijacion_tc === "2026-08-05", "A-BUG-100")

    const pizarra = camposDeVenta({ tons: 159.72, modo: "pizarra", precio: 490000, tc: 1500, fechaFijacion: "2026-07-01" })
    chequear("Editar venta", "En pizarra no hay TC aunque quede tipeado: 159,72 × $490.000 = $78.262.800",
      "tc null · 78262800", `tc ${pizarra.tc} · ${Math.round(pizarra.monto_pesos ?? 0)}`,
      pizarra.tc === null && Math.round(pizarra.monto_pesos ?? 0) === 78262800, "A-BUG-100")

    // Rojas #4 tiene 100 tn en una sola venta: editándola, el tope es la cuota entera (100), no 0.
    chequear("Editar venta", "Al editar, el tope es la cuota menos las OTRAS ventas",
      "100 · 40", `${tonsMaximasEdicion(100, 0)} · ${tonsMaximasEdicion(100, 60)}`,
      tonsMaximasEdicion(100, 0) === 100 && tonsMaximasEdicion(100, 60) === 40, "A-BUG-100")
  }

  // ══ 🔗 QUÉ FACTURA PUEDE SER DE QUÉ VENTA (A-BUG-186/187/188) ══════════════════════════════
  // Los datos son los reales del 22/09 (pantalla principal), escritos acá.
  {
    const cuitIgual = (a?: string | null, b?: string | null) => (a ?? "").replace(/\D/g, "") === (b ?? "").replace(/\D/g, "")
    const SANPA = "30712200622", PROV = "33710346939"
    const ventas: VentaEsperando[] = [
      { venta_id: "rojas1", venta_tipo: "arrendamiento", empresa: "MSA", centro_costo: "Rojas", cliente_nombre: "Sanpa Semillas SA", cliente_cuit: SANPA, monto_pesos: 78262800, facturado: 78262800 },
      { venta_id: "rojas3", venta_tipo: "arrendamiento", empresa: "MSA", centro_costo: "Rojas", cliente_nombre: "Sanpa Semillas SA", cliente_cuit: SANPA, monto_pesos: 26499000, facturado: 0 },
      { venta_id: "nazPam", venta_tipo: "arrendamiento", empresa: "PAM", centro_costo: "Nazarenas", cliente_nombre: "PROVINVEST S.A.", cliente_cuit: PROV, monto_pesos: 87895350, facturado: 0 },
      { venta_id: "genta", venta_tipo: "ganaderia", empresa: "MSA", centro_costo: "Recria", cliente_nombre: "Pedro Genta", cliente_cuit: null, monto_pesos: 88988382, facturado: 0 },
    ]
    const facturas: FacturaVenta[] = [
      { id: "fc20", empresa: "MSA", nro_comprobante: "00010-00000020", cuit_cliente: SANPA, imp_total: 95715830.32, fecha_liquidacion: "2026-05-11" },
      { id: "fc21", empresa: "MSA", nro_comprobante: "00010-00000021", cuit_cliente: SANPA, imp_total: 78262800, fecha_liquidacion: "2026-07-22" },
      { id: "fc09", empresa: "MSA", nro_comprobante: "00010-00000009", cuit_cliente: PROV, imp_total: 50000850, fecha_liquidacion: "2026-07-01" },
    ]
    const vinculos: Vinculo[] = [{ venta_id: "rojas1", comprobante_id: "fc21", empresa: "MSA", monto_asignado: 78262800, vinculado: true }]
    const { candidatos, sinCuit } = armarCandidatos(ventas, facturas, vinculos, cuitIgual)
    const pares = candidatos.map(c => `${c.nro_comprobante}→${c.centro_costo}`).join(" · ")

    chequear("Vincular factura de venta", "🔑 Sólo queda la FC 20 para Rojas: ni la 21 (ya usada) ni la de MSA para PAM",
      "00010-00000020→Rojas", pares, pares === "00010-00000020→Rojas", "A-BUG-186")

    // Cada bug por separado, para que si vuelve se sepa cuál. Los dos tienen que FALLAR con el código viejo.
    const conLa21 = armarCandidatos(ventas, facturas, [], cuitIgual).candidatos.some(c => c.comprobante_id === "fc21" && c.venta_id === "rojas3")
    chequear("Vincular factura de venta", "Sin el vínculo de Rojas #1, la FC 21 sí se ofrecería (el caso discrimina)",
      "se ofrece", conLa21 ? "se ofrece" : "no se ofrece", conLa21, "A-BUG-186")

    const cruzaEmpresa = candidatos.some(c => c.comprobante_id === "fc09")
    chequear("Vincular factura de venta", "🛑 Una factura de MSA nunca se ofrece para una venta de PAM",
      "no se ofrece", cruzaEmpresa ? "SE OFRECE" : "no se ofrece", !cruzaEmpresa, "A-BUG-187")

    const facPam: FacturaVenta = { ...facturas[2], id: "fcPam", empresa: "PAM" }
    const enPam = armarCandidatos(ventas, [facPam], [], cuitIgual).candidatos.map(c => c.venta_id).join(",")
    chequear("Vincular factura de venta", "La misma factura, cargada en PAM, sí se ofrece para la venta de PAM",
      "nazPam", enPam, enPam === "nazPam", "A-BUG-187")

    // Una factura usada EN PARTE sigue disponible por lo que le queda.
    const parcial = armarCandidatos(ventas, [facturas[0]], [{ venta_id: "otra", comprobante_id: "fc20", empresa: "MSA", monto_asignado: 90000000, vinculado: true }], cuitIgual)
      .candidatos.find(c => c.venta_id === "rojas3")
    chequear("Vincular factura de venta", "Una factura usada en parte se ofrece por lo que le queda",
      "5.715.830,32", parcial ? parcial.disponible_factura.toLocaleString("es-AR", { minimumFractionDigits: 2 }) : "no se ofrece",
      !!parcial && Math.abs(parcial.disponible_factura - 5715830.32) < 0.01, "A-BUG-186")

    chequear("Vincular factura de venta", "Una venta de hacienda sin CUIT manda a cargarlo en la venta, no en el contrato",
      "Recria (Pedro Genta) → en la venta de hacienda (Productivo)",
      sinCuit.map(s => `${s.texto} → ${dondeSeCargaElCuit(s.venta_tipo)}`).join(" · "),
      sinCuit.length === 1 && dondeSeCargaElCuit(sinCuit[0].venta_tipo) === "en la venta de hacienda (Productivo)", "A-BUG-188")
  }

  // ══ 🧪 EL CARTEL DE TESTS HABLA EN EL IDIOMA DEL USUARIO (A-FEAT-163) ══════════════════════
  // Texto real (recortado) del A-TEST-134, tal como está en PENDIENTES.md.
  {
    const T134 = "🌾 Fijar una cuota de arrendamiento (A-BUG-183, A-BUG-184, A-FEAT-164) — ✅ Probado por Claude: "
      + "5 casos en npm run probar (187/187). Qué probar vos, la próxima vez que fijes: (1) al abrir Fijar, "
      + "las toneladas vienen con 3 decimales y el TC vacío."
    chequear("Cartel de tests", "🔑 Muestra sólo lo que el usuario tiene que hacer, sin casos ni IDs",
      "(1) al abrir Fijar, las toneladas vienen con 3 decimales y el TC vacío.", queProbarVos(T134) ?? "null",
      queProbarVos(T134) === "(1) al abrir Fijar, las toneladas vienen con 3 decimales y el TC vacío.", "A-FEAT-163")

    chequear("Cartel de tests", "Un test viejo sin «Qué probar vos» no inventa nada",
      "null", String(queProbarVos("Probar el FLETE de la carga (A-FEAT-98). Pasos: (1) …")),
      queProbarVos("Probar el FLETE de la carga (A-FEAT-98). Pasos: (1) …") === null, "A-FEAT-163")

    chequear("Cartel de tests", "El título se corta antes del primer « — » o paréntesis",
      "🌾 Fijar una cuota de arrendamiento", tituloCorto(T134),
      tituloCorto(T134) === "🌾 Fijar una cuota de arrendamiento", "A-FEAT-163")

    chequear("Cartel de tests", "Tres respuestas: anduvo, en parte y falló",
      "chequeado · revisar · revisar", RESPUESTAS_TEST.map(r => r.estado).join(" · "),
      RESPUESTAS_TEST.length === 3 && RESPUESTAS_TEST[1].estado === "revisar", "A-FEAT-163")

    const conNota = textoRespuesta("🟡 Anduvo en parte", "  el TC vino vacío pero la fecha no  ", "ingresos/fijar-arrendamiento")
    chequear("Cartel de tests", "La nota del usuario viaja en el comentario",
      "🟡 Anduvo en parte: el TC vino vacío pero la fecha no — probado al correr el proceso (ingresos/fijar-arrendamiento).",
      conNota, conNota === "🟡 Anduvo en parte: el TC vino vacío pero la fecha no — probado al correr el proceso (ingresos/fijar-arrendamiento).",
      "A-FEAT-163")

    chequear("Cartel de tests", "Sin nota queda como antes",
      "✅ Anduvo — probado al correr el proceso (x).", textoRespuesta("✅ Anduvo", "", "x"),
      textoRespuesta("✅ Anduvo", "", "x") === "✅ Anduvo — probado al correr el proceso (x).", "A-FEAT-163")
  }

  // ══ 📅 EL RANGO DE FECHAS COMPARTIDO (A-FEAT-161) ═══════════════════════════════════════════
  chequear("Rango de fechas", "📅 Un mes va del 1 al ultimo dia, con ceros",
    "2026-09-01 a 2026-09-30", `${mesCompleto(2026, 8).desde} a ${mesCompleto(2026, 8).hasta}`,
    mesCompleto(2026, 8).desde === "2026-09-01" && mesCompleto(2026, 8).hasta === "2026-09-30",
    "A-FEAT-161")

  chequear("Rango de fechas", "Febrero de un año bisiesto termina el 29",
    "2024-02-29", mesCompleto(2024, 1).hasta, mesCompleto(2024, 1).hasta === "2024-02-29", "A-FEAT-161")

  // 🔑 El mes anterior tiene que cruzar bien el cambio de año: enero -> diciembre del año pasado.
  chequear("Rango de fechas", "🔑 En enero, el mes anterior es diciembre del año pasado",
    "2025-12-01 a 2025-12-31",
    `${mesAnterior(new Date(2026, 0, 15)).desde} a ${mesAnterior(new Date(2026, 0, 15)).hasta}`,
    mesAnterior(new Date(2026, 0, 15)).desde === "2025-12-01"
      && mesAnterior(new Date(2026, 0, 15)).hasta === "2025-12-31", "A-FEAT-161")

  chequear("Rango de fechas", "El mes actual sale de la fecha que se le pase",
    "2026-07-01", mesActual(new Date(2026, 6, 20)).desde,
    mesActual(new Date(2026, 6, 20)).desde === "2026-07-01", "A-FEAT-161")

  // ══ 💰 CUANTO ACREDITA EL BANCO POR UNA VENTA (A-FEAT-167) ══════════════════════════════════
  // Numeros REALES de la pantalla de Liquidaciones, 2026-09-22.

  // 🌾 AFA — liquidacion primaria de granos: el comprador RETIENE el IVA (RG 2300).
  const afaLiq = cobroEsperado({
    imp_total: 6080286.72, iva: 430375.82,
    comision_neto: 105568.69, comision_iva: 22168.43,
    almacenaje_neto: 0, almacenaje_iva: 0,
    ret_iva: 105568.69, ret_iibb: 0,
  }, 211693.32)
  chequear("Cobro de venta", "🌾 En granos el IVA RG2300 se retiene: el banco paga MENOS que el neto",
    "neto > pago s/cond",
    `${afaLiq.importeNeto.toFixed(2)} > ${afaLiq.pagoCondiciones.toFixed(2)}`,
    afaLiq.pagoCondiciones < afaLiq.importeNeto && afaLiq.ivaRg2300 > 0, "A-FEAT-167")

  // 🔑 Sin IVA retenido los dos coinciden -- por eso `pagoCondiciones` es el correcto SIEMPRE.
  const provinvest = cobroEsperado({ imp_total: 50000850, iva: 0 }, 2999379)
  chequear("Cobro de venta", "🔑 Sin IVA RG2300, neto y pago s/cond son iguales",
    "47001471 · 47001471",
    `${provinvest.importeNeto} · ${provinvest.pagoCondiciones}`,
    provinvest.importeNeto === 47001471 && provinvest.pagoCondiciones === 47001471, "A-FEAT-167")

  chequear("Cobro de venta", "Las retenciones cargadas APARTE entran en la cuenta",
    "2999379", String(provinvest.retenciones), provinvest.retenciones === 2999379, "A-FEAT-167")

  // ⚠️ Cuando faltan cargar retenciones, la diferencia AVISA -- no es un descuadre.
  //    Caso Sanpa FC-20: 0 retenciones cargadas y el banco acredito 6,5% menos.
  const sanpa20 = cobroEsperado({ imp_total: 95715830.32, iva: 0 }, 0)
  const difSanpa = diferenciaContraElBanco(89494973.35, sanpa20)
  chequear("Cobro de venta", "⚠️ Sin retenciones cargadas, la diferencia da ~6,5% y hay que avisarlo",
    "-6,5%", `${difSanpa.porcentaje.toFixed(1)}%`,
    Math.abs(difSanpa.porcentaje + 6.5) < 0.1 && !difSanpa.exacto, "A-FEAT-167")

  chequear("Cobro de venta", "Un cobro que coincide exacto se marca exacto",
    "exacto", diferenciaContraElBanco(47001471, provinvest).exacto ? "exacto" : "difiere",
    diferenciaContraElBanco(47001471, provinvest).exacto === true, "A-FEAT-167")


  // ══ 🖱️ EL GESTO DE LOS CHIPS: ctrl+click = solo ese (A-FEAT-1221) ═══════════════════════════
  // Pedido del usuario 2026-10-01 mirando el Cash Flow: «funciona muy bien, llevalo a todos».
  // Es logica pura: se le pasa un setter de mentira que guarda el resultado.

  const correrChip = (inicial: string[], valor: string, soloEste: boolean) => {
    let estado = new Set(inicial)
    toggleChip<string>(f => { estado = f(estado) }, valor, soloEste)
    return [...estado].sort()
  }

  chequear("Chips de filtro", "Click sobre un chip APAGADO lo prende, sin tocar los otros",
    "a,b,c", correrChip(["a", "c"], "b", false).join(","),
    correrChip(["a", "c"], "b", false).join(",") === "a,b,c", "A-FEAT-1221")

  chequear("Chips de filtro", "Click sobre un chip PRENDIDO lo apaga, sin tocar los otros",
    "a,c", correrChip(["a", "b", "c"], "b", false).join(","),
    correrChip(["a", "b", "c"], "b", false).join(",") === "a,c", "A-FEAT-1221")

  // 🔑 El gesto que pidio: con ctrl, la seleccion entera se reemplaza por ese chip.
  chequear("Chips de filtro", "🔑 CTRL+click deja SOLO ese chip, aunque hubiera 4 prendidos",
    "b", correrChip(["a", "b", "c", "d"], "b", true).join(","),
    correrChip(["a", "b", "c", "d"], "b", true).join(",") === "b", "A-FEAT-1221")

  // ⚠️ Adversario: ctrl+click sobre uno APAGADO tambien deja solo ese -- lo PRENDE.
  //    Si en vez de eso lo apagara, el usuario quedaria sin nada a la vista y pareceria un bug.
  chequear("Chips de filtro", "⚠️ CTRL+click sobre un chip apagado lo deja PRENDIDO y solo",
    "z", correrChip(["a", "b"], "z", true).join(","),
    correrChip(["a", "b"], "z", true).join(",") === "z", "A-FEAT-1221")

  // ⚠️ Adversario: ctrl+click sobre el UNICO prendido no puede dejar la pantalla vacia.
  chequear("Chips de filtro", "⚠️ CTRL+click sobre el unico prendido lo mantiene, no vacia el filtro",
    "a", correrChip(["a"], "a", true).join(","),
    correrChip(["a"], "a", true).join(",") === "a", "A-FEAT-1221")

  // El ⌘ de Mac cuenta igual que el Ctrl de Windows.
  chequear("Chips de filtro", "El gesto vale con Ctrl y con ⌘ (Mac), y no con un click pelado",
    "true · true · false",
    `${esSoloEste({ ctrlKey: true })} · ${esSoloEste({ metaKey: true })} · ${esSoloEste({})}`,
    esSoloEste({ ctrlKey: true }) && esSoloEste({ metaKey: true }) && !esSoloEste({}), "A-FEAT-1221")

  // ══ 🐂 LA VENTA DE HACIENDA VISTA DESDE INGRESOS (A-BUG-1232) ═══════════════════════════════
  // Números REALES: la venta de Pedro Genta del 04/08/2026 y su liquidación.

  // 🧨 El desbaste se guarda como FRACCIÓN (0.03). Tratarlo como porcentaje daba kilos negativos.
  chequear("Venta de hacienda", "🧨 El desbaste es FRACCIÓN: 16.180 kg con 0,03 dejan 15.694,6 kg",
    "15694.6", kgNetosDeVenta(16180, 0.03).toFixed(1),
    Math.abs(kgNetosDeVenta(16180, 0.03) - 15694.6) < 0.001, "A-BUG-1232")

  // 🔑 Y esos kilos son los que trae la liquidación (15.695): la venta y el papel hablan de lo mismo.
  chequear("Venta de hacienda", "🔑 Los kg netos de la venta coinciden con los de la liquidación (15.695)",
    "diferencia < 0,5 kg", (15695 - kgNetosDeVenta(16180, 0.03)).toFixed(1) + " kg",
    Math.abs(15695 - kgNetosDeVenta(16180, 0.03)) < 0.5, "A-BUG-1232")

  // El neto guardado de la venta sale de esos kilos: 15.694,6 × 5.670 = 88.988.382.
  chequear("Venta de hacienda", "El neto guardado de la venta es kg netos × precio",
    "88988382", (kgNetosDeVenta(16180, 0.03) * 5670).toFixed(0),
    Math.round(kgNetosDeVenta(16180, 0.03) * 5670) === 88988382, "A-BUG-1232")

  chequear("Venta de hacienda", "Promedio: 16.180 kg / 55 cabezas = 294 kg; sin cabezas, cero (no divide por cero)",
    "294 · 0", promedioKg(16180, 55).toFixed(0) + " · " + promedioKg(16180, 0),
    Math.round(promedioKg(16180, 55)) === 294 && promedioKg(16180, 0) === 0, "A-BUG-1232")

  // 🧨 La venta de Genta tiene la categoría en su LOTE, no en la venta: mirar sólo la directa la hacía «sin categoría».
  chequear("Venta de hacienda", "🧨 Una venta por lote toma la categoría del lote (Genta = Ternero Recria)",
    "Ternero Recria", String(categoriaDeVenta("Ternero Recria", null)),
    categoriaDeVenta("Ternero Recria", null) === "Ternero Recria" && categoriaDeVenta(null, "Toro") === "Toro"
      && categoriaDeVenta(null, null) === null, "A-BUG-1232")

  // ══ 🧾 LA LIQUIDACIÓN DE HACIENDA — tipo 60 (A-FEAT-1225) ══════════════════════════════════
  // Los dos papeles REALES de «de Campo a Campo». Si una cuenta de la app no da lo del papel,
  // la app está mal — el papel es la referencia.

  // Papel 1 · 27/01/2026 · 70 novillos de invernada · Frig. Rioplatense
  const papel1 = calcularLiqHacienda({
    lineas: [{ razonSocial: "FRIG.RIOPLATENS", cuit: "30540080298", cabezas: 70, clasificacion: "NOVILLO DE INVERNADA", kilos: 28000, precio: 4623 }],
    comisionPct: 2.319, redondeo: -1193.64, ivaPct: 10.5,
    retenciones: [{ concepto: "INGRESOS BRUTOS Pcia BS AS", alicuota: 0.75, importe: 970830 }],
  })
  chequear("Liquidación de hacienda", "Papel 1 (27/01): bruto, comisión y neto gravado, al centavo",
    "129.444.000 · 3.001.806,36 · 126.441.000",
    `${papel1.bruto} · ${papel1.comision} · ${papel1.netoGravado}`,
    papel1.bruto === 129444000 && papel1.comision === 3001806.36 && papel1.netoGravado === 126441000, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "Papel 1: IVA 10,5 % del neto gravado e importe neto = 138.746.475",
    "13.276.305 · 138.746.475", `${papel1.iva} · ${papel1.importeNeto}`,
    papel1.iva === 13276305 && papel1.importeNeto === 138746475, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "Papel 1: el «TOTAL» del papel es la columna de gastos/IVA/retenciones = 9.302.475",
    "9302475", String(papel1.columnaGastos), papel1.columnaGastos === 9302475, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🔑 IIBB se retiene sobre el BRUTO, no sobre el neto: 0,75 % de 129.444.000 = 970.830",
    "970830", String(retencionSugerida(129444000, 0.75)), retencionSugerida(129444000, 0.75) === 970830, "A-FEAT-1225")

  // Papel 2 · 04/08/2026 · 55 novillitos · la venta de Pedro Genta
  const papel2 = calcularLiqHacienda({
    lineas: [{ razonSocial: "DON FELICIANO S", cuit: "30709270105", cabezas: 55, clasificacion: "Novillito de Invernada", kilos: 15695, precio: 5742 }],
    comisionPct: 1.166, redondeo: -757.75, ivaPct: 10.5,
    retenciones: [{ concepto: "INGRESOS BRUTOS Pcia BS AS", alicuota: 0.75, importe: 675905.18 }],
  })
  chequear("Liquidación de hacienda", "Papel 2 (04/08): bruto 90.120.690 · neto gravado 89.069.125 · importe neto 97.745.477,95",
    "90120690 · 89069125 · 97745477.95", `${papel2.bruto} · ${papel2.netoGravado} · ${papel2.importeNeto}`,
    papel2.bruto === 90120690 && papel2.netoGravado === 89069125 && papel2.importeNeto === 97745477.95, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "Papel 2: precio después de comisión = 5.675,00 $/kg (neto gravado / kilos)",
    "5675.00", papel2.precioPostComision.toFixed(2), papel2.precioPostComision.toFixed(2) === "5675.00", "A-FEAT-1225")

  // 🔑 El cobro: lo que el banco va a acreditar.
  const cobro1 = cobroEsperado({ tipo_comprobante: 60, imp_neto_gravado: 126441000, iva: 13276305, imp_total: 139717305,
    comision_neto: 3001806.36, ret_iibb: 970830, subtotal_neto: 129444000 }, 0)
  chequear("Liquidación de hacienda", "🔑 Se cobra el importe neto del papel: 138.746.475",
    "138746475", String(cobro1.pagoCondiciones), Math.abs(cobro1.pagoCondiciones - 138746475) < 0.005, "A-FEAT-1225")
  const cobro2 = cobroEsperado({ tipo_comprobante: 60, imp_neto_gravado: 89069125, iva: 9352258.13, imp_total: 98421383.13,
    comision_neto: 1050807.25, ret_iibb: 675905.18, subtotal_neto: 90120690 }, 0)
  chequear("Liquidación de hacienda", "🔑 Papel 2: se cobra 97.745.477,95",
    "97745477.95", cobro2.pagoCondiciones.toFixed(2), Math.abs(cobro2.pagoCondiciones - 97745477.95) < 0.005, "A-FEAT-1225")

  // 🧨 Sin el caso aparte, la cuenta de GRANOS le restaba todo el IVA como si fuera RG 2300.
  const cobroComoGranos = cobroEsperado({ imp_neto_gravado: 126441000, iva: 13276305, imp_total: 139717305,
    comision_neto: 3001806.36, ret_iibb: 970830, subtotal_neto: 129444000 }, 0)
  chequear("Liquidación de hacienda", "🧨 Tratada como granos, el cobro daba MAL (le sacaba el IVA entero)",
    "≠ 138.746.475", cobroComoGranos.pagoCondiciones.toFixed(2),
    Math.abs(cobroComoGranos.pagoCondiciones - 138746475) > 1000000, "A-FEAT-1225")

  // 🔑 La paridad que pidió el usuario: subtotal de la venta contra subtotal después de comisión.
  const ventaGenta = { cabezas: 55, kgNetos: kgNetosDeVenta(16180, 0.03), precioKg: 5670, neto: 88988382 }
  const avisosGenta = compararConVenta(ventaGenta, papel2)
  const av = (t: string) => avisosGenta.find(a => a.tema === t)!
  chequear("Liquidación de hacienda", "Venta de Genta vs. su liquidación: cabezas y kilos coinciden",
    "ok · ok", `${av("Cabezas").nivel} · ${av("Kilos").nivel}`,
    av("Cabezas").nivel === "ok" && av("Kilos").nivel === "ok", "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🔑 …y el subtotal AVISA: la liquidación pagó +$80.743 (+5,00 $/kg sobre lo pactado)",
    "aviso · 80743", `${av("Subtotal").nivel} · ${av("Subtotal").diferencia}`,
    av("Subtotal").nivel === "aviso" && av("Subtotal").diferencia === 80743 && av("Subtotal").mensaje.includes("+5,00"), "A-FEAT-1225")

  // Con el subtotal igual al neto de la venta, no hay aviso (tolerancia: medio kilo).
  const iguales = compararConVenta({ cabezas: 55, kgNetos: 15695, precioKg: 5675, neto: 89069125 + 1000 }, papel2)
  chequear("Liquidación de hacienda", "Si la diferencia está dentro de medio kilo de redondeo, no avisa",
    "ok", iguales.find(a => a.tema === "Subtotal")!.nivel, iguales.find(a => a.tema === "Subtotal")!.nivel === "ok", "A-FEAT-1225")

  // Contra el papel: un número mal tipeado se señala; uno bien, no.
  chequear("Liquidación de hacienda", "Un importe neto mal tipeado se avisa; el correcto, no",
    "aviso · ok",
    `${controlContraPapel(papel2, { importeNeto: 97745487.95 })[0].nivel} · ${controlContraPapel(papel2, { importeNeto: 97745477.95 })[0].nivel}`,
    controlContraPapel(papel2, { importeNeto: 97745487.95 })[0].nivel === "aviso"
      && controlContraPapel(papel2, { importeNeto: 97745477.95 })[0].nivel === "ok", "A-FEAT-1225")

  // Plazos: 30/60/90 desde el 04/08 → los vencimientos del papel, 33/34/33, y la suma exacta.
  const plazos = plazosDesdeVenta("30/60/90", "2026-08-04", 97745477.95)
  chequear("Liquidación de hacienda", "Plazos 30/60/90 desde el 04/08: vencen 03/09, 03/10 y 02/11, al 33/34/33 %",
    "2026-09-03 2026-10-03 2026-11-02 · 33/34/33",
    plazos.map(x => x.vencimiento).join(" ") + " · " + plazos.map(x => x.pct).join("/"),
    plazos.map(x => x.vencimiento).join(" ") === "2026-09-03 2026-10-03 2026-11-02"
      && plazos.map(x => x.pct).join("/") === "33/34/33", "A-FEAT-1225")
  chequear("Liquidación de hacienda", "Las cuotas suman exacto el importe neto",
    "ok", String(controlPlazos(plazos, 97745477.95)?.nivel), controlPlazos(plazos, 97745477.95)?.nivel === "ok", "A-FEAT-1225")

  // ══ 🎚️ LA PRECARGA DESDE LA VENTA — «chupar los datos» (A-FEAT-1225, paso 3) ═══════════════
  const pre = precargaDesdeVenta({ fecha: "2026-08-04", cliente: "Pedro Genta", cuit: "", categoria: "Ternero Recria",
    cabezas: 55, kgTotales: 16180, pctDesbaste: 0.03, precioKg: 5670, pctCz: 0 })
  chequear("Liquidación de hacienda", "🎚️ La precarga de Genta trae 55 cab, 15.695 kg NETOS (no 16.180), $5.670 y comisión 0",
    "55 · 15695 · 5670 · 0",
    `${pre.linea.cabezas} · ${pre.linea.kilos} · ${pre.linea.precio} · ${pre.comisionPct}`,
    pre.linea.cabezas === 55 && pre.linea.kilos === 15695 && pre.linea.precio === 5670 && pre.comisionPct === 0, "A-FEAT-1225")

  // 🔑 Con lo precargado tal cual, la liquidación da la venta: ningún aviso. La diferencia aparece
  //    recién cuando el usuario tipea lo que dice su papel (el caso del +$80.743 de más arriba).
  const tal = calcularLiqHacienda({ lineas: [pre.linea], comisionPct: pre.comisionPct, redondeo: 0, ivaPct: 10.5, retenciones: [] })
  const avisosTal = compararConVenta({ cabezas: 55, kgNetos: kgNetosDeVenta(16180, 0.03), precioKg: 5670, neto: 88988382 }, tal)
  chequear("Liquidación de hacienda", "🔑 Precargada sin tocar, no avisa nada: cabezas, kilos y subtotal coinciden con la venta",
    "ok ok ok", avisosTal.map(a => a.nivel).join(" "), avisosTal.every(a => a.nivel === "ok"), "A-FEAT-1225")

  // La CZ de la venta es FRACCIÓN; la comisión del papel, PORCENTAJE.
  chequear("Liquidación de hacienda", "Una CZ de 0,02 en la venta se precarga como comisión 2 %",
    "2", String(precargaDesdeVenta({ fecha: "", cliente: "", cuit: "", categoria: null, cabezas: 1, kgTotales: 1, pctDesbaste: 0, precioKg: 1, pctCz: 0.02 }).comisionPct),
    precargaDesdeVenta({ fecha: "", cliente: "", cuit: "", categoria: null, cabezas: 1, kgTotales: 1, pctDesbaste: 0, precioKg: 1, pctCz: 0.02 }).comisionPct === 2, "A-FEAT-1225")

  // ══ 🎚️ MONTOS A MANO: comisión e IVA (pedido del usuario 2026-10-01) ═════════════════════
  // «Cosas como comisión deben poder tipearse el monto, por si se calcula sobre otra cosa.»
  const lineaGenta = { razonSocial: "DON FELICIANO S", cuit: "30709270105", cabezas: 55, clasificacion: "Novillito", kilos: 15695, precio: 5742 }
  const conMonto = calcularLiqHacienda({ lineas: [lineaGenta], comisionPct: 0, comisionMonto: 1050807.25, redondeo: -757.75, ivaPct: 10.5,
    retenciones: [{ concepto: "IIBB", alicuota: 0.75, importe: 675905.18 }] })
  chequear("Liquidación de hacienda", "🎚️ Comisión tipeada por MONTO (con 0 %): da el mismo papel, y el % que resulta es 1,166",
    "89069125 · 97745477.95 · 1.166",
    `${conMonto.netoGravado} · ${conMonto.importeNeto} · ${conMonto.comisionPctEfectivo.toFixed(3)}`,
    conMonto.netoGravado === 89069125 && conMonto.importeNeto === 97745477.95 && conMonto.comisionPctEfectivo.toFixed(3) === "1.166", "A-FEAT-1225")

  // El monto MANDA sobre el %: con 5 % y un monto tipeado, vale el monto.
  const mandaMonto = calcularLiqHacienda({ lineas: [lineaGenta], comisionPct: 5, comisionMonto: 1000000, redondeo: 0, ivaPct: 10.5, retenciones: [] })
  chequear("Liquidación de hacienda", "El monto tipeado manda sobre el %: con 5 % y $1.000.000 tipeado, vale $1.000.000",
    "1000000", String(mandaMonto.comision), mandaMonto.comision === 1000000, "A-FEAT-1225")

  // Vacío = se calcula: null no es cero.
  const vacio = calcularLiqHacienda({ lineas: [lineaGenta], comisionPct: 1.166, comisionMonto: null, ivaMonto: null, redondeo: -757.75, ivaPct: 10.5, retenciones: [] })
  chequear("Liquidación de hacienda", "Con el monto VACÍO se calcula con el % (vacío no es cero)",
    "1050807.25 · 9352258.13", `${vacio.comision} · ${vacio.iva}`,
    vacio.comision === 1050807.25 && vacio.iva === 9352258.13, "A-FEAT-1225")

  const ivaAMano = calcularLiqHacienda({ lineas: [lineaGenta], comisionPct: 1.166, redondeo: -757.75, ivaPct: 10.5, ivaMonto: 9352258, retenciones: [] })
  chequear("Liquidación de hacienda", "El IVA también se puede tipear por monto, y el importe neto lo sigue",
    "9352258 · 98421383", `${ivaAMano.iva} · ${ivaAMano.importeNeto}`,
    ivaAMano.iva === 9352258 && ivaAMano.importeNeto === 98421383, "A-FEAT-1225")

  // ══ 📅 EL CASH FLOW EN CUOTAS (A-FEAT-1225) ══════════════════════════════════════════════
  // «Creo que sólo veo una cuota en cash flow de la venta, ¿es correcto esto?» — no lo era.
  // Las cuotas son las que quedaron guardadas en la liquidación real de Genta.
  const plazosGenta = [
    { vencimiento: "2026-09-03", importe: 32256007.73 },
    { vencimiento: "2026-10-03", importe: 33233462.5 },
    { vencimiento: "2026-11-02", importe: 32256007.72 },
  ]
  const enCuotas = cuotasPorCobrar(plazosGenta, 97745477.95, 0, "2026-09-03")
  chequear("Liquidación de hacienda", "📅 Con plazos, el Cash Flow muestra 3 cuotas en sus fechas y suman el importe neto",
    "3 · 03/09 03/10 02/11 · 97745477.95",
    `${enCuotas.length} · ${enCuotas.map(q => q.vencimiento).join(" ")} · ${enCuotas.reduce((x, q) => x + q.importe, 0).toFixed(2)}`,
    enCuotas.length === 3 && enCuotas.map(q => q.vencimiento).join(" ") === "2026-09-03 2026-10-03 2026-11-02"
      && enCuotas.reduce((x, q) => x + q.importe, 0).toFixed(2) === "97745477.95", "A-FEAT-1225")

  // Un anticipo de $40 M cancela la 1ª cuota entera y $7.743.992,27 de la 2ª.
  const cuotasConAnticipo = cuotasPorCobrar(plazosGenta, 97745477.95, 40000000, "2026-09-03")
  chequear("Liquidación de hacienda", "Lo cobrado por adelantado cancela primero las cuotas más viejas",
    "2 cuotas · 25489470.23 · 32256007.72",
    `${cuotasConAnticipo.length} cuotas · ${cuotasConAnticipo.map(q => q.importe).join(" · ")}`,
    cuotasConAnticipo.length === 2 && cuotasConAnticipo[0].importe === 25489470.23 && cuotasConAnticipo[1].importe === 32256007.72, "A-FEAT-1225")

  // ══ 🧾 Las retenciones van a la cuota de SU FECHA (2026-10-02, caso real de Genta) ══════════
  // Ganancias del pago del 03/09: $583.395,25 (como la cargó el usuario). El banco acreditó $31.672.612,47.
  const retGan1 = { monto: 583395.25, fecha: "2026-09-03" }
  const conRet1 = repartirEnCuotas(plazosGenta, 0, [retGan1], "")
  chequear("Liquidación de hacienda", "🧾 La retención del 03/09 baja la cuota del 03/09: 32.256.007,73 − 583.395,25 = 31.672.612,48 (banco: ,47)",
    "31672612.48 · 33233462.5 · 32256007.72", conRet1.map(q => q.aCobrar).join(" · "),
    conRet1[0].aCobrar === 31672612.48 && conRet1[1].aCobrar === 33233462.5 && conRet1[2].aCobrar === 32256007.72, "A-BUG-1234")
  // La del 2º pago tiene que caer en la 2ª cuota — con el reparto viejo (en orden) caía en la 1ª.
  const conRet2 = repartirEnCuotas(plazosGenta, 0, [retGan1, { monto: 600000, fecha: "2026-10-05" }], "")
  chequear("Liquidación de hacienda", "La retención del 2º pago (05/10) cae en la cuota del 03/10, no en la primera",
    "31672612.48 · 32633462.5", `${conRet2[0].aCobrar} · ${conRet2[1].aCobrar}`,
    conRet2[0].aCobrar === 31672612.48 && conRet2[1].aCobrar === 32633462.5, "A-BUG-1234")
  const ctl = controlCuotas(conRet2, 97745477.95, 1183395.25)
  chequear("Liquidación de hacienda", "🧮 Control: las cuotas suman el importe neto del papel y no queda retención sin repartir",
    "cierra", ctl.cierra ? "cierra" : `dif papel ${ctl.difPapel} · sin repartir ${ctl.sinRepartir}`, ctl.cierra, "A-BUG-1234")
  const ctlMal = controlCuotas(repartirEnCuotas(plazosGenta.slice(0, 2), 0, [], ""), 97745477.95, 0)
  chequear("Liquidación de hacienda", "🧮 Si las cuotas no suman el papel (falta una), el control marca el descuadre",
    "-32256007.72", String(ctlMal.difPapel), !ctlMal.cierra && ctlMal.difPapel === -32256007.72, "A-BUG-1234")
  chequear("Liquidación de hacienda", "Cuota 1 cobrada con su retención: lo cobrado es lo que entró al banco (31.672.612,48), no $0",
    "31672612.48", String(repartirEnCuotas(plazosGenta.map((q, i) => i === 0 ? { ...q, estado: "cobrado" } : q), 0, [retGan1], "")
      .filter(q => q.estado === "cobrado").reduce((x, q) => x + q.aCobrar, 0)),
    repartirEnCuotas(plazosGenta.map((q, i) => i === 0 ? { ...q, estado: "cobrado" } : q), 0, [retGan1], "")
      .filter(q => q.estado === "cobrado").reduce((x, q) => x + q.aCobrar, 0) === 31672612.48, "A-BUG-1234")

  // ══ 🏦 Conciliar UNA cuota contra su movimiento (A-BUG-1234) ═════════════════════════════
  const plGenta = plazosGenta.map(q => ({ dias: 30, pct: 33, ...q }))
  const cqUno = conciliarCuota(plGenta, 0, "mov-0309")
  chequear("Conciliación por cuota", "🏦 Conciliar el cobro del 03/09 marca SÓLO la cuota 1 — la liquidación sigue «a cobrar»",
    "cobrado,mov-0309 · sin marca · a cobrar", `${cqUno.plazos[0].estado},${cqUno.plazos[0].movimiento_id} · ${cqUno.plazos[1].estado ?? "sin marca"} · ${cqUno.estadoComprobante}`,
    cqUno.plazos[0].movimiento_id === "mov-0309" && cqUno.plazos[1].estado === undefined && cqUno.estadoComprobante === "a cobrar", "A-BUG-1234")
  const cqTres = conciliarCuota(conciliarCuota(cqUno.plazos, 1, "mov-0310").plazos, 2, "mov-0211")
  chequear("Conciliación por cuota", "Con las 3 cuotas conciliadas, la liquidación pasa a «conciliado»",
    "conciliado", cqTres.estadoComprobante, cqTres.estadoComprobante === "conciliado", "A-BUG-1234")
  const cqSuelta = conciliarCuota(cqTres.plazos, null, null, "mov-0310")
  chequear("Conciliación por cuota", "Desconciliar el movimiento cqSuelta SU cuota (la 2) y la liquidación vuelve a «a cobrar»",
    "a cobrar · sin movimiento · a cobrar", `${cqSuelta.plazos[1].estado} · ${cqSuelta.plazos[1].movimiento_id ?? "sin movimiento"} · ${cqSuelta.estadoComprobante}`,
    cqSuelta.plazos[1].estado === "a cobrar" && !cqSuelta.plazos[1].movimiento_id && cqSuelta.estadoComprobante === "a cobrar" && cqSuelta.cambio, "A-BUG-1234")
  chequear("Conciliación por cuota", "🛑 Una cuota conciliada no se desmarca a mano (lo decide la conciliación)",
    "cobrado", marcarCuota(cqUno.plazos, 0, "a cobrar", "a cobrar").plazos[0].estado ?? "",
    marcarCuota(cqUno.plazos, 0, "a cobrar", "a cobrar").plazos[0].estado === "cobrado", "A-BUG-1234")

  const sinPlazos = cuotasPorCobrar(null, 97745477.95, 0, "2026-08-04")
  chequear("Liquidación de hacienda", "Sin plazos, una sola fila por el cobro entero",
    "1 · 2026-08-04 · 97745477.95", `${sinPlazos.length} · ${sinPlazos[0].vencimiento} · ${sinPlazos[0].importe}`,
    sinPlazos.length === 1 && sinPlazos[0].vencimiento === "2026-08-04" && sinPlazos[0].importe === 97745477.95, "A-FEAT-1225")

  // ══ 🐾 LA HUELLA (A-FEAT-1225) — lo que propuso la app al lado de lo que quedó ═══════════
  // El caso real: precarga de Genta (55 cab, 15.695 kg, $5.670, comisión 0) y lo que el usuario
  // puso de su papel ($5.742 y la comisión por MONTO), con «Coincide» en el importe neto.
  const preG = precargaDesdeVenta({ fecha: "2026-08-04", cliente: "Pedro Genta", cuit: "", categoria: "Ternero Recria",
    cabezas: 55, kgTotales: 16180, pctDesbaste: 0.03, precioKg: 5670, pctCz: 0 })
  const lineaPapel = { ...preG.linea, razonSocial: "DON FELICIANO S", precio: 5742 }
  const entradaH = { lineas: [lineaPapel], comisionPct: 0, comisionMonto: 1050807.25, redondeo: -757.75, ivaPct: 10.5,
    retenciones: [{ concepto: "IIBB", alicuota: 0.75, importe: 675905.18 }] }
  const calcH = calcularLiqHacienda(entradaH)
  const huella = huellaLiquidacion({
    calc: calcH, calcSinAMano: calcularLiqHacienda({ ...entradaH, comisionMonto: null }),
    comisionAMano: true, ivaAMano: false,
    marcas: { importe: { estado: "ok" } },
    precarga: { ventaId: "venta-genta", linea: preG.linea, comisionPct: preG.comisionPct },
    guardado: { linea: lineaPapel, comisionPct: calcH.comisionPctEfectivo },
  })
  chequear("Liquidación de hacienda", "🐾 La huella guarda las DOS puntas: la comisión que daba el % (0) y la tipeada (1.050.807,25)",
    "0 → 1050807.25", `${huella?.montosAMano.comision?.calculado} → ${huella?.montosAMano.comision?.tipeado}`,
    huella?.montosAMano.comision?.calculado === 0 && huella?.montosAMano.comision?.tipeado === 1050807.25, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🐾 …y qué cambió de la precarga: precio 5670 → 5742, comprador y comisión",
    "precio, comprador, comisionPct",
    (huella?.precarga?.cambios || []).map(c => c.campo).join(", "),
    (huella?.precarga?.cambios || []).map(c => c.campo).join(", ") === "precio, comprador, comisionPct"
      && huella?.precarga?.cambios.find(c => c.campo === "precio")?.precargado === 5670
      && huella?.precarga?.cambios.find(c => c.campo === "precio")?.guardado === 5742, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🐾 …y la marca «Coincide» del importe neto, con el valor de la app",
    "coincide · 97745477.95", `${(huella?.contraElPapel.importe as any)?.estado} · ${(huella?.contraElPapel.importe as any)?.app}`,
    (huella?.contraElPapel.importe as any)?.estado === "coincide" && (huella?.contraElPapel.importe as any)?.app === 97745477.95, "A-FEAT-1225")

  // Sin nada que anotar, no se guarda un objeto vacío.
  const sinNada = huellaLiquidacion({ calc: calcH, calcSinAMano: calcH, comisionAMano: false, ivaAMano: false, marcas: {},
    precarga: { ventaId: "x", linea: lineaPapel, comisionPct: 0 }, guardado: { linea: lineaPapel, comisionPct: 0 } })
  chequear("Liquidación de hacienda", "Sin correcciones ni marcas, la huella queda vacía (null), no un objeto vacío",
    "null", String(sinNada), sinNada === null, "A-FEAT-1225")

  // ══ 🥩 AL GANCHO y VARIAS VENTAS EN UN PAPEL — Arre Beef (pedido del usuario 2026-10-02) ═══
  // Datos REALES de Productivo: 7 vacas (3.640 kg vivos, 1.748 de carne, $5.949,49) y 3 toros
  // (2.661 vivos, 1.606 de carne, $5.200), las dos del 03/09/2026, un solo papel.
  const vacasAB = { cabezas: 7, kgTotales: 3640, pctDesbaste: 0, kgCarne: 1748, neto: 10399700 }
  const torosAB = { cabezas: 3, kgTotales: 2661, pctDesbaste: 0, kgCarne: 1606, neto: 8351200 }
  chequear("Liquidación de hacienda", "🥩 Al gancho se cobran los kilos de CARNE (1.748), no los vivos (3.640)",
    "1748", String(kgQueSeCobran(vacasAB)), kgQueSeCobran(vacasAB) === 1748, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🧨 Con los vivos, la venta de vacas esperaba $21,6 M en vez de $10,4 M",
    "≈ 2,08 veces", (3640 * 5949.49 / 10399700).toFixed(2), 3640 * 5949.49 > 2 * 10399700, "A-FEAT-1225")
  chequear("Liquidación de hacienda", "En pie, sin kilos de carne, siguen siendo los vivos menos desbaste (Genta 15.694,6)",
    "15694.6", kgQueSeCobran({ kgTotales: 16180, pctDesbaste: 0.03 }).toFixed(1),
    kgQueSeCobran({ kgTotales: 16180, pctDesbaste: 0.03 }).toFixed(1) === "15694.6", "A-FEAT-1225")

  const juntasAB = ventaParaComparar([vacasAB, torosAB])
  chequear("Liquidación de hacienda", "🔑 Dos ventas, un papel: se comparan sumadas — 10 cab, 3.354 kg de carne, $18.750.900",
    "10 · 3354 · 18750900", `${juntasAB?.cabezas} · ${juntasAB?.kgNetos} · ${juntasAB?.neto}`,
    juntasAB?.cabezas === 10 && juntasAB?.kgNetos === 3354 && juntasAB?.neto === 18750900, "A-FEAT-1225")
  const preVacas = precargaDesdeVenta({ fecha: "2026-09-03", cliente: "Arre Beef SA", cuit: "30666277550", categoria: "Vaca CUT/Descarte",
    cabezas: 7, kgTotales: 3640, pctDesbaste: 0, precioKg: 5949.49, kgCarne: 1748 })
  chequear("Liquidación de hacienda", "La precarga de una venta al gancho trae los kilos de carne",
    "1748", String(preVacas.linea.kilos), preVacas.linea.kilos === 1748, "A-FEAT-1225")

  // ══ ✅ MARCAR CUOTAS COBRADAS — el mismo cambio desde Cobros y desde el Cash Flow ═════════
  const tres = [
    { dias: 30, pct: 33, vencimiento: "2026-09-03", importe: 32256007.73 },
    { dias: 60, pct: 34, vencimiento: "2026-10-03", importe: 33233462.5 },
    { dias: 90, pct: 33, vencimiento: "2026-11-02", importe: 32256007.72 },
  ]
  const una = marcarCuota(tres, 0, "cobrado", "a cobrar")
  chequear("Liquidación de hacienda", "✅ Con 1 de 3 cuotas cobrada, la liquidación sigue «a cobrar»",
    "cobrado · a cobrar", `${una.plazos[0].estado} · ${una.estadoComprobante}`,
    una.plazos[0].estado === "cobrado" && una.estadoComprobante === "a cobrar", "A-FEAT-1225")
  const cuotasTodas = marcarCuota(marcarCuota(una.plazos, 1, "cobrado", "a cobrar").plazos, 2, "cobrado", "a cobrar")
  chequear("Liquidación de hacienda", "✅ Con las 3 cobradas, la liquidación pasa a «cobrado»",
    "cobrado", cuotasTodas.estadoComprobante, cuotasTodas.estadoComprobante === "cobrado", "A-FEAT-1225")
  chequear("Liquidación de hacienda", "Desmarcar una vuelve la liquidación a «a cobrar»",
    "a cobrar", marcarCuota(cuotasTodas.plazos, 1, "a cobrar", "cobrado").estadoComprobante,
    marcarCuota(cuotasTodas.plazos, 1, "a cobrar", "cobrado").estadoComprobante === "a cobrar", "A-FEAT-1225")
  chequear("Liquidación de hacienda", "🛑 «Conciliado» no lo cambia una marca: lo decide la conciliación",
    "conciliado", marcarCuota(tres, 0, "a cobrar", "conciliado").estadoComprobante,
    marcarCuota(tres, 0, "a cobrar", "conciliado").estadoComprobante === "conciliado", "A-FEAT-1225")
  chequear("Liquidación de hacienda", "El Cash Flow recibe el estado de cada cuota",
    "cobrado · (sin marca)", `${cuotasPorCobrar(una.plazos, 97745477.95, 0, "")[0].estado} · ${cuotasPorCobrar(una.plazos, 97745477.95, 0, "")[1].estado ?? "(sin marca)"}`,
    cuotasPorCobrar(una.plazos, 97745477.95, 0, "")[0].estado === "cobrado" && cuotasPorCobrar(una.plazos, 97745477.95, 0, "")[1].estado === undefined, "A-FEAT-1225")

  // ══ 🕰️ LA VENTA HISTÓRICA — A-FEAT-1226 (2026-10-02) ══════════════════════════════════════
  // Datos de ejemplo con cuenta a mano: 30.000 kg − 3 % = 29.100 kg × $5.000 = $145.500.000 de
  // bruto; CZ 4 % = $5.820.000; neto $139.680.000.
  const baseHist = {
    fecha: "2026-01-27", categoriaId: "cat-novillo", cabezas: 70, kgTotales: 30000, pctDesbaste: 0.03,
    kgCarne: null, precioKg: 5000, pctCz: 0.04, flete: 0, plazo: "30/60/90",
    cliente: "Frigorífico", cuit: "30000000001", notas: "", historica: true, kgNetos: null,
  }
  const hist = armarVentaHistorica(baseHist)
  chequear("Venta histórica", "🕰️ El neto sale con la cuenta de Productivo: 29.100 kg × 5.000 − 4 % = 139.680.000",
    "139680000", String(hist.neto), Math.abs(hist.neto - 139680000) < 0.01, "A-FEAT-1226")
  chequear("Venta histórica", "🔑 Se guarda marcada histórica, sin lote y con el desbaste como FRACCIÓN",
    "true · null · 0.03", `${hist.fila.historica} · ${hist.fila.lote_id} · ${hist.fila.pct_desbaste}`,
    hist.fila.historica === true && hist.fila.lote_id === null && hist.fila.pct_desbaste === 0.03, "A-FEAT-1226")
  chequear("Venta histórica", "Completa y confirmada: no falta nada y no hay avisos (enero es anterior al stock)",
    "0 · 0", `${hist.faltan.length} · ${hist.avisos.length}`, hist.faltan.length === 0 && hist.avisos.length === 0, "A-FEAT-1226")
  const noHist = armarVentaHistorica({ ...baseHist, historica: false })
  chequear("Venta histórica", "🛑 Hacienda NO histórica no se guarda acá: la del stock se vende desde Productivo",
    "1 faltante", `${noHist.faltan.length} faltante`, noHist.faltan.length === 1 && /Productivo/.test(noHist.faltan[0]), "A-FEAT-1226")

  // ── Los kilos NETOS de desbaste, que es el dato que tiene el usuario (2026-10-02) ──
  chequear("Venta histórica", "Sin netos tipeados, se muestran calculados: 30.000 × (1 − 3 %) = 29.100",
    "29100", String(hist.kgNetos), Math.abs(hist.kgNetos - 29100) < 1e-6, "A-FEAT-1226")
  const conNetos = armarVentaHistorica({ ...baseHist, pctDesbaste: 0, kgNetos: 28800 })
  chequear("Venta histórica", "🎚️ Netos tipeados con vivos: el desbaste sale de ahí (1 − 28.800/30.000 = 4 %) y el neto usa 28.800",
    "0.04 · 138240000", `${conNetos.pctDesbaste.toFixed(4)} · ${conNetos.neto}`,
    Math.abs(conNetos.pctDesbaste - 0.04) < 1e-9 && Math.abs(conNetos.neto - 28800 * 5000 * 0.96) < 0.01, "A-FEAT-1226")
  const soloNetos = armarVentaHistorica({ ...baseHist, kgTotales: 0, pctDesbaste: 0, kgNetos: 28800 })
  chequear("Venta histórica", "Sólo netos (sin vivos): se guardan como los kilos de la venta, desbaste 0, y no falta nada",
    "28800 · 0 · 0 faltan", `${soloNetos.fila.kg_totales} · ${soloNetos.fila.pct_desbaste} · ${soloNetos.faltan.length} faltan`,
    soloNetos.fila.kg_totales === 28800 && soloNetos.fila.pct_desbaste === 0 && soloNetos.faltan.length === 0, "A-FEAT-1226")
  const netosDeMas = armarVentaHistorica({ ...baseHist, kgNetos: 31000 })
  chequear("Venta histórica", "🛑 Netos mayores que los vivos no se guardan (el desbaste daría negativo)",
    "kilos netos menores que los vivos", netosDeMas.faltan.join(", "),
    netosDeMas.faltan.includes("kilos netos menores que los vivos"), "A-FEAT-1226")
  const posterior = armarVentaHistorica({ ...baseHist, fecha: "2026-05-10" })
  chequear("Venta histórica", "⚠️ Con fecha posterior a feb-2026 AVISA (lo normal es venderla desde el stock) pero deja guardar",
    "1 aviso · 0 faltan", `${posterior.avisos.length} aviso · ${posterior.faltan.length} faltan`,
    posterior.avisos.length === 1 && posterior.faltan.length === 0, "A-FEAT-1226")
  const ganchoHist = armarVentaHistorica({ ...baseHist, kgCarne: 16000, pctCz: 0 })
  chequear("Venta histórica", "🥩 Al gancho se cobran los kilos de carne: 16.000 × 5.000 = 80.000.000",
    "80000000", String(ganchoHist.neto), ganchoHist.neto === 80000000, "A-FEAT-1226")
  // CZ con 3 decimales (2026-10-02, «no me deja poner con 3 decimales la CZ»): 4,125 % no se redondea.
  const cz3 = armarVentaHistorica({ ...baseHist, pctCz: parseNumeroAR("4,125") / 100 })
  chequear("Venta histórica", "CZ de 4,125 % se usa entera: 145.500.000 × 4,125 % = 6.001.875 (con 4,13 daría 6.009.150)",
    "6001875", String(Math.round(cz3.cz * 100) / 100), Math.abs(cz3.cz - 6001875) < 0.01, "A-FEAT-1226")
  const conCuenta = armarVentaHistorica({ ...baseHist, cuentaContable: "Venta de hacienda", centroCosto: "" })
  chequear("Venta histórica", "La cuenta contable se guarda con la venta; centro de costo vacío queda vacío (manda el de la categoría)",
    "Venta de hacienda · null", `${conCuenta.fila.cuenta_contable} · ${conCuenta.fila.centro_costo}`,
    conCuenta.fila.cuenta_contable === "Venta de hacienda" && conCuenta.fila.centro_costo === null, "A-FEAT-1226")
  const sinCliente = armarVentaHistorica({ ...baseHist, cuit: "" })
  chequear("Venta histórica", "Sin CUIT del cliente no se guarda (§ Contrapartes)",
    "cliente (con CUIT)", sinCliente.faltan.join(", "), sinCliente.faltan.includes("cliente (con CUIT)"), "A-FEAT-1226")


  // ══ 💰 EL DETALLE DEL COBRO (A-FEAT-1228) — la liquidación de enero de Genta, con los datos reales ══
  // Importe neto 138.746.475. Cuatro pagos a cuenta (5 M · 8 M · 2,1 M · 116.396.073,85), el echeq
  // endosado (4.466.876,20), la FC 77393 de Genta descontada (279.174,47). Las retenciones de
  // Ganancias todavía no están cargadas: el saldo tiene que dar exactamente lo que faltaría.
  const fuentesEnero = {
    movimientos: [
      // El crédito del 26/02 ya está representado por su anticipo: NO se cuenta otra vez.
      { id: "mov-2602", fecha: "2026-02-26", creditos: 116396073.85, anticipo_id: "ant-4" },
    ],
    anticipos: [
      { id: "ant-1", fecha_pago: "2026-02-04", monto: 5000000, metodo_pago: "transferencia", estado_pago: "conciliado", descripcion: "Adelanto" },
      { id: "ant-2", fecha_pago: "2026-02-11", monto: 8000000, metodo_pago: "transferencia", estado_pago: "conciliado", descripcion: "Adelanto Nro 2" },
      { id: "ant-3", fecha_pago: "2026-02-23", monto: 2100000, metodo_pago: "transferencia", estado_pago: "conciliado", descripcion: null },
      { id: "ant-4", fecha_pago: "2026-02-26", monto: 116396073.85, metodo_pago: "transferencia", estado_pago: "conciliado", descripcion: null },
      { id: "ant-5", fecha_pago: "2026-02-26", monto: 4466876.20, metodo_pago: "echeq", estado_pago: "endosado", descripcion: "Echeq endosado a Almacén Veterinario" },
    ],
    compensaciones: [{ id: "ap-1", anticipo_id: "ant-1", monto_aplicado: 279174.47, fecha: "2026-02-26", comprobante: "liquidación 77393" }],
    retenciones: [],
  }
  const detEnero = armarDetalleCobro(fuentesEnero, 138746475)
  chequear("Detalle del cobro", "💰 Enero de Genta: pagos a cuenta + echeq endosado + compensación = 136.242.124,52",
    "136242124.52", String(detEnero.total), detEnero.total === 136242124.52, "A-FEAT-1228")
  chequear("Detalle del cobro", "🔑 El crédito del banco que ya tiene su pago a cuenta NO se cuenta dos veces (6 líneas, no 7)",
    "6", String(detEnero.lineas.length), detEnero.lineas.length === 6 && !detEnero.lineas.some(l => l.medio === "banco"), "A-FEAT-1228")
  chequear("Detalle del cobro", "🧮 Sin las retenciones cargadas, el saldo es lo que faltaría: 2.504.350,48",
    "2504350.48 · no cierra", `${detEnero.saldo} · ${detEnero.cierra ? "cierra" : "no cierra"}`,
    detEnero.saldo === 2504350.48 && !detEnero.cierra, "A-FEAT-1228")
  chequear("Detalle del cobro", "El echeq endosado y la compensación aparecen con su medio",
    "4466876.2 · 279174.47", `${detEnero.porMedio.echeq_endosado} · ${detEnero.porMedio.compensacion}`,
    detEnero.porMedio.echeq_endosado === 4466876.2 && detEnero.porMedio.compensacion === 279174.47, "A-FEAT-1228")
  const conRetsEnero = armarDetalleCobro({ ...fuentesEnero, retenciones: [{ id: "r1", tipo: "ganancias", monto: 2504350.48, fecha: "2026-02-26", nro_certificado: "123" }] }, 138746475)
  chequear("Detalle del cobro", "✓ Con las retenciones de Ganancias cargadas, el detalle cierra contra el papel",
    "cierra · Ret. Ganancias · cert. 123", `${conRetsEnero.cierra ? "cierra" : "saldo " + conRetsEnero.saldo} · ${conRetsEnero.lineas.find(l => l.medio === "retencion")?.descripcion}`,
    conRetsEnero.cierra && conRetsEnero.lineas.find(l => l.medio === "retencion")?.descripcion === "Ret. Ganancias · cert. 123", "A-FEAT-1228")
  chequear("Detalle del cobro", "Las líneas van ordenadas por fecha (la del 04/02 primero)",
    "2026-02-04", detEnero.lineas[0].fecha ?? "", detEnero.lineas[0].fecha === "2026-02-04", "A-FEAT-1228")
  // Con una sola cuota del 100 % (la liquidación de enero), lo imputado la cancela; el banco directo no se imputa.
  const cuotaEnero = repartirEnCuotas([{ vencimiento: "2026-02-26", importe: 138746475 }], 0, imputacionesDeCobro(conRetsEnero.lineas), "")
  chequear("Detalle del cobro", "La cuota del papel queda en 0 con todo imputado (sale del Cash Flow)",
    "0", String(cuotaEnero[0].aCobrar), cuotaEnero[0].aCobrar === 0, "A-FEAT-1228")
  const conBancoDirecto = armarDetalleCobro({ movimientos: [{ id: "m", fecha: "2026-09-03", creditos: 31672612.47, anticipo_id: null }], anticipos: [], compensaciones: [], retenciones: [] }, 31672612.47)
  chequear("Detalle del cobro", "Un crédito conciliado directo (sin pago a cuenta) cuenta como «banco» y TAMBIÉN baja su cuota",
    "banco · cierra · 1 imputación", `${conBancoDirecto.lineas[0].medio} · ${conBancoDirecto.cierra ? "cierra" : "no"} · ${imputacionesDeCobro(conBancoDirecto.lineas).length} imputación`,
    conBancoDirecto.lineas[0].medio === "banco" && conBancoDirecto.cierra && imputacionesDeCobro(conBancoDirecto.lineas).length === 1, "A-FEAT-1228")
  // 🧨 El caso que lo rompió (2026-10-02): UNA cuota de enero, cobrada en partes por el banco directo.
  // Con el primer crédito de $2,1 M la cuota quedaba «conciliada» entera y la venta desaparecía.
  const cuotaUna = [{ vencimiento: "2026-02-26", importe: 138746475 }]
  const trasUno = repartirEnCuotas(cuotaUna, 0, imputacionesDeCobro(armarDetalleCobro({ movimientos: [{ id: "m1", fecha: "2026-02-23", creditos: 2100000, anticipo_id: null }], anticipos: [], compensaciones: [], retenciones: [] }, 138746475).lineas), "")
  chequear("Detalle del cobro", "🧨 Una cuota cobrada en partes: tras $2,1 M por banco le faltan 136.646.475 (no queda «conciliada»)",
    "136646475", String(trasUno[0].aCobrar), trasUno[0].aCobrar === 136646475, "A-FEAT-1228")


  // ══ 🧾 Retenciones recibidas en el export del subdiario (A-FEAT-1227) ══════════════════════
  const hojaRet = filasRetenciones(
    [{ fecha: "2026-09-03", tipo: "ganancias", monto: 583395.25, nro_certificado: null, denominacion_cliente: "GENTA", cuit_cliente: "30526554562", comprobante: "11-86270" }],
    [{ fecha: "2026-08-10", nro: "11-86270", cliente: "GENTA", cuit: "30526554562", ret_iva: 0, ret_iibb: 675905.18 },
     { fecha: "2026-08-15", nro: "FC 1", cliente: "X", cuit: "1", ret_iva: null, ret_iibb: null }],
  )
  chequear("Retenciones en el subdiario", "🧾 Certificado + impresa: 2 filas (la FC sin retenciones no suma una vacía), ordenadas por fecha",
    "2 · 2026-08-10 IIBB · 2026-09-03 Ganancias", `${hojaRet.filas.length} · ${hojaRet.filas.map(f => f.Fecha + " " + f.Tipo).join(" · ")}`,
    hojaRet.filas.length === 2 && hojaRet.filas[0].Tipo === "IIBB" && hojaRet.filas[1].Tipo === "Ganancias", "A-FEAT-1227")
  chequear("Retenciones en el subdiario", "Totales por tipo y total general",
    "IIBB 675905.18 · Ganancias 583395.25 · 1259300.43", `IIBB ${hojaRet.porTipo.IIBB} · Ganancias ${hojaRet.porTipo.Ganancias} · ${hojaRet.total}`,
    hojaRet.porTipo.IIBB === 675905.18 && hojaRet.porTipo.Ganancias === 583395.25 && hojaRet.total === 1259300.43, "A-FEAT-1227")

  // ══ ↕️ SÓLO DÉBITOS / SÓLO CRÉDITOS (A-FEAT-1224) ═══════════════════════════════════════════
  // Pedido del usuario 2026-10-01. Y el hallazgo que vino con él: el «Rango de Montos» del Extracto
  // comparaba SÓLO contra débitos. Los casos marcados 🧨 fallan con esa lógica vieja.

  // Cómo filtraba ANTES el rango (sólo la columna de débitos, sin exigir que no sea cero).
  const pasabaAntes = (f: { debitos: number; creditos: number }, desde?: number, hasta?: number) =>
    (!desde || f.debitos >= desde) && (!hasta || f.debitos <= hasta)
  const credito500k = { debitos: 0, creditos: 500000 }
  const debito500k = { debitos: 500000, creditos: 0 }

  chequear("Débitos / créditos", "🧨 ANTES un crédito de $500.000 NO aparecía en «400.000 a 600.000»",
    "no aparecía", pasabaAntes(credito500k, 400000, 600000) ? "aparecía" : "no aparecía",
    pasabaAntes(credito500k, 400000, 600000) === false, "A-FEAT-1224")

  const todosConRango = filtroDeSentidoYMonto("todos", 400000, 600000)
  chequear("Débitos / créditos", "🔑 AHORA con «todos» el rango mira las DOS columnas",
    "débitos o créditos entre 400000 y 600000",
    todosConRango.rangoEnCualquiera ?? "(nada)",
    todosConRango.rangoEnCualquiera ===
      "and(debitos.gt.0,debitos.gte.400000,debitos.lte.600000),and(creditos.gt.0,creditos.gte.400000,creditos.lte.600000)",
    "A-FEAT-1224")

  // 🧨 El otro lado del mismo bug: «hasta» solo dejaba pasar TODOS los créditos (débito 0 <= cualquier cosa).
  chequear("Débitos / créditos", "🧨 ANTES «hasta $100» dejaba pasar un crédito de $500.000",
    "lo dejaba pasar", pasabaAntes(credito500k, undefined, 100) ? "lo dejaba pasar" : "lo frenaba",
    pasabaAntes(credito500k, undefined, 100) === true, "A-FEAT-1224")
  const soloHasta = filtroDeSentidoYMonto("todos", undefined, 100)
  chequear("Débitos / créditos", "🔑 AHORA cada condición exige importe en ESA columna (> 0)",
    "las dos llevan .gt.0",
    soloHasta.rangoEnCualquiera ?? "(nada)",
    soloHasta.rangoEnCualquiera === "and(debitos.gt.0,debitos.lte.100),and(creditos.gt.0,creditos.lte.100)",
    "A-FEAT-1224")

  const soloCreditos = filtroDeSentidoYMonto("creditos", 400000, 600000)
  chequear("Débitos / créditos", "«Sólo créditos» + monto: el rango va contra CRÉDITOS, no contra débitos",
    "creditos 400000–600000",
    `${soloCreditos.soloColumna} ${soloCreditos.rango?.columna} ${soloCreditos.rango?.desde}–${soloCreditos.rango?.hasta}`,
    soloCreditos.soloColumna === "creditos" && soloCreditos.rango?.columna === "creditos"
      && soloCreditos.rango?.desde === 400000 && soloCreditos.rango?.hasta === 600000, "A-FEAT-1224")

  chequear("Débitos / créditos", "Sin sentido y sin monto, la consulta no se toca",
    "{}", JSON.stringify(filtroDeSentidoYMonto("todos")),
    JSON.stringify(filtroDeSentidoYMonto("todos")) === "{}", "A-FEAT-1224")

  chequear("Débitos / créditos", "Un monto en 0 no filtra (igual que antes)",
    "sólo la columna, sin rango", JSON.stringify(filtroDeSentidoYMonto("debitos", 0, 0)),
    JSON.stringify(filtroDeSentidoYMonto("debitos", 0, 0)) === JSON.stringify({ soloColumna: "debitos" }), "A-FEAT-1224")

  // Cash Flow: filtra lo que ya trajo.
  const ambos = new Set<"debitos" | "creditos">(["debitos", "creditos"])
  const filaCero = { debitos: 0, creditos: 0 }
  chequear("Débitos / créditos", "Cash Flow: con los DOS chips prendidos no se esconde nada, ni las filas en cero",
    "pasan las tres",
    [debito500k, credito500k, filaCero].map(f => pasaSentido(f, ambos)).join(" "),
    [debito500k, credito500k, filaCero].every(f => pasaSentido(f, ambos)), "A-FEAT-1224")

  const soloDeb = new Set<"debitos" | "creditos">(["debitos"])
  chequear("Débitos / créditos", "Cash Flow: sólo Débitos deja el débito y saca el crédito y el cero",
    "true false false",
    [debito500k, credito500k, filaCero].map(f => pasaSentido(f, soloDeb)).join(" "),
    pasaSentido(debito500k, soloDeb) && !pasaSentido(credito500k, soloDeb) && !pasaSentido(filaCero, soloDeb),
    "A-FEAT-1224")

  chequear("Débitos / créditos", "Cash Flow: con los dos apagados no pasa nada (como Estado y Origen)",
    "false", String(pasaSentido(debito500k, new Set())),
    pasaSentido(debito500k, new Set()) === false, "A-FEAT-1224")


  /**
   * 📎 **El archivo digital de una factura, visto desde el Cash Flow — A-FEAT-1185.**
   *
   * El pedido del usuario fue *«en caso de no estar debe ser claro que no está y no que salte un
   * bug»*, y lo que lo hace posible es **el orden en que se preguntan las cosas**: primero si la
   * fila viene de una factura, y sólo después si tiene PDF.
   *
   * 🔑 **Por eso hay caso, y por eso falla con el código anterior.** Antes de A-FEAT-1185 la regla
   * era `pdf_drive_url ? 'con' : (fc === 'Portal' ? 'portal' : 'falta')` — sin mirar el origen. Con
   * esa versión, **una cuota de template caía en `falta`** y salía con la cruz roja, que es
   * exactamente el falso error que había que evitar. El primer caso de abajo lo agarra.
   */
  {
    // Una cuota de template: NUNCA va a tener factura de ARCA. No es un hueco, es por diseño.
    chequear("Archivo de factura", "🔑 Una cuota de template NO se marca como faltante",
      "sin-factura",
      estadoArchivoDigital({ origen: "TEMPLATE" }),
      estadoArchivoDigital({ origen: "TEMPLATE" }) === "sin-factura", "A-FEAT-1185")

    // Los otros tres orígenes que tampoco nacen de una factura.
    const otros = (["ANTICIPO", "SUELDO", "VENTA"] as const)
      .map(o => estadoArchivoDigital({ origen: o }))
    chequear("Archivo de factura", "Anticipo, sueldo y venta tampoco son faltantes",
      "sin-factura ×3", otros.join(" "),
      otros.every(e => e === "sin-factura"), "A-FEAT-1185")

    // Una factura de ARCA con su PDF archivado: se puede abrir.
    chequear("Archivo de factura", "Factura con PDF archivado se puede ver",
      "con",
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: "https://drive.google.com/file/d/abc" }),
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: "https://drive.google.com/file/d/abc" }) === "con",
      "A-FEAT-1185")

    // Una factura de ARCA sin PDF y que NO es de Portal: acá sí falta algo.
    chequear("Archivo de factura", "🔴 Factura de ARCA sin PDF sí es un faltante",
      "falta",
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: null, fc: "No" }),
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: null, fc: "No" }) === "falta", "A-FEAT-1185")

    // De Portal: no llega por mail, así que no tener PDF es lo esperable.
    chequear("Archivo de factura", "Una de Portal sin PDF es esperable, no un error",
      "portal",
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: null, fc: "Portal" }),
      estadoArchivoDigital({ origen: "ARCA", pdf_drive_url: null, fc: "Portal" }) === "portal", "A-FEAT-1185")

    // Un pago agrupado: son varias facturas, no hay un PDF único que ofrecer.
    chequear("Archivo de factura", "Un pago agrupado no ofrece un PDF suelto",
      "grupo",
      estadoArchivoDigital({ origen: "ARCA", facturas_agrupadas: 3, pdf_drive_url: "https://x/1" }),
      estadoArchivoDigital({ origen: "ARCA", facturas_agrupadas: 3, pdf_drive_url: "https://x/1" }) === "grupo",
      "A-FEAT-1185")

    // 📌 El subdiario no manda `origen` porque todas sus filas SON facturas. Si eso se rompiera,
    //    la pantalla que ya funcionaba empezaría a mostrar guiones grises en vez de sus íconos.
    chequear("Archivo de factura", "Sin `origen` se asume factura — el subdiario no cambia",
      "con",
      estadoArchivoDigital({ pdf_drive_url: "https://drive.google.com/file/d/abc" }),
      estadoArchivoDigital({ pdf_drive_url: "https://drive.google.com/file/d/abc" }) === "con",
      "A-FEAT-1185")

    // 🛑 La frontera del pedido: `falta` y `sin-factura` NO pueden dar lo mismo.
    chequear("Archivo de factura", "🛑 «falta» y «no le corresponde» son estados distintos",
      "distintos",
      estadoArchivoDigital({ origen: "ARCA", fc: "No" }) === estadoArchivoDigital({ origen: "TEMPLATE" })
        ? "iguales" : "distintos",
      estadoArchivoDigital({ origen: "ARCA", fc: "No" }) !== estadoArchivoDigital({ origen: "TEMPLATE" }),
      "A-FEAT-1185")
  }

  /**
   * 📅 **EL CORTE DEL EJERCICIO ES EL SUBDIARIO — A-FEAT-1184.**
   *
   * La regla la dio el usuario el 2026-09-28: *«gasto es los 12 subdiarios y no las fechas de las
   * facturas»*. Los casos usan **movimientos reales de la base**, escritos acá como constantes:
   * el subdiario de enero 2026 tiene una factura del 17/09/2025, y el de julio 2026 una del
   * 23/06/2026 — que es justamente una a provisionar.
   *
   * 🔑 **Por qué estos casos valen**: con un corte por `fecha_emision` —que es lo que parecía
   * obvio y lo que yo tenía escrito antes de que él me corrigiera— **los cuatro primeros dan mal**.
   */
  {
    const ej = armarEjercicio(2026, 6) // MSA 25/26

    chequear("Balance · ejercicio", "🔑 El ejercicio son 12 subdiarios, de julio a junio",
      "2025-07 … 2026-06 (12)",
      `${claveSubdiario(ej.subdiarios[0].anio, ej.subdiarios[0].mes)} … ${claveSubdiario(ej.subdiarios[11].anio, ej.subdiarios[11].mes)} (${ej.subdiarios.length})`,
      ej.subdiarios.length === 12 &&
      claveSubdiario(ej.subdiarios[0].anio, ej.subdiarios[0].mes) === "2025-07" &&
      claveSubdiario(ej.subdiarios[11].anio, ej.subdiarios[11].mes) === "2026-06", "A-FEAT-1184")

    chequear("Balance · ejercicio", "El cierre de MSA es el 30/06 y se etiqueta 25/26",
      "2026-06-30 · 25/26", `${ej.fechaCierre} · ${ej.etiqueta}`,
      ej.fechaCierre === "2026-06-30" && ej.etiqueta === "25/26", "A-FEAT-1184")

    // PAM y MA cierran el 31/12: el ejercicio es calendario y se nombra por su unico año.
    const cal = armarEjercicio(2025, 12)
    chequear("Balance · ejercicio", "PAM/MA cierran el 31/12: enero a diciembre",
      "2025-01 … 2025-12 · 2025",
      `${claveSubdiario(cal.subdiarios[0].anio, cal.subdiarios[0].mes)} … ${claveSubdiario(cal.subdiarios[11].anio, cal.subdiarios[11].mes)} · ${cal.etiqueta}`,
      claveSubdiario(cal.subdiarios[0].anio, cal.subdiarios[0].mes) === "2025-01" &&
      claveSubdiario(cal.subdiarios[11].anio, cal.subdiarios[11].mes) === "2025-12" &&
      cal.etiqueta === "2025", "A-FEAT-1184")

    // 🔴 EL CASO QUE ROMPE EL CORTE POR FECHA: factura de septiembre 2025 que entro al subdiario
    //    de enero 2026. Es del ejercicio por el subdiario, y tambien lo seria por fecha — pero
    //    lo que decide es el subdiario.
    chequear("Balance · ejercicio", "🔑 Factura del 17/09/2025 que entró al subdiario de enero 2026: ES del ejercicio",
      "sí", esDelEjercicio(2026, 1, ej) ? "sí" : "no",
      esDelEjercicio(2026, 1, ej) === true, "A-FEAT-1184")

    // 🔴 LA PROVISION: fecha del ejercicio, subdiario posterior. Con un corte por fecha, esta
    //    factura se contaria como gasto del ejercicio — y esta MAL: no entro.
    chequear("Balance · ejercicio", "🔑 Factura del 23/06/2026 que entró al subdiario de julio 2026 es PROVISIÓN",
      "provisión", esProvision("2026-06-23", 2026, 7, ej) ? "provisión" : "no",
      esProvision("2026-06-23", 2026, 7, ej) === true, "A-FEAT-1184")

    chequear("Balance · ejercicio", "Y esa misma factura NO está en el ejercicio",
      "fuera", esDelEjercicio(2026, 7, ej) ? "dentro" : "fuera",
      esDelEjercicio(2026, 7, ej) === false, "A-FEAT-1184")

    // Una factura POSTERIOR al cierre que entro despues no es provision: es del ejercicio siguiente.
    chequear("Balance · ejercicio", "Una factura del 15/07/2026 en el subdiario de julio NO es provisión",
      "no", esProvision("2026-07-15", 2026, 7, ej) ? "sí" : "no",
      esProvision("2026-07-15", 2026, 7, ej) === false, "A-FEAT-1184")

    // Sin subdiario no se inventa nada: no es provision, va al monton de "sin clasificar".
    chequear("Balance · ejercicio", "⚠️ Sin subdiario no se adivina: no cuenta como provisión",
      "no", esProvision("2026-05-10", null, null, ej) ? "sí" : "no",
      esProvision("2026-05-10", null, null, ej) === false, "A-FEAT-1184")

    // Un mes faltante no se nota en el total: por eso se detecta.
    const faltan = subdiariosVacios(ej, [{ anio: 2025, mes: 7 }, { anio: 2025, mes: 8 }])
    chequear("Balance · ejercicio", "Detecta los subdiarios del ejercicio que quedaron vacíos",
      "10 vacíos", `${faltan.length} vacíos`, faltan.length === 10, "A-FEAT-1184")
  }

  /**
   * 📖 **EL LIBRO DIARIO Y SU CONTROL POR MASAS — A-FEAT-1184 / A-DAT-61.**
   *
   * El caso de diciembre es **real**: el usuario cargó ese mes dos veces sin querer, y los números
   * son los medidos el 2026-09-28. Es el control que **frena**, porque sumar las dos fuentes
   * infla el total del ejercicio sin que se note.
   */
  {
    const ej = armarEjercicio(2026, 6)
    const comp = (over: Partial<AsientoLibroDiario>): AsientoLibroDiario => ({
      id: Math.random().toString(36).slice(2), fuente: "arca", subdiario: "2026-01",
      fecha: "2026-01-10", tipo: 1, punto_venta: 1, numero: 1, cuit: "30617786016",
      denominacion: "PROVEEDOR SA", neto_gravado: 100, no_gravado: 0, exento: 0,
      otros_tributos: 0, iva: 21, total: 121, cuenta_contable: "", nro_cuenta: "",
      centro_costo: "", ...over,
    })

    // Diciembre cargado por las dos fuentes: historico 2 comprobantes, ARCA 1.
    const conDiciembreDoble = [
      comp({ fuente: "historico", subdiario: "2025-12", numero: 10, total: 121 }),
      comp({ fuente: "historico", subdiario: "2025-12", numero: 11, total: 121 }),
      comp({ fuente: "arca", subdiario: "2025-12", numero: 12, total: 121 }),
      comp({ fuente: "arca", subdiario: "2026-01", numero: 20 }),
    ]
    const dup = detectarSubdiariosDuplicados(conDiciembreDoble)
    chequear("Balance · libro diario", "🛑 Detecta el subdiario cargado en DOS fuentes",
      "2025-12", dup.map(d => d.subdiario).join(",") || "ninguno",
      dup.length === 1 && dup[0].subdiario === "2025-12", "A-DAT-61")

    chequear("Balance · libro diario", "Y dice cuánto suma cada fuente, para poder elegir",
      "historico 242 · arca 121",
      dup[0]?.porFuente.map(f => `${f.fuente} ${f.total}`).join(" · ") || "-",
      dup[0]?.porFuente.find(f => f.fuente === "historico")?.total === 242 &&
      dup[0]?.porFuente.find(f => f.fuente === "arca")?.total === 121, "A-DAT-61")

    const libro = armarLibroDiario(conDiciembreDoble, [], ej)
    chequear("Balance · libro diario", "🛑 Con un mes duplicado, el papel NO se puede entregar",
      "frena", libro.controles.sePuedeEntregar ? "deja pasar" : "frena",
      libro.controles.sePuedeEntregar === false, "A-DAT-61")

    chequear("Balance · libro diario", "Y el motivo se dice en castellano, no en códigos",
      "menciona el subdiario",
      libro.controles.motivos.join(" ").includes("2025-12") ? "menciona el subdiario" : "no lo menciona",
      libro.controles.motivos.join(" ").includes("2025-12"), "A-DAT-61")

    // Un mismo comprobante dos veces (misma identidad) tambien frena.
    const repetido = [comp({ numero: 77 }), comp({ numero: 77, fuente: "historico", subdiario: "2026-01" })]
    chequear("Balance · libro diario", "Detecta el mismo comprobante cargado dos veces",
      "1 choque", `${detectarChoques(repetido).length} choque(s)`,
      detectarChoques(repetido).length === 1, "A-FEAT-1184")

    // 📌 Sin numero no hay identidad: no se inventan choques.
    const sinNumero = [comp({ numero: null }), comp({ numero: null })]
    chequear("Balance · libro diario", "⚠️ Sin número de comprobante no se inventa un choque",
      "0 choques", `${detectarChoques(sinNumero).length} choque(s)`,
      detectarChoques(sinNumero).length === 0, "A-FEAT-1184")

    // Un libro limpio se puede entregar.
    const limpio = armarLibroDiario([comp({ subdiario: "2026-01", numero: 1 })], [], ej)
    chequear("Balance · libro diario", "Un libro sin choques ni duplicados SÍ se entrega",
      "se entrega", limpio.controles.sePuedeEntregar ? "se entrega" : "frena",
      limpio.controles.sePuedeEntregar === true, "A-FEAT-1184")

    // La provision sale sola, sin que nadie marque nada.
    const conProvision = armarLibroDiario([
      comp({ subdiario: "2026-01", numero: 1 }),
      comp({ subdiario: "2026-07", numero: 2, fecha: "2026-06-23" }),
    ], [], ej)
    chequear("Balance · libro diario", "🔑 La provisión se calcula sola: 1 del ejercicio, 1 provisión",
      "1 y 1", `${conProvision.compras.length} y ${conProvision.provisiones.length}`,
      conProvision.compras.length === 1 && conProvision.provisiones.length === 1, "A-FEAT-1184")

    // Nada se descarta en silencio: sin subdiario va a su propio monton.
    const conHuerfano = armarLibroDiario([comp({ subdiario: "" })], [], ej)
    chequear("Balance · libro diario", "⚠️ Un comprobante sin subdiario no se pierde: queda aparte",
      "1 sin subdiario", `${conHuerfano.sinSubdiario.length} sin subdiario`,
      conHuerfano.sinSubdiario.length === 1, "A-FEAT-1184")
  }
  /**
   * 🔤 **El tipo de comprobante del HISTÓRICO es texto libre — A-FEAT-1184.**
   *
   * Encontrado el 2026-09-28 comparando diciembre: `comprobantes_historico` guarda
   * `"1 - Factura A"` donde ARCA guarda `1`. Sin normalizar, `Number()` da **NaN** y pasan dos
   * cosas, las dos silenciosas: ninguna Fac C se reconoce como *sin crédito fiscal* (el control de
   * cuadratura da mal) y el mismo comprobante en las dos fuentes **no se detecta como choque**,
   * que es justo lo que hace falta para resolver diciembre.
   *
   * 📌 Las nueve variantes son las **reales** de los 273 comprobantes del histórico de MSA.
   */
  {
    chequear("Balance · tipo de comprobante", "🔑 «1 - Factura A» es el tipo 1, no NaN",
      "1", String(tipoDesdeTexto("1 - Factura A")),
      tipoDesdeTexto("1 - Factura A") === 1, "A-FEAT-1184")

    chequear("Balance · tipo de comprobante", "🔴 «11 - Factura C» es 11 — de esto depende «sin crédito fiscal»",
      "11", String(tipoDesdeTexto("11 - Factura C")),
      tipoDesdeTexto("11 - Factura C") === 11, "A-FEAT-1184")

    chequear("Balance · tipo de comprobante", "«3 - Nota de Crédito A» es 3",
      "3", String(tipoDesdeTexto("3 - Nota de Crédito A")),
      tipoDesdeTexto("3 - Nota de Crédito A") === 3, "A-FEAT-1184")

    // Los tickets se escribieron de tres formas distintas y NINGUNA trae el codigo.
    const tickets = ["Ticket Factura A", "Ticket factura A", "Tique Factura A"].map(tipoDesdeTexto)
    chequear("Balance · tipo de comprobante", "Las 3 grafías de ticket dan el mismo tipo 81",
      "81 81 81", tickets.join(" "),
      tickets.every(x => x === 81), "A-FEAT-1184")

    chequear("Balance · tipo de comprobante", "«81 - Tique Factura A Controladores Fiscales» también es 81",
      "81", String(tipoDesdeTexto("81 - Tique Factura A Controladores Fiscales")),
      tipoDesdeTexto("81 - Tique Factura A Controladores Fiscales") === 81, "A-FEAT-1184")

    // ⚠️ Una poliza NO es comprobante de ARCA: se carga a mano y por eso puede faltar (A-AUTO-05).
    chequear("Balance · tipo de comprobante", "⚠️ «Poliza Seguro» no tiene código de ARCA: devuelve nulo, no se inventa",
      "nulo", tipoDesdeTexto("Poliza Seguro") === null ? "nulo" : String(tipoDesdeTexto("Poliza Seguro")),
      tipoDesdeTexto("Poliza Seguro") === null, "A-AUTO-05")

    // ARCA ya manda numero: tiene que pasar derecho.
    chequear("Balance · tipo de comprobante", "Un número de ARCA pasa tal cual",
      "11", String(tipoDesdeTexto(11)),
      tipoDesdeTexto(11) === 11, "A-FEAT-1184")

    chequear("Balance · tipo de comprobante", "Vacío o nulo devuelve nulo",
      "nulo nulo",
      [tipoDesdeTexto(null), tipoDesdeTexto("")].map(x => x === null ? "nulo" : String(x)).join(" "),
      tipoDesdeTexto(null) === null && tipoDesdeTexto("") === null, "A-FEAT-1184")

    // 🛑 El caso que prueba que el arreglo SIRVE: la misma factura en las dos fuentes, una con el
    //    texto del historico y otra con el numero de ARCA, tiene que dar UN choque.
    const base = {
      id: "x", subdiario: "2025-12", fecha: "2025-12-04", punto_venta: 2, numero: 1984,
      cuit: "30714279315", denominacion: "LA MERCURE S.R.L.", neto_gravado: 0, no_gravado: 0,
      exento: 0, otros_tributos: 0, iva: 0, total: 2430800, cuenta_contable: "",
      nro_cuenta: "", centro_costo: "",
    }
    const mismaFactura = [
      { ...base, fuente: "historico" as const, tipo: tipoDesdeTexto("1 - Factura A") },
      { ...base, fuente: "arca" as const, tipo: tipoDesdeTexto(1) },
    ]
    chequear("Balance · tipo de comprobante", "🛑 La misma factura en las 2 fuentes AHORA se detecta",
      "1 choque", `${detectarChoques(mismaFactura).length} choque(s)`,
      detectarChoques(mismaFactura).length === 1, "A-DAT-61")
  }

  /**
   * 🔑 **CUÁL FUENTE VALE: no alcanza con saber que un mes está duplicado — A-DAT-61.**
   *
   * Saber que diciembre está en las dos tablas no deja decidir nada. Lo que deja decidir es si
   * **una fuente CONTIENE a la otra**: si la contiene, se elige la más completa y listo; si cada
   * una tiene lo suyo, hay que fusionarlas, que es otro trabajo.
   *
   * 📌 El caso de abajo reproduce **el de diciembre 2025 real** (medido 2026-09-28): los 40 de
   * ARCA están **todos** en el histórico, que tiene **4 más** — una NC de Federación Patronal y
   * 3 tickets — por \$86.613, que es exactamente la diferencia entre los dos totales.
   */
  {
    const base = {
      subdiario: "2025-12", fecha: "2025-12-04", punto_venta: 2, cuit: "30714279315",
      denominacion: "PROVEEDOR", neto_gravado: 0, no_gravado: 0, exento: 0,
      otros_tributos: 0, iva: 0, cuenta_contable: "", nro_cuenta: "", centro_costo: "",
    }
    const comun = (numero: number, total: number) => ([
      { ...base, id: `h${numero}`, fuente: "historico" as const, tipo: 1, numero, total },
      { ...base, id: `a${numero}`, fuente: "arca" as const, tipo: 1, numero, total },
    ])
    // Los 4 que SOLO tiene el historico, con sus importes reales.
    const soloHistorico = [
      { ...base, id: "x1", fuente: "historico" as const, tipo: 3, numero: 34160783,
        denominacion: "FEDERACION PATRONAL SEGUROS S.A.U", fecha: "2025-12-29", total: -138118 },
      { ...base, id: "x2", fuente: "historico" as const, tipo: 81, numero: 32309,
        denominacion: "PAN AMERICAN ENERGY S.L.", fecha: "2025-12-10", total: 69447 },
      { ...base, id: "x3", fuente: "historico" as const, tipo: 81, numero: 17645,
        denominacion: "PAN AMERICAN ENERGY S.L.", fecha: "2025-12-02", total: 73264 },
      { ...base, id: "x4", fuente: "historico" as const, tipo: 81, numero: 36430,
        denominacion: "PARADOR SAN PEDRO", fecha: "2025-10-02", total: 82020 },
    ]
    const diciembre = [...comun(1984, 1000), ...comun(1985, 2000), ...soloHistorico]
    const d = detectarSubdiariosDuplicados(diciembre)[0]

    chequear("Balance · cuál fuente vale", "Dice cuántos comprobantes son el MISMO cargado dos veces",
      "2 en común", `${d.enComun} en común`, d.enComun === 2, "A-DAT-61")

    chequear("Balance · cuál fuente vale", "🔑 Sólo una fuente tiene cosas propias → la otra está contenida",
      "1 fuente con propios", `${d.soloEn.length} fuente(s) con propios`,
      d.soloEn.length === 1 && d.soloEn[0].fuente === "historico", "A-DAT-61")

    chequear("Balance · cuál fuente vale", "Y lista los 4 que hay que mirar, con nombre e importe",
      "4 · FEDERACION PATRONAL SEGUROS S.A.U",
      `${d.soloEn[0]?.asientos.length} · ${d.soloEn[0]?.asientos[0]?.denominacion}`,
      d.soloEn[0]?.asientos.length === 4 &&
      d.soloEn[0]?.asientos[0]?.denominacion === "FEDERACION PATRONAL SEGUROS S.A.U", "A-DAT-61")

    // 🔑 El control que lo ata todo: lo que sobra TIENE que explicar la diferencia entre totales.
    const sobra = d.soloEn[0].asientos.reduce((s, a) => s + a.total, 0)
    chequear("Balance · cuál fuente vale", "🧮 Lo que sobra explica EXACTAMENTE la diferencia de totales",
      `${Math.round(d.diferencia)}`, `${Math.round(sobra)}`,
      Math.abs(sobra - d.diferencia) < 0.01, "A-DAT-61")

    // Si las dos fuentes tienen lo suyo, NO se puede elegir: hay que fusionar, y se dice.
    const cruzado = [
      ...comun(10, 500),
      { ...base, id: "s1", fuente: "historico" as const, tipo: 1, numero: 11, total: 100 },
      { ...base, id: "s2", fuente: "arca" as const, tipo: 1, numero: 12, total: 100 },
    ]
    chequear("Balance · cuál fuente vale", "⚠️ Si cada fuente tiene lo suyo, avisa que hay que FUSIONAR",
      "2 fuentes con propios",
      `${detectarSubdiariosDuplicados(cruzado)[0].soloEn.length} fuente(s) con propios`,
      detectarSubdiariosDuplicados(cruzado)[0].soloEn.length === 2, "A-DAT-61")

    // Fuentes identicas: no hay nada que elegir por contenido.
    chequear("Balance · cuál fuente vale", "Si son idénticas, ninguna tiene nada propio",
      "0 fuentes con propios",
      `${detectarSubdiariosDuplicados(comun(5, 900))[0].soloEn.length} fuente(s) con propios`,
      detectarSubdiariosDuplicados(comun(5, 900))[0].soloEn.length === 0, "A-DAT-61")
  }

  /**
   * 🧾 **EL LIBRO DIARIO DE LOS TEMPLATES — A-FEAT-1184.**
   *
   * Pedido del usuario: *«los templates deberían generar su propio libro diario ya que yo lo daba
   * en los excels»*. Van **aparte** porque **no entran por subdiario** — no tienen factura de ARCA.
   *
   * 🔑 **Y por eso el corte del período es DISTINTO**: fecha de pago, y si no hay, la estimada.
   * Conviven dos criterios en el mismo ejercicio, y eso hay que probarlo: el primer caso falla si
   * alguien "unifica" el corte usando la estimada siempre.
   */
  {
    const ej = armarEjercicio(2026, 6)
    const base = {
      id: "c1", concepto: "Seguro Flota", proveedor: "Federacion Patronal SAU",
      categ: "Seguros Estructura", cuenta_contable: "", nro_cuenta: "", centro_costo: "",
      responsable: "JMS", estado: "pagado",
    }

    chequear("Balance · templates", "Las 12 columnas son los meses del ejercicio",
      "jul-25 … jun-26 (12)",
      (() => { const r = armarTemplatesDelEjercicio([], ej); return `${r.columnas[0]} … ${r.columnas[11]} (${r.columnas.length})` })(),
      (() => { const r = armarTemplatesDelEjercicio([], ej)
        return r.columnas.length === 12 && r.columnas[0] === "jul-25" && r.columnas[11] === "jun-26" })(),
      "A-FEAT-1184")

    // 🔑 Una cuota estimada para JUNIO pero PAGADA en julio: manda la de pago, asi que sale del
    //    ejercicio. Con el corte por estimada entraria, y el ejercicio quedaria inflado.
    const pagadaDespues = armarTemplatesDelEjercicio(
      [{ ...base, fecha: "2026-07-03", monto: 100000 }], ej)
    chequear("Balance · templates", "🔑 Manda la fecha de PAGO: si se pagó en julio, no es del ejercicio",
      "0 en el ejercicio", `${pagadaDespues.detalle.length} en el ejercicio`,
      pagadaDespues.detalle.length === 0, "A-FEAT-1184")

    // La misma cuota pagada dentro del ejercicio si entra, y cae en su mes.
    const dentro = armarTemplatesDelEjercicio(
      [{ ...base, fecha: "2026-06-05", monto: 100000 }], ej)
    chequear("Balance · templates", "Una cuota de junio 2026 cae en la ÚLTIMA columna",
      "columna 12 = 100000", `columna 12 = ${dentro.porMes[0]?.debitos[11]}`,
      dentro.porMes[0]?.debitos[11] === 100000, "A-FEAT-1184")

    const primerMes = armarTemplatesDelEjercicio(
      [{ ...base, fecha: "2025-07-20", monto: 50000 }], ej)
    chequear("Balance · templates", "Y una de julio 2025 cae en la PRIMERA",
      "columna 1 = 50000", `columna 1 = ${primerMes.porMes[0]?.debitos[0]}`,
      primerMes.porMes[0]?.debitos[0] === 50000, "A-FEAT-1184")

    // Un monto negativo es una devolucion: va a CREDITOS, en positivo, como en su planilla.
    const devolucion = armarTemplatesDelEjercicio(
      [{ ...base, fecha: "2026-03-10", monto: -7500 }], ej)
    chequear("Balance · templates", "Un monto negativo va a CRÉDITOS y en positivo",
      "débitos 0 · créditos 7500",
      `débitos ${devolucion.totalDebitos} · créditos ${devolucion.totalCreditos}`,
      devolucion.totalDebitos === 0 && devolucion.totalCreditos === 7500, "A-FEAT-1184")

    // Las categorias se agrupan y se ordenan por lo que mas pesa.
    const variasCategs = armarTemplatesDelEjercicio([
      { ...base, id: "a", fecha: "2025-08-01", categ: "Impuestos", monto: 900000 },
      { ...base, id: "b", fecha: "2025-09-01", categ: "Seguros Estructura", monto: 100000 },
      { ...base, id: "c", fecha: "2025-10-01", categ: "Impuestos", monto: 100000 },
    ], ej)
    chequear("Balance · templates", "Agrupa por categoría y ordena por la que más pesa",
      "Impuestos 1000000 · Seguros Estructura 100000",
      variasCategs.porMes.map(x => `${x.categ} ${x.totalDebitos}`).join(" · "),
      variasCategs.porMes[0]?.categ === "Impuestos" && variasCategs.porMes[0]?.totalDebitos === 1000000,
      "A-FEAT-1184")

    // ⚠️ Nada se descarta en silencio: sin fecha y sin categoria van a sus propias listas.
    const huecos = armarTemplatesDelEjercicio([
      { ...base, id: "x", fecha: null, monto: 1000 },
      { ...base, id: "y", fecha: "2026-01-15", categ: "", monto: 2000 },
    ], ej)
    chequear("Balance · templates", "⚠️ Sin fecha y sin categoría no se pierden: van a su propia lista",
      "1 sin fecha · 1 sin categoría",
      `${huecos.sinFecha.length} sin fecha · ${huecos.sinCategoria.length} sin categoría`,
      huecos.sinFecha.length === 1 && huecos.sinCategoria.length === 1, "A-FEAT-1184")

    // 🧮 El control que ata la vista de detalle con la de resumen: tienen que dar lo mismo.
    const muchas = armarTemplatesDelEjercicio([
      { ...base, id: "1", fecha: "2025-07-05", monto: 11111 },
      { ...base, id: "2", fecha: "2025-12-05", categ: "Impuestos", monto: 22222 },
      { ...base, id: "3", fecha: "2026-06-30", categ: "Sueldos", monto: 33333 },
    ], ej)
    const sumaDetalle = muchas.detalle.reduce((s, c) => s + c.monto, 0)
    chequear("Balance · templates", "🧮 El detalle y el resumen por mes dan EXACTAMENTE lo mismo",
      `${sumaDetalle}`, `${muchas.totalDebitos}`,
      Math.abs(sumaDetalle - muchas.totalDebitos) < 0.01, "A-FEAT-1184")
  }

  /**
   * 🐄 **VALUACIÓN DE HACIENDA AL CIERRE — A-FEAT-1184.**
   *
   * Los criterios son **del usuario**, transcriptos de su planilla `2 - HACIENDA` del balance 2025.
   * Los casos reproducen los números de esa planilla, así que si alguien cambia un castigo sin
   * querer, saltan.
   *
   * 🕳️ **Y el más importante es el último**: una categoría sin precio **no se valúa en cero**.
   * Valuar con un supuesto silencioso es peor que no valuar — el total quedaría «completo» y mal.
   */
  {
    // Precios de referencia con la forma que devuelven las dos fuentes.
    const mag = [
      // ⚠️ La vaca de descarte se define por el CORTE DE PESO, no por la calidad (JMS 2026-09-29).
      //    Se dejan las dos filas a propósito: la de «Regular» sin corte NO tiene que usarse.
      { familia: "VACAS", calidad: "Regular", corte: null, minimo: 2000, maximo: 2750, promedio: 2400, mediana: 2380 },
      { familia: "VACAS", calidad: "Esp.Joven", corte: "+ 430", minimo: 2600, maximo: 3400, promedio: 3000, mediana: 2990 },
      { familia: "NOVILLOS", calidad: "Regular", corte: "+ 490", minimo: 2800, maximo: 3300, promedio: 3100, mediana: 3090 },
      { familia: "MEJ", calidad: "Esp.", corte: null, minimo: 3100, maximo: 3600, promedio: 3400, mediana: 3390 },
    ]
    // Entresurcos por kilo. ⚠️ Desde 2026-09-29 el ternero usa el módulo de MACHOS, no el de
    // hembras: los precios de macho son ~10 % más altos, que es justo la aproximación que él usaba
    // a mano cuando no tenía el dato.
    const mercado = [
      { categoria: "Terneros 250-290 Kg.", pesoLo: 250, pesoHi: 290, promKilo: 3740, kiloMax: 3960, kiloMin: 3520 },
    ]
    const mercadoHembra = [
      { categoria: "Vaquillonas 250-290 Kg.", pesoLo: 250, pesoHi: 290, promKilo: 3400, kiloMax: 3600, kiloMin: 3200 },
    ]
    /**
     * Entresurcos **por cabeza**. Las categorías y los precios son los **reales de junio 2026**,
     * tal como los publica la fuente — con `Gtia.` sin tilde incluido, que es lo que obliga a
     * comparar sin puntuación.
     */
    const porCabeza = {
      vientres: [
        { categoria: "Vacas C. Gtia. Preñez Medio", cantidad: 2320, promedio: 2073207, maximo: 2550000, minimo: 1600000 },
        { categoria: "Vacas C. Gtia. Preñez Nueva", cantidad: 3687, promedio: 2409494, maximo: 3200000, minimo: 1800000 },
        // Una categoría que el mercado NO operó: precios en cero. No se puede usar.
        { categoria: "Vacas Con Servicio", cantidad: 0, promedio: 0, maximo: 0, minimo: 0 },
      ],
      toros: [
        { categoria: "A.ANGUS GRAL. COLORADO", cantidad: 90, promedio: 9500000, maximo: 18000000, minimo: 7000000 },
      ],
    }
    const existencias = [
      { categoria: "Vaca", cabezas: 177 },
      { categoria: "Vaca CUT/Descarte", cabezas: 16 },
      { categoria: "Toro", cabezas: 16 },
      { categoria: "Torito", cabezas: 9 },
      { categoria: "Ternera Recria", cabezas: 83 },
      { categoria: "Ternero Recria", cabezas: 100 },
      { categoria: "Vaquillona Preñada", cabezas: 27 },
    ]
    /**
     * ⚖️ Los kilos ahora salen de las pesadas (A-FEAT-1187), así que hay que pasarlos. Los pesos
     * proyectados son los que hacen que los valores de abajo sigan siendo los de su planilla.
     */
    const pesos = [
      { categoria: "Ternera Recria", animales: 81, pesoUltimaPesada: 214.7, fechaUltimaPesada: "2026-05-04",
        gananciaMedida: 0.285, gananciaConfigurada: 1, diasHastaCierre: 57, pesoProyectado: 250,
        origen: "81 pesadas", difiereDeLaConfigurada: true },
      { categoria: "Ternero Recria", animales: 41, pesoUltimaPesada: 205.6, fechaUltimaPesada: "2026-05-04",
        gananciaMedida: 0.321, gananciaConfigurada: 1.1, diasHastaCierre: 57, pesoProyectado: 250,
        origen: "41 pesadas", difiereDeLaConfigurada: true },
      { categoria: "Torito", animales: 8, pesoUltimaPesada: 239.3, fechaUltimaPesada: "2026-05-04",
        gananciaMedida: 0.436, gananciaConfigurada: 1, diasHastaCierre: 57, pesoProyectado: 300,
        origen: "8 pesadas", difiereDeLaConfigurada: true },
      { categoria: "Toro", animales: 16, pesoUltimaPesada: 1000, fechaUltimaPesada: "2026-05-04",
        gananciaMedida: null, gananciaConfigurada: null, diasHastaCierre: 57, pesoProyectado: 1000,
        origen: "16 pesadas", difiereDeLaConfigurada: false },
    ]
    const v = valuarHacienda(existencias, mag, { macho: mercado, hembra: mercadoHembra }, {}, pesos, porCabeza)
    const de = (cat: string) => v.filas.find(f => f.categoria === cat)

    // CUT: vaca regular MAXIMO 2750 x 80% x 450 kg = 990.000 por cabeza — el numero de su planilla.
    chequear("Balance · hacienda", "🔑 CUT sin pesadas: cae al estimado DECLARADO de 500 kg → 1.200.000/cab",
      "1200000", String(de("Vaca CUT/Descarte")?.valorPorCabeza),
      de("Vaca CUT/Descarte")?.valorPorCabeza === 1200000, "A-FEAT-1187")

    // 🔑 Y lo dice: un estimado que no se declara es indistinguible de un dato.
    chequear("Balance · hacienda", "🔑 Y AVISA que son 500 kg estimados, no medidos",
      "dice estimado",
      de("Vaca CUT/Descarte")?.origenPeso.includes("estimado") ? "dice estimado" : de("Vaca CUT/Descarte")?.origenPeso ?? "-",
      !!de("Vaca CUT/Descarte")?.origenPeso.includes("estimado"), "A-FEAT-1187")

    // 🔑 Y el adversario del cambio: NO puede haber tomado la fila «Regular» sin corte.
    chequear("Balance · hacienda", "🔑 Y NO usa la de Regular sin corte: manda el corte de peso",
      "menciona + 430",
      de("Vaca CUT/Descarte")?.origenPrecio.includes("+ 430") ? "menciona + 430" : de("Vaca CUT/Descarte")?.origenPrecio ?? "-",
      !!de("Vaca CUT/Descarte")?.origenPrecio.includes("+ 430"), "A-FEAT-1184")

    // TOROS: novillo regular 3100 x 70% x 1000 kg = 2.170.000 — tambien de su planilla.
    // 🔑 Un toro es REPRODUCTOR, no carne: se valúa por cabeza, no por kilo (JMS 2026-09-29).
    chequear("Balance · hacienda", "🔑 Toro: A.ANGUS GRAL. COLORADO al MÍNIMO, por cabeza = 7.000.000",
      "7000000", String(de("Toro")?.valorPorCabeza),
      de("Toro")?.valorPorCabeza === 7000000, "A-FEAT-1187")

    // TORITOS: MEJ especial 3400 x 1,5 x 300 kg = 1.530.000 — idem.
    chequear("Balance · hacienda", "🔑 Toritos: MEJ especial × 1,5 × 300 kg = 1.530.000/cab",
      "1530000", String(de("Torito")?.valorPorCabeza),
      de("Torito")?.valorPorCabeza === 1530000, "A-FEAT-1184")

    // Ternera recria: vaquillona 250-290 al MAXIMO 3600 x 250 kg = 900.000 — idem.
    chequear("Balance · hacienda", "Ternera recría: vaquillona 250-290 al máximo × 250 kg = 900.000/cab",
      "900000", String(de("Ternera Recria")?.valorPorCabeza),
      de("Ternera Recria")?.valorPorCabeza === 900000, "A-FEAT-1184")

    // 🔑 El ternero DERIVA de la hembra: 10% mas. 3600 x 1,1 x 250 = 990.000.
    // 🔑 Ya NO deriva de la hembra: usa el módulo de machos. Da lo mismo que su 10 % a mano
    //    —3.960 vs 3.600— pero ahora es el dato y no una aproximación.
    chequear("Balance · hacienda", "🔑 El ternero usa el precio de MACHOS, no el 10 % sobre la hembra",
      "990000", String(de("Ternero Recria")?.valorPorCabeza),
      de("Ternero Recria")?.valorPorCabeza === 990000, "A-FEAT-1187")

    chequear("Balance · hacienda", "Y dice de dónde salió cada precio, no sólo el número",
      "Entresurcos · vientres",
      `${de("Ternero Recria")?.origenPrecio.includes("Entresurcos") ? "Entresurcos" : "?"} · ${de("Vaca")?.origenPrecio.includes("vientres") ? "vientres" : "?"}`,
      !!de("Ternero Recria")?.origenPrecio.includes("Entresurcos") &&
      !!de("Vaca")?.origenPrecio.includes("vientres"), "A-FEAT-1187")

    // 🕳️ EL CASO QUE MAS IMPORTA: la vaca y la vaquillona preñada NO tienen precio de mercado
    //    publicado (es un precio que consigue el usuario). NO se valuan en cero.
    // ✅ La vaca DEJÓ DE SER HUECO el 2026-09-29: 2.073.207 × 90 % = 1.865.886,30 por cabeza.
    //    Eran 177 cabezas que no se valuaban.
    chequear("Balance · hacienda", "✅ La vaca ya se valúa: preñez medio × 90 % = 1.865.886,30/cab",
      "1865886.3", String(de("Vaca")?.valorPorCabeza),
      Math.abs((de("Vaca")?.valorPorCabeza ?? 0) - 1865886.3) < 0.01, "A-FEAT-1187")

    // ⚠️ Pero una categoría que el mercado NO operó (precios en cero) sigue siendo hueco: tomar
    //    ese cero valuaría el rodeo en cero.
    const sinOperar = valuarHacienda(
      [{ categoria: "Vaca", cabezas: 10 }], mag, { macho: mercado, hembra: mercadoHembra }, {}, pesos,
      { vientres: [{ categoria: "Vacas C. Gtia. Preñez Medio", cantidad: 0, promedio: 0, maximo: 0, minimo: 0 }], toros: [] },
    )
    chequear("Balance · hacienda", "⚠️ Una categoría que el mercado no operó (precio 0) sigue siendo hueco",
      "hueco", sinOperar.filas[0]?.esHueco ? "hueco" : "valuada",
      sinOperar.filas[0]?.esHueco === true, "A-FEAT-1187")

    // ✅ De 2 huecos (204 cabezas) a NINGUNO: con vientres y toros, el rodeo se valúa entero.
    chequear("Balance · hacienda", "✅ Con vientres y toros ya no queda ninguna cabeza sin valuar",
      "0 huecos · 0 cabezas",
      `${v.huecos.length} huecos · ${v.cabezasSinValuar} cabezas`,
      v.huecos.length === 0 && v.cabezasSinValuar === 0, "A-FEAT-1187")

    // 🧮 El total valuado NO incluye los huecos, y las cabezas si: el papel muestra las dos cosas.
    chequear("Balance · hacienda", "🧮 Cuenta las 428 cabezas aunque sólo pueda valuar una parte",
      "428 cabezas", `${v.cabezas} cabezas`, v.cabezas === 428, "A-FEAT-1184")

    // 🎚️ El precio a mano MANDA sobre el de mercado (default del dato real, siempre editable).
    const conManual = valuarHacienda(existencias, mag, { macho: mercado, hembra: mercadoHembra }, { "Vaca": 1370000 }, pesos, porCabeza)
    const vaca = conManual.filas.find(f => f.categoria === "Vaca")
    chequear("Balance · hacienda", "🎚️ Un precio cargado a mano manda: 1.370.000 × 90 % = 1.233.000/cab",
      "1233000 · ya no es hueco",
      `${vaca?.valorPorCabeza} · ${vaca?.esHueco ? "sigue hueco" : "ya no es hueco"}`,
      vaca?.valorPorCabeza === 1233000 && vaca?.esHueco === false, "A-FEAT-1184")

    // Una categoria con existencia y SIN criterio escrito tambien sale a la luz.
    const conRara = valuarHacienda([{ categoria: "Novillo", cabezas: 5 }], mag, { macho: mercado, hembra: mercadoHembra }, {}, pesos, porCabeza)
    chequear("Balance · hacienda", "⚠️ Una categoría sin criterio definido se muestra, no se ignora",
      "1 sin criterio · es hueco",
      `${conRara.sinCriterio.length} sin criterio · ${conRara.filas[0]?.esHueco ? "es hueco" : "se valuó"}`,
      conRara.sinCriterio.length === 1 && conRara.filas[0]?.esHueco === true, "A-FEAT-1184")
  }

  /**
   * 🧪 **STOCK DE INSUMOS — A-FEAT-1184.**
   *
   * Cubre los papeles de insumos agrícolas, forrajeros y gas oil, que tienen la misma forma. El
   * **ámbito** de la categoría ya los separa: no hizo falta inventar una clasificación.
   *
   * 🕳️ **El caso que más importa es el del precio faltante.** Medido contra la base el 2026-09-28:
   * **32 productos con stock y ninguno con precio**. Si una fila sin precio se valuara en cero, el
   * total del papel saldría «completo» y mal.
   */
  {
    const linea = (o: Partial<LineaInsumo>): LineaInsumo => ({
      id: o.id ?? "x", categoria: o.categoria ?? "Agroquímico", ambito: o.ambito ?? "agricola",
      producto: o.producto ?? "Glifosato", cantidad: o.cantidad ?? 20, unidad: o.unidad ?? "L",
      costoUnitario: o.costoUnitario ?? null, observaciones: "",
    })

    // 🕳️ Sin precio NO se valua en cero.
    const sinPrecio = armarStockInsumos([linea({ id: "a", cantidad: 20, costoUnitario: null })])
    chequear("Balance · insumos", "🕳️ Un insumo sin precio NO se valúa en cero: queda como hueco",
      "1 hueco · valor nulo",
      `${sinPrecio.huecos.length} hueco · valor ${sinPrecio.grupos[0].filas[0].valorTotal === null ? "nulo" : sinPrecio.grupos[0].filas[0].valorTotal}`,
      sinPrecio.huecos.length === 1 && sinPrecio.grupos[0].filas[0].valorTotal === null, "A-FEAT-1184")

    // 🔑 Un precio en CERO tampoco vale: un insumo que vale cero no existe.
    const precioCero = armarStockInsumos([linea({ id: "b", costoUnitario: 0 })])
    chequear("Balance · insumos", "🔑 Un precio en cero se trata como faltante, no como válido",
      "es hueco", precioCero.huecos.length === 1 ? "es hueco" : "se valuó",
      precioCero.huecos.length === 1, "A-FEAT-1184")

    // Con precio, valua bien.
    const conPrecio = armarStockInsumos([linea({ id: "c", cantidad: 96, costoUnitario: 6 })])
    chequear("Balance · insumos", "Con precio cargado: 96 L × 6 = 576",
      "576", String(conPrecio.valuado), conPrecio.valuado === 576, "A-FEAT-1184")

    // 🗂️ El ambito separa los tres papeles del usuario.
    const tresPapeles = armarStockInsumos([
      linea({ id: "1", ambito: "agricola", costoUnitario: 1 }),
      linea({ id: "2", ambito: "ganadero", producto: "Balanceado", costoUnitario: 1 }),
      linea({ id: "3", ambito: "ambos", producto: "Gas oil", costoUnitario: 1 }),
    ])
    chequear("Balance · insumos", "🗂️ El ámbito separa los papeles: agrícolas, forrajeros y gas oil",
      "3 papeles", `${tresPapeles.grupos.length} papeles`,
      tresPapeles.grupos.length === 3 &&
      tresPapeles.grupos.some(g => g.papel.includes("agrícolas")) &&
      tresPapeles.grupos.some(g => g.papel.includes("Forrajeros")), "A-FEAT-1184")

    // Un producto en CERO no es stock: no se cuenta ni como hueco.
    const enCero = armarStockInsumos([linea({ id: "d", cantidad: 0, costoUnitario: null })])
    chequear("Balance · insumos", "Un producto con existencia 0 no entra al papel",
      "0 productos", `${enCero.productos} productos`, enCero.productos === 0, "A-FEAT-1184")

    // 🎚️ El precio a mano manda, y por NOMBRE tambien (por si el producto se recreo).
    const conManual = armarStockInsumos([linea({ id: "e", cantidad: 10, costoUnitario: null })], { "Glifosato": 4 })
    chequear("Balance · insumos", "🎚️ Un precio a mano (por nombre) manda: 10 × 4 = 40 y deja de ser hueco",
      "40 · 0 huecos", `${conManual.valuado} · ${conManual.huecos.length} huecos`,
      conManual.valuado === 40 && conManual.huecos.length === 0, "A-FEAT-1184")

    // 🕳️ Los papeles que NO tienen de donde salir se declaran.
    chequear("Balance · insumos", "🕳️ Granos, sementeras y gas oil se declaran como papeles sin origen",
      "3 declarados", `${PAPELES_SIN_ORIGEN.length} declarados`,
      PAPELES_SIN_ORIGEN.length === 3 &&
      PAPELES_SIN_ORIGEN.some(p => p.papel.includes("Granos")) &&
      PAPELES_SIN_ORIGEN.some(p => p.papel.includes("Sementeras")), "A-FEAT-1184")

    // 🧮 El total del grupo y el general tienen que dar lo mismo.
    const varios = armarStockInsumos([
      linea({ id: "f", ambito: "agricola", costoUnitario: 2, cantidad: 100 }),
      linea({ id: "g", ambito: "ganadero", producto: "Sal", costoUnitario: 3, cantidad: 100 }),
    ])
    chequear("Balance · insumos", "🧮 La suma de los grupos da el total general",
      "500", String(varios.grupos.reduce((s, g) => s + g.valuado, 0)),
      varios.grupos.reduce((s, g) => s + g.valuado, 0) === varios.valuado && varios.valuado === 500,
      "A-FEAT-1184")
  }

  /**
   * 🌾 **GRANOS: EL CUADRE DE KILOS — A-FEAT-1184.**
   *
   * Reproduce el cuadre de su planilla 2025, **con sus números reales**, incluida la diferencia
   * de **2,386 tn que no cierra y él deja escrita**. Ése es el punto: el cuadre **muestra** la
   * diferencia, no la fuerza a cero.
   */
  {
    // Los numeros de su planilla, en toneladas.
    const suPlanilla = cuadrarGranos({
      stockInicioTn: 305.133, cosechaTn: 232.150,
      ventasTn: 308.741 + 219.230,       // ventas del ejercicio + la "venta extra"
      // ⚠️ En su planilla la celda guarda el stock YA NEGADO (`=-B13*1000`) porque despues lo
      //    SUMA. Acá se pasa el stock de verdad —6,926 tn, las mismas de la valuación— y la resta
      //    la hace la función. Copiar la celda tal cual daba 16,238 en vez de 2,386.
      stockEmpresaTn: 6.926,
    })
    chequear("Balance · granos", "🔑 Reproduce el cuadre de su planilla: saldo 9,312 tn",
      "9.312", String(suPlanilla.saldoTn), Math.abs((suPlanilla.saldoTn ?? 0) - 9.312) < 0.001,
      "A-FEAT-1184")

    chequear("Balance · granos", "🧮 Y la diferencia de 2,386 tn SE MUESTRA, no se fuerza a cero",
      "2.386", String(suPlanilla.diferenciaTn),
      Math.abs((suPlanilla.diferenciaTn ?? 0) - 2.386) < 0.001, "A-FEAT-1184")

    chequear("Balance · granos", "Y con esa diferencia, el cuadre NO se declara cerrado",
      "no cierra", suPlanilla.cierra ? "cierra" : "no cierra",
      suPlanilla.cierra === false, "A-FEAT-1184")

    // Dentro de tolerancia si cierra: se pesa en balanza y se redondea.
    const ajustado = cuadrarGranos({ stockInicioTn: 100, cosechaTn: 50, ventasTn: 30, stockEmpresaTn: 119.9 })
    chequear("Balance · granos", "Una diferencia de 0,1 tn entra en la tolerancia y cierra",
      "cierra", ajustado.cierra ? "cierra" : "no cierra", ajustado.cierra === true, "A-FEAT-1184")

    // 🕳️ Sin las entradas que hoy no estan en la app, NO se declara que cierra.
    const faltando = cuadrarGranos({ stockInicioTn: null, cosechaTn: null, ventasTn: 15, stockEmpresaTn: null })
    chequear("Balance · granos", "🕳️ Sin stock inicial ni cosecha, no se dice que cierra: sería un verde falso",
      "no cierra · 3 faltantes",
      `${faltando.cierra ? "cierra" : "no cierra"} · ${faltando.faltan.length} faltantes`,
      faltando.cierra === false && faltando.faltan.length === 3, "A-FEAT-1184")

    // La valuacion, con las formulas de su planilla: bruto -> neto por calidad -> menos CZ.
    // ⚠️ 6,926 tn, no 6,93: la planilla MUESTRA 6,93 redondeado pero calcula con 6,926 — se ve
    //    en que su bruto da 2.223.246 y no 2.224.530. Redondear la entrada movía el final $1.181.
    const v = valuarGranos(6.926, 321000, 1, 0.08)
    chequear("Balance · granos", "🔑 Valuación como su planilla: 6,926 tn → neto final 2.045.386,32",
      "2045386.32", String(v.netoFinal), Math.abs((v.netoFinal ?? 0) - 2045386.32) < 0.01,
      "A-FEAT-1184")

    chequear("Balance · granos", "🕳️ Sin precio, no se valúa en cero: es hueco",
      "hueco · nulo",
      `${valuarGranos(10, null).esHueco ? "hueco" : "valuado"} · ${valuarGranos(10, null).netoFinal === null ? "nulo" : "0"}`,
      valuarGranos(10, null).esHueco === true && valuarGranos(10, null).netoFinal === null,
      "A-FEAT-1184")
  }

  /**
   * 🌱 **SEMENTERAS — A-FEAT-1184.**
   *
   * Es el costo **sembrado y todavía no cosechado**. Lo que se prueba acá es sobre todo **qué NO
   * entra**: una orden planificada no costó nada todavía, y contarla inflaría el activo con un
   * gasto que no ocurrió.
   */
  {
    const orden = (o: Partial<OrdenAgricola>): OrdenAgricola => ({
      id: o.id ?? "o1", fecha: o.fecha ?? "2026-04-01", lote: o.lote ?? "Casas",
      hectareas: o.hectareas ?? 29, estado: o.estado ?? "ejecutada",
      lineas: o.lineas ?? [{ insumo: "Glifosato", cantidad: 100, unidad: "L", precioUnitario: null }],
    })

    // 🛑 Solo las EJECUTADAS y hasta el cierre.
    const mezcla = armarSementeras([
      orden({ id: "a", estado: "ejecutada", fecha: "2026-04-01" }),
      orden({ id: "b", estado: "planificada", fecha: "2026-05-01", lote: "Ribera" }),
      orden({ id: "c", estado: "eliminada", fecha: "2026-03-01", lote: "Tosquera" }),
      orden({ id: "d", estado: "ejecutada", fecha: "2026-09-25", lote: "Posterior" }),
    ], "2026-06-30")

    chequear("Balance · sementeras", "🛑 Sólo cuenta las ejecutadas hasta el cierre: 1 de 4",
      "1 ejecutada", `${mezcla.ordenesEjecutadas} ejecutada`,
      mezcla.ordenesEjecutadas === 1, "A-FEAT-1184")

    chequear("Balance · sementeras", "Y las otras 3 se informan con su motivo, no desaparecen",
      "3 no contadas", `${mezcla.ordenesNoContadas.length} no contadas`,
      mezcla.ordenesNoContadas.length === 3, "A-FEAT-1184")

    chequear("Balance · sementeras", "🔑 Una PLANIFICADA dice que todavía no es costo incurrido",
      "lo dice",
      mezcla.ordenesNoContadas.find(o => o.estado === "planificada")?.motivo.includes("no es costo")
        ? "lo dice" : "no lo dice",
      !!mezcla.ordenesNoContadas.find(o => o.estado === "planificada")?.motivo.includes("no es costo"),
      "A-FEAT-1184")

    // 🕳️ Sin precio de insumo, la linea es hueco y el costo no la incluye.
    chequear("Balance · sementeras", "🕳️ Sin precio del insumo, la línea es hueco y el costo da 0",
      "1 hueco · costo 0", `${mezcla.huecos.length} hueco · costo ${mezcla.costo}`,
      mezcla.huecos.length === 1 && mezcla.costo === 0, "A-FEAT-1184")

    // Con precio, valua.
    const conPrecio = armarSementeras([
      orden({ lineas: [{ insumo: "Glifosato", cantidad: 100, unidad: "L", precioUnitario: 4 }] }),
    ], "2026-06-30")
    chequear("Balance · sementeras", "Con precio: 100 L × 4 = 400",
      "400", String(conPrecio.costo), conPrecio.costo === 400, "A-FEAT-1184")

    // ⚠️ Y SIEMPRE avisa que falta la tarifa de labores: sin eso el costo esta incompleto
    //    aunque todos los insumos tuvieran precio.
    chequear("Balance · sementeras", "⚠️ Avisa que falta la tarifa de labores aunque los insumos tengan precio",
      "avisa",
      conPrecio.faltan.some(f => f.includes("labores")) ? "avisa" : "no avisa",
      conPrecio.faltan.some(f => f.includes("labores")), "A-FEAT-1184")

    // Las hectareas no se duplican si el mismo lote aparece en dos ordenes.
    const dosOrdenes = armarSementeras([
      orden({ id: "x", lote: "Casas", hectareas: 29 }),
      orden({ id: "y", lote: "Casas", hectareas: 29, fecha: "2026-05-01" }),
    ], "2026-06-30")
    chequear("Balance · sementeras", "Las hectáreas no se cuentan dos veces si el lote se repite",
      "29 ha", `${dosOrdenes.hectareas} ha`, dosOrdenes.hectareas === 29, "A-FEAT-1184")
  }

  /**
   * ⚖️ **LOS KILOS SALEN DE LAS PESADAS — A-FEAT-1187.**
   *
   * *«tomar de la app: última pesada más propagar el aumento promedio de la categoría hasta el
   * 30/6»*. Y las dos salidas cuando no hay pesada, que él distinguió a propósito: *«sino poner
   * que no hay dato»* (toros) **no es lo mismo que** *«sino poner estimado de 500 kg»* (vaca CUT).
   */
  {
    const pesada = (animalId: string, fecha: string, pesoKg: number, categoria = "Ternera Recria") =>
      ({ categoria, animalId, fecha, pesoKg })

    // Dos pesadas del mismo animal: 200 kg el 1/5 y 230 el 31/5 → 1 kg/día en 30 días.
    const unMes = pesosAlCierre(
      [pesada("a", "2026-05-01", 200), pesada("a", "2026-05-31", 230)],
      {}, "2026-06-30",
    )[0]
    chequear("Balance · pesos", "🔑 Calcula la ganancia diaria entre pesadas del MISMO animal",
      "1 kg/día", `${unMes.gananciaMedida} kg/día`, unMes.gananciaMedida === 1, "A-FEAT-1187")

    // Y proyecta 30 dias mas, del 31/5 al 30/6: 230 + 30 = 260.
    chequear("Balance · pesos", "🔑 Y proyecta hasta el cierre: 230 kg + 1 × 30 días = 260",
      "260", String(unMes.pesoProyectado), unMes.pesoProyectado === 260, "A-FEAT-1187")

    chequear("Balance · pesos", "Dice de dónde salió, con la fecha y la ganancia",
      "menciona la fecha y kg/día",
      unMes.origen.includes("2026-05-31") && unMes.origen.includes("kg/día") ? "menciona la fecha y kg/día" : unMes.origen,
      unMes.origen.includes("2026-05-31") && unMes.origen.includes("kg/día"), "A-FEAT-1187")

    // ⚠️ Con UNA sola pesada no hay ganancia que medir: NO se proyecta ni se inventa una.
    const unaSola = pesosAlCierre([pesada("b", "2026-05-04", 214.7)], {}, "2026-06-30")[0]
    chequear("Balance · pesos", "⚠️ Con una sola pesada no se proyecta: no hay ganancia que medir",
      "214.7 · sin ganancia",
      `${unaSola.pesoProyectado} · ${unaSola.gananciaMedida === null ? "sin ganancia" : unaSola.gananciaMedida}`,
      unaSola.pesoProyectado === 214.7 && unaSola.gananciaMedida === null, "A-FEAT-1187")

    // 🔑 El promedio es de la ULTIMA pesada de cada animal, no de todas mezcladas: promediar
    //    febrero con mayo daría un animal que no existe.
    const dosAnimales = pesosAlCierre([
      pesada("x", "2026-02-01", 100), pesada("x", "2026-05-04", 200),
      pesada("y", "2026-05-04", 300),
    ], {}, "2026-05-04")[0]
    chequear("Balance · pesos", "🔑 Promedia la ÚLTIMA pesada de cada animal, no todas mezcladas",
      "250", String(dosAnimales.pesoUltimaPesada), dosAnimales.pesoUltimaPesada === 250, "A-FEAT-1187")

    // 🚨 El hallazgo real: la ganancia configurada es 3x la medida. Se avisa.
    const conConfigurada = pesosAlCierre(
      [pesada("c", "2026-05-01", 200), pesada("c", "2026-05-31", 209)],   // 0,3 kg/día
      { "Ternera Recria": 1.0 }, "2026-06-30",
    )[0]
    chequear("Balance · pesos", "🚨 Avisa cuando la ganancia cargada difiere mucho de la medida",
      "avisa · 0.3 vs 1",
      `${conConfigurada.difiereDeLaConfigurada ? "avisa" : "no avisa"} · ${conConfigurada.gananciaMedida} vs ${conConfigurada.gananciaConfigurada}`,
      conConfigurada.difiereDeLaConfigurada === true && conConfigurada.gananciaMedida === 0.3,
      "A-FEAT-1187")

    // Una diferencia chica no avisa: la ganancia real fluctua con el pasto y avisar por poco
    // convertiria el aviso en ruido.
    const parecidas = pesosAlCierre(
      [pesada("d", "2026-05-01", 200), pesada("d", "2026-05-31", 233)],   // 1,1 kg/día
      { "Ternera Recria": 1.0 }, "2026-06-30",
    )[0]
    chequear("Balance · pesos", "Una diferencia del 10 % no avisa: sería ruido",
      "no avisa", parecidas.difiereDeLaConfigurada ? "avisa" : "no avisa",
      parecidas.difiereDeLaConfigurada === false, "A-FEAT-1187")

    // 🔑 LAS TRES SALIDAS cuando se pide el peso de una categoría.
    const medido = pesoParaValuar("Ternera Recria", [unMes], 500)
    chequear("Balance · pesos", "Con pesadas, manda la pesada y no el estimado",
      "260", String(medido.kg), medido.kg === 260, "A-FEAT-1187")

    const conFallback = pesoParaValuar("Vaca CUT/Descarte", [], 500)
    chequear("Balance · pesos", "🔑 Sin pesadas pero CON estimado declarado: usa 500 y lo dice",
      "500 · dice estimado",
      `${conFallback.kg} · ${conFallback.origen.includes("estimado") ? "dice estimado" : conFallback.origen}`,
      conFallback.kg === 500 && conFallback.origen.includes("estimado"), "A-FEAT-1187")

    const sinNada = pesoParaValuar("Toro", [], null)
    chequear("Balance · pesos", "🔑 Sin pesadas y SIN estimado: dice que no hay dato, no inventa un kilo",
      "nulo · no hay dato",
      `${sinNada.kg === null ? "nulo" : sinNada.kg} · ${sinNada.origen}`,
      sinNada.kg === null && sinNada.origen.includes("no hay dato"), "A-FEAT-1187")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🧾 NOTAS DE CRÉDITO contra facturas — la detección del aviso del Cash Flow
  //    (A-FEAT-1192). Todo esto es lógica pura: no toca la base.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const c = (
      id: string, cuit: string, proveedor: string, tipo: number,
      importe: number, estado: string,
    ): ComprobanteParaNC => ({
      id, cuit, proveedor, tipoComprobante: tipo, importe, estado,
      display: `${abreviaturaComprobante(tipo)} - ${id}`,
    })

    // Los códigos de ARCA, que estaban escritos a mano en siete lugares.
    chequear("Pagos · NC", "El código 3 es nota de crédito y el 1 no",
      "NC=sí · FC=no", `NC=${esNotaCredito(3) ? "sí" : "no"} · FC=${esNotaCredito(1) ? "sí" : "no"}`,
      esNotaCredito(3) && !esNotaCredito(1), "A-FEAT-1192")

    chequear("Pagos · NC", "El 213 (crédito electrónico MiPyME) también es NC",
      "NC", abreviaturaComprobante(213), abreviaturaComprobante(213) === "NC", "A-FEAT-1192")

    // 🔑 EL CASO BASE: un proveedor con las dos puntas.
    const conLasDos = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 1, 1_000_000, "pendiente"),
      c("2", "30111111119", "Luminatus", 3, 250_000, "pendiente"),
    ])
    chequear("Pagos · NC", "Proveedor con FC y NC: lo propone, y el saldo es la resta",
      "1 proveedor · quedan 750.000",
      `${conLasDos.length} proveedor · quedan ${conLasDos[0]?.saldo.toLocaleString("es-AR")}`,
      conLasDos.length === 1 && conLasDos[0].saldo === 750_000, "A-FEAT-1192")

    // 🎯 ADVERSARIO 1 — la NC viene con importe NEGATIVO, que es como la guarda ARCA.
    //    Si se sumara crudo, el saldo daría 1.250.000 en vez de 750.000: un número
    //    plausible y equivocado, que es el peor de todos.
    const negativa = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 1, 1_000_000, "pendiente"),
      c("2", "30111111119", "Luminatus", 3, -250_000, "pendiente"),
    ])
    chequear("Pagos · NC", "🔑 La NC guardada en NEGATIVO se descuenta igual, no se suma",
      "quedan 750.000", `quedan ${negativa[0]?.saldo.toLocaleString("es-AR")}`,
      negativa[0]?.saldo === 750_000, "A-FEAT-1192")

    // 🎯 ADVERSARIO 2 — una sola punta no es un aviso, es ruido.
    const soloNC = detectarProveedoresConNC([c("2", "30111111119", "Luminatus", 3, 250_000, "pendiente")])
    chequear("Pagos · NC", "Una NC sin ninguna factura del proveedor: NO se avisa",
      "0", String(soloNC.length), soloNC.length === 0, "A-FEAT-1192")

    const soloFC = detectarProveedoresConNC([c("1", "30111111119", "Luminatus", 1, 1_000_000, "pendiente")])
    chequear("Pagos · NC", "Una factura sin NC: NO se avisa",
      "0", String(soloFC.length), soloFC.length === 0, "A-FEAT-1192")

    // 🎯 ADVERSARIO 3 — una NC ya conciliada no se puede volver a aplicar.
    const yaUsada = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 1, 1_000_000, "pendiente"),
      c("2", "30111111119", "Luminatus", 3, 250_000, "conciliado"),
    ])
    chequear("Pagos · NC", "🔑 Una NC ya conciliada no se vuelve a proponer",
      "0", String(yaUsada.length), yaUsada.length === 0, "A-FEAT-1192")

    // 🎯 ADVERSARIO 4 — dos proveedores distintos NO se mezclan, aunque los importes calcen.
    const dos = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 1, 1_000_000, "pendiente"),
      c("2", "30222222227", "Otro SA", 3, 250_000, "pendiente"),
    ])
    chequear("Pagos · NC", "🔑 La NC de un proveedor NO se ofrece contra la factura de otro",
      "0", String(dos.length), dos.length === 0, "A-FEAT-1192")

    // 🎯 ADVERSARIO 5 — sin CUIT no se agrupa. Agrupar por nombre junta cosas que no van juntas:
    //    el mismo proveedor viene escrito de tres formas según quién lo cargó.
    const sinCuit = detectarProveedoresConNC([
      c("1", "", "Luminatus", 1, 1_000_000, "pendiente"),
      c("2", "", "Luminatus", 3, 250_000, "pendiente"),
    ])
    chequear("Pagos · NC", "Sin CUIT no se agrupa por nombre: no se propone nada",
      "0", String(sinCuit.length), sinCuit.length === 0, "A-FEAT-1192")

    // 🎯 ADVERSARIO 6 — la NC es MÁS GRANDE que lo que se le debe. El saldo da negativo
    //    y se muestra así: § 🧮 el número raro es el que hay que ver, no el que hay que esconder.
    const deMas = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 1, 100_000, "pendiente"),
      c("2", "30111111119", "Luminatus", 3, 250_000, "pendiente"),
    ])
    chequear("Pagos · NC", "🔑 NC más grande que la factura: el saldo queda NEGATIVO y se muestra",
      "-150.000", String(deMas[0]?.saldo),
      deMas.length === 1 && deMas[0].saldo === -150_000, "A-FEAT-1192")

    // Orden: primero el que tiene más plata para descontar.
    const orden = detectarProveedoresConNC([
      c("1", "30111111119", "Chico", 1, 5_000, "pendiente"),
      c("2", "30111111119", "Chico", 3, 3_000, "pendiente"),
      c("3", "30222222227", "Grande", 1, 9_000_000, "pendiente"),
      c("4", "30222222227", "Grande", 3, 2_000_000, "pendiente"),
    ])
    chequear("Pagos · NC", "Ordena por lo que hay para descontar, de mayor a menor",
      "Grande, Chico", orden.map(p => p.proveedor).join(", "),
      orden[0]?.proveedor === "Grande" && orden[1]?.proveedor === "Chico", "A-FEAT-1192")

    // Las notas de débito NO son notas de crédito: van del lado de las facturas.
    const conND = detectarProveedoresConNC([
      c("1", "30111111119", "Luminatus", 2, 40_000, "pendiente"),
      c("2", "30111111119", "Luminatus", 3, 10_000, "pendiente"),
    ])
    chequear("Pagos · NC", "Una ND suma del lado de lo que se debe, no del de las NC",
      "debe 40.000 · descuenta 10.000",
      `debe ${conND[0]?.totalFacturas.toLocaleString("es-AR")} · descuenta ${conND[0]?.totalNotasCredito.toLocaleString("es-AR")}`,
      conND[0]?.totalFacturas === 40_000 && conND[0]?.totalNotasCredito === 10_000, "A-FEAT-1192")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 📗 LIBRO DIARIO POR CUENTA CONTABLE — el formato de su «Excel - Compras»
  //    (A-FEAT-1187). Agrupa, ordena, totaliza y deja lo no imputado a la vista.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const asiento = (
      subdiario: string, cuenta: string, neto: number, iva: number, total: number,
      nroCuenta = "", exento = 0,
    ): AsientoLibroDiario => ({
      id: `${subdiario}-${cuenta}-${total}`, fuente: "arca", subdiario,
      fecha: null, tipo: 1, punto_venta: 1, numero: 1, cuit: "30000000007", denominacion: "X",
      neto_gravado: neto, no_gravado: 0, exento, otros_tributos: 0, iva, total,
      cuenta_contable: cuenta, nro_cuenta: nroCuenta, centro_costo: "",
    })

    // 🔑 EL CASO BASE: dos meses, dos cuentas, y los totales que tienen que salir.
    const libro = armarLibroPorCuenta([
      asiento("2025-07", "Combustibles", 100, 21, 121, "422106"),
      asiento("2025-07", "Combustibles", 200, 42, 242, "422106"),
      asiento("2025-07", "Aguadas", 50, 10.5, 60.5, "422125"),
      asiento("2025-08", "Combustibles", 400, 84, 484, "422106"),
    ])

    chequear("Balance · por cuenta", "Agrupa por mes y por cuenta: 2 meses, y julio con 2 cuentas",
      "2 meses · julio 2 cuentas",
      `${libro.meses.length} meses · julio ${libro.meses[0]?.filas.length} cuentas`,
      libro.meses.length === 2 && libro.meses[0].filas.length === 2, "A-FEAT-1187")

    chequear("Balance · por cuenta", "Suma las dos facturas de la misma cuenta en una sola fila",
      "300 · 2 comprobantes",
      `${libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.netoGravado} · ` +
      `${libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.comprobantes} comprobantes`,
      libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.netoGravado === 300 &&
      libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.comprobantes === 2, "A-FEAT-1187")

    chequear("Balance · por cuenta", "El «Total general» del mes suma sus cuentas",
      "423.50", String(libro.meses[0].total.total),
      libro.meses[0].total.total === 423.5, "A-FEAT-1187")

    chequear("Balance · por cuenta", "🔑 El total del ejercicio suma los totales mensuales",
      "907.50", String(libro.totalGeneral.total),
      libro.totalGeneral.total === 907.5, "A-FEAT-1187")

    // Ordenado alfabéticamente, que es como él lo lee.
    chequear("Balance · por cuenta", "Las cuentas salen ordenadas por nombre",
      "Aguadas, Combustibles", libro.meses[0].filas.map(f => f.cuenta).join(", "),
      libro.meses[0].filas[0].cuenta === "Aguadas", "A-FEAT-1187")

    chequear("Balance · por cuenta", "Se queda con el número del plan de cuentas",
      "422106", libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.nroCuenta || "(vacío)",
      libro.meses[0].filas.find(f => f.cuenta === "Combustibles")?.nroCuenta === "422106", "A-FEAT-1187")

    // 🎯 ADVERSARIO 1 — lo NO IMPUTADO no se esconde ni se descarta, y va AL FINAL del mes.
    const conHuecos = armarLibroPorCuenta([
      asiento("2025-07", "Zapatos", 100, 21, 121),
      asiento("2025-07", "", 1000, 210, 1210),
      asiento("2025-07", "Aguadas", 50, 10.5, 60.5),
    ])
    chequear("Balance · por cuenta", "🔑 Lo sin cuenta sale como NO IMPUTADO y va ÚLTIMO, no ordenado alfabéticamente",
      "Aguadas, Zapatos, NO IMPUTADO", conHuecos.meses[0].filas.map(f => f.cuenta).join(", "),
      conHuecos.meses[0].filas[2].cuenta === SIN_IMPUTAR, "A-FEAT-1187")

    chequear("Balance · por cuenta", "🔑 Lo no imputado SUMA en el total del mes: no se descarta",
      "1391.50", String(conHuecos.meses[0].total.total),
      conHuecos.meses[0].total.total === 1391.5, "A-FEAT-1187")

    chequear("Balance · por cuenta", "Dice cuánto falta imputar y qué porcentaje es",
      "1 comprobante · 1210 · 86.96%",
      `${conHuecos.sinImputar.comprobantes} comprobante · ${conHuecos.sinImputar.total} · ${conHuecos.sinImputar.porcentaje}%`,
      conHuecos.sinImputar.comprobantes === 1 && conHuecos.sinImputar.total === 1210 &&
      conHuecos.sinImputar.porcentaje === 86.96, "A-FEAT-1187")

    // 🎯 ADVERSARIO 2 — una cuenta escrita con espacios de más NO es otra cuenta.
    const conEspacios = armarLibroPorCuenta([
      asiento("2025-07", "Aguadas", 100, 21, 121),
      asiento("2025-07", "  Aguadas  ", 100, 21, 121),
    ])
    chequear("Balance · por cuenta", "Una cuenta con espacios de más no abre una fila aparte",
      "1 fila", `${conEspacios.meses[0].filas.length} fila`,
      conEspacios.meses[0].filas.length === 1, "A-FEAT-1187")

    // 🎯 ADVERSARIO 3 — una cuenta con SÓLO espacios es «no imputado», no una cuenta llamada " ".
    const soloEspacios = armarLibroPorCuenta([asiento("2025-07", "   ", 100, 21, 121)])
    chequear("Balance · por cuenta", "🔑 Una cuenta que es sólo espacios cuenta como NO IMPUTADO",
      SIN_IMPUTAR, soloEspacios.meses[0].filas[0].cuenta,
      soloEspacios.meses[0].filas[0].cuenta === SIN_IMPUTAR, "A-FEAT-1187")

    // 🎯 ADVERSARIO 4 — la DIFERENCIA delata un comprobante cuyas partes no suman el total.
    //    Es el control de INTEGRIDAD (§ 🚦): no hay explicación de negocio posible.
    const roto = armarLibroPorCuenta([asiento("2025-07", "Aguadas", 100, 21, 999)])
    chequear("Balance · por cuenta", "🔑 Si las partes no suman el total, la Diferencia lo dice",
      "878", String(roto.meses[0].filas[0].diferencia),
      roto.meses[0].filas[0].diferencia === 878, "A-FEAT-1187")

    const sano = armarLibroPorCuenta([asiento("2025-07", "Aguadas", 100, 21, 121)])
    chequear("Balance · por cuenta", "Y si suman, la Diferencia da cero",
      "0", String(sano.meses[0].filas[0].diferencia),
      sano.meses[0].filas[0].diferencia === 0, "A-FEAT-1187")

    // 🎯 ADVERSARIO 5 — el corte es el SUBDIARIO, no la fecha. Un comprobante de junio que entró
    //    en el subdiario de agosto va a agosto. Es toda la regla del ejercicio.
    const porSubdiario = armarLibroPorCuenta([
      { ...asiento("2025-08", "Aguadas", 100, 21, 121), fecha: "2025-06-15" },
    ])
    chequear("Balance · por cuenta", "🔑 Manda el SUBDIARIO, no la fecha de la factura",
      "mes 8", `mes ${porSubdiario.meses[0].mes}`,
      porSubdiario.meses[0].mes === 8, "A-FEAT-1187")

    // 🎯 ADVERSARIO 6 — LA FAC C. Una factura C no discrimina IVA: su total NO se abre por
    //    columnas, va entero a «sin crédito fiscal». 🧨 Este caso nació de un bug REAL: sin esta
    //    columna, el ejercicio 25/26 de MSA marcaba $25.948.119,79 de descuadre que no existía.
    const facC: AsientoLibroDiario = {
      id: "c", fuente: "arca", subdiario: "2025-07", fecha: null,
      tipo: 11, punto_venta: 1, numero: 1, cuit: "30000000007", denominacion: "Monotributista",
      neto_gravado: 0, no_gravado: 0, exento: 0, otros_tributos: 0, iva: 0, total: 1000,
      cuenta_contable: "Aguadas", nro_cuenta: "", centro_costo: "",
    }
    const conFacC = armarLibroPorCuenta([facC])
    chequear("Balance · por cuenta", "🔑 Una Fac C va entera a «sin crédito fiscal» y NO descuadra",
      "sin crédito 1000 · diferencia 0",
      `sin crédito ${conFacC.meses[0].filas[0].sinCredito} · diferencia ${conFacC.meses[0].filas[0].diferencia}`,
      conFacC.meses[0].filas[0].sinCredito === 1000 && conFacC.meses[0].filas[0].diferencia === 0,
      "A-FEAT-1187")

    // Y en VENTAS la lista de tipos es otra: una Fac B de venta SÍ genera débito fiscal, así que
    // se abre. Usar la lista de compras acá contaría como «sin crédito» plata que sí abre.
    const facBVenta = armarLibroPorCuenta(
      [{ ...facC, tipo: 6, neto_gravado: 826.45, iva: 173.55, total: 1000 }],
      TIPOS_SIN_CREDITO_VENTAS,
    )
    chequear("Balance · por cuenta", "🔑 En VENTAS una Fac B sí se abre: la lista de tipos es distinta",
      "sin crédito 0 · diferencia 0",
      `sin crédito ${facBVenta.meses[0].filas[0].sinCredito} · diferencia ${facBVenta.meses[0].filas[0].diferencia}`,
      facBVenta.meses[0].filas[0].sinCredito === 0 && facBVenta.meses[0].filas[0].diferencia === 0,
      "A-FEAT-1187")

    chequear("Balance · por cuenta", "Sin nada que imputar, el resumen lo dice y no divide por cero",
      "0 · 0%", `${sano.sinImputar.comprobantes} · ${sano.sinImputar.porcentaje}%`,
      sano.sinImputar.comprobantes === 0 && sano.sinImputar.porcentaje === 0, "A-FEAT-1187")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 💳 CUENTAS A PAGAR / A COBRAR AL CIERRE — papeles 03 y 04 (A-FEAT-1187).
  //    El punto: manda CUÁNDO SE PAGÓ, no el estado de hoy.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const CIERRE = "2026-06-30"
    const comp = (
      estado: string, fechaPago: string | null, total: number, quien = "Proveedor",
    ): ComprobanteConPago => ({
      estado, fechaPago,
      origenFecha: fechaPago ? "movimiento bancario" : "sin dato",
      asiento: {
        id: `${quien}-${total}-${estado}`, fuente: "arca", subdiario: "2026-05",
        fecha: "2026-05-10", tipo: 1, punto_venta: 1, numero: 1,
        cuit: "30000000007", denominacion: quien,
        neto_gravado: 0, no_gravado: 0, exento: 0, otros_tributos: 0, iva: 0, total,
        cuenta_contable: "Aguadas", nro_cuenta: "", centro_costo: "",
      },
    })

    // 🔑 EL CASO QUE JUSTIFICA TODO: una factura que HOY dice «conciliado», pero que se pagó
    //    DESPUÉS del cierre. Al 30/06 era deuda, así que va al papel.
    const despues = armarCuentasAlCierre([comp("conciliado", "2026-08-15", 1_000_000)], CIERRE)
    chequear("Balance · cuentas", "🔑 Conciliada pero PAGADA DESPUÉS del cierre: SÍ es cuenta a pagar",
      "1 fila · 1000000", `${despues.filas.length} fila · ${despues.total}`,
      despues.filas.length === 1 && despues.total === 1_000_000, "A-FEAT-1187")

    const antes = armarCuentasAlCierre([comp("conciliado", "2026-06-15", 1_000_000)], CIERRE)
    chequear("Balance · cuentas", "Pagada ANTES del cierre: no es deuda",
      "0 filas", `${antes.filas.length} filas`, antes.filas.length === 0, "A-FEAT-1187")

    // 🎯 El borde exacto: pagada EL DÍA del cierre está paga.
    const elDia = armarCuentasAlCierre([comp("conciliado", "2026-06-30", 500)], CIERRE)
    chequear("Balance · cuentas", "🔑 Pagada EL DÍA del cierre cuenta como pagada",
      "0 filas", `${elDia.filas.length} filas`, elDia.filas.length === 0, "A-FEAT-1187")

    // 🎯 Sin fecha, manda el estado — pero sólo para un lado.
    const pendiente = armarCuentasAlCierre([comp("pendiente", null, 300_000)], CIERRE)
    chequear("Balance · cuentas", "Pendiente y sin fecha: es deuda",
      "1 fila · no se pagó nunca",
      `${pendiente.filas.length} fila · ${pendiente.filas[0]?.motivo}`,
      pendiente.filas[0]?.motivo === "no se pagó nunca", "A-FEAT-1187")

    // 🔑 EL HUECO HONESTO: dice conciliado y no hay NINGUNA fecha. No se puede decidir.
    const sinFecha = armarCuentasAlCierre([comp("conciliado", null, 6_000_000)], CIERRE)
    chequear("Balance · cuentas", "🔑 Conciliada SIN fecha: no se inventa — va a la lista aparte",
      "0 en el papel · 1 sin dato · 6000000",
      `${sinFecha.filas.length} en el papel · ${sinFecha.sinDatoDePago.length} sin dato · ${sinFecha.totalSinDato}`,
      sinFecha.filas.length === 0 && sinFecha.sinDatoDePago.length === 1 &&
      sinFecha.totalSinDato === 6_000_000, "A-FEAT-1187")

    // 🧨 EL SEGUNDO NÚMERO FALSO, y lo atrapó la red: TODAS las ventas están en estado
    //    «a cobrar» —con espacio—, que no estaba en ninguna lista. Los $103.044.319,07 del
    //    ejercicio desaparecían del papel sin dejar rastro.
    const aCobrar = armarCuentasAlCierre([comp("a cobrar", null, 103_044_319.07, "Cliente")], CIERRE)
    chequear("Balance · cuentas", "🔑 «a cobrar» (con espacio) SÍ es una cuenta a cobrar",
      "1 fila · 103044319.07", `${aCobrar.filas.length} fila · ${aCobrar.total}`,
      aCobrar.filas.length === 1 && aCobrar.total === 103_044_319.07, "A-FEAT-1187")

    // 🛑 LA RED: un estado que el módulo no conoce NO se tira, se informa con su nombre.
    const raro = armarCuentasAlCierre([comp("en veremos", null, 777)], CIERRE)
    chequear("Balance · cuentas", "🔑 Un estado desconocido no se descarta en silencio: se informa",
      "1 desconocido · 777 · «en veremos»",
      `${raro.estadoDesconocido.length} desconocido · ${raro.totalDesconocido} · «${raro.estadosSinClasificar.join(", ")}»`,
      raro.estadoDesconocido.length === 1 && raro.totalDesconocido === 777 &&
      raro.estadosSinClasificar[0] === "en veremos", "A-FEAT-1187")

    // 🧨 EL CASO QUE DABA UN NÚMERO FALSO: el histórico no trae estado ni fecha de pago. Tomarlo
    //    como «pendiente» daba $193.981.013,42 de deuda sobre $302 M de compras — el 64 %.
    const delHistorico = armarCuentasAlCierre([{
      ...comp("pendiente", null, 5_000_000, "Del sistema viejo"),
      asiento: { ...comp("pendiente", null, 5_000_000).asiento, fuente: "historico" },
    }], CIERRE)
    chequear("Balance · cuentas", "🔑 El histórico se da por PAGADO (decisión del usuario): no es deuda",
      "0 en el papel · 1 sin estado · 5000000",
      `${delHistorico.filas.length} en el papel · ${delHistorico.sinEstadoDePago.length} sin estado · ${delHistorico.totalSinEstado}`,
      delHistorico.filas.length === 0 && delHistorico.sinEstadoDePago.length === 1 &&
      delHistorico.totalSinEstado === 5_000_000, "A-FEAT-1187")

    // …pero si el histórico SÍ tiene una fecha de pago, manda la fecha como en todos los demás.
    const historicoConFecha = armarCuentasAlCierre([{
      ...comp("pendiente", "2026-08-01", 700),
      asiento: { ...comp("pendiente", "2026-08-01", 700).asiento, fuente: "historico" },
    }], CIERRE)
    chequear("Balance · cuentas", "Histórico CON fecha posterior al cierre: sí es deuda",
      "1 fila", `${historicoConFecha.filas.length} fila`,
      historicoConFecha.filas.length === 1, "A-FEAT-1187")

    // 🎯 ADVERSARIO — «anterior» es de OTRO ejercicio: no se duplica la deuda entre balances.
    const anterior = armarCuentasAlCierre([comp("anterior", null, 9_000_000)], CIERRE)
    chequear("Balance · cuentas", "🔑 Un comprobante «anterior» NO es deuda de este ejercicio",
      "0 en el papel · 0 sin dato",
      `${anterior.filas.length} en el papel · ${anterior.sinDatoDePago.length} sin dato`,
      anterior.filas.length === 0 && anterior.sinDatoDePago.length === 0, "A-FEAT-1187")

    // Y se cuenta cuántos entraron por «pagado después», que es el caso que el criterio ingenuo perdía.
    const mezcla = armarCuentasAlCierre([
      comp("conciliado", "2026-07-01", 100, "Zeta"),
      comp("conciliado", "2026-09-01", 200, "Alfa"),
      comp("pendiente", null, 300, "Beta"),
      comp("conciliado", "2026-01-01", 900, "Ya pagada"),
    ], CIERRE)
    chequear("Balance · cuentas", "Cuenta los pagados después del cierre y ordena por proveedor",
      "2 después · Alfa, Beta, Zeta · total 600",
      `${mezcla.pagadosDespues} después · ${mezcla.filas.map(f => f.asiento.denominacion).join(", ")} · total ${mezcla.total}`,
      mezcla.pagadosDespues === 2 && mezcla.total === 600 &&
      mezcla.filas[0].asiento.denominacion === "Alfa", "A-FEAT-1187")
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 🧾 UN CERTIFICADO = UN PAGO, y lo que define el pago es LA TRANSFERENCIA
  //    (A-BUG-1222). Los casos reales de BIOFARMA, LONGO y ALCORTA.
  // ══════════════════════════════════════════════════════════════════════════
  {
    let n = 0
    const ret = (
      fechaPago: string, retencion: number,
      opts: { grupo?: string; fc?: string; quincena?: string; tipo?: string; cert?: string } = {},
    ) => ({
      cuit_emisor: "30571438247", denominacion_emisor: "BIOFARMA S A",
      tipo_sicore: opts.tipo ?? "Bienes", quincena: opts.quincena ?? "26-09 - 2da",
      fecha_pago: fechaPago, retencion,
      grupo_pago_id: opts.grupo ?? null,
      factura_id: opts.fc ?? `fc-${++n}`,
      nro_certificado: opts.cert ?? null,
      anulado: false,
    })

    // 🔑 EL CASO ORIGINAL: dos pagos de la misma quincena son DOS certificados.
    const a = ret("2026-09-21", 109_770.05)
    const b = ret("2026-09-29", 69_213.15)
    chequear("SICORE · certificado", "🔑 Dos pagos de la misma quincena son DOS certificados",
      "no comparten", mismoCertificado(a, b) ? "comparten" : "no comparten",
      mismoCertificado(a, b) === false, "A-BUG-1222")

    // 🔑 LA PRECISIÓN DEL USUARIO: dos pagos DIRECTOS el MISMO DÍA también son dos certificados.
    //    Mi primer arreglo usaba la fecha y este caso pasaba igual — o sea que no probaba nada.
    const d1 = ret("2026-09-29", 100, { fc: "una" })
    const d2 = ret("2026-09-29", 200, { fc: "otra" })
    chequear("SICORE · certificado", "🔑 Dos pagos DIRECTOS del MISMO DÍA son dos certificados",
      "no comparten", mismoCertificado(d1, d2) ? "comparten" : "no comparten",
      mismoCertificado(d1, d2) === false, "A-BUG-1222")

    // …y lo que SÍ comparte: dos facturas pagadas en la MISMA transferencia (el caso Alcorta).
    const g1 = ret("2026-09-10", 158.26, { grupo: "d4a6320c", fc: "6328" })
    const g2 = ret("2026-09-10", 1_408.67, { grupo: "d4a6320c", fc: "6347" })
    chequear("SICORE · certificado", "🔑 Dos facturas de la MISMA transferencia comparten certificado",
      "comparten", mismoCertificado(g1, g2) ? "comparten" : "no comparten",
      mismoCertificado(g1, g2) === true, "A-BUG-1222")

    // 🎯 Un grupo y un directo el mismo día: NO comparten. Es el 10/09 real de ALCORTA.
    chequear("SICORE · certificado", "Un grupo y un pago directo del mismo día no comparten",
      "no comparten", mismoCertificado(g1, ret("2026-09-10", 27_950)) ? "comparten" : "no comparten",
      mismoCertificado(g1, ret("2026-09-10", 27_950)) === false, "A-BUG-1222")

    // 🎯 Mismo día y misma transferencia pero OTRO régimen: certificados separados.
    chequear("SICORE · certificado", "Misma transferencia pero otro régimen: certificados separados",
      "no comparten",
      mismoCertificado(g1, { ...g1, tipo_sicore: "Servicios" }) ? "comparten" : "no comparten",
      mismoCertificado(g1, { ...g1, tipo_sicore: "Servicios" }) === false, "A-BUG-1222")

    // La clave del pago: el grupo manda sobre la factura, y la factura sobre la fecha.
    chequear("SICORE · certificado", "La clave del pago es el grupo; sin grupo, el comprobante",
      "grupo:d4a6320c · fc:sola",
      `${clavePago(g1)} · ${clavePago(ret("2026-09-29", 1, { fc: "sola" }))}`,
      clavePago(g1) === "grupo:d4a6320c" &&
      clavePago(ret("2026-09-29", 1, { fc: "sola" })) === "fc:sola", "A-BUG-1222")

    // 📌 Filas VIEJAS (sin grupo ni comprobante): lo único que quedó es la fecha.
    chequear("SICORE · certificado", "En una fila vieja sin grupo ni comprobante, manda la fecha",
      "fecha:2026-08-31",
      clavePago({ fecha_pago: "2026-08-31", grupo_pago_id: null, factura_id: null }),
      clavePago({ fecha_pago: "2026-08-31", grupo_pago_id: null, factura_id: null }) === "fecha:2026-08-31",
      "A-BUG-1222")

    // 🧮 EL CONTROL, con el caso real de BIOFARMA: un número cubriendo dos pagos.
    const comoEstaba = [
      { ...ret("2026-09-21", 109_770.05, { cert: "00002026000065", fc: "v1" }) },
      { ...ret("2026-09-29", 69_213.15, { cert: "00002026000065", fc: "v2" }) },
    ]
    const hallazgos = certificadosConVariosPagos(comoEstaba)
    chequear("SICORE · certificado", "🧮 El control detecta un certificado que cubre DOS pagos",
      "1 hallazgo · 2 pagos · 178983.2",
      `${hallazgos.length} hallazgo · ${hallazgos[0]?.pagos.length} pagos · ${hallazgos[0]?.totalSumado}`,
      hallazgos.length === 1 && hallazgos[0].pagos.length === 2 &&
      hallazgos[0].totalSumado === 178_983.2, "A-BUG-1222")

    // …y con los números ya corregidos, el control queda en cero.
    const yaCorregido = [
      { ...ret("2026-09-21", 109_770.05, { cert: "00002026000065", fc: "v1" }) },
      { ...ret("2026-09-29", 69_213.15, { cert: "00002026000070", fc: "v2" }) },
    ]
    chequear("SICORE · certificado", "Con los números corregidos, el control no encuentra nada",
      "0", String(certificadosConVariosPagos(yaCorregido).length),
      certificadosConVariosPagos(yaCorregido).length === 0, "A-BUG-1222")

    // 🎯 ADVERSARIO — un grupo de 2 facturas bajo UN número NO es un hallazgo: es lo correcto.
    const grupoOk = [
      { ...g1, nro_certificado: "00002026000063" },
      { ...g2, nro_certificado: "00002026000063" },
    ]
    chequear("SICORE · certificado", "🔑 Un grupo de 2 facturas con un solo número NO es un error",
      "0", String(certificadosConVariosPagos(grupoOk).length),
      certificadosConVariosPagos(grupoOk).length === 0, "A-BUG-1222")

    // 🎯 ADVERSARIO — una retención ANULADA no dispara el control.
    const conAnulada = [
      { ...ret("2026-09-21", 1, { cert: "00002026000065", fc: "v1" }) },
      { ...ret("2026-09-29", 2, { cert: "00002026000065", fc: "v2" }), anulado: true },
    ]
    chequear("SICORE · certificado", "Una retención anulada no dispara el control",
      "0", String(certificadosConVariosPagos(conAnulada).length),
      certificadosConVariosPagos(conAnulada).length === 0, "A-BUG-1222")

    // Para MOSTRAR, se agrupa por el número guardado: es la identidad real del certificado.
    chequear("SICORE · certificado", "Para mostrar se agrupa por el número: 2 filas, 1 certificado",
      "1", String(agruparEnCertificados(grupoOk).length),
      agruparEnCertificados(grupoOk).length === 1, "A-BUG-1222")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🏦 PAPELES 7, 8 y 9 — bancos, gastos bancarios y retiros (A-FEAT-1197/98/99)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const PLAN = [
      { cuenta_contable: "Débitos / Créditos Ley 25413", nombre_totalizadora: "IMPUESTOS BANCARIOS", nro_cuenta: null },
      { cuenta_contable: "IVA Bancario", nombre_totalizadora: "IMPUESTOS BANCARIOS", nro_cuenta: null },
      { cuenta_contable: "Comisión Extracción Efectivo", nombre_totalizadora: "GASTOS BANCARIOS", nro_cuenta: null },
      { cuenta_contable: "Comisión Transferencias", nombre_totalizadora: "GASTOS BANCARIOS", nro_cuenta: null },
      { cuenta_contable: "Sueldos y jornales", nombre_totalizadora: "MANO DE OBRA", nro_cuenta: "422101" },
    ]
    const buscar = (categ: string, nro?: string) =>
      buscarCuenta({ fecha: "2025-07-01", categ, nro_cuenta: nro ?? null }, PLAN)

    // 🔑 EL CASO QUE JUSTIFICA TODO: el extracto escribe sin tildes y el plan con tildes.
    chequear("Balance · bancos", "🔑 «Iva Bancario» del extracto encuentra «IVA Bancario» del plan",
      "IMPUESTOS BANCARIOS", buscar("Iva Bancario")?.nombre_totalizadora ?? "(nada)",
      buscar("Iva Bancario")?.nombre_totalizadora === "IMPUESTOS BANCARIOS", "A-FEAT-1198")

    chequear("Balance · bancos", "🔑 «Comision Extraccion Efectivo» encuentra la que lleva tildes",
      "GASTOS BANCARIOS", buscar("Comision Extraccion Efectivo")?.nombre_totalizadora ?? "(nada)",
      buscar("Comision Extraccion Efectivo")?.nombre_totalizadora === "GASTOS BANCARIOS", "A-FEAT-1198")

    // 🔑 Y el match por PREFIJO, que es el que resuelve el «Ley 25413».
    chequear("Balance · bancos", "🔑 «Debitos / Creditos» encuentra «… Ley 25413» por prefijo",
      "Débitos / Créditos Ley 25413", buscar("Debitos / Creditos")?.cuenta_contable ?? "(nada)",
      buscar("Debitos / Creditos")?.cuenta_contable === "Débitos / Créditos Ley 25413", "A-FEAT-1198")

    // 🎯 ADVERSARIO — el NÚMERO manda sobre el nombre: es la identidad de verdad.
    chequear("Balance · bancos", "El número de cuenta manda sobre el nombre",
      "Sueldos y jornales", buscar("Iva Bancario", "422101")?.cuenta_contable ?? "(nada)",
      buscar("Iva Bancario", "422101")?.cuenta_contable === "Sueldos y jornales", "A-FEAT-1198")

    // 🛑 ADVERSARIO — con DOS candidatas por prefijo NO se elige ninguna: adivinar pondría el gasto
    //    en la totalizadora equivocada y el papel saldría plausible y mal.
    const ambiguo = [
      { cuenta_contable: "Comisión Cheques Depositados", nombre_totalizadora: "GASTOS BANCARIOS", nro_cuenta: null },
      { cuenta_contable: "Comisión Cheques Rechazados", nombre_totalizadora: "IMPUESTOS BANCARIOS", nro_cuenta: null },
    ]
    chequear("Balance · bancos", "🛑 Con dos candidatas por prefijo no adivina: devuelve nada",
      "(nada)",
      buscarCuenta({ fecha: "2025-07-01", categ: "Comision Cheques" }, ambiguo)?.cuenta_contable ?? "(nada)",
      buscarCuenta({ fecha: "2025-07-01", categ: "Comision Cheques" }, ambiguo) === null, "A-FEAT-1198")

    chequear("Balance · bancos", "Normaliza tildes, mayúsculas y puntuación",
      "debitos creditos ley 25413", normalizarCuenta("Débitos / Créditos Ley 25413"),
      normalizarCuenta("Débitos / Créditos Ley 25413") === "debitos creditos ley 25413", "A-FEAT-1198")

    // ── Los 12 meses del ejercicio ───────────────────────────────────────────────────────
    const mesesMSA = mesesDelEjercicio(2026, 6)
    chequear("Balance · bancos", "🔑 El ejercicio de MSA va de julio a junio",
      "2025-07 → 2026-06 · 12 meses",
      `${mesesMSA[0]} → ${mesesMSA[11]} · ${mesesMSA.length} meses`,
      mesesMSA[0] === "2025-07" && mesesMSA[11] === "2026-06" && mesesMSA.length === 12, "A-FEAT-1198")

    const mesesPAM = mesesDelEjercicio(2026, 12)
    chequear("Balance · bancos", "Y el de PAM/MA, de enero a diciembre del mismo año",
      "2026-01 → 2026-12", `${mesesPAM[0]} → ${mesesPAM[11]}`,
      mesesPAM[0] === "2026-01" && mesesPAM[11] === "2026-12", "A-FEAT-1198")

    // ── PAPEL 8 ──────────────────────────────────────────────────────────────────────────
    const gastos = armarGastosBancarios([
      { fecha: "2025-07-15", categ: "Iva Bancario", debitos: 100 },
      { fecha: "2025-07-20", categ: "Iva Bancario", debitos: 50 },
      { fecha: "2025-08-10", categ: "Comision Transferencias", debitos: 1000 },
      { fecha: "2026-06-30", categ: "Debitos / Creditos", debitos: 7 },
      { fecha: "2025-07-15", categ: "Sueldos", debitos: 999_999 },
      { fecha: "2024-05-01", categ: "Iva Bancario", debitos: 888 },
    ], PLAN, mesesMSA)

    chequear("Balance · bancos", "Agrupa por concepto del plan y suma el mes correcto",
      "IVA Bancario julio 150",
      `IVA Bancario julio ${gastos.filas.find(f => f.concepto === "IVA Bancario")?.debitos[0]}`,
      gastos.filas.find(f => f.concepto === "IVA Bancario")?.debitos[0] === 150, "A-FEAT-1198")

    chequear("Balance · bancos", "🔑 Lo que no es bancario NO entra al papel",
      "1157", String(gastos.total.totalDebitos),
      gastos.total.totalDebitos === 1157, "A-FEAT-1198")

    chequear("Balance · bancos", "🔑 Un movimiento FUERA del ejercicio no entra",
      "julio = 150", `julio = ${gastos.total.debitos[0]}`,
      gastos.total.debitos[0] === 150, "A-FEAT-1198")

    chequear("Balance · bancos", "Subtotala por totalizadora: gastos y impuestos separados",
      "2 subtotales", `${gastos.subtotales.length} subtotales`,
      gastos.subtotales.length === 2, "A-FEAT-1198")

    // 🧮 Lo bancario que NO está en el plan se informa, no se descarta.
    const conHueco = armarGastosBancarios(
      [{ fecha: "2025-07-15", categ: "Comision Rara Nueva", debitos: 500 }], PLAN, mesesMSA)
    chequear("Balance · bancos", "🧮 Un gasto bancario que no está en el plan se INFORMA",
      "1 sin clasificar · 500",
      `${conHueco.sinClasificar.length} sin clasificar · ${conHueco.sinClasificar[0]?.debitos}`,
      conHueco.sinClasificar.length === 1 && conHueco.sinClasificar[0].debitos === 500, "A-FEAT-1198")

    // ── PAPEL 7 · fondos comunes ─────────────────────────────────────────────────────────
    // 🔑 LOS NÚMEROS REALES de su balance anterior, para que el control quede verificado contra
    //    algo que él ya validó a mano.
    const fci = armarFondosComunes(
      [{ fecha: "2025-08-01", debitos: 390_900_000, creditos: 371_998_456.97, donde: "BANCO GALICIA" }],
      { "BANCO GALICIA": 0 }, { "BANCO GALICIA": 23_244_019.93 },
    )
    chequear("Balance · bancos", "🧮 El resultado del FCI sale por el camino inverso (caso real 24/25)",
      "4342476.9", String(fci.fondos[0].resultadoFinanciero),
      fci.fondos[0].resultadoFinanciero === 4_342_476.9, "A-FEAT-1197")

    // 🎯 ADVERSARIO — un fondo que se abrió y se cerró dentro del ejercicio: saldo 0 en las dos
    //    puntas, pero existió. No puede desaparecer del papel.
    const efimero = armarFondosComunes(
      [{ fecha: "2025-09-01", debitos: 1_000_000, creditos: 1_050_000, donde: "BROKER GSEC" }], {}, {})
    chequear("Balance · bancos", "🔑 Un fondo abierto y cerrado en el ejercicio igual aparece, con su ganancia",
      "1 fondo · 50000",
      `${efimero.fondos.length} fondo · ${efimero.fondos[0]?.resultadoFinanciero}`,
      efimero.fondos.length === 1 && efimero.fondos[0].resultadoFinanciero === 50_000, "A-FEAT-1197")

    // ── PAPEL 9 · retiros y aportes ──────────────────────────────────────────────────────
    const retiros = armarRetirosYAportes([
      { fecha: "2025-07-10", categ: "Distribucion Mama", debitos: 500_000 },
      { fecha: "2025-08-10", categ: "Retiro PAM", debitos: 1_300_000 },
      { fecha: "2025-09-10", categ: "Aporte PAM", creditos: 6_900_100 },
      { fecha: "2025-07-10", categ: "Sueldos", debitos: 999_999 },
    ], mesesMSA)

    chequear("Balance · bancos", "🔑 Un retiro va NEGATIVO y un aporte POSITIVO",
      "-500000 · 6900100",
      `${retiros.filas.find(f => f.etiqueta.includes("madre"))?.total} · ${retiros.filas.find(f => f.clase === "aporte")?.total}`,
      retiros.filas.find(f => f.etiqueta.includes("madre"))?.total === -500_000 &&
      retiros.filas.find(f => f.clase === "aporte")?.total === 6_900_100, "A-FEAT-1199")

    chequear("Balance · bancos", "🧮 El neto es aportes menos retiros",
      "5100100", String(retiros.neto.total),
      retiros.neto.total === 5_100_100, "A-FEAT-1199")

    // 🛑 Un concepto de retiro que no está en la lista se INFORMA: la lista es frágil a propósito.
    const raro = armarRetirosYAportes(
      [{ fecha: "2025-07-10", categ: "Retiro Tio Roberto", debitos: 80_000 }], mesesMSA)
    chequear("Balance · bancos", "🛑 Un retiro con categoría nueva se informa, no se pierde",
      "1 sin reconocer · 80000",
      `${raro.sinReconocer.length} sin reconocer · ${raro.sinReconocer[0]?.importe}`,
      raro.sinReconocer.length === 1 && raro.sinReconocer[0].importe === 80_000, "A-FEAT-1199")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🐄 EL CUADRE DE LA HACIENDA — los 5 puntos que el usuario marcó en el v2
  //    del export (2026-09-29). Acá el punto 3: inicio ± mov = stock final.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const INICIO = "2025-07-01"
    const CIERRE = "2026-06-30"
    const mov = (fecha: string, tipo: string, cantidad: number, categoria = "Vaca"): MovimientoDeHacienda =>
      ({ fecha, tipo, cantidad, categoria })

    // El caso sano: arranca con 100, compra 20, vende 30 → cierra con 90.
    const sano = cuadrarHacienda([
      mov("2025-06-30", "ajuste_stock", 100),
      mov("2025-09-10", "ajuste_stock", 20),
      mov("2026-03-15", "venta", -30),
    ], INICIO, CIERRE, 90)
    chequear("Balance · hacienda", "🧮 Inicio 100 + movimientos (-10) = 90, y cuadra con lo valuado",
      "inicio 100 · cierre 90 · dif 0",
      `inicio ${sano.existenciaInicio} · cierre ${sano.existenciaCierreCalculada} · dif ${sano.diferencia}`,
      sano.existenciaInicio === 100 && sano.existenciaCierreCalculada === 90 && sano.diferencia === 0,
      "A-FEAT-1187")

    chequear("Balance · hacienda", "Sin avisos cuando todo cuadra y no falta nada",
      "0 avisos", `${sano.avisos.length} avisos`, sano.avisos.length === 0, "A-FEAT-1187")

    // 🧨 EL CASO REAL DE MSA: la carga inicial está fechada DENTRO del ejercicio, así que la
    //    existencia al inicio es CERO y el papel no puede mostrar la variación del rodeo.
    const comoEstaMSA = cuadrarHacienda([
      mov("2026-02-15", "ajuste_stock", 421),
      mov("2026-03-30", "venta", -69),
      mov("2026-04-15", "mortandad", -6),
    ], INICIO, CIERRE, 346)
    chequear("Balance · hacienda", "🔑 Con la carga inicial fechada DENTRO del ejercicio, el inicio es CERO y avisa",
      "inicio 0 · avisa",
      `inicio ${comoEstaMSA.existenciaInicio} · ${comoEstaMSA.avisos.some(a => a.includes("CERO")) ? "avisa" : "NO avisa"}`,
      comoEstaMSA.existenciaInicio === 0 && comoEstaMSA.avisos.some(a => a.includes("CERO")),
      "A-FEAT-1187")

    chequear("Balance · hacienda", "…y el cuadre igual cierra contra lo valuado: 0 + 346 = 346",
      "346 · dif 0",
      `${comoEstaMSA.existenciaCierreCalculada} · dif ${comoEstaMSA.diferencia}`,
      comoEstaMSA.existenciaCierreCalculada === 346 && comoEstaMSA.diferencia === 0, "A-FEAT-1187")

    // 🛑 ADVERSARIO — un movimiento SIN categoría no se cuenta en la existencia, así que tiene que
    //    aparecer en el cuadre. Hoy la pantalla lo saltea en silencio.
    const conHuerfano = cuadrarHacienda([
      mov("2025-06-30", "ajuste_stock", 100),
      mov("2026-01-10", "ajuste_stock", 50, ""),
    ], INICIO, CIERRE, 100)
    chequear("Balance · hacienda", "🛑 Un movimiento sin categoría NO se cuenta, pero se INFORMA",
      "1 sin categoría · avisa de 50",
      `${conHuerfano.sinCategoria.length} sin categoría · ${conHuerfano.avisos.some(a => a.includes("50")) ? "avisa de 50" : "no avisa"}`,
      conHuerfano.sinCategoria.length === 1 && conHuerfano.avisos.some(a => a.includes("50")),
      "A-FEAT-1187")

    // 🎯 ADVERSARIO — los movimientos POSTERIORES al cierre no entran, y se dicen.
    const conPosteriores = cuadrarHacienda([
      mov("2025-06-30", "ajuste_stock", 100),
      mov("2026-09-03", "venta", -40),
    ], INICIO, CIERRE, 100)
    chequear("Balance · hacienda", "🔑 Un movimiento posterior al cierre no entra al balance, y se avisa",
      "cierre 100 · 1 posterior",
      `cierre ${conPosteriores.existenciaCierreCalculada} · ${conPosteriores.posterioresAlCierre} posterior`,
      conPosteriores.existenciaCierreCalculada === 100 && conPosteriores.posterioresAlCierre === 1,
      "A-FEAT-1187")

    // 🎯 Y si NO cuadra contra lo valuado, lo dice con los dos números.
    const noCuadra = cuadrarHacienda([mov("2025-06-30", "ajuste_stock", 100)], INICIO, CIERRE, 95)
    chequear("Balance · hacienda", "🧮 Si lo valuado no coincide con el cuadre, avisa con la diferencia",
      "dif 5 · avisa", `dif ${noCuadra.diferencia} · ${noCuadra.avisos.some(a => a.includes("NO cierra")) ? "avisa" : "no avisa"}`,
      noCuadra.diferencia === 5 && noCuadra.avisos.some(a => a.includes("NO cierra")), "A-FEAT-1187")

    // `cambio_categoria` neto cero: mueve cabezas entre categorías sin cambiar el total.
    const conCambio = cuadrarHacienda([
      mov("2025-06-30", "ajuste_stock", 100),
      mov("2026-02-18", "cambio_categoria", -10, "Ternero"),
      mov("2026-02-18", "cambio_categoria", 10, "Novillo"),
    ], INICIO, CIERRE, 100)
    chequear("Balance · hacienda", "Un cambio de categoría no mueve el total, y se ve abierto por tipo",
      "cierre 100 · cambio_categoria 0",
      `cierre ${conCambio.existenciaCierreCalculada} · cambio_categoria ${conCambio.porTipo.find(t => t.tipo === "cambio_categoria")?.cabezas}`,
      conCambio.existenciaCierreCalculada === 100 &&
      conCambio.porTipo.find(t => t.tipo === "cambio_categoria")?.cabezas === 0, "A-FEAT-1187")

    // 📅 El primer día del ejercicio, que es lo que separa «antes» de «durante».
    const ejMSA = armarEjercicio(2026, 6)
    chequear("Balance · hacienda", "🔑 El primer día del ejercicio de MSA es el 01/07/2025",
      "2025-07-01", primerDiaDelEjercicio(ejMSA),
      primerDiaDelEjercicio(ejMSA) === "2025-07-01", "A-FEAT-1187")
    chequear("Balance · hacienda", "Y el de PAM/MA, el 01/01 del año de cierre",
      "2026-01-01", primerDiaDelEjercicio(armarEjercicio(2026, 12)),
      primerDiaDelEjercicio(armarEjercicio(2026, 12)) === "2026-01-01", "A-FEAT-1187")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 💱 COTIZACIONES — los parsers del BNA y de la pizarra de Rosario.
  //    Los fragmentos de abajo son RECORTES REALES del 29/09/2026: el día que
  //    el sitio cambie, estos casos fallan y dicen dónde.
  // ══════════════════════════════════════════════════════════════════════════
  {
    // 🔑 Recorte real de bna.com.ar/Personas. Trae LAS DOS solapas, como la página.
    const BNA = `
      <div id="billetes"><table class="table cotizacion">
        <tr><td>29/9/2026</td><td>Compra</td><td>Venta</td></tr>
        <tr><td>Dolar U.S.A</td><td>1495.0000</td><td>1545.0000</td></tr>
        <tr><td>Euro</td><td>1670.0000</td><td>1770.0000</td></tr>
      </table></div>
      <div id="divisas"><table class="table cotizacion">
        <tr><td>29/9/2026</td><td>Compra</td><td>Venta</td></tr>
        <tr><td>Dolar U.S.A</td><td>1513.0000</td><td>1522.0000</td></tr>
        <tr><td>Libra Esterlina</td><td>1999.1269</td><td>2015.5846</td></tr>
        <tr><td>Euro</td><td>1712.4134</td><td>1726.4046</td></tr>
      </table></div>`

    const dolar = leerBnaDivisas(BNA, "Dolar U.S.A")
    chequear("Cotizaciones", "🔑 Lee DIVISAS, no la solapa de Billetes que viene primero",
      "2026-09-29 · 1513 / 1522",
      `${dolar?.fecha} · ${dolar?.compra} / ${dolar?.venta}`,
      dolar?.fecha === "2026-09-29" && dolar?.compra === 1513 && dolar?.venta === 1522,
      "A-FEAT-1202")

    // 🧨 EL ADVERSARIO QUE IMPORTA: billetes y divisas conviven en el mismo HTML y **los dos son
    //    números plausibles**. Un parser que agarre «la primera tabla» trae 1495/1545 y no falla.
    chequear("Cotizaciones", "🧨 NO devuelve el valor de Billetes (1495), que es el que viene antes",
      "no es 1495", dolar?.compra === 1495 ? "es 1495 (MAL)" : "no es 1495",
      dolar?.compra !== 1495, "A-FEAT-1202")

    const euro = leerBnaDivisas(BNA, "Euro")
    chequear("Cotizaciones", "Y encuentra el Euro de divisas, no el de billetes",
      "1712.4134", String(euro?.compra), euro?.compra === 1712.4134, "A-FEAT-1202")

    // 🛑 Ante una moneda que no está, devuelve null: no cae a otra fila.
    chequear("Cotizaciones", "🛑 Una moneda que no está devuelve NADA, no la fila de al lado",
      "null", String(leerBnaDivisas(BNA, "Peso Chileno")),
      leerBnaDivisas(BNA, "Peso Chileno") === null, "A-FEAT-1202")

    // 🛑 Y si la página cambia y ya no hay solapa de divisas, tampoco adivina.
    chequear("Cotizaciones", "🛑 Sin la solapa de divisas devuelve NADA, no usa billetes",
      "null", String(leerBnaDivisas('<div id="billetes">29/9/2026 Dolar U.S.A 1495.0000 1545.0000</div>', "Dolar U.S.A")),
      leerBnaDivisas('<div id="billetes">29/9/2026 Dolar U.S.A 1495.0000 1545.0000</div>', "Dolar U.S.A") === null,
      "A-FEAT-1202")

    // ── La pizarra de Rosario ────────────────────────────────────────────────────────────
    // 🔑 Recorte real de la consulta de soja, septiembre 2026.
    const BCR = `<table><thead><tr><th>Soja</th></tr><tr><th>Fecha</th><th>Precio</th></tr></thead>
      <tbody>
        <tr><td> 01/09/2026 </td><td> $560.000,00 </td></tr>
        <tr><td> 02/09/2026 </td><td> $564.000,00 </td></tr>
        <tr><td> 08/09/2026 </td><td> $556.000,00 </td></tr>
        <tr><td> 09/09/2026 </td><td> $555.000,00 </td></tr>
      </tbody></table>`

    const soja = leerPizarraBcr(BCR)
    chequear("Cotizaciones", "🔑 Lee la serie diaria de la pizarra: 4 días, y el primero es 560.000",
      "4 días · 560000 el 2026-09-01",
      `${soja.length} días · ${soja[0]?.valor} el ${soja[0]?.fecha}`,
      soja.length === 4 && soja[0].valor === 560_000 && soja[0].fecha === "2026-09-01",
      "A-FEAT-1202")

    // 🧨 EL FORMATO: `$560.000,00` son quinientos sesenta mil, no quinientos sesenta.
    chequear("Cotizaciones", "🧨 El punto es de MILES y la coma decimal: 560.000,00 = 560000",
      "560000", String(numeroConComa("$560.000,00")),
      numeroConComa("$560.000,00") === 560_000, "A-FEAT-1202")

    // …y en el BNA es al revés: el punto es DECIMAL.
    chequear("Cotizaciones", "🧨 Y en el BNA el punto es DECIMAL: 1513.0000 = 1513",
      "1513", String(numeroConPunto("1513.0000")),
      numeroConPunto("1513.0000") === 1513, "A-FEAT-1202")

    chequear("Cotizaciones", "La fecha argentina pasa a ISO",
      "2026-09-01", String(fechaArgentina("1/9/2026")),
      fechaArgentina("1/9/2026") === "2026-09-01", "A-FEAT-1202")

    // ── El promedio del mes, que es lo que el usuario usa en todos lados ─────────────────
    chequear("Cotizaciones", "🧮 El promedio del mes usa los días que COTIZARON, no los 30",
      "558750", String(promedioDelMes(soja, "2026-09")),
      promedioDelMes(soja, "2026-09") === 558_750, "A-FEAT-1202")

    chequear("Cotizaciones", "🛑 Un mes sin datos da NULL, no cero",
      "null", String(promedioDelMes(soja, "2026-10")),
      promedioDelMes(soja, "2026-10") === null, "A-FEAT-1202")

    chequear("Cotizaciones", "Y el promedio de una moneda se puede pedir por compra o por venta",
      "1513 / 1522",
      `${promedioDelMes([dolar!], "2026-09", "compra")} / ${promedioDelMes([dolar!], "2026-09", "venta")}`,
      promedioDelMes([dolar!], "2026-09", "compra") === 1513 &&
      promedioDelMes([dolar!], "2026-09", "venta") === 1522, "A-FEAT-1202")

    // El id de producto: soja 13 y maíz 3. Si el sitio los cambia, esto es lo primero a mirar.
    chequear("Cotizaciones", "La URL de la pizarra lleva el id del producto (soja 13, maíz 3)",
      "product=13 · product=3",
      `${urlPizarra("soja", "2026-09-01", "2026-09-30").match(/product=\d+/)?.[0]} · ` +
      `${urlPizarra("maiz", "2026-09-01", "2026-09-30").match(/product=\d+/)?.[0]}`,
      urlPizarra("soja", "2026-09-01", "2026-09-30").includes("product=13") &&
      urlPizarra("maiz", "2026-09-01", "2026-09-30").includes("product=3"), "A-FEAT-1202")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 📅 EL HISTÓRICO DEL DÓLAR y su control contra el BCRA (A-FEAT-1202).
  // ══════════════════════════════════════════════════════════════════════════
  {
    // Recorte real de api.argentinadatos.com, casa **mayorista** (la de DIVISAS).
    const CRUDO = [
      { casa: "mayorista", compra: 1465, venta: 1465, fecha: "2025-10-29" },
      { casa: "mayorista", compra: 1500, venta: 1509, fecha: "2026-09-28" },
      { casa: "mayorista", compra: 1513, venta: 1522, fecha: "2026-09-29" },
      { casa: "mayorista", compra: null, venta: 1600, fecha: "2026-09-30" },   // incompleta
      { casa: "mayorista", compra: 1, venta: 1 },                              // sin fecha
    ]

    const hist = leerHistoricoDolar(CRUDO)
    chequear("Cotizaciones", "🛑 Descarta las filas sin fecha o sin los dos valores, no las rellena con cero",
      "3 filas", `${hist.length} filas`, hist.length === 3, "A-FEAT-1202")

    chequear("Cotizaciones", "Ordena por fecha y conserva compra y venta",
      "2025-10-29 → 2026-09-29 · 1513/1522",
      `${hist[0].fecha} → ${hist[2].fecha} · ${hist[2].compra}/${hist[2].venta}`,
      hist[0].fecha === "2025-10-29" && hist[2].fecha === "2026-09-29" &&
      hist[2].compra === 1513 && hist[2].venta === 1522, "A-FEAT-1202")

    chequear("Cotizaciones", "Recorta al rango pedido",
      "1", String(leerHistoricoDolar(CRUDO, "2026-09-29", "2026-09-29").length),
      leerHistoricoDolar(CRUDO, "2026-09-29", "2026-09-29").length === 1, "A-FEAT-1202")

    // ── El BCRA, que viene anidado ───────────────────────────────────────────────────────
    const BCRA = {
      status: 200,
      results: [
        { fecha: "2026-09-29", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1522 }] },
        { fecha: "2026-09-28", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1509 }] },
        { fecha: "2025-10-29", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 1436 }] },
        { fecha: "2026-09-27", detalle: [{ codigoMoneda: "USD", tipoCotizacion: 0 }] },  // feriado
      ],
    }
    const bcra = leerCotizacionesBcra(BCRA)
    chequear("Cotizaciones", "🛑 Un día con cotización CERO (feriado) no es un precio: se descarta",
      "3 días", `${bcra.length} días`, bcra.length === 3, "A-FEAT-1202")

    // 🧮 EL CONTROL DE LAS DOS FUENTES, con el caso real: el 29/10/2025 difieren 29 pesos.
    const difs = cruzarDolarConBcra(hist, bcra)
    chequear("Cotizaciones", "🧮 Detecta el día que se desvía: 29/10/2025, 1465 contra 1436",
      "1 hallazgo · 2025-10-29 · 29",
      `${difs.length} hallazgo · ${difs[0]?.fecha} · ${difs[0]?.diferencia}`,
      difs.length === 1 && difs[0].fecha === "2025-10-29" && difs[0].diferencia === 29,
      "A-FEAT-1202")

    /**
     * 🔑 LA TOLERANCIA ES UN PORCENTAJE, no un monto, y acá está el porqué: la misma diferencia de
     * **$3** es enorme sobre el dólar de 2011 ($4) e irrelevante sobre el de hoy ($1.522).
     */
    const dosEpocas = [
      { fecha: "2011-01-03", compra: 4, venta: 7 },       // +$3 sobre 4 = 75 %
      { fecha: "2026-09-29", compra: 1519, venta: 1525 }, // +$3 sobre 1522 = 0,2 %
    ]
    const bcraDosEpocas = [
      { fecha: "2011-01-03", valor: 4 },
      { fecha: "2026-09-29", valor: 1522 },
    ]
    const porcentual = cruzarDolarConBcra(dosEpocas, bcraDosEpocas)
    chequear("Cotizaciones", "🔑 Los mismos $3 se marcan en 2011 y NO en 2026: la tolerancia es %",
      "1 hallazgo · 2011-01-03",
      `${porcentual.length} hallazgo · ${porcentual[0]?.fecha}`,
      porcentual.length === 1 && porcentual[0].fecha === "2011-01-03", "A-FEAT-1202")

    chequear("Cotizaciones", "Y con el 2 % por default, el día de 13 pesos sobre 1509 NO se marca",
      "no marca el 28/09",
      difs.some(d => d.fecha === "2026-09-28") ? "lo marca (MAL)" : "no marca el 28/09",
      !difs.some(d => d.fecha === "2026-09-28"), "A-FEAT-1202")

    // ── El huso ──────────────────────────────────────────────────────────────────────────
    // 🧨 No se puede fijar el resultado (depende de cuándo corre), pero sí la FORMA y que nunca
    //    esté adelantado respecto de UTC, que es el bug que se arregló.
    const hoyArg = hoyArgentina()
    const hoyUtc = new Date().toISOString().slice(0, 10)
    chequear("Cotizaciones", "🧨 Hoy en hora argentina nunca es POSTERIOR al de UTC",
      "no está adelantado", hoyArg > hoyUtc ? "adelantado (MAL)" : "no está adelantado",
      hoyArg <= hoyUtc && /^\d{4}-\d{2}-\d{2}$/.test(hoyArg), "A-FEAT-1202")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 💵 LOS VALORES AL CIERRE — cheques dados y anticipos (A-FEAT-1195).
  //    Los datos son los reales de MSA al 30/06/2026, fijos en el archivo.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const CIERRE = "2026-06-30"

    // ── Cheques dados ────────────────────────────────────────────────────────────────────
    // 🧨 Los tres primeros son reales y anteriores al cierre: los tres dicen `vigente` y los tres
    //    ya debitaron. Si el papel mirara el estado, listaría los tres.
    const CHEQUES: ChequeCrudo[] = [
      { numero: "101", banco: "Banco Galicia", monto: 1146880, fecha_emision: "2026-03-20",
        fecha_cobro: "2026-04-17", beneficiario_nombre: "Grupo Campo", estado: "vigente" },
      { numero: "102", banco: "Banco Galicia", monto: 1455755.7, fecha_emision: "2026-05-22",
        fecha_cobro: "2026-05-22", beneficiario_nombre: "Eduardo Castillo", estado: "vigente" },
      { numero: "105", banco: "Banco Galicia", monto: 1461558.28, fecha_emision: "2026-06-08",
        fecha_cobro: "2026-06-08", beneficiario_nombre: "ARROYO TALA SH", estado: "vigente" },
      // Emitido antes del cierre y debitado DESPUÉS: es el único que va al papel.
      { numero: "107", banco: "Banco Galicia", monto: 900000, fecha_emision: "2026-06-25",
        fecha_cobro: "2026-07-14", beneficiario_nombre: "Diferido de prueba", estado: "vigente" },
      // Sin fecha de débito: no se puede afirmar nada. Va a la lista aparte.
      { numero: "107", banco: "Banco Galicia", monto: 55000, fecha_emision: "2026-06-26",
        fecha_cobro: null, beneficiario_nombre: "Sin fecha de debito", estado: "vigente" },
      // Posterior al cierre: es de otro ejercicio.
      { numero: "109", banco: "Banco Galicia", monto: 7087983.11, fecha_emision: "2026-09-21",
        fecha_cobro: "2026-11-02", beneficiario_nombre: "BIOFARMA S A", estado: "vigente" },
    ]

    const ch = armarChequesDados(CHEQUES, CIERRE, "2026-09-30")

    chequear("Valores al cierre", "🧨 Manda la FECHA DE DÉBITO, no el estado: los 3 debitados antes NO van",
      "1 cheque · 900.000,00", `${ch.filas.length} cheque(s) · ${n2(ch.total)}`,
      ch.filas.length === 1 && ch.total === 900000, "A-FEAT-1195")

    chequear("Valores al cierre", "El que no tiene fecha de débito va aparte, no al papel",
      "1 · 55.000,00", `${ch.sinFechaDeDebito.length} · ${n2(ch.totalSinFecha)}`,
      ch.sinFechaDeDebito.length === 1 && ch.totalSinFecha === 55000, "A-FEAT-1195")

    chequear("Valores al cierre", "Cierra el conteo: mirados = papel + sin fecha + debitados antes + posteriores",
      "6", String(ch.filas.length + ch.sinFechaDeDebito.length + ch.debitadosAntes + ch.posteriores),
      ch.filas.length + ch.sinFechaDeDebito.length + ch.debitadosAntes + ch.posteriores === ch.mirados,
      "A-FEAT-1195")

    chequear("Valores al cierre", "🚦 Avisa que hay estados vigentes con el débito ya pasado",
      "avisa", ch.avisos.some(a => a.includes("vigente")) ? "avisa" : "no avisa",
      ch.avisos.some(a => a.includes("vigente")), "A-FEAT-1195")

    chequear("Valores al cierre", "🚦 Avisa del número de cheque repetido en el mismo banco",
      "avisa del 107", ch.avisos.some(a => a.includes("107")) ? "avisa del 107" : "no avisa",
      ch.avisos.some(a => a.includes("107")), "A-FEAT-1195")

    // ── Anticipos ────────────────────────────────────────────────────────────────────────
    // Casos reales de MSA. Los montos y las retenciones son los de la base.
    const ANTICIPOS: AnticipoCrudo[] = [
      // 🧨 Grupo Campo: HOY tiene `monto_restante` 0, y el saldo se consumió con la aplicación de
      //    marzo MÁS la retención. Sin el término del SICORE quedarían $14.720 inventados.
      { id: "gc", empresa: "MSA", nombre_proveedor: "Grupo Campo", cuit_proveedor: "1",
        monto: 1161600, monto_restante: 0, monto_sicore: 14720, fecha_pago: "2026-03-20",
        tipo: "pago" },
      // 🔑 Aplicado DESPUÉS del cierre: hoy figura consumido, al cierre era saldo entero.
      { id: "post", empresa: "MSA", nombre_proveedor: "Aplicado despues del cierre", cuit_proveedor: "2",
        monto: 500000, monto_restante: 0, fecha_pago: "2026-05-10", tipo: "pago" },
      // 🧨 `tipo = cobro`: es un anticipo DE UN CLIENTE, o sea PASIVO. No se suma con los de arriba.
      { id: "genta", empresa: null, nombre_proveedor: "Pedro Genta y Cia SA", cuit_proveedor: "3",
        monto: 116396073.85, monto_restante: 116396073.85, fecha_pago: "2026-02-26", tipo: "cobro" },
      // Pagado DESPUÉS del cierre: no existía al cierre.
      { id: "julio", empresa: "MSA", nombre_proveedor: "Anticipo de julio", cuit_proveedor: "4",
        monto: 37810987.5, monto_restante: 37810987.5, fecha_pago: "2026-07-21", tipo: "pago" },
      // Sin tipo: no se reparte a ninguno de los dos lados.
      { id: "sintipo", empresa: "MSA", nombre_proveedor: "Sin tipo", cuit_proveedor: "5",
        monto: 100000, monto_restante: 100000, fecha_pago: "2026-04-01", tipo: null },
    ]
    const APLICACIONES: AplicacionDeAnticipo[] = [
      { anticipo_id: "gc", monto_aplicado: 1146880, fecha_aplicacion: "2026-03-20 15:00:00" },
      { anticipo_id: "post", monto_aplicado: 500000, fecha_aplicacion: "2026-08-15 10:00:00" },
    ]

    const an = armarAnticiposAlCierre(ANTICIPOS, APLICACIONES, CIERRE, "MSA", true)

    chequear("Valores al cierre", "🔑 El saldo se recalcula AL CIERRE: lo aplicado después no lo baja",
      "500.000,00", n2(an.aProveedores.find(x => x.anticipo.id === "post")?.saldoAlCierre ?? 0),
      an.aProveedores.find(x => x.anticipo.id === "post")?.saldoAlCierre === 500000, "A-FEAT-1195")

    chequear("Valores al cierre", "🧮 La retención de SICORE también consume el anticipo (Grupo Campo)",
      "sin saldo", an.aProveedores.some(x => x.anticipo.id === "gc") ? "con saldo (MAL)" : "sin saldo",
      !an.aProveedores.some(x => x.anticipo.id === "gc"), "A-FEAT-1195")

    chequear("Valores al cierre", "🧨 Un anticipo de CLIENTE es pasivo y NO se suma con los de proveedores",
      "proveedores 500.000,00 · clientes 116.396.073,85",
      `proveedores ${n2(an.totalAProveedores)} · clientes ${n2(an.totalDeClientes)}`,
      an.totalAProveedores === 500000 && an.totalDeClientes === 116396073.85, "A-FEAT-1195")

    chequear("Valores al cierre", "Un anticipo pagado DESPUÉS del cierre no existía al cierre",
      "no está", an.aProveedores.some(x => x.anticipo.id === "julio") ? "está (MAL)" : "no está",
      !an.aProveedores.some(x => x.anticipo.id === "julio"), "A-FEAT-1195")

    chequear("Valores al cierre", "Sin tipo, no se reparte: queda en su propia lista",
      "1 · 100.000,00", `${an.sinTipo.length} · ${n2(an.totalSinTipo)}`,
      an.sinTipo.length === 1 && an.totalSinTipo === 100000, "A-FEAT-1195")

    chequear("Valores al cierre", "🧮 El control del camino inverso cierra con los anticipos del cierre",
      "0 descuadres", `${an.descuadres.length} descuadres`,
      an.descuadres.length === 0, "A-FEAT-1195")

    chequear("Valores al cierre", "⚠️ Los que no tienen empresa se cuentan y se avisan, no se esconden",
      "1 · 116.396.073,85", `${an.sinEmpresa} · ${n2(an.totalSinEmpresa)}`,
      an.sinEmpresa === 1 && an.totalSinEmpresa === 116396073.85
      && an.avisos.some(a => a.includes("empresa")), "A-FEAT-1195")

    // 🔑 La otra mitad del criterio: en PAM lo que no tiene empresa NO entra, y se dice cuántos.
    const enPam = armarAnticiposAlCierre(ANTICIPOS, APLICACIONES, CIERRE, "PAM", false)
    chequear("Valores al cierre", "En PAM no entra nada de MSA ni lo que no tiene empresa",
      "0 mirados · 5 afuera", `${enPam.mirados} mirados · ${enPam.deOtraEmpresa} afuera`,
      enPam.mirados === 0 && enPam.deOtraEmpresa === 5, "A-FEAT-1195")

    // 🧨 Y el control TIENE que gritar cuando falta una vía de consumo: el mismo Grupo Campo sin su
    //    retención cargada da un saldo que no coincide con el que guarda el sistema.
    const sinSicore = armarAnticiposAlCierre(
      ANTICIPOS.map(a => (a.id === "gc" ? { ...a, monto_sicore: null } : a)),
      APLICACIONES, CIERRE, "MSA", true)
    chequear("Valores al cierre", "🧮 Si falta una vía de consumo, el control lo detecta",
      "1 descuadre de 14.720,00",
      `${sinSicore.descuadres.length} descuadre(s) de ${n2(sinSicore.descuadres[0]?.diferencia ?? 0)}`,
      sinSicore.descuadres.length === 1 && sinSicore.descuadres[0].diferencia === 14720, "A-FEAT-1195")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🏦 LA CADENA DE SALDOS del papel 07 (A-FEAT-1206) y el orden dentro del día (A-BUG-1224).
  //    Los números son los reales de MSA / Banco Galicia cta cte, ejercicio 25/26.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /**
     * 🧨 Los 10 movimientos del 30/06/2026, con su `orden` y su saldo reales. Puestos **fuera de
     * orden a propósito**: así vienen de la base cuando no se pide `orden`, y es lo que hacía que el
     * saldo al cierre pudiera ser cualquiera de los diez.
     */
    const ULTIMO_DIA = [
      { fecha: "2026-06-30", orden: 686, debitos: 20000, creditos: 0, saldo: 313855.13 },
      { fecha: "2026-06-30", orden: 695, debitos: 30214.6, creditos: 0, saldo: -2261369.97 },
      { fecha: "2026-06-30", orden: 690, debitos: 0, creditos: 2470755.55, saldo: 2557881.63 },
      { fecha: "2026-06-30", orden: 687, debitos: 4200, creditos: 0, saldo: 309655.13 },
      { fecha: "2026-06-29", orden: 685, debitos: 4379.47, creditos: 0, saldo: 333855.13 },
    ]

    const ult = ultimoMovimiento(ULTIMO_DIA)
    chequear("Papel 07 · saldos", "🧨 El saldo al cierre sale del último por FECHA **y ORDEN**, no del último de la lista",
      "-2.261.369,97", n2(ult?.saldo ?? 0), ult?.saldo === -2261369.97, "A-BUG-1224")

    // Y el adversario: el mismo arreglo mirado «como venía» daba el primero del día.
    chequear("Papel 07 · saldos", "🧨 Sin ordenar por orden, el saldo habría sido el de media jornada",
      "313.855,13 era el falso", n2(ULTIMO_DIA[0].saldo),
      ULTIMO_DIA[0].saldo === 313855.13 && ult?.saldo !== ULTIMO_DIA[0].saldo, "A-BUG-1224")

    const pri = primerMovimiento(ULTIMO_DIA)
    chequear("Papel 07 · saldos", "Y el primero, con el mismo criterio al revés",
      "29/06 orden 685", `${pri?.fecha} orden ${pri?.orden}`,
      pri?.fecha === "2026-06-29" && pri?.orden === 685, "A-BUG-1224")

    /**
     * 🧮 **LA CADENA COMPLETA, con los números reales del ejercicio.**
     *
     * Se simula con dos movimientos que llevan los datos que importan: el **primero** cargado (para
     * despejar el saldo previo) y el **último** (para el saldo al cierre), y un neto que es el de los
     * 695 movimientos reales.
     */
    const NETO_REAL = 439261543.76 - 442723296.25            // créditos − débitos = −3.461.752,49
    const MOVS = [
      // 02/02/2026, «Comision Servicio De Cuenta»: dejó el saldo en 1.140.382,52 desde 1.200.382,52.
      { fecha: "2026-02-02", orden: 1, debitos: 60000, creditos: 0, saldo: 1140382.52 },
      // 30/06/2026, el último: el saldo del extracto.
      { fecha: "2026-06-30", orden: 695, debitos: 0, creditos: 0, saldo: -2261369.97 },
      // El resto del ejercicio, condensado para que el neto sea el real.
      { fecha: "2026-03-15", orden: 2, debitos: 442663296.25, creditos: 439261543.76, saldo: 0 },
    ]
    const DECLARADO = {
      empresa: "MSA", ejercicio: "25/26", cuenta: "BANCO GALICIA (cta cte)",
      saldo: 832605.05, fuente: "planilla del usuario",
    }

    const c = armarCadenaDeSaldos("BANCO GALICIA (cta cte)", MOVS, DECLARADO)

    chequear("Papel 07 · saldos", "🔑 El saldo previo al primer movimiento se DESPEJA de ese movimiento",
      "1.200.382,52", n2(c.saldoAntesDeLoCargado ?? 0),
      c.saldoAntesDeLoCargado === 1200382.52, "A-FEAT-1206")

    chequear("Papel 07 · saldos", "🔑 El tramo que la app no tiene se deduce: no hay que cargar 7 meses",
      "367.777,47", n2(c.netoNoCargado ?? 0),
      c.netoNoCargado === 367777.47, "A-FEAT-1206")

    chequear("Papel 07 · saldos", "El neto de lo cargado es el de los 695 movimientos",
      "-3.461.752,49", n2(c.netoCargado), c.netoCargado === r2(NETO_REAL), "A-FEAT-1206")

    chequear("Papel 07 · saldos", "🧮 EL CONTROL: reconstruido desde el inicio da el saldo del extracto",
      "-2.261.369,97 y diferencia 0",
      `${n2(c.cierreCalculado ?? 0)} y diferencia ${n2(c.diferencia ?? -1)}`,
      c.cierreCalculado === -2261369.97 && c.diferencia === 0, "A-FEAT-1206")

    // 🛑 Una cuenta sin saldo al inicio declarado no inventa cero: se dice que no se conoce, y el
    //    control del tramo cargado se puede hacer igual.
    const sinDeclarar = armarCadenaDeSaldos("CAJA GENERAL", MOVS, null)
    chequear("Papel 07 · saldos", "🛑 Sin saldo al inicio declarado no se asume cero: queda en null",
      "inicio null y neto no cargado null",
      `inicio ${sinDeclarar.saldoInicio} y neto no cargado ${sinDeclarar.netoNoCargado}`,
      sinDeclarar.saldoInicio === null && sinDeclarar.netoNoCargado === null, "A-FEAT-1206")

    chequear("Papel 07 · saldos", "…pero el control del tramo cargado se hace igual",
      "diferencia 0", n2(sinDeclarar.diferencia ?? -1),
      sinDeclarar.diferencia === 0, "A-FEAT-1206")

    // Una cuenta vacía (las 3 cajas) no puede controlarse, y eso se informa en vez de dar cero.
    const vacia = armarCadenaDeSaldos("CAJA AMS", [], null)
    chequear("Papel 07 · saldos", "Una cuenta vacía no se puede controlar, y no da cero",
      "todo null", `cierre ${vacia.saldoAlCierre} diferencia ${vacia.diferencia}`,
      vacia.saldoAlCierre === null && vacia.diferencia === null && vacia.movimientos === 0,
      "A-FEAT-1206")

    // 🧨 Y el control TIENE que gritar si falta un movimiento: se saca el del neto y no cierra.
    const conHueco = armarCadenaDeSaldos("BANCO GALICIA (cta cte)",
      MOVS.filter(m => m.fecha !== "2026-03-15"), DECLARADO)
    // 📌 La diferencia es el neto de la fila quitada (439.261.543,76 − 442.663.296,25), NO el neto del
    //    ejercicio: los $60.000 del primer movimiento siguen contados.
    chequear("Papel 07 · saldos", "🧮 Si falta un movimiento, el control no cierra",
      "diferencia 3.401.752,49", n2(conHueco.diferencia ?? 0),
      conHueco.diferencia === 3401752.49, "A-FEAT-1206")

    /**
     * 🔍 **Lo que separa «falta un movimiento» de «el orden está mal»** — las dos causas dan la misma
     * diferencia total y mandan a lugares distintos. Caso real: CAJA SIGOT parecía tener $205.000
     * faltantes y eran 17 saltos que se cancelan (su `orden` no sigue a la fecha) → A-DAT-75.
     */
    const ORDEN_ROTO = [
      { fecha: "2026-03-06", orden: 21, debitos: 0, creditos: 0, saldo: 893601 },
      // El saldo sube 27.000 con un débito de 3.000: antes tenía que haber entrado plata.
      { fecha: "2026-03-06", orden: 22, debitos: 3000, creditos: 0, saldo: 920601 },
      // Y acá vuelve: el par se compensa. Es orden, no plata.
      { fecha: "2026-03-07", orden: 17, debitos: 440000, creditos: 0, saldo: 453601 },
    ]
    const roto = armarCadenaDeSaldos("CAJA SIGOT", ORDEN_ROTO, null)
    chequear("Papel 07 · saldos", "🔍 Varios saltos que se compensan = el ORDEN está mal, no falta plata",
      "2 saltos", `${roto.saltos} saltos`, roto.saltos === 2, "A-FEAT-1206")

    // Un solo salto, en cambio, es un movimiento que falta: ahí sí está la plata.
    const faltaUno = [
      { fecha: "2026-03-01", orden: 1, debitos: 0, creditos: 0, saldo: 100000 },
      { fecha: "2026-03-02", orden: 2, debitos: 0, creditos: 0, saldo: 250000 },
      { fecha: "2026-03-03", orden: 3, debitos: 10000, creditos: 0, saldo: 240000 },
    ]
    const unSalto = armarCadenaDeSaldos("PRUEBA", faltaUno, null)
    chequear("Papel 07 · saldos", "🔍 Un solo salto = falta un movimiento, y su importe es el salto",
      "1 salto de 150.000,00", `${unSalto.saltos} salto de ${n2(unSalto.sumaDeSaltos)}`,
      unSalto.saltos === 1 && unSalto.sumaDeSaltos === 150000, "A-FEAT-1206")

    chequear("Papel 07 · saldos", "El saldo al inicio declarado se encuentra por empresa, ejercicio y cuenta",
      "832.605,05",
      n2(saldoAlInicioDe("MSA", "25/26", "BANCO GALICIA (cta cte)")?.saldo ?? 0),
      saldoAlInicioDe("MSA", "25/26", "BANCO GALICIA (cta cte)")?.saldo === 832605.05
      && saldoAlInicioDe("MSA", "25/26", "CAJA GENERAL") === null
      && saldoAlInicioDe("PAM", "25/26", "BANCO GALICIA (cta cte)") === null, "A-FEAT-1206")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🕐 LAS FECHAS EN HORA ARGENTINA (A-OP-23).
  // ══════════════════════════════════════════════════════════════════════════
  {
    /**
     * 🧨 El caso que vale: **22:00 hora argentina del 30/06** es la 01:00 UTC del **01/07**. Es el
     * corte del balance, así que un movimiento cargado ahí cambiaba de EJERCICIO.
     */
    const finDeJunio = new Date("2026-07-01T01:00:00Z")
    chequear("Fechas", "🧨 A las 22:00 del 30/06, UTC dice 01/07 y el ejercicio cambia",
      "argentina 2026-06-30 · UTC 2026-07-01",
      `argentina ${diaArgentino(finDeJunio)} · UTC ${finDeJunio.toISOString().slice(0, 10)}`,
      diaArgentino(finDeJunio) === "2026-06-30"
      && finDeJunio.toISOString().slice(0, 10) === "2026-07-01", "A-OP-23")

    // Y el mes: a las 22:00 del 31/03 el presupuesto arrancaría en abril.
    const finDeMarzo = new Date("2026-04-01T01:30:00Z")
    chequear("Fechas", "🧨 Lo mismo con el MES: a las 22:30 del 31/03, UTC ya dice abril",
      "2026-03", diaArgentino(finDeMarzo).slice(0, 7),
      diaArgentino(finDeMarzo).slice(0, 7) === "2026-03", "A-OP-23")

    // A media mañana los dos coinciden: el arreglo no corre las fechas del resto del día.
    const mediaManana = new Date("2026-06-15T13:00:00Z")
    chequear("Fechas", "A media mañana argentina y UTC dan el mismo día",
      "2026-06-15", diaArgentino(mediaManana),
      diaArgentino(mediaManana) === "2026-06-15", "A-OP-23")

    // Forma y coherencia entre las tres funciones.
    chequear("Fechas", "Hoy y el mes son coherentes, y hoy nunca está adelantado respecto de UTC",
      "coherentes",
      hoyArgentina().startsWith(mesArgentina())
      && hoyArgentina() <= new Date().toISOString().slice(0, 10) ? "coherentes" : "NO coherentes",
      /^\d{4}-\d{2}-\d{2}$/.test(hoyArgentina())
      && /^\d{4}-\d{2}$/.test(mesArgentina())
      && hoyArgentina().startsWith(mesArgentina())
      && hoyArgentina() <= new Date().toISOString().slice(0, 10), "A-OP-23")

    // 🔑 Y lo que NO se toca: un instante para un timestamptz sigue siendo UTC, con su zona adentro.
    chequear("Fechas", "🔑 `ahoraISO` sigue siendo UTC: un timestamptz lleva la zona adentro",
      "termina en Z y tiene hora", ahoraISO().endsWith("Z") ? "termina en Z y tiene hora" : "no",
      ahoraISO().endsWith("Z") && ahoraISO().length > 20, "A-OP-23")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🔗 LA PROPAGACIÓN DE LA CUENTA AL EXTRACTO (A-BUG-1221 / A-BUG-1225).
  //    Los valores de `categ` son los reales de `msa_galicia`.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /** Las cuentas del plan que intervienen, tal como están escritas. */
    const PLAN = ["COMBUSTIBLES Y LUBRICANTES", "HONORARIOS AMS", "IMPUESTOS BANCARIOS"]

    /**
     * 🔑 La regla la fijó el usuario: **«el anticipo nunca es una cuenta contable, es una vía de pago
     * cuando no hay factura. Anticipo es provisorio»**. Entonces se pisa, y hay que pisarlo.
     */
    for (const [valor, provisoria] of [
      ["ANTICIPO", true], ["SIN_CATEG", true], ["INVALIDA:", true], ["", true], [null, true],
      ["FCI", false], ["CAJA", false], ["Sueldos", false], ["Tarjetas MSA", false],
      ["COMBUSTIBLES Y LUBRICANTES", false],
    ] as Array<[string | null, boolean]>) {
      chequear("Propagación de cuenta", `«${valor ?? "(null)"}» ${provisoria ? "ES" : "NO es"} provisoria`,
        String(provisoria), String(esCategProvisoria(valor)),
        esCategProvisoria(valor) === provisoria, "A-BUG-1225")
    }

    const MOVS = [
      // Los tres casos reales que hoy no coinciden: facturas sin cuenta todavía.
      { schema: "public", tabla: "msa_galicia", id: "m1", categ: "SIN_CATEG" },
      { schema: "public", tabla: "msa_galicia", id: "m2", categ: "INVALIDA:" },
      { schema: "public", tabla: "msa_galicia", id: "m3", categ: "ANTICIPO" },
      // Uno ya bien imputado: se reimputa sin drama.
      { schema: "public", tabla: "msa_galicia", id: "m4", categ: "COMBUSTIBLES Y LUBRICANTES" },
      // 🧨 Y los dos peligrosos: clasificación de OTRO sistema.
      { schema: "public", tabla: "msa_galicia", id: "m5", categ: "FCI" },
      { schema: "msa", tabla: "tarjeta_visa_business", id: "m6", categ: "Sueldos" },
    ]

    const decs = decidirPropagacion(MOVS, PLAN)
    const escriben = decs.filter(d => d.seEscribe).map(d => d.movimientoId)
    const saltean = decs.filter(d => !d.seEscribe).map(d => d.movimientoId)

    chequear("Propagación de cuenta", "🔑 Los provisorios y los ya imputados SÍ se escriben",
      "m1, m2, m3, m4", escriben.join(", "),
      escriben.join(",") === "m1,m2,m3,m4", "A-BUG-1225")

    chequear("Propagación de cuenta", "🧨 FCI y Sueldos NO se pisan: son de otro sistema",
      "m5, m6", saltean.join(", "), saltean.join(",") === "m5,m6", "A-BUG-1225")

    chequear("Propagación de cuenta", "Y cada decisión dice su motivo, para poder auditarla",
      "provisorio · del plan · de otro sistema",
      [decs.find(d => d.movimientoId === "m3")?.motivo,
       decs.find(d => d.movimientoId === "m4")?.motivo,
       decs.find(d => d.movimientoId === "m5")?.motivo].join(" | "),
      decs.find(d => d.movimientoId === "m3")?.motivo === "estaba vacío o provisorio"
      && decs.find(d => d.movimientoId === "m4")?.motivo === "tenía una cuenta del plan"
      && decs.find(d => d.movimientoId === "m5")?.motivo === "tenía una clasificación de otro sistema",
      "A-BUG-1225")

    // 🧮 El aviso: si no hay nada que decir, no molesta; si hay, nombra los valores salteados.
    chequear("Propagación de cuenta", "Sin salteados ni fallas, no avisa nada",
      "null", String(avisoDePropagacion({ propagados: 4, salteados: [], fallaron: [], decisiones: [] })),
      avisoDePropagacion({ propagados: 4, salteados: [], fallaron: [], decisiones: [] }) === null,
      "A-BUG-1225")

    const aviso = avisoDePropagacion({
      propagados: 4, fallaron: [], decisiones: decs,
      salteados: decs.filter(d => !d.seEscribe),
    })
    chequear("Propagación de cuenta", "🧮 Con salteados, el aviso dice CUÁNTOS y con qué categoría",
      "nombra FCI y Sueldos", aviso?.includes("FCI") && aviso?.includes("Sueldos") ? "nombra FCI y Sueldos" : String(aviso),
      !!aviso && aviso.includes("FCI") && aviso.includes("Sueldos") && aviso.includes("2 movimiento"),
      "A-BUG-1225")

    // 🔇 Y una tabla que falló tampoco se calla.
    const conFalla = avisoDePropagacion({
      propagados: 1, salteados: [], decisiones: [],
      fallaron: [{ schema: "msa", tabla: "tarjeta_visa_business", error: "permission denied" }],
    })
    chequear("Propagación de cuenta", "🔇 Una tabla que falla se dice, no va a la consola",
      "nombra la tabla", conFalla?.includes("tarjeta_visa_business") ? "nombra la tabla" : String(conFalla),
      !!conFalla && conFalla.includes("tarjeta_visa_business"), "A-BUG-1221")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 💰 EL SUELDO POR TOTAL + A (A-FEAT-1211). Los números son los reales de Sigot.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /** El caso testigo: Sigot. A viene del convenio, el total es lo que se acuerda. */
    const TOTAL = 1600000
    const A = 1408347.10
    const rep = repartirTotalEnAB(TOTAL, A)

    chequear("Sueldo total+A", "🔢 El total de Sigot es redondo y B sale de la resta",
      "B = 191.652,90", n2(rep.b), rep.b === 191652.90, "A-FEAT-1211")

    chequear("Sueldo total+A", "🔑 Y A + B vuelve a dar el total: el bruto no se mueve",
      n2(TOTAL), n2(rep.a + rep.b), r2(rep.a + rep.b) === TOTAL, "A-FEAT-1211")

    // 🔑 Lo que prueba que el cambio es de INGRESO y no de cálculo: el valor del franco es el mismo
    //    salga de `total/25` o de `(A+B)/25`.
    chequear("Sueldo total+A", "🔑 El valor del franco da igual desde el total que desde A+B",
      "64.000,00", n2(valorFrancoDeTotal(TOTAL)),
      valorFrancoDeTotal(TOTAL) === r2((A + rep.b) / 25) && valorFrancoDeTotal(TOTAL) === 64000,
      "A-FEAT-1211")

    // 🛑 El adversario: A mayor que el total. B negativo es una contradicción, no un dato.
    const mal = repartirTotalEnAB(1000000, 1200000)
    chequear("Sueldo total+A", "🛑 Si A supera el total, se marca inválido (no se recorta a cero)",
      "inválido y B = -200.000,00",
      `${mal.invalido ? "inválido" : "válido"} y B = ${n2(mal.b)}`,
      mal.invalido && mal.b === -200000, "A-FEAT-1211")

    chequear("Sueldo total+A", "Con A igual al total, B es cero y sigue siendo válido",
      "B 0 y válido", `B ${n2(repartirTotalEnAB(500000, 500000).b)} y ${repartirTotalEnAB(500000, 500000).invalido ? "inválido" : "válido"}`,
      repartirTotalEnAB(500000, 500000).b === 0 && !repartirTotalEnAB(500000, 500000).invalido,
      "A-FEAT-1211")

    // Los centavos no se escapan: el reparto redondea a 2 decimales en las dos puntas.
    const conCentavos = repartirTotalEnAB(1000000.333, 333333.111)
    chequear("Sueldo total+A", "Redondea a centavos y la suma sigue cerrando",
      "cierra", r2(conCentavos.a + conCentavos.b) === conCentavos.total ? "cierra" : "no cierra",
      r2(conCentavos.a + conCentavos.b) === conCentavos.total, "A-FEAT-1211")

    // Y los otros empleados de ab_francos, para que no se rompa ninguno.
    for (const [nombre, total, a, bEsperado] of [
      ["Barreto", 1100000, 0, 1100000],
      ["Alondra", 500000, 0, 500000],
    ] as Array<[string, number, number, number]>) {
      chequear("Sueldo total+A", `${nombre}: con A en cero, B es todo el total`,
        n2(bEsperado), n2(repartirTotalEnAB(total, a).b),
        repartirTotalEnAB(total, a).b === bEsperado, "A-FEAT-1211")
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 💸 EL PAGO DE SUELDO REPARTIDO (A-FEAT-1212). El caso es el de Sigot.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /**
     * Sigot: total 1.600.000 (A 1.408.347,10 + B 191.652,90), 5 francos a 64.000 = 320.000.
     * Bruto = 1.920.000. Sin anticipos todavía.
     */
    const BRUTO = 1920000
    const MONTO_A = 1408347.10
    const s = saldosDelPeriodo(BRUTO, 0, MONTO_A)

    chequear("Pago repartido", "El saldo total es el bruto menos lo ya pagado",
      "1.920.000,00", n2(s.saldoTotal), s.saldoTotal === 1920000, "A-FEAT-1212")

    chequear("Pago repartido", "🔑 Y el «saldo A» es A completo mientras quede B sin pagar",
      "1.408.347,10", n2(s.saldoA), s.saldoA === 1408347.10, "A-FEAT-1212")

    // 🧮 El reparto que él describió: Lucrecia, Galicia y la caja Sigot como programado.
    const REPARTO: RenglonPago[] = [
      { cuentaDestinoId: "lucrecia", medio: "banco", monto: 191652.90, estado: "pagar", fecha: "2026-09-30" },
      { cuentaDestinoId: "galicia", medio: "banco", monto: 1408347.10, estado: "pagar", fecha: "2026-09-30" },
      { cuentaDestinoId: null, medio: "caja_sigot", monto: 320000, estado: "programado", fecha: "2026-09-30" },
    ]
    const c = controlarReparto(s, REPARTO)

    chequear("Pago repartido", "🧮 Muestra el saldo DESPUÉS de cada renglón, no sólo el total",
      "1.728.347,10 → 320.000,00 → 0,00",
      c.pasos.map(x => n2(x.saldoDespues)).join(" → "),
      c.pasos.map(x => x.saldoDespues).join(",") === "1728347.1,320000,0", "A-FEAT-1212")

    chequear("Pago repartido", "🧮 Y el control cierra: los renglones agotan el saldo",
      "total 1.920.000,00 y saldo 0,00",
      `total ${n2(c.total)} y saldo ${n2(c.saldoFinal)}`,
      c.total === 1920000 && c.saldoFinal === 0 && c.sePuedeGuardar, "A-FEAT-1212")

    // 🔘 El botón «pagar saldo»: completa lo que falta CONTANDO los otros renglones.
    const dosCargados: RenglonPago[] = [REPARTO[0], REPARTO[1], { ...REPARTO[2], monto: 0 }]
    chequear("Pago repartido", "🔘 «Pagar saldo total» completa el resto, no repite el total",
      "320.000,00", n2(montoParaSaldo(s, dosCargados, 2, "total")),
      montoParaSaldo(s, dosCargados, 2, "total") === 320000, "A-FEAT-1212")

    chequear("Pago repartido", "🔘 «Pagar saldo A» con nada cargado da A entero",
      "1.408.347,10",
      n2(montoParaSaldo(s, [{ ...REPARTO[0], monto: 0 }], 0, "A")),
      montoParaSaldo(s, [{ ...REPARTO[0], monto: 0 }], 0, "A") === 1408347.10, "A-FEAT-1212")

    /**
     * 🔘 Y nunca da negativo: si los otros renglones **ya cubren** el objetivo, no queda nada por
     * completar. El caso real es pedir «saldo A» cuando otro renglón ya se llevó más que A.
     */
    const yaCubierto: RenglonPago[] = [
      { ...REPARTO[0], monto: 1600000 },
      { ...REPARTO[2], monto: 0 },
    ]
    chequear("Pago repartido", "🔘 Si los otros ya cubren el objetivo, no queda nada por completar",
      "0,00", n2(montoParaSaldo(s, yaCubierto, 1, "A")),
      montoParaSaldo(s, yaCubierto, 1, "A") === 0, "A-FEAT-1212")

    // 🛑 Frena: un renglón sin importe no es un pago.
    const conVacio = controlarReparto(s, [REPARTO[0], { ...REPARTO[2], monto: 0 }])
    chequear("Pago repartido", "🛑 Un renglón sin importe frena el guardado y se marca cuál",
      "no se puede, renglón 1",
      `${conVacio.sePuedeGuardar ? "se puede" : "no se puede"}, renglón ${conVacio.sinImporte.join(",")}`,
      !conVacio.sePuedeGuardar && conVacio.sinImporte.join(",") === "1", "A-FEAT-1212")

    /**
     * ⚠️ Pagar MÁS que el saldo avisa y **deja seguir** — regla del propio usuario sobre los
     * controles: *«es posible que yo tenga que pagar más o menos por algún motivo»*.
     */
    const deMas = controlarReparto(s, [{ ...REPARTO[0], monto: 2000000 }])
    chequear("Pago repartido", "⚠️ Pagar más que el saldo AVISA y deja guardar (no es un bug)",
      "avisa y se puede guardar",
      `${deMas.pagaDeMas ? "avisa" : "no avisa"} y ${deMas.sePuedeGuardar ? "se puede guardar" : "no se puede"}`,
      deMas.pagaDeMas && deMas.sePuedeGuardar && deMas.saldoFinal === -80000, "A-FEAT-1212")

    // ⚠️ Dos renglones a la misma cuenta: raro, se avisa.
    const repetida = controlarReparto(s, [REPARTO[0], { ...REPARTO[0], monto: 1000 }])
    chequear("Pago repartido", "⚠️ Dos renglones a la misma cuenta se avisan, sin frenar",
      "avisa de lucrecia y se puede guardar",
      `${repetida.cuentasRepetidas.join(",")} y ${repetida.sePuedeGuardar ? "se puede guardar" : "no"}`,
      repetida.cuentasRepetidas.join(",") === "lucrecia" && repetida.sePuedeGuardar, "A-FEAT-1212")

    // 🎚️ El estado por default según el medio: la caja se programa, el banco se paga.
    chequear("Pago repartido", "🎚️ El default: banco → pagar · caja → programado",
      "pagar · programado · programado",
      [estadoPorDefectoDe("banco"), estadoPorDefectoDe("caja_sigot"), estadoPorDefectoDe("caja_general")].join(" · "),
      estadoPorDefectoDe("banco") === "pagar"
      && estadoPorDefectoDe("caja_sigot") === "programado"
      && estadoPorDefectoDe("caja_ams") === "programado", "A-FEAT-1212")

    /**
     * 🔑 **Y el caso que contesta su pregunta de los francos**: con el sueldo ya pagado, se cargan
     * francos, el bruto sube y el saldo **vuelve a ser positivo** — sin tocar ningún pago.
     */
    const conMasFrancos = saldosDelPeriodo(BRUTO + 128000, 1920000, MONTO_A)
    chequear("Pago repartido", "🔑 Al cargar 2 francos más, el saldo vuelve a mostrar lo que falta",
      "128.000,00", n2(conMasFrancos.saldoTotal),
      conMasFrancos.saldoTotal === 128000, "A-DEC-39")

    chequear("Pago repartido", "…y «saldo A» se acota a lo que queda, no vuelve a ser A entero",
      "128.000,00", n2(conMasFrancos.saldoA),
      conMasFrancos.saldoA === 128000, "A-DEC-39")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🧾 LA CUOTA ALIMENTARIA ES PARTE DE A (A-FEAT-1213). El caso es Sigot → Lucrecia.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /**
     * 🔑 La regla, en palabras del usuario: *«se carga Lucrecia, se carga total A Sigot —Sigot antes
     * de Lucrecia— y eso da el A total. Luego se carga total y eso calcula B»*.
     *
     * El A total de Sigot es 1.408.347,10. Si la cuota fueran 400.000, lo propio es 1.008.347,10.
     */
    const A_TOTAL = 1408347.10
    const CUOTA = 400000
    const ap = componerA(A_TOTAL - CUOTA, CUOTA)

    chequear("Cuota alimentaria", "🧾 A total = A del empleado + la cuota",
      "1.408.347,10", n2(ap.aTotal), ap.aTotal === A_TOTAL, "A-FEAT-1213")

    // 🔑 Lo que prueba que no cambia ningún número: con el A total compuesto, B sigue siendo el mismo.
    const TOTAL = 1600000
    chequear("Cuota alimentaria", "🔑 Y B no se mueve: sigue saliendo del total menos el A total",
      "191.652,90", n2(repartirTotalEnAB(TOTAL, ap.aTotal).b),
      repartirTotalEnAB(TOTAL, ap.aTotal).b === 191652.90, "A-FEAT-1213")

    // El camino inverso: al reabrir el período sólo está guardado el A total y la cuota.
    const reabierto = abrirA(A_TOTAL, CUOTA)
    chequear("Cuota alimentaria", "Al reabrir, lo propio se recupera por la resta",
      "1.008.347,10", n2(reabierto.aPropio),
      reabierto.aPropio === 1008347.10 && reabierto.aTotal === A_TOTAL, "A-FEAT-1213")

    // Sin cuota (el resto de los empleados): A propio ES el A total, y nada cambia.
    const sinCuota = abrirA(1100000, null)
    chequear("Cuota alimentaria", "Sin cuota, A del empleado es el A total (los demás no cambian)",
      "1.100.000,00 y cuota 0,00",
      `${n2(sinCuota.aPropio)} y cuota ${n2(sinCuota.cuotaAlimentaria)}`,
      sinCuota.aPropio === 1100000 && sinCuota.cuotaAlimentaria === 0, "A-FEAT-1213")

    // ⚠️ Y si la cuota se pasó del A total, lo propio da NEGATIVO y se devuelve así, para mostrarlo.
    const inconsistente = abrirA(300000, 500000)
    chequear("Cuota alimentaria", "⚠️ Una cuota mayor que A se muestra (no se corrige en silencio)",
      "-200.000,00", n2(inconsistente.aPropio),
      inconsistente.aPropio === -200000, "A-FEAT-1213")

    /**
     * 🧨 **EL BUG QUE ENCONTRÓ EL USUARIO** (2026-09-30, cargando a Sigot): escribir la cuota
     * **inflaba** A por encima del total y el período **no se guardaba**.
     *
     * Los números reales: A total guardado **1.661.085,80**, total nuevo **1.850.000**. Al abrir, «A
     * del empleado» se precarga con el A total (no había cuota todavía); si al escribir la cuota se
     * compusiera `propio + cuota`, A total pasaría a 1.861.085,80 → B negativo → frenaba.
     */
    const A_GUARDADO = 1661085.80
    const inflaria = componerA(A_GUARDADO, 200000)
    chequear("Cuota alimentaria", "🧨 El bug: componer sobre el A ya cargado lo pasaba del total",
      "A 1.861.085,80 y B negativo",
      `A ${n2(inflaria.aTotal)} y B ${repartirTotalEnAB(1850000, inflaria.aTotal).invalido ? "negativo" : "ok"}`,
      inflaria.aTotal === 1861085.80 && repartirTotalEnAB(1850000, inflaria.aTotal).invalido,
      "A-FEAT-1213")

    // ✅ El arreglo: escribir la cuota MANTIENE el A total y baja lo propio.
    const arreglado = aplicarCuotaManteniendoA(A_GUARDADO, 200000)
    chequear("Cuota alimentaria", "✅ Arreglado: la cuota no infla A, baja lo propio",
      "A total 1.661.085,80 y propio 1.461.085,80",
      `A total ${n2(arreglado.aTotal)} y propio ${n2(arreglado.aPropio)}`,
      arreglado.aTotal === A_GUARDADO && arreglado.aPropio === 1461085.80, "A-FEAT-1213")

    chequear("Cuota alimentaria", "✅ Y con el total de 1.850.000, B ya es positivo y se puede guardar",
      "188.914,20", n2(repartirTotalEnAB(1850000, arreglado.aTotal).b),
      repartirTotalEnAB(1850000, arreglado.aTotal).b === 188914.20
      && !repartirTotalEnAB(1850000, arreglado.aTotal).invalido, "A-FEAT-1213")

    // 🔑 Y la otra dirección sigue como él la describió: editar A del empleado SÍ recompone el total.
    chequear("Cuota alimentaria", "🔑 Editar «A del empleado» sí recompone el A total",
      "1.661.085,80", n2(componerA(1461085.80, 200000).aTotal),
      componerA(1461085.80, 200000).aTotal === A_GUARDADO, "A-FEAT-1213")

    /**
     * 🧮 Y la cadena completa de Sigot, punta a punta, como la carga él:
     * Lucrecia + A propio = A total · total − A total = B · y (A+B) sigue dando el total.
     */
    const cadena = repartirTotalEnAB(TOTAL, componerA(1008347.10, 400000).aTotal)
    chequear("Cuota alimentaria", "🧮 La cadena de Sigot cierra: Lucrecia + A propio + B = total",
      "1.600.000,00", n2(cadena.a + cadena.b),
      r2(cadena.a + cadena.b) === TOTAL && !cadena.invalido, "A-FEAT-1213")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 📗 EL EXPORT DE PAGOS DE SUELDOS (A-FEAT-1217).
  // ══════════════════════════════════════════════════════════════════════════
  {
    const PAGOS = [
      { fecha: "2026-09-30", tipo: "sueldo", empleado: "Ruben Sigot", empresa: "MSA",
        descripcion: "Cuota alimentaria", monto: 200000, estado: "pagar", medio_pago: "banco",
        cuentaDestino: "Lucresia · …4347", periodo: "Sep 2026" },
      { fecha: "2026-09-30", tipo: "sueldo", empleado: "Ruben Sigot", empresa: "MSA",
        descripcion: "Pago saldo", monto: 1650000, estado: "programado", medio_pago: "caja_sigot",
        cuentaDestino: null, periodo: "Sep 2026" },
    ]
    const f = hojaDePagos(PAGOS, "Septiembre 2026")

    // título · aclaración · blanco · cabecera · 2 pagos · TOTAL · blanco · el conteo = 9
    chequear("Export de pagos", "Una fila por pago, más título, aclaración, blanco, cabecera y cierre",
      "2 pagos en 9 filas", `${PAGOS.length} pagos en ${f.length} filas`,
      f.length === 9, "A-FEAT-1217")

    chequear("Export de pagos", "Las columnas son las de la grilla del Cash Flow",
      "Fecha · Período · … · Importe",
      `${(f[3] as string[])[0]} · ${(f[3] as string[])[1]} · … · ${(f[3] as string[])[10]}`,
      (f[3] as string[])[0] === "Fecha" && (f[3] as string[])[10] === "Importe"
      && (f[3] as string[]).length === 11, "A-FEAT-1217")

    // 🧮 El TOTAL es una FÓRMULA, no un número pegado: si se filtra, se recalcula solo.
    const filaTotal = f[6] as unknown[]
    const celda = filaTotal[10] as { f?: string; v?: number }
    chequear("Export de pagos", "🧮 El total va con fórmula y suma los dos pagos",
      "SUM(K5:K6) = 1.850.000,00",
      `${celda?.f} = ${n2(celda?.v ?? 0)}`,
      celda?.f === "SUM(K5:K6)" && celda?.v === 1850000, "A-FEAT-1217")

    chequear("Export de pagos", "Y al pie dice cuántos se exportaron, para cruzarlo con la pantalla",
      "2 pago(s) exportados.", String((f[8] as string[])[0]),
      (f[8] as string[])[0] === "2 pago(s) exportados.", "A-FEAT-1217")

    // Sin pagos: no explota y el total queda en cero.
    const vacio = hojaDePagos([], "Septiembre 2026")
    chequear("Export de pagos", "Sin pagos, el total es 0 y no se rompe",
      "0", String((vacio[4] as unknown[])[10]),
      (vacio[4] as unknown[])[10] === 0, "A-FEAT-1217")

    chequear("Export de pagos", "El nombre del archivo lleva el período y no rompe el sistema de archivos",
      "Pagos_sueldos_Septiembre_2026.xlsx", nombreArchivoPagos("Septiembre 2026"),
      nombreArchivoPagos("Septiembre 2026") === "Pagos_sueldos_Septiembre_2026.xlsx", "A-FEAT-1217")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 📈 EL IPC DEL INDEC (A-FEAT-1215). Los números son los reales de la serie.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /**
     * Recorte real de `apis.datos.gob.ar`, serie 148.3_INIVELNAL_DICI_M_26:
     * `[fecha, nivel, variación mensual, variación interanual]` — las variaciones como FRACCIÓN.
     */
    const CRUDO = [
      ["2026-05-01", 11607.3937, 0.021499723349908573, null],
      ["2026-06-01", 11826.4103, 0.018868714688293764, 0.33547731398508457],
      ["2026-07-01", 12076.3937, 0.021137724267861868, 0.3382568520539679],
      ["2026-08-01", 12276.766, 0.016592064235202875, 0.3354117291414028],
      // 🛑 Sin nivel o sin variación: se descartan. Un IPC en cero es plausible y falso.
      ["2026-09-01", null, 0.02, null],
      ["2026-10-01", 12500, null, null],
      ["basura", 1, 1, 1],
    ]
    const meses = leerIpc(CRUDO)

    chequear("IPC", "🛑 Descarta los meses sin nivel o sin variación, no los rellena con cero",
      "4 meses", `${meses.length} meses`, meses.length === 4, "A-FEAT-1215")

    /**
     * 🔑 **La conversión que evita el desastre**: la API da FRACCIÓN (0,016592) y la app guarda
     * PORCENTAJE. Sin esto, agosto entraría como 0,02 % de inflación mensual.
     */
    const agosto = meses[3]
    chequear("IPC", "🔑 La variación se guarda en PORCENTAJE, no en fracción",
      "1,6592 %", `${agosto.variacionMensual} %`,
      agosto.variacionMensual === 1.6592 && agosto.anio === 2026 && agosto.mes === 8, "A-FEAT-1215")

    chequear("IPC", "La interanual también, y queda null cuando la serie no llega a 12 meses atrás",
      "33,5412 % · mayo null",
      `${agosto.variacionInteranual} % · mayo ${meses[0].variacionInteranual}`,
      agosto.variacionInteranual === 33.5412 && meses[0].variacionInteranual === null, "A-FEAT-1215")

    // 🧮 EL CONTROL DE LOS DOS CAMINOS: el nivel contra la variación publicada.
    chequear("IPC", "🧮 Con los datos reales, el nivel y la variación publicada cierran",
      "0 descuadres", `${controlarIpc(meses).length} descuadres`,
      controlarIpc(meses).length === 0, "A-FEAT-1215")

    // 🧨 Y grita si una de las dos está mal leída: se corrompe un nivel y tiene que saltar.
    const corrupto = meses.map((m, i) => (i === 3 ? { ...m, nivel: 12900 } : m))
    chequear("IPC", "🧨 Si el nivel no explica la variación publicada, lo detecta",
      "1 descuadre en 2026-08",
      `${controlarIpc(corrupto).length} descuadre en ${controlarIpc(corrupto)[0]?.anio}-0${controlarIpc(corrupto)[0]?.mes}`,
      controlarIpc(corrupto).length === 1 && controlarIpc(corrupto)[0].mes === 8, "A-FEAT-1215")

    // 📊 La acumulada sale del nivel de diciembre, y es null si ese diciembre no está.
    chequear("IPC", "📊 Sin el diciembre de referencia, la acumulada es null (no acumula desde cualquier lado)",
      "null", String(acumuladaDelAnio(meses, 2026, 8)),
      acumuladaDelAnio(meses, 2026, 8) === null, "A-FEAT-1215")

    const conDiciembre = [
      { anio: 2025, mes: 12, variacionMensual: 2, variacionInteranual: null, nivel: 10121.2 },
      ...meses,
    ]
    // 12.276,766 / 10.121,2 − 1 = 0,212975…
    chequear("IPC", "📊 Con diciembre, la acumulada de agosto da 21,30 %",
      "21,2975 %", String(acumuladaDelAnio(conDiciembre, 2026, 8)),
      acumuladaDelAnio(conDiciembre, 2026, 8) === 21.2975, "A-FEAT-1215")

    /**
     * 🧨 **La trampa de la ventana**: la primera fila del rango nunca trae variación, así que se pide
     * un mes ANTES. Sin esto, «desde enero» devolvía «desde febrero».
     */
    chequear("IPC", "🧨 La URL pide un mes ANTES del pedido, o se pierde el primero",
      "start_date=2023-12", urlIpc("2024-01").includes("start_date=2023-12") ? "start_date=2023-12" : "otro",
      urlIpc("2024-01").includes("start_date=2023-12") && urlIpc("2024-01").includes("sort=asc"),
      "A-FEAT-1215")

    chequear("IPC", "Y el mes anterior cruza bien el año",
      "2023-12", mesAnteriorISO("2024-01"),
      mesAnteriorISO("2024-01") === "2023-12" && mesAnteriorISO("2026-09") === "2026-08", "A-FEAT-1215")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 👷 LOS SUELDOS EN EL BALANCE (A-FEAT-1216). Los datos son los reales de MSA.
  // ══════════════════════════════════════════════════════════════════════════
  {
    const MESES_EJ = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
                      "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"]

    /**
     * Sigot en junio: A 1.661.085,80 + B 8.914,20 = 1.670.000, con 8,5 francos a 66.800 el franco.
     * Bruto = 1.670.000 + 567.800 = 2.237.800, que es el que tiene guardado el período real.
     */
    const SIGOT: PeriodoDeSueldo = {
      anio: 2026, mes: 6,
      empleado: { nombre: "Ruben Sigot", empresa: "MSA", tipo_empleado: "ab_francos" },
      monto_a: 1661085.80, monto_b: 8914.20, cuota_alimentaria: 200000,
      francos_cantidad: 8.5, valor_franco: 66800,
      bruto_calculado: 2237800, anticipos_descontados: 2237800, saldo_pendiente: 0,
    }
    // Elvio es por día: 16 días a 60.000.
    const ELVIO: PeriodoDeSueldo = {
      anio: 2026, mes: 6,
      empleado: { nombre: "Elvio Paz", empresa: "MSA", tipo_empleado: "por_dia" },
      valor_por_dia: 60000, dias_trabajados: 16, varios: 40000,
      bruto_calculado: 1000000, anticipos_descontados: 0, saldo_pendiente: 1000000,
    }
    // Y uno de OTRO ejercicio, que no tiene que entrar.
    const FUERA: PeriodoDeSueldo = {
      anio: 2026, mes: 9,
      empleado: { nombre: "Ruben Sigot", empresa: "MSA", tipo_empleado: "ab_francos" },
      monto_a: 1661085.80, monto_b: 8914.20, bruto_calculado: 1670000,
    }

    const r = armarSueldosDelEjercicio([SIGOT, ELVIO, FUERA], MESES_EJ)

    chequear("Sueldos en el balance", "Sólo entran los meses del ejercicio",
      "2 filas", `${r.filas.length} filas`, r.filas.length === 2, "A-FEAT-1216")

    // 🔑 Lo que el usuario pidió: el total de A y el total de B.
    chequear("Sueldos en el balance", "🔑 Da el total de A y el total de B",
      "A 1.661.085,80 · B 8.914,20",
      `A ${n2(r.total.montoA)} · B ${n2(r.total.montoB)}`,
      r.total.montoA === 1661085.80 && r.total.montoB === 8914.20, "A-FEAT-1216")

    /**
     * ⚠️ **Y lo que prueba que dos columnas no alcanzan**: A + B da 1.670.000, pero el bruto del
     * ejercicio es 3.237.800 — la diferencia son los francos y el jornal de Elvio.
     */
    chequear("Sueldos en el balance", "⚠️ El bruto NO es A + B: los francos y el jornal son $1.567.800 más",
      "A+B 1.670.000,00 · bruto 3.237.800,00",
      `A+B ${n2(r.total.montoA + r.total.montoB)} · bruto ${n2(r.total.bruto)}`,
      r2(r.total.montoA + r.total.montoB) === 1670000 && r.total.bruto === 3237800, "A-FEAT-1216")

    chequear("Sueldos en el balance", "Abre los francos y el jornal en columnas propias",
      "francos 567.800,00 · jornal 960.000,00",
      `francos ${n2(r.total.porFrancos)} · jornal ${n2(r.total.porJornal)}`,
      r.total.porFrancos === 567800 && r.total.porJornal === 960000, "A-FEAT-1216")

    // 🧾 La cuota se muestra pero NO se suma: está adentro de A.
    chequear("Sueldos en el balance", "🧾 La cuota alimentaria se informa aparte y NO infla el bruto",
      "cuota 200.000,00 y el bruto sigue en 3.237.800,00",
      `cuota ${n2(r.total.cuotaAlimentaria)} y el bruto sigue en ${n2(r.total.bruto)}`,
      r.total.cuotaAlimentaria === 200000 && r.total.bruto === 3237800, "A-FEAT-1216")

    // 🧮 El control del camino inverso: el bruto recompuesto da el guardado.
    chequear("Sueldos en el balance", "🧮 El bruto recompuesto da el guardado en las dos filas",
      "0 descuadres", `${r.descuadres.length} descuadres`,
      r.descuadres.length === 0, "A-FEAT-1216")

    // 🧨 Y grita si alguien toca una parte y no el total.
    const roto = armarSueldosDelEjercicio(
      [{ ...SIGOT, francos_cantidad: 10 }, ELVIO], MESES_EJ)
    chequear("Sueldos en el balance", "🧨 Si una parte no explica el bruto guardado, lo detecta",
      "1 descuadre de 100.200,00",
      `${roto.descuadres.length} descuadre de ${n2(roto.descuadres[0]?.diferencia ?? 0)}`,
      roto.descuadres.length === 1 && roto.descuadres[0].diferencia === 100200, "A-FEAT-1216")

    // 🛑 Los meses sin un solo sueldo se dicen: no se notan mirando el total.
    chequear("Sueldos en el balance", "🛑 Avisa de los meses del ejercicio sin ningún sueldo",
      "11 meses vacíos", `${r.mesesVacios.length} meses vacíos`,
      r.mesesVacios.length === 11 && !r.mesesVacios.includes("2026-06"), "A-FEAT-1216")

    // Y la fórmula por tipo, que es la misma de la pantalla.
    chequear("Sueldos en el balance", "La fórmula respeta el tipo de cada empleado",
      "Sigot 2.237.800,00 · Elvio 1.000.000,00",
      `Sigot ${n2(brutoDesdePartes(SIGOT))} · Elvio ${n2(brutoDesdePartes(ELVIO))}`,
      brutoDesdePartes(SIGOT) === 2237800 && brutoDesdePartes(ELVIO) === 1000000, "A-FEAT-1216")
  }


  // ══════════════════════════════════════════════════════════════════════════
  // 🧾 LAS CUENTAS CORRIENTES DEL BALANCE (A-FEAT-1218). Datos reales de MSA.
  // ══════════════════════════════════════════════════════════════════════════
  {
    /** Compras: una de ARCA (con CUIT) y una del histórico (SIN cuit, sólo el nombre). */
    const COMPRAS = [
      { id: "c1", fecha: "2026-06-27", numero: "0001-00000012", total: 15300000,
        cuit: "20287492546", denominacion: "MARTINEZ PLACIDO ANDRES" },
      // 🧨 El histórico no tiene CUIT: sólo matchea por el alias declarado.
      { id: "c2", fecha: "2025-10-15", numero: "0001-00000008", total: 13540000,
        cuit: null, denominacion: "MARTINEZ PLACIDO ANDRES" },
      { id: "c3", fecha: "2025-09-30", numero: "0001-00000003", total: 19320000,
        cuit: null, denominacion: "MARTINEZ JOSE MARIA" },
      // Una del histórico que no es de nadie de la lista: tiene que quedar sin atribuir.
      { id: "c4", fecha: "2025-08-01", numero: "0001-00000001", total: 500000,
        cuit: null, denominacion: "OTRO PROVEEDOR CUALQUIERA" },
    ]
    const VENTAS = [
      { id: "v1", fecha: "2026-03-10", numero: "0001-00000045", total: 7328488.75, cuit: "30525718626" },
    ]
    /**
     * Movimientos con la marca del usuario. 🔑 El caso que importa: **`CTA JMS` y `CUENTA JMS` son
     * la misma cuenta** — sin el mapa, JMS saldría partido en dos.
     */
    const MOVS = [
      { id: "m1", fecha: "2026-02-27", debitos: 37458124.35, contable: "CTA JMS" },
      { id: "m2", fecha: "2026-04-16", debitos: 2137884.27, contable: "CUENTA JMS" },
      { id: "m3", fecha: "2026-02-04", debitos: 13063089.73, contable: "CTA AMS" },
      { id: "m4", fecha: "2026-02-04", debitos: 37945000, contable: "CTA MA" },
      // 🛑 Y las que el usuario pidió NO tratar todavía.
      { id: "m5", fecha: "2026-02-11", debitos: 5908272.45, contable: "RET 3 PAM" },
      { id: "m6", fecha: "2026-04-21", debitos: 4840704.05, contable: "RET 3 MA" },
      { id: "m7", fecha: "2026-03-10", debitos: 12664999.77, contable: "LIB" },
    ]

    const r = armarCuentasCorrientes(COMPRAS, VENTAS, MOVS, { AMS: 1000000 })
    const de = (k: string) => r.cuentas.find(c => c.contraparte.clave === k)!

    // 🔑 EL CASO QUE MOTIVA EL MAPA: las dos etiquetas de JMS suman en una sola cuenta.
    chequear("Cuentas corrientes", "🔑 «CTA JMS» y «CUENTA JMS» son la MISMA cuenta",
      "pagado 39.596.008,62", n2(de("JMS").resumen.totalPagado),
      de("JMS").resumen.totalPagado === 39596008.62, "A-FEAT-1218")

    // 🧨 Y el histórico entra por alias, porque no tiene CUIT.
    chequear("Cuentas corrientes", "🧨 El histórico matchea por ALIAS: JMS factura $19,32 M sin CUIT",
      "19.320.000,00 · 1 del histórico",
      `${n2(de("JMS").resumen.totalComprado)} · ${de("JMS").desdeHistorico} del histórico`,
      de("JMS").resumen.totalComprado === 19320000 && de("JMS").desdeHistorico === 1, "A-FEAT-1218")

    chequear("Cuentas corrientes", "AMS suma sus DOS facturas: la de ARCA y la del histórico",
      "28.840.000,00", n2(de("AMS").resumen.totalComprado),
      de("AMS").resumen.totalComprado === 28840000 && de("AMS").desdeHistorico === 1, "A-FEAT-1218")

    // 🧮 El saldo al cierre: inicio + lo del ejercicio.
    chequear("Cuentas corrientes", "🧮 El saldo al cierre suma el saldo de inicio",
      "1.000.000 + 15.776.910,27 = 16.776.910,27",
      `${n2(de("AMS").saldoInicio ?? 0)} + ${n2(de("AMS").resumen.saldo)} = ${n2(de("AMS").saldoAlCierre ?? 0)}`,
      de("AMS").saldoAlCierre === 16776910.27, "A-FEAT-1218")

    // 🎚️ Y sin saldo de inicio NO se asume cero: se dice que no se conoce.
    chequear("Cuentas corrientes", "🎚️ Sin saldo de inicio declarado, el cierre queda en null",
      "null", String(de("JMS").saldoAlCierre),
      de("JMS").saldoInicio === null && de("JMS").saldoAlCierre === null, "A-FEAT-1218")

    // 🔑 AFA es la única con las dos puntas: la venta compensa.
    chequear("Cuentas corrientes", "🔑 En AFA la venta COMPENSA y baja el saldo",
      "vendido 7.328.488,75 y saldo -7.328.488,75",
      `vendido ${n2(de("AFA").resumen.totalVendido)} y saldo ${n2(de("AFA").resumen.saldo)}`,
      de("AFA").resumen.totalVendido === 7328488.75 && de("AFA").resumen.saldo === -7328488.75,
      "A-FEAT-1218")

    /**
     * 🛑 **Lo que el usuario pidió NO tratar todavía**: *«debemos ir tratando cada cosa a la vez»*.
     * No se reparte ni se esconde: se lista con su total.
     */
    chequear("Cuentas corrientes", "🛑 RET, RET 3 y LIB quedan SIN TRATAR, con su total a la vista",
      "3 etiquetas · 23.413.976,27",
      `${r.sinTratar.length} etiquetas · ${n2(r.totalSinTratar)}`,
      r.sinTratar.length === 3 && r.totalSinTratar === 23413976.27, "A-FEAT-1218")

    chequear("Cuentas corrientes", "…y «RET 3 MA» NO se mezcla con la cuenta corriente de MA",
      "MA pagó 37.945.000,00",
      n2(de("MA").resumen.totalPagado),
      de("MA").resumen.totalPagado === 37945000, "A-FEAT-1218")

    // Un comprobante del histórico que no es de nadie se informa, no se asigna por las dudas.
    chequear("Cuentas corrientes", "El histórico sin atribuir se cuenta, no se reparte",
      "1", String(r.historicoSinAtribuir),
      r.historicoSinAtribuir === 1, "A-FEAT-1218")

    // 🧨 Y la normalización, que es lo que evita atribuirle la plata de uno a otro.
    chequear("Cuentas corrientes", "🧨 Normaliza acentos y espacios, pero NO confunde nombres",
      "igual · distinto",
      `${normalizar("Suc. de  Plácido Martinez") === normalizar("SUC. DE PLACIDO MARTINEZ") ? "igual" : "distinto"} · `
      + `${normalizar("Mercedes Martinez") === normalizar("Mercedes Areco") ? "igual" : "distinto"}`,
      normalizar("Suc. de  Plácido Martinez") === normalizar("SUC. DE PLACIDO MARTINEZ")
      && normalizar("Mercedes Martinez") !== normalizar("Mercedes Areco"), "A-FEAT-1218")

    chequear("Cuentas corrientes", "La lista tiene las 6 contrapartes y sólo etiquetas CTA",
      "6 · sin RET",
      `${CONTRAPARTES_DEL_BALANCE.length} · ${CONTRAPARTES_DEL_BALANCE.some(c => c.etiquetasContable.some(e => e.includes("RET"))) ? "con RET" : "sin RET"}`,
      CONTRAPARTES_DEL_BALANCE.length === 6
      && !CONTRAPARTES_DEL_BALANCE.some(c => c.etiquetasContable.some(e => e.includes("RET"))),
      "A-FEAT-1218")
  }
  // 🏷️ Un cobro vinculado a su comprobante deja de decir «ANTICIPO COBRO» (pedido del usuario 2026-10-02).
  chequear("Detalle del cobro", "«ANTICIPO COBRO: Adelanto» pasa a «Adelanto»; un detalle propio no se toca; sólo el prefijo queda vacío",
    "Adelanto · Seña Genta · (vacío)", `${detalleSinAnticipo("ANTICIPO COBRO: Adelanto")} · ${detalleSinAnticipo("Seña Genta")} · ${detalleSinAnticipo("ANTICIPO COBRO: ") ?? "(vacío)"}`,
    detalleSinAnticipo("ANTICIPO COBRO: Adelanto") === "Adelanto" && detalleSinAnticipo("Seña Genta") === "Seña Genta" && detalleSinAnticipo("ANTICIPO COBRO: ") === null, "A-FEAT-1228")


  // ══ 🧾 CHEQUES DE TERCEROS EN CARTERA (A-FEAT-1229) — el echeq de Genta ═════════════════════
  chequear("Cheques de terceros", "Recibido = en cartera; endosado con destino = endosado; endosado sin destino = falta decir a quién",
    "en_cartera · endosado · endosado_sin_destino",
    `${estadoCheque({ estado_pago: "en_cartera" })} · ${estadoCheque({ estado_pago: "endosado", endosado_en_id: "p1" })} · ${estadoCheque({ estado_pago: "endosado" })}`,
    estadoCheque({ estado_pago: "en_cartera" }) === "en_cartera" && estadoCheque({ estado_pago: "endosado", endosado_en_id: "p1" }) === "endosado"
      && estadoCheque({ estado_pago: "endosado" }) === "endosado_sin_destino", "A-FEAT-1229")
  chequear("Cheques de terceros", "🔑 El de Genta, cargado «endosado» sin decir a quién, sigue en la cartera para completarlo",
    "true · false", `${chequePendienteDeEndoso({ estado_pago: "endosado" })} · ${chequePendienteDeEndoso({ estado_pago: "endosado", endosado_en_id: "p1" })}`,
    chequePendienteDeEndoso({ estado_pago: "endosado" }) && !chequePendienteDeEndoso({ estado_pago: "endosado", endosado_en_id: "p1" }), "A-FEAT-1229")
  const candEcheq = candidatosEndoso([
    { id: "otro", nombre_proveedor: "BIOFARMA", monto: 4291215.31, fecha_pago: "2026-02-26" },
    { id: "almacen", nombre_proveedor: "Almacen Veterinario SRL", monto: 4466876.20, fecha_pago: "2026-02-26", descripcion: "Echeq Pedro Genta" },
    { id: "lejos", nombre_proveedor: "X", monto: 100, fecha_pago: "2026-01-01" },
  ], { monto: 4466876.20, fecha: "2026-02-25" })
  chequear("Cheques de terceros", "Al endosar, el pago del MISMO importe va primero (Almacén Veterinario, $4.466.876,20)",
    "almacen · mismo importe", `${candEcheq[0].id} · ${candEcheq[0].exacto ? "mismo importe" : "distinto"}`,
    candEcheq[0].id === "almacen" && candEcheq[0].exacto, "A-FEAT-1229")
  chequear("Cheques de terceros", "La búsqueda filtra por proveedor o detalle",
    "almacen", candidatosEndoso([{ id: "a", nombre_proveedor: "BIOFARMA", monto: 1, fecha_pago: null }, { id: "almacen", nombre_proveedor: "Almacen Veterinario", monto: 1, fecha_pago: null }], { monto: 1 }, "almac").map(p => p.id).join(","),
    candidatosEndoso([{ id: "a", nombre_proveedor: "BIOFARMA", monto: 1, fecha_pago: null }, { id: "almacen", nombre_proveedor: "Almacen Veterinario", monto: 1, fecha_pago: null }], { monto: 1 }, "almac").map(p => p.id).join(",") === "almacen", "A-FEAT-1229")


  // ══ 🏦 EL EXTRACTO DE ECHEQS DE TERCEROS (A-FEAT-1230) — el echeq de Genta, con sus cuentas reales ══
  const chGenta = { id: "ch", fecha_pago: "2026-02-25", monto: 4466876.20, descripcion: "Echeq Nº 5-30526554562-0000233143_8360-1 endosado a Almacen Veterinario SRL",
    nombre_proveedor: "PEDRO GENTA Y CIA", estado_pago: "endosado", endosado_en_id: "pago", comprobante_venta_id: "v" }
  const pagosG = new Map([["pago", { id: "pago", fecha_pago: "2026-02-26", nombre_proveedor: "Almacen Veterinario SRL", factura_id: "fc2014" }]])
  const impV = new Map([["v", { categ: "VENTA INVERNADA MACHO Y HEMBRA", nro_cuenta: "410805", centro_costo: "Recria", referencia: "11-75880" }]])
  const impF = new Map([["fc2014", { categ: "INSUMOS VETERINARIOS", nro_cuenta: "42307", centro_costo: null, referencia: "FC 2014" }]])
  const extG = filasExtractoEcheqs([chGenta], pagosG, impV, impF)
  chequear("Extracto de echeqs", "🏦 Un echeq endosado da DOS filas: entra con la cuenta de la venta, sale con la de la factura",
    "VENTA INVERNADA… +4466876.2 · INSUMOS VETERINARIOS −4466876.2",
    extG.map(f => `${f.categ} ${f.creditos ? "+" + f.creditos : "−" + f.debitos}`).join(" · "),
    extG.length === 2 && extG[0].categ === "VENTA INVERNADA MACHO Y HEMBRA" && extG[0].creditos === 4466876.2
      && extG[1].categ === "INSUMOS VETERINARIOS" && extG[1].debitos === 4466876.2 && extG[1].comprobante_arca_id === "fc2014", "A-FEAT-1230")
  chequear("Extracto de echeqs", "El saldo es lo que queda en cartera: después del endoso, 0",
    "4466876.2 → 0", `${extG[0].saldo} → ${extG[1].saldo}`, extG[0].saldo === 4466876.2 && extG[1].saldo === 0, "A-FEAT-1230")
  const enCartera = filasExtractoEcheqs([{ ...chGenta, estado_pago: "en_cartera", endosado_en_id: null }], pagosG, impV, impF)
  chequear("Extracto de echeqs", "Un echeq en cartera da sólo la entrada, y el saldo es el cheque",
    "1 fila · saldo 4466876.2", `${enCartera.length} fila · saldo ${enCartera[0]?.saldo}`, enCartera.length === 1 && enCartera[0].saldo === 4466876.2, "A-FEAT-1230")
  const sinCuenta = filasExtractoEcheqs([chGenta], pagosG, impV, new Map())
  chequear("Extracto de echeqs", "Si la factura no tiene cuenta, la salida queda PENDIENTE para imputarla en el Extracto",
    "pendiente · null", `${sinCuenta[1].estado} · ${sinCuenta[1].categ}`, sinCuenta[1].estado === "pendiente" && sinCuenta[1].categ === null, "A-FEAT-1230")
  chequear("Extracto de echeqs", "Un cheque depositado (ni en cartera ni endosado) no va a esta cuenta",
    "0", String(filasExtractoEcheqs([{ ...chGenta, estado_pago: "conciliado" }], pagosG, impV, impF).length),
    filasExtractoEcheqs([{ ...chGenta, estado_pago: "conciliado" }], pagosG, impV, impF).length === 0, "A-FEAT-1230")

  return r
}
