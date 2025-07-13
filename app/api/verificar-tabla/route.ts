import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { tabla } = await req.json()

    if (!tabla) {
      return NextResponse.json({ error: "Falta el nombre de la tabla." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from(tabla)
      .select("saldo, orden")
      .order("orden", { ascending: false })
      .limit(1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ tieneMovimientos: false })
    }

    const ultimo = data[0]
    return NextResponse.json({
      tieneMovimientos: true,
      saldo: ultimo.saldo ?? 0,
      orden: ultimo.orden ?? 0
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
