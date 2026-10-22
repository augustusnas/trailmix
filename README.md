# Trailmix

Personal iPhone web app (invite-only beta) that turns a gym routine plus a mood into a YouTube Music playlist.

Live at **https://trailmix.augustusnas.com**. Vercel deploys every push to `main`.

## Where things live

| What | Where |
| --- | --- |
| Screens | `src/app/` (one folder per screen: `listen`, `home`, `library`, `vibe`, `mix`, `saved`, `m/[id]`) |
| The 17 routines | `src/data/routines.ts` |
| Category colours | `src/data/categories.ts` |
| Genres, energy levels, lengths | `src/data/vibe.ts` |
| The mix prompt (everything Claude is told) | `src/server/prompt.ts` |
| Making, swapping and fitting mixes (one flowing list; minimum track counts) | `src/server/mixes.ts`, `src/server/fit.ts` |
| Track lookup (cache → Deezer: right artist, same-song check, 1½–7 minutes, tempo; exact Apple Music links from iTunes in the background) | `src/server/lookup.ts` |
| Genre check (our 8 genres → Deezer's) and the slow-track rule | `src/server/genres.ts` |
| What each genre means, and the genre review Claude does after the catalogue check | `src/server/prompt.ts` (`GENRE_MEANING`, `reviewPrompt`) |
| Limits, off switch, daily ceiling | `src/server/limits.ts`, `src/server/config.ts` |
| Bad-track count (running totals in Upstash, shown at the end of each mix log line; the line's `notes` say why each failed) | `src/server/stats.ts` |
| Problem summaries: a mix or remix that comes out short or fails is saved in Upstash as `problem:<time>` for 7 days (step reached, rounds, not found vs Deezer busy, other counts). Read them in Upstash → Data Browser, searching `problem:*` | `src/server/stats.ts` |
| Google sign-in (OAuth with PKCE, no extra package) and the guest list, checked on every request | `src/server/google.ts`, `src/server/session.ts`, `src/app/api/auth/` |
| Keep it → YouTube playlist (the YouTube permission, sealed tokens, video ids cached for everyone, daily units and search cap, partial saves). Each save logs `youtube-save` with its units | `src/server/youtube.ts`, `src/app/api/save/` |
| Shared mix pages | `src/server/shares.ts`, `src/app/m/[id]/` |
| Recorded stand-ins used by tests | `src/server/fakes.ts` |
| What the phone remembers (pins, vibes, music app) | `src/lib/store.ts` |
| Who sees Welcome vs Home (Milestone 4 swaps in sign-in here) | `src/lib/gate.ts` |
| Library search rules | `src/lib/search.ts` |
| Beta label on/off, live URL, credit, privacy contact email | `src/config/site.ts` |
| Privacy page (keep it true when what is stored changes) | `src/app/privacy/page.tsx` |
| Terms page; the Privacy · Terms links | `src/app/terms/page.tsx`, `src/components/LegalLinks.tsx` |
| Contact email on Privacy and Terms (`CONTACT_EMAIL` in Vercel, else `src/config/site.ts`) | `src/config/contact.ts` |
| Colours, fonts, shapes | `src/app/globals.css` (top of file) |
| App icon (one source for every size) | `src/brand/AppIcon.tsx` |
| Offline helper (service worker) | `src/app/sw.js/route.ts` |
| Security headers | `next.config.ts` |
| Design mockups | `design/reference/` |
| Milestone 0 playlist script | `scripts/milestone-0/` |

## Running it on the Mac

```
npm install          # first time only
npm run dev          # then open http://localhost:3000
```

## Tests

```
npm test             # quick checks (routine data, feedback button, playlist title)
npm run build        # the browser tests run against a real build
npm run test:e2e     # every screen in Safari's engine: navigation, F21, labels, security, offline, accessibility
npm run screenshots  # just the screenshot checks; images land in screenshots/
```

GitHub Actions runs all of these on every push.

## What's stored on the phone

One record in `localStorage` under the key `trailmix`: `{ version, onboarded, musicApp, pins, vibes, recentMixes }`. It holds ids only, never names, and is never sent to the server. Damaged or old data quietly resets to the defaults (E12). The only cookie is the sign-in session (`trailmix-session`): HTTP-only, Secure, SameSite=Lax, sealed with `AUTH_SECRET`, and holding just the Google account id, email, first name and expiry (7 days). A second cookie (`trailmix-oauth`) lives for the few minutes of a sign-in.

Upstash's own settings (`UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/`_TOKEN`) come from Vercel's Upstash integration. Without them (on a Mac), counts, the track cache and shared mixes live in memory.

**Beta reset** (only when `SHOW_RESET_PAGE` is `true`): tap "The library." heading 5 times quickly. That opens `/reset`, which can reset the phone to a fresh install, deliberately damage the saved data to test E12, and switch on test failures (E1, E2, E3, E4, E5, E7, E9, E10, E14, E15, two in three tracks failing, a short mix, a too-short mix, a slow swap).

## Settings (environment variables)

| Name | What it does | If missing |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude, for making mixes | Mix-making says it's resting |
| `CLAUDE_MODEL` | Which Claude model makes mixes (`claude-sonnet-5-5` for Sonnet). A name that doesn't work falls back to Haiku, with a `model-fallback` warning in the log | `claude-haiku-5-5` |
| `YOUTUBE_API_KEY` | Not used yet: Milestone 4 saves YouTube Music playlists with it | Nothing changes yet |
| `AUTH_SECRET` | Seals the sign-in cookie. Long and random; **secret**. Changing it signs everyone out | Nobody can sign in |
| `AUTH_GOOGLE_ID` | The "Trailmix Web Client" OAuth client ID from Google Cloud | Welcome says sign-in isn't working |
| `AUTH_GOOGLE_SECRET` | That client's secret; **secret** | Welcome says sign-in isn't working |
| `GUEST_EMAILS` | Who may use Trailmix: Google account emails, comma-separated. Checked on every request | Nobody gets in |
| `DAILY_MIX_CEILING` | Most mixes a day across everyone (E14), reset at UK midnight | 60 |
| `MIXES_PAUSED` | `true` pauses mix-making at once (E15) | Not paused |
| `FEEDBACK_EMAIL` | Address the Library's "Send beta feedback" button emails | The button is hidden |
| `SHOW_RESET_PAGE` | `true` turns on the beta reset page and its hidden 5-tap way in. Switch it off before sending beta invites | Off: `/reset` is "page not found" and the tap does nothing |

Set them in Vercel → Project → Settings → Environment Variables, or in `.env.local` on the Mac. Never commit them.

## Secrets

The Google client JSON (`client_secret*.json`), saved sign-ins (`token*.json`) and every `.env*` file are listed in `.gitignore` and never get committed.
