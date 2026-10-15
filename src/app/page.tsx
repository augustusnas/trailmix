import { CtaLink } from "@/components/CtaLink";
import { Credit } from "@/components/Credit";
import { SHOW_BETA } from "@/config/site";
import styles from "./welcome.module.css";

// Welcome (first run). Real Google sign-in arrives in Milestone 4, the hills animation in Milestone 5.
export default function Welcome() {
  return (
    <main className={`screen screen--flush ${styles.welcome}`}>
      <div className={styles.top}>
        <div className="top-bar">
          <span className="wordmark">Trailmix</span>
          {SHOW_BETA && (
            <span className={styles.betaTag} data-testid="beta-label">
              Invite-only beta
            </span>
          )}
        </div>
        <h1 className={`headline ${styles.title}`}>Pick the terrain. We’ll bring the noise.</h1>
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
        <CtaLink href="/listen" bg="var(--ink)" fg="var(--lime)">
          Lace up
        </CtaLink>
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
