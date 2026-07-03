/** Animated voice waveform — echoes the logo. Pure CSS, staggered bars. */
export default function Waveform({
  bars = 28,
  className = "",
}: {
  bars?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        // pseudo-random but stable heights for a natural look
        const h = 30 + ((i * 37) % 70);
        const delay = ((i * 83) % 900) / 1000;
        return (
          <span
            key={i}
            className="w-[3px] origin-center rounded-full bg-white/70 animate-wave"
            style={{ height: `${h}%`, animationDelay: `${delay}s` }}
          />
        );
      })}
    </div>
  );
}
