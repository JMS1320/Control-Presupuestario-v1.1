"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, Plus, Save, ArrowLeft, ArrowRight, Eye, Check } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

// Tipos para el wizard
interface DatosBasicos {
  tipo_template: 'fijo' | 'abierto'
  es_bidireccional: boolean
  es_multi_cuenta: boolean
  categ: string
  cuenta_agrupadora: string
  centro_costo: string
  nombre_referencia: string
  responsable: string
  cuit_quien_cobra: string
  nombre_quien_cobra: string
  monto_base: number
}

interface ConfiguracionRecurrencia {
  tipo: 'mensual' | 'anual' | 'cuotas_especificas'
  dia_mes?: number
  ultimo_dia_mes?: boolean
  fecha_anual?: string
  cantidad_cuotas?: number
  meses_especificos?: number[]
  dia_default?: number
  ultimo_dia_mes_cuotas?: boolean
  incluir_aguinaldo?: boolean
}

interface CuotaGenerada {
  mes: number
  fecha_estimada: string
  fecha_vencimiento?: string
  monto: number
  descripcion: string
}

interface WizardState {
  paso: number
  datos_basicos: DatosBasicos
  configuracion: ConfiguracionRecurrencia
  cuotas_generadas: CuotaGenerada[]
}

// Datos constantes
const RESPONSABLES = [
  { value: 'MSA', label: 'MSA' },
  { value: 'PAM', label: 'PAM' },
  { value: 'MA', label: 'MA' },
  { value: 'Manuel', label: 'Manuel' },
  { value: 'Soledad', label: 'Soledad' },
  { value: 'Merceditas', label: 'Merceditas' },
  { value: 'Andres', label: 'Andres' },
  { value: 'Jose', label: 'Jose' }
]

const MESES = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
]

export function WizardTemplatesEgresos() {
  const [categoriasTemplates, setCategoriasTemplates] = useState<string[]>([])
  const [cuentasAgrupadoras, setCuentasAgrupadoras] = useState<string[]>([])
  const [state, setState] = useState<WizardState>({
    paso: 1,
    datos_basicos: {
      tipo_template: 'fijo',
      es_bidireccional: false,
      es_multi_cuenta: false,
      categ: '',
      cuenta_agrupadora: '',
      centro_costo: '',
      nombre_referencia: '',
      responsable: '',
      cuit_quien_cobra: '',
      nombre_quien_cobra: '',
      monto_base: 0
    },
    configuracion: {
      tipo: 'mensual',
      incluir_aguinaldo: false,
      ultimo_dia_mes: false,
      ultimo_dia_mes_cuotas: false
    },
    cuotas_generadas: []
  })

  // Cargar categorías y cuentas agrupadoras existentes al inicializar
  useEffect(() => {
    async function cargarOpciones() {
      try {
        const { data } = await supabase
          .from('egresos_sin_factura')
          .select('categ, cuenta_agrupadora')
          .order('categ')

        if (data) {
          const categsUnicas = [...new Set(data.map(d => d.categ).filter(Boolean))] as string[]
          const agrupadoras = [...new Set(data.map(d => d.cuenta_agrupadora).filter(Boolean))].sort() as string[]
          setCategoriasTemplates(categsUnicas)
          setCuentasAgrupadoras(agrupadoras)
        }
      } catch (error) {
        console.error('Error en cargarOpciones:', error)
      }
    }
    cargarOpciones()
  }, [])

  // Función para obtener último día del mes
  const obtenerUltimoDiaDelMes = (año: number, mes: number): number => {
    return new Date(año, mes, 0).getDate()
  }

  // Función para generar cuotas según configuración
  const generarCuotas = (): CuotaGenerada[] => {
    const { datos_basicos, configuracion } = state
    const cuotas: CuotaGenerada[] = []
    const año_actual = new Date().getFullYear()

    // Templates abiertos no generan cuotas predefinidas
    if (datos_basicos.tipo_template === 'abierto') {
      return []
    }

    if (configuracion.tipo === 'mensual') {
      for (let mes = 1; mes <= 12; mes++) {
        let dia: number
        if (configuracion.ultimo_dia_mes) {
          dia = obtenerUltimoDiaDelMes(año_actual, mes)
        } else {
          dia = configuracion.dia_mes || 15
        }
        
        const fecha = new Date(año_actual, mes - 1, dia)
        
        // Calcular monto (aguinaldo en junio y diciembre)
        let monto = datos_basicos.monto_base
        if (configuracion.incluir_aguinaldo && (mes === 6 || mes === 12)) {
          monto = monto * 1.5
        }

        cuotas.push({
          mes,
          fecha_estimada: fecha.toISOString().split('T')[0],
          fecha_vencimiento: fecha.toISOString().split('T')[0],
          monto,
          descripcion: `${datos_basicos.nombre_referencia} ${datos_basicos.responsable} - ${MESES[mes - 1].label} ${año_actual}`
        })
      }
    } else if (configuracion.tipo === 'anual') {
      const fecha = new Date(configuracion.fecha_anual || `${año_actual}-02-10`)
      cuotas.push({
        mes: fecha.getMonth() + 1,
        fecha_estimada: fecha.toISOString().split('T')[0],
        fecha_vencimiento: fecha.toISOString().split('T')[0],
        monto: datos_basicos.monto_base,
        descripcion: `${datos_basicos.nombre_referencia} ${datos_basicos.responsable} - ${año_actual}`
      })
    } else if (configuracion.tipo === 'cuotas_especificas') {
      const meses = configuracion.meses_especificos || []
      meses.forEach(mes => {
        let dia: number
        if (configuracion.ultimo_dia_mes_cuotas) {
          dia = obtenerUltimoDiaDelMes(año_actual, mes)
        } else {
          dia = configuracion.dia_default || 15
        }
        
        const fecha = new Date(año_actual, mes - 1, dia)
        
        cuotas.push({
          mes,
          fecha_estimada: fecha.toISOString().split('T')[0],
          fecha_vencimiento: fecha.toISOString().split('T')[0],
          monto: datos_basicos.monto_base,
          descripcion: `${datos_basicos.nombre_referencia} ${datos_basicos.responsable} - ${MESES[mes - 1].label} ${año_actual}`
        })
      })
    }

    return cuotas
  }

  // Actualizar cuotas cuando cambie la configuración
  useEffect(() => {
    if (state.paso >= 3) {
      const cuotas = generarCuotas()
      setState(prev => ({ ...prev, cuotas_generadas: cuotas }))
    }
  }, [state.datos_basicos, state.configuracion, state.paso])

  // Función para avanzar paso
  const siguientePaso = () => {
    if (state.paso < 4) {
      setState(prev => ({ ...prev, paso: prev.paso + 1 }))
    }
  }

  // Función para retroceder paso
  const anteriorPaso = () => {
    if (state.paso > 1) {
      setState(prev => ({ ...prev, paso: prev.paso - 1 }))
    }
  }

  // Función para actualizar datos básicos
  const actualizarDatosBasicos = (campo: keyof DatosBasicos, valor: string | number) => {
    setState(prev => ({
      ...prev,
      datos_basicos: { ...prev.datos_basicos, [campo]: valor }
    }))
  }

  // Función para actualizar configuración
  const actualizarConfiguracion = (campo: keyof ConfiguracionRecurrencia, valor: any) => {
    setState(prev => ({
      ...prev,
      configuracion: { ...prev.configuracion, [campo]: valor }
    }))
  }

  // Función para guardar template
  const guardarTemplate = async () => {
    try {
      const año_actual = new Date().getFullYear()
      
      // 1. Crear o buscar template master
      const nombreTemplateMaster = `Egresos sin Factura ${año_actual}`
      
      let templateMaster
      const { data: existingMaster } = await supabase
        .from('templates_master')
        .select('*')
        .eq('nombre', nombreTemplateMaster)
        .eq('año', año_actual)
        .single()

      if (existingMaster) {
        templateMaster = existingMaster
      } else {
        const { data: newMaster, error: masterError } = await supabase
          .from('templates_master')
          .insert({
            nombre: nombreTemplateMaster,
            año: año_actual,
            descripcion: `Template master para egresos sin factura del año ${año_actual}`,
            total_renglones: 0
          })
          .select()
          .single()

        if (masterError) throw masterError
        templateMaster = newMaster
      }

      // 2. Crear renglón de egreso
      const esAbierto = state.datos_basicos.tipo_template === 'abierto'
      const esMultiCuenta = state.datos_basicos.es_multi_cuenta
      const { data: egresoData, error: egresoError } = await supabase
        .from('egresos_sin_factura')
        .insert({
          template_master_id: templateMaster.id,
          categ: esMultiCuenta ? null : state.datos_basicos.categ,
          cuenta_agrupadora: esMultiCuenta ? null : (state.datos_basicos.cuenta_agrupadora || null),
          centro_costo: state.datos_basicos.centro_costo,
          nombre_referencia: state.datos_basicos.nombre_referencia,
          responsable: state.datos_basicos.responsable,
          cuit_quien_cobra: state.datos_basicos.cuit_quien_cobra || null,
          nombre_quien_cobra: state.datos_basicos.nombre_quien_cobra || null,
          tipo_recurrencia: esMultiCuenta ? 'abierto' : (esAbierto ? 'abierto' : state.configuracion.tipo),
          tipo_template: esMultiCuenta ? 'abierto' : state.datos_basicos.tipo_template,
          es_bidireccional: esMultiCuenta ? false : state.datos_basicos.es_bidireccional,
          es_multi_cuenta: esMultiCuenta,
          configuracion_reglas: (esAbierto || esMultiCuenta) ? null : state.configuracion,
          año: año_actual,
          activo: true
        })
        .select()
        .single()

      if (egresoError) throw egresoError

      // 3. Crear cuotas generadas (solo si NO es abierto)
      if (state.cuotas_generadas.length > 0) {
        const cuotasParaInsertar = state.cuotas_generadas.map(cuota => ({
          egreso_id: egresoData.id,
          mes: cuota.mes,
          fecha_estimada: cuota.fecha_estimada,
          fecha_vencimiento: cuota.fecha_vencimiento,
          monto: cuota.monto,
          descripcion: cuota.descripcion,
          estado: 'pendiente'
        }))

        const { error: cuotasError } = await supabase
          .from('cuotas_egresos_sin_factura')
          .insert(cuotasParaInsertar)

        if (cuotasError) throw cuotasError
      }

      // 4. Actualizar contador en template master
      const { error: updateError } = await supabase
        .from('templates_master')
        .update({ 
          total_renglones: (templateMaster.total_renglones || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateMaster.id)

      if (updateError) throw updateError

      const mensajeExito = esAbierto
        ? 'Template ABIERTO creado exitosamente. Agregue cuotas desde el botón "Pago Manual".'
        : `Template creado exitosamente: ${state.cuotas_generadas.length} cuotas generadas`
      toast.success(mensajeExito)
      
      // Reset wizard
      setState({
        paso: 1,
        datos_basicos: {
          tipo_template: 'fijo',
          es_bidireccional: false,
          es_multi_cuenta: false,
          categ: '',
          cuenta_agrupadora: '',
          centro_costo: '',
          nombre_referencia: '',
          responsable: '',
          cuit_quien_cobra: '',
          nombre_quien_cobra: '',
          monto_base: 0
        },
        configuracion: {
          tipo: 'mensual',
          incluir_aguinaldo: false,
          ultimo_dia_mes: false,
          ultimo_dia_mes_cuotas: false
        },
        cuotas_generadas: []
      })
    } catch (error) {
      console.error('Error guardando template:', error)
      toast.error(`Error al crear template: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  // Validar paso actual
  const validarPaso = (): boolean => {
    const esAbierto = state.datos_basicos.tipo_template === 'abierto'
    const esMultiCuenta = state.datos_basicos.es_multi_cuenta

    switch (state.paso) {
      case 1:
        // Multi-cuenta: no requiere categ. Abierto normal: no requiere monto_base.
        return !!(
          (esMultiCuenta || state.datos_basicos.categ) &&
          state.datos_basicos.nombre_referencia &&
          state.datos_basicos.responsable &&
          (esAbierto || esMultiCuenta || state.datos_basicos.monto_base > 0)
        )
      case 2:
        // Templates abiertos no requieren configuración adicional
        if (esAbierto) {
          return true
        }
        if (state.configuracion.tipo === 'mensual') {
          return !!(state.configuracion.ultimo_dia_mes || (state.configuracion.dia_mes && state.configuracion.dia_mes >= 1 && state.configuracion.dia_mes <= 31))
        } else if (state.configuracion.tipo === 'anual') {
          return !!state.configuracion.fecha_anual
        } else if (state.configuracion.tipo === 'cuotas_especificas') {
          return !!(state.configuracion.meses_especificos && state.configuracion.meses_especificos.length > 0)
        }
        return true
      case 3:
        // Templates abiertos no generan cuotas, pero es válido
        return esAbierto || state.cuotas_generadas.length > 0
      case 4:
        return true
      default:
        return false
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Wizard: Crear Renglón Template Egresos sin Factura
          </CardTitle>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(num => (
              <Badge 
                key={num}
                variant={num === state.paso ? "default" : num < state.paso ? "secondary" : "outline"}
              >
                Paso {num}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={`paso-${state.paso}`} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="paso-1" disabled={state.paso !== 1}>Datos Básicos</TabsTrigger>
              <TabsTrigger value="paso-2" disabled={state.paso !== 2}>Recurrencia</TabsTrigger>
              <TabsTrigger value="paso-3" disabled={state.paso !== 3}>Fechas</TabsTrigger>
              <TabsTrigger value="paso-4" disabled={state.paso !== 4}>Preview</TabsTrigger>
            </TabsList>

            {/* PASO 1: Datos Básicos */}
            <TabsContent value="paso-1" className="space-y-4">
              {/* Tipo de Template - PRIMERO */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <Label className="text-base font-semibold">Tipo de Template *</Label>
                <RadioGroup
                  value={state.datos_basicos.tipo_template}
                  onValueChange={(value: 'fijo' | 'abierto') => actualizarDatosBasicos('tipo_template', value)}
                  className="mt-3 flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fijo" id="tipo_fijo" />
                    <Label htmlFor="tipo_fijo" className="font-normal">
                      <span className="font-medium">Fijo</span>
                      <span className="text-sm text-gray-500 ml-2">(cuotas predefinidas)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="abierto" id="tipo_abierto" />
                    <Label htmlFor="tipo_abierto" className="font-normal text-purple-700">
                      <span className="font-medium">Abierto</span>
                      <span className="text-sm text-purple-500 ml-2">(cuotas manuales)</span>
                    </Label>
                  </div>
                </RadioGroup>

                {state.datos_basicos.tipo_template === 'abierto' && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded text-sm text-purple-800">
                    📂 <strong>Template Abierto:</strong> No genera cuotas automáticas.
                    Agregue cuotas manualmente desde "Pago Manual".
                  </div>
                )}

                {/* Opción Bidireccional */}
                <div className="mt-4 flex items-center space-x-2">
                  <Checkbox
                    id="es_bidireccional"
                    checked={state.datos_basicos.es_bidireccional}
                    onCheckedChange={(checked) => actualizarDatosBasicos('es_bidireccional', checked === true)}
                  />
                  <Label htmlFor="es_bidireccional" className="font-normal">
                    <span className="font-medium">🔄 Template Bidireccional</span>
                    <span className="text-sm text-gray-500 ml-2">(acepta egresos e ingresos)</span>
                  </Label>
                </div>

                {state.datos_basicos.es_bidireccional && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                    <strong>Ejemplos de uso:</strong>
                    <ul className="mt-1 ml-4 list-disc">
                      <li><strong>FCI:</strong> Suscripción (egreso) / Rescate (ingreso)</li>
                      <li><strong>Caja:</strong> Retiro (egreso) / Depósito (ingreso)</li>
                      <li><strong>Préstamos:</strong> Pago cuota (egreso) / Recepción (ingreso)</li>
                    </ul>
                  </div>
                )}

                {/* Opción Multi-cuenta — solo visible para templates abiertos */}
                {state.datos_basicos.tipo_template === 'abierto' && (
                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="es_multi_cuenta"
                        checked={state.datos_basicos.es_multi_cuenta}
                        onCheckedChange={(checked) => {
                          actualizarDatosBasicos('es_multi_cuenta', checked === true)
                          if (checked) {
                            actualizarDatosBasicos('categ', '')
                            actualizarDatosBasicos('cuenta_agrupadora', '')
                            actualizarDatosBasicos('es_bidireccional', false)
                          }
                        }}
                      />
                      <Label htmlFor="es_multi_cuenta" className="font-normal">
                        <span className="font-medium text-orange-700">📂 Template Multi-cuenta</span>
                        <span className="text-sm text-gray-500 ml-2">(cada cuota define su propia cuenta contable)</span>
                      </Label>
                    </div>
                    {state.datos_basicos.es_multi_cuenta && (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                        <strong>Ej: Otros Gastos, Gastos Varios</strong> — sin categoría fija.
                        Al cargar cada pago manual se asigna la cuenta contable correspondiente.
                        Si no se asigna, el sistema lo marca como irregularidad a corregir.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CATEG — oculto para multi-cuenta */}
                {!state.datos_basicos.es_multi_cuenta && (
                  <div>
                    <Label htmlFor="categ">Categoría (CATEG) *</Label>
                    <Input
                      id="categ"
                      list="categs-existentes"
                      value={state.datos_basicos.categ}
                      onChange={(e) => actualizarDatosBasicos('categ', e.target.value)}
                      placeholder="Seleccionar o escribir nueva categoría"
                    />
                    <datalist id="categs-existentes">
                      {categoriasTemplates.map(categ => (
                        <option key={categ} value={categ} />
                      ))}
                    </datalist>
                    <p className="text-xs text-gray-500 mt-1">
                      Escriba para buscar o cree una nueva
                    </p>
                  </div>
                )}

                {/* Cuenta Agrupadora — oculto para multi-cuenta */}
                {!state.datos_basicos.es_multi_cuenta && (
                  <div>
                    <Label htmlFor="cuenta_agrupadora">Cuenta Agrupadora</Label>
                    <Input
                      id="cuenta_agrupadora"
                      list="agrupadoras-existentes"
                      value={state.datos_basicos.cuenta_agrupadora}
                      onChange={(e) => actualizarDatosBasicos('cuenta_agrupadora', e.target.value)}
                      placeholder="Ej: Gastos Bancarios, Retiros..."
                    />
                    <datalist id="agrupadoras-existentes">
                      {cuentasAgrupadoras.map(ag => (
                        <option key={ag} value={ag} />
                      ))}
                    </datalist>
                  </div>
                )}

                <div>
                  <Label htmlFor="centro_costo">Centro de Costo</Label>
                  <Input
                    id="centro_costo"
                    value={state.datos_basicos.centro_costo}
                    onChange={(e) => actualizarDatosBasicos('centro_costo', e.target.value)}
                    placeholder="Ej: ADM (opcional)"
                  />
                </div>

                <div>
                  <Label htmlFor="responsable">Responsable *</Label>
                  <Select
                    value={state.datos_basicos.responsable}
                    onValueChange={(value) => actualizarDatosBasicos('responsable', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSABLES.map(resp => (
                        <SelectItem key={resp.value} value={resp.value}>
                          {resp.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="nombre_referencia">Nombre de Referencia *</Label>
                  <Input
                    id="nombre_referencia"
                    value={state.datos_basicos.nombre_referencia}
                    onChange={(e) => actualizarDatosBasicos('nombre_referencia', e.target.value)}
                    placeholder="Ej: Impuesto Inmobiliario"
                  />
                </div>

                {/* Monto Base - Solo visible para templates FIJO */}
                {state.datos_basicos.tipo_template === 'fijo' && (
                  <div>
                    <Label htmlFor="monto_base">Monto Base *</Label>
                    <Input
                      id="monto_base"
                      type="text"
                      value={state.datos_basicos.monto_base === 0 ? '' : String(state.datos_basicos.monto_base).replace('.', ',')}
                      onChange={(e) => actualizarDatosBasicos('monto_base', parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="cuit_quien_cobra">CUIT Quien Cobra</Label>
                  <Input
                    id="cuit_quien_cobra"
                    value={state.datos_basicos.cuit_quien_cobra}
                    onChange={(e) => actualizarDatosBasicos('cuit_quien_cobra', e.target.value)}
                    placeholder="Ej: 33-XXXXXXXX-9 (ARBA)"
                  />
                </div>
                <div>
                  <Label htmlFor="nombre_quien_cobra">Nombre Quien Cobra</Label>
                  <Input
                    id="nombre_quien_cobra"
                    value={state.datos_basicos.nombre_quien_cobra}
                    onChange={(e) => actualizarDatosBasicos('nombre_quien_cobra', e.target.value)}
                    placeholder="Ej: ARBA"
                  />
                </div>
              </div>
            </TabsContent>

            {/* PASO 2: Recurrencia */}
            <TabsContent value="paso-2" className="space-y-4">
              {/* Templates abiertos - mensaje especial */}
              {state.datos_basicos.tipo_template === 'abierto' ? (
                <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg text-center">
                  <div className="text-4xl mb-4">📂</div>
                  <h4 className="text-lg font-semibold text-purple-800 mb-2">Template Abierto</h4>
                  <p className="text-sm text-purple-700 mb-4">
                    Este tipo de template no requiere configuración de recurrencia.
                  </p>
                  <p className="text-sm text-gray-600">
                    Las cuotas se agregarán manualmente usando el botón <strong>"Pago Manual"</strong>
                    disponible en la vista de Templates y Cash Flow.
                  </p>
                  <p className="text-xs text-purple-600 mt-4">
                    Ideal para: Jornales ocasionales, pagos variables, gastos no recurrentes.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Tipo de Recurrencia *</Label>
                    <RadioGroup
                      value={state.configuracion.tipo}
                      onValueChange={(value: 'mensual' | 'anual' | 'cuotas_especificas') => actualizarConfiguracion('tipo', value)}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mensual" id="mensual" />
                        <Label htmlFor="mensual">Mensual (12 cuotas fijas)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="anual" id="anual" />
                        <Label htmlFor="anual">Anual (1 cuota fija)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="cuotas_especificas" id="cuotas_especificas" />
                        <Label htmlFor="cuotas_especificas">Cuotas Específicas (meses seleccionados)</Label>
                      </div>
                    </RadioGroup>
                  </div>

              {/* Configuración Mensual */}
              {state.configuracion.tipo === 'mensual' && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ultimo_dia_mes"
                      checked={state.configuracion.ultimo_dia_mes || false}
                      onCheckedChange={(checked) => {
                        actualizarConfiguracion('ultimo_dia_mes', checked)
                        if (checked) {
                          actualizarConfiguracion('dia_mes', undefined)
                        }
                      }}
                    />
                    <Label htmlFor="ultimo_dia_mes">Último día del mes</Label>
                  </div>
                  
                  {!state.configuracion.ultimo_dia_mes && (
                    <div>
                      <Label htmlFor="dia_mes">Día del Mes *</Label>
                      <Input
                        id="dia_mes"
                        type="number"
                        min="1"
                        max="31"
                        value={state.configuracion.dia_mes || ''}
                        onChange={(e) => actualizarConfiguracion('dia_mes', parseInt(e.target.value) || 1)}
                        placeholder="15"
                      />
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="incluir_aguinaldo"
                      checked={state.configuracion.incluir_aguinaldo}
                      onCheckedChange={(checked) => actualizarConfiguracion('incluir_aguinaldo', checked)}
                    />
                    <Label htmlFor="incluir_aguinaldo">Incluir aguinaldo (Junio y Diciembre x1.5)</Label>
                  </div>
                </div>
              )}

              {/* Configuración Anual */}
              {state.configuracion.tipo === 'anual' && (
                <div>
                  <Label htmlFor="fecha_anual">Fecha Específica *</Label>
                  <Input
                    id="fecha_anual"
                    type="date"
                    value={state.configuracion.fecha_anual || ''}
                    onChange={(e) => actualizarConfiguracion('fecha_anual', e.target.value)}
                  />
                </div>
              )}

              {/* Configuración Cuotas Específicas */}
              {state.configuracion.tipo === 'cuotas_especificas' && (
                <div className="space-y-4">
                  <div>
                    <Label>Meses Específicos *</Label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                      {MESES.map(mes => (
                        <div key={mes.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`mes-${mes.value}`}
                            checked={state.configuracion.meses_especificos?.includes(mes.value) || false}
                            onCheckedChange={(checked) => {
                              const meses = state.configuracion.meses_especificos || []
                              if (checked) {
                                actualizarConfiguracion('meses_especificos', [...meses, mes.value])
                              } else {
                                actualizarConfiguracion('meses_especificos', meses.filter(m => m !== mes.value))
                              }
                            }}
                          />
                          <Label htmlFor={`mes-${mes.value}`} className="text-sm">{mes.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ultimo_dia_mes_cuotas"
                      checked={state.configuracion.ultimo_dia_mes_cuotas || false}
                      onCheckedChange={(checked) => {
                        actualizarConfiguracion('ultimo_dia_mes_cuotas', checked)
                        if (checked) {
                          actualizarConfiguracion('dia_default', undefined)
                        }
                      }}
                    />
                    <Label htmlFor="ultimo_dia_mes_cuotas">Último día del mes</Label>
                  </div>
                  
                  {!state.configuracion.ultimo_dia_mes_cuotas && (
                    <div>
                      <Label htmlFor="dia_default">Día Aproximado</Label>
                      <Input
                        id="dia_default"
                        type="number"
                        min="1"
                        max="31"
                        value={state.configuracion.dia_default || ''}
                        onChange={(e) => actualizarConfiguracion('dia_default', parseInt(e.target.value) || 15)}
                        placeholder="15"
                      />
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </TabsContent>

            {/* PASO 3: Fechas (Preview automático) */}
            <TabsContent value="paso-3" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Vista Previa de Cuotas Generadas</h3>

                {/* Mensaje especial para templates abiertos */}
                {state.datos_basicos.tipo_template === 'abierto' ? (
                  <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg text-center">
                    <div className="text-4xl mb-4">📂</div>
                    <h4 className="text-lg font-semibold text-purple-800 mb-2">Template Abierto</h4>
                    <p className="text-sm text-purple-700 mb-4">
                      Este template no genera cuotas predefinidas.
                    </p>
                    <p className="text-sm text-gray-600">
                      Las cuotas se agregarán manualmente usando el botón <strong>"Pago Manual"</strong>
                      disponible en la vista de Templates y Cash Flow.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      A continuación se muestran las cuotas que se generarán según la configuración:
                    </p>

                    {state.cuotas_generadas.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full border border-gray-200 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium">Mes</th>
                              <th className="px-4 py-2 text-left text-sm font-medium">Fecha Estimada</th>
                              <th className="px-4 py-2 text-left text-sm font-medium">Fecha Vencimiento</th>
                              <th className="px-4 py-2 text-right text-sm font-medium">Monto</th>
                              <th className="px-4 py-2 text-left text-sm font-medium">Descripción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {state.cuotas_generadas.map((cuota, index) => (
                              <tr key={index} className="border-t">
                                <td className="px-4 py-2 text-sm">{MESES[cuota.mes - 1].label}</td>
                                <td className="px-4 py-2 text-sm">{cuota.fecha_estimada}</td>
                                <td className="px-4 py-2 text-sm">{cuota.fecha_vencimiento}</td>
                                <td className="px-4 py-2 text-sm text-right">
                                  ${cuota.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-2 text-sm">{cuota.descripcion}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No se generaron cuotas. Verificar configuración.
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* PASO 4: Preview y Confirmación */}
            <TabsContent value="paso-4" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Confirmar Creación de Template</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Datos Básicos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <strong>Tipo Template:</strong>{' '}
                        <span className={state.datos_basicos.tipo_template === 'abierto' ? 'text-purple-700 font-semibold' : ''}>
                          {state.datos_basicos.tipo_template === 'abierto' ? '📂 ABIERTO' : '📋 FIJO'}
                        </span>
                      </div>
                      {state.datos_basicos.es_bidireccional && (
                        <div className="text-blue-700">
                          <strong>🔄 Bidireccional:</strong> Acepta egresos e ingresos
                        </div>
                      )}
                      <div><strong>Categoría:</strong> {state.datos_basicos.categ}</div>
                      {state.datos_basicos.cuenta_agrupadora && (
                        <div><strong>Cuenta Agrupadora:</strong> {state.datos_basicos.cuenta_agrupadora}</div>
                      )}
                      {state.datos_basicos.centro_costo && (
                        <div><strong>Centro Costo:</strong> {state.datos_basicos.centro_costo}</div>
                      )}
                      <div><strong>Referencia:</strong> {state.datos_basicos.nombre_referencia}</div>
                      <div><strong>Responsable:</strong> {state.datos_basicos.responsable}</div>
                      {state.datos_basicos.tipo_template === 'fijo' && (
                        <div><strong>Monto Base:</strong> ${state.datos_basicos.monto_base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      )}
                      {state.datos_basicos.cuit_quien_cobra && (
                        <div><strong>CUIT Cobra:</strong> {state.datos_basicos.cuit_quien_cobra}</div>
                      )}
                      {state.datos_basicos.nombre_quien_cobra && (
                        <div><strong>Nombre Cobra:</strong> {state.datos_basicos.nombre_quien_cobra}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Configuración Recurrencia</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {state.datos_basicos.tipo_template === 'abierto' ? (
                        <div className="text-purple-700">
                          <p className="mb-2"><strong>Recurrencia:</strong> Sin cuotas predefinidas</p>
                          <p><strong>Cuotas:</strong> Se agregarán manualmente con "Pago Manual"</p>
                        </div>
                      ) : (
                        <>
                          <div><strong>Recurrencia:</strong> {state.configuracion.tipo}</div>
                          {state.configuracion.tipo === 'mensual' && (
                            <>
                              <div><strong>Día del mes:</strong> {state.configuracion.ultimo_dia_mes ? 'Último día' : state.configuracion.dia_mes}</div>
                              <div><strong>Aguinaldo:</strong> {state.configuracion.incluir_aguinaldo ? 'Sí' : 'No'}</div>
                            </>
                          )}
                          {state.configuracion.tipo === 'anual' && (
                            <div><strong>Fecha:</strong> {state.configuracion.fecha_anual}</div>
                          )}
                          {state.configuracion.tipo === 'cuotas_especificas' && (
                            <>
                              <div><strong>Cantidad cuotas:</strong> {state.configuracion.meses_especificos?.length || 0}</div>
                              <div><strong>Meses:</strong> {state.configuracion.meses_especificos?.map(m => MESES[m-1].label).join(', ')}</div>
                            </>
                          )}
                          <div><strong>Total cuotas generadas:</strong> {state.cuotas_generadas.length}</div>
                          <div><strong>Monto total anual:</strong> ${state.cuotas_generadas.reduce((sum, c) => sum + c.monto, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex justify-center mt-6">
                  <Button onClick={guardarTemplate} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Crear Template
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Navegación */}
          <div className="flex justify-between mt-6">
            <Button 
              variant="outline" 
              onClick={anteriorPaso}
              disabled={state.paso === 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>
            
            <Button 
              onClick={siguientePaso}
              disabled={state.paso === 4 || !validarPaso()}
              className="flex items-center gap-2"
            >
              {state.paso === 3 ? (
                <>
                  <Eye className="h-4 w-4" />
                  Preview
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}