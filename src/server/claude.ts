// Calls Claude for mixes. Structured output keeps every answer well-formed JSON.
// E3: no answer within 20 seconds, or an unusable answer → one retry, then "failed".
// E4: Claude down, overloaded, out of credit or refusing the key → "resting".
// A CLAUDE_MODEL that doesn't work (misspelt, retired, or refusing our settings) falls back to Haiku
// with a warning in the log, instead of failing every mix.

import Anthropic from "@anthropic-ai/sdk";
import { PHASES, type PhaseId } from "@/lib/mixTypes";
import { config } from "./config";
import { fakeClaude } from "./fakes";
import { MIX_SCHEMA, MORE_SCHEMA, SYSTEM_PROMPT, mixPrompt, morePrompt } from "./prompt";
import { cleanText, type MixRequest, type TrackRef } from "./validate";

export class MixError extends Error {
  /** "timeout": the time limit for this request ran out (Generate, Remix and Swap each have one). */
  constructor(public kind: "failed" | "resting" | "timeout") {
    super(kind);
  }
}

export type SuggestedTrack = TrackRef & { phase: PhaseId };
export type ClaudeUsage = { inputTokens: number; outputTokens: number; calls: number };

const TIMEOUT_MS = 20_000;
export const FALLBACK_MODEL = "claude-haiku-5-5";
/** A model that refused once on this server; it isn't tried again until the server restarts. */
let brokenModel: string | null = null;

/** Tests only. */
export function resetModelFallbackForTests() {
  brokenModel = null;
}

/** The model to ask now: CLAUDE_MODEL, unless it has already refused here. */
export function currentModel() {
  const wanted = config.claudeModel();
  return wanted === brokenModel ? FALLBACK_MODEL : wanted;
}

/**
 * Thinking off, the way each model wants it. A list of songs doesn't need long reasoning.
 * Sonnet 5.5 turns it off with "between_tools" (it rejects "disabled"); Opus 5 and 5.5 always think
 * a little, so the setting is left out and low effort keeps it short.
 */
export function thinkingFor(model: string): Record<string, unknown> {
  if (model.startsWith("claude-sonnet-5-5")) return { thinking: { type: "between_tools" } };
  if (/^claude-opus-5(-|$)/.test(model)) return {};
  return { thinking: { type: "disabled" } };
}

/** The model itself is the problem: unknown (404) or it refused the request's settings (400). */
const modelRefused = (err: unknown) => err instanceof Anthropic.APIError && (err.status === 404 || err.status === 400);
let client: Anthropic | null = null;

function anthropic() {
  if (!client) {
    const apiKey = config.anthropicKey();
    if (!apiKey) throw new MixError("resting");
    // We handle the single retry ourselves (E3), so the SDK's automatic retries are off.
    client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  }
  return client;
}

/** Tests only: use a pretend Claude client. */
export function setClaudeClientForTests(c: unknown) {
  client = c as Anthropic;
}

export function classify(err: unknown): MixError {
  if (err instanceof MixError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new MixError("failed");
  if (err instanceof Anthropic.APIError) {
    // 401/403 bad key, 402 out of credit, 429 Anthropic's own limit, 5xx/529 down or overloaded.
    if (err.status === undefined || [401, 402, 403, 429].includes(err.status) || err.status >= 500) return new MixError("resting");
    return new MixError("failed");
  }
  return new MixError("failed");
}

async function askOnce(model: string, prompt: string, schema: object, maxTokens: number, usage: ClaudeUsage, timeout: number): Promise<unknown> {
  const response = await anthropic().messages.create(
    {
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      ...thinkingFor(model),
      output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
    } as Anthropic.MessageCreateParamsNonStreaming,
    { timeout },
  );
  usage.calls += 1;
  usage.inputTokens += response.usage.input_tokens;
  usage.outputTokens += response.usage.output_tokens;
  if (response.stop_reason !== "end_turn") throw new MixError("failed");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new MixError("failed");
  return JSON.parse(text.text);
}

/** Time left before this request's limit, or the usual 20 seconds if it has none. */
function timeLeft(deadline?: number) {
  return deadline === undefined ? TIMEOUT_MS : Math.min(TIMEOUT_MS, deadline - Date.now());
}

/** One try, and one retry if the answer was late or unusable (E3). */
async function ask(prompt: string, schema: object, maxTokens: number, a: Ask) {
  for (let attempt = 0; ; attempt++) {
    const timeout = timeLeft(a.deadline);
    if (timeout < 1500) throw new MixError("timeout");
    const model = currentModel();
    try {
      if (a.forced === "e3") throw new MixError("failed");
      if (a.forced === "e4") throw new MixError("resting");
      return await askOnce(model, prompt, schema, maxTokens, a.usage, timeout);
    } catch (err) {
      if (model !== FALLBACK_MODEL && modelRefused(err)) {
        brokenModel = model;
        console.warn(
          JSON.stringify({ event: "model-fallback", wanted: model, using: FALLBACK_MODEL, status: (err as InstanceType<typeof Anthropic.APIError>).status, detail: String((err as Error).message).slice(0, 200) }),
        );
        attempt--; // asking Haiku instead doesn't use up the retry
        continue;
      }
      const e = err instanceof SyntaxError ? new MixError("failed") : classify(err);
      if (e.kind === "resting") throw e;
      if (timeLeft(a.deadline) < 1500) throw new MixError("timeout");
      if (attempt >= 1) throw e;
    }
  }
}

function cleanTracks(raw: unknown): SuggestedTrack[] {
  const list = (raw as { tracks?: unknown })?.tracks;
  if (!Array.isArray(list)) throw new MixError("failed");
  const out: SuggestedTrack[] = [];
  for (const t of list) {
    const title = cleanText(t?.title);
    const artist = cleanText(t?.artist);
    const phase = PHASES.find((p) => p.id === t?.phase)?.id;
    if (title && artist && phase) out.push({ title, artist, phase });
  }
  return out;
}

export type Ask = {
  req: MixRequest;
  usage: ClaudeUsage;
  /** Beta test switch (E3, E4, E1), only when allowed. */
  forced?: string | null;
  /** When this request's time limit runs out (Date.now() milliseconds). */
  deadline?: number;
};

/** The time limit has run out (checked before every request, stand-ins included). */
function checkTime(a: Ask) {
  if (a.deadline !== undefined && Date.now() >= a.deadline) throw new MixError("timeout");
}

export async function suggestMix(a: Ask, exclude: TrackRef[] = [], avoidName?: string) {
  checkTime(a);
  const raw = config.fakeServices()
    ? await fakeClaude.mix(a, exclude, avoidName)
    : await ask(mixPrompt(a.req, exclude, avoidName), MIX_SCHEMA, 4000, a);
  const name = cleanText((raw as { name?: unknown })?.name)?.slice(0, 40);
  const tracks = cleanTracks(raw);
  if (!name || tracks.length < 3) throw new MixError("failed");
  return { name, tracks };
}

/** `full`: artists already in the playlist twice. */
export async function suggestMore(a: Ask, phase: PhaseId, count: number, exclude: TrackRef[], note = "", full: string[] = []) {
  checkTime(a);
  const raw = config.fakeServices()
    ? await fakeClaude.more(a, phase, count, exclude)
    : await ask(morePrompt(a.req, phase, count, exclude, note, full), MORE_SCHEMA, 2000, a);
  return cleanTracks(raw).map((t) => ({ ...t, phase }));
}
