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
 * **La unidad de trabajo es el SUBTIPO, no el tipo.** Un mismo tipo de movimiento llega escrito de
 * maneras distintas —`TRANSFERENCIA A TERCEROS` viene en 3— y las reglas que cuentan líneas sólo
 * valen dentro de un subtipo. Cada subtipo se configura por separado, con su propio ejemplo real.
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
import { Loader2, Plus, Trash2, FileWarning, Check, Pencil, Info } from "lucide-react"
import { toast } from "sonner"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { aplicarRegla, proponerMapeo, esCuit, COLUMNA_CBU, auditarSubtipo, resolverFilaExistente, type LineaPropuesta, type ContenidoLinea, type AuditoriaSubtipo, ESTRUCTURA_DATOS, COLUMNAS_INTOCABLES, DESTINO_POR_CONTENIDO } from "@/lib/extractos/parseo-movimiento"

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
  /** Subtipo a la que aplica. `null` = a todas (reglas viejas, previas a la columna). */
  firma_forma?: string | null
  /** Cuándo el usuario dio por bueno este subtipo. `null` = sin revisar. */
  revisado_en?: string | null
}

interface Subtipo {
  firma: string
  lineas: number
  movimientos: number
  texto: string[]
  /** `false` = el tipo tiene reglas por subtipo y ninguna es de ésta → NO se parsea. */
  cubierto: boolean
}

interface TipoInfo {
  tipo: string
  movimientos: number
  conRegla: boolean
  lineas: string[]
  subtipos: Subtipo[]
}

/** Una fila del editor: la línea + a dónde la manda el usuario. */
interface Fila extends LineaPropuesta {
  reglaExistente: Regla | null
  /** Lo que diría la app si mandara ella. Se ofrece con un botón; nunca se aplica sola. */
  sugerencia?: { contenido: string; campo: string; modo: string } | null
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
  const cuentaActual = CUENTAS_CA.find(c => c.id === cuenta)
  /** La otra cuenta de Caja de Ahorro — de ahí se pueden copiar reglas (mismo formato de banco). */
  const otraCA = CUENTAS_CA.filter(c => c.id !== cuenta)

  const [reglas, setReglas] = useState<Regla[]>([])
  /** Las reglas de la OTRA cuenta de Caja de Ahorro, para ofrecer equivalencias tipo por tipo. */
  const [reglasOtra, setReglasOtra] = useState<Regla[]>([])
  const [equiv, setEquiv] = useState<{ t: TipoInfo; f: Subtipo; origen: { id: string; nombre: string }; reglas: Regla[] } | null>(null)
  const [tipos, setTipos] = useState<TipoInfo[]>([])
  const [cargando, setCargando] = useState(true)

  // Editor de UN subtipo de un tipo
  const [editando, setEditando] = useState<{ tipo: TipoInfo; subtipo: Subtipo } | null>(null)
  const [verEstructura, setVerEstructura] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [fGrupo, setFGrupo] = useState("")
  const [grupoOriginal, setGrupoOriginal] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    if (!esCajaDeAhorro) { setReglas([]); setTipos([]); setCargando(false); return }
    setCargando(true)
    try {
      const otras = CUENTAS_CA.filter(c => c.id !== cuenta).map(c => c.id)
      const [{ data }, diag, { data: dOtra }] = await Promise.all([
        supabase.from("config_parseo_extracto").select("*")
          .eq("cuenta_bancaria_id", cuenta)
          .order("tipo_movimiento").order("orden"),
        fetch(`/api/reparsear-extracto?cuenta=${cuenta}`).then(r => r.json()).catch(() => null),
        otras.length
          ? supabase.from("config_parseo_extracto").select("*").in("cuenta_bancaria_id", otras).eq("activo", true)
          : Promise.resolve({ data: [] as unknown[] }),
      ])
      setReglas((data ?? []) as Regla[])
      setReglasOtra((dOtra ?? []) as Regla[])
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

  /** Las reglas que aplican a un subtipo: las suyas, más las viejas sin firma. */
  const reglasDeSubtipo = useCallback(
    (tipo: string, firma: string) =>
      reglasDe(tipo).filter(r => !r.firma_forma || r.firma_forma === firma),
    [reglasDe]
  )

  /**
   * 🧮 **El estado de la cuenta, de un vistazo — A-FEAT-1177.**
   *
   * Tres números, y cada uno manda a una acción distinta. Mezclarlos fue el error de la primera
   * versión del aviso de Principal: un total solo no dice qué hacer.
   *
   * ⚠️ **`malHoy` es lo que pasaría al re-parsear, no lo que pasa ahora.** Los movimientos están
   * en blanco: el daño no existe todavía, y por eso conviene arreglar las reglas ANTES.
   *
   * 🛑 **VA ACÁ ARRIBA Y NO SE BAJA.** Más abajo hay un `return` temprano —el de las cuentas
   * corrientes, que no usan reglas— y un hook después de un return condicional **rompe la pantalla
   * entera**: React cuenta 8 hooks en una cuenta y 9 en la otra, y al cambiar de cuenta tira
   * *«rendered more hooks than during the previous render»*. Así se cayó Reglas de parseo el
   * 2026-09-25 (A-BUG-1201). `type-check` y `build` pasan igual: no es un error de tipos.
   */
  const resumen = useMemo(() => {
    let malHoy = 0, listos = 0, sinReglas = 0, lineasParaElUsuario = 0, reglasPeligrosas = 0, conChoque = 0
    let revisados = 0, totalSub = 0
    const porTipo: { tipo: string; movimientos: number; hallazgos: number }[] = []
    for (const t of tipos) {
      let malDelTipo = 0
      for (const f of t.subtipos) {
        totalSub++
        const rs = reglasDeSubtipo(t.tipo, f.firma)
        const propias = rs.filter(r => r.firma_forma === f.firma)
        if (propias.length > 0 && propias.every(r => r.revisado_en)) revisados++
        if (rs.length === 0) { sinReglas += f.movimientos; continue }
        const a = auditarSubtipo(f.texto, rs as never)
        lineasParaElUsuario += a.decideElUsuario.length
        reglasPeligrosas += t.subtipos.length > 1 ? a.reglasQueCuentanSinSubtipo : 0
        if (a.choques.length > 0) conChoque += f.movimientos
        if (a.hallazgos.length > 0) { malHoy += f.movimientos; malDelTipo += f.movimientos }
        else if (a.choques.length === 0) listos += f.movimientos
      }
      if (malDelTipo > 0) porTipo.push({ tipo: t.tipo, movimientos: malDelTipo, hallazgos: 0 })
    }
    return { malHoy, listos, sinReglas, lineasParaElUsuario, reglasPeligrosas, conChoque, revisados, totalSub,
             porTipo: porTipo.sort((a, b) => b.movimientos - a.movimientos) }
  }, [tipos, reglasDeSubtipo])

  /**
   * 🤖 **Lo que la app reconoce sola YA TIENE que quedar puesto — A-FEAT-1178.**
   *
   * Pedido del usuario 2026-09-25: *«si la app ya reconoce bien, ¿por qué no lo dejás preseteado
   * así? Lo que yo debo hacer a mano es lo que no se puede reconocer de entrada»*. Tiene razón:
   * confirmar fila por fila algo que el sistema ya sabe no es auditar, es tipear.
   *
   * 🔑 **Qué escribe y qué NO**:
   * - las líneas que la app reconoce **con certeza** (CUIT, CBU, tarjeta, banco, tipo) → se
   *   escriben con la columna de la convención;
   * - las que **ya tenían una regla** —aunque la app no las reconozca— → se conservan tal como
   *   las decidió él, sólo que atadas a su subtipo (es `resolverFilaExistente`, la misma del editor);
   * - las que **nadie sabe qué son y no tienen regla** → **no se tocan**. Ésas son su trabajo.
   *
   * ⚠️ **Toca la BD, así que no corre solo**: es un botón, con el detalle de lo que va a hacer
   * antes de hacerlo (§ `CLAUDE.md` 🛑 Datos).
   */
  const planPreseteo = useMemo(() => {
    const filas: { tipo: string; firma: string; linea: number; campo: string; modo: string; existente: Regla | null }[] = []
    let paraElUsuario = 0
    const tiposTocados = new Set<string>()

    for (const t of tipos) {
      for (const f of t.subtipos) {
        const rs = reglasDeSubtipo(t.tipo, f.firma)
        const propuesta = proponerMapeo(f.texto)
        const campoTomado = new Set<string>()
        propuesta.forEach((prop, i) => {
          const ya = rs.find(r => lineaDeRegla(r, f.texto) === i) ?? null
          const d = ya ? resolverFilaExistente(prop, ya) : null
          const campo = d?.campo || (prop.seguro ? prop.campo : "")
          const modo = d?.modo || prop.modo
          if (!campo) { if (!ya) paraElUsuario++; return }

          /**
           * 🛑 **Dos líneas no pueden reclamar la misma columna.** Si pasa, la segunda se deja
           * para él: escribir las dos daría un choque y el movimiento **no se parsearía**
           * (`GRUPO_CHOQUE`). Pasa de verdad en `DEB. AUTOM. DE SERV.` de AySA, donde los dos
           * números del final —el de cliente y el del servicio— se reconocen los dos como concepto.
           */
          if (campoTomado.has(campo)) { paraElUsuario++; return }
          campoTomado.add(campo)

          /**
           * 🛑 **Una regla vieja SIN subtipo no se puede reciclar para más de uno.**
           *
           * Era el bug A-BUG-1206 (2026-09-25): las reglas genéricas de un tipo aparecen en `rs`
           * de **todos** sus subtipos, así que el bucle las actualizaba una vez por subtipo y
           * **ganaba el último**. `DEB. AUTOM. DE SERV.` tiene dos subtipos y sus 4 reglas
           * terminaron todas atadas al segundo: **el primero quedó sin ninguna.**
           *
           * Se recicla la fila **sólo si ya era de este subtipo**; si era genérica, se inserta una
           * nueva y la genérica se borra al final, que es lo que corresponde.
           */
          const reciclable = ya && ya.firma_forma === f.firma ? ya : null
          const igual = reciclable && reciclable.campo_destino === campo && reciclable.tipo_regla === modo
          if (igual) return
          filas.push({ tipo: t.tipo.toUpperCase(), firma: f.firma, linea: i + 1, campo, modo, existente: reciclable })
          tiposTocados.add(t.tipo.toUpperCase())
        })
      }
    }
    // Las reglas viejas SIN subtipo de esos tipos se van: si quedaran, seguirían aplicándose a
    // todos los subtipos, que es exactamente la causa de A-BUG-1200.
    const genericasABorrar = reglas.filter(r => !r.firma_forma && tiposTocados.has(r.tipo_movimiento.toUpperCase()))
    return { filas, paraElUsuario, tipos: tiposTocados.size, genericasABorrar }
  }, [tipos, reglas, reglasDeSubtipo])

  const [preseteando, setPreseteando] = useState(false)

  const presetear = async () => {
    const { filas, genericasABorrar } = planPreseteo
    if (filas.length === 0) return
    if (!confirm(
      `Dejar listo lo que la app reconoce

` +
      `• ${filas.length} regla(s) en ${planPreseteo.tipos} tipo(s)
` +
      `• se reemplazan ${genericasABorrar.length} regla(s) vieja(s) que hoy valen para todos los subtipos
` +
      `• quedan ${planPreseteo.paraElUsuario} línea(s) para que decidas vos

` +
      `No se toca ninguna línea que la app no reconozca y que vos no hayas configurado ya. ` +
      `Los movimientos no cambian hasta que corras Re-parsear.`
    )) return

    setPreseteando(true)
    try {
      for (const f of filas) {
        const grupo = reglasDe(f.tipo)[0]?.grupo_de_conceptos ?? null
        const fila = {
          cuenta_bancaria_id: cuenta,
          tipo_movimiento: f.tipo,
          campo_destino: f.campo,
          tipo_regla: f.modo,
          numero_linea: f.modo === "linea" ? f.linea : null,
          grupo_de_conceptos: grupo,
          firma_forma: f.firma,
          orden: f.linea * 10,
          activo: true,
          revisado_en: null,
        }
        const { error } = f.existente
          ? await supabase.from("config_parseo_extracto").update(fila).eq("id", f.existente.id)
          : await supabase.from("config_parseo_extracto").insert(fila)
        if (error) throw error
      }
      // Recién al final, cuando ya está escrito lo nuevo: si fallara antes, no se pierde nada.
      const huerfanas = genericasABorrar.filter(r => !filas.some(f => f.existente?.id === r.id))
      if (huerfanas.length > 0) {
        const { error } = await supabase.from("config_parseo_extracto").delete().in("id", huerfanas.map(r => r.id))
        if (error) throw error
      }
      toast.success(`${filas.length} regla(s) listas. Corré «Re-parsear» para aplicarlo a los movimientos.`)
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setPreseteando(false)
    }
  }

  /**
   * ✅ **«Ya lo miré y está bien» — A-FEAT-1180.**
   *
   * Pedido del usuario 2026-09-25: *«¿me agregás un check para dejar marcados los que ya doy por
   * buenos así no los vuelvo a revisar?»*. Con 15 subtipos y varias vueltas, sin esto no hay
   * forma de saber qué falta mirar.
   *
   * 🔑 **La marca se cae sola cuando el subtipo cambia**: al guardar una regla se limpia
   * (`guardar` escribe `revisado_en: null`). Un «ya lo vi» viejo que sobrevive a un cambio es
   * peor que no tener marca — tapa justo lo que había que mirar.
   *
   * 📌 Vive en las reglas del subtipo, no en una tabla aparte: **un subtipo sin reglas no se puede
   * dar por bueno**, porque todavía es trabajo pendiente.
   */
  const marcarRevisado = async (t: TipoInfo, f: Subtipo, revisado: boolean) => {
    const rs = reglasDeSubtipo(t.tipo, f.firma).filter(r => r.firma_forma === f.firma)
    if (rs.length === 0) {
      toast.error("Primero hay que configurar este subtipo: sin reglas propias no se puede dar por bueno.")
      return
    }
    const { error } = await supabase.from("config_parseo_extracto")
      .update({ revisado_en: revisado ? new Date().toISOString() : null })
      .in("id", rs.map(r => r.id))
    if (error) { toast.error("Error: " + error.message); return }
    cargar()
  }

  /**
   * 📋 **Copiar las reglas de la OTRA cuenta de Caja de Ahorro — A-FEAT-1181.**
   *
   * Pedido del usuario 2026-09-25: *«los tipos y reglas de MA deben servir para PAM ya que es el
   * mismo formato de extracto»*. Es cierto —las dos son Galicia CA y el banco escribe igual— pero
   * **el mismo formato no significa los mismos movimientos**, y eso hay que decirlo antes de
   * copiar, no después.
   *
   * 📏 **Medido el 2026-09-25**: las reglas de MA cubren **4 de los 9 subtipos de PAM** (12 de sus
   * 25 movimientos). Los otros 5 son tipos que en MA no existen —`REINTEGRO PROMOCION GALICIA`,
   * `IVA`, `COM. CAJA DE SEGURIDAD`, `PAGO CON TRANSFERENCIA`— y hay que hacerlos a mano igual.
   *
   * 🛑 **No pisa nada.** Si el destino ya tiene reglas para ese tipo y ese subtipo, se saltea y lo
   * informa. Copiar encima del trabajo hecho es exactamente lo que no se hace (§ 🛑 Datos).
   *
   * 📌 Lo copiado entra **sin la marca de revisado**: son reglas de otra cuenta, las tiene que
   * mirar igual.
   */
  const [copiando, setCopiando] = useState(false)

  /**
   * ↔️ **La equivalencia se ve en el TIPO, no en un botón global — A-FEAT-1181.**
   *
   * Pedido del usuario 2026-09-25, después de que la primera versión fuera un botón que traía
   * todo junto: *«si tengo un tipo de PAM que es equivalente a uno de MA, el mismo tipo me dice:
   * tiene equivalencia en MA. Me permite ver la comparación y yo importo tipo por tipo»*.
   *
   * 🔑 **Y sólo cuenta como equivalencia si allá está REVISADO** —regla suya—: traer lo que el
   * usuario todavía no miró es propagar trabajo a medio hacer a otra cuenta.
   *
   * 📌 **Equivalencia = mismo tipo Y mismo subtipo.** No se propaga nada que acá no exista: eso
   * fabricaría reglas huérfanas, que es el problema que él mismo señaló en PAM (A-DAT-60).
   */
  const equivalenciaDe = useCallback((tipo: string, firma: string) => {
    const suyas = reglasOtra.filter(r =>
      r.tipo_movimiento.toUpperCase() === tipo.toUpperCase() &&
      r.firma_forma === firma)
    if (suyas.length === 0) return null
    // Todas revisadas, o no se ofrece
    if (!suyas.every(r => r.revisado_en)) return null
    const id = suyas[0].cuenta_bancaria_id
    return { origen: CUENTAS_CA.find(c => c.id === id) ?? { id, nombre: id }, reglas: suyas }
  }, [reglasOtra])

  /** Trae las reglas de UN subtipo desde la otra cuenta. Reemplaza las de acá para ese subtipo. */
  const traerEquivalencia = async () => {
    if (!equiv) return
    setCopiando(true)
    try {
      const propias = reglasDeSubtipo(equiv.t.tipo, equiv.f.firma).filter(r => r.firma_forma === equiv.f.firma)
      // Las de acá se reemplazan: traer y dejar las viejas daría dos reglas por línea
      if (propias.length > 0) {
        const { error } = await supabase.from("config_parseo_extracto").delete().in("id", propias.map(r => r.id))
        if (error) throw error
      }
      const filas = equiv.reglas.map(r => ({
        cuenta_bancaria_id: cuenta,
        tipo_movimiento: r.tipo_movimiento.toUpperCase(),
        campo_destino: r.campo_destino,
        tipo_regla: r.tipo_regla,
        numero_linea: r.numero_linea,
        grupo_de_conceptos: r.grupo_de_conceptos,
        firma_forma: r.firma_forma,
        orden: r.orden,
        activo: true,
        // Vienen de otra cuenta: las tiene que revisar acá igual.
        revisado_en: null,
      }))
      const { error } = await supabase.from("config_parseo_extracto").insert(filas)
      if (error) throw error
      toast.success(`${filas.length} regla(s) traídas de ${equiv.origen.nombre}. Revisalas y corré «Re-parsear».`)
      setEquiv(null)
      cargar()
    } catch (e) {
      toast.error("Error: " + (e as Error).message)
    } finally {
      setCopiando(false)
    }
  }

  /** Abre el editor de UN subtipo: propone lo que sabemos y pre-carga lo que ya existe. */
  const abrirSubtipo = (t: TipoInfo, subtipo: Subtipo) => {
    const existentes = reglasDeSubtipo(t.tipo, subtipo.firma)
    const filasNuevas: Fila[] = proponerMapeo(subtipo.texto).map((p, i) => {
      const ya = existentes.find(r => lineaDeRegla(r, subtipo.texto) === i)
      if (!ya) return { ...p, reglaExistente: null }

      /**
       * 🛑 **La columna SIEMPRE sale de la convención, nunca de la regla vieja.**
       *
       * Antes acá decía `campo: ya.campo_destino`, y eso producía la contradicción que vio el
       * usuario el 2026-09-25: el desplegable decía **«CBU destino»** y abajo, en la misma fila,
       * **«va a `numero_de_comprobante`»**. Las dos cosas no pueden discrepar — es exactamente lo
       * que A-FEAT-1174 vino a cerrar: *se elige QUÉ ES el dato; dónde va lo decide la convención*.
       *
       * 📌 De la regla vieja se conserva lo que sí es una decisión suya: **el modo**, y —cuando la
       * app no supo reconocer la línea— **qué dijo él que era**, deducido de la columna donde la
       * había mandado. Lo que no se conserva es una columna que contradice la convención.
       */
      const r = resolverFilaExistente(p, ya)
      return {
        ...p,
        contenido: r.contenido as ContenidoLinea,
        campo: r.campo,
        modo: r.modo,
        reglaExistente: ya,
        seguro: r.seguro,
        sugerencia: r.sugerencia,
        motivo: r.sugerencia
          ? `La app diría «${DESTINO_POR_CONTENIDO[r.sugerencia.contenido]?.label ?? r.sugerencia.contenido}». Lo tuyo manda: esto queda como está salvo que lo cambies.`
          : "Lo decidiste vos antes",
      }
    })
    setFilas(filasNuevas)
    const grupo = reglasDe(t.tipo)[0]?.grupo_de_conceptos ?? ""
    setFGrupo(grupo)
    setGrupoOriginal(grupo)
    setEditando({ tipo: t, subtipo })
  }

  const cambiarFila = (i: number, cambio: Partial<Fila>) =>
    setFilas(fs => fs.map((x, j) => (j === i ? { ...x, ...cambio } : x)))

  /** Reglas de este subtipo que no se pudieron ubicar en ninguna línea: no se tocan. */
  const huerfanas = useMemo(() => {
    if (!editando) return []
    const ubicadas = new Set(filas.map(f => f.reglaExistente?.id).filter(Boolean))
    return reglasDeSubtipo(editando.tipo.tipo, editando.subtipo.firma).filter(r => !ubicadas.has(r.id))
  }, [editando, filas, reglasDeSubtipo])

  const plan = useMemo(() => {
    const firma = editando?.subtipo.firma ?? ""
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
      const firma = editando.subtipo.firma
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
          // Toda regla queda atada a SU subtipo. Si mañana el banco manda un subtipo distinto, no
          // se parsea y se ve — en vez de desglosarse con las reglas de otra.
          firma_forma: firma,
          orden,
          activo: true,
          // Cambió algo: el «ya lo vi» de antes ya no vale para esto.
          revisado_en: null,
        }
        const { error } = f.reglaExistente
          ? await supabase.from("config_parseo_extracto").update(fila).eq("id", f.reglaExistente.id)
          : await supabase.from("config_parseo_extracto").insert(fila)
        if (error) throw error
      }

      // El grupo de conceptos es del TIPO, no de el subtipo: se alinea en todas sus reglas. Si no,
      // el mismo tipo tendría dos grupos y el parseo tomaría el de la primera regla cargada.
      const otras = reglasDe(tipo).filter(r => !filas.some(f => f.reglaExistente?.id === r.id))
      if (otras.length > 0) {
        await supabase.from("config_parseo_extracto")
          .update({ grupo_de_conceptos: grupo }).in("id", otras.map(r => r.id))
      }

      toast.success(
        `${tipo} · subtipo de ${editando.subtipo.lineas} líneas: ${plan.alta} nueva(s), ` +
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

  const borrarReglasDeSubtipo = async (t: TipoInfo, subtipo: Subtipo) => {
    const rs = reglasDe(t.tipo).filter(r => r.firma_forma === subtipo.firma)
    if (rs.length === 0) return
    if (!window.confirm(
      `¿Eliminar las ${rs.length} reglas de el subtipo de ${subtipo.lineas} líneas de ${t.tipo}?\n\n` +
      `Sus ${subtipo.movimientos} movimiento(s) dejarán de desglosarse. Lo ya importado no cambia ` +
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

  // Una entrada por SUBTIPO, que es la unidad real de configuración
  const subtiposPendientes = tipos.flatMap(t =>
    t.subtipos.filter(f => reglasDeSubtipo(t.tipo, f.firma).length === 0).map(f => ({ t, f }))
  ).sort((a, b) => b.f.movimientos - a.f.movimientos)

  const totalSubtipos = tipos.reduce((n, t) => n + t.subtipos.length, 0)
  const conEquivalencia = tipos.reduce(
    (n, t) => n + t.subtipos.filter(f => equivalenciaDe(t.tipo, f.firma)).length, 0)
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

  /** Un subtipo: su ejemplo real a la izquierda y lo que producen sus reglas a la derecha. */
  const BloqueSubtipo = ({ t, f }: { t: TipoInfo; f: Subtipo }) => {
    const rs = reglasDeSubtipo(t.tipo, f.firma)
    const sinReglas = rs.length === 0
    // 🧮 A-FEAT-1177: qué hacen HOY las reglas con cada línea de este subtipo
    const audit: AuditoriaSubtipo | null = sinReglas ? null : auditarSubtipo(f.texto, rs as never)
    const mal = audit?.hallazgos ?? []
    // Revisado = TODAS las reglas propias de este subtipo tienen la marca
    const propias = rs.filter(r => r.firma_forma === f.firma)
    const revisado = propias.length > 0 && propias.every(r => r.revisado_en)
    return (
      <div className={`rounded border ${revisado ? "border-emerald-200 bg-emerald-50/30" : sinReglas ? "border-sky-300 bg-sky-50/40" : (audit?.choques.length ?? 0) > 0 ? "border-red-300 bg-red-50/30" : mal.length > 0 ? "border-amber-300 bg-amber-50/30" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 border-b px-2.5 py-1.5">
          {/* ✅ «Ya lo miré» — se cae solo si después cambian las reglas de este subtipo */}
          <label className="flex cursor-pointer items-center gap-1.5" title={
            revisado
              ? "Dado por bueno. Si cambiás una regla de este subtipo, la marca se borra sola."
              : "Marcalo cuando lo hayas revisado y esté bien, para no volver a mirarlo."}>
            <input type="checkbox" className="h-3.5 w-3.5 accent-emerald-600"
              id={`revisado-${t.tipo}-${f.firma}`}
              checked={revisado} disabled={sinReglas}
              onChange={e => marcarRevisado(t, f, e.target.checked)} />
            <span className={`text-[11px] ${revisado ? "font-medium text-emerald-700" : "text-gray-500"}`}>
              {revisado ? "revisado" : "sin revisar"}
            </span>
          </label>
          {/* La palabra «subtipo» sólo aparece donde significa algo: un tipo que llega de dos
              maneras. Con una sola, decirlo confunde más de lo que aclara. */}
          <span className="text-xs font-medium text-gray-700">
            {t.subtipos.length > 1 ? `Subtipo de ${f.lineas} líneas` : `${f.lineas} líneas`}
          </span>
          <Badge variant="outline" className="text-[10px]">{f.movimientos} mov.</Badge>
          {sinReglas
            ? <Badge variant="outline" className="border-sky-400 bg-white text-[10px] text-sky-800">sin reglas — no se desglosa</Badge>
            : (audit?.choques.length ?? 0) > 0
              ? <Badge variant="outline" className="border-red-400 bg-white text-[10px] text-red-800">
                  choque de columnas — estos movimientos no se parsean
                </Badge>
              : mal.length > 0
                ? <Badge variant="outline" className="border-amber-400 bg-white text-[10px] text-amber-800">
                    la app propone otra columna en {mal.length}
                  </Badge>
                : <Badge variant="outline" className="border-emerald-400 bg-white text-[10px] text-emerald-800">{rs.length} regla{rs.length === 1 ? "" : "s"} · cierra</Badge>}
          {(audit?.decideElUsuario.length ?? 0) > 0 && (
            <Badge variant="outline" className="border-amber-400 bg-white text-[10px] text-amber-800"
              title="La app no sabe qué son estas líneas. Es lo único que no se puede resolver por código.">
              {audit!.decideElUsuario.length} línea{audit!.decideElUsuario.length === 1 ? "" : "s"} las decidís vos
            </Badge>
          )}
          {(() => {
            const eq = equivalenciaDe(t.tipo, f.firma)
            if (!eq) return null
            return (
              <button type="button"
                className="rounded border border-sky-400 bg-sky-50 px-1.5 text-[10px] leading-5 text-sky-800 hover:bg-sky-100"
                title={`Este mismo tipo y esta misma forma ya están configurados y revisados en ${eq.origen.nombre}`}
                onClick={() => setEquiv({ t, f, origen: eq.origen, reglas: eq.reglas })}>
                ↔️ equivale a {eq.origen.nombre} — ver y traer
              </button>
            )
          })()}
          <Button size="sm" variant={sinReglas ? "outline" : "ghost"} className="ml-auto h-7 text-xs"
            onClick={() => abrirSubtipo(t, f)}>
            {sinReglas
              ? <><Plus className="mr-1 h-3 w-3" /> Configurar {f.lineas} líneas</>
              : <><Pencil className="mr-1 h-3 w-3" /> Editar</>}
          </Button>
          {rs.some(r => r.firma_forma === f.firma) && (
            <button className="text-red-500 hover:text-red-700" title="Eliminar las reglas de este subtipo"
              onClick={() => borrarReglasDeSubtipo(t, f)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {revisado ? (
          <p className="px-2.5 py-1.5 text-[11px] italic text-emerald-800">
            Dado por bueno. Destildalo si querés volver a verlo — y si cambiás una regla, la marca
            se borra sola.
          </p>
        ) : (
        <div className="grid gap-2.5 p-2.5 md:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">Un movimiento real</p>
            <Ejemplo lineas={f.texto} />
          </div>
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-400">Dónde va a quedar cada línea</p>
            {sinReglas ? (
              /**
               * 🔎 **Sin reglas NO es sin información.** Antes acá decía sólo *«Nada»*, y el
               * usuario lo marcó el 2026-09-25: *«hay dos subtipos prácticamente iguales, a uno me
               * propone todo bien y al otro no me propone nada — parece que el sistema podría
               * identificar perfectamente los dos»*. Podía: lo que faltaba era **mostrarlo**.
               */
              <table className="w-full text-[11px] leading-5">
                <tbody>
                  {proponerMapeo(f.texto).map((prop, i) => (
                    <tr key={i}>
                      <td className="pr-2 align-top text-gray-500">
                        {prop.campo
                          ? <>{etiquetaCampo(prop.campo)}{!prop.seguro && <span className="ml-1 text-[10px] text-amber-700">(propuesta)</span>}</>
                          : <span className="italic text-red-500">no sé qué es</span>}
                      </td>
                      <td className="align-top font-mono text-gray-500">{f.texto[i]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="pt-1 text-[10px] italic leading-4 text-sky-800">
                      Todavía no está guardado: hoy estos movimientos entran sin desglosar. Se
                      guarda con <strong>Configurar</strong>, o de una vez con el botón de arriba.
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              /**
               * 🎯 **Una fila por LÍNEA del movimiento, y la columna es la de DESTINO.**
               *
               * Antes esto listaba las reglas guardadas y mostraba la columna vieja. Resultado: de
               * afuera se leía *«el CBU queda en Nº de operación»* y adentro del editor *«el CBU va
               * a la columna del CBU»* — **las dos pantallas contestando distinto la misma
               * pregunta**. Lo marcó el usuario el 2026-09-25 (A-BUG-1203): *«lo que debería pasar
               * en la visualización previa a la edición es que ya muestre dónde lo va a guardar»*.
               *
               * Ahora las dos dicen **dónde va a quedar**, y lo que hoy está en otro lado se marca
               * al lado, tachado. La pregunta *«¿dónde va este dato?»* tiene una sola respuesta.
               */
              <table className="w-full text-[11px] leading-5">
                <tbody>
                  {f.texto.map((linea, i) => {
                    const prop = proponerMapeo(f.texto)[i]
                    const ya = rs.find(r => lineaDeRegla(r, f.texto) === i)
                    const d = ya ? resolverFilaExistente(prop, ya) : null
                    // Lo GUARDADO es lo que se muestra. La app, si disiente, va al lado.
                    const campo = d?.campo || (prop.seguro ? prop.campo : "")
                    const sug = d?.sugerencia ?? null
                    if (!campo) return (
                      <tr key={i}>
                        <td className="pr-2 align-top italic text-gray-400">no se guarda</td>
                        <td className="align-top font-mono text-gray-400">{linea}</td>
                      </tr>
                    )
                    return (
                      <tr key={i} className={sug ? "bg-amber-50" : ""}>
                        <td className="pr-2 align-top text-gray-500">
                          {etiquetaCampo(campo)}
                          {sug && (
                            <span className="ml-1 text-[10px] text-amber-700">
                              (la app diría {DESTINO_POR_CONTENIDO[sug.contenido]?.label ?? sug.contenido})
                            </span>
                          )}
                        </td>
                        <td className="align-top font-mono font-medium text-gray-800">{linea}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )}

        {/* ── 🔴 El choque va PRIMERO: es lo único objetivamente roto (§ 🚦 integridad) ── */}
        {(audit?.choques.length ?? 0) > 0 && (
          <div className="border-t border-red-300 bg-red-50 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-red-800">
              Dos líneas guardadas en la misma columna — estos movimientos NO se parsean
            </p>
            {audit!.choques.map(c => (
              <p key={c.campo} className="text-[11px] leading-5 text-gray-800">
                <span className="font-mono">{etiquetaCampo(c.campo)}</span> la reclaman las líneas{" "}
                <strong className="text-red-700">{c.lineas.map(n => `L${n}`).join(" y ")}</strong>
                {" "}— mientras estén las dos, <strong>el movimiento no se parsea</strong>. Hay que
                mandar una a otra columna o dejarla sin asignar.
              </p>
            ))}
          </div>
        )}

        {/* ── 🟠 Discrepancias: la app opina distinto. No son errores, son decisiones ────── */}
        {mal.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50/60 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
              La app propone otra columna para estas líneas — lo guardado sigue mandando
            </p>
            <table className="w-full text-[11px] leading-5">
              <tbody>
                {mal.map(h => (
                  <tr key={h.linea}>
                    <td className="w-8 pr-1 align-top font-mono text-gray-500">L{h.linea}</td>
                    <td className="pr-2 align-top font-mono text-gray-800">{h.texto}</td>
                    <td className="align-top text-gray-700">
                      la app dice que es <strong>{h.es}</strong> y la pondría en{" "}
                      <span className="font-mono">{etiquetaCampo(h.debeIr)}</span>
                      {h.cayoEn
                        ? <> — hoy está en <span className="font-mono text-amber-800">{etiquetaCampo(h.cayoEn)}</span></>
                        : <> — hoy <span className="text-amber-800">no se guarda</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-gray-600">
              Si la app tiene razón, se aplica con <strong>Editar</strong>. Si tenés razón vos,
              <strong> no hay nada que hacer</strong>: lo guardado es lo que se usa.
            </p>
          </div>
        )}
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
          {/* ── 🧮 El control, arriba de todo y visible — A-FEAT-1177 ──────────────
              Antes esto era un número que salía de un script y no lo veía nadie. La § 🧮 de
              CLAUDE.md pide lo contrario: si no cierra, alerta grande. */}
          {(resumen.malHoy > 0 || resumen.lineasParaElUsuario > 0) && (
            <Card className={resumen.malHoy > 0 ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-900">
                  <FileWarning className="h-4 w-4" />
                  {resumen.conChoque > 0
                    ? <><strong>{resumen.conChoque}</strong> movimiento{resumen.conChoque === 1 ? "" : "s"} no se parsean: tienen dos líneas guardadas en la misma columna</>
                    : resumen.malHoy > 0
                      ? <>En <strong>{resumen.malHoy}</strong> movimiento{resumen.malHoy === 1 ? "" : "s"} la app propone otra columna que la guardada</>
                      : <>Faltan decisiones tuyas en {resumen.lineasParaElUsuario} línea{resumen.lineasParaElUsuario === 1 ? "" : "s"}</>}
                </CardTitle>
                <p className="text-xs text-gray-700">
                  <strong>Lo guardado manda siempre.</strong> Lo que la app propone distinto es una
                  sugerencia y se aplica sólo si vos querés. Lo único que hay que arreglar sí o sí
                  es el <strong>choque</strong>: cuando dos líneas reclaman la misma columna el
                  movimiento <strong>no se parsea</strong> — entero, a propósito, para que se vea.
                </p>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <div className="flex flex-wrap gap-2 text-xs">
                  {resumen.conChoque > 0 && (
                    <span className="rounded border border-red-300 bg-white px-2 py-1">
                      🔴 <strong>{resumen.conChoque}</strong> con choque de columnas
                    </span>
                  )}
                  <span className="rounded border border-amber-300 bg-white px-2 py-1">
                    🟠 <strong>{resumen.malHoy}</strong> la app propone otra cosa
                  </span>
                  <span className="rounded border border-emerald-300 bg-white px-2 py-1">
                    ✅ <strong>{resumen.listos}</strong> ya cierran bien
                  </span>
                  {resumen.sinReglas > 0 && (
                    <span className="rounded border border-sky-300 bg-white px-2 py-1">
                      ⚪ <strong>{resumen.sinReglas}</strong> sin reglas todavía
                    </span>
                  )}
                  {resumen.lineasParaElUsuario > 0 && (
                    <span className="rounded border border-amber-400 bg-white px-2 py-1">
                      🟠 <strong>{resumen.lineasParaElUsuario}</strong> línea(s) las decidís vos
                    </span>
                  )}
                </div>

                {resumen.porTipo.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Por dónde empezar — ordenado por cuántos movimientos arregla
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {resumen.porTipo.map(x => (
                        <span key={x.tipo} className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-[11px]">
                          <span className="font-mono text-gray-800">{x.tipo}</span>
                          <strong className="ml-1 text-red-700">{x.movimientos}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🤖 El botón que hace el trabajo que no hace falta que haga él — A-FEAT-1178 */}
                {planPreseteo.filas.length > 0 && (
                  <div className="rounded border border-emerald-300 bg-white px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" className="h-7 text-xs" disabled={preseteando} onClick={presetear}>
                        {preseteando
                          ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Dejando listo…</>
                          : <><Check className="mr-1 h-3 w-3" /> Dejar listo lo que la app reconoce</>}
                      </Button>
                      <span className="text-[11px] text-gray-700">
                        <strong>{planPreseteo.filas.length}</strong> regla(s) en{" "}
                        <strong>{planPreseteo.tipos}</strong> tipo(s) — y después quedan{" "}
                        <strong>{planPreseteo.paraElUsuario}</strong> línea(s) para vos.
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-gray-500">
                      Escribe sólo lo que la app reconoce con certeza y lo que vos ya habías
                      configurado. <strong>No toca</strong> ninguna línea que nadie sepa qué es.
                      Los movimientos no cambian hasta que corras <strong>Re-parsear</strong>.
                    </p>
                  </div>
                )}

                {resumen.reglasPeligrosas > 0 && (
                  <p className="rounded border border-red-200 bg-white px-2 py-1.5 text-[11px] leading-4 text-gray-700">
                    ⚠️ <strong>{resumen.reglasPeligrosas} regla(s) cuentan renglones sin decir de qué
                    subtipo son</strong>, en tipos que tienen más de uno. Una regla así acierta en un
                    subtipo y se equivoca en los demás — es la causa de casi todo lo de arriba. Se
                    arregla abriendo cada subtipo y guardando: quedan atadas a él.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {subtiposPendientes.length > 0 && (
            <Card className="border-sky-300 bg-sky-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-sky-900">
                  <FileWarning className="h-4 w-4" />
                  {subtiposPendientes.length} subtipo{subtiposPendientes.length === 1 ? "" : "s"} sin reglas
                </CardTitle>
                <p className="text-xs text-gray-600">
                  Sus movimientos entran con el texto completo pero sin desglosar. Ordenadas por
                  cantidad: la primera es la que más rinde escribir.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {subtiposPendientes.map(({ t, f }) => (
                    <button key={t.tipo + f.firma} onClick={() => abrirSubtipo(t, f)}
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
                {/* Sólo los TIPOS. El total de subtipos confundía —9 tipos · 9 subtipos se lee
                    como si hubiera dos niveles, cuando significa que ninguno tiene más de uno— y
                    el total de reglas no le dice nada a nadie (usuario, 2026-09-25). */}
                {tipos.length} tipo(s) de movimiento
                {resumen.totalSub > 0 && (
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-normal ${
                    resumen.revisados === resumen.totalSub
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-gray-300 bg-gray-50 text-gray-600"}`}>
                    ✅ {resumen.revisados} de {resumen.totalSub} revisados
                  </span>
                )}
                {/* 📋 La estructura, a un clic. Va acá —y no arriba ni abajo de la lista— porque la
                    duda aparece mirando un tipo: «esto dónde termina guardado». */}
                <button
                  type="button"
                  onClick={() => setVerEstructura(true)}
                  className="ml-auto flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-normal text-sky-800 hover:bg-sky-100"
                >
                  <Info className="h-3.5 w-3.5" />
                  Ver dónde se guarda cada dato
                </button>
              </CardTitle>
              <p className="text-xs text-gray-600">
                Cada tipo se configura con su ejemplo real al lado de lo que produce. Si un tipo
                llega escrito de <strong>dos maneras distintas</strong>, aparece dividido en
                subtipos ahí adentro. El <strong>grupo de conceptos</strong> es del tipo entero.
              </p>
              {/* ↔️ Cuántos tipos de acá tienen equivalencia allá. El traer es por tipo, adentro
                  de cada uno: un botón que trae todo junto no deja comparar (A-FEAT-1181). */}
              {conEquivalencia > 0 && (
                <p className="mt-1.5 text-[11px] text-sky-800">
                  ↔️ <strong>{conEquivalencia}</strong> de estos tipos tienen un equivalente ya
                  revisado en {otraCA.map(o => o.nombre).join(" / ")} — lo dice cada uno, y se trae
                  de a uno después de ver la comparación.
                </p>
              )}
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
                          {t.subtipos.length > 1 && (
                            <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-800">
                              {t.subtipos.length} subtipos
                            </Badge>
                          )}
                          {grupo && <Badge variant="outline" className="text-[10px]">{grupo}</Badge>}
                        </div>
                        <div className="space-y-2 border-l-2 border-gray-200 pl-2.5">
                          {t.subtipos.map(f => <BloqueSubtipo key={f.firma} t={t} f={f} />)}
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

      {/* ── Editor de un subtipo: una fila por línea del movimiento ───────────── */}
      <Dialog open={!!editando} onOpenChange={v => !v && setEditando(null)}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{editando?.tipo.tipo}</DialogTitle>
          </DialogHeader>

          <div className="-mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <Badge variant="outline" className="text-[10px]">
              subtipo de {editando?.subtipo.lineas} líneas · {editando?.subtipo.movimientos} mov.
            </Badge>
            {(editando?.tipo.subtipos.length ?? 0) > 1 && (
              <span className="text-[11px] text-amber-700">
                Este tipo tiene {editando?.tipo.subtipos.length} subtipos — estas reglas valen sólo para éste.
              </span>
            )}
          </div>

          {/* Las reglas viejas (sin subtipo) valían para TODAS. Al guardarlas acá quedan atadas a
              éste, y los otros subtipos se quedan sin nada. Es correcto, pero tiene que avisarse
              ANTES de guardar: si no, el usuario ve desaparecer el desglose de movimientos que
              no tocó y no sabe por qué. */}
          {(editando?.tipo.subtipos.length ?? 0) > 1 &&
           filas.some(f => f.reglaExistente && !f.reglaExistente.firma_forma) && (
            <div className="rounded border border-amber-400 bg-amber-50 px-2.5 py-2">
              <p className="text-xs font-medium text-amber-900">
                ⚠ Ojo: hay reglas que hoy valen para los {editando?.tipo.subtipos.length} subtipos
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
                Al guardar quedan atadas <strong>sólo a este subtipo</strong>. Los otros
                {" "}{(editando?.tipo.subtipos.length ?? 1) - 1} se quedan sin reglas y sus movimientos
                dejan de desglosarse hasta que las configures. Conviene <strong>terminar el tipo
                entero</strong> de una sentada.
              </p>
            </div>
          )}

          {filas.filter(f => !f.contenido).length > 0 && (
            <p className="rounded border border-red-300 bg-red-50 px-2.5 py-2 text-xs text-red-900">
              🔴 <strong>{filas.filter(f => !f.contenido).length} línea(s) que la app no supo
              reconocer</strong> — están en rojo abajo. Es lo único que te toca decidir; el resto ya
              viene resuelto.
            </p>
          )}

          <p className="text-xs text-gray-600">
            Una fila por línea. Lo que el banco escribe siempre igual —el CUIT, el CBU, el nombre
            antes del CUIT, el banco— ya viene resuelto. <strong>Tu trabajo son las filas de
            color</strong>, y <strong>Sin asignar</strong> también es una decisión válida.
          </p>

          {/* Leyenda de los tres estados: sin esto, «rojo» y «ámbar» se leen como lo mismo. */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="flex items-center gap-1.5 rounded border px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm border bg-white" /> resuelto — la app lo reconoce seguro
            </span>
            <span className="flex items-center gap-1.5 rounded border border-amber-300 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> propuesta — mirala y confirmala
            </span>
            <span className="flex items-center gap-1.5 rounded border border-red-300 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> no sé qué es — lo decidís vos
            </span>
          </div>

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
                  // 🔴 Lo que la app NO supo reconocer va en ROJO, no en gris: en gris se lee
                  //    como «listo» y es justo lo contrario — es lo único que te toca decidir.
                  return (
                    <tr key={i} className={`border-t align-top ${!f.contenido ? "bg-red-50" : !f.seguro ? "bg-amber-50/60" : ""}`}>
                      <td className="px-2 py-2 font-mono text-gray-400">{f.numero}</td>
                      <td className="px-2 py-2">
                        <div className="font-mono text-[11px] text-gray-800">{f.texto}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {rot && <span className={`rounded px-1 text-[10px] leading-4 ${rot.clase}`}>{rot.txt}</span>}
                          {!f.contenido && (
                            <span className="rounded bg-red-600 px-1.5 text-[10px] font-medium leading-4 text-white">
                              no sé qué es — decidilo vos
                            </span>
                          )}
                          {/* 🟠 Tres estados, no dos. «Sugerido» en gris chiquito se leía como
                              «listo»; es lo que el usuario tiene que CONFIRMAR, que es distinto de
                              lo que tiene que inventar (rojo) y de lo que ya está (sin marca). */}
                          {!f.seguro && f.contenido && (
                            <span className="rounded bg-amber-500 px-1.5 text-[10px] font-medium leading-4 text-white">
                              propuesta — confirmala
                            </span>
                          )}
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
                        {/* 🎛️ Se elige QUÉ ES el dato, no dónde va. La columna sale del mapa
                            `DESTINO_POR_CONTENIDO` y se muestra abajo, sin poder editarse: si cada
                            tipo pudiera mandar el mismo dato a otra columna, volvería el desorden
                            que esto vino a cerrar (pedido del usuario 2026-09-24). */}
                        <select className="w-full rounded border bg-white px-1.5 py-1 text-[11px]"
                          value={f.contenido || ""}
                          onChange={e => {
                            const clave = e.target.value as ContenidoLinea
                            const d = DESTINO_POR_CONTENIDO[clave]
                            cambiarFila(i, d
                              ? { contenido: clave, campo: d.campo, modo: d.modo }
                              : { contenido: "" as ContenidoLinea, campo: "" })
                          }}>
                          <option value="">— sin asignar —</option>
                          {Object.entries(DESTINO_POR_CONTENIDO).map(([k, d]) =>
                            <option key={k} value={k}>{d.label}</option>)}
                        </select>
                        <p className="mt-1 text-[10px] leading-4 text-gray-500">
                          {f.campo
                            ? <>va a <code className="rounded bg-gray-100 px-1 font-mono">{f.campo}</code></>
                            : <span className="italic">no se guarda</span>}
                        </p>
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
              {huerfanas.length} regla(s) de este subtipo apuntan a líneas que este movimiento no tiene.
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

      {/* 📋 LA ESTRUCTURA — qué reconoce la app y dónde lo guarda.
          Las filas salen de `ESTRUCTURA_DATOS`, la misma lista que usa el reconocedor: si mañana
          cambia una columna, esta tabla cambia sola en vez de quedar mintiendo. */}
      {/* ↔️ La comparación, antes de traer nada. Sin esto «traer» es un salto de fe. */}
      <Dialog open={!!equiv} onOpenChange={o => !o && setEquiv(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              <span className="font-mono">{equiv?.t.tipo}</span> — comparar con {equiv?.origen.nombre}
            </DialogTitle>
          </DialogHeader>
          {equiv && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                Es el <strong>mismo tipo y la misma forma</strong> ({equiv.f.lineas} líneas), y allá
                está <strong>revisado</strong>. Abajo, línea por línea: qué hace cada regla sobre
                <strong> un movimiento real de esta cuenta</strong>.
              </p>

              <div className="overflow-x-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">#</th>
                      <th className="px-2 py-1.5 text-left font-medium">Lo que dice el banco acá</th>
                      <th className="px-2 py-1.5 text-left font-medium">Hoy en esta cuenta</th>
                      <th className="px-2 py-1.5 text-left font-medium">{equiv.origen.nombre}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equiv.f.texto.map((linea, i) => {
                      const aca = reglasDeSubtipo(equiv.t.tipo, equiv.f.firma)
                        .find(r => lineaDeRegla(r, equiv.f.texto) === i)
                      const alla = equiv.reglas.find(r => lineaDeRegla(r, equiv.f.texto) === i)
                      const distinto = (aca?.campo_destino ?? "") !== (alla?.campo_destino ?? "")
                      return (
                        <tr key={i} className={`border-t align-top ${distinto ? "bg-amber-50" : ""}`}>
                          <td className="px-2 py-1.5 font-mono text-gray-400">{i + 1}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-800">{linea}</td>
                          <td className="px-2 py-1.5 text-gray-600">
                            {aca ? etiquetaCampo(aca.campo_destino) : <span className="italic text-gray-400">nada</span>}
                          </td>
                          <td className="px-2 py-1.5 font-medium text-sky-800">
                            {alla ? etiquetaCampo(alla.campo_destino) : <span className="italic font-normal text-gray-400">nada</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p className="rounded border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-900">
                ⚠️ Al traer, las reglas de <strong>este subtipo</strong> en esta cuenta se
                <strong> reemplazan</strong> por las de {equiv.origen.nombre}. No se toca ningún
                otro tipo, y <strong>los movimientos no cambian</strong> hasta correr Re-parsear.
                Vienen <strong>sin la marca de revisado</strong>: son de otra cuenta.
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEquiv(null)}>Cancelar</Button>
                <Button size="sm" disabled={copiando} onClick={traerEquivalencia}>
                  {copiando
                    ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Trayendo…</>
                    : <>Traer las {equiv.reglas.length} reglas</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={verEstructura} onOpenChange={setVerEstructura}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dónde se guarda cada dato</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600">
            El extracto del Galicia no es texto libre: <strong>el mismo dato aparece siempre de la
            mismo subtipo</strong>. Por eso la app lo reconoce sola y ya sabe a qué columna va — no es
            una elección. Vale igual para <strong>MA</strong> y <strong>PAM Caja de Ahorro</strong>,
            que tienen el mismo formato.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">Tipo de dato</th>
                  <th className="py-2 pr-3 font-medium">Ejemplo</th>
                  <th className="py-2 font-medium">Columna</th>
                </tr>
              </thead>
              <tbody>
                {ESTRUCTURA_DATOS.map(e => (
                  <tr key={e.dato} className="border-b align-top last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className={e.clave ? "font-semibold text-gray-900" : "text-gray-800"}>
                        {e.dato}{e.clave ? " 🔑" : ""}
                      </span>
                      {e.nota && <p className="mt-0.5 text-xs leading-snug text-gray-500">{e.nota}</p>}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-gray-600">{e.ejemplo}</td>
                    <td className="py-2.5">
                      {e.columna
                        ? <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800">{e.columna}</code>
                        : <span className="text-xs italic text-amber-700">sin asignar</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-800">
              Dos columnas que el parseo nunca toca
            </p>
            {COLUMNAS_INTOCABLES.map(c => (
              <p key={c.columna} className="mb-1.5 text-xs leading-snug text-red-900 last:mb-0">
                <code className="font-mono">{c.columna}</code> — {c.porque}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
