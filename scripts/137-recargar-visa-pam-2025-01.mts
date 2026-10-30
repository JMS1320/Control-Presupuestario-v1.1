/**
 * 🔁 Script 137 — A-FEAT-1424: RECARGA el resumen VISA PAM de enero 2025 (VI00000000038474573) con el lector actual.
 * OK de JMS 30/10 (terminal GAS): «lo de pam enero 2025 sí».
 *
 *     npx tsx scripts/137-recargar-visa-pam-2025-01.mts              ← simula
 *     npx tsx scripts/137-recargar-visa-pam-2025-01.mts --escribir   ← reemplaza
 *
 * Por qué: lo cargado venía de un lector viejo — 53 movimientos contra 54 de hoy, el «SU PAGO» como movimiento
 * común (pesos y dólares en una sola fila) y sin la fila del total del resumen. Ninguna fila estaba trabajada.
 *
 * Qué hace: 1) FRENA si alguna de las filas viejas ya se trabajó (estado, cuenta, template, cuota, factura…).
 * 2) Guarda la FOTO de las filas viejas, enteras, en la carpeta de comunicación (`Extractos/137 foto antes - VISA PAM 25-01.json`, FUERA de git: tiene consumos reales y el repo es público). 3) Las borra por id e inserta las
 * del lector actual (`filasDeResumen`, el mismo que el importador), con `orden` desde -1 para que queden antes que
 * el resumen de febrero (las viejas iban de 1 a 53). 4) Controla que lo cargado sea lo que dice el PDF.
 * Deshacer: `137-…-deshacer.mts` borra las nuevas (por id) y vuelve a poner la foto tal cual, con sus ids.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { parsearResumen, calcularControl, normalizarTextoResumen, filasDeResumen } from "../lib/tarjetas/parseo-resumen-pdf"

const ESCRIBIR = process.argv.includes("--escribir")
const NRO = "VI00000000038474573"
const PDF = join("../Control-Presupuestario-v1.1", "- Comunicacion JMS Claude - Archivos", "Extractos", "Galicia Eminent PAM", "TJ VISA PAM", "VISA PAM - 25-01.pdf")
const FOTO = "../Control-Presupuestario-v1.1/- Comunicacion JMS Claude - Archivos/Extractos/137 foto antes - VISA PAM 25-01.json"
const IDS = "scripts/137-recargar-visa-pam-2025-01-ids.json"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const tabla = () => sb.schema("pam").from("tarjeta_visa")
const r2 = (n: number) => Math.round(n * 100) / 100
const suma = (xs: any[], k: string) => r2(xs.reduce((a, f) => a + Number(f[k] ?? 0), 0))

// 1) Lo viejo
const { data: viejas, error } = await tabla().select("*").eq("nro_resumen", NRO).order("orden")
if (error) throw error
const VINCULOS = ["categ", "nro_cuenta", "template_id", "template_cuota_id", "comprobante_arca_id", "anticipo_id", "sueldo_pago_id"]
const trabajadas = (viejas ?? []).filter(f => VINCULOS.some(k => f[k] !== null && f[k] !== "") || !["pendiente", "total"].includes(f.estado))
if (trabajadas.length) { console.log(`🛑 ${trabajadas.length} fila(s) ya trabajadas: no se toca nada.`); process.exit(1) }

// 2) Lo nuevo, con el lector de hoy
const { extractText, getDocumentProxy } = await import("unpdf")
const ex = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(PDF))), { mergePages: true })
const r = parsearResumen(normalizarTextoResumen(Array.isArray(ex.text) ? ex.text.join("\n") : (ex.text || "")))
const c = calcularControl(r)
if (r.nro_resumen !== NRO || !c.ok) { console.log(`🛑 El PDF no es ${NRO} o no cierra contra sí mismo (leído ${r.nro_resumen}).`); process.exit(1) }
const nuevas = filasDeResumen(r, "tarjeta_visa", -1)

console.log(`Viejas: ${viejas!.length} filas · débitos ${suma(viejas!, "debitos")} · créditos ${suma(viejas!, "creditos")} · tipos ${[...new Set(viejas!.map(f => f.tipo_fila))].join("/")}`)
console.log(`Nuevas: ${nuevas.length} filas (${r.movimientos.length} movs + total) · débitos ${suma(nuevas.filter(f => f.tipo_fila !== "resumen"), "debitos")} · créditos ${suma(nuevas.filter(f => f.tipo_fila !== "resumen"), "creditos")} · pagos ${nuevas.filter(f => f.tipo_fila === "pago").length}`)
if (!ESCRIBIR) { console.log("(simulación: con --escribir reemplaza)"); process.exit(0) }

// 3) Foto, borrar por id, insertar
writeFileSync(FOTO, JSON.stringify(viejas, null, 2))
const { error: eDel } = await tabla().delete().in("id", viejas!.map(f => f.id))
if (eDel) { console.error(`❌ ${eDel.message} (la foto quedó en ${FOTO})`); process.exit(1) }
const { data: ins, error: eIns } = await tabla().insert(nuevas).select("id, debitos, creditos")
if (eIns) { console.error(`❌ ${eIns.message} — las viejas YA se borraron: correr el deshacer para volver a ponerlas`); writeFileSync(IDS, "[]"); process.exit(1) }
writeFileSync(IDS, JSON.stringify(ins!.map(f => f.id), null, 2))

// 4) Control
const ok = ins!.length === nuevas.length && suma(ins!, "debitos") === suma(nuevas, "debitos") && suma(ins!, "creditos") === suma(nuevas, "creditos")
console.log(ok ? `✅ Reemplazado: ${ins!.length} filas, control OK.` : "❌ Lo cargado no coincide con lo leído: revisar.")
