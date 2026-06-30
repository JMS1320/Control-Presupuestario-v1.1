/**
 * POST /api/sueldos/cuenta-empleado
 *
 * Crea/actualiza la cuenta bancaria de un empleado (sueldos.cuentas_empleado).
 * Usado por el modal de export Galicia para registrar al vuelo el alias/grupo/concepto
 * cuando faltan datos para largar el pago.
 *
 * Body: { empleado_id (req), cuenta_id?, banco?, alias?, grupo_export?, concepto? }
 *  - Si viene cuenta_id → actualiza esa cuenta.
 *  - Si no → actualiza la única cuenta del empleado, o crea una nueva si no tiene.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { empleado_id, cuenta_id, banco, alias, grupo_export, concepto } = body
    if (!empleado_id) {
      return NextResponse.json({ ok: false, error: 'empleado_id requerido' }, { status: 400 })
    }

    const campos: Record<string, any> = {}
    if (banco !== undefined) campos.banco = banco ? String(banco).trim() : null
    if (alias !== undefined) campos.alias = alias ? String(alias).trim() : null
    if (grupo_export !== undefined) campos.grupo_export = grupo_export ? String(grupo_export).trim() : null
    if (concepto !== undefined) campos.concepto = concepto ? String(concepto).trim() : null

    const db = supabaseAdmin.schema('sueldos')

    // Determinar a qué cuenta aplicar
    let targetId: string | null = cuenta_id || null
    if (!targetId) {
      const { data: existentes } = await db.from('cuentas_empleado')
        .select('id, activo').eq('empleado_id', empleado_id)
      const lista = existentes || []
      const activas = lista.filter((c: any) => c.activo !== false)
      if (activas.length === 1) targetId = activas[0].id
      else if (lista.length === 1) targetId = lista[0].id
    }

    if (targetId) {
      const { error } = await db.from('cuentas_empleado').update(campos).eq('id', targetId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, cuenta_id: targetId })
    }

    // No hay cuenta → crear una
    const { data, error } = await db.from('cuentas_empleado')
      .insert({ empleado_id, activo: true, ...campos })
      .select('id').single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, cuenta_id: data?.id })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message || 'Error desconocido' }, { status: 500 })
  }
}
