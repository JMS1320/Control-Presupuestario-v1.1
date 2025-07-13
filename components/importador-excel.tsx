"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, Info, DollarSign } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface ControlError {
  fila: number
  fecha: string
  descripcion: string
  control: string
}

interface ImportError {
  fila: number
  descripcion: string
  error: string
  categ: string
}

interface ImportResult {
  success: boolean
  insertedCount: number
  controlErrors: ControlError[]
  errores: ImportError[]
  message: string
  requiereSaldoInicio?: boolean
  mensaje?: string
  summary?: {
    totalFilas: number
    filasInsertadas: number
    erroresCategoria: number
    erroresControl: number
  }
}

export function ImportadorExcel() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [saldoInicial, setSaldoInicial] = useState("")
  const [mostrarSaldoInicial, setMostrarSaldoInicial] = useState(false)
  const [verificandoRegistros, setVerificandoRegistros] = useState(false)

  // Verificar si hay registros existentes en la tabla
  const verificarRegistrosExistentes = async () => {
    setVerificandoRegistros(true)
    try {
      const { data, error } = await supabase.from("msa_galicia").select("id").limit(1).maybeSingle()

      if (error) {
        console.error("Error al verificar registros:", error)
        setMostrarSaldoInicial(false)
      } else {
        // Si no hay registros (data es null), mostrar el campo de saldo inicial
        setMostrarSaldoInicial(data === null)
      }
    } catch (error) {
      console.error("Error al verificar registros:", error)
      setMostrarSaldoInicial(false)
    } finally {
      setVerificandoRegistros(false)
    }
  }

  // Verificar registros cuando se monta el componente
  useEffect(() => {
    verificarRegistrosExistentes()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null) // Limpiar resultados anteriores
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      // Si se muestra el campo de saldo inicial y tiene valor, enviarlo
      if (mostrarSaldoInicial && saldoInicial.trim()) {
        formData.append("saldo_inicial", saldoInicial)
      }

      const response = await fetch("/api/import-excel", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setResult({
          success: false,
          insertedCount: 0,
          controlErrors: [],
          errores: [],
          message: data.error || "Error desconocido",
        })
      }
    } catch (error) {
      setResult({
        success: false,
        insertedCount: 0,
        controlErrors: [],
        errores: [],
        message: "Error de conexión al procesar el archivo",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importar Movimientos MSA Galicia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="excel-file">Archivo Excel (.xlsx)</Label>
          <Input id="excel-file" type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} />
          {file && <p className="text-sm text-muted-foreground">Archivo seleccionado: {file.name}</p>}
        </div>

        {/* Campo de saldo inicial - solo se muestra si no hay registros previos */}
        {verificandoRegistros && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Verificando registros existentes...</AlertDescription>
          </Alert>
        )}

        {mostrarSaldoInicial && !verificandoRegistros && (
          <div className="space-y-2">
            <Label htmlFor="saldo-inicial" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Saldo Inicial (opcional)
            </Label>
            <Input
              id="saldo-inicial"
              type="text"
              placeholder="Ej: 1.234.567,89"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Primera importación detectada. Ingrese el saldo inicial de la cuenta para cálculos precisos de control.
              Formato: punto para miles, coma para decimales.
            </p>
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando archivo...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Cargar movimientos
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {result.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertDescription>{result.message}</AlertDescription>
              </div>
            </Alert>

            {result.summary && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      Total filas procesadas: <strong>{result.summary.totalFilas}</strong>
                    </div>
                    <div>
                      Filas insertadas: <strong>{result.summary.filasInsertadas}</strong>
                    </div>
                    <div>
                      Errores de categoría: <strong>{result.summary.erroresCategoria}</strong>
                    </div>
                    <div>
                      Errores de control: <strong>{result.summary.erroresControl}</strong>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result.errores && result.errores.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Errores de categoría ({result.errores.length} filas):</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.errores.map((error, index) => (
                        <div key={index} className="text-xs bg-red-50 p-2 rounded">
                          <strong>Fila {error.fila}:</strong> {error.descripcion}
                          <br />
                          <span className="text-red-700">
                            Error: {error.error} - Categoría: "{error.categ}"
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {result.controlErrors && result.controlErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">
                      Errores de control detectados ({result.controlErrors.length} filas):
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.controlErrors.map((error, index) => (
                        <div key={index} className="text-xs bg-red-50 p-2 rounded">
                          <strong>Fila {error.fila}:</strong> {error.fecha} - {error.descripcion}
                          <br />
                          <span className="text-red-700">Control: {error.control}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Instrucciones:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>El archivo debe ser formato Excel (.xlsx)</li>
            <li>Se filtran automáticamente movimientos de hoy y fechas futuras</li>
            <li>Se calculan automáticamente los campos orden y control</li>
            <li>Las categorías deben existir en la tabla cuentas_contables</li>
            <li>Si hay errores de control ≠ 0, se mostrarán como advertencias</li>
            <li>El saldo inicial solo aparece en la primera importación</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
