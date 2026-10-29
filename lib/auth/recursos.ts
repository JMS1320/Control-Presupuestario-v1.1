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
  // 🔒 27/10 (JMS, armando el rol de Ulises «de menos a más»: «yo deshabilitaría SICORE, pagos, muchísimas
  // cosas, edición masiva… metiste pantallas enteras y eso dijimos que no»): los BOTONES de Facturas y
  // Subdiarios, para prenderlos uno por uno con el candado del modo permisos. Valen para MSA, PAM y MA.
  { id: "egresos.importar-fc",     seccion: "egresos", etiqueta: "Facturas → Importar FC",           tipo: "accion", archivo: FACTURAS },
  { id: "egresos.reglas-import",   seccion: "egresos", etiqueta: "Facturas → Reglas Import",         tipo: "accion", archivo: FACTURAS },
  { id: "egresos.modo-edicion",    seccion: "egresos", etiqueta: "Facturas → Modo Edición",          tipo: "accion", archivo: FACTURAS },
  { id: "egresos.edicion-masiva",  seccion: "egresos", etiqueta: "Facturas → Edición Masiva",        tipo: "accion", archivo: FACTURAS },
  { id: "egresos.sicore",          seccion: "egresos", etiqueta: "Facturas → SICORE",                tipo: "accion", archivo: FACTURAS },
  { id: "egresos.pagos",           seccion: "egresos", etiqueta: "Facturas → Pagos",                 tipo: "accion", archivo: FACTURAS },
  { id: "egresos.imputar",         seccion: "egresos", etiqueta: "Subdiarios → Imputar Facturas",    tipo: "accion", padre: "egresos.subdiarios", archivo: FACTURAS },
  { id: "egresos.gestionar-subdiario", seccion: "egresos", etiqueta: "Subdiarios → Gestionar Facturas", tipo: "accion", padre: "egresos.subdiarios", archivo: FACTURAS },
  // Archivo digital, de a poco (JMS 27/10: «cada botón hace una cosa y debe ser muy claro qué usar… vincular con
  // la carpeta sería una»): el botón de todos los días, aparte de los de afinar.
  { id: "egresos.vincular-pdf",    seccion: "egresos", etiqueta: "Subdiarios → Vincular con la carpeta", tipo: "accion", padre: "egresos.subdiarios", archivo: FACTURAS },
  { id: "egresos.archivo-digital-mas", seccion: "egresos", etiqueta: "Subdiarios → Contar, re-vincular todo y mandar el estado por mail", tipo: "accion", padre: "egresos.subdiarios", archivo: FACTURAS },
  { id: "egresos.faltantes-pdf",   seccion: "egresos", etiqueta: "Subdiarios → Facturas sin PDF (pedirlas, copiar el pedido)", tipo: "accion", padre: "egresos.subdiarios", archivo: FACTURAS },
  // ── BOTONES DE EGRESOS (JMS 27/10: «todos los botones deben ser posibles de seleccionar»). Lo que el código ya
  //    reserva al admin (modo admin, DDJJ, «visible para Ulises»…) sigue reservado y NO tiene casilla.
  ...([
    ["subdiario-reporte", "Subdiarios → Generar PDF + Excel del período", "egresos.subdiarios", FACTURAS],
    ["cargar-desde-pdf", "Subdiarios → Cargar un PDF suelto como factura No Informada", "egresos.subdiarios", FACTURAS],
    ["config-pdf-proveedores", "Facturas → Configurar la descarga de PDFs por proveedor", undefined, FACTURAS],
    // A-BUG-1401 (nota 🌙 JMS 27/10: «todos los botones deberían estar configurables por defecto»)
    ["historial-pdf", "Facturas → Historial de búsquedas de PDFs", undefined, FACTURAS],
    ["auditar-archivo", "Facturas → Auditar el registro digital de un período", undefined, FACTURAS],
    ["marcar-fc", "Facturas → Marcar FC (comprobante)", undefined, FACTURAS],
    ["vincular-compras", "Facturas → Vincular con compras de insumos", undefined, FACTURAS],
    ["resetear", "Facturas → Resetear a estado importado", undefined, FACTURAS],
    ["pagos-estado", "Pagos → Cambiar estado (pagar, pagado, echeq…)", "egresos.pagos", FACTURAS],
    ["pagos-agrupar", "Pagos → Agrupar / desagrupar", "egresos.pagos", FACTURAS],
    ["pagos-detalle", "Pagos → PDF y mail de detalle al proveedor", "egresos.pagos", FACTURAS],
    ["pagos-revertir", "Pagos → Volver a pendiente", "egresos.pagos", FACTURAS],
    ["anticipo-eliminar", "Pagos → Eliminar anticipo", "egresos.pagos", FACTURAS],
    ["templates-activar", "Egresos sin factura → Activar / desactivar cuota", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-campana", "Egresos sin factura → Editar la campaña", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-edicion", "Egresos sin factura → Modo edición", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-edicion-masiva", "Egresos sin factura → Edición masiva", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-nuevo", "Egresos sin factura → Nuevo template", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-generador", "Egresos sin factura → Renovar campaña", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-planilla-impuestos", "Egresos sin factura → Planilla de impuestos", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["templates-pago-manual", "Egresos sin factura → Pago manual", "egresos.templates", "components/vista-templates-egresos.tsx"],
    ["asignar-cuenta", "Asignación de cuentas → Asignar / quitar cuenta", "egresos.asignacion", "components/vista-asignacion-arca.tsx"],
  ] as const).map(([k, e, padre, archivo]): Recurso => ({
    id: `egresos.${k}`, seccion: "egresos", etiqueta: e, tipo: "accion", ...(padre ? { padre } : {}), archivo,
  })),

  // ── Extracto Bancario ────────────────────────────────────────────────────────────────────
  { id: "extracto.movimientos", seccion: "extracto", etiqueta: "Movimientos", tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.importar",    seccion: "extracto", etiqueta: "Importar",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.reportes",    seccion: "extracto", etiqueta: "Reportes",    tipo: "pestana", archivo: EXTRACTO },
  { id: "extracto.auditoria",   seccion: "extracto", etiqueta: "Auditoría",   tipo: "pestana", archivo: EXTRACTO },
  // A-FEAT-1361: todo lo que CONCILIA sin pasar por Asignar — el motor (botón de arriba y el de cada resumen de
  // tarjeta) y el «✓ OK» de los para revisar (uno y masivo). Para Ulises: cargar sin conciliar.
  { id: "extracto.conciliar",   seccion: "extracto", etiqueta: "Conciliar (automático y ✓ OK)", tipo: "accion", archivo: EXTRACTO },
  // 🔘 A-BUG-1401 (JMS 28/10): los botones de acción del Extracto. Abiertos: prendidos; cerrados: apagados.
  ...([
    ["reparsear", "Re-parsear el extracto (aplicar las reglas de nuevo)"],
    ["editar", "Modo edición (editar movimientos, edición masiva)"],
    ["notas-lote", "Notas en lote (poner / borrar las de conciliados)"],
    ["revisado", "Marcar los visibles como revisados"],
    ["echeqs", "Traer echeqs (cuenta de echeqs de terceros)"],
    ["excel-auditoria", "Descargar el Excel de auditoría"],
  ] as const).map(([k, e]): Recurso => ({ id: `extracto.${k}`, seccion: "extracto", etiqueta: e, tipo: "accion", archivo: EXTRACTO })),
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
  // 💵 A-FEAT-1398: la sección de dólares (panel, cargar a mano, compra/venta de USD)
  { id: "extracto.dolares",  seccion: "extracto", etiqueta: "Dólares y Cotitulares (ver)", tipo: "accion", archivo: EXTRACTO },
  { id: "extracto.dolares-cargar", seccion: "extracto", etiqueta: "Dólares: cargar movimiento / compra-venta de USD", tipo: "accion", archivo: EXTRACTO },
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
    // 💵 A-FEAT-1398: las 7 en dólares y de Cotitulares (los ids son los de lib/dolares/cuentas.ts)
    ["msa_cc_usd", "MSA Cuenta Corriente USD"],
    ["msa_caja_usd", "MSA Caja USD"],
    ["ma_ca_usd", "MA Caja de Ahorro USD"],
    ["ma_caja_usd", "MA Caja USD"],
    ["cotitulares_ca_usd", "Cotitulares Caja de Ahorro USD"],
    ["cotitulares_ca_pesos", "Cotitulares Caja de Ahorro Pesos"],
    ["cotitulares_caja_usd", "Cotitulares Caja USD"],
  ] as const).map(([id, nombre]): Recurso => ({
    id: `extracto.cuenta.${id}`, seccion: "extracto", etiqueta: `Cuenta → ${nombre}`, tipo: "cuenta", archivo: EXTRACTO,
  })),

  // ── Productivo ───────────────────────────────────────────────────────────────────────────
  { id: "productivo.hacienda",  seccion: "productivo", etiqueta: "Hacienda",            tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.evolucion", seccion: "productivo", etiqueta: "Evolución Rodeo",     tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.cria",      seccion: "productivo", etiqueta: "Cría",                tipo: "pestana", archivo: PRODUCTIVO },
  // A-FEAT-1380: el plan sanitario. «Aprobar» (aceptar propuestas, cambiar el plan directo) es SÓLO del admin:
  //   no tiene casilla (JMS 27/10). Quien no es admin propone y espera el OK.
  { id: "productivo.plan-sanitario", seccion: "productivo", etiqueta: "Plan sanitario", tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.recria",    seccion: "productivo", etiqueta: "Recría / Engorde",    tipo: "pestana", archivo: PRODUCTIVO },
  { id: "productivo.insumos",   seccion: "productivo", etiqueta: "Insumos",             tipo: "pestana", archivo: PRODUCTIVO },
  // ⚠️ Estas tres van INMEDIATAMENTE después de Insumos, que es su padre. Antes quedaban
  //    después de «Lotes Agrícolas» y la indentación las hacía parecer hijas de Lotes —
  //    el usuario preguntó por qué no podía tildarlas, y la respuesta (porque Insumos está
  //    destildado) era invisible desde donde estaban dibujadas.
  { id: "productivo.stock",     seccion: "productivo", etiqueta: "Stock y Movimientos", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  { id: "productivo.ordenes",   seccion: "productivo", etiqueta: "Órdenes de Aplicación", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  // ── BOTONES DE PRODUCTIVO (JMS 27/10: «todos los botones deben ser posibles de seleccionar»). Cada botón que HACE
  //    algo tiene su casilla y su candado en el modo permisos; filtros, chips y navegación no (vienen con la pantalla).
  //    Lo que es SÓLO del admin (confirmar órdenes, aprobar el plan) no tiene casilla: no se delega.
  ...([
    ["hacienda", "productivo.hacienda", PRODUCTIVO, [["romaneo", "Romaneo"], ["flete", "Flete"], ["planilla", "Planilla (exportar)"],
      ["movimiento", "Nuevo movimiento"], ["venta", "Completar / editar venta"], ["identificar", "Identificar animales"]]],
    ["stock", "productivo.stock", PRODUCTIVO, [["compra", "Compra"], ["ajuste", "Ajuste"], ["nuevo-insumo", "Nuevo insumo"],
      ["mediciones", "Mediciones"], ["facturas", "Facturas del insumo"], ["vincular-compra", "Vincular compra con factura"]]],
    ["ordenes", "productivo.ordenes", PRODUCTIVO, [["nueva", "Nueva orden"], ["editar", "Editar orden"], ["se-hizo", "Marcar «se hizo» (queda a confirmar)"],
      ["borrar", "Eliminar orden"], ["descargar", "Descargar imagen"], ["labores", "Crear / borrar labores"], ["ciclo", "Vincular ciclo de cría / asignar categorías"],
      ["ganadero", "Ver órdenes ganaderas"], ["agricola", "Ver órdenes agrícolas"],
      ["nuevo-lote", "Crear un lote desde la orden (queda a confirmar)"]]],
    ["lotes", "productivo.lotes", PRODUCTIVO, [["nuevo", "Nuevo lote"]]],
    ["terneros", undefined, "components/tab-terneros.tsx", [["editar", "Editar"], ["reposicion", "Marcar reposición"], ["descargar", "Descargar caravanas/pesadas"],
      ["importar-pesadas", "Importar pesadas"], ["importar-terneros", "Importar terneros"], ["identificar", "Identificar"]]],
    ["evolucion", "productivo.evolucion", "components/tab-evolucion-rodeo.tsx", [["proponer", "Proponer desde Productivo"], ["agregar", "Agregar período"],
      ["editar", "Editar período"], ["borrar", "Borrar período"]]],
    ["plan-sanitario", "productivo.plan-sanitario", "components/tab-plan-sanitario.tsx", [["iatf", "Cargar / mover IATF"], ["calendario", "Proponer calendario"],
      ["registrar", "Se hizo / no se hizo / mover"], ["plan", "Cambiar el plan (o proponer)"]]],
  ] as const).flatMap(([grupo, padre, archivo, botones]) => botones.map(([k, e]): Recurso => ({
    id: `productivo.${grupo}.${k}`, seccion: "productivo",
    etiqueta: `${grupo === "terneros" ? "Terneros (Cría y Recría)" : grupo === "plan-sanitario" ? "Plan sanitario" : grupo.charAt(0).toUpperCase() + grupo.slice(1)} → ${e}`,
    tipo: "accion", ...(padre ? { padre } : {}), archivo,
  }))),
  { id: "productivo.compras",   seccion: "productivo", etiqueta: "Necesidad de Compra", tipo: "pestana", padre: "productivo.insumos", archivo: PRODUCTIVO },
  { id: "productivo.lotes",     seccion: "productivo", etiqueta: "Lotes Agrícolas",     tipo: "pestana", archivo: PRODUCTIVO },

  // ── Cash Flow ────────────────────────────────────────────────────────────────────────────
  { id: "cashflow.nuevo",      seccion: "cashflow", etiqueta: "Cargar anticipo",     tipo: "funcionalidad", archivo: CASHFLOW },
  { id: "cashflow.existentes", seccion: "cashflow", etiqueta: "Anticipos existentes", tipo: "funcionalidad", archivo: CASHFLOW },
  // 🔘 A-BUG-1401 (JMS 28/10): los botones de acción de Sueldos (no tenía ninguno) y el que faltaba en Templates.
  ...([
    ["campanas", "Campañas (crear / revisar)"],
    ["nomina", "Gestión de nómina (alta y baja de empleados)"],
    ["planilla", "Planilla de asistencia"],
    ["pago", "Registrar un pago o anticipo"],
    ["editar", "Editar un sueldo (o repartirlo)"],
    ["mes", "Trabajar en un mes cerrado (abrir el candado)"],
    ["archivo-banco", "Archivo para el banco"],
    ["exportar", "Exportar pagos a Excel"],
  ] as const).map(([k, e]): Recurso => ({ id: `sueldos.${k}`, seccion: "sueldos", etiqueta: e, tipo: "accion", archivo: "components/tab-sueldos.tsx" })),
  { id: "egresos.templates-convertir", seccion: "egresos", etiqueta: "Egresos sin factura → Convertir a cuotas (masivo)", tipo: "accion", padre: "egresos.templates", archivo: "components/vista-templates-egresos.tsx" },
  // 🔘 A-BUG-1401: los botones de acción de Ingresos (Arrendamientos y Ventas MSA). Abiertos: prendidos; cerrados: apagados.
  ...([
    ["contrato-nuevo", "Arrendamientos → Nuevo contrato", "components/vista-arrendamientos.tsx"],
    ["contrato-editar", "Arrendamientos → Editar / duplicar contrato", "components/vista-arrendamientos.tsx"],
    ["contrato-baja", "Arrendamientos → Dar de baja un contrato", "components/vista-arrendamientos.tsx"],
    ["fijar", "Arrendamientos → Fijar precio de una cuota (o editar la fijación)", "components/vista-arrendamientos.tsx"],
    ["fijar-tc", "Arrendamientos → Fijar el TC", "components/vista-arrendamientos.tsx"],
    ["venta-nueva", "Ventas MSA → Nueva venta", "components/vista-ventas-msa.tsx"],
    ["venta-editar", "Ventas MSA → Editar venta", "components/vista-ventas-msa.tsx"],
    ["venta-eliminar", "Ventas MSA → Eliminar venta", "components/vista-ventas-msa.tsx"],
    ["liquidacion", "Ventas MSA → Liquidación de hacienda (armar / editar)", "components/vista-ventas-msa.tsx"],
  ] as const).map(([k, e, archivo]): Recurso => ({ id: `ingresos.${k}`, seccion: "ingresos", etiqueta: e, tipo: "accion", archivo })),
  // 🔘 A-BUG-1401 (JMS 28/10: «todos los botones configurables por defecto»): los botones de acción del Cash Flow.
  //    En los roles abiertos vienen prendidos (no cambia nada); en los cerrados (pruebas) nacen apagados.
  ...([
    ["editar", "Editar una celda (fechas, importes, detalle…)"],
    ["estado", "Cambiar el estado de una fila (pagar, pagado…)"],
    ["cambio-lote", "Cambiar estado o fecha en lote"],
    ["modo-pagos", "Modo pagos (seleccionar para pagar)"],
    ["pdf-pagos", "Pagos → PDF de detalle de los seleccionados"],
    ["mails-detalle", "Pagos → Mail de detalle a los proveedores"],
    ["lote-galicia", "Pagos → Lote de transferencias Galicia"],
    ["agrupar", "Agrupar / desagrupar filas"],
    ["pago-manual", "Pago manual"],
    ["anticipo", "Anticipo (nuevo)"],
    ["anticipo-vincular", "Vincular / revertir un anticipo externo"],
    ["echeqs", "Panel de ECHEQs"],
    ["excel-echeqs", "Excel de ECHEQs"],
    ["precios", "Precios y TC"],
  ] as const).map(([k, e]): Recurso => ({ id: `cashflow.${k}`, seccion: "cashflow", etiqueta: e, tipo: "accion", archivo: CASHFLOW })),
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
