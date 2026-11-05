/**
 * ⚖️ LOS KILOS POR CABEZA AL CIERRE — de las pesadas, no de una constante (A-FEAT-1187).
 *
 * Pedido del usuario 2026-09-29, en las notas del papel devuelto:
 * - *«tomar de la app. Última pesada más propagar el aumento promedio de la categoría hasta el 30/6»*
 * - *«poner dato de pesada si hay, sino poner que no hay dato de pesada»* (toros)
 * - *«poner datos si hay, sino poner estimado de 500 kg»* (vaca de descarte)
 *
 * O sea: **el kilo deja de ser un número escrito a mano en el criterio** y pasa a salir de
 * `productivo.pesadas_terneros`. Es la § 🎚️ de `CLAUDE.md` aplicada al peso: el dato real manda,
 * y donde no hay, **se dice que no hay** en vez de inventar uno.
 *
 * ## 🚨 Y acá apareció algo que hay que mirar: la ganancia MEDIDA es un tercio de la CONFIGURADA
 *
 * Medido el 2026-09-29 sobre las 870 pesadas:
 *
 * | Categoría | Configurada en `stock_lotes` | Medida entre pesadas |
 * |---|---:|---:|
 * | Ternero Recría | 1,100 | **0,321** |
 * | Ternera Recría | 1,000 – 1,100 | **0,285** |
 * | Torito | 1,000 | **0,436** |
 *
 * 🔑 **No es un detalle: cambia la valuación.** De la última pesada (04/05) al cierre (30/06) hay
 * **57 días** — con la medida son **+16 kg** y con la configurada **+63 kg**. Sobre 183 animales,
 * la diferencia es plata de verdad.
 *
 * 📌 **Se usa la MEDIDA** —es el dato real, y él pidió *«el aumento promedio de la categoría»*— y
 * **se informa la configurada al lado**, para que la diferencia se vea y él decida. Elegir una en
 * silencio sería justo lo que la § 🧮 prohíbe.
 */

/** Una pesada, ya reducida a lo que importa. */
export interface PesadaAnimal {
  categoria: string
  animalId: string
  fecha: string
  pesoKg: number
  /** La caravana, para que el detalle se pueda buscar en el campo. */
  caravana?: string | null
}

/** ⚖️ A-FEAT-1541 (JMS 05/11: «no está el detalle de cómo se calcularon los kg»): un animal, cómo se llegó a su peso al cierre. */
export interface PesoDeAnimal {
  animalId: string
  caravana: string | null
  antes: { fecha: string; kg: number }
  despues: { fecha: string; kg: number } | null
  kgAlCierre: number
  metodo: "interpolado" | "ganancia medida" | "última pesada"
}

export interface PesoCategoria {
  categoria: string
  /** Cuántos animales tienen al menos una pesada hasta el cierre. */
  animales: number
  /** Promedio de la ÚLTIMA pesada de cada animal. */
  pesoUltimaPesada: number
  /** La más reciente de esas últimas pesadas. Es desde donde se proyecta. */
  fechaUltimaPesada: string
  /** Ganancia diaria calculada entre pesadas consecutivas. `null` si no hay dos pesadas. */
  gananciaMedida: number | null
  /** La que está cargada en el sistema, para poder comparar. */
  gananciaConfigurada: number | null
  diasHastaCierre: number
  /** `pesoUltimaPesada + ganancia × días`. Si no hay ganancia, es el peso sin proyectar. */
  pesoProyectado: number
  /** De dónde salió, en palabras, para que el papel se pueda auditar. */
  origen: string
  /** true si medida y configurada difieren más de lo tolerable: hay que mirarlo. */
  difiereDeLaConfigurada: boolean
  /** ⚖️ A-FEAT-1541: animal por animal (el promedio de `kgAlCierre` es `pesoProyectado`). */
  detalle?: PesoDeAnimal[]
}

/**
 * A partir de qué diferencia relativa se avisa. 25 % es holgado a propósito: la ganancia real
 * fluctúa con el pasto y el clima, así que avisar por poco convertiría el aviso en ruido.
 */
export const TOLERANCIA_GANANCIA = 0.25

const dias = (desde: string, hasta: string) =>
  Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000)

const redondear = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d

/**
 * Arma el peso por categoría al cierre.
 *
 * @param pesadas             todas las pesadas: las de hasta el cierre y, si hay, las de después (para interpolar)
 * @param configuradas        ganancia diaria cargada, por categoría (de `stock_lotes`)
 * @param fechaCierre         `YYYY-MM-DD`
 */
export function pesosAlCierre(
  pesadas: PesadaAnimal[],
  configuradas: Record<string, number>,
  fechaCierre: string,
): PesoCategoria[] {
  const porCategoria = new Map<string, PesadaAnimal[]>()
  /**
   * ⚖️ A-FEAT-1541 (JMS 05/11, en el Excel: *«¿usaste alguna pesada posterior al 30/6? Teniéndola se sabe cuánto tenían al 30/6…
   * es mejor estimador peso antes, peso después, que peso antes y estimo cuánto siguieron ganando cuando el dato ya está»*): la
   * primera pesada de cada animal DESPUÉS del cierre (hasta 120 días), para interpolar.
   */
  const despues = new Map<string, PesadaAnimal>()
  for (const p of pesadas) {
    if (p.fecha > fechaCierre) {
      if (dias(fechaCierre, p.fecha) > 120) continue
      const ya = despues.get(p.animalId)
      if (!ya || p.fecha < ya.fecha) despues.set(p.animalId, p)
      continue
    }
    porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p])
  }

  const out: PesoCategoria[] = []
  for (const [categoria, lista] of porCategoria) {
    // La ÚLTIMA pesada de cada animal: promediar todas las pesadas mezclaría el peso de febrero
    // con el de mayo y daría un animal que no existe.
    const ultimaPorAnimal = new Map<string, PesadaAnimal>()
    for (const p of lista) {
      const actual = ultimaPorAnimal.get(p.animalId)
      if (!actual || p.fecha > actual.fecha) ultimaPorAnimal.set(p.animalId, p)
    }
    const ultimas = [...ultimaPorAnimal.values()]
    if (ultimas.length === 0) continue

    const pesoUltimaPesada = redondear(
      ultimas.reduce((s, p) => s + p.pesoKg, 0) / ultimas.length, 1,
    )
    const fechaUltimaPesada = ultimas.map(p => p.fecha).sort().at(-1)!

    // La ganancia medida: promedio de (Δpeso / Δdías) entre pesadas consecutivas del MISMO animal.
    // Entre animales distintos la resta no significa nada.
    const porAnimal = new Map<string, PesadaAnimal[]>()
    for (const p of lista) porAnimal.set(p.animalId, [...(porAnimal.get(p.animalId) ?? []), p])
    const tramos: number[] = []
    for (const ps of porAnimal.values()) {
      const orden = [...ps].sort((a, b) => a.fecha.localeCompare(b.fecha))
      for (let i = 1; i < orden.length; i++) {
        const d = dias(orden[i - 1].fecha, orden[i].fecha)
        if (d > 0) tramos.push((orden[i].pesoKg - orden[i - 1].pesoKg) / d)
      }
    }
    const gananciaMedida = tramos.length > 0
      ? redondear(tramos.reduce((a, b) => a + b, 0) / tramos.length, 3)
      : null

    const gananciaConfigurada = configuradas[categoria] ?? null
    const d = Math.max(0, dias(fechaUltimaPesada, fechaCierre))
    // ⚖️ Animal por animal: con pesada antes y después del cierre, se INTERPOLA; si no hay después, se proyecta con la medida.
    let interpolados = 0
    const fechasDespues = new Set<string>()
    const detalle: PesoDeAnimal[] = ultimas.map(p => {
      const q = despues.get(p.animalId)
      const dAntes = dias(p.fecha, fechaCierre), dTotal = q ? dias(p.fecha, q.fecha) : 0
      const base = { animalId: p.animalId, caravana: p.caravana ?? q?.caravana ?? null, antes: { fecha: p.fecha, kg: p.pesoKg } }
      if (q && dTotal > 0) {
        interpolados++; fechasDespues.add(q.fecha)
        return { ...base, despues: { fecha: q.fecha, kg: q.pesoKg }, kgAlCierre: redondear(p.pesoKg + (q.pesoKg - p.pesoKg) * dAntes / dTotal, 2), metodo: "interpolado" as const }
      }
      return gananciaMedida != null
        ? { ...base, despues: null, kgAlCierre: redondear(p.pesoKg + gananciaMedida * dAntes, 2), metodo: "ganancia medida" as const }
        : { ...base, despues: null, kgAlCierre: p.pesoKg, metodo: "última pesada" as const }
    })
    const alCierre = detalle.map(x => x.kgAlCierre)
    const pesoProyectado = redondear(alCierre.reduce((s, x) => s + x, 0) / alCierre.length, 1)

    const difiere = gananciaMedida != null && gananciaConfigurada != null &&
      gananciaConfigurada > 0 &&
      Math.abs(gananciaMedida - gananciaConfigurada) / gananciaConfigurada > TOLERANCIA_GANANCIA

    const ddmm = (f: string) => f.slice(0, 10).split("-").reverse().join("/")
    const origen = interpolados > 0
      ? `${interpolados} de ${ultimas.length} animal(es) interpolados entre la pesada del ${ddmm(fechaUltimaPesada)} (${pesoUltimaPesada} kg) y la del ${[...fechasDespues].sort().map(ddmm).join(", ")}` +
        (interpolados < ultimas.length ? ` · el resto con la ganancia medida (${gananciaMedida} kg/día)` : "")
      : gananciaMedida != null
      ? `${ultimas.length} pesada(s) al ${fechaUltimaPesada} · ${pesoUltimaPesada} kg + ${gananciaMedida} kg/día × ${d} días`
      : `${ultimas.length} pesada(s) al ${fechaUltimaPesada} · ${pesoUltimaPesada} kg (sin segunda pesada: no se proyecta)`

    out.push({
      categoria, animales: ultimas.length, pesoUltimaPesada, fechaUltimaPesada,
      gananciaMedida, gananciaConfigurada, diasHastaCierre: d, pesoProyectado,
      origen: difiere
        ? `${origen} ⚠️ la ganancia cargada es ${gananciaConfigurada} kg/día`
        : origen,
      difiereDeLaConfigurada: difiere,
      detalle: detalle.sort((a, b) => (a.caravana ?? a.animalId).localeCompare(b.caravana ?? b.animalId)),
    })
  }
  return out.sort((a, b) => b.animales - a.animales)
}

/**
 * El peso que va a la valuación de una categoría.
 *
 * 🔑 **Las tres salidas son las tres que pidió el usuario**, y la diferencia entre la segunda y la
 * tercera es la que importa: *«sino poner que no hay dato»* (toros) no es lo mismo que *«sino
 * poner estimado de 500 kg»* (vaca de descarte). **Un estimado declarado sirve; un cero
 * silencioso, no.**
 */
/**
 * ⚖️ A-FEAT-1541 (JMS 05/11: «les podemos poner el mismo peso que sus compañeros, 20 % más, si no se tienen datos»): una categoría
 * sin pesada toma el peso de la categoría con la que se crió, por un factor. Los toritos van con los novillitos (Ternero Recría).
 */
export const PESO_DE_COMPANEROS: Record<string, { categoria: string; factor: number }> = {
  Torito: { categoria: "Ternero Recria", factor: 1.2 },
}

export function pesoParaValuar(
  categoria: string,
  pesos: PesoCategoria[],
  fallbackKg: number | null | undefined,
): { kg: number | null; origen: string } {
  const medido = pesos.find(p => p.categoria === categoria)
  if (medido) return { kg: medido.pesoProyectado, origen: medido.origen }
  const comp = PESO_DE_COMPANEROS[categoria]
  const deComp = comp ? pesos.find(p => p.categoria === comp.categoria) : undefined
  if (comp && deComp) {
    const kg = Math.round(deComp.pesoProyectado * comp.factor * 10) / 10
    return { kg, origen: `${kg} kg = sus compañeros (${comp.categoria}, ${deComp.pesoProyectado} kg) + ${Math.round((comp.factor - 1) * 100)} % — sin pesada propia` }
  }
  if (fallbackKg != null) return { kg: fallbackKg, origen: `estimado de ${fallbackKg} kg — no hay pesadas` }
  return { kg: null, origen: "no hay dato de pesada" }
}
