"use client"

/**
 * Aviso en Principal: movimientos importados que quedaron SIN PARSEAR.
 *
 * El banco manda toda la información apilada en una celda (tipo, CUIT, beneficiario, número de
 * operación). Las reglas de `config_parseo_extracto` la reparten en columnas. Si el desglose no
 * está hecho, el movimiento entra igual —el texto crudo se guarda siempre en `concepto`— pero no
 * se puede buscar por CUIT ni por beneficiario.
 *
 * Eso no rompe nada y por eso no se nota. Este aviso existe para que se note.
 *
 * ⚠️ **Y mira CUATRO causas, no una.** Hasta el 2026-09-25 preguntaba sólo *«¿el tipo tiene
 * regla?»*, y con eso **MA no aparecía nunca**: sus 12 tipos tenían las 42 reglas escritas y sus
 * 96 movimientos estaban igual en blanco, porque las reglas se cargaron después de importar y
 * **el re-parseo no se corrió**. La regla existía, el desglose no → A-BUG-1199.
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

interface Causas {
  sinRegla: number
  subtipoNuevo: number
  choque: number
  desglosePendiente: number
}

interface Diagnostico {
  id: string
  nombre: string
  empresa: Empresa
  sinParsear: number
  causas: Causas
  total: number
  tipos: { tipo: string; movimientos: number }[]
}

/**
 * Qué hacer con cada causa. El texto es la ACCIÓN, no el diagnóstico: las cuatro se arreglan en
 * lugares distintos, y un número sin la acción manda a escribir reglas que ya están escritas.
 */
const QUE_HACER: { clave: keyof Causas; titulo: string; accion: string; color: string }[] = [
  {
    clave: "desglosePendiente",
    titulo: "falta correr el re-parseo",
    accion: "la regla está escrita y el desglose guardado todavía no la tiene: Extracto Bancario → Re-parsear.",
    color: "border-sky-200 bg-sky-50 text-sky-900",
  },
  {
    clave: "sinRegla",
    titulo: "sin regla del tipo",
    accion: "hay que escribir la regla de esos tipos en el configurador, y después re-parsear.",
    color: "border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    clave: "subtipoNuevo",
    titulo: "subtipo nuevo",
    accion: "el tipo tiene reglas, pero el movimiento llegó con otras líneas y ninguna es de ese subtipo: falta cargar ese subtipo.",
    color: "border-violet-200 bg-violet-50 text-violet-900",
  },
  {
    clave: "choque",
    titulo: "reglas en conflicto",
    accion: "dos reglas reclaman la misma columna. Una está mal escrita, y no se parsea hasta corregirla.",
    color: "border-red-300 bg-red-50 text-red-900",
  },
]

export function AlertaParseoPendiente() {
  const [pendientes, setPendientes] = useState<Diagnostico[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false

    Promise.all(CUENTAS_CON_PARSEO.map(async (c): Promise<Diagnostico | null> => {
      try {
        const r = await fetch(`/api/reparsear-extracto?cuenta=${c.id}`)
        const j = await r.json()
        if (!j.ok || !j.sinParsear) return null
        return {
          ...c,
          sinParsear: j.sinParsear,
          causas: j.causas ?? { sinRegla: 0, subtipoNuevo: 0, choque: 0, desglosePendiente: 0 },
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

  const totalSinParsear = pendientes.reduce((s, p) => s + p.sinParsear, 0)
  // Un choque es una regla mal escrita, no trabajo pendiente: se ve distinto a propósito.
  const hayChoque = pendientes.some(p => p.causas.choque > 0)

  return (
    <Card className={`entrada-suave ${hayChoque ? "border-red-300 bg-red-50" : "border-sky-300 bg-sky-50"}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <FileWarning className={`h-5 w-5 shrink-0 mt-0.5 ${hayChoque ? "text-red-700" : "text-sky-700"}`} />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${hayChoque ? "text-red-900" : "text-sky-900"}`}>
              {totalSinParsear} movimiento{totalSinParsear === 1 ? "" : "s"} sin parsear
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Entraron bien y el texto del banco está completo, pero la información no quedó
              repartida en columnas — hoy no se puede buscar por CUIT ni por beneficiario.
            </p>

            <div className="mt-2.5 space-y-3">
              {pendientes.map(p => (
                <div key={p.id}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded border px-1 text-[10px] leading-4 ${COLOR_EMPRESA[p.empresa]}`}>
                      {p.empresa}
                    </span>
                    <span className="text-gray-800">{p.nombre}</span>
                    <span className="font-medium text-sky-800">
                      {p.sinParsear} de {p.total}
                    </span>
                  </div>

                  {/* Por causa, porque cada una se arregla en otro lugar */}
                  <div className="mt-1.5 space-y-1">
                    {QUE_HACER.filter(q => p.causas[q.clave] > 0).map(q => (
                      <div key={q.clave} className={`rounded border px-2 py-1 text-[11px] leading-4 ${q.color}`}>
                        <strong>{p.causas[q.clave]}</strong> · {q.titulo} — {q.accion}
                      </div>
                    ))}
                  </div>

                  {/* Los tipos sin regla, por cantidad: el primero es el que más rinde escribir */}
                  {p.causas.sinRegla > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.tipos.slice(0, 6).map(t => (
                        <span key={t.tipo}
                          className="rounded border border-amber-200 bg-white px-1.5 text-[11px] leading-5 text-gray-700"
                          title={`${t.movimientos} movimiento(s) de este tipo, sin regla`}>
                          {t.tipo} <strong className="text-amber-800">{t.movimientos}</strong>
                        </span>
                      ))}
                      {p.tipos.length > 6 && (
                        <span className="text-[11px] leading-5 text-gray-500">
                          +{p.tipos.length - 6} tipo{p.tipos.length - 6 === 1 ? "" : "s"} más
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500 mt-2.5">
              <strong>No hay que volver a importar nunca</strong>: el texto original del banco queda
              guardado entero, así que las cuatro se resuelven escribiendo la regla y corriendo{" "}
              <strong>Re-parsear</strong> desde Extracto Bancario.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
