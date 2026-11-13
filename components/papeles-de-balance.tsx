"use client"

/**
 * 📒 PAPELES DE TRABAJO DEL BALANCE — A-FEAT-1184.
 *
 * Arma el libro diario del ejercicio y lo baja en Excel para el contador.
 *
 * ## Lo que hay que entender antes de tocar esto
 *
 * **El período NO se corta por la fecha de las facturas**, sino por **el subdiario en el que
 * entraron** (regla del usuario, 2026-09-28). Toda la lógica vive en `lib/balance/` y está probada
 * en `lib/pruebas/casos.ts`; acá sólo se traen los datos y se muestra el resultado.
 *
 * ## 🔴 Las compras salen de DOS tablas, y no es un detalle
 *
 * `comprobantes_historico` trae lo del sistema anterior (jul–dic 2025) y `comprobantes_arca` lo
 * nuevo. **Diciembre está en las dos** y no coincide, porque *«sin querer entró 2 veces»* → `A-DAT-61`.
 * El control lo detecta y lo muestra; **no se elige una fuente en silencio**.
 *
 * ## ⚠️ Sólo LEE el sistema
 * No escribe en ninguna tabla del sistema: genera un archivo. Lo único que guarda es lo que el usuario
 * escribe en sus casillas —precios de hacienda, cuadre de granos, cuotapartes, saldos de inicio de las
 * cuentas corrientes— en `balance_datos_usuario` (A-FEAT-1337, A-FEAT-1388).
 * ⚠️ cambió 2026-10-27: hasta acá decía «no escribe una sola fila», y ya no era cierto desde el 24/10.
 */
import { PendientesBalance } from "./pendientes-balance"
import { SaldosEjercicioAnterior } from "./saldos-ejercicio-anterior"
import { ProvisionManual, tablaFacturas, tablaVentas } from "./provision-manual"
import { saldosDelEjercicioAnterior, type AjusteBalance } from "@/lib/balance/ajustes-balance"
import { pendientesConVisto, type PendienteBalance } from "@/lib/balance/pendientes-balance"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { cargarProblemasDeModalidad, type ProblemaModalidad } from "@/lib/templates/modalidad"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { toast } from "sonner"
import { armarEjercicio, nombreSubdiario, primerDiaDelEjercicio } from "@/lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta, ULTIMO_SUBDIARIO_HISTORICO, type LibroDiario } from "@/lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "@/lib/balance/presentado-arca"
import { explicarFila, type ProveedorFijo } from "@/lib/balance/facturas-fijas"
import { armarTemplatesDelEjercicio, desdeCuota, type ExtractoParaH, type TemplatesDelEjercicio } from "@/lib/balance/templates-libro"
import { conFacturas, indiceDeDestinos, leerExtractoDelEjercicio, leerMovimientosDeCuotas, vincularBanco } from "@/lib/balance/movimientos-de-cuotas"
import { cargarAuxiliaresPapel, cargarCuotasImpuestos } from "@/lib/impuestos/datos-papel"
import type { DatosPapelesH } from "@/lib/balance/papeles-impuestos-h"
import {
  armarControlCuotas, resumenControlCuotas, conProblema, cuotaParaControlDesde, subdiariosConVentasDesde,
  leerComisionesPorCuenta, COMISIONES_MSA, campaniaDelControl, ultimoDiaDelMes,
  presentacionesSicoreDesde, type ControlCuotasTemplates, type PresentacionSicore,
} from "@/lib/balance/control-cuotas-templates"
import { HaciendaAlCierre, type DatosHacienda } from "./hacienda-al-cierre"
import { ProponerFotoBalance } from "./proponer-foto-balance"
import { respaldoDeSaldo, respaldoDeFci, PAPEL_COPIAS, urlDeArchivoDrive, renglonesDeRespaldo, itemsDelRespaldo, carpetasDelRespaldo, type ItemDeRespaldo } from "@/lib/balance/respaldos"
import { ivaConSigno, RENGLONES, type DatosDeLosPapeles, type ValorPropuesto } from "@/lib/balance/balance-propio"
import { armarImpuestoCheque, ETIQUETA_CONCEPTO, pctComputable } from "@/lib/balance/impuesto-cheque"
import { armarWorkbook, coberturaDeArgs, descargarLibroDiario, descargarSetDelBalance, descargarPapelesDelBalance } from "@/lib/balance/export-libro-diario"
import { librosConSubs, sePuedeBajar, papelPorId, type ControlDeCobertura } from "@/lib/balance/papeles-del-balance"
import { armarTemas, subdiariosContraArca, temaDelLink, type Tema } from "@/lib/balance/recorrido"
import { temasVentasVsArca, temasComprasVsArca, type DdjjGuardada } from "@/lib/balance/recorrido-ventas-arca"
import { leerDatosConciliacion, proponerConciliaciones, CUENTAS_CONCILIABLES, type ConteoCuenta } from "@/lib/conciliacion/propuestas-ejercicio"
import { temasDeMovimientos, temasDeDeudas, temasDeCheques, temasDeCuentaCorriente } from "@/lib/balance/recorrido-conciliacion"
import { contrapartesDelRecorrido } from "@/lib/balance/fuera-por-cuenta-corriente"
import { leerTemasSueldoOtraPersona } from "@/lib/balance/control-sueldo-otra-persona"
import { leerExtrasTemas } from "@/lib/balance/series-tema"
import { leerTemasTarjeta } from "@/lib/balance/control-tarjeta"
import { leerTemasSinCateg } from "@/lib/balance/control-sin-categ"
import { leerParaTuVisto, aplicarParaTuVisto, type TareaPorConfirmar } from "@/lib/balance/para-tu-visto"
import type { RecorridoParaExcel, TareaDelRecorrido } from "@/lib/balance/recorrido-excel"
import { leerChequesVencidos } from "@/lib/conciliacion/cheques-vencidos"
import { RecorridoBalance } from "./recorrido-balance"
import { VistaPreviaBalance } from "./vista-previa-balance"
import { descargarLibroDiarioConsensuado, retencionesDeVenta, type FilaVentaConsensuada } from "@/lib/balance/libro-diario-consensuado"
import { leerCobrosYRetenciones } from "@/lib/balance/cobros-de-ventas"
import { descargarDiferenciasVsArca } from "@/lib/balance/diferencias-vs-arca"
import { saldosEnDolaresParaBalance, CUENTAS_EN_MONEDA_EXTRANJERA } from "@/lib/dolares/posicion-cierre"
import { detalleBancarioDelLibroC, canalDePago, dolaresParaBalance } from "@/lib/balance/libros-del-balance"
import { APERTURA_MSA_2025 } from "@/lib/balance/apertura-contador"
import type { EntradaBalanceEnLinea } from "@/lib/balance/balance-en-linea"
import type { MovimientoLib } from "@/lib/balance/grupos-templates"
import { leerDeudaTarjeta, leerSussAlCierre, leerFci, leerSojaInicio, leerTcCierre } from "@/lib/balance/balance-en-linea-lectura"
import { MarcaTentativo } from "@/components/marca-tentativo"
import { leyendaTentativo } from "@/lib/balance/datos-usuario-puro"
import { traerTodo, lecturaIncompleta, type Lectura } from "@/lib/supabase-paginado"
import type { TipoCuenta } from "@/lib/presupuesto/templates"
import { asientosContablesDelEjercicio, ESTADO_ASIENTO_CONTABLE } from "@/lib/balance/asientos-contables"
import type { AsientoLibroDiario } from "@/lib/balance/libro-diario"
import { leerFotoInicio, controlarProvisionAnterior, type ControlesInicio, type FotoInicio } from "@/lib/balance/control-inicio"
import { armarInicioYCierre } from "@/lib/balance/inicio-y-cierre"
import type { HechosCobertura } from "@/lib/balance/cobertura-papeles"
import {
  armarCuentasAlCierre, canceladoPorCuotasAlCierre, polizasParaCierreDesde,
  type CuentasAlCierre, type ComprobanteConPago, type CanceladoPorCuotas,
} from "@/lib/balance/cuentas-al-cierre"
import {
  armarChequesDados, armarAnticiposAlCierre, aplicarAnticiposEnCero,
  type ChequesDados, type AnticiposAlCierre, type ChequeCrudo,
  type AnticipoCrudo, type AplicacionDeAnticipo,
} from "@/lib/balance/valores-al-cierre"
import { buscarFechasDePagoBancarias, buscarFechasDeCobroBancarias, buscarFechasDePagoDeCuotas, completarConGrupoDeCobro, type ClienteMinimo } from "@/lib/balance/fechas-de-pago"
import {
  mesesDelEjercicio, armarGastosBancarios, armarFondosComunes, armarRetirosYAportes,
  esFCI, CUENTAS_DEL_EXTRACTO,
  type MovimientoExtracto, type CuentaDelPlan,
} from "@/lib/balance/papeles-bancarios"
import {
  armarCadenaDeSaldos, saldoAlInicioDe, type CadenaDeSaldos,
} from "@/lib/balance/saldos-al-inicio"
import {
  armarSueldosDelEjercicio, type SueldosDelEjercicio, type PeriodoDeSueldo,
  sueldosImpagosAlCierre, type PagoDeSueldo, type PeriodoConId,
} from "@/lib/balance/sueldos-balance"
import {
  armarCuentasCorrientes, aplicarSaldosInicio, abrirDesglosar, consumosDeTarjetaComoMovimientos, movimientosDeLosSocios, type CuentaDelSocio, CONTRAPARTES_DEL_BALANCE, aplicarCierresDecididos,
  sueldosPendientesComoCompras, type SueldoParaCC,
  type PapelDeCuentasCorrientes, type ConsumoTarjeta,
  type CompraParaCC, type VentaParaCC, type MovimientoParaCC,
} from "@/lib/balance/cuentas-corrientes"
import { useDatosDelBalance, textoEstadoGuardado, leerNumero } from "@/lib/balance/datos-usuario"
import { controlarCheque, chequeEnPapel08, chequeEnTemplates } from "@/lib/balance/control-cheque"
import { aseguradoraAlCierre } from "@/lib/balance/seguros-al-cierre"
import { repartoDeLaFlota } from "@/lib/balance/reparto-flota"
import { sacarLosDeCuentaCorriente, cuitsConCuentaCorriente } from "@/lib/balance/fuera-por-cuenta-corriente"
import { esDeLaAseguradora } from "@/lib/polizas/control-debitos"
// 🕐 La fecha de hoy en hora argentina. Vive en el módulo de cotizaciones porque ahí nació el bug
//    (A-OP-23); es genérica y conviene moverla, pero duplicarla sería peor.
import { hoyArgentina } from "@/lib/cotizaciones/parsers"
import { TestsDelProceso } from "@/components/tests-del-proceso"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Empresas y su mes de cierre. MSA cierra en junio; PAM y MA en diciembre. */
const EMPRESAS = [
  { id: "MSA", schema: "msa", mesCierre: 6 },
  { id: "PAM", schema: "pam", mesCierre: 12 },
  { id: "MA", schema: "ma", mesCierre: 12 },
] as const

/** 🔍 A-FEAT-1579: las cuotas del libro con su template — incluido el `año` (con ñ el tipado de Supabase no lo lee: va como string). */
const SELECT_CUOTAS_LIBRO_H: string = "*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora, año)"

export function PapelesDeBalance() {
  const [empresa, setEmpresa] = useState<(typeof EMPRESAS)[number]>(EMPRESAS[0])
  const [anioCierre, setAnioCierre] = useState(2026)
  /** 📌 A-FEAT-1258 — los pendientes a revisar, para que viajen al export. */
  const [pendientes, setPendientes] = useState<PendienteBalance[]>([])
  /** ✍️ A-FEAT-1207 — los saldos del ejercicio anterior: gasto de este ejercicio, viajan al export. */
  const [ajustes, setAjustes] = useState<AjusteBalance[]>([])
  const [cargando, setCargando] = useState(false)
  const [libro, setLibro] = useState<LibroDiario | null>(null)
  /** 🕐 Nota 🌙 de JMS 30/10 («me sigue diciendo armar todo pero ya lo armé, presenta confusión»): a qué hora se armó. */
  const [armadoA, setArmadoA] = useState<string | null>(null)
  /**
   * 💳 Papeles 03 y 04. Se arman junto con el libro porque necesitan **lo mismo** que él más una
   * consulta: cuándo se pagó cada comprobante. Ver `lib/balance/cuentas-al-cierre.ts`.
   */
  const [cuentas, setCuentas] = useState<{ pagar: CuentasAlCierre; cobrar: CuentasAlCierre } | null>(null)
  /**
   * 💵 Los bloques 04.1, 04.2 y 03.1 (A-FEAT-1195): cheques dados, anticipos y provisión de cobros.
   * Van en **su propio estado** porque salen de otras tablas: si fallan, los papeles 03 y 04 que ya
   * están armados no se caen.
   */
  const [valores, setValores] = useState<{ cheques?: ChequesDados; anticipos?: AnticiposAlCierre } | null>(null)
  /**
   * 🏦 Papeles 07, 08 y 09. Salen del **extracto** ya parseado y categorizado, así que se traen
   * junto con el libro: es una consulta más por cuenta bancaria.
   */
  // 🗂️ A-FEAT-1624: los papeles sueltos — cuáles están tildados y qué salió del último armado
  const [verPapeles, setVerPapeles] = useState(false)
  const [tildados, setTildados] = useState<Set<string>>(new Set())
  const [bajandoPapeles, setBajandoPapeles] = useState(false)
  const [resultadoPapeles, setResultadoPapeles] = useState<{ archivos: { papel: string; solapas: number; formulasAValor: number }[]; cobertura: ControlDeCobertura } | null>(null)
  const [bancarios, setBancarios] = useState<Parameters<typeof descargarLibroDiario>[7] | null>(null)
  /** 📦 A-FEAT-1571 paso 2: lo que pasó al copiar el respaldo o armar los zip (se muestra en el recuadro). */
  const [respaldoEstado, setRespaldoEstado] = useState<{ trabajando: boolean; lineas: Array<{ texto: string; url?: string; error?: boolean }> }>({ trabajando: false, lineas: [] })
  const [templates, setTemplates] = useState<TemplatesDelEjercicio | null>(null)
  /** 🔢 ¿Cada template tiene sus cuotas en la campaña? (decisión de JMS del 28/10/2026). */
  const [controlCuotas, setControlCuotas] = useState<ControlCuotasTemplates | null>(null)
  const [hacienda, setHacienda] = useState<DatosHacienda | null>(null)
  /** 📚 A-BUG-1508: el set espera el stock si no se trajo (un ref, porque el estado no se ve dentro del clic). */
  const haciendaRef = useRef<DatosHacienda | null>(null)
  useEffect(() => { haciendaRef.current = hacienda }, [hacienda])
  /**
   * 👷 El papel de sueldos (A-FEAT-1216). Va en su propio estado: si falla, el resto del libro sale
   * igual — es una parte más del balance, no el balance.
   */
  const [sueldos, setSueldos] = useState<SueldosDelEjercicio | null>(null)
  /** 🧾 Las cuentas corrientes con su saldo al cierre (A-FEAT-1218). */
  const [cuentasCorrientes, setCuentasCorrientes] = useState<PapelDeCuentasCorrientes | null>(null)
  /**
   * ✍️ A-FEAT-1388 — el saldo de inicio de cada cuenta corriente, escrito por el usuario y guardado al
   * escribirlo (como los precios de hacienda). Vacío = 0 marcado «sin dato». Se aplica sin volver a
   * armar el libro: el papel 14 y el Excel lo toman al instante.
   */
  const saldosCC = useDatosDelBalance(empresa.id, anioCierre, "cc.saldo-inicio")
  const cuentasCorrientesConInicio = useMemo(() => cuentasCorrientes
    // ✍️ A-FEAT-1537: después del inicio, los saldos al cierre que decidió el usuario (ACREN en 0), con su ajuste a la vista.
    ? aplicarCierresDecididos(aplicarSaldosInicio(cuentasCorrientes, Object.fromEntries(
        CONTRAPARTES_DEL_BALANCE.map(c => [c.clave, leerNumero(saldosCC.valores[c.clave])])),
        // 🤖 A-FEAT-1386: el inicio que puso Claude sale TENTATIVO en el Excel hasta el OK
        Object.fromEntries(Object.entries(saldosCC.tentativos).map(([k, f]) => [k, leyendaTentativo(f)]))), anioCierre)
    : null, [cuentasCorrientes, saldosCC.valores, saldosCC.tentativos, anioCierre])
  /**
   * 📒 «Asientos Contables» (A-FEAT-1318): las facturas no informadas en ARCA que no van al subdiario.
   * `null` = no se pudo leer (la solapa no sale, y se avisa); `[]` = se leyó y no hay.
   */
  const [asientosContables, setAsientosContables] = useState<AsientoLibroDiario[] | null>(null)
  /** 🧮 A-FEAT-1343: cuántas filas dijo la base y cuántas llegaron, por consulta. */
  const [lecturas, setLecturas] = useState<Lectura[] | null>(null)
  /** 🔁 A-FEAT-1427: el inicio según el balance anterior contra lo que reconoce la app. */
  const [controlesInicio, setControlesInicio] = useState<ControlesInicio | null>(null)
  /** 📋 A-FEAT-1427: la foto del cierre anterior (todos los renglones) y el cálculo de cierre de la app. */
  const [fotoInicio, setFotoInicio] = useState<FotoInicio | null>(null)
  const [propuestaCierre, setPropuestaCierre] = useState<{ valores: ValorPropuesto[]; faltan: string[] } | null>(null)
  const recibirPropuesta = useCallback((p: { valores: ValorPropuesto[]; faltan: string[] }) => setPropuestaCierre(p), [])
  /** 👁️ A-FEAT-1427: el libro armado para mirarlo antes de bajarlo. `null` = cerrada. */
  const [verPrevia, setVerPrevia] = useState(false)
  /** 🧭 A-FEAT-1430: el recorrido del balance (pantalla completa) y la versión de los pendientes que respondió. */
  const [verRecorrido, setVerRecorrido] = useState(false)
  /** 🔗 A-FEAT-1466 — el tema que pidió un link (desde una tarea en Principal); se abre cuando el libro está armado. */
  const [temaPedido, setTemaPedido] = useState<{ empresa: string; anioCierre: number; clave: string; armando: boolean } | null>(null)
  const [claveRecorrido, setClaveRecorrido] = useState<string | null>(null)
  /** 🏦 A-FEAT-1430 paso 4: las propuestas de conciliación del ejercicio (se calculan al abrir el recorrido). */
  const [conciliacion, setConciliacion] = useState<{ movimientos: Tema[]; deudas: Tema[]; cheques: Tema[]; controles: Tema[]; visto?: { tareas: TareaPorConfirmar[]; rearmados: Tema[] }; tareasRecorrido?: TareaDelRecorrido[]; historicos: number; avisos: string[]; calculado: string; porCuenta?: Record<string, ConteoCuenta> } | null>(null)
  const [cargandoConciliacion, setCargandoConciliacion] = useState<string | null>(null)
  const calcularConciliacion = useCallback(async (silencioso = false): Promise<NonNullable<typeof conciliacion> | null> => {
    if (!libro) return null
    const desde = primerDiaDelEjercicio(libro.ejercicio), hasta = libro.ejercicio.fechaCierre
    setCargandoConciliacion("empezando…")
    try {
      const datos = await leerDatosConciliacion(supabase, empresa.id, desde, hasta, t => setCargandoConciliacion(t))
      const r = proponerConciliaciones(datos, empresa.id, desde, hasta)
      // 📜 A-FEAT-1484 / 1479: las tiras de movimientos por contraparte y los pares anual/cuotas
      setCargandoConciliacion("armando la tira de movimientos de cada contraparte…")
      const ex = await leerExtrasTemas(supabase, empresa.id, desde, hasta)
      datos.avisos.push(...ex.avisos)
      const mov = temasDeMovimientos(r.movimientos, ex.extras)
      // ✍️ A-AUTO-10: los echeqs vencidos sin marcar (sólo MSA emite cheques)
      setCargandoConciliacion("cruzando los echeqs vencidos con sus débitos…")
      const ch = empresa.id === "MSA" ? await leerChequesVencidos(supabase, hoyArgentina()) : { cruces: [], extractoHasta: null, error: null }
      if (ch.error) datos.avisos.push(`echeqs: ${ch.error}`)
      // 🔗 A-BUG-1486: pagos de sueldo atados al movimiento de otra persona (CUIL de Sueldos contra el CUIT del banco)
      setCargandoConciliacion("controlando los pagos de sueldo contra el CUIT del banco…")
      const ctl = await leerTemasSueldoOtraPersona(supabase, empresa.id, desde, hasta)
      if (ctl.error) datos.avisos.push(`control de sueldos: ${ctl.error}`)
      // 🏷️ A-FEAT-1496: conciliados sin categoría (en el balance no caen en ninguna cuenta)
      const sc = await leerTemasSinCateg(supabase, empresa.id, desde, hasta)
      if (sc.error) datos.avisos.push(`conciliados sin categoría: ${sc.error}`)
      // 💳 A-FEAT-1481: la tarjeta por causa (pagos sin vincular, peajes, históricos…); esos movimientos no salen además sueltos
      setCargandoConciliacion("agrupando la tarjeta por causa…")
      const tj = await leerTemasTarjeta(supabase, empresa.id, desde, hasta)
      if (tj.error) datos.avisos.push(`control de la tarjeta: ${tj.error}`)
      // 🔁 A-FEAT-1499: AFA, ACREN y Federación (MSA) van por su cuenta corriente: un tema por contraparte, no sueltos
      const cc = temasDeCuentaCorriente(r.movimientos, contrapartesDelRecorrido(empresa.id), ex.extras)
      // 🔁 A-FEAT-140 (y la regla del 29/10): sus comprobantes tampoco van sueltos como «deudas sin pago» — van por su cuenta.
      // JMS 01/11 sobre AFA: «esto tiene un lugar en la parte de cuentas corrientes… no acá, que es de facturas no conciliadas».
      const cuitsDeCuentaCorriente = new Set(contrapartesDelRecorrido(empresa.id).map(c => c.cuit))
      const movSinTarjeta = mov.temas.filter(t => !tj.cubiertos.has(t.clave.replace(/^conc:/, "")) && !cc.cubiertos.has(t.clave))
      // ✔ A-FEAT-1487: lo resuelto por Claude que espera tu visto sigue en el recorrido, con cómo quedó
      setCargandoConciliacion("trayendo lo que espera tu visto…")
      const vt = await leerParaTuVisto(supabase, empresa.id, anioCierre, ex.extras)
      if (vt.error) datos.avisos.push(`para tu visto: ${vt.error}`)
      const calculada = { movimientos: [...tj.temas, ...cc.temas, ...movSinTarjeta], deudas: temasDeDeudas(r.deudas.filter(d => !cuitsDeCuentaCorriente.has(String(d.obligacion.cuit ?? "").replace(/\D/g, ""))), empresa.id, ex.extras), cheques: temasDeCheques(ch.cruces, ch.extractoHasta), controles: [...ctl.temas, ...sc.temas], visto: { tareas: vt.tareas, rearmados: vt.rearmados },
        tareasRecorrido: vt.todas,
        historicos: mov.historicos, avisos: datos.avisos, porCuenta: datos.porCuenta,
        calculado: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) }
      setConciliacion(calculada)
      if (datos.avisos.length && !silencioso) toast.warning(`Conciliación: no se pudo leer ${datos.avisos.length} cosa(s) — ${datos.avisos.slice(0, 2).join(" · ")}`)
      return calculada
    } catch (e) {
      toast.error("No se pudieron calcular las propuestas de conciliación: " + (e as Error).message)
      return null
    } finally { setCargandoConciliacion(null) }
  }, [libro, empresa.id, anioCierre])
  // Se calculan la primera vez que se abre el recorrido (después, con «↻ Recalcular»).
  useEffect(() => { if (verRecorrido && libro && !conciliacion && !cargandoConciliacion) void calcularConciliacion() }, [verRecorrido, libro]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setConciliacion(null) }, [libro])
  /**
   * ↻ Al VOLVER a la pestaña del recorrido, la conciliación se recalcula sola (JMS 31/10: «que se actualice solo al volver
   * a su pestaña y vemos si ralentiza»): los links abren en otra pestaña, se concilia allá, y al volver los temas resueltos
   * se van sin apretar «↻ Recalcular». Sólo si estuvo afuera más de unos segundos y no hay otro cálculo en curso. Lo que
   * se cambia en otras pantallas (una factura, una marca) sigue pidiendo «↻ Volver a armar».
   */
  const ocultoDesde = useRef<number | null>(null)
  useEffect(() => {
    if (!verRecorrido || !libro) return
    const alCambiar = () => {
      if (document.visibilityState === "hidden") { ocultoDesde.current = Date.now(); return }
      const afuera = ocultoDesde.current ? Date.now() - ocultoDesde.current : 0
      ocultoDesde.current = null
      if (afuera > 3000 && !cargandoConciliacion && conciliacion) void calcularConciliacion(true)
    }
    document.addEventListener("visibilitychange", alCambiar)
    return () => document.removeEventListener("visibilitychange", alCambiar)
  }, [verRecorrido, libro, cargandoConciliacion, conciliacion, calcularConciliacion])
  /**
   * 🧾 A-FEAT-1439: lo PRESENTADO a ARCA (libro IVA de cada mes, `public.ddjj_presentadas`), para que el recorrido
   * muestre las ventas contra lo declarado — la fuente objetiva al lado de la app.
   */
  const [ddjjGuardadas, setDdjjGuardadas] = useState<{ filas: DdjjGuardada[]; error: string | null } | null>(null)
  /** 🔁 A-FEAT-1500: la lectura sirve al recorrido y a la descarga del Excel (que la pide si el recorrido no se abrió). */
  const leerDdjj = useCallback(async (lib: LibroDiario): Promise<{ filas: DdjjGuardada[]; error: string | null }> => {
    const periodos = lib.ejercicio.subdiarios.map(s => `${s.anio}${String(s.mes).padStart(2, "0")}`)
    const base = "periodo, secuencia, codigo_presentacion, archivo"
    const q = (cols: string) => supabase.from("ddjj_presentadas").select(cols).eq("empresa", empresa.id).eq("impuesto", "IVA").in("periodo", periodos)
    let r = await q(`${base}, comprobantes, ventas, totales_ventas`)
    // Antes del script 145 la tabla no guarda las ventas: se leen igual los meses, y el recorrido dice que faltan.
    if (r.error && /ventas/.test(r.error.message)) r = await q(base)
    if (r.error) return { filas: [], error: r.error.message }
    return { filas: ((r.data ?? []) as unknown as Record<string, unknown>[]).map(d => ({
      periodo: String(d.periodo), secuencia: Number(d.secuencia ?? 1), codigo_presentacion: (d.codigo_presentacion as string) ?? null,
      archivo: (d.archivo as string) ?? null, ventas: Array.isArray(d.ventas) ? d.ventas as DdjjGuardada["ventas"] : null,
      totales_ventas: (d.totales_ventas as DdjjGuardada["totales_ventas"]) ?? null,
      compras: Array.isArray(d.comprobantes) ? d.comprobantes as DdjjGuardada["compras"] : null,
    })), error: null }
  }, [empresa.id])
  useEffect(() => {
    if (!verRecorrido || !libro || ddjjGuardadas) return
    void leerDdjj(libro).then(setDdjjGuardadas)
  }, [verRecorrido, libro]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDdjjGuardadas(null) }, [libro])
  const [versionPendientes, setVersionPendientes] = useState(0)
  /** ⚡ A-FEAT-1427: «Armar todo» le pide a Hacienda/insumos que traiga stock y precios (cada pedido, un número nuevo). */
  const [pedidoStock, setPedidoStock] = useState(0)

  /**
   * 🧾 Los datos del Excel del balance, en el orden de `armarWorkbook`. Los usan la descarga Y la vista previa
   * (A-FEAT-1427): una sola lista, para que lo que se ve y lo que se baja no puedan diferir.
   */
  const argsDelExcel = (lib: LibroDiario, recorrido?: RecorridoParaExcel | null, conc: typeof conciliacion = conciliacion): Parameters<typeof armarWorkbook> => [
    lib, empresa.id, templates ?? undefined, hacienda ?? undefined,
    hacienda?.insumos, hacienda?.campo,
    // Los cuatro bloques de los papeles 03 y 04 viajan juntos: el listado de
    // comprobantes, los cheques y los anticipos son partes del mismo papel.
    { ...(cuentas ?? {}), ...(valores ?? {}) },
    bancarios ?? undefined,
    sueldos ?? undefined,
    cuentasCorrientesConInicio ?? undefined,
    // ✔ A-FEAT-1487: los pendientes con quién los vio (JMS o sólo Claude), y lo resuelto por Claude sin pendiente propio
    conc?.visto ? pendientesConVisto(pendientes, conc.visto.tareas.map(t => ({ clave: t.clave,
      titulo: t.descripcion.replace(/^Balance \S+ \S+ · /, ""), resolucion: t.resolucion })), empresa.id, anioCierre) : pendientes,
    saldosDelEjercicioAnterior(ajustes, empresa.id, anioCierre),
    asientosContables ?? undefined,
    lecturas ?? undefined,
    controlCuotas ?? undefined,
    {
      ...(controlesInicio ?? {}),
      // 📋 Sólo si el cálculo de cierre ya corrió (aparece al armar el libro, en «Pasar a la foto»).
      ...(propuestaCierre ? { inicioYCierre: armarInicioYCierre(fotoInicio, propuestaCierre.valores, propuestaCierre.faltan) } : {}),
    },
    recorrido,
  ]

  /** 🧭 Los temas del recorrido: la cobertura (mismos datos del Excel) + las preguntas de «Pendientes a revisar». */
  type ConcEstado = typeof conciliacion
  type DdjjEstado = typeof ddjjGuardadas
  /** 🔁 A-FEAT-1500: lo que el Excel recibe del recorrido — los mismos temas y las tareas vivas. */
  const recorridoParaExcel = (temas: Tema[], conc: ConcEstado): RecorridoParaExcel =>
    ({ calculado: !!conc, temas: conc ? temas : [], tareas: conc?.tareasRecorrido ?? [] })
  const armarTemasRecorrido = (libro: LibroDiario, conciliacion: ConcEstado, ddjjGuardadas: DdjjEstado): Tema[] => {
    const otros = conciliacion ? [...conciliacion.movimientos, ...conciliacion.deudas, ...conciliacion.cheques, ...conciliacion.controles] : []
    // 🧾 A-FEAT-1439: ventas contra lo presentado a ARCA. Si no se pudo leer o cruzar, se dice como tema (no se saltea).
    if (ddjjGuardadas) {
      try {
        otros.push(...(ddjjGuardadas.error
          ? [{ clave: "arca:ventas:error-lectura", grupo: "error" as const, papel: "Ventas contra lo presentado a ARCA", titulo: "No se pudo leer lo presentado a ARCA",
              que: ddjjGuardadas.error, links: [], respondido: false }]
          : [...temasVentasVsArca(libro, empresa.id, ddjjGuardadas.filas), ...temasComprasVsArca(libro, empresa.id, ddjjGuardadas.filas)]))
      } catch (e) {
        otros.push({ clave: "arca:ventas:error-cruce", grupo: "error", papel: "Contra lo presentado a ARCA", titulo: "No se pudo comparar contra lo presentado a ARCA",
          que: (e as Error).message, links: [], respondido: false })
      }
    }
    // 🧾 Los subdiarios, en la base y con lo presentado a ARCA como fuente (JMS 31/10).
    const conArca = (ts: ReturnType<typeof armarTemas>) => subdiariosContraArca(ts, ddjjGuardadas?.filas ?? null, libro.ejercicio.subdiarios.length)
    // ✔ A-FEAT-1487: los temas con una tarea por confirmar pasan a «Para tu visto» (o se rearman si ya no salen solos)
    const visto = (ts: Tema[]) => conciliacion?.visto ? aplicarParaTuVisto(ts, conciliacion.visto.tareas, conciliacion.visto.rearmados, pendientes) : ts
    try { return visto(conArca(armarTemas(coberturaDeArgs(...argsDelExcel(libro, undefined, conciliacion)), pendientes, otros))) } catch { return visto(conArca(armarTemas(null, pendientes, otros))) }
  }
  const temasRecorrido = useMemo(() => libro ? armarTemasRecorrido(libro, conciliacion, ddjjGuardadas) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  [libro, empresa.id, templates, hacienda, cuentas, valores, bancarios, sueldos, cuentasCorrientesConInicio,
    pendientes, ajustes, anioCierre, asientosContables, lecturas, controlCuotas, controlesInicio, propuestaCierre, fotoInicio, conciliacion, ddjjGuardadas])
  /**
   * 👁️ La vista previa se RECALCULA cuando llega cada dato (stock y precios, el cálculo de cierre…): con «Armar todo»
   * se abre enseguida y se va completando sola, en vez de mostrar una foto de cuando se apretó el botón.
   */
  const previa = useMemo(() => {
    if (!verPrevia || !libro) return null
    try { return { wb: armarWorkbook(...argsDelExcel(libro, recorridoParaExcel(temasRecorrido, conciliacion))), error: null as string | null } }
    catch (e) { return { wb: null, error: (e as Error).message } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verPrevia, libro, empresa.id, templates, hacienda, cuentas, valores, bancarios, sueldos, cuentasCorrientesConInicio,
    pendientes, ajustes, anioCierre, asientosContables, lecturas, controlCuotas, controlesInicio, propuestaCierre, fotoInicio, conciliacion, temasRecorrido])
  /**
   * 🔁 A-FEAT-1500: el Excel lleva el recorrido; si no se abrió todavía, se calcula ahora (si no, faltarían los movimientos,
   * las deudas, los echeqs y el cruce contra ARCA, y los resueltos en la app seguirían «abiertos»). Lo usan las dos descargas.
   */
  const argsConRecorrido = async (lib: LibroDiario) => {
    let conc = conciliacion
    if (!conc) { toast.info("Calculando el recorrido para que el Excel diga lo mismo que la pantalla…"); conc = await calcularConciliacion(true) }
    let dd = ddjjGuardadas
    if (!dd) { dd = await leerDdjj(lib); setDdjjGuardadas(dd) }
    const temas = conc ? armarTemasRecorrido(lib, conc, dd) : []
    return argsDelExcel(lib, recorridoParaExcel(temas, conc), conc)
  }
  /**
   * 📒 A-FEAT-1509 — lo que el libro F junta: lo que ya armó la pantalla (papeles bancarios, 03/04, 05, hacienda) y lo que
   * lee aparte (tarjeta, SUSS, FCI, soja, dólar de cierre). Sólo MSA tiene la apertura del contador cargada.
   */
  const entradaBalanceEnLinea = async (lib: LibroDiario): Promise<EntradaBalanceEnLinea | null> => {
    if (empresa.id !== "MSA") return null
    const fc = lib.ejercicio.fechaCierre
    const [tarjeta, suss, fci, soja, tc] = await Promise.all([
      leerDeudaTarjeta(supabase, empresa.schema, fc), leerSussAlCierre(supabase, empresa.id, fc),
      leerFci(supabase, empresa.id, anioCierre), leerSojaInicio(supabase, empresa.id, anioCierre), leerTcCierre(supabase, fc),
    ])
    const { dolares, cajaUsd } = dolaresParaBalance(bancarios?.cuentasEnDolares, tc)
    const provCompras = lib.provisiones.filter(a => a.fuente !== "venta")
    // 👥 A-FEAT-1537: los socios no son proveedores (van a su propia cuenta, después).
    const ccAPagar = (cuentasCorrientesConInicio?.cuentas ?? []).filter(c => !c.contraparte.socio && c.saldoAlCierre > 0).reduce((t, c) => t + c.saldoAlCierre, 0)
    return {
      apertura: APERTURA_MSA_2025, fechaCierre: fc,
      cadenas: bancarios?.cadenas ?? null,
      dolares, cajaUsd,
      fci: fci ? { ...fci, banco: bancarios?.fci?.total ?? null } : null,
      cheques: valores?.cheques ? { total: valores.cheques.total, cantidad: valores.cheques.filas.length } : null,
      anticipos: valores?.anticipos ? { total: valores.anticipos.totalAProveedores, cantidad: valores.anticipos.aProveedores.length } : null,
      proveedores: cuentas?.pagar ? { facturas: cuentas.pagar.total, cuentasCorrientes: Math.round(ccAPagar * 100) / 100 } : null,
      provision: { total: Math.round(provCompras.reduce((t, a) => t + a.total, 0) * 100) / 100, cantidad: provCompras.length },
      tarjeta, suss, soja,
      hacienda: hacienda ? { valuacion: hacienda.valuacion, inicio: hacienda.saldos?.hacienda?.inicio ?? null, cierre: hacienda.saldos?.hacienda?.cierre ?? null } : null,
    }
  }
  /**
   * 📚 A-FEAT-1512: lo marcado «LIB» (contable) en los bancos de las tres empresas, para el libro G (va en paralelo: no es de
   * una sola empresa). Si una cuenta no se puede leer, se avisa y sale lo demás.
   */
  const leerMovimientosLib = async (lib: LibroDiario) => {
    const desde = primerDiaDelEjercicio(lib.ejercicio), hasta = lib.ejercicio.fechaCierre
    const cuentas = [{ empresa: "MSA", schema: "public", tabla: "msa_galicia", nombre: "Galicia MSA" }, { empresa: "PAM", schema: "public", tabla: "pam_galicia", nombre: "Galicia PAM caja de ahorro" },
      { empresa: "PAM", schema: "public", tabla: "pam_galicia_cc", nombre: "Galicia PAM cta cte" }, { empresa: "MA", schema: "ma", tabla: "ma_galicia", nombre: "Galicia MA" }]
    const out: MovimientoLib[] = []
    for (const c of cuentas) {
      const q = c.schema === "public" ? supabase.from(c.tabla) : supabase.schema(c.schema).from(c.tabla)
      const { data, error } = await q.select("fecha, descripcion, categ, detalle, debitos, creditos").ilike("contable", "lib").gte("fecha", desde).lte("fecha", hasta)
      if (error) { toast.warning(`LIB: no se pudo leer ${c.nombre}`); continue }
      for (const m of (data ?? []) as Record<string, unknown>[]) out.push({ empresa: c.empresa, cuenta: c.nombre, fecha: String(m.fecha).slice(0, 10), descripcion: String(m.descripcion ?? ""),
        categ: String(m.categ ?? ""), detalle: String(m.detalle ?? ""), debitos: Number(m.debitos) || 0, creditos: Number(m.creditos) || 0 })
    }
    return out
  }
  /** 📚 Para el clic del set: lo de la ÚLTIMA vuelta de la pantalla (si esperó el stock, el estado del clic ya quedó viejo). */
  const ultimo = useRef({ argsConRecorrido, entradaBalanceEnLinea })
  ultimo.current = { argsConRecorrido, entradaBalanceEnLinea }
  const bajarSet = async (lib: LibroDiario) => {
    const e = await entradasDelSet(lib)
    await descargarSetDelBalance(e.args, e.entradaF, e.lib, e.papeles, e.estructura)
  }
  /** 🗂️ A-FEAT-1624 etapa 2: los papeles tildados, cada uno en su archivo (del mismo cálculo que el set). */
  const bajarPapeles = async (lib: LibroDiario, soloListar = false) => {
    if (!soloListar && !tildados.size) { toast.info("Tildá al menos un libro o una parte."); return }
    setBajandoPapeles(true)
    try {
      const e = await entradasDelSet(lib)
      const r = await descargarPapelesDelBalance(e.args, soloListar ? [] : [...tildados], e.entradaF, e.lib, e.papeles)
      setResultadoPapeles(r)
      const aValor = r.archivos.reduce((s, x) => s + x.formulasAValor, 0)
      if (soloListar) toast.success("✓ Grupos de Templates listados: ya los podés tildar.")
      else if (!r.archivos.length) toast.warning("Nada de lo tildado trajo solapas en este armado.")
      else toast.success(`✓ ${r.archivos.length} archivo(s) bajado(s)${aValor ? ` · ${aValor} fórmula(s) que apuntaban afuera del archivo quedaron con su valor (ver «Control del papel»)` : ""}`)
    } finally { setBajandoPapeles(false) }
  }
  /** Lo que necesita el armado completo (set o papeles): stock, impuestos, estructura y LIB. */
  const entradasDelSet = async (lib: LibroDiario) => {
    // 🛑 A-BUG-1508: sin stock y precios, el libro E y la hacienda del F salían vacíos. Si no se trajeron, se traen primero.
    if (!haciendaRef.current) {
      toast.info("Trayendo stock y precios antes de bajar el set…")
      setPedidoStock(n => n + 1)
      const hasta = Date.now() + 180000
      while (!haciendaRef.current && Date.now() < hasta) await new Promise(r => setTimeout(r, 1000))
      if (!haciendaRef.current) toast.warning("No llegaron el stock y los precios: el set sale igual y lo dice en cada renglón.")
      await new Promise(r => setTimeout(r, 300))
    }
    const args = await ultimo.current.argsConRecorrido(lib)
    const entradaF = await ultimo.current.entradaBalanceEnLinea(lib)
    // 🏛️ A-FEAT-1516: el papel de inmobiliario / Red Vial / automotores del libro H se lee igual que la Planilla de impuestos.
    let papeles: DatosPapelesH | null = null
    try {
      const [cuotasImp, aux] = await Promise.all([cargarCuotasImpuestos(supabase), cargarAuxiliaresPapel(supabase)])
      papeles = { cuotas: cuotasImp, ...aux }
    } catch {
      toast.warning("No se pudieron leer las cuotas de impuestos: el libro H sale sin el papel de inmobiliario, Red Vial y automotores.")
    }
    // 🔁 A-FEAT-1582: el control de estructura de los templates (anual o cuotas, pagos) va a «Inconsistencias» del H para auditar
    let estructura: ProblemaModalidad[] | undefined
    try { estructura = (await cargarProblemasDeModalidad(supabase as any, Number(hoyArgentina().slice(0, 4)))).problemas } catch {
      toast.warning("No se pudo correr el control de estructura de los templates: «Inconsistencias» sale sin ese bloque.")
    }
    return { args, entradaF, lib: await leerMovimientosLib(lib), papeles, estructura }
  }
  const sinResponder = temasRecorrido.filter(t => !t.respondido).length
  /** Lo que todavía no llegó, para que la vista previa lo diga en vez de parecer completa. */
  const faltanEnPrevia = [
    ...(!hacienda ? [pedidoStock > 0 ? "⏳ trayendo stock y precios…" : "stock y precios (hacienda, insumos, granos): falta «Traer stock y precios»"] : []),
    ...(!propuestaCierre ? ["⏳ el cálculo de cierre de cada renglón (solapa «00 Inicio y cierre»)"] : []),
  ]

  /**
   * ⚡ **ARMAR TODO** — nota 🌙 de JMS 29/10: *«botón para armar libro y stock y todo el export entero completo»*.
   * Arma el libro, pide stock y precios y abre la vista previa, que se completa sola a medida que llega cada parte.
   * Bajar el Excel queda a un clic, después de mirarlo (*«en vez de exportarlo para ir a revisar las solapas,
   * empezaría a ver en las preview»*).
   */
  // 🔗 A-FEAT-1466 — llegar por el link: elegir empresa y año, armar el libro y abrir el recorrido en el tema.
  useEffect(() => {
    const t = temaDelLink(window.location.search)
    const e = t && EMPRESAS.find(x => x.id === t.empresa)
    if (!t || !e) return
    setEmpresa(e); setAnioCierre(t.anioCierre); setTemaPedido({ ...t, armando: false })
  }, [])
  useEffect(() => {
    if (!temaPedido || temaPedido.armando || empresa.id !== temaPedido.empresa || anioCierre !== temaPedido.anioCierre) return
    setTemaPedido({ ...temaPedido, armando: true })
    void armarTodo()
  }, [temaPedido, empresa, anioCierre]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!temaPedido?.armando || !libro) return
    setClaveRecorrido(temaPedido.clave); setVerRecorrido(true); setTemaPedido(null)
  }, [temaPedido, libro])
  /**
   * ⚡ Nota 🌙 JMS 01/11: *«abro otro link y tarda lo mismo en cargar cuando tiene prácticamente todo recién cargado»*.
   * La pestaña del recorrido se llama «recorrido-balance» y deja un atajo: si el link del Principal la encuentra con
   * el libro de esa empresa y año ya armado, salta al tema sin volver a cargar nada (`ABRIR_TEMA_BALANCE`).
   */
  useEffect(() => {
    if (!verRecorrido) return
    try { window.name = "recorrido-balance" } catch { /* sin nombre: el link abre otra pestaña, como antes */ }
    const w = window as unknown as Record<string, unknown>
    w.__irATemaBalance = (registro: string) => {
      const t = temaDelLink(`?seccion=reporte&recorrido=${encodeURIComponent(registro)}`)
      if (!t || !libro || t.empresa !== empresa.id || t.anioCierre !== anioCierre) return false
      setClaveRecorrido(t.clave); setVerRecorrido(true)
      return true
    }
    return () => { delete w.__irATemaBalance }
  }, [verRecorrido, libro, empresa.id, anioCierre])

  const armarTodo = async () => {
    setVerPrevia(false)
    await generar()
    setPedidoStock(n => n + 1)
    setVerPrevia(true)
  }

  const generar = async () => {
    setCargando(true)
    setLibro(null)
    setTemplates(null)
    setControlCuotas(null)
    setHacienda(null)
    setCuentas(null)
    setValores(null)
    setBancarios(null)
    setSueldos(null)
    setCuentasCorrientes(null)
    setAsientosContables(null)
    setLecturas(null)
    setControlesInicio(null)
    setFotoInicio(null)
    setPropuestaCierre(null)
    const lect: Lectura[] = []
    // 🧭 A-BUG-1452: lo que el armado ENCUENTRA en los datos no es una falla de la app: ya está en el informe y en el
    // recorrido. Se junta y sale UN cartel tranquilo al final. Sólo salta como aviso lo que la app no pudo leer.
    const hallazgos: string[] = []
    const anotar = (nombre: string, r: { data: unknown[]; esperadas: number | null }) =>
      lect.push({ nombre, llegaron: r.data.length, esperadas: r.esperadas })
    try {
      const ej = armarEjercicio(anioCierre, empresa.mesCierre)
      // Se traen los DOS años que puede tocar el ejercicio y se filtra en la lógica pura: el corte
      // por subdiario vive en un solo lugar y no se puede aplicar distinto en cada fuente.
      const anios = [anioCierre - 1, anioCierre, anioCierre + 1]

      const [arca, historico, ventas, cuotas] = await Promise.all([
        // 📄 A-BUG-1339: todo lo que puede pasar de 1000 filas se trae por tandas.
        traerTodo((d, h) => supabase.schema(empresa.schema).from("comprobantes_arca")
          .select("*", { count: "exact" }).in("año_contable", anios).order("id").range(d, h)),
        // El histórico es sólo de MSA (es lo que migró del sistema anterior) y usa `anio_contable`.
        empresa.id === "MSA"
          ? traerTodo((d, h) => supabase.schema("msa").from("comprobantes_historico").select("*", { count: "exact" }).in("anio_contable", anios).order("id").range(d, h))
          : Promise.resolve({ data: [], error: null }),
        traerTodo((d, h) => supabase.schema(empresa.schema).from("comprobantes_venta")
          .select("*", { count: "exact" }).in("año_contable", anios).order("id").range(d, h)),
        /**
         * 🧾 Los templates viven en `public`, no en el schema de la empresa, y **no tienen
         * subdiario**: se traen por fecha y el corte se hace en `armarTemplatesDelEjercicio`.
         * Se pide un año extra de cada lado para no recortar antes de tiempo.
         */
        // 🧨 2046 cuotas: sin tandas llegaban 1000 y la solapa Templates salía con meses vacíos.
        traerTodo((d, h) => supabase.from("cuotas_egresos_sin_factura")
          .select(SELECT_CUOTAS_LIBRO_H, { count: "exact" })
          .gte("fecha_estimada", `${anioCierre - 2}-01-01`).order("id").range(d, h)),
      ])

      for (const r of [arca, historico, ventas, cuotas]) {
        if (r.error) throw new Error(r.error.message)
      }
      anotar("Compras (ARCA)", arca as { data: unknown[]; esperadas: number | null })
      if (empresa.id === "MSA") anotar("Compras (sistema anterior)", historico as { data: unknown[]; esperadas: number | null })
      anotar("Ventas", ventas as { data: unknown[]; esperadas: number | null })
      anotar("Cuotas de templates", cuotas as { data: unknown[]; esperadas: number | null })

      const compras = [
        ...(arca.data ?? []).map(desdeArca),
        ...(historico.data ?? []).map(desdeHistorico),
      ]
      /**
       * ✍️ Provisiones puestas a mano (A-FEAT-1331): facturas de fecha posterior al cierre que el
       * usuario dijo que son del ejercicio — las de éste y las del anterior (para listarlas).
       * Si fallan, el libro sale igual y se avisa.
       */
      const manuales = { esteEjercicio: [] as AsientoLibroDiario[], anterior: [] as AsientoLibroDiario[] }
      try {
        // 🔁 A-FEAT-1427: también las del HISTÓRICO (la provisión 24/25 de MSA son dos facturas de ago/oct-25 que viven ahí).
        const TABLA_HISTORICO = "msa.comprobantes_historico"
        const { data: incl, error: eIncl } = await supabase.from("ajustes_balance").select("*")
          .eq("empresa", empresa.id).eq("accion", "incluir").in("tabla", [tablaFacturas(empresa.schema), TABLA_HISTORICO, tablaVentas(empresa.schema)])
          .in("anio_cierre", [anioCierre, anioCierre - 1]).is("anulado_at", null)
        if (eIncl) throw new Error(eIncl.message)
        const ajustesIncl = (incl ?? []) as AjusteBalance[]
        const idsDe = (tabla: string) => ajustesIncl.filter(a => a.tabla === tabla).map(a => a.registro_id).filter((x): x is string => !!x)
        if (ajustesIncl.length > 0) {
          const porId = new Map<string, AsientoLibroDiario>()
          const idsArca = idsDe(tablaFacturas(empresa.schema))
          if (idsArca.length) {
            const { data: fs, error: eFs } = await supabase.schema(empresa.schema).from("comprobantes_arca").select("*").in("id", idsArca)
            if (eFs) throw new Error(eFs.message)
            for (const f of fs ?? []) porId.set(String((f as Record<string, unknown>).id), desdeArca(f as Record<string, unknown>))
          }
          const idsHist = idsDe(TABLA_HISTORICO)
          if (idsHist.length) {
            const { data: hs, error: eHs } = await supabase.schema("msa").from("comprobantes_historico").select("*").in("id", idsHist)
            if (eHs) throw new Error(eHs.message)
            for (const f of hs ?? []) porId.set(String((f as Record<string, unknown>).id), desdeHistorico(f as Record<string, unknown>))
          }
          // 🧾 A-FEAT-1564: las VENTAS puestas a mano (van a «03.1 Provisión de cobros», por su fuente «venta»).
          const idsVentas = idsDe(tablaVentas(empresa.schema))
          if (idsVentas.length) {
            const { data: vs, error: eVs } = await supabase.schema(empresa.schema).from("comprobantes_venta").select("*").in("id", idsVentas)
            if (eVs) throw new Error(eVs.message)
            for (const f of vs ?? []) porId.set(String((f as Record<string, unknown>).id), desdeVenta(f as Record<string, unknown>))
          }
          for (const a of ajustesIncl) {
            const f = a.registro_id ? porId.get(a.registro_id) : undefined
            if (!f) { hallazgos.push(`Una provisión a mano apunta a una factura que no se encontró: ${a.concepto}`); continue }
            const asiento = { ...f, provision_motivo: a.motivo }
            ;(a.anio_cierre === anioCierre ? manuales.esteEjercicio : manuales.anterior).push(asiento)
          }
        }
      } catch (e) {
        toast.warning("No se pudieron leer las provisiones puestas a mano: " + (e as Error).message)
      }
      /**
       * 🔢 Los proveedores fijos (A-FEAT-1332): cuántas facturas trae cada uno por mes, de su ficha.
       * Si falla, el libro sale igual sin ese control y se avisa.
       */
      let fijos: { proveedores: ProveedorFijo[]; hoy: string } | undefined
      try {
        const { data: provs, error: eProv } = await supabase.from("proveedores")
          .select("cuit, razon_social, facturas_por_mes").not("facturas_por_mes", "is", null)
        if (eProv) throw new Error(eProv.message)
        fijos = {
          hoy: hoyArgentina(),
          proveedores: (provs ?? []).map(p => ({
            cuit: String(p.cuit ?? ""), nombre: String(p.razon_social ?? ""), facturasPorMes: Number(p.facturas_por_mes),
          })),
        }
      } catch (e) {
        toast.warning("No se pudo leer la lista de proveedores fijos: el control de cantidad no sale. " + (e as Error).message)
      }
      const armado = armarLibroDiario(compras, (ventas.data ?? []).map(desdeVenta), ej, PRESENTADO_ARCA_COMPRAS[empresa.id], manuales, fijos)
      setLibro(armado)
      setArmadoA(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }))

      // 🔁 A-FEAT-1427: lo que el balance anterior dejó provisionado contra lo que la app reconoce (avisa, no frena).
      try {
        const fechaFoto = armarEjercicio(anioCierre - 1, empresa.mesCierre).fechaCierre
        const { foto, error: eFoto } = await leerFotoInicio(supabase, empresa.id, fechaFoto, RENGLONES.map(r => r.id))
        if (eFoto) throw new Error(eFoto)
        setFotoInicio(foto)
        const provision = controlarProvisionAnterior(foto, armado.provisionesEjercicioAnterior, armado.compras)
        // 🗂️ Hechos chicos para «00 Cobertura»: lo que el export no trae. Cada uno por separado: si falla, queda «no se pudo».
        const inicio = primerDiaDelEjercicio(ej)
        const hechos: HechosCobertura = {}
        try {
          const r = await supabase.schema(empresa.schema).from("cheques").select("id", { count: "exact", head: true }).lt("fecha_emision", inicio)
          if (!r.error) hechos.chequesAntesDelInicio = r.count ?? 0
        } catch { /* queda sin saber */ }
        try {
          const r = await supabase.from("anticipos_proveedores").select("id", { count: "exact", head: true }).eq("empresa", empresa.id).lt("fecha_pago", inicio)
          if (!r.error) hechos.anticiposAntesDelInicio = r.count ?? 0
        } catch { /* queda sin saber */ }
        for (const [tabla, campo] of [["movimientos_hacienda", "primerMovimientoHacienda"], ["movimientos_insumos", "primerMovimientoInsumos"]] as const) {
          try {
            const r = await supabase.schema("productivo").from(tabla).select("fecha").order("fecha", { ascending: true }).limit(1)
            if (!r.error) hechos[campo] = r.data?.[0]?.fecha ? String(r.data[0].fecha).slice(0, 10) : null
          } catch { /* queda sin saber */ }
        }
        // 🐄 el hueco de la hacienda: con qué arranca la app y qué ventas facturadas caen antes (cuadre del stock)
        try {
          const arranque = hechos.primerMovimientoHacienda
          if (arranque && arranque > inicio) {
            const tope = new Date(Date.parse(arranque) + 3 * 86400000).toISOString().slice(0, 10)
            const { data: aj, error: e1 } = await supabase.schema("productivo").from("movimientos_hacienda").select("cantidad").eq("tipo", "ajuste_stock").gte("fecha", arranque).lte("fecha", tope)
            const { data: vs, error: e2 } = await supabase.schema(empresa.schema).from("comprobantes_venta").select("fecha_liquidacion, cabezas, denominacion_cliente").gte("fecha_liquidacion", inicio).lt("fecha_liquidacion", arranque).not("cabezas", "is", null)
            if (!e1 && !e2) hechos.huecoHacienda = {
              arranque, cabezasArranque: (aj ?? []).reduce((s, x: { cantidad: number | null }) => s + (Number(x.cantidad) || 0), 0),
              vendidas: (vs ?? []).reduce((s, x: { cabezas: number | string | null }) => s + (Number(x.cabezas) || 0), 0),
              liquidaciones: (vs ?? []).map((x: { fecha_liquidacion: string; cabezas: number | string | null; denominacion_cliente: string | null }) =>
                `${String(x.fecha_liquidacion).slice(0, 10).split("-").reverse().join("/")} ${String(x.denominacion_cliente ?? "?").split(" ")[0]} ${Number(x.cabezas) || 0} cab`),
            }
          }
        } catch { /* queda sin saber */ }
        setControlesInicio({ provision, hechos })
        if (provision.estado === "no cierra") hallazgos.push(
          `Provisión del ejercicio anterior: el balance anterior provisionó $ ${fmt(provision.declarado ?? 0)} y la app reconoce $ ${fmt(provision.reconocido)}. Ver «05 Provisión».`)
      } catch (e) {
        toast.warning("No se pudo controlar la provisión contra el balance anterior: " + (e as Error).message)
      }

      /**
       * 📒 **Asientos Contables** (A-FEAT-1318). No tienen subdiario —por eso la consulta de arriba,
       * que va por año contable, no los trae— y pertenecen al ejercicio por su fecha de emisión.
       * En su propio `try`: si falla, el libro sale igual y se avisa que la solapa no va.
       */
      try {
        const { data, error } = await supabase.schema(empresa.schema).from("comprobantes_arca")
          .select("*").eq("ddjj_iva", ESTADO_ASIENTO_CONTABLE)
        if (error) throw new Error(error.message)
        setAsientosContables(asientosContablesDelEjercicio((data ?? []) as Record<string, unknown>[], ej))
      } catch (e) {
        toast.warning("No se pudieron leer las facturas de «Asientos Contables»: el Excel sale sin esa solapa.")
      }

      /**
       * 💳 **Cuentas a pagar y a cobrar al cierre.**
       *
       * 🔑 Manda **cuándo se pagó**, no el estado de hoy: una factura que hoy figura paga pero se
       * pagó después del cierre, al cierre era deuda. La fecha sale de `fecha_pago` o, mejor, del
       * movimiento bancario conciliado — y se busca en **las diez** tablas que llevan el vínculo,
       * no en tres (§ 🔁 La propagación del dato).
       *
       * ⚠️ Si la búsqueda de fechas falla, **el libro ya está en pantalla igual**: estos dos papeles
       * son un agregado, no pueden tirar abajo el resto del export.
       */
      try {
        const porId = new Map<string, { estado: string; fechaPago: string | null }>()
        for (const f of [...(arca.data ?? []), ...(ventas.data ?? [])]) {
          const r = f as Record<string, unknown>
          if (!r.id) continue
          // Las ventas no tienen `fecha_pago`: su fecha propia de cobro es `fecha_acreditacion` (A-FEAT-1388 U6).
          const propia = r.fecha_pago ?? r.fecha_acreditacion
          porId.set(String(r.id), {
            estado: String(r.estado ?? "pendiente"),
            fechaPago: propia ? String(propia).slice(0, 10) : null,
          })
        }

        const cliente = supabase as unknown as ClienteMinimo
        const [pagos, cobros] = await Promise.all([
          buscarFechasDePagoBancarias(cliente, armado.compras.map(a => a.id)),
          // 💰 A-FEAT-1388 U6: las ventas se atan al banco por `comprobante_venta_id`, no por el vínculo de compras.
          buscarFechasDeCobroBancarias(cliente, armado.ventas.map(a => a.id)),
        ])
        const tablasQueFallaron = [...new Set([...pagos.tablasQueFallaron, ...cobros.tablasQueFallaron])]
        if (tablasQueFallaron.length > 0) {
          // Nada en silencio: una tabla que no se pudo leer puede hacer parecer impago algo pagado.
          toast.warning(`No se pudieron leer ${tablasQueFallaron.join(", ")}: puede faltar alguna fecha de pago.`)
        }
        // 🔗 Cobro agrupado: la venta del grupo sin vínculo directo toma la fecha de su grupo.
        const conPropia = new Map(cobros.porComprobante)
        for (const v of armado.ventas) {
          const p = porId.get(v.id)?.fechaPago
          if (p && !conPropia.has(v.id)) conPropia.set(v.id, p)
        }
        const fechasCobro = completarConGrupoDeCobro(
          (ventas.data ?? []).map(x => x as { id: string; grupo_cobro_id?: string | null }), conPropia)
        const porComprobante = new Map([...pagos.porComprobante, ...fechasCobro])
        /** 🔎 A-FEAT-1506: dónde se ve el pago — el canal de donde salió la fecha. */
        const donde = new Map([...(pagos.dondePorComprobante ?? []), ...(cobros.dondePorComprobante ?? [])])
        // ✍️ A-FEAT-1506: las facturas que el balance da por pagadas al cierre (ajuste con motivo; la factura no cambia).
        const pagadosAlCierre = new Map<string, string>()
        {
          const { data: aj, error: eAj } = await supabase.from("ajustes_balance").select("registro_id, motivo")
            .eq("empresa", empresa.id).eq("anio_cierre", anioCierre).eq("accion", "pagado_al_cierre").is("anulado_at", null)
          if (eAj) toast.warning("No se pudieron leer las facturas dadas por pagadas al cierre: figuran como deuda. " + eAj.message)
          for (const a of (aj ?? []) as { registro_id: string | null; motivo: string }[]) if (a.registro_id) pagadosAlCierre.set(a.registro_id, a.motivo)
        }

        const conPago = (asientos: typeof armado.compras): ComprobanteConPago[] =>
          asientos.map(a => {
            const propia = porId.get(a.id)?.fechaPago ?? null
            const banco = porComprobante.get(a.id) ?? null
            return {
              asiento: a,
              estado: porId.get(a.id)?.estado ?? "pendiente",
              fechaPago: propia ?? banco,
              origenFecha: propia ? "fecha_pago" : banco ? "movimiento bancario" : "sin dato",
              dondeSeVe: propia ? "fecha de pago cargada (Cash Flow)" : banco ? canalDePago(donde.get(a.id)) : undefined,
            }
          })

        // 🛡️ A-FEAT-1385: los seguros en «cuotas» deben sólo lo que su póliza no pagó al cierre. Si falla, van enteros y se avisa.
        let cuotasPoliza: Map<string, CanceladoPorCuotas> | undefined
        try {
          const pol = await supabase.from("polizas_seguro").select("poliza,template_id,polizas_endosos(comprobante_arca_id,polizas_cuotas(vencimiento,importe))")
          if (pol.error) throw new Error(pol.error.message)
          const filasPol = (pol.data ?? []) as Record<string, unknown>[]
          const tpls = new Set(filasPol.map(p => p.template_id).filter(Boolean))
          const deTpl = ((cuotas.data ?? []) as unknown as Record<string, unknown>[]).filter(q => tpls.has(q.egreso_id))
          const fc = await buscarFechasDePagoDeCuotas(cliente, deTpl.map(q => String(q.id)))
          if (fc.tablasQueFallaron.length > 0) throw new Error(`no se pudo leer ${fc.tablasQueFallaron.join(", ")}`)
          cuotasPoliza = canceladoPorCuotasAlCierre(polizasParaCierreDesde(filasPol, deTpl, fc.porComprobante), ej.fechaCierre)
        } catch (e) {
          toast.warning("No se pudieron leer las cuotas de las pólizas: los seguros en cuotas van enteros al papel 04. " + (e as Error).message)
        }
        /**
         * 🔁 JMS 29/10: «si muestra saldo en cta cte no debe mostrar aparte comprobantes individuales ni a cobrar
         * ni a pagar». Los de quien tiene cuenta corriente en el 14 salen del 03/04 (listados aparte, con su total).
         */
        const conCC = cuitsConCuentaCorriente(empresa.id)
        setCuentas({
          pagar: sacarLosDeCuentaCorriente(armarCuentasAlCierre(conPago(armado.compras), ej.fechaCierre, cuotasPoliza, pagadosAlCierre), conCC),
          cobrar: sacarLosDeCuentaCorriente(armarCuentasAlCierre(conPago(armado.ventas), ej.fechaCierre), conCC),
        })
      } catch (e) {
        toast.warning("No se pudieron armar las cuentas a pagar y a cobrar; el resto del libro salió igual.")
      }

      /**
       * 💵 **Los bloques 04.1, 04.2 y 03.1** — cheques dados, anticipos y provisión de cobros
       * (A-FEAT-1195). Ver `lib/balance/valores-al-cierre.ts`, que es donde está el criterio.
       *
       * 🔑 Las dos consultas traen **todo** y el corte lo hace la lógica pura: si el filtro por fecha
       * viviera en el `select`, el papel y el control del camino inverso usarían cortes distintos.
       *
       * ⚠️ En su propio `try`: son bloques de dos papeles que ya están armados.
       */
      try {
        /**
         * 🧨 **`cheques` existe sólo en el schema `msa`.** No es un olvido: el módulo de cheques es
         * de MSA. Para PAM y MA el bloque queda **sin leer** —no en cero—, y el índice lo dice: un
         * cero afirma que se miró, y acá no hay dónde mirar.
         */
        let cheques: ChequesDados | undefined
        if (empresa.id === "MSA") {
          const { data, error } = await supabase.schema("msa").from("cheques")
            .select("id, numero, banco, monto, moneda, fecha_emision, fecha_cobro, "
              + "beneficiario_nombre, beneficiario_cuit, estado, concepto, factura_id, anticipo_id")
          if (error) throw new Error(error.message)
          cheques = armarChequesDados(
            (data ?? []) as unknown as ChequeCrudo[], ej.fechaCierre, hoyArgentina())
        }

        const [ant, apl] = await Promise.all([
          traerTodo((d, h) => supabase.from("anticipos_proveedores")
            .select("id, empresa, nombre_proveedor, cuit_proveedor, monto, monto_restante, "
              + "monto_sicore, descuento_aplicado, fecha_pago, tipo, estado, estado_pago, descripcion", { count: "exact" }).order("id").range(d, h)),
          traerTodo((d, h) => supabase.from("anticipos_facturas")
            .select("anticipo_id, monto_aplicado, fecha_aplicacion", { count: "exact" }).order("id").range(d, h)),
        ])
        for (const r of [ant, apl]) if (r.error) throw new Error(r.error.message)
        anotar("Anticipos", ant); anotar("Aplicaciones de anticipos", apl)

        // ✍️ A-FEAT-1537: si el usuario decidió los anticipos de este ejercicio en 0, van en 0 (la lista, al respaldo).
        const anticipos = aplicarAnticiposEnCero(armarAnticiposAlCierre(
          (ant.data ?? []) as unknown as AnticipoCrudo[],
          (apl.data ?? []) as unknown as AplicacionDeAnticipo[],
          ej.fechaCierre,
          empresa.id,
          /**
           * ⚠️ **Las filas sin empresa se cuentan como de MSA y de ninguna otra.** Son $137,4 M al
           * cierre: la columna se agregó después y el módulo nació siendo de MSA. Se marcan en el
           * papel y el índice lo avisa — no es un silencio, es un criterio declarado (A-DAT-73).
           */
          empresa.id === "MSA",
        ), empresa.id, anioCierre)
        setValores({ cheques, anticipos })

        // 🧮 El control del camino inverso se muestra, no sólo se escribe en la solapa.
        if (anticipos.descuadres.length > 0) {
          hallazgos.push(
            `El saldo de ${anticipos.descuadres.length} anticipo(s) no coincide con el del sistema: `
            + "está en la solapa 04.2, al final.",
          )
        }
      } catch (e) {
        toast.warning("No se pudieron traer los cheques y anticipos; el resto del libro salió igual.")
      }

      /**
       * 🏦 **Los papeles bancarios (07, 08 y 09).**
       *
       * Se traen de las cuentas de `CUENTAS_DEL_EXTRACTO` —la misma lista que usa el control por
       * consola, para que los números no puedan discrepar— y se arman con la lógica pura de
       * `lib/balance/papeles-bancarios.ts`.
       *
       * ⚠️ Van en su propio `try`: si el extracto falla, **el resto del libro ya está en pantalla**.
       * Estos tres son anexos del resultado, no el resultado.
       */
      try {
        const meses = mesesDelEjercicio(anioCierre, empresa.mesCierre)
        const [aaF, mmF] = meses[11].split("-").map(Number)
        const finDelEjercicio = new Date(Date.UTC(aaF, mmF, 0)).toISOString().slice(0, 10)

        const { data: planCuentas } = await supabase.from("cuentas_contables")
          .select("nro_cuenta, cuenta_contable, nombre_totalizadora, tipo")

        const movimientos: Array<MovimientoExtracto & { donde: string }> = []
        const saldos: Array<import("@/lib/dolares/posicion-cierre").SaldoParaBalance> = []
        /** 🏦 La cadena inicio → cierre de cada cuenta (A-FEAT-1206). */
        const cadenas: CadenaDeSaldos[] = []
        const noSePudoLeer: string[] = []

        for (const t of CUENTAS_DEL_EXTRACTO[empresa.id] ?? []) {
          const q = t.schema === "public"
            ? supabase.from(t.tabla)
            : supabase.schema(t.schema).from(t.tabla)
          const leido = await traerTodo((d, h) => q
            /**
             * 🧨 **`orden` no está de adorno.** Es la posición del movimiento dentro del día, y sin
             * ella «el último del ejercicio» es el que la base quiera devolver: el 30/06/2026 hay 10
             * movimientos en Banco Galicia y entre el primero y el último hay **$2,58 M**
             * → A-BUG-1224. Las 7 tablas de extracto y caja la tienen.
             */
            .select("fecha, descripcion, categ, nro_cuenta, debitos, creditos, saldo, orden, nro_resumen", { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finDelEjercicio)
            // 🧨 A-BUG-1339: jul→mar suman 1000 movimientos; sin tandas abril, mayo y junio no llegaban.
            .order("fecha", { ascending: true }).order("orden", { ascending: true }).order("id").range(d, h))
          const { data, error } = leido
          if (!error) anotar(`Extracto ${t.nombre}`, leido)

          if (error) {
            // Nada en silencio: una cuenta que no se pudo leer hace faltar gastos del papel.
            noSePudoLeer.push(t.nombre)
            saldos.push({ nombre: t.nombre, saldo: null, fecha: null })
            continue
          }
          const filas = (data ?? []) as MovimientoExtracto[]
          filas.forEach(f => movimientos.push({ ...f, donde: t.nombre }))

          /**
           * 🧮 El saldo al cierre y la cadena que lo explica salen del **mismo** lugar, así que no
           * pueden discrepar entre la solapa y el control. Ver `lib/balance/saldos-al-inicio.ts`.
           */
          const cadena = armarCadenaDeSaldos(
            t.nombre, filas, saldoAlInicioDe(empresa.id, ej.etiqueta, t.nombre))
          cadenas.push(cadena)
          // 📎 A-FEAT-1571: de qué resumen salió el último movimiento (el respaldo del saldo), si se sabe
          saldos.push({ nombre: t.nombre, saldo: cadena.saldoAlCierre, fecha: cadena.hasta,
            nroResumen: (filas[filas.length - 1] as { nro_resumen?: string | null } | undefined)?.nro_resumen ?? null })
        }
        // 💵 A-FEAT-1398: las cuentas en dólares de la empresa, en pesos al TC de cierre (sólo si tienen movimientos)
        const dolares = await saldosEnDolaresParaBalance(supabase, empresa.id, finDelEjercicio)
        saldos.push(...dolares.saldos)
        for (const a of dolares.avisos) { if (a.startsWith("No se pudo")) toast.warning(`Dólares: ${a}`); else hallazgos.push(`Dólares: ${a}`) }
        // 💵 A-FEAT-1503: los gastos de las cuentas BANCARIAS en dólares, en dólares (van aparte en el papel 08).
        const gastosEnDolares: { cuenta: string; gastos: ReturnType<typeof armarGastosBancarios> }[] = []
        const movsEnDolares: Array<MovimientoExtracto & { donde: string }> = []
        const cuentasEnDolares: { cuenta: string; tipo: string; movs: MovimientoExtracto[] }[] = []
        for (const c of (CUENTAS_EN_MONEDA_EXTRANJERA[empresa.id] ?? [])) {
          const q = c.schema_bd === "public" ? supabase.from(c.tabla_bd) : supabase.schema(c.schema_bd).from(c.tabla_bd)
          // 💵 A-FEAT-1530: también el TC, los pesos y el template de cada movimiento, para la solapa «07.2 Operaciones en dólares»
          const leido = await traerTodo((d, h) => q.select("fecha, descripcion, categ, nro_cuenta, debitos, creditos, saldo, orden, tipo_cambio, importe_pesos, comprobantes_pagados, nota_operador", { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finDelEjercicio).order("fecha").order("orden").order("id").range(d, h))
          if (leido.error) { toast.warning(`No se pudieron leer los gastos de ${c.nombre}: faltan en el papel 08.`); continue }
          anotar(`Extracto ${c.nombre}`, leido)
          // 📒 A-FEAT-1509: los movimientos de cada cuenta en dólares (bancos y cajas), para el libro F
          cuentasEnDolares.push({ cuenta: c.nombre, tipo: c.tipo, movs: (leido.data ?? []) as MovimientoExtracto[] })
          if (c.tipo !== "banco") continue
          gastosEnDolares.push({ cuenta: c.nombre, gastos: armarGastosBancarios((leido.data ?? []) as MovimientoExtracto[], (planCuentas ?? []) as CuentaDelPlan[], meses) })
          movsEnDolares.push(...((leido.data ?? []) as MovimientoExtracto[]).map(m => ({ ...m, donde: c.nombre })))
        }
        /**
         * 🧮 El control se VE, no vive sólo en la solapa (§ 🧮). Si los importes del extracto no
         * explican sus propios saldos, el saldo que va al papel no se puede entregar.
         */
        const noCierran = cadenas.filter(c => c.diferencia != null && Math.abs(c.diferencia) > 0.01)
        if (noCierran.length > 0) {
          hallazgos.push(
            `En ${noCierran.map(c => c.cuenta).join(", ")} los movimientos no explican el saldo `
            + "al cierre. Está en la solapa 07 Bancos, arriba.",
          )
        }
        if (noSePudoLeer.length > 0) {
          toast.warning(`No se pudieron leer ${noSePudoLeer.join(", ")}: faltan sus gastos en el papel 08.`)
        }

        const movFCI = movimientos.filter(esFCI)
        /**
         * 🧾 El impuesto al cheque (A-FEAT-1190), total y desglosado. Sólo de los BANCOS: las cajas
         * no pagan el impuesto, y contarlas haría creer que un mes tiene extracto cuando no.
         */
        const movBanco = movimientos.filter(m => !/caja/i.test(m.donde))
        setBancarios({
          impuestoCheque: armarImpuestoCheque(movBanco, meses,
            pctComputable(empresa.id).general, pctComputable(empresa.id).efectivo),
          gastos: armarGastosBancarios(movimientos, (planCuentas ?? []) as CuentaDelPlan[], meses),
          gastosEnDolares,
          cuentasEnDolares,
          // 💵 A-FEAT-1530: la otra punta en PESOS de las compraventas de dólares (cuenta «Compra / Venta de dólares» en los extractos en pesos)
          compraVentaPesos: movimientos.filter(m => /compra\s*\/\s*venta de d[oó]lares/i.test(String(m.categ ?? "")))
            .map(m => ({ fecha: String(m.fecha).slice(0, 10), cuenta: m.donde, descripcion: m.descripcion, debitos: m.debitos, creditos: m.creditos })),
          // 📚 A-FEAT-1505: el detalle movimiento por movimiento para el libro C (impuestos y gastos bancarios, intereses, inversiones)
          detalleBancario: detalleBancarioDelLibroC(movimientos, movsEnDolares, (planCuentas ?? []) as CuentaDelPlan[], esFCI),
          retiros: armarRetirosYAportes(movimientos, meses),
          saldos,
          cadenas,
          movimientosFCI: movFCI.length,
          /**
           * Los saldos del fondo van vacíos: **no están en el extracto**. El extracto ve la plata que
           * entra y sale de la cuenta, no cuánto quedó invertido. La solapa los deja para que el
           * usuario los complete y el resultado financiero se calcula solo, con fórmula.
           */
          fci: armarFondosComunes(movFCI, {}, {}),
          // 💹 JMS 06/11: la tenencia del FCI ya cargada (resúmenes FIMA, scripts 170/174) va al papel 07
          fciTenencia: await leerFci(supabase, empresa.id, anioCierre).catch(() => null),
          // 📎 A-FEAT-1571: los extractos y resúmenes vinculados (scripts 211/212) — el saldo abre su documento
          documentosRespaldo: await Promise.resolve(supabase.from("documentos_respaldo").select("cuenta, periodo, tipo, url, nombre_archivo, ruta_drive, drive_file_id").eq("empresa", empresa.id))
            .then(r => (r.data ?? []) as import("@/lib/balance/respaldos").DocumentoRespaldo[]).catch(() => []),
          // 🔗 JMS 06/11 (1A): las copias en «- Respaldo» — el Excel apunta a ellas, que es lo que ve el contador
          copiasRespaldo: await Promise.resolve(supabase.from("balance_datos_usuario").select("clave, texto")
            .eq("empresa", empresa.id).eq("anio_cierre", anioCierre).eq("papel", PAPEL_COPIAS))
            .then(r => Object.fromEntries((r.data ?? []).filter(x => x.texto).map(x => [x.clave as string, x.texto as string]))).catch(() => ({})),
        })
      } catch {
        toast.warning("No se pudieron armar los papeles bancarios; el resto del libro salió igual.")
      }
      /**
       * 👷 **Los sueldos** (A-FEAT-1216). Se cortan por `anio`/`mes` —no tienen subdiario— con los
       * mismos 12 meses que los papeles bancarios, así el ejercicio es uno solo en todo el Excel.
       *
       * ⚠️ En su propio `try`: el resto del libro ya está en pantalla.
       */
      /** 👷 A-FEAT-1422 (8): los meses de sueldo, también para la cuenta corriente del socio (abajo). */
      let periodosParaCC: SueldoParaCC[] = []
      try {
        const meses = mesesDelEjercicio(anioCierre, empresa.mesCierre)
        const [aa0] = meses[0].split("-").map(Number)
        const [aaN] = meses[11].split("-").map(Number)
        const leidoSueldos = await traerTodo((d, h) => supabase
          .from("sueldos_periodos")
          .select("*, empleado:sueldos_empleados(nombre, empresa, tipo_empleado, cuit_empleado)", { count: "exact" })
          .in("anio", aa0 === aaN ? [aa0] : [aa0, aaN]).order("id").range(d, h))
        const { data: periodosSueldo, error: errSueldos } = leidoSueldos
        if (errSueldos) throw new Error(errSueldos.message)
        anotar("Sueldos", leidoSueldos)
        periodosParaCC = (periodosSueldo ?? []) as unknown as SueldoParaCC[]

        const armadoSueldos = armarSueldosDelEjercicio(
          (periodosSueldo ?? []) as unknown as PeriodoDeSueldo[], meses)
        /**
         * 👷 A-FEAT-1537 (JMS 04/11: «agregar sueldos, sin José, Andrés, MA»): lo devengado y no pagado al cierre, por la
         * FECHA de cada pago. En su propio try: si no se leen los pagos, el papel 13 sale igual y se avisa.
         */
        try {
          const ids = ((periodosSueldo ?? []) as Array<{ id: string; anio: number; mes: number }>)
            .filter(p => meses.includes(`${p.anio}-${String(p.mes).padStart(2, "0")}`)).map(p => p.id)
          const pagosSueldo: PagoDeSueldo[] = []
          for (let i = 0; i < ids.length; i += 200) {
            const leidoPagos = await traerTodo((d, h) => supabase.from("sueldos_pagos")
              .select("periodo_id, fecha, monto", { count: "exact" }).in("periodo_id", ids.slice(i, i + 200)).order("id").range(d, h))
            if (leidoPagos.error) throw new Error(leidoPagos.error.message)
            pagosSueldo.push(...((leidoPagos.data ?? []) as unknown as PagoDeSueldo[]))
          }
          armadoSueldos.impagosAlCierre = sueldosImpagosAlCierre((periodosSueldo ?? []) as unknown as PeriodoConId[],
            pagosSueldo, meses, armarEjercicio(anioCierre, empresa.mesCierre).fechaCierre, empresa.id)
        } catch {
          toast.warning("No se pudieron leer los pagos de sueldos: el papel 04 sale sin los sueldos impagos al cierre.")
        }
        setSueldos(armadoSueldos)

        // 🧮 El control se ve: si el bruto recompuesto no da el guardado, hay que mirarlo.
        if (armadoSueldos.descuadres.length > 0) {
          hallazgos.push(
            `En ${armadoSueldos.descuadres.length} sueldo(s) el bruto no coincide con sus partes: `
            + "está en la solapa 13 Sueldos, al final.")
        }
      } catch {
        toast.warning("No se pudieron armar los sueldos; el resto del libro salió igual.")
      }

      /**
       * 🧾 **Las cuentas corrientes** (A-FEAT-1218). Las tres fuentes que hacen falta:
       *
       * 1. las **compras**, de ARCA (con CUIT) y del **histórico** (sin CUIT, se une por alias);
       * 2. las **ventas**, que compensan;
       * 3. los **movimientos con la columna `contable` cargada**, que es donde el usuario ya viene
       *    marcando a mano de quién es cada pago.
       *
       * ⚠️ Sólo se arma para **MSA**: la columna `contable` y el histórico son suyos.
       */
      if (empresa.id === "MSA") {
        try {
          const comprasCC: CompraParaCC[] = armado.compras.map(a2 => ({
            id: a2.id,
            fecha: a2.fecha,
            numero: `${a2.punto_venta ?? ""}-${a2.numero ?? ""}`,
            total: a2.total,
            // 🔑 El histórico no trae CUIT: por eso se manda el nombre, que es con lo que se une.
            cuit: a2.fuente === "historico" ? null : a2.cuit,
            denominacion: a2.denominacion,
          }))
          // 🔁 A-FEAT-1499: las retenciones sufridas cuentan como cobrado (la regla de siempre: las de la tabla mandan,
          // las de la liquidación valen si la tabla no tiene ese impuesto — `retencionesDeVenta`).
          const leidoRet = await leerCobrosYRetenciones(supabase, empresa.id, empresa.schema)
          if (!leidoRet.retenciones) toast.warning("Cuentas corrientes: no se pudieron leer las retenciones recibidas; van sólo las de la liquidación.")
          const ventasCC: VentaParaCC[] = armado.ventas.map(v => {
            const r = retencionesDeVenta({ asiento: v, retIva: v.detalleVenta?.ret_iva ?? 0, retIibb: v.detalleVenta?.ret_iibb ?? 0 } as unknown as FilaVentaConsensuada, leidoRet.retenciones ?? [])
            return {
              id: v.id,
              fecha: v.fecha,
              numero: `${v.punto_venta ?? ""}-${v.numero ?? ""}`,
              total: v.total,
              cuit: v.cuit,
              retenciones: Math.round((r.iva + r.iibb + r.gan) * 100) / 100,
            }
          })

          const meses = mesesDelEjercicio(anioCierre, empresa.mesCierre)
          const [aaF2, mmF2] = meses[11].split("-").map(Number)
          const finEj = new Date(Date.UTC(aaF2, mmF2, 0)).toISOString().slice(0, 10)
          const colsCC = "id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, cuit:leyendas_adicionales_2, template_cuota_id"
          const leidoCC = await traerTodo((d, h) => supabase.from("msa_galicia")
            .select(colsCC, { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finEj)
            .not("contable", "is", null).order("id").range(d, h))
          anotar("Movimientos de cuentas corrientes", leidoCC)
          // 🔁 A-FEAT-1499: las cuentas que van por CUIT (AFA, ACREN) suman todo lo del banco con su CUIT, marcado o no.
          const cuitsCC = CONTRAPARTES_DEL_BALANCE.filter(c => c.porCuit).map(c => `leyendas_adicionales_2.ilike.*${c.cuit}*`).join(",")
          const leidoCuit = await traerTodo((d, h) => supabase.from("msa_galicia")
            .select(colsCC, { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finEj)
            .or(cuitsCC).order("id").range(d, h))
          anotar("Movimientos de AFA y ACREN (por CUIT)", leidoCuit)
          // 💳 A-FEAT-1577 (07/11): el pago de la tarjeta ya no lleva la marca «Desglosar» (script 229): se lo reconoce por lo que
          // dice el banco. Se trae aunque no tenga marca, para abrirlo con su resumen.
          const leidoPagoTj = await traerTodo((d, h) => supabase.from("msa_galicia")
            .select(colsCC, { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finEj)
            .is("contable", null).ilike("descripcion", "%visa%").order("id").range(d, h))
          anotar("Pagos de la tarjeta (sin marca)", leidoPagoTj)
          const movsCC = [...(leidoCC.data ?? []), ...((leidoCuit.data ?? []) as unknown[]), ...((leidoPagoTj.data ?? []) as unknown[])]
            .filter((m, i, todos) => todos.findIndex(x => (x as { id: string }).id === (m as { id: string }).id) === i)

          /**
           * 💳 Los consumos de la tarjeta de MSA, ANTES de armar las cuentas: los marcados para un socio («CTA MA») entran a su cuenta
           * corriente (A-FEAT-1577), y con los mismos se abre el pago de la tarjeta más abajo. Si fallan, el papel sale igual y avisa.
           */
          let consumos: ConsumoTarjeta[] = []
          try {
            const [leidoTj, polTj] = await Promise.all([
              traerTodo((d, h) => supabase.schema("msa").from("tarjeta_visa_business")
                .select("fecha_vencimiento, descripcion, categ, contable, debitos, creditos, debitos_usd, template_id", { count: "exact" })
                .eq("tipo_fila", "movimiento").gte("fecha_vencimiento", `${meses[0]}-01`).lte("fecha_vencimiento", finEj)
                .order("id").range(d, h)),
              supabase.from("polizas_seguro").select("template_id").not("template_id", "is", null),
            ])
            if (leidoTj.error) throw new Error(leidoTj.error.message)
            anotar("Consumos de la tarjeta (para abrir su pago)", leidoTj)
            const tplConPoliza = new Set(((polTj.data ?? []) as Array<{ template_id: string | null }>).map(p => p.template_id))
            consumos = ((leidoTj.data ?? []) as Array<Record<string, unknown>>).map(x => ({
              vencimiento: (x.fecha_vencimiento as string | null) ?? null,
              descripcion: x.descripcion as string | null, categ: x.categ as string | null, contable: x.contable as string | null,
              debitos: Number(x.debitos ?? 0), creditos: Number(x.creditos ?? 0), debitosUsd: Number(x.debitos_usd ?? 0),
              conPoliza: !!x.template_id && tplConPoliza.has(x.template_id as string),
            }))
          } catch {
            toast.warning("No se pudieron leer los consumos de la tarjeta: su pago queda sin abrir y lo de los socios por la tarjeta no entra a sus cuentas.")
          }
          const porLaTarjeta = consumosDeTarjetaComoMovimientos(movsCC as unknown as MovimientoParaCC[], consumos)

          /**
           * 👷 A-FEAT-1422 (8) — el sueldo pendiente de un socio (MA) entra a SU cuenta corriente como deuda
           * de MSA. JMS 29/10: «ella cobra pero no por recibo… entra dentro de su cuenta corriente».
           */
          comprasCC.push(...sueldosPendientesComoCompras(periodosParaCC, meses))

          /**
           * 👥 A-FEAT-1577 (JMS 07/11: «la 14.1 debería sintetizar todo»): (1) cada movimiento de Galicia MSA con su agrupadora o template,
           * para ordenar el detalle; (2) las cuentas de MA y PAM: lo que pagaron POR MSA («CTA MSA») entra a su cuenta, y la otra punta de cada
           * transferencia se marca (sin listarla). Si algo falla, el papel sale como antes y avisa.
           */
          let movsConSocios = [...(movsCC as unknown as MovimientoParaCC[]).map(m => ({ ...m, cuenta: "MSA Galicia cta cte" })), ...porLaTarjeta]
          let delSocio: MovimientoParaCC[] = []
          try {
            const idsTpl = [...new Set((movsCC as Array<{ template_cuota_id?: string | null }>).map(m => m.template_cuota_id).filter(Boolean))] as string[]
            const grupoDe = new Map<string, string>()
            for (let i = 0; i < idsTpl.length; i += 100) {
              const lote = idsTpl.slice(i, i + 100)
              const { data } = await supabase.from("cuotas_egresos_sin_factura")
                .select("id, grupo_pago_id, egreso:egresos_sin_factura(nombre_referencia, cuenta_agrupadora)")
                .or(`id.in.(${lote.join(",")}),grupo_pago_id.in.(${lote.join(",")})`)
              for (const c of (data ?? []) as Array<{ id: string; grupo_pago_id: string | null; egreso: { nombre_referencia?: string | null; cuenta_agrupadora?: string | null } | null }>) {
                const g = String(c.egreso?.cuenta_agrupadora || c.egreso?.nombre_referencia || "").trim()
                if (!g) continue
                grupoDe.set(c.id, g); if (c.grupo_pago_id && !grupoDe.has(c.grupo_pago_id)) grupoDe.set(c.grupo_pago_id, g)
              }
            }
            movsConSocios = movsConSocios.map(m => {
              const tc = (m as { template_cuota_id?: string | null }).template_cuota_id
              return m.grupo ? m : { ...m, grupo: (tc && grupoDe.get(tc)) || (/^Factura|^FC/i.test(String(m.comprobantes_pagados ?? "")) ? "Facturas" : "Transferencias y otros (sin template)") }
            })
            const CUENTAS_SOCIOS: Array<{ clave: string; nombre: string; schema: string; tabla: string; tarjeta?: boolean }> = [
              { clave: "MA", nombre: "MA caja de ahorro", schema: "ma", tabla: "ma_galicia" },
              { clave: "MA", nombre: "MA VISA", schema: "ma", tabla: "tarjeta_visa", tarjeta: true },
              { clave: "PAM", nombre: "PAM caja de ahorro", schema: "public", tabla: "pam_galicia" },
              { clave: "PAM", nombre: "PAM cta cte", schema: "public", tabla: "pam_galicia_cc" },
              { clave: "PAM", nombre: "PAM VISA", schema: "pam", tabla: "tarjeta_visa", tarjeta: true },
            ]
            const cuentasSocios: CuentaDelSocio[] = []
            for (const x of CUENTAS_SOCIOS) {
              const base = () => (x.schema === "public" ? supabase.from(x.tabla) : supabase.schema(x.schema).from(x.tabla))
              const leido = await traerTodo((d, h) => {
                let q = base().select("id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados, estado, categ", { count: "exact" })
                  .gte("fecha", `${meses[0]}-01`).lte("fecha", finEj)
                if (x.tarjeta) q = q.eq("tipo_fila", "movimiento")
                return q.order("id").range(d, h)
              })
              anotar(`Cuentas de los socios: ${x.nombre}`, leido)
              if (leido.error) throw new Error(leido.error.message)
              cuentasSocios.push({ clave: x.clave, nombre: x.nombre,
                movimientos: ((leido.data ?? []) as Array<Record<string, unknown>>).map(r => ({ ...(r as unknown as MovimientoParaCC), grupo: String(r.categ ?? "") || undefined })) })
            }
            const conSocios = movimientosDeLosSocios(movsConSocios, cuentasSocios)
            movsConSocios = conSocios.msa
            delSocio = conSocios.delSocio
          } catch (e) {
            toast.warning(`14.1: no se pudieron leer las cuentas de los socios (${(e as Error).message}); lo que pagaron por MSA desde sus cuentas no entra.`)
          }
          let armadoCC = armarCuentasCorrientes(comprasCC, ventasCC, [...movsConSocios, ...delSocio])

          // 🛡️ A-FEAT-1385 — la cuenta corriente con la aseguradora al cierre (las pólizas son de MSA).
          if (empresa.id === "MSA") {
            try {
              const [pol, mov, primero] = await Promise.all([
                supabase.from("polizas_seguro").select("poliza,seccion,poliza_anterior,vigencia_desde,polizas_endosos(endoso,consolidado,polizas_cuotas(vencimiento,importe))"),
                supabase.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2")
                  .or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*")
                  .lte("fecha", finEj).order("fecha"),
                supabase.from("msa_galicia").select("fecha").order("fecha", { ascending: true }).limit(1),
              ])
              if (!pol.error && !mov.error && (pol.data ?? []).length) {
                const polizas = (pol.data ?? []) as any[]
                const endosos = polizas.flatMap(p => (p.polizas_endosos ?? []).map((e: any) => ({
                  poliza: p.poliza, endoso: e.endoso,
                  cuotas: (e.polizas_cuotas ?? []).map((c: any) => ({ vencimiento: c.vencimiento, importe: Number(c.importe) })),
                  consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map((c: any) => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null,
                })))
                const movs = (mov.data ?? []).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: Number(x.debitos) || 0, creditos: Number(x.creditos) || 0, estado: x.estado }))
                const seg = aseguradoraAlCierre("Federación Patronal Seguros", polizas, endosos, movs, primero.data?.[0]?.fecha ?? `${meses[0]}-01`, finEj)
                // 🚗 A-FEAT-1422 nota 9: el desglose de la flota por vehículo (lecturas de sus pólizas + responsables).
                try {
                  const [flota, resp] = await Promise.all([
                    supabase.from("polizas_seguro").select("poliza,polizas_endosos(lectura)").eq("seccion", "AUTOMOTORES"),
                    supabase.from("polizas_responsables").select("clave,tipo,responsable_contable,responsable_interno,motivo"),
                  ])
                  if (!flota.error && !resp.error && seg.cuotas) {
                    const lecturas = new Map(((flota.data ?? []) as any[]).map(p => [String(p.poliza),
                      (p.polizas_endosos ?? []).map((e: any) => e.lectura).filter(Boolean)]))
                    const reglas = ((resp.data ?? []) as any[]).map(r => ({
                      ...(r.tipo === "vehiculo" ? { patente: r.clave } : { dni: r.clave }),
                      contable: r.responsable_contable, interno: r.responsable_interno, motivo: r.motivo ?? "",
                    }))
                    seg.repartoFlota = repartoDeLaFlota(seg.cuotas, movs, lecturas, reglas, `${meses[0]}-01`, finEj)
                  }
                } catch { /* sin desglose de la flota: el 14 sale igual */ }
                armadoCC.aseguradoras = [seg]
                if (seg.saldo !== 0) {
                  hallazgos.push(`Seguros: faltan comprobantes de Federación Patronal al cierre — saldo ${fmt(seg.saldo)} `
                    + `(${seg.aReclamar.length} cosa(s) a reclamar). Está en la solapa 14 del Excel.`)
                }
              }
            } catch { /* la cuenta corriente de seguros no frena el libro */ }
          }
          /**
           * 💳 A-FEAT-1388 — «Desglosar»: los pagos de la Visa Business de MSA abiertos con los consumos
           * del resumen que vence ese día, cada uno con su marca. Sólo lee. Si falla, «Desglosar» queda
           * entero en «sin tratar», como antes, y se avisa.
           */
          try {
            armadoCC = abrirDesglosar(armadoCC, (movsCC ?? []) as unknown as MovimientoParaCC[], consumos)
            const sinAbrir = armadoCC.desgloseTarjeta?.sinAbrir ?? 0
            if (sinAbrir !== 0) {
              hallazgos.push(`«Desglosar»: ${fmt(sinAbrir)} de pagos de la tarjeta no se pudieron abrir con su resumen. Está en la solapa 14.`)
            }
          } catch {
            toast.warning("No se pudo abrir «Desglosar» con los consumos de la tarjeta: queda entero en «sin tratar».")
          }
          setCuentasCorrientes(armadoCC)

          // 🛑 Lo que falta encuadrar se ve: es plata marcada que todavía no es de nadie.
          if (armadoCC.totalSinTratar !== 0) {
            hallazgos.push(
              `Hay ${armadoCC.sinTratar.length} marca(s) del extracto sin encuadrar `
              + `(${fmt(armadoCC.totalSinTratar)}): están en la solapa 14, abajo.`)
          }
        } catch {
          toast.warning("No se pudieron armar las cuentas corrientes; el resto del libro salió igual.")
        }
      }

      // 🗂️ A-FEAT-1342: el tipo de cada cuota (egreso, ingreso, financiero…). Respaldo: el del plan.
      // A-FEAT-1388: y la agrupadora (totalizadora) y el número, para ordenar Templates por mes como el plan.
      const { data: planTipos } = await supabase.from("cuentas_contables")
        .select("categ, tipo, nro_cuenta, nombre_totalizadora")
      const plan = (planTipos ?? []) as Array<{ categ: string; tipo: string | null; nro_cuenta: string | null; nombre_totalizadora: string | null }>
      const tipoDeCateg = Object.fromEntries(plan.map(x => [x.categ, x.tipo])) as Record<string, TipoCuenta | null>
      /**
       * 🛡️ A-FEAT-1388: los templates vinculados a una póliza — sus cuotas ya son gasto por la factura
       * de la aseguradora. Si la lectura falla, salen como antes (dentro del gasto) y se avisa.
       */
      const { data: conPoliza, error: errPoliza } = await supabase.from("polizas_seguro")
        .select("template_id").not("template_id", "is", null)
      if (errPoliza) toast.warning("No se pudieron leer las pólizas: los seguros quedan dentro de Templates (pueden estar contados dos veces).")
      /**
       * 🏦 A-FEAT-1515: el banco de cada cuota (cuenta, comprobante y cuánto respalda), para que el libro H se lea como el
       * extracto y tenga su control contra el banco. Si la lectura falla entera, las cuotas salen sin banco y el control lo dice.
       */
      let cuotasLibro = ((cuotas.data ?? []) as unknown as Record<string, unknown>[]).map(f => desdeCuota(f, tipoDeCateg))
      let bancoSinLeer: string[] | undefined
      let extracto: ExtractoParaH | undefined
      try {
        const leido = await leerMovimientosDeCuotas(supabase as unknown as ClienteMinimo, cuotasLibro)
        cuotasLibro = vincularBanco(cuotasLibro, cuotasLibro, leido.movimientos)
        // 🔍 A-FEAT-1579: la factura vinculada a cada movimiento (contexto del H para auditar); si falla, salen sin ella
        cuotasLibro = await conFacturas(supabase as unknown as ClienteMinimo, cuotasLibro).catch(() => cuotasLibro)
        bancoSinLeer = leido.tablasQueFallaron
        if (leido.tablasQueFallaron.length) toast.warning(`No se pudo leer el banco de: ${leido.tablasQueFallaron.join(", ")}. El control contra el banco del libro H lo dice.`)
      } catch {
        toast.warning("No se pudo leer el banco de las cuotas: el libro H sale sin cuenta ni comprobante, y sin su control contra el banco.")
      }
      // 🔎 A-FEAT-1518: el extracto del ejercicio, para el control «desde el extracto» de cada solapa del libro H.
      try {
        const ex = await leerExtractoDelEjercicio(supabase as unknown as ClienteMinimo, primerDiaDelEjercicio(ej), ej.fechaCierre)
        extracto = { movimientos: ex.movimientos, destinos: indiceDeDestinos(cuotasLibro), tablasQueFallaron: ex.tablasQueFallaron }
      } catch {
        toast.warning("No se pudo leer el extracto del ejercicio: el libro H sale sin el control desde el extracto.")
      }
      setTemplates(armarTemplatesDelEjercicio(cuotasLibro, ej, {
        empresa: empresa.id,
        plan,
        templatesConPoliza: ((conPoliza ?? []) as Array<{ template_id: string | null }>).map(p => p.template_id!).filter(Boolean),
        bancoSinLeer,
        extracto,
      }))

      /**
       * 🔢 Control de cuotas de templates — usa las MISMAS cuotas y ventas ya leídas. Lo único que agrega
       * es leer las presentaciones de SICORE (sólo MSA tiene SICORE). Si esa lectura falla, SICORE sale
       * «a revisar» y el resto del control igual.
       */
      let sicore: PresentacionSicore[] | null = []
      if (empresa.id === "MSA") {
        const { data: ret, error: errRet } = await supabase.schema("msa").from("sicore_retenciones")
          .select("quincena, retencion, estado_quincena")
        sicore = errRet ? null : presentacionesSicoreDesde((ret ?? []) as Record<string, unknown>[])
        if (errRet) toast.warning("No se pudieron leer las presentaciones de SICORE: su control de cuotas sale «a revisar».")
      }
      // 🏦 A-FEAT-1470: las comisiones de cada cuenta, contadas en su extracto (MSA; las otras empresas siguen por cuotas).
      const campCtl = campaniaDelControl(empresa.id, anioCierre)
      const comisiones = empresa.id === "MSA"
        ? await leerComisionesPorCuenta(supabase, COMISIONES_MSA, CUENTAS_CONCILIABLES, `${campCtl.meses[0]}-01`, ultimoDiaDelMes(campCtl.meses[campCtl.meses.length - 1]))
        : null
      setControlCuotas(armarControlCuotas(empresa.id, anioCierre, {
        comisiones,
        cuotas: ((cuotas.data ?? []) as unknown as Record<string, unknown>[]).map(f => cuotaParaControlDesde(f)),
        subdiariosConVentas: subdiariosConVentasDesde((ventas.data ?? []) as Record<string, unknown>[]),
        presentacionesSicore: sicore,
        hoy: hoyArgentina(),
      }))

      if (armado.compras.length === 0 && armado.ventas.length === 0) {
        toast.warning(`No hay comprobantes en los 12 subdiarios del ejercicio ${ej.etiqueta}.`)
      }
      toast.success(hallazgos.length
        ? `✓ Libro armado · ${hallazgos.length} cosa(s) para revisar: están en el informe y en «🧭 Recorrer temas».`
        : "✓ Libro armado.", { description: hallazgos.length ? hallazgos.map(h => h.split(":")[0]).join(" · ") : undefined })
    } catch (e) {
      toast.error("No se pudo armar el libro: " + (e as Error).message)
    } finally {
      setLecturas(lect)
      setCargando(false)
    }
  }

  const c = libro?.controles

  /**
   * 📸 Lo que estos papeles le pasan a la foto del balance propio (A-FEAT-1190). Son los MISMOS
   * números que van al Excel: no se recalcula nada, sólo se reparte en los renglones.
   */
  const datosParaLaFoto = useMemo<DatosDeLosPapeles>(() => ({
    saldos: bancarios?.saldos,
    cuentasAPagar: cuentas?.pagar,
    cuentasACobrar: cuentas?.cobrar,
    cheques: valores?.cheques,
    anticipos: valores?.anticipos,
    hacienda: hacienda?.valuacion.filas,
    insumos: hacienda?.insumos.grupos,
    granosNetoFinal: hacienda?.campo.valuacionGranos.netoFinal ?? null,
    sementerasCosto: hacienda ? hacienda.campo.sementeras.costo : null,
    impuestoCheque: bancarios?.impuestoCheque
      ? { computable: bancarios.impuestoCheque.computable, total: bancarios.impuestoCheque.total.total, mesesSinExtracto: bancarios.impuestoCheque.mesesSinExtracto }
      : undefined,
  }), [bancarios, cuentas, valores, hacienda])
  // El IVA del ejercicio para arrastrar el saldo técnico — del libro diario, con signo por NC.
  const ivaDelLibro = useMemo(() => libro
    ? { creditoFiscal: ivaConSigno(libro.compras), debitoFiscal: ivaConSigno(libro.ventas) }
    : null, [libro])
  const fciMovimientos = useMemo(() => bancarios?.fci
    ? { suscripciones: bancarios.fci.total.suscripciones, rescates: bancarios.fci.total.rescates }
    : null, [bancarios])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Papeles de trabajo del balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TestsDelProceso proceso="reporte/papeles-balance" pantalla="reporte" />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Empresa</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={empresa.id}
              onChange={e => setEmpresa(EMPRESAS.find(x => x.id === e.target.value) ?? EMPRESAS[0])}
            >
              {EMPRESAS.map(e => (
                <option key={e.id} value={e.id}>
                  {e.id} — cierra el {e.mesCierre === 6 ? "30/06" : "31/12"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Año de cierre</label>
            {/* Texto, no `number`: es la convención de la app para todo input numérico. */}
            <input
              type="text"
              className="border rounded px-2 py-1 text-sm w-24"
              value={anioCierre}
              onChange={e => setAnioCierre(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
            />
          </div>
          {/* Ya armado, «Armar todo» pasa a segundo plano (con la hora) y el destacado es el paso siguiente: el recorrido. */}
          <Button onClick={armarTodo} disabled={cargando} variant={libro ? "outline" : "default"}
            title={libro ? "Vuelve a leer todo de la base (si cargaste algo nuevo) y abre la vista previa" : "Arma el libro, trae stock y precios y abre la vista previa"}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {libro ? "↻ Volver a armar" : "⚡ Armar todo"}
          </Button>
          {!libro && (
            <Button variant="outline" onClick={generar} disabled={cargando}>
              Armar sólo el libro
            </Button>
          )}
          {libro && armadoA && !cargando && <span className="text-xs text-green-700" data-test="balance-armado-a">✓ Armado a las {armadoA}</span>}
          {libro && (
            /* 👁️ A-FEAT-1427: el mismo libro que se baja, mostrado acá con sus alertas arriba. */
            <Button variant="outline" onClick={() => setVerPrevia(true)}>
              👁️ Vista previa
            </Button>
          )}
          {libro && (
            <Button onClick={() => setVerRecorrido(true)} title="Los temas a resolver del balance, uno por uno">
              🧭 Recorrer temas{sinResponder ? ` (${sinResponder})` : ""}
            </Button>
          )}
          {libro && (
            <Button variant="outline" disabled={!!cargandoConciliacion} onClick={async () => {
              await descargarLibroDiario(...await argsConRecorrido(libro))
            }}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {/* A-FEAT-1388: decía «sin el sector productivo» y confundía cuando los precios ya se
                  veían cargados — lo que falta es traer el stock, y eso es lo que se dice. */}
              Bajar el Excel{hacienda ? " completo" : " — sin hacienda ni insumos (falta «Traer stock y precios»)"}
            </Button>
          )}
          {libro && (
            <Button disabled={!!cargandoConciliacion} title="Los libros A a E en un .zip: A subdiarios · B deudas, créditos y cuentas corrientes · C templates y detalle bancario · D el resto · E stocks"
              onClick={async () => { await bajarSet(libro) }}>
              📚 Bajar el set A–H (.zip)
            </Button>
          )}
          {libro && (
            <Button variant={verPapeles ? "default" : "outline"} onClick={() => setVerPapeles(v => !v)}
              title="Cada papel del balance en su archivo: tildás los que querés y se bajan sueltos (A-FEAT-1624)">
              🗂️ Libros por partes{tildados.size ? ` (${tildados.size})` : ""}
            </Button>
          )}
          {/* 📗 El Libro Diario consensuado con el contador (compras, ventas, por cuenta y retenciones), solo. */}
          {libro && (
            <Button variant="outline" onClick={() =>
              // 💵 Las retenciones recibidas y los cobros de cada venta, para «Retenciones sufridas» y «Control cobros».
              leerCobrosYRetenciones(supabase, empresa.id, empresa.schema)
                .then(cyr => {
                  for (const a of cyr.avisos) toast.warning(a)
                  return descargarLibroDiarioConsensuado(libro, empresa.id, cyr)
                })
                // 🧭 A-BUG-1452: que haya ventas que no cierran es un hallazgo de los datos (está en la solapa «Control cobros»), no una falla.
                .then(r => toast.success(r.cobros?.noCierra
                  ? `✓ Libro Diario bajado · ${r.cobros.noCierra} venta(s) para revisar en «Control cobros» (total − retenciones ≠ cobrado).`
                  : "✓ Libro Diario bajado."))
                .catch(e => toast.error("No se pudo armar el Libro Diario: " + (e as Error).message))}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bajar Libro Diario
            </Button>
          )}
          {/* 🔍 Diferencias vs ARCA: se eligen los zips del libro IVA (uno por mes) y se cruzan contra este libro. Sólo LEE. */}
          {libro && (
            <label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bajar Diferencias vs ARCA
              <input type="file" accept=".zip" multiple className="hidden" onChange={e => {
                const archivos = Array.from(e.target.files ?? [])
                e.target.value = ""
                if (!archivos.length) return
                descargarDiferenciasVsArca(libro, empresa.id, archivos)
                  .then(r => {
                    // 🧭 A-BUG-1452: en ámbar sólo lo que no se pudo usar o lo que el control no hace cerrar; lo demás
                    // (qué secuencia se tomó, qué meses faltan) va en el cartel verde y en la solapa «Zips de ARCA».
                    const esFalla = (a: string) => /no se pudo|no se usa|queda en 0|no cierra|no coincide/i.test(a)
                    for (const a of r.avisos.filter(esFalla)) toast.warning(a, { duration: 15000 })
                    const info = r.avisos.filter(a => !esFalla(a))
                    toast.success(`✓ Diferencias vs ARCA: ${r.zips.usados} zip(s) usados · compras ${r.compras.filas} diferencia(s) · ventas ${r.ventas.filas} fila(s). Detalle de los zips en la solapa «Zips de ARCA».`,
                      { description: info.length ? info.join(" · ") : undefined, duration: info.length ? 12000 : undefined })
                  })
                  .catch(err => toast.error("No se pudo armar «Diferencias vs ARCA»: " + (err as Error).message))
              }} />
            </label>
          )}
        </div>

        {/* 🗂️ A-FEAT-1624 etapa 2 — los papeles del balance como unidades: se tildan y se bajan sueltos. */}
        {verPapeles && libro && (
          <div className="rounded-md border p-3 space-y-3" data-test="papeles-sueltos">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">🗂️ Libros del balance</strong>
              <span className="text-xs text-muted-foreground">Cada libro se baja entero o por sus partes, del mismo cálculo que el set. Uno solo baja el .xlsx; varios, un .zip. El set A–H de siempre sigue arriba.</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => setTildados(new Set(librosConSubs().map(x => x.libro).filter(sePuedeBajar).map(p => p.id)))}>Todos los libros enteros</Button>
                <Button size="sm" variant="ghost" onClick={() => setTildados(new Set())}>Ninguno</Button>
                {!resultadoPapeles && (
                  <Button size="sm" variant="outline" disabled={bajandoPapeles || !!cargandoConciliacion} onClick={() => void bajarPapeles(libro, true)}
                    title="Arma el set sin bajar nada, para listar los grupos de Templates (uno por agrupadora y responsable)">
                    🔄 Traer los grupos de Templates
                  </Button>
                )}
                <Button size="sm" disabled={bajandoPapeles || !tildados.size || !!cargandoConciliacion} onClick={() => void bajarPapeles(libro)}>
                  {bajandoPapeles ? "Armando…" : `⬇️ Bajar ${tildados.size || ""} tildado(s)`}
                </Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {librosConSubs(resultadoPapeles?.cobertura.solapas ?? []).flatMap(({ libro: l, subs }) => [l, ...subs].map(p => {
                  const bajable = sePuedeBajar(p)
                  const n = resultadoPapeles?.cobertura.porPapel[p.id]?.length
                  const esLibro = p.nivel === "libro"
                  return (
                    <tr key={p.id} className={`${esLibro ? "border-t-2" : "border-t"} ${bajable ? "" : "text-muted-foreground"}`}>
                      <td className={`w-6 py-1 ${esLibro ? "" : "pl-5"}`}>
                        <input type="checkbox" disabled={!bajable} checked={tildados.has(p.id)} aria-label={`${esLibro ? "Libro entero" : "Sub"}: ${p.nombre}`}
                          onChange={() => setTildados(s => { const x = new Set(s); if (x.has(p.id)) x.delete(p.id); else x.add(p.id); return x })} />
                      </td>
                      <td className={`py-1 pr-2 ${esLibro ? "font-semibold" : "pl-5"}`}>{esLibro ? `${p.nombre} — entero` : `↳ ${p.nombre}`}</td>
                      <td className="py-1 pr-2 text-xs whitespace-nowrap">
                        {p.origen === "sistema" ? "✓ la app" : p.origen === "sistema-distinto" ? "≈ la app (lo enviado salió aparte)" : "falta definir"}
                        {n != null && bajable ? ` · ${n} solapa(s)` : ""}
                      </td>
                      <td className="py-1 text-xs text-muted-foreground">{p.nota ?? ""}</td>
                    </tr>
                  )
                }).concat(l.id === "templates" && !resultadoPapeles ? [
                  <tr key="templates-grupos" className="border-t"><td /><td colSpan={3} className="py-1 pl-5 text-xs text-muted-foreground">↳ Los grupos (CZ Ganadera, Imp Rurales, Gastos Bancarios, Inversiones…) aparecen acá con «🔄 Traer los grupos de Templates». Cada template suelto dentro del grupo: próximo.</td></tr>,
                ] : []))}
              </tbody>
            </table>
            {/* 🧮 El control: dónde cayó cada solapa del set completo en el último armado. Nada se descarta en silencio. */}
            {resultadoPapeles && (
              <div className="text-xs space-y-1" data-test="papeles-control">
                {resultadoPapeles.archivos.map(a => (
                  <div key={a.papel}>✓ {a.papel}: {a.solapas} solapa(s){a.formulasAValor ? ` · ${a.formulasAValor} fórmula(s) a valor (apuntaban afuera del archivo)` : " · fórmulas vivas"}</div>
                ))}
                {resultadoPapeles.cobertura.vacios.length > 0 && (
                  <div className="text-amber-700">⚠️ Sin solapas en este armado: {resultadoPapeles.cobertura.vacios.map(id => papelPorId(id, resultadoPapeles.cobertura.solapas)?.nombre ?? id).join(" · ")}</div>
                )}
                {/* 🛑 integridad: un sub con solapas que su libro entero no lleva es un error del catálogo, no del dato */}
                {resultadoPapeles.cobertura.subFueraDelLibro.length > 0 && (
                  <div className="text-red-700 font-semibold">🛑 Error de la app: partes con solapas que su libro entero no lleva — {resultadoPapeles.cobertura.subFueraDelLibro.join(" · ")}</div>
                )}
                {resultadoPapeles.cobertura.sinPapel.length > 0
                  ? <div className="text-amber-700">⚠️ {resultadoPapeles.cobertura.sinPapel.length} solapa(s) del set no van a ningún libro nuevo (siguen sólo en el set A–H): {resultadoPapeles.cobertura.sinPapel.join(" · ")}</div>
                  : <div className="text-green-700">✓ Todas las solapas del set caen en algún libro.</div>}
              </div>
            )}
          </div>
        )}

        {/* 👁️ A-FEAT-1427 — el Excel antes de bajarlo; las preguntas siguen acá abajo, donde se contestan. */}
        {previa?.error && <div className="text-sm text-red-700">No se pudo armar la vista previa: {previa.error}</div>}
        {previa?.wb && <VistaPreviaBalance wb={previa.wb} faltan={faltanEnPrevia} onCerrar={() => setVerPrevia(false)} />}
        {/* 📌 A-FEAT-1258 — a la vista mientras se trabaja; salen en el export. */}
        <PendientesBalance empresa={empresa.id} anioCierre={anioCierre} onCambio={setPendientes} version={versionPendientes} />
        {verRecorrido && libro && (
          <RecorridoBalance empresa={empresa.id} anioCierre={anioCierre} etiqueta={libro.ejercicio.etiqueta} claveInicial={claveRecorrido}
            temas={temasRecorrido} onCerrar={() => setVerRecorrido(false)}
            // ⏳ Lo que todavía se está trayendo: mientras haya algo, la lista puede crecer y reordenarse (JMS 31/10: «va cambiando solo… no sé si está listo para empezar»).
            enCamino={[...(!ddjjGuardadas ? ["lo presentado a ARCA"] : []), ...(cargandoConciliacion || !conciliacion ? ["la conciliación"] : []), ...(!hacienda && pedidoStock > 0 ? ["stock y precios"] : [])]}
            conciliacion={{ cargando: cargandoConciliacion, historicos: conciliacion?.historicos ?? 0, avisos: conciliacion?.avisos ?? [],
              calculado: conciliacion?.calculado ?? null, porCuenta: conciliacion?.porCuenta, recalcular: () => void calcularConciliacion() }}
            onPendientes={l => { setPendientes(l); setVersionPendientes(v => v + 1) }} />
        )}
        {/* ✍️ A-FEAT-1207 — lo que el balance anterior dejó para tomar en éste. */}
        <SaldosEjercicioAnterior empresa={empresa.id} anioCierre={anioCierre} onCambio={setAjustes} />
        {/* ✍️ A-FEAT-1331 — facturas de fecha posterior al cierre que son de este ejercicio. */}
        <ProvisionManual empresa={empresa.id} schema={empresa.schema} anioCierre={anioCierre}
          fechaCierre={armarEjercicio(anioCierre, empresa.mesCierre).fechaCierre}
          etiqueta={armarEjercicio(anioCierre, empresa.mesCierre).etiqueta}
          onCambio={() => { if (libro) generar() }} />

        {libro && asientosContables && (
          <p className="text-xs text-muted-foreground">
            📒 <strong>Asientos Contables</strong> (no informadas en ARCA, fuera del subdiario):{" "}
            {asientosContables.length === 0
              ? "ninguna en este ejercicio."
              : <>{asientosContables.length} factura(s) por $ {asientosContables.reduce((s, a) => s + a.total, 0)
                  .toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — van en su solapa del Excel.</>}
          </p>
        )}

        <p className="text-xs text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          El período se corta por <strong className="mx-1">el subdiario en el que entró</strong> cada
          comprobante, no por la fecha de la factura. Esta pantalla no modifica nada del sistema: sólo
          guarda lo que escribís en sus casillas (precios, saldos de inicio) para este balance.
        </p>

        {/* 🧮 A-FEAT-1343: ¿llegó todo de la base? Si no, nada de lo de abajo es confiable. */}
        {libro && lecturas && lecturas.length > 0 && (() => {
          const mal = lecturas.filter(lecturaIncompleta)
          return mal.length === 0 ? (
            <p className="text-xs text-emerald-700">✓ Llegó todo de la base: {lecturas.length} consultas, {lecturas.reduce((x, l) => x + l.llegaron, 0).toLocaleString("es-AR")} filas.</p>
          ) : (
            <div className="text-sm text-red-800 bg-red-50 border-2 border-red-300 rounded px-3 py-2">
              <div className="font-semibold">🛑 Faltan datos: {mal.length} consulta(s) llegaron incompletas — no entregues este Excel</div>
              <ul className="list-disc pl-5 text-xs">{mal.map(l => <li key={l.nombre}>{l.nombre}: la base tiene {l.esperadas} y llegaron {l.llegaron}</li>)}</ul>
            </div>
          )
        })()}

        {libro && c && (
          <div className="space-y-3 border-t pt-3">
            <div className="text-sm">
              Ejercicio <strong>{libro.ejercicio.etiqueta}</strong> · cierre {libro.ejercicio.fechaCierre} ·
              subdiarios de {nombreSubdiario(libro.ejercicio.subdiarios[0])} a{" "}
              {nombreSubdiario(libro.ejercicio.subdiarios[11])}
            </div>

            {/* 🧮 El control, proporcional: un ✓ discreto si cierra, una alerta grande si no. */}
            {c.sePuedeEntregar ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                <CheckCircle2 className="h-4 w-4" />
                El libro cierra: se puede entregar.
              </div>
            ) : (
              <div className="text-sm text-red-800 bg-red-50 border-2 border-red-300 rounded px-3 py-2 space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Todavía no se puede entregar
                </div>
                <ul className="list-disc pl-5">
                  {c.motivos.map((m, i) => <li key={i}>{m}</li>)}
                </ul>

                {/* 🔑 Saber que un mes está duplicado no alcanza para decidir: hay que saber si una
                    fuente CONTIENE a la otra. Eso se dice acá, sin tener que abrir el Excel. */}
                {c.subdiariosDuplicados.map(d => (
                  <div key={d.subdiario} className="text-xs bg-white/60 border border-red-200 rounded p-2 mt-1">
                    <div className="font-semibold">{d.subdiario}</div>
                    <div>
                      {d.porFuente.map(p =>
                        `${p.fuente === "historico" ? "sistema anterior" : p.fuente === "arca" ? "ARCA" : p.fuente}: ${p.comprobantes} por $${fmt(p.total)}`,
                      ).join(" · ")}
                    </div>
                    <div className="mt-1">
                      {d.enComun} está(n) en las dos.{" "}
                      {d.soloEn.length === 0
                        ? "Son idénticas: quedate con una."
                        : d.soloEn.length === 1
                          ? `Sólo «${d.soloEn[0].fuente === "historico" ? "sistema anterior" : "ARCA"}» tiene ${d.soloEn[0].asientos.length} que la otra no, así que la contiene: quedate con ésa.`
                          : "Cada una tiene lo suyo: hay que fusionarlas, no elegir."}
                    </div>
                    {d.soloEn.map(u => (
                      <ul key={u.fuente} className="list-disc pl-5 mt-1">
                        {u.asientos.map((a, i) => (
                          <li key={i}>{a.fecha} · {a.denominacion} · ${fmt(a.total)}</li>
                        ))}
                      </ul>
                    ))}
                  </div>
                ))}

                <p className="text-xs">
                  El Excel se baja igual, para poder ver dónde está el problema.
                </p>
              </div>
            )}

            {/* 🧾 Segundo camino: cada subdiario de compras contra lo presentado a ARCA (A-DAT-61). */}
            {c.contraPresentado ? (
              <details className="text-xs border rounded p-2" open={c.contraPresentado.some(f => !f.ok)}>
                <summary className="cursor-pointer text-sm">
                  {c.contraPresentado.every(f => f.ok)
                    ? <span className="text-emerald-700">✓ Las compras de los 12 subdiarios coinciden con lo presentado a ARCA</span>
                    : <span className="text-red-700 font-semibold">⚠️ {c.contraPresentado.filter(f => !f.ok).length} subdiario(s) de compras no coinciden con lo presentado a ARCA</span>}
                </summary>
                <table className="mt-2 w-full font-mono">
                  <thead><tr className="text-muted-foreground">
                    <th className="text-left">Subdiario</th><th className="text-right">App</th><th className="text-right">Presentado</th><th className="text-right">Diferencia</th>
                  </tr></thead>
                  <tbody>
                    {c.contraPresentado.map(f => (
                      <tr key={f.subdiario} className={f.ok ? "" : "text-red-700 font-semibold"}>
                        <td>{f.subdiario}</td>
                        <td className="text-right">{f.app.comprobantes} · ${fmt(f.app.total)}</td>
                        <td className="text-right">{f.presentado ? `${f.presentado.comprobantes} · $${fmt(f.presentado.total)}` : "sin dato"}</td>
                        <td className="text-right">{f.ok ? "✓" : `${f.diferenciaComprobantes > 0 ? "+" : ""}${f.diferenciaComprobantes} · $${fmt(f.diferenciaTotal)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : (
              <div className="text-xs text-muted-foreground">No hay dato de lo presentado a ARCA para esta empresa: las compras no se controlan contra la DDJJ.</div>
            )}
            {/* 🔢 Proveedores fijos: ¿están todas sus facturas? Avisa, no frena (A-FEAT-1332). */}
            {c.facturasFijas && c.facturasFijas.length > 0 && (() => {
              const filas = c.facturasFijas.filter(f => f.hay + f.conFechaAnterior + f.repetidas > 0 || f.esperado > 0)
              const mal = filas.filter(f => !f.ok)
              const meses = filas[0]?.mesesContados ?? 0
              return (
                <details className="text-xs border rounded p-2" open={mal.length > 0}>
                  <summary className="cursor-pointer text-sm">
                    {mal.length === 0
                      ? <span className="text-emerald-700">✓ Proveedores fijos: están todas las facturas ({filas.length} proveedores, {meses} meses)</span>
                      : <span className="text-amber-800 font-semibold">⚠️ Proveedores fijos: {mal.length} de {filas.length} no tienen la cantidad esperada ({meses} meses contados)</span>}
                  </summary>
                  <p className="mt-1 text-muted-foreground">
                    Cuenta lo que es gasto del ejercicio (subdiarios + provisión), por la fecha de la factura y sólo los meses ya terminados.
                    Cuántas trae cada uno se edita en la ficha del proveedor. Es un aviso: no frena el libro.
                  </p>
                  <table className="mt-1 w-full">
                    <tbody>
                      {[...mal.sort((a, b) => Number(b.aMano) - Number(a.aMano)), ...filas.filter(f => f.ok)].map(f => (
                        <tr key={f.cuit} className={f.ok ? "" : f.aMano ? "text-red-700 font-semibold" : "text-amber-800"}>
                          <td className="pr-2">{f.ok ? "✓" : "⚠️"} {f.nombre}{f.aMano ? " · a mano" : ""}</td>
                          <td className="pr-2 font-mono">{f.facturasPorMes}/mes</td>
                          <td>{explicarFila(f)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )
            })()}
            {/* 🔢 Cuotas de templates: ¿están todas las de la campaña? Avisa, no frena (JMS 28/10/2026). */}
            {controlCuotas && controlCuotas.filas.length > 0 && (() => {
              const filas = controlCuotas.filas
              const mal = filas.filter(conProblema)
              const malPreview = mal.filter(f => f.preview)
              const resumen = resumenControlCuotas(filas).map(r => `${r.cantidad} ${r.estado}`).join(" · ")
              const color = (e: string) => e === "ok" ? "" : e === "falta" || e === "mixto" ? "text-red-700"
                : e === "sobra" ? "text-amber-800" : "text-muted-foreground"
              return (
                <details className="text-xs border rounded p-2" open={malPreview.length > 0}>
                  <summary className="cursor-pointer text-sm">
                    {mal.length === 0
                      ? <span className="text-emerald-700">✓ Cuotas de templates: están todas ({filas.length} templates controlados · {controlCuotas.campania})</span>
                      : <span className="text-amber-800 font-semibold">⚠️ Cuotas de templates: {mal.length} de {filas.length} no tienen las cuotas esperadas{malPreview.length > 0 ? ` (${malPreview.length} de preview importante)` : ""} · {controlCuotas.campania}</span>}
                  </summary>
                  <p className="mt-1 text-muted-foreground">
                    {empresa.id} se controla en su {controlCuotas.campania}. Un template compartido («PAM/MA/Duhau») va en la primera empresa nombrada.
                    Anual o en cuotas: vale cualquiera de las dos, no las dos el mismo año. IIBB: un pago el mes siguiente a cada subdiario con ventas.
                    SICORE: un pago por presentación. ★ = preview importante. Es un aviso: no frena el libro. {resumen}.
                  </p>
                  <table className="mt-1 w-full">
                    <tbody>
                      {filas.map(f => (
                        <tr key={`${f.agrupadora}|${f.nombre}`} className={`${color(f.estado)} ${f.preview && conProblema(f) ? "font-semibold" : ""}`}>
                          <td className="pr-2 whitespace-nowrap">{f.estado === "ok" ? "✓" : conProblema(f) ? "⚠️" : "·"} {f.preview ? "★ " : ""}{f.nombre}</td>
                          <td className="pr-2 whitespace-nowrap">{f.estado}</td>
                          <td className="pr-2 text-muted-foreground">{f.regla}</td>
                          <td>{f.detalle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )
            })()}
            {libro.historicoSuperado.length > 0 && (
              <div className="text-xs text-muted-foreground">
                🗄️ {libro.historicoSuperado.length} comprobante(s) del sistema anterior con subdiario posterior a {ULTIMO_SUBDIARIO_HISTORICO} no se cuentan:
                para esos meses manda la app. Siguen guardados en el histórico, no se borró nada.
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Compras del ejercicio</div>
                <div className="font-mono">{c.compras.cantidad} · ${fmt(c.compras.totalGeneral)}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-muted-foreground">Ventas del ejercicio</div>
                <div className="font-mono">{c.ventas.cantidad} · ${fmt(c.ventas.totalGeneral)}</div>
              </div>
              {templates && (
                <div className="border rounded p-2 sm:col-span-2 bg-slate-50">
                  <div className="text-xs text-muted-foreground">
                    Templates — van <strong>aparte</strong>, no entran por subdiario
                  </div>
                  <div className="font-mono">
                    {templates.detalle.length} cuota(s) · ${fmt(templates.totalDebitos)}
                    {templates.totalCreditos > 0 && <> · créditos ${fmt(templates.totalCreditos)}</>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Se cortan por <strong>fecha de pago</strong> (o estimada), porque no tienen subdiario.
                    {templates.sinCategoria.length > 0 && (
                      <span className="text-amber-700"> · {templates.sinCategoria.length} sin categoría contable</span>
                    )}
                    {templates.sinFecha.length > 0 && (
                      <span className="text-amber-700"> · {templates.sinFecha.length} sin fecha</span>
                    )}
                    {/* A-BUG-1289: lo que se saca del gasto y lo que además es deuda, a la vista */}
                    {templates.noIncluidas.length > 0 && (
                      <span> · {templates.noIncluidas.length} desactivada(s) NO incluidas (${fmt(templates.totalNoIncluidas)})</span>
                    )}
                    {/* 🛡️ A-FEAT-1388: los seguros con póliza ya son gasto por la factura de la aseguradora. */}
                    {templates.enFacturas.length > 0 && (
                      <span> · {templates.enFacturas.length} de seguros con póliza fuera (${fmt(templates.totalEnFacturas)}): ya están en sus facturas y en la cuenta corriente</span>
                    )}
                    {saldosDelEjercicioAnterior(ajustes, empresa.id, anioCierre).total > 0 && (
                      <span> · más <strong>${fmt(saldosDelEjercicioAnterior(ajustes, empresa.id, anioCierre).total)}</strong> de saldos del ejercicio anterior</span>
                    )}
                    {templates.impagasAlCierre.length > 0 && (
                      <span> · {templates.impagasAlCierre.length} impaga(s) al cierre (${fmt(templates.totalImpagas)}), también en cuentas a pagar</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Provisión (del ejercicio, entraron después): <strong>{libro.provisiones.length}</strong></div>
              {controlesInicio?.provision && (() => {
                const p = controlesInicio.provision
                if (p.estado === "cierra") return <div className="text-green-700">✓ Provisión del ejercicio anterior: cierra con el balance anterior (${fmt(p.reconocido)})</div>
                if (p.estado === "sin foto") return <div className="text-amber-700">Provisión del ejercicio anterior: no se puede controlar — {p.fuenteDeclarado}</div>
                return (
                  <div className="text-red-800 bg-red-50 border border-red-300 rounded px-2 py-1" data-test="control-provision-anterior">
                    ⚠️ <strong>Provisión del ejercicio anterior no cierra:</strong> el balance anterior provisionó ${fmt(p.declarado ?? 0)} y la app reconoce ${fmt(p.reconocido)} (diferencia ${fmt(p.diferencia ?? 0)}).
                    {p.candidatos.length > 0
                      ? <> ¿Son éstas? {p.candidatos.map(a => `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""} (${a.fecha ? a.fecha.split("-").reverse().join("/") : ""}) $${fmt(a.total)}`).join(" · ")} — están en las compras de este ejercicio: si son las provisionadas, su gasto se cuenta dos veces.</>
                      : <> No se encontró en las compras de este ejercicio un comprobante (ni dos) que lo explique.</>}
                  </div>
                )
              })()}
              <div>
                Sin subdiario: <strong>{libro.sinSubdiario.length}</strong>
                {libro.sinSubdiario.length > 0 && (c.sinSubdiarioQueAfectan.length === 0
                  ? <span> — todos posteriores al cierre, no tocan este balance</span>
                  : <span className="text-amber-700"> — <strong>{c.sinSubdiarioQueAfectan.length}</strong> con fecha del ejercicio: ésos sí hay que imputar</span>)}
              </div>
              {c.vacios.length > 0 && (
                <div className="text-amber-700">
                  Subdiarios sin ningún comprobante: {c.vacios.map(nombreSubdiario).join(", ")}
                </div>
              )}
            </div>

            {/* ✍️ A-FEAT-1388 — papel 14: el saldo de INICIO de cada cuenta corriente, editable antes de
                bajar el Excel. Usuario 27/10: «poner saldo de inicio cero y que dé lo que dé, pero luego
                podremos modificar desde antes de exportar». */}
            {cuentasCorrientesConInicio && (
              <div className="rounded border p-3 text-xs space-y-2">
                <div className="font-semibold text-sm">🧾 Papel 14 — saldo de INICIO de cada cuenta corriente</div>
                <p className="text-muted-foreground">
                  Vacío = 0, marcado «sin dato»: el saldo al cierre sale igual. Positivo = le debíamos;
                  negativo = teníamos a cobrar. <span className="italic">{textoEstadoGuardado(saldosCC.estado, saldosCC.error)}</span>
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b text-gray-600">
                      <th className="text-left">Contraparte</th>
                      <th className="text-right">Saldo al inicio</th>
                      <th className="text-right">Movimiento del ejercicio</th>
                      <th className="text-right">Saldo al cierre</th>
                    </tr></thead>
                    <tbody>
                      {cuentasCorrientesConInicio.cuentas.map(c => (
                        <tr key={c.contraparte.clave}>
                          <td>{c.contraparte.nombre}</td>
                          <td className="text-right">
                            {/* § 💰 texto, no `number`: se lee con coma decimal y punto de miles. */}
                            <input type="text" placeholder="0,00 (sin dato)"
                              className="border rounded px-1 py-0.5 w-32 text-right"
                              value={saldosCC.valores[c.contraparte.clave] ?? ""}
                              onChange={e => saldosCC.cambiar(c.contraparte.clave, e.target.value)} />
                            <div><MarcaTentativo fuente={saldosCC.tentativos[c.contraparte.clave]} onOk={() => saldosCC.confirmar(c.contraparte.clave)} /></div>
                          </td>
                          <td className="text-right font-mono">{fmt(c.resumen.saldo)}</td>
                          <td className={`text-right font-mono ${c.inicioSinDato ? "text-amber-700" : ""}`}>
                            {fmt(c.saldoAlCierre)}{c.inicioSinDato && " · sin dato de inicio"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 💳 A-FEAT-1388 — «Desglosar» abierto con los consumos de la tarjeta, con su control. */}
                {cuentasCorrientesConInicio.desgloseTarjeta && (() => {
                  const dt = cuentasCorrientesConInicio.desgloseTarjeta
                  const abierto = dt.porDestino.reduce((s, d) => s + d.importe, 0)
                  const cuadra = Math.abs(dt.total - abierto - dt.sinAbrir) < 0.01 && dt.sinAbrir === 0
                  return (
                    <div className={cuadra ? "text-emerald-700" : "text-amber-800"}>
                      {cuadra ? "✓ " : "⚠️ "}«Desglosar» (pagos de la tarjeta, ${fmt(dt.total)}) abierto con sus consumos:{" "}
                      {dt.porDestino.map(d => `${d.poliza ? "🛡️ pólizas " : ""}${d.destino} $${fmt(d.importe)}`).join(" · ")}
                      {dt.sinAbrir !== 0 && ` · sin abrir $${fmt(dt.sinAbrir)}`}
                    </div>
                  )
                })()}
              </div>
            )}

            {/**
              * ⚠️ **Lo que falta si no se trae el sector productivo.** El Excel arma sus solapas con
              * lo que haya en memoria: sin apretar «Traer stock y precios», salen 6 y no 12 —
              * **y antes no lo decía**, así que se podía entregar un papel incompleto creyendo que
              * estaba entero. Ahora el botón lo dice y este cartel también (§ 🧮).
              */}
            {!hacienda && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                El Excel te va a salir <strong>sin hacienda, insumos, granos ni sementeras</strong>.
                Para que los traiga, apretá primero «Traer stock y precios» acá abajo —{" "}
                <strong>aunque veas tus precios cargados</strong>: esos se guardan solos, pero el stock
                hay que traerlo cada vez.
              </p>
            )}

            {/* 🐄 Aparte del libro diario: trae precios de dos mercados y puede fallar sola sin
                impedir que se bajen las compras. */}
            <HaciendaAlCierre empresa={empresa.id} ejercicio={libro.ejercicio} onDatos={setHacienda} pedido={pedidoStock} />

            {bancarios?.impuestoCheque && (() => {
              const ic = bancarios.impuestoCheque
              // 🧮 A-FEAT-1388: el mismo impuesto por tres caminos (08.1, 08 y Templates) — a la vista.
              const ctl = controlarCheque(ic.total.total, chequeEnPapel08(bancarios.gastos),
                chequeEnTemplates(templates, empresa.id), empresa.id)
              return (
                <div className="rounded border p-3 text-xs space-y-2">
                  <div className="font-semibold text-sm">🧾 Impuesto al cheque (Ley 25.413) — total y desglosado</div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b text-gray-600">
                        <th className="text-left">Mes</th>
                        <th className="text-right">{ETIQUETA_CONCEPTO.creditos}</th>
                        <th className="text-right">{ETIQUETA_CONCEPTO.debitos}</th>
                        <th className="text-right">{ETIQUETA_CONCEPTO.efectivo}</th>
                        <th className="text-right">Total</th>
                      </tr></thead>
                      <tbody>
                        {[...ic.porMes, ic.total].map(m => (
                          <tr key={m.mes} className={m.mes === "TOTAL" ? "font-semibold border-t" : ""}>
                            <td>{m.mes}{ic.mesesSinExtracto.includes(m.mes) && <span className="text-amber-700"> — sin extracto</span>}</td>
                            <td className="text-right">{fmt(m.creditos)}</td>
                            <td className="text-right">{fmt(m.debitos)}</td>
                            <td className="text-right">{fmt(m.efectivo)}</td>
                            <td className="text-right">{fmt(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    Computable como pago a cuenta de Ganancias (crédito al cierre):{" "}
                    <strong>${fmt(ic.computable)}</strong>{" "}
                    <span className="text-gray-500">({Math.round(ic.pctGeneral * 100)} % general · {Math.round(ic.pctEfectivo * 100)} % efectivo — se cambia en el Excel, solapa 08.1)</span>
                    {" · "}no computable (gasto): ${fmt(ic.total.total - ic.computable)}
                  </div>
                  {ic.mesesSinExtracto.length > 0 && (
                    <div className="text-amber-800">⚠️ {ic.mesesSinExtracto.length} mes(es) sin extracto en la app ({ic.mesesSinExtracto.join(", ")}): su impuesto no está en el total.</div>
                  )}
                  <div className={ctl.cuadra ? "text-emerald-700" : "text-red-700 font-semibold"}>
                    {ctl.cuadra ? "✓ " : "⚠️ "}El mismo impuesto por tres caminos:{" "}
                    {ctl.caminos.map(x => `${x.camino.split(" · ")[0]} ${x.importe == null ? "sin dato" : "$" + fmt(x.importe)}`).join(" · ")}
                    {!ctl.cuadra && " — no dan igual: la diferencia está en la solapa 08.1."}
                  </div>
                </div>
              )
            })()}

            {/* 📎 A-FEAT-1571 (JMS 06/11: «cuando vea saldos, apretar para ver el resumen ya vinculado»): cada saldo al cierre con su extracto */}
            {bancarios?.saldos && bancarios.saldos.length > 0 && (() => {
              const fc = libro.ejercicio.fechaCierre
              const filas = bancarios.saldos.map(s => {
                const usd = s.moneda === "USD"
                const cuenta = s.cuenta ?? s.nombre
                return { cuenta, usd, importe: usd ? s.usd : s.saldo,
                  r: respaldoDeSaldo(cuenta, fc, s.nroResumen, usd ? s.usd == null : s.saldo == null, bancarios.documentosRespaldo) }
              })
              // 💹 JMS 06/11: «no menciona FCI con su link» — el fondo común, al inicio y al cierre, con su resumen
              const t = bancarios.fciTenencia
              if (t) {
                const m = (a?: number | null, b?: number | null) => (a == null || b == null ? null : Math.round(a * b * 100) / 100)
                const ini = `${Number(fc.slice(0, 4)) - 1}${fc.slice(4)}`
                filas.push({ cuenta: "Fondo común — al inicio", usd: false, importe: m(t.cuotasInicio, t.valorInicio), r: respaldoDeFci(t.notaInicio, "inicio", ini, bancarios.documentosRespaldo) })
                filas.push({ cuenta: "Fondo común — al cierre", usd: false, importe: m(t.cuotasCierre, t.valorCierre), r: respaldoDeFci(t.notaCierre, "cierre", fc, bancarios.documentosRespaldo) })
              }
              const conLink = filas.filter(f => f.r.estado === "con_link").length
              return (
                <details className="text-xs border rounded p-2">
                  <summary className="cursor-pointer text-sm">
                    📎 Saldos al cierre y su extracto: {conLink} de {filas.length} con el documento vinculado
                  </summary>
                  <table className="mt-1 w-full">
                    <tbody>
                      {filas.map(f => (
                        <tr key={f.cuenta}>
                          <td className="pr-2 whitespace-nowrap">{f.cuenta}</td>
                          <td className="pr-2 text-right whitespace-nowrap">{f.importe == null ? "—" : `${f.usd ? "US$ " : "$ "}${fmt(f.importe)}`}</td>
                          <td>
                            {f.r.url
                              ? <a href={f.r.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">📎 {f.r.documento}</a>
                              : <span className={f.r.estado === "falta" ? "text-red-700" : "text-amber-800"}>{f.r.estado === "falta" ? "🔴" : "🟡"} {f.r.documento}{f.r.nota ? ` — ${f.r.nota}` : ""}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )
            })()}

            {/* 📦 A-FEAT-1571 paso 2 (JMS 06/11: «"descargar" = copiar esos docs y dejarlos guardados» · «un zip por cada set
                por banco, con carpetas dividiendo tarjeta, cuentas…»): sólo COPIA al Drive, nunca mueve ni borra. */}
            {(() => {
              const carpetas = carpetasDelRespaldo(empresa.id, anioCierre)
              if (!carpetas || !bancarios) return null
              const fc = libro.ejercicio.fechaCierre
              const renglones = renglonesDeRespaldo({
                fechaCierre: fc, fechaInicio: `${Number(fc.slice(0, 4)) - 1}${fc.slice(4)}`,
                saldos: bancarios.saldos, fci: bancarios.fciTenencia ?? null,
                provision: libro.provisiones.filter(a => a.fuente !== "venta"), provisionAnterior: libro.provisionesEjercicioAnterior,
                provisionCobros: libro.provisiones.filter(a => a.fuente === "venta"), documentos: bancarios.documentosRespaldo ?? [],
              })
              const items = itemsDelRespaldo(renglones, bancarios.documentosRespaldo ?? [])
              const llamar = async (cuerpo: object) => {
                const r = await fetch("/api/gas/respaldo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
                return r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
              }
              const copiar = async () => {
                setRespaldoEstado({ trabajando: true, lineas: [{ texto: `Copiando ${items.length} documento(s)…` }] })
                let falta: ItemDeRespaldo[] = items, copiados = 0, ya = 0
                const lineas: Array<{ texto: string; url?: string; error?: boolean }> = []
                for (let vuelta = 0; vuelta < 6 && falta.length; vuelta++) {
                  const j = await llamar({ accion: "copiar", destino_ruta: carpetas.destino, items: falta })
                  if (!j.ok) { lineas.push({ texto: `⚠️ ${j.error}`, error: true }); break }
                  copiados += j.copiados.length; ya += j.ya_estaban.length
                  // 🔗 guarda original → copia, para que el Excel apunte a la copia (la carpeta que se comparte con el contador)
                  const pares = [...(j.copiados ?? []), ...(j.ya_estaban ?? [])].filter((x: { origen_id?: string; file_id?: string }) => x.origen_id && x.file_id)
                  if (pares.length) {
                    const { error: eCop } = await supabase.from("balance_datos_usuario").upsert(
                      pares.map((x: { origen_id: string; file_id: string }) => ({ empresa: empresa.id, anio_cierre: anioCierre, papel: PAPEL_COPIAS,
                        clave: x.origen_id, texto: urlDeArchivoDrive(x.file_id), actualizado_por: `Copiar los respaldos · ${hoyArgentina()}` })),
                      { onConflict: "empresa,anio_cierre,papel,clave" })
                    if (eCop) lineas.push({ texto: `⚠️ No se pudo anotar qué copia corresponde a cada documento: ${eCop.message}`, error: true })
                    else setBancarios(b => b ? { ...b, copiasRespaldo: { ...(b.copiasRespaldo ?? {}), ...Object.fromEntries(pares.map((x: { origen_id: string; file_id: string }) => [x.origen_id, urlDeArchivoDrive(x.file_id)])) } } : b)
                  }
                  for (const e of j.errores ?? []) lineas.push({ texto: `⚠️ ${e.nombre}: ${e.error}`, error: true })
                  if (vuelta === 0 && j.destino_url) lineas.unshift({ texto: "Abrir la carpeta «- Respaldo»", url: j.destino_url })
                  falta = j.pendientes ?? []
                }
                lineas.push({ texto: `✓ ${copiados} copiado(s) · ${ya} ya estaban${falta.length ? ` · quedaron ${falta.length}: apretá de nuevo` : ""}` })
                setRespaldoEstado({ trabajando: false, lineas })
              }
              const zips = async () => {
                const lineas: Array<{ texto: string; url?: string; error?: boolean }> = []
                setRespaldoEstado({ trabajando: true, lineas: [{ texto: "Armando un zip por banco…" }] })
                for (const b of carpetas.bancos) {
                  const nombre = `${empresa.id} - ${b.banco} - extractos ${libro.ejercicio.etiqueta.replace("/", "-")} (${hoyArgentina()}).zip`
                  const j = await llamar({ accion: "zip", origen_ruta: b.ruta, destino_ruta: carpetas.destino, subcarpeta: "Extractos para el contador", nombre })
                  lineas.push(j.ok
                    ? { texto: `${j.ya_estaba ? "ya estaba" : "✓"} ${b.banco}: ${nombre}${j.archivos ? ` (${j.archivos} archivos, ${j.mb} MB)` : ""}`, url: j.url }
                    : { texto: `⚠️ ${b.banco}: ${j.error}`, error: true })
                }
                setRespaldoEstado({ trabajando: false, lineas })
              }
              /** 🔁 Paso 3: trae del espejo de Ulises a la carpeta segura lo que falte, y lo vincula (sólo copia). */
              const espejo = async () => {
                setRespaldoEstado({ trabajando: true, lineas: [{ texto: "Mirando el espejo de Ulises…" }] })
                const r = await fetch("/api/respaldo/espejo", { method: "POST" })
                const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }))
                const lineas: Array<{ texto: string; url?: string; error?: boolean }> = []
                if (!j.ok) lineas.push({ texto: `⚠️ ${j.error}`, error: true })
                else {
                  lineas.push({ texto: `✓ ${j.copiados} resumen(es) nuevos copiados a la carpeta segura · ${j.vinculados} vinculado(s)${j.pendientes ? ` · quedaron ${j.pendientes}: apretá de nuevo` : ""}` })
                  for (const e of j.errores ?? []) lineas.push({ texto: `⚠️ ${e}`, error: true })
                  if ((j.faltan ?? []).length) lineas.push({ texto: `🔔 Todavía no está el resumen de: ${j.faltan.join(" · ")}`, error: true })
                  if ((j.sin_regla ?? []).length) lineas.push({ texto: `ℹ️ No sé dónde va (el nombre no sigue la convención): ${j.sin_regla.slice(0, 8).join(", ")}${j.sin_regla.length > 8 ? "…" : ""}` })
                }
                setRespaldoEstado({ trabajando: false, lineas })
              }
              return (
                <div className="text-xs border rounded p-2 space-y-1">
                  <div className="text-sm">📦 Respaldo del balance en el Drive</div>
                  <div className="text-muted-foreground">
                    Copia a «BALANCES / BALANCE {anioCierre} / - Respaldo» los {items.length} documentos con link de «00 Respaldos» (una
                    carpeta por papel), y arma un zip por banco con todos sus extractos del ejercicio para el contador. Sólo copia: no
                    mueve ni borra nada, y lo que ya está no se vuelve a copiar.
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={respaldoEstado.trabajando || !items.length} onClick={copiar}>Copiar los respaldos</Button>
                    <Button size="sm" variant="outline" disabled={respaldoEstado.trabajando} onClick={zips}>Armar el zip de cada banco</Button>
                    <Button size="sm" variant="outline" disabled={respaldoEstado.trabajando} onClick={espejo} title="Copia a la carpeta segura (BANCOS y entidades financieras) los resúmenes nuevos que Ulises dejó en su carpeta, y los vincula. No toca la carpeta de Ulises.">Traer lo nuevo del espejo de Ulises</Button>
                  </div>
                  {respaldoEstado.lineas.map((l, i) => (
                    <div key={i} className={l.error ? "text-red-700" : ""}>
                      {l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">{l.texto}</a> : l.texto}
                    </div>
                  ))}
                </div>
              )
            })()}

            <ProponerFotoBalance empresa={empresa.id} fechaInicio={primerDiaDelEjercicio(libro.ejercicio)}
              fechaCierre={libro.ejercicio.fechaCierre} datos={datosParaLaFoto}
              iva={ivaDelLibro} fciMovimientos={fciMovimientos} onPropuesta={recibirPropuesta} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
