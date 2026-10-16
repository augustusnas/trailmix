import type { Metadata } from "next";
import { Headline } from "@/components/Headline";
import Link from "next/link";
import { BackLink } from "@/components/CtaLink";
import { Credit } from "@/components/Credit";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Icon } from "@/components/Icon";
import { CATEGORIES, CATEGORY_ORDER } from "@/data/categories";
import { DEFAULT_PINS, MAX_PINS, ROUTINES, minutesLabel } from "@/data/routines";
import styles from "./library.module.css";

export const metadata: Metadata = { title: "Library" };

const SEARCH_HINT = "Tabata, push day, rowing…";

// Library. Working pins, search, filters and the 6-pin cap arrive in Milestone 2.
export default function Library() {
  const feedbackEmail = process.env.FEEDBACK_EMAIL || undefined;
  const ordered = CATEGORY_ORDER.flatMap((c) => ROUTINES.filter((r) => r.category === c));

  return (
    <main className="screen" style={{ gap: 16, paddingTop: "calc(24px + var(--safe-top))" }}>
      <div className="top-bar">
        <BackLink href="/home" label="Back to home" color="var(--sand)" />
        <span className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.12em" }}>
          {DEFAULT_PINS.length} of {MAX_PINS} on home
        </span>
      </div>
      <Headline text="The library." size="screen" />

      <div className={styles.search}>
        <label htmlFor="lib-search" className="mono" style={{ letterSpacing: "0.14em" }}>
          Find a routine
        </label>
        {/* With big text the hint can't fit inside the box, so it shows here instead. */}
        <p className={styles.hint} aria-hidden="true">
          {SEARCH_HINT}
        </p>
        <input id="lib-search" type="search" placeholder={SEARCH_HINT} className={styles.input} />
      </div>

      <div className={styles.filters} role="group" aria-label="Filter by category">
        <button type="button" aria-pressed="true" className={`${styles.filter} ${styles.filterOn}`}>
          All
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button key={c} type="button" aria-pressed="false" className={styles.filter}>
            {CATEGORIES[c].label}
          </button>
        ))}
      </div>

      <ul className={styles.list}>
        {ordered.map((r) => {
          const cat = CATEGORIES[r.category];
          const pinned = DEFAULT_PINS.includes(r.id);
          return (
            <li
              key={r.id}
              className={styles.row}
              data-routine={r.id}
              style={{ background: cat.bg, color: cat.fg }}
            >
              <div className={styles.rowText}>
                <span className={styles.rowName}>{r.name}</span>
                <span className="mono" style={{ letterSpacing: "0.08em" }}>
                  {cat.label} · <span className="nowrap">{minutesLabel(r)} min</span>
                </span>
              </div>
              <div className={styles.rowButtons}>
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={pinned ? `Unpin ${r.name}` : `Pin to home: ${r.name}`}
                className="icon-btn"
                style={{
                  borderColor: cat.fg,
                  background: pinned ? cat.fg : "transparent",
                  color: pinned ? cat.bg : cat.fg,
                }}
              >
                <Icon name={pinned ? "check" : "plus"} size={18} stroke={3} />
              </button>
              <Link
                href={`/vibe?routine=${r.id}`}
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

      <div className={styles.end}>
        <FeedbackButton email={feedbackEmail} />
        <Credit linkColor="var(--lime)" />
      </div>
    </main>
  );
}
