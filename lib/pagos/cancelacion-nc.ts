/**
 * 🔄 **CANCELAR NOTAS DE CRÉDITO — la lógica, fuera de la Vista de Pagos.** A-FEAT-1232 (2026-10-03).
 *
 * Pregunta del usuario: *«Cancelarlas lleva a la vista Pagos, que desactivaremos más adelante… ¿cómo
 * hacemos sin rehacer código?»*. Esto **NO es código nuevo**: es el que vivía adentro de
 * `vista-facturas-arca.tsx` (escenarios A y B de la cancelación FC/NC, commits 9a30821 / e553582 /
 * b44f76b, probados en mayo con Alcorta y el 2026-10-03 con Novitas), **mudado tal cual** para que lo
 * usen las dos pantallas — Pagos mientras exista, y el Cash Flow desde ya. El día que se borre Pagos
 * (A-FEAT-1169) no se pierde nada.
 *
 * - **Escenario A** (`fc_con_nc`): facturas + notas de crédito del mismo proveedor. Cubre total →
 *   todo `conciliado` con saldo 0; parcial → la factura baja su `monto_a_abonar`.
 * - **Escenario B** (`nc_con_descuento`): una NC del proveedor por los descuentos que ya se aplicaron
 *   al pagarle. La NC queda `conciliado` con el detalle «Corresponde a descuentos aplicados FC …».
 */

type Cliente = { schema: (s: string) => any }

/** Lo mínimo de un comprobante de ARCA que usa la cancelación. */
export interface ComprobanteNC {
  id: string
  cuit: string
  tipo_comprobante: number
  numero_desde: number | string | null
  denominacion_emisor: string | null
  imp_total: number
  estado?: string | null
  descuento_aplicado?: number | null
  grupo_pago_id?: string | null
  fecha_estimada?: string | null
}

export interface DatosCancelacionNC {
  tipo: 'fc_con_nc' | 'nc_con_descuento'
  /** FCs (escenario A) o NCs (escenario B) elegidas por el usuario. */
  facturas: ComprobanteNC[]
  /** NCs disponibles (A) o FCs con descuento (B). */
  disponibles: ComprobanteNC[]
  /** Ids elegidos en el modal. */
  seleccionadas: Set<string>
}

const TIPOS_NC = [3, 8, 13, 53, 203, 208, 213]
export const esNotaCreditoArca = (tipo: number | null | undefined) => TIPOS_NC.includes(Number(tipo))

/**
 * Escenario A armado desde la BASE para un proveedor: sus facturas y notas de crédito por pagar.
 * Es lo que hacía el encargo del Cash Flow al llegar a Pagos — con el dato recién traído, no con lo
 * que se vio antes del click. Devuelve `null` si no están las dos puntas (no se abre un modal vacío).
 */
export async function armarCancelacionPorCuit(supabase: Cliente, schemaName: string, cuit: string): Promise<DatosCancelacionNC | null> {
  const { data, error } = await supabase.schema(schemaName).from('comprobantes_arca')
    .select('id, cuit, tipo_comprobante, numero_desde, denominacion_emisor, imp_total, estado, descuento_aplicado, grupo_pago_id, fecha_estimada')
    .eq('cuit', cuit).in('estado', ['pendiente', 'pagar', 'preparado', 'echeq'])
  if (error) throw error
  const todos = (data || []) as ComprobanteNC[]
  const ncs = todos.filter(f => esNotaCreditoArca(f.tipo_comprobante))
  const fcs = todos.filter(f => !esNotaCreditoArca(f.tipo_comprobante))
  if (!ncs.length || !fcs.length) return null
  // Vienen todas tildadas, como cuando el flujo normal lo propone: es lo más frecuente.
  return { tipo: 'fc_con_nc', facturas: fcs, disponibles: ncs, seleccionadas: new Set(ncs.map(n => n.id)) }
}

/**
 * Escenario B: las facturas de esos proveedores que se pagaron con descuento y cuyo descuento todavía
 * no cubrió ninguna NC. **Mudado tal cual** de la Vista de Pagos (fix b44f76b): las ya cubiertas se
 * detectan por el detalle estructurado «Corresponde a descuentos aplicados FC …».
 */
export async function facturasConDescuentoParaNC(supabase: Cliente, schemaName: string, cuits: string[]): Promise<ComprobanteNC[]> {
  const { data: fcsConDescuento } = await supabase.schema(schemaName).from('comprobantes_arca')
    .select('id, tipo_comprobante, numero_desde, denominacion_emisor, cuit, imp_total, descuento_aplicado, monto_sicore, grupo_pago_id, fecha_estimada')
    .in('cuit', cuits)
    .in('estado', ['pagar', 'pagado', 'echeq', 'conciliado'])
    .gt('descuento_aplicado', 0)
  const { data: ncsYaAplicadas } = await supabase.schema(schemaName).from('comprobantes_arca')
    .select('detalle')
    .in('cuit', cuits)
    .eq('estado', 'conciliado')
    .like('detalle', 'Corresponde a descuentos aplicados FC%')
  const fcNumerosCubiertos = new Set<number>()
  for (const nc of (ncsYaAplicadas || []) as any[]) {
    const nums = (nc.detalle || '')
      .replace('Corresponde a descuentos aplicados FC', '')
      .split(/[,\s]+/)
      .map((x: string) => parseInt(x, 10))
      .filter((n: number) => !isNaN(n))
    nums.forEach((n: number) => fcNumerosCubiertos.add(n))
  }
  return ((fcsConDescuento || []) as ComprobanteNC[]).filter(fc => !fcNumerosCubiertos.has(Number(fc.numero_desde)))
}

/** Un cambio a escribir en un comprobante. */
export interface CambioNC { id: string; cambios: { estado?: string; monto_a_abonar: number; detalle: string } }

/**
 * Los cambios que produce la cancelación, **sin tocar la base** — la misma cuenta que el botón
 * «Aplicar Cancelación» de Pagos, separada para poder probarla (`lib/pruebas/casos.ts`).
 */
export function planCancelacionNC(modal: DatosCancelacionNC): CambioNC[] {
  const plan: CambioNC[] = []
  if (modal.tipo === 'fc_con_nc') {
    const ncsAplicar = modal.disponibles.filter(nc => modal.seleccionadas.has(nc.id))
    let saldoNC = ncsAplicar.reduce((sum, nc) => sum + Math.abs(nc.imp_total), 0)
    const nrosNC = ncsAplicar.map(nc => nc.numero_desde || '').join(', ')
    for (const fc of modal.facturas) {
      if (saldoNC <= 0) break
      const montoFC = fc.imp_total
      if (saldoNC >= montoFC) {
        plan.push({ id: fc.id, cambios: { estado: 'conciliado', monto_a_abonar: 0, detalle: `Cancelada con NC ${nrosNC}` } })
        saldoNC -= montoFC
      } else {
        plan.push({ id: fc.id, cambios: { monto_a_abonar: montoFC - saldoNC, detalle: `Descuento parcial NC ${nrosNC}` } })
        saldoNC = 0
      }
    }
    const nrosFC = modal.facturas.map(f => f.numero_desde || '').join(', ')
    for (const nc of ncsAplicar) {
      plan.push({ id: nc.id, cambios: { estado: 'conciliado', monto_a_abonar: 0, detalle: `Cancela FC ${nrosFC}` } })
    }
    return plan
  }
  // Escenario B
  const fcsMatchear = modal.disponibles.filter(fc => modal.seleccionadas.has(fc.id))
  for (const nc of modal.facturas) {
    plan.push({ id: nc.id, cambios: { estado: 'conciliado', monto_a_abonar: 0, detalle: `Corresponde a descuentos aplicados FC ${fcsMatchear.map(f => f.numero_desde || '').join(', ')}` } })
  }
  return plan
}

/**
 * ✓ **Aplica la cancelación** — escribe el plan, en orden. Devuelve el mensaje y los ids tocados.
 */
export async function aplicarCancelacionNC(supabase: Cliente, schemaName: string, modal: DatosCancelacionNC): Promise<{ mensaje: string; idsAfectados: string[] }> {
  const plan = planCancelacionNC(modal)
  for (const c of plan) {
    const { error } = await supabase.schema(schemaName).from('comprobantes_arca').update(c.cambios).eq('id', c.id)
    if (error) throw error
  }
  const mensaje = modal.tipo === 'fc_con_nc'
    ? `Cancelación aplicada: ${modal.facturas.length} FC + ${modal.disponibles.filter(nc => modal.seleccionadas.has(nc.id)).length} NC`
    : `${modal.facturas.length} NC conciliada(s) contra descuentos`
  return { mensaje, idsAfectados: plan.map(c => c.id) }
}
