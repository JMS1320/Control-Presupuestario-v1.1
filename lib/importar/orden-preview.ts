/**
 * ⬆️ La vista previa de «Importar facturas» (paso 2): las NUEVAS arriba de todo — A-FEAT-1554 (nota 🌙 JMS 03/11:
 * «mostrar arriba de todo las nuevas»). Después las que no se pudieron leer (hay que mirarlas) y al final las que ya
 * existen. Dentro de cada grupo se respeta el orden del archivo.
 */
const RANGO: Record<string, number> = { nueva: 0, error: 1, duplicado: 2 }

export function nuevasPrimero<T extends { estado: string }>(filas: T[]): T[] {
  return filas.map((f, i) => ({ f, i }))
    .sort((a, b) => (RANGO[a.f.estado] ?? 1) - (RANGO[b.f.estado] ?? 1) || a.i - b.i)
    .map(x => x.f)
}
