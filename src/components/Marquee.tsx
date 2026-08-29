const ITEMS = [
  "OBJECT-CENTRIC THREAT GRAPH",
  "DETERMINISTIC MOVE DRY-RUNS",
  "WALLET-NATIVE VERDICTS",
  "ZERO CUSTODY ARCHITECTURE",
  "PROGRAMMABLE TRANSACTION BLOCKS",
  "SUB-SECOND AI INFERENCE",
  "NO ADMIN CAPABILITIES",
  "COMPLIANCE-GRADE AUDIT TRAILS",
];

export default function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-y border-line bg-abyss/40 py-4">
      <div className="animate-marquee flex w-max items-center gap-10">
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-mono text-[11px] uppercase tracking-[0.28em] text-mist/70"
          >
            {item}
            <span className="h-1 w-1 rotate-45 bg-sui/60" />
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-ink to-transparent" />
    </div>
  );
}
