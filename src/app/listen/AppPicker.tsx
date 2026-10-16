"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { MUSIC_APPS } from "@/data/apps";
import { completeOnboarding, load, type MusicAppId } from "@/lib/store";
import styles from "./listen.module.css";

export function AppPicker() {
  const router = useRouter();
  const [picked, setPicked] = useState<MusicAppId>(() => (typeof window === "undefined" ? null : load().musicApp) ?? "ytm");

  const done = () => {
    completeOnboarding(picked);
    router.push("/home");
  };

  return (
    <>
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
      <button type="button" onClick={done} className="cta cta--large" style={{ background: "var(--sand)", color: "var(--ink)" }}>
        <span>That’s me</span>
        <Icon name="arrowRight" />
      </button>
    </>
  );
}
