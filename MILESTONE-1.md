# Trailmix · Milestone 1: the skeleton

## Context for Claude Code

Trailmix is a personal iPhone web app (invite-only beta) that turns a gym routine plus a mood into a playlist saved to YouTube Music. Milestone 0 is done: the throwaway script in this repo created the Groove Miles playlist, so the Google Cloud setup and YouTube saving are proven.

This milestone builds the **real app's skeleton**: every screen, looking right, navigable on my iPhone, with **fake data**. No sign-in, no Claude, no YouTube yet. The point is to get the real thing on my phone early, so every later milestone can be checked in my hand.

**I have no coding experience.** Explain each step in plain English, tell me exactly what to click in Vercel or GitHub, and never assume I know a command. Ask before installing anything on my Mac.

## Fixed details for the whole build

- **Live address:** `https://trailmix.augustusnas.com`. It's already connected to the `trailmix` Vercel project (Production) and shows Valid Configuration. Use it anywhere the app needs its own URL. Don't hard-code `trailmix-mu.vercel.app`.
- **Repo:** `augustusnas/trailmix` on GitHub, deployed by Vercel on every push to the main branch.
- **Milestone 0 script:** keep it, but move it into a `scripts/milestone-0/` folder so it stays out of the app. Make sure its client JSON and token files remain git-ignored.
- **Google sign-in (for later, Milestone 4):** the "Trailmix Web Client" OAuth client allows these redirect URIs:
  `https://trailmix.augustusnas.com/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`. If Auth.js needs a different path, tell me and I'll update Google Cloud.
- **Secrets:** never ask me to paste a key or secret into chat. When one is needed, walk me through adding it as a Vercel environment variable or to `.env.local`.

## Design reference

The screens were designed on a canvas in Claude Design. I'll put the exported mockups in the repo at `design/reference/`: one HTML file per screen, plus a README that maps each file to a screen and route. **Match them closely** for layout, colours, type, spacing and copy, but rebuild them as fluid screens. Don't copy the mockup code: the `<x-dc>` and `{{…}}` scaffolding belongs to the design tool.

If anything in the mockups conflicts with this brief, follow this brief and tell me.

## What to build

### 1. The project
- Next.js (App Router) in TypeScript, styled with plain CSS or CSS modules. No UI kit.
- Fonts from Google Fonts: **Bricolage Grotesque** (headlines ExtraBold with tight letter-spacing, and body) and **Space Mono** (small uppercase labels). Fall back to the system sans and monospace fonts.
- Design tokens as CSS variables:

| Token | Hex | Used for |
| --- | --- | --- |
| Ink | `#16130F` | Main background, text on light colours |
| Sand | `#EADFC8` | Light screens, text on dark, Strength category |
| Lime | `#C8E03A` | Accents, selected genres, Cardio category |
| Orange | `#E8571E` | Primary buttons, Combat category |
| Lilac | `#A99BF5` | Energy selection, Saved screen, Conditioning category |
| Forest | `#1F3D2B` | Set the vibe screen, Recovery category |

- Shapes: fully rounded pill buttons, 22px-radius tiles, 44px circular icon buttons.
- Contrast: dark text on orange, lime, lilac and sand. **Never white on orange.**
- Icons: simple line icons as inline SVG. No emoji, no music notes, no dumbbells.

### 2. Installable app (PWA)
- A web app manifest: name and short name **"Trailmix"** (no "beta"), `display: standalone`, portrait only, Ink as the background colour, theme colour to match.
- App icons in every size iOS and the manifest need, including the `apple-touch-icon`. **The final icon isn't designed yet**, so make a clean placeholder for now: a Lime tile with a dark "T" in Bricolage Grotesque ExtraBold. Keep the source in one place so I can swap the real icon in later with a single change.
- A service worker that caches the app shell, so the app opens fast and Home and Library still work offline.
- `viewport-fit=cover` plus the Apple meta tags, so it opens full screen with no browser bars.

### 3. The routine library as one data file
All 17 routines live in a single file (for example `src/data/routines.ts`), so routines can be added or renamed without touching screen code. Each routine has an id, a short name, a category, and its typical minutes. Each category has one colour, used everywhere.

- **Cardio (Lime):** Indoor walk 30–60, Incline treadmill 20–40, Spin / bike 30–45, Rowing intervals 20–30
- **Combat (Orange):** Boxing bag rounds 30–45, Shadow boxing 15–30
- **Conditioning (Lilac):** EMOM 10–30, AMRAP 12–30, Tabata 4–20, HIIT circuit 20–30
- **Strength (Sand):** Free weights legs 45–60, Push day 45–60, Pull day 45–60, Full body 45–60, Kettlebell flow 20–40
- **Recovery (Forest):** Stretch & mobility 15–30, Yoga flow 20–45

Genres, energy levels (Easy, Steady, Driven, Feral) and lengths (30, 45, 60, 90 minutes) also go in data files, as fixed lists.

### 4. All eight screens, with fake data and working navigation

| Screen | Route (suggested) | Build now | Leave for later |
| --- | --- | --- | --- |
| Welcome | `/` (first run) | Tagline "Pick the terrain. We'll bring the noise.", hills (static is fine), "INVITE-ONLY BETA" tag, "Lace up" button, credit at the bottom | Real sign-in (M4); the hills animation (M5) |
| Where do you listen | `/listen` | Three big tiles (YouTube Music, Spotify, Apple Music), each saying what it does in version one, then "That's me" | Remembering the choice (M2) |
| Home | `/home` | "What's the terrain today?", the three default pins (Indoor walk, EMOM, Full body) in category colours, a "Pin another" tile showing "3 of 6", BETA pill beside the wordmark | Real pinning (M2); the check-in card (M5) |
| Library | `/library` | All 17 routines grouped by category, a search box, category filters, pin buttons, "use this routine", "Send beta feedback" button, credit at the end | Working pins, search and filters, and the 6-pin cap (M2) |
| Set the vibe | `/vibe` | Genre chips, energy, length, "Make the mix" | Remembering settings per routine (M2) |
| The mix | `/mix` | A fake mix: fun name, full playlist title, running time ("44 min"), warm-up / main block / cool-down with a few fake tracks each, a swap button per track, Remix, and "Keep it in YouTube Music" | Real generation and swaps (M3); saving (M4) |
| Saved | `/saved` | Confirmation, "Open in YouTube Music", "Share with friends", "Back to home" | Real links and the share sheet (M3/M4) |
| Shared mix page | `/m/[id]` | The view-only page for any id, with fake mix data: mix name, "shared by" first name, Play it in YouTube Music / Spotify / Apple Music, the phased track list, BETA footer line, "Track links by Songlink/Odesli", credit | Real stored mixes, expiry and rate limits (M3) |

Navigation in this milestone: Welcome → Where do you listen → Home. Home tile → Set the vibe → The mix → Saved → back to Home. Home → Library and back. Library "use this routine" → Set the vibe.

**The selected routine must carry through (acceptance check F21).** Even with fake data, whichever routine I pick on Home or in the Library must show its name and category colour on Set the vibe, The mix and Saved. It also appears in the fake playlist title, e.g. `Trailmix · Boxing · Gloves On, Volume Up · 15 Oct`. No screen may show a different or default routine. Pass the routine through the route (for example `/vibe?routine=boxing-bag-rounds`), not through hidden state, so it survives a refresh.

### 5. Labels, credit and feedback, built in from the start
- **Beta label:** a small lime "BETA" pill beside the TRAILMIX wordmark on Home, Where do you listen and the shared mix page. On Welcome, the top-right tag reads "INVITE-ONLY BETA". The shared mix page footer reads "Trailmix is in invite-only beta". Keep it off Set the vibe, The mix and Saved. Make it **one setting**, so it can be removed in a single change.
- **Credit:** "Built by Augustus Nas" in small Space Mono uppercase. "Augustus Nas" links to `https://www.augustusnas.com` and opens outside the app, with a 44px tap area. It goes only at the bottom of Welcome, the end of the Library list and the foot of the shared mix page.
- **Send beta feedback:** a pill button at the end of the Library, just above the credit. It opens an email to the address in a `FEEDBACK_EMAIL` environment variable, with the subject "Trailmix beta feedback" and a body pre-filled with the app version, device and chosen music app. I haven't picked the address yet: if the variable is missing, hide the button rather than break.

### 6. Screens, safety and accessibility baselines
- Fluid portrait layout from **320px to 430px** wide. The 390×844 mockups are a reference, not a fixed size. On iPad or desktop, show a centred column no wider than 480px.
- Respect safe areas (notch, Dynamic Island, home bar) with safe-area insets. Size full-screen views with dynamic viewport units (`dvh`), not `100vh`.
- Text must stay readable and unclipped when iOS text size is increased: tiles and buttons grow rather than cutting words off.
- Every tap target is at least 44px. Use real `<button>` and `<a>` elements. Turn motion off when Reduce Motion is on.
- Security from day one: basic security headers including a content security policy, no cookies of any kind in this milestone, and the shared mix page marked `noindex` so search engines skip it.
- Turn on GitHub **Dependabot** for dependency updates.

### 7. Tests, written alongside (not afterwards)
- Set up the test runner and **GitHub Actions**, so tests run on every push.
- Write tests for:
  - the routine data file: 17 routines, each with a valid category and colour
  - navigation through every screen
  - **F21** (the chosen routine carries through Set the vibe, The mix and Saved)
  - the beta label and credit appearing only on the screens listed above
  - the feedback button hiding when `FEEDBACK_EMAIL` isn't set
- **N8:** take screenshots of every screen at 320, 390 and 430px wide. Check there's no clipped text and no sideways scrolling, and put the screenshots somewhere I can look at them.
- **N11 baseline:** run an automated accessibility scan (tap target size, contrast, button labels) and fix what it finds.
- If a test fails, tell me in plain English what it means.

### 8. Deploy
- Push to GitHub so Vercel deploys it. Confirm the app loads at `https://trailmix.augustusnas.com`.
- If Vercel needs a setting changed (for example the framework preset, now that the repo is a Next.js app rather than a script), walk me through it click by click.

## Out of scope for this milestone
Real Google sign-in, the guest list, Claude API calls, track lookup (iTunes, Odesli, YouTube), saving playlists, Upstash, rate limits, storing anything on the phone, the check-in card, the stats page, and the welcome animation. Those come in Milestones 2–5. Don't add environment variables for them yet.

## Done when
1. Automated tests pass on GitHub Actions for the latest deploy.
2. `https://trailmix.augustusnas.com` loads on my iPhone in Safari.
3. **F16:** I add it to the home screen from Safari, and it opens full screen with the Trailmix icon and no browser bars.
4. I can tap through all eight screens in the order above, and the routine I picked shows on every step (F21).
5. My phone checks pass: **N1** (Home visible within 2 seconds, opened with Wi-Fi off), **N8** (no clipped text), **N9** (nothing hidden under the notch, Dynamic Island or home bar).
6. No keys or secrets anywhere in the code or the repository.

## When you finish, tell me
- The link, and exactly how to add it to my iPhone home screen.
- The four phone checks to do (F16, N1, N8, N9), in plain steps.
- What's fake on each screen, so I don't report it as a bug.
- Anything in the design you couldn't match, and why.
- Anything you need me to do or decide before Milestone 2.
