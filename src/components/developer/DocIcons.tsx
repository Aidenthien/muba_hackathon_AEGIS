// The wrapper is shared with the landing-page set so both stay on the same
// grid and stroke weight.
import { Icon as Svg, type IconProps } from "@/components/Icons";

/* ── Section glyphs ────────────────────────────────────────────── */

export const IconCompass = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z" />
  </Svg>
);

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5" />
    <path d="M12 15V3" />
  </Svg>
);

export const IconZap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2 4.5 13.5H11l-.5 8.5L19 10.5h-6.5z" />
  </Svg>
);

export const IconChecklist = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 7 2 2 4-4" />
    <path d="m3 17 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </Svg>
);

export const IconBraces = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
    <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
  </Svg>
);

export const IconScan = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const IconServer = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="7" rx="2" />
    <rect x="2" y="14" width="20" height="7" rx="2" />
    <path d="M6 6.5h.01" />
    <path d="M6 17.5h.01" />
  </Svg>
);

export const IconLifebuoy = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="m5.6 5.6 3.9 3.9" />
    <path d="m14.5 14.5 3.9 3.9" />
    <path d="m18.4 5.6-3.9 3.9" />
    <path d="m9.5 14.5-3.9 3.9" />
  </Svg>
);

/* ── Utility glyphs ────────────────────────────────────────────── */

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s8-3 8-9V6l-8-3-8 3v6c0 6 8 9 8 9z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
);

/** Section id → glyph, so the sidebar and the headings can't drift apart. */
export const SECTION_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  "getting-started": IconCompass,
  install: IconDownload,
  "quick-start": IconZap,
  statuses: IconChecklist,
  api: IconBraces,
  detect: IconScan,
  "agent-server": IconServer,
  troubleshooting: IconLifebuoy,
};
