import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import {
  propagarCuentaAMovimientos, avisoDePropagacion, type ClienteParaPropagar,
} from "@/lib/conciliacion/propagar-cuenta"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/arca-asignar
 * Asigna nro_cuenta + cuenta_contable a uno o varios comprobantes ARCA actuales.
 * Body: { ids: string[], nro_cuenta: string | null, cuenta_contable: string | null }
 * Para desasignar: pasar nro_cuenta: null (cuenta_contable se mantiene)
 *
 * Propaga la cuenta a los movimientos conciliados de las DIEZ tablas que llevan el vinculo
 * (ver lib/conciliacion/propagar-cuenta.ts). Antes nombraba tres a mano y no corria al desasignar.
 */
export async function PATCH(request: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

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

    /**
     * 🔗 **Propagar a los movimientos conciliados — por UN solo camino** (A-BUG-1221).
     *
     * Antes acá había una lista de **3 tablas escrita a mano**, adentro de un `if (cuenta_contable)`
     * —así que **al desasignar no propagaba nada** y el movimiento se quedaba con la cuenta vieja—, y
     * los errores iban a `console.error` mientras el usuario leía «Cuenta asignada».
     *
     * Ahora las diez tablas salen de `TABLAS_CON_VINCULO_ARCA`, corre también al desasignar, y
     * **devuelve qué propagó y qué salteó** para poder decírselo.
     */
    const { data: plan } = await supabase.from("cuentas_contables").select("cuenta_contable")
    const propagacion = await propagarCuentaAMovimientos(
      supabase as unknown as ClienteParaPropagar,
      ids,
      { cuenta_contable: nro_cuenta === null ? null : cuenta_contable, nro_cuenta },
      (plan ?? []).map(c => String((c as { cuenta_contable: string }).cuenta_contable)),
    )

    return NextResponse.json({
      success: true,
      actualizados: count ?? ids.length,
      message: nro_cuenta
        ? `Cuenta asignada a ${ids.length} comprobante(s)`
        : `Asignación removida de ${ids.length} comprobante(s)`,
      // 🧮 Nada en silencio: la pantalla muestra esto si hay algo que decir.
      propagacion: {
        propagados: propagacion.propagados,
        salteados: propagacion.salteados.length,
        aviso: avisoDePropagacion(propagacion),
        detalleSalteados: propagacion.salteados,
        fallaron: propagacion.fallaron,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
