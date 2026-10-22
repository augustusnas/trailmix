"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { CATEGORIES } from "@/data/categories";
import type { Routine } from "@/data/routines";
import { ENERGIES, GENRES, LENGTHS, MAX_GENRES } from "@/data/vibe";
import { energyLabel, genreLabel } from "@/lib/format";
import { saveVibe, setCurrentMix, useSaved, vibeFor, type VibeSettings } from "@/lib/store";
import { useOnline } from "@/lib/useOnline";
import { routineFromParams, routineHref } from "@/lib/vibeParams";
import styles from "./vibe.module.css";

// Set the vibe (Milestone 5, concept B): one question per screen. Genres on Lime, Energy on Lilac,
// Length on Orange. Nothing animates here except a short highlight and the energy bars' height;
// under Reduce Motion those go too (globals.css).

const STEPS = [
  { screen: "screen--lime", question: "What are you into today?" },
  { screen: "screen--lilac", question: "How hard are you going?" },
  { screen: "screen--orange", question: "How long have you got?" },
] as const;

/** Tapping an energy level moves on to Length after this long (a second tap restarts it). */
export const ENERGY_ADVANCE_MS = 550;

/** The energy bars: 7 still bars rising to the middle, scaled by the energy level. */
const BAR_HEIGHTS = [90, 120, 150, 170, 150, 120, 90];
const BAR_SCALE: Record<string, number> = { easy: 0.4, steady: 0.6, driven: 0.8, feral: 1 };

export function VibeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const routine = routineFromParams(params);
  const saved = useSaved();

  useEffect(() => {
    if (!routine) router.replace("/home"); // never guess a routine (F21)
  }, [routine, router]);

  if (!routine) return null;
  return (
    // Wait for this routine's saved settings so they don't flicker in.
    saved ? (
      <Steps
        key={routine.id}
        routine={routine}
        initial={vibeFor(saved, routine.id)}
        last={saved.vibes[routine.id]}
        backTo={params.get("from") === "library" ? "/library" : "/home"}
      />
    ) : (
      <main className="screen screen--lime" />
    )
  );
}

function Steps({ routine, initial, last, backTo }: { routine: Routine; initial: VibeSettings; last?: VibeSettings; backTo: string }) {
  const router = useRouter();
  const online = useOnline();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState(initial.genres);
  const [energy, setEnergy] = useState(initial.energy);
  const [length, setLength] = useState(initial.length);
  const [missingGenre, setMissingGenre] = useState(false);
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heading = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => () => clearTimeout(advance.current), []);

  // Each new step: VoiceOver starts at its question ("Step N of 3" is read with it).
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.querySelector("h1")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step]);

  const goTo = (n: number) => {
    clearTimeout(advance.current);
    moved.current = true;
    setMissingGenre(false);
    setStep(n);
  };

  const back = () => (step === 0 ? router.push(backTo) : goTo(step - 1));

  const atLimit = genres.length >= MAX_GENRES;
  const toggleGenre = (id: string) => {
    setMissingGenre(false);
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length >= MAX_GENRES ? g : [...g, id]));
  };

  // F8: say so instead of moving on.
  const nextFromGenres = () => (genres.length === 0 ? setMissingGenre(true) : goTo(1));

  // V4: highlight at once, move on once, after the pause; another tap switches and restarts the pause.
  const pickEnergy = (id: string) => {
    setEnergy(id);
    clearTimeout(advance.current);
    advance.current = setTimeout(() => goTo(2), ENERGY_ADVANCE_MS);
  };

  // V3: the routine's last vibe, all three at once, straight to Length.
  const sameAsLast = () => {
    if (!last) return;
    setGenres(last.genres);
    setEnergy(last.energy);
    setLength(last.length);
    goTo(2);
  };

  const makeTheMix = () => {
    saveVibe(routine.id, { genres, energy, length }); // F7
    setCurrentMix(null); // a fresh mix for these settings
    router.push(routineHref("/mix", routine.id));
  };

  const s = STEPS[step];
  const cat = CATEGORIES[routine.category];
  const genreSummary = genres.map(genreLabel).join(" + ");

  return (
    <main className={`screen ${s.screen} ${styles.screen}`} data-testid="vibe-step" data-step={step + 1}>
      <div className={styles.top}>
        <button type="button" className="icon-btn" aria-label={step === 0 ? (backTo === "/library" ? "Back to the Library" : "Back to routines") : "Back"} onClick={back}>
          <Icon name="arrowLeft" size={20} />
        </button>
        {/* F21: the routine's name, and its colour as a dot (a coloured tag would vanish on the orange step). */}
        <p className={`mono ${styles.where}`} data-testid="vibe-routine" data-category={cat.id}>
          <span className={styles.dot} style={{ background: cat.bg }} aria-hidden="true" />
          <span>
            {routine.name} · Step {step + 1} of 3
          </span>
        </p>
      </div>
      <div className={styles.progress} aria-hidden="true">
        {STEPS.map((_, i) => (
          <span key={i} className={i <= step ? styles.done : undefined} />
        ))}
      </div>

      <div ref={heading} className={styles.question}>
        <Headline text={s.question} size="mix" style={{ lineHeight: 0.95 }} focusable />
      </div>

      {step === 0 && (
        <>
          {last && last.genres.length > 0 && (
            <button type="button" className={styles.same} onClick={sameAsLast} data-testid="same-as-last">
              Same as last time
              <span className="mono">
                {last.genres.map(genreLabel).join(" + ")} · {energyLabel(last.energy)} · {last.length} min
              </span>
            </button>
          )}
          <div className={styles.genres} role="group" aria-label={`Genres, up to ${MAX_GENRES}`} aria-describedby="genre-message">
            {GENRES.map((g) => {
              const on = genres.includes(g.id);
              return (
                <button key={g.id} type="button" className={styles.tile} aria-pressed={on} disabled={!on && atLimit} onClick={() => toggleGenre(g.id)}>
                  {g.label}
                </button>
              );
            })}
          </div>
          <p id="genre-message" className={styles.message} role="status" aria-live="polite" data-testid="genre-message">
            {missingGenre ? "Pick at least one genre." : atLimit ? `That’s ${MAX_GENRES}. Untick one to swap.` : ""}
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <div className={styles.bars} aria-hidden="true" data-testid="energy-bars">
            {BAR_HEIGHTS.map((h, i) => (
              <span key={i} style={{ height: Math.round(h * (BAR_SCALE[energy] ?? 0.6)) }} />
            ))}
          </div>
          <div className={styles.energies} role="group" aria-label="Energy">
            {ENERGIES.map((e) => (
              <button key={e.id} type="button" className={styles.energy} aria-pressed={energy === e.id} onClick={() => pickEnergy(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className={styles.summary}>
            <button type="button" className={styles.chip} aria-label={`Change genres: ${genreSummary}`} onClick={() => goTo(0)} data-testid="genre-chip">
              {genreSummary} <span aria-hidden="true">✎</span>
            </button>
            <button type="button" className={styles.chip} aria-label={`Change energy: ${energyLabel(energy)}`} onClick={() => goTo(1)} data-testid="energy-chip">
              {energyLabel(energy)} <span aria-hidden="true">✎</span>
            </button>
          </div>
          <div className={styles.lengths} role="group" aria-label="Length">
            {LENGTHS.map((l) => (
              <button key={l} type="button" className={styles.length} aria-pressed={length === l} onClick={() => setLength(l)}>
                {l} <span className="mono">min</span>
              </button>
            ))}
          </div>
          <FinishTime minutes={length} />
        </>
      )}

      <div className="spacer" />
      {step === 2 && !online && (
        <p className={styles.offline} role="status" data-testid="offline-banner">
          You’re offline. You can still set the vibe; Make the mix comes back when you’re connected.
        </p>
      )}
      {step === 0 && (
        <button type="button" className={styles.next} onClick={nextFromGenres}>
          Next
        </button>
      )}
      {/* Tapping a level moves on by itself; Next is always there too, so VoiceOver never depends on the pause. */}
      {step === 1 && (
        <button type="button" className={styles.next} onClick={() => goTo(2)}>
          Next
        </button>
      )}
      {step === 2 && (
        <button type="button" className={styles.next} onClick={makeTheMix} disabled={!online}>
          Make the mix
        </button>
      )}
    </main>
  );
}

/** "Finishes at 7:52pm": now plus the length, kept current while the screen is open. */
export function finishTime(now: Date, minutes: number): string {
  const end = new Date(now.getTime() + minutes * 60_000);
  const h = end.getHours() % 12 || 12;
  return `Finishes at ${h}:${String(end.getMinutes()).padStart(2, "0")}${end.getHours() < 12 ? "am" : "pm"}`;
}

function FinishTime({ minutes }: { minutes: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className={`mono ${styles.finish}`} data-testid="finish-time">
      {now ? finishTime(now, minutes) : " "}
    </p>
  );
}
