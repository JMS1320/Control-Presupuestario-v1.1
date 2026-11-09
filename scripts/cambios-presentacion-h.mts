/**
 * 📝 La solapa «Cambios de presentación» del H para auditar (JMS 09/11: «haceme una solapa de los cambios que hiciste con algún ejemplo
 * siempre… el índice de cambios hechos entendible, con ejemplos»). Sólo la usa scripts/excel-h-para-auditar.mts con --cambios.
 * Los ejemplos son del Excel real MSA 25/26 generado el 09/11.
 */
export const SOLAPA_CAMBIOS = "Cambios de presentación"

const T = (s: string) => [s]
export const CAMBIOS: unknown[][] = [
  T("CAMBIOS DE PRESENTACIÓN — 09/11/2026 — los NÚMEROS NO CAMBIARON (sólo cómo se muestran)"),
  T("Respaldo ANTES: Balance/respaldos/«H para auditar MSA 25-26 - ANTES de los cambios de presentacion (2026-11-09).xlsx» · DESPUÉS: «… - DESPUES de los cambios de presentacion (2026-11-09).xlsx»"),
  [],
  ["", "Control de que no cambió ningún número", "Antes", "Después", ""],
  ["", "Cuotas de templates", 2658, 2658, "✓ igual"],
  ["", "Total de las cuotas (todas las solapas)", 38508826.05, 38508826.05, "✓ igual"],
  ["", "Control contra el banco (22 renglones por cuenta y código = la 14.1)", 160590076.25, 160590076.25, "✓ igual, renglón por renglón"],
  ["", "«Retiros y aportes» — suma de todas las líneas", 158471202.42, 158471202.42, "✓ igual (cambian los nombres y cómo se agrupan)"],
  ["", "Otras puntas (no suman)", 79600000, 79600000, "✓ igual"],
  ["", "Solapas de agrupadora (51): total y cuotas de cada una", "", "", "✓ las 51 iguales (3 cambiaron sólo el nombre: «Mov internos»)"],
  [],
  ["Nro", "Qué cambió", "Dónde", "Antes", "Ahora (ejemplo real)"],
  [1, "Una TRANSFERENCIA entre empresas se rotula IGUAL en las dos puntas; sólo cambia «salió de» / «entró a».", "Columna Efecto (todas las solapas) y «Retiros y aportes»",
    "Salida en MSA: «retiro de MA pagado por MSA» · entrada en MA: «MSA → MA (cuenta corriente) · entró a MA» (dos frases para el mismo movimiento)",
    "31/10/2025 · $ 3.500.000 (Retiro MA mensual): en Galicia MSA «retiro de MA (MSA → MA) · salió de MSA»; en Galicia MA «retiro de MA (MSA → MA) · entró a MA»"],
  [2, "«retiro de MA pagado por MSA» ahora es sólo PAGO A TERCEROS por cuenta de MA; las transferencias a MA van en su propia línea.", "«Retiros y aportes» (resumen)",
    "Una sola línea de 59.725.517,73 que mezclaba transferencias y gastos", "«retiro de MA (MSA → MA) · salió de MSA» 49.595.000 + «retiro de MA pagado por MSA» 10.130.517,73 (= 59.725.517,73)"],
  [3, "Cómo se reconoce una transferencia: el CUIT de la otra empresa entre las leyendas del banco (o «ctas propias»). Un VEP de AFIP no es transferencia.", "Columna Efecto",
    "Se tomaba todo como «pagado por»", "Beneficiario «Maria De Las Mercedes Areco · 27066824611» → transferencia a MA. «AUTONOMOS · 270668246110» (VEP) → pago a AFIP por MA, no transferencia"],
  [4, "El resumen de «Retiros y aportes» va agrupado por QUIÉN RECIBE: cada línea empieza «PARA MA ·», «PARA PAM ·», «PARA JMS ·»…", "«Retiros y aportes» (resumen)",
    "Orden alfabético: retiros, distribuciones, aportes y Libertad mezclados", "PARA MA · distribución PAM → MA · salió de PAM · PARA MA · distribución PAM → MA (pagó un gasto de MA) · PARA MA · retiro de MA (MSA → MA) · salió de MSA · PARA MA · retiro de MA pagado por MSA"],
  [5, "Nueva tabla «TOTAL POR QUIÉN RECIBE», con fórmulas sobre el resumen.", "«Retiros y aportes», debajo del detalle (link arriba)",
    "No existía: sólo un TOTAL general que mezclaba todo", "MA 86.862.895,13 (4 líneas) · PAM 14.513.577,01 · JMS 7.357.601,77 · MSA 4.800.000 · Libertad 25.589.082,51 · AMS / MANU / MECHI / SOLE · COTITULARES · FLIA"],
  [6, "El TOTAL general dice que mezcla todo, para que no se lea como un número de auditoría.", "«Retiros y aportes» (resumen)",
    "«TOTAL» 158.471.202,42", "«TOTAL (todo junto, mezcla quién recibe: leer «Total por quién recibe»)» 158.471.202,42 — el mismo número"],
  [7, "Arriba, 3 links que llevan a lo que está abajo del detalle: Total por quién recibe · Otras puntas · Control contra el banco.", "«Retiros y aportes», filas 4 a 6",
    "Había que bajar ~330 filas para encontrarlos", "Tocá «📍 Ir a «OTRAS PUNTAS — no suman» (tocá acá)»"],
  [8, "El Nro es un número entero.", "«Retiros y aportes»", "«1,00»", "«1»"],
  [9, "CONTEXTO para auditar sin ir a la app: 4 columnas nuevas al final del detalle — Descripción del banco · Beneficiario / CUIT · Factura vinculada · Interno.", "Todas las solapas de agrupadora (P a S) y «Retiros y aportes»",
    "Había que ir al extracto del banco para saber a quién se pagó", "MA · Retiros-Distrib soc, 31/10/2025, $ 3.500.000 entró a MA: Descripción «SERVICIO PAGO A PROVEEDORES» · Beneficiario «MARTINEZ SOBRADO AGRO S.R.L.…» (3.299 de 3.413 filas traen la descripción). La Factura vinculada sólo se llena cuando el movimiento tiene una factura atada (en las cuotas de template, casi nunca)"],
  [10, "Las columnas A a D (Nro · Mes · Fecha · Concepto) quedan FIJAS: al ir a la derecha (Marca, Efecto y el contexto) se sigue viendo de qué cuota se trata.", "Todas las solapas de agrupadora",
    "Al ir a la columna O se perdía el Concepto", "En «H · MA · Imp Rurales» quedan fijas las filas 1 a 15 y las columnas A a D. Tus anchos A–O no se tocaron"],
  [11, "ÍNDICE: al lado de cada solapa su TOTAL y cuántas 🔴 sin pagar / 🟡 a revisar / ⚠️ código tiene, y la leyenda de las marcas arriba.", "Índice",
    "Sólo los nombres", "MSA · Imp Bancarios 7.504.936,07 · 🟡 35 → se ve que ahí hay 35 para mirar (son cuotas pagadas desde la cuenta en dólares)"],
  [12, "ÍNDICE: primero las agrupadoras; Templates, Cuotas, Por mes, Extracto sin categ, Automotores y Papel impuestos van abajo, en «— datos de base y papeles —».", "Índice",
    "Templates, Cuotas y Por mes (largas, de base) iban primero", "MSA: Créditos Bancarios, CZ Ganadera, Gastos Bancarios… y al final «— datos de base y papeles —»"],
  [13, "Nombre de solapa sin cortar: «Movimientos Internos empresa» pasa a «Mov internos».", "Nombres de solapa",
    "«H · MA · Movimientos Internos e» (cortado por el límite de 31 letras de Excel)", "«H · MA · Mov internos»"],
  [14, "Sin cambio: «Gastos Libertad» ya decía el reparto en el título («costo, reparto 50/50 y quién lo pagó»).", "Gastos Libertad", "—", "—"],
  [],
  T("NO SE TOCÓ (queda para revisar después, con tu respuesta): los datos de la revisión — «MA pagó por PAM» (96 cuotas), el código «X», los $ 200.000 de MA, COTITULARES, Pasajes, Amestoy, FLIA y el extracto de MA de jul–sep 2025."),
]
export const ANCHOS_CAMBIOS = [6, 70, 34, 60, 110]
