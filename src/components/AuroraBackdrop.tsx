/**
 * AuroraBackdrop — fixed-position cinematic gradient backdrop used across the
 * in-app screens (chat, results, policy). Pure CSS, no WebGL, so it stays
 * fast on the low-end 3G devices Sawt-Net targets.
 *
 * Two intensities:
 *  - "subtle" (default): chat + results — keeps content legible.
 *  - "rich": policy dashboard — the showcase screen.
 *
 * Respects prefers-reduced-motion via the underlying CSS class.
 */
export function AuroraBackdrop({
  intensity = "subtle",
  animated = true,
}: {
  intensity?: "subtle" | "rich";
  animated?: boolean;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`aurora-bg ${intensity === "rich" ? "rich" : ""} ${animated ? "animated" : ""}`}
      />
      <div aria-hidden="true" className="aurora-noise" />
    </>
  );
}
