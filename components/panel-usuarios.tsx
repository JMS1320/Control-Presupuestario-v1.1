"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

type Usuario = {
  id: string
  email: string | null
  rol: string | null
  creado: string
  ultimoIngreso: string | null
  confirmado: boolean
  tiene2FA: boolean
  bloqueado: boolean
}

const FECHA = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"

export function PanelUsuarios({ miId }: { miId: string }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [email, setEmail] = useState("")
  const [rol, setRol] = useState<string>("contable")
  const [creando, setCreando] = useState(false)
  const [invitacion, setInvitacion] = useState<{ email: string; link: string } | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch("/api/admin/usuarios")
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? "No se pudo listar")
      setUsuarios(j.usuarios)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al listar")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    try {
      const r = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, rol }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? "No se pudo crear")
      setEmail("")
      toast.success(`Cuenta creada. Invitación enviada por mail a ${j.email}.`)
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear")
    } finally {
      setCreando(false)
    }
  }

  async function cambiarRol(id: string, nuevo: string) {
    const r = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: nuevo }),
    })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error ?? "No se pudo cambiar"); return }
    toast.success("Rol actualizado.")
    cargar()
  }

  async function revocar(id: string, email: string | null) {
    if (!confirm(`¿Revocar el acceso de ${email}?\n\nLa cuenta NO se borra: queda bloqueada y se puede reactivar cuando quieras.`)) return
    const r = await fetch(`/api/admin/usuarios/${id}`, { method: "DELETE" })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error ?? "No se pudo revocar"); return }
    toast.success("Acceso revocado.")
    cargar()
  }

  async function reactivar(id: string) {
    const r = await fetch(`/api/admin/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bloqueado: false }),
    })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error ?? "No se pudo reactivar"); return }
    toast.success("Acceso reactivado.")
    cargar()
  }

  /** Reenvía el acceso POR MAIL. Es el camino normal; el link es el respaldo. */
  async function reenviarMail(id: string) {
    const r = await fetch(`/api/admin/usuarios/${id}/mail`, { method: "POST" })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error ?? "No se pudo enviar"); return }
    toast.success(`Mail enviado a ${j.email}.`)
  }

  /** Respaldo: link nuevo para copiar, si el mail no llega o el envío está limitado. */
  async function generarLink(id: string) {
    const r = await fetch(`/api/admin/usuarios/${id}/link`, { method: "POST" })
    const j = await r.json()
    if (!r.ok) { toast.error(j.error ?? "No se pudo generar"); return }
    setInvitacion({ email: j.email, link: j.link })
    toast.success("Link nuevo generado.")
  }

  return (
    <div className="space-y-8">
      {/* ---------- alta ---------- */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-1 font-semibold">Crear cuenta</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          No se define ninguna contraseña acá: le llega una <strong>invitación por mail</strong> y
          la persona elige la suya. Así nadie conoce la clave de otro. Si el mail no llega, cada
          fila tiene <strong>Reenviar mail</strong> y <strong>Copiar link</strong>.
        </p>

        <form onSubmit={crear} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="email-nuevo">Email</Label>
            <Input
              id="email-nuevo" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="persona@dominio.com"
            />
          </div>
          <div className="w-48 space-y-2">
            <Label htmlFor="rol-nuevo">Rol</Label>
            <Select value={rol} onValueChange={setRol}>
              <SelectTrigger id="rol-nuevo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contable">Contable — sólo Egresos</SelectItem>
                <SelectItem value="admin">Admin — todo (exige 2FA)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={creando}>
            {creando ? "Creando…" : "Crear e invitar"}
          </Button>
        </form>

        {invitacion && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            <p className="font-medium">Link de acceso para {invitacion.email}</p>
            <p className="mb-2 text-xs text-amber-800">
              Respaldo para cuando el mail no llega. Es de <strong>un solo uso</strong> y vence:
              pasáselo por un canal privado.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={invitacion.link} className="font-mono text-xs" />
              <Button
                type="button" variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(invitacion.link)
                  toast.success("Link copiado.")
                }}
              >
                Copiar
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- lista ---------- */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-4 font-semibold">Cuentas ({usuarios.length})</h2>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>2FA</TableHead>
                <TableHead>Último ingreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const soyYo = u.id === miId
                return (
                  <TableRow key={u.id} className={u.bloqueado ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {u.email}
                      {soyYo && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}
                    </TableCell>
                    <TableCell>
                      {soyYo ? (
                        <span className="text-sm">{u.rol ?? "—"}</span>
                      ) : (
                        <Select value={u.rol ?? ""} onValueChange={(v) => cambiarRol(u.id, v)}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue placeholder="sin rol" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contable">contable</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.tiene2FA ? "✅" : u.rol === "admin" ? "⚠️ falta" : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{FECHA(u.ultimoIngreso)}</TableCell>
                    <TableCell className="text-sm">
                      {u.bloqueado ? "🚫 revocado" : u.confirmado ? "activo" : "invitación pendiente"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!soyYo && (
                        <div className="flex justify-end gap-2">
                          {u.bloqueado ? (
                            <Button variant="outline" size="sm" onClick={() => reactivar(u.id)}>
                              Reactivar
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => reenviarMail(u.id)}
                                title="Le reenvía el acceso por mail (si perdió el link o la contraseña)"
                              >
                                Reenviar mail
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => generarLink(u.id)}
                                title="Respaldo: copiar el link a mano, por si el mail no llega"
                              >
                                Copiar link
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => revocar(u.id, u.email)}>
                                Revocar
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Revocar <strong>no borra</strong> la cuenta: la bloquea, y se conserva para no perder la
          trazabilidad de quién hizo qué. Se deshace con <strong>Reactivar</strong>. Como la cuenta
          sigue existiendo, un email revocado <strong>no se puede volver a crear</strong>: hay que
          reactivarlo.
        </p>
      </section>
    </div>
  )
}
