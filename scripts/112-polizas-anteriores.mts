// Carga de las 2 pólizas anteriores (32436252 endoso 4 y 9536537 endoso 0) — OK de JMS 27/10.
//   npx tsx polizas-anteriores.mts <repo> <carpeta-pdfs> simular   → sincronización completa en simulación (no escribe)
//   npx tsx polizas-anteriores.mts <repo> <carpeta-pdfs> aplicar   → guarda las 2 y sincroniza SÓLO esas 2
import fs from "node:fs"
import path from "node:path"
const B = process.argv[2].replace(/\\/g, "/")
const DIR = process.argv[3]
const modo = process.argv[4]
const env = Object.fromEntries(fs.readFileSync(`${B}/.env.local`, "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const { createRequire } = await import("node:module")
const { createClient } = createRequire(`${B}/package.json`)("@supabase/supabase-js")
const { textoEnRenglones } = await import(`file:///${B}/lib/polizas/renglones-pdf.ts`)
const { parsearPoliza } = await import(`file:///${B}/lib/polizas/parsear-poliza.ts`)
const { guardarPoliza } = await import(`file:///${B}/lib/polizas/guardar-poliza.ts`)
const { sincronizarPolizas } = await import(`file:///${B}/lib/polizas/sincronizar.ts`)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

if (modo === "simular") {
  const s = await sincronizarPolizas(sb, { simular: true })
  console.log(`SIMULACIÓN (todas las pólizas cargadas hoy): ${s.polizas} pólizas · templates nuevos ${s.templatesCreados.join(",") || "ninguno"} · crear ${s.cuotasCreadas} · corregir ${s.cuotasActualizadas} · desactivar ${s.cuotasDesactivadas} · pdfs ${s.pdfsVinculados}`)
  s.avisos.forEach((a: string) => console.log("  ⚠️ " + a))
  process.exit(0)
}
if (modo !== "aplicar") throw new Error("modo: simular | aplicar")

for (const f of fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)).sort()) {
  const p = parsearPoliza(await textoEnRenglones(new Uint8Array(fs.readFileSync(path.join(DIR, f)))))
  if (!["32436252", "9536537"].includes(String(p.poliza))) { console.log(`  ✗ ${f}: póliza ${p.poliza} no es de esta carga — se saltea`); continue }
  const extras = {
    comprobante_arca_id: null, comprobante_schema: null, pdf_drive_url: null,
    archivo: `2024-2025/Seguros/En sistema afip/${f}`,
    procesado_por: "[script 112] póliza anterior 24/25 cargada por Claude 2026-10-27 (OK de JMS)",
  }
  const r = await guardarPoliza(sb, p, extras)
  console.log(`  ${r.estado === "guardado" ? "✓" : r.estado === "ya-estaba" ? "=" : "✗"} ${p.poliza} endoso ${p.endoso} · ${p.cuotasEndoso.length} cuotas → ${r.estado}${"motivo" in r ? ": " + r.motivo : ""}`)
}
const s = await sincronizarPolizas(sb, { soloPolizas: ["32436252", "9536537"] })
console.log(`Sincronización (sólo 32436252 y 9536537): templates nuevos ${s.templatesCreados.join(",") || "ninguno"} · cuotas creadas ${s.cuotasCreadas} · corregidas ${s.cuotasActualizadas} · desactivadas ${s.cuotasDesactivadas}`)
s.avisos.forEach((a: string) => console.log("  ⚠️ " + a))
