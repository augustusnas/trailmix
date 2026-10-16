# Trailmix · Milestone 2: local behaviour

## Context for Claude Code

Milestone 1 is signed off: all eight screens are live at `https://trailmix.augustusnas.com` with fake data. It installs to my iPhone home screen, and it passes N8 at the largest text size (148 tests green).

This milestone makes the app **remember things on my phone**: pins, the routine library working properly, my vibe settings for each routine, and which music app I use. There is still no sign-in, no Claude, no YouTube and no server storage. Mixes stay fake.

**I have no coding experience.** As before, explain each step in plain English, tell me exactly what to click, and ask before installing anything on my Mac.

## Fixed details (unchanged from Milestone 1)

- **Live address:** `https://trailmix.augustusnas.com`. **Repo:** `augustusnas/trailmix`, which deploys to Vercel on every push to main.
- **Secrets:** never ask me to paste one into chat.
- **Upstash Redis is now connected to the Vercel project**, so its environment variables exist. **Don't use it in this milestone.** It's for shared mix pages in Milestone 3.
- Keep everything Milestone 1 established: the design tokens, the beta label setting, the credit, the feedback button, safe areas, the large-text behaviour, the CSP headers, no cookies, and `noindex` on mix pages.

## Decisions made since Milestone 1

| Decision | What it means for this build |
| --- | --- |
| **Default pins:** Push day (Strength), Incline treadmill (Cardio), HIIT circuit (Conditioning) | One from each of three categories, so a new Home shows three different colours. These replace Indoor walk, EMOM and Full body everywhere, including any Milestone 1 tests that assert the old defaults. |
| **Shared mix page leads with the visitor's own music app** | See section 6. |
| **Recent mixes kept on the phone:** last 10 | Reserve the slot in the storage shape now. Nothing fills it until Milestone 3. |

## What to build

### 1. On-device storage, done once and done safely
- All remembered state lives in **one versioned record** in `localStorage` (for example the key `trailmix` holding `{ version: 1, onboarded, musicApp, pins, vibes, recentMixes }`). Put it behind one small module so screens never touch `localStorage` directly.
- **Nothing in it is sent to the server.** Still no cookies of any kind.
- **E12:** if the record is missing, unreadable, the wrong version or the wrong shape, quietly reset to the defaults: the three default pins, blank vibes, and no music app chosen. If `onboarded` was true, keep it true so I don't see Welcome again. Never show an error. Wrap every read and write so a storage failure (for example private browsing) can't crash a screen.
- Pins, vibes and the music app choice store **routine ids, genre ids and so on**, never display names. That way renaming a routine in `routines.ts` never breaks saved data. Any id that no longer exists is dropped silently.
- Note: on iPhone, the installed home-screen app and Safari keep **separate** storage. That's expected, and you don't need to work around it.

### 2. First run and return visits (F1, F2)
- Sign-in arrives in Milestone 4. Until then, **"Lace up" stands in for sign-in.**
- **F1:** on a fresh install, opening the app shows Welcome → Lace up → Where do you listen → "That's me" → Home, with Push day, Incline treadmill and HIIT circuit pinned, in that order.
- **F2:** once I've finished that flow, opening the app goes **straight to Home**. That applies whether I open it from the home screen or go to `/`. Welcome and Where do you listen must not flash first.
- Leave a clear, single place where Milestone 4 will swap "Lace up finished" for "signed in".

### 3. Pins (F3, F4, F5)
- **F3:** pinning from the Library adds the routine to the **end** of Home, in its category colour. The "Pin another" tile's count goes up ("4 of 6").
- **F4:** at 6 pins, every unpinned routine's pin button in the Library is **disabled** (a real disabled button with an accessible label, not just greyed out), and a "Home is full. Unpin one to add another." notice shows at the top of the Library. On Home, the "Pin another" tile becomes "Home is full" and still opens the Library.
- **F5:** unpinning in the Library removes the routine from Home straight away and frees a slot.
- I can unpin down to **zero**. Home then shows a friendly empty state ("Pin a routine to get started") with a button to the Library. It must not fall back to the defaults.
- Unpinning a routine **keeps** its saved vibe settings.
- Reordering pins is out of scope.

### 4. Library search and filters (F6)
- Search matches routine **names and category names**, ignoring case, extra spaces and punctuation ("tab" finds Tabata; "push" finds Push day; "cardio" finds all four Cardio routines). It updates as I type, with no search button.
- The category filter chips are: All, plus the five categories. **One chip is active at a time**, and it combines with the search text.
- When nothing matches, show the empty message ("Nothing on that trail. Try another word.") and a "Clear search" button.
- Search text and the active filter **reset when I leave the Library**. They aren't remembered.
- Pinned routines show their pinned state clearly. Keep the M1 layout, including the large-text behaviour where buttons move under the name.

### 5. Set the vibe remembers each routine (F7, F8)
- **F7:** when I tap **Make the mix**, save that routine's genres, energy and length. The next time I open Set the vibe for that routine, from Home or the Library, those choices are preselected. Each routine has its own memory: Boxing's settings never appear on Push day.
- **First time for a routine:** no genre selected, energy **Steady**, and length set to the option (30, 45, 60, 90) closest to the middle of that routine's typical minutes. Pick the shorter option on a tie, so Tabata 4–20 gets 30, and Push day 45–60 gets 45. Put this rule in one function with its own tests.
- **F8:** with no genre selected, tapping Make the mix shows an inline message beside the genres: "Pick at least one genre." It must not open a pop-up or alert, must not save, and must not move on. Screen readers announce the message.
- If the mockups imply a maximum number of genres, keep it. If not, **don't invent one**: tell me, and I'll decide.
- The routine still comes from the URL (`?routine=…`), as in M1. F21 must keep passing.

### 6. Where do you listen, and the shared page's lead app (F20)
- The choice on Where do you listen is saved and **never asked again** (F20).
- Everywhere the app names the music app, it uses the saved choice:
  - **The mix:** YouTube Music → "Keep it in YouTube Music"; Spotify → "Open in Spotify"; Apple Music → "Open in Apple Music".
  - **Saved:** the main button matches ("Open in YouTube Music", "Open in Spotify", "Open in Apple Music").
- **Change it in the Library:** add a small row near the end of the Library, above the feedback button: "Listening on **Spotify** · Change". It opens the three choices (reuse the Where do you listen tiles, or a compact version of them), and after a change every label updates straight away, with no reload.
- **Shared mix page (`/m/[id]`), leading with the visitor's own app:**
  - If this browser already has a saved music app (because the visitor is a Trailmix user in the same browser, or has picked one on a mix page before), that app's button comes **first and largest**, and the other two follow as smaller options.
  - If not, the page first asks **"Where do you listen?"** with the three apps as **equal** buttons. Tapping one opens that app's version of the mix and saves the choice on that phone, so their next shared mix leads with it.
  - A visitor can always pick a different app on the page. Picking a different app updates what they're remembered as.
  - This uses the same storage module. It sets no cookies, sends nothing to the server, and adds no tracking.
  - Mix data on this page stays fake. Real stored mixes arrive in Milestone 3.

### 7. Offline still works
Home, the Library, pinning, unpinning, search and Set the vibe must all work with Wi-Fi and mobile data off (the service worker from M1 plus local storage). Update the service worker's cached shell if new files need it.

## Tests, written alongside

- **Storage module:** defaults, saving and loading, unknown ids dropped, wrong version or corrupt data resetting (E12), and storage throwing an error without crashing anything.
- **F1, F2:** fresh install flow, and returning straight to Home with no flash of Welcome.
- **F3, F4, F5:** pin, cap at 6 with disabled buttons and the notice, unpin, unpin to zero and the empty state.
- **F6:** "tab", "push", "cardio" and a no-match search; filter chips; filter plus search together.
- **F7, F8:** settings preselected per routine; not shared between routines; the default-length rule; no-genre validation.
- **F20:** choose once and never asked again; labels on The mix and Saved; changing it in the Library updates the labels immediately.
- **Shared page:** leads with the saved app; asks first when there isn't one; remembers the pick.
- **Regression:** F21, the beta label and credit placement, the hidden feedback button, and the N8 screenshots at 320, 390 and 430px including the largest text size, with any new UI (the "Home is full" notice, empty states, the "Listening on" row and the shared-page question) added to the screenshot set.
- **N11:** rerun the accessibility scan, including the disabled pin buttons and the inline F8 message.
- **Privacy check:** a test that confirms no cookies are set, and that no request to our own server contains pins, vibes or the music app.
- As before, if a test fails, tell me in plain English what it means.

## Out of scope
Real sign-in, the guest list, Claude, track lookup, YouTube saving, Upstash and real shared mix storage, rate limits, the check-in card, the stats page, the welcome animation, reordering pins, and syncing settings between devices.

## Done when
1. All tests pass on GitHub Actions for the latest deploy.
2. On my iPhone, in the installed app, I can tick off: **F1–F8, F20, F21**, **E12** (instructions below), and Home plus the Library working with Wi-Fi and data off.
3. N8 still passes at the largest text size.

## When you finish, tell me
- What changed on each screen, in plain English.
- **Exactly how to test on my phone**, step by step, including how to reset the app to a fresh install (I'll need this for F1 and E12; for example, remove it from the home screen and clear Safari website data for the site, or provide a hidden reset I can reach).
- What's still fake, so I don't report it as a bug.
- Anything in the mockups you couldn't match, and why.
- Anything you need me to decide before Milestone 3 (for example, a genre limit).
