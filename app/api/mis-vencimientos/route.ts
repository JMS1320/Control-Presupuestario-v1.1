import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { ahoraISO, hoyArgentina } from "@/lib/fechas"
import { puedeMirarComo } from "@/lib/auth/como-persona"
import {
  cuentasParaPagar, empresaDelPago, motivoPagoInvalido, vencimientosDeLaPersona,
  type CuotaDeLaPersona, type PropuestaDePago,
} from "@/lib/vencimientos/de-la-persona"

/**
 * 💸 «Lo que te vence» — A-FEAT-1543. Lee e INFORMA pagos SÓLO de lo asignado a la persona de la sesión.
 *
 * Por qué por el servidor y no leyendo las tablas desde la pantalla: la persona (MA) tiene un rol sin secciones; la
 * pantalla no tiene que necesitar permisos sobre los templates para mostrarle lo suyo. Acá se filtra por su mail
 * (`egresos_sin_factura.avisar_a`) con `service_role`, y el guard de sesión va primero (A-SEC-06).
 *
 * ⚠️ cambió 05/11: informar NO toca la cuota. Deja una propuesta en `public.propuestas_cambio` (tabla
 * `cuotas_egresos_sin_factura`) y la cuota cambia recién cuando JMS confirma (`/api/mis-vencimientos/confirmar`).
 *
 *   GET [?como=<mail> sólo admin]                     → { vencimientos, cuentas }
 *   POST { id, fecha, monto, medio, detalle }         → informa el pago (o edita lo informado, si sigue sin confirmar)
 *   POST { id, anular: true }                         → anula lo informado (mientras no esté confirmado)
 */

const TABLA = "cuotas_egresos_sin_factura"

async function loDeLaPersona(mail: string) {
  const { data: templates, error: eT } = await supabaseAdmin
    .from("egresos_sin_factura")
    .select("id, nombre_referencia, responsable, alertas, categ")
    .eq("activo", true)
    .contains("avisar_a", [mail])
  if (eT) throw new Error(eT.message)
  const ids = (templates ?? []).map(t => t.id)
  if (ids.length === 0) return { templates: [], cuotas: [] as (CuotaDeLaPersona & { egreso_id: string })[], propuestas: [] as PropuestaDePago[] }
  const { data: cuotas, error: eC } = await supabaseAdmin
    .from(TABLA)
    .select("id, egreso_id, estado, fecha_vencimiento, fecha_estimada, fecha_pago, monto, numero_cuota, detalle, medio_pago")
    .in("egreso_id", ids)
    .in("estado", ["pendiente", "pagar", "pagado", "conciliado"])
  if (eC) throw new Error(eC.message)
  const porId = new Map((templates ?? []).map(t => [t.id, t]))
  const conTemplate = (cuotas ?? []).map(c => {
    const t = porId.get(c.egreso_id)!
    return {
      ...c, monto: c.monto == null ? null : Number(c.monto),
      template: { nombre_referencia: t.nombre_referencia, responsable: t.responsable, alertas: t.alertas, categ: t.categ },
    }
  })
  // Las propuestas de pago sobre SUS cuotas (de cualquiera: si otro informó, también se ve)
  const idsCuotas = conTemplate.map(c => c.id)
  const propuestas: PropuestaDePago[] = []
  for (let i = 0; i < idsCuotas.length; i += 200) {
    const { data: p, error: eP } = await supabaseAdmin.from("propuestas_cambio")
      .select("id, registro_id, estado, cambios, resolucion, resuelta_at, resuelta_por")
      .eq("tabla", TABLA).in("registro_id", idsCuotas.slice(i, i + 200)).in("estado", ["propuesta", "cancelada"])
    if (eP) throw new Error(eP.message)
    propuestas.push(...((p ?? []) as PropuestaDePago[]))
  }
  return { templates: templates ?? [], cuotas: conTemplate, propuestas }
}

function mailDe(user: { email?: string | null }) {
  return (user.email ?? "").toLowerCase()
}

export async function GET(req: Request) {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  // 👁️ A-BUG-1544: un admin en «Ver como lo ve él» mira lo de otra persona (sólo lectura: el POST usa la sesión).
  const como = new URL(req.url).searchParams.get("como")
  if (como && !puedeMirarComo(g.rol, como)) return NextResponse.json({ ok: false, error: "Sólo un admin puede mirar como otra persona." }, { status: 403 })
  const mail = como ? como.trim().toLowerCase() : mailDe(g.user)
  if (!mail) return NextResponse.json({ ok: true, vencimientos: [], cuentas: [], asignados: 0 })
  try {
    const { templates, cuotas, propuestas } = await loDeLaPersona(mail)
    return NextResponse.json({
      ok: true,
      vencimientos: vencimientosDeLaPersona(cuotas, hoyArgentina(), propuestas),
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
  const body = await req.json().catch(() => null) as
    { id?: string; fecha?: string; monto?: number; detalle?: string; medio?: string; anular?: boolean } | null
  if (!body?.id || !mail) return NextResponse.json({ ok: false, error: "Falta la cuota." }, { status: 400 })

  try {
    // La cuota tiene que ser de un template asignado a esta persona: se busca DENTRO de lo suyo, nunca por id suelto.
    const { templates, cuotas, propuestas } = await loDeLaPersona(mail)
    const cuota = cuotas.find(c => c.id === body.id)
    if (!cuota) return NextResponse.json({ ok: false, error: "Esa cuota no está entre las tuyas." }, { status: 403 })
    const abierta = propuestas.find(p => p.registro_id === cuota.id && p.estado === "propuesta")

    if (body.anular) {
      if (!abierta) return NextResponse.json({ ok: false, error: "No hay nada informado para anular (o ya se confirmó)." }, { status: 409 })
      const { error } = await supabaseAdmin.from("propuestas_cambio")
        .update({ estado: "cancelada", resuelta_at: ahoraISO(), resuelta_por: mail, resolucion: "anulada por quien la informó" })
        .eq("id", abierta.id).eq("estado", "propuesta")
      if (error) throw new Error(error.message)
      return NextResponse.json({ ok: true })
    }

    const hoy = hoyArgentina()
    const permitidas = cuentasParaPagar(templates.map(t => t.responsable)).map(c => c.id)
    const fecha = (body.fecha ?? hoy).slice(0, 10)
    const medio = body.medio ?? permitidas[0] ?? ""
    const monto = Math.round(Number(body.monto ?? cuota.monto ?? 0) * 100) / 100
    const motivo = motivoPagoInvalido({ fecha, medio, estado: cuota.estado, monto }, permitidas, hoy)
    if (motivo) return NextResponse.json({ ok: false, error: motivo }, { status: 400 })
    const empresa = empresaDelPago(medio, cuota.template.responsable)
    if (!empresa) return NextResponse.json({ ok: false, error: "No se pudo saber de qué empresa es este pago." }, { status: 400 })

    // El detalle es SUYO: va tal cual lo dejó (el campo arranca con el que la cuota ya tenía).
    const cambios = { estado: "pagado", fecha_pago: fecha, monto, medio_pago: medio, detalle: (body.detalle ?? cuota.detalle ?? "").trim() || null }
    if (abierta) {
      const { error } = await supabaseAdmin.from("propuestas_cambio")
        .update({ cambios, empresa, propuesta_at: ahoraISO() }).eq("id", abierta.id).eq("estado", "propuesta")
      if (error) throw new Error(error.message)
    } else {
      const antes = { estado: cuota.estado, fecha_pago: cuota.fecha_pago, monto: cuota.monto, medio_pago: cuota.medio_pago, detalle: cuota.detalle }
      const { error } = await supabaseAdmin.from("propuestas_cambio").insert({
        empresa, tabla: TABLA, registro_id: cuota.id, persona: mail, estado: "propuesta",
        nota: `Pago informado: ${cuota.template.nombre_referencia ?? "cuota"}${cuota.numero_cuota ? ` · cuota ${cuota.numero_cuota}` : ""}`,
        antes, cambios, propuesta_at: ahoraISO(),
      })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
