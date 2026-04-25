/**
 * Tiny animated 3-bar audio-wave indicator (no deps).
 * Visible only while a bot bubble is being read aloud by TTS.
 */
export function AudioWave({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-3.5 items-end gap-[2px] ${className}`}
      aria-hidden="true"
    >
      <span className="audio-bar audio-bar-1" />
      <span className="audio-bar audio-bar-2" />
      <span className="audio-bar audio-bar-3" />
    </span>
  );
}
