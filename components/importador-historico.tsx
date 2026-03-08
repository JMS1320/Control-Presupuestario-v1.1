"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, CheckCircle, AlertTriangle, Loader2, Archive } from "lucide-react"

interface ImportResult {
  success: boolean
  message: string
  insertados?: number
  saltadas?: number
  totalFilas?: number
  erroresParseo?: string[]
  erroresInsert?: string[]
}

export function ImportadorHistorico() {
  const [file, setFile] = useState<File | null>(null)
  const [empresa, setEmpresa] = useState<"MSA" | "PAM">("MSA")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResult(null)
  }

  const handleImportar = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("empresa", empresa)

      const res = await fetch("/api/import-historico", { method: "POST", body: fd })
      const data: ImportResult = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Error de red" })
    } finally {
      setLoading(false)
    }
  }

  const totalErrores = (result?.erroresParseo?.length ?? 0) + (result?.erroresInsert?.length ?? 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Importar Comprobantes Históricos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <AlertDescription>
              <strong>Tabla separada — no afecta datos operacionales.</strong> Los comprobantes históricos
              se guardan en <code>msa.comprobantes_historico</code> y <em>no aparecen</em> en Cash Flow,
              Templates ni Extracto Bancario.
            </AlertDescription>
          </Alert>

          {/* Empresa */}
          <div className="space-y-2">
            <Label>Empresa</Label>
            <RadioGroup
              value={empresa}
              onValueChange={(v) => setEmpresa(v as "MSA" | "PAM")}
              className="flex gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="MSA" id="emp-msa" />
                <Label htmlFor="emp-msa">MSA</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="PAM" id="emp-pam" />
                <Label htmlFor="emp-pam">PAM</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Archivo */}
          <div className="space-y-2">
            <Label htmlFor="file-historico">Archivo Excel (.xlsx)</Label>
            <input
              id="file-historico"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="text-xs text-gray-500">
                Archivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold">Columnas esperadas (solapa "FC semestre 2"):</p>
            <p>Fecha · Tipo · Punto de Venta · Número Desde · Nro. Doc. Emisor ·
              Denominación Emisor · Imp. Neto Gravado · Imp. Neto No Gravado ·
              Imp. Op. Exentas · Percepcion IIBB · Percepcion IVA · Otros Tributos ·
              IVA · Imp. Total · <strong>FC</strong> · <strong>Cuenta Contable</strong> ·
              Año contable · Mes contable</p>
            <p className="mt-1">Se saltan filas vacías y filas con Tipo o FC = "x".</p>
          </div>

          <Button
            onClick={handleImportar}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado */}
      {result && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription className="font-semibold">{result.message}</AlertDescription>
            </Alert>

            {result.success && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded bg-green-50 p-3">
                  <p className="text-2xl font-bold text-green-700">{result.insertados ?? 0}</p>
                  <p className="text-xs text-green-600">Insertados</p>
                </div>
                <div className="rounded bg-gray-50 p-3">
                  <p className="text-2xl font-bold text-gray-700">{result.saltadas ?? 0}</p>
                  <p className="text-xs text-gray-600">Saltadas</p>
                </div>
                <div className="rounded bg-orange-50 p-3">
                  <p className="text-2xl font-bold text-orange-700">{totalErrores}</p>
                  <p className="text-xs text-orange-600">Errores</p>
                </div>
              </div>
            )}

            {(result.erroresParseo?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">Errores de parseo:</p>
                <ul className="max-h-32 overflow-y-auto text-xs text-red-700 space-y-0.5">
                  {result.erroresParseo!.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}

            {(result.erroresInsert?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-semibold">Errores de inserción:</p>
                <ul className="max-h-32 overflow-y-auto text-xs text-red-700 space-y-0.5">
                  {result.erroresInsert!.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
