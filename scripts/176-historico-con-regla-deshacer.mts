/**
 * ↩️ Deshacer del script 176. Lee `scripts/176-hecho.json` (lo que el 176 aplicó de verdad) y vuelve cada fila a su valor
 * anterior exacto: el movimiento sin vínculo y con su nota de antes; la cuota CREADA se borra; la cuota PENDIENTE que se
 * concilió vuelve a sus valores; la cuota que sólo se ATÓ no se tocó, así que no se toca.
 * Sólo actúa sobre filas que todavía tienen la marca [script 176].
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const hecho: any[] = JSON.parse(readFileSync("scripts/176-hecho.json", "utf-8"))
const TABLA: Record<string, [string, string]> = { msa_galicia: ["public", "msa_galicia"], pam_galicia: ["public", "pam_galicia"], pam_galicia_cc: ["public", "pam_galicia_cc"] }
let n = 0
for (const p of hecho) {
  const [sc, t] = TABLA[p.cuenta]
  const q = sc === "public" ? sb.from(t) : sb.schema(sc).from(t)
  await q.update({ template_id: null, template_cuota_id: null, nota_operador: p.notaAntes }).eq("id", p.movId).like("nota_operador", "%[script 176]%")
  if (p.accion === "CREAR CUOTA") await sb.from("cuotas_egresos_sin_factura").delete().eq("id", p.cuotaId).like("detalle", "%[script 176]%")
  if (p.accion === "CONCILIAR PENDIENTE") {
    const a = p.cuotaAntes
    await sb.from("cuotas_egresos_sin_factura").update({ fecha_vencimiento: a.fecha_vencimiento, fecha_estimada: a.fecha_estimada, fecha_pago: a.fecha_pago,
      monto: a.monto, estado: a.estado, detalle: a.detalle }).eq("id", p.cuotaId).like("detalle", "%[script 176]%")
  }
  n++
}
console.log(`↩️ ${n} movimientos devueltos a como estaban`)
