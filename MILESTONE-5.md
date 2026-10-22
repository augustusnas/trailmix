# Trailmix · Milestone 5: polish, animation and the new Set the vibe

**Brief for Sprint 3 (Tue 27 – Thu 29 Oct), written 22 Oct.** Read it with **TEST-PLAN.md**. If anything conflicts with the earlier briefs, this one wins, and tell me.

## Context for Claude Code
Milestones 0–3 are done and Milestone 4 is finishing. **Finish and push anything left from Milestone 4 before starting this one** (Parts D and E, `/terms`, the 8-genre merge, the short-mix fixes), and tell me what was left.

Launch is **Thu 5 Nov**. Sprint 4 (3–5 Nov) is Sentry, the security audit, the friend trial and sign-off, so **Milestone 5 must be built and phone-tested by Thu 29 Oct**.

**The scope is frozen.** It's this brief and nothing else. If you spot something worth doing that isn't here, list it in your report for the after-launch list. Don't build it.

**I have no coding experience.** Explain each step in plain English, ask before installing anything on my Mac, and never ask me to paste a secret into chat.

## Design references
The mockups are in `design/reference/milestone-5/`:
- `VibeB.dc.html`: the new Set the vibe (concept B, chosen 22 Oct).
- `Loading-1-picking.dc.html`, `Loading-2-energy.dc.html`, `Loading-3-length.dc.html`: the three loading stages.

They're design-tool files. Read the HTML and the `renderVals()` logic for the layout, colours, sizes and behaviour. They won't run on their own. The rest of the app still follows the original Trailmix canvas in `design/reference/`.

Palette (from `globals.css`):
- Lime `#C8E03A`
- Lilac `#A99BF5`
- Orange `#E8571E`
- Ink `#16130F`
- Sand `#EADFC8`
- Feral red `#ff3b2f`. This is new and is used only for the Feral energy level.

Fonts are Bricolage Grotesque and Space Mono. Dark text goes on lime, lilac and orange.

---

## Part A: the new Set the vibe (do this first)
Set the vibe is used on every visit, so it comes first. It replaces the current single Forest-green screen with **one question per screen**.

1. **Three steps.** Each step has its own background colour:
   - Genres on Lime
   - Energy on Lilac
   - Length on Orange

   The top bar on every step has the same three things:
   - a 44px round Back button;
   - "<Routine> · Step N of 3" in Space Mono;
   - three progress segments.

   Back on step 1 returns to wherever I came from (Home or Library).
2. **Step 1, Genres:**
   - Headline "What are you into today?".
   - The 8 genres as tiles in two columns, up to 3 at once. Selected tiles are filled Ink with Lime text.
   - A **Next** button. Pressing Next with no genre picked shows the F8 message instead of moving on.
3. **"Same as last time" card.** It sits at the top of step 1, with a dashed outline.
   - It shows the routine's last genres, energy and length, for example "Hip-hop & UK rap · Driven · 45 min". This uses the existing per-routine vibe memory (F7), so each routine keeps its own.
   - One tap fills in all three and jumps straight to step 3.
   - Hide the card when the routine has no saved vibe yet.
   - **This card is required, not optional.** Without it, the new flow is slower than the old one on every repeat visit.
4. **Step 2, Energy:**
   - Headline "How hard are you going?".
   - Four big rows: Easy, Steady, Driven, Feral. The selected row is filled Ink with Lilac text.
   - **Tapping a row highlights it, then moves on to Length after about 0.55 seconds.** If I tap another row during that pause, it switches to that row and still moves on only once.
   - Above the rows is a still shape of 7 bars. **The bars don't animate on this screen.** Their height follows the energy level (40%, 60%, 80% and 100%), with only a short height transition.
5. **Step 3, Length:**
   - Headline "How long have you got?".
   - **Two summary chips** at the top, one for the genres and one for the energy, each with an edit mark (✎). Tapping a chip goes back to that step. These chips are how people confirm their choices registered, so they must always be visible.
   - 30, 45, 60 and 90 as large tiles. Selecting one doesn't move on.
   - "Finishes at h:mm" below the tiles, worked out from the current time.
   - Then the **Make the mix** button.
6. **Keep:**
   - vibe memory per routine (F7);
   - the 3-genre limit;
   - E12, so old saved vibes, and vibes using the old genres, still work.

   The routine name and colour carry through as before (F21).
7. **No animation on any Set the vibe step**, apart from the short highlight and height transitions. Under Reduce Motion, those go too.
8. **Accessibility:**
   - 44px minimum tap targets.
   - VoiceOver reads each step's question, which option is selected, and "Step N of 3".
   - The energy auto-advance must still be usable with VoiceOver. If the auto-advance fights VoiceOver, turn it off when VoiceOver is on and show Next instead.

**Push Part A on its own** so I can try it on my phone while you build Part B.

## Part B: the loading screen (Make the mix and Remix)
Replace the current progress state with **three real stages**. Each stage appears only when the server has actually reached that step.

| Stage | Background | Headline | Line under it |
| --- | --- | --- | --- |
| 1 | Lime | Picking tracks for your vibe | The chosen genres |
| 2 | Lilac | Lining up the energy | "N tracks found so far", counting up live as Deezer confirms tracks |
| 3 | Orange | Fitting it to <length> minutes | "N tracks · M min" |

- The top bar shows "<Routine> · <length> min · <Energy>" and "Step N of 3", plus three progress segments that fill as each stage starts.
- **Equaliser bars:** 7 bars, heights rising to the middle as in the mockups. **On this screen they do animate.** Their speed follows the chosen energy level:

  | Energy | One beat |
  | --- | --- |
  | Easy | 1.4 s |
  | Steady | 0.9 s |
  | Driven | 0.6 s |
  | Feral | 0.38 s |

  Stagger the bars slightly so they don't move in step. Under Reduce Motion, the bars stay still (N12).
- **Live counts need progress from the server.** Send stage and count updates from the generate route as they happen, for example a streamed response. Pick whatever works reliably on Vercel and in the installed iPhone app. **Before you build a workaround, tell me** if streaming isn't reliable there. A fallback that guesses the stages from a timer isn't acceptable: the stages and counts on screen must be real.
- If generation ends early in a stage, go straight to The mix. Never hold someone on a stage just to show it.
- Errors E2, E3, E4, E14 and E15 replace the loading screen with their usual message and keep the vibe, as now.
- Keep N2: a mix on screen within 30 seconds, with progress shown after 2.

## Part C: the check-in, counters and stats page
1. **Check-in card (F17).** This follows the Goals and success section of the original brief.
   - **When it appears:** at the top of Home, the next time the app is opened at least an hour after a mix was kept.
   - **Wording:** "How did <fun name> do?"
   - **Answers:** Carried me, Dipped midway, Didn't land. There's also an optional "New favourite" toggle.
   - **After an answer:** one tap records it, and the card says "Noted. The next mix gets the memo."
   - **Rules:** × dismisses it. It asks once per kept mix, only for the most recent one, and never again after an answer or a dismissal.
   - **Where answers go:** they're stored with the mix on the phone and counted on the server (anonymously).
   - **Scope note:** sending check-in answers to Claude when making the next mix (F19) is **after launch**. Don't add it to the prompt in this milestone. Do store the answers so it can be added later.
2. **Counters in Upstash.** These are daily, anonymous counts, kept for 90 days:
   - mixes made and mixes kept;
   - swaps;
   - remixes before a keep;
   - check-ins, by answer, plus how many had "New favourite";
   - average freshness, using the percentage the phone already sends when a mix is kept (F18);
   - tracks not found per mix;
   - shares;
   - YouTube units used.

   Don't use cookies, third-party analytics or emails in the counters.
3. **The four journey checkpoints:**
   - first mix made;
   - first mix kept;
   - first "Carried me";
   - came back within 7 days.

   Count these per person using a **one-way hash of the Google account ID**, salted with a server secret, so the raw ID and email are never stored. Tell me if this needs a new environment variable.
4. **Stats page** at `/stats`.
   - It opens only when the signed-in account's email matches `STATS_EMAIL`, a new environment variable that isn't secret. I'll set it to my Google email. Anyone else gets "page not found".
   - It shows each measure for today, the last 7 days and the last 30 days, next to its target:

     | Measure | Target |
     | --- | --- |
     | Keep rate | over 50% |
     | Swaps per kept mix | under 3 |
     | Carried me | over 60% |
     | Dipped midway | under 25% |
     | Freshness | over 70% |
     | New favourite | 1 in 3 |
     | Not found per mix | under 1 |
     | Shared | 1 in 5 |

     It also shows the checkpoint counts and today's Claude mixes against the daily ceiling.
   - It's in the Trailmix style. Plain and readable is fine.
5. **Privacy page:** add the anonymous counters and the hashed checkpoint ID, in plain words.

## Part D: welcome animation
- On Welcome, the hills **rise in sequence**, back to front. Total time about 1.2 seconds, eased.
- The tagline and the **Sign in with Google** button are usable straight away. The animation never blocks or delays sign-in.
- Plays when Welcome is shown. Under Reduce Motion, the hills are simply in place.
- Check that it stays smooth on my iPhone in the installed app. If it stutters, simplify it before shipping it.

## Part E: error messages and test switches
- Walk every row of the Exception rules (E1–E17) in TEST-PLAN.md. Check the app shows **exactly** the wording written there, keeps the current mix or vibe, and offers the next step. Add a test for each message string.
- On the reset page (behind `SHOW_RESET_PAGE`), add any switches that are missing so I can force each of these:
  - **Missing failures:** E6, E8, E11 and E13, as well as the existing ones.
  - **Slow loading:** holds each stage for about 3 seconds so I can see all three.
  - **Check-in due now:** skips the one-hour wait.
- List which E rows I can force from the reset page and which I can't, and why.

## Part F: design pass
- Compare every screen against the canvas: Welcome, Where do you listen, Home (with the check-in card), Library, Set the vibe (three steps), loading (three stages), The mix, Saved, the shared mix page, Privacy, Terms and Stats.
- Fix small differences yourself, such as spacing, sizes, colours or type. **List anything bigger in your report instead of changing it**, and I'll decide.
- Screenshots at 320, 390 and 430px, including the largest text size, for every new screen and state (N8). Run the accessibility scan (N11).

---

## Tests
- Write the tests alongside each part, and **add a Milestone 5 section to TEST-PLAN.md** using the checks below. Update anything else in TEST-PLAN.md that the build changes.
- TEST-PLAN.md has an edit of mine that isn't committed yet (F10, "length is a guide"). Commit it with your first push if it's still uncommitted.

**Checks to add (Milestone 5):**

| ID | Check |
| --- | --- |
| V1 | Set the vibe is three steps (Genres Lime, Energy Lilac, Length Orange) with Back, "Step N of 3" and the progress segments; Back on step 1 returns to Home or Library |
| V2 | Next on Genres with nothing picked shows the F8 message; up to 3 genres |
| V3 | "Same as last time" shows the routine's last vibe and jumps to Length with it filled in; it's hidden when there's none |
| V4 | Tapping an energy level highlights it and moves to Length after about 0.55 s; a second tap during the pause switches without a double move |
| V5 | Length shows genre and energy chips that go back to their step; the finish time is correct |
| V6 | No animation on Set the vibe; none at all under Reduce Motion; VoiceOver can complete all three steps |
| L1 | The loading screen shows stages 1→3 only as the server reaches them; the "tracks found" count rises live; the length line is correct |
| L2 | Bar speed follows the energy level; still under Reduce Motion |
| C1 | Stats counters and the check-in answer appear on `/stats` the same day; `/stats` is "page not found" for anyone but `STATS_EMAIL` |
| C2 | No emails or raw Google IDs are stored in counters or checkpoints |
| W1 | The welcome hills rise in sequence without delaying sign-in; still under Reduce Motion |
| X1 | Every E rule shows its exact wording; each forceable one works from the reset page |

F17 (check-in) also becomes testable now. F19 moves to after launch: note that in the plan.

## Environment variables to walk me through
- `STATS_EMAIL`: new, not secret.
- Any secret for the checkpoint hash. Tell me whether it should be new or derived from `AUTH_SECRET`, and mark it as secret.

## Build order (push after each)
1. Part A: Set the vibe. **Push, then tell me it's ready to try.**
2. Part B: the loading screen.
3. Part C: the check-in, counters and stats page.
4. Part D: the welcome animation.
5. Part E: error messages and test switches.
6. Part F: the design pass, then the TEST-PLAN.md updates.

**If it's clear on Wednesday evening that it won't all fit by Thursday,** cut in this order and tell me first:
1. the stats page (keep the counters recording);
2. simplify the welcome animation;
3. the Part F fixes beyond anything clipped or broken.

Never cut Set the vibe, the loading screen, the check-in card or the error messages.

## Out of scope
- Sending check-ins to Claude (F19).
- Tracks appearing one by one.
- Claude choosing from real Deezer tracks.
- Spotify or Apple Music playlist saving.
- Sentry and the security audit (Sprint 4).
- Google app verification.

## When you finish, tell me
- How to test each part on my phone, step by step, including the reset-page switches.
- What the live loading stages are tied to on the server, and typical timings for each.
- What each new counter records, and confirmation that no personal data is stored.
- The design differences you didn't fix, with a screenshot of each.
- Anything I need to set in Vercel.
- Anything you'd add after launch.
