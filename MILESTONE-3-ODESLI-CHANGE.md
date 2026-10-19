> **Superseded:** this plan was replaced by what was actually built. Deezer checks tracks and lengths, iTunes finds Apple Music links in the background, and Spotify and YouTube Music use search links. See MILESTONE-3.md and TEST-PLAN.md.

# Milestone 3 change: Odesli's public API has shut down

**Read this alongside MILESTONE-3.md. Where they disagree, this file wins.**

## What happened
Songlink/Odesli retired its public API on **31 July 2026**. Every request now returns `410 Gone`. Access is by application only, to an allowlist, with no timeline. I've applied, but **build as if it never arrives**. The ordinary song.link web pages still work, with no key.

So remove Odesli from the lookup pipeline, the queue and the `ODESLI_API_KEY` variable. Remove the footer line "Track links by Songlink/Odesli" as well, unless you end up linking to song.link pages (see below).

## New lookup plan

### When a mix is generated (must stay fast and cost no YouTube units)
1. **Cache** (Upstash), then the **iTunes Search API**, exactly as before. This confirms the track is real, gives the real duration for length fitting, and gives the Apple Music link. E1 (swap, then drop) is unchanged.
2. **Spotify and YouTube Music links are search links, built without any API:**
   - Spotify: `https://open.spotify.com/search/<title artist, URL-encoded>`
   - YouTube Music: `https://music.youtube.com/search?q=<title artist, URL-encoded>`
   - Each opens the right app on the search for that track; the user taps the top result.
3. **No YouTube API call and no Odesli call at generation.** Drop the background "Finding links 6 of 14" step. The mix is complete once iTunes is done, so N2 (30 seconds) should be easy. Tell me the measured time.
4. Optionally, add a small "Other apps" link per track to `https://song.link/<Apple Music URL>` (no key needed). If you do, keep a "Track links by Songlink" credit. If it adds clutter, skip it and tell me.

### When a mix is kept to YouTube Music (Milestone 4, but design for it now)
- Saving a YouTube playlist needs each track's **YouTube video ID**, and the only way to get one is YouTube search, at **100 units per track** out of 10,000 a day.
- So look up video IDs **only when someone taps Keep it**, never at generation, and **cache every video ID in Upstash** (shared by everyone), so a track is only ever searched for once.
- In this milestone, build the cached "get the video ID for this track" function and its tests, with a daily cap (default 60 searches, set by `YOUTUBE_SEARCH_DAILY_CAP`). Milestone 4 will use it.
- **"Open the whole playlist"** on a mix page shows only when every track already has a cached video ID, which in practice means kept mixes. Otherwise YouTube Music opens track by track via the search links.

### Spotify upgrade (only if quick, otherwise skip and tell me)
If you can set up the Spotify Web API search with app-only credentials, with no Spotify login for users, in under 30 minutes, use it to get exact Spotify track links instead of search links. Walk me through creating the Spotify developer app and adding `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to Vercel (I'll paste them myself). If Spotify's developer rules block this, keep the search links.

## Test changes
- E2 becomes: **if iTunes is down or rate-limited**, retry once, then show "Track lookup is slow right now. Try again in a minute", keeping the vibe settings. There's no YouTube fallback at generation.
- Add tests for: the search-link format (encoding of characters like `&`, `'` and `é`); no YouTube or Odesli call during generate, swap or remix; the video-ID cache (searched once, then reused); and the daily search cap.
- F15: the mix page opens each track in the chosen app using these links. Test that all three app buttons work for a track with no cached video ID.

## What to tell me when done
- The measured time for a first mix and a remix.
- Roughly how many YouTube units keeping one 45-minute mix will cost, with nothing cached and when half the tracks are cached.
- Whether the Spotify upgrade was done or skipped, and why.
