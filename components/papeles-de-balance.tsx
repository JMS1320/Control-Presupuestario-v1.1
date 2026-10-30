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
import { ProvisionManual, tablaFacturas } from "./provision-manual"
import { saldosDelEjercicioAnterior, type AjusteBalance } from "@/lib/balance/ajustes-balance"
import type { PendienteBalance } from "@/lib/balance/pendientes-balance"
import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { toast } from "sonner"
import { armarEjercicio, nombreSubdiario, primerDiaDelEjercicio } from "@/lib/balance/ejercicio"
import { armarLibroDiario, desdeArca, desdeHistorico, desdeVenta, ULTIMO_SUBDIARIO_HISTORICO, type LibroDiario } from "@/lib/balance/libro-diario"
import { PRESENTADO_ARCA_COMPRAS } from "@/lib/balance/presentado-arca"
import { explicarFila, type ProveedorFijo } from "@/lib/balance/facturas-fijas"
import { armarTemplatesDelEjercicio, desdeCuota, type TemplatesDelEjercicio } from "@/lib/balance/templates-libro"
import {
  armarControlCuotas, resumenControlCuotas, conProblema, cuotaParaControlDesde, subdiariosConVentasDesde,
  presentacionesSicoreDesde, type ControlCuotasTemplates, type PresentacionSicore,
} from "@/lib/balance/control-cuotas-templates"
import { HaciendaAlCierre, type DatosHacienda } from "./hacienda-al-cierre"
import { ProponerFotoBalance } from "./proponer-foto-balance"
import { ivaConSigno, type DatosDeLosPapeles } from "@/lib/balance/balance-propio"
import { armarImpuestoCheque, ETIQUETA_CONCEPTO, pctComputable } from "@/lib/balance/impuesto-cheque"
import { descargarLibroDiario } from "@/lib/balance/export-libro-diario"
import { descargarLibroDiarioConsensuado } from "@/lib/balance/libro-diario-consensuado"
import { leerCobrosYRetenciones } from "@/lib/balance/cobros-de-ventas"
import { descargarDiferenciasVsArca } from "@/lib/balance/diferencias-vs-arca"
import { saldosEnDolaresParaBalance } from "@/lib/dolares/posicion-cierre"
import { MarcaTentativo } from "@/components/marca-tentativo"
import { leyendaTentativo } from "@/lib/balance/datos-usuario-puro"
import { traerTodo, lecturaIncompleta, type Lectura } from "@/lib/supabase-paginado"
import type { TipoCuenta } from "@/lib/presupuesto/templates"
import { asientosContablesDelEjercicio, ESTADO_ASIENTO_CONTABLE } from "@/lib/balance/asientos-contables"
import type { AsientoLibroDiario } from "@/lib/balance/libro-diario"
import { leerFotoInicio, controlarProvisionAnterior, type ControlesInicio } from "@/lib/balance/control-inicio"
import {
  armarCuentasAlCierre, canceladoPorCuotasAlCierre, polizasParaCierreDesde,
  type CuentasAlCierre, type ComprobanteConPago, type CanceladoPorCuotas,
} from "@/lib/balance/cuentas-al-cierre"
import {
  armarChequesDados, armarAnticiposAlCierre,
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
} from "@/lib/balance/sueldos-balance"
import {
  armarCuentasCorrientes, aplicarSaldosInicio, abrirDesglosar, CONTRAPARTES_DEL_BALANCE,
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

export function PapelesDeBalance() {
  const [empresa, setEmpresa] = useState<(typeof EMPRESAS)[number]>(EMPRESAS[0])
  const [anioCierre, setAnioCierre] = useState(2026)
  /** 📌 A-FEAT-1258 — los pendientes a revisar, para que viajen al export. */
  const [pendientes, setPendientes] = useState<PendienteBalance[]>([])
  /** ✍️ A-FEAT-1207 — los saldos del ejercicio anterior: gasto de este ejercicio, viajan al export. */
  const [ajustes, setAjustes] = useState<AjusteBalance[]>([])
  const [cargando, setCargando] = useState(false)
  const [libro, setLibro] = useState<LibroDiario | null>(null)
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
  const [bancarios, setBancarios] = useState<Parameters<typeof descargarLibroDiario>[7] | null>(null)
  const [templates, setTemplates] = useState<TemplatesDelEjercicio | null>(null)
  /** 🔢 ¿Cada template tiene sus cuotas en la campaña? (decisión de JMS del 28/10/2026). */
  const [controlCuotas, setControlCuotas] = useState<ControlCuotasTemplates | null>(null)
  const [hacienda, setHacienda] = useState<DatosHacienda | null>(null)
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
    ? aplicarSaldosInicio(cuentasCorrientes, Object.fromEntries(
        CONTRAPARTES_DEL_BALANCE.map(c => [c.clave, leerNumero(saldosCC.valores[c.clave])])),
        // 🤖 A-FEAT-1386: el inicio que puso Claude sale TENTATIVO en el Excel hasta el OK
        Object.fromEntries(Object.entries(saldosCC.tentativos).map(([k, f]) => [k, leyendaTentativo(f)])))
    : null, [cuentasCorrientes, saldosCC.valores, saldosCC.tentativos])
  /**
   * 📒 «Asientos Contables» (A-FEAT-1318): las facturas no informadas en ARCA que no van al subdiario.
   * `null` = no se pudo leer (la solapa no sale, y se avisa); `[]` = se leyó y no hay.
   */
  const [asientosContables, setAsientosContables] = useState<AsientoLibroDiario[] | null>(null)
  /** 🧮 A-FEAT-1343: cuántas filas dijo la base y cuántas llegaron, por consulta. */
  const [lecturas, setLecturas] = useState<Lectura[] | null>(null)
  /** 🔁 A-FEAT-1427: el inicio según el balance anterior contra lo que reconoce la app. */
  const [controlesInicio, setControlesInicio] = useState<ControlesInicio | null>(null)

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
    const lect: Lectura[] = []
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
          .select("*, egreso:egresos_sin_factura(nombre_referencia, proveedor, nombre_quien_cobra, categ, centro_costo, responsable, codigo_contable, tipo, cuenta_agrupadora)", { count: "exact" })
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
          .eq("empresa", empresa.id).eq("accion", "incluir").in("tabla", [tablaFacturas(empresa.schema), TABLA_HISTORICO])
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
          for (const a of ajustesIncl) {
            const f = a.registro_id ? porId.get(a.registro_id) : undefined
            if (!f) { toast.warning(`Una provisión a mano apunta a una factura que no se encontró: ${a.concepto}`); continue }
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

      // 🔁 A-FEAT-1427: lo que el balance anterior dejó provisionado contra lo que la app reconoce (avisa, no frena).
      try {
        const fechaFoto = armarEjercicio(anioCierre - 1, empresa.mesCierre).fechaCierre
        const { foto, error: eFoto } = await leerFotoInicio(supabase, empresa.id, fechaFoto, ["provision_gastos"])
        if (eFoto) throw new Error(eFoto)
        const provision = controlarProvisionAnterior(foto, armado.provisionesEjercicioAnterior, armado.compras)
        setControlesInicio({ provision })
        if (provision.estado === "no cierra") toast.warning(
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

        const conPago = (asientos: typeof armado.compras): ComprobanteConPago[] =>
          asientos.map(a => {
            const propia = porId.get(a.id)?.fechaPago ?? null
            const banco = porComprobante.get(a.id) ?? null
            return {
              asiento: a,
              estado: porId.get(a.id)?.estado ?? "pendiente",
              fechaPago: propia ?? banco,
              origenFecha: propia ? "fecha_pago" : banco ? "movimiento bancario" : "sin dato",
            }
          })

        // 🛡️ A-FEAT-1385: los seguros en «cuotas» deben sólo lo que su póliza no pagó al cierre. Si falla, van enteros y se avisa.
        let cuotasPoliza: Map<string, CanceladoPorCuotas> | undefined
        try {
          const pol = await supabase.from("polizas_seguro").select("poliza,template_id,polizas_endosos(comprobante_arca_id,polizas_cuotas(vencimiento,importe))")
          if (pol.error) throw new Error(pol.error.message)
          const filasPol = (pol.data ?? []) as Record<string, unknown>[]
          const tpls = new Set(filasPol.map(p => p.template_id).filter(Boolean))
          const deTpl = ((cuotas.data ?? []) as Record<string, unknown>[]).filter(q => tpls.has(q.egreso_id))
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
          pagar: sacarLosDeCuentaCorriente(armarCuentasAlCierre(conPago(armado.compras), ej.fechaCierre, cuotasPoliza), conCC),
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

        const anticipos = armarAnticiposAlCierre(
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
        )
        setValores({ cheques, anticipos })

        // 🧮 El control del camino inverso se muestra, no sólo se escribe en la solapa.
        if (anticipos.descuadres.length > 0) {
          toast.warning(
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
        const saldos: Array<{ nombre: string; saldo: number | null; fecha: string | null }> = []
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
            .select("fecha, descripcion, categ, nro_cuenta, debitos, creditos, saldo, orden", { count: "exact" })
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
          saldos.push({ nombre: t.nombre, saldo: cadena.saldoAlCierre, fecha: cadena.hasta })
        }
        // 💵 A-FEAT-1398: las cuentas en dólares de la empresa, en pesos al TC de cierre (sólo si tienen movimientos)
        const dolares = await saldosEnDolaresParaBalance(supabase, empresa.id, finDelEjercicio)
        saldos.push(...dolares.saldos)
        if (dolares.avisos.length) toast.warning(`Dólares: ${dolares.avisos.join(" · ")}`)
        /**
         * 🧮 El control se VE, no vive sólo en la solapa (§ 🧮). Si los importes del extracto no
         * explican sus propios saldos, el saldo que va al papel no se puede entregar.
         */
        const noCierran = cadenas.filter(c => c.diferencia != null && Math.abs(c.diferencia) > 0.01)
        if (noCierran.length > 0) {
          toast.warning(
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
        setSueldos(armadoSueldos)

        // 🧮 El control se ve: si el bruto recompuesto no da el guardado, hay que mirarlo.
        if (armadoSueldos.descuadres.length > 0) {
          toast.warning(
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
          const ventasCC: VentaParaCC[] = armado.ventas.map(v => ({
            id: v.id,
            fecha: v.fecha,
            numero: `${v.punto_venta ?? ""}-${v.numero ?? ""}`,
            total: v.total,
            cuit: v.cuit,
          }))

          const meses = mesesDelEjercicio(anioCierre, empresa.mesCierre)
          const [aaF2, mmF2] = meses[11].split("-").map(Number)
          const finEj = new Date(Date.UTC(aaF2, mmF2, 0)).toISOString().slice(0, 10)
          const leidoCC = await traerTodo((d, h) => supabase.from("msa_galicia")
            .select("id, fecha, debitos, creditos, descripcion, detalle, contable, comprobantes_pagados", { count: "exact" })
            .gte("fecha", `${meses[0]}-01`).lte("fecha", finEj)
            .not("contable", "is", null).order("id").range(d, h))
          const movsCC = leidoCC.data
          anotar("Movimientos de cuentas corrientes", leidoCC)

          /**
           * 👷 A-FEAT-1422 (8) — el sueldo pendiente de un socio (MA) entra a SU cuenta corriente como deuda
           * de MSA. JMS 29/10: «ella cobra pero no por recibo… entra dentro de su cuenta corriente».
           */
          comprasCC.push(...sueldosPendientesComoCompras(periodosParaCC, meses))

          let armadoCC = armarCuentasCorrientes(
            comprasCC, ventasCC, (movsCC ?? []) as unknown as MovimientoParaCC[])

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
                  toast.warning(`Seguros: faltan comprobantes de Federación Patronal al cierre — saldo ${fmt(seg.saldo)} `
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
            const [leidoTj, polTj] = await Promise.all([
              traerTodo((d, h) => supabase.schema("msa").from("tarjeta_visa_business")
                .select("fecha_vencimiento, descripcion, categ, contable, debitos, creditos, debitos_usd, template_id", { count: "exact" })
                .eq("tipo_fila", "movimiento").gte("fecha_vencimiento", `${meses[0]}-01`).lte("fecha_vencimiento", finEj)
                .order("id").range(d, h)),
              supabase.from("polizas_seguro").select("template_id").not("template_id", "is", null),
            ])
            if (leidoTj.error) throw new Error(leidoTj.error.message)
            anotar("Consumos de la tarjeta (para abrir «Desglosar»)", leidoTj)
            const tplConPoliza = new Set(((polTj.data ?? []) as Array<{ template_id: string | null }>).map(p => p.template_id))
            const consumos: ConsumoTarjeta[] = ((leidoTj.data ?? []) as Array<Record<string, unknown>>).map(x => ({
              vencimiento: (x.fecha_vencimiento as string | null) ?? null,
              descripcion: x.descripcion as string | null, categ: x.categ as string | null, contable: x.contable as string | null,
              debitos: Number(x.debitos ?? 0), creditos: Number(x.creditos ?? 0), debitosUsd: Number(x.debitos_usd ?? 0),
              conPoliza: !!x.template_id && tplConPoliza.has(x.template_id as string),
            }))
            armadoCC = abrirDesglosar(armadoCC, (movsCC ?? []) as unknown as MovimientoParaCC[], consumos)
            const sinAbrir = armadoCC.desgloseTarjeta?.sinAbrir ?? 0
            if (sinAbrir !== 0) {
              toast.warning(`«Desglosar»: ${fmt(sinAbrir)} de pagos de la tarjeta no se pudieron abrir con su resumen. Está en la solapa 14.`)
            }
          } catch {
            toast.warning("No se pudo abrir «Desglosar» con los consumos de la tarjeta: queda entero en «sin tratar».")
          }
          setCuentasCorrientes(armadoCC)

          // 🛑 Lo que falta encuadrar se ve: es plata marcada que todavía no es de nadie.
          if (armadoCC.totalSinTratar !== 0) {
            toast.warning(
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
      setTemplates(armarTemplatesDelEjercicio((cuotas.data ?? []).map(f => desdeCuota(f, tipoDeCateg)), ej, {
        empresa: empresa.id,
        plan,
        templatesConPoliza: ((conPoliza ?? []) as Array<{ template_id: string | null }>).map(p => p.template_id!).filter(Boolean),
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
      setControlCuotas(armarControlCuotas(empresa.id, anioCierre, {
        cuotas: (cuotas.data ?? []).map(f => cuotaParaControlDesde(f as Record<string, unknown>)),
        subdiariosConVentas: subdiariosConVentasDesde((ventas.data ?? []) as Record<string, unknown>[]),
        presentacionesSicore: sicore,
        hoy: hoyArgentina(),
      }))

      if (armado.compras.length === 0 && armado.ventas.length === 0) {
        toast.warning(`No hay comprobantes en los 12 subdiarios del ejercicio ${ej.etiqueta}.`)
      }
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
          <Button onClick={generar} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Armar el libro
          </Button>
          {libro && (
            <Button variant="outline" onClick={() => descargarLibroDiario(
                libro, empresa.id, templates ?? undefined, hacienda ?? undefined,
                hacienda?.insumos, hacienda?.campo,
                // Los cuatro bloques de los papeles 03 y 04 viajan juntos: el listado de
                // comprobantes, los cheques y los anticipos son partes del mismo papel.
                { ...(cuentas ?? {}), ...(valores ?? {}) },
                bancarios ?? undefined,
                sueldos ?? undefined,
                cuentasCorrientesConInicio ?? undefined,
                pendientes,
                saldosDelEjercicioAnterior(ajustes, empresa.id, anioCierre),
                asientosContables ?? undefined,
                lecturas ?? undefined,
                controlCuotas ?? undefined,
                controlesInicio ?? undefined,
              )}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {/* A-FEAT-1388: decía «sin el sector productivo» y confundía cuando los precios ya se
                  veían cargados — lo que falta es traer el stock, y eso es lo que se dice. */}
              Bajar el Excel{hacienda ? " completo" : " — sin hacienda ni insumos (falta «Traer stock y precios»)"}
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
                .then(r => { if (r.cobros?.noCierra) toast.warning(`Control cobros: ${r.cobros.noCierra} venta(s) no cierran (total − retenciones ≠ cobrado).`) })
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
                    for (const a of r.avisos) toast.warning(a, { duration: 15000 })
                    toast.success(`Diferencias vs ARCA: ${r.zips.usados} zip(s) usados · compras ${r.compras.filas} diferencia(s) · ventas ${r.ventas.filas} fila(s). Detalle de los zips en la solapa «Zips de ARCA».`)
                  })
                  .catch(err => toast.error("No se pudo armar «Diferencias vs ARCA»: " + (err as Error).message))
              }} />
            </label>
          )}
        </div>

        {/* 📌 A-FEAT-1258 — a la vista mientras se trabaja; salen en el export. */}
        <PendientesBalance empresa={empresa.id} anioCierre={anioCierre} onCambio={setPendientes} />
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
            <HaciendaAlCierre empresa={empresa.id} ejercicio={libro.ejercicio} onDatos={setHacienda} />

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

            <ProponerFotoBalance empresa={empresa.id} fechaInicio={primerDiaDelEjercicio(libro.ejercicio)}
              fechaCierre={libro.ejercicio.fechaCierre} datos={datosParaLaFoto}
              iva={ivaDelLibro} fciMovimientos={fciMovimientos} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
