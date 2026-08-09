"use client"

/**
 * Aviso en Principal cuando hace mucho que no se carga el extracto de una cuenta bancaria.
 *
 * Por qué existe: un extracto que no se importa no genera ningún error — simplemente el Cash Flow
 * y la conciliación siguen andando con datos viejos, y eso no se nota hasta que los números no
 * cierran. Es el mismo modo de falla que veníamos persiguiendo: **el silencio miente**.
 *
 * Sólo mira **cuentas bancarias** (cajas de ahorro y cuentas corrientes). Las cajas de efectivo y
 * las tarjetas quedan afuera a propósito: no son extractos que el banco publique periódicamente,
 * así que "hace 40 días que no se carga" no significa lo mismo para ellas.
 */

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Landmark } from "lucide-react"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { COLOR_EMPRESA, type Empresa } from "@/lib/empresas"

/** A partir de acá se avisa. Un extracto bancario se publica todos los meses. */
const DIAS_PARA_AVISAR = 30
/** Y a partir de acá el aviso se pone rojo: ya es más de un mes de atraso sobre el umbral. */
const DIAS_GRAVE = 60

interface EstadoCuenta {
  id: string
  nombre: string
  empresa: string
  ultimaFecha: string | null
  dias: number | null   // null = nunca se importó nada
}

export function AlertaExtractosDesactualizados() {
  const [atrasadas, setAtrasadas] = useState<EstadoCuenta[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false

    const revisar = async () => {
      // Sólo bancos: las cajas de efectivo y las tarjetas no son extractos periódicos
      const cuentas = CUENTAS_BANCARIAS.filter(c => c.activa && c.tipo === 'banco')
      const hoy = new Date().toISOString().split('T')[0]

      const estados = await Promise.all(cuentas.map(async (c): Promise<EstadoCuenta> => {
        const db = c.schema_bd && c.schema_bd !== 'public' ? supabase.schema(c.schema_bd) : supabase
        const { data, error } = await db
          .from(c.tabla_bd)
          .select('fecha')
          .order('fecha', { ascending: false })
          .limit(1)

        const base = { id: c.id, nombre: c.nombre, empresa: c.empresa }
        // Si la consulta falla no se inventa un atraso: se omite y queda en el log
        if (error) {
          console.error(`Alerta extractos — error leyendo ${c.tabla_bd}:`, error)
          return { ...base, ultimaFecha: null, dias: -1 }
        }
        const ultimaFecha = data?.[0]?.fecha ?? null
        if (!ultimaFecha) return { ...base, ultimaFecha: null, dias: null }

        const dias = Math.floor(
          (new Date(hoy + 'T00:00:00').getTime() - new Date(ultimaFecha + 'T00:00:00').getTime()) / 86400000
        )
        return { ...base, ultimaFecha, dias }
      }))

      if (cancelado) return
      // `dias === -1` es el marcador de "no se pudo leer": no se muestra como atraso
      setAtrasadas(estados.filter(e => e.dias === null || (e.dias !== -1 && e.dias > DIAS_PARA_AVISAR)))
      setCargando(false)
    }

    revisar()
    return () => { cancelado = true }
  }, [])

  if (cargando || atrasadas.length === 0) return null

  const hayGrave = atrasadas.some(a => a.dias === null || a.dias >= DIAS_GRAVE)

  return (
    <Card className={hayGrave ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${hayGrave ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${hayGrave ? 'text-red-900' : 'text-amber-900'}`}>
              {atrasadas.length === 1
                ? 'Hay una cuenta bancaria sin cargar el extracto'
                : `Hay ${atrasadas.length} cuentas bancarias sin cargar el extracto`}
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              El Cash Flow y la conciliación siguen funcionando con lo último cargado — no avisan solos.
            </p>

            <ul className="mt-2.5 space-y-1.5">
              {atrasadas.map(a => {
                const nunca = a.dias === null
                const grave = nunca || (a.dias as number) >= DIAS_GRAVE
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded border px-1 text-[10px] leading-4 ${
                      COLOR_EMPRESA[a.empresa as Empresa] || 'border-gray-200 bg-gray-100 text-gray-600'}`}>
                      {a.empresa}
                    </span>
                    <Landmark className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-gray-800">{a.nombre}</span>
                    <span className={`font-medium ${grave ? 'text-red-700' : 'text-amber-700'}`}>
                      {nunca
                        ? 'nunca se importó'
                        : `${a.dias} días sin cargar`}
                    </span>
                    {a.ultimaFecha && (
                      <span className="text-xs text-gray-500">
                        (último movimiento: {new Date(a.ultimaFecha + 'T12:00:00').toLocaleDateString('es-AR')})
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>

            <p className="text-[11px] text-gray-500 mt-2.5">
              Se cargan desde <strong>Extracto Bancario</strong>. Se avisa a partir de los {DIAS_PARA_AVISAR} días
              desde el último movimiento; en rojo, a partir de {DIAS_GRAVE}.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
