'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ImportadorDinamico() {
  const [file, setFile] = useState<File | null>(null)
  const [saldoInicio, setSaldoInicio] = useState('')
  const [tablaSeleccionada, setTablaSeleccionada] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [esPrimeraCarga, setEsPrimeraCarga] = useState<boolean | null>(null)

  useEffect(() => {
    async function verificarPrimeraCarga(tabla: string) {
      const { data, error } = await supabase
        .from(tabla)
        .select('id')
        .limit(1)

      setEsPrimeraCarga(data?.length === 0)
    }

    if (tablaSeleccionada) {
      verificarPrimeraCarga(tablaSeleccionada.toLowerCase())
    }
  }, [tablaSeleccionada])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !tablaSeleccionada) {
      setMensaje('Faltan datos.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tabla', tablaSeleccionada)

    if (esPrimeraCarga && saldoInicio !== '') {
      formData.append('saldo_inicio', saldoInicio)
    }

    const res = await fetch('/api/import-excel-dinamico', {
      method: 'POST',
      body: formData
    })

    if (res.ok) {
      const json = await res.json()
      setMensaje(`Importación exitosa: ${json.count ?? '??'} filas`)
    } else {
      const error = await res.json()
      setMensaje(`Error: ${error.error}`)
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto border rounded-md shadow">
      <h1 className="text-xl font-bold mb-4">Importador Dinámico</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".xlsx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />

        {esPrimeraCarga === true && (
          <input
            type="number"
            step="any"
            placeholder="Saldo inicial"
            value={saldoInicio}
            onChange={(e) => setSaldoInicio(e.target.value)}
            required
            className="w-full px-2 py-1 border rounded"
          />
        )}

        <select
          value={tablaSeleccionada}
          onChange={(e) => setTablaSeleccionada(e.target.value)}
          required
          className="w-full px-2 py-1 border rounded"
        >
          <option value="">Seleccionar banco</option>
          <option value="pam_galicia">PAM Galicia</option>
          <option value="msa_galicia">MSA Galicia</option>
        </select>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Importar
        </button>
      </form>

      {mensaje && (
        <p className="mt-4 text-sm text-gray-700">{mensaje}</p>
      )}
    </div>
  )
}
