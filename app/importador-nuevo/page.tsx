'use client'

import { useState, useEffect } from 'react'

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [saldoInicio, setSaldoInicio] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [tabla, setTabla] = useState('pam galicia')
  const [esPrimeraCarga, setEsPrimeraCarga] = useState<boolean | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    async function verificar() {
      const res = await fetch('/api/verificar-tabla?tabla=' + tabla)
      const data = await res.json()
      setEsPrimeraCarga(data.vacia)
    }
    verificar()
  }, [tabla])

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!file) return

    if (esPrimeraCarga && saldoInicio === '') {
      setMensaje('Debe ingresar el saldo inicial')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tabla', tabla)
    if (esPrimeraCarga) formData.append('saldo_inicio', saldoInicio)

    setCargando(true)
    setMensaje('Importando...')

    const res = await fetch('/api/import-excel-dinamico', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    setCargando(false)

    if (res.ok) {
      setMensaje(`Importación exitosa: ${data.filas} filas`)
    } else {
      setMensaje(`Error: ${data.error || 'desconocido'}`)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Importador Dinámico</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        {esPrimeraCarga && (
          <input
            type="number"
            required
            placeholder="Saldo inicial"
            value={saldoInicio}
            onChange={(e) => setSaldoInicio(e.target.value)}
            className="w-full border p-2 rounded"
          />
        )}

        <select
          value={tabla}
          onChange={(e) => setTabla(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="pam galicia">PAM Galicia</option>
          <option value="msa galicia">MSA Galicia</option>
        </select>

        <button
          type="submit"
          disabled={cargando || (esPrimeraCarga && saldoInicio === '')}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {cargando ? 'Importando...' : 'Importar'}
        </button>
      </form>

      {mensaje && (
        <div className="mt-4 p-2 border rounded bg-gray-100">{mensaje}</div>
      )}
    </div>
  )
}
