"use client"

import { useState } from "react"
import type { ResultadoCuadratura } from "@/lib/subdiarios/cuadratura"

// Control de cuadratura del subdiario — compartido por IVA Compras e IVA Ventas.
// Verifica: Total general − Neto − Exento/No Grav. − IVA − Otros Trib. − (sin crédito) = 0
// Ver el porqué de la tolerancia en lib/subdiarios/cuadratura.ts.

const fmt = (n: number) =>
  `$${(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Props {
  resultado: ResultadoCuadratura
  /** Cómo se llama el bloque que no abre columnas. Compras: "Fac B y C"; Ventas: "Monotributo". */
  etiquetaSinCredito?: string
  /** Ventas no tiene la columna Otros Tributos: se oculta el término para no mostrar un 0 fijo. */
  mostrarOtrosTributos?: boolean
}

export function ControlCuadraturaSubdiario({
  resultado,
  etiquetaSinCredito = 'No genera crédito fiscal',
  mostrarOtrosTributos = true,
}: Props) {
  const [verDetalle, setVerDetalle] = useState(false)
  const r = resultado
  if (!r || r.cantidad === 0) return null

  const estado = !r.ok ? 'error' : r.soloRedondeo ? 'redondeo' : 'ok'
  const estilos = {
    ok:       { caja: 'bg-green-50 border-green-300',  texto: 'text-green-800',  icono: '✅' },
    redondeo: { caja: 'bg-green-50 border-green-300',  texto: 'text-green-800',  icono: '✅' },
    error:    { caja: 'bg-red-50 border-red-400',      texto: 'text-red-800',    icono: '🚨' },
  }[estado]

  const terminos: [string, number][] = [
    ['Total general', r.totalGeneral],
    ['− Neto Gravado', r.netoGravado],
    ['− Exento / No Gravado', r.exentoNoGravado],
    ['− IVA', r.iva],
    ...(mostrarOtrosTributos ? [['− Otros Tributos', r.otrosTributos] as [string, number]] : []),
    [`− ${etiquetaSinCredito}`, r.sinCredito],
  ]

  return (
    <div className={`border rounded-md p-3 ${estilos.caja}`}>
      <div className={`flex items-center gap-2 font-semibold text-sm ${estilos.texto}`}>
        <span>{estilos.icono}</span>
        <span>Control de cuadratura</span>
        <span className="ml-auto font-mono">
          Diferencia: {fmt(r.diferencia)}
        </span>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="text-xs">
          <tbody>
            <tr>
              {terminos.map(([label]) => (
                <td key={label} className="px-2 py-0.5 text-gray-600 whitespace-nowrap">{label}</td>
              ))}
              <td className="px-2 py-0.5 text-gray-600 whitespace-nowrap font-medium">= Diferencia</td>
            </tr>
            <tr className="font-mono">
              {terminos.map(([label, valor]) => (
                <td key={label} className="px-2 py-0.5 text-right whitespace-nowrap">{fmt(valor)}</td>
              ))}
              <td className={`px-2 py-0.5 text-right whitespace-nowrap font-bold ${estilos.texto}`}>
                {fmt(r.diferencia)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className={`mt-2 text-xs ${estilos.texto}`}>
        {estado === 'error' && (
          <>
            <strong>El período no cuadra.</strong> La diferencia supera la tolerancia de{' '}
            {fmt(r.tolerancia)} ({r.cantidad} comprobantes × $0,05 de redondeo).
            {r.descuadres.length === 0 && ' Ningún comprobante descuadra individualmente: revisá si falta alguno o si hay un tipo mal clasificado.'}
          </>
        )}
        {estado === 'redondeo' && (
          <>Cuadra. El residuo de {fmt(r.diferencia)} es redondeo del emisor, dentro de la tolerancia de {fmt(r.tolerancia)}.</>
        )}
        {estado === 'ok' && <>Cuadra exacto sobre {r.cantidad} comprobantes.</>}
      </p>

      {r.descuadres.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setVerDetalle(v => !v)}
            className={`text-xs underline ${estilos.texto}`}
          >
            {verDetalle ? 'Ocultar' : `Ver los ${r.descuadres.length} comprobante(s) que no cierran`}
          </button>
          {verDetalle && (
            <div className="mt-2 overflow-x-auto bg-white border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Fecha</th>
                    <th className="px-2 py-1 text-left font-medium">Comprobante</th>
                    <th className="px-2 py-1 text-left font-medium">Razón Social</th>
                    <th className="px-2 py-1 text-right font-medium">Imp. Total</th>
                    <th className="px-2 py-1 text-right font-medium">Suma de partes</th>
                    <th className="px-2 py-1 text-right font-medium">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {r.descuadres.map((d, i) => (
                    <tr key={d.id || i} className="border-t">
                      <td className="px-2 py-1 whitespace-nowrap">{d.fecha}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{d.comprobante}</td>
                      <td className="px-2 py-1">{d.nombre}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">{fmt(d.imp_total)}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap">{fmt(d.suma_partes)}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap font-medium text-red-700">{fmt(d.diferencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
