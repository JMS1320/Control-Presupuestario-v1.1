/**
 * 🧩 Script 167 — A-FEAT-1485: PARSEO DE SANTANDER (MSA) con el mismo motor que las cajas de ahorro de MA y PAM.
 * JMS 01/11: «el parseo de Santander sí hay que hacerlo, para usar lo que nos da para llenar columnas que usan los
 * motores y poder aplicar reglas. Usá los modelos de parseo de MA y de PAM».
 *
 *     npx tsx scripts/167-parseo-santander.mts              ← SIMULA (no escribe nada; muestra qué quedaría)
 *     npx tsx scripts/167-parseo-santander.mts --escribir   ← escribe (🛑 sólo con OK de JMS en esta terminal)
 *
 * Qué escribe (DATOS):
 *  1. `msa.santander.concepto` = el texto del banco en líneas (`bloqueSantander`), en las filas donde está vacío.
 *  2. Reglas de parseo de `msa_santander` en `public.config_parseo_extracto` (marca `[script 167]` en descripcion_campo):
 *     el tipo a `descripcion` y su grupo; interbanking: nombre / CUIT / comprobante; honorarios: referencia y comprobante;
 *     intereses: el período.
 *  3. El desglose (descripcion, grupo_de_conceptos, leyendas_adicionales_1..3, numero_de_comprobante, numero_de_terminal)
 *     con `parsearMovimiento` — la misma función que el importador y el re-parseo. NO toca categ, estado ni vínculos.
 *  4. Una regla de conciliación: CUIT propio 30617786016 en Santander → template «Interbancaria Santander» de MSA (la
 *     que ya usa Galicia del otro lado). Marca `[script 167]` en `detalle`.
 * Antes de escribir guarda la foto de cada fila que cambia en `scripts/167-parseo-santander-foto.json`.
 * Deshacer: `167-parseo-santander-deshacer.mts` — vuelve cada fila a su foto (por id) y borra sólo lo marcado [script 167].
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { bloqueSantander } from "../lib/extractos/cuentas-con-parseo"
import { parsearMovimiento, type MapaReglas } from "../lib/extractos/parseo-movimiento"

const ESCRIBIR = process.argv.includes("--escribir")
const FOTO = "scripts/167-parseo-santander-foto.json"
const MARCA = "[script 167]"
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const tabla = () => sb.schema("msa").from("santander")

// ── Las reglas de parseo (generales: sin subtipo) ──────────────────────────────────────────────────────────────
type R = { tipo: string; grupo: string; campo: string | null; regla: string; linea?: number; que: string }
const IMP = "000901 - Impuestos", COM = "000808 - Comisiones"
const REGLAS: R[] = [
  ...[["IMPUESTO LEY 25 413 DEBITO 0,6%", IMP], ["IVA 21% REG DE TRANSFISC LEY27743", IMP], ["IVA 10,5% REG TRANS FISC LEY 27743", IMP],
      ["IVA PERCEPCION RG 2408", IMP], ["IVA PERCEP RG 2408 ALIC REDUCIDA", IMP], ["IIBB PERCEPCION PCIA BUENOS AIRES", IMP],
      ["IIBB PERCEPCION BS AS GRUPO 10", IMP], ["IIBB PERCEPCION BS AS GRUPO 11", IMP], ["IMPUESTO DE SELLOS", IMP],
      ["COMISION POR SERVICIO DE CUENTA", COM], ["COMISION TARJETA DEBITO ADICIONAL", COM]]
    .map(([tipo, grupo]) => ({ tipo, grupo, campo: "descripcion", regla: "linea", linea: 1, que: "el tipo" })),
  { tipo: "INTERESES POR DESCUBIERTO EXCEDIDO", grupo: "000814 - Intereses", campo: "descripcion", regla: "linea", linea: 1, que: "el tipo" },
  { tipo: "INTERESES POR DESCUBIERTO EXCEDIDO", grupo: "000814 - Intereses", campo: "leyendas_adicionales_3", regla: "linea", linea: 2, que: "el período" },
  { tipo: "PAGOS CTAS PROPIAS INTERBANKING IN", grupo: "000907 - Transferencias", campo: "descripcion", regla: "linea", linea: 1, que: "el tipo" },
  { tipo: "PAGOS CTAS PROPIAS INTERBANKING IN", grupo: "000907 - Transferencias", campo: "leyendas_adicionales_1", regla: "pre_cuit", que: "el nombre" },
  { tipo: "PAGOS CTAS PROPIAS INTERBANKING IN", grupo: "000907 - Transferencias", campo: "leyendas_adicionales_2", regla: "cuit", que: "el CUIT" },
  { tipo: "PAGOS CTAS PROPIAS INTERBANKING IN", grupo: "000907 - Transferencias", campo: "numero_de_comprobante", regla: "nro_operacion", que: "el comprobante" },
  { tipo: "PAGO DE HONORARIOS", grupo: "000908 - Haberes", campo: "descripcion", regla: "linea", linea: 1, que: "el tipo" },
  { tipo: "PAGO DE HONORARIOS", grupo: "000908 - Haberes", campo: "numero_de_terminal", regla: "linea", linea: 2, que: "la referencia del banco" },
  { tipo: "PAGO DE HONORARIOS", grupo: "000908 - Haberes", campo: "numero_de_comprobante", regla: "nro_operacion", que: "el comprobante" },
]
const mapa: MapaReglas = {}
for (const r of REGLAS) (mapa[r.tipo] ??= []).push({ campo_destino: r.campo, tipo_regla: r.regla, numero_linea: r.linea ?? null, grupo_de_conceptos: r.grupo, firma_forma: null })

const CAMPOS = ["descripcion", "grupo_de_conceptos", "leyendas_adicionales_1", "leyendas_adicionales_2", "leyendas_adicionales_3", "numero_de_comprobante", "numero_de_terminal"] as const

// ── Leer y calcular ──────────────────────────────────────────────────────────────────────────────────────────
const frenos: string[] = []
const { data: filas, error } = await tabla().select(`id, fecha, estado, concepto, ${CAMPOS.join(", ")}`).order("fecha").order("orden")
if (error) { console.error(error.message); process.exit(1) }
const { count: reglasPrevias } = await sb.from("config_parseo_extracto").select("id", { count: "exact", head: true }).eq("cuenta_bancaria_id", "msa_santander")
if (reglasPrevias) frenos.push(`ya hay ${reglasPrevias} reglas de parseo de msa_santander: revisar antes (este script asume que no hay)`)
const { data: tpl } = await sb.from("egresos_sin_factura").select("id, categ, codigo_contable, codigo_interno").eq("nombre_referencia", "Interbancaria Santander").eq("responsable", "MSA").eq("activo", true)
if (tpl?.length !== 1) frenos.push(`el template «Interbancaria Santander» de MSA tiene que existir una sola vez (hay ${tpl?.length ?? 0})`)

const planes: { id: string; fecha: string; estado: string; antes: Record<string, unknown>; despues: Record<string, string> }[] = []
const porTipo = new Map<string, number>()
let sinRegla = 0
for (const f of (filas ?? []) as Record<string, any>[]) {
  const concepto = f.concepto || bloqueSantander(f.descripcion)
  const p = parsearMovimiento(concepto, mapa)
  if (p.grupo_de_conceptos === "Otros" || p.grupo_de_conceptos === "Subtipo nuevo" || p.grupo_de_conceptos === "Reglas en conflicto") sinRegla++
  const despues: Record<string, string> = {}
  if (!f.concepto) despues.concepto = concepto
  for (const c of CAMPOS) if (p[c] !== undefined && String(p[c]) !== String(f[c] ?? "")) despues[c] = p[c]
  porTipo.set(p.grupo_de_conceptos, (porTipo.get(p.grupo_de_conceptos) ?? 0) + 1)
  if (Object.keys(despues).length) planes.push({ id: f.id, fecha: f.fecha, estado: f.estado, antes: Object.fromEntries(Object.keys(despues).map(k => [k, f[k] ?? null])), despues })
}

console.log(`msa.santander: ${filas?.length} movimientos · cambian ${planes.length} · sin regla: ${sinRegla}`)
for (const [g, n] of porTipo) console.log(`   ${g}: ${n}`)
const muestra = planes.filter(p => p.despues.leyendas_adicionales_2 || p.despues.numero_de_terminal || p.despues.leyendas_adicionales_3)
console.log(`\nLos que traen datos (${muestra.length}):`)
for (const p of muestra) console.log(`   ${p.fecha} [${p.estado}] ${JSON.stringify(p.despues)}`)
console.log(`\nY la regla de conciliación: CUIT 30617786016 en msa_santander → «Interbancaria Santander» (${tpl?.[0]?.categ ?? "?"})`)
if (sinRegla) frenos.push(`${sinRegla} movimiento(s) quedarían sin regla: falta un tipo en REGLAS`)
if (frenos.length) { console.log("\n🛑 NO SE ESCRIBE NADA:"); for (const f of frenos) console.log("   " + f); process.exit(1) }
if (!ESCRIBIR) { console.log("\n(simulación: con --escribir escribe)"); process.exit(0) }

// ── Escribir ─────────────────────────────────────────────────────────────────────────────────────────────────
if (existsSync(FOTO)) { console.error(`🛑 ya existe ${FOTO}: el script ya corrió (deshacer primero)`); process.exit(1) }
writeFileSync(FOTO, JSON.stringify(planes.map(p => ({ id: p.id, antes: p.antes })), null, 2))
const { error: e1 } = await sb.from("config_parseo_extracto").insert(REGLAS.map((r, i) => ({
  cuenta_bancaria_id: "msa_santander", tipo_movimiento: r.tipo, grupo_de_conceptos: r.grupo, campo_destino: r.campo, tipo_regla: r.regla,
  numero_linea: r.linea ?? null, descripcion_campo: `${MARCA} ${r.que}`, orden: (i + 1) * 10, activo: true })))
if (e1) { console.error("❌ reglas de parseo:", e1.message); process.exit(1) }
const t = tpl![0]
const { error: e2 } = await sb.from("reglas_conciliacion").insert({ cuenta_bancaria_id: "msa_santander", orden: 0, tipo: "bancarios", columna_busqueda: "cuit",
  tipo_match: "exacto", texto_buscar: "30617786016", template_id: t.id, categ: t.categ, detalle: `${MARCA} Interbancaria Santander ↔ Galicia`,
  codigo_contable: t.codigo_contable, codigo_interno: t.codigo_interno, llena_template: true, activo: true })
if (e2) { console.error("❌ regla de conciliación:", e2.message); process.exit(1) }
let ok = 0
for (const p of planes) {
  const { error: e } = await tabla().update(p.despues).eq("id", p.id)
  if (e) { console.error(`❌ ${p.id}: ${e.message}`); process.exit(1) }
  ok++
}
// Control: lo que quedó es lo planeado
const { data: despues } = await tabla().select(`id, ${CAMPOS.join(", ")}, concepto`).in("id", planes.map(p => p.id))
const mal = planes.filter(p => { const d = (despues ?? []).find((x: any) => x.id === p.id) as any; return !d || Object.entries(p.despues).some(([k, v]) => String(d[k] ?? "") !== String(v)) })
console.log(mal.length ? `❌ ${mal.length} fila(s) no quedaron como se planeó` : `✅ ${ok} filas desglosadas, ${REGLAS.length} reglas de parseo y 1 de conciliación. Foto en ${FOTO}.`)
