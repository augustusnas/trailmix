import type { CSSProperties } from "react";

/** Design sizes for each screen's headline: smallest (at 320 wide), fluid, largest (at 390 wide and up). */
export const HEADLINE_SIZES = {
  welcome: "clamp(47.6px, 16.9vw, 66px)",
  listen: "clamp(42.5px, 13.85vw, 54px)",
  home: "clamp(37.4px, 11.8vw, 46px)",
  screen: "clamp(39.1px, 12.8vw, 50px)",
  mix: "clamp(40.8px, 13.3vw, 52px)",
  saved: "clamp(42.5px, 14.36vw, 56px)",
  shared: "clamp(44.2px, 15.4vw, 60px)",
} as const;

export function longestWord(text: string): number {
  return Math.max(...text.split(/\s+/).map((w) => w.length));
}

/** The big headline at the top of a screen. See .headline in globals.css for how it grows with text size. */
export function Headline({
  text,
  size,
  className = "",
  style,
  focusable = false,
}: {
  text: string;
  size: keyof typeof HEADLINE_SIZES;
  className?: string;
  style?: CSSProperties;
  /** Lets a screen move focus here (for VoiceOver) without adding it to the Tab order. */
  focusable?: boolean;
}) {
  const vars = { "--h": HEADLINE_SIZES[size], "--chars": longestWord(text) } as CSSProperties;
  return (
    <h1 className={`headline ${className}`} style={{ ...vars, ...style }} tabIndex={focusable ? -1 : undefined}>
      {text}
    </h1>
  );
}
