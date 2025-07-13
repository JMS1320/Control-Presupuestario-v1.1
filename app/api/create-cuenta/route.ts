import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: Request) {
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

    const { error } = await supabaseAdmin.from("cuentas_contables").insert([{ categ, cuenta_contable, tipo }])

    if (error) {
      return NextResponse.json({ error: `Error al crear cuenta: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error API create-cuenta:", err)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
