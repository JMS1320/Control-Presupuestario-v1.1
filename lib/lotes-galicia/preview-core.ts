/**
 * Lógica compartida del preview de lotes Galicia.
 * La usan TANTO el endpoint /api/lotes/preview COMO /api/lotes/generar (este último ANTES llamaba al
 * preview por HTTP server-to-server, que en el preview de Vercel devolvía la página de protección
 * (HTML) → "Unexpected token '<'". Compartiendo la función se elimina ese fetch frágil).
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { PreviewLoteOutput, ItemPreview, Empresa } from './types'
import { validarCBU, validarAlias, diasDesde, motivoSugerido, empresaToSchema } from './helpers'

const DIAS_WARNING_ULTIMO_USO = 120 // ~4 meses

interface ItemRaw {
  tipo: string
  id: string
  schema?: string
  cuit?: string
  razon_social?: string
  monto?: number
  descripcion?: string
  moneda?: string
  bloqueante?: string
  // ── Solo sueldos: cuenta del empleado ya resuelta ──
  empleado_id?: string
  cuenta_destino_id?: string | null
  banco?: string | null
  alias_cuenta?: string | null
  grupo_export?: string | null
  concepto?: string | null
}

/** Carga + valida los items y devuelve el PreviewLoteOutput. Lanza error si algo falla (lo captura el endpoint). */
export async function computarPreview(
  empresa: Empresa,
  items: Array<{ tipo: string; id: string; schema?: string }>,
): Promise<PreviewLoteOutput> {
  // ── 1. Cargar items desde sus respectivas tablas ──
  const rawItems = await cargarItems(empresa, items)

  // ── 2. Cargar proveedores por CUIT en una sola query ──
  const cuits = [...new Set(rawItems.map(r => r.cuit).filter(Boolean) as string[])]
  const { data: proveedoresData } = await supabaseAdmin
    .from('proveedores')
    .select('id, cuit, razon_social, email_pagos, email_facturacion, cbu, alias_cbu, ultimo_uso_bancario, mensaje_transferencia')
    .in('cuit', cuits)

  const provMap = new Map<string, any>()
  ;(proveedoresData || []).forEach(p => provMap.set(p.cuit, p))

  // ── 3. Construir ItemPreview para cada item ──
  const previews: ItemPreview[] = rawItems.map(raw => {
    // SUELDOS: el destino sale de la cuenta del empleado (cuentas_empleado), no de proveedores.
    if (raw.tipo === 'sueldo') return construirPreviewSueldo(raw)

    const prov = raw.cuit ? provMap.get(raw.cuit) : null
    const warnings: string[] = []
    let bloqueante: string | null = raw.bloqueante || null

    if (raw.moneda && !['ARS', 'PES', '$'].includes(raw.moneda)) {
      bloqueante = `Moneda ${raw.moneda} no se exporta (solo ARS)`
    }

    const email = prov?.email_pagos || prov?.email_facturacion || null
    const cbu = prov?.cbu || null
    const alias = prov?.alias_cbu || null
    const ultimoUso = prov?.ultimo_uso_bancario || null
    const dias = diasDesde(ultimoUso)
    const ultimoUsoWarning = dias !== null && dias > DIAS_WARNING_ULTIMO_USO

    const cbuValido = validarCBU(cbu)
    const aliasValido = validarAlias(alias)
    const tieneDestinatario = cbuValido || aliasValido
    const excluido = !tieneDestinatario

    if (!email) warnings.push('Sin email')
    if (!tieneDestinatario) {
      if (!cbu && !alias) warnings.push('Sin CBU ni Alias')
      else if (!cbuValido && cbu) warnings.push('CBU formato inválido')
      else if (!aliasValido && alias) warnings.push('Alias formato inválido')
    }
    if (ultimoUsoWarning) warnings.push(`Último uso hace ${dias} días`)
    else if (dias === null && !prov) warnings.push('Proveedor no existe en BD')
    else if (dias === null) warnings.push('Nunca usado')

    return {
      tipo: raw.tipo as any,
      id: raw.id,
      schema: raw.schema,
      proveedor_id: prov?.id || null,
      cuit: raw.cuit || '',
      razon_social: prov?.razon_social || raw.razon_social || '(sin razón social)',
      email_pagos: email,
      cbu,
      alias_cbu: alias,
      ultimo_uso_bancario: ultimoUso,
      ultimo_uso_dias: dias,
      ultimo_uso_warning: ultimoUsoWarning,
      monto: raw.monto || 0,
      descripcion: raw.descripcion || '',
      motivo_sugerido: motivoSugerido(raw.tipo),
      moneda: raw.moneda || 'ARS',
      mensaje: prov?.mensaje_transferencia || null,
      warnings,
      bloqueante,
      excluido_del_excel: excluido,
    } satisfies ItemPreview
  })

  // ── 4. Separar pagos vs sueldos ──
  const sueldoItems = previews.filter(p => p.tipo === 'sueldo')
  const pagoItems = previews.filter(p => p.tipo !== 'sueldo')

  const bloqueantes: string[] = []
  previews.forEach(p => {
    if (p.bloqueante) bloqueantes.push(`${p.tipo} ${p.id.slice(0, 8)}: ${p.bloqueante}`)
  })

  const sinEmailMap = new Map<string, { proveedor_id: string; cuit: string; razon_social: string }>()
  const sinCbuMap = new Map<string, { proveedor_id: string; cuit: string; razon_social: string }>()
  previews.forEach(p => {
    if (!p.email_pagos && p.proveedor_id) {
      sinEmailMap.set(p.proveedor_id, { proveedor_id: p.proveedor_id, cuit: p.cuit, razon_social: p.razon_social })
    }
    if (p.excluido_del_excel && p.proveedor_id) {
      sinCbuMap.set(p.proveedor_id, { proveedor_id: p.proveedor_id, cuit: p.cuit, razon_social: p.razon_social })
    }
  })

  const sumar = (arr: ItemPreview[], soloValidos: boolean) =>
    arr.filter(p => soloValidos ? !p.excluido_del_excel : p.excluido_del_excel)
       .reduce((s, p) => s + (Number(p.monto) || 0), 0)

  return {
    ok: true,
    pagos: {
      items: pagoItems,
      cantidad_validos: pagoItems.filter(p => !p.excluido_del_excel).length,
      cantidad_excluidos: pagoItems.filter(p => p.excluido_del_excel).length,
      monto_total_valido: sumar(pagoItems, true),
      monto_total_excluido: sumar(pagoItems, false),
    },
    sueldos: {
      items: sueldoItems,
      cantidad_validos: sueldoItems.filter(p => !p.excluido_del_excel).length,
      cantidad_excluidos: sueldoItems.filter(p => p.excluido_del_excel).length,
      monto_total_valido: sumar(sueldoItems, true),
      monto_total_excluido: sumar(sueldoItems, false),
    },
    bloqueantes,
    proveedores_sin_email: [...sinEmailMap.values()],
    proveedores_sin_cbu: [...sinCbuMap.values()],
  }
}

// Construye el ItemPreview de un sueldo: el destino es la cuenta del empleado (CBU o alias).
function construirPreviewSueldo(raw: ItemRaw): ItemPreview {
  const dest = raw.alias_cuenta || null            // el campo "alias" de cuentas_empleado puede tener un CBU o un alias real
  const esCbu = validarCBU(dest)
  const esAlias = validarAlias(dest)
  const valido = esCbu || esAlias
  const excluido = !valido
  const warnings: string[] = []
  if (!dest) warnings.push('Sin cuenta (CBU/alias)')
  else if (!valido) warnings.push('CBU/alias formato inválido')
  if (!raw.grupo_export) warnings.push('Sin grupo de archivo')

  return {
    tipo: 'sueldo',
    id: raw.id,
    schema: raw.schema,
    proveedor_id: null,
    cuit: raw.cuit || '',
    razon_social: raw.razon_social || '(sin nombre)',
    email_pagos: null,
    cbu: esCbu ? String(dest).replace(/\s/g, '') : null,
    alias_cbu: esCbu ? null : dest,
    ultimo_uso_bancario: null,
    ultimo_uso_dias: null,
    ultimo_uso_warning: false,
    monto: raw.monto || 0,
    descripcion: raw.descripcion || '',
    motivo_sugerido: raw.concepto || '', // motivo del Excel = concepto (puede quedar vacío)
    moneda: 'ARS',
    mensaje: null,
    warnings,
    bloqueante: raw.bloqueante || null,
    excluido_del_excel: excluido,
    empleado_id: raw.empleado_id || null,
    cuenta_destino_id: raw.cuenta_destino_id || null,
    banco: raw.banco || null,
    grupo_export: raw.grupo_export || null,
    concepto: raw.concepto || null,
  }
}

// ── Carga items desde sus tablas según tipo ──
async function cargarItems(empresa: Empresa, items: Array<{ tipo: string; id: string; schema?: string }>): Promise<ItemRaw[]> {
  const schemaEmpresa = empresaToSchema(empresa)
  const out: ItemRaw[] = []

  const porTipo: Record<string, string[]> = {}
  items.forEach(it => {
    porTipo[it.tipo] = porTipo[it.tipo] || []
    porTipo[it.tipo].push(it.id)
  })

  // FC ARCA
  if (porTipo['fc']?.length) {
    const { data } = await supabaseAdmin.schema(schemaEmpresa).from('comprobantes_arca')
      .select('id, cuit, denominacion_emisor, monto_a_abonar, imp_total, numero_desde, moneda, tipo_comprobante_desc, grupo_pago_id')
      .in('id', porTipo['fc'])
    ;(data || []).forEach((f: any) => {
      const monto = Number(f.monto_a_abonar ?? f.imp_total ?? 0)
      out.push({
        tipo: 'fc', id: f.id, schema: schemaEmpresa, cuit: f.cuit,
        razon_social: f.denominacion_emisor, monto,
        descripcion: `FC ${f.numero_desde || ''}`.trim(), moneda: f.moneda || 'ARS',
      })
    })
  }

  // Cuotas de templates
  if (porTipo['cuota_template']?.length) {
    const { data: cuotas } = await supabaseAdmin.from('cuotas_egresos_sin_factura')
      .select('id, egreso_id, monto, descripcion')
      .in('id', porTipo['cuota_template'])
    const egresoIds = [...new Set((cuotas || []).map((c: any) => c.egreso_id))]
    const { data: egresos } = egresoIds.length
      ? await supabaseAdmin.from('egresos_sin_factura')
          .select('id, cuit_quien_cobra, nombre_quien_cobra, nombre_referencia')
          .in('id', egresoIds)
      : { data: [] }
    const egresoMap = new Map<string, any>()
    ;(egresos || []).forEach((e: any) => egresoMap.set(e.id, e))
    ;(cuotas || []).forEach((c: any) => {
      const e = egresoMap.get(c.egreso_id)
      const cuit = (e?.cuit_quien_cobra || '').replace(/\D/g, '')
      out.push({
        tipo: 'cuota_template', id: c.id, cuit,
        razon_social: e?.nombre_quien_cobra || e?.nombre_referencia,
        monto: Number(c.monto || 0),
        descripcion: e?.nombre_referencia || c.descripcion || `TPL ${c.id.slice(0, 6)}`,
        moneda: 'ARS',
      })
    })
  }

  // Anticipos
  if (porTipo['anticipo']?.length) {
    const { data } = await supabaseAdmin.from('anticipos_proveedores')
      .select('id, cuit_proveedor, nombre_proveedor, monto, monto_restante')
      .in('id', porTipo['anticipo'])
    ;(data || []).forEach((a: any) => {
      const cuit = (a.cuit_proveedor || '').replace(/\D/g, '')
      out.push({
        tipo: 'anticipo', id: a.id, cuit, razon_social: a.nombre_proveedor,
        monto: Number(a.monto_restante ?? a.monto ?? 0),
        descripcion: `ANT ${a.id.slice(0, 6)}`, moneda: 'ARS',
      })
    })
  }

  // Grupos de pago
  if (porTipo['grupo']?.length) {
    const { data: grupos } = await supabaseAdmin.schema(schemaEmpresa).from('grupos_pago')
      .select('id, cuit, proveedor, monto_total')
      .in('id', porTipo['grupo'])
    for (const g of grupos || []) {
      const fcGrupo = await supabaseAdmin.schema(schemaEmpresa).from('comprobantes_arca')
        .select('cuit').eq('grupo_pago_id', g.id)
      const cuotasGrupo = await supabaseAdmin.from('cuotas_egresos_sin_factura')
        .select('id, egreso_id').eq('grupo_pago_id', g.id)
      const cuitsFc = [...new Set((fcGrupo.data || []).map((f: any) => f.cuit))]
      let cuitsCuotas: string[] = []
      if (cuotasGrupo.data && cuotasGrupo.data.length) {
        const egIds = [...new Set(cuotasGrupo.data.map((c: any) => c.egreso_id))]
        const eg = await supabaseAdmin.from('egresos_sin_factura').select('cuit_quien_cobra').in('id', egIds)
        cuitsCuotas = [...new Set((eg.data || []).map((e: any) => (e.cuit_quien_cobra || '').replace(/\D/g, '')))]
      }
      const cuitsTodos = [...new Set([...cuitsFc, ...cuitsCuotas].filter(Boolean))]
      let bloqueante: string | undefined
      if (cuitsTodos.length > 1) {
        bloqueante = `Grupo con múltiples CUITs (${cuitsTodos.length}): no se puede exportar como una sola fila`
      }
      out.push({
        tipo: 'grupo', id: g.id, schema: schemaEmpresa,
        cuit: cuitsTodos[0] || g.cuit, razon_social: g.proveedor,
        monto: Number(g.monto_total || 0),
        descripcion: `G ${g.proveedor?.slice(0, 8) || ''}`.trim(), moneda: 'ARS', bloqueante,
      })
    }
  }

  // Sueldos
  if (porTipo['sueldo']?.length) {
    const { data: pagos } = await supabaseAdmin.schema('sueldos').from('pagos')
      .select('id, empleado_id, monto, descripcion, tipo, cuenta_destino_id')
      .in('id', porTipo['sueldo'])
    const empIds = [...new Set((pagos || []).map((p: any) => p.empleado_id))]
    const { data: empleados } = empIds.length
      ? await supabaseAdmin.schema('sueldos').from('empleados')
          .select('id, nombre, cuit_empleado')
          .in('id', empIds)
      : { data: [] }
    // Cuentas de esos empleados (para resolver el destino: alias, grupo_export, concepto)
    const { data: cuentas } = empIds.length
      ? await supabaseAdmin.schema('sueldos').from('cuentas_empleado')
          .select('id, empleado_id, banco, alias, grupo_export, concepto, activo')
          .in('empleado_id', empIds)
      : { data: [] }
    const empMap = new Map<string, any>()
    ;(empleados || []).forEach((e: any) => empMap.set(e.id, e))
    const cuentaById = new Map<string, any>()
    const cuentasByEmpleado = new Map<string, any[]>()
    ;(cuentas || []).forEach((c: any) => {
      cuentaById.set(c.id, c)
      const arr = cuentasByEmpleado.get(c.empleado_id) || []
      arr.push(c)
      cuentasByEmpleado.set(c.empleado_id, arr)
    })
    ;(pagos || []).forEach((p: any) => {
      const e = empMap.get(p.empleado_id)
      const cuit = (e?.cuit_empleado || '').replace(/\D/g, '')
      // Resolver cuenta: la del pago (cuenta_destino_id) o, si no, la única activa del empleado.
      let cuenta = p.cuenta_destino_id ? cuentaById.get(p.cuenta_destino_id) : null
      if (!cuenta) {
        const activas = (cuentasByEmpleado.get(p.empleado_id) || []).filter((c: any) => c.activo !== false)
        if (activas.length === 1) cuenta = activas[0]
      }
      out.push({
        tipo: 'sueldo', id: p.id, cuit, razon_social: e?.nombre,
        monto: Number(p.monto || 0),
        descripcion: `SLDO ${e?.nombre?.split(' ')[0] || ''}`.trim(), moneda: 'ARS',
        empleado_id: p.empleado_id,
        cuenta_destino_id: p.cuenta_destino_id || cuenta?.id || null,
        banco: cuenta?.banco || null,
        alias_cuenta: cuenta?.alias || null,
        grupo_export: cuenta?.grupo_export || null,
        concepto: cuenta?.concepto || null,
      })
    })
  }

  return out
}
