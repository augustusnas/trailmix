"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/CtaLink";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { RoutineTag } from "@/components/RoutineTag";
import { ENERGIES, GENRES, LENGTHS, MAX_GENRES } from "@/data/vibe";
import { saveVibe, setCurrentMix, useSaved, vibeFor, type VibeSettings } from "@/lib/store";
import { useOnline } from "@/lib/useOnline";
import { routineFromParams, routineHref } from "@/lib/vibeParams";
import styles from "./vibe.module.css";

function selected(on: boolean, color: string) {
  return on ? { background: color, borderColor: color, color: "var(--ink)" } : undefined;
}

export function VibeScreen() {
  const router = useRouter();
  const routine = routineFromParams(useSearchParams());
  const saved = useSaved();

  useEffect(() => {
    if (!routine) router.replace("/home"); // never guess a routine (F21)
  }, [routine, router]);

  if (!routine) return null;
  return (
    <>
      <div className="top-bar">
        <BackLink href="/home" label="Back to routines" color="var(--sand)" />
        <RoutineTag routine={routine} />
      </div>
      <Headline text="Set the vibe." size="screen" />
      {/* Wait for this routine's saved settings so they don't flicker in. */}
      {saved && <Picker key={routine.id} routineId={routine.id} initial={vibeFor(saved, routine.id)} />}
    </>
  );
}

function Picker({ routineId, initial }: { routineId: string; initial: VibeSettings }) {
  const router = useRouter();
  const [genres, setGenres] = useState(initial.genres);
  const [energy, setEnergy] = useState(initial.energy);
  const [length, setLength] = useState(initial.length);
  const [missingGenre, setMissingGenre] = useState(false);
  const online = useOnline();

  const atLimit = genres.length >= MAX_GENRES;

  const toggleGenre = (id: string) => {
    setMissingGenre(false);
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length >= MAX_GENRES ? g : [...g, id]));
  };

  const makeTheMix = () => {
    if (genres.length === 0) {
      setMissingGenre(true); // F8: say so beside the genres; don't save, don't move on
      return;
    }
    saveVibe(routineId, { genres, energy, length }); // F7
    setCurrentMix(null); // a fresh mix for these settings
    router.push(routineHref("/mix", routineId));
  };

  return (
    <>
      <fieldset className={styles.group} aria-describedby="genre-message">
        <legend className="mono" style={{ letterSpacing: "0.14em" }}>
          Sounds like · pick up to {MAX_GENRES}
        </legend>
        <div className={styles.chips}>
          {GENRES.map((g) => {
            const on = genres.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                className="chip"
                aria-pressed={on}
                disabled={!on && atLimit}
                onClick={() => toggleGenre(g.id)}
                style={selected(on, "var(--lime)")}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <p id="genre-message" className={styles.message} role="status" aria-live="polite" data-testid="genre-message">
          {missingGenre ? "Pick at least one genre." : atLimit ? `That’s ${MAX_GENRES}. Untick one to swap.` : ""}
        </p>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="mono" style={{ letterSpacing: "0.14em" }}>
          Energy
        </legend>
        <div className={styles.segments}>
          {ENERGIES.map((e) => (
            <button
              key={e.id}
              type="button"
              className={styles.segment}
              aria-pressed={energy === e.id}
              onClick={() => setEnergy(e.id)}
              style={selected(energy === e.id, "var(--lilac)")}
            >
              {e.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className="mono" style={{ letterSpacing: "0.14em" }}>
          Length · minutes
        </legend>
        <div className={styles.segments}>
          {LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.segment} ${styles.number}`}
              aria-pressed={length === l}
              aria-label={`${l} minutes`}
              onClick={() => setLength(l)}
              style={selected(length === l, "var(--sand)")}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="spacer" />
      {!online && (
        <p className={styles.offline} role="status" data-testid="offline-banner">
          You’re offline. You can still set the vibe; Make the mix comes back when you’re connected.
        </p>
      )}
      <button
        type="button"
        onClick={makeTheMix}
        disabled={!online}
        className="cta cta--large"
        style={{ background: "var(--orange)", color: "var(--ink)", opacity: online ? 1 : 0.45 }}
      >
        <span>Make the mix</span>
        <Icon name="arrowRight" />
      </button>
    </>
  );
}
