/**
 * 🕐 **LA FECHA DE HOY, EN HORA ARGENTINA** — y por qué existe este archivo (A-OP-23).
 *
 * ## 🧨 El bug, que es de los que no se ven
 *
 * `new Date().toISOString()` devuelve el instante en **UTC**, y Argentina es **UTC−3**. Entonces
 * `new Date().toISOString().slice(0, 10)` —el modo más común de sacar «hoy» en este repo— **devuelve
 * el día de MAÑANA a partir de las 21:00 hora local**.
 *
 * Se descubrió el **2026-09-29 a las 22:xx**, y sólo porque una API se quejó: el script de
 * cotizaciones pidió datos *«hasta el 2026-09-30»* siendo 29, y el BCRA lo rechazó con *«La fecha no
 * puede ser mayor al día actual»*. **En una fila de la base nadie lo nota.**
 *
 * ⚠️ **Y en este proyecto el corrimiento cambia de EJERCICIO**: un movimiento cargado a las 22:00 del
 * **30/06** queda fechado el **01/07**, o sea del ejercicio siguiente — y el corte del balance es
 * exactamente ese día. Lo mismo un mes: a las 22:00 del 31/03 el presupuesto arranca en abril.
 *
 * ## 🎯 La distinción que hay que hacer, porque «arreglar todo» rompe cosas
 *
 * Hay **139** usos de `new Date().toISOString()` en el repo y **la mayoría está bien**:
 *
 * | Uso | ¿Se toca? | Por qué |
 * |---|---|---|
 * | `updated_at`, `created_at`, `finalizada_at`, `aplicada_at`, `fecha_anulacion` | ❌ **NO** | Guardan un **instante** en un `timestamptz`. UTC es lo correcto: lleva la zona adentro y Postgres lo convierte. Cambiarlo a un día local sería el error |
 * | Nombre de archivo, línea «Generado:» | ❌ no hace falta | Es cosmético. Si dice un día de más en el nombre de un Excel, no hay consecuencia |
 * | **Un DÍA (`slice(0,10)`) que se GUARDA** o que **define un período** | ✅ **SÍ** | Acá el corrimiento cambia el dato: la fecha de una pesada, el default de la fecha de una venta, el mes desde el que proyecta el presupuesto |
 * | **Un DÍA que se compara** contra fechas del negocio (alertas, vencimientos, curvas de peso) | ✅ sí | Una alerta que se adelanta un día avisa de algo que todavía no pasó |
 *
 * 📌 **La regla corta**: si el resultado es un **instante**, UTC; si es un **día del calendario
 * argentino**, estas funciones.
 *
 * *Confirmado como regla por el usuario el 2026-09-30: «respecto de fechas, siempre tomar argentina».*
 */

/** Argentina no tiene horario de verano desde 2009: el offset es fijo. */
const HORAS_DE_OFFSET = 3

/**
 * 📅 **HOY en hora argentina**, `AAAA-MM-DD`.
 *
 * Se corre el reloj 3 horas hacia atrás y después se lee la fecha en UTC, que ya es la local.
 */
export function hoyArgentina(): string {
  return diaArgentino(new Date())
}

/** El día argentino de un instante cualquiera, `AAAA-MM-DD`. */
export function diaArgentino(cuando: Date): string {
  return new Date(cuando.getTime() - HORAS_DE_OFFSET * 60 * 60 * 1000)
    .toISOString().slice(0, 10)
}

/**
 * 📆 **El MES de hoy en hora argentina**, `AAAA-MM`.
 *
 * 🧨 Tiene su propio motivo: el último día del mes a las 22:00, la versión UTC devuelve **el mes
 * siguiente**. Y hay pantallas que deciden con eso desde qué mes proyectar.
 */
export function mesArgentina(): string {
  return hoyArgentina().slice(0, 7)
}

/**
 * ⏱️ **El instante de ahora, para un `timestamptz`.**
 *
 * Existe para que quede **explícito** que acá UTC es lo correcto, y que no es un olvido del arreglo
 * de arriba. Es `new Date().toISOString()` con un nombre que lo explica.
 */
export function ahoraISO(): string {
  return new Date().toISOString()
}

/**
 * Los años para un selector: desde `desde` hasta el año en curso + 1, en fecha argentina.
 * A-BUG-1237: el del Dashboard era una lista escrita a mano que terminaba en 2025.
 */
export function añosHastaElProximo(desde: number, hoy: string = hoyArgentina()): number[] {
  const hasta = Number(hoy.slice(0, 4)) + 1
  const años: number[] = []
  for (let a = desde; a <= hasta; a++) años.push(a)
  return años
}
