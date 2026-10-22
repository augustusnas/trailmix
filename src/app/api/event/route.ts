import { fail, ok, readJson } from "@/server/http";
import { requireGuest } from "@/server/session";
import { testSwitch } from "@/server/testSwitch";
import { checkpoint, count } from "@/server/usage";

const ANSWERS = { carried: "carried", dipped: "dipped", didntLand: "didntLand" } as const;
const int = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined);

// What only the phone knows, counted anonymously for the stats page (C1): a mix kept (with its
// freshness, F18, and the Remixes before it), a share, or a check-in answer (F17). Nothing about
// the mix itself is sent or kept.
export async function POST(req: Request) {
  const guest = requireGuest(req, testSwitch(req));
  if (!guest.ok) return fail(guest.reason, 401);
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  const sub = guest.session.sub;
  switch (body?.event) {
    case "kept": {
      const freshness = int(body.freshness, 100);
      const remixes = int(body.remixes, 50);
      if (freshness === undefined || remixes === undefined) return fail("invalid", 400);
      await Promise.all([count("kept"), count("freshness", freshness), count("keptRemixes", remixes), checkpoint(sub, "kept")]);
      return ok({ ok: true });
    }
    case "shared":
      await count("shared");
      return ok({ ok: true });
    case "checkin": {
      const answer = typeof body.answer === "string" ? ANSWERS[body.answer as keyof typeof ANSWERS] : undefined;
      if (!answer) return fail("invalid", 400);
      await Promise.all([count("checkins"), count(answer), body.favourite === true ? count("favourite") : undefined, answer === "carried" ? checkpoint(sub, "carried") : undefined]);
      return ok({ ok: true });
    }
    default:
      return fail("invalid", 400);
  }
}
