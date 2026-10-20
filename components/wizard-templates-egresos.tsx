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
import { CentroCostoCombobox } from "@/components/ui/centro-costo-combobox"
import { ProveedorCombobox } from "@/components/ui/proveedor-combobox"
import { Calendar, Plus, Save, ArrowLeft, ArrowRight, Eye, Check } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { TipoCuenta } from "@/lib/presupuesto/templates"
import { campanaDeFecha, periodicidadDeEmpresa, esDeOtraEmpresa } from "@/lib/templates/nuevo-desde-conciliacion"
import { generarCuotasTemplate } from "@/lib/templates/cuotas-del-template"
import { reglasDelTemplateNuevo, type ReglaCodigo } from "@/lib/templates/codigos-del-template"
import { hoyArgentina } from "@/lib/fechas"

// Tipos para el wizard
interface DatosBasicos {
  tipo_template: 'fijo' | 'abierto'
  es_bidireccional: boolean
  es_multi_cuenta: boolean
  categ: string
  /**
   * Naturaleza del template. Decide si el Presupuesto lo proyecta y en qué sección del
   * Dashboard suma. Se sugiere desde el plan de cuentas al elegir la categoría, pero se
   * guarda en el template: es su dato, no una copia.
   */
  tipo: TipoCuenta
  cuenta_agrupadora: string
  centro_costo: string
  nombre_referencia: string
  responsable: string
  cuit_quien_cobra: string
  nombre_quien_cobra: string
  monto_base: number
  periodicidad: 'anual' | 'bianual'   // anual (calendario) | bianual (campaña jul-jun)
  aplica_generacion: boolean          // entra a la regeneración automática de cuotas
  /** Sólo si difiere del responsable (responsable = contable; interno vacío = coincide). */
  responsable_interno: string
  /** 🏷️ Códigos para la cuenta que paga (regla Tipo A). Vacío = el copiado del template de origen. */
  codigo_contable: string
  codigo_interno: string
}

/** Un template existente: para no duplicar y para copiar sus datos («parecido a…»). */
interface TemplateExistente {
  id: string
  nombre_referencia: string
  responsable: string | null
  año: string | null
  categ: string | null
  cuenta_agrupadora: string | null
  centro_costo: string | null
  tipo: string | null
  tipo_template: string | null
  periodicidad: string | null
  aplica_generacion: boolean | null
  responsable_interno: string | null
  es_bidireccional: boolean | null
  configuracion_reglas: any
  cuit_quien_cobra: string | null
  nombre_quien_cobra: string | null
}

/**
 * 🧩 **A-FEAT-1302 — el MISMO asistente se abre desde la conciliación**, precargado con el movimiento.
 * Antes la conciliación tenía su propio modal, que creaba el template **sin cuotas**: Orbith quedó con
 * las 5 que fue cargando la conciliación y nada proyectado. Pedido del usuario: *«si pongo crear
 * template, que me abra el modal de creación de template en vez de un segundo modal»*.
 */
export interface WizardTemplatesProps {
  /** Lo que se precarga (nombre, monto, responsable…). */
  inicial?: Partial<DatosBasicos>
  /** La fecha del movimiento: de ahí salen la campaña y el día de las cuotas. Sin esto, hoy. */
  fechaReferencia?: string
  /** La empresa de la cuenta que paga, para avisar si el template es de otra. */
  empresaCuenta?: string
  /** La cuenta bancaria que paga (desde el extracto): ahí se guardan los códigos contable/interno. */
  cuentaBancariaId?: string
  /**
   * 🔁 A-FEAT-1302 punto 3 — **crear la campaña que falta** de un template existente: copia TODO de ése
   * (nombre, cuenta, quién cobra, recurrencia, códigos) con la campaña de `fechaReferencia`.
   */
  copiarDe?: string
  onCreado?: (templateId: string) => void
  onCancelar?: () => void
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
  /** 🪪 A-FEAT-138 — opcional: la etiqueta se genera, ya no se guarda. */
  descripcion?: string
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

const DATOS_VACIOS: DatosBasicos = {
  tipo_template: 'fijo',
  es_bidireccional: false,
  es_multi_cuenta: false,
  categ: '',
  tipo: 'egreso',
  cuenta_agrupadora: '',
  centro_costo: '',
  nombre_referencia: '',
  responsable: '',
  cuit_quien_cobra: '',
  nombre_quien_cobra: '',
  monto_base: 0,
  periodicidad: 'anual',
  aplica_generacion: true,
  responsable_interno: '',
  codigo_contable: '',
  codigo_interno: '',
}

export function WizardTemplatesEgresos({ inicial, fechaReferencia, empresaCuenta, cuentaBancariaId, copiarDe, onCreado, onCancelar }: WizardTemplatesProps = {}) {
  const [categoriasTemplates, setCategoriasTemplates] = useState<string[]>([])
  const [cuentasAgrupadoras, setCuentasAgrupadoras] = useState<string[]>([])
  /** `categ` (en mayúsculas) → tipo del plan de cuentas. Sólo para sugerir. */
  const [tipoPorCateg, setTipoPorCateg] = useState<Record<string, TipoCuenta>>({})
  /** Todas las cuentas del plan (en mayúsculas), para avisar si la elegida no está (§ 🏷️). */
  const [categsDelPlan, setCategsDelPlan] = useState<Set<string>>(new Set())
  const [existentes, setExistentes] = useState<TemplateExistente[]>([])
  const [busquedaParecido, setBusquedaParecido] = useState('')
  const [parecido, setParecido] = useState<TemplateExistente | null>(null)
  /** La cuenta sigue al nombre mientras no se la toque (la cuenta ES el template — usuario 19/10). */
  const [categTocada, setCategTocada] = useState(!!inicial?.categ)
  const [guardando, setGuardando] = useState(false)
  /** Las reglas de códigos del template de origen («Parecido a…» o la campaña que se copia). */
  const [reglasOrigen, setReglasOrigen] = useState<ReglaCodigo[]>([])
  const [copiaAplicada, setCopiaAplicada] = useState(false)
  const estadoInicial = (): WizardState => {
    const responsable = inicial?.responsable || ''
    // 📅 Desde la conciliación: el día de las cuotas es el del movimiento (se puede cambiar).
    const diaMov = fechaReferencia ? Number(String(fechaReferencia).slice(8, 10)) || undefined : undefined
    return {
      paso: 1,
      datos_basicos: {
        ...DATOS_VACIOS,
        ...(responsable ? { periodicidad: periodicidadDeEmpresa(responsable) } : {}),
        ...inicial,
        categ: inicial?.categ ?? inicial?.nombre_referencia ?? '',
      },
      configuracion: {
        tipo: 'mensual',
        dia_mes: diaMov,
        incluir_aguinaldo: false,
        ultimo_dia_mes: false,
        ultimo_dia_mes_cuotas: false
      },
      cuotas_generadas: []
    }
  }
  const [state, setState] = useState<WizardState>(estadoInicial)
  /** La campaña: la de la fecha del movimiento (o de hoy), según la periodicidad. */
  const campana = campanaDeFecha(state.datos_basicos.periodicidad, fechaReferencia || hoyArgentina())
  /**
   * 📅 A-DEC-1016 — un template **abierto no tiene campaña**: la campaña sólo sirve para generar cuotas
   * al futuro, y el abierto no las tiene (usuario 2026-10-20). Se guarda vacía.
   */
  const campanaQueSeGuarda = state.datos_basicos.tipo_template === 'abierto' || state.datos_basicos.es_multi_cuenta ? '' : campana

  // Cargar categorías y cuentas agrupadoras existentes al inicializar
  useEffect(() => {
    async function cargarOpciones() {
      try {
        const { data } = await supabase
          .from('egresos_sin_factura')
          .select('id, nombre_referencia, responsable, año, categ, cuenta_agrupadora, centro_costo, tipo, tipo_template, periodicidad, aplica_generacion, responsable_interno, es_bidireccional, configuracion_reglas, cuit_quien_cobra, nombre_quien_cobra, activo')
          .order('categ')

        if (data) {
          const filas = data as any[]
          const categsUnicas = [...new Set(filas.map(d => d.categ).filter(Boolean))] as string[]
          const agrupadoras = [...new Set(filas.map(d => d.cuenta_agrupadora).filter(Boolean))].sort() as string[]
          setCategoriasTemplates(categsUnicas)
          setCuentasAgrupadoras(agrupadoras)
          setExistentes(filas.filter(d => d.activo !== false) as TemplateExistente[])
        }

        // El tipo del plan de cuentas, para sugerirlo al elegir la categoría.
        // Es sólo una sugerencia: el valor que manda es el que se guarda en el template.
        const { data: plan, error: planError } = await supabase
          .from('cuentas_contables')
          .select('categ, tipo')
        if (planError) console.error('Error al cargar el plan de cuentas:', planError)
        const mapa: Record<string, TipoCuenta> = {}
        const todas = new Set<string>()
        for (const c of ((plan || []) as any[])) {
          if (c.categ) todas.add(String(c.categ).trim().toUpperCase())
          if (c.categ && c.tipo) mapa[String(c.categ).trim().toUpperCase()] = c.tipo
        }
        setTipoPorCateg(mapa)
        setCategsDelPlan(todas)
      } catch (error) {
        console.error('Error en cargarOpciones:', error)
      }
    }
    cargarOpciones()
  }, [])

  /**
   * 📅 A-FEAT-1302 — las cuotas salen de `lib/templates/cuotas-del-template.ts` (probadas): el año es el
   * de la CAMPAÑA, no el de hoy, y las fechas no pasan por UTC.
   */
  const generarCuotas = (): CuotaGenerada[] => generarCuotasTemplate({
    abierto: state.datos_basicos.tipo_template === 'abierto',
    config: state.configuracion,
    montoBase: state.datos_basicos.monto_base,
    campana,
    periodicidad: state.datos_basicos.periodicidad,
  })

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
  const actualizarDatosBasicos = (campo: keyof DatosBasicos, valor: string | number | boolean) => {
    setState(prev => ({
      ...prev,
      datos_basicos: { ...prev.datos_basicos, [campo]: valor }
    }))
  }

  /**
   * 🧬 «Parecido a…» (venía del modal de la conciliación, A-FEAT-1294): copia de un template existente
   * todo lo que NO es propio de éste — agrupadora, centro de costo, tipo, fijo/abierto, periodicidad,
   * regeneración, responsable interno, bidireccional y la recurrencia (día, meses). El nombre, la
   * cuenta, el monto y quién cobra quedan como están.
   */
  const elegirParecido = async (t: TemplateExistente, completo = false) => {
    setParecido(t)
    // 🏷️ Sus códigos contable/interno (reglas Tipo A, por cuenta bancaria) viajan al template nuevo.
    const { data: reglas } = await supabase.from('reglas_contable_interno')
      .select('cuenta_bancaria_id, codigo_contable, codigo_interno, descripcion, orden, activo')
      .eq('tipo_regla', 'especifica').eq('template_id', t.id)
    setReglasOrigen((reglas || []) as ReglaCodigo[])
    setState(prev => ({
      ...prev,
      datos_basicos: {
        ...prev.datos_basicos,
        // 🔁 Crear la campaña que falta: es el MISMO template en otra campaña → se copia también lo propio.
        ...(completo ? {
          nombre_referencia: t.nombre_referencia,
          categ: t.categ || prev.datos_basicos.categ,
          responsable: t.responsable || prev.datos_basicos.responsable,
          cuit_quien_cobra: t.cuit_quien_cobra || prev.datos_basicos.cuit_quien_cobra,
          nombre_quien_cobra: t.nombre_quien_cobra || prev.datos_basicos.nombre_quien_cobra,
        } : {}),
        cuenta_agrupadora: t.cuenta_agrupadora || prev.datos_basicos.cuenta_agrupadora,
        centro_costo: t.centro_costo || prev.datos_basicos.centro_costo,
        tipo: (t.tipo as TipoCuenta) || prev.datos_basicos.tipo,
        tipo_template: t.tipo_template === 'abierto' ? 'abierto' : 'fijo',
        periodicidad: t.periodicidad === 'bianual' ? 'bianual' : t.periodicidad === 'anual' ? 'anual' : prev.datos_basicos.periodicidad,
        aplica_generacion: !!t.aplica_generacion,
        responsable_interno: t.responsable_interno || '',
        es_bidireccional: !!t.es_bidireccional,
      },
      configuracion: t.configuracion_reglas?.tipo ? { ...prev.configuracion, ...t.configuracion_reglas } : prev.configuracion,
    }))
    if (completo) setCategTocada(true)
  }
  // 🔁 «Crear campaña» desde el auditar: apenas se cargan los templates, se copia el de origen.
  useEffect(() => {
    if (!copiarDe || copiaAplicada || existentes.length === 0) return
    const origen = existentes.find(t => t.id === copiarDe)
    if (origen) { setCopiaAplicada(true); void elegirParecido(origen, true) }
  }, [copiarDe, copiaAplicada, existentes])
  /** Los códigos copiados para la cuenta que paga: se muestran como valor por default. */
  const reglaDeLaCuenta = cuentaBancariaId ? reglasOrigen.find(r => r.cuenta_bancaria_id === cuentaBancariaId) : undefined
  const textoParecido = busquedaParecido.trim().toLowerCase()
  const parecidos = textoParecido
    ? existentes.filter(t => [t.nombre_referencia, t.cuenta_agrupadora, t.categ, t.responsable]
        .some(v => (v || '').toLowerCase().includes(textoParecido))).slice(0, 30)
    : []
  /** ⚠️ Ya hay uno igual (mismo nombre, responsable y campaña): crearlo de nuevo lo duplicaría. */
  const duplicado = existentes.find(t =>
    (t.nombre_referencia || '').trim().toLowerCase() === state.datos_basicos.nombre_referencia.trim().toLowerCase()
    && (t.responsable || '') === state.datos_basicos.responsable && (t.año || '') === campanaQueSeGuarda)
  const categFueraDelPlan = !!state.datos_basicos.categ.trim() && categsDelPlan.size > 0
    && !categsDelPlan.has(state.datos_basicos.categ.trim().toUpperCase())

  // La cuenta sigue al nombre mientras no se la toque.
  useEffect(() => {
    if (categTocada || state.datos_basicos.es_multi_cuenta) return
    setState(prev => prev.datos_basicos.categ === prev.datos_basicos.nombre_referencia ? prev
      : { ...prev, datos_basicos: { ...prev.datos_basicos, categ: prev.datos_basicos.nombre_referencia } })
  }, [state.datos_basicos.nombre_referencia, categTocada, state.datos_basicos.es_multi_cuenta])

  // Función para actualizar configuración
  const actualizarConfiguracion = (campo: keyof ConfiguracionRecurrencia, valor: any) => {
    setState(prev => ({
      ...prev,
      configuracion: { ...prev.configuracion, [campo]: valor }
    }))
  }

  // Función para guardar template
  const guardarTemplate = async () => {
    if (guardando) return
    setGuardando(true)
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
      // "año": anual = año calendario; bianual = etiqueta de campaña (jul-jun), p.ej. "26/27".
      // 📅 A-FEAT-1302 — la de la fecha del movimiento si viene de la conciliación; si no, la de hoy.
      // 📅 A-DEC-1016 — abierto: sin campaña.
      const valorAnio = campanaQueSeGuarda || null
      const { data: egresoData, error: egresoError } = await supabase
        .from('egresos_sin_factura')
        .insert({
          template_master_id: templateMaster.id,
          categ: esMultiCuenta ? null : state.datos_basicos.categ,
          tipo: state.datos_basicos.tipo,
          cuenta_agrupadora: esMultiCuenta ? null : (state.datos_basicos.cuenta_agrupadora || null),
          centro_costo: state.datos_basicos.centro_costo,
          nombre_referencia: state.datos_basicos.nombre_referencia,
          responsable: state.datos_basicos.responsable,
          cuit_quien_cobra: state.datos_basicos.cuit_quien_cobra || null,
          nombre_quien_cobra: state.datos_basicos.nombre_quien_cobra || null,
          responsable_interno: state.datos_basicos.responsable_interno.trim() || null,
          tipo_recurrencia: esMultiCuenta ? 'abierto' : (esAbierto ? 'abierto' : state.configuracion.tipo),
          tipo_template: esMultiCuenta ? 'abierto' : state.datos_basicos.tipo_template,
          es_bidireccional: state.datos_basicos.es_bidireccional, // multi-cuenta + bidireccional ahora conviven (cobros con sub-cuentas)
          es_multi_cuenta: esMultiCuenta,
          configuracion_reglas: (esAbierto || esMultiCuenta) ? null : state.configuracion,
          año: valorAnio,
          periodicidad: state.datos_basicos.periodicidad,
          aplica_generacion: esAbierto ? false : state.datos_basicos.aplica_generacion,
          // 🔁 Campaña creada desde el auditar: queda el vínculo con la anterior, como hace el generador.
          ...(copiarDe ? { template_origen_id: copiarDe } : {}),
          activo: true
        })
        .select()
        .single()

      if (egresoError) throw egresoError

      // 2.b 🏷️ Códigos contable/interno: los del template de origen + lo escrito para la cuenta que paga.
      const reglasNuevas = reglasDelTemplateNuevo({
        origen: reglasOrigen, templateId: egresoData.id, cuentaBancariaId,
        contable: state.datos_basicos.codigo_contable, interno: state.datos_basicos.codigo_interno,
      })
      if (reglasNuevas.length > 0) {
        const { error: reglasError } = await supabase.from('reglas_contable_interno').insert(reglasNuevas)
        // El template ya está creado: un error acá se avisa, no deshace todo.
        if (reglasError) toast.error(`Template creado, pero no se guardaron los códigos contable/interno: ${reglasError.message}`)
      }

      // 3. Crear cuotas generadas (solo si NO es abierto)
      if (state.cuotas_generadas.length > 0) {
        const cuotasParaInsertar = state.cuotas_generadas.map(cuota => ({
          egreso_id: egresoData.id,
          mes: cuota.mes,
          fecha_estimada: cuota.fecha_estimada,
          fecha_vencimiento: cuota.fecha_vencimiento,
          monto: cuota.monto,
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

      // Desde la conciliación: se devuelve el template creado (la conciliación elige la cuota del mes).
      if (onCreado) { onCreado(egresoData.id); return }

      // Reset wizard
      setState({ paso: 1, datos_basicos: { ...DATOS_VACIOS },
        configuracion: { tipo: 'mensual', incluir_aguinaldo: false, ultimo_dia_mes: false, ultimo_dia_mes_cuotas: false },
        cuotas_generadas: [] })
      setParecido(null); setBusquedaParecido(''); setCategTocada(false); setReglasOrigen([])
    } catch (error) {
      console.error('Error guardando template:', error)
      toast.error(`Error al crear template: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally { setGuardando(false) }
  }

  // Validar paso actual
  const validarPaso = (): boolean => {
    const esAbierto = state.datos_basicos.tipo_template === 'abierto'
    const esMultiCuenta = state.datos_basicos.es_multi_cuenta

    switch (state.paso) {
      case 1:
        // Multi-cuenta: no requiere categ. Abierto normal: no requiere monto_base.
        // A-FEAT-1297 — quién cobra es obligatorio (sin él, el movimiento conciliado queda sin proveedor).
        return !!(
          (esMultiCuenta || state.datos_basicos.categ) &&
          state.datos_basicos.nombre_referencia &&
          state.datos_basicos.responsable &&
          state.datos_basicos.nombre_quien_cobra.trim() &&
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
              {/* 🧬 A-FEAT-1302 — «Parecido a…»: buscar antes de crear, y copiar los datos del más parecido. */}
              <div className="p-3 border rounded-lg">
                <Label className="text-sm font-medium">Parecido a… <span className="text-gray-400 font-normal">(buscá si ya existe; si no, elegí uno para copiar sus datos)</span></Label>
                <Input value={busquedaParecido} onChange={e => setBusquedaParecido(e.target.value)} placeholder="Nombre, agrupadora, cuenta o empresa…" className="mt-1" />
                {parecidos.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded border divide-y">
                    {parecidos.map(t => (
                      <button key={t.id} type="button" onClick={() => elegirParecido(t)}
                        className={`w-full text-left px-2 py-1 text-xs hover:bg-gray-50 ${parecido?.id === t.id ? 'bg-blue-50' : ''}`}>
                        <b>{t.nombre_referencia}</b> · {t.responsable || '—'} · {t.año || 'sin campaña'} · {t.tipo_template === 'abierto' ? 'abierto' : 'fijo'} · {t.cuenta_agrupadora || 'sin agrupadora'}
                      </button>
                    ))}
                  </div>
                )}
                {parecido && (
                  <p className="mt-1 text-xs text-blue-700">
                    Copiado de «{parecido.nombre_referencia}» ({parecido.responsable}): agrupadora, centro de costo, tipo, fijo/abierto,
                    periodicidad, regeneración, responsable interno, bidireccional y recurrencia
                    {reglasOrigen.length > 0 ? `, y los códigos contable/interno de ${reglasOrigen.length} cuenta(s)` : ''}.
                    {copiarDe && parecido.id === copiarDe ? ' Es la campaña nueva del mismo template: también nombre, cuenta, responsable y quién cobra.' : ''}
                  </p>
                )}
              </div>
              {state.datos_basicos.tipo_template === 'abierto' ? (
                <p className="text-xs text-gray-600">
                  Abierto: <b>sin campaña</b> y sin cuotas precargadas — las carga cada movimiento (comisiones, peajes,
                  gastos que no se presupuestan uno por uno).
                </p>
              ) : (
                <p className="text-xs text-gray-600">
                  Campaña <b>{campana || '—'}</b>
                  {fechaReferencia ? ` (la del movimiento del ${fechaReferencia.split('-').reverse().join('/')})` : ' (la de hoy)'}.
                  {' '}Las cuotas quedan presupuestadas con sus vencimientos{fechaReferencia ? ', y el movimiento se ata a la de su mes' : ''}.
                </p>
              )}
              {duplicado && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠️ Ya existe «{duplicado.nombre_referencia}» de {duplicado.responsable} para la campaña {campana}: si es el mismo, cerrá esto y elegilo en la lista.
                </p>
              )}
              {empresaCuenta && esDeOtraEmpresa(state.datos_basicos.responsable, empresaCuenta) && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  ⚠️ El template es de <b>{state.datos_basicos.responsable}</b> y lo paga una cuenta de <b>{empresaCuenta}</b>: queda como pago de una empresa por cuenta de otra.
                </p>
              )}
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
                    📂 <strong>Template Abierto:</strong> sin campaña, sin cuotas precargadas y sin regeneración —
                    cada movimiento que se concilia le carga su cuota.
                  </div>
                )}

                {/* 📅 A-DEC-1016 — periodicidad y regeneración son de la CAMPAÑA: un abierto no tiene, no se preguntan. */}
                {state.datos_basicos.tipo_template !== 'abierto' && (<>
                {/* Periodicidad: anual (calendario) vs bianual (campaña jul-jun) */}
                <div className="mt-4">
                  <Label className="text-sm font-medium">Periodicidad *</Label>
                  <RadioGroup
                    value={state.datos_basicos.periodicidad}
                    onValueChange={(value: 'anual' | 'bianual') => actualizarDatosBasicos('periodicidad', value)}
                    className="mt-2 flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="anual" id="per_anual" />
                      <Label htmlFor="per_anual" className="font-normal">
                        <span className="font-medium">Anual</span>
                        <span className="text-sm text-gray-500 ml-2">(año calendario, ej. 2026)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="bianual" id="per_bianual" />
                      <Label htmlFor="per_bianual" className="font-normal">
                        <span className="font-medium">Bianual</span>
                        <span className="text-sm text-gray-500 ml-2">(campaña jul–jun, ej. 26/27)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Aplica a la regeneración automática de cuotas (renovar campaña/año) */}
                <div className="mt-4 flex items-center space-x-2">
                  <Checkbox
                    id="aplica_generacion"
                    checked={state.datos_basicos.aplica_generacion}
                    onCheckedChange={(checked) => actualizarDatosBasicos('aplica_generacion', checked === true)}
                  />
                  <Label htmlFor="aplica_generacion" className="font-normal">
                    <span className="font-medium">♻️ Entra a la regeneración automática</span>
                    <span className="text-sm text-gray-500 ml-2">(se le crean las cuotas del próximo período al renovar). Destildar los que se cargan solos por conciliación.</span>
                  </Label>
                </div>
                </>)}

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
                            // (ya NO se apaga bidireccional: multi-cuenta puede aceptar cobros)
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
                      onChange={(e) => {
                        const v = e.target.value
                        setCategTocada(true)
                        actualizarDatosBasicos('categ', v)
                        // Si esa categoría está en el plan, sugerir su tipo (se puede pisar abajo).
                        const sug = tipoPorCateg[v.trim().toUpperCase()]
                        if (sug) actualizarDatosBasicos('tipo', sug)
                      }}
                      placeholder="Seleccionar o escribir nueva categoría"
                    />
                    <datalist id="categs-existentes">
                      {categoriasTemplates.map(categ => (
                        <option key={categ} value={categ} />
                      ))}
                    </datalist>
                    <p className="text-xs text-gray-500 mt-1">
                      Por default, el nombre del template. Escriba para buscar o cree una nueva
                    </p>
                    {categFueraDelPlan && (
                      <p className="text-xs text-amber-700 mt-1">
                        ⚠️ «{state.datos_basicos.categ}» no está en el plan de cuentas: el presupuesto no va a saber de qué tipo es. Conviene darla de alta.
                      </p>
                    )}
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

                {/* Tipo — decide si el Presupuesto lo proyecta y dónde suma en el Dashboard */}
                <div>
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select
                    value={state.datos_basicos.tipo}
                    onValueChange={(v) => actualizarDatosBasicos('tipo', v as TipoCuenta)}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="egreso">Egreso — gasto de verdad (se presupuesta)</SelectItem>
                      <SelectItem value="distribucion">Distribución — retiro de socios (se presupuesta)</SelectItem>
                      <SelectItem value="financiero">Financiero — la plata no sale de la empresa (NO se presupuesta)</SelectItem>
                      <SelectItem value="ingreso">Ingreso — entra plata</SelectItem>
                      <SelectItem value="NO">No computar</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {tipoPorCateg[state.datos_basicos.categ.trim().toUpperCase()]
                      ? 'Sugerido desde el plan de cuentas por la categoría elegida. Se puede cambiar.'
                      : 'Colocaciones, transferencias entre cuentas propias y pago de tarjeta son "financiero": no se proyectan como gasto.'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="centro_costo">Centro de Costo</Label>
                  <CentroCostoCombobox
                    value={state.datos_basicos.centro_costo}
                    onValueChange={(v) => actualizarDatosBasicos('centro_costo', v)}
                    placeholder="Centro de costo (opcional)"
                    className="w-full"
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
                  <Label htmlFor="responsable_interno">Responsable interno</Label>
                  <Input id="responsable_interno" value={state.datos_basicos.responsable_interno}
                    onChange={(e) => actualizarDatosBasicos('responsable_interno', e.target.value)}
                    placeholder="Sólo si difiere del responsable" />
                </div>

                {/* 🏷️ A-FEAT-1302 punto 2 — códigos contable/interno (regla Tipo A de la cuenta que paga).
                    Vacío = el copiado del template de origen, que se ve como sugerencia. */}
                {cuentaBancariaId ? (
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="codigo_contable">Código contable <span className="text-gray-400 font-normal">(para esta cuenta)</span></Label>
                      <Input id="codigo_contable" value={state.datos_basicos.codigo_contable}
                        onChange={(e) => actualizarDatosBasicos('codigo_contable', e.target.value)}
                        placeholder={reglaDeLaCuenta?.codigo_contable ? `${reglaDeLaCuenta.codigo_contable} (copiado)` : 'Ej: RET 3 PAM, Desglosar…'} />
                    </div>
                    <div>
                      <Label htmlFor="codigo_interno">Código interno <span className="text-gray-400 font-normal">(para esta cuenta)</span></Label>
                      <Input id="codigo_interno" value={state.datos_basicos.codigo_interno}
                        onChange={(e) => actualizarDatosBasicos('codigo_interno', e.target.value)}
                        placeholder={reglaDeLaCuenta?.codigo_interno ? `${reglaDeLaCuenta.codigo_interno} (copiado)` : 'Vacío = coincide'} />
                    </div>
                  </div>
                ) : reglasOrigen.length > 0 ? (
                  <p className="col-span-2 text-xs text-gray-600">
                    Códigos contable/interno: se copian los de «{parecido?.nombre_referencia}» ({reglasOrigen.length} cuenta(s)).
                    Para cambiarlos: Conciliación → Contable/Interno.
                  </p>
                ) : null}

                <div className="col-span-2">
                  <ProveedorCombobox
                    label="Quién cobra *"
                    value={{ cuit: state.datos_basicos.cuit_quien_cobra, nombre: state.datos_basicos.nombre_quien_cobra }}
                    onChange={(sel) => {
                      actualizarDatosBasicos('cuit_quien_cobra', sel.cuit)
                      actualizarDatosBasicos('nombre_quien_cobra', sel.nombre)
                    }}
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
                      <div><strong>Tipo:</strong> {state.datos_basicos.tipo}
                        {state.datos_basicos.tipo === 'financiero' && (
                          <span className="text-violet-700"> — no se va a presupuestar</span>
                        )}
                      </div>
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
                  <Button onClick={guardarTemplate} disabled={guardando} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Crear Template
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Navegación */}
          <div className="flex justify-between mt-6">
            <div className="flex gap-2">
              {onCancelar && (
                <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
              )}
              <Button
                variant="outline"
                onClick={anteriorPaso}
                disabled={state.paso === 1}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>
            </div>
            
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