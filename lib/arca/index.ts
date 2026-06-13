/**
 * Punto de entrada del módulo lib/arca.
 *
 * Función pública: descargarComprobantesArca({ empresa, fechaDesde, fechaHasta, tipo })
 *
 * Lee credenciales de variables de entorno:
 *   - ARCA_CUIT_PERSONAL / ARCA_PASSWORD_PERSONAL  (loguea a MSA/PAM)
 *   - ARCA_CUIT_PERSONAL_MA / ARCA_PASSWORD_PERSONAL_MA  (loguea a MA)
 *   - ARCA_CUIT_EMPRESA_MSA / ARCA_CUIT_EMPRESA_MA  (CUIT a representar)
 *
 * No expone credenciales al frontend. Solo devuelve el CSV adaptado al
 * formato que ya entiende /api/import-facturas-arca.
 */

import { loginArca } from './login'
import { descargarMisComprobantes, type DescargaResult } from './descargar'

export type Empresa = 'MSA' | 'MA'
export type Tipo = 'recibidos' | 'emitidos'

export interface DescargarArcaInput {
  empresa: Empresa
  fechaDesde: string          // YYYY-MM-DD
  fechaHasta: string          // YYYY-MM-DD
  tipo?: Tipo                 // default: 'recibidos'
}

function getCredenciales(empresa: Empresa): { cuitPersonal: string; password: string; cuitEmpresa: string } {
  const req = (k: string): string => {
    const v = process.env[k]
    if (!v) throw new Error(`Falta variable de entorno: ${k}`)
    return v
  }

  if (empresa === 'MA') {
    const cuitPersonal = req('ARCA_CUIT_PERSONAL_MA')
    return {
      cuitPersonal,
      password: req('ARCA_PASSWORD_PERSONAL_MA'),
      cuitEmpresa: cuitPersonal,   // En MA loguea directo (no hay representado)
    }
  }
  return {
    cuitPersonal: req('ARCA_CUIT_PERSONAL'),
    password: req('ARCA_PASSWORD_PERSONAL'),
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
  const cred = getCredenciales(input.empresa)

  const client = await loginArca({
    cuitPersonal: cred.cuitPersonal,
    password: cred.password,
  })

  const result = await descargarMisComprobantes(client, {
    cuitPersonal: cred.cuitPersonal,
    cuitEmpresa: cred.cuitEmpresa,
    fechaDesde: input.fechaDesde,
    fechaHasta: input.fechaHasta,
    tipo: input.tipo || 'recibidos',
  })

  return result
}

export type { DescargaResult }
