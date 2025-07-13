"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle, Edit, Save, Plus, Keyboard } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface MovimientoConErrorInterno {
  id: string
  fecha: string
  descripcion: string
  detalle: string // ✅ Agregado campo detalle
  interno: string
  debitos: number
  creditos: number
  saldo: number
}

interface DistribucionSocio {
  interno: string
  concepto: string
  orden: number
  seccion: number
}

interface NuevaDistribucion {
  interno: string
  concepto: string
  orden: number
  seccion: number
}

export function CorrectorInterno() {
  const [movimientosConError, setMovimientosConError] = useState<MovimientoConErrorInterno[]>([])
  const [distribucionesValidas, setDistribucionesValidas] = useState<DistribucionSocio[]>([])
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cambiosPendientes, setCambiosPendientes] = useState<Map<string, string>>(new Map())
  const [mostrarFormularioNueva, setMostrarFormularioNueva] = useState(false)
  const [nuevaDistribucion, setNuevaDistribucion] = useState<NuevaDistribucion>({
    interno: "",
    concepto: "",
    orden: 1,
    seccion: 1,
  })
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Obtener distribuciones válidas
      const { data: distribuciones } = await supabase
        .from("distribucion_socios")
        .select("interno, concepto, orden, seccion")
        .order("orden")

      if (distribuciones) setDistribucionesValidas(distribuciones)

      // ✅ Obtener movimientos con valores de interno inválidos (incluyendo detalle)
      const { data: movimientos } = await supabase
        .from("msa_galicia")
        .select("id, fecha, descripcion, detalle, interno, debitos, creditos, saldo") // ✅ Agregado detalle
        .not("interno", "is", null)
        .neq("interno", "") // ✅ Excluir campos vacíos

      if (movimientos && distribuciones) {
        const internosValidos = new Set(distribuciones.map((d) => d.interno))
        const movimientosInvalidos = movimientos.filter((m) => !internosValidos.has(m.interno))
        setMovimientosConError(movimientosInvalidos)
      }
    } catch (error) {
      console.error("Error al cargar datos:", error)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = (rowIndex: number, currentValue: string) => {
    setEditingRowIndex(rowIndex)
    setEditingValue(currentValue)
    setSelectedSuggestionIndex(0)

    // Enfocar y seleccionar todo el texto automáticamente
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select() // ✅ Seleccionar todo el texto
      }
    }, 0)
  }

  const getSugerencias = (input: string) => {
    if (!input) return []
    return distribucionesValidas
      .filter(
        (d) =>
          d.interno.toLowerCase().includes(input.toLowerCase()) ||
          d.concepto.toLowerCase().includes(input.toLowerCase()),
      )
      .slice(0, 8)
  }

  const confirmarEdicion = (internoSeleccionado?: string) => {
    if (editingRowIndex === null) return

    const movimiento = movimientosConError[editingRowIndex]
    const sugerencias = getSugerencias(editingValue)
    const nuevoInterno =
      internoSeleccionado ||
      (sugerencias.length > 0 ? sugerencias[selectedSuggestionIndex]?.interno : editingValue.trim())

    if (!nuevoInterno) return

    const internoExiste = distribucionesValidas.some((d) => d.interno === nuevoInterno)

    if (internoExiste) {
      // Interno válido - agregar a cambios pendientes
      setCambiosPendientes((prev) => new Map(prev.set(movimiento.id, nuevoInterno)))
      setEditingRowIndex(null)
      setEditingValue("")
    } else if (nuevoInterno) {
      // Interno no existe - preguntar si crear nuevo
      const siguienteOrden = Math.max(...distribucionesValidas.map((d) => d.orden || 0)) + 1
      setNuevaDistribucion({
        interno: nuevoInterno,
        concepto: "",
        orden: siguienteOrden,
        seccion: 1,
      })
      setMostrarFormularioNueva(true)
    }
  }

  const moverAProximaFila = () => {
    if (editingRowIndex === null) return

    const siguienteIndex = editingRowIndex + 1
    if (siguienteIndex < movimientosConError.length) {
      const siguienteMovimiento = movimientosConError[siguienteIndex]
      const internoActual = cambiosPendientes.get(siguienteMovimiento.id) || siguienteMovimiento.interno
      startEditing(siguienteIndex, internoActual)
    } else {
      // Si es la última fila, salir del modo edición
      setEditingRowIndex(null)
      setEditingValue("")
    }
  }

  const moverAFilaAnterior = () => {
    if (editingRowIndex === null || editingRowIndex === 0) return

    const anteriorIndex = editingRowIndex - 1
    const anteriorMovimiento = movimientosConError[anteriorIndex]
    const internoActual = cambiosPendientes.get(anteriorMovimiento.id) || anteriorMovimiento.interno
    startEditing(anteriorIndex, internoActual)
  }

  const moverSinModificar = (direccion: "arriba" | "abajo") => {
    if (editingRowIndex === null) return

    // Cancelar edición actual sin guardar cambios
    setEditingValue("")

    if (direccion === "abajo") {
      const siguienteIndex = editingRowIndex + 1
      if (siguienteIndex < movimientosConError.length) {
        const siguienteMovimiento = movimientosConError[siguienteIndex]
        const internoActual = cambiosPendientes.get(siguienteMovimiento.id) || siguienteMovimiento.interno
        startEditing(siguienteIndex, internoActual)
      }
    } else {
      const anteriorIndex = editingRowIndex - 1
      if (anteriorIndex >= 0) {
        const anteriorMovimiento = movimientosConError[anteriorIndex]
        const internoActual = cambiosPendientes.get(anteriorMovimiento.id) || anteriorMovimiento.interno
        startEditing(anteriorIndex, internoActual)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const sugerencias = getSugerencias(editingValue)

    switch (e.key) {
      case "Enter":
        e.preventDefault()
        confirmarEdicion()
        // Después de confirmar, mover a la siguiente fila automáticamente
        setTimeout(() => moverAProximaFila(), 50)
        break

      case "Tab":
        e.preventDefault()
        if (sugerencias.length > 0) {
          confirmarEdicion(sugerencias[selectedSuggestionIndex]?.interno)
        } else {
          confirmarEdicion()
        }
        setTimeout(() => moverAProximaFila(), 50)
        break

      case "Escape":
        setEditingRowIndex(null)
        setEditingValue("")
        break

      case "ArrowDown":
        e.preventDefault()
        if (sugerencias.length > 0) {
          // Si hay sugerencias, navegar entre ellas
          setSelectedSuggestionIndex((prev) => (prev < sugerencias.length - 1 ? prev + 1 : 0))
        } else {
          // Si no hay sugerencias, mover a la siguiente fila SIN modificar
          moverSinModificar("abajo")
        }
        break

      case "ArrowUp":
        e.preventDefault()
        if (sugerencias.length > 0) {
          // Si hay sugerencias, navegar entre ellas
          setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : sugerencias.length - 1))
        } else {
          // Si no hay sugerencias, mover a la fila anterior SIN modificar
          moverSinModificar("arriba")
        }
        break
    }
  }

  const crearNuevaDistribucion = async () => {
    if (!nuevaDistribucion.interno || !nuevaDistribucion.concepto) return

    try {
      const { error } = await supabase.from("distribucion_socios").insert([nuevaDistribucion])

      if (error) {
        console.error("Error al crear distribución:", error)
        return
      }

      // Añadir la nueva distribución al estado local
      setDistribucionesValidas((prev) => [...prev, nuevaDistribucion])

      // Registrar el cambio pendiente en la tabla
      if (editingRowIndex !== null) {
        const movimiento = movimientosConError[editingRowIndex]
        setCambiosPendientes((prev) => new Map(prev.set(movimiento.id, nuevaDistribucion.interno)))
        setEditingRowIndex(null)
        setEditingValue("")
      }

      setMostrarFormularioNueva(false)
      setNuevaDistribucion({ interno: "", concepto: "", orden: 1, seccion: 1 })

      // Mover a la siguiente fila después de crear la distribución
      setTimeout(() => moverAProximaFila(), 50)
    } catch (err) {
      console.error("Error al crear nueva distribución:", err)
    }
  }

  const guardarCambios = async () => {
    if (cambiosPendientes.size === 0) return

    setGuardando(true)
    try {
      const updates = Array.from(cambiosPendientes.entries()).map(([id, interno]) => ({ id, interno }))

      for (const update of updates) {
        const { error } = await supabase.from("msa_galicia").update({ interno: update.interno }).eq("id", update.id)

        if (error) {
          console.error("Error al actualizar movimiento:", error)
          continue
        }
      }

      // Recargar datos para reflejar cambios
      await cargarDatos()
      setCambiosPendientes(new Map())
      setEditingRowIndex(null)
      setEditingValue("")
    } catch (error) {
      console.error("Error al guardar cambios:", error)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Verificando valores de interno...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (movimientosConError.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>✅ Todos los valores de "interno" son válidos. No hay errores que corregir.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          ⚠️ Existen {movimientosConError.length} movimientos con valor de "interno" inválido.
        </AlertDescription>
      </Alert>

      {/* Instrucciones de teclado */}
      <Alert>
        <Keyboard className="h-4 w-4" />
        <AlertDescription>
          <div className="text-sm">
            <strong>Navegación tipo Excel:</strong>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> - Confirmar y siguiente
              </div>
              <div>
                • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> - Confirmar y siguiente
              </div>
              <div>
                • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↓</kbd> - Siguiente sin modificar
              </div>
              <div>
                • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">↑</kbd> - Anterior sin modificar
              </div>
              <div>
                • <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> - Cancelar edición
              </div>
              <div>
                • <strong>Escribir</strong> - Sobreescribe automáticamente
              </div>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Corrector de Valores "Interno"
            </span>
            {cambiosPendientes.size > 0 && (
              <Button onClick={guardarCambios} disabled={guardando} className="flex items-center gap-2">
                {guardando ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar {cambiosPendientes.size} cambios
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table suppressHydrationWarning>
              <TableHeader>
                <TableRow suppressHydrationWarning>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Detalle</TableHead> {/* ✅ Nueva columna */}
                  <TableHead>Interno (Editable)</TableHead>
                  <TableHead>Débitos</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientosConError.map((mov, index) => (
                  <TableRow
                    suppressHydrationWarning
                    key={mov.id}
                    className={editingRowIndex === index ? "bg-blue-50" : ""}
                  >
                    <TableCell>{new Date(mov.fecha).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate">{mov.descripcion}</TableCell>
                    <TableCell className="max-w-xs truncate">{mov.detalle || "-"}</TableCell> {/* ✅ Nueva columna */}
                    <TableCell>
                      {editingRowIndex === index ? (
                        <div className="relative">
                          <Input
                            ref={inputRef}
                            value={editingValue}
                            onChange={(e) => {
                              setEditingValue(e.target.value)
                              setSelectedSuggestionIndex(0)
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full"
                            placeholder="Escriba el valor interno..."
                          />
                          {editingValue && getSugerencias(editingValue).length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                              {getSugerencias(editingValue).map((distribucion, suggestionIndex) => (
                                <div
                                  key={distribucion.interno}
                                  className={`p-2 cursor-pointer text-sm ${
                                    suggestionIndex === selectedSuggestionIndex
                                      ? "bg-blue-100 border-l-4 border-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() => confirmarEdicion(distribucion.interno)}
                                >
                                  <div className="font-medium">{distribucion.interno}</div>
                                  <div className="text-gray-500 text-xs">{distribucion.concepto}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          className="h-8 px-2 font-mono text-left justify-start w-full"
                          onClick={() => startEditing(index, cambiosPendientes.get(mov.id) || mov.interno)}
                        >
                          {cambiosPendientes.get(mov.id) || mov.interno}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>{mov.debitos.toLocaleString()}</TableCell>
                    <TableCell>{mov.creditos.toLocaleString()}</TableCell>
                    <TableCell>{mov.saldo.toLocaleString()}</TableCell>
                    <TableCell>
                      {cambiosPendientes.has(mov.id) ? (
                        <span className="text-orange-600 text-sm">● Pendiente</span>
                      ) : (
                        <span className="text-red-600 text-sm">● Error</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para crear nueva distribución */}
      <Dialog open={mostrarFormularioNueva} onOpenChange={setMostrarFormularioNueva}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear Nueva Distribución
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                El valor interno "{nuevaDistribucion.interno}" no existe. ¿Desea crearlo?
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="interno">Código Interno</Label>
              <Input
                id="interno"
                value={nuevaDistribucion.interno}
                onChange={(e) => setNuevaDistribucion({ ...nuevaDistribucion, interno: e.target.value })}
                placeholder="Ej: DIST NUEVO"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto</Label>
              <Input
                id="concepto"
                value={nuevaDistribucion.concepto}
                onChange={(e) => setNuevaDistribucion({ ...nuevaDistribucion, concepto: e.target.value })}
                placeholder="Ej: Distribución Nuevo Socio"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orden">Orden</Label>
                <Input
                  id="orden"
                  type="number"
                  value={nuevaDistribucion.orden}
                  onChange={(e) => setNuevaDistribucion({ ...nuevaDistribucion, orden: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seccion">Sección</Label>
                <Input
                  id="seccion"
                  type="number"
                  value={nuevaDistribucion.seccion}
                  onChange={(e) => setNuevaDistribucion({ ...nuevaDistribucion, seccion: Number(e.target.value) })}
                  min="1"
                  max="2"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={crearNuevaDistribucion}
                disabled={!nuevaDistribucion.interno || !nuevaDistribucion.concepto}
              >
                Crear Distribución
              </Button>
              <Button variant="outline" onClick={() => setMostrarFormularioNueva(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
