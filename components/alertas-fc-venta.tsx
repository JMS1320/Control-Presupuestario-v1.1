"use client"

// Alerta: llegó una factura de venta y hay una venta esperando factura del mismo CUIT.
// El usuario confirma:
//   SÍ → quedan vinculadas: Cash Flow muestra SOLO la factura (la venta deja de contar).
//        Si la factura cubre menos que la venta, sigue el remanente sin facturar.
//   NO → la factura responde a otra cosa: dos ingresos separados, y la venta sigue
//        esperando su factura. La decisión se guarda para no volver a preguntar.
// El match es por CUIT nomás: las ventas son pocas (decisión del usuario, 2026-07-26).

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Link2, AlertTriangle, Check, X } from "lucide-react"

const fmtPesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`
const fmtAR = (n: number) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const parseAR = (v: string) => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0

interface Candidato {
  venta_id: string
  venta_tipo: string
  empresa: string
  centro_costo: string
  cliente_nombre: string
  cliente_cuit: string
  monto_venta: number
  facturado: number
  remanente: number
  comprobante_id: string
  nro_comprobante: string
  imp_total: number
  fecha_liquidacion: string | null
}

export function AlertasFcVenta() {
  const [cargando, setCargando] = useState(true)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [ventasSinCuit, setVentasSinCuit] = useState<string[]>([])
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState<string | null>(null)

  const clave = (c: Candidato) => `${c.venta_id}|${c.comprobante_id}`

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const [{ data: ventas }, { data: comprobantes }, { data: decisiones }] = await Promise.all([
        supabase.from("ventas_unificadas").select("*"),
        supabase.schema("msa").from("comprobantes_venta")
          .select("id, nro_comprobante, cuit_cliente, denominacion_cliente, imp_total, fecha_liquidacion")
          .neq("estado", "conciliado").neq("estado", "anterior"),
        supabase.from("ventas_facturas").select("venta_id, comprobante_id"),
      ])

      // Pares ya decididos (sí o no): no se vuelve a preguntar
      const decididos = new Set((decisiones || []).map((d: any) => `${d.venta_id}|${d.comprobante_id}`))

      // Ventas a las que todavía les falta facturar algo
      const pendientes = (ventas || []).filter((v: any) => {
        const monto = Number(v.monto_pesos) || 0
        return monto - (Number(v.facturado) || 0) > 0.01
      })

      // Sin CUIT no hay match posible — se avisa aparte
      setVentasSinCuit(
        pendientes.filter((v: any) => !v.cliente_cuit)
          .map((v: any) => `${v.centro_costo} (${v.cliente_nombre})`)
      )

      const out: Candidato[] = []
      for (const v of pendientes) {
        if (!v.cliente_cuit) continue
        for (const c of comprobantes || []) {
          if (String(c.cuit_cliente || "") !== String(v.cliente_cuit)) continue
          if (decididos.has(`${v.venta_id}|${c.id}`)) continue
          const monto = Number(v.monto_pesos) || 0
          const remanente = monto - (Number(v.facturado) || 0)
          out.push({
            venta_id: v.venta_id, venta_tipo: v.venta_tipo, empresa: v.empresa,
            centro_costo: v.centro_costo, cliente_nombre: v.cliente_nombre,
            cliente_cuit: v.cliente_cuit, monto_venta: monto,
            facturado: Number(v.facturado) || 0, remanente,
            comprobante_id: c.id, nro_comprobante: c.nro_comprobante || "",
            imp_total: Number(c.imp_total) || 0, fecha_liquidacion: c.fecha_liquidacion,
          })
        }
      }

      setCandidatos(out)
      // Default del monto asignado: lo que menos sea entre la factura y lo que falta facturar
      const m: Record<string, string> = {}
      out.forEach(c => { m[`${c.venta_id}|${c.comprobante_id}`] = fmtAR(Math.min(c.imp_total, c.remanente)) })
      setMontos(m)
    } finally { setCargando(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const decidir = async (c: Candidato, vinculado: boolean) => {
    const k = clave(c)
    setProcesando(k)
    try {
      const { error } = await supabase.from("ventas_facturas").insert({
        venta_tipo: c.venta_tipo,
        venta_id: c.venta_id,
        empresa: c.empresa,
        comprobante_id: c.comprobante_id,
        monto_asignado: vinculado ? parseAR(montos[k] ?? "0") : null,
        vinculado,
        nota: vinculado ? null : "El usuario indicó que la factura responde a otra cosa",
      })
      if (error) { alert("Error: " + error.message); return }
      await cargar()
    } finally { setProcesando(null) }
  }

  if (cargando) {
    return (
      <Card><CardContent className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando facturas de ventas…
      </CardContent></Card>
    )
  }

  if (candidatos.length === 0 && ventasSinCuit.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          Facturas de venta sin vincular
          {candidatos.length > 0 && <Badge variant="destructive">{candidatos.length}</Badge>}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {ventasSinCuit.length > 0 && (
          <p className="flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Estas ventas esperan factura pero <strong>el contrato no tiene CUIT</strong>, así que
              no se puede buscar coincidencia: {ventasSinCuit.join(" · ")}. Cargá el CUIT del
              cliente en el contrato (Ingresos → Arrendamiento).
            </span>
          </p>
        )}

        {candidatos.map(c => {
          const k = clave(c)
          const cubreTodo = parseAR(montos[k] ?? "0") >= c.remanente - 0.01
          return (
            <div key={k} className="rounded border p-3 space-y-2">
              <p className="text-sm">
                Llegó la factura <strong>{c.nro_comprobante || "(sin nº)"}</strong> de{" "}
                <strong>{c.cliente_nombre}</strong> por {fmtPesos(c.imp_total)}.
                ¿Es de la venta de <strong>{c.centro_costo}</strong> ({fmtPesos(c.monto_venta)}
                {c.facturado > 0 && `, ya facturada ${fmtPesos(c.facturado)}`})?
              </p>

              <div className="flex items-end gap-3">
                <div>
                  <label className="text-xs text-gray-500">Monto que corresponde a esta venta</label>
                  <Input className="h-8 w-44 text-right" value={montos[k] ?? ""}
                    onChange={e => setMontos(p => ({ ...p, [k]: e.target.value }))} />
                </div>
                <p className="pb-1 text-xs text-gray-500">
                  {cubreTodo
                    ? "Cubre todo lo que faltaba facturar"
                    : `Facturación parcial: quedan ${fmtPesos(c.remanente - parseAR(montos[k] ?? "0"))} sin facturar`}
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" disabled={procesando === k} onClick={() => decidir(c, true)}>
                  {procesando === k ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <><Check className="mr-1 h-3.5 w-3.5" /> Sí, es de esta venta</>}
                </Button>
                <Button size="sm" variant="outline" disabled={procesando === k}
                  onClick={() => decidir(c, false)}>
                  <X className="mr-1 h-3.5 w-3.5" /> No, es otra cosa
                </Button>
              </div>

              <p className="text-[11px] text-gray-400">
                Si decís que sí, Cash Flow deja de mostrar la venta y muestra la factura. Si decís
                que no, quedan como dos ingresos y la venta sigue esperando su factura.
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
