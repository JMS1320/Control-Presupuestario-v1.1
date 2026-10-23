"use client"

/**
 * 🛡️ Egresos → Seguros — A-FEAT-1309.
 *
 * Lo que pidió el usuario (2026-10-20): *«no quisiera que sea una pantalla nueva… dentro de egresos, y
 * ahí poder ver el chequeo. Si entra un débito inesperado no mencionado —y lo debe ver por leyendas
 * adicionales más allá de no estar conciliado— significa póliza a cargar»*.
 *
 * Arriba el CONTROL («¿tenemos todas?»), abajo las pólizas procesadas con sus bienes, el responsable
 * contable e interno de cada uno (editable: es el default del dato real, § 🎚️) y el reparto de cada cuota.
 *
 * 📌 Procesar una póliza nueva se va a disparar al vincular su PDF (cuando la app tenga el archivo, que
 * hoy sólo existe como link de Drive) — eso espera el merge del buscador de PDFs (A-FEAT-1287).
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { usePuedeEditar } from "@/components/contexto-permisos"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, RefreshCw, ShieldCheck } from "lucide-react"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import type { PolizaLeida } from "@/lib/polizas/parsear-poliza"
import { repartoDeLasCuotas, type ReglaResponsable } from "@/lib/polizas/controlar-poliza"
import {
  controlarDebitos, cuotasEsperadas, esDeLaAseguradora,
  type CuotaControlada, type MovimientoControlado,
} from "@/lib/polizas/control-debitos"

const EMPRESAS = ["MSA", "MA", "PAM", "JMS"]
const $ = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—")

interface Endoso {
  id: string
  endoso: number
  fecha_emision: string | null
  total: number | null
  es_nota_credito: boolean
  comprobante_arca_id: string | null
  pdf_drive_url: string | null
  archivo: string | null
  lectura: PolizaLeida
  controles: { que: string; ok: boolean; detalle: string }[]
  consolidado: PolizaLeida["consolidado"]
  polizas_cuotas: { vencimiento: string; importe: number }[]
  polizas_bienes: { tipo: string; certificado: number | null; clave: string | null; descripcion: string | null; prima: number | null; movimiento: string | null }[]
}
interface Poliza {
  id: string
  poliza: string
  seccion: string | null
  producto: string | null
  poliza_anterior: string | null
  vigencia_desde: string | null
  vigencia_hasta: string | null
  polizas_endosos: Endoso[]
}
interface Responsable { clave: string; tipo: string; descripcion: string | null; responsable_contable: string; responsable_interno: string; motivo: string | null }

export function VistaSeguros() {
  const puedeEditar = usePuedeEditar()("egresos.seguros")
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [responsables, setResponsables] = useState<Responsable[]>([])
  const [movs, setMovs] = useState<{ id: string; fecha: string; debitos: number; creditos: number; estado: string | null }[] | null>(null)
  const [ventana, setVentana] = useState<{ desde: string; hasta: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorExtracto, setErrorExtracto] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [abierta, setAbierta] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null); setErrorExtracto(null)
    const [p, r] = await Promise.all([
      supabase.from("polizas_seguro").select("id,poliza,seccion,producto,poliza_anterior,vigencia_desde,vigencia_hasta,polizas_endosos(id,endoso,fecha_emision,total,es_nota_credito,comprobante_arca_id,pdf_drive_url,archivo,lectura,controles,consolidado,polizas_cuotas(vencimiento,importe),polizas_bienes(tipo,certificado,clave,descripcion,prima,movimiento))").order("seccion"),
      supabase.from("polizas_responsables").select("*"),
    ])
    if (p.error) setError("No se pudieron leer las pólizas: " + p.error.message)
    else setPolizas((p.data ?? []) as unknown as Poliza[])
    if (!r.error) setResponsables((r.data ?? []) as Responsable[])

    // Los movimientos de la aseguradora salen de las LEYENDAS, estén o no conciliados.
    const [m, primero, ultimo] = await Promise.all([
      supabase.from("msa_galicia").select("id,fecha,debitos,creditos,estado,leyendas_adicionales_1,leyendas_adicionales_2")
        .or("leyendas_adicionales_1.ilike.*federac*,leyendas_adicionales_2.ilike.*federac*,leyendas_adicionales_1.ilike.*patronal*,leyendas_adicionales_2.ilike.*patronal*")
        .order("fecha"),
      supabase.from("msa_galicia").select("fecha").order("fecha", { ascending: true }).limit(1),
      supabase.from("msa_galicia").select("fecha").order("fecha", { ascending: false }).limit(1),
    ])
    if (m.error || primero.error || ultimo.error) {
      setErrorExtracto("No se pudo leer el extracto (" + (m.error ?? primero.error ?? ultimo.error)!.message + "). Sin él no se puede hacer el control contra el banco.")
      setMovs(null)
    } else {
      setMovs((m.data ?? []).filter(esDeLaAseguradora).map(x => ({ id: x.id, fecha: x.fecha, debitos: Number(x.debitos) || 0, creditos: Number(x.creditos) || 0, estado: x.estado })))
      setVentana({ desde: primero.data?.[0]?.fecha ?? "2000-01-01", hasta: ultimo.data?.[0]?.fecha ?? "2100-01-01" })
    }
    setCargando(false)
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const reglas: ReglaResponsable[] = useMemo(() => responsables.map(r => ({
    ...(r.tipo === "vehiculo" ? { patente: r.clave } : { dni: r.clave }),
    contable: r.responsable_contable, interno: r.responsable_interno, motivo: r.motivo ?? "",
  })), [responsables])

  const control = useMemo(() => {
    if (!movs || !ventana) return null
    const endosos = polizas.flatMap(p => p.polizas_endosos.map(e => ({
      poliza: p.poliza, endoso: e.endoso,
      cuotas: e.polizas_cuotas.map(c => ({ vencimiento: c.vencimiento, importe: Number(c.importe) })),
      consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map(c => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null,
    })))
    return controlarDebitos(cuotasEsperadas(endosos), movs, ventana)
  }, [polizas, movs, ventana])

  const ramoDe = useMemo(() => new Map(polizas.map(p => [p.poliza, p.seccion ?? ""])), [polizas])

  const guardarResponsable = async (clave: string, tipo: string, descripcion: string | null, eje: "responsable_contable" | "responsable_interno", valor: string) => {
    const actual = responsables.find(r => r.clave === clave)
    const fila = {
      clave, tipo, descripcion,
      responsable_contable: actual?.responsable_contable ?? "MSA",
      responsable_interno: actual?.responsable_interno ?? "MSA",
      motivo: actual?.motivo ?? "Cambiado en Egresos → Seguros",
      [eje]: valor,
      updated_at: new Date().toISOString(),
    }
    const { error: e } = await supabase.from("polizas_responsables").upsert(fila, { onConflict: "clave" })
    if (e) { setError("No se guardó el responsable: " + e.message); return }
    setResponsables(prev => [...prev.filter(r => r.clave !== clave), fila as Responsable])
  }

  if (cargando) return <div className="p-6 text-muted-foreground">Cargando seguros…</div>

  const sinPoliza = control?.movimientos.filter(m => m.resultado === "sin-poliza") ?? []
  const reintegros = control?.movimientos.filter(m => m.resultado === "reintegro-sin-nc") ?? []
  const sinDebito = control?.cuotas.filter(c => c.resultado === "falta-debito") ?? []
  const distinto = control?.cuotas.filter(c => c.resultado === "importe-distinto") ?? []
  const ok = control?.cuotas.filter(c => c.resultado === "ok").length ?? 0
  const problemas = sinPoliza.length + sinDebito.length + distinto.length + reintegros.length

  return (
    <div className="space-y-4">
      <TestsDelProceso proceso="egresos/seguros" pantalla="egresos" />
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* ── 1 · EL CONTROL ──────────────────────────────────────────────────────────── */}
      <Card className={problemas ? "border-red-300" : "border-green-300"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-lg">
            <span className="flex items-center gap-2">
              {problemas ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
              ¿Tenemos todas las pólizas? — Federación Patronal contra el extracto
            </span>
            <Button variant="ghost" size="sm" onClick={() => void cargar()}><RefreshCw className="h-4 w-4" /></Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Los movimientos se buscan por las <b>leyendas adicionales</b> del extracto, estén o no conciliados.
            Un débito que no es cuota de ninguna póliza procesada es una <b>póliza a cargar</b>.
            {ventana && <> Extracto del {fecha(ventana.desde)} al {fecha(ventana.hasta)}.</>}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorExtracto && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{errorExtracto}</div>}
          {control && (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline" className="border-green-400 text-green-700">✓ {ok} cuotas debitadas bien</Badge>
              <Badge variant="outline" className={sinPoliza.length ? "border-red-400 text-red-700" : ""}>{sinPoliza.length} débitos sin póliza</Badge>
              <Badge variant="outline" className={sinDebito.length ? "border-red-400 text-red-700" : ""}>{sinDebito.length} cuotas vencidas sin débito</Badge>
              <Badge variant="outline" className={distinto.length ? "border-amber-400 text-amber-700" : ""}>{distinto.length} con importe distinto</Badge>
              <Badge variant="outline" className={reintegros.length ? "border-amber-400 text-amber-700" : ""}>{reintegros.length} reintegros sin nota de crédito</Badge>
              <Badge variant="outline">{control.cuotas.filter(c => c.resultado === "compensada" || c.resultado === "nc").length} NC compensadas</Badge>
              <Badge variant="outline">{control.cuotas.filter(c => c.resultado === "a-vencer").length} a vencer</Badge>
            </div>
          )}
          {control && !problemas && <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /> Cada débito de Federación es cuota de una póliza procesada y cada cuota vencida se debitó.</p>}

          {sinPoliza.length > 0 && (
            <BloqueMovs titulo="🛑 Débitos de Federación que no son cuota de ninguna póliza — falta cargar la póliza" movs={sinPoliza} />
          )}
          {sinDebito.length > 0 && (
            <BloqueCuotas titulo="🛑 Cuotas vencidas sin débito — ¿no se debitó, o la póliza se dio de baja sin su nota de crédito?" cuotas={sinDebito} ramoDe={ramoDe} />
          )}
          {distinto.length > 0 && (
            <BloqueCuotas titulo="⚠️ Se debitó otro importe — ¿un endoso sin cargar?" cuotas={distinto} ramoDe={ramoDe} />
          )}
          {reintegros.length > 0 && (
            <BloqueMovs titulo="⚠️ Reintegros de Federación que ninguna nota de crédito explica" movs={reintegros} />
          )}
        </CardContent>
      </Card>

      {/* ── 2 · LAS PÓLIZAS ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Pólizas procesadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            El reparto de cada cuota sale de la prima de cada bien, endoso por endoso. El responsable contable e interno
            de cada bien se puede cambiar: vale para todas las pólizas donde aparezca (va por patente o DNI).
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Ramo</TableHead>
                <TableHead>Póliza</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Anterior</TableHead>
                <TableHead className="text-right">Endosos</TableHead>
                <TableHead className="text-right">Total facturado</TableHead>
                <TableHead>Controles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polizas.map(p => {
                const endosos = [...p.polizas_endosos].sort((a, b) => a.endoso - b.endoso)
                const total = endosos.reduce((s, e) => s + Number(e.total ?? 0), 0)
                const cierra = endosos.every(e => (e.controles ?? []).every(c => c.ok))
                const abiertaEsta = abierta === p.id
                return (
                  <Fragment key={p.id}>
                    <TableRow className="cursor-pointer" onClick={() => setAbierta(abiertaEsta ? null : p.id)}>
                      <TableCell>{abiertaEsta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell>{p.seccion}</TableCell>
                      <TableCell className="font-mono">{p.poliza}</TableCell>
                      <TableCell>{fecha(p.vigencia_desde)} → {fecha(p.vigencia_hasta)}</TableCell>
                      <TableCell className="font-mono">{p.poliza_anterior ?? "—"}</TableCell>
                      <TableCell className="text-right">{endosos.length}</TableCell>
                      <TableCell className="text-right">{$(total)}</TableCell>
                      <TableCell>{cierra ? <span className="text-green-700">✓ cierra</span> : <span className="text-red-700">✗ no cierra</span>}</TableCell>
                    </TableRow>
                    {abiertaEsta && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <DetallePoliza p={p} endosos={endosos} reglas={reglas} responsables={responsables}
                            control={control?.cuotas.filter(c => c.poliza === p.poliza) ?? []}
                            puedeEditar={puedeEditar} onResponsable={guardarResponsable} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
              {!polizas.length && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Todavía no hay pólizas procesadas.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function BloqueMovs({ titulo, movs }: { titulo: string; movs: MovimientoControlado[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{titulo}</p>
      <Table>
        <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Débito</TableHead><TableHead className="text-right">Crédito</TableHead><TableHead>Estado en el extracto</TableHead></TableRow></TableHeader>
        <TableBody>
          {movs.map(m => (
            <TableRow key={m.id}><TableCell>{fecha(m.fecha)}</TableCell><TableCell className="text-right">{m.debitos ? $(m.debitos) : ""}</TableCell><TableCell className="text-right">{m.creditos ? $(m.creditos) : ""}</TableCell><TableCell>{m.estado}</TableCell></TableRow>
          ))}
          <TableRow className="font-semibold"><TableCell>Total</TableCell><TableCell className="text-right">{$(movs.reduce((s, m) => s + m.debitos, 0))}</TableCell><TableCell className="text-right">{$(movs.reduce((s, m) => s + m.creditos, 0))}</TableCell><TableCell /></TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function BloqueCuotas({ titulo, cuotas, ramoDe }: { titulo: string; cuotas: CuotaControlada[]; ramoDe: Map<string, string> }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{titulo}</p>
      <Table>
        <TableHeader><TableRow><TableHead>Póliza</TableHead><TableHead>Ramo</TableHead><TableHead>Vencimiento</TableHead><TableHead className="text-right">Se esperaba</TableHead><TableHead className="text-right">Se debitó</TableHead></TableRow></TableHeader>
        <TableBody>
          {cuotas.map(c => (
            <TableRow key={c.poliza + c.vencimiento}><TableCell className="font-mono">{c.poliza}</TableCell><TableCell>{ramoDe.get(c.poliza)}</TableCell><TableCell>{fecha(c.vencimiento)}</TableCell><TableCell className="text-right">{$(c.esperadoEnBanco)}</TableCell><TableCell className="text-right">{c.debitado == null ? "—" : $(c.debitado)}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const RESULTADO: Record<string, string> = {
  "ok": "✓ debitada", "compensada": "compensada con una NC", "nc": "nota de crédito", "importe-distinto": "⚠️ otro importe",
  "falta-debito": "🛑 sin débito", "a-vencer": "a vencer", "anterior-al-extracto": "anterior al extracto",
}

function DetallePoliza({ p, endosos, reglas, responsables, control, puedeEditar, onResponsable }: {
  p: Poliza; endosos: Endoso[]; reglas: ReglaResponsable[]; responsables: Responsable[]; control: CuotaControlada[]
  puedeEditar: boolean
  onResponsable: (clave: string, tipo: string, desc: string | null, eje: "responsable_contable" | "responsable_interno", valor: string) => void
}) {
  const lecturas = endosos.map(e => e.lectura)
  const interno = repartoDeLasCuotas(lecturas, reglas, "interno")
  const contable = repartoDeLasCuotas(lecturas, reglas, "contable")
  const repDe = (mapa: Map<string, { responsable: string; importe: number }[]>, venc: string) => {
    const k = [...mapa.keys()].find(v => Math.abs(Date.parse(v) - Date.parse(venc)) <= 7 * 864e5)
    return k ? mapa.get(k)!.map(x => `${x.responsable} ${$(x.importe)}`).join(" · ") : "—"
  }
  // Los bienes vigentes: los del último endoso que trae bienes.
  const conBienes = [...endosos].reverse().find(e => e.polizas_bienes.length)
  const bienes = conBienes?.polizas_bienes ?? []
  const resp = (clave: string | null) => responsables.find(r => r.clave === clave)

  return (
    <div className="space-y-4 py-2">
      <div>
        <p className="mb-1 text-sm font-semibold">Endosos (cada uno es un comprobante)</p>
        <Table>
          <TableHeader><TableRow><TableHead>Endoso</TableHead><TableHead>Emisión</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Tipo</TableHead><TableHead>Factura en la app</TableHead><TableHead>PDF</TableHead><TableHead>Controles</TableHead></TableRow></TableHeader>
          <TableBody>
            {endosos.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.endoso}</TableCell>
                <TableCell>{fecha(e.fecha_emision)}</TableCell>
                <TableCell className="text-right">{$(Number(e.total))}</TableCell>
                <TableCell>{e.es_nota_credito ? "Nota de crédito" : "Factura"}</TableCell>
                <TableCell>{e.comprobante_arca_id ? "✓ vinculada" : <span className="text-muted-foreground">— (histórico)</span>}</TableCell>
                <TableCell>{e.pdf_drive_url ? <a className="text-blue-600 underline" href={e.pdf_drive_url} target="_blank" rel="noreferrer">ver</a> : <span className="text-muted-foreground" title={e.archivo ?? ""}>en el subdiario</span>}</TableCell>
                <TableCell title={(e.controles ?? []).map(c => `${c.ok ? "✓" : "✗"} ${c.que}: ${c.detalle}`).join("\n")}>
                  {(e.controles ?? []).every(c => c.ok) ? <span className="text-green-700">✓ {(e.controles ?? []).length}</span> : <span className="text-red-700">✗</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {bienes.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-semibold">Lo asegurado (endoso {conBienes?.endoso}) — a quién le corresponde</p>
          <Table>
            <TableHeader><TableRow><TableHead>Bien</TableHead><TableHead>Patente / DNI</TableHead><TableHead>Movimiento</TableHead><TableHead className="text-right">Prima</TableHead><TableHead>Contable</TableHead><TableHead>Interno</TableHead></TableRow></TableHeader>
            <TableBody>
              {bienes.map((b, i) => {
                const r = resp(b.clave)
                const sel = (eje: "responsable_contable" | "responsable_interno") => (
                  <select className="rounded border bg-background px-1 py-0.5 text-sm" disabled={!puedeEditar || !b.clave}
                    value={r?.[eje] ?? "MSA"} title={r?.motivo ?? "por defecto: MSA"}
                    onChange={ev => b.clave && onResponsable(b.clave, b.tipo, b.descripcion, eje, ev.target.value)}>
                    {EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                )
                return (
                  <TableRow key={i}>
                    <TableCell>{b.descripcion}</TableCell>
                    <TableCell className="font-mono">{b.clave ?? "sin patente"}</TableCell>
                    <TableCell>{b.movimiento ?? ""}</TableCell>
                    <TableCell className="text-right">{b.prima == null ? "" : $(Number(b.prima))}</TableCell>
                    <TableCell>{sel("responsable_contable")}</TableCell>
                    <TableCell>{sel("responsable_interno")}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div>
        <p className="mb-1 text-sm font-semibold">Cuotas: reparto y débito en el banco</p>
        <Table>
          <TableHeader><TableRow><TableHead>Vencimiento</TableHead><TableHead className="text-right">Cuota</TableHead><TableHead className="text-right">Se espera en el banco</TableHead><TableHead>Banco</TableHead><TableHead>Reparto interno</TableHead><TableHead>Reparto contable</TableHead></TableRow></TableHeader>
          <TableBody>
            {control.map(c => (
              <TableRow key={c.vencimiento}>
                <TableCell>{fecha(c.vencimiento)}</TableCell>
                <TableCell className="text-right">{$(c.importe)}</TableCell>
                <TableCell className="text-right">{c.importe < 0 ? "" : $(c.esperadoEnBanco)}</TableCell>
                <TableCell className={c.resultado === "falta-debito" ? "text-red-700" : c.resultado === "importe-distinto" ? "text-amber-700" : ""}>
                  {RESULTADO[c.resultado]}{c.debitado != null && c.resultado !== "ok" ? ` (${$(c.debitado)})` : ""}
                </TableCell>
                <TableCell className="text-xs">{repDe(interno, c.vencimiento)}</TableCell>
                <TableCell className="text-xs">{repDe(contable, c.vencimiento)}</TableCell>
              </TableRow>
            ))}
            {!control.length && <TableRow><TableCell colSpan={6} className="text-muted-foreground">Sin control: no se pudo leer el extracto.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <p className="mt-1 text-xs text-muted-foreground">Póliza {p.poliza}{p.producto ? ` · ${p.producto}` : ""}</p>
      </div>
    </div>
  )
}
