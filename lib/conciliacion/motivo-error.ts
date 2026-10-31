/**
 * 🧯 **POR QUÉ FALLÓ UN MOVIMIENTO al conciliar, en el idioma de la app** (A-BUG-1458).
 *
 * El 31/10 la conciliación de Santander dio «Errores 113» y nada más: la causa (a la tabla le faltaban columnas que el
 * motor escribe) sólo estaba en la consola del navegador. Desde acá cada error se resume en un motivo legible y la
 * pantalla los muestra agrupados, con cuántos movimientos tuvo cada uno: un error que no se explica no se arregla.
 */

/** Pura: el motivo legible de un error de la base (o de cualquier error). */
export function motivoDeError(e: unknown): string {
  const o = (e ?? {}) as { message?: unknown; code?: unknown; details?: unknown }
  const msg = String(o.message ?? e ?? "").trim()
  const code = String(o.code ?? "")
  // PostgREST: «Could not find the 'x' column of 'y' in the schema cache» · Postgres: column "x" (of relation "y") does not exist
  const col = msg.match(/could not find the '([^']+)' column/i)?.[1] ?? msg.match(/column "([^"]+)"[^]*does not exist/i)?.[1]
  if (col || code === "PGRST204" || code === "42703") {
    return `A la tabla de esta cuenta le falta la columna «${col ?? "?"}» (problema de estructura de la base, no del dato): avisale a Claude.`
  }
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return "Sin permiso para grabar en esta cuenta (permisos de la base): avisale a Claude."
  }
  if (code === "23505" || /duplicate key/i.test(msg)) return "Ya existe un registro igual (clave repetida)."
  if (code === "23503" || /foreign key/i.test(msg)) return "Apunta a algo que no existe (un template, una cuota o una factura borrada)."
  return msg ? msg.slice(0, 200) : "Error sin mensaje"
}

/** Pura: suma un motivo a la cuenta de motivos (para mostrarlos agrupados, del más repetido al menos). */
export function sumarMotivo(motivos: { motivo: string; n: number }[], motivo: string): void {
  const m = motivos.find(x => x.motivo === motivo)
  if (m) m.n++
  else motivos.push({ motivo, n: 1 })
  motivos.sort((a, b) => b.n - a.n)
}
