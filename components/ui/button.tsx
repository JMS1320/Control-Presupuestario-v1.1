import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * `active:scale-[0.97]` — feedback de pulsado, agregado 2026-09-05.
 *
 * Hasta acá ningún botón de la app confirmaba que el click se había registrado: la base sólo
 * tenía `transition-colors`. Duele en los botones que disparan operaciones lentas (importadores,
 * paneles del presupuesto, conciliación), donde entre el click y el primer cambio en pantalla no
 * pasaba nada y se termina clickeando dos veces.
 *
 * El 0,97 es a propósito casi imperceptible: un botón se aprieta decenas de veces por día y una
 * escala más marcada cansa. `scale()` arrastra al label y al ícono, que es lo que hace que se lea
 * como una tecla física.
 *
 * Con `prefers-reduced-motion` el movimiento se cambia por opacidad: menos movimiento, no cero.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 motion-reduce:active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
