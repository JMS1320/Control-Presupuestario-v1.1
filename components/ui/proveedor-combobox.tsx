"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, X, Plus, Check } from "lucide-react"
import { normalizarBusqueda } from "@/lib/normalizar-texto"

interface Proveedor {
  cuit: string
  razon_social: string
  nombre_fantasia: string | null
}

export interface ProveedorSeleccionado {
  cuit: string
  nombre: string
}

interface Props {
  value: ProveedorSeleccionado
  onChange: (sel: ProveedorSeleccionado) => void
  label?: string         // "Proveedor" | "Cliente"
  required?: boolean
  disabled?: boolean
}

export function ProveedorCombobox({ value, onChange, label = "Proveedor", required, disabled }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [abierto, setAbierto] = useState(false)
  const [modoNuevo, setModoNuevo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cargar proveedores una sola vez al montar
  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("proveedores")
        .select("cuit, razon_social, nombre_fantasia")
        .eq("activo", true)
        .order("razon_social")
      if (!cancelado) {
        setProveedores(data || [])
        setLoading(false)
      }
    }
    cargar()
    return () => { cancelado = true }
  }, [])

  // Cerrar dropdown al click afuera
  useEffect(() => {
    const onClickAfuera = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    if (abierto) document.addEventListener("mousedown", onClickAfuera)
    return () => document.removeEventListener("mousedown", onClickAfuera)
  }, [abierto])

  // Resultados filtrados
  const resultados = useMemo(() => {
    if (!busqueda.trim()) return proveedores.slice(0, 30)
    const q = normalizarBusqueda(busqueda)
    return proveedores
      .filter(p => {
        const texto = normalizarBusqueda(`${p.razon_social} ${p.nombre_fantasia || ""} ${p.cuit}`)
        return texto.includes(q)
      })
      .slice(0, 50)
  }, [proveedores, busqueda])

  const tieneSeleccion = !!(value.cuit && value.nombre)
  const labelLower = label.toLowerCase()

  const seleccionar = (p: Proveedor) => {
    onChange({ cuit: p.cuit, nombre: p.razon_social })
    setBusqueda("")
    setAbierto(false)
    setModoNuevo(false)
  }

  const limpiar = () => {
    onChange({ cuit: "", nombre: "" })
    setBusqueda("")
    setModoNuevo(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Modo "nuevo proveedor" — 2 inputs editables, sin búsqueda en BD
  if (modoNuevo) {
    return (
      <div className="space-y-2">
        <Label>{label} nuevo{required ? " *" : ""}</Label>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <Input
            placeholder="CUIT"
            value={value.cuit}
            onChange={(e) => onChange({ ...value, cuit: e.target.value })}
            disabled={disabled}
          />
          <Input
            placeholder="Razón social"
            value={value.nombre}
            onChange={(e) => onChange({ ...value, nombre: e.target.value })}
            disabled={disabled}
          />
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setModoNuevo(false); limpiar() }}>
          ← Volver al buscador
        </Button>
      </div>
    )
  }

  // Si ya hay selección, mostrar como pill con botón limpiar
  if (tieneSeleccion) {
    return (
      <div className="space-y-2">
        <Label>{label}{required ? " *" : ""}</Label>
        <div className="flex items-center gap-2 border rounded-md p-2 bg-gray-50">
          <Check className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{value.nombre}</div>
            <div className="text-xs text-gray-500 font-mono">{value.cuit}</div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={limpiar} disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  // Modo búsqueda
  return (
    <div className="space-y-2" ref={containerRef}>
      <Label>{label}{required ? " *" : ""}</Label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={loading ? "Cargando proveedores..." : `Buscar ${labelLower} por nombre o CUIT...`}
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          className="pl-8"
          disabled={disabled || loading}
        />
        {abierto && !loading && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-72 overflow-y-auto">
            {resultados.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center space-y-2">
                <div>Sin resultados</div>
                <Button type="button" variant="link" size="sm" onClick={() => setModoNuevo(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Cargar nuevo {labelLower}
                </Button>
              </div>
            ) : (
              <>
                {resultados.map((p) => (
                  <button
                    key={p.cuit}
                    type="button"
                    onClick={() => seleccionar(p)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                  >
                    <div className="text-sm font-medium truncate">{p.razon_social}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="font-mono">{p.cuit}</span>
                      {p.nombre_fantasia && <Badge variant="outline" className="text-[10px]">{p.nombre_fantasia}</Badge>}
                    </div>
                  </button>
                ))}
                <div className="border-t p-2 bg-gray-50 sticky bottom-0">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setModoNuevo(true)} className="w-full">
                    <Plus className="h-3 w-3 mr-1" /> No aparece — cargar nuevo {labelLower}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
