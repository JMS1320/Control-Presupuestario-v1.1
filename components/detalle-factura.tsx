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
type EstadoStock = { propuestas: any[]; vinculos: any[]; entradas: any[]; insumos: any[] }
type Eleccion = Record<number, { insumo?: string; entrada?: string }>
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
  /** ✨ La entrada al stock de cada renglón (A-FEAT-1663 stock paso 1): propuestas, vínculos y entradas posibles. */
  const [stock, setStock] = useState<EstadoStock | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [eleccion, setEleccion] = useState<Record<number, { insumo?: string; entrada?: string }>>({})

  const accionStock = useCallback(async (accion: string, extra: Record<string, unknown> = {}) => {
    if (!facturaId) return
    setOcupado(true)
    try {
      const r = await fetch("/api/facturas/vincular-stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empresa, comprobante_id: facturaId, accion, ...extra }) })
      const j = await r.json().catch(() => ({}))
      if (!j.ok) { setAviso(j.error || "No se pudo vincular con el stock."); return }
      setStock({ propuestas: j.propuestas || [], vinculos: j.vinculos || [], entradas: j.entradas || [], insumos: j.insumos || [] })
      if (accion !== "ver" && accion !== "auto") setEleccion({})
    } catch (e) { setAviso("No se pudo vincular con el stock: " + (e as Error).message) }
    finally { setOcupado(false) }
  }, [empresa, facturaId])

  const cargar = useCallback(async () => {
    if (!facturaId) return
    const [{ data: fa }, { data: le }, { data: re }, { data: en }] = await Promise.all([
      supabase.schema(schemaDe(empresa) as any).from("comprobantes_arca")
        .select("id, fecha_emision, tipo_comprobante, punto_venta, numero_desde, denominacion_emisor, cuit, imp_neto_gravado, imp_total, moneda, tipo_cambio, cuenta_contable, nro_cuenta, detalle, estado, pdf_drive_url")
        .eq("id", facturaId).maybeSingle(),
      supabase.from("factura_lecturas").select("*").eq("empresa", empresa).eq("comprobante_id", facturaId).maybeSingle(),
      supabase.from("factura_renglones").select("*").eq("empresa", empresa).eq("comprobante_id", facturaId).order("n"),
      supabase.schema("productivo").from("entrega_factura")
        .select("cantidad, precio_unitario, renglon_n, movimiento:movimientos_insumos(fecha, cantidad, stock_insumos(producto, unidad_medida))").eq("factura_id", facturaId),
    ])
    setF(fa); setLectura(le); setRenglones((re || []) as any[]); setEntregas((en || []) as any[])
    // Lo de un origen conocido se procesa solo (§ 📄 punto 6): con el detalle leído, se vinculan solos los renglones inequívocos.
    if (le && (re || []).length) void accionStock("auto")
    return { fa, le }
  }, [empresa, facturaId, accionStock])

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
    if (!facturaId) { setF(null); setLectura(null); setRenglones([]); setEntregas([]); setStock(null); setEleccion({}); return }
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
        <BloqueStock renglones={renglones} entregas={entregas} stock={stock} ocupado={ocupado} eleccion={eleccion} setEleccion={setEleccion} accion={accionStock} />
        <div className="flex justify-end"><Button variant="outline" size="sm" onClick={onCerrar}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * ✨ La entrada al stock, renglón por renglón. Cuatro estados por renglón:
 *  · vinculado — con su entrada; si lo hizo la app sola, «✨ vinculada sola — revisá» con la huella y «Está bien» / «No es ésta»;
 *  · propuesta — la entrada que más encaja, por qué no se vinculó sola y «Vincular»;
 *  · sin entrada — «＋ Cargar la entrada» con los kilos y el precio de la factura;
 *  · sin insumo — elegir qué insumo del stock es (se aprende para la próxima).
 */
function BloqueStock({ renglones, entregas, stock, ocupado, eleccion, setEleccion, accion }: {
  renglones: any[]; entregas: any[]; stock: EstadoStock | null; ocupado: boolean; eleccion: Eleccion
  setEleccion: (f: (e: Eleccion) => Eleccion) => void
  accion: (a: string, extra?: Record<string, unknown>) => Promise<void>
}) {
  const insumo = (id: string | null | undefined) => stock?.insumos.find((i: any) => i.id === id)
  const nombre = (id: string | null | undefined) => insumo(id)?.producto ?? "—"
  const uni = (id: string | null | undefined) => insumo(id)?.unidad_medida ?? ""
  const elegir = (n: number, k: "insumo" | "entrada", v: string) => setEleccion(e => ({ ...e, [n]: { ...e[n], [k]: v } }))
  const deEsteRenglon = (r: any) => (stock?.vinculos || []).filter((v: any) => v.renglon_n === r.n ||
    (v.renglon_n == null && r.insumo_stock_id && v.movimiento?.insumo_stock_id === r.insumo_stock_id))
  const sueltos = (stock?.vinculos || []).filter((v: any) => !renglones.some(r => deEsteRenglon(r).includes(v)))
  const fichaVinculo = (v: any) => {
    const solo = v.automatico && !v.revisado_at
    return (
      <div key={v.id} className={`mt-0.5 rounded px-2 py-1 ${solo ? "border border-violet-300 bg-violet-50" : "bg-emerald-50"}`}>
        {solo ? <span className="mr-1 rounded bg-violet-200 px-1.5 py-0.5 font-medium text-violet-900">✨ vinculada sola — revisá</span>
          : <span className="mr-1 text-emerald-800">✓</span>}
        entrada del {dmy(v.movimiento?.fecha)} · {v.movimiento?.stock_insumos?.producto} · {fmt(v.cantidad, 0)} {v.movimiento?.stock_insumos?.unidad_medida || ""}{v.precio_unitario != null ? ` a $ ${fmt(v.precio_unitario)}` : ""}
        {v.automatico && v.revisado_at && <span className="ml-1 text-gray-500">(✨ vinculada sola · revisada {dmy(v.revisado_at)})</span>}
        {v.notas && <span className="block text-[11px] text-gray-600">{v.notas}</span>}
        {v.antes && (
          <span className="mt-0.5 flex gap-1">
            {solo && <Button size="sm" variant="outline" className="h-6 text-xs" disabled={ocupado} onClick={() => void accion("revisado", { vinculo_id: v.id })}>Está bien</Button>}
            <Button size="sm" variant="outline" className="h-6 text-xs" disabled={ocupado}
              onClick={() => { if (confirm(v.antes?.creado ? "Se borra la entrada que cargó la factura y el stock vuelve atrás. ¿Seguro?" : "La entrada vuelve a los kilos y el precio que tenía, y se desvincula. ¿Seguro?")) void accion("deshacer", { vinculo_id: v.id }) }}>
              {solo ? "No es ésta" : "Desvincular"}
            </Button>
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="rounded border border-dashed p-2 text-xs">
      <p className="font-medium">Entrada al stock {ocupado && <span className="font-normal text-gray-500">· buscando…</span>}</p>
      {renglones.length === 0 && (entregas.length === 0
        ? <p className="text-red-700">Esta factura no está vinculada a ninguna entrada al stock.</p>
        : <ul className="list-disc pl-5">{entregas.map((e, i) => <li key={i}>{dmy(e.movimiento?.fecha)} · {e.movimiento?.stock_insumos?.producto} · {fmt(e.cantidad, 0)} {e.movimiento?.stock_insumos?.unidad_medida || ""}{e.precio_unitario != null ? ` a $ ${fmt(e.precio_unitario)}` : ""}</li>)}</ul>)}
      {renglones.length > 0 && !stock && <p className="text-gray-500">Buscando las entradas de esta factura…</p>}
      {renglones.length > 0 && stock && (
        <ul className="mt-1 space-y-1.5">
          {renglones.map(r => {
            const vs = deEsteRenglon(r)
            const p = stock.propuestas.find((x: any) => x.n === r.n)
            const el = eleccion[r.n] || {}
            const insElegido = el.insumo || p?.insumoStockId || r.insumo_stock_id || ""
            const cabecera = <span className="font-medium">#{r.n} {r.descripcion} · {fmt(r.cantidad, 2)} {r.unidad || ""}</span>
            if (vs.length) return <li key={r.n}>{cabecera}{vs.map(fichaVinculo)}</li>
            if (!p) return <li key={r.n}>{cabecera}</li>
            const candidatas = [p.entrada, ...(p.otras || [])].filter(Boolean)
            const entradaElegida = el.entrada || p.entrada?.id || ""
            return (
              <li key={r.n}>
                {cabecera}
                <div className="mt-0.5 rounded bg-amber-50 px-2 py-1">
                  <select className="mr-1 h-6 rounded border px-1 text-xs" value={insElegido} disabled={ocupado}
                    onChange={e => { elegir(r.n, "insumo", e.target.value); void accion("insumo", { n: r.n, insumo_stock_id: e.target.value || null }) }}>
                    <option value="">— qué insumo del stock es —</option>
                    {stock.insumos.slice().sort((a: any, b: any) => String(a.producto).localeCompare(String(b.producto))).map((i: any) => <option key={i.id} value={i.id}>{i.producto} ({i.unidad_medida})</option>)}
                  </select>
                  {p.fuenteInsumo === "nombre" && <span className="text-gray-500">(por el nombre)</span>}
                  {p.estado === "propuesta" && (
                    <span className="block">
                      Entrada posible:{" "}
                      <select className="h-6 rounded border px-1 text-xs" value={entradaElegida} disabled={ocupado} onChange={e => elegir(r.n, "entrada", e.target.value)}>
                        {candidatas.map((c: any) => <option key={c.id} value={c.id}>{dmy(c.fecha)} · {fmt(c.cantidad, 0)} {uni(c.insumoStockId)} · {c.proveedor || ""}{c.costoUnitario != null ? ` · $ ${fmt(c.costoUnitario)}` : " · sin precio"}</option>)}
                      </select>
                      {p.cantidadStock != null && <span className="ml-1">→ la factura dice {fmt(p.cantidadStock, 0)} {uni(p.insumoStockId)}{p.precioStock != null ? ` a $ ${fmt(p.precioStock)}` : ""}</span>}
                      <Button size="sm" className="ml-1 h-6 text-xs" disabled={ocupado || !entradaElegida} onClick={() => void accion("vincular", { n: r.n, movimiento_id: entradaElegida, insumo_stock_id: insElegido })}>Vincular</Button>
                      <span className="block text-[11px] text-amber-800">No se vinculó sola: {(p.motivos || []).join(" · ")}</span>
                    </span>
                  )}
                  {p.estado === "sin-entrada" && (
                    <span className="block">
                      <span className="text-red-700">Sin entrada al stock.</span>
                      {p.cantidadStock != null
                        ? <Button size="sm" className="ml-1 h-6 text-xs" disabled={ocupado} onClick={() => { if (confirm(`Se carga la entrada de ${nombre(p.insumoStockId)}: ${fmt(p.cantidadStock, 0)} ${uni(p.insumoStockId)}${p.precioStock != null ? ` a $ ${fmt(p.precioStock)}` : ""}, con la fecha de la factura, y el stock sube eso. ¿Seguro?`)) void accion("registrar", { n: r.n, insumo_stock_id: insElegido }) }}>
                            ＋ Cargar la entrada ({fmt(p.cantidadStock, 0)} {uni(p.insumoStockId)}{p.precioStock != null ? ` a $ ${fmt(p.precioStock)}` : ""})
                          </Button>
                        : <span className="ml-1 text-amber-800">No sé convertir «{r.unidad || "?"}» a {uni(p.insumoStockId) || "la unidad del stock"}: cargala desde Productivo → Insumos.</span>}
                    </span>
                  )}
                  {p.estado === "sin-insumo" && <span className="block text-amber-800">Elegí qué insumo es: la próxima factura de este artículo se reconoce sola.</span>}
                </div>
              </li>
            )
          })}
          {sueltos.length > 0 && <li><span className="font-medium">Otras entradas vinculadas a esta factura</span>{sueltos.map(fichaVinculo)}</li>}
        </ul>
      )}
    </div>
  )
}
