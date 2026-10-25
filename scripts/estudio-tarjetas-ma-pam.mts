/**
 * 💳 Estudio de los resúmenes de tarjeta VISA de MA y PAM — SÓLO LECTURA.
 *
 * Lee los PDFs de `- Comunicacion JMS Claude - Archivos/Extractos/TJ VISA {MA,PAM}` con el MISMO lector
 * que usa el importador de la app (`lib/tarjetas/parseo-resumen-pdf.ts`), verifica el control de saldos
 * de cada resumen y marca cuáles ya están cargados en la base (por nº de resumen). No escribe nada.
 *
 *   npx tsx scripts/estudio-tarjetas-ma-pam.mts  → deja `estudio-tarjetas.json` en el scratchpad indicado
 *   (1er argumento) o en la carpeta actual.
 */
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { parsearResumen, calcularControl, normalizarTextoResumen } from "../lib/tarjetas/parseo-resumen-pdf"

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const BASE = "- Comunicacion JMS Claude - Archivos/Extractos"
const CUENTAS = [
  { empresa: "MA", carpeta: "TJ VISA MA", schema: "ma", tabla: "tarjeta_visa" },
  { empresa: "PAM", carpeta: "TJ VISA PAM", schema: "pam", tabla: "tarjeta_visa" },
]
const salida = process.argv[2] || "."

const { extractText, getDocumentProxy } = await import("unpdf")
const out: any[] = []
for (const c of CUENTAS) {
  const { data: cargados } = await sb.schema(c.schema).from(c.tabla).select("nro_resumen")
  const yaCargados = new Set((cargados || []).map((r: any) => r.nro_resumen).filter(Boolean))
  const archivos = fs.readdirSync(path.join(BASE, c.carpeta)).filter(f => f.toLowerCase().endsWith(".pdf")).sort()
  for (const archivo of archivos) {
    const data = new Uint8Array(fs.readFileSync(path.join(BASE, c.carpeta, archivo)))
    const pdf = await getDocumentProxy(data)
    const ext = await extractText(pdf, { mergePages: true })
    const texto = Array.isArray(ext.text) ? ext.text.join("\n") : (ext.text || "")
    const r = parsearResumen(normalizarTextoResumen(texto))
    const control = calcularControl(r)
    out.push({
      empresa: c.empresa, archivo, nro_resumen: r.nro_resumen, fecha_cierre: r.fecha_cierre,
      fecha_vencimiento: r.fecha_vencimiento, saldo_anterior_pesos: r.saldo_anterior_pesos,
      saldo_anterior_usd: r.saldo_anterior_usd, total_a_pagar_pesos: r.total_a_pagar_pesos,
      total_a_pagar_usd: r.total_a_pagar_usd, control, ya_cargado: r.nro_resumen ? yaCargados.has(r.nro_resumen) : false,
      movimientos: r.movimientos,
    })
    console.log(`${c.empresa} ${archivo.padEnd(24)} resumen ${r.nro_resumen} cierre ${r.fecha_cierre} · ${String(r.movimientos.length).padStart(3)} mov · control ${control.ok ? "OK" : `NO (dif $${control.diferencia_pesos} / USD ${control.diferencia_usd})`}${r.nro_resumen && yaCargados.has(r.nro_resumen) ? " · YA CARGADO" : ""}`)
  }
}
fs.writeFileSync(path.join(salida, "estudio-tarjetas.json"), JSON.stringify(out, null, 1))
