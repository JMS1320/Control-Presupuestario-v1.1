"use client"

/**
 * Reglas de PARSEO (import) — la tercera solapa de Configuración.
 *
 * ⚠️ No confundir con las otras dos, que son de **conciliación**:
 *
 *   | Tabla                      | Cuándo actúa | Qué hace                                  |
 *   |----------------------------|--------------|-------------------------------------------|
 *   | `config_parseo_extracto`   | al IMPORTAR  | reparte el texto del banco en columnas ←ésta |
 *   | `reglas_conciliacion`      | al conciliar | asigna cuenta contable por texto           |
 *   | `reglas_contable_interno`  | al conciliar | asigna contable / interno                  |
 *
 * Hasta 2026-08-09 esta tabla **no tenía pantalla**: las 49 reglas de PAM se cargaron por SQL.
 *
 * **La unidad de trabajo es el TIPO, no la regla.** Es lo que pidió el usuario y es como funciona
 * de verdad: un movimiento llega con N líneas y hay que decidir qué se hace con cada una. Editar
 * de a una regla obligaba a abrir el modal N veces y a acordarse de qué línea era cuál.
 *
 * Y lo que ya sabemos no se pregunta: el CUIT se reconoce solo y va a su columna, el nombre está
 * antes del CUIT, la línea 1 es el tipo. Todo propuesto y **editable**, incluido *sin asignar* —
 * porque un dato creíble en la columna equivocada es peor que un dato ausente.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, FileWarning, Check, Pencil } from "lucide-react"
import { toast } from "sonner"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { aplicarRegla, proponerMapeo, esCuit, claseDeLinea, type LineaPropuesta } from "@/lib/extractos/parseo-movimiento"

/**
 * Sólo las cuentas cuyo importador desglosa por reglas (Caja de Ahorro). Los ids son los mismos
 * que aceptan `app/api/import-excel-ca` y `app/api/reparsear-extracto`; el nombre se toma de
 * `CUENTAS_BANCARIAS` para que sea idéntico al del selector del modal.
 */
const IDS_CA = ["pam_galicia", "ma_galicia"]
const CUENTAS_CA = IDS_CA.map(id => ({
  id,
  nombre: CUENTAS_BANCARIAS.find(c => c.id === id)?.nombre ?? id,
}))

/** Los cinco modos que sabe aplicar `lib/extractos/parseo-movimiento`. */
const TIPOS_REGLA = [
  { valor: "linea", label: "Línea N" },
  { valor: "cuit", label: "Busca el CUIT" },
  { valor: "pre_cuit", label: "Antes del CUIT" },
  { valor: "post_cuit", label: "Después del CUIT" },
  { valor: "nro_operacion", label: "Nº de operación" },
]

/** Las columnas del extracto que el desglose puede llenar, con lo que va en cada una. */
const CAMPOS_DESTINO = [
  { valor: "descripcion", label: "descripcion — el tipo" },
  { valor: "leyendas_adicionales_1", label: "leyendas_1 — nombre / comercio" },
  { valor: "leyendas_adicionales_2", label: "leyendas_2 — CUIT" },
  { valor: "leyendas_adicionales_3", label: "leyendas_3 — concepto" },
  { valor: "leyendas_adicionales_4", label: "leyendas_4 — libre" },
  { valor: "numero_de_comprobante", label: "nro_comprobante — operación" },
  { valor: "numero_de_terminal", label: "nro_terminal — identificador" },
  { valor: "observaciones_cliente", label: "observaciones_cliente" },
]

/** Cómo se rotula cada contenido reconocido. */
const ROTULO: Record<string, { txt: string; clase: string }> = {
  tipo:          { txt: "tipo",        clase: "bg-gray-100 text-gray-700" },
  cuit:          { txt: "CUIT",        clase: "bg-emerald-100 text-emerald-800" },
  nombre:        { txt: "nombre",      clase: "bg-blue-100 text-blue-800" },
  concepto:      { txt: "concepto",    clase: "bg-blue-50 text-blue-700" },
  operacion:     { txt: "operación",   clase: "bg-violet-100 text-violet-800" },
  cbu:           { txt: "CBU",         clase: "bg-amber-100 text-amber-800" },
  tarjeta:       { txt: "tarjeta",     clase: "bg-amber-100 text-amber-800" },
  autorizacion:  { txt: "autorización",clase: "bg-violet-50 text-violet-700" },
  identificador: { txt: "identificador", clase: "bg-gray-100 text-gray-600" },
}

interface Regla {
  id: string
  cuenta_bancaria_id: string
  tipo_movimiento: string
  campo_destino: string | null
  tipo_regla: string
  numero_linea: number | null
  grupo_de_conceptos: string | null
  orden: number | null
  activo: boolean
}

interface Formato {
  firma: string
  lineas: number
  movimientos: number
  texto: string[]
}

interface TipoInfo {
  tipo: string
  movimientos: number
  conRegla: boolean
  /** Ejemplo de la forma mayoritaria. */
  lineas: string[]
  /** Todas las formas del tipo. Si hay más de una, contar líneas es peligroso. */
  formatos: Formato[]
}

/** Una fila del editor: la línea + a dónde la manda el usuario. */
interface Fila extends LineaPropuesta {
  /** La regla que ya existía para esta línea, si la había. */
  reglaExistente: Regla | null
}

/**
 * A qué línea del ejemplo apunta una regla ya guardada. Sirve para pre-cargar el editor con lo
 * que ya existe en vez de mostrarlo vacío. `-1` = no se pudo ubicar (y entonces no se toca).
 */
function lineaDeRegla(r: Regla, lineas: string[]): number {
  const idxCuit = lineas.findIndex(l => esCuit(l))
  switch (r.tipo_regla) {
    case "linea": return (r.numero_linea ?? 1) - 1
    case "cuit": return idxCuit
    case "pre_cuit": return idxCuit >= 2 ? idxCuit - 1 : -1
    case "post_cuit": return idxCuit >= 0 ? idxCuit + 1 : -1
    case "nro_operacion": return lineas.findIndex(l => /OPERACION|OP:/i.test(l))
  }
  return -1
}

export function ConfiguradorReglasParseo({ cuentaBancariaId }: { cuentaBancariaId?: string }) {
  // La cuenta la elige el selector del modal, que es único para las tres solapas. Tener otro acá
  // sería un segundo mando para lo mismo y podrían quedar apuntando a cuentas distintas.
  const cuenta = cuentaBancariaId ?? ""
  const esCajaDeAhorro = CUENTAS_CA.some(c => c.id === cuenta)

  const [reglas, setReglas] = useState<Regla[]>([])
  const [tipos, setTipos] = useState<TipoInfo[]>([])
  const [cargando, setCargando] = useState(true)

  // Editor de un tipo entero
  const [editando, setEditando] = useState<TipoInfo | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [firmaBase, setFirmaBase] = useState("")
  const [fGrupo, setFGrupo] = useState("")
  const [grupoOriginal, setGrupoOriginal] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!esCajaDeAhorro) { setReglas([]); setTipos([]); setCargando(false); return }
    setCargando(true)
    try {
      const [{ data }, diag] = await Promise.all([
        supabase.from("config_parseo_extracto").select("*")
          .eq("cuenta_bancaria_id", cuenta)
          .order("tipo_movimiento").order("orden"),
        fetch(`/api/reparsear-extracto?cuenta=${cuenta}`).then(r => r.json()).catch(() => null),
      ])
      setReglas((data ?? []) as Regla[])
      setTipos(diag?.ok ? (diag.tipos ?? []) : [])
    } finally {
      setCargando(false)
    }
  }, [cuenta, esCajaDeAhorro])

  useEffect(() => { cargar() }, [cargar])

  const reglasDe = useCallback(
    (tipo: string) => reglas.filter(r => r.tipo_movimiento.toUpperCase() === tipo.toUpperCase()),
    [reglas]
  )

  /** Arma las filas del editor sobre una forma concreta del movimiento. */
  const armarFilas = useCallback((t: TipoInfo, lineas: string[]) => {
    const existentes = reglasDe(t.tipo)
    const propuesta = proponerMapeo(lineas)

    return propuesta.map((p, i) => {
      const ya = existentes.find(r => lineaDeRegla(r, lineas) === i)
      return ya
        // Lo ya guardado manda sobre la propuesta: si el usuario decidió algo, se respeta.
        ? { ...p, campo: ya.campo_destino ?? "", modo: ya.tipo_regla, reglaExistente: ya, seguro: true,
            motivo: "Ya estaba configurado así" }
        : { ...p, reglaExistente: null }
    }) as Fila[]
  }, [reglasDe])

  /** Abre el editor del tipo sobre su forma mayoritaria. */
  const abrirTipo = (t: TipoInfo) => {
    const forma = t.formatos?.[0]
    setFilas(armarFilas(t, forma?.texto ?? t.lineas))
    setFirmaBase(forma?.firma ?? "")
    const grupo = reglasDe(t.tipo)[0]?.grupo_de_conceptos ?? ""
    setFGrupo(grupo)
    setGrupoOriginal(grupo)
    setEditando(t)
  }

  /** Cambia la forma sobre la que se está trabajando, conservando lo ya guardado. */
  const cambiarFormato = (firma: string) => {
    if (!editando) return
    const f = editando.formatos.find(x => x.firma === firma)
    if (!f) return
    setFilas(armarFilas(editando, f.texto))
    setFirmaBase(firma)
  }

  const cambiarFila = (i: number, cambio: Partial<Fila>) =>
    setFilas(f => f.map((x, j) => (j === i ? { ...x, ...cambio } : x)))

  /** Reglas que existen pero no se pudieron ubicar en ninguna línea del ejemplo: no se tocan. */
  const huerfanas = useMemo(() => {
    if (!editando) return []
    const ubicadas = new Set(filas.map(f => f.reglaExistente?.id).filter(Boolean))
    return reglasDe(editando.tipo).filter(r => !ubicadas.has(r.id))
  }, [editando, filas, reglasDe])

  // Resumen de lo que va a pasar al guardar. Se muestra ANTES de tocar nada.
  const plan = useMemo(() => {
    const alta = filas.filter(f => f.campo && !f.reglaExistente).length
    const cambio = filas.filter(f => f.campo && f.reglaExistente &&
      (f.reglaExistente.campo_destino !== f.campo || f.reglaExistente.tipo_regla !== f.modo)).length
    const baja = filas.filter(f => !f.campo && f.reglaExistente).length
    // Cambiar sólo el grupo también es un cambio: si no contara, el botón quedaría deshabilitado
    const soloGrupo = fGrupo.trim() !== grupoOriginal.trim()
    return { alta, cambio, baja, soloGrupo, total: alta + cambio + baja + (soloGrupo ? 1 : 0) }
  }, [filas, fGrupo, grupoOriginal])

  const guardar = async () => {
    if (!editando) return
    setGuardando(true)
    try {
      const tipo = editando.tipo.toUpperCase()
      const grupo = fGrupo.trim() || null
      let orden = 0

      for (const f of filas) {
        if (!f.campo) {
          // Sin asignar: si había una regla para esa línea, se borra — es la decisión del usuario
          if (f.reglaExistente) {
            const { error } = await supabase.from("config_parseo_extracto").delete().eq("id", f.reglaExistente.id)
            if (error) throw error
          }
          continue
        }
        orden++
        const fila = {
          cuenta_bancaria_id: cuenta,
          // En MAYÚSCULA: el match contra el texto del banco es exacto, y así no quedan dos
          // reglas del mismo tipo escritas distinto.
          tipo_movimiento: tipo,
          campo_destino: f.campo,
          tipo_regla: f.modo,
          numero_linea: f.modo === "linea" ? f.numero : null,
          grupo_de_conceptos: grupo,
          orden,
          activo: true,
        }
        const { error } = f.reglaExistente
          ? await supabase.from("config_parseo_extracto").update(fila).eq("id", f.reglaExistente.id)
          : await supabase.from("config_parseo_extracto").insert(fila)
        if (error) throw error
      }

      // El grupo es del TIPO entero, así que se alinea en TODAS sus reglas — también en las que
      // no se pudieron ubicar en el ejemplo. Si no, quedarían dos grupos para el mismo tipo y el
      // parseo tomaría el de la primera regla, que es un empate resuelto por orden de carga.
      if (huerfanas.length > 0) {
        await supabase.from("config_parseo_extracto")
          .update({ grupo_de_conceptos: grupo })
          .in("id", huerfanas.map(r => r.id))
      }

      toast.success(
        `${tipo}: ${plan.alta} nueva(s), ${plan.cambio} cambiada(s), ${plan.baja} borrada(s)` +
        " — corré «Re-parsear» para aplicarlo a lo ya importado"
      )
      setEditando(null)
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const borrarTipo = async (t: TipoInfo) => {
    const rs = reglasDe(t.tipo)
    if (!window.confirm(`¿Eliminar las ${rs.length} reglas de ${t.tipo}?\n\nLos movimientos ya importados no cambian hasta que corras Re-parsear.`)) return
    const { error } = await supabase.from("config_parseo_extracto").delete().in("id", rs.map(r => r.id))
    if (error) { toast.error("Error: " + error.message); return }
    toast.success(`Reglas de ${t.tipo} eliminadas`)
    cargar()
  }

  // ── Las cuentas corrientes no usan estas reglas: su export del banco YA viene con las columnas
  // separadas, así que no hay nada que desglosar.
  if (!esCajaDeAhorro) {
    return (
      <div className="rounded border bg-gray-50 p-6 text-center">
        <FileWarning className="mx-auto mb-2 h-6 w-6 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">Esta cuenta no usa reglas de parseo</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs text-gray-500">
          Las <strong>cuentas corrientes</strong> ya vienen del banco con las columnas separadas, así
          que no hay nada que desglosar. Estas reglas son sólo para <strong>Caja de Ahorro</strong>,
          donde el banco manda todo apilado en una celda.
        </p>
        <p className="mt-2.5 text-xs text-gray-500">
          Cuentas con parseo: {CUENTAS_CA.map(c => c.nombre).join(" · ")} — elegilas en el selector de arriba.
        </p>
      </div>
    )
  }

  const sinRegla = tipos.filter(t => !t.conRegla)
  const conRegla = tipos.filter(t => t.conRegla)
  // Reglas de tipos que hoy no tienen ningún movimiento cargado: no hay ejemplo que mostrar
  const tiposPresentes = new Set(tipos.map(t => t.tipo.toUpperCase()))
  const reglasSinMovimientos = reglas.filter(r => !tiposPresentes.has(r.tipo_movimiento.toUpperCase()))

  const formatos = editando?.formatos ?? []

  /** El bloque de líneas del ejemplo, numerado. */
  const Ejemplo = ({ lineas }: { lineas: string[] }) => (
    <div className="rounded bg-gray-50 p-2 font-mono text-[11px] leading-5 text-gray-700">
      {lineas.map((l, i) => (
        <div key={i}>
          <span className="mr-2 inline-block w-4 text-right text-gray-400">{i + 1}</span>{l}
        </div>
      ))}
    </div>
  )

  /**
   * Todas las formas del tipo, no una sola. Mostrar un único ejemplo fue lo que dejó escribir
   * reglas por número de línea que fallan en la otra forma (PENDIENTES § A-BUG-17).
   */
  const Formas = ({ t }: { t: TipoInfo }) => {
    const fs = t.formatos ?? []
    if (fs.length <= 1) return <Ejemplo lineas={t.lineas} />
    return (
      <div className="space-y-1.5">
        {fs.map(f => (
          <div key={f.firma}>
            <p className="mb-0.5 text-[10px] text-amber-700">
              forma de {f.lineas} líneas · {f.movimientos} movimiento{f.movimientos === 1 ? "" : "s"}
            </p>
            <Ejemplo lineas={f.texto} />
          </div>
        ))}
      </div>
    )
  }

  /** Chip de aviso cuando el tipo tiene más de una forma. */
  const ChipFormas = ({ t }: { t: TipoInfo }) =>
    (t.formatos?.length ?? 0) > 1 ? (
      <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-800">
        {t.formatos.length} formas
      </Badge>
    ) : null

  return (
    <div className="space-y-4">
      {cargando ? (
        <div className="flex items-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Lo que falta, primero: es la razón por la que se entra a esta pantalla */}
          {sinRegla.length > 0 && (
            <Card className="border-sky-300 bg-sky-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-sky-900">
                  <FileWarning className="h-4 w-4" />
                  {sinRegla.length} tipo{sinRegla.length === 1 ? "" : "s"} sin regla
                </CardTitle>
                <p className="text-xs text-gray-600">
                  Entraron con el texto completo pero sin desglosar. Ordenados por cantidad: el
                  primero es el que más rinde escribir.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {sinRegla.map(t => (
                  <div key={t.tipo} className="rounded border bg-white p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium text-gray-800">{t.tipo}</span>
                      <Badge variant="outline" className="text-[10px]">{t.movimientos} mov.</Badge>
                      <ChipFormas t={t} />
                      <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => abrirTipo(t)}>
                        <Plus className="mr-1 h-3 w-3" /> Configurar {t.lineas.length} línea{t.lineas.length === 1 ? "" : "s"}
                      </Button>
                    </div>
                    {t.lineas.length > 0 && <div className="mt-1.5"><Formas t={t} /></div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Las reglas que ya existen — CON su ejemplo y lo que extrae cada una */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-600" />
                {reglas.length} regla{reglas.length === 1 ? "" : "s"} en{" "}
                {new Set(reglas.map(r => r.tipo_movimiento.toUpperCase())).size} tipo(s)
              </CardTitle>
              <p className="text-xs text-gray-600">
                Con un movimiento real de cada tipo y lo que la regla saca de él.
              </p>
            </CardHeader>
            <CardContent>
              {reglas.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  Esta cuenta no tiene ninguna regla: nada se desglosa.
                </p>
              ) : (
                <div className="space-y-3">
                  {conRegla.map(t => {
                    const rs = reglasDe(t.tipo)
                    return (
                      <div key={t.tipo} className="rounded border">
                        <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-2.5 py-1.5">
                          <span className="font-mono text-xs font-medium">{t.tipo}</span>
                          <Badge variant="outline" className="text-[10px]">{t.movimientos} mov.</Badge>
                          <ChipFormas t={t} />
                          {rs[0]?.grupo_de_conceptos && (
                            <Badge variant="outline" className="text-[10px]">{rs[0].grupo_de_conceptos}</Badge>
                          )}
                          <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => abrirTipo(t)}>
                            <Pencil className="mr-1 h-3 w-3" /> Editar
                          </Button>
                          <button className="text-red-500 hover:text-red-700" title="Eliminar las reglas de este tipo"
                            onClick={() => borrarTipo(t)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Ejemplo real a la izquierda, lo que produce a la derecha */}
                        <div className="grid gap-2.5 p-2.5 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">
                              {(t.formatos?.length ?? 0) > 1 ? "Las formas que llegan" : "Un movimiento real"}
                            </p>
                            <Formas t={t} />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">Lo que guardan las reglas</p>
                            <table className="w-full font-mono text-[11px] leading-5">
                              <tbody>
                                {rs.map(r => {
                                  // Cada regla se evalúa en TODAS las formas del tipo: si trae
                                  // clases distintas, la fila se marca en ámbar.
                                  const fs = t.formatos?.length
                                    ? t.formatos
                                    : [{ firma: "u", lineas: t.lineas.length, movimientos: t.movimientos, texto: t.lineas }]
                                  const vals = fs.map(fm => ({
                                    fm,
                                    valor: aplicarRegla(fm.texto, {
                                      campo_destino: r.campo_destino, tipo_regla: r.tipo_regla,
                                      numero_linea: r.numero_linea, grupo_de_conceptos: "",
                                    }),
                                  }))
                                  const clases = new Set(vals.map(v => (v.valor ? claseDeLinea(v.valor, 1) : "vacio")))
                                  const discrepa = vals.length > 1 && clases.size > 1
                                  return (
                                    <tr key={r.id} className={discrepa ? "bg-amber-50" : ""}>
                                      <td className="pr-2 align-top text-gray-500">{r.campo_destino}</td>
                                      <td className="align-top font-medium text-gray-800">
                                        {vals.map(v => (
                                          <div key={v.fm.firma} className="flex gap-1.5">
                                            {vals.length > 1 && (
                                              <span className="shrink-0 text-[10px] font-normal text-gray-400">{v.fm.lineas}L</span>
                                            )}
                                            {v.valor
                                              ? <span className={discrepa ? "text-amber-800" : ""}>{v.valor}</span>
                                              : <span className="font-normal italic text-red-500">vacío</span>}
                                          </div>
                                        ))}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Reglas de tipos que hoy no tienen movimientos: existen pero no trabajan */}
                  {reglasSinMovimientos.length > 0 && (
                    <details className="rounded border bg-gray-50 px-2.5 py-2">
                      <summary className="cursor-pointer text-xs text-gray-600">
                        {reglasSinMovimientos.length} regla(s) de tipos que <strong>no aparecen</strong> en
                        los movimientos cargados — sin ejemplo que mostrar
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {[...new Set(reglasSinMovimientos.map(r => r.tipo_movimiento))].map(t => (
                          <span key={t} className="rounded border bg-white px-1.5 font-mono text-[10px] leading-5 text-gray-600">{t}</span>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-[11px] text-gray-500">
            Una regla nueva <strong>no cambia sola</strong> lo ya importado: hay que correr
            <strong> Re-parsear</strong> en Extracto Bancario. Se puede probar en seco antes de aplicar.
          </p>
        </>
      )}

      {/* ── Editor del tipo: una fila por línea del movimiento ───────────────── */}
      <Dialog open={!!editando} onOpenChange={v => !v && setEditando(null)}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{editando?.tipo}</DialogTitle>
          </DialogHeader>

          {formatos.length > 1 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2">
              <p className="text-xs font-medium text-amber-900">
                Este tipo llega con {formatos.length} formas distintas
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
                Las reglas son las mismas para todas, así que <strong>contar líneas es riesgoso</strong>:
                la línea 5 puede ser una cosa en una forma y otra en otra. Los modos que
                <strong> buscan</strong> (CUIT, antes/después del CUIT) sirven para todas.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-amber-900">Estoy mirando:</span>
                {formatos.map(fm => (
                  <button key={fm.firma} onClick={() => cambiarFormato(fm.firma)}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${
                      fm.firma === firmaBase
                        ? "border-amber-500 bg-white font-medium text-amber-900"
                        : "border-amber-200 bg-amber-100/60 text-amber-800 hover:bg-white"}`}>
                    {fm.lineas} líneas · {fm.movimientos} mov.
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="-mt-1 text-xs text-gray-600">
            Una fila por línea del movimiento. Lo que el banco escribe siempre igual
            —el CUIT, el nombre antes del CUIT, el tipo en la línea 1— ya viene propuesto;
            el resto decidilo vos. <strong>Sin asignar</strong> también es una decisión válida.
          </p>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Lo que dice el banco</th>
                  <th className="px-2 py-1.5 font-medium">Cómo se extrae</th>
                  <th className="px-2 py-1.5 font-medium">Va a la columna</th>
                  <th className="px-2 py-1.5 font-medium">Quedaría</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const rot = ROTULO[f.contenido]
                  // La regla se prueba contra CADA forma del tipo, no sólo contra la que está a la
                  // vista. Es el punto entero de A-FEAT-18: una regla `linea 5` puede traer la
                  // tarjeta en una forma y el nombre del banco en otra, y hasta ahora eso no se veia.
                  const previas = f.campo
                    ? formatos.map(fm => ({
                        fm,
                        valor: aplicarRegla(fm.texto, {
                          campo_destino: f.campo, tipo_regla: f.modo,
                          numero_linea: f.numero, grupo_de_conceptos: "",
                        }),
                      }))
                    : []
                  // Discrepa si en una forma saca una clase de dato y en otra, otra (o nada)
                  const clases = new Set(previas.map(p => (p.valor ? claseDeLinea(p.valor, 1) : "vacio")))
                  const discrepa = previas.length > 1 && clases.size > 1
                  const alerta = f.campo === "leyendas_adicionales_2" && f.modo !== "cuit"
                  return (
                    <tr key={i} className={`border-t align-top ${f.campo ? "" : "bg-gray-50/60"}`}>
                      <td className="px-2 py-2 font-mono text-gray-400">{f.numero}</td>
                      <td className="px-2 py-2">
                        <div className="font-mono text-[11px] text-gray-800">{f.texto}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {rot && <span className={`rounded px-1 text-[10px] leading-4 ${rot.clase}`}>{rot.txt}</span>}
                          {!f.seguro && f.contenido && <span className="text-[10px] text-gray-400">sugerido</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] leading-4 text-gray-400">{f.motivo}</p>
                      </td>
                      <td className="px-2 py-2">
                        <select className="w-full rounded border bg-white px-1.5 py-1 text-[11px]"
                          value={f.modo} onChange={e => cambiarFila(i, { modo: e.target.value })}
                          disabled={!f.campo}>
                          {TIPOS_REGLA.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select className="w-full rounded border bg-white px-1.5 py-1 text-[11px]"
                          value={f.campo} onChange={e => cambiarFila(i, { campo: e.target.value })}>
                          <option value="">— sin asignar —</option>
                          {CAMPOS_DESTINO.map(c => <option key={c.valor} value={c.valor}>{c.label}</option>)}
                        </select>
                        {alerta && (
                          <p className="mt-1 text-[10px] leading-4 text-amber-700">
                            ⚠ Es la columna del CUIT y el motor compara exacto. Con «Busca el CUIT»
                            no puede traer el CBU por error.
                          </p>
                        )}
                      </td>
                      <td className={`px-2 py-2 font-mono text-[11px] ${discrepa ? "bg-amber-50" : ""}`}>
                        {!f.campo ? (
                          <span className="text-gray-400">—</span>
                        ) : previas.length === 1 ? (
                          previas[0].valor
                            ? <span className="font-medium text-emerald-700">{previas[0].valor}</span>
                            : <span className="text-red-600">vacío</span>
                        ) : (
                          <div className="space-y-0.5">
                            {previas.map(p => (
                              <div key={p.fm.firma} className="flex gap-1.5">
                                <span className="shrink-0 text-[10px] text-gray-400">
                                  {p.fm.lineas}L·{p.fm.movimientos}
                                </span>
                                {p.valor
                                  ? <span className={discrepa ? "text-amber-800" : "font-medium text-emerald-700"}>{p.valor}</span>
                                  : <span className="text-red-600">vacío</span>}
                              </div>
                            ))}
                            {discrepa && (
                              <p className="pt-0.5 text-[10px] leading-4 text-amber-700">
                                ⚠ Trae cosas distintas según la forma. Probá un modo que
                                <strong> busque</strong> en vez de contar líneas.
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {huerfanas.length > 0 && (
            <p className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              {huerfanas.length} regla(s) de este tipo apuntan a líneas que este movimiento no tiene
              (otro movimiento puede tenerlas). <strong>No se tocan</strong> al guardar.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label className="text-xs">Grupo de conceptos <span className="text-gray-400">— del tipo entero</span></Label>
              <Input className="mt-1" value={fGrupo} onChange={e => setFGrupo(e.target.value)}
                list="grupos-conceptos-usados" placeholder="Ej: Transferencias" />
              <datalist id="grupos-conceptos-usados">
                {[...new Set(reglas.map(r => r.grupo_de_conceptos).filter(Boolean))].map(g =>
                  <option key={g as string} value={g as string} />)}
              </datalist>
            </div>
            <p className="flex-1 text-[11px] leading-4 text-gray-500">
              {plan.total === 0
                ? "Nada para guardar todavía."
                : `Al guardar: ${plan.alta} regla(s) nueva(s), ${plan.cambio} cambiada(s), ${plan.baja} borrada(s)`
                  + (plan.soloGrupo ? ", y el grupo del tipo." : ".")}
              <br />No modifica lo ya importado — para eso está <strong>Re-parsear</strong>.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando || plan.total === 0}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Guardar {plan.total > 0 ? `(${plan.total})` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
