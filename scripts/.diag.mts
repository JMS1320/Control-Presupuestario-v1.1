import fs from "node:fs"
const B = process.cwd().split("\\").join("/")
const { parsearRomaneo } = await import(`file:///${B}/lib/ganaderia/parsear-romaneo.ts`)
const buf = fs.readFileSync(`${B}/- Comunicacion JMS Claude - Archivos/- Romaneo.pdf`)
const rom = await parsearRomaneo(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
console.log("── páginas 1 y 2 crudas (los encabezados del papel) ──")
for (const l of rom.crudo) if (/^p[12] /.test(l)) console.log("  " + l)
