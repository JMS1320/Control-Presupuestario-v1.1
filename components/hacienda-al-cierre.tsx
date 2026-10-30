"use client"

/**
 * 🐄 HACIENDA AL CIERRE — existencia y valuación (A-FEAT-1184).
 *
 * Vive aparte de `papeles-de-balance.tsx` porque tiene su propio ciclo: trae precios de **dos
 * mercados externos** y acepta que el usuario los pise a mano. Mezclarlo con el libro diario haría
 * que un mercado caído impidiera bajar las compras, que no tienen nada que ver.
 *
 * ## De dónde sale cada cosa
 * - **Existencia**: `productivo.movimientos_hacienda`, sumando cantidades con signo hasta el cierre.
 * - **Precios**: `/api/precios-mag` (Cañuelas, categorías comerciales) y `/api/precios-mercado`
 *   (Entresurcos, por rango de kilos). **Todo el mes del cierre**, como pidió el usuario:
 *   *«se debería tomar todo el mes de junio para tomar algo representativo»*.
 * - **Criterios**: `lib/balance/hacienda-stock.ts`, transcriptos de su planilla.
 *
 * ## 🕳️ Los huecos se muestran, no se rellenan
 * Una categoría sin precio **no se valúa en cero**: sale listada con su criterio. Y el campo de
 * precio a mano está **siempre** disponible (§ 🎚️): vacío = usá el mercado, lleno = acá mando yo.
 *
 * ⚠️ Sólo lee de la base. Los precios a mano viven en la pantalla, no se guardan todavía.
 */
import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { traerTodo } from "@/lib/supabase-paginado"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { primerDiaDelEjercicio, type Ejercicio } from "@/lib/balance/ejercicio"
import { useDatosDelBalance, textoEstadoGuardado } from "@/lib/balance/datos-usuario"
import {
  cuadrarHacienda, type CuadreHacienda, type MovimientoDeHacienda,
} from "@/lib/balance/cuadre-hacienda"
import {
  valuarHacienda, CRITERIOS,
  type ValuacionHacienda, type PrecioMag, type PrecioMercado, type PrecioCabeza,
  type ExistenciaHacienda,
} from "@/lib/balance/hacienda-stock"
import {
  armarStockInsumos, desdeStockInsumo, existenciaAlCierre, PAPELES_SIN_ORIGEN, type StockInsumos,
} from "@/lib/balance/stock-insumos"
import {
  cuadrarGranos, valuarGranos, armarSementeras,
  type CuadreGranos, type ValuacionGranos, type Sementeras,
} from "@/lib/balance/granos-sementeras"
import { MarcaTentativo } from "@/components/marca-tentativo"
import { TresSaldosHacienda } from "@/components/tres-saldos-hacienda"
import { SaldosProductivos } from "@/components/saldos-productivos"
import {
  sistemaProductivoAlCierre, diaAnterior, leerFotosProductivas, armarSaldosProductivos, type ValoresFoto,
} from "@/lib/balance/saldos-productivos"
import { armarTresSaldos } from "@/lib/balance/tres-saldos-hacienda"
import type { SaldosParaExcel } from "@/lib/balance/saldos-excel"
import { leerStockInicio, type RenglonStockInicio, type Pastura } from "@/lib/balance/stock-inicio"
import { ultimoPublicado, leyendaPrecios, pizarraAlCierre, URL_FUENTES, type FuentePrecio } from "@/lib/balance/precio-al-cierre"
import { StockInicioDetalle } from "@/components/stock-inicio-detalle"
import { sistemaAlMomento } from "@/lib/balance/tres-saldos-hacienda"
import { leyendaTentativo } from "@/lib/balance/datos-usuario-puro"
import { pesosAlCierre, type PesoCategoria } from "@/lib/balance/pesos-hacienda"

/**
 * es-AR: coma decimal, punto de miles. **Vacío devuelve `null`, no 0** — «no lo sé» y «cero»
 * son cosas distintas, y confundirlas haría que el cuadre se declarara cerrado sin datos.
 */
const tn = (s: string): number | null => {
  if (!s.trim()) return null
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ent = (n: number) => Math.round(n).toLocaleString("es-AR")

export interface DatosHacienda {
  existencias: ExistenciaHacienda[]
  valuacion: ValuacionHacienda
  mag: PrecioMag[]
  /** Entresurcos por kilo, **separado por sexo**: son dos endpoints con precios distintos. */
  mercado: { macho: PrecioMercado[]; hembra: PrecioMercado[] }
  /** Entresurcos por cabeza: vientres y toros. Cierra el hueco de vaca, vaquillona y toro. */
  porCabeza: { vientres: PrecioCabeza[]; toros: PrecioCabeza[] }
  /** El mes que se usó para los precios, para que quede dicho en el papel. */
  mesPrecios: string
  /**
   * 🧮 El cuadre de la existencia: inicio ± movimientos = cierre, más lo que no se pudo contar.
   * Pedido del usuario 2026-09-29. Va **arriba** de la valuación en el papel.
   */
  cuadre: CuadreHacienda
  /** 🐄 A-FEAT-1386 (d): cabezas por categoría de la app al inicio y al cierre, para los tres saldos. */
  sistema: { inicio: Record<string, number>; cierre: Record<string, number> }
  /** 🐄🌾 A-FEAT-1386: las tablas de saldos (Sistema · SENASA · Campo · Balance), tal cual se ven, para el Excel. */
  saldos?: SaldosParaExcel
  /** 📦 A-FEAT-1420: el stock declarado al inicio por producto y las pasturas (para pantalla y Excel). */
  stockInicio?: { renglones: RenglonStockInicio[]; pasturas: Pastura[]; fecha: string }
  /** Los insumos viajan acá porque se traen en la misma pasada del sector productivo. */
  insumos: StockInsumos
  /** 📅 A-FEAT-1422 (14/16): de dónde salió cada precio, con su fecha y su link (para el contador). */
  fuentesPrecios?: FuentePrecio[]
  /** La pizarra de Rosario de la soja al cierre (default del precio de granos; el escrito a mano manda). */
  pizarraSoja?: { valor: number; fecha: string; url: string } | null
  /** Los kilos por categoría, de las pesadas de la app. */
  pesos: PesoCategoria[]
  /** Toneladas vendidas en el ejercicio: la única entrada del cuadre de granos que la app sabe. */
  ventasGranosTn: number
  sementeras: Sementeras
  /** Lo que el Excel necesita de granos y sementeras, ya armado con lo que el usuario escribió. */
  campo: { granos: CuadreGranos; valuacionGranos: ValuacionGranos; sementeras: Sementeras; origenPrecioGranos?: { texto: string; url: string | null } | null }
}

export function HaciendaAlCierre({
  empresa, ejercicio, onDatos,
}: { empresa: string; ejercicio: Ejercicio; onDatos: (d: DatosHacienda | null) => void }) {
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<DatosHacienda | null>(null)
  /** 🗄️ A-FEAT-1337: los precios a mano y el cuadre de granos se guardan al escribirlos. */
  const precios = useDatosDelBalance(empresa, ejercicio.anioCierre, "hacienda.precio")
  const manuales = precios.valores
  const cuadre = useDatosDelBalance(empresa, ejercicio.anioCierre, "granos")
  /**
   * 🐄🌾 A-FEAT-1386: los saldos Sistema · SENASA · Campo · Balance. Viven ACÁ (no en cada tabla) para que lo que se
   * ve y lo que va al Excel salga del mismo lugar. Campo y Balance de insumos: la foto del Balance propio.
   */
  const saldosH = useDatosDelBalance(empresa, ejercicio.anioCierre, "hacienda.saldos")
  const fechaFotoInicio = diaAnterior(primerDiaDelEjercicio(ejercicio))
  const [fotos, setFotos] = useState<{ fotos: Record<string, ValoresFoto | null>; error: string | null }>({ fotos: {}, error: null })
  useEffect(() => {
    let vivo = true
    leerFotosProductivas(supabase, empresa, [fechaFotoInicio, ejercicio.fechaCierre]).then(r => { if (vivo) setFotos(r) })
    return () => { vivo = false }
  }, [empresa, fechaFotoInicio, ejercicio.fechaCierre])
  /**
   * Las tres entradas del cuadre de granos que **hoy no están en ninguna tabla**. Van como texto
   * (§ 💰 es-AR) y vacías significan «no lo sé», no «cero» — por eso el cuadre no se declara
   * cerrado mientras falten.
   */
  const granos = {
    inicio: cuadre.valores.inicio ?? "", cosecha: cuadre.valores.cosecha ?? "",
    cierre: cuadre.valores.cierre ?? "", precio: cuadre.valores.precio ?? "",
  }


  const traer = async () => {
    setCargando(true)
    try {
      // La existencia: suma de movimientos hasta el cierre, por categoría.
      const { data: movs, error } = await supabase
        .schema("productivo")
        .from("movimientos_hacienda")
        // 🧮 **Se traen TODOS, sin filtrar por fecha**: el cuadre necesita los anteriores al inicio
        //    del ejercicio (para la existencia de arranque) y los posteriores al cierre (para poder
        //    decir por qué el stock de hoy no es el del balance). El corte se hace en la lógica pura.
        .select("cantidad, fecha, tipo, categoria:categorias_hacienda(nombre)")
      if (error) throw new Error(error.message)

      /** Normalizados una vez, para la existencia y para el cuadre. */
      const movimientos: MovimientoDeHacienda[] = ((movs ?? []) as Array<Record<string, unknown>>)
        .map(m => ({
          fecha: String(m.fecha ?? "").slice(0, 10),
          tipo: String(m.tipo ?? ""),
          cantidad: Number(m.cantidad ?? 0),
          categoria: ((m.categoria as { nombre?: string } | null)?.nombre) ?? "",
        }))

      const porCat = new Map<string, number>()
      for (const m of movimientos) {
        // ⚠️ Un movimiento sin categoría no se puede sumar a ninguna. **No desaparece**: lo cuenta
        //    `cuadrarHacienda` y sale en el cuadre del papel.
        if (!m.categoria || m.fecha > ejercicio.fechaCierre) continue
        porCat.set(m.categoria, (porCat.get(m.categoria) ?? 0) + m.cantidad)
      }
      const existencias: ExistenciaHacienda[] = [...porCat.entries()]
        .filter(([, n]) => n !== 0)
        .map(([categoria, cabezas]) => ({ categoria, cabezas }))
        .sort((a, b) => b.cabezas - a.cabezas)

      // Los precios. Si un mercado falla NO se corta: se sigue con el otro y los que falten
      // quedan como huecos, que es la información útil.
      const pedir = async <T,>(url: string): Promise<T[]> => {
        try {
          const r = await fetch(url)
          const j = await r.json()
          if (!r.ok || j?.error) { toast.warning(`${url.split("?")[0]}: ${j?.error ?? r.status}`); return [] }
          return (j.filas ?? j.datos ?? j.precios ?? []) as T[]
        } catch (e) {
          toast.warning("No se pudo traer precios: " + (e as Error).message)
          return []
        }
      }
      /**
       * ⚖️ Las pesadas hasta el cierre. Se traen con su categoría porque el peso se proyecta
       * **por categoría**, no por animal (A-FEAT-1187).
       */
      // 📄 A-BUG-1339: 990 pesadas hoy — por tandas, para que no se corte en 1000 sin avisar.
      const { data: pes } = await traerTodo((d, h) => supabase
        .schema("productivo").from("pesadas_terneros")
        .select("ternero_id, fecha, peso_kg, ternero:terneros(categoria:categorias_hacienda(nombre))")
        .lte("fecha", ejercicio.fechaCierre).order("id").range(d, h))

      // La ganancia diaria CARGADA, para poder compararla con la medida y avisar si difieren.
      const { data: lotesGan } = await supabase
        .schema("productivo").from("stock_lotes")
        .select("categoria, ganancia_diaria_kg")

      // Granos: las toneladas vendidas en el ejercicio. Es lo único del cuadre que la app sabe.
      const { data: vg } = await supabase
        .schema("msa").from("comprobantes_venta")
        .select("toneladas, fecha_liquidacion")
        .gte("fecha_liquidacion", `${Number(ejercicio.fechaCierre.slice(0, 4)) - 1}-07-01`)
        .lte("fecha_liquidacion", ejercicio.fechaCierre)

      // Sementeras: las órdenes agrícolas con sus líneas de insumo.
      const { data: ord } = await supabase
        .schema("productivo").from("ordenes_agricolas")
        .select("id, fecha, lote_nombre, hectareas, estado, lineas:lineas_orden_agricola(insumo_nombre, cantidad_total_l, unidad_dosis)")

      const { data: ins, error: errIns } = await supabase
        .schema("productivo")
        .from("stock_insumos")
        .select("*, categoria:categorias_insumo(nombre, ambito, unidad_medida)")
      if (errIns) throw new Error(errIns.message)
      // 📅 A-FEAT-1427: los movimientos, para valuar la existencia AL CIERRE y no la de hoy.
      const { data: movIns, error: errMovIns } = await traerTodo((d, h) => supabase
        .schema("productivo").from("movimientos_insumos")
        .select("id, insumo_stock_id, fecha, tipo, cantidad").order("id").range(d, h))
      if (errMovIns) throw new Error(errMovIns.message)
      const existencia = existenciaAlCierre((ins ?? []).map(desdeStockInsumo),
        (movIns ?? []).map((m: any) => ({ insumoId: String(m.insumo_stock_id), fecha: String(m.fecha), tipo: String(m.tipo), cantidad: Number(m.cantidad) })),
        ejercicio.fechaCierre)
      // 📦 A-FEAT-1420: el stock DECLARADO al inicio (no es la existencia de la app) y las pasturas.
      const si = await leerStockInicio(supabase, empresa, diaAnterior(primerDiaDelEjercicio(ejercicio)))
      si.avisos.forEach(a => toast.warning(a))

/**
       * 🐄 **Las CUATRO fuentes de precio.** Se piden juntas y **ninguna corta a las otras**: si un
       * mercado no responde, las categorías que dependían de él quedan como hueco y el resto se
       * valúa igual. Un papel incompleto sirve; uno que no se puede generar, no.
       *
       * ⚠️ **Los machos se agregaron el 2026-09-29** — el usuario lo notó: *«veo también que en
       * precios no están los de los machos»*. El endpoint ya existía con `sexo=macho` y **nunca se
       * había llamado**: el ternero se valuaba derivando de la hembra.
       */
      /**
       * 📅 ⚠️ cambió 29/10 (A-FEAT-1422 nota 16) — hasta acá era el PROMEDIO DEL MES de cierre. JMS: «que sea al 30/6
       * y no como promedio del mes; al 30/6 o último precio publicado». Cada fuente se busca hacia atrás desde el cierre
       * hasta el primer día que publicó con precio; la fecha usada y el link quedan en el papel.
       */
      const fc = ejercicio.fechaCierre
      const conPrecioMag = (xs: PrecioMag[]) => xs.some(x => x.promedio > 0 || x.maximo > 0)
      const conPrecioKg = (xs: PrecioMercado[]) => xs.some(x => (x.kiloMax || x.promKilo) > 0)
      const conPrecioCab = (xs: PrecioCabeza[]) => xs.some(x => x.cantidad > 0 && x.promedio > 0)
      const [rMag, rHem, rMac, rVie, rTor, pizSoja] = await Promise.all([
        ultimoPublicado(fc, d => pedir<PrecioMag>(`/api/precios-mag?desde=${d}&hasta=${d}`), conPrecioMag),
        ultimoPublicado(fc, d => pedir<PrecioMercado>(`/api/precios-mercado?desde=${d}&hasta=${d}&sexo=hembra`), conPrecioKg),
        ultimoPublicado(fc, d => pedir<PrecioMercado>(`/api/precios-mercado?desde=${d}&hasta=${d}&sexo=macho`), conPrecioKg),
        ultimoPublicado(fc, d => pedir<PrecioCabeza>(`/api/precios-por-cabeza?tipo=vientres&desde=${d}&hasta=${d}`), conPrecioCab),
        ultimoPublicado(fc, d => pedir<PrecioCabeza>(`/api/precios-por-cabeza?tipo=toros&desde=${d}&hasta=${d}`), conPrecioCab),
        pizarraAlCierre(supabase, "soja", fc),
      ])
      const [mag, hembras, machos, vientres, toros] = [rMag.filas, rHem.filas, rMac.filas, rVie.filas, rTor.filas]
      const fuentesPrecios: FuentePrecio[] = [
        { nombre: "Cañuelas (MAG)", fecha: rMag.fecha, url: URL_FUENTES.canuelas },
        { nombre: "Entresurcos terneras", fecha: rHem.fecha, url: URL_FUENTES.terneras },
        { nombre: "Entresurcos terneros", fecha: rMac.fecha, url: URL_FUENTES.terneros },
        { nombre: "Entresurcos vientres", fecha: rVie.fecha, url: URL_FUENTES.vientres },
        { nombre: "Entresurcos toros", fecha: rTor.fecha, url: URL_FUENTES.toros },
      ]
      const etiqueta = leyendaPrecios(fc, fuentesPrecios)
      // 🎚️ Granos: la pizarra de Rosario al cierre es el default; el precio escrito a mano manda.
      const precioGranos = tn(granos.precio) ?? pizSoja?.valor ?? null
      const mercado = { macho: machos, hembra: hembras }
      const porCabeza = { vientres, toros }

      const ganConfig: Record<string, number> = {}
      for (const l of (lotesGan ?? []) as Array<Record<string, unknown>>) {
        const cat = String(l.categoria ?? "")
        const g = Number(l.ganancia_diaria_kg ?? 0)
        // Si hay varios lotes de la misma categoría se toma el mayor: es el que más se aleja de
        // la medida, o sea el que hace más visible la diferencia si la hay.
        if (cat && g > 0) ganConfig[cat] = Math.max(ganConfig[cat] ?? 0, g)
      }
      const pesos = pesosAlCierre(
        (pes ?? []).map((p: Record<string, unknown>) => ({
          categoria: String(
            ((p.ternero as { categoria?: { nombre?: string } } | null)?.categoria?.nombre) ?? "",
          ),
          animalId: String(p.ternero_id ?? ""),
          fecha: String(p.fecha ?? "").slice(0, 10),
          pesoKg: Number(p.peso_kg ?? 0),
        })).filter(p => p.categoria && p.pesoKg > 0),
        ganConfig,
        ejercicio.fechaCierre,
      )

      const numericos: Record<string, number> = {}
      for (const [k, v] of Object.entries(manuales)) {
        const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."))
        if (Number.isFinite(n) && n > 0) numericos[k] = n
      }

      const sementeras = armarSementeras(
        (ord ?? []).map((o: Record<string, unknown>) => ({
          id: String(o.id), fecha: o.fecha ? String(o.fecha).slice(0, 10) : null,
          lote: String(o.lote_nombre ?? ""), hectareas: Number(o.hectareas ?? 0),
          estado: String(o.estado ?? ""),
          lineas: ((o.lineas ?? []) as Array<Record<string, unknown>>).map(l => ({
            insumo: String(l.insumo_nombre ?? ""),
            cantidad: l.cantidad_total_l == null ? null : Number(l.cantidad_total_l),
            unidad: String(l.unidad_dosis ?? ""),
            // Los insumos no tienen precio cargado: por eso cada línea nace como hueco.
            precioUnitario: null,
          })),
        })),
        ejercicio.fechaCierre,
      )
      const ventasGranosTn = Math.round(
        (vg ?? []).reduce((s, x: Record<string, unknown>) => s + Number(x.toneladas ?? 0), 0) * 1000,
      ) / 1000

      const d: DatosHacienda = {
        existencias, mag, mercado, porCabeza,
        valuacion: valuarHacienda(existencias, mag, mercado, numericos, pesos, porCabeza),
        /**
         * 🧮 El cuadre de la existencia (pedido del usuario 2026-09-29). El primer día del ejercicio
         * es el del primer subdiario: el cierre menos 11 meses.
         */
        cuadre: cuadrarHacienda(
          movimientos,
          primerDiaDelEjercicio(ejercicio),
          ejercicio.fechaCierre,
          existencias.reduce((s, e) => s + e.cabezas, 0),
        ),
        stockInicio: { renglones: si.renglones, pasturas: si.pasturas, fecha: diaAnterior(primerDiaDelEjercicio(ejercicio)) },
        sistema: {
          inicio: sistemaAlMomento(movimientos, "inicio", primerDiaDelEjercicio(ejercicio), ejercicio.fechaCierre),
          cierre: sistemaAlMomento(movimientos, "cierre", primerDiaDelEjercicio(ejercicio), ejercicio.fechaCierre),
        },
        pesos,
        mesPrecios: etiqueta,
        fuentesPrecios, pizarraSoja: pizSoja,
        insumos: {
          ...armarStockInsumos(existencia.lineas, numericos),
          alCierre: { fecha: ejercicio.fechaCierre, posteriores: existencia.posteriores, descuadres: existencia.descuadres },
        },
        ventasGranosTn, sementeras,
        campo: {
          granos: {
            ...cuadrarGranos({
              stockInicioTn: tn(granos.inicio), cosechaTn: tn(granos.cosecha),
              ventasTn: ventasGranosTn, stockEmpresaTn: tn(granos.cierre),
            }),
            // 🤖 A-FEAT-1386: el stock al inicio que puso Claude sale TENTATIVO en el Excel hasta el OK
            notaInicio: leyendaTentativo(cuadre.tentativos.inicio) || undefined,
          },
          valuacionGranos: valuarGranos(tn(granos.cierre) ?? 0, precioGranos),
          origenPrecioGranos: tn(granos.precio) != null
            ? { texto: "precio escrito a mano en la pantalla del balance", url: null }
            : pizSoja ? { texto: `pizarra Rosario soja del ${pizSoja.fecha.split("-").reverse().join("/")}`, url: pizSoja.url } : null,
          sementeras,
        },
      }
      setDatos(d)
      onDatos(d)
    } catch (e) {
      toast.error("No se pudo armar la hacienda: " + (e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  const v = datos?.valuacion

  const saldos = useMemo<SaldosParaExcel | null>(() => {
    if (!datos) return null
    const sisProd = sistemaProductivoAlCierre(datos.insumos.grupos, datos.sementeras.costo)
    const tent = Object.values(saldosH.tentativos)
    return {
      hacienda: {
        inicio: armarTresSaldos("inicio", datos.sistema.inicio, saldosH.valores),
        cierre: armarTresSaldos("cierre", datos.sistema.cierre, saldosH.valores),
        leyenda: tent.length ? leyendaTentativo(tent[0]) : undefined,
      },
      productivos: {
        inicio: armarSaldosProductivos(null, fotos.fotos[fechaFotoInicio] ?? null),
        cierre: armarSaldosProductivos(sisProd, fotos.fotos[ejercicio.fechaCierre] ?? null),
        fechaInicio: fechaFotoInicio, fechaCierre: ejercicio.fechaCierre,
      },
    }
  }, [datos, saldosH.valores, saldosH.tentativos, fotos, fechaFotoInicio, ejercicio.fechaCierre])

  // Lo que se ve es lo que va al Excel: cada cambio en los saldos viaja al papel.
  useEffect(() => {
    if (datos && saldos) onDatos({ ...datos, saldos })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saldos])

  const cuadreGranos: CuadreGranos = cuadrarGranos({
    stockInicioTn: tn(granos.inicio),
    cosechaTn: tn(granos.cosecha),
    ventasTn: datos?.ventasGranosTn ?? 0,
    stockEmpresaTn: tn(granos.cierre),
  })

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">🐄 Hacienda al cierre</span>
        <Button size="sm" variant="outline" onClick={traer} disabled={cargando}>
          {cargando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {datos ? "Recalcular" : "Traer stock y precios"}
        </Button>
        {datos && (
          <span className="text-xs text-muted-foreground">
            Precios: <strong>{datos.mesPrecios}</strong> · Cañuelas {datos.mag.length} · terneras {datos.mercado.hembra.length} · terneros {datos.mercado.macho.length} · vientres {datos.porCabeza.vientres.length} · toros {datos.porCabeza.toros.length}
          </span>
        )}
      </div>
      {/* A-FEAT-1388 — usuario 27/10: «dice sin el sector productivo, y no apreté traer precios pero sí
          los cargó de la vez pasada». Los precios a mano se guardan y vuelven solos; el STOCK no. */}
      {!datos && !cargando && Object.values(manuales).some(x => String(x ?? "").trim()) && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
          Tus precios a mano ({Object.values(manuales).filter(x => String(x ?? "").trim()).length}) ya están guardados,
          pero <strong>el stock de hacienda e insumos todavía no se trajo</strong>: hasta que aprietes
          «Traer stock y precios», el Excel sale sin el sector productivo.
        </p>
      )}

      {datos && <TresSaldosHacienda datos={saldosH} sistema={datos.sistema} />}
      {datos?.stockInicio && <StockInicioDetalle {...datos.stockInicio} />}
      {saldos?.productivos && (
        <SaldosProductivos tablas={saldos.productivos}
          fechas={{ inicio: fechaFotoInicio, cierre: ejercicio.fechaCierre }}
          hayFoto={{ inicio: !!fotos.fotos[fechaFotoInicio], cierre: !!fotos.fotos[ejercicio.fechaCierre] }}
          error={fotos.error} />
      )}

      {v && (
        <>
          <div className="text-sm">
            <strong>{ent(v.cabezas)}</strong> cabezas al {ejercicio.fechaCierre} ·
            valuado <strong>${fmt(v.valuado)}</strong>
            {v.cabezasSinValuar > 0 && (
              <span className="text-amber-700"> · faltan valuar {ent(v.cabezasSinValuar)} cabezas</span>
            )}
          </div>

          {v.huecos.length > 0 && (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded px-3 py-2 space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                {v.huecos.length} categoría(s) sin precio — cargalo y se valúan solas
              </div>
              <p className="text-xs">
                No se valúan en cero: el total de arriba <strong>no las incluye</strong>.
              </p>
            </div>
          )}

          <div className="overflow-x-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-1.5">Categoría</th>
                  <th className="text-right p-1.5">Cabezas</th>
                  <th className="text-left p-1.5">Criterio (tuyo)</th>
                  <th className="text-left p-1.5">Precio de referencia</th>
                  <th className="text-right p-1.5">$/cabeza</th>
                  <th className="text-right p-1.5">Total</th>
                  <th className="text-left p-1.5">Precio a mano</th>
                </tr>
              </thead>
              <tbody>
                {v.filas.map(f => (
                  <tr key={f.categoria} className={f.esHueco ? "bg-amber-50" : ""}>
                    <td className="p-1.5 font-medium">{f.categoria}</td>
                    <td className="p-1.5 text-right font-mono">{ent(f.cabezas)}</td>
                    <td className="p-1.5 text-muted-foreground">{f.criterio}</td>
                    <td className="p-1.5 text-muted-foreground">
                      {f.precioReferencia != null ? `$${fmt(f.precioReferencia)} · ` : ""}{f.origenPrecio}
                    </td>
                    <td className="p-1.5 text-right font-mono">{f.valorPorCabeza != null ? fmt(f.valorPorCabeza) : "—"}</td>
                    <td className="p-1.5 text-right font-mono">{f.valorTotal != null ? fmt(f.valorTotal) : "—"}</td>
                    <td className="p-1.5">
                      {/* § 💰 es-AR: texto, nunca `number`. Vacío = usá el mercado. */}
                      <Input
                        type="text" placeholder="0,00" className="h-6 text-xs w-28"
                        value={manuales[f.categoria] ?? ""}
                        onChange={e => precios.cambiar(f.categoria, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Cargá un precio y apretá <strong>Recalcular</strong>. El que ponés a mano manda sobre el
            del mercado · <span className={precios.estado === "sin tabla" || precios.estado === "error" ? "text-amber-700" : ""}>{textoEstadoGuardado(precios.estado, precios.error)}</span>{v.sinCriterio.length > 0 && (
              <> · ⚠️ sin criterio definido: <strong>{v.sinCriterio.join(", ")}</strong></>
            )}
          </p>

          {/* ⚖️ De dónde salió cada kilo, y el aviso si la ganancia cargada no coincide. */}
          {datos && datos.pesos.length > 0 && (
            <div className="border-t pt-3 space-y-1 text-xs" data-test="pesos">
              <div className="text-sm font-medium">⚖️ Los kilos, de las pesadas</div>
              {datos.pesos.map(p => (
                <div key={p.categoria}>
                  <strong>{p.categoria}</strong>: {p.pesoProyectado} kg — {p.origen}
                  {p.difiereDeLaConfigurada && (
                    <span className="text-amber-700">
                      {" "}⚠️ medida {p.gananciaMedida} vs cargada {p.gananciaConfigurada} kg/día
                    </span>
                  )}
                </div>
              ))}
              {datos.pesos.some(p => p.difiereDeLaConfigurada) && (
                <p className="text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                  Se usa la <strong>medida</strong> porque es el dato real. La diferencia con la
                  cargada se muestra para que decidas, no se elige en silencio.
                </p>
              )}
            </div>
          )}

          {/* 🧪 Los stocks de insumos: misma lógica de huecos que la hacienda. */}
          {datos && (
            <div className="border-t pt-3 space-y-2" data-test="stock-insumos">
              <div className="text-sm font-medium">🧪 Stock de insumos</div>
              <div className="text-sm">
                <strong>{ent(datos.insumos.productos)}</strong> productos con existencia ·
                valuado <strong>${fmt(datos.insumos.valuado)}</strong>
                {datos.insumos.huecos.length > 0 && (
                  <span className="text-amber-700"> · <strong>{datos.insumos.huecos.length}</strong> sin precio</span>
                )}
              </div>

              {datos.insumos.alCierre && (
                <div className="text-xs text-muted-foreground" data-test="insumos-al-cierre">
                  📅 Existencia al <strong>{datos.insumos.alCierre.fecha.split("-").reverse().join("/")}</strong>, armada con los
                  movimientos hasta esa fecha{datos.insumos.alCierre.posteriores > 0
                    ? ` (se descontaron ${datos.insumos.alCierre.posteriores} movimiento(s) posteriores)` : ""}.
                  {datos.insumos.alCierre.descuadres.length === 0 && <span className="text-green-700"> ✓ Cada producto: existencia de hoy = suma de sus movimientos.</span>}
                </div>
              )}
              {datos.insumos.alCierre && datos.insumos.alCierre.descuadres.length > 0 && (
                <div className="text-xs text-red-900 bg-red-50 border border-red-300 rounded px-2 py-1.5" data-test="insumos-descuadres">
                  <strong>⚠️ {datos.insumos.alCierre.descuadres.length} producto(s) con una existencia de hoy que no es la suma de sus movimientos</strong>
                  {" "}— se cargó o se tocó por fuera de compras y usos. Al cierre se toma la de los movimientos:
                  <ul className="list-disc pl-5">
                    {datos.insumos.alCierre.descuadres.map(d => (
                      <li key={d.producto}>{d.producto}: hoy {fmt(d.hoy)} {d.unidad} · movimientos {fmt(d.sumaMovimientos)} {d.unidad}</li>
                    ))}
                  </ul>
                </div>
              )}

              {datos.insumos.grupos.map(g => (
                <div key={g.ambito} className="text-xs">
                  <div className="font-medium">{g.papel}</div>
                  <div className="text-muted-foreground">
                    {g.filas.length} producto(s) · valuado ${fmt(g.valuado)}
                    {g.huecos > 0 && <span className="text-amber-700"> · {g.huecos} sin precio, no incluidos</span>}
                  </div>
                </div>
              ))}

              {datos.insumos.huecos.length > 0 && (
                <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
                  <strong>{datos.insumos.huecos.length} productos están contados pero sin precio.</strong>{" "}
                  El inventario existe; la valuación no. El total de arriba no los incluye.
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <div className="font-medium">🕳️ Lo que todavía le falta a cada papel:</div>
                <ul className="list-disc pl-5">
                  {PAPELES_SIN_ORIGEN.map(p => (
                    <li key={p.papel}><strong>{p.papel}</strong> — {p.falta}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 🌾 Granos: el cuadre de kilos. La app sabe las ventas; las otras dos las cargás vos. */}
          {datos && (
            <div className="border-t pt-3 space-y-2" data-test="granos">
              <div className="text-sm font-medium">🌾 Granos — cuadre de kilos (toneladas){" "}
                <span className={`text-xs font-normal ${cuadre.estado === "sin tabla" || cuadre.estado === "error" ? "text-amber-700" : "text-muted-foreground"}`}>· {textoEstadoGuardado(cuadre.estado, cuadre.error)}</span>
              </div>
              <div className="flex flex-wrap items-end gap-2 text-xs">
                <label className="block">
                  <span className="block text-muted-foreground">Stock al inicio</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.inicio} onChange={e => cuadre.cambiar("inicio", e.target.value)} />
                  <MarcaTentativo fuente={cuadre.tentativos.inicio} onOk={() => cuadre.confirmar("inicio")} />
                </label>
                <label className="block">
                  <span className="block text-muted-foreground">Cosecha</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.cosecha} onChange={e => cuadre.cambiar("cosecha", e.target.value)} />
                </label>
                <div>
                  <span className="block text-muted-foreground">Ventas (de la app)</span>
                  <span className="font-mono">{fmt(datos.ventasGranosTn)}</span>
                </div>
                <label className="block">
                  <span className="block text-muted-foreground">Existencia al cierre</span>
                  <Input type="text" placeholder="0,00" className="h-6 w-24 text-xs"
                    value={granos.cierre} onChange={e => cuadre.cambiar("cierre", e.target.value)} />
                </label>
                <label className="block">
                  <span className="block text-muted-foreground">Precio por tonelada</span>
                  <Input type="text" className="h-6 w-28 text-xs"
                    value={granos.precio} onChange={e => cuadre.cambiar("precio", e.target.value)}
                    placeholder={datos?.pizarraSoja ? datos.pizarraSoja.valor.toLocaleString("es-AR") : "0,00"} />
                  {/* 🎚️ vacío = la pizarra de Rosario al cierre; escrito = manda el tuyo (A-FEAT-1422 nota 16) */}
                  {datos?.pizarraSoja && !String(granos.precio ?? "").trim() && (
                    <span className="block text-[11px] text-muted-foreground">
                      usa la <a className="underline" href={datos.pizarraSoja.url} target="_blank" rel="noreferrer">pizarra Rosario soja del {datos.pizarraSoja.fecha.split("-").reverse().join("/")}</a>
                    </span>
                  )}
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cargá lo que falte y apretá <strong>Recalcular</strong> para que entre al Excel.
                Vacío significa <strong>«no lo sé»</strong>, no cero — por eso el cuadre no se declara
                cerrado mientras falte algo.
              </p>
              {(() => {
                const c = cuadreGranos
                return (
                  <div className="text-xs">
                    Saldo: <strong className="font-mono">{c.saldoTn ?? "—"}</strong>
                    {c.diferenciaTn != null && (
                      <> · Diferencia: <strong className={`font-mono ${c.cierra ? "text-emerald-700" : "text-amber-700"}`}>
                        {c.diferenciaTn}
                      </strong> {c.cierra ? "✓ cierra" : "⚠️ no cierra — hay que explicarla"}</>
                    )}
                    {c.faltan.length > 0 && (
                      <div className="text-muted-foreground">Falta cargar: {c.faltan.join(" · ")}</div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* 🌱 Sementeras: lo ejecutado hasta el cierre. */}
          {datos && (
            <div className="border-t pt-3 space-y-1 text-xs" data-test="sementeras">
              <div className="text-sm font-medium">🌱 Sementeras</div>
              <div>
                <strong>{datos.sementeras.ordenesEjecutadas}</strong> orden(es) ejecutada(s) ·
                <strong> {datos.sementeras.hectareas}</strong> ha · costo{" "}
                <strong>${fmt(datos.sementeras.costo)}</strong>
              </div>
              <div className="text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                <strong>El costo está incompleto.</strong> Falta: {datos.sementeras.faltan.join(" · ")}
              </div>
              {datos.sementeras.ordenesNoContadas.length > 0 && (
                <div className="text-muted-foreground">
                  {datos.sementeras.ordenesNoContadas.length} orden(es) no se contaron:{" "}
                  {[...new Set(datos.sementeras.ordenesNoContadas.map(o => o.motivo))].join(" · ")}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!datos && !cargando && (
        <p className="text-xs text-muted-foreground">
          Trae la existencia al cierre y los precios al cierre (o el último publicado), y aplica tus {CRITERIOS.length} criterios
          de valuación. No modifica nada.
        </p>
      )}
    </div>
  )
}
