/**
 * 🧾 Lectura de las retenciones del Subdiario de Ventas — A-FEAT-1278. La cuenta vive en
 * `retenciones-export.ts`; acá sólo se junta lo que está en la base. **La usan la vista previa y el
 * export**, para que el aviso de «sin fecha» que se ve en pantalla sea el mismo que sale en el Excel.
 *
 * 🏢 PAM y MA tienen certificados y cobros vinculados desde `scripts/84` (A-FEAT-1219 / A-FEAT-24). Si
 * la tabla de certificados de una empresa no existe (el script sin correr), se devuelve una nota — no
 * se omite en silencio.
 */

import { armarRetencionesSubdiario, type CertificadoRet, type ComprobanteRet, type ResultadoRetenciones } from './retenciones-export'
import { extractosDelSchema } from './extractos-empresa'

type Cliente = { from: (t: string) => any; schema: (s: string) => any }

const aRet = (c: any): ComprobanteRet => ({
  id: c.id,
  fecha: c.fecha_liquidacion || null,
  nro: c.nro_comprobante || [c.punto_venta, c.numero_desde].filter(Boolean).join('-') || null,
  cliente: c.denominacion_cliente || null, cuit: c.cuit_cliente || null,
  ret_iva: c.ret_iva, ret_iibb: c.ret_iibb,
})

/** `comprobantesSubdiario`: los del subdiario ya leídos (filas de `comprobantes_venta`). */
export async function cargarRetencionesSubdiario(
  supabase: Cliente, empresa: string, año: number, mes: number, comprobantesSubdiario: any[],
): Promise<ResultadoRetenciones & { notas: string[] }> {
  const schema = empresa.toLowerCase()
  const mm = String(mes).padStart(2, '0')
  const desde = `${año}-${mm}-01`
  const hasta = `${año}-${mm}-${String(new Date(año, mes, 0).getDate()).padStart(2, '0')}`
  const notas: string[] = []
  const idsSub = comprobantesSubdiario.map(c => c.id)

  // Certificados: los de las ventas del subdiario, los fechados en el mes y TODOS los sin fecha
  // (hay que ver si alguno cae acá por la fecha de su cobro).
  const tabla = () => supabase.schema(schema).from('retenciones_recibidas')
    .select('id, fecha, tipo, monto, nro_certificado, denominacion_cliente, cuit_cliente, comprobante_venta_id')
  const [rSub, rMes, rSin] = await Promise.all([
    idsSub.length ? tabla().in('comprobante_venta_id', idsSub) : Promise.resolve({ data: [], error: null }),
    tabla().gte('fecha', desde).lte('fecha', hasta),
    tabla().is('fecha', null),
  ])
  const errCert = rSub.error || rMes.error || rSin.error
  let certificados: CertificadoRet[] = []
  if (errCert) {
    const noExiste = /does not exist|schema cache|42P01|PGRST205/i.test(`${errCert.code} ${errCert.message}`)
    notas.push(noExiste
      ? `Nota: ${empresa} todavía no tiene dónde cargar certificados de retención (A-FEAT-1219). Acá van sólo las impresas en los comprobantes.`
      : `⚠️ No se pudieron leer los certificados: ${errCert.message}`)
  } else {
    certificados = [...(rSub.data || []), ...(rMes.data || []), ...(rSin.data || [])]
  }

  // Comprobantes: los del subdiario, los fechados en el mes (por sus retenciones impresas) y los de
  // los certificados que no están en ninguno de los dos (para el número y la fecha).
  const { data: delMes, error: eMes } = await supabase.schema(schema).from('comprobantes_venta')
    .select('*').gte('fecha_liquidacion', desde).lte('fecha_liquidacion', hasta)
  if (eMes) notas.push(`⚠️ No se pudieron leer los comprobantes del mes: ${eMes.message}`)
  const comps = new Map<string, any>()
  for (const c of [...comprobantesSubdiario, ...(delMes || [])]) comps.set(c.id, c)
  const faltan = [...new Set(certificados.map(c => c.comprobante_venta_id).filter((id): id is string => !!id && !comps.has(id)))]
  if (faltan.length) {
    const { data } = await supabase.schema(schema).from('comprobantes_venta').select('*').in('id', faltan)
    for (const c of data || []) comps.set(c.id, c)
  }

  // Cobros de los comprobantes con certificados sin fecha: pagos a cuenta vinculados y los créditos
  // de los extractos de la empresa conciliados directo (sin pago a cuenta, para no contar el mismo
  // cobro dos veces).
  const cobrosPorComprobante: Record<string, string[]> = {}
  const idsSinFecha = [...new Set(certificados.filter(c => !c.fecha && c.comprobante_venta_id).map(c => c.comprobante_venta_id as string))]
  if (idsSinFecha.length) {
    const { data: ants } = await supabase.from('anticipos_proveedores')
      .select('id, fecha_pago, comprobante_venta_id').eq('tipo', 'cobro').in('comprobante_venta_id', idsSinFecha)
    for (const a of ants || []) if (a.fecha_pago) (cobrosPorComprobante[a.comprobante_venta_id] ||= []).push(a.fecha_pago)
    for (const e of extractosDelSchema(schema)) {
      const { data: movs } = await (e.schema ? supabase.schema(e.schema) : supabase).from(e.tabla)
        .select('fecha, anticipo_id, comprobante_venta_id').in('comprobante_venta_id', idsSinFecha)
      for (const m of movs || []) if (m.fecha && !m.anticipo_id) (cobrosPorComprobante[m.comprobante_venta_id] ||= []).push(m.fecha)
    }
  }

  const res = armarRetencionesSubdiario({
    desde, hasta, idsSubdiario: idsSub, certificados,
    comprobantes: [...comps.values()].map(aRet), cobrosPorComprobante,
  })
  return { ...res, notas }
}
