import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Headline } from "@/components/Headline";
import { CONTACT_EMAIL } from "@/config/site";
import styles from "./privacy.module.css";

export const metadata: Metadata = { title: "Privacy" };

/** When this page last changed. */
const UPDATED = "19 October 2026";

/** At the biggest text sizes, addresses only fit by breaking after their dots, slashes and @. */
function breakable(address: string) {
  return address.split(/(?<=[.@/])/).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}

// Privacy: what Trailmix keeps, where, and for how long. Public, no sign-in, no Gate.
// Keep it true: if what's stored changes (server/limits.ts, server/lookup.ts, server/shares.ts,
// lib/store.ts), change this page too.
export default function Privacy() {
  return (
    <main className={`screen screen--sand ${styles.page}`}>
      <div className="top-bar">
        <span className="wordmark">Trailmix</span>
        <Link href="/" className={styles.back}>
          Back to Trailmix
        </Link>
      </div>
      <Headline text="Privacy." size="screen" />
      <p className={styles.lead}>
        Trailmix is a small invite-only beta. It keeps as little as it can, and most of it never leaves your phone.
      </p>

      <section className={styles.section} aria-labelledby="phone">
        <h2 id="phone">On your phone</h2>
        <p>Saved in your browser’s storage on this phone only. Trailmix uses no cookies.</p>
        <ul>
          <li>Your pinned routines and the music app you listen on.</li>
          <li>Your vibe settings for each routine (genres, energy, length).</li>
          <li>Your recent mixes: names, track titles and artists, so new mixes stay fresh.</li>
          <li>Your beta access code.</li>
        </ul>
        <p>Clearing your browser’s website data for Trailmix removes all of it.</p>
      </section>

      <section className={styles.section} aria-labelledby="server">
        <h2 id="server">On our server</h2>
        <ul>
          <li>
            <strong>Shared mixes</strong>, when you tap Share or Keep it: the mix name and track list, kept for 90 days
            behind a link that can’t be guessed, then deleted.
          </li>
          <li>
            <strong>Daily counters</strong> that keep usage fair, such as how many mixes were made today. Some briefly
            count by IP address or access code to stop overuse; those expire within two days. None of them hold your
            name or what you listened to.
          </li>
          <li>
            <strong>A track lookup cache</strong>: song titles, artists, lengths and Apple Music links, shared by
            everyone and not linked to you. Kept for up to 30 days.
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="others">
        <h2 id="others">Services we use</h2>
        <p>
          To make a mix, your workout, genres, energy, length and recent tracks go to Anthropic’s Claude, without
          anything that identifies you. Song titles are looked up on Deezer and Apple’s iTunes Search. The app runs on
          Vercel and stores the server data above with Upstash.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="google">
        <h2 id="google">Google sign-in and YouTube (coming soon)</h2>
        <p>
          Trailmix will soon use Google sign-in and YouTube API Services. We’ll use your Google sign-in and YouTube
          access only to create the playlists you ask for in your own YouTube account. We never sell your data or use
          it for ads.
        </p>
        <p>
          You can remove Trailmix’s access to your Google account at any time. Using YouTube through Trailmix means
          you agree to YouTube’s Terms of Service, and Google’s Privacy Policy covers how Google handles your data.
        </p>
        <ul className={styles.links}>
          <li>
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
              {breakable("myaccount.google.com/permissions")}
            </a>
          </li>
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

      <section className={styles.section} aria-labelledby="contact">
        <h2 id="contact">Questions</h2>
        <p>Email us to ask what’s stored or to have a shared mix deleted.</p>
        <ul className={styles.links}>
          <li>
            <a href={`mailto:${CONTACT_EMAIL}`} data-testid="contact-email">
              {breakable(CONTACT_EMAIL)}
            </a>
          </li>
        </ul>
        <p className="mono">Last updated {UPDATED}</p>
      </section>
    </main>
  );
}
