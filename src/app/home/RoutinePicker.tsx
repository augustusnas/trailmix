"use client";

import Link from "next/link";
import { useState } from "react";
import { CtaLink } from "@/components/CtaLink";
import { Icon } from "@/components/Icon";
import { CATEGORIES } from "@/data/categories";
import { MAX_PINS, getRoutine, type Routine } from "@/data/routines";
import { useSaved } from "@/lib/store";
import { routineHref } from "@/lib/vibeParams";
import styles from "./home.module.css";

/** Pinned routine tiles. Tap one to choose it, then "Set the vibe" carries it on. */
export function RoutinePicker() {
  const saved = useSaved();
  const [chosen, setChosen] = useState<string | undefined>();

  // Until the phone's saved pins are read (a split second), keep the space empty rather than guess.
  if (!saved) return <div className={styles.gridWrap} aria-busy="true" />;

  const pins = saved.pins.map((id) => getRoutine(id)).filter((r): r is Routine => Boolean(r));
  if (pins.length === 0) {
    return (
      <div className={styles.empty} data-testid="home-empty">
        <p className={styles.emptyText}>Pin a routine to get started.</p>
        <CtaLink href="/library" bg="var(--lime)" fg="var(--ink)">
          Open the library
        </CtaLink>
      </div>
    );
  }

  const picked = pins.find((r) => r.id === chosen)?.id ?? pins[0].id;
  const full = pins.length >= MAX_PINS;

  return (
    <>
      <div className={styles.gridWrap}>
        <div className={styles.grid}>
          {pins.map((r, i) => {
            const cat = CATEGORIES[r.category];
            const on = r.id === picked;
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() => setChosen(r.id)}
                className={styles.tile}
                data-routine={r.id}
                style={{ background: cat.bg, color: cat.fg, outline: on ? "3px solid var(--sand)" : "none" }}
              >
                <span className={`mono ${styles.tileTop}`}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>{cat.label}</span>
                </span>
                <span className={styles.tileName}>{r.name}</span>
              </button>
            );
          })}
          <Link href="/library" className={`${styles.tile} ${styles.pinAnother}`} data-testid="pin-another">
            <span className={styles.tileTop}>
              <span className="mono">
                {pins.length} of {MAX_PINS}
              </span>
              {!full && (
                <span className={styles.plus} aria-hidden="true">
                  <Icon name="plus" size={20} stroke={3} />
                </span>
              )}
            </span>
            <span className={styles.tileName}>{full ? "Home is full" : "Pin another"}</span>
          </Link>
        </div>
      </div>
      <CtaLink href={routineHref("/vibe", picked)} bg="var(--orange)" fg="var(--ink)">
        Set the vibe
      </CtaLink>
    </>
  );
}
