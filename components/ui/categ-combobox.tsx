"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { supabase } from "@/lib/supabase"

interface CategComboboxProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CategCombobox({
  value,
  onValueChange,
  placeholder = "Buscar CATEG...",
  className,
  disabled = false
}: CategComboboxProps) {
  const [open, setOpen] = useState(false)
  const [categorias, setCategorias] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Cargar categorías únicas de todas las fuentes
  const cargarCategorias = async () => {
    setLoading(true)
    try {
      // Obtener categorías de múltiples fuentes
      const [facturas, templates, movimientos, contables] = await Promise.all([
        // Facturas ARCA
        supabase
          .schema('msa')
          .from('comprobantes_arca')
          .select('cuenta_contable')
          .not('cuenta_contable', 'is', null),
        
        // Templates egresos
        supabase
          .from('egresos_sin_factura')
          .select('categ')
          .not('categ', 'is', null),
        
        // Movimientos bancarios
        supabase
          .from('msa_galicia')
          .select('categ')
          .not('categ', 'is', null),
        
        // Cuentas contables maestras
        supabase
          .from('cuentas_contables')
          .select('codigo')
          .not('codigo', 'is', null)
      ])

      // Combinar todas las categorías únicas
      const todasCategorias = new Set<string>()
      
      facturas.data?.forEach(f => f.cuenta_contable && todasCategorias.add(f.cuenta_contable))
      templates.data?.forEach(t => t.categ && todasCategorias.add(t.categ))
      movimientos.data?.forEach(m => m.categ && todasCategorias.add(m.categ))
      contables.data?.forEach(c => c.codigo && todasCategorias.add(c.codigo))

      // Filtrar categorías inválidas y ordenar
      const categoriasLimpias = Array.from(todasCategorias)
        .filter(cat => cat && !cat.startsWith('INVALIDA:') && cat.trim() !== '')
        .sort()

      setCategorias(categoriasLimpias)
    } catch (error) {
      console.error('Error cargando categorías:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCategorias()
  }, [])

  // Filtrar categorías basado en búsqueda
  const categoriasFiltradas = categorias.filter(categoria =>
    categoria.toLowerCase().includes(value.toLowerCase())
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder}
            value={value}
            onValueChange={onValueChange}
          />
          <CommandEmpty>
            {loading ? "Cargando categorías..." : "No se encontraron categorías"}
          </CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {/* Opción para limpiar */}
            {value && (
              <CommandItem
                value=""
                onSelect={() => {
                  onValueChange("")
                  setOpen(false)
                }}
                className="text-red-600"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0"
                  )}
                />
                Limpiar filtro
              </CommandItem>
            )}
            
            {/* Categorías existentes */}
            {categoriasFiltradas.slice(0, 20).map((categoria) => (
              <CommandItem
                key={categoria}
                value={categoria}
                onSelect={(currentValue) => {
                  onValueChange(currentValue === value ? "" : currentValue)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === categoria ? "opacity-100" : "opacity-0"
                  )}
                />
                {categoria}
              </CommandItem>
            ))}
            
            {/* Mostrar si hay más resultados */}
            {categoriasFiltradas.length > 20 && (
              <CommandItem disabled>
                ... y {categoriasFiltradas.length - 20} más (sigue escribiendo)
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}