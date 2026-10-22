"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackLink } from "@/components/CtaLink";
import { Headline } from "@/components/Headline";
import { Icon } from "@/components/Icon";
import { PlaylistTitle } from "@/components/PlaylistTitle";
import { SignInButton } from "@/components/SignInButton";
import { appOrDefault } from "@/data/apps";
import { CATEGORIES } from "@/data/categories";
import type { Routine } from "@/data/routines";
import type { ApiResult } from "@/lib/api";
import { energyLabel, genreLabel } from "@/lib/format";
import { MESSAGES, type ErrorCode } from "@/lib/messages";
import { fetchLinks, linksReady, requestMix, requestSwap, shareMix } from "@/lib/mixClient";
import { cameOutShort, runningMinutes, type Mix } from "@/lib/mixTypes";
import { STAGES, type StageId } from "@/lib/progress";
import { addRecentMix, load, rememberArtists, setCurrentMix, useSaved, type VibeSettings } from "@/lib/store";
import { shareLink } from "@/lib/share";
import { useOnline } from "@/lib/useOnline";
import { routineFromParams, routineHref } from "@/lib/vibeParams";
import styles from "./mix.module.css";

/** `retry` is what Try again does: the same Generate, Remix or Swap. */
type Problem = { error: ErrorCode; message: string; retry?: () => void };

export function MixScreen() {
  const router = useRouter();
  const routine = routineFromParams(useSearchParams());
  const saved = useSaved();
  const vibe = routine && saved ? saved.vibes[routine.id] : undefined;

  useEffect(() => {
    if (!routine) router.replace("/home");
    else if (saved && !vibe) router.replace(routineHref("/vibe", routine.id));
  }, [routine, saved, vibe, router]);

  if (!routine || !saved || !vibe) return null;
  return <MixMaker routine={routine} vibe={vibe} />;
}

function MixMaker({ routine, vibe }: { routine: Routine; vibe: VibeSettings }) {
  const router = useRouter();
  const saved = useSaved()!;
  const online = useOnline();
  const app = appOrDefault(saved.musicApp);
  const cat = CATEGORIES[routine.category];
  // The mix on screen lives on the phone, so a refresh never pays for a new one.
  const mix = saved.currentMix?.routineId === routine.id ? saved.currentMix : null;

  const [busy, setBusy] = useState<"making" | "remixing" | "keeping" | { swapping: number } | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  /** While making: the stage the server has reached (it reports each one as the real work gets there). */
  const [stage, setStage] = useState<StageId>("picking");
  /** E5: YouTube's daily limit is used up; offer the mix page and Share instead. */
  const [quotaId, setQuotaId] = useState<string | null>(null);
  const started = useRef(false);

  const make = useCallback(
    async (remixOf?: Mix) => {
      setBusy(remixOf ? "remixing" : "making");
      setProblem(null);
      setStage("picking");
      const res: ApiResult<{ mix: Mix }> = await requestMix(routine, vibe, load(), remixOf, setStage);
      if (res.ok) {
        setCurrentMix(res.data.mix);
        rememberArtists(res.data.mix); // so the next few mixes for this routine can use other artists
      } else {
        // A Remix that fails (or runs out of time) leaves the current mix on screen.
        setProblem({ error: res.error, message: res.message, retry: () => void make(remixOf) });
      }
      setBusy(null);
    },
    [routine, vibe],
  );

  // First visit after Make the mix: make it (once).
  useEffect(() => {
    if (mix || started.current || !online) return;
    started.current = true;
    void make();
  }, [mix, make, online]);

  // Exact Apple Music links arrive in the background (iTunes allows about 20 searches a minute).
  // Nothing waits for them: until one arrives, that track opens an Apple Music search.
  useEffect(() => {
    if (!mix || linksReady(mix) || !online) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const round = async () => {
      const current = load().currentMix;
      if (stop || !current || current.id !== mix.id) return;
      const res = await fetchLinks(current);
      if (stop) return;
      if (res) setCurrentMix(res.mix);
      timer = setTimeout(round, res ? Math.max(res.retryAfterMs, 500) : 15_000);
    };
    void round();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [mix?.id, mix && linksReady(mix), online]); // eslint-disable-line react-hooks/exhaustive-deps

  const swap = async (index: number) => {
    if (!mix) return;
    setBusy({ swapping: index });
    setProblem(null);
    const res = await requestSwap(routine, vibe, load(), mix, index);
    // On failure or after 15 seconds the original track stays.
    if (res.ok) setCurrentMix({ ...res.data.mix, shareId: undefined });
    else setProblem({ error: res.error, message: res.message, retry: () => void swap(index) });
    setBusy(null);
  };

  const keep = async () => {
    if (!mix) return;
    setBusy("keeping");
    const res = await shareMix(mix, app.id === "ytm");
    setBusy(null);
    if (!res.ok) return setProblem({ error: res.error, message: res.message });
    const kept = { ...mix, shareId: res.data.id };
    setCurrentMix(kept);
    addRecentMix(kept);
    if (res.data.youtube === "quota") return setQuotaId(res.data.id); // E5
    // MILESTONE 4: YouTube Music users get a real playlist saved here, before Saved.
    if (app.id === "ytm") router.push(routineHref("/saved", routine.id));
    else router.push(`/m/${res.data.id}`);
  };

  const pending = mix ? mix.tracks.filter((t) => t.linksPending).length : 0;
  const making = busy === "making" || busy === "remixing";
  const stageIndex = STAGES.findIndex((s) => s.id === stage);
  const stageText = STAGES[stageIndex].text(vibe.length);

  return (
    <>
      <header className={styles.band} style={{ background: cat.bg, color: cat.fg }} data-testid="mix-band" data-category={cat.id}>
        <div className="top-bar">
          <BackLink href={routineHref("/vibe", routine.id)} label="Back to vibe settings" color={cat.fg} />
          <span className="mono" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.12em" }} data-testid="routine-name">
            {routine.name} · {vibe.length} min · {energyLabel(vibe.energy)}
          </span>
        </div>
        {mix && !making ? (
          <>
            <Headline text={mix.name} size="mix" style={{ lineHeight: 0.9 }} />
            <p className="mono" data-testid="playlist-title" style={{ letterSpacing: "0.04em", textTransform: "none" }}>
              <PlaylistTitle mix={mix} />
            </p>
            <div className={styles.chips}>
              {mix.genres.map((g) => (
                <span key={g} className="mono tag" style={{ background: "var(--ink)", color: "var(--lime)" }}>
                  {genreLabel(g)}
                </span>
              ))}
              <span className="mono tag" style={{ boxShadow: `inset 0 0 0 2px ${cat.fg}` }} data-testid="running-time">
                {runningMinutes(mix)} min
              </span>
            </div>
          </>
        ) : making ? (
          <>
            <Headline text={stageText} size="mix" style={{ lineHeight: 0.9 }} />
            <div
              className={styles.stages}
              role="progressbar"
              aria-label={busy === "remixing" ? "Remixing" : "Making your mix"}
              aria-valuemin={0}
              aria-valuemax={STAGES.length}
              aria-valuenow={stageIndex + 1}
              aria-valuetext={`Step ${stageIndex + 1} of ${STAGES.length}: ${stageText}`}
              data-testid="mix-stages"
              data-stage={stage}
            >
              {STAGES.map((s, i) => (
                <span key={s.id} className={i < stageIndex ? styles.stageDone : i === stageIndex ? styles.stageNow : styles.stageNext} />
              ))}
            </div>
            <p className="mono" role="status" data-testid="mix-progress" style={{ fontSize: "var(--t-mono-12)", letterSpacing: "0.12em" }}>
              Step {stageIndex + 1} of {STAGES.length}
            </p>
          </>
        ) : (
          <Headline text={problem ? "Not this time." : "Making your mix…"} size="mix" style={{ lineHeight: 0.9 }} />
        )}
      </header>

      {!online && (
        <p className={styles.banner} role="status" data-testid="offline-banner">
          You’re offline. Make the mix and Keep it come back when you’re connected.
        </p>
      )}

      <div className={styles.list} aria-busy={making}>
        {quotaId && mix && (
          <div className={styles.problem} role="alert" data-testid="youtube-quota">
            <p>{MESSAGES.youtubeQuota}</p>
            <a href={`/m/${quotaId}`} className="cta cta--medium" style={{ background: "var(--ink)", color: "var(--lime)" }}>
              <span>Open the mix page</span>
            </a>
            <button
              type="button"
              className="cta cta--medium"
              style={{ border: "2px solid var(--ink)", color: "var(--ink)" }}
              onClick={() => shareLink(quotaId, mix.name)}
            >
              <span>Share the list</span>
            </button>
          </div>
        )}

        {problem && <ProblemBox problem={problem} routine={routine} onRetry={problem.retry ?? (() => void make())} />}

        {mix && !making && (
          <>
            {cameOutShort(mix) && (
              <p className={styles.note} data-testid="length-note">
                This one came out at {runningMinutes(mix)} minutes.
              </p>
            )}
            {pending > 0 && online && app.id === "apple" && (
              <div className={styles.linksProgress} data-testid="links-progress">
                <p className={styles.note} role="status">
                  Finding Apple Music links {mix.tracks.length - pending} of {mix.tracks.length}
                </p>
                <progress max={mix.tracks.length} value={mix.tracks.length - pending} aria-label="Apple Music links found" />
              </div>
            )}
            <section className="tracklist" aria-label="Tracks">
              {mix.tracks.map((t, i) => {
                const swapping = typeof busy === "object" && busy?.swapping === i;
                return (
                  <div key={t.key} className="track" data-testid="mix-track">
                    <span className="track-n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="track-text">
                      <span className="track-title">{swapping ? "Finding another…" : t.title}</span>
                      <span className="track-artist">{swapping ? "" : t.artist}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.swap}
                      aria-label={`Swap ${t.title} by ${t.artist}`}
                      disabled={busy !== null || !online}
                      onClick={() => swap(i)}
                    >
                      <Icon name="swap" size={20} stroke={2.2} />
                    </button>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.remix} disabled={!mix || busy !== null || !online} onClick={() => mix && make(mix)}>
          Remix
        </button>
        <button
          type="button"
          className={styles.keep}
          data-testid="mix-action"
          disabled={!mix || busy !== null || !online}
          onClick={keep}
        >
          {busy === "keeping" ? "Saving…" : app.mixAction}
        </button>
      </div>
    </>
  );
}

/** Problems where trying again straight away can work. */
const RETRYABLE = new Set<ErrorCode>(["failed", "timeout", "swapFailed"]);

function ProblemBox({ problem, routine, onRetry }: { problem: Problem; routine: Routine; onRetry: () => void }) {
  if (problem.error === "signin") {
    // E7: the mix stays on this phone; sign in and come straight back to it.
    return (
      <div className={styles.problem} role="alert" data-testid="mix-problem">
        <p>{problem.message}</p>
        <SignInButton returnTo={routineHref("/mix", routine.id)} size="medium" />
      </div>
    );
  }
  return (
    <div className={styles.problem} role="alert" data-testid="mix-problem">
      <p>{problem.message}</p>
      {RETRYABLE.has(problem.error) && (
        <button type="button" className="cta cta--medium" style={{ background: "var(--ink)", color: "var(--lime)" }} onClick={onRetry}>
          <span>Try again</span>
        </button>
      )}
      {!RETRYABLE.has(problem.error) && (
        <a href={routineHref("/vibe", routine.id)} className="cta cta--medium" style={{ border: "2px solid var(--ink)", color: "var(--ink)" }}>
          <span>Back to your vibe</span>
        </a>
      )}
    </div>
  );
}
