/**
 * 🏦 EL REGISTRO ÚNICO DE CUENTAS (bancos, cajas, tarjetas; y las de dólares y Cotitulares).
 *
 * ⚠️ cambió 22/11/2026 (A-FEAT-1637): vivía en `hooks/useMotorConciliacion.ts` («use client»), y una ruta del servidor no puede
 * leer datos de un módulo de cliente. Se mudó acá SIN cambios; el hook lo re-exporta, así que quien lo importaba de ahí sigue igual.
 * `scripts/verificar-recursos-permisos.mts` lee este archivo como texto.
 */
import { CUENTAS_DOLARES_Y_COTITULARES, type Titular } from "@/lib/dolares/cuentas"

// Configuración de cuentas bancarias y cajas
export interface CuentaBancaria {
  id: string
  nombre: string
  tabla_bd: string
  schema_bd?: string   // 'public' (default) | 'msa' | 'pam' | 'ma'
  /** A-FEAT-1398: además de las 3 empresas, «Cotitulares» (MA y los 5 hijos), titular propio. */
  empresa: Titular
  activa: boolean
  tipo?: 'banco' | 'caja' | 'tarjeta'
  /** A-FEAT-1398: la moneda de la cuenta. Sin dato = pesos. Las cuentas en USD NO se concilian contra el Cash Flow (que está en pesos). */
  moneda?: 'ARS' | 'USD'
  /** A-FEAT-1398: se carga a mano (no hay extracto que importar todavía). */
  cargaManual?: boolean
}

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  {
    id: 'msa_galicia',
    nombre: 'MSA Galicia CC Pesos',
    tabla_bd: 'msa_galicia',
    empresa: 'MSA',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'pam_galicia',
    nombre: 'PAM Galicia CA Pesos',
    tabla_bd: 'pam_galicia',
    empresa: 'PAM',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'pam_galicia_cc',
    nombre: 'PAM Galicia CC Pesos',
    tabla_bd: 'pam_galicia_cc',
    empresa: 'PAM',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'ma_galicia',
    nombre: 'MA Galicia CA Pesos',
    tabla_bd: 'ma_galicia',
    schema_bd: 'ma',
    empresa: 'MA',
    activa: true,
    tipo: 'banco'
  },
  {
    id: 'caja_general',
    nombre: 'Caja General MSA',
    tabla_bd: 'caja_general',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    id: 'caja_ams',
    nombre: 'Caja AMS MSA',
    tabla_bd: 'caja_ams',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    id: 'caja_sigot',
    nombre: 'Caja Sigot MSA',
    tabla_bd: 'caja_sigot',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    // 🏦 A-FEAT-1230 — los echeqs de CLIENTES: entra el recibido, sale el endoso. Se arma desde los
    // cheques (Extracto → Importar → «Traer echeqs»), no se importa de un archivo.
    id: 'echeqs_terceros',
    nombre: 'Echeqs de terceros MSA',
    tabla_bd: 'echeqs_terceros',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'caja'
  },
  {
    id: 'tarjeta_visa_business_msa',
    nombre: 'VISA Business MSA',
    tabla_bd: 'tarjeta_visa_business',
    schema_bd: 'msa',
    empresa: 'MSA',
    activa: true,
    tipo: 'tarjeta'
  },
  {
    id: 'tarjeta_visa_pam',
    nombre: 'VISA PAM',
    tabla_bd: 'tarjeta_visa',
    schema_bd: 'pam',
    empresa: 'PAM',
    activa: true,
    tipo: 'tarjeta'
  },
  {
    id: 'tarjeta_visa_ma',
    nombre: 'VISA MA',
    tabla_bd: 'tarjeta_visa',
    schema_bd: 'ma',
    empresa: 'MA',
    activa: true,
    tipo: 'tarjeta'
  },
  // 💵 A-FEAT-1398 (scripts/126): las 7 cuentas en dólares y de Cotitulares. La lista vive en lib/dolares/cuentas.ts.
  ...CUENTAS_DOLARES_Y_COTITULARES.map((c): CuentaBancaria => ({
    id: c.id, nombre: c.nombre, tabla_bd: c.tabla_bd, schema_bd: c.schema_bd, empresa: c.empresa,
    activa: true, tipo: c.tipo, moneda: c.moneda, cargaManual: true,
  })),
]
