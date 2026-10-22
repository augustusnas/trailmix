import type { Metadata } from "next";
import Link from "next/link";
import { breakable } from "@/components/Breakable";
import { Headline } from "@/components/Headline";
import { LegalLinks } from "@/components/LegalLinks";
import { contactEmail } from "@/config/contact";
import styles from "../privacy/privacy.module.css";

export const metadata: Metadata = { title: "Terms" };

/** When this page last changed. */
const UPDATED = "22 October 2026";

// Terms: the beta, no warranty, YouTube's terms, deleting your data. Public, no sign-in, no Gate.
export default function Terms() {
  const email = contactEmail();
  return (
    <main className={`screen screen--sand ${styles.page}`}>
      <div className="top-bar">
        <span className="wordmark">Trailmix</span>
        <Link href="/" className={styles.back}>
          Back to Trailmix
        </Link>
      </div>
      <Headline text="Terms." size="screen" />
      <p className={styles.lead}>The short version: Trailmix is a free beta, made by one person. Use it, enjoy it, and tell us when it breaks.</p>

      <section className={styles.section} aria-labelledby="beta">
        <h2 id="beta">It’s a beta</h2>
        <p>
          Trailmix is invite-only and still being built. Features can change, go away or stop working, and mixes may
          sometimes include the wrong song. Access is by invitation and can end at any time.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="warranty">
        <h2 id="warranty">No warranty</h2>
        <p>
          Trailmix is provided as it is, with no promises that it will be available, accurate or fit for any purpose.
          As far as the law allows, we aren’t responsible for any loss from using it. Nothing here takes away rights you
          have by law.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="youtube">
        <h2 id="youtube">YouTube</h2>
        <p>
          Saving playlists uses YouTube API Services. By using that, you agree to YouTube’s Terms of Service, and
          Google’s Privacy Policy covers how Google handles your data. Playlists Trailmix saves are yours, in your own
          YouTube account.
        </p>
        <ul className={styles.links}>
          <li>
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">
              YouTube Terms of Service
            </a>
          </li>
          <li>
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Google Privacy Policy
            </a>
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="delete">
        <h2 id="delete">Deleting your data</h2>
        <ul>
          <li>On your phone: clear your browser’s website data for Trailmix.</li>
          <li>Trailmix’s access to your Google account: remove it in your Google account (link below). Stored tokens are deleted within 7 days.</li>
          <li>Playlists: delete them in YouTube Music.</li>
          <li>Shared mixes and anything else: email us and we’ll delete it. Shared mixes are deleted after 90 days anyway.</li>
        </ul>
        <ul className={styles.links}>
          <li>
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              {breakable("myaccount.google.com/permissions")}
            </a>
          </li>
          <li>
            <Link href="/privacy">What Trailmix stores, and for how long</Link>
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="contact">
        <h2 id="contact">Contact</h2>
        <ul className={styles.links}>
          <li>
            <a href={`mailto:${email}`} data-testid="contact-email">
              {breakable(email)}
            </a>
          </li>
        </ul>
        <p className="mono">Last updated {UPDATED}</p>
        <LegalLinks color="var(--ink)" />
      </section>
    </main>
  );
}
