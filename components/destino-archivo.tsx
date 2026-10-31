"use client"

/**
 * 🗂️ DÓNDE SE ARCHIVA — el ícono de la carpeta, para cualquier proceso que guarde documentos (A-FEAT-1442).
 *
 * JMS 31/10: *«si la app tiene el pdf y no sabe dónde guardarlo, algún ícono rojo que significa algo pendiente (la
 * dirección de Drive) para poder completar la tarea. Cuando lo cargo, la app ya sabe que le había quedado pendiente
 * guardarlo, así que con mi dato lo hace»*.
 *   · 🔴 sin carpeta: el ícono rojo; click → escribir la ruta como se ve en la PC (o pegar el link de Drive).
 *   · ✅ con carpeta: muestra dónde, con link. Se guarda el ID: si la carpeta se mueve, al abrir se ve la ruta nueva.
 * `onListo` se llama cuando la carpeta queda guardada: ahí el proceso que esperaba sigue solo.
 * La lógica pura está en `lib/archivo/destinos.ts`; la tabla es `public.archivo_destinos` (script 148).
 */
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { ahoraISO } from "@/lib/fechas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { estadoDestino, problemaDeRuta, type DestinoArchivo } from "@/lib/archivo/destinos"

export function useDestinoArchivo(clave: string) {
  const [destino, setDestino] = useState<DestinoArchivo | null>(null)
  const [cargado, setCargado] = useState(false)
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("archivo_destinos").select("clave, nombre, ruta, drive_folder_id, ruta_drive, por_anio").eq("clave", clave).maybeSingle()
    if (error) toast.error("No se pudo leer la carpeta de destino: " + error.message)
    setDestino((data as DestinoArchivo | null) ?? null)
    setCargado(true)
    // ¿La movieron? Se pregunta al Drive dónde está HOY y, si cambió, se actualiza lo que se muestra (el id no cambia)
    const d = data as DestinoArchivo | null
    if (d?.drive_folder_id) {
      try {
        const r = await fetch("/api/gas/carpeta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.drive_folder_id }) })
        const j = await r.json()
        if (j.ok && j.ruta_drive && j.ruta_drive !== d.ruta_drive) {
          await supabase.from("archivo_destinos").update({ ruta_drive: j.ruta_drive, updated_at: ahoraISO() }).eq("clave", clave)
          setDestino({ ...d, ruta_drive: j.ruta_drive })
          toast.info(`La carpeta de «${d.nombre}» se movió: ahora está en ${j.ruta_drive}. Se sigue usando la misma.`)
        } else if (j.ok === false) {
          toast.warning(`La carpeta de «${d.nombre}» no se encuentra en el Drive: ${j.error ?? ""}. Elegí otra.`)
          setDestino({ ...d, drive_folder_id: null })
        }
      } catch { /* sin GAS: se muestra lo guardado */ }
    }
  }, [clave])
  useEffect(() => { void cargar() }, [cargar])
  return { destino, cargado, setDestino, recargar: cargar }
}

export function IconoDestinoArchivo({ clave, nombre, anio, destino, setDestino, onListo }: {
  clave: string; nombre: string; anio?: number
  destino: DestinoArchivo | null; setDestino: (d: DestinoArchivo) => void
  onListo?: (d: DestinoArchivo) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [ruta, setRuta] = useState("")
  const [buscando, setBuscando] = useState(false)
  useEffect(() => { if (abierto) setRuta(destino?.ruta ?? "") }, [abierto, destino])
  const est = estadoDestino(destino, anio)

  const guardar = async () => {
    const problema = problemaDeRuta(ruta)
    if (problema) { toast.error(problema); return }
    setBuscando(true)
    try {
      const r = await fetch("/api/gas/carpeta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta }) })
      const j = await r.json()
      if (!j.ok) { toast.error(String(j.error ?? "No se encontró la carpeta."), { duration: 12000 }); return }
      const fila = { clave, nombre: destino?.nombre ?? nombre, ruta: ruta.trim(), drive_folder_id: String(j.id), ruta_drive: String(j.ruta_drive ?? j.nombre), por_anio: destino?.por_anio ?? true }
      const { error } = await supabase.from("archivo_destinos").upsert({ ...fila, updated_at: ahoraISO() }, { onConflict: "clave" })
      if (error) { toast.error("No se pudo guardar la carpeta: " + error.message); return }
      setDestino(fila)
      setAbierto(false)
      toast.success(`Listo: «${fila.nombre}» se archiva en ${fila.ruta_drive}${fila.por_anio && anio ? ` / ${anio}` : ""}`)
      onListo?.(fila)
    } catch (e) {
      toast.error("No se pudo buscar la carpeta: " + (e as Error).message)
    } finally { setBuscando(false) }
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button type="button" title={est.falta ? `Pendiente: falta decir dónde se archiva «${destino?.nombre ?? nombre}»` : `Se archiva en ${est.texto} — click para cambiarla`}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${est.falta ? "animate-pulse border-red-500 bg-red-50 font-semibold text-red-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>
          {est.falta ? "📁❗" : "📁"} <span className="max-w-[360px] truncate">{est.texto}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[28rem] space-y-2">
        <p className="text-sm font-semibold">¿Dónde se guarda «{destino?.nombre ?? nombre}»?</p>
        <p className="text-xs text-muted-foreground">
          Escribí la carpeta como la ves en tu PC (ej. <code>I:\Mi unidad\SAN MANUEL\IMPUESTOS\…\INMOBILIARIO</code>) o pegá el link de Drive.
          {(destino?.por_anio ?? true) && <> Adentro se usa la carpeta del año{anio ? ` (${anio})` : ""}: si no existe, se crea.</>}
          {" "}Se guarda la carpeta misma: si después la movés, la app la sigue encontrando.
        </p>
        <Input autoFocus value={ruta} onChange={e => setRuta(e.target.value)} placeholder="I:\Mi unidad\…" className="h-8 text-xs"
          onKeyDown={e => { if (e.key === "Enter") void guardar() }} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button size="sm" className="h-7 text-xs" disabled={buscando || !ruta.trim()} onClick={() => void guardar()}>{buscando ? "Buscando en el Drive…" : "Buscar y guardar"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
