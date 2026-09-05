"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, ShieldAlert, Upload } from "lucide-react"

function iniciales(nombre: string, email: string): string {
  const limpio = nombre.trim()
  if (limpio) {
    const partes = limpio.split(/\s+/).filter(Boolean)
    if (partes.length >= 2) return (partes[0]![0]! + partes[1]![0]!).toUpperCase()
    if (partes[0]) return partes[0].slice(0, 2).toUpperCase()
  }
  const local = email.split("@")[0]
  return local ? local.slice(0, 2).toUpperCase() : "?"
}

/**
 * Tu perfil: lo que se puede cambiar de tu propia cuenta.
 *
 * Se escribe en `user_metadata` con `auth.updateUser()`, que sólo puede tocar **tu** usuario —
 * no hace falta ningún endpoint de admin.
 *
 * ⚠️ Por eso mismo `user_metadata` **no sirve para permisos**: si el propio usuario lo puede
 * editar, el rol tiene que vivir en `app_metadata` (ver `MODULO_USUARIOS.md`). Acá sólo van
 * nombre y foto, que son cosméticos, y el rol se muestra como dato de sólo lectura.
 */
export function PanelPerfil({ userRole }: { userRole: "admin" | "contable" }) {
  const [email, setEmail] = useState("")
  const [nombre, setNombre] = useState("")
  const [foto, setFoto] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [tiene2FA, setTiene2FA] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (cancelado) return
      setEmail(u?.email ?? "")
      setNombre((u?.user_metadata?.full_name as string) ?? "")
      setFoto((u?.user_metadata?.avatar_url as string) ?? "")
      setCargando(false)

      const { data: factores } = await supabase.auth.mfa.listFactors()
      if (!cancelado) setTiene2FA((factores?.totp?.length ?? 0) > 0)
    })()
    return () => { cancelado = true }
  }, [])

  /**
   * Subir una imagen de la computadora.
   *
   * El archivo va a `/api/perfil/avatar`, que lo valida y lo guarda en Storage. La URL que
   * devuelve se guarda al toque en tu perfil: subir una foto y que no se vea hasta apretar otro
   * botón es una trampa — el resultado esperado de elegir la foto es tener la foto.
   */
  async function subirArchivo(archivo: File) {
    setSubiendo(true)
    const cuerpo = new FormData()
    cuerpo.append("archivo", archivo)

    const res = await fetch("/api/perfil/avatar", { method: "POST", body: cuerpo })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setSubiendo(false)
      // El mensaje viene del endpoint: dice el motivo real (tipo, tamaño, o que falta el bucket).
      toast.error(json.error ?? "No se pudo subir la imagen.")
      return
    }

    const { error } = await supabase.auth.updateUser({ data: { avatar_url: json.url } })
    setSubiendo(false)
    if (error) {
      toast.error("Se subió la imagen pero no se pudo guardar en tu perfil.")
      return
    }
    setFoto(json.url)
    toast.success("Foto actualizada.")
    setTimeout(() => window.location.reload(), 600)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nombre.trim() || null, avatar_url: foto.trim() || null },
    })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo guardar.")
      return
    }
    // Recarga para que el avatar de la barra tome los datos nuevos: los lee al montarse.
    toast.success("Perfil guardado.")
    setTimeout(() => window.location.reload(), 600)
  }

  if (cargando) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cargando tu perfil…</CardContent></Card>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card className="entrada-suave">
        <CardHeader><CardTitle className="text-base">Tus datos</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={guardar} className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {foto.trim() && <AvatarImage src={foto.trim()} alt="" />}
                <AvatarFallback className="bg-slate-200 text-lg font-semibold text-slate-700">
                  {iniciales(nombre, email)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Así te ven. Sin foto se muestran tus iniciales.
                </p>
                <div className="flex items-center gap-2">
                  {/* El input real va oculto: el de archivos que trae el navegador no se puede
                      estilar y queda fuera de lugar al lado de los demás controles. */}
                  <input
                    ref={inputArchivo}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      // Se limpia el input para que elegir DOS VECES el mismo archivo vuelva a
                      // disparar el `change` — si no, el segundo intento no hace nada.
                      e.target.value = ""
                      if (f) void subirArchivo(f)
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={subiendo}
                    onClick={() => inputArchivo.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {subiendo ? "Subiendo…" : "Subir una imagen"}
                  </Button>
                  {foto.trim() && !subiendo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setFoto("")}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o GIF · hasta 2 MB.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre y apellido"
              />
              <p className="text-xs text-muted-foreground">
                Si lo cargás, las iniciales salen de acá en vez de tu mail.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="foto">…o pegar la dirección de una imagen</Label>
              <Input
                id="foto"
                value={foto}
                onChange={(e) => setFoto(e.target.value)}
                placeholder="https://…"
              />
              <p className="text-xs text-muted-foreground">
                Alternativa a subir el archivo: si la foto ya está publicada en algún lado, se pega
                acá y se aprieta <strong>Guardar cambios</strong>. Subir un archivo, en cambio, se
                guarda solo.
              </p>
            </div>

            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="entrada-suave">
          <CardHeader><CardTitle className="text-base">Tu cuenta</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Mail</div>
              <div className="break-all font-medium">{email}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                No se cambia desde acá: es con lo que entrás.
              </p>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Rol</div>
              <div className="font-medium">{userRole}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Lo asigna un administrador. Nadie puede cambiarse el suyo.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="entrada-suave">
          <CardHeader><CardTitle className="text-base">Segundo factor</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {tiene2FA === null ? (
              <span className="text-muted-foreground">Consultando…</span>
            ) : tiene2FA ? (
              <div className="flex items-start gap-2 text-emerald-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Activado. Te pide el código de 6 dígitos al entrar.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-amber-700">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Sin activar.
                    {userRole === "admin" && " Para una cuenta de administrador es obligatorio."}
                  </span>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/login/2fa/alta">Activar</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
