# Trailmix · Test plan

The full plan is copied from the Trailmix build brief's Test plan tab, so Claude Code has it in the repo. **The section for Milestone 3 comes first.** Everything after it is the complete reference, which later milestones will also use.

**Instruction for Claude Code:** write the tests alongside each feature, not afterwards. A milestone isn't finished until its automated tests pass and I've ticked its phone checks. Tell me in plain English what each failing test means.

## How testing works

| Layer | Who runs it | When | What it catches |
| --- | --- | --- | --- |
| Automated tests | Claude Code writes them; they run on every push via GitHub Actions | Every change | Logic: pin cap, input validation, naming, lookup fallbacks, error handling |
| Fake services | Built into the automated tests | Every change | Claude, iTunes, Odesli and YouTube replaced with recorded responses, so tests cost nothing and never touch my accounts |
| Phone checklist | Me, on my iPhone | End of each milestone | Real look and feel, sign-in, a real playlist in YouTube Music |
| Friend trial | Two invited test users | After Milestone 5 | Sign-in as someone else; opening a shared mix page in Spotify and Apple Music |

---

## Milestone 3: what must pass

### Automated (GitHub Actions)
| ID | Check |
| --- | --- |
| F9 | A generated mix has a fun name, warm-up, main block and cool-down, and every track was found by the lookup |
| F10 | For 30, 45, 60 and 90 minutes, the mix's total length is within 5 minutes of the target |
| F11 | Swap changes only that track; the new one is in the same phase and not already in the list |
| F12 | Remix gives a new list and name, and uses no YouTube quota (apart from the capped fallback search) |
| F15 | Share creates one mix page link; opening it signed out shows the mix and lets the visitor pick YouTube Music, Spotify or Apple Music; each track opens in that app; the visitor's saved app leads |
| F18 | Given 10 previous mixes, at least 70% of a new mix's tracks aren't in them; the freshness percentage is recorded |
| F21 | The chosen routine still carries through Set the vibe, The mix, Saved and the shared mix page |
| E1 | A track iTunes can't find is swapped up to 2 times in the same phase, then dropped; with 3+ dropped, the "a little shorter" message shows |
| E2 | Odesli down or rate-limited → requests queue, then fall back to YouTube search (capped at 3 per mix, 30 a day); no error shown |
| E3 | Broken JSON or a 20-second timeout from Claude → one retry, then "The mix didn't come together. Try again" |
| E4 | Claude down or out of credit → "Mix-making is resting right now. Try again later", with the vibe settings kept |
| E9 | Past 20 mixes an hour → "That's a lot of mixes. Back in a few minutes" |
| E10 | Offline → Make the mix and Keep it disabled, "You're offline" banner; Home and Library still work |
| E11 | Invalid routine, genre, energy or length (or more than 3 genres) is rejected on the server; nothing is sent to Claude |
| E12 | Missing, damaged or old-version storage → three default pins (Push day, Incline treadmill, HIIT circuit) and blank vibes, with no error and no Welcome. **Test it with a full reload.** |
| E14 | Daily ceiling reached → "Trailmix has made enough mixes for today. Back tomorrow"; mix pages still work |
| E15 | `MIXES_PAUSED=true` → "Mix-making is paused. Back soon"; Home and Library still work |
| E16 | An expired or mistyped mix link → "This mix has moved on. Ask whoever shared it for a fresh one", in Trailmix colours |
| E17 / N16 | Over 60 mix page views a minute per IP → "Easy there. Try again in a minute"; over 20 shares a day → "That's today's sharing done. More tomorrow" |
| Access | Every new server route refuses requests without the correct access code (this stands in for N6 until sign-in arrives in Milestone 4) |
| N5 | Secret scan passes; no key appears in anything sent to the browser |
| N8 | Screenshots at 320, 390 and 430px, including the largest text size, with no clipped text or sideways scrolling; new states added (progress, errors, offline, access code) |
| N11 | Accessibility scan passes (44px targets, 4.5:1 contrast, labelled buttons) |

### On my phone (installed app)
1. **Access code:** fresh start → Lace up asks for the code once; a wrong code is refused nicely.
2. **F9 / F10:** make real mixes for three different routines and lengths. Each mix shows within 30 seconds (N2), with progress after 2 seconds, and its running time is within 5 minutes of my choice.
3. **Every track plays** when I tap it in my music app.
4. **F11 / F12:** swap two tracks and Remix once.
5. **F15:** share a mix, then open the link in Safari, not in the app. The page shows the mix, and the app I pick leads next time.
6. **E12:** Damage → the app reloads → three default pins, no Welcome.
7. **E15:** turn on the off switch in Vercel → the "paused" message shows; Home and Library still work. Turn it off again.
8. **E10:** with Wi-Fi and data off, Home and Library work, and Make the mix is disabled with the banner.
9. **N3:** remix a routine I've used before; it shows in under 10 seconds.
10. **Large text:** walk the new screens at the largest text size.

---

## Full reference

### Functional acceptance criteria
| ID | Feature | Given / when / then | Milestone |
| --- | --- | --- | --- |
| F1 | First run | Given a fresh install, when I open the app, then Welcome shows; after sign-in, Home shows Push day, Incline treadmill and HIIT circuit pinned | 2 (sign-in in 4) |
| F2 | Return visit | Given I've signed in before, when I open the app, then it goes straight to Home | 2 |
| F3 | Pin a routine | Given fewer than 6 pins, when I pin from the Library, then it appears on Home in the same colour and the count goes up | 2 |
| F4 | Pin cap | Given 6 pins, when I open the Library, then unpinned + buttons are disabled and the "home is full" notice shows | 2 |
| F5 | Unpin | Given a pinned routine, when I unpin it, then it leaves Home and pins are available again | 2 |
| F6 | Library search and filter | When I type "tab" or tap Conditioning, then only matching routines show; no match shows the empty message | 2 |
| F7 | Vibe memory | Given I used Boxing with Grime, Driven, 45, when I pick Boxing again, then those settings are preselected | 2 |
| F8 | Vibe validation | Given no genre selected, when I tap Make the mix, then I'm asked to pick at least one | 2 |
| F9 | Generate | When I make a mix, then I see a fun name, warm-up, main block and cool-down, and every track was found by the lookup | 3 |
| F10 | Length | Given 45 minutes chosen, when the mix is built, then its total length is within 5 minutes of 45 | 3 |
| F11 | Swap | When I swap a track, then only that track changes, the new one is in the same phase, and it isn't already in the list | 3 |
| F12 | Remix | When I tap Remix, then a new list and name appear and no YouTube quota is used | 3 |
| F13 | Keep it | When I tap Keep it, then an unlisted playlist named `Trailmix · <Routine> · <Fun name> · <Day Mon>` appears in YouTube Music with the tracks in order | 4 |
| F14 | New each time | Given I keep two mixes of the same routine on one day, then two separate playlists exist | 4 |
| F15 | Share and mix page | Given a kept mix, when I tap Share with friends on Saved, then the share sheet opens with one mix page link; opening it signed out shows the mix, lets me pick YouTube Music, Spotify or Apple Music, and opens each track in that app | 3 |
| F16 | Install | When I add it to the home screen from Safari, then it opens full screen with the Trailmix icon and no browser bars | 1 |
| F17 | Check-in | Given I kept a mix over an hour ago, when I open the app, then the check-in card shows its fun name; one tap records my answer, the card says "Noted", and it never asks about that mix again. Dismissing with × also stops it asking | 5 |
| F18 | Freshness | Given 10 previous mixes, when a new mix is made, then at least 70% of its tracks aren't in those mixes, and the freshness percentage is recorded when it's kept | 3 |
| F19 | Learning from check-ins | Given my last Boxing mix was rated "Dipped midway", when I make a new Boxing mix, then that check-in is included in what's sent to Claude | 5 |
| F20 | Where do you listen | Given a first sign-in, when I pick Spotify, then I'm never asked again, Keep it reads "Open in Spotify", and changing it in the Library updates the label immediately | 2 |
| F21 | Selected routine carries through | Given I pick a routine on Home or in the Library, when I move through Set the vibe, The mix, Saved and the shared mix page, then every screen shows that routine's name and colour, and the mix details and playlist name use it. No screen ever shows a different or default routine | 1 onward |

F10 tests the "Hitting the chosen length" rules in the build brief's track lookup section.

### Exception rules
Every failure keeps my current mix on screen, explains itself in one plain sentence, and offers a next step. No raw errors, ever.

| ID | Situation | What the app does | What I see | Milestone |
| --- | --- | --- | --- | --- |
| E1 | Track not found by iTunes or Odesli | Asks Claude for a same-phase swap, up to 2 tries, then drops it | Nothing, unless 3+ tracks drop: "A few tracks couldn't be found, so this mix is a little shorter" | 3 |
| E2 | Odesli down or rate-limited | Queues, then falls back to YouTube search for that track | A progress bar; no error | 3 |
| E3 | Claude returns broken JSON or times out (20s) | Retries once | "The mix didn't come together. Try again" with a button | 3 |
| E4 | Claude API down or out of credit | Stops; keeps my vibe settings | "Mix-making is resting right now. Try again later" | 3 |
| E5 | YouTube daily quota reached | Blocks Keep it; mixes can still be made and opened via the mix page | "YouTube's daily limit is used up. Try tomorrow or share the list" | 4 |
| E6 | Save fails partway | Keeps the playlist; records which tracks are missing | "Saved 8 of 11 tracks" with a Retry button that adds only the missing ones | 4 |
| E7 | Google session expired | Sends me through sign-in, then returns to the same mix | "Quick sign-in needed, your mix is safe" | 4 |
| E8 | I deny the YouTube permission | Stays signed out of saving; offers to switch my music app or open the mix page | "Without YouTube access I can't save playlists, but you can share the list" | 4 |
| E9 | Rate limit hit (20 mixes or 10 saves an hour) | Refuses the request | "That's a lot of mixes. Back in a few minutes" | 3 (saves in 4) |
| E10 | No internet | Disables Make the mix and Keep it; Home and Library still work | "You're offline" banner | 3 |
| E11 | Invalid input reaches the server | Rejects it; nothing sent to Claude | "Something's off with those settings. Pick again" | 3 |
| E12 | Local storage missing or corrupt | Resets to the 3 default pins and blank vibes | Nothing; the app works as on first run, without Welcome | 2–3 |
| E13 | Someone not invited tries to sign in | Google blocks non-test users; anyone who gets past Google but isn't on the guest list is signed out | Google's own message; Welcome explains the app is invite-only | 4 |
| E14 | Daily ceiling across all users reached | Refuses new mixes until midnight; saving, sharing and mix pages still work | "Trailmix has made enough mixes for today. Back tomorrow" | 3 |
| E15 | Off switch turned on | Refuses new mixes; Home and Library still work | "Mix-making is paused. Back soon" | 3 |
| E16 | Shared mix page link expired (over 90 days) or mistyped | Shows a friendly page in Trailmix colours; no error code | "This mix has moved on. Ask whoever shared it for a fresh one" | 3 |
| E17 | Mix page view limit or daily share cap reached | Refuses the request; nothing else affected | "Easy there. Try again in a minute" (page) or "That's today's sharing done. More tomorrow" (share) | 3 |

### Non-functional acceptance
| ID | Area | Target | How to check |
| --- | --- | --- | --- |
| N1 | Speed: opening | Home visible within 2 seconds on 4G | Open from the home screen with Wi-Fi off |
| N2 | Speed: first mix | Mix on screen within 30 seconds; progress shown after 2 | Time it on a fresh routine |
| N3 | Speed: repeat tracks | Under 10 seconds when most tracks are cached | Remix a routine used before |
| N4 | Speed: save | Playlist saved within 15 seconds | Time Keep it (Milestone 4) |
| N5 | Security: secrets | No key appears in the repository or the browser | Claude Code runs a secret scan; I search the page source for "sk-" |
| N6 | Security: access | Every server function refuses requests without a session | Automated test calls each one signed out (access code until Milestone 4) |
| N7 | Security: cookie | Session cookie is HTTP-only, Secure, SameSite=Lax | Automated test reads the cookie flags (Milestone 4) |
| N8 | Screens | No clipped text or sideways scrolling at 320, 390 and 430px | Claude Code takes screenshots at each width, including the largest text size |
| N9 | Safe areas | Nothing hidden under the notch, Dynamic Island or home bar | Check on my iPhone in the installed app |
| N10 | Larger text | Usable at the largest standard iOS text size | Set text size to maximum and walk the flow |
| N11 | Accessibility | 44px tap targets, 4.5:1 text contrast, VoiceOver reads every button | Automated accessibility scan, plus one VoiceOver pass |
| N12 | Motion | No animation when Reduce Motion is on | Toggle it in iOS settings |
| N13 | Cost | Under £5 a month in Claude API spend at normal use | Check the Anthropic Console after the first month |
| N14 | Quota | One saved mix uses under 1,000 YouTube units | Check the Google Cloud quota page after a save |
| N15 | Security: audit | No high findings open at launch | Claude Code runs the security audit from the brief on 21 Oct; I review the list |
| N16 | Security: public limits | Mix pages refuse more than 60 views a minute per visitor; shares capped at 20 a day per user | Automated test fires requests past each limit and checks the friendly message |

### Sign-off before sharing with friends
- [ ] All automated tests pass on the latest deploy
- [ ] F1–F21 checked on my iPhone in the installed app
- [ ] E3, E5, E6, E7 and E10 forced at least once (Claude Code provides a test switch to simulate each) and behaved as written
- [ ] N1–N12 and N16 checked; security audit (N15) done with no high findings open; N13 and N14 reviewed after the first week
- [ ] Groove Miles test playlist from Milestone 0 still saves correctly
- [ ] Two friends added as Google test users and to the guest list, signed in, and opened a mix in their own music app via Where do you listen and a shared mix page without being asked for YouTube access
- [ ] Dedicated Trailmix API key in use with its monthly spend limit set; daily ceiling and off switch tested
- [ ] No outstanding bugs that lose a mix or show a raw error
