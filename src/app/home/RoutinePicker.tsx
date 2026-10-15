"use client";

import Link from "next/link";
import { useState } from "react";
import { CtaLink } from "@/components/CtaLink";
import { Icon } from "@/components/Icon";
import { CATEGORIES } from "@/data/categories";
import { MAX_PINS, type Routine } from "@/data/routines";
import styles from "./home.module.css";

/** Pinned routine tiles. Tap one to choose it, then "Set the vibe" carries it on. */
export function RoutinePicker({ pins }: { pins: Routine[] }) {
  const [picked, setPicked] = useState(pins[0]?.id);
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
              onClick={() => setPicked(r.id)}
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
        <Link href="/library" className={`${styles.tile} ${styles.pinAnother}`}>
          <span className={styles.tileTop}>
            <span className="mono">
              {pins.length} of {MAX_PINS}
            </span>
            <span className={styles.plus} aria-hidden="true">
              <Icon name="plus" size={20} stroke={3} />
            </span>
          </span>
          <span className={styles.tileName}>Pin another</span>
        </Link>
      </div>
      </div>
      <CtaLink href={`/vibe?routine=${picked}`} bg="var(--orange)" fg="var(--ink)">
        Set the vibe
      </CtaLink>
    </>
  );
}
