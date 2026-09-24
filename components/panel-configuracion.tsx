"use client"

import { useEffect, useRef, useState } from "react"
import { PanelUsuarios } from "@/components/panel-usuarios"
import { seccionesDe } from "@/components/layout-app"
import { recursosDe, SIN_RECURSOS, type Recurso } from "@/lib/auth/recursos"
import { Ayuda } from "@/components/ayuda"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DATOS_FISCALES, EMPRESAS, cuitFormateado } from "@/lib/empresas"
import { Users, ShieldCheck, Building2, KeyRound, Check, Minus, Eye } from "lucide-react"

const PANELES = [
  { id: "usuarios",   label: "Usuarios",   Icono: Users,       ayuda: "Cuentas, roles y acceso" },
  { id: "roles",      label: "Roles",      Icono: ShieldCheck, ayuda: "Qué es cada rol" },
  { id: "permisos",   label: "Permisos",   Icono: KeyRound,    ayuda: "Quién puede hacer qué" },
  { id: "aplicacion", label: "Aplicación", Icono: Building2,   ayuda: "Empresas y datos fiscales" },
] as const

export type IdPanel = (typeof PANELES)[number]["id"]
export const PANELES_IDS = new Set<string>(PANELES.map((p) => p.id))

/**
 * Configuración: un solo lugar para lo que se administra, con su propio menú al costado.
 *
 * Antes «Usuarios» era una pantalla suelta colgada del menú del avatar. Al aparecer más cosas
 * administrables (roles, datos de las empresas) una entrada por cada una en ese menú lo hubiera
 * convertido en una lista larga de cosas que se tocan una vez cada tanto.
 */
export function PanelConfiguracion({ miId, panelInicial }: { miId: string; panelInicial?: string }) {
  const [panel, setPanel] = useState<string>(
    panelInicial && PANELES_IDS.has(panelInicial) ? panelInicial : "usuarios"
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      {/* Menú del costado. Es navegación de esta pantalla, no de la app: por eso vive acá y no
          en el menú lateral grande. */}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {PANELES.map(({ id, label, Icono, ayuda }) => {
          const activo = panel === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(id)}
              aria-current={activo ? "page" : undefined}
              className={`flex shrink-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 ${
                activo ? "bg-slate-200 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icono className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {label}
                <span data-ayuda className="hidden text-xs font-normal text-muted-foreground lg:block">{ayuda}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="min-w-0">
        {panel === "usuarios" && <PanelUsuarios miId={miId} />}
        {panel === "roles" && <PanelRoles />}
        {panel === "permisos" && <PanelPermisos />}
        {panel === "aplicacion" && <PanelAplicacion />}
      </div>
    </div>
  )
}

type RolDB = {
  id: string
  descripcion: string
  secciones: string[]
  permisos?: Record<string, string>
  exige_2fa: boolean
  es_sistema: boolean
}

/** Los roles y sus permisos, leídos de la base. */
function useRoles() {
  const [roles, setRoles] = useState<RolDB[] | null>(null)
  const [desdeLaBase, setDesdeLaBase] = useState(true)
  // Qué falta exactamente. Un cartel que culpa a la pieza equivocada manda a correr el script que
  // no arregla nada, y el problema real queda invisible.
  const [falta, setFalta] = useState<"tabla" | "columna_permisos" | undefined>()
  // Los recursos que la BASE aplica (tienen tablas mapeadas). Ver el comentario en la ruta.
  const [aplicados, setAplicados] = useState<string[]>([])
  const [cuentas, setCuentas] = useState<Record<string, number> | null>(null)

  const recargar = () =>
    fetch("/api/admin/roles")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        setRoles(j.roles)
        setDesdeLaBase(j.desdeLaBase)
        setFalta(j.falta)
        setAplicados(j.recursosAplicados ?? [])
      })
      .catch(() => {})

  useEffect(() => {
    void recargar()
    fetch("/api/admin/usuarios")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.usuarios) return
        const conteo: Record<string, number> = {}
        for (const u of j.usuarios) if (u.rol) conteo[u.rol] = (conteo[u.rol] ?? 0) + 1
        setCuentas(conteo)
      })
      .catch(() => {})
  }, [])

  return { roles, desdeLaBase, falta, aplicados, cuentas, recargar }
}

/**
 * Los roles, con sus permisos editables.
 *
 * Un rol de **sistema** (`admin`) se muestra pero no se edita: si se le pudieran sacar secciones,
 * alguien deja el sistema sin nadie que pueda administrarlo. No alcanza con esconder los
 * checkboxes — el endpoint y un trigger de la base lo rechazan igual.
 */
/**
 * Una casilla de "todos" con TRES estados, no dos.
 *
 * El tercero —el guión de indeterminado— no es un lujo: con 9 recursos en Productivo, una casilla
 * que se ve vacía cuando hay 4 tildados **miente**, y al tocarla la persona espera marcar los 5
 * que faltan y termina borrando los 4 que había. `indeterminate` sólo se puede poner por DOM, de
 * ahí el ref.
 */
function CasillaMaestra({
  etiqueta,
  marcados,
  total,
  deshabilitada = false,
  onCambio,
}: {
  etiqueta: string
  marcados: number
  total: number
  deshabilitada?: boolean
  onCambio: (valor: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const todos = total > 0 && marcados === total
  const algunos = marcados > 0 && marcados < total

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = algunos
  }, [algunos])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={etiqueta}
      title={
        deshabilitada
          ? "Primero hay que poder ver algo: no se puede editar lo que no se ve"
          : algunos
            ? `${marcados} de ${total} — tocá para marcar todos`
            : etiqueta
      }
      checked={todos}
      disabled={deshabilitada}
      // Desde "algunos" se marca todo: es lo que se espera al tocar un encabezado a medias.
      onChange={() => onCambio(!todos)}
      className="h-3 w-3 disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}

function PanelRoles() {
  const { roles, desdeLaBase, falta, aplicados, cuentas, recargar } = useRoles()
  const todas = seccionesDe("admin")   // las 12, con su label e ícono

  const [editando, setEditando] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Set<string>>(new Set())
  // Las EXCEPCIONES por recurso. Lo que no figura hereda de la sección = escritura, así lo que
  // todavía no está registrado se sigue viendo y editando (ver `nivelesDe`).
  const [niveles, setNiveles] = useState<Record<string, "ninguno" | "lectura" | "escritura">>({})
  const nivelDe = (id: string) => niveles[id] ?? "escritura"
  /**
   * ⚠️ **Cada columna toca SÓLO su dimensión.** Antes las dos maestras ponían `"escritura"`, así
   * que marcar «Ver todos» también marcaba todos los «Editar» — lo reportó el usuario.
   *
   * Los tres niveles no son dos casillas independientes, son una escalera
   * (`ninguno` → `lectura` → `escritura`), y cada maestra mueve un solo escalón:
   *
   *   · **Ver ON**  → lo que estaba en `ninguno` pasa a `lectura`. Lo que ya editaba, **no se
   *     degrada**: marcar «ver» no puede quitarle permisos a nadie.
   *   · **Ver OFF** → todo a `ninguno`. Único caso en que arrastra la otra columna, y es
   *     inevitable: no se puede editar lo que no se ve.
   *   · **Editar ON**  → todo a `escritura` (que implica ver).
   *   · **Editar OFF** → lo que editaba baja a `lectura`. Lo que no se veía **sigue sin verse**:
   *     destildar «editar» no puede conceder visibilidad.
   *
   * Y el ON de «Ver» da `lectura` y no `escritura` a propósito: al conceder, lo mínimo.
   */
  const verTodos = (ids: string[], valor: boolean) =>
    setNiveles((prev) => {
      const sig = { ...prev }
      for (const id of ids) {
        if (!valor) sig[id] = "ninguno"
        else if ((prev[id] ?? "escritura") === "ninguno") sig[id] = "lectura"
      }
      return sig
    })

  const editarTodos = (ids: string[], valor: boolean) =>
    setNiveles((prev) => {
      const sig = { ...prev }
      for (const id of ids) {
        if (valor) delete sig[id] // sin excepción = hereda de la sección = escritura
        else if ((prev[id] ?? "escritura") === "escritura") sig[id] = "lectura"
      }
      return sig
    })

  const ponerNivel = (id: string, n: "ninguno" | "lectura" | "escritura") =>
    setNiveles((prev) => {
      const sig = { ...prev }
      if (n === "escritura") delete sig[id]
      else sig[id] = n
      return sig
    })
  const [guardando, setGuardando] = useState(false)

  function empezar(r: RolDB) {
    setEditando(r.id)
    setBorrador(new Set(r.secciones))
    setNiveles({ ...((r.permisos ?? {}) as Record<string, "ninguno" | "lectura" | "escritura">) })
  }

  async function guardar(id: string) {
    setGuardando(true)
    const res = await fetch("/api/admin/roles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, secciones: [...borrador], permisos: niveles }),
    })
    const json = await res.json().catch(() => ({}))
    setGuardando(false)
    if (!res.ok) {
      toast.error(json.error ?? "No se pudo guardar.")
      return
    }
    toast.success("Permisos guardados. Se aplican al recargar la pantalla.")
    setEditando(null)
    void recargar()
  }

  if (roles === null) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cargando roles…</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      {!desdeLaBase && (
        <Card className="entrada-suave border-amber-300 bg-amber-50">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium text-amber-900">Falta crear la tabla de roles en la base.</p>
            <p className="text-amber-900/80">
              Se está mostrando el reparto que estaba escrito en el código, así que la app funciona
              igual que siempre — pero <strong>editar todavía no va a guardar nada</strong>. Se
              habilita corriendo <code>scripts/60-roles-permisos.sql</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {/*
        Caso distinto del de arriba y por eso cartel aparte: la tabla ESTÁ y los roles se leen
        bien; lo único que falta es la columna de permisos finos. Antes este caso se mostraba
        como «falta la tabla» —porque un select con una columna inexistente falla entero— y
        mandaba a correr scripts/60, que no arreglaba nada.
      */}
      {desdeLaBase && falta === "columna_permisos" && (
        <Card className="entrada-suave border-sky-300 bg-sky-50">
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium text-sky-900">Los permisos por sección funcionan. Falta el grano fino.</p>
            <p className="text-sky-900/80">
              Podés ver qué hay dentro de cada sección, pero <strong>destildar algo de adentro
              todavía no se guarda</strong>: falta la columna. Se habilita corriendo{" "}
              <code>scripts/61-permisos-finos.sql</code>.
            </p>
          </CardContent>
        </Card>
      )}

      {roles.map((r) => {
        const n = cuentas === null ? undefined : (cuentas[r.id] ?? 0)
        const enEdicion = editando === r.id
        const secciones = enEdicion ? borrador : new Set(r.secciones)
        return (
          <Card key={r.id} className="entrada-suave overflow-hidden">
            <div className={`flex items-center justify-between gap-3 border-b px-5 py-3 ${r.es_sistema ? "bg-slate-100" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className={`h-5 w-5 ${r.es_sistema ? "text-slate-700" : "text-slate-400"}`} />
                <span className="font-semibold">{r.id}</span>
                {r.es_sistema && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                    sistema
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {n === undefined ? "…" : n === 1 ? "1 cuenta" : n === 0 ? "sin cuentas" : `${n} cuentas`}
              </span>
            </div>

            <CardContent className="space-y-4 pt-4 text-sm">
              <p className="text-muted-foreground">{r.descripcion}</p>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-md border bg-white px-3 py-2">
                  <div className="text-lg font-semibold leading-none">{secciones.size}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {secciones.size === 1 ? "sección" : "secciones"} de {todas.length}
                  </div>
                </div>
                <div className="rounded-md border bg-white px-3 py-2">
                  <div className={`text-lg font-semibold leading-none ${r.exige_2fa ? "text-emerald-700" : "text-slate-500"}`}>
                    {r.exige_2fa ? "Sí" : "No"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">exige 2FA</div>
                </div>
              </div>

              {enEdicion ? (
                <div className="space-y-3">
                  {/*
                    Cada sección abre lo que tiene adentro (A-FEAT-169). Antes era una grilla plana
                    de 12 casillas y no se veía qué había dentro de cada una.
                    ⚠️ Las casillas de adentro se muestran **deshabilitadas**: el permiso fino
                    todavía no se guarda ni se aplica. Están para que se vea el alcance real de
                    cada sección — mostrarlas como si funcionaran sería peor que no mostrarlas
                    (`scripts/60`: «una columna de permisos que ninguna guarda chequea parece un
                    permiso y no lo es»).
                  */}
                  <div className="space-y-1.5">
                    {todas.map(({ id, label, Icono }) => {
                      const puesta = borrador.has(id)
                      const dentro = recursosDe(id)
                      return (
                        <div key={id} className={`rounded-md border ${puesta ? "border-emerald-300 bg-emerald-50/60" : "bg-white"}`}>
                          <label className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs">
                            <input
                              type="checkbox"
                              checked={puesta}
                              onChange={(e) => {
                                const s = new Set(borrador)
                                if (e.target.checked) s.add(id)
                                else s.delete(id)
                                setBorrador(s)
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <Icono className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <span className="font-medium">{label}</span>
                            {dentro.length > 0 && (
                              <span className="ml-auto text-[11px] text-muted-foreground">
                                {dentro.length} {dentro.length === 1 ? "cosa adentro" : "cosas adentro"}
                              </span>
                            )}
                          </label>

                          {puesta && dentro.length > 0 && (
                            <div className="border-t bg-white/70 px-2.5 py-2">
                              {/*
                                Orden: primero los títulos de columna, DESPUÉS las maestras. Al
                                revés (como estaba) no se veía a qué columna pertenecía cada
                                casilla — lo reportó el usuario 2026-09-24.
                              */}
                              <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                                <span className="flex-1" />
                                <span className="w-9 text-center">Ver</span>
                                <span className="w-12 text-center">Editar</span>
                              </div>
                              {(() => {
                                const ids = dentro.map((r) => r.id)
                                const ven = ids.filter((i) => nivelDe(i) !== "ninguno").length
                                const editan = ids.filter((i) => nivelDe(i) === "escritura").length
                                return (
                                  <div className="mb-1 flex items-center gap-2 border-b pb-1.5 text-[10px] text-muted-foreground">
                                    <span className="flex-1 italic">Seleccionar todos</span>
                                    <span className="flex w-9 justify-center">
                                      <CasillaMaestra
                                        etiqueta={`Ver: seleccionar todos en ${label}`}
                                        marcados={ven}
                                        total={ids.length}
                                        onCambio={(v) => verTodos(ids, v)}
                                      />
                                    </span>
                                    <span className="flex w-12 justify-center">
                                      <CasillaMaestra
                                        etiqueta={`Editar: seleccionar todos en ${label}`}
                                        marcados={editan}
                                        total={ids.length}
                                        // Deshabilitada cuando no hay nada visible: así se VE que
                                        // «editar» depende de «ver», en vez de que se destilde
                                        // solo y parezca un error de la pantalla.
                                        deshabilitada={ven === 0}
                                        onCambio={(v) => editarTodos(ids, v)}
                                      />
                                    </span>
                                  </div>
                                )
                              })()}
                              <div className="space-y-0.5">
                                {dentro.map((r) => {
                                  // Si el padre está oculto, el hijo tampoco: destildar Insumos y
                                  // dejar Stock tildado diría algo que no es cierto.
                                  const tapado = Boolean(r.padre && nivelDe(r.padre) === "ninguno")
                                  const nivel = tapado ? "ninguno" : nivelDe(r.id)
                                  const ve = nivel !== "ninguno"
                                  const edita = nivel === "escritura"
                                  return (
                                    <div
                                      key={r.id}
                                      title={tapado ? "Está dentro de algo que destildaste" : undefined}
                                      className={`flex items-center gap-2 rounded px-1.5 py-1 text-[11px] ${
                                        r.padre ? "ml-5 border-l pl-2" : ""
                                      } ${tapado ? "opacity-50" : ""} ${ve ? "" : "text-muted-foreground line-through"}`}
                                    >
                                      <span className="flex-1">
                                        {r.etiqueta}
                                        {r.tipo === "funcionalidad" && (
                                          <span className="ml-1.5 rounded bg-slate-100 px-1 text-[10px] text-slate-500">
                                            acción
                                          </span>
                                        )}
                                        {/*
                                          El candado distingue lo que la BASE aplica de lo que es
                                          sólo la pantalla. Sin esta marca, «sólo ver» prometía en
                                          todos lados una contención que hoy existe sólo donde hay
                                          tablas mapeadas (A-SEC-10).
                                        */}
                                        {aplicados.includes(r.id) && (
                                          <span
                                            title="La base lo aplica: con «sólo ver», el intento de escribir se rechaza aunque venga de la consola"
                                            className="ml-1.5 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800"
                                          >
                                            🔒 base
                                          </span>
                                        )}
                                      </span>

                                      <span className="flex w-9 justify-center">
                                        <input
                                          type="checkbox"
                                          aria-label={`Ver ${r.etiqueta}`}
                                          checked={ve}
                                          disabled={tapado}
                                          // Mismo criterio que la maestra: marcar «ver» concede lo
                                          // mínimo (lectura), no escritura. Destildarlo sí arrastra
                                          // «editar», que es lo único inevitable.
                                          onChange={(e) =>
                                            ponerNivel(
                                              r.id,
                                              e.target.checked
                                                ? nivel === "ninguno"
                                                  ? "lectura"
                                                  : nivel
                                                : "ninguno"
                                            )
                                          }
                                          className="h-3 w-3"
                                        />
                                      </span>
                                      <span className="flex w-12 justify-center">
                                        <input
                                          type="checkbox"
                                          aria-label={`Editar ${r.etiqueta}`}
                                          checked={edita}
                                          disabled={tapado || !ve}
                                          onChange={(e) => ponerNivel(r.id, e.target.checked ? "escritura" : "lectura")}
                                          className="h-3 w-3"
                                        />
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>

                              {/*
                                ⚠️ El aviso NO es opcional. «Ver» se aplica hoy: la pestaña no se
                                dibuja. «Editar» se guarda y se puede consultar (`usePuedeEditar`),
                                pero todavía casi ninguna pantalla lo consulta y **la base no lo
                                frena** — con la misma sesión se escribe desde la consola.
                                Callarlo convertiría esto en lo que `scripts/60` decidió evitar:
                                algo que parece un permiso y no lo es.
                              */}
                              {(() => {
                                // El cartel dice la verdad POR CASO. El anterior afirmaba que
                                // «sólo ver» no impedía escribir; desde `scripts/62` eso es falso
                                // donde hay tablas mapeadas, y sigue siendo cierto donde no.
                                const enLectura = dentro.filter((r) => nivelDe(r.id) === "lectura")
                                if (enLectura.length === 0) return null
                                const sinBase = enLectura.filter((r) => !aplicados.includes(r.id))
                                if (sinBase.length === 0) {
                                  return (
                                    <p className="mt-1.5 rounded border border-emerald-200 bg-emerald-50 p-1.5 text-[10px] text-emerald-800">
                                      🔒 <strong>La base lo aplica.</strong> Con «sólo ver», el intento
                                      de guardar se rechaza — aunque lo haga desde la consola del navegador.
                                    </p>
                                  )
                                }
                                return (
                                  <p className="mt-1.5 rounded border border-amber-200 bg-amber-50 p-1.5 text-[10px] text-amber-800">
                                    <strong>Ojo:</strong> en {sinBase.map((r) => r.etiqueta).join(", ")}{" "}
                                    el «sólo ver» lo aplica <strong>sólo la pantalla</strong>: sus tablas
                                    todavía no están mapeadas en la base, así que ordena el trabajo pero
                                    no contiene a alguien decidido. Las que tienen 🔒 sí las frena la base.
                                  </p>
                                )
                              })()}
                              {dentro.some((r) => nivelDe(r.id) === "ninguno") && (
                                <p className="mt-1.5 text-[10px] text-muted-foreground">
                                  Lo destildado no se le va a mostrar. Sigue pudiendo entrar a la sección.
                                </p>
                              )}
                            </div>
                          )}

                          {puesta && dentro.length === 0 && SIN_RECURSOS[id] && (
                            <div className="border-t bg-white/70 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                              {SIN_RECURSOS[id]}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {borrador.size === 0 && (
                    <p className="text-xs text-amber-700">
                      Sin ninguna sección, quien tenga este rol entra y no ve nada. Se puede guardar
                      igual —sirve para dejar una cuenta suspendida sin borrarla— pero conviene saberlo.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => guardar(r.id)} disabled={guardando}>
                      {guardando ? "Guardando…" : "Guardar permisos"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)} disabled={guardando}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {todas
                      .filter((s) => secciones.has(s.id))
                      .map(({ id, label, Icono }) => (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs">
                          <Icono className="h-3.5 w-3.5 text-slate-500" />
                          {label}
                        </span>
                      ))}
                    {secciones.size === 0 && (
                      <span className="text-xs text-muted-foreground">Ninguna sección.</span>
                    )}
                  </div>

                  {r.es_sistema ? (
                    <p className="text-xs text-muted-foreground">
                      🔒 Es un rol de sistema: sus permisos no se editan. Si se le pudieran sacar
                      secciones, se podría dejar el sistema sin nadie que pueda administrarlo.
                    </p>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => empezar(r)}>
                      Editar permisos
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )
      })}

      {/* La card entera va marcada, no sus párrafos: apagando sólo el texto quedaría una caja
          gris vacía, que es peor que la explicación que se quería sacar. */}
      <Card data-ayuda className="entrada-suave border-slate-300 bg-slate-50">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Los cambios se aplican al recargar la pantalla.</strong>{" "}
            Quien ya esté adentro sigue viendo lo de antes hasta que recargue.
          </p>
          <p>
            Todavía <strong className="text-foreground">no se pueden crear roles nuevos</strong>: el
            nombre del rol está en el tipo de 12 componentes y agregarlo obliga a tocarlos. Los
            permisos de los que existen sí se editan acá.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * La matriz de permisos: quién puede hacer qué, en una sola vista.
 *
 * Las secciones salen de `seccionesDe()` — la función que aplica el permiso — así que esa mitad
 * de la tabla no se puede desincronizar. Los permisos de administración de abajo **sí están
 * escritos a mano** porque viven repartidos en guardas de páginas y endpoints; cada fila dice de
 * dónde sale, para poder verificarla.
 */
function PanelPermisos() {
  const { roles: rolesDB } = useRoles()
  const roles = (rolesDB ?? []).map((r) => r.id)
  const seccionesPorRol = Object.fromEntries(
    (rolesDB ?? []).map((r) => [r.id, new Set(r.secciones)])
  ) as Record<string, Set<string>>

  // Las excepciones finas, para poder mostrar la misma info que el editor (A-FEAT-169).
  const nivelesPorRol = Object.fromEntries(
    (rolesDB ?? []).map((r) => [r.id, (r.permisos ?? {}) as Record<string, string>])
  ) as Record<string, Record<string, string>>

  /** El nivel efectivo de un recurso para un rol: sin excepción, hereda de la sección. */
  const nivelEfectivo = (rol: string, recurso: Recurso): "ninguno" | "lectura" | "escritura" => {
    if (!seccionesPorRol[rol]?.has(recurso.seccion)) return "ninguno"
    // Si el padre está oculto, el hijo también — igual que en el editor.
    if (recurso.padre && nivelesPorRol[rol]?.[recurso.padre] === "ninguno") return "ninguno"
    return (nivelesPorRol[rol]?.[recurso.id] as "ninguno" | "lectura" | "escritura") ?? "escritura"
  }

  const todasLasSecciones = seccionesDe("admin")

  // ⚠️ Estas SÍ están escritas a mano: dependen de `esAdmin()`, que sigue siendo el rol `admin`
  // literal en el código. Por eso cada fila dice en qué archivo se aplica.
  const soloAdmin = (rol: string) => rol === "admin"
  const administracion = [
    { label: "Entrar a Configuración", puede: soloAdmin, donde: "app/configuracion/page.tsx" },
    { label: "Editar los permisos de un rol", puede: soloAdmin, donde: "app/api/admin/roles/route.ts" },
    { label: "Crear y revocar cuentas", puede: soloAdmin, donde: "lib/auth/guard-admin.ts" },
    { label: "Cambiarle el rol a otro", puede: soloAdmin, donde: "lib/auth/guard-admin.ts" },
    { label: "Ver el panel de pendientes", puede: soloAdmin, donde: "dashboard.tsx" },
    { label: "Ver y editar su propio perfil", puede: () => true, donde: "app/perfil/page.tsx" },
    { label: "Subir su foto", puede: () => true, donde: "app/api/perfil/avatar/route.ts" },
  ]

  /** Tres estados, no dos: «no lo ve», «lo ve», «lo ve y lo edita». */
  const CeldaNivel = ({ nivel }: { nivel: "ninguno" | "lectura" | "escritura" }) =>
    nivel === "escritura" ? (
      <span title="Ve y edita" className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-100 px-2 text-[10px] font-medium text-emerald-800">
        <Check className="h-3 w-3" /> edita
      </span>
    ) : nivel === "lectura" ? (
      <span title="Sólo ve — todavía no se impide escribir" className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-100 px-2 text-[10px] font-medium text-amber-800">
        <Eye className="h-3 w-3" /> ve
      </span>
    ) : (
      <span title="No lo ve" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
        <Minus className="h-3.5 w-3.5 text-slate-400" />
      </span>
    )

  const Celda = ({ si }: { si: boolean }) =>
    si ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
        <Check className="h-3.5 w-3.5 text-emerald-700" />
      </span>
    ) : (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
        <Minus className="h-3.5 w-3.5 text-slate-400" />
      </span>
    )

  return (
    <div className="space-y-6">
      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Secciones de la app</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Sección</th>
                  {roles.map((r) => (
                    <th key={r} className="pb-2 px-3 text-center font-medium">{r}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todasLasSecciones.flatMap(({ id, label, Icono }) => [
                  <tr key={id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className="inline-flex items-center gap-2">
                        <Icono className="h-4 w-4 text-slate-400" />
                        {label}
                      </span>
                    </td>
                    {roles.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <Celda si={Boolean(seccionesPorRol[r]?.has(id))} />
                      </td>
                    ))}
                  </tr>,
                  /*
                    Y debajo de cada sección, lo que hay ADENTRO — el mismo dato que se edita en
                    Roles, leído de la misma fuente. Pedido del usuario 2026-09-24: «estos mismos
                    datos debería poder verlos en la pantalla de permisos».
                  */
                  ...recursosDe(id).map((rec) => (
                    <tr key={rec.id} className="border-b bg-slate-50/50 last:border-0">
                      <td className="py-1.5 pr-4 pl-6 text-xs text-muted-foreground">
                        <span className={rec.padre ? "ml-4 border-l pl-2" : ""}>
                          ↳ {rec.etiqueta}
                          {rec.tipo === "funcionalidad" && (
                            <span className="ml-1.5 rounded bg-slate-200 px-1 text-[10px]">acción</span>
                          )}
                        </span>
                      </td>
                      {roles.map((r) => (
                        <td key={r} className="px-3 py-1.5 text-center">
                          <CeldaNivel nivel={nivelEfectivo(r, rec)} />
                        </td>
                      ))}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
          <Ayuda className="mt-4">
            Esta tabla no está escrita a mano: sale de la misma función que decide el acceso de
            verdad. Si mañana cambia lo que ve un rol, cambia sola.
          </Ayuda>
        </CardContent>
      </Card>

      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Administración</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Puede</th>
                  {roles.map((r) => (
                    <th key={r} className="px-3 pb-2 text-center font-medium">{r}</th>
                  ))}
                  <th className="hidden pb-2 pl-4 text-left font-medium lg:table-cell">Dónde se aplica</th>
                </tr>
              </thead>
              <tbody>
                {administracion.map((f) => (
                  <tr key={f.label} className="border-b last:border-0">
                    <td className="py-2 pr-4">{f.label}</td>
                    {roles.map((r) => (
                      <td key={r} className="px-3 py-2 text-center">
                        <Celda si={f.puede(r)} />
                      </td>
                    ))}
                    <td className="hidden py-2 pl-4 lg:table-cell">
                      <code className="text-xs text-muted-foreground">{f.donde}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ayuda className="mt-4">
            ⚠️ Estas filas <strong>sí están escritas a mano</strong>: los permisos de administración
            viven repartidos en guardas de páginas y de endpoints. Por eso cada una dice dónde se
            aplica, para poder verificarla. Si se agrega una guarda nueva, hay que sumarla acá.
          </Ayuda>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Datos de la aplicación, de sólo lectura.
 *
 * Las empresas y sus CUIT salen de `lib/empresas.ts`, que es de donde los toman los encabezados
 * de todos los reportes. Se muestran acá para poder verificarlos sin abrir el código — el Libro
 * IVA de PAM y de MA ya salió una vez con la razón social y el CUIT de MSA impresos.
 */
function PanelAplicacion() {
  return (
    <div className="space-y-6">
      <Card className="entrada-suave">
        <CardHeader>
          <CardTitle className="text-base">Empresas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Sigla</th>
                  <th className="pb-2 pr-4 font-medium">Razón social</th>
                  <th className="pb-2 font-medium">CUIT</th>
                </tr>
              </thead>
              <tbody>
                {EMPRESAS.map((e) => (
                  <tr key={e} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{e}</td>
                    <td className="py-2 pr-4">{DATOS_FISCALES[e].razonSocial}</td>
                    <td className="py-2 tabular-nums">{cuitFormateado(DATOS_FISCALES[e].cuit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Ayuda className="mt-4">
            Es de sólo lectura: estos datos viven en <code>lib/empresas.ts</code> y de ahí los toman
            los encabezados de todos los reportes. Se muestran para poder verificarlos sin abrir el
            código.
          </Ayuda>
        </CardContent>
      </Card>

      <Card data-ayuda className="entrada-suave border-slate-300 bg-slate-50">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Todavía no hay nada configurable acá.</strong> Cuando
            aparezca una opción que se pueda cambiar por el usuario —o por rol— este es su lugar.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
