/**
 * 🔗 **PAGOS DE SUELDO ATADOS AL MOVIMIENTO DE OTRA PERSONA** — A-BUG-1486 (JMS 01/11: *«esto debo verlo en el recorrido»*).
 *
 * El mismo dato llega por dos caminos: el CUIL del empleado en Sueldos y el CUIT que informa el banco en la transferencia.
 * Si un movimiento está conciliado contra el pago de sueldo de X pero el banco dice que la plata fue a una PERSONA distinta,
 * algo está mal atado. Salió al buscar de dónde venía el CUIL equivocado de Alondra (era el de Mabel): el 29/05 su pago
 * estaba atado al anticipo de Sigot por caja.
 *
 * - Sólo se compara cuando el banco informa una PERSONA (CUIT 20/23/24/27). Si informa un organismo (30/33/34: el Juzgado
 *   de Paz de la cuota alimentaria de Sigot), es un pago a un tercero por cuenta del empleado y está bien.
 * - Los movimientos conciliados no generan tema de conciliación: por eso este control es una fuente propia del recorrido.
 * - El recorrido propone y lleva: los links abren el movimiento y las tiras de sueldos; el arreglo se hace con el OK de JMS.
 */
import type { CuentaConciliable } from "@/lib/conciliacion/propuestas-ejercicio"
import { CUENTAS_CONCILIABLES } from "@/lib/conciliacion/propuestas-ejercicio"
import { linkExtracto, rangoQueContiene } from "@/lib/extracto/link"
import { linkSueldosDe } from "@/lib/sueldos/link"
import type { LinkDato } from "./cobertura-papeles"
import type { Tema } from "./recorrido"

const dmy = (f?: string | null) => (f ? f.slice(0, 10).split("-").reverse().join("/") : "")
const plata = (x: number) => `$ ${x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const cuitDe = (x: unknown) => String(x ?? "").replace(/\D/g, "")
const MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
/** Persona humana: 20, 23, 24, 27. Lo demás (30, 33, 34) es una sociedad u organismo. */
export const esPersona = (cuit: string) => /^(20|23|24|27)\d{9}$/.test(cuit)

export interface MovAtado { cuenta: Pick<CuentaConciliable, "cuentaId" | "nombre">; id: string; fecha: string; importe: number; quienBanco?: string; cuitBanco: string; detalle?: string; estado: string; pagoId: string }
export interface PagoSueldo { id: string; empleadoId: string; fecha: string; monto: number; medio?: string | null; tipo?: string | null; mes?: number | null; anio?: number | null }
export interface EmpleadoSueldo { id: string; nombre: string; cuit: string }

const diasEntre = (a: string, b: string) => Math.abs((Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000)
const periodo = (p: PagoSueldo) => (p.mes && p.anio ? `${MESES[p.mes]} ${p.anio}` : dmy(p.fecha))
const medioTexto = (m?: string | null) => (!m || m === "banco" ? "por banco" : `por ${m.replace(/_/g, " ")}`)

/**
 * Los temas: uno por movimiento mal atado. `todosLosAtados` = todos los movimientos con pago de sueldo (de cualquier
 * fecha), para saber qué pagos ya tienen movimiento; `pagos` = todos los pagos de sueldo que hagan falta (los atados y los
 * candidatos).
 */
export function temasSueldoOtraPersona(atados: MovAtado[], todosLosAtados: MovAtado[], pagos: PagoSueldo[], empleados: EmpleadoSueldo[]): Tema[] {
  const pagoPorId = new Map(pagos.map(p => [p.id, p]))
  const empPorId = new Map(empleados.map(e => [e.id, e]))
  const movsDelPago = new Map<string, MovAtado[]>()
  for (const m of todosLosAtados) movsDelPago.set(m.pagoId, [...(movsDelPago.get(m.pagoId) ?? []), m])
  const temas: Tema[] = []
  for (const m of atados) {
    if (!esPersona(m.cuitBanco)) continue
    const pago = pagoPorId.get(m.pagoId)
    const emp = pago ? empPorId.get(pago.empleadoId) : undefined
    if (!pago || !emp || cuitDe(emp.cuit) === m.cuitBanco) continue
    const quien = m.quienBanco?.trim() || "otra persona"
    const otroEmp = empleados.find(e => e.id !== emp.id && cuitDe(e.cuit) === m.cuitBanco)
    // el pago del otro empleado que este movimiento debería tener: mismo importe, ±3 días, sin movimiento
    const candidato = otroEmp && pagos.find(p => p.empleadoId === otroEmp.id && Math.abs(p.monto - m.importe) < 0.01 && diasEntre(p.fecha, m.fecha) <= 3 && !(movsDelPago.get(p.id)?.length))
    const otrosMovs = (movsDelPago.get(pago.id) ?? []).filter(x => x.id !== m.id)
    const links: LinkDato[] = [
      { texto: `El movimiento en el extracto (${m.cuenta.nombre}, ${dmy(m.fecha)})`, href: linkExtracto({ cuenta: m.cuenta.cuentaId, movs: [m.id], ...rangoQueContiene([m.fecha]) }) },
      { texto: `📜 Los sueldos de ${emp.nombre} (toda la tira) — a quien está atado hoy`, href: linkSueldosDe(emp.id) },
      ...(otroEmp ? [{ texto: `📜 Los sueldos de ${otroEmp.nombre} (toda la tira) — a quien fue la plata según el banco`, href: linkSueldosDe(otroEmp.id) }] : []),
      ...otrosMovs.map(x => ({ texto: `El otro movimiento atado al mismo pago (${x.cuenta.nombre}, ${dmy(x.fecha)}, ${plata(x.importe)})`, href: linkExtracto({ cuenta: x.cuenta.cuentaId, movs: [x.id], ...rangoQueContiene([x.fecha]) }) })),
    ]
    let propuesta: string, etiqueta: string
    if (candidato) {
      etiqueta = "Atado al empleado equivocado"
      propuesta = `Pasarlo al pago de ${otroEmp!.nombre} del ${dmy(candidato.fecha)} (${plata(candidato.monto)}, ${periodo(candidato)}), que hoy no tiene movimiento. El de ${emp.nombre} (${medioTexto(pago.medio)}) queda sin movimiento${pago.medio && pago.medio !== "banco" ? ", como corresponde a un pago que no salió del banco" : ""}. Si te cierra, «👍 Está bien así» y lo arreglo con un script con su deshacer.`
    } else if (otrosMovs.length) {
      etiqueta = "Dos movimientos, un solo pago"
      propuesta = `El pago de ${emp.nombre} (${periodo(pago)}, ${plata(pago.monto)}) ya tiene su propio movimiento${otrosMovs.length > 1 ? "s" : ""} a su nombre: éste a ${quien} no es de ese pago. Decime qué es (${m.detalle ? `tu detalle dice «${m.detalle}»` : "no tiene detalle"}) y a qué va, y lo desato y lo concilio ahí.`
    } else {
      etiqueta = "Pagado a otra cuenta"
      propuesta = `¿Se le pagó a ${emp.nombre} por la cuenta de ${quien}? Si es así, queda como está y lo anoto en el detalle («pagado por la cuenta de ${quien}»); si no, decime qué es.`
    }
    temas.push({
      clave: `ctl:sueldo-otra-persona:${m.id}`, grupo: "error", etiqueta, importe: m.importe,
      titulo: `${dmy(m.fecha)} · ${plata(m.importe)} a ${quien}, atado al sueldo de ${emp.nombre}`.slice(0, 160),
      papel: "Control: CUIL de Sueldos contra el CUIT del banco",
      que: `El banco informa que la plata fue a ${quien} (CUIT ${m.cuitBanco}), pero el movimiento está conciliado contra un pago de ${emp.nombre} (CUIL ${emp.cuit || "vacío"}): ${pago.tipo ?? "pago"} de ${periodo(pago)}, ${plata(pago.monto)}, ${medioTexto(pago.medio)}.${m.detalle ? ` Tu detalle: «${m.detalle}».` : ""}`,
      propuesta, links, respondido: false,
    })
  }
  return temas
}

/** Lee los movimientos con pago de sueldo de las cuentas de la empresa (las que traen el CUIT del banco) y arma los temas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function leerTemasSueldoOtraPersona(sb: any, empresa: string, desde: string, hasta: string): Promise<{ temas: Tema[]; error: string | null }> {
  try {
    const todos: MovAtado[] = []
    for (const c of CUENTAS_CONCILIABLES.filter(x => x.empresa === empresa && x.leyendas)) {
      const q = (c.schema === "public" ? sb.from(c.tabla) : sb.schema(c.schema).from(c.tabla))
        .select("id,fecha,debitos,creditos,estado,detalle,leyendas_adicionales_1,leyendas_adicionales_2,sueldo_pago_id").not("sueldo_pago_id", "is", null).limit(5000)
      const { data, error } = await q
      if (error) throw new Error(`${c.nombre}: ${error.message}`)
      for (const f of data ?? []) todos.push({ cuenta: c, id: String(f.id), fecha: String(f.fecha), importe: Math.abs(Number(f.debitos) || Number(f.creditos) || 0),
        quienBanco: f.leyendas_adicionales_1 ?? undefined, cuitBanco: cuitDe(f.leyendas_adicionales_2), detalle: f.detalle ?? undefined, estado: String(f.estado ?? ""), pagoId: String(f.sueldo_pago_id) })
    }
    const atados = todos.filter(m => m.fecha >= desde && m.fecha <= hasta && esPersona(m.cuitBanco))
    if (!atados.length) return { temas: [], error: null }
    const { data: emps, error: e1 } = await sb.schema("sueldos").from("empleados").select("id,nombre,cuit_empleado")
    if (e1) throw new Error(`empleados: ${e1.message}`)
    const empleados: EmpleadoSueldo[] = (emps ?? []).map((e: { id: string; nombre: string | null; cuit_empleado: string | null }) => ({ id: String(e.id), nombre: e.nombre ?? "?", cuit: e.cuit_empleado ?? "" }))
    // los pagos: los atados y los de un margen alrededor (candidatos)
    const d = new Date(Date.parse(desde) - 10 * 86400000).toISOString().slice(0, 10), h = new Date(Date.parse(hasta) + 10 * 86400000).toISOString().slice(0, 10)
    const { data: ps, error: e2 } = await sb.schema("sueldos").from("pagos").select("id,empleado_id,fecha,monto,medio_pago,tipo,periodo:periodos(mes,anio)").gte("fecha", d).lte("fecha", h).limit(10000)
    if (e2) throw new Error(`pagos de sueldo: ${e2.message}`)
    type FilaPago = { id: string; empleado_id: string; fecha: string; monto: number; medio_pago: string | null; tipo: string | null; periodo: { mes: number; anio: number } | null }
    const filas: FilaPago[] = [...(ps ?? [])]
    // un movimiento puede estar atado a un pago de fuera del margen: se traen por id (no se descarta en silencio)
    const faltan = [...new Set(atados.map(m => m.pagoId))].filter(id => !filas.some(p => String(p.id) === id))
    if (faltan.length) {
      const { data: px, error: e3 } = await sb.schema("sueldos").from("pagos").select("id,empleado_id,fecha,monto,medio_pago,tipo,periodo:periodos(mes,anio)").in("id", faltan)
      if (e3) throw new Error(`pagos de sueldo: ${e3.message}`)
      filas.push(...(px ?? []))
    }
    const pagos: PagoSueldo[] = filas.map(p => ({
      id: String(p.id), empleadoId: String(p.empleado_id), fecha: String(p.fecha), monto: Math.abs(Number(p.monto) || 0), medio: p.medio_pago, tipo: p.tipo, mes: p.periodo?.mes ?? null, anio: p.periodo?.anio ?? null }))
    return { temas: temasSueldoOtraPersona(atados, todos, pagos, empleados), error: null }
  } catch (e) { return { temas: [], error: (e as Error).message } }
}
