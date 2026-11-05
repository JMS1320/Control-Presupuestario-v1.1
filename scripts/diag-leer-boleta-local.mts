/**
 * 🔎 Diagnóstico de sólo lectura (A-FEAT-1565, 05/11): pasa PDFs locales (el Drive sincronizado) por el mismo lector de la
 * app. No escribe nada.   npx tsx scripts/diag-leer-boleta-local.mts <ruta.pdf> [<ruta.pdf> …]
 */
import { readFileSync } from "node:fs"
import { parsearBoletaArba } from "../lib/arba/parsear-boleta"
for (const p of process.argv.slice(2)) {
  const buf = readFileSync(p)
  console.log(`\n== ${p.split(/[\\/]/).pop()} · ${buf.length} bytes · inicio: ${JSON.stringify(buf.subarray(0, 40).toString("latin1"))}`)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  try {
    const b = await parsearBoletaArba(ab as ArrayBuffer)
    console.log("leído:", JSON.stringify({ partida: b.partida, cuota: b.cuota, anio: b.anio, impuesto: b.impuesto, importe: b.importe, venc: b.vencimiento, avisos: b.avisos, texto: b.texto.slice(0, 200) }))
  } catch (e) { console.log("ERROR:", (e as Error).message) }
}
