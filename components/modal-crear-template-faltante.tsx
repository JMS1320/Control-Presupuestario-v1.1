"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertTriangle, Plus } from "lucide-react"

interface Props {
  abierto: boolean
  categ: string
  empresaDestino: string
  motivo: "activar_regla" | "guardar_regla"
  onCerrar: () => void
  onCreado: (templateId: string) => void
  onCancelar: () => void   // usuario decide NO crear → regla queda inactiva
}

interface DefaultsTemplate {
  nombre_referencia: string
  cuenta_agrupadora: string | null
  centro_costo: string | null
  solo_conciliacion: boolean
  es_bidireccional: boolean
  tipo_template: string
}

export function ModalCrearTemplateFaltante({
  abierto,
  categ,
  empresaDestino,
  motivo,
  onCerrar,
  onCreado,
  onCancelar,
}: Props) {
  const [cargandoDefaults, setCargandoDefaults] = useState(false)
  const [defaults, setDefaults] = useState<DefaultsTemplate | null>(null)
  const [nombreReferencia, setNombreReferencia] = useState("")
  const [cuentaAgrupadora, setCuentaAgrupadora] = useState("")
  const [centroCosto, setCentroCosto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Al abrir, buscar template existente con esa categ (cualquier empresa) para heredar defaults
  useEffect(() => {
    if (!abierto || !categ) return

    const cargar = async () => {
      setCargandoDefaults(true)
      setError(null)
      const { data, error: err } = await supabase
        .from("egresos_sin_factura")
        .select("nombre_referencia, cuenta_agrupadora, centro_costo, solo_conciliacion, es_bidireccional, tipo_template")
        .eq("categ", categ)
        .eq("activo", true)
        .limit(1)
        .maybeSingle()

      if (err) {
        setError(`Error consultando templates: ${err.message}`)
      }

      const d: DefaultsTemplate = data
        ? {
            nombre_referencia: data.nombre_referencia,
            cuenta_agrupadora: data.cuenta_agrupadora,
            centro_costo: data.centro_costo,
            solo_conciliacion: data.solo_conciliacion ?? false,
            es_bidireccional: data.es_bidireccional ?? false,
            tipo_template: data.tipo_template || "abierto",
          }
        : {
            nombre_referencia: categ,
            cuenta_agrupadora: null,
            centro_costo: null,
            solo_conciliacion: false,
            es_bidireccional: false,
            tipo_template: "abierto",
          }
      setDefaults(d)
      setNombreReferencia(d.nombre_referencia)
      setCuentaAgrupadora(d.cuenta_agrupadora || "")
      setCentroCosto(d.centro_costo || "")
      setCargandoDefaults(false)
    }

    cargar()
  }, [abierto, categ])

  const crearTemplate = async () => {
    if (!defaults) return
    setGuardando(true)
    setError(null)

    try {
      const añoActual = new Date().getFullYear()
      const nombreMaster = `Egresos sin Factura ${añoActual}`

      // Buscar o crear template_master
      let masterId: string | null = null
      const { data: existente } = await supabase
        .from("templates_master")
        .select("id")
        .eq("nombre", nombreMaster)
        .eq("año", añoActual)
        .maybeSingle()

      if (existente) {
        masterId = existente.id
      } else {
        const { data: nuevoMaster, error: errMaster } = await supabase
          .from("templates_master")
          .insert({
            nombre: nombreMaster,
            año: añoActual,
            descripcion: `Template master para egresos sin factura del año ${añoActual}`,
            total_renglones: 0,
          })
          .select("id")
          .single()
        if (errMaster) throw new Error(`Error creando template master: ${errMaster.message}`)
        masterId = nuevoMaster.id
      }

      // Crear template
      const { data: nuevoTemplate, error: errT } = await supabase
        .from("egresos_sin_factura")
        .insert({
          template_master_id: masterId,
          categ,
          cuenta_agrupadora: cuentaAgrupadora || null,
          centro_costo: centroCosto || null,
          nombre_referencia: nombreReferencia || categ,
          responsable: empresaDestino,
          tipo_template: defaults.tipo_template,
          tipo_recurrencia: "abierto",
          solo_conciliacion: defaults.solo_conciliacion,
          es_bidireccional: defaults.es_bidireccional,
          es_multi_cuenta: false,
          año: añoActual,
          activo: true,
        })
        .select("id")
        .single()

      if (errT) throw new Error(`Error creando template: ${errT.message}`)
      onCreado(nuevoTemplate.id)
    } catch (e: any) {
      setError(e?.message || "Error inesperado")
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Falta template para esta regla
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription>
            {motivo === "activar_regla" ? (
              <>Para activar esta regla hace falta un template <strong>{categ}</strong> con responsable{" "}
              <strong>{empresaDestino}</strong>. Si no lo creás ahora, la regla queda <strong>inactiva</strong>.</>
            ) : (
              <>La regla apunta a <strong>{categ}</strong> pero no existe template para <strong>{empresaDestino}</strong>.
              Si no lo creás ahora, la regla se guardará <strong>inactiva</strong>.</>
            )}
          </AlertDescription>
        </Alert>

        {cargandoDefaults && (
          <div className="flex items-center justify-center p-6 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando defaults...
          </div>
        )}

        {!cargandoDefaults && defaults && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categ (no editable)</Label>
                <Input value={categ} disabled />
              </div>
              <div>
                <Label>Responsable (no editable)</Label>
                <Input value={empresaDestino} disabled />
              </div>
              <div>
                <Label>Nombre de referencia</Label>
                <Input
                  value={nombreReferencia}
                  onChange={e => setNombreReferencia(e.target.value)}
                  placeholder={categ}
                />
              </div>
              <div>
                <Label>Cuenta agrupadora</Label>
                <Input
                  value={cuentaAgrupadora}
                  onChange={e => setCuentaAgrupadora(e.target.value)}
                  placeholder="(opcional)"
                />
              </div>
              <div className="col-span-2">
                <Label>Centro de costo</Label>
                <Input
                  value={centroCosto}
                  onChange={e => setCentroCosto(e.target.value)}
                  placeholder="(opcional)"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-gray-600">
              <Badge variant="outline">tipo_template: {defaults.tipo_template}</Badge>
              <Badge variant="outline">tipo_recurrencia: abierto</Badge>
              {defaults.solo_conciliacion && <Badge className="bg-orange-100 text-orange-800">solo_conciliacion</Badge>}
              {defaults.es_bidireccional && <Badge className="bg-blue-100 text-blue-800">bidireccional</Badge>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancelar} disabled={guardando}>
            No crear (regla queda inactiva)
          </Button>
          <Button onClick={crearTemplate} disabled={guardando || cargandoDefaults} className="bg-blue-600 hover:bg-blue-700">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Crear template y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
