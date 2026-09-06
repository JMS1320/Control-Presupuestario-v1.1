/**
 * 🏛️ Parser de BOLETAS de ARBA (inmobiliario y complementario) — A-FEAT-95.
 *
 * ## Por qué no alcanza un extractor de texto normal
 * Las boletas de ARBA traen el contenido como **glyph IDs hexadecimales** de una fuente subseteada:
 *
 * ```
 * BT /F4 16 Tf 1 0 0 -1 78 64 Tm <002D> Tj 4 0 Td <0051> Tj
 * ```
 *
 * Buscar literales entre paréntesis devuelve **cero**: no hay ninguno. Hay que leer el CMap
 * `/ToUnicode` de cada fuente y **seguir los `Tf` del contenido** para saber cuál está activa.
 *
 * 🔑 **Ese último paso es el que se olvida.** Un documento usa varias fuentes y **el mismo glyph ID
 * significa cosas distintas en cada una**. Un mapa global «que funciona» acierta mientras las
 * fuentes coincidan y falla **en silencio** cuando dejan de coincidir. → `KNOWLEDGE.md`.
 *
 * ## Qué NO hace
 * No toca los templates. Devuelve lo que dice el papel y **el usuario decide** cuál aplicar:
 * *«cambiar éste sí, éste no, todos»*.
 */

export interface BoletaArba {
  partida: string | null
  /** `1`…`4` o `anual`. */
  cuota: string | null
  anio: number | null
  impuesto: "inmobiliario" | "complementario"
  importe: number | null
  importeAnual: number | null
  vencimiento: string | null        // ISO
  proximoVencimiento: string | null // ISO
  valuacionFiscal: number | null
  baseImponible: number | null
  codigoPagoElectronico: string | null
  /** El texto plano reconstruido, para diagnosticar cuando algo no sale. */
  texto: string
  avisos: string[]
}

const BS = String.fromCharCode(92)

async function inflar(bytes: Uint8Array): Promise<string | null> {
  try {
    const ds = new DecompressionStream("deflate")
    const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds)).arrayBuffer()
    return new TextDecoder("latin1").decode(buf)
  } catch { return null }
}

/** Un CMap `/ToUnicode` → Map<glyphIdHex, texto>. */
function parseCMap(txt: string): Map<string, string> {
  const m = new Map<string, string>()
  const hexAstr = (h: string) => {
    let r = ""
    for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(parseInt(h.substr(i, 4), 16))
    return r
  }
  for (const b of txt.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      m.set(p[1].toUpperCase(), hexAstr(p[2]))
    }
  }
  for (const b of txt.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16), base = parseInt(p[3], 16)
      for (let i = lo; i <= hi && i - lo < 5000; i++) {
        m.set(i.toString(16).toUpperCase().padStart(p[1].length, "0"), String.fromCharCode(base + (i - lo)))
      }
    }
  }
  return m
}

const num = (s?: string | null): number | null => {
  if (!s) return null
  const n = parseFloat(s.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", "."))
  return isNaN(n) ? null : n
}
const fecha = (s?: string | null): string | null =>
  s && /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : null

/** Extrae el texto de la boleta decodificando los glifos con el CMap de cada fuente. */
export async function textoDeBoleta(datos: ArrayBuffer): Promise<string> {
  const buf = new Uint8Array(datos)
  const s = new TextDecoder("latin1").decode(buf)

  // Objetos del PDF: `N 0 obj … endobj`
  const objs = new Map<number, { cuerpo: string; ini: number; fin: number }>()
  for (const x of s.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const ini = (x.index ?? 0) + x[0].length
    const fin = s.indexOf("endobj", ini)
    if (fin > 0) objs.set(parseInt(x[1]), { cuerpo: s.slice(ini, fin), ini, fin })
  }
  const streamDe = async (o: { ini: number; fin: number }) => {
    const a = s.indexOf("stream", o.ini)
    if (a < 0 || a > o.fin) return null
    let st = a + 6
    if (buf[st] === 13) st++
    if (buf[st] === 10) st++
    const e = s.indexOf("endstream", st)
    return e < 0 ? null : await inflar(buf.slice(st, e))
  }

  // CMap por objeto de fuente, y el nombre (`/F4`) con el que lo llama el contenido.
  const cmapPorObjeto = new Map<number, Map<string, string>>()
  for (const [numObj, o] of objs) {
    const tu = o.cuerpo.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/)
    if (!tu) continue
    const co = objs.get(parseInt(tu[1]))
    if (!co) continue
    const cm = await streamDe(co)
    if (cm) cmapPorObjeto.set(numObj, parseCMap(cm))
  }
  const objPorNombre = new Map<string, number>()
  for (const [, o] of objs) {
    const fd = o.cuerpo.match(/\/Font\s*<<([\s\S]*?)>>/)
    if (!fd) continue
    for (const p of fd[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) objPorNombre.set(p[1], parseInt(p[2]))
  }

  let salida = ""
  let i = 0
  while (true) {
    const a = s.indexOf("stream", i)
    if (a < 0) break
    let st = a + 6
    if (buf[st] === 13) st++
    if (buf[st] === 10) st++
    const e = s.indexOf("endstream", st)
    if (e < 0) break
    const d = await inflar(buf.slice(st, e))
    if (d && /BT/.test(d)) {
      let cmap: Map<string, string> | null = null
      for (const tok of d.matchAll(/\/(\w+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj|\[([^\]]*)\]\s*TJ|\bTd\b|\bTD\b|\bT\*|\bTm\b/g)) {
        // 🔑 Cambiar de fuente cambia el significado de los glifos: hay que seguirlo.
        if (tok[1]) {
          const on = objPorNombre.get(tok[1])
          cmap = on != null ? (cmapPorObjeto.get(on) ?? null) : null
          continue
        }
        const hexes = tok[2] ? [tok[2]]
          : tok[3] ? [...tok[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map(x => x[1]) : []
        for (const h of hexes) {
          if (!cmap) continue
          for (let k = 0; k + 4 <= h.length; k += 4) salida += cmap.get(h.substr(k, 4).toUpperCase()) ?? ""
        }
        if (!hexes.length) salida += " "   // un salto de posición separa palabras
      }
      salida += "\n"
    }
    i = e + 9
  }
  return salida
}

/** Lee una boleta de ARBA. Nunca lanza: si no reconoce algo lo deja en `null` y lo dice en `avisos`. */
export async function parsearBoletaArba(datos: ArrayBuffer): Promise<BoletaArba> {
  const avisos: string[] = []
  let texto = ""
  try { texto = await textoDeBoleta(datos) } catch (e) { avisos.push("No se pudo leer el PDF: " + (e as Error).message) }

  // Sin espacios: el PDF los pone por posición y quedan entre letra y letra.
  const t = texto.replace(/\s+/g, "")
  const g = (re: RegExp) => { const m = t.match(re); return m ? m[1] : null }

  const partida = g(/PartidaN[ºo°]?(\d{3}-\d{6}-\d)/i)
  const cuotaTxt = g(/Cuota(\d)de20\d\d/)
  const esAnual = /Cuotaanual/i.test(t) && !cuotaTxt
  const anioTxt = g(/de(20\d\d)/) ?? g(/(20\d\d)/)

  const b: BoletaArba = {
    partida,
    cuota: cuotaTxt ?? (esAnual ? "anual" : null),
    anio: anioTxt ? parseInt(anioTxt) : null,
    impuesto: /Complementario/i.test(t) ? "complementario" : "inmobiliario",
    importe: num(g(/Totalapagar\$([\d.,-]+)/i)),
    importeAnual: num(g(/Importeanualapagar\$([\d.,-]+)/i)),
    vencimiento: fecha(g(/Vencimiento(\d\d\/\d\d\/\d{4})/i)),
    proximoVencimiento: fecha(g(/CUOTA\d:(\d\d\/\d\d\/\d{4})/i)),
    valuacionFiscal: num(g(/Valuaci[oó]nfiscal:\$([\d.,]+)/i)),
    baseImponible: num(g(/Baseimponible:\$([\d.,]+)/i)),
    codigoPagoElectronico: g(/dePagoElectr[oó]nico:(\d+)/i),
    texto, avisos,
  }

  if (!texto.trim()) avisos.push("El PDF no devolvió texto. ¿Es una boleta de ARBA, o es un escaneo?")
  else {
    if (!b.partida) avisos.push("No se encontró el número de partida. Los comprobantes de PAGO no la traen; el complementario tampoco.")
    if (b.importe == null) avisos.push("No se encontró el importe («Total a pagar»).")
    if (!b.cuota) avisos.push("No se pudo determinar la cuota.")
  }
  return b
}
