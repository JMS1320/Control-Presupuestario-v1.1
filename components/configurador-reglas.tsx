"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { Loader2, Plus, Edit, Trash2, ArrowUp, ArrowDown, Settings, Eye, EyeOff, Copy } from "lucide-react"
import { useReglasConciliacion } from "@/hooks/useReglasConciliacion"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { ReglaConciliacion } from "@/types/conciliacion"
import { ModalCopiarReglas } from "@/components/modal-copiar-reglas"
import { WizardTemplatesEgresos } from "@/components/wizard-templates-egresos"
import { supabase } from "@/lib/supabase"
import { moverRegla, proximoOrden } from "@/lib/conciliacion/orden-reglas"
import { unoPorFamilia } from "@/lib/conciliacion/template-de-regla"
import { COLUMNAS_DE_REGLA, etiquetaColumnaRegla } from "@/lib/conciliacion/evaluar-regla"

export function ConfiguradorReglas({ cuentaBancariaId }: { cuentaBancariaId?: string }) {
  const { reglas, loading, error, crearRegla, actualizarRegla, eliminarRegla, toggleRegla, reordenarReglas, cargarReglas } = useReglasConciliacion()

  const [cuentaFiltro, setCuentaFiltro] = useState(cuentaBancariaId || 'msa_galicia')
  const [modalCopiarAbierto, setModalCopiarAbierto] = useState(false)
  const [busquedaRegla, setBusquedaRegla] = useState('')   // 🔎 A-FEAT-136
  /**
   * Template faltante — al ACTIVAR una regla apagada, o al GUARDAR una activa, que llena template sin elegirlo
   * y no encuentra ninguno de su categoría para esa cuenta.
   * 🧩 A-FEAT-1302 punto 1 (2026-10-20): abre el MISMO asistente de Templates que el extracto (antes un
   * modal aparte con pocos campos), así hay una sola forma de crear un template en toda la app.
   */
  const [modalTemplateFaltante, setModalTemplateFaltante] = useState<{
    categ: string
    empresaDestino: string
    cuentaBancariaId: string
    onResolve: (creado: boolean) => void
  } | null>(null)

  // Sincronizar si el padre cambia la cuenta
  useEffect(() => { if (cuentaBancariaId) setCuentaFiltro(cuentaBancariaId) }, [cuentaBancariaId])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [reglaEditando, setReglaEditando] = useState<ReglaConciliacion | null>(null)

  /**
   * 🎯 A-FEAT-1293 — la regla elige el TEMPLATE, no la cuenta (usuario 2026-10-19: *«yo trabajo con los
   * templates»*). Se cargan los activos para buscar; la cuenta de la regla se toma del template elegido.
   */
  const [templates, setTemplates] = useState<Array<{ id: string; nombre_referencia: string; responsable: string | null;
    año: string | null; categ: string | null; cuenta_agrupadora: string | null }>>([])
  const [busquedaTemplate, setBusquedaTemplate] = useState('')
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from('egresos_sin_factura')
        .select('id, nombre_referencia, responsable, año, categ, cuenta_agrupadora')
        .eq('activo', true).order('nombre_referencia')
      setTemplates((data || []) as unknown as typeof templates)
    }
    void cargar()
  }, [])
  const templatePorId = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates])

  /** Las de la cuenta elegida, ordenadas — el `orden` decide cuál gana cuando dos matchean. */
  const reglasDeLaCuenta = useMemo(
    () => reglas.filter(r => r.cuenta_bancaria_id === cuentaFiltro).sort((a, b) => a.orden - b.orden),
    [reglas, cuentaFiltro])

  /**
   * 🔎 A-FEAT-136 — el filtro del buscador.
   *
   * ⚠️ **Se busca sobre las de la cuenta, no sobre todas.** Mostrar reglas de otra cuenta en esta
   * lista sería peor que no encontrarlas: se editaría una que no se aplica acá. Cuando no hay
   * resultados se dice explícitamente que puede estar en otra cuenta.
   */
  const reglasVisibles = useMemo(() => {
    const q = busquedaRegla.trim().toLowerCase().replace(/^#/, '')
    if (!q) return reglasDeLaCuenta
    return reglasDeLaCuenta.filter(r =>
      [r.texto_buscar, r.categ, r.detalle, r.centro_costo, r.codigo_contable, r.codigo_interno,
       r.tipo, r.columna_busqueda, String(r.orden)]
        .some(v => String(v ?? '').toLowerCase().includes(q)))
  }, [reglasDeLaCuenta, busquedaRegla])

  /**
   * Códigos contable/interno ya usados — se sugieren al crear una regla para no ir generando
   * variantes del mismo concepto. Salen de las dos tablas de reglas y de los propios extractos,
   * porque la convención de nombres es una sola.
   */
  const codigosEnUso = useMemo(() => {
    const limpiar = (vals: (string | null | undefined)[]) =>
      [...new Set(vals.map(v => (v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    return {
      contable: limpiar(reglas.map(r => r.codigo_contable)),
      interno: limpiar(reglas.map(r => r.codigo_interno)),
    }
  }, [reglas])
  const [formulario, setFormulario] = useState({
    orden: '',
    tipo: '',
    columna_busqueda: '',
    texto_buscar: '',
    tipo_match: '',
    categ: '',
    centro_costo: '',
    detalle: '',
    codigo_contable: '',
    codigo_interno: '',
    activo: true,
    llena_template: true,
    cuenta_bancaria_id: 'msa_galicia',
    template_id: ''
  })

  // Reset formulario
  const resetFormulario = () => {
    setFormulario({
      orden: '',
      tipo: '',
      columna_busqueda: '',
      texto_buscar: '',
      tipo_match: '',
      categ: '',
      centro_costo: '',
      detalle: '',
      codigo_contable: '',
      codigo_interno: '',
      activo: true,
      llena_template: true,
      cuenta_bancaria_id: cuentaFiltro,
      template_id: ''
    })
    setBusquedaTemplate('')
    setReglaEditando(null)
  }

  // Abrir modal para nueva regla
  const abrirModalNueva = () => {
    resetFormulario()
    // Sugerir el siguiente orden DE ESTA CUENTA (A-BUG-1295: antes miraba todas y la 1ª de la tarjeta salía #44)
    setFormulario(prev => ({ ...prev, orden: String(proximoOrden(reglasDeLaCuenta)) }))
    setModalAbierto(true)
  }

  // Abrir modal para editar
  const abrirModalEditar = (regla: ReglaConciliacion) => {
    setReglaEditando(regla)
    setFormulario({
      orden: String(regla.orden),
      tipo: regla.tipo,
      columna_busqueda: regla.columna_busqueda,
      texto_buscar: regla.texto_buscar,
      tipo_match: regla.tipo_match,
      categ: regla.categ,
      centro_costo: regla.centro_costo || '',
      detalle: regla.detalle,
      codigo_contable: regla.codigo_contable || '',
      codigo_interno: regla.codigo_interno || '',
      activo: regla.activo,
      llena_template: regla.llena_template,
      cuenta_bancaria_id: regla.cuenta_bancaria_id,
      template_id: regla.template_id || ''
    })
    setBusquedaTemplate('')
    setModalAbierto(true)
  }

  // Guardar regla
  const guardarRegla = async () => {
    const elegido = formulario.template_id ? templatePorId.get(formulario.template_id) : undefined
    // Una regla NUEVA tiene que elegir template (las viejas pueden seguir por cuenta hasta que se las edite).
    if (!reglaEditando && formulario.llena_template && !elegido) {
      alert('Elegí el template al que va a cargar la regla.')
      return
    }
    const datosRegla = {
      orden: parseInt(formulario.orden),
      tipo: formulario.tipo as any,
      columna_busqueda: formulario.columna_busqueda as any,
      texto_buscar: formulario.texto_buscar,
      tipo_match: formulario.tipo_match as any,
      // La cuenta sale del template elegido (y si no tiene, su nombre: «la cuenta es el template»).
      categ: elegido ? (elegido.categ || elegido.nombre_referencia) : formulario.categ,
      template_id: elegido ? elegido.id : null,
      centro_costo: formulario.centro_costo || null,
      detalle: formulario.detalle,
      codigo_contable: formulario.codigo_contable.trim() || null,
      codigo_interno: formulario.codigo_interno.trim() || null,
      activo: formulario.activo,
      llena_template: formulario.llena_template ?? true,
      cuenta_bancaria_id: formulario.cuenta_bancaria_id
    }

    // Si la regla se guarda como activa y llena template, validar que exista template apropiado
    // (con template elegido ya existe: no hace falta buscarlo por cuenta).
    if (datosRegla.activo && datosRegla.llena_template && !datosRegla.template_id) {
      const templateExiste = await verificarTemplateRegla(datosRegla.categ, datosRegla.cuenta_bancaria_id)
      if (!templateExiste) {
        const cuenta = CUENTAS_BANCARIAS.find(c => c.id === datosRegla.cuenta_bancaria_id)
        setModalTemplateFaltante({
          categ: datosRegla.categ,
          empresaDestino: cuenta?.empresa || '',
          cuentaBancariaId: datosRegla.cuenta_bancaria_id,
          onResolve: async (creado) => {
            setModalTemplateFaltante(null)
            // Si el usuario no creó el template, guardar con activo=false
            const datosFinal = creado ? datosRegla : { ...datosRegla, activo: false }
            const ok = reglaEditando
              ? await actualizarRegla(reglaEditando.id, datosFinal)
              : await crearRegla(datosFinal)
            if (ok) {
              setModalAbierto(false)
              resetFormulario()
            }
          },
        })
        return
      }
    }

    let exito = false
    if (reglaEditando) {
      exito = await actualizarRegla(reglaEditando.id, datosRegla)
    } else {
      exito = await crearRegla(datosRegla)
    }

    if (exito) {
      setModalAbierto(false)
      resetFormulario()
    }
  }

  // Validar si existe template apropiado para una regla.
  // Replica la lógica del motor (Paso 1): si hay template con solo_conciliacion=true,
  // exige match por empresa. Si todos son solo_conciliacion=false, cualquiera sirve.
  const verificarTemplateRegla = async (categ: string, cuentaBancariaId: string): Promise<boolean> => {
    const cuenta = CUENTAS_BANCARIAS.find(c => c.id === cuentaBancariaId)
    if (!cuenta) return true // si no encuentro la cuenta, asumir OK (no bloquear)

    const { data: templates } = await supabase
      .from('egresos_sin_factura')
      .select('id, responsable, solo_conciliacion')
      .eq('categ', categ)
      .eq('activo', true)

    if (!templates || templates.length === 0) return false // sin template → falta

    const algunoBancario = templates.some((t: any) => t.solo_conciliacion)
    if (algunoBancario) {
      return templates.some((t: any) =>
        t.responsable?.toLowerCase().includes(cuenta.empresa.toLowerCase())
      )
    }
    return true // no bancario → cualquier template sirve
  }

  // Toggle de activo/inactivo con validación de template al activar
  const handleToggleRegla = async (regla: ReglaConciliacion) => {
    // Desactivar siempre se permite
    if (regla.activo) {
      await toggleRegla(regla.id)
      return
    }
    // Activar regla que no llena template, o que ya eligió su template → no requiere validación
    if (!regla.llena_template || regla.template_id) {
      await toggleRegla(regla.id)
      return
    }
    const templateExiste = await verificarTemplateRegla(regla.categ, regla.cuenta_bancaria_id)
    if (templateExiste) {
      await toggleRegla(regla.id)
      return
    }
    // Falta template → abrir modal
    const cuenta = CUENTAS_BANCARIAS.find(c => c.id === regla.cuenta_bancaria_id)
    setModalTemplateFaltante({
      categ: regla.categ,
      empresaDestino: cuenta?.empresa || '',
      cuentaBancariaId: regla.cuenta_bancaria_id,
      onResolve: async (creado) => {
        setModalTemplateFaltante(null)
        if (creado) {
          await toggleRegla(regla.id)
        }
        // si no creó → no se activa (queda como estaba)
      },
    })
  }

  // Cambiar orden de regla — sólo entre las de la cuenta (A-BUG-1295)
  const cambiarOrden = async (regla: ReglaConciliacion, direccion: 'up' | 'down') => {
    const cambios = moverRegla(reglasDeLaCuenta, regla.id, direccion)
    if (cambios.length) await reordenarReglas(cambios)
  }

  // Badge color por tipo
  const getBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'cash_flow': return 'bg-blue-100 text-blue-800'
      case 'impuestos': return 'bg-red-100 text-red-800'
      case 'bancarios': return 'bg-green-100 text-green-800'
      case 'otras': return 'bg-purple-100 text-purple-800'
      case 'cuit': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando reglas...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configurador de Reglas</h2>
          <p className="text-gray-600">Gestiona las reglas de conciliación bancaria automática</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setModalCopiarAbierto(true)} variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copiar reglas
          </Button>
          <Button onClick={abrirModalNueva} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Regla
          </Button>
        </div>
      </div>

      <ModalCopiarReglas
        abierto={modalCopiarAbierto}
        onCerrar={() => setModalCopiarAbierto(false)}
        onCompletado={cargarReglas}
      />

      <Dialog open={!!modalTemplateFaltante} onOpenChange={(o) => { if (!o) modalTemplateFaltante?.onResolve(false) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Falta template para esta regla — «{modalTemplateFaltante?.categ}»</DialogTitle>
          </DialogHeader>
          {modalTemplateFaltante && (
            <WizardTemplatesEgresos
              empresaCuenta={modalTemplateFaltante.empresaDestino || undefined}
              cuentaBancariaId={modalTemplateFaltante.cuentaBancariaId}
              // Lo que carga una regla son movimientos automáticos (comisiones, impuestos): abierto por default.
              inicial={{
                nombre_referencia: modalTemplateFaltante.categ,
                categ: modalTemplateFaltante.categ,
                responsable: modalTemplateFaltante.empresaDestino,
                tipo_template: 'abierto',
              }}
              onCancelar={() => modalTemplateFaltante.onResolve(false)}
              onCreado={async () => {
                const { data } = await supabase.from('egresos_sin_factura')
                  .select('id, nombre_referencia, responsable, año, categ, cuenta_agrupadora')
                  .eq('activo', true).order('nombre_referencia')
                setTemplates((data || []) as unknown as typeof templates)
                modalTemplateFaltante.onResolve(true)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Selector cuenta bancaria — solo si no viene del padre */}
      {!cuentaBancariaId && (
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium whitespace-nowrap">Cuenta bancaria:</Label>
          <Select value={cuentaFiltro} onValueChange={setCuentaFiltro}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUENTAS_BANCARIAS.filter(c => c.activa).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-400">
            {reglas.filter(r => r.cuenta_bancaria_id === cuentaFiltro).length} reglas para esta cuenta
          </span>
        </div>
      )}
      {cuentaBancariaId && (
        <span className="text-xs text-gray-400">
          {reglas.filter(r => r.cuenta_bancaria_id === cuentaFiltro).length} reglas para esta cuenta
        </span>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{reglas.length}</div>
            <p className="text-xs text-gray-600">Total Reglas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{reglas.filter(r => r.activo).length}</div>
            <p className="text-xs text-gray-600">Activas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{reglas.filter(r => !r.activo).length}</div>
            <p className="text-xs text-gray-600">Inactivas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{new Set(reglas.map(r => r.tipo)).size}</div>
            <p className="text-xs text-gray-600">Tipos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Reglas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Reglas de Conciliación ({reglasVisibles.length}{busquedaRegla.trim() ? ` de ${reglasDeLaCuenta.length}` : ''})
          </CardTitle>
          {/* 🔎 A-FEAT-136 — buscador. Pedido del usuario 2026-09-12.
              Son decenas por cuenta (él cargó 34 sólo en MA) y encontrarlas a ojo es lo que hace
              que se cargue una regla nueva **que ya existía** — y dos reglas que matchean el mismo
              texto se aplican por `orden`, así que la segunda no falla: queda muerta en silencio.
              Busca en lo que uno recuerda de una regla: qué texto busca, qué categ pone, qué
              detalle escribe, y su número de orden. */}
          <input
            type="text"
            value={busquedaRegla}
            onChange={(e) => setBusquedaRegla(e.target.value)}
            placeholder="🔎 Buscar por texto, categoría, detalle, centro de costo o #orden…"
            className="mt-2 w-full border rounded px-2 py-1.5 text-sm"
          />
        </CardHeader>
        <CardContent>
          {busquedaRegla.trim() && reglasVisibles.length === 0 && (
            <p className="text-sm text-gray-500 py-3">
              Ninguna regla de esta cuenta dice «{busquedaRegla.trim()}».
              {' '}Ojo: el buscador mira <strong>sólo la cuenta elegida arriba</strong> — puede estar en otra.
            </p>
          )}
          <div className="space-y-2">
            {reglasVisibles
              .map((regla) => (
                <div
                  key={regla.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    !regla.activo ? 'opacity-50 bg-gray-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Orden */}
                    <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      #{regla.orden}
                    </div>

                    {/* Tipo */}
                    <Badge className={getBadgeColor(regla.tipo)}>
                      {regla.tipo.toUpperCase()}
                    </Badge>

                    {/* Criterio */}
                    <div className="flex-1">
                      <div className="font-medium">{regla.texto_buscar}</div>
                      <div className="text-sm text-gray-500">
                        {etiquetaColumnaRegla(regla.columna_busqueda)} • {regla.tipo_match}
                      </div>
                    </div>

                    {/* Resultado */}
                    <div className="text-right">
                      <div className="font-medium text-blue-600">
                        {regla.template_id && templatePorId.get(regla.template_id)
                          ? <>→ {templatePorId.get(regla.template_id)!.nombre_referencia} <span className="text-xs text-gray-500">({templatePorId.get(regla.template_id)!.responsable})</span></>
                          : regla.categ}
                      </div>
                      <div className="text-sm text-gray-500">{regla.detalle}</div>
                      {(regla.codigo_contable || regla.codigo_interno) && (
                        <div className="text-xs text-emerald-600 font-mono mt-0.5">
                          {[regla.codigo_contable, regla.codigo_interno].filter(Boolean).join(' / ')}
                        </div>
                      )}
                    </div>

                    {/* Estado */}
                    <div className="flex items-center gap-2">
                      {regla.activo ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarOrden(regla, 'up')}
                      disabled={reglasDeLaCuenta[0]?.id === regla.id}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cambiarOrden(regla, 'down')}
                      disabled={reglasDeLaCuenta[reglasDeLaCuenta.length - 1]?.id === regla.id}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={regla.activo}
                      onCheckedChange={() => handleToggleRegla(regla)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirModalEditar(regla)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => eliminarRegla(regla.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Crear/Editar */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reglaEditando ? 'Editar Regla' : 'Nueva Regla'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="cuenta_bancaria_id">Cuenta Bancaria</Label>
              <Select
                value={formulario.cuenta_bancaria_id}
                onValueChange={(value) => setFormulario(prev => ({ ...prev, cuenta_bancaria_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {CUENTAS_BANCARIAS.filter(c => c.activa).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="orden">Orden (Prioridad)</Label>
              <Input
                id="orden"
                type="number"
                value={formulario.orden}
                onChange={(e) => setFormulario(prev => ({ ...prev, orden: e.target.value }))}
                placeholder="1, 2, 3..."
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Regla</Label>
              <Select value={formulario.tipo} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_flow">Cash Flow</SelectItem>
                  <SelectItem value="impuestos">Impuestos</SelectItem>
                  <SelectItem value="bancarios">Bancarios</SelectItem>
                  <SelectItem value="otras">Otras</SelectItem>
                  <SelectItem value="cuit">CUIT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="columna_busqueda">Columna a Buscar</Label>
              <Select value={formulario.columna_busqueda} onValueChange={(value) => setFormulario(prev => ({ ...prev, columna_busqueda: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona columna" />
                </SelectTrigger>
                <SelectContent>
                  {/* 🏪 A-FEAT-1362 — la lista sale de `COLUMNAS_DE_REGLA`, la misma que usa el motor. */}
                  {COLUMNAS_DE_REGLA.map(c => (
                    <SelectItem key={c.valor} value={c.valor}>{c.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {COLUMNAS_DE_REGLA.find(c => c.valor === formulario.columna_busqueda)?.ayuda && (
                <p className="mt-1 text-[11px] text-gray-500">{COLUMNAS_DE_REGLA.find(c => c.valor === formulario.columna_busqueda)?.ayuda}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tipo_match">Tipo de Match</Label>
              <Select value={formulario.tipo_match} onValueChange={(value) => setFormulario(prev => ({ ...prev, tipo_match: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exacto">Exacto</SelectItem>
                  <SelectItem value="contiene">Contiene</SelectItem>
                  <SelectItem value="inicia_con">Inicia Con</SelectItem>
                  <SelectItem value="termina_con">Termina Con</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="texto_buscar">Texto a Buscar</Label>
              <Input
                id="texto_buscar"
                value={formulario.texto_buscar}
                onChange={(e) => setFormulario(prev => ({ ...prev, texto_buscar: e.target.value }))}
                placeholder="Ej: Comision Extraccion, 20044390222"
              />
            </div>

            <div>
              <Label>Template al que carga</Label>
              {/* 🎯 A-FEAT-1293 — se elige el TEMPLATE (usuario 2026-10-19). La cuenta de la regla sale de él.
                  Si el template se renueva de campaña, el motor carga en el de la campaña del movimiento. */}
              {(() => {
                const elegido = formulario.template_id ? templatePorId.get(formulario.template_id) : undefined
                const empresaCuenta = CUENTAS_BANCARIAS.find(c => c.id === formulario.cuenta_bancaria_id)?.empresa
                const q = busquedaTemplate.trim().toLowerCase()
                const resultados = q
                  ? unoPorFamilia(templates.filter(t => [t.nombre_referencia, t.cuenta_agrupadora, t.categ, t.responsable]
                      .some(v => (v || '').toLowerCase().includes(q)))).slice(0, 25)
                  : []
                return (
                  <div className="space-y-1">
                    {elegido ? (
                      <div className="text-sm rounded border border-blue-200 bg-blue-50 px-2 py-1 flex items-center justify-between gap-2">
                        {/* A-BUG-1303: sin la campaña — la regla carga en la campaña de cada movimiento */}
                        <span>→ <b>{elegido.nombre_referencia}</b> · {elegido.responsable} <span className="text-xs text-gray-500">· carga en la campaña de cada movimiento</span></span>
                        <button type="button" className="text-xs underline" onClick={() => setFormulario(p => ({ ...p, template_id: '' }))}>cambiar</button>
                      </div>
                    ) : formulario.categ ? (
                      <p className="text-xs text-amber-700">Regla vieja: hoy va por la cuenta «{formulario.categ}». Elegí el template para fijarlo.</p>
                    ) : null}
                    {elegido && empresaCuenta && elegido.responsable && elegido.responsable.toUpperCase() !== empresaCuenta && (
                      <p className="text-xs text-amber-700">⚠️ El template es de {elegido.responsable} y la cuenta es de {empresaCuenta}.</p>
                    )}
                    {!elegido && (
                      <>
                        <Input value={busquedaTemplate} onChange={e => setBusquedaTemplate(e.target.value)}
                          placeholder="Buscar template por nombre, agrupadora o empresa…" />
                        {resultados.length > 0 && (
                          <div className="max-h-40 overflow-y-auto rounded border divide-y">
                            {resultados.map(t => (
                              <button key={t.id} type="button"
                                onClick={() => { setFormulario(p => ({ ...p, template_id: t.id })); setBusquedaTemplate('') }}
                                className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50">
                                <b>{t.nombre_referencia}</b> · {t.responsable || '—'} · {t.cuenta_agrupadora || 'sin agrupadora'}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            <div>
              <Label htmlFor="centro_costo">Centro de Costo (Opcional)</Label>
              <CentroCostoCombobox
                value={formulario.centro_costo}
                onValueChange={(v) => setFormulario(prev => ({ ...prev, centro_costo: v }))}
                placeholder="Centro de costo (opcional)"
                className="w-full"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="detalle">Detalle</Label>
              <Input
                id="detalle"
                value={formulario.detalle}
                onChange={(e) => setFormulario(prev => ({ ...prev, detalle: e.target.value }))}
                placeholder="Ej: Comision Extracciones Efectivo"
              />
            </div>

            {/* Códigos contables — específicos por cuenta bancaria */}
            <div className="col-span-2 border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">
                Códigos contables (opcional) — específicos para esta cuenta bancaria. Tienen prioridad sobre los códigos del template.
              </p>
            </div>

            <div>
              <Label htmlFor="codigo_contable">Contable</Label>
              <Input
                id="codigo_contable"
                list="codigos-contable-texto"
                value={formulario.codigo_contable}
                onChange={(e) => setFormulario(prev => ({ ...prev, codigo_contable: e.target.value }))}
                placeholder="Ej: RET 3 PAM, LIB"
              />
            </div>

            <div>
              <Label htmlFor="codigo_interno">Interno</Label>
              <Input
                id="codigo_interno"
                list="codigos-interno-texto"
                value={formulario.codigo_interno}
                onChange={(e) => setFormulario(prev => ({ ...prev, codigo_interno: e.target.value }))}
                placeholder="Ej: DIST MA, CTA JMS"
              />
              {/* Sugerencias con lo ya usado. Se permite escribir uno nuevo: la lista es una ayuda
                  para no duplicar, no una restricción. */}
              <datalist id="codigos-contable-texto">
                {codigosEnUso.contable.map(c => <option key={c} value={c} />)}
              </datalist>
              <datalist id="codigos-interno-texto">
                {codigosEnUso.interno.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="col-span-2 flex items-center space-x-2">
              <Switch
                id="activo"
                checked={formulario.activo}
                onCheckedChange={(checked) => setFormulario(prev => ({ ...prev, activo: checked }))}
              />
              <Label htmlFor="activo">Regla activa</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={guardarRegla} className="bg-blue-600 hover:bg-blue-700">
              {reglaEditando ? 'Actualizar' : 'Crear'} Regla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}