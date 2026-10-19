import { Credit } from "@/components/Credit";
import { SHOW_BETA } from "@/config/site";
import styles from "./shared.module.css";

export function Footer() {
  return (
    <footer className={styles.foot}>
      {SHOW_BETA && <p data-testid="beta-label">Trailmix is in invite-only beta</p>}
      <p>Track details from Deezer and Apple Music</p>
      <Credit linkColor="var(--ink)" />
    </footer>
  );
}
