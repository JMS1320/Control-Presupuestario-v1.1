/**
 * 🌾 Script 132 — corre la carga de `132-stock-inicio-msa-30-06-2025.sql` desde su JSON (mismos ids, mismos datos).
 * El .sql es el registro legible; esto lo ejecuta con la service key porque el SQL pesa 83 KB.
 *
 *   npx tsx scripts/132-stock-inicio-msa-30-06-2025.mts .env.local
 *
 * Frena si ya corrió. Deshacer: 132-stock-inicio-msa-30-06-2025-deshacer.sql.
 */
import fs from "node:fs"

const env = Object.fromEntries(fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]))
const { createClient } = await import("@supabase/supabase-js")
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const p = sb.schema("productivo")
const d = JSON.parse(fs.readFileSync(new URL("./132-stock-inicio-msa-30-06-2025.json", import.meta.url), "utf8"))

const ya = await p.from("stock_inicio").select("id", { count: "exact", head: true }).like("fuente", "%STOCKS - GRANOS%")
if (ya.error) throw ya.error
if ((ya.count ?? 0) > 0) throw new Error("el 132 ya corrió")

const falla = (e: unknown, que: string) => { if (e) { console.error(que, e); process.exit(1) } }

let r = await p.from("categorias_insumo").insert(d.categoria_forraje); falla(r.error, "categoría")
const { data: cats, error: ec } = await p.from("categorias_insumo").select("id, nombre"); falla(ec, "categorías")
const catId = (n: string) => n === "Forraje" ? d.categoria_forraje.id : cats!.find(c => c.nombre === n)?.id
const prods = d.productos.map((x: any) => {
  const id = catId(x.categoria); if (!id) throw new Error("sin categoría: " + x.categoria)
  return { id: x.id, categoria_id: id, producto: x.producto, cantidad: 0, unidad_medida: x.unidad_medida, observaciones: x.observaciones }
})
r = await p.from("stock_insumos").insert(prods); falla(r.error, "productos")
r = await p.from("stock_inicio").insert(d.stock_inicio); falla(r.error, "stock_inicio")
r = await p.from("pasturas").insert(d.pasturas); falla(r.error, "pasturas")

const { data: ctrl } = await p.from("stock_inicio").select("rubro, emparejado, valor_pesos").eq("fecha", "2025-06-30")
const tot = (ctrl ?? []).reduce((s, x: any) => s + (Number(x.valor_pesos) || 0), 0)
console.log(`✅ 132: ${prods.length} productos nuevos · ${ctrl?.length} renglones de stock al 30/06/2025 · total $ ${tot.toLocaleString("es-AR", { minimumFractionDigits: 2 })} · ${d.pasturas.length} pasturas`)
