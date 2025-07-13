"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface FiltrosFinancierosProps {
  año: number
  semestre?: number
  mostrarDecimales: boolean
  onAñoChange: (año: number) => void
  onSemestreChange: (semestre?: number) => void
  onMostrarDecimalesChange: (mostrar: boolean) => void
}

export function FiltrosFinancieros({
  año,
  semestre,
  mostrarDecimales,
  onAñoChange,
  onSemestreChange,
  onMostrarDecimalesChange,
}: FiltrosFinancierosProps) {
  const años = [2022, 2023, 2024, 2025]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="año">Año</Label>
            <Select value={año.toString()} onValueChange={(value) => onAñoChange(Number.parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar año" />
              </SelectTrigger>
              <SelectContent>
                {años.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="semestre">Semestre</Label>
            <Select
              value={semestre?.toString() || "todos"}
              onValueChange={(value) => onSemestreChange(value === "todos" ? undefined : Number.parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar semestre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el año</SelectItem>
                <SelectItem value="1">1er Semestre</SelectItem>
                <SelectItem value="2">2do Semestre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="decimales" checked={mostrarDecimales} onCheckedChange={onMostrarDecimalesChange} />
            <Label htmlFor="decimales">Mostrar decimales</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
