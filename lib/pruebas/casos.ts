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

  return r
}
