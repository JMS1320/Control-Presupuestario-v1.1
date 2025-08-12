"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, Info, DollarSign, Building2 } from "lucide-react"
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
  // Estados existentes para extractos bancarios
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [saldoInicial, setSaldoInicial] = useState("")
  const [mostrarSaldoInicial, setMostrarSaldoInicial] = useState(false)
  const [verificandoRegistros, setVerificandoRegistros] = useState(false)
  
  // Estados nuevos para manejar múltiples tipos de importación
  const [tipoImportacion, setTipoImportacion] = useState<'extractos' | 'facturas'>('extractos')  // Tipo de archivo a importar
  const [empresa, setEmpresa] = useState<'MSA' | 'PAM'>('MSA')  // Empresa destino (solo para facturas)
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null)  // Errores de validación de archivo

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

  /**
   * Valida que el archivo seleccionado sea correcto según el tipo y empresa
   * Para facturas ARCA: verifica que el CUIT en el nombre del archivo coincida con la empresa seleccionada
   * MSA CUIT: 30617786016 | PAM CUIT: 20044390222
   */
  const validarArchivo = (file: File, empresa: string, tipo: string): string | null => {
    if (tipo === 'facturas') {
      // Definir CUITs esperados por empresa
      const cuitEsperado = empresa === 'MSA' ? '30617786016' : '20044390222'
      
      // Verificar si el nombre del archivo contiene el CUIT esperado
      const contieneCorrectoCUIT = file.name.includes(cuitEsperado)
      if (!contieneCorrectoCUIT) {
        return `❌ Error: Archivo de ${empresa} esperado (CUIT ${cuitEsperado}), pero el archivo contiene CUIT diferente`
      }
    }
    // Si es extracto bancario o validación OK, no hay error
    return null
  }

  /**
   * Maneja la selección de archivo y ejecuta validaciones
   * Si el archivo no pasa validación, lo rechaza y muestra error
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Ejecutar validación del archivo seleccionado
      const errorValidacion = validarArchivo(selectedFile, empresa, tipoImportacion)
      if (errorValidacion) {
        // Si hay error, rechazar archivo y mostrar mensaje
        setErrorValidacion(errorValidacion)
        setFile(null)
        e.target.value = ''  // Limpiar el input file
        return
      }
      
      // Si validación OK, aceptar archivo
      setFile(selectedFile)
      setResult(null)  // Limpiar resultados anteriores
      setErrorValidacion(null)  // Limpiar errores previos
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

      /**
       * Determinar endpoint de API según tipo de importación:
       * - Extractos bancarios: /api/import-excel (existente)
       * - Facturas ARCA: /api/import-facturas-arca (nuevo)
       */
      let endpoint = '/api/import-excel'  // Por defecto extractos bancarios
      if (tipoImportacion === 'facturas') {
        endpoint = '/api/import-facturas-arca'  // Nuevo endpoint para facturas
        formData.append('empresa', empresa)     // Enviar empresa destino (MSA/PAM)
      }

      // Ejecutar llamada a la API correspondiente
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      // Mostrar errores detallados en consola para debugging
      if (data.errores && data.errores.length > 0) {
        console.error("🔍 ERRORES DETALLADOS:", data.errores)
        console.error("🔍 RESPUESTA COMPLETA:", data)
      }

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
        {/* Selector de tipo de importación */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Tipo de importación</Label>
          <RadioGroup 
            value={tipoImportacion} 
            onValueChange={(value) => {
              setTipoImportacion(value as 'extractos' | 'facturas')
              // Limpiar archivo al cambiar tipo para forzar nueva validación
              setFile(null)
              setResult(null)
              setErrorValidacion(null)
            }}
            className="flex gap-6"
          >
            {/* Opción extractos bancarios */}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="extractos" id="extractos" />
              <Label htmlFor="extractos" className="flex items-center gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Extractos Bancarios
              </Label>
            </div>
            {/* Opción facturas recibidas */}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="facturas" id="facturas" />
              <Label htmlFor="facturas" className="flex items-center gap-2 cursor-pointer">
                <Building2 className="h-4 w-4" />
                Facturas Recibidas (ARCA)
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Selector de empresa - solo visible para facturas */}
        {tipoImportacion === 'facturas' && (
          <div className="space-y-3">
            <Label className="text-base font-semibold">Empresa destino</Label>
            <RadioGroup 
              value={empresa} 
              onValueChange={(value) => {
                setEmpresa(value as 'MSA' | 'PAM')
                // Limpiar archivo al cambiar empresa para forzar nueva validación de CUIT
                setFile(null)
                setResult(null)
                setErrorValidacion(null)
              }}
              className="flex gap-6"
            >
              {/* Opción MSA */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MSA" id="msa" />
                <Label htmlFor="msa" className="cursor-pointer">
                  MSA (CUIT: 30617786016)
                </Label>
              </div>
              {/* Opción PAM */}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="PAM" id="pam" />
                <Label htmlFor="pam" className="cursor-pointer">
                  PAM (CUIT: 20044390222)
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Selector de archivo */}
        <div className="space-y-2">
          <Label htmlFor="excel-file">
            {tipoImportacion === 'extractos' ? 'Archivo Excel (.xlsx)' : 'Archivo CSV de ARCA (.csv)'}
          </Label>
          <Input 
            id="excel-file" 
            type="file" 
            accept={tipoImportacion === 'extractos' ? '.xlsx,.xls' : '.csv'} 
            onChange={handleFileChange} 
            disabled={loading} 
          />
          {/* Mostrar nombre del archivo seleccionado */}
          {file && (
            <p className="text-sm text-muted-foreground">
              ✅ Archivo seleccionado: {file.name}
            </p>
          )}
          {/* Mostrar error de validación si existe */}
          {errorValidacion && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorValidacion}</AlertDescription>
            </Alert>
          )}
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

        {/* Botón de importación con texto dinámico */}
        <Button onClick={handleUpload} disabled={!file || loading || !!errorValidacion} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tipoImportacion === 'extractos' ? 'Procesando extracto...' : 'Procesando facturas...'}
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {tipoImportacion === 'extractos' ? 'Cargar movimientos' : `Importar facturas ${empresa}`}
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
