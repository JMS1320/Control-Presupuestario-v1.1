/**
 * 🔢 CONTROL DE CUOTAS DE TEMPLATES — ¿cada template tiene las cuotas que tiene que tener en la campaña?
 *
 * Es el hermano de los proveedores fijos (A-FEAT-1332, `facturas-fijas.ts`): aquél cuenta FACTURAS de
 * los proveedores que facturan todos los meses; éste cuenta CUOTAS de los templates (impuestos, seguros,
 * servicios, tarjetas) — lo que no entra por subdiario y por eso se olvida sin que nada avise.
 *
 * ## 📌 De dónde sale la lista: la decisión de JMS del 28/10/2026
 *
 * El usuario revisó los 201 templates activos uno por uno (página «Control de cuotas», 28/10/2026) y
 * marcó cuáles se controlan, cuántas cuotas lleva cada uno y cuáles son «preview importante». Esa
 * decisión vive ACÁ, en código, en `CONTROL_CUOTAS_TEMPLATES`.
 *
 * ⏳ **Pendiente: pasarla a la base** (una columna o tabla editable desde la ficha del template, como
 * `proveedores.facturas_por_mes`). Hoy no se podía tocar la base; mientras tanto, cambiar una cantidad
 * es cambiar este archivo.
 *
 * 🔑 **La clave es empresa + nombre del template, NO el id.** Los templates se recrean cada año (otro
 * id, mismo nombre: «Inmobiliario Cuota Rojas» 2025 y 2026), así que una lista de ids no sobrevive a la
 * campaña siguiente. El nombre se normaliza (sin tildes, sin mayúsculas, sin puntuación) y **sin las
 * palabras «Anual» y «Cuota»**: así «Inmobiliario Anual Rojas» e «Inmobiliario Cuota Rojas» caen en el
 * mismo control, que es justamente lo que pide la regla 3.
 *
 * ## Las reglas (respuestas del usuario, 28/10/2026)
 *
 * 1. **Cantidad fija por campaña** — la mayoría: exactamente N cuotas. Menos = falta; más = sobra o duplicada.
 *    ABL siempre 12. Inmobiliarios rurales siempre 4. Luz / Internet / Teléfono Libertad (PAM) 12 cada uno.
 * 2. **Anual o en cuotas** — un impuesto con par «Anual» / «Cuota» (automotores, inmobiliario, ABL…):
 *    vale UN pago anual o TODAS las cuotas. Las dos cosas a la vez = «mixto», a revisar.
 *    Automotores Gol y Toyota: no se sabe cuántas cuotas → «a revisar» (no es error).
 * 3. **IIBB Mensual** — no son 12: por cada subdiario CON VENTAS se espera UN pago (cuota con importe)
 *    el mes SIGUIENTE. Es la misma regla que ya usa la app para proyectar el impuesto
 *    (`mesPagoIIBB` en `lib/arrendamientos/calculo.ts`, «se paga el mes siguiente») y la que pide
 *    A-FEAT-1367 para volcarlo solo al template. Un mes sin ventas no exige pago (su cuota en $0 está bien).
 * 4. **Seguro Flota (MSA)** — UNA sola flota aunque cambie el número de póliza: todos los
 *    «Seguro Flota — póliza …» cuentan juntos, 12 cuotas. Los demás seguros: regla a desarrollar
 *    (buscar los pagos en los extractos).
 * 5. **SICORE 1ª / 2ª quincena** — un pago por cada presentación. La 1ª quincena del mes M se paga en M;
 *    la 2ª, en M+1 (es como lo propone el cierre de quincena: «la primera cuota que vence después»).
 * 6. **Comisiones bancarias** (cuenta, caja de seguridad) — regla a desarrollar (una por cuenta y por mes).
 * 7. **Campaña**: MSA = ejercicio 1/7 → 30/6; PAM y MA = año calendario. Un template compartido
 *    («MSA/PAM», «PAM/MA/Duhau») se controla en la PRIMERA empresa nombrada.
 * 8. **Preview importante** — van primero.
 *
 * ## Qué cuota cuenta
 * - Las de TODOS los templates con ese nombre y esa empresa (activos o no: el de 2025 trae las cuotas
 *   de jul-dic 2025 del ejercicio 25/26 de MSA).
 * - **No** las `desactivado`: son la alternativa que no se usó (A-BUG-1289), no una cuota.
 * - El mes de una cuota es el de su **vencimiento** (o la estimada si no tiene; o el pago si no tiene
 *   ninguna). Es el período al que corresponde, no el día en que se pagó.
 * - En cantidad fija una cuota en $0 **cuenta** (está cargada) pero se avisa en el detalle. En IIBB y
 *   SICORE NO cuenta: ahí las cuotas en $0 existen para todos los meses y no dicen nada. Tampoco cuenta
 *   para decidir si un año se pagó anual o en cuotas: la forma que no se usó suele quedar en $0.
 *   ($1 se trata como $0: es el marcador de «importe a confirmar».)
 *
 * 🚦 **AVISA, no frena** (§ Un control que FRENA vs. uno que AVISA): una cuota de menos puede tener su
 * explicación (se pagó por otro lado). Lo que no se puede controlar se muestra como tal, no se calla.
 */
import { armarEjercicio } from "./ejercicio"

export type EmpresaControl = "MSA" | "PAM" | "MA"

export type ReglaCuotas =
  | { tipo: "fijo"; esperado: number }
  | { tipo: "ventas" }
  | { tipo: "sicore"; quincena: "1ra" | "2da" }
  | { tipo: "a-revisar"; motivo: string }
  | { tipo: "a-desarrollar"; motivo: string }

export interface TemplateControlado {
  empresa: EmpresaControl
  agrupadora: string
  /** Como lo ve el usuario. La clave del control sale de normalizarlo (ver `claveDeNombre`). */
  nombre: string
  regla: ReglaCuotas
  /** «Preview importante»: va primero y resaltado. */
  preview: boolean
  /** Toma todos los templates cuyo nombre EMPIEZA así («Seguro Flota — póliza …»). */
  prefijo?: boolean
  /** Lo que el usuario dijo, o por qué la regla es ésa. */
  nota?: string
  /**
   * `AAAA-MM`: el primer mes en que existe (la póliza o la cuenta empezó ahí). Antes no se espera nada, y
   * lo esperado es la parte proporcional (12 por año desde febrero → 11).
   */
  desde?: string
  /** Las cuotas cuyo `detalle` contiene esto (sin mayúsculas ni tildes) NO cuentan: son otra cosa cargada ahí. */
  excluirDetalle?: string
}

export type EstadoCuotas = "ok" | "falta" | "sobra" | "mixto" | "a revisar" | "a desarrollar"

export interface FilaControlCuotas {
  empresa: EmpresaControl
  agrupadora: string
  nombre: string
  /** La regla, en una frase. */
  regla: string
  /** null = no hay un número (a revisar / a desarrollar). */
  esperado: number | null
  encontrado: number
  /** Meses (`AAAA-MM`) con al menos una cuota que cuenta. */
  meses: string[]
  estado: EstadoCuotas
  preview: boolean
  /** Qué falta o qué sobra, en el idioma del usuario. */
  detalle: string
  /** Cuántos templates distintos aportaron cuotas (2 = el de un año y el del siguiente, o anual + cuota). */
  templates: number
  nota?: string
}

/** Una cuota tal como llega de `cuotas_egresos_sin_factura` + su template. */
export interface CuotaParaControl {
  egresoId: string
  /** `nombre_referencia` del template. */
  nombre: string
  /** `responsable` del template («MSA», «PAM/MA/Duhau»…). */
  responsable: string
  estado: string
  monto: number
  fecha_vencimiento: string | null
  fecha_estimada: string | null
  fecha_pago: string | null
  /** El `detalle` de la cuota («Comision Renovacion Tarjeta»…). */
  detalle?: string | null
  /** `grupo_pago_id`: las cuotas que se pagaron JUNTAS en un solo movimiento comparten grupo. */
  grupoPago?: string | null
}

/** Una quincena de SICORE con retenciones (es una presentación). */
export interface PresentacionSicore {
  /** `YY-MM - 1ra|2da`, como la escribe la app. */
  quincena: string
  total: number
  estado?: string
}

// ── La decisión del 28/10/2026 ───────────────────────────────────────────────────────────────

const fijo = (esperado: number): ReglaCuotas => ({ tipo: "fijo", esperado })
/**
 * 🏦 A-FEAT-1415 (29/10/2026), sacado de los extractos de 2025-2026:
 * - «COMISION SERVICIO DE CUENTA»: una por mes, el primer día hábil (MSA cta cte; PAM cta cte desde abr-26).
 * - «COM. CAJA DE SEGURIDAD»: TRIMESTRAL, en enero, abril, julio y octubre (MSA y PAM caja de ahorro).
 * - MA: su extracto no tiene ninguna comisión de cuenta en 2025-2026.
 * En el template de MSA también están cargadas comisiones de la TARJETA (renovación, mantenimiento mensual):
 * no son de la cuenta y no cuentan acá.
 */
const NOTA_SERVICIO = "1 por mes, el primer día hábil («COMISION SERVICIO DE CUENTA» del extracto)"
const NOTA_CAJA = "trimestral: enero, abril, julio y octubre («COM. CAJA DE SEGURIDAD» del extracto)"
/**
 * 🛡️ A-FEAT-1416 (29/10/2026), sacado de los débitos automáticos de Federación Patronal en el extracto:
 * - Accidentes personales: mensual. Cuando la póliza se renueva cambia el número — todas cuentan juntas, como
 *   la flota. MSA y MA arrancaron en feb-26; PAM viene de antes (9536537 → 10413411 en may-26).
 * - Vida colectivo (MSA): UN pago al año, en septiembre, cuando se renueva (670821 sep-25 · 698548 sep-26).
 * - Chalet: el usuario dijo «12 para cada póliza, que son 2» → 24 por año. MA tiene cuotas desde mar-26.
 */
const NOTA_AP = "mensual; todas las pólizas de AP juntas (al renovar cambia el número)"
const RURAL = (empresa: EmpresaControl, agrupadora: string, campos: string[], esperadoRedVial: Record<string, number> = {}) =>
  campos.flatMap(c => [
    { empresa, agrupadora, nombre: `Inmobiliario Cuota ${c}`, regla: fijo(4), preview: true },
    { empresa, agrupadora, nombre: `Red Vial Cuota ${c}`, regla: fijo(esperadoRedVial[c] ?? 4), preview: true },
  ] as TemplateControlado[])

/**
 * 📋 **Los templates que se controlan** — decisión de JMS del 28/10/2026 (pendiente pasarla a la base).
 * Los ids de referencia de esa revisión están en el comentario de cada bloque cuando ayudan.
 */
export const CONTROL_CUOTAS_TEMPLATES: TemplateControlado[] = [
  // ═══ MSA — ejercicio 1/7 → 30/6 ═══
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "IIBB Mensual MSA", regla: { tipo: "ventas" }, preview: true,
    nota: "«siempre que se emiten ventas en el mismo mes, corresponde el mes siguiente pagar 1 de estos»" },
  // SICORE 1ª: 19b879c7 (25/26) + 813f4f99 (26/27) · 2ª: 2f0f8552 + 517b0b44
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "SICORE 1er Quincena", regla: { tipo: "sicore", quincena: "1ra" }, preview: true,
    nota: "«de acuerdo a lo presentado SICORE, 1 pago por presentación»" },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "SICORE 2da Quincena", regla: { tipo: "sicore", quincena: "2da" }, preview: true,
    nota: "«de acuerdo a lo presentado SICORE, 1 pago por presentación»" },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "Acciones y Participaciones", regla: fijo(1), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "Anticipo Ganancias MSA", regla: fijo(10), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "Imp .Ganancias MSA", regla: fijo(1), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "Cargas Sociales", regla: fijo(12), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos General", nombre: "UATRE", regla: fijo(12), preview: true },
  { empresa: "MSA", agrupadora: "Honorarios", nombre: "Legalización Balance MSA", regla: fijo(1), preview: true },
  // Automotores: par Anual / Cuota. Tiguan y Voyage 12; Gol y Toyota sin número (el usuario no lo sabe).
  { empresa: "MSA", agrupadora: "Impuestos Automotores", nombre: "Imp Automotores Tiguan 2012", regla: fijo(12), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos Automotores", nombre: "Imp Automotores Voyage", regla: fijo(12), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos Automotores", nombre: "Imp Automotores Gol 2012",
    regla: { tipo: "a-revisar", motivo: "no se sabe cuántas cuotas lleva" }, preview: true },
  { empresa: "MSA", agrupadora: "Impuestos Automotores", nombre: "Imp Automotores Toyota 2015",
    regla: { tipo: "a-revisar", motivo: "no se sabe cuántas cuotas lleva" }, preview: true },
  ...RURAL("MSA", "Impuestos Rurales",
    ["Anexo", "Cholo 1", "Cholo 2", "Porteria Nuevo", "Porteria Viejo", "Rojas", "Sanchez", "Tango Parra 1", "Tango Parra 2", "Tango Prim Leboso"],
    { Rojas: 5 }),
  { empresa: "MSA", agrupadora: "Impuestos Rurales", nombre: "Inmobiliario Complementario Cuota MSA", regla: fijo(4), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos Urbanos", nombre: "Inmobiliario Cuota Lote Puerto", regla: fijo(4), preview: true },
  { empresa: "MSA", agrupadora: "Impuestos Urbanos", nombre: "Red Vial Cuota Lote Puerto", regla: fijo(4), preview: true },
  // Una sola flota aunque cambie la póliza (32436252 → 34160783 → 35881289).
  { empresa: "MSA", agrupadora: "Seguros", nombre: "Seguro Flota", prefijo: true, regla: fijo(12), preview: true,
    nota: "«solo un seguro por flota y 12 cuotas» — todas las pólizas de flota cuentan juntas" },
  { empresa: "MSA", agrupadora: "Seguros", nombre: "Seguro Vida Colectivo", prefijo: true, regla: fijo(1), preview: true,
    nota: "un pago al año, en septiembre, al renovar la póliza (670821 sep-25 · 698548 sep-26)" },
  { empresa: "MSA", agrupadora: "Seguros", nombre: "Seguro Accidentes Personales", prefijo: true, regla: fijo(12), preview: true,
    desde: "2026-02", nota: `${NOTA_AP} — la de MSA empezó en feb-26 (póliza 10183421)` },
  { empresa: "MSA", agrupadora: "Tarjetas", nombre: "Tarjeta Visa Business MSA", regla: fijo(12), preview: true },
  { empresa: "MSA", agrupadora: "Gastos Bancarios", nombre: "Comision Cuenta Bancaria", regla: fijo(12), preview: true,
    excluirDetalle: "tarjeta", nota: `${NOTA_SERVICIO} — no cuentan las de la tarjeta cargadas en este template` },
  { empresa: "MSA", agrupadora: "Gastos Bancarios", nombre: "Comision Caja de Seguridad", regla: fijo(4), preview: true, nota: NOTA_CAJA },

  // ═══ PAM — año calendario ═══
  { empresa: "PAM", agrupadora: "Impuestos General", nombre: "IIBB Mensual PAM", regla: { tipo: "ventas" }, preview: true },
  { empresa: "PAM", agrupadora: "Impuestos General", nombre: "Anticipo Ganancias / Bs Pers PAM", regla: fijo(5), preview: true },
  { empresa: "PAM", agrupadora: "Impuestos General", nombre: "Imp. Ganancias / Bs Pers PAM", regla: fijo(1), preview: true },
  { empresa: "PAM", agrupadora: "Fijos Buenos Aires General", nombre: "Expensas Posadas", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Fijos Buenos Aires MA", nombre: "ACA", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Fijos Buenos Aires MA", nombre: "Luz Libertad", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Fijos Buenos Aires MA", nombre: "Internet Libertad", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Fijos Buenos Aires MA", nombre: "Telefono Fijo 812", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Impuestos Buenos Aires General", nombre: "ABL Cochera Posadas", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Impuestos Buenos Aires MA", nombre: "ABL Cochera Libertad", regla: fijo(12), preview: true,
    nota: "template compartido «PAM/MA/Duhau»: se controla en PAM, la primera empresa nombrada" },
  ...RURAL("PAM", "Impuestos Rurales", ["Casco", "Entre Rios", "Ombu", "Tapera 1", "Tapera 2", "Tapera 3"]),
  { empresa: "PAM", agrupadora: "Impuestos Rurales", nombre: "Inmobiliario Complementario Cuota PAM", regla: fijo(4), preview: true },
  ...RURAL("PAM", "Impuestos Urbanos", ["Quinta Rosello 1", "Quinta Rosello 2"]),
  { empresa: "PAM", agrupadora: "Seguros", nombre: "Seguro Accidentes Personales", prefijo: true, regla: fijo(12), preview: true,
    nota: `${NOTA_AP} (9536537 → 10413411 en may-26)` },
  { empresa: "PAM", agrupadora: "Seguros", nombre: "Seguro Chalet", prefijo: true, regla: fijo(24), preview: true,
    nota: "el usuario dijo «12 para cada póliza, que son 2» — el template de PAM no tiene ninguna cuota cargada" },
  { empresa: "PAM", agrupadora: "Tarjetas", nombre: "Tarjeta VISA PAM", regla: fijo(12), preview: true },
  { empresa: "PAM", agrupadora: "Gastos Bancarios", nombre: "Comision Cuenta Bancaria", regla: fijo(12), preview: false,
    desde: "2026-04", nota: `${NOTA_SERVICIO} — la cta cte de PAM la cobra desde abr-26` },
  { empresa: "PAM", agrupadora: "Gastos Bancarios", nombre: "Comision Caja de Seguridad", regla: fijo(4), preview: false, nota: NOTA_CAJA },

  // ═══ MA — año calendario ═══
  { empresa: "MA", agrupadora: "Impuestos General", nombre: "IIBB Mensual MA", regla: { tipo: "ventas" }, preview: true,
    nota: "MA también factura (arrendamiento) y tiene ventas en la app: misma regla que MSA y PAM (A-FEAT-1367)" },
  { empresa: "MA", agrupadora: "Impuestos General", nombre: "Autonomos MA", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Impuestos General", nombre: "Aportes Domesticas", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Fijos Buenos Aires MA", nombre: "AYSA Libertad", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Fijos Buenos Aires MA", nombre: "Expensas Libertad", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Fijos Buenos Aires MA", nombre: "Metrogas Libertad", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Fijos SP", nombre: "Internet NZ", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Impuestos Buenos Aires MA", nombre: "ABL Libertad", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Impuestos Rurales", nombre: "Inmobiliario Cuota Lima", regla: fijo(4), preview: true },
  { empresa: "MA", agrupadora: "Impuestos Rurales", nombre: "Red Vial Lima Cuota", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Seguros", nombre: "Seguro Accidentes Personales", prefijo: true, regla: fijo(12), preview: true,
    desde: "2026-02", nota: `${NOTA_AP} — la de MA empezó en feb-26 (póliza 10200836)` },
  { empresa: "MA", agrupadora: "Seguros", nombre: "Seguro Chalet", prefijo: true, regla: fijo(24), preview: true,
    desde: "2026-03", nota: "el usuario puso 24 (dos pólizas): 2 cuotas por mes; las cuotas cargadas empiezan en mar-26" },
  { empresa: "MA", agrupadora: "Tarjetas", nombre: "Tarjeta VISA MA", regla: fijo(12), preview: true },
  { empresa: "MA", agrupadora: "Gastos Bancarios", nombre: "Comision Cuenta Bancaria", preview: false,
    regla: { tipo: "a-revisar", motivo: "el extracto de MA no tiene comisión de cuenta en 2025-2026: ¿no la cobra?" } },
]

// ── Utilidades ──────────────────────────────────────────────────────────────────────────────

const palabras = (s: string): string[] => (s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)

/** La clave de un nombre: sin tildes, mayúsculas ni puntuación, y sin «anual» / «cuota». */
export const claveDeNombre = (s: string): string =>
  palabras(s).filter(w => w !== "anual" && w !== "cuota").join(" ")

/** ¿Es el template «Anual» del par? */
export const esAnual = (nombre: string): boolean => palabras(nombre).includes("anual")

/** La empresa que controla un template: la PRIMERA nombrada en el responsable («PAM/MA/Duhau» → PAM). */
export const empresaDelResponsable = (responsable: string): string =>
  (responsable || "").split("/")[0].trim().toUpperCase()

/** El mes al que corresponde una cuota: vencimiento, si no estimada, si no pago. */
export const mesDeCuota = (c: Pick<CuotaParaControl, "fecha_vencimiento" | "fecha_estimada" | "fecha_pago">): string =>
  (c.fecha_vencimiento || c.fecha_estimada || c.fecha_pago || "").slice(0, 7)

export const mesSiguiente = (m: string): string => {
  const [a, mm] = m.split("-").map(Number)
  return mm === 12 ? `${a + 1}-01` : `${a}-${String(mm + 1).padStart(2, "0")}`
}

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const nombreMesCorto = (m: string) => `${MES_CORTO[Number(m.slice(5, 7)) - 1] ?? "?"}-${m.slice(2, 4)}`
const lista = (ms: string[]) => ms.map(nombreMesCorto).join(", ")

/**
 * 📅 La campaña que se controla: MSA = ejercicio que cierra el 30/06 de `anio`; PAM y MA = el año
 * calendario `anio`. Son los mismos 12 meses que los papeles del balance de esa empresa.
 */
export function campaniaDelControl(empresa: string, anio: number): { meses: string[]; etiqueta: string } {
  const mesCierre = empresa === "MSA" ? 6 : 12
  const ej = armarEjercicio(anio, mesCierre)
  const meses = ej.subdiarios.map(s => `${s.anio}-${String(s.mes).padStart(2, "0")}`)
  const desde = `${meses[0].slice(5)}/${meses[0].slice(0, 4)}`
  const hasta = `${meses[11].slice(5)}/${meses[11].slice(0, 4)}`
  return {
    meses,
    etiqueta: mesCierre === 12 ? `año calendario ${anio} (${desde}–${hasta})` : `ejercicio ${ej.etiqueta} (${desde}–${hasta})`,
  }
}

const ESTADO_EXCLUIDO = "desactivado"
/**
 * ¿La cuota tiene importe? $0 y $1 son marcadores («todavía no se sabe»: las cuotas pendientes de
 * IIBB de MA están en $1,00), no un pago.
 */
const conImporte = (c: CuotaParaControl) => Math.abs(c.monto) > 1
/**
 * 🔑 ¿Se usó el pago ANUAL? JMS 29/10 (A-FEAT-1422 nota 11): *«si es anual buscar sólo una»*. Con importe, o
 * CONCILIADO / PAGADO aunque esté en $0 (Tiguan 2026: el anual está conciliado con el importe sin cargar). Una
 * cuota en $0 conciliada no cuenta así: es la forma que no se usó.
 */
const anualUsado = (c: CuotaParaControl) => conImporte(c) || /^(pagad|concilia)/i.test((c.estado || "").trim())

function textoRegla(t: TemplateControlado): string {
  const r = t.regla
  switch (r.tipo) {
    case "fijo": return `${r.esperado} por campaña`
    case "ventas": return "1 por mes con ventas (se paga el mes siguiente)"
    case "sicore": return `1 por presentación de la ${r.quincena} quincena`
    case "a-revisar": return `a revisar: ${r.motivo}`
    case "a-desarrollar": return `regla a desarrollar: ${r.motivo}`
  }
}

// ── El control ──────────────────────────────────────────────────────────────────────────────

export interface EntradaControlCuotas {
  empresa: string
  /** Los 12 meses de la campaña (`AAAA-MM`), en orden. Ver `campaniaDelControl`. */
  meses: string[]
  /** Todas las cuotas que se tengan (de más está bien: se filtra acá). */
  cuotas: CuotaParaControl[]
  /** Subdiarios (`AAAA-MM`) con al menos una venta. `null` = no se pudieron leer. */
  subdiariosConVentas?: string[] | null
  /** Las quincenas de SICORE con retenciones. `null`/ausente = no se pudieron leer. */
  presentacionesSicore?: PresentacionSicore[] | null
  /** `AAAA-MM-DD`. Un pago que vence este mes o después todavía no falta. */
  hoy?: string
  config?: TemplateControlado[]
}

export function controlarCuotasTemplates(e: EntradaControlCuotas): FilaControlCuotas[] {
  const config = (e.config ?? CONTROL_CUOTAS_TEMPLATES).filter(t => t.empresa === e.empresa)
  const enCampania = new Set(e.meses)
  const mesHoy = (e.hoy ?? "9999-12").slice(0, 7)
  const deLaEmpresa = e.cuotas.filter(c =>
    empresaDelResponsable(c.responsable) === e.empresa && (c.estado || "").toLowerCase() !== ESTADO_EXCLUIDO)

  const filas = config.map((t): FilaControlCuotas => {
    const clave = claveDeNombre(t.nombre)
    const suyas = deLaEmpresa.filter(c => {
      const k = claveDeNombre(c.nombre)
      return t.prefijo ? (k === clave || k.startsWith(clave + " ")) : k === clave
    })
    const base = {
      empresa: t.empresa, agrupadora: t.agrupadora, nombre: t.nombre, regla: textoRegla(t),
      preview: t.preview, nota: t.nota,
    }
    switch (t.regla.tipo) {
      case "ventas": return { ...base, ...porVentas(suyas, e.meses, e.subdiariosConVentas ?? null, mesHoy) }
      case "sicore": return { ...base, ...porSicore(suyas, e.meses, t.regla.quincena, e.presentacionesSicore ?? null, mesHoy) }
      default: break
    }
    // Cantidad (fija, a revisar o a desarrollar): las cuotas de la campaña, desde que existe.
    const mesesQueCuentan = t.desde ? e.meses.filter(m => m >= t.desde!) : e.meses
    const excluir = t.excluirDetalle ? claveDeNombre(t.excluirDetalle) : null
    const excluidas = excluir
      ? suyas.filter(c => enCampania.has(mesDeCuota(c)) && claveDeNombre(c.detalle ?? "").includes(excluir)) : []
    const delPeriodo = suyas.filter(c => enCampania.has(mesDeCuota(c)) && !excluidas.includes(c))
    const templates = new Set(delPeriodo.map(c => c.egresoId)).size
    if (t.regla.tipo === "a-desarrollar") {
      return { ...base, esperado: null, encontrado: delPeriodo.length, meses: [...new Set(delPeriodo.map(mesDeCuota))].sort(),
        templates, estado: "a desarrollar", detalle: `${delPeriodo.length} cuota(s) en la campaña — no se controla todavía` }
    }
    // Desde que existe: lo esperado es la parte proporcional (24 por año desde marzo → 20).
    const esperado = t.regla.tipo === "fijo"
      ? Math.round(t.regla.esperado * mesesQueCuentan.length / e.meses.length) : null
    const fila = porCantidad(delPeriodo, mesesQueCuentan, esperado)
    const extras = [
      t.desde && mesesQueCuentan.length < e.meses.length ? `existe desde ${nombreMesCorto(t.desde)}` : "",
      excluidas.length ? `${excluidas.length} de «${t.excluirDetalle}» no cuentan` : "",
    ].filter(Boolean)
    return { ...base, ...fila, detalle: [fila.detalle, ...extras].join(" · "), templates }
  })

  return ordenar(filas)
}

/**
 * 🔢 Cantidad fija, aceptando **anual O cuotas** cuando el template tiene el par.
 *
 * 🔑 Se decide **por año calendario** (el año del impuesto), no por campaña: el ejercicio 25/26 de MSA
 * toca dos años y es legítimo pagar 2025 en cuotas y 2026 anual (Voyage). «Mixto» es sólo pagar el
 * mismo año de las dos formas.
 * 🔑 La alternativa que no se usó suele quedar con sus cuotas **en $0** (no desactivadas): una cuota sin
 * importe no cuenta como «se eligió esta forma». Si en la campaña conviven años anuales y años en cuotas,
 * lo esperado de los años en cuotas es la parte proporcional (12 por año → 6 en medio año).
 */
function porCantidad(delPeriodo: CuotaParaControl[], mesesCampania: string[], esperado: number | null) {
  const anios = [...new Set(mesesCampania.map(m => m.slice(0, 4)))]
  const delAnio = (y: string) => delPeriodo.filter(c => mesDeCuota(c).startsWith(y))
  const formas = anios.map(y => {
    const anualCon = delAnio(y).filter(c => esAnual(c.nombre) && anualUsado(c))
    const cuotasCon = delAnio(y).filter(c => !esAnual(c.nombre) && conImporte(c))
    const forma = anualCon.length && cuotasCon.length ? "mixto" : anualCon.length ? "anual" : "cuotas"
    return { y, forma, anuales: anualCon.length, cuotasCon: cuotasCon.length, meses: mesesCampania.filter(m => m.startsWith(y)) }
  })
  // En los años en cuotas, el pago anual en $0 (la forma que no se usó) no es una cuota.
  const cuotas = delPeriodo.filter(c => !esAnual(c.nombre) && formas.find(f => mesDeCuota(c).startsWith(f.y))?.forma === "cuotas")
  const meses = [...new Set(delPeriodo.filter(c => anualUsado(c) || !esAnual(c.nombre)).map(mesDeCuota))].sort()

  const avisos: string[] = []
  const sinImporte = cuotas.filter(c => !conImporte(c)).length
  if (sinImporte) avisos.push(`${sinImporte} sin importe ($0)`)
  const porMes = new Map<string, number>()
  for (const c of cuotas) porMes.set(mesDeCuota(c), (porMes.get(mesDeCuota(c)) ?? 0) + 1)
  // Más de una por mes es raro… salvo que la regla lleve varias (Chalet: 2 pólizas → 2 por mes).
  const porMesNormal = esperado != null && mesesCampania.length ? Math.max(1, Math.round(esperado / mesesCampania.length)) : 1
  const repetidos = [...porMes].filter(([, n]) => n > porMesNormal).map(([m, n]) => `${nombreMesCorto(m)} (${n})`)
  if (repetidos.length) avisos.push(`mes con más de una: ${repetidos.join(", ")}`)
  // 👀 «Siempre ver el par» (nota 11): si el template tiene anual Y cuotas, se dice qué se usó de cada uno.
  const anualesDelPar = delPeriodo.filter(c => esAnual(c.nombre))
  const cuotasDelPar = delPeriodo.filter(c => !esAnual(c.nombre))
  if (anualesDelPar.length && cuotasDelPar.length) {
    avisos.push(`par: anual ${anualesDelPar.filter(anualUsado).length} usado(s) de ${anualesDelPar.length} · cuotas ${cuotasDelPar.filter(conImporte).length} con importe de ${cuotasDelPar.length}`)
  }
  // 📦 «Cuotas agrupadas en un solo pago» (nota 11): las del mismo grupo de pago, y la que vale varias cuotas juntas.
  const grupos = new Map<string, CuotaParaControl[]>()
  for (const c of delPeriodo) if (c.grupoPago) grupos.set(c.grupoPago, [...(grupos.get(c.grupoPago) ?? []), c])
  const juntas = [...grupos.values()].filter(g => g.length > 1)
  if (juntas.length) avisos.push(`pagadas juntas en un solo pago: ${juntas.map(g => `${g.length} (${lista([...new Set(g.map(mesDeCuota))].sort())})`).join(", ")}`)
  const importes = cuotas.filter(conImporte).map(c => Math.abs(c.monto)).sort((a, b) => a - b)
  const tipica = importes.length >= 3 ? importes[Math.floor(importes.length / 2)] : 0
  const multiples = tipica ? cuotas.filter(c => Math.abs(c.monto) >= 1.8 * tipica) : []
  if (multiples.length) avisos.push(`importe de varias cuotas (¿pago agrupado o un mes más caro, p. ej. aguinaldo?): ${multiples.map(c => `${nombreMesCorto(mesDeCuota(c))} ×${Math.round(Math.abs(c.monto) / tipica)}`).join(", ")}`)
  const sufijo = () => (avisos.length ? ` · ${avisos.join(" · ")}` : "")

  const mixtos = formas.filter(f => f.forma === "mixto")
  if (mixtos.length) {
    return { esperado, encontrado: delPeriodo.length, meses, estado: "mixto" as EstadoCuotas,
      detalle: mixtos.map(f => `${f.y}: pago anual (${f.anuales}) Y cuotas con importe (${f.cuotasCon}) a la vez — ¿se pagó dos veces?`).join(" · ") + sufijo() }
  }
  const anuales = formas.filter(f => f.forma === "anual")
  const anualesMal = anuales.filter(f => f.anuales > 1)
  const textoAnual = anuales.map(f => `${f.y} pagado anual${f.anuales > 1 ? ` ${f.anuales} veces` : ""}`)
  const enCuotas = formas.filter(f => f.forma === "cuotas")
  const mesesEnCuotas = enCuotas.flatMap(f => f.meses)
  // Todo anual: no hay cuotas que contar.
  if (anuales.length && !mesesEnCuotas.length) {
    return { esperado, encontrado: anuales.reduce((s, f) => s + f.anuales, 0), meses,
      estado: (anualesMal.length ? "sobra" : "ok") as EstadoCuotas, detalle: textoAnual.join(" · ") + sufijo() }
  }
  const hay = cuotas.length
  const esperadoCuotas = esperado == null ? null
    : anuales.length ? Math.round(esperado * mesesEnCuotas.length / mesesCampania.length) : esperado
  const prefijo = anuales.length ? `${textoAnual.join(" · ")} · ${enCuotas.map(f => f.y).join("/")} en cuotas: ` : ""
  if (esperadoCuotas == null) {
    return { esperado, encontrado: hay, meses, estado: "a revisar" as EstadoCuotas,
      detalle: `${prefijo}${hay} cuota(s)${hay ? `: ${lista([...porMes.keys()].sort())}` : ""} — falta saber cuántas lleva${sufijo()}` }
  }
  let estado: EstadoCuotas = hay < esperadoCuotas ? "falta" : hay > esperadoCuotas ? "sobra" : "ok"
  if (estado === "ok" && anualesMal.length) estado = "sobra"
  let detalle = `${prefijo}${hay} de ${esperadoCuotas}${anuales.length ? " (proporcional)" : ""}`
  const sin = mesesEnCuotas.filter(m => !porMes.has(m))
  if (esperadoCuotas === mesesEnCuotas.length) {
    if (sin.length) detalle += ` · sin cuota: ${lista(sin)}`
  } else if (hay !== esperadoCuotas && hay > 0) {
    detalle += ` · cuotas en: ${lista([...porMes.keys()].sort())}`
  }
  return { esperado, encontrado: hay, meses, estado, detalle: detalle + sufijo() }
}

/**
 * 🧾 IIBB Mensual: por cada subdiario de la campaña con ventas, un pago (cuota con importe) el mes
 * siguiente. Una cuota con importe el mes siguiente a un subdiario SIN ventas se señala (puede ser un
 * cobro de otro mes, o un error de carga).
 */
function porVentas(suyas: CuotaParaControl[], meses: string[], conVentas: string[] | null, mesHoy: string) {
  const templates = new Set(suyas.map(c => c.egresoId)).size
  if (conVentas == null) {
    return { esperado: null, encontrado: 0, meses: [] as string[], templates, estado: "a revisar" as EstadoCuotas,
      detalle: "no se pudieron leer las ventas: no se puede controlar" }
  }
  const ventas = new Set(conVentas)
  const pagos = suyas.filter(conImporte)
  const pagosEn = (m: string) => pagos.filter(c => mesDeCuota(c) === m).length
  const faltan: string[] = [], porVencer: string[] = [], dobles: string[] = [], sinVentas: string[] = []
  const pagados: string[] = []
  let esperado = 0
  for (const m of meses) {
    const pago = mesSiguiente(m)
    const n = pagosEn(pago)
    if (ventas.has(m)) {
      if (n === 0 && pago >= mesHoy) { porVencer.push(m); continue }
      esperado++
      if (n === 0) faltan.push(m)
      else { pagados.push(pago); if (n > 1) dobles.push(`${nombreMesCorto(pago)} (${n})`) }
    } else if (n > 0) {
      sinVentas.push(pago)
    }
  }
  const partes = [`${pagados.length} de ${esperado} mes(es) con ventas pagados`]
  if (faltan.length) partes.push(`ventas sin pago al mes siguiente: ${lista(faltan)}`)
  if (dobles.length) partes.push(`más de un pago: ${dobles.join(", ")}`)
  if (sinVentas.length) partes.push(`pago sin ventas el mes anterior: ${lista(sinVentas)}`)
  if (porVencer.length) partes.push(`todavía no vence: ventas de ${lista(porVencer)}`)
  if (esperado === 0 && !porVencer.length && !sinVentas.length) partes.splice(0, 1, "sin ventas en la campaña: no se espera ningún pago")
  const estado: EstadoCuotas = faltan.length ? "falta" : (dobles.length || sinVentas.length) ? "sobra" : "ok"
  return { esperado, encontrado: pagados.length, meses: pagados.sort(), templates, estado, detalle: partes.join(" · ") }
}

/**
 * 🧾 SICORE: por cada presentación (quincena con retenciones) de la campaña, un pago con importe. La
 * 1ª quincena del mes M se paga en M; la 2ª, en M+1. Antes de la primera quincena registrada en la app
 * no hay presentaciones contra qué comparar: esos meses no se controlan, y se dice.
 */
function porSicore(suyas: CuotaParaControl[], meses: string[], q: "1ra" | "2da", presentaciones: PresentacionSicore[] | null, mesHoy: string) {
  const templates = new Set(suyas.map(c => c.egresoId)).size
  if (presentaciones == null) {
    return { esperado: null, encontrado: 0, meses: [] as string[], templates, estado: "a revisar" as EstadoCuotas,
      detalle: "no se pudieron leer las presentaciones de SICORE: no se puede controlar" }
  }
  /** `26-03 - 1ra` → `2026-03`. */
  const mesDeQuincena = (x: string) => `20${x.slice(0, 2)}-${x.slice(3, 5)}`
  const conDatos = presentaciones.filter(p => p.total > 0)
  const desde = conDatos.map(p => mesDeQuincena(p.quincena)).sort()[0]
  const deEsta = new Map(conDatos.filter(p => p.quincena.endsWith(q)).map(p => [mesDeQuincena(p.quincena), p]))
  const pagos = suyas.filter(conImporte)
  const pagoDe = (m: string) => (q === "1ra" ? m : mesSiguiente(m))
  const faltan: string[] = [], porVencer: string[] = [], dobles: string[] = [], sinPresentacion: string[] = []
  const distinto: string[] = [], pagados: string[] = [], sinControlar: string[] = []
  let esperado = 0
  for (const m of meses) {
    const pm = pagoDe(m)
    const enPago = pagos.filter(c => mesDeCuota(c) === pm)
    if (!desde || m < desde) { if (enPago.length) sinControlar.push(m); continue }
    const p = deEsta.get(m)
    if (p) {
      if (enPago.length === 0 && pm >= mesHoy) { porVencer.push(m); continue }
      esperado++
      if (enPago.length === 0) { faltan.push(m); continue }
      pagados.push(pm)
      if (enPago.length > 1) dobles.push(`${nombreMesCorto(pm)} (${enPago.length})`)
      const pagado = enPago.reduce((s, c) => s + c.monto, 0)
      if (Math.abs(pagado - p.total) > 1) distinto.push(`${nombreMesCorto(m)}: presentado ${fmt(p.total)}, pagado ${fmt(pagado)}`)
    } else if (enPago.length) {
      sinPresentacion.push(m)
    }
  }
  const partes = [`${pagados.length} de ${esperado} presentación(es) con su pago`]
  if (faltan.length) partes.push(`presentación sin pago: ${lista(faltan)}`)
  if (dobles.length) partes.push(`más de un pago: ${dobles.join(", ")}`)
  if (sinPresentacion.length) partes.push(`pago sin presentación: ${lista(sinPresentacion)}`)
  if (distinto.length) partes.push(`importe distinto (aviso): ${distinto.join("; ")}`)
  if (porVencer.length) partes.push(`todavía no vence: ${lista(porVencer)}`)
  if (sinControlar.length) partes.push(`${sinControlar.length} pago(s) anteriores a las presentaciones cargadas en la app (${lista(sinControlar)}): no se controlan`)
  const estado: EstadoCuotas = faltan.length ? "falta" : (dobles.length || sinPresentacion.length) ? "sobra" : "ok"
  return { esperado, encontrado: pagados.length, meses: pagados.sort(), templates, estado, detalle: partes.join(" · ") }
}

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ORDEN_ESTADO: EstadoCuotas[] = ["falta", "sobra", "mixto", "a revisar", "ok", "a desarrollar"]

/** Preview importante primero; adentro, lo que está mal antes que lo que está bien. */
function ordenar(filas: FilaControlCuotas[]): FilaControlCuotas[] {
  return [...filas].sort((a, b) =>
    Number(b.preview) - Number(a.preview)
    || ORDEN_ESTADO.indexOf(a.estado) - ORDEN_ESTADO.indexOf(b.estado)
    || a.agrupadora.localeCompare(b.agrupadora, "es")
    || a.nombre.localeCompare(b.nombre, "es"))
}

/** Cuántas filas hay en cada estado, en el orden de `ORDEN_ESTADO`. */
export function resumenControlCuotas(filas: FilaControlCuotas[]): Array<{ estado: EstadoCuotas; cantidad: number }> {
  return ORDEN_ESTADO.map(estado => ({ estado, cantidad: filas.filter(f => f.estado === estado).length }))
    .filter(x => x.cantidad > 0)
}

/** Las que piden mirar: falta, sobra o mixto. */
export const conProblema = (f: FilaControlCuotas) => f.estado === "falta" || f.estado === "sobra" || f.estado === "mixto"

/** Lo que el armado de la pantalla y del Excel necesita de vuelta. */
export interface ControlCuotasTemplates {
  empresa: string
  /** Cómo se llama la campaña controlada: «ejercicio 25/26 (07/2025–06/2026)», «año calendario 2026 (…)». */
  campania: string
  filas: FilaControlCuotas[]
}

/** Arma el control completo de una empresa y un año (el de cierre del balance). */
export function armarControlCuotas(
  empresa: string, anio: number,
  datos: Omit<EntradaControlCuotas, "empresa" | "meses">,
): ControlCuotasTemplates {
  const c = campaniaDelControl(empresa, anio)
  return { empresa, campania: c.etiqueta, filas: controlarCuotasTemplates({ ...datos, empresa, meses: c.meses }) }
}

// ── Lectura: de las filas de la base a lo que el control necesita (pantalla y script usan lo mismo) ──

/** Fila cruda de `cuotas_egresos_sin_factura` con su template embebido en `egreso`. */
export function cuotaParaControlDesde(f: Record<string, unknown>): CuotaParaControl {
  const e = (f.egreso ?? {}) as Record<string, unknown>
  const fecha = (v: unknown) => (v ? String(v).slice(0, 10) : null)
  return {
    egresoId: String(f.egreso_id ?? ""),
    nombre: String(e.nombre_referencia ?? ""),
    responsable: String(e.responsable ?? ""),
    estado: String(f.estado ?? ""),
    monto: Number(f.monto ?? 0) || 0,
    fecha_vencimiento: fecha(f.fecha_vencimiento),
    fecha_estimada: fecha(f.fecha_estimada),
    fecha_pago: fecha(f.fecha_pago),
    detalle: f.detalle == null ? null : String(f.detalle),
    grupoPago: f.grupo_pago_id ? String(f.grupo_pago_id) : null,
  }
}

/** Los subdiarios (`AAAA-MM`) con ventas, de las filas de `<empresa>.comprobantes_venta`. */
export function subdiariosConVentasDesde(filas: Array<Record<string, unknown>>): string[] {
  return [...new Set(filas
    .filter(v => v["año_contable"] && v.mes_contable)
    .map(v => `${v["año_contable"]}-${String(v.mes_contable).padStart(2, "0")}`))].sort()
}

/**
 * Las presentaciones de SICORE, de las filas de `msa.sicore_retenciones` (quincena, retencion,
 * estado_quincena): una por quincena, con el total retenido y el estado más avanzado.
 */
export function presentacionesSicoreDesde(filas: Array<Record<string, unknown>>): PresentacionSicore[] {
  const por = new Map<string, PresentacionSicore>()
  for (const x of filas) {
    const q = x.quincena ? String(x.quincena) : ""
    if (!q) continue
    const p = por.get(q) ?? { quincena: q, total: 0, estado: "abierta" }
    p.total += Number(x.retencion ?? 0) || 0
    const est = String(x.estado_quincena ?? "")
    if (est === "declarada" || (est === "cerrada" && p.estado === "abierta")) p.estado = est
    por.set(q, p)
  }
  return [...por.values()]
}
