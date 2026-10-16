// Simple line icons, drawn inline. Decorative: the button or link around them carries the label.

const PATHS = {
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowUpRight: "M7 17L17 7M9 7h8v8",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l5 5 9-10",
  swap: "M7 4v16M7 4L4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3",
  share: "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, stroke = 2.5 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      // Grows with the iPhone text size, like the text beside it.
      style={{ flex: "0 0 auto", width: `calc(${size}px + var(--grow) * 0.4)`, height: `calc(${size}px + var(--grow) * 0.4)` }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
