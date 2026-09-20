/**
 * 🧪 Casos de prueba — NIVEL 1: lógica pura, **cero escritura**. A-FEAT-105.
 *
 * ## La regla que no se negocia
 * 🔴 **Nada de acá toca la base.** No hay entorno de prueba: local, preview y producción comparten
 * el mismo Supabase, y un test que escribe escribe en los datos del usuario. Ya pasó —un test
 * inventó $5.443.200 sobre un movimiento real **y reportó OK**—. Un test que no escribe **no puede
 * dejar basura**, y eso es más fuerte que cualquier limpieza posterior.
 *
 * Cómo probar el camino de escritura está sin resolver → `A-DEC-18` (base descartable, no Liquibase).
 *
 * ## Por qué esto alcanza para lo que duele
 * Los **cuatro** bugs del 2026-09-06 fueron de lógica pura y **ninguno necesitaba escribir una fila**:
 * el factor por tipo (6.501 kg), las 9 cabezas en vez de 10, el denominador mezclado y el match por
 * dientes. Los cuatro están acá abajo como caso.
 *
 * ## Y por qué corre en el navegador y no en Node
 * El parser del romaneo se verificó en Node —9 líneas, $18.750.900, perfecto— y en el navegador del
 * usuario devolvió **cero**. Un test que corre donde el usuario no está prueba otra cosa.
 *
 * ## ⚠️ Lo que estos casos NO cubren, y por qué
 * `A-BUG-115` —guardó 9 cabezas en vez de 10— vivía en **`parsearRomaneo`**, no en las funciones de
 * acá: `cabezasDeMedias` siempre estuvo bien. Probar el parser necesita el PDF, así que ese camino
 * queda para el nivel 2 (subir el archivo desde la pantalla).
 *
 * 📌 **Se dice explícitamente porque un caso que pasa igual antes y después del arreglo no prueba
 * nada** — y encima aparenta cobertura, que es peor que no tenerla. Ya pasó en este proyecto: un
 * control que se verificaba sobre una cadena vacía daba OK siempre.
 *
 * ## Los datos son CONSTANTES de este archivo
 * Los pesos y kilos de abajo son los reales de la carga del 03/09, **escritos acá**. No se leen de
 * la base: así el caso no cambia de resultado porque alguien editó un registro, que es como un test
 * empieza a mentir.
 */

import {
  adjudicarPorPeso, cabezasDeMedias, rindePorGrupo, factorDeCarga,
  type CabezaNuestra, type CabezaRomaneo,
} from "@/lib/ganaderia/adjudicar-romaneo"
import { simularSecuencia, retencionDelGrupo, calcularRetencion } from "@/lib/sicore/minimo"
import { deduplicarFilasSicore } from "@/lib/sicore/dedup"
import { parsePendientes, esDelProceso } from "@/lib/pendientes/parse"
import { calcularCuenta, etiquetaComprobante } from "@/lib/pagos/cuenta-detalle-pago"
import { agruparPagosPorEmpleado } from "@/lib/sueldos/agrupar-pagos"
import { hayQuePreguntarFechaPago } from "@/lib/pagos/preguntar-fecha-pago"
import { etiquetaMonto } from "@/lib/conciliacion/etiqueta-monto"
import { armarCuentaCorriente, leyendaSaldo } from "@/lib/proveedores/cuenta-corriente"
import {
  identificadorDeCuota, detalleCompleto, esElIdentificadorGenerado,
} from "@/lib/templates/identificador-cuota"
import {
  planificarEdicion, evaluarAvisos, diasEntre, coincide,
  type CuotaExistente, type MovimientoBancario as MovBancario,
} from "@/lib/templates/editar-campana"
import { planificarContrapartes } from "@/lib/contrapartes/registrar"
import { heredarDelOrigen, proveedorDelTemplate } from "@/lib/conciliacion/datos-del-origen"
import {
  lineasDelDetalle, controlarDetalle, sinElProveedor,
} from "@/lib/pagos/lineas-detalle-pago"
import {
  auditar, origenDe, destinoDelDetalle, vinculoDobleEsLegitimo, comprobanteIdentifica,
  type MovimientoAuditable as MovAuditable, type EntidadOrigen,
} from "@/lib/conciliacion/auditoria"

export interface Resultado {
  caso: string
  grupo: string
  ok: boolean
  esperado: string
  obtenido: string
  /** Qué bug cubre, para saber qué se rompió si vuelve a fallar. */
  cubre?: string
}

// ── Los datos reales de la carga del 03/09 (constantes, no salen de la BD) ────────────────────
const VACAS: CabezaNuestra[] = [766, 562, 540, 522, 502, 478, 270]
  .map((p, i) => ({ id: `v${i}`, caravana: `V${i}`, razon: null, peso_kg: p }))
const TOROS: CabezaNuestra[] = [1035, 870, 756]
  .map((p, i) => ({ id: `t${i}`, caravana: `T${i}`, razon: null, peso_kg: p }))
const NETO_CAMION = 6500

/** Las medias reses tal como las lee el PDF: **2 por garrón**, con dos incompletas a propósito. */
const MEDIAS = [
  ["507", "VA", "D", 1, 125], ["507", "VA", "D", 1, 123],
  ["508", "VA", "D", 0, 129], ["508", "VA", "D", 0, 132],
  ["509", "VA", "B", 2, 117],                                  // ← al PDF le falta la otra media
  ["510", "VA", "C", 0, 114], ["510", "VA", "C", 0, 115],
  ["511", "VA", "C", 0, 127], ["511", "VA", "C", 0, 130],
  ["512", "VA", "C", 2, 185],                                  // ← idem
  ["513", "VA", "E", 0, 73], ["513", "VA", "E", 0, 73],
  ["514", "TO", "B", 0, 277], ["514", "TO", "B", 0, 268],
  ["515", "TO", "A", 0, 314], ["515", "TO", "A", 0, 310],
  ["516", "TO", "B", 1, 219], ["516", "TO", "B", 1, 218],
].map(([garron, tipo, clase, dientes, peso]) => ({
  garron: garron as string, tipo: tipo as string, clase: clase as string,
  dientes: dientes as number, contenido: "MCV/MCV", peso_kg: peso as number,
  precio_kg: null as number | null, orden: 0,
}))

/** Los mismos garrones **con las dos medias corregidas a mano**, que es como debe quedar. */
const CABEZAS_OK: CabezaRomaneo[] = cabezasDeMedias(MEDIAS).map(c =>
  c.garron === "509" ? { ...c, kg_gancho: 234, medias: 2 }
    : c.garron === "512" ? { ...c, kg_gancho: 373, medias: 2 }
      : c)

const n = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 2 })
const cerca = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol
/** Plata: siempre con 2 decimales, es-AR. */
const n2 = (v: number) => v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (v: number) => Math.round(v * 100) / 100

export function correrCasos(): Resultado[] {
  const r: Resultado[] = []
  const chequear = (grupo: string, caso: string, esperado: string, obtenido: string, ok: boolean, cubre?: string) =>
    r.push({ grupo, caso, esperado, obtenido, ok, cubre })

  // ══ El factor de la balanza ═══════════════════════════════════════════════════════════════
  const todas = [...VACAS, ...TOROS]
  const f = factorDeCarga(todas, NETO_CAMION)
  chequear("Balanza", "El factor sale de TODA la carga, no de cada tipo",
    "×1,0316", `×${f.toFixed(4)}`, cerca(f, 6500 / 6301, 0.0001), "A-BUG-114")

  const sumaAjustada = todas.reduce((s, c) => s + c.peso_kg * f, 0)
  chequear("Balanza", "Ajustado, el total da el neto del camión UNA vez",
    `${n(NETO_CAMION)} kg`, `${n(Math.round(sumaAjustada))} kg`,
    cerca(sumaAjustada, NETO_CAMION, 1), "A-BUG-114")

  // El caso que rompía: escalar por tipo daba el camión entero en CADA grupo.
  const fSoloToros = factorDeCarga(TOROS, NETO_CAMION)
  const torosMal = TOROS.reduce((s, c) => s + c.peso_kg * fSoloToros, 0)
  chequear("Balanza", "Escalar sólo un tipo da el camión entero (por eso NO se hace)",
    `${n(NETO_CAMION)} kg — y por eso el factor es global`, `${n(Math.round(torosMal))} kg`,
    cerca(torosMal, NETO_CAMION, 1), "A-BUG-114")

  // ══ Las cabezas ═══════════════════════════════════════════════════════════════════════════
  const cabezas = cabezasDeMedias(MEDIAS)
  chequear("Cabezas", "18 medias reses son 10 cabezas, no 18",
    "10 cabezas", `${cabezas.length} cabezas`, cabezas.length === 10)

  const incompletos = cabezas.filter(c => c.medias !== 2).map(c => c.garron)
  chequear("Cabezas", "Detecta los garrones con una sola media res",
    "509, 512", incompletos.join(", ") || "(ninguno)",
    incompletos.length === 2 && incompletos.includes("509") && incompletos.includes("512"), "A-BUG-116")

  // ══ La adjudicación por peso ══════════════════════════════════════════════════════════════
  const vacasRom = CABEZAS_OK.filter(c => c.tipo === "VA")
  const { pares } = adjudicarPorPeso(VACAS, vacasRom, f)
  const apareo = pares.filter(p => p.nuestra && p.romaneo)
    .map(p => `${p.nuestra!.peso_kg}→${p.romaneo!.kg_gancho}`).join(" ")
  chequear("Adjudicación", "Al más pesado nuestro, la res más pesada",
    "766→373 562→261 540→257 522→248 502→234 478→229 270→146", apareo,
    apareo === "766→373 562→261 540→257 522→248 502→234 478→229 270→146", "A-FEAT-97")

  const rindes = pares.filter(p => p.rinde != null).map(p => p.rinde!)
  chequear("Adjudicación", "El rinde VARÍA entre animales (si no, el cálculo es circular)",
    "distintos entre sí", `${Math.min(...rindes).toFixed(2)} % a ${Math.max(...rindes).toFixed(2)} %`,
    Math.max(...rindes) - Math.min(...rindes) > 1, "A-FEAT-96")

  // ══ El rinde por grupo de precio ══════════════════════════════════════════════════════════
  // Precio por (tipo, clase, dientes) tal como lo liquidó el frigorífico.
  const PRECIO: Record<string, number> = {
    "VA|D|1": 5800, "VA|D|0": 5500, "VA|B|2": 6600, "VA|C|0": 5800,
    "VA|C|2": 6600, "VA|E|0": 4800, "TO|B|0": 5200, "TO|A|0": 5200, "TO|B|1": 5200,
  }
  const conPrecio = CABEZAS_OK.map(c => ({ ...c, precio_kg: PRECIO[`${c.tipo}|${c.clase}|${c.dientes}`] ?? null }))
  const todosLosPares = [
    ...adjudicarPorPeso(VACAS, conPrecio.filter(c => c.tipo === "VA"), f).pares,
    ...adjudicarPorPeso(TOROS, conPrecio.filter(c => c.tipo === "TO"), f).pares,
  ]
  const grupos = rindePorGrupo(todosLosPares)

  chequear("Grupos", "Un grupo por precio dentro de cada tipo",
    "5 grupos", `${grupos.length} grupos`, grupos.length === 5, "A-FEAT-96")

  const vivoTotal = grupos.reduce((s, g) => s + g.kg_vivo, 0)
  chequear("Grupos", "La suma de los grupos es el camión — la carga NO entra dos veces",
    `${n(NETO_CAMION)} kg`, `${n(Math.round(vivoTotal))} kg`,
    cerca(vivoTotal, NETO_CAMION, 2), "A-BUG-114")

  const ganchoTotal = grupos.reduce((s, g) => s + g.kg_gancho, 0)
  chequear("Grupos", "Los kilos de carne suman el gancho del romaneo",
    "3.354 kg", `${n(ganchoTotal)} kg`, cerca(ganchoTotal, 3354, 1))

  const importe = grupos.reduce((s, g) => s + g.importe, 0)
  chequear("Grupos", "El importe total es el que liquidó el frigorífico",
    "$18.750.900", `$${n(importe)}`, cerca(importe, 18750900, 1))

  const toros = grupos.find(g => g.tipo === "TO")
  chequear("Grupos", "Los toros rinden mucho más que las vacas",
    "≈58,5 %", toros?.rinde != null ? `${toros.rinde.toFixed(2)} %` : "—",
    toros?.rinde != null && cerca(toros.rinde, 58.5, 0.6), "A-FEAT-96")

  const rindesGrupo = grupos.map(g => g.rinde ?? 0)
  chequear("Grupos", "El rinde por grupo VARÍA (con el vivo del papel daría 53,58 % en todos)",
    "distintos entre sí", `${Math.min(...rindesGrupo).toFixed(2)} % a ${Math.max(...rindesGrupo).toFixed(2)} %`,
    Math.max(...rindesGrupo) - Math.min(...rindesGrupo) > 5, "A-FEAT-96")

  const sinVivo = grupos.filter(g => !g.kg_vivo).length
  chequear("Grupos", "Ningún grupo se queda sin kilaje vivo",
    "0 grupos", `${sinVivo} grupos`, sinVivo === 0, "A-BUG-116")

  // ══ El desbaste por hora ══════════════════════════════════════════════════════════════════
  const horas = (new Date("2026-09-04T09:00:00-03:00").getTime()
    - new Date("2026-09-03T12:00:00-03:00").getTime()) / 3600000
  chequear("Desbaste", "De las 12:00 al mediodía a las 09:00 del día siguiente",
    "21 horas", `${horas} horas`, horas === 21, "A-FEAT-100")

  const pctCamion = ((NETO_CAMION - 6260) / NETO_CAMION) * 100
  chequear("Desbaste", "Contra el camión da un desbaste normal (0,15–0,20 %/h)",
    "≈0,176 %/h", `${(pctCamion / horas).toFixed(3)} %/h`,
    cerca(pctCamion / horas, 0.176, 0.005), "A-FEAT-100")

  // ══ SICORE: el mínimo se consume UNA vez por proveedor, no una por factura ════════════════
  // Los tres netos son los reales de ALCORTA EDMUNDO del 10/09/2026 (FC 6337, 6328 y 6347),
  // escritos acá como constantes: si mañana alguien edita esas filas, el caso no cambia.
  const ALCORTA = [148202.62, 95916.33, 74140.48]
  const MIN_BIENES = 224000      // tipos_sicore_config → Bienes
  const ALIC_BIENES = 0.02

  const pasos = simularSecuencia(ALCORTA, MIN_BIENES, ALIC_BIENES)
  const totalRetenido = r2(pasos.reduce((s, p) => s + p.retencion, 0))

  // 🔴 EL CASO DEL BUG: ninguna de las tres llega sola al mínimo, y sumadas sí.
  chequear("SICORE", "Tres facturas bajo el mínimo que SUMADAS lo superan sí retienen",
    "$1.885,19", `$${n2(totalRetenido)}`, cerca(totalRetenido, 1885.19, 0.01), "A-BUG-137")

  chequear("SICORE", "Ninguna de las tres llega sola al mínimo de Bienes",
    "las 3 por debajo de $224.000", `máx $${n2(Math.max(...ALCORTA))}`,
    Math.max(...ALCORTA) < MIN_BIENES, "A-BUG-137")

  // El control del camino inverso (§ CLAUDE.md): de atrás para adelante tiene que dar lo mismo.
  const deUnaVez = retencionDelGrupo(ALCORTA, MIN_BIENES, ALIC_BIENES)
  chequear("SICORE", "Factura por factura da lo mismo que (total − mínimo) × alícuota",
    `$${n2(deUnaVez)}`, `$${n2(totalRetenido)}`, cerca(totalRetenido, deUnaVez, 0.01), "A-BUG-137")

  // El mínimo es UNO por proveedor y régimen: si se aplicara por factura, se consumiría 3 veces.
  const minimoConsumido = r2(pasos.reduce((s, p) => s + p.minimoAplicado, 0))
  chequear("SICORE", "El mínimo se consume una sola vez entre las tres",
    `$${n2(MIN_BIENES)}`, `$${n2(minimoConsumido)}`, cerca(minimoConsumido, MIN_BIENES, 0.01), "A-BUG-137")

  // La primera no retiene pero NO es el final: si el circuito se corta ahí, se retienen $0.
  chequear("SICORE", "La primera no retiene, y las dos siguientes sí",
    "no · sí · sí", pasos.map(p => p.retiene ? "sí" : "no").join(" · "),
    !pasos[0].retiene && pasos[1].retiene && pasos[2].retiene, "A-BUG-137")

  // El orden no puede cambiar el total: era un objetivo declarado del acumulado.
  const alReves = r2(simularSecuencia([...ALCORTA].reverse(), MIN_BIENES, ALIC_BIENES)
    .reduce((s, p) => s + p.retencion, 0))
  chequear("SICORE", "Al revés da lo mismo — el orden no cambia lo que se retiene",
    `$${n2(totalRetenido)}`, `$${n2(alReves)}`, cerca(alReves, totalRetenido, 0.01), "A-BUG-137")

  // Y que siga siendo cierto lo de siempre: una sola factura bajo el mínimo NO retiene.
  const solaChica = simularSecuencia([95916.33], MIN_BIENES, ALIC_BIENES)
  chequear("SICORE", "Una sola factura bajo el mínimo sigue sin retener",
    "$0,00", `$${n2(solaChica[0].retencion)}`, solaChica[0].retencion === 0, "A-BUG-137")

  // El descuento pronto pago baja el neto pagado → consume MENOS mínimo → la siguiente retiene menos.
  // Con un descuento de $8.202,62 neto sobre la primera, consume 140.000 en vez de 148.202,62.
  const conDescuento = calcularRetencion({
    neto: 95916.33, minimoRegimen: MIN_BIENES, netoPrevio: 140000, yaRetuvo: false, alicuota: ALIC_BIENES,
  })
  chequear("SICORE", "El descuento de la primera baja lo consumido, y la 2ª retiene MENOS",
    "$238,33", `$${n2(conDescuento.retencion)}`,
    cerca(conDescuento.retencion, (95916.33 - (MIN_BIENES - 140000)) * ALIC_BIENES, 0.01), "A-BUG-139")

  chequear("SICORE", "…y sin descontarlo retendría de más",
    "menos que $402,38", `$${n2(conDescuento.retencion)}`,
    conDescuento.retencion < 402.38, "A-BUG-139")

  // Servicios tiene otro mínimo: la MISMA factura que no retiene por bienes, retiene por servicios.
  const porServicios = simularSecuencia([95916.33], 67170, 0.02)
  chequear("SICORE", "La misma factura por Servicios sí retiene (otro mínimo)",
    "$574,93", `$${n2(porServicios[0].retencion)}`,
    cerca(porServicios[0].retencion, (95916.33 - 67170) * 0.02, 0.01), "A-BUG-137")

  // ── A-BUG-146 — filas repetidas antes del TXT que va a ARCA ─────────────────────────────────
  //
  // Los números son los REALES del pago de ALCORTA del 10/09: la FC 6337 quedó duplicada y el
  // renglón del certificado declaraba $534.631,16 de pago en vez de $364.272,27.
  const F6337 = { id: "a", factura_id: "f-6337", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 170358.89, retencion: 0, pago: 170358.89, neto_gravado_pagado: 140792.49 }
  const F6328 = { id: "b", factura_id: "f-6328", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 110255.81, retencion: 158.26, pago: 110097.55, neto_gravado_pagado: 91120.51 }
  const F6347 = { id: "c", factura_id: "f-6347", quincena: "26-09 - 1ra", tipo_sicore: "Bienes",
    total_pagado: 85224.50, retencion: 1408.67, pago: 83815.83, neto_gravado_pagado: 70433.46 }
  const DUP6337 = { ...F6337, id: "a2" }   // la del doble click: otro id, todo lo demás igual

  const conDup = deduplicarFilasSicore([F6337, DUP6337, F6328, F6347])
  const sumaPago = (fs: typeof conDup.vigentes) => r2(fs.reduce((s, f) => s + (f.pago as number), 0))

  chequear("SICORE", "La fila duplicada por el doble click queda FUERA del TXT",
    "1 descartada de 4", `${conDup.descartados.length} descartada(s) de 4`,
    conDup.descartados.length === 1 && conDup.vigentes.length === 3, "A-BUG-146")

  chequear("SICORE", "…y el pago declarado a ARCA vuelve al correcto",
    "$364.272,27", `$${n2(sumaPago(conDup.vigentes))}`,
    cerca(sumaPago(conDup.vigentes), 364272.27, 0.01), "A-BUG-146")

  chequear("SICORE", "Sin deduplicar declararía de más — el caso falla con el código viejo",
    "$534.631,16", `$${n2(r2([F6337, DUP6337, F6328, F6347].reduce((s, f) => s + f.pago, 0)))}`,
    cerca(r2([F6337, DUP6337, F6328, F6347].reduce((s, f) => s + f.pago, 0)), 534631.16, 0.01), "A-BUG-146")

  // 🔴 El adversario, y es el que hace que el arreglo sea seguro: DOS PAGOS PARCIALES legítimos de
  // la misma factura en la misma quincena **no se pueden colapsar**. Se distinguen por el importe.
  const parcial1 = { ...F6328, id: "p1", total_pagado: 50000, pago: 49900, retencion: 100 }
  const parcial2 = { ...F6328, id: "p2", total_pagado: 60255.81, pago: 60197.55, retencion: 58.26 }
  const conParciales = deduplicarFilasSicore([parcial1, parcial2])
  chequear("SICORE", "🔴 Dos pagos PARCIALES de la misma factura NO se colapsan",
    "las 2 quedan", `quedan ${conParciales.vigentes.length}`,
    conParciales.vigentes.length === 2 && conParciales.descartados.length === 0, "A-BUG-146")

  // Y una fila sin factura ni anticipo cae en su propio id: ante la duda, se conserva.
  const sueltas = deduplicarFilasSicore([
    { id: "x", quincena: "26-09 - 1ra", tipo_sicore: "Bienes", total_pagado: 100, retencion: 2, pago: 98 },
    { id: "y", quincena: "26-09 - 1ra", tipo_sicore: "Bienes", total_pagado: 100, retencion: 2, pago: 98 },
  ])
  chequear("SICORE", "Filas sin factura ni anticipo no se descartan entre sí",
    "las 2 quedan", `quedan ${sueltas.vigentes.length}`,
    sueltas.vigentes.length === 2, "A-BUG-146")

  // ── A-FEAT-129 — el test viaja con el proceso: la marca `@pantalla/proceso` ─────────────────
  //
  // Lo que se prueba acá es **qué ve el modal**, que es lo único que decide si la feature sirve:
  // de más, se vuelve ruido y se deja de mirar; de menos, no avisa de nada.
  const MD = [
    '| ID | Estado | Prio | Ítem |',
    '|----|--------|------|------|',
    '| A-TEST-500 | 🔴 | Test | Probar la retención acumulada `@cashflow/sicore` |',
    '| A-TEST-501 | 🟢 | Test | Probar el lote de Galicia `@cashflow/lote` |',
    '| A-TEST-502 | ✅ | Test | Ya probado, no tiene que aparecer `@cashflow/sicore` |',
    '| A-TEST-503 | 🔴 | Test | Sin marca de proceso, sólo de pantalla `@cashflow` |',
    '| A-BUG-500 | 🔴 | Bug | Un bug del mismo proceso, que NO es un test `@cashflow/sicore` |',
  ].join('\n')
  const parsed = parsePendientes(MD)
  const abiertoP = (p: { estado: string }) => !['✅', '⚰️', '⏸️'].some(e => (p.estado || '').includes(e))
  const delModal = parsed.pendientes.filter(p =>
    esDelProceso(p, 'cashflow/sicore') && /^A-TEST-/i.test(p.id) && abiertoP(p))

  chequear("Tests del proceso", "El modal de SICORE muestra SÓLO el test abierto de su proceso",
    "A-TEST-500", delModal.map(p => p.id).join(', ') || '(ninguno)',
    delModal.length === 1 && delModal[0].id === 'A-TEST-500', "A-FEAT-129")

  // 🔴 Los cuatro adversarios, uno por cada forma de colarse.
  chequear("Tests del proceso", "🔴 Un test de OTRO proceso de la misma pantalla no entra",
    "A-TEST-501 afuera", delModal.some(p => p.id === 'A-TEST-501') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-501'), "A-FEAT-129")

  chequear("Tests del proceso", "🔴 Un test YA PROBADO no vuelve a aparecer",
    "A-TEST-502 afuera", delModal.some(p => p.id === 'A-TEST-502') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-502'), "A-FEAT-129")

  // El más importante: sin marca de proceso NO entra. Si heredara el «sin marca = en todas las
  // pantallas» de `pantallasDe`, el modal arrancaría con cientos de ítems y nadie lo miraría.
  chequear("Tests del proceso", "🔴 Sin marca de PROCESO no entra (aunque tenga la de pantalla)",
    "A-TEST-503 afuera", delModal.some(p => p.id === 'A-TEST-503') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-TEST-503'), "A-FEAT-129")

  chequear("Tests del proceso", "🔴 Un BUG del mismo proceso no entra: el cartel es de tests",
    "A-BUG-500 afuera", delModal.some(p => p.id === 'A-BUG-500') ? "entró" : "afuera",
    !delModal.some(p => p.id === 'A-BUG-500'), "A-FEAT-129")

  // 🐞 Y el que reproduce el bug que cometí escribiendo esto: filtrar por la columna `tipo` daba
  // CERO con los cinco bien marcados, porque en varias tablas del índice esa celda no se mapea.
  const porColumnaTipo = parsed.pendientes.filter(p =>
    esDelProceso(p, 'cashflow/sicore') && p.tipo === 'Test' && abiertoP(p))
  chequear("Tests del proceso", "Filtrar por la columna `tipo` NO sirve — por eso se usa el ID",
    "0 por columna vs 1 por ID", `${porColumnaTipo.length} vs ${delModal.length}`,
    porColumnaTipo.length !== delModal.length || porColumnaTipo.length === 0, "A-FEAT-129")

  // Dos marcas en la misma fila: cada sub tiene que quedar pegado a SU pantalla.
  const dos = parsePendientes([
    '| ID | Estado | Prio | Ítem |', '|----|--------|------|------|',
    '| A-TEST-504 | 🔴 | Test | Dos procesos `@cashflow/sicore` `@egresos/subdiarios` |',
  ].join('\n')).pendientes[0]
  chequear("Tests del proceso", "Con dos marcas, cada proceso queda pegado a SU pantalla",
    "cashflow/sicore + egresos/subdiarios", dos?.procesos.join(' + ') || '(ninguno)',
    !!dos && dos.procesos.includes('cashflow/sicore') && dos.procesos.includes('egresos/subdiarios'),
    "A-FEAT-129")

  // ── A-BUG-145 / A-BUG-149 — el Detalle de Pago que sale de la empresa ───────────────────────
  //
  // 🔴 Lo que se calcula acá **lo lee el proveedor** y concilia su cuenta corriente contra esto.
  // Números reales del pago de ALCORTA del 10/09.
  const ALCORTA_PAGO = [
    { comprobante: "FC 6337", imp_total: 179325.15, monto_sicore: null, descuento_aplicado: 8966.26, monto_a_abonar: 170358.89, origen: "ARCA" },
    { comprobante: "FC 6328", imp_total: 116058.75, monto_sicore: 158.26, descuento_aplicado: 5802.94, monto_a_abonar: 110097.55, origen: "ARCA" },
    { comprobante: "FC 6347", imp_total: 89710.00, monto_sicore: 1408.67, descuento_aplicado: 4485.50, monto_a_abonar: 83815.83, origen: "ARCA" },
  ]

  // A-BUG-145: las 3 facturas se pagaron con UNA transferencia (mismo grupo de pago).
  const unaTransferencia = [{ tipo: "transferencia" as const, monto: 364272.27, detalle: "Transferencia (3 facturas)" }]
  const cAlcorta = calcularCuenta(ALCORTA_PAGO, unaTransferencia, "arca")

  chequear("Detalle de pago", "🔴 Un pago con UNA transferencia se anuncia como UN renglón",
    "1 medio", `${unaTransferencia.length} medio(s)`, unaTransferencia.length === 1, "A-BUG-145")

  chequear("Detalle de pago", "…y la cuenta cierra igual: $385.093,90",
    "$385.093,90", `$${n2(cAlcorta.totalCancelado)}`,
    cerca(cAlcorta.totalCancelado, 385093.90, 0.01) && cerca(cAlcorta.bruto, 385093.90, 0.01), "A-BUG-145")

  // 🔑 El que explica por qué ningún control lo agarraba: con TRES renglones la cuenta **también**
  // cerraba. El total estaba bien y el desglose mentía — por eso hizo falta mirarlo, no sumarlo.
  const tresTransferencias = ALCORTA_PAGO.map(i => ({ tipo: "transferencia" as const, monto: i.monto_a_abonar }))
  const cTres = calcularCuenta(ALCORTA_PAGO, tresTransferencias, "arca")
  chequear("Detalle de pago", "Con 3 renglones la cuenta CERRABA igual — por eso el bug sobrevivió",
    "cierra, y está mal igual", `dif $${n2(cTres.dif)} con ${tresTransferencias.length} renglones`,
    Math.abs(cTres.dif) <= 1 && tresTransferencias.length === 3, "A-BUG-145")

  // A-BUG-149: un ANTICIPO no es una factura. Es el caso IGLESIAS que dio nombre a A-BUG-105.
  const conAnticipo = [
    { comprobante: "FC 816", imp_total: 3554000, monto_sicore: 57400.40, descuento_aplicado: null, monto_a_abonar: 1042599.60, origen: "ARCA" },
    { comprobante: "Anticipo", imp_total: 2454000, monto_sicore: null, descuento_aplicado: null, monto_a_abonar: 2454000, origen: "ANTICIPO" },
  ]
  const cAnt = calcularCuenta(conAnticipo, [
    { tipo: "echeq" as const, monto: 2454000 }, { tipo: "transferencia" as const, monto: 1042599.60 },
  ], "arca")
  chequear("Detalle de pago", "🔴 Un ANTICIPO no suma al «Importe facturas»",
    "$3.554.000,00", `$${n2(cAnt.bruto)}`, cerca(cAnt.bruto, 3554000, 0.01), "A-BUG-149")

  // Y el que falla con el código viejo: así sumaba el PDF antes (a mano, sin mirar `origen`).
  const brutoViejo = conAnticipo.reduce((s, i) => s + i.imp_total, 0)
  chequear("Detalle de pago", "Sumando a mano daba $6.008.000 — el PDF hacía exactamente eso",
    "$6.008.000,00 (mal)", `$${n2(brutoViejo)}`,
    cerca(brutoViejo, 6008000, 0.01) && !cerca(brutoViejo, cAnt.bruto, 1), "A-BUG-149")

  // 🔴 El invariante que pidió el usuario: ver y encolar tienen que dar lo MISMO. Las dos cuentas
  // salen de la misma función, así que con los mismos items y medios no pueden diferir.
  const cVer = calcularCuenta(conAnticipo, [{ tipo: "echeq" as const, monto: 2454000 }, { tipo: "transferencia" as const, monto: 1042599.60 }], "arca")
  chequear("Detalle de pago", "🔴 VER el PDF y ENCOLARLO al mail dan el mismo número",
    `$${n2(cAnt.totalCancelado)}`, `$${n2(cVer.totalCancelado)}`,
    cerca(cAnt.totalCancelado, cVer.totalCancelado, 0.01) && cerca(cAnt.bruto, cVer.bruto, 0.01), "A-BUG-149")

  // ── A-BUG-151 — la etiqueta del comprobante que LEE EL PROVEEDOR ────────────────────────────
  const NOTA = "Insumos Veterinarios Varios + Reproductiva"
  const grupo3 = [
    `FC 6337 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
    `FC 6328 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
    `FC 6347 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
  ].join(" | ")
  const et3 = etiquetaComprobante({ comprobante: grupo3 })

  chequear("Detalle de pago", "🔴 Un grupo nombra LAS TRES facturas, no sólo la primera",
    "6337, 6328 y 6347", et3,
    et3.includes("6337") && et3.includes("6328") && et3.includes("6347"), "A-BUG-151")

  chequear("Detalle de pago", "…y ninguna nota interna sale de la empresa",
    "sin la nota", et3.includes(NOTA) ? "SE FILTRÓ la nota" : "sin la nota",
    !et3.includes(NOTA), "A-BUG-151")

  // 🔴 La otra mitad, y es la que se escapa si el arreglo se hace a medias: cuando la PRIMERA no
  // tiene nota, el corte viejo caía más adelante y filtraba la nota de otra.
  const primeraSinNota = [
    "FC 6337 - ALCORTA EDMUNDO ERNESTO",
    `FC 6328 - ALCORTA EDMUNDO ERNESTO · ${NOTA}`,
  ].join(" | ")
  const etMixta = etiquetaComprobante({ comprobante: primeraSinNota })
  chequear("Detalle de pago", "🔴 Con la primera SIN nota, tampoco se filtra la nota de la otra",
    "sin la nota, con las 2 facturas", etMixta,
    !etMixta.includes(NOTA) && etMixta.includes("6337") && etMixta.includes("6328"), "A-BUG-151")

  // Y lo que ya andaba tiene que seguir andando: una factura sola, con su nota.
  const sola = etiquetaComprobante({ comprobante: `FC 6337 - ALCORTA EDMUNDO ERNESTO · ${NOTA}` })
  chequear("Detalle de pago", "Una factura sola sigue saliendo igual que antes",
    "FC 6337 - ALCORTA EDMUNDO ERNESTO", sola,
    sola === "FC 6337 - ALCORTA EDMUNDO ERNESTO", "A-BUG-151")

  chequear("Detalle de pago", "Un ANTICIPO se sigue anunciando como «Anticipo»",
    "Anticipo", etiquetaComprobante({ comprobante: "lo que sea", origen: "ANTICIPO" }),
    etiquetaComprobante({ comprobante: "x", origen: "ANTICIPO" }) === "Anticipo", "A-BUG-105")

  // ── A-FEAT-77 — los pagos de sueldos agrupados por empleado ─────────────────────────────────
  const PAGOS_SUELDO = [
    { id: "p1", empleado_id: "e-sigot", monto: 450000.50, empleado: { nombre: "Ruben Sigot" } },
    { id: "p2", empleado_id: "e-wilson", monto: 380000, empleado: { nombre: "Wilson Barreto" } },
    { id: "p3", empleado_id: "e-sigot", monto: 120000.25, empleado: { nombre: "Ruben Sigot" } },
    { id: "p4", empleado_id: "e-alondra", monto: 290000, empleado: { nombre: "Alondra Olivo" } },
    { id: "p5", empleado_id: "e-sigot", monto: 80000.25, empleado: { nombre: "Ruben Sigot" } },
  ]
  const gruposSueldo = agruparPagosPorEmpleado(PAGOS_SUELDO)

  chequear("Sueldos", "Los pagos se agrupan por empleado, ordenados por nombre",
    "Alondra Olivo, Ruben Sigot, Wilson Barreto", gruposSueldo.map(g => g.nombre).join(", "),
    gruposSueldo.map(g => g.nombre).join(", ") === "Alondra Olivo, Ruben Sigot, Wilson Barreto", "A-FEAT-77")

  const sigot = gruposSueldo.find(g => g.empleadoId === "e-sigot")!
  chequear("Sueldos", "🔴 El total del grupo SUMA sus pagos — es lo único que se ve cerrado",
    "$650.001,00 en 3 pagos", `$${n2(sigot.total)} en ${sigot.cantidad} pagos`,
    cerca(sigot.total, 650001, 0.01) && sigot.cantidad === 3, "A-FEAT-77")

  chequear("Sueldos", "…y ningún pago se pierde en el agrupado",
    `${PAGOS_SUELDO.length} pagos`, `${gruposSueldo.reduce((s, g) => s + g.pagos.length, 0)} pagos`,
    gruposSueldo.reduce((s, g) => s + g.pagos.length, 0) === PAGOS_SUELDO.length, "A-FEAT-77")

  // 🔴 El adversario: dos empleados con el MISMO nombre no se pueden juntar. Agrupar por texto
  //    daría un total inflado, que en una pantalla de plata no se lee como error sino como dato.
  const homonimos = agruparPagosPorEmpleado([
    { id: "h1", empleado_id: "e-uno", monto: 100000, empleado: { nombre: "Juan Perez" } },
    { id: "h2", empleado_id: "e-dos", monto: 250000, empleado: { nombre: "Juan Perez" } },
  ])
  chequear("Sueldos", "🔴 Dos empleados con el MISMO nombre no se juntan (se agrupa por id)",
    "2 grupos", `${homonimos.length} grupo(s)`, homonimos.length === 2, "A-FEAT-77")

  // Y un pago sin nombre cargado no rompe la lista ni se muestra vacío.
  const sinNombre = agruparPagosPorEmpleado([{ id: "x", empleado_id: "e-x", monto: 1000 }])
  chequear("Sueldos", "Un pago sin nombre de empleado se muestra igual, no desaparece",
    "(sin nombre)", sinNombre[0]?.nombre ?? "(no salió)",
    sinNombre.length === 1 && sinNombre[0].nombre === "(sin nombre)", "A-FEAT-77")

  // ── P-45 — cuándo NO hay que preguntar por la fecha de pago ─────────────────────────────────
  const HOY = "2026-09-11"
  const preguntar = (filas: Array<{ fecha_pago?: string | null }>) => hayQuePreguntarFechaPago(filas, HOY)

  chequear("Fecha de pago", "Si TODAS ya tienen la fecha de hoy, no se pregunta",
    "no pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: HOY }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: HOY }]) === false, "P-45")

  // 🔴 Los cuatro adversarios. Todos tienen que caer del lado de PREGUNTAR: no preguntar de menos
  //    escribe una fecha equivocada, y de ella sale la quincena de SICORE.
  chequear("Fecha de pago", "🔴 Si UNA tiene otra fecha, se pregunta por el lote entero",
    "pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: "2026-09-04" }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: "2026-09-04" }]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Si UNA no tiene fecha, se pregunta",
    "pregunta", preguntar([{ fecha_pago: HOY }, { fecha_pago: null }]) ? "pregunta" : "no pregunta",
    preguntar([{ fecha_pago: HOY }, { fecha_pago: null }]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Con la lista VACÍA se pregunta (no se asume nada)",
    "pregunta", preguntar([]) ? "pregunta" : "no pregunta", preguntar([]) === true, "P-45")

  chequear("Fecha de pago", "🔴 Sin fecha propuesta se pregunta",
    "pregunta", hayQuePreguntarFechaPago([{ fecha_pago: HOY }], "") ? "pregunta" : "no pregunta",
    hayQuePreguntarFechaPago([{ fecha_pago: HOY }], "") === true, "P-45")

  // ── B-BUG-CLIENTE-NO-SE-CREA / A-FEAT-41 — el upsert de contrapartes ────────────────────────
  const FICHAS = [
    { cuit: "20103619115", es_cliente: false, es_proveedor: true },   // ALCORTA: proveedor, no cliente
    { cuit: "30714279315", es_cliente: true, es_proveedor: true },    // MERCURE: ya es las dos cosas
  ]
  const planCli = planificarContrapartes([
    { cuit: "20-10361911-5", razon_social: "ALCORTA EDMUNDO ERNESTO" },  // existe, falta el flag
    { cuit: "30714279315", razon_social: "LA MERCURE S.R.L." },          // existe y ya tiene el flag
    { cuit: "30-99999999-7", razon_social: "SANPA S.A." },               // no existe → crear
    { cuit: "", razon_social: "sin cuit" },                              // se descarta, pero se cuenta
  ], FICHAS, "cliente")

  chequear("Contrapartes", "🔴 El que NO existe se CREA (no se hace sólo UPDATE)",
    "1 a crear: 30999999997", `${planCli.aCrear.length} a crear: ${planCli.aCrear.map(c => c.cuit).join(",")}`,
    planCli.aCrear.length === 1 && planCli.aCrear[0].cuit === "30999999997", "B-BUG-CLIENTE-NO-SE-CREA")

  // 🔴 EL adversario de este arreglo, y viene del ESQUEMA: `es_proveedor` tiene DEFAULT true.
  //    Crear un cliente puro sin decir nada lo deja marcado como proveedor, contra la regla.
  chequear("Contrapartes", "🔴 Un cliente nuevo nace con es_proveedor = FALSE (el default es true)",
    "es_cliente=true · es_proveedor=false",
    `es_cliente=${planCli.aCrear[0]?.es_cliente} · es_proveedor=${planCli.aCrear[0]?.es_proveedor}`,
    planCli.aCrear[0]?.es_cliente === true && planCli.aCrear[0]?.es_proveedor === false,
    "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "Al que existe SIN el flag se le marca, no se lo duplica",
    "marcar 20103619115", planCli.aMarcar.join(",") || "(ninguno)",
    planCli.aMarcar.length === 1 && planCli.aMarcar[0] === "20103619115", "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "Al que ya tiene el flag no se lo toca",
    "MERCURE afuera", planCli.aMarcar.includes("30714279315") ? "se tocó" : "afuera",
    !planCli.aMarcar.includes("30714279315"), "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "El CUIT se normaliza: con guiones y sin guiones son el MISMO",
    "1 a crear (no 2)", `${planCli.aCrear.length} a crear`,
    planCli.aCrear.length === 1, "B-BUG-CLIENTE-NO-SE-CREA")

  chequear("Contrapartes", "⚠️ Lo que viene sin CUIT se descarta pero SE CUENTA",
    "1 sin cuit", `${planCli.sinCuit} sin cuit`, planCli.sinCuit === 1, "B-BUG-CLIENTE-NO-SE-CREA")

  // Y el espejo: por el lado de compras, un proveedor nuevo NO nace marcado como cliente.
  const planProv = planificarContrapartes([{ cuit: "30-55555555-5", razon_social: "NUEVO SRL" }], [], "proveedor")
  chequear("Contrapartes", "Un proveedor nuevo nace con es_cliente = false",
    "es_proveedor=true · es_cliente=false",
    `es_proveedor=${planProv.aCrear[0]?.es_proveedor} · es_cliente=${planProv.aCrear[0]?.es_cliente}`,
    planProv.aCrear[0]?.es_proveedor === true && planProv.aCrear[0]?.es_cliente === false,
    "B-BUG-CLIENTE-NO-SE-CREA")

  // Sin razón social, `razon_social` es NOT NULL: se usa el CUIT antes que romper el import.
  const planSinNombre = planificarContrapartes([{ cuit: "30111111117" }], [], "cliente")
  chequear("Contrapartes", "Sin razón social se usa el CUIT — no se rompe el import",
    "30111111117", planSinNombre.aCrear[0]?.razon_social ?? "(vacío)",
    planSinNombre.aCrear[0]?.razon_social === "30111111117", "B-BUG-CLIENTE-NO-SE-CREA")

  // ══ Editar una campaña de templates (A-FEAT-131) ══════════════════════════════════════════
  //
  // 🔒 El invariante: **los links conciliados perduran hagas lo que hagas.** Los datos de abajo son
  // los REALES de `Red Vial Cuota Lote Puerto` al 2026-09-12, escritos acá como constantes — es el
  // template que destapó el hueco (hay que llevarlo de 4 cuotas a 6 y no hay pantalla que lo haga).
  //
  // ⚠️ Un caso tiene que fallar con el código viejo. Acá el «código viejo» es *borrar y recrear*,
  // que es lo que ya rompió 9 vínculos (A-BUG-156): los dos primeros casos fallarían con esa
  // implementación, porque el `id` cambiaría.
  const C1 = "0d15c8d6-ebf1-4f21-bec9-855f945b4940"   // 16/03, $54.770,60 — CONCILIADA
  const C2 = "5dfe31fa-c0c9-43fe-9489-f681e236421a"   // 16/06, $30.215,00 — pagada, sin vínculo
  const C3 = "87c6991f-7c39-4764-930f-378e73f7612b"   // 05/09, $54.770,60 — pendiente
  const C4 = "425ebf6b-fd74-46e8-b78b-08cddb1b8587"   // 05/12, $54.770,60 — pendiente

  const CUOTAS_LOTE_PUERTO: CuotaExistente[] = [
    { id: C1, numero_cuota: 1, fecha_estimada: "2026-03-16", monto: 54770.60, estado: "conciliado" },
    { id: C2, numero_cuota: 2, fecha_estimada: "2026-06-16", monto: 30215.00, estado: "pagado" },
    { id: C3, numero_cuota: 3, fecha_estimada: "2026-09-05", monto: 54770.60, estado: "pendiente" },
    { id: C4, numero_cuota: 4, fecha_estimada: "2026-12-05", monto: 54770.60, estado: "pendiente" },
  ]
  const igual = (c: CuotaExistente) => ({ id: c.id, fecha_estimada: c.fecha_estimada!, monto: c.monto })

  // El movimiento REAL que está enganchado a la cuota 1, y el REAL de $30.215 que sigue pendiente.
  const mov = (o: Partial<MovBancario> & { id: string; fecha: string; debitos: number }): MovBancario => ({
    tabla: "msa_galicia", creditos: 0, descripcion: "Trf Inmed Proveed",
    estado: "pendiente", template_cuota_id: null, ...o,
  })
  const MOV_VINCULADO = mov({ id: "f5e86271", fecha: "2026-03-16", debitos: 54770.6, estado: "conciliado", template_cuota_id: C1 })
  const MOV_SUELTO_30215 = mov({ id: "58693d0f", fecha: "2026-06-16", debitos: 30215 })
  const MOV_DE_OTRA_CUOTA = mov({ id: "b9244cdc", fecha: "2026-06-16", debitos: 468762.23, estado: "conciliado", template_cuota_id: "456bd8bb" })

  // ── 1 · Editar NO recrea: la cuota conserva su id ────────────────────────────────────────
  const planMonto = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    { id: C1, fecha_estimada: "2026-03-16", monto: 60000 },
    ...CUOTAS_LOTE_PUERTO.slice(1).map(igual),
  ])
  const accionesCrear = planMonto.acciones.filter(a => a.tipo === "crear")
  chequear("Editar campaña", "🔒 Cambiar el monto EDITA la cuota — no la recrea",
    "1 modificar · 0 crear", `${planMonto.acciones.filter(a => a.tipo === "modificar").length} modificar · ${accionesCrear.length} crear`,
    planMonto.acciones.length === 1 && planMonto.acciones[0].tipo === "modificar"
    && planMonto.acciones[0].id === C1, "A-FEAT-131")

  chequear("Editar campaña", "🔒 Y las otras tres cuotas no se tocan",
    "0 acciones sobre C2/C3/C4", `${planMonto.acciones.filter(a => a.tipo !== "crear" && a.id !== C1).length} acciones`,
    planMonto.acciones.every(a => a.tipo === "crear" || a.id === C1), "A-FEAT-131")

  // ── 2 · Quitar una cuota la DESACTIVA: el id (y el link) sobrevive ───────────────────────
  const planQuitar = planificarEdicion(CUOTAS_LOTE_PUERTO, CUOTAS_LOTE_PUERTO.slice(1).map(igual))
  const desact = planQuitar.acciones.find(a => a.tipo === "desactivar")
  chequear("Editar campaña", "🔒 Sacar una cuota de la lista la DESACTIVA, nunca la borra",
    `desactivar ${C1.slice(0, 8)}`, desact ? `${desact.tipo} ${desact.id.slice(0, 8)}` : "(ninguna acción)",
    desact?.tipo === "desactivar" && desact.id === C1, "A-FEAT-131")

  // ── 3 · El caso que lo originó: 4 cuotas → 6, sin tocar las 4 ────────────────────────────
  const planSeis = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.map(igual),
    { id: null, fecha_estimada: "2027-03-05", monto: 54770.60 },
    { id: null, fecha_estimada: "2027-06-05", monto: 54770.60 },
  ])
  chequear("Editar campaña", "Agregar 2 cuotas a un plan de 4: sólo 2 altas, cero modificaciones",
    "2 crear · 0 modificar · 0 desactivar",
    `${planSeis.acciones.filter(a => a.tipo === "crear").length} crear · `
    + `${planSeis.acciones.filter(a => a.tipo === "modificar").length} modificar · `
    + `${planSeis.acciones.filter(a => a.tipo === "desactivar").length} desactivar`,
    planSeis.acciones.length === 2 && planSeis.acciones.every(a => a.tipo === "crear"), "A-FEAT-131")

  chequear("Editar campaña", "Los 4 ids originales siguen en la renumeración (ninguno se perdió)",
    "4 ids", `${Object.keys(planSeis.renumerar).length} ids`,
    [C1, C2, C3, C4].every(id => planSeis.renumerar[id] > 0), "A-FEAT-131")

  // Insertar una cuota ANTES de todas renumera, pero no cambia ni un id.
  const planIntercalar = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    { id: null, fecha_estimada: "2026-01-10", monto: 1000 },
    ...CUOTAS_LOTE_PUERTO.map(igual),
  ])
  chequear("Editar campaña", "Intercalar una cuota anterior corre los NÚMEROS, no los ids",
    "la que era 1 pasa a 2", `pasa a ${planIntercalar.renumerar[C1]}`,
    planIntercalar.renumerar[C1] === 2 && planIntercalar.acciones.every(a => a.tipo === "crear"), "A-FEAT-131")

  // ── 4 · El check al momento: el vínculo que se queda sin cerrar ──────────────────────────
  const avisosMonto = evaluarAvisos(planMonto, [MOV_VINCULADO], [MOV_VINCULADO])
  chequear("Editar campaña", "🔴 Cambiar el monto de una cuota CONCILIADA avisa en rojo",
    "VINCULO_SE_ROMPE", avisosMonto.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosMonto.some(a => a.codigo === "VINCULO_SE_ROMPE" && a.nivel === "rojo"), "A-FEAT-131")

  // La tolerancia es la del motor: 5 días pasa, 6 no. Si estos dos dieran igual, el aviso estaría
  // usando un criterio propio y avisaría de matches que el motor nunca haría.
  const conFecha = (f: string) => evaluarAvisos(
    planificarEdicion(CUOTAS_LOTE_PUERTO, [{ id: C1, fecha_estimada: f, monto: 54770.60 }, ...CUOTAS_LOTE_PUERTO.slice(1).map(igual)]),
    [MOV_VINCULADO], [])
  chequear("Editar campaña", "Correr la fecha 5 días NO avisa (es la tolerancia del motor)",
    "sin aviso rojo", `${conFecha("2026-03-21").filter(a => a.nivel === "rojo").length} rojos`,
    conFecha("2026-03-21").every(a => a.nivel !== "rojo"), "A-FEAT-131")
  chequear("Editar campaña", "…y correrla 6 días SÍ avisa",
    "1 aviso rojo", `${conFecha("2026-03-22").filter(a => a.nivel === "rojo").length} rojos`,
    conFecha("2026-03-22").some(a => a.nivel === "rojo"), "A-FEAT-131")

  // ── 5 · El que pidió el usuario: «coincide proveedor, fecha, monto contra salida bancaria» ─
  const planHaciaOtro = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.slice(0, 2).map(igual),
    { id: C3, fecha_estimada: "2026-06-16", monto: 468762.23 },
    igual(CUOTAS_LOTE_PUERTO[3]),
  ])
  const avisosOtro = evaluarAvisos(planHaciaOtro, [MOV_VINCULADO], [MOV_DE_OTRA_CUOTA, MOV_SUELTO_30215])
  chequear("Editar campaña", "🟠 Si el valor nuevo coincide con un movimiento que YA es de otra cuota, avisa",
    "COINCIDE_CON_OTRO", avisosOtro.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosOtro.some(a => a.codigo === "COINCIDE_CON_OTRO"), "A-FEAT-131")

  // Y el otro lado: si el valor nuevo cae sobre una salida SIN conciliar, se informa en azul.
  // 📌 Es el caso real del 16/06: $30.215 sigue pendiente en el banco y la cuota 2 ya dice ese monto.
  const planHaciaSuelto = planificarEdicion(CUOTAS_LOTE_PUERTO, [
    ...CUOTAS_LOTE_PUERTO.slice(0, 2).map(igual),
    { id: C3, fecha_estimada: "2026-06-16", monto: 30215 },
    igual(CUOTAS_LOTE_PUERTO[3]),
  ])
  const avisosSuelto = evaluarAvisos(planHaciaSuelto, [], [MOV_SUELTO_30215])
  chequear("Editar campaña", "🔵 Si cae sobre una salida SIN conciliar, lo dice (no lo calla)",
    "SE_ACERCA", avisosSuelto.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosSuelto.some(a => a.codigo === "SE_ACERCA" && a.nivel === "azul"), "A-FEAT-131")

  // ── 6 · Desactivar algo vinculado se anuncia ─────────────────────────────────────────────
  const avisosQuitar = evaluarAvisos(planQuitar, [MOV_VINCULADO], [])
  chequear("Editar campaña", "Quitar una cuota conciliada lo dice antes de guardar",
    "DESACTIVA_VINCULADA", avisosQuitar.map(a => a.codigo).join(", ") || "(ningún aviso)",
    avisosQuitar.some(a => a.codigo === "DESACTIVA_VINCULADA"), "A-FEAT-131")

  // ── 7 · La trampa del huso horario ───────────────────────────────────────────────────────
  // Si `diasEntre` mezclara medianoche local con medianoche UTC, dos fechas iguales darían 1 día en
  // Argentina (UTC-3) y un match exacto se reportaría como «fecha no exacta».
  chequear("Editar campaña", "Dos fechas iguales distan 0 días (no 1 por el huso horario)",
    "0 días", `${diasEntre("2026-06-16", "2026-06-16")} días`,
    diasEntre("2026-06-16", "2026-06-16") === 0, "A-FEAT-131")

  // Un monto en cero nunca puede «coincidir»: hay 20 cuotas de Red Vial en $0 (A-BUG-135) y todas
  // matchearían entre sí, llenando la pantalla de avisos que no significan nada.
  chequear("Editar campaña", "⚠️ Una cuota en $0 no coincide con nada (hay 20 así en la base)",
    "no coincide", coincide(mov({ id: "x", fecha: "2026-06-16", debitos: 0 }), "2026-06-16", 0) ? "coincide" : "no coincide",
    !coincide(mov({ id: "x", fecha: "2026-06-16", debitos: 0 }), "2026-06-16", 0), "A-FEAT-131")


  // ══ El identificador de una cuota se GENERA (A-FEAT-137) ══════════════════════════════════
  //
  // 🪪 *«Detalle es detalle y descripción es lo que es un identificador»* (usuario, 2026-09-12).
  // Los datos son reales: `UATRE MSA` es uno de los 20 templates que llevan la empresa en el
  // nombre, y el texto libre salió de una cuota de la base.
  const TPL_UATRE = { nombre_referencia: "UATRE MSA", responsable: "MSA" }
  const TPL_REDVIAL = { nombre_referencia: "Red Vial Cuota Lote Puerto", responsable: "MSA" }
  const CUOTA_SEP = { fecha_estimada: "2026-09-05" }

  chequear("Identificador cuota", "⚠️ El responsable NO se repite si el nombre ya lo tiene",
    "UATRE MSA - Septiembre 2026", identificadorDeCuota(CUOTA_SEP, TPL_UATRE),
    identificadorDeCuota(CUOTA_SEP, TPL_UATRE) === "UATRE MSA - Septiembre 2026", "A-FEAT-137")

  chequear("Identificador cuota", "…y SÍ se agrega cuando no lo tiene",
    "Red Vial Cuota Lote Puerto MSA - Septiembre 2026", identificadorDeCuota(CUOTA_SEP, TPL_REDVIAL),
    identificadorDeCuota(CUOTA_SEP, TPL_REDVIAL) === "Red Vial Cuota Lote Puerto MSA - Septiembre 2026",
    "A-FEAT-137")

  // 🔴 Sin nombre no se devuelve media etiqueta: eso se lee como un dato roto, no como uno ausente.
  chequear("Identificador cuota", "Sin nombre de template devuelve vacío, no ' - Septiembre 2026'",
    "(vacío)", identificadorDeCuota(CUOTA_SEP, { nombre_referencia: null }) || "(vacío)",
    identificadorDeCuota(CUOTA_SEP, { nombre_referencia: null }) === "", "A-FEAT-137")

  chequear("Identificador cuota", "Sin fecha queda sólo el nombre (no inventa período)",
    "UATRE MSA", identificadorDeCuota({ fecha_estimada: null }, TPL_UATRE),
    identificadorDeCuota({ fecha_estimada: null }, TPL_UATRE) === "UATRE MSA", "A-FEAT-137")

  // ── La composición: identificador · detalle ──────────────────────────────────────────────
  const LIBRE = "1.740 Kg Maiz Castillo a 193.000 la ton"
  chequear("Identificador cuota", "Con detalle se COMPONE, no se pisa",
    `UATRE MSA - Septiembre 2026 · ${LIBRE}`, detalleCompleto(CUOTA_SEP, TPL_UATRE, LIBRE),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, LIBRE) === `UATRE MSA - Septiembre 2026 · ${LIBRE}`,
    "A-FEAT-137")

  // 🔑 El caso que contesta la duda del usuario: «¿hay que llenar detalle con descripción?».
  //    No: sin detalle se muestra el identificador solo. Copiarlo no agregaría NADA visible,
  //    y en cambio borraría la distinción entre lo escrito y lo generado.
  chequear("Identificador cuota", "🔑 Sin detalle se ve el identificador solo (por eso NO se copia)",
    "UATRE MSA - Septiembre 2026", detalleCompleto(CUOTA_SEP, TPL_UATRE, null),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, null) === "UATRE MSA - Septiembre 2026", "A-FEAT-137")

  // Durante la migración hay filas cuyo detalle YA empieza con el identificador. No se duplica.
  const YA_COPIADO = "UATRE MSA - Septiembre 2026 · algo"
  chequear("Identificador cuota", "⚠️ Si el detalle ya empieza con el identificador, no lo repite",
    YA_COPIADO, detalleCompleto(CUOTA_SEP, TPL_UATRE, YA_COPIADO),
    detalleCompleto(CUOTA_SEP, TPL_UATRE, YA_COPIADO) === YA_COPIADO, "A-FEAT-137")

  // ── El reparto de las 543 filas viejas (A-DAT-37) ────────────────────────────────────────
  chequear("Identificador cuota", "La etiqueta generada se reconoce (se puede vaciar)",
    "es identificador", esElIdentificadorGenerado("UATRE MSA - Septiembre 2026", CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado("UATRE MSA - Septiembre 2026", CUOTA_SEP, TPL_UATRE) === true, "A-DAT-37")

  chequear("Identificador cuota", "🔴 El texto libre NO se confunde con identificador (no se borra)",
    "es del usuario", esElIdentificadorGenerado(LIBRE, CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado(LIBRE, CUOTA_SEP, TPL_UATRE) === false, "A-DAT-37")

  // ⚠️ El sesgo: ante la duda, «es del usuario». Una etiqueta de OTRO período no es la de esta
  //    cuota, así que no se toca — equivocarse hacia acá deja texto redundante; hacia el otro lado
  //    borra algo que escribió una persona.
  chequear("Identificador cuota", "⚠️ Una etiqueta de otro período NO se da por generada",
    "es del usuario", esElIdentificadorGenerado("UATRE MSA - Marzo 2025", CUOTA_SEP, TPL_UATRE) ? "es identificador" : "es del usuario",
    esElIdentificadorGenerado("UATRE MSA - Marzo 2025", CUOTA_SEP, TPL_UATRE) === false, "A-DAT-37")


  // ══ La etiqueta del monto en la propuesta de conciliación (A-BUG-169) ═════════════════════
  //
  // 🏷️ *«Es raro que me dé tantas cosas erróneas»* (usuario, 2026-09-13). El caso real: conciliando
  // un pago de I.C.T. NET de **$35.497,81**, la app ofrecía `BAILO ANDRES` por **$35.500,00** con el
  // cartel **«Monto exacto»**. Difería $2,19.
  //
  // 🔴 **Este caso falla con el código viejo**: la condición era `matchMontoCercano || diffAbs <= 2`,
  // y `matchMontoCercano` es ±5% — o sea que decía «exacto» hasta con $1.700 de diferencia.
  chequear("Etiqueta monto", "🔴 $35.497,81 contra $35.500,00 NO es exacto — dice cuánto se aparta",
    "≈ $2,19", etiquetaMonto(35497.81, 35500).texto,
    etiquetaMonto(35497.81, 35500).texto === "≈ $2,19", "A-BUG-169")

  chequear("Etiqueta monto", "Exacto es diferencia CERO",
    "Monto exacto", etiquetaMonto(35497.81, 35497.81).texto,
    etiquetaMonto(35497.81, 35497.81).exacto === true, "A-BUG-169")

  // Con importes grandes el peso no dice nada y el porcentaje sí: $40.000 sobre 2 M es 2%.
  chequear("Etiqueta monto", "Diferencias grandes se muestran en PORCENTAJE",
    "≈ 2%", etiquetaMonto(2000000, 2040000).texto,
    etiquetaMonto(2000000, 2040000).texto === "≈ 2%", "A-BUG-169")

  // Y al revés: con importes chicos el porcentaje engaña ($18 sobre $600 «suena» a 3%).
  chequear("Etiqueta monto", "…y las chicas en PESOS",
    "≈ $18,00", etiquetaMonto(600, 618).texto,
    etiquetaMonto(600, 618).texto === "≈ $18,00", "A-BUG-169")

  // ⚠️ Un centavo NO es exacto. Es el borde que más tienta redondear, y el que más caro sale:
  //    si un centavo pasa por exacto, la diferencia se pierde y reaparece en un arqueo.
  chequear("Etiqueta monto", "⚠️ Un centavo de diferencia NO es exacto",
    "≈ $0,01", etiquetaMonto(1000, 1000.01).texto,
    etiquetaMonto(1000, 1000.01).exacto === false, "A-BUG-169")


  // ══ La cuenta corriente de una contraparte (A-FEAT-141) ══════════════════════════════════
  //
  // 🧾 Los datos son los REALES de I.C.T. NET de febrero a abril de 2026, que es el tramo donde
  // pasa todo: un pago que no corresponde a ninguna factura, y su descuento un mes después.
  const FC_ICT = [
    { id: "f1", fecha: "2026-02-01", numero: "FC - 10558", total: 22094.30, tipo: "compra" as const },
    { id: "f2", fecha: "2026-03-01", numero: "FC - 10661", total: 22800.01, tipo: "compra" as const },
    { id: "f3", fecha: "2026-04-01", numero: "FC - 10762", total: 28602.99, tipo: "compra" as const },
  ]
  const PG_ICT = [
    { id: "p1", fecha: "2026-02-11", monto: 22094.30, comprobantes_pagados: "FC - 10558" },
    { id: "p2", fecha: "2026-03-10", monto: 22800.01, comprobantes_pagados: "FC - 10661" },
    // 🔴 El pago sin referencia: cubre comprobantes que el proveedor reclamaba y no están cargados.
    { id: "p3", fecha: "2026-03-13", monto: 35497.81, detalle: "Pago ICT Net Octubre y abril que ya estaban pagos" },
    { id: "p4", fecha: "2026-04-10", monto: 8990.21, comprobantes_pagados: "FC - 10762" },
  ]
  const cc = armarCuentaCorriente(FC_ICT, PG_ICT)

  // 🔑 El número que hoy no se puede ver en ninguna pantalla y hay que reconstruir a mano.
  chequear("Cuenta corriente", "🔑 El saldo a favor de ICT NET sale solo",
    "-15.885,03", cc.saldo.toFixed(2),
    cc.saldo === -15885.03, "A-FEAT-141")

  chequear("Cuenta corriente", "…y se lee sin interpretar el signo",
    "Saldo a favor $15.885,03", leyendaSaldo(cc.saldo),
    leyendaSaldo(cc.saldo) === "Saldo a favor $15.885,03", "A-FEAT-141")

  chequear("Cuenta corriente", "Los totales cierran contra el detalle",
    "comprado 73.497,30 · pagado 89.382,33",
    `comprado ${cc.totalComprado.toFixed(2)} · pagado ${cc.totalPagado.toFixed(2)}`,
    cc.totalComprado === 73497.30 && cc.totalPagado === 89382.33, "A-FEAT-141")

  // 🔴 La señal a mirar: el pago que no dice contra qué fue es el que genera el saldo sin avisar.
  chequear("Cuenta corriente", "🔴 Marca el pago que no dice contra qué comprobante fue",
    "1 sin referencia", `${cc.pagosSinReferencia} sin referencia`,
    cc.pagosSinReferencia === 1, "A-FEAT-141")

  // A igual fecha, primero la factura y después el pago: si no, el saldo intermedio muestra un
  // negativo que nunca existió y la columna se vuelve imposible de leer.
  const mismoDia = armarCuentaCorriente(
    [{ id: "f", fecha: "2026-05-01", numero: "FC - 1", total: 1000, tipo: "compra" }],
    [{ id: "p", fecha: "2026-05-01", monto: 1000, comprobantes_pagados: "FC - 1" }])
  chequear("Cuenta corriente", "A igual fecha, primero la factura y después el pago",
    "compra, pago", mismoDia.asientos.map(a => a.tipo).join(", "),
    mismoDia.asientos[0].tipo === "compra" && mismoDia.asientos[1].saldo === 0, "A-FEAT-141")

  // 🤝 El caso proveedor-CLIENTE (AFA): una factura de venta COMPENSA. Con dos saldos separados
  //    esa compensación no se ve; con uno solo, sí — y es el canal de pago de A-FEAT-140.
  const afa = armarCuentaCorriente(
    [{ id: "c", fecha: "2026-05-01", numero: "FC compra", total: 100000, tipo: "compra" },
     { id: "v", fecha: "2026-05-02", numero: "FC venta",  total: 40000,  tipo: "venta" }], [])
  chequear("Cuenta corriente", "🤝 Una factura de VENTA compensa lo que le debo (caso AFA)",
    "Le debo $60.000,00", leyendaSaldo(afa.saldo),
    afa.saldo === 60000, "A-FEAT-141")

  // ⚠️ Sin fecha no se descarta: si se escondiera, el saldo dejaría de cerrar contra el detalle.
  const sinFecha = armarCuentaCorriente(
    [{ id: "x", fecha: null, numero: "FC sin fecha", total: 500, tipo: "compra" }], [])
  chequear("Cuenta corriente", "⚠️ Un comprobante sin fecha entra igual (no se descarta plata)",
    "1 asiento · saldo 500", `${sinFecha.asientos.length} asiento · saldo ${sinFecha.saldo}`,
    sinFecha.asientos.length === 1 && sinFecha.saldo === 500, "A-FEAT-141")


  // ══ 🧪 EL AUDIT DE CONSISTENCIA (A-FEAT-145) ══════════════════════════════════════════════════
  // Los datos de abajo son los CASOS REALES que se midieron el 2026-09-13 al escribir la
  // expectativa (§ 30.9.7), reducidos a una fila cada uno. Los números esperados salen de ahí.

  const movAudBase = {
    cuenta: "MSA Galicia", fecha: "2026-04-06", descripcion: "Trf Inmed Proveed",
    debitos: 84000, creditos: 0, estado: "conciliado",
    categ: "GASTOS VARIOS GANADERIA", nro_cuenta: null, proveedor_nombre: "Alguien",
    comprobantes_pagados: "FC - 1", detalle: null,
    comprobante_arca_id: null, template_cuota_id: null, sueldo_pago_id: null, anticipo_id: null,
  }
  const movAud = (id: string, over: Partial<MovAuditable>): MovAuditable =>
    ({ ...movAudBase, id, ...over } as MovAuditable)

  const PLAN = new Set(["GASTOS VARIOS GANADERIA"])

  // 🔑 LA EXCEPCIÓN QUE SE DESCUBRIÓ AL MEDIR: 7 de los 8 casos con dos vínculos eran
  //    ARCA + anticipo, que es el cierre normal del circuito. Sin esto el control da 7 falsos
  //    positivos — y la primera versión de § 30.9.6 lo daba.
  chequear("Audit", "🔑 ARCA + anticipo NO es error: es el cierre normal de un anticipo",
    "legítimo", vinculoDobleEsLegitimo(["ARCA", "anticipo"]) ? "legítimo" : "reportado como error",
    vinculoDobleEsLegitimo(["ARCA", "anticipo"]) === true, "A-FEAT-145")

  chequear("Audit", "Template + sueldo a la vez SÍ es error (el caso real del 06/04)",
    "error", vinculoDobleEsLegitimo(["template", "sueldo"]) ? "legítimo" : "error",
    vinculoDobleEsLegitimo(["template", "sueldo"]) === false, "A-DAT-44")

  // Un pago que canceló una factura usando un anticipo ES de ARCA para el estándar: lleva
  // número de cuenta, y el anticipo ya dejó de ser un destino.
  chequear("Audit", "Con ARCA + anticipo, el origen que manda es ARCA",
    "ARCA", origenDe(movAud("x", { comprobante_arca_id: "a", anticipo_id: "b" })),
    origenDe(movAud("x", { comprobante_arca_id: "a", anticipo_id: "b" })) === "ARCA", "A-FEAT-145")

  // ── Los TRES destinos del detalle repetido ────────────────────────────────────────────────
  // Tratarlos igual destruye dato: es la razón por la que el audit propone y no aplica.
  const ruido = movAud("d1", { proveedor_nombre: "GOROSITO OLGA MARIA", detalle: "GOROSITO OLGA MARIA" })
  chequear("Audit", "Detalle = proveedor y nada más → se VACÍA",
    "vaciar", String(destinoDelDetalle(ruido)), destinoDelDetalle(ruido) === "vaciar", "A-DAT-46")

  const conAporte = movAud("d2", {
    proveedor_nombre: "AGRICOLA HERMANOS CATTANEO",
    comprobantes_pagados: "FC - 236",
    detalle: "Factura 1-236 - AGRICOLA HERMANOS CATTANEO | Anticipo $712.560,9 (28/2/2026)",
  })
  chequear("Audit", "Repite pero el anticipo SÍ aporta → se RECORTA, no se vacía",
    "recortar", String(destinoDelDetalle(conAporte)),
    destinoDelDetalle(conAporte) === "recortar", "A-DAT-46")

  // 🔴 El caso que un vaciado masivo destruiría: el comprobante está VACÍO y el detalle guarda
  //    las 6 facturas de Alcorta. Es el único lugar donde ese dato existe.
  const enLaColumnaEquivocada = movAud("d3", {
    proveedor_nombre: "ALCORTA EDMUNDO ERNESTO",
    comprobantes_pagados: null,
    detalle: "Factura 1-5943 - ALCORTA EDMUNDO ERNESTO · Factura 1-5930 - ALCORTA EDMUNDO ERNESTO",
  })
  chequear("Audit", "🔴 El comprobante está vacío y el detalle lo guarda → se MUEVE, no se borra",
    "mover", String(destinoDelDetalle(enLaColumnaEquivocada)),
    destinoDelDetalle(enLaColumnaEquivocada) === "mover", "A-DAT-46")

  const detallePropio = movAud("d4", { proveedor_nombre: "Ruben Sigot", detalle: "Santander | Galicia" })
  chequear("Audit", "Un detalle que NO repite nada no se toca",
    "sin hallazgo", String(destinoDelDetalle(detallePropio)),
    destinoDelDetalle(detallePropio) === null, "A-DAT-46")

  // ── El alcance: a un PENDIENTE no se le exige nada ────────────────────────────────────────
  // Es la decisión que evita 822 falsos positivos sobre 1.498 filas.
  const soloPendientes = auditar({
    movimientos: [movAud("p1", { estado: "pendiente", proveedor_nombre: null, comprobantes_pagados: null, categ: "INVENTADA" })],
    categsDelPlan: PLAN,
  })
  chequear("Audit", "🔑 A un movimiento PENDIENTE no se le exige el estándar",
    "0 hallazgos · 0 auditados", `${soloPendientes.grupos.length} hallazgos · ${soloPendientes.auditados} auditados`,
    soloPendientes.grupos.length === 0 && soloPendientes.auditados === 0 && soloPendientes.universo === 1,
    "A-FEAT-145")

  // ── La imputación, que es donde estaban las dos falsas alarmas ────────────────────────────
  const arcaSinNro = movAud("i1", { comprobante_arca_id: "f1" })
  const tplConNro = movAud("i2", { template_cuota_id: "c1", nro_cuenta: "1.1.1" })
  const tplSinNro = movAud("i3", { template_cuota_id: "c2" })
  const impu = auditar({ movimientos: [arcaSinNro, tplConNro, tplSinNro], categsDelPlan: PLAN })
  const gImp = impu.grupos.find(g => g.control === "imputacion")
  chequear("Audit", "🚩 Sólo ARCA lleva número de cuenta: el template SIN número está BIEN",
    "2 casos (ARCA sin, template con)", `${gImp?.total ?? 0} casos`,
    gImp?.total === 2, "A-DAT-45")

  // ── Agrupar por CAUSA: 152 movimientos son 18 altas, no 152 arreglos ──────────────────────
  const mismaCateg = ["c1", "c2", "c3"].map(id => movAud(id, { categ: "Sueldos", sueldo_pago_id: "s" }))
  const agrup = auditar({ movimientos: mismaCateg, categsDelPlan: PLAN })
  const gCateg = agrup.grupos.find(g => g.control === "categ-fuera-plan")
  chequear("Audit", "📌 3 movimientos con la MISMA categoría faltante = 1 sola causa",
    "3 movimientos · 1 causa", `${gCateg?.total} movimientos · ${gCateg?.causas.length} causa`,
    gCateg?.total === 3 && gCateg?.causas.length === 1, "A-FEAT-145")

  // ── Lo que no se pudo verificar se DICE, no se descarta en silencio ───────────────────────
  const sinCuotas = auditar({ movimientos: [movAud("z", { template_cuota_id: "c" })], categsDelPlan: PLAN })
  // Se pregunta por EL aviso que interesa, no por cuántos hay: contar el total hace que el caso
  // se rompa cada vez que se agrega un control, sin que nada esté mal.
  chequear("Audit", "⚠️ Sin las cuotas cargadas, la cuadratura se informa como NO verificada",
    "avisa", sinCuotas.noVerificado.some(n => n.includes("Cuadratura")) ? "avisa" : "no avisa",
    sinCuotas.noVerificado.some(n => n.includes("Cuadratura")), "A-FEAT-145")

  const cuadra = auditar({
    movimientos: [movAud("q", { template_cuota_id: "c", debitos: 1042045.82 })],
    categsDelPlan: PLAN,
    cuadratura: [{ movimientoId: "q", importeBanco: 1042045.82, importeOrigen: 60178.94 }],
  })
  chequear("Audit", "🧮 El pago agrupado contra UNA cuota: el banco no cuadra con el origen",
    "1 hallazgo de cuadratura", `${cuadra.grupos.find(g => g.control === "cuadratura")?.total ?? 0} hallazgo de cuadratura`,
    cuadra.grupos.find(g => g.control === "cuadratura")?.total === 1, "A-FEAT-142")

  // ── El hueco que está en el ORIGEN, no en el movimiento ───────────────────────────────────
  const tplSinProv = auditar({
    movimientos: [movAud("o", { template_cuota_id: "c", proveedor_nombre: null })],
    categsDelPlan: PLAN,
  })
  const gProv = tplSinProv.grupos.find(g => g.control === "sin-proveedor")
  chequear("Audit", "🔑 Un template sin proveedor se arregla en el TEMPLATE, no en el movimiento",
    "marcado en el origen", gProv?.enElOrigen === 1 ? "marcado en el origen" : "mandado a corregir el extracto",
    gProv?.enElOrigen === 1, "A-DAT-41")

  // ── El más grave: el estado dice conciliado y no hay obligación del otro lado ──────────────
  const huerfano = auditar({
    movimientos: [movAud("h", { proveedor_nombre: null, comprobantes_pagados: null })],
    categsDelPlan: PLAN,
  })
  chequear("Audit", "🔴 Conciliado sin ningún vínculo: el estado miente",
    "1 sin vínculo", `${huerfano.grupos.find(g => g.control === "sin-vinculo")?.total ?? 0} sin vínculo`,
    huerfano.grupos.find(g => g.control === "sin-vinculo")?.total === 1, "A-DAT-43")

  // Un comprobante sin número ni período no identifica CUÁL obligación — es el caso
  // "Haberes" a secas que el usuario marcó con una nota desde la app.
  chequear("Audit", "«Haberes» a secas no identifica cuál obligación; «Haberes May 2026» sí",
    "no · sí",
    `${comprobanteIdentifica("Haberes") ? "sí" : "no"} · ${comprobanteIdentifica("Haberes May 2026") ? "sí" : "no"}`,
    !comprobanteIdentifica("Haberes") && comprobanteIdentifica("Haberes May 2026"), "A-BUG-171")

  // ── 🕳️ LOS CONTROLES DEL ORIGEN (A-BUG-172) ───────────────────────────────────────────────
  // El audit nacio caminando el extracto y midio 8 donde habia 141: las facturas cuyo movimiento
  // todavia no esta conciliado no las delata ninguna linea del banco.
  const origenes: EntidadOrigen[] = [
    { tipo: "template", id: "t1", nombre: "Debitos / Creditos", nombre_quien_cobra: null,
      proveedor: "Banco Galicia", movimientosQueDependen: 46 },
    { tipo: "template", id: "t2", nombre: "Otros Gastos", nombre_quien_cobra: null,
      proveedor: null, movimientosQueDependen: 2 },
    { tipo: "factura", id: "f1", nombre: "GROSCAN — 43-10707",
      cuenta_contable: "COMBUSTIBLES Y LUBRICANTES", nro_cuenta: null },
    { tipo: "factura", id: "f2", nombre: "GOROSITO — 3-4230", cuenta_contable: null, nro_cuenta: null },
    { tipo: "factura", id: "f3", nombre: "OK — 1-1", cuenta_contable: "LUZ", nro_cuenta: "422118" },
  ]
  const conOrigen = auditar({ movimientos: [], categsDelPlan: PLAN, origenes })

  // 🔑 El template que tiene el dato en `proveedor` y no en `nombre_quien_cobra` NO es un hueco:
  //    el dato esta, solo que en la otra columna. Son los 125 movimientos de Banco Galicia.
  chequear("Audit", "🔑 Un template con el proveedor cargado (aunque sea en la otra columna) no es hueco",
    "1 template sin quien cobra",
    `${conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")?.total ?? 0} template sin quien cobra`,
    conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")?.total === 1,
    "A-BUG-172")

  chequear("Audit", "🕳️ La factura con el NOMBRE de la cuenta y sin numero se cuenta aparte",
    "1 · 1",
    `${conOrigen.grupos.find(g => g.control === "origen-factura-sin-numero")?.total ?? 0} · ${conOrigen.grupos.find(g => g.control === "origen-factura-sin-cuenta")?.total ?? 0}`,
    conOrigen.grupos.find(g => g.control === "origen-factura-sin-numero")?.total === 1
      && conOrigen.grupos.find(g => g.control === "origen-factura-sin-cuenta")?.total === 1,
    "A-DAT-48")

  // El trabajo se ordena por impacto: 46 movimientos dependen de UNA fila de template.
  const hOrigen = conOrigen.grupos.find(g => g.control === "origen-template-sin-quien-cobra")
  chequear("Audit", "El hallazgo del origen dice cuantos movimientos dependen de esa fila",
    "2", String(hOrigen?.causas[0]?.ejemplos[0]?.dependen ?? 0),
    hOrigen?.causas[0]?.ejemplos[0]?.dependen === 2, "A-BUG-172")

  // ⚠️ Y si no se cargan los origenes NO se dan por buenos: se informa que no se verificaron.
  const sinOrigenes = auditar({ movimientos: [], categsDelPlan: PLAN })
  chequear("Audit", "⚠️ Sin las filas de origen, los controles del origen se informan NO verificados",
    "avisa", sinOrigenes.noVerificado.some(n => n.includes("ORIGEN")) ? "avisa" : "los da por buenos",
    sinOrigenes.noVerificado.some(n => n.includes("ORIGEN")), "A-BUG-172")

  // 🧨 Los hallazgos del ORIGEN no son movimientos: contarlos como tales daba «-18 de 676 cumplen».
  const mixto = auditar({
    movimientos: [movAud("lim", { template_cuota_id: "c", comprobantes_pagados: "FC - 9" })],
    categsDelPlan: PLAN,
    origenes: [{ tipo: "factura", id: "fx", nombre: "X", cuenta_contable: null, nro_cuenta: null }],
  })
  chequear("Audit", "🧨 Un hallazgo del ORIGEN no descuenta movimientos limpios",
    "1 limpio de 1", `${mixto.limpios} limpio de ${mixto.auditados}`,
    mixto.limpios === 1 && mixto.auditados === 1, "A-BUG-172")

  // ══ 📄 EL CUADRO 1 DEL DETALLE DE PAGO (A-BUG-173) ═══════════════════════════════════════════
  // Los datos son el pago REAL a Alcorta del 10/09/2026, que esta frenado por este bug.
  const ALCORTA_DP = "ALCORTA EDMUNDO ERNESTO"
  const itemsAlcorta = [
    { comprobante: "FC 6347 - ALCORTA EDMUNDO ERNESTO | FC 6328 - ALCORTA EDMUNDO ERNESTO | FC 6337 - ALCORTA EDMUNDO ERNESTO",
      fecha: "10/09/2026", imp_total: 385093.90, descuento_aplicado: 19254.70,
      facturas: [
        { comprobante: "FC 6347 - ALCORTA EDMUNDO ERNESTO", imp_total: 179325.15, descuento_aplicado: 19254.70 },
        { comprobante: "FC 6328 - ALCORTA EDMUNDO ERNESTO", imp_total: 102884.37 },
        { comprobante: "FC 6337 - ALCORTA EDMUNDO ERNESTO", imp_total: 102884.38 },
      ] },
    { comprobante: "FC 2752 - ALCORTA EDMUNDO ERNESTO", fecha: "15/09/2026", imp_total: 1690975.00 },
  ]
  const lineasAlc = lineasDelDetalle(itemsAlcorta, ALCORTA_DP)

  chequear("Detalle de pago", "📄 El grupo de 3 facturas se abre en 3 lineas (antes era 1 sola)",
    "4 lineas", `${lineasAlc.length} lineas`, lineasAlc.length === 4, "A-BUG-173")

  chequear("Detalle de pago", "🏷️ No repite el proveedor: ya esta en el encabezado",
    "FC 6347", lineasAlc[0].comprobante, lineasAlc[0].comprobante === "FC 6347", "A-BUG-173")

  // El descuento SI viaja por factura: es lineal y es condicion comercial de ese comprobante.
  chequear("Detalle de pago", "⚖️ El descuento queda en SU factura, no repartido",
    "19254.7 en la 6347 · 0 en la 6328",
    `${lineasAlc[0].descuento} en la 6347 · ${lineasAlc[1].descuento} en la 6328`,
    lineasAlc[0].descuento === 19254.70 && lineasAlc[1].descuento === 0, "A-BUG-173")

  // 🛑 INTEGRIDAD: las lineas suman el total que el propio comprobante imprime.
  const okAlc = controlarDetalle(lineasAlc,
    { bruto: 2076068.90, descuento: 19254.70, pagado: 2027297.27, retencion: 29516.93 })
  chequear("Detalle de pago", "🧮 El pago real de Alcorta cierra: 4 lineas = $2.076.068,90",
    "sin errores, se emite", `${okAlc.errores.length} errores, ${okAlc.puedeEmitirse ? "se emite" : "NO se emite"}`,
    okAlc.errores.length === 0 && okAlc.puedeEmitirse === true, "A-BUG-173")

  // 🛑 Si al desagregar se pierde plata, el documento se contradice: FRENA.
  const rotas = lineasDelDetalle([{ ...itemsAlcorta[0], facturas: itemsAlcorta[0].facturas!.slice(0, 2) }], ALCORTA_DP)
  const mal = controlarDetalle(rotas, { bruto: 385093.90, descuento: 19254.70, pagado: 0, retencion: 0 })
  chequear("Detalle de pago", "🛑 INTEGRIDAD: si las lineas no suman su propio total, NO se emite",
    "NO se emite", mal.puedeEmitirse ? "se emite igual" : "NO se emite",
    mal.puedeEmitirse === false && mal.errores.length > 0, "A-BUG-173")

  // ⚠️ Pero un pago PARCIAL no es un bug: el usuario puede pagar de menos. Avisa y deja seguir.
  //    «me debe advertir si no da el control, pero es posible que yo tenga que pagar mas o menos»
  const parcial = controlarDetalle(lineasAlc,
    { bruto: 2076068.90, descuento: 19254.70, pagado: 1000000, retencion: 0 })
  chequear("Detalle de pago", "⚠️ Un pago PARCIAL avisa pero NO frena (lo decide el usuario)",
    "avisa y se emite",
    `${parcial.avisos.length > 0 ? "avisa" : "no avisa"} y ${parcial.puedeEmitirse ? "se emite" : "NO se emite"}`,
    parcial.avisos.length === 1 && parcial.puedeEmitirse === true, "A-BUG-173")

  chequear("Detalle de pago", "⚠️ Pagar de MAS tambien avisa sin frenar",
    "avisa y se emite",
    (() => { const r = controlarDetalle(lineasAlc, { bruto: 2076068.90, descuento: 19254.70, pagado: 3000000, retencion: 0 })
             return `${r.avisos.length > 0 ? "avisa" : "no avisa"} y ${r.puedeEmitirse ? "se emite" : "NO se emite"}` })(),
    controlarDetalle(lineasAlc, { bruto: 2076068.90, descuento: 19254.70, pagado: 3000000, retencion: 0 }).puedeEmitirse === true,
    "A-BUG-173")

  // Si sacar el proveedor dejaria el renglon vacio, se devuelve entero: perderlo es peor que repetir.
  chequear("Detalle de pago", "Si al sacar el proveedor no queda nada, se deja la etiqueta entera",
    ALCORTA_DP, sinElProveedor(ALCORTA_DP, ALCORTA_DP), sinElProveedor(ALCORTA_DP, ALCORTA_DP) === ALCORTA_DP, "A-BUG-173")

  // Una factura suelta (sin grupo) sigue funcionando igual: los otros llamadores no se tocan.
  chequear("Detalle de pago", "Una factura suelta sin grupo sigue dando 1 linea",
    "1 · FC 2752", `${lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP).length} · ${lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP)[0].comprobante}`,
    lineasDelDetalle([itemsAlcorta[1]], ALCORTA_DP)[0].comprobante === "FC 2752", "A-BUG-173")

  // 🐞 Las del grupo se leen crudas de la base (ISO) y la suelta llega formateada: misma columna,
  //    dos formatos. Lo vio el usuario en el PDF de Alcorta.
  const fechasMixtas = lineasDelDetalle([
    { comprobante: "FC 6337", imp_total: 100, facturas: [{ comprobante: "FC 6337", fecha: "2026-08-28", imp_total: 100 }] },
    { comprobante: "FC 2752", fecha: "15/09/2026", imp_total: 200 },
  ], ALCORTA_DP)
  chequear("Detalle de pago", "🐞 Las fechas salen todas en dd/mm/aaaa, vengan de donde vengan",
    "28/08/2026 · 15/09/2026", `${fechasMixtas[0].fecha} · ${fechasMixtas[1].fecha}`,
    fechasMixtas[0].fecha === "28/08/2026" && fechasMixtas[1].fecha === "15/09/2026", "A-BUG-173")

  // ══ 🧲 LO QUE EL MOVIMIENTO HEREDA DEL ORIGEN (A-BUG-175) ════════════════════════════════════
  // Caso real del lote 19-30/06: un impuesto al debito NO trae CUIT en el extracto, asi que el
  // proveedor quedaba vacio aunque el template dijera Banco Galicia.
  const tplBanco = { nombre_referencia: "Debitos / Creditos", responsable: "MSA",
                     nombre_quien_cobra: null, proveedor: "Banco Galicia", centro_costo: null }

  const h1 = heredarDelOrigen({}, tplBanco, "Debitos / Creditos MSA - Junio 2026", null)
  chequear("Herencia del origen", "🧲 El impuesto al debito hereda el proveedor DEL TEMPLATE",
    "Banco Galicia", String(h1.proveedor_nombre), h1.proveedor_nombre === "Banco Galicia", "A-BUG-175")
  chequear("Herencia del origen", "🧾 Y el comprobante con su periodo",
    "Debitos / Creditos MSA - Junio 2026", String(h1.comprobantes_pagados),
    h1.comprobantes_pagados === "Debitos / Creditos MSA - Junio 2026", "A-BUG-175")

  // 🔑 La precedencia que fijo el usuario: el ORIGEN le gana al banco.
  const h2 = heredarDelOrigen({}, tplBanco, null, "OTRO QUE INFORMA EL BANCO")
  chequear("Herencia del origen", "🔑 Si el template tiene proveedor, ese entra — no el del banco",
    "Banco Galicia", String(h2.proveedor_nombre),
    h2.proveedor_nombre === "Banco Galicia" && h2.proveedorVieneDelBanco === false, "A-BUG-175")

  // Recien si el origen no tiene nada, se usa el del banco -- y queda marcado para poder preguntar.
  const h3 = heredarDelOrigen({}, { nombre_referencia: "X", responsable: "MSA" }, null, "PROVEEDOR DEL BANCO")
  chequear("Herencia del origen", "🏦 Sin dato en el origen se usa el del banco, y se MARCA",
    "PROVEEDOR DEL BANCO · marcado", `${h3.proveedor_nombre} · ${h3.proveedorVieneDelBanco ? "marcado" : "sin marcar"}`,
    h3.proveedor_nombre === "PROVEEDOR DEL BANCO" && h3.proveedorVieneDelBanco === true, "A-BUG-175")

  // ⚠️ Lo que el usuario escribio a mano NUNCA se pisa.
  const h4 = heredarDelOrigen({ proveedor_nombre: "LO QUE PUSE YO", comprobantes_pagados: "MI COMPROBANTE" },
    tplBanco, "Debitos / Creditos MSA - Junio 2026", "DEL BANCO")
  chequear("Herencia del origen", "⚠️ Lo escrito a mano nunca se pisa",
    "LO QUE PUSE YO · MI COMPROBANTE", `${h4.proveedor_nombre} · ${h4.comprobantes_pagados}`,
    h4.proveedor_nombre === "LO QUE PUSE YO" && h4.comprobantes_pagados === "MI COMPROBANTE", "A-BUG-175")

  // 📛 nombre_quien_cobra y proveedor son LO MISMO; gana la completa (proveedor esta truncado a 30).
  chequear("Herencia del origen", "📛 Gana `nombre_quien_cobra`: `proveedor` viene truncado a 30",
    "Consorcio De Propietarios Posadas",
    String(proveedorDelTemplate({ nombre_quien_cobra: "Consorcio De Propietarios Posadas",
                                  proveedor: "Consorcio De Propietarios Posa" })),
    proveedorDelTemplate({ nombre_quien_cobra: "Consorcio De Propietarios Posadas",
                           proveedor: "Consorcio De Propietarios Posa" }) === "Consorcio De Propietarios Posadas",
    "A-BUG-175")

  // 🏷️ El centro de costo tambien baja del template (A-FEAT-153).
  const h5 = heredarDelOrigen({}, { ...tplBanco, centro_costo: "Estructura" }, null, null)
  chequear("Herencia del origen", "🏷️ El centro de costo tambien se hereda del template",
    "Estructura", String(h5.centro_de_costo), h5.centro_de_costo === "Estructura", "A-FEAT-153")

  return r
}
