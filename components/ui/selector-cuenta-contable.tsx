"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Search } from "lucide-react"
import { supabase } from "@/lib/supabase"

export interface CuentaContableItem {
  categ: string
  nro_cuenta: string
  cuenta_contable: string
  nombre_totalizadora: string | null
}

interface SelectorCuentaContableProps {
  /** Valor actual (categ) */
  value?: string | null
  /** Callback al seleccionar */
  onSelect: (cuenta: CuentaContableItem | null) => void
  /** CUIT del proveedor para sugerir cuentas usadas antes */
  cuitProveedor?: string | null
  /** Schema para buscar historial (default: 'msa') */
  schemaName?: string
  /** Placeholder del buscador */
  placeholder?: string
  /** Modo de renderizado */
  modo?: 'inline' | 'dropdown' | 'modal-list'
  /** Cuentas pre-cargadas (evita query adicional) */
  cuentasPrecargadas?: CuentaContableItem[]
  /** Auto-focus en el input */
  autoFocus?: boolean
  /** Clase CSS adicional para el container */
  className?: string
  /** Callback al cancelar / cerrar (Escape o blur sin selección) */
  onCancel?: () => void
  /** Mostrar opción "Sin asignar" */
  mostrarSinAsignar?: boolean
}

// Cache global para evitar queries repetidos
let cuentasCache: CuentaContableItem[] | null = null
let cuentasCacheTimestamp = 0
let jerarquiaCache: Map<string, string> | null = null
const CACHE_TTL = 60_000 // 1 minuto

/** Construye mapa categ (lowercase) → nombre_totalizadora para TODA la tabla */
async function cargarJerarquia(): Promise<Map<string, string>> {
  if (jerarquiaCache) return jerarquiaCache

  const { data, error } = await supabase
    .from('cuentas_contables')
    .select('categ, nombre_totalizadora')

  if (error) {
    console.error('Error cargando jerarquía:', error)
    return new Map()
  }

  const mapa = new Map<string, string>()
  for (const row of (data ?? [])) {
    if (row.nombre_totalizadora) {
      mapa.set(row.categ.toLowerCase(), row.nombre_totalizadora)
    }
  }
  jerarquiaCache = mapa
  return mapa
}

/** Construye la ruta completa de jerarquía: "RESULTADOS > EGRESOS > EGRESOS POR GANADERIA > GASTOS DE ALIMENTACION" */
function construirRutaJerarquia(nombreTotalizadora: string | null, jerarquia: Map<string, string>): string {
  if (!nombreTotalizadora) return ''
  const partes: string[] = [nombreTotalizadora]
  let actual = nombreTotalizadora
  const visitados = new Set<string>()
  while (true) {
    const key = actual.toLowerCase()
    if (visitados.has(key)) break
    visitados.add(key)
    const padre = jerarquia.get(key)
    if (!padre) break
    partes.unshift(padre)
    actual = padre
  }
  return partes.join(' > ')
}

async function cargarCuentas(): Promise<CuentaContableItem[]> {
  const now = Date.now()
  if (cuentasCache && now - cuentasCacheTimestamp < CACHE_TTL) return cuentasCache

  const { data, error } = await supabase
    .from('cuentas_contables')
    .select('categ, nro_cuenta, cuenta_contable, nombre_totalizadora')
    .eq('imputable', true)
    .order('nombre_totalizadora')
    .order('nro_cuenta')

  if (error) {
    console.error('Error cargando cuentas contables:', error)
    return cuentasCache ?? []
  }

  cuentasCache = (data ?? []) as CuentaContableItem[]
  cuentasCacheTimestamp = now
  return cuentasCache
}

async function cargarHistorialProveedor(cuit: string, schemaName: string): Promise<Map<string, number>> {
  const freq = new Map<string, number>()
  if (!cuit) return freq

  // Buscar en comprobantes_arca
  const { data: arcaRows } = await supabase
    .schema(schemaName)
    .from('comprobantes_arca')
    .select('cuenta_contable')
    .eq('cuit', cuit)
    .not('cuenta_contable', 'is', null)
    .limit(200)

  ;(arcaRows ?? []).forEach((r: any) => {
    if (r.cuenta_contable) freq.set(r.cuenta_contable, (freq.get(r.cuenta_contable) ?? 0) + 1)
  })

  // Buscar en comprobantes_historico
  const { data: histRows } = await supabase
    .schema(schemaName)
    .from('comprobantes_historico')
    .select('cuenta_asignada')
    .eq('nro_doc_emisor', cuit)
    .not('cuenta_asignada', 'is', null)
    .limit(200)

  ;(histRows ?? []).forEach((r: any) => {
    if (r.cuenta_asignada) freq.set(r.cuenta_asignada, (freq.get(r.cuenta_asignada) ?? 0) + 1)
  })

  return freq
}

/**
 * Selector unificado de cuentas contables.
 * - Muestra sugerencias por historial del proveedor primero
 * - Buscador por nombre, código o nro_cuenta
 * - Agrupado por nombre_totalizadora (jerarquía completa)
 */
export function SelectorCuentaContable({
  value,
  onSelect,
  cuitProveedor,
  schemaName = 'msa',
  placeholder = 'Buscar cuenta...',
  modo = 'dropdown',
  cuentasPrecargadas,
  autoFocus = true,
  className = '',
  onCancel,
  mostrarSinAsignar = true,
}: SelectorCuentaContableProps) {
  const [cuentas, setCuentas] = useState<CuentaContableItem[]>(cuentasPrecargadas ?? [])
  const [historial, setHistorial] = useState<Map<string, number>>(new Map())
  const [jerarquia, setJerarquia] = useState<Map<string, string>>(new Map())
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // En modo 'dropdown' la lista arranca COLAPSADA y se abre al click. 'inline'/'modal-list' siempre visibles.
  const dropdownMode = modo === 'dropdown'
  const listaVisible = !dropdownMode || isOpen

  useEffect(() => {
    if (cuentasPrecargadas) {
      setCuentas(cuentasPrecargadas)
    } else {
      cargarCuentas().then(setCuentas)
    }
    cargarJerarquia().then(setJerarquia)
  }, [cuentasPrecargadas])

  useEffect(() => {
    if (cuitProveedor) {
      cargarHistorialProveedor(cuitProveedor, schemaName).then(setHistorial)
    }
  }, [cuitProveedor, schemaName])

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [autoFocus])

  // Mapa de ruta completa por nombre_totalizadora (memoizado)
  const rutasMap = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const c of cuentas) {
      const key = c.nombre_totalizadora || 'Sin grupo'
      if (!mapa.has(key)) {
        mapa.set(key, construirRutaJerarquia(c.nombre_totalizadora, jerarquia))
      }
    }
    return mapa
  }, [cuentas, jerarquia])

  // Filtrar y agrupar
  const { sugeridas, agrupadas, totalResultados } = useMemo(() => {
    const q = busqueda.toLowerCase().trim()

    // Filtrar por búsqueda (incluye ruta completa de jerarquía)
    const filtradas = q
      ? cuentas.filter(c => {
          const ruta = rutasMap.get(c.nombre_totalizadora || 'Sin grupo') || ''
          return c.categ.toLowerCase().includes(q) ||
            (c.cuenta_contable || '').toLowerCase().includes(q) ||
            (c.nro_cuenta || '').includes(busqueda) ||
            (c.nombre_totalizadora || '').toLowerCase().includes(q) ||
            ruta.toLowerCase().includes(q)
        })
      : cuentas

    // Separar sugeridas (historial proveedor) de todas
    const sugeridas: (CuentaContableItem & { usos: number })[] = []
    const vistas = new Set<string>()

    if (!q && historial.size > 0) {
      // Ordenar por frecuencia de uso
      const entries = Array.from(historial.entries()).sort((a, b) => b[1] - a[1])
      for (const [categ, usos] of entries) {
        const cuenta = cuentas.find(c => c.categ === categ)
        if (cuenta) {
          sugeridas.push({ ...cuenta, usos })
          vistas.add(categ)
        }
      }
    }

    // Agrupar el resto por nombre_totalizadora
    const restantes = filtradas.filter(c => !vistas.has(c.categ))
    const grupos = new Map<string, CuentaContableItem[]>()
    for (const c of restantes) {
      const g = c.nombre_totalizadora || 'Sin grupo'
      if (!grupos.has(g)) grupos.set(g, [])
      grupos.get(g)!.push(c)
    }

    return {
      sugeridas,
      agrupadas: grupos,
      totalResultados: sugeridas.length + restantes.length
    }
  }, [cuentas, busqueda, historial, rutasMap])

  const handleSelect = (cuenta: CuentaContableItem | null) => {
    onSelect(cuenta)
    if (dropdownMode) { setIsOpen(false); setBusqueda('') } // cierra al elegir
  }

  const maxHeight = modo === 'modal-list' ? 'max-h-[400px]' : 'max-h-[300px]'

  return (
    <div className={`relative ${className}`}>
      {/* Input búsqueda */}
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          className="w-full border rounded px-7 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder={placeholder}
          value={dropdownMode && !isOpen ? (value ?? '') : busqueda}
          onChange={(e) => { setBusqueda(e.target.value); if (dropdownMode) setIsOpen(true) }}
          onClick={() => { if (dropdownMode && !isOpen) { setIsOpen(true); setBusqueda('') } }}
          onBlur={() => { if (dropdownMode) setTimeout(() => setIsOpen(false), 150) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setIsOpen(false); onCancel?.() }
          }}
        />
        {busqueda && (
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-xs"
            onMouseDown={(e) => { e.preventDefault(); setBusqueda('') }}
          >✕</button>
        )}
      </div>

      {/* Lista de opciones — colapsada en modo dropdown hasta hacer click */}
      {listaVisible && (
      <div className={`${maxHeight} overflow-y-auto border rounded mt-0.5 bg-white ${dropdownMode ? 'absolute z-50 w-full shadow-lg' : ''}`}>
        {/* Opción sin asignar */}
        {mostrarSinAsignar && (
          <button
            className="w-full text-left px-2 py-1.5 hover:bg-gray-100 text-gray-400 italic text-xs border-b"
            onMouseDown={(e) => { e.preventDefault(); handleSelect(null) }}
          >
            — Sin asignar —
          </button>
        )}

        {/* Sugeridas por historial proveedor */}
        {sugeridas.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold text-green-700 bg-green-50 sticky top-0 z-10 border-b">
              Usadas para este proveedor
            </div>
            {sugeridas.map(c => {
              const ruta = rutasMap.get(c.nombre_totalizadora || 'Sin grupo') || c.nombre_totalizadora || ''
              return (
                <button
                  key={`sug-${c.categ}`}
                  className={`w-full text-left px-2 py-1.5 hover:bg-green-50 text-xs flex items-center gap-2
                    ${value === c.categ ? 'bg-blue-50 font-semibold' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
                >
                  <span className="flex-1 min-w-0">
                    {ruta && (
                      <span className="text-[9px] text-gray-400 block truncate">{ruta}</span>
                    )}
                    <span className="font-medium">{c.categ}</span>
                    <span className="ml-1.5 text-gray-400 font-mono text-[10px]">{c.nro_cuenta}</span>
                  </span>
                  <span className="shrink-0 text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">
                    {c.usos}x
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Todas las cuentas agrupadas */}
        {Array.from(agrupadas.entries()).map(([grupo, cuentasGrupo]) => {
          const ruta = rutasMap.get(grupo) || grupo
          return (
            <div key={grupo}>
              <div className="px-2 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-50 sticky top-0 z-10 truncate" title={ruta}>
                {ruta}
              </div>
              {cuentasGrupo.map(c => (
                <button
                  key={c.nro_cuenta}
                  className={`w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs
                    ${value === c.categ ? 'bg-blue-50 font-semibold' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}
                >
                  <span className="font-medium">{c.categ}</span>
                  <span className="ml-1.5 text-gray-400 font-mono text-[10px]">{c.nro_cuenta}</span>
                </button>
              ))}
            </div>
          )
        })}

        {totalResultados === 0 && (
          <div className="px-2 py-3 text-center text-xs text-gray-400">Sin resultados</div>
        )}
      </div>
      )}
    </div>
  )
}

/**
 * Invalidar cache (llamar después de crear una nueva cuenta)
 */
export function invalidarCacheCuentas() {
  cuentasCache = null
  cuentasCacheTimestamp = 0
  jerarquiaCache = null
}
