"use client"

/**
 * 💱 Alerta en Principal: NC (o ND) esperadas por diferencia de cambio — A-FEAT-1255.
 *
 * Facturas en dólares pagadas a otro TC: muestra cuánto se espera y si ya llegó (la reconoce sola al
 * importarla de ARCA). La cuenta vive en `lib/pagos/nc-diferencia-cambio.ts`.
 */

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { emparejar, TIPOS_NC, TIPOS_ND, type Esperada, type FacturaPagadaUsd, type ComprobanteAjuste } from "@/lib/pagos/nc-diferencia-cambio"
import { hoyArgentina } from "@/lib/fechas"

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (f: string | null) => f ? f.split('-').reverse().join('/') : ''

export function AlertaNcDiferenciaCambio() {
  const [esperadas, setEsperadas] = useState<Esperada[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [verRecibidas, setVerRecibidas] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const arca = () => supabase.schema('msa').from('comprobantes_arca')
        const hace = new Date(hoyArgentina() + 'T12:00:00'); hace.setFullYear(hace.getFullYear() - 1)
        const { data: fs, error: e1 } = await arca()
          .select('id, cuit, denominacion_emisor, punto_venta, numero_desde, fecha_pago, imp_total, tipo_cambio, tc_pago, moneda, tipo_comprobante')
          .eq('moneda', 'USD').not('tc_pago', 'is', null).gte('fecha_pago', hace.toISOString().slice(0, 10))
        if (e1) throw e1
        const facturas: FacturaPagadaUsd[] = (fs || [])
          .filter((f: any) => !TIPOS_NC.has(Number(f.tipo_comprobante)) && !TIPOS_ND.has(Number(f.tipo_comprobante)))
          .map((f: any) => ({
            id: f.id, cuit: f.cuit, proveedor: f.denominacion_emisor || '', numero: `FC ${Number(f.punto_venta || 0)}-${Number(f.numero_desde || 0)}`,
            fecha_pago: f.fecha_pago, imp_total: Number(f.imp_total) || 0, tipo_cambio: Number(f.tipo_cambio) || 0, tc_pago: Number(f.tc_pago) || 0,
          }))
        const cuits = [...new Set(facturas.map(f => f.cuit))]
        let ajustes: ComprobanteAjuste[] = []
        if (cuits.length) {
          const { data: as, error: e2 } = await arca()
            .select('id, cuit, fecha_emision, punto_venta, numero_desde, tipo_comprobante, imp_total, moneda, tipo_cambio')
            .in('cuit', cuits).in('tipo_comprobante', [...TIPOS_NC, ...TIPOS_ND])
          if (e2) throw e2
          ajustes = (as || []).map((a: any) => ({
            id: a.id, cuit: a.cuit, fecha: a.fecha_emision, numero: `${TIPOS_NC.has(Number(a.tipo_comprobante)) ? 'NC' : 'ND'} ${Number(a.punto_venta || 0)}-${Number(a.numero_desde || 0)}`,
            clase: TIPOS_NC.has(Number(a.tipo_comprobante)) ? 'NC' : 'ND',
            importePesos: (Number(a.imp_total) || 0) * (a.moneda && a.moneda !== 'PES' && a.moneda !== 'ARS' ? (Number(a.tipo_cambio) || 1) : 1),
          }))
        }
        setEsperadas(emparejar(facturas, ajustes))
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [])

  if (error) return <Card><CardContent className="p-3 text-sm text-red-700">No se pudieron calcular las NC por diferencia de cambio: {error}</CardContent></Card>
  if (!esperadas || esperadas.length === 0) return null
  const pendientes = esperadas.filter(e => !e.recibida)
  const recibidas = esperadas.filter(e => e.recibida)

  return (
    <Card className={pendientes.length ? 'border-amber-300' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">💱 Diferencia de cambio — NC / ND esperadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {pendientes.length === 0 && <p className="text-emerald-700">✓ Llegaron todas.</p>}
        {pendientes.map(e => (
          <div key={e.factura.id} className="rounded bg-amber-50 px-2 py-1">
            <b>{e.factura.proveedor}</b>: se espera una <b>{e.clase}</b> por <b>{pesos(e.monto)}</b>
            <span className="text-xs text-gray-600"> — {e.factura.numero} (USD {e.factura.imp_total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}),
              TC factura {e.factura.tipo_cambio.toLocaleString('es-AR')} · pagada {dmy(e.factura.fecha_pago)} a {e.factura.tc_pago.toLocaleString('es-AR')}</span>
          </div>
        ))}
        {recibidas.length > 0 && (
          <button type="button" className="text-xs text-gray-500 underline" onClick={() => setVerRecibidas(v => !v)}>
            {verRecibidas ? 'ocultar' : 'ver'} las {recibidas.length} que ya llegaron
          </button>
        )}
        {verRecibidas && recibidas.map(e => (
          <div key={e.factura.id} className="text-xs text-emerald-800">
            ✓ {e.factura.proveedor} · {e.factura.numero}: {e.recibida!.numero} del {dmy(e.recibida!.fecha)} por {pesos(Math.abs(e.recibida!.importePesos))} (esperada {pesos(e.monto)})
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
