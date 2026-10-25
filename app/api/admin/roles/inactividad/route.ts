import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { exigirAdmin } from "@/lib/auth/guard-admin"
import { validarMinutos } from "@/lib/auth/inactividad"
import { leerMinutosPorRol } from "@/lib/auth/inactividad-db"

/**
 * PATCH — el tiempo de inactividad de un rol (A-FEAT-1351). Body: `{ id, minutos }`; minutos vacío
 * o null = volver al default (1 hora).
 *
 * Ruta aparte del PATCH de permisos a propósito: aquél rechaza los roles de SISTEMA, y el usuario
 * tiene que poder ajustar también el suyo (admin). El trigger `roles_proteger_sistema` (scripts/60)
 * sólo congela secciones, 2FA, id y es_sistema, así que la base lo deja.
 */
export async function PATCH(request: Request) {
  const guard = await exigirAdmin()
  if (!guard.ok) return NextResponse.json({ error: guard.motivo }, { status: guard.status })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : null
  if (!id) return NextResponse.json({ error: "Faltan datos." }, { status: 400 })

  const v = validarMinutos(body?.minutos)
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })

  if ((await leerMinutosPorRol()) === null) {
    return NextResponse.json(
      { error: "Falta la columna del tiempo de inactividad: corré scripts/101-roles-inactividad.sql." },
      { status: 503 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .update({ minutos_inactividad: v.valor, actualizado: new Date().toISOString() })
    .eq("id", id)
    .select("id")

  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: "Ese rol no existe." }, { status: 404 })
  return NextResponse.json({ ok: true, minutos: v.valor })
}
