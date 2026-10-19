# Trailmix · Milestone 4: sign-in, saving and one tap to play

## Context for Claude Code

Milestones 0–3 are done. Real mixes generate in about 11 seconds, are checked against Deezer, fit their length (to within 2½ minutes), and can be swapped, remixed and shared as mix pages. Milestone 0 proved that saving a playlist to YouTube works.

This milestone makes Trailmix **personal and finished**:
- real Google sign-in, with a guest list, replacing the temporary access code;
- "Keep it" creating a real, unlisted YouTube Music playlist;
- **one tap to play**: no hopping between screens.

It's the last big build before the friend trial on **22 Oct**. Launch is **24 Oct**.

**I have no coding experience.** Explain each step in plain English, tell me exactly what to click in Google Cloud and Vercel, ask before installing anything on my Mac, and never ask me to paste a secret into chat.

Read **TEST-PLAN.md** alongside this brief. Where they disagree, this brief wins, and tell me.

## Decisions since Milestone 3

| Topic | Decision |
| --- | --- |
| Model | **Default to `claude-sonnet-5-5`** (Haiku made up about 49% of suggestions; Sonnet about 26% in one test). Haiku stays as the automatic fallback. I'll set `CLAUDE_MODEL` and `DAILY_MIX_CEILING=30` in Vercel. |
| Lookup | Deezer checks tracks; iTunes gives Apple links in the background; Spotify and YouTube Music use search links. No Odesli. |
| YouTube quota | Video IDs are looked up **only on Keep it**, then cached for everyone. I've applied for more quota, but assume we stay at 10,000 a day for the beta. |
| "Shared by" | The sharer's Google first name. |
| Guest list | Me plus two friends for the trial (I'll add their emails as a Vercel variable). |

## 1. Google sign-in and the guest list (F1, F2, E7, E13, N6, N7)
- Auth.js with Google, using the "Trailmix Web Client" OAuth client. Allowed redirect URIs are `https://trailmix.augustusnas.com/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`. If Auth.js needs a different path, tell me and I'll change it in Google Cloud.
- **Sign-in asks for basic profile only** (name and email). Don't ask for YouTube access at sign-in; see section 2.
- **Guest list:** a `GUEST_EMAILS` environment variable (comma-separated). Anyone not on it is signed out straight away, and Welcome explains that Trailmix is invite-only (E13). Check the guest list on the server for **every** request, not just at sign-in.
- "Lace up" on Welcome becomes **Sign in with Google**. After the first sign-in, the flow is Where do you listen → Home (F1). Returning users go straight to Home (F2).
- **Remove the temporary access code** and its module. Every server route now refuses requests without a signed-in guest (N6), and a test calls each route signed out.
- Session cookie: HTTP-only, Secure, SameSite=Lax (N7). Google tokens are encrypted, server-side only, and never readable by the page.
- **Testing-mode warning:** while the Google app is in Testing mode, Google expires refresh tokens after **7 days**. When that happens, handle it as E7: "Quick sign-in needed, your mix is safe", then sign in and return to the same mix. Tell me in plain English what my testers will see.
- Per-person limits now use the Google account instead of the access code: 20 mixes and 10 saves an hour (E9), and 20 shares a day.

## 2. Keep it → a real YouTube Music playlist (F13, F14, E5, E6, E8, N4, N14)
- The **first** time someone taps "Keep it in YouTube Music", ask Google for YouTube permission (incremental consent, the `youtube` scope). Explain it in one line first: "Trailmix needs permission to add this playlist to your YouTube account."
- If they deny it (E8): "Without YouTube access I can't save playlists, but you can share the list." Then offer **Switch music app** or **Open the track list**.
- Create a **new, unlisted** playlist each time (F14) named `Trailmix · <Routine> · <Fun name> · <Day Mon>`. Description: routine, energy, length and genres, plus "Made with Trailmix".
- For each track, get the YouTube video ID: **cache first** (Upstash, shared by everyone), then `search.list` (prefer the Music category), then cache the result. Respect the daily search cap (`YOUTUBE_SEARCH_DAILY_CAP`, default 60). Add tracks in mix order.
- **E6, save fails partway:** keep the playlist and show "Saved 8 of 11 tracks", with a Retry button that adds only the missing ones.
- **E5, quota or search cap used up:** block Keep it with "YouTube's daily limit is used up. Try tomorrow or share the list". Make the mix and mix pages keep working.
- Save within 15 seconds when most tracks are cached (N4). Log the units each save uses (N14), and tell me the real numbers for a fresh and a cached save.
- Store the playlist ID with the mix, so the mix page can offer "Open the whole playlist".

## 3. One tap to play (my phone test, 19 Oct)
Today it takes three screens to reach YouTube Music. Fix the flow:

| Music app | Main button on The mix | What one tap does |
| --- | --- | --- |
| YouTube Music | Keep it in YouTube Music | Short "Saving to YouTube Music…" progress, then **opens the new playlist straight in the YouTube Music app**. When I come back to Trailmix, Saved is waiting (Share with friends, Back to home). |
| Spotify / Apple Music | Open in Spotify / Apple Music | Goes **straight to the track list** (the mix page, with my app leading); each track is one tap from the app. **No Saved screen in between.** Share with friends is on that page. |

- Remove the stand-in that sends Saved's "Open in YouTube Music" to the mix page. On Saved it now reopens the real playlist.
- **Mix page:** show the big "Open in YouTube Music" / "Open the whole playlist" button only when a real playlist exists. Otherwise remove the button and its "Then tap any track below" line, and leave just the per-track arrows.
- Test on a real iPhone, in the installed app, that the YouTube Music link opens the **app** rather than a browser tab. If iOS needs a particular link format for that, use it and tell me.

## 4. Better mixes: one flowing playlist (decided 19 Oct)
- **No more warm-up, main block and cool-down.** People decide their own warm-up and cool-down, so the app shouldn't guess at them. Remove the phase labels from The mix, Saved, the mix page and the playlist description. A mix is one numbered list.
- In the background, keep a **gentle energy shape**: open a little lighter, peak through the middle, ease off over the last track or two. Never label it, and never let it override the genre or energy chosen.
- **Swap** replaces a track with one of similar energy and the same genres. Remove "same phase" from swap and from the tests.
- Track count: enough to fill the length, with no track over 7 minutes, and at least 8 tracks for 30 minutes (scale up for longer). For Driven and Feral, no slow tracks anywhere in the mix.
- Keep the 2-per-artist rule, the recent-artists list, the "only real tracks" rule, and the artist-match, duplicate and genre checks from the fix round.
- Update TEST-PLAN.md: F9 ("a fun name and a single list"), F11 (similar energy, not same phase), E1 (no phase wording).

## 5. Shared mix pages
- "Shared by <first name>", from the sharer's Google account.
- Mixes that have a saved playlist show "Open the whole playlist" in YouTube Music.
- Share is available from Saved (YouTube users) and from the track list (Spotify and Apple users).

## 6. Privacy page
Add a simple `/privacy` page in the Trailmix style. It should cover:
- what's stored on the phone: pins, vibe settings, recent mixes and recent artists;
- what's stored on the server: shared mixes for 90 days, anonymous daily counters, and the track and video caches;
- that Google sign-in and YouTube access are used only to create playlists the user asks for, and that nothing is sold or used for ads;
- how to revoke access at myaccount.google.com/permissions;
- links to YouTube's Terms of Service and Google's Privacy Policy;
- the contact email in a `CONTACT_EMAIL` variable.

Link it from the Welcome footer next to the credit, and from the mix page footer.

## Environment variables to walk me through
`GUEST_EMAILS`, `AUTH_SECRET` (secret), the Google client ID and secret (secret), `CONTACT_EMAIL`, `YOUTUBE_SEARCH_DAILY_CAP`. **Remove** `BETA_ACCESS_CODE` once sign-in works. Tell me which to mark as secret.

## Google Cloud steps to walk me through
Add the `youtube` scope to the consent screen, and add my two friends as **test users** (I'll give you their emails when you ask). Confirm the consent screen shows **Trailmix**, and tell me exactly what "unverified app" warning my friends will see, so I can warn them in the invite.

## Tests
- F1, F2, F13, F14, F15 (with the real "Shared by"), F20, F21; E5, E6, E7, E8, E9, E13; N4, N6, N7, N14.
- One-tap flow: from The mix, YouTube users reach the playlist with no intermediate screen, and Spotify and Apple users reach the track list without Saved.
- Minimum track counts and the 7-minute cap at all four lengths; no phase labels anywhere.
- No route works without a signed-in guest; nobody outside `GUEST_EMAILS` can do anything.
- Keep the test switches (behind `SHOW_RESET_PAGE`) for E5, E6, E7 and E10, so I can force them during the friend trial.
- Update TEST-PLAN.md for anything that changed.

## Build order (push after each step)
1. Sign-in and the guest list; remove the access code.
2. Keep it → playlist, with the video cache and E5, E6 and E8.
3. The one-tap flow, and the mix page button rule.
4. The single-list change, energy rules and the Sonnet rerun.
5. "Shared by", privacy page, tests and docs.

## Out of scope
The check-in card, the stats page, the welcome animation (Milestone 5), saving to Spotify or Apple Music, and Google app verification.

## When you finish, tell me
- How to test it on my phone, step by step, including signing in as a non-guest (I'll use another Google account).
- Real save timings, and YouTube units for a fresh and a cached save.
- Sonnet vs Haiku failure counts.
- What my friends will see when they sign in, word for word, so I can write the invite.
- Anything I need to do before the friend trial on 22 Oct.
