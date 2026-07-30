"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronDown, Loader2, TrendingDown, TrendingUp, Scale } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  tonsCuota,
  tonsFijadas,
  estadoDerivado,
  resolverPrecioCuota,
  modoPrecioSegunFecha,
  montoVenta,
  puedeMoverCuota,
  fechaMinimaDisponible,
  type PrecioGrano,
  type TipoCambio,
  type EstadoCuota,
} from "@/lib/arrendamientos/calculo"
import {
  calcularGanaderia,
  type PresupuestoGanaderia,
  type PrecioHacienda,
} from "@/lib/ganaderia/calculo"
import {
  valuarLoteConPrecios, cantidadDisponible, pesoEstimado,
  type LoteStock, type VentaStock,
} from "@/lib/ganaderia/ciclo"

// ── Helpers ───────────────────────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function fmt(n: number) {
  if (n === 0) return <span className="text-gray-300">—</span>
  return <span>${Math.round(n).toLocaleString("es-AR")}</span>
}

function getMeses(cantidad: number): { anio: number; mes: number; label: string }[] {
  const hoy = new Date()
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    return {
      anio: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
    }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FilaTemplate {
  id: string
  nombre: string                       // nombre_referencia
  agrupador: string                    // cuenta_agrupadora
  categ: string
  montos: Record<string, number>       // clave: "YYYY-MM"
}

interface FilaSueldo {
  id: string
  nombre: string
  montos: Record<string, number>
}

interface Agrupador {
  nombre: string
  expandido: boolean
  templates: FilaTemplate[]
}

/**
 * INGRESOS — arrendamientos agrícolas. Tres filas por campo (centro de costo):
 *   fijado        → precio cerrado, con factura. Plata comprometida.
 *   presupuestado → tons sin fijar × Matba(posición) × TC. Proyección.
 *   disponible    → tons cuya fecha de cobro ya pasó sin fijar.
 * Ver DISEÑO_PRESUPUESTO.md § INGRESOS — Arrendamientos agrícolas.
 */
interface FilaCampo {
  campo: string
  empresa: string
  fijado: Record<string, number>
  presupuestado: Record<string, number>
  disponible: Record<string, number>
  /** Tons sin fijar por mes — para el badge del "disponible a fijar". */
  tonsDisponibles: Record<string, number>
  /** Meses cuyo precio o TC se arrastró de otro mes (celda estimada). */
  estimado: Record<string, boolean>
}

/** Cuota individual detrás de una celda — para poder moverla y valorizarla. */
interface CuotaDetalle {
  id: string
  campo: string
  campania: string
  numeroCuota: number
  tonsPend: number
  fechaCobro: string
  posicionAnio: number
  posicionMes: number
  /** ARS/ton ya resuelto (pizarra directa o Matba × TC). */
  pesosPorTon: number
  modo: "pizarra" | "matba"
  precioUsd: number | null
  precioManual: boolean
  precioArrastrado: boolean
  tc: number | null
  monto: number
  estado: EstadoCuota
  /** Días de cobro del disponible del contrato (Sanpa 15, resto 20). */
  diasCobro: number
  fechaOriginal: string | null
  posOrigAnio: number | null
  posOrigMes: number | null
}

// ── Componente principal ──────────────────────────────────────────────────────

export function TabPresupuesto() {
  const [cargando, setCargando] = useState(true)
  const [agrupadores, setAgrupadores] = useState<Agrupador[]>([])
  const [sueldoFilas, setSueldoFilas] = useState<FilaSueldo[]>([])
  const [campos, setCampos] = useState<FilaCampo[]>([])
  // Ganadería: una fila por proyección, con su IIBB derivado el mes siguiente al cobro
  const [ganaderia, setGanaderia] = useState<{
    nombre: string; montos: Record<string, number>; iibb: Record<string, number>; estimado: boolean
  }[]>([])
  /**
   * Hacienda: dos capas, igual que el arrendamiento.
   *  · presupuestado → lote con fecha de venta → monto en el mes de cobro
   *  · disponible    → lote SIN fecha → no hay plata, se muestran cabezas y kg
   */
  const [hacienda, setHacienda] = useState<{
    presupuestado: Record<string, number>
    estimado: Record<string, boolean>
    disponible: { categoria: string; cabezas: number; kg: number }[]
  }>({ presupuestado: {}, estimado: {}, disponible: [] })
  // Cuotas detrás de cada celda: clave `${campo}|${YYYY-MM}|${presupuestado|disponible}`
  const [detalleCeldas, setDetalleCeldas] = useState<Record<string, CuotaDetalle[]>>({})
  const [modalCuotas, setModalCuotas] = useState<{ titulo: string; cuotas: CuotaDetalle[] } | null>(null)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  // 24 meses: las cuotas de arrendamiento llegan hasta may-2028 (campaña 27/28)
  const meses = useMemo(() => getMeses(24), [])

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      await Promise.all([cargarTemplates(), cargarSueldos(), cargarIngresos(), cargarGanaderia(), cargarHacienda()])
    } finally {
      setCargando(false)
    }
  }

  const cargarTemplates = async () => {
    // Traer templates activos MSA (responsable contiene MSA)
    const { data: templates } = await supabase
      .from("egresos_sin_factura")
      .select("id, nombre_referencia, categ, cuenta_agrupadora, responsable")
      .eq("activo", true)
      .or("responsable.ilike.%MSA%,responsable.eq.ambas")
      .not("cuenta_agrupadora", "is", null)
      .order("cuenta_agrupadora")

    if (!templates || templates.length === 0) return

    const templateIds = templates.map(t => t.id)

    // Rango: primer día del primer mes → primer día del mes SIGUIENTE al último (exclusivo).
    // Ojo: no armar el tope con "-31" fijo — si el último mes no tiene 31 días
    // (p.ej. "2028-06-31") Postgres rechaza la fecha y la query falla ENTERA, con lo que
    // los templates desaparecen de la vista sin ningún aviso.
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]
    const fechaDesde = `${primerMes.anio}-${String(primerMes.mes).padStart(2,"0")}-01`
    const finExclusivo = new Date(ultimoMes.anio, ultimoMes.mes, 1) // mes es 1-based → mes siguiente
    const fechaHasta = `${finExclusivo.getFullYear()}-${String(finExclusivo.getMonth()+1).padStart(2,"0")}-01`

    // Traer cuotas del período
    const { data: cuotas, error: errorCuotas } = await supabase
      .from("cuotas_egresos_sin_factura")
      .select("egreso_id, fecha_estimada, fecha_vencimiento, monto, estado")
      .in("egreso_id", templateIds)
      .gte("fecha_estimada", fechaDesde)
      .lt("fecha_estimada", fechaHasta)
      .neq("estado", "desactivado")
      .neq("estado", "conciliado")

    if (errorCuotas) console.error("Error cargando cuotas de templates:", errorCuotas)

    // Armar mapa egreso_id → { "YYYY-MM": suma_montos }
    const mapaMontos: Record<string, Record<string, number>> = {}
    for (const c of cuotas || []) {
      const fecha = c.fecha_estimada || c.fecha_vencimiento
      if (!fecha) continue
      const clave = fecha.slice(0, 7) // "YYYY-MM"
      if (!mapaMontos[c.egreso_id]) mapaMontos[c.egreso_id] = {}
      mapaMontos[c.egreso_id][clave] = (mapaMontos[c.egreso_id][clave] || 0) + Number(c.monto || 0)
    }

    // Construir filas por agrupador
    const mapaAgrupadores: Record<string, FilaTemplate[]> = {}
    for (const t of templates) {
      const agrupador = t.cuenta_agrupadora || "Sin agrupador"
      if (!mapaAgrupadores[agrupador]) mapaAgrupadores[agrupador] = []
      mapaAgrupadores[agrupador].push({
        id: t.id,
        nombre: t.nombre_referencia,
        agrupador,
        categ: t.categ,
        montos: mapaMontos[t.id] || {},
      })
    }

    // Filtrar agrupadores que tienen al menos algún monto en el período
    const listaAgrupadores: Agrupador[] = Object.entries(mapaAgrupadores)
      .filter(([, filas]) => filas.some(f => Object.values(f.montos).some(m => m > 0)))
      .map(([nombre, filas]) => ({ nombre, expandido: false, templates: filas }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))

    setAgrupadores(listaAgrupadores)

    // Inicializar todos colapsados
    const initExpand: Record<string, boolean> = {}
    listaAgrupadores.forEach(a => { initExpand[a.nombre] = false })
    setExpandidos(initExpand)
  }

  // ── INGRESOS: arrendamientos agrícolas ──────────────────────────────────────
  const cargarIngresos = async () => {
    const { data: contratos } = await supabase
      .from("contratos_arrendamiento")
      .select("id, empresa, campania, centro_costo, has, qq_ha_total, grano, dias_cobro_disponible")
      .eq("empresa", "MSA")
      .eq("activo", true)

    if (!contratos || contratos.length === 0) { setCampos([]); return }

    const contratoIds = contratos.map(c => c.id)

    const [{ data: cuotas }, { data: precios }, { data: tcs }] = await Promise.all([
      supabase
        .from("cuotas_arrendamiento")
        .select("id, contrato_id, numero_cuota, qq_ha_cuota, fecha_cobro_estimada, posicion_anio, posicion_mes, estado, precio_usd_override, precio_pesos_override, fecha_cobro_original, posicion_orig_anio, posicion_orig_mes")
        .in("contrato_id", contratoIds),
      supabase.from("precios_granos").select("grano, anio, mes, precio_usd"),
      supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
    ])

    const cuotaIds = (cuotas || []).map(c => c.id)
    const { data: fijaciones } = cuotaIds.length
      ? await supabase
          .from("ventas_arrendamiento")
          .select("cuota_id, tons, modo, precio_usd, tc, precio_pesos, monto_pesos, fecha_cobro")
          .in("cuota_id", cuotaIds)
      : { data: [] as any[] }

    const listaPrecios = (precios || []) as PrecioGrano[]
    const listaTC = (tcs || []) as TipoCambio[]

    // Fijaciones por cuota
    const fijPorCuota: Record<string, any[]> = {}
    for (const f of fijaciones || []) {
      if (!fijPorCuota[f.cuota_id]) fijPorCuota[f.cuota_id] = []
      fijPorCuota[f.cuota_id].push(f)
    }

    const nuevaFila = (campo: string, empresa: string): FilaCampo => ({
      campo, empresa,
      fijado: {}, presupuestado: {}, disponible: {}, tonsDisponibles: {}, estimado: {},
    })

    const mapaCampos: Record<string, FilaCampo> = {}
    const mapaDetalle: Record<string, CuotaDetalle[]> = {}
    const hoy = new Date()
    const claveMesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`

    for (const contrato of contratos) {
      const clave = contrato.centro_costo
      if (!mapaCampos[clave]) mapaCampos[clave] = nuevaFila(clave, contrato.empresa)
      const fila = mapaCampos[clave]

      for (const cuota of (cuotas || []).filter(q => q.contrato_id === contrato.id)) {
        const fijs = fijPorCuota[cuota.id] || []

        // 1) Vendido (fijado). Si el precio está fijado pero el TC todavía no, el monto
        //    en pesos se estima con el TC del mes de cobro y la celda queda marcada.
        for (const f of fijs) {
          const k = String(f.fecha_cobro ?? cuota.fecha_cobro_estimada).slice(0, 7)
          const m = montoVenta(f as any, listaTC)
          fila.fijado[k] = (fila.fijado[k] || 0) + m.monto
          if (m.estimado) fila.estimado[k] = true
        }

        // 2) Lo que queda sin fijar
        const tonsTot = tonsCuota(Number(contrato.has), Number(cuota.qq_ha_cuota))
        const tonsPend = tonsTot - tonsFijadas(fijs)
        if (tonsPend <= 0.001) continue

        // Precio ARS/ton: pizarra en pesos (mes actual) o Matba USD × TC (meses futuros)
        const p = resolverPrecioCuota(contrato as any, cuota as any, listaPrecios, listaTC)
        const monto = tonsPend * p.pesos_por_ton

        // El estado se DERIVA (fijaciones + fecha), no se lee de la columna: la columna
        // se desactualiza sola cuando pasa la fecha de cobro. Si no se fijó y ya venció,
        // las tons quedan DISPONIBLES y se muestran en el mes actual hasta que el usuario
        // les asigne fecha nueva (el selector propone el mes siguiente por default).
        const est = estadoDerivado(
          Number(contrato.has), Number(cuota.qq_ha_cuota), fijs, cuota.fecha_cobro_estimada, hoy,
        )
        const vencida = est === 'disponible'
        const k = vencida ? claveMesActual : String(cuota.fecha_cobro_estimada).slice(0, 7)

        if (vencida) {
          fila.disponible[k] = (fila.disponible[k] || 0) + monto
          fila.tonsDisponibles[k] = (fila.tonsDisponibles[k] || 0) + tonsPend
        } else {
          fila.presupuestado[k] = (fila.presupuestado[k] || 0) + monto
        }
        if (p.arrastrado) fila.estimado[k] = true

        // Detalle clickeable: qué cuotas hay detrás de esta celda
        const claveDetalle = `${clave}|${k}|${vencida ? "disponible" : "presupuestado"}`
        if (!mapaDetalle[claveDetalle]) mapaDetalle[claveDetalle] = []
        mapaDetalle[claveDetalle].push({
          id: cuota.id,
          campo: clave,
          campania: contrato.campania,
          numeroCuota: cuota.numero_cuota,
          tonsPend,
          fechaCobro: String(cuota.fecha_cobro_estimada),
          posicionAnio: cuota.posicion_anio,
          posicionMes: cuota.posicion_mes,
          pesosPorTon: p.pesos_por_ton,
          modo: p.modo,
          precioUsd: p.precio_usd,
          precioManual: p.manual,
          precioArrastrado: p.arrastrado,
          tc: p.tc,
          monto,
          estado: est,
          diasCobro: Number(contrato.dias_cobro_disponible ?? 20),
          fechaOriginal: cuota.fecha_cobro_original,
          posOrigAnio: cuota.posicion_orig_anio,
          posOrigMes: cuota.posicion_orig_mes,
        })
      }
    }

    setCampos(Object.values(mapaCampos).sort((a, b) => a.campo.localeCompare(b.campo)))
    setDetalleCeldas(mapaDetalle)
  }

  // ── Guardar cambios de una cuota (mover fecha / poner precio) ────────────────
  const guardarCuota = async (
    cuota: CuotaDetalle,
    nuevaFecha: string,
    nuevoPrecio: number | null,
  ): Promise<string | null> => {
    // Al mover, la posición pasa a ser el mes destino (regla R1 del diseño)
    const check = puedeMoverCuota(
      { estado: cuota.estado, fecha_cobro_estimada: cuota.fechaCobro },
      nuevaFecha, new Date(), cuota.diasCobro,
    )
    if (!check.permitido) return check.motivo ?? "No se puede mover"

    const [anio, mes] = nuevaFecha.split("-").map(Number)

    // El modo lo decide la fecha destino: mes actual = pizarra (ARS directo, sin TC),
    // meses siguientes = Matba (USD × TC). Los dos overrides son excluyentes.
    const modo = modoPrecioSegunFecha(nuevaFecha)

    const { error } = await supabase
      .from("cuotas_arrendamiento")
      .update({
        fecha_cobro_estimada: nuevaFecha,
        posicion_anio: anio,
        posicion_mes: mes,
        precio_pesos_override: modo === "pizarra" ? nuevoPrecio : null,
        precio_usd_override:   modo === "matba"   ? nuevoPrecio : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cuota.id)

    if (error) return error.message
    await cargarIngresos()
    return null
  }

  /** Vuelve la cuota a la fecha y posición originales del contrato y limpia el precio manual. */
  const volverADefault = async (cuota: CuotaDetalle): Promise<string | null> => {
    if (!cuota.fechaOriginal) return "Esta cuota no tiene fecha original guardada"
    const { error } = await supabase
      .from("cuotas_arrendamiento")
      .update({
        fecha_cobro_estimada: cuota.fechaOriginal,
        posicion_anio: cuota.posOrigAnio,
        posicion_mes: cuota.posOrigMes,
        precio_usd_override: null,
        precio_pesos_override: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cuota.id)
    if (error) return error.message
    await cargarIngresos()
    return null
  }

  // ── INGRESOS: ganadería (venta de destete) ──────────────────────────────────
  const cargarGanaderia = async () => {
    const [{ data: proyecciones }, { data: preciosHac }] = await Promise.all([
      supabase.from("presupuesto_ganaderia").select("*").eq("activo", true).eq("empresa", "MSA"),
      supabase.from("precios_hacienda").select("categoria, anio, mes, precio_pesos_kg"),
    ])
    if (!proyecciones || proyecciones.length === 0) { setGanaderia([]); return }

    const out = (proyecciones as PresupuestoGanaderia[]).map(p => {
      const r = calcularGanaderia(p, (preciosHac || []) as PrecioHacienda[])
      const mesCobro = String(p.fecha_cobro_estimada).slice(0, 7)
      return {
        nombre: p.descripcion || `Ganadería ${p.campania}`,
        // El total COBRADO incluye IVA: es lo que entra al banco
        montos: { [mesCobro]: r.total },
        // El IIBB es un EGRESO derivado, el mes siguiente al cobro
        iibb: { [r.mes_pago_iibb]: r.iibb },
        estimado: r.estimado,
      }
    })
    setGanaderia(out)
  }

  // ── INGRESOS: venta de hacienda (lotes de Productivo) ───────────────────────
  const cargarHacienda = async () => {
    const [{ data: lotes }, { data: precios }] = await Promise.all([
      supabase.schema("productivo").from("stock_lotes").select("*").eq("empresa", "MSA"),
      supabase.from("precios_hacienda").select("categoria, anio, mes, precio_pesos_kg, peso_desde, peso_hasta"),
    ])
    if (!lotes || lotes.length === 0) {
      setHacienda({ presupuestado: {}, estimado: {}, disponible: [] })
      return
    }

    const ids = (lotes as any[]).map(l => l.id)
    const { data: vs } = ids.length
      ? await supabase.schema("productivo").from("stock_ventas").select("lote_id, cantidad").in("lote_id", ids)
      : { data: [] as any[] }

    const ventasDe = (id: string) => ((vs || []) as any[]).filter(v => v.lote_id === id)
    const listaPrecios = (precios || []) as PrecioHacienda[]

    const presupuestado: Record<string, number> = {}
    const estimado: Record<string, boolean> = {}
    const dispPorCat: Record<string, { cabezas: number; kg: number }> = {}
    const hoy = new Date().toISOString().slice(0, 10)

    for (const l of lotes as LoteStock[]) {
      const v = valuarLoteConPrecios(l, ventasDe(l.id) as VentaStock[], listaPrecios)

      if (v.proyectado && v.mes_cobro) {
        presupuestado[v.mes_cobro] = (presupuestado[v.mes_cobro] || 0) + v.monto
        if (v.estimado) estimado[v.mes_cobro] = true
      } else {
        // Sin fecha de venta no hay plata: se informa en cabezas y kg, igual que las
        // toneladas de soja disponibles a fijar.
        const cab = cantidadDisponible(l, ventasDe(l.id) as VentaStock[])
        if (cab <= 0.01) continue
        const kg = cab * pesoEstimado(l, hoy)
        const acc = dispPorCat[l.categoria] ?? { cabezas: 0, kg: 0 }
        acc.cabezas += cab; acc.kg += kg
        dispPorCat[l.categoria] = acc
      }
    }

    setHacienda({
      presupuestado, estimado,
      disponible: Object.entries(dispPorCat)
        .map(([categoria, d]) => ({ categoria, ...d }))
        .sort((a, b) => a.categoria.localeCompare(b.categoria)),
    })
  }

  const cargarSueldos = async () => {
    const primerMes = meses[0]
    const ultimoMes = meses[meses.length - 1]

    const { data: periodos } = await supabase
      .from("sueldos_periodos")
      .select("id, anio, mes, saldo_pendiente, bruto_calculado, estado, empleado:sueldos_empleados(nombre, empresa)")
      .gte("anio", primerMes.anio)
      .lte("anio", ultimoMes.anio)
      .neq("estado", "historico")
      .order("anio").order("mes")

    if (!periodos) return

    // Agrupar por empleado
    const mapaEmpleados: Record<string, FilaSueldo> = {}
    for (const p of periodos) {
      const emp = p.empleado as any
      if (!emp) continue
      // Filtrar solo MSA o ambas
      const empresa: string = emp.empresa || ""
      if (!empresa.toLowerCase().includes("msa") && empresa.toLowerCase() !== "ambas") continue

      const nombre: string = emp.nombre
      const clave = `${p.anio}-${String(p.mes).padStart(2, "0")}`
      const monto = Number(p.saldo_pendiente ?? p.bruto_calculado ?? 0)

      if (!mapaEmpleados[nombre]) {
        mapaEmpleados[nombre] = { id: nombre, nombre, montos: {} }
      }
      mapaEmpleados[nombre].montos[clave] = monto
    }

    setSueldoFilas(Object.values(mapaEmpleados))
  }

  // ── Toggle agrupador ────────────────────────────────────────────────────────

  const toggleAgrupador = (nombre: string) => {
    setExpandidos(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  const toggleTodos = (expandir: boolean) => {
    const nuevo: Record<string, boolean> = {}
    agrupadores.forEach(a => { nuevo[a.nombre] = expandir })
    nuevo["__sueldos__"] = expandir
    setExpandidos(nuevo)
  }

  // ── Totales por mes ─────────────────────────────────────────────────────────

  const totalesPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      let suma = 0
      for (const ag of agrupadores) {
        for (const f of ag.templates) {
          suma += f.montos[clave] || 0
        }
      }
      for (const s of sueldoFilas) {
        suma += s.montos[clave] || 0
      }
      suma += ganaderia.reduce((acc, g) => acc + (g.iibb[clave] || 0), 0)
      totales[clave] = suma
    }
    return totales
  }, [agrupadores, sueldoFilas, ganaderia, meses])

  const totalSueldosPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = sueldoFilas.reduce((s, f) => s + (f.montos[clave] || 0), 0)
    }
    return totales
  }, [sueldoFilas, meses])

  const totalIngresosPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = campos.reduce(
        (s, c) => s + (c.fijado[clave] || 0) + (c.presupuestado[clave] || 0) + (c.disponible[clave] || 0),
        0,
      ) + ganaderia.reduce((s, g) => s + (g.montos[clave] || 0), 0)
        + (hacienda.presupuestado[clave] || 0)
    }
    return totales
  }, [campos, ganaderia, hacienda, meses])

  // IIBB de ganadería: egreso derivado, se suma al total de egresos
  const totalIibbGanaderiaPorMes = useMemo(() => {
    const totales: Record<string, number> = {}
    for (const m of meses) {
      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
      totales[clave] = ganaderia.reduce((s, g) => s + (g.iibb[clave] || 0), 0)
    }
    return totales
  }, [ganaderia, meses])

  const hayIngresos = campos.length > 0 || ganaderia.length > 0
    || Object.keys(hacienda.presupuestado).length > 0 || hacienda.disponible.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-400">Cargando presupuesto...</span>
      </div>
    )
  }

  const mesActualClave = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}`

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Presupuesto MSA</h2>
          <p className="text-sm text-gray-500">
            Ingresos (arrendamientos) + egresos (templates y sueldos) · {meses[0].label} – {meses[meses.length-1].label}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toggleTodos(true)}>Expandir todo</Button>
          <Button variant="outline" size="sm" onClick={() => toggleTodos(false)}>Colapsar todo</Button>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-700 min-w-[220px]">
                    Concepto
                  </th>
                  {meses.map(m => {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    const esActual = clave === mesActualClave
                    return (
                      <th
                        key={clave}
                        className={`px-3 py-2 text-right font-medium text-xs whitespace-nowrap min-w-[90px] ${
                          esActual ? "bg-blue-50 text-blue-700 border-l-2 border-blue-300" : "text-gray-500"
                        }`}
                      >
                        {m.label}
                        {esActual && <div className="text-[10px] font-normal">← hoy</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>

              <tbody>
                {/* ══ INGRESOS — Arrendamientos agrícolas ══ */}
                {hayIngresos && (
                  <>
                    <tr className="border-b-2 border-emerald-300 bg-emerald-50">
                      <td className="sticky left-0 z-10 bg-emerald-50 px-4 py-2 font-bold text-emerald-800 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        INGRESOS — Arrendamientos
                      </td>
                      {meses.map(m => {
                        const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                        const esActual = clave === mesActualClave
                        return (
                          <td
                            key={clave}
                            className={`px-3 py-2 text-right font-bold text-emerald-800 ${
                              esActual ? "bg-emerald-100 border-l-2 border-blue-300" : ""
                            }`}
                          >
                            {fmt(totalIngresosPorMes[clave] || 0)}
                          </td>
                        )
                      })}
                    </tr>

                    {campos.map(c => {
                      const claveCampo = `__campo_${c.campo}__`
                      const expandido = expandidos[claveCampo] ?? true

                      const totalCampo: Record<string, number> = {}
                      for (const m of meses) {
                        const k = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                        totalCampo[k] = (c.fijado[k] || 0) + (c.presupuestado[k] || 0) + (c.disponible[k] || 0)
                      }

                      // Las 3 filas del campo: fijado / presupuestado / disponible
                      const subFilas: { label: string; tipo: string | null; datos: Record<string, number>; clase: string }[] = [
                        { label: "Fijado",             tipo: null,             datos: c.fijado,        clase: "text-emerald-700 font-medium" },
                        { label: "Presupuestado",      tipo: "presupuestado",  datos: c.presupuestado, clase: "text-gray-600" },
                        { label: "Disponible a fijar", tipo: "disponible",     datos: c.disponible,    clase: "text-amber-700" },
                      ]

                      return (
                        <>
                          <tr
                            key={`campo-${c.campo}`}
                            className="border-b bg-emerald-50/40 cursor-pointer hover:bg-emerald-50 transition-colors"
                            onClick={() => toggleAgrupador(claveCampo)}
                          >
                            <td className="sticky left-0 z-10 bg-emerald-50/40 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                              {expandido
                                ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                              }
                              {c.campo}
                              <span className="ml-2 text-xs text-gray-400">{c.empresa}</span>
                            </td>
                            {meses.map(m => {
                              const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                              const esActual = clave === mesActualClave
                              return (
                                <td
                                  key={clave}
                                  className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                    esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                  }`}
                                >
                                  {fmt(totalCampo[clave] || 0)}
                                </td>
                              )
                            })}
                          </tr>

                          {expandido && subFilas.map(sf => (
                            <tr key={`${c.campo}-${sf.label}`} className="border-b hover:bg-gray-50 transition-colors">
                              <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-xs text-gray-600">
                                {sf.label}
                              </td>
                              {meses.map(m => {
                                const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                                const esActual = clave === mesActualClave
                                const valor = sf.datos[clave] || 0
                                const tons = sf.label === "Disponible a fijar" ? c.tonsDisponibles[clave] : undefined
                                const estimado = valor > 0 && sf.label !== "Fijado" && c.estimado[clave]
                                const cuotasCelda = sf.tipo ? detalleCeldas[`${c.campo}|${clave}|${sf.tipo}`] : undefined
                                const clickeable = !!cuotasCelda?.length
                                return (
                                  <td
                                    key={clave}
                                    onClick={clickeable
                                      ? () => setModalCuotas({
                                          titulo: `${c.campo} — ${sf.label} — ${MESES[m.mes-1]} ${m.anio}`,
                                          cuotas: cuotasCelda!,
                                        })
                                      : undefined}
                                    title={
                                      clickeable
                                        ? `${tons ? `${tons.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn sin fijar · ` : ""}Click para mover la cuota o ponerle precio`
                                        : estimado
                                          ? "Precio o TC arrastrado de otro mes (estimado)"
                                          : undefined
                                    }
                                    className={`px-3 py-1.5 text-right text-xs ${sf.clase} ${
                                      esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                    } ${clickeable ? "cursor-pointer hover:bg-amber-50 hover:underline" : ""}`}
                                  >
                                    {/* Sin precio cargado el monto da 0: mostrar las tn para que
                                        el disponible no quede invisible. */}
                                    {valor === 0 && tons
                                      ? <span className="text-amber-600">{tons.toLocaleString("es-AR", { maximumFractionDigits: 1 })} tn</span>
                                      : fmt(valor)}
                                    {estimado && <span className="ml-0.5 text-amber-500">*</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </>
                      )
                    })}

                    {/* Hacienda — venta presupuestada (lotes con fecha) */}
                    {Object.keys(hacienda.presupuestado).length > 0 && (
                      <tr className="border-b bg-emerald-50/40 hover:bg-emerald-50">
                        <td className="sticky left-0 z-10 bg-emerald-50/40 px-4 py-2 font-semibold text-gray-700">
                          🐄 Venta de hacienda
                          <span className="ml-2 text-xs font-normal text-gray-400">lotes con fecha</span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          const valor = hacienda.presupuestado[clave] || 0
                          return (
                            <td key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""}`}>
                              {fmt(valor)}
                              {valor > 0 && hacienda.estimado[clave] && (
                                <span className="ml-0.5 text-amber-500">*</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )}

                    {/* Hacienda disponible — sin fecha de venta no hay plata: cabezas y kg,
                        igual que las toneladas de soja disponibles a fijar. */}
                    {hacienda.disponible.map(d => (
                      <tr key={`disp-${d.categoria}`} className="border-b bg-amber-50/30">
                        <td className="sticky left-0 z-10 bg-amber-50/30 px-4 py-1.5 pl-8 text-xs text-amber-800">
                          Disponible sin fecha — {d.categoria}
                        </td>
                        <td colSpan={meses.length} className="px-3 py-1.5 text-xs text-amber-700">
                          <strong>{Math.round(d.cabezas).toLocaleString("es-AR")} cabezas</strong>
                          {" · "}
                          <strong>{Math.round(d.kg).toLocaleString("es-AR")} kg</strong>
                          <span className="ml-2 text-gray-500">
                            — poné fecha de venta en Productivo → Evolución Rodeo para que entre al presupuesto
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Ganadería — venta de destete */}
                    {ganaderia.map(g => (
                      <tr key={`gan-${g.nombre}`} className="border-b bg-emerald-50/40 hover:bg-emerald-50">
                        <td className="sticky left-0 z-10 bg-emerald-50/40 px-4 py-2 font-semibold text-gray-700">
                          🐄 {g.nombre}
                          <span className="ml-2 text-xs font-normal text-gray-400">ganadería</span>
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          const valor = g.montos[clave] || 0
                          return (
                            <td
                              key={clave}
                              title={valor > 0 ? "Total cobrado (neto + IVA)" : undefined}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(valor)}
                              {valor > 0 && g.estimado && <span className="ml-0.5 text-amber-500">*</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </>
                )}

                {/* ── Agrupadores / Templates ── */}
                {agrupadores.map(ag => {
                  const expandido = expandidos[ag.nombre] ?? false

                  // Total del agrupador por mes
                  const totalesAg: Record<string, number> = {}
                  for (const m of meses) {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    totalesAg[clave] = ag.templates.reduce((s, f) => s + (f.montos[clave] || 0), 0)
                  }
                  const tieneAlgo = Object.values(totalesAg).some(v => v > 0)
                  if (!tieneAlgo) return null

                  return (
                    <>
                      {/* Fila agrupador */}
                      <tr
                        key={`ag-${ag.nombre}`}
                        className="border-b bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => toggleAgrupador(ag.nombre)}
                      >
                        <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {expandido
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          {ag.nombre}
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          return (
                            <td
                              key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(totalesAg[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>

                      {/* Filas de templates hijos */}
                      {expandido && ag.templates.map(t => (
                        <tr key={t.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-gray-600 text-xs">
                            {t.nombre}
                            <span className="ml-2 text-gray-400">{t.categ}</span>
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            const esActual = clave === mesActualClave
                            return (
                              <td
                                key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                }`}
                              >
                                {fmt(t.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })}

                {/* ── Sueldos ── */}
                {sueldoFilas.length > 0 && (() => {
                  const expandidoSueldos = expandidos["__sueldos__"] ?? false
                  return (
                    <>
                      <tr
                        className="border-b bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => toggleAgrupador("__sueldos__")}
                      >
                        <td className="sticky left-0 z-10 bg-gray-100 px-4 py-2 font-semibold text-gray-700 flex items-center gap-1">
                          {expandidoSueldos
                            ? <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                            : <ChevronRight className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                          }
                          Sueldos
                        </td>
                        {meses.map(m => {
                          const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                          const esActual = clave === mesActualClave
                          return (
                            <td
                              key={clave}
                              className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                                esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                              }`}
                            >
                              {fmt(totalSueldosPorMes[clave] || 0)}
                            </td>
                          )
                        })}
                      </tr>
                      {expandidoSueldos && sueldoFilas.map(s => (
                        <tr key={s.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-1.5 pl-8 text-gray-600 text-xs">
                            {s.nombre}
                          </td>
                          {meses.map(m => {
                            const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                            const esActual = clave === mesActualClave
                            return (
                              <td
                                key={clave}
                                className={`px-3 py-1.5 text-right text-xs text-gray-600 ${
                                  esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                                }`}
                              >
                                {fmt(s.montos[clave] || 0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  )
                })()}

                {/* ── IIBB de ganadería (egreso derivado, mes siguiente al cobro) ── */}
                {ganaderia.length > 0 && (
                  <tr className="border-b bg-amber-50/40">
                    <td className="sticky left-0 z-10 bg-amber-50/40 px-4 py-2 font-semibold text-gray-700">
                      IIBB ganadería
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        mes siguiente al cobro
                      </span>
                    </td>
                    {meses.map(m => {
                      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                      const esActual = clave === mesActualClave
                      return (
                        <td
                          key={clave}
                          className={`px-3 py-2 text-right font-semibold text-gray-700 ${
                            esActual ? "bg-blue-50 border-l-2 border-blue-300" : ""
                          }`}
                        >
                          {fmt(totalIibbGanaderiaPorMes[clave] || 0)}
                        </td>
                      )
                    })}
                  </tr>
                )}

                {/* ── Total general ── */}
                <tr className="border-t-2 border-gray-400 bg-gray-800">
                  <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 font-bold text-white flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    TOTAL EGRESOS MSA
                  </td>
                  {meses.map(m => {
                    const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                    const esActual = clave === mesActualClave
                    return (
                      <td
                        key={clave}
                        className={`px-3 py-3 text-right font-bold text-white text-sm ${
                          esActual ? "bg-blue-900 border-l-2 border-blue-400" : ""
                        }`}
                      >
                        ${Math.round(totalesPorMes[clave] || 0).toLocaleString("es-AR")}
                      </td>
                    )
                  })}
                </tr>

                {/* ── RESULTADO (Ingresos − Egresos) ── */}
                {hayIngresos && (
                  <tr className="border-t-2 border-gray-400 bg-slate-700">
                    <td className="sticky left-0 z-10 bg-slate-700 px-4 py-3 font-bold text-white flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      RESULTADO
                    </td>
                    {meses.map(m => {
                      const clave = `${m.anio}-${String(m.mes).padStart(2,"0")}`
                      const esActual = clave === mesActualClave
                      const resultado = (totalIngresosPorMes[clave] || 0) - (totalesPorMes[clave] || 0)
                      return (
                        <td
                          key={clave}
                          className={`px-3 py-3 text-right font-bold text-sm ${
                            resultado < 0 ? "text-red-300" : "text-emerald-300"
                          } ${esActual ? "bg-slate-900 border-l-2 border-blue-400" : ""}`}
                        >
                          ${Math.round(resultado).toLocaleString("es-AR")}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: mover cuota / ponerle precio */}
      <ModalCuotas
        datos={modalCuotas}
        onCerrar={() => setModalCuotas(null)}
        onGuardar={guardarCuota}
        onDefault={volverADefault}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-blue-100 border border-blue-300 rounded-sm"></span>
          Mes actual
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500">*</span>
          Precio o TC arrastrado de otro mes
        </span>
        <span>· Montos en pesos · Solo MSA</span>
        <Badge variant="outline" className="text-xs">Ingresos: arrendamientos · Egresos: templates + sueldos</Badge>
      </div>
    </div>
  )
}

// ── Modal: mover una cuota y/o ponerle precio ─────────────────────────────────
// Escribe sobre `cuotas_arrendamiento` (Ventas es la fuente): Presupuesto es sólo
// la interfaz. Reglas de movimiento en lib/arrendamientos/calculo.ts.

interface ModalCuotasProps {
  datos: { titulo: string; cuotas: CuotaDetalle[] } | null
  onCerrar: () => void
  onGuardar: (cuota: CuotaDetalle, nuevaFecha: string, nuevoPrecio: number | null) => Promise<string | null>
  onDefault: (cuota: CuotaDetalle) => Promise<string | null>
}

function ModalCuotas({ datos, onCerrar, onGuardar, onDefault }: ModalCuotasProps) {
  const [edits, setEdits] = useState<Record<string, { fecha: string; precio: string }>>({})
  const [guardando, setGuardando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!datos) { setEdits({}); setError(null); return }
    const init: Record<string, { fecha: string; precio: string }> = {}
    for (const c of datos.cuotas) {
      // El input arranca con el valor del modo que corresponde a la fecha actual de la cuota
      const valor = c.modo === "pizarra" ? c.pesosPorTon : c.precioUsd
      init[c.id] = {
        fecha: c.fechaCobro,
        precio: valor ? valor.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      }
    }
    setEdits(init)
  }, [datos])

  if (!datos) return null


  const guardar = async (c: CuotaDetalle) => {
    const e = edits[c.id]
    if (!e) return
    setGuardando(c.id); setError(null)
    const precio = e.precio.trim() === ""
      ? null
      : parseFloat(e.precio.replace(/\./g, "").replace(",", ".")) || 0
    const err = await onGuardar(c, e.fecha, precio)
    setGuardando(null)
    if (err) setError(err); else onCerrar()
  }

  const restaurar = async (c: CuotaDetalle) => {
    setGuardando(c.id); setError(null)
    const err = await onDefault(c)
    setGuardando(null)
    if (err) setError(err); else onCerrar()
  }

  return (
    <Dialog open={!!datos} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{datos.titulo}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          {datos.cuotas.map(c => {
            const e = edits[c.id] ?? { fecha: c.fechaCobro, precio: "" }
            const esDisponible = c.estado === "disponible" || c.estado === "parcial"
            // El modo lo manda la fecha ELEGIDA en el input, no la guardada:
            // mes actual → pizarra en pesos · mes posterior → Matba en USD.
            const modoEdit = modoPrecioSegunFecha(e.fecha)
            const minimaDisponible = fechaMinimaDisponible(new Date(), c.diasCobro)
            return (
              <div key={c.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    Campaña {c.campania} · cuota {c.numeroCuota}
                  </span>
                  <Badge variant="outline" className="text-xs">{c.estado}</Badge>
                </div>

                <div className="text-xs text-gray-500">
                  {c.tonsPend.toLocaleString("es-AR", { maximumFractionDigits: 2 })} tn sin fijar ·
                  {modoEdit === "pizarra"
                    ? " pizarra Rosario (ARS, sin TC)"
                    : ` Matba × TC ${c.tc ? c.tc.toLocaleString("es-AR") : "— sin cargar"}`} ·
                  {c.precioManual ? " precio manual" : c.precioArrastrado ? " precio arrastrado de otra posición" : " precio de la posición"}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Fecha de cobro</label>
                    <Input
                      type="date"
                      className="h-8"
                      value={e.fecha}
                      min={esDisponible ? minimaDisponible : c.fechaCobro}
                      onChange={ev => {
                        const nueva = ev.target.value
                        // Si el cambio de fecha cambia la unidad (USD ↔ pesos), limpiar el
                        // precio: dejarlo sería guardar 343 pesos donde había 343 dólares.
                        const cambiaModo = nueva && modoPrecioSegunFecha(nueva) !== modoEdit
                        setEdits(p => ({ ...p, [c.id]: { fecha: nueva, precio: cambiaModo ? "" : e.precio } }))
                      }}
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {esDisponible
                        ? `Lo antes posible: ${new Date(minimaDisponible + "T00:00:00").toLocaleDateString("es-AR")} (hoy + ${c.diasCobro} días)`
                        : "Una cuota presupuestada sólo se mueve hacia adelante"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">
                      {modoEdit === "pizarra" ? "Precio $/ton (pizarra)" : "Precio USD/ton (Matba)"}
                    </label>
                    <Input
                      type="text"
                      placeholder="0,00"
                      className={`h-8 text-right ${modoEdit === "pizarra" ? "border-amber-400 bg-amber-50" : ""}`}
                      value={e.precio}
                      onChange={ev => setEdits(p => ({ ...p, [c.id]: { ...e, precio: ev.target.value } }))}
                    />
                    <p className="mt-1 text-[10px] text-gray-400">
                      {modoEdit === "pizarra"
                        ? "Se cobra este mes → disponible: pesos directos, sin TC"
                        : `Vacío = usa el Matba de la posición ${MESES[Number(e.fecha.split("-")[1]) - 1]} ${e.fecha.split("-")[0]}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-xs"
                    disabled={guardando === c.id || !c.fechaOriginal}
                    onClick={() => restaurar(c)}>
                    Volver a default
                  </Button>
                  <Button size="sm" disabled={guardando === c.id} onClick={() => guardar(c)}>
                    {guardando === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                  </Button>
                </div>
              </div>
            )
          })}

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <p className="text-[11px] text-gray-400">
            Al mover la cuota, la posición pasa a ser el mes destino. Los cambios se guardan en
            Ventas — Presupuesto es sólo la interfaz.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
