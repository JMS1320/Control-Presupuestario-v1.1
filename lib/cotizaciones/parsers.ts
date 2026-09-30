/**
 * 💱 **LOS PARSERS DE COTIZACIONES — BNA y Pizarra de Rosario.**
 *
 * Pedido del usuario 2026-09-29, con las fuentes elegidas por él:
 * > *«[BNA] ahí tenés una sección… está posicionado en billetes pero se elige **divisas** y el dato
 * > tiene compra y venta, **tomar los dos**»* · *«[BCR] acá se busca el precio pizarra de la soja y
 * > otros para el futuro, **maíz también** tomarlo»* · *«será bueno tomar siempre los datos **día por
 * > día** así nos queda el histórico»*.
 *
 * ## 🔑 Por qué están acá y no adentro de la ruta
 *
 * Porque **parsear HTML ajeno es lo que se rompe**, y lo que se rompe hay que poder probarlo sin red.
 * Estas funciones reciben **texto** y devuelven **números**: entran en `lib/pruebas/casos.ts` con un
 * fragmento real guardado, así que el día que el sitio cambie el caso falla y dice dónde.
 *
 * Es la misma lección de `app/api/precios-por-cabeza`: ahí la documentación de **cómo encontrar el
 * endpoint si el sitio cambia** valió más que el código.
 *
 * ## ⚠️ BNA: la trampa es la solapa
 *
 * La página abre en **Cotización Billetes** y el usuario pidió **Divisas**, que es la otra solapa y
 * son **valores distintos** — medido el 29/09/2026: Billetes 1495/1545, **Divisas 1513/1522**. Las
 * dos tablas están en el mismo HTML, así que un parser que agarre «la primera tabla» trae la
 * equivocada **y no falla**: devuelve un número plausible. Por eso se ancla en `id="divisas"`.
 *
 * ## ⚠️ BCR: no es una tabla, es un formulario
 *
 * `https://www.cac.bcr.com.ar/es/precios-de-pizarra/consultas` es un form de Drupal por **GET**:
 * `?product=<id>&type=pizarra&period=day&date_start=AAAA-MM-DD&date_end=AAAA-MM-DD`.
 *
 * 📌 **Los ids de producto**, medidos el 29/09/2026: **Trigo 8 · Maíz 3 · Girasol 9 · Soja 13 ·
 * Sorgo 6**. Y `type`: `pizarra` · `estimativo` · `any` · `average`. Si algún día no devuelve nada,
 * lo primero a mirar es si cambiaron estos ids — el sitio no avisa, simplemente trae una tabla vacía.
 */

/** Una cotización leída de una fuente, lista para guardar. */
export interface CotizacionLeida {
  /** `AAAA-MM-DD`. */
  fecha: string
  compra?: number
  venta?: number
  valor?: number
}

/**
 * `1.513,0000` → `1513`. Formato argentino: punto de miles, coma decimal.
 *
 * ⚠️ El BNA los manda **sin** separador de miles (`1513.0000`), con el punto como **decimal**, y la
 * BCR **con** los dos (`$560.000,00`). Una sola función no puede adivinar cuál es cuál, así que cada
 * parser dice qué formato le llega. Confundirlos da 560 en vez de 560.000 — plausible y equivocado.
 */
export function numeroConComa(v: string): number | null {
  const limpio = String(v).replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : null
}

/** `1513.0000` → `1513`. Punto DECIMAL, sin separador de miles. Es el formato del BNA. */
export function numeroConPunto(v: string): number | null {
  const n = parseFloat(String(v).replace(/[$\s]/g, ""))
  return Number.isFinite(n) ? n : null
}

/** `29/9/2026` → `2026-09-29`. */
export function fechaArgentina(v: string): string | null {
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mes, a] = m
  return `${a}-${mes.padStart(2, "0")}-${d.padStart(2, "0")}`
}

/**
 * Saca las etiquetas y deja el texto separado por `|`, que es como se recorre una tabla.
 *
 * 🧨 **Los separadores se colapsan CON los espacios del medio**, y ese detalle me costó una vuelta:
 * el HTML real trae saltos de línea entre `</td>` y `<td>`, así que queda `| 01/09/2026 | | $560…`
 * —con un espacio entre los dos `|`— y un colapso de `\|+` a secas **no lo junta**. El parser
 * andaba contra el recorte de prueba y devolvía **cero** contra la página de verdad.
 *
 * 📌 La lección para el próximo parser: el fixture hay que copiarlo **tal cual viene**, con sus
 * espacios, o prueba otra cosa.
 */
const aTexto = (html: string) =>
  html.replace(/<[^>]+>/g, "|").replace(/\s+/g, " ").replace(/(\s*\|\s*)+/g, "|")

/**
 * Lee la tabla de **DIVISAS** del BNA.
 *
 * @param html  la página `https://www.bna.com.ar/Personas` entera
 * @param moneda  cómo se llama la fila: `Dolar U.S.A`, `Euro`…
 *
 * 🛑 **Devuelve `null` en vez de adivinar.** Si no encuentra la solapa de divisas o la fila pedida,
 * no cae a la de billetes: un dólar equivocado se propaga a todo lo que está en dólares y **nadie lo
 * nota**, porque el número se ve bien.
 */
export function leerBnaDivisas(html: string, moneda: string): CotizacionLeida | null {
  const i = html.indexOf('id="divisas"')
  if (i < 0) return null
  const txt = aTexto(html.slice(i, i + 4000))

  // La fecha está arriba de la tabla, con el formato `29/9/2026`.
  const mFecha = txt.match(/\|(\d{1,2}\/\d{1,2}\/\d{4})\|/)
  const fecha = mFecha ? fechaArgentina(mFecha[1]) : null
  if (!fecha) return null

  // La fila: `|Dolar U.S.A|1513.0000|1522.0000|Libra Esterlina|1999.1269|…`
  const j = txt.indexOf(`|${moneda}|`)
  if (j < 0) return null

  /**
   * 🧨 **Se parte por `|` en vez de buscar `|número|` con una expresión regular**, y no es una
   * cuestión de gusto: un `match` global **consume el `|` de cierre**, así que la siguiente celda ya
   * no tiene su `|` de apertura y no matchea. El parser saltaba a la fila de abajo y devolvía la
   * **compra de la Libra Esterlina (1.999,13) como venta del dólar**.
   *
   * 🔑 Lo encontró un caso antes de que llegara a la app, y es el motivo de que estos parsers vivan
   * en `lib/` con un recorte real guardado: el número equivocado era **plausible**.
   */
  const celdas = txt.slice(j + 1).split("|").map(c => c.trim()).filter(Boolean)
  // La primera celda es el nombre de la moneda; las dos siguientes que sean números son sus valores.
  const numeros: number[] = []
  for (const c of celdas.slice(1)) {
    const n = numeroConPunto(c)
    if (n == null) break          // llegó al nombre de la moneda siguiente: la fila terminó
    numeros.push(n)
    if (numeros.length === 2) break
  }
  if (numeros.length < 2) return null
  return { fecha, compra: numeros[0], venta: numeros[1] }
}

/**
 * Lee la tabla de resultados de la **pizarra de Rosario**.
 *
 * Devuelve **la serie entera** del rango pedido, un elemento por día hábil — que es lo que permite
 * tener el histórico sin pedir día por día.
 *
 * 📌 El precio viene en **pesos por tonelada** (`$560.000,00`). No se convierte a nada acá: la unidad
 * queda declarada en `cotizacion_series` y convertir en el parser es cómo se pierde.
 */
export function leerPizarraBcr(html: string, desde?: string, hasta?: string): CotizacionLeida[] {
  const m = html.match(/<table[\s\S]*?<\/table>/)
  if (!m) return []
  const txt = aTexto(m[0])

  const filas: CotizacionLeida[] = []
  // `| 01/09/2026 | | $560.000,00 |`
  /**
   * 🧨 **El `|` de cierre va en un LOOKAHEAD, no se consume.**
   *
   * Con `\|` al final, un `match` global se come el separador y la fila siguiente se queda **sin su
   * `|` de apertura**: el parser devolvía **una fila de cada dos**. Y no fallaba — devolvía la mitad
   * de los días con cara de serie completa, que es el peor resultado posible para un promedio.
   *
   * 📌 Es el **mismo error** que había en `leerBnaDivisas`, encontrado el mismo día y en el mismo
   * archivo. Por eso allá se resolvió partiendo por `|` en vez de con una expresión regular.
   */
  const re = /\|(\d{1,2}\/\d{1,2}\/\d{4})\|\$?([\d.,]+)(?=\|)/g
  let x: RegExpExecArray | null
  while ((x = re.exec(txt)) !== null) {
    const fecha = fechaArgentina(x[1])
    const valor = numeroConComa(x[2])
    if (!fecha || valor == null) continue
    /**
     * ⚠️ **Se filtra por el rango pedido a propósito**: la página trae una fecha suelta de 2018 en
     * otro elemento, y si entra al histórico queda un precio de hace ocho años metido en la serie
     * — un dato viejo mezclado no se ve, sólo desvía los promedios.
     */
    if (desde && fecha < desde) continue
    if (hasta && fecha > hasta) continue
    filas.push({ fecha, valor })
  }
  return filas
}

/** Los ids de producto de la BCR, medidos el 2026-09-29. Ver la nota del encabezado. */
export const PRODUCTOS_BCR = { trigo: 8, maiz: 3, girasol: 9, soja: 13, sorgo: 6 } as const

/**
 * Arma la URL de consulta de la pizarra para un producto, un rango de fechas y **una página**.
 *
 * 🧨 **La consulta está PAGINADA de a 10 días y eso no se ve.** Pedir septiembre de 2026 entero
 * devuelve **10 filas** —del 01 al 14— y parece la respuesta completa: no hay ningún aviso de que
 * falta la mitad del mes. Medido el 2026-09-29: `page=2` trae del 15 al 28.
 *
 * 📌 `page` arranca en **1** y `page=0` devuelve lo mismo que `page=1`.
 */
export function urlPizarra(
  producto: keyof typeof PRODUCTOS_BCR, desde: string, hasta: string, pagina = 1,
): string {
  return "https://www.cac.bcr.com.ar/es/precios-de-pizarra/consultas"
    + `?product=${PRODUCTOS_BCR[producto]}&type=pizarra&period=day`
    + `&date_start=${desde}&date_end=${hasta}&page=${pagina}`
}

/** Cuántas filas trae una página de la pizarra. Si el sitio lo cambia, el recorrido lo detecta solo. */
export const FILAS_POR_PAGINA_BCR = 10

/**
 * 🧮 El **promedio del mes** de una serie, que es lo que el usuario pidió usar en todos lados
 * (*«siempre promedio del mes»*).
 *
 * ⚠️ Promedia **los días que cotizaron**, no los 30 del mes: en la pizarra no hay fines de semana ni
 * feriados, y dividir por 30 daría un promedio más bajo que cualquier día real.
 *
 * 🛑 Devuelve `null` si no hay ningún dato — **no cero**. Un cero acá se propagaría como un precio de
 * mercado que no existe.
 */
export function promedioDelMes(
  filas: Array<{ fecha: string; valor?: number | null; compra?: number | null; venta?: number | null }>,
  mes: string,
  campo: "valor" | "compra" | "venta" = "valor",
): number | null {
  const delMes = filas.filter(f => f.fecha.startsWith(mes) && f[campo] != null)
  if (delMes.length === 0) return null
  const suma = delMes.reduce((s, f) => s + Number(f[campo]), 0)
  return Math.round((suma / delMes.length) * 10000) / 10000
}
