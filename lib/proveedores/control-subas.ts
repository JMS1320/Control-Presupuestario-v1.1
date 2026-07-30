// Control de subas de proveedores contra el IPC.
//
// La pregunta: **¿qué proveedor nos está aumentando por encima de la inflación?**
// No de a uno: se mira la cartera entera de los que facturan todos los meses, que es donde
// el aumento es una decisión del proveedor y no un cambio de consumo.
//
// ── Por qué NO se mide mínimo contra máximo ──────────────────────────────────
// Sería lo obvio y da cualquier cosa. Con los datos reales de MSA:
//
//   AUTOPISTAS URBANAS   +160 %   ← no aumentó: se viajó más
//   ALCORTA (veterinaria) +690 %   ← no aumentó: se compró más
//   MEDICUS               +23 %   ← esto SÍ es un aumento de precio
//
// El monto de una factura mezcla **precio** y **cantidad**, y sólo el precio se compara con
// el IPC. Entonces:
//
//   · se mide PRIMERO contra ÚLTIMO (la tendencia), no el mínimo contra el máximo, que
//     agarra dos outliers cualesquiera;
//   · se cuenta cuántas veces BAJÓ. Un abono sube en escalones y casi nunca baja; un
//     consumo rebota todo el tiempo. Ésa es la señal que separa precio de volumen.
//
// Los que parecen volumen igual se muestran, pero marcados: el número está, la conclusión
// no se saca sola.

import { resolverSerie } from '../precios/serie'

export interface FacturaMes {
  cuit: string
  proveedor: string
  anio: number
  mes: number
  monto: number
  facturas: number
  /** Para poder mirar de qué cuenta viene, si se sabe. */
  cuenta?: string | null
}

/** Variación mensual del IPC como FRACCIÓN (2,5 % → 0.025). */
export interface PuntoIpc {
  anio: number
  mes: number
  variacion: number
}

export type Semaforo = 'ok' | 'atencion' | 'alerta' | 'sin_ipc' | 'volumen'

export interface MesProveedor {
  mes: string
  monto: number
  /** Variación contra el mes anterior CON factura. null en el primero. */
  variacion: number | null
  ipcMes: number | null
  brechaMes: number | null
}

export interface AnalisisProveedor {
  cuit: string
  proveedor: string
  /** Meses con factura y meses del período analizado. */
  mesesConFactura: number
  mesesPeriodo: number
  regularidad: number
  facturasPorMes: number
  primerMes: string
  ultimoMes: string
  primerMonto: number
  ultimoMonto: number
  total: number
  /** Suba de punta a punta. */
  subaTotal: number
  /** Equivalente mensual de esa suba. */
  subaMensual: number
  ipcAcumulado: number | null
  ipcMensual: number | null
  /** Cuánto se pasó (o quedó abajo) del IPC, en puntos. */
  brecha: number | null
  /** Meses en los que el monto bajó respecto del anterior. */
  bajas: number
  /** Parece un precio (abono, servicio) y no un consumo variable. */
  esPrecio: boolean
  semaforo: Semaforo
  serie: MesProveedor[]
}

const km = (a: number, m: number) => a * 12 + (m - 1)
const clave = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`

/**
 * IPC acumulado entre dos meses, componiendo las variaciones mensuales.
 *
 * El IPC **se arrastra hacia adelante**, igual que los precios y el TC del presupuesto
 * (`lib/precios/serie.ts`). El usuario lo carga en escalones — *"capaz pongo 6 meses con lo
 * mismo y luego otros 6 de tal manera"* — así que un mes sin valor propio hereda el último
 * cargado. Exigir el dato mes por mes obligaría a repetir el mismo número doce veces.
 *
 * Devuelve `null` sólo si algún mes del tramo queda **sin nada que arrastrar**: un acumulado
 * al que le faltan meses queda corto y haría ver a todos los proveedores por encima del IPC.
 */
export function ipcAcumulado(ipc: PuntoIpc[], desdeKm: number, hastaKm: number): number | null {
  if (hastaKm <= desdeKm) return 0
  const puntos = ipc.map(p => ({ anio: p.anio, mes: p.mes, valor: p.variacion }))
  let acum = 1
  // El IPC del mes de arranque ya está dentro del precio de arranque: se cuenta desde el siguiente.
  for (let k = desdeKm + 1; k <= hastaKm; k++) {
    const anio = Math.floor(k / 12)
    const mes = (k % 12) + 1
    const v = resolverSerie(puntos, anio, mes)
    if (v.origen === 'sin_dato') return null
    acum *= 1 + v.valor
  }
  return acum - 1
}

/** Variación del mes, arrastrando el último valor cargado. */
export function ipcDelMes(ipc: PuntoIpc[], anio: number, mes: number): number | null {
  if (ipc.length === 0) return null
  const v = resolverSerie(ipc.map(p => ({ anio: p.anio, mes: p.mes, valor: p.variacion })), anio, mes)
  return v.origen === 'sin_dato' ? null : v.valor
}

export interface OpcionesAnalisis {
  /** Cuántos meses hacia atrás mirar. */
  ventanaMeses?: number
  /** Mínimo de meses con factura para entrar al análisis. */
  minMeses?: number
  /** Regularidad mínima (meses con factura / meses del período). */
  minRegularidad?: number
  /** A partir de acá se considera que se pasó del IPC. */
  toleranciaPuntos?: number
  hoy?: Date
}

/**
 * Analiza la cartera. Devuelve un item por proveedor recurrente, del que más se pasó al que
 * menos.
 *
 * El mes en curso se excluye: está a medio facturar y arruinaría la comparación de punta a
 * punta justo en la punta que importa.
 */
export function analizarProveedores(
  facturas: FacturaMes[],
  ipc: PuntoIpc[],
  opts: OpcionesAnalisis = {},
): AnalisisProveedor[] {
  const hoy = opts.hoy ?? new Date()
  const ventana = opts.ventanaMeses ?? 12
  const minMeses = opts.minMeses ?? 4
  const minReg = opts.minRegularidad ?? 0.6
  const tol = opts.toleranciaPuntos ?? 0.05

  const topeKm = km(hoy.getFullYear(), hoy.getMonth() + 1) - 1 // último mes cerrado
  const pisoKm = topeKm - ventana + 1

  const porProveedor = new Map<string, FacturaMes[]>()
  for (const f of facturas) {
    const k = km(f.anio, f.mes)
    if (k < pisoKm || k > topeKm) continue
    if (f.monto <= 0) continue // las notas de crédito no son un precio
    const lista = porProveedor.get(f.cuit) ?? []
    lista.push(f)
    porProveedor.set(f.cuit, lista)
  }

  const salida: AnalisisProveedor[] = []

  for (const [cuit, lista] of porProveedor) {
    const meses = [...lista].sort((a, b) => km(a.anio, a.mes) - km(b.anio, b.mes))
    if (meses.length < minMeses) continue

    const primero = meses[0]!
    const ultimo = meses[meses.length - 1]!
    const desdeKm = km(primero.anio, primero.mes)
    const hastaKm = km(ultimo.anio, ultimo.mes)
    const mesesPeriodo = hastaKm - desdeKm + 1
    const regularidad = meses.length / mesesPeriodo
    if (regularidad < minReg) continue

    let bajas = 0
    const serie: MesProveedor[] = meses.map((f, i) => {
      const previo = i > 0 ? meses[i - 1]!.monto : null
      const variacion = previo && previo !== 0 ? f.monto / previo - 1 : null
      if (variacion != null && variacion < -0.01) bajas++
      const ipcMes = ipcDelMes(ipc, f.anio, f.mes)
      return {
        mes: clave(f.anio, f.mes),
        monto: f.monto,
        variacion,
        ipcMes,
        brechaMes: variacion != null && ipcMes != null ? variacion - ipcMes : null,
      }
    })

    const subaTotal = primero.monto !== 0 ? ultimo.monto / primero.monto - 1 : 0
    const pasos = Math.max(1, hastaKm - desdeKm)
    const subaMensual = Math.pow(1 + subaTotal, 1 / pasos) - 1
    const acum = ipcAcumulado(ipc, desdeKm, hastaKm)
    const ipcMes = acum != null ? Math.pow(1 + acum, 1 / pasos) - 1 : null
    const brecha = acum != null ? subaTotal - acum : null

    const facturasPorMes = meses.reduce((s, f) => s + f.facturas, 0) / meses.length
    // Un abono sube en escalones y casi nunca baja. Si baja seguido, el monto lo manda el
    // consumo y compararlo con el IPC no dice nada.
    const esPrecio = bajas <= Math.max(1, Math.floor(meses.length * 0.25)) && facturasPorMes <= 2

    let semaforo: Semaforo
    if (!esPrecio) semaforo = 'volumen'
    else if (brecha == null) semaforo = 'sin_ipc'
    else if (brecha <= tol) semaforo = 'ok'
    else if (brecha <= tol + 0.15) semaforo = 'atencion'
    else semaforo = 'alerta'

    salida.push({
      cuit, proveedor: primero.proveedor,
      mesesConFactura: meses.length, mesesPeriodo, regularidad, facturasPorMes,
      primerMes: clave(primero.anio, primero.mes),
      ultimoMes: clave(ultimo.anio, ultimo.mes),
      primerMonto: primero.monto, ultimoMonto: ultimo.monto,
      total: meses.reduce((s, f) => s + f.monto, 0),
      subaTotal, subaMensual,
      ipcAcumulado: acum, ipcMensual: ipcMes, brecha,
      bajas, esPrecio, semaforo, serie,
    })
  }

  const orden: Record<Semaforo, number> = { alerta: 0, atencion: 1, ok: 2, sin_ipc: 3, volumen: 4 }
  return salida.sort((a, b) =>
    orden[a.semaforo] - orden[b.semaforo] || (b.brecha ?? -Infinity) - (a.brecha ?? -Infinity) || b.total - a.total)
}

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  alerta: 'Muy por encima del IPC',
  atencion: 'Por encima del IPC',
  ok: 'En línea con el IPC',
  sin_ipc: 'Falta IPC del período',
  volumen: 'Varía por consumo, no por precio',
}

/** Resumen de la cartera, para encabezar el informe. */
export function resumenCartera(analisis: AnalisisProveedor[]) {
  const precios = analisis.filter(a => a.esPrecio)
  const conIpc = precios.filter(a => a.brecha != null)
  const pasados = conIpc.filter(a => a.brecha! > 0.05)
  return {
    proveedores: analisis.length,
    dePrecio: precios.length,
    porVolumen: analisis.length - precios.length,
    sinIpc: precios.length - conIpc.length,
    porEncima: pasados.length,
    /** Cuánta plata está en manos de los que se pasaron. */
    montoPorEncima: pasados.reduce((s, a) => s + a.total, 0),
    montoTotal: analisis.reduce((s, a) => s + a.total, 0),
  }
}
