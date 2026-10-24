/**
 * ➕ CREAR UN ROL COPIANDO DE OTRO — A-FEAT-171, etapa 2 de A-FEAT-1322.
 *
 * Decisión del usuario 2026-10-24: **un rol por persona**, y cada uno se arma copiando de otro. La
 * forma de trabajo: armar el de Ulises en `pruebas` con su otro mail, probarlo, y recién entonces
 * «crear rol Ulises copiando de pruebas» y asignárselo. Ése es el clic que cambia lo que ve Ulises.
 *
 * Es una COPIA, no un vínculo: si después se cambia `pruebas` para armar el de Enrique, el de Ulises
 * no se mueve. Por eso se copian las secciones y las excepciones tal cual estaban en ese momento.
 *
 * Pieza pura (sin base): la prueba `npm run probar`. La ruta `POST /api/admin/roles` la usa.
 *
 * Lo que se respeta, todo de A-FEAT-171:
 *   · El `id` es lo que queda escrito en `app_metadata.role` de cada usuario: no se repite y no se
 *     puede cambiar después. Por eso se normaliza a minúsculas sin espacios ni acentos.
 *   · `es_sistema` NUNCA viene de afuera: un rol creado acá es siempre editable y borrable.
 */

export type RolBase = {
  id: string
  secciones: string[]
  exige_2fa: boolean
  permisos: Record<string, string>
}

export type FilaRolNuevo = {
  id: string
  descripcion: string
  secciones: string[]
  exige_2fa: boolean
  es_sistema: false
  permisos: Record<string, string>
}

/** «Ulises Gómez» → «ulises-gomez». Lo que queda es lo que se guarda en la cuenta de la persona. */
export function normalizarIdRol(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function armarRolNuevo(
  pedido: { nombre: string; descripcion?: string; copiarDe?: string | null },
  existentes: RolBase[],
): { ok: true; fila: FilaRolNuevo } | { ok: false; error: string } {
  const id = normalizarIdRol(pedido.nombre ?? "")
  if (id.length < 2 || id.length > 30) {
    return { ok: false, error: "El nombre tiene que tener entre 2 y 30 letras o números." }
  }
  if (existentes.some((r) => r.id === id)) {
    return { ok: false, error: `Ya existe un rol «${id}».` }
  }

  let base: RolBase | undefined
  if (pedido.copiarDe) {
    base = existentes.find((r) => r.id === pedido.copiarDe)
    if (!base) return { ok: false, error: `No existe el rol «${pedido.copiarDe}» para copiar.` }
  }

  return {
    ok: true,
    fila: {
      id,
      descripcion: (pedido.descripcion ?? "").trim() || (base ? `Copiado de «${base.id}».` : ""),
      // Sin rol de origen nace vacío, como `pruebas`: el peor caso es «no ve nada», que se nota al
      // instante y no expone nada.
      secciones: base ? [...base.secciones] : [],
      exige_2fa: base ? base.exige_2fa : false,
      es_sistema: false,
      permisos: base ? { ...base.permisos } : {},
    },
  }
}
