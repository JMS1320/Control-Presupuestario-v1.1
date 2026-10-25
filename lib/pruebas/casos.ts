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

import { detallePropio as detallePropioCF, detallePropioDeGrupo } from "@/lib/cashflow/detalle-propio"
import { motivosParaPreguntar, puedeVincularseSola } from "@/lib/conciliacion/cruce-empresa"
import { ordenarColumnas, moverColumna, leerColumnasUsuario } from "@/lib/cashflow/columnas-usuario"
import { archivosParaFactura, periodoDeArchivo, subcarpetasDelMes } from "@/lib/facturas/vincular-archivo"
import { agruparPorCarpeta, controlDelLote, idsParaBuscarTrasImportar, candidatosParaBuscar, opcionesFcManual, decidirVinculosCarpeta, listasTrasCarpeta, textoLeido, decisionArchivadaEnOtra, fcAlVincularDesdeCarpeta, candidatosDelLog, agruparInforme, subdiarioDe, subdiariosPresentes, faltaComprobante, linkParaConfirmar, sePuedeConfirmarApp, textoPedidoFacturas, descartadosDelLog, esDescartado, ultimasBusquedas, resumenUltimas } from "@/lib/gas-pdf/lote"
import { ventanasPendientes, bloquesLeidos, partirTramo, decidirDesdeInventario, desdeParaBarrer } from "@/lib/gas-pdf/barrido"
import { armarPedidoProveedor, haceCuanto } from "@/lib/gas-pdf/pedido"
import { colorFc, ESTADOS_FC } from "@/lib/gas-pdf/estados-fc"
import { estadoTildeTodas, seleccionTrasClickTodas } from "@/lib/pagos/tilde-encabezado"
import { pagosParaElBanco } from "@/lib/sueldos/pagos-para-banco"
import { cuentaDeFila } from "@/lib/pagos/cuenta-de-fila"
import { estadoSugeridoParaLote } from "@/lib/pagos/estado-sugerido-lote"
import { cabezasHoy } from "@/lib/productivo/cabezas-hoy"
import { nroDeCuenta } from "@/lib/facturas/nro-de-cuenta"
import { hojaDePendientes } from "@/lib/balance/pendientes-balance"
import { resumirMes, llenarConPresente, llenarCon, diasDelMes, tipoDia, type Marca } from "@/lib/sueldos/asistencia"
import { brutoDelPeriodo, brutoSegunTipo } from "@/lib/sueldos/bruto"
import { textoQueSeCobro, detalleConQueSeCobro } from "@/lib/ventas/que-se-cobro"
import { esperadaDe, emparejar } from "@/lib/pagos/nc-diferencia-cambio"
import { calcularVinculo, pctQueCierra } from "@/lib/productivo/compras-factura"
import { facturasCortas } from "@/lib/pagos/lineas-detalle-pago"
import { NOMBRE_PARA_TERCEROS, empresaDeSchema } from "@/lib/empresas"
import { facturasRestringidas } from "@/lib/auth/roles"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { armarRolNuevo, normalizarIdRol } from "@/lib/auth/crear-rol"
import { nivelesEfectivos, excepcionesParaEditar, permisosAGuardar } from "@/lib/auth/rol-cerrado"
import { RECURSOS as RECURSOS_PERMISABLES } from "@/lib/auth/recursos"
import { borradorDe, alternarRecurso, alternarSeccion, nivelEnBorrador, contarCambios, cuerpoGuardar } from "@/lib/auth/modo-permisos"
import { motivoCuentaBloqueada } from "@/lib/auth/cuentas-extracto"
import { minutosEfectivos, validarMinutos, textoMinutos, valorCookieActividad, msRestantes, sesionVencida, sesionDelToken } from "@/lib/auth/inactividad"
import { caravanasDeHoja, planReposicion, cierraPlan, ajusteDeMarcas, descuadreDestino } from "@/lib/productivo/reposicion"
import {
  adjudicarPorPeso, cabezasDeMedias, rindePorGrupo, factorDeCarga,
  type CabezaNuestra, type CabezaRomaneo,
} from "@/lib/ganaderia/adjudicar-romaneo"
import { añosHastaElProximo } from "@/lib/fechas"
import { impuestosAAvisar, diasDeAviso, type CuotaImpuesto } from "@/lib/impuestos/vencimientos"
import { coincidePorPalabras } from "@/lib/normalizar-texto"
import { fechasDePagoManual } from "@/lib/templates/fechas-pago-manual"
import { camposDePagoManual } from "@/lib/templates/detalle-pago-manual"
import { esBanco, pasaFiltroMedio, marcaPagadoDesde, OPCIONES_PAGADO_DESDE } from "@/lib/pagos/pagado-desde"
import { armarPlanilla, impuestoDeTemplate, ordenarFilas, moverFilaPlanilla, resumenMes, linkTemplates, templatesDelLink, type CuotaPlanilla } from "@/lib/impuestos/planilla"
import { importeDeVenta, cuotasNoFijadas } from "@/lib/arrendamientos/cash-flow"
import { armarPapel, campoDeTemplate, cuentasRedVialDe, hectareasDe, ordenarPapel, moverPartida, clavePartida } from "@/lib/impuestos/papel-inmobiliario"
import { pagosDeResumenes } from "@/lib/conciliacion/pago-tarjeta"
import { filtrarStock } from "@/lib/productivo/filtro-stock"
import { armarLibroComprasArca, controlarArchivo, leerCbte, texto as textoArca, type FilaCompraArca } from "@/lib/subdiarios/libro-iva-arca"
import { evaluarCambioDDJJ, estadoDelPeriodo, mesesEnviadosSinPresentar, estadoDeLosMeses } from "@/lib/subdiarios/estado-ddjj"
import { completarFechaPago } from "@/lib/conciliacion/fecha-pago"
import { etiquetaTipoComprobante, desdeVentana, pasaVentana, coincideNumeroComprobante } from "@/lib/pagos/filtros-cash-flow"
import { armarImpuestoCheque, pctComputable } from "@/lib/balance/impuesto-cheque"
import { resultadosDeVersion, enDolares, gananciaDelEjercicio, parsearMonto, propuestaDelSistema, valoresEfectivos, cambiosContraLoGuardado, deudaDeTarjeta, ivaConSigno, type ValorFoto } from "@/lib/balance/balance-propio"
import { simularSecuencia, retencionDelGrupo, calcularRetencion, baseTrasDescuento, destinoDeNotaDeCredito } from "@/lib/sicore/minimo"
import { quincenasDelMes, mismoPeriodoDelMinimo } from "@/lib/sicore/quincena"
import { deduplicarFilasSicore } from "@/lib/sicore/dedup"
import { parsePendientes, esDelProceso } from "@/lib/pendientes/parse"
import { calcularCuenta, etiquetaComprobante, restosComoMedios } from "@/lib/pagos/cuenta-detalle-pago"
import { agruparPagosPorEmpleado } from "@/lib/sueldos/agrupar-pagos"
import { hayQuePreguntarFechaPago, separarSinImporte } from "@/lib/pagos/preguntar-fecha-pago"
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
import { PRESENTADO_ARCA_COMPRAS, compararConPresentado } from "@/lib/balance/presentado-arca"
import { controlarFacturasFijas, mesesTerminados, explicarFila } from "@/lib/balance/facturas-fijas"
import { armarTemplatesDelEjercicio, desdeCuota } from "@/lib/balance/templates-libro"
import { saldosDelEjercicioAnterior } from "@/lib/balance/ajustes-balance"
import { valuarHacienda } from "@/lib/balance/hacienda-stock"
import { pesosAlCierre, pesoParaValuar } from "@/lib/balance/pesos-hacienda"
import { armarStockInsumos, PAPELES_SIN_ORIGEN, type LineaInsumo } from "@/lib/balance/stock-insumos"
import {
  cuadrarGranos, valuarGranos, armarSementeras, type OrdenAgricola,
} from "@/lib/balance/granos-sementeras"
import {
  armarLibroDiario, detectarChoques, detectarSubdiariosDuplicados, tipoDesdeTexto, desdeArca, desdeHistorico, cargadaAMano,
  type AsientoLibroDiario,
} from "@/lib/balance/libro-diario"
import { mesCompleto, mesActual, mesAnterior } from "@/lib/format/rango-fechas"
import { cobroEsperado, diferenciaContraElBanco } from "@/lib/ventas/cobro-esperado"
import { toggleChip, esSoloEste } from "@/lib/ui/chips"
import { kgNetosDeVenta, promedioKg, categoriaDeVenta, calcularLiqHacienda, retencionSugerida,
  compararConVenta, controlContraPapel, controlPlazos, plazosDesdeVenta, precargaDesdeVenta, cuotasPorCobrar, huellaLiquidacion,
  kgQueSeCobran, ventaParaComparar, importeDeLinea, precioPieDerivado, precioGanchoDerivado, formatoPrecio, montoTipeadoOVacio, montoCalculado, marcarCuota, armarVentaHistorica, repartirEnCuotas, controlCuotas, conciliarCuota } from "@/lib/ventas/hacienda"
import { parseNumeroAR } from "@/lib/format/numero"
import { armarDetalleCobro, imputacionesDeCobro } from "@/lib/ventas/detalle-cobro"
import { armarRetencionesSubdiario, fechaDelCertificado, hojaRetenciones, tablaRetencionesPdf } from "@/lib/ventas/retenciones-export"
import { extractosDelSchema, extractoEsDe, TODOS_LOS_EXTRACTOS } from "@/lib/ventas/extractos-empresa"
import { calcularEcheqs, problemasDelPlan, avisosDelPlan, ultimaFechaCobro, filasEmision, motivoPorDefecto, ENCABEZADO_EMISION, clasificarLoteEcheq, fechaMasDias } from "@/lib/pagos/echeqs-multiples"
import { partirFilasEnEcheqs } from "@/lib/cashflow/echeqs-en-filas"
import { baseDesdeRetencion } from "@/lib/sicore/base-desde-retencion"
import { totalAnticipo } from "@/lib/pagos/total-anticipo"
import { detalleSinAnticipo } from "@/lib/ventas/detalle-cobro-db"
import { estadoCheque, chequePendienteDeEndoso, candidatosEndoso } from "@/lib/ventas/cheques-terceros"
import { filasExtractoEcheqs } from "@/lib/ventas/extracto-echeqs"
import { calcularVinculacionPago, tcDeFactura, aPagarEnPesos, totalEnPesos, conversionDe, textoConversion, esMonedaExtranjera } from "@/lib/pagos/moneda-factura"
import { planCancelacionNC, esNotaCreditoArca, paresCreditoNC, sumarAlDetalle } from "@/lib/pagos/cancelacion-nc"
import { campanaDeFecha, faltantesTemplateNuevo, periodicidadDeEmpresa, esDeOtraEmpresa } from "@/lib/templates/nuevo-desde-conciliacion"
import { templateParaFecha, campanaNuevaPrimero, unoPorFamilia, detalleDeRegla, motivoFaltaCampana, faltaCampanaDelMotivo } from "@/lib/conciliacion/template-de-regla"
import { reglasDelTemplateNuevo, filaDelPlanParaTemplate } from "@/lib/templates/codigos-del-template"
import { coincideCampana, SIN_CAMPANA } from "@/lib/templates/cuotas-del-template"
import { moverRegla, proximoOrden } from "@/lib/conciliacion/orden-reglas"
import { filaNuevaRegla } from "@/lib/conciliacion/fila-regla"
import { esFilaConciliable } from "@/lib/conciliacion/filas-conciliables"
import { conFechaDeEmision, etiquetaResumenTarjeta, comprobanteDeCargoDeTarjeta, anterioresLibres } from "@/lib/conciliacion/pool-tarjeta"
import { parsearPoliza } from "@/lib/polizas/parsear-poliza"
import { armarRenglones } from "@/lib/polizas/renglones-pdf"
import { controlarDebitos, cuotasEsperadas, esDeLaAseguradora, type CuotaEsperada, type MovimientoAseguradora } from "@/lib/polizas/control-debitos"
import { controlarPoliza, cotejarConComprobante, repartoDeLaPoliza, repartoDeLasCuotas, repartirImporte, responsableDe } from "@/lib/polizas/controlar-poliza"
import { unirCodigos } from "@/lib/conciliacion/codigos-usados"
import { motivoFechaNoExacta, ajusteTarjetaPorEmision, elegirPorImporteCercano } from "@/lib/conciliacion/motivo-fecha"
import { pesosDeConsumosUsd, cuotaDeConsumoUsd } from "@/lib/conciliacion/consumos-usd"
import { generarCuotasTemplate, cuotaDelMovimiento, cuotaPendienteDelMes } from "@/lib/templates/cuotas-del-template"
import { elegirDetalleFijo, admiteDetalleFijo } from "@/lib/conciliacion/detalle-fijo"
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
import { esHistorico, estadoCuotaAlDesvincular, contarEstadisticasExtracto } from "@/lib/conciliacion/estado-historico"
import { buscarConDobleAudit, type VinculoEnAuditar } from "@/lib/conciliacion/doble-audit"
import { parsearMovimiento, proponerMapeo, splitMovimiento, auditarSubtipo, resolverFilaExistente, contenidoDeCampo, grupoParaGuardar, grupoSugeridoParaTipo, GRUPOS_GALICIA, claveDedupMovimiento, claveDeTipo, tipoDeMovimiento, tieneReglaPropia, columnasRepetidas, reglasDeLaPropuesta, estaSinParsear, tieneGrupoPrevisto } from "@/lib/extractos/parseo-movimiento"
import {
  lineasDelDetalle, controlarDetalle, sinElProveedor,
} from "@/lib/pagos/lineas-detalle-pago"
import { asientosContablesDelEjercicio, ESTADO_ASIENTO_CONTABLE, CAMBIO_A_ASIENTO_CONTABLE } from "@/lib/balance/asientos-contables"
import { hojaDeAsientosContables, hojaDeTemplates, bloqueDeLecturas } from "@/lib/balance/export-libro-diario"
import { juntarTandas, lecturaIncompleta } from "@/lib/supabase-paginado"
import { evaluarReglaConciliacion } from "@/lib/conciliacion/evaluar-regla"
import * as XLSXcasos from "xlsx"
import { presentarHoja, MONEDA, ENTERO } from "@/lib/balance/formato-excel"
import { armarFilaDato, leerNumero, textoEstadoGuardado } from "@/lib/balance/datos-usuario-puro"
import { coincideBusqueda, veredictoResuelve } from "@/lib/gas-pdf/veredicto"
import { leerFacturaDelTexto, precargaDesdeLectura, cuitValido, parsearImporte } from "@/lib/gas-pdf/leer-factura"
import { controlDeLaCarga, camposDeLaCarga, huellaDeLaCarga, aNegativoSiNC } from "@/lib/facturas/alta-factura"
import { faltantesDelSubdiario } from "@/lib/gas-pdf/faltantes"
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

  /**
   * 🏛️ **Una NOTA DE CRÉDITO dentro del grupo — A-BUG-1251** (Alcorta 13/10/2026).
   * FC 6377 · 6383 · 6389 + NC 820, todas con 5 % de pronto pago. La NC tiene que RESTAR.
   */
  {
    const GRUPO_NC = [1840582.89, 70594.96, 847379.38, -104684.94]
    const pasosNC = simularSecuencia(GRUPO_NC, MIN_BIENES, ALIC_BIENES)
    const retenidoNC = r2(pasosNC.reduce((s, p) => s + p.retencion, 0))
    chequear("SICORE", "🔑 Con una nota de crédito en el grupo, la retención baja: 48.597,45 y no 50.691,15",
      "$48.597,45", `$${n2(retenidoNC)}`, cerca(retenidoNC, 48597.45, 0.01), "A-BUG-1251")

    chequear("SICORE", "Y cierra de atrás para adelante: (neto del grupo − mínimo) × 2 %",
      `$${n2(retencionDelGrupo(GRUPO_NC, MIN_BIENES, ALIC_BIENES))}`, `$${n2(retenidoNC)}`,
      cerca(retenidoNC, retencionDelGrupo(GRUPO_NC, MIN_BIENES, ALIC_BIENES), 0.01), "A-BUG-1251")

    // El paso del descuento: la base de la NC NO se lleva a cero (era el bug).
    chequear("SICORE", "🔑 Al aplicarle el descuento, la base de la nota de crédito sigue siendo negativa",
      "-104684.94", String(baseTrasDescuento(-104684.94, 0, true)),
      baseTrasDescuento(-104684.94, 0, true) === -104684.94, "A-BUG-1251")

    chequear("SICORE", "En una factura común el descuento sigue dando lo de siempre (nunca base negativa)",
      "1616582.89 · 0",
      `${baseTrasDescuento(1840582.89, 224000, false)} · ${baseTrasDescuento(100000, 224000, false)}`,
      baseTrasDescuento(1840582.89, 224000, false) === 1616582.89 && baseTrasDescuento(100000, 224000, false) === 0,
      "A-BUG-1251")

    // De qué factura se descuenta: la del mismo grupo y de mayor retención.
    const vigentes = [
      { id: "otra", retencion: 90000, grupo_pago_id: "otro-grupo" },
      { id: "6377", retencion: 32331.66, grupo_pago_id: "g" },
      { id: "6383", retencion: 1411.90, grupo_pago_id: "g" },
      { id: "6389", retencion: 16947.59, grupo_pago_id: "g" },
    ]
    chequear("SICORE", "Lo que resta la nota de crédito se descuenta de la factura del MISMO grupo con mayor retención",
      "6377", destinoDeNotaDeCredito(vigentes, -2093.70, "g")?.id ?? "null",
      destinoDeNotaDeCredito(vigentes, -2093.70, "g")?.id === "6377", "A-BUG-1251")

    chequear("SICORE", "Si ninguna retención alcanza a absorberla, no se netea (y la pantalla avisa)",
      "null", String(destinoDeNotaDeCredito([{ id: "x", retencion: 500 }], -2093.70, "g")),
      destinoDeNotaDeCredito([{ id: "x", retencion: 500 }], -2093.70, "g") === null, "A-BUG-1251")
  }

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

  // A-BUG-1254: una NOTA DE CRÉDITO del grupo resta de la transferencia. Números reales del pago
  // de ALCORTA del 13/10/2026: el mail anunciaba $3.289.256,72 y la transferencia es $3.162.587,93.
  const G = "grupo-alcorta-1310"
  const ALCORTA_NC = [
    { id: "a", comprobante: "FC 6377", imp_total: 2344321.33, monto_sicore: 30237.96, descuento_aplicado: 117216.06, monto_a_abonar: 2196867.31, origen: "ARCA", grupo_pago_id: G },
    { id: "b", comprobante: "FC 6389", imp_total: 1079293.71, monto_sicore: 16947.59, descuento_aplicado: 53964.68, monto_a_abonar: 1008381.44, origen: "ARCA", grupo_pago_id: G },
    { id: "c", comprobante: "FC 6383", imp_total: 89915.65, monto_sicore: 1411.90, descuento_aplicado: 4495.78, monto_a_abonar: 84007.97, origen: "ARCA", grupo_pago_id: G },
    { id: "d", comprobante: "NC 820", imp_total: -133335.56, monto_sicore: null, descuento_aplicado: -6666.77, monto_a_abonar: -126668.79, origen: "ARCA", grupo_pago_id: G },
  ]
  const mediosNC = restosComoMedios(ALCORTA_NC)
  chequear("Detalle de pago", "🔴 La nota de crédito del grupo RESTA de la transferencia anunciada",
    "1 medio de $3.162.587,93", `${mediosNC.length} medio(s) de $${n2(mediosNC[0]?.monto ?? 0)}`,
    mediosNC.length === 1 && cerca(mediosNC[0].monto, 3162587.93, 0.01), "A-BUG-1254")
  const cNC = calcularCuenta(ALCORTA_NC, mediosNC, "arca")
  chequear("Detalle de pago", "…y con eso la cuenta cierra: $3.380.195,13, sin «pagado de más»",
    "cierra", cNC.desviado ? `no cierra por $${n2(cNC.dif)}` : "cierra",
    !cNC.desviado && cerca(cNC.totalCancelado, 3380195.13, 0.01), "A-BUG-1254")
  chequear("Detalle de pago", "El renglón dice qué cubre: 3 facturas menos 1 nota de crédito",
    "Transferencia (3 facturas, menos 1 nota de crédito)", String(mediosNC[0]?.detalle),
    mediosNC[0]?.detalle === "Transferencia (3 facturas, menos 1 nota de crédito)", "A-BUG-1254")
  const soloNC = restosComoMedios([ALCORTA_NC[3]])
  chequear("Detalle de pago", "Una nota de crédito sola no se anuncia como transferencia",
    "0 medios", `${soloNC.length} medio(s)`, soloNC.length === 0, "A-BUG-1254")

  // A-DEC-1005 / A-FEAT-1269: el Detalle del Cash Flow muestra sólo lo del usuario.
  chequear("Cash Flow — Detalle propio", "🔴 La repetición guardada «FC 406 - PAIS DIEGO LUIS» se ve en blanco; la nota propia se ve",
    "(vacío) · Drenaje Abseso Yegua",
    `${detallePropioCF("FC 406 - PAIS DIEGO LUIS", "PAIS DIEGO LUIS", 406) ?? "(vacío)"} · ${detallePropioCF("Drenaje Abseso Yegua", "PAIS DIEGO LUIS", 406)}`,
    detallePropioCF("FC 406 - PAIS DIEGO LUIS", "PAIS DIEGO LUIS", 406) === null && detallePropioCF("Drenaje Abseso Yegua", "PAIS DIEGO LUIS", 406) === "Drenaje Abseso Yegua"
      && detallePropioCF("   ", "X") === null, "A-DEC-1005")
  const notasGrupo = detallePropioDeGrupo([
    { id: "a", etiqueta: "6377", detalle: "Ecegon IATF" }, { id: "b", etiqueta: "6383", detalle: "" }, { id: "c", etiqueta: "820", detalle: "devolución" },
  ])
  chequear("Cash Flow — Detalle propio", "Un grupo muestra la nota de cada factura que tiene una, con su número",
    "6377: Ecegon IATF | 820: devolución", String(notasGrupo),
    notasGrupo === "6377: Ecegon IATF | 820: devolución" && detallePropioDeGrupo([{ id: "a", etiqueta: "1", detalle: "" }]) === null, "A-FEAT-1269")

  // A-BUG-1256: nada de otra empresa ni de otro CUIT se vincula solo.
  const comisionMA = { origen: "ARCA", empresas: ["MA"], cuit_proveedor: "27114789033" }   // Espada Faraldo (MA), caso real
  chequear("Conciliación — otra empresa / otro CUIT", "🔴 Una factura de MA no se vincula sola a un movimiento de una cuenta de MSA",
    "pregunta", puedeVincularseSola(comisionMA, "MSA", null) ? "se vincula sola" : "pregunta",
    !puedeVincularseSola(comisionMA, "MSA", null) && motivosParaPreguntar(comisionMA, "MSA", null)[0].includes("retiro"), "A-BUG-1256")
  chequear("Conciliación — otra empresa / otro CUIT", "Un TEMPLATE de PAM pagado desde MSA sí se vincula solo (pedido del usuario); con CUIT distinto, no",
    "sola · pregunta",
    `${puedeVincularseSola({ origen: "TEMPLATE", empresas: ["PAM"], cuit_proveedor: null }, "MSA", null) ? "sola" : "pregunta"} · ${puedeVincularseSola({ origen: "TEMPLATE", empresas: ["PAM"], cuit_proveedor: "20044390222" }, "MSA", "30617786016") ? "sola" : "pregunta"}`,
    puedeVincularseSola({ origen: "TEMPLATE", empresas: ["PAM"], cuit_proveedor: null }, "MSA", null)
      && !puedeVincularseSola({ origen: "TEMPLATE", empresas: ["PAM"], cuit_proveedor: "20044390222" }, "MSA", "30617786016"), "A-BUG-1256")
  chequear("Conciliación — otra empresa / otro CUIT", "CUIT del banco distinto al de la factura → pregunta; banco sin CUIT o mismo CUIT → no opina; template MSA/PAM desde MSA → no es de otra",
    "pregunta · sola · sola · sola",
    [puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20-10361911-5" }, "MSA", "30712118179"),
     puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20103619115" }, "MSA", null),
     puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20-10361911-5" }, "MSA", "20103619115"),
     puedeVincularseSola({ empresas: ["MSA", "PAM"], cuit_proveedor: null }, "MSA", null)].map(x => x ? "sola" : "pregunta").join(" · "),
    !puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20-10361911-5" }, "MSA", "30712118179")
      && puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20103619115" }, "MSA", null)
      && puedeVincularseSola({ empresas: ["MSA"], cuit_proveedor: "20-10361911-5" }, "MSA", "20103619115")
      && puedeVincularseSola({ empresas: ["MSA", "PAM"], cuit_proveedor: null }, "MSA", null), "A-BUG-1256")

  // A-FEAT-1277: columnas del Cash Flow en el orden del usuario.
  const COLS = [{ key: "empresas" }, { key: "fecha" }, { key: "detalle" }, { key: "debitos" }]
  const enSuOrden = ordenarColumnas(COLS, ["debitos", "empresas", "ya-no-existe"]).map(c => c.key).join(",")
  chequear("Cash Flow — columnas a mano", "🔴 Respeta el orden guardado, ignora una columna que ya no existe y una NUEVA entra en su lugar de siempre",
    "debitos,fecha,detalle,empresas… (fecha y detalle en su lugar)", enSuOrden,
    enSuOrden === "debitos,fecha,detalle,empresas", "A-FEAT-1277")
  chequear("Cash Flow — columnas a mano", "Mover una columna antes / después de otra",
    "detalle,empresas,fecha · empresas,fecha,detalle",
    `${moverColumna(["empresas", "fecha", "detalle"], "detalle", "empresas", "antes").join(",")} · ${moverColumna(["detalle", "empresas", "fecha"], "detalle", "fecha", "despues").join(",")}`,
    moverColumna(["empresas", "fecha", "detalle"], "detalle", "empresas", "antes").join(",") === "detalle,empresas,fecha"
      && moverColumna(["detalle", "empresas", "fecha"], "detalle", "fecha", "despues").join(",") === "empresas,fecha,detalle", "A-FEAT-1277")
  const leido = leerColumnasUsuario({ orden: ["a", 3], anchos: { a: 9000, b: "x", c: 10 } })
  chequear("Cash Flow — columnas a mano", "Lo guardado se lee sin confiar: anchos fuera de rango se acotan (40–800), lo mal tipado se descarta",
    "orden a · a=800 · c=40", `orden ${leido?.orden.join(",")} · a=${leido?.anchos.a} · c=${leido?.anchos.c} · b=${leido?.anchos.b}`,
    leido?.orden.join(",") === "a" && leido?.anchos.a === 800 && leido?.anchos.c === 40 && leido?.anchos.b === undefined
      && leerColumnasUsuario({ orden: [], anchos: {} }) === null, "A-FEAT-1277")

  // A-FEAT-1276: vincular el PDF desde el Cash Flow — qué carpeta y qué archivo se sugiere.
  const pImputada = periodoDeArchivo({ "año_contable": 2026, mes_contable: 11, fecha_emision: "2026-10-01" })
  const pSinImputar = periodoDeArchivo({ "año_contable": null, mes_contable: null, fecha_emision: "2026-10-01" })
  chequear("Archivo digital — vincular desde Cash Flow", "🔴 Busca en el mes donde está IMPUTADA; si no está imputada, en el de emisión",
    "2026-11 imputada · 2026-10 provisional",
    `${pImputada.anio}-${pImputada.mes} ${pImputada.imputada ? "imputada" : "?"} · ${pSinImputar.anio}-${pSinImputar.mes} ${pSinImputar.imputada ? "?" : "provisional"}`,
    pImputada.anio === 2026 && pImputada.mes === 11 && pImputada.imputada && pSinImputar.mes === 10 && !pSinImputar.imputada, "A-FEAT-1276")
  const ordenados = archivosParaFactura([
    { archivo: "10-05 Otro proveedor.pdf", url: "u1" },
    { archivo: "09-30 Alcorta 6370.pdf", url: "u2" },
    { archivo: "10-01 Alcorta 6377.pdf", url: "u3" },
  ], { denominacion_emisor: "ALCORTA EDMUNDO ERNESTO", fecha_emision: "2026-10-01" })
  chequear("Archivo digital — vincular desde Cash Flow", "⭐ arriba el del proveedor CON la fecha de la factura; el de otro día no se sugiere pero se lista",
    "u3⭐ · u1 · u2", ordenados.map(a => a.url + (a.sugerido ? "⭐" : "")).join(" · "),
    ordenados[0].url === "u3" && ordenados[0].sugerido && ordenados.filter(a => a.sugerido).length === 1 && ordenados.length === 3, "A-FEAT-1276")

  // A-FEAT-1287: el buscador de PDFs mira primero la carpeta (imputada: sólo su subdiario — 2026-10-22; sin imputar: su mes y el siguiente).
  const carpetas = agruparPorCarpeta([
    { id: "dic", "año_contable": null, mes_contable: null, fecha_emision: "2025-12-30" },
    { id: "imp", "año_contable": 2026, mes_contable: 1, fecha_emision: "2025-12-15" },
    { id: "ya", "año_contable": null, mes_contable: null, fecha_emision: "2025-12-01", pdf_drive_url: "https://drive.google.com/x" },
  ])
  const vistaCarpetas = carpetas.map(c => `${c.anio}-${c.mes}:${c.ids.join("+")}`).join(" · ")
  chequear("Buscador de PDFs — carpeta primero", "🔴 La IMPUTADA se busca sólo en la carpeta de su subdiario (usuario 2026-10-22); la sin imputar, en su mes de emisión y el SIGUIENTE (diciembre pasa a enero); la que ya tiene PDF no se busca",
    "2025-12:dic · 2026-1:dic+imp", vistaCarpetas,
    vistaCarpetas === "2025-12:dic · 2026-1:dic+imp", "A-FEAT-1287")
  chequear("Buscador de PDFs — carpeta primero", "La carpeta del mes: MSA por campaña (corta el 1/7), PAM y MA por año",
    "2025-2026/26-06 · 2026-2027/26-07 · 2026/26-07",
    `${subcarpetasDelMes("MSA", 2026, 6).join("/")} · ${subcarpetasDelMes("MSA", 2026, 7).join("/")} · ${subcarpetasDelMes("PAM", 2026, 7).join("/")}`,
    subcarpetasDelMes("MSA", 2026, 6).join("/") === "2025-2026/26-06" && subcarpetasDelMes("MSA", 2026, 7).join("/") === "2026-2027/26-07"
      && subcarpetasDelMes("PAM", 2026, 7).join("/") === "2026/26-07", "A-FEAT-1287")
  const base = { total: 10, procesadas: 10, enCarpeta: 6, encontradas: 1, paraRevisar: 1, noEncontradas: 1, sinFuente: 1, otros: 0, errores: 0 }
  const cOk = controlDelLote(base)
  const cMal = controlDelLote({ ...base, sinFuente: 0 })
  const cCancel = controlDelLote({ ...base, procesadas: 4, enCarpeta: 4, encontradas: 0, paraRevisar: 0, noEncontradas: 0, sinFuente: 0, cancelado: true })
  chequear("Buscador de PDFs — control del lote", "🔴 Cada factura cae en UN casillero: si una no se contó, el control NO cierra (cancelado: cierra contra las procesadas)",
    "cierra · no cierra (9 de 10) · cancelado cierra 4", `${cOk.cierra ? "cierra" : "no"} · ${cMal.cierra ? "cierra" : `no cierra (${cMal.suma} de ${cMal.esperado})`} · cancelado ${cCancel.cierra ? "cierra" : "no"} ${cCancel.esperado}`,
    cOk.cierra && !cMal.cierra && cMal.suma === 9 && cCancel.cierra && cCancel.esperado === 4, "A-FEAT-1287")

  const aBuscar = idsParaBuscarTrasImportar(
    [{ fila: 2, buscar_pdf: true }, { fila: 3, buscar_pdf: false }, { fila: 4, buscar_pdf: true }],
    { 2: "id-a", 3: "id-b" })
  chequear("Buscador de PDFs — desde la importación", "🔴 Se buscan sólo las filas TILDADAS que se crearon (destildada no; la que no se importó no tiene id)",
    "id-a", aBuscar.join(","), aBuscar.join(",") === "id-a" && idsParaBuscarTrasImportar([{ fila: 2, buscar_pdf: true }], undefined).length === 0, "A-FEAT-1287")

  const L = "https://drive.google.com/file/d/x"
  const cands = candidatosParaBuscar([
    { id: "nomail", fc: "NO Mail", estado: "pendiente" },
    { id: "si", fc: "Sí", estado: "pendiente" }, { id: "siclip", fc: "Sí", estado: "pendiente", pdf_drive_url: L },
    { id: "hist", fc: "SI", estado: "historico" },
    { id: "bus", fc: "Buscar", estado: "pendiente" }, { id: "nul", fc: null, estado: "pendiente" },
    { id: "portal", fc: "Portal", estado: "pendiente" }, { id: "no", fc: "No", estado: "pendiente" },
    { id: "ver", fc: "VER", estado: "pendiente" }, { id: "busclip", fc: "Buscar", estado: "pendiente", pdf_drive_url: L },
  ]).map(f => f.id).join(",")
  chequear("Buscador de PDFs — qué ofrece el modal", "🔴 Sólo SIN 📎; nunca Portal, No ni VER; sin el histórico. Arriba (y marcadas) Buscar, sin estado y el «Sí» de Ulises sin 📎; NO Mail se ofrece al final",
    "si,bus,nul,nomail", cands, cands === "si,bus,nul,nomail", "A-FEAT-1287")

  // «Confirmada» sólo con link, y el aviso «sin comprobante» ya no cuenta las «No» (usuario 2026-10-21)
  const faltan = [
    { id: "no", fc: "No", estado: "pendiente" }, { id: "portal", fc: "Portal", estado: "pendiente" },
    { id: "bus", fc: "Buscar", estado: "pendiente" }, { id: "si", fc: "Sí", estado: "pendiente" },
    { id: "ver", fc: "VER", estado: "pendiente" }, { id: "app", fc: "APP", estado: "pendiente", pdf_drive_url: L },
    { id: "hist", fc: "NO", estado: "historico" },
  ].filter(faltaComprobante).map(f => f.id).join(",")
  chequear("Buscador de PDFs — aviso «sin comprobante»", "🔴 Cuenta las que no tienen 📎 (Buscar, Sí de Ulises, VER); NO las «No» (= no corresponde), ni Portal, ni el histórico",
    "bus,si,ver", faltan, faltan === "bus,si,ver", "A-FEAT-1287")
  const links = [L, "  " + L + " ", "https://otro.com/x.pdf", "", null, "drive.google.com/file/d/x"].map(u => linkParaConfirmar(u) ? "ok" : "no").join(",")
  chequear("Buscador de PDFs — Confirmada sólo con link", "🔴 Para dejar una factura Confirmada hace falta un link de Google Drive; sin link (o con otro sitio) no se confirma",
    "ok,ok,no,no,no,no", links, links === "ok,ok,no,no,no,no", "A-FEAT-1287")
  const confApp = [{ fc: "APP", pdf_drive_url: L }, { fc: "APP" }, { fc: "Sí", pdf_drive_url: L }, { fc: "VER", pdf_drive_url: L }]
    .map(f => sePuedeConfirmarApp(f) ? "sí" : "no").join(",")
  chequear("Buscador de PDFs — confirmar una APP", "🔴 Sólo una APP con su 📎 se confirma directo (queda Confirmada con el mismo archivo); el VER va por la lista de candidatos",
    "sí,no,no,no", confApp, confApp === "sí,no,no,no", "A-FEAT-1287")
  const pedido = textoPedidoFacturas([
    { fecha_emision: "2026-09-21", proveedor: "ARPOV", comprobante: "Nota de Crédito A 4-33369", imp_total: -33.88 },
    { fecha_emision: "2026-09-13", proveedor: "JUAREZ MARCELO ALAN", comprobante: "Factura A 2-213", imp_total: 262167.07 },
  ])
  const pedidoOk = "Facturas faltantes\n\n13/09/2026 · JUAREZ MARCELO ALAN · Factura A 2-213 · $ 262.167,07\n21/09/2026 · ARPOV · Nota de Crédito A 4-33369 · $ 33,88"
  chequear("Buscador de PDFs — texto del pedido de facturas", "🔴 Título «Facturas faltantes» y una fila por factura, por fecha: dd/mm/aaaa · proveedor · comprobante · importe en positivo",
    pedidoOk, pedido, pedido === pedidoOk, "A-FEAT-1287")

  // Rigor del vínculo desde la carpeta (usuario 2026-10-20): con dos archivos no se vincula ninguno.
  const H = (factura_id: string, file_id: string, extra: object = {}) => ({ factura_id, file_id, drive_url: `u-${file_id}`, archivo: `${file_id}.pdf`, ...extra })
  const dec = decidirVinculosCarpeta(["uno", "dos", "dud", "comp1", "comp2", "nada", "exdud"], [
    H("uno", "f1"),
    H("dos", "f2"), H("dos", "f3"),
    H("comp1", "f4", { tambien: ["comp2"] }),
    H("exdud", "f6"),
  ], [
    H("dud", "f5", { motivos: ["el archivo es nota de crédito y la factura es factura"] }),
    H("exdud", "f7", { motivos: ["no se encontró la fecha 05/03/2026"] }),
    H("uno", "f1", { motivos: ["no debería contar: es el mismo archivo exacto"] }),
  ])
  const vistaDec = dec.map(d => `${d.factura_id}:${d.accion}${d.accion === "revisar" ? d.candidatos.length : ""}`).join(" ")
  chequear("Buscador de PDFs — dos candidatos en la carpeta", "🔴 Un archivo y exacto → se vincula. Dos (aunque uno sea dudoso) → ninguno, a revisar con los dos. Dudoso solo → a revisar con el motivo. Un archivo que cumple con dos facturas → a revisar en las dos. Sin hallazgo → no aparece (sigue al mail)",
    "uno:vincular dos:revisar2 dud:revisar1 comp1:revisar1 comp2:revisar1 exdud:revisar2", vistaDec,
    vistaDec === "uno:vincular dos:revisar2 dud:revisar1 comp1:revisar1 comp2:revisar1 exdud:revisar2"
      && dec.find(d => d.factura_id === "dud")!.motivo.includes("nota de crédito"), "A-FEAT-1287")

  const fcs = ["Buscar", null, "NO Mail", "Sí", "Confirmada", "Portal", "No"].map(v => fcAlVincularDesdeCarpeta(v)).join(",")
  chequear("Buscador de PDFs — estado al vincular", "🔴 Lo que vincula la app pasa a APP (antes quedaba «Buscar» con 📎); lo que puso una persona se respeta",
    "APP,APP,APP,Sí,Confirmada,Portal,No", fcs, fcs === "APP,APP,APP,Sí,Confirmada,Portal,No", "A-FEAT-1287")

  const logs = [
    { resultado: "revisar", drive_url: "b", lote_id: "L2", observaciones: "[carpeta] dudoso — b.pdf" },
    { resultado: "revisar", drive_url: "a", lote_id: "L2", observaciones: "Uno de 2 candidatos" },
    { resultado: "revisar", drive_url: "a", lote_id: "L2", observaciones: "repetido" },
    { resultado: "no_encontrado", drive_url: null, lote_id: "L2" },
    { resultado: "revisar", drive_url: "viejo", lote_id: "L1", observaciones: "de otra búsqueda" },
  ]
  const cl = candidatosDelLog(logs).map(c => `${c.drive_url}${c.deCarpeta ? "🗂" : ""}`).join(",")
  chequear("Buscador de PDFs — el ✓ de VER ofrece los candidatos", "🔴 Los del ÚLTIMO lote, sin repetir; los de búsquedas viejas no; marca cuál ya estaba en la carpeta",
    "b🗂,a", cl, cl === "b🗂,a", "A-FEAT-1287")

  // «No es ésta» (usuario 2026-10-20): lo descartado no se vuelve a ofrecer, ni por archivo ni por mail
  const logsDesc = [
    { resultado: "descartado", drive_url: "b", lote_id: "L2", gmail_message_id: null },
    { resultado: "descartado", drive_url: "otra-copia", lote_id: "L2", gmail_message_id: "M9" },
    ...logs,
    { resultado: "revisar", drive_url: "c", lote_id: "L2", gmail_message_id: "M9" },
  ]
  const cld = candidatosDelLog(logsDesc).map(c => c.drive_url).join(",")
  const sinCandVer = candidatosDelLog([{ resultado: "descartado", drive_url: "a", lote_id: "L1" }, { resultado: "revisar", drive_url: "a", lote_id: "L1" }]).length
  const desc = descartadosDelLog(logsDesc)
  const vistaDesc = `${cld} | sin candidatos: ${sinCandVer} | mail M9 descartado: ${esDescartado({ drive_url: "nueva", gmail_message_id: "M9" }, desc)} | otro mail: ${esDescartado({ drive_url: "nueva", gmail_message_id: "M1" }, desc)}`
  chequear("Buscador de PDFs — «No es ésta»", "🔴 El archivo descartado no se ofrece más; si el mail se descartó, otra copia del mismo mail tampoco; descartado el único → no quedan candidatos (la factura sale de VER)",
    "a | sin candidatos: 0 | mail M9 descartado: true | otro mail: false", vistaDesc,
    vistaDesc === "a | sin candidatos: 0 | mail M9 descartado: true | otro mail: false", "A-FEAT-1287")

  // Última búsqueda por fuente: carpeta vs. mail, sólo lo que miró algo
  const ult = ultimasBusquedas([
    { factura_id: "f1", fecha_hora: "2026-10-20T14:00:00+00:00", resultado: "no_encontrado", observaciones: "[carpeta] No está en la carpeta" },
    { factura_id: "f1", fecha_hora: "2026-10-19T10:00:00+00:00", resultado: "no_encontrado", observaciones: "No se encontró adjunto" },
    { factura_id: "f1", fecha_hora: "2026-10-21T10:00:00+00:00", resultado: "error", observaciones: "Token inválido" },
    { factura_id: "f1", fecha_hora: "2026-10-21T11:00:00+00:00", resultado: "descartado", observaciones: "No es ésta" },
    { factura_id: "f2", fecha_hora: "2026-10-18T10:00:00+00:00", resultado: "revisar", observaciones: "Posible factura" },
    { factura_id: "f2", fecha_hora: "2026-10-20T09:00:00+00:00", resultado: "descargado", observaciones: "Coinciden" },
  ])
  const res = resumenUltimas(["f1", "f2", "f3"], ult)
  const vistaUlt = `f1 carpeta ${ult.get("f1")?.carpeta?.slice(0, 10)} mail ${ult.get("f1")?.mail?.slice(0, 10)} · f2 mail ${ult.get("f2")?.mail?.slice(0, 10)} · resumen carpeta ${res.carpeta?.slice(0, 10)} (${res.sinCarpeta} nunca) mail ${res.mail?.slice(0, 10)} (${res.sinMail} nunca)`
  const esperadoUlt = "f1 carpeta 2026-10-20 mail 2026-10-19 · f2 mail 2026-10-20 · resumen carpeta 2026-10-20 (2 nunca) mail 2026-10-20 (1 nunca)"
  chequear("Buscador de PDFs — última búsqueda en carpeta y en mail", "🔴 Separa carpeta de mail por el origen; los errores y los descartes no cuentan como búsqueda; cuenta cuántas nunca se buscaron en cada lado",
    esperadoUlt, vistaUlt, vistaUlt === esperadoUlt, "A-FEAT-1287")

  // Inventario de los reenvíos (usuario 2026-10-20): se lee una vez, de hoy hacia atrás, sólo lo que falta
  const tr = (ts: Array<{ desde: string; hasta: string }>) => ts.map(t => `${t.desde.slice(5)}~${t.hasta.slice(5)}`).join(",")
  const vistaVent = [
    tr(ventanasPendientes("2026-10-01", "2026-10-20", [{ desde: "2026-10-10", hasta: "2026-10-14" }], 7)),
    tr(bloquesLeidos([{ desde: "2026-10-06", hasta: "2026-10-09" }, { desde: "2026-10-12", hasta: "2026-10-15" }, { desde: "2026-10-01", hasta: "2026-10-05" }])),
    tr(partirTramo({ desde: "2026-10-01", hasta: "2026-10-08" })),
    desdeParaBarrer([{ fecha_emision: "2026-03-05" }, { fecha_emision: "2026-01-10" }, {}]),
  ].join(" | ")
  const esperadoVent = "10-15~10-20,10-03~10-09,10-01~10-02 | 10-12~10-15,10-01~10-09 | 10-05~10-08,10-01~10-04 | 2026-01-08"
  chequear("Buscador de PDFs — reenvíos: qué días faltan leer", "🔴 De hoy hacia atrás, en ventanas de 7 días, salteando lo ya leído; lo leído se muestra en bloques continuos; desde la emisión más vieja con 2 días de margen",
    esperadoVent, vistaVent, vistaVent === esperadoVent, "A-FEAT-1287")

  const ev = (factura_id: string, hash: string, msg: string, nivel: "exacto" | "dudoso") => ({ inventario_id: `${hash}-${msg}`, hash, gmail_message_id: msg, factura_id, nivel, motivos: nivel === "dudoso" ? ["no se encontró la fecha"] : [] })
  const decInv = decidirDesdeInventario([
    ev("f1", "h1", "m1", "exacto"), ev("f1", "h1", "m2", "exacto"),          // el mismo PDF reenviado dos veces = uno
    ev("f2", "h2", "m3", "exacto"), ev("f2", "h3", "m4", "dudoso"),          // uno exacto + uno dudoso → elige el usuario
    ev("f3", "h4", "m6", "exacto"), ev("f4", "h4", "m6", "exacto"),          // un archivo que sirve a dos facturas → ninguna sola
    ev("f5", "h5", "m5", "dudoso"),                                           // descartado por el usuario («No es ésta»)
  ], new Map([["f5", new Set(["m5"])]]))
  const vistaDecInv = decInv.map(d => `${d.factura_id}:${d.accion}:${d.candidatos.length}`).join(" | ")
  const esperadoDec = "f1:vincular:1 | f2:revisar:2 | f3:revisar:1 | f4:revisar:1"
  // Vincular a medida que se lee la carpeta (usuario 2026-10-21): una factura se decide cuando se leyeron sus DOS carpetas
  const carpetasInc = agruparPorCarpeta([
    { id: "jul", fecha_emision: "2026-07-10" },            // carpetas 26-07 y 26-08
    { id: "ago", fecha_emision: "2026-08-05" },            // carpetas 26-08 y 26-09
    { id: "err", fecha_emision: "2026-07-20" },            // como jul, pero su carpeta falló
  ])
  const vistaInc = carpetasInc.map((_, i) => `${i}:[${listasTrasCarpeta(carpetasInc, i, new Set(["err"])).join(",")}]`).join(" ")
  chequear("Buscador de PDFs — carpeta: se vincula a medida que se lee", "🔴 Terminado julio no se decide nada (falta agosto); terminado agosto, la de julio; terminado septiembre, la de agosto; la de una carpeta que falló, nunca",
    "0:[] 1:[jul] 2:[ago]", vistaInc, vistaInc === "0:[] 1:[jul] 2:[ago]", "A-FEAT-1287")

  // Registro del archivo digital: archivada en OTRA carpeta → a revisar con el aviso, nunca vinculada sola
  // 🔎 Buscador de Subdiarios: sin acentos ni mayúsculas, todas las palabras, números sin separadores
  const buscar = (q: string) => coincideBusqueda(q, ["COLOMAC S.A.", "0013-2220", "1.234.567,50", "PDF: Hernández Fc A"])
  const vistaBuscar = [buscar("colomac"), buscar("hernandez fc"), buscar("132220"), buscar("1234567,50"), buscar("colomac buspack"), buscar(""), coincideBusqueda("00132220", ["0013", "2220"])].join(",")
  chequear("Subdiarios — buscador", "🔴 «colomac» encuentra COLOMAC, «hernandez» a Hernández, un número sin separadores encuentra 0013-2220 y 1.234.567,50; todas las palabras tienen que estar; no inventa números pegando dos textos",
    "true,true,true,true,false,true,false", vistaBuscar, vistaBuscar === "true,true,true,true,false,true,false", "A-FEAT-1287")
  const vistaVer = [veredictoResuelve(null), veredictoResuelve("pendiente"), veredictoResuelve("no_informada")].join(",")
  chequear("Subdiarios — veredicto", "«Pendiente» y sin veredicto siguen abiertos; los demás lo resuelven", "false,false,true", vistaVer, vistaVer === "false,false,true", "A-FEAT-1287")

  // 📒 Asientos Contables: del ejercicio por fecha de emisión, sólo las marcadas, sin subdiario
  {
    const ej = armarEjercicio(2026, 6) // MSA 25/26: 01/07/2025 → 30/06/2026
    const f = (id: string, ddjj: string, fecha: string, total: number) => ({ id, ddjj_iva: ddjj, fecha_emision: fecha, imp_total: total, imp_neto_gravado: total / 1.21, iva: total - total / 1.21, "año_contable": null, mes_contable: null, denominacion_emisor: "COLOMAC" })
    const as = asientosContablesDelEjercicio([
      f("b", ESTADO_ASIENTO_CONTABLE, "2026-03-10", 121), f("a", ESTADO_ASIENTO_CONTABLE, "2025-07-01", 242),
      f("fuera", ESTADO_ASIENTO_CONTABLE, "2026-07-01", 1), f("antes", ESTADO_ASIENTO_CONTABLE, "2025-06-30", 1),
      f("imputada", "Imputado", "2026-03-10", 1), f("sinimputar", "No", "2026-03-10", 1),
    ], ej)
    const vistaAs = `${as.map(a => a.id).join(",")} · ${as[0]?.subdiario} · ${CAMBIO_A_ASIENTO_CONTABLE.mes_contable}`
    // Al mergear con A-FEAT-1295 (2026-10-23): mandar a Asientos Contables pasa por la MISMA regla que cualquier cambio.
    // Una enviada al contador: el contable no puede, el admin sí con advertencia; una sin imputar, libre; y un mes
    // con una en «Asiento contable» no cambia de estado (no es estado de subdiario).
    const aAs = (estados: string[], esAdmin: boolean) => evaluarCambioDDJJ({ estadosAfectados: estados, estadoNuevo: ESTADO_ASIENTO_CONTABLE, esAdmin }).accion
    const vistaRegla = `${aAs(["Enviado"], false)} · ${aAs(["Enviado"], true)} · ${aAs(["No", "Imputado"], false)} · ${estadoDelPeriodo(["Imputado", ESTADO_ASIENTO_CONTABLE])}`
    chequear("Asientos Contables — y lo enviado al contador", "Mandar a Asientos una factura ya Enviada: el contable no puede, el admin con advertencia; lo sin imputar o imputado, libre; «Asiento contable» no cambia el estado del mes",
      "bloquear · advertir · libre · Imputado", vistaRegla, vistaRegla === "bloquear · advertir · libre · Imputado", "A-FEAT-1318")
    chequear("Asientos Contables — del ejercicio", "🔴 Sólo las marcadas «Asiento contable», con fecha entre 01/07/2025 y 30/06/2026 (los bordes adentro), por fecha; dicen «Asientos Contables» en vez de subdiario y se guardan sin mes contable",
      "a,b · Asientos Contables · null", vistaAs, vistaAs === "a,b · Asientos Contables · null", "A-FEAT-1318")
    const hoja = hojaDeAsientosContables(as, "25/26")
    const totalFila = hoja[hoja.length - 1] as unknown[]
    const celdaTotal = totalFila[12] as { v?: number; f?: string } | number
    const valorTotal = typeof celdaTotal === "number" ? celdaTotal : celdaTotal?.v
    const formula = typeof celdaTotal === "number" ? "" : celdaTotal?.f
    const vacia = hojaDeAsientosContables([], "25/26").some(r => String((r as unknown[])[0] ?? "").startsWith("NO HAY"))
    const vistaHoja = `${totalFila[6]} · ${valorTotal} · ${formula} · vacía dice no hay: ${vacia}`
    chequear("Asientos Contables — solapa del balance", "La solapa termina con el TOTAL (fórmula SUMA sobre el detalle, mismo valor que la suma) y vacía dice «NO HAY»",
      "TOTAL · 363 · SUM(M6:M7) · vacía dice no hay: true", vistaHoja, vistaHoja === "TOTAL · 363 · SUM(M6:M7) · vacía dice no hay: true", "A-FEAT-1318")
  }

  // 📄➡️🧾 Cargar una factura desde su PDF (A-FEAT-1318, 2026-10-23). Textos REALES del registro del
  // archivo digital (MSA, marzo 2026), recortados a las líneas que importan.
  {
    const COLOMAC = "COLORMAC S.R.L.\r\nC.U.I.T. Nro.: 30707834834\r\nIns. Brutos: C.M.:901-3070783483-4 (601) Recoleta II\r\nInicio de Actividades: 01/12/2001 IVA Responsable Inscripto\r\nCód. 082 TIQUE FACTURA \"B\"\r\nFecha: 11/03/2026\r\n(40100) Mercedes Areco\r\nD.N.I.: 2066824611\r\nNO 00041-00023206\r\nHora: 15:37:02\r\n1.000/37087.0000\r\n16082 CETOL BELLEZA NATURAL 1 LITR (21.00)\r\n37087.00\r\nTOTAL\r\n66950.36\r\nIVA Contenido\r\n11619.48"
    const HERNANDEZ = "VETERINARIA HERNANDEZ \r\nCUIT:20224765658 \r\nA \r\nFactura \r\nNº 0101-00000109 \r\nIniciodeActividades:01∕12∕2000 Fecha30-03-2617:27:56 \r\nIngresosBrutos:20-22476565-8 \r\nMARTINEZSOBRADOAGRO S.R. \r\n30617786016 \r\n0000-00000000 \r\nSubtotal 295041,33 Impuestos 61958,69 Descuento 0,00 TOTAL 357000,00 \r\nIIBB:0,00-Percep.IVA:0,00-IVA:61958,69-Imp.Internos:0,00 \r\nCAE86139599390860"
    const RIGO_NC = "NOTA DE CRÉDITO   \r\nN° 0004 - 00000401 \r\nFecha: 09/03/2026 \r\nRIGO MATIAS Y RIGO RAUL S.H \r\nA\r\nCOD: 03\r\nC.U.I.T.: 30-71067955-6 \r\nFecha de inicio: 04/2005 \r\n30-61778601-6 \r\nP. NETO BONIF. P. UNIT TOTAL \r\n1,00 descuento 5% por pago transferencia 17.717,38 0,00 % 17.717,38 17.717,38 \r\nSUBTOTAL 17.717,38 IVA 21,0 3.720,65 IVA 10,5 0,00 \r\nTOTAL $21.438,03 \r\nVTO CAE:\r\n19/03/2026"
    const MEDICUS = "SAN MANUEL SRL. \r\nCODIGO N: \r\nA \r\n01 \r\n19/03/2026 \r\nFACTURA \r\nA-0013-00609033   1 1 \r\n(1016) CAPITAL FEDERAL RESPONSABLE INSCRIPTO 30-61778601-6\r\n 830,356.25\r\n10/04/2026 \r\nCUOTA BASICA 790,815.47 PERC IIBB BA CAT.24X 39,540.78 \r\n3054677131401001386128384948117202603296"
    const c = leerFacturaDelTexto(COLOMAC)
    const vC = `${c.cuit} · ${c.tipo} · ${c.puntoVenta}-${c.numero} · ${c.fecha} · ${c.total} · ${c.denominacion} · neto ${c.neto}`
    chequear("Cargar desde el PDF — Colomac", "Tique factura B (foto): CUIT, código 082, número 00041-00023206, la fecha rotulada (no la de inicio de actividades) y el TOTAL; en B no se lee neto",
      "30707834834 · 82 · 41-23206 · 2026-03-11 · 66950.36 · COLORMAC S.R.L. · neto null", vC, vC === "30707834834 · 82 · 41-23206 · 2026-03-11 · 66950.36 · COLORMAC S.R.L. · neto null", "A-FEAT-1318")
    const h = leerFacturaDelTexto(HERNANDEZ)
    const vH = `${h.cuit} · ${h.tipo} · ${h.puntoVenta}-${h.numero} · ${h.fecha} · ${h.total} · ${h.neto} · ${h.iva21} · receptor ${h.receptorCuit}`
    chequear("Cargar desde el PDF — Hernández", "🔴 La fecha pegada a la hora («30-03-2617:27») es 30/03/2026; el IVA sin alícuota se ubica en 21 % por el neto; nuestro CUIT es el receptor, no el emisor",
      "20224765658 · 1 · 101-109 · 2026-03-30 · 357000 · 295041.33 · 61958.69 · receptor 30617786016", vH, vH === "20224765658 · 1 · 101-109 · 2026-03-30 · 357000 · 295041.33 · 61958.69 · receptor 30617786016", "A-FEAT-1318")
    const r = leerFacturaDelTexto(RIGO_NC)
    const m = leerFacturaDelTexto(MEDICUS)
    const vR = `${r.tipo} · ${r.puntoVenta}-${r.numero} · ${r.total} · ${r.neto}+${r.iva21} | ${m.cuit} · ${m.noLeido.join("/")} · ${m.puntoVenta}-${m.numero} · ${m.total}`
    chequear("Cargar desde el PDF — NC y sin CUIT", "Rigo: NC A (COD 03), el TOTAL es el importe y no el «TOTAL» del encabezado de la tabla. Medicus: sólo trae nuestro CUIT → el del proveedor queda sin leer (nunca toma el propio)",
      "3 · 4-401 · 21438.03 · 17717.38+3720.65 | null · CUIT del proveedor · 13-609033 · 830356.25", vR, vR === "3 · 4-401 · 21438.03 · 17717.38+3720.65 | null · CUIT del proveedor · 13-609033 · 830356.25", "A-FEAT-1318")
    const vI = [cuitValido("30707834834"), cuitValido("30707834835"), parsearImporte("1,234.56"), parsearImporte("1.234,56"), parsearImporte("-43,088.28")].join(",")
    chequear("Cargar desde el PDF — CUIT e importes", "El dígito verificador separa un CUIT de un número cualquiera; los importes se leen con coma o punto decimal",
      "true,false,1234.56,1234.56,-43088.28", vI, vI === "true,false,1234.56,1234.56,-43088.28", "A-FEAT-1318")
    // El control de la carga (frena: una factura cuyas partes no suman su total se contradice)
    const base = { neto21: 100, iva21: 21, neto105: 0, iva105: 0, noGravado: 0, exento: 0, otrosTributos: 0, total: 121 }
    const k1 = controlDeLaCarga(base, true), k2 = controlDeLaCarga({ ...base, total: 130 }, true), k3 = controlDeLaCarga({ ...base, total: 66950.36 }, false)
    const camposB = camposDeLaCarga({ ...base, total: 66950.36, cuit: "30707834834", denominacion: "X", tipo: 82, puntoVenta: 41, numero: 23206, fecha: "2026-03-11", cae: null }, false)
    const vK = `${k1.cierra} · ${k2.cierra} ${k2.diferencia} · B ${k3.aplica} ${k3.cierra} · B neto ${camposB.imp_neto_gravado} total ${camposB.imp_total}`
    chequear("Cargar desde el PDF — control", "🔴 A: 100+21 = 121 cierra; con total 130 no (diferencia 9) y no se graba. B/C: sólo el total, como ARCA (neto en 0)",
      "true · false 9 · B false true · B neto 0 total 66950.36", vK, vK === "true · false 9 · B false true · B neto 0 total 66950.36", "A-FEAT-1318")
    // La huella: sólo lo que cambió, con las dos puntas. Y la NC se guarda en negativo.
    const leidoC = precargaDesdeLectura(c)
    const huella = huellaDeLaCarga(leidoC as any, { ...leidoC, total: 69950.36 } as any)
    const nc = aNegativoSiNC({ imp_total: 100, iva: 21, cuit: "x" }, true)
    const split = precargaDesdeLectura({ ...h, neto: 200, iva21: 21, iva105: 10.5 })
    const vU = `${huella.map(x => `${x.campo} ${x.leido}→${x.cargado}`).join(";")} · NC ${nc.imp_total} ${nc.iva} · ${split.neto21}+${split.neto105}`
    chequear("Cargar desde el PDF — huella", "La huella guarda sólo el campo corregido con lo leído y lo cargado; una NC se graba en negativo; con IVA de las dos alícuotas el neto se reparte por el IVA",
      "total 66950.36→69950.36 · NC -100 -21 · 100+100", vU, vU === "total 66950.36→69950.36 · NC -100 -21 · 100+100", "A-FEAT-1318")
  }

  // ❌ Facturas sin PDF del subdiario: pedirlas y buscarlas en el mail desde Subdiarios (A-FEAT-1287 paso 4,
  // usuario 2026-10-23). Son las mismas del chip «❌ faltantes» (sin las de PDF ni las de Portal); las «No» se
  // listan pero no se buscan; el pedido se cuenta en DÍA ARGENTINO (un borrador a las 22:30 del 22 es «hace 1 día» el 23).
  {
    const base = { tipo_comprobante_desc: "Factura B", punto_venta: 41, imp_total: 100, estado: "pendiente" }
    const fs = [
      { ...base, id: "A", denominacion_emisor: "Rigo", numero_desde: 1, pdf_drive_url: "https://drive/x", fc: "Confirmada" },
      { ...base, id: "B", denominacion_emisor: "Telecom", numero_desde: 2, fc: "Portal" },
      { ...base, id: "C", denominacion_emisor: "Colomac", numero_desde: 3, fc: "Buscar", fecha_emision: "2026-03-11" },
      { ...base, id: "D", denominacion_emisor: "Andreani", numero_desde: 4, fc: "No" },
      { ...base, id: "E", denominacion_emisor: "Buspack", numero_desde: 5, fc: null },
    ]
    const ult = new Map([
      ["C", { pedido: "2026-10-20T15:00:00Z" }],
      ["E", { pedido: "2026-10-23T01:30:00Z", pedidoBorrador: true, mail: "2026-10-21T12:00:00Z" }],
    ])
    const r = faltantesDelSubdiario(fs, ult, "2026-10-23")
    const e = r.filas.find(f => f.id === "E"), c = r.filas.find(f => f.id === "C"), d = r.filas.find(f => f.id === "D")
    const vF = `${r.filas.map(f => f.id).join(",")} · pedidas ${r.pedidas.join(",")} · buscables ${r.buscables.join(",")} · E ${e?.pedido?.borrador ? "borrador" : "pedida"} ${e?.pedido?.hace} mail ${e?.ultimoMail} · C ${c?.pedido?.hace} ${c?.comprobante} · D ${d?.buscable}`
    const esperado = "D,E,C · pedidas E,C · buscables E,C · E borrador hace 1 día mail 2026-10-21 · C hace 3 días Factura B 41-3 · D false"
    chequear("Subdiarios — facturas sin PDF", "Lista las del chip «faltantes» (sin PDF ni Portal) ordenadas por proveedor, con el pedido en día argentino y sin buscar las «No»",
      esperado, vF, vF === esperado, "A-FEAT-1287")
  }

  const decOtra = decisionArchivadaEnOtra("f1", [
    { factura_id: "f1", drive_url: "u-dud", archivo: "02-03 - X.pdf", carpeta: "2025-2026/26-02", nivel: "dudoso", motivos: ["no se encontró la fecha 05/03/2026"] },
    { factura_id: "f1", drive_url: "u-ex", archivo: "02-05 - X.pdf", carpeta: "2025-2026/26-02", nivel: "exacto" },
    { factura_id: "f2", drive_url: "u-otra", archivo: "y.pdf", carpeta: "2025-2026/26-01", nivel: "exacto" },
  ])
  const vistaOtra = `${decOtra?.accion} · ${decOtra?.candidatos.map(c => c.drive_url).join(",")} · ${decOtra?.motivo.includes("2025-2026/26-02") ? "dice la carpeta" : "NO dice la carpeta"} · sin hallazgo: ${decisionArchivadaEnOtra("f3", [])}`
  chequear("Buscador de PDFs — archivada en otra carpeta", "🔴 Queda A REVISAR (nunca se vincula sola: la imputación manda), el exacto primero, sólo los de esa factura, y dice en qué carpeta está",
    "revisar · u-ex,u-dud · dice la carpeta · sin hallazgo: null", vistaOtra, vistaOtra === "revisar · u-ex,u-dud · dice la carpeta · sin hallazgo: null", "A-FEAT-1287")

  // A revisar: lo que dice el archivo al lado de ARCA (usuario 2026-10-21: «sólo veo el número de factura»)
  const vistaLeido = [
    textoLeido({ tipo: "factura", monto: -1234.5, fechas: ["04/03/2026", "30/03/2026"] }),
    textoLeido({ tipo: null, monto: null, fechas: [] }),
    textoLeido(undefined),
  ].join(" | ")
  const esperadoLeido = "El archivo dice: factura · $ 1.234,50 · fechas 04/03/2026, 30/03/2026 | El archivo dice: tipo no leído · importe no leído · sin fechas legibles | "
  chequear("Buscador de PDFs — a revisar: qué dice el archivo", "🔴 Tipo, importe (positivo) y las fechas que SÍ tiene el archivo; lo que no se leyó lo dice",
    esperadoLeido, vistaLeido, vistaLeido === esperadoLeido, "A-FEAT-1287")

  // 📮 Pedir la factura al proveedor (A-FEAT-1313, texto acordado 2026-10-21)
  const p1 = armarPedidoProveedor("MSA", [{ fecha_emision: "2026-07-15", comprobante: "Factura A 2-484", imp_total: 1234567.89 }])
  const p2 = armarPedidoProveedor("MSA", [
    { fecha_emision: "2026-08-01", comprobante: "Nota de Crédito A 9-63", imp_total: -5000 },
    { fecha_emision: "2026-07-15", comprobante: "Factura A 2-484", imp_total: 1234567.89 },
  ])
  const pPam = armarPedidoProveedor("PAM", [{ fecha_emision: "2026-07-15", comprobante: "Factura A 2-484", imp_total: 100 }])
  const ultPed = ultimasBusquedas([
    { factura_id: "f1", fecha_hora: "2026-10-10T15:00:00+00:00", resultado: "pedido", observaciones: "[pedido] Borrador del pedido al proveedor" },
    { factura_id: "f1", fecha_hora: "2026-10-12T15:00:00+00:00", resultado: "pedido", observaciones: "[pedido] Pedida al proveedor por mail" },
    { factura_id: "f1", fecha_hora: "2026-10-01T15:00:00+00:00", resultado: "no_encontrado", observaciones: "No se encontró" },
  ]).get("f1")
  const vistaPed = [
    p1.asunto,
    p1.texto.includes("no recibimos la factura:") && p1.texto.includes("(CUIT 30-61778601-6)") && p1.texto.includes("– 15/07/2026 · Factura A 2-484 · $ 1.234.567,89") && p1.texto.includes("¿Nos la podrían mandar") && p1.texto.endsWith("Muchas gracias.\n\nJose Martinez Sobrado\nMartinez Sobrado Agro SRL"),
    p2.asunto,
    p2.texto.includes("no recibimos las facturas:") && p2.texto.indexOf("2-484") < p2.texto.indexOf("9-63") && p2.texto.includes("$ 5.000,00"),
    pPam.texto.endsWith("Muchas gracias.\n\nJose Martinez Sobrado") && pPam.texto.includes("Les escribimos de Sucesión de Plácido Alberto Martínez"),
    `${ultPed?.pedido?.slice(0, 10)} ${ultPed?.pedidoBorrador ? "borrador" : "enviado"} · mail ${ultPed?.mail?.slice(0, 10)}`,
    [haceCuanto("2026-10-21", "2026-10-21"), haceCuanto("2026-10-20", "2026-10-21"), haceCuanto("2026-10-14", "2026-10-21")].join(" / "),
  ].join(" | ")
  const esperadoPed = "Pedido de factura — Martinez Sobrado Agro SRL | true | Pedido de facturas — Martinez Sobrado Agro SRL | true | true | 2026-10-12 enviado · mail 2026-10-01 | hoy / hace 1 día / hace 7 días"
  chequear("Buscador de PDFs — pedir la factura al proveedor", "🔴 «no recibimos la factura» (singular/plural), con nuestro CUIT, ordenado por fecha, importe en positivo; el último pedido se ve con su fecha y si quedó en borrador; el pedido no cuenta como búsqueda",
    esperadoPed, vistaPed, vistaPed === esperadoPed, "A-FEAT-1313")

  chequear("Buscador de PDFs — reenvíos: cuándo se vincula", "🔴 La misma regla que la carpeta: vincula sólo con UN archivo exacto y sin dudosos; el mismo PDF reenviado no cuenta doble; si sirve a dos facturas, elige el usuario; lo descartado no vuelve",
    esperadoDec, vistaDecInv, vistaDecInv === esperadoDec, "A-FEAT-1287")

  const inf = agruparInforme([
    { factura_id: "1", factura: "FC 1", proveedor: "p", proceso: "no_encontrada", links: [] },
    { factura_id: "2", factura: "FC 2", proveedor: "p", proceso: "carpeta", links: [{ url: "u", rotulo: "PDF" }] },
    { factura_id: "3", factura: "FC 3", proveedor: "p", proceso: "revisar", links: [] },
  ]).map(g => `${g.clave}:${g.items.length}`).join(" ")
  chequear("Buscador de PDFs — el informe del lote", "Agrupado por proceso, en orden: carpeta → mail → a revisar → no encontradas…; sin grupos vacíos",
    "carpeta:1 revisar:1 no_encontrada:1", inf, inf === "carpeta:1 revisar:1 no_encontrada:1", "A-FEAT-1287")

  const subs = subdiariosPresentes([
    { "año_contable": 2026, mes_contable: 9 }, { "año_contable": null, mes_contable: null },
    { "año_contable": 2026, mes_contable: 10 }, { "año_contable": 2026, mes_contable: 9 },
  ]).map(x => `${x.rotulo}(${x.cantidad})`).join(" · ")
  chequear("Buscador de PDFs — columna y selector de subdiario", "Cada factura muestra dónde está imputada; el selector lista los subdiarios del más nuevo al más viejo y «sin imputar» al final",
    "Oct 2026(1) · Sep 2026(2) · sin imputar(1)", subs,
    subs === "Oct 2026(1) · Sep 2026(2) · sin imputar(1)" && subdiarioDe({ "año_contable": 2026, mes_contable: 13 }).clave === "sin", "A-FEAT-1287")

  const sinColor = ["Buscar", "APP", "VER", "Confirmada", "Sí", "NO Mail", "Portal", "No"].filter(v => colorFc(v) === colorFc("inventado"))
  chequear("Estados FC — el glosario", "Cada estado acordado tiene significado, quién lo pone y color (Confirmada distinto de Sí)",
    "todos con color · Confirmada ≠ Sí", `${sinColor.length ? "sin color: " + sinColor.join(",") : "todos con color"} · ${colorFc("Confirmada") !== colorFc("Sí") ? "Confirmada ≠ Sí" : "iguales"}`,
    sinColor.length === 0 && colorFc("Confirmada") !== colorFc("Sí") && ESTADOS_FC.every(e => e.significado && e.quien), "A-FEAT-1287")

  const opsUlises = opcionesFcManual(null, false).map(o => o.valor).join(",")
  const opsAdmin = opcionesFcManual(null, true).map(o => o.valor).join(",")
  const opsApp = opcionesFcManual("APP", false).map(o => o.valor).join(",")
  chequear("Estado FC a mano — quién puede poner «No»", "🔴 Ulises no ve «No» (su «no la tengo» es Buscar); el admin sí; un estado automático (APP) se conserva",
    "Buscar,Sí,Portal · +No · APP primero", `${opsUlises} · ${opsAdmin} · ${opsApp}`,
    opsUlises === "Buscar,Sí,Portal" && opsAdmin === "Buscar,Sí,Portal,No" && opsApp === "APP,Buscar,Sí,Portal", "A-FEAT-1287")

  // A-FEAT-1268: el tilde del encabezado de PAGOS cuenta contra lo que SE VE.
  const VIS = ["a", "b", "c"]
  chequear("PAGOS — tildar todo lo filtrado", "Tres estados: ninguna / algunas / todas (una tildada que no se ve no cuenta)",
    "ninguna · algunas · todas",
    `${estadoTildeTodas(VIS, new Set(["fuera"]))} · ${estadoTildeTodas(VIS, new Set(["a"]))} · ${estadoTildeTodas(VIS, new Set(["a", "b", "c", "fuera"]))}`,
    estadoTildeTodas(VIS, new Set(["fuera"])) === "ninguna" && estadoTildeTodas(VIS, new Set(["a"])) === "algunas"
      && estadoTildeTodas(VIS, new Set(["a", "b", "c", "fuera"])) === "todas", "A-FEAT-1268")
  const trasClick = seleccionTrasClickTodas(VIS, new Set(["a", "fuera"]))
  chequear("PAGOS — tildar todo lo filtrado", "🔴 Click con algunas: tilda SÓLO las que se ven (suelta la que no se ve); con todas: suelta todo",
    "a,b,c · 0", `${[...trasClick].sort().join(",")} · ${seleccionTrasClickTodas(VIS, new Set(VIS)).size}`,
    [...trasClick].sort().join(",") === "a,b,c" && seleccionTrasClickTodas(VIS, new Set(VIS)).size === 0, "A-FEAT-1268")

  // A-FEAT-1273: el archivo del banco desde Sueldos lleva SÓLO los pagos tildados y pagados por banco.
  const PAGOS_MES = [
    { id: "p1", medio_pago: "banco" }, { id: "p2", medio_pago: null },
    { id: "p3", medio_pago: "caja_general" }, { id: "p4", medio_pago: "banco" },
  ]
  const selBanco = pagosParaElBanco(PAGOS_MES, new Set(["p1", "p2", "p3", "no-esta-en-el-mes"]))
  chequear("Sueldos — archivo del banco", "🔴 Al banco van sólo los tildados (no el mes entero) y sin los pagados por caja",
    "p1,p2 · 1 por caja", `${selBanco.ids.join(",")} · ${selBanco.fueraPorCaja} por caja`,
    selBanco.ids.join(",") === "p1,p2" && selBanco.fueraPorCaja === 1, "A-FEAT-1273")
  chequear("Sueldos — archivo del banco", "Sin nada tildado no va ningún pago",
    "0", String(pagosParaElBanco(PAGOS_MES, new Set()).ids.length),
    pagosParaElBanco(PAGOS_MES, new Set()).ids.length === 0, "A-FEAT-1273")

  // A-BUG-1255: ARCA trae la moneda de una factura en pesos como «$». No es moneda extranjera.
  const convPesos = textoConversion([{ comprobante: "FC 2077", conversion: conversionDe({ moneda: "$", imp_total: 1537055, tipo_cambio: 1 }) }])
  chequear("Detalle de pago", "🔴 Una factura en pesos (moneda «$») NO lleva el renglón de conversión",
    "0 renglones", `${convPesos.length} renglón(es)`,
    convPesos.length === 0 && !esMonedaExtranjera("$") && !esMonedaExtranjera("PES") && !esMonedaExtranjera(null), "A-BUG-1255")
  chequear("Detalle de pago", "…y una en dólares lo sigue llevando",
    "extranjera", esMonedaExtranjera("USD") ? "extranjera" : "pesos", esMonedaExtranjera("USD") && esMonedaExtranjera("DOL"), "A-BUG-1255")

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

  // ── ⚖️ Dos lados (A-FEAT-1301): conciliado el movimiento, conciliado lo atado ─────────────────
  // 🧨 La tarjeta: 21 facturas en «crédito»/«anterior» con el movimiento conciliado por el «✓ OK».
  {
    const dl = [
      movAud("dl1", { comprobante_arca_id: "f1" }),   // factura en crédito → hallazgo
      movAud("dl2", { comprobante_arca_id: "f2" }),   // factura en anterior → hallazgo (caso tarjeta)
      movAud("dl3", { template_cuota_id: "c1" }),     // cuota en anterior (histórico) → NO
      movAud("dl4", { template_cuota_id: "c2" }),     // cuota pendiente → hallazgo
      movAud("dl5", { comprobante_arca_id: "f3" }),   // factura conciliada → NO
    ]
    const estados = new Map([["dl1", { factura: "credito" }], ["dl2", { factura: "anterior" }],
      ["dl3", { cuota: "anterior" }], ["dl4", { cuota: "pendiente" }], ["dl5", { factura: "conciliado" }]])
    const r = auditar({ movimientos: dl, categsDelPlan: PLAN, estadoOrigen: estados })
    const g = r.grupos.find(x => x.control === "origen-sin-conciliar")
    const ids = (g?.causas.flatMap(c => c.ejemplos.map(e => e.movimientoId)) ?? []).sort().join(" ")
    chequear("Audit", "⚖️ Conciliado de un solo lado: la factura en crédito o anterior y la cuota pendiente; la cuota «anterior» del histórico no",
      "dl1 dl2 dl4", ids, ids === "dl1 dl2 dl4", "A-FEAT-1301")
    const sinDato = auditar({ movimientos: dl, categsDelPlan: PLAN })
    chequear("Audit", "Sin el estado de los orígenes, el control dos lados se informa NO verificado (no se da por bueno)",
      "aparece en no verificado", sinDato.noVerificado.some(s => s.startsWith("Dos lados")) ? "aparece en no verificado" : "no aparece",
      sinDato.noVerificado.some(s => s.startsWith("Dos lados")), "A-FEAT-1301")
  }

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

  // ══ 🐄 A-FEAT-1251 — confirmar la reposición desde un Excel ══════════════════════════════════
  {
    const H = (id: string, of: string | null, int: string | null, rep: boolean) => ({ id, caravana_oficial: of, caravana_interna: int, es_rep: rep })
    const hembras = [
      H("a", "032 010012326428", "187", true),   // en la planilla y ya rep
      H("b", "032 010012326429", "307", false),  // en la planilla, falta marcarla
      H("c", "032 010012326431", "180", true),   // rep y NO está en la planilla → se le quita
      H("d", "032 010012326433", "300", false),  // ni rep ni en la planilla → no se toca
      H("e", "032 010012399428", "216", true),   // termina igual que «a» si se escribe la cola corta
    ]
    // Planilla real-ish: encabezado, oficial sin el cero (Excel se lo comió), interna, una que no existe, una repetida.
    const hoja: unknown[][] = [
      ["Nro", "Caravana", "Peso"],
      [1, "32010012326428", 250],
      [2, "307", 240],
      [3, "032 010012399428", 260],
      [4, "032 010099999999", 230],
      [5, "187", 250],
    ]
    const { caravanas } = caravanasDeHoja(hoja)
    chequear("Reposición desde Excel", "🐄 Lee sólo la columna «Caravana» (no confunde el peso con una caravana interna)",
      "5", String(caravanas.length), caravanas.length === 5 && !caravanas.includes("250"), "A-FEAT-1251")
    const plan = planReposicion(caravanas, hembras)
    chequear("Reposición desde Excel", "🐄 Marca la que falta, quita la que sobra y avisa la que no existe",
      "marcar b · quitar c · no encontrada 1 · repetida 1",
      `marcar ${plan.marcar.map(h => h.id)} · quitar ${plan.desmarcar.map(h => h.id)} · no encontrada ${plan.noEncontradas.length} · repetida ${plan.repetidas.length}`,
      plan.marcar.map(h => h.id).join() === "b" && plan.desmarcar.map(h => h.id).join() === "c"
        && plan.noEncontradas.length === 1 && plan.repetidas.length === 1 && plan.yaBien.length === 2, "A-FEAT-1251")
    chequear("Reposición desde Excel", "🧮 El plan cierra contra lo leído", "true", String(cierraPlan(plan, caravanas.length)),
      cierraPlan(plan, caravanas.length), "A-FEAT-1251")
    // Una cola que coincide con dos caravanas NO se adivina: queda ambigua y no desmarca a ninguna.
    const amb = planReposicion(["326428"], [H("x", "032 010012326428", null, true), H("y", "032 020012326428", null, true)])
    chequear("Reposición desde Excel", "⚠️ Una caravana que coincide con dos animales no se adivina ni desmarca a nadie",
      "ambigua 1 · quitar 0", `ambigua ${amb.ambiguas.length} · quitar ${amb.desmarcar.length}`,
      amb.ambiguas.length === 1 && amb.desmarcar.length === 0, "A-FEAT-1251")
    // Una caravana de la planilla de hembras que en el sistema es MACHO: se avisa, no se marca, y el plan cierra.
    const conMacho = planReposicion(["032 010012326428", "032 010055555555"], hembras, [H("m", "032 010055555555", "900", false)])
    chequear("Reposición desde Excel", "🚹 Una caravana de la planilla que en el sistema es MACHO se avisa y no se marca",
      "machos 1 · no encontradas 0 · cierra", `machos ${conMacho.sonMachos.length} · no encontradas ${conMacho.noEncontradas.length} · ${cierraPlan(conMacho, 2) ? 'cierra' : 'no cierra'}`,
      conMacho.sonMachos.length === 1 && conMacho.sonMachos[0].animal.id === "m" && conMacho.noEncontradas.length === 0
        && !conMacho.marcar.some(h => h.id === "m") && cierraPlan(conMacho, 2), "A-FEAT-1251")
    // La planilla del lector trae «IDV» (sin el cero): también se lee y cruza.
    const lector = caravanasDeHoja([["Fecha", "IDV", "Peso"], ["01/10/2026", "32010012326429", 240]])
    chequear("Reposición desde Excel", "📟 Una columna «IDV» del lector también se lee y cruza con la oficial",
      "b", planReposicion(lector.caravanas, hembras).marcar.map(h => h.id).join(),
      planReposicion(lector.caravanas, hembras).marcar.map(h => h.id).join() === "b", "A-FEAT-1251")
    // La hembra SIN IDENTIFICAR: 73 tildadas + 1 sin identificar → destino con 74 cabezas y 1 a identificar;
    // después «sólo identificar» la que resultó ser: el stock no se mueve y el descuadre vuelve a 0.
    const paso1 = descuadreDestino({ cabezasHoy: 0, identificadasHoy: 0, tildadas: 73, sinIdentificar: 1, soloIdentificar: false })
    const paso2 = descuadreDestino({ cabezasHoy: 74, identificadasHoy: 73, tildadas: 1, sinIdentificar: 0, soloIdentificar: true })
    chequear("Reposición desde Excel", "🐄 73 + 1 sin identificar mueve 74 y deja 1 a identificar; completarla por diferencia lo cierra",
      "74/73 dif 1 → 74/74 dif 0", `${paso1.cabezas}/${paso1.identificadas} dif ${paso1.dif} → ${paso2.cabezas}/${paso2.identificadas} dif ${paso2.dif}`,
      paso1.cabezas === 74 && paso1.dif === 1 && paso2.cabezas === 74 && paso2.dif === 0, "A-FEAT-1251")
    // Pieza 2: lo tildado a mano en el cambio de categoría se vuelve la marca rep.
    const aj = ajusteDeMarcas([{ id: "a", es_rep: true }, { id: "b", es_rep: false }, { id: "c", es_rep: true }], new Set(["a", "b"]))
    chequear("Reposición desde Excel", "🔁 Cambio de categoría: la selección final pasa a la planilla de recría",
      "+b −c", `+${aj.marcar.join()} −${aj.desmarcar.join()}`, aj.marcar.join() === "b" && aj.desmarcar.join() === "c", "A-FEAT-1251")
  }

  // ══ 💵 A-BUG-1245 — factura en DÓLARES: lote de Galicia y detalle de pago en PESOS (Agro Centros, 2026-10-05) ══
  {
    const agro = { moneda: "USD", tc_pago: 1520, tipo_cambio: 1522, imp_total: 4635.54, monto_a_abonar: 4561.87, monto_sicore: 111983.01, descuento_aplicado: null }
    chequear("Pago en dólares", "💵 Lo que se transfiere sale en pesos y exacto: 4.635,54 × 1.520 − 111.983,01 (no los USD 4.561,87 como pesos)",
      "6934037.79", aPagarEnPesos(agro).toFixed(2), aPagarEnPesos(agro).toFixed(2) === "6934037.79", "A-BUG-1245")
    chequear("Pago en dólares", "💵 El total de la factura en pesos usa el TC del PAGO (1.520), no el de la factura (1.522)",
      "7046020.80", totalEnPesos(agro).toFixed(2), totalEnPesos(agro).toFixed(2) === "7046020.80", "A-BUG-1245")
    chequear("Pago en dólares", "🧮 En pesos cierra: total − retención = transferencia",
      "0.00", (totalEnPesos(agro) - 111983.01 - aPagarEnPesos(agro)).toFixed(2),
      Math.abs(totalEnPesos(agro) - 111983.01 - aPagarEnPesos(agro)) < 0.005, "A-BUG-1245")
    // Con un pago a cuenta que bajó el saldo, manda el saldo guardado (no la cuenta desde el total).
    const parcial = { ...agro, monto_a_abonar: 2000 }
    chequear("Pago en dólares", "Si un pago a cuenta bajó el saldo, se transfiere el saldo × TC",
      "3040000.00", aPagarEnPesos(parcial).toFixed(2), aPagarEnPesos(parcial).toFixed(2) === "3040000.00", "A-BUG-1245")
    chequear("Pago en dólares", "Una factura en pesos no cambia", "1000",
      String(aPagarEnPesos({ moneda: "PES", imp_total: 1200, monto_a_abonar: 1000 })), aPagarEnPesos({ moneda: "PES", imp_total: 1200, monto_a_abonar: 1000 }) === 1000, "A-BUG-1245")
    const linea = textoConversion([{ comprobante: "FC 6447", conversion: conversionDe(agro) }])[0] ?? ""
    chequear("Pago en dólares", "📄 El detalle (PDF y mail) dice moneda, TC del pago y resultado en pesos",
      "FC 6447 en USD 4.635,54 · TC del pago 1.520,00 = $7.046.020,80", linea,
      linea === "FC 6447 en USD 4.635,54 · TC del pago 1.520,00 = $7.046.020,80", "A-BUG-1245")
    // El PDF usa la fuente WinAnsi: un carácter fuera de latin-1 (como «→» o «⚠») rompe la línea entera.
    chequear("Pago en dólares", "📄 El texto de la conversión es todo latin-1 (no se corta en el PDF)",
      "latin-1", [...linea].every(ch => ch.charCodeAt(0) < 256) ? "latin-1" : "tiene caracteres fuera",
      [...linea].every(ch => ch.charCodeAt(0) < 256), "A-BUG-1245")
  }

  // ══ ✉️ El mail del Detalle de pago: nuestro nombre en el asunto, facturas cortas y sin repetir al proveedor ══
  {
    const prov = "AGRO CENTROS REGION NUCLEO S.A."
    const una = facturasCortas([{ comprobante: "FC 6447 - AGRO CENTROS REGION NUCLEO S.A." }], prov)
    chequear("Mail de detalle de pago", "✉️ La factura va corta y sin el proveedor", "FC 6447", una.join(", "),
      una.join(", ") === "FC 6447", "A-FEAT-1254")
    const grupo = facturasCortas([
      { comprobante: "FC 1-00003-00006447 - AGRO", facturas: [{ comprobante: "FC 1-3-6447", imp_total: 1 }, { comprobante: "FC 1-3-6448", imp_total: 1 }] },
      { comprobante: "Anticipo", origen: "ANTICIPO" },
      { comprobante: "FC 1-00003-00006449 - AGRO CENTROS REGION NUCLEO S.A." },
    ], prov)
    chequear("Mail de detalle de pago", "✉️ Un grupo se abre en sus facturas, sin ceros, sin anticipos y sin repetir al proveedor",
      "FC 1-3-6447, FC 1-3-6448, FC 1-3-6449", grupo.join(", "),
      grupo.join(", ") === "FC 1-3-6447, FC 1-3-6448, FC 1-3-6449", "A-FEAT-1254")
    chequear("Mail de detalle de pago", "✉️ El asunto lleva nuestro nombre, no el del proveedor", "Martinez Sobrado Agro SRL",
      NOMBRE_PARA_TERCEROS[empresaDeSchema("msa")], NOMBRE_PARA_TERCEROS[empresaDeSchema("msa")] === "Martinez Sobrado Agro SRL", "A-FEAT-1254")
  }

  // ══ 🧾 A-BUG-1244 — factura ↔ compras con descuento pactado y moneda (Agro Centros FC 6447, 2026-10-05) ══
  {
    const C = (id: string, producto: string, cantidad: number, precio: number) => ({ id, fecha: "2026-09-30", producto, unidad: null, cantidad, precioPactado: precio })
    const compras = [
      C("semilla", "Maiz Nufeed", 15, 115), C("glifo", "Glifosato", 180, 4.9), C("para", "Paraquat", 100, 3.8),
      C("24d", "24D", 60, 5.2), C("smeto", "S-Metolacloro", 40, 6.8), C("atra", "Atrazina", 30, 6.1), C("mso", "Coadyuvante", 10, 12),
    ]
    const fac = { moneda: "USD", neto: 3831.02, tc: 1522 }
    const sinDesc = calcularVinculo(fac, compras, compras.map(c => ({ compraId: c.id, incluir: true, pctDescuento: 0 })))
    chequear("Factura ↔ compras", "🧾 Con los precios pactados no cierra: sobran USD 42,98 contra el neto",
      "3874.00 · dif -42.98", `${sinDesc.total.toFixed(2)} · dif ${sinDesc.dif.toFixed(2)}`,
      sinDesc.total === 3874 && sinDesc.dif === -42.98 && !sinDesc.cierra, "A-BUG-1244")
    const conDesc = calcularVinculo(fac, compras, compras.map(c => ({ compraId: c.id, incluir: true, pctDescuento: c.id === "semilla" ? 0 : 2 })))
    chequear("Factura ↔ compras", "🧾 Con el 2 % en los agroquímicos (no en la semilla) cierra al centavo",
      "3831.02 ✓", `${conDesc.total.toFixed(2)} ${conDesc.cierra ? "✓" : "✗"}`, conDesc.total === 3831.02 && conDesc.cierra, "A-BUG-1244")
    const atra = conDesc.renglones.find(r => r.compra.id === "atra")!
    chequear("Factura ↔ compras", "💵 El precio queda en pesos al TC (6,10 −2 % = 5,978 USD × 1.522) y la nota guarda el pactado",
      "9098.516 · Pactado USD 6,10 −2% = USD 5,978 · TC 1.522,00", `${atra.precioPesos} · ${atra.nota}`,
      atra.precioPesos === 9098.516 && atra.nota === "Pactado USD 6,10 −2% = USD 5,978 · TC 1.522,00", "A-BUG-1244")
    const elegidos = new Set(compras.filter(c => c.id !== "semilla").map(c => c.id))
    const sug = pctQueCierra(fac, compras, compras.map(c => ({ compraId: c.id, incluir: true, pctDescuento: 0 })), elegidos)
    chequear("Factura ↔ compras", "🧾 Elegidos los agroquímicos, el % que hace cerrar es el 2 %", "2", String(sug), sug === 2, "A-BUG-1244")
    const sinPrecio = calcularVinculo(fac, [...compras, { ...C("x", "Sin precio", 1, 0), precioPactado: null }], [{ compraId: "x", incluir: true, pctDescuento: 0 }])
    chequear("Factura ↔ compras", "Una compra sin precio no se puede vincular (no se valúa en cero)", "sinPrecio 1 · no cierra",
      `sinPrecio ${sinPrecio.sinPrecio} · ${sinPrecio.cierra ? "cierra" : "no cierra"}`, sinPrecio.sinPrecio === 1 && !sinPrecio.cierra, "A-BUG-1244")
  }

  // ══ 💱 A-FEAT-1255 — NC esperada por diferencia de cambio (Agro Centros FC 6447) ══
  {
    const fac = { id: "f", cuit: "33716360429", proveedor: "AGRO CENTROS", numero: "FC 3-6447", fecha_pago: "2026-10-05", imp_total: 4635.54, tipo_cambio: 1522, tc_pago: 1520 }
    const e = esperadaDe(fac)
    chequear("NC por diferencia de cambio", "💱 Pagada a 1.520 una factura a 1.522: se espera una NC por USD 4.635,54 × 2",
      "NC 9271.08", `${e?.clase} ${e?.monto}`, e?.clase === "NC" && e?.monto === 9271.08, "A-FEAT-1255")
    chequear("NC por diferencia de cambio", "Pagada al mismo TC no se espera nada", "null",
      String(esperadaDe({ ...fac, tc_pago: 1522 })), esperadaDe({ ...fac, tc_pago: 1522 }) === null, "A-FEAT-1255")
    chequear("NC por diferencia de cambio", "Pagada a MÁS se espera una ND", "ND",
      String(esperadaDe({ ...fac, tc_pago: 1525 })?.clase), esperadaDe({ ...fac, tc_pago: 1525 })?.clase === "ND", "A-FEAT-1255")
    const nc = { id: "nc", cuit: "33716360429", fecha: "2026-10-12", numero: "NC 3-120", clase: "NC" as const, importePesos: 9271.07 }
    const otraCuit = { ...nc, id: "x", cuit: "30111111111" }
    const [m] = emparejar([fac], [otraCuit, nc])
    chequear("NC por diferencia de cambio", "🔁 La NC del mismo proveedor por ese importe la cumple (la de otro CUIT no)", "nc",
      String(m.recibida?.id), m.recibida?.id === "nc", "A-FEAT-1255")
    const [sin] = emparejar([fac], [{ ...nc, importePesos: 5000 }])
    chequear("NC por diferencia de cambio", "Una NC por otro importe no la cumple: sigue esperada", "null", String(sin.recibida), sin.recibida === null, "A-FEAT-1255")
  }

  // ══ 📝 A-FEAT-1257 — el detalle del cobro dice qué se cobró ══
  {
    chequear("Qué se cobró", "📝 Arrendamiento saldado: «Cuota 1/4»", "Cuota 1/4",
      String(textoQueSeCobro({ cuotas: [{ numero: 1, de: 4 }], cabezas: [], falta: 0 })),
      textoQueSeCobro({ cuotas: [{ numero: 1, de: 4 }], cabezas: [], falta: 0 }) === "Cuota 1/4", "A-FEAT-1257")
    const parcial = textoQueSeCobro({ cuotas: [{ numero: 2, de: 4 }], cabezas: [], falta: 5000 })
    chequear("Qué se cobró", "📝 Cobro parcial: lo dice, con lo que falta", "Cobro parcial cuota 2/4 (falta $5.000,00)",
      String(parcial), parcial === "Cobro parcial cuota 2/4 (falta $5.000,00)", "A-FEAT-1257")
    const arre = textoQueSeCobro({ cuotas: [], cabezas: [{ cantidad: 3, categoria: "Toro" }, { cantidad: 7, categoria: "Vaca CUT" }], falta: 0 })
    chequear("Qué se cobró", "📝 Hacienda: las cabezas por categoría y el total", "3 Toro + 7 Vaca CUT = 10 cab.",
      String(arre), arre === "3 Toro + 7 Vaca CUT = 10 cab.", "A-FEAT-1257")
    chequear("Qué se cobró", "📝 No pisa lo que escribió el usuario: lo agrega al final, y no lo repite",
      "Adelanto Genta · 120 cab. Ternero", String(detalleConQueSeCobro(detalleConQueSeCobro("Adelanto Genta", "120 cab. Ternero"), "120 cab. Ternero")),
      detalleConQueSeCobro(detalleConQueSeCobro("Adelanto Genta", "120 cab. Ternero"), "120 cab. Ternero") === "Adelanto Genta · 120 cab. Ternero", "A-FEAT-1257")
    chequear("Qué se cobró", "Sin vínculo con la venta no se inventa nada", "null",
      String(textoQueSeCobro({ cuotas: [], cabezas: [], falta: 0 })), textoQueSeCobro({ cuotas: [], cabezas: [], falta: 0 }) === null, "A-FEAT-1257")
  }

  // ══ 📌 A-FEAT-1258 — pendientes a revisar en el export de los papeles ══
  {
    const P = (id: string, texto: string, estado: "abierto" | "resuelto", created: string, resuelto: string | null = null, resolucion: string | null = null) =>
      ({ id, empresa: "MSA", anio_cierre: 2026, texto, estado, resolucion, created_at: created, resuelto_at: resuelto })
    const filas = hojaDePendientes([
      P("r", "Rescate FIMA 04/08", "resuelto", "2026-10-07T10:00:00Z", "2026-10-08T10:00:00Z", "Va como venta de USS"),
      P("b", "Plazo fijo: desglosar intereses", "abierto", "2026-10-07T11:00:00Z"),
      P("a", "Revisar caja", "abierto", "2026-10-07T09:00:00Z"),
    ], "MSA — pendientes")
    chequear("Pendientes del balance", "📌 El export lista primero los ABIERTOS (por fecha) y después los resueltos con su nota",
      "Revisar caja · Plazo fijo… · Rescate (resuelto)", filas.slice(4).map(f => String(f[1])).join(" · "),
      filas.slice(4).map(f => f[1]).join("|") === "Revisar caja|Plazo fijo: desglosar intereses|Rescate FIMA 04/08"
        && filas[6][3] === "resuelto" && filas[6][4] === "Va como venta de USS" && String(filas[1][0]).startsWith("2 pendiente"), "A-FEAT-1258")
  }

  // ══ 💸 A-BUG-1231 — el Cash Flow usa la MISMA cuenta (datos reales de la base, 2026-10-05) ══
  // AFA 31274417: el Cash Flow proyectaba el total ($6.080.286,72); el banco acredita $5.332.648,89.
  const afa31274417 = cobroEsperado({ tipo_comprobante: 332, imp_total: 6080286.72, subtotal_neto: 5618121.12,
    iva: 589902.72, comision_neto: 115599.20, comision_iva: 12137.92, almacenaje_neto: 0, almacenaje_iva: 0,
    ret_iva: 275126.10, ret_iibb: 42135.91 }, 0)
  chequear("Cobro de venta", "💸 Granos AFA 31274417: se proyecta lo que acredita el banco, no el total",
    "5332648.89", afa31274417.pagoCondiciones.toFixed(2),
    Math.abs(afa31274417.pagoCondiciones - 5332648.89) < 0.005, "A-BUG-1231")
  // 🧾 Una factura A con IVA desglosado se cobra ENTERA: el IVA RG 2300 es sólo de granos.
  const facturaA = cobroEsperado({ tipo_comprobante: 1, imp_total: 121000, imp_neto_gravado: 100000, iva: 21000 }, 5000)
  chequear("Cobro de venta", "🧾 Factura A con IVA: se cobra total − retenciones, sin restar el IVA",
    "116000", String(facturaA.pagoCondiciones), facturaA.pagoCondiciones === 116000 && facturaA.ivaRg2300 === 0, "A-BUG-1231")

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
  // ⚠️ Cambió 2026-10-03 (A-FEAT-1234): el papel del frigorífico viene en kilo VIVO; los de carne van aparte.
  chequear("Liquidación de hacienda", "🥩 La precarga al gancho trae los kilos VIVOS (como el papel) y los de carne como kilos gancho",
    "3640 vivos · 1748 gancho · misma plata", `${preVacas.linea.kilos} vivos · ${preVacas.linea.kgGancho} gancho · ${Math.round(preVacas.linea.kilos * preVacas.linea.precio)}`,
    preVacas.linea.kilos === 3640 && preVacas.linea.kgGancho === 1748 && preVacas.linea.precioGancho === 5949.49
      && Math.abs(preVacas.linea.kilos * preVacas.linea.precio - 1748 * 5949.49) < 0.01, "A-FEAT-1234")
  // El dato real manda: con kg y precio gancho, el importe es gancho × precio gancho, y el $/kg pie se deriva.
  const lineaRealAB = { kilos: 3000, precio: 0, kgGancho: 1606, precioGancho: 5024.12 }
  chequear("Liquidación de hacienda", "🥩 Al gancho el importe sale del dato real (1.606 × 5.024,12 = 8.068.736,72) y el $/kg pie es su conversión (2.689,58)",
    "8068736.72 · 2689.58", `${importeDeLinea(lineaRealAB).toFixed(2)} · ${precioPieDerivado(lineaRealAB).toFixed(2)}`,
    importeDeLinea(lineaRealAB).toFixed(2) === "8068736.72" && precioPieDerivado(lineaRealAB).toFixed(2) === "2689.58", "A-FEAT-1234")
  // 2026-10-05: el frigorífico liquida por kilo VIVO — se carga el $/kg pie y el gancho se recalcula solo.
  const lineaPieAB = { kilos: 3000, precio: 2689.58, kgGancho: 1606, mandaPie: true }
  chequear("Liquidación de hacienda", "🥩 Cargando el $/kg VIVO (como liquida Arre Beef) el importe es pie × precio y el $/kg gancho se deriva",
    "8068740.00 · 5024.12", `${importeDeLinea(lineaPieAB).toFixed(2)} · ${precioGanchoDerivado(lineaPieAB).toFixed(2)}`,
    importeDeLinea(lineaPieAB).toFixed(2) === "8068740.00" && precioGanchoDerivado(lineaPieAB).toFixed(2) === "5024.12"
      && precioPieDerivado(lineaPieAB) === 2689.58, "A-FEAT-1234")
  chequear("Liquidación de hacienda", "🥩 Sin «manda el vivo», el gancho cargado sigue mandando como antes",
    "8068736.72", importeDeLinea({ ...lineaPieAB, mandaPie: false, precioGancho: 5024.12 }).toFixed(2),
    importeDeLinea({ ...lineaPieAB, mandaPie: false, precioGancho: 5024.12 }).toFixed(2) === "8068736.72", "A-FEAT-1234")
  // 💲 A-BUG-1279 (2026-10-14): el papel imprime 2 decimales pero calcula con 3. Sólo con 2.689,579 y
  // 2.693,915 dan los brutos del papel (8.068.737 y 8.782.162,90); y el campo los tiene que conservar.
  chequear("Liquidación de hacienda", "💲 🧨 Con 3 decimales el bruto da el del papel (8.068.737 y 8.782.162,90), y el precio NO se redondea a 2 al mostrarlo",
    "8068737.00 · 8782162.90 · 2.689,579 · 5.024,12", `${importeDeLinea({ kilos: 3000, precio: 2689.579 }).toFixed(2)} · ${importeDeLinea({ kilos: 3260, precio: 2693.915 }).toFixed(2)} · ${formatoPrecio(2689.579)} · ${formatoPrecio(5024.12)}`,
    importeDeLinea({ kilos: 3000, precio: 2689.579 }).toFixed(2) === "8068737.00" && importeDeLinea({ kilos: 3260, precio: 2693.915 }).toFixed(2) === "8782162.90"
      && formatoPrecio(2689.579) === "2.689,579" && formatoPrecio(5024.12) === "5.024,12", "A-BUG-1279")
  // ✍️ A-BUG-1280 (2026-10-14): el IVA calculado se corrige escribiendo sobre él (Arre Beef: ,49 → ,48).
  chequear("Liquidación de hacienda", "✍️ Corregir el IVA de 1.769.344,49 a ,48 queda como monto a mano; dejarlo igual vuelve a «calculado»",
    "1.769.344,48 · (vacío) · (vacío)", `${montoTipeadoOVacio("1.769.344,48", 1769344.49)} · ${montoTipeadoOVacio("1.769.344,49", 1769344.49) || "(vacío)"} · ${montoTipeadoOVacio("", 1769344.49) || "(vacío)"}`,
    montoTipeadoOVacio("1.769.344,48", 1769344.49) === "1.769.344,48" && montoTipeadoOVacio("1.769.344,49", 1769344.49) === "" && montoTipeadoOVacio("", 1769344.49) === "", "A-BUG-1280")
  // 🧨 El bug de la primera prueba: al salir de la caja se comparaba contra el cálculo que YA usaba lo tipeado.
  const entradaAB48 = { lineas: [
    { razonSocial: "Arre Beef SA", cuit: "30666277550", cabezas: 3, clasificacion: "Toro", kilos: 3000, precio: 2689.579 },
    { razonSocial: "Arre Beef SA", cuit: "30666277550", cabezas: 7, clasificacion: "Vaca", kilos: 3260, precio: 2693.915 },
  ], comisionPct: 0, redondeo: 0, ivaPct: 10.5, retenciones: [], ivaMonto: 1769344.48 } as any
  chequear("Liquidación de hacienda", "✍️ 🧨 Con ,48 tipeado, la app sigue calculando ,49 sin él — y por eso ,48 NO se borra al salir (antes se comparaba contra ,48 mismo)",
    "1769344.49 · 1.769.344,48 · antes: (vacío)", `${montoCalculado(entradaAB48, "iva").toFixed(2)} · ${montoTipeadoOVacio("1.769.344,48", montoCalculado(entradaAB48, "iva"))} · antes: ${montoTipeadoOVacio("1.769.344,48", calcularLiqHacienda(entradaAB48).iva) || "(vacío)"}`,
    montoCalculado(entradaAB48, "iva").toFixed(2) === "1769344.49" && montoTipeadoOVacio("1.769.344,48", montoCalculado(entradaAB48, "iva")) === "1.769.344,48"
      && montoTipeadoOVacio("1.769.344,48", calcularLiqHacienda(entradaAB48).iva) === "", "A-BUG-1280")
  // El papel REAL de Arre Beef (03/09/2026): 3.000 + 3.260 kg pie, 1.606 + 1.748 kg gancho a $5.024,12.
  const papelAB = calcularLiqHacienda({
    lineas: [{ razonSocial: "Arre Beef SA", cuit: "30666277550", cabezas: 3, clasificacion: "Toro", kilos: 3000, precio: 2689.579, kgGancho: 1606 },
      { razonSocial: "Arre Beef SA", cuit: "30666277550", cabezas: 7, clasificacion: "Vaca", kilos: 3260, precio: 2693.915, kgGancho: 1748 }],
    comisionPct: 0, redondeo: 0, ivaPct: 10.5, retenciones: [], comisionMonto: null, ivaMonto: null,
  })
  const avAB = compararConVenta(juntasAB!, papelAB, 3354)
  const kilosAB = avAB.find(a => a.tema === "Kilos"), subAB = avAB.find(a => a.tema === "Subtotal")
  chequear("Liquidación de hacienda", "🥩 Arre Beef: kilos gancho OK (3.354) y SALTA el precio — $5.024,12 contra $5.590,73 de la venta (−$1,9 M)",
    "kilos ok · subtotal aviso con 5.024,12", `kilos ${kilosAB?.nivel} · subtotal ${subAB?.nivel} · ${subAB?.mensaje.match(/gancho ([\d.,]+)/)?.[1]}`,
    kilosAB?.nivel === "ok" && subAB?.nivel === "aviso" && /gancho 5\.024,1/.test(subAB?.mensaje ?? "") && Math.round(subAB?.diferencia ?? 0) === -1900000, "A-FEAT-1234")
  const sinGancho = compararConVenta(juntasAB!, papelAB)
  chequear("Liquidación de hacienda", "Venta al gancho sin kilos gancho cargados: lo pide, no compara vivos contra carne",
    "aviso de kilos gancho", sinGancho.find(a => a.tema === "Kilos")?.mensaje.slice(0, 40) ?? "",
    /cargá los kilos gancho/.test(sinGancho.find(a => a.tema === "Kilos")?.mensaje ?? ""), "A-FEAT-1234")

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


  // ══ 🧾 Retenciones recibidas en el export del subdiario (A-FEAT-1227 → A-FEAT-1278) ══════════
  // Dos apartados: de las ventas del subdiario (cualquier fecha) y sufridas en el mes (cualquier venta).
  // El caso del usuario: la factura de septiembre, cobrada —y retenida— en octubre.
  const retEntrada = {
    desde: "2026-09-01", hasta: "2026-09-30", idsSubdiario: ["fc-sep", "liq-sep"],
    certificados: [
      { id: "c1", fecha: "2026-10-05", tipo: "ganancias", monto: 100000, comprobante_venta_id: "fc-sep", denominacion_cliente: "SANPA" },
      { id: "c2", fecha: "2026-09-10", tipo: "iibb", monto: 5000, comprobante_venta_id: "fc-ago", denominacion_cliente: "AFA" },
      { id: "c3", fecha: "2026-09-20", tipo: "ganancias", monto: 7000, comprobante_venta_id: "fc-sep", denominacion_cliente: "SANPA" },
      { id: "c4", fecha: null, tipo: "ganancias", monto: 3000, comprobante_venta_id: "fc-sep", denominacion_cliente: "SANPA" },
      { id: "c5", fecha: null, tipo: "iibb", monto: 2000, comprobante_venta_id: null, denominacion_cliente: "SUELTO" },
    ],
    comprobantes: [
      { id: "fc-sep", fecha: "2026-09-15", nro: "10-20", cliente: "SANPA", cuit: "1", ret_iva: null, ret_iibb: null },
      { id: "liq-sep", fecha: "2026-09-12", nro: "11-86270", cliente: "GENTA", cuit: "2", ret_iva: 0, ret_iibb: 675905.18 },
      { id: "fc-ago", fecha: "2026-08-20", nro: "10-19", cliente: "AFA", cuit: "3", ret_iva: null, ret_iibb: null },
    ],
    cobrosPorComprobante: { "fc-sep": ["2026-09-28"] },
  }
  const retSep = armarRetencionesSubdiario(retEntrada)
  const totTipo = (ap: typeof retSep.delMes, t: string) => ap.grupos.find(g => g.tipo === t)?.total ?? 0
  chequear("Retenciones en el subdiario", "🧨 La retención de OCTUBRE sobre una venta de SEPTIEMBRE sale en el subdiario de septiembre (apartado de las ventas) y NO en «sufridas en el mes»",
    "en ventas · no en el mes", `${retSep.deLasVentas.grupos.some(g => g.filas.some(f => f.fecha === "2026-10-05")) ? "en ventas" : "no en ventas"} · ${retSep.delMes.grupos.some(g => g.filas.some(f => f.fecha === "2026-10-05")) ? "en el mes" : "no en el mes"}`,
    retSep.deLasVentas.grupos.some(g => g.filas.some(f => f.fecha === "2026-10-05")) && !retSep.delMes.grupos.some(g => g.filas.some(f => f.fecha === "2026-10-05")), "A-FEAT-1278")
  chequear("Retenciones en el subdiario", "La retención de septiembre sobre una venta de AGOSTO sale en «sufridas en el mes» y no en el apartado de las ventas",
    "IIBB del mes 680905.18 · IIBB de las ventas 675905.18", `IIBB del mes ${totTipo(retSep.delMes, "IIBB")} · IIBB de las ventas ${totTipo(retSep.deLasVentas, "IIBB")}`,
    totTipo(retSep.delMes, "IIBB") === 680905.18 && totTipo(retSep.deLasVentas, "IIBB") === 675905.18, "A-FEAT-1278")
  chequear("Retenciones en el subdiario", "Agrupadas por tipo, Ganancias primero; de las ventas: Ganancias 100.000 + 7.000 + 3.000 (sin fecha) = 110.000",
    "Ganancias,IIBB · 110000 · total 785905.18", `${retSep.deLasVentas.grupos.map(g => g.tipo).join(",")} · ${totTipo(retSep.deLasVentas, "Ganancias")} · total ${retSep.deLasVentas.total}`,
    retSep.deLasVentas.grupos.map(g => g.tipo).join(",") === "Ganancias,IIBB" && totTipo(retSep.deLasVentas, "Ganancias") === 110000 && retSep.deLasVentas.total === 785905.18, "A-FEAT-1278")
  const sinFechaSep = retSep.delMes.grupos.flatMap(g => g.filas).find(f => f.importe === 3000)
  chequear("Retenciones en el subdiario", "🧨 Un certificado SIN FECHA no se pierde: sale con la fecha de su cobro (28/09), con aviso, y marcado en los dos apartados",
    "2026-09-28 · con aviso · en ambos · 1 aviso", `${sinFechaSep?.fecha} · ${sinFechaSep?.aviso ? "con aviso" : "sin aviso"} · ${sinFechaSep?.enAmbos ? "en ambos" : "no"} · ${retSep.avisos.length} aviso`,
    sinFechaSep?.fecha === "2026-09-28" && !!sinFechaSep?.aviso && sinFechaSep?.enAmbos === true && retSep.avisos.length === 1, "A-FEAT-1278")
  chequear("Retenciones en el subdiario", "Sin fecha ni comprobante: no cae en ningún apartado, pero se muestra en «sin ubicar»",
    "1 sin ubicar · SUELTO", `${retSep.sinUbicar.length} sin ubicar · ${retSep.sinUbicar[0]?.cliente}`,
    retSep.sinUbicar.length === 1 && retSep.sinUbicar[0].cliente === "SUELTO", "A-FEAT-1278")
  const fSinCobro = fechaDelCertificado({ fecha: null }, { fecha: "2026-09-15" }, [])
  const fVarios = fechaDelCertificado({ fecha: null }, { fecha: "2026-09-15" }, ["2026-09-28", "2026-09-03"])
  chequear("Retenciones en el subdiario", "Sin fecha y sin cobro → la del comprobante; con varios cobros → el último, diciendo cuántos",
    "2026-09-15 · 2026-09-28 (2 cobros)", `${fSinCobro.fecha} · ${fVarios.fecha} (${fVarios.aviso.includes("2 cobros") ? "2 cobros" : fVarios.aviso})`,
    fSinCobro.fecha === "2026-09-15" && !!fSinCobro.aviso && fVarios.fecha === "2026-09-28" && fVarios.aviso.includes("2 cobros"), "A-FEAT-1278")
  // 📄 A-FEAT-1281 — el PDF: cada retención con su comprobante de venta, cliente, CUIT y fecha; título y subtotal por tipo.
  const pdfVentas = tablaRetencionesPdf(retSep.deLasVentas)
  const filaOct = pdfVentas.filas.find(r => r[0] === "05/10/2026")
  chequear("Retenciones en el subdiario", "📄 PDF: la retención trae fecha, cliente, comprobante de venta e importe; con «Ret. Ganancias», su subtotal y el TOTAL en negrita",
    "05/10/2026 · SANPA · 10-20 · 100.000,00 · Ret. Ganancias · TOTAL 785.905,18", `${filaOct?.[0]} · ${filaOct?.[1]} · ${filaOct?.[3]} · ${filaOct?.[6]} · ${pdfVentas.filas[0][0]} · ${pdfVentas.filas[pdfVentas.filas.length - 1][0]} ${pdfVentas.filas[pdfVentas.filas.length - 1][6]}`,
    filaOct?.[1] === "SANPA" && filaOct?.[3] === "10-20" && filaOct?.[6] === "100.000,00" && pdfVentas.filas[0][0] === "Ret. Ganancias"
      && pdfVentas.negritas.includes(0) && pdfVentas.negritas.includes(pdfVentas.filas.length - 1) && pdfVentas.filas[pdfVentas.filas.length - 1][6] === "785.905,18", "A-FEAT-1281")
  // La hoja: los subtotales son fórmulas que suman su bloque, y el control contra ARCA resta la celda vacía.
  const aoaRet = hojaRetenciones(retSep, "09/2026")
  const celdas = aoaRet.flat().filter((c): c is { t: "n"; v: number; f: string } => !!c && typeof c === "object")
  const subGan = aoaRet.findIndex(r => r[0] === "Subtotal Ret. Ganancias")
  const filaSub = aoaRet[subGan]?.[6] as { f: string; v: number } | undefined
  const sumados = filaSub ? (() => { const [d, h] = filaSub.f.replace("SUM(G", "").replace(")", "").split(":G").map(Number); return aoaRet.slice(d - 1, h).reduce((s, r) => s + (typeof r[6] === "number" ? r[6] : 0), 0) })() : -1
  chequear("Retenciones en el subdiario", "La hoja: el subtotal de Ganancias es una fórmula que abarca exactamente sus filas (suman 110.000), y hay control contra ARCA",
    "110000 · con control ARCA", `${sumados} · ${aoaRet.some(r => String(r[0] || "").startsWith("CONTROL CONTRA ARCA")) ? "con control ARCA" : "sin control"}`,
    sumados === 110000 && celdas.every(c => c.f.length > 0) && aoaRet.some(r => String(r[0] || "").startsWith("CONTROL CONTRA ARCA")), "A-FEAT-1278")

  // ══ 🏢 Cobros de PAM y MA: cada empresa con SUS extractos (A-FEAT-24) ═══════════════════════
  // El vínculo cobro ↔ venta sólo se escribe en un extracto de la empresa de la venta (la FK no deja
  // atar un crédito de PAM a una venta de MSA). Antes de A-FEAT-24 sólo `msa_galicia` lo tenía.
  chequear("Cobros de PAM y MA", "PAM tiene sus DOS cuentas (CA y CC); MA la suya en el schema ma",
    "pam_galicia,pam_galicia_cc · ma.ma_galicia", `${extractosDelSchema("pam").map(e => e.tabla).join(",")} · ${extractosDelSchema("ma").map(e => `${e.schema}.${e.tabla}`).join(",")}`,
    extractosDelSchema("pam").length === 2 && extractosDelSchema("ma")[0]?.schema === "ma", "A-FEAT-24")
  chequear("Cobros de PAM y MA", "🧨 Un crédito de PAM NO se ata a una venta de MSA, y uno de MA sí a una de MA",
    "pam→msa no · ma→ma sí · msa→msa sí", `pam→msa ${extractoEsDe("pam_galicia", "msa") ? "sí" : "no"} · ma→ma ${extractoEsDe("ma_galicia", "ma") ? "sí" : "no"} · msa→msa ${extractoEsDe("msa_galicia", "msa") ? "sí" : "no"}`,
    !extractoEsDe("pam_galicia", "msa") && extractoEsDe("ma_galicia", "ma") && extractoEsDe("msa_galicia", "msa"), "A-FEAT-24")
  chequear("Cobros de PAM y MA", "Los 4 extractos Galicia llevan el vínculo, ninguno repetido",
    "4", String(new Set(TODOS_LOS_EXTRACTOS.map(e => e.tabla)).size), TODOS_LOS_EXTRACTOS.length === 4 && new Set(TODOS_LOS_EXTRACTOS.map(e => e.tabla)).size === 4, "A-FEAT-24")

  // ══ 📝 PAGAR CON VARIOS ECHEQS y el Excel de emisión (A-FEAT-1282) ═══════════════════════════
  // El caso del usuario: un anticipo pagado en 3 echeqs, retención SICORE repartida en partes iguales.
  const echPlanIguales = { modo: "iguales" as const, echeqs: [{ fechaCobro: "2026-10-29" }, { fechaCobro: "2026-11-13" }, { fechaCobro: "2026-12-13" }] }
  const echTres = calcularEcheqs(echPlanIguales, 3000000 - 100000, 100000)
  chequear("Echeqs múltiples", "📝 3 echeqs iguales de $3.000.000 con $100.000 de retención: cada uno 966.666,67/66,67/66,66 y la retención 33.333,33/33/34",
    "966666.67 · 966666.67 · 966666.66 · ret 33333.33/33333.33/33333.34", `${echTres.map(e => e.monto).join(" · ")} · ret ${echTres.map(e => e.retencion).join("/")}`,
    echTres[0].monto === 966666.67 && echTres[2].monto === 966666.66 && echTres[2].retencion === 33333.34, "A-FEAT-1282")
  const echSumaTres = echTres.reduce((s2, e) => s2 + e.monto + e.retencion, 0)
  chequear("Echeqs múltiples", "🧮 Identidad: Σ echeqs + Σ retención = total del pago, al centavo",
    "3000000.00", echSumaTres.toFixed(2), echSumaTres.toFixed(2) === "3000000.00", "A-FEAT-1282")
  const echPlanMontos = { modo: "montos" as const, echeqs: [{ fechaCobro: "2026-10-29", parte: 1000000 }, { fechaCobro: "2026-11-13", parte: 2000000 }] }
  const echPorMontos = calcularEcheqs(echPlanMontos, 2910000, 90000)
  chequear("Echeqs múltiples", "Por montos (partes del total 1M + 2M): la retención va en la misma proporción (30.000 y 60.000)",
    "970000 · 1940000 · 30000 · 60000", `${echPorMontos[0].monto} · ${echPorMontos[1].monto} · ${echPorMontos[0].retencion} · ${echPorMontos[1].retencion}`,
    echPorMontos[0].monto === 970000 && echPorMontos[1].monto === 1940000 && echPorMontos[0].retencion === 30000 && echPorMontos[1].retencion === 60000, "A-FEAT-1282")
  // ⚠️ Cambió 2026-10-14 (*«esa restricción no debe existir»*): que las partes no sumen AVISA, no frena;
  // lo único que frena es un echeq sin fecha.
  const echAvisos = avisosDelPlan({ modo: "montos", echeqs: [{ fechaCobro: "2026-10-29", parte: 1000000 }] }, 3000000).length
    + avisosDelPlan({ modo: "porcentaje", echeqs: [{ fechaCobro: "2026-10-29", parte: 33.33 }, { fechaCobro: "2026-11-29", parte: 33.33 }, { fechaCobro: "2026-12-29", parte: 33.33 }] }, 1).length
  const echFrenan = problemasDelPlan({ modo: "montos", echeqs: [{ fechaCobro: "2026-10-29", parte: 1000000 }] }).length
    + problemasDelPlan({ modo: "porcentaje", echeqs: [{ fechaCobro: "2026-10-29", parte: 33.33 }, { fechaCobro: "2026-11-29", parte: 33.33 }, { fechaCobro: "2026-12-29", parte: 33.33 }] }).length
  chequear("Echeqs múltiples", "⚠️ Montos que no suman o 33,33 % ×3 AVISAN y no frenan; sólo frena un echeq sin fecha",
    "2 avisos · 0 frenan · sin fecha frena", `${echAvisos} avisos · ${echFrenan} frenan · ${problemasDelPlan({ modo: "iguales", echeqs: [{ fechaCobro: "" }] }).length ? "sin fecha frena" : "?"}`,
    echAvisos === 2 && echFrenan === 0 && problemasDelPlan({ modo: "iguales", echeqs: [{ fechaCobro: "" }] }).length === 1 && problemasDelPlan(echPlanIguales).length === 0, "A-FEAT-1282")
  // Con 33,33 % × 3 se reparte igual (proporción): 1/3 cada uno, y la suma cierra con el saldo.
  const echPct = calcularEcheqs({ modo: "porcentaje", echeqs: [{ fechaCobro: "a", parte: 33.33 }, { fechaCobro: "b", parte: 33.33 }, { fechaCobro: "c", parte: 33.33 }] }, 13773075.04)
  chequear("Echeqs múltiples", "BRIKI con 33,33 % × 3 sobre el saldo 13.773.075,04: 4.591.025,01 / 4.591.025,01 / 4.591.025,02 — suman el saldo exacto",
    "4591025.01 · 4591025.01 · 4591025.02 · 13773075.04", `${echPct.map(e => e.monto).join(" · ")} · ${echPct.reduce((s2, e) => s2 + e.monto, 0).toFixed(2)}`,
    echPct[0].monto === 4591025.01 && echPct[2].monto === 4591025.02 && echPct.reduce((s2, e) => s2 + e.monto, 0).toFixed(2) === "13773075.04", "A-FEAT-1282")
  chequear("Echeqs múltiples", "La factura/anticipo se estampa con la fecha del ÚLTIMO echeq",
    "2026-12-13", ultimaFechaCobro(echPlanIguales), ultimaFechaCobro(echPlanIguales) === "2026-12-13", "A-FEAT-1282")
  const echExcel = filasEmision([{ cuit: "30-70814129-8", monto: 966666.67, fechaCobro: "2026-10-29", motivo: motivoPorDefecto(false), descripcion1: "Anticipo X (1/3)", mail: "a@b.com; c@d.com", clausula: "No a la orden" }])
  chequear("Echeqs múltiples", "🏦 Excel del banco: encabezado de la plantilla, CUIT sin guiones, fecha DD/MM/AAAA como texto, motivo «Orden de pago» si no es factura, un solo mail, descripción 2 completada",
    "Tipo de documento · 30708141298 · 29/10/2026 · Orden de pago · a@b.com · Anticipo X (1/3) · sin problemas",
    `${echExcel.filas[0][0]} · ${echExcel.filas[1][1]} · ${echExcel.filas[1][3]} · ${echExcel.filas[1][4]} · ${echExcel.filas[1][7]} · ${echExcel.filas[1][6]} · ${echExcel.problemas.length ? echExcel.problemas[0] : "sin problemas"}`,
    echExcel.filas[0].join("|") === ENCABEZADO_EMISION.join("|") && echExcel.filas[1][1] === 30708141298 && echExcel.filas[1][3] === "29/10/2026"
      && echExcel.filas[1][4] === "Orden de pago" && echExcel.filas[1][7] === "a@b.com" && echExcel.filas[1][6] === "Anticipo X (1/3)" && !echExcel.problemas.length
      && motivoPorDefecto(true) === "Factura", "A-FEAT-1282")
  chequear("Echeqs múltiples", "🛑 Excel: un CUIT incompleto o una cláusula fuera de la lista del banco se avisan (no se genera)",
    "2 problemas", `${filasEmision([{ cuit: "3070", monto: 1, fechaCobro: "2026-10-29", motivo: "Factura", clausula: "Libre" }]).problemas.length} problemas`,
    filasEmision([{ cuit: "3070", monto: 1, fechaCobro: "2026-10-29", motivo: "Factura", clausula: "Libre" }]).problemas.length === 2, "A-FEAT-1282")
  // El Cash Flow: un anticipo con 3 echeqs pasa a 3 filas, cada una en su fecha; con 1 echeq no cambia.
  const echFilaAnt = { id: "ant1", origen: "ANTICIPO", debitos: 2900000, fecha_estimada: "2026-12-13", detalle: "ANTICIPO: X" }
  const echChs = [
    { id: "c1", monto: 966666.67, fecha_cobro: "2026-10-29", estado: "vigente", factura_id: null, anticipo_id: "ant1" },
    { id: "c2", monto: 966666.67, fecha_cobro: "2026-11-13", estado: "vigente", factura_id: null, anticipo_id: "ant1" },
    { id: "c3", monto: 966666.66, fecha_cobro: "2026-12-13", estado: "cobrado", factura_id: null, anticipo_id: "ant1" },
  ]
  const echPartidas = partirFilasEnEcheqs([echFilaAnt], echChs)
  chequear("Echeqs múltiples", "📈 🧨 Cash Flow: el anticipo en 3 echeqs se proyecta echeq por echeq (el cobrado ya no), y con UN echeq la fila sigue igual",
    "2 filas · 2026-10-29 966666.67 · 2026-11-13 · sólo lectura · 1 fila", `${echPartidas.length} filas · ${echPartidas[0]?.fecha_estimada} ${echPartidas[0]?.debitos} · ${echPartidas[1]?.fecha_estimada} · ${echPartidas[0]?.origen_tabla === "msa.cheques" && echPartidas[0]?.echeq_de === "ant1" ? "sólo lectura" : "?"} · ${partirFilasEnEcheqs([echFilaAnt], [echChs[0]]).length} fila`,
    echPartidas.length === 2 && echPartidas[0].fecha_estimada === "2026-10-29" && echPartidas[0].debitos === 966666.67 && echPartidas[1].fecha_estimada === "2026-11-13"
      && echPartidas[0].origen_tabla === "msa.cheques" && echPartidas[0].echeq_de === "ant1" && partirFilasEnEcheqs([echFilaAnt], [echChs[0]])[0].id === "ant1", "A-FEAT-1282")

  // 📅 Plazo en días como alternativa a la fecha (usuario 2026-10-14): a N días de la emisión, sin que el huso lo corra.
  chequear("Echeqs múltiples", "📅 A 15, 30 y 60 días de la emisión del 14/10 (cruzando fin de mes y de año), y la cuenta inversa",
    "2026-10-29 · 2026-11-13 · 2026-12-13 · 2027-01-05 · 60", `${fechaMasDias("2026-10-14", 15)} · ${fechaMasDias("2026-10-14", 30)} · ${fechaMasDias("2026-10-14", 60)} · ${fechaMasDias("2026-12-06", 30)} · ${diasEntre("2026-10-14", "2026-12-13")}`,
    fechaMasDias("2026-10-14", 15) === "2026-10-29" && fechaMasDias("2026-10-14", 30) === "2026-11-13" && fechaMasDias("2026-10-14", 60) === "2026-12-13"
      && fechaMasDias("2026-12-06", 30) === "2027-01-05" && diasEntre("2026-10-14", "2026-12-13") === 60 && fechaMasDias("", 10) === "", "A-FEAT-1282")
  // 🐞 A-BUG-1284 — reconstruir la retención de BRIKI que quedó sin registrar en SICORE.
  const echBriki = baseDesdeRetencion(11570247.93, 226924.96, 0.02, 224000)
  const echAdic = baseDesdeRetencion(1000000, 20000, 0.02, 224000)
  chequear("Echeqs múltiples", "🧾 BRIKI: la retención 226.924,96 sale de (11.570.247,93 − 224.000) × 2 % → mínimo 224.000 exacto (deducido daba 223.999,93); sin mínimo, base = neto",
    "11346247.93 · 224000 · exacto · adicional 0", `${echBriki.base} · ${echBriki.minimo} · ${echBriki.deducido ? "deducido" : "exacto"} · adicional ${echAdic.minimo}`,
    echBriki.base === 11346247.93 && echBriki.minimo === 224000 && !echBriki.deducido && echAdic.minimo === 0 && echAdic.base === 1000000, "A-BUG-1284")
  // 🐞 A-BUG-1285 — el total del anticipo es su MONTO (puede traer percepciones), no neto + IVA.
  const echTot = totalAnticipo(100, 90)
  const echTotSin = totalAnticipo(0, 3435838.56)
  chequear("Echeqs múltiples", "🧾 🧨 Anticipo de $100 con neto+IVA $90: el total es 100 y hay $10 de «otros» (antes el total era 90); sin monto, neto+IVA; si neto+IVA supera el monto, avisa",
    "100 · otros 10 · sin monto 3435838.56 · avisa", `${echTot.total} · otros ${echTot.otros} · sin monto ${echTotSin.total} · ${totalAnticipo(80, 90).aviso ? "avisa" : "no avisa"}`,
    echTot.total === 100 && echTot.otros === 10 && !echTot.aviso && echTotSin.total === 3435838.56 && echTotSin.otros === 0 && !!totalAnticipo(80, 90).aviso, "A-BUG-1285")
  // 🐞 A-BUG-1283 — desde la barra de PAGOS un anticipo pasaba a echeq sin modal. Antes la regla era
  // «todo lo que no es factura de MSA pendiente va directo» (así lo hacía el código viejo).
  const echLoteAnt = clasificarLoteEcheq([{ id: "a1", origen: "ANTICIPO", estado: "pendiente" }], () => true)
  const echViejoDirecto = [{ id: "a1", origen: "ANTICIPO", estado: "pendiente" }].filter(f => !(f.origen === "ARCA" && f.estado !== "echeq")).length
  chequear("Echeqs múltiples", "🐞 🧨 PAGOS → ECHEQ con un ANTICIPO abre su modal (antes iba directo a «echeq» sin cheque)",
    "abre a1 · antes: 1 directo", `${echLoteAnt.abrirAnticipo ? "abre " + echLoteAnt.abrirAnticipo.id : "no abre"} · antes: ${echViejoDirecto} directo`,
    echLoteAnt.abrirAnticipo?.id === "a1" && echLoteAnt.templates.length === 0 && echViejoDirecto === 1, "A-BUG-1283")
  const echLoteMix = clasificarLoteEcheq([
    { id: "a1", origen: "ANTICIPO", estado: "pendiente" }, { id: "a2", origen: "ANTICIPO", estado: "pendiente" },
    { id: "f1", origen: "ARCA", estado: "pagar" }, { id: "f2", origen: "ARCA", estado: "echeq" }, { id: "t1", origen: "TEMPLATE", estado: "pendiente" },
  ], () => true)
  chequear("Echeqs múltiples", "Varios anticipos o mezclados no se tocan; una factura ya en echeq tampoco; la pendiente va al modal; el template se marca (con aviso)",
    "sin abrir · 2 sin tocar · modal f1 · ya f2 · template t1", `${echLoteMix.abrirAnticipo ? "abre" : "sin abrir"} · ${echLoteMix.anticiposSinTocar.length} sin tocar · modal ${echLoteMix.facturasModal.map(f => f.id).join(",")} · ya ${echLoteMix.facturasYaEnEcheq.map(f => f.id).join(",")} · template ${echLoteMix.templates.map(f => f.id).join(",")}`,
    !echLoteMix.abrirAnticipo && echLoteMix.anticiposSinTocar.length === 2 && echLoteMix.facturasModal[0]?.id === "f1" && echLoteMix.facturasYaEnEcheq[0]?.id === "f2" && echLoteMix.templates[0]?.id === "t1", "A-BUG-1283")

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
   * 🚦 **La marca de cuenta contable del Cash Flow — A-FEAT-1260.** Sólo facturas.
   * 🔗 **Y la cuenta con su número, que son una sola cosa — A-BUG-1249.**
   */
  {
    const e = cuentaDeFila

    chequear("Cuenta en Cash Flow", "Factura sin cuenta: roja y se puede poner acá",
      "sin · asignable",
      `${e({ origen: "ARCA", categ: "SIN_CATEG" }).estado} · ${e({ origen: "ARCA", categ: "SIN_CATEG" }).asignable ? "asignable" : "no"}`,
      e({ origen: "ARCA", categ: "SIN_CATEG" }).estado === "sin" && e({ origen: "ARCA", categ: "SIN_CATEG" }).asignable,
      "A-FEAT-1260")

    chequear("Cuenta en Cash Flow", "Factura vieja con el nombre pero sin el número no sale en verde",
      "a-medias", e({ origen: "ARCA", categ: "Honorarios", nro_cuenta: null }).estado,
      e({ origen: "ARCA", categ: "Honorarios", nro_cuenta: null }).estado === "a-medias", "A-FEAT-1260")

    const conCuenta = e({ origen: "ARCA", categ: "Honorarios", nro_cuenta: "5201" })
    chequear("Cuenta en Cash Flow", "Factura con su cuenta: verde, y el cartel muestra el nombre y no el número",
      "con · Cuenta contable: Honorarios — tocá para cambiarla",
      `${conCuenta.estado} · ${conCuenta.titulo}`,
      conCuenta.estado === "con" && !conCuenta.titulo.includes("5201"), "A-FEAT-1260")

    const grupo = e({ origen: "ARCA", categ: "Honorarios", nro_cuenta: "5201", facturas_agrupadas: 3 })
    chequear("Cuenta en Cash Flow", "Un pago agrupado no afirma la cuenta de todas ni deja asignar de a varias",
      "grupo · no", `${grupo.estado} · ${grupo.asignable ? "asignable" : "no"}`,
      grupo.estado === "grupo" && !grupo.asignable, "A-FEAT-1260")

    const otros = ["TEMPLATE", "SUELDO", "VENTA", "ANTICIPO"].map(o => e({ origen: o, categ: "SIN_CATEG" }).estado)
    chequear("Cuenta en Cash Flow", "🔑 Templates, sueldos, ventas y anticipos NO llevan marca (es sólo para facturas)",
      "no-aplica ×4", otros.join(" "), otros.every(x => x === "no-aplica"), "A-FEAT-1260")

    const plan = [{ categ: "Honorarios", nro_cuenta: 5201 }, { categ: "Sin Numero", nro_cuenta: null }]
    chequear("Cuenta y número", "🔑 El nombre de la cuenta trae su número (sin importar mayúsculas ni espacios)",
      "5201 · 5201", `${nroDeCuenta("Honorarios", plan)} · ${nroDeCuenta("  HONORARIOS ", plan)}`,
      nroDeCuenta("Honorarios", plan) === "5201" && nroDeCuenta("  HONORARIOS ", plan) === "5201", "A-BUG-1249")

    chequear("Cuenta y número", "Sin nombre, fuera del plan o sin número cargado: no inventa un número",
      "null null null",
      `${nroDeCuenta("", plan)} ${nroDeCuenta("No existe", plan)} ${nroDeCuenta("Sin Numero", plan)}`,
      nroDeCuenta("", plan) === null && nroDeCuenta("No existe", plan) === null && nroDeCuenta("Sin Numero", plan) === null,
      "A-BUG-1249")
  }

  {
    // A-FEAT-1265 — el stock de la pantalla no trae las categorías en cero, y los ids llegan como texto o número.
    const stockHoy = [{ categoria_id: 7, cantidad: 37 }, { categoria_id: "9", cantidad: 120 }]
    chequear("Hacienda — cabezas de hoy", "Una categoría que no está en el stock tiene 0 cabezas; el id vale como texto o número",
      "37 · 120 · 0 · 0",
      `${cabezasHoy(stockHoy, "7")} · ${cabezasHoy(stockHoy, 9)} · ${cabezasHoy(stockHoy, "33")} · ${cabezasHoy(stockHoy, "")}`,
      cabezasHoy(stockHoy, "7") === 37 && cabezasHoy(stockHoy, 9) === 120 && cabezasHoy(stockHoy, "33") === 0 && cabezasHoy(stockHoy, "") === 0,
      "A-FEAT-1265")
  }

  {
    // A-FEAT-1272 — el estado que propone PAGOS es el paso siguiente de lo tildado.
    const s = estadoSugeridoParaLote
    chequear("PAGOS — estado propuesto", "🔑 Todo en pendiente propone pagar; todo en pagar propone pagado",
      "pagar · pagado", `${s(["pendiente", "pendiente"])} · ${s(["pagar"])}`,
      s(["pendiente", "pendiente"]) === "pagar" && s(["pagar"]) === "pagado", "A-FEAT-1272")
    chequear("PAGOS — estado propuesto", "Mezclado, vacío o en otro estado: no propone nada (queda lo que estaba)",
      "null null null", `${s(["pendiente", "pagar"])} ${s([])} ${s(["conciliado"])}`,
      s(["pendiente", "pagar"]) === null && s([]) === null && s(["conciliado"]) === null, "A-FEAT-1272")
    chequear("PAGOS — estado propuesto", "Pagar, preparado y programado juntos proponen pagado",
      "pagado", String(s(["pagar", "preparado", "programado"])),
      s(["pagar", "preparado", "programado"]) === "pagado", "A-FEAT-1272")
  }

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

    // ⚠️ cambió 2026-10-23: diciembre ya no sirve de ejemplo de mes duplicado — el histórico de
    // diciembre en adelante queda «superado» (manda la app). El duplicado se prueba con octubre.
    const conOctubreDoble = [
      comp({ fuente: "historico", subdiario: "2025-10", numero: 10, total: 121 }),
      comp({ fuente: "arca", subdiario: "2025-10", numero: 12, total: 121 }),
    ]
    const libro = armarLibroDiario(conOctubreDoble, [], ej)
    chequear("Balance · libro diario", "🛑 Con un mes duplicado, el papel NO se puede entregar",
      "frena", libro.controles.sePuedeEntregar ? "deja pasar" : "frena",
      libro.controles.sePuedeEntregar === false, "A-DAT-61")

    chequear("Balance · libro diario", "Y el motivo se dice en castellano, no en códigos",
      "menciona el subdiario",
      libro.controles.motivos.join(" ").includes("2025-10") ? "menciona el subdiario" : "no lo menciona",
      libro.controles.motivos.join(" ").includes("2025-10"), "A-DAT-61")

    // 🗄️ A-DAT-61 (usuario 23/10): de diciembre 2025 en adelante manda la app; el histórico se informa aparte.
    const conDic = armarLibroDiario(conDiciembreDoble, [], ej)
    chequear("Balance · libro diario", "🗄️ Diciembre en las dos fuentes: el del histórico queda «superado» y no se cuenta",
      "2 superados · dic = 1 de ARCA · sin duplicados",
      `${conDic.historicoSuperado.length} superados · dic = ${conDic.compras.filter(a => a.subdiario === "2025-12").length} de ${conDic.compras.filter(a => a.subdiario === "2025-12").map(a => a.fuente).join(",") === "arca" ? "ARCA" : "?"} · ${conDic.controles.subdiariosDuplicados.length === 0 ? "sin duplicados" : "duplicado"}`,
      conDic.historicoSuperado.length === 2 && conDic.compras.filter(a => a.subdiario === "2025-12").length === 1
        && conDic.compras.find(a => a.subdiario === "2025-12")?.fuente === "arca" && conDic.controles.subdiariosDuplicados.length === 0, "A-DAT-61")
    const novHist = armarLibroDiario([comp({ fuente: "historico", subdiario: "2025-11", numero: 5 })], [], ej)
    chequear("Balance · libro diario", "Y el histórico de noviembre SÍ cuenta (es el último mes del sistema anterior)",
      "1 en el libro · 0 superados", `${novHist.compras.length} en el libro · ${novHist.historicoSuperado.length} superados`,
      novHist.compras.length === 1 && novHist.historicoSuperado.length === 0, "A-DAT-61")

    // 🧾 Contra lo presentado a ARCA (segundo camino).
    const presentadoDic = { "2025-12": { comprobantes: 1, total: 121 } }
    const igual = armarLibroDiario([comp({ subdiario: "2025-12", numero: 1, total: 121 })], [], ej, presentadoDic)
    const fDic = igual.controles.contraPresentado?.find(f => f.subdiario === "2025-12")
    chequear("Balance · libro diario", "🧾 Diciembre igual a lo presentado → coincide",
      "coincide", fDic?.ok ? "coincide" : "no coincide", fDic?.ok === true, "A-DAT-61")
    const deMas = armarLibroDiario([comp({ subdiario: "2025-12", numero: 1, total: 121 }), comp({ subdiario: "2025-12", numero: 2, total: 50 })], [], ej, presentadoDic)
    const fMas = deMas.controles.contraPresentado?.find(f => f.subdiario === "2025-12")
    chequear("Balance · libro diario", "🧾 Una de más en la app (las de Coopser / Río Tala) → no coincide, dice +1 y $50, y no se entrega",
      "+1 · 50 · frena", `${fMas?.diferenciaComprobantes != null && fMas.diferenciaComprobantes > 0 ? "+" : ""}${fMas?.diferenciaComprobantes} · ${fMas?.diferenciaTotal} · ${deMas.controles.sePuedeEntregar ? "deja pasar" : "frena"}`,
      fMas?.ok === false && fMas.diferenciaComprobantes === 1 && fMas.diferenciaTotal === 50
        && !deMas.controles.sePuedeEntregar && deMas.controles.motivos.join(" ").includes("presentado"), "A-DAT-61")
    chequear("Balance · libro diario", "Sin dato de lo presentado para el ejercicio, no hay control (y no inventa errores)",
      "sin control", armarLibroDiario([comp({ subdiario: "2026-01", numero: 1 })], [], ej, { "2030-01": { comprobantes: 1, total: 1 } }).controles.contraPresentado === null ? "sin control" : "controló",
      armarLibroDiario([comp({ subdiario: "2026-01", numero: 1 })], [], ej, { "2030-01": { comprobantes: 1, total: 1 } }).controles.contraPresentado === null, "A-DAT-61")
    // Dato real: diciembre 2025 de MSA = lo presentado (36) + las 4 de Coopser y Río Tala que no se declararon.
    const p = PRESENTADO_ARCA_COMPRAS.MSA["2025-12"]
    const real = compararConPresentado(
      [{ subdiario: "2025-12", total: p.total }, ...[41697.45, 518801.15, 9999.98, 10011.99].map(t => ({ subdiario: "2025-12", total: t }))],
      ["2025-12"], { "2025-12": { comprobantes: 5, total: p.total } })[0]
    chequear("Balance · libro diario", "🧾 Caso real: diciembre de MSA con las 4 sin declarar da $580.510,57 de más",
      "580510.57", String(real.diferenciaTotal), real.diferenciaTotal === 580510.57 && p.comprobantes === 36 && p.total === 15813686.35, "A-DAT-61")

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

    // ✍️ A-FEAT-1331 — provisión puesta a mano: fecha POSTERIOR al cierre, con motivo.
    const manual = comp({ id: "m1", subdiario: "2026-08", numero: 300, fecha: "2026-07-15", total: 500, provision_motivo: "servicio de junio" })
    const conManual = armarLibroDiario([comp({ subdiario: "2026-01", numero: 1 }), manual], [], ej, undefined,
      { esteEjercicio: [manual], anterior: [] })
    chequear("Balance · provisión", "✍️ Una factura de fecha posterior al cierre, puesta a mano, entra a la provisión con su motivo",
      "1 provisión · servicio de junio",
      `${conManual.provisiones.length} provisión · ${conManual.provisiones[0]?.provision_motivo ?? "-"}`,
      conManual.provisiones.length === 1 && conManual.provisiones[0].provision_motivo === "servicio de junio", "A-FEAT-1331")
    const sinMarca = armarLibroDiario([comp({ subdiario: "2026-08", numero: 300, fecha: "2026-07-15" })], [], ej)
    chequear("Balance · provisión", "Y sin marcarla, la misma factura NO es provisión (la regla de la fecha no la toma)",
      "0", String(sinMarca.provisiones.length), sinMarca.provisiones.length === 0, "A-FEAT-1331")
    const autoYManual = comp({ id: "a1", subdiario: "2026-07", numero: 2, fecha: "2026-06-23" })
    const sinDoble = armarLibroDiario([autoYManual], [], ej, undefined, { esteEjercicio: [{ ...autoYManual, provision_motivo: "x" }], anterior: [] })
    chequear("Balance · provisión", "Si una ya entraba por la regla y además se marcó a mano, no se cuenta dos veces",
      "1", String(sinDoble.provisiones.length), sinDoble.provisiones.length === 1, "A-FEAT-1331")

    // 📋 La del ejercicio ANTERIOR: se lista, no se resta.
    const delAnterior = comp({ id: "h1", fuente: "historico", subdiario: "2025-08", numero: 9, fecha: "2025-06-25", total: 1000 })
    const conAnterior = armarLibroDiario([delAnterior], [], ej)
    chequear("Balance · provisión", "📋 Una factura del 24/25 (fecha ≤ 30/06/2025) en el subdiario de ago-25 se lista como provisión del ejercicio anterior",
      "1 anterior", `${conAnterior.provisionesEjercicioAnterior.length} anterior`,
      conAnterior.provisionesEjercicioAnterior.length === 1, "A-FEAT-1331")
    chequear("Balance · provisión", "Y NO se resta: sigue sumando en las compras del 25/26 (el contador lo maneja)",
      "1 compra · total 1000", `${conAnterior.compras.length} compra · total ${conAnterior.controles.compras.totalGeneral}`,
      conAnterior.compras.length === 1 && conAnterior.controles.compras.totalGeneral === 1000, "A-FEAT-1331")
    const manualAnt = comp({ id: "m0", subdiario: "", numero: 77, fecha: "2025-07-10", provision_motivo: "del 24/25" })
    const conManualAnt = armarLibroDiario([], [], ej, undefined, { esteEjercicio: [], anterior: [manualAnt] })
    chequear("Balance · provisión", "Las puestas a mano para el ejercicio anterior también se listan ahí",
      "1", String(conManualAnt.provisionesEjercicioAnterior.length), conManualAnt.provisionesEjercicioAnterior.length === 1, "A-FEAT-1331")

    // 🔢 A-FEAT-1332 — control de cantidad de los proveedores fijos (casos auditados por el usuario).
    const doce = ej.subdiarios.map(x => claveSubdiario(x.anio, x.mes))
    const fac = (cuit: string, fecha: string, numero: number, tipo = 11, no_informada?: boolean) =>
      ({ cuit, fecha, punto_venta: 1, numero, tipo, no_informada })
    const mesesAFechas = (cuit: string, porMes: number, desde = 1, tipo = 11, noInf?: boolean) =>
      doce.flatMap((m, i) => Array.from({ length: porMes }, (_, j) => fac(cuit, `${m}-1${j}`, desde + i * 10 + j, tipo, noInf)))
    const ulises = [fac("20443732145", "2025-07-01", 28), ...mesesAFechas("20443732145", 1, 30)]
    const [fUl] = controlarFacturasFijas(ulises, [{ cuit: "20443732145", nombre: "SANCHEZ ULISES", facturasPorMes: 1 }], doce)
    chequear("Balance · proveedores fijos", "🔢 12 del período + la de junio facturada el 1/7 → 13 de 12, julio con 2: no cierra y lo dice",
      "13 de 12 · con más: jul-25 (2)", explicarFila(fUl),
      !fUl.ok && fUl.hay === 13 && explicarFila(fUl) === "13 de 12 · con más: jul-25 (2)", "A-FEAT-1332")
    const sf = mesesAFechas("33717253219", 1).filter(f => !f.fecha.startsWith("2025-07"))
    const [fSf] = controlarFacturasFijas(sf, [{ cuit: "33-71725321-9", nombre: "SMART FARMING", facturasPorMes: 1 }], doce)
    chequear("Balance · proveedores fijos", "Smart Farming sin julio → 11 de 12, «con menos: jul-25» (CUIT con guiones igual matchea)",
      "11 de 12 · con menos: jul-25 (0)", explicarFila(fSf), fSf.hay === 11 && explicarFila(fSf) === "11 de 12 · con menos: jul-25 (0)", "A-FEAT-1332")
    const medicus = [...mesesAFechas("30546771314", 1, 1, 6), ...mesesAFechas("30546771314", 1, 1, 8)]
    const [fMe] = controlarFacturasFijas(medicus, [{ cuit: "30546771314", nombre: "MEDICUS", facturasPorMes: 2 }], doce)
    chequear("Balance · proveedores fijos", "Medicus: factura + NC con el mismo número no son repetidas → 24 de 24",
      "24 de 24", explicarFila(fMe), fMe.ok && fMe.hay === 24, "A-FEAT-1332")
    const conRep = [...mesesAFechas("30639453738", 1), fac("30639453738", "2025-12-10", 51)]
    const [fRep] = controlarFacturasFijas(conRep, [{ cuit: "30639453738", nombre: "TELECOM", facturasPorMes: 1 }], doce)
    chequear("Balance · proveedores fijos", "Una cargada dos veces (mismo número) se cuenta como repetida, no como factura",
      "12 · 1 repetida · no cierra", `${fRep.hay} · ${fRep.repetidas} repetida · ${fRep.ok ? "cierra" : "no cierra"}`,
      fRep.hay === 12 && fRep.repetidas === 1 && !fRep.ok, "A-FEAT-1332")
    chequear("Balance · proveedores fijos", "Durante el año cuenta sólo los meses terminados: el 15/10/2025 → jul, ago y sep",
      "2025-07,2025-08,2025-09", mesesTerminados(doce, "2025-10-15").join(","),
      mesesTerminados(doce, "2025-10-15").join(",") === "2025-07,2025-08,2025-09", "A-FEAT-1332")
    const [fTala] = controlarFacturasFijas(mesesAFechas("30615803762", 2, 1, 1, true), [{ cuit: "30615803762", nombre: "RIO TALA", facturasPorMes: 2 }], doce)
    chequear("Balance · proveedores fijos", "Si la mayoría se carga a mano, el proveedor sale «a mano» (va en rojo)",
      "a mano · 24 de 24", `${fTala.aMano ? "a mano" : "ARCA"} · ${explicarFila(fTala)}`, fTala.aMano && fTala.ok, "A-FEAT-1332")
    const [fAfa] = controlarFacturasFijas([...mesesAFechas("30525718626", 1, 1, 1, false), fac("30525718626", "2026-04-28", 999, 332, true)],
      [{ cuit: "30525718626", nombre: "AFA", facturasPorMes: 1 }], doce)
    chequear("Balance · proveedores fijos", "Una sola cargada a mano no lo vuelve «a mano» (corrección del usuario: AFA sí informa ARCA)",
      "ARCA", fAfa.aMano ? "a mano" : "ARCA", !fAfa.aMano, "A-FEAT-1332")
    const casosArchivo: Array<[Record<string, unknown>, boolean, string]> = [
      [{ origen_factura: "No Informada" }, true, "marcada No Informada"],
      [{ origen_factura: "ARCA", archivo_origen: "otros comprobantes No AFIP.xlsx" }, false, "marcada ARCA (manda la marca)"],
      [{ origen_factura: null, archivo_origen: "Mis Comprobantes Recibidos - CUIT 30617786016 - 25-12.xlsx" }, false, "bajada de Mis Comprobantes"],
      [{ origen_factura: null, archivo_origen: "Mis Comprobantes Recibidos - CUIT 30617786016 - no afip.xlsx" }, true, "Mis Comprobantes… no afip"],
      [{ origen_factura: null, archivo_origen: "- comprobantes Coop Tala - CUIT 30617786016.xlsx" }, true, "archivo armado a mano"],
    ]
    for (const [f, esperado, nombre] of casosArchivo) {
      chequear("Balance · proveedores fijos", `¿A mano? ${nombre} → ${esperado ? "sí" : "no"}`,
        esperado ? "sí" : "no", cargadaAMano(f) ? "sí" : "no", cargadaAMano(f) === esperado, "A-FEAT-1332")
    }
  }
  /**
   * 💵 **LAS FACTURAS EN DÓLARES ENTRAN AL LIBRO DIARIO EN PESOS — A-BUG-1316.**
   *
   * Caso REAL: Almacén Veterinario FC 3-2014 del 23/02/2026, USD 3.213,58 a 1.390. En la DDJJ de
   * IVA presentada figura por $4.466.876,20 (neto $3.854.470 · IVA $612.406,20). El libro diario es
   * la copia de ese subdiario, así que tiene que dar lo mismo. Con el código viejo entraba por 3.213,58.
   */
  {
    const usd = desdeArca({
      id: "av-2014", "año_contable": 2026, mes_contable: 2, fecha_emision: "2026-02-23",
      tipo_comprobante: 1, punto_venta: 3, numero_desde: 2014, cuit: "30714441082",
      denominacion_emisor: "ALMACEN VETERINARIO S.R.L.", moneda: "USD", tipo_cambio: "1390.00",
      imp_neto_gravado: "2773.00", imp_neto_no_gravado: "0", imp_op_exentas: "0",
      otros_tributos: "0", iva: "440.58", imp_total: "3213.58",
    })
    const r2 = (x: number) => Math.round(x * 100) / 100
    chequear("Balance · libro diario", "💵 Una factura en USD entra en PESOS, como en la DDJJ",
      "4466876.2", String(r2(usd.total)), r2(usd.total) === 4466876.2, "A-BUG-1316")
    chequear("Balance · libro diario", "Y convierte también neto e IVA, no sólo el total",
      "3854470 · 612406.2", `${r2(usd.neto_gravado)} · ${r2(usd.iva)}`,
      r2(usd.neto_gravado) === 3854470 && r2(usd.iva) === 612406.2, "A-BUG-1316")
    chequear("Balance · libro diario", "La moneda y la cotización quedan a la vista",
      "DOL · 1390 · USD 3213.58", `${usd.moneda} · ${usd.tipo_cambio} · USD ${usd.total_moneda_original}`,
      usd.moneda === "DOL" && usd.tipo_cambio === 1390 && usd.total_moneda_original === 3213.58, "A-BUG-1316")

    const pesos = desdeArca({ id: "p1", moneda: "$", tipo_cambio: "1.00", imp_total: "121", iva: "21", imp_neto_gravado: "100" })
    chequear("Balance · libro diario", "Una factura en pesos queda igual (no se multiplica por nada)",
      "121 · PES", `${pesos.total} · ${pesos.moneda}`, pesos.total === 121 && pesos.moneda === "PES", "A-BUG-1316")

    // ⚠️ Pesos con una cotización cargada por error: NO se multiplica (manda la moneda, no el TC).
    const pesosConTc = desdeArca({ id: "p2", moneda: "PES", tipo_cambio: "1390", imp_total: "121" })
    chequear("Balance · libro diario", "⚠️ Pesos con una cotización cargada por error no se infla",
      "121", String(pesosConTc.total), pesosConTc.total === 121, "A-BUG-1316")

    const filaExcel = hojaDeAsientosContables([usd], "25/26").find(f => f[6] === "ALMACEN VETERINARIO S.R.L.") ?? []
    chequear("Balance · export", "El Excel muestra Total en pesos y, al final, USD · 1390 · 3213,58",
      "4466876.2 | USD | 1390 | 3213.58", `${filaExcel[12]} | ${filaExcel[17]} | ${filaExcel[18]} | ${filaExcel[19]}`,
      filaExcel[12] === 4466876.2 && filaExcel[17] === "USD" && filaExcel[18] === 1390 && filaExcel[19] === 3213.58, "A-BUG-1316")
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

    // 🧨 A-BUG-1289 — el caso real: Rojas 2026 tiene «Anual» (desactivado, estimado en $20.941.123)
    //    y «Cuota» (la que se paga). Antes el libro sumaba las dos y el inmobiliario salía doble.
    const rojas = armarTemplatesDelEjercicio([
      { ...base, id: "anual", concepto: "Inmobiliario Anual Rojas", categ: "Impuesto inmobiliario", fecha: "2026-03-08", estado: "desactivado", monto: 20941123 },
      { ...base, id: "c1", concepto: "Inmobiliario Cuota Rojas", categ: "Impuesto inmobiliario", fecha: "2026-03-17", estado: "conciliado", monto: 2096673.6 },
    ], ej)
    chequear("Balance · templates", "🛑 Una cuota DESACTIVADA no es gasto: queda afuera del total y en su lista",
      "gasto 2096673.6 · 1 no incluida por 20941123",
      `gasto ${rojas.totalDebitos} · ${rojas.noIncluidas?.length ?? "?"} no incluida por ${rojas.totalNoIncluidas ?? "?"}`,
      rojas.totalDebitos === 2096673.6 && rojas.noIncluidas?.length === 1 && rojas.totalNoIncluidas === 20941123, "A-BUG-1289")

    // 💳 Una cuota PENDIENTE del ejercicio es gasto (venció) Y deuda al cierre, como una factura impaga.
    const impaga = armarTemplatesDelEjercicio([
      { ...base, id: "p", fecha: "2026-05-10", estado: "pendiente", monto: 45843.7 },
      { ...base, id: "q", fecha: "2026-04-10", estado: "conciliado", monto: 1000 },
    ], ej)
    chequear("Balance · templates", "💳 Una cuota PENDIENTE sigue en el gasto y además es deuda al cierre",
      "gasto 46843.7 · deuda 45843.7 (1 cuota)",
      `gasto ${impaga.totalDebitos} · deuda ${impaga.totalImpagas ?? "?"} (${impaga.impagasAlCierre?.length ?? "?"} cuota)`,
      impaga.totalDebitos === 46843.7 && impaga.totalImpagas === 45843.7 && impaga.impagasAlCierre?.length === 1, "A-BUG-1289")

    // ✍️ A-FEAT-1207 — los saldos del ejercicio anterior: los 3 que dio el usuario el 2026-10-18 suman
    //    $7.115.206,05; uno anulado no suma, y los de otra empresa u otro ejercicio no se mezclan.
    const aj = (id: string, concepto: string, monto: number, extra: Record<string, unknown> = {}) => ({
      id, empresa: "MSA", anio_cierre: 2026, accion: "saldo_anterior", concepto, categ: "Impuesto inmobiliario",
      monto, motivo: "Saldo que dejó el balance 2025", origen_anio_cierre: 2025, created_at: "2026-10-18", anulado_at: null, ...extra })
    const saldos = saldosDelEjercicioAnterior([
      aj("a", "Inmobiliario MSA 2025", 3154059.75),
      aj("b", "Complementario MSA 2025", 1519054.8, { categ: "Impuesto inmobiliario Complementario" }),
      aj("c", "Red Vial Rojas 2025", 2442091.5, { categ: "Impuesto Red Vial" }),
      aj("d", "cargado de más", 999, { anulado_at: "2026-10-18" }),
      aj("e", "de PAM", 500, { empresa: "PAM" }),
      aj("f", "de otro ejercicio", 700, { anio_cierre: 2027 }),
    ], "MSA", 2026)
    chequear("Balance · saldos ej. anterior", "✍️ Suman los vigentes del ejercicio; el anulado y los ajenos no",
      "3 vigentes · total 7115206.05 · 1 anulado",
      `${saldos.vigentes.length} vigentes · total ${saldos.total} · ${saldos.anulados.length} anulado`,
      saldos.vigentes.length === 3 && saldos.total === 7115206.05 && saldos.anulados.length === 1, "A-FEAT-1207")
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
  const impV = new Map([["v", { categ: "VENTA INVERNADA MACHO Y HEMBRA", nro_cuenta: "410805", centro_costo: "Recria", referencia: "11-75880", proveedor: null }]])
  const impF = new Map([["fc2014", { categ: "INSUMOS VETERINARIOS", nro_cuenta: "42307", centro_costo: null, referencia: "FC - 2014", proveedor: "ALMACEN VETERINARIO S.R.L." }]])
  const extG = filasExtractoEcheqs([chGenta], pagosG, impV, impF)
  chequear("Extracto de echeqs", "🏦 Un echeq endosado da DOS filas: entra con la cuenta de la venta, sale con la de la factura",
    "VENTA INVERNADA… +4466876.2 · INSUMOS VETERINARIOS −4466876.2",
    extG.map(f => `${f.categ} ${f.creditos ? "+" + f.creditos : "−" + f.debitos}`).join(" · "),
    extG.length === 2 && extG[0].categ === "VENTA INVERNADA MACHO Y HEMBRA" && extG[0].creditos === 4466876.2
      && extG[1].categ === "INSUMOS VETERINARIOS" && extG[1].debitos === 4466876.2 && extG[1].comprobante_arca_id === "fc2014", "A-FEAT-1230")
  // 📏 El estándar de registro (§ 30.9.6): cada dato en su columna, y el detalle sin repetir nada.
  chequear("Extracto de echeqs", "📏 Estándar: proveedor y comprobante en SUS columnas; el detalle sólo el número del echeq",
    "PEDRO GENTA Y CIA | 11-75880 | Echeq Nº 5-30526554562-0000233143_8360-1 · ALMACEN VETERINARIO S.R.L. | FC - 2014",
    `${extG[0].proveedor_nombre} | ${extG[0].comprobantes_pagados} | ${extG[0].detalle} · ${extG[1].proveedor_nombre} | ${extG[1].comprobantes_pagados}`,
    extG[0].proveedor_nombre === "PEDRO GENTA Y CIA" && extG[0].comprobantes_pagados === "11-75880" && extG[0].detalle === "Echeq Nº 5-30526554562-0000233143_8360-1"
      && extG[1].proveedor_nombre === "ALMACEN VETERINARIO S.R.L." && extG[1].comprobantes_pagados === "FC - 2014"
      && !extG.some(f => (f.detalle || "").includes("11-75880") || (f.detalle || "").includes("ALMACEN")), "A-FEAT-1230")
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


  // ══ 💵 UN PAGO EN PESOS CONTRA UNA FACTURA EN DÓLARES (A-BUG-1236) — la FC 2014 de Almacén ══
  // USD 3.213,58 × 1.390 = $4.466.876,20, pagada entera con el echeq de Genta.
  const fc2014 = { imp_total: 3213.58, monto_a_abonar: 3213.58, moneda: "USD" }
  const v2014 = calcularVinculacionPago({ anticipoMonto: 4466876.20, sicoreAnticipo: 0, descuento: 0, ...fc2014, tc: 1390, sobreSaldo: false })
  chequear("Dólares", "💵 El pago de $4.466.876,20 cubre la FC de USD 3.213,58 a 1.390 — comparando en PESOS",
    "cubre · 4466876.2", `${v2014.cubierto ? "cubre" : "no cubre"} · ${v2014.totalPesos}`, v2014.cubierto && v2014.totalPesos === 4466876.2, "A-BUG-1236")
  chequear("Dólares", "🧨 Lo que se guarda en la factura queda en DÓLARES (3.213,58), no en pesos (antes: 4.466.876,20)",
    "3213.58", String(v2014.montoAAbonarSiCubre), v2014.montoAAbonarSiCubre === 3213.58, "A-BUG-1236")
  const parcialUsd = calcularVinculacionPago({ anticipoMonto: 2000000, sicoreAnticipo: 0, descuento: 0, ...fc2014, tc: 1390, sobreSaldo: false })
  chequear("Dólares", "Pago parcial de $2.000.000: quedan $2.466.876,20 por pagar, guardados como USD 1.774,73",
    "no cubre · 2466876.2 · 1774.73", `${parcialUsd.cubierto ? "cubre" : "no cubre"} · ${parcialUsd.saldoPesos} · ${parcialUsd.montoAAbonarSiQueda}`,
    !parcialUsd.cubierto && parcialUsd.saldoPesos === 2466876.2 && parcialUsd.montoAAbonarSiQueda === 1774.73, "A-BUG-1236")
  const pesos = calcularVinculacionPago({ anticipoMonto: 1000, sicoreAnticipo: 20, descuento: 0, imp_total: 1500, monto_a_abonar: 1500, moneda: "PES", tc: 1390, sobreSaldo: false })
  chequear("Dólares", "Una factura en PESOS da lo mismo que antes (el TC no se usa): saldo 1500 − 1000 − 20 = 480",
    "480 · 1", `${pesos.saldoPesos} · ${pesos.tc}`, pesos.saldoPesos === 480 && pesos.tc === 1, "A-BUG-1236")
  chequear("Dólares", "El TC: el del pago si está; si no, el de la factura; en pesos, 1",
    "1405 · 1390 · 1", `${tcDeFactura({ moneda: "USD", tc_pago: 1405, tipo_cambio: 1390 })} · ${tcDeFactura({ moneda: "USD", tc_pago: null, tipo_cambio: 1390 })} · ${tcDeFactura({ moneda: "PES", tipo_cambio: 1390 })}`,
    tcDeFactura({ moneda: "USD", tc_pago: 1405, tipo_cambio: 1390 }) === 1405 && tcDeFactura({ moneda: "USD", tc_pago: null, tipo_cambio: 1390 }) === 1390 && tcDeFactura({ moneda: "PES", tipo_cambio: 1390 }) === 1, "A-BUG-1236")


  // ══ 🔁 COMPENSAR una venta con una factura del cliente (A-FEAT-1231) ═════════════════════════
  const conComp = armarDetalleCobro({ movimientos: [], anticipos: [
    { id: "comp", fecha_pago: "2026-02-26", monto: 279174.47, metodo_pago: "compensacion", estado_pago: "pagado", descripcion: "Compensación con su liquidación 77393" },
  ], compensaciones: [], retenciones: [] }, 279174.47)
  chequear("Detalle del cobro", "🔁 Una compensación cuenta como «compensación» (no como transferencia) y cierra",
    "compensacion · cierra", `${conComp.lineas[0].medio} · ${conComp.cierra ? "cierra" : "no"}`,
    conComp.lineas[0].medio === "compensacion" && conComp.cierra, "A-FEAT-1231")


  // ══ 🔄 CANCELACIÓN DE NC, mudada fuera de Pagos (A-FEAT-1232) — tiene que escribir LO MISMO que antes ══
  // Novitas, aplicada por el usuario el 2026-10-03 con el modal viejo: FC 12842 y NC 170 por $1.764.482,50.
  // En la base quedó: FC «Cancelada con NC 170», NC «Cancela FC 12842», las dos conciliadas con saldo 0.
  const fcNov = { id: "fc", cuit: "30678552980", tipo_comprobante: 1, numero_desde: 12842, denominacion_emisor: "NOVITAS SA", imp_total: 1764482.5 }
  const ncNov = { id: "nc", cuit: "30678552980", tipo_comprobante: 3, numero_desde: 170, denominacion_emisor: "NOVITAS SA", imp_total: -1764482.5 }
  const planNov = planCancelacionNC({ tipo: "fc_con_nc", facturas: [fcNov], disponibles: [ncNov], seleccionadas: new Set(["nc"]) })
  chequear("Notas de crédito", "🔄 Novitas, con la lógica mudada: lo MISMO que dejó el modal viejo en la base",
    "fc conciliado 0 «Cancelada con NC 170» · nc conciliado 0 «Cancela FC 12842»",
    planNov.map(c => `${c.id} ${c.cambios.estado} ${c.cambios.monto_a_abonar} «${c.cambios.detalle}»`).join(" · "),
    planNov.length === 2 && planNov[0].id === "fc" && planNov[0].cambios.estado === "conciliado" && planNov[0].cambios.detalle === "Cancelada con NC 170"
      && planNov[1].id === "nc" && planNov[1].cambios.detalle === "Cancela FC 12842" && planNov[1].cambios.monto_a_abonar === 0, "A-FEAT-1232")
  const planParcial = planCancelacionNC({ tipo: "fc_con_nc", facturas: [{ ...fcNov, imp_total: 2000000 }], disponibles: [ncNov], seleccionadas: new Set(["nc"]) })
  chequear("Notas de crédito", "Una NC que no cubre la factura: la factura baja a 235.517,50 y sigue pendiente",
    "235517.5 · sin estado", `${planParcial[0].cambios.monto_a_abonar} · ${planParcial[0].cambios.estado ?? "sin estado"}`,
    planParcial[0].cambios.monto_a_abonar === 235517.5 && planParcial[0].cambios.estado === undefined, "A-FEAT-1232")
  const planB = planCancelacionNC({ tipo: "nc_con_descuento", facturas: [{ ...ncNov, id: "nc789", numero_desde: 789 }],
    disponibles: [{ ...fcNov, id: "a", numero_desde: 5926 }, { ...fcNov, id: "b", numero_desde: 5930 }], seleccionadas: new Set(["a", "b"]) })
  chequear("Notas de crédito", "Escenario B (Alcorta): la NC queda conciliada con «Corresponde a descuentos aplicados FC 5926, 5930»",
    "Corresponde a descuentos aplicados FC 5926, 5930", planB[0].cambios.detalle,
    planB.length === 1 && planB[0].cambios.detalle === "Corresponde a descuentos aplicados FC 5926, 5930", "A-FEAT-1232")
  chequear("Notas de crédito", "Qué es una nota de crédito: tipos 3, 8, 13 sí; 1 (factura) no",
    "true true true false", [3, 8, 13, 1].map(esNotaCreditoArca).join(" "),
    esNotaCreditoArca(3) && esNotaCreditoArca(8) && esNotaCreditoArca(13) && !esNotaCreditoArca(1), "A-FEAT-1232")


  // El cartel muestra TODAS las NC pendientes (A-FEAT-1232, 2026-10-03): también la que no tiene factura.
  {
    const soloNC = [{ id: "n1", cuit: "1", display: "NC - 789", proveedor: "ALCORTA", tipoComprobante: 3, estado: "pendiente", importe: -55551.02 }]
    chequear("Notas de crédito", "Una NC sin factura por pagar: el aviso viejo la ignora; el cartel con acciones la muestra",
      "0 · 1", `${detectarProveedoresConNC(soloNC).length} · ${detectarProveedoresConNC(soloNC, { incluirSinFacturas: true }).length}`,
      detectarProveedoresConNC(soloNC).length === 0 && detectarProveedoresConNC(soloNC, { incluirSinFacturas: true }).length === 1, "A-FEAT-1232")
  }


  // El selector de año del Dashboard se arma solo (A-BUG-1237): antes terminaba en 2025.
  {
    const a = añosHastaElProximo(2022, "2026-10-03")
    chequear("Dashboard", "El selector de año va de 2022 al año en curso + 1",
      "2022…2027", `${a[0]}…${a[a.length - 1]}`, a[0] === 2022 && a[a.length - 1] === 2027 && a.includes(2026), "A-BUG-1237")
  }


  // ══ El balance propio (A-FEAT-1190) — con los números de SU planilla, fijos acá ═════════════
  {
    const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const v = (version: "jms" | "contador", d: Record<string, number>): ValorFoto[] =>
      Object.entries(d).map(([renglon, importe]) => ({ renglon: renglon.replace(/#.*/, ""), version, importe }))
    // Solapa NOTAS de «BAPU JMS USS 2025.xlsx», SIN las filas de PAM.
    const jms24 = v("jms", { caja: 682722.7, banco_galicia: 18499417.13, banco_santander: 35150.48, banco_provincia: 3360.93,
      ret_ganancias: 8944954.76, saldo_favor_iibb: 1342.34, anticipos_ganancias: 3846698.64, iva_libre_disponibilidad: 5389859.5,
      iva_saldo_tecnico: 2730598.82, impuesto_cheque: 4454609.88, deudores_ventas: 2448367.01, otros_creditos_comerciales: 81457200,
      cereales: 78378977.6, sementeras_ganaderas: 6454743.75, insumos_agricolas: 28923292.08, insumos_ganaderos: 9876195,
      stock_cria: 197625000, stock_recria: 52714000, proveedores: 23571319.29, ganancias_a_pagar: 29622717.96,
      cargas_sociales: 1344674.56, impuesto_diferido: 38029617.62 })
    const jms25 = v("jms", { dolares_mep: 28811048.46, distribucion_fondos: 11200207, banco_galicia: 832605.05, fci: 23244019.93,
      ret_ganancias: 13577503.78, perc_ganancias: 61910.75, saldo_favor_iibb: 2230667.45, anticipos_ganancias: 14474434.24,
      iva_libre_disponibilidad: 3765973.66, iva_saldo_tecnico: 5446163.83, impuesto_cheque: 11184300.93,
      otros_creditos_comerciales: 92655408.78, cereales: 2045386.32, sementeras_agricolas: 5660415.43, sementeras_ganaderas: 3830287.5,
      insumos_agricolas: 5299830, insumos_ganaderos: 26894811.38, stock_cria: 308090000, stock_recria: 97470000,
      proveedores: 4431467.73, ganancias_a_pagar: 12287931.74, cargas_sociales: 3415867.25, cheques_pendientes: 6064989.95,
      impuesto_diferido: 66802158.96 })
    // Las filas de PAM que la planilla sumaba (Galicia PAM y FCI PAM): agregadas, tiene que dar SU número.
    const pam24 = v("jms", { "banco_galicia#pam": 1743413.41 })
    const pam25 = v("jms", { "banco_galicia#pam": 454882.89, "fci#pam": 20634266.83 })
    const conPam = gananciaDelEjercicio({ valores: [...jms24, ...pam24], tc: 1365 }, { valores: [...jms25, ...pam25], tc: 1215 }, "jms")
    chequear("Balance propio", "Con las filas de PAM, la ganancia en pesos es la de SU planilla (corriente y total)",
      "201.992.675,33 · 173.220.133,99", `${fmt(conPam.pesosCorriente)} · ${fmt(conPam.pesosTotal)}`,
      cerca(conPam.pesosCorriente, 201992675.33, 0.01) && cerca(conPam.pesosTotal, 173220133.99, 0.01), "A-FEAT-1190")
    const msa = gananciaDelEjercicio({ valores: jms24, tc: 1365 }, { valores: jms25, tc: 1215 }, "jms")
    chequear("Balance propio", "MSA sola 24/25: los 4 resultados (pesos y US$, corriente y total)",
      "182.646.939,01 · 153.874.397,67 · US$ 190.839,32 · US$ 163.719,69",
      `${fmt(msa.pesosCorriente)} · ${fmt(msa.pesosTotal)} · US$ ${fmt(msa.usdCorriente ?? 0)} · US$ ${fmt(msa.usdTotal ?? 0)}`,
      cerca(msa.pesosCorriente, 182646939.01, 0.01) && cerca(msa.pesosTotal, 153874397.67, 0.01)
        && cerca(msa.usdCorriente ?? 0, 630574717.82 / 1215 - 447927778.81 / 1365, 0.01)
        && cerca(msa.usdTotal ?? 0, 563772558.86 / 1215 - 409898161.19 / 1365, 0.01), "A-FEAT-1190")
    // El contador: su activo − pasivo tiene que ser su patrimonio neto + el resultado (camino inverso).
    const cont = resultadosDeVersion(v("contador", { caja: 9903617.62, caja_dolares: 932000, banco_santander: 7204.86,
      banco_provincia: 15298.25, cheques_pendientes: 6064989.95, fci: 23244019.93, banco_galicia: 832605.05,
      banco_galicia_usd: 40776898.95, anticipos_ganancias: 14474434.24, ret_ganancias: 13577503.78, perc_ganancias: 61910.75,
      anticipos_proveedores: 31728000.07, cuenta_socios: 45905575.52, iva_saldo_tecnico: 5446163.83,
      iva_libre_disponibilidad: 3765973.66, impuesto_cheque: 11184300.93, saldo_favor_iibb: 2230667.45, cereales: 2045386.32,
      equinos: 536919.86, stock_cria: 255479054.9, sementeras_agricolas: 4738332.1, proveedores: 3543793.46,
      provision_gastos: 12456000.14, tarjetas: 887674.27, cargas_sociales: 3415867.25, cuota_solidaria: 90621.62,
      ganancias_a_pagar: 12287931.74, impuesto_diferido: 66802158.96, bienes_uso_neto: 417164580.02 }), "contador")
    chequear("Balance propio", "Contador 30/06/25: activo − pasivo = patrimonio neto + resultado de su balance",
      "778.501.410,70", fmt(cont.netoTotal), cerca(cont.netoTotal, 626977326.43 + 151524084.27, 0.01), "A-FEAT-1190")
    const raro = resultadosDeVersion([{ renglon: "no_existe", version: "jms", importe: 5 }], "jms")
    chequear("Balance propio", "Un renglón fuera del catálogo se avisa, no se descarta en silencio",
      "1 desconocido, activo 0", `${raro.desconocidos.length} desconocido, activo ${raro.activo}`,
      raro.desconocidos.length === 1 && raro.activo === 0, "A-FEAT-1190")
    chequear("Balance propio", "Sin TC no hay dólares (null, no cero) · monto vacío = sin valor",
      "null · null · 1234567,89", `${enDolares(cont, null)} · ${parsearMonto("  ")} · ${parsearMonto("1.234.567,89")}`,
      enDolares(cont, null) === null && parsearMonto("  ") === null && parsearMonto("1.234.567,89") === 1234567.89, "A-FEAT-1190")
  }


  // ══ La foto que se arma sola: la versión «sistema» (A-FEAT-1190) ═══════════════════════════
  {
    const { valores: p } = propuestaDelSistema({
      saldos: [{ nombre: "BANCO GALICIA (cta cte)", saldo: -2261369.97 }, { nombre: "CAJA GENERAL", saldo: 1000 }, { nombre: "CAJA AMS", saldo: null }],
      cuentasAPagar: { total: 500, totalSinDato: 0 }, cuentasACobrar: { total: 0, totalSinDato: 0 },
      cheques: { total: 300, totalSinFecha: 50 },
      anticipos: { totalAProveedores: 13400000, totalDeClientes: 133800000 },
      hacienda: [{ categoria: "Vaca", cabezas: 100, valorTotal: 90000000 }, { categoria: "Ternero Recria", cabezas: 40, valorTotal: 20000000 },
        { categoria: "Ternera Recria", cabezas: 10, valorTotal: null }, { categoria: "Toro", cabezas: 0, valorTotal: 0 }],
      insumos: [{ ambito: "agricola", valuado: 10, huecos: 0 }, { ambito: "ambos", valuado: 7, huecos: 2 }],
      granosNetoFinal: null,
    })
    const de = (r: string) => p.find(x => x.renglon === r)
    chequear("Balance propio — sistema", "Reparte los papeles en los renglones; el cero no se propone; lo que falta se dice",
      "galicia −2.261.369,97 · caja 1000 (1 sin saldo) · cobrar no · anticipo cliente como deuda · recría 20 M con Ternera sin precio",
      `galicia ${de("banco_galicia")?.importe} · caja ${de("caja")?.importe} · cobrar ${de("deudores_ventas") ? "sí" : "no"} · cliente ${de("anticipos_clientes")?.importe} · recría ${de("stock_recria")?.importe}`,
      de("banco_galicia")?.importe === -2261369.97 && de("caja")?.importe === 1000 && /1 sin saldo/.test(de("caja")?.detalle ?? "")
        && !de("deudores_ventas") && de("anticipos_clientes")?.importe === 133800000 && de("anticipos_proveedores")?.importe === 13400000
        && de("stock_recria")?.importe === 20000000 && /Ternera Recria \(10\)/.test(de("stock_recria")?.detalle ?? "")
        && de("stock_cria")?.importe === 90000000 && de("insumos_otros")?.importe === 7 && !de("cereales"), "A-FEAT-1190")
    const vals: ValorFoto[] = [
      { renglon: "banco_galicia", version: "sistema", importe: 100 }, { renglon: "stock_cria", version: "sistema", importe: 900 },
      { renglon: "stock_cria", version: "jms", importe: 1200 }, { renglon: "caja", version: "contador", importe: 5 },
    ]
    const ej = valoresEfectivos(vals, "jms")
    chequear("Balance propio — sistema", "JMS vacío toma el del sistema; lo escrito manda; el contador no hereda nada",
      "JMS activo 1300 · contador activo 5", `JMS activo ${resultadosDeVersion(vals, "jms").activo} · contador activo ${resultadosDeVersion(vals, "contador").activo}`,
      ej.length === 2 && resultadosDeVersion(vals, "jms").activo === 1300 && resultadosDeVersion(vals, "contador").activo === 5, "A-FEAT-1190")
    const cambios = cambiosContraLoGuardado(
      [{ renglon: "banco_galicia", version: "sistema", importe: 100 }, { renglon: "caja", version: "sistema", importe: 7 }, { renglon: "fci", version: "sistema", importe: 1 }],
      [{ renglon: "banco_galicia", importe: 100, detalle: "" }, { renglon: "caja", importe: 9, detalle: "" }, { renglon: "cereales", importe: 3, detalle: "" }])
    chequear("Balance propio — sistema", "Avisa lo que cambió desde la foto (cambió, desapareció, apareció) y calla lo igual",
      "caja 7→9 · fci 1→— · cereales —→3", cambios.map(c => `${c.renglon} ${c.guardado ?? "—"}→${c.hoy ?? "—"}`).join(" · "),
      cambios.length === 3 && !cambios.some(c => c.renglon === "banco_galicia"), "A-FEAT-1190")
  }


  // ══ Balance propio — créditos impositivos, tarjeta, FCI, echeqs (A-FEAT-1190, 2026-10-03) ════
  {
    // La tarjeta con los datos reales: el último resumen cargado cierra el 28/05 y vence el 08/06.
    const res = [{ cierre: "2026-04-30", vencimiento: "2026-05-11", total: 2030886.25 }, { cierre: "2026-05-28", vencimiento: "2026-06-08", total: 2047532.73 }]
    const t1 = deudaDeTarjeta(res, [{ fecha: "2026-05-20", importe: 100, cierreResumen: "2026-05-28" }], "2026-06-30")
    chequear("Balance propio — tarjeta", "Sin el resumen de junio cargado: deuda 0 conocida y lo DICE (no un cero callado)",
      "0 · falta el resumen posterior al 2026-05-28", `${t1.deuda} · ${t1.falta ? "falta " + (t1.falta.match(/después del (\S+?):/)?.[1] ?? "") : "nada"}`,
      t1.deuda === 0 && !!t1.falta && t1.falta.includes("2026-05-28"), "A-FEAT-1190")
    const t2 = deudaDeTarjeta([...res, { cierre: "2026-06-25", vencimiento: "2026-07-06", total: 1900000 }],
      [{ fecha: "2026-06-28", importe: 5000, cierreResumen: "2026-07-30" }, { fecha: "2026-07-02", importe: 999, cierreResumen: "2026-07-30" }], "2026-06-30")
    chequear("Balance propio — tarjeta", "Con el de junio: su total (vence en julio) + los consumos del 26 al 30/06",
      "1.905.000 · sin falta", `${t2.deuda} · ${t2.falta ? "falta" : "sin falta"}`, t2.deuda === 1905000 && t2.falta === null, "A-FEAT-1190")
    chequear("Balance propio — IVA", "Una nota de crédito resta su IVA, venga guardada en positivo o negativo",
      "100", String(ivaConSigno([{ tipo: 1, iva: 210 }, { tipo: 3, iva: 21 }, { tipo: 3, iva: -89 }])),
      ivaConSigno([{ tipo: 1, iva: 210 }, { tipo: 3, iva: 21 }, { tipo: 3, iva: -89 }]) === 100, "A-FEAT-1190")
    const { valores: v, faltan } = propuestaDelSistema({
      retenciones: { ganancias: 2504350.46, iibb: 1013288.8, iva: 277103.83, detalle: "x" },
      iva: { creditoFiscal: 1000, debitoFiscal: 7000, tecnicoInicio: 5446163.83 },
      echeqsCartera: 0,
      tarjeta: t1,
      fci: { cuotapartes: null, valorCuotaparte: null, suscripciones: 10, rescates: 5 },
    })
    const de = (r: string) => v.find(x => x.renglon === r)?.importe
    chequear("Balance propio — créditos", "Retenciones sufridas e IVA arrastrado entran como crédito; FCI y tarjeta incompletos se piden",
      "gan 2.504.350,46 · iibb 1.013.288,80 · iva ret 277.103,83 · técnico 5.440.163,83 · 2 faltan",
      `gan ${de("ret_ganancias")} · iibb ${de("ret_iibb")} · iva ret ${de("ret_iva")} · técnico ${de("iva_saldo_tecnico")} · ${faltan.length} faltan`,
      de("ret_ganancias") === 2504350.46 && de("ret_iibb") === 1013288.8 && de("ret_iva") === 277103.83
        && de("iva_saldo_tecnico") === 5440163.83 && de("echeqs_cartera") === undefined && faltan.length === 2
        && faltan.some(f => f.startsWith("Fondo común")) && faltan.some(f => f.startsWith("Tarjeta")), "A-FEAT-1190")
    const { valores: v2 } = propuestaDelSistema({
      iva: { creditoFiscal: 0, debitoFiscal: 100, tecnicoInicio: 40 },
      fci: { cuotapartes: 1000, valorCuotaparte: 25.5, suscripciones: 0, rescates: 0 },
    })
    chequear("Balance propio — créditos", "IVA que da negativo pasa a deuda; FCI = cuotapartes × valor",
      "IVA a pagar 60 · FCI 25.500", `IVA a pagar ${v2.find(x => x.renglon === "iva_a_pagar")?.importe} · FCI ${v2.find(x => x.renglon === "fci")?.importe}`,
      v2.find(x => x.renglon === "iva_a_pagar")?.importe === 60 && v2.find(x => x.renglon === "fci")?.importe === 25500
        && !v2.some(x => x.renglon === "iva_saldo_tecnico"), "A-FEAT-1190")
  }


  // ══ Impuesto al cheque (Ley 25.413), total y desglosado (A-FEAT-1190) ═══════════════════════
  {
    // Las tres descripciones reales del Galicia, más un reintegro y un movimiento cualquiera.
    const movs = [
      { fecha: "2026-02-04", descripcion: "Imp. Cre. Ley 25413", categ: "Debitos / Creditos", debitos: 1000, creditos: 0 },
      { fecha: "2026-02-05", descripcion: "Imp. Deb. Ley 25413 Gral.", categ: "Debitos / Creditos", debitos: 600, creditos: 0 },
      { fecha: "2026-03-18", descripcion: "Impuesto Deb.ley 25413 Extrac. Efect.", categ: "Debitos / Creditos", debitos: 400, creditos: 0 },
      { fecha: "2026-03-20", descripcion: "Imp. Deb. Ley 25413 Gral.", categ: "Debitos / Creditos", debitos: 0, creditos: 100 },
      { fecha: "2026-03-21", descripcion: "Transferencia a terceros", categ: "PROVEEDORES", debitos: 99999, creditos: 0 },
    ]
    const ic = armarImpuestoCheque(movs, ["2026-01", "2026-02", "2026-03"], pctComputable("MA").general, pctComputable("MA").efectivo)
    const icMsa = armarImpuestoCheque(movs, ["2026-01", "2026-02", "2026-03"], pctComputable("MSA").general, pctComputable("MSA").efectivo)
    chequear("Impuesto al cheque", "MSA computa el 100 % (su categoría de empresa): computable = todo lo pagado",
      "1900", String(icMsa.computable), icMsa.computable === 1900 && icMsa.computable === icMsa.total.total, "A-FEAT-1190")
    chequear("Impuesto al cheque", "Desglosa créditos / débitos / efectivo, el reintegro resta, lo demás no entra",
      "créd 1000 · déb 500 · efect 400 · total 1900", `créd ${ic.total.creditos} · déb ${ic.total.debitos} · efect ${ic.total.efectivo} · total ${ic.total.total}`,
      ic.total.creditos === 1000 && ic.total.debitos === 500 && ic.total.efectivo === 400 && ic.total.total === 1900, "A-FEAT-1190")
    chequear("Impuesto al cheque", "Computable: 33 % de créditos + débitos y 20 % del efectivo; enero sin extracto se avisa",
      "575 · sin extracto 2026-01", `${ic.computable} · sin extracto ${ic.mesesSinExtracto.join(",")}`,
      ic.computable === 575 && ic.mesesSinExtracto.join(",") === "2026-01", "A-FEAT-1190")
    const { valores: v, faltan } = propuestaDelSistema({
      impuestoCheque: { computable: ic.computable, total: ic.total.total, mesesSinExtracto: ic.mesesSinExtracto },
      anticiposGanancias: { total: 0, cuotas: 7, detalle: "x" },
    })
    chequear("Impuesto al cheque", "Lo computable va a la foto como crédito; el mes sin extracto se pide; anticipos en 0 no se proponen",
      "impuesto_cheque 575 · 1 falta · sin anticipos", `impuesto_cheque ${v.find(x => x.renglon === "impuesto_cheque")?.importe} · ${faltan.length} falta · ${v.some(x => x.renglon === "anticipos_ganancias") ? "con" : "sin"} anticipos`,
      v.find(x => x.renglon === "impuesto_cheque")?.importe === 575 && faltan.length === 1 && !v.some(x => x.renglon === "anticipos_ganancias"), "A-FEAT-1190")
  }


  // ══ El pago de cada resumen de tarjeta (A-DEC-1002) — con los números reales de MSA ════════
  {
    const res = [
      { nr: "R04", cierre: "2026-04-30", vencimiento: "2026-05-11", total: 2030886.25 },
      { nr: "R05", cierre: "2026-05-28", vencimiento: "2026-06-08", total: 2047532.73 },
    ]
    const deb = [
      { id: "d1", tabla: "public.msa_galicia", fecha: "2026-05-11", debitos: 2030886.25, nro_resumen: null, descripcion: "Pago Visa Empresa" },
      { id: "d2", tabla: "public.msa_galicia", fecha: "2026-06-08", debitos: 2047532.73, nro_resumen: null, descripcion: "Pago Visa Empresa" },
    ]
    const su = [{ id: "s1", nr: "R05", creditos: 2030886.25, estado: "pendiente" }]
    const p1 = pagosDeResumenes(res, deb, su, "2026-10-03")
    chequear("Tarjeta — pago del resumen", "Sin vincular: cada resumen encuentra SU débito (por importe y fecha) y lo propone",
      "R04→d1 · R05→d2", `R04→${p1.get("R04")?.propuesto?.id} · R05→${p1.get("R05")?.propuesto?.id}`,
      p1.get("R04")?.estado === "propuesto" && p1.get("R04")?.propuesto?.id === "d1" && p1.get("R05")?.propuesto?.id === "d2", "A-DEC-1002")
    const p2 = pagosDeResumenes(res, deb.map(d => d.id === "d1" ? { ...d, nro_resumen: "R04" } : d), su, "2026-10-03")
    chequear("Tarjeta — pago del resumen", "Vinculado: total del resumen = débito = SU PAGO del siguiente → pagado, sin avisos",
      "pagado · 0 avisos", `${p2.get("R04")?.estado} · ${p2.get("R04")?.avisos.length} avisos`,
      p2.get("R04")?.estado === "pagado" && p2.get("R04")?.avisos.length === 0, "A-DEC-1002")
    const p3 = pagosDeResumenes(res, deb.map(d => d.id === "d1" ? { ...d, nro_resumen: "R04", debitos: 2000000 } : d), su, "2026-10-03")
    chequear("Tarjeta — pago del resumen", "Pagado de menos: se vincula igual y AVISA las dos diferencias (contra el total y contra el SU PAGO)",
      "con_diferencia · 2 avisos", `${p3.get("R04")?.estado} · ${p3.get("R04")?.avisos.length} avisos`,
      p3.get("R04")?.estado === "con_diferencia" && p3.get("R04")?.avisos.length === 2, "A-DEC-1002")
    const p4 = pagosDeResumenes([...res, { nr: "R06", cierre: "2026-06-25", vencimiento: "2026-07-06", total: 1900000 }], deb, su, "2026-10-03")
    chequear("Tarjeta — pago del resumen", "Un resumen vencido sin débito en la cuenta corriente se marca y se dice",
      "vencido_sin_pago", String(p4.get("R06")?.estado), p4.get("R06")?.estado === "vencido_sin_pago" && (p4.get("R06")?.avisos.length ?? 0) === 1, "A-DEC-1002")
  }


  // ══ Cash Flow: tipo de comprobante, número y ventana hacia atrás (A-FEAT-170 / A-FEAT-1237) ══
  {
    const et = [
      etiquetaTipoComprobante({ origen: "ARCA", tipo_comprobante: 1 }),
      etiquetaTipoComprobante({ origen: "ARCA", tipo_comprobante: 3 }),
      etiquetaTipoComprobante({ origen: "ARCA", tipo_comprobante: 11 }),
      etiquetaTipoComprobante({ origen: "ARCA", tipo_comprobante: 7 }),
      etiquetaTipoComprobante({ origen: "TEMPLATE" }),
      etiquetaTipoComprobante({ origen: "ARCA", tipo_comprobante: null, facturas_agrupadas: 3 }),
      etiquetaTipoComprobante({ origen: "VENTA", tipo_comprobante: 60 }),
    ]
    chequear("Cash Flow — filtros", "El chip de comprobante nombra tipo y letra (FC A, NC A, FC C, ND B) y separa lo que no es factura",
      "FC A · NC A · FC C · ND B · Sin comprobante · Grupo (tipos mezclados) · Liquidación", et.join(" · "),
      et.join("|") === "FC A|NC A|FC C|ND B|Sin comprobante|Grupo (tipos mezclados)|Liquidación", "A-FEAT-170")
    const f = { comprobante_display: "FC A 00001-00012842", numero_desde: 12842, punto_venta: 1 }
    chequear("Cash Flow — filtros", "Buscar por número encuentra «12842», «00012842» y «0001-00012842»; con menos de 3 dígitos no busca",
      "sí · sí · sí · no · no", [coincideNumeroComprobante(f, "12842"), coincideNumeroComprobante(f, "00012842"), coincideNumeroComprobante(f, "0001-00012842"), coincideNumeroComprobante(f, "99999"), coincideNumeroComprobante(f, "12")].map(x => x ? "sí" : "no").join(" · "),
      coincideNumeroComprobante(f, "12842") && coincideNumeroComprobante(f, "00012842") && coincideNumeroComprobante(f, "0001-00012842") && !coincideNumeroComprobante(f, "99999") && !coincideNumeroComprobante(f, "12"), "A-FEAT-170")
    const d2s = desdeVentana("2026-10-04", "semana", 2), d1m = desdeVentana("2026-10-04", "mes", 1), d3m = desdeVentana("2026-03-31", "mes", 3)
    chequear("Cash Flow — filtros", "La ventana: 2 semanas antes del 04/10 es el 20/09; 1 mes, el 04/09; lo de antes se esconde, lo sin fecha no",
      "2026-09-20 · 2026-09-04 · fuera · adentro · sin fecha adentro", `${d2s} · ${d1m} · ${pasaVentana("2026-09-01", d1m) ? "adentro" : "fuera"} · ${pasaVentana("2026-11-15", d1m) ? "adentro" : "fuera"} · sin fecha ${pasaVentana(null, d1m) ? "adentro" : "fuera"}`,
      d2s === "2026-09-20" && d1m === "2026-09-04" && !pasaVentana("2026-09-01", d1m) && pasaVentana("2026-11-15", d1m) && pasaVentana(null, d1m) && d3m === "2025-12-31", "A-FEAT-1237")
  }


  // ══ A-BUG-191: al conciliar, la fecha de pago es la del movimiento — completa, no pisa ═══════
  {
    // Un cliente falso que anota qué se le pidió (cero escritura real: § lib/pruebas).
    const pedido: Record<string, unknown> = {}
    const falso = { schema: (sch: string) => ({ from: (t: string) => ({
      update: (v: unknown) => { Object.assign(pedido, { sch, t, v }); return {
        in: (_c: string, ids: string[]) => { pedido.ids = ids; return {
          is: (col: string, val: unknown) => { pedido.soloVacias = col === "fecha_pago" && val === null; return Promise.resolve({ count: 2, error: null }) },
        } },
      } },
    }) }) }
    // El pedido se arma sincrónico: se mira apenas se llama (los casos no esperan promesas).
    void completarFechaPago(falso, "msa", ["a", "b"], "2026-07-13T00:00:00")
    const conFecha = { ...pedido }
    for (const k of Object.keys(pedido)) delete pedido[k]
    void completarFechaPago(falso, "msa", ["a"], null)
    const sinFechaPidio = Object.keys(pedido).length > 0
    chequear("Conciliación — fecha de pago", "Escribe la fecha del movimiento SÓLO donde la factura no tiene (no pisa la que hay), y sin fecha no escribe nada",
      "msa · 2026-07-13 · a,b · sólo vacías · sin fecha: nada", `${conFecha.sch} · ${(conFecha.v as any)?.fecha_pago} · ${(conFecha.ids as string[])?.join(",")} · ${conFecha.soloVacias ? "sólo vacías" : "PISA"} · sin fecha: ${sinFechaPidio ? "ESCRIBIÓ" : "nada"}`,
      conFecha.sch === "msa" && (conFecha.v as any)?.fecha_pago === "2026-07-13" && conFecha.soloVacias === true && !sinFechaPidio, "A-BUG-191")
  }


  // ══ Stock de insumos: búsqueda, categorías y «sólo con stock» (A-FEAT-1243) ══════════════════
  {
    const st = [
      { producto: "Maíz granel", observaciones: null, cantidad: 12000, categorias_insumo: { nombre: "Alimento" } },
      { producto: "Ivermectina", observaciones: "vencimiento dic", cantidad: 0, categorias_insumo: { nombre: "Veterinario" } },
      { producto: "Núcleo vitamínico", observaciones: null, cantidad: 300, categorias_insumo: { nombre: "Alimento" } },
      { producto: "Gas oil", observaciones: null, cantidad: 1500, categorias_insumo: null },
    ]
    const a = filtrarStock(st, { busqueda: "nucleo", categorias: new Set(), soloConStock: false }).map(x => x.producto)
    const b = filtrarStock(st, { busqueda: "", categorias: new Set(["Alimento"]), soloConStock: false }).length
    const c = filtrarStock(st, { busqueda: "", categorias: new Set(), soloConStock: true }).length
    const d = filtrarStock(st, { busqueda: "", categorias: new Set(["(sin categoría)"]), soloConStock: false }).map(x => x.producto)
    chequear("Stock de insumos — filtros", "Busca sin tildes, filtra por categoría, «sólo con stock» saca el de 0, y lo sin categoría tiene su chip",
      "Núcleo vitamínico · 2 · 3 · Gas oil", `${a.join(",")} · ${b} · ${c} · ${d.join(",")}`,
      a.join(",") === "Núcleo vitamínico" && b === 2 && c === 3 && d.join(",") === "Gas oil", "A-FEAT-1243")
  }

  // ══ Planilla de asistencia: francos trabajados (A-FEAT-1259) ═══════════════════════════════════
  // Febrero 2026: 28 días, empieza domingo → 4 sábados y 4 domingos. Sin feriados (salvo el caso que los pone),
  // es el ejemplo del usuario: «4 sáb y 4 dom → se debería haber tomado 6 francos».
  {
    const sinFer = new Set<string>()
    const feb = diasDelMes(2026, 2)
    const todoP: Record<string, Marca> = Object.fromEntries(feb.map(d => [d, "P" as Marca]))
    const lo_normal: Record<string, Marca> = Object.fromEntries(feb.map(d => {
      const t = tipoDia(d, sinFer); return [d, (t === "sabado" ? "M" : t === "domingo" ? "F" : "P") as Marca]
    }))
    const a = resumirMes(2026, 2, lo_normal, sinFer)
    chequear("Asistencia — francos", "Mes de 4 sáb + 4 dom: le corresponden 6; si se tomó medio sábado y el domingo, francos trabajados = 0",
      "corresp 6 · tomados 6 · trabajados 0", `corresp ${a.corresponden} · tomados ${a.tomados} · trabajados ${a.francosTrabajados}`,
      a.corresponden === 6 && a.tomados === 6 && a.francosTrabajados === 0 && a.completo, "A-FEAT-1259")

    const b = resumirMes(2026, 2, todoP, sinFer)
    const cMarcas = { ...lo_normal, "2026-02-10": "F" as Marca }                 // martes: falta
    const c = resumirMes(2026, 2, cMarcas, sinFer)
    const dMarcas = { ...lo_normal, "2026-02-08": "P" as Marca, "2026-02-14": "P" as Marca }   // trabajó un domingo y un sábado entero
    const d = resumirMes(2026, 2, dMarcas, sinFer)
    chequear("Asistencia — francos", "Todo presente suma 6; faltar un martes resta 1; domingo entero +1 y sábado entero +½",
      "6 · −1 · 1,5", `${b.francosTrabajados} · ${c.francosTrabajados} · ${d.francosTrabajados}`,
      b.francosTrabajados === 6 && c.francosTrabajados === -1 && d.francosTrabajados === 1.5, "A-FEAT-1259")

    // Feriado = domingo. Carnaval 16 y 17/02 (lunes y martes): con P en esos días suman 1 cada uno.
    const conFer = new Set(["2026-02-16", "2026-02-17"])
    const e = resumirMes(2026, 2, lo_normal, conFer)
    // Un sábado feriado también es domingo: el 14/02 marcado ½ suma ½ (en vez de 0).
    const f = resumirMes(2026, 2, lo_normal, new Set(["2026-02-14"]))
    chequear("Asistencia — feriados", "Feriado trabajado vale como domingo (+1); un sábado feriado con ½ suma ½",
      "corresp 8 · trabajados 2 · sábado feriado ½", `corresp ${e.corresponden} · trabajados ${e.francosTrabajados} · sábado feriado ${f.francosTrabajados}`,
      e.corresponden === 8 && e.francosTrabajados === 2 && f.francosTrabajados === 0.5, "A-FEAT-1259")

    // V y L no suman ni restan: una semana de vacaciones de lunes a domingo no cambia el resultado.
    const gMarcas = { ...lo_normal }
    for (const dd of ["2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", "2026-02-06", "2026-02-07", "2026-02-08"]) gMarcas[dd] = "V"
    gMarcas["2026-02-20"] = "L"
    const g = resumirMes(2026, 2, gMarcas, sinFer)
    chequear("Asistencia — V y L", "Vacaciones y licencia quedan fuera de la cuenta: no suman ni restan",
      "trabajados 0 · V 7 · L 1", `trabajados ${g.francosTrabajados} · V ${g.vacaciones} · L ${g.licencias}`,
      g.francosTrabajados === 0 && g.vacaciones === 7 && g.licencias === 1, "A-FEAT-1259")

    // Vacíos: el mes queda incompleto. Y llenar con P no pisa lo marcado ni sale del contrato.
    const h = resumirMes(2026, 2, { "2026-02-01": "F" }, sinFer)
    const contrato = { fecha_ingreso: "2026-02-15" }
    const lleno = llenarConPresente(2026, 2, { "2026-02-15": "F" }, contrato)
    const i = resumirMes(2026, 2, { "2026-02-15": "F", ...lleno }, sinFer, contrato)
    chequear("Asistencia — vacíos y contrato", "Con días vacíos el mes queda incompleto; «Llenar con P» respeta lo marcado y sólo llena los días del contrato",
      "incompleto 27 · llena 13 · el 15 sigue F · días 14 · trabajados 2 (sáb 21 y 28 +½, dom 22 +1)", `${h.completo ? "completo" : "incompleto"} ${h.sinMarcar} · llena ${Object.keys(lleno).length} · el 15 sigue ${lleno["2026-02-15"] ?? "F"} · días ${i.dias} · trabajados ${i.francosTrabajados}`,
      !h.completo && h.sinMarcar === 27 && Object.keys(lleno).length === 13 && !lleno["2026-02-15"] && i.dias === 14 && i.francosTrabajados === 2, "A-FEAT-1259")
  }

  // ══ Planilla: «Llenar con F» y el jornal (A-FEAT-1259, 2026-10-09) ══════════════════════════════
  // Pedido del usuario: «que se pueda anotar también presente y llenar resto con F, por casos al revés».
  // Y los de jornal (Elvio, Vulcano): «cuántos días trabajaron por mes × el monto diario… si tienen 10,5 u 11 se computa eso».
  {
    const sinFer = new Set<string>()
    // Jornalero en febrero 2026: vino 10 días enteros y uno medio; el resto F.
    const vino: Record<string, Marca> = { "2026-02-02": "P", "2026-02-03": "P", "2026-02-04": "P", "2026-02-05": "P", "2026-02-06": "P",
      "2026-02-09": "P", "2026-02-10": "P", "2026-02-11": "P", "2026-02-12": "P", "2026-02-13": "P", "2026-02-14": "M" }
    const resto = llenarCon(2026, 2, vino, {}, "F")
    const r = resumirMes(2026, 2, { ...vino, ...resto }, sinFer)
    const jornal = { monto_a: null, monto_b: null, francos_cantidad: null, valor_franco: null, valor_por_dia: 60000,
      dias_trabajados: null, valor_por_hora: null, horas_mes: null, varios: 0, vacaciones: null, premio: null, aguinaldo_a: null, aguinaldo_b: null }
    const bruto = brutoDelPeriodo("por_dia", jornal, { dias_trabajados: r.diasTrabajados })
    chequear("Asistencia — llenar con F y jornal", "«Llenar con F» pone F en los 17 vacíos sin tocar lo marcado; el jornalero suma 10,5 días y cobra 10,5 × 60.000",
      "F 17 · completo · 10,5 días · 630000", `F ${Object.keys(resto).length} · ${r.completo ? "completo" : "incompleto"} · ${String(r.diasTrabajados).replace(".", ",")} días · ${bruto}`,
      Object.keys(resto).length === 17 && Object.values(resto).every(m => m === "F") && r.completo && r.diasTrabajados === 10.5 && bruto === 630000, "A-FEAT-1259")
  }

  // ══ 📜 Extracto histórico jul-25 → ene-26 (A-DEC-1009) ══════════════════════════════════════════
  {
    // 🧨 Antes, desvincular devolvía SIEMPRE la cuota a «pendiente»: una cuota «anterior» revivía en el Cash Flow.
    const antesSiempre = (_e: string) => "pendiente"
    chequear("Extracto histórico", "🧨 Desvincular un movimiento de una cuota «anterior» la deja «anterior» (antes volvía a pendiente y reaparecía en el Cash Flow); una conciliada sí vuelve a pendiente",
      "anterior · pendiente · pendiente · antes: pendiente", `${estadoCuotaAlDesvincular("anterior")} · ${estadoCuotaAlDesvincular("conciliado")} · ${estadoCuotaAlDesvincular(null)} · antes: ${antesSiempre("anterior")}`,
      estadoCuotaAlDesvincular("anterior") === "anterior" && estadoCuotaAlDesvincular(" Anterior ") === "anterior" && estadoCuotaAlDesvincular("conciliado") === "pendiente" && estadoCuotaAlDesvincular(null) === "pendiente", "A-DEC-1009")
    const filas = [
      { estado: "conciliado", categ: "Expensas Libertad", revisado: true },
      { estado: "pendiente", categ: null, revisado: false },
      { estado: "historico", categ: null, revisado: null },
      { estado: "historico", categ: null, revisado: null },
      { estado: "auditar", categ: "", revisado: true },
    ]
    const e = contarEstadisticasExtracto(filas)
    // 🧨 Antes «Sin CATEG» contaba también los históricos (que no tienen categoría hasta revisar su lote).
    const sinCategAntes = filas.filter(m => !m.categ || m.categ === "").length
    chequear("Extracto histórico", "🧨 Los históricos se cuentan aparte y no inflan «Sin CATEG» ni «sin revisar» (antes Sin CATEG daba 4 con 2 históricos)",
      "total 5 · históricos 2 · sin categ 2 · sin revisar 1 · antes 4", `total ${e.total} · históricos ${e.historicos} · sin categ ${e.sin_categ} · sin revisar ${e.sin_revisar} · antes ${sinCategAntes}`,
      e.total === 5 && e.historicos === 2 && e.sin_categ === 2 && e.sin_revisar === 1 && e.conciliados === 1 && e.pendientes === 1 && e.auditar === 1 && sinCategAntes === 4 && esHistorico("Historico") && !esHistorico("pendiente"), "A-DEC-1009")
  }

  // ══ El bruto de un período: una sola fórmula (A-FEAT-1259) ══════════════════════════════════════
  {
    const sigot = { monto_a: 1408347.10, monto_b: 191652.90, francos_cantidad: 0, valor_franco: null, valor_por_dia: null,
      dias_trabajados: null, valor_por_hora: null, horas_mes: null, varios: 0, vacaciones: null, premio: null, aguinaldo_a: null, aguinaldo_b: null }
    const conDos = brutoDelPeriodo("ab_francos", sigot, { francos_cantidad: 2 })
    const conMenosUno = brutoDelPeriodo("ab_francos", sigot, { francos_cantidad: -1 })
    const override = brutoDelPeriodo("ab_francos", { ...sigot, valor_franco: 70000 }, { francos_cantidad: 2 })
    chequear("Sueldos — bruto", "A+B 1.600.000 con franco automático (÷25 = 64.000): 2 francos suman 128.000, −1 resta 64.000; con franco fijo 70.000 usa ese",
      "1728000 · 1536000 · 1740000 · desconocido null", `${conDos} · ${conMenosUno} · ${override} · desconocido ${brutoSegunTipo("otro", 1, 1, 1, 1, 1, 1, 1, 1, 0)}`,
      Math.abs((conDos ?? 0) - 1728000) < 0.01 && Math.abs((conMenosUno ?? 0) - 1536000) < 0.01 && override === 1740000 && brutoSegunTipo("otro", 1, 1, 1, 1, 1, 1, 1, 1, 0) === null, "A-FEAT-1259")
  }

  // ══ Libro IVA Compras en archivo de texto para ARCA (A-FEAT-1286, 2026-10-16) ════════════════════
  // Los renglones de 2023 son los que ARCA ACEPTÓ del sistema viejo (marzo 2023, MSA): el generador
  // tiene que escribir lo mismo. Única diferencia permitida: el «código de operación» (posición 239),
  // que el sistema viejo llenaba con A/E y el diseño pide «0» cuando hay alícuota o es Factura C.
  {
    const MSA = { cuit: "30617786016", razonSocial: "MARTINEZ SOBRADO AGRO SRL" }
    const sinCodOp = (l: string) => l.slice(0, 238) + l.slice(239)
    const GARMENDIA_2023 = "202303200010000500000000000000000361                8000000000020242193637GARMENDIA SANTIAGO            000000091645884000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000PES00010000001A00000001590548400000000000000000000000000                              000000000000000"
    const GARMENDIA_ALI_2023 = "001000050000000000000000036180000000000202421936370000000757404000005000000015905484"
    const VIGIL_2023 = "202303050110000200000000000000000213                8000000000020342964444VIGIL FRANCISCO TOMAS         000000010232400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000PES00010000000E00000000000000000000000000000000000000000                              000000000000000"
    const garmendia: FilaCompraArca = { fecha_emision: "2023-03-20", tipo_comprobante: 1, punto_venta: 5, numero_desde: 361, cuit: "20242193637",
      denominacion_emisor: "GARMENDIA SANTIAGO", moneda: "$", tipo_cambio: 1, imp_total: 916458.84, imp_neto_gravado: 757404, iva: 159054.84,
      neto_grav_iva_21: 757404, iva_21: 159054.84 }
    const vigil: FilaCompraArca = { fecha_emision: "2023-03-05", tipo_comprobante: 11, punto_venta: 2, numero_desde: 213, cuit: "20342964444",
      denominacion_emisor: "VIGIL FRANCISCO TOMAS", moneda: "PES", tipo_cambio: 1, imp_total: 102324 }
    const a2023 = armarLibroComprasArca([garmendia, vigil], "A", MSA)
    const garmendiaIgual = sinCodOp(a2023.cbte[0]) === sinCodOp(GARMENDIA_2023) && a2023.alicuotas[0] === GARMENDIA_ALI_2023
    chequear("Libro IVA ARCA", "Factura A: escribe el mismo renglón que ARCA aceptó en 2023 (comprobante y alícuota)",
      "igual al de 2023 (salvo el código de operación)", garmendiaIgual ? "igual" : `distinto:\n${a2023.cbte[0]}\n${a2023.alicuotas[0]}`,
      garmendiaIgual, "A-FEAT-1286")
    const vigilIgual = sinCodOp(a2023.cbte[1]) === sinCodOp(VIGIL_2023)
    chequear("Libro IVA ARCA", "Factura C: sólo el total, 0 alícuotas y ningún renglón en el archivo de alícuotas",
      "igual al de 2023 · 1 renglón de alícuota en total", `${vigilIgual ? "igual" : "distinto: " + a2023.cbte[1]} · ${a2023.alicuotas.length} renglón de alícuota en total`,
      vigilIgual && a2023.alicuotas.length === 1, "A-FEAT-1286")

    // Versión B = A + el campo TurIVA (15 ceros) al final.
    const b = armarLibroComprasArca([garmendia], "B", MSA)
    const bOk = a2023.cbte[0].length === 325 && b.cbte[0].length === 340 && b.cbte[0] === a2023.cbte[0] + "0".repeat(15)
    chequear("Libro IVA ARCA", "Versión A mide 325 y B 340: B es A con 15 ceros al final",
      "325 · 340 · B = A + 15 ceros", `${a2023.cbte[0].length} · ${b.cbte[0].length} · ${b.cbte[0] === a2023.cbte[0] + "0".repeat(15) ? "B = A + 15 ceros" : "distinto"}`,
      bOk, "A-FEAT-1286")

    // Octubre 2026 real (MSA, imputado al mes): Factura B con otros tributos, 2 alícuotas, NC en negativo, exento.
    const oct: FilaCompraArca[] = [
      { id: "inc", fecha_emision: "2025-12-21", tipo_comprobante: 6, punto_venta: 16537, numero_desde: 423238, cuit: "30687310434", denominacion_emisor: "INC S. A.", moneda: "$", tipo_cambio: 1, imp_total: 136980.70, otros_tributos: 19400.70 },
      { id: "alto", fecha_emision: "2026-10-01", tipo_comprobante: 1, punto_venta: 3, numero_desde: 2771, cuit: "33717582549", denominacion_emisor: "ALTO CORTE PRODUCCIONES", moneda: "$", tipo_cambio: 1, imp_total: 57715.50, imp_neto_gravado: 51477.34, iva: 6238.18, neto_grav_iva_10_5: 43543.45, iva_10_5: 4572.06, neto_grav_iva_21: 7933.89, iva_21: 1666.12 },
      { id: "alc", fecha_emision: "2026-10-02", tipo_comprobante: 3, punto_venta: 10, numero_desde: 820, cuit: "20103619115", denominacion_emisor: "ALCORTA EDMUNDO ERNESTO", moneda: "$", tipo_cambio: 1, imp_total: -133335.56, imp_neto_gravado: -110194.67, iva: -23140.88, neto_grav_iva_21: -110194.67, iva_21: -23140.88 },
      { id: "agua", fecha_emision: "2026-10-02", tipo_comprobante: 1, punto_venta: 1, numero_desde: 33305, cuit: "30615803762", denominacion_emisor: "COOPERATIVA DE PROVISION DE AGUA POTABLE DE RIO TALA", moneda: "PES", tipo_cambio: 1, imp_total: 16295.23, imp_neto_gravado: 9523.80, imp_op_exentas: 4200, iva: 2571.43, neto_grav_iva_27: 9523.80, iva_27: 2571.43 },
    ]
    const ao = armarLibroComprasArca(oct, "A", MSA)
    const nc = leerCbte(ao.cbte[2])
    const inc = leerCbte(ao.cbte[0])
    chequear("Libro IVA ARCA", "La nota de crédito (negativa en la app) va en positivo, y la B lleva su «otros tributos» tal cual",
      "NC total 133.335,56 · INC otros 19.400,70 · 0 alícuotas", `NC total ${n2(nc.total)} · INC otros ${n2(inc.otrosTributos)} · ${inc.cantidadAlicuotas} alícuotas`,
      nc.total === 133335.56 && !ao.cbte[2].includes("-") && inc.otrosTributos === 19400.70 && inc.cantidadAlicuotas === 0, "A-FEAT-1286")
    const ordenAli = ao.alicuotas.map(l => `${parseInt(l.slice(8, 28), 10)}:${l.slice(65, 69)}`).join(" ")
    chequear("Libro IVA ARCA", "Alto Corte sale con 2 renglones de alícuota (10,5% y 21%), en el orden del archivo de comprobantes",
      "2771:0004 2771:0005 820:0005 33305:0006", ordenAli,
      ordenAli === "2771:0004 2771:0005 820:0005 33305:0006", "A-FEAT-1286")

    const ctl = controlarArchivo(oct, ao, "A")
    const tot = ctl.renglones.find(x => x.concepto === "Total")!
    chequear("Libro IVA ARCA", "Control: releído, el archivo da lo mismo que el subdiario (con la NC restando)",
      "cierra · total 77.655,87", `${ctl.ok ? "cierra" : "NO cierra: " + ctl.problemas.join("; ")} · total ${n2(tot.archivo)}`,
      ctl.ok && Math.abs(tot.archivo - 77655.87) < 0.005, "A-FEAT-1286")
    // Si el archivo se corrompe, el control lo tiene que ver (un caso que pasa siempre no prueba nada).
    const roto = { ...ao, cbte: ao.cbte.map((l, i) => i === 1 ? l.slice(0, 104) + "000000005771551" + l.slice(119) : l) }
    const ctlRoto = controlarArchivo(oct, roto, "A")
    chequear("Libro IVA ARCA", "Control: si un total del archivo cambia un centavo, NO cierra",
      "no cierra", ctlRoto.ok ? "cierra (mal)" : "no cierra", !ctlRoto.ok, "A-FEAT-1286")
    // Alto Corte: total vs partes difiere 0,02 (viene así de ARCA) → no se avisa; un tipo 0 sí.
    const avisosTipo0 = armarLibroComprasArca([{ ...oct[1], tipo_comprobante: 0 }], "A", MSA).avisos.filter(x => x.motivo.includes("Tipo")).length
    chequear("Libro IVA ARCA", "Un redondeo de centavos del emisor no se avisa; un comprobante tipo 0 sí",
      "0 avisos · 1 aviso", `${ao.avisos.length} avisos · ${avisosTipo0} aviso`,
      ao.avisos.length === 0 && avisosTipo0 === 1, "A-FEAT-1286")

    // Dólares: se informa en la moneda original con su cotización (4 enteros + 6 decimales).
    const usd = leerCbte(armarLibroComprasArca([{ ...oct[1], moneda: "USD", tipo_cambio: 1390 }], "A", MSA).cbte[0])
    chequear("Libro IVA ARCA", "Comprobante en dólares: moneda DOL, cotización 1390, importes en dólares",
      "DOL · 1390 · 57.715,50", `${usd.moneda} · ${usd.tipoCambio} · ${n2(usd.total)}`,
      usd.moneda === "DOL" && usd.tipoCambio === 1390 && usd.total === 57715.5, "A-FEAT-1286")

    // Tipo 063 (liquidación A): sin intermediario, ARCA pide la CUIT del informante como corredor.
    const liq = armarLibroComprasArca([{ ...oct[1], tipo_comprobante: 63 }], "A", MSA).cbte[0]
    chequear("Libro IVA ARCA", "Liquidación (063): «CUIT emisor/corredor» = la nuestra; en una factura común, ceros",
      "30617786016 · 00000000000", `${liq.slice(269, 280)} · ${ao.cbte[1].slice(269, 280)}`,
      liq.slice(269, 280) === "30617786016" && ao.cbte[1].slice(269, 280) === "00000000000", "A-FEAT-1286")

    // ANSI: lo que no existe en un byte se reemplaza; el ancho es fijo.
    const t = textoArca("PEÑA “LA ÚNICA”", 20)
    chequear("Libro IVA ARCA", "Nombre: conserva Ñ y tildes (existen en ANSI), cambia las comillas tipográficas y rellena a 20",
      "«PEÑA ?LA ÚNICA?     »", `«${t}»`, t === "PEÑA ?LA ÚNICA?     " && t.length === 20, "A-FEAT-1286")
  }

  // ── 📨 Estado «Enviado al contador» en los subdiarios (A-FEAT-1295) ──
  {
    const acc = (d: { accion: string }) => d.accion
    const G = "Estado DDJJ"

    const imputadoContable = evaluarCambioDDJJ({ estadosAfectados: ["Imputado"], esAdmin: false })
    chequear(G, "Mover una factura «Imputado»: libre para cualquiera (como hasta hoy)",
      "libre", acc(imputadoContable), acc(imputadoContable) === "libre", "A-FEAT-1295")

    const enviadoContable = evaluarCambioDDJJ({ estadosAfectados: ["Imputado", "Enviado"], esAdmin: false })
    chequear(G, "Rol contable sobre una factura «Enviado»: BLOQUEADO (decisión del usuario: Ulises no lo toca nunca)",
      "bloquear", acc(enviadoContable), acc(enviadoContable) === "bloquear", "A-FEAT-1295")

    const enviadoAdmin = evaluarCambioDDJJ({ estadosAfectados: ["Enviado"], esAdmin: true })
    chequear(G, "Admin sobre una factura «Enviado»: ADVIERTE y deja seguir",
      "advertir", acc(enviadoAdmin), acc(enviadoAdmin) === "advertir", "A-FEAT-1295")

    const presentadoAdmin = evaluarCambioDDJJ({ estadosAfectados: ["DDJJ OK"], esAdmin: true })
    chequear(G, "Admin sobre una factura presentada (DDJJ OK): ADVIERTE y deja seguir",
      "advertir", acc(presentadoAdmin), acc(presentadoAdmin) === "advertir", "A-FEAT-1295")

    const destinoContable = evaluarCambioDDJJ({ estadosAfectados: ["No"], periodoDestino: "09/2026", estadoPeriodoDestino: "Enviado", esAdmin: false })
    chequear(G, "Rol contable imputando una factura nueva a un mes ya enviado: BLOQUEADO",
      "bloquear", acc(destinoContable), acc(destinoContable) === "bloquear", "A-FEAT-1295")

    const destinoAdmin = evaluarCambioDDJJ({ estadosAfectados: ["No"], periodoDestino: "09/2026", estadoPeriodoDestino: "Enviado", esAdmin: true })
    const dice = destinoAdmin.accion === "advertir" && destinoAdmin.mensaje.includes("09/2026")
    chequear(G, "Admin imputando a un mes ya enviado: ADVIERTE y el cartel nombra el mes",
      "advertir, menciona 09/2026", destinoAdmin.accion === "advertir" ? destinoAdmin.mensaje.slice(0, 80) : destinoAdmin.accion, dice, "A-FEAT-1295")

    const destinoLibre = evaluarCambioDDJJ({ estadosAfectados: ["No"], periodoDestino: "10/2026", estadoPeriodoDestino: "Imputado", esAdmin: false })
    chequear(G, "Imputar a un mes que todavía no se envió: libre",
      "libre", acc(destinoLibre), acc(destinoLibre) === "libre", "A-FEAT-1295")

    const sellaContable = evaluarCambioDDJJ({ estadosAfectados: ["Imputado"], estadoNuevo: "Enviado", esAdmin: false })
    const sellaAdmin = evaluarCambioDDJJ({ estadosAfectados: ["Imputado"], estadoNuevo: "Enviado", esAdmin: true })
    chequear(G, "Marcar «Enviado» o «DDJJ OK»: sólo el admin (sin advertencia si lo marcado era «Imputado»)",
      "contable: bloquear · admin: libre", `contable: ${acc(sellaContable)} · admin: ${acc(sellaAdmin)}`,
      acc(sellaContable) === "bloquear" && acc(sellaAdmin) === "libre", "A-FEAT-1295")

    const mes = [estadoDelPeriodo(["Imputado", "Enviado", "Imputado"]), estadoDelPeriodo(["Enviado", "DDJJ OK"]), estadoDelPeriodo(["Imputado"]), estadoDelPeriodo([])]
    chequear(G, "Estado del MES = el más avanzado de sus facturas (una imputada tarde no «desenvía» el mes)",
      "Enviado · DDJJ OK · Imputado · null", mes.join(" · "),
      mes[0] === "Enviado" && mes[1] === "DDJJ OK" && mes[2] === "Imputado" && mes[3] === null, "A-FEAT-1295")

    const lista = mesesEnviadosSinPresentar([
      { año_contable: 2026, mes_contable: 9, ddjj_iva: "Enviado" },
      { año_contable: 2026, mes_contable: 9, ddjj_iva: "Imputado" },
      { año_contable: 2026, mes_contable: 3, ddjj_iva: "DDJJ OK" },
      { año_contable: 2026, mes_contable: 3, ddjj_iva: "Enviado" },
      { año_contable: 2025, mes_contable: 12, ddjj_iva: "Enviado" },
      { año_contable: null, mes_contable: null, ddjj_iva: "Enviado" },
    ])
    chequear(G, "Lista de enviados sin presentar: ordenada, sin los meses ya presentados ni las filas sin período",
      "12/2025, 09/2026", lista.join(", "), lista.join(", ") === "12/2025, 09/2026", "A-FEAT-1295")

    const tablero = estadoDeLosMeses([
      { año_contable: 2026, mes_contable: 9, ddjj_iva: "DDJJ OK" },
      { año_contable: 2026, mes_contable: 9, ddjj_iva: "Imputado" },
      { año_contable: 2026, mes_contable: 5, ddjj_iva: "Imputado" },
      { año_contable: 2026, mes_contable: 8, ddjj_iva: "Enviado" },
      { año_contable: 2026, mes_contable: 7, ddjj_iva: "No" },
      { año_contable: null, mes_contable: null, ddjj_iva: "No" },
    ]).map(m => `${m.periodo} ${m.estado}${m.sinMandar ? " +" + m.sinMandar : ""}`).join(" · ")
    chequear(G, "Tablero de meses: TODOS los meses con su estado (también los presentados), del más viejo al más nuevo; un «No» con mes (Ventas) no cuenta",
      "05/2026 Imputado · 08/2026 Enviado · 09/2026 DDJJ OK +1", tablero,
      tablero === "05/2026 Imputado · 08/2026 Enviado · 09/2026 DDJJ OK +1", "A-FEAT-1295")
  }

  // ══ 🔁 DOBLE AUDIT: lo que está a auditar en un extracto no se concilia solo desde otro (A-BUG-1290) ══
  {
    // Buscador de juguete con la regla del motor: mismo importe; fecha exacta = conciliado, si no, a auditar.
    const movTarjeta = { debitos: 571179.49, fecha: "2026-07-05" }
    const buscarJuguete = (pool: any[]) => {
      const f = pool.find(c => c.debitos === movTarjeta.debitos)
      return f ? { match: true, cashFlowRow: f, requiere_revision: f.fecha_estimada !== movTarjeta.fecha, motivo_revision: null as string | null }
               : { match: false, requiere_revision: false, motivo_revision: null as string | null }
    }
    const cuotaJulio = { id: "cuota-seguro-julio", debitos: 571179.49, fecha_estimada: "2026-07-05" }
    const cuotaAgosto = { id: "cuota-seguro-agosto", debitos: 571179.49, fecha_estimada: "2026-07-05" }
    const enAuditar = new Map<string, VinculoEnAuditar>([["cuota-seguro-julio", { que: "extracto de la cuenta corriente de MSA", fecha: "2026-07-02" }]])

    // 🧨 El caso real: con el código viejo (buscar directo) la cuota de julio, YA atada al débito del 02/07
    //    a auditar, se conciliaba sola por coincidir importe y fecha.
    const viejo = buscarJuguete([cuotaJulio])
    const nuevo = buscarConDobleAudit(buscarJuguete, [cuotaJulio], enAuditar)
    chequear("Doble audit", "🧨 Seguro Flota: la cuota de julio ya está a auditar en la cta cte → desde la tarjeta queda A AUDITAR, aunque coincida en todo (antes se conciliaba sola)",
      "antes conciliado · ahora auditar con «Doble audit … 02/07 … cuenta corriente»",
      `antes ${viejo.requiere_revision ? "auditar" : "conciliado"} · ahora ${nuevo.requiere_revision ? "auditar" : "conciliado"} con «${nuevo.motivo_revision}»`,
      viejo.requiere_revision === false && nuevo.match && nuevo.requiere_revision === true
        && String(nuevo.motivo_revision).startsWith("Doble audit") && String(nuevo.motivo_revision).includes("02/07/2026")
        && String(nuevo.motivo_revision).includes("cuenta corriente de MSA"), "A-BUG-1290")

    // La libre gana: si otra cuota del mismo importe está libre, se toma ésa y se concilia normal.
    const conLibre = buscarConDobleAudit(buscarJuguete, [cuotaJulio, cuotaAgosto], enAuditar)
    chequear("Doble audit", "Si hay una candidata LIBRE del mismo importe, gana la libre (la que está en audit no se toca)",
      "cuota-seguro-agosto · conciliado", `${conLibre.cashFlowRow?.id} · ${conLibre.requiere_revision ? "auditar" : "conciliado"}`,
      conLibre.cashFlowRow?.id === "cuota-seguro-agosto" && conLibre.requiere_revision === false, "A-BUG-1290")

    // Sin nada a auditar, el motor se comporta igual que antes.
    const sinAudit = buscarConDobleAudit(buscarJuguete, [cuotaJulio], new Map())
    chequear("Doble audit", "Sin vínculos a auditar el resultado es el de siempre",
      "cuota-seguro-julio · conciliado", `${sinAudit.cashFlowRow?.id} · ${sinAudit.requiere_revision ? "auditar" : "conciliado"}`,
      sinAudit.cashFlowRow?.id === "cuota-seguro-julio" && sinAudit.requiere_revision === false, "A-BUG-1290")

    // Si no coincide nada, no inventa: sigue sin match.
    const nada = buscarConDobleAudit(buscarJuguete, [{ id: "otra", debitos: 1, fecha_estimada: "2026-07-05" }], enAuditar)
    chequear("Doble audit", "Si nada coincide, sigue sin match", "sin match", nada.match ? "match" : "sin match", !nada.match, "A-BUG-1290")
  }

  // ══ 💳 NC PAGADAS CON TARJETA, emparejadas con su factura (A-FEAT-1292) ═══════════════════════════
  {
    // Los comprobantes reales de Medicus en «crédito» (mar, abr y may 2026), fijos acá.
    const med = (id: string, tipo: number, nro: number, fecha: string, total: number) =>
      ({ id, cuit: "30546741253", tipo_comprobante: tipo, numero_desde: nro, denominacion_emisor: "MEDICUS",
         imp_total: total, fecha_emision: fecha, detalle: `${tipo === 1 ? "FC" : "NC"} ${nro} - MEDICUS` })
    const comp = [
      med("fc-mar", 1, 609033, "2026-03-19", 830356.25), med("nc-mar", 3, 218470, "2026-03-19", -43088.28),
      med("fc-abr", 1, 611162, "2026-04-22", 814342.23), med("nc-abr", 3, 219622, "2026-04-23", -42218.32),
      med("fc-may", 1, 613071, "2026-05-21", 850818.25), med("nc-may", 3, 220552, "2026-05-21", -43790.18),
    ]
    const pares = paresCreditoNC(comp)
    // 🧨 Con el modal de siempre (todo junto), las 3 NC se descontaban de la PRIMERA factura.
    const todoJunto = planCancelacionNC({ tipo: "fc_con_nc", facturas: comp.filter(c => c.tipo_comprobante === 1),
      disponibles: comp.filter(c => c.tipo_comprobante === 3), seleccionadas: new Set(["nc-mar", "nc-abr", "nc-may"]) })
    chequear("NC con tarjeta", "🧨 Medicus: cada NC va con SU factura (neto = lo que cobra la tarjeta: 787.267,97 · 772.123,91 · 807.028,07); todo junto bajaba sólo la de marzo",
      "fc-mar 787267.97 · fc-abr 772123.91 · fc-may 807028.07 · todo junto: fc-mar 701259.47",
      `${pares.map(p => `${p.fc.id} ${p.neto}`).join(" · ")} · todo junto: ${todoJunto[0].id} ${todoJunto[0].cambios.monto_a_abonar}`,
      pares.length === 3 && pares[0].fc.id === "fc-mar" && pares[0].neto === 787267.97 && pares[1].fc.id === "fc-abr" && pares[1].nc.id === "nc-abr"
        && pares[1].neto === 772123.91 && pares[2].neto === 807028.07 && todoJunto[0].cambios.monto_a_abonar === 701259.47, "A-FEAT-1292")

    // El plan de UN par: la factura baja al neto, NO cambia de estado (sigue «crédito») y conserva su detalle.
    const planMay = planCancelacionNC({ tipo: "fc_con_nc", facturas: [pares[2].fc], disponibles: [pares[2].nc], seleccionadas: new Set([pares[2].nc.id]) })
    chequear("NC con tarjeta", "La factura de mayo queda en 807.028,07, sin cambiar de estado, y su detalle autogenerado se reemplaza (lo escrito a mano se conservaría)",
      "807028.07 · sin estado · «Descuento parcial NC 220552» (el FC N - EMISOR autogenerado se descarta, A-BUG-1304) · NC conciliado",
      `${planMay[0].cambios.monto_a_abonar} · ${planMay[0].cambios.estado ?? "sin estado"} · «${planMay[0].cambios.detalle}» · NC ${planMay[1].cambios.estado}`,
      planMay[0].cambios.monto_a_abonar === 807028.07 && planMay[0].cambios.estado === undefined
        && planMay[0].cambios.detalle === "Descuento parcial NC 220552"
        && planMay[1].cambios.estado === "conciliado" && planMay[1].cambios.detalle === "Cancela FC 613071", "A-FEAT-1292")

    // Una NC sin factura cerca (> 3 días) no se empareja: no se adivina.
    const lejos = paresCreditoNC([med("fc", 1, 1, "2026-05-01", 1000), med("nc", 3, 2, "2026-05-10", -100)])
    // Y otro proveedor tampoco, aunque sea el mismo día.
    const otroCuit = paresCreditoNC([med("fc", 1, 1, "2026-05-01", 1000), { ...med("nc", 3, 2, "2026-05-01", -100), cuit: "20111111112" }])
    chequear("NC con tarjeta", "Una NC sin factura del mismo proveedor a ≤ 3 días queda sin emparejar",
      "0 · 0", `${lejos.length} · ${otroCuit.length}`, lejos.length === 0 && otroCuit.length === 0, "A-FEAT-1292")
  }

  // ══ 🧩 CREAR TEMPLATE DESDE LA CONCILIACIÓN: entero o nada (A-FEAT-1294) ══════════════════════════
  {
    // La campaña sale de la fecha del MOVIMIENTO: Chubb de MA (anual) el 26/05/2026 → «2026»; un consumo
    // de MSA (campaña jul–jun) del 15/10/2025 → «25/26», y uno del 15/03/2026 → también «25/26».
    chequear("Template desde la conciliación", "La campaña sale de la periodicidad y la fecha del movimiento (anual → 2026; jul–jun → 25/26 a ambos lados del año)",
      "2026 · 25/26 · 25/26 · 26/27 · MA anual · MSA bianual",
      `${campanaDeFecha("anual", "2026-05-26")} · ${campanaDeFecha("bianual", "2025-10-15")} · ${campanaDeFecha("bianual", "2026-03-15")} · ${campanaDeFecha("bianual", "2026-07-01")} · MA ${periodicidadDeEmpresa("MA")} · MSA ${periodicidadDeEmpresa("MSA")}`,
      campanaDeFecha("anual", "2026-05-26") === "2026" && campanaDeFecha("bianual", "2025-10-15") === "25/26"
        && campanaDeFecha("bianual", "2026-03-15") === "25/26" && campanaDeFecha("bianual", "2026-07-01") === "26/27"
        && periodicidadDeEmpresa("MA") === "anual" && periodicidadDeEmpresa("MSA") === "bianual", "A-FEAT-1294")

    // Entero o nada: sin agrupadora no se crea (antes el «+ Crear uno acá» lo creaba sin agrupadora).
    const chubb = { nombre_referencia: "Seguro Chalet", categ: "Seguro Chalet", responsable: "MA", cuenta_agrupadora: "Seguros",
      periodicidad: "anual" as const, año: "2026", tipo: "egreso", aplica_generacion: true, nombre_quien_cobra: "CHUBB SEGUROS" }
    // 🧨 A-FEAT-1297: sin «quién cobra» Seguro Chalet se creó sin proveedor y el movimiento quedó sin él.
    chequear("Template desde la conciliación", "Sin «quién cobra» no se crea (el nombre alcanza, el CUIT es opcional)",
      "quién cobra · nada", `${faltantesTemplateNuevo({ ...chubb, nombre_quien_cobra: " " }).join(",")} · ${faltantesTemplateNuevo({ ...chubb, cuit_quien_cobra: null }).join(",") || "nada"}`,
      faltantesTemplateNuevo({ ...chubb, nombre_quien_cobra: " " }).join(",") === "quién cobra" && faltantesTemplateNuevo({ ...chubb, cuit_quien_cobra: null }).length === 0, "A-FEAT-1297")
    chequear("Template desde la conciliación", "🛑 Entero o nada: completo se puede; sin agrupadora o sin cuenta, no",
      "completo: nada falta · sin agrupadora: agrupadora · sin cuenta: cuenta",
      `completo: ${faltantesTemplateNuevo(chubb).join(",") || "nada falta"} · sin agrupadora: ${faltantesTemplateNuevo({ ...chubb, cuenta_agrupadora: " " }).join(",")} · sin cuenta: ${faltantesTemplateNuevo({ ...chubb, categ: "" }).join(",")}`,
      faltantesTemplateNuevo(chubb).length === 0 && faltantesTemplateNuevo({ ...chubb, cuenta_agrupadora: " " }).join(",") === "agrupadora"
        && faltantesTemplateNuevo({ ...chubb, categ: "" }).join(",") === "cuenta", "A-FEAT-1294")

    // Chubb es de MA y lo paga la tarjeta de MSA: se avisa (no se frena).
    chequear("Template desde la conciliación", "Un template de otra empresa que la cuenta que paga se avisa (MA pagado por MSA); la misma empresa no",
      "true · false", `${esDeOtraEmpresa("MA", "MSA")} · ${esDeOtraEmpresa("msa", "MSA")}`,
      esDeOtraEmpresa("MA", "MSA") && !esDeOtraEmpresa("msa", "MSA"), "A-FEAT-1294")
  }

  // ══ 🎯 LA REGLA ELIGE EL TEMPLATE, y sigue a su familia al renovarse (A-FEAT-1293) ══════════════════
  {
    // Seguro Flota de MSA: la regla se creó apuntando al renglón 25/26. Un movimiento de agosto 2026 tiene que
    // cargar en el 26/27 (la campaña se renovó), uno de marzo 2026 en el 25/26.
    const flota2526 = { id: "sf-2526", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "25/26", periodicidad: null, activo: true }
    const flota2627 = { id: "sf-2627", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "26/27", periodicidad: null, activo: true }
    const accidentes = { id: "acc", nombre_referencia: "Seguro Accidentes de Trabajo", responsable: "MSA", año: "26/27", periodicidad: null, activo: true }
    const otraEmpresa = { id: "sf-pam", nombre_referencia: "Seguro Flota", responsable: "PAM", año: "26/27", periodicidad: null, activo: true }
    const todos = [flota2526, flota2627, accidentes, otraEmpresa]
    const ago = templateParaFecha(flota2526, todos, "2026-08-04")
    const mar = templateParaFecha(flota2526, todos, "2026-03-04")
    // 🧨 Con el camino viejo (por cuenta + empresa) se tomaba EL PRIMERO de la cuenta: podía ser Accidentes.
    chequear("Regla → template", "🎯 La regla apunta a Seguro Flota 25/26: un movimiento de ago-26 carga en el 26/27 (renovado) y uno de mar-26 en el 25/26; nunca en Accidentes ni en el de PAM",
      "sf-2627 · sf-2526", `${ago?.id} · ${mar?.id}`, ago?.id === "sf-2627" && mar?.id === "sf-2526", "A-FEAT-1293")

    // 📅 A-DEC-1015 — Orbith → «Internet NZ» de MA existe sólo 2026: un cargo de dic-2025 NO puede caer en el
    // 2026 (inflaba 2026 y dejaba 2025 sin el gasto). Los cargos del banco (sin presupuesto por campaña) sí.
    const nz = { id: "nz-2026", nombre_referencia: "Internet NZ", responsable: "MA", año: "2026", periodicidad: "anual", activo: true }
    const nz2025 = templateParaFecha(nz, [nz], "2025-12-02")
    const iva = { id: "iva-2026", nombre_referencia: "Iva Bancario", responsable: "MSA", año: "2026", periodicidad: "anual", activo: true, solo_conciliacion: true }
    const iva2025 = templateParaFecha(iva, [iva], "2025-12-31")
    const inactivo = templateParaFecha({ ...iva, activo: false }, [{ ...iva, activo: false }], "2025-12-31")
    chequear("Regla → template", "📅 Sin la campaña 2025, Orbith NO carga en la 2026 (queda en auditar); el IVA del banco sí carga; un template desactivado nunca",
      "null · iva-2026 · null", `${nz2025 === null ? "null" : nz2025.id} · ${iva2025?.id} · ${inactivo === null ? "null" : inactivo.id}`,
      nz2025 === null && iva2025?.id === "iva-2026" && inactivo === null, "A-DEC-1015")
    chequear("Regla → template", "El motivo dice qué campaña falta y de qué template",
      "Falta la campaña 2025 de «Internet NZ» (MA)…", motivoFaltaCampana(nz, "2025-12-02"),
      motivoFaltaCampana(nz, "2025-12-02").startsWith("Falta la campaña 2025 de «Internet NZ» (MA)"), "A-DEC-1015")

    // 🔁 A-FEAT-1302 punto 3 — del motivo sale qué campaña crear (el botón del auditar). Otro motivo → nada.
    const falta = faltaCampanaDelMotivo(motivoFaltaCampana({ ...nz, nombre_referencia: "Seguro (Chalet)" }, "2025-12-02"))
    chequear("Regla → template", "🔁 El auditar lee del motivo qué campaña falta y de qué template (aunque el nombre tenga paréntesis); un motivo de importe no ofrece nada",
      "2025 · Seguro (Chalet) · MA · null", `${falta?.campana} · ${falta?.nombre} · ${falta?.responsable} · ${faltaCampanaDelMotivo("Importe difiere $ 0,01")}`,
      falta?.campana === "2025" && falta?.nombre === "Seguro (Chalet)" && falta?.responsable === "MA"
        && faltaCampanaDelMotivo("Importe difiere $ 0,01") === null, "A-FEAT-1302")

    // 📅 A-DEC-1016 — un abierto SIN campaña carga en sí mismo, en cualquier fecha (no queda en auditar).
    const pf = { id: "pf", nombre_referencia: "Plazo Fijo Banco Galicia", responsable: "MSA", año: null, periodicidad: "anual", activo: true }
    const pf2025 = templateParaFecha(pf, [pf], "2025-08-01")
    chequear("Regla → template", "📅 Un abierto sin campaña (Plazo Fijo) carga en él mismo aunque el movimiento sea de 2025",
      "pf", `${pf2025?.id}`, pf2025?.id === "pf", "A-DEC-1016")
  }

  // ══ 🏷️ LOS CÓDIGOS CONTABLE/INTERNO DE UN TEMPLATE NUEVO (A-FEAT-1302 punto 2) ═══════════════════════
  {
    const origen = [
      { cuenta_bancaria_id: "msa_galicia", codigo_contable: "RET 3 MA", codigo_interno: "Gasto MSA", orden: 4 },
      { cuenta_bancaria_id: "tarjeta_visa", codigo_contable: "RET 3 MA", codigo_interno: null },
      { cuenta_bancaria_id: "pam_galicia", codigo_contable: "", codigo_interno: "", activo: true },
    ]
    // Copia: las 2 con código, al template nuevo; la vacía no (no aporta nada).
    const copia = reglasDelTemplateNuevo({ origen, templateId: "nuevo" })
    chequear("Códigos del template", "🏷️ «Parecido a…» copia los códigos de cada cuenta al template nuevo (una regla vacía no se copia)",
      "2 reglas · nuevo · especifica", `${copia.length} reglas · ${copia[0]?.template_id} · ${copia[0]?.tipo_regla}`,
      copia.length === 2 && copia.every(r => r.template_id === "nuevo" && r.tipo_regla === "especifica"), "A-FEAT-1302")
    // Lo escrito pisa SÓLO la cuenta que paga y sólo el campo escrito (interno vacío = el copiado).
    const pisada = reglasDelTemplateNuevo({ origen, templateId: "nuevo", cuentaBancariaId: "msa_galicia", contable: "Desglosar" })
    const g = pisada.find(r => r.cuenta_bancaria_id === "msa_galicia")
    const t = pisada.find(r => r.cuenta_bancaria_id === "tarjeta_visa")
    chequear("Códigos del template", "✍️ Lo escrito en el asistente pisa la cuenta que paga (sólo el campo escrito); las otras cuentas quedan como el origen",
      "Desglosar / Gasto MSA · RET 3 MA", `${g?.codigo_contable} / ${g?.codigo_interno} · ${t?.codigo_contable}`,
      g?.codigo_contable === "Desglosar" && g?.codigo_interno === "Gasto MSA" && t?.codigo_contable === "RET 3 MA", "A-FEAT-1302")
    // Sin origen, con códigos escritos: una regla nueva para la cuenta. Sin nada: ninguna.
    const sola = reglasDelTemplateNuevo({ origen: [], templateId: "x", cuentaBancariaId: "msa_galicia", interno: "LIB" })
    const nada = reglasDelTemplateNuevo({ origen: [], templateId: "x", cuentaBancariaId: "msa_galicia" })
    chequear("Códigos del template", "Template nuevo sin origen: lo escrito crea la regla de la cuenta; sin escribir nada no se crea ninguna",
      "1 (LIB) · 0", `${sola.length} (${sola[0]?.codigo_interno}) · ${nada.length}`,
      sola.length === 1 && sola[0].codigo_interno === "LIB" && sola[0].codigo_contable === null && nada.length === 0, "A-FEAT-1302")
  }

  // ══ 🏷️ LA CUENTA DEL TEMPLATE AL PLAN, EN EL MISMO PASO (A-FEAT-1311) ═══════════════════════════════
  {
    // Como se cargó a mano IIBB CABA Bancario: tipo egreso, totalizadora IMPUESTOS BANCARIOS, nombre tal cual.
    const f = filaDelPlanParaTemplate({ categ: " IIBB CABA Bancario ", tipo: "egreso", agrupadora: "Impuestos Bancarios" })
    const sinAgr = filaDelPlanParaTemplate({ categ: "Otra", tipo: "", agrupadora: "" })
    chequear("Cuenta al plan", "🏷️ El asistente da de alta la cuenta con el tipo del template y la agrupadora como totalizadora (en mayúsculas, como las del plan)",
      "IIBB CABA Bancario · egreso · IMPUESTOS BANCARIOS · egreso/null",
      `${f.categ} · ${f.tipo} · ${f.nombre_totalizadora} · ${sinAgr.tipo}/${sinAgr.nombre_totalizadora}`,
      f.categ === "IIBB CABA Bancario" && f.cuenta_contable === f.categ && f.tipo === "egreso"
        && f.nombre_totalizadora === "IMPUESTOS BANCARIOS" && sinAgr.tipo === "egreso" && sinAgr.nombre_totalizadora === null, "A-FEAT-1311")
  }

  // ══ 🔎 EL FILTRO «CAMPAÑA» DE TEMPLATES (A-BUG-1317) ════════════════════════════════════════════════
  {
    // 🧨 Antes: "2026" === parseInt("2026") → false siempre, y la lista quedaba vacía.
    const r = [coincideCampana("2026", "2026"), coincideCampana("25/26", "25/26"), coincideCampana("2026", "25/26"),
      coincideCampana(null, SIN_CAMPANA), coincideCampana("2026", SIN_CAMPANA), coincideCampana(null, "todos")]
    chequear("Filtro de campaña", "🔎 Elegir «2026» o «25/26» muestra esa campaña; «Sin campaña» muestra los abiertos; «Todas» no filtra",
      "true true false true false true", r.join(" "),
      r.join(" ") === "true true false true false true", "A-BUG-1317")
  }

  // ══ 🔢 EL ORDEN DE LAS REGLAS ES POR CUENTA (A-BUG-1295) ═════════════════════════════════════════
  {
    // La cuenta corriente tiene hasta #43; la tarjeta todavía nada. 🧨 Antes se sugería max(todas)+1 = 44.
    const ctaCte = [{ id: "cc1", orden: 1 }, { id: "cc43", orden: 43 }]
    const tarjeta = [{ id: "t1", orden: 1 }, { id: "t2", orden: 2 }]
    chequear("Orden de reglas", "La 1ª regla de una cuenta sin reglas se propone #1; con #1 y #2 ya cargadas, #3 — sin mirar la #43 de la cuenta corriente",
      "1 · 3", `${proximoOrden([])} · ${proximoOrden(tarjeta)}`, proximoOrden([]) === 1 && proximoOrden(tarjeta) === 3, "A-BUG-1295")

    // Bajar la #1 de la tarjeta: sólo cambian las dos de la tarjeta. 🧨 Antes se renumeraban las de todas las cuentas.
    const cambios = moverRegla(tarjeta, "t1", "down")
    const ok = cambios.length === 2 && cambios.some(c => c.id === "t1" && c.orden === 2) && cambios.some(c => c.id === "t2" && c.orden === 1)
      && !cambios.some(c => c.id.startsWith("cc"))
    // Con números repetidos (dos #1) la flecha igual mueve; y la primera no sube.
    const repetidos = moverRegla([{ id: "a", orden: 1 }, { id: "b", orden: 1 }], "b", "up")
    const tope = moverRegla(tarjeta, "t1", "up")
    chequear("Orden de reglas", "Las flechas mueven sólo dentro de la cuenta; con números repetidos igual intercambian; la primera no sube",
      "t2→1, t1→2 · a→2 (b queda primera) · 0", `${cambios.map(c => `${c.id}→${c.orden}`).join(", ")} · ${repetidos.map(c => `${c.id}→${c.orden}`).join(", ")} · ${tope.length}`,
      ok && repetidos.length === 1 && repetidos[0].id === "a" && repetidos[0].orden === 2 && tope.length === 0, "A-BUG-1295")
  }

  // ══ 🧾 CREAR UNA REGLA GUARDA EL TEMPLATE ELEGIDO (A-BUG-1296) ═══════════════════════════════════
  {
    // 🧨 El alta armaba la fila sin template_id: Comision Cuenta Bancaria e Iva Bancario de la VISA quedaron «viejas».
    const fila = filaNuevaRegla({ orden: 2, tipo: "bancarios", columna_busqueda: "descripcion", texto_buscar: "MANT DE CTA",
      tipo_match: "contiene", categ: "Comision Cuenta Bancaria", detalle: "", activo: true, llena_template: true,
      cuenta_bancaria_id: "tarjeta_visa_business_msa", template_id: "tpl-msa" } as any)
    chequear("Regla → template", "Crear una regla nueva graba el template elegido (antes se perdía y la regla quedaba por cuenta)",
      "tpl-msa", String(fila.template_id), fila.template_id === "tpl-msa", "A-BUG-1296")
  }

  // ══ 💳 EL PAGO Y EL TOTAL DEL RESUMEN NO PASAN POR EL MOTOR (A-BUG-1297) ═════════════════════════
  {
    // Resumen 28/05 de la VISA MSA: 9 consumos pendientes + «SU PAGO EN PESOS» pendiente + la fila del total.
    // 🧨 El botón naranja contaba y conciliaba 10 (el pago incluido); el del resumen, 9.
    const filas = [...Array(9)].map(() => ({ tipo_fila: "movimiento" })).concat([{ tipo_fila: "pago" }, { tipo_fila: "resumen" }])
    const n = filas.filter(esFilaConciliable).length
    chequear("Doble audit", "Del resumen 28/05 (9 consumos + el pago + el total) pasan al motor 9: el pago se vincula aparte y el total no se concilia; una cuenta sin tipo_fila pasa entera",
      "9 · true", `${n} · ${esFilaConciliable({})}`, n === 9 && esFilaConciliable({}), "A-BUG-1297")
  }

  // ══ 📅 EN LA TARJETA, LA FACTURA SE COMPARA POR SU EMISIÓN (A-BUG-1298) ═══════════════════════════
  {
    // Medicus: FC emitida 21/05, estimada 05/06; el débito de la tarjeta es del 21/05. 🧨 Antes: 15 días → auditar.
    const pool = conFechaDeEmision([
      { id: "fc", origen: "ARCA", fecha_emision: "2026-05-21", fecha_estimada: "2026-06-05" },
      { id: "cuota", origen: "TEMPLATE", fecha_emision: null, fecha_estimada: "2026-05-26" },
    ])
    chequear("Doble audit", "En la tarjeta, la FC de Medicus se compara por su emisión (21/05 = día del débito) y la cuota de un template sigue con su fecha",
      "2026-05-21 · 2026-05-26", `${pool[0].fecha_estimada} · ${pool[1].fecha_estimada}`,
      pool[0].fecha_estimada === "2026-05-21" && pool[1].fecha_estimada === "2026-05-26", "A-BUG-1298")
  }

  // ══ 🧾 EL COMPROBANTE DE UN CARGO DE LA TARJETA ES EL RESUMEN (A-FEAT-1299) ══════════════════════
  {
    // 🧨 Antes la comisión de la VISA quedaba «Comision Cuenta Bancaria MSA - Mayo 2026», y el pago «28/5/2026».
    const e1 = etiquetaResumenTarjeta("2026-05-28")
    const e2 = etiquetaResumenTarjeta("2026-05-28T00:00:00+00:00")
    const e3 = etiquetaResumenTarjeta(null)
    chequear("Doble audit", "La comisión/IVA/percepción de la tarjeta y su pago dicen «Resumen tarjeta cierre 28/05/2026» (dd/mm/aaaa, sin huso); sin cierre, no inventa",
      "Resumen tarjeta cierre 28/05/2026 ×2 · null", `${e1} · ${e2} · ${e3}`,
      e1 === "Resumen tarjeta cierre 28/05/2026" && e2 === e1 && e3 === null, "A-FEAT-1299")
  }

  // ══ ✍️ APLICAR UNA NC NO DISFRAZA EL DETALLE AUTOGENERADO DE TEXTO PROPIO (A-BUG-1304) ═══════════
  {
    // 🧨 Medicus: «FC 613071 - MEDICUS …» (derivado guardado, A-DAT-54) + « · Descuento parcial NC 220552» dejó de
    // parecer autogenerado y el motor lo copió entero al movimiento de la tarjeta.
    const emisor = "MEDICUS SOCIEDAD ANONIMA DE ASISTENCIA MEDICA Y CIENTIFICA"
    const auto = sumarAlDetalle(`FC 613071 - ${emisor}`, "Descuento parcial NC 220552", emisor, 613071)
    const propio = sumarAlDetalle("Plan familiar", "Descuento parcial NC 220552", emisor, 613071)
    chequear("NC con tarjeta", "Aplicar una NC descarta el «FC N - EMISOR» autogenerado y conserva lo que escribió el usuario",
      "Descuento parcial NC 220552 · Plan familiar · Descuento parcial NC 220552", `${auto} · ${propio}`,
      auto === "Descuento parcial NC 220552" && propio === "Plan familiar · Descuento parcial NC 220552", "A-BUG-1304")
    // La variante larga del importador (Coopser): «Factura 1-195585 - EMISOR» también es autogenerada.
    const coop = "COOPERATIVA DE PROVISION DE SERVICIOS ELECTRICOS PUBLICOS Y SOCIALES DE SAN PEDRO LTDA"
    chequear("NC con tarjeta", "«Factura 1-195585 - COOPERATIVA…» se reconoce como autogenerado (no se copia al movimiento); «Luz Casa Porteria» no",
      "true · false", `${pareceDetalleAutogenerado(`Factura 1-195585 - ${coop}`, coop, 195585)} · ${pareceDetalleAutogenerado("Luz Casa Porteria", coop)}`,
      pareceDetalleAutogenerado(`Factura 1-195585 - ${coop}`, coop, 195585) && !pareceDetalleAutogenerado("Luz Casa Porteria", coop), "A-BUG-1304")
  }

  // ══ 🔢 CÓDIGOS CONTABLE / INTERNO PARA ELEGIR, DE TODAS LAS CUENTAS (A-BUG-1301) ═════════════════
  {
    // 🧨 La VISA MSA no tenía códigos propios: la lista salía vacía. La cuenta corriente sí (RET 3 MA, DIST MA).
    const tarjeta: string[] = []
    const ctaCte = ["RET 3 MA", "DIST MA", "VER", null, "  "]
    const reglas = ["RET 3 PAM", "Ver"]
    const lista = unirCodigos([tarjeta, ctaCte, reglas])
    chequear("Doble audit", "En la tarjeta sin códigos propios, el Asignar ofrece los de la cuenta corriente y las reglas, sin vacíos ni «VER/Ver» repetido",
      "DIST MA · RET 3 MA · RET 3 PAM · VER", lista.join(" · "),
      lista.join("|") === "DIST MA|RET 3 MA|RET 3 PAM|VER", "A-BUG-1301")
  }

  // ══ 🗂️ ASIGNAR → TEMPLATE: LAS DOS CAMPAÑAS DE SEGURO FLOTA SE DISTINGUEN (A-BUG-1300) ═══════════
  {
    const lista = [
      { id: "acc", nombre_referencia: "Seguro Accidentes de Trabajo", responsable: "MSA", año: "25/26" },
      { id: "f2526", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "25/26" },
      { id: "f2627", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "26/27" },
    ].sort(campanaNuevaPrimero)
    chequear("Regla → template", "En el Asignar, Seguro Flota 26/27 aparece antes que 25/26 y el resto no se mueve",
      "acc · f2627 · f2526", lista.map(t => t.id).join(" · "), lista.map(t => t.id).join("|") === "acc|f2627|f2526", "A-BUG-1300")
  }

  // ══ 🧾 EL RESUMEN ES EL COMPROBANTE SÓLO DE LOS CARGOS DEL BANCO (A-BUG-1302) ═════════════════════
  {
    // 🧨 Chubb y Orbith, conciliados por regla en abril, quedaron «Resumen tarjeta cierre 30/04/2026».
    const banco = comprobanteDeCargoDeTarjeta(true, { solo_conciliacion: true }, "2026-04-30")
    const chubb = comprobanteDeCargoDeTarjeta(true, { solo_conciliacion: false }, "2026-04-30")
    const ctaCte = comprobanteDeCargoDeTarjeta(false, { solo_conciliacion: true }, "2026-04-30")
    chequear("Doble audit", "La comisión de la tarjeta lleva el resumen; Chubb (póliza) no; en la cuenta corriente, nunca",
      "Resumen tarjeta cierre 30/04/2026 · null · null", `${banco} · ${chubb} · ${ctaCte}`,
      banco === "Resumen tarjeta cierre 30/04/2026" && chubb === null && ctaCte === null, "A-BUG-1302")
  }

  // ══ 📅 AL ELEGIR TEMPLATE EN UNA REGLA, UNO POR FAMILIA (A-BUG-1303) ══════════════════════════════
  {
    const elegibles = unoPorFamilia([
      { id: "f2526", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "25/26" },
      { id: "f2627", nombre_referencia: "Seguro Flota", responsable: "MSA", año: "26/27" },
      { id: "fpam", nombre_referencia: "Seguro Flota", responsable: "PAM", año: "2026" },
    ])
    chequear("Regla → template", "En la regla aparece un solo Seguro Flota de MSA (el más nuevo) y el de PAM aparte: la campaña la decide el movimiento",
      "f2627 · fpam", elegibles.map(t => t.id).join(" · "), elegibles.map(t => t.id).join("|") === "f2627|fpam", "A-BUG-1303")
  }

  // ══ 🔎 LA PROPUESTA DICE QUÉ COINCIDE Y, EN LA TARJETA, PREFIERE LA EMITIDA ANTES (A-FEAT-1298) ═══
  {
    // 🧨 Antes: «Fecha no exacta: 2 días diferencia», sin decir que el importe era exacto.
    const m1 = motivoFechaNoExacta(2, true)
    const m2 = motivoFechaNoExacta(-3, true)
    const m3 = motivoFechaNoExacta(2, false)
    chequear("Doble audit", "El motivo dice «importe exacto» y, en la tarjeta, si la factura se emitió antes (lo esperado) o después del débito",
      "antes ✓ · después ⚠️ · fecha estimada", `${m1} | ${m2} | ${m3}`,
      m1.startsWith("Importe exacto · emitida 2 días antes") && m2.includes("DESPUÉS") && m3 === "Importe exacto · fecha estimada a 2 días del movimiento", "A-FEAT-1298")
    // Autopistas del Sol 08/04 $6.520,33: dos facturas del mismo importe, emitidas 1/4 y 1/7.
    const abr = ajusteTarjetaPorEmision("2026-04-08", "2026-04-01")
    const jul = ajusteTarjetaPorEmision("2026-04-08", "2026-07-01")
    chequear("Doble audit", "En el Asignar de la tarjeta, la emitida el 1/4 (7 días antes del débito) sube y la del 1/7 (posterior) baja",
      "+18 «Emitida 7d antes ✓» · -40", `${abr.puntos} «${abr.sello?.texto}» · ${jul.puntos}`,
      abr.puntos === 18 && abr.sello?.texto === "Emitida 7d antes ✓" && jul.puntos === -40, "A-FEAT-1298")
  }

  // ══ 🪙 UN CENTAVO DE DIFERENCIA NO ESCONDE UNA FACTURA PERFECTA (A-BUG-1305) ═════════════════════
  {
    // 🧨 Autopistas Urbanas: débito 16/01 $7.719,03, factura 14/01 $7.719,02 → el motor no la proponía.
    const ok = (_: any) => true
    const pool = [{ id: "otra", debitos: 7700 }, { id: "au", debitos: 7719.02 }]
    const r = elegirPorImporteCercano(pool, 7719.03, cf => cf.debitos, ok)
    const motivo = r ? motivoFechaNoExacta(2, true, r.dif) : ""
    chequear("Doble audit", "Autopistas Urbanas $7.719,03 contra factura $7.719,02: el motor la trae y el motivo dice cuánto difiere",
      "au · Importe difiere $ 0,01 · emitida 2 días antes", `${r?.cf.id} · ${motivo}`,
      r?.cf.id === "au" && motivo.startsWith("Importe difiere") && motivo.includes("0,01") && motivo.includes("emitida 2 días antes"), "A-BUG-1305")
    const empate = elegirPorImporteCercano([{ debitos: 100.01 }, { debitos: 99.99 }], 100, cf => cf.debitos, ok)
    const lejos = elegirPorImporteCercano([{ debitos: 98.5 }], 100, cf => cf.debitos, ok)
    const cero = elegirPorImporteCercano([{ debitos: 0 }], 0.5, cf => cf.debitos, ok)
    const exacto = elegirPorImporteCercano([{ debitos: 100 }], 100, cf => cf.debitos, ok)
    const fueraDeFecha = elegirPorImporteCercano([{ debitos: 99.99 }], 100, cf => cf.debitos, () => false)
    chequear("Doble audit", "Sin elegir: dos a la misma diferencia, más de $1, un importe en cero, el exacto (lo resuelve la búsqueda normal) o fuera de fecha",
      "null ×5", [empate, lejos, cero, exacto, fueraDeFecha].map(x => x === null ? "null" : "ELIGIÓ").join(" "),
      [empate, lejos, cero, exacto, fueraDeFecha].every(x => x === null), "A-BUG-1305")
  }

  // ══ 💵 UN CONSUMO EN DÓLARES VALE LO QUE SE DEBITÓ EN PESOS POR ÉL (A-BUG-1307) ════════════════════
  {
    // 🧨 vthebestpdf USD 29,95 (resumen 29/01) quedó conciliado por $0. Se pagó el 09/02: «Pago Visa Empresa»
    // $889.758,62 (los pesos) y otro de $43.128,00 (los dólares) → cambio 1.440.
    const deb = (id: string, fecha: string, debitos: number) => ({ id, tabla: "public.msa_galicia", fecha, debitos, nro_resumen: null, descripcion: "Pago Visa Empresa" })
    const debitos = [deb("pesos", "2026-02-09", 889758.62), deb("usd", "2026-02-09", 43128), deb("otro", "2026-01-12", 220250.1)]
    const r = pesosDeConsumosUsd({ consumos: [{ id: "vthe", usd: 29.95 }], usdPagado: 29.95, fechaPago: "2026-02-09", pesosPagados: 889758.62, debitos })
    chequear("Doble audit", "USD 29,95 pagados con el débito de $43.128,00 → cambio 1.440 y el consumo vale $43.128,00 (no $0)",
      "1440 · usd · 43128", r.ok ? `${r.tc} · ${r.debito.id} · ${r.pesos[0].pesos}` : r.aviso,
      r.ok && r.tc === 1440 && r.debito.id === "usd" && r.pesos[0].pesos === 43128, "A-BUG-1307")
    const dos = pesosDeConsumosUsd({ consumos: [{ id: "a", usd: 10 }, { id: "b", usd: 20.01 }], usdPagado: 30.01, fechaPago: "2026-02-09", pesosPagados: 889758.62, debitos: [deb("pesos", "2026-02-09", 889758.62), deb("usd", "2026-02-09", 43333.33)] })
    const suma = dos.ok ? Math.round(dos.pesos.reduce((a, p) => a + p.pesos, 0) * 100) / 100 : 0
    chequear("Doble audit", "Con dos consumos, la suma en pesos da exactamente el débito (el último absorbe el redondeo)",
      "43333.33", String(suma), suma === 43333.33, "A-BUG-1307")
    const ambiguo = pesosDeConsumosUsd({ consumos: [{ id: "a", usd: 10 }], usdPagado: 10, fechaPago: "2026-02-09", pesosPagados: 889758.62, debitos: [deb("pesos", "2026-02-09", 889758.62), deb("x", "2026-02-09", 14400), deb("y", "2026-02-09", 500)] })
    const sinPago = pesosDeConsumosUsd({ consumos: [{ id: "a", usd: 10 }], usdPagado: 0, fechaPago: "", pesosPagados: 0, debitos })
    chequear("Doble audit", "No adivina: dos débitos candidatos el mismo día, o sin «SU PAGO EN USD» → aviso, nada se escribe",
      "aviso · aviso", `${ambiguo.ok ? "ELIGIÓ" : "aviso"} · ${sinPago.ok ? "ELIGIÓ" : "aviso"}`, !ambiguo.ok && !sinPago.ok, "A-BUG-1307")

    // 💵 A-FEAT-1312 — la cuota guarda USD + TC y el extracto queda en dólares. Diciembre: Dropbox USD 119,88 +
    // vthebestpdf USD 29,95 = SU PAGO EN USD 149,83; con un débito que no da cambio redondo, el último absorbe el
    // redondeo y aun así cada cuota cumple monto = monto_usd × tipo_cambio (al centavo).
    const dic = pesosDeConsumosUsd({ consumos: [{ id: "dropbox", usd: 119.88 }, { id: "vthe", usd: 29.95 }], usdPagado: 149.83, fechaPago: "2026-01-12", pesosPagados: 929356.67, debitos: [deb("pesos", "2026-01-12", 929356.67), deb("usd", "2026-01-12", 216003.27)] })
    const filas = dic.ok ? dic.pesos.map(p => cuotaDeConsumoUsd(p.pesos, p.id === "dropbox" ? 119.88 : 29.95)) : []
    const cierran = filas.length === 2 && filas.every(f => f.tipo_cambio != null && Math.abs(f.monto_usd * f.tipo_cambio - f.monto) < 0.01)
    const sumaDic = Math.round(filas.reduce((a, f) => a + f.monto, 0) * 100) / 100
    chequear("Doble audit", "Cuota en USD: guarda USD y TC, cada una cumple USD × TC = pesos y entre las dos suman el débito",
      "cierran · 216003.27", `${cierran ? "cierran" : "NO cierran"} · ${sumaDic}`, cierran && sumaDic === 216003.27, "A-FEAT-1312")
  }

  // ══ 🧩 EL ASISTENTE DE TEMPLATES DESDE LA CONCILIACIÓN: cuotas de la CAMPAÑA y la del mes (A-FEAT-1302) ══
  {
    // 🧨 Antes: siempre ene→dic del año de HOY. Orbith (MA, anual) creado desde un débito del 02/12/2025
    // tenía que dar 12 cuotas de 2025, no de 2026; y una campaña jul–jun, jul-25→jun-26.
    const anual = generarCuotasTemplate({ abierto: false, config: { tipo: "mensual", dia_mes: 2 }, montoBase: 83000, campana: "2025", periodicidad: "anual" })
    const bianual = generarCuotasTemplate({ abierto: false, config: { tipo: "mensual", dia_mes: 31 }, montoBase: 10, campana: "25/26", periodicidad: "bianual" })
    chequear("Templates", "Mensual anual 2025 → 12 cuotas de 2025, día del movimiento; campaña 25/26 → jul-25 a jun-26, el 31 se ajusta al último día",
      "12 · 2025-01-02 → 2025-12-02 · 2025-07-31 … 2026-02-28 … 2026-06-30",
      `${anual.length} · ${anual[0]?.fecha_vencimiento} → ${anual[11]?.fecha_vencimiento} · ${bianual[0]?.fecha_vencimiento} … ${bianual[7]?.fecha_vencimiento} … ${bianual[11]?.fecha_vencimiento}`,
      anual.length === 12 && anual[0].fecha_vencimiento === "2025-01-02" && anual[11].fecha_vencimiento === "2025-12-02"
        && bianual[0].fecha_vencimiento === "2025-07-31" && bianual[7].fecha_vencimiento === "2026-02-28" && bianual[11].fecha_vencimiento === "2026-06-30", "A-FEAT-1302")
    const abierto = generarCuotasTemplate({ abierto: true, config: { tipo: "mensual", dia_mes: 2 }, montoBase: 1, campana: "2025", periodicidad: "anual" })
    const especificas = generarCuotasTemplate({ abierto: false, config: { tipo: "cuotas_especificas", meses_especificos: [3, 9], dia_default: 10 }, montoBase: 5, campana: "25/26", periodicidad: "bianual" })
    chequear("Templates", "Abierto (lo cargan los movimientos) → sin cuotas; cuotas específicas mar y sep en 25/26 → sep-25 y mar-26",
      "0 · 2025-09-10 · 2026-03-10", `${abierto.length} · ${especificas.map(c => c.fecha_vencimiento).join(" · ")}`,
      abierto.length === 0 && especificas.map(c => c.fecha_vencimiento).join(" · ") === "2025-09-10 · 2026-03-10", "A-FEAT-1302")
    const cuotas = anual.map((c, i) => ({ id: `c${i + 1}`, fecha_vencimiento: c.fecha_vencimiento }))
    const elegida = cuotaDelMovimiento(cuotas, "2025-12-02")
    const ninguna = cuotaDelMovimiento(cuotas, "2026-01-05")
    chequear("Templates", "🔗 El movimiento del 02/12/2025 se ata a la cuota de diciembre (no se crea una extra); de otro año, ninguna",
      "c12 · null", `${elegida?.id} · ${ninguna === null ? "null" : ninguna.id}`, elegida?.id === "c12" && ninguna === null, "A-FEAT-1302")
  }

  // ══ 🔗 LA REGLA CONCILIA LA CUOTA PENDIENTE DEL MES, NO CREA OTRA (A-FEAT-1302) ═══════════════════════
  {
    // 🧨 Con las cuotas jun–dic de Seguro Chalet cargadas, conciliar junio insertaba una nueva: mes duplicado.
    const chalet = [
      { id: "jun-a", fecha_vencimiento: "2026-06-26", monto: 121636.43, estado: "pendiente" },
      { id: "jun-b", fecha_vencimiento: "2026-06-26", monto: 121636.43, estado: "pendiente" },
      { id: "jul-a", fecha_vencimiento: "2026-07-26", monto: 121636.43, estado: "pendiente" },
      { id: "may-a", fecha_vencimiento: "2026-05-26", monto: 121636.43, estado: "conciliado" },
    ]
    const primera = cuotaPendienteDelMes(chalet, "2026-06-25", 121636.43)
    const segunda = cuotaPendienteDelMes(chalet.filter(c => c.id !== primera?.id), "2026-06-25", 121636.43)
    const mayo = cuotaPendienteDelMes(chalet, "2026-05-26", 121636.43)
    chequear("Templates", "Dos cargos de Chubb en junio toman las DOS cuotas pendientes de junio; mayo (ya conciliada) → crea nueva",
      "jun-a · jun-b · null", `${primera?.id} · ${segunda?.id} · ${mayo === null ? "null" : mayo.id}`,
      primera?.id === "jun-a" && segunda?.id === "jun-b" && mayo === null, "A-FEAT-1302")
  }

  // ══ ✍️ EL DETALLE DE UNA REGLA NUEVA SE COPIA AUNQUE REPITA LA CUENTA (A-DEC-1012) ════════════════
  {
    // 🧨 Chubb de abril: la regla decía «Seguro Chalet», la cuenta también → se descartaba y la cuota quedaba
    // con la descripción del banco «CHUBB SEGUROS 0000002962727-014-000».
    const nueva = detalleDeRegla({ detalle: "Seguro Chalet", categ: "Seguro Chalet", template_id: "tpl" })
    const vieja = detalleDeRegla({ detalle: "Comision Transferencias", categ: "Comision Transferencias", template_id: null })
    const viejaAporta = detalleDeRegla({ detalle: "Percepcion de IVA Tarjeta", categ: "Percepcion IVA", template_id: null })
    chequear("Regla → template", "Regla nueva: el detalle se copia aunque repita la cuenta; regla vieja: sólo si aporta (A-FEAT-138)",
      "Seguro Chalet · null · Percepcion de IVA Tarjeta", `${nueva} · ${vieja} · ${viejaAporta}`,
      nueva === "Seguro Chalet" && vieja === null && viejaAporta === "Percepcion de IVA Tarjeta", "A-DEC-1012")
  }

  // ══ 🏷️ DETALLE FIJO POR PROVEEDOR (A-FEAT-1296) ═══════════════════════════════════════════════════
  {
    const COOP = "30545813556", TEL = "30639453738"
    const fijos = [
      { id: "casco", cuit: COOP, detalle: "Luz Casco NZ Total", monto_referencia: 603027.68, activo: true },
      { id: "port", cuit: COOP, detalle: "Luz Casa Porteria", monto_referencia: 56011.27, activo: true },
      { id: "tel", cuit: TEL, detalle: "Flota Celulares", monto_referencia: 164259.82, activo: true },
      { id: "viejo", cuit: TEL, detalle: "Celulares viejo", monto_referencia: null, activo: false },
    ]
    // Coopser de abril: 625.411,63 (casco) y 67.292,55 (portería) — los montos cambian pero guardan relación.
    const casco = elegirDetalleFijo(fijos, "30-54581355-6", 625411.63)
    const port = elegirDetalleFijo(fijos, COOP, 67292.55)
    const tel = elegirDetalleFijo(fijos, TEL, 999999)
    chequear("Detalle fijo", "Coopser elige el suministro por monto (casco / portería); Telecom con un solo fijo activo lo usa aunque el monto cambie",
      "Luz Casco NZ Total · Luz Casa Porteria · Flota Celulares", `${casco.elegido?.detalle} · ${port.elegido?.detalle} · ${tel.elegido?.detalle}`,
      casco.elegido?.id === "casco" && port.elegido?.id === "port" && tel.elegido?.id === "tel", "A-FEAT-1296")
    // Un monto que no se parece a ninguno no elige: sugiere los dos.
    const raro = elegirDetalleFijo(fijos, COOP, 300000)
    const nada = elegirDetalleFijo(fijos, "20111111112", 1000)
    chequear("Detalle fijo", "Si el monto no se parece a ningún suministro, no elige y sugiere; un proveedor sin fijos no devuelve nada",
      "null + 2 sugeridos · null + 0", `${raro.elegido?.id ?? "null"} + ${raro.sugeridos.length} sugeridos · ${nada.elegido?.id ?? "null"} + ${nada.sugeridos.length}`,
      raro.elegido === null && raro.sugeridos.length === 2 && nada.elegido === null && nada.sugeridos.length === 0, "A-FEAT-1296")
    // Nunca pisa lo del usuario; el autogenerado sí se reemplaza.
    const emisor = "COOPERATIVA DE PROVISION DE SERVICIOS ELECTRICOS PUBLICOS Y SOCIALES DE SAN PEDRO LTDA"
    chequear("Detalle fijo", "Sólo se pone si el detalle está vacío o es el autogenerado «Factura 1-N - EMISOR»; lo escrito a mano manda",
      "true · true · false", `${admiteDetalleFijo(null)} · ${admiteDetalleFijo(`Factura 1-194237 - ${emisor}`, emisor, 194237)} · ${admiteDetalleFijo("Luz galpón nuevo", emisor)}`,
      admiteDetalleFijo(null) && admiteDetalleFijo(`Factura 1-194237 - ${emisor}`, emisor, 194237) && !admiteDetalleFijo("Luz galpón nuevo", emisor), "A-FEAT-1296")
  }

  // ══ 🧱 LA TARJETA TAMBIÉN BUSCA EN LAS FACTURAS «ANTERIORES» LIBRES (A-DEC-1014) ═════════════════
  {
    // 🧨 Resumen 29/01: Coopser 37.577,25 tenía su factura exacta en `anterior` y el motor no la veía.
    const pool = anterioresLibres([
      { id: "coop", estado: "anterior" },        // libre → se ofrece
      { id: "pagadaCC", estado: "anterior" },    // ya atada a un movimiento de la cuenta corriente → no
      { id: "medicus", estado: "credito" },      // las de crédito, como siempre
    ], new Set(["pagadaCC"]))
    chequear("Doble audit", "En la tarjeta se ofrecen las facturas «anteriores» que nadie pagó todavía; una ya atada a otro movimiento no",
      "coop · medicus", pool.map(f => f.id).join(" · "), pool.map(f => f.id).join("|") === "coop|medicus", "A-DEC-1014")
  }

  // ══ 🛡️ PÓLIZAS DE SEGURO — lector, controles y reparto (A-FEAT-1309) ═══════════════════════════
  {
    // Textos REALES (recortados) de los PDFs de Federación Patronal del 2026, ya en renglones.
    const FLOTA = [
      "FRENTE DE PÓLIZA  Póliza impresa el dia  24-07-2026",
      "SECCIÓN  AUTOMOTORES  PRODUCTO  AUTOMOTORES  PÓLIZA  35881289",
      "Desde 12:00 Hs. del 29-07-2026  Hasta 12:00 Hs. del 29-07-2027",
      "Endoso  Lugar de emisión  CÓDIGO POSTAL  2930",
      "0  La Plata, Buenos Aires, Argentina  PROVINCIA  BUENOS AIRES",
      "Póliza anterior  Fecha de emisión  CONDICIÓN DE IVA  INSCRIPTO",
      "CUIT/DNI  30617786016 /",
      "34160783  22-07-2026",
      "PLAN DE PAGO DEL ENDOSO  PERÍODO FACTURADO",
      "NÚMERO  VENCIMIENTO  IMPORTE  Números de Inscripción:",
      "29-07-2026  29-01-2027",
      "1/12  01-08-2026  $  556,094.00",
      "2/12  01-09-2026  $  556,094.00",
      "LIQUIDACION DEL PREMIO",
      "3/12  01-10-2026  $  556,094.00",
      "4/12  01-11-2026  $  556,094.00",
      "PRIMA",
      "5/12  01-12-2026  $  556,094.00",
      "$  2,477,346.66",
      "6/12  01-01-2027  $  556,094.09",
      "I.V.A.  SELLADO  OTROS IMP. Y TASAS",
      "$  627,502.00  $  39,564.00  $  39,218.88",
      "PREMIO DEL ENDOSO",
      "$  3,320,876.54",
      "TOTAL:  $  3,336,564.09  MONEDA CONTRATO  TEA  CARGO FINANCIERO",
      "PESOS  30.00%  $  137,245.00",
      "FEDERACIÓN PATRONAL SEGUROS S.A.U.,CUIT: 33-70736658-9",
      "Póliza  35881289 / 10  Póliza  35881289 /10",
      "Modelo  VW TIGUAN 2.0 TSI EXCLUSIVE TIP L/12  Vigencia desde",
      "Año  2012  Plan Pago  EN CASO DE SINIESTRO",
      "Patente  LMW911  del conductor.",
      "Póliza  35881289 / 13  Póliza  35881289 /13",
      "Modelo  VW GOL TREND 1.6 5 P.  Vigencia desde",
      "Año  2012  Plan Pago",
      "Patente  LFO201  del conductor.",
      "Póliza  35881289 / 4  Póliza  35881289 /4",
      "Modelo  DEUTZ AGCO ALLIS  Vigencia desde",
      "Año  2004  Plan Pago",
      "Patente  AAA111  del conductor.",
      "CERTIFICADO:  4",
      "PREMIO:  1,448,236.19",
      "CERTIFICADO:  10",
      "PREMIO:  1,478,549.78",
      "CERTIFICADO:  13  Pag.  26",
      "PREMIO:  409,778.13",
    ].join("\n")
    const f = parsearPoliza(FLOTA)
    // 🧨 La prima del frente comparte renglón con las cuotas: leer la de la cuota daba 556.094.
    chequear("Pólizas", "Frente de la Flota: póliza, endoso 0, póliza anterior, vigencia, total y la PRIMA (no la cuota que está al lado)",
      "35881289 · 0 · 34160783 · 2026-07-29→2027-07-29 · 3336564.09 · prima 2477346.66 · TEA 30 · cargo 137245",
      `${f.poliza} · ${f.endoso} · ${f.polizaAnterior} · ${f.vigenciaDesde}→${f.vigenciaHasta} · ${f.total} · prima ${f.frente?.prima} · TEA ${f.frente?.tea} · cargo ${f.frente?.cargoFinanciero}`,
      f.poliza === "35881289" && f.endoso === 0 && f.polizaAnterior === "34160783" && f.vigenciaDesde === "2026-07-29" && f.total === 3336564.09 && f.frente?.prima === 2477346.66 && f.frente?.cargoFinanciero === 137245, "A-FEAT-1309")
    chequear("Pólizas", "Las 6 cuotas del endoso suman el total; el AAA111 (maquinaria sin patente) no se toma como patente",
      "6 cuotas · última 556094.09 · cert 4 sin patente",
      `${f.cuotasEndoso.length} cuotas · última ${f.cuotasEndoso.at(-1)?.importe} · cert 4 ${f.vehiculos.find(v => v.certificado === 4)?.patente ?? "sin patente"}`,
      f.cuotasEndoso.length === 6 && f.cuotasEndoso.at(-1)?.importe === 556094.09 && f.vehiculos.find(v => v.certificado === 4)?.patente === null, "A-FEAT-1309")
    const cf = controlarPoliza(f)
    chequear("Pólizas", "Integridad de la Flota: cuotas = total y primas de los vehículos = total → no frena",
      "frena=false", `frena=${cf.frena} (${cf.integridad.map(c => c.que + (c.ok ? " ✓" : " ✗")).join(", ")})`, !cf.frena && cf.integridad.length === 2, "A-FEAT-1309")

    // El reparto: Tiguan → MA, Gol → JMS, el resto MSA, por la prima de cada vehículo.
    const rep = repartoDeLaPoliza(f)
    const cuota = repartirImporte(556094, rep)
    const de = (r: string) => cuota.find(x => x.responsable === r)?.importe
    const sumaCuota = Math.round(cuota.reduce((s, x) => s + x.importe, 0) * 100) / 100
    chequear("Pólizas", "Reparto de la cuota de $556.094 de la Flota por la prima de cada vehículo — las partes suman exacto la cuota",
      "MA 246424.96 · MSA 241372.69 · JMS 68296.35 · suma 556094",
      `MA ${de("MA")} · MSA ${de("MSA")} · JMS ${de("JMS")} · suma ${sumaCuota}`,
      rep?.base === "prima de cada vehículo" && sumaCuota === 556094 && de("MA") === 246424.96 && de("JMS") === 68296.35 && de("MSA") === 241372.69, "A-FEAT-1309")

    // Si las primas no suman el total, el papel se contradice (o se leyó mal): FRENA.
    const roto = controlarPoliza({ ...f, vehiculos: f.vehiculos.map(v => v.certificado === 10 ? { ...v, prima: 1478549.87 } : v) })
    chequear("Pólizas", "Una prima mal leída (dígitos invertidos) hace que las primas no sumen el total → frena",
      "frena=true", `frena=${roto.frena}`, roto.frena, "A-FEAT-1309")

    // La factura original de una BAJA de Accidentes Personales: nota de crédito, conceptos que cierran.
    const AP = [
      "FACTURA ORIGINAL",
      "SECCIÓN  12 - ACCIDENTES PERSONALES  PRODUCTO  A.P. PRESTACIONAL  PÓLIZA 10183421",
      "Asegurado  Domicilio  Fecha de Emisión",
      "SAN MANUEL S R L  ESTANCIA NAZARENA N* S/N  07-05-2026",
      "CUIT/ DNI  Localidad  Endoso",
      "30617786016 /  SAN PEDRO (BS. AS.)  2",
      "IVA  Provincia  Período Facturado Desde",
      "INSCRIPTO  BUENOS AIRES  07-05-2026",
      "Asegurado nro.  Código Postal  Período Facturado Hasta",
      "3938413  2930  06-02-2027",
      "PLAN DE PAGO DEL ENDOSO  LIQUIDACIÓN DE PREMIO Y OTROS CONCEPTOS",
      "NRO.  VENCIMIENTO  IMPORTE  PRIMA  $  -95,170.11",
      "1/2  06-06-2026  $  -65,449.80",
      "RECARGOS  $  -8,793.72",
      "2/2  06-07-2026  $  -65,449.80  SUBTOTAL GRAVADO (PRECIO SIN IMPUESTOS)  $  -103,963.83",
      "IVA  $  -21,832.40",
      "SUB-TOTAL  $  -125,796.23",
      "PERCEPCION IVA  $  -3,118.91",
      "PERCEPCION IIBB BUENOS AIRES  $  -840.86",
      "TASA SUPERINTENDENCIA  $  -623.78",
      "CONTRIBUCIÓN INSTITUTO DE SERVICIOS SOCIALES  $  -519.82",
      "MONTO TOTAL DEL PREMIO  $  -130,899.60",
      "BAJA PERSONAL",
      "Cert.  Documento  Apellido y Nombre  FE NACIMIENTO  BENEFICIARIO",
      "3  DNI  33318934  BARRETO WILSON SEVERIANO  25-09-1988  CONTRATANTE/TOMADOR",
      "NOMINA ACTIVA",
      "Cert.  Documento  Apellido y Nombre  FE NACIMIENTO  BENEFICIARIO",
      "1  DNI  27673775  PAZ ELVIO CRESENCIO  27-07-1978  CONTRATANTE/TOMADOR",
      "2  DNI  16598383  VULCANO HERIBERTO FABIAN  25-11-1964  CONTRATANTE/TOMADOR",
    ].join("\n")
    const a = parsearPoliza(AP)
    const ca = controlarPoliza(a)
    chequear("Pólizas", "Baja de Accidentes Personales: endoso 2, nota de crédito, período, 7 conceptos que suman el total, subtotales que cierran",
      "10183421 · 2 · NC · 2026-05-07→2027-02-06 · -130899.6 · 7 conceptos · frena=false",
      `${a.poliza} · ${a.endoso} · ${a.esNotaCredito ? "NC" : "FC"} · ${a.periodoDesde}→${a.periodoHasta} · ${a.total} · ${a.conceptos.filter(c => !c.esSubtotal).length} conceptos · frena=${ca.frena}`,
      a.poliza === "10183421" && a.endoso === 2 && a.esNotaCredito && a.periodoHasta === "2027-02-06" && a.total === -130899.6 && a.conceptos.filter(c => !c.esSubtotal).length === 7 && !ca.frena, "A-FEAT-1309")
    const repAP = repartoDeLaPoliza(a)
    chequear("Pólizas", "La nómina distingue baja y activas; un endoso de BAJA es del que se va (Barreto → MSA), no de los que quedan",
      "baja BARRETO · activas PAZ, VULCANO · MSA 100%",
      `baja ${a.personas.filter(x => x.movimiento === "baja").map(x => x.nombre.split(" ")[0]).join()} · activas ${a.personas.filter(x => x.movimiento === "activa").map(x => x.nombre.split(" ")[0]).join(", ")} · ${repAP?.partes.map(x => `${x.responsable} ${Math.round(x.proporcion * 100)}%`).join(" · ")}`,
      repAP?.partes.length === 1 && repAP.partes[0].responsable === "MSA" && responsableDe({ documento: "20276737751" }).responsable === "MA", "A-FEAT-1309")

    // 🧨 La cuota del consolidado es la SUMA de los endosos: 48.996 = 15.740 (endoso 0, Elvio → MA) +
    // 33.256 (endoso 1, alta de Barreto y Vulcano → MSA). Repartirla por la nómina activa daba MA un tercio.
    const persona = (doc: string, nombre: string, movimiento: "alta" | "baja" | "activa") => ({ certificado: 1, documento: doc, nombre, movimiento, sumaAsegurada: null })
    const e0 = { ...a, endoso: 0, personas: [persona("27673775", "PAZ ELVIO", "activa")], cuotasEndoso: [{ nro: 2, de: 12, vencimiento: "2026-03-06", importe: 15740 }] }
    const e1 = { ...a, endoso: 1, personas: [persona("33318934", "BARRETO", "alta"), persona("16598383", "VULCANO", "alta"), persona("27673775", "PAZ ELVIO", "activa")], cuotasEndoso: [{ nro: 1, de: 11, vencimiento: "2026-03-06", importe: 33256 }] }
    const porCuota = repartoDeLasCuotas([e0, e1, e1])?.get("2026-03-06") ?? []
    chequear("Pólizas", "La cuota 2/12 de Accidentes Personales (48.996) se reparte por endoso: Elvio MA 15.740 · altas MSA 33.256 (un endoso repetido no se cuenta dos veces)",
      "MSA 33256 · MA 15740", porCuota.map(x => `${x.responsable} ${x.importe}`).join(" · "),
      porCuota.length === 2 && porCuota.find(x => x.responsable === "MA")?.importe === 15740 && porCuota.find(x => x.responsable === "MSA")?.importe === 33256, "A-FEAT-1309")

    // Cotejo contra lo cargado: avisa, no frena. Número = póliza · punto de venta = endoso.
    const bien = cotejarConComprobante(a, { numero: "10183421", punto_venta: "2", total: 130899.6, esNotaCredito: true })
    const mal = cotejarConComprobante(a, { numero: "10183422", punto_venta: "2", total: 130899.6, esNotaCredito: false })
    chequear("Pólizas", "Cotejo con el comprobante cargado: la NC bien cargada no avisa; con otro número y como factura, dos avisos",
      "0 · 2", `${bien.length} · ${mal.length}`, bien.length === 0 && mal.length === 2, "A-FEAT-1309")

    // 🧨 Rótulo huérfano (Flota 07/2025): el importe de la CONTRIBUCIÓN quedó en el renglón de TOTALES y
    // su rótulo abajo. Descartarlo dejaba la factura sin cerrar por $13.439,15 (y frenaba).
    const huerf = parsearPoliza([
      "FACTURA ORIGINAL",
      "SECCIÓN  AUTOMOTORES  PRODUCTO  AUTOMOTORES  PÓLIZA  34160783",
      "PLAN DE PAGO DEL ENDOSO  LIQUIDACIÓN DE PREMIO Y OTROS CONCEPTOS",
      "NRO.  VENCIMIENTO  IMPORTE  PRIMA  $  100,000.00",
      "1/1  01-08-2025  $  134,439.15",
      "IVA  $  21,000.00",
      "TOTALES:  $  134,439.15  $  13,439.15",
      "CONTRIBUCIÓN INSTITUTO DE SERVICIOS SOCIALES",
      "MONTO TOTAL DEL PREMIO  $  134,439.15",
    ].join("\n"))
    chequear("Pólizas", "Un importe cuyo rótulo quedó en el renglón de abajo se toma con ese rótulo y la factura cierra",
      "CONTRIBUCIÓN INSTITUTO DE SERVICIOS SOCIALES 13439.15 · frena=false",
      `${huerf.conceptos.at(-1)?.concepto} ${huerf.conceptos.at(-1)?.importe} · frena=${controlarPoliza(huerf).frena}`,
      huerf.conceptos.at(-1)?.concepto === "CONTRIBUCIÓN INSTITUTO DE SERVICIOS SOCIALES" && !controlarPoliza(huerf).frena, "A-FEAT-1309")

    // Los dos ejes (usuario 2026-10-20): Alondra contable e interno MA, Rojas Celia PAM, Tiguan contable MSA / interno MA.
    const alondra = responsableDe({ documento: "47926088" })
    const rojas = responsableDe({ documento: "27203615362" })
    const tiguan = responsableDe({ patente: "LMW911" })
    const repContableFlota = repartoDeLaPoliza(f, undefined, "contable")
    chequear("Pólizas", "Responsable contable e interno por bien; la Flota por eje CONTABLE es toda MSA (el reparto interno es otro eje)",
      "MA/MA · PAM/PAM · MSA/MA · Flota contable: MSA 100%",
      `${alondra.contable}/${alondra.interno} · ${rojas.contable}/${rojas.interno} · ${tiguan.contable}/${tiguan.interno} · Flota contable: ${repContableFlota?.partes.map(x => `${x.responsable} ${Math.round(x.proporcion * 100)}%`).join(" · ")}`,
      alondra.contable === "MA" && alondra.interno === "MA" && rojas.contable === "PAM" && tiguan.contable === "MSA" && tiguan.interno === "MA"
        && repContableFlota?.partes.length === 1 && repContableFlota.partes[0].responsable === "MSA", "A-FEAT-1309")

    // «¿Tenemos todas?» — datos reales de la Vida colectivo 670821 y la serie de 12.902 sin póliza.
    // 🧨 Federación COMPENSA las NC con las cuotas siguientes: la de feb (42.300,55) no se debita porque
    // la NC de dic (−47.481,60) la cubre. Esperar el débito de la cuota daba «falta el débito» en falso.
    const vida: CuotaEsperada[] = [
      { poliza: "670821", vencimiento: "2025-09-10", importe: 245038.54 },
      { poliza: "670821", vencimiento: "2025-12-01", importe: -47481.6 },
      { poliza: "670821", vencimiento: "2026-02-10", importe: 42300.55 },
      { poliza: "670821", vencimiento: "2026-04-10", importe: 34888.08 },
      { poliza: "670821", vencimiento: "2026-04-10", importe: -82166.7 },
      { poliza: "670821", vencimiento: "2026-06-10", importe: 28118.58 },
      { poliza: "10200836", vencimiento: "2026-04-13", importe: 11179 },
      { poliza: "10200836", vencimiento: "2026-05-13", importe: 11179 },
      { poliza: "10200836", vencimiento: "2026-10-13", importe: 11179 },
    ]
    const banco: MovimientoAseguradora[] = [
      { id: "vida", fecha: "2025-09-10", debitos: 245038.54, creditos: 0 },
      { id: "x1", fecha: "2026-02-18", debitos: 12902, creditos: 0 },
      { id: "ap", fecha: "2026-04-17", debitos: 11179, creditos: 0 },
      { id: "reint", fecha: "2026-04-20", debitos: 0, creditos: 30000 },
    ]
    const ctl = controlarDebitos(vida, banco, { desde: "2025-07-01", hasta: "2026-09-23" })
    const res = (pol: string, v: string) => ctl.cuotas.find(c => c.poliza === pol && c.vencimiento === v)?.resultado
    chequear("Pólizas", "Las NC se compensan con las cuotas siguientes: la Vida 670821 sólo se debita la 1ª, y eso está bien (no «falta el débito»)",
      "ok · nc · compensada · nc · compensada", ["2025-09-10", "2025-12-01", "2026-02-10", "2026-04-10", "2026-06-10"].map(v => res("670821", v)).join(" · "),
      ["2025-09-10", "2025-12-01", "2026-02-10", "2026-04-10", "2026-06-10"].map(v => res("670821", v)).join(" · ") === "ok · nc · compensada · nc · compensada", "A-FEAT-1309")
    chequear("Pólizas", "Débito de 12.902 que no es cuota de ninguna póliza = PÓLIZA A CARGAR; cuota vencida sin débito = falta; la futura, a vencer; el reintegro sin NC se marca",
      "x1 sin-poliza · reint reintegro-sin-nc · may falta-debito · oct a-vencer · abr ok",
      `x1 ${ctl.movimientos.find(m => m.id === "x1")?.resultado} · reint ${ctl.movimientos.find(m => m.id === "reint")?.resultado} · may ${res("10200836", "2026-05-13")} · oct ${res("10200836", "2026-10-13")} · abr ${res("10200836", "2026-04-13")}`,
      ctl.movimientos.find(m => m.id === "x1")?.resultado === "sin-poliza" && ctl.movimientos.find(m => m.id === "reint")?.resultado === "reintegro-sin-nc"
        && res("10200836", "2026-05-13") === "falta-debito" && res("10200836", "2026-10-13") === "a-vencer" && res("10200836", "2026-04-13") === "ok", "A-FEAT-1309")
    // Póliza con endosos viejos no cargados (Vida 644709: sólo el 7 y el 8): se usa el último consolidado,
    // y si dice que de la cuota queda menos (6.598,75 de 21.574,03), se espera ese saldo en el banco.
    const esp644 = cuotasEsperadas([
      { poliza: "644709", endoso: 8, cuotas: [{ vencimiento: "2025-08-10", importe: 21574.03 }], consolidado: { fecha: "2025-08-11", cuotas: [
        { vencimiento: "2025-07-10", importe: 34204.07, saldo: 0 }, { vencimiento: "2025-08-10", importe: 21574.03, saldo: 6598.75 }] } },
    ])
    const c644 = controlarDebitos(esp644, [{ id: "s", fecha: "2025-08-11", debitos: 6598.75, creditos: 0 }], { desde: "2025-07-01", hasta: "2026-09-23" })
    chequear("Pólizas", "Endosos incompletos → se usa el consolidado; la cuota compensada sin débito está bien y la de saldo 6.598,75 casa con el débito de ese importe",
      "compensada · ok 6598.75", c644.cuotas.map(c => c.resultado === "ok" ? `ok ${c.debitado}` : c.resultado).join(" · "),
      c644.cuotas.map(c => c.resultado === "ok" ? `ok ${c.debitado}` : c.resultado).join(" · ") === "compensada · ok 6598.75", "A-FEAT-1309")
    chequear("Pólizas", "El movimiento se reconoce por las leyendas adicionales, esté o no conciliado",
      "true · false", `${esDeLaAseguradora({ leyendas_adicionales_1: "FEDERACION PATRO", leyendas_adicionales_2: "SEGUROS" })} · ${esDeLaAseguradora({ leyendas_adicionales_1: "COOPSER", leyendas_adicionales_2: null })}`,
      esDeLaAseguradora({ leyendas_adicionales_1: "FEDERACION PATRO" }) && !esDeLaAseguradora({ leyendas_adicionales_1: "COOPSER" })
        // usada dentro de .filter() (que le pasa el número de fila como 2º argumento) tiene que andar igual
        && [{ leyendas_adicionales_1: "FEDERACION PATRO" }, { leyendas_adicionales_1: "COOPSER" }].filter(esDeLaAseguradora).length === 1, "A-FEAT-1309")

    // Los renglones del PDF: se agrupan por altura, de izquierda a derecha.
    const renglones = armarRenglones([
      { s: "$", x: 300, y: 500, h: 8 }, { s: "627,502.00", x: 310, y: 500.5, h: 8 },
      { s: "PRIMA", x: 100, y: 520, h: 8 }, { s: "I.V.A.", x: 100, y: 500, h: 8 },
    ])
    chequear("Pólizas", "Los textos del PDF se arman en renglones por su altura (medio punto de diferencia sigue siendo el mismo renglón)",
      "PRIMA | I.V.A.  $  627,502.00", renglones.join(" | "), renglones.join(" | ") === "PRIMA | I.V.A.  $  627,502.00", "A-FEAT-1309")
  }
  // ══ 🧾 IMPUESTOS VENCIDOS O PRÓXIMOS A VENCER — aviso en Principal (A-FEAT-1319) ═══════════════
  {
    const tpl = (o: Partial<CuotaImpuesto["template"]> = {}): CuotaImpuesto["template"] => ({
      nombre_referencia: "Inmobiliario Casco", responsable: "MSA", cuenta_agrupadora: "Impuestos Rurales", categ: "Impuesto inmobiliario", alertas: "30 dias antes", ...o,
    })
    const cuota = (id: string, estado: string, venc: string | null, o: Partial<CuotaImpuesto> = {}): CuotaImpuesto =>
      ({ id, estado, fecha_vencimiento: venc, fecha_estimada: null, monto: 1000, template: tpl(), ...o })
    const hoy = "2026-10-21"
    const r = impuestosAAvisar([
      cuota("vencido", "pendiente", "2026-10-10"),
      cuota("pagar", "pagar", "2026-09-30"),
      cuota("pagado", "pagado", "2026-10-01"),
      cuota("debito", "debito", "2026-10-01"),                          // débito automático = pagado
      cuota("en30", "pendiente", "2026-11-20"),                         // 30 días antes → entra
      cuota("en31", "pendiente", "2026-11-21"),                         // fuera de la anticipación
      cuota("iibb10", "pendiente", "2026-11-05", { template: tpl({ alertas: null, nombre_referencia: "IIBB" }) }), // 15 días, aviso por defecto 10 → no
      cuota("iibb9", "pendiente", "2026-10-30", { template: tpl({ alertas: null, nombre_referencia: "IIBB" }) }),  // 9 días → sí
      cuota("estimada", "pendiente", null, { fecha_estimada: "2026-10-15" }), // sin vencimiento: usa la estimada
      cuota("luz", "pendiente", "2026-10-01", { template: tpl({ cuenta_agrupadora: "Servicios", nombre_referencia: "Luz" }) }), // no es impuesto
      cuota("banco", "pendiente", "2026-10-01", { template: tpl({ solo_conciliacion: true }) }), // se cobra solo en el banco
    ], hoy)
    chequear("Impuestos", "Vencidos sin pagar (pendiente o pagar, también con fecha estimada); pagados, débito automático, servicios y sólo-conciliación no avisan",
      "pagar · vencido · estimada", r.vencidos.map(x => x.id).join(" · "),
      r.vencidos.map(x => x.id).join(" · ") === "pagar · vencido · estimada", "A-FEAT-1319")
    chequear("Impuestos", "Próximos: cada template avisa con SU anticipación («30 dias antes»); sin dato, 10 días",
      "iibb9 · en30", r.proximos.map(x => x.id).join(" · "),
      r.proximos.map(x => x.id).join(" · ") === "iibb9 · en30", "A-FEAT-1319")
    chequear("Impuestos", "Días de aviso: «15 dias antes» → 15 · vacío → 10 · y el vencido dice hace cuántos días",
      "15 · 10 · -11", `${diasDeAviso("15 dias antes")} · ${diasDeAviso(null)} · ${r.vencidos.find(x => x.id === "vencido")?.dias}`,
      diasDeAviso("15 dias antes") === 15 && diasDeAviso(null) === 10 && r.vencidos.find(x => x.id === "vencido")?.dias === -11, "A-FEAT-1319")
  }

  // ══ 🔎 BUSCADOR DEL CASH FLOW POR PALABRAS (A-FEAT-1324) ═══════════════════════════════════
  {
    const fila = ["Red Vial Cuota Rojas", "Municipalidad de Rojas", "Impuesto Red Vial", "1234567,89"]
    const b = (q: string) => coincidePorPalabras(fila, q)
    chequear("Buscador", "«red vial rojas» encuentra «Red Vial Cuota Rojas» (palabras en cualquier orden y con otras en el medio); también sin tildes y con mayúsculas",
      "true · true · true", `${b("red vial rojas")} · ${b("ROJAS vial")} · ${b("munícipalidad")}`,
      b("red vial rojas") && b("ROJAS vial") && b("munícipalidad"), "A-FEAT-1324")
    chequear("Buscador", "Si UNA palabra no está en ningún campo, no aparece; el monto con puntos de miles sigue encontrándose; búsqueda vacía = todo",
      "false · true · true", `${b("red vial salto")} · ${b("1.234.567,89")} · ${b("   ")}`,
      !b("red vial salto") && b("1.234.567,89") && b("   "), "A-FEAT-1324")
  }

  // ══ 📅 PAGO MANUAL: LA FECHA ES DE PAGO, NO DE VENCIMIENTO (A-BUG-1325) ═══════════════════════
  {
    const f = fechasDePagoManual("2026-10-23")
    chequear("Pago manual", "La fecha del modal va a «fecha de pago» (y a la estimada, que ordena el Cash Flow); el vencimiento queda vacío",
      "pago 2026-10-23 · estimada 2026-10-23 · venc null", `pago ${f.fecha_pago} · estimada ${f.fecha_estimada} · venc ${f.fecha_vencimiento}`,
      f.fecha_pago === "2026-10-23" && f.fecha_estimada === "2026-10-23" && f.fecha_vencimiento === null, "A-BUG-1325")
    const guia = camposDePagoManual("  Guía municipal 7 vacas + 3 toros ", { nombre_referencia: "Guías Municipales", categ: "CZ Ganadera" }) as Record<string, unknown>
    const vacio = camposDePagoManual("", { nombre_referencia: "Guías Municipales" })
    const fci = camposDePagoManual("x", { nombre_referencia: "FCI Galicia", categ: "FCI", es_bidireccional: true }, "ingreso")
    chequear("Pago manual", "Lo que escribís va al DETALLE (no a la columna vieja «descripción»), igual en Cash Flow y Egresos sin Factura",
      "detalle «Guía municipal 7 vacas + 3 toros» · sin descripcion · vacío → «Guías Municipales - Manual» · FCI → «Rescate FCI Galicia»",
      `detalle «${guia.detalle}» · ${"descripcion" in guia ? "CON descripcion" : "sin descripcion"} · vacío → «${vacio.detalle}» · FCI → «${fci.detalle}»`,
      guia.detalle === "Guía municipal 7 vacas + 3 toros" && !("descripcion" in guia) && vacio.detalle === "Guías Municipales - Manual" && fci.detalle === "Rescate FCI Galicia", "A-FEAT-1326")
  }

  // ══ 🏦 «PAGADO DESDE» (A-FEAT-1321) ═════════════════════════════════════════════════════════
  {
    chequear("Pagado desde", "Pagado desde MA Galicia SIGUE siendo un pago por banco: el filtro «banco» lo muestra y el de caja no",
      "true · true · false · true", `${esBanco("ma_galicia")} · ${pasaFiltroMedio("ma_galicia", "banco")} · ${pasaFiltroMedio("ma_galicia", "caja_general")} · ${pasaFiltroMedio(null, "banco")}`,
      esBanco("ma_galicia") && pasaFiltroMedio("ma_galicia", "banco") && !pasaFiltroMedio("ma_galicia", "caja_general") && pasaFiltroMedio(null, "banco")
        && !esBanco("caja_sigot") && pasaFiltroMedio("caja_sigot", "caja_sigot") && pasaFiltroMedio("caja_sigot", "todos"), "A-FEAT-1321")
    const otra = marcaPagadoDesde("ma_galicia", ["MSA"])
    const propia = marcaPagadoDesde("pam_galicia_cc", ["PAM"])
    chequear("Pagado desde", "La marca de la fila: una cuota de MSA pagada desde MA Galicia avisa fuerte; PAM desde su CC, suave; banco propio o caja, nada",
      "desde MA Galicia (otra) · desde PAM Galicia CC (propia) · null · null",
      `${otra?.texto} (${otra?.deOtraEmpresa ? "otra" : "propia"}) · ${propia?.texto} (${propia?.deOtraEmpresa ? "otra" : "propia"}) · ${marcaPagadoDesde("banco", ["MSA"])} · ${marcaPagadoDesde("caja_ams", ["MSA"])}`,
      otra?.deOtraEmpresa === true && propia?.deOtraEmpresa === false && marcaPagadoDesde("banco", ["MSA"]) === null && marcaPagadoDesde("caja_ams", ["MSA"]) === null, "A-FEAT-1321")
    chequear("Pagado desde", "Las opciones: primero el banco propio, después las 4 cuentas Galicia y las 3 cajas (las mismas ids que el motor de conciliación)",
      "banco · msa_galicia · pam_galicia · pam_galicia_cc · ma_galicia · caja_general · caja_ams · caja_sigot", OPCIONES_PAGADO_DESDE.map(o => o.id).join(" · "),
      OPCIONES_PAGADO_DESDE.map(o => o.id).join(" · ") === "banco · msa_galicia · pam_galicia · pam_galicia_cc · ma_galicia · caja_general · caja_ams · caja_sigot", "A-FEAT-1321")
  }

  // ══ 🧾 PLANILLA DE IMPUESTOS (A-FEAT-1320) ══════════════════════════════════════════════════
  {
    const tpl = (nombre: string, categ: string, resp = "MSA", o: Partial<CuotaPlanilla["template"]> = {}): CuotaPlanilla["template"] =>
      ({ nombre_referencia: nombre, categ, responsable: resp, cuenta_agrupadora: "Impuestos Rurales", activo: true, ...o })
    const c = (id: string, estado: string, venc: string | null, monto: number, t: CuotaPlanilla["template"], o: Partial<CuotaPlanilla> = {}): CuotaPlanilla =>
      ({ id, estado, fecha_vencimiento: venc, fecha_estimada: null, monto, template: t, ...o })
    const rojas = tpl("Inmobiliario Cuota Rojas", "Impuesto inmobiliario")
    const cholo = tpl("Inmobiliario Cuota Cholo 1", "Impuesto inmobiliario")
    const rv = tpl("Red Vial Cuota Rojas", "Impuesto Red Vial")
    const uatre = tpl("UATRE", "Impuestos Laborales ARCA", "MSA", { cuenta_agrupadora: "Impuestos General" })
    const pam = tpl("Inmobiliario Cuota Ombu", "Impuesto inmobiliario", "PAM")
    const p = armarPlanilla([
      c("r1", "conciliado", "2026-02-10", 100, rojas), c("r2", "pagado", "2026-05-10", 100, rojas),
      c("r3", "pendiente", "2026-08-10", 110, rojas), c("r4", "pagar", "2026-11-10", 120, rojas),
      c("ch1", "anterior", "2026-02-12", 50, cholo),
      c("rv1", "debito", "2026-03-01", 30, rv),
      c("u1", "pendiente", null, 40, uatre, { fecha_estimada: "2026-12-15" }),   // sin vencimiento: la estimada
      c("p1", "pendiente", "2026-02-10", 70, pam),
      c("x25", "pagado", "2025-12-10", 999, rojas),                            // otro año
      c("des", "desactivado", "2026-04-10", 999, rojas),                       // no entra
      c("inact", "pendiente", "2026-04-10", 999, tpl("Inmobiliario Anual Lima", "Impuesto inmobiliario", "MA", { activo: false })), // template dado de baja, sin pagar → no
      c("banco", "pendiente", "2026-04-10", 999, tpl("Sellos Bancario", "Impuestos ARCA", "MSA", { cuenta_agrupadora: "Impuestos Bancarios", solo_conciliacion: true })),
    ], 2026, "2026-10-23")
    const fila = (cl: string) => p.filas.find(f => f.clave === cl)
    const inm = fila("Inmobiliario|MSA")
    chequear("Planilla impuestos", "Una fila por impuesto y empresa: las partidas del inmobiliario se juntan (Rojas + Cholo 1); Red Vial, UATRE y el de PAM aparte; lo de otro año, desactivado, de template dado de baja o sólo-banco no entra",
      "Inmobiliario|MSA · Red Vial|MSA · UATRE|MSA · Inmobiliario|PAM", p.filas.map(f => f.clave).join(" · "),
      p.filas.map(f => f.clave).sort().join(" · ") === ["Inmobiliario|MSA", "Red Vial|MSA", "UATRE|MSA", "Inmobiliario|PAM"].sort().join(" · ") && inm?.templates.length === 2, "A-FEAT-1320")
    chequear("Planilla impuestos", "Pagado (conciliado + pagado + anterior) / adeudado (sin pagar vencido al 23/10) / futuro; febrero tiene las dos cuotas del inmobiliario",
      "pagado 250 · adeudado 110 · futuro 120 · total 480 · feb 2", `pagado ${inm?.pagado} · adeudado ${inm?.adeudado} · futuro ${inm?.futuro} · total ${inm?.total} · feb ${inm?.meses[1].length}`,
      inm?.pagado === 250 && inm?.adeudado === 110 && inm?.futuro === 120 && inm?.total === 480 && inm?.meses[1].length === 2, "A-FEAT-1320")
    chequear("Planilla impuestos", "Totales por empresa y generales; el control (meses = total) cierra; los años con datos incluyen 2025 para las flechas",
      "MSA 550 · PAM 70 · total 620 · control ok · años 2025,2026",
      `MSA ${p.porEmpresa.find(e => e.empresa === "MSA")?.total} · PAM ${p.porEmpresa.find(e => e.empresa === "PAM")?.total} · total ${p.totales.total} · control ${p.control.cierra ? "ok" : "MAL"} · años ${p.aniosConDatos.join(",")}`,
      p.porEmpresa.find(e => e.empresa === "MSA")?.total === 550 && p.porEmpresa.find(e => e.empresa === "PAM")?.total === 70 && p.totales.total === 620 && p.control.cierra && p.aniosConDatos.join(",") === "2025,2026", "A-FEAT-1320")
    chequear("Planilla impuestos", "Nombre de la fila: por categ para los de partida/vehículo; por nombre sin «Cuota»/«Anual» para el resto",
      "Inmobiliario Complementario · Automotores · IIBB Mensual MSA · Autonomos MA",
      [impuestoDeTemplate(tpl("Inmobiliario Complementario Cuota MSA", "Impuesto inmobiliario Complementario")), impuestoDeTemplate(tpl("Imp Automotores Gol 2012 Anual", "Impuesto Automotores")),
        impuestoDeTemplate(tpl("IIBB Mensual MSA", "Impuesto IIBB")), impuestoDeTemplate(tpl("Autonomos MA", "Impuestos Laborales ARCA"))].join(" · "),
      impuestoDeTemplate(tpl("Inmobiliario Complementario Cuota MSA", "Impuesto inmobiliario Complementario")) === "Inmobiliario Complementario"
        && impuestoDeTemplate(tpl("Imp Automotores Gol 2012 Anual", "Impuesto Automotores")) === "Automotores"
        && impuestoDeTemplate(tpl("IIBB Mensual MSA", "Impuesto IIBB")) === "IIBB Mensual MSA", "A-FEAT-1320")
    // Se guarda la lista COMPLETA de lo que se veía al soltar (ver `soltar` en la planilla).
    const ord = ordenarFilas(p.filas, ["UATRE|MSA", "ya-no-existe", "Inmobiliario|PAM", "Inmobiliario|MSA", "Red Vial|MSA"]).map(f => f.clave)
    // ⚠️ cambió 2026-10-24: las filas van en bloques por empresa — un orden guardado con empresas mezcladas se agrupa.
    chequear("Planilla impuestos", "El orden que dejó el usuario arrastrando manda, agrupado por empresa; una clave que ya no existe se ignora",
      "UATRE|MSA · Inmobiliario|MSA · Red Vial|MSA · Inmobiliario|PAM", ord.join(" · "),
      ord.join(" · ") === "UATRE|MSA · Inmobiliario|MSA · Red Vial|MSA · Inmobiliario|PAM", "A-FEAT-1320")
    {
      const fs3 = [{ clave: "A|MA", empresa: "MA" }, { clave: "B|MA", empresa: "MA" }, { clave: "C|MSA", empresa: "MSA" }, { clave: "D|MSA", empresa: "MSA" }, { clave: "E|PAM", empresa: "PAM" }]
      const arriba = moverFilaPlanilla(fs3, "D|MSA", "B|MA").join(" ")
      const abajo = moverFilaPlanilla(fs3, "A|MA", "E|PAM").join(" ")
      const misma = moverFilaPlanilla(fs3, "D|MSA", "C|MSA").join(" ")
      chequear("Planilla impuestos", "Arrastrar sobre OTRA empresa mueve el bloque entero (arriba: antes; abajo: después); en la misma, sólo la fila",
        "C|MSA D|MSA A|MA B|MA E|PAM · C|MSA D|MSA E|PAM A|MA B|MA · A|MA B|MA D|MSA C|MSA E|PAM", `${arriba} · ${abajo} · ${misma}`,
        arriba === "C|MSA D|MSA A|MA B|MA E|PAM" && abajo === "C|MSA D|MSA E|PAM A|MA B|MA" && misma === "A|MA B|MA D|MSA C|MSA E|PAM", "A-FEAT-1320")
    }
    // Los tres criterios que confirmó el usuario el 23/10.
    const baja = p.desactivadas
    chequear("Planilla impuestos", "Lo sin pagar de un template dado de baja NO suma, pero se muestra aparte (colapsado) para poder chequearlo",
      "1 fila aparte: Inmobiliario|MA $999 · total sigue 620", `${baja.length} fila aparte: ${baja.map(f => `${f.clave} $${f.total}`).join(", ")} · total sigue ${p.totales.total}`,
      baja.length === 1 && baja[0].clave === "Inmobiliario|MA" && baja[0].total === 999 && p.totales.total === 620 && !p.aniosConDatos.includes(2027), "A-FEAT-1320")
    const abl = tpl("ABL Chalet", "ABL", "PAM/MA/Duhau", { cuenta_agrupadora: "Impuestos Urbanos" })
    const p2 = armarPlanilla([
      c("e1", "echeq", "2026-03-10", 10, rojas), c("pr1", "programado", "2026-04-10", 20, rojas), c("ok1", "pagado", "2026-05-10", 30, rojas),
      c("abl1", "pagado", "2026-03-01", 5, abl),
    ], 2026, "2026-10-23")
    const raras = p2.filas.flatMap(f => f.meses.flat()).filter(x => x.rara).map(x => x.id).sort()
    chequear("Planilla impuestos", "programado y echeq cuentan como pagados pero se marcan (raro en un impuesto); el ABL compartido «PAM/MA/Duhau» va a MA",
      "raras e1,pr1 (2) · pagado 60 · ABL|MA", `raras ${raras.join(",")} (${p2.raras}) · pagado ${p2.filas.find(f => f.clave === "Inmobiliario|MSA")?.pagado} · ${p2.filas.find(f => f.impuesto === "ABL")?.clave}`,
      raras.join(",") === "e1,pr1" && p2.raras === 2 && p2.filas.find(f => f.clave === "Inmobiliario|MSA")?.pagado === 60 && p2.filas.find(f => f.impuesto === "ABL")?.clave === "ABL|MA", "A-FEAT-1320")
    // 🔗 Link a Egresos sin Factura en pestaña nueva, filtrado por los ids de los templates de la fila (usuario 24/10).
    {
      const conId = (n: string, id: string) => tpl(n, "Impuesto inmobiliario", "MSA", { id })
      const pl = armarPlanilla([c("a", "pendiente", "2026-03-10", 1, conId("Inmobiliario Cuota Rojas", "t-rojas")), c("b", "pendiente", "2026-04-10", 1, conId("Inmobiliario Cuota Rojas", "t-rojas")),
        c("d", "pagado", "2026-03-10", 1, conId("Inmobiliario Cuota Casco", "t-casco"))], 2026, "2026-10-23")
      const ids = Object.values(pl.filas[0].ids).sort()
      const url = linkTemplates([...ids, "t-rojas"])
      const vuelta = templatesDelLink(url.slice(url.indexOf("?"))).sort()
      chequear("Planilla impuestos", "El link de una fila lleva los ids de SUS templates (sin repetir) y la pantalla de templates los lee igual; sin ids, sin filtro",
        "t-casco,t-rojas · seccion=egresos&tab=templates · vuelta t-casco,t-rojas · vacío []", `${ids.join(",")} · ${url.includes("seccion=egresos&tab=templates") ? "seccion=egresos&tab=templates" : url} · vuelta ${vuelta.join(",")} · vacío [${templatesDelLink(linkTemplates([]).slice(1)).join(",")}]`,
        ids.join(",") === "t-casco,t-rojas" && url.includes("seccion=egresos&tab=templates") && vuelta.join(",") === "t-casco,t-rojas" && url.split("t-rojas").length === 2
          && templatesDelLink(linkTemplates([]).slice(1)).length === 0, "A-FEAT-1320")
    }
    // Planilla tipo Excel (usuario 24/10): una celda = la suma del mes, con el color de lo que más importa.
    const feb = resumenMes(inm!.meses[1]), ago = resumenMes(inm!.meses[7]), mar = resumenMes(p2.filas.find(f => f.clave === "Inmobiliario|MSA")!.meses[2])
    const mixto = resumenMes([...inm!.meses[1], ...inm!.meses[7]])
    chequear("Planilla impuestos", "Una celda por mes = la suma de sus cuotas: feb inmobiliario (100 conciliada + 50 anterior) da 150 «pagada»; ago sin pagar vencida; echeq «rara»; pagada + vencida = vencida y mixta; los totales por mes suman el total",
      "150 pagada · 110 vencida · rara · 260 vencida mixta · meses 620 · feb 220", `${feb.monto} ${feb.estado} · ${ago.monto} ${ago.estado} · ${mar.estado} · ${mixto.monto} ${mixto.estado}${mixto.mixta ? " mixta" : ""} · meses ${p.porMes.reduce((s, n) => s + n, 0)} · feb ${p.porMes[1]}`,
      feb.monto === 150 && feb.estado === "pagada" && ago.estado === "vencida" && mar.estado === "rara" && mixto.monto === 260 && mixto.estado === "vencida" && mixto.mixta && p.porMes.reduce((s, n) => s + n, 0) === 620 && p.porMes[1] === 220, "A-FEAT-1320")
  }

  // ══ 🌾 COBROS DE ARRENDAMIENTO SIN PESOS EN EL CASH FLOW (A-FEAT-1328) ═══════════════════════
  {
    // La base al 23/10: TC cargado sólo en ago y sep; soja por posición.
    const tcs = [{ anio: 2026, mes: 8, tc_presupuestado: 1450, tc_real: null }, { anio: 2026, mes: 9, tc_presupuestado: 1500, tc_real: null }]
    const precios = [{ grano: "soja", anio: 2026, mes: 11, precio_usd: 375 }, { grano: "soja", anio: 2027, mes: 5, precio_usd: 360 }]
    // Cuota 2 de Sanpa: 159,72 tn fijadas a U$S 365, cobro 10/11, sin TC.
    const fijada = importeDeVenta({ modo: "matba", cantidad: 159.72, precio_usd: 365, tc: null, precio_pesos: null, monto_pesos: null, fecha_cobro: "2026-11-10" }, tcs)
    chequear("Arrendamiento en Cash Flow", "Cuota fijada sin TC (Sanpa 10/11): ya no queda en $0 — 159,72 tn × U$S 365 × TC 1.500 (el último cargado, sep) y lo dice",
      "87446700 · estimado · TC estimado a $1.500 (último cargado: sep-26) · U$S 365/tn", `${Math.round(fijada.monto)} · ${fijada.estimado ? "estimado" : "cierto"} · ${fijada.aviso}`,
      Math.round(fijada.monto) === 87446700 && fijada.estimado && fijada.aviso === "TC estimado a $1.500 (último cargado: sep-26) · U$S 365/tn", "A-FEAT-1328")
    const cerrada = importeDeVenta({ modo: "pizarra", cantidad: 159.72, precio_usd: null, tc: null, precio_pesos: 490000, monto_pesos: 78262800, fecha_cobro: "2026-07-31" }, tcs)
    const sinTc = importeDeVenta({ modo: "matba", cantidad: 10, precio_usd: 365, tc: null, precio_pesos: null, monto_pesos: null, fecha_cobro: "2026-11-10" }, [])
    chequear("Arrendamiento en Cash Flow", "Con los pesos cerrados se usan ésos, sin aviso; sin ningún TC en la base no se inventa: queda en 0 y lo dice",
      "78262800 sin aviso · 0 con aviso", `${cerrada.monto} ${cerrada.aviso ? "con" : "sin"} aviso · ${sinTc.monto} ${sinTc.aviso ? "con" : "sin"} aviso`,
      cerrada.monto === 78262800 && !cerrada.aviso && !cerrada.estimado && sinTc.monto === 0 && !!sinTc.aviso, "A-FEAT-1328")
    const contrato = { id: "c1", empresa: "MSA", campania: "26/27", centro_costo: "Rojas", cliente_cuit: "30712200622", cliente_nombre: "Sanpa Semillas SA", has: 242, qq_ha_total: 24, grano: "soja", cuenta_contable: null, activo: true, notas: null }
    const cuota = (id: string, n: number, qq: number, fecha: string, pa: number, pm: number) => ({ id, contrato_id: "c1", numero_cuota: n, qq_ha_cuota: qq, fecha_cobro_estimada: fecha, posicion_anio: pa, posicion_mes: pm,
      fecha_cobro_original: null, posicion_orig_anio: null, posicion_orig_mes: null, estado: "presupuestado" as const, precio_usd_override: null, precio_pesos_override: null, notas: null })
    const nf = cuotasNoFijadas([contrato], [
      cuota("q2", 2, 6.6, "2026-11-10", 2026, 11),          // 159,72 tn, todas fijadas → no va
      cuota("q5", 5, 4.667769, "2027-05-10", 2027, 5),     // sin fijar → va entera
      cuota("q6", 6, 2, "2027-11-10", 2027, 11),           // fijada en parte (20 de 48,4 tn) → va el saldo
      cuota("q0", 1, 6.6, "2025-11-20", 2025, 11),         // sin fijar pero con fecha PASADA → no se proyecta
    ], [{ cuota_id: "q2", tons: 159.72 }, { cuota_id: "q6", tons: 20 }], precios, tcs, "2026-10-23")
    chequear("Arrendamiento en Cash Flow", "No fijadas: va lo que falta fijar de cada cuota (la 2 está toda fijada; la 6, sólo el saldo de 28,4 tn), con soja de la posición × TC de la base; la de fecha pasada no se proyecta",
      "q5 112.96 tn $60998405 · q6 28.40 tn $15336000", nf.map(x => `${x.id} ${x.tons.toFixed(2)} tn $${Math.round(x.monto)}`).join(" · "),
      nf.map(x => `${x.id} ${x.tons.toFixed(2)} tn $${Math.round(x.monto)}`).join(" · ") === "q5 112.96 tn $60998405 · q6 28.40 tn $15336000", "A-FEAT-1328")
  }

  // ══ 🏛️ DETALLE DE INMOBILIARIO / RED VIAL / AUTOMOTORES (A-FEAT-1320 punto 5) ════════════════
  {
    const t = (nombre: string, categ: string, resp: string, partida: string | null = null, activo = true) =>
      ({ nombre_referencia: nombre, categ, responsable: resp, cuenta_agrupadora: "Impuestos Rurales", activo, partida_arba: partida })
    const c = (id: string, estado: string, venc: string, monto: number, tpl: ReturnType<typeof t>) =>
      ({ id, estado, fecha_vencimiento: venc, fecha_estimada: null, monto, template: tpl })
    const rojas = t("Inmobiliario Cuota Rojas", "Impuesto inmobiliario", "MSA", "090-016369-0")
    const rojas25 = t("Inmobiliario Cuota Rojas", "Impuesto inmobiliario", "MSA", "090-016369-0", false)
    const cholo = t("Inmobiliario Cuota Cholo 1", "Impuesto inmobiliario", "MSA", "099-010611-8")
    const comp = t("Inmobiliario Complementario Cuota MSA", "Impuesto inmobiliario Complementario", "MSA")
    const casco = t("Inmobiliario Cuota Casco", "Impuesto inmobiliario", "PAM", "099-006595-0")
    const rv = t("Red Vial Cuota Rojas", "Impuesto Red Vial", "MSA")
    const cuotas = [
      c("a1", "pagado", "2025-03-10", 500, rojas25), c("a2", "pagado", "2025-06-10", 500, rojas25),   // año anterior: 4 cuotas, 2.000
      c("a3", "pagado", "2025-09-10", 500, rojas25), c("a4", "pagado", "2025-11-10", 500, rojas25),
      c("z1", "pagado", "2025-11-10", 50, casco),                                                       // Casco 2025: 1 cuota sola de 4 → incompleto
      c("b1", "conciliado", "2026-03-17", 600, rojas), c("b2", "pagado", "2026-06-11", 600, rojas), c("b3", "pendiente", "2026-09-13", 600, rojas), c("b4", "pendiente", "2026-11-13", 600, rojas),
      c("h1", "pagado", "2026-03-17", 100, cholo),
      c("k1", "pagado", "2026-03-17", 300, comp),
      c("p1", "pagado", "2026-03-17", 500, casco), c("p2", "pendiente", "2026-09-13", 500, casco),
      c("r1", "pagado", "2026-03-17", 999, rv),   // es de Red Vial: no va al papel del inmobiliario
    ]
    const tcs = [{ anio: 2026, mes: 3, tc_presupuestado: 1300, tc_real: null }, { anio: 2026, mes: 6, tc_presupuestado: 1300, tc_real: null },
      { anio: 2026, mes: 9, tc_presupuestado: 1500, tc_real: null }, { anio: 2026, mes: 11, tc_presupuestado: 1600, tc_real: null }]
    const p = armarPapel("inmobiliario", cuotas as any, 2026, tcs, { "090-016369-0": 245.17 })
    const msa = p.bloques.find(b => b.empresa === "MSA")
    const fr = msa?.filas.find(f => f.campo === "Rojas")
    chequear("Papel inmobiliario", "Por empresa y campo, el complementario al final; Rojas: 4 cuotas, total 2.400 contra 2.000 del año anterior (+20 %); Red Vial no entra",
      "MSA: Cholo 1 · Rojas · Complementario | PAM: Casco · Rojas 2400 vs 2000 (+20%) · 4 cuotas",
      `MSA: ${msa?.filas.map(f => f.campo).join(" · ")} | PAM: ${p.bloques.find(b => b.empresa === "PAM")?.filas.map(f => f.campo).join(" · ")} · Rojas ${fr?.costoAnual} vs ${fr?.totalAnterior} (+${Math.round((fr?.aumento ?? 0) * 100)}%) · ${fr?.cuotas.length} cuotas`,
      msa?.filas.map(f => f.campo).join(" · ") === "Cholo 1 · Rojas · Complementario" && fr?.costoAnual === 2400 && fr?.totalAnterior === 2000
        && Math.round((fr?.aumento ?? 0) * 100) === 20 && fr?.cuotas.length === 4 && p.total === 3800, "A-FEAT-1320")
    chequear("Papel inmobiliario", "TC promedio de los meses de las cuotas (como el «TC promedio» de su planilla) y costo por hectárea cuando hay hectáreas; sin hectáreas, vacío y avisa",
      "Rojas x ha 9.79 · U$S con TC prom. · falta has (Cholo 1, Casco)",
      `Rojas x ha ${fr?.costoHa} · U$S ${fr?.costoUsd ? "con TC prom." : "—"} · falta has (${p.faltaHas ? "Cholo 1, Casco" : "no"})`,
      fr?.costoHa === 9.79 && !!fr?.costoUsd && p.faltaHas && !!p.tcPromedio && p.tcPromedio > 1300 && p.tcPromedio < 1600, "A-FEAT-1320")
    const fc = p.bloques.find(b => b.empresa === "PAM")?.filas.find(f => f.campo === "Casco")
    chequear("Papel inmobiliario", "Si en la app el año anterior tiene menos cuotas que este (el histórico arranca en jul-25), el aumento NO se calcula: se marca incompleto",
      "Casco: incompleto, sin aumento", `Casco: ${fc?.anteriorIncompleto ? "incompleto" : "completo"}, ${fc?.aumento == null ? "sin aumento" : "aumento " + fc?.aumento}`,
      fc?.anteriorIncompleto === true && fc?.aumento == null && fr?.anteriorIncompleto === false, "A-FEAT-1320")
    chequear("Papel inmobiliario", "El campo sale del nombre del template; las hectáreas se toman de cualquiera de los dos maestros (por partida o por nombre)",
      "Tango Parra 1 · Lima · Gol 2012 · has 245.17/17.23",
      `${campoDeTemplate("Inmobiliario Cuota Tango Parra 1")} · ${campoDeTemplate("Red Vial Lima Cuota")} · ${campoDeTemplate("Imp Automotores Gol 2012 Anual")} · has ${hectareasDe([{ partida_inmobiliario: "090-016369-0", has_totales: 245.17 }], [])["090-016369-0"]}/${hectareasDe([], [{ nombre_partida: "Tango Parra 1", has: 17.23 }])["campo:tango parra 1"]}`,
      campoDeTemplate("Inmobiliario Cuota Tango Parra 1") === "Tango Parra 1" && campoDeTemplate("Red Vial Lima Cuota") === "Lima" && campoDeTemplate("Imp Automotores Gol 2012 Anual") === "Gol 2012"
        && hectareasDe([{ partida_inmobiliario: "090-016369-0", has_totales: 245.17 }], [])["090-016369-0"] === 245.17, "A-FEAT-1320")
    {
      // El maestro de partidas (scripts/96): Red Vial no tiene partida en el template → se cruza por nombre,
      // y muestra el número de la MUNICIPALIDAD (la «cuenta»), no la partida inmobiliaria.
      const maestro = [{ campo: "Tango Parra 1", partida_inmobiliario: "099-015883-5", partida_red_vial: "52948", has_totales: 17.23 }]
      const has = hectareasDe(maestro, [])
      const rv = cuentasRedVialDe(maestro)
      const tpl = { categ: "Impuesto Red Vial", nombre_referencia: "Red Vial Cuota Tango Parra 1", responsable: "MSA", cuenta_agrupadora: "Impuestos Rurales", solo_conciliacion: false, activo: true, partida_arba: null }
      const q = (venc: string, monto: number) => ({ estado: "pagado", monto, fecha_vencimiento: venc, fecha_estimada: venc, template: tpl }) as any
      const pv = armarPapel("red-vial", [q("2026-03-05", 1000), q("2026-06-05", 1000)], 2026, [], has, rv)
      const fila = pv.bloques[0]?.filas[0]
      chequear("Papel inmobiliario", "Red Vial toma las hectáreas del maestro por NOMBRE (su template no tiene partida) y muestra el número de la municipalidad",
        "Tango Parra 1 · 52948 · 17,23 ha · 116,08/ha", `${fila?.campo} · ${fila?.partida} · ${fila?.has?.toLocaleString("es-AR")} ha · ${fila?.costoHa?.toLocaleString("es-AR")}/ha`,
        fila?.partida === "52948" && fila?.has === 17.23 && fila?.costoHa === 116.08, "A-FEAT-1320")
    }
    {
      // ↕️ El orden de las partidas es UNO para Inmobiliario y Red Vial (usuario 24/10): mismo campo, misma clave.
      const tplDe = (cat: string, n: string, comp = false) => ({ categ: cat, nombre_referencia: n, responsable: "MSA", cuenta_agrupadora: "Impuestos Rurales", solo_conciliacion: false, activo: true, partida_arba: comp ? "COMPLEMENTARIO" : null })
      const q = (t: any) => ({ estado: "pagado", monto: 10, fecha_vencimiento: "2026-03-05", fecha_estimada: null, template: t }) as any
      const inm = armarPapel("inmobiliario", ["Anexo", "Casco", "Rojas"].map(c => q(tplDe("Impuesto inmobiliario", `Inmobiliario Cuota ${c}`))), 2026, [], {}, {})
      const red = armarPapel("red-vial", ["Anexo", "Casco", "Rojas"].map(c => q(tplDe("Impuesto Red Vial", `Red Vial Cuota ${c}`))), 2026, [], {}, {})
      // El usuario arrastra Rojas arriba de Anexo en INMOBILIARIO…
      const orden = moverPartida([], inm.bloques[0].filas.map(clavePartida), "rojas", "anexo")
      const vInm = ordenarPapel(inm, orden).bloques[0].filas.map(f => f.campo).join(",")
      const vRed = ordenarPapel(red, orden).bloques[0].filas.map(f => f.campo).join(",")
      // …y una partida guardada que no se ve (otro año) no pierde su lugar al mover otra.
      const orden2 = moverPartida(["tapera", "rojas", "anexo", "casco"], ["rojas", "anexo", "casco"], "casco", "rojas")
      chequear("Papel inmobiliario", "Ordenar las partidas en Inmobiliario ordena también Red Vial (misma clave: el campo); lo guardado que no se ve conserva su lugar; sin orden, alfabético",
        "Rojas,Anexo,Casco · Rojas,Anexo,Casco · tapera,casco,rojas,anexo · Anexo,Casco,Rojas",
        `${vInm} · ${vRed} · ${orden2.join(",")} · ${ordenarPapel(red, []).bloques[0].filas.map(f => f.campo).join(",")}`,
        vInm === "Rojas,Anexo,Casco" && vRed === "Rojas,Anexo,Casco" && orden2.join(",") === "tapera,casco,rojas,anexo"
          && ordenarPapel(red, []).bloques[0].filas.map(f => f.campo).join(",") === "Anexo,Casco,Rojas", "A-FEAT-1320")
    }
  }

  // ── Accesos por tarea, etapa 1 (A-FEAT-1322) ──────────────────────────────────────────────
  {
    const m = ["admin", "socio", "productivo", "contable", "ulises", "pruebas"].map(r => `${r}:${facturasRestringidas(r) ? "restringido" : "completo"}`).join(" · ")
    chequear("Accesos", "Facturas: los roles que ya existían quedan igual (admin, socio y productivo completos; contable restringido) y un rol NUEVO entra restringido como Ulises, no como admin",
      "admin:completo · socio:completo · productivo:completo · contable:restringido · ulises:restringido · pruebas:restringido", m,
      m === "admin:completo · socio:completo · productivo:completo · contable:restringido · ulises:restringido · pruebas:restringido", "A-FEAT-1322")
    const u = (meta: Record<string, unknown>, email?: string) => ({ id: "x", app_metadata: { role: "contable" }, user_metadata: meta, email, aud: "", created_at: "" }) as any
    const e = [etiquetaPersona(u({ nombre: "Ulises" }, "u@x.com")), etiquetaPersona(u({ full_name: "Ulises G" }, "u@x.com")), etiquetaPersona(u({}, "u@x.com")), etiquetaPersona(null)].map(String).join(" | ")
    chequear("Accesos", "Las marcas «para revisar» guardan la PERSONA (su nombre, o su mail si no tiene), nunca el rol",
      "Ulises | Ulises G | u@x.com | null", e, e === "Ulises | Ulises G | u@x.com | null", "A-BUG-1327")

    const roles = [
      { id: "admin", secciones: ["egresos", "sueldos"], exige_2fa: true, permisos: {} as Record<string, string> },
      { id: "pruebas", secciones: ["egresos"], exige_2fa: false, permisos: { "egresos.templates": "ninguno" } as Record<string, string> },
    ]
    const c = armarRolNuevo({ nombre: "Ulises", copiarDe: "pruebas" }, roles)
    const fila = c.ok ? c.fila : null
    // Es COPIA: tocar el original después no mueve el nuevo.
    roles[1].secciones.push("sueldos"); roles[1].permisos["egresos.seguros"] = "ninguno"
    const vista = fila ? `${fila.id} · ${fila.secciones.join("+")} · ${Object.keys(fila.permisos).join("+")} · sistema:${fila.es_sistema}` : "error"
    chequear("Accesos", "Crear rol copiando de pruebas: copia secciones y lo destildado, nunca es de sistema, y cambiar pruebas después no lo mueve",
      "ulises · egresos · egresos.templates · sistema:false", vista, vista === "ulises · egresos · egresos.templates · sistema:false", "A-FEAT-171")
    const errores = [
      armarRolNuevo({ nombre: "PRUEBAS" }, roles), armarRolNuevo({ nombre: "x" }, roles), armarRolNuevo({ nombre: "enrique", copiarDe: "nadie" }, roles),
    ].map(x => x.ok ? "ok" : "rechaza").join(" · ")
    const vacio = armarRolNuevo({ nombre: "Enrique Pérez" }, roles)
    const v = `${errores} · ${normalizarIdRol("Enrique Pérez")} · ${vacio.ok ? vacio.fila.secciones.length : "?"}`
    chequear("Accesos", "Crear rol: rechaza un nombre repetido (sin importar mayúsculas), uno muy corto y copiar de un rol que no existe; sin rol de origen nace VACÍO",
      "rechaza · rechaza · rechaza · enrique-perez · 0", v, v === "rechaza · rechaza · rechaza · enrique-perez · 0", "A-FEAT-171")

    // ── Rol cerrado (A-FEAT-1333) ──
    const abierto = { secciones: ["egresos"], permisos: { "egresos.templates": "ninguno" } }
    const sinCambio = JSON.stringify(nivelesEfectivos(abierto)) + " · " + JSON.stringify(nivelesEfectivos({ ...abierto, cerrado: false }))
    chequear("Accesos", "Rol cerrado: un rol ABIERTO (todos los de hoy, o sin la columna) se lee exactamente igual que antes",
      '{"egresos.templates":"ninguno"} · {"egresos.templates":"ninguno"}', sinCambio,
      sinCambio === '{"egresos.templates":"ninguno"} · {"egresos.templates":"ninguno"}', "A-FEAT-1333")

    const cerradoEf = nivelesEfectivos({
      secciones: ["egresos"], permisos: { "egresos.facturas-msa": "escritura", "egresos.templates": "lectura" }, cerrado: true,
    })
    const vc = [cerradoEf["egresos.facturas-msa"], cerradoEf["egresos.templates"], cerradoEf["egresos.subdiarios"],
      Object.keys(cerradoEf).some((k) => !k.startsWith("egresos.")) ? "se mete en otra sección" : "sólo egresos"].join(" · ")
    chequear("Accesos", "Rol cerrado: ve sólo lo que tiene tildado; lo que no figura en su lista (como una solapa registrada después) nace APAGADO",
      "escritura · lectura · ninguno · sólo egresos", vc, vc === "escritura · lectura · ninguno · sólo egresos", "A-FEAT-1333")

    // Pasar de abierto a cerrado y volver no cambia lo que ve en ese momento.
    const secc = ["egresos", "productivo"]
    const orig = { secciones: secc, permisos: { "egresos.templates": "ninguno", "egresos.seguros": "lectura" } as Record<string, string> }
    const comoCerrado = { secciones: secc, permisos: permisosAGuardar(excepcionesParaEditar(orig), secc, true), cerrado: true }
    const efCerrado = nivelesEfectivos(comoCerrado)
    const distintos = RECURSOS_PERMISABLES.filter((r) => secc.includes(r.seccion))
      .filter((r) => (orig.permisos[r.id] ?? "escritura") !== (efCerrado[r.id] ?? "escritura")).length
    const deVuelta = permisosAGuardar(excepcionesParaEditar(comoCerrado), secc, false)
    const ida = `${distintos} distintos · vuelta ${JSON.stringify(deVuelta) === JSON.stringify(orig.permisos) ? "igual" : JSON.stringify(deVuelta)}`
    chequear("Accesos", "Rol cerrado: pasar un rol de abierto a cerrado y volver no cambia nada de lo que ve hoy",
      "0 distintos · vuelta igual", ida, ida === "0 distintos · vuelta igual", "A-FEAT-1333")

    const base = { id: "pruebas", secciones: ["egresos"], exige_2fa: false, permisos: {} as Record<string, string> }
    const copiaCerrada = armarRolNuevo({ nombre: "enrique" }, [])
    const deCerrado = armarRolNuevo({ nombre: "ulises", copiarDe: "pruebas" }, [{ ...base, cerrado: true }])
    const sinColumna = armarRolNuevo({ nombre: "ulises", copiarDe: "pruebas" }, [base])
    const vcopia = [deCerrado.ok ? String(deCerrado.fila.cerrado) : "error",
      sinColumna.ok ? ("cerrado" in sinColumna.fila ? "manda la columna" : "no la manda") : "error",
      copiaCerrada.ok ? ("cerrado" in copiaCerrada.fila ? "manda la columna" : "no la manda") : "error"].join(" · ")
    chequear("Accesos", "Crear rol copiando de uno CERRADO lo copia cerrado; copiando de uno sin la columna, no la manda; VACÍO nace cerrado",
      "true · no la manda · manda la columna", vcopia, vcopia === "true · no la manda · manda la columna" && copiaCerrada.ok && copiaCerrada.fila.cerrado === true, "A-FEAT-1333")

    // ── Modo permisos: prender sobre la pantalla (A-FEAT-1334) ──
    const mpVacio = borradorDe({ secciones: [], permisos: {}, cerrado: true })
    const mpSeguros = alternarRecurso(mpVacio, "egresos.seguros")
    const vp = [mpSeguros.secciones.join(","), nivelEnBorrador(mpSeguros, "egresos.seguros"),
      nivelEnBorrador(mpSeguros, "egresos.facturas-msa"), nivelEnBorrador(mpSeguros, "egresos.subdiarios"),
      String(contarCambios(mpVacio, mpSeguros))].join(" · ")
    chequear("Accesos", "Modo permisos: en un rol cerrado y vacío, prender Seguros prende Egresos y SÓLO Seguros (2 cambios)",
      "egresos · escritura · ninguno · ninguno · 2", vp, vp === "egresos · escritura · ninguno · ninguno · 2", "A-FEAT-1334")

    const mpProdC = alternarSeccion(mpVacio, "productivo")
    const mpProdA = alternarSeccion(borradorDe({ secciones: [], permisos: {} }), "productivo")
    const vs = [nivelEnBorrador(mpProdC, "productivo.hacienda"), nivelEnBorrador(mpProdA, "productivo.hacienda")].join(" · ")
    chequear("Accesos", "Modo permisos: prender una sección en un rol CERRADO no prende sus solapas; en uno abierto entra con todo",
      "ninguno · escritura", vs, vs === "ninguno · escritura", "A-FEAT-1334")

    const mpStock = alternarRecurso(mpProdC, "productivo.stock")
    const vh = [nivelEnBorrador(mpStock, "productivo.stock"), nivelEnBorrador(mpStock, "productivo.insumos"),
      nivelEnBorrador(mpStock, "productivo.ordenes")].join(" · ")
    chequear("Accesos", "Modo permisos: prender una sub-solapa (Stock) prende también la de arriba (Insumos), no sus hermanas",
      "escritura · escritura · ninguno", vh, vh === "escritura · escritura · ninguno", "A-FEAT-1334")

    const mpUlises = borradorDe({ secciones: ["egresos"], permisos: { "egresos.facturas-msa": "escritura", "egresos.subdiarios": "lectura" }, cerrado: true })
    const mpIdaVuelta = alternarRecurso(alternarRecurso(mpUlises, "egresos.facturas-msa"), "egresos.facturas-msa")
    const vi = `${contarCambios(mpUlises, mpIdaVuelta)} · ${nivelEnBorrador(mpUlises, "egresos.subdiarios")}`
    chequear("Accesos", "Modo permisos: apagar y volver a prender deja 0 cambios, y lo que estaba en sólo lectura se respeta",
      "0 · lectura", vi, vi === "0 · lectura", "A-FEAT-1334")

    // Lo que se guarda, leído como lo lee la app, da exactamente lo que se vio en pantalla.
    const mpCuerpo = cuerpoGuardar("ulises", mpStock)
    const mpGuardado = permisosAGuardar(mpCuerpo.permisos, mpCuerpo.secciones, true)
    const mpLeido = nivelesEfectivos({ secciones: mpCuerpo.secciones, permisos: mpGuardado, cerrado: true })
    const mpDifs = RECURSOS_PERMISABLES.filter((r) => (mpCuerpo.secciones.includes(r.seccion) ? (mpLeido[r.id] ?? "escritura") : "ninguno") !== nivelEnBorrador(mpStock, r.id)).length
    const vg = `${JSON.stringify(mpGuardado)} · ${mpDifs} distintos`
    const mpEsperado = '{"productivo.insumos":"escritura","productivo.stock":"escritura"} · 0 distintos'
    chequear("Accesos", "Modo permisos: Guardar deja en la base lo prendido, y la app lo lee igual que se vio en pantalla",
      mpEsperado, vg, vg === mpEsperado, "A-FEAT-1334")

    const mpSinEgresos = alternarSeccion(mpUlises, "egresos")
    const vq = `${mpSinEgresos.secciones.length} · ${Object.keys(cuerpoGuardar("ulises", mpSinEgresos).permisos).length}`
    chequear("Accesos", "Modo permisos: apagar una sección no deja restricciones colgadas de esa sección",
      "0 · 0", vq, vq === "0 · 0", "A-FEAT-1334")

    // ── Permiso por cuenta del Extracto (A-FEAT-1336) ──
    // Ulises: rol cerrado con Extracto → Importar y sólo MSA cuenta corriente + VISA MSA.
    const ctUlises = { secciones: ["extracto"], cerrado: true, permisos: {
      "extracto.importar": "escritura", "extracto.cuenta.msa_galicia": "escritura", "extracto.cuenta.tarjeta_visa_business_msa": "escritura" } }
    const ctEf = nivelesEfectivos(ctUlises)
    const vct = [ctEf["extracto.importar"], ctEf["extracto.movimientos"], ctEf["extracto.cuenta.msa_galicia"],
      ctEf["extracto.cuenta.tarjeta_visa_business_msa"], ctEf["extracto.cuenta.pam_galicia"], ctEf["extracto.cuenta.caja_general"]].join(" · ")
    chequear("Accesos", "Cuentas: un rol cerrado con Importar + MSA CC + VISA MSA ve sólo esas dos cuentas, y Movimientos apagado",
      "escritura · ninguno · escritura · escritura · ninguno · ninguno", vct,
      vct === "escritura · ninguno · escritura · escritura · ninguno · ninguno", "A-FEAT-1336")

    const vsv = [motivoCuentaBloqueada(ctEf, "msa_galicia") ?? "pasa", motivoCuentaBloqueada(ctEf, "tarjeta_visa_business_msa") ?? "pasa",
      motivoCuentaBloqueada(ctEf, "pam_galicia_cc") ? "frena" : "pasa",
      motivoCuentaBloqueada(nivelesEfectivos({ secciones: ["extracto"], permisos: {} }), "pam_galicia_cc") ?? "pasa",
      motivoCuentaBloqueada(nivelesEfectivos({ secciones: ["importar"], permisos: {}, cerrado: true }), "pam_galicia_cc") ?? "pasa",
      motivoCuentaBloqueada({ "extracto.cuenta.ma_galicia": "lectura" }, "ma_galicia") ? "frena" : "pasa"].join(" · ")
    chequear("Accesos", "Cuentas (servidor): importar en una cuenta apagada se frena; un rol abierto o sin Extracto pasa como siempre; sólo lectura frena",
      "pasa · pasa · frena · pasa · pasa · frena", vsv, vsv === "pasa · pasa · frena · pasa · pasa · frena", "A-FEAT-1336")

    const ctRegistradas = RECURSOS_PERMISABLES.filter((r) => r.tipo === "cuenta").map((r) => r.id.replace("extracto.cuenta.", ""))
    const vreg = `${ctRegistradas.length} · ${["msa_galicia", "tarjeta_visa_business_msa", "echeqs_terceros"].every((id) => ctRegistradas.includes(id)) ? "están" : "faltan"}`
    chequear("Accesos", "Cuentas: las 11 cuentas del Extracto están registradas como permisables",
      "11 · están", vreg, vreg === "11 · están", "A-FEAT-1336")

    // En el modo permisos: prender una cuenta de un rol vacío prende Extracto, pero no Importar ni otras cuentas.
    const ctModo = alternarRecurso(borradorDe({ secciones: [], permisos: {}, cerrado: true }), "extracto.cuenta.msa_galicia")
    const vmo = [ctModo.secciones.join(","), nivelEnBorrador(ctModo, "extracto.cuenta.msa_galicia"),
      nivelEnBorrador(ctModo, "extracto.cuenta.pam_galicia"), nivelEnBorrador(ctModo, "extracto.importar")].join(" · ")
    chequear("Accesos", "Cuentas en el modo permisos: prender MSA en un rol vacío prende Extracto y sólo esa cuenta",
      "extracto · escritura · ninguno · ninguno", vmo, vmo === "extracto · escritura · ninguno · ninguno", "A-FEAT-1336")

    // ── Cierre de sesión por inactividad (A-FEAT-1351) ──
    const inMin = [minutosEfectivos(null), minutosEfectivos(30), minutosEfectivos(3), minutosEfectivos(2000), minutosEfectivos("45")].join(" · ")
    chequear("Accesos", "Inactividad: un rol sin tiempo propio (o con uno fuera de 5..1440) cierra a los 60 min",
      "60 · 30 · 60 · 60 · 60", inMin, inMin === "60 · 30 · 60 · 60 · 60", "A-FEAT-1351")

    const inVal = ["", "90", "4", "1,5", "1440", "abc"].map((t) => { const v = validarMinutos(t); return v.ok ? String(v.valor) : "rechaza" }).join(" · ")
    chequear("Accesos", "Inactividad: lo que se escribe en Roles — vacío vuelve al de siempre, fuera de rango o con coma se rechaza",
      "null · 90 · rechaza · rechaza · 1440 · rechaza", inVal, inVal === "null · 90 · rechaza · rechaza · 1440 · rechaza", "A-FEAT-1351")

    const inT0 = Date.UTC(2026, 9, 24, 12, 0, 0)
    const inCookie = valorCookieActividad({ sesion: "ses-1", ultima: inT0, minutos: 60 })
    const inVen = [
      sesionVencida(inCookie, "ses-1", inT0 + 59 * 60_000) ? "cierra" : "sigue",
      sesionVencida(inCookie, "ses-1", inT0 + 61 * 60_000) ? "cierra" : "sigue",
      // La marca vieja de la sesión anterior no cierra la sesión nueva recién abierta.
      sesionVencida(inCookie, "ses-2", inT0 + 600 * 60_000) ? "cierra" : "sigue",
      msRestantes("basura", "ses-1", inT0) === null ? "ignora" : "lee",
      sesionVencida(valorCookieActividad({ sesion: "ses-1", ultima: inT0, minutos: 15 }), "ses-1", inT0 + 16 * 60_000) ? "cierra" : "sigue",
    ].join(" · ")
    chequear("Accesos", "Inactividad: a 1 hora sigue a los 59 min y cierra a los 61; una marca de otra sesión o rota no cierra; con 15 min cierra a los 16",
      "sigue · cierra · sigue · ignora · cierra", inVen, inVen === "sigue · cierra · sigue · ignora · cierra", "A-FEAT-1351")

    const inB64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const inTok = [sesionDelToken(`${inB64({ alg: "HS256" })}.${inB64({ session_id: "abc-123", sub: "u" })}.firma`) ?? "nada",
      sesionDelToken("no-es-un-token") ?? "nada", sesionDelToken(null) ?? "nada"].join(" · ")
    chequear("Accesos", "Inactividad: la sesión sale del token; un token roto no inventa una",
      "abc-123 · nada · nada", inTok, inTok === "abc-123 · nada · nada", "A-FEAT-1351")

    const inTxt = [60, 120, 90, 30].map(textoMinutos).join(" · ")
    chequear("Accesos", "Inactividad: la tarjeta del rol lo dice en horas cuando se puede",
      "1 hora · 2 horas · 1 h 30 min · 30 min", inTxt, inTxt === "1 hora · 2 horas · 1 h 30 min · 30 min", "A-FEAT-1351")
  }

  {
    // ── Histórico: otros_tributos ya incluye las percepciones (A-BUG-1341) ──
    // Fila real: Sposito 31-5817 del 02/10/2025, tal como está en msa.comprobantes_historico.
    const sposito = desdeHistorico({ id: "x", anio_contable: 2025, mes_contable: 10, fecha: "2025-10-02", tipo: "1 - Factura A",
      punto_de_venta: 31, numero_desde: 5817, nro_doc_emisor: "30", denominacion_emisor: "EMPRESA SPOSITO S A",
      imp_neto_gravado: "1091608.38", imp_neto_no_gravado: "0", imp_op_exentas: "0", otros_tributos: "8732.87",
      percepcion_iibb: "8732.87", percepcion_iva: "0", iva: "229237.75", imp_total: "1329579.00" })
    const difSp = Math.round((sposito.total - (sposito.neto_gravado + sposito.no_gravado + sposito.exento + sposito.otros_tributos + sposito.iva)) * 100) / 100
    chequear("Balance", "Histórico: la percepción ya está dentro de «otros tributos» — no se suma dos veces (antes la apertura no cerraba por $ 2.872,49)",
      "otros 8732.87 · diferencia 0", `otros ${sposito.otros_tributos} · diferencia ${difSp}`, sposito.otros_tributos === 8732.87 && difSp === 0, "A-BUG-1341")

    // ── La base entrega 1000 filas por consulta: se trae por tandas (A-BUG-1339) ──
    const universo = Array.from({ length: 2046 }, (_, i) => i)
    const todo = juntarTandas((d, h) => universo.slice(d, h + 1))
    const vt = `${todo.filas.length} filas en ${todo.tandas} tandas · ${new Set(todo.filas).size === todo.filas.length ? "sin repetidas" : "con repetidas"}`
    chequear("Balance", "Traer todo: 2046 cuotas llegan enteras (antes llegaban 1000 y la solapa Templates salía con meses vacíos)",
      "2046 filas en 3 tandas · sin repetidas", vt, vt === "2046 filas en 3 tandas · sin repetidas", "A-BUG-1339")
    const exacto = juntarTandas((d, h) => universo.slice(0, 1000).slice(d, h + 1))
    const ve = `${exacto.filas.length} filas en ${exacto.tandas} tandas`
    chequear("Balance", "Traer todo: si son justo 1000, pide una tanda más para confirmar que no hay más (el caso del banco jul→mar)",
      "1000 filas en 2 tandas", ve, ve === "1000 filas en 2 tandas", "A-BUG-1339")
    // ── Templates separados por tipo y ordenados por responsable (A-FEAT-1342 · A-FEAT-1338) ──
    const ej1342 = armarEjercicio(2026, 6)
    const cuotaT = (responsable: string, fecha: string, concepto: string, tipo?: "egreso" | "financiero" | "distribucion", monto = 100) =>
      ({ id: concepto, fecha, concepto, proveedor: "", categ: "X" + (tipo ?? ""), cuenta_contable: "", nro_cuenta: "", centro_costo: "", responsable, estado: "pagado", monto, tipo })
    const tpl = armarTemplatesDelEjercicio([
      cuotaT("PAM", "2025-08-01", "b", "egreso"), cuotaT("MSA", "2026-01-01", "c", "egreso"), cuotaT("MSA", "2025-07-01", "a", "egreso"),
      cuotaT("", "2025-07-01", "z", "egreso"), cuotaT("MSA", "2025-09-01", "fci", "financiero", 5000), cuotaT("MSA", "2025-10-01", "retiro", "distribucion", 300),
      cuotaT("MSA", "2025-11-01", "nada", undefined, 7),
    ], ej1342)
    const filasT = hojaDeTemplates(tpl)
    const conceptos = filasT.slice(1).filter(r => r.length > 2 && r[1] && !String(r[0]).startsWith("Total")).map(r => `${r[7] || "(sin)"} ${r[1]}`).join(" · ")
    chequear("Balance", "Solapa Templates: primero los egresos (por responsable y fecha, los sin responsable al final), después distribuciones, financiero y sin clasificar",
      "MSA a · MSA c · PAM b · (sin) z · MSA retiro · MSA fci · MSA nada", conceptos, conceptos === "MSA a · MSA c · PAM b · (sin) z · MSA retiro · MSA fci · MSA nada", "A-FEAT-1342")
    const grupos = tpl.porTipo.map(g => `${g.tipo} ${g.totalNeto}`).join(" · ")
    const sumaG = tpl.porTipo.reduce((x, g) => x + g.totalNeto, 0)
    chequear("Balance", "Templates por tipo: el FCI queda en financiero (no suma al gasto) y la suma de los grupos da el total general",
      "egreso 400 · distribucion 300 · financiero 5000 · sin clasificar 7 · suma 5707 = total 5707", `${grupos} · suma ${sumaG} = total ${tpl.totalDebitos - tpl.totalCreditos}`,
      grupos === "egreso 400 · distribucion 300 · financiero 5000 · sin clasificar 7" && sumaG === tpl.totalDebitos - tpl.totalCreditos, "A-FEAT-1342")
    const dc = (x: Record<string, unknown>, plan?: Record<string, "egreso" | "financiero" | null>) => desdeCuota(x, plan).tipo
    const vtipo = [dc({ categ: "FCI", egreso: { tipo: "financiero" } }), dc({ categ: "FCI", egreso: {} }, { FCI: "financiero" }), dc({ categ: "RARO", egreso: {} }, {}),
      dc({ categ: "FCI", egreso: { tipo: "egreso" } }, { FCI: "financiero" })].join(" · ")
    chequear("Balance", "Tipo de una cuota: manda el del template, si no el del plan de cuentas; sin ninguno queda «sin clasificar» (no se adivina por el signo)",
      "financiero · financiero · sin clasificar · egreso", vtipo, vtipo === "financiero · financiero · sin clasificar · egreso", "A-FEAT-1342")

    // ── Reglas por CUIT: el CUIT está en leyendas_adicionales_2 (A-BUG-1344) ──
    // Movimiento real de PAM cta cte del 17/03/2026 (MSA le transfiere $4.100.000), como viene del banco.
    const movPam = { descripcion: "Servicio Pago A Proveedores", debitos: 0, creditos: 4100000, numero_de_comprobante: "", observaciones_cliente: "",
      leyendas_adicionales_1: "MARTINEZ SOBRADO AGRO S.R.L.", leyendas_adicionales_2: "30617786016" }
    const reglaCuit = (texto: string) => ({ columna_busqueda: "cuit", tipo_match: "exacto", texto_buscar: texto })
    const vcuit = [evaluarReglaConciliacion(movPam, reglaCuit("30617786016")), evaluarReglaConciliacion(movPam, reglaCuit("30-61778601-6")),
      evaluarReglaConciliacion(movPam, reglaCuit("20044390222"))].map(String).join(" · ")
    chequear("Conciliación", "Regla por CUIT: coincide con el CUIT que el banco deja en leyendas 2 (con o sin guiones) y no con otro CUIT — antes no coincidía nunca",
      "true · true · false", vcuit, vcuit === "true · true · false", "A-BUG-1344")
    const vdesc = [evaluarReglaConciliacion(movPam, { columna_busqueda: "descripcion", tipo_match: "contiene", texto_buscar: "pago a proveedores" }),
      evaluarReglaConciliacion(movPam, { columna_busqueda: "monto_credito", tipo_match: "exacto", texto_buscar: "4100000" }),
      evaluarReglaConciliacion(movPam, { columna_busqueda: "descripcion", tipo_match: "contiene", texto_buscar: "" })].map(String).join(" · ")
    chequear("Conciliación", "Reglas por descripción y por monto siguen igual; una regla con el texto vacío no coincide con todo",
      "true · true · false", vdesc, vdesc === "true · true · false", "A-BUG-1344")

    // ── Tipos de parseo: sin puntos y sin número de cheque son el mismo tipo (A-FEAT-1347) ──
    // Tipos reales de la caja de ahorro de PAM, como los manda el banco.
    const vk = [claveDeTipo("DEB. AUTOM. DE SERV.") === claveDeTipo("DEB AUTOM DE SERV"), claveDeTipo("ING. BRUTOS S/ CRED") === claveDeTipo("ING BRUTOS S/ CRED"),
      claveDeTipo("GDE ECHEQ   Q03521175 BOL77388704") === claveDeTipo("GDE ECHEQ   Q96578776 BOL78477425"),
      claveDeTipo("IMP CRE LEY 25413"), claveDeTipo("COMPRA DEBITO") === claveDeTipo("COMPRA CON DEBITO")].map(String).join(" · ")
    chequear("Parseo", "Tipo de movimiento: un punto no es diferencia; dos echeq con distinto número son el mismo tipo; «LEY 25413» queda; COMPRA DEBITO ≠ COMPRA CON DEBITO",
      "true · true · true · IMP CRE LEY 25413 · false", vk, vk === "true · true · true · IMP CRE LEY 25413 · false", "A-FEAT-1347")
    const mapaPuntos = { "DEB AUTOM DE SERV": [{ campo_destino: "leyendas_adicionales_1", tipo_regla: "linea", numero_linea: 2, grupo_de_conceptos: "000083" }] }
    const rawPuntos = "DEB. AUTOM. DE SERV.\nEDENOR"
    const vp = [tipoDeMovimiento(rawPuntos), String(tieneReglaPropia(rawPuntos, mapaPuntos)), parsearMovimiento(rawPuntos, mapaPuntos).grupo_de_conceptos,
      parsearMovimiento(rawPuntos, mapaPuntos).descripcion].join(" · ")
    chequear("Parseo", "Un movimiento escrito con puntos usa la regla escrita sin puntos; la descripción guardada sigue siendo la del banco",
      "DEB AUTOM DE SERV · true · 000083 · DEB. AUTOM. DE SERV.", vp, vp === "DEB AUTOM DE SERV · true · 000083 · DEB. AUTOM. DE SERV.", "A-FEAT-1347")

    // ── Choque en el editor y tilde que acepta la propuesta (A-BUG-1353, A-FEAT-1354) ──
    // El movimiento real de MA de 7 líneas: L5 (identificador) y L6 (tarjeta) van a la misma columna.
    const filasMA = [{ campo: "descripcion", numero: 1 }, { campo: "numero_de_terminal", numero: 5 }, { campo: "numero_de_terminal", numero: 6 }, { campo: "", numero: 7 }, { campo: "", numero: 8 }]
    const vrep = columnasRepetidas(filasMA).map(r => `${r.campo}:${r.lineas.join("+")}`).join(" · ") || "ninguna"
    chequear("Parseo", "Editor: Terminal y Tarjeta en la misma columna se detectan como choque (antes decía «0 cambios»); las líneas sin asignar no cuentan",
      "numero_de_terminal:5+6", vrep, vrep === "numero_de_terminal:5+6", "A-BUG-1353")
    const prop = reglasDeLaPropuesta(["TRANSFERENCIA DE TERCEROS", "SOLEDAD MARTINEZ", "27260467382", "VARIOS", "BANCO DE GALICIA Y BUENOS AIRES SAU"])
    const vprop = `${prop.repetidas.length} · ` + prop.reglas.map(r => `L${r.linea}>${r.campo}`).join(" ")
    const esperado = "0 · L1>descripcion L2>leyendas_adicionales_1 L3>leyendas_adicionales_2 L4>leyendas_adicionales_3 L5>leyendas_adicionales_4"
    chequear("Parseo", "Tilde sin configurar: guarda lo mismo que muestra «Dónde va a quedar cada línea» (caso real de PAM, 5 líneas)",
      esperado, vprop, vprop === esperado, "A-FEAT-1354")

    // ── Auditoría: un modo que busca guarda un pedazo de la línea (A-BUG-1359) ──
    // PAGO TARJETA AMEX de PAM, real: la regla de Nº de operación guarda 2522426 de «OPERACION 2522426».
    const auAmex = auditarSubtipo(["PAGO TARJETA AMEX", "OPERACION 2522426"], [
      { campo_destino: "descripcion", tipo_regla: "linea", numero_linea: 1, grupo_de_conceptos: "Otros", firma_forma: "2:tipo,texto" },
      { campo_destino: "numero_de_comprobante", tipo_regla: "nro_operacion", numero_linea: null, grupo_de_conceptos: "Otros", firma_forma: "2:tipo,texto" }])
    const vau = `${auAmex.hallazgos.length} hallazgos · ${auAmex.resueltas} resueltas`
    chequear("Parseo", "Auditoría del subtipo: el Nº de operación guardado sin la palabra OPERACION no se marca como «hoy no se guarda»",
      "0 hallazgos · 2 resueltas", vau, vau === "0 hallazgos · 2 resueltas", "A-BUG-1359")

    // ── Cuotas en $0: no hubo nada que pagar, no se pide fecha (A-FEAT-1357) ──
    // 5 cuotas de IIBB MSA en cero, como llegan de la base (texto), más una con importe y una sin monto.
    const lote0 = [{ id: "a", monto: "0.00" }, { id: "b", monto: 0 }, { id: "c", monto: "0" }, { id: "d", monto: 15230.5 }, { id: "e", monto: null }]
    const sep = separarSinImporte(lote0)
    const v0 = `${sep.sinImporte.map(f => f.id).join("")} · ${sep.conImporte.map(f => f.id).join("")}`
    chequear("Templates", "Pasar a conciliado: las cuotas en $0 van sin fecha de pago; las que tienen importe —y las de monto vacío, ante la duda— la piden",
      "abc · de", v0, v0 === "abc · de", "A-FEAT-1357")

    // ── Re-parsear primero sólo lo no parseado (A-FEAT-1358) ──
    const vsp = ["Otros", "Subtipo nuevo", "Reglas en conflicto", "", null, "000907 - Transferencias"].map(g => estaSinParsear(g) ? "sí" : "no").join(" ")
    chequear("Parseo", "Sin parsear = grupo vacío o una de las tres marcas (sin regla, subtipo nuevo, conflicto); un grupo del banco ya está desglosado",
      "sí sí sí sí sí no", vsp, vsp === "sí sí sí sí sí no", "A-FEAT-1358")

    // ── El tilde exige grupo de conceptos (A-FEAT-1360) ──
    const vg = ["Otros", "", null, "000083 - Pagos"].map(g => tieneGrupoPrevisto(g) ? "sí" : "no").join(" ")
    chequear("Parseo", "Grupo previsto: «Otros» (el relleno) o vacío no cuentan; un grupo del banco sí — sin grupo no se puede dar por bueno",
      "no no no sí", vg, vg === "no no no sí", "A-FEAT-1360")

    // ── ¿Llegó todo de la base? (A-FEAT-1343) ──
    const lects = [{ nombre: "Extracto BANCO GALICIA", llegaron: 1000, esperadas: 1563 }, { nombre: "Ventas", llegaron: 9, esperadas: 9 }, { nombre: "Sueldos", llegaron: 103, esperadas: null }]
    const vl = lects.map(l => lecturaIncompleta(l) ? "incompleta" : "ok").join(" · ")
    chequear("Balance", "Control de lecturas: 1000 de 1563 es incompleta; 9 de 9 está bien; sin el dato de la base no se inventa un error",
      "incompleta · ok · ok", vl, vl === "incompleta · ok · ok", "A-FEAT-1343")
    const bl = bloqueDeLecturas(lects)
    const vb = `${String(bl[0][0]).includes("NO: 1 consulta") ? "titular NO" : bl[0][0]} · ${bl[2][3]} · ${bl[3][3]} · ${bl[4][3]}`
    chequear("Balance", "Hoja Control: dice si llegó todo y marca NO CUADRA la consulta cortada (lo que habría avisado el corte de las 1000 filas)",
      "titular NO · NO CUADRA · cuadra · sin dato", vb, vb === "titular NO · NO CUADRA · cuadra · sin dato", "A-FEAT-1343")

    // ── Lo que carga el usuario en el balance se guarda (A-FEAT-1337 paso 1) ──
    const base1337 = { empresa: "MSA", anio_cierre: 2026, papel: "hacienda.precio", clave: "Vaca" }
    const primera = armarFilaDato(base1337, " 1.250.000,50 ", null, "jms", "2026-10-24T15:00:00Z")
    const v1 = primera ? `${primera.texto} · ${primera.valor} · historial ${primera.historial.length} · ${primera.actualizado_por}` : "no guarda"
    chequear("Balance", "Datos del balance: la primera carga guarda lo escrito, el número leído en es-AR y quién lo cargó",
      "1.250.000,50 · 1250000.5 · historial 0 · jms", v1, v1 === "1.250.000,50 · 1250000.5 · historial 0 · jms", "A-FEAT-1337")
    const igual = armarFilaDato(base1337, "1.250.000,50", primera, "jms", "2026-10-24T15:01:00Z")
    chequear("Balance", "Datos del balance: si la casilla no cambió no se escribe de más", "no escribe", igual === null ? "no escribe" : "escribe",
      igual === null, "A-FEAT-1337")
    const segunda = armarFilaDato(base1337, "", primera, "ulises", "2026-10-25T10:00:00Z")
    const v2 = segunda ? `texto ${segunda.texto} · valor ${segunda.valor} · historial ${segunda.historial.map(h => `${h.texto} (${h.por})`).join(", ")}` : "no guarda"
    chequear("Balance", "Datos del balance: vaciar una casilla NO borra la fila — queda vacía y el historial guarda lo que había y quién",
      "texto null · valor null · historial 1.250.000,50 (jms)", v2, v2 === "texto null · valor null · historial 1.250.000,50 (jms)", "A-FEAT-1337")
    const vn = [leerNumero("12,5"), leerNumero("abc"), leerNumero("   ")].map(String).join(" · ")
    chequear("Balance", "Datos del balance: un texto ilegible o vacío es «no lo sé» (null), nunca cero", "12.5 · null · null", vn, vn === "12.5 · null · null", "A-FEAT-1337")
    const sinT = textoEstadoGuardado("sin tabla", null)
    chequear("Balance", "Datos del balance: sin el script 100 la pantalla avisa que NO se guarda (no rompe)", "avisa", sinT.includes("NO se guarda") ? "avisa" : sinT,
      sinT.includes("NO se guarda"), "A-FEAT-1337")

    // ── Presentación del Excel del balance (A-FEAT-1338) ──
    const ws = XLSXcasos.utils.aoa_to_sheet([
      ["COMPRAS vs. LO PRESENTADO A ARCA"],
      ["Subdiario", "App: comprobantes", "App: total", "Diferencia", ""],
      ["2025-12", 40, 16394196.92, -580510.57, "NO COINCIDE"],
      ["2026-01", 42, 12233837.36, 0, "coincide"],
      ["TOTAL", 82, 28628034.28],
    ])
    presentarHoja(ws)
    const sty = (d: string) => ((ws[d] as { s?: { font?: { bold?: boolean; color?: { rgb?: string } }; fill?: unknown } }).s ?? {})
    const z = (d: string) => (ws[d] as { z?: string }).z
    const vfmt = [z("C3") === MONEDA ? "importe Contabilidad" : z("C3"), z("B3") === ENTERO ? "cantidad entera" : z("B3"),
      z("D4") === MONEDA ? "cero con guion" : z("D4")].join(" · ")
    chequear("Balance", "Excel: todo número lleva formato (importe en Contabilidad, cantidad entera, el cero con guion) aunque la hoja no tenga columnas",
      "importe Contabilidad · cantidad entera · cero con guion", vfmt, vfmt === "importe Contabilidad · cantidad entera · cero con guion", "A-FEAT-1338")
    const neg = MONEDA.split(";")[1]
    chequear("Balance", "Excel: el negativo va entre paréntesis", "entre paréntesis", neg.includes("(#,##0.00)") ? "entre paréntesis" : neg,
      neg.includes("(#,##0.00)"), "A-FEAT-1338")
    const vsty = [sty("A1").font?.bold && sty("A1").fill ? "título" : "-", sty("B2").font?.bold && sty("B2").fill ? "encabezado" : "-",
      sty("A5").font?.bold ? "total" : "-", sty("E3").font?.color?.rgb === "FFA12B2B" ? "aviso rojo" : "-",
      sty("E4").font?.color?.rgb === "FF2E7A3C" ? "ok verde" : "-", sty("A3").font?.bold ? "fila común en negrita" : "fila común normal"].join(" · ")
    chequear("Balance", "Excel: título, encabezado y total en negrita; NO COINCIDE en rojo, coincide en verde; las filas comunes sin tocar",
      "título · encabezado · total · aviso rojo · ok verde · fila común normal", vsty,
      vsty === "título · encabezado · total · aviso rojo · ok verde · fila común normal", "A-FEAT-1338")
  }

  return r
}
