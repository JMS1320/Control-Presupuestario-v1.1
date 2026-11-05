import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { supabaseAdmin, faltaConfiguracionAdmin } from "@/lib/supabase-admin"

/**
 * 📎 El COMPROBANTE adjunto a un pago informado (A-FEAT-1560). Vive dentro de la propuesta (`propuestas_cambio.cambios
 * .comprobante`, data URL), igual que las capturas de las notas. Lo ve quien lo informó o un admin; nadie más.
 *   GET ?id=<propuesta>  → el archivo (imagen o PDF), para abrir en otra pestaña
 */
export async function GET(req: Request) {
  const g = await exigirSesion()
  if (!g.ok) return respuestaSinAcceso(g)
  const falta = faltaConfiguracionAdmin()
  if (falta) return NextResponse.json({ ok: false, error: falta }, { status: 500 })
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 })
  const { data, error } = await supabaseAdmin.from("propuestas_cambio")
    .select("persona, cambios").eq("id", id).eq("tabla", "cuotas_egresos_sin_factura").single()
  if (error || !data) return NextResponse.json({ ok: false, error: "No se encontró." }, { status: 404 })
  const mail = (g.user.email ?? "").toLowerCase()
  if (g.rol !== "admin" && (data.persona ?? "").toLowerCase() !== mail) return NextResponse.json({ ok: false, error: "No es tuyo." }, { status: 403 })
  const c = (data.cambios as { comprobante?: { nombre: string; tipo: string; data: string } } | null)?.comprobante
  if (!c?.data) return NextResponse.json({ ok: false, error: "Sin comprobante." }, { status: 404 })
  const [, b64] = c.data.split(",")
  return new NextResponse(Buffer.from(b64 ?? "", "base64"), {
    headers: { "Content-Type": c.tipo, "Content-Disposition": `inline; filename="${encodeURIComponent(c.nombre)}"`, "Cache-Control": "private, no-store" },
  })
}
