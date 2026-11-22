"use client"

/**
 * 🤝 LA CUENTA ENTRE SOCIOS — A-FEAT-1637 (JMS 22/11/2026: «el número va como fila en el dashboard y desde ahí debería haber un
 * acceso directo a la cuenta»). CLAUDE.md § 🧮 «la cuenta entre socios»: saldo inicial 31/12/2024 = 0, mes por mes, agrupada como en
 * el balance (retiros directos · pagos por su cuenta por agrupadora → template · Libertad un renglón · aportes), cada mes se abre
 * hasta el movimiento con su ficha completa.
 *
 * Un solo componente y un solo cálculo (`cuentaEntreSocios`, `lib/dashboard/responsable.ts`): hoy se abre desde el Dashboard
 * «Por responsable»; mañana se monta igual en Reportes (con `CuentaEntreSociosConDatos`, que lee sola).
 */
import React, { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { formatNumber } from "@/lib/format"
import { useDashboardPorResponsable } from "@/hooks/useDashboardPorResponsable"
import { CATEGORIAS_CUENTA, RAZON, SALDO_INICIAL_FECHA, type CanalDesde, type CuentaPar, type MovSocio, type NodoSocios } from "@/lib/dashboard/responsable"

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export const rotuloMes = (k: string) => `${MESES[Number(k.slice(5, 7)) - 1]}-${k.slice(2, 4)}`
const fechaAR = (iso: string) => iso ? iso.split("-").reverse().join("/") : "—"
const color = (v: number) => (v > 0 ? "text-green-700" : v < 0 ? "text-red-700" : "text-gray-400")

/** La ficha de un movimiento (§ ♻️ «la ficha completa»): fecha, canal, importe, descripción del banco, template, cuenta, códigos. */
export function FichaMovimiento({ m, importe, decimales, nivel }: { m: MovSocio; importe: number; decimales: boolean; nivel: number }) {
  return (
    <tr className="border-t border-dashed text-[11px] text-gray-600">
      <td className="py-0.5" style={{ paddingLeft: 8 + nivel * 14 }}>
        {fechaAR(m.fecha)} · <b>{m.canal}</b> (pagó {m.pagador}) · {m.descripcion}{m.detalle ? ` · ${m.detalle}` : ""}
        <span className="block text-gray-500">
          template «{m.template || "—"}» · cuenta {m.agrupadora} / {m.cuenta} · contable «{m.contable || "—"}» · interno «{m.interno || "—"}» ·
          de {m.responsable} por {RAZON[m.por]}{m.sinResolver ? " · ⚠️ interno sin resolver" : ""}
        </span>
      </td>
      <td className={`pr-2 text-right tabular-nums ${color(importe)}`}>{formatNumber(importe, decimales)}</td>
    </tr>
  )
}

function NodoCuenta({ n, decimales, nivel, camino, abiertos, alternar }: {
  n: NodoSocios; decimales: boolean; nivel: number; camino: string; abiertos: Set<string>; alternar: (k: string) => void
}) {
  const k = `${camino}/${n.nombre}`, abierto = abiertos.has(k)
  return (
    <>
      <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => alternar(k)}>
        <td className="py-0.5" style={{ paddingLeft: 8 + nivel * 14 }}><span className="mr-1 text-[10px] text-gray-400">{abierto ? "▼" : "▶"}</span>{n.nombre}</td>
        <td className={`pr-2 text-right tabular-nums ${color(n.total)}`}>{formatNumber(n.total, decimales)}</td>
      </tr>
      {abierto && n.hijos.map(h => <NodoCuenta key={h.nombre} n={h} decimales={decimales} nivel={nivel + 1} camino={k} abiertos={abiertos} alternar={alternar} />)}
      {abierto && n.movs.map((x, i) => <FichaMovimiento key={`${x.m.id}-${i}`} m={x.m} importe={x.importe} decimales={decimales} nivel={nivel + 1} />)}
    </>
  )
}

/** Desde cuándo tiene datos cada canal de la pareja (lo de antes no se sabe y se dice). */
function DesdeCuando({ desdeCanal, a, b }: { desdeCanal: CanalDesde[]; a: string; b: string }) {
  const cs = desdeCanal.filter(c => c.empresa === a || c.empresa === b)
  if (!cs.length) return null
  return (
    <p className="text-[11px] text-gray-600">
      <b>Datos desde:</b> {cs.map(c => `${c.canal} ${c.desde ? fechaAR(c.desde) : "(sin movimientos)"}`).join(" · ")}.
      {" "}Antes de esas fechas lo que pasó por ese canal no está en la base: la cuenta no lo inventa (los meses afectados llevan ⚠️).
    </p>
  )
}

export function CuentaEntreSocios({ cuentas, desdeCanal, decimales, parInicial }: {
  cuentas: CuentaPar[]; desdeCanal: CanalDesde[]; decimales: boolean; parInicial?: string
}) {
  const [par, setPar] = useState<string>(parInicial && cuentas.some(c => `${c.a}|${c.b}` === parInicial) ? parInicial : cuentas[0] ? `${cuentas[0].a}|${cuentas[0].b}` : "")
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (k: string) => setAbiertos(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const c = cuentas.find(x => `${x.a}|${x.b}` === par)
  // Sólo desde el primer mes con algo (o con datos de algún canal): los meses vacíos del principio no dicen nada.
  const meses = useMemo(() => {
    if (!c) return []
    const i = c.meses.findIndex(m => m.movimiento !== 0)
    return i < 0 ? c.meses : c.meses.slice(i)
  }, [c])
  if (!cuentas.length) return <p className="text-sm text-muted-foreground">No hay movimientos entre socios en el período.</p>
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1">
        {cuentas.map(x => (
          <button key={`${x.a}|${x.b}`} type="button" onClick={() => { setPar(`${x.a}|${x.b}`); setAbiertos(new Set()) }}
            className={`rounded-full border px-3 py-1 text-xs ${par === `${x.a}|${x.b}` ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}>
            {x.a} ↔ {x.b} <span className="ml-1 tabular-nums opacity-80">{formatNumber(x.saldoFinal, false)}</span>
          </button>
        ))}
      </div>
      {c && (
        <>
          <p className="text-xs text-gray-600">
            Saldo: <b>+ = {c.b} le debe a {c.a}</b> · − = {c.a} le debe a {c.b}. Lo que {c.a} paga o transfiere por {c.b} suma; lo que {c.b} paga por {c.a} resta
            («Aportes»). Saldo inicial al {fechaAR(SALDO_INICIAL_FECHA)}: <b>0</b> (decisión de JMS). Libertad va entera de MA en esta cuenta (el 50/50 es del balance).
          </p>
          <DesdeCuando desdeCanal={desdeCanal} a={c.a} b={c.b} />
          <div className="max-h-[60vh] overflow-auto rounded border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Mes</th>
                  {CATEGORIAS_CUENTA.map(k => <th key={k} className="px-2 py-1 text-right">{k}</th>)}
                  <th className="px-2 py-1 text-right">Movimiento del mes</th>
                  <th className="px-2 py-1 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t bg-gray-50">
                  <td className="px-2 py-1">Saldo inicial {fechaAR(SALDO_INICIAL_FECHA)}</td>
                  {CATEGORIAS_CUENTA.map(k => <td key={k} />)}<td />
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatNumber(c.saldoInicial, decimales)}</td>
                </tr>
                {meses.map(m => {
                  const abierto = abiertos.has(m.mes)
                  return (
                    <React.Fragment key={m.mes}>
                      <tr className="cursor-pointer border-t hover:bg-muted/40" onClick={() => alternar(m.mes)}>
                        <td className="px-2 py-1">
                          <span className="mr-1 text-[10px] text-gray-400">{m.movimiento !== 0 ? (abierto ? "▼" : "▶") : ""}</span>{rotuloMes(m.mes)}
                          {m.sinDatos.length > 0 && <span className="ml-1 text-amber-700" title={`Sin datos todavía: ${m.sinDatos.join(", ")}`}>⚠️</span>}
                        </td>
                        {CATEGORIAS_CUENTA.map(k => <td key={k} className={`px-2 py-1 text-right tabular-nums ${color(m.porCategoria[k])}`}>{m.porCategoria[k] ? formatNumber(m.porCategoria[k], decimales) : "-"}</td>)}
                        <td className={`px-2 py-1 text-right tabular-nums ${color(m.movimiento)}`}>{formatNumber(m.movimiento, decimales)}</td>
                        <td className="px-2 py-1 text-right font-semibold tabular-nums">{formatNumber(m.saldo, decimales)}</td>
                      </tr>
                      {abierto && (
                        <tr><td colSpan={CATEGORIAS_CUENTA.length + 3} className="bg-muted/20 px-2 pb-2">
                          {m.sinDatos.length > 0 && <p className="py-1 text-[11px] text-amber-700">⚠️ Ese mes todavía no hay datos de: {m.sinDatos.join(", ")}.</p>}
                          <table className="w-full"><tbody>
                            {m.arbol.hijos.map(h => <NodoCuenta key={h.nombre} n={h} decimales={decimales} nivel={0} camino={m.mes} abiertos={abiertos} alternar={alternar} />)}
                          </tbody></table>
                        </td></tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs">Saldo al cierre: <b className="tabular-nums">{formatNumber(c.saldoFinal, decimales)}</b> {c.saldoFinal > 0 ? `(${c.b} le debe a ${c.a})` : c.saldoFinal < 0 ? `(${c.a} le debe a ${c.b})` : ""}</p>
        </>
      )}
    </div>
  )
}

/** La misma cuenta, leyendo sola (para montarla en Reportes). */
export function CuentaEntreSociosConDatos({ año, semestre, decimales = false }: { año: number; semestre?: number; decimales?: boolean }) {
  const { datos, calculo, loading, error } = useDashboardPorResponsable(año, semestre, true)
  if (loading || !calculo || !datos) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{error ? `No se pudo leer: ${error}` : "Armando la cuenta…"}</p>
  return <CuentaEntreSocios cuentas={calculo.cuentas} desdeCanal={datos.desdeCanal} decimales={decimales} />
}
