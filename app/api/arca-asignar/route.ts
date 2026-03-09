import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/arca-asignar
 * Asigna nro_cuenta + cuenta_contable a uno o varios comprobantes ARCA actuales.
 * Body: { ids: string[], nro_cuenta: string | null, cuenta_contable: string | null }
 * Para desasignar: pasar nro_cuenta: null (cuenta_contable se mantiene)
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { ids, nro_cuenta, cuenta_contable } = body as {
      ids: string[]
      nro_cuenta: string | null
      cuenta_contable: string | null
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, message: "Se requiere al menos un ID" }, { status: 400 })
    }

    const updateData: Record<string, any> = { nro_cuenta }
    // Solo actualizar cuenta_contable si se está asignando (no al quitar)
    if (nro_cuenta !== null && cuenta_contable !== null) {
      updateData.cuenta_contable = cuenta_contable
    }

    const { error, count } = await supabase
      .schema("msa")
      .from("comprobantes_arca")
      .update(updateData)
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
