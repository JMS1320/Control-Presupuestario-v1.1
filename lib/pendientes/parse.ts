// ════════════════════════════════════════════════════════════════════════════
// Parser del índice de PENDIENTES.md
//
// `PENDIENTES.md` es la FUENTE ÚNICA de los pendientes (CLAUDE.md § dimensión 1). El panel de la
// app lo **lee**; no hay copia en base de datos, porque una copia se desincroniza al primer commit.
// Ver PENDIENTES § P-37.
//
// ── Por qué se parsea por ENCABEZADO y no por posición ──────────────────────
// El índice no es un formato, es prosa disciplinada escrita a mano. Hay **10 formas distintas de
// encabezado** en 16 tablas, con 3, 4 o 5 columnas:
//     | ID | Estado | Ítem |
//     | ID | Estado | Prio | Ítem | Detalle |
//     | ID | Estado | Tipo | Tema | Detalle |
//     | ID | Est    | Ítem |                     … etc.
// Todas arrancan con ID + Estado, así que se mapean las columnas **por nombre de encabezado**.
// Leer por posición daría "Alta" como título en unas tablas y la descripción en otras.
//
// ── La regla que no se negocia ──────────────────────────────────────────────
// **Nada se descarta en silencio.** Toda línea que parezca un pendiente y no se haya podido leer
// vuelve en `noParseadas`, con su número de línea y el motivo. Si el panel muestra 160 de 166 sin
// decir nada, volvimos al modo de falla de este proyecto: el dato que desaparece sin avisar.
// ════════════════════════════════════════════════════════════════════════════

export type GrupoPendiente = 'urgente' | 'secundario' | 'test' | 'hecho'

/**
 * Las 12 solapas reales de la app (`dashboard.tsx`). Es la lista contra la que se valida cada
 * marca `@pantalla` — si no está acá, la marca está mal escrita.
 */
export const PANTALLAS = [
  'principal', 'dashboard', 'distribucion', 'reporte', 'egresos', 'ingresos',
  'cashflow', 'extracto', 'productivo', 'sueldos', 'presupuesto', 'importar',
] as const
export type Pantalla = typeof PANTALLAS[number]

/**
 * Marca de ubicación dentro del texto del ítem: `` `@cashflow` `` o `@cashflow`.
 *
 * Va en el TEXTO y no en una columna nueva porque el índice tiene 16 tablas con 10 formas de
 * encabezado distintas: una columna habría que agregarla a las 16 y ensancharlas todas. La marca
 * funciona igual en cualquier forma de tabla.
 *
 * Admite **varias** (`@cashflow @extracto`) porque un pendiente puede incidir en más de una
 * pantalla, y admite sub-nivel opcional (`@ingresos/subdiarios`): manda el prefijo, el resto es
 * detalle. Así se etiqueta grueso hoy y se afina después sin rehacer nada.
 *
 * ⚠️ El `@` NO puede venir pegado a una palabra: si no, un mail del texto
 * (`go@bancogalicia.com.ar`) se leía como marca. Lo detectó el control al reportar `@gmail`.
 */
const RE_MARCA = /(?<![\w.@-])`?@([a-z]+)(\/[a-z0-9-]+)?`?/gi

export interface Pendiente {
  id: string
  /** Crudo, como está en el archivo: 🔴 · 🟡 · ✅ · ⏸️ … */
  estado: string
  prioridad: string | null
  tipo: string | null
  titulo: string
  detalle: string | null
  /** Ancla del dossier (`a-bug-27`) si la fila enlaza a uno. */
  ancla: string | null
  /** El `## …` bajo el que vive la fila, para dar contexto. */
  seccion: string | null
  linea: number
  grupo: GrupoPendiente
  /**
   * En qué pantallas se muestra. **Vacío = "sin ubicar" → se muestra en TODAS.**
   * Así el invariante *"todo pendiente aparece en alguna pantalla"* se cumple por construcción:
   * o tiene marcas y aparece en las suyas, o no tiene y aparece en todas.
   */
  pantallas: Pantalla[]
  /** El sub-nivel de cada marca (`@ingresos/subdiarios` → `subdiarios`), si lo tiene. */
  subPantallas: string[]
  /** Marcas que NO coinciden con ninguna solapa real: error de tipeo. Ver `marcasDesconocidas`. */
  marcasInvalidas: string[]
}

export interface FilaNoParseada {
  linea: number
  texto: string
  motivo: string
}

export interface ResultadoPendientes {
  pendientes: Pendiente[]
  /** 🚨 Anomalías: parecen del índice y no se pudieron leer. Esto SÍ es una alarma. */
  noParseadas: FilaNoParseada[]
  /**
   * Filas que empiezan con un ID pero viven en una tabla de DOSSIER (encabezado `| # | Qué |
   * Detalle |` y similares), no en el índice. No son un problema: son texto explicativo que
   * menciona un ID.
   *
   * Van aparte y no a `noParseadas` a propósito: si el panel avisara "7 no parseadas" siempre,
   * en dos semanas nadie miraría ese aviso y el día que aparezca una anomalía de verdad pasaría
   * desapercibida. Igual quedan visibles — no se descarta nada en silencio.
   */
  ignoradas: FilaNoParseada[]
  /** Parseadas + no parseadas + ignoradas. Para el control "no se perdió ninguna". */
  totalDetectadas: number
  /**
   * 🚨 Marcas `@algo` que no son ninguna de las 12 solapas — casi siempre un tipeo (`@cashflows`).
   * Es el ÚNICO camino por el que un pendiente podría no mostrarse en ningún lado, así que se
   * reporta fuerte. El pendiente igual cae a "sin ubicar" y sigue visible: se avisa del error,
   * no se esconde el ítem.
   */
  marcasDesconocidas: { marca: string; ids: string[] }[]
}

/** Una fila del índice: `| A-BUG-27 | …` o `| **A-BUG-27** | …`. */
const RE_FILA_PENDIENTE = /^\|\s*\*{0,2}([A-Z]-[A-Z]+-[A-Z0-9-]+|[A-Z]-[A-Z]+|[A-Z]+-[0-9]+|P-[0-9]+|C-[0-9]+)\*{0,2}\s*\|/
const RE_SEPARADOR = /^\|[\s:|-]+\|$/
const RE_ENCABEZADO = /^\|\s*ID\s*\|/i

/** Normaliza el nombre de una columna a una clave interna. Cubre las 10 formas del archivo. */
function claveDeColumna(nombre: string): string | null {
  const n = nombre.toLowerCase().replace(/\*/g, '').trim()
  if (n === 'id') return 'id'
  if (n === 'estado' || n === 'est') return 'estado'
  if (n === 'prio' || n === 'prioridad') return 'prioridad'
  if (n === 'tipo') return 'tipo'
  if (n === 'ítem' || n === 'item' || n.startsWith('tema')) return 'titulo'
  // Todo lo que va al final es contexto: detalle, verificación, nota, "por qué dudoso"…
  if (n === 'detalle' || n === 'verificación' || n === 'verificacion' || n === 'nota'
      || n.startsWith('por qué') || n.startsWith('por que')) return 'detalle'
  return null
}

function celdas(linea: string): string[] {
  // Se saca el pipe inicial y el final antes de cortar, si no aparecen celdas fantasma.
  const t = linea.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split('|').map(c => c.trim())
}

/** Markdown → texto plano, para que el panel no muestre asteriscos ni backticks. */
function limpiar(md: string): string {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // [texto](link) → texto
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
}

function anclaDe(texto: string): string | null {
  const m = texto.match(/\(#([a-z0-9-]+)\)/i)
  return m ? m[1] : null
}

/**
 * Saca las marcas `@pantalla` del texto y las valida contra las 12 solapas reales.
 *
 * Devuelve también el texto **sin las marcas**: en el panel se ve el título limpio, la marca es
 * metadato, no parte de la descripción.
 */
function extraerMarcas(texto: string): {
  limpio: string; pantallas: Pantalla[]; subPantallas: string[]; invalidas: string[]
} {
  const pantallas: Pantalla[] = []
  const subPantallas: string[] = []
  const invalidas: string[] = []

  const limpio = texto.replace(RE_MARCA, (_m, nombre: string, sub?: string) => {
    const n = nombre.toLowerCase()
    if ((PANTALLAS as readonly string[]).includes(n)) {
      if (!pantallas.includes(n as Pantalla)) pantallas.push(n as Pantalla)
      if (sub) subPantallas.push(sub.slice(1))
    } else {
      // No se traga el error: se reporta y el ítem queda "sin ubicar" (visible en todas).
      invalidas.push(n)
    }
    return ''
  })

  return { limpio: limpio.replace(/\s{2,}/g, ' ').trim(), pantallas, subPantallas, invalidas }
}

/**
 * ¿En qué pantallas se muestra este pendiente? **Sin marcas → en todas.**
 * Es la función que hace cierto el invariante que pidió el usuario: *"el control duro de que todo
 * esté siendo mostrado en alguna de las pantallas, aunque sea sin ubicar"*.
 */
export function pantallasDe(p: Pick<Pendiente, 'pantallas'>): readonly Pantalla[] {
  return p.pantallas.length > 0 ? p.pantallas : PANTALLAS
}

/**
 * A qué grupo va cada pendiente. **Es la única regla de negocio del parser** y está acá sola a
 * propósito: agrupar distinto es cambiar esta función, no tocar el parseo.
 *
 * Criterio acordado con el usuario: *"pendiente de test abajo de todo, pendiente secundario,
 * pendiente urgente"*.
 */
export function grupoDe(p: { id: string; estado: string; prioridad: string | null; tipo: string | null }): GrupoPendiente {
  const estado = p.estado
  if (estado.includes('✅')) return 'hecho'

  const esTest = /-TEST-/.test(p.id) || (p.tipo || '').toLowerCase().startsWith('test')
  // 🟡 en este proyecto significa "hecho, falta testear" → es trabajo de test, no un pendiente vivo.
  if (esTest || estado.includes('🟡')) return 'test'

  const prio = (p.prioridad || '').toLowerCase()
  const tipo = (p.tipo || '').toLowerCase()
  if (prio.startsWith('alta') || tipo.startsWith('bug')) return 'urgente'
  return 'secundario'
}

export function parsePendientes(md: string): ResultadoPendientes {
  const lineas = md.split(/\r?\n/)
  const pendientes: Pendiente[] = []
  const noParseadas: FilaNoParseada[] = []
  const ignoradas: FilaNoParseada[] = []

  let seccion: string | null = null
  /** Mapa columna→clave de la tabla del índice en curso. null = no estamos en una. */
  let columnas: (string | null)[] | null = null
  /** true = estamos dentro de una tabla cuyo encabezado NO es `| ID | …` (o sea, de dossier). */
  let enTablaAjena = false

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]
    const nro = i + 1

    if (linea.startsWith('#')) {
      if (linea.startsWith('## ')) seccion = limpiar(linea.replace(/^##\s*/, ''))
      columnas = null                       // un título nuevo cierra la tabla anterior
      enTablaAjena = false
      continue
    }

    if (linea.trim().startsWith('|') && !RE_SEPARADOR.test(linea)) {
      // ¿Es la fila de encabezado de una tabla? Lo es si venimos de fuera de toda tabla.
      if (columnas === null && !enTablaAjena) {
        if (RE_ENCABEZADO.test(linea)) { columnas = celdas(linea).map(claveDeColumna); continue }
        // Encabezado de otra cosa (`| # | Qué | Detalle |`): las filas de adentro no son del índice.
        if (!RE_FILA_PENDIENTE.test(linea)) { enTablaAjena = true; continue }
      }
    }
    if (RE_SEPARADOR.test(linea)) continue

    if (!RE_FILA_PENDIENTE.test(linea)) {
      if (!linea.trim().startsWith('|')) { columnas = null; enTablaAjena = false }  // se salió de la tabla
      continue
    }

    // Desde acá, la línea PARECE un pendiente: o se parsea, o se reporta. Nunca se descarta.
    if (enTablaAjena) {
      ignoradas.push({ linea: nro, texto: linea.slice(0, 160), motivo: 'menciona un ID pero está en una tabla de dossier, no en el índice' })
      continue
    }
    if (!columnas) {
      noParseadas.push({ linea: nro, texto: linea.slice(0, 160), motivo: 'fila de pendiente fuera de una tabla con encabezado `| ID | …`' })
      continue
    }

    const c = celdas(linea)
    const campo = (clave: string): string | null => {
      const idx = columnas!.indexOf(clave)
      return idx >= 0 && idx < c.length ? c[idx] : null
    }

    const id = limpiar(campo('id') || '')
    if (!id) {
      noParseadas.push({ linea: nro, texto: linea.slice(0, 160), motivo: 'no se pudo leer el ID' })
      continue
    }

    // El título es la columna Ítem/Tema; si la tabla no la tiene, se cae a la última celda con texto.
    const tituloCrudo = campo('titulo') ?? c.slice(2).find(x => x.length > 0) ?? ''
    const detalleCrudo = campo('detalle')
    // Las marcas pueden estar en el ítem o en el detalle: se buscan en los dos.
    const marcas = extraerMarcas(`${tituloCrudo} ${detalleCrudo ?? ''}`)
    const titulo = limpiar(extraerMarcas(tituloCrudo).limpio)
    if (!titulo) {
      noParseadas.push({ linea: nro, texto: linea.slice(0, 160), motivo: 'fila sin texto de ítem' })
      continue
    }

    const base = {
      id,
      estado: (campo('estado') || '').trim(),
      prioridad: campo('prioridad') ? limpiar(campo('prioridad')!) : null,
      tipo: campo('tipo') ? limpiar(campo('tipo')!) : null,
    }

    pendientes.push({
      ...base,
      titulo,
      detalle: detalleCrudo ? limpiar(extraerMarcas(detalleCrudo).limpio) || null : null,
      // El ancla puede estar en el detalle (`→ [A-BUG-27](#a-bug-27)`) o en el propio ítem.
      ancla: anclaDe(detalleCrudo || '') || anclaDe(tituloCrudo),
      seccion,
      linea: nro,
      grupo: grupoDe(base),
      pantallas: marcas.pantallas,
      subPantallas: marcas.subPantallas,
      marcasInvalidas: marcas.invalidas,
    })
  }

  // Marcas mal escritas, agrupadas por marca para que se vea el tipeo de una.
  const porMarca = new Map<string, string[]>()
  pendientes.forEach(p => p.marcasInvalidas.forEach(m => {
    const ids = porMarca.get(m) || []
    if (!ids.includes(p.id)) ids.push(p.id)
    porMarca.set(m, ids)
  }))

  return {
    pendientes, noParseadas, ignoradas,
    totalDetectadas: pendientes.length + noParseadas.length + ignoradas.length,
    marcasDesconocidas: Array.from(porMarca.entries()).map(([marca, ids]) => ({ marca, ids })),
  }
}

/** Cuántos hay en cada grupo — para el resumen del panel. */
export function contarPorGrupo(pendientes: Pendiente[]): Record<GrupoPendiente, number> {
  const out: Record<GrupoPendiente, number> = { urgente: 0, secundario: 0, test: 0, hecho: 0 }
  pendientes.forEach(p => { out[p.grupo]++ })
  return out
}
