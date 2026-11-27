/**
 * POST /api/facturas/leer-detalle — lee el DETALLE (artículo por artículo) de una factura desde su PDF archivado y lo guarda
 * con su control (A-FEAT-1651 etapa 2). `{ empresa, comprobante_id }` → `{ ok, estado, renglones, mensajes }`.
 *
 * El texto del PDF lo da el GAS (`leer_archivo`, el mismo del buscador de facturas); los renglones, `leerDetalleFactura`.
 * Guarda en `factura_lecturas` (una fila por factura) y `factura_renglones` (uno por artículo, con `leido` = lo leído).
 * 🛑 Si algún renglón ya fue CORREGIDO a mano, no se pisa nada (la corrección manda: CLAUDE.md § 📄 huella).
 */
import { NextResponse } from "next/server"
import { clienteUsuario } from "@/lib/supabase-usuario"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { leerDetalleFactura } from "@/lib/facturas-detalle/leer-detalle"
import { fileIdDeDrive, filasDeLectura } from "@/lib/facturas-detalle/insumos"

export const runtime = "nodejs"
export const maxDuration = 60

const schemaDe = (e: string) => (e === "PAM" ? "pam" : e === "MA" ? "ma" : "msa")

export async function POST(request: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  const supabase: any = await clienteUsuario()
  const quien = sesion.user.email || null
  let b: { empresa?: string; comprobante_id?: string } = {}
  try { b = await request.json() } catch { /* vacío */ }
  const empresa = ["MSA", "PAM", "MA"].includes(String(b.empresa)) ? String(b.empresa) : "MSA"
  const id = String(b.comprobante_id || "")
  if (!id) return NextResponse.json({ ok: false, error: "Falta la factura." }, { status: 400 })

  const { data: f, error: eF } = await supabase.schema(schemaDe(empresa)).from("comprobantes_arca")
    .select("id, cuit, imp_total, moneda, pdf_drive_url").eq("id", id).maybeSingle()
  if (eF || !f) return NextResponse.json({ ok: false, error: "No encontré la factura." }, { status: 404 })

  const { data: corregidos } = await supabase.from("factura_renglones").select("id").eq("empresa", empresa).eq("comprobante_id", id).not("corregido_at", "is", null).limit(1)
  if ((corregidos || []).length) return NextResponse.json({ ok: false, error: "Esta factura tiene renglones corregidos a mano: no se vuelve a leer para no pisarlos." }, { status: 409 })

  const guardarSinTexto = async (estado: "sin-pdf" | "sin-texto", msg: string, fileId: string | null) => {
    await supabase.from("factura_lecturas").upsert({ empresa, comprobante_id: id, file_id: fileId, estado, mensajes: [msg], no_leido: [], leido_at: new Date().toISOString(), leido_por: quien, updated_at: new Date().toISOString() }, { onConflict: "empresa,comprobante_id" })
    return NextResponse.json({ ok: true, estado, renglones: 0, mensajes: [msg] })
  }
  const fileId = fileIdDeDrive(f.pdf_drive_url)
  if (!fileId) return guardarSinTexto("sin-pdf", "La factura no tiene su PDF archivado (📎).", null)

  const url = process.env.GAS_BUSCAR_PDF_URL, token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  let texto = ""
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _token: token, accion: "leer_archivo", file_id: fileId }), signal: AbortSignal.timeout(50_000) })
    const j = JSON.parse(await r.text())
    texto = String(j?.texto || "")
  } catch (e) {
    return NextResponse.json({ ok: false, error: `No se pudo leer el PDF: ${(e as Error).message}` }, { status: 502 })
  }
  if (texto.trim().length < 40) return guardarSinTexto("sin-texto", "El PDF no tiene texto legible (foto o escaneo).", fileId)

  const total = Math.abs(Number(f.imp_total) || 0) || null
  const d = leerDetalleFactura(texto, { cuit: f.cuit, totalConocido: total })
  const { lectura, renglones } = filasDeLectura(empresa, id, fileId, d, quien)
  const { error: eL } = await supabase.from("factura_lecturas").upsert(lectura, { onConflict: "empresa,comprobante_id" })
  if (eL) return NextResponse.json({ ok: false, error: "No se pudo guardar la lectura: " + eL.message }, { status: 500 })
  const { error: eD } = await supabase.from("factura_renglones").delete().eq("empresa", empresa).eq("comprobante_id", id)
  if (eD) return NextResponse.json({ ok: false, error: "No se pudo reemplazar el detalle anterior: " + eD.message }, { status: 500 })
  if (renglones.length) {
    const { error: eR } = await supabase.from("factura_renglones").insert(renglones)
    if (eR) return NextResponse.json({ ok: false, error: "No se pudieron guardar los renglones: " + eR.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, estado: d.control.estado, renglones: renglones.length, mensajes: d.control.mensajes })
}
