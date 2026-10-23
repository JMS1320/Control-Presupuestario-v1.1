/**
 * `npm run probar:coincidencia` — la REGLA DEL VÍNCULO del buscador de PDFs (A-FEAT-1287), sin Gmail
 * ni Drive.
 *
 * Acordada con el usuario 2026-10-20: un archivo es de la factura si coinciden **CUIT + número +
 * monto + tipo (FC/NC/ND) + fecha**. Si coinciden los tres primeros y falla tipo o fecha, queda **a
 * revisar con el motivo** — nunca se descarta. Nació de un caso real: una nota de crédito se tomó por
 * la factura.
 *
 * 🔒 No toca la base ni la red. Las funciones se leen del `.gs` y se evalúan acá: se prueba **el
 * código que se despliega**, no una copia (mismo método que `probar:arba`).
 */
import fs from "node:fs"

const B = process.cwd().split("\\").join("/")
const GS = `${B}/gas-buscar-pdf/Main.gs`
if (!fs.existsSync(GS)) { console.log(`No está ${GS}. Salteado.`); process.exit(0) }

const fuente = fs.readFileSync(GS, "utf8").split("\r\n").join("\n")
const necesarias = ["evaluarCoincidencia", "numeroPegado", "tipoDocDeDescripcion", "tipoDocDeTexto", "nombreTipoDoc", "fechaEnTexto", "fechasDelTexto", "normalizarTexto", "extraerMontosPdf", "facturaCoincide"]
let codigo = ""
for (const fn of necesarias) {
  const i = fuente.indexOf(`function ${fn}(`)
  if (i < 0) { console.log(`✗ No se encontró ${fn} en el .gs — ¿le cambiaron el nombre?`); process.exit(1) }
  const fin = fuente.indexOf("\n}\n", i)
  codigo += fuente.slice(i, fin + 3) + "\n"
}
const g = new Function(codigo + `\nreturn { ${necesarias.join(", ")} }`)()

const r: { ok: boolean; caso: string; esperado: string; obtenido: string }[] = []
const chequear = (caso: string, esperado: string, obtenido: string) => r.push({ ok: esperado === obtenido, caso, esperado, obtenido })

// Una factura de ARCA, como la deja el OCR (sin separadores de miles en el monto).
const FC = { cuit: "30-71234567-8", punto_venta: 3, numero_desde: 1520, imp_total: 121000, tipo: "Factura A", fecha_emision: "2026-03-05" }
const textoFC = `ORIGINAL  FACTURA  A  COD. 01  Punto de Venta: 00003 Comp. Nro: 00001520
Fecha de Emisión: 05/03/2026  CUIT: 30712345678  Importe Total: $ 121000,00`
const textoNC = `ORIGINAL  NOTA DE CRÉDITO  A  COD. 03  Punto de Venta: 00003 Comp. Nro: 00001520
Fecha de Emisión: 05/03/2026  CUIT: 30712345678  Comprobante asociado: Factura A 00003-00001499  Importe Total: $ 121000,00`

const ev = (t: string, f: object) => g.evaluarCoincidencia(t, f)
const nivel = (t: string, f: object) => ev(t, f).nivel

chequear("Factura con los cinco datos → exacto", "exacto", nivel(textoFC, FC))
chequear("Nota de crédito con mismo CUIT, número y monto, buscando la FACTURA → a revisar (el caso real)", "dudoso", nivel(textoNC, FC))
chequear("…y el motivo lo dice", "el archivo es nota de crédito y la factura es factura", ev(textoNC, FC).motivos.join(" | "))
chequear("La misma nota de crédito, buscando la NOTA DE CRÉDITO → exacto (citar la factura no la vuelve factura)", "exacto",
  nivel(textoNC, { ...FC, tipo: "Nota de Crédito A" }))
chequear("Sin la fecha en el texto → a revisar con motivo", "dudoso|no se encontró la fecha 05/03/2026",
  (() => { const e = ev(textoFC.replace("05/03/2026", ""), FC); return `${e.nivel}|${e.motivos.join(" ")}` })())
chequear("Sin el tipo legible (foto mala) → a revisar, no descartada", "dudoso",
  nivel(textoFC.replace("FACTURA", "F4CTUR4"), FC))
chequear("Sin el CUIT → no es", "no", nivel(textoFC.replace("30712345678", "30999999999"), FC))
chequear("Sin el número → no es", "no", nivel(textoFC.replace("00001520", "00001521"), FC))
chequear("Monto distinto → a revisar, sin la base completa (la carpeta no lo usa)", "dudoso|false",
  (() => { const e = ev(textoFC.replace("121000,00", "99000,00"), FC); return `${e.nivel}|${e.base}` })())
chequear("Monto de una NC negativa en ARCA: se compara en valor absoluto", "exacto",
  nivel(textoNC, { ...FC, tipo: "Nota de Crédito A", imp_total: -121000 }))
chequear("La regla vieja de la carpeta (facturaCoincide) ahora exige lo mismo", "true|false",
  `${g.facturaCoincide(textoFC, "", FC)}|${g.facturaCoincide(textoNC, "", FC)}`)
chequear("Sin tipo ni fecha en el pedido (app vieja) → no se exigen", "exacto",
  nivel(textoFC.replace("FACTURA", "").replace("05/03/2026", ""), { ...FC, tipo: undefined, fecha_emision: undefined }))

// ── La fecha, en los formatos que aparecen ──
const F = "2026-03-05"
const formatos: [string, string, boolean][] = [
  ["dd/mm/aaaa", "Fecha 05/03/2026", true],
  ["dd-mm-aaaa", "Fecha 05-03-2026", true],
  ["dd.mm.aaaa", "Fecha 05.03.2026", true],
  ["dd/mm/aa", "Fecha 05/03/26 Hora", true],
  ["d/m/aaaa", "Fecha 5/3/2026", true],
  ["aaaa-mm-dd", "2026-03-05T10:00", true],
  ["con espacios del OCR", "05 / 03 / 2026", true],
  ["texto largo", "Buenos Aires, 5 de marzo de 2026", true],
  ["con tilde y mayúsculas", "5 DE MARZO DE 2026", true],
  ["mes abreviado", "05-MAR-2026", true],
  ["otro año", "05/03/2027", false],
  ["otro día", "06/03/2026", false],
  ["el 25 no es el 5 (sin ceros)", "25/3/2026", false],
  ["el 25 no es el 5 (en letras)", "25 de marzo de 2026", false],
]
for (const [nom, txt, esp] of formatos) chequear(`Fecha ${nom}: «${txt}»`, String(esp), String(g.fechaEnTexto(txt, F)))
chequear("dd/mm/aa no se confunde con un año de 4 cifras («05/03/20» dentro de 05/03/2026)", "false",
  String(g.fechaEnTexto("05/03/2026", "2020-03-05")))
chequear("Setiembre también vale", "true", String(g.fechaEnTexto("7 de setiembre de 2026", "2026-09-07")))

// ── El tipo ──
chequear("Tipo de la descripción de ARCA", "FC|NC|ND|FC|null",
  ["Factura B", "Nota de Crédito C", "Nota de Debito A", "Recibo C", ""].map(d => String(g.tipoDocDeDescripcion(d))).join("|"))
chequear("Tipo leído del archivo", "FC|NC|ND|FC|null",
  ["FACTURA B", "NOTA DE CREDITO B — Factura asociada", "Nota de Débito", "TICKET", "comprobante"].map(t => String(g.tipoDocDeTexto(t))).join("|"))

// ── Lo que dice el archivo (v0.19.0): para revisar sin abrirlo a ciegas ──
chequear("Fechas leídas del texto (sin repetir, año de 2 cifras, sin días imposibles)", "03/03/2026|30/03/2026|01/04/2026",
  g.fechasDelTexto("Fecha 03/03/2026 · Vto: 30-03-26 · 03/03/2026 · 45/13/2026 · Período 1.4.2026").join("|"))
const evLeido = ev("CUIT 20103619115 Factura A 00010-00006115 Fecha 04/03/2026 Total 1068365,63", { cuit: "20103619115", punto_venta: 10, numero_desde: 6115, imp_total: 1068365.63, tipo: "Factura A", fecha_emision: "2026-03-05" })
chequear("Un dudoso dice lo que leyó: tipo, monto y la fecha que SÍ tiene", "dudoso|factura|1068365.63|04/03/2026",
  [evLeido.nivel, evLeido.leido?.tipo, evLeido.leido?.monto, (evLeido.leido?.fechas || []).join(",")].join("|"))

// ── Dos huecos vistos en marzo 2026, con el TEXTO REAL del registro del archivo digital (2026-10-23) ──
// Río Tala imprime el número todo junto: «00132220» = punto de venta 0013 + número 2220 (4+4 dígitos), y
// factura dos líneas por mes con números seguidos (2220 y 2221, mismo importe y fecha).
const textoRioTala = `COOPERATIVA DE PROVISION DE AGUA POTABLE Y OTROS SERV. PUBLICOS DE RIO TALA LTDA.
SERVICIO TELEFONICO
CUIT: 30-61580376-2 INGRESOS BRUTOS EXENTO
DNRP: 61580376
00132220
498193
actura No:
03/2026
02/03/2026
Fecha de Emisión:
30-61778601-6
13.717,98
Sr. Usuario:Usted tiene el derecho a reclamar una indemnización si le factur mos sumas o conceptos indebidos o le reclamamos el pago de facturas ya abonadas.
Total Factura
13.717,98`
const RT = { cuit: "30615803762", punto_venta: 13, numero_desde: 2220, imp_total: 13717.98, tipo: "Factura A", fecha_emision: "2026-03-02" }
chequear("Río Tala: el número 4+4 pegado («00132220») es el 13-2220 → exacto", "exacto", nivel(textoRioTala, RT) + (nivel(textoRioTala, RT) === "exacto" ? "" : " " + ev(textoRioTala, RT).motivos.join(" | ")))
chequear("Río Tala: la otra línea del mes (13-2221) NO es este archivo", "no", nivel(textoRioTala, { ...RT, numero_desde: 2221 }))
chequear("Número pegado sólo como renglón suelto: dentro de un número más largo no vale", "false|true|true",
  [g.numeroPegado("CAE 7700132220123", 13, 2220), g.numeroPegado("Nro 001300002220", 13, 2220), g.numeroPegado("0001300002220", 13, 2220)].map(String).join("|"))
// Hernández imprime la fecha pegada a la hora: «Fecha30-03-2617:27:56» = 30/03/26 a las 17:27.
const textoHernandez = `VETERINARIA HERNANDEZ
HERNANDEZ CRISTOBAL MATIAS PIO BARTOLOMEMITRE1571
CUIT:20224765658
A
Factura
Nº 0101-00000109
IniciodeActividades:01∕12∕2000 Fecha30-03-2617:27:56
MARTINEZSOBRADOAGRO S.R.
30617786016
Subtotal 295041,33 Impuestos 61958,69 Descuento 0,00 TOTAL 357000,00
CAE86139599390860
Vto.CAE20260409`
const HZ = { cuit: "20224765658", punto_venta: 101, numero_desde: 109, imp_total: 357000.02, tipo: "Factura A", fecha_emision: "2026-03-30" }
chequear("Hernández: la fecha pegada a la hora («30-03-2617:27:56») es el 30/03/2026 → exacto", "exacto", nivel(textoHernandez, HZ))
chequear("…y lo que se le muestra al revisar es 30/03/2026, no «30/03/2617»", "30/03/2026", g.fechasDelTexto("Fecha30-03-2617:27:56").join("|"))
chequear("Fecha pegada a la hora: otro día sigue sin valer, y un año de 4 cifras pegado tampoco se corta", "false|false",
  [g.fechaEnTexto("Fecha29-03-2617:27:56", "2026-03-30"), g.fechaEnTexto("30-03-2026", "2020-03-30")].map(String).join("|"))

const mal = r.filter(x => !x.ok)
for (const x of r) {
  console.log(`  ${x.ok ? "✓" : "✗"} ${x.caso}`)
  if (!x.ok) console.log(`      obtenido: ${x.obtenido}\n      esperado: ${x.esperado}`)
}
console.log(`\n${r.length - mal.length} de ${r.length} pasaron`)
process.exit(mal.length ? 1 : 0)
