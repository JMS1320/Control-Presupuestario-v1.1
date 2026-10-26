import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { avisoDePropagacion, type ClienteParaPropagar } from "@/lib/conciliacion/propagar-cuenta"
import { asignarCuentaAFacturas, EMPRESAS_FACTURA, type EmpresaFactura } from "@/lib/conciliacion/asignar-cuenta"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * PATCH /api/arca-asignar — el ÚNICO camino para cambiar la cuenta contable de facturas (A-DEC-1021).
 * Body: { empresa: 'MSA'|'PAM'|'MA', ids: string[], nro_cuenta: string|null, cuenta_contable: string|null }
 * - Una empresa por llamada; si alguna factura no es de esa empresa no se escribe nada.
 * - El par número + nombre sale del plan de cuentas (A-BUG-1371). Los dos en null = quitar la cuenta.
 * - Propaga a los movimientos conciliados de los 11 extractos (lib/conciliacion/propagar-cuenta.ts).
 * `empresa` ausente = MSA (compatibilidad con llamadas viejas).
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
    const empresa = (body.empresa ?? "MSA") as EmpresaFactura
    if (!EMPRESAS_FACTURA.includes(empresa)) {
      return NextResponse.json({ success: false, message: `Empresa desconocida: ${body.empresa}` }, { status: 400 })
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, message: "Se requiere al menos un ID" }, { status: 400 })
    }

    const r = await asignarCuentaAFacturas(
      supabase as unknown as ClienteParaPropagar, empresa, ids, { nro_cuenta, cuenta_contable })

    return NextResponse.json({
      success: true,
      actualizados: r.actualizados,
      cuenta: r.cuenta,
      message: r.cuenta
        ? `Cuenta asignada a ${r.actualizados} comprobante(s) de ${empresa}`
        : `Asignación removida de ${r.actualizados} comprobante(s) de ${empresa}`,
      // 🧮 Nada en silencio: la pantalla muestra esto si hay algo que decir.
      propagacion: {
        propagados: r.propagacion.propagados,
        salteados: r.propagacion.salteados.length,
        aviso: avisoDePropagacion(r.propagacion),
        detalleSalteados: r.propagacion.salteados,
        fallaron: r.propagacion.fallaron,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
