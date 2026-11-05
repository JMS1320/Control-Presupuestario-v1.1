/**
 * 🗂️ Las boletas de ARBA en la PLANILLA, con la historia de cada partida — A-FEAT-1565.
 *
 * JMS 05/11, procesando la cuota 4: *«¿no me da una vista de la planilla con sus cuotas anteriores y esta cómo quedaría,
 * contra lo que estaba cargado? Ideal ver por responsable sus partidas: la cuota 1 y la 2, y la 3 presupuestada y la que
 * vino; dif de la que vino contra la presupuestada y contra la anterior. Poder aceptar la propuesta, decir que permanezca
 * la presupuestada o poner una yo»*.
 *
 * Pura (sin base): arma, por responsable, una fila por template con sus cuotas anteriores, la cuota de la boleta
 * presupuestada y la que vino, y las dos diferencias. También las partidas que tenían que llegar y NO llegaron
 * («¿faltan boletas?»). La decisión y el aplicar siguen siendo los del panel (`components/panel-boletas-arba.tsx`).
 */

export interface TemplateParaPlanilla { id: string; nombre: string; responsable: string; partida: string | null }
export interface CuotaParaPlanilla { id: string; egresoId: string; numero: number | null; monto: number; vencimiento: string | null; estado: string }
export interface BoletaParaPlanilla {
  /** Índice de la fila en el panel (para escribirle la decisión). */
  idx: number
  egresoId: string | null
  cuotaId: string | null
  cuotaNro: number | null
  /** Lo leído del PDF (o corregido a mano). */
  importe: number | null
  vencimiento: string | null
  url: string | null
  aplicada: boolean
  problema: string | null
}

export type Decision = "aceptar" | "presupuestada" | "otra"

export interface FilaPlanillaBoleta {
  templateId: string
  campo: string
  partida: string | null
  /** Las cuotas ANTERIORES a la de la boleta, por número. */
  anteriores: { numero: number; monto: number; estado: string }[]
  cuotaNro: number | null
  presupuestada: number | null
  vino: number | null
  vencVino: string | null
  url: string | null
  difPresup: number | null
  pctPresup: number | null
  /** Contra la cuota inmediatamente anterior. */
  difAnterior: number | null
  pctAnterior: number | null
  /** La fila del panel (null = la boleta no vino). */
  idx: number | null
  aplicada: boolean
  problema: string | null
  estadoCuota: string | null
}

export interface BloquePlanillaBoleta { responsable: string; filas: FilaPlanillaBoleta[]; totalPresup: number; totalVino: number; faltan: number }

const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (a: number, b: number) => (b ? r2(((a - b) / b) * 100) : null)

/** «Inmobiliario Cuota Tango Parra 1» → «Tango Parra 1». */
export const campoDe = (nombre: string) => nombre.replace(/^\s*Inmobiliario\s+(Complementario\s+)?(Cuota|Anual)?\s*/i, "").trim() || nombre

export function armarPlanillaBoletas(templates: TemplateParaPlanilla[], cuotas: CuotaParaPlanilla[], boletas: BoletaParaPlanilla[]): BloquePlanillaBoleta[] {
  const porTemplate = new Map<string, CuotaParaPlanilla[]>()
  for (const c of cuotas) porTemplate.set(c.egresoId, [...(porTemplate.get(c.egresoId) ?? []), c])
  const boletaDe = new Map<string, BoletaParaPlanilla>()
  for (const b of boletas) if (b.egresoId && !boletaDe.has(b.egresoId)) boletaDe.set(b.egresoId, b)
  // La cuota «del momento»: la de las boletas que vinieron (la más repetida). Sirve para las que no vinieron.
  const nros = boletas.map(b => b.cuotaNro).filter((n): n is number => n != null)
  const cuotaComun = nros.length ? [...nros].sort((a, b) => nros.filter(x => x === b).length - nros.filter(x => x === a).length)[0] : null

  const porResp = new Map<string, FilaPlanillaBoleta[]>()
  for (const t of templates) {
    const b = boletaDe.get(t.id) ?? null
    const nro = b?.cuotaNro ?? cuotaComun
    const cs = (porTemplate.get(t.id) ?? []).filter(c => c.numero != null).sort((x, y) => (x.numero ?? 0) - (y.numero ?? 0))
    const actual = nro != null ? cs.find(c => c.numero === nro) ?? null : null
    const anteriores = nro != null ? cs.filter(c => (c.numero ?? 0) < nro).map(c => ({ numero: c.numero!, monto: r2(c.monto), estado: c.estado })) : []
    const previa = anteriores.length ? anteriores[anteriores.length - 1] : null
    const vino = b?.importe ?? null
    const presup = actual ? r2(actual.monto) : null
    porResp.set(t.responsable, [...(porResp.get(t.responsable) ?? []), {
      templateId: t.id, campo: campoDe(t.nombre), partida: t.partida, anteriores, cuotaNro: nro,
      presupuestada: presup, vino, vencVino: b?.vencimiento ?? null, url: b?.url ?? null,
      difPresup: vino != null && presup != null ? r2(vino - presup) : null, pctPresup: vino != null && presup != null ? pct(vino, presup) : null,
      difAnterior: vino != null && previa ? r2(vino - previa.monto) : null, pctAnterior: vino != null && previa ? pct(vino, previa.monto) : null,
      idx: b?.idx ?? null, aplicada: b?.aplicada ?? false, problema: b?.problema ?? null, estadoCuota: actual?.estado ?? null,
    }])
  }
  return [...porResp.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([responsable, filas]) => {
    filas.sort((x, y) => Number(/complementario/i.test(x.campo)) - Number(/complementario/i.test(y.campo)) || x.campo.localeCompare(y.campo))
    return {
      responsable, filas,
      totalPresup: r2(filas.reduce((s, f) => s + (f.presupuestada ?? 0), 0)),
      totalVino: r2(filas.reduce((s, f) => s + (f.vino ?? 0), 0)),
      faltan: filas.filter(f => f.idx == null).length,
    }
  })
}

/** El importe que queda según la decisión (para los totales «cómo quedaría»). `otra` usa lo escrito; vacío = la presupuestada. */
export function importeElegido(f: Pick<FilaPlanillaBoleta, "presupuestada" | "vino">, decision: Decision, otra: number | null): number | null {
  if (decision === "aceptar") return f.vino ?? f.presupuestada
  if (decision === "otra") return otra ?? f.presupuestada
  return f.presupuestada
}

/** La decisión que se propone: aceptar la boleta si vino y cambia algo y no está aplicada ni conciliada; si no, dejar la presupuestada. */
export function decisionPropuesta(f: Pick<FilaPlanillaBoleta, "vino" | "presupuestada" | "aplicada" | "estadoCuota" | "idx">): Decision {
  if (f.idx == null || f.vino == null || f.aplicada || f.estadoCuota === "conciliado") return "presupuestada"
  return f.presupuestada == null || Math.abs(f.vino - f.presupuestada) > 1 ? "aceptar" : "presupuestada"
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 💾 La PROPUESTA queda guardada (A-FEAT-1565 etapa 2, JMS 05/11: «si la proposición fue una, va a volver a ser la misma…
// no haría falta correr el proceso para que me vuelva a proponer lo mismo»). Cada boleta leída se guarda en
// `public.boletas_arba` con `aplicada = false` (= propuesta); «Aplicar» la pasa a `true`. La partida es obligatoria y forma
// la clave única (partida, año, cuota, impuesto): el complementario no tiene partida y una «Sin asignar» todavía no la
// tiene, así que llevan una clave PROVISORIA que se reemplaza al asignarla.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** ¿Es una partida de ARBA de verdad (099-015881-9 o sus 10 dígitos)? */
export const esPartidaArba = (p: string | null | undefined) => /^\d{3}-?\d{6}-?\d$/.test(String(p ?? "").trim())

export const PREFIJO_SIN_ASIGNAR = "sin-asignar:"
export const PREFIJO_COMPLEMENTARIO = "complementario:"

/** La clave `partida` con la que se guarda la boleta: la real si se conoce; si no, una provisoria que no choca con otra. */
export function claveBoleta(b: { partidaPdf: string | null; objetoMail: string | null; partidaAsignada?: string | null; complementario: boolean; egresoId: string | null; archivo: string }): string {
  const real = [b.partidaAsignada, b.partidaPdf, b.objetoMail].find(esPartidaArba)
  if (real) return real.trim()
  if (b.complementario) return PREFIJO_COMPLEMENTARIO + (b.egresoId ?? b.archivo)
  return PREFIJO_SIN_ASIGNAR + b.archivo
}

/** Para mostrar: la partida real, o vacío si la clave es provisoria. */
export const partidaDeClave = (clave: string) => clave.startsWith(PREFIJO_SIN_ASIGNAR) || clave.startsWith(PREFIJO_COMPLEMENTARIO) ? null : clave
