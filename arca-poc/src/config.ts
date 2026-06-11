import 'dotenv/config'
import { pedirPassword } from './prompt.js'

export interface CredencialesArca {
  cuitPersonal: string
  password: string
  cuitEmpresa: string
  empresa: 'MSA' | 'PAM' | 'MA'
}

/**
 * Devuelve las credenciales de ARCA para una empresa.
 * Si la password NO está en .env, la pide por terminal (sin mostrarla).
 * Los CUIT sí pueden estar en .env (no son secretos).
 */
export async function getCredenciales(empresa: 'MSA' | 'PAM' | 'MA'): Promise<CredencialesArca> {
  const reqEnv = (key: string): string => {
    const v = process.env[key]
    if (!v) throw new Error(`Falta variable de entorno: ${key}. Editá .env`)
    return v
  }

  if (empresa === 'MA') {
    const cuitPersonal = reqEnv('ARCA_CUIT_PERSONAL_MA')
    let password = process.env.ARCA_PASSWORD_PERSONAL_MA
    if (!password) {
      password = await pedirPassword(`🔐 Ingresá la clave fiscal del CUIT ${cuitPersonal} (MA): `)
    }
    return {
      cuitPersonal,
      password,
      cuitEmpresa: cuitPersonal,   // En MA logueás directo con el CUIT de la empresa
      empresa: 'MA',
    }
  }

  const cuitPersonal = reqEnv('ARCA_CUIT_PERSONAL')
  let password = process.env.ARCA_PASSWORD_PERSONAL
  if (!password) {
    password = await pedirPassword(`🔐 Ingresá tu clave fiscal del CUIT ${cuitPersonal}: `)
  }
  return {
    cuitPersonal,
    password,
    cuitEmpresa: empresa === 'MSA' ? reqEnv('ARCA_CUIT_EMPRESA_MSA') : reqEnv('ARCA_CUIT_EMPRESA_PAM'),
    empresa,
  }
}

export const PARAMS = {
  fechaDesde: process.env.ARCA_FECHA_DESDE || '2026-05-01',
  fechaHasta: process.env.ARCA_FECHA_HASTA || '2026-05-31',
  tipo: (process.env.ARCA_TIPO || 'recibidos') as 'recibidos' | 'emitidos',
  empresa: (process.env.ARCA_EMPRESA || 'MSA') as 'MSA' | 'PAM' | 'MA',
}

// URLs base
export const URLS = {
  LOGIN: 'https://auth.afip.gob.ar/contribuyente_/login.xhtml',
  PORTAL_BASE: 'https://serviciosweb.afip.gob.ar/genericos/comprobantes/',
  MIS_COMPROBANTES: 'https://serviciosweb.afip.gob.ar/genericos/comprobantes/',
}
