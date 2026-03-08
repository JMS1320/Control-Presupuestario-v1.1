import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/historico-asignar
 * Asigna cuenta_asignada + nro_cuenta a uno o varios comprobantes históricos.
 * Body: { ids: string[], nro_cuenta: string | null, cuenta_asignada: string | null }
 * Para desasignar: pasar nro_cuenta: null, cuenta_asignada: null
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { ids, nro_cuenta, cuenta_asignada } = body as {
      ids: string[]
      nro_cuenta: string | null
      cuenta_asignada: string | null
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, message: "Se requiere al menos un ID" }, { status: 400 })
    }

    const { error, count } = await supabase
      .schema("msa")
      .from("comprobantes_historico")
      .update({ nro_cuenta, cuenta_asignada })
      .in("id", ids)

    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      actualizados: count ?? ids.length,
      message: nro_cuenta
        ? `Cuenta asignada a ${ids.length} comprobante(s)`
        : `Asignación removida de ${ids.length} comprobante(s)`,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
