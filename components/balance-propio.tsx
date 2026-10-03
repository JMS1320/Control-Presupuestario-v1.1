"use client"

/**
 * 📸 BALANCE PROPIO — activo menos pasivo, fin menos inicio, en pesos y en dólares. A-FEAT-1190.
 *
 * Muestra la FOTO de un cierre (un importe por renglón y por versión: contador, JMS, sistema,
 * SENASA), la diferencia entre versiones y los cuatro resultados contra la foto anterior.
 * La foto es un **dato duro** (A-DEC-1001): se edita a mano y no se recalcula sola.
 * Toda la cuenta vive en `lib/balance/balance-propio.ts`, probada en `lib/pruebas/casos.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Info } from "lucide-react"
import { toast } from "sonner"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import {
  RUBROS, RENGLONES, VERSIONES, resultadosDeVersion, enDolares, gananciaDelEjercicio,
  totalDelRubro, parsearMonto, type Version, type ValorFoto,
} from "@/lib/balance/balance-propio"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (f: string) => f.split("-").reverse().join("/")

interface Foto { id: string; empresa: string; fecha_cierre: string; tc: number | null; tc_fuente: string | null; notas: string | null }
interface FilaValor extends ValorFoto { id: string; foto_id: string; origen: string; detalle: string | null; valor_sistema: number | null }

const EMPRESAS = ["MSA", "MA"] as const

export function BalancePropio() {
  const [empresa, setEmpresa] = useState<(typeof EMPRESAS)[number]>("MSA")
  const [fotos, setFotos] = useState<Foto[]>([])
  const [fotoId, setFotoId] = useState<string | null>(null)
  const [valores, setValores] = useState<FilaValor[]>([])
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [tcTexto, setTcTexto] = useState("")

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data: fs, error } = await supabase.from("balance_fotos").select("*").eq("empresa", empresa).order("fecha_cierre")
      if (error) throw error
      const lista = (fs || []) as Foto[]
      setFotos(lista)
      setFotoId(prev => (prev && lista.some(f => f.id === prev)) ? prev : (lista[lista.length - 1]?.id ?? null))
      const ids = lista.map(f => f.id)
      if (ids.length) {
        const { data: vs, error: e2 } = await supabase.from("balance_foto_valores").select("*").in("foto_id", ids)
        if (e2) throw e2
        setValores(((vs || []) as any[]).map(v => ({ ...v, importe: Number(v.importe), valor_sistema: v.valor_sistema == null ? null : Number(v.valor_sistema) })))
      } else setValores([])
    } catch (err) {
      toast.error("No se pudo leer el balance propio: " + (err as Error).message)
    } finally { setCargando(false) }
  }, [empresa])

  useEffect(() => { if (abierto) void cargar() }, [abierto, cargar])

  const foto = fotos.find(f => f.id === fotoId) ?? null
  const anterior = foto ? [...fotos].filter(f => f.fecha_cierre < foto.fecha_cierre).pop() ?? null : null
  useEffect(() => { setTcTexto(foto?.tc != null ? fmt(Number(foto.tc)) : "") }, [foto?.id, foto?.tc])

  const deFoto = useCallback((id: string | undefined) => valores.filter(v => v.foto_id === id), [valores])
  const valoresFoto = useMemo(() => deFoto(foto?.id), [deFoto, foto?.id])
  const valoresAnterior = useMemo(() => deFoto(anterior?.id), [deFoto, anterior?.id])

  // Se muestran Contador y JMS siempre; Sistema y SENASA sólo si la foto tiene algún valor de ellas.
  const versiones = VERSIONES.filter(v => v.id === "contador" || v.id === "jms" || valoresFoto.some(x => x.version === v.id))

  const guardarValor = async (renglon: string, version: Version, texto: string) => {
    if (!foto) return
    const actual = valoresFoto.find(v => v.renglon === renglon && v.version === version)
    const nuevo = parsearMonto(texto)
    if (nuevo === null && !actual) return
    if (actual && nuevo !== null && Math.abs(actual.importe - nuevo) < 0.005) return
    try {
      if (nuevo === null && actual) {
        const { error } = await supabase.from("balance_foto_valores").delete().eq("id", actual.id)
        if (error) throw error
      } else if (actual) {
        const { error } = await supabase.from("balance_foto_valores")
          .update({ importe: nuevo, origen: "manual", updated_at: new Date().toISOString() }).eq("id", actual.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("balance_foto_valores")
          .insert({ foto_id: foto.id, renglon, version, importe: nuevo, origen: "manual" })
        if (error) throw error
      }
      await cargar()
    } catch (err) { toast.error("No se guardó: " + (err as Error).message) }
  }

  const guardarTc = async () => {
    if (!foto) return
    const tc = parsearMonto(tcTexto)
    if (tc === (foto.tc == null ? null : Number(foto.tc))) return
    const { error } = await supabase.from("balance_fotos")
      .update({ tc, tc_fuente: "manual", updated_at: new Date().toISOString() }).eq("id", foto.id)
    if (error) { toast.error("No se guardó el TC: " + error.message); return }
    await cargar()
  }

  /** Una foto nueva. El TC se propone del dólar BNA importado a esa fecha (o el anterior más cercano). */
  const crearFoto = async () => {
    if (!nuevaFecha) { toast.info("Elegí la fecha de cierre"); return }
    try {
      const { data: cot } = await supabase.from("cotizaciones").select("valor, fecha")
        .eq("serie", "dolar_bna_divisas").lte("fecha", nuevaFecha).order("fecha", { ascending: false }).limit(1).maybeSingle()
      const { error } = await supabase.from("balance_fotos").insert({
        empresa, fecha_cierre: nuevaFecha,
        tc: cot?.valor ?? null,
        tc_fuente: cot ? `dolar_bna_divisas del ${fmtFecha(cot.fecha)}` : null,
      })
      if (error) throw error
      toast.success(cot ? `Foto creada. TC ${fmt(Number(cot.valor))} (BNA divisas del ${fmtFecha(cot.fecha)})` : "Foto creada, sin TC: cargalo a mano")
      setNuevaFecha("")
      setFotoId(null)
      await cargar()
    } catch (err) { toast.error("No se pudo crear la foto: " + (err as Error).message) }
  }

  const tc = foto?.tc != null ? Number(foto.tc) : null

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setAbierto(a => !a)}>
        <CardTitle className="flex items-center justify-between">
          <span>📸 Balance propio — activo menos pasivo</span>
          <span className="text-xs font-normal text-gray-500">{abierto ? "ocultar" : "mostrar"}</span>
        </CardTitle>
      </CardHeader>
      {abierto && (
        <CardContent className="space-y-4">
          <TestsDelProceso proceso="reportes/balance-propio" pantalla="reportes" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-1">
              {EMPRESAS.map(e => (
                <Button key={e} size="sm" variant={e === empresa ? "default" : "outline"} onClick={() => { setEmpresa(e); setFotoId(null) }}>{e}</Button>
              ))}
            </div>
            <div className="flex gap-1">
              {fotos.map(f => (
                <Button key={f.id} size="sm" variant={f.id === fotoId ? "default" : "outline"} onClick={() => setFotoId(f.id)}>
                  {fmtFecha(f.fecha_cierre)}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-1">
              <Input type="date" className="h-8 w-40" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => void crearFoto()}><Plus className="h-4 w-4 mr-1" />Nueva foto</Button>
            </div>
            {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {!foto && !cargando && <p className="text-sm text-gray-500">No hay fotos para {empresa}.</p>}

          {foto && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>Cierre <strong>{fmtFecha(foto.fecha_cierre)}</strong></span>
                <span className="flex items-center gap-1">
                  TC
                  <Input type="text" className="h-7 w-28 text-right" placeholder="0,00" value={tcTexto}
                    onChange={e => setTcTexto(e.target.value)} onBlur={() => void guardarTc()} />
                </span>
                {foto.tc_fuente && <span className="text-xs text-gray-500">({foto.tc_fuente})</span>}
                {anterior && <span className="text-xs text-gray-500">Inicio = foto del {fmtFecha(anterior.fecha_cierre)}</span>}
              </div>
              {foto.notas && <p className="text-xs text-gray-500 flex gap-1"><Info className="h-3 w-3 mt-0.5" />{foto.notas}</p>}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-gray-600">
                      <th className="text-left py-1">Renglón</th>
                      {versiones.map(v => <th key={v.id} className="text-right py-1 w-36">{v.etiqueta}</th>)}
                      <th className="text-right py-1 w-32">JMS − Contador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RUBROS.map(rubro => {
                      const renglones = RENGLONES.filter(r => r.rubro === rubro.id)
                      const tc0 = totalDelRubro(valoresFoto, rubro.id, "contador"), tj = totalDelRubro(valoresFoto, rubro.id, "jms")
                      return [
                        <tr key={rubro.id} className="bg-gray-50 font-semibold">
                          <td className="py-1">{rubro.etiqueta} <span className="font-normal text-gray-400">· {rubro.lado}{rubro.corriente ? "" : " no corriente"}</span></td>
                          {versiones.map(v => <td key={v.id} className="text-right">{fmt(totalDelRubro(valoresFoto, rubro.id, v.id))}</td>)}
                          <td className={`text-right ${Math.abs(tj - tc0) >= 1 ? "text-amber-700" : "text-gray-400"}`}>{fmt(tj - tc0)}</td>
                        </tr>,
                        ...renglones.map(r => {
                          const c = valoresFoto.find(v => v.renglon === r.id && v.version === "contador")
                          const j = valoresFoto.find(v => v.renglon === r.id && v.version === "jms")
                          const dif = (j?.importe ?? 0) - (c?.importe ?? 0)
                          return (
                            <tr key={r.id} className="border-b border-gray-100">
                              <td className="py-0.5 pl-3">{r.etiqueta}{r.nota && <span className="text-gray-400"> — {r.nota}</span>}</td>
                              {versiones.map(v => {
                                const val = valoresFoto.find(x => x.renglon === r.id && x.version === v.id)
                                return (
                                  <td key={v.id} className="text-right">
                                    <Input key={`${foto.id}-${r.id}-${v.id}-${val?.importe ?? ""}`} type="text" placeholder="—"
                                      className="h-6 text-right text-xs"
                                      title={val ? `${val.origen === "planilla" ? "De la planilla" : val.origen === "sistema" ? "Del sistema" : "Cargado a mano"}${val.detalle ? " · " + val.detalle : ""}` : "Vacío"}
                                      defaultValue={val ? fmt(val.importe) : ""}
                                      onBlur={e => void guardarValor(r.id, v.id, e.target.value)} />
                                  </td>
                                )
                              })}
                              <td className={`text-right ${(c || j) && Math.abs(dif) >= 1 ? "text-amber-700" : "text-gray-300"}`}>{(c || j) ? fmt(dif) : ""}</td>
                            </tr>
                          )
                        }),
                      ]
                    })}
                  </tbody>
                </table>
              </div>

              {/* Los resultados: la foto sola, y la ganancia contra la foto anterior. */}
              <div className="grid gap-3 md:grid-cols-2">
                {versiones.map(v => {
                  const r = resultadosDeVersion(valoresFoto, v.id)
                  const u = enDolares(r, tc)
                  const tieneAnterior = anterior && valoresAnterior.some(x => x.version === v.id)
                  const g = tieneAnterior ? gananciaDelEjercicio(
                    { valores: valoresAnterior, tc: anterior!.tc != null ? Number(anterior!.tc) : null },
                    { valores: valoresFoto, tc }, v.id) : null
                  if (!valoresFoto.some(x => x.version === v.id)) return null
                  return (
                    <div key={v.id} className="rounded border p-3 text-xs space-y-1">
                      <div className="font-semibold text-sm">{v.etiqueta}</div>
                      <div className="flex justify-between"><span>Activo</span><span>{fmt(r.activo)}</span></div>
                      <div className="flex justify-between"><span>Pasivo corriente · total</span><span>{fmt(r.pasivoCorriente)} · {fmt(r.pasivoTotal)}</span></div>
                      <div className="flex justify-between font-medium"><span>Activo − pasivo corriente</span><span>$ {fmt(r.netoCorriente)}{u && ` · US$ ${fmt(u.netoCorriente)}`}</span></div>
                      <div className="flex justify-between font-medium"><span>Activo − pasivo total</span><span>$ {fmt(r.netoTotal)}{u && ` · US$ ${fmt(u.netoTotal)}`}</span></div>
                      {r.desconocidos.length > 0 && <div className="text-red-600">⚠️ Renglones fuera del catálogo (no sumados): {r.desconocidos.join(", ")}</div>}
                      {g ? (
                        <div className="mt-2 rounded bg-emerald-50 p-2 space-y-0.5">
                          <div className="font-semibold">Ganancia {fmtFecha(anterior!.fecha_cierre)} → {fmtFecha(foto.fecha_cierre)}</div>
                          <div className="flex justify-between"><span>Contra pasivo corriente</span><span>$ {fmt(g.pesosCorriente)}{g.usdCorriente != null && ` · US$ ${fmt(g.usdCorriente)}`}</span></div>
                          <div className="flex justify-between"><span>Contra pasivo total</span><span>$ {fmt(g.pesosTotal)}{g.usdTotal != null && ` · US$ ${fmt(g.usdTotal)}`}</span></div>
                        </div>
                      ) : (
                        <div className="text-gray-400">{anterior ? `La foto del ${fmtFecha(anterior.fecha_cierre)} no tiene versión ${v.etiqueta}: no hay ganancia que calcular.` : "Es la primera foto: no hay inicio contra qué comparar."}</div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500">
                Los retiros de socios todavía no se suman al cierre: se agregan cuando se defina el sistema de retiros.
                Los importes van en positivo; el lado (activo o pasivo) lo da el rubro.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
