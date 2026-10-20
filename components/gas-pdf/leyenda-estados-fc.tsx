'use client'

/**
 * 🏷️ La leyenda de los estados FC (A-FEAT-1287). Se ve en el buscador de PDFs y en Facturas ARCA, y
 * sale del glosario único (`lib/gas-pdf/estados-fc.ts`): cambiar un significado ahí lo cambia en
 * todas las pantallas.
 *
 * `flotante`: se despliega encima (para la barra de botones, donde no hay lugar para que empuje).
 */
import { useState } from 'react'
import { ESTADOS_FC } from '@/lib/gas-pdf/estados-fc'

export function LeyendaEstadosFc({ flotante = false }: { flotante?: boolean }) {
  const [ver, setVer] = useState(false)
  return (
    <div className={`text-[11px] ${flotante ? 'relative inline-block self-center' : ''}`}>
      <button type="button" className="text-blue-600 underline whitespace-nowrap" onClick={() => setVer(v => !v)}>
        {ver ? 'Ocultar estados FC' : '¿Qué significa cada estado FC?'}
      </button>
      {ver && (
        <table className={`mt-1 border rounded bg-white ${flotante ? 'absolute right-0 z-40 shadow-lg w-[520px]' : ''}`}>
          <tbody>
            {ESTADOS_FC.map(e => (
              <tr key={e.valor} className="border-b last:border-0">
                <td className="px-2 py-0.5 whitespace-nowrap"><span className={`px-1.5 py-0.5 rounded font-medium ${e.color}`}>{e.valor}</span></td>
                <td className="px-2 py-0.5 text-gray-700">{e.significado}</td>
                <td className="px-2 py-0.5 text-gray-400 whitespace-nowrap">{e.quien}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
