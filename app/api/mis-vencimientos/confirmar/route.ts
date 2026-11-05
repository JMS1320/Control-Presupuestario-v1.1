import { NextResponse } from "next/server"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { ahoraISO, hoyArgentina } from "@/lib/fechas"
import { CUENTAS_BANCO } from "@/lib/pagos/pagado-desde"
import { motivoPagoInvalido, PREFIJO_DEVUELTA } from "@/lib/vencimientos/de-la-persona"

/**
 * ✔ Los PAGOS INFORMADOS que esperan que JMS confirme — A-FEAT-1543 (JMS 05/11: *«¿eso quedará conmigo hasta que
 * confirme antes de impactar, verdad?»*). Sólo admin (con 2FA).
 *
 *   GET                                                     → { pendientes: [...] } (propuestas sobre cuotas, abiertas)
 *   POST { id, accion: "confirmar", fecha, monto, medio, detalle }  → aplica a la cuota (lo que mande JMS manda:
 *        arranca con lo que informó la persona y lo puede corregir) y deja la propuesta «aceptada»
 *   POST { id, accion: "devolver", motivo }                → la propuesta queda «cancelada» con «devuelta: motivo»;
 *        la persona ve la cuota otra vez sin pagar, con el motivo
 *
 * La HUELLA queda en la propuesta: `cambios` = lo que informó ella; `resolucion` = qué cambió JMS al confirmar.
 */
const TABLA = "cuotas_egresos_sin_factura"

/** Lo informado, sin el archivo adjunto (que no viaja en la lista). */
function sinComprobante(c: unknown): Record<string, unknown> {
  const r = { ...((c ?? {}) as Record<string, unknown>) }
  delete r.comprobante
  return r
}

export async function GET() {
  const g = await exigirAdmin()
  if (!g.ok) return NextResponse.json({ ok: false, error: g.motivo }, { status: g.status })
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const { data: props, error } = await supabaseAdmin.from("propuestas_cambio")
    .select("id, registro_id, persona, empresa, nota, cambios, antes, propuesta_at")
    .eq("tabla", TABLA).eq("estado", "propuesta").order("propuesta_at")
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const ids = (props ?? []).map(p => p.registro_id)
  const cuotas = ids.length ? (await supabaseAdmin.from(TABLA)
    .select("id, estado, monto, numero_cuota, fecha_vencimiento, fecha_estimada, egreso_id, egresos_sin_factura(nombre_referencia, responsable)")
    .in("id", ids)).data ?? [] : []
  const porId = new Map(cuotas.map(c => [c.id, c]))
  const pendientes = (props ?? []).map(p => {
    const c = porId.get(p.registro_id) as (typeof cuotas)[number] | undefined
    const t = (c as unknown as { egresos_sin_factura?: { nombre_referencia: string | null; responsable: string | null } } | undefined)?.egresos_sin_factura
    return {
      // El comprobante (A-FEAT-1560) no viaja en la lista: sólo el nombre; se abre por /api/mis-vencimientos/comprobante.
      id: p.id, persona: p.persona, empresa: p.empresa, nota: p.nota, propuesta_at: p.propuesta_at,
      informado: sinComprobante(p.cambios),
      comprobante: ((p.cambios as { comprobante?: { nombre?: string } } | null)?.comprobante?.nombre) ?? null,
      cuota: c ? {
        id: c.id, estado: c.estado, monto: Number(c.monto ?? 0), numero_cuota: c.numero_cuota,
        vencimiento: (c.fecha_vencimiento ?? c.fecha_estimada ?? "").slice(0, 10),
        nombre: t?.nombre_referencia ?? "Cuota", responsable: t?.responsable ?? null,
      } : null,
    }
  })
  return NextResponse.json({ ok: true, pendientes, cuentas: CUENTAS_BANCO })
}

export async function POST(req: Request) {
  const g = await exigirAdmin()
  if (!g.ok) return NextResponse.json({ ok: false, error: g.motivo }, { status: g.status })
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const body = await req.json().catch(() => null) as
    { id?: string; accion?: string; fecha?: string; monto?: number; medio?: string; detalle?: string; motivo?: string } | null
  if (!body?.id) return NextResponse.json({ ok: false, error: "Falta la propuesta." }, { status: 400 })
  const quien = etiquetaPersona(g.user) ?? g.user.email ?? "admin"

  const { data: prop, error: eP } = await supabaseAdmin.from("propuestas_cambio")
    .select("id, registro_id, estado, cambios").eq("id", body.id).eq("tabla", TABLA).single()
  if (eP || !prop) return NextResponse.json({ ok: false, error: "No se encontró la propuesta." }, { status: 404 })
  if (prop.estado !== "propuesta") return NextResponse.json({ ok: false, error: "Ya fue resuelta." }, { status: 409 })

  if (body.accion === "devolver") {
    const motivo = (body.motivo ?? "").trim()
    if (!motivo) return NextResponse.json({ ok: false, error: "Decile por qué se lo devolvés." }, { status: 400 })
    const { error } = await supabaseAdmin.from("propuestas_cambio")
      .update({ estado: "cancelada", resuelta_at: ahoraISO(), resuelta_por: quien, resolucion: PREFIJO_DEVUELTA + motivo })
      .eq("id", prop.id).eq("estado", "propuesta")
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.accion !== "confirmar") return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 })
  const { data: cuota } = await supabaseAdmin.from(TABLA).select("id, estado").eq("id", prop.registro_id).single()
  if (!cuota) return NextResponse.json({ ok: false, error: "La cuota ya no existe." }, { status: 404 })
  const informado = (prop.cambios ?? {}) as { fecha_pago?: string; monto?: number; medio_pago?: string; detalle?: string | null }
  const fecha = (body.fecha ?? informado.fecha_pago ?? "").slice(0, 10)
  const monto = Math.round(Number(body.monto ?? informado.monto ?? 0) * 100) / 100
  const medio = body.medio ?? informado.medio_pago ?? "banco"
  const detalle = (body.detalle ?? informado.detalle ?? "")?.trim() || null
  // JMS puede elegir cualquier cuenta (no sólo las de la persona): la validación de cuenta es contra todas las de banco.
  const motivo = motivoPagoInvalido({ fecha, medio, estado: cuota.estado, monto }, ["banco", ...CUENTAS_BANCO.map(c => c.id)], hoyArgentina())
  if (motivo) return NextResponse.json({ ok: false, error: motivo }, { status: 400 })

  const { error: eC } = await supabaseAdmin.from(TABLA)
    .update({ estado: "pagado", fecha_pago: fecha, monto, medio_pago: medio, detalle, updated_at: ahoraISO() })
    .eq("id", cuota.id).in("estado", ["pendiente", "pagar"])
  if (eC) return NextResponse.json({ ok: false, error: eC.message }, { status: 500 })

  // La huella: qué cambió JMS respecto de lo informado (vacío = lo confirmó tal cual).
  const difs: string[] = []
  if (fecha !== informado.fecha_pago) difs.push(`fecha ${informado.fecha_pago} → ${fecha}`)
  if (monto !== Math.round(Number(informado.monto ?? 0) * 100) / 100) difs.push(`monto ${informado.monto} → ${monto}`)
  if (medio !== informado.medio_pago) difs.push(`cuenta ${informado.medio_pago} → ${medio}`)
  if ((detalle ?? "") !== (informado.detalle ?? "")) difs.push("detalle corregido")
  const { error: eR } = await supabaseAdmin.from("propuestas_cambio").update({
    estado: "aceptada", resuelta_at: ahoraISO(), resuelta_por: quien,
    resolucion: difs.length ? `confirmada con cambios: ${difs.join(" · ")}` : "confirmada tal cual",
  }).eq("id", prop.id)
  if (eR) return NextResponse.json({ ok: false, error: eR.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
