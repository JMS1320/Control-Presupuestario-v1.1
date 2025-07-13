import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type CuentaContable = {
  id: string
  categ: string
  cuenta_contable: string
  tipo: "ingreso" | "egreso" | "financiero" | "distribucion"
}

export type MovimientoMSA = {
  id?: string // UUID generado automáticamente
  fecha?: string | null
  descripcion?: string | null
  origen?: string | null
  debitos?: number | null
  creditos?: number | null
  grupo_de_conceptos?: string | null
  concepto?: string | null
  numero_de_terminal?: string | null
  observaciones_cliente?: string | null
  numero_de_comprobante?: string | null
  leyendas_adicionales_1?: string | null
  leyendas_adicionales_2?: string | null
  leyendas_adicionales_3?: string | null
  leyendas_adicionales_4?: string | null
  tipo_de_movimiento?: string | null
  saldo?: number | null
  control?: number | null
  categ?: string | null
  detalle?: string | null
  contable?: string | null
  interno?: string | null
  centro_de_costo?: string | null
  cuenta?: string | null
  orden?: number | null
}
