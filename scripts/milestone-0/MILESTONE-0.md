# Trailmix · Milestone 0: prove the save works

## Context for Claude Code

Trailmix is a personal iPhone web app (invite-only beta) that turns a gym routine plus a mood into a playlist saved to YouTube Music. The full build comes later. This milestone is a **small throwaway script, run on my Mac**, that creates one real playlist in my YouTube account. It proves the Google Cloud setup, sign-in, quota and playlist naming work before anything else is built.

**I have no coding experience.** Explain each step in plain English, tell me exactly what to click in Google Cloud, and never assume I know a command. Ask before installing anything.

## What to build

1. Walk me through the Google Cloud setup first, click by click:
   - Create a project called **Trailmix** (signed in with the Google account whose YouTube Music I use).
   - Enable **YouTube Data API v3**.
   - Set up the OAuth consent screen: **External**, **Testing** mode, app name Trailmix, and add my own Google account as a **test user**.
   - Create an OAuth client. For this local test a **Desktop app** client is simplest; the web client for the real app comes later.
   - Download the client JSON into this folder.
2. Make sure secrets never reach GitHub: add the client JSON, any token file and `.env*` to `.gitignore` **before** the first commit, and confirm this to me.
3. Write a small script (Node or Python, your choice; tell me which and why) that:
   - Opens my browser for Google sign-in and asks only for the YouTube scope it needs.
   - Uses YouTube search to find a video for each track in the list below (prefer the official audio or Music-category result).
   - Creates an **unlisted** playlist titled `Trailmix · Indoor walk · Groove Miles · <today as Day Mon, e.g. 15 Oct>`.
   - Sets the description to `Indoor walk · Steady · 45 min · House. Made with Trailmix`.
   - Adds the tracks in order.
   - Prints the playlist link, plus any tracks it couldn't find.
4. Tell me roughly how much of the 10,000-unit daily YouTube quota the run used.
5. Commit the script and a short README to the repo (no secrets) and push.

**Done when** I open the printed link in YouTube Music on my iPhone, the playlist is unlisted, has the right name, and plays the 11 tracks in order.

## Test track list (Groove Miles)

| # | Phase | Artist | Title |
| --- | --- | --- | --- |
| 1 | Warm-up | Mr. Fingers | Can You Feel It |
| 2 | Warm-up | Kerri Chandler | Rain |
| 3 | Main block | Disclosure | When a Fire Starts to Burn |
| 4 | Main block | Crystal Waters | Gypsy Woman (She's Homeless) |
| 5 | Main block | Robin S | Show Me Love |
| 6 | Main block | Stardust | Music Sounds Better with You |
| 7 | Main block | Purple Disco Machine | Hypnotized |
| 8 | Main block | Peggy Gou | (It Goes Like) Nanana |
| 9 | Main block | Fred again.. | Jungle |
| 10 | Cool-down | Moodymann | Shades of Jae |
| 11 | Cool-down | Bicep | Glue |

## Out of scope for this milestone

No app screens, no Vercel, no Claude API, no Odesli or iTunes lookup. Those start at Milestone 1.
