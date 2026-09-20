"use client"

/**
 * 🧪 **A-FEAT-145 — el AUDIT de consistencia, en la app.**
 *
 * La lógica vive en `lib/conciliacion/auditoria.ts` y tiene sus casos en `npm run probar`. Acá sólo
 * se carga el dato y se muestra.
 *
 * 📌 **Por qué va en la app y no en una consulta**: un audit que hay que acordarse de correr no
 * existe. Es el mismo criterio del control de cuadratura ([A-FEAT-142], que quedó absorbido acá como
 * el control 7 — son la misma pantalla, no dos).
 *
 * ⚠️ **No corrige nada.** Propone y muestra; el arreglo lo decide el usuario (§ 🛑 Datos).
 */

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import {
  auditar, importeDe,
  type MovimientoAuditable, type ResultadoAuditoria, type ParCuadratura, type Hallazgo,
  type EntidadOrigen,
} from "@/lib/conciliacion/auditoria"
import { ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Loader2, CheckCircle2, Download } from "lucide-react"
import { exportarAuditoria } from "@/lib/conciliacion/exportar-auditoria"
import {
  agruparCorrecciones, type DatosParaCorregir, type ResumenCorregible,
} from "@/lib/conciliacion/correcciones"
import { proveedorDelTemplate } from "@/lib/conciliacion/datos-del-origen"
import { identificadorDeCuota } from "@/lib/templates/identificador-cuota"
import { repartoDelGrupo } from "@/lib/pagos/reparto-grupo"

const money = (n: number) =>
  `$${(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * 🧨 **PostgREST devuelve como mucho 1.000 filas, pase el `limit` que le pases.**
 *
 * No falla: **devuelve menos y no avisa**. Este día ya costó una falsa alarma — un control dijo
 * *«no cierra por −25»* con la migración perfecta, porque contó 1.000 de 1.025. Y acá pega seguro:
 * `cuotas_egresos_sin_factura` tiene 1.045 filas, así que sin paginar la cuadratura auditaría
 * contra un universo recortado **y daría verde**.
 */
async function traerTodo(hacerQuery: (desde: number, hasta: number) => any): Promise<any[]> {
  const PASO = 1000
  const filas: any[] = []
  for (let desde = 0; ; desde += PASO) {
    const { data, error } = await hacerQuery(desde, desde + PASO - 1)
    if (error) throw new Error(error.message)
    const lote = data ?? []
    filas.push(...lote)
    if (lote.length < PASO) return filas
  }
}

export function PanelAuditoriaConciliacion() {
  const [corriendo, setCorriendo] = useState(false)
  const [res, setRes] = useState<ResultadoAuditoria | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<Record<string, boolean>>({})
  /**
   * 📅 **El filtro por fecha — pedido del usuario 2026-09-19 para conciliar por lotes.**
   *
   * El audit mira **todo lo conciliado**, y al conciliar un lote nuevo cambian numerador y
   * denominador a la vez: «281 de 676» se vuelve ilegible cuando pasa a ser «281 de 776». Con el
   * rango se ve **sólo el lote**, sin depender de haber corrido el audit antes de empezar.
   */
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  /** El rango con el que se corrió, para que el encabezado no mienta si después se cambian los inputs. */
  const [rangoCorrido, setRangoCorrido] = useState<{ desde: string; hasta: string } | null>(null)
  /** 🛠️ A-FEAT-159 — lo que el audit puede arreglar solo, agrupado por causa. */
  const [corregibles, setCorregibles] = useState<ResumenCorregible[]>([])
  const [aplicando, setAplicando] = useState<string | null>(null)
  const [hechas, setHechas] = useState<Record<string, number>>({})
  /** La tabla de cada movimiento, para saber a dónde escribir el parche. */
  const tablaDeMov = useRef(new Map<string, { tabla: string; schema: string }>())

  async function correr() {
    setCorriendo(true); setError(null); setRes(null)
    try {
      const movimientos: MovimientoAuditable[] = []

      for (const cta of CUENTAS_BANCARIAS.filter(c => c.activa)) {
        // El builder se arma de nuevo en cada página: los de supabase-js no se reutilizan.
        const tabla = () => cta.schema_bd && cta.schema_bd !== "public"
          ? supabase.schema(cta.schema_bd as any).from(cta.tabla_bd)
          : supabase.from(cta.tabla_bd)

        // `select('*')` a propósito: nombrar columnas con `ñ` rompe el parser de supabase-js.
        const filas = await traerTodo((d, h) => tabla().select("*").range(d, h))

        for (const f of filas) {
          // Se anota dónde vive cada movimiento: el parche de una corrección tiene que ir a su
          // propia tabla y schema, no a una sola.
          tablaDeMov.current.set(String(f.id), { tabla: cta.tabla_bd, schema: cta.schema_bd ?? 'public' })
          movimientos.push({
            id: String(f.id),
            cuenta: cta.nombre,
            fecha: f.fecha ?? null,
            descripcion: f.descripcion ?? null,
            debitos: f.debitos ?? null,
            creditos: f.creditos ?? null,
            estado: f.estado ?? null,
            categ: f.categ ?? null,
            nro_cuenta: f.nro_cuenta ?? null,
            proveedor_nombre: f.proveedor_nombre ?? null,
            comprobantes_pagados: f.comprobantes_pagados ?? null,
            detalle: f.detalle ?? null,
            comprobante_arca_id: f.comprobante_arca_id ?? null,
            template_cuota_id: f.template_cuota_id ?? null,
            template_id: f.template_id ?? null,
            sueldo_pago_id: f.sueldo_pago_id ?? null,
            anticipo_id: f.anticipo_id ?? null,
            comprobante_venta_id: f.comprobante_venta_id ?? null,
          })
        }
      }

      /**
       * 📅 El recorte por fecha. Se aplica **acá**, antes de la cuadratura y de los orígenes, para
       * que todo lo que sigue hable del mismo universo — si se filtrara sólo al final, el panel
       * mostraría hallazgos de origen que no corresponden a ningún movimiento del rango.
       */
      const movimientosDelRango = movimientos.filter(m => {
        const f = (m.fecha ?? '').slice(0, 10)
        if (!f) return !desde && !hasta   // sin fecha entra sólo cuando no se filtra
        if (desde && f < desde) return false
        if (hasta && f > hasta) return false
        return true
      })

      const plan = await traerTodo((d, h) =>
        supabase.from("cuentas_contables").select("categ").range(d, h))
      const categsDelPlan = new Set<string>(plan.map((c: any) => String(c.categ ?? "").trim()))

      // Cuadratura: el vínculo señala una cuota **o** un grupo de pago. Si no se contemplan los
      // grupos, el control reporta rotos todos los pagos agrupados — que fue A-BUG-156.
      const cuotas = await traerTodo((d, h) =>
        supabase.from("cuotas_egresos_sin_factura").select("id, monto, grupo_pago_id").range(d, h))
      const porCuota = new Map<string, number>()
      const porGrupo = new Map<string, number>()
      for (const c of cuotas) {
        const m = Number((c as any).monto) || 0
        porCuota.set(String((c as any).id), m)
        const g = (c as any).grupo_pago_id
        if (g) porGrupo.set(String(g), (porGrupo.get(String(g)) ?? 0) + m)
      }

      const cuadratura: ParCuadratura[] = []
      for (const m of movimientosDelRango) {
        const v = m.template_cuota_id
        if (!v || String(m.estado ?? "").toLowerCase() !== "conciliado") continue
        const origen = porGrupo.has(String(v)) ? porGrupo.get(String(v))! : porCuota.get(String(v))
        if (origen === undefined) continue
        cuadratura.push({ movimientoId: m.id, importeBanco: importeDe(m), importeOrigen: origen })
      }

      // ── 🕳️ EL LADO DEL ORIGEN — A-BUG-172 ───────────────────────────────────────────────────
      // Sin esto el audit mide 8 donde hay 141: las facturas cuyo movimiento todavía no está
      // conciliado no las delata ninguna línea del extracto.
      const origenes: EntidadOrigen[] = []

      // Cuántos movimientos conciliados dependen de cada template: ordena el trabajo por impacto.
      const dependenDelTemplate = new Map<string, number>()
      for (const m of movimientosDelRango) {
        if (String(m.estado ?? "").toLowerCase() !== "conciliado") continue
        const tid = (m as any).template_id
        if (tid) dependenDelTemplate.set(String(tid), (dependenDelTemplate.get(String(tid)) ?? 0) + 1)
      }

      const templates = await traerTodo((d, h) => supabase
        .from("egresos_sin_factura")
        .select("id, nombre_referencia, nombre_quien_cobra, proveedor")
        .range(d, h))
      for (const tpl of templates) {
        // Sólo los que ya producen movimientos: auditar templates que nadie usó sería ruido.
        const dep = dependenDelTemplate.get(String(tpl.id)) ?? 0
        if (dep === 0) continue
        origenes.push({
          tipo: "template", id: String(tpl.id),
          nombre: String(tpl.nombre_referencia ?? "(sin nombre)"),
          nombre_quien_cobra: tpl.nombre_quien_cobra ?? null,
          proveedor: tpl.proveedor ?? null,
          movimientosQueDependen: dep,
        })
      }

      /**
       * ⚠️ **Con rango de fechas, las facturas NO se auditan enteras.** Una factura no tiene fecha
       * de movimiento —puede no estar conciliada todavía—, así que filtrar «julio» y mostrar igual
       * las 141 facturas de todo el universo mezclaría dos cosas y haría parecer que el lote está
       * peor de lo que está. Se omiten, **y se dice** (§ 🧮 nada se descarta en silencio).
       */
      const hayRango = !!(desde || hasta)
      for (const sch of (hayRango ? [] : ["msa", "pam", "ma"]) as readonly ("msa"|"pam"|"ma")[]) {
        const facturas = await traerTodo((d, h) => supabase
          .schema(sch as any).from("comprobantes_arca")
          .select("id, nro_cuenta, cuenta_contable, denominacion_emisor, punto_venta, numero_desde")
          .range(d, h))
        for (const f of facturas) {
          origenes.push({
            tipo: "factura", id: String(f.id),
            nombre: `${f.denominacion_emisor ?? "?"} — ${f.punto_venta ?? "?"}-${f.numero_desde ?? "?"}`,
            cuenta_contable: f.cuenta_contable ?? null,
            nro_cuenta: f.nro_cuenta ?? null,
          })
        }
      }

      /**
       * 👥 El reparto esperado de cada pago agrupado, para el control `proveedor-incompleto`.
       * Se arma antes de auditar porque el audit lo necesita para comparar.
       */
      const pagosSueldoPrev = await traerTodo((d, h) => supabase
        .from("sueldos_pagos")
        .select("id, monto, grupo_pago_id, empleado:sueldos_empleados(nombre)")
        .range(d, h))
      const gruposSueldo = new Map<string, any[]>()
      for (const p of pagosSueldoPrev) {
        if (!p.grupo_pago_id) continue
        const g = String(p.grupo_pago_id)
        gruposSueldo.set(g, [...(gruposSueldo.get(g) ?? []), p])
      }
      const pagoPorId = new Map(pagosSueldoPrev.map((p: any) => [String(p.id), p]))
      const repartoEsperado = new Map<string, string>()
      for (const m of movimientosDelRango) {
        if (!m.sueldo_pago_id) continue
        const pago = pagoPorId.get(String(m.sueldo_pago_id))
        const hermanos = pago?.grupo_pago_id ? gruposSueldo.get(String(pago.grupo_pago_id)) ?? [] : []
        if (hermanos.length > 1) {
          repartoEsperado.set(m.id, repartoDelGrupo(hermanos.map((h: any) => ({
            nombre: h.empleado?.nombre ?? '', monto: parseFloat(h.monto) || 0,
          }))))
        }
      }

      const resultado = auditar({ movimientos: movimientosDelRango, categsDelPlan, cuadratura, origenes, repartoEsperado })
      if (hayRango) {
        resultado.noVerificado.push(
          'Las FACTURAS de ARCA no se auditaron: al filtrar por fecha se miran sólo los movimientos ' +
          'del rango, y una factura puede no tener movimiento todavía. Corré sin rango para verlas.')
      }
      setRes(resultado)

      /**
       * 🛠️ **A-FEAT-159 — qué de todo esto se puede arreglar solo.**
       *
       * Se arma el dato del ORIGEN para cada movimiento observado: quién cobra, el comprobante con
       * período y —si el pago es de un grupo de sueldos— el reparto por beneficiario. Con eso,
       * `agruparCorrecciones` decide qué es mecánico y qué necesita una persona.
       */
      const porTemplate = new Map(templates.map((t: any) => [String(t.id), t]))
      const datos = new Map<string, DatosParaCorregir>()

      // Los pagos de sueldo agrupados, para poder ofrecer el reparto.
      // Ya se trajeron arriba para el control `proveedor-incompleto`: no se consulta dos veces.
      const porPagoSueldo = pagoPorId
      const porGrupoSueldo = gruposSueldo

      for (const m of movimientosDelRango) {
        const tpl = m.template_id ? porTemplate.get(String(m.template_id)) : null
        const d: DatosParaCorregir = {}

        if (tpl) {
          d.proveedorDelOrigen = proveedorDelTemplate(tpl as any)
          d.comprobanteDelOrigen = identificadorDeCuota({ fecha_estimada: m.fecha }, tpl as any)
        }

        if (m.sueldo_pago_id) {
          const pago = porPagoSueldo.get(String(m.sueldo_pago_id))
          if (pago?.empleado?.nombre) d.proveedorDelOrigen = pago.empleado.nombre
          if (pago?.grupo_pago_id) {
            const hermanos = porGrupoSueldo.get(String(pago.grupo_pago_id)) ?? []
            if (hermanos.length > 1) {
              d.repartoDeBeneficiarios = repartoDelGrupo(hermanos.map((h: any) => ({
                nombre: h.empleado?.nombre ?? '', monto: parseFloat(h.monto) || 0,
              })))
            }
          }
        }
        datos.set(m.id, d)
      }

      setCorregibles(agruparCorrecciones(resultado.grupos.flatMap(g => g.causas.flatMap(c => c.ejemplos)), datos))
      setHechas({})
      setRangoCorrido(desde || hasta ? { desde, hasta } : null)
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setCorriendo(false)
    }
  }

  /**
   * 🛠️ Aplica las correcciones de UNA causa, con foto previa descargada al disco.
   *
   * 📸 **La foto se baja como archivo antes de escribir**: son datos reales y el usuario tiene que
   * poder volver atrás sin depender de que yo guarde nada (§ 🛑 Datos). Si la descarga falla, no se
   * escribe.
   */
  async function aplicarCausa(g: ResumenCorregible) {
    const clave = `${g.control}|${g.causa}`
    if (!confirm(
      `Se van a corregir ${g.corregibles} movimientos.

${g.correcciones[0]?.explicacion ?? ''}

` +
      `Antes se descarga una foto del estado actual. ¿Aplicar?`)) return

    setAplicando(clave)
    try {
      // 📸 Foto ANTES de tocar nada.
      const campos = [...new Set(g.correcciones.flatMap(c => Object.keys(c.parche)))]
      const antes: any[] = []
      for (const c of g.correcciones) {
        const ubic = tablaDeMov.current.get(c.movimientoId)
        if (!ubic) continue
        const q = ubic.schema !== 'public'
          ? supabase.schema(ubic.schema as any).from(ubic.tabla)
          : supabase.from(ubic.tabla)
        const { data } = await q.select(['id', ...campos].join(',')).eq('id', c.movimientoId).maybeSingle()
        if (data) antes.push({ ...(data as unknown as Record<string, unknown>), __tabla: ubic.tabla, __schema: ubic.schema })
      }
      const blob = new Blob([JSON.stringify({ causa: g.causa, fecha: new Date().toISOString(), antes }, null, 2)],
        { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `respaldo-audit-${g.control}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
      document.body.appendChild(a); a.click()
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 0)

      let ok = 0
      for (const c of g.correcciones) {
        const ubic = tablaDeMov.current.get(c.movimientoId)
        if (!ubic) continue
        const q = ubic.schema !== 'public'
          ? supabase.schema(ubic.schema as any).from(ubic.tabla)
          : supabase.from(ubic.tabla)
        const { error } = await q.update(c.parche).eq('id', c.movimientoId)
        if (!error) ok++
      }
      setHechas(h => ({ ...h, [clave]: ok }))
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setAplicando(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-700" />
              Auditoría de consistencia
            </span>
            <span className="flex gap-2">
              {res && (
                <Button variant="outline" onClick={() => exportarAuditoria(res)}>
                  <Download className="h-4 w-4 mr-2" />Descargar Excel
                </Button>
              )}
              <Button onClick={correr} disabled={corriendo}>
                {corriendo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revisando…</> : "Correr auditoría"}
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-3">
          <p>
            Revisa <b>todos los movimientos de las cuentas</b>, pero sólo le exige el estándar a los
            <b> conciliados</b>: un movimiento pendiente todavía no tiene decidido qué es.
          </p>

          {/* 📅 El rango, para mirar un lote de conciliación sin que el resto lo tape. */}
          <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-md border">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="border rounded px-2 py-1 text-sm" />
            </div>
            {/*
              📅 **Atajos de mes — pedido del usuario 2026-09-19**: *«para los filtros por fecha
              quiero que siempre para mes y año la app por default tenga el mes y el año actual»*.
              Con un click quedan puestos el 1 y el último día, sin tipear.

              📌 **Los campos arrancan VACÍOS a propósito**: si el default fuera el mes actual, la
              primera corrida mostraría 0 conciliados (todavía no hay nada de septiembre) y parecería
              que el audit no encuentra nada. El atajo da la comodidad sin esconder el universo.
            */}
            <Button variant="outline" size="sm" onClick={() => {
              const h = new Date()
              const p = (n: number) => String(n).padStart(2, '0')
              setDesde(`${h.getFullYear()}-${p(h.getMonth() + 1)}-01`)
              setHasta(`${h.getFullYear()}-${p(h.getMonth() + 1)}-${p(new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate())}`)
            }}>Este mes</Button>
            <Button variant="outline" size="sm" onClick={() => {
              const h = new Date(); const m = h.getMonth() - 1
              const y = m < 0 ? h.getFullYear() - 1 : h.getFullYear()
              const mes = ((m % 12) + 12) % 12
              const p = (n: number) => String(n).padStart(2, '0')
              setDesde(`${y}-${p(mes + 1)}-01`)
              setHasta(`${y}-${p(mes + 1)}-${p(new Date(y, mes + 1, 0).getDate())}`)
            }}>Mes anterior</Button>
            {(desde || hasta) && (
              <Button variant="ghost" size="sm" onClick={() => { setDesde(''); setHasta('') }}>
                Ver todo
              </Button>
            )}
            <p className="text-xs text-gray-500 flex-1 min-w-[16rem]">
              {desde || hasta
                ? 'Con rango se miran sólo los movimientos de esas fechas — útil para revisar el lote que acabás de conciliar. Las facturas de ARCA quedan fuera: no tienen fecha de movimiento.'
                : 'Sin rango audita todo. Poné fechas para mirar sólo un lote.'}
            </p>
          </div>

          <p className="text-gray-500">
            No corrige nada — muestra qué está fuera del estándar y dónde se arregla.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-800">
            <b>No se pudo completar:</b> {error}
          </CardContent>
        </Card>
      )}

      {res && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Resumen label="Movimientos" valor={res.universo}
              nota={rangoCorrido
                ? `del ${rangoCorrido.desde || '…'} al ${rangoCorrido.hasta || '…'}`
                : "en todas las cuentas"} />
            <Resumen label="Auditados" valor={res.auditados} nota="los conciliados" />
            <Resumen label="Sin observaciones" valor={res.limpios} nota="cumplen el estándar" tono="ok" />
            <Resumen
              label="Con observaciones"
              valor={res.auditados - res.limpios}
              nota={`${res.grupos.length} controles con hallazgos`}
              tono={res.auditados - res.limpios > 0 ? "alerta" : "ok"}
            />
          </div>

          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-2 text-xs">
              {Object.entries(res.porOrigen)
                .filter(([, n]) => n > 0)
                .map(([o, n]) => (
                  <Badge key={o} variant={o === "sin-vinculo" ? "destructive" : "secondary"}>
                    {o === "sin-vinculo" ? "sin vínculo" : o}: {n}
                  </Badge>
                ))}
            </CardContent>
          </Card>

          {res.noVerificado.map((n, i) => (
            <Card key={i} className="border-amber-300 bg-amber-50">
              <CardContent className="pt-6 text-sm text-amber-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span><b>No se pudo verificar:</b> {n}</span>
              </CardContent>
            </Card>
          ))}

          {res.grupos.length === 0 && (
            <Card className="border-green-300 bg-green-50">
              <CardContent className="pt-6 text-sm text-green-900 flex gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Los {res.auditados} movimientos conciliados cumplen el estándar.</span>
              </CardContent>
            </Card>
          )}

          {/*
            🛠️ **A-FEAT-159 — lo que el audit puede arreglar solo, para aprobar POR CAUSA.**

            📌 **Por causa y no por control**: dentro de «el detalle repite» conviven un arreglo
            obvio (vaciar el ruido) y uno que destruiría datos (mover lo que no está en otro lado).
            Un botón por control los mezclaría. Lo que necesita criterio simplemente no aparece acá.
          */}
          {corregibles.length > 0 && (
            <Card className="border-blue-300 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  🛠️ Se pueden corregir solos
                  <Badge variant="secondary">
                    {corregibles.reduce((n, g) => n + g.corregibles, 0)}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-gray-600">
                  Sólo aparece lo que se arregla copiando o borrando un dato que ya existe en otro lado.
                  Lo que hay que averiguar no se ofrece. <b>Antes de escribir se descarga una foto.</b>
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {corregibles.map(g => {
                  const clave = `${g.control}|${g.causa}`
                  const hecho = hechas[clave]
                  return (
                    <div key={clave} className="flex flex-wrap items-center gap-3 bg-white border rounded-md px-3 py-2 text-xs">
                      <span className="font-medium min-w-[10rem]">{g.causa}</span>
                      <span className="text-gray-500 flex-1 min-w-[14rem]">
                        {g.correcciones[0]?.explicacion}
                      </span>
                      {g.manuales > 0 && (
                        <Badge variant="outline" className="font-normal">
                          {g.manuales} quedan a mano
                        </Badge>
                      )}
                      {hecho !== undefined ? (
                        <Badge className="bg-green-600">✓ {hecho} corregidos</Badge>
                      ) : (
                        <Button size="sm" disabled={aplicando !== null}
                          onClick={() => aplicarCausa(g)}>
                          {aplicando === clave
                            ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Corrigiendo…</>
                            : `Corregir ${g.corregibles}`}
                        </Button>
                      )}
                    </div>
                  )
                })}
                <p className="text-xs text-gray-500 pt-1">
                  Después de corregir, volvé a correr la auditoría para ver cómo quedó.
                </p>
              </CardContent>
            </Card>
          )}

          {res.grupos.map(g => {
            const open = abierto[g.control] ?? false
            return (
              <Card key={g.control}>
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() => setAbierto(a => ({ ...a, [g.control]: !open }))}
                >
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="flex-1">{g.titulo}</span>
                    {g.enElOrigen > 0 && (
                      <Badge variant="outline" className="font-normal">
                        {g.enElOrigen} se arreglan en el origen
                      </Badge>
                    )}
                    <Badge variant="destructive">{g.total}</Badge>
                  </CardTitle>
                  <p className="text-xs text-gray-500 pl-6 font-normal">{g.regla}</p>
                </CardHeader>

                {open && (
                  <CardContent className="space-y-3 pt-0">
                    {g.causas.map((c, i) => (
                      <div key={i} className="border rounded-md">
                        <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs">
                          <span className="font-medium">{c.causa}</span>
                          <Badge variant="secondary">{c.cantidad}</Badge>
                        </div>
                        <div className="divide-y">
                          {c.ejemplos.slice(0, 8).map(h => <Fila key={h.movimientoId + h.control} h={h} />)}
                        </div>
                        {c.cantidad > 8 && (
                          <p className="px-3 py-2 text-xs text-gray-500">
                            … y {c.cantidad - 8} más con la misma causa
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

function Fila({ h }: { h: Hallazgo }) {
  return (
    <div className="px-3 py-2 text-xs flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {h.fecha && <span className="text-gray-500 tabular-nums">{h.fecha}</span>}
      <span className="text-gray-500">{h.cuenta}</span>
      {!!h.importe && <span className="font-medium tabular-nums">{money(h.importe)}</span>}
      <span className="flex-1 min-w-[12rem] text-gray-700">{h.descripcion ?? "—"}</span>
      {!!h.dependen && (
        <Badge variant="outline" className="font-normal">{h.dependen} movs dependen</Badge>
      )}
      <span className="text-amber-800">{h.problema}</span>
    </div>
  )
}

function Resumen({ label, valor, nota, tono }: {
  label: string; valor: number; nota: string; tono?: "ok" | "alerta"
}) {
  const color = tono === "ok" ? "text-green-700" : tono === "alerta" ? "text-red-700" : "text-gray-900"
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${color}`}>{valor.toLocaleString("es-AR")}</p>
        <p className="text-xs text-gray-500">{nota}</p>
      </CardContent>
    </Card>
  )
}
