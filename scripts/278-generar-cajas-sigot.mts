/**
 * Genera el script 278 (sin correrlo): los 79 movimientos de la Caja Sigot ya cargados (05/02–19/05/26) quedan como los que va a
 * cargar el importador nuevo — el texto de AMS a Detalle, la Descripción pareja de la app, el orden = fila del Excel y la nota con
 * su Cat/Comp. JMS 15/11: «R1 ok y podés cambiar los datos previos en caja Sigot». Sólo lee; escribe los .sql y la foto de antes.
 *     npx tsx scripts/278-generar-cajas-sigot.mts
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
import XLSX from "xlsx-js-style"
import { analizarCaja, descripcionDeCaja, detalleDeCaja, leerHojaCaja, notaDeCaja } from "../lib/extractos/caja-excel"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const wb = XLSX.read(readFileSync("- Comunicacion JMS Claude - Archivos/Extractos/- CAJA 25-26.xlsx"), { type: "buffer", cellDates: false })
const hoja = leerHojaCaja(XLSX.utils.sheet_to_json(wb.Sheets["Caja Sigot"], { header: 1, raw: true, defval: null }))
const { data: ex } = await sb.schema("msa").from("caja_sigot").select("id, fecha, descripcion, detalle, debitos, creditos, orden, nota_operador, estado")
const a = analizarCaja("caja_sigot", hoja.filas, ex, { desde: "2025-06-30" })
const pares = a.filas.filter(f => f.yaEsta).map(f => ({ f, e: ex.find((x: any) => x.id === f.existenteId) }))
if (pares.length !== ex.length) throw new Error(`reconocí ${pares.length} de ${ex.length}: no genero nada`)
const q = (v: unknown) => v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`
const MARCA = "[script 278]"
let up = "", des = ""
for (const { f, e } of pares) {
  const nota = [e.nota_operador, notaDeCaja("caja_sigot", f), MARCA].filter(Boolean).join(" · ")
  up += `update msa.caja_sigot set descripcion = ${q(descripcionDeCaja(f))}, detalle = ${q(detalleDeCaja(f))}, orden = ${f.fila}, nota_operador = ${q(nota)} where id = '${e.id}' and descripcion is not distinct from ${q(e.descripcion)} and detalle is not distinct from ${q(e.detalle)};\n`
  des += `update msa.caja_sigot set descripcion = ${q(e.descripcion)}, detalle = ${q(e.detalle)}, orden = ${e.orden ?? "null"}, nota_operador = ${q(e.nota_operador)} where id = '${e.id}' and nota_operador like '%${MARCA}%';\n`
}
const cab = (t: string) => `-- 278 · A-FEAT-1585 (JMS 15/11: «R1 ok y podés cambiar los datos previos en caja Sigot»). ${t}\n-- Los ${pares.length} movimientos de la Caja Sigot ya cargados (05/02–19/05/26) quedan igual que los que carga el importador nuevo: el texto de AMS\n-- a Detalle, la Descripción pareja de la app, el orden = fila del Excel de AMS («- CAJA 25-26.xlsx», hoja «Caja Sigot») y la nota con su Cat/Comp.\n-- No cambia importes, fechas, estado ni conciliación. Foto de antes: 278-foto-antes.json · generado por 278-generar-cajas-sigot.mts\n`
writeFileSync("scripts/278-cajas-sigot-detalle.sql", cab("") + `begin;\n${up}do $$ begin if (select count(*) from msa.caja_sigot where nota_operador like '%${MARCA}%') <> ${pares.length} then raise exception '278: no quedaron los ${pares.length}'; end if; end $$;\ncommit;\n`)
writeFileSync("scripts/278-cajas-sigot-detalle-deshacer.sql", cab("DESHACER: vuelve cada uno, por id, a su valor de antes.") + `begin;\n${des}commit;\n`)
writeFileSync("scripts/278-foto-antes.json", JSON.stringify(ex, null, 1))
console.log("generado:", pares.length, "· ejemplo:", descripcionDeCaja(pares[0].f), "|", detalleDeCaja(pares[0].f), "| orden", pares[0].f.fila)

// Con «--aplicar» hace los mismos cambios del .sql (por id, y sólo si el texto sigue siendo el de antes) y verifica los 79.
if (process.argv.includes("--aplicar")) {
  let n = 0
  for (const { f, e } of pares) {
    let qb = sb.schema("msa").from("caja_sigot").update({ descripcion: descripcionDeCaja(f), detalle: detalleDeCaja(f), orden: f.fila,
      nota_operador: [e.nota_operador, notaDeCaja("caja_sigot", f), MARCA].filter(Boolean).join(" · ") }).eq("id", e.id)
    qb = e.descripcion == null ? qb.is("descripcion", null) : qb.eq("descripcion", e.descripcion)
    qb = e.detalle == null ? qb.is("detalle", null) : qb.eq("detalle", e.detalle)
    const { data, error } = await qb.select("id")
    if (error) throw new Error(`${e.id}: ${error.message}`)
    n += data.length
  }
  const { count } = await sb.schema("msa").from("caja_sigot").select("id", { count: "exact", head: true }).like("nota_operador", `%${MARCA}%`)
  console.log(`aplicado: ${n} · con la marca en la base: ${count}`)
}
