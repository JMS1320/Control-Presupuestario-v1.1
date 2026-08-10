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
 * **La unidad de trabajo es la FORMA, no el tipo.** Un mismo tipo de movimiento llega escrito de
 * maneras distintas —`TRANSFERENCIA A TERCEROS` viene en 3— y las reglas que cuentan líneas sólo
 * valen dentro de una forma. Cada forma se configura por separado, con su propio ejemplo real.
 *
 * Lo que ya sabemos no se pregunta: el CUIT se reconoce solo y va a su columna, el nombre está
 * antes del CUIT, el CBU son 22 dígitos, el banco empieza con «BANCO». Todo propuesto y
 * **editable**, incluido *sin asignar* — porque un dato creíble en la columna equivocada es peor
 * que un dato ausente.
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
import { aplicarRegla, proponerMapeo, esCuit, COLUMNA_CBU, type LineaPropuesta } from "@/lib/extractos/parseo-movimiento"

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

/** Los modos que sabe aplicar `lib/extractos/parseo-movimiento`. */
const TIPOS_REGLA = [
  { valor: "linea", label: "Línea N" },
  { valor: "cuit", label: "Busca el CUIT" },
  { valor: "cbu", label: "Busca el CBU" },
  { valor: "tarjeta", label: "Busca la tarjeta" },
  { valor: "pre_cuit", label: "Antes del CUIT" },
  { valor: "post_cuit", label: "Después del CUIT" },
  { valor: "nro_operacion", label: "Nº de operación" },
]

/**
 * Las columnas del extracto, rotuladas por **lo que guardan**, no por su nombre técnico.
 * La convención salió de medir los 849 movimientos de MSA → `ARQUITECTURA-BD.md` § 6b.
 */
const CAMPOS_DESTINO = [
  { valor: "descripcion", label: "El tipo de movimiento" },
  { valor: "leyendas_adicionales_1", label: "Nombre / comercio" },
  { valor: "leyendas_adicionales_2", label: "CUIT" },
  { valor: "leyendas_adicionales_3", label: "Concepto" },
  { valor: "leyendas_adicionales_4", label: "Banco de la contraparte" },
  { valor: "numero_de_comprobante", label: "Nº de operación / autorización" },
  { valor: "numero_de_terminal", label: "Terminal / identificador" },
  // Guarda el CBU pese al nombre de la columna: es la única de las 37 sin dueño.
  // Acordado con el usuario 2026-08-10 → ARQUITECTURA-BD § 6b.
  { valor: COLUMNA_CBU, label: "CBU" },
]

const etiquetaCampo = (v: string | null) =>
  CAMPOS_DESTINO.find(c => c.valor === v)?.label ?? v ?? ""

/** Cómo se rotula cada contenido reconocido. */
const ROTULO: Record<string, { txt: string; clase: string }> = {
  tipo:          { txt: "tipo",         clase: "bg-gray-100 text-gray-700" },
  cuit:          { txt: "CUIT",         clase: "bg-emerald-100 text-emerald-800" },
  nombre:        { txt: "nombre",       clase: "bg-blue-100 text-blue-800" },
  concepto:      { txt: "concepto",     clase: "bg-blue-50 text-blue-700" },
  operacion:     { txt: "operación",    clase: "bg-violet-100 text-violet-800" },
  cbu:           { txt: "CBU",          clase: "bg-teal-100 text-teal-800" },
  banco:         { txt: "banco",        clase: "bg-slate-100 text-slate-700" },
  tarjeta:       { txt: "tarjeta",      clase: "bg-amber-100 text-amber-800" },
  autorizacion:  { txt: "autorización", clase: "bg-violet-50 text-violet-700" },
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
  /** Forma a la que aplica. `null` = a todas (reglas viejas, previas a la columna). */
  firma_forma?: string | null
}

interface Formato {
  firma: string
  lineas: number
  movimientos: number
  texto: string[]
  /** `false` = el tipo tiene reglas por forma y ninguna es de ésta → NO se parsea. */
  cubierto: boolean
}

interface TipoInfo {
  tipo: string
  movimientos: number
  conRegla: boolean
  lineas: string[]
  formatos: Formato[]
}

/** Una fila del editor: la línea + a dónde la manda el usuario. */
interface Fila extends LineaPropuesta {
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
    case "cbu": return lineas.findIndex(l => /^\d{22}$/.test(l.trim()))
    case "tarjeta": return lineas.findIndex(l => /X{4,}/i.test(l) && /\d/.test(l))
    case "nro_operacion": return lineas.findIndex(l => /OPERACION|OP:/i.test(l))
  }
  return -1
}

export function ConfiguradorReglasParseo({ cuentaBancariaId }: { cuentaBancariaId?: string }) {
  // La cuenta la elige el selector del modal, que es único para las tres solapas.
  const cuenta = cuentaBancariaId ?? ""
  const esCajaDeAhorro = CUENTAS_CA.some(c => c.id === cuenta)

  const [reglas, setReglas] = useState<Regla[]>([])
  const [tipos, setTipos] = useState<TipoInfo[]>([])
  const [cargando, setCargando] = useState(true)

  // Editor de UNA forma de un tipo
  const [editando, setEditando] = useState<{ tipo: TipoInfo; forma: Formato } | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
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

  /** Las reglas que aplican a una forma: las suyas, más las viejas sin firma. */
  const reglasDeForma = useCallback(
    (tipo: string, firma: string) =>
      reglasDe(tipo).filter(r => !r.firma_forma || r.firma_forma === firma),
    [reglasDe]
  )

  /** Abre el editor de UNA forma: propone lo que sabemos y pre-carga lo que ya existe. */
  const abrirForma = (t: TipoInfo, forma: Formato) => {
    const existentes = reglasDeForma(t.tipo, forma.firma)
    const filasNuevas: Fila[] = proponerMapeo(forma.texto).map((p, i) => {
      const ya = existentes.find(r => lineaDeRegla(r, forma.texto) === i)
      return ya
        // Lo ya guardado manda sobre la propuesta: si el usuario decidió algo, se respeta.
        ? { ...p, campo: ya.campo_destino ?? "", modo: ya.tipo_regla, reglaExistente: ya,
            seguro: true, motivo: "Ya estaba configurado así" }
        : { ...p, reglaExistente: null }
    })
    setFilas(filasNuevas)
    const grupo = reglasDe(t.tipo)[0]?.grupo_de_conceptos ?? ""
    setFGrupo(grupo)
    setGrupoOriginal(grupo)
    setEditando({ tipo: t, forma })
  }

  const cambiarFila = (i: number, cambio: Partial<Fila>) =>
    setFilas(fs => fs.map((x, j) => (j === i ? { ...x, ...cambio } : x)))

  /** Reglas de esta forma que no se pudieron ubicar en ninguna línea: no se tocan. */
  const huerfanas = useMemo(() => {
    if (!editando) return []
    const ubicadas = new Set(filas.map(f => f.reglaExistente?.id).filter(Boolean))
    return reglasDeForma(editando.tipo.tipo, editando.forma.firma).filter(r => !ubicadas.has(r.id))
  }, [editando, filas, reglasDeForma])

  const plan = useMemo(() => {
    const firma = editando?.forma.firma ?? ""
    const alta = filas.filter(f => f.campo && !f.reglaExistente).length
    const cambio = filas.filter(f => f.campo && f.reglaExistente && (
      f.reglaExistente.campo_destino !== f.campo ||
      f.reglaExistente.tipo_regla !== f.modo ||
      (f.reglaExistente.firma_forma ?? null) !== firma
    )).length
    const baja = filas.filter(f => !f.campo && f.reglaExistente).length
    const soloGrupo = fGrupo.trim() !== grupoOriginal.trim()
    return { alta, cambio, baja, soloGrupo, total: alta + cambio + baja + (soloGrupo ? 1 : 0) }
  }, [filas, fGrupo, grupoOriginal, editando])

  const guardar = async () => {
    if (!editando) return
    setGuardando(true)
    try {
      const tipo = editando.tipo.tipo.toUpperCase()
      const firma = editando.forma.firma
      const grupo = fGrupo.trim() || null
      let orden = 0

      for (const f of filas) {
        if (!f.campo) {
          // Sin asignar: si había una regla para esa línea, se borra — decisión del usuario
          if (f.reglaExistente) {
            const { error } = await supabase.from("config_parseo_extracto").delete().eq("id", f.reglaExistente.id)
            if (error) throw error
          }
          continue
        }
        orden++
        const fila = {
          cuenta_bancaria_id: cuenta,
          // En MAYÚSCULA: el match contra el texto del banco es exacto.
          tipo_movimiento: tipo,
          campo_destino: f.campo,
          tipo_regla: f.modo,
          numero_linea: f.modo === "linea" ? f.numero : null,
          grupo_de_conceptos: grupo,
          // Toda regla queda atada a SU forma. Si mañana el banco manda una forma distinta, no
          // se parsea y se ve — en vez de desglosarse con las reglas de otra.
          firma_forma: firma,
          orden,
          activo: true,
        }
        const { error } = f.reglaExistente
          ? await supabase.from("config_parseo_extracto").update(fila).eq("id", f.reglaExistente.id)
          : await supabase.from("config_parseo_extracto").insert(fila)
        if (error) throw error
      }

      // El grupo de conceptos es del TIPO, no de la forma: se alinea en todas sus reglas. Si no,
      // el mismo tipo tendría dos grupos y el parseo tomaría el de la primera regla cargada.
      const otras = reglasDe(tipo).filter(r => !filas.some(f => f.reglaExistente?.id === r.id))
      if (otras.length > 0) {
        await supabase.from("config_parseo_extracto")
          .update({ grupo_de_conceptos: grupo }).in("id", otras.map(r => r.id))
      }

      toast.success(
        `${tipo} · forma de ${editando.forma.lineas} líneas: ${plan.alta} nueva(s), ` +
        `${plan.cambio} cambiada(s), ${plan.baja} borrada(s) — corré «Re-parsear» para aplicarlo`
      )
      setEditando(null)
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const borrarReglasDeForma = async (t: TipoInfo, forma: Formato) => {
    const rs = reglasDe(t.tipo).filter(r => r.firma_forma === forma.firma)
    if (rs.length === 0) return
    if (!window.confirm(
      `¿Eliminar las ${rs.length} reglas de la forma de ${forma.lineas} líneas de ${t.tipo}?\n\n` +
      `Sus ${forma.movimientos} movimiento(s) dejarán de desglosarse. Lo ya importado no cambia ` +
      `hasta que corras Re-parsear.`
    )) return
    const { error } = await supabase.from("config_parseo_extracto").delete().in("id", rs.map(r => r.id))
    if (error) { toast.error("Error: " + error.message); return }
    toast.success("Reglas eliminadas")
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

  // Una entrada por FORMA, que es la unidad real de configuración
  const formasPendientes = tipos.flatMap(t =>
    t.formatos.filter(f => reglasDeForma(t.tipo, f.firma).length === 0).map(f => ({ t, f }))
  ).sort((a, b) => b.f.movimientos - a.f.movimientos)

  const totalFormas = tipos.reduce((n, t) => n + t.formatos.length, 0)
  const tiposPresentes = new Set(tipos.map(t => t.tipo.toUpperCase()))
  const reglasSinMovimientos = reglas.filter(r => !tiposPresentes.has(r.tipo_movimiento.toUpperCase()))

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

  /** Una forma: su ejemplo real a la izquierda y lo que producen sus reglas a la derecha. */
  const BloqueForma = ({ t, f }: { t: TipoInfo; f: Formato }) => {
    const rs = reglasDeForma(t.tipo, f.firma)
    const sinReglas = rs.length === 0
    return (
      <div className={`rounded border ${sinReglas ? "border-sky-300 bg-sky-50/40" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 border-b px-2.5 py-1.5">
          <span className="text-xs font-medium text-gray-700">
            Forma de {f.lineas} líneas
          </span>
          <Badge variant="outline" className="text-[10px]">{f.movimientos} mov.</Badge>
          {sinReglas
            ? <Badge variant="outline" className="border-sky-400 bg-white text-[10px] text-sky-800">sin reglas — no se desglosa</Badge>
            : <Badge variant="outline" className="border-emerald-400 bg-white text-[10px] text-emerald-800">{rs.length} regla{rs.length === 1 ? "" : "s"}</Badge>}
          <Button size="sm" variant={sinReglas ? "outline" : "ghost"} className="ml-auto h-7 text-xs"
            onClick={() => abrirForma(t, f)}>
            {sinReglas
              ? <><Plus className="mr-1 h-3 w-3" /> Configurar {f.lineas} líneas</>
              : <><Pencil className="mr-1 h-3 w-3" /> Editar</>}
          </Button>
          {rs.some(r => r.firma_forma === f.firma) && (
            <button className="text-red-500 hover:text-red-700" title="Eliminar las reglas de esta forma"
              onClick={() => borrarReglasDeForma(t, f)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid gap-2.5 p-2.5 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">Un movimiento real</p>
            <Ejemplo lineas={f.texto} />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">Lo que queda guardado</p>
            {sinReglas ? (
              <p className="py-2 text-[11px] italic text-gray-400">
                Nada: estos movimientos entran con el texto completo, sin desglosar.
              </p>
            ) : (
              <table className="w-full text-[11px] leading-5">
                <tbody>
                  {rs.map(r => {
                    const valor = aplicarRegla(f.texto, {
                      campo_destino: r.campo_destino, tipo_regla: r.tipo_regla,
                      numero_linea: r.numero_linea, grupo_de_conceptos: "",
                    })
                    return (
                      <tr key={r.id}>
                        <td className="pr-2 align-top text-gray-500">{etiquetaCampo(r.campo_destino)}</td>
                        <td className="align-top font-mono font-medium text-gray-800">
                          {valor || <span className="font-sans font-normal italic text-red-500">vacío</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {cargando ? (
        <div className="flex items-center gap-2 py-8 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {formasPendientes.length > 0 && (
            <Card className="border-sky-300 bg-sky-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-sky-900">
                  <FileWarning className="h-4 w-4" />
                  {formasPendientes.length} forma{formasPendientes.length === 1 ? "" : "s"} sin reglas
                </CardTitle>
                <p className="text-xs text-gray-600">
                  Sus movimientos entran con el texto completo pero sin desglosar. Ordenadas por
                  cantidad: la primera es la que más rinde escribir.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {formasPendientes.map(({ t, f }) => (
                    <button key={t.tipo + f.firma} onClick={() => abrirForma(t, f)}
                      className="rounded border border-sky-300 bg-white px-2 py-1 text-left text-[11px] hover:border-sky-500">
                      <span className="font-mono font-medium text-gray-800">{t.tipo}</span>
                      <span className="ml-1.5 text-gray-500">{f.lineas} líneas · {f.movimientos} mov.</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-600" />
                {tipos.length} tipo(s) · {totalFormas} forma(s) · {reglas.length} regla(s)
              </CardTitle>
              <p className="text-xs text-gray-600">
                Cada forma se configura por separado, con su ejemplo real al lado de lo que produce.
                El <strong>grupo de conceptos</strong> es del tipo entero.
              </p>
            </CardHeader>
            <CardContent>
              {tipos.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  No hay movimientos importados en esta cuenta.
                </p>
              ) : (
                <div className="space-y-4">
                  {tipos.map(t => {
                    const grupo = reglasDe(t.tipo)[0]?.grupo_de_conceptos
                    return (
                      <div key={t.tipo}>
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium text-gray-900">{t.tipo}</span>
                          <Badge variant="outline" className="text-[10px]">{t.movimientos} mov.</Badge>
                          {t.formatos.length > 1 && (
                            <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-800">
                              {t.formatos.length} formas
                            </Badge>
                          )}
                          {grupo && <Badge variant="outline" className="text-[10px]">{grupo}</Badge>}
                        </div>
                        <div className="space-y-2 border-l-2 border-gray-200 pl-2.5">
                          {t.formatos.map(f => <BloqueForma key={f.firma} t={t} f={f} />)}
                        </div>
                      </div>
                    )
                  })}

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

          <p className="text-[11px] leading-4 text-gray-500">
            Una regla nueva <strong>no cambia sola</strong> lo ya importado: hay que correr
            <strong> Re-parsear</strong> en Extracto Bancario, que se puede probar en seco antes de aplicar.
          </p>
        </>
      )}

      {/* ── Editor de una forma: una fila por línea del movimiento ───────────── */}
      <Dialog open={!!editando} onOpenChange={v => !v && setEditando(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{editando?.tipo.tipo}</DialogTitle>
          </DialogHeader>

          <div className="-mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <Badge variant="outline" className="text-[10px]">
              forma de {editando?.forma.lineas} líneas · {editando?.forma.movimientos} mov.
            </Badge>
            {(editando?.tipo.formatos.length ?? 0) > 1 && (
              <span className="text-[11px] text-amber-700">
                Este tipo tiene {editando?.tipo.formatos.length} formas — estas reglas valen sólo para ésta.
              </span>
            )}
          </div>

          {/* Las reglas viejas (sin forma) valían para TODAS. Al guardarlas acá quedan atadas a
              ésta, y las otras formas se quedan sin nada. Es correcto, pero tiene que avisarse
              ANTES de guardar: si no, el usuario ve desaparecer el desglose de movimientos que
              no tocó y no sabe por qué. */}
          {(editando?.tipo.formatos.length ?? 0) > 1 &&
           filas.some(f => f.reglaExistente && !f.reglaExistente.firma_forma) && (
            <div className="rounded border border-amber-400 bg-amber-50 px-2.5 py-2">
              <p className="text-xs font-medium text-amber-900">
                ⚠ Ojo: hay reglas que hoy valen para las {editando?.tipo.formatos.length} formas
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
                Al guardar quedan atadas <strong>sólo a esta forma</strong>. Las otras
                {" "}{(editando?.tipo.formatos.length ?? 1) - 1} se quedan sin reglas y sus movimientos
                dejan de desglosarse hasta que las configures. Conviene <strong>terminar el tipo
                entero</strong> de una sentada.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-600">
            Una fila por línea. Lo que el banco escribe siempre igual —el CUIT, el CBU, el nombre
            antes del CUIT, el banco— ya viene propuesto; el resto decidilo vos.
            <strong> Sin asignar</strong> también es una decisión válida.
          </p>

          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">Lo que dice el banco</th>
                  <th className="px-2 py-1.5 font-medium">Cómo se extrae</th>
                  <th className="px-2 py-1.5 font-medium">Se guarda como</th>
                  <th className="px-2 py-1.5 font-medium">Quedaría</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const rot = ROTULO[f.contenido]
                  const previa = f.campo
                    ? aplicarRegla(filas.map(x => x.texto), {
                        campo_destino: f.campo, tipo_regla: f.modo,
                        numero_linea: f.numero, grupo_de_conceptos: "",
                      })
                    : ""
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
                      <td className="px-2 py-2 font-mono text-[11px]">
                        {!f.campo
                          ? <span className="text-gray-400">—</span>
                          : previa
                            ? <span className="font-medium text-emerald-700">{previa}</span>
                            : <span className="text-red-600">vacío</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {huerfanas.length > 0 && (
            <p className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
              {huerfanas.length} regla(s) de esta forma apuntan a líneas que este movimiento no tiene.
              <strong> No se tocan</strong> al guardar.
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
