// Sólo LECTURA: qué haría la 🧾 con cada factura de insumos ya leída (no aplica nada).
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { cargarVinculoStock } from "../lib/productivo/vinculo-renglon-db"
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]))
const sb: any = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: lects } = await sb.from("factura_lecturas").select("comprobante_id").eq("empresa", "MSA")
for (const l of lects || []) {
  const c = await cargarVinculoStock(sb, "MSA", l.comprobante_id)
  if (!c) continue
  const ps = c.propuestas.map(p => `#${p.n} ${p.estado}${p.entrada ? ` → ${p.entrada.fecha} ${p.entrada.cantidad}` : ""} (${c.insumos.find((i: any) => i.id === p.insumoStockId)?.producto ?? "?"}, ${p.fuenteInsumo ?? "-"}, ${p.cantidadStock ?? "?"} a ${p.precioStock ?? "?"})${p.motivos.length ? " [" + p.motivos.join("; ") + "]" : ""}`)
  console.log(`${c.f.denominacion_emisor.slice(0, 22)} ${c.numero} ${c.f.fecha_emision} · vínculos ${c.vinculos.length} · ${ps.join(" | ") || "todo vinculado"}`)
}
