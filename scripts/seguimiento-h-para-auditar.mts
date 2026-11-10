/**
 * 📈 SEGUIMIENTO del «H para auditar» versión por versión (JMS 10/11: «preciso que me hagas un Excel con el punto A completo así yo voy
 * teniendo una guía de este proceso»). Lee la foto de números de cada versión (scripts/foto-h-para-auditar.mts --json) y arma:
 *   · «Versiones»: los números de cada versión, la diferencia contra la anterior (fórmulas) y qué cambió;
 *   · «Los saltos»: cada cambio de número explicado y cerrado con su control;
 *   · «Scripts de datos»: los scripts que tocaron la base (235–240), con el OK de JMS y su deshacer.
 * SÓLO LEE.  npx tsx scripts/seguimiento-h-para-auditar.mts <fotos.json>
 */
import XLSX from "xlsx-js-style"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { aplicarVistas } from "../lib/balance/formato-excel"
import { agregarHoja, vistasDe } from "../lib/balance/export-libro-diario"

type Foto = { archivo: string; solapas: Record<string, { total: number; cuotas: number }>; retiros: Record<string, number>;
  otrasPuntas: { n: number; total: number }; control: Record<string, { totalBanco: number }> }
const crudo = JSON.parse(readFileSync(process.argv[2], "utf8"))
const fotos: Foto[] = (Array.isArray(crudo) ? crudo : crudo.fotos).filter((f: Foto) => !/copia/i.test(f.archivo))
const r2 = (n: number) => Math.round(n * 100) / 100
const version = (a: string) => Number(a.match(/ v(\d+)\.xlsx$/)?.[1] ?? 1)

/** Qué cambió en cada versión (lo de presentación no mueve números; el detalle está en la solapa «Cambios de presentación» del libro). */
const QUE: Record<number, [string, string, string]> = {  // [tipo, qué cambió, script]
  1: ["Base", "Primera versión (07/11): cada cuota con quién pagó, código, efecto y marca; control por template; «Retiros y aportes» con su control contra el banco.", ""],
  2: ["Presentación", "Índice desplegable por responsable (MSA, MA, PAM) y link «⬅ Índice» en cada solapa.", ""],
  3: ["Presentación", "Fila fija en el encabezado del detalle; formato de columnas de JMS.", ""],
  4: ["Presentación", "Columna Agrupadora en «Retiros y aportes»; el resumen se pliega con [−]/[+].", ""],
  5: ["Presentación", "Ajustes de presentación (sin cambio de números).", ""],
  6: ["Presentación", "Respaldo «FOTO ANTES del cambio de exposición» (base para comparar el cambio de las dos puntas).", ""],
  7: ["Exposición", "LAS DOS PUNTAS: cada transferencia entre empresas cuenta una sola vez (la salida); las 32 entradas van a «Otras puntas — no suman».", ""],
  8: ["Presentación", "Respaldo «FOTO ANTES de la revisión completa» (plan 0–4).", ""],
  9: ["Presentación", "Revisión completa: misma frase en las dos puntas, Retiros por QUIÉN RECIBE, contexto (descripción, beneficiario, factura, interno), Índice con totales.", ""],
  10: ["Presentación", "Orden de solapas; Retiros por fecha.", ""],
  11: ["Presentación", "Detalle de cada agrupadora por impuesto → partida → fecha.", ""],
  12: ["Presentación", "Efecto nunca vacío; tabla «POR EFECTO» al pie.", ""],
  13: ["Presentación", "Solapa «Inconsistencias».", ""],
  14: ["Presentación", "Índice con Pagado y Sin pagar; las 🔴 en rojo suave.", ""],
  15: ["Presentación", "Resumen por impuesto → establecimiento → partida.", ""],
  16: ["Presentación", "Solapa «Datos a revisar» (DR1 a DR10) con links.", ""],
  17: ["Presentación", "Proveedor, Comprobante y Detalle en «Retiros y aportes».", ""],
  18: ["Presentación", "Links desde los índices de cosas a definir.", ""],
  19: ["Presentación", "Subtotal por establecimiento; «Por efecto» y «Por establecimiento» antes del control.", ""],
  20: ["Presentación", "Sin el inmovilizado de paneles; subtotal también para Lima y Rojas, partidas plegadas.", ""],
  21: ["Presentación", "Orden de los impuestos; control «Pagado en ANUAL y en CUOTAS»; DR11; estética de las tablas del pie.", ""],
  22: ["DATOS", "Automotores: una sola modalidad por vehículo (Gol, Tiguan, Toyota en cuotas, Municipalidad SP); Toyota 2025 cerrado; histórico 2025; 11 cuotas en $ 0 de la modalidad inactiva desactivadas; El Relincho. + Control de estructura (Principal e Inconsistencias); lo pendiente en $ 0 va a la deuda.", "235, 236, 237"],
  23: ["Presentación", "«Ir a» en el bloque de estructura; tabla «De un total al otro» en Retiros.", ""],
  24: ["Presentación", "Los controles con fórmulas (729 verificadas recalculando en Excel).", ""],
  25: ["DATOS", "Victor (albañil del chalet): 2 pagos de la Caja Sigot vinculados a sus cuotas, CTA MA X / DIST MA, cuenta nueva Mantenimiento edilicio. + Columna «Cuenta de la cuota»; Inconsistencias «sin cuenta» y «en $ 0 pero el banco movió plata»; orden por vehículo.", "238"],
  26: ["Presentación", "DR1 «¿Qué estás viendo?» con un link por caso (reemplazada en la v27: no era un desglose de DR1).", ""],
  27: ["Presentación", "DR1 desglosado (A1–A3 suman DR1); aparte, sin sumar, B1–B3. ⚠️ El TOTAL daba 0 (fórmula a filas equivocadas).", ""],
  28: ["Presentación", "Corrige el TOTAL del DR1 desglosado (5.560.660,50 ✓).", ""],
  29: ["DATOS", "Consumos MA 2025, Gastos Médicos 2025 y Gastos Médicos sin año pasan de PAM a MA.", "239"],
  30: ["Presentación", "DR1 marca lo resuelto.", ""],
  31: ["DATOS", "Suscripciones 2025 (Netflix, Paquete TV MA, Club La Nación, Jockey Club) pasan a MA; código interno «DIST MA» vacío. + Las compras en dólares con tarjeta en $ 0 saltan en Inconsistencias (61 cuotas).", "240"],
}

const filas = fotos.map(f => {
  const sol = Object.values(f.solapas)
  return { v: version(f.archivo), cuotas: sol.reduce((t, s) => t + s.cuotas, 0), total: r2(sol.reduce((t, s) => t + s.total, 0)),
    retiros: r2(f.retiros["TOTAL"] ?? 0), op: f.otrasPuntas, ctrl: Object.keys(f.control).length,
    banco: r2(Object.values(f.control).reduce((t, c) => t + (c.totalBanco ?? 0), 0)) }
}).sort((a, b) => a.v - b.v)

const C = (v: string) => ({ t: "s", v, s: { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, fill: { patternType: "solid", fgColor: { rgb: "FFEEF1F0" } } } })
const MON = "#,##0.00;(#,##0.00);\"-\""
const ROJO = { patternType: "solid", fgColor: { rgb: "FFFFF2CC" } }

// ── 1 · Versiones
const h: unknown[][] = [["SEGUIMIENTO DEL «H PARA AUDITAR» — MSA ejercicio 25/26, versión por versión"],
  ["Cada versión medida con el mismo control (scripts/foto-h-para-auditar.mts). Las columnas «Δ» son la diferencia contra la versión anterior (fórmulas). Los renglones en amarillo cambiaron números: ver «Los saltos»."], [],
  ["Versión", "Cuotas", "Total de las cuotas", "Retiros y aportes (TOTAL)", "Otras puntas (cant.)", "Otras puntas ($)", "Control contra el banco (renglones)", "Total del banco",
    "Δ cuotas", "Δ total de las cuotas", "Δ Retiros", "Δ banco", "Tipo", "Qué cambió", "Script"].map(C)]
const f1 = h.length + 1
for (const [i, x] of filas.entries()) {
  const n = h.length + 1, q = QUE[x.v] ?? ["Presentación", "Ajustes de presentación (sin cambio de números).", ""]
  const d = (col: string) => i === 0 ? "" : { t: "n", f: `${col}${n}-${col}${n - 1}`, v: 0, z: MON }
  const fila: unknown[] = [`v${x.v}`, x.cuotas, x.total, x.retiros, x.op.n, x.op.total, x.ctrl, x.banco, d("B"), d("C"), d("D"), d("H"), q[0], q[1], q[2]]
  if (i > 0) { const p = filas[i - 1]; (fila[8] as any).v = x.cuotas - p.cuotas; (fila[9] as any).v = r2(x.total - p.total); (fila[10] as any).v = r2(x.retiros - p.retiros); (fila[11] as any).v = r2(x.banco - p.banco)
    if (x.cuotas !== p.cuotas || x.retiros !== p.retiros || x.banco !== p.banco || x.total !== p.total) for (let k = 0; k < fila.length; k++) { const c = fila[k]; fila[k] = c && typeof c === "object" ? { ...(c as object), s: { fill: ROJO } } : { t: typeof c === "number" ? "n" : "s", v: c ?? "", s: { fill: ROJO }, ...(typeof c === "number" ? { z: k === 1 || k === 4 || k === 6 ? "#,##0" : MON } : {}) } } }
  h.push(fila)
}
const fN = h.length
h.push([], [{ t: "s", v: "CONTROL — el total de las cuotas no tiene que moverse en ninguna versión", s: { font: { bold: true } } }])
h.push(["Máximo − mínimo del total de las cuotas", "", { t: "n", f: `MAX(C${f1}:C${fN})-MIN(C${f1}:C${fN})`, v: 0, z: MON },
  { t: "s", f: `IF(ABS(C${h.length + 1})<0.01,"✓ igual en todas las versiones","⚠️ cambió: ver la columna Δ")`, v: "✓ igual en todas las versiones" }])

// ── 2 · Los saltos
const s: unknown[][] = [["LOS SALTOS — cada cambio de número, explicado y con su control"], [],
  ["Versión", "Qué se mide", "Cambio", "De qué se compone", "Importe", "¿Cierra?"].map(C)]
const salto = (ver: string, que: string, cambio: number, partes: Array<[string, number]>) => {
  const i0 = s.length + 1
  partes.forEach(([t, v], k) => s.push([k ? "" : ver, k ? "" : que, k ? "" : { t: "n", v: cambio, z: MON }, t, { t: "n", v, z: MON }, ""]))
  const n = s.length + 1
  s.push(["", "", "", { t: "s", v: "= suma de las partes", s: { font: { bold: true } } }, { t: "n", f: `SUM(E${i0}:E${n - 1})`, v: r2(partes.reduce((t, p) => t + p[1], 0)), z: MON, s: { font: { bold: true } } },
    { t: "s", f: `IF(ABS(E${n}-C${i0})<0.01,"✓ cierra","⚠️ no cierra")`, v: Math.abs(partes.reduce((t, p) => t + p[1], 0) - cambio) < 0.01 ? "✓ cierra" : "⚠️ no cierra" }], [])
}
salto("v7", "Retiros y aportes", 79600000, [["Las 32 entradas que hasta la v6 RESTABAN (eran la otra punta de una salida que ya sumaba): ahora van a «Otras puntas — no suman»", 79600000]])
salto("v22", "Cuotas", -12, [["Cuotas en $ 0 de la modalidad inactiva que dejaron de estar en el libro (desactivadas) y Toyota 2025 ARBA desactivadas, menos las 2 de Toyota 2026 que entran (05/01 y 05/04/26) — todas en $ 0, el total no cambia", -12]])
salto("v25", "Retiros y aportes", 800000, [["Victor, albañil del chalet: 2 pagos de la Caja Sigot de $ 400.000, ahora «retiro de MA X pagado por MSA» (CTA MA X)", 800000]])
salto("v25", "Total del banco", 800000, [["Los mismos 2 pagos, ahora con código CTA MA X: renglón nuevo «MSA · CTA MA X» en el control", 800000]])
salto("v29", "Retiros y aportes", -5159951.86, [["Sale «MA pagó por PAM»: Consumos MA y Gastos Médicos 2025 pagados por MA, ahora de MA", -5233150.66], ["Entra «distribución PAM → MA»: lo que pagó PAM de esos templates (VISA PAM $ 43.050 + Galicia PAM CA $ 30.148,80)", 73198.80]])
salto("v31", "Retiros y aportes", 194169.64, [["Sale «MA pagó por PAM»: suscripciones 2025 pagadas por MA, ahora de MA", -327509.84], ["Entra «distribución PAM → MA»: suscripciones 2025 pagadas con la VISA PAM", 521679.48]])

// ── 3 · Scripts de datos
const d: unknown[][] = [["SCRIPTS DE DATOS — lo que se cambió en la base (con foto previa y deshacer exacto; nada se borró)"], [],
  ["Script", "Fecha", "Qué cambió", "OK de JMS", "Deshacer", "Versión del Excel"].map(C),
  ["235", "09/11/2026", "Automotores Gol, Tiguan y Toyota: el ANUAL se desactiva y el de CUOTAS se activa; cuotas 2026 de Gol y Tiguan a pendiente.", "«desactivar anuales, activar cuotas… no fueron pagas así que irían a adeudadas»", "235-automotores-anual-a-cuota-deshacer.sql", "v22"],
  ["236", "09/11/2026", "Toyota 2025 cerrado (anual pagado a ARBA el 26/03/25, $ 87.896,90); Toyota 2026 nuevo (Municipalidad SP, 3 cuotas pendientes en $ 0); histórico ene–jun 2025 de Gol, Tiguan, Amarok y Voyage.", "«que el template de Toyota 2025 exista… creamos el de 2026» · «adelante con todo»", "236-automotores-2025-y-toyota-2026-deshacer.sql", "v22"],
  ["237", "09/11/2026", "11 cuotas en $ 0, sin pago, de la modalidad inactiva → desactivadas (Red Vial Rojas y Lima, ABL Libertad, Lote Puerto, Quintas Rosello); El Relincho con su grupo y partida.", "«adelante con todo… todas las inconsistencias de cuota contra anual resueltas»", "237-modalidad-inactiva-desactivada-deshacer.sql", "v22"],
  ["238", "09/11/2026", "Victor (albañil del chalet): 2 pagos de la Caja Sigot vinculados a sus 2 cuotas de Otros Gastos, CTA MA X / DIST MA, centro de costo Chalet; cuenta nueva 422141 MANTENIMIENTO EDILICIO.", "«son pagos al albañil Victor… CTA MA X… DIST MA en interno» · «A5.3 mantenimiento edilicio»", "238-victor-chalet-mantenimiento-edilicio-deshacer.sql", "v25"],
  ["239", "10/11/2026", "Consumos MA 2025, Gastos Médicos 2025 y Gastos Médicos sin año: responsable PAM → MA (el de sin año, año 2026 y agrupadora Gastos Personales MA).", "«D1 sí»", "239-gastos-ma-2025-responsable-ma-deshacer.sql", "v29"],
  ["240", "10/11/2026", "Suscripciones 2025 (Netflix, Paquete TV MA, Club La Nación, Jockey Club) → MA; código interno «DIST MA» vacío en esos 4 y en los 3 del 239.", "«C1 también son de MA» · «C ok»", "240-suscripciones-ma-y-codigo-interno-deshacer.sql", "v31"],
  [], ["Respaldos del Excel: Balance/respaldos («ANTES script 239», «ANTES script 240», «DESPUES 2», «FOTO ANTES…»). Los scripts y sus fotos previas están en la carpeta scripts/ del repo."]]

const wb = XLSX.utils.book_new()
agregarHoja(wb as any, "Versiones", h, [8, 9, 18, 20, 11, 16, 12, 18, 9, 14, 16, 14, 13, 90, 12].map((ancho, i) => ({ ancho, ...(i >= 2 && i <= 11 && i !== 4 && i !== 6 && i !== 8 ? { z: MON } : {}) })) as any)
agregarHoja(wb as any, "Los saltos", s, [9, 20, 16, 110, 18, 14].map(ancho => ({ ancho })) as any)
agregarHoja(wb as any, "Scripts de datos", d, [8, 12, 90, 55, 50, 12].map(ancho => ({ ancho })) as any)
const destino = join("- Comunicacion JMS Claude - Archivos/Balance/Excels trabajando con claude", "Seguimiento H para auditar - versiones (2026-11-10).xlsx")
const { writeFileSync } = await import("node:fs")
writeFileSync(destino, Buffer.from(await aplicarVistas(XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer, vistasDe(wb as any))))
console.log("📄", destino, "·", filas.length, "versiones")
