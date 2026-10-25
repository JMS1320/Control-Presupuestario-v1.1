"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, LockOpen, Eye, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ContextoModoPermisos,
  useModoPermisos,
  usePuedeVer,
  type EstadoModoPermisos,
} from "@/components/contexto-permisos"
import {
  alternarRecurso as alternarRecursoPuro,
  alternarSeccion as alternarSeccionPuro,
  borradorDe,
  contarCambios,
  cuerpoGuardar,
  nivelEnBorrador,
  type Borrador,
} from "@/lib/auth/modo-permisos"
import { RECURSOS } from "@/lib/auth/recursos"

/**
 * 🖱️ MODO PERMISOS — prender sobre la pantalla lo que ve un rol (A-FEAT-1334).
 *
 * Se entra desde Configuración → Roles → «Editar sobre la pantalla» (`/?permisos=<rol>`, sólo
 * admin). Mientras está activo:
 *   · se ve TODO; lo que el rol no tiene aparece atenuado con un candado, y apretándolo se prende;
 *   · «Ver como lo ve él» esconde lo atenuado y los candados: es su pantalla tal cual;
 *   · nada se aplica hasta «Guardar», que usa el mismo endpoint que la lista de Roles.
 * La lógica (qué pasa al prender una sección de un rol cerrado, el padre de una sub-solapa) está en
 * `lib/auth/modo-permisos.ts`, que es lo que prueba `npm run probar`.
 */
export type RolEnModo = {
  id: string
  descripcion: string
  secciones: string[]
  permisos: Record<string, string>
  cerrado: boolean
}

/**
 * Lo registrado que la pantalla todavía NO pregunta: no tiene dónde mostrar su candado. Se lista en
 * la barra para que no parezca que no existe (§ 🧮: nada se descarta en silencio).
 */
const SIN_CANDADO = RECURSOS.filter((r) => r.tipo === "funcionalidad")

export function ProveedorModoPermisos({ rol, children }: { rol: RolEnModo | null; children: React.ReactNode }) {
  const inicial = useMemo(() => (rol ? borradorDe(rol) : null), [rol])
  const [original, setOriginal] = useState<Borrador | null>(inicial)
  const [borrador, setBorrador] = useState<Borrador | null>(inicial)
  const [soloLoQueVe, setSoloLoQueVe] = useState(false)

  const valor = useMemo<EstadoModoPermisos | null>(() => {
    if (!rol || !borrador) return null
    return {
      rolId: rol.id,
      descripcion: rol.descripcion,
      borrador,
      soloLoQueVe,
      alternarSeccion: (s) => setBorrador((b) => (b ? alternarSeccionPuro(b, s) : b)),
      alternarRecurso: (r) => setBorrador((b) => (b ? alternarRecursoPuro(b, r) : b)),
    }
  }, [rol, borrador, soloLoQueVe])

  if (!valor || !original) return <>{children}</>

  return (
    <ContextoModoPermisos.Provider value={valor}>
      {children}
      <BarraModoPermisos
        original={original}
        onGuardado={(b) => setOriginal(b)}
        onDescartar={() => setBorrador(original)}
        setSoloLoQueVe={setSoloLoQueVe}
        cerrado={rol?.cerrado ?? false}
      />
    </ContextoModoPermisos.Provider>
  )
}

function BarraModoPermisos({
  original,
  onGuardado,
  onDescartar,
  setSoloLoQueVe,
  cerrado,
}: {
  original: Borrador
  onGuardado: (b: Borrador) => void
  onDescartar: () => void
  setSoloLoQueVe: (v: boolean) => void
  cerrado: boolean
}) {
  const modo = useModoPermisos()!
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const cambios = contarCambios(original, modo.borrador)

  async function guardar() {
    setGuardando(true)
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoGuardar(modo.rolId, modo.borrador)),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(j.error ?? "No se pudo guardar.")
        return
      }
      onGuardado(modo.borrador)
      toast.success(`Permisos de «${modo.rolId}» guardados.`)
    } finally {
      setGuardando(false)
    }
  }

  function salir() {
    if (cambios > 0 && !window.confirm(`Hay ${cambios} cambio(s) sin guardar. ¿Salir igual y perderlos?`)) return
    router.push("/configuracion?panel=roles")
  }

  return (
    <div
      data-nota-ignorar
      className="fixed inset-x-0 bottom-3 z-50 mx-auto w-[calc(100%-2rem)] max-w-3xl rounded-xl border-2 border-violet-400 bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MousePointerClick className="h-5 w-5 shrink-0 text-violet-600" />
          <div className="min-w-0 text-sm">
            <div className="font-semibold">
              Prendiendo permisos de «{modo.rolId}» {cerrado ? "🔒" : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              {modo.soloLoQueVe
                ? "Así lo ve él. Destildá «Ver como lo ve él» para seguir prendiendo."
                : "Lo atenuado no lo ve: apretá su candado para dárselo. Nada se aplica hasta Guardar."}
            </div>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input type="checkbox" checked={modo.soloLoQueVe} onChange={(e) => setSoloLoQueVe(e.target.checked)} />
          Ver como lo ve él
        </label>
        <span className={`text-xs ${cambios ? "font-semibold text-violet-700" : "text-muted-foreground"}`}>
          {cambios === 0 ? "Sin cambios" : `${cambios} cambio(s)`}
        </span>
        <div className="flex gap-2">
          <Button size="sm" disabled={cambios === 0 || guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          <Button size="sm" variant="outline" disabled={cambios === 0 || guardando} onClick={onDescartar}>
            Descartar
          </Button>
          <Button size="sm" variant="ghost" onClick={salir}>
            Salir
          </Button>
        </div>
      </div>
      {!cerrado && (
        <p className="mt-2 text-xs text-amber-700">
          ⚠️ Es un rol abierto: lo que se agregue a la app más adelante le va a aparecer solo. Para que nazca
          apagado, marcalo «🔒 Rol cerrado» en Configuración → Roles.
        </p>
      )}
      <details className="mt-1 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Qué no se puede prender desde acá</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>
            {SIN_CANDADO.length} funciones de adentro de ventanas todavía no tienen candado en pantalla
            ({SIN_CANDADO.map((r) => r.etiqueta).join(", ")}): se eligen en la lista de Configuración → Roles.
          </li>
          <li>Las solapas de Ingresos no se pueden elegir una por una: va la sección entera.</li>
          <li>Ves los datos como admin. Facturas en modo restringido (lo de cualquier rol que no es admin) no se simula.</li>
        </ul>
      </details>
    </div>
  )
}

/**
 * Envuelve una solapa o un botón permisable.
 *   · Fuera del modo: lo muestra si el usuario lo puede ver (lo mismo que `puedeVer(id) && …`).
 *   · En el modo: lo muestra siempre —atenuado si el rol no lo tiene— con su candado al lado.
 */
export function Permisable({ recurso, children }: { recurso: string; children: React.ReactNode }) {
  const modo = useModoPermisos()
  const puedeVer = usePuedeVer()
  if (!modo) return puedeVer(recurso) ? <>{children}</> : null

  const nivel = nivelEnBorrador(modo.borrador, recurso)
  const prendido = nivel !== "ninguno"
  if (modo.soloLoQueVe) return prendido ? <>{children}</> : null

  return (
    <span className="relative flex items-stretch" data-permisable={recurso}>
      <span className={`flex flex-1 [&>*]:flex-1 ${prendido ? "" : "opacity-40 grayscale"}`}>{children}</span>
      <Candado
        nivel={nivel}
        titulo={RECURSOS.find((r) => r.id === recurso)?.etiqueta ?? recurso}
        onClick={() => modo.alternarRecurso(recurso)}
      />
    </span>
  )
}

/** El botoncito redondo. Verde = lo ve; gris = no lo ve; ámbar = sólo lectura. */
export function Candado({
  nivel,
  titulo,
  onClick,
  className = "absolute -right-1.5 -top-1.5",
}: {
  nivel: "ninguno" | "lectura" | "escritura"
  titulo: string
  onClick: () => void
  className?: string
}) {
  const estilo =
    nivel === "escritura" ? "border-emerald-600 bg-emerald-500 text-white"
    : nivel === "lectura" ? "border-amber-500 bg-amber-400 text-white"
    : "border-slate-300 bg-white text-slate-500"
  const ayuda =
    nivel === "escritura" ? `«${titulo}»: lo ve. Apretá para sacárselo.`
    : nivel === "lectura" ? `«${titulo}»: lo ve sin editar. Apretá para sacárselo.`
    : `«${titulo}»: no lo ve. Apretá para dárselo.`
  const Icono = nivel === "escritura" ? LockOpen : nivel === "lectura" ? Eye : Lock
  return (
    <button
      type="button"
      data-nota-ignorar
      title={ayuda}
      aria-label={ayuda}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      className={`${className} z-10 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition hover:scale-110 ${estilo}`}
    >
      <Icono className="h-3 w-3" />
    </button>
  )
}
