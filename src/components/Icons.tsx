/**
 * Shared icon primitive and the landing-page glyph set.
 *
 * Drawn to Morphicons/Lucide conventions so any of these can be swapped for
 * either library later without redrawing: 24×24 grid, stroke-only, 1.75 width,
 * round caps and joins, `currentColor` so a glyph inherits its text color.
 *
 * `Icon` is the shared wrapper — the developer docs set (DocIcons.tsx) builds
 * on it too, so the two sets can't drift apart in stroke weight or grid.
 */
export type IconProps = { className?: string };

export function Icon({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ── Pre-mortem: the three failure modes ───────────────────────── */

/** Racing a chain that already finished. */
export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

/** The privileged admin capability we refuse to hold. */
export const IconKey = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7.5" cy="16.5" r="3.5" />
    <path d="M10 14 20 4" />
    <path d="m16 8 2.5 2.5" />
    <path d="m18.5 5.5 2 2" />
  </Icon>
);

/** Indexing millions of objects into a context window. */
export const IconDatabase = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
    <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
  </Icon>
);

/* ── Moat: the six differentiators ─────────────────────────────── */

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s8-3 8-9V6l-8-3-8 3v6c0 6 8 9 8 9z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

/** Deterministic dry-run — a lab result, not a guess. */
export const IconFlask = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3h6" />
    <path d="M10 3v6.5L4.8 18A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9.5V3" />
    <path d="M7.5 15h9" />
  </Icon>
);

export const IconBook = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a2.5 2.5 0 0 1 0-5H20" />
  </Icon>
);

export const IconBraces = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
    <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
  </Icon>
);

/** A false positive is a dismissible warning, not a frozen protocol. */
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 3.9 2.3 17.9A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

export const IconZap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11l-.5 8.5L19 10.5h-6.5z" />
  </Icon>
);

/* ── Metrics ───────────────────────────────────────────────────── */

export const IconTrendDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 17h6v-6" />
    <path d="m22 17-8.5-8.5-5 5L2 7" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
