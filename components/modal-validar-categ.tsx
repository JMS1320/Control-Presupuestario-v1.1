"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Check, Plus, Search, AlertTriangle, List } from "lucide-react"
import { useCuentasContables, type CuentaContable } from "@/hooks/useCuentasContables"

interface ModalValidarCategProps {
  isOpen: boolean
  categIngresado: string
  onConfirm: (categFinal: string) => void
  onCancel: () => void
}

export function ModalValidarCateg({ isOpen, categIngresado, onConfirm, onCancel }: ModalValidarCategProps) {
  const { cuentas, validarCateg, buscarSimilares, crearCuentaContable } = useCuentasContables()
  const [modo, setModo] = useState<'seleccionar' | 'lista' | 'crear'>('lista')
  const [categSeleccionado, setCategSeleccionado] = useState('')
  const [creandoCuenta, setCreandoCuenta] = useState(false)
  
  // Datos para crear nueva cuenta
  const [nuevoCateg, setNuevoCateg] = useState('')
  const [nuevoCuentaContable, setNuevoCuentaContable] = useState('')
  const [nuevoTipo, setNuevoTipo] = useState('')
  
  // Estado para lista completa con autocompletado
  const [filtroLista, setFiltroLista] = useState('')
  const [cuentasFiltradas, setCuentasFiltradas] = useState<CuentaContable[]>([])

  const categExiste = validarCateg(categIngresado)
  const similares = buscarSimilares(categIngresado)

  // Filtrar cuentas para el modo lista
  useEffect(() => {
    if (modo === 'lista') {
      console.log('🔍 DEBUG Modal filtro:')
      console.log('- cuentas disponibles:', cuentas.length)
      console.log('- filtroLista:', filtroLista)
      
      if (!filtroLista.trim()) {
        const primeras20 = cuentas.slice(0, 20)
        console.log('- sin filtro, primeras 20:', primeras20.length)
        setCuentasFiltradas(primeras20)
      } else {
        const filtro = filtroLista.toLowerCase()
        const filtradas = cuentas.filter(cuenta => 
          cuenta.categ.toLowerCase().includes(filtro) ||
          cuenta.cuenta_contable.toLowerCase().includes(filtro)
        ).slice(0, 50)
        console.log('- con filtro, encontradas:', filtradas.length)
        setCuentasFiltradas(filtradas)
      }
    }
  }, [filtroLista, modo, cuentas])

  useEffect(() => {
    if (isOpen) {
      setNuevoCateg(categIngresado.toUpperCase())
      setNuevoCuentaContable('')
      setNuevoTipo('')
      setCategSeleccionado('')
      setFiltroLista(categIngresado) // Pre-llenar filtro con lo ingresado
      
      // NOTA: categExiste nunca será true aquí porque el modal solo se abre cuando NO existe
      if (similares.length > 0) {
        setModo('seleccionar')
      } else {
        setModo('lista') // Por defecto mostrar lista si no hay similares
      }
    }
  }, [isOpen, categIngresado, similares.length])

  const handleConfirmarExistente = () => {
    onConfirm(categIngresado)
  }

  const handleSeleccionarSimilar = (categ: string) => {
    onConfirm(categ)
  }

  const handleCrearNueva = async () => {
    if (!nuevoCateg || !nuevoCuentaContable || !nuevoTipo) {
      return
    }

    setCreandoCuenta(true)
    
    const exito = await crearCuentaContable(nuevoCateg, nuevoCuentaContable, nuevoTipo)
    
    if (exito) {
      onConfirm(nuevoCateg)
    }
    
    setCreandoCuenta(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Validar Cuenta Contable</h2>
            <Button variant="outline" onClick={onCancel}>
              ✕
            </Button>
          </div>

          <div className="space-y-6">
            {/* Código ingresado */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Código ingresado:</span>
                  <Badge variant="outline" className="font-mono text-lg">
                    {categIngresado}
                  </Badge>
                </div>
              </CardContent>
            </Card>


            {/* Sugerencias similares */}
            {modo === 'seleccionar' && similares.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Cuentas similares encontradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-4">
                      ¿Quisiste usar alguna de estas cuentas existentes?
                    </p>
                    {similares.map((cuenta) => (
                      <div 
                        key={cuenta.categ}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-mono font-bold">{cuenta.categ}</div>
                          <div className="text-sm text-gray-600">{cuenta.cuenta_contable}</div>
                          <Badge variant="secondary" className="text-xs">{cuenta.tipo}</Badge>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => handleSeleccionarSimilar(cuenta.categ)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Usar esta
                        </Button>
                      </div>
                    ))}
                    
                    <div className="pt-4 border-t space-y-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setModo('lista')}
                        className="w-full"
                      >
                        <List className="mr-2 h-4 w-4" />
                        Ver lista completa
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setModo('crear')}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crear cuenta nueva
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista completa con autocompletado */}
            {modo === 'lista' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Seleccionar de lista completa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <Search className="h-4 w-4" />
                      <AlertDescription>
                        Busca y selecciona una cuenta existente. Escribe para filtrar por código o nombre.
                      </AlertDescription>
                    </Alert>

                    <div>
                      <Label htmlFor="filtro">Buscar cuenta contable</Label>
                      <Input
                        id="filtro"
                        placeholder="Escribe código o nombre para filtrar..."
                        value={filtroLista}
                        onChange={(e) => setFiltroLista(e.target.value)}
                        className="font-mono"
                      />
                    </div>

                    <ScrollArea className="h-80 border rounded-md p-2">
                      <div className="space-y-2">
                        {cuentasFiltradas.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            {filtroLista ? 'No se encontraron cuentas con ese filtro' : 'Cargando cuentas...'}
                          </div>
                        ) : (
                          cuentasFiltradas.map((cuenta) => (
                            <div 
                              key={cuenta.categ}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                              onClick={() => handleSeleccionarSimilar(cuenta.categ)}
                            >
                              <div className="flex-1">
                                <div className="font-mono font-bold text-lg">{cuenta.categ}</div>
                                <div className="text-sm text-gray-600">{cuenta.cuenta_contable}</div>
                                <Badge variant="secondary" className="text-xs mt-1">{cuenta.tipo}</Badge>
                              </div>
                              <Button 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSeleccionarSimilar(cuenta.categ)
                                }}
                              >
                                <Check className="mr-1 h-3 w-3" />
                                Usar
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                    
                    <div className="flex gap-2 pt-4 border-t">
                      {similares.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setModo('seleccionar')}
                        >
                          <Search className="mr-2 h-4 w-4" />
                          Ver similares
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => setModo('crear')}
                        className="flex-1"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Crear nueva cuenta
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Crear nueva cuenta */}
            {modo === 'crear' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Crear nueva cuenta contable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        El código <strong>{categIngresado}</strong> no existe. 
                        Completa los datos para crear una nueva cuenta contable.
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="categ">Código CATEG</Label>
                        <Input
                          id="categ"
                          value={nuevoCateg}
                          onChange={(e) => setNuevoCateg(e.target.value.toUpperCase())}
                          placeholder="Ej: AGUADAS"
                          className="font-mono"
                        />
                      </div>

                      <div>
                        <Label htmlFor="cuenta">Nombre de la cuenta</Label>
                        <Input
                          id="cuenta"
                          value={nuevoCuentaContable}
                          onChange={(e) => setNuevoCuentaContable(e.target.value)}
                          placeholder="Ej: Aguadas"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipo">Tipo de cuenta</Label>
                        <Select value={nuevoTipo} onValueChange={setNuevoTipo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ingreso">Ingreso</SelectItem>
                            <SelectItem value="egreso">Egreso</SelectItem>
                            <SelectItem value="financiero">Financiero</SelectItem>
                            <SelectItem value="distribucion">Distribución</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleCrearNueva}
                        disabled={!nuevoCateg || !nuevoCuentaContable || !nuevoTipo || creandoCuenta}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {creandoCuenta ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Crear y usar
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => setModo('lista')}
                      >
                        <List className="mr-2 h-4 w-4" />
                        Ver lista
                      </Button>
                      
                      {similares.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setModo('seleccionar')}
                        >
                          Ver similares
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botones de acción generales */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}