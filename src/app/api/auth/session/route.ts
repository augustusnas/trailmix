import { ok } from "@/server/http";
import { checkGuest } from "@/server/session";

/** Whether this phone is signed in as a guest, and their first name. Never the email or anything else. */
export async function GET(req: Request) {
  const g = checkGuest(req);
  return ok(g.ok ? { signedIn: true, firstName: g.session.firstName } : { signedIn: false, reason: g.reason });
}
