import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"

const ROLES = ["admin", "contable"] as const

/**
 * PATCH — cambiar el rol y/o el bloqueo de una cuenta.
 *
 * `bloqueado: false` es el camino de vuelta del revocado. Sin esto, revocar era una puerta de una
 * sola dirección: la cuenta quedaba bloqueada, y al intentar crearla de nuevo chocaba con
 * "ya existe" — sin forma de arreglarlo desde la app.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  const { id } = await params

  // Candado anti-encierro: si el último admin se baja a contable o se revoca, nadie puede volver
  // a entrar a esta pantalla nunca más (rol y bloqueo sólo se cambian desde acá).
  if (id === guard.user.id) {
    return NextResponse.json(
      { error: "No podés cambiarte el rol ni el acceso a vos mismo." },
      { status: 400 }
    )
  }

  let body: { rol?: string; bloqueado?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const cambios: Record<string, unknown> = {}

  if (body.rol !== undefined) {
    if (!ROLES.includes(body.rol as (typeof ROLES)[number])) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 })
    }
    cambios.app_metadata = { role: body.rol }
  }

  if (body.bloqueado !== undefined) {
    // 'none' levanta el bloqueo; 876000h ≈ 100 años lo pone.
    cambios.ban_duration = body.bloqueado ? "876000h" : "none"
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada para cambiar." }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, cambios)
  if (error) return NextResponse.json({ error: "No se pudo actualizar." }, { status: 500 })

  return NextResponse.json({ ok: true, id })
}

/**
 * DELETE — revocar el acceso.
 *
 * NO borra la cuenta: la **bloquea**. Borrar rompería la trazabilidad de quién hizo qué, y
 * `CLAUDE.md` es explícito con que nada destructivo se hace sin más. Se revierte con
 * `PATCH { bloqueado: false }`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await exigirAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.motivo }, { status: guard.status })
  }

  const { id } = await params
  if (id === guard.user.id) {
    return NextResponse.json({ error: "No podés revocarte el acceso a vos mismo." }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
  })
  if (error) return NextResponse.json({ error: "No se pudo revocar." }, { status: 500 })

  return NextResponse.json({ ok: true, id })
}
