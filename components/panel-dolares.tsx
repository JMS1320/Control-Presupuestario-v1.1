"use client"

/**
 * 💵 DÓLARES Y COTITULARES — A-FEAT-1398 (JMS 2026-10-28).
 *
 * Tres piezas, las tres sobre las 7 cuentas de `scripts/126` (lista en `lib/dolares/cuentas.ts`):
 *  · `PanelDolares`         — el «Cash Flow en dólares»: saldo de cada cuenta (en su moneda y en pesos), el flujo por
 *                             mes y la cuenta corriente de Cotitulares con cada empresa.
 *  · `ModalMovimientoManual` — cargar un movimiento a mano («vendí USD 500»), que queda PENDIENTE de conciliar.
 *  · `ModalCambioMoneda`    — compra/venta de dólares: DOS movimientos atados (sale USD, entran pesos) con el mismo TC.
 *
 * El movimiento cargado a mano entra como `Pendiente`: cuando llegue el extracto se concilia contra él (no se duplica).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SelectorCuentaContable } from "@/components/ui/selector-cuenta-contable"
import { Permisable } from "@/components/modo-permisos"
import { CUENTAS_BANCARIAS } from "@/hooks/useMotorConciliacion"
import { hoyArgentina } from "@/lib/fechas"
import {
  CUENTAS_DOLARES_Y_COTITULARES, COTITULARES, cuentaManual, saldoCuenta, flujoPorMes, cuentaCorriente,
  leerNumeroAR, armarCambio, erroresCambio, pesosDe, type MovimientoMoneda, type CuentaManual,
} from "@/lib/dolares/cuentas"
import { CUENTAS_EN_MONEDA_EXTRANJERA, posicionAlCierre } from "@/lib/dolares/posicion-cierre"
import { Loader2, Plus, ArrowLeftRight } from "lucide-react"

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const simbolo = (m: "USD" | "ARS") => (m === "USD" ? "US$" : "$")
const db = (schema: string) => (schema !== "public" ? supabase.schema(schema) : supabase)
const COLS = "id, fecha, descripcion, debitos, creditos, moneda, tipo_cambio, importe_pesos, por_cuenta_de, estado, categ"

type Mov = MovimientoMoneda & { categ?: string | null }

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Cargar un movimiento a mano
// ════════════════════════════════════════════════════════════════════════════════════════════════
export function ModalMovimientoManual({ abierto, cuentaId, onClose, onGuardado }: {
  abierto: boolean; cuentaId: string | null; onClose: () => void; onGuardado?: () => void
}) {
  const [cuenta, setCuenta] = useState<string>(cuentaId ?? CUENTAS_DOLARES_Y_COTITULARES[0].id)
  const [fecha, setFecha] = useState(hoyArgentina())
  const [sentido, setSentido] = useState<"sale" | "entra">("sale")
  const [importe, setImporte] = useState("")
  const [tc, setTc] = useState("")
  const [pesos, setPesos] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categ, setCateg] = useState<string | null>(null)
  const [nroCuenta, setNroCuenta] = useState<string | null>(null)
  const [porCuentaDe, setPorCuentaDe] = useState<string>("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setCuenta(cuentaId ?? CUENTAS_DOLARES_Y_COTITULARES[0].id); setFecha(hoyArgentina()); setSentido("sale")
    setImporte(""); setTc(""); setPesos(""); setDescripcion(""); setCateg(null); setNroCuenta(null); setPorCuentaDe("")
  }, [abierto, cuentaId])

  const c = cuentaManual(cuenta)
  const imp = leerNumeroAR(importe)
  const tcN = leerNumeroAR(tc)
  const pesosEscritos = leerNumeroAR(pesos)
  // 🎚️ default del dato real: los pesos salen de importe × TC; si los escribís, mandan
  const pesosCalculados = c?.moneda === "USD" && imp && tcN ? Math.round(imp * tcN * 100) / 100 : null

  const guardar = async () => {
    if (!c) return
    if (!fecha) { toast.error("Falta la fecha"); return }
    if (!imp || imp <= 0) { toast.error("Falta el importe"); return }
    setGuardando(true)
    try {
      const fila = {
        fecha, descripcion: descripcion.trim() || null,
        debitos: sentido === "sale" ? imp : 0, creditos: sentido === "entra" ? imp : 0,
        moneda: c.moneda, tipo_cambio: c.moneda === "USD" ? tcN : null,
        importe_pesos: pesosEscritos ?? (c.moneda === "USD" ? pesosCalculados : null),
        categ, nro_cuenta: nroCuenta, por_cuenta_de: porCuentaDe || null, estado: "pendiente",
      }
      const { error } = await db(c.schema_bd).from(c.tabla_bd).insert(fila)
      if (error) throw error
      toast.success(`Cargado en ${c.nombre} — queda pendiente de conciliar`)
      onGuardado?.(); onClose()
    } catch (e) { toast.error("No se pudo guardar: " + (e as Error).message) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={abierto} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar movimiento a mano</DialogTitle>
          <DialogDescription>Queda <b>pendiente de conciliar</b>: cuando llegue el extracto se concilia contra éste.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Cuenta</Label>
            <Select value={cuenta} onValueChange={setCuenta}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CUENTAS_DOLARES_Y_COTITULARES.map(x => <SelectItem key={x.id} value={x.id}>{x.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sale o entra</Label>
              <Select value={sentido} onValueChange={v => setSentido(v as "sale" | "entra")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Sale (débito)</SelectItem>
                  <SelectItem value="entra">Entra (crédito)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Importe ({c ? simbolo(c.moneda) : ""})</Label>
              <Input type="text" placeholder="0,00" value={importe} onChange={e => setImporte(e.target.value)} />
            </div>
            {c?.moneda === "USD" && (
              <div className="space-y-1">
                <Label className="text-xs">Tipo de cambio ($ por US$)</Label>
                <Input type="text" placeholder="sin dato todavía" value={tc} onChange={e => setTc(e.target.value)} />
              </div>)}
          </div>
          {c?.moneda === "USD" && (
            <div className="space-y-1">
              <Label className="text-xs">Equivalente en pesos</Label>
              <Input type="text" value={pesos} onChange={e => setPesos(e.target.value)}
                placeholder={pesosCalculados != null ? `${fmt(pesosCalculados)} (importe × TC)` : "se calcula con el TC"} />
            </div>)}
          <div className="space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej.: pago factura de …" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuenta contable</Label>
            <SelectorCuentaContable value={categ} mostrarSinAsignar placeholder="Sin cuenta — clic para asignar"
              onSelect={x => { setCateg(x?.categ ?? null); setNroCuenta(x?.nro_cuenta ?? null) }} />
          </div>
          {c?.empresa === "Cotitulares" && (
            <div className="space-y-1">
              <Label className="text-xs">¿Es por cuenta de una empresa? (arma la cuenta corriente)</Label>
              <Select value={porCuentaDe || "no"} onValueChange={v => setPorCuentaDe(v === "no" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No — es de los Cotitulares</SelectItem>
                  <SelectItem value="MSA">Por cuenta de MSA</SelectItem>
                  <SelectItem value="PAM">Por cuenta de PAM</SelectItem>
                  <SelectItem value="MA">Por cuenta de MA</SelectItem>
                </SelectContent>
              </Select>
            </div>)}
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Compra / venta de dólares — dos movimientos atados
// ════════════════════════════════════════════════════════════════════════════════════════════════
/** Las cuentas en pesos donde puede caer (o de donde puede salir) la contrapartida. Sin tarjetas. */
const CUENTAS_PESOS = CUENTAS_BANCARIAS.filter(c => c.tipo !== "tarjeta" && (c.moneda ?? "ARS") === "ARS")

export function ModalCambioMoneda({ abierto, onClose, onGuardado }: { abierto: boolean; onClose: () => void; onGuardado?: () => void }) {
  const usdCuentas = CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.moneda === "USD")
  const [fecha, setFecha] = useState(hoyArgentina())
  const [sentido, setSentido] = useState<"venta" | "compra">("venta")
  const [cuentaUsd, setCuentaUsd] = useState<string>("cotitulares_ca_usd")
  const [cuentaPesos, setCuentaPesos] = useState<string>("cotitulares_ca_pesos")
  const [usd, setUsd] = useState("")
  const [tc, setTc] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setFecha(hoyArgentina()); setSentido("venta"); setCuentaUsd("cotitulares_ca_usd"); setCuentaPesos("cotitulares_ca_pesos")
    setUsd(""); setTc(""); setDescripcion("")
  }, [abierto])

  const usdN = leerNumeroAR(usd) ?? 0
  const tcN = leerNumeroAR(tc) ?? 0
  const pesos = usdN && tcN ? Math.round(usdN * tcN * 100) / 100 : 0
  const destino = CUENTAS_PESOS.find(c => c.id === cuentaPesos)
  const destinoManual = !!destino?.cargaManual || destino?.tipo === "caja"

  const guardar = async () => {
    const errs = erroresCambio({ fecha, usd: usdN, tc: tcN }, cuentaUsd, cuentaPesos)
    if (errs.length) { toast.error(errs.join(" · ")); return }
    const cu = cuentaManual(cuentaUsd) as CuentaManual
    const cp = destino!
    // «Compra-venta de moneda extranjera» (scripts/127, financiera): el cambio de moneda no es gasto ni ingreso,
    // así que no va al presupuesto.
    const { filaUsd, filaPesos } = armarCambio({ fecha, sentido, usd: usdN, tc: tcN, descripcion: descripcion.trim(), categ: "MONEDA EXTRANJERA" })
    const idUsd = crypto.randomUUID()
    const idPesos = crypto.randomUUID()
    const schemaPesos = cp.schema_bd || "public"
    setGuardando(true)
    try {
      const { error: e1 } = await db(cu.schema_bd).from(cu.tabla_bd).insert({
        id: idUsd, ...filaUsd, par_schema: schemaPesos, par_tabla: cp.tabla_bd, par_id: destinoManual ? idPesos : null,
      })
      if (e1) throw e1
      if (destinoManual) {
        const filaP: Record<string, unknown> = { id: idPesos, ...filaPesos, par_schema: cu.schema_bd, par_tabla: cu.tabla_bd, par_id: idUsd }
        // las cajas viejas (msa.caja_*) no tienen las columnas de moneda: ahí va sólo lo que existe
        if (!cp.cargaManual) for (const k of ["moneda", "tipo_cambio", "importe_pesos", "par_schema", "par_tabla", "par_id"]) delete filaP[k]
        const { error: e2 } = await db(schemaPesos).from(cp.tabla_bd).insert(filaP)
        if (e2) {
          // no queda medio cambio: se borra el lado en dólares que se acaba de crear (sólo ése, por id)
          await db(cu.schema_bd).from(cu.tabla_bd).delete().eq("id", idUsd)
          throw e2
        }
      }
      toast.success(destinoManual
        ? `Cargado: ${sentido === "venta" ? "salen" : "entran"} US$ ${fmt(usdN)} y ${sentido === "venta" ? "entran" : "salen"} $ ${fmt(pesos)} — pendientes de conciliar`
        : `Cargado el lado en dólares. Los $ ${fmt(pesos)} llegan con el extracto de ${cp.nombre}: conciliálos ahí.`)
      onGuardado?.(); onClose()
    } catch (e) { toast.error("No se pudo guardar: " + (e as Error).message) } finally { setGuardando(false) }
  }

  return (
    <Dialog open={abierto} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compra / venta de dólares</DialogTitle>
          <DialogDescription>Se cargan los dos lados atados, con el mismo tipo de cambio. Es un movimiento financiero: no va al presupuesto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Operación</Label>
              <Select value={sentido} onValueChange={v => setSentido(v as "venta" | "compra")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="venta">Vendí dólares</SelectItem>
                  <SelectItem value="compra">Compré dólares</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuenta en dólares ({sentido === "venta" ? "salen" : "entran"})</Label>
            <Select value={cuentaUsd} onValueChange={setCuentaUsd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{usdCuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuenta en pesos ({sentido === "venta" ? "entran" : "salen"})</Label>
            <Select value={cuentaPesos} onValueChange={setCuentaPesos}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CUENTAS_PESOS.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
            {destino && !destinoManual && (
              <p className="text-[11px] text-amber-700">Esa cuenta se importa del banco: se carga sólo el lado en dólares y los pesos se concilian cuando llegue el extracto.</p>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dólares (US$)</Label>
              <Input type="text" placeholder="0,00" value={usd} onChange={e => setUsd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de cambio ($ por US$)</Label>
              <Input type="text" placeholder="0,00" value={tc} onChange={e => setTc(e.target.value)} />
            </div>
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2 text-sm">
            Pesos: <b>$ {fmt(pesos)}</b> <span className="text-xs text-muted-foreground">(US$ × TC)</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción (opcional)</Label>
            <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder={`${sentido === "venta" ? "Venta" : "Compra"} de USD …`} />
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando}>{guardando && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Guardar los dos lados</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// El panel: el Cash Flow en dólares
// ════════════════════════════════════════════════════════════════════════════════════════════════
export function PanelDolares() {
  const [movs, setMovs] = useState<Record<string, Mov[]> | null>(null)
  const [errores, setErrores] = useState<string[]>([])
  const [verCuenta, setVerCuenta] = useState<string>("todas-usd")
  const [cargarAbierto, setCargarAbierto] = useState(false)
  const [cambioAbierto, setCambioAbierto] = useState(false)
  // 📒 etapa 4: la posición al cierre (para el balance)
  const [fechaCierre, setFechaCierre] = useState(hoyArgentina())
  const [tcCierre, setTcCierre] = useState("")

  const cargar = useCallback(async () => {
    const res: Record<string, Mov[]> = {}
    const errs: string[] = []
    await Promise.all(CUENTAS_DOLARES_Y_COTITULARES.map(async c => {
      const { data, error } = await db(c.schema_bd).from(c.tabla_bd).select(COLS).order("fecha", { ascending: true }).limit(5000)
      if (error) errs.push(`${c.nombre}: ${error.message}`)
      res[c.id] = (data ?? []) as Mov[]
    }))
    setMovs(res); setErrores(errs)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const flujo = useMemo(() => {
    if (!movs) return []
    const lista = verCuenta === "todas-usd"
      ? CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.moneda === "USD").flatMap(c => movs[c.id] ?? [])
      : movs[verCuenta] ?? []
    return flujoPorMes(lista)
  }, [movs, verCuenta])

  if (!movs) return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas…</div>

  const cotit = CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.empresa === "Cotitulares").flatMap(c => movs[c.id] ?? [])
  const ctaCte = cuentaCorriente(cotit)
  const totalUsd = CUENTAS_DOLARES_Y_COTITULARES.filter(c => c.moneda === "USD")
    .reduce((s, c) => s + saldoCuenta(movs[c.id] ?? []).moneda, 0)
  const monedaVista = verCuenta === "todas-usd" ? "USD" : (cuentaManual(verCuenta)?.moneda ?? "USD")
  const recientes = CUENTAS_DOLARES_Y_COTITULARES.flatMap(c => (movs[c.id] ?? []).map(m => ({ ...m, cuenta: c })))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 15)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm">Total en dólares: <b>US$ {fmt(totalUsd)}</b></div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Permisable recurso="extracto.dolares-cargar">
            <Button size="sm" variant="outline" onClick={() => setCargarAbierto(true)}><Plus className="mr-1 h-4 w-4" />Cargar movimiento</Button>
            <Button size="sm" onClick={() => setCambioAbierto(true)}><ArrowLeftRight className="mr-1 h-4 w-4" />Compra / venta de USD</Button>
          </Permisable>
        </div>
      </div>
      {errores.length > 0 && <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">No se pudo leer: {errores.join(" · ")}</div>}

      {/* Saldos por cuenta */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2">Cuenta</th><th className="pr-2">Titular</th><th className="pr-2 text-right">Saldo</th>
            <th className="pr-2 text-right">En pesos</th><th className="pr-2 text-right">Movs.</th><th className="text-right">Pend. conciliar</th>
          </tr></thead>
          <tbody>
            {CUENTAS_DOLARES_Y_COTITULARES.map(c => {
              const s = saldoCuenta(movs[c.id] ?? [])
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-1 pr-2">{c.nombre}</td>
                  <td className="pr-2">{c.empresa}</td>
                  <td className="pr-2 text-right tabular-nums">{simbolo(c.moneda)} {fmt(s.moneda)}</td>
                  <td className="pr-2 text-right tabular-nums">
                    $ {fmt(s.pesos)}{s.sinTC > 0 && <span className="ml-1 text-[11px] text-amber-700" title="Movimientos en dólares sin tipo de cambio: no se pueden pasar a pesos">({s.sinTC} sin TC)</span>}
                  </td>
                  <td className="pr-2 text-right tabular-nums">{(movs[c.id] ?? []).length}</td>
                  <td className="text-right tabular-nums">{s.pendientes}</td>
                </tr>)
            })}
          </tbody>
        </table>
      </div>

      {/* Flujo por mes */}
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Flujo por mes</h3>
          <Select value={verCuenta} onValueChange={setVerCuenta}>
            <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas-usd">Todas las cuentas en dólares</SelectItem>
              {CUENTAS_DOLARES_Y_COTITULARES.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {flujo.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1">Mes</th><th className="text-right">Entradas</th><th className="text-right">Salidas</th><th className="text-right">Neto</th><th className="text-right">Saldo</th>
            </tr></thead>
            <tbody>{flujo.map(f => (
              <tr key={f.mes} className="border-b last:border-0 tabular-nums">
                <td className="py-1">{f.mes.split("-").reverse().join("/")}</td>
                <td className="text-right">{fmt(f.entradas)}</td><td className="text-right">{fmt(f.salidas)}</td>
                <td className={`text-right ${f.neto < 0 ? "text-red-700" : ""}`}>{fmt(f.neto)}</td>
                <td className="text-right font-medium">{simbolo(monedaVista)} {fmt(f.saldo)}</td>
              </tr>))}</tbody>
          </table>)}
      </div>

      {/* Cuenta corriente Cotitulares ↔ empresas */}
      <div className="rounded-lg border p-3">
        <h3 className="text-sm font-semibold">Cuenta corriente de Cotitulares con las empresas</h3>
        <p className="mb-2 text-xs text-muted-foreground">Cotitulares: {COTITULARES.join(", ")}. Lo que su plata pagó «por cuenta de» una empresa (positivo = la empresa les debe). Préstamo o aporte: a definir.</p>
        {ctaCte.length === 0 ? <p className="text-sm text-muted-foreground">Nada cargado por cuenta de una empresa.</p> : (
          <ul className="space-y-1 text-sm">{ctaCte.map(x => (
            <li key={x.empresa}><b>{x.empresa}</b> les debe <b>$ {fmt(x.pesos)}</b> · {x.movimientos} movimiento(s)
              {x.sinTC > 0 && <span className="ml-1 text-amber-700">· {x.sinTC} en dólares sin TC (no sumados)</span>}</li>))}</ul>)}
      </div>

      {/* 📒 Posición al cierre, por empresa (para el balance) */}
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Posición en dólares al cierre (balance)</h3>
          <Input type="date" className="h-8 w-40" value={fechaCierre} onChange={e => setFechaCierre(e.target.value)} />
          <Input type="text" className="h-8 w-40" placeholder="TC de cierre" value={tcCierre} onChange={e => setTcCierre(e.target.value)} />
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1">Empresa</th><th className="text-right">US$</th><th className="text-right">$ al TC de cierre</th>
            <th className="text-right">$ que costaron</th><th className="text-right">Dif. de cambio</th>
          </tr></thead>
          <tbody>{Object.entries(CUENTAS_EN_MONEDA_EXTRANJERA).filter(([, cs]) => cs.length > 0).map(([emp, cs]) => {
            const p = posicionAlCierre(cs.flatMap(c => movs[c.id] ?? []), fechaCierre, leerNumeroAR(tcCierre))
            const v = (n: number | null, falta: string) => n == null ? <span className="text-xs text-amber-700">{falta}</span> : fmt(n)
            return (
              <tr key={emp} className="border-b last:border-0 tabular-nums">
                <td className="py-1">{emp}</td>
                <td className="text-right">{fmt(p.usd)}</td>
                <td className="text-right">{v(p.pesosAlCierre, "falta el TC")}</td>
                <td className="text-right">{v(p.pesosHistoricos, `${p.sinTC} sin TC`)}</td>
                <td className={`text-right ${(p.diferenciaDeCambio ?? 0) < 0 ? "text-red-700" : ""}`}>{v(p.diferenciaDeCambio, "—")}</td>
              </tr>)
          })}</tbody>
        </table>
        <p className="mt-1 text-[11px] text-muted-foreground">Las de Cotitulares no entran: no son de una empresa. En el balance (papel 07 Bancos) va el saldo en pesos al dólar BNA del cierre.</p>
      </div>

      {/* Últimos movimientos */}
      <div className="rounded-lg border p-3">
        <h3 className="mb-2 text-sm font-semibold">Últimos movimientos</h3>
        {recientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <tbody>{recientes.map(m => {
              const p = pesosDe(m)
              return (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-1 pr-2 whitespace-nowrap">{String(m.fecha ?? "").split("-").reverse().join("/")}</td>
                  <td className="pr-2">{m.cuenta.nombre}</td>
                  <td className="pr-2">{m.descripcion}{m.por_cuenta_de ? <span className="ml-1 text-xs text-amber-700">· por cuenta de {m.por_cuenta_de}</span> : null}</td>
                  <td className={`pr-2 text-right tabular-nums ${Number(m.debitos) > 0 ? "text-red-700" : "text-green-700"}`}>
                    {simbolo(m.cuenta.moneda)} {fmt((Number(m.creditos) || 0) - (Number(m.debitos) || 0))}</td>
                  <td className="pr-2 text-right text-xs tabular-nums text-muted-foreground">{m.cuenta.moneda === "USD" ? (p == null ? "sin TC" : `$ ${fmt(p)}`) : ""}</td>
                  <td className="text-xs">{m.estado}</td>
                </tr>)
            })}</tbody>
          </table></div>)}
      </div>

      <ModalMovimientoManual abierto={cargarAbierto} cuentaId={null} onClose={() => setCargarAbierto(false)} onGuardado={cargar} />
      <ModalCambioMoneda abierto={cambioAbierto} onClose={() => setCambioAbierto(false)} onGuardado={cargar} />
    </div>
  )
}
