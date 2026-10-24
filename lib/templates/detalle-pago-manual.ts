/**
 * ✍️ Lo que se guarda al crear un PAGO MANUAL (Cash Flow y Egresos sin Factura) — A-FEAT-1326.
 *
 * Usuario 2026-10-23: *«cuando se crea pago manual uno quiere poner el detalle… hay que lograr que lo
 * que uno escriba se registre en detalle y hoy se registró en descripción»*. El modal del Cash Flow
 * guardaba en `descripcion` (la columna vieja, A-DAT-37) y la grilla muestra `detalle ?? descripcion`:
 * si la cuota ya tenía detalle, lo escrito no se veía. Una sola función para los dos modales
 * (§ ♻️ centralizar), así no vuelven a divergir.
 *
 * Devuelve SIEMPRE `detalle` (nunca `descripcion`). Reglas que ya tenían los dos modales:
 * FCI bidireccional → «Suscripción/Rescate <template>»; vacío → «<template> - Manual».
 */
export function camposDePagoManual(
  texto: string | null | undefined,
  template: { nombre_referencia?: string | null; categ?: string | null; es_bidireccional?: boolean | null } | null | undefined,
  tipoMovimiento: "egreso" | "ingreso" = "egreso",
): { detalle: string } {
  if (template?.es_bidireccional && template?.categ === "FCI") {
    return { detalle: `${tipoMovimiento === "egreso" ? "Suscripción" : "Rescate"} ${template.nombre_referencia ?? ""}`.trim() }
  }
  const t = (texto ?? "").trim()
  return { detalle: t || `${template?.nombre_referencia || "Pago"} - Manual` }
}
