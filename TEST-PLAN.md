# Trailmix · Test plan

**Updated 19 Oct (evening) for Milestone 4.** Mixes are now **one flowing list**: there's no warm-up, main block or cool-down, and any check that mentioned phases has been rewritten. Google sign-in replaces the access code. The Milestone 4 section comes first. Everything after it is the full reference.

**Instruction for Claude Code:** write the tests alongside each feature, not afterwards. A milestone isn't finished until its automated tests pass and I've ticked its phone checks. Tell me in plain English what each failing test means. If the build differs from this plan, update this file.

## How testing works

| Layer | Who runs it | When | What it catches |
| --- | --- | --- | --- |
| Automated tests | Claude Code writes them; they run on every push via GitHub Actions | Every change | Logic: pin cap, input validation, naming, lookup checks, error handling |
| Fake services | Built into the automated tests | Every change | Claude, Deezer, iTunes, Google and YouTube replaced with recorded responses, so tests cost nothing and never touch my accounts |
| Quality report | Claude Code, on real services | After any change to mix-making | Wrong artists, off-genre tracks, duplicates, track counts and lengths |
| Phone checklist | Me, on my iPhone | End of each milestone | Real look and feel, sign-in, a real playlist in YouTube Music |
| Friend trial | Two invited test users | 22–23 Oct | Sign-in as someone else; their own music app; shared mix pages |

---

## Milestone 4: what must pass

### Part A: mixes that fit
| ID | Check |
| --- | --- |
| Q1 | A Deezer result counts only if its artist matches Claude's artist (after normalising) or a known alias; a title match by a different artist is rejected |
| Q2 | No song appears twice in a mix (titles compared without brackets, "feat.", "remix", "edit" or "version") |
| Q3 | Tracks clearly outside the chosen genres are rejected, using Deezer's album or artist genre. *As built:* a track is rejected when neither its album's genre nor any genre on at least 20% of the artist's Deezer albums fits (map in `src/server/genres.ts`); with no genre at all it's kept and counted as `noGenre` in the log. Deezer's genres can't tell UK from US rap, or drum & bass from dubstep, so a **genre review** follows: Claude is asked twice, at the same time as the Deezer check, to give every track a verdict (yes, no or unsure), and a track is removed only when both answers say a clear "no" (logged as `offGenreReview`). If the review fails, nothing is removed |
| Q4 | Track count is roughly 8 / 12 / 16 / 24 for 30 / 45 / 60 / 90 minutes (a track or two fewer is fine); no track is over 7 minutes or under 1½ minutes |
| Q5 | For Driven and Feral, no slow tracks (BPM check where Deezer has one). *As built:* a reading is slow only when it's clearly slow for every chosen genre, and doubling it doesn't give a normal tempo for the genre (Deezer often reads fast tracks at half speed). For Hip-hop & UK rap, Dance & electronic and Afrobeats & amapiano, a reading under 80 is never slow. Ranges in `src/server/genres.ts`. Tracks without a BPM are kept and counted as `noTempo` |
| Q6 | No more than 2 tracks by one artist; recent artists for the routine are sent with each request |
| Q7 | No phase labels on The mix, Saved, the mix page or the playlist description; older stored mixes and shared pages display as one list |
| Q8 | "A few tracks couldn't be found" never shows; "This one came out at X minutes" shows only when a mix is more than 5 minutes short |
| Q9 | Quality report: 5 mixes each at 30 and 45 minutes, Driven, for UK rap & grime, Drum & bass, Afrobeats & amapiano, and all three together, all on Sonnet. Results: zero wrong-artist tracks shown; no duplicates; every mix roughly meets Q4; lengths close to the target (see F10) |
| Q10 | Genres are 8 (from 22 Oct): UK rap & grime joined Hip-hop as "Hip-hop & UK rap" (UK artists where Claude is confident, grime not forced); House, Techno, Drum & bass and Electronic became "Dance & electronic", steered by energy (Easy and Steady lean house, Driven and Feral lean drum & bass, techno and harder dance). Saved vibes, recent mixes and shared mixes with the old genres show as the new ones and still work (E12); still at most 3 genres |

### Parts B–E: sign-in, saving and one tap
| ID | Check |
| --- | --- |
| F1 | Fresh install → Welcome → Sign in with Google → Where do you listen → Home with Push day, Incline treadmill and HIIT circuit |
| F2 | Returning signed-in guest goes straight to Home |
| F13 | Keep it creates an unlisted playlist named `Trailmix · <Routine> · <Fun name> · <Day Mon>`, tracks in mix order, description without phase wording |
| F14 | Two keeps of the same routine on one day give two playlists |
| F15 | Share gives one mix page link; signed out, it shows "Shared by <first name>", one list, "Tracks open in <the visitor's app>", and "Open the whole playlist" only when a real playlist exists. A link shared before Keep it gets the playlist once the mix is kept. Share with friends is on the page too |
| F20 | Spotify and Apple Music users see "Open in Spotify / Apple Music" and land on the track list with no Saved screen |
| F21 | The chosen routine carries through every screen and the playlist name |
| One tap | YouTube Music users: one tap on Keep it → saving progress → the playlist opens in the YouTube Music app; Saved shows on return |
| E5 | Quota or search cap used up → Keep it blocked with the friendly message; mixes and mix pages still work |
| E6 | Partial save → "Saved 8 of 11 tracks" with a Retry that adds only the missing ones |
| E7 | Expired Google session (including the 7-day Testing-mode expiry) → "Quick sign-in needed, your mix is safe", then back to the same mix |
| E8 | YouTube permission denied → friendly message, plus Switch music app and Open the track list |
| E9 | Per Google account: 20 mixes and 10 saves an hour; 20 shares a day |
| E13 | A Google account not on `GUEST_EMAILS` is signed out, and Welcome explains invite-only |
| N4 | Save within 15 seconds when most tracks are cached |
| N6 | Every server route refuses requests without a signed-in guest; the access code is gone |
| N7 | Session cookie is HTTP-only, Secure, SameSite=Lax; Google tokens never reach the page |
| *As built (B)* | Sign-in is written directly on Next.js (OAuth 2.0 with PKCE, `src/server/google.ts`), not Auth.js: no new package, same redirect address (`/api/auth/callback/google`). Settings: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GUEST_EMAILS`. The session lasts 7 days, matching Testing mode; after that the next request gives E7. Part B keeps no Google tokens at all (basic profile only); Part C will store the YouTube token encrypted in Upstash. Test switch **E7** forces a run-out sign-in |
| N14 | Units per save logged; fresh and cached figures reported |
| Privacy | /privacy reflects sign-in, has no access-code wording, lists the Google data kept, and is linked from Welcome and the mix page |
| Terms | /terms: beta, no warranty, YouTube's Terms of Service, how to delete your data, the contact email (`CONTACT_EMAIL`); linked next to Privacy everywhere |
| N5, N8, N11 | Secret scan; screenshots at 320, 390 and 430px including the largest text size (new screens: sign-in, permission, saving, E5 to E8); accessibility scan |

### On my phone (installed app)
- [ ] **Mixes fit:** make Hip-hop & UK rap, Dance & electronic and Afrobeats & amapiano mixes (30 min, Driven). No wrong artists, no off-genre tracks, no repeats, at least 8 tracks, close to 30 minutes.
- [ ] **One list:** no warm-up, main block or cool-down labels anywhere.
- [ ] **Swap and Remix:** swapped tracks fit the energy and genre; Remix brings new artists.
- [ ] **Sign-in (F1):** reset to a fresh install → Sign in with Google → Where do you listen → Home.
- [ ] **Non-guest (E13):** sign in with another Google account → refused, with the invite-only message.
- [ ] **Keep it (F13, one tap):** first time, the permission step; then one tap → the playlist opens in the YouTube Music app, named correctly, tracks in order.
- [ ] **Saved on return:** come back to Trailmix → Saved is shown → Share with friends works.
- [ ] **Spotify path (F20):** switch the music app to Spotify in the Library → Open in Spotify goes straight to the track list.
- [ ] **Shared page (F15):** open a shared link in a private Safari window (signed out) → "Shared by Charles" (from Google), "Open the whole playlist" for a kept mix, opening the playlist in YouTube Music.
- [ ] **Shared before kept:** share from Open the track list (E8) or the E5 box, then Keep it → the same link now shows "Open the whole playlist".
- [ ] **E6 / E7:** force each with the test switches; the messages and recovery behave as written.
- [ ] **Large text:** walk the new screens at the largest text size.

---

## Full reference

### Functional acceptance criteria
| ID | Feature | Given / when / then | Milestone |
| --- | --- | --- | --- |
| F1 | First run | Given a fresh install, when I open the app, then Welcome shows; after Google sign-in and Where do you listen, Home shows Push day, Incline treadmill and HIIT circuit pinned | 2, sign-in 4 |
| F2 | Return visit | Given I've signed in before, when I open the app, then it goes straight to Home | 2, 4 |
| F3 | Pin a routine | Given fewer than 6 pins, when I pin from the Library, then it appears on Home in the same colour and the count goes up | 2 |
| F4 | Pin cap | Given 6 pins, when I open the Library, then unpinned + buttons are disabled and the "home is full" notice shows | 2 |
| F5 | Unpin | Given a pinned routine, when I unpin it, then it leaves Home and pins are available again | 2 |
| F6 | Library search and filter | When I type "tab" or tap Conditioning, then only matching routines show; no match shows the empty message | 2 |
| F7 | Vibe memory | Given I used Boxing with Hip-hop & UK rap, Driven, 45, when I pick Boxing again, then those settings are preselected | 2 |
| F8 | Vibe validation | Given no genre selected, when I tap Make the mix, then I'm asked to pick at least one (up to 3 allowed) | 2 |
| F9 | Generate | When I make a mix, then I see a fun name and **one numbered list** of tracks that match the chosen genres and energy, every one confirmed on Deezer with the right artist | 3, 4 |
| F10 | Length | Given 45 minutes chosen, the mix lands close to 45. **Length is a guide, not a hard target** (decided 21–22 Oct): a few minutes short is fine, because music apps keep playing similar tracks when a playlist ends. Don't spend extra rounds or seconds chasing an exact length. "This one came out at X minutes" shows only if a mix is more than 5 minutes short | 3, 4 |
| F11 | Swap | When I swap a track, then only that track changes; the new one has similar energy, fits the chosen genres, and isn't already in the list. After 15 seconds the original stays, with "Couldn't find a swap for this one. Try again" | 3, 4 |
| F12 | Remix | When I tap Remix, then a new list and name appear, no YouTube quota is used, and recent artists are avoided; no more than 2 tracks per artist | 3 |
| F13 | Keep it | When I tap Keep it in YouTube Music, then an unlisted playlist named `Trailmix · <Routine> · <Fun name> · <Day Mon>` is created with the tracks in order, and it opens in the YouTube Music app | 4 |
| F14 | New each time | Given I keep two mixes of the same routine on one day, then two separate playlists exist | 4 |
| F15 | Share and mix page | Share gives one mix page link; opening it signed out shows "Shared by <first name>", one list, which app the tracks open in, and each track opening in that app; "Open the whole playlist" only for saved playlists (no big first-track button otherwise), also on links shared before Keep it | 3, 4 |
| F16 | Install | When I add it to the home screen from Safari, then it opens full screen with the Trailmix icon and no browser bars | 1 |
| F17 | Check-in | Given I kept a mix over an hour ago, when I open the app, then the check-in card shows its fun name; one tap records my answer, the card says "Noted", and it never asks about that mix again. Dismissing with × also stops it asking | 5 |
| F18 | Freshness | Given 10 previous mixes, at least 70% of a new mix's tracks aren't in them, and the freshness percentage is recorded | 3 |
| F19 | Learning from check-ins | Given my last Boxing mix was rated "Dipped midway", when I make a new Boxing mix, then that check-in is included in what's sent to Claude | 5 |
| F20 | Where do you listen | Given a first sign-in, when I pick Spotify, then I'm never asked again; The mix shows "Open in Spotify", which goes straight to the track list; changing the app in the Library updates the label immediately | 2, 4 |
| F21 | Selected routine carries through | Given I pick a routine on Home or in the Library, every later screen and the playlist name show that routine's name and colour; no screen ever shows a different or default routine | 1 onward |

### Exception rules
Every failure keeps my current mix on screen, explains itself in one plain sentence, and offers a next step. No raw errors, ever.

| ID | Situation | What the app does | What I see | Milestone |
| --- | --- | --- | --- | --- |
| E1 | A suggested track fails the check (not on Deezer, wrong artist, off-genre, duplicate, or outside 1½–7 minutes) | Asks Claude for a replacement of similar energy and genre, tops up the list (up to 3 rounds), and counts it in the bad-track rate | Nothing, unless the mix ends more than 5 minutes short: "This one came out at X minutes" | 3, 4 |
| E2 | Deezer down or busy; iTunes busy | Deezer: tries each lookup 3 times, then stops if most tracks can't be checked, keeping my vibe. iTunes: Apple links fill in later; those tracks open an Apple Music search meanwhile | Deezer: "The mix didn't come together. Try again" with a button. iTunes: no error | 3 |
| E3 | Claude returns broken JSON or times out | Retries once; Generate and Remix give up after 45 seconds | "The mix didn't come together. Try again" or "That took too long. Try again" | 3 |
| E4 | Claude down or out of credit; or `CLAUDE_MODEL` invalid | Stops and keeps my vibe; an invalid model falls back to Haiku with a logged warning | "Mix-making is resting right now. Try again later" | 3 |
| E5 | YouTube daily quota or search cap reached | Blocks Keep it; mixes and mix pages still work | "YouTube's daily limit is used up. Try tomorrow or share the list" | 4 |
| E6 | Save fails partway | Keeps the playlist; records which tracks are missing | "Saved 8 of 11 tracks" with a Retry that adds only the missing ones | 4 |
| E7 | Google session expired (including the 7-day Testing-mode expiry) | Sends me through sign-in, then returns to the same mix | "Quick sign-in needed, your mix is safe" | 4 |
| E8 | I deny YouTube permission | Doesn't save; offers to switch my music app or open the track list | "Without YouTube access I can't save playlists, but you can share the list" | 4 |
| E9 | Limits hit (20 mixes or 10 saves an hour; 20 shares a day, per Google account) | Refuses the request | "That's a lot of mixes. Back in a few minutes" (or the share message) | 3, 4 |
| E10 | No internet | Disables Make the mix and Keep it; Home and Library still work | "You're offline" banner | 3 |
| E11 | Invalid input reaches the server | Rejects it; nothing sent to Claude | "Something's off with those settings. Pick again" | 3 |
| E12 | Local storage missing, corrupt or an old version | Resets to the 3 default pins and blank vibes; old genres and phased mixes are converted | Nothing; the app works as on first run, without Welcome | 2–4 |
| E13 | Someone not on the guest list signs in | Google blocks non-test users; anyone not on `GUEST_EMAILS` is signed out | Google's own message, or Welcome explaining that Trailmix is invite-only | 4 |
| E14 | Daily mix ceiling reached (`DAILY_MIX_CEILING`, 30) | Refuses new mixes until midnight; saving, sharing and mix pages still work | "Trailmix has made enough mixes for today. Back tomorrow" | 3 |
| E15 | Off switch on (`MIXES_PAUSED=true`) | Refuses new mixes; Home and Library still work | "Mix-making is paused. Back soon" | 3 |
| E16 | Mix link expired (over 90 days) or mistyped | Friendly page in Trailmix colours | "This mix has moved on. Ask whoever shared it for a fresh one" | 3 |
| E17 | Mix page view limit or daily share cap reached | Refuses the request; nothing else affected | "Easy there. Try again in a minute" or "That's today's sharing done. More tomorrow" | 3 |

### Non-functional acceptance
| ID | Area | Target | How to check |
| --- | --- | --- | --- |
| N1 | Speed: opening | Home visible within 2 seconds on 4G | Open from the home screen with Wi-Fi off |
| N2 | Speed: first mix | Mix on screen within 30 seconds; progress shown after 2 | Time it on a fresh routine |
| N3 | Speed: repeat tracks | Under 10 seconds when most tracks are cached | Remix a routine used before |
| N4 | Speed: save | Playlist saved within 15 seconds when most tracks are cached | Time Keep it |
| N5 | Security: secrets | No key appears in the repository or the browser | Claude Code runs a secret scan; I search the page source for "sk-" |
| N6 | Security: access | Every server function refuses requests without a signed-in guest | An automated test calls each one signed out |
| N7 | Security: cookie | Session cookie is HTTP-only, Secure, SameSite=Lax; tokens server-side only | An automated test reads the cookie flags |
| N8 | Screens | No clipped text or sideways scrolling at 320, 390 and 430px | Claude Code takes screenshots at each width, including the largest text size |
| N9 | Safe areas | Nothing hidden under the notch, Dynamic Island or home bar | Check on my iPhone in the installed app |
| N10 | Larger text | Usable at the largest standard iOS text size | Set text size to maximum and walk the flow |
| N11 | Accessibility | 44px tap targets, 4.5:1 text contrast, VoiceOver reads every button | Automated scan, plus one VoiceOver pass |
| N12 | Motion | No animation when Reduce Motion is on | Toggle it in iOS settings |
| N13 | Cost | Under £5 a month in Claude API spend (Sonnet, ceiling 30 a day) | Check the Anthropic Console weekly during the beta |
| N14 | Quota | Units per save logged; a cached save under 1,000 units; a fresh 14-track save about 1,500 | Check the logs and the Google Cloud quota page after saves |
| N15 | Security: audit | No high findings open at launch | Claude Code runs the security audit on 21 Oct; I review the list |
| N16 | Security: public limits | Mix pages refuse more than 60 views a minute per visitor; shares capped at 20 a day per user | An automated test fires requests past each limit and checks the friendly message |

### Sign-off before sharing with friends
- [ ] All automated tests pass on the latest deploy
- [ ] The latest quality report (Q9) shows no wrong-artist tracks or duplicates
- [ ] F1–F21 checked on my iPhone in the installed app (F17 and F19 after Milestone 5)
- [ ] E3, E5, E6, E7 and E10 forced at least once with the test switches, and behaved as written
- [ ] N1–N12 and N16 checked; security audit (N15) done with no high findings open; N13 and N14 reviewed after the first week
- [ ] Groove Miles test playlist from Milestone 0 still saves correctly
- [ ] Two friends added as Google test users and to `GUEST_EMAILS`, signed in, and opened a mix in their own music app via Where do you listen and a shared mix page
- [ ] `SHOW_RESET_PAGE` turned off before the 24 Oct invites
- [ ] No outstanding bugs that lose a mix or show a raw error
