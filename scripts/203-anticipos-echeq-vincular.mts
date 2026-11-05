/**
 * 🔗 **Script 203 — vincular los anticipos pagados con ECHEQ a sus facturas (el Cash Flow los contaba dos veces).**
 *
 * A-BUG-1553 · auditado 05/11 · JMS 05/11 (página de decisiones): *«ahora que vos arregles lo desarreglado, y las mejoras
 * para el futuro»*.
 *
 * ① **Briki ($ 14.000.000) y De Francesco ($ 3.577.815,36)**: anticipo pagado con echeq el 14/10, factura del mismo día por
 *    el mismo importe, nunca vinculados → el Cash Flow mostraba la factura «pendiente» Y los echeqs del anticipo.
 *    Hace lo MISMO que el botón «Vincular» (`hooks/useVinculacionAnticipo.ts`, caso A: el anticipo cubre la factura) — la
 *    factura hereda la retención SICORE, el detalle, el saldo neto (`monto_a_abonar` = anticipo − SICORE) y la fecha del pago;
 *    el anticipo pasa a `vinculado`; `sicore_retenciones` se ata a la factura — **más la mejora** que el botón no hacía con un
 *    echeq: la factura queda en **`echeq`** (con `metodo_pago` y `fecha_cobro_echeq` del anticipo) y los cheques se atan
 *    también a la factura (`msa.cheques.factura_id`), así el Cash Flow la sigue proyectando echeq por echeq, UNA vez.
 * ② **Iglesias ($ 2.454.000) y Arroyo Tala ($ 1.461.558,28)**: tienen `factura_id` y la factura está conciliada, pero el
 *    anticipo quedó `parcial` → el Cash Flow lo seguía proyectando. Pasan a `vinculado` (nada más).
 *
 * No toca el extracto: los débitos de los echeqs se concilian como siempre (el echeq se marca cobrado solo, A-AUTO-10).
 *
 *   npx tsx scripts/203-anticipos-echeq-vincular.mts             # muestra, no escribe
 *   npx tsx scripts/203-anticipos-echeq-vincular.mts --aplicar   # escribe (sólo si cada fila sigue igual a la FOTO)
 *   npx tsx scripts/203-anticipos-echeq-vincular.mts --deshacer  # vuelve cada fila a la FOTO (sólo si sigue como la dejó el 203)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const aplicar = process.argv.includes("--aplicar"), deshacer = process.argv.includes("--deshacer")

type Cambio = { schema: string; tabla: string; id: string; antes: Record<string, unknown>; despues: Record<string, unknown> }

// La FOTO del 05/11 (leída de la base antes de escribir esto) y lo que queda después.
const BRIKI = { ant: "b6f3e5aa-7a5e-4a72-b462-35f82fea1343", fac: "07c378e3-0c15-4317-ab23-ece94a01da90", sic: "65350941-de7f-4291-a878-9a36617e55df" }
const DEFRA = { ant: "7dcfc3d2-3399-402a-b526-bdc6bd902909", fac: "d009c6a9-6d0d-4683-bd48-8a31c2435f7a", sic: "72e2b46b-5343-4f17-b879-4b68e21e7c15" }
const CAMBIOS: Cambio[] = [
  // ① Briki
  { schema: "msa", tabla: "comprobantes_arca", id: BRIKI.fac,
    antes: { estado: "pendiente", monto_a_abonar: 14000000, sicore: null, monto_sicore: null, tipo_sicore: null, detalle: null, metodo_pago: "transferencia", fecha_cobro_echeq: null },
    despues: { estado: "echeq", monto_a_abonar: 13773075.04, sicore: "26-10 - 1ra", monto_sicore: 226924.96, tipo_sicore: "Bienes", detalle: "4 Perfiles x 16 metros soldados", metodo_pago: "echeq", fecha_cobro_echeq: "2026-12-13", fecha_vencimiento: "2026-10-14", fecha_estimada: "2026-10-14" } },
  { schema: "public", tabla: "anticipos_proveedores", id: BRIKI.ant,
    antes: { estado: "pendiente_vincular", factura_id: null }, despues: { estado: "vinculado", factura_id: BRIKI.fac } },
  { schema: "msa", tabla: "sicore_retenciones", id: BRIKI.sic, antes: { factura_id: null }, despues: { factura_id: BRIKI.fac } },
  // ① De Francesco
  { schema: "msa", tabla: "comprobantes_arca", id: DEFRA.fac,
    antes: { estado: "pendiente", monto_a_abonar: 3577815.36, sicore: null, monto_sicore: null, tipo_sicore: null, detalle: null, metodo_pago: "transferencia", fecha_cobro_echeq: null },
    despues: { estado: "echeq", monto_a_abonar: 3525504.64, sicore: "26-10 - 1ra", monto_sicore: 52310.72, tipo_sicore: "Bienes", detalle: "2 Alcantarillas de Chapa de 8 metros x 60cm", metodo_pago: "echeq", fecha_cobro_echeq: "2026-11-13", fecha_vencimiento: "2026-10-14", fecha_estimada: "2026-10-14" } },
  { schema: "public", tabla: "anticipos_proveedores", id: DEFRA.ant,
    antes: { estado: "pendiente_vincular", factura_id: null }, despues: { estado: "vinculado", factura_id: DEFRA.fac } },
  { schema: "msa", tabla: "sicore_retenciones", id: DEFRA.sic, antes: { factura_id: null }, despues: { factura_id: DEFRA.fac } },
  // ② Los dos «parcial» viejos
  { schema: "public", tabla: "anticipos_proveedores", id: "12cef0e4-92df-4a82-b527-fcb3f0de9617", antes: { estado: "parcial" }, despues: { estado: "vinculado" } },
  { schema: "public", tabla: "anticipos_proveedores", id: "a6a44632-8cef-4c70-b118-a3f8227d811d", antes: { estado: "parcial" }, despues: { estado: "vinculado" } },
]
// Los echeqs de los dos anticipos se atan también a la factura (se buscan por anticipo_id; antes: factura_id vacío).
const CHEQUES = [{ ant: BRIKI.ant, fac: BRIKI.fac, cantidad: 3 }, { ant: DEFRA.ant, fac: DEFRA.fac, cantidad: 2 }]
// La fecha de vencimiento/estimada de las facturas también se restaura al deshacer: se lee y se guarda en la FOTO al aplicar.
const FECHAS_ANTES: Record<string, { fecha_vencimiento: string | null; fecha_estimada: string | null }> = {
  [BRIKI.fac]: { fecha_vencimiento: null, fecha_estimada: "2026-10-29" },
  [DEFRA.fac]: { fecha_vencimiento: null, fecha_estimada: "2026-10-29" },
}

const cliente = (schema: string) => schema === "public" ? sb : sb.schema(schema)
const igual = (a: unknown, b: unknown) => (a == null && b == null) || (typeof b === "number" ? Math.abs(Number(a) - b) < 0.005 : String(a) === String(b))

async function leer(c: Cambio) {
  const campos = Object.keys({ ...c.antes, ...c.despues })
  const { data, error } = await cliente(c.schema).from(c.tabla).select(["id", ...campos].join(", ")).eq("id", c.id).single()
  if (error || !data) throw new Error(`${c.tabla} ${c.id}: no se pudo leer (${error?.message})`)
  return data as Record<string, unknown>
}

// 1) Verificar TODO antes de escribir nada
for (const c of CAMBIOS) {
  const fila = await leer(c)
  const esperado = deshacer ? c.despues : { ...c.antes, ...(c.tabla === "comprobantes_arca" ? FECHAS_ANTES[c.id] : {}) }
  const distintos = Object.entries(esperado).filter(([k, v]) => !igual(fila[k], v))
  if (distintos.length) throw new Error(`${c.tabla} ${c.id.slice(0, 8)} no está como se espera (${distintos.map(([k]) => `${k}=${fila[k]}`).join(", ")}): no se toca NADA.`)
  console.log(`✓ ${c.tabla} ${c.id.slice(0, 8)}: ${Object.entries(deshacer ? { ...c.antes } : c.despues).map(([k, v]) => `${k} → ${v}`).join(" · ")}`)
}
for (const ch of CHEQUES) {
  const { data, error } = await sb.schema("msa").from("cheques").select("id, factura_id").eq("anticipo_id", ch.ant)
  if (error) throw new Error(error.message)
  const esperado = deshacer ? ch.fac : null
  if ((data ?? []).length !== ch.cantidad || (data ?? []).some(x => (x.factura_id ?? null) !== esperado))
    throw new Error(`Cheques del anticipo ${ch.ant.slice(0, 8)}: no están como se espera: no se toca NADA.`)
  console.log(`✓ ${ch.cantidad} echeqs del anticipo ${ch.ant.slice(0, 8)}: factura_id → ${deshacer ? "vacío" : ch.fac.slice(0, 8)}`)
}
if (!aplicar && !deshacer) { console.log("(simulación — para escribir: --aplicar)"); process.exit(0) }

// 2) Escribir
for (const c of CAMBIOS) {
  const valores = deshacer ? { ...c.antes, ...(c.tabla === "comprobantes_arca" ? FECHAS_ANTES[c.id] : {}) } : c.despues
  const { error } = await cliente(c.schema).from(c.tabla).update(valores).eq("id", c.id)
  if (error) throw new Error(`${c.tabla} ${c.id}: ${error.message} — revisar a mano lo ya escrito (el --deshacer lo vuelve)`)
}
for (const ch of CHEQUES) {
  const { error } = await sb.schema("msa").from("cheques").update({ factura_id: deshacer ? null : ch.fac }).eq("anticipo_id", ch.ant)
  if (error) throw new Error(error.message)
}
console.log(deshacer ? "↩ Deshecho: todo volvió a la foto del 05/11." : "✅ Aplicado [script 203].")
