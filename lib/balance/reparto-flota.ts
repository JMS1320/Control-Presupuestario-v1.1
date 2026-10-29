/**
 * 🚗 EL DESGLOSE DE LA FLOTA — tabla aparte del papel 14 (A-FEAT-1422 nota 9, JMS 29/10/2026).
 *
 * JMS: *«¿acá tenemos el desglose del seguro de la flota? ¿lo podés agregar como tabla aparte?»* — confirmado: cada
 * débito de la flota en el ejercicio, repartido por vehículo según su prima (el mismo reparto de Egresos → Seguros:
 * Tiguan → MA, Gol → JMS, el resto MSA, editable por bien). Lo que no es de MSA es plata que MSA pagó por otro:
 * va a su cuenta corriente / Distribuciones.
 *
 * Pura: se le pasa lo controlado (`controlarDebitos`), los movimientos, las lecturas de las pólizas y las reglas.
 */
import { repartoDeLasCuotas, repartirImporte, type ReglaResponsable, type RepartoPoliza } from "@/lib/polizas/controlar-poliza"
import type { PolizaLeida } from "@/lib/polizas/parsear-poliza"
import type { CuotaControlada } from "@/lib/polizas/control-debitos"

export interface FilaRepartoFlota {
  /** Fecha del débito en el banco. */
  fecha: string
  poliza: string
  vencimiento: string
  debitado: number
  /** responsable → importe. Suman exactamente lo debitado. */
  partes: Record<string, number>
}

export interface RepartoFlota {
  /** Los responsables que aparecen, MSA primero. */
  responsables: string[]
  filas: FilaRepartoFlota[]
  totales: Record<string, number>
  total: number
  /** Débitos de la flota que no se pudieron repartir (la póliza no tiene vehículos leídos): van enteros a MSA. */
  sinReparto: number
}

const r2 = (n: number) => Math.round(n * 100) / 100
const MARGEN = 7 * 864e5

/**
 * @param lecturasPorPoliza  póliza de la FLOTA → las lecturas de sus endosos (`polizas_endosos.lectura`)
 * @param desde / hasta       el ejercicio (fecha del débito)
 */
export function repartoDeLaFlota(
  cuotas: CuotaControlada[],
  movimientos: { id: string; fecha: string }[],
  lecturasPorPoliza: Map<string, PolizaLeida[]>,
  reglas: ReglaResponsable[],
  desde: string,
  hasta: string,
): RepartoFlota {
  const fechaDe = new Map(movimientos.map(m => [m.id, m.fecha]))
  const repartos = new Map([...lecturasPorPoliza].map(([p, l]) => [p, repartoDeLasCuotas(l, reglas, "interno")]))
  const filas: FilaRepartoFlota[] = []
  let sinReparto = 0
  for (const c of cuotas) {
    const porVenc = repartos.get(c.poliza)
    if (!porVenc || !c.movimientoId || !c.debitado || c.debitado <= 0) continue
    const fecha = fechaDe.get(c.movimientoId)
    if (!fecha || fecha < desde || fecha > hasta) continue
    const k = [...porVenc.keys()].find(v => Math.abs(Date.parse(v) - Date.parse(c.vencimiento)) <= MARGEN)
    const partesCuota = k ? porVenc.get(k)! : []
    const suma = partesCuota.reduce((s, x) => s + x.importe, 0)
    // El débito puede no ser la cuota exacta (una NC compensada): se reparte en la MISMA proporción.
    const reparto: RepartoPoliza | null = suma > 0
      ? { eje: "interno", base: "prima de cada vehículo", partes: partesCuota.map(x => ({ responsable: x.responsable, peso: x.importe, proporcion: x.importe / suma, bienes: [] })) }
      : null
    if (!reparto) sinReparto = r2(sinReparto + c.debitado)
    const partes: Record<string, number> = {}
    for (const x of repartirImporte(c.debitado, reparto)) partes[x.responsable] = r2((partes[x.responsable] ?? 0) + x.importe)
    filas.push({ fecha, poliza: c.poliza, vencimiento: c.vencimiento, debitado: r2(c.debitado), partes })
  }
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
  const todos = [...new Set(filas.flatMap(f => Object.keys(f.partes)))]
  const responsables = [...todos.filter(r => r === "MSA"), ...todos.filter(r => r !== "MSA").sort()]
  const totales: Record<string, number> = {}
  for (const r of responsables) totales[r] = r2(filas.reduce((s, f) => s + (f.partes[r] ?? 0), 0))
  return { responsables, filas, totales, total: r2(filas.reduce((s, f) => s + f.debitado, 0)), sinReparto }
}
