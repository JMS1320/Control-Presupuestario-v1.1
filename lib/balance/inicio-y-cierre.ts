/**
 * 📋 **INICIO Y CIERRE DE CADA RENGLÓN DEL BALANCE** — A-FEAT-1427 (2026-10-30).
 *
 * JMS: *«lo que yo preciso es que el export esté completo en sus variables… el export tenga cada respuesta a cada
 * ítem, y cuando no puede calcularlo, que lo diga»* y *«saldo del año pasado, saldo de este año»*.
 *
 * Una fila por renglón del balance (la misma lista que el Balance propio, `RENGLONES`):
 * - **Inicio** = la foto del cierre anterior, versión contador (lo presentado) y versión JMS (su registro).
 * - **Cierre** = lo que la app calcula hoy desde los papeles (`propuestaDelSistema`, el mismo cálculo que
 *   «Pasar a la foto del balance propio»: no hay una segunda cuenta).
 * - **Estado**: si falta uno de los dos lados, lo dice. Nada se omite: un renglón sin ningún dato también sale,
 *   para que se vea que no tiene respuesta.
 */
import { RENGLONES, RUBROS, type ValorPropuesto } from "./balance-propio"
import type { FotoInicio } from "./control-inicio"

export type EstadoRenglon = "los dos" | "falta el cierre" | "falta el inicio" | "sin datos"

export interface FilaInicioCierre {
  rubro: string
  renglon: string
  etiqueta: string
  inicioContador: number | null
  inicioJms: number | null
  cierre: number | null
  /** De dónde sale el cierre (el detalle del cálculo de la app). */
  detalleCierre: string
  estado: EstadoRenglon
}

export interface InicioYCierre {
  filas: FilaInicioCierre[]
  /** Lo que el cálculo de cierre dice que no pudo saber (tarjeta sin resumen, meses sin extracto…). */
  faltan: string[]
  cuenta: Record<EstadoRenglon, number>
  /** `false` = no hay foto del cierre anterior: ningún inicio se puede mostrar. */
  hayFotoInicio: boolean
}

/**
 * @param foto   la foto del cierre anterior (`leerFotoInicio` con todos los renglones). `null` = no existe.
 * @param cierre lo que calcula la app (`propuestaDelSistema(...).valores`). Un renglón ausente = no lo calcula (o da 0).
 */
export function armarInicioYCierre(foto: FotoInicio | null, cierre: ValorPropuesto[], faltan: string[] = []): InicioYCierre {
  const porRenglon = new Map(cierre.map(v => [v.renglon, v]))
  const etiquetaRubro = new Map(RUBROS.map(r => [r.id, r.etiqueta]))
  const filas: FilaInicioCierre[] = RENGLONES.map(r => {
    const f = foto?.[r.id]
    const inicioContador = f?.contador ?? null
    const inicioJms = f?.jms ?? null
    const c = porRenglon.get(r.id)
    const tieneInicio = inicioContador != null || inicioJms != null
    const tieneCierre = c != null
    const estado: EstadoRenglon = tieneInicio && tieneCierre ? "los dos"
      : tieneInicio ? "falta el cierre" : tieneCierre ? "falta el inicio" : "sin datos"
    return {
      rubro: etiquetaRubro.get(r.rubro) ?? r.rubro, renglon: r.id, etiqueta: r.etiqueta,
      inicioContador, inicioJms, cierre: c ? c.importe : null, detalleCierre: c?.detalle ?? "", estado,
    }
  })
  const cuenta = { "los dos": 0, "falta el cierre": 0, "falta el inicio": 0, "sin datos": 0 } as Record<EstadoRenglon, number>
  filas.forEach(f => { cuenta[f.estado]++ })
  return { filas, faltan, cuenta, hayFotoInicio: foto != null }
}

/** El texto de la columna «Estado», con la marca que la vista previa reconoce como alerta. */
export function textoEstado(f: FilaInicioCierre): string {
  switch (f.estado) {
    case "los dos": return "✓ inicio y cierre"
    case "falta el cierre": return "⚠️ FALTA el cierre: el año pasado tuvo saldo y la app no lo calcula (o da 0)"
    case "falta el inicio": return "⚠️ FALTA el inicio: la foto del balance anterior no tiene este renglón"
    case "sin datos": return "— sin saldo ninguno de los dos años"
  }
}
