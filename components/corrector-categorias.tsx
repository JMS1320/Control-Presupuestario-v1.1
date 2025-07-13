"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle, Edit, Save, Plus, Keyboard } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { CuentaContable } from "@/lib/supabase"

interface MovimientoConError {
  id: string
  fecha: string
  descripcion: string
  categ: string
  debitos: number
  creditos: number
  saldo: number
}

interface NuevaCuenta {
  categ: string
  cuenta_contable: string
  tipo: "ingreso" | "egreso" | "financiero" | "distribucion"
}

export function CorrectorCategorias() {
  const [movimientosConError, setMovimientosConError] = useState<MovimientoConError[]>([])
  const [cuentasValidas, setCuentasValidas] = useState<CuentaContable[]>([])
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [cambiosPendientes, setCambiosPendientes] = useState<Map<string, string>>(new Map())
  const [mostrarFormularioNueva, setMostrarFormularioNueva] = useState(false)
  const [nuevaCuenta, setNuevaCuenta] = useState<NuevaCuenta>({ categ: "", cuenta_contable: "", tipo: "ingreso" })
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setLoading(true)
    try {
      // Obtener cuentas válidas
      const { data: cuentas } = await supabase.from("cuentas_contables").select("*")
      if (cuentas) setCuentasValidas(cuentas)

      // Obtener movimientos con categorías inválidas
      const { data: movimientos } = await supabase
        .from("msa_galicia")
        .select("id, fecha, descripcion, categ, debitos, creditos, saldo")
        .not("categ", "is", null)

      if (movimientos && cuentas) {
        const categsValidas = new Set(cuentas.map((c) => c.categ))
        const movimientosInvalidos = movimientos.filter((m) => !categsValidas.has(m.categ))
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

    // ✅ Enfocar y seleccionar todo el texto automáticamente
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select() // Seleccionar todo el texto
      }
    }, 0)
  }

  const getSugerencias = (input: string) => {
    if (!input) return []
    return cuentasValidas
      .filter(
        (c) =>
          c.categ.toLowerCase().includes(input.toLowerCase()) ||
          c.cuenta_contable.toLowerCase().includes(input.toLowerCase()),
      )
      .slice(0, 8) // Mostrar más sugerencias
  }

  const confirmarEdicion = (categoriaSeleccionada?: string) => {
    if (editingRowIndex === null) return

    const movimiento = movimientosConError[editingRowIndex]
    const sugerencias = getSugerencias(editingValue)
    const nuevaCategoria =
      categoriaSeleccionada ||
      (sugerencias.length > 0 ? sugerencias[selectedSuggestionIndex]?.categ : editingValue.trim())

    if (!nuevaCategoria) return

    const categoriaExiste = cuentasValidas.some((c) => c.categ === nuevaCategoria)

    if (categoriaExiste) {
      // Categoría válida - agregar a cambios pendientes
      setCambiosPendientes((prev) => new Map(prev.set(movimiento.id, nuevaCategoria)))
      setEditingRowIndex(null)
      setEditingValue("")
    } else if (nuevaCategoria) {
      // Categoría no existe - preguntar si crear nueva
      setNuevaCuenta({ categ: nuevaCategoria, cuenta_contable: "", tipo: "ingreso" })
      setMostrarFormularioNueva(true)
    }
  }

  const moverAProximaFila = () => {
    if (editingRowIndex === null) return

    const siguienteIndex = editingRowIndex + 1
    if (siguienteIndex < movimientosConError.length) {
      const siguienteMovimiento = movimientosConError[siguienteIndex]
      const categoriaActual = cambiosPendientes.get(siguienteMovimiento.id) || siguienteMovimiento.categ
      startEditing(siguienteIndex, categoriaActual)
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
    const categoriaActual = cambiosPendientes.get(anteriorMovimiento.id) || anteriorMovimiento.categ
    startEditing(anteriorIndex, categoriaActual)
  }

  const moverSinModificar = (direccion: "arriba" | "abajo") => {
    if (editingRowIndex === null) return

    // Cancelar edición actual sin guardar cambios
    setEditingValue("")

    if (direccion === "abajo") {
      const siguienteIndex = editingRowIndex + 1
      if (siguienteIndex < movimientosConError.length) {
        const siguienteMovimiento = movimientosConError[siguienteIndex]
        const categoriaActual = cambiosPendientes.get(siguienteMovimiento.id) || siguienteMovimiento.categ
        startEditing(siguienteIndex, categoriaActual)
      }
    } else {
      const anteriorIndex = editingRowIndex - 1
      if (anteriorIndex >= 0) {
        const anteriorMovimiento = movimientosConError[anteriorIndex]
        const categoriaActual = cambiosPendientes.get(anteriorMovimiento.id) || anteriorMovimiento.categ
        startEditing(anteriorIndex, categoriaActual)
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
          confirmarEdicion(sugerencias[selectedSuggestionIndex]?.categ)
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

  const crearNuevaCuenta = async () => {
    if (!nuevaCuenta.categ || !nuevaCuenta.cuenta_contable) return

    try {
      const res = await fetch("/api/create-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevaCuenta),
      })

      const json = await res.json()
      if (!res.ok) {
        console.error("Error al crear cuenta:", json.error)
        return
      }

      // Añadir la nueva cuenta al estado local
      setCuentasValidas((prev) => [...prev, { id: crypto.randomUUID(), ...nuevaCuenta }])

      // Registrar el cambio pendiente en la tabla
      if (editingRowIndex !== null) {
        const movimiento = movimientosConError[editingRowIndex]
        setCambiosPendientes((prev) => new Map(prev.set(movimiento.id, nuevaCuenta.categ)))
        setEditingRowIndex(null)
        setEditingValue("")
      }

      setMostrarFormularioNueva(false)
      setNuevaCuenta({ categ: "", cuenta_contable: "", tipo: "ingreso" })

      // Mover a la siguiente fila después de crear la cuenta
      setTimeout(() => moverAProximaFila(), 50)
    } catch (err) {
      console.error("Error al llamar API create-cuenta:", err)
    }
  }

  const guardarCambios = async () => {
    if (cambiosPendientes.size === 0) return

    setGuardando(true)
    try {
      const updates = Array.from(cambiosPendientes.entries()).map(([id, categ]) => ({ id, categ }))

      for (const update of updates) {
        const { error } = await supabase.from("msa_galicia").update({ categ: update.categ }).eq("id", update.id)

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
            <span>Verificando categorías...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (movimientosConError.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>✅ Todas las categorías son válidas. No hay errores que corregir.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>⚠️ Existen {movimientosConError.length} movimientos con categoría inválida.</AlertDescription>
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
              Corrector de Categorías
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
                  <TableHead>Categoría (Editable)</TableHead>
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
                    <TableCell>
                      {editingRowIndex === index ? (
                        <div className="relative">
                          <Input
                            ref={inputRef}
                            value={editingValue}
                            onChange={(e) => {
                              setEditingValue(e.target.value)
                              setSelectedSuggestionIndex(0) // Reset selection when typing
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full"
                            placeholder="Escriba la categoría..."
                          />
                          {editingValue && getSugerencias(editingValue).length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                              {getSugerencias(editingValue).map((cuenta, suggestionIndex) => (
                                <div
                                  key={cuenta.categ}
                                  className={`p-2 cursor-pointer text-sm ${
                                    suggestionIndex === selectedSuggestionIndex
                                      ? "bg-blue-100 border-l-4 border-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() => confirmarEdicion(cuenta.categ)}
                                >
                                  <div className="font-medium">{cuenta.categ}</div>
                                  <div className="text-gray-500 text-xs">{cuenta.cuenta_contable}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          className="h-8 px-2 font-mono text-left justify-start w-full"
                          onClick={() => startEditing(index, cambiosPendientes.get(mov.id) || mov.categ)}
                        >
                          {cambiosPendientes.get(mov.id) || mov.categ}
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

      {/* Dialog para crear nueva cuenta */}
      <Dialog open={mostrarFormularioNueva} onOpenChange={setMostrarFormularioNueva}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Crear Nueva Cuenta Contable
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>La cuenta contable "{nuevaCuenta.categ}" no existe. ¿Desea crearla?</AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="categ">Código de Categoría</Label>
              <Input
                id="categ"
                value={nuevaCuenta.categ}
                onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, categ: e.target.value })}
                placeholder="Ej: VTA_PROD"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cuenta_contable">Nombre de la Cuenta Contable</Label>
              <Input
                id="cuenta_contable"
                value={nuevaCuenta.cuenta_contable}
                onChange={(e) => setNuevaCuenta({ ...nuevaCuenta, cuenta_contable: e.target.value })}
                placeholder="Ej: Ventas de Productos"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Cuenta</Label>
              <Select
                value={nuevaCuenta.tipo}
                onValueChange={(value: any) => setNuevaCuenta({ ...nuevaCuenta, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                  <SelectItem value="financiero">Financiero</SelectItem>
                  <SelectItem value="distribucion">Distribución</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={crearNuevaCuenta} disabled={!nuevaCuenta.categ || !nuevaCuenta.cuenta_contable}>
                Crear Cuenta
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
