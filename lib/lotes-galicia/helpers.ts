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

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 🎯 A-FEAT-1570 — el DESTINO SÓLO PARA ESTA TRANSFERENCIA (nota 🌙 de JMS 05/11, en «Exportar lote Galicia»):
// «son templates que sirven a veces cuando es un CBU diferente; otros gastos tienen distintos destinatarios: debería pedir
// la data para esta transferencia sola. Anticipos a ese CUIT también (se pone porque no se sabe), pero sí se sabe dónde
// transferir». Lo que se escribe acá va al Excel y NO a la ficha del proveedor: un CUIT comodín (11111111111) o un
// template sin proveedor no tienen un destino fijo que guardar.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface DestinoPuntual { cbuAlias?: string | null; email?: string | null }

/** Un CUIT que no identifica a nadie: vacío o el mismo dígito repetido («11111111111», el de «Aún no registrado»). */
export function esCuitComodin(cuit: string | null | undefined): boolean {
  const d = String(cuit ?? '').replace(/\D/g, '')
  return !d || /^(\d)\1+$/.test(d)
}

/** ¿Esta fila pide el destino para esta transferencia sola (en vez de guardarlo en el proveedor)? */
export const pideDestinoPuntual = (it: { tipo: string; proveedor_id: string | null; cuit: string | null }) =>
  it.tipo !== 'sueldo' && (!it.proveedor_id || esCuitComodin(it.cuit))

/** La fila con el destino puntual aplicado: CBU (22 dígitos) o alias, mail, y si queda o no afuera del Excel. Pura. */
export function aplicarDestinoPuntual<T extends { cbu: string | null; alias_cbu: string | null; email_pagos: string | null; excluido_del_excel: boolean; warnings: string[] }>(
  it: T, d: DestinoPuntual | undefined,
): T {
  if (!d || (!d.cbuAlias?.trim() && !d.email?.trim())) return it
  const out = { ...it, warnings: [...it.warnings] }
  const v = d.cbuAlias?.trim()
  if (v) {
    const limpio = v.replace(/\s/g, '')
    if (/^\d{22}$/.test(limpio)) { out.cbu = limpio; out.alias_cbu = null } else { out.alias_cbu = v; out.cbu = null }
  }
  if (d.email?.trim()) out.email_pagos = d.email.trim()
  const ok = validarCBU(out.cbu) || validarAlias(out.alias_cbu)
  out.excluido_del_excel = !ok
  out.warnings = out.warnings.filter(w => !/^Sin CBU ni Alias$|^CBU formato inválido$|^Alias formato inválido$/.test(w) && !(w === 'Sin email' && out.email_pagos))
  if (v && !ok) out.warnings.push(validarCBU(v) ? '' : 'CBU/Alias puntual con formato inválido')
  out.warnings.push('Destino sólo para esta transferencia')
  out.warnings = out.warnings.filter(Boolean)
  return out
}
