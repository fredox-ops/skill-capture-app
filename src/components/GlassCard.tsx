import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "strong";
}

/**
 * GlassCard — glassmorphic surface used across the dark in-app screens.
 * Variant "strong" lifts contrast for hero cards.
 */
export function GlassCard({
  children,
  className,
  variant = "default",
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variant === "strong" ? "glass-card-strong" : "glass-card",
        "rounded-3xl text-white",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
