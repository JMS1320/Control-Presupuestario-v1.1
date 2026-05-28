"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { normalizarBusqueda } from "@/lib/normalizar-texto"
import { toast } from "sonner"

interface InsumoOpt { id: string; producto: string; unidad_medida?: string | null }
interface CategoriaInsumo { id: string; nombre: string; unidad_medida: string | null }

/**
 * Selector de insumo: buscador que SOLO permite elegir insumos existentes
 * (no acepta texto libre) + opción "➕ Nuevo insumo" para crearlo en el momento.
 */
export function InsumoCombobox({
  value,
  insumos,
  onChange,
  onCreated,
  categoriasExcluidas,
  disabled = false,
  className,
}: {
  value: string | null
  insumos: InsumoOpt[]
  onChange: (id: string) => void
  /** Se llama tras crear un insumo nuevo (para que el padre recargue la lista) */
  onCreated?: () => void | Promise<void>
  /** Nombres de categorías a NO ofrecer al crear (ej. ['Agroquímico'] en órdenes ganaderas) */
  categoriasExcluidas?: string[]
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [creando, setCreando] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaInsumo[]>([])
  const [form, setForm] = useState({ producto: "", categoria_id: "", unidad_medida: "" })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.schema('productivo').from('categorias_insumo')
      .select('id, nombre, unidad_medida').eq('activo', true).order('nombre')
      .then(({ data }) => setCategorias((data as CategoriaInsumo[]) || []))
  }, [])

  const seleccionado = insumos.find(i => i.id === value)
  const q = normalizarBusqueda(busqueda)
  const filtrados = q ? insumos.filter(i => normalizarBusqueda(i.producto).includes(q)) : insumos

  const seleccionar = (id: string) => { onChange(id); setOpen(false); setBusqueda("") }

  const guardarNuevo = async () => {
    if (!form.producto.trim()) { toast.error('Ingresá el nombre del insumo'); return }
    if (!form.categoria_id) { toast.error('Elegí una categoría'); return }
    setGuardando(true)
    const { data, error } = await supabase.schema('productivo').from('stock_insumos')
      .insert({
        producto: form.producto.trim(),
        categoria_id: form.categoria_id,
        unidad_medida: form.unidad_medida.trim() || null,
        cantidad: 0,
      })
      .select('id, producto, unidad_medida').single()
    setGuardando(false)
    if (error) { toast.error('Error al crear insumo: ' + error.message); return }
    toast.success('Insumo creado')
    if (onCreated) await onCreated()
    if (data) onChange(data.id)
    setCreando(false)
    setForm({ producto: "", categoria_id: "", unidad_medida: "" })
    setOpen(false)
    setBusqueda("")
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreando(false) }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled}
          className={cn("justify-between font-normal h-8 text-xs", className)}>
          <span className="truncate">{seleccionado ? seleccionado.producto : "Seleccionar insumo"}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {creando ? (
          <div className="p-2 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1"><Plus className="h-3 w-3" /> Nuevo insumo</p>
            <Input className="h-8 text-xs" placeholder="Nombre del insumo" value={form.producto}
              onChange={e => setForm(f => ({ ...f, producto: e.target.value }))} autoFocus />
            <Select value={form.categoria_id} onValueChange={v => {
              const cat = categorias.find(c => c.id === v)
              setForm(f => ({ ...f, categoria_id: v, unidad_medida: cat?.unidad_medida || f.unidad_medida }))
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                {categorias
                  .filter(c => !(categoriasExcluidas || []).includes(c.nombre))
                  .map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-8 text-xs" placeholder="Unidad (L, ml, kg, dosis...)" value={form.unidad_medida}
              onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))} />
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCreando(false)}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={guardarNuevo} disabled={guardando}>
                {guardando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Crear
              </Button>
            </div>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar insumo..." value={busqueda} onValueChange={setBusqueda} />
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup className="max-h-56 overflow-auto">
              {filtrados.map(i => (
                <CommandItem key={i.id} value={i.id} onSelect={() => seleccionar(i.id)}>
                  <Check className={cn("mr-2 h-4 w-4", value === i.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 text-xs">{i.producto}</span>
                  {i.unidad_medida && <span className="text-[10px] text-muted-foreground ml-2">{i.unidad_medida}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            <div className="border-t p-1">
              <Button size="sm" variant="ghost" className="w-full justify-start h-7 text-xs text-green-700"
                onClick={() => setCreando(true)}>
                <Plus className="h-3 w-3 mr-1" /> Nuevo insumo
              </Button>
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}
