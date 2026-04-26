import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * App layout shell. Default is the legacy white slate.
 * Pass `transparent` so an underlying <AuroraBackdrop /> can shine through.
 */
export function MobileShell({
  children,
  transparent = false,
}: {
  children: ReactNode;
  transparent?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-dvh w-full flex flex-col overflow-hidden relative",
        transparent ? "bg-transparent" : "bg-app-shell",
      )}
    >
      <div
        className={cn(
          "flex flex-1 min-h-0 flex-col relative z-10",
          transparent ? "app-shell app-shell-transparent" : "app-shell",
        )}
      >
        {children}
      </div>
    </div>
  );
}
