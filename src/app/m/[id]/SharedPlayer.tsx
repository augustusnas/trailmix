"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { PHASE_STYLE } from "@/components/phaseStyle";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import type { Mix, Track } from "@/data/fakeMix";
import styles from "./shared.module.css";

// FAKE links: each track opens a search in the chosen app. Real Songlink/Odesli links arrive in Milestone 3.
function trackUrl(app: MusicApp["id"], t: Track): string {
  const q = encodeURIComponent(`${t.artist} ${t.title}`);
  if (app === "spotify") return `https://open.spotify.com/search/${q}`;
  if (app === "apple") return `https://music.apple.com/search?term=${q}`;
  return `https://music.youtube.com/search?q=${q}`;
}

export function SharedPlayer({ mix }: { mix: Mix }) {
  const [appId, setAppId] = useState<MusicApp["id"]>("ytm");
  const app = MUSIC_APPS.find((a) => a.id === appId)!;
  let n = 0;

  return (
    <>
      <div className={styles.playIn}>
        <div className={styles.playInInner}>
          <p className="mono" style={{ letterSpacing: "0.14em" }}>
            Play it in
          </p>
          <div className={styles.apps} role="group" aria-label="Music app">
            {MUSIC_APPS.map((a) => {
              const on = a.id === appId;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAppId(a.id)}
                  className={styles.app}
                  style={on ? { background: "var(--lime)", borderColor: "var(--lime)", color: "var(--ink)" } : undefined}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
          {appId === "ytm" ? (
            <a
              href="https://music.youtube.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="cta cta--medium"
              style={{ background: "var(--orange)", color: "var(--ink)", marginTop: 4 }}
            >
              <span>Open the whole playlist</span>
              <Icon name="arrowUpRight" size={22} />
            </a>
          ) : (
            <p style={{ fontSize: "0.882rem", lineHeight: 1.35, paddingTop: 4 }}>Tap any track to open it in {app.name}.</p>
          )}
        </div>
      </div>

      <div className={styles.phases}>
        {mix.phases.map((p) => {
          const ps = PHASE_STYLE[p.id];
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
              {p.tracks.map((t) => {
                n += 1;
                return (
                  <a
                    key={t.title}
                    href={trackUrl(appId, t)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="track"
                  >
                    <span className="track-n">{String(n).padStart(2, "0")}</span>
                    <span className="track-text">
                      <span className="track-title">{t.title}</span>
                      <span className="track-artist">{t.artist}</span>
                    </span>
                    <span className="sr-only">(opens in {app.name})</span>
                    <Icon name="arrowUpRight" size={18} stroke={2.3} />
                  </a>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}
