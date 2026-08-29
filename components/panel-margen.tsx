"use client"

// Presupuesto → Margen por actividad.
//
// Esta pantalla no tiene tablas propias. Arma el margen leyendo de donde el dato ya vive:
// hectáreas de `campo_campana_actividad`, cabezas y % del rodeo de `stock_ciclos`, ventas de
// `stock_lotes`, precios de `precios_hacienda` y costos de `actividad_insumos`.
//
// No sólo muestra: **también es donde se trabajan los costos de producción**. Cada costo se
// despliega, se ve cómo se llegó al número y se edita ahí mismo. Lo pidió así el usuario, y el
// motivo es que tener los costos en dos pantallas distintas no se entendía: *"ni siquiera
// entiendo la lógica de en qué se diferencia una solapa de la otra"*.
//
// Lo que NO se edita acá es el planteo productivo —ganancia diaria, % de ración, tramos—, que es
// de la actividad y el margen consume igual que consume las hectáreas.
//
// Cuando falta un dato **no se rellena con cero**: la línea queda marcada. Un margen redondo
// sobre datos incompletos es peor que uno que dice qué le falta, sobre todo si se le presenta a
// los socios.

import { useState, useEffect, useCallback, useMemo, Fragment } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Scale, AlertTriangle, ChevronDown, ChevronRight, Pencil } from "lucide-react"
import { calcularLineaTiempo } from "@/lib/ganaderia/ciclo"
import { EditorCostoActividad, type CostoEditable } from "@/components/editor-costo-actividad"
import {
  calcularMargen, pctGastoVentaPorDefecto, claveActividad, resolverCostoDirecto, claveMes,
  campanaDeFecha,
  type DatosMargen, type LoteVenta, type CostoDirecto, type MargenActividad,
  type InsumoActividadMargen, type Ajuste, type MesPeriodo, type ContextoCosto,
  type TransferenciaInterna, type VentaRealLote,
  type ExistenciaActividad, type ResultadoGrupo,
} from "@/lib/presupuesto/margen"
import { calcularCuenta, type PuntoHistorico } from "@/lib/presupuesto/modos"
import { resolverPrecioHacienda } from "@/lib/ganaderia/calculo"
import { costoAlimentacion, costoPorGrupo, acumuladoHasta, mismoInsumo,
  type InsumoConDatos, type CostoGrupoTramo } from "@/lib/productivo/costo-alimentacion"
import { armarGruposRodeo, gruposDelRodeo, type BajaRodeo } from "@/lib/productivo/rodeo"
import { curvaDeLote, type TramoLote, type LoteCurva } from "@/lib/productivo/tramos"
import { conciliarEntregasFacturas, entregasParaConsumo, respaldosPorId,
  type Vinculo } from "@/lib/productivo/entregas-facturas"
import type { Actividad as ActividadProd } from "@/lib/productivo/actividades"

/**
 * Los 12 meses de la campaña: jul → jun. `"26/27"` → jul-2026 … jun-2027.
 *
 * Hace falta porque el costo ahora dice **en qué meses cae y con qué %**, y porque el dólar no
 * vale lo mismo en cada uno.
 */
/** La campaña en curso según la fecha: de julio en adelante ya es la que arranca. */
function campanaActual(hoy = new Date()): string {
  const y = hoy.getFullYear() % 100
  const ini = hoy.getMonth() + 1 >= 7 ? y : y - 1
  return `${String(ini).padStart(2, "0")}/${String(ini + 1).padStart(2, "0")}`
}

/** `"26/27"` → `"27/28"`. */
function campanaSiguiente(c: string): string {
  const m = c.match(/^(\d{2})\/(\d{2})$/)
  if (!m) return c
  const a = parseInt(m[1], 10) + 1
  return `${String(a).padStart(2, "0")}/${String(a + 1).padStart(2, "0")}`
}

function mesesDeCampana(campana: string): MesPeriodo[] {
  const m = campana.match(/^(\d{2})\/(\d{2})$/)
  const anio = m ? 2000 + parseInt(m[1], 10) : new Date().getFullYear()
  const out: MesPeriodo[] = []
  for (let k = 0; k < 12; k++) {
    const mes = ((6 + k) % 12) + 1
    out.push({ anio: anio + (6 + k >= 12 ? 1 : 0), mes })
  }
  return out
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const numAR = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })


/**
 * El costo de alimentación medido, por actividad, para una campaña.
 *
 * Junta las tres piezas que ya están verificadas por separado: las mediciones de stock
 * (`consumo.ts`), la línea de tiempo del rodeo (`rodeo.ts`) y el reparto por actividad
 * (`costo-alimentacion.ts`). Devuelve vacío cuando no hay mediciones — sin inventar nada.
 */
async function cargarCostoAlimentacion(
  campana: string,
  actPorId: Map<any, string>,
  actDeCategoria: Map<string, string | null>,
) {
  const p = supabase.schema("productivo")
  const [{ data: stock }, { data: meds }, { data: movs }, { data: decs },
         { data: ciclos }, { data: lts }, { data: vtas }, { data: trs },
         { data: actsProd }, { data: mvHac }, { data: catsHac }] = await Promise.all([
    p.from("stock_insumos").select("id, producto, unidad_medida"),
    p.from("mediciones_insumo").select("*").order("fecha"),
    p.from("movimientos_insumos").select("id, insumo_stock_id, fecha, cantidad, costo_unitario, proveedor, tipo"),
    p.from("consumo_declarado_insumo").select("*"),
    p.from("ciclos_recria").select("*").eq("activo", true),
    p.from("stock_lotes").select("*"),
    p.from("stock_ventas").select("lote_id, fecha_venta"),
    p.from("lote_tramos").select("*").order("orden"),
    p.from("actividades").select("*").eq("activo", true),
    p.from("movimientos_hacienda").select("fecha, tipo, cantidad, categoria_id"),
    p.from("categorias_hacienda").select("id, nombre"),
  ])

  const medPorIns = new Map<string, any[]>()
  for (const m of ((meds || []) as any[])) {
    const k = String(m.insumo_stock_id)
    if (!medPorIns.has(k)) medPorIns.set(k, [])
    medPorIns.get(k)!.push(m)
  }
  // Sin al menos dos mediciones no hay consumo que medir: no hay nada que hacer acá.
  const conMedicion = ((stock || []) as any[]).filter(s => (medPorIns.get(String(s.id))?.length ?? 0) >= 2)
  if (conMedicion.length === 0 || !((ciclos || []) as any[])[0]) return null

  const { data: vincs } = await p.from("entrega_factura").select("*")
  const vinculos: Vinculo[] = ((vincs || []) as any[]).map(v => ({
    id: String(v.id), movimientoId: String(v.movimiento_id), facturaId: String(v.factura_id),
    cantidad: Number(v.cantidad) || 0,
    precioUnitario: v.precio_unitario == null ? null : Number(v.precio_unitario),
    origen: v.origen ?? "arca",
  }))
  // Los respaldos se traen POR ID, no "los últimos N": acá se lee un vínculo ya hecho, y el
  // maíz del 16/03 se respalda con una cuota de template que tiene 591 más nuevas encima.
  // Con una lista precargada ese vínculo quedaba sin precio y el tramo salía del costo callado.
  const facturasCompra = await respaldosPorId(supabase as never, vinculos)

  const ciclo = ((ciclos || []) as any[])[0]
  const nombreCat = new Map(((catsHac || []) as any[]).map(c => [c.id, String(c.nombre)]))
  // ⚠️ Los TORITOS también comen del mismo silo. El usuario lo dijo desde el principio:
  // *"comen todos los machos incluidos los 9 toritos y todas las hembras incluidas las de
  // reposición"*. Sin ellos acá, su ración se la reparten los demás y les infla el costo.
  const esRecria = (cat: string) => /recria|torito/i.test(cat)
  const listaTr = (trs || []) as TramoLote[]
  const listaAc = (actsProd || []) as unknown as ActividadProd[]

  const filasLote = ((lts || []) as any[])
    .filter(l => esRecria(String(l.categoria)))
    .map(l => {
      const curva = curvaDeLote(l as unknown as LoteCurva, listaTr.filter(t => t.lote_id === l.id), listaAc)
      const real = ((vtas || []) as any[]).find(v => v.lote_id === l.id)
      return {
        id: String(l.id), nombre: `${l.categoria} (${Number(l.cantidad)} cab)`,
        cabezas: Number(l.cantidad) || 0,
        fechaSalidaReal: real ? String(real.fecha_venta) : null,
        fechaSalidaEstimada: l.fecha_venta_estimada ? String(l.fecha_venta_estimada) : null,
        peso: (f: string) => curva(f),
        categoria: String(l.categoria),
      }
    })
  const desdeCiclo = String(ciclo.fecha_inicio ?? "")
  const bajas: BajaRodeo[] = ((mvHac || []) as any[])
    .filter(m => m.tipo === "mortandad" && esRecria(nombreCat.get(m.categoria_id) ?? "")
      && String(m.fecha) >= desdeCiclo)
    .map(m => ({ fecha: String(m.fecha), cabezas: Number(m.cantidad) || 0 }))

  const armado = armarGruposRodeo({ ciclo, lotes: filasLote, bajas })
  const gruposDe = gruposDelRodeo(armado.grupos, bajas)

  // A qué actividad pertenece cada grupo. Los lotes, por su categoría; el "resto" y las
  // declaraciones, por lo que ya traen puesto.
  const actDeLote = new Map(filasLote.map(l => [l.id, actDeCategoria.get(l.categoria) ?? null]))
  const actDeGrupo = (id: string): string | null => {
    if (actDeLote.has(id)) return actDeLote.get(id) ?? null
    if (id === "__resto__") return actDeCategoria.get("Ternero Recria") ?? null
    // Las declaraciones traen el centro de costo como id de grupo.
    return actPorId.get(id) ?? null
  }

  const insumos: InsumoConDatos[] = conMedicion.map(s => ({
    id: String(s.id), producto: String(s.producto), unidad: s.unidad_medida ?? null,
    mediciones: (medPorIns.get(String(s.id)) ?? []).map(m => ({
      fecha: String(m.fecha), cantidad: Number(m.cantidad) || 0, notas: m.notas,
    })),
    // El precio sale de la FACTURA vinculada; el tipeado a mano queda de respaldo.
    entregas: entregasParaConsumo(conciliarEntregasFacturas(
      ((movs || []) as any[])
        .filter(m => String(m.insumo_stock_id) === String(s.id) && m.tipo === "compra")
        .map(m => ({
          id: String(m.id), fecha: String(m.fecha), cantidad: Number(m.cantidad) || 0,
          proveedor: m.proveedor,
          costoUnitarioManual: m.costo_unitario == null ? null : Number(m.costo_unitario),
        })),
      facturasCompra,
      vinculos,
    )),
    declaraciones: ((decs || []) as any[])
      .filter(d => String(d.insumo_stock_id) === String(s.id))
      .map(d => ({
        fecha: String(d.fecha), grupoId: String(d.centro_costo_id),
        nombre: actPorId.get(d.centro_costo_id) ?? "actividad",
        cantidad: Number(d.cantidad) || 0, notas: d.notas,
      })),
  }))

  return {
    porActividad: costoAlimentacion(insumos, gruposDe, actDeGrupo, campanaDeFecha, campana),
    porGrupo: costoPorGrupo(insumos, gruposDe),
    grupos: armado.grupos,
    actDeGrupo,
    desdeCiclo,
  }
}

/** Los límites de la campaña: `"25/26"` → 01/07/2025 y 01/07/2026. */
function limitesCampana(campana: string): { inicio: string; fin: string } {
  const m = campana.match(/^(\d{2})\/(\d{2})$/)
  const a = m ? 2000 + parseInt(m[1]!, 10) : new Date().getFullYear()
  return { inicio: `${a}-07-01`, fin: `${a + 1}-07-01` }
}

/**
 * `recargarToken` — cualquier cambio de este número vuelve a leer todo.
 *
 * *Precios y TC* es un panel HERMANO: el margen manda ahí con el botón "Cargar precio de X →",
 * pero al volver seguía diciendo que faltaba. Lo reportó el usuario (2026-08-03).
 */
export function PanelMargen({ onCargarPrecio, recargarToken = 0 }: {
  onCargarPrecio?: (banda: string) => void; recargarToken?: number
} = {}) {
  const [cargando, setCargando] = useState(true)
  const [campana, setCampana] = useState(() => campanaActual())
  const [campanas, setCampanas] = useState<string[]>([])
  const [datos, setDatos] = useState<DatosMargen | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  /** Actividades de `centros_costo` que no tienen par en `productivo.actividades`. */
  const [desalineadas, setDesalineadas] = useState<string[]>([])
  /** Los costos que se pueden editar desde acá, por id de insumo. */
  const [editables, setEditables] = useState<Record<string, CostoEditable>>({})
  const [sinIPC, setSinIPC] = useState(false)
  /** Las cuentas contables con historia, para elegir en qué basarse. */
  const [cuentasConHistoria, setCuentasConHistoria] = useState<{ nro: string; nombre: string }[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [acts, asig, ciclos, lotes, cats, precios, actProd] = await Promise.all([
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true),
        supabase.from("campo_campana_actividad").select("campana, centro_costo_id, has_netas"),
        supabase.schema("productivo").from("stock_ciclos").select("id, campania, vacas_apertura"),
        supabase.schema("productivo").from("stock_lotes")
          .select("id, categoria, cantidad, cantidad_calculada, peso_base_kg, ganancia_diaria_kg, fecha_disponible, fecha_peso, fecha_venta_estimada, precio_kg_override, pct_desbaste, pct_cz, ciclo_id, destino_actividad_id"),
        supabase.schema("productivo").from("categorias_hacienda").select("nombre, centro_costo_id"),
        supabase.from("precios_hacienda").select("categoria, precio_pesos_kg, peso_desde, peso_hasta, anio, mes"),
        supabase.schema("productivo").from("actividades").select("id, nombre, activo"),
      ])
      const [{ data: insumos }, { data: tcs }, { data: ciclosFull }, { data: ajustesRaw }, { data: ipcRaw }] =
        await Promise.all([
          supabase.schema("productivo").from("actividad_insumos")
            .select("id, actividad_id, concepto, modo, valor, unidad, moneda, momento, has_aplicacion, amortiza_anios, base_cabezas, cabezas_aplicacion, cantidad_aplicacion, fundamento, notas, orden, cantidad, cantidad_unidad, precio_fuente, precio_referencia, base_tipo, base_categorias, base_manual, historico_modo, historico_meses, nro_cuentas, distribucion, meses_pct")
            .order("orden"),
          supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
          supabase.schema("productivo").from("stock_ciclos").select("*"),
          supabase.schema("productivo").from("actividad_insumo_ajustes").select("*").order("orden"),
          supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
        ])

      // La historia de las cuentas contables: es el arranque cuando el costo se basa en lo ya
      // gastado. Misma vista que usa el panel de cuentas, para que den lo mismo.
      const { data: histRaw } = await supabase.from("presupuesto_historia_cuentas")
        .select("nro_cuenta, cuenta_contable, anio, mes, monto, facturas, proveedores")
      const historia: PuntoHistorico[] = ((histRaw || []) as any[]).map(h => ({
        nro_cuenta: String(h.nro_cuenta), anio: Number(h.anio), mes: Number(h.mes),
        monto: Number(h.monto) || 0,
        facturas: Number(h.facturas) || 0, proveedores: Number(h.proveedores) || 0,
      }))
      setCuentasConHistoria(Array.from(new Map(((histRaw || []) as any[])
        .map(h => [String(h.nro_cuenta), String(h.cuenta_contable ?? "")])).entries())
        .map(([nro, nombre]) => ({ nro, nombre })).sort((a, b) => a.nro.localeCompare(b.nro)))

      // La cadena de cada costo.
      const ajustesPorInsumo: Record<string, Ajuste[]> = {}
      for (const a of ((ajustesRaw || []) as any[])) {
        (ajustesPorInsumo[a.insumo_id] ||= []).push({
          id: a.id, orden: Number(a.orden) || 0, tipo: a.tipo,
          valor: a.valor == null ? null : Number(a.valor),
          referencia: a.referencia, nota: a.nota,
        })
      }

      // IPC acumulado de los últimos 12 meses cargados — el mismo criterio que las variables y
      // que el panel de cuentas, para que un ajuste "por IPC" signifique lo mismo en las tres.
      const serieIpc = ((ipcRaw || []) as any[])
        .sort((x, y) => (x.anio * 12 + x.mes) - (y.anio * 12 + y.mes)).slice(-12)
      const ipcAcumulado = serieIpc.length > 0
        ? serieIpc.reduce((f, p) => f * (1 + (Number(p.valor_ipc) || 0) / 100), 1) - 1
        : null
      setSinIPC(ipcAcumulado == null)

      const actPorId = new Map((acts.data || []).map((a: any) => [a.id, String(a.nombre)]))
      const nombresAct = Array.from(actPorId.values())

      // Hectáreas por actividad, de la campaña elegida.
      const hasPorActividad: Record<string, number> = {}
      const setCamp = new Set<string>()
      for (const a of ((asig.data || []) as any[])) {
        setCamp.add(String(a.campana))
        if (String(a.campana) !== campana) continue
        const n = actPorId.get(a.centro_costo_id)
        if (!n) continue
        hasPorActividad[n] = (hasPorActividad[n] ?? 0) + (Number(a.has_netas) || 0)
      }
      // ⚠️ La campaña EN CURSO y la SIGUIENTE siempre están, tengan o no hectáreas cargadas.
      //
      // Antes la lista salía sólo de `campo_campana_actividad`, así que la campaña que viene no
      // aparecía hasta tener algo cargado — y el usuario necesita entrar ahí justamente PARA
      // cargarla. Lo marcó: *"para cargar la campaña siguiente hay que hacerlo desde márgenes,
      // pero debo poder seleccionar la campaña siguiente"*. El norte pide presupuesto a 2 años.
      const actual = campanaActual()
      setCamp.add(actual)
      setCamp.add(campanaSiguiente(actual))
      setCampanas(Array.from(setCamp).sort())

      // La categoría dice a qué actividad va cada lote.
      const actDeCategoria = new Map(
        ((cats.data || []) as any[]).map(c => [String(c.nombre), actPorId.get(c.centro_costo_id) ?? null]))
      const campDeCiclo = new Map(((ciclos.data || []) as any[]).map(c => [c.id, String(c.campania)]))

      const lotesOut: LoteVenta[] = ((lotes.data || []) as any[]).map(l => ({
        id: String(l.id),
        categoria: String(l.categoria),
        // `cantidad` MANDA: es el valor con el ajuste a mano. `cantidad_calculada` es lo que dio
        // la cuenta automática y sólo se usa si no hay ajuste.
        // Estaba al revés y el margen ignoraba la corrección manual: en Lotes veías 195 con el
        // cartel "ajustado a mano, el cálculo da 200" y el margen facturaba 200 — 5 animales de
        // ingreso inventado. Ver CLAUDE.md § Default del dato real, siempre editable.
        cabezas: Number(l.cantidad ?? l.cantidad_calculada) || 0,
        peso_base_kg: Number(l.peso_base_kg) || 0,
        ganancia_diaria_kg: Number(l.ganancia_diaria_kg) || 0,
        fecha_disponible: l.fecha_disponible, fecha_peso: l.fecha_peso,
        fecha_venta_estimada: l.fecha_venta_estimada,
        precio_kg_override: l.precio_kg_override == null ? null : Number(l.precio_kg_override),
        pct_desbaste: Number(l.pct_desbaste) || 0,
        pct_cz: l.pct_cz == null ? null : Number(l.pct_cz),
        campania: campDeCiclo.get(l.ciclo_id) ?? null,
        actividad: actDeCategoria.get(String(l.categoria)) ?? null,
        // Con destino cargado el lote no es una venta: es un traspaso a otra actividad.
        destinoActividad: l.destino_actividad_id
          ? (actPorId.get(l.destino_actividad_id) ?? null) : null,
      }))

      // Los precios van CRUDOS: la búsqueda es por tipo y rango de peso, no por nombre.
      const preciosOut = ((precios.data || []) as any[]).map(p => ({
        categoria: String(p.categoria),
        peso_desde: p.peso_desde == null ? null : Number(p.peso_desde),
        peso_hasta: p.peso_hasta == null ? null : Number(p.peso_hasta),
        precio_pesos_kg: Number(p.precio_pesos_kg) || 0,
        anio: Number(p.anio) || 0, mes: Number(p.mes) || 0,
      }))

      // ⚠️ Dos maestros de actividad conviviendo. Se comparan SIN ACENTOS: `centros_costo` dice
      // "Cria" y `productivo.actividades` dice "Cría", y compararlos en crudo las daba por
      // distintas — el margen decía que la actividad no existía teniéndola cargada.
      const actProdActivas = ((actProd.data || []) as any[]).filter(a => a.activo)
      const idProdPorClave = new Map(actProdActivas.map(a => [claveActividad(String(a.nombre)), a.id]))
      setDesalineadas(nombresAct.filter(n => !idProdPorClave.has(claveActividad(n))))

      // Cabezas de la campaña: NO se leen, se CALCULAN. El rodeo rueda año a año —cada campaña
      // abre con el cierre de la anterior— y por eso `vacas_apertura` está en NULL de la segunda
      // campaña en adelante. `calcularLineaTiempo()` es la función que lo resuelve, y es la misma
      // que usa Productivo → Evolución del rodeo, así que dan el mismo número.
      const linea = calcularLineaTiempo(((ciclosFull || []) as any[]))
      const cicloCamp = linea.find(c => String(c.ciclo.campania) === campana)
      const cabezasCampana = cicloCamp ? cicloCamp.rodeo : 0
      // Todas las categorías del ciclo, para que cada costo use la suya.
      const cabezasCiclo = cicloCamp ? {
        rodeo: cicloCamp.rodeo, vacas: cicloCamp.vacas, vaquillonas: cicloCamp.vaquillonas,
        destetados: cicloCamp.destetados, terneros: cicloCamp.terneros, terneras: cicloCamp.terneras,
        retenidas: cicloCamp.retenidas, toritos: cicloCamp.toritos,
      } : null

      // ── TC: uno POR MES, no uno solo ──────────────────────────────────────
      // El dólar no vale lo mismo en marzo que en octubre. Antes el margen usaba el TC más
      // reciente para todo el año, que es el `1.450` fijo del Excel con otro nombre. Lo marcó
      // el usuario. Se arrastra hacia adelante: alcanza con cargar los meses donde cambia.
      const tcOrdenados = ((tcs || []) as any[])
        .sort((a, b) => (a.anio * 12 + a.mes) - (b.anio * 12 + b.mes))
      const tcPorMes: Record<string, number> = {}
      let ultimoTc: number | null = null
      for (const t of tcOrdenados) {
        const v = Number(t.tc_real ?? t.tc_presupuestado) || null
        if (v != null) { ultimoTc = v; tcPorMes[claveMes(Number(t.anio), Number(t.mes))] = v }
      }
      const mesesCampana = mesesDeCampana(campana)
      // Arrastre: un mes sin TC hereda el último cargado antes de él.
      let arrastre: number | null = null
      for (const m of mesesCampana) {
        const k = claveMes(m.anio, m.mes)
        if (tcPorMes[k] != null) arrastre = tcPorMes[k]
        else if (arrastre != null) tcPorMes[k] = arrastre
      }
      const tc = ultimoTc

      // Los costos directos, leídos de verdad de `actividad_insumos`.
      const insumosPorActividad = new Map<string, InsumoActividadMargen[]>()
      const editablesOut: Record<string, CostoEditable> = {}
      for (const i of ((insumos || []) as any[])) {
        const nom = actProdActivas.find(a => a.id === i.actividad_id)?.nombre
        if (!nom) continue
        const clave = claveActividad(String(nom))
        const fila: InsumoActividadMargen = {
          id: String(i.id),
          actividad: String(nom), concepto: String(i.concepto), modo: String(i.modo),
          valor: Number(i.valor) || 0, unidad: i.unidad, moneda: String(i.moneda ?? "ARS"),
          has_aplicacion: i.has_aplicacion == null ? null : Number(i.has_aplicacion),
          amortiza_anios: i.amortiza_anios == null ? null : Number(i.amortiza_anios),
          base_cabezas: i.base_cabezas ?? null,
          cabezas_aplicacion: i.cabezas_aplicacion == null ? null : Number(i.cabezas_aplicacion),
          cantidad_aplicacion: i.cantidad_aplicacion == null ? null : Number(i.cantidad_aplicacion),
          ajustes: ajustesPorInsumo[i.id] ?? [],
          fundamento: i.fundamento ?? null,
          notas: i.notas,
          // El modelo de 3 ranuras. `base_tipo` presente = la fila lo usa.
          cantidad: i.cantidad == null ? null : Number(i.cantidad),
          cantidad_unidad: i.cantidad_unidad ?? null,
          precio_fuente: i.precio_fuente ?? null,
          precio_referencia: i.precio_referencia ?? null,
          base_tipo: i.base_tipo ?? null,
          base_categorias: i.base_categorias ?? null,
          base_manual: i.base_manual == null ? null : Number(i.base_manual),
          historico_modo: i.historico_modo ?? null,
          historico_meses: i.historico_meses == null ? null : Number(i.historico_meses),
          nro_cuentas: i.nro_cuentas ?? null,
          distribucion: i.distribucion ?? null,
          meses_pct: i.meses_pct ?? null,
        }
        if (!insumosPorActividad.has(clave)) insumosPorActividad.set(clave, [])
        insumosPorActividad.get(clave)!.push(fila)
        editablesOut[String(i.id)] = {
          id: String(i.id), concepto: fila.concepto, modo: fila.modo, valor: fila.valor,
          unidad: fila.unidad, moneda: fila.moneda, momento: String(i.momento ?? "ciclo"),
          has_aplicacion: fila.has_aplicacion, amortiza_anios: fila.amortiza_anios,
          base_cabezas: fila.base_cabezas, cabezas_aplicacion: fila.cabezas_aplicacion,
          cantidad_aplicacion: fila.cantidad_aplicacion,
          fundamento: fila.fundamento, notas: fila.notas, ajustes: fila.ajustes ?? [],
          cantidad: fila.cantidad ?? null, cantidad_unidad: fila.cantidad_unidad ?? null,
          precio_fuente: fila.precio_fuente ?? null,
          precio_referencia: fila.precio_referencia ?? null,
          base_tipo: fila.base_tipo ?? null,
          base_categorias: fila.base_categorias ?? null,
          base_manual: fila.base_manual ?? null,
          historico_modo: fila.historico_modo ?? null,
          historico_meses: fila.historico_meses ?? null,
          nro_cuentas: fila.nro_cuentas ?? null,
          distribucion: fila.distribucion ?? null,
          meses_pct: fila.meses_pct ?? null,
        }
      }
      setEditables(editablesOut)

      // ── El costo de alimentación MEDIDO ───────────────────────────────────
      //
      // Hasta acá las filas de ración decían "sin calcular" — `resolverCostoDirecto()` no sabe
      // resolver `pct_racion` porque no tiene ni curva de peso ni tramos (A-BUG-56). Ahora,
      // cuando hay mediciones de stock, el número no se estima: **se mide y se reparte**.
      //
      // Si no hay medición no se inventa nada: la fila sigue marcada, con el motivo cambiado
      // para que diga dónde se carga.
      const alim = await cargarCostoAlimentacion(campana, actPorId, actDeCategoria)
      const medidos = alim ? alim.porActividad : []

      const costos: CostoDirecto[] = []
      for (const n of nombresAct) {
        const mios = insumosPorActividad.get(claveActividad(n)) ?? []
        if (mios.length === 0) {
          costos.push({
            actividad: n, concepto: "Costos directos", monto: null,
            motivo: idProdPorClave.has(claveActividad(n))
              ? `la actividad existe en Productivo pero no tiene insumos cargados`
              : `la actividad "${n}" no existe en Productivo`,
          })
          continue
        }
        const ctxCosto: ContextoCosto = {
          has: hasPorActividad[n] ?? null, cabezas: cabezasCampana || null, cabezasCiclo,
          tc, tcPorMes, meses: mesesCampana, ipcAcumulado,

          // El precio de una referencia EN UN MES. Para hacienda usa la función canónica, con
          // banda de peso y arrastre — la misma que Productivo, para que den lo mismo.
          precioDe: (fuente, referencia, anio, mes) => {
            if (fuente !== "hacienda") return null
            const r = resolverPrecioHacienda(preciosOut, referencia, anio, mes, null)
            return r.precio_pesos_kg > 0 ? r.precio_pesos_kg : null
          },

          // El arranque HISTÓRICO: lo ya gastado en una o varias cuentas contables.
          //
          // Reusa `calcularCuenta()` de `lib/presupuesto/modos.ts`, que es la que ya proyecta el
          // panel de cuentas. Las cuentas elegidas se funden en una sola serie sintética: sumar
          // primero y proyectar después es lo mismo que proyectar cada una y sumar, y así el modo
          // (promedio, estacional, última FC) se aplica una sola vez.
          historicoDe: (cuentas, modo, nMeses) => {
            if (cuentas.length === 0) return null
            const porMes = new Map<string, PuntoHistorico>()
            for (const p of historia) {
              if (!cuentas.includes(p.nro_cuenta)) continue
              const k = claveMes(p.anio, p.mes)
              const prev = porMes.get(k)
              if (prev) { prev.monto += p.monto; prev.facturas += p.facturas }
              else porMes.set(k, { ...p, nro_cuenta: "__margen__" })
            }
            if (porMes.size === 0) return null
            const celdas = calcularCuenta(
              {
                nro_cuenta: "__margen__",
                modo: modo as any,
                meses_promedio: nMeses,
                cabezas_referencia: cabezasCampana || null,
                cabezas_proyectadas: cabezasCampana || null,
              },
              Array.from(porMes.values()),
              { meses: mesesCampana, inflacionMensual: 0, ipc: serieIpc as any },
            )
            const total = celdas.reduce((s, c) => s + c.monto, 0)
            if (total <= 0) return null
            const etiqueta = cuentas.length === 1 ? `la cuenta ${cuentas[0]}` : `${cuentas.length} cuentas`
            // Las celdas viajan para poder mostrar LA MUESTRA: qué facturas reales entraron.
            return { monto: total, motivo: `${celdas[0]?.explicacion ?? "histórico"} · ${etiqueta}`, celdas }
          },
        }
        // ⚠️ Los medidos que ninguna receta reclame se agregan igual, al final. Antes se
        // PERDÍAN: si el producto se llamaba `Concentrado Novillo 35 10` y la receta decía
        // `Concentrado` a secas, el costo medido no aparecía en ningún lado y nada avisaba.
        //
        // El orden correcto es ése: **el consumo medido es un hecho y no necesita el permiso de
        // ninguna receta para entrar al margen.** La receta sirve para proyectar hacia adelante;
        // el vínculo entre las dos es una comodidad de presentación, no un requisito.
        const medidosUsados = new Set<string>()

        for (const i of mios) {
          // El dato REAL primero: si hay consumo medido para este insumo y esta actividad,
          // manda sobre cualquier estimación. Es la misma regla de siempre.
          const med = medidos.find(m =>
            claveActividad(m.actividad) === claveActividad(n) && mismoInsumo(i, m.producto))
          if (med) medidosUsados.add(med.producto)
          if (med) {
            costos.push({
              actividad: n, concepto: i.concepto, monto: med.monto,
              motivo: med.monto == null
                ? `${med.producto}: medido ${med.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ${med.unidad ?? ""} — falta el precio de alguna entrega`
                : `${med.cantidad.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ${med.unidad ?? ""} · consumo MEDIDO y repartido por kilo-día`,
              insumoId: i.id,
              // Los pasos son los tramos, acumulando: así al desplegar la fila se ve cómo se
              // llegó al total y no sólo el resultado.
              pasos: (() => {
                let acum = 0
                return med.detalle.map((d, k) => {
                  acum += d.monto ?? 0
                  return { etiqueta: k === 0 ? "Consumo medido" : "", detalle: d.texto, acumulado: acum }
                })
              })(),
              fundamento: i.fundamento,
            })
            for (const f of med.faltantes) costos.push({
              actividad: n, concepto: `⚠️ ${f}`, monto: null, motivo: f,
            })
            continue
          }
          const r = resolverCostoDirecto(i, ctxCosto)
          costos.push({
            actividad: n, concepto: i.concepto, monto: r.monto, motivo: r.motivo,
            insumoId: i.id, pasos: r.pasos, fundamento: i.fundamento,
            celdas: r.celdas, historicoModo: i.historico_modo ?? null,
          })
        }

        // Lo medido que ninguna receta reclamó. Entra por su cuenta, con el nombre del producto.
        for (const med of medidos) {
          if (claveActividad(med.actividad) !== claveActividad(n)) continue
          if (medidosUsados.has(med.producto)) continue
          costos.push({
            actividad: n, concepto: med.producto, monto: med.monto,
            motivo: med.monto == null
              ? `medido ${numAR(med.cantidad)} ${med.unidad ?? ""} — falta el precio de alguna entrega`
              : `${numAR(med.cantidad)} ${med.unidad ?? ""} · consumo MEDIDO y repartido por kilo-día`
                + ` · sin fila de receta que lo proyecte`,
            pasos: (() => {
              let acum = 0
              return med.detalle.map((d, k) => {
                acum += d.monto ?? 0
                return { etiqueta: k === 0 ? "Consumo medido" : "", detalle: d.texto, acumulado: acum }
              })
            })(),
          })
          for (const f of med.faltantes) costos.push({
            actividad: n, concepto: `⚠️ ${f}`, monto: null, motivo: f,
          })
        }
      }

      // ── Las transferencias internas del ciclo ganadero ────────────────────
      //
      // La misma operación, los dos lados, UN solo número. Sin esto los animales entran a
      // costo cero: el que recibe muestra ganancia de más y el que entrega, de menos — que es
      // justo lo que avisa el panel de ciclo de recría cuando falta el precio de entrada.
      //
      // La campaña sale de la FECHA del hecho, no de `ciclos_recria.campania`: ese campo dice
      // "2026" y las campañas del margen son "25/26". Y además el hecho es el que manda: un
      // destete de febrero cae en la campaña que estaba corriendo en febrero.
      const { data: recrias } = await supabase.schema("productivo").from("ciclos_recria")
        .select("*").eq("activo", true)
      const transferencias: TransferenciaInterna[] = []
      for (const c of ((recrias || []) as any[])) {
        const desbaste = Number(c.pct_desbaste) || 0
        const num = (x: any) => (x == null ? null : Number(x))

        // ── Ida: cría → recría (el destete). Ya tenía lugar donde cargarse.
        const cabM = num(c.cabezas_machos) ?? 0
        const cabH = num(c.cabezas_hembras) ?? 0
        const cabezas = cabM + cabH
        // El NETO se calcula, no se carga: es la regla del panel de ciclo.
        const kgNetos = cabM * (num(c.peso_neto_macho_kg) ?? 0) + cabH * (num(c.peso_neto_hembra_kg) ?? 0)
        const precioEnt = num(c.precio_kg_entrada)
        // ⚠️ FUENTE ÚNICA: si ya hay un lote con destino a Recría, el hecho vive ahí y el
        // precio del ciclo NO se usa. Tener el mismo destete en dos lados terminaría en dos
        // números que dejan de coincidir — que es justo lo que la unificación viene a evitar.
        const yaHayLoteADestino = lotesOut.some(l =>
          l.destinoActividad && claveActividad(l.destinoActividad) === claveActividad("Recria"))
        if (cabezas > 0 && c.fecha_inicio && !yaHayLoteADestino) {
          // Misma regla que el traspaso por lote: se descuenta la comercialización, no el IVA.
          const czEnt = pctGastoVentaPorDefecto("Ternero")
          const monto = precioEnt != null && kgNetos > 0 ? kgNetos * precioEnt * (1 - czEnt) : null
          transferencias.push({
            concepto: "Destete: entrada de cría",
            actividadOrigen: "Cria", actividadDestino: "Recria",
            cabezas, kgNetos, precioKg: precioEnt, monto,
            campania: campanaDeFecha(String(c.fecha_inicio)),
            detalle: monto == null
              ? `${numAR(cabezas)} cab · ${numAR(kgNetos)} kg netos — falta el $/kg de entrada`
              : `${numAR(cabezas)} cab × ${numAR(kgNetos / (cabezas || 1), 1)} kg netos × ${pesos(precioEnt!)}/kg`
                + ` · ingreso de Cría y costo de entrada de Recría`,
          })
        }

        // ── Vuelta: recría → cría (las de reposición). No se venden afuera.
        const cabRep = num(c.cabezas_reposicion) ?? 0
        const brutoRep = num(c.peso_bruto_reposicion_kg) ?? 0
        const precioRep = num(c.precio_kg_reposicion)
        // Mismo criterio: si la reposición ya está cargada como lote con destino a Cría,
        // manda el lote. El bloque del ciclo queda como el camino viejo.
        const yaHayLoteACria = lotesOut.some(l =>
          l.destinoActividad && claveActividad(l.destinoActividad) === claveActividad("Cria"))
        if (cabRep > 0 && !yaHayLoteACria) {
          const kgRep = cabRep * brutoRep * (1 - desbaste)
          const czRep = pctGastoVentaPorDefecto("Ternera")
          const monto = precioRep != null && kgRep > 0 ? kgRep * precioRep * (1 - czRep) : null
          transferencias.push({
            concepto: "Reposición: vaquillonas a cría",
            actividadOrigen: "Recria", actividadDestino: "Cria",
            cabezas: cabRep, kgNetos: kgRep, precioKg: precioRep, monto,
            campania: campanaDeFecha(String(c.fecha_reposicion || c.fecha_fin_estimada || c.fecha_inicio || "")),
            detalle: monto == null
              ? `${numAR(cabRep)} cab · ${numAR(kgRep)} kg netos — falta el $/kg de la reposición`
              : `${numAR(cabRep)} cab × ${numAR(brutoRep * (1 - desbaste), 1)} kg netos × ${pesos(precioRep!)}/kg`
                + ` · ingreso de Recría y costo de entrada de Cría`,
          })
        }
      }

      // ── Las ventas que YA OCURRIERON ──────────────────────────────────────
      //
      // El margen leía sólo `stock_lotes` —el plan— teniendo la venta real cargada al lado
      // (A-BUG-62). El lote de los 55 decía 275 kg y $5.876/kg; la venta fue 294,18 kg a
      // $5.670. Es la regla `default del dato real, siempre editable`: si el hecho existe,
      // manda el hecho, y el lote proyecta sólo lo que todavía no se vendió.
      const { data: ventasRaw } = await supabase.schema("productivo").from("stock_ventas")
        .select("lote_id, fecha_venta, cantidad, kg_totales, precio_kg, monto_neto, pct_cz")
      const ventasReales: VentaRealLote[] = ((ventasRaw || []) as any[])
        .filter(v => v.lote_id)
        .map(v => ({
          loteId: String(v.lote_id),
          fecha: String(v.fecha_venta),
          cabezas: Number(v.cantidad) || 0,
          kgTotales: Number(v.kg_totales) || 0,
          precioKg: Number(v.precio_kg) || 0,
          montoNeto: v.monto_neto == null ? null : Number(v.monto_neto),
          pctCz: Number(v.pct_cz) || 0,
        }))

      // ── La ACTIVACIÓN y la APERTURA POR GRUPO ─────────────────────────────
      //
      // Las dos salen del mismo dato: el costo por grupo, sin filtrar por campaña. Una lo
      // acumula hasta el borde de la campaña (existencia), la otra lo agrupa (apertura).
      const existencias: ExistenciaActividad[] = []
      const gruposResultado: ResultadoGrupo[] = []

      if (alim) {
        const lim = limitesCampana(campana)
        const porGrupo: CostoGrupoTramo[] = alim.porGrupo
        // El valor de entrada por cabeza: de la transferencia del destete.
        const entrada = transferencias.find(t => t.concepto.startsWith("Destete"))
        const entradaPorCab = entrada && entrada.monto != null && entrada.cabezas > 0
          ? entrada.monto / entrada.cabezas : null

        for (const g of alim.grupos) {
          const act = alim.actDeGrupo(g.id)
          if (!act) continue
          // El grupo salió cuando salió; si sigue, está vivo al cierre.
          const vivoAl = (f: string) => g.desde < f && (g.hasta == null || g.hasta >= f)
          const acumIni = acumuladoHasta(porGrupo, g.id, lim.inicio)
          const acumFin = acumuladoHasta(porGrupo, g.id, lim.fin)

          for (const [momento, f, acum] of [
            ["inicial", lim.inicio, acumIni], ["final", lim.fin, acumFin],
          ] as const) {
            if (!vivoAl(f)) continue
            const base = entradaPorCab != null ? entradaPorCab * g.cabezas : null
            const monto = base == null || acum.costo == null ? null : base + acum.costo
            const prev = existencias.find(e => e.actividad === act && e.momento === momento)
            if (prev) {
              prev.cabezas += g.cabezas
              prev.monto = prev.monto == null || monto == null ? null : prev.monto + monto
            } else {
              existencias.push({
                actividad: act, momento, cabezas: g.cabezas, monto,
                detalle: monto == null
                  ? "falta el valor de entrada o el precio de alguna entrega"
                  : `valor de entrada + lo imputado hasta ${f.split("-").reverse().join("/")}`,
              })
            }
          }

          // ── La apertura por grupo ───────────────────────────────────────
          const vendido = g.hasta != null && g.hasta < lim.fin
          const vr = ventasReales.find(v => v.loteId === g.id)
          const ingreso = vr
            ? (vr.montoNeto ?? vr.kgTotales * vr.precioKg * (1 - (vr.pctCz || 0)))
            : null
          const costoAlim = acumFin.costo
          const valorEntrada = entradaPorCab != null ? entradaPorCab * g.cabezas : null
          gruposResultado.push({
            actividad: act, grupoId: g.id, nombre: g.nombre, cabezas: Math.round(g.cabezas),
            ingreso, entrada: valorEntrada, alimentacion: costoAlim,
            margen: ingreso == null || valorEntrada == null || costoAlim == null
              ? null : ingreso - valorEntrada - costoAlim,
            estado: vendido ? "vendido" : "en stock",
          })
        }
      }

      setDatos({
        campana, hasPorActividad, lotes: lotesOut, costos,
        precios: preciosOut, pctGastoVenta: pctGastoVentaPorDefecto,
        transferencias, ventasReales, existencias, gruposResultado,
      })
    } finally { setCargando(false) }
  }, [campana, recargarToken])

  useEffect(() => { cargar() }, [cargar])

  const margenes: MargenActividad[] = useMemo(
    () => (datos ? calcularMargen(datos) : []), [datos])

  /** Las bandas que SÍ tienen precio cargado. El selector marca las otras en vez de dejar
   *  que se elija una vacía y el margen sólo diga que falta. */
  const bandasConPrecio = useMemo(
    () => Array.from(new Set((datos?.precios ?? []).map(p => p.categoria))), [datos])

  /** Los 12 meses de la campaña elegida, jul → jun. El editor los usa para etiquetar y para
   *  marcar los que ya pasaron. */
  const mesesPeriodo = useMemo(() => mesesDeCampana(campana), [campana])

  // ⚠️ El spinner sólo en la PRIMERA carga (`!datos`), no en cada recarga.
  //
  // Antes se mostraba también al refrescar, y eso desmontaba la tabla entera: al guardar un costo
  // se cerraba la actividad y la fila que estabas editando, y había que volver a abrir todo. Lo
  // reportó el usuario: *"algunos lugares donde apreto me resetean la vista, debo abrir de vuelta
  // insumos vet"*. Manteniendo el árbol montado, el estado de lo abierto sobrevive.
  if (!datos) {
    return (
      <Card><CardContent className="flex items-center justify-center py-10 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Armando el margen…
      </CardContent></Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" /> Margen por actividad
              {cargando && (
                <span className="flex items-center gap-1 text-[10px] font-normal text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> actualizando
                </span>
              )}
            </CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Sin tablas propias: lee hectáreas, rodeo, ventas, precios y costos de donde ya viven.
              <strong> En pesos</strong>, por unidad y en total.{" "}
              <strong>Cada costo se despliega</strong> para ver cómo se llegó al número y editarlo.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Campaña</span>
            {campanas.map(c => (
              <button key={c} type="button" onClick={() => setCampana(c)}
                className={`rounded border px-2 py-0.5 text-xs ${
                  campana === c ? "border-gray-700 bg-gray-700 text-white" : "border-gray-200 hover:bg-gray-50"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {sinIPC && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
            ⚠️ No hay IPC cargado: los costos que se ajustan por IPC no se pueden calcular.
            Se carga en <strong>Precios y TC</strong>.
          </p>
        )}
        {desalineadas.length > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            <AlertTriangle className="mr-1 inline h-3 w-3" />
            <strong>Dos maestros de actividad conviviendo.</strong> Estas existen en el presupuesto
            pero no en Productivo, así que no tienen costos: <strong>{desalineadas.join(" · ")}</strong>.
            Es lo que hay que resolver en la Fase 1.
          </div>
        )}

        {margenes.map(m => {
          const open = abierta === m.actividad
          return (
            <div key={m.actividad} className="rounded border">
              <button type="button" onClick={() => setAbierta(open ? null : m.actividad)}
                className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                <span className="text-sm font-medium text-gray-800">{m.actividad}</span>
                {m.has != null && (
                  <Badge variant="outline" className="text-[9px]">{numAR(m.has)} ha</Badge>
                )}
                {m.cabezas != null && (
                  <Badge variant="outline" className="text-[9px]">{numAR(m.cabezas)} cab</Badge>
                )}
                {m.faltantes.length > 0 && (
                  <span className="text-[10px] text-amber-600">
                    {m.faltantes.length} {m.faltantes.length === 1 ? "faltante" : "faltantes"}
                  </span>
                )}
                <span className="ml-auto text-right">
                  <span className="block text-xs font-semibold text-gray-800">
                    {pesos(m.margenBruto)}
                  </span>
                  {m.margenPorHa != null && (
                    <span className="block text-[10px] text-gray-500">
                      {pesos(m.margenPorHa)} / ha
                    </span>
                  )}
                </span>
              </button>

              {open && (
                <div className="space-y-2 border-t bg-slate-50 px-3 py-3">
                  {m.faltantes.length > 0 && (
                    <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <p className="text-[11px] font-medium text-amber-900">Para que este margen sea confiable falta:</p>
                      <ul className="mt-0.5 space-y-0.5 text-[10px] text-amber-800">
                        {m.faltantes.map((f, i) => <li key={i}>· {f}</li>)}
                      </ul>
                      {/* No mandar a buscar: el faltante ES el acceso. Lo pidio el usuario —
                          "desde margen o desde presupuesto me debe llevar a la edicion". */}
                      {m.faltaPrecio.length > 0 && onCargarPrecio && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.faltaPrecio.map((f, i) => (
                            <button key={i} type="button"
                              onClick={() => onCargarPrecio(f.banda)}
                              className="rounded border border-amber-400 bg-white px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100">
                              Cargar precio de {f.banda} →
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Bloque titulo="Ingresos" lineas={m.ingresos} total={m.totalIngresos} has={m.has} />
                  <Bloque titulo="Costos directos" lineas={m.costos} total={m.totalCostos} has={m.has}
                    editables={editables} cuentas={cuentasConHistoria}
                    bandasConPrecio={bandasConPrecio} mesesPeriodo={mesesPeriodo}
                    onCargarPrecio={onCargarPrecio}
                    onGuardado={cargar} />

                  {/* ── La apertura por grupo ─────────────────────────────
                      Es una apertura del total, no otro número: la suma tiene que dar el
                      margen bruto de abajo, y ése es el control. */}
                  {m.grupos.length > 0 && <AperturaGrupos grupos={m.grupos} margen={m.margenBruto} />}

                  <table className="w-full rounded border bg-white text-[11px]">
                    <tbody>
                      <tr className="font-semibold text-gray-800">
                        <td className="px-2 py-1.5">MARGEN BRUTO</td>
                        <td className="w-28 px-2 py-1.5 text-right">
                          {m.margenPorHa != null
                            ? <>{pesos(m.margenPorHa)}<span className="text-[9px] font-normal text-gray-400"> /ha</span></>
                            : "—"}
                        </td>
                        <td className="w-32 px-2 py-1.5 text-right">{pesos(m.margenBruto)}</td>
                      </tr>
                      {m.cabezas ? (
                        <tr className="border-t text-[10px] text-gray-500">
                          <td className="px-2 py-1">por cabeza</td>
                          <td className="px-2 py-1 text-right">{pesos(m.margenBruto / m.cabezas)}</td>
                          <td className="px-2 py-1 text-right">{numAR(m.cabezas)} cab</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        {margenes.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">
            No hay nada cargado para {campana}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Un bloque del margen, en DOS COLUMNAS: por unidad y total.
 *
 * El usuario lo pidió explícito: *"lo que es por unidad vs total, en 2 columnas siempre, no
 * debajo uno del otro"*. Y tiene razón — apilados no se pueden comparar de un vistazo, que es
 * justo para lo que sirve el por-unidad.
 *
 * Las líneas que vienen de un insumo se **despliegan**: colapsadas muestran el número final,
 * abiertas muestran cómo se llegó a él y dejan editarlo.
 */
function Bloque({
  titulo, lineas, total, has, editables, cuentas, bandasConPrecio, mesesPeriodo,
  onCargarPrecio, onGuardado,
}: {
  titulo: string; lineas: MargenActividad["ingresos"]; total: number; has: number | null
  editables?: Record<string, CostoEditable>
  cuentas?: { nro: string; nombre: string }[]
  bandasConPrecio?: string[]
  mesesPeriodo?: { anio: number; mes: number }[]
  onCargarPrecio?: (banda: string) => void
  onGuardado?: () => void
}) {
  const [abierto, setAbierto] = useState<string | null>(null)

  if (lineas.length === 0) {
    return (
      <div className="rounded border bg-white px-2 py-1.5">
        <p className="text-[11px] font-medium text-gray-700">{titulo}</p>
        <p className="text-[10px] text-gray-400">sin datos cargados</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded border bg-white">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
            <th className="px-2 py-1 text-left font-medium">{titulo}</th>
            <th className="w-28 px-2 py-1 text-right font-medium">Por unidad</th>
            <th className="w-32 px-2 py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => {
            const editable = l.insumoId ? editables?.[l.insumoId] : undefined
            const open = !!l.insumoId && abierto === l.insumoId
            return (
              <Fragment key={i}>
                <tr
                  className={`border-b last:border-0 ${l.confiable ? "" : "opacity-60"} ${
                    editable ? "cursor-pointer hover:bg-slate-50" : ""} ${open ? "bg-slate-50" : ""}`}
                  onClick={editable ? () => setAbierto(open ? null : l.insumoId!) : undefined}>
                  <td className="px-2 py-1">
                    <p className="flex items-center gap-1 text-gray-700">
                      {editable && (open
                        ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                        : <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />)}
                      {l.concepto}
                      {!l.confiable && <span className="text-[9px] text-amber-600">sin calcular</span>}
                      {editable && !open && <Pencil className="h-2.5 w-2.5 text-gray-300" />}
                    </p>
                    <p className="pl-4 text-[9px] text-gray-400">{l.detalle}</p>
                    {l.fundamento && (
                      <p className="pl-4 text-[9px] italic text-gray-400">“{l.fundamento}”</p>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-600">
                    {l.porCabeza != null ? (
                      <>{pesos(l.porCabeza)}<span className="text-[9px] text-gray-400"> /cab</span></>
                    ) : l.porHa != null ? (
                      <>{pesos(l.porHa)}<span className="text-[9px] text-gray-400"> /ha</span></>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-800">{pesos(l.total)}</td>
                </tr>
                {open && editable && (
                  <tr>
                    <td colSpan={3} className="p-0">
                      <EditorCostoActividad costo={editable} pasos={l.pasos} cuentas={cuentas}
                        bandasConPrecio={bandasConPrecio} celdas={l.celdas}
                        mesesPeriodo={mesesPeriodo} onCargarPrecio={onCargarPrecio}
                        onGuardado={() => onGuardado?.()} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-gray-50 font-medium">
            <td className="px-2 py-1 text-gray-700">Total {titulo.toLowerCase()}</td>
            <td className="px-2 py-1 text-right text-gray-600">
              {has ? <>{pesos(total / has)}<span className="text-[9px] text-gray-400"> /ha</span></> : "—"}
            </td>
            <td className="px-2 py-1 text-right font-semibold text-gray-800">{pesos(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * El resultado abierto por grupo — los 55, los machos, las hembras.
 *
 * ⚠️ **No es otro número: es el mismo, abierto.** Como el reparto es proporcional a una clave,
 * repartir N grupos a la vez da lo mismo que repartir 2 y subdividir — así que la suma tiene que
 * dar el margen bruto. Por eso el control va abajo y a la vista, y por eso esto vive DENTRO de
 * la actividad y no en otra pantalla: un segundo lugar sería un segundo número que discutir.
 */
function AperturaGrupos({ grupos, margen }: { grupos: ResultadoGrupo[]; margen: number }) {
  const [abierto, setAbierto] = useState(false)
  const completos = grupos.filter(g => g.margen != null)
  const suma = completos.reduce((s, g) => s + (g.margen ?? 0), 0)
  // Sólo se puede controlar contra el total si están TODOS: con uno incompleto la diferencia
  // no dice nada y un cartel rojo espurio es peor que no ponerlo.
  const controlable = completos.length === grupos.length && grupos.length > 0
  const cierra = controlable && Math.abs(suma - margen) < 1

  return (
    <div className="rounded border bg-white">
      <button type="button" onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50">
        {abierto ? <ChevronDown className="h-3 w-3 text-gray-400" />
                 : <ChevronRight className="h-3 w-3 text-gray-300" />}
        <span className="text-[11px] font-medium text-gray-700">
          Por grupo ({grupos.length})
        </span>
        <span className="text-[10px] text-gray-400">
          quién aportó qué — los vendidos y los que quedan
        </span>
      </button>

      {abierto && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b bg-gray-50 text-[9px] uppercase text-gray-500">
                <th className="px-2 py-1 text-left font-medium">Grupo</th>
                <th className="w-14 px-2 py-1 text-right font-medium">Cab</th>
                <th className="w-28 px-2 py-1 text-right font-medium">Ingreso</th>
                <th className="w-28 px-2 py-1 text-right font-medium">Entrada</th>
                <th className="w-28 px-2 py-1 text-right font-medium">Alimentación</th>
                <th className="w-28 px-2 py-1 text-right font-medium">Margen</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => (
                <tr key={g.grupoId} className={`border-b last:border-0 ${g.margen == null ? "opacity-60" : ""}`}>
                  <td className="px-2 py-1 text-gray-700">
                    {g.nombre}
                    <span className={`ml-1 text-[9px] ${g.estado === "vendido" ? "text-emerald-700" : "text-gray-400"}`}>
                      {g.estado}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right text-gray-500">{numAR(g.cabezas)}</td>
                  <td className="px-2 py-1 text-right text-gray-700">
                    {g.ingreso == null ? "—" : pesos(g.ingreso)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-500">
                    {g.entrada == null ? "—" : pesos(-g.entrada)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-500">
                    {g.alimentacion == null ? "—" : pesos(-g.alimentacion)}
                  </td>
                  <td className={`px-2 py-1 text-right font-medium ${
                    g.margen == null ? "text-gray-400" : g.margen < 0 ? "text-red-700" : "text-gray-800"}`}>
                    {g.margen == null ? "sin calcular" : pesos(g.margen)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-gray-50">
                <td className="px-2 py-1 text-[10px] text-gray-600" colSpan={5}>
                  {controlable ? (
                    <>
                      {cierra ? "✓" : "✗"} la suma de los grupos{" "}
                      {cierra ? "da el margen bruto" : (
                        <span className="font-medium text-red-700">
                          NO da el margen bruto — difiere en {pesos(suma - margen)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-700">
                      no se puede controlar contra el total: {grupos.length - completos.length} grupo(s)
                      {" "}sin calcular
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 text-right font-semibold text-gray-800">
                  {controlable ? pesos(suma) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
