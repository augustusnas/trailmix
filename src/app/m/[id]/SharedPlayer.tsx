"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import { playlistUrl } from "@/lib/mixClient";
import type { Mix, MixTrack } from "@/lib/mixTypes";
import { shareLink } from "@/lib/share";
import { setMusicApp, useSaved } from "@/lib/store";
import styles from "./shared.module.css";

/**
 * A kept mix leads with "Open the whole playlist": the real YouTube playlist, unlisted, so it opens
 * for anyone, signed in or not. Each track opens in the visitor's own music app (remembered on their
 * phone only); no app remembered yet → ask first, with three equal buttons.
 * Spotify and YouTube Music open a search for each song; Apple Music opens the exact song when
 * iTunes found it, otherwise a search.
 */
export function SharedPlayer({ mix }: { mix: Mix }) {
  const saved = useSaved();
  const app = MUSIC_APPS.find((a) => a.id === saved?.musicApp);
  const [note, setNote] = useState("");

  return (
    <>
      <div className={styles.playIn}>
        <div className={styles.playInInner} data-testid="play-in">
          {mix.playlistId && (
            <>
              <a
                href={playlistUrl(mix.playlistId)}
                target="_blank"
                rel="noopener noreferrer"
                className="cta cta--large"
                style={{ background: "var(--orange)", color: "var(--ink)" }}
                data-testid="open-playlist"
              >
                <span>Open the whole playlist</span>
                <Icon name="arrowUpRight" size={22} />
              </a>
              <p style={{ fontSize: "var(--t-15)", lineHeight: 1.35, paddingBottom: 8 }}>In YouTube Music. No sign-in needed.</p>
            </>
          )}
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
              <p className="mono" style={{ letterSpacing: "0.14em" }} data-testid="lead-app">
                Tracks open in {app.name}
              </p>
              <p className="mono" style={{ letterSpacing: "0.14em", paddingTop: 8 }}>
                Or open them in
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
          <button
            type="button"
            className={styles.share}
            onClick={async () => setNote((await shareLink(mix.shareId!, mix.name)) === "copied" ? "Link copied." : "")}
          >
            <Icon name="share" size={18} stroke={2.3} />
            <span>Share with friends</span>
          </button>
          <p role="status" className="mono">
            {note}
          </p>
        </div>
      </div>

      <div className={styles.list}>
        <section className="tracklist" aria-label="Tracks">
          {mix.tracks.map((t, i) => (
            <TrackRow key={t.key} n={i + 1} track={t} app={app} />
          ))}
        </section>
      </div>
    </>
  );
}

/** The exact Apple Music song when known; otherwise a search for the song in that app. */
function trackHref(app: MusicApp, t: MixTrack): string {
  return (app.id === "apple" && t.appleUrl) || app.trackUrl(t.artist, t.title);
}

function TrackRow({ n, track, app }: { n: number; track: MixTrack; app?: MusicApp }) {
  const { title, artist } = track;
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
    <a href={trackHref(app, track)} target="_blank" rel="noopener noreferrer" className="track">
      {inner}
      <span className="sr-only">(opens in {app.name})</span>
      <Icon name="arrowUpRight" size={18} stroke={2.3} />
    </a>
  );
}
