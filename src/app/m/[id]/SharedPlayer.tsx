"use client";

import { Icon } from "@/components/Icon";
import { PHASE_STYLE } from "@/components/phaseStyle";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import type { Mix } from "@/data/fakeMix";
import { setMusicApp, useSaved } from "@/lib/store";
import styles from "./shared.module.css";

/**
 * Leads with the visitor's own music app (remembered on their phone only).
 * No app remembered yet → ask first, with three equal buttons.
 * FAKE links until Milestone 3: tracks open a search in the chosen app.
 */
export function SharedPlayer({ mix }: { mix: Mix }) {
  const saved = useSaved();
  const app = MUSIC_APPS.find((a) => a.id === saved?.musicApp);
  const first = mix.phases[0].tracks[0];

  return (
    <>
      <div className={styles.playIn}>
        <div className={styles.playInInner} data-testid="play-in">
          {!saved ? null : !app ? (
            <>
              <h2 className={styles.ask}>Where do you listen?</h2>
              <div className={styles.apps} role="group" aria-label="Where do you listen?">
                {MUSIC_APPS.map((a) => (
                  <button key={a.id} type="button" className={styles.app} onClick={() => setMusicApp(a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mono" style={{ letterSpacing: "0.14em" }}>
                Play it in
              </p>
              <a
                href={app.id === "ytm" ? app.homeUrl : app.trackUrl(first.artist, first.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="cta cta--large"
                style={{ background: "var(--orange)", color: "var(--ink)" }}
                data-testid="lead-app"
              >
                <span>{app.id === "ytm" ? "Open the whole playlist in YouTube Music" : app.openAction}</span>
                <Icon name="arrowUpRight" size={22} />
              </a>
              {app.id !== "ytm" && (
                <p style={{ fontSize: "var(--t-15)", lineHeight: 1.35 }}>Then tap any track below to open it in {app.name}.</p>
              )}
              <p className="mono" style={{ letterSpacing: "0.14em", paddingTop: 8 }}>
                Or play it in
              </p>
              <div className={styles.apps} role="group" aria-label="Other music apps">
                {MUSIC_APPS.filter((a) => a.id !== app.id).map((a) => (
                  <button key={a.id} type="button" className={`${styles.app} ${styles.appSmall}`} onClick={() => setMusicApp(a.id)}>
                    {a.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.phases}>
        {mix.phases.map((p, pi) => {
          const ps = PHASE_STYLE[p.id];
          const before = mix.phases.slice(0, pi).reduce((n, x) => n + x.tracks.length, 0);
          return (
            <section key={p.id} className="phase" aria-label={p.label}>
              <div className="phase-head">
                <span
                  className="mono tag"
                  style={p.id === "main" ? { background: "var(--orange)", color: "var(--ink)" } : { background: ps.bg, color: ps.fg }}
                >
                  {p.label}
                </span>
              </div>
              {p.tracks.map((t, i) => (
                <TrackRow key={t.title} n={before + i + 1} title={t.title} artist={t.artist} app={app} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

function TrackRow({ n, title, artist, app }: { n: number; title: string; artist: string; app?: MusicApp }) {
  const inner = (
    <>
      <span className="track-n">{String(n).padStart(2, "0")}</span>
      <span className="track-text">
        <span className="track-title">{title}</span>
        <span className="track-artist">{artist}</span>
      </span>
    </>
  );
  if (!app) return <div className="track">{inner}</div>;
  return (
    <a href={app.trackUrl(artist, title)} target="_blank" rel="noopener noreferrer" className="track">
      {inner}
      <span className="sr-only">(opens in {app.name})</span>
      <Icon name="arrowUpRight" size={18} stroke={2.3} />
    </a>
  );
}
