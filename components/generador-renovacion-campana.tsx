"use client"

// Generador de Renovación de Campaña (templates).
// GENERAL: sirve para bianual (campaña jul-jun) y anual (calendario). Modelo A: crea filas NUEVAS
// de egreso para el período target (año nuevo) + sus cuotas, clonando la config del origen.
// Columnas DINÁMICAS: mínimo 12 (base del target) + cualquier mes extra donde haya cuota (spillover
// por período contable pagado el mes siguiente). Pre-carga por template corriendo su último período al
// target (yearShift = targetYear1 - sourceYear1), editable. NO en backup: usa periodicidad/aplica_generacion.
// v1 para testear en bianual; pensado para extenderse (ver PENDIENTES B-FEAT-RENOVAR-CAMPAÑA).

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, ChevronDown, ChevronRight, Save, Eraser, Copy, AlertTriangle, List, Plus, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

type Periodicidad = 'bianual' | 'anual'
// monto = valor de la celda; dia = día del mes de la cuota origen; componentes = montos de las varias
// cuotas del origen si en ese mes había más de una (se muestra la SUMA + aviso, se genera 1 cuota).
interface Celda { monto: number | ''; dia?: number; componentes?: number[] }
interface ItemCuota { col: string; dia: number; monto: number }   // col = "YYYY-MM"
interface Fila {
  template: any
  incluir: boolean
  celdas: Record<string, Celda>   // colKey "YYYY-MM" -> monto (editor principal, 1 por mes)
  raw: ItemCuota[]                // cuotas individuales del origen (corridas al target) — para el detalle
  detalle?: ItemCuota[]           // override manual (fase 2): si existe, GANA sobre celdas (permite varias/mes)
  esVencimiento: boolean          // las fechas de esta fila son de vencimiento (sino, estimadas)
}

// año1 del período: "26/27" -> 2026 ; "2027" -> 2027
function year1De(anio: string | null): number | null {
  if (!anio) return null
  if (anio.includes('/')) { const p = anio.split('/')[0].trim(); const n = parseInt(p, 10); return isNaN(n) ? null : 2000 + n }
  const n = parseInt(anio.trim(), 10); return isNaN(n) ? null : n
}
const colKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

// meses base del target
function mesesBase(periodicidad: Periodicidad, targetY1: number): { y: number; m: number }[] {
  if (periodicidad === 'anual') return Array.from({ length: 12 }, (_, i) => ({ y: targetY1, m: i + 1 }))
  // bianual: jul(Y1)..jun(Y1+1)
  const out: { y: number; m: number }[] = []
  for (let m = 7; m <= 12; m++) out.push({ y: targetY1, m })
  for (let m = 1; m <= 6; m++) out.push({ y: targetY1 + 1, m })
  return out
}

export function GeneradorRenovacionCampana({ onClose }: { onClose: () => void }) {
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('bianual')
  const [targetLabel, setTargetLabel] = useState('')          // "26/27" o "2027"
  const [cargando, setCargando] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [openPrevistas, setOpenPrevistas] = useState(true)
  const [openNoAplican, setOpenNoAplican] = useState(false)
  const [generando, setGenerando] = useState(false)
  // Detalle por fila (fase 2 punto 4): editar las cuotas individuales (permite varias por mes)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [detalleItems, setDetalleItems] = useState<ItemCuota[]>([])

  // Default del target según hoy
  useEffect(() => {
    const hoy = new Date()
    const yy = hoy.getFullYear() % 100
    if (periodicidad === 'bianual') {
      setTargetLabel((hoy.getMonth() + 1) >= 7 ? `${yy}/${yy + 1}` : `${yy - 1}/${yy}`)
    } else {
      setTargetLabel(String(hoy.getFullYear()))
    }
  }, [periodicidad])

  const targetY1 = year1De(targetLabel)

  const cargar = async () => {
    if (!targetY1) { toast.error('Target inválido'); return }
    setCargando(true)
    const { data: temps } = await supabase
      .from('egresos_sin_factura')
      .select('*')
      .eq('periodicidad', periodicidad)
      .eq('activo', true)
      .order('nombre_referencia')
    const ids = (temps ?? []).map((t: any) => t.id)
    const { data: cuotas } = ids.length
      ? await supabase.from('cuotas_egresos_sin_factura').select('*').in('egreso_id', ids)
      : { data: [] as any[] }

    const porTemplate: Record<string, any[]> = {}
    for (const c of (cuotas ?? [])) (porTemplate[c.egreso_id] ??= []).push(c)

    const nuevasFilas: Fila[] = (temps ?? []).map((t: any) => {
      const srcY1 = year1De(t.año)
      const shift = srcY1 != null ? (targetY1 - srcY1) : 0    // corre el último período conocido al target
      const celdas: Record<string, Celda> = {}
      const raw: ItemCuota[] = []
      for (const c of (porTemplate[t.id] ?? [])) {
        if (!c.fecha_estimada) continue
        const [y, m, d] = c.fecha_estimada.slice(0, 10).split('-')
        const ty = parseInt(y, 10) + shift
        const k = colKey(ty, parseInt(m, 10))
        const monto = c.monto ?? 0
        const dia = parseInt(d, 10) || 1
        raw.push({ col: k, dia, monto })
        const prev = celdas[k]
        if (prev && prev.monto !== '') {
          // Varias cuotas en el mismo mes → suma + registra la composición (se genera 1 sola cuota)
          const comp = prev.componentes ?? [Number(prev.monto)]
          comp.push(monto)
          celdas[k] = { monto: Number(prev.monto) + monto, dia: prev.dia, componentes: comp }
        } else {
          // Preserva el día real de la cuota origen (shift solo el año)
          celdas[k] = { monto, dia }
        }
      }
      return { template: t, incluir: t.aplica_generacion === true, celdas, raw, esVencimiento: t.tipo_fecha === 'Vencimiento' }
    })
    setFilas(nuevasFilas)
    setCargando(false)
  }

  useEffect(() => { if (targetY1) cargar() /* eslint-disable-next-line */ }, [periodicidad])

  // Columnas = base 12 del target ∪ meses con cuota en filas incluidas
  const columnas = useMemo(() => {
    const set = new Set<string>()
    if (targetY1) for (const { y, m } of mesesBase(periodicidad, targetY1)) set.add(colKey(y, m))
    for (const f of filas) if (f.incluir) for (const k of Object.keys(f.celdas)) set.add(k)
    return Array.from(set).sort()
  }, [filas, periodicidad, targetY1])

  const previstas = filas.filter(f => f.template.aplica_generacion === true)
  const noAplican = filas.filter(f => f.template.aplica_generacion !== true)

  // Inicio del período (para ADVERTIR — no bloquear — cuotas que caen antes; ej. datos viejos tipo UATRE)
  const inicioKey = useMemo(() => {
    if (!targetY1) return ''
    const base = mesesBase(periodicidad, targetY1)
    return colKey(base[0].y, base[0].m)
  }, [periodicidad, targetY1])
  const hayCuotasAntes = useMemo(() =>
    filas.some(f => f.incluir && Object.entries(f.celdas).some(([col, c]) => col < inicioKey && c.monto !== '' && c.monto != null))
  , [filas, inicioKey])

  const setMonto = (templateId: string, col: string, valor: string) => {
    const monto = valor.trim() === '' ? '' : (parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0)
    setFilas(prev => prev.map(f => f.template.id === templateId
      ? { ...f, celdas: { ...f.celdas, [col]: { monto, dia: f.celdas[col]?.dia } } }
      : f))
  }

  // Editar el día del mes de una celda (punto 3)
  const setDia = (templateId: string, col: string, valor: string) => {
    const n = parseInt(valor, 10)
    const dia = isNaN(n) ? undefined : Math.min(31, Math.max(1, n))
    setFilas(prev => prev.map(f => f.template.id === templateId
      ? { ...f, celdas: { ...f.celdas, [col]: { monto: f.celdas[col]?.monto ?? '', dia, componentes: f.celdas[col]?.componentes } } }
      : f))
  }

  // Deseleccionar/incluir un template previsto para ESTA corrida (no toca aplica_generacion) (punto 1)
  const toggleIncluir = (templateId: string, checked: boolean) => {
    setFilas(prev => prev.map(f => f.template.id === templateId ? { ...f, incluir: checked } : f))
  }

  // Fechas de la fila = estimadas o de vencimiento
  const toggleVencimiento = (templateId: string, checked: boolean) => {
    setFilas(prev => prev.map(f => f.template.id === templateId ? { ...f, esVencimiento: checked } : f))
  }

  // ── Detalle por fila (fase 2 punto 4) ──────────────────────────────────────
  const ordItems = (arr: ItemCuota[]) => [...arr].sort((a, b) => a.col === b.col ? a.dia - b.dia : a.col.localeCompare(b.col))
  const abrirDetalle = (f: Fila) => {
    setDetalleId(f.template.id)
    // Punto de partida: el detalle ya editado, o las cuotas individuales del origen (raw). Ordenado por fecha.
    setDetalleItems(ordItems((f.detalle ?? f.raw).map(i => ({ ...i }))))
  }
  const setDetalleCampo = (idx: number, campo: keyof ItemCuota, valor: string) => {
    setDetalleItems(prev => ordItems(prev.map((it, i) => {
      if (i !== idx) return it
      if (campo === 'col') return { ...it, col: valor }
      if (campo === 'dia') return { ...it, dia: Math.min(31, Math.max(1, parseInt(valor, 10) || 1)) }
      return { ...it, monto: parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0 }
    })))
  }
  const addDetalleItem = () => {
    const primerMes = targetY1 ? colKey(mesesBase(periodicidad, targetY1)[0].y, mesesBase(periodicidad, targetY1)[0].m) : ''
    setDetalleItems(prev => ordItems([...prev, { col: primerMes, dia: 1, monto: 0 }]))
  }
  const removeDetalleItem = (idx: number) => setDetalleItems(prev => prev.filter((_, i) => i !== idx))
  const guardarDetalle = () => {
    setFilas(prev => prev.map(f => f.template.id === detalleId ? { ...f, detalle: detalleItems.map(i => ({ ...i })) } : f))
    setDetalleId(null)
  }
  const quitarDetalle = () => {
    setFilas(prev => prev.map(f => f.template.id === detalleId ? { ...f, detalle: undefined } : f))
    setDetalleId(null)
  }

  // Vaciar toda la fila (deja en cero/sin cuota; útil cuando el pre-cargado tiene datos viejos, ej. UATRE)
  const vaciarFila = (templateId: string) => {
    setFilas(prev => prev.map(f => f.template.id === templateId ? { ...f, celdas: {} } : f))
  }

  // Replicar el primer monto cargado a los 12 meses base del target (preserva el día si la celda ya lo tenía)
  const replicarFila = (templateId: string) => {
    if (!targetY1) return
    setFilas(prev => prev.map(f => {
      if (f.template.id !== templateId) return f
      const primera = Object.values(f.celdas).find(c => c.monto !== '' && c.monto != null)
      if (!primera) return f
      const nuevas = { ...f.celdas }
      for (const { y, m } of mesesBase(periodicidad, targetY1)) {
        const k = colKey(y, m)
        nuevas[k] = { monto: primera.monto, dia: nuevas[k]?.dia }
      }
      return { ...f, celdas: nuevas }
    }))
  }

  // Opt-in desde "No aplican": incluye la fila + persiste aplica_generacion=true
  const optIn = async (templateId: string, checked: boolean) => {
    setFilas(prev => prev.map(f => f.template.id === templateId
      ? { ...f, incluir: checked, template: { ...f.template, aplica_generacion: checked ? true : f.template.aplica_generacion } }
      : f))
    if (checked) await supabase.from('egresos_sin_factura').update({ aplica_generacion: true }).eq('id', templateId)
  }

  const fmtCol = (col: string) => { const [y, m] = col.split('-'); return `${MESES_LARGO[parseInt(m, 10) - 1].slice(0, 3)} ${y.slice(2)}` }

  const generar = async () => {
    const aGenerar = filas.filter(f => f.incluir)
    if (aGenerar.length === 0) { toast.error('No hay templates seleccionados'); return }
    // Punto 2: advertir al confirmar si se dejan afuera templates PREVISTOS (aplica=true) deseleccionados
    const desel = previstas.filter(f => !f.incluir)
    if (desel.length > 0) {
      const ok = window.confirm(
        `Atención: vas a dejar SIN generar ${desel.length} template(s) previsto(s):\n\n${desel.map(f => '• ' + f.template.nombre_referencia).join('\n')}\n\n¿Continuar igual?`
      )
      if (!ok) return
    }
    setGenerando(true)
    let okTemplates = 0, okCuotas = 0
    try {
      for (const f of aGenerar) {
        const t = f.template
        // 1. Clonar la fila del template con el año target (Modelo A)
        const { id, created_at, updated_at, ...resto } = t
        const { data: nuevo, error: eT } = await supabase
          .from('egresos_sin_factura')
          .insert({ ...resto, año: targetLabel, activo: true })
          .select().single()
        if (eT || !nuevo) { console.error('Error clonando template', t.nombre_referencia, eT); continue }
        okTemplates++

        // 2. Cuotas: si hay DETALLE manual (varias/mes) se usa; sino, las celdas de la matriz (1/mes)
        const items: ItemCuota[] = f.detalle
          ? f.detalle
          : columnas
              .filter(col => f.celdas[col] && f.celdas[col].monto !== '')
              .map(col => ({ col, dia: f.celdas[col]!.dia ?? 1, monto: Number(f.celdas[col]!.monto) }))
        const itemsOrd = [...items].filter(it => it.col).sort((a, b) => a.col === b.col ? a.dia - b.dia : a.col.localeCompare(b.col))

        const cuotasInsert: any[] = []
        let nro = 0
        for (const it of itemsOrd) {
          nro++
          const [y, m] = it.col.split('-')
          const anioNum = parseInt(y, 10), mesNum = parseInt(m, 10)
          const dia = String(it.dia ?? 1).padStart(2, '0')
          const fecha = `${y}-${m}-${dia}`
          cuotasInsert.push({
            egreso_id: nuevo.id,
            numero_cuota: nro,
            mes: mesNum,
            fecha_estimada: fecha,
            fecha_vencimiento: f.esVencimiento ? fecha : null,   // fechas de la fila = vencimiento (checkbox)
            monto: it.monto,
            estado: 'pendiente',
            // Fórmula de descripción reproducida con el período nuevo (etiqueta del extracto al conciliar)
            descripcion: `${t.nombre_referencia} ${t.responsable ?? ''} - ${MESES_LARGO[mesNum - 1]} ${anioNum}`.replace(/\s+/g, ' ').trim(),
            cuenta_contable: t.codigo_contable ?? null,
            centro_costo: t.centro_costo ?? null,
            categ: t.categ ?? null,
          })
        }
        if (cuotasInsert.length) {
          const { error: eC } = await supabase.from('cuotas_egresos_sin_factura').insert(cuotasInsert)
          if (eC) console.error('Error cuotas', t.nombre_referencia, eC)
          else okCuotas += cuotasInsert.length
        }
      }
      toast.success(`Renovación ${targetLabel}: ${okTemplates} templates, ${okCuotas} cuotas generadas`)
      onClose()
    } catch (e: any) {
      toast.error('Error al generar: ' + (e?.message ?? 'desconocido'))
    } finally {
      setGenerando(false)
    }
  }

  const renderMatriz = (lista: Fila[], conIncluir = false) => (
    <div className="overflow-x-auto border rounded">
      <table className="text-sm min-w-max">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-20 bg-gray-50 text-left px-3 py-2 border-r min-w-[240px]">Template</th>
            {columnas.map(col => (
              <th key={col} className={`px-2 py-2 text-center whitespace-nowrap border-r ${col < inicioKey ? 'bg-amber-100 text-amber-700' : ''}`}
                  title={col < inicioKey ? 'Mes anterior al inicio del período — revisar' : undefined}>
                {fmtCol(col)}{col < inicioKey ? ' ⚠' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.map(f => (
            <tr key={f.template.id} className={`border-t ${conIncluir && !f.incluir ? 'opacity-40' : ''}`}>
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r font-medium whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {conIncluir && (
                    <Checkbox checked={f.incluir} onCheckedChange={(ch) => toggleIncluir(f.template.id, ch === true)} title="Incluir en esta generación" />
                  )}
                  <button onClick={() => replicarFila(f.template.id)} title="Replicar el primer monto a los 12 meses" className="text-gray-400 hover:text-blue-600"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => vaciarFila(f.template.id)} title="Vaciar toda la fila" className="text-gray-400 hover:text-red-600"><Eraser className="h-3.5 w-3.5" /></button>
                  <button onClick={() => abrirDetalle(f)} title="Detalle de cuotas (permite varias por mes)" className="text-gray-400 hover:text-purple-600"><List className="h-3.5 w-3.5" /></button>
                  <span>{f.template.nombre_referencia}</span>
                  {f.detalle && <span className="text-[9px] bg-purple-500 text-white rounded px-1" title="Se genera desde el detalle manual (la matriz se ignora para esta fila)">detalle</span>}
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer" title="Las fechas de esta fila son de vencimiento (sino, estimadas)">
                    <Checkbox checked={f.esVencimiento} onCheckedChange={(ch) => toggleVencimiento(f.template.id, ch === true)} className="h-3 w-3" /> venc
                  </label>
                  <span className="text-xs text-gray-400">{f.template.responsable}</span>
                </div>
              </td>
              {columnas.map(col => {
                const celda = f.celdas[col]
                const tiene = celda && celda.monto !== '' && celda.monto != null
                const multi = celda?.componentes && celda.componentes.length > 1
                return (
                  <td key={col} className={`px-1 py-1 border-r ${col < inicioKey ? 'bg-amber-50' : ''}`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="relative">
                        <Input
                          type="text"
                          value={tiene ? Number(celda!.monto).toLocaleString('es-AR') : ''}
                          onChange={e => setMonto(f.template.id, col, e.target.value)}
                          className={`h-6 w-24 text-right text-xs px-1 ${multi ? 'ring-1 ring-orange-400 bg-orange-50' : ''}`}
                          placeholder="—"
                          title={multi ? `⚠ Suma de ${celda!.componentes!.length} cuotas del origen: ${celda!.componentes!.map(x => x.toLocaleString('es-AR')).join(' + ')}. Se generará 1 sola cuota con la suma (editable).` : undefined}
                        />
                        {multi && <span className="absolute -top-1 -right-1 text-[9px] bg-orange-500 text-white rounded-full px-1 leading-tight">Σ{celda!.componentes!.length}</span>}
                      </div>
                      {tiene && (
                        <Input
                          type="text"
                          value={celda!.dia ?? ''}
                          onChange={e => setDia(f.template.id, col, e.target.value)}
                          className="h-5 w-24 text-right text-[10px] px-1 text-gray-500"
                          placeholder="día"
                          title="Día del mes de la cuota"
                        />
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-[95vw] max-h-[92vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Renovar campaña de templates</h2>
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </div>

          {/* Selección de período */}
          <div className="flex items-end gap-6 flex-wrap p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-sm font-medium">Periodicidad</Label>
              <RadioGroup value={periodicidad} onValueChange={(v: Periodicidad) => setPeriodicidad(v)} className="mt-2 flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="bianual" id="g_bianual" /><Label htmlFor="g_bianual" className="font-normal">Bianual (jul–jun)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="anual" id="g_anual" /><Label htmlFor="g_anual" className="font-normal">Anual (calendario)</Label></div>
              </RadioGroup>
            </div>
            <div>
              <Label className="text-sm font-medium">Período a generar</Label>
              <Input value={targetLabel} onChange={e => setTargetLabel(e.target.value)} className="w-28 mt-2" placeholder={periodicidad === 'bianual' ? '26/27' : '2027'} />
            </div>
            <Button variant="outline" onClick={cargar} disabled={cargando}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Recargar
            </Button>
          </div>

          {cargando ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {hayCuotasAntes && (
                <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Hay cuotas que caen <strong>antes del inicio del período</strong> (columnas ⚠ en ámbar). Suele ser <strong>dato viejo mal cargado</strong> (ej. UATRE). Revisá o vaciá esas celdas si no corresponden. No se bloquean — podés generarlas igual si son válidas.</span>
                </div>
              )}

              {/* Previstas a generar */}
              <div>
                <button className="flex items-center gap-2 font-semibold text-green-700 mb-2" onClick={() => setOpenPrevistas(o => !o)}>
                  {openPrevistas ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Previstas a generar ({previstas.length})
                </button>
                {openPrevistas && (previstas.length ? renderMatriz(previstas, true) : <p className="text-sm text-gray-400 px-2">Ninguna.</p>)}
              </div>

              {/* No aplican (opt-in) */}
              <div>
                <button className="flex items-center gap-2 font-semibold text-gray-500 mb-2" onClick={() => setOpenNoAplican(o => !o)}>
                  {openNoAplican ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  No aplican ({noAplican.length}) — tildá para incluir alguno
                </button>
                {openNoAplican && (
                  <div className="space-y-1">
                    {noAplican.map(f => (
                      <div key={f.template.id} className="flex items-center gap-2 px-2 py-1 border rounded">
                        <Checkbox checked={f.incluir} onCheckedChange={(ch) => optIn(f.template.id, ch === true)} />
                        <span className="text-sm">{f.template.nombre_referencia}</span>
                        <span className="text-xs text-gray-400">{f.template.responsable} · {f.template.tipo_template}</span>
                      </div>
                    ))}
                    {noAplican.length === 0 && <p className="text-sm text-gray-400 px-2">Ninguna.</p>}
                    {noAplican.some(f => f.incluir) && (
                      <div className="mt-2">{renderMatriz(noAplican.filter(f => f.incluir))}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-sm text-gray-500">Se generarán <strong>{filas.filter(f => f.incluir).length}</strong> templates para <strong>{targetLabel}</strong>. Montos editables (casi todos estimados). Vacío = sin cuota ese mes.</p>
                <Button onClick={generar} disabled={generando} className="bg-green-600 hover:bg-green-700">
                  {generando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Generar {targetLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Detalle de cuotas por fila (fase 2 punto 4) */}
      {detalleId && (() => {
        const df = filas.find(f => f.template.id === detalleId)
        const opciones = Array.from(new Set([...columnas, ...detalleItems.map(i => i.col)])).sort()
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-lg w-full max-w-xl max-h-[85vh] overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Detalle de cuotas — {df?.template.nombre_referencia}</h3>
                <button onClick={() => setDetalleId(null)}><X className="h-5 w-5" /></button>
              </div>
              <p className="text-xs text-gray-500">Editá las cuotas individuales. Podés poner <strong>varias en el mismo mes</strong>. Al generar, este detalle <strong>reemplaza</strong> lo que muestra la matriz para esta fila.</p>
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_60px_1fr_32px] gap-2 text-xs text-gray-400 px-1">
                  <span>Mes</span><span className="text-center">Día</span><span className="text-right">Monto</span><span></span>
                </div>
                {detalleItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_1fr_32px] gap-2 items-center">
                    <select value={it.col} onChange={e => setDetalleCampo(idx, 'col', e.target.value)} className="border rounded h-8 text-sm px-1">
                      {opciones.map(col => <option key={col} value={col}>{fmtCol(col)}</option>)}
                    </select>
                    <Input value={it.dia} onChange={e => setDetalleCampo(idx, 'dia', e.target.value)} className="h-8 text-sm text-center px-1" />
                    <Input value={Number(it.monto).toLocaleString('es-AR')} onChange={e => setDetalleCampo(idx, 'monto', e.target.value)} className="h-8 text-sm text-right px-1" />
                    <button onClick={() => removeDetalleItem(idx)} className="text-gray-400 hover:text-red-600" title="Quitar cuota"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {detalleItems.length === 0 && <p className="text-sm text-gray-400 px-1">Sin cuotas. Agregá con el botón de abajo.</p>}
              </div>
              <Button variant="outline" size="sm" onClick={addDetalleItem}><Plus className="h-4 w-4 mr-1" />Agregar cuota</Button>
              <div className="flex items-center justify-between pt-2 border-t">
                <Button variant="ghost" size="sm" onClick={quitarDetalle} className="text-gray-500">Quitar detalle (usar matriz)</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDetalleId(null)}>Cancelar</Button>
                  <Button size="sm" onClick={guardarDetalle}>Guardar detalle</Button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
