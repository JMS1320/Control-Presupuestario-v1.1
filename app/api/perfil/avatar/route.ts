import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"

const BUCKET = "avatares"
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/**
 * POST — subir tu foto de perfil.
 *
 * No es un endpoint de admin: **cualquier usuario con rol sube la suya**. Por eso no usa
 * `exigirAdmin()`, pero sí repite el chequeo de sesión por su cuenta — este handler usa
 * `service_role`, que ignora la RLS, así que no puede depender sólo del middleware (A-SEC-06).
 *
 * ⚠️ **La ruta del archivo la arma el servidor con el `user.id` de la sesión, nunca el cliente.**
 * Si el nombre viniera del navegador, cualquiera podría mandar `../otro-usuario/avatar` y pisarle
 * la foto a otro. Al derivarla del JWT validado, no hay forma de escribir fuera de tu carpeta.
 *
 * El archivo se guarda siempre en la misma ruta (`<id>/avatar`, sin extensión) y se sobrescribe:
 * así no quedan archivos huérfanos de fotos viejas ni hace falta borrar nada. La caché del CDN se
 * evita con el `?v=` que se agrega a la URL.
 */
export async function POST(request: Request) {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sin sesión." }, { status: 401 })
  }
  // Una cuenta que existe pero todavía no fue habilitada no sube nada.
  if (!getRole(user)) {
    return NextResponse.json({ error: "Cuenta sin rol asignado." }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const archivo = form?.get("archivo")

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "No llegó ningún archivo." }, { status: 400 })
  }
  if (!TIPOS_OK.includes(archivo.type)) {
    return NextResponse.json(
      { error: "Tiene que ser una imagen JPG, PNG, WEBP o GIF." },
      { status: 415 }
    )
  }
  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return NextResponse.json(
      { error: `La imagen pesa ${mb} MB y el máximo son 2 MB.` },
      { status: 413 }
    )
  }

  const ruta = `${user.id}/avatar`

  const { error: errSubida } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: true })

  if (errSubida) {
    // El caso más probable en la primera vez: el bucket no existe todavía (falta scripts/59).
    const falta = /bucket|not found/i.test(errSubida.message)
    return NextResponse.json(
      {
        error: falta
          ? "Falta crear el bucket de fotos en la base (scripts/59-storage-avatares.sql)."
          : "No se pudo subir la imagen.",
      },
      { status: falta ? 503 : 500 }
    )
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta)

  // `?v=` rompe la caché del CDN: la ruta es siempre la misma, así que sin esto el navegador
  // seguiría mostrando la foto anterior después de cambiarla.
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` })
}
