import { NextResponse } from "next/server"
import { clienteUsuario } from "@/lib/supabase-usuario"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"

export async function POST(request: Request) {
  // Cliente de la SESIÓN, no service_role: así la RLS también gobierna esta ruta (A-SEC-01).
  const supabase = await clienteUsuario()

  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const body = await request.json()

    const { categ, cuenta_contable, tipo } = body as {
      categ: string
      cuenta_contable: string
      tipo: "ingreso" | "egreso" | "financiero" | "distribucion"
    }

    if (!categ || !cuenta_contable || !tipo) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
    }

    const { error } = await supabase.from("cuentas_contables").insert([{ categ, cuenta_contable, tipo }])

    if (error) {
      return NextResponse.json({ error: `Error al crear cuenta: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error API create-cuenta:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
