/**
 * `npm run probar:arba` — la lógica de la BAJADA de boletas de ARBA, sin Gmail ni Drive.
 *
 * ## Qué se puede probar acá y qué no
 * La bajada vive en el Gmail y el Drive del usuario, así que **el camino completo sólo lo puede
 * correr él**. Pero las dos piezas que deciden *qué se baja* y *qué se pisa* son lógica pura, y son
 * justo donde un error no se ve hasta que ya perdiste un archivo:
 *
 * - **`linksDeBoleta_`** — de qué links del cuerpo del mail se baja. Si deja uno afuera, esa boleta
 *   nunca llega, y nadie lo nota.
 * - **`nombreDeArchivo_`** — cómo se nombra, que es la clave de la deduplicación. ARBA nombra sus
 *   PDFs con la partida pero **sin el período**, así que dedup por el nombre crudo salteaba la
 *   boleta de la cuota siguiente creyendo que ya estaba.
 *
 * 🔒 **No toca la base ni la red.** Las funciones se leen del `.gs` y se evalúan acá: así se prueba
 * **el código que se despliega**, no una copia que puede quedar vieja.
 */
import fs from "node:fs"

const B = process.cwd().split("\\").join("/")
const GS = `${B}/gas-buscar-pdf/BoletasArba.gs`

if (!fs.existsSync(GS)) {
  console.log(`No está ${GS}. Salteado.`)
  process.exit(0)
}

// Se extraen las funciones del .gs y se evalúan. `Utilities` se sustituye por un doble mínimo:
// lo que se prueba es la lógica del nombre, no el formateador de fechas de Google.
// Se normalizan los fines de línea: en Windows git deja CRLF y el corte por `\n}\n` no matchea.
// Sin esto el test falla con «linksDeBoleta_ is not defined», que no dice nada de la causa.
const fuente = fs.readFileSync(GS, "utf8").split("\r\n").join("\n")
const necesarias = ["linksDeBoleta_", "nombreDeArchivo_"]
let codigo = ""
for (const fn of necesarias) {
  const i = fuente.indexOf(`function ${fn}(`)
  if (i < 0) { console.log(`✗ No se encontró ${fn} en el .gs — ¿le cambiaron el nombre?`); process.exit(1) }
  // Hasta la línea que cierra la función en la columna 0.
  const fin = fuente.indexOf("\n}\n", i)
  codigo += fuente.slice(i, fin + 3) + "\n"
}
// Doble mínimo de `Utilities.formatDate`. Honra el formato: un doble que devuelve siempre lo mismo
// hace fallar casos que el código real pasa, y manda a buscar el bug en el lugar equivocado.
const Utilities = {
  formatDate: (d: Date, _tz: string, fmt: string) => {
    const iso = d.toISOString()
    return fmt === "yyyy" ? iso.slice(0, 4)
      : fmt === "MM-dd" ? iso.slice(5, 10)
        : iso.slice(0, 10)
  },
}
const { linksDeBoleta_, nombreDeArchivo_ } = new Function("Utilities", codigo + "\nreturn { linksDeBoleta_, nombreDeArchivo_ }")(Utilities)

const r: { ok: boolean; caso: string; esperado: string; obtenido: string }[] = []
const chequear = (caso: string, esperado: string, obtenido: string) =>
  r.push({ ok: esperado === obtenido, caso, esperado, obtenido })

// ── De qué links se baja ──────────────────────────────────────────────────────────────────────
const RASTREADOR = "http://arbalist07.arba.gov.ar/lt.php?tid=KR0IAQQBAwtaBU4AWFdVSA"
const DIRECTO = "https://app.arba.gov.ar/pdfDeuda/emisiones/ARBADeuda/202603_00f05878"

chequear("Toma el link rastreador (lt.php)",
  "1", String(linksDeBoleta_(`<a href="${RASTREADOR}">Ver boleta</a>`).length))

chequear("Toma también el link directo (pdfDeuda)",
  "1", String(linksDeBoleta_(`<a href="${DIRECTO}">Ver</a>`).length))

chequear("El mismo link en el texto y en el botón se cuenta UNA vez",
  "1", String(linksDeBoleta_(`<a href="${RASTREADOR}">botón</a> o pegá ${RASTREADOR}`).length))

chequear("Dos boletas en el mismo mail son dos links",
  "2", String(linksDeBoleta_(`<a href="${RASTREADOR}">a</a><a href="${DIRECTO}">b</a>`).length))

chequear("Ignora links que no son de boletas",
  "0", String(linksDeBoleta_(`<a href="https://www.arba.gov.ar/contacto">Contacto</a>`).length))

chequear("Desarma el &amp; de los links en HTML",
  "true", String(linksDeBoleta_(`<a href="${DIRECTO}&amp;pk_source=phpList">x</a>`)[0]?.includes("&pk_source")))

chequear("Corta la puntuación pegada al final",
  "true", String(!linksDeBoleta_(`Entrá a ${RASTREADOR}.`)[0]?.endsWith(".")))

// ── Cómo se nombra: la clave de la deduplicación ──────────────────────────────────────────────
const REAL = "Deuda-Inmobiliario-0990158819-R.pdf"
// Asuntos reales, de los mails del usuario (2026-09-06).
const ASUNTO_C3 = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 3"
const ASUNTO_C4 = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Rural Cuota 4"
const ago = new Date("2026-08-27T18:17:00Z")
const nov = new Date("2026-11-05T10:00:00Z")

chequear("El nombre lleva año y cuota, sacados del asunto",
  "2026-C3 - Deuda-Inmobiliario-0990158819-R.pdf", nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3))

chequear("🔴 La MISMA partida en otra cuota es OTRO archivo (si no, se pierde una boleta)",
  "true", String(nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3) !== nombreDeArchivo_(REAL, nov, 0, ASUNTO_C4)))

// Un mail trae VARIAS boletas. Si el nombre dependiera de la posición del link, que ARBA
// reordene la tabla bastaría para que todo se baje de nuevo con otro nombre.
chequear("🔴 El nombre NO depende del orden del link dentro del mail",
  "true", String(nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3) === nombreDeArchivo_(REAL, ago, 3, ASUNTO_C3)))

chequear("El mismo mail procesado dos veces da el mismo nombre (no duplica)",
  "true", String(nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3) === nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3)))

chequear("Sin cuota en el asunto, cae a la fecha del mail",
  "true", String(nombreDeArchivo_(REAL, ago, 0, "Otro asunto").indexOf("2026-08-27") >= 0))

chequear("Sin nombre del servidor, igual arma uno con el período",
  "true", String(nombreDeArchivo_("", ago, 0, ASUNTO_C3).indexOf("2026-C3") >= 0))

chequear("Siempre termina en .pdf",
  "true", String([nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3), nombreDeArchivo_("", ago, 2, ASUNTO_C3)].every((x: string) => x.endsWith(".pdf"))))

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  if (!x.ok) console.log(`      esperado: ${x.esperado}\n      obtenido: ${x.obtenido}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
console.log(`\n⚠️ Esto NO prueba la bajada real: Gmail y Drive sólo los puede correr el usuario`)
console.log(`   con testArbaContar() en Apps Script.`)
process.exit(mal ? 1 : 0)
