/**
 * `npm run probar:registro-mails` — la lógica del REGISTRO DE MAILS (A-FEAT-1425), sin Gmail ni base.
 *
 * Se carga `gas-buscar-pdf/RegistroMails.gs` tal cual (a nivel archivo sólo declara constantes y funciones: no toca
 * Google al cargarse) y se prueban las funciones puras: se prueba el código que se despliega, no una copia.
 * 🔒 No toca la base ni la red. Las reglas de abajo son copias de las del script 140, con los asuntos reales del
 * catálogo del 30/10.
 */
import fs from "node:fs"

const GS = `${process.cwd().split("\\").join("/")}/gas-buscar-pdf/RegistroMails.gs`
const fuente = fs.readFileSync(GS, "utf8")
const g = new Function(fuente + `\nreturn { emailDe_, nombreDe_, mismaCasilla_, reglaCoincide_, clasificarMail_, linkGmail_, armarReporte_, gravedadMail_, agruparGraves_ }`)()

const r: { ok: boolean; caso: string; esperado: string; obtenido: string }[] = []
const chequear = (caso: string, esperado: string, obtenido: string) => r.push({ ok: esperado === obtenido, caso, esperado, obtenido })

const REGLAS = [
  { id: "r-mora", orden: 10, remitente_patron: "@arba.gov.ar", asunto_patron: "mora", tipo: "impuestos", accion: "avisar" },
  { id: "r-arba", orden: 50, remitente_patron: "@arba.gov.ar", asunto_patron: null, tipo: "impuestos", accion: "guardar" },
  { id: "r-sneg", orden: 10, remitente_patron: "@mails.santander.com.ar", asunto_patron: "saldo negativo", tipo: "banco", accion: "avisar" },
  { id: "r-sant", orden: 50, remitente_patron: "@mails.santander.com.ar", asunto_patron: null, tipo: "banco", accion: "guardar" },
  { id: "r-gven", orden: 10, remitente_patron: "@mail.galicia.ar", asunto_patron: "venci", tipo: "banco", accion: "avisar" },
  { id: "r-gpro", orden: 95, remitente_patron: "@mail.galicia.ar", asunto_patron: null, tipo: "propaganda", accion: "archivar" },
  { id: "r-pers", orden: 50, remitente_patron: "@personal.com.ar", asunto_patron: "factura", tipo: "servicios", accion: "guardar" },
  { id: "r-pers2", orden: 50, remitente_patron: "@personal.com.ar", asunto_patron: null, tipo: "propaganda", accion: "archivar" },
  { id: "r-cont", orden: 50, remitente_patron: "contador@ejemplo.com", asunto_patron: null, tipo: "contador", accion: "guardar" },
  { id: "r-off", orden: 1, activa: false, remitente_patron: "@arba.gov.ar", asunto_patron: null, tipo: "otro", accion: "archivar" },
]
const cl = (de: string, asunto: string) => { const c = g.clasificarMail_(REGLAS, de, asunto); return `${c.regla_id ?? "-"} ${c.tipo ?? "-"} ${c.accion ?? "-"}` }

// Remitente
chequear("email y nombre del remitente", "e-resumen@bancogalicia.com.ar · Banco Galicia",
  `${g.emailDe_('"Banco Galicia" <E-Resumen@BancoGalicia.com.ar>')} · ${g.nombreDe_('"Banco Galicia" <E-Resumen@BancoGalicia.com.ar>')}`)
chequear("Gmail ignora los puntos: sanmanuelsp@ es sanmanuel.sp@", "true false",
  `${g.mismaCasilla_("sanmanuelsp@gmail.com", "sanmanuel.sp@gmail.com")} ${g.mismaCasilla_("sanmanuel@gmail.com", "sanmanuel.sp@gmail.com")}`)

// Reglas
chequear("dominio: vale el dominio y sus subdominios, no uno que sólo termina igual", "true true false",
  [g.reglaCoincide_({ remitente_patron: "@santander.com.ar" }, "x@mails.santander.com.ar", ""),
   g.reglaCoincide_({ remitente_patron: "@santander.com.ar" }, "x@santander.com.ar", ""),
   g.reglaCoincide_({ remitente_patron: "@santander.com.ar" }, "x@nosantander.com.ar", "")].join(" "))
chequear("🔴 Santander «Saldo negativo excedido» → AVISAR (gana la regla específica)", "r-sneg banco avisar",
  cl("Santander <mensajesyavisos@mails.santander.com.ar>", "Saldo negativo excedido SAN MANUEL SRL"))
chequear("Santander «Consulta de saldo» → guardar (la general)", "r-sant banco guardar",
  cl("mensajesyavisos@mails.santander.com.ar", "Consulta de saldo SAN MANUEL SRL"))
chequear("🔴 ARBA «Mora en el pago…» → AVISAR · la boleta → guardar", "r-mora impuestos avisar | r-arba impuestos guardar",
  `${cl("novedades@arba.gov.ar", "Mora en el pago del impuesto Inmobiliario complementario cuota 3")} | ${cl("boletaelectronica@arba.gov.ar", "Boleta por Mail - Inmobiliario Rural Cuota 4")}`)
chequear("🔴 Galicia «Se venció tu certificado MiPyme» (con tilde) → AVISAR, no propaganda", "r-gven banco avisar",
  cl("bancogalicia@mail.galicia.ar", "Se venció tu certificado MiPyme"))
chequear("Galicia promo → propaganda archivar", "r-gpro propaganda archivar", cl("nyp@mail.galicia.ar", "Elegí Galicia para tu FAL"))
chequear("a igual orden, la regla que pide asunto va antes: Personal factura → servicios; encuesta → propaganda",
  "r-pers servicios guardar | r-pers2 propaganda archivar",
  `${cl("x@personal.com.ar", "Ya podés acceder a tu factura")} | ${cl("x@personal.com.ar", "Contanos tu experiencia")}`)
chequear("una regla apagada no cuenta", "r-arba impuestos guardar", cl("dfe@arba.gov.ar", "Comunicado"))
chequear("sin regla → vacío (el reporte lo muestra para agregarla)", "- - -", cl("alguien@desconocido.com", "Hola"))
chequear("el propio reporte se archiva solo", "- notificacion archivar", cl("sanmanuelsp@gmail.com", "[Registro de mails] 30/10 — 3 para mirar"))

// Link
chequear("link a Gmail por casilla + id", "https://mail.google.com/mail/u/?authuser=sanmanuel.sp%40gmail.com#all/1a16045a7b9ffafb",
  g.linkGmail_("sanmanuel.sp@gmail.com", "1a16045a7b9ffafb"))

// Reporte
const F = (o: object) => ({ sentido: "recibido", remitente: "x@y.com", asunto: "a", mensaje_id: "m", ...o })
const filas = [
  F({ mensaje_id: "m1", accion: "avisar", tipo: "impuestos", asunto: "Mora <ARBA>" }),
  F({ mensaje_id: "m2", accion: "guardar", tipo: "contador", asunto: "Subdiarios" }),
  F({ mensaje_id: "m3", accion: "guardar", tipo: "factura", asunto: "FC 1", adjuntos: [{ nombre: "fc.pdf" }], procesado_por: "buscador_facturas" }),
  F({ mensaje_id: "m4", accion: "archivar", tipo: "propaganda", remitente_nombre: "PPI" }),
  F({ mensaje_id: "m5", accion: "archivar", tipo: "propaganda", remitente_nombre: "PPI" }),
  F({ mensaje_id: "m6", tipo: null, accion: null, asunto: "¿qué es esto?" }),
  F({ mensaje_id: "m7", accion: "guardar", tipo: "otro", tipo_manual: "legal", asunto: "Contrato" }),
  { sentido: "enviado", mensaje_id: "m8", asunto: "Detalle de pago — FC 2752", destinatarios: "proveedor@ejemplo.com" },
]
const rep = g.armarReporte_(filas, "sanmanuel.sp@gmail.com", "29/10 07:00", "30/10 07:00")
const resumen = [rep.cierra ? "cierra" : "no cierra", rep.asunto,
  rep.html.includes("Para mirar (1)") ? "mirar1" : "-", rep.html.includes("Sin regla — decir qué son (1)") ? "sinregla1" : "-",
  rep.html.includes("Legal / sucesión (1)") ? "manual-manda" : "-", rep.html.includes("PPI 2") ? "archivados-contados" : "-",
  rep.html.includes("Mora &lt;ARBA&gt;") ? "escapado" : "-", rep.html.includes("#all/m8") ? "enviado-con-link" : "-",
  rep.html.includes("✔ buscador_facturas") ? "procesado" : "-"].join(" · ")
chequear("reporte: lo que mirar arriba, sin regla aparte, el tipo a mano manda, archivados contados, control que cierra",
  "cierra · [Registro de mails] 30/10 07:00 — 1 para mirar · 7 recibidos · mirar1 · sinregla1 · manual-manda · archivados-contados · escapado · enviado-con-link · procesado",
  resumen)

// Pendientes (A-FEAT-1437): arriba de todo, de cualquier fecha, vencidos primero y marcados; el asunto los cuenta
const pend = [
  { mensaje_id: "p1", fecha: "2026-10-21T10:00:00Z", asunto: "Mora complementario", remitente: "x@arba.gov.ar", seguimiento_fecha: "2026-11-05", seguimiento_nota: "pagar <cuota 3>" },
  { mensaje_id: "p2", fecha: "2026-09-01T10:00:00Z", asunto: "Intimación", remitente: "x@y.com", seguimiento_fecha: "2026-10-25", seguimiento_nota: null },
  { mensaje_id: "p3", fecha: "2026-10-30T10:00:00Z", asunto: "Sin fecha", remitente: "x@y.com", seguimiento_fecha: null, seguimiento_nota: null },
]
const repP = g.armarReporte_(filas, "sanmanuel.sp@gmail.com", "30/10 07:00", "31/10 07:00", pend, "2026-10-31")
const iP = repP.html.indexOf("📌 Pendientes"), iM = repP.html.indexOf("Para mirar")
const orden = ["#all/p2", "#all/p1", "#all/p3"].map(x => repP.html.indexOf(x))
const resumenP = [repP.asunto, iP >= 0 && iP < iM ? "arriba" : "-", orden[0] < orden[1] && orden[1] < orden[2] ? "vencido-primero" : "-",
  repP.html.includes("vencido 25/10") ? "marca-vencido" : "-", repP.html.includes("para el 05/11") ? "fecha" : "-",
  repP.html.includes("pagar &lt;cuota 3&gt;") ? "nota-escapada" : "-",
  g.armarReporte_(filas, "sanmanuel.sp@gmail.com", "a", "b").html.includes("Pendientes") ? "aparece-sin" : "sin-pendientes-no-aparece"].join(" · ")
chequear("reporte: los pendientes van arriba, vencidos primero y marcados, con su nota; sin pendientes no hay sección",
  "[Registro de mails] 31/10 07:00 — 3 pendientes (1 vencidos) · 1 para mirar · 7 recibidos · arriba · vencido-primero · marca-vencido · fecha · nota-escapada · sin-pendientes-no-aparece",
  resumenP)

// Paridad GAS ↔ app: la clasificación de la app (para «reaplicar reglas») tiene que dar lo mismo que la del GAS
const app = await import("../lib/mails/registro.ts")
const casos: [string, string][] = [
  ["Santander <mensajesyavisos@mails.santander.com.ar>", "Saldo negativo excedido SAN MANUEL SRL"], ["mensajesyavisos@mails.santander.com.ar", "Consulta de saldo"],
  ["novedades@arba.gov.ar", "Mora en el pago del impuesto"], ["boletaelectronica@arba.gov.ar", "Boleta por Mail"], ["bancogalicia@mail.galicia.ar", "Se venció tu certificado MiPyme"],
  ["nyp@mail.galicia.ar", "Elegí Galicia"], ["x@personal.com.ar", "Ya podés acceder a tu factura"], ["x@personal.com.ar", "Contanos"], ["dfe@arba.gov.ar", "Comunicado"],
  ["alguien@desconocido.com", "Hola"], ["contador@ejemplo.com", "Subdiarios"],
]
const reglasApp = REGLAS.map(x => ({ activa: true, nota: null, ...x })) as any[]
const difieren = casos.filter(([de, as]) => { const a = g.clasificarMail_(REGLAS, de, as), b = app.clasificarConReglas(reglasApp, de, as); return a.regla_id !== b.regla_id || a.tipo !== b.tipo || a.accion !== b.accion })
chequear("la app clasifica IGUAL que el GAS (" + casos.length + " casos)", "0 distintos", `${difieren.length} distintos${difieren.length ? ": " + difieren.map(d => d[1]).join(" · ") : ""}`)

// 🚨 Graves (A-FEAT-1438): la regla del GAS da lo mismo que la de la app, y el reporte los pone arriba de todo, agrupados
const GR = (o: object) => ({ sentido: "recibido", accion: "guardar", tipo: "banco", tipo_manual: null, asunto: "", extracto: "", remitente: "x@y.com", ...o })
const casosGraves = [
  GR({ asunto: "Mora en el pago del impuesto Inmobiliario complementario", remitente: "novedades@arba.gov.ar", tipo: "impuestos", accion: "avisar" }),
  GR({ asunto: "Saldo negativo excedido SAN MANUEL SRL", remitente: "mensajesyavisos@mails.santander.com.ar", accion: "avisar" }),
  GR({ asunto: "Daily Mercados", extracto: "la deuda soberana", tipo: "propaganda", accion: "archivar" }),
  GR({ asunto: "Se RECHAZO fij. Pendiente 1000579367", remitente: "envios@bunge.com", tipo: "productivo" }),
  GR({ asunto: "Intimación de pago", remitente: "estudio@abogados.com", tipo: "legal" }),
  GR({ asunto: "Moratoria 2026", extracto: "demora en la entrega" }),
  GR({ sentido: "enviado", asunto: "Deuda con proveedor" }),
  GR({ asunto: "Aviso", remitente: "dfe@notificaciones.arba.gov.ar", tipo: null, extracto: "Se registra deuda vencida" }),
]
const vGas = casosGraves.map(c => { const x = g.gravedadMail_(c); return `${x.nivel}:${x.palabras.join("+")}` }).join(" ")
const vApp = casosGraves.map(c => { const x = app.gravedadDeMail(c as any); return `${x.nivel}:${x.palabras.join("+")}` }).join(" ")
chequear("graves: mora de ARBA y legal pesan doble; saldo negativo y rechazo cuentan; propaganda, enviados, «moratoria» y «demora» no",
  "2:mora 1:saldo negativo 0: 1:rechazo 2:intimacion 0: 0: 2:deuda+vencida", vGas)
chequear("graves: el GAS y la app dan lo mismo (" + casosGraves.length + " casos)", vGas, vApp)
const agr = g.agruparGraves_([
  { ...casosGraves[1], mensaje_id: "s1", fecha: "2026-10-01T10:00:00Z" }, { ...casosGraves[1], mensaje_id: "s2", fecha: "2026-10-30T10:00:00Z" },
  { ...casosGraves[0], mensaje_id: "a1", fecha: "2026-10-21T10:00:00Z", asunto: "RE: Mora en el pago del impuesto Inmobiliario complementario" },
  { ...casosGraves[3], mensaje_id: "b1", fecha: "2026-10-29T10:00:00Z", seguimiento: "terminado" },
])
const repG = g.armarReporte_(filas, "sanmanuel.sp@gmail.com", "30/10 07:00", "31/10 07:00", [], "2026-10-31", agr)
const vG = [agr.map((x: any) => `${x.nivel}:${x.n}:${x.ultimo.mensaje_id}`).join(" "), repG.asunto.includes("🚨 2 graves") ? "asunto" : "-",
  repG.html.indexOf("🚨 Graves") < repG.html.indexOf("Para mirar") ? "arriba" : "-", repG.html.includes("<b>×2</b>") ? "x2" : "-"].join(" · ")
chequear("graves en el reporte: agrupados por remitente + asunto (el RE: no separa), el terminado no va, doble primero, arriba de todo",
  "2:1:a1 1:2:s2 · asunto · arriba · x2", vG)

for (const x of r) console.log(`${x.ok ? "✓" : "✗"} ${x.caso}${x.ok ? "" : `\n    esperado: ${x.esperado}\n    obtenido: ${x.obtenido}`}`)
const malos = r.filter(x => !x.ok).length
console.log(`\n${r.length - malos} de ${r.length} pasaron`)
process.exit(malos ? 1 : 0)
