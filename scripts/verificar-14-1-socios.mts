/**
 * 🔎 Control del papel 14.1 con los datos reales (A-FEAT-1577). SÓLO LEE. Arma lo que la pantalla del balance le pasa a la 14.1 para MA y PAM
 * —Galicia MSA con código CTA, las cuentas de los socios— y muestra: cuántas transferencias tienen su otra punta, cuáles faltan, y lo que
 * el socio pagó por MSA desde sus cuentas (lo que la 14.1 ahora suma).
 *
 *     npx tsx scripts/verificar-14-1-socios.mts
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { movimientosDeLosSocios, armarCuentasCorrientes, type CuentaDelSocio, type MovimientoParaCC } from "../lib/balance/cuentas-corrientes"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const D = "2025-07-01", H = "2026-06-30"
async function todo(q: (d: number, h: number) => any): Promise<any[]> { const out: any[] = []; for (let d = 0; ; d += 1000) { const { data, error } = await q(d, d + 999); if (error) throw new Error(error.message); out.push(...(data ?? [])); if (!data || data.length < 1000) break } return out }
const desde = (s: string, t: string) => (s === "public" ? sb.from(t) : sb.schema(s).from(t))

const msa: MovimientoParaCC[] = (await todo((d, h) => sb.from("msa_galicia").select("id, fecha, debitos, creditos, descripcion, contable, cuit:leyendas_adicionales_2").gte("fecha", D).lte("fecha", H).not("contable", "is", null).order("id").range(d, h)))
  .map((m: any) => ({ ...m, cuenta: "MSA Galicia cta cte" }))
const CUENTAS = [["MA", "MA caja de ahorro", "ma", "ma_galicia", false], ["MA", "MA VISA", "ma", "tarjeta_visa", true], ["PAM", "PAM caja de ahorro", "public", "pam_galicia", false],
  ["PAM", "PAM cta cte", "public", "pam_galicia_cc", false], ["PAM", "PAM VISA", "pam", "tarjeta_visa", true]] as const
const socios: CuentaDelSocio[] = []
for (const [clave, nombre, s, t, tj] of CUENTAS) {
  const filas = await todo((d, h) => { let q = desde(s, t).select("id, fecha, debitos, creditos, descripcion, contable").gte("fecha", D).lte("fecha", H); if (tj) q = q.eq("tipo_fila", "movimiento"); return q.order("id").range(d, h) })
  socios.push({ clave, nombre, movimientos: filas })
}
const r = movimientosDeLosSocios(msa, socios)
for (const clave of ["MA", "PAM"]) {
  const deMSA = r.msa.filter(m => String(m.contable).toUpperCase() === `CTA ${clave}`)
  const ok = deMSA.filter(m => m.otraPunta?.startsWith("✅")).length, falta = deMSA.filter(m => m.otraPunta?.startsWith("🔴"))
  const del = r.delSocio.filter(m => socios.find(x => x.nombre === m.cuenta)?.clave === clave)
  console.log(`${clave}: CTA ${clave} en Galicia MSA ${deMSA.length} · con su otra punta ${ok} · falta ${falta.length} · lo que ${clave} pagó por MSA desde sus cuentas ${del.length} = $ ${del.reduce((t, m) => t + Number(m.debitos ?? 0) - Number(m.creditos ?? 0), 0).toFixed(2)}`)
  for (const m of falta) console.log(`   🔴 ${m.fecha} ${m.debitos || -Number(m.creditos)} ${m.descripcion}`)
}
const papel = armarCuentasCorrientes([], [], [...r.msa, ...r.delSocio])
for (const c of papel.cuentas.filter(c => ["MA", "PAM"].includes(c.contraparte.clave))) console.log(`movimiento del ejercicio ${c.contraparte.clave}: ${c.resumen.saldo.toFixed(2)} (sin facturas ni sueldo ni la tarjeta de MSA)`)
