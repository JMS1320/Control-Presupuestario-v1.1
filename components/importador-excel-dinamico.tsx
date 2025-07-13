"use client"

import { useState } from "react"

export default function ImportadorExcelDinamico() {
  const [file, setFile] = useState<File | null>(null)
  const [saldo, setSaldo] = useState("")
  const [tabla, setTabla] = useState("pam_galicia")
  const [mensaje, setMensaje] = useState("")
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !saldo || !tabla) {
      setMensaje("Faltan datos.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)
    formData.append("saldo_inicio", saldo)
    formData.append("tabla", tabla)

    setCargando(true)
    setMensaje("")

    const res = await fetch("/api/import-excel-dinamico", {
      method: "POST",
      body: formData,
    })

    const data = await res.json()
    setCargando(false)

    if (!res.ok) {
      setMensaje(`❌ Error: ${data.error}`)
    } else {
      setMensaje(`✅ Importación exitosa: ${data.cantidad} filas`)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4 border rounded bg-white shadow">
      <h2 className="text-xl font-bold">Importador Dinámico</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
        />
        <input
          type="number"
          placeholder="Saldo inicial"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          required
          className="border px-2 py-1 w-full"
        />
        <select
          value={tabla}
          onChange={(e) => setTabla(e.target.value)}
          className="border px-2 py-1 w-full"
        >
          <option value="pam_galicia">PAM Galicia</option>
          <option value="msa_galicia">MSA Galicia</option>
        </select>
        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {cargando ? "Importando..." : "Importar"}
        </button>
      </form>
      {mensaje && <div className="mt-4">{mensaje}</div>}
    </div>
  )
}
