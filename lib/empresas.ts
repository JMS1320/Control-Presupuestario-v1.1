// De qué empresa es una fila — pieza compartida del Cash Flow multiempresa.
//
// El Cash Flow NO es de MSA: es de las tres. Ya mostraba templates de todas (viven en `public`)
// y facturas de una sola (viven en el schema de cada empresa). Ver PENDIENTES § A-FEAT-13.
//
// La empresa es MULTIVALOR: un template puede ser `MSA/PAM` y tiene que aparecer al filtrar
// cualquiera de las dos. No es una convención nueva — el Presupuesto ya lee `responsable` así
// (`tab-presupuesto.tsx`: `responsable.ilike.%MSA%`). Acá se formaliza.

export type Empresa = 'MSA' | 'PAM' | 'MA'

/** Las tres, en el orden en que se muestran. */
export const EMPRESAS: Empresa[] = ['MSA', 'PAM', 'MA']

const CANONICAS = new Set<string>(EMPRESAS)

/**
 * Alias heredados que significan "varias empresas".
 * `ambas` quedó de cuando el sistema tenía dos: el usuario confirmó (2026-08-07) que los que
 * lo tienen (AMS y JMS) son de las tres. Se mapea acá para que la app funcione igual ANTES y
 * DESPUÉS de la migración a `MSA/PAM/MA` (ver RECONSTRUCCION § 2026-08-07).
 */
const ALIAS: Record<string, Empresa[]> = {
  ambas: ['MSA', 'PAM', 'MA'],
}

/**
 * Parsea el campo crudo a la lista de empresas de la fila.
 *
 * Devuelve **todos** los tokens, incluidos los que no son empresa (`Duhau`): se muestran para no
 * perder información, pero `coincideEmpresa` no filtra por ellos.
 *
 *   'MSA'           → ['MSA']
 *   'MSA/PAM'       → ['MSA', 'PAM']
 *   'PAM/MA/Duhau'  → ['PAM', 'MA', 'Duhau']
 *   'ambas'         → ['MSA', 'PAM', 'MA']
 *   null            → []
 */
export function parseEmpresas(valor: string | null | undefined): string[] {
  if (!valor) return []
  const crudo = String(valor).trim()
  const alias = ALIAS[crudo.toLowerCase()]
  if (alias) return [...alias]
  const vistos = new Set<string>()
  const out: string[] = []
  for (const parte of crudo.split('/')) {
    const t = parte.trim()
    if (!t) continue
    // Normaliza mayúsculas sólo si es una de las tres; lo demás se respeta tal cual (`Duhau`)
    const token = CANONICAS.has(t.toUpperCase()) ? t.toUpperCase() : t
    if (vistos.has(token)) continue
    vistos.add(token)
    out.push(token)
  }
  return out
}

/** Las que son empresa de verdad — las únicas por las que se puede filtrar. */
export function empresasCanonicas(empresas: string[]): Empresa[] {
  return empresas.filter((e): e is Empresa => CANONICAS.has(e))
}

/**
 * ¿La fila entra con esta selección de filtro?
 *
 * Basta que **una** de sus empresas esté tildada: un template `MSA/PAM` se muestra al filtrar
 * MSA, al filtrar PAM y sin filtros; al filtrar sólo MA, no.
 *
 * Con la selección vacía no se muestra nada (es un filtro sin nada tildado, no "todo").
 * Una fila **sin empresa reconocible** (sólo `Duhau`, o el campo vacío) se muestra siempre: no
 * se puede filtrar por lo que no se sabe, y esconderla sería perderla en silencio.
 */
export function coincideEmpresa(empresas: string[], seleccionadas: Empresa[]): boolean {
  const propias = empresasCanonicas(empresas)
  if (propias.length === 0) return true
  return propias.some(e => seleccionadas.includes(e))
}

/** Etiqueta corta para la celda: `MSA` · `MSA/PAM` · `PAM/MA/Duhau`. */
export function etiquetaEmpresas(empresas: string[]): string {
  return empresas.length > 0 ? empresas.join('/') : '—'
}

/**
 * Datos fiscales para los encabezados de los reportes (Libro IVA, certificados, detalles de pago).
 *
 * Existe porque los PDF los tenían **hardcodeados a MSA**: el Libro IVA Compras escribía
 * "MARTINEZ SOBRADO AGRO SRL / 30-61778601-6" aunque estuvieras mirando PAM o MA, y el de Ventas
 * imprimía el literal `'CUIT MA'` en el lugar del CUIT.
 *
 * Datos confirmados por el usuario: MA (Mercedes Areco) el 2026-08-18.
 */
export const DATOS_FISCALES: Record<Empresa, { razonSocial: string; cuit: string | null }> = {
  MSA: { razonSocial: 'MARTINEZ SOBRADO AGRO SRL', cuit: '30617786016' },
  PAM: { razonSocial: 'SUCESION DE PLACIDO ALBERTO MARTINEZ', cuit: '20044390222' },
  MA:  { razonSocial: 'MERCEDES ARECO', cuit: '27066824611' },
}

/** CUIT con guiones para encabezados: `30617786016` → `30-61778601-6`. */
export function cuitFormateado(cuit: string | null): string {
  if (!cuit) return ''
  const d = cuit.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : cuit
}

/** Color por empresa, para distinguirlas de un vistazo sin leer. */
export const COLOR_EMPRESA: Record<Empresa, string> = {
  MSA: 'bg-blue-100 text-blue-800 border-blue-200',
  PAM: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MA: 'bg-purple-100 text-purple-800 border-purple-200',
}

/** El schema donde vive lo de esa empresa (facturas, ventas, sicore…). */
export function schemaDeEmpresa(empresa: Empresa): string {
  return empresa.toLowerCase()
}

/**
 * En qué schema hay que ESCRIBIR una fila del Cash Flow.
 *
 * Sale de `origen_tabla` (`pam.comprobantes_arca` → `pam`), que es el dato más directo: dice
 * literalmente de dónde se leyó la fila. Cae a `msa` si no trae nada, para no romper llamadas
 * viejas. Sin esto, el UPDATE de una FC de PAM iba a la tabla de MSA, donde matchea 0 filas y
 * **no falla** — el bug silencioso que motivó A-FEAT-13.
 */
export function schemaDeFila(fila?: { origen_tabla?: string } | null): string {
  const prefijo = fila?.origen_tabla?.split('.')[0]
  return prefijo && prefijo !== 'public' ? prefijo : 'msa'
}

/** ¿La fila es de MSA? Lo que es exclusivo de MSA (SICORE, echeq, agrupar) se pregunta con esto. */
export function esFilaMsa(fila?: { origen_tabla?: string } | null): boolean {
  return schemaDeFila(fila) === 'msa'
}

/**
 * La empresa **de escritura** de una fila: dónde hay que guardar cuando se la edita.
 *
 * Una factura pertenece a un único schema por definición, así que acá el multivalor no existe:
 * si la fila trae varias (sólo puede pasar en templates y sueldos, que viven en `public`),
 * no hay schema de empresa al que escribir y se devuelve `null`.
 */
export function empresaDeEscritura(empresas: string[]): Empresa | null {
  const propias = empresasCanonicas(empresas)
  return propias.length === 1 ? propias[0] : null
}
