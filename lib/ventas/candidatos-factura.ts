// ¿Qué factura de venta puede ser de qué venta? — la lógica de la alerta de la pantalla principal
// («Facturas de venta sin vincular», `components/alertas-fc-venta.tsx`).
//
// ── Por qué salió del componente (2026-09-22) ────────────────────────────────
// El usuario vio tres sugerencias y dos eran imposibles:
//  - A-BUG-186: ofrecía la FC 00010-00000021 de Sanpa ($78.262.800) para otra venta, cuando esa
//    factura ya estaba vinculada ENTERA a Rojas #1. Sólo se descartaba el par ya decidido; nadie
//    miraba cuánto le quedaba a la factura. Contestar que sí la contaba dos veces.
//  - A-BUG-187: ofrecía una factura de MSA (Provinvest) para una venta de PAM. Se leían sólo las
//    facturas de MSA y se comparaban con las ventas de todas las empresas.
// Acá se prueban los dos con esos números (`lib/pruebas/casos.ts`).
//
// ⚠️ Sin imports de valores: `npm run probar` no resuelve `@/` dentro de las librerías. Por eso la
// comparación de CUIT se recibe por parámetro (en la app es `mismoCuit` de `lib/cuit.ts`).

export interface VentaEsperando {
  venta_id: string
  venta_tipo: string
  empresa: string
  centro_costo: string
  cliente_nombre: string
  cliente_cuit: string | null
  monto_pesos: number | null
  facturado: number | null
}

export interface FacturaVenta {
  id: string
  /** De qué empresa es la factura: sale del schema del que se leyó (msa / pam / ma). */
  empresa: string
  nro_comprobante: string | null
  cuit_cliente: string | null
  imp_total: number | null
  fecha_liquidacion: string | null
}

export interface Vinculo {
  venta_id: string
  comprobante_id: string
  empresa?: string | null
  monto_asignado: number | null
  vinculado: boolean
}

export interface Candidato {
  venta_id: string
  venta_tipo: string
  empresa: string
  centro_costo: string
  cliente_nombre: string
  cliente_cuit: string
  monto_venta: number
  facturado: number
  /** Lo que le falta facturar a la venta. */
  remanente: number
  comprobante_id: string
  nro_comprobante: string
  imp_total: number
  /** Lo que le queda a la FACTURA sin asignar a ninguna venta (A-BUG-186). */
  disponible_factura: number
  fecha_liquidacion: string | null
  coincide_por: "cuit" | "importe"
  cuit_comprobante: string
}

export interface SinCuit {
  texto: string
  venta_tipo: string
}

const TOL = 0.01

export function armarCandidatos(
  ventas: VentaEsperando[],
  facturas: FacturaVenta[],
  vinculos: Vinculo[],
  mismoCuit: (a: string | null | undefined, b: string | null | undefined) => boolean,
): { candidatos: Candidato[]; sinCuit: SinCuit[] } {
  // Pares ya decididos (sí o no): no se vuelve a preguntar
  const decididos = new Set(vinculos.map(d => `${d.venta_id}|${d.comprobante_id}`))

  // Cuánto de cada factura ya está asignado a alguna venta. La clave lleva la empresa porque el id
  // de una factura es único en SU schema, no entre los tres.
  const asignado = new Map<string, number>()
  for (const d of vinculos) {
    if (!d.vinculado) continue
    const k = `${(d.empresa ?? "").toUpperCase()}|${d.comprobante_id}`
    asignado.set(k, (asignado.get(k) ?? 0) + (Number(d.monto_asignado) || 0))
  }

  const pendientes = ventas.filter(v => (Number(v.monto_pesos) || 0) - (Number(v.facturado) || 0) > TOL)
  const sinCuit = pendientes.filter(v => !v.cliente_cuit)
    .map(v => ({ texto: `${v.centro_costo} (${v.cliente_nombre})`, venta_tipo: v.venta_tipo }))

  const out: Candidato[] = []
  for (const v of pendientes) {
    if (!v.cliente_cuit) continue
    const monto = Number(v.monto_pesos) || 0
    const remanente = monto - (Number(v.facturado) || 0)

    for (const c of facturas) {
      // A-BUG-187: una factura de una empresa sólo puede ser de una venta de ESA empresa.
      if (c.empresa.toUpperCase() !== v.empresa.toUpperCase()) continue
      if (decididos.has(`${v.venta_id}|${c.id}`)) continue

      // A-BUG-186: si la factura ya está asignada entera a otras ventas, no se ofrece.
      const total = Number(c.imp_total) || 0
      const disponible = total - (asignado.get(`${c.empresa.toUpperCase()}|${c.id}`) ?? 0)
      if (disponible <= TOL) continue

      const porCuit = mismoCuit(c.cuit_cliente, v.cliente_cuit)
      // Segundo camino: el importe cierra exacto con lo que falta facturar. Sirve cuando el CUIT
      // está mal tipeado de un lado — ahí el match por CUIT no puede ayudar.
      const porImporte = !porCuit && Math.abs(disponible - remanente) < TOL
      if (!porCuit && !porImporte) continue

      out.push({
        venta_id: v.venta_id, venta_tipo: v.venta_tipo, empresa: v.empresa,
        centro_costo: v.centro_costo, cliente_nombre: v.cliente_nombre,
        cliente_cuit: v.cliente_cuit, monto_venta: monto,
        facturado: Number(v.facturado) || 0, remanente,
        comprobante_id: c.id, nro_comprobante: c.nro_comprobante || "",
        imp_total: total, disponible_factura: disponible, fecha_liquidacion: c.fecha_liquidacion,
        coincide_por: porCuit ? "cuit" : "importe",
        cuit_comprobante: String(c.cuit_cliente || ""),
      })
    }
  }
  // Los que cierran por importe exacto van primero: son los más probables y arrastran un CUIT a corregir.
  out.sort((a, b) => (a.coincide_por === b.coincide_por ? 0 : a.coincide_por === "importe" ? -1 : 1))
  return { candidatos: out, sinCuit }
}

/** Dónde se carga el CUIT del cliente, según qué venta es (A-BUG-188). */
export function dondeSeCargaElCuit(ventaTipo: string): string {
  if (ventaTipo === "ganaderia") return "en la venta de hacienda (Productivo)"
  if (ventaTipo === "arrendamiento") return "en el contrato (Ingresos → Arrendamiento)"
  return "en la venta"
}
