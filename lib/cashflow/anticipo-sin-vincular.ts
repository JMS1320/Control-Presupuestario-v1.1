/**
 * ⚠️ «¿Ya pagada por anticipo?» — el aviso que evita que el Cash Flow cuente dos veces — A-BUG-1553 (mejora c).
 *
 * Caso que lo originó (auditoría 05/11): Briki ($ 14.000.000) y De Francesco ($ 3.577.815,36) se pagaron como ANTICIPO con
 * echeq el 14/10 y sus facturas entraron ese mismo día por el mismo importe; nadie apretó «Vincular» y el Cash Flow mostró
 * la factura pendiente Y los echeqs del anticipo: ≈ $ 17,3 M de egreso duplicado.
 *
 * Pura: a cada FACTURA sin pagar que tiene un ANTICIPO sin vincular del mismo CUIT por el mismo importe (±3 %, como el
 * botón «Vincular»: el anticipo puede venir neto de SICORE) le pone `aviso_anticipo`. **Avisa, no frena ni descuenta**
 * (§ control que avisa): puede ser otra compra al mismo proveedor; lo decide quien vincula.
 * Los echeqs de un anticipo vienen en varias filas (`echeq_de`): se suman como un solo anticipo.
 */
export interface FilaParaAviso {
  id: string
  origen: string
  cuit_proveedor: string
  estado: string
  debitos: number
  imp_total?: number
  monto_sicore?: number | null
  echeq_de?: string
  aviso_anticipo?: string
}

const SIN_PAGAR = new Set(["pendiente", "pagar", "preparado", "programado"])
const limpio = (c: string) => String(c ?? "").replace(/\D/g, "")
const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function marcarAnticiposSinVincular<T extends FilaParaAviso>(filas: T[]): T[] {
  // Anticipos de PAGO (débitos) agrupados por anticipo (sus echeqs suman uno)
  const anticipos = new Map<string, { cuit: string; neto: number; sicore: number }>()
  for (const f of filas) {
    if (f.origen !== "ANTICIPO" || !(f.debitos > 0) || !limpio(f.cuit_proveedor)) continue
    const id = f.echeq_de || f.id
    const a = anticipos.get(id) ?? { cuit: limpio(f.cuit_proveedor), neto: 0, sicore: Number(f.monto_sicore) || 0 }
    a.neto += f.debitos
    anticipos.set(id, a)
  }
  if (!anticipos.size) return filas
  return filas.map(f => {
    if (f.origen !== "ARCA" || !SIN_PAGAR.has(f.estado) || !(Number(f.imp_total) > 0)) return f
    const total = Number(f.imp_total)
    const c = limpio(f.cuit_proveedor)
    const match = [...anticipos.values()].find(a => a.cuit === c &&
      (Math.abs(a.neto - total) <= total * 0.03 || Math.abs(a.neto + a.sicore - total) <= total * 0.03))
    return match ? { ...f, aviso_anticipo: `⚠️ ¿Ya pagada por anticipo? Hay un anticipo sin vincular de este proveedor por $ ${pesos(match.neto + match.sicore)}: vinculalo (Alertas de pagos o Anticipos) para que no se cuente dos veces.` } : f
  })
}
