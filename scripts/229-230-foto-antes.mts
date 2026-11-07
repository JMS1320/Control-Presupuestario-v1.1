/**
 * 📸 FOTO ANTES de correr los scripts 229 y 230 (A-FEAT-1577). SÓLO LEE. Guarda la fila COMPLETA de todo lo que van a tocar:
 * los 451 movimientos del 229, las 14 reglas, la cuota «Caja» de Penino, la extracción de Penino y los 4 pagos de Mabel.
 * Es el respaldo además del deshacer: si algo sale distinto, acá está cómo estaba cada fila.
 *
 *     npx tsx scripts/229-230-foto-antes.mts
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const desde = (tabla: string) => { const [s, t] = tabla.split("."); return s === "public" ? sb.from(t) : sb.schema(s).from(t) }

const porTabla = new Map<string, Set<string>>()
const agregar = (tabla: string, id: string) => porTabla.set(tabla, (porTabla.get(tabla) ?? new Set()).add(id))
for (const l of readFileSync("scripts/229-codigos-contable-nuevos.sql", "utf8").split("\n")) {
  const m = /^update (\S+) set contable = .* where id = '([0-9a-f-]+)'/.exec(l); if (m) agregar(m[1], m[2])
}
for (const l of readFileSync("scripts/230-reglas-penino-mabel.sql", "utf8").split("\n")) for (const id of l.match(/'[0-9a-f]{8}-[0-9a-f-]{27}'/g) ?? []) void id
agregar("public.reglas_contable_interno", "")
const reglas = ["2ab7af5d-7997-4cef-aa2f-19528f844d96", "864a22d5-1125-4c5a-b244-5e22b78b3d94", "290ee74d-e8ea-488a-aa2f-a8f99274813e", "01af622f-4a01-41bc-b130-c07981bdf826",
  "5432ae16-3692-447f-a65c-a9924fb746a6", "473c8bba-5523-4c11-9087-2b17f9c42d8d", "cdf87950-5520-425a-b925-67c070a42b2b", "c507672f-a6b3-4d7b-91a5-85700ab98c90",
  "77ad0114-cc17-4666-8e4c-4ad9c35066cd", "438b9c9c-d26d-4afa-9830-9691a14061a0", "4a50ca82-eb0d-4d5d-b410-f83406eda568", "d76dce97-29ee-4624-8677-596c025e598d",
  "e5409492-556c-417b-8159-06fa4deddb69", "979f2e94-a2b2-4091-ae0e-bc5a1b329ce5"]
porTabla.set("public.reglas_contable_interno", new Set(reglas))
agregar("public.cuotas_egresos_sin_factura", "ee8efdba-a308-4825-8003-9a41e59fca86")
agregar("public.msa_galicia", "19e5f9f2-db6e-4974-a7ed-09fb1787abf8")
for (const id of ["e58074a8-0280-44d7-ae11-e0414ca58c4b", "27b090fb-cb03-470c-9294-13188f4e5e6b"]) agregar("public.pam_galicia", id)
for (const id of ["edb144a1-f51b-41a8-a922-c837787e1346", "c3db32f4-4e2b-4526-b5b6-afc02f5408fe"]) agregar("public.pam_galicia_cc", id)

const foto: Record<string, unknown[]> = {}
let total = 0
for (const [tabla, ids] of porTabla) {
  const lista = [...ids].filter(Boolean); const filas: unknown[] = []
  for (let i = 0; i < lista.length; i += 100) {
    const { data, error } = await desde(tabla).select("*").in("id", lista.slice(i, i + 100))
    if (error) throw new Error(`${tabla}: ${error.message}`)
    filas.push(...(data ?? []))
  }
  if (filas.length !== lista.length) throw new Error(`${tabla}: esperaba ${lista.length} filas y leí ${filas.length} — no se guarda una foto incompleta`)
  foto[tabla] = filas; total += filas.length
}
writeFileSync("scripts/229-230-foto-antes.json", JSON.stringify({ tomada: new Date().toISOString(), filas: foto }, null, 1))
console.log(`📸 ${total} filas en ${Object.keys(foto).length} tablas → scripts/229-230-foto-antes.json`)
for (const [t, f] of Object.entries(foto)) console.log(`   ${t}: ${f.length}`)
