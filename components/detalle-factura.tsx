"use client"

/**
 * 🧾 EL DETALLE DE UNA FACTURA (artículo por artículo) y su entrada al stock — A-FEAT-1651 etapa 2.
 *
 * Se abre desde la factura (Egresos → Facturas, botón 🧾). Muestra lo que dice el papel —artículo, cantidad, precio, IVA— con su
 * CONTROL (los renglones suman el neto del papel y el total es el de la factura), el link al PDF y a qué entradas al stock está
 * vinculada (JMS 26/11: «siempre precisaré que me digas el contenido y el link de la factura»).
 * Si todavía no se leyó y tiene su PDF, se lee sola al abrir (§ 📄 punto 6: lo de un origen conocido se procesa solo).
 */
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const schemaDe = (e: string) => (e === "PAM" ? "pam" : e === "MA" ? "ma" : "msa")
const fmt = (n: number | null | undefined, d = 2) => n == null ? "—" : Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d })
const dmy = (f?: string | null) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "—")
const ESTADO: Record<string, { txt: string; cls: string }> = {
  "cierra": { txt: "✓ cierra con el papel", cls: "bg-emerald-100 text-emerald-800" },
  "no-cierra": { txt: "⚠ no cierra: revisar", cls: "bg-red-100 text-red-800" },
  "sin-control": { txt: "sin control (no se leyó el neto)", cls: "bg-amber-100 text-amber-800" },
  "sin-renglones": { txt: "no se pudieron leer los renglones", cls: "bg-amber-100 text-amber-800" },
  "sin-pdf": { txt: "sin PDF archivado", cls: "bg-gray-100 text-gray-700" },
  "sin-texto": { txt: "PDF sin texto (foto o escaneo)", cls: "bg-gray-100 text-gray-700" },
}

export function DetalleFactura({ empresa = "MSA", facturaId, onCerrar }: { empresa?: string; facturaId: string | null; onCerrar: () => void }) {
  const [f, setF] = useState<any>(null)
  const [lectura, setLectura] = useState<any>(null)
  const [renglones, setRenglones] = useState<any[]>([])
  const [entregas, setEntregas] = useState<any[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!facturaId) return
    const [{ data: fa }, { data: le }, { data: re }, { data: en }] = await Promise.all([
      supabase.schema(schemaDe(empresa) as any).from("comprobantes_arca")
        .select("id, fecha_emision, tipo_comprobante, punto_venta, numero_desde, denominacion_emisor, cuit, imp_neto_gravado, imp_total, moneda, tipo_cambio, cuenta_contable, nro_cuenta, detalle, estado, pdf_drive_url")
        .eq("id", facturaId).maybeSingle(),
      supabase.from("factura_lecturas").select("*").eq("empresa", empresa).eq("comprobante_id", facturaId).maybeSingle(),
      supabase.from("factura_renglones").select("*").eq("empresa", empresa).eq("comprobante_id", facturaId).order("n"),
      supabase.schema("productivo").from("entrega_factura")
        .select("cantidad, precio_unitario, movimiento:movimientos_insumos(fecha, cantidad, stock_insumos(producto, unidad_medida))").eq("factura_id", facturaId),
    ])
    setF(fa); setLectura(le); setRenglones((re || []) as any[]); setEntregas((en || []) as any[])
    return { fa, le }
  }, [empresa, facturaId])

  const leer = useCallback(async () => {
    if (!facturaId) return
    setLeyendo(true); setAviso(null)
    try {
      const r = await fetch("/api/facturas/leer-detalle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresa, comprobante_id: facturaId }) })
      const j = await r.json().catch(() => ({}))
      if (!j.ok) setAviso(j.error || "No se pudo leer el detalle.")
    } catch (e) { setAviso("No se pudo leer el detalle: " + (e as Error).message) }
    finally { setLeyendo(false); await cargar() }
  }, [empresa, facturaId, cargar])

  useEffect(() => {
    if (!facturaId) { setF(null); setLectura(null); setRenglones([]); setEntregas([]); return }
    void (async () => {
      const r = await cargar()
      // Lo de un proveedor conocido se procesa solo: si nunca se leyó y tiene su PDF, se lee al abrir.
      if (r && !r.le && r.fa?.pdf_drive_url) void leer()
    })()
  }, [facturaId, cargar, leer])

  if (!facturaId) return null
  const est = lectura ? (ESTADO[lectura.estado] ?? { txt: lectura.estado, cls: "bg-gray-100" }) : null
  const usd = f && f.moneda && !["$", "PES", "ARS"].includes(String(f.moneda))
  return (
    <Dialog open onOpenChange={o => { if (!o) onCerrar() }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>🧾 {f ? `${f.denominacion_emisor} · ${String(f.punto_venta ?? "").padStart(4, "0")}-${String(f.numero_desde ?? "").padStart(8, "0")}` : "Factura"}</DialogTitle>
          <DialogDescription>Lo que dice el papel, renglón por renglón, con su control. Se guarda una vez: la próxima vez se muestra sin leer de nuevo.</DialogDescription>
        </DialogHeader>
        {f && (
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            <div><span className="text-gray-500">Fecha:</span> {dmy(f.fecha_emision)} · <span className="text-gray-500">CUIT:</span> {f.cuit}</div>
            <div><span className="text-gray-500">Neto:</span> {usd ? "US$ " : "$ "}{fmt(f.imp_neto_gravado)} · <span className="text-gray-500">Total:</span> {usd ? "US$ " : "$ "}{fmt(f.imp_total)}{usd && f.tipo_cambio ? ` · TC ${fmt(f.tipo_cambio)}` : ""}</div>
            <div><span className="text-gray-500">Cuenta:</span> {f.cuenta_contable || "—"}{f.nro_cuenta ? ` (${f.nro_cuenta})` : ""} · <span className="text-gray-500">Estado:</span> {f.estado}</div>
            <div>{f.pdf_drive_url ? <a className="text-sky-700 underline" href={f.pdf_drive_url} target="_blank" rel="noopener noreferrer">📎 Abrir el PDF</a> : <span className="text-gray-500">Sin PDF archivado</span>}</div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {est && <span className={`rounded px-2 py-0.5 ${est.cls}`}>{est.txt}</span>}
          {lectura?.leido_at && <span className="text-gray-500">leída {dmy(lectura.leido_at)}{lectura.formato ? ` · formato ${lectura.formato}` : ""}</span>}
          <Button variant="outline" size="sm" className="h-6 text-xs" disabled={leyendo || !f?.pdf_drive_url} onClick={() => void leer()}>
            {leyendo ? "Leyendo el PDF…" : lectura ? "Volver a leer" : "Leer el detalle"}
          </Button>
        </div>
        {aviso && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{aviso}</p>}
        {(lectura?.mensajes || []).length > 0 && <ul className="list-disc pl-5 text-xs text-amber-900">{(lectura.mensajes as string[]).map((m, i) => <li key={i}>{m}</li>)}</ul>}
        {renglones.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b text-gray-500">
                <th className="py-1 text-left font-medium">#</th><th className="text-left font-medium">Artículo</th>
                <th className="text-right font-medium">Cantidad</th><th className="text-left font-medium">Unidad</th>
                <th className="text-right font-medium">Precio unit.</th><th className="text-right font-medium">Neto</th>
                <th className="text-right font-medium">IVA %</th><th className="text-right font-medium">Con IVA</th>
              </tr></thead>
              <tbody>
                {renglones.map(r => (
                  <tr key={r.id} className="border-b align-top">
                    <td className="py-1">{r.n}</td>
                    <td>{r.descripcion}{r.codigo ? <span className="ml-1 text-gray-400">({r.codigo})</span> : null}
                      {(r.avisos || []).length > 0 && <span className="block text-[10px] text-amber-700">{(r.avisos as string[]).join(" · ")}</span>}</td>
                    <td className="text-right tabular-nums">{fmt(r.cantidad, 2)}</td><td>{r.unidad || ""}</td>
                    <td className="text-right tabular-nums">{fmt(r.precio_unitario)}</td><td className="text-right tabular-nums">{fmt(r.neto)}</td>
                    <td className="text-right tabular-nums">{r.alicuota_iva == null ? "—" : fmt(r.alicuota_iva, 1)}</td><td className="text-right tabular-nums">{fmt(r.total_con_iva)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td colSpan={5} className="py-1 text-right text-gray-600">Suma de renglones / neto del papel</td>
                  <td className="text-right tabular-nums">{fmt(lectura?.suma_renglones)}</td>
                  <td colSpan={2} className="text-right tabular-nums text-gray-600">{fmt(lectura?.neto_pie)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded border border-dashed p-2 text-xs">
          <p className="font-medium">Entrada al stock</p>
          {entregas.length === 0
            ? <p className="text-red-700">Esta factura no está vinculada a ninguna entrada al stock.</p>
            : <ul className="list-disc pl-5">{entregas.map((e, i) => <li key={i}>{dmy(e.movimiento?.fecha)} · {e.movimiento?.stock_insumos?.producto} · {fmt(e.cantidad, 0)} {e.movimiento?.stock_insumos?.unidad_medida || ""}{e.precio_unitario != null ? ` a $ ${fmt(e.precio_unitario)}` : ""}</li>)}</ul>}
        </div>
        <div className="flex justify-end"><Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  )
}
