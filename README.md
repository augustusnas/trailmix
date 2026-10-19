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
| Fake mixes (until Milestone 3) | `src/data/fakeMix.ts` |
| What the phone remembers (pins, vibes, music app) | `src/lib/store.ts` |
| Who sees Welcome vs Home (Milestone 4 swaps in sign-in here) | `src/lib/gate.ts` |
| Library search rules | `src/lib/search.ts` |
| Beta label on/off, live URL, credit | `src/config/site.ts` |
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

One record in `localStorage` under the key `trailmix`: `{ version, onboarded, musicApp, pins, vibes, recentMixes }`. It holds ids only, never names, and is never sent to the server. Damaged or old data quietly resets to the defaults (E12). There are still no cookies.

**Beta reset** (only when `SHOW_RESET_PAGE` is `true`): tap "The library." heading 5 times quickly. That opens `/reset`, which can reset the phone to a fresh install or deliberately damage the saved data to test E12.

## Settings (environment variables)

| Name | What it does | If missing |
| --- | --- | --- |
| `FEEDBACK_EMAIL` | Address the Library's "Send beta feedback" button emails | The button is hidden |
| `SHOW_RESET_PAGE` | `true` turns on the beta reset page and its hidden 5-tap way in. Switch it off before sending beta invites | Off: `/reset` is "page not found" and the tap does nothing |

Set them in Vercel → Project → Settings → Environment Variables, or in `.env.local` on the Mac. Never commit them.

## Secrets

The Google client JSON (`client_secret*.json`), saved sign-ins (`token*.json`) and every `.env*` file are listed in `.gitignore` and never get committed.
