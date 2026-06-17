/**
 * POST /api/lotes/preview
 *
 * Recibe array de items seleccionados, los carga desde BD,
 * los une con sus proveedores y devuelve resumen con flags
 * de validación para mostrar en el modal.
 *
 * NO modifica BD. Solo lee.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type {
  PreviewLoteInput, PreviewLoteOutput, ItemPreview,
  Empresa,
} from '@/lib/lotes-galicia/types'
import {
  validarCBU, validarAlias, diasDesde, motivoSugerido, empresaToSchema,
} from '@/lib/lotes-galicia/helpers'

export const runtime = 'nodejs'

const DIAS_WARNING_ULTIMO_USO = 120  // ~4 meses

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
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreviewLoteInput
    const { empresa, items } = body

    if (!empresa || !['MSA', 'PAM', 'MA'].includes(empresa)) {
      return NextResponse.json({ ok: false, error: 'empresa requerida (MSA/PAM/MA)' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: 'items vacío' }, { status: 400 })
    }

    // ── 1. Cargar items desde sus respectivas tablas ──
    const rawItems = await cargarItems(empresa, items)

    // ── 2. Cargar proveedores por CUIT en una sola query ──
    const cuits = [...new Set(rawItems.map(r => r.cuit).filter(Boolean) as string[])]
    const { data: proveedoresData } = await supabaseAdmin
      .from('proveedores')
      .select('id, cuit, razon_social, email_pagos, email_facturacion, cbu, alias_cbu, ultimo_uso_bancario')
      .in('cuit', cuits)

    const provMap = new Map<string, any>()
    ;(proveedoresData || []).forEach(p => provMap.set(p.cuit, p))

    // ── 3. Construir ItemPreview para cada item ──
    const previews: ItemPreview[] = rawItems.map(raw => {
      const prov = raw.cuit ? provMap.get(raw.cuit) : null
      const warnings: string[] = []
      let bloqueante: string | null = raw.bloqueante || null

      // Moneda — si es USD u otra, bloquear
      if (raw.moneda && !['ARS', 'PES', '$'].includes(raw.moneda)) {
        bloqueante = `Moneda ${raw.moneda} no se exporta (solo ARS)`
      }

      const email = prov?.email_pagos || prov?.email_facturacion || null
      const cbu = prov?.cbu || null
      const alias = prov?.alias_cbu || null
      const ultimoUso = prov?.ultimo_uso_bancario || null
      const dias = diasDesde(ultimoUso)
      const ultimoUsoWarning = dias !== null && dias > DIAS_WARNING_ULTIMO_USO

      // Validaciones de destinatario
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
      if (ultimoUsoWarning) {
        warnings.push(`Último uso hace ${dias} días`)
      } else if (dias === null && !prov) {
        warnings.push('Proveedor no existe en BD')
      } else if (dias === null) {
        warnings.push('Nunca usado')
      }

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

    // Proveedores únicos sin email / sin CBU
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

    const output: PreviewLoteOutput = {
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

    return NextResponse.json(output)

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────────────────────────
// Carga items desde sus tablas según tipo
// ──────────────────────────────────────────────────────────────────

async function cargarItems(empresa: Empresa, items: Array<{ tipo: string; id: string; schema?: string }>): Promise<ItemRaw[]> {
  const schemaEmpresa = empresaToSchema(empresa)
  const out: ItemRaw[] = []

  // Agrupar por tipo para queries batch
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
      // Si tiene grupo, no debería ir como FC suelta (es responsabilidad del cliente)
      const monto = Number(f.monto_a_abonar ?? f.imp_total ?? 0)
      out.push({
        tipo: 'fc',
        id: f.id,
        schema: schemaEmpresa,
        cuit: f.cuit,
        razon_social: f.denominacion_emisor,
        monto,
        descripcion: `FC ${f.numero_desde || ''}`.trim(),
        moneda: f.moneda || 'ARS',
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
        tipo: 'cuota_template',
        id: c.id,
        cuit,
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
        tipo: 'anticipo',
        id: a.id,
        cuit,
        razon_social: a.nombre_proveedor,
        monto: Number(a.monto_restante ?? a.monto ?? 0),
        descripcion: `ANT ${a.id.slice(0, 6)}`,
        moneda: 'ARS',
      })
    })
  }

  // Grupos de pago
  if (porTipo['grupo']?.length) {
    const { data: grupos } = await supabaseAdmin.schema(schemaEmpresa).from('grupos_pago')
      .select('id, cuit, proveedor, monto_total')
      .in('id', porTipo['grupo'])
    for (const g of grupos || []) {
      // Verificar que todos los items del grupo tengan el mismo CUIT
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
        tipo: 'grupo',
        id: g.id,
        schema: schemaEmpresa,
        cuit: cuitsTodos[0] || g.cuit,
        razon_social: g.proveedor,
        monto: Number(g.monto_total || 0),
        descripcion: `G ${g.proveedor?.slice(0, 8) || ''}`.trim(),
        moneda: 'ARS',
        bloqueante,
      })
    }
  }

  // Sueldos
  if (porTipo['sueldo']?.length) {
    const { data: pagos } = await supabaseAdmin.schema('sueldos').from('pagos')
      .select('id, empleado_id, monto, descripcion, tipo')
      .in('id', porTipo['sueldo'])
    const empIds = [...new Set((pagos || []).map((p: any) => p.empleado_id))]
    const { data: empleados } = empIds.length
      ? await supabaseAdmin.schema('sueldos').from('empleados')
          .select('id, nombre, cuit_empleado')
          .in('id', empIds)
      : { data: [] }
    const empMap = new Map<string, any>()
    ;(empleados || []).forEach((e: any) => empMap.set(e.id, e))
    ;(pagos || []).forEach((p: any) => {
      const e = empMap.get(p.empleado_id)
      const cuit = (e?.cuit_empleado || '').replace(/\D/g, '')
      out.push({
        tipo: 'sueldo',
        id: p.id,
        cuit,
        razon_social: e?.nombre,
        monto: Number(p.monto || 0),
        descripcion: `SLDO ${e?.nombre?.split(' ')[0] || ''}`.trim(),
        moneda: 'ARS',
      })
    })
  }

  return out
}
