import { LaceUp } from "./LaceUp";
import { Headline } from "@/components/Headline";
import { Credit } from "@/components/Credit";
import { Gate } from "@/components/Gate";
import { SHOW_BETA } from "@/config/site";
import styles from "./welcome.module.css";

// Welcome (first run only; returning phones go straight to Home, see lib/gate.ts).
// "Lace up" stands in for Google sign-in until Milestone 4. The hills animation arrives in Milestone 5.
export default function Welcome() {
  return (
    <main className={`screen screen--flush ${styles.welcome}`}>
      <Gate mode="welcome" />
      <div className={styles.top}>
        <div className="top-bar">
          <span className="wordmark">Trailmix</span>
          {SHOW_BETA && (
            <span className={styles.betaTag} data-testid="beta-label">
              Invite-only beta
            </span>
          )}
        </div>
        <Headline text="Pick the terrain. We’ll bring the noise." size="welcome" className={styles.title} />
      </div>

      <div className={styles.hills} aria-hidden="true">
        <span className={`${styles.hill} ${styles.hill1}`} />
        <span className={`${styles.hill} ${styles.hill2}`} />
        <span className={`${styles.hill} ${styles.hill3}`} />
        <span className={`${styles.hill} ${styles.hill4}`} />
        <span className={`mono ${styles.hillLabel}`} style={{ left: "9%", bottom: 200, color: "var(--sand)" }}>
          Warm-up
        </span>
        <span className={`mono ${styles.hillLabel}`} style={{ left: "67%", bottom: 160 }}>
          Peak
        </span>
        <span className={`mono ${styles.hillLabel}`} style={{ left: "11%", bottom: 100 }}>
          Build
        </span>
        <span className={`mono ${styles.hillLabel}`} style={{ left: "64%", bottom: 50 }}>
          Cool-down
        </span>
      </div>

      <div className={styles.panel}>
        <p className={styles.pitch}>
          Tell it what you’re training and how you feel. Trailmix builds the soundtrack and drops it straight into
          your music app.
        </p>
        <LaceUp />
        <p className="mono" style={{ textAlign: "center" }}>
          Sign in with Google to save your mixes
        </p>
        <div className={styles.creditRow}>
          <Credit linkColor="var(--ink)" />
        </div>
      </div>
    </main>
  );
}
