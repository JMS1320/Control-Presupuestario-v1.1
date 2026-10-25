/**
 * 📄 Texto de un PDF **en renglones**, como se ve impreso — A-FEAT-1309.
 *
 * ## Por qué no alcanza `extractText` de unpdf
 * Devuelve los textos en el orden en que el PDF los dibuja, que no es el de lectura. En la póliza de
 * Flota la liquidación del premio salía desarmada: los rótulos (`I.V.A.`, `SELLADO`) por un lado y
 * los importes treinta renglones más abajo, sin forma de saber cuál era cuál.
 *
 * Acá se agrupan los textos **por su altura en la página** (misma `y` = mismo renglón) y se ordenan
 * de izquierda a derecha. Entre dos textos de un renglón va un doble espacio, que es lo que usa el
 * lector para separar columnas.
 *
 * Las páginas se separan con `\f` (salto de página).
 */

export interface TextoUbicado {
  s: string
  x: number
  y: number
  /** Alto de la letra; decide cuánta diferencia de `y` sigue siendo el mismo renglón. */
  h: number
}

/**
 * Pura: textos con su posición → renglones de una página, **conservando la posición** de cada
 * texto (de arriba hacia abajo, y de izquierda a derecha dentro del renglón).
 *
 * La usan los lectores que necesitan saber en qué COLUMNA cae cada texto — el resumen de caja de
 * ahorro del Galicia (A-FEAT-1352) distingue crédito de débito por eso.
 */
export function agruparRenglones(items: TextoUbicado[]): { y: number; items: TextoUbicado[] }[] {
  const vivos = items.filter(i => i.s && i.s.trim())
  vivos.sort((a, b) => b.y - a.y || a.x - b.x)
  const renglones: { y: number; items: TextoUbicado[] }[] = []
  for (const it of vivos) {
    const tol = Math.max(2, (it.h || 8) * 0.35)
    const r = renglones.find(l => Math.abs(l.y - it.y) <= tol)
    if (r) r.items.push(it)
    else renglones.push({ y: it.y, items: [it] })
  }
  renglones.sort((a, b) => b.y - a.y)
  for (const r of renglones) r.items.sort((a, b) => a.x - b.x)
  return renglones
}

/** Pura: textos con su posición → renglones de una página. */
export function armarRenglones(items: TextoUbicado[]): string[] {
  return agruparRenglones(items).map(r => r.items.map(i => i.s.trim()).join("  "))
}

/** Lee un PDF y devuelve los textos de cada página con su posición. */
export async function textosUbicadosPorPagina(data: Uint8Array): Promise<TextoUbicado[][]> {
  const { getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(data)
  const paginas: TextoUbicado[][] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const items: TextoUbicado[] = []
    for (const i of tc.items as Array<{ str?: string; transform?: number[] }>) {
      if (!i.str || !i.transform) continue
      items.push({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || 8 })
    }
    paginas.push(items)
  }
  return paginas
}

/** Lee un PDF y devuelve el texto en renglones, páginas separadas por `\f`. */
export async function textoEnRenglones(data: Uint8Array): Promise<string> {
  const paginas = await textosUbicadosPorPagina(data)
  return paginas.map(items => armarRenglones(items).join("\n")).join("\n\f\n")
}
