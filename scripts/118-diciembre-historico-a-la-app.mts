/**
 * 🧾 **Script 118 — A-DAT-95 § A, PASO 1: los 4 comprobantes de diciembre 2025 que están SÓLO en el histórico, a la app.**
 *
 * JMS 27/10: *«este es el resultado al que la app debe llegar, que fue lo que nosotros le presentamos al estudio»* y
 * *«sí, imputá esas 4 a 12/25 y veo cómo queda»* (OK dado en esta terminal). Con estos 4, el subdiario 12/2025 de la app
 * da su cuadro: neto 11.645.269,58 · exento 1.280.562,24 · otros 72.081,41 · IVA 2.469.549,82 · total 16.480.809,04.
 * Después (paso 2) las 8 no declaradas pasan a 10/2026 y se provisionan.
 *
 * Copia los importes del histórico (`msa.comprobantes_historico`, por id) a `msa.comprobantes_arca`, subdiario 12/2025,
 * «Imputado», estado «anterior» (pagados, como todo el histórico — decisión 29/09), origen «No Informada».
 * 🔖 Todos llevan la MARCA en `archivo_origen`: el deshacer (`118-…-deshacer.mts`) borra sólo filas con esa marca.
 *
 * Escribe SÓLO `msa.comprobantes_arca` (4 inserts). No toca el histórico. Frena si alguno ya existe.
 *
 *   npx tsx scripts/118-diciembre-historico-a-la-app.mts           # muestra lo que haría (no escribe)
 *   npx tsx scripts/118-diciembre-historico-a-la-app.mts --aplicar # inserta
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
export const MARCA = "[script 118] histórico dic-25 a la app (A-DAT-95)"
const aplicar = process.argv.includes("--aplicar")

/** Los 4 del histórico (ids de la foto ANTES 27/10 12:26) con su tipo de ARCA y su cuenta del plan. */
const ORIGEN = [
  { id: "12dfe19f-ac92-450d-addb-e4e4282f658e", tipo: 81, desc: "Tique Factura A", cuenta: "COMBUSTIBLES Y LUBRICANTES" },
  { id: "076ebeea-b186-4790-aeec-027c4c05cab0", tipo: 81, desc: "Tique Factura A", cuenta: "COMBUSTIBLES Y LUBRICANTES" },
  { id: "361015db-816c-4a57-ac68-6ccf0d0e1d21", tipo: 81, desc: "Tique Factura A", cuenta: "COMBUSTIBLES Y LUBRICANTES" },
  { id: "77771804-a348-4ca8-9e4a-0eb87e1380d2", tipo: 3, desc: "Nota de Crédito A", cuenta: "SEGUROS ESTRUCTURA" },
]
const n = (v: unknown) => Number(v) || 0
const r2 = (x: number) => Math.round(x * 100) / 100

const { data: hist, error: eH } = await sb.schema("msa").from("comprobantes_historico").select("*").in("id", ORIGEN.map(o => o.id))
if (eH) throw new Error(eH.message)
if ((hist ?? []).length !== 4) throw new Error(`Se esperaban 4 filas del histórico y llegaron ${(hist ?? []).length}`)

const filas = ORIGEN.map(o => {
  const h = (hist ?? []).find(x => x.id === o.id)!
  const neto = n(h.imp_neto_gravado), iva = n(h.iva)
  const fila = {
    fecha_emision: String(h.fecha).slice(0, 10), tipo_comprobante: o.tipo, tipo_comprobante_desc: o.desc,
    punto_venta: Number(h.punto_de_venta), numero_desde: Number(h.numero_desde), numero_hasta: Number(h.numero_desde),
    tipo_doc_emisor: 80, cuit: String(h.nro_doc_emisor), denominacion_emisor: String(h.denominacion_emisor),
    tipo_doc_receptor: 80, nro_doc_receptor: "30617786016",
    moneda: "$", tipo_cambio: 1,
    imp_neto_gravado: neto, imp_neto_no_gravado: n(h.imp_neto_no_gravado), imp_op_exentas: n(h.imp_op_exentas),
    otros_tributos: n(h.otros_tributos), iva, imp_total: n(h.imp_total),
    // Todos al 21 % (verificado: IVA = neto × 0,21 en los 4).
    neto_grav_iva_21: neto, iva_21: iva,
    "año_contable": 2025, mes_contable: 12, ddjj_iva: "Imputado", estado: "anterior",
    cuenta_contable: o.cuenta, nro_cuenta: h.nro_cuenta ?? null,
    origen_factura: "No Informada", archivo_origen: MARCA, fecha_importacion: new Date().toISOString(),
  }
  // 🛑 Integridad: las partes tienen que sumar el total, como en el histórico.
  const partes = r2(fila.imp_neto_gravado + fila.imp_neto_no_gravado + fila.imp_op_exentas + fila.otros_tributos + fila.iva)
  if (Math.abs(partes - fila.imp_total) > 0.05) throw new Error(`${fila.denominacion_emisor} ${fila.numero_desde}: las partes suman ${partes} y el total es ${fila.imp_total}`)
  if (Math.abs(r2(neto * 0.21) - iva) > 0.05) throw new Error(`${fila.denominacion_emisor} ${fila.numero_desde}: el IVA no es el 21 % del neto`)
  return fila
})

// 🛑 Ninguno puede existir ya (misma clave única: tipo + punto de venta + número + CUIT), ni la marca.
for (const f of filas) {
  const { data } = await sb.schema("msa").from("comprobantes_arca").select("id")
    .eq("tipo_comprobante", f.tipo_comprobante).eq("punto_venta", f.punto_venta).eq("numero_desde", f.numero_desde).eq("cuit", f.cuit)
  if ((data ?? []).length) throw new Error(`Ya existe ${f.denominacion_emisor} ${f.punto_venta}-${f.numero_desde}: no se carga nada`)
}
const { data: marcadas } = await sb.schema("msa").from("comprobantes_arca").select("id").eq("archivo_origen", MARCA)
if ((marcadas ?? []).length) throw new Error(`Ya hay ${marcadas!.length} filas con la marca del script 118: no se carga nada`)

const pesos = (x: number) => x.toLocaleString("es-AR", { minimumFractionDigits: 2 })
for (const f of filas) console.log(`   ${f.fecha_emision} · ${f.tipo_comprobante} ${f.punto_venta}-${f.numero_desde} · ${f.denominacion_emisor} · ${pesos(f.imp_total)} · ${f.cuenta_contable}`)
console.log(`   suman ${pesos(r2(filas.reduce((s, f) => s + f.imp_total, 0)))}`)
if (!aplicar) { console.log("   (sin --aplicar: no se escribió nada)"); process.exit(0) }

const { data: creadas, error: eI } = await sb.schema("msa").from("comprobantes_arca").insert(filas).select("id")
if (eI) throw new Error("No se insertó nada: " + eI.message)
console.log(`✅ insertadas ${creadas!.length} filas con la marca «${MARCA}»`)
