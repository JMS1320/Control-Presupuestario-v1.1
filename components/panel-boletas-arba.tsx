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

import { useEffect, useRef, useState } from "react"
import { IconoDestinoArchivo, useDestinoArchivo } from "@/components/destino-archivo"
import { hoyArgentina } from "@/lib/fechas"
import { supabase } from "@/lib/supabase"
import { parsearBoletaArba, type BoletaArba } from "@/lib/arba/parsear-boleta"
import { decidirAplicar, controlDosCaminos, huellaBoleta, aMonto } from "@/lib/arba/casar-boleta"
import { armarInforme, esPartida, EMPRESA_POR_CUIT, type Informe, type TablaMail, type ResGas, type TemplateArba } from "@/lib/arba/informe-boletas"
import { anotarResultado } from "@/lib/cinta-diagnostico"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"
import { PlanillaBoletasArba } from "@/components/planilla-boletas-arba"
import { DATOS_FISCALES } from "@/lib/empresas"
import { nombreCorto, pedidoDeOrden } from "@/lib/arba/ordenar-archivo"
import { claveBoleta, esPartidaArba, partidaDeClave, PREFIJO_COMPLEMENTARIO, PREFIJO_SIN_ASIGNAR, type Decision as DecisionPlanilla } from "@/lib/arba/planilla-boletas"
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
  /** 🗂️ A-FEAT-1565: la partida que el usuario le asignó a una boleta «Sin asignar» (la del template elegido). */
  partidaAsignada?: string | null
}

/** 💾 A-FEAT-1565: la clave con que se guarda la boleta (la partida real, o una provisoria). */
const claveDe = (f: Comparacion) => claveBoleta({
  partidaPdf: f.boleta.partida, objetoMail: f.objetoMail, partidaAsignada: f.partidaAsignada ?? null,
  complementario: f.boleta.impuesto === "complementario", egresoId: f.egresoId, archivo: f.archivo,
})

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
// (vive en `lib/arba/ordenar-archivo.ts`: lo usa también el ordenar del Drive, A-FEAT-1567)

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
    // 05/11: sólo partidas con formato de ARBA — el «ABL Libertad» guarda ahí su cuenta municipal (1005392-00) y el informe
    // lo daba como «NO LLEGÓ» entre las boletas de ARBA.
    .filter(e => e.responsable && (esPartidaArba(e.partida_arba) || /complementario/i.test(e.nombre_referencia)))
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
  /** 🗂️ A-FEAT-1565: la planilla por responsable, con la historia de cada partida. */
  const [verPlanilla, setVerPlanilla] = useState(false)
  /** Las filas de ESTE momento, para leerlas desde funciones que se armaron en otro render. */
  const filasRef = useRef<Comparacion[]>([])
  filasRef.current = filas
  type InfoArchivo = { objeto: string | null; importe: number | null; url: string | null; carpeta: string | null; file_id?: string | null; contribuyente?: string | null }
  const [bajando, setBajando] = useState(false)
  /** Cuántos días de mail mirar. Achicarlo es lo primero que hay que probar si la bajada no llega. */
  const [dias, setDias] = useState("60")
  /**
   * 🗂️ **La carpeta de Drive donde archivar** — ⚠️ cambió 31/10 (A-FEAT-1442 / A-BUG-1446): hasta acá se pegaba el link
   * y se recordaba en el NAVEGADOR, y además el GAS nunca la recibía (archivaba siempre en «Boletas ARBA»). Ahora vive
   * en `public.archivo_destinos` (clave `arba_inmobiliario`), se escribe como se ve en la PC, se guarda por id (si se
   * mueve, se sigue encontrando) y adentro va la carpeta del AÑO. Sin carpeta, el ícono rojo: «Bajar» queda pendiente
   * y se hace solo apenas se dice dónde.
   */
  const { destino, setDestino } = useDestinoArchivo("arba_inmobiliario")
  const anioArchivo = Number(hoyArgentina().slice(0, 4))
  const [bajarPendiente, setBajarPendiente] = useState(false)
  /** Dónde archivó realmente la última corrida. Lo informa el GAS; vacío = GAS viejo. */
  const [carpetaUsada, setCarpetaUsada] = useState<{ id: string; nombre: string } | null>(null)
  const [informe, setInforme] = useState<Informe | null>(null)
  /** Cuántas pasadas hizo falta. Se muestra sólo cuando fue más de una. */
  const [pasadas, setPasadas] = useState(0)
  type Bajada = { archivo: string; carpeta?: string; url?: string; file_id?: string; objeto_mail?: string | null; importe_mail?: number | null; contribuyente?: string | null }
  const [delMail, setDelMail] = useState<{ resumen: string; bajadas: Bajada[]; ya_estaban: Bajada[]; descuadres?: { asunto: string; detalle: string }[] } | null>(null)
  /**
   * Lo que dijo el MAIL, por nombre de archivo. Se llena al bajar y se usa cuando después subís
   * esos mismos PDFs: ahí es donde los dos caminos se encuentran y se pueden comparar.
   */
  /**
   * Lo que se sabe de cada archivo bajado: lo que dijo el MAIL (para cruzarlo con el PDF) y **el
   * link de Drive**, que es lo que permite abrir la boleta desde la app para verificar el importe.
   */
  const [mailPorArchivo, setMailPorArchivo] = useState<Record<string, {
    objeto: string | null; importe: number | null; url: string | null; carpeta: string | null; file_id?: string | null; contribuyente?: string | null
  }>>({})
  const mailRef = useRef(mailPorArchivo)
  mailRef.current = mailPorArchivo

  /**
   * 💾 A-FEAT-1565 — cada boleta leída queda GUARDADA como propuesta (`boletas_arba.aplicada = false`), así al volver
   * se ve el estado de situación sin subir ni leer nada de nuevo. Nunca pisa una ya aplicada.
   */
  const guardarPropuestas = async (rows: Comparacion[], extra: Record<string, InfoArchivo> = {}) => {
    const info = { ...mailRef.current, ...extra }
    const anio = anioArchivo
    const { data: aplicadas } = await supabase.from("boletas_arba").select("partida, anio, cuota, impuesto").eq("aplicada", true)
    const yaAplicada = new Set((aplicadas ?? []).map((x: { partida: string; anio: number; cuota: string; impuesto: string }) => `${x.partida}|${x.anio}|${x.cuota}|${x.impuesto}`))
    const payload = rows.filter(f => !f.aplicada).map(f => ({
      partida: claveDe(f), anio: f.boleta.anio ?? anio, cuota: f.boleta.cuota ?? "?", impuesto: f.boleta.impuesto,
      importe: f.boleta.importe, importe_anual: f.boleta.importeAnual, vencimiento: f.boleta.vencimiento,
      valuacion_fiscal: f.boleta.valuacionFiscal, base_imponible: f.boleta.baseImponible, codigo_pago_electronico: f.boleta.codigoPagoElectronico,
      importe_mail: f.importeMail, objeto_mail: f.objetoMail, archivo_nombre: f.archivo,
      archivo_url: info[f.archivo]?.url ?? null, archivo_file_id: info[f.archivo]?.file_id ?? null,
      egreso_id: f.egresoId, cuota_id: f.cuotaId, aplicada: false, origen: "pdf", observaciones: "propuesta (A-FEAT-1565)",
    })).filter(x => !yaAplicada.has(`${x.partida}|${x.anio}|${x.cuota}|${x.impuesto}`))
    if (!payload.length) return
    // 🐞 05/11: la misma boleta en DOS archivos (ARBA la manda en dos mails: 5 de 26 en la cuota 4) daba dos filas con la
    // misma clave en un solo upsert, y la base rechaza el lote ENTERO. Se guarda una por clave.
    const unicas = [...new Map(payload.map(x => [`${x.partida}|${x.anio}|${x.cuota}|${x.impuesto}`, x])).values()]
    const { error } = await supabase.from("boletas_arba").upsert(unicas, { onConflict: "partida,anio,cuota,impuesto" })
    if (error) { toast.error("No se pudo guardar la propuesta: " + error.message); return }
    // Si una boleta ya tiene su template, se borra su propuesta PROVISORIA (la que se guardó por nombre de archivo antes de
    // saber de quién era) — sólo si no está aplicada.
    for (const x of unicas) {
      if (!x.egreso_id || !x.archivo_nombre) continue
      for (const prov of [PREFIJO_COMPLEMENTARIO + x.archivo_nombre, PREFIJO_SIN_ASIGNAR + x.archivo_nombre]) {
        if (prov !== x.partida) await supabase.from("boletas_arba").delete().eq("partida", prov).eq("aplicada", false)
      }
    }
  }

  /**
   * 💾 A-FEAT-1565 — al abrir: el ESTADO DE SITUACIÓN con lo ya guardado (propuestas y aplicadas del año), sin subir nada.
   * Cada una se vuelve a casar con su cuota (por si la cuota cambió desde entonces).
   */
  const cargarGuardadas = async () => {
    const { data, error } = await supabase.from("boletas_arba").select("*").eq("anio", anioArchivo)
    if (error || !data?.length) return 0
    type Fila = { partida: string; anio: number; cuota: string; impuesto: "inmobiliario" | "complementario"; importe: number | null; importe_anual: number | null
      vencimiento: string | null; valuacion_fiscal: number | null; base_imponible: number | null; codigo_pago_electronico: string | null
      importe_mail: number | null; objeto_mail: string | null; archivo_nombre: string | null; archivo_url: string | null; archivo_file_id: string | null
      egreso_id: string | null; cuota_id: string | null; aplicada: boolean }
    const rows: Comparacion[] = []
    const mails: typeof mailPorArchivo = {}
    for (const r of data as Fila[]) {
      const archivo = r.archivo_nombre ?? r.partida
      const boleta: BoletaArba = {
        partida: partidaDeClave(r.partida), cuota: r.cuota, anio: r.anio, impuesto: r.impuesto,
        importe: r.importe == null ? null : Number(r.importe), importeAnual: r.importe_anual == null ? null : Number(r.importe_anual),
        vencimiento: r.vencimiento, proximoVencimiento: null, valuacionFiscal: r.valuacion_fiscal == null ? null : Number(r.valuacion_fiscal),
        baseImponible: r.base_imponible == null ? null : Number(r.base_imponible), codigoPagoElectronico: r.codigo_pago_electronico, texto: "", avisos: [],
      }
      const fila: Comparacion = {
        archivo, boleta, lote: null, egresoId: r.egreso_id, cuotaId: null, montoTemplate: null, vencTemplate: null, estadoCuota: null, cambia: [],
        aplicar: false, aplicada: r.aplicada, problema: r.egreso_id ? null : (r.partida.startsWith(PREFIJO_SIN_ASIGNAR) ? "sin partida reconocida: asignala en la planilla" : null),
        importeMail: r.importe_mail == null ? null : Number(r.importe_mail), objetoMail: r.objeto_mail, importeFix: "", vencFix: "",
        partidaAsignada: partidaDeClave(r.partida),
      }
      if (r.egreso_id) {
        const { data: eg } = await supabase.from("egresos_sin_factura").select("nombre_referencia").eq("id", r.egreso_id).single()
        fila.lote = (eg as { nombre_referencia?: string } | null)?.nombre_referencia ?? null
        await casarCuota(fila, r.egreso_id, boleta)
        if (r.aplicada) { fila.aplicada = true; fila.aplicar = false }
      }
      rows.push(fila)
      mails[archivo] = { objeto: r.objeto_mail, importe: fila.importeMail, url: r.archivo_url, carpeta: null, file_id: r.archivo_file_id }
    }
    setMailPorArchivo(prev => ({ ...mails, ...prev }))
    setFilas(rows)
    return rows.length
  }
  useEffect(() => {
    if (!abierto || filas.length) return
    void (async () => {
      const n = await cargarGuardadas()
      if (n) {
        avisar("info", `${n} boleta(s) de ${anioArchivo} ya leídas`, "Es lo guardado de antes: propuestas sin aplicar y las ya aplicadas. No hace falta volver a subir ni leer nada.")
        setVerPlanilla(true)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  /** 📥 A-FEAT-1565 — leer las boletas ya archivadas en el Drive, sin subirlas (GAS 0.21.0: el PDF tal cual). */
  const leerDelDrive = async (lista: { archivo: string; file_id: string }[], extra: Record<string, InfoArchivo> = {}) => {
    if (!lista.length) { avisar("info", "No hay boletas archivadas para leer", "Primero «Bajar y archivar»."); return }
    setLeyendo(true)
    const items: { nombre: string; datos: ArrayBuffer }[] = []
    const fallas: string[] = []
    try {
      for (let i = 0; i < lista.length; i += 3) {
        await Promise.all(lista.slice(i, i + 3).map(async x => {
          try {
            const r = await fetch("/api/gas/leer-archivo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_id: x.file_id, bytes: true }) })
            const j = await r.json()
            if (!j.ok || !j.b64) { fallas.push(`${x.archivo}: ${j.error ?? "sin contenido"}`); return }
            const bin = atob(j.b64); const u8 = new Uint8Array(bin.length)
            for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k)
            // 🔎 05/11: las 26 primeras leídas del Drive salieron vacías. Si lo que llegó no es un PDF, se dice QUÉ llegó.
            if (bin.slice(0, 4) !== "%PDF") { fallas.push(`${x.archivo}: no llegó un PDF (${j.tipo ?? "sin tipo"}, ${u8.length} bytes, empieza «${bin.slice(0, 30).replace(/[^ -~]/g, "·")}»)`); return }
            items.push({ nombre: x.archivo, datos: u8.buffer })
          } catch (e) { fallas.push(`${x.archivo}: ${(e as Error).message}`) }
        }))
      }
    } finally { setLeyendo(false) }
    // Primero se procesa lo que llegó y DESPUÉS se avisa lo que falló (el cartel es uno solo: al revés, el «ok» lo tapaba)
    if (items.length) await procesarPdfs(items, extra)
    if (fallas.length) avisar("error", `${fallas.length} no se pudieron leer del Drive`, fallas.join("\n"))
  }

  const subir = async (archivos: FileList) => {
    await procesarPdfs(await Promise.all(Array.from(archivos).map(async f => ({ nombre: f.name, datos: await f.arrayBuffer() }))))
  }

  const procesarPdfs = async (items: { nombre: string; datos: ArrayBuffer }[], extra: Record<string, InfoArchivo> = {}) => {
    const info = { ...mailRef.current, ...extra }
    setLeyendo(true)
    const nuevas: Comparacion[] = []
    try {
      for (const f of items) {
        const boleta = await parsearBoletaArba(f.datos)
        const delMailEste = info[f.nombre]
        const fila: Comparacion = {
          archivo: f.nombre, boleta, lote: null, egresoId: null, cuotaId: null,
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
            .select("id, nombre_referencia, activo, responsable")
            .ilike("nombre_referencia", "%Complementario%").eq("activo", true)
          let cands = (egs ?? []) as { id: string; nombre_referencia: string; responsable: string | null }[]
          // 05/11: el mail trae el CUIT del complementario («Objeto imponible»): con eso se sabe de qué empresa es
          // y no hace falta que el usuario elija entre el de MSA y el de PAM.
          const cuitMail = String(fila.objetoMail ?? "").replace(/\D/g, "")
          const empresaMail = cuitMail ? (Object.entries(DATOS_FISCALES).find(([, d]) => d.cuit === cuitMail)?.[0] ?? null) : null
          if (cands.length > 1 && empresaMail) {
            const deEsa = cands.filter(c => c.responsable === empresaMail)
            if (deEsa.length === 1) cands = deEsa
          }
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

      // Una boleta leída de nuevo reemplaza a la anterior del mismo archivo (no se duplica)
      setFilas(f => [...f.filter(x => !nuevas.some(n => n.archivo === x.archivo)), ...nuevas])
      // 🛑 05/11: una boleta de la que no se leyó NADA no se guarda como propuesta (quedaban 26 vacías, sin cuota ni
      // importe, que después no se reemplazaban). Se avisa con el motivo del lector.
      const vacias = nuevas.filter(n => !n.boleta.texto.trim())
      await guardarPropuestas(nuevas.filter(n => n.boleta.texto.trim()), extra)
      if (vacias.length) {
        avisar("error", `${vacias.length} de ${nuevas.length} PDF no se pudieron leer — ésas no se guardaron`,
          vacias.slice(0, 8).map(n => `${n.archivo}: ${n.boleta.avisos.join(" · ") || "sin texto"}`).join("\n"))
        return
      }
      avisar("ok", `${nuevas.length} boleta(s) leída(s) y guardadas como propuesta`, `${conPartida} con partida · ${casadas} casada(s) con su cuota del template.` + (nuevas.length - casadas > 0 ? `

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
      const acumYaEstaban: Bajada[] = []

      while (pasada < TOPE_PASADAS) {
        pasada++
        const r = await fetch("/api/gas/boletas-arba", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            solo_contar: soloContar, dias: Number(dias) || undefined,
            partidas, empresa_por_cuit: EMPRESA_POR_CUIT,
            // La carpeta elegida (por id) y el año: adentro se usa o se crea la carpeta del año (A-FEAT-1442)
            carpeta_id: destino?.drive_folder_id || undefined, anio: anioArchivo,
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
        acumYaEstaban.push(...((j.ya_estaban ?? []) as Bajada[]))

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

      /**
       * 🧮 **¿Dónde quedaron de verdad?** — el control de que el campo «carpeta» llegó.
       *
       * El GAS **se despliega aparte** (corre en la cuenta Google del usuario), así que la app puede
       * estar actualizada y el GAS no. Un GAS viejo **ignora `carpeta_id` y archiva en la de siempre,
       * sin fallar**: se vería «40 archivadas» y estarían en otro lado — y como el dedup es por
       * nombre, la corrida siguiente creería que ya están.
       *
       * Por eso el GAS ahora devuelve `carpeta_usada`. Si vuelve vacío, el desplegado es anterior.
       */
      if (!soloContar) {
        const usada = (j as { carpeta_usada?: { id?: string; nombre?: string } | null }).carpeta_usada
        if (!usada?.id) {
          toast.warning(
            "El GAS no informó en qué carpeta archivó. Es una versión anterior: el campo «carpeta» "
            + "no se está usando y los PDF fueron a la de siempre. Volvé a subir el GAS (clasp push).",
            { duration: 12000 },
          )
        } else {
          setCarpetaUsada(usada as { id: string; nombre: string })
          // Se compara contra la carpeta ELEGIDA (la del año va adentro y tiene otro id)
          const base = (j as { carpeta_base?: { id?: string } | null }).carpeta_base
          const pedida = destino?.drive_folder_id ?? ""
          const coincide = !pedida || base?.id === pedida || usada.id === pedida
          if (!coincide) {
            toast.warning(
              `Se archivó en «${usada.nombre}», que no es la carpeta que pediste. Revisá el link.`,
              { duration: 12000 },
            )
          }
        }
      }
      // Se guarda lo que dijo el mail para poder cruzarlo cuando se suban los PDFs (A-FEAT-107).
      /**
       * 🔗 **También se guarda el LINK de Drive**, no sólo lo que dijo el mail.
       *
       * Pedido del usuario 2026-09-30: *«ya deben quedar linkeadas para verlas desde la app»*. El
       * GAS lo venía devolviendo desde siempre (`b.url`) y la pantalla **lo mostraba en la lista de
       * la bajada y lo tiraba**: al aplicar la boleta no quedaba forma de volver al PDF.
       *
       * 🔑 Y es lo que hace posible su circuito: *«importaría desde mail, quedaría guardado y
       * linkeado para ver las boletas si tengo dudas y chequear que haya tomado bien los montos»*.
       * Sin el link, para verificar un importe hay que salir a buscar el archivo en el Drive.
       */
      const idx: Record<string, InfoArchivo> = {}
      // 🔗 05/11: lo que YA estaba archivado también trae su link y lo del mail (GAS nuevo) — se suma igual que una bajada,
      // así «Aplicar» guarda el PDF aunque se haya bajado en otra corrida. Con un GAS viejo vienen sin link: no se pisa nada.
      for (const b of (j.ya_estaban ?? []) as Bajada[]) {
        if (!b.archivo || !(b as { url?: string | null }).url) continue
        idx[b.archivo] = {
          objeto: b.objeto_mail ?? null, importe: b.importe_mail ?? null,
          url: b.url ?? null, carpeta: b.carpeta ?? null, file_id: b.file_id ?? null, contribuyente: b.contribuyente ?? null,
        }
      }
      for (const b of (j.bajadas ?? []) as Bajada[]) {
        idx[b.archivo] = {
          objeto: b.objeto_mail ?? null, importe: b.importe_mail ?? null,
          url: b.url ?? null, carpeta: b.carpeta ?? null, file_id: b.file_id ?? null, contribuyente: b.contribuyente ?? null,
        }
      }
      setMailPorArchivo(prev => ({ ...prev, ...idx }))
      // 📥 A-FEAT-1565: lo archivado se LEE solo (sin subirlo) y queda guardado como propuesta — sólo lo que no está leído.
      if (!soloContar) {
        // «leída» = que se le sacó algo (una propuesta guardada vacía se vuelve a leer)
        const yaLeidas = new Set(filasRef.current.filter(f => f.boleta.importe != null || (f.boleta.cuota != null && f.boleta.cuota !== "?")).map(f => f.archivo))
        const aLeer = Object.entries(idx).filter(([a, v]) => v.file_id && !yaLeidas.has(a)).map(([a, v]) => ({ archivo: a, file_id: v.file_id! }))
        // 🗂️ A-FEAT-1567: después de leer, cada boleta con dueño conocido se ORDENA en el Drive (nombre y carpeta de JMS)
        setTimeout(async () => { if (aLeer.length) await leerDelDrive(aLeer, idx); await ordenarEnDrive(true, idx) }, 0)
      }

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

  /**
   * 🗂️ A-FEAT-1565 — asigna una boleta «Sin asignar» al template que elige el usuario en la planilla, y la casa con su
   * cuota como si se hubiera reconocido la partida.
   */
  /**
   * 🗂️ A-FEAT-1567 — ordena en el Drive las boletas ya leídas: «2026 - Inmob - Cuota 4 - Rojas.pdf» en la carpeta de su
   * responsable («MSA - viene PAM» si llegó en el mail de otra). El robot sólo renombra y mueve: nunca borra ni pisa.
   * JMS 05/11: 23 de 26 quedaban en «_Sin asignar» con el nombre del link. Las sin dueño (San Ignacio) no se tocan.
   */
  const ordenarEnDrive = async (silencioso: boolean, extra: Record<string, InfoArchivo> = {}) => {
    const info = { ...mailRef.current, ...extra }
    const ids = [...new Set(filasRef.current.map(f => f.egresoId).filter((x): x is string => !!x))]
    if (!ids.length) { if (!silencioso) avisar("info", "No hay boletas con su campo para ordenar"); return }
    const { data: tps } = await supabase.from("egresos_sin_factura").select("id, nombre_referencia, responsable").in("id", ids)
    const tpl = new Map(((tps ?? []) as { id: string; nombre_referencia: string; responsable: string | null }[]).map(t => [t.id, t]))
    const pedido = pedidoDeOrden(filasRef.current.map(f => {
      const t = f.egresoId ? tpl.get(f.egresoId) : undefined
      const cuit = info[f.archivo]?.contribuyente ?? null
      return {
        archivo: f.archivo, fileId: info[f.archivo]?.file_id ?? null, anio: f.boleta.anio, cuota: f.boleta.cuota,
        complementario: f.boleta.impuesto === "complementario", template: t?.nombre_referencia ?? null, responsable: t?.responsable ?? null,
        empresaDelMail: cuit ? (EMPRESA_POR_CUIT[cuit] ?? null) : null,
      }
    }))
    if (!pedido.length) { if (!silencioso) avisar("ok", "Todo ordenado", "Las boletas con su campo ya tienen el nombre y la carpeta de siempre."); return }
    try {
      const r = await fetch("/api/gas/ordenar-boletas", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: pedido.map(({ file_id, nombre, carpeta }) => ({ file_id, nombre, carpeta })) }) })
      const j = await r.json()
      if (!j.ok) { avisar("error", "No se pudieron ordenar en el Drive", j.error ?? ""); return }
      type Res = { file_id: string; antes?: string; nombre?: string; carpeta?: string; url?: string; error?: string }
      const res = (j.resultados ?? []) as Res[]
      const bien = res.filter(x => !x.error && x.nombre)
      const nuevoNombre = new Map(bien.map(x => [x.antes!, x]))
      // La propuesta guardada y la pantalla pasan al nombre nuevo (el link no cambia: es el mismo archivo)
      for (const x of bien) {
        await supabase.from("boletas_arba").update({ archivo_nombre: x.nombre, archivo_url: x.url ?? null }).eq("archivo_file_id", x.file_id)
      }
      setFilas(fs => fs.map(f => nuevoNombre.has(f.archivo) ? { ...f, archivo: nuevoNombre.get(f.archivo)!.nombre! } : f))
      setMailPorArchivo(prev => {
        const out = { ...prev }
        for (const x of bien) if (x.antes && out[x.antes]) { out[x.nombre!] = { ...out[x.antes], carpeta: x.carpeta ?? null, url: x.url ?? out[x.antes].url }; delete out[x.antes] }
        return out
      })
      const fallas = res.filter(x => x.error)
      avisar(fallas.length ? "error" : "ok", `${bien.length} boleta(s) ordenadas en el Drive` + (fallas.length ? ` · ${fallas.length} no` : ""),
        bien.map(x => `${x.carpeta} / ${x.nombre}`).join("\n") + (fallas.length ? "\n\nNo se pudieron:\n" + fallas.map(x => `${x.file_id}: ${x.error}`).join("\n") : ""))
    } catch (e) { avisar("error", "No se pudieron ordenar en el Drive", (e as Error).message) }
  }

  const asignarTemplate = async (idx: number, egresoId: string) => {
    const base = filas[idx]
    if (!base) return
    const { data: eg } = await supabase.from("egresos_sin_factura").select("id, nombre_referencia, partida_arba").eq("id", egresoId).single()
    const egr = eg as { nombre_referencia?: string; partida_arba?: string | null } | null
    const claveVieja = claveDe(base)
    const fila: Comparacion = { ...base, egresoId, lote: egr?.nombre_referencia ?? base.lote, problema: null, partidaAsignada: egr?.partida_arba ?? null }
    await casarCuota(fila, egresoId, fila.boleta)
    setFilas(fs => fs.map((x, i) => i === idx ? fila : x))
    // 💾 La propuesta pasa a su partida: se guarda con la nueva clave y se borra la provisoria (sólo si no está aplicada)
    await guardarPropuestas([fila])
    if (claveVieja !== claveDe(fila) && claveVieja.startsWith(PREFIJO_SIN_ASIGNAR)) {
      await supabase.from("boletas_arba").delete().eq("partida", claveVieja).eq("aplicada", false)
    }
  }

  /** 🗂️ A-FEAT-1565 — las decisiones de la planilla se vuelcan a las filas y se aplica con el aplicar de siempre. */
  const aplicarDesdePlanilla = async (decisiones: { idx: number; decision: DecisionPlanilla; otra: string }[]) => {
    const porIdx = new Map(decisiones.map(d => [d.idx, d]))
    const nuevas = filas.map((f, i) => {
      const d = porIdx.get(i)
      if (!d || f.aplicada) return f
      if (d.decision === "presupuestada") return { ...f, aplicar: false }
      return { ...f, aplicar: true, importeFix: d.decision === "otra" ? d.otra : "" }
    })
    setFilas(nuevas)
    await aplicar(nuevas)
  }

  const aplicar = async (base: Comparacion[] = filas) => {
    const sel = base.filter(f => f.aplicar && f.cuotaId && importeDe(f) != null && !f.aplicada)
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
        // Se escriben SOLO el monto y las fechas de esa cuota. Nada más del template se toca.
        // ⚠️ Cambió 05/11 (JMS: «yo nunca puse fecha de pago… si la fecha de venc pasa al 12/11 la estimada también debe
        // pasar ahí»): hasta acá `fecha_estimada` NO se tocaba (A-FEAT-110). Ahora acompaña al vencimiento de la boleta,
        // salvo que la cuota ya esté pagada o conciliada (ahí la fecha es la del pago real).
        const cambios: Record<string, unknown> = { monto: importe }
        if (venc) cambios.fecha_vencimiento = venc
        if (venc && !["pagado", "conciliado"].includes(String(f.estadoCuota ?? ""))) cambios.fecha_estimada = venc
        const { error } = await supabase.from("cuotas_egresos_sin_factura")
          .update(cambios).eq("id", f.cuotaId!)
        if (error) throw error

        // Y queda registrado de dónde salió: la boleta guarda su propio dato, aparte.
        await supabase.from("boletas_arba").upsert({
          // 💾 A-FEAT-1565: la misma clave que la propuesta (antes el complementario iba con partida null y la tabla lo rechazaba)
          partida: claveDe(f),
          anio: f.boleta.anio ?? new Date().getFullYear(),
          cuota: f.boleta.cuota ?? "?", impuesto: f.boleta.impuesto,
          importe, importe_anual: f.boleta.importeAnual,
          vencimiento: venc, valuacion_fiscal: f.boleta.valuacionFiscal,
          base_imponible: f.boleta.baseImponible,
          codigo_pago_electronico: f.boleta.codigoPagoElectronico,
          // 🔁 Los dos caminos se guardan SEPARADOS. Fundirlos en uno perdería justamente el control.
          importe_mail: f.importeMail, objeto_mail: f.objetoMail,
          archivo_nombre: f.archivo,
          // 🔗 El link al PDF en Drive, para poder abrirlo desde la app y verificar el importe.
          archivo_url: mailPorArchivo[f.archivo]?.url ?? null,
          archivo_file_id: mailPorArchivo[f.archivo]?.file_id ?? null,
          egreso_id: f.egresoId, cuota_id: f.cuotaId,
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
              <Button size="sm" disabled={bajando} variant={destino?.drive_folder_id ? "default" : "destructive"}
                title={destino?.drive_folder_id ? undefined : "Falta decir dónde se archiva: queda pendiente y se baja solo apenas elegís la carpeta"}
                onClick={() => {
                  if (!destino?.drive_folder_id) {
                    setBajarPendiente(true)
                    toast.warning("Falta la carpeta: hacé click en el 📁❗ rojo y decime dónde va. Apenas la guardes, bajo y archivo solo.", { duration: 10000 })
                    return
                  }
                  bajarDelMail(false)
                }}>
                ⬇ Bajar y archivar{bajarPendiente && !destino?.drive_folder_id ? " (pendiente: falta la carpeta)" : ""}
              </Button>
              <label className="flex items-center gap-1 text-[10px] text-gray-600">
                últimos
                <Input type="text" value={dias} onChange={e => setDias(e.target.value.replace(/\D/g, ""))}
                  className="h-6 w-12 text-center text-[11px] tabular-nums" />
                días
              </label>
              <IconoDestinoArchivo clave="arba_inmobiliario" nombre="ARBA Inmobiliario" anio={anioArchivo}
                destino={destino} setDestino={setDestino}
                onListo={() => { if (bajarPendiente) { setBajarPendiente(false); bajarDelMail(false) } }} />
              <span className="text-[10px] text-gray-500">
                Busca en el mail de ARBA y archiva los PDFs en Drive. No toca ningún template.
                {carpetaUsada && (
                  <><br />📁 La última bajada archivó en <b>{carpetaUsada.nombre}</b>.</>
                )}
                <br /><b>El nombre del archivo sale solo</b>: «2026 - Inmob - Cuota 3 - Tango Parra 1».
                Vos sólo elegís la carpeta (el 📁): adentro se usa la del año y se arman las subcarpetas
                por empresa. Si la movés en el Drive, la app la sigue encontrando.
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
                    {delMail.ya_estaban.length} ya estaban archivadas (no se bajaron de nuevo){delMail.ya_estaban.some(b => !b.url) ? " — para ver sus links hay que subir el GAS nuevo" : ""}:
                    {delMail.ya_estaban.map((b, i) => (
                      <div key={i} className="text-gray-600">
                        · {b.carpeta && <span className="text-gray-400">{b.carpeta}/</span>}{b.archivo}
                        {b.url && <> — <a href={b.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">ver</a></>}
                      </div>
                    ))}
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
            {/* 📥 A-FEAT-1565: sin subir nada — las que ya están archivadas */}
            <Button variant="outline" size="sm" disabled={leyendo}
              onClick={() => void leerDelDrive(Object.entries(mailPorArchivo).filter(([, v]) => v.file_id).map(([a, v]) => ({ archivo: a, file_id: v.file_id! })))}>
              📥 Leer las archivadas
            </Button>
            {/* 🗂️ A-FEAT-1567: nombre y carpeta de JMS en el Drive (también corre solo después de «Bajar y archivar») */}
            <Button variant="outline" size="sm" disabled={leyendo || !filas.length} onClick={() => void ordenarEnDrive(false)}
              title="Renombra y mueve cada boleta a la carpeta de su responsable, con tu convención. No borra ni pisa nada.">
              🗂️ Ordenar en el Drive
            </Button>
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
                  <Button variant="outline" onClick={() => setVerPlanilla(true)} title="Por responsable, con las cuotas anteriores y las diferencias">🗂️ Ver en la planilla</Button>
                  <Button onClick={() => void aplicar()} disabled={aplicando || pendientes === 0}>
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
      {/* 🗂️ A-FEAT-1565 */}
      <PlanillaBoletasArba
        open={verPlanilla} onOpenChange={setVerPlanilla} aplicando={aplicando}
        boletas={filas.map(f => ({
          archivo: f.archivo, egresoId: f.egresoId, cuotaId: f.cuotaId,
          cuotaNro: f.boleta.cuota && /^\d+$/.test(f.boleta.cuota) ? parseInt(f.boleta.cuota) : null,
          importe: importeDe(f), vencimiento: vencDe(f), aplicada: f.aplicada, problema: f.problema, lote: f.lote,
        }))}
        urlDe={archivo => mailPorArchivo[archivo]?.url ?? null}
        onAsignar={asignarTemplate}
        onAplicar={aplicarDesdePlanilla}
      />
    </>
  )
}
