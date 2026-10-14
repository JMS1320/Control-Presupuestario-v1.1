/**
 * 📝 Un pago en VARIOS ECHEQS se proyecta en el Cash Flow echeq por echeq — A-FEAT-1282 (2026-10-14).
 *
 * El Cash Flow proyecta un pago con echeq en su fecha de cobro (`fecha_cobro_echeq`), que es UNA. Con
 * tres echeqs a 15/30/60 días, el total caía entero en una sola fecha y el flujo de caja mentía en las
 * otras dos. Ahora, si la factura o el anticipo tiene **dos o más** echeqs vigentes, su fila se
 * reemplaza por **una fila por echeq**, en su fecha y por su monto.
 *
 * Esas filas son de SÓLO LECTURA (`origen_tabla = 'msa.cheques'`, `echeq_de` = la factura/anticipo):
 * el pago ya está hecho; lo único que se puede tocar es la fecha de cobro de cada echeq. Con UN echeq
 * no cambia nada (la fila sigue siendo la de la factura/anticipo, como siempre).
 */

export interface ChequeParaFilas {
  id: string
  monto: number | string | null
  fecha_cobro: string | null
  estado: string | null
  numero?: string | null
  factura_id: string | null
  anticipo_id: string | null
}

/** Los que todavía no salieron del banco: un echeq cobrado, rechazado o anulado ya no se proyecta. */
const VIGENTE = (estado: string | null) => !estado || estado === 'vigente'

export function partirFilasEnEcheqs<T extends { id: string; origen: string; debitos: number; fecha_estimada: string; detalle: string; ids_grupo?: string[] | null }>(
  filas: T[], cheques: ChequeParaFilas[],
): (T & { echeq_de?: string; origen_tabla?: string })[] {
  const porPadre = new Map<string, ChequeParaFilas[]>()
  for (const c of cheques) {
    const padre = c.factura_id || c.anticipo_id
    if (!padre) continue
    porPadre.set(padre, [...(porPadre.get(padre) ?? []), c])
  }
  return filas.flatMap(f => {
    // Sólo una factura suelta o un anticipo; un grupo de pago no tiene echeqs propios.
    if (!(f.origen === 'ARCA' || f.origen === 'ANTICIPO') || (f.ids_grupo && f.ids_grupo.length)) return [f]
    const todos = porPadre.get(f.id) ?? []
    if (todos.length < 2) return [f]
    const vigentes = todos.filter(c => VIGENTE(c.estado)).sort((a, b) => String(a.fecha_cobro).localeCompare(String(b.fecha_cobro)))
    const n = todos.length
    const orden = new Map([...todos].sort((a, b) => String(a.fecha_cobro).localeCompare(String(b.fecha_cobro))).map((c, i) => [c.id, i + 1]))
    return vigentes.map(c => ({
      ...f,
      id: c.id,
      origen_tabla: 'msa.cheques',
      echeq_de: f.id,
      fecha_estimada: c.fecha_cobro || f.fecha_estimada,
      debitos: Math.round((Number(c.monto) || 0) * 100) / 100,
      detalle: `${f.detalle} · echeq ${orden.get(c.id)}/${n}${c.numero ? ' Nº ' + c.numero : ''}`,
    }))
  })
}
