import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-app-shell flex flex-col">
      <div className="app-shell flex flex-1 flex-col">{children}</div>
    </div>
  );
}
