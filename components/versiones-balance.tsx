"use client"

/**
 * 💾 LAS VERSIONES DE LOS PAPELES DEL BALANCE — A-FEAT-1337 paso 2 (2026-10-27).
 *
 * Decisiones del usuario (27/10): **se guarda sólo cuando aprieta «Guardar»**, la pantalla dice siempre **si lo que
 * se ve está guardado o no**, y el Excel queda guardado pero **siempre se puede bajar**.
 *
 * - `useVersionesBalance`: lee y escribe `balance_versiones` / `balance_version_items` (script 116). Si las tablas
 *   todavía no existen, la pantalla anda como antes y lo dice: nunca rompe.
 * - `<VersionesBalance>`: el cuadro — estado de lo actual, lo cambiado desde lo entregado, Guardar, y por versión
 *   ⬇️ Bajar · 📤 Marcar entregada · Anular.
 *
 * 🔒 Lo entregado queda fijo: la base no deja cambiar el archivo ni los ítems, ni volver de entregada a guardada.
 * Nada se borra: una versión se anula con motivo.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { ahoraISO } from "@/lib/fechas"
import { traerTodo } from "@/lib/supabase-paginado"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  compararItems, cambiosPorPapel, proximoNumero, ultimaVigente, ultimaEntregada,
  type ItemPapel, type VersionBalance, type CambioItem, type InfoVersionExcel,
} from "@/lib/balance/versiones"
import { bajarExcelGuardado } from "@/lib/balance/export-libro-diario"

const TABLA = "balance_versiones"
const TABLA_ITEMS = "balance_version_items"
const COLUMNAS = "id, numero, estado, destinatario, nota, creada_at, creada_por, entregada_at, entregada_por, anulada_at, anulada_motivo, items_cantidad, archivo_nombre"
const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** dd/mm hh:mm en hora argentina (§ 🕐: es un instante que se muestra como día). */
export const fechaHora = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : ""
const noExiste = (e: { code?: string; message: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || /does not exist|could not find/i.test(e.message)

export type EstadoVersiones = "leyendo" | "listo" | "sin tabla" | "error"

export function useVersionesBalance(empresa: string, anioCierre: number) {
  const [lista, setLista] = useState<VersionBalance[]>([])
  const [estado, setEstado] = useState<EstadoVersiones>("leyendo")
  const [error, setError] = useState<string | null>(null)
  const [itemsUltima, setItemsUltima] = useState<ItemPapel[] | null>(null)
  const [itemsEntregada, setItemsEntregada] = useState<ItemPapel[] | null>(null)
  /** Lo traído del sector productivo en la última versión: la pantalla lo muestra sin volver a traerlo. */
  const [productivoUltima, setProductivoUltima] = useState<unknown | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vivo = true
    setEstado("leyendo")
    ;(async () => {
      const { data, error } = await supabase.from(TABLA).select(COLUMNAS)
        .eq("empresa", empresa).eq("anio_cierre", anioCierre).order("numero")
      if (!vivo) return
      if (error) {
        setEstado(noExiste(error) ? "sin tabla" : "error"); setError(noExiste(error) ? null : error.message)
        setLista([]); return
      }
      setLista((data ?? []) as VersionBalance[]); setEstado("listo"); setError(null)
    })()
    return () => { vivo = false }
  }, [empresa, anioCierre, vuelta])

  const ultima = useMemo(() => ultimaVigente(lista), [lista])
  const entregada = useMemo(() => ultimaEntregada(lista), [lista])

  const leerItems = useCallback(async (id: string): Promise<ItemPapel[] | null> => {
    const r = await traerTodo((d, h) => supabase.from(TABLA_ITEMS)
      .select("papel, clave, concepto, valor, unidad", { count: "exact" })
      .eq("version_id", id).order("papel").order("clave").range(d, h))
    if (r.error) return null
    return (r.data as ItemPapel[]).map(x => ({ ...x, valor: x.valor == null ? null : Number(x.valor) }))
  }, [])

  useEffect(() => {
    let vivo = true
    setItemsUltima(null); setProductivoUltima(null)
    if (!ultima) return
    ;(async () => {
      const [items, prod] = await Promise.all([
        leerItems(ultima.id),
        supabase.from(TABLA).select("productivo").eq("id", ultima.id).single(),
      ])
      if (!vivo) return
      setItemsUltima(items)
      setProductivoUltima((prod.data as { productivo?: unknown } | null)?.productivo ?? null)
    })()
    return () => { vivo = false }
  }, [ultima, leerItems])

  useEffect(() => {
    let vivo = true
    setItemsEntregada(null)
    if (!entregada) return
    ;(async () => {
      const items = entregada.id === ultima?.id ? null : await leerItems(entregada.id)
      if (vivo) setItemsEntregada(items)
    })()
    return () => { vivo = false }
  }, [entregada, ultima, leerItems])

  const persona = async () => etiquetaPersona((await supabase.auth.getUser()).data.user ?? null)

  /** 💾 Guarda una versión nueva: el Excel, lo traído y cada ítem. Devuelve el número o null si falló. */
  const guardar = useCallback(async (p: {
    items: ItemPapel[]; productivo: unknown | null; nota: string
    /** Arma el Excel YA con su número (para que diga «Este Excel es la vN»). */
    archivo: (numero: number) => { base64: string; nombre: string }
  }): Promise<number | null> => {
    const quien = await persona()
    const { data: nums, error: eNums } = await supabase.from(TABLA).select("numero").eq("empresa", empresa).eq("anio_cierre", anioCierre)
    if (eNums) { toast.error("No se pudo guardar la versión: " + eNums.message); return null }
    const numero = proximoNumero((nums ?? []) as Array<{ numero: number }>)
    const archivo = p.archivo(numero)
    const { data: v, error } = await supabase.from(TABLA).insert({
      empresa, anio_cierre: anioCierre, numero, estado: "guardada", nota: p.nota.trim() || null,
      productivo: p.productivo ?? null, archivo_base64: archivo.base64,
      archivo_nombre: archivo.nombre.replace(/\.xlsx$/i, `_v${numero}.xlsx`),
      items_cantidad: p.items.length, creada_por: quien,
    }).select("id").single()
    if (error || !v) { toast.error("No se pudo guardar la versión: " + (error?.message ?? "sin respuesta")); return null }
    const id = (v as { id: string }).id
    for (let i = 0; i < p.items.length; i += 500) {
      const tanda = p.items.slice(i, i + 500).map(x => ({ version_id: id, ...x }))
      const { error: e2 } = await supabase.from(TABLA_ITEMS).insert(tanda)
      if (e2) {
        // 🛑 Nada a medias en silencio: la versión sin todos sus ítems no vale, se anula con el motivo.
        await supabase.from(TABLA).update({
          estado: "anulada", anulada_at: ahoraISO(), anulada_por: quien,
          anulada_motivo: `No se pudieron guardar los ítems (${e2.message}): versión incompleta.`,
        }).eq("id", id)
        toast.error(`La v${numero} quedó incompleta y se anuló: ${e2.message}`)
        setVuelta(x => x + 1)
        return null
      }
    }
    setVuelta(x => x + 1)
    return numero
  }, [empresa, anioCierre])

  const entregar = useCallback(async (id: string, destinatario: string) => {
    const { error } = await supabase.from(TABLA).update({
      estado: "entregada", destinatario, entregada_at: ahoraISO(), entregada_por: await persona(),
    }).eq("id", id)
    if (error) toast.error("No se pudo marcar como entregada: " + error.message)
    setVuelta(x => x + 1)
  }, [])

  const anular = useCallback(async (id: string, motivo: string) => {
    const { error } = await supabase.from(TABLA).update({
      estado: "anulada", anulada_at: ahoraISO(), anulada_por: await persona(), anulada_motivo: motivo,
    }).eq("id", id)
    if (error) toast.error("No se pudo anular: " + error.message)
    setVuelta(x => x + 1)
  }, [])

  const bajar = useCallback(async (id: string) => {
    const { data, error } = await supabase.from(TABLA).select("archivo_base64, archivo_nombre").eq("id", id).single()
    const x = data as { archivo_base64: string | null; archivo_nombre: string | null } | null
    if (error || !x?.archivo_base64) { toast.error("Esa versión no tiene el Excel guardado."); return }
    bajarExcelGuardado(x.archivo_base64, x.archivo_nombre ?? "papeles_balance.xlsx")
  }, [])

  return { lista, estado, error, ultima, entregada, itemsUltima, itemsEntregada, productivoUltima, guardar, entregar, anular, bajar }
}

export type VersionesDelBalance = ReturnType<typeof useVersionesBalance>

/**
 * 🧮 Lo que el Excel y la pantalla dicen de la versión: si lo actual está guardado, y qué cambió desde lo entregado.
 * Pura salvo los datos que recibe: la usa la pantalla para mostrarlo y para ponerlo en la solapa Control.
 */
export function infoDeVersion(v: VersionesDelBalance, actuales: ItemPapel[] | null, numero: number | null = null): InfoVersionExcel {
  const contraUltima = v.itemsUltima && actuales ? compararItems(v.itemsUltima, actuales) : null
  const itemsEnt = v.entregada && v.entregada.id === v.ultima?.id ? v.itemsUltima : v.itemsEntregada
  const contraEntregada = itemsEnt && actuales ? compararItems(itemsEnt, actuales) : null
  return {
    numero,
    ultima: v.ultima ? { numero: v.ultima.numero, fecha: fechaHora(v.ultima.creada_at) } : null,
    cambiosContraUltima: contraUltima ? contraUltima.length : null,
    entregada: v.entregada && contraEntregada
      ? { numero: v.entregada.numero, destinatario: v.entregada.destinatario ?? "", fecha: fechaHora(v.entregada.entregada_at), cambios: contraEntregada }
      : null,
  }
}

function ListaDeCambios({ cambios, max = 40 }: { cambios: CambioItem[]; max?: number }) {
  const val = (x: number | null, u: string) => x == null ? "—" : u === "$" ? `$${fmt(x)}` : `${fmt(x)} ${u}`
  return (
    <table className="w-full mt-1 font-mono text-[11px]">
      <tbody>
        {cambios.slice(0, max).map(c => (
          <tr key={`${c.papel}|${c.clave}`} className="border-b border-dashed">
            <td className="pr-2 text-muted-foreground">{c.papel}</td>
            <td className="pr-2">{c.concepto}</td>
            <td className="pr-2 text-right">{c.tipo === "nuevo" ? "(no estaba)" : val(c.antes, c.unidad)}</td>
            <td className="pr-2 text-right">{c.tipo === "ya no está" ? "(ya no está)" : val(c.ahora, c.unidad)}</td>
            <td className="text-right">{c.diferencia == null ? "" : (c.diferencia > 0 ? "+" : "") + fmt(c.diferencia)}</td>
          </tr>
        ))}
      </tbody>
      {cambios.length > max && <tfoot><tr><td colSpan={5} className="text-muted-foreground">… y {cambios.length - max} más (todos en la solapa Control del Excel).</td></tr></tfoot>}
    </table>
  )
}

export function VersionesBalance({ v, actuales, onGuardar, guardando }: {
  v: VersionesDelBalance
  /** Los ítems de lo que se ve ahora. null = todavía no se armó el libro. */
  actuales: ItemPapel[] | null
  onGuardar: (nota: string) => void
  guardando: boolean
}) {
  const [nota, setNota] = useState("")
  const [destino, setDestino] = useState<Record<string, string>>({})
  const contraUltima = v.itemsUltima && actuales ? compararItems(v.itemsUltima, actuales) : null
  const info = infoDeVersion(v, actuales)

  if (v.estado === "sin tabla") {
    return (
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1.5">
        💾 Las versiones todavía <strong>no se pueden guardar</strong>: falta correr el script 116 en la base. El Excel se baja igual.
      </div>
    )
  }
  return (
    <div className="rounded border p-3 text-xs space-y-2">
      <div className="font-semibold text-sm">💾 Versiones de estos papeles</div>
      {v.estado === "error" && <div className="text-red-700">🛑 No se pudieron leer las versiones: {v.error}</div>}

      {/* El estado de LO ACTUAL — pedido del usuario: «que muestre si está guardado o no lo actual». */}
      {!actuales ? (
        <div className="text-muted-foreground">Armá el libro para ver si lo que da hoy está guardado.</div>
      ) : !v.ultima ? (
        <div className="text-amber-800">⚠️ <strong>Lo que ves NO está guardado</strong>: todavía no hay ninguna versión de este ejercicio.</div>
      ) : contraUltima == null ? (
        <div className="text-muted-foreground">Comparando con la v{v.ultima.numero}…</div>
      ) : contraUltima.length === 0 ? (
        <div className="text-emerald-700">✓ <strong>Lo que ves está guardado</strong>: es la v{v.ultima.numero} ({fechaHora(v.ultima.creada_at)}).</div>
      ) : (
        <details>
          <summary className="cursor-pointer text-amber-800">
            ⚠️ <strong>Lo que ves NO está guardado</strong>: {contraUltima.length} ítem(s) distintos de la v{v.ultima.numero} ({fechaHora(v.ultima.creada_at)}) —{" "}
            {cambiosPorPapel(contraUltima).map(p => `${p.papel} ${p.cambios}`).join(" · ")}
          </summary>
          <ListaDeCambios cambios={contraUltima} />
        </details>
      )}

      {/* Contra lo ENTREGADO: avisa, no frena. */}
      {info.entregada && (
        info.entregada.cambios.length === 0 ? (
          <div className="text-emerald-700">✓ Coincide con lo entregado: v{info.entregada.numero} a {info.entregada.destinatario} ({info.entregada.fecha}).</div>
        ) : (
          <details>
            <summary className="cursor-pointer text-red-700 font-semibold">
              📤 Desde la v{info.entregada.numero} entregada a {info.entregada.destinatario} ({info.entregada.fecha}) cambiaron {info.entregada.cambios.length} ítem(s)
            </summary>
            <ListaDeCambios cambios={info.entregada.cambios} />
          </details>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input type="text" className="border rounded px-2 py-1 text-xs w-64" placeholder="Nota (opcional): «con precios de junio», «para el contador»…"
          value={nota} onChange={e => setNota(e.target.value)} />
        <Button size="sm" disabled={!actuales || guardando} onClick={() => { onGuardar(nota); setNota("") }}>
          {guardando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          💾 Guardar versión
        </Button>
        <span className="text-muted-foreground">Guarda el Excel de ahora, cada ítem de cada papel y el stock y precios traídos.</span>
      </div>

      {v.lista.length > 0 && (
        <table className="w-full">
          <thead><tr className="border-b text-gray-600">
            <th className="text-left">Versión</th><th className="text-left">Guardada</th><th className="text-left">Estado</th>
            <th className="text-left">Nota</th><th className="text-right">Ítems</th><th />
          </tr></thead>
          <tbody>
            {[...v.lista].reverse().map(x => (
              <tr key={x.id} className={x.estado === "anulada" ? "text-muted-foreground line-through" : ""}>
                <td>v{x.numero}</td>
                <td>{fechaHora(x.creada_at)}{x.creada_por ? ` · ${x.creada_por}` : ""}</td>
                <td>
                  {x.estado === "entregada" ? <span className="text-emerald-700 font-semibold">📤 entregada a {x.destinatario} ({fechaHora(x.entregada_at)})</span>
                    : x.estado === "anulada" ? <span title={x.anulada_motivo ?? ""}>anulada: {x.anulada_motivo}</span>
                    : "guardada"}
                </td>
                <td>{x.nota}</td>
                <td className="text-right">{x.items_cantidad}</td>
                <td className="text-right whitespace-nowrap space-x-1">
                  <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => v.bajar(x.id)}>⬇️ Bajar</Button>
                  {x.estado === "guardada" && (
                    <>
                      <select className="border rounded text-xs h-6" value={destino[x.id] ?? ""}
                        onChange={e => setDestino(d => ({ ...d, [x.id]: e.target.value }))}>
                        <option value="">entregar a…</option>
                        <option value="contador">contador</option>
                        <option value="ARCA">ARCA</option>
                        <option value="otro">otro</option>
                      </select>
                      <Button size="sm" variant="outline" className="h-6 px-2" disabled={!destino[x.id]}
                        onClick={() => {
                          const d = destino[x.id] === "otro" ? (window.prompt("¿A quién se entregó?") ?? "").trim() : destino[x.id]
                          if (d && window.confirm(`¿Marcar la v${x.numero} como entregada a ${d}? Queda fija: no se cambia, sólo se puede anular.`)) v.entregar(x.id, d)
                        }}>📤 Entregada</Button>
                    </>
                  )}
                  {x.estado !== "anulada" && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-red-700"
                      onClick={() => {
                        const m = (window.prompt(`¿Por qué se anula la v${x.numero}? (queda guardada, tachada)`) ?? "").trim()
                        if (m) v.anular(x.id, m)
                      }}>Anular</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
