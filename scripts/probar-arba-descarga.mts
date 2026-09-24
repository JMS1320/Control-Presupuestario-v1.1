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
const necesarias = ["linksDeBoleta_", "nombreDeArchivo_", "nombreUsuario_", "nombreCarpeta_", "textoPlanoDeMail_", "soloDigitos_", "partidaDeNombre_", "filasDelMail_"]
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
const { linksDeBoleta_, nombreDeArchivo_, nombreUsuario_, nombreCarpeta_, textoPlanoDeMail_, soloDigitos_, partidaDeNombre_, filasDelMail_ } =
  new Function("Utilities", codigo + `\nreturn { ${necesarias.join(", ")} }`)(Utilities)

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

// ── 🐞 A-BUG-126 · El pie del mail también viaja en el rastreador ──────────────────────────────
// ARBA envuelve TODOS los links en `lt.php`, también los del pie. Quedarse con «todo lo que sea
// lt.php» traía 4 de más por mail, y cada uno costaba una descarga entera para descubrir que no
// era un PDF: con 6 mails, ~25 descargas al pedo y 38 boletas sin bajar por falta de tiempo.
const t = (n: number) => `http://arbalist07.arba.gov.ar/lt.php?tid=TID${n}`
const MAIL_REAL = `
  <table>
    <tr><td>099-015881-9</td><td>40.934,10</td><td><a href="${t(1)}">Ingresar</a></td>
        <td><a href="${t(2)}"><img src="qr.png"></a></td></tr>
    <tr><td>099-010611-8</td><td>22.394,70</td><td><a href="${t(3)}">Ingresar</a></td>
        <td><a href="${t(4)}"><img src="qr.png"></a></td></tr>
  </table>
  <div class="pie">
    <a href="${t(90)}">Inicio</a> · <a href="${t(91)}">Cuenta DNI</a> ·
    <a href="${t(92)}">Darse de baja</a> · <a href="${t(93)}">Preguntas frecuentes</a>
  </div>`

chequear("🔴 De un mail real toma SÓLO los «Ingresar», no los 4 del pie",
  "2", String(linksDeBoleta_(MAIL_REAL).length))

chequear("🔑 Y así la cantidad de links COINCIDE con la de filas de la tabla",
  "2 y 2", `${filasDelMail_(MAIL_REAL).filas.length} y ${linksDeBoleta_(MAIL_REAL).length}`)

chequear("Son los links correctos, no dos cualesquiera",
  `${t(1)},${t(3)}`, linksDeBoleta_(MAIL_REAL).join(","))

chequear("El link del QR de Cuenta DNI no entra (es una imagen, no una boleta)",
  "false", String(linksDeBoleta_(MAIL_REAL).includes(t(2))))

chequear("Acepta también «Descargar boleta» por si cambian el texto",
  "1", String(linksDeBoleta_(`<a href="${t(5)}">Descargar boleta</a><a href="${t(90)}">Inicio</a>`).length))

// ⚠️ La red de seguridad: traer de más es molesto, traer de menos es perder una boleta en silencio.
chequear("🔴 Si NINGÚN link tiene texto reconocible, vuelve al modo viejo y no se queda sin nada",
  "2", String(linksDeBoleta_(`<a href="${t(1)}">📄</a><a href="${DIRECTO}">➡</a>`).length))

chequear("Un link directo a pdfDeuda entra aunque el texto sea raro",
  "1", String(linksDeBoleta_(`<a href="${DIRECTO}">x</a>`).length))

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

// ── 🐞 A-BUG-127 · Cuando ARBA NO manda el nombre del archivo ─────────────────────────────────
// Pasó de verdad el 08/09: los 8 PDFs bajados se llamaron `ARBA 2026-C3 - 1.pdf` … `- 8.pdf`.
// El nombre de emergencia numeraba POR POSICIÓN dentro del mail, así que el «1» del mail de MSA y
// el «1» del de PAM son el mismo archivo: la segunda boleta se saltea como «ya estaba».
// Es el defecto de A-BUG-120 entrando por la puerta de al lado.
const ASUNTO_COMPL = "Boleta por Mail - Vencimiento del Impuesto Inmobiliario Complementario Cuota 3"

chequear("🔴 Sin nombre del servidor, el nombre lleva la PARTIDA y no la posición",
  "2026-C3 - 099-015881-9.pdf", nombreDeArchivo_("", ago, 0, ASUNTO_C3, "099-015881-9"))

chequear("🔴 Dos boletas de mails distintos ya NO colisionan",
  "true", String(nombreDeArchivo_("", ago, 0, ASUNTO_C3, "099-015881-9")
    !== nombreDeArchivo_("", ago, 0, ASUNTO_C3, "099-010611-8")))

chequear("El complementario se distingue del inmobiliario del mismo CUIT y cuota",
  "true", String(nombreDeArchivo_("", ago, 0, ASUNTO_COMPL, "30-61778601-6")
    !== nombreDeArchivo_("", ago, 0, ASUNTO_C3, "30-61778601-6")))

chequear("Y el «Aviso de débito» tampoco pisa al complementario común",
  "true", String(nombreDeArchivo_("", ago, 0, "Boleta por Mail - Aviso de débito - Vencimiento del Impuesto Inmobiliario Complementario Cuota 3", "30-61778601-6")
    !== nombreDeArchivo_("", ago, 0, ASUNTO_COMPL, "30-61778601-6")))

chequear("Sin partida, cae al id del link — feo pero estable y único",
  "true", String(nombreDeArchivo_("", ago, 0, ASUNTO_C3, null, RASTREADOR).includes("KR0IAQQBAwtaBU4AWFdVSA")))

chequear("El mismo link procesado dos veces da el mismo nombre (no duplica)",
  "true", String(nombreDeArchivo_("", ago, 0, ASUNTO_C3, null, RASTREADOR)
    === nombreDeArchivo_("", ago, 5, ASUNTO_C3, null, RASTREADOR)))

// ── 🗂️ El nombre con LA CONVENCIÓN DEL USUARIO ────────────────────────────────────────────────
// La misma con la que venía archivando a mano, leída de su carpeta de ejemplos:
//   `2026 - Inmob - Cuota 1 + Anual - Tango Parra 1.pdf` · `2026 - Complementario - Cuota 1.pdf`
const MAPA = {
  "099-015883-5": { nombre: "Tango Parra 1", responsable: "MSA" },
  "099-006595-0": { nombre: "Casco", responsable: "PAM" },
}

chequear("🗂️ Nombra como el usuario: año, Inmob, cuota y EL CAMPO",
  "2026 - Inmob - Cuota 3 - Tango Parra 1.pdf",
  nombreUsuario_(ago, ASUNTO_C3, "099-015883-5", MAPA))

chequear("El complementario no lleva campo: grava al contribuyente",
  "2026 - Complementario - Cuota 3.pdf",
  nombreUsuario_(ago, ASUNTO_COMPL, "30-61778601-6", MAPA))

chequear("🔴 El aviso de débito NO pisa al complementario común de la misma cuota",
  "2026 - Complementario - Cuota 3 - Aviso de debito.pdf",
  nombreUsuario_(ago, "Boleta por Mail - Aviso de débito - Vencimiento del Impuesto Inmobiliario Complementario Cuota 3", "30-61778601-6", MAPA))

chequear("Una partida que NO conocemos cae a la partida, que es fea pero no ambigua",
  "2026 - Inmob - Cuota 3 - 099-001274-1.pdf",
  nombreUsuario_(ago, ASUNTO_C3, "099-001274-1", MAPA))

chequear("Sin cuota en el asunto no fuerza la convención: devuelve null y manda el nombre técnico",
  "null", String(nombreUsuario_(ago, "Otro asunto cualquiera", "099-015883-5", MAPA)))

chequear("Dos campos distintos dan dos archivos distintos",
  "true", String(nombreUsuario_(ago, ASUNTO_C3, "099-015883-5", MAPA)
    !== nombreUsuario_(ago, ASUNTO_C3, "099-006595-0", MAPA)))

chequear("La misma boleta procesada dos veces da el mismo nombre (no duplica)",
  "true", String(nombreUsuario_(ago, ASUNTO_C3, "099-015883-5", MAPA)
    === nombreUsuario_(ago, ASUNTO_C3, "099-015883-5", MAPA)))

chequear("Una barra en el nombre del campo no rompe el archivo de Drive",
  "true", String(!nombreUsuario_(ago, ASUNTO_C3, "x", { x: { nombre: "Lote A/B", responsable: "MSA" } })!.includes("/")))

// ── 🗂️ LA CARPETA, replicando cómo archiva el usuario ─────────────────────────────────────────
chequear("Lo normal: la carpeta es la empresa, a secas",
  "MSA", nombreCarpeta_("MSA", "MSA"))

chequear("🔑 Si es de MSA pero llegó en el mail de PAM: «MSA - viene PAM»",
  "MSA - viene PAM", nombreCarpeta_("MSA", "PAM"))

chequear("Cada empresa la suya", "MA|PAM|ERM",
  [nombreCarpeta_("MA", "MA"), nombreCarpeta_("PAM", "PAM"), nombreCarpeta_("ERM", "ERM")].join("|"))

chequear("Lo que no está en nuestro registro va aparte, sin «viene»",
  "_Sin asignar", nombreCarpeta_(null, "PAM"))

chequear("Sin saber en qué mail vino, no se inventa un «viene»",
  "PAM", nombreCarpeta_("PAM", null))

chequear("🔴 Una boleta que llega por los DOS lados queda en dos carpetas distintas",
  "true", String(nombreCarpeta_("MSA", "MSA") !== nombreCarpeta_("MSA", "PAM")))

chequear("Siempre termina en .pdf",
  "true", String([nombreDeArchivo_(REAL, ago, 0, ASUNTO_C3), nombreDeArchivo_("", ago, 2, ASUNTO_C3)].every((x: string) => x.endsWith(".pdf"))))

// ── A-FEAT-107 · La TABLA del cuerpo del mail ─────────────────────────────────────────────────
// Las 4 partidas son las reales de MSA cuota 3 (`KNOWLEDGE.md` § Anatomía del mail de ARBA).
// 🔑 La MISMA tabla se prueba con TRES maquetados distintos: si el parser dependiera del markup,
// dos de los tres fallarían. Es la condición que hace que esto sobreviva a un rediseño de ARBA.
const PARTIDAS: [string, number][] = [
  ["099-015881-9", 40934.10], ["099-010611-8", 22394.70],
  ["099-008368-1", 76169.40], ["099-012766-2", 22255.20],
]
const comoTabla = (fs2: [string, number][]) => `<table>${fs2.map(([p, i]) =>
  `<tr><td>${p}</td><td>${i.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td><td><a href="${RASTREADOR}">Ingresar</a></td></tr>`).join("")}</table>`
const comoDivs = (fs2: [string, number][]) => fs2.map(([p, i]) =>
  `<div class="row"><span>${p}</span><span>$&nbsp;${i.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span></div>`).join("")
const comoTexto = (fs2: [string, number][]) => fs2.map(([p, i]) =>
  `${p}&nbsp;&nbsp;&nbsp;${i.toLocaleString("es-AR", { minimumFractionDigits: 2 })}&nbsp;&nbsp;Ingresar`).join("<br>")

const ENCABEZADO = `<p>Estimado contribuyente CUIT 30-61778601-6</p>`
for (const [comoSeLlama, armar] of [["tabla", comoTabla], ["divs", comoDivs], ["texto suelto", comoTexto]] as const) {
  const t = filasDelMail_(ENCABEZADO + armar(PARTIDAS))
  chequear(`Lee las 4 partidas maquetadas como ${comoSeLlama}`,
    PARTIDAS.map(p => p[0]).join(","), t.filas.map((f: any) => f.objeto).join(","))
  chequear(`Y sus 4 importes, maquetados como ${comoSeLlama}`,
    PARTIDAS.map(p => p[1]).join(","), t.filas.map((f: any) => f.importe).join(","))
}

chequear("🔴 El CUIT del encabezado NO se cuela como una fila más",
  "4", String(filasDelMail_(ENCABEZADO + comoTabla(PARTIDAS)).filas.length))

chequear("Ese CUIT se devuelve aparte: dice de qué empresa es el mail",
  "30-61778601-6", filasDelMail_(ENCABEZADO + comoTabla(PARTIDAS)).contribuyente)

// El COMPLEMENTARIO: una sola fila y su objeto imponible es el CUIT, no una partida.
const COMPL = `<p>Contribuyente</p><table><tr><td>20-04439022-2 - Rural</td><td>128.464,80</td>
  <td><a href="${DIRECTO}">Ingresar</a></td></tr></table>`
const tc = filasDelMail_(COMPL)
chequear("El complementario da UNA fila, con el CUIT como objeto imponible",
  "1|cuit|20-04439022-2|128464.8", `${tc.filas.length}|${tc.filas[0]?.tipo}|${tc.filas[0]?.objeto}|${tc.filas[0]?.importe}`)

chequear("🔴 Un CUIT y una partida nunca se confunden entre sí",
  "partida,cuit", filasDelMail_(`<td>099-015881-9</td><td>1,00</td><td>20-04439022-2</td><td>2,00</td>`)
    .filas.map((f: any) => f.tipo).join(","))

chequear("Una fila sin importe queda en null, no roba el de la siguiente",
  "099-015881-9=null,099-010611-8=22394.7",
  filasDelMail_(`<td>099-015881-9</td><td>—</td><td>099-010611-8</td><td>22.394,70</td>`)
    .filas.map((f: any) => `${f.objeto}=${f.importe}`).join(","))

chequear("Un mail sin tabla no rompe: devuelve vacío",
  "0|", (() => { const x = filasDelMail_(`<p>Hola</p>`); return `${x.filas.length}|${x.contribuyente}` })())

chequear("No confunde un importe con una partida ni al revés",
  "0", String(filasDelMail_(`<p>Total abonado: 1.234,56</p>`).filas.length))

// ── El cruce PDF ↔ fila del mail ──────────────────────────────────────────────────────────────
chequear("Saca la partida del nombre que manda ARBA",
  "0990158819", partidaDeNombre_("Deuda-Inmobiliario-0990158819-R.pdf"))

chequear("El complementario NO trae partida en el nombre (por eso hace falta el mail)",
  "", partidaDeNombre_("Deuda-Complementario-R.pdf"))

chequear("La partida del mail y la del PDF cruzan aunque una lleve guiones",
  "true", String(soloDigitos_("099-015881-9") === partidaDeNombre_("Deuda-Inmobiliario-0990158819-R.pdf")))

chequear("Las entidades HTML no parten el importe (&nbsp; entre el $ y el número)",
  "40934.1", String(filasDelMail_(`<td>099-015881-9</td><td>$&nbsp;40.934,10</td>`).filas[0]?.importe))

chequear("El texto de un <style> no aporta números falsos",
  "1", String(filasDelMail_(`<style>.x{margin:10,00px}</style><td>099-015881-9</td><td>40.934,10</td>`).filas.length))

for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  if (!x.ok) console.log(`      esperado: ${x.esperado}\n      obtenido: ${x.obtenido}`)
}
const mal = r.filter(x => !x.ok).length
console.log(`\n${r.length - mal} de ${r.length} pasaron`)
console.log(`\n⚠️ Esto NO prueba la bajada real: Gmail y Drive sólo los puede correr el usuario`)
console.log(`   con testArbaContar() en Apps Script.`)
process.exit(mal ? 1 : 0)
