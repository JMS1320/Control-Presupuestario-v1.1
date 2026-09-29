import { NextResponse } from "next/server"

/**
 * 🐄 PRECIOS POR CABEZA — vientres y toros de **entresurcosycorralesya.com** (A-FEAT-1187).
 *
 * `GET /api/precios-por-cabeza?tipo=vientres|toros&desde=YYYY-MM-DD&hasta=YYYY-MM-DD`
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ## 1 · POR QUÉ EXISTE, Y POR QUÉ NO ENTRÓ EN LAS RUTAS QUE YA HABÍA
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Había dos rutas de precios y **ninguna servía para esto**:
 *
 * | Ruta | Fuente | Forma del dato |
 * |---|---|---|
 * | `/api/precios-mercado` | Entresurcos, módulo ternero/ternera | precio **por kilo**, por rango de peso |
 * | `/api/precios-mag` | Mercado Agroganadero de Cañuelas | precio **por kilo**, por categoría comercial |
 * | **ésta** | Entresurcos, módulos vientre y toro | **precio por CABEZA** (bulto) |
 *
 * 🔑 **La diferencia no es cosmética: un vientre no se valúa por kilo.** Una vaca con garantía de
 * preñez vale lo que vale — sus kilos no dicen nada del precio. Meter esto en `precios-mercado`
 * obligaría a devolver dos formas incompatibles bajo el mismo nombre, que es exactamente lo que el
 * comentario de `precios-mag` ya explicaba cuando se separó aquélla.
 *
 * 📌 **Y cierra el hueco más grande de la valuación de hacienda**: hasta el 2026-09-29, la **Vaca**
 * (177 cabezas) y la **Vaquillona Preñada** (27) **no se podían valuar** porque no había de dónde
 * sacar su precio. Son 204 de las 428 cabezas del rodeo.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ## 2 · CÓMO SE OBTIENE — y cómo encontrar el endpoint si mañana cambia
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Las páginas que ve una persona (`/vientres.html`, `/toros.html`) **no traen la tabla**: la piden
 * por AJAX. Así se encontró cada una, y así se vuelve a encontrar si el sitio se reorganiza:
 *
 * ```bash
 * curl -s https://www.entresurcosycorralesya.com/vientres.html | grep -oiE "ajax-modulo-[a-z]+\.php"
 * ```
 *
 * ⚠️ **Los nombres NO siguen un patrón, y suponerlo hace perder tiempo**: el de vientres es
 * `ajax-modulo-vientre.php` (singular, como ternero/ternera) pero el de toros **no** es
 * `ajax-modulo-toro.php` —eso da **404**— sino `ajax-modulo-precio-toros.php`. Hay que mirarlo.
 *
 * Los dos toman `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` y devuelven **HTML con una `<table>`**, no
 * JSON. Van sin login.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ## 3 · LAS DOS TABLAS TIENEN COLUMNAS DISTINTAS
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ```
 * vientres → Categoría | Cantidad          | Prom. Bulto | Bulto+  | Bulto-
 * toros    → Categoría | A venta | Vendidos | Promedio    | Máximo  | Mínimo
 * ```
 *
 * 🔑 **Toros tiene una columna más** (`A venta` y `Vendidos` por separado), así que los importes
 * arrancan en la posición 3 y no en la 2. Se resuelve leyendo **desde el final**, que es estable
 * en las dos: los últimos tres números son siempre `promedio · máximo · mínimo`.
 *
 * 📌 **Y el orden es promedio, máximo, mínimo** — no el habitual mín/máx. Invertirlo daría precios
 * plausibles y equivocados, que es el peor tipo de error.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ## 4 · QUÉ CATEGORÍAS IMPORTAN HOY (medido 2026-09-29, junio 2026)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * **vientres** — las dos que usa el usuario están textuales en la fuente:
 * - `Vacas C. Gtia. Preñez Medio` → su criterio de **Vaca**   (prom. 2.073.207)
 * - `Vacas C. Gtia. Preñez Nueva` → su criterio de **Vaquillona Preñada** (prom. 2.409.494)
 * - y además: Vaquillonas Sin/Con Servicio, Vaquillonas C. Gtía. Preñez, Vacas Sin/Con Servicio.
 *
 * **toros** — 13 categorías. La que él usa: `A.ANGUS GRAL. COLORADO`, *«precio mínimo»*.
 *
 * ⚠️ **Las categorías vienen sin normalizar** (`Gtia.` sin tilde, puntos irregulares). Quien las
 * busque **tiene que comparar sin tildes y sin puntuación**, o no va a encontrar nada — y el
 * síntoma sería «no hay precio», que se confunde con «el mercado no publicó».
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * ## 5 · LO QUE HAY QUE SABER PARA MANTENERLA
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *
 * - **Se llama del lado del servidor** por CORS, igual que las otras dos.
 * - **Una fila en cero no se descarta**: `Vacas Con Servicio` vino con cantidad 0 y precios 0. Se
 *   devuelve igual, con `cantidad: 0`, para que quien la lea sepa que **el mercado no operó esa
 *   categoría** — distinto de que no exista.
 * - **Si el sitio cambia la tabla**, el error lo dice y no devuelve una lista vacía: una lista
 *   vacía se leería como «no hubo precios», y son cosas distintas (§ 🧮 de `CLAUDE.md`).
 */

export interface PrecioPorCabeza {
  /** Tal como la publica el sitio, sin normalizar: `Vacas C. Gtia. Preñez Medio`. */
  categoria: string
  /** Cabezas que operaron. `0` = el mercado no operó esa categoría en el período. */
  cantidad: number
  promedio: number
  maximo: number
  minimo: number
}

/** Los dos módulos, con su nombre real. Ver § 2: no siguen un patrón. */
const MODULOS = {
  vientres: "ajax-modulo-vientre.php",
  toros: "ajax-modulo-precio-toros.php",
} as const

type Tipo = keyof typeof MODULOS

/** `1.554.273` → `1554273`. El sitio usa punto de miles y no trae decimales. */
const num = (s: string) => {
  const limpio = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : 0
}

const limpiarTexto = (s: string) =>
  s.replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get("tipo") as Tipo | null
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")

  if (!tipo || !(tipo in MODULOS)) {
    return NextResponse.json(
      { error: `Falta o es inválido «tipo». Tiene que ser: ${Object.keys(MODULOS).join(" o ")}.` },
      { status: 400 },
    )
  }
  if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json(
      { error: "Faltan o son inválidos «desde» y «hasta» (formato YYYY-MM-DD)." },
      { status: 400 },
    )
  }

  const url = `https://www.entresurcosycorralesya.com/${MODULOS[tipo]}?desde=${desde}&hasta=${hasta}`
  let html: string
  try {
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 15_000)
    let res: Response
    try {
      res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0" } })
    } finally { clearTimeout(to) }

    if (!res.ok) {
      // 404 casi siempre significa que cambió el nombre del módulo. Se dice cómo encontrarlo.
      return NextResponse.json({
        error: res.status === 404
          ? `El módulo «${MODULOS[tipo]}» ya no existe (404). Buscá el nuevo con: ` +
            `curl -s https://www.entresurcosycorralesya.com/${tipo}.html | grep -oiE "ajax-modulo-[a-z-]+\\.php"`
          : `Entresurcos respondió ${res.status}.`,
      }, { status: 502 })
    }
    html = await res.text()
  } catch (e) {
    const err = e as Error
    return NextResponse.json({
      error: err.name === "TimeoutError" || err.name === "AbortError"
        ? "Entresurcos no respondió en 15s."
        : `No se pudo contactar a Entresurcos: ${err.message}`,
    }, { status: 502 })
  }

  /**
   * Se parsea fila por fila y **leyendo los importes desde el final** (§ 3): los últimos tres
   * números son siempre `promedio · máximo · mínimo` en las dos tablas, aunque toros tenga una
   * columna de más. Atarse a índices fijos rompería con una de las dos.
   */
  const filas: PrecioPorCabeza[] = []
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const celdas = (tr.match(/<td[\s\S]*?<\/td>/gi) ?? []).map(limpiarTexto)
    if (celdas.length < 4) continue                       // encabezados y filas de adorno
    const categoria = celdas[0]
    if (!categoria || /^total/i.test(categoria)) continue // la fila de totales no es una categoría

    const [promedio, maximo, minimo] = celdas.slice(-3).map(num)
    // La cantidad es el primer número después de la categoría; en toros son «a venta» y «vendidos»
    // y se toma el primero, que es el volumen ofrecido.
    const cantidad = num(celdas[1] ?? "0")
    filas.push({ categoria, cantidad, promedio, maximo, minimo })
  }

  if (filas.length === 0) {
    // 🔑 NO se devuelve una lista vacía con `ok: true`: se leería como «no hubo precios», y lo que
    //    pasó es que no se pudo leer la tabla. Son cosas distintas.
    return NextResponse.json({
      error: "No se encontró ninguna fila de precios. Puede que Entresurcos haya cambiado la tabla.",
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, tipo, desde, hasta, filas })
}
