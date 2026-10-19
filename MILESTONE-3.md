# Trailmix · Milestone 3: the brain

## Context for Claude Code

Milestones 0–2 are done. Milestone 0 saved a real YouTube playlist (Groove Miles). Milestone 1 put all eight screens on my phone. Milestone 2 made pins, the Library, vibe memory and the music app choice work, all saved on the phone.

This milestone makes Trailmix **actually make mixes**. Set the vibe → Make the mix calls Claude, every track is checked as real (Deezer) and opens in all three music apps, the mix is fitted to the length I chose, and swap and Remix work. The shared mix page becomes real: stored mixes, at real links, for 90 days.

**Still not in this milestone:** Google sign-in, the guest list, and saving playlists to YouTube. Those are Milestone 4.

**I have no coding experience.** Explain each step in plain English, tell me exactly what to click in Vercel, Google Cloud or the Anthropic Console, and ask before installing anything on my Mac. **Never ask me to paste a key into chat.** Walk me through adding each one as a Vercel environment variable (and to `.env.local` for running on my Mac).

I want to **test this on my phone tomorrow (17 Oct)**, so build in the order of the build plan below and push working pieces as you go.

## First: carry-overs from Milestone 2

1. **E12 failed on my phone.** After Damage → Back to home, Home still showed my 6 pins. Make Damage do a full reload so the app reads the damaged data fresh, and make sure the app never writes its in-memory copy back over damaged data. Add a test that damages storage, reloads, and checks that Home shows the three defaults with no Welcome. Tell me the cause in plain English. **This matters more now:** this milestone adds recent mixes to saved data, so the storage version goes up, and every phone that used Milestone 2 will hit the E12 path on its next open.
2. **Reset page:** keep it, but only when a `SHOW_RESET_PAGE` environment variable is set to `true`. With it unset, tapping the heading 5 times does nothing.
3. **Genre limit:** keep "Pick up to 3". **Genres (changed after the phone test):** 12 broad genres: Hip-hop, UK rap & grime, House, Drum & bass, Techno, Electronic, Pop, R&B & soul, Afrobeats & amapiano, Rock & indie, Metal, Funk & disco. Old saved genres map to their closest new one (Grime → UK rap & grime, Afrobeats and Amapiano → Afrobeats & amapiano, 90s R&B and Soul → R&B & soul, Rock → Rock & indie, Disco and Jazz-funk → Funk & disco), on the phone and on the server, so vibe memory doesn't break (E12).
4. **Saved screen wording for Spotify and Apple Music:** replace "…is ready for Spotify." with "Your mix is ready to play in Spotify, track by track." (and the same for Apple Music). Keep "Track by track" as the label.

## Fixed details

- **Live address:** `https://trailmix.augustusnas.com`. **Repo:** `augustusnas/trailmix`, which deploys on every push to main.
- **Upstash Redis** is connected to the Vercel project. Its environment variables are already set.
- **Track services:** Deezer's search (free, no key, 50 searches every 5 seconds) checks tracks and gives lengths. The iTunes Search API (free, no key, about 20 searches a minute) gives exact Apple Music links, in the background. Spotify and YouTube Music get search links, which need no service at all.
- Keep everything earlier milestones established: design tokens, large-text behaviour, safe areas, the beta label setting, the credit, the feedback button, the CSP headers, `noindex` on mix pages, and no cookies.

## Protecting my Claude credit before sign-in exists

Without sign-in, the new server routes would be open to anyone who finds them, and each mix costs Claude credit. Until Google sign-in replaces it in Milestone 4, add **all** of these:

- **Temporary access code:** a `BETA_ACCESS_CODE` environment variable. The first time someone taps Lace up, Welcome asks for the code once and stores it on the phone (local storage, not a cookie). Every mix, swap and share request sends it, and the server refuses requests without the right code with a friendly message. Make this one module that Milestone 4 can swap for "signed in and on the guest list".
- **Daily ceiling across everyone (E14):** `DAILY_MIX_CEILING`, default 60, counted in Upstash and reset at midnight UK time.
- **Off switch (E15):** `MIXES_PAUSED=true` pauses mix-making instantly with "Mix-making is paused. Back soon." Home and the Library keep working.
- **Per-person limits (E9):** 20 mixes an hour. Until sign-in arrives, count per access code plus IP address.
- **Server-side checks (E11):** routine, genres (up to 3), energy and length must come from the fixed lists. Reject anything else **before** anything reaches Claude, so nothing typed can get into the prompt.
- The Anthropic key's own monthly limit (£5, already set in the Console) is the final backstop.

## What to build

### 1. Generate mix (F9, F18)
- A server route takes routine, genres, energy, length and **recent tracks to avoid** (titles and artists from my last 10 mixes, sent from the phone).
- Claude model: a small, fast model, chosen with a `CLAUDE_MODEL` environment variable that defaults to the current Claude Haiku model (`claude-haiku-5-5`), so I can change it without a code change. Sonnet is `claude-sonnet-5-5`. Each model gets the "no long thinking" setting it accepts (Sonnet 5.5 refuses the one Haiku uses, which is why every Sonnet mix failed). If `CLAUDE_MODEL` names a model that doesn't work, mixes fall back to Haiku and the log shows a `model-fallback` warning.
- **Prompt requirements (keep them in one file, so they can be improved later):**
  - Return strict JSON only: a fun mix name, then tracks with title, artist and phase (warm-up, main block, cool-down).
  - Real, released tracks only. Match the genres and energy.
  - Only tracks Claude is confident exist, credited to the artist who released them, and only artists it knows well. Deeper cuts come from those artists' own catalogues, never from obscure artists.
  - The usual released version, not a live recording, under 10 minutes.
  - An energy arc across the phases. Energy keeps building through the main block so it never sags midway.
  - No artist twice in a row, and **at most 2 tracks per artist** in a mix (also enforced in code, and on Swap).
  - **Artists from my last 5 mixes for this routine** are sent from the phone (made mixes, kept or not), and Claude avoids them where it can, but only by choosing other artists it knows well: reusing one beats guessing.
  - At least 70% of tracks not in my recent mixes, with a couple of deeper cuts.
  - About 20% more tracks than the length needs, so there's spare.
  - Use the JSON or structured-output feature so the answer is always well-formed.
- **E3:** broken JSON or no answer within 20 seconds → retry once, then "The mix didn't come together. Try again" with a button. **E4:** Claude down or out of credit → "Mix-making is resting right now. Try again later", keeping my vibe settings.
- Real fun names, and the playlist title format stays `Trailmix · <Routine> · <Fun name> · <Day Mon>` (F21 must keep passing).

### 2. Track lookup (E1, E2)
Run lookups when a mix is generated, so the preview only shows tracks that exist.
1. **Cache first:** title + artist → length and Apple Music link, stored in Upstash (shared by everyone, so popular tracks get faster). Found tracks are kept 30 days; tracks that weren't found, 1 day.
2. **Deezer search:** search artist + title and take the first result that's the same song by the same artist (not a cover or karaoke version), between **1½ and 10 minutes** long. A match gives the **real duration**. All the tracks in a mix are checked at once, so this takes about a second.
3. **No match (E1):** the track probably doesn't exist as named, so ask Claude for a replacement in the same phase, up to 2 tries, then drop it. Replacements for all three phases are asked for at the same time. If 3 or more tracks drop: "A few tracks couldn't be found, so this mix is a little shorter".
4. **Deezer busy or down (E2):** each lookup is tried 3 times (straight away, after 1 second, after 2½ seconds). If Deezer still can't check most of the tracks, the mix stops with "The mix didn't come together. Try again" and a Try again button, keeping the vibe settings. It never shows an empty or half-checked mix.
5. **Links:** Spotify and YouTube Music open a search for that exact song (`open.spotify.com/search/…`, `music.youtube.com/search?q=…`), built on the phone with no service call. Apple Music opens the exact song.
6. **Apple Music links, in the background:** after the mix is on screen, the iTunes Search API finds each track's exact Apple Music song, paced to 15 searches a minute shared by everyone, and cached. Until a track's link arrives, it opens an Apple Music search, so nothing ever waits for it. Apple Music users see "Finding Apple Music links 6 of 14" with a progress bar; there's no error if iTunes is busy, it just carries on the next minute.
7. **No YouTube calls when a mix is made, swapped or remixed.** YouTube video IDs (100 units per search) are only needed to save a playlist, which is Milestone 4.

**Measured speed (N2: mix on screen within 30 seconds, progress shown after 2):** first mix 4–14 seconds, remix 6–8 seconds, swap about 1½ seconds. Apple Music links for a whole mix arrive within about 10 seconds.

**Time limits:** Generate and Remix give up after 45 seconds on the phone ("That took too long. Try again.", with Try again; a failed Remix keeps the current mix). Swap gives up after 15 seconds, keeps the original track and shows "Couldn't find a swap for this one. Try again." The server stops a little earlier (40 and 13 seconds), and every Claude and Deezer request inside it is cut to the time that's left.

**Bad-track count:** every mix, remix and swap adds to two running totals in Upstash, `stats:suggested` (tracks Claude suggested) and `stats:failed` (ones that failed the check). Each server log line ends with `trackCheck`: this request's numbers and the running total with its failure percentage. The stats page can show it later.

A YouTube API key restricted to the YouTube Data API, server only, is in Vercel as `YOUTUBE_API_KEY`. Nothing uses it until Milestone 4.

### 3. Fit to length (F10)
- Claude doesn't decide length. Use real durations from Deezer.
- Keep the warm-up and cool-down whole, then fill the main block in Claude's order until the total is **within 2½ minutes** of the chosen length (5 is the most it may be out).
- Main-block replacements are sized to fill the length, allowing for how many of this mix's suggestions have failed so far (about half, for grime). Tracks that failed are never suggested or checked again in the same mix.
- Still more than 5 minutes short: ask Claude for more main-block tracks, **up to 3 rounds**. Still short after that: The mix says "This one came out at X minutes." One long track overshooting: swap it for a shorter one in the same phase.
- Show the real running time on The mix ("44 min").

### 3½. While a mix is made
A large headline with the current stage and a three-part progress bar: "Picking tracks for your vibe" → "Lining up the energy" → "Fitting it to [N] minutes", with "Step 1 of 3" underneath. The server reports each stage as the real work reaches it (Claude suggesting; checking and replacing; fitting the length). Nothing mentions checking whether songs are real. The bar's pulse stops with Reduce Motion on, and it's checked at the largest text size.

### 4. Swap and Remix (F11, F12)
- **Swap:** replaces only that track, with one in the **same phase**, not already in the list, run through the same lookup. Re-check the length after the swap.
- **Remix:** a new list and a new name for the same settings. It never touches YouTube.
- Both count towards the hourly limit and the daily ceiling.

### 5. Recent mixes and freshness (F18)
- Keep the **last 10 mixes** on the phone (titles, artists, routine, date), as reserved in Milestone 2. Bump the storage version, and make sure older data falls back cleanly (E12).
- Send recent tracks to the server for the prompt, and record each mix's freshness percentage (the share of tracks not in the previous 10 mixes) on the phone. The stats page uses it later.

### 6. The mix → next steps until saving arrives
- **YouTube Music users:** "Keep it in YouTube Music" stores the mix as a shared mix (below) and goes to Saved. In this milestone, Saved's "Open in YouTube Music" opens the mix page's YouTube option. Real playlist saving arrives in Milestone 4, so leave one clearly marked place for it.
- **Spotify and Apple Music users:** "Open in Spotify" or "Open in Apple Music" stores the mix and opens its mix page with their app first.
- **Share with friends** opens the iPhone share sheet with the mix page link (F15).

### 7. Real shared mix pages (F15, E16, E17)
- Stored in Upstash under a **long random ID that can't be guessed**, kept for **90 days**. View-only: the page never calls Claude, Deezer, iTunes or YouTube.
- Shows the fun name, "Shared by" (a placeholder first name until Milestone 4 supplies the Google one), the phased track list, and the three apps. **The visitor's own app leads**, as built in Milestone 2.
- Every app opens track by track: Spotify and YouTube Music open a search for each song, and Apple Music opens the exact song when iTunes found it (otherwise a search). A YouTube Music "Open the whole playlist" waits for Milestone 4, when kept mixes are saved as real playlists.
- **E16:** an expired or mistyped link shows the friendly "This mix has moved on. Ask whoever shared it for a fresh one." page in Trailmix colours.
- **E17 / N16:** limit 60 page views a minute per visitor IP, and 20 shares a day per access code. Over the limit, show the friendly messages from the test plan.
- Keep the footer: "Trailmix is in invite-only beta", "Track details from Deezer and Apple Music", and the credit.

### 8. Offline (E10)
Make the mix and Keep it are disabled offline, with a "You're offline" banner. Home, the Library and Set the vibe keep working.

## Tests, written alongside

- **Fake services:** Claude, Deezer and iTunes replaced with recorded answers, so tests cost nothing and never touch my accounts.
- F9, F10 (within 5 minutes for 30, 45, 60 and 90), F11, F12, F15, F18 (70% freshness), F21 still passing.
- E1, E2, E3, E4, E9, E10, E11, E12, E14, E15, E16, E17, plus the 1½–10 minute track lengths and the bad-track count.
- Access code: every new server route refuses requests without it (this stands in for N6 until Milestone 4).
- N5: a secret scan, plus a check that no key appears in anything sent to the browser.
- **Test switches** so I can force E1, E2, E3, E4, E5, E9, E10, E14 and E15 on my phone during the friend trial, plus "two in three tracks fail the check", "replacements all fail (comes out short)" and "Swap takes too long". Keep them behind the same `SHOW_RESET_PAGE` setting.
- If a test fails, tell me in plain English what it means.

## Build plan (push after each step so I can test tomorrow)
1. Milestone 2 carry-overs.
2. Protection: access code, limits, ceiling, off switch, input checks.
3. Generate with lookup and fitting, plus the progress indicator.
4. Swap and Remix.
5. Real shared mix pages and share.
6. Recent mixes and freshness; offline.

## Environment variables you'll walk me through
`ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (optional), `YOUTUBE_API_KEY`, `ODESLI_API_KEY` (optional, later), `BETA_ACCESS_CODE`, `DAILY_MIX_CEILING`, `MIXES_PAUSED`, `SHOW_RESET_PAGE`. Upstash's are already there.

## Out of scope
Google sign-in, the guest list, saving playlists to YouTube (Milestone 4), the check-in card and feeding it into the prompt (Milestone 5), the stats page, and the welcome animation.

## Done when
1. All tests pass on GitHub Actions.
2. On my phone I can make real mixes for three different routines. Every track plays when tapped, and each mix is within 5 minutes of the chosen length.
3. Swap, Remix and a shared mix page work, including opening the page signed out in Safari, and seeing a different app lead when I've picked one.
4. The off switch and the access code work when I test them.
5. No keys anywhere in the code, the repository or the browser.

## When you finish, tell me
- Exactly how to test each part on my phone, step by step.
- Measured times for a first mix and a repeat mix.
- What one mix costs in Claude credit and in YouTube units, roughly.
- What's still fake or placeholder.
- Anything I need to do or decide before Milestone 4.
