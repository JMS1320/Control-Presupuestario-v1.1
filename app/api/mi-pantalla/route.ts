import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { nivelesDe, seccionesDelRol } from "@/lib/auth/permisos"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { hoyArgentina } from "@/lib/fechas"
import { cargarCuotasImpuestos } from "@/lib/impuestos/datos-papel"
import {
  cuotasDeEmpresa, esEmpresaMiPantalla, impuestosSinPagar, loQueViene, misArrendamientos, misImpuestosDelAnio, puedeVerBloque, puedeVerEmpresa,
  RECURSO_BLOQUE, type BloqueMiPantalla,
} from "@/lib/ma/mi-pantalla"
import { leerArrendamientos } from "@/lib/ma/mi-pantalla-datos"

/**
 * 👤 La pantalla de MA (Mercedes Areco) — A-FEAT-1634. SÓLO LECTURA.
 *
 * Por el servidor, igual que «Lo que te vence» (`/api/mis-vencimientos`): el rol `ma` no tiene secciones, así que la
 * pantalla no puede leer las tablas. Acá se lee con `service_role` y se devuelve **sólo lo armado** (los renglones
 * del bloque), nunca las filas crudas. El guard de sesión va primero (A-SEC-06) y después el permiso del bloque: admin,
 * o el rol `ma` con ese bloque prendido en Configuración → Roles (el candado del Principal en «Ver como lo ve él»).
 *
 *   GET ?que=impuestos&empresa=MA|MSA|PAM&anio=2026 → { datos: MisImpuestos }
 *   GET ?que=arrendamientos                          → { datos: MisArrendamientos }   (siempre MA)
 *   GET ?que=lo-que-viene                            → { datos: LoQueViene }          (siempre MA)
 *
 * No escribe nada.
 */
const EMPRESA = "MA"

export async function GET(req: Request) {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })

  const url = new URL(req.url)
  const que = url.searchParams.get("que") as BloqueMiPantalla | null
  if (!que || !(que in RECURSO_BLOQUE)) return NextResponse.json({ ok: false, error: "Bloque desconocido." }, { status: 400 })
  const [secciones, niveles] = g.rol === "admin" ? [[], {}] : await Promise.all([seccionesDelRol(g.rol), nivelesDe(g.rol)])
  if (!puedeVerBloque(g.rol, secciones, niveles, que)) {
    return NextResponse.json({ ok: false, error: "Este bloque no está habilitado para tu cuenta." }, { status: 403 })
  }

  const hoy = hoyArgentina()
  try {
    if (que === "impuestos") {
      const empresa = url.searchParams.get("empresa") ?? EMPRESA
      if (!esEmpresaMiPantalla(empresa)) return NextResponse.json({ ok: false, error: "Empresa desconocida." }, { status: 400 })
      if (!puedeVerEmpresa(g.rol, niveles as Record<string, string>, empresa)) {
        return NextResponse.json({ ok: false, error: `Los impuestos de ${empresa} no están habilitados para tu cuenta.` }, { status: 403 })
      }
      const anio = Number(url.searchParams.get("anio") ?? hoy.slice(0, 4))
      if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return NextResponse.json({ ok: false, error: "Año inválido." }, { status: 400 })
      const cuotas = await cargarCuotasImpuestos(supabaseAdmin)
      return NextResponse.json({ ok: true, hoy, datos: misImpuestosDelAnio(cuotas, empresa, anio, hoy) })
    }
    if (que === "arrendamientos") {
      return NextResponse.json({ ok: true, hoy, datos: misArrendamientos(await leerArrendamientos(), hoy) })
    }
    // 📈 Lo que viene: lo que falta cobrar de los arrendamientos contra los impuestos de MA sin pagar.
    const [entrada, cuotas] = await Promise.all([leerArrendamientos(), cargarCuotasImpuestos(supabaseAdmin)])
    const arr = misArrendamientos(entrada, hoy)
    const ingresos = arr.contratos.flatMap(k => k.porCobrar.map(p => ({ fecha: p.fecha, concepto: `Arrendamiento ${k.campania} · ${p.concepto}`, monto: p.monto })))
    const anio = Number(hoy.slice(0, 4))
    const egresos = impuestosSinPagar(cuotasDeEmpresa(cuotas, EMPRESA), [anio - 1, anio, anio + 1], hoy)
    return NextResponse.json({ ok: true, hoy, datos: loQueViene(ingresos, egresos, hoy) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
