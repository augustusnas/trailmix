"use client";

import { useState } from "react";
import { MUSIC_APPS } from "@/data/apps";
import styles from "./listen.module.css";

export function AppPicker() {
  const [picked, setPicked] = useState<string>("ytm");
  return (
    <div className={styles.apps}>
      {MUSIC_APPS.map((app) => {
        const on = app.id === picked;
        return (
          <button
            key={app.id}
            type="button"
            aria-pressed={on}
            onClick={() => setPicked(app.id)}
            className={styles.app}
            style={{ background: app.color, outline: on ? "3px solid var(--sand)" : "none" }}
          >
            <span className={`mono ${styles.appTop}`}>
              <span>{app.note}</span>
              <span className={styles.radio}>
                <span style={{ background: on ? "var(--ink)" : "transparent" }} />
              </span>
            </span>
            <span className={styles.appName}>{app.name}</span>
          </button>
        );
      })}
    </div>
  );
}
