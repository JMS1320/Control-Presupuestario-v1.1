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

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import {
  auditar, importeDe,
  type MovimientoAuditable, type ResultadoAuditoria, type ParCuadratura, type Hallazgo,
} from "@/lib/conciliacion/auditoria"
import { ShieldCheck, AlertTriangle, ChevronDown, ChevronRight, Loader2, CheckCircle2 } from "lucide-react"

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
            sueldo_pago_id: f.sueldo_pago_id ?? null,
            anticipo_id: f.anticipo_id ?? null,
            comprobante_venta_id: f.comprobante_venta_id ?? null,
          })
        }
      }

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
      for (const m of movimientos) {
        const v = m.template_cuota_id
        if (!v || String(m.estado ?? "").toLowerCase() !== "conciliado") continue
        const origen = porGrupo.has(String(v)) ? porGrupo.get(String(v))! : porCuota.get(String(v))
        if (origen === undefined) continue
        cuadratura.push({ movimientoId: m.id, importeBanco: importeDe(m), importeOrigen: origen })
      }

      setRes(auditar({ movimientos, categsDelPlan, cuadratura }))
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setCorriendo(false)
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
            <Button onClick={correr} disabled={corriendo}>
              {corriendo ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Revisando…</> : "Correr auditoría"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-1">
          <p>
            Revisa <b>todos los movimientos de las cuentas</b>, pero sólo le exige el estándar a los
            <b> conciliados</b>: un movimiento pendiente todavía no tiene decidido qué es.
          </p>
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
            <Resumen label="Movimientos" valor={res.universo} nota="en todas las cuentas" />
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
      <span className="text-gray-500 tabular-nums">{h.fecha ?? "sin fecha"}</span>
      <span className="text-gray-500">{h.cuenta}</span>
      <span className="font-medium tabular-nums">{money(h.importe)}</span>
      <span className="flex-1 min-w-[12rem] text-gray-700">{h.descripcion ?? "—"}</span>
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
