"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CtaLink } from "@/components/CtaLink";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { RoutineTag } from "@/components/RoutineTag";
import { TodayDate } from "@/components/TodayDate";
import { appOrDefault } from "@/data/apps";
import { energyLabel, genreLabel } from "@/lib/format";
import { playlistUrl } from "@/lib/mixClient";
import { runningMinutes } from "@/lib/mixTypes";
import { shareLink } from "@/lib/share";
import { useSaved } from "@/lib/store";
import { routineFromParams, routineHref } from "@/lib/vibeParams";
import styles from "./saved.module.css";

// Saved: the mix you kept. For YouTube Music users it's a real playlist in their account, and
// "Open in YouTube Music" opens it; otherwise the button opens the shared mix page.
export function SavedScreen() {
  const router = useRouter();
  const routine = routineFromParams(useSearchParams());
  const saved = useSaved();
  const mix = saved?.currentMix?.routineId === routine?.id && saved?.currentMix?.shareId ? saved.currentMix : null;
  const [shared, setShared] = useState("");
  useEffect(() => {
    if (!routine) router.replace("/home");
    else if (saved && !mix) router.replace(routineHref("/mix", routine.id));
  }, [routine, saved, mix, router]);

  if (!routine || !saved || !mix) return null;
  const app = appOrDefault(saved.musicApp);
  const genres = mix.genres.map(genreLabel).join(" · ");

  return (
    <>
      <div className="top-bar mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.14em" }}>
        <span>Saved</span>
        <span>
          {mix.tracks.length} tracks · {runningMinutes(mix)} min
        </span>
      </div>
      <Headline text={app.id === "ytm" ? `${mix.name} is ready to play.` : `Your mix is ready to play in ${app.name}, track by track.`} size="saved" style={{ lineHeight: 0.9, letterSpacing: "-0.04em" }} />

      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={`mono ${styles.cardTop}`}>
            <span style={{ color: "var(--lime)" }}>Trailmix</span>
            <span>Track by track</span>
          </div>
          <div className={styles.cardName}>{mix.name}</div>
          <div className={styles.bars} aria-hidden="true">
            <span style={{ flex: "2 1 0", background: "var(--lilac)" }} />
            <span style={{ flex: "7 1 0", background: "var(--orange)" }} />
            <span style={{ flex: "2 1 0", background: "var(--forest)", outline: "1px solid rgba(234,223,200,0.4)" }} />
          </div>
          <div>
            <RoutineTag routine={routine} />
          </div>
          <div className="mono" style={{ letterSpacing: "0.08em", fontWeight: 400 }}>
            {energyLabel(mix.energy)}
            {genres ? ` · ${genres}` : ""} · <TodayDate upper />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        {/* A tapped music.youtube.com link opens the YouTube Music app (opened by the page itself, it wouldn't). */}
        <CtaLink
          href={app.id === "ytm" && mix.playlistId ? playlistUrl(mix.playlistId) : `/m/${mix.shareId}`}
          external={app.id === "ytm" && !!mix.playlistId}
          bg="var(--ink)"
          fg="var(--lime)"
          icon="arrowUpRight"
        >
          <span data-testid="saved-action">{app.openAction}</span>
        </CtaLink>
        <button
          type="button"
          className={styles.share}
          onClick={async () => setShared((await shareLink(mix.shareId!, mix.name)) === "copied" ? "Link copied." : "")}
        >
          <Icon name="share" size={20} stroke={2.3} />
          <span>Share with friends</span>
        </button>
        <p role="status" className="mono" style={{ textAlign: "center" }}>
          {shared}
        </p>
        <Link href="/home" className={`mono ${styles.back}`}>
          Back to home
        </Link>
      </div>
    </>
  );
}
