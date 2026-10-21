/**
 * 📎 Vincular A MANO el PDF archivado de una factura — la lógica que comparten Subdiarios (panel
 * «PDFs sin vincular») y el Cash Flow (la ❌ de la columna del archivo, A-DEC-1008).
 *
 * Pedido del usuario 2026-10-14: *«que en cash flow yo pudiera buscar esa factura que ya la tengo
 * archivada, que use el mismo motor»*. Por eso esto vive acá y no en una pantalla: las dos tienen
 * que sugerir igual, mirar la misma carpeta y guardar lo mismo (§ ♻️ Centralizar).
 */

/** Las palabras del proveedor (≥ 4 letras) que aparecen en el nombre del archivo. */
export function coincidenciasDeNombre(nombreArchivo: string, denominacion: string | null | undefined): number {
  const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const arch = norm(nombreArchivo)
  return norm(denominacion || '').split(/\s+/).filter(w => w.length >= 4).filter(w => arch.indexOf(w) >= 0).length
}

/**
 * Si el nombre empieza con fecha (`MM-DD`), ¿coincide con la emisión? `null` = el nombre no trae
 * fecha. Evita sugerir el duplicado de otro día del mismo proveedor.
 */
export function fechaDelNombreCoincide(nombreArchivo: string, fechaEmision: string | null | undefined): boolean | null {
  const m = nombreArchivo.match(/^(\d{2})-(\d{2})/)
  if (!m) return null
  const fe = fechaEmision || ''
  return fe.slice(5, 7) === m[1] && fe.slice(8, 10) === m[2]
}

export interface ArchivoDeCarpeta { archivo: string; url: string; file_id?: string }

/**
 * Los archivos sin vincular de la carpeta, **para UNA factura**: primero los sugeridos (⭐), del que
 * más se parece al que menos. Sugerido = nombra al proveedor y, si trae fecha, es la de la factura.
 * Los demás se listan igual: el nombre puede estar mal y el usuario mira el archivo.
 */
export function archivosParaFactura(
  archivos: readonly ArchivoDeCarpeta[],
  factura: { denominacion_emisor?: string | null; fecha_emision?: string | null },
): Array<ArchivoDeCarpeta & { sugerido: boolean }> {
  const conPuntaje = archivos.map((a, i) => {
    const hits = coincidenciasDeNombre(a.archivo, factura.denominacion_emisor)
    const sugerido = hits > 0 && fechaDelNombreCoincide(a.archivo, factura.fecha_emision) !== false
    return { a, i, hits: sugerido ? hits : 0, sugerido }
  })
  return conPuntaje
    .sort((x, y) => (y.hits - x.hits) || (x.i - y.i))
    .map(x => ({ ...x.a, sugerido: x.sugerido }))
}

/**
 * 🗂️ En qué carpeta se busca: la del **período contable** (el subdiario donde está imputada); si
 * todavía no está imputada, la del **mes de emisión**, como provisional. Es la misma regla con la
 * que `confirmar-pdf` archiva el archivo, así que buscar y guardar miran el mismo lugar.
 */
export function periodoDeArchivo(factura: Record<string, unknown>): { anio: number; mes: number; imputada: boolean } {
  const ac = Number(factura['año_contable'])
  const mc = Number(factura['mes_contable'])
  if (ac && mc) return { anio: ac, mes: mc, imputada: true }
  const f = String(factura['fecha_emision'] || '')
  return { anio: Number(f.slice(0, 4)) || 0, mes: Number(f.slice(5, 7)) || 0, imputada: false }
}

/**
 * 🗂️ La ruta de subcarpetas de un mes bajo la carpeta de la empresa: **campaña / aa-mm**. MSA usa la
 * campaña agrícola (1/7–30/6, `2025-2026`); PAM y MA el año calendario. Vivía copiada en cuatro
 * rutas de `app/api/gas/` — si una cambiaba, buscar y guardar miraban carpetas distintas.
 */
export function subcarpetasDelMes(empresa: 'MSA' | 'PAM' | 'MA', anio: number, mes: number): string[] {
  const campania = empresa === 'MSA'
    ? (mes >= 7 ? `${anio}-${anio + 1}` : `${anio - 1}-${anio}`)
    : String(anio)
  const aaMm = `${String(anio).slice(-2)}-${String(mes).padStart(2, '0')}`
  return [campania, aaMm]
}

/**
 * 🔎 Dónde puede estar YA archivada una factura (A-FEAT-1287):
 * - **imputada** → SÓLO la carpeta de su subdiario. La imputación es la verdad (usuario 2026-10-22:
 *   *«está mal que la app busque en 2 carpetas cuando está imputada en 1… debemos tomar como verdad
 *   eso y si hay algún error de archivo deberá saltar por otro lado»*); el «otro lado» es el registro
 *   del archivo digital, que avisa si la factura está guardada en otra carpeta.
 * - **sin imputar** → el mes de emisión **y el siguiente**: todavía no se sabe a cuál va.
 * ⚠️ cambió 2026-10-22: hasta acá eran siempre las dos (decisión del 2026-10-16).
 */
export function mesesDondeBuscar(factura: Record<string, unknown>): Array<{ anio: number; mes: number }> {
  const { anio, mes, imputada } = periodoDeArchivo(factura)
  if (!anio || !mes) return []
  if (imputada) return [{ anio, mes }]
  const sig = mes === 12 ? { anio: anio + 1, mes: 1 } : { anio, mes: mes + 1 }
  return [{ anio, mes }, sig]
}

/** Lo que se guarda en la factura al vincular a mano. Mismo texto desde las dos pantallas. */
export function datosDelVinculo(a: ArchivoDeCarpeta, desde: 'supervisión' | 'Cash Flow') {
  return {
    pdf_drive_url: a.url,
    pdf_estado: 'descargado',
    pdf_observaciones: `Vinculado manualmente desde ${desde} (archivo: ${a.archivo})`,
  }
}
