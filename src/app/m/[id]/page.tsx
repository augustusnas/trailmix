import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Wordmark } from "@/components/Beta";
import { Headline } from "@/components/Headline";
import { RoutineTag } from "@/components/RoutineTag";
import { getRoutine } from "@/data/routines";
import { energyLabel, genreLabel } from "@/lib/format";
import { MESSAGES } from "@/lib/messages";
import { runningMinutes } from "@/lib/mixTypes";
import { pageViewAllowed } from "@/server/limits";
import { readShare } from "@/server/shares";
import { Footer } from "./Footer";
import { SharedPlayer } from "./SharedPlayer";
import styles from "./shared.module.css";

/** Placeholder until Milestone 4 supplies the sharer's first name from Google. */
const SHARER_PLACEHOLDER = "Charles";

const getMix = cache(readShare);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const mix = await getMix((await params).id);
  return {
    title: { absolute: mix ? `${mix.name}: a Trailmix` : "Trailmix" },
    robots: { index: false, follow: false },
  };
}

// A real shared mix: read from storage only (never calls Claude or YouTube).
export default async function SharedMix({ params }: { params: Promise<{ id: string }> }) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (!(await pageViewAllowed(ip))) return <Busy />; // E17 / N16
  const mix = await getMix((await params).id);
  if (!mix) notFound(); // E16: expired or mistyped
  const routine = getRoutine(mix.routineId)!;

  return (
    <main className="screen screen--sand screen--flush">
      <header className={styles.head}>
        <div className="top-bar">
          <Wordmark color="var(--lime)" />
          <span className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.16em" }}>
            Shared by {SHARER_PLACEHOLDER}
          </span>
        </div>
        <Headline text={mix.name} size="shared" style={{ lineHeight: 0.88, letterSpacing: "-0.045em" }} />
        <div>
          <RoutineTag routine={routine} />
        </div>
        <p className="mono">
          {energyLabel(mix.energy)} · {mix.genres.map(genreLabel).join(" · ")} · {runningMinutes(mix)} min
        </p>
      </header>
      <SharedPlayer mix={mix} />
      <Footer />
    </main>
  );
}

function Busy() {
  return (
    <main className="screen screen--sand">
      <Wordmark />
      <Headline text="Hold that thought." size="screen" />
      <p style={{ fontSize: "var(--t-17)" }} data-testid="views-busy">
        {MESSAGES.viewsBusy}
      </p>
    </main>
  );
}
