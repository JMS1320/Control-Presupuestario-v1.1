/**
 * 📸 LA FOTO DEL PRESUPUESTO — A-FEAT-1677 M3 (JMS 27/11: «M3 ok» — presupuesto contra ejecutado por mes cerrado; «eso implica ir tomando fotos del
 * presupuesto, ¿verdad?»).
 *
 * La app guarda sola una foto el primer día que se abre el presupuesto en cada mes (`motivo = automatica`, una por empresa y mes) y JMS puede
 * congelar otras a mano. La foto guarda cada renglón con sus montos por mes (bloque, clave estable, nombre) y los totales. Al cerrar un mes,
 * lo que la foto decía para ESE mes se compara contra lo que pasó (etapa 2: la comparación).
 * Pura; caso en `npm run probar`.
 */

export interface FilaFoto { bloque: string; clave: string; nombre: string; montos: Record<string, number> }
export interface Foto {
  empresa: string
  fecha: string
  mes: string
  motivo: "automatica" | "manual"
  saldo_inicio: number | null
  filas: FilaFoto[]
  totales: { ingresos: Record<string, number>; egresos: Record<string, number>; inversiones: Record<string, number>; saldo: Record<string, number | null> }
}

const r2 = (n: number) => Math.round(n * 100) / 100
/** Los montos sin ceros ni centavos sueltos (la foto se guarda liviana). */
export function limpiarMontos(m: Record<string, number | null | undefined>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(m)) if (v != null && Number.isFinite(Number(v)) && Math.abs(Number(v)) >= 0.5) out[k] = r2(Number(v))
  return out
}

export function armarFoto(p: {
  empresa: string; fecha: string; motivo: "automatica" | "manual"; saldoInicio: number | null
  bloques: { bloque: string; filas: { clave: string; nombre: string; montos: Record<string, number | null | undefined> }[] }[]
  ingresos: Record<string, number>; egresos: Record<string, number>; inversiones: Record<string, number>; saldo: Record<string, number | null>
}): Foto {
  const filas: FilaFoto[] = []
  for (const b of p.bloques) for (const f of b.filas) {
    const montos = limpiarMontos(f.montos)
    if (Object.keys(montos).length) filas.push({ bloque: b.bloque, clave: f.clave, nombre: f.nombre, montos })
  }
  return {
    empresa: p.empresa, fecha: p.fecha, mes: p.fecha.slice(0, 7), motivo: p.motivo, saldo_inicio: p.saldoInicio == null ? null : r2(p.saldoInicio),
    filas,
    totales: { ingresos: limpiarMontos(p.ingresos), egresos: limpiarMontos(p.egresos), inversiones: limpiarMontos(p.inversiones),
      saldo: Object.fromEntries(Object.entries(p.saldo).filter(([, v]) => v != null).map(([k, v]) => [k, r2(Number(v))])) },
  }
}

/** Lo que una foto decía para un mes: total por bloque y el total de egresos / ingresos. */
export function loQueDecia(f: Pick<Foto, "filas" | "totales">, mes: string): { porBloque: Record<string, number>; ingresos: number; egresos: number; saldo: number | null } {
  const porBloque: Record<string, number> = {}
  for (const x of f.filas) if (x.montos[mes]) porBloque[x.bloque] = r2((porBloque[x.bloque] || 0) + x.montos[mes]!)
  return { porBloque, ingresos: f.totales.ingresos[mes] || 0, egresos: f.totales.egresos[mes] || 0, saldo: f.totales.saldo[mes] ?? null }
}
