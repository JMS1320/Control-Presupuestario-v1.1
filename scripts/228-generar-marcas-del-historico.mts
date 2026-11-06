// Genera scripts/228-…sql: pasa contable/interno de la NOTA del histórico («tu planilla: … Contable X · Interno Y») a las columnas, sólo donde la columna está vacía.
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "node:fs"
const RAIZ = "D:/Users/josem/Documents/Jose/Automatizarr/Claude/Control-Presupuestario-v1.1"
const env = Object.fromEntries(readFileSync(`${RAIZ}/.env.local`, "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const T: [string, string][] = [["public","msa_galicia"],["public","pam_galicia"],["public","pam_galicia_cc"],["ma","ma_galicia"],["msa","tarjeta_visa_business"],["pam","tarjeta_visa"],["ma","tarjeta_visa"],["msa","caja_general"],["msa","caja_ams"],["msa","caja_sigot"],["msa","echeqs_terceros"],["msa","cc_usd"],["msa","caja_usd"],["ma","ca_usd"],["ma","caja_usd"],["public","cotitulares_ca_usd"],["public","cotitulares_ca_pesos"],["public","cotitulares_caja_usd"],["msa","santander"],["msa","provincia"],["ma","anses_ca_pesos"]]
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const esc = (s: string) => s.replace(/'/g, "''")
const up: string[] = [], down: string[] = []; let n = 0, nc = 0, ni = 0; const resumen: string[] = []
for (const [schema, tabla] of T) {
  let movs: any[] = []
  try { movs = await todo((d, h) => (schema === "public" ? sb.from(tabla) : sb.schema(schema).from(tabla)).select("*").order("id").range(d, h)) } catch (e: any) { resumen.push(`${schema}.${tabla}: ${e.message}`); continue }
  if (!movs.length || !("contable" in movs[0]) || !("interno" in movs[0])) { resumen.push(`${schema}.${tabla}: sin columnas contable/interno o vacía`); continue }
  let k = 0
  for (const m of movs) {
    const nTxt = String(m.nota_operador ?? ""); if (!/tu planilla/i.test(nTxt)) continue
    const deNota = (x: string) => new RegExp(`${x}\\s+([^·]+)`, "i").exec(nTxt)?.[1]?.trim() ?? ""
    const c = deNota("Contable"), i = deNota("Interno")
    const setC = c && !String(m.contable ?? "").trim(), setI = i && !String(m.interno ?? "").trim()
    if (!setC && !setI) continue
    const sets = [setC ? `contable = '${esc(c)}'` : "", setI ? `interno = '${esc(i)}'` : ""].filter(Boolean).join(", ")
    const cond = [setC ? "coalesce(trim(contable),'') = ''" : "", setI ? "coalesce(trim(interno),'') = ''" : ""].filter(Boolean).join(" and ")
    up.push(`update ${schema}.${tabla} set ${sets} where id = '${m.id}' and ${cond};`)
    const undo = [setC ? `contable = null` : "", setI ? `interno = null` : ""].filter(Boolean).join(", ")
    const ucond = [setC ? `contable = '${esc(c)}'` : "", setI ? `interno = '${esc(i)}'` : ""].filter(Boolean).join(" and ")
    down.push(`update ${schema}.${tabla} set ${undo} where id = '${m.id}' and ${ucond};`)
    n++; k++; if (setC) nc++; if (setI) ni++
  }
  if (k) resumen.push(`${schema}.${tabla}: ${k}`)
}
const head = `-- 228 · CONTABLE / INTERNO DEL HISTÓRICO: de la NOTA a las COLUMNAS (DATOS) — pedido JMS 06/11: «los movimientos que tenían esa información
-- en las notas del histórico, tendrías que reestructurarlo para que diga lo que decía en contable e interno».
-- El histórico jul-25 → ene-26 se cargó con su contable/interno sólo en la nota («📜 Histórico… tu planilla: … Contable X · Interno Y»).
-- Este script copia ese valor a la columna, SÓLO donde la columna está vacía. La nota NO se toca (queda como estaba).
-- ${n} movimientos (${nc} contable, ${ni} interno) — ${resumen.join(" · ")}
-- Deshacer: 228-…-deshacer.sql (vuelve a vacío sólo donde quedó el valor que puso este script).
`
writeFileSync(`${RAIZ}/scripts/228-marcas-del-historico-a-columnas.sql`, head + "begin;\n" + up.join("\n") + "\ncommit;\n")
writeFileSync(`${RAIZ}/scripts/228-marcas-del-historico-a-columnas-deshacer.sql`, `-- Deshace 228 · vuelve a vacío contable/interno sólo donde tiene el valor que copió el 228.\nbegin;\n${down.join("\n")}\ncommit;\n`)
console.log(n, nc, ni, resumen.join(" · "))
