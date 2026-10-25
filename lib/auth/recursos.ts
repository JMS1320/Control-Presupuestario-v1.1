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

/**
 *   · `accion`        — un BOTÓN suelto (no una solapa). El control no lo busca como `TabsTrigger`
 *                       sino como `puedeVer("<id>")` en su archivo: verifica que la pantalla de
 *                       verdad pregunte por el permiso (A-FEAT-1322, etapa 1).
 */
/**
 *   · `cuenta`        — una CUENTA del Extracto (banco, caja o tarjeta), A-FEAT-1336. No es un lugar
 *                       sino sobre QUÉ se trabaja: en todas las solapas de Extracto el rol sólo puede
 *                       elegir las cuentas que tiene, y los importadores lo verifican en el servidor.
 *                       El control las compara contra `CUENTAS_BANCARIAS` (hooks/useMotorConciliacion.ts).
 */
export type TipoRecurso = "pestana" | "funcionalidad" | "accion" | "cuenta"

export type Recurso = {
  /** `seccion.id` — la clave con la que se guarda el permiso. */
  id: string
  seccion: string
  etiqueta: string
  tipo: TipoRecurso
  /**
   * El recurso del que cuelga, si es una **sub-pestaña**. Ej.: Stock vive dentro de Insumos, no
   * al lado de Hacienda. Se descubrió al aplicar los permisos: las tres sub-pestañas estaban en
   * otro componente del archivo, y una medición de anidamiento por texto no lo veía porque ese
   * componente se declara aparte y su `<Tabs>` abre después de que cerró el de arriba.
   */
  padre?: string
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
const FACTURAS = "components/vista-facturas-arca.tsx"

export const RECURSOS: Recurso[] = [
  // ── Egresos ──────────────────────────────────────────────────────────────────────────────
  { id: "egresos.facturas-msa", seccion: "egresos", etiqueta: "Facturas MSA",        tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.facturas-pam", seccion: "egresos", etiqueta: "Facturas PAM",        tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.facturas-ma",  seccion: "egresos", etiqueta: "Facturas MA",         tipo: "pestana", archivo: EGRESOS },
  { id: "egresos.templates",    seccion: "egresos", etiqueta: "Egresos sin Factura", tipo: "pestana", archivo: EGRESOS },
  // A-FEAT-1309: pólizas de seguro y el control «¿tenemos todas?» contra el extracto.
  { id: "egresos.seguros",      seccion: "egresos", etiqueta: "Seguros",             tipo: "pestana", archivo: EGRESOS },
  // A-FEAT-1322 (etapa 1): las solapas DENTRO de Facturas (las mismas para MSA, PAM y MA) y el botón
  // de los archivos para IVA Simple. Hasta acá no tenían casilla: no se podían apagar para un rol.
  { id: "egresos.subdiarios",     seccion: "egresos", etiqueta: "Facturas → Subdiarios",         tipo: "pestana", archivo: FACTURAS },
  { id: "egresos.historico",      seccion: "egresos", etiqueta: "Facturas → Histórico",          tipo: "pestana", archivo: FACTURAS },
  { id: "egresos.asignacion",     seccion: "egresos", etiqueta: "Facturas → Asignación Cuentas", tipo: "pestana", archivo: FACTURAS },
  { id: "egresos.archivos-arca",  seccion: "egresos", etiqueta: "Subdiarios → Archivos para ARCA", tipo: "accion", archivo: FACTURAS },

  // ── Extracto Bancario ────────────────────────────────────────────────────────────────────
  { id: "extracto.movimientos", seccion: "extracto", etiqueta: "Movimientos", tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.importar",    seccion: "extracto", etiqueta: "Importar",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.reportes",    seccion: "extracto", etiqueta: "Reportes",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.auditoria",   seccion: "extracto", etiqueta: "Auditoría",   tipo: "pestana", archivo: EXTRACTO },
  // A-FEAT-1361: todo lo que CONCILIA sin pasar por Asignar — el motor (botón de arriba y el de cada resumen de
  // tarjeta) y el «✓ OK» de los para revisar (uno y masivo). Para Ulises: cargar sin conciliar.
  { id: "extracto.conciliar",   seccion: "extracto", etiqueta: "Conciliar (automático y ✓ OK)", tipo: "accion", archivo: EXTRACTO },
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
  // A-FEAT-1336: las cuentas. Pedido del usuario 24/10 para Ulises: «sólo importar» y sólo MSA cuenta
  // corriente + VISA MSA. Sin esto, prender Importar le daba importar en las 11.
  // ⚠️ El id después de `extracto.cuenta.` es el `id` de CUENTAS_BANCARIAS: no renombrar uno sin el otro.
  ...([
    ["msa_galicia", "MSA Galicia CC Pesos"],
    ["pam_galicia", "PAM Galicia CA Pesos"],
    ["pam_galicia_cc", "PAM Galicia CC Pesos"],
    ["ma_galicia", "MA Galicia CA Pesos"],
    ["caja_general", "Caja General MSA"],
    ["caja_ams", "Caja AMS MSA"],
    ["caja_sigot", "Caja Sigot MSA"],
    ["echeqs_terceros", "Echeqs de terceros MSA"],
    ["tarjeta_visa_business_msa", "VISA Business MSA"],
    ["tarjeta_visa_pam", "VISA PAM"],
    ["tarjeta_visa_ma", "VISA MA"],
  ] as const).map(([id, nombre]): Recurso => ({
    id: `extracto.cuenta.${id}`, seccion: "extracto", etiqueta: `Cuenta → ${nombre}`, tipo: "cuenta", archivo: EXTRACTO,
  })),

  // ── Productivo ───────────────────────────────────────────────────────────────────────────
  { id: "productivo.hacienda",  seccion: "productivo", etiqueta: "Hacienda",            tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.evolucion", seccion: "productivo", etiqueta: "Evolución Rodeo",     tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.cria",      seccion: "productivo", etiqueta: "Cría",                tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.recria",    seccion: "productivo", etiqueta: "Recría / Engorde",    tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.insumos",   seccion: "productivo", etiqueta: "Insumos",             tipo: "pestana", archivo: PRODUCTIVO },
  // ⚠️ Estas tres van INMEDIATAMENTE después de Insumos, que es su padre. Antes quedaban
  //    después de «Lotes Agrícolas» y la indentación las hacía parecer hijas de Lotes —
  //    el usuario preguntó por qué no podía tildarlas, y la respuesta (porque Insumos está
  //    destildado) era invisible desde donde estaban dibujadas.
  { id: "productivo.stock",     seccion: "productivo", etiqueta: "Stock y Movimientos", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  { id: "productivo.ordenes",   seccion: "productivo", etiqueta: "Órdenes de Aplicación", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  { id: "productivo.compras",   seccion: "productivo", etiqueta: "Necesidad de Compra", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  { id: "productivo.lotes",     seccion: "productivo", etiqueta: "Lotes Agrícolas",     tipo: "pestana", archivo: PRODUCTIVO },

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
