import type { Metadata } from "next";
import Link from "next/link";
import { breakable } from "@/components/Breakable";
import { Headline } from "@/components/Headline";
import { LegalLinks } from "@/components/LegalLinks";
import { contactEmail } from "@/config/contact";
import styles from "./privacy.module.css";

export const metadata: Metadata = { title: "Privacy" };

/** When this page last changed. */
const UPDATED = "22 October 2026";

// Privacy: what Trailmix keeps, where, and for how long. Public, no sign-in, no Gate.
// Keep it true: if what's stored changes (server/limits.ts, server/lookup.ts, server/shares.ts,
// server/session.ts, server/youtube.ts, lib/store.ts), change this page too.
export default function Privacy() {
  const email = contactEmail();
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
        <p>Saved in your browser’s storage on this phone only:</p>
        <ul>
          <li>Your pinned routines and the music app you listen on.</li>
          <li>Your vibe settings for each routine (genres, energy, length).</li>
          <li>Your recent mixes: names, track titles and artists, so new mixes stay fresh.</li>
          <li>Your check-in answers (“Carried me” and the others), kept with each mix.</li>
        </ul>
        <p>
          Trailmix uses one cookie: your sign-in. It holds your Google first name, email address and Google’s id for
          your account, sealed so only Trailmix’s server can read it, and it lasts 7 days. While you’re signing in, a
          second one lives for a few minutes to check the sign-in is really yours. There are no other cookies and no
          tracking.
        </p>
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
            <strong>Who shared a mix</strong>: your Google first name, shown on the page as “Shared by”, kept with the
            shared mix for its 90 days.
          </li>
          <li>
            <strong>Your YouTube permission</strong>, if you save playlists: Google’s access tokens, encrypted, kept on
            the server only (never on the page), for 7 days. Along with them, which videos went into each playlist
            Trailmix made for you, so Retry can add any that were missed; also 7 days.
          </li>
          <li>
            <strong>Usage counts</strong>, with no names, so we can tell whether Trailmix is working: each day’s totals of
            mixes made, kept, swapped, remixed and shared, check-in answers, average freshness, songs not found and
            YouTube units used. They’re totals only, with nothing about who did what, kept for 90 days.
          </li>
          <li>
            <strong>Four milestones per person</strong>: the day you first made a mix, first kept one, first answered
            “Carried me”, and whether you came back within a week. They’re filed under a scrambled code made from your
            Google account’s id that can’t be turned back into it; your name, email and Google id aren’t stored. Kept
            for 180 days after the last change.
          </li>
          <li>
            <strong>Daily counters</strong> that keep usage fair, such as how many mixes were made today. They count by a
            scrambled code for your Google account (never your name or email), or briefly by IP address for shared mix
            pages; all expire within two days. None of them hold what you listened to.
          </li>
          <li>
            <strong>A track lookup cache</strong>: song titles, artists, lengths and Apple Music links, shared by
            everyone and not linked to you. Kept for up to 30 days. YouTube video ids for songs are cached the same way,
            for up to 60 days.
          </li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="others">
        <h2 id="others">Services we use</h2>
        <p>
          To make a mix, your workout, genres, energy, length and recent tracks go to Anthropic’s Claude, without
          anything that identifies you. Song titles are looked up on Deezer and Apple’s iTunes Search. The app runs on
          Vercel and stores the server data above with Upstash. Google handles sign-in, and saving a playlist sends
          its title, description and songs to YouTube.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="google">
        <h2 id="google">Google sign-in and YouTube</h2>
        <p>
          Trailmix uses Google sign-in and YouTube API Services. We use your Google sign-in and YouTube access only to
          create the playlists you ask for in your own YouTube account, as unlisted playlists. Sign-in asks only for
          your name and email; YouTube access is asked for separately, the first time you save a playlist. We never
          sell your data or use it for ads.
        </p>
        <p>
          You can remove Trailmix’s access to your Google account at any time; the stored tokens then stop working,
          and they’re deleted within 7 days anyway. Playlists already saved stay in your YouTube account until you
          delete them there. Using YouTube through Trailmix means you agree to YouTube’s Terms of Service, and
          Google’s Privacy Policy covers how Google handles your data.
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
