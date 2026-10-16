"use client";

import Link from "next/link";
import { CtaLink } from "@/components/CtaLink";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { RoutineTag } from "@/components/RoutineTag";
import { TodayDate } from "@/components/TodayDate";
import { energyLabel, genreLabel, trackCount } from "@/data/fakeMix";
import { useCurrentMix } from "@/lib/useCurrentMix";
import styles from "./saved.module.css";

// Saved. FAKE: nothing is saved yet. Real links arrive in Milestone 4, the share sheet in Milestone 3.
export function SavedScreen() {
  const current = useCurrentMix();
  if (!current) return null;
  const { routine, mix, app } = current;
  const genres = mix.genres.map(genreLabel).join(" · ");

  return (
    <>
      <div className="top-bar mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.14em" }}>
        <span>Saved</span>
        <span>
          {trackCount(mix)} tracks · {mix.runningMinutes} min
        </span>
      </div>
      <Headline text={app.id === "ytm" ? `${mix.name} is in YouTube Music.` : `${mix.name} is ready for ${app.name}.`} size="saved" style={{ lineHeight: 0.9, letterSpacing: "-0.04em" }} />

      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={`mono ${styles.cardTop}`}>
            <span style={{ color: "var(--lime)" }}>Trailmix</span>
            <span>{app.id === "ytm" ? "Unlisted" : "Track by track"}</span>
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
        <CtaLink href={app.homeUrl} external bg="var(--ink)" fg="var(--lime)" icon="arrowUpRight">
          <span data-testid="saved-action">{app.openAction}</span>
        </CtaLink>
        <Link href={`/m/${routine.id}`} className={styles.share}>
          <Icon name="share" size={20} stroke={2.3} />
          <span>Share with friends</span>
        </Link>
        <Link href="/home" className={`mono ${styles.back}`}>
          Back to home
        </Link>
      </div>
    </>
  );
}
