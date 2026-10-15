import type { Metadata } from "next";
import { Wordmark } from "@/components/Beta";
import { Credit } from "@/components/Credit";
import { SHOW_BETA } from "@/config/site";
import { energyLabel, fakeMix, genreLabel } from "@/data/fakeMix";
import { getRoutine, ROUTINES } from "@/data/routines";
import { defaultLength, DEFAULT_ENERGY, DEFAULT_GENRES } from "@/data/vibe";
import { SharedPlayer } from "./SharedPlayer";
import styles from "./shared.module.css";

// FAKE: any id shows a made-up mix. Real stored mixes, expiry and rate limits arrive in Milestone 3.
function mixFor(id: string) {
  const routine = getRoutine(id) ?? ROUTINES[0];
  return fakeMix(routine, { energy: DEFAULT_ENERGY, genres: DEFAULT_GENRES, length: defaultLength(routine.minutes) });
}
const FAKE_SHARER = "Charles";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const mix = mixFor((await params).id);
  return {
    title: { absolute: `${mix.name}: a Trailmix` },
    robots: { index: false, follow: false },
  };
}

export default async function SharedMix({ params }: { params: Promise<{ id: string }> }) {
  const mix = mixFor((await params).id);
  return (
    <main className="screen screen--sand screen--flush">
      <header className={styles.head}>
        <div className="top-bar">
          <Wordmark color="var(--lime)" />
          <span className="mono" style={{ fontSize: "0.706rem", letterSpacing: "0.16em" }}>
            Shared by {FAKE_SHARER}
          </span>
        </div>
        <h1 className="headline" style={{ fontSize: "clamp(2.6rem, 15.4vw, 3.529rem)", lineHeight: 0.88, letterSpacing: "-0.045em" }}>
          {mix.name}
        </h1>
        <p className="mono">
          {mix.routine.name} · {energyLabel(mix.energy)} · {mix.genres.map(genreLabel).join(" · ")} · {mix.length} min
        </p>
      </header>
      <SharedPlayer mix={mix} />
      <footer className={styles.foot}>
        {SHOW_BETA && <p data-testid="beta-label">Trailmix is in invite-only beta</p>}
        <p>Track links by Songlink/Odesli</p>
        <Credit linkColor="var(--ink)" />
      </footer>
    </main>
  );
}
