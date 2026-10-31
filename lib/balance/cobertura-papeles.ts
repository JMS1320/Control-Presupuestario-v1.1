/**
 * 🗂️ **COBERTURA DE LOS PAPELES — ¿el export responde CADA dato que se presentó el año pasado?** (A-FEAT-1427, 30/10)
 *
 * JMS 30/10: *«avanzá a que el export contable reporte todo lo que reporta el Excel que mandé en el balance del año
 * pasado… para ambos canales [descarga y vista previa] la aplicación me debería decir: por un lado inconsistencias;
 * por otro, cosas que no se pueden calcular porque falta algo — falta un saldo de inicio, no hay información, o
 * pendiente de desarrollo, y me ponés ahí lo que es pendiente de desarrollo»*.
 *
 * El catálogo es la lista de lo que JMS presentó (los 10 papeles de «Balance/- Enviados», relevados renglón por
 * renglón el 30/10 → «Cruce papeles 24-25 vs export 25-26 - PLATA / - STOCK»). La lista es fija porque los papeles
 * lo son; **el ESTADO de cada uno se calcula cada vez** con los mismos datos que arman el Excel: cuando se cargue el
 * extracto que falta o se desarrolle la pieza, el renglón cambia solo de estado. Nada es un comentario escrito a mano.
 */
import type { CadenaDeSaldos } from "./saldos-al-inicio"
import type { ControlesInicio } from "./control-inicio"
import type { ValuacionHacienda } from "./hacienda-stock"
import type { CuadreHacienda } from "./cuadre-hacienda"
import type { StockInsumos } from "./stock-insumos"
import type { RenglonStockInicio } from "./stock-inicio"
import type { CuadreGranos, Sementeras } from "./granos-sementeras"
import type { ChequesDados, AnticiposAlCierre } from "./valores-al-cierre"
import type { CuentasAlCierre } from "./cuentas-al-cierre"
import type { GastosBancarios, RetirosYAportes } from "./papeles-bancarios"
import type { TemplatesDelEjercicio } from "./templates-libro"
import type { SaldosAnteriores } from "./ajustes-balance"
import type { AsientoLibroDiario, LibroDiario } from "./libro-diario"
import { linkTemplates } from "@/lib/impuestos/planilla"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import type { FuenteTema } from "./recorrido"
import { linkFacturas, linkHistorico } from "@/lib/egresos/link-facturas"
import { celdaNumero, type Comparacion } from "@/lib/cuaderno/papel-de-trabajo"

export type EstadoCobertura =
  | "sale"                 // ✅ el export lo responde
  | "error"                // ⛔ inconsistencia: el sistema se contradice o los números no cierran
  | "falta inicio"         // ⏳ falta el saldo de inicio (30/06 anterior)
  | "sin informacion"      // 📭 no hay datos cargados (un extracto, un comprobante…)
  | "pendiente desarrollo" // 🛠️ la app todavía no lo calcula: con su ID
  | "decision"             // ❓ depende de una decisión de JMS o del contador
  | "no corresponde"       // — decidido que no va

export const ICONO: Record<EstadoCobertura, string> = {
  "sale": "✅", "error": "⛔", "falta inicio": "⏳", "sin informacion": "📭",
  "pendiente desarrollo": "🛠️", "decision": "❓", "no corresponde": "—",
}
export const TEXTO_ESTADO: Record<EstadoCobertura, string> = {
  "sale": "sale", "error": "ERROR / INCONSISTENCIA", "falta inicio": "FALTA el saldo de inicio",
  "sin informacion": "FALTA información", "pendiente desarrollo": "PENDIENTE de desarrollo",
  "decision": "A DECIDIR", "no corresponde": "no corresponde",
}

/** Hechos que el export no trae y la pantalla lee aparte (consultas chicas). `undefined` = no se pudo saber. */
export interface HechosCobertura {
  /** Cheques emitidos con fecha anterior al inicio del ejercicio, cargados en la app. */
  chequesAntesDelInicio?: number
  /** Anticipos a proveedores pagados antes del inicio del ejercicio, cargados en la app. */
  anticiposAntesDelInicio?: number
  /** Fecha del primer movimiento de hacienda cargado. */
  primerMovimientoHacienda?: string | null
  /** Fecha del primer movimiento de insumos cargado. */
  primerMovimientoInsumos?: string | null
}

/** Todo lo que el export ya recibe, más los hechos de arriba. Cada campo puede faltar: eso también es información. */
export interface DatosCobertura {
  libro: LibroDiario
  fechaInicio: string
  templates?: TemplatesDelEjercicio | null
  hacienda?: { valuacion?: ValuacionHacienda; cuadre?: CuadreHacienda; stockInicio?: { renglones: RenglonStockInicio[]; pasturas: unknown[] } } | null
  insumos?: StockInsumos | null
  campo?: { granos: CuadreGranos; sementeras: Sementeras } | null
  cuentas?: { pagar?: CuentasAlCierre; cobrar?: CuentasAlCierre; cheques?: ChequesDados; anticipos?: AnticiposAlCierre } | null
  bancarios?: { gastos: GastosBancarios; retiros: RetirosYAportes; saldos: Array<{ nombre: string; saldo: number | null }>; cadenas?: CadenaDeSaldos[]; fci?: { total: { cuotapartesInicio?: number | null } } | unknown } | null
  saldosAnteriores?: SaldosAnteriores | null
  controlesInicio?: ControlesInicio | null
  hechos?: HechosCobertura | null
}

export interface ItemCobertura {
  /** Archivo · pestaña del papel del año pasado. */
  papel: string
  /** El dato, como lo escribió JMS. */
  dato: string
  /** El valor que tuvo en 24/25 (texto, para ubicarlo). */
  valor2425: string
  estado: EstadoCobertura
  /** Qué pasa hoy, en palabras: dónde sale, qué falta o qué no cierra. */
  detalle: string
  /** En qué solapa del export está (o estaría). */
  solapa: string
  /** El pendiente que lo resuelve, si hay uno. */
  pendiente?: string
  /** 🧭 A-FEAT-1430: qué se propone hacer, con números («diferencia $ X (Y %) → conciliar esto contra esto»). */
  propuesta?: string
  /** 📄 A-FEAT-1439: lo objetivo de ESTE año (el banco, lo presentado…), no el valor 24/25. */
  fuente?: FuenteTema
  /** 📄 A-FEAT-1439 punto 3: el documento que DEBERÍA respaldar el dato, cuando todavía no está cargado en la app. */
  fuenteEsperada?: string
  /** 🔗 Dónde vive el dato, para abrirlo filtrado en otra pestaña. */
  links?: LinkDato[]
  /** 📓 La tabla A contra B del papel de trabajo (celdas del Cuaderno, con la diferencia como fórmula). */
  comparacion?: Comparacion
}

/** Un link a la pantalla donde vive el dato, ya filtrada. */
export interface LinkDato { texto: string; href: string }

/** Lo que devuelve cada regla. */
type Resultado = { estado: EstadoCobertura; detalle: string; propuesta?: string; links?: LinkDato[]; comparacion?: Comparacion; fuente?: FuenteTema }

export interface CoberturaPapeles {
  items: ItemCobertura[]
  cuenta: Record<EstadoCobertura, number>
}

const pesos = (n: number) => `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

type Regla = Omit<ItemCobertura, "estado" | "detalle" | "propuesta" | "links" | "comparacion" | "fuente" | "fuenteEsperada"> & { evaluar: (d: DatosCobertura) => Resultado }

/** Una cuenta del papel 07: sale si tiene movimientos y su cadena cierra; si no tiene movimientos, falta el extracto. */
function cuentaBanco(nombre: RegExp, etiqueta: string, cuentaId: string): Regla["evaluar"] {
  return d => ({ ...conLink(d, cuentaId, etiqueta, evaluarCuentaBanco(d, nombre, etiqueta)), fuente: fuenteBanco(d, nombre, etiqueta, cuentaId) ?? undefined })
}
/**
 * 📄 A-FEAT-1439 punto 2: la FUENTE de un saldo de banco es lo que informó el banco — el saldo de su último movimiento
 * cargado, con la fecha y el link a ese tramo del extracto. Si el extracto termina antes del cierre, se dice: ese
 * saldo no es todavía el del 30/06.
 */
function fuenteBanco(d: DatosCobertura, nombre: RegExp, etiqueta: string, cuentaId: string): FuenteTema | null {
  const c = d.bancarios?.cadenas?.find(x => nombre.test(x.cuenta))
  if (!c || !c.hasta || c.saldoAlCierre == null) return null
  const cierre = d.libro.ejercicio?.fechaCierre ?? null
  const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  const llega = !cierre || c.hasta >= cierre
  return {
    origen: `Extracto del banco — ${etiqueta}`,
    detalle: `Saldo que informó el banco en su último movimiento cargado (${dmy(c.hasta)}): ${pesos(c.saldoAlCierre)}.`
      + (llega ? "" : ` ⚠️ El extracto llega hasta el ${dmy(c.hasta)}: falta cargar hasta el cierre (${dmy(cierre!)}) para tener el saldo al 30/06.`)
      + (c.saltos ? ` La cadena de saldos tiene ${c.saltos} salto(s).` : ""),
    links: [{ texto: `Los últimos movimientos de ${etiqueta} en el extracto`, href: linkExtracto({ cuenta: cuentaId, ...rangoQueContiene([c.hasta], 15) }) }],
  }
}
/** 🔗 Agrega el link al extracto de la cuenta (todo el ejercicio) a lo que no sale. */
function conLink(d: DatosCobertura, cuentaId: string, etiqueta: string, r: Resultado): Resultado {
  if (r.estado === "sale") return r
  const href = linkExtracto({ cuenta: cuentaId, desde: d.fechaInicio, hasta: d.libro.ejercicio?.fechaCierre ?? null })
  return { ...r, links: [...(r.links ?? []), { texto: `Abrir ${etiqueta} en el extracto (el ejercicio)`, href }] }
}
function evaluarCuentaBanco(d: DatosCobertura, nombre: RegExp, etiqueta: string): Resultado {
  {
    if (!d.bancarios) return { estado: "sin informacion", detalle: "no se pudo leer el extracto (papel 07 vacío)" }
    const c = d.bancarios.cadenas?.find(x => nombre.test(x.cuenta))
    if (!c) return { estado: "sin informacion", detalle: `${etiqueta} no está entre las cuentas del 07` }
    if (c.diferencia != null && Math.abs(c.diferencia) > 0.01)
      return { estado: "error", detalle: `los movimientos no explican el saldo al cierre: diferencia ${pesos(c.diferencia)} (07.1 Cadena de saldos)`,
        comparacion: { titulo: `${etiqueta}: inicio + movimientos contra el saldo del extracto`, celdas: [
          ["Concepto", "Importe"],
          ["Saldo al inicio", celdaNumero(c.saldoInicio)],
          ["Movimientos cargados del ejercicio (neto)", celdaNumero(c.netoCargado)],
          ["Movimientos sin cargar antes del primero (neto)", celdaNumero(c.netoNoCargado ?? 0)],
          ["Saldo al cierre calculado", "=B2+B3+B4"],
          ["Saldo al cierre según el extracto", celdaNumero(c.saldoAlCierre)],
          ["Diferencia (lo que falta explicar)", "=B6-B5"],
        ] },
        propuesta: `buscar en el extracto un movimiento faltante o duplicado por ${pesos(Math.abs(c.diferencia))}${c.saltos ? ` (hay ${c.saltos} salto(s) en la cadena: ${pesos(c.sumaDeSaltos)})` : ""}` }
    if (c.saldoInicio == null) return { estado: "falta inicio", detalle: "sin saldo al inicio declarado" }
    if (c.movimientos === 0) return { estado: "sin informacion", detalle: `inicio ${pesos(c.saldoInicio)}, pero la cuenta no tiene movimientos 25/26: falta cargar el extracto`,
      propuesta: "cargar el extracto del ejercicio (jul-25 a jun-26) de esta cuenta" }
    return { estado: "sale", detalle: `inicio ${pesos(c.saldoInicio)} → cierre ${pesos(c.saldoAlCierre ?? 0)} · ${c.movimientos} movimientos` }
  }
}

/** Una línea en dólares del 07 (la arma `saldosEnDolaresParaBalance`). */
function cuentaDolares(nombre: RegExp, cuentaId: string, etiqueta: string): Regla["evaluar"] {
  return d => conLink(d, cuentaId, etiqueta, evaluarCuentaDolares(d, nombre))
}
function evaluarCuentaDolares(d: DatosCobertura, nombre: RegExp): Resultado {
  {
    const s = d.bancarios?.saldos.find(x => nombre.test(x.nombre))
    if (!s) return { estado: "sin informacion", detalle: "no aparece en el 07" }
    if (/SIN MOVIMIENTOS/i.test(s.nombre)) return { estado: "sin informacion", detalle: "no tiene ningún movimiento cargado: falta el extracto / la rendición" }
    if (s.saldo == null) return { estado: "error", detalle: `${s.nombre}: sin saldo en pesos (falta el dólar de cierre)` }
    return { estado: "sale", detalle: `${s.nombre} = ${pesos(s.saldo)}` }
  }
}

/** 🔗 Los templates de esas cuotas, en Egresos → Templates, filtrados (el mecanismo de la Planilla de impuestos). */
const linksTemplates = (c: Array<{ egresoId?: string }>, que: string): LinkDato[] => {
  const ids = [...new Set(c.map(x => x.egresoId).filter((x): x is string => !!x))]
  return ids.length ? [{ texto: `Ver los ${ids.length} template(s) de ${que}`, href: linkTemplates(ids) }] : []
}
const templateCon = (d: DatosCobertura, re: RegExp) => d.templates?.detalle.filter(c => re.test(norm(`${c.concepto} ${c.proveedor}`))) ?? []

const REGLAS: Regla[] = [
  // ── BANCOS - saldos + FCI + compra venta USS ─────────────────────────────────────────────
  { papel: "BANCOS · Saldos", dato: "Banco Galicia (pesos)", valor2425: "$ 832.605,05", solapa: "07 Bancos / 07.1", evaluar: cuentaBanco(/galicia/i, "Banco Galicia", "msa_galicia") },
  { papel: "BANCOS · Saldos", dato: "Banco Santander", valor2425: "$ 7.204,86", solapa: "07 Bancos / 07.1", evaluar: cuentaBanco(/santander/i, "Banco Santander", "msa_santander") },
  { papel: "BANCOS · Saldos", dato: "Banco Provincia", valor2425: "$ 15.298,25", solapa: "07 Bancos / 07.1", evaluar: cuentaBanco(/provincia/i, "Banco Provincia", "msa_provincia") },
  { papel: "BANCOS · Saldos", dato: "Caja", valor2425: "$ 457.212,92", solapa: "07 Bancos / 07.1", evaluar: cuentaBanco(/caja general/i, "Caja general", "caja_general") },
  { papel: "BANCOS · Saldos", dato: "Galicia cuenta USD", valor2425: "US$ 35.001,63", solapa: "07 Bancos", evaluar: cuentaDolares(/cuenta corriente usd/i, "msa_cc_usd", "la cuenta USD") },
  { papel: "BANCOS · Saldos", dato: "Caja USD", valor2425: "0 (contador: $ 932.000)", solapa: "07 Bancos", evaluar: cuentaDolares(/msa caja usd/i, "msa_caja_usd", "la caja USD") },
  { papel: "BANCOS · Saldos", dato: "Broker GSEC", valor2425: "US$ 0,38", solapa: "—", evaluar: () => ({ estado: "decision", detalle: "la cuenta no existe en la app (US$ 0,38): ¿se ignora?" }) },
  { papel: "BANCOS · Fondos comunes", dato: "FCI Galicia: saldo y resultado financiero", valor2425: "$ 23.244.019,93 · resultado $ 4.364.112,79", solapa: "07 Bancos (bloque FCI)",
    evaluar: d => {
      const ini = d.controlesInicio?.inicioYCierre?.filas.find(f => f.renglon === "fci")
      const cierre = ini?.cierre
      return cierre != null
        ? { estado: "sale", detalle: `cierre ${pesos(cierre)} (cuotapartes × valor)` }
        : { estado: "falta inicio", detalle: "faltan las cuotapartes y su valor al inicio y al cierre (los PDF del fondo): sin eso no hay saldo ni resultado; suscripciones y rescates sí salen del extracto" }
    } },
  { papel: "BANCOS · Compra-venta u$d", dato: "Movimientos de la cuenta USD y compra-venta con su TC", valor2425: "65 movimientos · 4 operaciones", solapa: "—", pendiente: "A-FEAT-1398",
    evaluar: d => {
      const s = d.bancarios?.saldos.find(x => /cuenta corriente usd/i.test(x.nombre))
      return { estado: "pendiente desarrollo", detalle: `no hay papel de moneda extranjera (compras, ventas, diferencia de cambio)${s && /SIN MOVIMIENTOS/i.test(s.nombre) ? "; además faltan los extractos USD" : ""}` }
    } },

  // ── CUENTAS A COBRAR ─────────────────────────────────────────────────────────────────────
  { papel: "CUENTAS A COBRAR", dato: "Deudores por ventas y cheques en cartera", valor2425: "0", solapa: "03 Cuentas a cobrar",
    evaluar: d => d.cuentas?.cobrar ? { estado: "sale", detalle: `al cierre ${pesos(d.cuentas.cobrar.total)}` } : { estado: "sin informacion", detalle: "no se pudo armar el 03 (falta saber cuándo se cobró cada venta)" } },

  // ── CUENTAS A PAGAR ──────────────────────────────────────────────────────────────────────
  { papel: "CUENTAS PAGAR · 04", dato: "Proveedores a pagar", valor2425: "$ 3.543.793,46", solapa: "04 Cuentas a pagar · 00 Inicio y cierre",
    evaluar: d => {
      const ini = d.controlesInicio?.inicioYCierre?.filas.find(f => f.renglon === "proveedores")
      if (!d.cuentas?.pagar) return { estado: "sin informacion", detalle: "no se pudo armar el 04 (falta saber cuándo se pagó cada factura)" }
      if (ini && ini.inicioContador == null && ini.inicioJms == null) return { estado: "falta inicio", detalle: `al cierre ${pesos(d.cuentas.pagar.total)}; falta el inicio en la foto del balance anterior` }
      return { estado: "sale", detalle: `cierre ${pesos(d.cuentas.pagar.total)}; el inicio, en «00 Inicio y cierre»` }
    } },
  { papel: "CUENTAS PAGAR · 04", dato: "Tarjeta Visa a pagar", valor2425: "$ 887.674,27", solapa: "00 Inicio y cierre",
    evaluar: d => {
      const f = d.controlesInicio?.inicioYCierre?.filas.find(x => x.renglon === "tarjetas")
      if (!f) return { estado: "sin informacion", detalle: "falta el cálculo de cierre (se arma con «Pasar a la foto»)" }
      if (f.estado === "falta el cierre") return { estado: "sin informacion", detalle: "tuvo saldo el año pasado y la app hoy no calcula la deuda de la tarjeta al cierre (falta un resumen)" }
      return { estado: "sale", detalle: `inicio ${f.inicioContador != null ? pesos(f.inicioContador) : "—"} → cierre ${f.cierre != null ? pesos(f.cierre) : "—"}` }
    } },
  { papel: "CUENTAS PAGAR · 04", dato: "Facturas JMS ($ 15 M) y AMS ($ 10,5 M) del 30/06/2025", valor2425: "$ 25.500.000", solapa: "14 Cuentas corrientes",
    evaluar: () => ({ estado: "decision", detalle: "JMS 30/10: el contador las toma como anticipo (ya pagadas) → la cuenta corriente arranca con saldo a favor de MSA; el inicio cargado hoy (tentativo) las tiene como deuda",
      propuesta: "en el papel 14, saldo de inicio JMS −$ 15.000.000 y AMS −$ 10.500.000 (a favor de MSA): cuando llegan sus facturas de octubre, ya están canceladas" }) },
  { papel: "CUENTAS PAGAR · 4.1 Cheques dados", dato: "Cheques pendientes de débito al inicio (5 cheques)", valor2425: "$ 6.064.989,95", solapa: "04.1 Cheques dados",
    evaluar: d => {
      const n = d.hechos?.chequesAntesDelInicio
      if (n == null) return { estado: "sin informacion", detalle: "no se pudo consultar" }
      return n > 0 ? { estado: "sale", detalle: `${n} cheque(s) anteriores al inicio cargados` }
        : { estado: "sin informacion", detalle: "los 5 cheques del 30/06/2025 (88 y 89 Arroyo Tala, 90 ACREN, 87 De Francesco, Amado Vuelta) no están en Cheques; el total sí está en la foto" }
    } },
  { papel: "CUENTAS PAGAR · 05 Provisión", dato: "Provisión del ejercicio anterior (PAM 2-31 + Magdalena 10-269)", valor2425: "$ 12.456.000,14", solapa: "05 Provision",
    evaluar: d => {
      const p = d.controlesInicio?.provision
      if (!p) return { estado: "sin informacion", detalle: "no se pudo controlar" }
      if (p.estado === "cierra") return { estado: "sale", detalle: `reconocida ${pesos(p.reconocido)}` }
      if (p.estado === "sin foto") return { estado: "falta inicio", detalle: p.fuenteDeclarado }
      const pct = p.declarado ? Math.abs((p.diferencia ?? 0) / p.declarado) * 100 : 0
      return { estado: "error", detalle: `el balance anterior provisionó ${pesos(p.declarado ?? 0)} y la app reconoce ${pesos(p.reconocido)}: diferencia ${pesos(p.diferencia ?? 0)} (${pct.toFixed(0)} %)${p.candidatos.length ? `; ${p.candidatos.map(a => `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""}`).join(" + ")} están en el gasto de este ejercicio (doble)` : ""}`,
        comparacion: { titulo: "Provisión del ejercicio anterior: lo declarado contra lo que reconoce la app", celdas: [
          ["Concepto", "Importe"],
          ["Provisionado en el balance anterior", celdaNumero(p.declarado)],
          ["Reconocido por la app como provisión anterior", celdaNumero(p.reconocido)],
          ["Diferencia", "=B2-B3"],
          ["Diferencia en %", "=B4/B2*100"],
          ...p.candidatos.map(a => [`Candidata: ${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""} (${a.fecha ? a.fecha.split("-").reverse().join("/") : ""})`, celdaNumero(a.total)]),
          ...(p.candidatos.length ? [["Si se marcan las candidatas, la diferencia queda en", `=B4-SUMA(B6:B${5 + p.candidatos.length})`]] : []),
        ] },
        // 🔗 Las candidatas y lo que la app reconoce hoy, cada una donde vive (Histórico o Facturas).
        links: [
          ...linksDeAsientos(p.candidatos, "Las candidatas"),
          ...linksDeAsientos(p.reconocidos ?? [], `Lo que la app reconoce hoy (${pesos(p.reconocido)})`),
        ],
        propuesta: p.candidatos.length && p.candidatosContra === "declarado"
          ? `${p.candidatos.map(a => `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""} (${pesos(a.total)})`).join(" y ")} suman lo provisionado entero: marcarlas como «provisión del ejercicio anterior» y sacarle esa marca a lo que la app reconoce hoy (${(p.reconocidos ?? []).map(a => `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""}`).join(", ") || pesos(p.reconocido)}) → la provisión cierra; avisar al contador`
          : p.candidatos.length
          ? `marcar ${p.candidatos.map(a => `${a.denominacion} ${a.punto_venta ?? ""}-${a.numero ?? ""} (${pesos(a.total)})`).join(" y ")} como «provisión del ejercicio anterior» → la provisión cierra (diferencia $ 0) y el gasto 25/26 baja ${pesos(p.candidatos.reduce((s, a) => s + a.total, 0))}; avisar al contador`
          : "buscar qué comprobantes provisionó el balance anterior" }
    } },
  { papel: "CUENTAS PAGAR · 05 Provisión", dato: "«Pendiente de emitir por arrendamiento ganadero — Plácido Alberto Martínez»", valor2425: "sin importe", solapa: "05 Provision",
    evaluar: () => ({ estado: "decision", detalle: "no hay rastro en la app: pregunta abierta en «Pendientes a revisar»" }) },
  { papel: "CUENTAS PAGAR · Anticipo proveedores", dato: "Anticipo a Magdalena Martínez", valor2425: "$ 6.228.000,07", solapa: "04.2 Anticipos",
    evaluar: d => {
      const n = d.hechos?.anticiposAntesDelInicio
      if (n == null) return { estado: "sin informacion", detalle: "no se pudo consultar" }
      return n > 0 ? { estado: "sale", detalle: `${n} anticipo(s) anteriores al inicio cargados` }
        : { estado: "sin informacion", detalle: "no está cargado en Anticipos (el total sí, en la foto: «Anticipos a proveedores»)" }
    } },

  // ── INMOBILIARIO - RED VIAL - AUTOMOTOR ──────────────────────────────────────────────────
  { papel: "INMOB-RED VIAL-AUTOMOTOR", dato: "Inmobiliario (por partida)", valor2425: "$ 13.093.257,85", solapa: "Impuestos / Impuestos por mes",
    evaluar: d => { const c = templateCon(d, /inmobiliari/); return c.length ? { estado: "sale", detalle: `${c.length} cuota(s), ${pesos(c.reduce((a, x) => a + x.monto, 0))}`, links: linksTemplates(c, "inmobiliario") } : { estado: "sin informacion", detalle: "sin cuotas de inmobiliario en el ejercicio" } } },
  { papel: "INMOB-RED VIAL-AUTOMOTOR", dato: "Red Vial (por partida)", valor2425: "$ 3.994.430,64", solapa: "Impuestos / Impuestos por mes",
    evaluar: d => { const c = templateCon(d, /red vial/); return c.length ? { estado: "sale", detalle: `${c.length} cuota(s), ${pesos(c.reduce((a, x) => a + x.monto, 0))}`, links: linksTemplates(c, "Red Vial") } : { estado: "sin informacion", detalle: "sin cuotas de Red Vial en el ejercicio" } } },
  { papel: "INMOB-RED VIAL-AUTOMOTOR", dato: "Adelantos para el próximo balance (cuota 2/4, Red Vial Rojas)", valor2425: "−$ 4.673.114,55 · −$ 2.442.091,50", solapa: "Saldos ej. anterior",
    evaluar: d => (d.saldosAnteriores?.total ?? 0) > 0 ? { estado: "sale", detalle: `${pesos(d.saldosAnteriores!.total)} tomados como gasto de este ejercicio` } : { estado: "falta inicio", detalle: "no hay saldos del ejercicio anterior cargados" } },
  { papel: "INMOB-RED VIAL-AUTOMOTOR", dato: "Automotor por vehículo", valor2425: "$ 1.171.742,92 (5 vehículos)", solapa: "Impuestos",
    evaluar: d => {
      const faltan = ["tiguan", "gol", "hilux"].filter(v => !templateCon(d, new RegExp(`\\b${v}\\b`)).length)
      return faltan.length
        ? { estado: "sin informacion", detalle: `sin cuotas 25/26 de ${faltan.join(", ")} (JMS: se cargan pagos y templates después de conciliar)`,
          propuesta: "después de conciliar: si se pagaron, crear su template con las cuotas pagadas" }
        : { estado: "sale", detalle: "los 5 vehículos tienen cuotas" }
    } },

  // ── RETIROS Y APORTES ────────────────────────────────────────────────────────────────────
  { papel: "RETIROS Y APORTES · Resumen", dato: "Retiros directos y aportes de PAM", valor2425: "−$ 3.600.000 · +$ 17.900.100", solapa: "09 Retiros y aportes",
    evaluar: d => {
      const f = d.bancarios?.retiros.filas ?? []
      return f.length ? { estado: "sale", detalle: f.map(x => `${x.etiqueta} ${pesos(x.total)}`).join(" · ") } : { estado: "sin informacion", detalle: "el 09 no tiene filas" }
    } },
  { papel: "RETIROS Y APORTES · Resumen", dato: "Retiros indirectos: pagos a terceros, impuestos de PAM, Libertad 50/50, tarjetas", valor2425: "−$ 23.896.979,07", solapa: "09 Retiros y aportes", pendiente: "A-FEAT-1199",
    evaluar: () => ({ estado: "pendiente desarrollo", detalle: "el 09 lista sólo los directos; los indirectos (RET 3, RET i, Libertad, tarjetas) no salen como retiro" }) },
  { papel: "RETIROS Y APORTES · Resumen", dato: "Cuenta socios por socio (MA, Manuel, Soledad, Mechi, Andrés, José, PAM)", valor2425: "$ 45.905.575,52 (contador)", solapa: "14 Cuentas corrientes",
    evaluar: () => ({ estado: "falta inicio", detalle: "falta la apertura del saldo de inicio por socio (la espera JMS)" }) },
  { papel: "RETIROS Y APORTES · Retiros USS", dato: "Extracciones USD (devolución de aporte de PAM)", valor2425: "US$ 337.000", solapa: "14 Cuentas corrientes",
    evaluar: () => ({ estado: "falta inicio", detalle: "va como saldo de inicio de la cuenta corriente con PAM; no está cargado" }) },
  { papel: "RETIROS Y APORTES · CA PAM", dato: "Cruce MSA ↔ PAM (el mismo movimiento visto de los dos lados)", valor2425: "—", solapa: "—", pendiente: "A-FEAT-1427",
    evaluar: () => ({ estado: "pendiente desarrollo", detalle: "no hay control por dos caminos entre los extractos de MSA y de PAM" }) },

  // ── GASTOS BANCARIOS ─────────────────────────────────────────────────────────────────────
  { papel: "GASTOS BANCARIOS", dato: "Galicia: gastos e impuestos bancarios por mes", valor2425: "$ 1.476.831,16 + $ 9.736.714,31", solapa: "08 Gastos bancarios / 08.1",
    evaluar: d => d.bancarios?.gastos.filas.length ? { estado: "sale", detalle: `${d.bancarios.gastos.filas.length} concepto(s) por mes` } : { estado: "sin informacion", detalle: "el 08 salió vacío" } },
  { papel: "GASTOS BANCARIOS", dato: "Créditos pagados e intereses (descuento de cheques, saldo deudor)", valor2425: "$ 267.536,81", solapa: "08 Gastos bancarios",
    evaluar: d => {
      const sin = d.bancarios?.gastos.sinClasificar ?? []
      return sin.length
        ? { estado: "error", detalle: `${sin.length} CATEG del extracto sin cuenta en el plan bancario (${sin.map(s => s.categ).join(", ")}): no salen en el 08`,
          propuesta: `asignarles cuenta en el plan (gasto financiero): ${sin.map(s => `${s.categ} ${pesos(s.debitos - s.creditos)} en ${s.movimientos} mov.`).join(" · ")}`,
          comparacion: { titulo: "CATEG del extracto que no tienen cuenta en el plan bancario", celdas: [
            ["CATEG", "Movimientos", "Débitos", "Créditos", "Neto"],
            ...sin.map((s, i) => [s.categ, String(s.movimientos), celdaNumero(s.debitos), celdaNumero(s.creditos), `=C${i + 2}-D${i + 2}`]),
            ["Total", "", `=SUMA(C2:C${sin.length + 1})`, `=SUMA(D2:D${sin.length + 1})`, `=SUMA(E2:E${sin.length + 1})`],
          ] } }
        : { estado: "sale", detalle: "todo lo del extracto tiene su concepto" }
    } },
  { papel: "GASTOS BANCARIOS", dato: "Santander y Provincia por mes", valor2425: "$ 700.033,54 · $ 323.062,68", solapa: "08 Gastos bancarios",
    evaluar: d => {
      const vacias = (d.bancarios?.cadenas ?? []).filter(c => /santander|provincia/i.test(c.cuenta) && c.movimientos === 0).map(c => c.cuenta)
      return vacias.length ? { estado: "sin informacion", detalle: `sin movimientos 25/26: ${vacias.join(", ")}` } : { estado: "sale", detalle: "las dos cuentas tienen movimientos" }
    } },
  { papel: "GASTOS BANCARIOS", dato: "Fondo fijo (caja)", valor2425: "$ 1.194.833,68", solapa: "08 Gastos bancarios",
    evaluar: d => {
      const cajas = (d.bancarios?.cadenas ?? []).filter(c => /caja/i.test(c.cuenta))
      return cajas.some(c => c.movimientos > 0) ? { estado: "sale", detalle: `${cajas.filter(c => c.movimientos > 0).map(c => c.cuenta).join(", ")} con movimientos` }
        : { estado: "sin informacion", detalle: "las cajas no tienen movimientos 25/26: falta la rendición de caja" }
    } },

  // ── LIBRO DIARIO ─────────────────────────────────────────────────────────────────────────
  { papel: "LIBRO DIARIO", dato: "Subdiarios de compras y ventas por mes y cuenta", valor2425: "—", solapa: "Compras · Ventas · por cuenta · Resumen 12 meses",
    evaluar: d => d.libro.controles.sePuedeEntregar ? { estado: "sale", detalle: `compras ${d.libro.compras.length} · ventas ${d.libro.ventas.length}` }
      : { estado: "error", detalle: d.libro.controles.motivos.join(" ") } },

  // ── STOCK HACIENDA ───────────────────────────────────────────────────────────────────────
  { papel: "STOCK HACIENDA · 2 - Hacienda", dato: "Cabezas por categoría al inicio (balance · campo · SENASA)", valor2425: "321 cabezas", solapa: "02 Hacienda",
    evaluar: d => d.hacienda?.cuadre ? { estado: "sale", detalle: `existencia al inicio ${d.hacienda.cuadre.existenciaInicio} (las tablas de los tres saldos)` }
      : { estado: "sin informacion", detalle: "falta «Traer stock y precios»" } },
  { papel: "STOCK HACIENDA · 2 - Hacienda", dato: "Kg, $/kg y $/cabeza por categoría al inicio", valor2425: "$ 405.560.000", solapa: "02 Hacienda",
    evaluar: () => ({ estado: "falta inicio", detalle: "sólo está el total cría/recría en la foto; falta la valuación por categoría al 30/06/2025" }) },
  { papel: "STOCK HACIENDA · 2 - Hacienda", dato: "Valuación al cierre por categoría", valor2425: "—", solapa: "02 Hacienda · Precios",
    evaluar: d => {
      const v = d.hacienda?.valuacion
      if (!v) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      return v.huecos.length ? { estado: "sin informacion", detalle: `${v.huecos.length} categoría(s) sin precio (${v.cabezasSinValuar} cabezas sin valuar)` } : { estado: "sale", detalle: `${v.cabezas} cabezas · ${pesos(v.valuado)}` }
    } },
  { papel: "STOCK HACIENDA · 2 - Hacienda", dato: "Cuadre: inicio ± movimientos = cierre", valor2425: "—", solapa: "02 Hacienda",
    evaluar: d => {
      const c = d.hacienda?.cuadre
      if (!c) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      const desde = d.hechos?.primerMovimientoHacienda
      if (desde && desde > d.fechaInicio) return { estado: "sin informacion", detalle: `los movimientos arrancan el ${desde.split("-").reverse().join("/")}: faltan los del ${d.fechaInicio.split("-").reverse().join("/")} en adelante (JMS los provee)` }
      return c.diferencia !== 0 ? { estado: "error", detalle: `el cuadre no cierra por ${c.diferencia} cabezas` } : { estado: "sale", detalle: "cierra" }
    } },
  { papel: "BAPU · calculos", dato: "Ganancia por tenencia de la hacienda", valor2425: "$ 155.221.000", solapa: "—", pendiente: "A-FEAT-1420",
    evaluar: () => ({ estado: "pendiente desarrollo", detalle: "no se calcula en ningún lado (valuación al cierre − al inicio ± movimientos)" }) },
  { papel: "STOCK HACIENDA", dato: "Equinos", valor2425: "contador $ 536.919,86", solapa: "—",
    evaluar: () => ({ estado: "no corresponde", detalle: "JMS 30/10: no van" }) },

  // ── STOCKS: GRANOS, INSUMOS, SEMENTERAS, GAS OIL ─────────────────────────────────────────
  { papel: "STOCKS · 1 - Granos", dato: "Soja al inicio y al cierre (cuadre de toneladas)", valor2425: "6,93 t · $ 2.045.386,32", solapa: "1 Granos",
    evaluar: d => {
      const g = d.campo?.granos
      if (!g) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      if (g.faltan.length) return { estado: g.stockInicioTn == null ? "falta inicio" : "sin informacion", detalle: g.faltan.join(" · ") }
      return g.cierra ? { estado: "sale", detalle: `inicio ${g.stockInicioTn} t → cierre ${g.stockEmpresaTn} t` } : { estado: "error", detalle: `el cuadre no cierra: diferencia ${g.diferenciaTn} t` }
    } },
  { papel: "STOCKS · 2 - Insumos / 5 - Forrajes / 6 - Gas oil", dato: "Stock declarado al inicio, producto por producto", valor2425: "$ 31.730.444,08 (94 renglones)", solapa: "Stock al inicio",
    evaluar: d => {
      const r = d.hacienda?.stockInicio?.renglones
      if (!r) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      const conf = r.filter(x => x.emparejado === "a confirmar").length
      return conf ? { estado: "decision", detalle: `${r.length} renglones; ${conf} «a confirmar» (nombre o unidad distintos del producto de la app)` } : { estado: "sale", detalle: `${r.length} renglones, todos emparejados` }
    } },
  { papel: "STOCKS · 2 - Insumos / 5 - Forrajes / 6 - Gas oil", dato: "Existencia valuada al cierre", valor2425: "—", solapa: "Stock insumos",
    evaluar: d => {
      const st = d.insumos
      if (!st) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      if (st.alCierre?.descuadres.length) return { estado: "error", detalle: `${st.alCierre.descuadres.map(x => `${x.producto}: hoy ${x.hoy}, movimientos ${x.sumaMovimientos}`).join(" · ")}`,
        propuesta: "decidir cuál vale: si los movimientos, corregir la existencia de hoy con un ajuste; si la de hoy, falta cargar el uso que la explica",
        comparacion: { titulo: "Existencia de hoy contra la suma de sus movimientos", celdas: [
          ["Producto", "Hoy", "Suma de movimientos", "Diferencia", "Unidad"],
          ...st.alCierre.descuadres.map((x, i) => [x.producto, celdaNumero(x.hoy), celdaNumero(x.sumaMovimientos), `=B${i + 2}-C${i + 2}`, x.unidad]),
        ] } }
      if (st.huecos.length) return { estado: "sin informacion", detalle: `${st.huecos.length} producto(s) con existencia y sin precio` }
      return { estado: "sale", detalle: `${st.productos} productos · ${pesos(st.valuado)}` }
    } },
  { papel: "STOCKS · Movimientos", dato: "Compras y consumos de insumos del ejercicio", valor2425: "—", solapa: "Stock insumos",
    evaluar: d => {
      const desde = d.hechos?.primerMovimientoInsumos
      if (desde === undefined) return { estado: "sin informacion", detalle: "no se pudo consultar" }
      if (!desde || desde > d.fechaInicio) return { estado: "sin informacion", detalle: `los movimientos de insumos arrancan el ${desde ? desde.split("-").reverse().join("/") : "—"}: el inicio declarado no se enlaza con la existencia de la app` }
      return { estado: "sale", detalle: "movimientos desde el inicio" }
    } },
  { papel: "STOCKS · 3 - Sementeras", dato: "Pasturas por año de siembra", valor2425: "US$ 3.152,50", solapa: "Stock al inicio",
    evaluar: d => (d.hacienda?.stockInicio?.pasturas.length ?? 0) > 0 ? { estado: "sale", detalle: `${d.hacienda!.stockInicio!.pasturas.length} pasturas` } : { estado: "sin informacion", detalle: "falta «Traer stock y precios»" } },
  { papel: "STOCKS · 3 - Sementeras", dato: "Sementera de soja: el detalle (2 FC ACREN + 2 Moragues)", valor2425: "US$ 4.658,78", solapa: "3 Sementeras", pendiente: "A-FEAT-1420",
    evaluar: () => ({ estado: "pendiente desarrollo", detalle: "sólo está el total en la foto; falta vincular las 4 facturas como sementera de inicio" }) },
  { papel: "STOCKS · 3 - Sementeras", dato: "Sementeras al cierre", valor2425: "—", solapa: "3 Sementeras",
    evaluar: d => {
      const s = d.campo?.sementeras
      if (!s) return { estado: "sin informacion", detalle: "falta «Traer stock y precios»" }
      return s.faltan.length ? { estado: "sin informacion", detalle: s.faltan.join(" · ") } : { estado: "sale", detalle: `${s.ordenesEjecutadas} órdenes · ${pesos(s.costo)}` }
    } },
]

/**
 * 📄🗂️ **LA FUENTE Y EL LINK DE CADA DATO** — A-FEAT-1439 punto 3 (JMS 31/10: «siempre con la posibilidad de ver lo
 * objetivo, no sólo tu propuesta… y el link a ver» el dato en la app).
 *
 * - `inicio`: el dato es un saldo AL INICIO → su fuente objetiva ES el balance 24/25 presentado (los papeles del
 *   contador): ahí el valor 24/25 sí es la fuente, no una referencia.
 * - `esperada`: para lo del ejercicio o del cierre, qué documento lo respalda. Si no está cargado en la app, el
 *   recorrido lo dice («la fuente es…») en vez de callarse.
 * - `app`: la pantalla donde vive el dato (filtrada cuando la pantalla lo permite), si la regla no trajo un link propio.
 */
const SECCION = {
  facturas: { texto: "Egresos → Facturas MSA", href: "/?seccion=egresos&tab=facturas-msa" },
  templates: { texto: "Egresos → Templates", href: "/?seccion=egresos&tab=templates" },
  cobros: { texto: "Ingresos → Cobros", href: "/?seccion=ingresos&empresa=MSA&vista=cobros" },
  comprobantesVenta: { texto: "Ingresos → Comprobantes", href: "/?seccion=ingresos&empresa=MSA&vista=comprobantes" },
  productivo: { texto: "Productivo", href: "/?seccion=productivo" },
  extracto: (cuenta: string, texto: string) => ({ texto: `Extracto → ${texto}`, href: linkExtracto({ cuenta }) }),
}
const ANCLAS: Record<string, { inicio?: true; esperada?: string; app?: LinkDato[] }> = {
  "Banco Galicia (pesos)": { esperada: "el resumen del Banco Galicia al 30/06/2026" },
  "Banco Santander": { esperada: "el resumen del Banco Santander al 30/06/2026" },
  "Banco Provincia": { esperada: "el resumen del Banco Provincia al 30/06/2026" },
  "Caja": { esperada: "el arqueo (o la rendición) de la caja al 30/06/2026" },
  "Galicia cuenta USD": { esperada: "el resumen de la cuenta en dólares al 30/06/2026" },
  "Caja USD": { esperada: "el arqueo de la caja en dólares al 30/06/2026" },
  "Broker GSEC": { esperada: "el resumen del broker GSEC al 30/06/2026" },
  "FCI Galicia: saldo y resultado financiero": { esperada: "el resumen del fondo al 30/06/2025 y al 30/06/2026 (cuotapartes y valor de la cuotaparte)", app: [SECCION.extracto("msa_galicia", "Galicia (suscripciones y rescates)")] },
  "Movimientos de la cuenta USD y compra-venta con su TC": { esperada: "los boletos de compra-venta de moneda del banco" },
  "Deudores por ventas y cheques en cartera": { esperada: "lo presentado a ARCA (ventas) y el extracto (cobros)", app: [SECCION.cobros] },
  "Proveedores a pagar": { esperada: "la cuenta corriente o el saldo informado por cada proveedor al 30/06/2026", app: [SECCION.facturas] },
  "Tarjeta Visa a pagar": { esperada: "el resumen de la tarjeta con cierre más cercano al 30/06/2026", app: [SECCION.extracto("tarjeta_visa_business_msa", "VISA Business MSA")] },
  "Facturas JMS ($ 15 M) y AMS ($ 10,5 M) del 30/06/2025": { inicio: true, app: [SECCION.facturas] },
  "Cheques pendientes de débito al inicio (5 cheques)": { inicio: true, app: [{ texto: "Extracto Galicia, jul-ago 2025 (sus débitos)", href: linkExtracto({ cuenta: "msa_galicia", desde: "2025-07-01", hasta: "2025-08-31" }) }] },
  "Provisión del ejercicio anterior (PAM 2-31 + Magdalena 10-269)": { inicio: true },
  "«Pendiente de emitir por arrendamiento ganadero — Plácido Alberto Martínez»": { inicio: true },
  "Anticipo a Magdalena Martínez": { inicio: true, app: [SECCION.facturas] },
  "Inmobiliario (por partida)": { esperada: "las boletas de ARBA del ejercicio", app: [SECCION.templates] },
  "Red Vial (por partida)": { esperada: "las boletas de Red Vial del ejercicio", app: [SECCION.templates] },
  "Adelantos para el próximo balance (cuota 2/4, Red Vial Rojas)": { inicio: true, app: [SECCION.templates] },
  "Automotor por vehículo": { esperada: "las boletas de patente de cada vehículo", app: [SECCION.templates] },
  "Retiros directos y aportes de PAM": { esperada: "el extracto: las transferencias a los socios y desde PAM", app: [SECCION.extracto("msa_galicia", "Galicia")] },
  "Retiros indirectos: pagos a terceros, impuestos de PAM, Libertad 50/50, tarjetas": { esperada: "los comprobantes pagados por cuenta de cada socio", app: [SECCION.extracto("msa_galicia", "Galicia")] },
  "Cuenta socios por socio (MA, Manuel, Soledad, Mechi, Andrés, José, PAM)": { inicio: true },
  "Extracciones USD (devolución de aporte de PAM)": { inicio: true },
  "Cruce MSA ↔ PAM (el mismo movimiento visto de los dos lados)": { esperada: "los extractos de MSA y de PAM", app: [SECCION.extracto("msa_galicia", "Galicia MSA"), SECCION.extracto("pam_galicia", "Galicia PAM")] },
  "Galicia: gastos e impuestos bancarios por mes": { esperada: "el resumen del Banco Galicia (gastos e impuestos de cada mes)", app: [SECCION.extracto("msa_galicia", "Galicia")] },
  "Créditos pagados e intereses (descuento de cheques, saldo deudor)": { esperada: "el resumen del banco (intereses y descuentos)", app: [SECCION.extracto("msa_galicia", "Galicia")] },
  "Santander y Provincia por mes": { esperada: "los resúmenes de Santander y Provincia", app: [SECCION.extracto("msa_santander", "Santander")] },
  "Fondo fijo (caja)": { esperada: "las rendiciones de caja del ejercicio", app: [SECCION.extracto("caja_general", "Caja general")] },
  "Subdiarios de compras y ventas por mes y cuenta": { esperada: "lo presentado a ARCA (libro IVA de cada mes): ver el grupo «🧾 Contra lo presentado a ARCA»", app: [SECCION.facturas, SECCION.comprobantesVenta] },
  "Cabezas por categoría al inicio (balance · campo · SENASA)": { inicio: true, app: [SECCION.productivo] },
  "Kg, $/kg y $/cabeza por categoría al inicio": { inicio: true, app: [SECCION.productivo] },
  "Valuación al cierre por categoría": { esperada: "los precios de mercado al cierre (Cañuelas / MAG) y el conteo de campo", app: [SECCION.productivo] },
  "Cuadre: inicio ± movimientos = cierre": { esperada: "las existencias de SENASA y las actas de campo", app: [SECCION.productivo] },
  "Ganancia por tenencia de la hacienda": { esperada: "la valuación al inicio y al cierre de cada categoría", app: [SECCION.productivo] },
  "Soja al inicio y al cierre (cuadre de toneladas)": { inicio: true, app: [SECCION.productivo] },
  "Stock declarado al inicio, producto por producto": { inicio: true, app: [SECCION.productivo] },
  "Existencia valuada al cierre": { esperada: "el conteo físico de insumos al 30/06/2026", app: [SECCION.productivo] },
  "Compras y consumos de insumos del ejercicio": { esperada: "las facturas de compra y las órdenes de uso", app: [SECCION.productivo] },
  "Pasturas por año de siembra": { inicio: true, app: [SECCION.productivo] },
  "Sementera de soja: el detalle (2 FC ACREN + 2 Moragues)": { inicio: true, app: [SECCION.facturas] },
  "Sementeras al cierre": { esperada: "las órdenes agrícolas ejecutadas y sus facturas", app: [SECCION.productivo] },
}

/** Le pone a cada dato su fuente (o la que se espera) y su link a la app, sin pisar lo que trajo la regla. */
function anclar(i: ItemCobertura): ItemCobertura {
  const a = ANCLAS[i.dato]
  if (!a) return i
  const fuente = i.fuente ?? (a.inicio ? { origen: "Balance 24/25 presentado (papeles del contador)", detalle: `Lo declarado al 30/06/2025: ${i.valor2425}.` } : undefined)
  return { ...i, fuente, fuenteEsperada: fuente ? undefined : a.esperada, links: i.links?.length ? i.links : (a.app ?? i.links) }
}

/** Evalúa todo el catálogo. Una regla que tira error no tumba el resto: queda como «error» con el motivo. */
export function armarCobertura(d: DatosCobertura): CoberturaPapeles {
  const items: ItemCobertura[] = REGLAS.map(({ evaluar, ...r }) => {
    try { return anclar({ ...r, ...evaluar(d) }) }
    catch (e) { return anclar({ ...r, estado: "error" as EstadoCobertura, detalle: `no se pudo evaluar: ${(e as Error).message}` }) }
  })
  const cuenta = Object.fromEntries((Object.keys(ICONO) as EstadoCobertura[]).map(k => [k, 0])) as Record<EstadoCobertura, number>
  items.forEach(i => { cuenta[i.estado]++ })
  return { items, cuenta }
}

/** 🧮 El control del punto 3: los datos del catálogo que no tienen fuente ni link previstos (tiene que ser ninguno). */
export function datosSinAncla(): string[] {
  return REGLAS.map(r => r.dato).filter(d => !ANCLAS[d] && d !== "Equinos")
}

/** Cuántos renglones del catálogo hay (para el caso de prueba: que no se pierda ninguno en silencio). */
export const CANTIDAD_DE_DATOS = REGLAS.length

/** 🔗 Comprobantes del libro diario → links a donde viven: los del Histórico por un lado, los de ARCA por otro. */
function linksDeAsientos(as: AsientoLibroDiario[], texto: string): LinkDato[] {
  const hist = as.filter(a => a.fuente === "historico").map(a => a.id)
  const arca = as.filter(a => a.fuente === "arca").map(a => a.id)
  return [
    ...(hist.length ? [{ texto: `${texto}: ${hist.length} en Facturas → Histórico`, href: linkHistorico(hist) }] : []),
    ...(arca.length ? [{ texto: `${texto}: ${arca.length} en Facturas`, href: linkFacturas(arca) }] : []),
  ]
}
