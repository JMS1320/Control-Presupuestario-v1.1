/**
 * 🧪 Lee boletas de ARBA con el lector de la app DENTRO DE UN NAVEGADOR (Chromium de Playwright). Sólo lectura.
 * Motivo (05/11, A-FEAT-1565): Node descomprime con tolerancia y Chrome no — las pruebas en Node daban verde y en la app
 * las 26 boletas de la cuota 4 salían mudas.   npx tsx scripts/probar-boletas-navegador.mts <pdf> [<pdf> …]
 */
import ts from "typescript"
import { chromium } from "playwright"
import { readFileSync } from "node:fs"
const js = ts.transpileModule(readFileSync("lib/arba/parsear-boleta.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
const code = "var P = {}; (function(exports){ " + js.replace(/^export /gm, "") + " ; exports.parsearBoletaArba = parsearBoletaArba })(P)"
const b = await chromium.launch()
const p = await b.newPage()
p.on("pageerror", e => console.log("PAGEERROR", e.message))
await p.addScriptTag({ content: code })
for (const f of process.argv.slice(2)) {
  const pdf = readFileSync(f).toString("base64")
  const out = await p.evaluate(async (b64) => {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k)
    // @ts-ignore
    const x = await P.parsearBoletaArba(u8.buffer)
    return { importe: x.importe, partida: x.partida, avisos: x.avisos, texto: x.texto.slice(0, 60) }
  }, pdf)
  console.log(JSON.stringify(out))
}
await b.close()
