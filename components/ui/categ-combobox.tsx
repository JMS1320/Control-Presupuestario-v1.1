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

interface CuentaContable {
  categ: string
  nro_cuenta: string | null
}

interface CategComboboxProps {
  value: string
  onValueChange: (value: string) => void
  /** Callback adicional que devuelve categ + nro_cuenta cuando se selecciona desde cuentas_contables */
  onSelectFull?: (categ: string, nro_cuenta: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CategCombobox({
  value,
  onValueChange,
  onSelectFull,
  placeholder = "Buscar CATEG...",
  className,
  disabled = false
}: CategComboboxProps) {
  const [open, setOpen] = useState(false)
  const [cuentas, setCuentas] = useState<CuentaContable[]>([])
  const [extras, setExtras] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const cargarCategorias = async () => {
    setLoading(true)
    try {
      // Fuente maestra: cuentas_contables (categ + nro_cuenta)
      const { data: contables } = await supabase
        .from('cuentas_contables')
        .select('categ, nro_cuenta')
        .eq('activo', true)
        .order('nro_cuenta')

      setCuentas(contables || [])

      // Fuentes secundarias: categ usadas en extractos/templates que no estén en cuentas_contables
      const [templates, movimientos] = await Promise.all([
        supabase.from('egresos_sin_factura').select('categ').not('categ', 'is', null),
        supabase.from('msa_galicia').select('categ').not('categ', 'is', null),
      ])

      const maestras = new Set((contables || []).map(c => c.categ))
      const extrasSet = new Set<string>()

      templates.data?.forEach(t => t.categ && !maestras.has(t.categ) && extrasSet.add(t.categ))
      movimientos.data?.forEach(m => m.categ && !maestras.has(m.categ) && !m.categ.startsWith('INVALIDA:') && extrasSet.add(m.categ))

      setExtras(Array.from(extrasSet).sort())
    } catch (error) {
      console.error('Error cargando categorías:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarCategorias()
  }, [])

  const q = value.toLowerCase()
  const cuentasFiltradas = cuentas.filter(c => c.categ.toLowerCase().includes(q))
  const extrasFiltrados = extras.filter(e => e.toLowerCase().includes(q))

  const handleSelect = (categ: string, nro_cuenta: string | null = null) => {
    const newValue = categ === value ? "" : categ
    onValueChange(newValue)
    if (onSelectFull) {
      onSelectFull(newValue, newValue ? nro_cuenta : null)
    }
    setOpen(false)
  }

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
      <PopoverContent className="w-[340px] p-0">
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
            {/* Limpiar */}
            {value && (
              <CommandItem
                value=""
                onSelect={() => handleSelect("")}
                className="text-red-600"
              >
                <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                Limpiar
              </CommandItem>
            )}

            {/* Cuentas maestras */}
            {cuentasFiltradas.slice(0, 20).map((cuenta) => (
              <CommandItem
                key={cuenta.categ}
                value={cuenta.categ}
                onSelect={() => handleSelect(cuenta.categ, cuenta.nro_cuenta)}
              >
                <Check className={cn("mr-2 h-4 w-4", value === cuenta.categ ? "opacity-100" : "opacity-0")} />
                <span className="flex-1">{cuenta.categ}</span>
                {cuenta.nro_cuenta && (
                  <span className="ml-2 text-xs text-gray-400">{cuenta.nro_cuenta}</span>
                )}
              </CommandItem>
            ))}

            {/* Extras (no en cuentas_contables) */}
            {extrasFiltrados.length > 0 && cuentasFiltradas.length < 20 && (
              <>
                <CommandItem disabled className="text-xs text-gray-400 py-1">
                  — Sin número de cuenta —
                </CommandItem>
                {extrasFiltrados.slice(0, 20 - cuentasFiltradas.length).map((e) => (
                  <CommandItem
                    key={e}
                    value={e}
                    onSelect={() => handleSelect(e, null)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === e ? "opacity-100" : "opacity-0")} />
                    {e}
                  </CommandItem>
                ))}
              </>
            )}

            {(cuentasFiltradas.length + extrasFiltrados.length) > 20 && (
              <CommandItem disabled className="text-xs text-gray-400">
                ... sigue escribiendo para filtrar
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
