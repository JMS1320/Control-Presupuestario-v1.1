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
 * Sin poder verlas era imposible saber por qué un movimiento no se desglosaba.
 *
 * Lo que hace distinta a esta pantalla: muestra los **tipos que NO tienen regla** con un
 * movimiento real de ejemplo y sus líneas numeradas. La regla se escribe mirando el texto, no
 * adivinando qué hay en cada línea.
 */

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Trash2, FileWarning, Check } from "lucide-react"
import { toast } from "sonner"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"

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
  { valor: "linea", label: "Línea N", ayuda: "Toma una línea por su número" },
  { valor: "cuit", label: "CUIT", ayuda: "Busca los 11 dígitos, saca el prefijo CU/NO" },
  { valor: "pre_cuit", label: "Línea antes del CUIT", ayuda: "Suele ser el nombre" },
  { valor: "post_cuit", label: "Línea después del CUIT", ayuda: "Suele ser el concepto" },
  { valor: "nro_operacion", label: "Nº de operación", ayuda: "Busca OPERACION xxx u OP:xxx" },
]

/** Las columnas del extracto que el desglose puede llenar. */
const CAMPOS_DESTINO = [
  "descripcion",
  "numero_de_comprobante",
  "numero_de_terminal",
  "observaciones_cliente",
  "leyendas_adicionales_1",
  "leyendas_adicionales_2",
  "leyendas_adicionales_3",
  "leyendas_adicionales_4",
]

interface Regla {
  id: string
  cuenta_bancaria_id: string
  tipo_movimiento: string
  campo_destino: string | null
  tipo_regla: string
  numero_linea: number | null
  grupo_de_conceptos: string | null
  descripcion_campo: string | null
  orden: number | null
  activo: boolean
}

interface TipoSinRegla {
  tipo: string
  movimientos: number
  lineas: string[]
}

export function ConfiguradorReglasParseo({ cuentaBancariaId }: { cuentaBancariaId?: string }) {
  // La cuenta la elige el selector del modal, que es único para las tres solapas. Tener otro acá
  // sería un segundo mando para lo mismo y podrían quedar apuntando a cuentas distintas.
  const cuenta = cuentaBancariaId ?? ""
  const esCajaDeAhorro = CUENTAS_CA.some(c => c.id === cuenta)
  const [reglas, setReglas] = useState<Regla[]>([])
  const [sinRegla, setSinRegla] = useState<TipoSinRegla[]>([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState<{ abierto: boolean; tipo: string; lineas: string[]; editando: Regla | null }>(
    { abierto: false, tipo: "", lineas: [], editando: null }
  )

  // Formulario
  const [fTipoMovimiento, setFTipoMovimiento] = useState("")
  const [fCampo, setFCampo] = useState("descripcion")
  const [fTipoRegla, setFTipoRegla] = useState("linea")
  const [fLinea, setFLinea] = useState("1")
  const [fGrupo, setFGrupo] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!esCajaDeAhorro) { setReglas([]); setSinRegla([]); setCargando(false); return }
    setCargando(true)
    try {
      const [{ data }, diag] = await Promise.all([
        supabase.from("config_parseo_extracto").select("*")
          .eq("cuenta_bancaria_id", cuenta)
          .order("tipo_movimiento").order("orden"),
        fetch(`/api/reparsear-extracto?cuenta=${cuenta}`).then(r => r.json()).catch(() => null),
      ])
      setReglas((data ?? []) as Regla[])
      setSinRegla(diag?.ok ? (diag.tiposSinRegla ?? []) : [])
    } finally {
      setCargando(false)
    }
  }, [cuenta, esCajaDeAhorro])

  useEffect(() => { cargar() }, [cargar])

  const abrirNueva = (tipo: string, lineas: string[]) => {
    const existentes = reglas.filter(r => r.tipo_movimiento.toUpperCase() === tipo.toUpperCase())
    setFTipoMovimiento(tipo)
    setFCampo(existentes.length === 0 ? "descripcion" : "leyendas_adicionales_1")
    setFTipoRegla("linea")
    setFLinea(existentes.length === 0 ? "1" : "2")
    // El grupo es del TIPO, no de la regla: se hereda del que ya tenga para no crear variantes
    setFGrupo(existentes[0]?.grupo_de_conceptos ?? "")
    setModal({ abierto: true, tipo, lineas, editando: null })
  }

  const abrirEdicion = (r: Regla) => {
    setFTipoMovimiento(r.tipo_movimiento)
    setFCampo(r.campo_destino ?? "descripcion")
    setFTipoRegla(r.tipo_regla)
    setFLinea(String(r.numero_linea ?? 1))
    setFGrupo(r.grupo_de_conceptos ?? "")
    const ej = sinRegla.find(s => s.tipo === r.tipo_movimiento.toUpperCase())
    setModal({ abierto: true, tipo: r.tipo_movimiento, lineas: ej?.lineas ?? [], editando: r })
  }

  const guardar = async () => {
    if (!fTipoMovimiento.trim()) { toast.error("Falta el tipo de movimiento"); return }
    setGuardando(true)
    try {
      const fila = {
        cuenta_bancaria_id: cuenta,
        // El tipo se guarda en MAYÚSCULA: el match contra el texto del banco es exacto, y así
        // no quedan dos reglas del mismo tipo escritas distinto.
        tipo_movimiento: fTipoMovimiento.trim().toUpperCase(),
        campo_destino: fCampo,
        tipo_regla: fTipoRegla,
        numero_linea: fTipoRegla === "linea" ? Number(fLinea) || 1 : null,
        grupo_de_conceptos: fGrupo.trim() || null,
        activo: true,
      }
      if (modal.editando) {
        const { error } = await supabase.from("config_parseo_extracto").update(fila).eq("id", modal.editando.id)
        if (error) throw error
        toast.success("Regla actualizada")
      } else {
        const maxOrden = Math.max(0, ...reglas
          .filter(r => r.tipo_movimiento.toUpperCase() === fila.tipo_movimiento)
          .map(r => r.orden ?? 0))
        const { error } = await supabase.from("config_parseo_extracto").insert({ ...fila, orden: maxOrden + 1 })
        if (error) throw error
        toast.success("Regla creada — corré «Re-parsear» para aplicarla a lo ya importado")
      }
      setModal({ abierto: false, tipo: "", lineas: [], editando: null })
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (r: Regla) => {
    if (!window.confirm(`¿Eliminar la regla "${r.tipo_regla} → ${r.campo_destino}" de ${r.tipo_movimiento}?`)) return
    const { error } = await supabase.from("config_parseo_extracto").delete().eq("id", r.id)
    if (error) { toast.error("Error: " + error.message); return }
    toast.success("Regla eliminada")
    cargar()
  }

  // Agrupar para mostrar
  const porTipo = reglas.reduce<Record<string, Regla[]>>((acc, r) => {
    (acc[r.tipo_movimiento] ||= []).push(r); return acc
  }, {})

  // Las cuentas corrientes no usan estas reglas: su export del banco YA viene con las columnas
  // separadas (Descripción, Concepto, Leyendas 1-4, Nº de Comprobante…), así que no hay nada que
  // desglosar. El desglose por reglas existe sólo para Caja de Ahorro, donde el banco manda todo
  // apilado en una sola celda.
  if (!esCajaDeAhorro) {
    return (
      <div className="rounded border bg-gray-50 p-6 text-center">
        <FileWarning className="mx-auto mb-2 h-6 w-6 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          Esta cuenta no usa reglas de parseo
        </p>
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
                  {sinRegla.length} tipo{sinRegla.length === 1 ? '' : 's'} sin regla
                </CardTitle>
                <p className="text-xs text-gray-600">
                  Estos movimientos entraron con el texto completo pero sin desglosar. Ordenados por
                  cantidad: el primero es el que más rinde escribir.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {sinRegla.map(t => (
                  <div key={t.tipo} className="rounded border bg-white p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-medium text-gray-800">{t.tipo}</span>
                      <Badge variant="outline" className="text-[10px]">{t.movimientos} mov.</Badge>
                      <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                        onClick={() => abrirNueva(t.tipo, t.lineas)}>
                        <Plus className="mr-1 h-3 w-3" /> Crear regla
                      </Button>
                    </div>
                    {t.lineas.length > 0 && (
                      <div className="mt-1.5 rounded bg-gray-50 p-2 font-mono text-[11px] leading-5 text-gray-700">
                        {t.lineas.map((l, i) => (
                          <div key={i}>
                            <span className="mr-2 inline-block w-4 text-right text-gray-400">{i + 1}</span>{l}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Las reglas que ya existen */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-emerald-600" />
                {reglas.length} regla{reglas.length === 1 ? '' : 's'} en {Object.keys(porTipo).length} tipo(s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reglas.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  Esta cuenta no tiene ninguna regla: nada se desglosa.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(porTipo).map(([tipo, rs]) => (
                    <div key={tipo} className="rounded border">
                      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-2.5 py-1.5">
                        <span className="font-mono text-xs font-medium">{tipo}</span>
                        {rs[0].grupo_de_conceptos && (
                          <Badge variant="outline" className="text-[10px]">{rs[0].grupo_de_conceptos}</Badge>
                        )}
                        <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs"
                          onClick={() => abrirNueva(tipo, sinRegla.find(s => s.tipo === tipo.toUpperCase())?.lineas ?? [])}>
                          <Plus className="mr-1 h-3 w-3" /> Agregar campo
                        </Button>
                      </div>
                      <table className="w-full text-xs">
                        <tbody>
                          {rs.map(r => (
                            <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-2.5 py-1.5">
                                {TIPOS_REGLA.find(t => t.valor === r.tipo_regla)?.label ?? r.tipo_regla}
                                {r.tipo_regla === "linea" && <span className="text-gray-500"> {r.numero_linea}</span>}
                              </td>
                              <td className="px-2.5 py-1.5 text-gray-400">→</td>
                              <td className="px-2.5 py-1.5 font-mono text-gray-700">{r.campo_destino}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <button className="text-blue-600 hover:underline" onClick={() => abrirEdicion(r)}>editar</button>
                                <button className="ml-3 text-red-500 hover:text-red-700" onClick={() => eliminar(r)}>
                                  <Trash2 className="inline h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
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

      <Dialog open={modal.abierto} onOpenChange={v => !v && setModal({ abierto: false, tipo: "", lineas: [], editando: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{modal.editando ? "Editar regla" : "Nueva regla"}</DialogTitle>
          </DialogHeader>

          {/* El texto real, para no adivinar qué hay en cada línea */}
          {modal.lineas.length > 0 && (
            <div className="rounded border bg-gray-50 p-2 font-mono text-[11px] leading-5 text-gray-700">
              {modal.lineas.map((l, i) => (
                <div key={i}>
                  <span className="mr-2 inline-block w-4 text-right text-gray-400">{i + 1}</span>{l}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Tipo de movimiento</Label>
              <Input className="mt-1 font-mono" value={fTipoMovimiento}
                onChange={e => setFTipoMovimiento(e.target.value)} />
              <p className="mt-1 text-[11px] text-gray-500">
                Tiene que coincidir <strong>exacto</strong> con la primera línea del banco.
              </p>
            </div>

            <div>
              <Label className="text-xs">Qué extraer</Label>
              <select className="mt-1 w-full border rounded px-2 py-1.5 text-sm bg-white"
                value={fTipoRegla} onChange={e => setFTipoRegla(e.target.value)}>
                {TIPOS_REGLA.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                {TIPOS_REGLA.find(t => t.valor === fTipoRegla)?.ayuda}
              </p>
            </div>

            <div>
              <Label className="text-xs">{fTipoRegla === "linea" ? "Número de línea" : "—"}</Label>
              <Input className="mt-1" type="number" min={1} value={fLinea} disabled={fTipoRegla !== "linea"}
                onChange={e => setFLinea(e.target.value)} />
            </div>

            <div>
              <Label className="text-xs">Guardarlo en</Label>
              <select className="mt-1 w-full border rounded px-2 py-1.5 text-sm bg-white"
                value={fCampo} onChange={e => setFCampo(e.target.value)}>
                {CAMPOS_DESTINO.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs">Grupo de conceptos</Label>
              <Input className="mt-1" value={fGrupo} onChange={e => setFGrupo(e.target.value)}
                list="grupos-conceptos-usados" placeholder="Ej: Transferencias" />
              <datalist id="grupos-conceptos-usados">
                {[...new Set(reglas.map(r => r.grupo_de_conceptos).filter(Boolean))].map(g =>
                  <option key={g as string} value={g as string} />)}
              </datalist>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setModal({ abierto: false, tipo: "", lineas: [], editando: null })}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
