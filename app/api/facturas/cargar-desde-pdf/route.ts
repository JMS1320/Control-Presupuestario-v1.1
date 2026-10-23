import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { exigirSesion, respuestaSinAcceso } from "@/lib/auth/guard-sesion"
import { nroDeCuenta } from "@/lib/facturas/nro-de-cuenta"
import {
  calcularFechaEstimada, buscarReglaCuit, obtenerTipoComprobante, aNegativoSiNC, asegurarProveedores,
  controlDeLaCarga, camposDeLaCarga, huellaDeLaCarga, type DatosCargaManual,
} from "@/lib/facturas/alta-factura"
import { TIPOS_CARGABLES, discriminaIva, cuitValido } from "@/lib/gas-pdf/leer-factura"
import { CAMBIO_A_ASIENTO_CONTABLE } from "@/lib/balance/asientos-contables"
import { ahoraISO } from "@/lib/fechas"

/**
 * 📄➡️🧾 CARGAR UNA FACTURA NO INFORMADA DESDE SU PDF — A-FEAT-1318 (usuario 2026-10-23).
 *
 * Desde la auditoría de Subdiarios, un PDF sin vincular que no está en ARCA (Colomac) se carga como
 * factura **No Informada** sin armar un Excel. La pantalla precarga lo que leyó del PDF; el usuario
 * corrige; acá se graba igual que la importación (regla por CUIT, vencimiento estimado, signo de las NC,
 * alta del proveedor — `lib/facturas/alta-factura.ts`), ya vinculada a su PDF.
 *
 * - **Frena** si las partes no suman el total (integridad: el comprobante se contradice), si el CUIT
 *   no cumple el dígito verificador, o si la factura ya existe.
 * - **Huella**: lo leído al lado de lo cargado, en el comprobante (`pdf_observaciones`, siempre) y en
 *   el registro del archivo digital (script 94; si no está corrido se dice y la carga sigue).
 */
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const ROTULOS: Record<string, string> = {
  cuit: "CUIT", denominacion: "proveedor", tipo: "tipo", puntoVenta: "punto de venta", numero: "número",
  fecha: "fecha", neto21: "neto 21%", iva21: "IVA 21%", neto105: "neto 10,5%", iva105: "IVA 10,5%",
  noGravado: "no gravado", exento: "exento", otrosTributos: "otros tributos", total: "total", cae: "CAE",
}

export async function POST(req: Request) {
  const sesion = await exigirSesion()
  if (!sesion.ok) return respuestaSinAcceso(sesion)

  try {
    const body = await req.json()
    const empresa = String(body.empresa || "")
    if (!["MSA", "PAM", "MA"].includes(empresa)) return NextResponse.json({ ok: false, error: "Empresa no válida" }, { status: 400 })
    const esquema = empresa.toLowerCase()
    const destino: "asientos" | "sin_imputar" = body.destino === "asientos" ? "asientos" : "sin_imputar"
    const archivo = body.archivo || {}
    const leido: Record<string, string | number | null> = body.leido || {}
    const d = body.datos as DatosCargaManual

    // ── Validaciones que frenan ────────────────────────────────────────────────────────────────
    const cuit = String(d?.cuit || "").replace(/\D/g, "")
    if (!cuitValido(cuit)) return NextResponse.json({ ok: false, error: `El CUIT ${d?.cuit || "(vacío)"} no es válido (no cumple el dígito verificador).` }, { status: 400 })
    if (!TIPOS_CARGABLES[d.tipo]) return NextResponse.json({ ok: false, error: "Elegí el tipo de comprobante." }, { status: 400 })
    if (!d.puntoVenta || !d.numero) return NextResponse.json({ ok: false, error: "Faltan el punto de venta o el número." }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha || ""))) return NextResponse.json({ ok: false, error: "Falta la fecha de emisión." }, { status: 400 })
    if (!String(d.denominacion || "").trim()) return NextResponse.json({ ok: false, error: "Falta el nombre del proveedor." }, { status: 400 })
    const discrimina = discriminaIva(d.tipo)
    const control = controlDeLaCarga(d, discrimina)
    if (!control.cierra) {
      return NextResponse.json({ ok: false, error: control.aplica
        ? `Las partes suman ${control.suma.toLocaleString("es-AR", { minimumFractionDigits: 2 })} y el total es ${d.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })} (diferencia ${control.diferencia.toLocaleString("es-AR", { minimumFractionDigits: 2 })}).`
        : "Falta el total." }, { status: 400 })
    }

    // ── ¿Ya existe? (misma clave que la importación) ───────────────────────────────────────────
    const { data: existe } = await supabase.schema(esquema).from("comprobantes_arca")
      .select("id, origen_factura, denominacion_emisor")
      .eq("tipo_comprobante", d.tipo).eq("punto_venta", d.puntoVenta).eq("numero_desde", d.numero).eq("cuit", cuit)
      .maybeSingle()
    if (existe) {
      return NextResponse.json({ ok: false, duplicada: true, id: existe.id,
        error: `Esa factura ya está cargada (${existe.origen_factura || "ARCA"}): vinculá el PDF a ella en vez de cargarla de nuevo.` }, { status: 409 })
    }

    // ── La fila, igual que la importación ──────────────────────────────────────────────────────
    const tipoInfo = await obtenerTipoComprobante(supabase, d.tipo)
    const regla = await buscarReglaCuit(supabase, cuit)
    const campos = aNegativoSiNC(camposDeLaCarga({ ...d, cuit }, discrimina), tipoInfo.es_nota_credito)
    const datosCargados: Record<string, string | number | null> = { ...d, cuit } as any
    const huella = huellaDeLaCarga(leido, datosCargados)
    const fmt = (v: unknown) => typeof v === "number" ? v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? "—")
    const textoHuella = `Cargada desde el PDF «${archivo.nombre || "?"}» (${sesion.user.email || "?"}).` +
      (huella.length ? ` Corregido a mano: ${huella.map(h => `${ROTULOS[h.campo] || h.campo} ${fmt(h.leido)} → ${fmt(h.cargado)}`).join("; ")}.` : " Todo como lo leyó la app.")

    const fila: Record<string, unknown> = {
      ...campos,
      tipo_comprobante_desc: tipoInfo.descripcion,
      fecha_estimada: regla.estado === "debito" ? d.fecha : calcularFechaEstimada(d.fecha),
      monto_a_abonar: campos.imp_total,
      campana: null,
      "año_contable": null,
      mes_contable: null,
      ddjj_iva: "No",
      // El usuario la cargó mirando el PDF: es su «sí» con el link (como «Confirmada» en el buscador).
      fc: "Confirmada",
      cuenta_contable: regla.cuenta_contable,
      centro_costo: null,
      estado: regla.estado,
      detalle: null,
      archivo_origen: `PDF: ${archivo.nombre || ""}`.trim(),
      origen_factura: "No Informada",
      pdf_drive_url: archivo.url || null,
      pdf_estado: archivo.url ? "descargado" : null,
      pdf_observaciones: textoHuella,
      ...(destino === "asientos" ? CAMBIO_A_ASIENTO_CONTABLE : {}),
    }
    const avisos: string[] = []
    if (regla.cuenta_contable) {
      const { data: plan } = await supabase.from("cuentas_contables").select("categ, nro_cuenta")
      const nro = nroDeCuenta(regla.cuenta_contable, plan ?? [])
      fila.nro_cuenta = nro
      if (!nro) avisos.push(`La cuenta «${regla.cuenta_contable}» de la regla del CUIT no tiene número en el plan.`)
    }

    const { data: creada, error: errIns } = await supabase.schema(esquema).from("comprobantes_arca").insert(fila).select("id").single()
    if (errIns || !creada) return NextResponse.json({ ok: false, error: `No se grabó la factura: ${errIns?.message || "sin respuesta"}` }, { status: 500 })

    // ── Proveedor (upsert) ─────────────────────────────────────────────────────────────────────
    const prov = await asegurarProveedores(supabase, new Map([[cuit, String(d.denominacion).trim()]]))
    if (prov.error) avisos.push(`La factura entró pero el proveedor no se pudo dar de alta: ${prov.error}`)

    // ── Huella en el registro del archivo digital (script 94) ──────────────────────────────────
    let huellaEnRegistro = false
    if (archivo.file_id) {
      const up = await supabase.from("arca_pdf_archivo_digital").update({
        comprobante_id: creada.id, comprobante_empresa: empresa,
        carga_leido: leido, carga_correcciones: huella, cargado_at: ahoraISO(), cargado_por: sesion.user.email || null,
      }).eq("file_id", archivo.file_id).select("file_id")
      if (up.error) avisos.push("La huella quedó en la factura; el registro del archivo digital todavía no la guarda (falta el script 94).")
      else if ((up.data || []).length === 0) avisos.push("El PDF no estaba en el registro del archivo digital: la huella quedó sólo en la factura.")
      else huellaEnRegistro = true
    }

    return NextResponse.json({
      ok: true, id: creada.id, destino, correcciones: huella.length, huellaEnRegistro,
      proveedorCreado: prov.creados > 0, cuenta: regla.cuenta_contable, avisos,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Error inesperado: ${(e as Error).message}` }, { status: 500 })
  }
}
