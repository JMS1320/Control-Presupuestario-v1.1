/**
 * 🔎 Cinta de diagnóstico — A-FEAT-72.
 *
 * ## El problema
 * Una captura de un cartel dice *"Error al guardar"*. El renglón que **resuelve** el bug no se ve:
 * `23503 · violates foreign key constraint "anticipos_proveedores_factura_id_fkey"` — qué tabla, qué
 * operación, qué restricción. Hoy eso se pierde y la nota llega como *"no anda"*.
 *
 * ## Cómo funciona
 * Un anillo de 50 eventos **en memoria**, que se pisa solo y **no se manda a ningún lado** hasta que
 * el usuario deja una nota. No hay que preparar nada: se usa la app, se rompe, `Alt+N`.
 * ⚠️ **No refrescar**: el refresh borra la cinta, que es justo lo que se quiere leer.
 *
 * ## 🔒 LISTA BLANCA — y esto no es negociable
 * No se captura todo para después borrar lo sensible. Esa es la forma que falla: alcanza con que
 * aparezca un dato nuevo que el filtro no conoce para que se filtre, **y nadie se entera**. Acá se
 * hace al revés: **se nombra una por una la información que sí se guarda, y todo lo demás no
 * existe.**
 *
 * | ✅ Se guarda | ❌ NO se toca nunca |
 * |---|---|
 * | Mensaje del error + `archivo:línea` | Encabezados de las llamadas (ahí viajan las llaves) |
 * | Método + **camino** (`POST /anticipos_proveedores`) | El **cuerpo** de la llamada (los datos del formulario) |
 * | Código y mensaje de error de la base | La respuesta de la base cuando trae filas |
 * | Texto de `console.error` / `console.warn` | `console.log` sueltos (ahí se imprime cualquier cosa) |
 * | | **Nada tipeado en un campo** — ahí estaría una clave de ARCA |
 *
 * El caso que fijó la regla, en palabras del usuario: *"clave de ARCA si yo justo la imputé"*. Con
 * lista negra esa clave se guarda salvo que alguien haya previsto ese campo. Con lista blanca **no
 * se guarda nunca**, porque el contenido de los campos no está en la lista.
 *
 * ## Alcance honesto — qué clase de bug resuelve
 * - ✅ Los que **tiran error** (con o sin cartel). Muchos fallan callados y llegan como *"no anda"*.
 * - ❌ Los que **dan mal el número sin fallar** — el Cash Flow de $181 M no tiró nada. Ésos salen de
 *   los datos, no de los logs.
 * - ❌ Las **mejoras**. De las 8 notas al 2026-08-29, ninguna habría usado esto.
 */

/** Un evento de la cinta. Los campos son los de la lista blanca y **no** se agregan otros. */
export interface EventoDiagnostico {
  /** Hora local `HH:MM:SS`, para poder ordenar los pasos de una nota. */
  hora: string
  /** `error` = excepción · `warn` = aviso · `red` = llamada que falló · `db` = error de la base. */
  tipo: "error" | "warn" | "red" | "db"
  /** El mensaje. Nunca el contenido de un campo ni el cuerpo de una llamada. */
  msg: string
  /** `archivo:línea` para las excepciones · `MÉTODO /camino` para las llamadas. */
  donde?: string
  /** Código PostgREST (`23503`) o HTTP (`409`). */
  codigo?: string
}

/** El anillo se pisa solo. 50 alcanza para el error y lo que pasó justo antes, sin engordar la fila. */
const MAX_EVENTOS = 50

/** Recorte por campo: un stack entero o un mensaje kilométrico no aportan y pesan en cada captura. */
const MAX_MSG = 300
const MAX_DONDE = 160

const cinta: EventoDiagnostico[] = []

/** Cuántos eventos ya se llevó una captura anterior — la cinta se **corta**, no se repite. */
let yaEntregados = 0

/** Se instala una sola vez. React monta dos veces en desarrollo (StrictMode) y sin esto se duplica. */
let instalada = false

function hora(): string {
  return new Date().toLocaleTimeString("es-AR", { hour12: false })
}

function recortar(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max)
}

function anotar(e: EventoDiagnostico): void {
  cinta.push(e)
  // `shift()` en un array de 50 no es un problema de performance y deja el código obvio.
  while (cinta.length > MAX_EVENTOS) {
    cinta.shift()
    if (yaEntregados > 0) yaEntregados-- // el corte se corre junto con lo que se descartó
  }
}

/**
 * El archivo, corto. `https://…/_next/static/chunks/app/egresos/page.js` → `app/egresos/page.js`.
 * Se queda con los últimos 3 segmentos: lo que identifica el archivo sin el ruido del bundler.
 */
function archivoCorto(url: string): string {
  try {
    const camino = new URL(url, window.location.origin).pathname
    return camino.split("/").filter(Boolean).slice(-3).join("/")
  } catch {
    return recortar(url, MAX_DONDE)
  }
}

/** La primera línea del stack que apunte a un archivo — sin arrastrar el stack entero. */
function origenDelStack(stack: unknown): string | undefined {
  if (typeof stack !== "string") return undefined
  const linea = stack.split("\n").find(l => /\.[jt]sx?:\d+/.test(l))
  if (!linea) return undefined
  const m = linea.match(/([^\s()]+\.[jt]sx?:\d+(?::\d+)?)/)
  return m ? recortar(archivoCorto(m[1].replace(/:\d+(?::\d+)?$/, "")) + m[1].match(/:\d+(?::\d+)?$/)![0], MAX_DONDE) : undefined
}

/**
 * Un argumento de `console` → texto, **sin serializar objetos**.
 *
 * Éste es el punto donde la lista blanca se gana o se pierde. Un `JSON.stringify` del objeto sería
 * cómodo y es exactamente lo que filtraría el formulario entero (o una clave) el día que alguien
 * loguee el payload. Sólo pasan **strings** y el **mensaje** de un `Error`; cualquier otra cosa se
 * reduce a su tipo.
 */
function argSeguro(a: unknown): string {
  if (typeof a === "string") return a
  if (a instanceof Error) return a.message
  if (a === null) return "[null]"
  if (typeof a === "number" || typeof a === "boolean") return String(a)
  return Array.isArray(a) ? "[array]" : `[${typeof a}]`
}

/** El camino de una llamada, **sin query string**: ahí viajan los filtros, que son datos. */
function caminoDe(input: RequestInfo | URL): string {
  try {
    const crudo = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    return new URL(crudo, window.location.origin).pathname
  } catch {
    return "?"
  }
}

/**
 * Los 4 campos de error de PostgREST, **nombrados uno por uno**.
 *
 * Se lee de un `clone()` para no consumir el stream que la app va a leer después. Y sólo en
 * respuestas de error: ahí el cuerpo es `{code, message, details, hint}`, nunca filas de datos.
 */
async function errorDeLaBase(res: Response): Promise<{ codigo?: string; msg: string } | null> {
  try {
    const txt = await res.clone().text()
    if (!txt) return null
    const j = JSON.parse(txt)
    if (!j || typeof j !== "object") return null
    const partes = [j.message, j.details, j.hint].filter(p => typeof p === "string")
    if (partes.length === 0 && typeof j.code !== "string") return null
    return { codigo: typeof j.code === "string" ? j.code : undefined, msg: partes.join(" · ") }
  } catch {
    return null // cuerpo que no es JSON (un HTML de error, por ejemplo): no se inventa nada
  }
}

/**
 * Engancha las 4 fuentes. Idempotente y a prueba de fallas: si algo de acá tira, **no puede**
 * romper la app — una herramienta de diagnóstico que rompe la pantalla que venís a diagnosticar
 * es peor que no tenerla.
 */
export function instalarCinta(): void {
  if (instalada || typeof window === "undefined") return
  instalada = true

  // 1 · Excepciones sin atrapar.
  window.addEventListener("error", ev => {
    try {
      // Sin `message` es un recurso que no cargó (una imagen, un chunk), no una excepción.
      if (!ev.message) return
      anotar({
        hora: hora(),
        tipo: "error",
        msg: recortar(ev.message, MAX_MSG),
        donde: ev.filename ? recortar(`${archivoCorto(ev.filename)}:${ev.lineno}`, MAX_DONDE) : undefined,
      })
    } catch {}
  })

  // 2 · Promesas rechazadas y nunca atrapadas — el modo de falla más común en esta app,
  //     porque casi todo pasa por `await supabase…`.
  window.addEventListener("unhandledrejection", ev => {
    try {
      const r: any = ev.reason
      anotar({
        hora: hora(),
        tipo: "error",
        msg: recortar(r instanceof Error ? r.message : argSeguro(r), MAX_MSG),
        donde: origenDelStack(r?.stack),
        codigo: typeof r?.code === "string" ? r.code : undefined,
      })
    } catch {}
  })

  // 3 · `console.error` / `console.warn`. `console.log` NO: es donde se imprime cualquier cosa.
  for (const nivel of ["error", "warn"] as const) {
    const original = console[nivel].bind(console)
    console[nivel] = (...args: unknown[]) => {
      try {
        anotar({
          hora: hora(),
          tipo: nivel === "error" ? "error" : "warn",
          msg: recortar(args.map(argSeguro).join(" "), MAX_MSG),
        })
      } catch {}
      original(...args) // la consola sigue funcionando igual que siempre
    }
  }

  // 4 · Llamadas que fallan. Sólo las que fallan: registrar todas llenaría el anillo de ruido
  //     y taparía justo el error que se vino a buscar.
  const fetchOriginal = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const metodo = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    const camino = caminoDe(input)
    try {
      const res = await fetchOriginal(input as any, init)
      if (!res.ok) {
        const db = await errorDeLaBase(res)
        anotar({
          hora: hora(),
          tipo: db ? "db" : "red",
          msg: recortar(db ? db.msg : res.statusText || "falló la llamada", MAX_MSG),
          donde: recortar(`${metodo} ${camino}`, MAX_DONDE),
          codigo: db?.codigo ?? String(res.status),
        })
      }
      return res
    } catch (e) {
      // Se cortó la red o el server no respondió: la llamada nunca llegó a tener status.
      anotar({
        hora: hora(),
        tipo: "red",
        msg: recortar((e as Error)?.message ?? "sin respuesta", MAX_MSG),
        donde: recortar(`${metodo} ${camino}`, MAX_DONDE),
      })
      throw e
    }
  }
}

/** Cuántos eventos nuevos hay desde la captura anterior. Para mostrarlo antes de guardar. */
export function eventosPendientes(): number {
  return cinta.length - yaEntregados
}

/**
 * Los eventos **desde la captura anterior**, SIN consumirlos.
 *
 * Mirar y confirmar están separados a propósito: si el corte se corriera al abrir el modal, cancelar
 * la captura **borraría los eventos** — y el usuario que abre la nota, se arrepiente y la vuelve a
 * abrir perdería justo el error que venía a reportar. Se confirma recién cuando la captura se agrega.
 */
export function mirarCinta(): EventoDiagnostico[] {
  return cinta.slice(yaEntregados)
}

/**
 * Corre el corte, ahora sí: esos `n` eventos ya viajan en una captura guardada.
 *
 * Por captura y no por nota a propósito: una nota son N pasos, y lo que hace falta saber es **en
 * cuál** saltó el error. Si se guardara la cinta entera en cada paso, los 5 pasos dirían lo mismo.
 */
export function confirmarCorte(n: number): void {
  yaEntregados = Math.min(cinta.length, yaEntregados + n)
}

/** Vuelve a cero. Se usa al descartar una nota, para que la próxima no arrastre lo de la anterior. */
export function reiniciarCorte(): void {
  yaEntregados = cinta.length
}
