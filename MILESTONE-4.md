# Trailmix · Milestone 4: better mixes, sign-in, saving and one tap to play

**This is the single, consolidated brief for Milestone 4 (written 19 Oct, evening).** It replaces every earlier Milestone 4 note and prompt. Read it with **TEST-PLAN.md**, which has been rewritten to match. If anything still conflicts, this brief wins, and tell me.

## Context for Claude Code
Milestones 0–3 are done. Real mixes generate in about 11 seconds, are checked against Deezer, reach their length, and can be swapped, remixed and shared. The privacy page is live (commit "Privacy page, linked from the Welcome footer").

My phone test on 19 Oct found two problems:
- **Mixes contain the wrong artists and wrong genres:** Taylor Swift, Sting and Bob Marley in UK rap & grime / drum & bass mixes, and the same song twice ("Pow" and "Pow (Forward)").
- **It takes three screens to reach YouTube Music.**

I've also decided to **drop warm-up, main block and cool-down**.

This milestone fixes the mixes first, then adds Google sign-in, real YouTube playlists and one tap to play. The friend trial is **22 Oct**; launch is **24 Oct**.

**I have no coding experience.** Explain each step in plain English, tell me exactly what to click in Google Cloud and Vercel, ask before installing anything on my Mac, and never ask me to paste a secret into chat.

If you already started any of Part A from my earlier prompts, say what's done and carry on from there.

## Decisions in force

| Topic | Decision |
| --- | --- |
| Mix shape | **One flowing list. No warm-up, main block or cool-down labels anywhere.** A gentle energy shape stays in the background only (a little lighter at the start, a peak through the middle, easing off on the last track or two). |
| Model | `claude-sonnet-5-5` by default; Haiku as the automatic fallback. I set `CLAUDE_MODEL` and `DAILY_MIX_CEILING=30` in Vercel. |
| Lookup | Deezer checks tracks; iTunes gives Apple links in the background; Spotify and YouTube Music use search links. No Odesli. |
| Genres | The 12 broad genres, up to 3 per mix. |
| YouTube quota | Video IDs are looked up only on Keep it and cached for everyone. We stay at 10,000 units a day for the beta (an increase has been requested). |
| Sign-in | Google sign-in plus a guest list replaces the temporary access code. |
| "Shared by" | The sharer's Google first name. |

---

## Part A: mixes that fit (do this first, and push before Part B)

1. **The artist must match.** Accept a Deezer result only if its artist matches Claude's artist after normalising (case, "The", "&"/"and", featured artists) or through a short alias list (2Pac/Tupac and similar). A title match with a different artist is a failure. This is the likely cause of the Taylor Swift, Sting and Bob Marley tracks.
2. **No duplicates.** Treat titles as the same song after removing brackets, "feat.", "remix", "edit" and "version".
3. **Genre check.** Map our 12 genres to Deezer's genres, and reject tracks whose album or artist genre is clearly outside the chosen ones. Log when Deezer has no genre.
4. **One flowing list.**
   - Remove the phase labels from The mix, Saved, the mix page and the playlist description.
   - Keep the background energy shape described in "Decisions in force".
   - Older stored mixes and shared pages must still display, as one list.
5. **Track rules.**
   - Minimum track counts: 8 for 30 minutes, 12 for 45, 16 for 60, 24 for 90.
   - No track over 7 minutes; shortest 1½ minutes.
   - For Driven and Feral, no slow tracks anywhere (use Deezer's BPM if it has one, and tell me if it doesn't).
   - Length within 2½ minutes of the target, up to 3 top-up rounds.
6. **Swap** picks a track of similar energy and the same genres (not "same phase"), with the existing 15-second limit.
7. **Messages.** Never show "A few tracks couldn't be found". Only if a mix is still more than 5 minutes short, show "This one came out at X minutes."
8. **Keep** the 2-per-artist rule, the recent-artists list, the "only real tracks" prompt rule and the bad-track count.
9. **Quality report.** On Sonnet, make 5 mixes each at 30 and 45 minutes, Driven, for:
   - UK rap & grime
   - Drum & bass
   - Afrobeats & amapiano
   - all three together

   For each mix, report: wrong-artist rejections, genre rejections, duplicates removed, track count, final length, and any track you think is still off-genre.

**Push Part A on its own and send me the quality report before starting Part B**, so I can test the mixes on my phone while you build sign-in.

---

## Part B: Google sign-in and the guest list (F1, F2, E7, E13, N6, N7)
- Auth.js with Google, using the "Trailmix Web Client" OAuth client. Allowed redirect URIs are `https://trailmix.augustusnas.com/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`. If Auth.js needs a different path, tell me and I'll change it in Google Cloud.
- **Sign-in asks only for basic profile** (name and email). YouTube permission comes later; see Part C.
- **Guest list:** a `GUEST_EMAILS` variable, comma-separated.
  - Check it on the server for **every** request.
  - Anyone not on it is signed out, and Welcome explains that Trailmix is invite-only (E13).
- "Lace up" becomes **Sign in with Google**. After the first sign-in: Where do you listen → Home (F1). Returning users go straight to Home (F2).
- **Remove the temporary access code and its module.** Every server route refuses requests without a signed-in guest (N6).
- **Cookie and tokens (N7):**
  - The session cookie is HTTP-only, Secure, SameSite=Lax.
  - Google tokens are encrypted, server-side only, and never readable by the page.
- **Google Testing mode expires refresh tokens after 7 days.** Handle that as E7: "Quick sign-in needed, your mix is safe", then return to the same mix. Tell me word for word what my testers will see.
- **Limits move to the Google account:** 20 mixes and 10 saves an hour (E9), and 20 shares a day.

## Part C: Keep it → a real YouTube Music playlist (F13, F14, E5, E6, E8, N4, N14)
- **The first time someone taps "Keep it in YouTube Music"**, show one line: "Trailmix needs permission to add this playlist to your YouTube account." Then request the `youtube` scope (incremental consent).
- **If they deny it (E8):** "Without YouTube access I can't save playlists, but you can share the list", with **Switch music app** and **Open the track list**.
- **The playlist itself:**
  - A **new, unlisted** playlist each time (F14).
  - Named `Trailmix · <Routine> · <Fun name> · <Day Mon>`.
  - Description: routine, energy, length and genres, plus "Made with Trailmix" (no phase wording).
  - Tracks in mix order.
- **Video IDs:** check the cache first (Upstash, shared by everyone), then `search.list` (prefer the Music category), then cache the result. Respect `YOUTUBE_SEARCH_DAILY_CAP` (default 60).
- **E6:** keep the partial playlist and show "Saved 8 of 11 tracks", with a Retry button that adds only the missing ones.
- **E5:** when YouTube's quota or the search cap is used up, block Keep it with "YouTube's daily limit is used up. Try tomorrow or share the list". Mix-making and mix pages keep working.
- **Speed and units:** save within 15 seconds when most tracks are cached (N4). Log the units each save uses (N14), and report real numbers for a fresh and a cached save.
- Store the playlist ID with the mix.

## Part D: one tap to play

| Music app | Main button on The mix | What one tap does |
| --- | --- | --- |
| YouTube Music | Keep it in YouTube Music | "Saving to YouTube Music…" progress, then **opens the new playlist straight in the YouTube Music app**. Coming back to Trailmix shows Saved (Share with friends, Back to home). |
| Spotify / Apple Music | Open in Spotify / Apple Music | Goes **straight to the track list** (the mix page, with my app leading). **No Saved screen.** Share with friends is on that page. |

- Remove the stand-in that sends Saved's "Open in YouTube Music" to the mix page. It now reopens the real playlist.
- **Mix page:** show the big "Open the whole playlist" button only when a real playlist exists. Otherwise remove the button and its "Then tap any track below" line; the per-track arrows are enough.
- Confirm on a real iPhone, from the installed app, that the YouTube Music link opens the **app** rather than a browser tab. If iOS needs a particular link format for that, use it and tell me.

## Part E: shared mix pages and privacy
- The mix page shows "Shared by <Google first name>", and "Open the whole playlist" when the mix has a saved playlist.
- Share is available from Saved (YouTube Music users) and from the track list (Spotify and Apple Music users).
- **Privacy page** (already live; update it, don't rebuild it):
  - Change "will soon use Google sign-in" to the present tense.
  - Remove the mention of access codes.
  - Add the Google account data actually stored (name, email, and encrypted tokens), and how long it's kept.
  - Read the contact email from `CONTACT_EMAIL`.
  - Link the page from the mix page footer as well.
- **Terms page** (`/terms`, added 22 Oct), in the Trailmix style: it's a beta, no warranty, use of YouTube is subject to YouTube's Terms of Service, how to delete your data, contact `CONTACT_EMAIL` (trailmix@augustusnas.com). Linked next to Privacy wherever Privacy is linked.

## Environment variables to walk me through
`GUEST_EMAILS`, `AUTH_SECRET` (secret), Google client ID and secret (secret), `CONTACT_EMAIL`, `YOUTUBE_SEARCH_DAILY_CAP`. **Remove** `BETA_ACCESS_CODE` once sign-in works. Tell me which to mark as secret.

## Google Cloud steps to walk me through
- Add the `youtube` scope to the consent screen.
- Add my two friends as test users (ask me for their emails when you need them).
- Confirm the consent screen shows **Trailmix**.
- Tell me the exact "unverified app" warning my friends will see, so I can warn them in the invite.

## Tests
- Write the tests alongside each part, and **update TEST-PLAN.md** wherever the build differs from it.
- Keep the test switches (behind `SHOW_RESET_PAGE`) for E5, E6, E7 and E10, so I can force them during the friend trial.

## Build order (push after each)
1. Part A, then the quality report. **Stop here and send it to me.**
2. Part B: sign-in and guest list; remove the access code.
3. Part C: Keep it → playlist.
4. Part D: one tap to play.
5. Part E, then TEST-PLAN.md updates.

## Out of scope
The check-in card, the stats page, the welcome animation (Milestone 5), saving to Spotify or Apple Music, and Google app verification.

## When you finish, tell me
- How to test it on my phone, step by step, including signing in as a non-guest.
- Save timings, and YouTube units for a fresh and a cached save.
- What my friends will see when they sign in, word for word, so I can write the invite.
- Anything I need to do before the friend trial on 22 Oct.
