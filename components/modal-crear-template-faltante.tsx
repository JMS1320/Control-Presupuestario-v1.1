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
import {
  campanaDeFecha, esDeOtraEmpresa, faltantesTemplateNuevo, periodicidadDeEmpresa, type Periodicidad,
} from "@/lib/templates/nuevo-desde-conciliacion"
import { hoyArgentina } from "@/lib/fechas"
import { ProveedorCombobox, type ProveedorSeleccionado } from "@/components/ui/proveedor-combobox"

/** Un template existente: para ver qué hay antes de crear, y para copiar sus datos («parecido a…»). */
interface TemplateExistente {
  id: string
  nombre_referencia: string
  responsable: string | null
  año: string | null
  categ: string | null
  cuenta_agrupadora: string | null
  centro_costo: string | null
  tipo: string | null
  periodicidad: string | null
  aplica_generacion: boolean | null
  responsable_interno: string | null
  es_bidireccional: boolean | null
}

interface Props {
  abierto: boolean
  categ: string
  empresaDestino: string
  /**
   * `conciliacion` (A-DEC-1002, 2026-10-03): se crea desde el modal de asignar un movimiento, sin ir a
   * Templates — *«desde la propia conciliación a mano»* (usuario). Ahí no hay regla que quede inactiva.
   */
  motivo: "activar_regla" | "guardar_regla" | "conciliacion"
  /** Nombre que se propone (p. ej. la descripción del movimiento) si no hay otro template de esa cuenta. */
  nombreSugerido?: string
  /** Fecha del movimiento que se concilia: de ahí sale la campaña (A-FEAT-1294). */
  fechaMovimiento?: string
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
  nombreSugerido,
  fechaMovimiento,
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

  /**
   * 🧩 A-FEAT-1294 — desde la CONCILIACIÓN el formulario es completo y se crea entero o nada. Las reglas
   * (`activar_regla` / `guardar_regla`) siguen con su camino de siempre hasta A-FEAT-1293.
   */
  const desdeConciliacion = motivo === "conciliacion"
  const [existentes, setExistentes] = useState<TemplateExistente[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [parecido, setParecido] = useState<TemplateExistente | null>(null)
  const [cuenta, setCuenta] = useState("")
  const [cuentaTocada, setCuentaTocada] = useState(false)
  const [responsable, setResponsable] = useState(empresaDestino)
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(periodicidadDeEmpresa(empresaDestino))
  const [aplicaGeneracion, setAplicaGeneracion] = useState(false)
  const [naturaleza, setNaturaleza] = useState("egreso")
  const [responsableInterno, setResponsableInterno] = useState("")
  /** A-FEAT-1297 — quién cobra (el proveedor del template). */
  const [quienCobra, setQuienCobra] = useState<ProveedorSeleccionado>({ cuit: "", nombre: "" })

  // Al abrir desde la conciliación: lo que YA existe (para no crear duplicados) y el formulario limpio.
  useEffect(() => {
    if (!abierto || !desdeConciliacion) return
    setError(null); setParecido(null); setBusqueda(""); setCuentaTocada(false)
    setNombreReferencia(nombreSugerido || ""); setCuenta(nombreSugerido || "")
    setResponsable(empresaDestino); setPeriodicidad(periodicidadDeEmpresa(empresaDestino))
    setCuentaAgrupadora(""); setCentroCosto(""); setAplicaGeneracion(false); setNaturaleza("egreso"); setResponsableInterno(""); setQuienCobra({ cuit: "", nombre: "" })
    setDefaults({ nombre_referencia: nombreSugerido || "", cuenta_agrupadora: null, centro_costo: null,
      solo_conciliacion: false, es_bidireccional: false, tipo_template: "abierto" })
    const cargarExistentes = async () => {
      const { data, error: err } = await supabase.from("egresos_sin_factura")
        .select("id, nombre_referencia, responsable, año, categ, cuenta_agrupadora, centro_costo, tipo, periodicidad, aplica_generacion, responsable_interno, es_bidireccional")
        .eq("activo", true).order("nombre_referencia")
      if (err) setError(`Error consultando templates: ${err.message}`)
      // `año` (con ñ) confunde al tipador de supabase-js: se castea a la forma que se pidió.
      setExistentes((data || []) as unknown as TemplateExistente[])
    }
    void cargarExistentes()
  }, [abierto, desdeConciliacion, nombreSugerido, empresaDestino])

  // La cuenta sigue al nombre mientras no se la toque (la cuenta ES el template — usuario 19/10).
  useEffect(() => {
    if (desdeConciliacion && !cuentaTocada) setCuenta(nombreReferencia)
  }, [nombreReferencia, cuentaTocada, desdeConciliacion])

  const elegirParecido = (t: TemplateExistente) => {
    setParecido(t)
    setCuentaAgrupadora(t.cuenta_agrupadora || "")
    setCentroCosto(t.centro_costo || "")
    if (t.tipo) setNaturaleza(t.tipo)
    if (t.periodicidad === "anual" || t.periodicidad === "bianual") setPeriodicidad(t.periodicidad)
    setAplicaGeneracion(!!t.aplica_generacion)
    setResponsableInterno(t.responsable_interno || "")
  }

  const campana = campanaDeFecha(periodicidad, fechaMovimiento || hoyArgentina())
  const faltan = desdeConciliacion
    ? faltantesTemplateNuevo({
        nombre_referencia: nombreReferencia, categ: cuenta, responsable, cuenta_agrupadora: cuentaAgrupadora,
        periodicidad, año: campana, tipo: naturaleza, aplica_generacion: aplicaGeneracion,
        nombre_quien_cobra: quienCobra.nombre, cuit_quien_cobra: quienCobra.cuit,
      })
    : []
  const agrupadoras = Array.from(new Set(existentes.map(t => t.cuenta_agrupadora).filter(Boolean))).sort() as string[]
  const centros = Array.from(new Set(existentes.map(t => t.centro_costo).filter(Boolean))).sort() as string[]
  const textoBusqueda = busqueda.trim().toLowerCase()
  const parecidos = textoBusqueda
    ? existentes.filter(t => [t.nombre_referencia, t.cuenta_agrupadora, t.categ, t.responsable]
        .some(v => (v || "").toLowerCase().includes(textoBusqueda))).slice(0, 30)
    : []

  // Al abrir, buscar template existente con esa categ (cualquier empresa) para heredar defaults
  useEffect(() => {
    if (!abierto || !categ || desdeConciliacion) return

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
            nombre_referencia: nombreSugerido || categ,
            cuenta_agrupadora: null,
            centro_costo: null,
            solo_conciliacion: false,
            es_bidireccional: false,
            tipo_template: "abierto",
          }
      setDefaults(d)
      // (Desde la conciliación este efecto ya no corre — A-FEAT-1294 arma su formulario arriba.)
      setNombreReferencia(d.nombre_referencia)
      setCuentaAgrupadora(d.cuenta_agrupadora || "")
      setCentroCosto(d.centro_costo || "")
      setCargandoDefaults(false)
    }

    cargar()
  }, [abierto, categ, motivo, nombreSugerido, desdeConciliacion])

  const crearTemplate = async () => {
    if (!defaults) return
    if (desdeConciliacion && faltan.length) { setError(`Falta completar: ${faltan.join(", ")}`); return }
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

      // 🧩 Desde la conciliación: el template ENTERO, en un solo insert (entero o nada).
      if (desdeConciliacion) {
        const { data: nuevo, error: errN } = await supabase
          .from("egresos_sin_factura")
          .insert({
            template_master_id: masterId,
            nombre_referencia: nombreReferencia.trim(),
            categ: cuenta.trim(),
            responsable,
            cuenta_agrupadora: cuentaAgrupadora.trim(),
            centro_costo: centroCosto.trim() || null,
            responsable_interno: responsableInterno.trim() || null,
            nombre_quien_cobra: quienCobra.nombre.trim() || null,
            cuit_quien_cobra: quienCobra.cuit.replace(/[-\s]/g, "") || null,
            tipo: naturaleza,
            tipo_template: "abierto",
            tipo_recurrencia: "abierto",
            periodicidad,
            año: campana,
            aplica_generacion: aplicaGeneracion,
            solo_conciliacion: false,
            es_bidireccional: parecido?.es_bidireccional ?? false,
            es_multi_cuenta: false,
            activo: true,
          })
          .select("id")
          .single()
        if (errN) throw new Error(`Error creando template: ${errN.message}`)
        onCreado(nuevo.id)
        return
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
            {motivo === "conciliacion" ? "Crear template desde la conciliación" : "Falta template para esta regla"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription>
            {motivo === "conciliacion" ? (
              <>Antes de crear, <strong>buscá si ya existe</strong> uno parecido: si sirve, cerrá esto y elegilo en la lista.
              Si no, elegí el más parecido para copiar sus datos. Se crea un template <strong>abierto</strong>, completo o nada,
              y el movimiento se asigna a él con su importe y su fecha.</>
            ) : motivo === "activar_regla" ? (
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

        {desdeConciliacion && defaults && (
          <div className="space-y-3 text-sm">
            <div>
              <Label>Parecido a… (buscá entre los existentes)</Label>
              <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, agrupadora, cuenta o empresa…" />
              {parecidos.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded border divide-y">
                  {parecidos.map(t => (
                    <button key={t.id} type="button" onClick={() => elegirParecido(t)}
                      className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-50 ${parecido?.id === t.id ? "bg-blue-50" : ""}`}>
                      <b>{t.nombre_referencia}</b> · {t.responsable || "—"} · {t.año || "sin campaña"} · {t.cuenta_agrupadora || "sin agrupadora"}
                    </button>
                  ))}
                </div>
              )}
              {parecido && (
                <p className="mt-1 text-xs text-blue-700">
                  Copiado de «{parecido.nombre_referencia}» ({parecido.responsable}): agrupadora, centro de costo, naturaleza,
                  periodicidad, generación y responsable interno.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={nombreReferencia} onChange={e => setNombreReferencia(e.target.value)} />
              </div>
              <div>
                <Label>Cuenta * <span className="text-gray-400 font-normal">(por default, el nombre)</span></Label>
                <Input value={cuenta} onChange={e => { setCuenta(e.target.value); setCuentaTocada(true) }} />
              </div>
              <div>
                <Label>Responsable *</Label>
                <select className="w-full border rounded h-9 px-2" value={responsable} onChange={e => setResponsable(e.target.value)}>
                  {["MSA", "PAM", "MA"].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <Label>Agrupadora *</Label>
                <Input list="agrupadoras-existentes" value={cuentaAgrupadora} onChange={e => setCuentaAgrupadora(e.target.value)}
                  placeholder="Elegí una existente o escribí una nueva" />
                <datalist id="agrupadoras-existentes">{agrupadoras.map(a => <option key={a} value={a} />)}</datalist>
              </div>
              <div>
                <Label>Centro de costo</Label>
                <Input list="centros-existentes" value={centroCosto} onChange={e => setCentroCosto(e.target.value)} placeholder="(opcional)" />
                <datalist id="centros-existentes">{centros.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="col-span-2">
                {/* A-FEAT-1297 — sin esto el movimiento quedaba sin proveedor (Seguro Chalet, 20/10). Si no está en
                    el maestro se escribe el nombre a mano; el CUIT es opcional. */}
                <ProveedorCombobox label="Quién cobra *" value={quienCobra} onChange={setQuienCobra} rol="proveedor" />
              </div>
              <div>
                <Label>Responsable interno</Label>
                <Input value={responsableInterno} onChange={e => setResponsableInterno(e.target.value)} placeholder="(opcional)" />
              </div>
              <div>
                <Label>Naturaleza *</Label>
                <select className="w-full border rounded h-9 px-2" value={naturaleza} onChange={e => setNaturaleza(e.target.value)}>
                  {["egreso", "ingreso", "financiero", "distribucion"].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <Label>Periodicidad → campaña</Label>
                <select className="w-full border rounded h-9 px-2" value={periodicidad}
                  onChange={e => setPeriodicidad(e.target.value as Periodicidad)}>
                  <option value="anual">anual (año calendario)</option>
                  <option value="bianual">campaña jul–jun</option>
                </select>
                <p className="text-xs text-gray-500 mt-0.5">Campaña: <b>{campana || "—"}</b> (por la fecha del movimiento)</p>
              </div>
              <label className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={aplicaGeneracion} onChange={e => setAplicaGeneracion(e.target.checked)} />
                Entra a la generación de campañas (se renueva solo cada {periodicidad === "anual" ? "año" : "campaña"})
              </label>
            </div>
            {esDeOtraEmpresa(responsable, empresaDestino) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠️ El template es de <b>{responsable}</b> y lo paga una cuenta de <b>{empresaDestino}</b>: queda como pago de
                una empresa por cuenta de otra.
              </p>
            )}
            {faltan.length > 0 && <p className="text-xs text-red-700">Falta completar: {faltan.join(", ")}. Sin eso no se crea.</p>}
          </div>
        )}

        {!desdeConciliacion && !cargandoDefaults && defaults && (
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
            {motivo === "conciliacion" ? "Cancelar" : "No crear (regla queda inactiva)"}
          </Button>
          <Button onClick={crearTemplate} disabled={guardando || cargandoDefaults || faltan.length > 0} className="bg-blue-600 hover:bg-blue-700">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Crear template y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
