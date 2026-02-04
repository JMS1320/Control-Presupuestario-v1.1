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
  categ: string
  centro_costo: string
  nombre_referencia: string
  responsable: string
  cuit_quien_cobra: string
  nombre_quien_cobra: string
  monto_base: number
}

interface CuentaContable {
  categ: string
  cuenta_contable: string
  tipo: string
}

interface ConfiguracionRecurrencia {
  tipo: 'mensual' | 'anual' | 'cuotas_especificas' | 'abierto'
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
  const [cuentasContables, setCuentasContables] = useState<CuentaContable[]>([])
  const [state, setState] = useState<WizardState>({
    paso: 1,
    datos_basicos: {
      categ: '',
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

  // Cargar cuentas contables al inicializar
  useEffect(() => {
    async function cargarCuentasContables() {
      try {
        const { data, error } = await supabase
          .from('cuentas_contables')
          .select('categ, cuenta_contable, tipo')
          .order('categ')

        if (error) {
          console.error('Error cargando cuentas contables:', error)
          return
        }

        if (data) {
          setCuentasContables(data)
        }
      } catch (error) {
        console.error('Error en cargarCuentasContables:', error)
      }
    }

    cargarCuentasContables()
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
    if (configuracion.tipo === 'abierto') {
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
      const esAbierto = state.configuracion.tipo === 'abierto'
      const { data: egresoData, error: egresoError } = await supabase
        .from('egresos_sin_factura')
        .insert({
          template_master_id: templateMaster.id,
          categ: state.datos_basicos.categ,
          centro_costo: state.datos_basicos.centro_costo,
          nombre_referencia: state.datos_basicos.nombre_referencia,
          responsable: state.datos_basicos.responsable,
          cuit_quien_cobra: state.datos_basicos.cuit_quien_cobra || null,
          nombre_quien_cobra: state.datos_basicos.nombre_quien_cobra || null,
          tipo_recurrencia: state.configuracion.tipo,
          tipo_template: esAbierto ? 'abierto' : 'fijo', // NUEVO: tipo_template
          configuracion_reglas: state.configuracion,
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
          categ: '',
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
    const esAbierto = state.configuracion.tipo === 'abierto'

    switch (state.paso) {
      case 1:
        // Para templates abiertos, NO requerir monto_base
        return !!(
          state.datos_basicos.categ &&
          state.datos_basicos.nombre_referencia &&
          state.datos_basicos.responsable &&
          (esAbierto || state.datos_basicos.monto_base > 0)
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="categ">Cuenta Contable (CATEG) *</Label>
                  <Select 
                    value={state.datos_basicos.categ} 
                    onValueChange={(value) => actualizarDatosBasicos('categ', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cuenta contable" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuentasContables.map(cuenta => (
                        <SelectItem key={cuenta.categ} value={cuenta.categ}>
                          {cuenta.categ} - {cuenta.cuenta_contable}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="centro_costo">Centro de Costo</Label>
                  <Input
                    id="centro_costo"
                    value={state.datos_basicos.centro_costo}
                    onChange={(e) => actualizarDatosBasicos('centro_costo', e.target.value)}
                    placeholder="Ej: ADM (opcional)"
                  />
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
                <div>
                  <Label htmlFor="monto_base">Monto Base *</Label>
                  <Input
                    id="monto_base"
                    type="number"
                    step="0.01"
                    value={state.datos_basicos.monto_base}
                    onChange={(e) => actualizarDatosBasicos('monto_base', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
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
              <div>
                <Label>Tipo de Recurrencia *</Label>
                <RadioGroup
                  value={state.configuracion.tipo}
                  onValueChange={(value) => actualizarConfiguracion('tipo', value)}
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
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="abierto" id="abierto" />
                    <Label htmlFor="abierto" className="text-purple-700">
                      Abierto (sin cuotas predefinidas - agregar manualmente)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Información para Template Abierto */}
              {state.configuracion.tipo === 'abierto' && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>Template Abierto:</strong> No se generarán cuotas automáticamente.
                    Las cuotas se agregarán manualmente desde el botón <strong>"Pago Manual"</strong> en la vista de Templates o Cash Flow.
                  </p>
                  <p className="text-xs text-purple-600 mt-2">
                    Ideal para: Jornales ocasionales, pagos variables, gastos no recurrentes.
                  </p>
                </div>
              )}

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
            </TabsContent>

            {/* PASO 3: Fechas (Preview automático) */}
            <TabsContent value="paso-3" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-4">Vista Previa de Cuotas Generadas</h3>

                {/* Mensaje especial para templates abiertos */}
                {state.configuracion.tipo === 'abierto' ? (
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
                      <div><strong>Cuenta:</strong> {state.datos_basicos.categ}</div>
                      <div><strong>Centro Costo:</strong> {state.datos_basicos.centro_costo}</div>
                      <div><strong>Referencia:</strong> {state.datos_basicos.nombre_referencia}</div>
                      <div><strong>Responsable:</strong> {state.datos_basicos.responsable}</div>
                      <div><strong>Monto Base:</strong> ${state.datos_basicos.monto_base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
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
                      <CardTitle className="text-base">Configuración</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><strong>Tipo:</strong> {state.configuracion.tipo === 'abierto' ? '📂 ABIERTO' : state.configuracion.tipo}</div>
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
                      {state.configuracion.tipo === 'abierto' ? (
                        <div className="text-purple-700">
                          <strong>Cuotas:</strong> Se agregarán manualmente con "Pago Manual"
                        </div>
                      ) : (
                        <>
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