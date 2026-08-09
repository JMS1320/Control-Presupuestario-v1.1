"use client"

/**
 * Aviso en Principal: movimientos importados que quedaron SIN DESGLOSAR.
 *
 * El banco manda toda la información apilada en una celda (tipo, CUIT, beneficiario, número de
 * operación). Las reglas de `config_parseo_extracto` la reparten en columnas. Si falta la regla
 * de un tipo, el movimiento entra igual —el texto crudo se guarda siempre en `concepto`— pero
 * queda **sin desglosar**: no se puede buscar por CUIT ni por beneficiario.
 *
 * Eso no rompe nada y por eso no se nota. Este aviso existe para que se note, y para que se vea
 * **qué tipo conviene atacar primero** — están ordenados por cantidad de movimientos.
 *
 * Sólo mira las cuentas de **Caja de Ahorro**: son las únicas cuyo importador desglosa por reglas.
 */

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FileWarning } from "lucide-react"
import { COLOR_EMPRESA, type Empresa } from "@/lib/empresas"

/** Las cuentas cuyo importador usa reglas de parseo. Ver `app/api/import-excel-ca`. */
const CUENTAS_CON_PARSEO: { id: string; nombre: string; empresa: Empresa }[] = [
  { id: "pam_galicia", nombre: "PAM Galicia CA", empresa: "PAM" },
  { id: "ma_galicia", nombre: "MA Galicia CA", empresa: "MA" },
]

interface Diagnostico {
  id: string
  nombre: string
  empresa: Empresa
  sinDesglosar: number
  total: number
  tipos: { tipo: string; movimientos: number }[]
}

export function AlertaParseoPendiente() {
  const [pendientes, setPendientes] = useState<Diagnostico[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false

    Promise.all(CUENTAS_CON_PARSEO.map(async (c): Promise<Diagnostico | null> => {
      try {
        const r = await fetch(`/api/reparsear-extracto?cuenta=${c.id}`)
        const j = await r.json()
        if (!j.ok || !j.sinDesglosar) return null
        return {
          ...c,
          sinDesglosar: j.sinDesglosar,
          total: j.totalMovimientos,
          tipos: j.tiposSinRegla ?? [],
        }
      } catch (e) {
        console.error(`Alerta parseo — error en ${c.id}:`, e)
        return null
      }
    })).then(res => {
      if (cancelado) return
      setPendientes(res.filter(Boolean) as Diagnostico[])
      setCargando(false)
    })

    return () => { cancelado = true }
  }, [])

  if (cargando || pendientes.length === 0) return null

  const totalSinDesglosar = pendientes.reduce((s, p) => s + p.sinDesglosar, 0)

  return (
    <Card className="border-sky-300 bg-sky-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <FileWarning className="h-5 w-5 shrink-0 mt-0.5 text-sky-700" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sky-900">
              {totalSinDesglosar} movimiento{totalSinDesglosar === 1 ? '' : 's'} sin desglosar
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Entraron bien y el texto del banco está completo, pero falta la regla que lo reparta
              en columnas — hoy no se puede buscar por CUIT ni por beneficiario.
            </p>

            <div className="mt-2.5 space-y-2.5">
              {pendientes.map(p => (
                <div key={p.id}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded border px-1 text-[10px] leading-4 ${COLOR_EMPRESA[p.empresa]}`}>
                      {p.empresa}
                    </span>
                    <span className="text-gray-800">{p.nombre}</span>
                    <span className="font-medium text-sky-800">
                      {p.sinDesglosar} de {p.total}
                    </span>
                  </div>
                  {/* Ordenados por cantidad: el primero es el que más rinde escribir */}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.tipos.slice(0, 6).map(t => (
                      <span key={t.tipo}
                        className="rounded border border-sky-200 bg-white px-1.5 text-[11px] leading-5 text-gray-700"
                        title={`${t.movimientos} movimiento(s) de este tipo, sin regla`}>
                        {t.tipo} <strong className="text-sky-800">{t.movimientos}</strong>
                      </span>
                    ))}
                    {p.tipos.length > 6 && (
                      <span className="text-[11px] leading-5 text-gray-500">
                        +{p.tipos.length - 6} tipo{p.tipos.length - 6 === 1 ? '' : 's'} más
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500 mt-2.5">
              Se resuelve cargando la regla del tipo y corriendo <strong>Re-parsear</strong> desde
              Extracto Bancario. <strong>No hay que volver a importar</strong>: el texto original
              quedó guardado.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
