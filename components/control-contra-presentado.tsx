"use client"

/**
 * 📥 Subdiarios → «Lo que devolvió el contador»: se sube el zip del libro IVA que exporta ARCA y la app lo compara
 * contra el subdiario del mes (A-AUTO-09, paso 1). Todavía no se guarda: se lee y se muestra en el momento.
 * La lógica vive en `lib/subdiarios/libro-presentado.ts`.
 */
import { useState } from "react"
import { CheckCircle2, AlertTriangle, Upload } from "lucide-react"
import {
  leerZipLibroIva, compararSubdiarioConLibro,
  type FacturaParaComparar, type ResultadoContraPresentado, type TotalesPresentados,
} from "@/lib/subdiarios/libro-presentado"
import { TIPOS_SIN_CREDITO_COMPRAS } from "@/lib/subdiarios/cuadratura"
import { BotonRevision } from "@/components/boton-revision"

const $ = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ControlContraPresentado({ facturas, periodo, schemaName }: {
  facturas: FacturaParaComparar[]; periodo: string; schemaName: string
}) {
  const [res, setRes] = useState<{ r: ResultadoContraPresentado; totales: TotalesPresentados | null; archivo: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mm, aaaa] = periodo.split("/")

  const leer = async (f: File | undefined) => {
    setError(null); setRes(null)
    if (!f) return
    try {
      const z = await leerZipLibroIva(await f.arrayBuffer())
      if (!z.compras.length && !z.totales) { setError("Ese archivo no parece el zip del libro IVA de ARCA (no trae libro_iva.xml ni comprobantes_compras.csv)."); return }
      if (z.totales?.periodo && z.totales.periodo !== `${aaaa}${mm}`) {
        setError(`El zip es del período ${z.totales.periodo.slice(4)}/${z.totales.periodo.slice(0, 4)} y estás en ${periodo}. Abrí ese mes o subí el zip de este.`); return
      }
      setRes({ r: compararSubdiarioConLibro(facturas, z.compras, TIPOS_SIN_CREDITO_COMPRAS), totales: z.totales, archivo: f.name })
    } catch (e) {
      setError("No se pudo leer el zip: " + (e as Error).message)
    }
  }

  const resumen = res && !res.r.ok
    ? `Subdiario ${periodo} contra lo presentado a ARCA: ${res.r.soloApp.length} en la app y no presentadas, ${res.r.soloPresentado.length} presentadas y no en la app, ${res.r.importeDistinto.length} con otro importe · diferencia total ${$(res.r.totales.diferencia.total)} · crédito fiscal ${$(res.r.totales.diferencia.creditoFiscal)}`
    : ""

  return (
    <div className="rounded border p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">📥 Lo que devolvió el contador — ¿coincide con este subdiario?</span>
        {/* Un <label> (no un <button>) para que también ande en sólo lectura: sólo LEE el archivo, no guarda nada. */}
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-blue-400 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">
          <Upload className="h-3.5 w-3.5" /> Subir el zip del libro IVA (ARCA)
          <input type="file" accept=".zip" className="hidden" onChange={e => { void leer(e.target.files?.[0]); e.target.value = "" }} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        El que exporta ARCA al presentar: <code>libro_iva_periodo_{aaaa}{mm}_original.zip</code>. Trae los totales de la DDJJ y cada
        comprobante declarado. Se compara al subirlo; todavía no queda guardado.
      </p>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {res && (
        <div className="space-y-2">
          <p className={`flex items-center gap-1 font-medium ${res.r.ok ? "text-green-700" : "text-red-700"}`}>
            {res.r.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {res.r.ok ? "Coincide: lo presentado es igual al subdiario de la app." : "No coincide con lo presentado."}
            {!res.r.ok && (
              <BotonRevision schema={schemaName} tabla="subdiario" registroId={`presentado-${aaaa}-${mm}`} descripcion={resumen} />
            )}
          </p>
          <table className="text-xs">
            <thead><tr className="text-muted-foreground"><th className="pr-4 text-left" /><th className="pr-4 text-right">Comprobantes</th><th className="pr-4 text-right">Importe total</th><th className="text-right">Crédito fiscal</th></tr></thead>
            <tbody>
              <tr><td className="pr-4">Subdiario de la app</td><td className="pr-4 text-right tabular-nums">{res.r.totales.app.comprobantes}</td><td className="pr-4 text-right tabular-nums">{$(res.r.totales.app.total)}</td><td className="text-right tabular-nums">{$(res.r.totales.app.creditoFiscal)}</td></tr>
              <tr><td className="pr-4">Presentado (contador)</td><td className="pr-4 text-right tabular-nums">{res.r.totales.presentado.comprobantes}</td><td className="pr-4 text-right tabular-nums">{$(res.r.totales.presentado.total)}</td><td className="text-right tabular-nums">{$(res.r.totales.presentado.creditoFiscal)}</td></tr>
              <tr className="font-semibold"><td className="pr-4">Diferencia</td><td className="pr-4 text-right tabular-nums">{res.r.totales.diferencia.comprobantes}</td><td className="pr-4 text-right tabular-nums">{$(res.r.totales.diferencia.total)}</td><td className="text-right tabular-nums">{$(res.r.totales.diferencia.creditoFiscal)}</td></tr>
            </tbody>
          </table>
          {res.totales && Math.abs(res.totales.creditoFiscal - res.r.totales.presentado.creditoFiscal) > 0.05 && (
            <p className="text-xs text-amber-700">⚠️ El total de la DDJJ ({$(res.totales.creditoFiscal)}) no es la suma de los comprobantes del mismo zip ({$(res.r.totales.presentado.creditoFiscal)}).</p>
          )}
          {res.r.soloApp.length > 0 && (
            <div><p className="font-medium">En la app y NO presentadas ({res.r.soloApp.length})</p>
              <ul className="ml-4 list-disc text-xs">{res.r.soloApp.map(f => <li key={f.id}>{f.denominacion_emisor} · {f.punto_venta}-{f.numero_desde} · {f.fecha_emision?.slice(0, 10).split("-").reverse().join("/")} · {$(Number(f.imp_total) * (Number(f.tipo_cambio) || 1))}</li>)}</ul></div>
          )}
          {res.r.soloPresentado.length > 0 && (
            <div><p className="font-medium">Presentadas y NO en la app ({res.r.soloPresentado.length})</p>
              <ul className="ml-4 list-disc text-xs">{res.r.soloPresentado.map((p, i) => <li key={i}>{p.denominacion} · {p.puntoVenta}-{p.numero} · {p.fecha.split("-").reverse().join("/")} · {$(p.total)}</li>)}</ul></div>
          )}
          {res.r.importeDistinto.length > 0 && (
            <div><p className="font-medium">Con otro importe ({res.r.importeDistinto.length})</p>
              <ul className="ml-4 list-disc text-xs">{res.r.importeDistinto.map((d, i) => <li key={i}>{d.presentado.denominacion} · {d.presentado.puntoVenta}-{d.presentado.numero} · app {$(Number(d.app.imp_total) * (Number(d.app.tipo_cambio) || 1))} · presentado {$(d.presentado.total)} · dif {$(d.diferencia)}</li>)}</ul></div>
          )}
          {!res.r.ok && <p className="text-xs text-muted-foreground">🚩 al lado del resultado: pasáselo a alguien (Ulises) con un mensaje.</p>}
        </div>
      )}
    </div>
  )
}
