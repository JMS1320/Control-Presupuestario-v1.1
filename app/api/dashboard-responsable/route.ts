import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { nivelesDe, seccionesDelRol } from "@/lib/auth/permisos"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { CUENTAS_BANCARIAS } from "@/lib/conciliacion/cuentas-bancarias"
import { EMPRESAS_DASHBOARD } from "@/lib/dashboard/canales"
import { leerDatosPorResponsable, leerSaldosDeCanales } from "@/lib/dashboard/leer-responsable"
import { atribuirTodo, resultadoParaRuta, CUENTA_DESDE } from "@/lib/dashboard/responsable"
import { puedeVerPorResponsable } from "@/lib/dashboard/permiso-responsable"

/**
 * 👥 El Dashboard «Por responsable» y la cuenta entre socios, ARMADOS en el servidor — A-FEAT-1637 (etapa B3). SÓLO LEE.
 *
 * JMS 22/11: *«ella debería ver todas sus cuentas»*. El rol de MA no puede (ni debe) leer los canales de MSA y PAM, pero lo que
 * MSA pagó por ella está ahí. Por eso se lee con `service_role` y se devuelve **sólo lo armado** (`resultadoParaRuta`): para un rol
 * que no es admin, lo de MA y nada más — sus 4 secciones (con lo que pagó otro), lo financiado y lo pagado por cuenta de socios, y
 * las cuentas de los pares en los que ella es una punta. Nunca un gasto propio de MSA o PAM, nunca un par en el que no está, nunca
 * la fila cruda del banco.
 *
 * Guard de sesión primero (A-SEC-06), después el permiso: admin, o un rol con la sección Dashboard y los candados
 * `dashboard.por-responsable` y `dashboard.empresa-ma` prendidos (Configuración → Roles).
 *
 *   GET ?anio=2026&semestre=1|2&empresas=MSA,MA[&como=ma]
 *     · admin: las empresas pedidas y las cuentas de todos los pares; con `como=ma` («Ver como lo ve ella») lo mismo que recibe MA.
 *     · otro rol: siempre MA.
 */
export async function GET(req: Request) {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })

  const esAdmin = g.rol === "admin"
  if (!esAdmin) {
    const [secciones, niveles] = await Promise.all([seccionesDelRol(g.rol), nivelesDe(g.rol)])
    if (!puedeVerPorResponsable(g.rol, secciones, niveles as Record<string, string>)) {
      return NextResponse.json({ ok: false, error: "La vista «Por responsable» no está habilitada para tu cuenta." }, { status: 403 })
    }
  }

  const url = new URL(req.url)
  const anio = Number(url.searchParams.get("anio"))
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return NextResponse.json({ ok: false, error: "Año inválido." }, { status: 400 })
  const semTxt = url.searchParams.get("semestre")
  const semestre = semTxt ? Number(semTxt) : undefined
  if (semestre !== undefined && semestre !== 1 && semestre !== 2) return NextResponse.json({ ok: false, error: "Semestre inválido." }, { status: 400 })
  const pedidas = (url.searchParams.get("empresas") ?? "MA").split(",").map(e => e.trim().toUpperCase()).filter(Boolean)
  if (!pedidas.length || pedidas.some(e => !(EMPRESAS_DASHBOARD as readonly string[]).includes(e))) {
    return NextResponse.json({ ok: false, error: "Empresa desconocida." }, { status: 400 })
  }
  const soloMA = !esAdmin || url.searchParams.get("como") === "ma"

  const desde = semestre === 2 ? `${anio}-07-01` : `${anio}-01-01`
  const hasta = semestre === 1 ? `${anio}-06-30` : `${anio}-12-31`
  try {
    const [d, sal] = await Promise.all([
      leerDatosPorResponsable(supabaseAdmin, CUENTAS_BANCARIAS, desde < CUENTA_DESDE ? desde : CUENTA_DESDE, hasta),
      // 🏦 Los saldos de SUS cuentas (o de las empresas pedidas), para el control contra bancos.
      leerSaldosDeCanales(supabaseAdmin, CUENTAS_BANCARIAS, soloMA ? ["MA"] : pedidas, desde, hasta),
    ])
    const at = atribuirTodo(d.movs, d.cuentas, d.templates, d.ctx, { sinCaja: d.sinCaja })
    const datos = resultadoParaRuta(at, pedidas, soloMA, desde, hasta, d.cuentas, d.templates, d.desdeCanal, sal.saldos)
    return NextResponse.json({ ok: true, datos, problemas: [...d.problemas, ...sal.problemas] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
