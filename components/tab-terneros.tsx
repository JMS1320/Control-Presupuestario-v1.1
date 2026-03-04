"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, CheckCircle2, AlertCircle, Baby, Scale, History, ChevronRight, ChevronLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Pesada {
  id: string
  fecha: string
  peso_kg: number
}

interface Ternero {
  id: string
  caravana_interna: string | null
  caravana_oficial: string | null
  sexo: string | null
  pelo: string | null
  fecha_destete: string | null
  es_torito: boolean
  observaciones: string | null
  activo: boolean
  created_at: string
  pesadas_terneros: Pesada[]
}

interface PesadaSinVincular {
  id: string
  caravana_idv: string | null
  fecha: string
  peso_kg: number
}

interface ResultadoImportTerneros {
  procesados: number
  insertados: number
  omitidos: number
  duplicados_en_archivo: string[]
  duplicados_en_bd: string[]
  errores: string[]
}

interface AnalisisPesadas {
  fecha: string
  sin_idv: number
  total_con_idv: number
  ok: Array<{ idv: string; caravana_oficial: string; ternero_id: string; peso: number }>
  no_encontradas: Array<{ idv: string; caravana_oficial: string; peso: number }>
  duplicadas: Array<{ idv: string; caravana_oficial: string; peso: number; terneros: Pick<Ternero, 'id' | 'caravana_oficial' | 'caravana_interna' | 'sexo' | 'pelo'>[] }>
}

interface DecisionNoEncontrada {
  caravana_idv: string
  caravana_oficial: string
  peso: number
  accion: 'sin_vincular' | 'crear_nuevo' | 'ignorar'
}

interface DecisionDuplicada {
  caravana_idv: string
  peso: number
  ternero_id_elegido: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PELO_LABEL: Record<string, string> = {
  'Colorado': '🟠 Colorado',
  'Negro': '⚫ Negro',
  'Careta Colorado': '🟠 Careta Col.',
  'Careta Negro': '⚫ Careta Neg.',
  'Otros': 'Otros',
}

const DEFAULT_GANANCIA_KG_DIA = 0.8

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUltimaPesada(pesadas: Pesada[]): Pesada | null {
  if (!pesadas.length) return null
  return [...pesadas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
}

function getPesoEstimadoHoy(pesadas: Pesada[], gananciaDiaria: number): number | null {
  const ultima = getUltimaPesada(pesadas)
  if (!ultima) return null
  const diasDesde = Math.floor((Date.now() - new Date(ultima.fecha).getTime()) / 86400000)
  return ultima.peso_kg + gananciaDiaria * diasDesde
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function formatPeso(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

function formatKg(kg: number): string {
  return kg.toLocaleString('es-AR', { maximumFractionDigits: 0 }) + ' kg'
}

interface SummaryStats {
  total: number
  conPesada: number
  totalKg: number
  promedioKg: number
  totalEstimadoKg: number
  promedioEstimadoKg: number
}

function calcSummary(lista: Ternero[], gananciaDiaria: number): SummaryStats {
  const conPesada = lista.filter(t => t.pesadas_terneros.length > 0)
  const ultimas = conPesada
    .map(t => getUltimaPesada(t.pesadas_terneros))
    .filter((p): p is Pesada => p !== null)

  // Promedio: solo sobre animales CON pesada
  const sumaKg = ultimas.reduce((sum, p) => sum + p.peso_kg, 0)
  const promedioKg = ultimas.length > 0 ? sumaKg / ultimas.length : 0
  // Total rodeo: extrapolado — los sin pesada asumen peso promedio
  const totalKg = promedioKg * lista.length

  const estimados = conPesada
    .map(t => getPesoEstimadoHoy(t.pesadas_terneros, gananciaDiaria))
    .filter((p): p is number => p !== null)
  const promedioEstimadoKg = estimados.length > 0 ? estimados.reduce((sum, p) => sum + p, 0) / estimados.length : 0
  // Mismo criterio: extrapolado sobre total cabezas
  const totalEstimadoKg = promedioEstimadoKg * lista.length

  return { total: lista.length, conPesada: conPesada.length, totalKg, promedioKg, totalEstimadoKg, promedioEstimadoKg }
}

// kg/día entre las últimas 2 pesadas (requiere ≥ 2)
function getGananciaUlt2(pesadas: Pesada[]): number | null {
  if (pesadas.length < 2) return null
  const sorted = [...pesadas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const dias = Math.round((new Date(last.fecha).getTime() - new Date(prev.fecha).getTime()) / 86400000)
  if (dias <= 0) return null
  return (last.peso_kg - prev.peso_kg) / dias
}

// kg/día de punta a punta: primera → última pesada (requiere ≥ 2)
function getGananciaPuntaAPunta(pesadas: Pesada[]): number | null {
  if (pesadas.length < 2) return null
  const sorted = [...pesadas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const dias = Math.round((new Date(last.fecha).getTime() - new Date(first.fecha).getTime()) / 86400000)
  if (dias <= 0) return null
  return (last.peso_kg - first.peso_kg) / dias
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TabTerneros() {
  // Datos
  const [terneros, setTerneros] = useState<Ternero[]>([])
  const [pesadasSinVincular, setPesadasSinVincular] = useState<PesadaSinVincular[]>([])
  const [cargando, setCargando] = useState(true)

  // Estimación
  const [gananciaDiaria, setGananciaDiaria] = useState(DEFAULT_GANANCIA_KG_DIA)

  // Import terneros
  const [importandoTerneros, setImportandoTerneros] = useState(false)
  const [modalResultadoT, setModalResultadoT] = useState(false)
  const [resultadoT, setResultadoT] = useState<ResultadoImportTerneros | null>(null)
  const inputTernerosRef = useRef<HTMLInputElement>(null)

  // Import pesadas
  const [importandoPesadas, setImportandoPesadas] = useState(false)
  const [modalPesadas, setModalPesadas] = useState(false)
  const [pasoPesadas, setPasoPesadas] = useState<1 | 2 | 3>(1)
  const [analisis, setAnalisis] = useState<AnalisisPesadas | null>(null)
  const [tipoNoEncontradas, setTipoNoEncontradas] = useState<'sin_vincular' | 'crear_nuevo'>('sin_vincular')
  const [creacionesSeleccionadas, setCreacionesSeleccionadas] = useState<Set<string>>(new Set())
  const [decisionesDuplicadas, setDecisionesDuplicadas] = useState<Record<string, string>>({})
  const inputPesadasRef = useRef<HTMLInputElement>(null)

  // Historial
  const [modalHistorial, setModalHistorial] = useState(false)

  // ─── Carga de datos ──────────────────────────────────────────────────────

  const cargar = async () => {
    setCargando(true)
    try {
      const [resTerneros, resSinVincular] = await Promise.all([
        supabase
          .schema('productivo')
          .from('terneros')
          .select('*, pesadas_terneros(id, fecha, peso_kg)')
          .eq('activo', true)
          .order('caravana_oficial', { ascending: true }),
        supabase
          .schema('productivo')
          .from('pesadas_terneros')
          .select('id, caravana_idv, fecha, peso_kg')
          .is('ternero_id', null)
          .order('fecha', { ascending: false }),
      ])

      if (resTerneros.error) throw resTerneros.error
      setTerneros(resTerneros.data ?? [])
      setPesadasSinVincular(resSinVincular.data ?? [])
    } catch (err: any) {
      toast.error('Error cargando terneros: ' + err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  // ─── Import terneros ─────────────────────────────────────────────────────

  const handleArchivoTerneros = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportandoTerneros(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import-terneros', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error en importación')
      setResultadoT(data)
      setModalResultadoT(true)
      await cargar()
    } catch (err: any) {
      toast.error('Error importando: ' + err.message)
    } finally {
      setImportandoTerneros(false)
    }
  }

  // ─── Import pesadas ──────────────────────────────────────────────────────

  const handleArchivoPesadas = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportandoPesadas(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/import-pesadas?accion=analizar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al analizar archivo')

      setAnalisis(data)
      setPasoPesadas(1)
      setTipoNoEncontradas('sin_vincular')
      setCreacionesSeleccionadas(new Set(data.no_encontradas.map((r: any) => r.idv)))
      setDecisionesDuplicadas(
        Object.fromEntries(data.duplicadas.map((d: any) => [d.idv, '']))
      )
      setModalPesadas(true)
    } catch (err: any) {
      toast.error('Error analizando pesadas: ' + err.message)
    } finally {
      setImportandoPesadas(false)
    }
  }

  const confirmarPesadas = async () => {
    if (!analisis) return
    setImportandoPesadas(true)
    try {
      // Construir decisiones no encontradas
      const noEncontradasDecisiones: DecisionNoEncontrada[] = analisis.no_encontradas.map(r => ({
        caravana_idv: r.idv,
        caravana_oficial: r.caravana_oficial,
        peso: r.peso,
        accion: tipoNoEncontradas === 'crear_nuevo' && creacionesSeleccionadas.has(r.idv)
          ? 'crear_nuevo'
          : 'sin_vincular',
      }))

      // Construir decisiones duplicadas
      const duplicadasDecisiones: DecisionDuplicada[] = analisis.duplicadas
        .filter(d => decisionesDuplicadas[d.idv])
        .map(d => ({
          caravana_idv: d.idv,
          peso: d.peso,
          ternero_id_elegido: decisionesDuplicadas[d.idv],
        }))

      const body = {
        fecha: analisis.fecha,
        rows_ok: analisis.ok,
        no_encontradas_decisiones: noEncontradasDecisiones,
        duplicadas_decisiones: duplicadasDecisiones,
      }

      const res = await fetch('/api/import-pesadas?accion=confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al confirmar')

      toast.success(`✅ ${data.insertadas} pesadas importadas`)
      if (data.errores?.length) toast.error(`${data.errores.length} errores técnicos`)
      setModalPesadas(false)
      await cargar()
    } catch (err: any) {
      toast.error('Error confirmando pesadas: ' + err.message)
    } finally {
      setImportandoPesadas(false)
    }
  }

  // ─── Computados ──────────────────────────────────────────────────────────

  const machos = terneros.filter(t => t.sexo === 'Macho')
  const hembras = terneros.filter(t => t.sexo === 'Hembra')
  const toritos = terneros.filter(t => t.es_torito)
  const conPesadas = terneros.filter(t => t.pesadas_terneros.length > 0)

  // Detección de caravanas duplicadas en BD
  const idsConDuplicado = new Set<string>()
  const conteoInternas = new Map<string, string[]>()
  const conteoOficiales = new Map<string, string[]>()
  terneros.forEach(t => {
    if (t.caravana_interna) {
      const lista = conteoInternas.get(t.caravana_interna) ?? []
      lista.push(t.id)
      conteoInternas.set(t.caravana_interna, lista)
    }
    if (t.caravana_oficial) {
      const lista = conteoOficiales.get(t.caravana_oficial) ?? []
      lista.push(t.id)
      conteoOficiales.set(t.caravana_oficial, lista)
    }
  })
  conteoInternas.forEach(ids => { if (ids.length > 1) ids.forEach(id => idsConDuplicado.add(id)) })
  conteoOficiales.forEach(ids => { if (ids.length > 1) ids.forEach(id => idsConDuplicado.add(id)) })

  // Pivot table para historial: fechas únicas ordenadas
  const todasFechas = [...new Set(
    terneros.flatMap(t => t.pesadas_terneros.map(p => p.fecha))
  )].sort()

  // Pares de fechas consecutivas para la tabla de ganancias del historial
  const pares = todasFechas.slice(1).map((f, i) => ({
    fechaAnterior: todasFechas[i],
    fechaActual: f,
    dias: Math.round((new Date(f).getTime() - new Date(todasFechas[i]).getTime()) / 86400000),
  }))

  // Terneros ordenados por ganancia últ. 2 pesadas desc (nulls al final)
  const ternerosOrdenados = [...terneros].sort((a, b) => {
    const ga = getGananciaUlt2(a.pesadas_terneros)
    const gb = getGananciaUlt2(b.pesadas_terneros)
    if (ga === null && gb === null) return (a.caravana_oficial ?? '').localeCompare(b.caravana_oficial ?? '')
    if (ga === null) return 1
    if (gb === null) return -1
    return gb - ga
  })

  // ─── Paso actual del modal pesadas ──────────────────────────────────────

  const hayConflictos = analisis && (analisis.no_encontradas.length > 0 || analisis.duplicadas.length > 0)
  const duplicadasSinResolver = analisis?.duplicadas.filter(d => !decisionesDuplicadas[d.idv]) ?? []

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 mt-4">

      {/* ── Header: badges + botones ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
            <Baby className="h-3 w-3 mr-1" />
            {terneros.length} terneros
          </Badge>
          <Badge variant="outline" className="text-sky-700 border-sky-300 bg-sky-50">
            ♂ {machos.length} machos
          </Badge>
          <Badge variant="outline" className="text-pink-700 border-pink-300 bg-pink-50">
            ♀ {hembras.length} hembras
          </Badge>
          {toritos.length > 0 && (
            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
              🐂 {toritos.length} toritos
            </Badge>
          )}
          {conPesadas.length > 0 && (
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
              <Scale className="h-3 w-3 mr-1" />
              {conPesadas.length} con pesada
            </Badge>
          )}
          {idsConDuplicado.size > 0 && (
            <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
              ⚠️ {idsConDuplicado.size} caravana dup.
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botón historial global (solo si hay fechas de pesada) */}
          {todasFechas.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalHistorial(true)}
              className="flex items-center gap-1 border-blue-300 text-blue-700"
            >
              <History className="h-4 w-4" />
              Historial pesadas
            </Button>
          )}

          {/* Import pesadas */}
          <input ref={inputPesadasRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleArchivoPesadas} />
          <Button
            variant="outline"
            onClick={() => inputPesadasRef.current?.click()}
            disabled={importandoPesadas}
            className="flex items-center gap-1 border-green-600 text-green-700 hover:bg-green-50"
          >
            <Scale className="h-4 w-4" />
            {importandoPesadas ? 'Analizando...' : 'Importar Pesadas'}
          </Button>

          {/* Import terneros */}
          <input ref={inputTernerosRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleArchivoTerneros} />
          <Button
            onClick={() => inputTernerosRef.current?.click()}
            disabled={importandoTerneros}
            className="bg-green-700 hover:bg-green-800 flex items-center gap-1"
          >
            <Upload className="h-4 w-4" />
            {importandoTerneros ? 'Importando...' : 'Importar Terneros'}
          </Button>
        </div>
      </div>

      {/* ── Input ganancia estimada ── */}
      {conPesadas.length > 0 && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <Label className="text-sm text-green-800 whitespace-nowrap">Ganancia diaria estimada:</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={gananciaDiaria}
              onChange={e => setGananciaDiaria(parseFloat(e.target.value) || 0)}
              className="w-20 h-7 text-sm text-center"
            />
            <span className="text-sm text-green-700">kg/día</span>
          </div>
          <span className="text-xs text-green-600">— usado para estimar peso actual de cada ternero</span>
        </div>
      )}

      {/* ── Tarjetas de resumen por sexo ── */}
      {conPesadas.length > 0 && (() => {
        const statsMachos = calcSummary(machos, gananciaDiaria)
        const statsHembras = calcSummary(hembras, gananciaDiaria)
        const statsTotal = calcSummary(terneros, gananciaDiaria)
        const grupos = [
          { key: 'M', label: '♂ Machos',     stats: statsMachos,  bg: 'bg-sky-50',   border: 'border-sky-200',   title: 'text-sky-800',   est: 'text-sky-700'  },
          { key: 'H', label: '♀ Hembras',    stats: statsHembras, bg: 'bg-pink-50',  border: 'border-pink-200',  title: 'text-pink-800',  est: 'text-pink-700' },
          { key: 'T', label: 'Total Rodeo',  stats: statsTotal,   bg: 'bg-green-50', border: 'border-green-200', title: 'text-green-800', est: 'text-green-700'},
        ]
        return (
          <div className="grid grid-cols-3 gap-3">
            {grupos.map(({ key, label, stats, bg, border, title, est }) => (
              <div key={key} className={`rounded-lg border ${border} ${bg} px-4 py-3`}>
                <div className={`text-sm font-semibold ${title} mb-2`}>{label}</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-gray-500">
                    <span>Con pesada</span>
                    <span className="font-medium text-gray-700">{stats.conPesada} / {stats.total}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Total kg</span>
                    <span className="font-bold text-gray-800">{formatKg(stats.totalKg)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Promedio</span>
                    <span className="font-medium text-gray-700">{stats.promedioKg.toFixed(1)} kg</span>
                  </div>
                  {gananciaDiaria > 0 && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <div className={`flex justify-between ${est}`}>
                        <span>Est. hoy total</span>
                        <span className="font-bold">{formatKg(stats.totalEstimadoKg)}</span>
                      </div>
                      <div className={`flex justify-between ${est}`}>
                        <span>Est. hoy prom.</span>
                        <span className="font-medium">{stats.promedioEstimadoKg.toFixed(1)} kg</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Tabla de terneros ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Registro de Terneros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="flex items-center justify-center py-12 text-gray-500 gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              Cargando...
            </div>
          ) : terneros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <Baby className="h-10 w-10" />
              <p className="text-sm">Sin terneros registrados</p>
              <p className="text-xs">Importá el Excel para cargar el lote de destete</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs w-6"></TableHead>
                    <TableHead className="text-xs">Carav. Oficial</TableHead>
                    <TableHead className="text-xs">Carav. Interna</TableHead>
                    <TableHead className="text-xs">Sexo</TableHead>
                    <TableHead className="text-xs">Pelo</TableHead>
                    <TableHead className="text-xs">Torito</TableHead>
                    <TableHead className="text-xs">Últ. Pesada</TableHead>
                    <TableHead className="text-xs">Peso hoy est.</TableHead>
                    <TableHead className="text-xs text-center whitespace-nowrap">Gan. últ. 2</TableHead>
                    <TableHead className="text-xs text-center whitespace-nowrap">Gan. p→p</TableHead>
                    <TableHead className="text-xs">Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ternerosOrdenados.map(t => {
                    const esDup = idsConDuplicado.has(t.id)
                    const ultima = getUltimaPesada(t.pesadas_terneros)
                    const pesoHoy = getPesoEstimadoHoy(t.pesadas_terneros, gananciaDiaria)
                    const ganUlt2 = getGananciaUlt2(t.pesadas_terneros)
                    const ganPaP = getGananciaPuntaAPunta(t.pesadas_terneros)
                    const acelerando = ganUlt2 !== null && ganPaP !== null && ganUlt2 > ganPaP
                    const desacelerando = ganUlt2 !== null && ganPaP !== null && ganUlt2 < ganPaP
                    return (
                      <TableRow key={t.id} className={`text-sm ${esDup ? 'bg-red-50' : ''}`}>
                        <TableCell className="w-6 pr-0">
                          {esDup && <span title="Caravana duplicada">⚠️</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {t.caravana_oficial ?? <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {t.caravana_interna ?? <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell>
                          {t.sexo === 'Macho'
                            ? <span className="text-sky-700 font-medium">♂ M</span>
                            : t.sexo === 'Hembra'
                            ? <span className="text-pink-700 font-medium">♀ H</span>
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {t.pelo ? (PELO_LABEL[t.pelo] ?? t.pelo) : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell>
                          {t.es_torito && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">🐂</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {ultima
                            ? <span className="text-green-700">{formatFecha(ultima.fecha)} — {formatPeso(ultima.peso_kg)}</span>
                            : <span className="text-gray-400">sin pesada</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {pesoHoy !== null
                            ? <span className="text-blue-700 font-medium">{formatPeso(pesoHoy)}</span>
                            : <span className="text-gray-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {ganUlt2 !== null
                            ? <span className={`font-medium ${acelerando ? 'text-green-600' : desacelerando ? 'text-red-600' : 'text-gray-600'}`}>
                                {acelerando ? '▲ ' : desacelerando ? '▼ ' : ''}{ganUlt2.toFixed(2)}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {ganPaP !== null
                            ? <span className="text-gray-500">{ganPaP.toFixed(2)}</span>
                            : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 max-w-[160px] truncate">
                          {t.observaciones ?? ''}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sección caravanas no coincidentes (pesadas sin vincular) ── */}
      {pesadasSinVincular.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Caravanas no coincidentes ({pesadasSinVincular.length} pesadas sin ternero vinculado)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-50">
                    <TableHead className="text-xs">IDV / Caravana</TableHead>
                    <TableHead className="text-xs">Fecha pesada</TableHead>
                    <TableHead className="text-xs">Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesadasSinVincular.map(p => (
                    <TableRow key={p.id} className="text-sm bg-amber-50/40">
                      <TableCell className="font-mono text-xs">
                        {p.caravana_idv ?? <span className="text-gray-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{formatFecha(p.fecha)}</TableCell>
                      <TableCell className="text-xs font-medium">{formatPeso(p.peso_kg)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Modal: Resultado import terneros
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalResultadoT} onOpenChange={setModalResultadoT}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resultado de importación de terneros</DialogTitle>
          </DialogHeader>
          {resultadoT && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{resultadoT.procesados}</div>
                  <div className="text-xs text-gray-500">Procesados</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{resultadoT.insertados}</div>
                  <div className="text-xs text-green-600">Insertados</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{resultadoT.omitidos}</div>
                  <div className="text-xs text-amber-600">Sin caravana</div>
                </div>
              </div>

              {resultadoT.duplicados_en_archivo.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      {resultadoT.duplicados_en_archivo.length} duplicados en el archivo — insertados igual
                    </span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded p-2 max-h-28 overflow-y-auto space-y-1">
                    {resultadoT.duplicados_en_archivo.map((e, i) => <p key={i} className="text-xs text-amber-800">{e}</p>)}
                  </div>
                </div>
              )}

              {resultadoT.duplicados_en_bd.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium text-orange-700">
                      {resultadoT.duplicados_en_bd.length} ya existían en BD — insertados igual
                    </span>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded p-2 max-h-28 overflow-y-auto space-y-1">
                    {resultadoT.duplicados_en_bd.map((e, i) => <p key={i} className="text-xs text-orange-800">{e}</p>)}
                  </div>
                </div>
              )}

              {resultadoT.errores.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">{resultadoT.errores.length} errores técnicos</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded p-2 max-h-28 overflow-y-auto space-y-1">
                    {resultadoT.errores.map((e, i) => <p key={i} className="text-xs text-red-700">{e}</p>)}
                  </div>
                </div>
              )}

              {resultadoT.errores.length === 0 && resultadoT.duplicados_en_archivo.length === 0 && resultadoT.duplicados_en_bd.length === 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded p-3">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Importación completada sin observaciones</span>
                </div>
              )}

              <Button className="w-full" onClick={() => setModalResultadoT(false)}>Cerrar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Modal: Import pesadas (3 pasos)
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalPesadas} onOpenChange={v => { if (!importandoPesadas) setModalPesadas(v) }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Importar pesadas — Paso {pasoPesadas} de {hayConflictos ? 3 : 2}
            </DialogTitle>
          </DialogHeader>

          {analisis && (
            <div className="space-y-4">

              {/* ── PASO 1: Resumen análisis ── */}
              {pasoPesadas === 1 && (
                <>
                  {/* Fecha detectada */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800">
                      Fecha de pesada detectada: <span className="font-bold">{formatFecha(analisis.fecha)}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Todos los registros de este archivo se importarán con esta fecha como encabezado de columna.
                    </p>
                  </div>

                  {/* Contadores */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-green-700">{analisis.ok.length}</div>
                      <div className="text-xs text-green-600">Coinciden ✅</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-amber-700">{analisis.no_encontradas.length}</div>
                      <div className="text-xs text-amber-600">No encontradas</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-orange-700">{analisis.duplicadas.length}</div>
                      <div className="text-xs text-orange-600">Duplicadas en BD</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-500">{analisis.sin_idv}</div>
                      <div className="text-xs text-gray-400">Sin IDV (ignorar)</div>
                    </div>
                  </div>

                  {analisis.ok.length > 0 && analisis.no_encontradas.length === 0 && analisis.duplicadas.length === 0 && (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-3 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm">Todas las caravanas coinciden. Podés importar directamente.</span>
                    </div>
                  )}

                  {(analisis.no_encontradas.length > 0 || analisis.duplicadas.length > 0) && (
                    <div className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-3">
                      Hay conflictos que resolver. En el próximo paso elegís qué hacer con cada uno.
                    </div>
                  )}

                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={() => setModalPesadas(false)}>Cancelar</Button>
                    <Button
                      onClick={() => setPasoPesadas(hayConflictos ? 2 : 3)}
                      className="bg-green-700 hover:bg-green-800 flex items-center gap-1"
                    >
                      {hayConflictos ? 'Resolver conflictos' : 'Continuar'}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              {/* ── PASO 2: Resolver conflictos ── */}
              {pasoPesadas === 2 && hayConflictos && (
                <>
                  {/* Sección: no encontradas */}
                  {analisis.no_encontradas.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-medium text-amber-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {analisis.no_encontradas.length} caravana{analisis.no_encontradas.length > 1 ? 's' : ''} no encontrada{analisis.no_encontradas.length > 1 ? 's' : ''} en el sistema
                      </h3>

                      <p className="text-sm text-gray-600">¿Qué hacer con estas caravanas?</p>

                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoNoEnc"
                            checked={tipoNoEncontradas === 'sin_vincular'}
                            onChange={() => setTipoNoEncontradas('sin_vincular')}
                          />
                          <span className="text-sm">Misma cantidad de terneros — almacenar sin vincular</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tipoNoEnc"
                            checked={tipoNoEncontradas === 'crear_nuevo'}
                            onChange={() => setTipoNoEncontradas('crear_nuevo')}
                          />
                          <span className="text-sm">Hay terneros nuevos — seleccionar cuáles crear</span>
                        </label>
                      </div>

                      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                        {analisis.no_encontradas.map(r => (
                          <div key={r.idv} className="flex items-center justify-between px-3 py-2 text-sm">
                            <div className="flex items-center gap-3">
                              {tipoNoEncontradas === 'crear_nuevo' && (
                                <input
                                  type="checkbox"
                                  checked={creacionesSeleccionadas.has(r.idv)}
                                  onChange={e => {
                                    const s = new Set(creacionesSeleccionadas)
                                    if (e.target.checked) s.add(r.idv)
                                    else s.delete(r.idv)
                                    setCreacionesSeleccionadas(s)
                                  }}
                                />
                              )}
                              <span className="font-mono text-xs">{r.caravana_oficial}</span>
                            </div>
                            <span className="text-green-700 font-medium">{formatPeso(r.peso)}</span>
                          </div>
                        ))}
                      </div>

                      {tipoNoEncontradas === 'sin_vincular' && (
                        <p className="text-xs text-gray-500">
                          Estas pesadas quedarán en la sección "Caravanas no coincidentes" debajo de la tabla principal.
                        </p>
                      )}
                      {tipoNoEncontradas === 'crear_nuevo' && (
                        <p className="text-xs text-gray-500">
                          Los tildados crearán un ternero nuevo (solo caravana oficial). Los destildados se almacenarán sin vincular.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Sección: duplicadas */}
                  {analisis.duplicadas.length > 0 && (
                    <div className="space-y-3 mt-4 pt-4 border-t">
                      <h3 className="font-medium text-orange-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {analisis.duplicadas.length} caravana{analisis.duplicadas.length > 1 ? 's' : ''} que coincide{analisis.duplicadas.length > 1 ? 'n' : ''} con más de un ternero
                      </h3>
                      <div className="space-y-3">
                        {analisis.duplicadas.map(d => (
                          <div key={d.idv} className="border border-orange-200 rounded-lg p-3 bg-orange-50 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-xs font-medium">{d.caravana_oficial}</span>
                              <span className="text-green-700 font-medium text-sm">{formatPeso(d.peso)}</span>
                            </div>
                            <p className="text-xs text-gray-600">¿A cuál ternero asignar la pesada?</p>
                            <div className="space-y-1">
                              {d.terneros.map(ter => (
                                <label key={ter.id} className="flex items-center gap-2 cursor-pointer text-xs">
                                  <input
                                    type="radio"
                                    name={`dup-${d.idv}`}
                                    value={ter.id}
                                    checked={decisionesDuplicadas[d.idv] === ter.id}
                                    onChange={() => setDecisionesDuplicadas(prev => ({ ...prev, [d.idv]: ter.id }))}
                                  />
                                  <span>
                                    Carav. int: <strong>{ter.caravana_interna ?? '—'}</strong>
                                    {ter.sexo && ` · ${ter.sexo === 'Macho' ? '♂' : '♀'}`}
                                    {ter.pelo && ` · ${ter.pelo}`}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={() => setPasoPesadas(1)} className="flex items-center gap-1">
                      <ChevronLeft className="h-4 w-4" /> Atrás
                    </Button>
                    <Button
                      onClick={() => setPasoPesadas(3)}
                      disabled={duplicadasSinResolver.length > 0}
                      className="bg-green-700 hover:bg-green-800 flex items-center gap-1"
                    >
                      Confirmar →
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {duplicadasSinResolver.length > 0 && (
                    <p className="text-xs text-red-600 text-center">
                      Faltan resolver {duplicadasSinResolver.length} caravana{duplicadasSinResolver.length > 1 ? 's' : ''} duplicada{duplicadasSinResolver.length > 1 ? 's' : ''}
                    </p>
                  )}
                </>
              )}

              {/* ── PASO 3: Resumen final + confirmar ── */}
              {pasoPesadas === 3 && (
                <>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                    <h3 className="font-medium text-gray-800 mb-3">Resumen de lo que se va a importar:</h3>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Pesadas directas (coincidencia exacta):</span>
                      <span className="font-medium text-green-700">{analisis.ok.length}</span>
                    </div>

                    {analisis.no_encontradas.length > 0 && tipoNoEncontradas === 'sin_vincular' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Almacenadas sin vincular:</span>
                        <span className="font-medium text-amber-700">{analisis.no_encontradas.length}</span>
                      </div>
                    )}

                    {analisis.no_encontradas.length > 0 && tipoNoEncontradas === 'crear_nuevo' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Terneros nuevos a crear:</span>
                          <span className="font-medium text-blue-700">{creacionesSeleccionadas.size}</span>
                        </div>
                        {analisis.no_encontradas.length - creacionesSeleccionadas.size > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sin vincular (destildados):</span>
                            <span className="font-medium text-amber-700">
                              {analisis.no_encontradas.length - creacionesSeleccionadas.size}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {analisis.duplicadas.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duplicadas resueltas:</span>
                        <span className="font-medium text-orange-700">
                          {Object.values(decisionesDuplicadas).filter(Boolean).length}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="font-medium text-gray-700">Total a insertar:</span>
                      <span className="font-bold text-gray-900">
                        {analisis.ok.length + analisis.no_encontradas.length + Object.values(decisionesDuplicadas).filter(Boolean).length}
                      </span>
                    </div>

                    {analisis.sin_idv > 0 && (
                      <p className="text-xs text-gray-400 mt-2">
                        {analisis.sin_idv} fila{analisis.sin_idv > 1 ? 's' : ''} sin IDV ignorada{analisis.sin_idv > 1 ? 's' : ''} (error del dispositivo lector).
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between gap-2">
                    <Button variant="outline" onClick={() => setPasoPesadas(hayConflictos ? 2 : 1)} className="flex items-center gap-1">
                      <ChevronLeft className="h-4 w-4" /> Atrás
                    </Button>
                    <Button
                      onClick={confirmarPesadas}
                      disabled={importandoPesadas}
                      className="bg-green-700 hover:bg-green-800 flex items-center gap-1"
                    >
                      {importandoPesadas
                        ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" /> Importando...</>
                        : <><CheckCircle2 className="h-4 w-4" /> Importar pesadas</>
                      }
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════
          Modal: Historial pesadas (pivot table)
      ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalHistorial} onOpenChange={setModalHistorial}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de pesadas — {todasFechas.length} fecha{todasFechas.length !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>

          {todasFechas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin pesadas registradas</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs whitespace-nowrap">Carav. Oficial</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Carav. Int.</TableHead>
                    <TableHead className="text-xs">Sexo</TableHead>
                    {todasFechas.map(f => (
                      <TableHead key={f} className="text-xs text-center whitespace-nowrap text-green-700">
                        {formatFecha(f)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {terneros
                    .filter(t => t.pesadas_terneros.length > 0)
                    .map(t => (
                      <TableRow key={t.id} className="text-sm">
                        <TableCell className="font-mono text-xs">{t.caravana_oficial ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{t.caravana_interna ?? '—'}</TableCell>
                        <TableCell className="text-xs">
                          {t.sexo === 'Macho' ? '♂' : t.sexo === 'Hembra' ? '♀' : '—'}
                        </TableCell>
                        {todasFechas.map(f => {
                          const pesada = t.pesadas_terneros.find(p => p.fecha === f)
                          return (
                            <TableCell key={f} className="text-center text-xs">
                              {pesada
                                ? <span className="font-medium text-green-700">{pesada.peso_kg.toFixed(1)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  }

                  {/* ── Filas de totales por grupo ── */}
                  {todasFechas.length > 0 && (() => {
                    const grupos = [
                      { label: '♂ Total',    lista: machos,   cls: 'text-sky-700',   bold: true },
                      { label: '♂ Promedio', lista: machos,   cls: 'text-sky-600',   bold: false },
                      { label: '♀ Total',    lista: hembras,  cls: 'text-pink-700',  bold: true },
                      { label: '♀ Promedio', lista: hembras,  cls: 'text-pink-600',  bold: false },
                      { label: '🐄 Total',   lista: terneros, cls: 'text-green-700', bold: true },
                      { label: '🐄 Prom.',   lista: terneros, cls: 'text-green-600', bold: false },
                    ]
                    return (
                      <>
                        {/* Separador */}
                        <TableRow>
                          <TableCell colSpan={3 + todasFechas.length} className="p-0 h-0">
                            <div className="border-t-2 border-gray-300" />
                          </TableCell>
                        </TableRow>
                        {grupos.map(({ label, lista, cls, bold }) => (
                          <TableRow key={label} className="bg-gray-50">
                            <TableCell colSpan={3} className={`text-xs font-semibold py-1 ${cls}`}>
                              {label}
                            </TableCell>
                            {todasFechas.map(f => {
                              const conFecha = lista.filter(t => t.pesadas_terneros.some(p => p.fecha === f))
                              if (conFecha.length === 0) {
                                return <TableCell key={f} className="text-center text-xs text-gray-300 py-1">—</TableCell>
                              }
                              const suma = conFecha.reduce((s, t) => {
                                const p = t.pesadas_terneros.find(pp => pp.fecha === f)
                                return s + (p?.peso_kg ?? 0)
                              }, 0)
                              // Promedio: sobre animales con pesada en esa fecha
                              const prom = suma / conFecha.length
                              // Total: extrapolado al grupo completo (sin pesada asumen promedio)
                              const valor = bold ? prom * lista.length : prom
                              return (
                                <TableCell key={f} className={`text-center text-xs py-1 ${bold ? 'font-bold' : 'font-medium'} ${cls}`}>
                                  {bold
                                    ? valor.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                                    : valor.toFixed(1)}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </>
                    )
                  })()}
                </TableBody>
              </Table>
              <p className="text-xs text-gray-400 text-right mt-2 pr-2">
                Pesos en kg · {terneros.filter(t => t.pesadas_terneros.length > 0).length} terneros con pesadas
              </p>

              {/* ── Tabla ganancias: Δkg/día entre fechas consecutivas ── */}
              {pares.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-semibold text-gray-600 mb-2 pl-1">Ganancia diaria entre pesadas (kg/día)</p>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-xs whitespace-nowrap">Carav. Oficial</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Carav. Int.</TableHead>
                        <TableHead className="text-xs">Sexo</TableHead>
                        {pares.map((par, i) => (
                          <TableHead key={i} className="text-xs text-center whitespace-nowrap text-blue-700">
                            {formatFecha(par.fechaAnterior)}→{formatFecha(par.fechaActual)}
                            <span className="block text-gray-400 font-normal">{par.dias}d</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {terneros
                        .filter(t => t.pesadas_terneros.length >= 2)
                        .map(t => {
                          // Calcular ganancia por cada par de fechas
                          const ganancias: (number | null)[] = pares.map(par => {
                            const p1 = t.pesadas_terneros.find(p => p.fecha === par.fechaAnterior)
                            const p2 = t.pesadas_terneros.find(p => p.fecha === par.fechaActual)
                            if (!p1 || !p2 || par.dias <= 0) return null
                            return (p2.peso_kg - p1.peso_kg) / par.dias
                          })
                          return (
                            <TableRow key={t.id} className="text-sm">
                              <TableCell className="font-mono text-xs">{t.caravana_oficial ?? '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{t.caravana_interna ?? '—'}</TableCell>
                              <TableCell className="text-xs">
                                {t.sexo === 'Macho' ? '♂' : t.sexo === 'Hembra' ? '♀' : '—'}
                              </TableCell>
                              {ganancias.map((g, i) => {
                                const prev = i > 0 ? ganancias[i - 1] : null
                                const mejora = g !== null && prev !== null && g > prev
                                const baja = g !== null && prev !== null && g < prev
                                return (
                                  <TableCell key={i} className="text-center text-xs">
                                    {g !== null
                                      ? <span className={`font-medium ${mejora ? 'text-green-600' : baja ? 'text-red-600' : 'text-gray-600'}`}>
                                          {mejora ? '▲ ' : baja ? '▼ ' : ''}{g.toFixed(2)}
                                        </span>
                                      : <span className="text-gray-300">—</span>}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          )
                        })
                      }

                      {/* Filas de promedio por grupo */}
                      {(() => {
                        const gruposGan = [
                          { label: '♂ Prom.', lista: machos,   cls: 'text-sky-600'   },
                          { label: '♀ Prom.', lista: hembras,  cls: 'text-pink-600'  },
                          { label: '🐄 Prom.', lista: terneros, cls: 'text-green-600' },
                        ]
                        return (
                          <>
                            <TableRow>
                              <TableCell colSpan={3 + pares.length} className="p-0 h-0">
                                <div className="border-t-2 border-gray-300" />
                              </TableCell>
                            </TableRow>
                            {gruposGan.map(({ label, lista, cls }) => (
                              <TableRow key={label} className="bg-gray-50">
                                <TableCell colSpan={3} className={`text-xs font-semibold py-1 ${cls}`}>{label}</TableCell>
                                {pares.map((par, i) => {
                                  const vals = lista
                                    .filter(t => t.pesadas_terneros.length >= 2)
                                    .map(t => {
                                      const p1 = t.pesadas_terneros.find(p => p.fecha === par.fechaAnterior)
                                      const p2 = t.pesadas_terneros.find(p => p.fecha === par.fechaActual)
                                      if (!p1 || !p2 || par.dias <= 0) return null
                                      return (p2.peso_kg - p1.peso_kg) / par.dias
                                    })
                                    .filter((v): v is number => v !== null)
                                  if (vals.length === 0) {
                                    return <TableCell key={i} className="text-center text-xs text-gray-300 py-1">—</TableCell>
                                  }
                                  const prom = vals.reduce((s, v) => s + v, 0) / vals.length
                                  return (
                                    <TableCell key={i} className={`text-center text-xs font-medium py-1 ${cls}`}>
                                      {prom.toFixed(2)}
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                          </>
                        )
                      })()}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-gray-400 text-right mt-1 pr-2">
                    ▲ mejora vs período anterior · ▼ baja vs período anterior
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
