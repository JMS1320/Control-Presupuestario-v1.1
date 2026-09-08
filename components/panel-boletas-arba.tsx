"use client"

/**
 * 🏛️ BOLETAS DE ARBA — comparar contra el template y decidir cuál aplicar. A-FEAT-95 / A-FEAT-104.
 *
 * ## La regla que manda todo
 * 🔴 **La boleta NUNCA pisa al template sola.** Textual del usuario: *«no reemplazar los templates,
 * ya que yo debo ver y decidir: cambiar éste sí, éste no, todos»*. Acá se muestran los dos números
 * uno al lado del otro y **aplicar es un acto explícito**, fila por fila o con «aplicar todas».
 *
 * ## Para qué sirve de verdad
 * Las cuotas 1 y 2 del año ya están conciliadas con su boleta. **Las 3 y 4 están proyectadas
 * repitiendo el monto de la 2**, así que cuando llega la boleta real el presupuesto puede pasar de
 * una estimación a un número. Eso es lo que esta pantalla vuelca — con tu visto bueno.
 *
 * Los PDFs se pueden subir a mano acá; el GAS (`accion: boletas_arba`) hace lo mismo desde el mail.
 */

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { parsearBoletaArba, type BoletaArba } from "@/lib/arba/parsear-boleta"
import { decidirAplicar, controlDosCaminos, huellaBoleta, aMonto } from "@/lib/arba/casar-boleta"
import { armarInforme, esPartida, EMPRESA_POR_CUIT, type Informe, type TablaMail, type ResGas, type TemplateArba } from "@/lib/arba/informe-boletas"
import { anotarResultado } from "@/lib/cinta-diagnostico"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Comparacion {
  archivo: string
  boleta: BoletaArba
  /** El template activo de esa partida, y la cuota que corresponde. */
  lote: string | null
  egresoId: string | null
  cuotaId: string | null
  montoTemplate: number | null
  /** La fecha de vencimiento que hoy tiene el template. Puede estar vacía o vieja. */
  vencTemplate: string | null
  estadoCuota: string | null
  /** Qué cambiaría al aplicar: el monto, la fecha, o las dos. */
  cambia: ("monto" | "vencimiento")[]
  aplicar: boolean
  aplicada: boolean
  problema: string | null
  /** Cuando hay más de un template posible (el complementario de MSA y el de PAM). */
  opciones?: { id: string; nombre_referencia: string }[]
  /**
   * 🔁 El SEGUNDO camino al mismo número: lo que dice la tabla del cuerpo del mail (`A-FEAT-107`).
   * Se pega por nombre de archivo con lo que devolvió el GAS al bajar.
   */
  importeMail: number | null
  objetoMail: string | null
  /**
   * El importe corregido a mano. Vacío = vale el del PDF (§ Default del dato real, siempre editable).
   * 🔴 Es el campo que **alimenta la plata**: que la cabecera fuera editable y el importe no era
   * exactamente al revés de lo que hace falta (§ 📄 Importar un documento, condición 2).
   */
  importeFix: string
  /** La fecha de vencimiento corregida a mano (ISO). Vacía = vale la de la boleta. */
  vencFix: string
}

const m = (n: number | null | undefined) =>
  n == null ? "—" : `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * El importe que se va a aplicar: **el corregido a mano si lo hay, si no el del PDF**.
 * Campo vacío = «usá el real» (§ Default del dato real, siempre editable).
 */
const importeDe = (f: Comparacion) => aMonto(f.importeFix) ?? f.boleta.importe

/** La fecha de vencimiento a aplicar: la corregida a mano si la hay, si no la de la boleta. */
const vencDe = (f: Comparacion) => (f.vencFix.trim() || f.boleta.vencimiento) || null

/** `2026-09-11` → `11/09/2026`. */
const fecha = (iso: string | null | undefined) =>
  iso ? iso.split("-").reverse().join("/") : "—"

/**
 * `Inmobiliario Cuota Tango Parra 1` → `Tango Parra 1`.
 * El template lleva el prefijo para ordenar la grilla; el nombre del archivo no lo necesita — la
 * convención del usuario ya dice «Inmob» y la cuota.
 */
const nombreCorto = (n: string) =>
  n.replace(/^Inmobiliario\s+(Cuota|Anual)\s+/i, "").trim() || n

/**
 * Los templates ACTIVOS de inmobiliario con su `responsable`.
 *
 * 🔑 Es **nuestro registro**: la lista de lo que tiene que llegar. De acá salen las tres cosas —
 * el eje del informe, el nombre del archivo y la carpeta donde se guarda.
 */
async function cargarTemplates(): Promise<TemplateArba[]> {
  const { data } = await supabase.from("egresos_sin_factura")
    .select("nombre_referencia, partida_arba, responsable, activo")
    .eq("activo", true)
    .or("partida_arba.not.is.null,nombre_referencia.ilike.%Complementario%")
  return ((data ?? []) as {
    nombre_referencia: string; partida_arba: string | null; responsable: string | null
  }[])
    .filter(e => e.responsable && (e.partida_arba || /complementario/i.test(e.nombre_referencia)))
    .map(e => ({
      nombre: e.nombre_referencia, partida: e.partida_arba,
      responsable: e.responsable!, complementario: !e.partida_arba,
    }))
}

/**
 * Casa la boleta con la CUOTA que le corresponde del template, y propone si aplicarla.
 *
 * 🔑 Se propone sólo cuando el monto **difiere** y la cuota **no está conciliada**: una cuota
 * conciliada ya se pagó por ese importe, y cambiarla reescribiría un hecho, no una proyección.
 */
async function casarCuota(fila: Comparacion, egresoId: string, boleta: BoletaArba) {
  const nro = boleta.cuota && /^\d$/.test(boleta.cuota) ? parseInt(boleta.cuota) : null
  let c: { id: string; monto: number; estado: string; fecha_vencimiento: string | null } | undefined
  if (nro != null) {
    const { data: cs } = await supabase.from("cuotas_egresos_sin_factura")
      .select("id, monto, estado, numero_cuota, fecha_vencimiento")
      .eq("egreso_id", egresoId).eq("numero_cuota", nro)
    c = (cs ?? [])[0] as typeof c
  }
  if (c) {
    fila.cuotaId = c.id
    fila.montoTemplate = Number(c.monto)
    fila.vencTemplate = c.fecha_vencimiento ?? null
    fila.estadoCuota = c.estado
  }
  // La decisión vive en `lib/arba/casar-boleta.ts`, aparte y sin base: es lo que mueve plata
  // proyectada, y adentro de un componente no se podía probar con números.
  const d = decidirAplicar(
    c ? { monto: Number(c.monto), estado: c.estado, fechaVencimiento: c.fecha_vencimiento ?? null } : null,
    boleta.importe, nro, boleta.vencimiento,
  )
  fila.aplicar = d.aplicar
  fila.problema = d.problema
  fila.cambia = d.cambia
}

/**
 * Un aviso que **se queda**. No es un toast.
 *
 * 🐞 Pedido del usuario 2026-09-08, después de perderse el mensaje de error dos veces:
 * *«veo que tarda el proceso y hago algo mientras tanto, y para cuando vuelvo se perdió el
 * mensaje»*. Un aviso que se borra solo a los 8 segundos **no sirve para un proceso que tarda**:
 * justo el que más necesita explicarse es el que uno no está mirando cuando termina.
 *
 * Por eso lleva **la hora**: al volver hay que poder saber si lo que se lee es de esta corrida o
 * de la anterior.
 */
interface Aviso {
  tipo: "error" | "ok" | "info"
  titulo: string
  /** El texto largo — la respuesta cruda del GAS, el detalle del error. Se abre con un click. */
  detalle?: string
  hora: string
}

const ESTILO_AVISO: Record<Aviso["tipo"], string> = {
  error: "border-rose-300 bg-rose-50 text-rose-900",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
}
const ICONO_AVISO: Record<Aviso["tipo"], string> = { error: "⚠", ok: "✓", info: "ℹ" }

export function PanelBoletasArba() {
  const [abierto, setAbierto] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [avisoAbierto, setAvisoAbierto] = useState(false)
  /** Deja el aviso en el modal **y** lo pasa por toast: el toast llama la atención, el modal queda. */
  const avisar = (tipo: Aviso["tipo"], titulo: string, detalle?: string) => {
    setAviso({ tipo, titulo, detalle, hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) })
    setAvisoAbierto(false)
    if (tipo === "error") toast.error(titulo)
    else if (tipo === "ok") toast.success(titulo)
  }
  const [leyendo, setLeyendo] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [filas, setFilas] = useState<Comparacion[]>([])
  const [bajando, setBajando] = useState(false)
  /** Cuántos días de mail mirar. Achicarlo es lo primero que hay que probar si la bajada no llega. */
  const [dias, setDias] = useState("60")
  const [informe, setInforme] = useState<Informe | null>(null)
  /** Cuántas pasadas hizo falta. Se muestra sólo cuando fue más de una. */
  const [pasadas, setPasadas] = useState(0)
  type Bajada = { archivo: string; carpeta?: string; url?: string; objeto_mail?: string | null; importe_mail?: number | null }
  const [delMail, setDelMail] = useState<{ resumen: string; bajadas: Bajada[]; ya_estaban: { archivo: string }[]; descuadres?: { asunto: string; detalle: string }[] } | null>(null)
  /**
   * Lo que dijo el MAIL, por nombre de archivo. Se llena al bajar y se usa cuando después subís
   * esos mismos PDFs: ahí es donde los dos caminos se encuentran y se pueden comparar.
   */
  const [mailPorArchivo, setMailPorArchivo] = useState<Record<string, { objeto: string | null; importe: number | null }>>({})

  const subir = async (archivos: FileList) => {
    setLeyendo(true)
    const nuevas: Comparacion[] = []
    try {
      for (const f of Array.from(archivos)) {
        const boleta = await parsearBoletaArba(await f.arrayBuffer())
        const delMailEste = mailPorArchivo[f.name]
        const fila: Comparacion = {
          archivo: f.name, boleta, lote: null, egresoId: null, cuotaId: null,
          montoTemplate: null, vencTemplate: null, estadoCuota: null, cambia: [],
          aplicar: false, aplicada: false, problema: null,
          importeMail: delMailEste?.importe ?? null, objetoMail: delMailEste?.objeto ?? null,
          importeFix: "", vencFix: "",
        }

        if (boleta.impuesto === "complementario") {
          // 🔑 El COMPLEMENTARIO no tiene partida y no es un error: grava **todas las partidas del
          // CUIT** a la vez, no una parcela. Por eso casa con los templates «Inmobiliario
          // Complementario» de la empresa, no con un lote. (Aclarado por el usuario 2026-09-06.)
          const { data: egs } = await supabase.from("egresos_sin_factura")
            .select("id, nombre_referencia, activo")
            .ilike("nombre_referencia", "%Complementario%").eq("activo", true)
          const cands = (egs ?? []) as { id: string; nombre_referencia: string }[]
          if (cands.length === 1) {
            fila.lote = cands[0].nombre_referencia
            fila.egresoId = cands[0].id
            await casarCuota(fila, cands[0].id, boleta)
          } else if (cands.length > 1) {
            fila.problema = `complementario: hay ${cands.length} templates activos (MSA y PAM) — elegí cuál`
            fila.opciones = cands
          } else {
            fila.problema = "complementario: no hay template activo"
          }
        } else if (!boleta.partida && !esPartida(fila.objetoMail)) {
          fila.problema = "no se encontró la partida, ni en el PDF ni en el mail"
        } else {
          // 🔑 **La partida puede venir por cualquiera de los dos caminos** (A-FEAT-107). El parser
          // del PDF la encuentra en 27 de 63 boletas; el mail la trae siempre, porque es la columna
          // «Objeto Imponible» de su tabla. Si el PDF no la dio, manda la del mail.
          const partida = boleta.partida ?? fila.objetoMail!
          // El template ACTIVO de esa partida. Los «Anual» están desactivados y no proyectan:
          // buscar sin filtrar por `activo` haría comparar contra algo apagado (A-BUG-110).
          const { data: egs } = await supabase.from("egresos_sin_factura")
            .select("id, nombre_referencia, activo")
            .eq("partida_arba", partida).eq("activo", true)
          const eg = (egs ?? [])[0] as { id: string; nombre_referencia: string } | undefined
          if (!eg) {
            fila.problema = "la partida no tiene ningún template ACTIVO"
          } else {
            fila.lote = eg.nombre_referencia
            fila.egresoId = eg.id
            await casarCuota(fila, eg.id, boleta)
          }
        }
        nuevas.push(fila)
      }
      // 📣 Mismo motivo que en el romaneo: un parser que no reconoce nada NO falla, y sin
      // declararlo la nota del usuario llega sin una sola pista.
      const conPartida = nuevas.filter(x => x.boleta.partida).length
      const casadas = nuevas.filter(x => x.cuotaId).length
      anotarResultado("boletas-arba",
        `${nuevas.length} PDF · ${conPartida} con partida · ${casadas} casada(s) con su cuota`)

      setFilas(f => [...f, ...nuevas])
      avisar("ok", `${nuevas.length} boleta(s) leída(s)`, `${conPartida} con partida · ${casadas} casada(s) con su cuota del template.` + (nuevas.length - casadas > 0 ? `

${nuevas.length - casadas} no casaron: mirá la columna Estado de cada fila.` : ""))
    } catch (e) {
      avisar("error", "No se pudieron leer los PDFs", (e as Error).message)
    } finally { setLeyendo(false) }
  }

  /**
   * Le pide al GAS que baje las boletas del mail. Es **el camino principal**: subir los PDFs a mano
   * es el respaldo para cuando el mail no llegó o hay que reprocesar algo viejo.
   */
  const bajarDelMail = async (soloContar: boolean) => {
    setBajando(true)
    setDelMail(null)
    avisar("info", soloContar ? "Buscando en el mail…" : "Bajando y archivando…",
      "El GAS corta solo antes de que la app se canse, así que la respuesta siempre llega: "
      + "nada queda corriendo por atrás.\n\n"
      + (soloContar ? "" : "Si no entra todo en una pasada, sigo yo solo hasta terminar."))
    try {
      // 🗂️ Los templates se cargan ANTES de llamar al GAS: de ellos salen el nombre del campo y el
      // responsable, y con eso el archivo se guarda como el usuario lo nombraba a mano
      // (`2026 - Inmob - Cuota 3 - Tango Parra 1.pdf`) y en la carpeta de su empresa.
      const templates = await cargarTemplates()
      const partidas: Record<string, { nombre: string; responsable: string }> = {}
      for (const t of templates) {
        if (t.partida) partidas[t.partida] = { nombre: nombreCorto(t.nombre), responsable: t.responsable }
      }

      /**
       * 🔁 **Las pasadas las da la app, no el usuario.**
       *
       * Pedido textual (2026-09-08): *«quiero ver que lo pueda bajar todo de una sola»*. Cada
       * llamada al GAS está limitada por el tiempo que la app puede esperar —un límite de la
       * plataforma, no del trabajo—, así que con muchas boletas hace falta más de una pasada.
       * **Que las cuente el usuario es trasladarle un problema nuestro.**
       *
       * Se corta cuando no queda nada (lo normal), cuando una pasada **no avanzó** —si no, sería
       * un bucle infinito ante cualquier boleta que falle siempre— o al llegar al tope.
       */
      const TOPE_PASADAS = 12
      let j: Record<string, unknown> = {}
      let pasada = 0
      const acumBajadas: Bajada[] = []
      const acumYaEstaban: { archivo: string }[] = []

      while (pasada < TOPE_PASADAS) {
        pasada++
        const r = await fetch("/api/gas/boletas-arba", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solo_contar: soloContar, dias: Number(dias) || undefined,
            partidas, empresa_por_cuit: EMPRESA_POR_CUIT,
          }),
        })
        j = await r.json()
        if (!j.ok) {
          // 🔴 El error del GAS trae el texto que dice QUÉ HACER (falta desplegar, falta la env var,
          // se pasó el tiempo). Perderlo es perder la única pista, así que queda entero acá.
          avisar("error", "No se pudo traer del mail", String(j.error || "El GAS no dijo por qué.")
            + `\n\nHTTP ${r.status}.` + (pasada > 1 ? `\n\nFalló en la pasada ${pasada}; lo de las anteriores quedó archivado.` : ""))
          return
        }
        const nuevas = (j.bajadas ?? []) as Bajada[]
        acumBajadas.push(...nuevas)
        acumYaEstaban.push(...((j.ya_estaban ?? []) as { archivo: string }[]))

        // Contar no baja nada: una sola pasada alcanza y repetir daría siempre lo mismo.
        if (soloContar || !j.sin_tiempo) break
        // Una pasada que no bajó nada nuevo no va a mejorar repitiéndola.
        if (nuevas.length === 0) break

        avisar("info", `Bajando… pasada ${pasada + 1}`,
          `${acumBajadas.length} archivada(s) hasta ahora · quedan ${j.quedaron}.\n\n`
          + "Sigo solo: no hace falta que hagas nada.")
      }
      setPasadas(pasada)

      // Lo acumulado de TODAS las pasadas, no sólo de la última.
      j = { ...j, bajadas: acumBajadas, ya_estaban: acumYaEstaban }
      setDelMail({ resumen: String(j.resumen ?? ""), bajadas: acumBajadas, ya_estaban: acumYaEstaban, descuadres: (j.descuadres ?? []) as { asunto: string; detalle: string }[] })
      // Se guarda lo que dijo el mail para poder cruzarlo cuando se suban los PDFs (A-FEAT-107).
      const idx: Record<string, { objeto: string | null; importe: number | null }> = {}
      for (const b of (j.bajadas ?? []) as Bajada[]) {
        if (b.importe_mail != null || b.objeto_mail) idx[b.archivo] = { objeto: b.objeto_mail ?? null, importe: b.importe_mail ?? null }
      }
      setMailPorArchivo(prev => ({ ...prev, ...idx }))

      // 🗣️ **El informe va en el idioma del usuario, no en el del sistema.**
      // Pedido textual (2026-09-08): *«el informe a mí tiene que ser en mi lenguaje: encontró
      // inmobiliario MSA, Tango 1, Tango 2, Tango 3; tal no encontró; tantos duplicados»*.
      // «4 links que no dieron PDF» no es un informe, es un log. El GAS no conoce los lotes —los
      // templates viven acá—, así que la traducción se hace en la app: partida → nombre del campo.
      setInforme(armarInforme((j.tablas ?? []) as TablaMail[], templates, j as ResGas))

      const tablasGas = (j.tablas ?? []) as TablaMail[]
      const filas = tablasGas.reduce((s: number, t: { filas?: unknown[] }) => s + (t.filas?.length ?? 0), 0)
      const conImporte = Object.keys(idx).length
      // 🔴 **Que se sepa si TERMINÓ.** Pregunta del usuario: *«¿cómo sé cuándo ya terminó?»*.
      // Un resumen que enumera lo hecho no contesta eso — el estado final es un dato aparte.
      const termino = !j.sin_tiempo
      avisar(
        // Si no leyó ninguna fila de la tabla del mail, NO es un éxito limpio: se dice.
        filas === 0 || !termino ? "info" : "ok",
        soloContar
          ? `Encontradas ${((j.bajadas ?? []) as unknown[]).length} boleta(s)` + (filas ? ` · ${filas} fila(s) leídas del mail` : " · sin leer la tabla del mail")
          : termino
            ? `✓ Listo — no queda nada por bajar${(j.bajadas as unknown[])?.length ? ` · ${(j.bajadas as unknown[]).length} archivada(s)` : ""}${pasada > 1 ? ` en ${pasada} pasadas` : ""}`
            : `⏳ Quedaron ${j.quedaron} sin bajar después de ${pasada} pasada(s) — volvé a apretar «Bajar y archivar»`,
        [
          j.resumen ? `Resumen: ${j.resumen}` : "",
          filas === 0
            ? "⚠️ No se leyó ninguna fila de la tabla del cuerpo del mail. No te bloquea: los PDFs se bajan igual y podés seguir subiéndolos a mano. Guardá un mail como .eml en la carpeta de comunicación para que se pueda ajustar."
            : `${conImporte} archivo(s) quedaron con su importe del mail.`,
          ...tablasGas.map((t) =>
            `\n▸ ${t.asunto ?? "(sin asunto)"}${t.contribuyente ? `  ·  CUIT ${t.contribuyente}` : ""}\n`
            + (t.filas ?? []).map(f => `   ${f.objeto}   ${f.importe == null ? "(sin importe)" : m(f.importe)}`).join("\n")),
          ...((j.descuadres ?? []) as { asunto: string; detalle: string }[]).map((d) => `\n⚠️ ${d.asunto}: ${d.detalle}`),
        ].filter(Boolean).join("\n"),
      )
    } catch (e) {
      avisar("error", "No se pudo hablar con el servidor", (e as Error).message
        + "\n\nSuele ser que la página quedó de un deploy viejo: refrescá y probá de nuevo.")
    } finally { setBajando(false) }
  }

  const aplicar = async () => {
    const sel = filas.filter(f => f.aplicar && f.cuotaId && importeDe(f) != null && !f.aplicada)
    if (!sel.length) { avisar("error", "No hay ninguna tildada", "Tildá al menos una fila, o usá «Tildar todas las que se pueden»."); return }
    const conciliadas = sel.filter(f => f.estadoCuota === "conciliado").length
    const noCierran = sel.filter(f => controlDosCaminos(f.boleta.importe, f.importeMail).estado === "difiere").length
    if (!window.confirm(
      `¿Aplicar ${sel.length} boleta(s) al presupuesto?\n\n` +
      sel.map(f => `${f.lote} c${f.boleta.cuota}: ${m(f.montoTemplate)} → ${m(importeDe(f))}`
        + (vencDe(f) && vencDe(f) !== f.vencTemplate ? `   ·   vence ${fecha(f.vencTemplate)} → ${fecha(vencDe(f))}` : "")
        + (f.importeFix.trim() || f.vencFix.trim() ? "  (corregido a mano)" : "")).join("\n") +
      (conciliadas ? `\n\n⚠️ ${conciliadas} ya está(n) CONCILIADA(S): cambiarlas reescribe un pago que ya ocurrió.` : "") +
      (noCierran ? `\n\n⚠️ En ${noCierran}, el mail y el PDF NO dicen lo mismo.` : "")
    )) return

    setAplicando(true)
    try {
      for (const f of sel) {
        const importe = importeDe(f)!
        const venc = vencDe(f)
        // Se escriben SOLO el monto y la fecha de vencimiento de esa cuota. Nada más del template
        // se toca — y `fecha_estimada` **no**: ésa mueve la proyección del Cash Flow y no es lo que
        // dice la boleta. Si hay que correrla, se hace desde Egresos sin Factura (→ A-FEAT-110).
        const cambios: Record<string, unknown> = { monto: importe }
        if (venc) cambios.fecha_vencimiento = venc
        const { error } = await supabase.from("cuotas_egresos_sin_factura")
          .update(cambios).eq("id", f.cuotaId!)
        if (error) throw error

        // Y queda registrado de dónde salió: la boleta guarda su propio dato, aparte.
        await supabase.from("boletas_arba").upsert({
          partida: f.boleta.partida ?? (esPartida(f.objetoMail) ? f.objetoMail : null),
          anio: f.boleta.anio ?? new Date().getFullYear(),
          cuota: f.boleta.cuota ?? "?", impuesto: f.boleta.impuesto,
          importe, importe_anual: f.boleta.importeAnual,
          vencimiento: venc, valuacion_fiscal: f.boleta.valuacionFiscal,
          base_imponible: f.boleta.baseImponible,
          codigo_pago_electronico: f.boleta.codigoPagoElectronico,
          // 🔁 Los dos caminos se guardan SEPARADOS. Fundirlos en uno perdería justamente el control.
          importe_mail: f.importeMail, objeto_mail: f.objetoMail,
          archivo_nombre: f.archivo, egreso_id: f.egresoId, cuota_id: f.cuotaId,
          // 🐾 La huella: qué leyó el parser y qué puso el usuario. Sirve para preguntarle después
          // al importador qué campo se corrige más y si un cambio lo mejoró o lo empeoró.
          correcciones: huellaBoleta(
            { importe: f.boleta.importe, partida: f.boleta.partida, vencimiento: f.boleta.vencimiento },
            { importe, partida: f.boleta.partida ?? f.objetoMail, vencimiento: venc },
          ),
          aplicada: true, aplicada_at: new Date().toISOString(), origen: "pdf",
        }, { onConflict: "partida,anio,cuota,impuesto" })
      }
      setFilas(fs => fs.map(x => sel.includes(x)
        ? { ...x, aplicada: true, aplicar: false, cambia: [], montoTemplate: importeDe(x), vencTemplate: vencDe(x) ?? x.vencTemplate }
        : x))
      avisar("ok", `${sel.length} cuota(s) actualizada(s)`,
        "Se escribieron el importe y la fecha de vencimiento.\n\n"
        + "Verificá en Egresos sin Factura → el template de esa partida.")
    } catch (e) {
      avisar("error", "No se pudo aplicar", (e as Error).message
        + "\n\nNo se escribió nada de lo que faltaba: revisá y volvé a intentar.")
    } finally { setAplicando(false) }
  }

  const pendientes = filas.filter(f => f.aplicar).length
  const difDe = (f: Comparacion) => {
    const i = importeDe(f)
    return f.montoTemplate != null && i != null ? i - f.montoTemplate : null
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}
        className="border-amber-400 text-amber-800">🏛️ Boletas ARBA</Button>

      <Dialog open={abierto} onOpenChange={o => { if (!o) setAbierto(false) }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>🏛️ Boletas de ARBA — comparar y decidir</DialogTitle>
          </DialogHeader>

          {/* 🔴 EL AVISO QUEDA. No se borra solo: el proceso tarda hasta 45 s y el usuario se va a
              hacer otra cosa — justo el mensaje que más hace falta es el que nadie está mirando
              cuando termina. Lleva la HORA para saber si es de esta corrida o de la anterior, y el
              detalle largo se abre con un click en vez de ocupar media pantalla siempre. */}
          {aviso && (
            <div className={`rounded border px-3 py-2 text-[11px] leading-4 ${ESTILO_AVISO[aviso.tipo]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">
                  {ICONO_AVISO[aviso.tipo]} {aviso.titulo}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums opacity-60">{aviso.hora}</span>
                  <button type="button" className="opacity-60 hover:opacity-100"
                    title="Cerrar el aviso" onClick={() => setAviso(null)}>✕</button>
                </div>
              </div>
              {aviso.detalle && (
                <>
                  <button type="button" className="mt-1 underline underline-offset-2 opacity-80 hover:opacity-100"
                    onClick={() => setAvisoAbierto(v => !v)}>
                    {avisoAbierto ? "ocultar el detalle" : "ver el detalle"}
                  </button>
                  {avisoAbierto && (
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white/60 p-2 text-[10px] leading-4">
                      {aviso.detalle}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}

          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-900">
            Subí los PDFs de las boletas. Se comparan contra <b>el template activo</b> de esa partida y
            vos decidís cuál aplicar. <b>Nada se cambia hasta que lo confirmes.</b>
          </div>

          <div className="rounded border p-2">
            <div className="mb-2 text-xs font-medium">1 · Traer las boletas del mail</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={bajando}
                onClick={() => bajarDelMail(true)}>
                {bajando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                👁 Ver qué hay (no baja nada)
              </Button>
              <Button size="sm" disabled={bajando} onClick={() => bajarDelMail(false)}>
                ⬇ Bajar y archivar
              </Button>
              <label className="flex items-center gap-1 text-[10px] text-gray-600">
                últimos
                <Input type="text" value={dias} onChange={e => setDias(e.target.value.replace(/\D/g, ""))}
                  className="h-6 w-12 text-center text-[11px] tabular-nums" />
                días
              </label>
              <span className="text-[10px] text-gray-500">
                Busca en el mail de ARBA y archiva los PDFs en Drive. No toca ningún template.
                <br />Si no entra todo en una pasada, <b>sigue solo</b> hasta terminar. No borres lo
                ya archivado: lo que está no se vuelve a bajar.
              </span>
            </div>
            {/* 🗣️ EL INFORME, en el idioma del usuario: qué campo, de qué empresa, por cuánta plata.
                Los nombres de archivo y las cuentas de links quedan abajo, en el detalle técnico. */}
            {/* 🗣️ EL INFORME, con NUESTRO REGISTRO como eje. Pedido del usuario (08/09):
                «que la app nos diga en función de nuestro registro, no mezcle cosas. MSA todas las
                partidas, complementario, alerta si alguna no llegó o llegó alguna de más. Ídem PAM,
                MA. Rápidamente ver si tenemos todo o falta algo. Luego viene: tales vinieron
                también para PAM».
                Por eso se parte de los templates activos y se marca qué llegó — al revés de listar
                lo que vino, que no puede avisar de lo que falta. */}
            {informe && informe.bloques.length > 0 && (
              <div className="mt-2 rounded border bg-white">
                <div className="flex items-baseline justify-between border-b bg-gray-50 px-2 py-1 text-[11px] font-medium">
                  <span>
                    {informe.totalFaltan === 0
                      ? "✓ Están todas las boletas de nuestro registro"
                      : `⚠ Faltan ${informe.totalFaltan} boleta(s)`}
                  </span>
                  <span className="tabular-nums">{m(informe.total)}</span>
                </div>

                <div className="max-h-80 overflow-auto">
                  {informe.bloques.map(b => (
                    <div key={b.empresa} className="border-b last:border-b-0">
                      <div className={`flex items-baseline justify-between px-2 py-1 text-[10px] font-medium
                        ${b.completo ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>
                        <span>{b.completo ? "✓" : "⚠"} {b.empresa} — {b.llegaron} de {b.esperadas}</span>
                        <span className="tabular-nums">{m(b.total)}</span>
                      </div>
                      {b.filas.map((f, i) => (
                        <div key={i} className={`flex items-baseline justify-between gap-2 px-2 py-0.5 text-[11px]
                          ${f.llego ? "" : "bg-rose-50 font-medium text-rose-800"}`}>
                          <span>
                            {f.llego ? "" : "✗ NO LLEGÓ · "}{f.nombre}
                            {f.vinoEnOtra && (
                              <span className="ml-1 text-[9px] text-blue-700">vino en el mail de {f.vinoEnOtra}</span>
                            )}
                            {f.duplicadaEn.length > 1 && (
                              <span className="ml-1 text-[9px] text-blue-700">
                                duplicada ({f.duplicadaEn.join(" y ")})
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums">{f.llego ? m(f.importe) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* «Llegó alguna de más»: no es nuestra o le falta el template. Nunca se descarta. */}
                {informe.deMas.length > 0 && (
                  <div className="border-t bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-900">
                    <b>Llegaron {informe.deMas.length} que no están en nuestro registro:</b>
                    {informe.deMas.map((l, i) => (
                      <div key={i}>· {l.objeto} — {m(l.importe)} (vino en el mail de {l.vinoEn})</div>
                    ))}
                  </div>
                )}

                {/* «Tales vinieron también para PAM». */}
                {informe.cruzadas.length > 0 && (
                  <div className="border-t bg-blue-50 px-2 py-1.5 text-[10px] leading-4 text-blue-900">
                    <b>Vinieron también en el mail de otra empresa:</b>
                    {informe.cruzadas.map((c, i) => (
                      <div key={i}>· {c.nombre} (de {c.duena}) — también en el mail de {c.vinoEn.join(" y ")}</div>
                    ))}
                  </div>
                )}

                {informe.pie.length > 0 && (
                  <div className="border-t px-2 py-1.5 text-[10px] leading-4 text-gray-600">
                    {informe.pie.map((p, i) => <div key={i}>{p}</div>)}
                  </div>
                )}
              </div>
            )}

            {delMail && (
              <div className="mt-2 rounded bg-gray-50 px-2 py-1.5 text-[11px]">
                <div className="font-medium">{delMail.resumen}</div>
                {delMail.bajadas.map((b, i) => (
                  <div key={i} className="text-[10px] text-gray-600">
                    · {b.carpeta && <span className="text-gray-400">{b.carpeta}/</span>}{b.archivo}
                    {b.url && <> — <a href={b.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">ver</a></>}
                  </div>
                ))}
                {delMail.ya_estaban.length > 0 && (
                  <div className="mt-1 text-[10px] text-gray-500">
                    {delMail.ya_estaban.length} ya estaban archivadas (no se duplicaron).
                  </div>
                )}
                {(delMail.descuadres ?? []).length > 0 && (
                  <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800">
                    ⚠ La tabla del mail y los links de descarga no coinciden. Uno de los dos se leyó mal:
                    {(delMail.descuadres ?? []).map((x, i) => <div key={i}>· {x.asunto}: {x.detalle}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded border p-2">
            <div className="mb-1 text-xs font-medium">
              2 · Leer los PDFs para comparar
              <span className="ml-2 font-normal text-gray-400">
                subilos de Drive o de donde los tengas
              </span>
            </div>
          <div className="flex items-center gap-2">
            <Input type="file" accept="application/pdf" multiple disabled={leyendo}
              onChange={e => { if (e.target.files?.length) subir(e.target.files) }} />
            {leyendo && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
            {filas.length > 0 && <Button variant="ghost" size="sm" onClick={() => setFilas([])}>Limpiar</Button>}
          </div>
          </div>

          {filas.length > 0 && (
            <>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-[10px] text-gray-600">
                    <tr>
                      <th className="w-8 px-2 py-1"></th>
                      <th className="px-2 py-1 text-left">Lote / partida</th>
                      <th className="px-2 py-1 text-left">Cuota</th>
                      <th className="px-2 py-1 text-right">Template</th>
                      <th className="px-2 py-1 text-right">Según el mail</th>
                      <th className="px-2 py-1 text-right">Boleta (PDF)</th>
                      <th className="px-2 py-1 text-right">Diferencia</th>
                      <th className="px-2 py-1 text-left">Vence</th>
                      <th className="px-2 py-1 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      const d = difDe(f)
                      const ctrl = controlDosCaminos(f.boleta.importe, f.importeMail)
                      return (
                        <tr key={i} className={`border-t ${f.aplicada ? "bg-emerald-50" : f.problema ? "bg-amber-50" : ""}`}>
                          <td className="px-2 py-1 text-center">
                            <input type="checkbox" disabled={!f.cuotaId || f.aplicada || importeDe(f) == null}
                              checked={f.aplicar}
                              onChange={e => setFilas(fs => fs.map((x, j) => j === i ? { ...x, aplicar: e.target.checked } : x))} />
                          </td>
                          <td className="px-2 py-1">
                            <div className="font-medium">{f.lote ?? f.archivo}</div>
                            <div className="text-[10px] text-gray-500">{f.boleta.partida ?? "sin partida"}</div>
                          </td>
                          <td className="px-2 py-1">
                            {f.boleta.cuota ?? "?"}
                            {f.boleta.vencimiento && <div className="text-[10px] text-gray-500">vence {f.boleta.vencimiento.split("-").reverse().join("/")}</div>}
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums">{m(f.montoTemplate)}</td>
                          {/* 🔁 El SEGUNDO camino al mismo número. Si los dos coinciden, un ✓ discreto;
                              si no, se ve — y no se elige ninguno en silencio. */}
                          <td className="px-2 py-1 text-right tabular-nums">
                            <div className={ctrl.estado === "difiere" ? "font-medium text-rose-700" : ""}>{m(f.importeMail)}</div>
                            <div className={`text-[9px] ${ctrl.estado === "difiere" ? "text-rose-700" : "text-gray-400"}`}>
                              {ctrl.estado === "coincide" ? "✓ igual al PDF"
                                : ctrl.estado === "difiere" ? `⚠ ${m(Math.abs(ctrl.diferencia ?? 0))} de diferencia`
                                : ctrl.estado === "sin_pdf" && f.importeMail != null ? "el PDF no dio importe"
                                : "no vino del mail"}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-right">
                            {/* 🔴 Editable: es el número que alimenta la plata (§ Importar un documento). */}
                            <Input type="text" disabled={f.aplicada}
                              className="h-6 w-28 text-right text-[11px] tabular-nums"
                              placeholder={f.boleta.importe != null
                                ? f.boleta.importe.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                : "escribilo"}
                              value={f.importeFix}
                              onChange={e => setFilas(fs => fs.map((x, j) => {
                                if (j !== i) return x
                                const y = { ...x, importeFix: e.target.value }
                                // Corregir el importe REHACE la propuesta: si con el número nuevo ya
                                // coincide con el template, deja de proponerse (§ las cuentas se
                                // rehacen solas, corregir no puede obligar a rehacer).
                                if (y.montoTemplate != null && y.estadoCuota) {
                                  const iv = importeDe(y)
                                  y.aplicar = iv != null && Math.abs(iv - y.montoTemplate) > 1 && y.estadoCuota !== "conciliado"
                                }
                                return y
                              }))} />
                            {f.importeFix.trim() && f.boleta.importe != null && (
                              <div className="text-[9px] text-gray-400">el PDF decía {m(f.boleta.importe)}</div>
                            )}
                          </td>
                          <td className={`px-2 py-1 text-right tabular-nums ${d == null || Math.abs(d) <= 1 ? "text-gray-400" : d > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                            {d == null ? "—" : Math.abs(d) <= 1 ? "coincide" : (d > 0 ? "+" : "−") + m(Math.abs(d)).slice(1)}
                          </td>
                          {/* 🔴 La fecha de vencimiento se aplica igual que el monto: pedido explícito
                              del usuario («montos y fechas de venc»). Editable, como todo lo leído. */}
                          <td className="px-2 py-1">
                            <Input type="date" disabled={f.aplicada}
                              className="h-6 w-32 text-[11px]"
                              value={f.vencFix || f.boleta.vencimiento || ""}
                              onChange={e => setFilas(fs => fs.map((x, j) => {
                                if (j !== i) return x
                                const y = { ...x, vencFix: e.target.value }
                                if (y.montoTemplate != null && y.estadoCuota && y.estadoCuota !== "conciliado") {
                                  const iv = importeDe(y), vv = vencDe(y)
                                  y.aplicar = (iv != null && Math.abs(iv - y.montoTemplate) > 1)
                                    || (!!vv && vv !== y.vencTemplate)
                                }
                                return y
                              }))} />
                            <div className={`text-[9px] ${vencDe(f) && vencDe(f) !== f.vencTemplate ? "text-rose-700" : "text-gray-400"}`}>
                              {f.vencTemplate
                                ? (vencDe(f) === f.vencTemplate ? "= al template" : `el template dice ${fecha(f.vencTemplate)}`)
                                : "el template no tenía fecha"}
                            </div>
                          </td>
                          <td className="px-2 py-1 text-[10px]">
                            {f.aplicada ? <span className="font-medium text-emerald-700">✓ aplicada</span>
                              : f.problema ? <span className="text-amber-800">⚠ {f.problema}</span>
                              : <>
                                  <div className="text-gray-500">{f.estadoCuota}</div>
                                  {f.cambia.length > 0 && (
                                    <div className="text-blue-700">cambia {f.cambia.join(" y ")}</div>
                                  )}
                                </>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filas.some(f => f.boleta.avisos.length) && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-800">
                  {filas.filter(f => f.boleta.avisos.length).map((f, i) => (
                    <div key={i}><b>{f.archivo}:</b> {f.boleta.avisos.join(" · ")}</div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button type="button" className="text-[11px] text-blue-700 underline"
                  onClick={() => setFilas(fs => fs.map(x =>
                    x.cuotaId && !x.aplicada && importeDe(x) != null ? { ...x, aplicar: true } : x))}>
                  Tildar todas las que se pueden
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">{pendientes} tildada(s)</span>
                  <Button onClick={aplicar} disabled={aplicando || pendientes === 0}>
                    {aplicando && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                    Aplicar al presupuesto
                  </Button>
                </div>
              </div>

              <p className="text-[10px] leading-4 text-muted-foreground">
                Se tildan solas las que <b>difieren</b> y todavía <b>no están conciliadas</b>. Una cuota
                conciliada ya se pagó por ese importe: cambiarla reescribe el pasado, así que ésas quedan
                sin tildar y con un aviso — se pueden tildar a mano si de verdad hace falta.
                <br />
                El importe de la boleta <b>se puede corregir</b>: escribí encima y las cuentas se rehacen
                solas. Queda guardado lo que leyó el sistema junto a lo que pusiste vos, para poder
                arreglar el lector. Y <b>«Según el mail»</b> es el mismo importe leído por otro lado — si
                los dos no coinciden, algo se leyó mal y lo vas a ver acá.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
