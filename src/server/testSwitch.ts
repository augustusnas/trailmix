import { resetPageEnabled } from "@/config/flags";
import { config } from "./config";

const SWITCHES = new Set(["e1", "e3", "e4", "e5", "e9", "e14", "e15", "slow"]);

/**
 * Beta test switches, so failures can be forced on a phone. Only honoured when SHOW_RESET_PAGE is
 * true (or in automated tests); otherwise ignored completely.
 */
export function testSwitch(req: Request): string | null {
  if (!resetPageEnabled() && !config.fakeServices()) return null;
  const v = req.headers.get("x-trailmix-test")?.toLowerCase() ?? "";
  return SWITCHES.has(v) ? v : null;
}
