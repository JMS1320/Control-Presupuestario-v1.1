"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { ReglaConciliacion } from "@/types/conciliacion"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, ArrowRight, ArrowLeft, Check, X, Copy } from "lucide-react"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

// -----------------------------------------------------------------------------
// Tipos auxiliares
// -----------------------------------------------------------------------------

interface TemplateInfo {
  id: string
  nombre_referencia: string
  categ: string
  cuenta_agrupadora: string | null
  centro_costo: string | null
  responsable: string
  solo_conciliacion: boolean
  es_bidireccional: boolean
  tipo_template: string
}

interface ReglaConValidacion {
  regla: ReglaConciliacion
  templateOrigen: TemplateInfo | null      // template que matchea categ + responsable origen
  templateDestino: TemplateInfo | null     // template que matchea categ + responsable destino (puede ser null)
  faltaTemplate: boolean                    // requiere crear template antes de poder activarse
}

interface DecisionTemplate {
  categ: string
  responsableDestino: string
  // si crea: datos del template a insertar
  crear: boolean
  // overrides editables
  nombre_referencia?: string
  cuenta_agrupadora?: string | null
  centro_costo?: string | null
}

type Paso = "seleccion" | "wizard_templates" | "confirmacion" | "ejecutando" | "completado"

interface Props {
  abierto: boolean
  onCerrar: () => void
  onCompletado: () => void
}

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------

export function ModalCopiarReglas({ abierto, onCerrar, onCompletado }: Props) {
  // -------------------- Estado --------------------
  const [paso, setPaso] = useState<Paso>("seleccion")
  const [cuentaOrigenId, setCuentaOrigenId] = useState<string>("")
  const [cuentaDestinoId, setCuentaDestinoId] = useState<string>("")
  const [reglasOrigen, setReglasOrigen] = useState<ReglaConciliacion[]>([])
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState("")
  const [soloActivas, setSoloActivas] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validación + wizard
  const [reglasValidadas, setReglasValidadas] = useState<ReglaConValidacion[]>([])
  const [decisionesTemplates, setDecisionesTemplates] = useState<Map<string, DecisionTemplate>>(new Map())
  const [wizardIndex, setWizardIndex] = useState(0)

  // Resultado
  const [resultado, setResultado] = useState<{ reglasActivas: number; reglasInactivas: number; templatesCreados: number } | null>(null)

  // Cuentas disponibles
  const cuentas = useMemo(() => CUENTAS_BANCARIAS.filter(c => c.activa), [])
  const cuentaOrigen = cuentas.find(c => c.id === cuentaOrigenId)
  const cuentaDestino = cuentas.find(c => c.id === cuentaDestinoId)

  // Empresa destino (para validar template)
  const empresaDestino = cuentaDestino?.empresa || ""

  // -------------------- Reset al abrir/cerrar --------------------
  useEffect(() => {
    if (abierto) {
      setPaso("seleccion")
      setCuentaOrigenId("")
      setCuentaDestinoId("")
      setReglasOrigen([])
      setSeleccionadas(new Set())
      setBusqueda("")
      setSoloActivas(true)
      setReglasValidadas([])
      setDecisionesTemplates(new Map())
      setWizardIndex(0)
      setResultado(null)
      setError(null)
    }
  }, [abierto])

  // -------------------- Cargar reglas cuando cambia origen --------------------
  useEffect(() => {
    if (!cuentaOrigenId) {
      setReglasOrigen([])
      setSeleccionadas(new Set())
      return
    }
    const cargar = async () => {
      setLoading(true)
      let query = supabase
        .from("reglas_conciliacion")
        .select("*")
        .eq("cuenta_bancaria_id", cuentaOrigenId)
        .order("orden", { ascending: true })

      if (soloActivas) query = query.eq("activo", true)

      const { data, error } = await query
      if (error) {
        setError(`Error cargando reglas: ${error.message}`)
        setLoading(false)
        return
      }
      setReglasOrigen(data || [])
      setSeleccionadas(new Set())
      setLoading(false)
    }
    cargar()
  }, [cuentaOrigenId, soloActivas])

  // -------------------- Reglas filtradas por búsqueda --------------------
  const reglasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return reglasOrigen
    const q = normalizarBusqueda(busqueda)
    return reglasOrigen.filter(r => {
      const texto = normalizarBusqueda(
        `${r.texto_buscar} ${r.categ} ${r.detalle} ${r.tipo} ${r.tipo_match} ${r.columna_busqueda}`
      )
      return texto.includes(q)
    })
  }, [reglasOrigen, busqueda])

  // -------------------- Helpers checkboxes --------------------
  const toggleSeleccion = (id: string) => {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleTodas = () => {
    if (seleccionadas.size === reglasFiltradas.length) {
      setSeleccionadas(new Set())
    } else {
      setSeleccionadas(new Set(reglasFiltradas.map(r => r.id)))
    }
  }

  // -------------------- Continuar a validación / wizard --------------------
  const continuarAValidacion = async () => {
    if (seleccionadas.size === 0) {
      setError("Seleccioná al menos una regla para copiar")
      return
    }
    if (!cuentaDestinoId) {
      setError("Elegí una cuenta destino")
      return
    }
    if (cuentaOrigenId === cuentaDestinoId) {
      setError("La cuenta destino debe ser distinta del origen")
      return
    }

    setError(null)
    setLoading(true)

    const reglasElegidas = reglasOrigen.filter(r => seleccionadas.has(r.id))
    const categsUnicas = Array.from(new Set(reglasElegidas.map(r => r.categ)))

    // Cargar todos los templates que pueden ser relevantes (origen y destino)
    const { data: templatesTodos, error: errTemplates } = await supabase
      .from("egresos_sin_factura")
      .select("id, nombre_referencia, categ, cuenta_agrupadora, centro_costo, responsable, solo_conciliacion, es_bidireccional, tipo_template")
      .in("categ", categsUnicas)
      .eq("activo", true)

    if (errTemplates) {
      setError(`Error consultando templates: ${errTemplates.message}`)
      setLoading(false)
      return
    }

    const templates = (templatesTodos || []) as TemplateInfo[]

    const matcheaResponsable = (t: TemplateInfo, empresa: string) =>
      t.responsable?.toLowerCase().includes(empresa.toLowerCase())

    const validadas: ReglaConValidacion[] = reglasElegidas.map(r => {
      const candidatos = templates.filter(t => t.categ === r.categ)
      const templateOrigen =
        candidatos.find(t => matcheaResponsable(t, cuentaOrigen!.empresa)) || candidatos[0] || null
      const templateDestino =
        candidatos.find(t => matcheaResponsable(t, empresaDestino)) || null
      const faltaTemplate = r.llena_template && !templateDestino
      return { regla: r, templateOrigen, templateDestino, faltaTemplate }
    })

    setReglasValidadas(validadas)

    // Armar mapa de templates faltantes únicos (por categ)
    const faltantes = new Map<string, DecisionTemplate>()
    validadas
      .filter(v => v.faltaTemplate)
      .forEach(v => {
        const key = v.regla.categ
        if (!faltantes.has(key)) {
          faltantes.set(key, {
            categ: v.regla.categ,
            responsableDestino: empresaDestino,
            crear: false,
            nombre_referencia: v.templateOrigen?.nombre_referencia || v.regla.categ,
            cuenta_agrupadora: v.templateOrigen?.cuenta_agrupadora ?? null,
            centro_costo: v.templateOrigen?.centro_costo ?? null,
          })
        }
      })
    setDecisionesTemplates(faltantes)
    setWizardIndex(0)

    setLoading(false)

    if (faltantes.size === 0) {
      // No falta crear nada → ir directo a confirmación
      setPaso("confirmacion")
    } else {
      setPaso("wizard_templates")
    }
  }

  // -------------------- Wizard: decisiones por template --------------------
  const decisionesArray = useMemo(() => Array.from(decisionesTemplates.values()), [decisionesTemplates])
  const decisionActual = decisionesArray[wizardIndex]

  const setDecision = (update: Partial<DecisionTemplate>) => {
    if (!decisionActual) return
    const next = new Map(decisionesTemplates)
    next.set(decisionActual.categ, { ...decisionActual, ...update })
    setDecisionesTemplates(next)
  }

  const avanzarWizard = (crear: boolean) => {
    setDecision({ crear })
    if (wizardIndex + 1 >= decisionesArray.length) {
      setPaso("confirmacion")
    } else {
      setWizardIndex(wizardIndex + 1)
    }
  }

  const retrocederWizard = () => {
    if (wizardIndex === 0) {
      setPaso("seleccion")
    } else {
      setWizardIndex(wizardIndex - 1)
    }
  }

  const crearTodosConDefaults = () => {
    const next = new Map(decisionesTemplates)
    decisionesArray.forEach(d => next.set(d.categ, { ...d, crear: true }))
    setDecisionesTemplates(next)
    setPaso("confirmacion")
  }

  // -------------------- Resumen para confirmación --------------------
  const resumen = useMemo(() => {
    const templatesACrear = decisionesArray.filter(d => d.crear)
    const categsACrear = new Set(templatesACrear.map(d => d.categ))
    const reglasActivas = reglasValidadas.filter(v => !v.faltaTemplate || categsACrear.has(v.regla.categ)).length
    const reglasInactivas = reglasValidadas.length - reglasActivas
    return {
      templatesACrear,
      reglasActivas,
      reglasInactivas,
      total: reglasValidadas.length,
    }
  }, [reglasValidadas, decisionesArray])

  // -------------------- Ejecutar copia --------------------
  const ejecutarCopia = async () => {
    setPaso("ejecutando")
    setError(null)

    try {
      // 1. Crear templates faltantes
      const templatesACrear = decisionesArray.filter(d => d.crear)
      const templatesCreadosMap = new Map<string, string>() // categ → id

      if (templatesACrear.length > 0) {
        // Necesitamos template_master_id — buscar el del año actual
        const añoActual = new Date().getFullYear()
        const nombreMaster = `Egresos sin Factura ${añoActual}`
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

        for (const dec of templatesACrear) {
          const validacion = reglasValidadas.find(v => v.regla.categ === dec.categ)
          const origen = validacion?.templateOrigen
          const insertObj = {
            template_master_id: masterId,
            categ: dec.categ,
            cuenta_agrupadora: dec.cuenta_agrupadora,
            centro_costo: dec.centro_costo,
            nombre_referencia: dec.nombre_referencia || dec.categ,
            responsable: dec.responsableDestino,
            tipo_template: origen?.tipo_template || "abierto",
            tipo_recurrencia: "abierto",
            solo_conciliacion: origen?.solo_conciliacion ?? true,
            es_bidireccional: origen?.es_bidireccional ?? false,
            es_multi_cuenta: false,
            año: añoActual,
            activo: true,
          }
          const { data: nuevoTemplate, error: errT } = await supabase
            .from("egresos_sin_factura")
            .insert(insertObj)
            .select("id")
            .single()
          if (errT) throw new Error(`Error creando template "${dec.categ}": ${errT.message}`)
          templatesCreadosMap.set(dec.categ, nuevoTemplate.id)
        }
      }

      // 2. Insertar reglas copiadas
      const categsConTemplateCreado = new Set(templatesACrear.map(d => d.categ))
      const reglasParaInsertar = reglasValidadas.map(v => {
        const debeQuedarActiva =
          v.regla.activo && (!v.faltaTemplate || categsConTemplateCreado.has(v.regla.categ))
        return {
          orden: v.regla.orden,
          tipo: v.regla.tipo,
          columna_busqueda: v.regla.columna_busqueda,
          texto_buscar: v.regla.texto_buscar,
          tipo_match: v.regla.tipo_match,
          categ: v.regla.categ,
          centro_costo: v.regla.centro_costo,
          detalle: v.regla.detalle,
          activo: debeQuedarActiva,
          llena_template: v.regla.llena_template,
          cuenta_bancaria_id: cuentaDestinoId,
          codigo_contable: v.regla.codigo_contable ?? null,
          codigo_interno: v.regla.codigo_interno ?? null,
        }
      })

      const { error: errReglas } = await supabase
        .from("reglas_conciliacion")
        .insert(reglasParaInsertar)
      if (errReglas) throw new Error(`Error copiando reglas: ${errReglas.message}`)

      setResultado({
        reglasActivas: resumen.reglasActivas,
        reglasInactivas: resumen.reglasInactivas,
        templatesCreados: templatesACrear.length,
      })
      setPaso("completado")
    } catch (e: any) {
      setError(e?.message || "Error inesperado al copiar reglas")
      setPaso("confirmacion")
    }
  }

  // -------------------- Cerrar al completar --------------------
  const finalizar = () => {
    onCompletado()
    onCerrar()
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) onCerrar() }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copiar reglas entre cuentas
            {paso === "wizard_templates" && (
              <Badge variant="outline" className="ml-2">
                Template {wizardIndex + 1} de {decisionesArray.length}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ============================================================ */}
        {/* PASO 1: SELECCIÓN */}
        {/* ============================================================ */}
        {paso === "seleccion" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cuenta origen</Label>
                <Select value={cuentaOrigenId} onValueChange={setCuentaOrigenId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir cuenta origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} ({c.empresa})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cuenta destino</Label>
                <Select value={cuentaDestinoId} onValueChange={setCuentaDestinoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir cuenta destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas
                      .filter(c => c.id !== cuentaOrigenId)
                      .map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre} ({c.empresa})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cuentaOrigenId && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Buscar reglas..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className="max-w-xs"
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={soloActivas} onCheckedChange={v => setSoloActivas(!!v)} />
                    Solo activas
                  </label>
                  <span className="text-sm text-gray-500 ml-auto">
                    {seleccionadas.size} de {reglasFiltradas.length} seleccionadas
                  </span>
                  <Button size="sm" variant="outline" onClick={toggleTodas}>
                    {seleccionadas.size === reglasFiltradas.length ? "Ninguna" : "Seleccionar todas"}
                  </Button>
                </div>

                <ScrollArea className="flex-1 border rounded-md">
                  {loading && (
                    <div className="p-8 flex items-center justify-center text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando reglas...
                    </div>
                  )}
                  {!loading && reglasFiltradas.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No hay reglas para mostrar</div>
                  )}
                  {!loading &&
                    reglasFiltradas.map(r => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-3 border-b hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={seleccionadas.has(r.id)}
                          onCheckedChange={() => toggleSeleccion(r.id)}
                        />
                        <div className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">#{r.orden}</div>
                        <Badge variant="outline" className="text-xs">{r.tipo}</Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.texto_buscar}</div>
                          <div className="text-xs text-gray-500 truncate">
                            → {r.categ} · {r.tipo_match} · {r.columna_busqueda}
                          </div>
                        </div>
                        {!r.activo && <Badge variant="secondary" className="text-xs">inactiva</Badge>}
                      </label>
                    ))}
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* PASO 2: WIZARD TEMPLATES FALTANTES */}
        {/* ============================================================ */}
        {paso === "wizard_templates" && decisionActual && (
          <div className="flex-1 overflow-auto space-y-4">
            <Alert>
              <AlertDescription>
                Faltan {decisionesArray.length} templates en <strong>{empresaDestino}</strong>. Decidí uno por uno
                si querés crearlos. Las reglas cuyos templates no crees quedarán <strong>inactivas</strong>.
              </AlertDescription>
            </Alert>

            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <Badge>{decisionActual.categ}</Badge>
                <ArrowRight className="h-4 w-4" />
                <Badge variant="outline">Responsable: {decisionActual.responsableDestino}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nombre de referencia</Label>
                  <Input
                    value={decisionActual.nombre_referencia || ""}
                    onChange={e => setDecision({ nombre_referencia: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cuenta agrupadora</Label>
                  <Input
                    value={decisionActual.cuenta_agrupadora || ""}
                    onChange={e => setDecision({ cuenta_agrupadora: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Centro de costo</Label>
                  <Input
                    value={decisionActual.centro_costo || ""}
                    onChange={e => setDecision({ centro_costo: e.target.value || null })}
                  />
                </div>
                <div>
                  <Label>Categ (no editable)</Label>
                  <Input value={decisionActual.categ} disabled />
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Se hereda del template origen:{" "}
                <code>solo_conciliacion</code> y <code>es_bidireccional</code>. Tipo template: <code>abierto</code>.
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="outline" onClick={retrocederWizard}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => avanzarWizard(false)}>
                  <X className="h-4 w-4 mr-1" /> Saltar (regla queda inactiva)
                </Button>
                {decisionesArray.length > 1 && (
                  <Button variant="secondary" onClick={crearTodosConDefaults}>
                    Crear todos los faltantes con defaults
                  </Button>
                )}
                <Button onClick={() => avanzarWizard(true)}>
                  <Check className="h-4 w-4 mr-1" /> Crear template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PASO 3: CONFIRMACIÓN */}
        {/* ============================================================ */}
        {paso === "confirmacion" && (
          <div className="flex-1 overflow-auto space-y-4">
            <Alert>
              <AlertDescription>
                Vas a copiar reglas de <strong>{cuentaOrigen?.nombre}</strong> a{" "}
                <strong>{cuentaDestino?.nombre}</strong>. Revisá el resumen antes de confirmar.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded p-3 bg-green-50">
                <div className="text-2xl font-bold text-green-700">{resumen.reglasActivas}</div>
                <div className="text-xs text-green-900">Reglas activas (template OK)</div>
              </div>
              <div className="border rounded p-3 bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{resumen.reglasInactivas}</div>
                <div className="text-xs text-yellow-900">Reglas inactivas (sin template)</div>
              </div>
              <div className="border rounded p-3 bg-blue-50">
                <div className="text-2xl font-bold text-blue-700">{resumen.templatesACrear.length}</div>
                <div className="text-xs text-blue-900">Templates nuevos a crear</div>
              </div>
            </div>

            {resumen.templatesACrear.length > 0 && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium mb-2">Templates que se van a crear:</div>
                <ul className="text-xs space-y-1">
                  {resumen.templatesACrear.map(t => (
                    <li key={t.categ}>
                      • <strong>{t.nombre_referencia}</strong> — categ <code>{t.categ}</code>, responsable {t.responsableDestino}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="text-sm font-medium mb-2">Reglas a copiar ({reglasValidadas.length}):</div>
              <ul className="text-xs space-y-1">
                {reglasValidadas.map(v => {
                  const categCreada = resumen.templatesACrear.some(t => t.categ === v.regla.categ)
                  const quedaActiva = v.regla.activo && (!v.faltaTemplate || categCreada)
                  return (
                    <li key={v.regla.id} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">#{v.regla.orden}</Badge>
                      <span className="truncate flex-1">{v.regla.texto_buscar} → {v.regla.categ}</span>
                      {quedaActiva ? (
                        <Badge className="bg-green-100 text-green-700 text-[10px]">activa</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">inactiva</Badge>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* PASO 4: EJECUTANDO */}
        {/* ============================================================ */}
        {paso === "ejecutando" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span>Copiando reglas y creando templates...</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* PASO 5: COMPLETADO */}
        {/* ============================================================ */}
        {paso === "completado" && resultado && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <Check className="h-16 w-16 text-green-600" />
            <h3 className="text-xl font-semibold">Copia completada</h3>
            <div className="grid grid-cols-3 gap-3 w-full max-w-md">
              <div className="border rounded p-3 bg-green-50 text-center">
                <div className="text-2xl font-bold text-green-700">{resultado.reglasActivas}</div>
                <div className="text-xs">Activas</div>
              </div>
              <div className="border rounded p-3 bg-yellow-50 text-center">
                <div className="text-2xl font-bold text-yellow-700">{resultado.reglasInactivas}</div>
                <div className="text-xs">Inactivas</div>
              </div>
              <div className="border rounded p-3 bg-blue-50 text-center">
                <div className="text-2xl font-bold text-blue-700">{resultado.templatesCreados}</div>
                <div className="text-xs">Templates creados</div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* FOOTER */}
        {/* ============================================================ */}
        <DialogFooter className="border-t pt-3">
          {paso === "seleccion" && (
            <>
              <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
              <Button onClick={continuarAValidacion} disabled={loading || seleccionadas.size === 0 || !cuentaDestinoId}>
                Continuar ({seleccionadas.size}) <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {paso === "confirmacion" && (
            <>
              <Button variant="outline" onClick={() => setPaso(decisionesArray.length > 0 ? "wizard_templates" : "seleccion")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
              </Button>
              <Button onClick={ejecutarCopia} className="bg-blue-600 hover:bg-blue-700">
                Confirmar copia
              </Button>
            </>
          )}
          {paso === "completado" && (
            <Button onClick={finalizar} className="bg-blue-600 hover:bg-blue-700">
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
