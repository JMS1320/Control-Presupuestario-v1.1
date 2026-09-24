import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClientServer } from "@/lib/supabase-server"
import { getRole } from "@/lib/auth/roles"
import { traerImagenRemota } from "@/lib/red/traer-imagen-remota"

const BUCKET = "avatares"
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"]

/** El mismo mensaje para las dos vías: el límite es del sistema, no de por dónde entró la foto. */
const MSG_TIPO = "Tiene que ser una imagen JPG, PNG, WEBP o GIF."

/**
 * POST — subir tu foto de perfil.
 *
 * **Una sola entrada para las dos formas de dar una foto** (A-FEAT-83): en el `FormData` puede
 * venir `archivo` (lo que se eligió, se arrastró o se pegó) **o** `url` (un link pegado). Las dos
 * terminan en el mismo lugar y con las mismas validaciones — el link **no se guarda como link**:
 * se descarga y la imagen queda en nuestro Storage. Motivo largo en `traerImagenRemota()`; el
 * corto es que la CSP bloquea las imágenes de dominios ajenos **en silencio**, así que guardar el
 * link daría un avatar que no se ve y ningún error que lo explique.
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
  const link = form?.get("url")

  /** Lo que se va a guardar, venga de donde venga. */
  let contenido: File | ArrayBuffer
  let tipo: string

  if (archivo instanceof File) {
    if (!TIPOS_OK.includes(archivo.type)) {
      return NextResponse.json({ error: MSG_TIPO }, { status: 415 })
    }
    if (archivo.size > MAX_BYTES) {
      const mb = (archivo.size / 1024 / 1024).toFixed(1)
      return NextResponse.json(
        { error: `La imagen pesa ${mb} MB y el máximo son 2 MB.` },
        { status: 413 }
      )
    }
    contenido = archivo
    tipo = archivo.type
  } else if (typeof link === "string" && link.trim()) {
    const traida = await traerImagenRemota(link, MAX_BYTES)
    if (!traida.ok) {
      return NextResponse.json({ error: traida.error }, { status: traida.status })
    }
    if (!TIPOS_OK.includes(traida.tipo)) {
      // Pasa seguido: se pega el link de la *página* donde está la foto y no el de la foto. El
      // mensaje lo dice, porque «tipo no soportado» no le explica a nadie qué hacer distinto.
      return NextResponse.json(
        {
          error: traida.tipo.startsWith("text/")
            ? "Ese link es de una página, no de una imagen. Probá con «Copiar dirección de la imagen»."
            : MSG_TIPO,
        },
        { status: 415 }
      )
    }
    contenido = traida.bytes
    tipo = traida.tipo
  } else {
    return NextResponse.json({ error: "No llegó ningún archivo ni ningún link." }, { status: 400 })
  }

  const ruta = `${user.id}/avatar`

  const { error: errSubida } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(ruta, contenido, { contentType: tipo, upsert: true })

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
