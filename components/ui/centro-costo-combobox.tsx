"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { toast } from "sonner"

interface CentroCosto { id: string; nombre: string }

/**
 * Selector de centro de costo: buscador que SOLO permite elegir centros existentes
 * (no acepta texto libre) + opción "➕ Nuevo" que lo crea en la tabla maestra
 * public.centros_costo. Guarda el NOMBRE (string) en el campo centro_costo.
 */
export function CentroCostoCombobox({
  value,
  onValueChange,
  placeholder = "Centro de costo...",
  className,
  disabled = false,
  autoFocus = false,
}: {
  value: string | null
  onValueChange: (nombre: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [open, setOpen] = useState(autoFocus)
  const [centros, setCentros] = useState<CentroCosto[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [creando, setCreando] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [guardando, setGuardando] = useState(false)

  const cargar = async () => {
    const { data } = await supabase
      .from('centros_costo')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
    setCentros((data as CentroCosto[]) || [])
  }

  useEffect(() => { cargar() }, [])

  const q = normalizarBusqueda(busqueda)
  const filtrados = q ? centros.filter(c => normalizarBusqueda(c.nombre).includes(q)) : centros

  const seleccionar = (nombre: string) => {
    onValueChange(nombre === value ? "" : nombre)
    setOpen(false)
    setBusqueda("")
  }

  const guardarNuevo = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) { toast.error('Ingresá el nombre del centro de costo'); return }
    // Si ya existe (case-insensitive), lo reutiliza en vez de duplicar
    const existente = centros.find(c => normalizarBusqueda(c.nombre) === normalizarBusqueda(nombre))
    if (existente) {
      onValueChange(existente.nombre)
      setCreando(false); setNuevoNombre(""); setOpen(false); setBusqueda("")
      return
    }
    setGuardando(true)
    const { data, error } = await supabase
      .from('centros_costo')
      .insert({ nombre })
      .select('id, nombre')
      .single()
    setGuardando(false)
    if (error) { toast.error('Error al crear centro de costo: ' + error.message); return }
    toast.success('Centro de costo creado')
    await cargar()
    if (data) onValueChange((data as CentroCosto).nombre)
    setCreando(false); setNuevoNombre(""); setOpen(false); setBusqueda("")
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) cargar(); if (!o) setCreando(false) }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("justify-between font-normal", className)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {creando ? (
          <div className="p-2 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><Plus className="h-3 w-3" /> Nuevo centro de costo</p>
            <Input
              className="h-8 text-sm"
              placeholder="Nombre del centro de costo"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') guardarNuevo() }}
            />
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreando(false); setNuevoNombre("") }}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={guardarNuevo} disabled={guardando}>
                {guardando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Crear
              </Button>
            </div>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar centro de costo..." value={busqueda} onValueChange={setBusqueda} />
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup className="max-h-56 overflow-auto">
              {value && (
                <CommandItem value="__limpiar__" onSelect={() => seleccionar("")} className="text-red-600">
                  <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                  Limpiar
                </CommandItem>
              )}
              {filtrados.map(c => (
                <CommandItem key={c.id} value={c.nombre} onSelect={() => seleccionar(c.nombre)}>
                  <Check className={cn("mr-2 h-4 w-4", value === c.nombre ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 text-sm">{c.nombre}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t p-1">
              <Button
                size="sm" variant="ghost"
                className="w-full justify-start h-7 text-xs text-green-700"
                onClick={() => { setCreando(true); setNuevoNombre(busqueda) }}
              >
                <Plus className="h-3 w-3 mr-1" /> Nuevo centro de costo
              </Button>
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
