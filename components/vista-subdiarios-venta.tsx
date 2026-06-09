"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, RefreshCw, Search, Pencil, Trash2, Eye, EyeOff, FileText, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { ModalComprobanteVentaMsa, type ComprobanteVenta } from "./modal-comprobante-venta-msa"

interface Props {
  empresa: 'MSA' | 'MA'
  userRole?: 'admin' | 'contable'
}

const fmtAR = (n: number, dec = 2) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtMoney = (n: number) => `$${fmtAR(n)}`
const fmtFecha = (s: string | null) => {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

// Lista de últimos 24 meses para el selector
const generarPeriodos = (): string[] => {
  const periodos: string[] = []
  const hoy = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    periodos.push(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`)
  }
  return periodos
}

interface TipoComp { codigo: number; descripcion: string; es_nota_credito: boolean }

export function VistaSubdiariosVenta({ empresa, userRole = 'admin' }: Props) {
  const esAdmin = userRole === 'admin'
  const schemaName = empresa === 'MA' ? 'ma' : 'msa'

  const [periodos] = useState<string[]>(generarPeriodos())
  const [periodoConsulta, setPeriodoConsulta] = useState('')
  const [comprobantes, setComprobantes] = useState<any[]>([])
  const [tipos, setTipos] = useState<TipoComp[]>([])
  const [cargando, setCargando] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())

  // Modal alta/edición
  const [modalAbierto, setModalAbierto] = useState(false)
  const [compEditando, setCompEditando] = useState<ComprobanteVenta | null>(null)

  // Imputar masivo
  const [mostrarModalImputar, setMostrarModalImputar] = useState(false)
  const [periodoImputacion, setPeriodoImputacion] = useState('')

  // Cargar tipos de comprobante al montar
  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from('tipos_comprobante_afip')
        .select('codigo, descripcion, es_nota_credito')
      setTipos((data || []) as TipoComp[])
    }
    cargar()
  }, [])

  // Mapa de tipos para lookup rápido
  const tiposMap = useMemo(() => {
    const m = new Map<number, TipoComp>()
    tipos.forEach(t => m.set(t.codigo, t))
    return m
  }, [tipos])

  const cargarPeriodo = async () => {
    if (!periodoConsulta) { setComprobantes([]); return }
    setCargando(true)
    try {
      const [mes, año] = periodoConsulta.split('/')
      const { data, error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .select('*')
        .eq('año_contable', parseInt(año))
        .eq('mes_contable', parseInt(mes))
        .order('fecha_liquidacion', { ascending: false })
      if (error) throw error
      setComprobantes(data || [])
      setSeleccionados(new Set())
    } catch (err) {
      toast.error('Error cargando período: ' + (err as Error).message)
    } finally {
      setCargando(false)
    }
  }

  // ════════════════════════════════════════════════════════════
  // Subtotales del período — estilo ARCA (FC / NC / Total Neto)
  // Sin Otros Tributos (decisión usuario para Ventas)
  // ════════════════════════════════════════════════════════════

  const subtotales = useMemo(() => {
    if (comprobantes.length === 0) return null

    const sumar = (lista: any[], abs: boolean) => lista.reduce((acc, c) => {
      const sgn = (v: number) => (abs ? Math.abs(v) : v)
      const ng = Number(c.imp_neto_gravado) || 0
      const nng = Number(c.imp_neto_no_gravado) || 0
      const oe = Number(c.imp_op_exentas) || 0
      acc.imp_total          += sgn(Number(c.imp_total) || 0)
      acc.iva                += sgn(Number(c.iva) || 0)
      acc.imp_neto_gravado   += sgn(ng)
      acc.exento_no_gravado  += sgn(nng + oe)
      return acc
    }, { imp_total: 0, iva: 0, imp_neto_gravado: 0, exento_no_gravado: 0 })

    // Bloque IVA Ventas: excluir tipo 11 (FC C) → bloque Monotributo aparte
    const sinMonotrib = comprobantes.filter(c => c.tipo_comprobante !== 11)
    const fcs = sinMonotrib.filter(c => (Number(c.imp_total) || 0) >= 0)
    const ncs = sinMonotrib.filter(c => (Number(c.imp_total) || 0) < 0)
    const sumFC = sumar(fcs, false)
    const sumNC = sumar(ncs, true)
    const sumNeto = {
      imp_total:         sumFC.imp_total         - sumNC.imp_total,
      iva:               sumFC.iva               - sumNC.iva,
      imp_neto_gravado:  sumFC.imp_neto_gravado  - sumNC.imp_neto_gravado,
      exento_no_gravado: sumFC.exento_no_gravado - sumNC.exento_no_gravado,
    }

    // Monotributo: FC C (tipo 11) y NC C (tipo 13)
    const facC = comprobantes.filter(c => c.tipo_comprobante === 11)
    const ncC = comprobantes.filter(c => c.tipo_comprobante === 13)
    const totalFC_C = facC.reduce((s, c) => s + (Number(c.imp_total) || 0), 0)
    const totalNC_C = ncC.reduce((s, c) => s + Math.abs(Number(c.imp_total) || 0), 0)

    return {
      ivaVentas: {
        fc: { ...sumFC, cantidad: fcs.length },
        nc: { ...sumNC, cantidad: ncs.length },
        neto: sumNeto,
      },
      monotributo: {
        fc: { total: totalFC_C, cantidad: facC.length },
        nc: { total: totalNC_C, cantidad: ncC.length },
        neto: totalFC_C - totalNC_C,
      },
    }
  }, [comprobantes])

  // ════════════════════════════════════════════════════════════
  // Acciones
  // ════════════════════════════════════════════════════════════

  const abrirAlta = () => {
    setCompEditando(null)
    setModalAbierto(true)
  }
  const abrirEdicion = (c: any) => {
    setCompEditando(c as ComprobanteVenta)
    setModalAbierto(true)
  }
  const eliminar = async (c: any) => {
    if (!window.confirm(`¿Eliminar comprobante ${c.numero_desde || '(s/n)'} de ${c.denominacion_cliente || ''}?`)) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .delete()
        .eq('id', c.id)
      if (error) throw error
      toast.success('Comprobante eliminado')
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Imputar masivamente al período
  const aplicarImputacion = async () => {
    if (!periodoImputacion) return toast.error('Falta período de imputación')
    if (seleccionados.size === 0) return toast.error('Sin selección')
    const [mes, año] = periodoImputacion.split('/')
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .update({
          año_contable: parseInt(año),
          mes_contable: parseInt(mes),
          ddjj_iva: 'Imputado',
        })
        .in('id', Array.from(seleccionados))
      if (error) throw error
      toast.success(`${seleccionados.size} comprobante(s) imputados al período ${periodoImputacion}`)
      setMostrarModalImputar(false)
      setSeleccionados(new Set())
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  // Confirmar DDJJ del período (todas las imputadas → DDJJ OK)
  const confirmarDDJJ = async () => {
    const imputadas = comprobantes.filter(c => c.ddjj_iva === 'Imputado')
    if (imputadas.length === 0) return toast.error('No hay comprobantes con estado "Imputado" en el período')
    if (!window.confirm(
      `¿Confirmar DDJJ IVA del período ${periodoConsulta}?\n\n` +
      `${imputadas.length} comprobante(s) pasarán a estado "DDJJ OK" (no editables después).\n\n` +
      `Esta acción es difícil de revertir.`
    )) return
    try {
      const { error } = await supabase
        .schema(schemaName)
        .from('comprobantes_venta')
        .update({ ddjj_iva: 'DDJJ OK' })
        .in('id', imputadas.map(c => c.id))
      if (error) throw error
      toast.success(`DDJJ IVA ${periodoConsulta} confirmada (${imputadas.length} comprobantes)`)
      await cargarPeriodo()
    } catch (err) {
      toast.error('Error: ' + (err as Error).message)
    }
  }

  const toggleSel = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Subdiario IVA Ventas — {empresa}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <select
                className="border rounded h-9 px-2 text-sm min-w-[140px]"
                value={periodoConsulta}
                onChange={e => setPeriodoConsulta(e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {periodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Button onClick={cargarPeriodo} disabled={!periodoConsulta || cargando}>
              <Search className="mr-2 h-4 w-4" />Consultar período
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setMostrarModalImputar(true)}>
                Imputar período…
              </Button>
              {esAdmin && (
                <Button onClick={abrirAlta} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />Nuevo comprobante
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subtotales estilo ARCA */}
      {subtotales && (() => {
        const fc = subtotales.ivaVentas.fc
        const nc = subtotales.ivaVentas.nc
        const neto = subtotales.ivaVentas.neto
        const m = subtotales.monotributo
        return (
        <Card>
          <CardHeader>
            <CardTitle>📈 Subtotales Período {periodoConsulta}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Libro IVA Ventas */}
            <div>
              <h4 className="font-medium mb-2 text-sm">📒 Libro IVA Ventas</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium">Neto Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">Exento / No Gravado</th>
                      <th className="px-3 py-2 text-right font-medium">IVA</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2">Facturas{fc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({fc.cantidad})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(fc.imp_total)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-2">Notas de Crédito{nc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({nc.cantidad})</span>}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(nc.imp_total)}</td>
                    </tr>
                    <tr className="border-t bg-blue-50 font-semibold">
                      <td className="px-3 py-2">Total Neto (FC − NC)</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.imp_neto_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.exento_no_gravado)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.iva)}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(neto.imp_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monotributo */}
            {(m.fc.cantidad > 0 || m.nc.cantidad > 0) && (
              <div>
                <h4 className="font-medium mb-2 text-sm">📋 Monotributo — Facturas C (Tipo 11) y NC C (Tipo 13)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Concepto</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2">Facturas C{m.fc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({m.fc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.fc.total)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-3 py-2">NC C{m.nc.cantidad > 0 && <span className="text-gray-500 text-xs ml-1">({m.nc.cantidad})</span>}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.nc.total)}</td>
                      </tr>
                      <tr className="border-t bg-red-50 font-semibold">
                        <td className="px-3 py-2">Total Neto (FC − NC)</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">{fmtMoney(m.neto)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Confirmar DDJJ */}
            {esAdmin && comprobantes.some(c => c.ddjj_iva === 'Imputado') && (
              <div className="border-t pt-3">
                <Button onClick={confirmarDDJJ} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar DDJJ IVA Ventas {periodoConsulta}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )
      })()}

      {/* Tabla comprobantes del período */}
      {comprobantes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Comprobantes del Período {periodoConsulta} ({comprobantes.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {esAdmin && <TableHead className="w-10"></TableHead>}
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="text-right">Neto Gravado</TableHead>
                    <TableHead className="text-right">Exento/NG</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    {esAdmin && <TableHead className="text-right" style={{ width: 110 }}>Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprobantes.map(c => {
                    const tipo = tiposMap.get(c.tipo_comprobante)
                    return (
                      <TableRow key={c.id} className={c.ddjj_iva === 'DDJJ OK' ? 'bg-gray-50' : ''}>
                        {esAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={seleccionados.has(c.id)}
                              onCheckedChange={() => toggleSel(c.id)}
                              disabled={c.ddjj_iva === 'DDJJ OK'}
                            />
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">{fmtFecha(c.fecha_liquidacion)}</TableCell>
                        <TableCell className="text-xs">
                          {c.tipo_comprobante != null ? (
                            <span title={tipo?.descripcion || ''}>
                              {String(c.tipo_comprobante).padStart(3, '0')}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{c.denominacion_cliente || '—'}</TableCell>
                        <TableCell className="text-xs">{c.cuit_cliente || '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{c.imp_neto_gravado != null ? fmtMoney(Number(c.imp_neto_gravado)) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{fmtMoney((Number(c.imp_neto_no_gravado) || 0) + (Number(c.imp_op_exentas) || 0))}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{c.iva != null ? fmtMoney(Number(c.iva)) : '—'}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{c.imp_total != null ? fmtMoney(Number(c.imp_total)) : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            c.ddjj_iva === 'DDJJ OK' ? 'bg-green-50 text-green-700' :
                            c.ddjj_iva === 'Imputado' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-gray-50 text-gray-600'
                          }>
                            {c.ddjj_iva || 'No'}
                          </Badge>
                        </TableCell>
                        {esAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicion(c)} title="Editar"
                                disabled={c.ddjj_iva === 'DDJJ OK'}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => eliminar(c)} title="Eliminar"
                                className="text-red-600 hover:bg-red-50"
                                disabled={c.ddjj_iva === 'DDJJ OK'}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal alta/edición */}
      <ModalComprobanteVentaMsa
        open={modalAbierto}
        onOpenChange={setModalAbierto}
        empresa={empresa}
        comprobanteInicial={compEditando}
        onGuardado={cargarPeriodo}
      />

      {/* Modal imputar masivo */}
      {mostrarModalImputar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 space-y-3">
            <h3 className="font-semibold">Imputar al período</h3>
            <p className="text-sm text-gray-600">
              Vas a imputar <strong>{seleccionados.size}</strong> comprobante(s) al período seleccionado. Pasarán a estado <em>Imputado</em>.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Período destino</Label>
              <select className="border rounded h-9 px-2 text-sm w-full"
                value={periodoImputacion}
                onChange={e => setPeriodoImputacion(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {periodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMostrarModalImputar(false)}>Cancelar</Button>
              <Button onClick={aplicarImputacion} disabled={!periodoImputacion || seleccionados.size === 0} className="bg-blue-600 hover:bg-blue-700">
                Imputar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
