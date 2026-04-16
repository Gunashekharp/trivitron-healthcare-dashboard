import * as React from "react";
import { cva, type VariantProps } from "@/lib/cva";
import { cn } from "@/lib/mis/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-blue-200/60 bg-gradient-to-r from-blue-50 to-blue-100/60 text-blue-700",
        critical: "border-rose-200/60 bg-gradient-to-r from-rose-50 to-rose-100/60 text-rose-600",
        warning: "border-amber-200/60 bg-gradient-to-r from-amber-50 to-amber-100/60 text-amber-700",
        success: "border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-emerald-100/60 text-emerald-700",
        outline: "border-slate-200 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
