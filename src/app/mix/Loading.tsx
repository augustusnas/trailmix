"use client";

import type { CSSProperties } from "react";
import { Headline } from "@/components/Headline";
import type { Routine } from "@/data/routines";
import { energyLabel, genreLabel } from "@/lib/format";
import { STAGES, type Progress } from "@/lib/progress";
import type { VibeSettings } from "@/lib/store";
import styles from "./loading.module.css";

// The loading screen while Make the mix or Remix runs (Milestone 5, L1, L2): three stages, each
// shown only when the server has really reached it, with its own colour and live line.

const COLOURS = ["var(--lime)", "var(--lilac)", "var(--orange)"];

/** One beat of the equaliser, by energy level (L2). */
export const BEAT_SECONDS: Record<string, number> = { easy: 1.4, steady: 0.9, driven: 0.6, feral: 0.38 };
/** Rising to the middle, as in the mockups. */
const BAR_HEIGHTS = [120, 150, 185, 220, 220, 185, 130];
/** Each bar starts a little later in the beat, so they don't move in step. */
const BAR_OFFSETS = [0, 0.15, 0.4, 0.08, 0.5, 0.25, 0.33];

/** The line under the headline: the genres, then the live count, then the mix so far. */
export function stageLine(p: Progress, vibe: VibeSettings): string {
  if (p.stage === "picking") return vibe.genres.map(genreLabel).join(" · ");
  if (p.stage === "energy") {
    const n = p.found ?? 0;
    return `${n} ${n === 1 ? "track" : "tracks"} found so far`;
  }
  if (p.tracks === undefined) return "";
  return `${p.tracks} ${p.tracks === 1 ? "track" : "tracks"} · ${Math.round((p.ms ?? 0) / 60_000)} min`;
}

export function Loading({ routine, vibe, progress, remixing }: { routine: Routine; vibe: VibeSettings; progress: Progress; remixing: boolean }) {
  const index = STAGES.findIndex((s) => s.id === progress.stage);
  const headline = STAGES[index].text(vibe.length);
  const beat = BEAT_SECONDS[vibe.energy] ?? BEAT_SECONDS.steady;
  return (
    <div className={styles.screen} style={{ background: COLOURS[index] }} data-testid="loading" data-stage={progress.stage}>
      <div className={styles.top}>
        <span className="mono" data-testid="routine-name">
          {routine.name} · {vibe.length} min · {energyLabel(vibe.energy)}
        </span>
        <span className="mono" data-testid="mix-progress">
          Step {index + 1} of 3
        </span>
      </div>
      <div
        className={styles.segments}
        role="progressbar"
        aria-label={remixing ? "Remixing" : "Making your mix"}
        aria-valuemin={0}
        aria-valuemax={STAGES.length}
        aria-valuenow={index + 1}
        aria-valuetext={`Step ${index + 1} of ${STAGES.length}: ${headline}`}
        data-testid="mix-stages"
        data-stage={progress.stage}
      >
        {STAGES.map((s, i) => (
          <span key={s.id} className={i <= index ? styles.done : undefined} />
        ))}
      </div>
      <div className={styles.bars} aria-hidden="true" data-testid="loading-bars" style={{ "--beat": `${beat}s` } as CSSProperties}>
        {BAR_HEIGHTS.map((h, i) => (
          <span key={i} style={{ height: h, animationDelay: `${-BAR_OFFSETS[i] * beat}s` }} />
        ))}
      </div>
      {/* VoiceOver hears each new stage once; the live count isn't read out on every track. */}
      <div role="status">
        <Headline text={headline} size="shared" style={{ lineHeight: 0.95 }} />
      </div>
      <p className={styles.line} data-testid="stage-line">
        {stageLine(progress, vibe)}
      </p>
    </div>
  );
}
