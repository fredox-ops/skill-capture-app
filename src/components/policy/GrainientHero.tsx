import { ShieldCheck } from "lucide-react";

/**
 * GrainientHero — a CSS-only animated gradient mesh + grain hero banner.
 * Inspired by the React Bits "Grainient" component, adapted to our stack
 * with no extra dependencies (Worker-safe, SSR-safe, mobile-first).
 *
 * Pure presentation. Pass `title` / `subtitle` to label the dashboard.
 */
export function GrainientHero({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 shadow-lg">
      {/* Animated gradient mesh */}
      <div className="grainient-bg absolute inset-0" aria-hidden="true" />
      {/* Grain overlay */}
      <div className="grainient-noise absolute inset-0 opacity-[0.18] mix-blend-overlay" aria-hidden="true" />
      {/* Vignette for legibility */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/40"
        aria-hidden="true"
      />

      <div className="relative px-6 py-10 sm:px-10 sm:py-14">
        {badge && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            <ShieldCheck className="h-3.5 w-3.5" />
            {badge}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{subtitle}</p>
      </div>

      <style>{`
        .grainient-bg {
          background:
            radial-gradient(at 18% 22%, #5227FF 0px, transparent 55%),
            radial-gradient(at 82% 18%, #B497CF 0px, transparent 50%),
            radial-gradient(at 50% 88%, #6d7b86 0px, transparent 55%),
            radial-gradient(at 75% 75%, #5227FF 0px, transparent 45%),
            linear-gradient(135deg, #2a1f5e 0%, #4a3a8a 50%, #6d7b86 100%);
          background-size: 200% 200%;
          animation: grainient-drift 18s ease-in-out infinite;
          filter: contrast(1.15) saturate(1.1);
        }
        @keyframes grainient-drift {
          0%, 100% { background-position: 0% 50%, 100% 0%, 50% 100%, 70% 70%, 0% 0%; }
          50%      { background-position: 100% 50%, 0% 100%, 50% 0%, 30% 30%, 100% 100%; }
        }
        .grainient-noise {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          background-size: 180px 180px;
        }
        @media (prefers-reduced-motion: reduce) {
          .grainient-bg { animation: none; }
        }
      `}</style>
    </div>
  );
}
