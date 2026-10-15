import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CtaLink } from "@/components/CtaLink";
import { Icon } from "@/components/Icon";
import { RoutineTag } from "@/components/RoutineTag";
import { TodayDate } from "@/components/TodayDate";
import { energyLabel, fakeMix, genreLabel, trackCount } from "@/data/fakeMix";
import { parseVibe, type SearchParams } from "@/lib/vibeParams";
import styles from "./saved.module.css";

export const metadata: Metadata = { title: "Saved" };

// Saved. FAKE: nothing is saved yet. Real links arrive in Milestone 4, the share sheet in Milestone 3.
export default async function Saved({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const vibe = parseVibe(await searchParams);
  if (!vibe) redirect("/home");
  const mix = fakeMix(vibe.routine, vibe);
  const genres = mix.genres.map(genreLabel).join(" · ");

  return (
    <main className="screen screen--lilac">
      <div className="top-bar mono" style={{ fontSize: "0.706rem", letterSpacing: "0.14em" }}>
        <span>Saved</span>
        <span>
          {trackCount(mix)} tracks · {mix.runningMinutes} min
        </span>
      </div>
      <h1 className="headline" style={{ fontSize: "clamp(2.5rem, 14.36vw, 3.294rem)", lineHeight: 0.9, letterSpacing: "-0.04em" }}>
        {mix.name} is in YouTube Music.
      </h1>

      <div className={styles.cardWrap}>
        <div className={styles.card}>
          <div className={`mono ${styles.cardTop}`}>
            <span style={{ color: "var(--lime)" }}>Trailmix</span>
            <span>Unlisted</span>
          </div>
          <div className={styles.cardName}>{mix.name}</div>
          <div className={styles.bars} aria-hidden="true">
            <span style={{ flex: "2 1 0", background: "var(--lilac)" }} />
            <span style={{ flex: "7 1 0", background: "var(--orange)" }} />
            <span style={{ flex: "2 1 0", background: "var(--forest)", outline: "1px solid rgba(234,223,200,0.4)" }} />
          </div>
          <div>
            <RoutineTag routine={vibe.routine} />
          </div>
          <div className="mono" style={{ letterSpacing: "0.08em", fontWeight: 400 }}>
            {energyLabel(mix.energy)}
            {genres ? ` · ${genres}` : ""} · <TodayDate upper />
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <CtaLink href="https://music.youtube.com/" external bg="var(--ink)" fg="var(--lime)" icon="arrowUpRight">
          Open in YouTube Music
        </CtaLink>
        <Link href={`/m/${vibe.routine.id}`} className={styles.share}>
          <Icon name="share" size={20} stroke={2.3} />
          <span>Share with friends</span>
        </Link>
        <Link href="/home" className={`mono ${styles.back}`}>
          Back to home
        </Link>
      </div>
    </main>
  );
}
