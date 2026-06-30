/**
 * Helpers para el módulo Lotes Galicia.
 */

/** Valida formato CBU: 22 dígitos numéricos sin guiones ni espacios */
export function validarCBU(cbu: string | null | undefined): boolean {
  if (!cbu) return false
  const clean = String(cbu).replace(/\s/g, '')
  return /^\d{22}$/.test(clean)
}

/** Valida formato Alias: 6-20 caracteres letras+números+guion medio+puntos */
export function validarAlias(alias: string | null | undefined): boolean {
  if (!alias) return false
  const clean = String(alias).trim()
  if (clean.length < 6 || clean.length > 20) return false
  return /^[a-zA-Z0-9.\-]+$/.test(clean)
}

/**
 * Devuelve el destinatario válido a usar en el Excel.
 * Prioridad: CBU > Alias > null (si null, no se puede transferir)
 */
export function obtenerDestinatarioValido(prov: {
  cbu: string | null | undefined
  alias_cbu: string | null | undefined
}): { valor: string; tipo: 'CBU' | 'Alias' } | null {
  if (validarCBU(prov.cbu)) return { valor: String(prov.cbu).replace(/\s/g, ''), tipo: 'CBU' }
  if (validarAlias(prov.alias_cbu)) return { valor: String(prov.alias_cbu).trim(), tipo: 'Alias' }
  return null
}

/**
 * Formatea importe al formato esperado por Galicia: "150,000.00"
 * - Punto decimal con 2 decimales
 * - Coma para miles
 */
export function formatearImporteGalicia(monto: number): string {
  // Galicia exige: SIN separador de miles y coma como decimal. Ej: 1234567,89
  return (Number(monto) || 0).toFixed(2).replace('.', ',')
}

/**
 * Abrevia la descripción a 12 caracteres (máximo del banco).
 * Estrategias por tipo de item:
 *   - fc:           "FC " + numero            ej: "FC 6152"
 *   - cuota_template: "TPL " + id             ej: "TPL 1234"
 *   - anticipo:     "ANT " + parte_id          ej: "ANT a1b2c"
 *   - grupo:        "G " + nombre              ej: "G ALCORTA"
 *   - sueldo:       "SLDO " + nombre           ej: "SLDO JUAN"
 */
export function abreviarDescripcion(tipo: string, raw: string): string {
  const s = (raw || '').toUpperCase().slice(0, 12)
  return s.length > 0 ? s : tipo.slice(0, 12).toUpperCase()
}

/**
 * Calcula días desde una fecha ISO.
 * Devuelve null si la fecha es null/inválida.
 */
export function diasDesde(fecha: string | null | undefined): number | null {
  if (!fecha) return null
  try {
    const d = new Date(fecha)
    if (isNaN(d.getTime())) return null
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

/** Motivo sugerido según tipo de item */
export function motivoSugerido(tipo: string): string {
  switch (tipo) {
    case 'fc': return 'Factura'
    case 'cuota_template': return 'Varios'
    case 'anticipo': return 'Factura'
    case 'grupo': return 'Factura'
    case 'sueldo': return 'Acreditamiento de haberes'
    default: return 'Varios'
  }
}

/** Mapea Empresa → schema BD */
export function empresaToSchema(e: 'MSA' | 'PAM' | 'MA'): 'msa' | 'pam' | 'ma' {
  return e.toLowerCase() as 'msa' | 'pam' | 'ma'
}

/** Genera nombre de archivo Excel */
export function nombreArchivoLote(opts: {
  empresa: string
  fechaPago: string         // YYYY-MM-DD
  tipo: 'pagos' | 'sueldos'
  grupo?: string            // grupo_export de sueldos (va al nombre para distinguir archivos)
  parteN?: number           // si se parte por límite 50
  parteTotal?: number
}): string {
  const fechaCorta = opts.fechaPago.replace(/-/g, '')
  const tipoTxt = opts.tipo === 'sueldos' ? 'Sueldos' : 'Pagos'
  // El grupo "general" (o vacío) no se nombra; los demás sí, para distinguir los archivos.
  const grupoTxt = opts.grupo && opts.grupo !== 'general'
    ? ` ${opts.grupo.charAt(0).toUpperCase()}${opts.grupo.slice(1)}`
    : ''
  const parte = opts.parteTotal && opts.parteTotal > 1
    ? ` (${opts.parteN}-${opts.parteTotal})`
    : ''
  return `Galicia ${opts.empresa} ${tipoTxt}${grupoTxt} ${fechaCorta}${parte}.xlsx`
}
