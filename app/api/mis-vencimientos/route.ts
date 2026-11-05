import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { ahoraISO, hoyArgentina } from "@/lib/fechas"
import {
  cuentasParaPagar, motivoPagoInvalido, vencimientosDeLaPersona, type CuotaDeLaPersona,
} from "@/lib/vencimientos/de-la-persona"

/**
 * 💸 «Lo que te vence» — A-FEAT-1543. Lee y marca pagado SÓLO lo asignado a la persona de la sesión.
 *
 * Por qué por el servidor y no leyendo las tablas desde la pantalla: la persona (MA) tiene un rol sin secciones; la
 * pantalla no tiene que necesitar permisos sobre los templates para mostrarle lo suyo. Acá se filtra por su mail
 * (`egresos_sin_factura.avisar_a`) con `service_role`, y el guard de sesión va primero (A-SEC-06).
 *
 *   GET                                     → { vencimientos, cuentas }
 *   POST { id, fecha, detalle, medio }      → marca la cuota «pagado» (fecha de pago, detalle, «Pagado desde»)
 *   POST { id, deshacer: true }             → la vuelve a «pendiente» (sólo si está «pagado», nunca si ya se concilió)
 */

async function loDeLaPersona(mail: string) {
  const { data: templates, error: eT } = await supabaseAdmin
    .from("egresos_sin_factura")
    .select("id, nombre_referencia, responsable, alertas, categ")
    .eq("activo", true)
    .contains("avisar_a", [mail])
  if (eT) throw new Error(eT.message)
  const ids = (templates ?? []).map(t => t.id)
  if (ids.length === 0) return { templates: [], cuotas: [] as CuotaDeLaPersona[] }
  const { data: cuotas, error: eC } = await supabaseAdmin
    .from("cuotas_egresos_sin_factura")
    .select("id, egreso_id, estado, fecha_vencimiento, fecha_estimada, fecha_pago, monto, numero_cuota, detalle, medio_pago")
    .in("egreso_id", ids)
    .in("estado", ["pendiente", "pagar", "pagado", "conciliado"])
  if (eC) throw new Error(eC.message)
  const porId = new Map((templates ?? []).map(t => [t.id, t]))
  const conTemplate: (CuotaDeLaPersona & { egreso_id: string })[] = (cuotas ?? []).map(c => {
    const t = porId.get(c.egreso_id)!
    return {
      ...c, monto: c.monto == null ? null : Number(c.monto),
      template: { nombre_referencia: t.nombre_referencia, responsable: t.responsable, alertas: t.alertas, categ: t.categ },
    }
  })
  return { templates: templates ?? [], cuotas: conTemplate }
}

function mailDe(user: { email?: string | null }) {
  return (user.email ?? "").toLowerCase()
}

export async function GET() {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const mail = mailDe(g.user)
  if (!mail) return NextResponse.json({ ok: true, vencimientos: [], cuentas: [] })
  try {
    const { templates, cuotas } = await loDeLaPersona(mail)
    return NextResponse.json({
      ok: true,
      vencimientos: vencimientosDeLaPersona(cuotas, hoyArgentina()),
      cuentas: cuentasParaPagar(templates.map(t => t.responsable)),
      hoy: hoyArgentina(),
      asignados: templates.length,
      // El cartel 🧪 de pruebas es para JMS, no para la persona a la que le vence.
      admin: g.rol === "admin",
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const mail = mailDe(g.user)
  const body = await req.json().catch(() => null) as { id?: string; fecha?: string; detalle?: string; medio?: string; deshacer?: boolean } | null
  if (!body?.id || !mail) return NextResponse.json({ ok: false, error: "Falta la cuota." }, { status: 400 })

  try {
    // La cuota tiene que ser de un template asignado a esta persona: se busca DENTRO de lo suyo, nunca por id suelto.
    const { templates, cuotas } = await loDeLaPersona(mail)
    const cuota = cuotas.find(c => c.id === body.id)
    if (!cuota) return NextResponse.json({ ok: false, error: "Esa cuota no está entre las tuyas." }, { status: 403 })

    if (body.deshacer) {
      if (cuota.estado !== "pagado") return NextResponse.json({ ok: false, error: "Sólo se puede deshacer algo marcado pagado y todavía no conciliado." }, { status: 409 })
      const { error } = await supabaseAdmin.from("cuotas_egresos_sin_factura")
        .update({ estado: "pendiente", fecha_pago: null, medio_pago: "banco", updated_at: ahoraISO() })
        .eq("id", cuota.id).eq("estado", "pagado")
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    const hoy = hoyArgentina()
    const permitidas = cuentasParaPagar(templates.map(t => t.responsable)).map(c => c.id)
    const fecha = (body.fecha ?? hoy).slice(0, 10)
    const medio = body.medio ?? permitidas[0] ?? ""
    const motivo = motivoPagoInvalido({ fecha, medio, estado: cuota.estado }, permitidas, hoy)
    if (motivo) return NextResponse.json({ ok: false, error: motivo }, { status: 400 })

    // El detalle es SUYO: va tal cual lo dejó en el campo (que arranca con el detalle que ya tenía la cuota).
    const { error } = await supabaseAdmin.from("cuotas_egresos_sin_factura")
      .update({ estado: "pagado", fecha_pago: fecha, medio_pago: medio, detalle: (body.detalle ?? cuota.detalle ?? "").trim() || null, updated_at: ahoraISO() })
      .eq("id", cuota.id).in("estado", ["pendiente", "pagar"])
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
