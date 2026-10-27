/**
 * 📥 POST /api/contador/ddjj — recibe el zip del libro IVA que devuelve el contador, lo guarda y lo controla (A-AUTO-09).
 *
 * Dos caminos, la misma función (`procesarLibroPresentado`):
 *   · la PANTALLA (Subdiarios → «Lo que devolvió el contador»): multipart con `archivo`; sesión + escritura en Subdiarios.
 *   · el GAS que lee la respuesta del contador en Gmail: JSON `{ archivo, base64 }` con el header
 *     `x-token-contador` = `CONTADOR_TOKEN` (env). Sin sesión: el GAS no tiene una.
 * Sólo MSA está inscripta en IVA: la empresa es MSA.
 */
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { exigirEscritura } from "@/lib/auth/guard-recurso"
import { procesarLibroPresentado } from "@/lib/subdiarios/contador"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const token = req.headers.get("x-token-contador")
  const desdeGas = !!token && !!process.env.CONTADOR_TOKEN && token === process.env.CONTADOR_TOKEN
  let cargadoPor: string | null = "GAS (respuesta del contador)"
  if (!desdeGas) {
    const sesion = await exigirSesion()
    if (!sesion.ok) return respuestaSinAcceso(sesion)
    const ok = await exigirEscritura("egresos.subdiarios")
    if (!ok.ok) return NextResponse.json({ error: ok.motivo }, { status: ok.status })
    cargadoPor = (sesion as any).user?.email ?? "usuario"
  }
  try {
    let datos: Uint8Array, archivo: string
    if (desdeGas) {
      const b = await req.json()
      datos = Uint8Array.from(Buffer.from(String(b.base64 ?? ""), "base64"))
      archivo = String(b.archivo ?? "zip del mail del contador")
    } else {
      const fd = await req.formData()
      const f = fd.get("archivo") as File | null
      if (!f) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 })
      datos = new Uint8Array(await f.arrayBuffer())
      archivo = f.name
    }
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const r = await procesarLibroPresentado(db, { empresa: "MSA", schema: "msa", datos, archivo, origen: desdeGas ? "mail" : "subida", cargadoPor })
    return NextResponse.json({ ok: true, ...r, comparacion: { totales: r.comparacion.totales, ok: r.comparacion.ok } })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
