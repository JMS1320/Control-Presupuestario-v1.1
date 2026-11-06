/**
 * 🔁 /api/respaldo/espejo — A-FEAT-1571 paso 3: trae del espejo de Ulises a la carpeta segura lo que falte, y lo vincula.
 *
 * JMS 06/11: «bancos y entidades es la que va. Lo que podemos hacer es que el sistema copie a la carpeta segura. Ulises debería
 * trabajar desde un espejo y el sistema llevarlo adentro conservando el espejo».
 *
 * 1. El GAS LISTA el espejo (sólo lee).
 * 2. `planDelEspejo` decide, por el nombre, qué falta (cuenta + mes que no están en `documentos_respaldo`).
 * 3. El GAS COPIA cada uno a «BANCO GALICIA SM / extractos AA-AA / <subcarpeta>» (sin pisar; nunca mueve ni borra el espejo).
 * 4. Se VINCULA cada copia en `documentos_respaldo` (marca «[espejo]» en creado_por).
 * 5. Avisa qué cuentas no tienen todavía el resumen del mes anterior (la alerta ANTES) y qué archivos no siguen el nombre.
 *
 * POST: desde la pantalla (sesión con permiso de importar extractos). GET: para una tarea programada (header
 * `Authorization: Bearer <CRON_SECRET>`). Necesita el GAS 0.24.0. Sólo MSA.
 */
import { NextResponse } from "next/server"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"
import { exigirEscritura } from "@/lib/auth/guard-recurso"
import { planDelEspejo, resumenesQueFaltan } from "@/lib/balance/espejo-ulises"
import { hoyArgentina } from "@/lib/cotizaciones/parsers"

export const runtime = "nodejs"
export const maxDuration = 60

/** «Subdiarios - Documentacion (Ulises) / Martinez Sobrado Agro S.R.L / Banco Galicia / Resumenes y extractos» (id del Drive). */
const ESPEJO_GALICIA_MSA = "1HTuQIw2fZSCSEavEFfR9D8w850J1p2Jt"
const DESTINO_GALICIA_MSA = "I:/Mi unidad/SAN MANUEL/BANCOS y entidades financieras/BANCO GALICIA SM"

async function gas(cuerpo: Record<string, unknown>) {
  const url = process.env.GAS_BUSCAR_PDF_URL, token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return { ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cuerpo, _token: token }), signal: AbortSignal.timeout(55_000) })
    const txt = await r.text()
    const j = JSON.parse(txt)
    if (j?.ok === undefined) return { ok: false, error: "El GAS desplegado no conoce esta acción: subí la versión 0.24.0." }
    return j
  } catch (e) {
    return { ok: false, error: `No se pudo hablar con el GAS: ${(e as Error).message}` }
  }
}

async function traer() {
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })

  const lista = await gas({ accion: "respaldo_listar", origen_id: ESPEJO_GALICIA_MSA })
  if (!lista.ok) return NextResponse.json(lista, { status: 502 })

  const { data: vinc, error } = await supabaseAdmin.from("documentos_respaldo").select("cuenta, periodo, tipo").eq("empresa", "MSA")
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const vinculados = (vinc ?? []) as Array<{ cuenta: string; periodo: string; tipo: string }>

  const plan = planDelEspejo(lista.archivos ?? [], vinculados)
  let vinculadosAhora = 0, pendientes = 0
  const errores: string[] = []
  if (plan.copiar.length) {
    const j = await gas({ accion: "respaldo_copiar", destino_ruta: DESTINO_GALICIA_MSA,
      items: plan.copiar.map(c => ({ file_id: c.file_id, subcarpeta: c.subcarpeta, nombre: c.nombre })) })
    if (!j.ok) return NextResponse.json(j, { status: 502 })
    pendientes = (j.pendientes ?? []).length
    for (const e of j.errores ?? []) errores.push(`${e.nombre}: ${e.error}`)
    const hechos = [...(j.copiados ?? []), ...(j.ya_estaban ?? [])] as Array<{ file_id: string; url: string; nombre: string; subcarpeta: string; origen_id: string }>
    const filas = hechos.map(h => {
      const p = plan.copiar.find(c => c.file_id === h.origen_id)
      return p && {
        empresa: "MSA", cuenta: p.cuenta, periodo: p.periodo, tipo: p.tipo, drive_file_id: h.file_id, url: h.url, nombre_archivo: h.nombre,
        ruta_drive: `BANCOS y entidades financieras / BANCO GALICIA SM / ${h.subcarpeta.replace(/\//g, " / ")}`,
        observaciones: "copia del espejo de Ulises (automática)", creado_por: `[espejo] sistema · ${hoyArgentina()}`,
      }
    }).filter(Boolean)
    if (filas.length) {
      const ins = await supabaseAdmin.from("documentos_respaldo").upsert(filas as object[], { onConflict: "empresa,cuenta,periodo,tipo", ignoreDuplicates: true })
      if (ins.error) errores.push(`vincular: ${ins.error.message}`)
      else vinculadosAhora = filas.length
    }
  }
  const todos = [...vinculados, ...plan.copiar.slice(0, vinculadosAhora)]
  return NextResponse.json({
    ok: true, copiados: plan.copiar.length - pendientes, vinculados: vinculadosAhora, pendientes, errores,
    sin_regla: plan.sinRegla, faltan: resumenesQueFaltan(todos, hoyArgentina()),
  })
}

export async function POST() {
  const ok = await exigirEscritura("extracto.importar")
  if (!ok.ok) return NextResponse.json({ ok: false, error: ok.motivo }, { status: ok.status })
  return traer()
}

/** Para una tarea programada (Vercel Cron): sólo con el secreto. */
export async function GET(req: Request) {
  const s = process.env.CRON_SECRET
  if (!s || req.headers.get("authorization") !== `Bearer ${s}`) return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 })
  return traer()
}
