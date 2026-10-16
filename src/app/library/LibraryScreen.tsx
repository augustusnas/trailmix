"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BackLink } from "@/components/CtaLink";
import { Credit } from "@/components/Credit";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "@/data/categories";
import { MAX_PINS, ROUTINES, minutesLabel } from "@/data/routines";
import { searchRoutines } from "@/lib/search";
import { pin, unpin, useSaved } from "@/lib/store";
import { routineHref } from "@/lib/vibeParams";
import { ListeningOn } from "./ListeningOn";
import styles from "./library.module.css";

const SEARCH_HINT = "Tabata, push day, rowing…";
const ORDERED = CATEGORY_ORDER.flatMap((c) => ROUTINES.filter((r) => r.category === c));

/** Beta only: tap the headline this many times quickly to open the reset page. */
const RESET_TAPS = 5;

export function LibraryScreen({ feedbackEmail }: { feedbackEmail?: string }) {
  const saved = useSaved();
  const router = useRouter();
  // Search and filter live only while you're on the Library.
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const taps = useRef<number[]>([]);

  const pins = saved?.pins ?? [];
  const full = pins.length >= MAX_PINS;
  const shown = searchRoutines(ORDERED, query, filter);

  const tapHeadline = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= RESET_TAPS) router.push("/reset");
  };

  const clear = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <>
      <div className="top-bar">
        <BackLink href="/home" label="Back to home" color="var(--sand)" />
        <span className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.12em" }} data-testid="pin-count">
          {saved ? `${pins.length} of ${MAX_PINS} on home` : ""}
        </span>
      </div>

      {full && (
        <p className={`mono ${styles.full}`} role="status" data-testid="home-full">
          Home is full. Unpin one to add another.
        </p>
      )}

      <div onClick={tapHeadline}>
        <Headline text="The library." size="screen" />
      </div>

      <div className={styles.search}>
        <label htmlFor="lib-search" className="mono" style={{ letterSpacing: "0.14em" }}>
          Find a routine
        </label>
        {/* With big text the hint can't fit inside the box, so it shows here instead. */}
        <p className={styles.hint} aria-hidden="true">
          {SEARCH_HINT}
        </p>
        <input
          id="lib-search"
          type="search"
          placeholder={SEARCH_HINT}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      <div className={styles.filters} role="group" aria-label="Filter by category">
        {(["all", ...CATEGORY_ORDER] as const).map((c) => {
          const on = filter === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              className={`${styles.filter} ${on ? styles.filterOn : ""}`}
              onClick={() => setFilter(c)}
            >
              {c === "all" ? "All" : CATEGORIES[c].label}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className={styles.noMatch} role="status" data-testid="no-match">
          <p className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.08em" }}>
            Nothing on that trail. Try another word.
          </p>
          <button type="button" className="feedback-btn" onClick={clear}>
            Clear search
          </button>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Routines">
          {shown.map((r) => {
            const cat = CATEGORIES[r.category];
            const pinned = pins.includes(r.id);
            const blocked = !pinned && full;
            return (
              <li key={r.id} className={styles.row} data-routine={r.id} style={{ background: cat.bg, color: cat.fg }}>
                <div className={styles.rowText}>
                  <span className={styles.rowName}>{r.name}</span>
                  <span className="mono" style={{ letterSpacing: "0.08em" }}>
                    {pinned ? "On home · " : ""}
                    {cat.label} · <span className="nowrap">{minutesLabel(r)} min</span>
                  </span>
                </div>
                <div className={styles.rowButtons}>
                  <button
                    type="button"
                    aria-pressed={pinned}
                    disabled={blocked || !saved}
                    aria-label={pinned ? `Unpin ${r.name}` : blocked ? `Pin to home: ${r.name} (Home is full)` : `Pin to home: ${r.name}`}
                    onClick={() => (pinned ? unpin(r.id) : pin(r.id))}
                    className={`icon-btn ${styles.pinBtn}`}
                    style={{
                      borderColor: cat.fg,
                      background: pinned ? cat.fg : "transparent",
                      color: pinned ? cat.bg : cat.fg,
                    }}
                  >
                    <Icon name={pinned ? "check" : "plus"} size={18} stroke={3} />
                  </button>
                  <Link
                    href={routineHref("/vibe", r.id)}
                    aria-label={`Use ${r.name}`}
                    className="icon-btn"
                    style={{ background: cat.fg, color: cat.bg, borderColor: cat.fg }}
                  >
                    <Icon name="arrowRight" size={20} />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className={styles.end}>
        <ListeningOn />
        <FeedbackButton email={feedbackEmail} />
        <Credit linkColor="var(--lime)" />
      </div>
    </>
  );
}
