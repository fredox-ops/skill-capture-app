import type { ReactNode } from "react";

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-app-shell flex items-stretch sm:items-center justify-center">
      <div className="mobile-shell flex flex-col">{children}</div>
    </div>
  );
}
