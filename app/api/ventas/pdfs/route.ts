/**
 * POST /api/ventas/pdfs — los PDFs de las ventas en el Drive (A-FEAT-1578).
 *
 *   accion 'listar'   `{ empresa, carpetas: string[][] }` → `{ ok, archivos: [{file_id, archivo, url, carpeta}], faltan: string[] }`
 *                     Lista (sin OCR, sólo lee) cada carpeta «<campaña>/<aa-mm>/- Ventas» que manda la pantalla.
 *   accion 'borrador' `{ para?, asunto, texto, file_ids }` → deja en Gmail un BORRADOR con esos PDFs adjuntos (GAS ≥ 0.25.0).
 *                     No envía nada: el usuario lo revisa y lo manda desde Gmail.
 *
 * Env: GAS_BUSCAR_PDF_URL, GAS_AUTH_TOKEN, GAS_FOLDER_ID_{MSA,PAM,MA}.
 */
import { NextResponse } from "next/server"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { pedirAlGas } from "@/lib/gas-pdf/gas-http"

export const runtime = "nodejs"
export const maxDuration = 60

const carpetaDe = (e: string) => e === "PAM" ? process.env.GAS_FOLDER_ID_PAM : e === "MA" ? process.env.GAS_FOLDER_ID_MA : e === "MSA" ? process.env.GAS_FOLDER_ID_MSA : undefined

export async function POST(request: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)
  const url = process.env.GAS_BUSCAR_PDF_URL, token = process.env.GAS_AUTH_TOKEN
  if (!url || !token) return NextResponse.json({ ok: false, error: "GAS_BUSCAR_PDF_URL o GAS_AUTH_TOKEN no configurados" }, { status: 500 })
  let body: any = {}
  try { body = await request.json() } catch { /* vacío */ }

  try {
    if (body.accion === "listar") {
      const raiz = carpetaDe(String(body.empresa))
      if (!raiz) return NextResponse.json({ ok: false, error: "empresa inválida o sin carpeta configurada" }, { status: 400 })
      const rutas: string[][] = Array.isArray(body.carpetas) ? body.carpetas.filter((c: unknown) => Array.isArray(c)).slice(0, 36) : []
      const unicas = [...new Map(rutas.map(r => [r.join("/"), r.map(String)])).values()]
      const archivos: any[] = [], faltan: string[] = []
      // de a 6 carpetas a la vez: cada listar es un viaje al Drive
      for (let i = 0; i < unicas.length; i += 6) {
        const tanda = await Promise.all(unicas.slice(i, i + 6).map(async subs => {
          const j = await pedirAlGas(url, { _token: token, accion: "listar", carpeta_drive_id: raiz, subcarpetas: subs }, "listar ventas", 40_000)
          return { subs, j }
        }))
        for (const { subs, j } of tanda) {
          if (j?.status !== "ok") throw new Error(j?.observaciones || `El GAS no pudo listar ${subs.join("/")}`)
          if (!j.existe) { faltan.push(subs.join("/")); continue }
          for (const a of j.archivos ?? []) archivos.push({ ...a, carpeta: subs.join("/") })
        }
      }
      return NextResponse.json({ ok: true, archivos, faltan })
    }

    if (body.accion === "borrador") {
      const ids: string[] = Array.isArray(body.file_ids) ? body.file_ids.map(String).filter(Boolean).slice(0, 60) : []
      if (!ids.length) return NextResponse.json({ ok: false, error: "No hay PDFs para adjuntar" }, { status: 400 })
      if (!body.asunto) return NextResponse.json({ ok: false, error: "Falta el asunto" }, { status: 400 })
      const j = await pedirAlGas(url, { _token: token, accion: "borrador_con_adjuntos", para: String(body.para ?? ""), asunto: String(body.asunto), texto: String(body.texto ?? ""), file_ids: ids }, "borrador con adjuntos", 55_000)
      if (j?.status === "ok") return NextResponse.json({ ok: true, adjuntos: j.adjuntos, mb: j.mb })
      // un GAS viejo no conoce la acción y cae en la búsqueda de facturas, que pide `factura_id`
      if (!j?.observaciones || /Campo requerido faltante|desconocida/i.test(String(j.observaciones)))
        return NextResponse.json({ ok: false, error: "El GAS publicado todavía no sabe armar borradores con adjuntos: publicá la versión 0.25.0 (Implementar → Nueva versión)." }, { status: 502 })
      return NextResponse.json({ ok: false, error: j.observaciones }, { status: 502 })
    }

    return NextResponse.json({ ok: false, error: "acción desconocida" }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 })
  }
}
