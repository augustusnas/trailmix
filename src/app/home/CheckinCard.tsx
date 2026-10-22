"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { TEST_SWITCH_KEY } from "@/lib/api";
import { CHECKIN_ANSWERS, dueCheckin, recordCheckin, useSaved, type CheckinAnswer } from "@/lib/store";
import { report } from "@/lib/usage";
import styles from "./checkin.module.css";

/** The "check-in due now" test switch (reset page): skip the hour's wait. */
function forcedDue(): boolean {
  try {
    return sessionStorage.getItem(TEST_SWITCH_KEY) === "checkin";
  } catch {
    return false;
  }
}

/**
 * F17: "How did <fun name> do?" at the top of Home, an hour or more after a mix was kept. Asks once,
 * about the most recent kept mix only; an answer or × means it never asks about that mix again.
 * Answers stay with the mix on this phone and are counted anonymously on the server.
 */
export function CheckinCard() {
  const saved = useSaved();
  const [now, setNow] = useState<number | null>(null);
  const [favourite, setFavourite] = useState(false);
  const [noted, setNoted] = useState(false);
  useEffect(() => setNow(forcedDue() ? Number.MAX_SAFE_INTEGER : Date.now()), []);

  const [asked, setAsked] = useState<{ id: string; name: string } | null>(null);
  const due = saved && now !== null ? dueCheckin(saved, now) : null;
  useEffect(() => {
    if (due?.id && !asked) setAsked({ id: due.id, name: due.name });
  }, [due, asked]);

  if (!asked) return null;
  if (noted)
    return (
      <section className={styles.card} aria-label="Check-in" data-testid="checkin">
        <p className={styles.noted} role="status">
          Noted. The next mix gets the memo.
        </p>
      </section>
    );
  if (!due) return null; // dismissed

  const answer = (a: CheckinAnswer) => {
    recordCheckin(asked.id, { answer: a, ...(favourite ? { favourite: true } : {}) });
    report({ event: "checkin", answer: a, favourite });
    setNoted(true);
  };

  return (
    <section className={styles.card} aria-labelledby="checkin-q" data-testid="checkin">
      <div className={styles.head}>
        <h2 id="checkin-q" className={styles.question}>
          How did {asked.name} do?
        </h2>
        <button type="button" className={styles.close} aria-label="Dismiss the check-in" onClick={() => recordCheckin(asked.id, { dismissed: true })}>
          <Icon name="close" size={18} stroke={2.6} />
        </button>
      </div>
      {/* Optional, so it comes first: tapping an answer records it straight away. */}
      <button type="button" className={styles.favourite} aria-pressed={favourite} onClick={() => setFavourite(!favourite)}>
        <span aria-hidden="true">{favourite ? "★" : "☆"}</span> New favourite
      </button>
      <div className={styles.answers}>
        {CHECKIN_ANSWERS.map((a) => (
          <button key={a.id} type="button" className={styles.answer} onClick={() => answer(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
