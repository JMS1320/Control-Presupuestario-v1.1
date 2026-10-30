/**
 * 🔁 **A-FEAT-1434 — el ÚLTIMO LOTE importado, para volver a procesarlo.**
 *
 * Nota de JMS 30/10: *«como hay registro del lote, podría volver a procesar el lote»*. Cada factura
 * importada guarda su `archivo_origen` y su `fecha_importacion` (una por fila, con segundos de
 * diferencia). Un lote = las del archivo de la importación más reciente, importadas en la misma tanda.
 *
 * 📌 La misma tanda se reconoce por cercanía: hasta `ventanaMin` minutos antes de la última. Si el
 * mismo archivo se volvió a importar otro día, eso es otro lote y no se mezcla.
 */

export interface FilaDeLote {
  id: string
  archivo_origen: string | null
  fecha_importacion: string | null
}

export function idsDelUltimoLote<T extends FilaDeLote>(filas: T[], ventanaMin = 30): { archivo: string | null; filas: T[] } {
  const conFecha = filas.filter(f => f.archivo_origen && f.fecha_importacion)
  if (conFecha.length === 0) return { archivo: null, filas: [] }
  const ultima = conFecha.reduce((a, b) => (Date.parse(b.fecha_importacion!) > Date.parse(a.fecha_importacion!) ? b : a))
  const tope = Date.parse(ultima.fecha_importacion!)
  const desde = tope - ventanaMin * 60 * 1000
  const delLote = conFecha.filter(f => f.archivo_origen === ultima.archivo_origen
    && Date.parse(f.fecha_importacion!) >= desde && Date.parse(f.fecha_importacion!) <= tope)
  return { archivo: ultima.archivo_origen, filas: delLote }
}
