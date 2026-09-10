/**
 * 🧭 EL PADRÓN — lo que DEBERÍA existir, para poder ver lo que falta.
 *
 * ## Por qué existe
 * Enunciado por el usuario (2026-09-09):
 *
 * > *«Desde fuera digo: **¿dónde están las ventas de las vacas CUT?** Desde dentro de la app uno
 * > simplemente ve que hay lotes cargados. ¿Están todos los lotes cargados? **¿Cómo sé cuántos
 * > lotes debería haber?**»*
 *
 * 🔴 **Un inventario no puede avisar de una ausencia.** Una pantalla muestra perfectamente lo que
 * hay —12 lotes, 340 templates— y es incapaz de decir que debería haber 13. Lo que falta no está en
 * ninguna tabla: por definición, **no está**.
 *
 * Hace falta una segunda lista: **el padrón**, lo que tendría que existir. Recién comparando las dos
 * aparece el hueco.
 *
 * ## Que el padrón se DERIVA, no se escribe
 * 🔑 Fue la corrección al primer diseño. Yo había planteado que definir cada padrón era «una
 * conversación de negocio» y que había que tenerla antes de construir. Es menos cierto de lo que
 * parecía: **casi todo es derivable de datos que ya están**. Un template activo que declara 4 cuotas
 * debe tener 4 cargadas. Un empleado activo debe estar proyectado. Una categoría con existencia y
 * sin venta presupuestada es un hueco.
 *
 * Lo que **no** se deriva es si ese hueco es de verdad — y para eso el sistema ya tenía la
 * respuesta: **«pendiente a propósito»**. Entonces el padrón se deriva y el usuario lo corrige, que
 * es la § *Default del dato real, siempre editable* aplicada a las ausencias.
 *
 * ## Lo que este archivo NO hace
 * ⚠️ **No escribe nada, y no sabe escribir.** Un hueco lleva a dónde se resuelve; resolverlo es del
 * módulo dueño. Si el recorrido escribiera la venta por su cuenta, en tres meses habría dos maneras
 * de cargar una venta que validan distinto, y el día que una cambie la otra queda vieja **sin que
 * nadie se entere**. Palabras del usuario: *«no debemos tener que escribir scripts sino vínculos»*.
 */

/** En qué estado está un hueco. Los tres son distintos y se cuentan distinto. */
export type EstadoHueco =
  /** Falta y hay que resolverlo. Es lo que cuenta el marcador. */
  | 'abierto'
  /**
   * Se decidió que no va. **No es un olvido: es una decisión** — *«las vaquillonas no se venden
   * este año, quedan de reposición»*. Descuenta del marcador, pero **vence**: ver `venceEl`.
   */
  | 'a_proposito'
  /**
   * No depende del usuario todavía — un precio que el mercado no publicó, una cuota que ARBA no
   * emitió. **No es error**, y contarlo como tal enseña a ignorar el marcador.
   */
  | 'todavia_no'

export interface Hueco {
  /** `hacienda` · `templates` · `arrendamientos` · … — agrupa el recorrido. */
  dominio: string
  /** Identifica el hueco entre corridas, para poder marcarlo a propósito y que siga marcado. */
  clave: string
  /** Qué falta, en el idioma del usuario. Nombre de campo, de categoría, de empleado. */
  que: string
  /** Por qué el sistema cree que falta. Es lo que permite discutirlo. */
  porque: string
  /**
   * La plata en juego. `null` cuando no se puede estimar — y **`null` no es cero**: un hueco sin
   * monto sigue siendo un hueco, sólo que no se lo puede ordenar por tamaño.
   */
  plata: number | null
  /** Dónde se resuelve. La navegación es del recorrido; la escritura, del módulo dueño. */
  donde: { pantalla: string; detalle?: string }
  estado: EstadoHueco
  /** Si está `a_proposito`: hasta cuándo vale esa decisión. */
  venceEl?: string | null
  /** Lo que dijo el usuario al marcarlo a propósito. Sin el motivo, la marca no se puede auditar. */
  motivo?: string | null
}

/**
 * Un padrón: la lista de lo que debería existir, y lo que efectivamente hay.
 *
 * Se declara **por dominio**, y el dominio se nombra como lo nombraría alguien de afuera — la
 * pregunta, no el módulo: *«¿están todas las ventas de hacienda?»*, no *«stock_ventas»*.
 */
export interface Padron {
  dominio: string
  /** La pregunta, tal como se haría desde afuera de la app. */
  pregunta: string
  huecos: Hueco[]
  /** Cuántos ítems tenía que haber. Sirve para decir «19 de 21», no sólo «faltan 2». */
  esperados: number
}

/**
 * ¿Sigue valiendo una decisión de «pendiente a propósito»?
 *
 * 🔑 **Vence a propósito.** Lo que se marcó en marzo hay que reconfirmarlo en septiembre, o se
 * convierte en un olvido con permiso — que es exactamente lo que el marcador existe para evitar.
 * Sin vencimiento, la primera tanda de marcas apaga el tablero para siempre.
 */
export function vigente(h: Hueco, hoy = new Date()): boolean {
  if (h.estado !== 'a_proposito') return true
  if (!h.venceEl) return false
  return new Date(h.venceEl + 'T23:59:59') >= hoy
}

export interface Marcador {
  /** Los que hay que resolver. **La meta es cero** — no es un porcentaje de avance. */
  abiertos: number
  /** Plata de los abiertos que se pudo estimar. */
  plata: number
  /** Cuántos no se pudieron valorizar: el total de plata es un piso, no la cifra completa. */
  sinValorizar: number
  aProposito: number
  /** Marcados a propósito con la decisión **vencida**: vuelven a contar como abiertos. */
  vencidos: number
  todaviaNo: number
  /** `true` sólo cuando no queda ningún hueco abierto ni vencido. */
  cerrado: boolean
}

/**
 * El marcador.
 *
 * Lo pidió así: *«0 es 0 % de error»*. Y es mejor que un porcentaje de avance por una razón
 * práctica: **«te faltan 7 cosas» se puede accionar; «estás al 82 %» no**.
 *
 * ⚠️ Se devuelven **el conteo y la plata**, no uno de los dos. Un hueco de $180 M y uno de $20.000
 * no son el mismo hueco: contar los trata igual, pesar esconde que faltan siete. **El número grande
 * cuenta, el chico ordena.**
 */
export function marcador(huecos: Hueco[], hoy = new Date()): Marcador {
  const vencidos = huecos.filter(h => h.estado === 'a_proposito' && !vigente(h, hoy))
  const abiertos = huecos.filter(h => h.estado === 'abierto').concat(vencidos)
  const conPlata = abiertos.filter(h => h.plata != null)
  return {
    abiertos: abiertos.length,
    plata: conPlata.reduce((s, h) => s + (h.plata ?? 0), 0),
    sinValorizar: abiertos.length - conPlata.length,
    aProposito: huecos.filter(h => h.estado === 'a_proposito' && vigente(h, hoy)).length,
    vencidos: vencidos.length,
    todaviaNo: huecos.filter(h => h.estado === 'todavia_no').length,
    cerrado: abiertos.length === 0,
  }
}

/**
 * Los huecos ordenados como conviene atacarlos: **primero los que más plata mueven**.
 *
 * Los que no se pudieron valorizar van al final pero **no se esconden**: no valorizar no es lo
 * mismo que valer cero, y mandarlos al fondo con los chicos sería tratarlos como si lo fuera.
 */
export function porPrioridad(huecos: Hueco[], hoy = new Date()): Hueco[] {
  const rango = (h: Hueco) => h.estado === 'abierto' || !vigente(h, hoy) ? 0 : h.estado === 'todavia_no' ? 1 : 2
  return [...huecos].sort((a, b) => {
    const r = rango(a) - rango(b)
    if (r !== 0) return r
    if ((a.plata == null) !== (b.plata == null)) return a.plata == null ? 1 : -1
    return (b.plata ?? 0) - (a.plata ?? 0)
  })
}

// ── Los padrones, uno por dominio ────────────────────────────────────────────────────────────
//
// Cada uno es una función PURA: recibe lo que ya está cargado y devuelve los huecos. Sin base de
// datos adentro, para que se puedan probar con números escritos a mano — que es lo único que
// vuelve confiable a un detector de ausencias.

export interface TemplateEsperado {
  id: string
  nombre: string
  /**
   * Meses del período que quedaron en cero **porque no hay historia de la que proyectar**.
   *
   * ⚠️ NO son todos los meses en cero. Un mes fuera del patrón de pago (el inmobiliario no paga
   * en marzo) y un template marcado «no proyectar» también dan cero, y los dos están bien.
   * Ver `MotivoVacio` en `lib/presupuesto/templates.ts`.
   */
  mesesSinPoderProyectar: number
  /** Cuántos meses tiene el período, para poder decir «12 de 24» y no un número suelto. */
  mesesDelPeriodo: number
  /** Lo que vale un mes típico, si hay con qué estimarlo. Casi siempre `null` acá — ver abajo. */
  montoTipico: number | null
  responsable?: string | null
}

/**
 * Cuántos meses cubre el presupuesto que se está mirando, y cuáles — **A-BUG-133**.
 *
 * Hace falta para poder **decir la ventana en el texto del hueco**. Sin eso el usuario abre
 * Egresos, ve 13 cuotas donde el tablero habla de 2, y desconfía del sistema con toda la razón:
 * los dos números son ciertos y el que falta es el «dónde miro».
 */
export interface Ventana {
  meses: number
  /** `YYYY-MM` del primero y del último. */
  desde: string
  hasta: string
}

/** «sep 26 – ago 28», como lo dice la pantalla. */
export function nombrarVentana(v: Ventana): string {
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const decir = (m: string) => {
    const [a, mm] = m.split('-')
    return `${M[Number(mm) - 1] ?? mm} ${(a ?? '').slice(2)}`
  }
  return `${decir(v.desde)} – ${decir(v.hasta)}`
}

/**
 * 📋 **¿Hay algún gasto que el presupuesto NO PUEDA proyectar?**
 *
 * ## ⚠️ Ésta NO es la pregunta que hacía antes, y el cambio es de fondo
 * Hasta el 2026-09-10 preguntaba *«¿están todas las cuotas cargadas?»* y comparaba las cuotas
 * declaradas del template contra las cargadas en el período. **Estaba mal de raíz**, y lo dice una
 * decisión que ya existía —`MODULO_TEMPLATES.md` § 13, del 2026-08-22— que yo no leí:
 *
 * > *«No generar campañas futuras para alimentar el presupuesto. El presupuesto no las necesita:
 * > proyecta solo los meses sin cuota. Y generarlas tiene un costo real: una cuota estimada de un
 * > año lejano **pisa la proyección** con un estimado peor, y el resto del sistema la lee como
 * > **compromiso firme**. Se genera la campaña en curso; 2027 cuando llegue.»*
 *
 * O sea que **es correcto y deseado que falten cuotas** en los meses lejanos. El padrón viejo
 * empujaba a cargarlas, que es trabajo inútil y además **degrada el presupuesto**.
 *
 * ## Los dos horizontes son dos preguntas, y ésta es una sola de ellas
 * | Horizonte | La pregunta | Quién la hace |
 * |---|---|---|
 * | **Largo** (todo el período) | ¿el presupuesto puede **proyectar** esto? | **este padrón** |
 * | **Corto** (campaña en curso) | ¿voy a **ver venir el vencimiento**? | `avisoFaltaGenerar`, que ya existe y ya se muestra |
 *
 * Mezclarlas fue el error: la consecuencia de la primera es *el presupuesto miente por omisión*;
 * la de la segunda es *se te pasa un pago*. Son distintas y se resuelven distinto.
 *
 * ## Qué cuenta como hueco, entonces
 * Sólo los meses en cero **por falta de historia**. Un mes fuera del patrón de pago y un template
 * marcado «no proyectar» **no son huecos** — el usuario lo dijo en una línea: *«un mes vacío puede
 * ser legítimo»*.
 *
 * 💡 **La plata casi siempre es `null` acá, y es honesto que lo sea**: si no hay historia, no hay
 * de dónde sacar cuánto vale. El tablero ya sabe mostrar los huecos sin valorizar sin contarlos
 * como cero.
 */
export function padronTemplates(templates: TemplateEsperado[], ventana?: Ventana): Padron {
  const donde = ventana ? ` de ${nombrarVentana(ventana)}` : ''
  const huecos: Hueco[] = []
  for (const t of templates) {
    if (t.mesesSinPoderProyectar <= 0) continue
    huecos.push({
      dominio: 'templates',
      clave: `template:${t.id}`,
      que: t.nombre + (t.responsable ? ` (${t.responsable})` : ''),
      porque: `el presupuesto no puede proyectarlo: no hay historia de la que sacar un número, `
        + `y ${t.mesesSinPoderProyectar} de los ${t.mesesDelPeriodo} meses${donde} quedan en cero`,
      plata: t.montoTipico != null ? t.montoTipico * t.mesesSinPoderProyectar : null,
      donde: { pantalla: 'Egresos sin Factura', detalle: t.nombre },
      estado: 'abierto',
    })
  }
  return {
    dominio: 'templates',
    pregunta: '¿Hay algún gasto que el presupuesto no pueda proyectar?',
    huecos, esperados: templates.length,
  }
}

export interface CategoriaHacienda {
  categoria: string
  /** Cabezas que existen hoy. */
  existencia: number
  /** Cabezas ya comprometidas en alguna venta (presupuestada, confirmada o fijada). */
  conVenta: number
  /** $/cabeza de referencia, para estimar la plata. */
  precioPorCabeza: number | null
}

/**
 * 🐄 **¿Están todas las ventas de hacienda?** — el caso que nombró el usuario.
 *
 * El padrón sale de **la existencia**: si hay 340 vacas CUT y ninguna venta presupuestada, eso es
 * un hueco de la plata que valen. No hace falta que nadie declare una política de venta: la
 * pregunta *«¿y éstas?»* se contesta con la existencia, y si la respuesta es *«no se venden»*, eso
 * se marca **a propósito** — con motivo y con vencimiento.
 */
export function padronHacienda(cats: CategoriaHacienda[]): Padron {
  const huecos: Hueco[] = []
  for (const c of cats) {
    const sinVender = c.existencia - c.conVenta
    if (sinVender <= 0) continue
    huecos.push({
      dominio: 'hacienda',
      clave: `hacienda:${c.categoria}`,
      que: `${sinVender} ${c.categoria}`,
      porque: c.conVenta > 0
        ? `existen ${c.existencia} y sólo ${c.conVenta} tienen venta`
        : `existen ${c.existencia} y ninguna tiene venta presupuestada`,
      plata: c.precioPorCabeza != null ? sinVender * c.precioPorCabeza : null,
      donde: { pantalla: 'Presupuesto → hacienda disponible', detalle: c.categoria },
      estado: 'abierto',
    })
  }
  return {
    dominio: 'hacienda',
    pregunta: '¿Están todas las ventas de hacienda?',
    huecos, esperados: cats.length,
  }
}

export interface CuentaEsperada {
  nro: string
  nombre: string
  /** Lo que gastó en el mismo período del año pasado. */
  gastoAnterior: number
  /** Lo que tiene presupuestado ahora. */
  presupuestado: number
  /** El usuario la excluyó a propósito. */
  excluida: boolean
}

/**
 * 💸 **¿Quedó alguna cuenta en cero que el año pasado gastó?**
 *
 * El padrón es **la historia**: una cuenta que gastó $4 M el año pasado y hoy está en cero no
 * necesariamente está mal, pero **hay que haberlo decidido**. Es el hueco más silencioso de todos:
 * no rompe nada, no avisa, y el presupuesto simplemente sale más chico de lo que va a ser.
 *
 * ⚠️ Las excluidas a propósito **no son huecos**: ya se decidió que entran por otro lado.
 */
export function padronCuentas(cuentas: CuentaEsperada[], minimo = 0): Padron {
  const relevantes = cuentas.filter(c => !c.excluida && c.gastoAnterior > minimo)
  const huecos: Hueco[] = []
  for (const c of relevantes) {
    if (c.presupuestado > 0) continue
    huecos.push({
      dominio: 'cuentas',
      clave: `cuenta:${c.nro}`,
      que: `${c.nombre} (${c.nro})`,
      porque: `el año pasado gastó ${Math.round(c.gastoAnterior).toLocaleString('es-AR')} y hoy está en cero`,
      plata: c.gastoAnterior,
      donde: { pantalla: 'Presupuesto → cuentas contables', detalle: c.nro },
      estado: 'abierto',
    })
  }
  return {
    dominio: 'cuentas',
    pregunta: '¿Quedó alguna cuenta en cero que el año pasado gastó?',
    huecos, esperados: relevantes.length,
  }
}

/** Junta todos los padrones en un solo tablero. */
export function tablero(padrones: Padron[], hoy = new Date()) {
  const todos = padrones.flatMap(p => p.huecos)
  return {
    padrones: padrones.map(p => ({ ...p, marcador: marcador(p.huecos, hoy) })),
    huecos: porPrioridad(todos, hoy),
    marcador: marcador(todos, hoy),
  }
}
