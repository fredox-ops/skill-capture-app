import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  // Transparent shell so the global Galaxy background shows through on every route.
  return (
    <div className="relative h-dvh w-full bg-transparent flex flex-col overflow-hidden text-slate-100">
      <div className="app-shell flex flex-1 min-h-0 flex-col">{children}</div>
    </div>
  );
}
