import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] btn-press hover:shadow-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/40 hover-glow",
        primary: "bg-primary text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/40 hover-glow",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/30 hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/40",
        outline:
          "border border-input bg-background shadow-sm hover:border-primary/60 hover:bg-primary/5 hover:text-foreground hover:shadow-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm shadow-primary/10 hover:bg-secondary/80 hover:shadow-lg",
        success:
          "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-700/40",
        warning:
          "bg-amber-500 text-amber-950 shadow-sm shadow-amber-500/30 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-600/40",
        info:
          "bg-sky-600 text-white shadow-sm shadow-sky-600/30 hover:bg-sky-700 hover:shadow-lg hover:shadow-sky-700/40",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:shadow-sm",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
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
