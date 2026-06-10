import 'dotenv/config'

export interface CredencialesArca {
  cuitPersonal: string
  password: string
  cuitEmpresa: string
  empresa: 'MSA' | 'PAM' | 'MA'
}

export function getCredenciales(empresa: 'MSA' | 'PAM' | 'MA'): CredencialesArca {
  const reqEnv = (key: string): string => {
    const v = process.env[key]
    if (!v) throw new Error(`Falta variable de entorno: ${key}. Copiá .env.example a .env y completá.`)
    return v
  }

  if (empresa === 'MA') {
    return {
      cuitPersonal: reqEnv('ARCA_CUIT_PERSONAL_MA'),
      password: reqEnv('ARCA_PASSWORD_PERSONAL_MA'),
      cuitEmpresa: reqEnv('ARCA_CUIT_EMPRESA_MA'),
      empresa: 'MA',
    }
  }

  return {
    cuitPersonal: reqEnv('ARCA_CUIT_PERSONAL'),
    password: reqEnv('ARCA_PASSWORD_PERSONAL'),
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

// URLs base — habrá que ajustar contra el portal real al testear
export const URLS = {
  LOGIN: 'https://auth.afip.gob.ar/contribuyente_/login.xhtml',
  PORTAL_BASE: 'https://serviciosweb.afip.gob.ar/genericos/comprobantes/',
  MIS_COMPROBANTES: 'https://serviciosweb.afip.gob.ar/genericos/comprobantes/',
}
