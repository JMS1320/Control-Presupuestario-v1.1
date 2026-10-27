/**
 * 🔄 POST /api/polizas/sincronizar — pone al día el template de cada póliza con lo que espera el banco (A-FEAT-1385).
 *
 * La usa el botón «Actualizar desde las pólizas» de Egresos → Seguros. La importación del extracto y la carga de
 * pólizas llaman a la misma función (`lib/polizas/sincronizar.ts`) por su cuenta. Con `?simular=1` no escribe.
 */
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { exigirEscritura } from "@/lib/auth/guard-recurso"
import { sincronizarPolizas } from "@/lib/polizas/sincronizar"

export async function POST(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  const simular = new URL(req.url).searchParams.get("simular") === "1"
  if (!simular) {
    const ok = await exigirEscritura("egresos.seguros")
    if (!ok.ok) return NextResponse.json({ error: ok.motivo }, { status: ok.status })
  }
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const resultado = await sincronizarPolizas(db, { simular })
    return NextResponse.json({ ok: true, simular, ...resultado })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
