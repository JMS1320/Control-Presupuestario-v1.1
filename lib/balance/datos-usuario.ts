"use client"

/**
 * 🗄️ LO QUE CARGA EL USUARIO EN LOS PAPELES DEL BALANCE SE GUARDA AL ESCRIBIRLO — A-FEAT-1337 paso 1.
 *
 * Usuario 2026-10-24: *«el trabajo de balance uno lo va haciendo en diferentes días… pretende que no se
 * pierda. Son un set de datos que tienen que quedar registrados… eso de que los precios que puse se
 * borren está mal»*.
 *
 * Hasta acá los precios a mano de hacienda, el cuadre de granos y las cuotapartes del fondo vivían
 * sólo en la pantalla. Ahora cada casilla se guarda en `public.balance_datos_usuario` (script 100),
 * por empresa + ejercicio + papel + clave, y se precarga al volver. **Lo automático no se guarda
 * acá**: se sigue recalculando solo (§ 🎚️ default del dato real).
 *
 * - Se guarda **lo que escribió** (`texto`) y el número leído (`valor`), y cada cambio deja el valor
 *   anterior en `historial` (la huella: quién, cuándo, qué había).
 * - **Vaciar una casilla no borra la fila**: la deja con `texto` vacío, y el historial conserva lo que
 *   había (§ 🛑 nada destructivo).
 * - **Si la tabla todavía no existe** (script 100 sin correr) la pantalla funciona como antes y dice
 *   que no se está guardando. Nunca rompe.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { etiquetaPersona } from "@/lib/auth/identidad"
import { ahoraISO } from "@/lib/fechas"

import {
  TABLA_DATOS_USUARIO, armarFilaDato, confirmarFila, fuenteTentativo, type FilaDatoUsuario, type PapelConDatos, type EstadoGuardado,
} from "./datos-usuario-puro"
export * from "./datos-usuario-puro"

/**
 * Las casillas de UN papel de UN balance: las trae al montar, y guarda cada una ~0,7 s después de que
 * se deja de escribir (y al salir de la pantalla, lo que quedó pendiente).
 */
export function useDatosDelBalance(empresa: string, anioCierre: number, papel: PapelConDatos) {
  const [valores, setValores] = useState<Record<string, string>>({})
  /** 🤖 A-FEAT-1386: clave → fuente, para los datos que puso Claude y esperan el OK. */
  const [tentativos, setTentativos] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<EstadoGuardado>("leyendo")
  const [error, setError] = useState<string | null>(null)
  const filas = useRef<Record<string, FilaDatoUsuario>>({})
  const pendientes = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const ultimoTexto = useRef<Record<string, string>>({})
  const persona = useRef<string | null>(null)
  const sinTabla = useRef(false)

  useEffect(() => {
    let vivo = true
    setEstado("leyendo"); setValores({}); setTentativos({}); filas.current = {}
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      persona.current = etiquetaPersona(u?.user ?? null)
      const { data, error } = await supabase.from(TABLA_DATOS_USUARIO).select("*")
        .eq("empresa", empresa).eq("anio_cierre", anioCierre).eq("papel", papel)
      if (!vivo) return
      if (error) {
        // 42P01 = no existe la tabla; PGRST205 = PostgREST no la conoce. Las dos: script 100 sin correr.
        const noExiste = error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find/i.test(error.message)
        sinTabla.current = noExiste
        setEstado(noExiste ? "sin tabla" : "error"); setError(noExiste ? null : error.message)
        return
      }
      const v: Record<string, string> = {}
      const t: Record<string, string> = {}
      for (const f of (data || []) as FilaDatoUsuario[]) {
        filas.current[f.clave] = { ...f, valor: f.valor == null ? null : Number(f.valor), historial: f.historial ?? [] }
        if (f.texto) v[f.clave] = f.texto
        const fu = fuenteTentativo(f.actualizado_por)
        if (fu) t[f.clave] = fu
      }
      setValores(v); setTentativos(t); setEstado("guardado")
    })()
    return () => { vivo = false }
  }, [empresa, anioCierre, papel])

  const escribir = useCallback(async (clave: string) => {
    if (sinTabla.current) return
    const texto = ultimoTexto.current[clave] ?? ""
    const fila = armarFilaDato({ empresa, anio_cierre: anioCierre, papel, clave }, texto,
      filas.current[clave] ?? null, persona.current, ahoraISO())
    if (!fila) return
    setEstado("guardando")
    const { error } = await supabase.from(TABLA_DATOS_USUARIO)
      .upsert(fila, { onConflict: "empresa,anio_cierre,papel,clave" })
    if (error) { setEstado("error"); setError(error.message); return }
    filas.current[clave] = fila
    // escribir otro valor ES revisarlo: deja de ser tentativo
    setTentativos(tt => { if (!(clave in tt)) return tt; const n = { ...tt }; delete n[clave]; return n })
    setEstado(Object.keys(pendientes.current).length ? "guardando" : "guardado"); setError(null)
  }, [empresa, anioCierre, papel])

  const cambiar = useCallback((clave: string, texto: string) => {
    setValores(v => ({ ...v, [clave]: texto }))
    ultimoTexto.current[clave] = texto
    if (sinTabla.current) return
    clearTimeout(pendientes.current[clave])
    pendientes.current[clave] = setTimeout(() => {
      delete pendientes.current[clave]
      void escribir(clave)
    }, 700)
  }, [escribir])

  // Al salir de la pantalla, lo que estaba esperando su turno se guarda igual.
  useEffect(() => () => {
    for (const [clave, t] of Object.entries(pendientes.current)) { clearTimeout(t); void escribir(clave) }
    pendientes.current = {}
  }, [escribir])

  /** ✓ OK de JMS a un dato tentativo: mismo valor, queda a su nombre; lo de Claude va al historial. */
  const confirmar = useCallback(async (clave: string) => {
    const f = filas.current[clave]
    const fila = f ? confirmarFila(f, persona.current, ahoraISO()) : null
    if (!fila) return
    setEstado("guardando")
    const { error } = await supabase.from(TABLA_DATOS_USUARIO)
      .upsert(fila, { onConflict: "empresa,anio_cierre,papel,clave" })
    if (error) { setEstado("error"); setError(error.message); return }
    filas.current[clave] = fila
    setTentativos(tt => { const n = { ...tt }; delete n[clave]; return n })
    setEstado("guardado"); setError(null)
  }, [])

  return { valores, cambiar, estado, error, tentativos, confirmar }
}

