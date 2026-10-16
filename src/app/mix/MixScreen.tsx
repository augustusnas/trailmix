"use client";

import Link from "next/link";
import { BackLink } from "@/components/CtaLink";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { PlaylistTitle } from "@/components/PlaylistTitle";
import { PHASE_STYLE } from "@/components/phaseStyle";
import { CATEGORIES } from "@/data/categories";
import { energyLabel, genreLabel } from "@/data/fakeMix";
import { useCurrentMix } from "@/lib/useCurrentMix";
import { routineHref } from "@/lib/vibeParams";
import styles from "./mix.module.css";

const SHOWN_PER_PHASE = 3;

// The mix. FAKE tracks for now: real generation and swaps arrive in Milestone 3, saving in Milestone 4.
export function MixScreen() {
  const current = useCurrentMix();
  if (!current) return null;
  const { routine, mix, app } = current;
  const cat = CATEGORIES[routine.category];

  return (
    <>
      <header className={styles.band} style={{ background: cat.bg, color: cat.fg }} data-testid="mix-band" data-category={cat.id}>
        <div className="top-bar">
          <BackLink href={routineHref("/vibe", routine.id)} label="Back to vibe settings" color={cat.fg} />
          <span className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.12em" }} data-testid="routine-name">
            {routine.name} · {mix.length} min · {energyLabel(mix.energy)}
          </span>
        </div>
        <Headline text={mix.name} size="mix" style={{ lineHeight: 0.9 }} />
        <p className="mono" data-testid="playlist-title" style={{ letterSpacing: "0.04em", textTransform: "none" }}>
          <PlaylistTitle mix={mix} />
        </p>
        <div className={styles.chips}>
          {mix.genres.map((g) => (
            <span key={g} className="mono tag" style={{ background: "var(--ink)", color: "var(--lime)" }}>
              {genreLabel(g)}
            </span>
          ))}
          <span className="mono tag" style={{ boxShadow: `inset 0 0 0 2px ${cat.fg}` }} data-testid="running-time">
            {mix.runningMinutes} min
          </span>
        </div>
      </header>

      <div className={styles.phases}>
        {mix.phases.map((p) => {
          const ps = PHASE_STYLE[p.id];
          const shown = p.tracks.slice(0, SHOWN_PER_PHASE);
          const more = p.tracks.length - shown.length;
          return (
            <section key={p.id} className="phase" aria-label={p.label}>
              <div className="phase-head">
                <span className="mono tag" style={{ background: ps.bg, color: ps.fg }}>
                  {p.label}
                </span>
                <span className="phase-note">{p.note}</span>
              </div>
              {shown.map((t, i) => {
                const n = mix.phases.slice(0, mix.phases.indexOf(p)).reduce((s, x) => s + x.tracks.length, 0) + i + 1;
                return (
                  <div key={t.title} className="track">
                    <span className="track-n">{String(n).padStart(2, "0")}</span>
                    <span className="track-text">
                      <span className="track-title">{t.title}</span>
                      <span className="track-artist">{t.artist}</span>
                    </span>
                    <button type="button" className={styles.swap} aria-label={`Swap ${t.title} by ${t.artist}`}>
                      <Icon name="swap" size={20} stroke={2.2} />
                    </button>
                  </div>
                );
              })}
              {more > 0 && (
                <p className="mono" style={{ paddingTop: 6, letterSpacing: "0.08em" }}>
                  + {more} more tracks
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.remix}>
          Remix
        </button>
        <Link href={routineHref("/saved", routine.id)} className={styles.keep} data-testid="mix-action">
          {app.mixAction}
        </Link>
      </div>
    </>
  );
}
