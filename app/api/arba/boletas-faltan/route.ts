/**
 * POST /api/arba/boletas-faltan — A-FEAT-1566: las boletas de ARBA que faltan → una tarea (una por cuota).
 * `{ anio, cuota, llegaron: [egreso_id…] }` → crea, actualiza o cierra la tarea `arba:<año>-C<cuota>` en `revisiones`,
 * para quien recibe «Vencimientos de impuestos» (`avisos_destinatarios`). Sólo si llegó al menos una boleta de esa cuota.
 * Escribe con `service_role` (como las obligaciones del mes): `authenticated` sólo inserta marcas a mano.
 */
import { NextResponse } from "next/server"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { createClientServer } from "@/lib/supabase-server"
import { destinatarioPorDefecto, type AvisoDestinatarios } from "@/lib/revisiones/avisos"
import { boletasQueFaltan, tareaBoletasFaltan } from "@/lib/arba/boletas-faltan"
import { hoyArgentina, ahoraISO } from "@/lib/fechas"

export const runtime = "nodejs"

const ES_PARTIDA = /^\d{3}-?\d{6}-?\d$/

export async function POST(request: Request) {
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const { data: s } = await (await createClientServer()).auth.getUser()
  if (!s.user) return NextResponse.json({ ok: false, error: "Sin sesión" }, { status: 401 })
  let b: { anio?: unknown; cuota?: unknown; llegaron?: unknown; vencimiento?: unknown } = {}
  try { b = await request.json() } catch { /* vacío */ }
  const anio = Number(b.anio), cuota = String(b.cuota ?? "")
  const llegaron = new Set(Array.isArray(b.llegaron) ? b.llegaron.filter((x): x is string => typeof x === "string") : [])
  if (!(anio > 2000) || !/^\d$/.test(cuota) || !llegaron.size) return NextResponse.json({ ok: false, error: "Faltan año, cuota o las boletas que llegaron." }, { status: 400 })
  try {
    // Lo que tenía que llegar: los templates activos del año con partida de ARBA, y los complementarios
    const { data: tps, error: e1 } = await supabaseAdmin.from("egresos_sin_factura")
      .select("id, nombre_referencia, responsable, partida_arba").eq("activo", true).eq("año", String(anio))
      .or("partida_arba.not.is.null,nombre_referencia.ilike.%Complementario%")
    if (e1) throw e1
    const templates = ((tps ?? []) as { id: string; nombre_referencia: string; responsable: string | null; partida_arba: string | null }[])
      .filter(t => ES_PARTIDA.test(String(t.partida_arba ?? "").trim()) || /complementario/i.test(t.nombre_referencia))
      .map(t => ({ id: t.id, nombre: t.nombre_referencia, responsable: t.responsable }))
    const { data: cs, error: e2 } = await supabaseAdmin.from("cuotas_egresos_sin_factura")
      .select("egreso_id, estado, fecha_vencimiento").eq("numero_cuota", Number(cuota)).in("egreso_id", templates.map(t => t.id))
    if (e2) throw e2
    const faltan = boletasQueFaltan(templates, ((cs ?? []) as { egreso_id: string; estado: string; fecha_vencimiento: string | null }[])
      .map(c => ({ egresoId: c.egreso_id, estado: c.estado, vencimiento: c.fecha_vencimiento })), llegaron)
    const vencimientoBoletas = typeof b.vencimiento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.vencimiento) ? b.vencimiento : null
    const tarea = tareaBoletasFaltan({ anio, cuota, faltan, hoy: hoyArgentina(), vencimientoBoletas })
    const registroId = `arba:${anio}-C${cuota}`
    const { data: ya } = await supabaseAdmin.from("revisiones").select("id, estado")
      .eq("origen", "boletas_arba").eq("registro_id", registroId).in("estado", ["abierta", "por_confirmar"]).limit(1)
    const abierta = (ya ?? [])[0] as { id: string } | undefined

    if (!tarea) {
      // 🔒 Control después: ya no falta ninguna → la tarea se cierra sola, diciendo por qué
      if (abierta) await supabaseAdmin.from("revisiones").update({ estado: "resuelta", resolucion: "Llegaron (o se pagaron) todas las boletas de la cuota.", resuelto_por: "app", resuelto_at: ahoraISO() }).eq("id", abierta.id)
      return NextResponse.json({ ok: true, faltan: 0, cerrada: !!abierta })
    }
    if (abierta) {
      await supabaseAdmin.from("revisiones").update({ motivo: tarea.motivo, tarea_hasta: tarea.tarea_hasta }).eq("id", abierta.id)
      return NextResponse.json({ ok: true, faltan: faltan.length, motivo: tarea.motivo, actualizada: true })
    }
    const { data: avi } = await supabaseAdmin.from("avisos_destinatarios").select("tipo, nombre, destinatarios")
    const para = destinatarioPorDefecto((avi ?? []) as AvisoDestinatarios[], "vencimiento_impuesto") || null
    const { error: e3 } = await supabaseAdmin.from("revisiones").insert({
      id: crypto.randomUUID(), origen: "boletas_arba", tabla_ref: "boletas_arba", registro_id: registroId,
      descripcion_ref: `Boletas de ARBA ${anio} · cuota ${cuota}`, motivo: tarea.motivo, asignado_a: para,
      es_tarea: true, tarea_hasta: tarea.tarea_hasta, creado_por: "app (boletas de ARBA)", estado: "abierta", tipo: "revisar",
      pantalla: "cashflow",
    })
    if (e3) throw e3
    return NextResponse.json({ ok: true, faltan: faltan.length, motivo: tarea.motivo, creada: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
