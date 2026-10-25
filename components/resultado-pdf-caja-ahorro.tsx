"use client"

/**
 * 📄 Lo que mostró el resumen PDF de caja de ahorro al importarlo — A-FEAT-1352.
 *
 * Tres cosas, en este orden: **si el resumen cierra** (el control que frena), **qué se completó o se
 * supuso** al convertirlo al formato del Excel (la huella de la adaptación), y —en «Ver cómo queda»—
 * cada movimiento con el grupo que le dan las reglas de siempre, para ver antes de guardar cuáles no
 * se van a desglosar.
 */

import { Fragment, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle } from "lucide-react"

const $ = (n: number | null | undefined) =>
  n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dia = (iso: string | null | undefined) => (iso ? iso.split("-").reverse().join("/") : "—")

/** Grupos que dicen «las reglas no lo desglosaron». */
const SIN_DESGLOSE = new Set(["Subtipo nuevo", "Otros", "Reglas en conflicto"])

const NOMBRE_CAMBIO: Record<string, string> = {
  tarjeta: "tarjeta enmascarada",
  orden_tarjeta: "tarjeta al final",
  origen: "origen como última línea",
  origen_supuesto: "origen con letra supuesta",
  cbu_completado: "CBU completado",
  cbu_incompleto: "CBU cortado (20 dígitos)",
  nombre_completado: "nombre completado",
}

export function ResultadoPdfCajaAhorro({ pdf, filas }: { pdf: any; filas?: any[] }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  if (!pdf) return null
  const r = pdf.resumen ?? {}
  const c = pdf.cambios ?? {}
  const ok = pdf.control?.ok && pdf.titularOk

  return (
    <div className="space-y-3 text-sm">
      {/* 1 · ¿El resumen cierra contra sí mismo? */}
      <Alert variant={ok ? "default" : "destructive"}>
        {ok ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <AlertDescription>
          <div className="space-y-1">
            <div className="font-semibold">
              {ok ? "✓ El resumen PDF cierra" : "⚠ El resumen PDF NO cierra — revisá antes de importar"}
            </div>
            <div className="text-xs text-muted-foreground">
              Período {dia(r.desde)} al {dia(r.hasta)} · cuenta {r.numeroCuenta ?? "—"} · {r.movimientos ?? 0} movimientos ·
              saldo inicial ${$(r.saldoInicial)} → final ${$(r.saldoFinal)}
            </div>
            <div className={pdf.titularOk ? "" : "text-red-700 font-medium"}>
              {pdf.titularOk ? "✓" : "✗"} Titular del resumen: CUIT {r.cuitTitular ?? "(no se leyó)"}
              {!pdf.titularOk && ` — la cuenta elegida es del ${r.cuitEsperado}`}
            </div>
            {(pdf.control?.renglones ?? []).map((x: any) => (
              <div key={x.que} className={x.ok ? "" : "text-red-700 font-medium"}>
                {x.ok ? "✓" : "✗"} {x.que}: según el resumen ${$(x.segunResumen)} · leído ${$(x.leido)}
              </div>
            ))}
            {pdf.control?.cadenaRota?.length > 0 && (
              <div className="text-red-700">
                ✗ El saldo no sigue en {pdf.control.cadenaRota.length} movimiento(s):{" "}
                {pdf.control.cadenaRota.slice(0, 5).map((x: any) => `${dia(x.fecha)} ${x.tipo} (esperado ${$(x.esperado)}, impreso ${$(x.impreso)})`).join(" · ")}
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* 2 · Qué se adaptó al formato del Excel */}
      <Alert>
        <AlertDescription>
          <div className="space-y-1">
            <div className="font-semibold">Cómo se pasó al formato del Excel del banco</div>
            <div className="text-xs text-muted-foreground">
              {c.tarjetas ?? 0} tarjeta(s) enmascaradas como en el Excel; el «origen» va como última línea.
            </div>
            {c.nombresCompletados?.length > 0 && (
              <details>
                <summary className="cursor-pointer">✏️ {c.nombresCompletados.length} nombre(s) que el PDF corta a 20 letras, completados con los extractos anteriores</summary>
                <ul className="text-xs ml-4 list-disc">
                  {[...new Map(c.nombresCompletados.map((x: any) => [x.de, x])).values()].map((x: any) => (
                    <li key={x.de}>«{x.de}» → «{x.a}»</li>
                  ))}
                </ul>
              </details>
            )}
            {c.cbuCompletados?.length > 0 && (
              <details>
                <summary className="cursor-pointer">✏️ {c.cbuCompletados.length} CBU que el PDF corta a 20 dígitos, completados (extractos anteriores o ficha del proveedor)</summary>
                <ul className="text-xs ml-4 list-disc font-mono">
                  {[...new Map(c.cbuCompletados.map((x: any) => [x.de, x])).values()].map((x: any) => <li key={x.de}>{x.de} → {x.a}</li>)}
                </ul>
              </details>
            )}
            {c.cbuIncompletos?.length > 0 && (
              <details>
                <summary className="cursor-pointer text-amber-700">⚠ {c.cbuIncompletos.length} CBU quedan cortados (20 de 22 dígitos): no había con qué completarlos. Se desglosan igual; la conciliación va por CUIT.</summary>
                <ul className="text-xs ml-4 list-disc font-mono">
                  {[...new Set<string>(c.cbuIncompletos)].map(x => <li key={x}>{x}</li>)}
                </ul>
              </details>
            )}
            {c.origenSupuesto?.length > 0 && (
              <div className="text-amber-700">
                ⚠ En {c.origenSupuesto.length} movimiento(s) la letra del origen se supuso (ese tipo nunca vino con origen en esta cuenta):{" "}
                {[...new Set(c.origenSupuesto.map((x: any) => `${x.de}→${x.a}`))].join(", ")}
              </div>
            )}
            {pdf.avisos?.length > 0 && (
              <div className="text-amber-700">
                ⚠ Lo que no se pudo leer bien: {pdf.avisos.join(" · ")}
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* 3 · Vista previa, movimiento por movimiento */}
      {filas && filas.length > 0 && (
        <div className="border rounded max-h-[28rem] overflow-y-auto">
          <div className="px-2 py-1 text-xs text-muted-foreground border-b bg-gray-50">
            {filas.filter(f => SIN_DESGLOSE.has(f.grupo)).length} de {filas.length} no los desglosan las reglas (en rojo).
            Tocá un renglón para ver qué decía el PDF y cómo queda.
          </div>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left border-b">
                <th className="p-1">Fecha</th><th className="p-1">Movimiento</th><th className="p-1">Grupo</th>
                <th className="p-1 text-right">Débito</th><th className="p-1 text-right">Crédito</th><th className="p-1 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <Fragment key={i}>
                  <tr className={`border-b cursor-pointer hover:bg-gray-50 ${SIN_DESGLOSE.has(f.grupo) ? "bg-red-50" : ""}`}
                    onClick={() => setAbierta(abierta === i ? null : i)}>
                    <td className="p-1 whitespace-nowrap">{dia(f.fecha)}</td>
                    <td className="p-1">{f.descripcion}{f.nombre ? ` · ${f.nombre}` : ""}{f.cambios?.some((x: any) => x.tipo === "cbu_incompleto" || x.tipo === "origen_supuesto") ? " ⚠" : ""}</td>
                    <td className={`p-1 ${SIN_DESGLOSE.has(f.grupo) ? "text-red-700 font-medium" : ""}`}>{f.grupo}</td>
                    <td className="p-1 text-right">{f.debitos ? $(f.debitos) : ""}</td>
                    <td className="p-1 text-right">{f.creditos ? $(f.creditos) : ""}</td>
                    <td className="p-1 text-right">{$(f.saldo)}</td>
                  </tr>
                  {abierta === i && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="p-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div><div className="font-semibold">Decía el PDF</div><pre className="whitespace-pre-wrap">{(f.pdf ?? []).join("\n")}</pre></div>
                          <div><div className="font-semibold">Queda como en el Excel</div><pre className="whitespace-pre-wrap">{String(f.concepto ?? "").replace(/\r\n /g, "\n")}</pre></div>
                        </div>
                        {f.cambios?.length > 0 && (
                          <div className="mt-1 text-muted-foreground">
                            Cambios: {f.cambios.map((x: any) => `${NOMBRE_CAMBIO[x.tipo] ?? x.tipo}${x.tipo === "orden_tarjeta" ? "" : ` (${x.de} → ${x.a})`}`).join(" · ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
