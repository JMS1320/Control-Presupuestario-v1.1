/**
 * 💱 **Trae las cotizaciones del día y las guarda en `public.cotizaciones`.**
 *
 * Fuentes elegidas por el usuario (2026-09-29): **dólar y euro del BNA, solapa DIVISAS** y
 * **soja y maíz de la pizarra de Rosario**, *«día por día así nos queda el histórico»*.
 *
 * ```
 * npx tsx scripts/traer-cotizaciones.mts                      # hoy
 * npx tsx scripts/traer-cotizaciones.mts 2025-07-01 2026-09-29   # un rango, para cargar el histórico
 * npx tsx scripts/traer-cotizaciones.mts --solo-leer            # muestra y NO escribe
 * ```
 *
 * ## ⚠️ Esto SÍ escribe en la base
 *
 * A diferencia de los demás controles, este script **inserta**. Por eso:
 * - sólo escribe en `cotizaciones`, que es una tabla de **datos de mercado**, no del usuario;
 * - **nunca pisa una fila puesta a mano** (`origen = 'manual'`) — § 🎚️: lo que él corrigió manda;
 * - `--solo-leer` permite ver qué haría sin tocar nada.
 *
 * 📌 **El BNA sólo publica el día de hoy**: para el histórico del dólar hay que correrlo todos los
 * días (o cargarlo de otra fuente). La pizarra **sí** devuelve el rango entero de una vez.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import {
  leerBnaDivisas, leerPizarraBcr, urlPizarra, promedioDelMes,
  leerHistoricoDolar, leerCotizacionesBcra, cruzarDolarConBcra, hoyArgentina,
  URL_HISTORICO_DOLAR, URL_BCRA_COTIZACIONES,
  type CotizacionLeida,
} from "../lib/cotizaciones/parsers"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)

const args = process.argv.slice(2)
const soloLeer = args.includes("--solo-leer")
const fechas = args.filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a))
/** ⚠️ En hora ARGENTINA, no UTC: después de las 21:00 `toISOString()` ya devuelve mañana. */
const hoy = hoyArgentina()
const desde = fechas[0] ?? hoy
/**
 * ⚠️ Se recorta a HOY: una fuente puede publicar una fila con fecha de mañana (pasa cuando su
 * servidor está en otro huso), y una cotización futura en el histórico no es un dato, es ruido.
 */
const hastaPedido = fechas[1] ?? hoy
const hasta = hastaPedido > hoy ? hoy : hastaPedido

const UA = { "User-Agent": "Mozilla/5.0" }

/**
 * Parte un rango en ventanas de **un año como máximo**, que es lo que acepta la pizarra.
 * Ver la nota del bucle de abajo: un rango más largo devuelve vacío **sin avisar**.
 */
function ventanasDeUnAnio(desde: string, hasta: string): Array<[string, string]> {
  const ventanas: Array<[string, string]> = []
  let d = new Date(desde + "T00:00:00Z")
  const fin = new Date(hasta + "T00:00:00Z")
  while (d <= fin) {
    const h = new Date(d)
    h.setUTCDate(h.getUTCDate() + 364)
    const corte = h > fin ? fin : h
    ventanas.push([d.toISOString().slice(0, 10), corte.toISOString().slice(0, 10)])
    d = new Date(corte)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return ventanas
}
const pesos = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2 })

/** Lo leído, por serie. Se junta todo antes de escribir para poder mostrar un resumen. */
const leido = new Map<string, CotizacionLeida[]>()

// ── El HISTÓRICO del dólar ──────────────────────────────────────────────────────────────
//
// 🔑 El BNA sólo publica hoy, así que el histórico viene de `argentinadatos`, casa **mayorista** —
//    que es la de DIVISAS, no la que se llama «oficial», que es el billete. Ver la nota del parser.
//
// 🧮 Y se **cruza contra el BCRA** el mismo rango: si las dos fuentes independientes no coinciden,
//    se dice. Es la pieza 4 de § 🤖 — el mismo número por dos caminos, gratis.
if (desde !== hasta) {
  try {
    const crudo = await (await fetch(URL_HISTORICO_DOLAR, { headers: UA })).json()
    const filas = leerHistoricoDolar(crudo, desde, hasta)
    if (filas.length === 0) {
      console.log(`⚠️  histórico del dólar: no devolvió nada para ${desde} → ${hasta}`)
    } else {
      leido.set("dolar_bna_divisas", filas)
      try {
        /**
         * ⚠️ El BCRA **rechaza una fecha futura** (`La fecha no puede ser mayor al día actual`), así
         * que el tope se recorta a hoy. Fue lo que destapó el bug del huso: el script pedía «hasta
         * el 30» siendo 29 porque calculaba la fecha en UTC.
         */
        const topeBcra = hasta > hoy ? hoy : hasta
        const b = await (await fetch(
          `${URL_BCRA_COTIZACIONES}/USD?fechadesde=${desde}&fechahasta=${topeBcra}`, { headers: UA },
        )).json()
        const bcra = leerCotizacionesBcra(b)
        const difs = cruzarDolarConBcra(filas, bcra)
        if (bcra.length === 0) {
          console.log("⚠️  el BCRA no respondió: el histórico del dólar queda SIN cruzar.")
        } else if (difs.length === 0) {
          console.log(`🧮 Control: ${bcra.length} días cruzados contra el BCRA, todos coinciden.`)
        } else {
          console.log(`🛑 Control: ${difs.length} día(s) en que el histórico y el BCRA difieren:`)
          difs.slice(0, 5).forEach(d =>
            console.log(`     ${d.fecha}  histórico ${pesos(d.historico)}  ·  BCRA ${pesos(d.bcra)}  ·  dif ${pesos(d.diferencia)}`))
        }
      } catch (e) {
        console.log(`⚠️  no se pudo cruzar con el BCRA: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    console.log(`⚠️  histórico del dólar: ${(e as Error).message}`)
  }
}

// ── BNA: el día de hoy, que es lo único que publica ─────────────────────────────────────
try {
  const html = await (await fetch("https://www.bna.com.ar/Personas", { headers: UA })).text()
  for (const [serie, moneda] of [
    ["dolar_bna_divisas", "Dolar U.S.A"],
    ["euro_bna_divisas", "Euro"],
  ] as const) {
    const c = leerBnaDivisas(html, moneda)
    // 🛑 Nada en silencio: si no se pudo leer, se dice cuál y se sigue con las otras series.
    if (!c) { console.log(`⚠️  ${serie}: no se pudo leer del BNA`); continue }
    // Se SUMA al histórico en vez de reemplazarlo: el BNA trae el día de hoy, que suele ser el que
    // al histórico todavía le falta.
    const previas = leido.get(serie) ?? []
    leido.set(serie, [...previas.filter(f => f.fecha !== c.fecha), c]
      .sort((a, b) => a.fecha.localeCompare(b.fecha)))
  }
} catch (e) {
  console.log(`⚠️  BNA no respondió: ${(e as Error).message}`)
}

// ── Pizarra de Rosario ──────────────────────────────────────────────────────────────────
for (const [serie, producto] of [
  ["soja_pizarra_rosario", "soja"],
  ["maiz_pizarra_rosario", "maiz"],
] as const) {
  try {
    /**
     * 🧨 **Hay que recorrer las páginas.** La pizarra devuelve **10 días por página** y no avisa:
     * pedir un mes entero trae medio mes con cara de respuesta completa. Se sigue mientras la página
     * traiga filas nuevas — así no hay que saber de antemano cuántas hay.
     */
    const filas: CotizacionLeida[] = []
    const vistas = new Set<string>()
    /**
     * 🧨 **Y el rango no puede pasar de UN AÑO.** Medido el 2026-09-29: `2025-09-30 → 2026-09-29`
     * (365 días) devuelve datos y `2025-07-01 → 2026-09-29` devuelve **cero, sin ningún error**.
     * Es el peor tipo de límite: no falla, contesta vacío — y un histórico vacío parece *«no hay
     * datos»* en vez de *«pediste mal»*.
     */
    for (const [d, h] of ventanasDeUnAnio(desde, hasta)) {
      for (let pagina = 1; pagina <= 60; pagina++) {
        const html = await (await fetch(urlPizarra(producto, d, h, pagina), { headers: UA })).text()
        const pag = leerPizarraBcr(html, d, h).filter(f => !vistas.has(f.fecha))
        if (pag.length === 0) break
        pag.forEach(f => { vistas.add(f.fecha); filas.push(f) })
        /**
         * 🛑 **NO se corta por página incompleta.** Parece razonable —una página con menos de 10
         * filas debería ser la última— pero `pag` ya viene **filtrado por fechas repetidas y por el
         * rango**, así que cualquier página con un solapamiento cae por debajo de 10 y el recorrido
         * se detenía a mitad de camino: traía **67 días donde había 300**, sin avisar.
         *
         * El único corte confiable es **una página sin ninguna fecha nueva**.
         */
      }
    }
    filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
    if (filas.length === 0) {
      console.log(`⚠️  ${serie}: la pizarra no devolvió filas para ${desde} → ${hasta}.`)
      console.log("    Lo primero a mirar es si cambiaron los ids de producto (ver PRODUCTOS_BCR).")
      continue
    }
    leido.set(serie, filas)
  } catch (e) {
    console.log(`⚠️  ${serie}: ${(e as Error).message}`)
  }
}

// ── Lo que se leyó ──────────────────────────────────────────────────────────────────────
console.log(`\n💱 COTIZACIONES · ${desde}${desde !== hasta ? ` → ${hasta}` : ""}\n`)
for (const [serie, filas] of leido) {
  const u = filas[filas.length - 1]
  const dato = u.valor != null ? `$ ${pesos(u.valor)}` : `compra ${pesos(u.compra!)} · venta ${pesos(u.venta!)}`
  console.log(`  ${serie.padEnd(24)} ${String(filas.length).padStart(3)} día(s)   último ${u.fecha}: ${dato}`)
  const mes = u.fecha.slice(0, 7)
  const prom = promedioDelMes(filas, mes, u.valor != null ? "valor" : "venta")
  if (prom != null && filas.length > 1) {
    console.log(`  ${" ".repeat(24)} promedio de ${mes}: ${pesos(prom)}`)
  }
}

if (leido.size === 0) { console.log("  (no se pudo leer ninguna serie)\n"); process.exit(1) }

if (soloLeer) { console.log("\n--solo-leer: no se escribió nada.\n"); process.exit(0) }

// ── Guardar ─────────────────────────────────────────────────────────────────────────────
let escritas = 0, respetadas = 0
for (const [serie, filas] of leido) {
  // Las puestas a mano no se pisan (§ 🎚️): se leen primero y se saltean.
  const { data: manuales } = await sb.from("cotizaciones")
    .select("fecha").eq("serie", serie).eq("origen", "manual")
  const aMano = new Set((manuales ?? []).map(m => String((m as { fecha: string }).fecha)))

  const aEscribir = filas.filter(f => !aMano.has(f.fecha))
  respetadas += filas.length - aEscribir.length
  if (aEscribir.length === 0) continue

  const { error } = await sb.from("cotizaciones").upsert(
    aEscribir.map(f => ({
      serie, fecha: f.fecha,
      compra: f.compra ?? null, venta: f.venta ?? null, valor: f.valor ?? null,
      origen: "scraper", updated_at: new Date().toISOString(),
    })),
    { onConflict: "serie,fecha" },
  )
  if (error) { console.log(`🛑 ${serie}: ${error.message}`); continue }
  escritas += aEscribir.length
}

console.log(`\n✅ ${escritas} cotización(es) guardadas.`)
if (respetadas > 0) console.log(`   ${respetadas} se dejaron como estaban: tienen valor puesto a mano.`)
console.log()
