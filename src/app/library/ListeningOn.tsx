"use client";

import { useState } from "react";
import { MUSIC_APPS } from "@/data/apps";
import { setMusicApp, useSaved } from "@/lib/store";
import styles from "./library.module.css";

/** "Listening on Spotify · Change": the one place to change the music app after first run. */
export function ListeningOn() {
  const saved = useSaved();
  const [open, setOpen] = useState(false);
  if (!saved) return null;
  const current = MUSIC_APPS.find((a) => a.id === saved.musicApp);

  return (
    <div className={styles.listening} data-testid="listening-on">
      <p className={styles.listeningRow}>
        <span>
          Listening on <strong>{current ? current.name : "not chosen"}</strong>
        </span>
        <span aria-hidden="true"> · </span>
        <button type="button" className={styles.change} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Done" : current ? "Change" : "Choose"}
        </button>
      </p>
      {open && (
        <div className={styles.appChoices} role="group" aria-label="Where do you listen?">
          {MUSIC_APPS.map((a) => {
            const on = a.id === saved.musicApp;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                className={styles.appChoice}
                style={{ background: a.color, outline: on ? "3px solid var(--sand)" : "none" }}
                onClick={() => {
                  setMusicApp(a.id);
                  setOpen(false);
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
