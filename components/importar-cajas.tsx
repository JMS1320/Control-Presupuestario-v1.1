"use client"

/**
 * 💵 IMPORTAR EL EXCEL DE CAJAS DE AMS — Revisar (no guarda) y después Cargar (A-FEAT-1585, JMS 15/11).
 * La lógica está en `lib/extractos/caja-excel.ts`; la ruta es `/api/import-excel-caja`. El protocolo de AMS, arriba.
 */
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { ProtocoloPaseDeCaja } from "@/components/protocolo-pase-de-caja"
import { TestsDelProceso } from "@/components/tests-del-proceso"

/* eslint-disable @typescript-eslint/no-explicit-any */
const fmt = (n: number | null | undefined) => n == null ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtF = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso
const NOMBRE: Record<string, string> = { caja_general: "Caja General", caja_ams: "Caja AMS", caja_sigot: "Caja Sigot" }

function Lista({ titulo, filas, total, tono = "gris", nota }: { titulo: string; filas: any[]; total?: number; tono?: "gris" | "ambar" | "rojo"; nota?: string }) {
  if (!filas?.length) return null
  const color = tono === "rojo" ? "border-red-300 bg-red-50 dark:bg-red-950/30" : tono === "ambar" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-gray-200"
  return (
    <details className={`rounded border ${color} px-2 py-1`} open={tono === "rojo"}>
      <summary className="cursor-pointer text-sm font-medium">{titulo}: {total ?? filas.length}{nota ? <span className="font-normal text-xs text-gray-600"> · {nota}</span> : null}</summary>
      <div className="overflow-x-auto"><table className="text-xs mt-1 w-full">
        <thead><tr className="text-left text-gray-500"><th className="pr-2">Fila</th><th className="pr-2">Fecha</th><th className="pr-2">Concepto</th><th className="pr-2">Cat / Comp</th><th className="pr-2 text-right">Salida</th><th className="pr-2 text-right">Entrada</th><th className="text-right">Dif. saldo</th></tr></thead>
        <tbody>{filas.map((f: any, i: number) => (
          <tr key={i} className="border-t border-gray-100">
            <td className="pr-2">{f.fila ?? ""}</td><td className="pr-2 whitespace-nowrap">{fmtF(f.fecha)}</td>
            <td className="pr-2">{f.concepto ?? f.detalle ?? f.descripcion}{f.yaEsta ? " (ya está)" : ""}{f.textoDistinto ? " (cargado antes con otro texto)" : ""}</td>
            <td className="pr-2">{[f.cat, f.comp].filter(Boolean).join(" · ")}</td>
            <td className="pr-2 text-right tabular-nums">{f.salida ? fmt(f.salida) : f.debitos ? fmt(Number(f.debitos)) : ""}</td>
            <td className="pr-2 text-right tabular-nums">{f.entrada ? fmt(f.entrada) : f.creditos ? fmt(Number(f.creditos)) : ""}</td>
            <td className="text-right tabular-nums">{f.difCadena ? fmt(f.difCadena) : ""}</td>
          </tr>))}</tbody>
      </table></div>
    </details>
  )
}

function ResumenCaja({ c }: { c: any }) {
  const ultimo = c.saldosPorFecha?.at(-1)
  const cierra = ultimo && c.saldoFinalExcel != null && Math.abs(ultimo.porFecha - c.saldoFinalExcel) < 0.01
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <b>{c.caja}</b><span className="text-xs text-gray-500">hoja «{c.hoja}»</span>
        {c.corte && <span className="text-xs">arranca del saldo al {fmtF(c.corte.fecha)}: <b className="tabular-nums">$ {fmt(c.corte.saldo)}</b> (fila {c.corte.fila})</span>}
      </div>
      <div className="text-sm"><b>{c.nuevos}</b> nuevo(s) · {c.yaEstaban} ya estaban
        {c.nDifsCadena ? <span className="text-red-700"> · 🔴 el saldo del Excel no sigue en {c.nDifsCadena}</span> : <span className="text-emerald-700"> · ✓ el saldo del Excel sigue renglón a renglón</span>}
      </div>
      <div className="text-xs space-y-0.5">
        {(c.saldosPorFecha ?? []).map((s: any) => (
          <div key={s.fecha}>Saldo al {fmtF(s.fecha)}: <b className="tabular-nums">$ {fmt(s.porFecha)}</b> por fecha
            {s.porRenglon != null && Math.abs(s.porRenglon - s.porFecha) > 0.01 ? <span className="text-red-700"> · 🔴 el Excel dice $ {fmt(s.porRenglon)} en ese renglón (hay movimientos de esa fecha anotados en otro lugar)</span> : null}</div>))}
        {ultimo && c.saldoFinalExcel != null && <div>{cierra ? "✓" : "🔴"} Saldo final del Excel $ {fmt(c.saldoFinalExcel)} {cierra ? "= saldo por fecha" : `≠ saldo por fecha $ ${fmt(ultimo.porFecha)}`}</div>}
      </div>
      <Lista titulo="🔴 Cruzan el cierre (fecha de un ejercicio anterior a los renglones de arriba)" filas={c.cruzanCierre} tono="rojo" />
      <Lista titulo="🔴 El saldo del Excel no sigue" filas={c.difsCadena} total={c.nDifsCadena} tono="rojo" />
      <Lista titulo="⚠️ Cambiados o borrados en el Excel (están en la app y ya no en el archivo — no se toca nada)" filas={c.cambiadosOBorrados} total={c.nCambiadosOBorrados} tono="ambar" />
      <Lista titulo="⚠️ Posibles repetidos (se cargan los dos: el Excel es como existe)" filas={c.posiblesRepetidos} total={c.nPosiblesRepetidos} tono="ambar" />
      <Lista titulo="Anotados tarde (entran con su fecha, en su mes)" filas={c.anotadosTarde} total={c.nAnotadosTarde} />
      <Lista titulo="Antes del arranque con fecha posterior (quedan afuera: ¿año mal escrito?)" filas={c.antesDelCorteConFechaPosterior} tono="ambar" />
      <Lista titulo="Ya estaban, cargados antes con otro texto" filas={c.yaEstabanConOtroTexto} />
      <Lista titulo="Sin fecha (no se cargan)" filas={(c.sinFecha ?? []).map((s: any) => ({ fila: s.fila, fecha: "", concepto: s.concepto, salida: s.importe < 0 ? -s.importe : 0, entrada: s.importe > 0 ? s.importe : 0 }))} />
    </div>
  )
}

export function ImportarCajas({ cuentaId, onCargado }: { cuentaId: string; onCargado?: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [todas, setTodas] = useState(true)
  const [historico, setHistorico] = useState(false)
  const [desde, setDesde] = useState("2025-06-30")
  const [forzar, setForzar] = useState(false)
  const [cargando, setCargando] = useState<"" | "previa" | "cargar">("")
  const [res, setRes] = useState<any>(null)
  const [revisado, setRevisado] = useState(false)

  const enviar = async (modo: "previa" | "cargar") => {
    if (!archivo) return
    setCargando(modo); if (modo === "previa") setRes(null)
    try {
      const fd = new FormData()
      fd.append("file", archivo); fd.append("tabla", cuentaId); fd.append("alcance", todas ? "todas" : "esta"); fd.append("modo", modo)
      if (historico) { fd.append("historico", "true"); fd.append("desde", desde) }
      if (forzar) fd.append("forzar", "true")
      const r = await fetch("/api/import-excel-caja", { method: "POST", body: fd })
      const d = await r.json()
      setRes({ ...d, ok: r.ok && d.ok !== false })
      setRevisado(modo === "previa" && r.ok && d.ok !== false)
      if (modo === "cargar" && r.ok && d.ok !== false) { setRevisado(false); onCargado?.() }
    } catch { setRes({ ok: false, message: "Error de conexión al procesar el archivo" }) }
    finally { setCargando("") }
  }
  const cambiar = (f: () => void) => { f(); setRevisado(false) }

  return (
    <Card>
      <CardHeader><CardTitle>Importar cajas — Excel de AMS</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <TestsDelProceso proceso="extracto/importar-cajas" pantalla="extracto" />
        <ProtocoloPaseDeCaja abiertoAlInicio />
        <div className="space-y-2">
          <Label htmlFor="cajas-archivo">El Excel de AMS (.xlsx), con una hoja por caja: «CAJA gral», «Caja Sigot», «Caja Andres»</Label>
          <Input id="cajas-archivo" type="file" accept=".xlsx,.xls" onChange={e => cambiar(() => { setArchivo(e.target.files?.[0] ?? null); setRes(null) })} disabled={!!cargando} />
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={todas} onCheckedChange={v => cambiar(() => setTodas(!!v))} disabled={!!cargando} />
            <span>Todas las cajas del archivo <span className="text-xs text-gray-500">(sin tildar: sólo {NOMBRE[cuentaId] ?? cuentaId})</span></span></label>
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={historico} onCheckedChange={v => cambiar(() => setHistorico(!!v))} disabled={!!cargando} />
            <span>Carga inicial (histórico): arranca del saldo al…</span></label>
          {historico && (
            <div className="pl-6 flex items-center gap-2">
              <Input id="cajas-desde" type="date" value={desde} onChange={e => cambiar(() => setDesde(e.target.value))} className="w-44" disabled={!!cargando} />
              <span className="text-xs text-gray-500">Entra «histórico» (no va a conciliación), con un renglón «Saldo al …». Sólo la primera vez de cada caja.</span>
            </div>)}
          <label className="flex items-center gap-2 cursor-pointer"><Checkbox checked={forzar} onCheckedChange={v => setForzar(!!v)} disabled={!!cargando} />
            <span>Cargar igual aunque el saldo del Excel no siga renglón a renglón</span></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => enviar("previa")} disabled={!archivo || !!cargando}>
            {cargando === "previa" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}👁 Revisar (no guarda nada)</Button>
          <Button onClick={() => enviar("cargar")} disabled={!archivo || !!cargando || !revisado}>
            {cargando === "cargar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Cargar {res?.cajas ? `${res.cajas.reduce((t: number, c: any) => t + c.nuevos, 0)} nuevo(s)` : ""}</Button>
          {!revisado && archivo && <span className="text-xs text-gray-500 self-center">Primero «Revisar»: el botón Cargar se habilita después.</span>}
        </div>
        {res && (
          <div className="space-y-3">
            <Alert variant={res.ok ? "default" : "destructive"}><AlertDescription>{res.message}</AlertDescription></Alert>
            {(res.cajas ?? []).map((c: any) => <ResumenCaja key={c.tabla} c={c} />)}
          </div>)}
      </CardContent>
    </Card>
  )
}
