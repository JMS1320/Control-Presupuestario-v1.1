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
  type CuotaControlada, type CuotaEsperada, type MovimientoControlado,
} from "@/lib/polizas/control-debitos"
import { resumenPorEjercicio, ejercicioDe, polizaAnteriorDe, cuentaCorriente, TEXTO_MOTIVO, type ResumenEjercicio, type CuentaCorriente } from "@/lib/polizas/resumen-ejercicio"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BotonRevision } from "@/components/boton-revision"

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
  const [ejercicioVisto, setEjercicioVisto] = useState<string | null>(null)

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

  // Las cuotas como vienen de los endosos (los PDF): las usa el control y las columnas del resumen.
  const emitidas = useMemo(() => {
    const endosos = polizas.flatMap(p => p.polizas_endosos.map(e => ({
      poliza: p.poliza, endoso: e.endoso,
      cuotas: e.polizas_cuotas.map(c => ({ vencimiento: c.vencimiento, importe: Number(c.importe) })),
      consolidado: e.consolidado ? { fecha: e.consolidado.fecha, cuotas: e.consolidado.cuotas.map(c => ({ vencimiento: c.vencimiento, importe: c.importe, saldo: c.saldo ?? null })) } : null,
    })))
    return cuotasEsperadas(endosos)
  }, [polizas])
  const control = useMemo(() => {
    if (!movs || !ventana) return null
    return controlarDebitos(emitidas, movs, ventana)
  }, [emitidas, movs, ventana])

  // 🧾 A-FEAT-1383: lo PRIMERO de la pantalla — por ejercicio y por póliza, lo emitido contra lo pagado.
  // Se calcula al abrir (no se guarda nada): cambia solo cuando entra un extracto o una póliza nueva.
  const resumen: ResumenEjercicio[] = useMemo(() => {
    if (!control || !ventana) return []
    return resumenPorEjercicio(control.cuotas, control.movimientos, polizas, ventana.hasta, ejercicioDe(ventana.desde), emitidas)
  }, [control, ventana, polizas, emitidas])
  const ejercicioActual = ejercicioVisto ?? resumen[resumen.length - 1]?.ejercicio ?? null

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

  return (
    <div className="space-y-4">
      <TestsDelProceso proceso="egresos/seguros" pantalla="egresos" />
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {/* ── 0 · EL RESUMEN POR EJERCICIO (A-FEAT-1383) ─────────────────────────────── */}
      {resumen.length > 0 && ventana && control && (
        <ResumenPorEjercicio resumen={resumen} actual={ejercicioActual} onElegir={setEjercicioVisto}
          hasta={ventana.hasta} desde={ventana.desde} polizas={polizas} control={control} emitidas={emitidas}
          onVerPoliza={(nro) => { const p = polizas.find(x => x.poliza === nro); if (p) { setAbierta(p.id); setTimeout(() => document.getElementById(`poliza-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50) } }} />
      )}

      {errorExtracto && <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{errorExtracto}</div>}

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
                    <TableRow id={`poliza-${p.id}`} className="cursor-pointer" onClick={() => setAbierta(abiertaEsta ? null : p.id)}>
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

/**
 * Un botón que sigue andando en SÓLO LECTURA. `<SoloLectura>` apaga todo `<button>` de la pestaña con un
 * `<fieldset disabled>` — y con él los botones de ejercicio, que sólo cambian lo que se MIRA. (JMS 27/10:
 * «no puedo cambiar la campaña», viendo con el rol de pruebas, que tiene Seguros en lectura.)
 */
function Boton({ onClick, className, title, children }: { onClick: () => void; className?: string; title?: string; children: React.ReactNode }) {
  return (
    <span role="button" tabIndex={0} title={title} className={`cursor-pointer select-none ${className ?? ""}`}
      onClick={onClick} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}>
      {children}
    </span>
  )
}

function ResumenPorEjercicio({ resumen, actual, onElegir, hasta, desde, polizas, control, emitidas, onVerPoliza }: {
  resumen: ResumenEjercicio[]; actual: string | null; onElegir: (e: string) => void; hasta: string; desde: string
  polizas: Poliza[]; control: { cuotas: CuotaControlada[]; movimientos: MovimientoControlado[] }; emitidas: CuotaEsperada[]
  onVerPoliza: (poliza: string) => void
}) {
  const [verCtaCte, setVerCtaCte] = useState(false)
  const r = resumen.find(x => x.ejercicio === actual) ?? resumen[resumen.length - 1]
  const reclamar = r.aReclamar
  const idDe = (nro: string | null) => polizas.find(p => p.poliza === nro)?.id ?? null
  const ramoDe = new Map(polizas.map(p => [p.poliza, p.seccion ?? ""]))
  const delEjercicio = (f: string) => ejercicioDe(f) === r.ejercicio
  // El detalle de abajo, del ejercicio elegido.
  const reintegros = control.movimientos.filter(m => m.resultado === "reintegro-sin-nc" && delEjercicio(m.fecha))
  const otroImporte = control.cuotas.filter(c => c.resultado === "importe-distinto" && delEjercicio(c.vencimiento))
  const sinPoliza = control.movimientos.filter(m => m.resultado === "sin-poliza" && delEjercicio(m.fecha) && !polizaAnteriorDe(m.fecha, polizas))
  // 🧮 El control: la cuenta corriente (camino inverso) tiene que dar la suma de «a reclamar».
  const cc = useMemo(() => cuentaCorriente(emitidas, control.cuotas, control.movimientos, polizas, desde, hasta),
    [emitidas, control, polizas, desde, hasta])
  // El último ejercicio arrastra lo abierto de los anteriores: su total es lo que falta reclamar HOY.
  const sumaReclamar = resumen[resumen.length - 1].total.diferencia
  const cierra = Math.abs(sumaReclamar - cc.saldo) < 0.01

  return (
    <Card className={reclamar.length ? "border-red-300" : "border-green-300"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
          <span className="flex items-center gap-2">
            {reclamar.length ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
            {reclamar.length
              ? <>Falta reclamar {reclamar.length} {reclamar.length === 1 ? "cosa" : "cosas"} · saldo {$(r.total.diferencia)}</>
              : <>No falta reclamar nada</>}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {resumen.map(x => (
              <Boton key={x.ejercicio} onClick={() => onElegir(x.ejercicio)}
                className={`rounded-full border px-3 py-0.5 text-sm ${x.ejercicio === r.ejercicio ? "border-blue-400 bg-blue-50 font-medium text-blue-700" : "text-muted-foreground"}`}>
                Ejercicio {x.ejercicio}{x.aReclamar.length ? " 🔴" : " ✓"}
              </Boton>
            ))}
            <Boton onClick={() => setVerCtaCte(true)} title="Todo lo que entró, en orden: cuotas, notas de crédito, débitos y reintegros, con su saldo"
              className="ml-1 rounded-md border border-slate-300 px-3 py-0.5 text-sm hover:bg-slate-50">
              📒 Cuenta corriente
            </Boton>
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada póliza como fue <b>emitida</b> (sus PDF, no cómo se cargó la factura) contra lo que el banco debitó y acreditó,
          <b> esté o no conciliado</b>. Las notas de crédito no se reintegran: la aseguradora las descuenta de las cuotas
          siguientes, por eso «se esperaba en el banco» ya las tiene en cuenta. Vencido hasta el {fecha(hasta)} (último extracto).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Póliza</TableHead>
                <TableHead className="text-right">Cuotas emitidas</TableHead>
                <TableHead className="text-right" title="Las NC que ya tenemos (están en los PDF). Ya están descontadas en «se esperaba en el banco».">NC recibidas</TableHead>
                <TableHead className="text-right">Se esperaba en el banco</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right" title="Lo único que hay que reclamar. Positivo: falta un papel. Negativo: la aseguradora nos debe.">A reclamar</TableHead>
                <TableHead>Qué es</TableHead>
                <TableHead className="text-right">A vencer</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.renglones.map((x, i) => {
                const mal = Math.abs(x.diferencia) > 0.01
                const id = idDe(x.poliza)
                const etiqueta = x.motivo === "reintegro-sin-facturar" ? "Reintegros sin facturar"
                  : x.motivo === "debito-sin-poliza" ? "Débitos sin póliza" : null
                return (
                  <TableRow key={(x.poliza ?? "") + (x.motivo ?? "") + (x.ejercicioOrigen ?? "") + i} className={x.ejercicioOrigen ? "bg-amber-50/50" : mal ? "bg-red-50/60" : ""}>
                    <TableCell>
                      {x.poliza && !etiqueta
                        ? <Boton className="text-left hover:underline" onClick={() => onVerPoliza(x.poliza!)} title="Ver la póliza, con sus PDF">
                            <span className="font-mono">{x.poliza}</span> <span className="text-xs text-muted-foreground">{x.seccion}</span>
                          </Boton>
                        : <span className="font-medium">{etiqueta}</span>}
                      {x.ejercicioOrigen && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800" title="Quedó sin resolver en ese ejercicio y sigue pendiente">viene de {x.ejercicioOrigen}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{x.cuotas ? $(x.cuotas) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.notasCredito ? $(x.notasCredito) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.esperadoVencido ? $(x.esperadoVencido) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.pagado ? $(x.pagado) : ""}</TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${!mal ? "text-green-700" : x.diferencia > 0 ? "text-red-700" : "text-blue-700"}`}>
                      {!mal ? "✓ 0" : $(x.diferencia)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {x.motivo ? TEXTO_MOTIVO[x.motivo] : ""}
                      {mal && x.casos.length > 0 && x.motivo !== "reintegro-sin-facturar" && x.motivo !== "debito-sin-poliza" && (
                        <span className="block text-muted-foreground">
                          {x.casos.map(c => `${fecha(c.fecha)}: se esperaba ${$(c.esperado)}, ${c.debitado == null ? "sin débito" : `se debitó ${$(c.debitado)}`}`).join(" · ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{x.aVencer ? $(x.aVencer) : ""}</TableCell>
                    <TableCell>
                      {mal && (
                        <BotonRevision
                          schema="public" tabla={id ? "polizas_seguro" : "msa_galicia"} registroId={id ?? `${x.motivo}-${r.ejercicio}`}
                          descripcion={`${x.poliza ? `Póliza ${x.poliza} (${x.seccion ?? ""})` : etiqueta ?? "Seguros"} · ejercicio ${r.ejercicio} · a reclamar ${$(x.diferencia)} · ${x.motivo ? TEXTO_MOTIVO[x.motivo] : ""}`}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              <TableRow className="font-semibold">
                <TableCell>Total ejercicio {r.ejercicio}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.total.cuotas)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.total.notasCredito)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.total.esperadoVencido)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.total.pagado)}</TableCell>
                <TableCell className={`text-right tabular-nums ${Math.abs(r.total.diferencia) > 0.01 ? "text-red-700" : "text-green-700"}`}>{$(r.total.diferencia)}</TableCell>
                <TableCell />
                <TableCell className="text-right text-xs tabular-nums">{r.total.aVencer ? $(r.total.aVencer) : ""}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          <b>Cómo se lee:</b> se esperaba en el banco = cuotas − NC recibidas (las que se descuentan en ese ejercicio).
          <b> A reclamar</b> = se esperaba − pagado. Es <b>lo único que hay que pedir, una sola vez</b>: las NC recibidas no se reclaman ni se suman.
          Positivo = falta un papel; negativo (azul) = la aseguradora nos debe.
        </p>
        <p className={`text-xs ${cierra ? "text-green-700" : "font-semibold text-red-700"}`}>
          {cierra ? "✓" : "🛑"} Control: la cuenta corriente al {fecha(hasta)} da {$(cc.saldo)} y «a reclamar» del ejercicio {resumen[resumen.length - 1].ejercicio} (con lo que arrastra) da {$(sumaReclamar)}{cierra ? "." : " — no coinciden: avisar."}
        </p>

        {otroImporte.length > 0 && (
          <BloqueCuotas titulo="⚠️ Se debitó otro importe — ¿un endoso sin cargar?" cuotas={otroImporte} ramoDe={ramoDe} />
        )}
        {reintegros.length > 0 && (
          <BloqueMovs titulo="⚠️ Reintegros de la aseguradora que ninguna nota de crédito explica" movs={reintegros} />
        )}
        {sinPoliza.length > 0 && (
          <BloqueMovs titulo="🛑 Débitos que no son cuota de ninguna póliza cargada — falta cargar la póliza" movs={sinPoliza} />
        )}
        {r.anteriores.cantidad > 0 && (
          <p className="text-xs text-muted-foreground">
            No se cuentan {r.anteriores.cantidad} débito(s) por {$(r.anteriores.total)} de pólizas anteriores al ejercicio
            ({r.anteriores.polizas.join(", ")}): son del balance anterior.
          </p>
        )}
        <p className="text-xs text-muted-foreground">🚩 en cada diferencia: pasársela a alguien (por ejemplo, Ulises) con un mensaje. Le llega a su campanita.</p>
      </CardContent>

      <Dialog open={verCtaCte} onOpenChange={setVerCtaCte}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📒 Cuenta corriente con la aseguradora — al {fecha(hasta)}</DialogTitle>
          </DialogHeader>
          <CuentaCorrienteTabla cc={cc} polizas={polizas} ramoDe={ramoDe} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function CuentaCorrienteTabla({ cc, polizas, ramoDe }: { cc: CuentaCorriente; polizas: Poliza[]; ramoDe: Map<string, string> }) {
  const [poliza, setPoliza] = useState<string | null>(null)
  const pdfDe = (pol: string | null, endoso?: number) =>
    pol == null || endoso == null ? null : polizas.find(p => p.poliza === pol)?.polizas_endosos.find(e => e.endoso === endoso)?.pdf_drive_url ?? null
  // Filtrando una póliza, el saldo se recalcula sólo con sus renglones.
  let saldo = 0
  const lineas = cc.lineas.filter(l => !poliza || l.poliza === poliza).map(l => { saldo = Math.round((saldo + l.cargo - l.credito) * 100) / 100; return { ...l, saldo } })
  const final = lineas.length ? lineas[lineas.length - 1].saldo : 0
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <b>Cargo</b>: una cuota emitida o un reintegro que nos hizo la aseguradora. <b>Crédito</b>: un débito del banco o una nota de crédito.
        Con cuotas y débitos el saldo queda en cero; lo que lo saca de cero es lo que falta documentar. Saldo positivo = falta un papel a favor
        nuestro; negativo = la aseguradora nos debe. Los movimientos del banco entran estén o no conciliados.
      </p>
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Boton onClick={() => setPoliza(null)} className={`rounded-full border px-3 py-0.5 ${!poliza ? "border-blue-400 bg-blue-50 text-blue-700" : "text-muted-foreground"}`}>Todas</Boton>
        {[...cc.porPoliza.keys()].sort().map(p => (
          <Boton key={p} onClick={() => setPoliza(p)} className={`rounded-full border px-3 py-0.5 ${poliza === p ? "border-blue-400 bg-blue-50 text-blue-700" : "text-muted-foreground"}`}>
            {p} <span className={Math.abs(cc.porPoliza.get(p)!) > 0.01 ? "text-red-700" : "text-green-700"}>{Math.abs(cc.porPoliza.get(p)!) > 0.01 ? $(cc.porPoliza.get(p)!) : "✓"}</span>
          </Boton>
        ))}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Póliza</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Cargo</TableHead>
              <TableHead className="text-right">Crédito</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.map((l, i) => {
              const pdf = pdfDe(l.poliza, l.endoso)
              return (
                <TableRow key={i} className={l.tipo === "saldo-inicial" ? "bg-muted/40" : ""}>
                  <TableCell className="whitespace-nowrap">{fecha(l.fecha)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.poliza ?? "—"} <span className="font-sans text-muted-foreground">{l.poliza ? ramoDe.get(l.poliza) : ""}</span></TableCell>
                  <TableCell className="text-sm">{l.concepto}{l.estado ? <span className="text-xs text-muted-foreground"> · {l.estado}</span> : null}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.cargo ? $(l.cargo) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.credito ? $(l.credito) : ""}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${Math.abs(l.saldo) < 0.01 ? "text-green-700" : l.saldo > 0 ? "text-red-700" : "text-blue-700"}`}>{$(l.saldo)}</TableCell>
                  <TableCell>{pdf ? <a className="text-blue-600 underline" href={pdf} target="_blank" rel="noreferrer">ver</a> : ""}</TableCell>
                </TableRow>
              )
            })}
            <TableRow className="font-semibold">
              <TableCell colSpan={5}>Saldo{poliza ? ` de la póliza ${poliza}` : ""}</TableCell>
              <TableCell className={`text-right tabular-nums ${Math.abs(final) < 0.01 ? "text-green-700" : final > 0 ? "text-red-700" : "text-blue-700"}`}>{$(final)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
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
