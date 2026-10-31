/**
 * 🔁 **EL INICIO DEL BALANCE ANTERIOR CONTRA LO QUE LA APP RECONOCE** — A-FEAT-1427 (2026-10-30).
 *
 * JMS: *«lo que debería decir es saldo del año pasado, saldo de este año, y si hay algo incorrecto lo debe marcar
 * y preguntarme qué quiero hacer… si hay una inconsistencia, el sistema debería notarlo y advertirlo»*.
 *
 * El «saldo del año pasado» de cada papel ya existe: es la **foto del Balance propio** al cierre anterior
 * (`balance_foto_valores`, versión `contador` = lo que presentó). Acá se lee esa foto y se compara contra lo que la
 * app reconoce como ese mismo saldo. No hay un comentario escrito a mano: el control se recalcula cada vez.
 *
 * 🧾 **Primer caso — la provisión del ejercicio anterior.** El contador provisionó **$ 12.456.000,14** al
 * 30/06/2025 (las facturas de PAM 2-31 y de Magdalena 10-269, $ 6.228.000,07 cada una). Llegaron con fecha de
 * ago y oct 2025, así que la regla automática (fecha del ejercicio anterior, subdiario posterior) **no las ve**
 * y entran al gasto 25/26 como cualquier compra: **gasto doble** si nadie lo nota. El control compara lo
 * declarado contra lo reconocido y, si no cierra, **propone los comprobantes del ejercicio que explican la
 * diferencia** (uno, o dos que sumados la dan). Avisa, no frena (§ 🚦): decidir es de JMS.
 */
import type { AsientoLibroDiario } from "./libro-diario"
import type { InicioYCierre } from "./inicio-y-cierre"
import type { HechosCobertura } from "./cobertura-papeles"

/** Un renglón de la foto con sus versiones. `null` = la versión no está cargada. */
export type RenglonFoto = { contador?: number | null; jms?: number | null }
export type FotoInicio = Record<string, RenglonFoto>

/**
 * Lee de la foto del Balance propio al `fechaFoto` los `renglones` pedidos (versiones contador y jms).
 * `foto: null` = esa foto no existe todavía (no es lo mismo que un renglón en cero).
 */
export async function leerFotoInicio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any, empresa: string, fechaFoto: string, renglones: string[],
): Promise<{ foto: FotoInicio | null; error: string | null }> {
  const { data: fs, error: e1 } = await supabase.from("balance_fotos").select("id")
    .eq("empresa", empresa).eq("fecha_cierre", fechaFoto).limit(1)
  if (e1) return { foto: null, error: e1.message }
  const id = fs?.[0]?.id
  if (!id) return { foto: null, error: null }
  const { data: vs, error: e2 } = await supabase.from("balance_foto_valores").select("renglon, version, importe")
    .eq("foto_id", id).in("renglon", renglones)
  if (e2) return { foto: null, error: e2.message }
  const foto: FotoInicio = {}
  for (const v of (vs ?? []) as { renglon: string; version: string; importe: number | null }[]) {
    if (v.version !== "contador" && v.version !== "jms") continue
    foto[v.renglon] = { ...(foto[v.renglon] ?? {}), [v.version]: v.importe == null ? null : Number(v.importe) }
  }
  return { foto, error: null }
}

export type EstadoControlInicio = "cierra" | "no cierra" | "sin foto"

/** Los controles de inicio que viajan al export y a la vista previa. Cada papel suma el suyo. */
export interface ControlesInicio {
  provision?: ControlProvisionAnterior
  /** 📋 Cada renglón del balance con su inicio (foto anterior) y su cierre (la app). */
  inicioYCierre?: InicioYCierre
  /** 🗂️ Hechos chicos que lee la pantalla para la solapa «00 Cobertura». */
  hechos?: HechosCobertura
}

export interface ControlProvisionAnterior {
  /** Lo que el balance anterior dejó provisionado (foto, versión contador; si no, la de JMS). `null` = no hay dato. */
  declarado: number | null
  fuenteDeclarado: string
  /** Lo que la app lista hoy como provisión del ejercicio anterior. */
  reconocido: number
  diferencia: number | null
  estado: EstadoControlInicio
  /**
   * Comprobantes de ESTE ejercicio que explican la diferencia (uno solo, o dos que sumados la dan). Son candidatos:
   * si lo son, ese gasto ya se reconoció el año pasado y no es de este ejercicio.
   */
  candidatos: AsientoLibroDiario[]
  /**
   * Contra qué se encontraron: `diferencia` = marcándolas, cierra; `declarado` = suman lo provisionado ENTERO, así que
   * lo que la app reconoce hoy sobraría (JMS 31/10: PAM 2-31 + Magdalena 10-269 suman el declarado, y la app reconocía
   * otra de $ 56.001,07, con lo que la búsqueda por diferencia no las encontraba).
   */
  candidatosContra?: "diferencia" | "declarado"
  /** Lo que la app reconoce hoy como provisión anterior (para linkearlo). */
  reconocidos?: AsientoLibroDiario[]
}

const r2 = (x: number) => Math.round(x * 100) / 100
const TOLERANCIA = 1

/**
 * 🧮 Declarado (foto) − reconocido (app) = 0. Si no da, busca en las compras del ejercicio la explicación.
 * @param compras las compras de ESTE ejercicio (el gasto que estaría duplicado)
 */
export function controlarProvisionAnterior(
  foto: FotoInicio | null, provisionesAnteriores: AsientoLibroDiario[], compras: AsientoLibroDiario[],
): ControlProvisionAnterior {
  const reconocido = r2(provisionesAnteriores.reduce((s, a) => s + (Number(a.total) || 0), 0))
  const r = foto?.["provision_gastos"]
  const declarado = r?.contador ?? r?.jms ?? null
  const fuenteDeclarado = foto == null ? "no hay foto del balance anterior"
    : r?.contador != null ? "foto del balance anterior, versión contador («Provisión para gastos»)"
    : r?.jms != null ? "foto del balance anterior, versión JMS" : "la foto no tiene el renglón «Provisión para gastos»"
  const reconocidos = provisionesAnteriores
  if (declarado == null) return { declarado: null, fuenteDeclarado, reconocido, diferencia: null, estado: "sin foto", candidatos: [], reconocidos }

  const diferencia = r2(declarado - reconocido)
  if (Math.abs(diferencia) <= TOLERANCIA) return { declarado, fuenteDeclarado, reconocido, diferencia, estado: "cierra", candidatos: [], reconocidos }

  // Candidatos: compras del ejercicio que no están ya en la lista del anterior, que dan el objetivo solas o de a dos.
  const ya = new Set(provisionesAnteriores.map(a => a.id))
  const buscar = (objetivo: number): AsientoLibroDiario[] => {
    if (objetivo <= TOLERANCIA) return []
    const pool = compras.filter(a => !ya.has(a.id) && Number(a.total) > 0 && Number(a.total) <= objetivo + TOLERANCIA)
      .sort((a, b) => String(a.fecha ?? "").localeCompare(String(b.fecha ?? "")))
    const uno = pool.find(a => Math.abs(Number(a.total) - objetivo) <= TOLERANCIA)
    if (uno) return [uno]
    const porImporte = new Map<number, AsientoLibroDiario[]>()
    for (const a of pool) {
      const k = Math.round(Number(a.total))
      porImporte.set(k, [...(porImporte.get(k) ?? []), a])
    }
    for (const a of pool) {
      const falta = Math.round(objetivo - Number(a.total))
      for (const k of [falta - 1, falta, falta + 1]) {
        const b = (porImporte.get(k) ?? []).find(x => x.id !== a.id && Math.abs(Number(a.total) + Number(x.total) - objetivo) <= TOLERANCIA)
        if (b) return [a, b]
      }
    }
    return []
  }
  let candidatos = buscar(diferencia)
  let candidatosContra: "diferencia" | "declarado" | undefined = candidatos.length ? "diferencia" : undefined
  if (!candidatos.length && reconocido > TOLERANCIA) {
    candidatos = buscar(declarado)
    if (candidatos.length) candidatosContra = "declarado"
  }
  return { declarado, fuenteDeclarado, reconocido, diferencia, estado: "no cierra", candidatos, candidatosContra, reconocidos }
}
