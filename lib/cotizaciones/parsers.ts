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

// ══════════════════════════════════════════════════════════════════════════════════════════
// 📅 EL HISTÓRICO DEL DÓLAR
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * 🔑 **El BNA sólo publica el día de hoy**, así que el histórico tiene que venir de otro lado.
 * Pedido del usuario 2026-09-29: *«el precio histórico es correcto que sea el real y no el estimado
 * en algún momento… BNA tiene buscador para histórico pero eso se puede buscar en alguna web que dé
 * la data mejor»*.
 *
 * ## Qué serie es la que corresponde, y por qué NO es la que dice «oficial»
 *
 * `api.argentinadatos.com` publica varias «casas». La que se llama **`oficial` es el BILLETE** del
 * BNA, y el usuario pidió **DIVISAS**. La que corresponde es **`mayorista`**.
 *
 * 🧮 **Y está verificado, no deducido**: el 29/09/2026 el BNA Divisas daba **1513 / 1522** y
 * `mayorista` devuelve **exactamente 1513 / 1522**, mientras que `oficial` devuelve 1495 / 1545 —
 * que es el billete. **Elegir la casa por el nombre habría traído la serie equivocada sin fallar.**
 *
 * 📌 Cubre desde **2011-01-03**, unos 5.750 días.
 */
export const URL_HISTORICO_DOLAR = "https://api.argentinadatos.com/v1/cotizaciones/dolares/mayorista"

/**
 * 🧮 **La segunda fuente, para el control.** El BCRA publica la cotización de referencia (A 3500) por
 * fecha y por moneda. Sirve para dos cosas: **cruzar** el histórico del dólar —el 29/09 las dos dan
 * 1522 de venta— y traer el **euro**, que `argentinadatos` no tiene.
 *
 * `…/Cotizaciones/USD?fechadesde=AAAA-MM-DD&fechahasta=AAAA-MM-DD`
 */
export const URL_BCRA_COTIZACIONES = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones"

/** Una fila cruda del histórico de argentinadatos. */
interface FilaHistoricoDolar { fecha?: string; compra?: number; venta?: number }

/**
 * Normaliza el histórico del dólar y lo recorta al rango pedido.
 *
 * 🛑 **Descarta las filas sin fecha o sin los dos valores** en vez de rellenarlas con cero: un cero
 * en una serie de cotizaciones arrastra cualquier promedio que la use.
 */
export function leerHistoricoDolar(
  crudo: unknown, desde?: string, hasta?: string,
): CotizacionLeida[] {
  if (!Array.isArray(crudo)) return []
  const filas: CotizacionLeida[] = []
  for (const f of crudo as FilaHistoricoDolar[]) {
    const fecha = typeof f?.fecha === "string" ? f.fecha.slice(0, 10) : null
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue
    if (desde && fecha < desde) continue
    if (hasta && fecha > hasta) continue
    /**
     * 🧨 **`Number.isFinite(Number(null))` es `true`**, porque `Number(null)` da **0**. Un chequeo
     * de «es un número finito» deja pasar los nulos y los convierte en **cero pesos**, que es el
     * valor más peligroso que puede tener una cotización: no rompe nada y arrastra todo promedio
     * que la incluya. Por eso se descarta el nulo ANTES de convertir.
     *
     * Lo encontró un caso; en la serie real no había ninguna fila así.
     */
    if (f.compra == null || f.venta == null) continue
    const compra = Number(f.compra)
    const venta = Number(f.venta)
    if (!Number.isFinite(compra) || !Number.isFinite(venta)) continue
    filas.push({ fecha, compra, venta })
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * Normaliza la respuesta del BCRA, que viene anidada: `results[].detalle[].tipoCotizacion`.
 *
 * ⚠️ El BCRA publica **un solo valor** (la cotización de referencia), no compra y venta. Se guarda
 * en `valor`, y por eso no se puede usar para reemplazar a la serie de divisas — sirve de control.
 */
export function leerCotizacionesBcra(crudo: unknown): CotizacionLeida[] {
  const res = (crudo as { results?: Array<{ fecha?: string; detalle?: Array<{ tipoCotizacion?: number }> }> })?.results
  if (!Array.isArray(res)) return []
  const filas: CotizacionLeida[] = []
  for (const r of res) {
    const fecha = typeof r?.fecha === "string" ? r.fecha.slice(0, 10) : null
    const valor = Number(r?.detalle?.[0]?.tipoCotizacion)
    // El BCRA manda 0 los días sin cotización (feriados): un cero no es un precio.
    if (!fecha || !Number.isFinite(valor) || valor === 0) continue
    filas.push({ fecha, valor })
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/**
 * 🧮 **El control de las dos fuentes** (§ 🧮 de `CLAUDE.md`, pieza 4: el mismo número por dos
 * caminos). Compara la **venta** del histórico contra la cotización del BCRA, día por día.
 *
 * ⚠️ **La tolerancia es un PORCENTAJE, no un monto**, y eso importa: la serie arranca en **$4** en
 * 2011 y hoy va por **$1.520**. Un tope fijo de «un peso» es holgadísimo al principio y absurdamente
 * estricto al final — con ese criterio el control marcaba **28 días de 457** por diferencias de entre
 * $1,50 y $17, que sobre $1.350 es medio punto.
 *
 * 📌 Y las dos series **no tienen por qué dar idéntico**: una es el cierre del mayorista y la otra la
 * referencia A 3500 del BCRA. El control busca un **desvío grande** —una serie cargada mal, un salto
 * que una fuente tiene y la otra no—, no la diferencia normal entre dos referencias.
 *
 * @param tolerancia fracción: `0.01` = 1 %
 * @returns los días que se desvían más que eso, con las dos puntas
 */
export function cruzarDolarConBcra(
  historico: CotizacionLeida[], bcra: CotizacionLeida[], tolerancia = 0.02,
): Array<{ fecha: string; historico: number; bcra: number; diferencia: number }> {
  const porFecha = new Map(bcra.map(b => [b.fecha, b.valor!]))
  const hallazgos: Array<{ fecha: string; historico: number; bcra: number; diferencia: number }> = []
  for (const h of historico) {
    const b = porFecha.get(h.fecha)
    if (b == null || h.venta == null) continue
    const dif = Math.round((h.venta - b) * 100) / 100
    if (b > 0 && Math.abs(dif) / b > tolerancia) {
      hallazgos.push({ fecha: h.fecha, historico: h.venta, bcra: b, diferencia: dif })
    }
  }
  return hallazgos
}

/**
 * 📅 **HOY, en hora argentina** — se re-exporta desde `lib/fechas.ts`.
 *
 * 🧨 **Nació acá**, el 2026-09-29 a las 22:xx, cuando el BCRA rechazó una fecha futura porque
 * `toISOString()` fecha en UTC y Argentina es UTC−3. **Pero el problema no era de las cotizaciones**:
 * estaba en 139 lugares del repo, así que la función se mudó a un módulo general (A-OP-23) y acá
 * queda el re-export para no romper lo que ya la importaba desde este archivo.
 */
export { hoyArgentina } from "@/lib/fechas"
