/**
 * 📄 Parser de ROMANEOS (frigorífico) — A-FEAT-94.
 *
 * Lee el PDF del romaneo y devuelve **una propuesta editable**, nunca un veredicto.
 *
 * ## Los tres principios de diseño, y por qué
 *
 * **1 · Nunca rechaza: siempre propone.** Aunque los controles no cierren, devuelve todo lo que
 * pudo leer y marca qué falló. *(Criterio del usuario, 2026-09-05: «si siempre toma los datos y me
 * los propone y yo puedo editar, siempre resultará ante fallas».)* Un parser que se planta el día
 * que el frigorífico mueve una columna deja al usuario sin herramienta justo cuando la necesita.
 *
 * **2 · Se DERIVA todo lo derivable; se parsea sólo lo que no.** El precio no se lee del papel: sale
 * de `importe ÷ kg`. Los totales no se leen: se suman de las filas. Los números impresos en la
 * cabecera quedan como **control**, no como fuente. Menos cosas que romper cuando cambie el formato,
 * y cada una que sí se lee tiene con qué contrastarse.
 *
 * **3 · Posicional, no textual.** El subseteo de fuentes **parte los números** (`511` sale como
 * `5`,`1`,`1`), así que un regex sobre el texto plano no puede distinguir eso de tres valores. Se
 * reconstruye con las coordenadas del operador de texto.
 *
 * ⚠️ **Multi-página**: las filas se agrupan por **(página, Y)**, nunca sólo por Y. Dos hojas
 * repiten las mismas coordenadas y las filas de una se mezclarían con las de la otra.
 * *(Riesgo señalado por el usuario antes de que ocurriera.)*
 *
 * Diseño y hallazgos del romaneo real → `MODULO_HACIENDA.md` § 19.
 */

export interface RomaneoMedia {
  garron: string
  tipo: string        // VA | TO
  clase: string       // A..E
  dientes: number | null
  contenido: string   // 'MCV/MCV' | 'ES/ES' — sin interpretar (A-DAT-21)
  peso_kg: number
  precio_kg: number | null   // se toma de la línea de liquidación que le corresponde
  orden: number
}

export interface RomaneoLinea {
  cabezas: number
  tipo: string
  clase: string
  dientes: number | null
  contenido: string
  kg_vivo: number
  kg_faena: number
  importe: number
  precio_kg: number | null   // DERIVADO: importe / kg_faena
  motivo: string | null
  orden: number
}

export interface RomaneoCabecera {
  frigorifico: string | null
  matricula: string | null
  cuit_frigorifico: string | null
  vendedor: string | null
  consignatario: string | null
  origen_estab: string | null
  tropa: string | null
  fecha_faena: string | null   // ISO
  guia: string | null
  dta: string | null
  // Impresos — se usan como CONTROL contra lo sumado, no como fuente
  cabezas_impresas: number | null
  kilos_vivos_impresos: number | null
  kilos_gancho_impresos: number | null
  rinde_impreso: number | null
  total_impreso: number | null
}

export interface ControlRomaneo {
  nombre: string
  impreso: number | null
  calculado: number
  cierra: boolean
  detalle?: string
}

export interface RomaneoParseado {
  cabecera: RomaneoCabecera
  medias: RomaneoMedia[]
  lineas: RomaneoLinea[]
  controles: ControlRomaneo[]
  /** Cabezas reales = medias ÷ 2. El garrón se repite y **no** es un duplicado. */
  cabezas: number
  kilos_gancho: number
  kilos_vivos: number
  total: number
  rinde: number | null
  paginas: number
  /** Filas crudas por página, para diagnosticar cuando algo no cierra. */
  crudo: string[]
  /** Problemas encontrados. Nunca frena el import: se muestran y el usuario decide. */
  avisos: string[]
}

// ── Descompresión de los streams del PDF ─────────────────────────────────────────────────────
//
// 🐞 **Por qué esto lleva contador.** El 2026-09-06 el parser devolvió CERO en el navegador —sin
// error, sin aviso— mientras en Node leía el mismo PDF perfecto. Con un `catch { return null }`
// mudo no había forma de saber si el problema era que no encontró streams, que no descomprimió, o
// que descomprimió y no había texto. **Un fallo silencioso no se puede diagnosticar a distancia.**
const diag = { streams: 0, inflados: 0, conTexto: 0, ultimoError: "" }

async function inflar(bytes: Uint8Array): Promise<string | null> {
  try {
    // `deflate` = zlib con cabecera (RFC 1950), que es lo que usa `/FlateDecode`.
    const ds = new DecompressionStream("deflate")
    const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds)).arrayBuffer()
    diag.inflados++
    return new TextDecoder("latin1").decode(buf)
  } catch (e) {
    // Algunos PDFs dejan bytes de relleno después del stream y eso hace fallar a
    // `DecompressionStream` (zlib los tolera). Se reintenta recortando la cola.
    for (const recorte of [1, 2, 3]) {
      try {
        const ds = new DecompressionStream("deflate")
        const b2 = bytes.slice(0, bytes.length - recorte)
        const buf = await new Response(new Blob([b2 as BlobPart]).stream().pipeThrough(ds)).arrayBuffer()
        diag.inflados++
        return new TextDecoder("latin1").decode(buf)
      } catch { /* sigue probando */ }
    }
    if (!diag.ultimoError) diag.ultimoError = (e as Error).message || String(e)
    return null
  }
}

function indiceDe(buf: Uint8Array, pat: string, desde: number): number {
  const p = [...pat].map(c => c.charCodeAt(0))
  outer: for (let i = desde; i <= buf.length - p.length; i++) {
    for (let j = 0; j < p.length; j++) if (buf[i + j] !== p[j]) continue outer
    return i
  }
  return -1
}

/**
 * Mapea **objeto de stream → página real**, leyendo el `/Contents` de cada página.
 *
 * 🐞 **A-BUG-123.** Un PDF puede partir el contenido de UNA página en VARIOS streams, y el spec
 * dice que se **concatenan y se leen como uno solo**: la matriz de texto (`Tm`) sigue corriendo de
 * un stream al siguiente. El romaneo de Arrebeef es exactamente eso — una sola página con
 * `/Contents [10 0 R … 17 0 R]` —, y tratar cada stream como una página hacía que **en cada borde
 * la coordenada volviera a 0** y la fila que quedaba a caballo se partiera en dos. Se perdían 2 de
 * las 20 medias reses (117 kg y 188 kg) y **los dientes de una línea de liquidación**, que es lo
 * que dejaba el precio de un garrón sin poder decidir.
 *
 * Devuelve `null` si no se pudo entender la estructura. Ahí el llamador vuelve al modo viejo (un
 * stream = una página): peor, pero **nunca peor que no leer nada** (§ el importador nunca rechaza).
 */
function paginasDeContenido(pdf: string): Map<number, number> | null {
  const mapa = new Map<number, number>()
  let pagina = 0
  // `/Type /Page` seguido de algo que NO sea `s`, para no agarrar el `/Type /Pages` del árbol.
  for (const m of pdf.matchAll(/\/Type\s*\/Page(?![s])/g)) {
    const ini = pdf.lastIndexOf(' obj', m.index)
    const fin = pdf.indexOf('endobj', m.index)
    const dict = pdf.slice(ini < 0 ? 0 : ini, fin < 0 ? pdf.length : fin)
    const cont = dict.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)
    if (!cont) continue
    pagina++
    // El ORDEN del array es el orden en que se concatenan; el Map guarda a qué página va cada uno.
    for (const r of cont[1].matchAll(/(\d+)\s+\d+\s+R/g)) mapa.set(Number(r[1]), pagina)
  }
  return mapa.size ? mapa : null
}

interface Pieza { pag: number; x: number; y: number; txt: string }
interface Fila { pag: number; y: number; celdas: string[]; xs: number[] }

const BS = String.fromCharCode(92)
function literal(s: string): string {
  return s.slice(1, -1).split(BS + '(').join('(').split(BS + ')').join(')').split(BS + BS).join(BS)
}

/** Recorre los operadores de texto llevando la matriz, y devuelve las piezas con su posición. */
function piezasDe(contenido: string, pag: number): Pieza[] {
  const res: Pieza[] = []
  let tm = [1, 0, 0, 1, 0, 0]
  let tlm = tm.slice()
  const tok = contenido.match(/\((?:\\.|[^\\()])*\)|\[|\]|[-\d.]+|\/[^\s/[\]()<>]+|[A-Za-z'"*]+/g) || []
  let st: string[] = []
  const num = (v: string) => parseFloat(v)
  for (const t of tok) {
    if (t === 'BT') { tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); st = []; continue }
    if (t === 'Tm') { const a = st.slice(-6).map(num); if (a.length === 6 && a.every(n => !isNaN(n))) { tm = a; tlm = a.slice() } st = []; continue }
    if (t === 'Td' || t === 'TD') {
      const a = st.slice(-2).map(num)
      if (a.length === 2 && a.every(n => !isNaN(n))) { tlm = [tlm[0], tlm[1], tlm[2], tlm[3], tlm[4] + a[0] * tlm[0], tlm[5] + a[1] * tlm[3]]; tm = tlm.slice() }
      st = []; continue
    }
    if (t === 'T*') { tm = tlm.slice(); st = []; continue }
    if (t === 'Tj' || t === "'" || t === '"') {
      const s = st[st.length - 1]
      if (s && s.startsWith('(')) res.push({ pag, x: tm[4], y: tm[5], txt: literal(s) })
      st = []; continue
    }
    if (t === 'TJ') {
      const partes = st.filter(p => p.startsWith('(')).map(literal)
      if (partes.length) res.push({ pag, x: tm[4], y: tm[5], txt: partes.join('') })
      st = []; continue
    }
    if (/^[A-Za-z]+$/.test(t)) { st = []; continue }
    st.push(t)
  }
  return res
}

/** Agrupa en filas por (PÁGINA, Y) y ordena las celdas por X, pegando lo que quedó partido. */
function filasDe(piezas: Pieza[]): Fila[] {
  // Agrupado por CERCANÍA, no por redondeo. Con `round(y/2)` dos piezas de la misma línea visual
  // caían en bins distintos si estaban a 1 unidad del borde, y la fila se partía: así se perdieron
  // 2 de las 20 medias reses en la primera prueba (garrones 509 y 512).
  const porPagina = new Map<number, Pieza[]>()
  for (const p of piezas) {
    if (!porPagina.has(p.pag)) porPagina.set(p.pag, [])
    porPagina.get(p.pag)!.push(p)
  }
  const grupos: Pieza[][] = []
  for (const ps of porPagina.values()) {
    ps.sort((a, b) => b.y - a.y)
    let actual: Pieza[] = []
    let refY: number | null = null
    for (const p of ps) {
      if (refY === null || Math.abs(p.y - refY) <= TOL_FILA) { actual.push(p); if (refY === null) refY = p.y }
      else { grupos.push(actual); actual = [p]; refY = p.y }
    }
    if (actual.length) grupos.push(actual)
  }
  const filas: Fila[] = []
  for (const ps of grupos) {
    ps.sort((a, b) => a.x - b.x)
    const celdas: string[] = []
    const xs: number[] = []
    let finAnterior: number | null = null
    for (const p of ps) {
      // Muy pegado al anterior → es el mismo valor que el subseteo partió («5»+«1»+«1» = 511)
      if (finAnterior !== null && p.x - finAnterior < 6) celdas[celdas.length - 1] += p.txt
      else { celdas.push(p.txt); xs.push(p.x) }
      finAnterior = p.x + p.txt.length * 5
    }
    const c: string[] = []
    const x: number[] = []
    celdas.forEach((v, k) => { if (v.trim()) { c.push(v.trim()); x.push(xs[k]) } })
    if (c.length) filas.push({ pag: ps[0].pag, y: ps[0].y, celdas: c, xs: x })
  }
  return filas.sort((a, b) => a.pag - b.pag || b.y - a.y)
}

// ── Helpers de números en formato es-AR ──────────────────────────────────────────────────────
const aNum = (s: string): number => {
  const t = String(s).trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isNaN(n) ? NaN : n
}
/** «1.0» / «2.0» son CABEZAS con punto decimal, no miles: `aNum` les sacaría el punto y daría 10. */
const aCabezas = (s: string): number => {
  const t = String(s).trim()
  return /^\d+[.,]\d$/.test(t) ? parseFloat(t.replace(',', '.')) : aNum(t)
}
/** Tolerancia vertical para considerar que dos piezas están en la misma línea visual. */
const TOL_FILA = 10
const esEntero = (s: string) => /^\d+$/.test(s.trim())
const esDecimal = (s: string) => /^[\d.]+,\d+$/.test(s.trim()) || /^\d+(\.\d{3})+$/.test(s.trim())
const TIPOS = /^(VA|TO|VQ|NO|MJ|TE)$/i     // tipos de hacienda del romaneo; se aceptan otros, no se filtran
const CLASES = /^[A-Z]$/

/**
 * Los dientes: el primer entero corto entre la CLASE y el CONTENIDO.
 *
 * No se toma por índice fijo porque **la cantidad de columnas intermedias varía** entre el detalle
 * y la liquidación, y entre filas de la misma tabla. Y los dientes importan: mueven el precio tanto
 * como la clase (una vaca D con 1 diente vale más que una D con 0) — `MODULO_HACIENDA` § 19.2.
 */
function dientesEntre(celdas: string[], desde: number, hasta: number): number | null {
  for (let i = desde; i < hasta && i < celdas.length; i++) {
    const v = (celdas[i] || '').trim()
    if (/^\d$/.test(v)) return parseInt(v)     // un solo dígito: 0, 1 o 2
  }
  return null
}

/**
 * Parsea el PDF de un romaneo.
 * @param datos el archivo subido por el usuario
 */
export interface GarronIncompleto {
  garron: string
  /** Cuántas medias se leyeron de ese animal. Tendrían que ser 2. */
  leidas: number
  /** Los kilos de la media que falta, **o `null` si no se pudieron derivar sin elegir al azar**. */
  falta: number | null
}

/**
 * Los garrones a los que les falta una media res, **con el kilo que falta cuando se puede derivar**.
 *
 * Derivar no es adivinar: si la línea de liquidación del garrón es de **una sola cabeza**, sus kilos
 * son los de ese animal entero, y lo que falta es la resta. Se exige **una única línea candidata** —
 * con dos no se propone nada y el usuario lo completa a mano, que es la misma regla con la que se
 * asigna el precio (§ nada se elige al azar).
 *
 * 📌 Aparte de `parsearRomaneo` porque es la red del importador y hay que poder probarla con un
 * romaneo al que le falte una fila **sin tener ese PDF**.
 */
export function garronesIncompletos(
  medias: Pick<RomaneoMedia, 'garron' | 'tipo' | 'clase' | 'contenido' | 'peso_kg'>[],
  lineas: Pick<RomaneoLinea, 'cabezas' | 'tipo' | 'clase' | 'contenido' | 'kg_faena'>[],
): GarronIncompleto[] {
  const porGarron = new Map<string, typeof medias>()
  for (const m of medias) {
    if (!porGarron.has(m.garron)) porGarron.set(m.garron, [])
    porGarron.get(m.garron)!.push(m)
  }
  return [...porGarron.entries()]
    .filter(([, ms]) => ms.length < 2)
    .map(([garron, ms]) => {
      const leido = ms.reduce((s, m) => s + m.peso_kg, 0)
      const cands = lineas.filter(x => x.cabezas === 1 && x.tipo === ms[0].tipo
        && x.clase === ms[0].clase && x.contenido === ms[0].contenido && x.kg_faena > leido)
      return {
        garron, leidas: ms.length,
        falta: cands.length === 1 ? Math.round((cands[0].kg_faena - leido) * 100) / 100 : null,
      }
    })
}

export async function parsearRomaneo(datos: ArrayBuffer): Promise<RomaneoParseado> {
  const buf = new Uint8Array(datos)
  diag.streams = 0; diag.inflados = 0; diag.conTexto = 0; diag.ultimoError = ""
  const piezas: Pieza[] = []

  // 🐞 **A-BUG-123** — los streams se agrupan por la página REAL antes de leerlos. Latin1 es 1 byte
  // = 1 carácter, así que los offsets del texto y los del buffer son los mismos.
  const pdfTxt = new TextDecoder('latin1').decode(buf)
  const mapaPag = paginasDeContenido(pdfTxt)
  const cabecerasObj = [...pdfTxt.matchAll(/(\d+)\s+\d+\s+obj\b/g)].map(m => ({ i: m.index, num: Number(m[1]) }))
  /** A qué objeto pertenece el stream que empieza en `off`: el último «N 0 obj» antes de él. */
  const objDe = (off: number): number | null => {
    let r: number | null = null
    for (const c of cabecerasObj) { if (c.i < off) r = c.num; else break }
    return r
  }

  const porPagina = new Map<number, string[]>()
  let sueltos = 0
  let i = 0
  while (true) {
    const a = indiceDe(buf, 'stream', i)
    if (a < 0) break
    let st = a + 6
    if (buf[st] === 13) st++
    if (buf[st] === 10) st++
    const e = indiceDe(buf, 'endstream', st)
    if (e < 0) break
    diag.streams++
    const texto = await inflar(buf.slice(st, e))
    if (texto && /BT/.test(texto) && /Tj|TJ/.test(texto)) {
      diag.conTexto++
      const num = objDe(a)
      // Un stream con texto que NO cuelga de ninguna página (un Form XObject, por ejemplo) se lee
      // igual, pero **aislado**: se le da un número alto para que no se mezcle con una página real.
      const pg = (mapaPag && num != null ? mapaPag.get(num) : null) ?? (1000 + ++sueltos)
      if (!porPagina.has(pg)) porPagina.set(pg, [])
      porPagina.get(pg)!.push(texto)
    }
    i = e + 9
  }

  // Los streams de una misma página se concatenan y se leen de una sola pasada: así el `Tm` corre
  // entre ellos y la fila del borde no se parte. El separador es un salto, como pide el spec.
  for (const [pg, textos] of [...porPagina.entries()].sort((x, y) => x[0] - y[0])) {
    piezas.push(...piezasDe(textos.join('\n'), pg))
  }
  const pag = [...porPagina.keys()].filter(p => p < 1000).length || porPagina.size

  const filas = filasDe(piezas)
  const crudo = filas.map(f => `p${f.pag} y${Math.round(f.y)} | ${f.celdas.join(' § ')}`)
  const avisos: string[] = []

  // ── Detalle: una fila por MEDIA RES ────────────────────────────────────────────────────────
  // Forma: garrón(2-4 díg) · TIPO · CLASE · dientes · … · contenido(con «/») · peso
  const medias: RomaneoMedia[] = []
  for (const f of filas) {
    const c = f.celdas
    if (c.length < 5) continue
    if (!esEntero(c[0]) || c[0].length > 4) continue
    if (!TIPOS.test(c[1] || '') || !CLASES.test(c[2] || '')) continue
    const iCont = c.findIndex(x => x.includes('/') && /[A-Za-z]/.test(x))
    if (iCont < 0) continue
    const peso = aNum(c[iCont + 1] ?? '')
    if (isNaN(peso) || peso <= 0) continue
    medias.push({
      garron: c[0], tipo: c[1].toUpperCase(), clase: c[2].toUpperCase(),
      dientes: dientesEntre(c, 3, iCont),
      contenido: c[iCont], peso_kg: peso, precio_kg: null, orden: medias.length + 1,
    })
  }

  // ── Liquidación: una fila por grupo de precio ──────────────────────────────────────────────
  // Forma: cabezas(«1.0») · TIPO · CLASE · dientes · … · contenido · vivo · faena · importe
  const lineas: RomaneoLinea[] = []
  for (const f of filas) {
    const c = f.celdas
    if (c.length < 6) continue
    if (!/^\d+[.,]\d$/.test(c[0] || '')) continue
    if (!TIPOS.test(c[1] || '') || !CLASES.test(c[2] || '')) continue
    const iCont = c.findIndex(x => x.includes('/') && /[A-Za-z]/.test(x))
    if (iCont < 0 || c.length < iCont + 4) continue
    const vivo = aNum(c[iCont + 1]), faena = aNum(c[iCont + 2]), importe = aNum(c[iCont + 3])
    if ([vivo, faena, importe].some(n => isNaN(n))) continue
    lineas.push({
      cabezas: aCabezas(c[0]),
      tipo: c[1].toUpperCase(), clase: c[2].toUpperCase(),
      dientes: dientesEntre(c, 3, iCont),
      contenido: c[iCont], kg_vivo: vivo, kg_faena: faena, importe,
      // DERIVADO, no leído: es exacto y no depende de dónde imprima el precio el frigorífico.
      precio_kg: faena > 0 ? Math.round((importe / faena) * 100) / 100 : null,
      motivo: null, orden: lineas.length + 1,
    })
  }

  // El precio de cada media sale de su línea de liquidación.
  //
  // 🐞 **Con reserva en los dientes, pero SIN adivinar** (A-BUG-116 y su secuela, A-BUG-118).
  // Exigir `tipo+clase+dientes+contenido` dejaba 3 medias sin precio: dos líneas quedan con
  // `dientes: null` porque el PDF parte esa celda. Pero relajarlo a «la primera que coincida en
  // tipo+clase+contenido» fue peor: hay **dos** líneas `VA C` —una a $5.800 y otra a $6.600— y el
  // garrón 512 se iba a la barata **en silencio**, con lo que su grupo de precio quedaba mal.
  //
  // 🔑 Cuando los dientes no alcanzan, desempata **el kilo de res**: el garrón completo pesa lo que
  // dice su línea si esa línea es de una sola cabeza. Y si ni así se puede decidir, **queda sin
  // precio y se avisa** — una media en el grupo equivocado es peor que una media sin grupo.
  const ganchoPorGarron = new Map<string, number>()
  for (const m of medias) ganchoPorGarron.set(m.garron, (ganchoPorGarron.get(m.garron) ?? 0) + m.peso_kg)

  let ambiguas = 0
  for (const m of medias) {
    const mismo = (x: RomaneoLinea) => x.tipo === m.tipo && x.clase === m.clase && x.contenido === m.contenido
    const exacta = lineas.find(x => mismo(x) && x.dientes === m.dientes)
    if (exacta) { m.precio_kg = exacta.precio_kg; continue }

    const cands = lineas.filter(mismo)
    if (cands.length === 1) { m.precio_kg = cands[0].precio_kg; continue }
    if (cands.length === 0) continue

    // Desempate por peso: el garrón entero contra una línea de UNA cabeza.
    const gancho = ganchoPorGarron.get(m.garron) ?? 0
    const porPeso = cands.filter(x => x.cabezas === 1 && Math.abs(x.kg_faena - gancho) <= 1)
    if (porPeso.length === 1) { m.precio_kg = porPeso[0].precio_kg; continue }
    ambiguas++
  }
  if (ambiguas) {
    avisos.push(`${ambiguas} media(s) res tienen más de una línea posible y no se pudo decidir cuál. `
      + `Su grupo de precio queda sin asignar (no se elige al azar).`)
  }

  // ── Cabecera ───────────────────────────────────────────────────────────────────────────────
  const plano = filas.map(f => f.celdas.join(' ')).join('\n')
  const buscar = (re: RegExp): string | null => { const m = plano.match(re); return m ? m[1].trim() : null }

  /**
   * Busca el valor de un campo por **cercanía a su etiqueta**, no por regex sobre el texto plano.
   *
   * En el romaneo la etiqueta y su valor caen en líneas distintas («Kilos Gancho:» arriba, `3354`
   * abajo) y varias etiquetas comparten línea. Un regex `Etiqueta:\s*(\d+)` sobre el texto aplanado
   * agarra el número de la etiqueta de al lado — así salieron mal `guia`, `dta` y `tropa` en la
   * primera prueba. Acá se toma el valor **más cercano en X** dentro de una banda vertical, que es
   * lo que hace un ojo humano y aguanta que muevan las columnas.
   */
  const cercaDe = (etiqueta: RegExp, ok: (s: string) => boolean, bandaY = 40): string | null => {
    let mejor: { d: number; txt: string } | null = null
    for (const f of filas) {
      const iEt = f.celdas.findIndex(c => etiqueta.test(c))
      if (iEt < 0) continue
      const xEt = f.xs[iEt]
      // Primero en la MISMA celda («Estab Faenador: ARRE BEEF») o en la de al lado
      for (let j = iEt + 1; j < f.celdas.length; j++) {
        if (ok(f.celdas[j])) { const d = Math.abs(f.xs[j] - xEt); if (!mejor || d < mejor.d) mejor = { d, txt: f.celdas[j] } }
      }
      // Después, en las filas de la banda vertical, el más alineado en X
      for (const g of filas) {
        if (g.pag !== f.pag || Math.abs(g.y - f.y) > bandaY || g === f) continue
        for (let j = 0; j < g.celdas.length; j++) {
          if (!ok(g.celdas[j])) continue
          const d = Math.abs(g.xs[j] - xEt) + Math.abs(g.y - f.y) / 4
          if (!mejor || d < mejor.d) mejor = { d, txt: g.celdas[j] }
        }
      }
    }
    return mejor ? mejor.txt.trim() : null
  }
  const numCerca = (etiqueta: RegExp): number | null => {
    const v = cercaDe(etiqueta, s => /^[\d.,]+$/.test(s.trim()) && /\d/.test(s))
    if (v == null) return null
    const n = aNum(v)
    return isNaN(n) ? null : n
  }
  const txtCerca = (etiqueta: RegExp) => cercaDe(etiqueta, s => /\d{4,}/.test(s.trim()))
  const fechaTxt = buscar(/(\d{2}\/\d{2}\/\d{4})/)
  const cabecera: RomaneoCabecera = {
    frigorifico: buscar(/Estab\s*Faenador:\s*([^§\n]+?)(?:\s*Matricula|$)/i),
    matricula: buscar(/Matricula:\s*(\d+)/i),
    cuit_frigorifico: buscar(/CUIT:\s*([\d-]+)/i),
    vendedor: buscar(/Vendedor\s*:?\s*\n?\s*([^\n]+)/i),
    // Si lo que sigue a la etiqueta es OTRA etiqueta (lleva «:»), el campo está vacío en el papel.
    // Devolver el texto de al lado sería inventarle un consignatario a una venta que no lo tuvo.
    consignatario: (() => {
      const v = buscar(/Consignatario:\s*([^\n]+)/i)
      return v && !v.includes(':') ? v : null
    })(),
    origen_estab: buscar(/Origen:\s*([^\n]+)/i),
    tropa: txtCerca(/TROPA/i),
    fecha_faena: fechaTxt ? `${fechaTxt.slice(6, 10)}-${fechaTxt.slice(3, 5)}-${fechaTxt.slice(0, 2)}` : null,
    guia: txtCerca(/^Guia/i),
    dta: txtCerca(/^DTA/i),
    cabezas_impresas: numCerca(/Cabezas\s*Faenadas/i),
    kilos_vivos_impresos: numCerca(/Kilos\s*Vivos/i),
    kilos_gancho_impresos: numCerca(/Kilos\s*Gancho/i),
    rinde_impreso: numCerca(/^Rinde/i),
    // El total impreso es **la mayor** cifra con decimales del papel: cada línea de liquidación
    // imprime su propio importe, y tomar «la primera que aparezca» devolvía el de la primera línea
    // ($700.800 en vez de $18.750.900). El total es, por definición, el más grande de todos.
    total_impreso: (() => {
      // ⚠️ El total lo imprimen en formato de MÁQUINA (`18750900.000`, punto decimal) mientras que
      // las líneas usan es-AR (`700800,00`). Leerlo con la convención local daba 18.750.900.000 —
      // mil veces el valor. Acá el punto con 3 decimales sobre una cifra de 6+ dígitos se toma como
      // decimal; ese caso no puede confundirse con miles porque el regex ya exige 6 dígitos antes.
      const todos = [...plano.matchAll(/(\d{6,}[.,]\d{2,3})/g)]
        .map(m => parseFloat(m[1].replace(',', '.')))
        .filter(n => !isNaN(n))
      return todos.length ? Math.max(...todos) : null
    })(),
  }

  // ── Totales CALCULADOS (la fuente) ─────────────────────────────────────────────────────────
  const kgMedias = medias.reduce((s, m) => s + m.peso_kg, 0)
  const kilos_gancho = lineas.reduce((s, l) => s + l.kg_faena, 0)
  const kilos_vivos = lineas.reduce((s, l) => s + l.kg_vivo, 0)
  const total = lineas.reduce((s, l) => s + l.importe, 0)
  const cabezas = lineas.reduce((s, l) => s + l.cabezas, 0)
  const rinde = kilos_vivos > 0 ? Math.round((kilos_gancho / kilos_vivos) * 10000) / 100 : null

  // ── Cuántas medias TIENE que haber ─────────────────────────────────────────────────────────
  // Pedido del usuario (2026-09-07): *«el sistema debería esperar y estar preparado para 20 medias
  // res por haber cargado 10 cabezas; y si no las encuentra, dejarlo listo para que complete el
  // usuario»*. La liquidación trae las cabezas **explícitas**, así que las medias esperadas no son
  // una suposición: son un dato del papel — 2 por animal.
  //
  // 🔑 Esto es la red para el PRÓXIMO romaneo, no para éste. `A-BUG-123` hizo que las 20 aparezcan;
  // el control es lo que avisa el día que el frigorífico vuelva a mover algo y se pierda otra.
  const mediasEsperadas = cabezas * 2
  const incompletos = garronesIncompletos(medias, lineas)

  // ── Controles: lo calculado contra lo IMPRESO en el mismo papel ────────────────────────────
  const cerca = (a: number, b: number | null, tol = 1) => b != null && Math.abs(a - b) <= tol
  const controles: ControlRomaneo[] = [
    { nombre: 'Kilos gancho (líneas vs. impreso)', impreso: cabecera.kilos_gancho_impresos, calculado: kilos_gancho, cierra: cerca(kilos_gancho, cabecera.kilos_gancho_impresos) },
    { nombre: 'Kilos gancho (medias reses vs. líneas)', impreso: kilos_gancho, calculado: kgMedias, cierra: cerca(kgMedias, kilos_gancho), detalle: `${medias.length} medias res` },
    { nombre: 'Kilos vivos', impreso: cabecera.kilos_vivos_impresos, calculado: kilos_vivos, cierra: cerca(kilos_vivos, cabecera.kilos_vivos_impresos) },
    { nombre: 'Cabezas', impreso: cabecera.cabezas_impresas, calculado: cabezas, cierra: cerca(cabezas, cabecera.cabezas_impresas, 0) },
    {
      nombre: 'Medias reses (2 por cabeza)', impreso: mediasEsperadas || null, calculado: medias.length,
      cierra: mediasEsperadas > 0 && medias.length === mediasEsperadas,
      detalle: incompletos.length
        ? `Incompleto${incompletos.length > 1 ? 's' : ''}: ${incompletos.map(x => x.falta != null ? `garrón ${x.garron} (falta ${x.falta} kg)` : `garrón ${x.garron}`).join(', ')}`
        : undefined,
    },
    { nombre: 'Total liquidado', impreso: cabecera.total_impreso, calculado: total, cierra: cerca(total, cabecera.total_impreso, 1) },
    { nombre: 'Rinde %', impreso: cabecera.rinde_impreso, calculado: rinde ?? 0, cierra: cerca(rinde ?? 0, cabecera.rinde_impreso, 0.05) },
  ]

  // ── Avisos: nunca frenan, sólo se muestran ─────────────────────────────────────────────────
  if (!lineas.length) avisos.push('No se reconoció ninguna línea de liquidación. Cargá los datos a mano.')
  if (!medias.length) avisos.push('No se reconoció el detalle por media res. La liquidación puede seguir sirviendo.')

  // 🔬 Cuando NO salió nada, el aviso tiene que decir DÓNDE se cortó. Sin esto el usuario ve
  // «no reconoció nada» y no hay manera de saber si el PDF no traía streams, si no se pudieron
  // descomprimir, o si se descomprimieron y adentro no había texto. Cada caso se arregla distinto.
  if (!lineas.length && !medias.length) {
    const hayDS = typeof DecompressionStream !== 'undefined'
    avisos.push(
      `Diagnóstico: ${diag.streams} stream(s) en el PDF · ${diag.inflados} descomprimido(s) · ` +
      `${diag.conTexto} con texto · ${filas.length} fila(s) reconstruida(s)` +
      (hayDS ? '' : ' · ⚠️ este navegador NO tiene DecompressionStream') +
      (diag.ultimoError ? ` · primer error: ${diag.ultimoError}` : '')
    )
    if (diag.streams === 0) avisos.push('El archivo no parece un PDF con streams. ¿Se subió el archivo correcto?')
    else if (diag.inflados === 0) avisos.push('Ningún stream se pudo descomprimir. Puede ser un PDF con otro filtro (no FlateDecode) o cifrado.')
    else if (diag.conTexto === 0) avisos.push('Los streams se descomprimieron pero ninguno tiene texto: el PDF puede ser un ESCANEO (imagen).')
  }
  // El papel dice cuántas tiene que haber; si no aparecen, se nombra CUÁL falta y CUÁNTO, para que
  // completarlo sea escribir un número y no ponerse a investigar el PDF.
  if (medias.length && mediasEsperadas && medias.length < mediasEsperadas) {
    const det = incompletos.map(x => x.falta != null
      ? `al garrón ${x.garron} le falta una media de ${x.falta} kg`
      : `al garrón ${x.garron} le falta una media (el kilo no se pudo derivar: hay más de una línea posible)`)
    avisos.push(
      `La liquidación declara ${cabezas} cabeza(s), o sea ${mediasEsperadas} medias reses, y se leyeron ${medias.length}. `
      + (det.length ? `${det.join('; ')}. ` : '')
      + `Corregí el kilo de res del garrón en la tabla de abajo y las cuentas se rehacen solas.`
    )
  } else if (medias.length && medias.length % 2 !== 0) {
    avisos.push(`Hay ${medias.length} medias reses, un número impar. Deberían ser 2 por animal — puede faltar una fila.`)
  }
  const sinPrecio = medias.filter(m => m.precio_kg == null).length
  if (sinPrecio) avisos.push(`${sinPrecio} media(s) res no encontraron su línea de liquidación (no se les pudo asignar precio).`)
  for (const l of lineas) {
    if (l.precio_kg != null && Math.abs(l.kg_faena * l.precio_kg - l.importe) > 1) {
      avisos.push(`La línea ${l.tipo} ${l.clase}: ${l.kg_faena} kg × ${l.precio_kg} no da ${l.importe}.`)
    }
  }

  return {
    cabecera, medias, lineas, controles,
    // 🐞 Manda la LIQUIDACIÓN, no las medias reses (A-BUG-115). Las medias son 2 por animal,
    // pero si el PDF pierde alguna —como pasa con 2 de las 20 de este romaneo— dividir por 2 da
    // **9 cabezas en vez de 10**, y ese número se guarda y después se lee como si fuera cierto.
    // La liquidación trae las cabezas explícitas y coincide con el total impreso.
    cabezas: cabezas || (medias.length ? medias.length / 2 : 0),
    kilos_gancho, kilos_vivos, total, rinde, paginas: pag, crudo, avisos,
  }
}
