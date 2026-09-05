import { cn } from "@/lib/utils"

/**
 * Un texto que **explica** algo, y que por eso se puede apagar (A-FEAT-84).
 *
 * Es la letra chica didáctica: *«Si lo cargás, las iniciales salen de acá»*. Dice siempre lo mismo,
 * no depende de los datos, y al que ya conoce la pantalla no le aporta nada — de ahí el interruptor
 * en el perfil de cada uno.
 *
 * ## ⚠️ Qué NO se marca — la única regla que importa acá
 *
 * **Nada que dependa de los datos.** Un control, una alerta, un total que no cierra, un «no se pudo
 * verificar», un contador: eso **no es una explicación**, es el resultado. `CLAUDE.md` § 🧮 lo dice
 * al revés y es la misma cosa: *un control que nadie ve no es un control*, y *nada se descarta en
 * silencio*.
 *
 * La prueba para decidir en dos segundos: **¿el texto diría lo mismo con la base vacía?**
 * - Sí → es explicación, va marcada.
 * - No → es un dato, y no se toca.
 *
 * ⚠️ **El error peligroso es en una sola dirección.** Marcar de menos deja una explicación que
 * alguien no puede apagar: molesta y se ve. Marcar de más **esconde un control**, y eso no se ve
 * nunca — que es exactamente el modo de falla contra el que existe la § 🧮. Ante la duda, no marcar.
 *
 * ## Cómo se usa
 *
 * Reemplaza al `<p className="text-xs text-muted-foreground">` de siempre, que es la forma que ya
 * tenía la letra chica en el sistema:
 *
 * ```tsx
 * <Ayuda>Si lo cargás, las iniciales salen de acá en vez de tu mail.</Ayuda>
 * ```
 *
 * Para una caja entera de ayuda (un recuadro con ícono y varios renglones) no hace falta este
 * componente: alcanza con ponerle **`data-ayuda`** al elemento que la envuelve. El que apaga es un
 * selector de CSS sobre ese atributo, así que **cualquier** elemento marcado se apaga igual.
 *
 * Dos detalles que salieron de marcar las primeras cuatro pantallas:
 * - **Si al apagar el texto queda una caja vacía, marcá la caja y no el texto.** Un recuadro gris
 *   sin nada adentro es peor que la explicación que se quería sacar.
 * - **`DialogDescription` y `CardDescription` no se marcan.** Son lo que `aria-describedby`
 *   apunta: un lector de pantalla ignora lo que está en `display:none`, así que apagarlas le saca
 *   el contexto a quien más lo necesita. Ahí la explicación se queda.
 */
export function Ayuda({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p data-ayuda className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </p>
  )
}
