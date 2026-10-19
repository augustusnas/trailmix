"use client";

import { Icon } from "@/components/Icon";
import { PHASE_STYLE } from "@/components/phaseStyle";
import { MUSIC_APPS, type MusicApp } from "@/data/apps";
import { PHASES, type Mix, type MixTrack } from "@/lib/mixTypes";
import { setMusicApp, useSaved } from "@/lib/store";
import styles from "./shared.module.css";

/**
 * Leads with the visitor's own music app (remembered on their phone only).
 * No app remembered yet → ask first, with three equal buttons.
 * Track links come from Odesli; a track without a link for that app falls back to a search there.
 */
export function SharedPlayer({ mix }: { mix: Mix }) {
  const saved = useSaved();
  const app = MUSIC_APPS.find((a) => a.id === saved?.musicApp);
  const first = mix.tracks[0];
  const ids = mix.tracks.map((t) => t.youtubeId);
  // "Open the whole playlist" only when every track has a YouTube video id.
  const wholePlaylist = ids.every(Boolean) ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}` : null;

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
                href={app.id === "ytm" && wholePlaylist ? wholePlaylist : trackHref(app, first)}
                target="_blank"
                rel="noopener noreferrer"
                className="cta cta--large"
                style={{ background: "var(--orange)", color: "var(--ink)" }}
                data-testid="lead-app"
              >
                <span>{app.id === "ytm" && wholePlaylist ? "Open the whole playlist" : app.openAction}</span>
                <Icon name="arrowUpRight" size={22} />
              </a>
              {!(app.id === "ytm" && wholePlaylist) && (
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
        {PHASES.map((p) => {
          const tracks = mix.tracks.map((t, i) => ({ t, i })).filter(({ t }) => t.phase === p.id);
          if (!tracks.length) return null;
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
              {tracks.map(({ t, i }) => (
                <TrackRow key={t.key} n={i + 1} track={t} app={app} />
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}

/** The track's own link for that app, or a search there if Odesli didn't have one. */
function trackHref(app: MusicApp, t: MixTrack): string {
  const own = app.id === "ytm" ? (t.youtubeMusicUrl ?? (t.youtubeId ? `https://music.youtube.com/watch?v=${t.youtubeId}` : undefined)) : app.id === "spotify" ? t.spotifyUrl : t.appleUrl;
  return own ?? app.trackUrl(t.artist, t.title);
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
