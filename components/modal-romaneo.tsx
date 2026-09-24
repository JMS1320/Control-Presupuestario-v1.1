"use client"

/**
 * 📄 Cargar el ROMANEO de una carga — A-FEAT-94.
 *
 * ## Qué hace
 * Subís el PDF del frigorífico y la pantalla te muestra **cómo queda frente a los datos de la app**,
 * con todo editable, antes de tocar nada. Vos le das OK a lo que leyó, o lo corregís.
 *
 * ## Las tres cosas que la hacen confiable
 *
 * **1 · El romaneo se controla contra sí mismo.** Trae sus propios totales impresos (cabezas, kilos
 * vivos, kilos gancho, rinde, total), así que lo sumado de las filas se compara contra lo que dice
 * el papel. Si no coinciden, se ve en rojo con los dos números.
 *
 * **2 · Nunca frena.** Aunque un control no cierre, los datos igual se proponen y se pueden editar.
 * *(Criterio del usuario: «si siempre toma los datos y me los propone y yo puedo editar, siempre
 * resultará ante fallas».)* Un importador que se planta deja sin herramienta justo el día que el
 * frigorífico cambia el formato.
 *
 * **3 · No pisa en silencio.** Antes de guardar se lista **qué valor de la venta va a cambiar y por
 * cuál**, con el valor viejo a la vista.
 *
 * Diseño y hallazgos del romaneo real → `MODULO_HACIENDA.md` § 19.
 */

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { parsearRomaneo, type RomaneoParseado, type RomaneoLinea } from "@/lib/ganaderia/parsear-romaneo"
import { anotarResultado } from "@/lib/cinta-diagnostico"
import { adjudicarPorPeso, cabezasDeMedias, rindePorGrupo, factorDeCarga, type CabezaNuestra } from "@/lib/ganaderia/adjudicar-romaneo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface VentaDeLaCarga {
  id: string
  cantidad: number | null
  kg_totales: number | null
  kg_carne: number | null
  monto_neto: number | null
  precio_kg: number | null
  categoria_nombre?: string | null
}

const m = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const kg = (n: number | null | undefined) =>
  n == null ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`

interface CargaOpcion { id: string; fecha: string | null; cliente_nombre: string | null; peso_bruto: number | null; peso_tara: number | null }

export function ModalRomaneo({
  abierto, onCerrar, cargaId: cargaFija, onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  /** Si se abre desde una venta, la carga viene dada. Si no, se elige adentro. */
  cargaId?: string | null
  onGuardado?: () => void
}) {
  const [cargas, setCargas] = useState<CargaOpcion[]>([])
  const [cargaSel, setCargaSel] = useState<string>("")
  const cargaId = cargaFija ?? (cargaSel || null)
  const [leyendo, setLeyendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [rom, setRom] = useState<RomaneoParseado | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [ventas, setVentas] = useState<VentaDeLaCarga[]>([])
  /** tipo del romaneo (VA/TO) → id de la venta a la que se imputa. Propuesto, editable. */
  const [mapa, setMapa] = useState<Record<string, string>>({})
  const [cab, setCab] = useState<Record<string, string>>({})
  const [verDetalle, setVerDetalle] = useState(false)
  /** Nuestras cabezas pesadas, por id de venta. Son la otra punta de la adjudicación. */
  const [animales, setAnimales] = useState<Record<string, CabezaNuestra[]>>({})
  /** Neto del camión (bruto − tara): escala nuestros pesos para que el total cierre con él. */
  const [netoCamion, setNetoCamion] = useState<number | null>(null)
  /** Corrección a mano del kilo de res de un garrón — hace falta cuando el PDF perdió una media. */
  const [ganchoFix, setGanchoFix] = useState<Record<string, string>>({})
  /**
   * Correcciones sobre las LÍNEAS de liquidación, por `orden|campo`.
   *
   * Son las que alimentan la plata: de acá salen `kg_carne` e `importe` de cada venta. Que la
   * cabecera fuera editable y los importes no era exactamente al revés de lo que hace falta
   * (§ 📄 Importar un documento, condición 2).
   */
  const [lineaFix, setLineaFix] = useState<Record<string, string>>({})
  /** Las dos puntas del desbaste: cuándo pesamos nosotros y cuándo pesó el vivo el frigorífico. */
  const [horaCampo, setHoraCampo] = useState("")
  const [horaDestino, setHoraDestino] = useState("")
  const [kgDestino, setKgDestino] = useState("")
  const [pesoCampo, setPesoCampo] = useState<number | null>(null)

  const limpiar = () => { setRom(null); setArchivo(null); setMapa({}); setCab({}); setVerDetalle(false) }

  /**
   * Cerrar con un romaneo leído y sin confirmar **pregunta**. Leer y revisar un romaneo lleva
   * varios minutos, y perderlo por un click afuera es caro — pero lo caro de verdad es cerrar sin
   * saber si se guardó, que es lo que le pasó al usuario.
   */
  const cerrarConAviso = () => {
    if (rom && !window.confirm(
      "El romaneo está leído pero NO se guardó todavía.\n\n" +
      "Si cerrás se pierde y hay que volver a subir el PDF.\n\n¿Cerrar igual?"
    )) return
    limpiar()
    onCerrar()
  }

  const cargarCargas = async () => {
    if (cargas.length) return
    const { data } = await supabase.schema("productivo").from("cargas")
      .select("id, fecha, cliente_nombre, peso_bruto, peso_tara")
      .order("fecha", { ascending: false }).limit(50)
    setCargas((data ?? []) as CargaOpcion[])
  }

  const subir = async (f: File) => {
    setLeyendo(true)
    setArchivo(f)
    try {
      const r = await parsearRomaneo(await f.arrayBuffer())
      setRom(r)
      setCab({
        frigorifico: r.cabecera.frigorifico ?? "", matricula: r.cabecera.matricula ?? "",
        cuit_frigorifico: r.cabecera.cuit_frigorifico ?? "", vendedor: r.cabecera.vendedor ?? "",
        tropa: r.cabecera.tropa ?? "", fecha_faena: r.cabecera.fecha_faena ?? "",
        guia: r.cabecera.guia ?? "", dta: r.cabecera.dta ?? "",
      })

      // Las ventas de esta carga, para poder comparar contra lo que ya está cargado.
      let vs: VentaDeLaCarga[] = []
      if (cargaId) {
        const { data } = await supabase.schema("productivo").from("stock_ventas")
          .select("id, cantidad, kg_totales, kg_carne, monto_neto, precio_kg, categoria_id")
          .eq("carga_id", cargaId)
        vs = (data ?? []) as VentaDeLaCarga[]
        if (vs.length) {
          const ids = [...new Set(vs.map(v => (v as { categoria_id?: string }).categoria_id).filter(Boolean))]
          if (ids.length) {
            const { data: cats } = await supabase.schema("productivo").from("categorias_hacienda")
              .select("id, nombre").in("id", ids as string[])
            const porId = new Map((cats ?? []).map(c => [c.id as string, c.nombre as string]))
            vs = vs.map(v => ({ ...v, categoria_nombre: porId.get((v as { categoria_id?: string }).categoria_id ?? "") ?? null }))
          }
        }
        setVentas(vs)

        // La OTRA punta de la adjudicación: nuestras cabezas pesadas el día de la carga.
        // Sin esto el rinde por grupo no existe — sólo hay reparto proporcional, que es circular.
        const { data: cg } = await supabase.schema("productivo").from("cargas")
          .select("fecha, peso_bruto, peso_tara, pesada_campo_at, pesada_destino_at, kg_vivo_destino").eq("id", cargaId).maybeSingle()
        const c = (cg ?? {}) as { fecha?: string; peso_bruto?: number; peso_tara?: number; pesada_campo_at?: string; pesada_destino_at?: string; kg_vivo_destino?: number }
        setNetoCamion(c.peso_bruto != null && c.peso_tara != null ? c.peso_bruto - c.peso_tara : null)
        // 🐞 `toISOString()` devuelve UTC y un `datetime-local` lo muestra tal cual: las 12:00
        // del campo aparecían como 15:00. La hora es el insumo del desbaste por hora, así que
        // mostrarla corrida invita a "corregirla" y a romper el dato bueno.
        const iso = (v?: string) => {
          if (!v) return ""
          const d = new Date(v)
          const p2 = (n: number) => String(n).padStart(2, "0")
          return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`
        }
        setHoraCampo(iso(c.pesada_campo_at))
        setHoraDestino(iso(c.pesada_destino_at))
        setKgDestino(c.kg_vivo_destino != null ? String(c.kg_vivo_destino) : "")

        const porVenta: Record<string, CabezaNuestra[]> = {}
        for (const v of vs) {
          const catId = (v as { categoria_id?: string }).categoria_id
          if (!catId || !c.fecha) continue
          const { data: pes } = await supabase.schema("productivo").from("pesadas_terneros")
            .select("id, peso_kg, ternero_id, terneros!inner(caravana_oficial, observaciones, categoria_id)")
            .eq("fecha", c.fecha).eq("terneros.categoria_id", catId)
          porVenta[v.id] = ((pes ?? []) as unknown as Array<{ id: string; peso_kg: number; terneros: { caravana_oficial: string | null; observaciones: string | null } }>)
            .map(x => ({ id: x.id, peso_kg: Number(x.peso_kg) || 0,
              caravana: x.terneros?.caravana_oficial ?? null, razon: x.terneros?.observaciones ?? null }))
        }
        setAnimales(porVenta)
        setPesoCampo(Object.values(porVenta).flat().reduce((a, x) => a + x.peso_kg, 0) || null)
      }

      // Propuesta de imputación: se casa cada tipo del romaneo con la venta que tenga la MISMA
      // cantidad de cabezas. Es una propuesta — si hay dudas queda vacío y lo elige el usuario.
      const prop: Record<string, string> = {}
      for (const t of tiposDe(r)) {
        const cabezas = r.lineas.filter(l => l.tipo === t).reduce((s, l) => s + l.cabezas, 0)
        const cand = vs.filter(v => Number(v.cantidad) === cabezas)
        if (cand.length === 1) prop[t] = cand[0].id
      }
      setMapa(prop)
      // 📣 Que la cinta sepa cómo terminó, aunque no haya fallado nada. Este parser devolvió
      // cero sin tirar un error y la nota llegó sin una sola pista útil (A-BUG-111/113).
      anotarResultado("romaneo",
        `${r.lineas.length} línea(s) · ${r.medias.length} media(s) · ${r.paginas} pág · `
        + `${r.kilos_gancho} kg gancho · total ${r.total}`
        + (r.avisos.length ? ` · avisos: ${r.avisos.join(" | ")}` : ""))

      if (r.avisos.length) toast.warning(`Leído con ${r.avisos.length} aviso(s) — revisá antes de confirmar`)
      else toast.success("Romaneo leído")
    } catch (e) {
      toast.error("No se pudo leer el PDF: " + (e as Error).message)
      setRom(null)
    } finally { setLeyendo(false) }
  }

  const tiposDe = (r: RomaneoParseado) => [...new Set(r.lineas.map(l => l.tipo))]

  /**
   * Las líneas **como quedan**: lo que leyó el parser, con lo que corrigió el usuario encima.
   *
   * 🔑 **El importe se recalcula solo** al tocar kg o precio. Corregir no puede obligar a rehacer
   * la cuenta: si el usuario tiene que arreglar el dato *y además* la suma, el importador no le
   * ahorró nada (§ 📄 Importar un documento, condición 3).
   */
  const lineasEfectivas = (): RomaneoLinea[] => (rom?.lineas ?? []).map(l => {
    const leer = (campo: string) => {
      const v = (lineaFix[`${l.orden}|${campo}`] ?? "").trim()
      if (!v) return null
      const n = parseFloat(v.replace(/\./g, "").replace(",", "."))
      return isNaN(n) ? null : n
    }
    const kgf = leer("kg_faena") ?? l.kg_faena
    const pk = leer("precio_kg") ?? l.precio_kg
    const impManual = leer("importe")
    return {
      ...l,
      cabezas: leer("cabezas") ?? l.cabezas,
      kg_faena: kgf,
      precio_kg: pk,
      // El importe escrito a mano manda; si no, sale de kg × precio.
      importe: impManual ?? (pk != null ? Math.round(kgf * pk * 100) / 100 : l.importe),
    }
  })

  /** El romaneo con las líneas corregidas — es lo que ve todo lo de abajo y lo que se guarda. */
  const romEfectivo = (): RomaneoParseado | null => {
    if (!rom) return null
    const lineas = lineasEfectivas()
    const kilos_gancho = lineas.reduce((s2, l) => s2 + l.kg_faena, 0)
    const kilos_vivos = lineas.reduce((s2, l) => s2 + l.kg_vivo, 0)
    const total = lineas.reduce((s2, l) => s2 + l.importe, 0)
    const cabezas = lineas.reduce((s2, l) => s2 + l.cabezas, 0)
    return {
      ...rom, lineas, kilos_gancho, kilos_vivos, total, cabezas,
      rinde: kilos_vivos > 0 ? Math.round((kilos_gancho / kilos_vivos) * 10000) / 100 : null,
      // Los controles se rehacen contra lo IMPRESO: así se ve si la corrección acercó o alejó.
      controles: rom.controles.map(c => {
        const nuevo = c.nombre.startsWith("Kilos gancho (líneas") ? kilos_gancho
          : c.nombre.startsWith("Kilos vivos") ? kilos_vivos
            : c.nombre.startsWith("Total") ? total
              : c.nombre.startsWith("Cabezas") ? cabezas
                : c.nombre.startsWith("Rinde") ? (kilos_vivos > 0 ? Math.round((kilos_gancho / kilos_vivos) * 10000) / 100 : 0)
                  : c.calculado
        // ⚠️ Los que se cuentan de a uno van con tolerancia CERO. Con la tolerancia de $1 que usan
        // los kilos, «19 medias de 20» cerraba: justo el caso que este control existe para agarrar.
        const deAUno = c.nombre.startsWith("Cabezas") || c.nombre.startsWith("Medias reses")
        const tol = c.nombre.startsWith("Rinde") ? 0.05 : deAUno ? 0 : 1
        let cierra = c.impreso != null && Math.abs(nuevo - c.impreso) <= tol
        // Una media que el PDF no trajo **se completa a mano**, y ahí el control queda saldado: el
        // dato existe, lo puso el usuario, y la huella guarda que vino de él y no del papel.
        if (!cierra && c.nombre.startsWith("Medias reses")) {
          const faltan = cabezasRomaneo().filter(x => x.medias !== 2)
          if (faltan.length > 0 && faltan.every(x => (ganchoFix[x.garron] ?? "").trim() !== "")) cierra = true
        }
        return { ...c, calculado: nuevo, cierra }
      }),
    }
  }

  /** 🐾 La HUELLA: lo que leyó el parser junto a lo que puso el usuario (§ 📄, condición 4). */
  const huella = () => {
    const h: { campo: string; referencia: string; leido: unknown; corregido: unknown }[] = []
    for (const [k, v] of Object.entries(cab)) {
      const orig = (rom?.cabecera as unknown as Record<string, unknown>)?.[k]
      if (v.trim() !== String(orig ?? "").trim()) h.push({ campo: k, referencia: "cabecera", leido: orig ?? null, corregido: v })
    }
    for (const [k, v] of Object.entries(ganchoFix)) {
      if (!v.trim()) continue
      const c = cabezasDeMedias(rom?.medias ?? []).find(x => x.garron === k)
      h.push({ campo: "kg_gancho", referencia: `garrón ${k}`, leido: c?.kg_gancho ?? null, corregido: v })
    }
    for (const [k, v] of Object.entries(lineaFix)) {
      if (!v.trim()) continue
      const [orden, campo] = k.split("|")
      const l = rom?.lineas.find(x => String(x.orden) === orden)
      h.push({ campo, referencia: `línea ${l ? `${l.tipo} ${l.clase}` : orden}`, leido: (l as unknown as Record<string, unknown>)?.[campo] ?? null, corregido: v })
    }
    return h
  }

  /**
   * Las CABEZAS del romaneo: dos medias reses por animal, sumadas por garrón.
   * El kilo de res se puede corregir a mano — hace falta cuando el PDF perdió una media.
   */
  const cabezasRomaneo = () => {
    const cs = cabezasDeMedias(rom!.medias)
    return cs.map(c => {
      const fix = (ganchoFix[c.garron] ?? "").trim()
      if (!fix) return c
      const kg = parseFloat(fix.replace(/\./g, "").replace(",", "."))
      if (isNaN(kg)) return c
      // 🔑 Corregir el kilo **vuelve a resolver el precio**. El parser no pudo decidirlo cuando el
      // garrón venía a la mitad —para `VA C` hay dos líneas, a $5.800 y a $6.600— y con el peso
      // completo la línea de una cabeza queda identificada sin ambigüedad. Sin esto la corrección
      // arregla el kilaje y deja la cabeza en un grupo «$0», que es peor que antes (A-BUG-118).
      const l = rom!.lineas.find(x => x.tipo === c.tipo && x.clase === c.clase
        && x.contenido === c.contenido && x.cabezas === 1 && Math.abs(x.kg_faena - kg) <= 1)
      return { ...c, kg_gancho: kg, precio_kg: l ? l.precio_kg : c.precio_kg }
    })
  }

  /**
   * 🔑 **La adjudicación cabeza por cabeza** — A-FEAT-97, método del usuario.
   *
   * Se aparean **por orden de peso**: al más pesado nuestro, la res más pesada. Y nuestros pesos se
   * escalan antes por `neto del camión ÷ suma nuestra`, que es *«el peso real que tomamos»*.
   *
   * ⚠️ **Esto reemplaza al reparto proporcional que yo había puesto**, que era circular: repartir el
   * vivo en proporción al kilo de carne hace que `kg_carne / vivo` se simplifique y devuelva el mismo
   * rinde para todos los grupos — el mismo defecto que tiene la columna *Vivo* del romaneo.
   */
  const adjudicacionesDe = (tipo: string) => {
    const ventaId = mapa[tipo]
    const nuestras = ventaId ? (animales[ventaId] ?? []) : []
    const delRom = cabezasRomaneo().filter(c => c.tipo === tipo)
    // 🔑 El factor sale de TODOS los animales del viaje, no sólo de los de este tipo: el camión
    // pesó el conjunto. Calculado por tipo, cada grupo se escalaba al camión entero y la carga
    // entraba dos veces — los 3 toros daban 6.501 kg vivos (A-BUG-114).
    const factor = factorDeCarga(Object.values(animales).flat(), netoCamion)
    return adjudicarPorPeso(nuestras, delRom, factor)
  }

  const todasLasAdjudicaciones = () => tiposDe(rom!).flatMap(t => adjudicacionesDe(t).pares)

  /** Lo que va a cada venta: sale de la LIQUIDACIÓN, que es lo que factura el frigorífico. */
  const resumenPorTipo = (t: string) => {
    const ls = rom!.lineas.filter(l => l.tipo === t)
    return {
      cabezas: ls.reduce((s, l) => s + l.cabezas, 0),
      kg_carne: ls.reduce((s, l) => s + l.kg_faena, 0),
      kg_vivo: ls.reduce((s, l) => s + l.kg_vivo, 0),
      importe: ls.reduce((s, l) => s + l.importe, 0),
    }
  }

  const guardar = async () => {
    if (!rom) return
    // 🧮 Un garrón con una sola media res tiene el kilo de res a la mitad, y eso **corre el apareo
    // por peso**: el rinde de TODOS los grupos queda mal, no sólo el de esa cabeza. Se avisa acá
    // porque hasta ahora se podía guardar sin que nada lo dijera, y los números salían mal en
    // silencio (A-BUG-116).
    const incompletos = cabezasRomaneo().filter(c => c.medias !== 2)
    if (incompletos.length && !window.confirm(
      `⚠️ ${incompletos.length} garrón(es) tienen una sola media res: ${incompletos.map(c => c.garron).join(", ")}.

` +
      `Su kilo de res está a la mitad, así que el apareo por peso queda corrido y **los rindes de todos los grupos van a salir mal**.

` +
      `Lo recomendable es cerrar, corregirlos a mano y volver.

¿Guardar igual?`
    )) return
    setGuardando(true)
    try {
      const prod = supabase.schema("productivo")
      // Se guarda el romaneo YA CORREGIDO: si el usuario arregló una línea, lo que va a la base y a
      // las ventas es lo arreglado. Lo que leyó el parser no se pierde — queda en `correcciones`.
      const romG = romEfectivo()!
      const { data: cabR, error: e1 } = await prod.from("romaneos").insert({
        carga_id: cargaId,
        frigorifico: cab.frigorifico || null, matricula: cab.matricula || null,
        cuit_frigorifico: cab.cuit_frigorifico || null, vendedor: cab.vendedor || null,
        consignatario: rom.cabecera.consignatario, origen_estab: rom.cabecera.origen_estab,
        tropa: cab.tropa || null, fecha_faena: cab.fecha_faena || null,
        guia: cab.guia || null, dta: cab.dta || null,
        cabezas_faenadas: romG.cabezas,
        kilos_vivos: romG.kilos_vivos, kilos_gancho: romG.kilos_gancho,
        rinde: romG.rinde, total_liquidado: romG.total,
        archivo_nombre: archivo?.name ?? null,
        origen: "pdf",
        // Los controles TAL COMO SALIERON del papel, aunque el usuario haya corregido: después hay
        // que poder distinguir qué venía mal del PDF de qué puso él. La corrección va aparte, abajo.
        controles: rom.controles,
        // 🐾 La huella: lo leído junto a lo corregido, para poder auditar dónde falla el parser.
        correcciones: huella(),
        observaciones: rom.avisos.length ? rom.avisos.join(" · ") : null,
      }).select("id").single()
      if (e1) throw e1
      const romaneoId = (cabR as { id: string }).id

      if (rom.medias.length) {
        const { error } = await prod.from("romaneo_medias").insert(rom.medias.map(x => ({
          romaneo_id: romaneoId, garron: x.garron, tipo: x.tipo, clase: x.clase,
          dientes: x.dientes, contenido: x.contenido, peso_kg: x.peso_kg,
          precio_kg: x.precio_kg, orden: x.orden,
        })))
        if (error) throw error
      }
      if (romG.lineas.length) {
        // El vivo NUESTRO sale de las cabezas ADJUDICADAS (A-FEAT-97), no de un reparto
        // proporcional: repartir en proporción al kilo de carne se simplifica algebraicamente y
        // devuelve el rinde global para todos los grupos — el mismo defecto de la columna del papel.
        const porGrupo = new Map(rindePorGrupo(todasLasAdjudicaciones()).map(g => [`${g.tipo}|${g.precio}`, g]))
        const { error } = await prod.from("romaneo_lineas").insert(romG.lineas.map(x => {
          const g = porGrupo.get(`${x.tipo}|${x.precio_kg ?? 0}`)
          // 🐞 **El denominador sale de las MISMAS líneas que el numerador** (A-BUG-116). Antes se
          // repartía `g.kg_vivo × (kg_faena / g.kg_gancho)`, donde `kg_gancho` venía de las CABEZAS
          // (que salen de las medias reses, y el PDF pierde algunas) mientras `kg_faena` venía de la
          // LIQUIDACIÓN (completa). Con las dos fuentes mezcladas la suma del grupo se pasaba: en el
          // grupo VA $6.600 el denominador era 302 y el numerador 607 — **el doble**.
          const faenaDelGrupo = romG.lineas
            .filter(y => y.tipo === x.tipo && (y.precio_kg ?? 0) === (x.precio_kg ?? 0))
            .reduce((sum, y) => sum + y.kg_faena, 0)
          const parte = g && faenaDelGrupo > 0
            ? Math.round(g.kg_vivo * (x.kg_faena / faenaDelGrupo)) : null
          return {
            romaneo_id: romaneoId, cabezas: x.cabezas, tipo: x.tipo, clase: x.clase,
            dientes: x.dientes, contenido: x.contenido, kg_faena: x.kg_faena,
            // Se conservan LOS DOS: el que asigna el frigorífico (no es una pesada) y el nuestro.
            kg_vivo: x.kg_vivo,
            kg_vivo_real: parte,
            kg_vivo_real_origen: parte != null ? "animales" : null,
            precio_kg: x.precio_kg, motivo: x.motivo, importe: x.importe,
            stock_venta_id: mapa[x.tipo] || null, orden: x.orden,
          }
        }))
        if (error) throw error
      }

      // Completar las ventas imputadas: el kilaje de carne es justo lo que faltaba para que el
      // importe se pueda calcular cuando el destino compra A LA RES (MODULO_HACIENDA § 18.3).
      let tocadas = 0
      for (const t of tiposDe(rom)) {
        const ventaId = mapa[t]
        if (!ventaId) continue
        const r = resumenPorTipo(t)
        const { error } = await prod.from("stock_ventas").update({
          kg_carne: r.kg_carne,
          monto_neto: r.importe,
          precio_kg: r.kg_carne > 0 ? Math.round((r.importe / r.kg_carne) * 100) / 100 : null,
        }).eq("id", ventaId)
        if (error) throw error
        tocadas++
      }

      // Las horas y el kilaje del destino viven en la CARGA: son del viaje, no del romaneo.
      if (cargaId && (horaCampo || horaDestino || kgDestino)) {
        await prod.from("cargas").update({
          pesada_campo_at: horaCampo ? new Date(horaCampo).toISOString() : null,
          pesada_destino_at: horaDestino ? new Date(horaDestino).toISOString() : null,
          kg_vivo_destino: kgDestino ? parseFloat(kgDestino.replace(/\./g, "").replace(",", ".")) : rom.kilos_vivos,
        }).eq("id", cargaId)
      }
      anotarResultado("romaneo-guardar",
        `${romG.cabezas} cab · ${romG.medias.length} medias · ${romG.lineas.length} líneas · `
        + `${huella().length} corrección(es) · ${tocadas} venta(s) completada(s)`)
      toast.success(`Romaneo guardado${tocadas ? ` · ${tocadas} venta(s) completada(s)` : ""}`)
      onGuardado?.()
      limpiar()
      onCerrar()
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message)
    } finally { setGuardando(false) }
  }

  const campo = (k: string, etiqueta: string, ancho = "") => (
    <div className={ancho}>
      <Label className="text-[10px] text-gray-500">{etiqueta}</Label>
      <Input className="h-7 text-xs" value={cab[k] ?? ""}
        onChange={e => setCab(p => ({ ...p, [k]: e.target.value }))} />
    </div>
  )

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) cerrarConAviso() }}>
      {/* Un click afuera o un Escape NO pueden tirar a la basura un romaneo ya leído y revisado.
          Le pasó al usuario: «no sé qué apreté que se cerró pero me parece que lo tomó» — y no
          había tomado nada. Lo peor no fue perder el trabajo: fue quedarse sin saber. A-BUG-117 */}
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto"
        onInteractOutside={e => { if (rom) e.preventDefault() }}
        onEscapeKeyDown={e => { if (rom) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle>📄 Cargar el romaneo del frigorífico</DialogTitle>
        </DialogHeader>

        {!rom ? (
          <div className="space-y-3 py-6">
            {!cargaFija && (
              <div className="rounded border p-2">
                <Label className="text-[10px] text-gray-500">
                  ¿De qué carga es este romaneo? <span className="text-gray-400">— un camión, un romaneo, y adentro las ventas que llevó</span>
                </Label>
                <select className="mt-1 h-8 w-full rounded border px-2 text-xs" value={cargaSel}
                  onFocus={cargarCargas} onChange={e => setCargaSel(e.target.value)}>
                  <option value="">— elegir la carga —</option>
                  {cargas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fecha ?? "sin fecha"} · {c.cliente_nombre ?? "sin cliente"}
                      {c.peso_bruto != null && c.peso_tara != null ? ` · camión ${(c.peso_bruto - c.peso_tara).toLocaleString("es-AR")} kg` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="rounded border-2 border-dashed p-8 text-center">
              <p className="mb-3 text-sm text-gray-600">Subí el PDF del romaneo</p>
              <Input type="file" accept="application/pdf" disabled={leyendo}
                onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }} />
              {leyendo && (
                <p className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Leyendo…
                </p>
              )}
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              Se leen la cabecera, la liquidación y el detalle por media res. <b>Todo queda editable</b>:
              lo que lea el PDF es una propuesta, no una decisión.
            </p>
          </div>
        ) : (() => {
          // Todo lo que sigue trabaja sobre el romaneo YA CORREGIDO: los controles, el rinde por
          // grupo y lo que va a las ventas se rehacen solos cuando se edita una línea.
          const romE = romEfectivo()!
          return (
          <div className="space-y-4">
            {/* ── CONTROLES ─────────────────────────────────────────────────────────── */}
            <div className="rounded border">
              <div className="border-b bg-gray-50 px-3 py-1.5 text-xs font-medium">
                🧮 Controles — lo sumado contra lo que dice el papel
              </div>
              <div className="grid grid-cols-2 gap-x-4 p-2 text-[11px]">
                {romE.controles.map((c, i) => (
                  <div key={i} className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${c.cierra ? "text-gray-600" : "bg-red-50 font-medium text-red-700"}`}>
                    <span>{c.cierra ? "✓" : "⚠"} {c.nombre}</span>
                    <span className="tabular-nums">
                      {c.cierra ? (c.calculado?.toLocaleString("es-AR") ?? "—")
                        : `papel ${c.impreso?.toLocaleString("es-AR") ?? "—"} · leído ${c.calculado.toLocaleString("es-AR")}`}
                    </span>
                  </div>
                ))}
              </div>
              {romE.avisos.length > 0 && (
                <div className="border-t bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
                  {romE.avisos.map((a, i) => <div key={i}>⚠️ {a}</div>)}
                  <div className="mt-1 text-amber-700">
                    Podés guardar igual y corregir los valores a mano — nada se guarda sin que lo confirmes.
                  </div>
                </div>
              )}
            </div>

            {/* ── CABECERA (editable) ───────────────────────────────────────────────── */}
            <div className="rounded border p-2">
              <div className="mb-2 text-xs font-medium">Cabecera <span className="font-normal text-gray-400">— corregí lo que haga falta</span></div>
              <div className="grid grid-cols-4 gap-2">
                {campo("frigorifico", "Frigorífico", "col-span-2")}
                {campo("matricula", "Matrícula")}
                {campo("cuit_frigorifico", "CUIT")}
                {campo("vendedor", "Vendedor", "col-span-2")}
                {campo("tropa", "Tropa")}
                {campo("fecha_faena", "Faena")}
                {campo("guia", "Guía")}
                {campo("dta", "DTA")}
              </div>
            </div>

            {/* ── CONTRA LA APP ─────────────────────────────────────────────────────── */}
            <div className="rounded border">
              <div className="border-b bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900">
                Cómo queda contra lo que ya está cargado
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[10px] text-gray-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Grupo</th>
                    <th className="px-2 py-1 text-right">Cab</th>
                    <th className="px-2 py-1 text-right">kg carne</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                    <th className="px-2 py-1 text-left">Se imputa a la venta…</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposDe(rom).map(t => {
                    const r = resumenPorTipo(t)
                    const v = ventas.find(x => x.id === mapa[t])
                    return (
                      <tr key={t} className="border-t align-top">
                        <td className="px-2 py-1 font-medium">{t === "VA" ? "VA · vacas" : t === "TO" ? "TO · toros" : t}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.cabezas}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{kg(r.kg_carne)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{m(r.importe)}</td>
                        <td className="px-2 py-1">
                          <select className="h-6 w-full rounded border px-1 text-[11px]"
                            value={mapa[t] ?? ""}
                            onChange={e => setMapa(p => ({ ...p, [t]: e.target.value }))}>
                            <option value="">— no imputar —</option>
                            {ventas.map(v2 => (
                              <option key={v2.id} value={v2.id}>
                                {v2.categoria_nombre ?? "venta"} · {v2.cantidad ?? "?"} cab · {kg(v2.kg_totales)}
                              </option>
                            ))}
                          </select>
                          {v && (
                            <div className="mt-1 text-[10px] leading-4 text-gray-500">
                              kg carne: <b>{v.kg_carne == null ? "vacío" : kg(v.kg_carne)}</b> → {kg(r.kg_carne)}<br />
                              importe: <b>{v.monto_neto == null ? "vacío" : m(v.monto_neto)}</b> → {m(r.importe)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ventas.length === 0 && (
                <p className="px-3 py-2 text-[11px] text-amber-700">
                  ⚠️ Esta carga no tiene ventas asociadas: el romaneo se guarda igual, pero no hay a qué imputarlo.
                </p>
              )}
            </div>

            {/* DESBASTE — las horas */}
            <div className="rounded border">
              <div className="border-b bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900">
                Desbaste
                <span className="ml-2 font-normal text-sky-700">
                  el % solo no sirve: lo comparable es el % por hora
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2">
                <div>
                  <Label className="text-[10px] text-gray-500">Pesamos en el campo</Label>
                  <Input type="datetime-local" className="h-7 text-xs" value={horaCampo}
                    onChange={e => setHoraCampo(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500" title="No viene en el romaneo: hay que pedirla al frigorífico">
                    El frigorífico pesó el vivo
                  </Label>
                  <Input type="datetime-local" className="h-7 text-xs" value={horaDestino}
                    onChange={e => setHoraDestino(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-500">Kilos vivos que recibió</Label>
                  <Input type="text" className="h-7 text-xs" placeholder={String(romE.kilos_vivos)}
                    value={kgDestino} onChange={e => setKgDestino(e.target.value)} />
                </div>
              </div>
              {(() => {
                const recibido = parseFloat((kgDestino || "").replace(/\./g, "").replace(",", ".")) || romE.kilos_vivos
                const h = horaCampo && horaDestino
                  ? (new Date(horaDestino).getTime() - new Date(horaCampo).getTime()) / 3600000 : null
                const fila = (et: string, base: number | null) => {
                  if (!base || !recibido) return null
                  const dif = base - recibido
                  const pct = (dif / base) * 100
                  return (
                    <div key={et} className="flex items-center justify-between px-3 py-0.5">
                      <span>{et} <b className="tabular-nums">{base.toLocaleString("es-AR")}</b> kg</span>
                      <span className="tabular-nums">
                        {dif >= 0 ? "−" : "+"}{Math.abs(dif).toLocaleString("es-AR")} kg ·{" "}
                        <b>{Math.abs(pct).toFixed(2).replace(".", ",")} %</b>
                        {h != null && h > 0 && <> · <b>{(pct / h).toFixed(3).replace(".", ",")} %/h</b></>}
                      </span>
                    </div>
                  )
                }
                return (
                  <div className="border-t bg-gray-50 py-1 text-[11px] text-gray-700">
                    {h != null && <div className="px-3 py-0.5 text-[10px] text-gray-500">{h.toFixed(1).replace(".", ",")} horas entre las dos pesadas</div>}
                    {fila("Campo", pesoCampo)}
                    {fila("Camión", netoCamion)}
                    <div className="mt-1 border-t px-3 py-1 text-[10px] leading-4 text-gray-600">
                      El desbaste normal de hacienda ronda <b>0,15–0,20 %/h</b> en el primer día. Una balanza que
                      dé muy por debajo de eso probablemente <b>esté leyendo de menos</b>, no es que el animal no
                      haya desbastado. <b>Hace falta la serie de varias cargas</b> para separar una cosa de la otra:
                      un solo viaje no alcanza.
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ADJUDICACION CABEZA POR CABEZA */}
            <div className="rounded border">
              <div className="border-b bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">
                Cabeza por cabeza
                <span className="ml-2 font-normal text-emerald-700">
                  se aparean por orden de peso: al más pesado nuestro, la res más pesada
                </span>
              </div>
              {tiposDe(rom).map(t => {
                const { pares, factor, sinPareja } = adjudicacionesDe(t)
                if (!pares.length) return null
                return (
                  <div key={t} className="border-b last:border-b-0">
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-1 text-[10px] text-gray-600">
                      <span className="font-medium">{t === "VA" ? "VA · vacas" : t === "TO" ? "TO · toros" : t}</span>
                      <span>
                        {factor !== 1 && <>ajuste por balanza del camión: <b>×{factor.toFixed(4)}</b></>}
                        {sinPareja > 0 && <span className="ml-2 text-amber-700">⚠ {sinPareja} sin pareja</span>}
                      </span>
                    </div>
                    <table className="w-full text-[11px]">
                      <thead className="text-[10px] text-gray-500">
                        <tr>
                          <th className="px-2 py-0.5 text-left">Nuestra</th>
                          <th className="px-2 text-right">pesada</th>
                          <th className="px-2 text-right">ajustada</th>
                          <th className="px-2 text-left">Garrón</th>
                          <th className="px-2 text-left">Clase</th>
                          <th className="px-2 text-right">kg res</th>
                          <th className="px-2 text-right">Rinde</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pares.map((par, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-0.5">
                              {par.nuestra ? (par.nuestra.caravana || par.nuestra.razon || "sin caravana") : <span className="text-amber-700">falta</span>}
                            </td>
                            <td className="px-2 text-right tabular-nums">{par.nuestra ? par.nuestra.peso_kg : "—"}</td>
                            <td className="px-2 text-right tabular-nums text-gray-500">{par.peso_ajustado ?? "—"}</td>
                            <td className="px-2">{par.romaneo?.garron ?? <span className="text-amber-700">falta</span>}</td>
                            <td className="px-2 text-gray-500">{par.romaneo ? `${par.romaneo.clase}${par.romaneo.dientes ?? ""}` : ""}</td>
                            <td className="px-2 text-right">
                              {par.romaneo && (
                                <Input type="text"
                                  className={`h-5 w-16 text-right text-[11px] ${par.romaneo.medias !== 2 ? "border-amber-400 bg-amber-50" : ""}`}
                                  title={par.romaneo.medias !== 2 ? `Se leyeron ${par.romaneo.medias} media(s) res en vez de 2` : ""}
                                  placeholder={String(par.romaneo.kg_gancho)}
                                  value={ganchoFix[par.romaneo.garron] ?? ""}
                                  onChange={e => { const g = par.romaneo!.garron; const v = e.target.value; setGanchoFix(q => ({ ...q, [g]: v })) }} />
                              )}
                            </td>
                            <td className={`px-2 text-right tabular-nums ${par.rinde == null ? "text-gray-400" : "font-medium"}`}>
                              {par.rinde == null ? "—" : `${par.rinde.toFixed(2).replace(".", ",")} %`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
              <div className="bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                ⚠️ Si un garrón aparece con <b>una sola media res</b> (recuadro ámbar), el PDF perdió la otra:
                <b> corregi el kilo de res a mano</b> o el apareo por peso queda corrido.
                Los kilos nuestros se escalan por <b>neto del camión / suma nuestra</b> — <i>el peso real que
                tomamos</i> — sin pisar la pesada original.
              </div>
            </div>

            {/* RINDE POR GRUPO DE PRECIO */}
            <div className="rounded border">
              <div className="border-b bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">
                Rinde por grupo de precio
                <span className="ml-2 font-normal text-emerald-700">un grupo = un precio dentro de un tipo</span>
              </div>
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[10px] text-gray-600">
                  <tr>
                    <th className="px-2 py-1 text-left">Grupo</th>
                    <th className="px-2 py-1 text-left">Clases</th>
                    <th className="px-2 py-1 text-right">Cab</th>
                    <th className="px-2 py-1 text-right">kg vivo</th>
                    <th className="px-2 py-1 text-right">kg carne</th>
                    <th className="px-2 py-1 text-right">$/kg</th>
                    <th className="px-2 py-1 text-right">Importe</th>
                    <th className="px-2 py-1 text-right">Rinde real</th>
                  </tr>
                </thead>
                <tbody>
                  {rindePorGrupo(todasLasAdjudicaciones()).map(g => (
                    <tr key={g.k} className="border-t">
                      <td className="px-2 py-1 font-medium">{g.tipo} · {m(g.precio)}</td>
                      <td className="px-2 py-1 text-gray-500">{g.clases.join(", ")}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{g.cabezas}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{Math.round(g.kg_vivo).toLocaleString("es-AR")}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{g.kg_gancho.toLocaleString("es-AR")}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m(g.precio)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{m(g.importe)}</td>
                      <td className="px-2 py-1 text-right font-medium tabular-nums">
                        {g.rinde == null ? "—" : `${g.rinde.toFixed(2).replace(".", ",")} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t bg-gray-50 px-3 py-2 text-[10px] leading-4 text-gray-600">
                Este rinde sale de <b>dos mediciones reales e independientes</b>: nuestra balanza y el kilo de
                res del garrón. Por eso varía entre grupos. ⚠️ <b>El vivo del romaneo no sirve para esto</b>:
                el frigorífico lo reparte con el rinde global y daría <b>{romE.rinde} %</b> para todos.
              </div>
            </div>

            {/* ── DETALLE (plegado) ─────────────────────────────────────────────────── */}
            <div className="rounded border">
              <button type="button" onClick={() => setVerDetalle(v => !v)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                <span>{verDetalle ? "▾" : "▸"} Detalle — {romE.lineas.length} línea(s) de liquidación · {romE.medias.length} media(s) res</span>
                <span className="font-normal text-gray-500">
                  {kg(romE.kilos_gancho)} carne · {kg(romE.kilos_vivos)} vivo · rinde {romE.rinde}%
                </span>
              </button>
              {verDetalle && (
                <div className="border-t p-2">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 text-[10px] text-gray-600">
                      <tr>
                        <th className="px-1 py-1 text-left">Cab</th><th className="px-1 text-left">Tipo</th>
                        <th className="px-1 text-left">Clase</th><th className="px-1 text-left">Dientes</th>
                        <th className="px-1 text-left">Cont.</th>
                        <th className="px-1 text-right">kg vivo</th><th className="px-1 text-right">kg carne</th>
                        <th className="px-1 text-right">$/kg</th><th className="px-1 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {romE.lineas.map((l, i) => {
                        const orig = rom.lineas[i]
                        const campo = (nombre: string, valor: number | null, ancho: string) => {
                          const k = `${orig.orden}|${nombre}`
                          const tocado = (lineaFix[k] ?? "").trim() !== ""
                          return (
                            <Input type="text" className={`h-5 ${ancho} text-right text-[11px] ${tocado ? "border-amber-400 bg-amber-50 font-medium" : ""}`}
                              placeholder={valor == null ? "—" : String(valor)}
                              value={lineaFix[k] ?? ""}
                              onChange={e => { const v = e.target.value; setLineaFix(q => ({ ...q, [k]: v })) }} />
                          )
                        }
                        return (
                          <tr key={i} className="border-t">
                            <td className="px-1 py-0.5">{campo("cabezas", orig.cabezas, "w-10")}</td>
                            <td className="px-1">{l.tipo}</td>
                            <td className="px-1">{l.clase}</td><td className="px-1">{l.dientes ?? "—"}</td>
                            <td className="px-1">{l.contenido}</td>
                            <td className="px-1 text-right tabular-nums text-gray-500">{l.kg_vivo}</td>
                            <td className="px-1">{campo("kg_faena", orig.kg_faena, "w-16")}</td>
                            <td className="px-1">{campo("precio_kg", orig.precio_kg, "w-20")}</td>
                            <td className="px-1">{campo("importe", orig.importe, "w-24")}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                    <b>Todo esto se puede corregir</b>, y de acá salen los kilos y el importe de cada venta.
                    Al tocar <b>kg</b> o <b>$/kg</b> el importe <b>se recalcula solo</b>; si escribís el importe
                    a mano, manda el escrito. Los controles de arriba se rehacen contra lo impreso, así que
                    vas viendo si la corrección acerca o aleja.
                    <br />
                    El <b>$/kg</b> que se propone no se lee del papel: sale de <code>importe ÷ kg</code>, que
                    es exacto y no depende de dónde imprima el precio el frigorífico.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={limpiar}>← Subir otro PDF</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={cerrarConAviso}>Cancelar</Button>
                <Button onClick={guardar} disabled={guardando}>
                  {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                  Confirmar y completar las ventas
                </Button>
              </div>
            </div>
          </div>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}
