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
  calcularMargen, pctGastoVentaPorDefecto, claveActividad, resolverCostoDirecto,
  type DatosMargen, type LoteVenta, type CostoDirecto, type MargenActividad,
  type InsumoActividadMargen, type Ajuste,
} from "@/lib/presupuesto/margen"

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const numAR = (n: number, dec = 0) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec })

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
  const [campana, setCampana] = useState("26/27")
  const [campanas, setCampanas] = useState<string[]>([])
  const [datos, setDatos] = useState<DatosMargen | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  /** Actividades de `centros_costo` que no tienen par en `productivo.actividades`. */
  const [desalineadas, setDesalineadas] = useState<string[]>([])
  /** Los costos que se pueden editar desde acá, por id de insumo. */
  const [editables, setEditables] = useState<Record<string, CostoEditable>>({})
  const [sinIPC, setSinIPC] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [acts, asig, ciclos, lotes, cats, precios, actProd] = await Promise.all([
        supabase.from("centros_costo").select("id, nombre").eq("tipo", "actividad").eq("activo", true),
        supabase.from("campo_campana_actividad").select("campana, centro_costo_id, has_netas"),
        supabase.schema("productivo").from("stock_ciclos").select("id, campania, vacas_apertura"),
        supabase.schema("productivo").from("stock_lotes")
          .select("categoria, cantidad, cantidad_calculada, peso_base_kg, ganancia_diaria_kg, fecha_disponible, fecha_peso, fecha_venta_estimada, precio_kg_override, pct_desbaste, ciclo_id"),
        supabase.schema("productivo").from("categorias_hacienda").select("nombre, centro_costo_id"),
        supabase.from("precios_hacienda").select("categoria, precio_pesos_kg, peso_desde, peso_hasta, anio, mes"),
        supabase.schema("productivo").from("actividades").select("id, nombre, activo"),
      ])
      const [{ data: insumos }, { data: tcs }, { data: ciclosFull }, { data: ajustesRaw }, { data: ipcRaw }] =
        await Promise.all([
          supabase.schema("productivo").from("actividad_insumos")
            .select("id, actividad_id, concepto, modo, valor, unidad, moneda, momento, has_aplicacion, amortiza_anios, base_cabezas, cabezas_aplicacion, cantidad_aplicacion, fundamento, notas, orden")
            .order("orden"),
          supabase.from("tipos_cambio").select("anio, mes, tc_presupuestado, tc_real"),
          supabase.schema("productivo").from("stock_ciclos").select("*"),
          supabase.schema("productivo").from("actividad_insumo_ajustes").select("*").order("orden"),
          supabase.from("indices_ipc").select("anio, mes, valor_ipc"),
        ])

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
      setCampanas(Array.from(setCamp).sort())

      // La categoría dice a qué actividad va cada lote.
      const actDeCategoria = new Map(
        ((cats.data || []) as any[]).map(c => [String(c.nombre), actPorId.get(c.centro_costo_id) ?? null]))
      const campDeCiclo = new Map(((ciclos.data || []) as any[]).map(c => [c.id, String(c.campania)]))

      const lotesOut: LoteVenta[] = ((lotes.data || []) as any[]).map(l => ({
        categoria: String(l.categoria),
        cabezas: Number(l.cantidad_calculada ?? l.cantidad) || 0,
        peso_base_kg: Number(l.peso_base_kg) || 0,
        ganancia_diaria_kg: Number(l.ganancia_diaria_kg) || 0,
        fecha_disponible: l.fecha_disponible, fecha_peso: l.fecha_peso,
        fecha_venta_estimada: l.fecha_venta_estimada,
        precio_kg_override: l.precio_kg_override == null ? null : Number(l.precio_kg_override),
        pct_desbaste: Number(l.pct_desbaste) || 0,
        campania: campDeCiclo.get(l.ciclo_id) ?? null,
        actividad: actDeCategoria.get(String(l.categoria)) ?? null,
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

      // TC: el real si está, si no el presupuestado. El más reciente cargado.
      const tcOrdenados = ((tcs || []) as any[])
        .sort((a, b) => (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes))
      const tc = tcOrdenados.length > 0
        ? Number(tcOrdenados[0].tc_real ?? tcOrdenados[0].tc_presupuestado) || null
        : null

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
        }
      }
      setEditables(editablesOut)

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
        const ctxCosto = {
          has: hasPorActividad[n] ?? null, cabezas: cabezasCampana || null, cabezasCiclo, tc,
          ipcAcumulado,
        }
        for (const i of mios) {
          const r = resolverCostoDirecto(i, ctxCosto)
          costos.push({
            actividad: n, concepto: i.concepto, monto: r.monto, motivo: r.motivo,
            insumoId: i.id, pasos: r.pasos, fundamento: i.fundamento,
          })
        }
      }

      setDatos({
        campana, hasPorActividad, lotes: lotesOut, costos,
        precios: preciosOut, pctGastoVenta: pctGastoVentaPorDefecto,
      })
    } finally { setCargando(false) }
  }, [campana, recargarToken])

  useEffect(() => { cargar() }, [cargar])

  const margenes: MargenActividad[] = useMemo(
    () => (datos ? calcularMargen(datos) : []), [datos])

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
                    editables={editables} onGuardado={cargar} />

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
function Bloque({ titulo, lineas, total, has, editables, onGuardado }: {
  titulo: string; lineas: MargenActividad["ingresos"]; total: number; has: number | null
  editables?: Record<string, CostoEditable>; onGuardado?: () => void
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
                      <EditorCostoActividad costo={editable} pasos={l.pasos}
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
