/**
 * EL REGISTRO DE RECURSOS PERMISABLES — A-FEAT-169
 *
 * Qué se puede permisar dentro de cada sección. Hasta acá el permiso era **por solapa entera**
 * (`roles.secciones`), así que dar acceso a una tarea chica obligaba a abrir todo lo demás — que
 * es lo que traba delegar (§ la quinta pieza, en `CLAUDE.md`).
 *
 * ⚠️ **ESTE ARCHIVO ES UNA DECLARACIÓN, NO LA VERDAD.** Las pestañas viven sueltas dentro de cada
 * `vista-*.tsx`; acá se listan para poder asignarles permisos. Si alguien agrega una pestaña y no
 * la registra, queda **sin permiso asignable** y nadie se entera — es el modo de falla de
 * § Templates: se asume un default y el número queda mal sin avisar.
 * 🧮 Por eso existe su control: `npm run verificar:recursos` vuelve a leer los `TabsTrigger` del
 * código y los compara contra esta lista. Es "el mismo dato por dos caminos".
 *
 * RELEVADO DEL CÓDIGO el 2026-09-24, midiendo anidamiento y si el `<Tabs>` está dentro de un
 * `<Dialog>`. Esa distinción no es cosmética:
 *   · `pestana`       — navegación de primer nivel. Se muestra o no se muestra.
 *   · `funcionalidad` — vive dentro de un modal: es algo que se HACE, no un lugar donde se está.
 * Mezclarlas daba un registro falso: en Extracto parecía haber 12 pestañas hermanas y en realidad
 * son 4 pestañas + 8 funcionalidades repartidas en tres modales distintos.
 */

export type TipoRecurso = "pestana" | "funcionalidad"

export type Recurso = {
  /** `seccion.id` — la clave con la que se guarda el permiso. */
  id: string
  seccion: string
  etiqueta: string
  tipo: TipoRecurso
  /** Dónde vive en el código. Lo usa el control para saber dónde buscar. */
  archivo: string
}

/** Las 12 secciones, en el orden del menú. Debe coincidir con `SECCIONES_IDS` de `permisos.ts`. */
export const SECCIONES: { id: string; etiqueta: string }[] = [
  { id: "principal",    etiqueta: "Principal" },
  { id: "dashboard",    etiqueta: "Dashboard" },
  { id: "distribucion", etiqueta: "Distribución Socios" },
  { id: "reporte",      etiqueta: "Reporte Detallado" },
  { id: "egresos",      etiqueta: "Egresos" },
  { id: "ingresos",     etiqueta: "Ingresos" },
  { id: "cashflow",     etiqueta: "Cash Flow" },
  { id: "extracto",     etiqueta: "Extracto Bancario" },
  { id: "productivo",   etiqueta: "Productivo" },
  { id: "sueldos",      etiqueta: "Sueldos" },
  { id: "presupuesto",  etiqueta: "Presupuesto" },
  { id: "importar",     etiqueta: "Importar Excel" },
]

const EGRESOS = "components/vista-egresos.tsx"
const EXTRACTO = "components/vista-extracto-bancario.tsx"
const PRODUCTIVO = "components/vista-sector-productivo.tsx"
const CASHFLOW = "components/vista-cash-flow.tsx"

export const RECURSOS: Recurso[] = [
  // ── Egresos ──────────────────────────────────────────────────────────────────────────────
  { id: "egresos.facturas-msa", seccion: "egresos", etiqueta: "Facturas MSA",        tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.facturas-pam", seccion: "egresos", etiqueta: "Facturas PAM",        tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.facturas-ma",  seccion: "egresos", etiqueta: "Facturas MA",         tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.templates",    seccion: "egresos", etiqueta: "Egresos sin Factura", tipo: "pestana", archivo: EGRESOS },

  // ── Extracto Bancario ────────────────────────────────────────────────────────────────────
  { id: "extracto.movimientos", seccion: "extracto", etiqueta: "Movimientos", tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.importar",    seccion: "extracto", etiqueta: "Importar",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.reportes",    seccion: "extracto", etiqueta: "Reportes",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.auditoria",   seccion: "extracto", etiqueta: "Auditoría",   tipo: "pestana", archivo: EXTRACTO },
  // Las reglas — viven en un modal de configuración, no en la navegación.
  { id: "extracto.conciliacion",     seccion: "extracto", etiqueta: "Reglas de conciliación",   tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.contable-interno", seccion: "extracto", etiqueta: "Reglas contable e interno", tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.parseo",           seccion: "extracto", etiqueta: "Reglas de parseo",          tipo: "funcionalidad", archivo: EXTRACTO },
  // Asignar un movimiento a su contrapartida — el modal de conciliación manual.
  { id: "extracto.template", seccion: "extracto", etiqueta: "Asignar a template",    tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.arca",     seccion: "extracto", etiqueta: "Asignar a factura ARCA", tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.sueldo",   seccion: "extracto", etiqueta: "Asignar a sueldo",       tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.grupo",    seccion: "extracto", etiqueta: "Asignar a grupo de pago", tipo: "funcionalidad", archivo: EXTRACTO },
  { id: "extracto.venta",    seccion: "extracto", etiqueta: "Asignar a venta",        tipo: "funcionalidad", archivo: EXTRACTO },

  // ── Productivo ───────────────────────────────────────────────────────────────────────────
  { id: "productivo.hacienda",  seccion: "productivo", etiqueta: "Hacienda",            tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.evolucion", seccion: "productivo", etiqueta: "Evolución Rodeo",     tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.cria",      seccion: "productivo", etiqueta: "Cría",                tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.recria",    seccion: "productivo", etiqueta: "Recría / Engorde",    tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.insumos",   seccion: "productivo", etiqueta: "Insumos",             tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.lotes",     seccion: "productivo", etiqueta: "Lotes Agrícolas",     tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.stock",     seccion: "productivo", etiqueta: "Stock y Movimientos", tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.ordenes",   seccion: "productivo", etiqueta: "Órdenes de Aplicación", tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.compras",   seccion: "productivo", etiqueta: "Necesidad de Compra", tipo: "pestana", archivo: PRODUCTIVO },

  // ── Cash Flow ────────────────────────────────────────────────────────────────────────────
  { id: "cashflow.nuevo",      seccion: "cashflow", etiqueta: "Cargar anticipo",     tipo: "funcionalidad", archivo: CASHFLOW },
  { id: "cashflow.existentes", seccion: "cashflow", etiqueta: "Anticipos existentes", tipo: "funcionalidad", archivo: CASHFLOW },
]

/**
 * Secciones que NO tienen nada adentro que permisar hoy — y el motivo, que importa más que la lista:
 * si alguien la lee y ve un hueco, tiene que saber si es un olvido o una decisión.
 */
export const SIN_RECURSOS: Record<string, string> = {
  principal:    "Es la pantalla de inicio: lo que muestra ya lo elige cada persona con sus widgets, y cada widget respeta el permiso de SU sección.",
  dashboard:    "Una sola vista con filtros. No tiene partes separables.",
  distribucion: "Una sola vista con filtros.",
  reporte:      "Una sola vista con filtros.",
  ingresos:     "⚠️ Sus pestañas se GENERAN por empresa y por vista, así que no se pueden listar acá. Permisarlas pide resolverlas en tiempo de ejecución — pendiente.",
  sueldos:      "Hoy es una sola vista sin pestañas.",
  presupuesto:  "Una sola grilla. El botón de Proveedores abre un panel, no una sección aparte.",
  importar:     "Un solo importador.",
}

/** Los recursos de una sección, en el orden declarado. */
export function recursosDe(seccion: string): Recurso[] {
  return RECURSOS.filter((r) => r.seccion === seccion)
}
