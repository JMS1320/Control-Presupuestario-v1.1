"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Upload, CheckCircle2, AlertCircle, Baby } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Ternero {
  id: string
  caravana_interna: string | null
  caravana_oficial: string | null
  sexo: string | null
  pelo: string | null
  fecha_destete: string | null
  es_torito: boolean
  observaciones: string | null
  activo: boolean
  created_at: string
}

interface ResultadoImport {
  procesados: number
  insertados: number
  omitidos: number
  duplicados_en_archivo: string[]
  duplicados_en_bd: string[]
  errores: string[]
}

const PELO_LABEL: Record<string, string> = {
  'Colorado': '🟠 Colorado',
  'Negro': '⚫ Negro',
  'Careta Colorado': '🟠 Careta Col.',
  'Careta Negro': '⚫ Careta Neg.',
  'Otros': 'Otros',
}

export function TabTerneros() {
  const [terneros, setTerneros] = useState<Ternero[]>([])
  const [cargando, setCargando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [modalResultado, setModalResultado] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargar = async () => {
    setCargando(true)
    try {
      const { data, error } = await supabase
        .schema('productivo')
        .from('terneros')
        .select('*')
        .eq('activo', true)
        .order('caravana_oficial', { ascending: true })
      if (error) throw error
      setTerneros(data ?? [])
    } catch (err: any) {
      toast.error('Error cargando terneros: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImportando(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import-terneros', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error en importación')
      setResultado(data)
      setModalResultado(true)
      await cargar()
    } catch (err: any) {
      toast.error('Error importando: ' + err.message)
    } finally {
      setImportando(false)
    }
  }

  const machos = terneros.filter(t => t.sexo === 'Macho')
  const hembras = terneros.filter(t => t.sexo === 'Hembra')
  const toritos = terneros.filter(t => t.es_torito)

  return (
    <div className="space-y-4 mt-4">
      {/* Header con contadores y botón importar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
            <Baby className="h-3 w-3 mr-1" />
            {terneros.length} terneros
          </Badge>
          <Badge variant="outline" className="text-sky-700 border-sky-300 bg-sky-50">
            ♂ {machos.length} machos
          </Badge>
          <Badge variant="outline" className="text-pink-700 border-pink-300 bg-pink-50">
            ♀ {hembras.length} hembras
          </Badge>
          {toritos.length > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              🐂 {toritos.length} toritos
            </Badge>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleArchivo}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={importando}
            className="bg-green-700 hover:bg-green-800 flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {importando ? 'Importando...' : 'Importar Terneros (Excel)'}
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Registro de Terneros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              Cargando...
            </div>
          ) : terneros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Baby className="h-10 w-10" />
              <p className="text-sm">Sin terneros registrados</p>
              <p className="text-xs">Importá el Excel para cargar el lote de destete</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs">Carav. Oficial</TableHead>
                    <TableHead className="text-xs">Carav. Interna</TableHead>
                    <TableHead className="text-xs">Sexo</TableHead>
                    <TableHead className="text-xs">Pelo</TableHead>
                    <TableHead className="text-xs">Torito</TableHead>
                    <TableHead className="text-xs">Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terneros.map(t => (
                    <TableRow key={t.id} className="text-sm">
                      <TableCell className="font-mono text-xs">
                        {t.caravana_oficial ?? <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {t.caravana_interna ?? <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {t.sexo === 'Macho'
                          ? <span className="text-sky-700 font-medium">♂ M</span>
                          : t.sexo === 'Hembra'
                          ? <span className="text-pink-700 font-medium">♀ H</span>
                          : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.pelo ? (PELO_LABEL[t.pelo] ?? t.pelo) : <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {t.es_torito && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">🐂 Torito</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                        {t.observaciones ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal resultado importación */}
      <Dialog open={modalResultado} onOpenChange={setModalResultado}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado de importación</DialogTitle>
          </DialogHeader>
          {resultado && (
            <div className="space-y-4">
              {/* Contadores principales */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{resultado.procesados}</div>
                  <div className="text-xs text-gray-500">Procesados</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{resultado.insertados}</div>
                  <div className="text-xs text-green-600">Insertados</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{resultado.omitidos}</div>
                  <div className="text-xs text-amber-600">Sin caravana</div>
                </div>
              </div>

              {/* Duplicados en el archivo */}
              {resultado.duplicados_en_archivo.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      {resultado.duplicados_en_archivo.length} caravana{resultado.duplicados_en_archivo.length > 1 ? 's' : ''} duplicada{resultado.duplicados_en_archivo.length > 1 ? 's' : ''} en el archivo — se insertaron igual
                    </span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                    {resultado.duplicados_en_archivo.map((e, i) => (
                      <p key={i} className="text-xs text-amber-800">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicados contra BD existente */}
              {resultado.duplicados_en_bd.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      {resultado.duplicados_en_bd.length} caravana{resultado.duplicados_en_bd.length > 1 ? 's' : ''} ya existían en BD — se insertaron igual
                    </span>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                    {resultado.duplicados_en_bd.map((e, i) => (
                      <p key={i} className="text-xs text-orange-800">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Errores técnicos */}
              {resultado.errores.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      {resultado.errores.length} error{resultado.errores.length > 1 ? 'es' : ''} técnicos
                    </span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-2 max-h-32 overflow-y-auto space-y-1">
                    {resultado.errores.map((e, i) => (
                      <p key={i} className="text-xs text-red-700">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              {resultado.errores.length === 0 && resultado.duplicados_en_archivo.length === 0 && resultado.duplicados_en_bd.length === 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded p-3">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Importación completada sin observaciones</span>
                </div>
              )}

              <Button className="w-full" onClick={() => setModalResultado(false)}>
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
