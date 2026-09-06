import { NextResponse } from "next/server"

/**
 * Precios del MERCADO AGROGANADERO de Cañuelas (MAG) — la referencia de precios a nivel país.
 *
 * `GET /api/precios-mag?desde=YYYY-MM-DD&hasta=YYYY-MM-DD[&ruca=1]`
 *
 * ## Por qué una ruta aparte de `/api/precios-mercado`
 * No es la misma fuente ni la misma forma del dato. `precios-mercado` trae
 * **entresurcosycorralesya** con categorías por **rango de peso** (terneros de 160-180 kg), que es
 * lo que sirve para valuar invernada. El MAG publica **categorías comerciales** (`VACAS Esp.Joven
 * + 430`, `NOVILLOS Regular h 430`) con mínimo, máximo, promedio y mediana. Unificarlas en una sola
 * ruta obligaría a devolver dos formas incompatibles bajo el mismo nombre. Se comparten las
 * convenciones —server-side por CORS, timeout, y un error que dice qué hacer— no la estructura.
 *
 * ## Cómo se obtiene
 * El sitio es un WebBroker de Delphi (`hacienda1.dll`). La página hace **POST a sí misma** con el
 * rango de fechas, y **no pide login** (`USUARIO=SIN IDENTIFICAR`). Camino en la web:
 * Hacienda → Precios → *Precios por categoría Resol-2018* (o *Clasificación RUCA* con `ruca=1`).
 *
 * ⚠️ **Los precios salen PROVISORIOS y después DEFINITIVOS.** El campo `estado` lo dice, y no es un
 * detalle: comparar un negocio contra un precio provisorio y no volver a mirarlo es quedarse con un
 * número que el mercado ya corrigió.
 */

export interface FilaMag {
  categoria: string
  /** `NOVILLOS`, `VACAS`, `TOROS`… — lo que va antes de la calidad. */
  familia: string
  /** `Esp.Joven`, `Regular`, `Esp.`… tal como lo publica el mercado. */
  calidad: string
  /** `h 430` = hasta · `+ 430` = más de. `null` cuando la categoría no discrimina peso. */
  corte: string | null
  minimo: number
  maximo: number
  promedio: number
  mediana: number
  cabezas: number
  importe: number
  kilos: number
  /** Kilos promedio por cabeza que publica el mercado. */
  pesoProm: number
}

const num = (s: string) =>
  parseFloat(String(s).replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".")) || 0

const limpiar = (s: string) =>
  s.replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&aacute;/g, "á").replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim()

/** `VACAS Esp.Joven + 430` → familia `VACAS`, calidad `Esp.Joven`, corte `+ 430`. */
function partir(cat: string): { familia: string; calidad: string; corte: string | null } {
  const mCorte = cat.match(/\s([h+])\s*(\d+)\s*$/i)
  const corte = mCorte ? `${mCorte[1]} ${mCorte[2]}` : null
  const resto = (mCorte ? cat.slice(0, mCorte.index) : cat).trim()
  // La familia es la primera palabra en MAYÚSCULAS; el resto es la calidad.
  const partes = resto.split(/\s+/)
  const familia = partes[0] ?? resto
  return { familia, calidad: partes.slice(1).join(" ") || "", corte }
}

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get("desde")
  const hasta = searchParams.get("hasta")
  // Las dos tablas que publica el mercado. La de RUCA es la clasificación oficial nueva.
  const ruca = searchParams.get("ruca") === "1"

  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan parámetros desde/hasta (YYYY-MM-DD)" }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ error: "Fechas inválidas (formato YYYY-MM-DD)" }, { status: 400 })
  }

  const url = `https://www.mercadoagroganadero.com.ar/dll/hacienda1.dll/${ruca ? "haciinfo000503" : "haciinfo000502"}`
  try {
    const cuerpo = new URLSearchParams({
      ID: "", CP: "", FLASH: "", USUARIO: "SIN IDENTIFICAR",
      txtFechaIni: ddmmyyyy(desde), txtFechaFin: ddmmyyyy(hasta),
    })
    const ctrl = new AbortController()
    const to = setTimeout(() => ctrl.abort(), 20000)
    let res: Response
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" },
        body: cuerpo.toString(), cache: "no-store", signal: ctrl.signal,
      })
    } finally { clearTimeout(to) }
    if (!res.ok) {
      return NextResponse.json({ error: `El Mercado Agroganadero respondió ${res.status}` }, { status: 502 })
    }

    // La página viene en latin-1: leída como UTF-8 rompe las tildes de las categorías.
    const html = new TextDecoder("latin1").decode(await res.arrayBuffer())

    const tabla = html.match(/<Table[^>]*table-striped[^>]*>([\s\S]*?)<\/Table>/i)
    if (!tabla) {
      return NextResponse.json({
        error: "No se encontró la tabla de precios. Puede que el mercado haya cambiado la página.",
      }, { status: 502 })
    }

    // PROVISORIOS vs DEFINITIVOS: un precio provisorio se corrige después.
    const enc = limpiar((html.match(/PRECIOS POR CATEGOR[^<]*/i) ?? [""])[0])
    const estado = /DEFINITIVO/i.test(enc) ? "definitivos" : /PROVISORIO/i.test(enc) ? "provisorios" : "desconocido"

    const filas: FilaMag[] = []
    for (const tr of tabla[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const celdas = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => limpiar(c[1]))
      if (celdas.length < 9) continue
      const categoria = celdas[0]
      // Se saltean encabezados, separadores (`-------`) y las filas de SUBTOTAL, que vienen con la
      // categoría vacía. Sumarlas duplicaría el mercado entero.
      if (!categoria || /^-+$/.test(categoria) || /categor/i.test(categoria)) continue
      if (celdas.slice(1).some(c => /^-+$/.test(c))) continue
      // La fila `Totales` del pie **es el mercado entero otra vez**: dejarla pasar duplica las
      // cabezas (35.210 en vez de 17.605). Se reconoce por el nombre y porque no trae mín/máx.
      if (/^totales?$/i.test(categoria) || !celdas[1]) continue
      const { familia, calidad, corte } = partir(categoria)
      filas.push({
        categoria, familia, calidad, corte,
        minimo: num(celdas[1]), maximo: num(celdas[2]),
        promedio: num(celdas[3]), mediana: num(celdas[4]),
        cabezas: num(celdas[5]), importe: num(celdas[6]),
        kilos: num(celdas[7]), pesoProm: num(celdas[8]),
      })
    }

    if (!filas.length) {
      return NextResponse.json({
        error: "Sin datos para ese rango. El mercado opera de lunes a viernes y publica con demora: probá con fechas anteriores.",
      }, { status: 404 })
    }

    // 🧮 Control gratis: el promedio publicado tiene que ser importe ÷ kilos. Si no da, algo se
    // parseó mal — y se avisa en vez de devolver números que parecen buenos.
    const descuadres = filas.filter(f =>
      f.kilos > 0 && Math.abs(f.importe / f.kilos - f.promedio) > 1
    ).map(f => f.categoria)

    return NextResponse.json({
      fuente: "Mercado Agroganadero de Cañuelas",
      tabla: ruca ? "Clasificación RUCA" : "Resol-2018",
      desde, hasta, estado, encabezado: enc,
      cabezasTotales: filas.reduce((s, f) => s + f.cabezas, 0),
      filas,
      ...(descuadres.length ? { descuadres } : {}),
    })
  } catch (e) {
    const msg = (e as Error).name === "AbortError"
      ? "El Mercado Agroganadero tardó demasiado (timeout). Probá de nuevo."
      : "No se pudo conectar con el Mercado Agroganadero: " + (e as Error).message
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
