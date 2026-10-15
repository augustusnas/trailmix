"use client";

import { useState } from "react";
import { CtaLink } from "@/components/CtaLink";
import { ENERGIES, GENRES, LENGTHS } from "@/data/vibe";
import { vibeQuery, type Vibe } from "@/lib/vibeParams";
import styles from "./vibe.module.css";

function selected(on: boolean, color: string) {
  return on ? { background: color, borderColor: color, color: "var(--ink)" } : undefined;
}

export function VibePicker({ initial }: { initial: Vibe }) {
  const [genres, setGenres] = useState(initial.genres);
  const [energy, setEnergy] = useState(initial.energy);
  const [length, setLength] = useState(initial.length);

  const toggleGenre = (id: string) =>
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

  const href = `/mix?${vibeQuery({ routine: initial.routine, genres, energy, length })}`;

  return (
    <>
      <fieldset className={styles.group}>
        <legend className="mono" style={{ letterSpacing: "0.14em" }}>
          Sounds like · pick a few
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
                onClick={() => toggleGenre(g.id)}
                style={selected(on, "var(--lime)")}
              >
                {g.label}
              </button>
            );
          })}
        </div>
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
      <CtaLink href={href} bg="var(--orange)" fg="var(--ink)">
        Make the mix
      </CtaLink>
    </>
  );
}
