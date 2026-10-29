/**
 * 🌾 LOS SALDOS DE INSUMOS, GAS OIL Y SEMENTERAS — A-FEAT-1386 (e), JMS 2026-10-29: «armalos igual que la hacienda».
 *
 * Igual que los tres saldos de la hacienda (`tres-saldos-hacienda.ts`), pero en PESOS y por rubro, porque los
 * productos de la planilla no se pueden aparear uno a uno con los de la app:
 *
 * | Saldo | De dónde sale |
 * |---|---|
 * | **Sistema** | el stock valuado de la app (grupo de `armarStockInsumos`) y el costo de la sementera. **Sólo al cierre**: la app guarda el stock de hoy, no su historia; al inicio va «—», nunca un cero inventado |
 * | **Balance** | lo declarado en el balance; a mano (o Claude, TENTATIVO) |
 *
 * Se guardan en `balance_datos_usuario`, papel `productivo.saldos`, clave `<momento>.balance.<rubro>`.
 * 🧮 La diferencia Sistema − Balance se muestra (avisa, no frena).
 */
import type { MomentoSaldo } from "@/lib/balance/tres-saldos-hacienda"

export interface RubroProductivo { clave: string; nombre: string; ambito?: string }

/** Los rubros, con el `ambito` del grupo de insumos de la app que les corresponde. */
export const RUBROS_PRODUCTIVOS: RubroProductivo[] = [
  { clave: "insumos-agricolas", nombre: "Insumos agrícolas", ambito: "agricola" },
  { clave: "insumos-ganaderos", nombre: "Insumos ganaderos (forrajeros y veterinarios)", ambito: "ganadero" },
  { clave: "gasoil", nombre: "Gas oil y otros", ambito: "ambos" },
  { clave: "sementeras", nombre: "Sementeras" },
]

export const claveSaldoProductivo = (momento: MomentoSaldo, rubro: string) => `${momento}.balance.${rubro}`

export interface FilaSaldoProductivo { clave: string; nombre: string; sistema: number | null; balance: number | null; dif: number | null }

const leer = (t: string | null | undefined): number | null => {
  if (t == null || String(t).trim() === "") return null
  const n = Number(String(t).replace(/\./g, "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}
const r2 = (n: number) => Math.round(n * 100) / 100

/** El sistema al cierre por rubro: los grupos de insumos por ámbito y el costo de la sementera. */
export function sistemaProductivoAlCierre(
  grupos: { ambito: string; valuado: number }[], sementeras: number | null,
): Record<string, number> {
  const r: Record<string, number> = {}
  for (const rb of RUBROS_PRODUCTIVOS) {
    if (!rb.ambito) continue
    r[rb.clave] = r2(grupos.filter(g => g.ambito === rb.ambito).reduce((s, g) => s + (g.valuado || 0), 0))
  }
  if (sementeras != null) r.sementeras = r2(sementeras)
  return r
}

export function armarSaldosProductivos(
  momento: MomentoSaldo,
  sistema: Record<string, number> | null,
  valores: Record<string, string | undefined>,
): { filas: FilaSaldoProductivo[]; total: FilaSaldoProductivo } {
  const filas = RUBROS_PRODUCTIVOS.map(rb => {
    const s = sistema?.[rb.clave] ?? null
    const b = leer(valores[claveSaldoProductivo(momento, rb.clave)])
    return { clave: rb.clave, nombre: rb.nombre, sistema: s, balance: b, dif: s != null && b != null ? r2(s - b) : null }
  })
  const sum = (k: "sistema" | "balance") => filas.some(f => f[k] != null) ? r2(filas.reduce((a, f) => a + (f[k] ?? 0), 0)) : null
  const s = sum("sistema"), b = sum("balance")
  return { filas, total: { clave: "total", nombre: "TOTAL", sistema: s, balance: b, dif: s != null && b != null ? r2(s - b) : null } }
}
