// Capa compartida (UI-agnóstica): cálculo de subtotales de pagos/cash flow.
// La usan Cash Flow, el Modal de Pagos y cualquier vista futura. Modificar el
// cálculo acá = un solo lugar. Ver MANUAL-USO.md § Pagos (plan de migración).

export interface FilaSubtotal {
  debitos: number
  creditos: number
  estado: string
  origen?: string
}

export interface SubtotalPorClave {
  clave: string
  debitos: number
  creditos: number
  neto: number
  cantidad: number
}

export interface Subtotales {
  totalDebitos: number
  totalCreditos: number
  neto: number // creditos - debitos (positivo = ingreso neto)
  cantidad: number
  porEstado: SubtotalPorClave[]
  porOrigen: SubtotalPorClave[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

function agrupar(filas: FilaSubtotal[], claveFn: (f: FilaSubtotal) => string): SubtotalPorClave[] {
  const map = new Map<string, { debitos: number; creditos: number; cantidad: number }>()
  for (const f of filas) {
    const k = claveFn(f) || '(sin dato)'
    const cur = map.get(k) || { debitos: 0, creditos: 0, cantidad: 0 }
    cur.debitos += f.debitos || 0
    cur.creditos += f.creditos || 0
    cur.cantidad += 1
    map.set(k, cur)
  }
  return Array.from(map.entries())
    .map(([clave, v]) => ({
      clave,
      debitos: redondear(v.debitos),
      creditos: redondear(v.creditos),
      neto: redondear(v.creditos - v.debitos),
      cantidad: v.cantidad,
    }))
    .sort((a, b) => a.clave.localeCompare(b.clave))
}

/**
 * Calcula subtotales de un conjunto de filas (ya filtradas por quien llama).
 * Débitos = egresos, Créditos = ingresos. Neto = créditos − débitos.
 */
export function calcularSubtotales(filas: FilaSubtotal[]): Subtotales {
  let totalDebitos = 0
  let totalCreditos = 0
  for (const f of filas) {
    totalDebitos += f.debitos || 0
    totalCreditos += f.creditos || 0
  }
  return {
    totalDebitos: redondear(totalDebitos),
    totalCreditos: redondear(totalCreditos),
    neto: redondear(totalCreditos - totalDebitos),
    cantidad: filas.length,
    porEstado: agrupar(filas, f => f.estado),
    porOrigen: agrupar(filas, f => f.origen || ''),
  }
}
