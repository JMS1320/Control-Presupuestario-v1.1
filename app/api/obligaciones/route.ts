/**
 * POST /api/obligaciones — crea, si falta, la tarea del MES de cada obligación recurrente (A-FEAT-1449 tanda 3).
 *
 * La llama «Para vos» al abrir el Principal (cualquier usuario con sesión). Es idempotente: una tarea por obligación y
 * mes (índice único `revisiones_obligacion_unica`); si dos pantallas la piden a la vez, la segunda choca con el índice y
 * se ignora. Escribe con `service_role` porque `anon`/`authenticated` sólo insertan marcas a mano.
 */
import { NextResponse } from "next/server"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { createClientServer } from "@/lib/supabase-server"
import { tareasDelMes, type AvisoDestinatarios, type ObligacionRecurrente } from "@/lib/revisiones/avisos"
import { hoyArgentina } from "@/lib/fechas"

export const runtime = "nodejs"

export async function POST() {
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const { data: s } = await (await createClientServer()).auth.getUser()
  if (!s.user) return NextResponse.json({ ok: false, error: "Sin sesión" }, { status: 401 })
  try {
    const [{ data: obl, error: e1 }, { data: avi, error: e2 }] = await Promise.all([
      supabaseAdmin.from("obligaciones_recurrentes").select("id, nombre, aviso_tipo, dia_mes, activa"),
      supabaseAdmin.from("avisos_destinatarios").select("tipo, nombre, destinatarios"),
    ])
    if (e1 || e2) throw e1 ?? e2
    const tareas = tareasDelMes((obl ?? []) as ObligacionRecurrente[], (avi ?? []) as AvisoDestinatarios[], hoyArgentina())
    if (!tareas.length) return NextResponse.json({ ok: true, creadas: 0 })
    const { data: ya } = await supabaseAdmin.from("revisiones").select("registro_id")
      .eq("origen", "obligacion").in("registro_id", tareas.map(t => t.registro_id))
    const existentes = new Set((ya ?? []).map(r => r.registro_id))
    let creadas = 0
    for (const t of tareas.filter(t => !existentes.has(t.registro_id))) {
      const { error } = await supabaseAdmin.from("revisiones").insert({ id: crypto.randomUUID(), ...t })
      if (!error) creadas++
      else if ((error as { code?: string }).code !== "23505") throw error   // 23505 = otra pantalla la creó recién
    }
    return NextResponse.json({ ok: true, creadas })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
