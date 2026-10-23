"use client"

/**
 * 📤 ARCHIVOS PARA ARCA — el Libro IVA Compras del mes como archivo de texto (A-FEAT-1286).
 *
 * Tercer botón del subdiario de Compras, al lado de Excel y PDF. Toma **lo imputado al mes** (el
 * mismo conjunto que el PDF y el Excel) y arma los dos archivos que importa IVA Simple, en dos
 * versiones para probar cuál acepta el portal: **A** (registro de 2023) y **B** (con el campo
 * TurIVA del diseño 2025). La lógica vive en `lib/subdiarios/libro-iva-arca.ts`.
 *
 * El control se muestra ANTES de descargar: lo que dice el archivo releído contra lo que dice el
 * subdiario. Si no da, es un error de la app y **no deja descargar** (§ 🚦 integridad). Los
 * comprobantes raros se listan y **no frenan** (§ 🚦 discrepancia).
 */

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TestsDelProceso } from "@/components/tests-del-proceso"
import { supabase } from "@/lib/supabase"
import { DATOS_FISCALES } from "@/lib/empresas"
import {
  armarLibroComprasArca, controlarArchivo, contenidoArchivo, aBytesAnsi,
  type ArchivoArca, type ControlArchivo, type FilaCompraArca, type VersionArchivo,
} from "@/lib/subdiarios/libro-iva-arca"
import { elegirCarpetaDestino, generarNombreUnico, guardarEnCarpeta } from "@/lib/subdiarios/carpeta-destino"

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** `MM/AAAA`, como el selector de período del subdiario. */
  periodo: string
  schemaName: string
  carpetaPorDefecto: any
  setCarpetaPorDefecto: (c: any) => void
}

interface Version { archivo: ArchivoArca; control: ControlArchivo }

const fmt = (n: number) => n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ModalArchivosArca({ abierto, onCerrar, periodo, schemaName, carpetaPorDefecto, setCarpetaPorDefecto }: Props) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaCompraArca[]>([])
  const [versiones, setVersiones] = useState<Record<VersionArchivo, Version> | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const [mes, año] = periodo.split("/")
  const sufijo = `${(año ?? "").slice(-2)}-${(mes ?? "").padStart(2, "0")}`

  useEffect(() => {
    if (!abierto || !periodo) return
    let vivo = true
    setCargando(true); setError(null); setResultado(null); setVersiones(null)
    ;(async () => {
      const { data, error } = await supabase
        .schema(schemaName)
        .from("comprobantes_arca")
        .select("*")
        .eq("año_contable", parseInt(año))
        .eq("mes_contable", parseInt(mes))
        // Orden estable: el archivo sale igual cada vez que se genera.
        .order("fecha_emision", { ascending: true })
        .order("tipo_comprobante", { ascending: true })
        .order("punto_venta", { ascending: true })
        .order("numero_desde", { ascending: true })
      if (!vivo) return
      if (error) { setError(error.message); setCargando(false); return }
      const lista = (data ?? []) as FilaCompraArca[]
      const informante = { cuit: DATOS_FISCALES.MSA.cuit ?? "", razonSocial: DATOS_FISCALES.MSA.razonSocial }
      const armar = (v: VersionArchivo): Version => {
        const archivo = armarLibroComprasArca(lista, v, informante)
        return { archivo, control: controlarArchivo(lista, archivo, v) }
      }
      setFilas(lista)
      setVersiones({ A: armar("A"), B: armar("B") })
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [abierto, periodo, schemaName, mes, año])

  const controlOk = !!versiones && versiones.A.control.ok && versiones.B.control.ok
  const avisos = versiones?.A.archivo.avisos ?? []

  const descargar = async () => {
    if (!versiones || !controlOk) return
    setGuardando(true)
    try {
      const destino = await elegirCarpetaDestino(carpetaPorDefecto, setCarpetaPorDefecto)
      if (destino.cancelado) { setResultado("Descarga cancelada."); return }
      const archivos: { nombre: string; contenido: string }[] = []
      for (const v of ["A", "B"] as VersionArchivo[]) {
        archivos.push({ nombre: `ARCA COMPRAS ${sufijo} ${v} - COMPROBANTES`, contenido: contenidoArchivo(versiones[v].archivo.cbte) })
        archivos.push({ nombre: `ARCA COMPRAS ${sufijo} ${v} - ALICUOTAS`, contenido: contenidoArchivo(versiones[v].archivo.alicuotas) })
      }
      for (const a of archivos) {
        const bytes = aBytesAnsi(a.contenido)
        if (destino.directorio) {
          const nombre = await generarNombreUnico(destino.directorio, a.nombre, "txt")
          await guardarEnCarpeta(destino.directorio, nombre, bytes)
        } else {
          const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "text/plain" }))
          const link = document.createElement("a")
          link.href = url
          link.download = `${a.nombre}.txt`
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(url)
        }
      }
      setResultado(`4 archivos guardados en ${destino.ubicacion || "la carpeta Descargas"}.`)
    } catch (e) {
      setResultado("No se pudieron guardar los archivos: " + (e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📤 Archivos para ARCA — Libro IVA Compras {periodo}</DialogTitle>
          <DialogDescription>
            Lo imputado a este mes en el subdiario, en los dos archivos que importa IVA Simple
            (comprobantes y alícuotas). Sale en dos versiones para probar cuál acepta el portal.
          </DialogDescription>
        </DialogHeader>

        <TestsDelProceso proceso="subdiarios/compras-arca" pantalla="subdiarios" />

        {cargando && <p className="text-sm text-muted-foreground">Armando los archivos…</p>}
        {error && <p className="text-sm text-red-700">No se pudieron leer las facturas del mes: {error}</p>}

        {versiones && !cargando && (
          <div className="flex flex-col gap-4">
            {filas.length === 0 ? (
              <p className="text-sm">No hay facturas imputadas a {periodo}.</p>
            ) : (
              <>
                {/* El control: el archivo releído contra el subdiario */}
                <div>
                  <div className={`text-sm font-semibold mb-1 ${controlOk ? "text-green-700" : "text-red-700"}`}>
                    {controlOk
                      ? "✓ El archivo dice lo mismo que el subdiario"
                      : "🛑 El archivo NO coincide con el subdiario — es un error de la app, no se puede descargar"}
                  </div>
                  <div className="overflow-x-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Concepto</th>
                          <th className="text-right p-2">Subdiario</th>
                          <th className="text-right p-2">Archivo</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {versiones.A.control.renglones.map(r => (
                          <tr key={r.concepto} className="border-t">
                            <td className="p-2">{r.concepto}</td>
                            <td className="p-2 text-right tabular-nums">{r.concepto === "Comprobantes" ? r.subdiario : fmt(r.subdiario)}</td>
                            <td className="p-2 text-right tabular-nums">{r.concepto === "Comprobantes" ? r.archivo : fmt(r.archivo)}</td>
                            <td className="p-2 text-center">{r.ok ? "✓" : "✗"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las notas de crédito restan, como en el subdiario (en el archivo van en positivo porque el tipo ya dice que restan).
                    Los importes en dólares se suman en dólares.
                  </p>
                  {[...versiones.A.control.problemas, ...versiones.B.control.problemas].map((p, i) => (
                    <p key={i} className="text-sm text-red-700">• {p}</p>
                  ))}
                </div>

                {/* Avisos: no frenan */}
                {avisos.length > 0 && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-3">
                    <div className="text-sm font-semibold text-amber-800 mb-1">
                      ⚠️ {avisos.length} comprobante{avisos.length === 1 ? "" : "s"} para mirar — salen igual en el archivo
                    </div>
                    <ul className="text-sm text-amber-900 space-y-0.5">
                      {avisos.map((a, i) => (
                        <li key={i}><span className="font-mono">{a.comprobante}</span> {a.nombre}: {a.motivo}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Qué se descarga */}
                <div className="text-sm space-y-1">
                  <div className="font-semibold">Se descargan 4 archivos:</div>
                  <div><b>Versión A</b> (formato 2023): <span className="font-mono">ARCA COMPRAS {sufijo} A - COMPROBANTES.txt</span> y <span className="font-mono">… A - ALICUOTAS.txt</span></div>
                  <div><b>Versión B</b> (con el campo TurIVA nuevo): <span className="font-mono">ARCA COMPRAS {sufijo} B - COMPROBANTES.txt</span> y <span className="font-mono">… B - ALICUOTAS.txt</span></div>
                  <div className="text-muted-foreground">
                    {versiones.A.archivo.cbte.length} comprobantes · {versiones.A.archivo.alicuotas.length} renglones de alícuota.
                    En IVA Simple → Libro Compras → importar, elegí <b>«los importes están expresados en la moneda original del comprobante»</b>.
                    Probá primero la A; si el portal se queja del largo de los renglones, la B.
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button onClick={descargar} disabled={!controlOk || guardando}>
                    {guardando ? "Guardando…" : "📥 Descargar A y B"}
                  </Button>
                  {resultado && <span className="text-sm">{resultado}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
