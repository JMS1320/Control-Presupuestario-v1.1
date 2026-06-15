/**
 * Punto de entrada del módulo lib/arca.
 *
 * Función pública: descargarComprobantesArca({ empresa, password, fechaDesde, fechaHasta, tipo })
 *
 * Lee SOLO los CUIT de variables de entorno (no son secretos):
 *   - ARCA_CUIT_PERSONAL          (CUIT que loguea para MSA/PAM)
 *   - ARCA_CUIT_EMPRESA_MSA       (CUIT a representar — MSA SRL)
 *   - ARCA_CUIT_PERSONAL_MA       (CUIT para entrar a MA)
 *
 * La password se recibe POR PARÁMETRO (el usuario la ingresa en el modal
 * de la app cada vez). Nunca se guarda en disco ni en BD ni en env vars.
 */

import { loginArca } from './login'
import { descargarMisComprobantes, type DescargaResult } from './descargar'

export type Empresa = 'MSA' | 'MA'
export type Tipo = 'recibidos' | 'emitidos'

export interface DescargarArcaInput {
  empresa: Empresa
  password: string             // ingresada por el usuario en el modal (no en env)
  fechaDesde: string           // YYYY-MM-DD
  fechaHasta: string           // YYYY-MM-DD
  tipo?: Tipo                  // default: 'recibidos'
}

function getCuits(empresa: Empresa): { cuitPersonal: string; cuitEmpresa: string } {
  const req = (k: string): string => {
    const v = process.env[k]
    if (!v) throw new Error(`Falta variable de entorno: ${k}`)
    return v
  }

  if (empresa === 'MA') {
    const cuitPersonal = req('ARCA_CUIT_PERSONAL_MA')
    return {
      cuitPersonal,
      cuitEmpresa: cuitPersonal,   // En MA loguea directo (no hay representado)
    }
  }
  return {
    cuitPersonal: req('ARCA_CUIT_PERSONAL'),
    cuitEmpresa: req(empresa === 'MSA' ? 'ARCA_CUIT_EMPRESA_MSA' : 'ARCA_CUIT_EMPRESA_PAM'),
  }
}

/**
 * Función principal — descarga comprobantes de ARCA, devuelve CSV adaptado.
 *
 * IMPORTANTE: esta función NO inserta nada en BD.
 *             El CSV devuelto se pasa al endpoint /api/import-facturas-arca
 *             que ya tiene anti-duplicados y reglas testeadas.
 */
export async function descargarComprobantesArca(input: DescargarArcaInput): Promise<DescargaResult> {
  if (!input.password || input.password.trim().length === 0) {
    throw new Error('Falta password (debe ser ingresada por el usuario)')
  }
  const cuits = getCuits(input.empresa)

  const client = await loginArca({
    cuitPersonal: cuits.cuitPersonal,
    password: input.password,
  })

  const result = await descargarMisComprobantes(client, {
    cuitPersonal: cuits.cuitPersonal,
    cuitEmpresa: cuits.cuitEmpresa,
    fechaDesde: input.fechaDesde,
    fechaHasta: input.fechaHasta,
    tipo: input.tipo || 'recibidos',
  })

  return result
}

export type { DescargaResult }
