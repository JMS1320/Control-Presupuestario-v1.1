/**
 * QUÉ RECURSO PROTEGE CADA RUTA QUE ESCRIBE — A-FEAT-169, etapa 4
 *
 * Una fila por cada ruta de `app/api` que hace `insert/update/upsert/delete`. O dice qué recurso
 * la gobierna, o dice **por qué no se pudo mapear**.
 *
 * ⚠️ **El "sin mapear" es a propósito y es la parte importante.** Adivinar el recurso de una ruta
 * es peor que dejarla sin mapear: si le pongo `egresos.facturas-msa` a algo que en realidad toca
 * las tres empresas, **le abro PAM y MA a quien sólo tenía MSA**, y no falla nada — igual que el
 * `UPDATE` que no matchea (§ Contrapartes) o la categoría fuera del plan (§ Templates). Un hueco
 * declarado se ve en esta lista; un mapeo equivocado no se ve en ningún lado.
 *
 * Todas las rutas siguen teniendo su guard de sesión/admin: lo que falta acá es el **nivel**, no
 * la autenticación.
 */

export type MapeoRuta = { ruta: string; recurso: string } | { ruta: string; sinMapear: string }

export const RUTAS_RECURSOS: MapeoRuta[] = [
  // ── Mapeadas: la ruta toca exactamente una parte, y se sabe cuál ──────────────────────────
  { ruta: "reparsear-extracto", recurso: "extracto.parseo" },
  { ruta: "lotes/generar", recurso: "productivo.lotes" },

  // ── Sin mapear, con el motivo ─────────────────────────────────────────────────────────────
  { ruta: "arca-asignar", sinMapear: "Asigna cuenta a comprobantes ARCA de CUALQUIERA de las 3 empresas; las pestañas son una por empresa. Mapearla a una sola abriría las otras dos." },
  { ruta: "historico-asignar", sinMapear: "Igual que arca-asignar, sobre los comprobantes históricos." },
  { ruta: "import-pesadas", sinMapear: "Escribe `productivo.pesadas_terneros` y `terneros`: cae entre Cría y Recría y no está claro cuál manda." },
  { ruta: "import-terneros", sinMapear: "Escribe `productivo.terneros`. Probablemente Cría, pero 'probablemente' no alcanza para un permiso." },
  { ruta: "import-excel", sinMapear: "Importador genérico: el destino lo elige el usuario en la pantalla, no la ruta." },
  { ruta: "import-excel-ca", sinMapear: "Idem importador genérico." },
  { ruta: "import-excel-caja", sinMapear: "Idem importador genérico." },
  { ruta: "import-excel-dinamico", sinMapear: "Idem importador genérico." },
  { ruta: "import-excel-tarjeta", sinMapear: "Tarjeta no tiene pestaña registrada todavía." },
  { ruta: "import-pdf-tarjeta", sinMapear: "Idem tarjeta." },
  { ruta: "import-facturas-arca", sinMapear: "Importa para las 3 empresas; mismo problema que arca-asignar." },
  { ruta: "import-historico", sinMapear: "Idem histórico." },
  { ruta: "import-templates", sinMapear: "Toca `egresos.templates`, pero también crea cuentas contables. Falta decidir cuál manda." },
  { ruta: "import-ventas", sinMapear: "Ingresos no tiene recursos registrados: sus pestañas se generan por empresa y vista." },
  { ruta: "arca/descargar-comprobantes", sinMapear: "Misma ambigüedad de empresa." },
  { ruta: "gas/auditar-periodo", sinMapear: "Circuito de Drive/GAS, no cuelga de una pestaña." },
  { ruta: "gas/buscar-pdf", sinMapear: "Idem GAS." },
  { ruta: "gas/config-proveedor", sinMapear: "Idem GAS." },
  { ruta: "gas/confirmar-pdf", sinMapear: "Idem GAS." },
  { ruta: "sueldos/cuenta-empleado", sinMapear: "Sueldos no tiene pestañas registradas: hoy es una sola vista." },
  { ruta: "create-cuenta", sinMapear: "Crea cuentas contables; es transversal a varias secciones." },
  { ruta: "pendientes/comentarios", sinMapear: "El panel de pendientes es una herramienta interna, no una sección de la app." },
  { ruta: "pendientes/propuestos", sinMapear: "Idem pendientes." },
  { ruta: "revisiones", sinMapear: "Las marcas de revisión son transversales: se ponen desde cualquier pantalla." },
  { ruta: "admin/roles", sinMapear: "Ya exige admin con 2FA (`exigirAdmin`), que es más estricto que cualquier recurso." },
]

/** El recurso de una ruta, o `null` si está declarada sin mapear. */
export function recursoDeRuta(ruta: string): string | null {
  const m = RUTAS_RECURSOS.find((x) => x.ruta === ruta)
  return m && "recurso" in m ? m.recurso : null
}
