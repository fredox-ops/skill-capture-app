import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full bg-app-shell flex flex-col overflow-hidden">
      <div className="app-shell flex flex-1 min-h-0 flex-col">{children}</div>
    </div>
  );
}
