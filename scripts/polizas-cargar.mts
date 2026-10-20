/**
 * Carga inicial de las pólizas del subdiario en las tablas de `scripts/89` — A-FEAT-1309.
 * OK del usuario 2026-10-20 («sí, cargalas»).
 *
 *   npx tsx scripts/polizas-cargar.mts <carpeta-pdfs> <.env.local>            → en seco
 *   npx tsx scripts/polizas-cargar.mts <carpeta-pdfs> <.env.local> --aplicar  → escribe
 *
 * Escribe SÓLO en las tablas de pólizas (usa `guardarPoliza`, la misma función que la app). No toca
 * facturas, templates ni el extracto. Un endoso ya guardado no se pisa.
 *
 * El mismo endoso puede venir en dos PDF (la «detalles de la póliza», la copia del mes siguiente): se
 * guarda el que trae más partes. El vínculo a la factura se busca por importe y fecha (±60 días) en
 * `msa.comprobantes_arca`; las del histórico (jul–dic 25) no tienen id de factura de ARCA y quedan sin
 * vínculo, con el archivo y la carpeta de Drive anotados.
 */
import fs from "node:fs"
import path from "node:path"

const [dir, envPath] = process.argv.slice(2)
const aplicar = process.argv.includes("--aplicar")
const B = process.cwd().split("\\").join("/")
const { textoEnRenglones } = await import(`file:///${B}/lib/polizas/renglones-pdf.ts`)
const { parsearPoliza } = await import(`file:///${B}/lib/polizas/parsear-poliza.ts`)
const { guardarPoliza } = await import(`file:///${B}/lib/polizas/guardar-poliza.ts`)
const { createClient } = await import("@supabase/supabase-js")

const env = Object.fromEntries(fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: facturas, error } = await sb.schema("msa").from("comprobantes_arca")
  .select("id,fecha_emision,imp_total,numero_desde,punto_venta,pdf_drive_url").ilike("denominacion_emisor", "%patronal%")
if (error) throw error

// 1 · Leer y quedarse con el mejor PDF de cada endoso.
const mejores = new Map<string, { p: any; archivo: string; partes: number }>()
for (const f of fs.readdirSync(dir).filter(f => /\.pdf$/i.test(f)).sort()) {
  const p = parsearPoliza(await textoEnRenglones(new Uint8Array(fs.readFileSync(path.join(dir, f)))))
  if (!p.poliza) { console.log(`  ✗ ${f}: sin número de póliza`); continue }
  const clave = `${p.poliza}|${p.endoso}`
  const partes = Object.values(p.partes).filter(Boolean).length
  if (!mejores.has(clave) || partes > mejores.get(clave)!.partes) mejores.set(clave, { p, archivo: f, partes })
}

// 2 · Guardar.
const dias = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 864e5)
const usadas = new Set<string>()
for (const [clave, { p, archivo }] of [...mejores.entries()].sort()) {
  const fc = facturas!.find(c => !usadas.has(c.id) && Math.abs(Math.abs(Number(c.imp_total)) - Math.abs(p.total ?? 0)) <= 0.05 && p.fechaEmision && dias(c.fecha_emision, p.fechaEmision) <= 60)
  if (fc) usadas.add(fc.id)
  const partes = archivo.split("~")
  const extras = {
    comprobante_arca_id: fc?.id ?? null, comprobante_schema: fc ? "msa" : null, pdf_drive_url: fc?.pdf_drive_url ?? null,
    archivo: partes.join("/"), procesado_por: "carga inicial 2026-10-20 (Claude, OK del usuario)",
  }
  const txt = `${clave.padEnd(14)} ${String(p.seccion).padEnd(22)} total ${String(p.total).padStart(12)} · ${p.cuotasEndoso.length} cuotas · ${p.vehiculos.length + p.personas.length} bienes · factura ${fc ? fc.id.slice(0, 8) : "— (histórico)"}`
  if (!aplicar) { console.log("  (en seco) " + txt); continue }
  const r = await guardarPoliza(sb as any, p, extras)
  console.log(`  ${r.estado === "guardado" ? "✓" : r.estado === "ya-estaba" ? "=" : "✗"} ${txt} → ${r.estado}${"motivo" in r ? ": " + r.motivo : ""}`)
}
console.log(aplicar ? "\nListo." : "\nEn seco: no se escribió nada. Agregá --aplicar para guardar.")
