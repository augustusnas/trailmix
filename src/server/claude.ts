// Calls Claude for mixes. Structured output keeps every answer well-formed JSON.
// E3: no answer within 20 seconds, or an unusable answer → one retry, then "failed".
// E4: Claude down, overloaded, out of credit or refusing the key → "resting".

import Anthropic from "@anthropic-ai/sdk";
import { PHASES, type PhaseId } from "@/lib/mixTypes";
import { config } from "./config";
import { fakeClaude } from "./fakes";
import { MIX_SCHEMA, MORE_SCHEMA, SYSTEM_PROMPT, mixPrompt, morePrompt } from "./prompt";
import { cleanText, type MixRequest, type TrackRef } from "./validate";

export class MixError extends Error {
  constructor(public kind: "failed" | "resting") {
    super(kind);
  }
}

export type SuggestedTrack = TrackRef & { phase: PhaseId };
export type ClaudeUsage = { inputTokens: number; outputTokens: number; calls: number };

const TIMEOUT_MS = 20_000;
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

async function askOnce(prompt: string, schema: object, maxTokens: number, usage: ClaudeUsage): Promise<unknown> {
  const response = await anthropic().messages.create({
    model: config.claudeModel(),
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    // Fast and cheap: a list of songs doesn't need long reasoning.
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema: schema as Record<string, unknown> } },
  });
  usage.calls += 1;
  usage.inputTokens += response.usage.input_tokens;
  usage.outputTokens += response.usage.output_tokens;
  if (response.stop_reason !== "end_turn") throw new MixError("failed");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new MixError("failed");
  return JSON.parse(text.text);
}

/** One try, and one retry if the answer was late or unusable (E3). */
async function ask(prompt: string, schema: object, maxTokens: number, usage: ClaudeUsage, forced?: string | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      if (forced === "e3") throw new MixError("failed");
      if (forced === "e4") throw new MixError("resting");
      return await askOnce(prompt, schema, maxTokens, usage);
    } catch (err) {
      const e = err instanceof SyntaxError ? new MixError("failed") : classify(err);
      if (e.kind === "resting" || attempt >= 1) throw e;
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
};

export async function suggestMix(a: Ask, exclude: TrackRef[] = [], avoidName?: string) {
  const raw = config.fakeServices()
    ? await fakeClaude.mix(a, exclude, avoidName)
    : await ask(mixPrompt(a.req, exclude, avoidName), MIX_SCHEMA, 4000, a.usage, a.forced);
  const name = cleanText((raw as { name?: unknown })?.name)?.slice(0, 40);
  const tracks = cleanTracks(raw);
  if (!name || tracks.length < 3) throw new MixError("failed");
  return { name, tracks };
}

export async function suggestMore(a: Ask, phase: PhaseId, count: number, exclude: TrackRef[], note = "") {
  const raw = config.fakeServices()
    ? fakeClaude.more(a, phase, count, exclude)
    : await ask(morePrompt(a.req, phase, count, exclude, note), MORE_SCHEMA, 2000, a.usage, a.forced);
  return cleanTracks(raw).map((t) => ({ ...t, phase }));
}
